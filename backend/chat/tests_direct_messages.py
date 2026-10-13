from accounts.models import User
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from config.asgi import application
from django.test import TransactionTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
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

    def test_new_direct_message_increments_unread_count_for_other_participant(
        self,
    ):
        conversation = DirectConversation.objects.create(
            type=DirectConversation.Type.DIRECT,
            direct_key=(
                f"{min(self.owner.id, self.member.id)}:"
                f"{max(self.owner.id, self.member.id)}"
            ),
            created_by=self.owner,
        )

        owner_participant = DirectConversationParticipant.objects.create(
            conversation=conversation,
            user=self.owner,
        )

        member_participant = DirectConversationParticipant.objects.create(
            conversation=conversation,
            user=self.member,
        )

        from .services import (
            create_direct_message,
        )

        create_direct_message(
            conversation=conversation,
            author=self.owner,
            text="Unread message",
        )

        owner_participant.refresh_from_db()
        member_participant.refresh_from_db()

        self.assertEqual(
            owner_participant.unread_count,
            0,
        )

        self.assertEqual(
            member_participant.unread_count,
            1,
        )

    def test_mark_direct_conversation_read_resets_unread_count(
        self,
    ):
        conversation = DirectConversation.objects.create(
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

        member_participant = DirectConversationParticipant.objects.create(
            conversation=conversation,
            user=self.member,
            unread_count=3,
        )

        self.client.force_authenticate(
            user=self.member,
        )

        response = self.client.post(
            reverse(
                "direct-conversation-mark-read",
                kwargs={
                    "conversation_id": conversation.id,
                },
            ),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        member_participant.refresh_from_db()

        self.assertEqual(
            member_participant.unread_count,
            0,
        )

        self.assertEqual(
            response.data["unread_count"],
            0,
        )


@database_sync_to_async
def create_direct_test_message(
    *,
    conversation,
    author,
    text,
    reply_to=None,
):
    return DirectMessage.objects.create(
        conversation=conversation,
        author=author,
        reply_to=reply_to,
        text=text,
    )


@database_sync_to_async
def get_direct_message_state(
    message_id,
):
    message = DirectMessage.objects.get(
        pk=message_id,
    )

    return {
        "text": message.text,
        "edited_at": message.edited_at,
        "is_deleted": message.is_deleted,
    }


@database_sync_to_async
def direct_message_count():
    return DirectMessage.objects.count()


class DirectConversationWebSocketTests(
    TransactionTestCase,
):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="dm-ws-owner@example.com",
            username="dm-ws-owner",
            password="StrongPassword123!",
        )

        self.member = User.objects.create_user(
            email="dm-ws-member@example.com",
            username="dm-ws-member",
            password="StrongPassword123!",
        )

        self.second_member = User.objects.create_user(
            email="dm-ws-second@example.com",
            username="dm-ws-second",
            password="StrongPassword123!",
        )

        self.outsider = User.objects.create_user(
            email="dm-ws-outsider@example.com",
            username="dm-ws-outsider",
            password="StrongPassword123!",
        )

        self.workspace = create_workspace(
            name="DM WebSocket Workspace",
            slug="dm-websocket-workspace",
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

        add_workspace_member(
            workspace=self.workspace,
            user=self.outsider,
            role=WorkspaceMembership.Role.MEMBER,
        )

        self.conversation = DirectConversation.objects.create(
            type=DirectConversation.Type.GROUP,
            name="WebSocket DM group",
            created_by=self.owner,
        )

        DirectConversationParticipant.objects.create(
            conversation=self.conversation,
            user=self.owner,
        )

        DirectConversationParticipant.objects.create(
            conversation=self.conversation,
            user=self.member,
        )

        DirectConversationParticipant.objects.create(
            conversation=self.conversation,
            user=self.second_member,
        )

        self.owner_token = str(
            RefreshToken.for_user(
                self.owner,
            ).access_token
        )

        self.member_token = str(
            RefreshToken.for_user(
                self.member,
            ).access_token
        )

        self.second_member_token = str(
            RefreshToken.for_user(
                self.second_member,
            ).access_token
        )

        self.outsider_token = str(
            RefreshToken.for_user(
                self.outsider,
            ).access_token
        )

    async def test_participant_can_connect_with_valid_jwt(
        self,
    ):
        communicator = WebsocketCommunicator(
            application,
            (f"/ws/direct-conversations/{self.conversation.id}/"),
            subprotocols=[
                f"jwt.{self.member_token}",
            ],
        )

        connected, subprotocol = await communicator.connect()

        self.assertTrue(
            connected,
        )

        self.assertEqual(
            subprotocol,
            f"jwt.{self.member_token}",
        )

        await communicator.disconnect()

    async def test_non_participant_cannot_connect(
        self,
    ):
        communicator = WebsocketCommunicator(
            application,
            (f"/ws/direct-conversations/{self.conversation.id}/"),
            subprotocols=[
                f"jwt.{self.outsider_token}",
            ],
        )

        connected, _ = await communicator.connect()

        self.assertFalse(
            connected,
        )

    async def test_participant_can_create_direct_message(
        self,
    ):
        communicator = WebsocketCommunicator(
            application,
            (f"/ws/direct-conversations/{self.conversation.id}/"),
            subprotocols=[
                f"jwt.{self.member_token}",
            ],
        )

        connected, _ = await communicator.connect()

        self.assertTrue(
            connected,
        )

        await communicator.send_json_to(
            {
                "type": "direct_message.create",
                "data": {
                    "text": "Hello direct chat",
                },
            }
        )

        response = await communicator.receive_json_from()

        self.assertEqual(
            response["type"],
            "direct_message.created",
        )

        self.assertEqual(
            response["data"]["text"],
            "Hello direct chat",
        )

        self.assertEqual(
            response["data"]["author_id"],
            self.member.id,
        )

        self.assertEqual(
            await direct_message_count(),
            1,
        )

        await communicator.disconnect()

    async def test_direct_message_is_broadcast_to_other_participants(
        self,
    ):
        sender = WebsocketCommunicator(
            application,
            (f"/ws/direct-conversations/{self.conversation.id}/"),
            subprotocols=[
                f"jwt.{self.member_token}",
            ],
        )

        receiver = WebsocketCommunicator(
            application,
            (f"/ws/direct-conversations/{self.conversation.id}/"),
            subprotocols=[
                f"jwt.{self.second_member_token}",
            ],
        )

        sender_connected, _ = await sender.connect()

        receiver_connected, _ = await receiver.connect()

        self.assertTrue(
            sender_connected,
        )

        self.assertTrue(
            receiver_connected,
        )

        await sender.send_json_to(
            {
                "type": "direct_message.create",
                "data": {
                    "text": "Realtime DM",
                },
            }
        )

        sender_response = await sender.receive_json_from()

        receiver_response = await receiver.receive_json_from()

        self.assertEqual(
            sender_response["type"],
            "direct_message.created",
        )

        self.assertEqual(
            receiver_response["type"],
            "direct_message.created",
        )

        self.assertEqual(
            sender_response["data"]["id"],
            receiver_response["data"]["id"],
        )

        self.assertEqual(
            receiver_response["data"]["text"],
            "Realtime DM",
        )

        await sender.disconnect()
        await receiver.disconnect()

    async def test_participant_can_reply_to_direct_message(
        self,
    ):
        root_message = await create_direct_test_message(
            conversation=self.conversation,
            author=self.owner,
            text="Root direct message",
        )

        communicator = WebsocketCommunicator(
            application,
            (f"/ws/direct-conversations/{self.conversation.id}/"),
            subprotocols=[
                f"jwt.{self.member_token}",
            ],
        )

        connected, _ = await communicator.connect()

        self.assertTrue(
            connected,
        )

        await communicator.send_json_to(
            {
                "type": "direct_message.create",
                "data": {
                    "text": "Direct reply",
                    "reply_to_id": root_message.id,
                },
            }
        )

        response = await communicator.receive_json_from()

        self.assertEqual(
            response["type"],
            "direct_message.created",
        )

        self.assertEqual(
            response["data"]["reply_to"],
            root_message.id,
        )

        self.assertEqual(
            response["data"]["reply_to_message"]["text"],
            "Root direct message",
        )

        self.assertEqual(
            response["data"]["reply_to_message"]["author_id"],
            self.owner.id,
        )

        await communicator.disconnect()

    async def test_author_can_edit_own_direct_message(
        self,
    ):
        message = await create_direct_test_message(
            conversation=self.conversation,
            author=self.member,
            text="Before edit",
        )

        communicator = WebsocketCommunicator(
            application,
            (f"/ws/direct-conversations/{self.conversation.id}/"),
            subprotocols=[
                f"jwt.{self.member_token}",
            ],
        )

        connected, _ = await communicator.connect()

        self.assertTrue(
            connected,
        )

        await communicator.send_json_to(
            {
                "type": "direct_message.update",
                "data": {
                    "message_id": message.id,
                    "text": "After edit",
                },
            }
        )

        response = await communicator.receive_json_from()

        self.assertEqual(
            response["type"],
            "direct_message.updated",
        )

        self.assertEqual(
            response["data"]["text"],
            "After edit",
        )

        state = await get_direct_message_state(
            message.id,
        )

        self.assertEqual(
            state["text"],
            "After edit",
        )

        self.assertIsNotNone(
            state["edited_at"],
        )

        await communicator.disconnect()

    async def test_participant_cannot_edit_another_users_direct_message(
        self,
    ):
        message = await create_direct_test_message(
            conversation=self.conversation,
            author=self.owner,
            text="Owner message",
        )

        communicator = WebsocketCommunicator(
            application,
            (f"/ws/direct-conversations/{self.conversation.id}/"),
            subprotocols=[
                f"jwt.{self.member_token}",
            ],
        )

        connected, _ = await communicator.connect()

        self.assertTrue(
            connected,
        )

        await communicator.send_json_to(
            {
                "type": "direct_message.update",
                "data": {
                    "message_id": message.id,
                    "text": "Hacked text",
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
            "direct_message_edit_forbidden",
        )

        state = await get_direct_message_state(
            message.id,
        )

        self.assertEqual(
            state["text"],
            "Owner message",
        )

        await communicator.disconnect()

    async def test_author_can_delete_own_direct_message(
        self,
    ):
        message = await create_direct_test_message(
            conversation=self.conversation,
            author=self.member,
            text="Delete me",
        )

        communicator = WebsocketCommunicator(
            application,
            (f"/ws/direct-conversations/{self.conversation.id}/"),
            subprotocols=[
                f"jwt.{self.member_token}",
            ],
        )

        connected, _ = await communicator.connect()

        self.assertTrue(
            connected,
        )

        await communicator.send_json_to(
            {
                "type": "direct_message.delete",
                "data": {
                    "message_id": message.id,
                },
            }
        )

        response = await communicator.receive_json_from()

        self.assertEqual(
            response["type"],
            "direct_message.deleted",
        )

        self.assertIsNone(
            response["data"]["text"],
        )

        state = await get_direct_message_state(
            message.id,
        )

        self.assertTrue(
            state["is_deleted"],
        )

        await communicator.disconnect()

    async def test_typing_is_broadcast_to_other_participant(
        self,
    ):
        sender = WebsocketCommunicator(
            application,
            (f"/ws/direct-conversations/{self.conversation.id}/"),
            subprotocols=[
                f"jwt.{self.member_token}",
            ],
        )

        receiver = WebsocketCommunicator(
            application,
            (f"/ws/direct-conversations/{self.conversation.id}/"),
            subprotocols=[
                f"jwt.{self.second_member_token}",
            ],
        )

        sender_connected, _ = await sender.connect()

        receiver_connected, _ = await receiver.connect()

        self.assertTrue(
            sender_connected,
        )

        self.assertTrue(
            receiver_connected,
        )

        before_count = await direct_message_count()

        await sender.send_json_to(
            {
                "type": "typing.start",
                "data": {},
            }
        )

        response = await receiver.receive_json_from()

        self.assertEqual(
            response["type"],
            "typing.started",
        )

        self.assertEqual(
            response["data"]["user_id"],
            self.member.id,
        )

        self.assertEqual(
            response["data"]["username"],
            self.member.username,
        )

        after_count = await direct_message_count()

        self.assertEqual(
            before_count,
            after_count,
        )

        await sender.disconnect()
        await receiver.disconnect()
