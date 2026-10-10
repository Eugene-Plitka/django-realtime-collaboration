import logging
import re

from django.db import transaction
from django.utils import timezone

from notifications.models import Notification
from notifications.services import create_and_deliver_notification
from workspaces.models import WorkspaceMembership

from .models import (
    Channel,
    ChannelMembership,
    Message,
)


logger = logging.getLogger(__name__)


@transaction.atomic
def create_channel(
    *,
    workspace,
    created_by,
    name,
    description="",
    channel_type=Channel.Type.PUBLIC,
):
    channel = Channel.objects.create(
        workspace=workspace,
        name=name,
        description=description,
        type=channel_type,
        created_by=created_by,
    )

    if channel.type == Channel.Type.PRIVATE:
        ChannelMembership.objects.create(
            channel=channel,
            user=created_by,
        )

    return channel


@transaction.atomic
def delete_channel(*, channel):
    if channel.is_general:
        raise ValueError("The general channel cannot be deleted.")

    channel.delete()


@transaction.atomic
def join_channel(*, channel, user):
    workspace_membership = WorkspaceMembership.objects.filter(
        workspace=channel.workspace,
        user=user,
    ).first()

    if workspace_membership is None:
        raise ValueError("User is not a member of this workspace.")

    if channel.type != Channel.Type.PUBLIC:
        raise ValueError("Private channels cannot be joined directly.")

    if workspace_membership.role == WorkspaceMembership.Role.GUEST:
        raise ValueError("Guests cannot join public channels directly.")

    if ChannelMembership.objects.filter(
        channel=channel,
        user=user,
    ).exists():
        raise ValueError("User is already a channel member.")

    membership = ChannelMembership.objects.create(
        channel=channel,
        user=user,
    )

    logger.info(
        ("Channel joined: user_id=%s channel_id=%s workspace_id=%s"),
        user.id,
        channel.id,
        channel.workspace_id,
    )

    return membership


@transaction.atomic
def leave_channel(*, channel, user):
    try:
        channel_membership = ChannelMembership.objects.get(
            channel=channel,
            user=user,
        )
    except ChannelMembership.DoesNotExist:
        raise ValueError("User is not a channel member.")

    workspace_membership = WorkspaceMembership.objects.filter(
        workspace=channel.workspace,
        user=user,
    ).first()

    if workspace_membership is None:
        raise ValueError("User is not a member of this workspace.")

    if channel.is_general and workspace_membership.role in {
        WorkspaceMembership.Role.OWNER,
        WorkspaceMembership.Role.ADMIN,
        WorkspaceMembership.Role.MEMBER,
    }:
        raise ValueError("This member cannot leave the general channel.")

    channel_membership.delete()

    logger.info(
        ("Channel left: user_id=%s channel_id=%s workspace_id=%s"),
        user.id,
        channel.id,
        channel.workspace_id,
    )


@transaction.atomic
def add_channel_member(*, channel, user):
    if not WorkspaceMembership.objects.filter(
        workspace=channel.workspace,
        user=user,
    ).exists():
        raise ValueError("User is not a member of this workspace.")

    if ChannelMembership.objects.filter(
        channel=channel,
        user=user,
    ).exists():
        raise ValueError("User is already a channel member.")

    membership = ChannelMembership.objects.create(
        channel=channel,
        user=user,
    )

    if channel.type == Channel.Type.PRIVATE:
        create_and_deliver_notification(
            user=user,
            notification_type=Notification.Type.CHANNEL_ADDED,
            payload={
                "workspace_id": channel.workspace_id,
                "channel_id": channel.id,
                "channel_name": channel.name,
            },
        )

    return membership


@transaction.atomic
def remove_channel_member(*, membership):
    workspace_membership = WorkspaceMembership.objects.filter(
        workspace=membership.channel.workspace,
        user=membership.user,
    ).first()

    if (
        membership.channel.is_general
        and workspace_membership is not None
        and workspace_membership.role
        in {
            WorkspaceMembership.Role.OWNER,
            WorkspaceMembership.Role.ADMIN,
            WorkspaceMembership.Role.MEMBER,
        }
    ):
        raise ValueError(
            "Owner, admin and member cannot be removed from the general channel."
        )

    membership.delete()


MENTION_PATTERN = re.compile(r"(?<![\w@])@([A-Za-z0-9_.+-]+)\b")


def extract_mentioned_usernames(*, text):
    return set(MENTION_PATTERN.findall(text))


def create_mention_notifications(*, message):
    usernames = extract_mentioned_usernames(
        text=message.text,
    )

    if not usernames:
        return

    mentioned_memberships = (
        ChannelMembership.objects.filter(
            channel=message.channel,
            user__username__in=usernames,
        )
        .exclude(
            user=message.author,
        )
        .select_related("user")
    )

    for membership in mentioned_memberships:
        create_and_deliver_notification(
            user=membership.user,
            notification_type=Notification.Type.MENTION,
            payload={
                "message_id": message.id,
                "channel_id": message.channel_id,
                "channel_name": message.channel.name,
                "workspace_id": message.channel.workspace_id,
                "author_id": message.author_id,
                "author_username": message.author.username,
            },
        )


@transaction.atomic
def create_message(
    *,
    channel,
    author,
    text,
    reply_to=None,
):
    if not ChannelMembership.objects.filter(
        channel=channel,
        user=author,
    ).exists():
        raise ValueError("User must be a channel member to send messages.")

    if reply_to is not None:
        if reply_to.channel_id != channel.id:
            raise ValueError("Reply target must belong to the same channel.")

        if reply_to.is_deleted:
            raise ValueError("Deleted messages cannot be replied to.")

    message = Message.objects.create(
        channel=channel,
        author=author,
        reply_to=reply_to,
        text=text,
    )

    create_mention_notifications(
        message=message,
    )

    logger.info(
        ("Message created: message_id=%s channel_id=%s author_id=%s"),
        message.id,
        channel.id,
        author.id,
    )

    return message


@transaction.atomic
def edit_message(*, message, text):
    if message.is_deleted:
        raise ValueError("Deleted messages cannot be edited.")

    message.text = text
    message.edited_at = timezone.now()

    message.save(
        update_fields=[
            "text",
            "edited_at",
            "updated_at",
        ]
    )

    logger.info(
        ("Message edited: message_id=%s channel_id=%s author_id=%s"),
        message.id,
        message.channel_id,
        message.author_id,
    )

    return message


@transaction.atomic
def delete_message(*, message):
    if message.is_deleted:
        raise ValueError("Message is already deleted.")

    message.is_deleted = True

    message.save(
        update_fields=[
            "is_deleted",
            "updated_at",
        ]
    )

    logger.info(
        ("Message deleted: message_id=%s channel_id=%s author_id=%s"),
        message.id,
        message.channel_id,
        message.author_id,
    )

    return message
