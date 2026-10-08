from workspaces.models import WorkspaceMembership

from .models import Channel


def can_manage_channels(*, membership):
    return membership.role in {
        WorkspaceMembership.Role.OWNER,
        WorkspaceMembership.Role.ADMIN,
    }


def can_view_public_channels(*, membership):
    return membership.role in {
        WorkspaceMembership.Role.OWNER,
        WorkspaceMembership.Role.ADMIN,
        WorkspaceMembership.Role.MEMBER,
    }


def can_self_join_channel(*, channel, membership):
    if channel.type != Channel.Type.PUBLIC:
        return False

    return membership.role in {
        WorkspaceMembership.Role.OWNER,
        WorkspaceMembership.Role.ADMIN,
        WorkspaceMembership.Role.MEMBER,
    }


def can_manage_channel_members(*, membership):
    return membership.role in {
        WorkspaceMembership.Role.OWNER,
        WorkspaceMembership.Role.ADMIN,
    }


def can_access_channel(*, channel, workspace_membership, user):
    if channel.type == Channel.Type.PUBLIC and can_view_public_channels(
        membership=workspace_membership,
    ):
        return True

    return channel.memberships.filter(
        user=user,
    ).exists()


def can_edit_message(*, message, user):
    return not message.is_deleted and message.author_id == user.id


def can_delete_message(*, message, workspace_membership, user):
    if message.is_deleted:
        return False

    if message.author_id == user.id:
        return True

    return workspace_membership.role in {
        WorkspaceMembership.Role.OWNER,
        WorkspaceMembership.Role.ADMIN,
    }


def can_access_channel_messages(
    *,
    channel,
    workspace_membership,
    user,
):
    if workspace_membership.role in {
        WorkspaceMembership.Role.OWNER,
        WorkspaceMembership.Role.ADMIN,
    }:
        return True

    return channel.memberships.filter(
        user=user,
    ).exists()
