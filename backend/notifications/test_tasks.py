from unittest.mock import patch

from celery.exceptions import Retry
from django.core import mail
from django.test import TestCase

from accounts.models import User

from .models import Notification
from .services import create_and_deliver_notification
from .tasks import send_notification_email


class NotificationEmailTaskTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="notification-user@example.com",
            username="notification-user",
            password="StrongPassword123!",
        )

    def test_mention_notification_email_is_sent(self):
        notification = Notification.objects.create(
            user=self.user,
            type=Notification.Type.MENTION,
            payload={
                "author_username": "alex",
                "channel_name": "backend",
            },
        )

        send_notification_email(notification.id)

        self.assertEqual(
            len(mail.outbox),
            1,
        )

        email = mail.outbox[0]

        self.assertEqual(
            email.to,
            [self.user.email],
        )

        self.assertIn(
            "mentioned",
            email.subject.lower(),
        )

        self.assertIn(
            "alex",
            email.body,
        )

        self.assertIn(
            "backend",
            email.body,
        )

    def test_channel_added_notification_email_is_sent(self):
        notification = Notification.objects.create(
            user=self.user,
            type=Notification.Type.CHANNEL_ADDED,
            payload={
                "channel_name": "private-team",
            },
        )

        send_notification_email(notification.id)

        self.assertEqual(
            len(mail.outbox),
            1,
        )

        email = mail.outbox[0]

        self.assertEqual(
            email.to,
            [self.user.email],
        )

        self.assertIn(
            "added",
            email.subject.lower(),
        )

        self.assertIn(
            "private-team",
            email.body,
        )

    def test_workspace_invitation_notification_email_is_skipped(
        self,
    ):
        notification = Notification.objects.create(
            user=self.user,
            type=Notification.Type.WORKSPACE_INVITATION,
            payload={
                "workspace_name": "Acme",
            },
        )

        send_notification_email(notification.id)

        self.assertEqual(
            len(mail.outbox),
            0,
        )

    def test_missing_notification_does_nothing(self):
        send_notification_email(
            999999,
        )

        self.assertEqual(
            len(mail.outbox),
            0,
        )

    @patch(
        "notifications.tasks.send_mail",
        side_effect=ConnectionError("Email server unavailable"),
    )
    def test_email_failure_retries(
        self,
        mocked_send_mail,
    ):
        notification = Notification.objects.create(
            user=self.user,
            type=Notification.Type.MENTION,
            payload={
                "author_username": "alex",
                "channel_name": "backend",
            },
        )

        with self.assertRaises(Retry):
            send_notification_email.apply(
                args=[notification.id],
                throw=True,
            )

        mocked_send_mail.assert_called_once()


class NotificationEmailEnqueueTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="enqueue-notification@example.com",
            username="enqueue-notification",
            password="StrongPassword123!",
        )

    @patch("notifications.services.send_notification_email.delay")
    @patch("notifications.services.deliver_notification")
    def test_notification_email_is_enqueued_after_commit(
        self,
        mocked_deliver_notification,
        mocked_delay,
    ):
        with self.captureOnCommitCallbacks(execute=True):
            notification = create_and_deliver_notification(
                user=self.user,
                notification_type=(Notification.Type.MENTION),
                payload={
                    "message_id": 42,
                    "channel_name": "backend",
                },
            )

        mocked_deliver_notification.assert_called_once_with(
            notification=notification,
        )

        mocked_delay.assert_called_once_with(notification.id)

    @patch("notifications.services.send_notification_email.delay")
    @patch("notifications.services.deliver_notification")
    def test_workspace_invitation_does_not_enqueue_duplicate_email(
        self,
        mocked_deliver_notification,
        mocked_delay,
    ):
        with self.captureOnCommitCallbacks(execute=True):
            notification = create_and_deliver_notification(
                user=self.user,
                notification_type=(Notification.Type.WORKSPACE_INVITATION),
                payload={
                    "workspace_id": 1,
                },
            )

        mocked_deliver_notification.assert_called_once_with(
            notification=notification,
        )

        mocked_delay.assert_not_called()
