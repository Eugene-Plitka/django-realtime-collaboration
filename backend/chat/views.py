from accounts.models import User
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from workspaces.models import Workspace, WorkspaceMembership
from workspaces.permissions import get_workspace_membership

from .models import (
    Channel,
    ChannelMembership,
    Message,
)
from .pagination import MessageCursorPagination
from .permissions import (
    can_access_channel,
    can_access_channel_messages,
    can_delete_message,
    can_edit_message,
    can_manage_channel_members,
    can_manage_channels,
    can_self_join_channel,
    can_view_public_channels,
)
from .serializers import (
    ChannelCreateSerializer,
    ChannelMemberAddSerializer,
    ChannelMembershipSerializer,
    ChannelSerializer,
    MessageSerializer,
)
from .services import (
    add_channel_member,
    create_channel,
    delete_channel,
    delete_message,
    edit_message,
    join_channel,
    leave_channel,
    remove_channel_member,
)


class ChannelListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_workspace(self):
        try:
            workspace = Workspace.objects.get(pk=self.kwargs["workspace_id"])
        except Workspace.DoesNotExist:
            raise NotFound()

        membership = get_workspace_membership(
            workspace=workspace,
            user=self.request.user,
        )

        if membership is None:
            raise NotFound()

        return workspace, membership

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ChannelCreateSerializer

        return ChannelSerializer

    def get_queryset(self):
        workspace, membership = self.get_workspace()

        if can_view_public_channels(
            membership=membership,
        ):
            return (
                Channel.objects.filter(workspace=workspace)
                .filter(
                    Q(type=Channel.Type.PUBLIC) | Q(memberships__user=self.request.user)
                )
                .distinct()
                .order_by("name")
            )

        return (
            Channel.objects.filter(
                workspace=workspace,
                memberships__user=self.request.user,
            )
            .distinct()
            .order_by("name")
        )

    def create(self, request, *args, **kwargs):
        workspace, membership = self.get_workspace()

        if not can_manage_channels(
            membership=membership,
        ):
            raise PermissionDenied("You cannot create channels.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        channel = create_channel(
            workspace=workspace,
            created_by=request.user,
            name=serializer.validated_data["name"],
            description=serializer.validated_data.get(
                "description",
                "",
            ),
            channel_type=serializer.validated_data.get(
                "type",
                Channel.Type.PUBLIC,
            ),
        )

        response_serializer = ChannelSerializer(channel)

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )


class ChannelDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ChannelSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = [
        "get",
        "patch",
        "delete",
    ]

    def get_channel(self):
        try:
            channel = Channel.objects.select_related("workspace").get(
                pk=self.kwargs["pk"]
            )
        except Channel.DoesNotExist:
            raise NotFound()

        membership = get_workspace_membership(
            workspace=channel.workspace,
            user=self.request.user,
        )

        if membership is None:
            raise NotFound()

        return channel, membership

    def get_object(self):
        channel, membership = self.get_channel()

        if channel.type == Channel.Type.PRIVATE:
            has_channel_membership = channel.memberships.filter(
                user=self.request.user
            ).exists()

            if not has_channel_membership and not can_manage_channels(
                membership=membership
            ):
                raise NotFound()

        elif not can_view_public_channels(
            membership=membership,
        ):
            has_channel_membership = channel.memberships.filter(
                user=self.request.user
            ).exists()

            if not has_channel_membership:
                raise NotFound()

        return channel

    def perform_update(self, serializer):
        channel, membership = self.get_channel()

        if not can_manage_channels(
            membership=membership,
        ):
            raise PermissionDenied("You cannot edit channels.")

        serializer.save(
            workspace=channel.workspace,
            created_by=channel.created_by,
            is_general=channel.is_general,
        )

    def destroy(self, request, *args, **kwargs):
        channel, membership = self.get_channel()

        if not can_manage_channels(
            membership=membership,
        ):
            raise PermissionDenied("You cannot delete channels.")

        try:
            delete_channel(
                channel=channel,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )


class ChannelJoinView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, channel_id):
        try:
            channel = Channel.objects.select_related("workspace").get(pk=channel_id)
        except Channel.DoesNotExist:
            raise NotFound()

        workspace_membership = get_workspace_membership(
            workspace=channel.workspace,
            user=request.user,
        )

        if workspace_membership is None:
            raise NotFound()

        if not can_self_join_channel(
            channel=channel,
            membership=workspace_membership,
        ):
            raise PermissionDenied("You cannot join this channel.")

        try:
            membership = join_channel(
                channel=channel,
                user=request.user,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ChannelMembershipSerializer(membership)

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )


