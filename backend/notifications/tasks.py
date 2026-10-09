import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from .models import Notification


logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
)
def send_notification_email(
    self,
    notification_id,
):
    notification = (
        Notification.objects.select_related(
            "user",
        )
        .filter(
            pk=notification_id,
        )
        .first()
    )

    if notification is None:
        return

    if not notification.user.email:
        return

    if notification.type == Notification.Type.WORKSPACE_INVITATION:
        return

    if notification.type == Notification.Type.MENTION:
        subject = "You were mentioned in a message"

        author_username = notification.payload.get(
            "author_username",
            "Someone",
        )

        channel_name = notification.payload.get(
            "channel_name",
            "a channel",
        )

        message = f"{author_username} mentioned you in #{channel_name}."

    elif notification.type == Notification.Type.CHANNEL_ADDED:
        subject = "You were added to a channel"

        channel_name = notification.payload.get(
            "channel_name",
            "a channel",
        )

        message = f"You were added to #{channel_name}."

    else:
        return

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[notification.user.email],
            fail_silently=False,
        )
    except Exception as exc:
        logger.exception(
            "Notification email failed for notification_id=%s",
            notification_id,
        )

        raise self.retry(
            exc=exc,
            countdown=5,
        )
