from accounts.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from workspaces.models import (
    WorkspaceMembership,
)
from workspaces.services import (
    add_workspace_member,
    create_workspace,
)

from .models import (
    DirectConversation,
    DirectConversationParticipant,
    DirectMessage,
)


class DirectConversationAPITests(
    APITestCase,
):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="dm-owner@example.com",
            username="dm-owner",
            password="StrongPassword123!",
        )

        self.member = User.objects.create_user(
            email="dm-member@example.com",
            username="dm-member",
            password="StrongPassword123!",
        )

        self.second_member = User.objects.create_user(
            email="dm-second@example.com",
            username="dm-second",
            password="StrongPassword123!",
        )

        self.outsider = User.objects.create_user(
            email="dm-outsider@example.com",
            username="dm-outsider",
            password="StrongPassword123!",
        )

        self.workspace = create_workspace(
            name="DM Workspace",
            slug="dm-workspace",
            user=self.owner,
        )

        add_workspace_member(
            workspace=self.workspace,
            user=self.member,
            role=WorkspaceMembership.Role.MEMBER,
        )

        add_workspace_member(
            workspace=self.workspace,
            user=self.second_member,
            role=WorkspaceMembership.Role.MEMBER,
        )

        self.client.force_authenticate(
            user=self.owner,
        )

    def test_member_can_create_direct_conversation(
        self,
    ):
        response = self.client.post(
            reverse(
                "direct-conversation-list-create",
                kwargs={
                    "workspace_id": self.workspace.id,
                },
            ),
            {
                "type": DirectConversation.Type.DIRECT,
                "participant_ids": [
                    self.member.id,
                ],
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        conversation = DirectConversation.objects.get(
            pk=response.data["id"],
        )

        self.assertEqual(
            conversation.type,
            DirectConversation.Type.DIRECT,
        )

        participant_ids = set(
            DirectConversationParticipant.objects.filter(
                conversation=conversation,
            ).values_list(
                "user_id",
                flat=True,
            )
        )

        self.assertEqual(
            participant_ids,
            {
                self.owner.id,
                self.member.id,
            },
        )

    def test_duplicate_direct_conversation_returns_existing_conversation(
        self,
    ):
        url = reverse(
            "direct-conversation-list-create",
            kwargs={
                "workspace_id": self.workspace.id,
            },
        )

        first_response = self.client.post(
            url,
            {
                "type": DirectConversation.Type.DIRECT,
                "participant_ids": [
                    self.member.id,
                ],
            },
            format="json",
        )

        self.client.force_authenticate(
            user=self.member,
        )

        second_response = self.client.post(
            url,
            {
                "type": DirectConversation.Type.DIRECT,
                "participant_ids": [
                    self.owner.id,
                ],
            },
            format="json",
        )

        self.assertEqual(
            first_response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertEqual(
            second_response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            first_response.data["id"],
            second_response.data["id"],
        )

        self.assertEqual(
            DirectConversation.objects.filter(
                workspace=self.workspace,
                type=DirectConversation.Type.DIRECT,
            ).count(),
            1,
        )

    def test_group_conversation_requires_three_participants_including_creator(
        self,
    ):
        response = self.client.post(
            reverse(
                "direct-conversation-list-create",
                kwargs={
                    "workspace_id": self.workspace.id,
                },
            ),
            {
                "type": DirectConversation.Type.GROUP,
                "participant_ids": [
                    self.member.id,
                ],
                "name": "Too small",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_member_can_create_group_conversation(
        self,
    ):
        response = self.client.post(
            reverse(
                "direct-conversation-list-create",
                kwargs={
                    "workspace_id": self.workspace.id,
                },
            ),
            {
                "type": DirectConversation.Type.GROUP,
                "participant_ids": [
                    self.member.id,
                    self.second_member.id,
                ],
                "name": "Backend team",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertEqual(
            response.data["name"],
            "Backend team",
        )

        self.assertEqual(
            len(response.data["participants"]),
            3,
        )

    def test_non_workspace_user_cannot_be_added_to_conversation(
        self,
    ):
        response = self.client.post(
            reverse(
                "direct-conversation-list-create",
                kwargs={
                    "workspace_id": self.workspace.id,
                },
            ),
            {
                "type": DirectConversation.Type.DIRECT,
                "participant_ids": [
                    self.outsider.id,
                ],
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_user_only_lists_conversations_they_participate_in(
        self,
    ):
        conversation = DirectConversation.objects.create(
            workspace=self.workspace,
            type=DirectConversation.Type.GROUP,
            name="Private group",
            created_by=self.member,
        )

        DirectConversationParticipant.objects.create(
            conversation=conversation,
            user=self.member,
        )

        DirectConversationParticipant.objects.create(
            conversation=conversation,
            user=self.second_member,
        )

        self.client.force_authenticate(
            user=self.owner,
        )

        response = self.client.get(
            reverse(
                "direct-conversation-list-create",
                kwargs={
                    "workspace_id": self.workspace.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        conversation_ids = {item["id"] for item in response.data}

        self.assertNotIn(
            conversation.id,
            conversation_ids,
        )

    def test_non_participant_cannot_open_conversation(
        self,
    ):
        conversation = DirectConversation.objects.create(
            workspace=self.workspace,
            type=DirectConversation.Type.GROUP,
            name="Members only",
            created_by=self.member,
        )

        DirectConversationParticipant.objects.create(
            conversation=conversation,
            user=self.member,
        )

        DirectConversationParticipant.objects.create(
            conversation=conversation,
            user=self.second_member,
        )

        response = self.client.get(
            reverse(
                "direct-conversation-detail",
                kwargs={
                    "pk": conversation.id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_participant_can_list_direct_messages(
        self,
    ):
        conversation = DirectConversation.objects.create(
            workspace=self.workspace,
            type=DirectConversation.Type.DIRECT,
            direct_key=(
                f"{min(self.owner.id, self.member.id)}:"
                f"{max(self.owner.id, self.member.id)}"
            ),
            created_by=self.owner,
        )

        DirectConversationParticipant.objects.create(
            conversation=conversation,
            user=self.owner,
        )

        DirectConversationParticipant.objects.create(
            conversation=conversation,
            user=self.member,
        )

        DirectMessage.objects.create(
            conversation=conversation,
            author=self.owner,
            text="Hello member",
        )

        response = self.client.get(
            reverse(
                "direct-message-list",
                kwargs={
                    "conversation_id": conversation.id,
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

        self.assertEqual(
            response.data["results"][0]["text"],
            "Hello member",
        )
