from accounts.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from workspaces.models import WorkspaceMembership
from workspaces.services import (
    add_workspace_member,
    create_workspace,
)

from .models import Channel, ChannelMembership


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
