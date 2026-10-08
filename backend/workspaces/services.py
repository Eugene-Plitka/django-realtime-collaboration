from chat.models import Channel, ChannelMembership
from django.db import transaction

from workspaces.models import Workspace, WorkspaceMembership


@transaction.atomic
def create_workspace(*, name, slug, user):
    workspace = Workspace.objects.create(
        name=name,
        slug=slug,
        created_by=user,
    )

    WorkspaceMembership.objects.create(
        workspace=workspace,
        user=user,
        role=WorkspaceMembership.Role.OWNER,
    )

    general_channel = Channel.objects.create(
        workspace=workspace,
        name="general",
        type=Channel.Type.PUBLIC,
        is_general=True,
        created_by=user,
    )

    ChannelMembership.objects.create(
        channel=general_channel,
        user=user,
    )

    return workspace


@transaction.atomic
def remove_workspace_member(*, membership):
    ChannelMembership.objects.filter(
        channel__workspace=membership.workspace,
        user=membership.user,
    ).delete()

    membership.delete()


@transaction.atomic
def transfer_workspace_ownership(*, workspace, current_owner, new_owner_membership):
    current_owner_membership = WorkspaceMembership.objects.select_for_update().get(
        workspace=workspace,
        user=current_owner,
        role=WorkspaceMembership.Role.OWNER,
    )

    new_owner_membership = WorkspaceMembership.objects.select_for_update().get(
        pk=new_owner_membership.pk,
        workspace=workspace,
    )

    if new_owner_membership.role == WorkspaceMembership.Role.OWNER:
        return workspace

    current_owner_membership.role = WorkspaceMembership.Role.ADMIN
    current_owner_membership.save(update_fields=["role"])

    new_owner_membership.role = WorkspaceMembership.Role.OWNER
    new_owner_membership.save(update_fields=["role"])

    return workspace


@transaction.atomic
def leave_workspace(*, membership):
    if membership.role == WorkspaceMembership.Role.OWNER:
        raise ValueError("Workspace owner must transfer ownership before leaving.")

    ChannelMembership.objects.filter(
        channel__workspace=membership.workspace,
        user=membership.user,
    ).delete()

    membership.delete()


@transaction.atomic
def add_workspace_member(*, workspace, user, role):
    membership = WorkspaceMembership.objects.create(
        workspace=workspace,
        user=user,
        role=role,
    )

    if role != WorkspaceMembership.Role.GUEST:
        general_channel = Channel.objects.get(
            workspace=workspace,
            is_general=True,
        )

        ChannelMembership.objects.create(
            channel=general_channel,
            user=user,
        )

    return membership
