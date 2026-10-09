from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Notification


def create_notification(
    *,
    user,
    notification_type,
    payload=None,
):
    return Notification.objects.create(
        user=user,
        type=notification_type,
        payload=payload or {},
    )


def mark_notification_read(*, notification):
    if notification.is_read:
        return notification

    notification.is_read = True
    notification.save(update_fields=["is_read"])

    return notification


def mark_notification_unread(*, notification):
    if not notification.is_read:
        return notification

    notification.is_read = False
    notification.save(update_fields=["is_read"])

    return notification


def notification_to_data(notification):
    return {
        "id": notification.id,
        "type": notification.type,
        "payload": notification.payload,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat(),
    }


def deliver_notification(*, notification):
    channel_layer = get_channel_layer()

    async_to_sync(channel_layer.group_send)(
        f"user_{notification.user_id}",
        {
            "type": "notification.created",
            "data": notification_to_data(notification),
        },
    )


def create_and_deliver_notification(
    *,
    user,
    notification_type,
    payload=None,
):
    notification = create_notification(
        user=user,
        notification_type=notification_type,
        payload=payload,
    )

    deliver_notification(notification=notification)

    return notification
