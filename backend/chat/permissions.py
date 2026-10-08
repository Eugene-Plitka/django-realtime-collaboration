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
