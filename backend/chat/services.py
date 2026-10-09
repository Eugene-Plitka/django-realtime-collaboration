from django.db import transaction
from django.utils import timezone

from notifications.models import Notification
from notifications.services import (
    create_notification,
    deliver_notification,
)
from workspaces.models import WorkspaceMembership

from .models import (
    Channel,
    ChannelMembership,
    Message,
)


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

    return ChannelMembership.objects.create(
        channel=channel,
        user=user,
    )


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

    notification = create_notification(
        user=user,
        notification_type=(Notification.Type.CHANNEL_ADDED),
        payload={
            "workspace_id": channel.workspace_id,
            "channel_id": channel.id,
            "channel_name": channel.name,
        },
    )

    transaction.on_commit(lambda: deliver_notification(notification=notification))

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


@transaction.atomic
def create_message(*, channel, author, text):
    if not ChannelMembership.objects.filter(
        channel=channel,
        user=author,
    ).exists():
        raise ValueError("User must be a channel member to send messages.")

    return Message.objects.create(
        channel=channel,
        author=author,
        text=text,
    )


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

    return message
