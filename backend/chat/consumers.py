import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from workspaces.models import WorkspaceMembership

from .models import (
    Channel,
    ChannelMembership,
    Message,
)
from .permissions import (
    can_delete_message,
    can_edit_message,
)
from .services import (
    create_message,
    delete_message,
    edit_message,
)


logger = logging.getLogger(__name__)


def reply_to_data(message):
    if message.reply_to_id is None:
        return None

    reply_to = message.reply_to

    return {
        "id": reply_to.id,
        "author_id": reply_to.author_id,
        "author_username": reply_to.author.username,
        "text": (None if reply_to.is_deleted else reply_to.text),
        "is_deleted": reply_to.is_deleted,
    }


def message_to_data(message):
    return {
        "id": message.id,
        "channel_id": message.channel_id,
        "author_id": message.author_id,
        "author_username": message.author.username,
        "reply_to": message.reply_to_id,
        "reply_to_message": reply_to_data(
            message,
        ),
        "text": (None if message.is_deleted else message.text),
        "created_at": message.created_at.isoformat(),
        "updated_at": message.updated_at.isoformat(),
        "edited_at": (message.edited_at.isoformat() if message.edited_at else None),
        "is_deleted": message.is_deleted,
    }


@database_sync_to_async
def user_has_channel_access(
    *,
    channel_id,
    user,
):
    if not user.is_authenticated:
        return False

    return ChannelMembership.objects.filter(
        channel_id=channel_id,
        user=user,
        channel__workspace__memberships__user=user,
    ).exists()


@database_sync_to_async
def create_message_for_user(
    *,
    channel_id,
    user,
    text,
    reply_to_id=None,
):
    channel = Channel.objects.get(
        pk=channel_id,
    )

    reply_to = None

    if reply_to_id is not None:
        try:
            reply_to = Message.objects.select_related(
                "author",
            ).get(
                pk=reply_to_id,
                channel_id=channel_id,
            )
        except Message.DoesNotExist:
            return (
                None,
                "reply_message_not_found",
            )

    try:
        message = create_message(
            channel=channel,
            author=user,
            text=text,
            reply_to=reply_to,
        )
    except ValueError:
        return (
            None,
            "message_create_failed",
        )

    message = Message.objects.select_related(
        "author",
        "reply_to",
        "reply_to__author",
    ).get(
        pk=message.pk,
    )

    return (
        message_to_data(
            message,
        ),
        None,
    )


@database_sync_to_async
def update_message_for_user(
    *,
    channel_id,
    message_id,
    user,
    text,
):
    try:
        message = Message.objects.select_related(
            "author",
            "channel__workspace",
            "reply_to",
            "reply_to__author",
        ).get(
            pk=message_id,
            channel_id=channel_id,
        )
    except Message.DoesNotExist:
        return (
            None,
            "message_not_found",
        )

    if not can_edit_message(
        message=message,
        user=user,
    ):
        return (
            None,
            "message_edit_forbidden",
        )

    message = edit_message(
        message=message,
        text=text,
    )

    return (
        message_to_data(
            message,
        ),
        None,
    )


@database_sync_to_async
def delete_message_for_user(
    *,
    channel_id,
    message_id,
    user,
):
    try:
        message = Message.objects.select_related(
            "author",
            "channel__workspace",
            "reply_to",
            "reply_to__author",
        ).get(
            pk=message_id,
            channel_id=channel_id,
        )
    except Message.DoesNotExist:
        return (
            None,
            "message_not_found",
        )

    workspace_membership = WorkspaceMembership.objects.filter(
        workspace=message.channel.workspace,
        user=user,
    ).first()

    if workspace_membership is None:
        return (
            None,
            "message_delete_forbidden",
        )

    if not can_delete_message(
        message=message,
        workspace_membership=workspace_membership,
        user=user,
    ):
        return (
            None,
            "message_delete_forbidden",
        )

    message = delete_message(
        message=message,
    )

    return (
        message_to_data(
            message,
        ),
        None,
    )


class ChannelConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]

        if not user.is_authenticated:
            logger.warning(
                "WebSocket connection rejected: unauthenticated channel connection",
            )

            await self.close(
                code=4401,
            )
            return

        self.channel_id = self.scope["url_route"]["kwargs"]["channel_id"]

        has_access = await user_has_channel_access(
            channel_id=self.channel_id,
            user=user,
        )

        if not has_access:
            logger.warning(
                (
                    "WebSocket connection rejected: "
                    "user_id=%s channel_id=%s access_denied"
                ),
                user.id,
                self.channel_id,
            )

            await self.close(
                code=4403,
            )
            return

        self.group_name = f"channel_{self.channel_id}"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )

        await self.accept(
            subprotocol=self.scope.get(
                "jwt_subprotocol",
            ),
        )

        logger.info(
            ("WebSocket connected: user_id=%s channel_id=%s"),
            user.id,
            self.channel_id,
        )

    async def disconnect(
        self,
        close_code,
    ):
        if hasattr(
            self,
            "group_name",
        ):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name,
            )

        user = self.scope.get(
            "user",
        )

        logger.info(
            ("WebSocket disconnected: user_id=%s channel_id=%s close_code=%s"),
            (user.id if user is not None and user.is_authenticated else None),
            getattr(
                self,
                "channel_id",
                None,
            ),
            close_code,
        )

    async def receive_json(
        self,
        content,
        **kwargs,
    ):
        event_type = content.get(
            "type",
        )

        data = content.get(
            "data",
            {},
        )

        if event_type == "message.create":
            await self.handle_message_create(
                data,
            )
            return

        if event_type == "message.update":
            await self.handle_message_update(
                data,
            )
            return

        if event_type == "message.delete":
            await self.handle_message_delete(
                data,
            )
            return

        if event_type == "typing.start":
            await self.handle_typing_start()
            return

        if event_type == "typing.stop":
            await self.handle_typing_stop()
            return

        await self.send_error(
            code="unsupported_event",
            message=("Unsupported event type."),
        )

    async def handle_message_create(
        self,
        data,
    ):
        user = self.scope["user"]

        has_access = await user_has_channel_access(
            channel_id=self.channel_id,
            user=user,
        )

        if not has_access:
            await self.send_error(
                code="channel_access_denied",
                message=("You no longer have access to this channel."),
            )
            return

        text = data.get("text")

        reply_to_id = data.get(
            "reply_to_id",
        )

        if not isinstance(
            text,
            str,
        ):
            await self.send_error(
                code="invalid_message_text",
                message=("Message text must be a string."),
            )
            return

        text = text.strip()

        if not text:
            await self.send_error(
                code="invalid_message_text",
                message=("Message text cannot be empty."),
            )
            return

        if reply_to_id is not None and not isinstance(
            reply_to_id,
            int,
        ):
            await self.send_error(
                code="invalid_reply_message_id",
                message=("Reply message id must be an integer."),
            )
            return

        try:
            (
                message_data,
                error,
            ) = await create_message_for_user(
                channel_id=self.channel_id,
                user=user,
                text=text,
                reply_to_id=reply_to_id,
            )
        except Channel.DoesNotExist:
            await self.send_error(
                code="message_create_failed",
                message=("Message could not be created."),
            )
            return

        if error:
            await self.send_error(
                code=error,
                message=("Message could not be created."),
            )
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "message.created",
                "data": message_data,
            },
        )

    async def message_created(
        self,
        event,
    ):
        await self.send_json(
            {
                "type": "message.created",
                "data": event["data"],
            }
        )

    async def send_error(
        self,
        *,
        code,
        message,
    ):
        user = self.scope.get(
            "user",
        )

        logger.warning(
            ("WebSocket event rejected: user_id=%s channel_id=%s code=%s"),
            (user.id if user is not None and user.is_authenticated else None),
            getattr(
                self,
                "channel_id",
                None,
            ),
            code,
        )

        await self.send_json(
            {
                "type": "error",
                "data": {
                    "code": code,
                    "message": message,
                },
            }
        )

    async def handle_message_update(
        self,
        data,
    ):
        user = self.scope["user"]

        has_access = await user_has_channel_access(
            channel_id=self.channel_id,
            user=user,
        )

        if not has_access:
            await self.send_error(
                code="channel_access_denied",
                message=("You no longer have access to this channel."),
            )
            return

        message_id = data.get(
            "message_id",
        )

        text = data.get(
            "text",
        )

        if not isinstance(
            message_id,
            int,
        ):
            await self.send_error(
                code="invalid_message_id",
                message=("Message id must be an integer."),
            )
            return

        if not isinstance(
            text,
            str,
        ):
            await self.send_error(
                code="invalid_message_text",
                message=("Message text must be a string."),
            )
            return

        text = text.strip()

        if not text:
            await self.send_error(
                code="invalid_message_text",
                message=("Message text cannot be empty."),
            )
            return

        (
            message_data,
            error,
        ) = await update_message_for_user(
            channel_id=self.channel_id,
            message_id=message_id,
            user=user,
            text=text,
        )

        if error:
            await self.send_error(
                code=error,
                message=("Message could not be updated."),
            )
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "message.updated",
                "data": message_data,
            },
        )

    async def message_updated(
        self,
        event,
    ):
        await self.send_json(
            {
                "type": "message.updated",
                "data": event["data"],
            }
        )

    async def handle_message_delete(
        self,
        data,
    ):
        user = self.scope["user"]

        has_access = await user_has_channel_access(
            channel_id=self.channel_id,
            user=user,
        )

        if not has_access:
            await self.send_error(
                code="channel_access_denied",
                message=("You no longer have access to this channel."),
            )
            return

        message_id = data.get(
            "message_id",
        )

        if not isinstance(
            message_id,
            int,
        ):
            await self.send_error(
                code="invalid_message_id",
                message=("Message id must be an integer."),
            )
            return

        (
            message_data,
            error,
        ) = await delete_message_for_user(
            channel_id=self.channel_id,
            message_id=message_id,
            user=user,
        )

        if error:
            await self.send_error(
                code=error,
                message=("Message could not be deleted."),
            )
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "message.deleted",
                "data": message_data,
            },
        )

    async def message_deleted(
        self,
        event,
    ):
        await self.send_json(
            {
                "type": "message.deleted",
                "data": event["data"],
            }
        )

    async def handle_typing_start(
        self,
    ):
        user = self.scope["user"]

        has_access = await user_has_channel_access(
            channel_id=self.channel_id,
            user=user,
        )

        if not has_access:
            await self.send_error(
                code="channel_access_denied",
                message=("You no longer have access to this channel."),
            )
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "typing.started",
                "data": {
                    "user_id": user.id,
                    "username": user.username,
                },
            },
        )

    async def handle_typing_stop(
        self,
    ):
        user = self.scope["user"]

        has_access = await user_has_channel_access(
            channel_id=self.channel_id,
            user=user,
        )

        if not has_access:
            await self.send_error(
                code="channel_access_denied",
                message=("You no longer have access to this channel."),
            )
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "typing.stopped",
                "data": {
                    "user_id": user.id,
                    "username": user.username,
                },
            },
        )

    async def typing_started(
        self,
        event,
    ):
        if event["data"]["user_id"] == self.scope["user"].id:
            return

        await self.send_json(
            {
                "type": "typing.started",
                "data": event["data"],
            }
        )

    async def typing_stopped(
        self,
        event,
    ):
        if event["data"]["user_id"] == self.scope["user"].id:
            return

        await self.send_json(
            {
                "type": "typing.stopped",
                "data": event["data"],
            }
        )
