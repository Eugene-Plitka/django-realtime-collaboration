from accounts.models import User
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from config.asgi import application
from django.test import TransactionTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from workspaces.models import WorkspaceMembership
from workspaces.services import (
    add_workspace_member,
    create_workspace,
)

from .models import (
    Channel,
    ChannelMembership,
    Message,
)
from .services import create_message


class ChannelAPITests(APITestCase):
    def setUp(self):

        self.owner = User.objects.create_user(
            email="owner@example.com",
            username="owner",
            password="StrongPassword123!",
        )

        self.member = User.objects.create_user(
            email="member@example.com",
            username="member",
            password="StrongPassword123!",
        )

        self.guest = User.objects.create_user(
            email="guest@example.com",
            username="guest",
            password="StrongPassword123!",
        )

        self.workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.owner,
        )

        add_workspace_member(
            workspace=self.workspace,
            user=self.member,
            role=WorkspaceMembership.Role.MEMBER,
        )

        add_workspace_member(
            workspace=self.workspace,
            user=self.guest,
            role=WorkspaceMembership.Role.GUEST,
        )

        self.client.force_authenticate(user=self.owner)

    def test_owner_can_create_public_channel(self):

        response = self.client.post(
            reverse(
                "channel-list-create",
                kwargs={
                    "workspace_id": self.workspace.id,
                },
            ),
            {
                "name": "backend",
                "description": "Backend development",
                "type": Channel.Type.PUBLIC,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertTrue(
            Channel.objects.filter(
                workspace=self.workspace,
                name="backend",
            ).exists()
        )

    def test_member_cannot_create_channel(self):

        self.client.force_authenticate(user=self.member)

        response = self.client.post(
            reverse(
                "channel-list-create",
                kwargs={
                    "workspace_id": self.workspace.id,
                },
            ),
            {
                "name": "frontend",
                "type": Channel.Type.PUBLIC,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_private_channel_creator_becomes_channel_member(self):

        response = self.client.post(
            reverse(
                "channel-list-create",
                kwargs={
                    "workspace_id": self.workspace.id,
                },
            ),
            {
                "name": "management",
                "type": Channel.Type.PRIVATE,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        channel = Channel.objects.get(
            name="management",
            workspace=self.workspace,
        )

        self.assertTrue(
            ChannelMembership.objects.filter(
                channel=channel,
                user=self.owner,
            ).exists()
        )

    def test_member_can_list_public_channels(self):

        Channel.objects.create(
            workspace=self.workspace,
            name="backend",
            type=Channel.Type.PUBLIC,
            created_by=self.owner,
        )

        self.client.force_authenticate(user=self.member)

        response = self.client.get(
            reverse(
                "channel-list-create",
                kwargs={
                    "workspace_id": self.workspace.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        names = {channel["name"] for channel in response.data}

        self.assertIn("general", names)

        self.assertIn("backend", names)

    def test_member_cannot_see_private_channel_without_membership(self):

        Channel.objects.create(
            workspace=self.workspace,
            name="management",
            type=Channel.Type.PRIVATE,
            created_by=self.owner,
        )

        self.client.force_authenticate(user=self.member)

        response = self.client.get(
            reverse(
                "channel-list-create",
                kwargs={
                    "workspace_id": self.workspace.id,
                },
            )
        )

        names = {channel["name"] for channel in response.data}

        self.assertNotIn(
            "management",
            names,
        )

    def test_guest_does_not_see_unassigned_public_channel(self):

        Channel.objects.create(
            workspace=self.workspace,
            name="backend",
            type=Channel.Type.PUBLIC,
            created_by=self.owner,
        )

        self.client.force_authenticate(user=self.guest)

        response = self.client.get(
            reverse(
                "channel-list-create",
                kwargs={
                    "workspace_id": self.workspace.id,
                },
            )
        )

        names = {channel["name"] for channel in response.data}

        self.assertNotIn(
            "backend",
            names,
        )

    def test_owner_can_update_channel(self):

        channel = Channel.objects.create(
            workspace=self.workspace,
            name="backend",
            type=Channel.Type.PUBLIC,
            created_by=self.owner,
        )

        response = self.client.patch(
            reverse(
                "channel-detail",
                kwargs={"pk": channel.id},
            ),
            {
                "name": "backend-team",
                "description": "Backend team channel",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        channel.refresh_from_db()

        self.assertEqual(
            channel.name,
            "backend-team",
        )

    def test_member_cannot_update_channel(self):

        channel = Channel.objects.create(
            workspace=self.workspace,
            name="backend",
            type=Channel.Type.PUBLIC,
            created_by=self.owner,
        )

        self.client.force_authenticate(user=self.member)

        response = self.client.patch(
            reverse(
                "channel-detail",
                kwargs={"pk": channel.id},
            ),
            {
                "name": "hacked",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_owner_can_delete_normal_channel(self):

        channel = Channel.objects.create(
            workspace=self.workspace,
            name="backend",
            type=Channel.Type.PUBLIC,
            created_by=self.owner,
        )

        response = self.client.delete(
            reverse(
                "channel-detail",
                kwargs={"pk": channel.id},
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

        self.assertFalse(
            Channel.objects.filter(
                pk=channel.id,
            ).exists()
        )

    def test_general_channel_cannot_be_deleted(self):

        general_channel = Channel.objects.get(
            workspace=self.workspace,
            is_general=True,
        )

        response = self.client.delete(
            reverse(
                "channel-detail",
                kwargs={
                    "pk": general_channel.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertTrue(
            Channel.objects.filter(
                pk=general_channel.id,
            ).exists()
        )

    def test_member_can_join_public_channel(self):

        channel = Channel.objects.create(
            workspace=self.workspace,
            name="backend",
            type=Channel.Type.PUBLIC,
            created_by=self.owner,
        )

        self.client.force_authenticate(user=self.member)

        response = self.client.post(
            reverse(
                "channel-join",
                kwargs={"channel_id": channel.id},
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertTrue(
            ChannelMembership.objects.filter(
                channel=channel,
                user=self.member,
            ).exists()
        )

    def test_guest_cannot_join_public_channel(self):

        channel = Channel.objects.create(
            workspace=self.workspace,
            name="backend",
            type=Channel.Type.PUBLIC,
            created_by=self.owner,
        )

        self.client.force_authenticate(user=self.guest)

        response = self.client.post(
            reverse(
                "channel-join",
                kwargs={"channel_id": channel.id},
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_member_cannot_self_join_private_channel(self):

        channel = Channel.objects.create(
            workspace=self.workspace,
            name="management",
            type=Channel.Type.PRIVATE,
            created_by=self.owner,
        )

        self.client.force_authenticate(user=self.member)

        response = self.client.post(
            reverse(
                "channel-join",
                kwargs={"channel_id": channel.id},
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_member_can_leave_normal_channel(self):

        channel = Channel.objects.create(
            workspace=self.workspace,
            name="backend",
            type=Channel.Type.PUBLIC,
            created_by=self.owner,
        )

        ChannelMembership.objects.create(
            channel=channel,
            user=self.member,
        )

        self.client.force_authenticate(user=self.member)

        response = self.client.post(
            reverse(
                "channel-leave",
                kwargs={"channel_id": channel.id},
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

        self.assertFalse(
            ChannelMembership.objects.filter(
                channel=channel,
                user=self.member,
            ).exists()
        )

    def test_member_cannot_leave_general_channel(self):

        general = Channel.objects.get(
            workspace=self.workspace,
            is_general=True,
        )

        self.client.force_authenticate(user=self.member)

        response = self.client.post(
            reverse(
                "channel-leave",
                kwargs={"channel_id": general.id},
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_owner_can_add_guest_to_private_channel(self):

        channel = Channel.objects.create(
            workspace=self.workspace,
            name="client-private",
            type=Channel.Type.PRIVATE,
            created_by=self.owner,
        )

        response = self.client.post(
            reverse(
                "channel-member-list-create",
                kwargs={"channel_id": channel.id},
            ),
            {
                "user_id": self.guest.id,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertTrue(
            ChannelMembership.objects.filter(
                channel=channel,
                user=self.guest,
            ).exists()
        )

    def test_cannot_add_non_workspace_user_to_channel(self):

        outsider = User.objects.create_user(
            email="outsider@example.com",
            username="outsider",
            password="StrongPassword123!",
        )

        channel = Channel.objects.create(
            workspace=self.workspace,
            name="backend",
            type=Channel.Type.PUBLIC,
            created_by=self.owner,
        )

        response = self.client.post(
            reverse(
                "channel-member-list-create",
                kwargs={"channel_id": channel.id},
            ),
            {
                "user_id": outsider.id,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertFalse(
            ChannelMembership.objects.filter(
                channel=channel,
                user=outsider,
            ).exists()
        )

    def test_admin_can_remove_member_from_channel(self):

        admin = User.objects.create_user(
            email="admin@example.com",
            username="admin",
            password="StrongPassword123!",
        )

        add_workspace_member(
            workspace=self.workspace,
            user=admin,
            role=WorkspaceMembership.Role.ADMIN,
        )

        channel = Channel.objects.create(
            workspace=self.workspace,
            name="backend",
            type=Channel.Type.PUBLIC,
            created_by=self.owner,
        )

        membership = ChannelMembership.objects.create(
            channel=channel,
            user=self.member,
        )

        self.client.force_authenticate(user=admin)

        response = self.client.delete(
            reverse(
                "channel-member-remove",
                kwargs={
                    "channel_id": channel.id,
                    "membership_id": membership.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

    def test_member_cannot_be_removed_from_general_channel(self):

        general = Channel.objects.get(
            workspace=self.workspace,
            is_general=True,
        )

        membership = ChannelMembership.objects.get(
            channel=general,
            user=self.member,
        )

        response = self.client.delete(
            reverse(
                "channel-member-remove",
                kwargs={
                    "channel_id": general.id,
                    "membership_id": membership.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_guest_can_be_added_and_removed_from_general_channel(self):

        general = Channel.objects.get(
            workspace=self.workspace,
            is_general=True,
        )

        add_response = self.client.post(
            reverse(
                "channel-member-list-create",
                kwargs={"channel_id": general.id},
            ),
            {
                "user_id": self.guest.id,
            },
            format="json",
        )

        self.assertEqual(
            add_response.status_code,
            status.HTTP_201_CREATED,
        )

        membership = ChannelMembership.objects.get(
            channel=general,
            user=self.guest,
        )

        remove_response = self.client.delete(
            reverse(
                "channel-member-remove",
                kwargs={
                    "channel_id": general.id,
                    "membership_id": membership.id,
                },
            )
        )

        self.assertEqual(
            remove_response.status_code,
            status.HTTP_204_NO_CONTENT,
        )


class MessageAPITests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com",
            username="owner",
            password="StrongPassword123!",
        )

        self.member = User.objects.create_user(
            email="member@example.com",
            username="member",
            password="StrongPassword123!",
        )

        self.workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.owner,
        )

        add_workspace_member(
            workspace=self.workspace,
            user=self.member,
            role=WorkspaceMembership.Role.MEMBER,
        )

        self.channel = Channel.objects.create(
            workspace=self.workspace,
            name="backend",
            type=Channel.Type.PUBLIC,
            created_by=self.owner,
        )

        ChannelMembership.objects.create(
            channel=self.channel,
            user=self.member,
        )

        self.client.force_authenticate(user=self.member)

    def test_channel_member_can_list_messages(self):

        create_message(
            channel=self.channel,
            author=self.member,
            text="Hello",
        )

        response = self.client.get(
            reverse(
                "message-list",
                kwargs={
                    "channel_id": self.channel.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            len(response.data["results"]),
            1,
        )

    def test_non_channel_member_cannot_list_messages(self):

        outsider = User.objects.create_user(
            email="outsider@example.com",
            username="outsider",
            password="StrongPassword123!",
        )

        add_workspace_member(
            workspace=self.workspace,
            user=outsider,
            role=WorkspaceMembership.Role.MEMBER,
        )

        self.client.force_authenticate(user=outsider)

        response = self.client.get(
            reverse(
                "message-list",
                kwargs={
                    "channel_id": self.channel.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_deleted_message_text_is_hidden(self):

        message = create_message(
            channel=self.channel,
            author=self.member,
            text="Secret deleted text",
        )

        message.is_deleted = True

        message.save(update_fields=["is_deleted"])

        response = self.client.get(
            reverse(
                "message-list",
                kwargs={
                    "channel_id": self.channel.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertIsNone(response.data["results"][0]["text"])

    def test_message_history_is_paginated(self):

        for number in range(55):
            create_message(
                channel=self.channel,
                author=self.member,
                text=f"Message {number}",
            )

        response = self.client.get(
            reverse(
                "message-list",
                kwargs={
                    "channel_id": self.channel.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            len(response.data["results"]),
            50,
        )

        self.assertIsNotNone(
            response.data["next"],
        )

    def test_message_history_is_ordered_newest_first(self):

        first = create_message(
            channel=self.channel,
            author=self.member,
            text="First",
        )

        second = create_message(
            channel=self.channel,
            author=self.member,
            text="Second",
        )

        response = self.client.get(
            reverse(
                "message-list",
                kwargs={
                    "channel_id": self.channel.id,
                },
            )
        )

        results = response.data["results"]

        self.assertEqual(
            results[0]["id"],
            second.id,
        )

        self.assertEqual(
            results[1]["id"],
            first.id,
        )

    def test_non_channel_member_cannot_create_message(self):

        outsider = User.objects.create_user(
            email="outsider@example.com",
            username="outsider",
            password="StrongPassword123!",
        )

        add_workspace_member(
            workspace=self.workspace,
            user=outsider,
            role=WorkspaceMembership.Role.MEMBER,
        )

        with self.assertRaises(ValueError):
            create_message(
                channel=self.channel,
                author=outsider,
                text="I should not be able to send this",
            )


@database_sync_to_async
def message_exists(*, channel, author, text):
    return Message.objects.filter(
        channel=channel,
        author=author,
        text=text,
    ).exists()


@database_sync_to_async
def remove_channel_membership(*, channel, user):
    ChannelMembership.objects.filter(
        channel=channel,
        user=user,
    ).delete()


@database_sync_to_async
def get_message_state(message_id):
    message = Message.objects.get(pk=message_id)

    return {
        "text": message.text,
        "edited_at": message.edited_at,
        "is_deleted": message.is_deleted,
    }


@database_sync_to_async
def create_test_message(*, channel, author, text):
    return Message.objects.create(
        channel=channel,
        author=author,
        text=text,
    )


class ChannelWebSocketTests(TransactionTestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner-ws@example.com",
            username="owner-ws",
            password="StrongPassword123!",
        )

        self.member = User.objects.create_user(
            email="member-ws@example.com",
            username="member-ws",
            password="StrongPassword123!",
        )

        self.second_member = User.objects.create_user(
            email="second-ws@example.com",
            username="second-ws",
            password="StrongPassword123!",
        )

        self.outsider = User.objects.create_user(
            email="outsider-ws@example.com",
            username="outsider-ws",
            password="StrongPassword123!",
        )

        self.non_workspace_user = User.objects.create_user(
            email="non-workspace@example.com",
            username="non-workspace",
            password="StrongPassword123!",
        )

        self.workspace = create_workspace(
            name="WebSocket Workspace",
            slug="websocket-workspace",
            user=self.owner,
        )

        add_workspace_member(
            workspace=self.workspace,
            user=self.member,
            role=WorkspaceMembership.Role.MEMBER,
        )

        add_workspace_member(
            workspace=self.workspace,
            user=self.outsider,
            role=WorkspaceMembership.Role.MEMBER,
        )

        add_workspace_member(
            workspace=self.workspace,
            user=self.second_member,
            role=WorkspaceMembership.Role.MEMBER,
        )

        self.channel = Channel.objects.create(
            workspace=self.workspace,
            name="backend-ws",
            type=Channel.Type.PUBLIC,
            created_by=self.owner,
        )

        ChannelMembership.objects.create(
            channel=self.channel,
            user=self.member,
        )

        ChannelMembership.objects.create(
            channel=self.channel,
            user=self.second_member,
        )

        ChannelMembership.objects.create(
            channel=self.channel,
            user=self.owner,
        )

        self.owner_token = str(RefreshToken.for_user(self.owner).access_token)

        self.member_token = str(RefreshToken.for_user(self.member).access_token)

        self.second_member_token = str(
            RefreshToken.for_user(self.second_member).access_token
        )

        self.outsider_token = str(RefreshToken.for_user(self.outsider).access_token)

        self.non_workspace_token = str(
            RefreshToken.for_user(self.non_workspace_user).access_token
        )

    async def test_channel_member_can_connect_with_valid_jwt(self):
        communicator = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.member_token}"],
        )

        connected, subprotocol = await communicator.connect()

        self.assertTrue(connected)
        self.assertEqual(
            subprotocol,
            f"jwt.{self.member_token}",
        )

        await communicator.disconnect()

    async def test_websocket_rejects_connection_without_jwt(self):
        communicator = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
        )

        connected, _ = await communicator.connect()

        self.assertFalse(connected)

    async def test_websocket_rejects_invalid_jwt(self):
        communicator = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=["jwt.invalid-token"],
        )

        connected, _ = await communicator.connect()

        self.assertFalse(connected)

    async def test_workspace_member_without_channel_membership_cannot_connect(self):
        communicator = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.outsider_token}"],
        )

        connected, _ = await communicator.connect()

        self.assertFalse(connected)

    async def test_non_workspace_user_cannot_connect(self):
        communicator = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.non_workspace_token}"],
        )

        connected, _ = await communicator.connect()

        self.assertFalse(connected)

    async def test_user_cannot_connect_to_nonexistent_channel(self):
        communicator = WebsocketCommunicator(
            application,
            "/ws/channels/999999/",
            subprotocols=[f"jwt.{self.member_token}"],
        )

        connected, _ = await communicator.connect()

        self.assertFalse(connected)

    async def test_member_can_create_message_via_websocket(self):
        communicator = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.member_token}"],
        )

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to(
            {
                "type": "message.create",
                "data": {
                    "text": "Hello WebSocket",
                },
            }
        )

        response = await communicator.receive_json_from()

        self.assertEqual(
            response["type"],
            "message.created",
        )
        self.assertEqual(
            response["data"]["text"],
            "Hello WebSocket",
        )
        self.assertEqual(
            response["data"]["author_id"],
            self.member.id,
        )

        self.assertTrue(
            await message_exists(
                channel=self.channel,
                author=self.member,
                text="Hello WebSocket",
            )
        )

        await communicator.disconnect()

    async def test_message_is_broadcast_to_other_channel_members(self):
        sender = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.member_token}"],
        )

        receiver = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.second_member_token}"],
        )

        sender_connected, _ = await sender.connect()
        receiver_connected, _ = await receiver.connect()

        self.assertTrue(sender_connected)
        self.assertTrue(receiver_connected)

        await sender.send_json_to(
            {
                "type": "message.create",
                "data": {
                    "text": "Broadcast message",
                },
            }
        )

        sender_response = await sender.receive_json_from()
        receiver_response = await receiver.receive_json_from()

        self.assertEqual(
            sender_response["type"],
            "message.created",
        )
        self.assertEqual(
            receiver_response["type"],
            "message.created",
        )
        self.assertEqual(
            receiver_response["data"]["text"],
            "Broadcast message",
        )
        self.assertEqual(
            sender_response["data"]["id"],
            receiver_response["data"]["id"],
        )

        await sender.disconnect()
        await receiver.disconnect()

    async def test_empty_message_is_rejected(self):
        communicator = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.member_token}"],
        )

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to(
            {
                "type": "message.create",
                "data": {
                    "text": "   ",
                },
            }
        )

        response = await communicator.receive_json_from()

        self.assertEqual(
            response["type"],
            "error",
        )
        self.assertEqual(
            response["data"]["code"],
            "invalid_message_text",
        )

        await communicator.disconnect()

    async def test_unknown_websocket_event_returns_error(self):
        communicator = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.member_token}"],
        )

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to(
            {
                "type": "something.unknown",
                "data": {},
            }
        )

        response = await communicator.receive_json_from()

        self.assertEqual(
            response["type"],
            "error",
        )
        self.assertEqual(
            response["data"]["code"],
            "unsupported_event",
        )

        await communicator.disconnect()

    async def test_message_create_rechecks_channel_membership(self):
        communicator = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.member_token}"],
        )

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await remove_channel_membership(
            channel=self.channel,
            user=self.member,
        )

        await communicator.send_json_to(
            {
                "type": "message.create",
                "data": {
                    "text": "Should fail",
                },
            }
        )

        response = await communicator.receive_json_from()

        self.assertEqual(
            response["type"],
            "error",
        )
        self.assertEqual(
            response["data"]["code"],
            "channel_access_denied",
        )

        await communicator.disconnect()

    async def test_author_can_update_message_via_websocket(self):
        message = await create_test_message(
            channel=self.channel,
            author=self.member,
            text="Original text",
        )

        communicator = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.member_token}"],
        )

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to(
            {
                "type": "message.update",
                "data": {
                    "message_id": message.id,
                    "text": "Updated text",
                },
            }
        )

        response = await communicator.receive_json_from()

        self.assertEqual(
            response["type"],
            "message.updated",
        )
        self.assertEqual(
            response["data"]["text"],
            "Updated text",
        )
        self.assertIsNotNone(response["data"]["edited_at"])

        state = await get_message_state(message.id)

        self.assertEqual(
            state["text"],
            "Updated text",
        )
        self.assertIsNotNone(state["edited_at"])

        await communicator.disconnect()

    async def test_user_cannot_update_other_users_message(self):
        message = await create_test_message(
            channel=self.channel,
            author=self.second_member,
            text="Not yours",
        )

        communicator = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.member_token}"],
        )

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to(
            {
                "type": "message.update",
                "data": {
                    "message_id": message.id,
                    "text": "Hacked",
                },
            }
        )

        response = await communicator.receive_json_from()

        self.assertEqual(
            response["type"],
            "error",
        )
        self.assertEqual(
            response["data"]["code"],
            "message_edit_forbidden",
        )

        await communicator.disconnect()

    async def test_author_can_delete_own_message(self):
        message = await create_test_message(
            channel=self.channel,
            author=self.member,
            text="Delete me",
        )

        communicator = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.member_token}"],
        )

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to(
            {
                "type": "message.delete",
                "data": {
                    "message_id": message.id,
                },
            }
        )

        response = await communicator.receive_json_from()

        self.assertEqual(
            response["type"],
            "message.deleted",
        )
        self.assertTrue(response["data"]["is_deleted"])
        self.assertIsNone(response["data"]["text"])

        state = await get_message_state(message.id)

        self.assertTrue(state["is_deleted"])

        await communicator.disconnect()

    async def test_owner_can_delete_other_users_message(self):
        message = await create_test_message(
            channel=self.channel,
            author=self.member,
            text="Moderate me",
        )

        communicator = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.owner_token}"],
        )

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to(
            {
                "type": "message.delete",
                "data": {
                    "message_id": message.id,
                },
            }
        )

        response = await communicator.receive_json_from()

        self.assertEqual(
            response["type"],
            "message.deleted",
        )
        self.assertTrue(response["data"]["is_deleted"])
        self.assertIsNone(response["data"]["text"])

        state = await get_message_state(message.id)

        self.assertTrue(state["is_deleted"])

        await communicator.disconnect()

    async def test_member_cannot_delete_other_users_message(self):
        message = await create_test_message(
            channel=self.channel,
            author=self.second_member,
            text="Protected",
        )

        communicator = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.member_token}"],
        )

        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to(
            {
                "type": "message.delete",
                "data": {
                    "message_id": message.id,
                },
            }
        )

        response = await communicator.receive_json_from()

        self.assertEqual(
            response["type"],
            "error",
        )
        self.assertEqual(
            response["data"]["code"],
            "message_delete_forbidden",
        )

        state = await get_message_state(message.id)

        self.assertFalse(state["is_deleted"])

        await communicator.disconnect()

    async def test_message_update_is_broadcast_to_channel_members(self):
        message = await create_test_message(
            channel=self.channel,
            author=self.member,
            text="Before",
        )

        sender = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.member_token}"],
        )

        receiver = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.second_member_token}"],
        )

        sender_connected, _ = await sender.connect()
        receiver_connected, _ = await receiver.connect()

        self.assertTrue(sender_connected)
        self.assertTrue(receiver_connected)

        await sender.send_json_to(
            {
                "type": "message.update",
                "data": {
                    "message_id": message.id,
                    "text": "After",
                },
            }
        )

        sender_response = await sender.receive_json_from()
        receiver_response = await receiver.receive_json_from()

        self.assertEqual(
            sender_response["type"],
            "message.updated",
        )
        self.assertEqual(
            receiver_response["type"],
            "message.updated",
        )
        self.assertEqual(
            receiver_response["data"]["text"],
            "After",
        )
        self.assertEqual(
            sender_response["data"]["id"],
            receiver_response["data"]["id"],
        )

        await sender.disconnect()
        await receiver.disconnect()

    async def test_message_delete_is_broadcast_to_channel_members(self):
        message = await create_test_message(
            channel=self.channel,
            author=self.member,
            text="Delete broadcast",
        )

        sender = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.member_token}"],
        )

        receiver = WebsocketCommunicator(
            application,
            f"/ws/channels/{self.channel.id}/",
            subprotocols=[f"jwt.{self.second_member_token}"],
        )

        sender_connected, _ = await sender.connect()
        receiver_connected, _ = await receiver.connect()

        self.assertTrue(sender_connected)
        self.assertTrue(receiver_connected)

        await sender.send_json_to(
            {
                "type": "message.delete",
                "data": {
                    "message_id": message.id,
                },
            }
        )

        sender_response = await sender.receive_json_from()
        receiver_response = await receiver.receive_json_from()

        self.assertEqual(
            sender_response["type"],
            "message.deleted",
        )
        self.assertEqual(
            receiver_response["type"],
            "message.deleted",
        )
        self.assertTrue(receiver_response["data"]["is_deleted"])
        self.assertIsNone(receiver_response["data"]["text"])
        self.assertEqual(
            sender_response["data"]["id"],
            receiver_response["data"]["id"],
        )

        await sender.disconnect()
        await receiver.disconnect()
