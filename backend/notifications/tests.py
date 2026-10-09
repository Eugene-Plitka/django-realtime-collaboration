from accounts.models import User
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from chat.models import Channel
from chat.services import add_channel_member
from config.asgi import application
from django.test import TransactionTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from workspaces.models import WorkspaceMembership
from workspaces.services import add_workspace_member, create_workspace

from .models import Notification
from .services import (
    create_and_deliver_notification,
    create_notification,
)


class NotificationAPITests(APITestCase):
    def setUp(self):

        self.user = User.objects.create_user(
            email="user@example.com",
            username="user",
            password="StrongPassword123!",
        )

        self.other_user = User.objects.create_user(
            email="other@example.com",
            username="other",
            password="StrongPassword123!",
        )

        self.notification = create_notification(
            user=self.user,
            notification_type=Notification.Type.CHANNEL_ADDED,
            payload={
                "channel_id": 10,
                "channel_name": "backend",
            },
        )

        self.other_notification = create_notification(
            user=self.other_user,
            notification_type=Notification.Type.MENTION,
            payload={
                "message_id": 20,
            },
        )

        self.client.force_authenticate(user=self.user)

    def test_user_can_list_own_notifications(self):

        response = self.client.get(reverse("notification-list"))

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            len(response.data),
            1,
        )

        self.assertEqual(
            response.data[0]["id"],
            self.notification.id,
        )

    def test_user_cannot_see_other_users_notifications(self):

        response = self.client.get(reverse("notification-list"))

        ids = {notification["id"] for notification in response.data}

        self.assertIn(
            self.notification.id,
            ids,
        )

        self.assertNotIn(
            self.other_notification.id,
            ids,
        )

    def test_user_can_mark_notification_read(self):

        self.assertFalse(self.notification.is_read)

        response = self.client.post(
            reverse(
                "notification-read",
                kwargs={
                    "pk": self.notification.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.notification.refresh_from_db()

        self.assertTrue(self.notification.is_read)

        self.assertTrue(response.data["is_read"])

    def test_user_can_mark_notification_unread(self):

        self.notification.is_read = True

        self.notification.save(update_fields=["is_read"])

        response = self.client.post(
            reverse(
                "notification-unread",
                kwargs={
                    "pk": self.notification.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.notification.refresh_from_db()

        self.assertFalse(self.notification.is_read)

        self.assertFalse(response.data["is_read"])

    def test_user_cannot_mark_other_users_notification_read(self):

        response = self.client.post(
            reverse(
                "notification-read",
                kwargs={
                    "pk": self.other_notification.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.other_notification.refresh_from_db()

        self.assertFalse(self.other_notification.is_read)

    def test_user_cannot_mark_other_users_notification_unread(self):

        self.other_notification.is_read = True

        self.other_notification.save(update_fields=["is_read"])

        response = self.client.post(
            reverse(
                "notification-unread",
                kwargs={
                    "pk": self.other_notification.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.other_notification.refresh_from_db()

        self.assertTrue(self.other_notification.is_read)

    def test_notification_list_requires_authentication(self):

        self.client.force_authenticate(user=None)

        response = self.client.get(reverse("notification-list"))

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )


@database_sync_to_async
def notification_exists(
    *,
    user,
    notification_type,
):

    return Notification.objects.filter(
        user=user,
        type=notification_type,
    ).exists()


@database_sync_to_async
def create_and_deliver_notification_async(
    *,
    user,
    notification_type,
    payload=None,
):

    return create_and_deliver_notification(
        user=user,
        notification_type=notification_type,
        payload=payload,
    )


@database_sync_to_async
def add_user_to_channel(*, channel, user):
    return add_channel_member(
        channel=channel,
        user=user,
    )


class NotificationWebSocketTests(TransactionTestCase):
    def setUp(self):

        self.user = User.objects.create_user(
            email="ws-user@example.com",
            username="ws-user",
            password="StrongPassword123!",
        )

        self.other_user = User.objects.create_user(
            email="ws-other@example.com",
            username="ws-other",
            password="StrongPassword123!",
        )

        self.owner = User.objects.create_user(
            email="owner-notification@example.com",
            username="owner-notification",
            password="StrongPassword123!",
        )

        self.workspace = create_workspace(
            name="Notification Workspace",
            slug="notification-workspace",
            user=self.owner,
        )

        add_workspace_member(
            workspace=self.workspace,
            user=self.user,
            role=WorkspaceMembership.Role.MEMBER,
        )

        self.channel = Channel.objects.create(
            workspace=self.workspace,
            name="private-notifications",
            type=Channel.Type.PRIVATE,
            created_by=self.owner,
        )

        self.user_token = str(RefreshToken.for_user(self.user).access_token)

        self.other_user_token = str(RefreshToken.for_user(self.other_user).access_token)

    async def test_authenticated_user_can_connect_to_notification_websocket(self):

        communicator = WebsocketCommunicator(
            application,
            "/ws/notifications/",
            subprotocols=[f"jwt.{self.user_token}"],
        )

        connected, subprotocol = await communicator.connect()

        self.assertTrue(connected)

        self.assertEqual(
            subprotocol,
            f"jwt.{self.user_token}",
        )

        await communicator.disconnect()

    async def test_notification_websocket_rejects_connection_without_jwt(self):

        communicator = WebsocketCommunicator(
            application,
            "/ws/notifications/",
        )

        connected, _ = await communicator.connect()

        self.assertFalse(connected)

    async def test_notification_websocket_rejects_invalid_jwt(self):

        communicator = WebsocketCommunicator(
            application,
            "/ws/notifications/",
            subprotocols=["jwt.invalid-token"],
        )

        connected, _ = await communicator.connect()

        self.assertFalse(connected)

    async def test_notification_is_delivered_in_realtime(self):

        communicator = WebsocketCommunicator(
            application,
            "/ws/notifications/",
            subprotocols=[f"jwt.{self.user_token}"],
        )

        connected, _ = await communicator.connect()

        self.assertTrue(connected)

        await create_and_deliver_notification_async(
            user=self.user,
            notification_type=(Notification.Type.CHANNEL_ADDED),
            payload={
                "channel_id": 42,
                "channel_name": "backend",
            },
        )

        response = await communicator.receive_json_from()

        self.assertEqual(
            response["type"],
            "notification.created",
        )

        self.assertEqual(
            response["data"]["type"],
            Notification.Type.CHANNEL_ADDED,
        )

        self.assertEqual(
            response["data"]["payload"]["channel_id"],
            42,
        )

        self.assertEqual(
            response["data"]["payload"]["channel_name"],
            "backend",
        )

        self.assertFalse(response["data"]["is_read"])

        await communicator.disconnect()

    async def test_notification_is_persisted_before_delivery(self):

        communicator = WebsocketCommunicator(
            application,
            "/ws/notifications/",
            subprotocols=[f"jwt.{self.user_token}"],
        )

        connected, _ = await communicator.connect()

        self.assertTrue(connected)

        await create_and_deliver_notification_async(
            user=self.user,
            notification_type=(Notification.Type.MENTION),
            payload={
                "message_id": 99,
            },
        )

        response = await communicator.receive_json_from()

        self.assertEqual(
            response["type"],
            "notification.created",
        )

        exists = await notification_exists(
            user=self.user,
            notification_type=(Notification.Type.MENTION),
        )

        self.assertTrue(exists)

        await communicator.disconnect()

    async def test_notification_is_not_delivered_to_other_user(self):

        first_communicator = WebsocketCommunicator(
            application,
            "/ws/notifications/",
            subprotocols=[f"jwt.{self.user_token}"],
        )

        second_communicator = WebsocketCommunicator(
            application,
            "/ws/notifications/",
            subprotocols=[f"jwt.{self.other_user_token}"],
        )

        first_connected, _ = await first_communicator.connect()

        second_connected, _ = await second_communicator.connect()

        self.assertTrue(first_connected)

        self.assertTrue(second_connected)

        await create_and_deliver_notification_async(
            user=self.user,
            notification_type=(Notification.Type.CHANNEL_ADDED),
            payload={
                "channel_id": 55,
            },
        )

        first_response = await first_communicator.receive_json_from()

        self.assertEqual(
            first_response["type"],
            "notification.created",
        )

        self.assertEqual(
            first_response["data"]["payload"]["channel_id"],
            55,
        )

        self.assertTrue(await second_communicator.receive_nothing(timeout=0.5))

        await first_communicator.disconnect()

        await second_communicator.disconnect()

    async def test_adding_user_to_channel_creates_and_delivers_notification(self):
        communicator = WebsocketCommunicator(
            application,
            "/ws/notifications/",
            subprotocols=[f"jwt.{self.user_token}"],
        )

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await add_user_to_channel(
            channel=self.channel,
            user=self.user,
        )

        response = await communicator.receive_json_from()

        self.assertEqual(
            response["type"],
            "notification.created",
        )
        self.assertEqual(
            response["data"]["type"],
            Notification.Type.CHANNEL_ADDED,
        )
        self.assertEqual(
            response["data"]["payload"]["workspace_id"],
            self.workspace.id,
        )
        self.assertEqual(
            response["data"]["payload"]["channel_id"],
            self.channel.id,
        )
        self.assertEqual(
            response["data"]["payload"]["channel_name"],
            self.channel.name,
        )

        exists = await notification_exists(
            user=self.user,
            notification_type=Notification.Type.CHANNEL_ADDED,
        )
        self.assertTrue(exists)

        await communicator.disconnect()
