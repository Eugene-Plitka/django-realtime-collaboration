import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from .models import WorkspaceInvitation


logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
)
def send_workspace_invitation_email(
    self,
    invitation_id,
):
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
        logger.info(
            "Workspace invitation email skipped: invitation_id=%s not found",
            invitation_id,
        )
        return

    if invitation.status != WorkspaceInvitation.Status.PENDING:
        logger.info(
            ("Workspace invitation email skipped: invitation_id=%s status=%s"),
            invitation_id,
            invitation.status,
        )
        return

    subject = f"You have been invited to {invitation.workspace.name}"

    message = (
        f"{invitation.invited_by.username} invited you to "
        f"join {invitation.workspace.name} "
        f"as {invitation.role}.\n\n"
        f"Invitation token: {invitation.token}\n"
        f"Expires at: {invitation.expires_at.isoformat()}"
    )

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[
                invitation.email,
            ],
            fail_silently=False,
        )
    except Exception as exc:
        logger.error(
            ("Workspace invitation email failed: invitation_id=%s workspace_id=%s"),
            invitation_id,
            invitation.workspace_id,
            exc_info=not settings.TESTING,
        )

        raise self.retry(
            exc=exc,
            countdown=5,
        )

    logger.info(
        ("Workspace invitation email sent: invitation_id=%s workspace_id=%s"),
        invitation.id,
        invitation.workspace_id,
    )
