from accounts.models import User
from channels.testing import WebsocketCommunicator
from config.asgi import application
from django.test import TransactionTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
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

        self.other_member = User.objects.create_user(
            email="other@example.com",
            username="other",
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
            user=self.other_member,
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

        ChannelMembership.objects.create(
            channel=self.channel,
            user=self.other_member,
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

    def test_author_can_edit_own_message(self):
        message = create_message(
            channel=self.channel,
            author=self.member,
            text="Old text",
        )

        response = self.client.patch(
            reverse(
                "message-detail",
                kwargs={"pk": message.id},
            ),
            {
                "text": "New text",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        message.refresh_from_db()

        self.assertEqual(
            message.text,
            "New text",
        )

        self.assertIsNotNone(
            message.edited_at,
        )

    def test_user_cannot_edit_other_users_message(self):
        message = create_message(
            channel=self.channel,
            author=self.other_member,
            text="Other message",
        )

        response = self.client.patch(
            reverse(
                "message-detail",
                kwargs={"pk": message.id},
            ),
            {
                "text": "Hacked",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_author_can_soft_delete_own_message(self):
        message = create_message(
            channel=self.channel,
            author=self.member,
            text="Delete me",
        )

        response = self.client.delete(
            reverse(
                "message-detail",
                kwargs={"pk": message.id},
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

        message.refresh_from_db()

        self.assertTrue(
            message.is_deleted,
        )

        self.assertTrue(
            Message.objects.filter(
                pk=message.id,
            ).exists()
        )

    def test_owner_can_delete_other_users_message(self):
        message = create_message(
            channel=self.channel,
            author=self.member,
            text="Message",
        )

        self.client.force_authenticate(user=self.owner)

        response = self.client.delete(
            reverse(
                "message-detail",
                kwargs={"pk": message.id},
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

        message.refresh_from_db()

        self.assertTrue(
            message.is_deleted,
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


class ChannelWebSocketTests(TransactionTestCase):
    async def test_can_connect_to_channel_websocket(self):
        communicator = WebsocketCommunicator(
            application,
            "/ws/channels/1/",
        )

        connected, _ = await communicator.connect()

        self.assertTrue(connected)

        await communicator.disconnect()