class ChannelLeaveView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, channel_id):
        try:
            channel = Channel.objects.select_related("workspace").get(pk=channel_id)
        except Channel.DoesNotExist:
            raise NotFound()

        if not WorkspaceMembership.objects.filter(
            workspace=channel.workspace,
            user=request.user,
        ).exists():
            raise NotFound()

        try:
            leave_channel(
                channel=channel,
                user=request.user,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )


class ChannelMemberListCreateView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get_channel(self):
        try:
            return Channel.objects.select_related("workspace").get(
                pk=self.kwargs["channel_id"]
            )
        except Channel.DoesNotExist:
            raise NotFound()

    def get(self, request, channel_id):
        channel = self.get_channel()

        workspace_membership = get_workspace_membership(
            workspace=channel.workspace,
            user=request.user,
        )

        if workspace_membership is None:
            raise NotFound()

        if not can_access_channel(
            channel=channel,
            workspace_membership=workspace_membership,
            user=request.user,
        ) and not can_manage_channel_members(
            membership=workspace_membership,
        ):
            raise NotFound()

        memberships = (
            ChannelMembership.objects.filter(channel=channel)
            .select_related("user")
            .order_by("joined_at")
        )

        serializer = ChannelMembershipSerializer(
            memberships,
            many=True,
        )

        return Response(serializer.data)

    def post(self, request, channel_id):
        channel = self.get_channel()

        actor_membership = get_workspace_membership(
            workspace=channel.workspace,
            user=request.user,
        )

        if actor_membership is None:
            raise NotFound()

        if not can_manage_channel_members(
            membership=actor_membership,
        ):
            raise PermissionDenied("You cannot manage channel members.")

        serializer = ChannelMemberAddSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = User.objects.get(pk=serializer.validated_data["user_id"])
        except User.DoesNotExist:
            raise NotFound("User not found.")

        try:
            membership = add_channel_member(
                channel=channel,
                user=user,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        response_serializer = ChannelMembershipSerializer(membership)

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )


class ChannelMemberRemoveView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def delete(
        self,
        request,
        channel_id,
        membership_id,
    ):
        try:
            membership = ChannelMembership.objects.select_related(
                "channel__workspace",
                "user",
            ).get(
                pk=membership_id,
                channel_id=channel_id,
            )
        except ChannelMembership.DoesNotExist:
            raise NotFound()

        actor_membership = get_workspace_membership(
            workspace=membership.channel.workspace,
            user=request.user,
        )

        if actor_membership is None:
            raise NotFound()

        if not can_manage_channel_members(
            membership=actor_membership,
        ):
            raise PermissionDenied("You cannot manage channel members.")

        try:
            remove_channel_member(
                membership=membership,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )


class MessageListView(generics.ListAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = MessageCursorPagination

    def get_queryset(self):
        try:
            channel = Channel.objects.select_related("workspace").get(
                pk=self.kwargs["channel_id"]
            )
        except Channel.DoesNotExist:
            raise NotFound()

        workspace_membership = get_workspace_membership(
            workspace=channel.workspace,
            user=self.request.user,
        )

        if workspace_membership is None:
            raise NotFound()

        if not can_access_channel_messages(
            channel=channel,
            workspace_membership=workspace_membership,
            user=self.request.user,
        ):
            raise NotFound()

        return (
            Message.objects.filter(channel=channel)
            .select_related("author")
            .order_by("-created_at")
        )


class MessageDetailView(generics.GenericAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_message(self):
        try:
            message = Message.objects.select_related(
                "channel__workspace",
                "author",
            ).get(pk=self.kwargs["pk"])
        except Message.DoesNotExist:
            raise NotFound()

        workspace_membership = get_workspace_membership(
            workspace=message.channel.workspace,
            user=self.request.user,
        )

        if workspace_membership is None:
            raise NotFound()

        if not can_access_channel_messages(
            channel=message.channel,
            workspace_membership=workspace_membership,
            user=self.request.user,
        ):
            raise NotFound()

        return message, workspace_membership

    def patch(self, request, pk):
        message, _ = self.get_message()

        if not can_edit_message(
            message=message,
            user=request.user,
        ):
            raise PermissionDenied("You cannot edit this message.")

        text = request.data.get("text")

        if not text:
            return Response(
                {"detail": "Text is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        message = edit_message(
            message=message,
            text=text,
        )

        serializer = self.get_serializer(message)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        message, workspace_membership = self.get_message()

        if not can_delete_message(
            message=message,
            workspace_membership=workspace_membership,
            user=request.user,
        ):
            raise PermissionDenied("You cannot delete this message.")

        delete_message(
            message=message,
        )

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )
