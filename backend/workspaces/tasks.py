from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from .models import WorkspaceInvitation


@shared_task
def send_workspace_invitation_email(invitation_id):
    invitation = (
        WorkspaceInvitation.objects.select_related(
            "workspace",
            "invited_by",
        )
        .filter(
            pk=invitation_id,
        )
        .first()
    )

    if invitation is None:
        return

    if invitation.status != WorkspaceInvitation.Status.PENDING:
        return

    subject = f"You have been invited to {invitation.workspace.name}"

    message = (
        f"{invitation.invited_by.username} invited you to "
        f"join {invitation.workspace.name} "
        f"as {invitation.role}.\n\n"
        f"Invitation token: {invitation.token}\n"
        f"Expires at: {invitation.expires_at.isoformat()}"
    )

    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[invitation.email],
        fail_silently=False,
    )
