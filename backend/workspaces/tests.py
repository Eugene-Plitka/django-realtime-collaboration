from accounts.models import User
from chat.models import Channel, ChannelMembership
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from workspaces.models import WorkspaceMembership
from workspaces.services import create_workspace


class CreateWorkspaceServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com",
            username="owner",
            password="StrongPassword123!",
        )

    def test_create_workspace_creates_workspace(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        self.assertEqual(
            workspace.name,
            "Acme Development",
        )

        self.assertEqual(
            workspace.created_by,
            self.user,
        )

    def test_creator_becomes_owner(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        membership = WorkspaceMembership.objects.get(
            workspace=workspace,
            user=self.user,
        )

        self.assertEqual(
            membership.role,
            WorkspaceMembership.Role.OWNER,
        )

    def test_general_channel_is_created(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        channel = Channel.objects.get(
            workspace=workspace,
            is_general=True,
        )

        self.assertEqual(channel.name, "general")
        self.assertEqual(channel.type, Channel.Type.PUBLIC)

    def test_creator_joins_general_channel(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        general_channel = Channel.objects.get(
            workspace=workspace,
            is_general=True,
        )

        self.assertTrue(
            ChannelMembership.objects.filter(
                channel=general_channel,
                user=self.user,
            ).exists()
        )


class WorkspaceAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com",
            username="owner",
            password="StrongPassword123!",
        )

        self.other_user = User.objects.create_user(
            email="other@example.com",
            username="other",
            password="StrongPassword123!",
        )

        self.client.force_authenticate(user=self.user)

    def test_authenticated_user_can_create_workspace(self):
        response = self.client.post(
            reverse("workspace-list-create"),
            {
                "name": "Acme Development",
                "slug": "acme-development",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertEqual(
            response.data["name"],
            "Acme Development",
        )

        self.assertEqual(
            response.data["created_by"],
            self.user.id,
        )

    def test_unauthenticated_user_cannot_create_workspace(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            reverse("workspace-list-create"),
            {
                "name": "Acme Development",
                "slug": "acme-development",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_user_sees_only_workspaces_where_they_are_member(self):
        own_workspace = create_workspace(
            name="Own Workspace",
            slug="own-workspace",
            user=self.user,
        )

        create_workspace(
            name="Other Workspace",
            slug="other-workspace",
            user=self.other_user,
        )

        response = self.client.get(reverse("workspace-list-create"))

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(len(response.data), 1)
        self.assertEqual(
            response.data[0]["id"],
            own_workspace.id,
        )

    def test_unauthenticated_user_cannot_list_workspaces(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(reverse("workspace-list-create"))

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_member_can_retrieve_workspace(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        response = self.client.get(
            reverse(
                "workspace-detail",
                kwargs={"pk": workspace.pk},
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["id"],
            workspace.id,
        )

    def test_user_cannot_retrieve_workspace_without_membership(self):
        workspace = create_workspace(
            name="Other Workspace",
            slug="other-workspace",
            user=self.other_user,
        )

        response = self.client.get(
            reverse(
                "workspace-detail",
                kwargs={"pk": workspace.pk},
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_workspace_member_can_list_members(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        response = self.client.get(
            reverse(
                "workspace-member-list",
                kwargs={"workspace_id": workspace.id},
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(len(response.data), 1)
        self.assertEqual(
            response.data[0]["user_id"],
            self.user.id,
        )
        self.assertEqual(
            response.data[0]["role"],
            WorkspaceMembership.Role.OWNER,
        )

    def test_user_cannot_list_members_of_other_workspace(self):
        workspace = create_workspace(
            name="Other Workspace",
            slug="other-workspace",
            user=self.other_user,
        )

        response = self.client.get(
            reverse(
                "workspace-member-list",
                kwargs={"workspace_id": workspace.id},
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_owner_can_promote_member_to_admin(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        member = User.objects.create_user(
            email="member@example.com",
            username="member",
            password="StrongPassword123!",
        )

        membership = WorkspaceMembership.objects.create(
            workspace=workspace,
            user=member,
            role=WorkspaceMembership.Role.MEMBER,
        )

        response = self.client.patch(
            reverse(
                "workspace-member-role-update",
                kwargs={
                    "workspace_id": workspace.id,
                    "membership_id": membership.id,
                },
            ),
            {
                "role": WorkspaceMembership.Role.ADMIN,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        membership.refresh_from_db()

        self.assertEqual(
            membership.role,
            WorkspaceMembership.Role.ADMIN,
        )

    def test_admin_cannot_promote_member_to_admin(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        admin = User.objects.create_user(
            email="admin@example.com",
            username="admin",
            password="StrongPassword123!",
        )

        admin_membership = WorkspaceMembership.objects.create(
            workspace=workspace,
            user=admin,
            role=WorkspaceMembership.Role.ADMIN,
        )

        member = User.objects.create_user(
            email="member@example.com",
            username="member",
            password="StrongPassword123!",
        )

        member_membership = WorkspaceMembership.objects.create(
            workspace=workspace,
            user=member,
            role=WorkspaceMembership.Role.MEMBER,
        )

        self.client.force_authenticate(user=admin)

        response = self.client.patch(
            reverse(
                "workspace-member-role-update",
                kwargs={
                    "workspace_id": workspace.id,
                    "membership_id": member_membership.id,
                },
            ),
            {
                "role": WorkspaceMembership.Role.ADMIN,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_owner_role_cannot_be_assigned_through_role_update(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        member = User.objects.create_user(
            email="member@example.com",
            username="member",
            password="StrongPassword123!",
        )

        membership = WorkspaceMembership.objects.create(
            workspace=workspace,
            user=member,
            role=WorkspaceMembership.Role.MEMBER,
        )

        response = self.client.patch(
            reverse(
                "workspace-member-role-update",
                kwargs={
                    "workspace_id": workspace.id,
                    "membership_id": membership.id,
                },
            ),
            {
                "role": WorkspaceMembership.Role.OWNER,
            },
            format="json",
        )

        self.assertIn(
            response.status_code,
            {
                status.HTTP_400_BAD_REQUEST,
                status.HTTP_403_FORBIDDEN,
            },
        )

    def test_owner_can_remove_member(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        member = User.objects.create_user(
            email="member@example.com",
            username="member",
            password="StrongPassword123!",
        )

        membership = WorkspaceMembership.objects.create(
            workspace=workspace,
            user=member,
            role=WorkspaceMembership.Role.MEMBER,
        )

        response = self.client.delete(
            reverse(
                "workspace-member-remove",
                kwargs={
                    "workspace_id": workspace.id,
                    "membership_id": membership.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

        self.assertFalse(
            WorkspaceMembership.objects.filter(
                pk=membership.pk,
            ).exists()
        )

    def test_admin_cannot_remove_admin(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        admin = User.objects.create_user(
            email="admin@example.com",
            username="admin",
            password="StrongPassword123!",
        )

        WorkspaceMembership.objects.create(
            workspace=workspace,
            user=admin,
            role=WorkspaceMembership.Role.ADMIN,
        )

        other_admin = User.objects.create_user(
            email="other-admin@example.com",
            username="otheradmin",
            password="StrongPassword123!",
        )

        other_admin_membership = WorkspaceMembership.objects.create(
            workspace=workspace,
            user=other_admin,
            role=WorkspaceMembership.Role.ADMIN,
        )

        self.client.force_authenticate(user=admin)

        response = self.client.delete(
            reverse(
                "workspace-member-remove",
                kwargs={
                    "workspace_id": workspace.id,
                    "membership_id": other_admin_membership.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_owner_cannot_be_removed(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        owner_membership = WorkspaceMembership.objects.get(
            workspace=workspace,
            user=self.user,
        )

        response = self.client.delete(
            reverse(
                "workspace-member-remove",
                kwargs={
                    "workspace_id": workspace.id,
                    "membership_id": owner_membership.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_owner_can_transfer_ownership(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        member = User.objects.create_user(
            email="member@example.com",
            username="member",
            password="StrongPassword123!",
        )

        member_membership = WorkspaceMembership.objects.create(
            workspace=workspace,
            user=member,
            role=WorkspaceMembership.Role.MEMBER,
        )

        response = self.client.post(
            reverse(
                "workspace-transfer-ownership",
                kwargs={"workspace_id": workspace.id},
            ),
            {
                "membership_id": member_membership.id,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

        old_owner_membership = WorkspaceMembership.objects.get(
            workspace=workspace,
            user=self.user,
        )

        member_membership.refresh_from_db()

        self.assertEqual(
            old_owner_membership.role,
            WorkspaceMembership.Role.ADMIN,
        )

        self.assertEqual(
            member_membership.role,
            WorkspaceMembership.Role.OWNER,
        )

    def test_admin_cannot_transfer_ownership(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        admin = User.objects.create_user(
            email="admin@example.com",
            username="admin",
            password="StrongPassword123!",
        )

        WorkspaceMembership.objects.create(
            workspace=workspace,
            user=admin,
            role=WorkspaceMembership.Role.ADMIN,
        )

        member = User.objects.create_user(
            email="member@example.com",
            username="member",
            password="StrongPassword123!",
        )

        member_membership = WorkspaceMembership.objects.create(
            workspace=workspace,
            user=member,
            role=WorkspaceMembership.Role.MEMBER,
        )

        self.client.force_authenticate(user=admin)

        response = self.client.post(
            reverse(
                "workspace-transfer-ownership",
                kwargs={"workspace_id": workspace.id},
            ),
            {
                "membership_id": member_membership.id,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_member_can_leave_workspace(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        member = User.objects.create_user(
            email="member@example.com",
            username="member",
            password="StrongPassword123!",
        )

        WorkspaceMembership.objects.create(
            workspace=workspace,
            user=member,
            role=WorkspaceMembership.Role.MEMBER,
        )

        self.client.force_authenticate(user=member)

        response = self.client.post(
            reverse(
                "workspace-leave",
                kwargs={"workspace_id": workspace.id},
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

        self.assertFalse(
            WorkspaceMembership.objects.filter(
                workspace=workspace,
                user=member,
            ).exists()
        )

    def test_owner_cannot_leave_workspace(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        response = self.client.post(
            reverse(
                "workspace-leave",
                kwargs={"workspace_id": workspace.id},
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.assertTrue(
            WorkspaceMembership.objects.filter(
                workspace=workspace,
                user=self.user,
                role=WorkspaceMembership.Role.OWNER,
            ).exists()
        )

    def test_owner_can_add_member(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        new_user = User.objects.create_user(
            email="member@example.com",
            username="member",
            password="StrongPassword123!",
        )

        response = self.client.post(
            reverse(
                "workspace-member-add",
                kwargs={"workspace_id": workspace.id},
            ),
            {
                "user_id": new_user.id,
                "role": WorkspaceMembership.Role.MEMBER,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertTrue(
            WorkspaceMembership.objects.filter(
                workspace=workspace,
                user=new_user,
                role=WorkspaceMembership.Role.MEMBER,
            ).exists()
        )

    def test_added_member_joins_general_channel(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        new_user = User.objects.create_user(
            email="member@example.com",
            username="member",
            password="StrongPassword123!",
        )

        self.client.post(
            reverse(
                "workspace-member-add",
                kwargs={"workspace_id": workspace.id},
            ),
            {
                "user_id": new_user.id,
                "role": WorkspaceMembership.Role.MEMBER,
            },
            format="json",
        )

        general_channel = Channel.objects.get(
            workspace=workspace,
            is_general=True,
        )

        self.assertTrue(
            ChannelMembership.objects.filter(
                channel=general_channel,
                user=new_user,
            ).exists()
        )

    def test_added_guest_does_not_join_general_channel(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        guest = User.objects.create_user(
            email="guest@example.com",
            username="guest",
            password="StrongPassword123!",
        )

        self.client.post(
            reverse(
                "workspace-member-add",
                kwargs={"workspace_id": workspace.id},
            ),
            {
                "user_id": guest.id,
                "role": WorkspaceMembership.Role.GUEST,
            },
            format="json",
        )

        general_channel = Channel.objects.get(
            workspace=workspace,
            is_general=True,
        )

        self.assertFalse(
            ChannelMembership.objects.filter(
                channel=general_channel,
                user=guest,
            ).exists()
        )

    def test_admin_cannot_add_another_admin(self):
        workspace = create_workspace(
            name="Acme Development",
            slug="acme-development",
            user=self.user,
        )

        admin = User.objects.create_user(
            email="admin@example.com",
            username="admin",
            password="StrongPassword123!",
        )

        WorkspaceMembership.objects.create(
            workspace=workspace,
            user=admin,
            role=WorkspaceMembership.Role.ADMIN,
        )

        new_user = User.objects.create_user(
            email="new@example.com",
            username="newuser",
            password="StrongPassword123!",
        )

        self.client.force_authenticate(user=admin)

        response = self.client.post(
            reverse(
                "workspace-member-add",
                kwargs={"workspace_id": workspace.id},
            ),
            {
                "user_id": new_user.id,
                "role": WorkspaceMembership.Role.ADMIN,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
