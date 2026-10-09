from datetime import timedelta

from accounts.models import User
from chat.models import Channel, ChannelMembership
from django.db import transaction
from django.utils import timezone
from notifications.models import Notification
from notifications.services import create_and_deliver_notification

from workspaces.models import (
    Workspace,
    WorkspaceInvitation,
    WorkspaceMembership,
)


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


@transaction.atomic
def create_workspace_invitation(
    *,
    workspace,
    email,
    invited_by,
    role,
):
    if role == WorkspaceMembership.Role.OWNER:
        raise ValueError("Owner role cannot be assigned through invitation.")

    if role not in {
        WorkspaceMembership.Role.ADMIN,
        WorkspaceMembership.Role.MEMBER,
        WorkspaceMembership.Role.GUEST,
    }:
        raise ValueError("Invalid invitation role.")

    normalized_email = email.lower()

    if WorkspaceMembership.objects.filter(
        workspace=workspace,
        user__email__iexact=normalized_email,
    ).exists():
        raise ValueError("User is already a workspace member.")

    if WorkspaceInvitation.objects.filter(
        workspace=workspace,
        email__iexact=normalized_email,
        status=WorkspaceInvitation.Status.PENDING,
        expires_at__gt=timezone.now(),
    ).exists():
        raise ValueError("An active invitation already exists for this email.")

    invitation = WorkspaceInvitation.objects.create(
        workspace=workspace,
        email=normalized_email,
        invited_by=invited_by,
        role=role,
        expires_at=timezone.now() + timedelta(days=7),
    )

    invited_user = User.objects.filter(
        email__iexact=normalized_email,
    ).first()

    if invited_user is not None:
        create_and_deliver_notification(
            user=invited_user,
            notification_type=Notification.Type.WORKSPACE_INVITATION,
            payload={
                "invitation_id": invitation.id,
                "workspace_id": workspace.id,
                "workspace_name": workspace.name,
                "role": invitation.role,
                "invited_by_id": invited_by.id,
                "invited_by_username": invited_by.username,
                "expires_at": invitation.expires_at.isoformat(),
            },
        )

    return invitation


def accept_workspace_invitation(*, token, user):
    expired = False
    membership = None

    with transaction.atomic():
        invitation = (
            WorkspaceInvitation.objects.select_for_update()
            .select_related("workspace")
            .get(token=token)
        )

        if invitation.status != WorkspaceInvitation.Status.PENDING:
            raise ValueError("Invitation is no longer active.")

        if invitation.expires_at <= timezone.now():
            invitation.status = WorkspaceInvitation.Status.EXPIRED
            invitation.save(update_fields=["status"])

            expired = True

        else:
            if invitation.email.lower() != user.email.lower():
                raise ValueError("This invitation belongs to another email address.")

            if WorkspaceMembership.objects.filter(
                workspace=invitation.workspace,
                user=user,
            ).exists():
                raise ValueError("User is already a workspace member.")

            membership = add_workspace_member(
                workspace=invitation.workspace,
                user=user,
                role=invitation.role,
            )

            invitation.status = WorkspaceInvitation.Status.ACCEPTED
            invitation.accepted_at = timezone.now()

            invitation.save(
                update_fields=[
                    "status",
                    "accepted_at",
                ]
            )

    if expired:
        raise ValueError("Invitation has expired.")

    return membership


@transaction.atomic
def cancel_workspace_invitation(*, invitation):
    if invitation.status != WorkspaceInvitation.Status.PENDING:
        raise ValueError("Only pending invitations can be cancelled.")

    invitation.status = WorkspaceInvitation.Status.CANCELLED
    invitation.save(update_fields=["status"])

    return invitation
