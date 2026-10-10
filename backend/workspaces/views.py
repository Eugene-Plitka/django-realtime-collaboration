from accounts.models import User
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    Workspace,
    WorkspaceInvitation,
    WorkspaceMembership,
)
from .permissions import (
    can_add_member_with_role,
    can_cancel_invitation,
    can_change_role,
    can_invite_with_role,
    can_manage_invitations,
    can_remove_member,
    get_workspace_membership,
)
from .serializers import (
    AddWorkspaceMemberSerializer,
    TransferOwnershipSerializer,
    WorkspaceInvitationCreateSerializer,
    WorkspaceInvitationSerializer,
    WorkspaceMembershipRoleSerializer,
    WorkspaceMembershipSerializer,
    WorkspaceSerializer,
)
from .services import (
    accept_workspace_invitation,
    add_workspace_member,
    cancel_workspace_invitation,
    create_workspace,
    create_workspace_invitation,
    leave_workspace,
    remove_workspace_member,
    transfer_workspace_ownership,
)


class WorkspaceListCreateView(generics.ListCreateAPIView):
    serializer_class = WorkspaceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Workspace.objects.filter(
            memberships__user=self.request.user,
        ).distinct()

    def perform_create(self, serializer):
        workspace = create_workspace(
            name=serializer.validated_data["name"],
            slug=serializer.validated_data["slug"],
            user=self.request.user,
        )

        serializer.instance = workspace


class WorkspaceDetailView(generics.RetrieveAPIView):
    serializer_class = WorkspaceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Workspace.objects.filter(
            memberships__user=self.request.user,
        ).distinct()


class WorkspaceMemberListView(generics.ListAPIView):
    serializer_class = WorkspaceMembershipSerializer
    permission_classes = [IsAuthenticated]

    def get_workspace(self):
        try:
            return Workspace.objects.get(
                pk=self.kwargs["workspace_id"],
                memberships__user=self.request.user,
            )
        except Workspace.DoesNotExist:
            raise NotFound()

    def get_queryset(self):
        workspace = self.get_workspace()

        return (
            WorkspaceMembership.objects.filter(workspace=workspace)
            .select_related("user")
            .order_by("joined_at")
        )


class WorkspaceMemberRoleUpdateView(generics.UpdateAPIView):
    serializer_class = WorkspaceMembershipRoleSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["patch"]

    def get_object(self):
        try:
            target_membership = WorkspaceMembership.objects.select_related(
                "workspace", "user"
            ).get(
                pk=self.kwargs["membership_id"],
                workspace_id=self.kwargs["workspace_id"],
            )
        except WorkspaceMembership.DoesNotExist:
            raise NotFound()

        actor_membership = get_workspace_membership(
            workspace=target_membership.workspace,
            user=self.request.user,
        )

        if actor_membership is None:
            raise NotFound()

        new_role = self.request.data.get("role")

        if not can_change_role(
            actor_membership=actor_membership,
            target_membership=target_membership,
            new_role=new_role,
        ):
            raise PermissionDenied("You cannot change this member's role.")

        return target_membership


class WorkspaceMemberRemoveView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_object(self):
        try:
            target_membership = WorkspaceMembership.objects.select_related(
                "workspace", "user"
            ).get(
                pk=self.kwargs["membership_id"],
                workspace_id=self.kwargs["workspace_id"],
            )
        except WorkspaceMembership.DoesNotExist:
            raise NotFound()

        actor_membership = get_workspace_membership(
            workspace=target_membership.workspace,
            user=self.request.user,
        )

        if actor_membership is None:
            raise NotFound()

        if not can_remove_member(
            actor_membership=actor_membership,
            target_membership=target_membership,
        ):
            raise PermissionDenied("You cannot remove this member.")

        return target_membership

    def perform_destroy(self, instance):
        remove_workspace_member(
            membership=instance,
        )


class WorkspaceTransferOwnershipView(generics.GenericAPIView):
    serializer_class = TransferOwnershipSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, workspace_id):
        try:
            workspace = Workspace.objects.get(pk=workspace_id)
        except Workspace.DoesNotExist:
            raise NotFound()

        actor_membership = get_workspace_membership(
            workspace=workspace,
            user=request.user,
        )

        if actor_membership is None:
            raise NotFound()

        if actor_membership.role != WorkspaceMembership.Role.OWNER:
            raise PermissionDenied("Only the workspace owner can transfer ownership.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            new_owner_membership = WorkspaceMembership.objects.get(
                pk=serializer.validated_data["membership_id"],
                workspace=workspace,
            )
        except WorkspaceMembership.DoesNotExist:
            raise NotFound()

        if new_owner_membership.user == request.user:
            raise PermissionDenied("You are already the workspace owner.")

        transfer_workspace_ownership(
            workspace=workspace,
            current_owner=request.user,
            new_owner_membership=new_owner_membership,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkspaceLeaveView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, workspace_id):
        try:
            membership = WorkspaceMembership.objects.select_related(
                "workspace",
                "user",
            ).get(
                workspace_id=workspace_id,
                user=request.user,
            )
        except WorkspaceMembership.DoesNotExist:
            raise NotFound()

        if membership.role == WorkspaceMembership.Role.OWNER:
            raise PermissionDenied(
                "Workspace owner must transfer ownership before leaving."
            )

        leave_workspace(
            membership=membership,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkspaceMemberAddView(generics.GenericAPIView):
    serializer_class = AddWorkspaceMemberSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, workspace_id):
        try:
            workspace = Workspace.objects.get(pk=workspace_id)
        except Workspace.DoesNotExist:
            raise NotFound()

        actor_membership = get_workspace_membership(
            workspace=workspace,
            user=request.user,
        )

        if actor_membership is None:
            raise NotFound()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        role = serializer.validated_data["role"]

        if not can_add_member_with_role(
            actor_membership=actor_membership,
            role=role,
        ):
            raise PermissionDenied("You cannot add a member with this role.")

        try:
            user = User.objects.get(pk=serializer.validated_data["user_id"])
        except User.DoesNotExist:
            raise NotFound("User not found.")

        if WorkspaceMembership.objects.filter(
            workspace=workspace,
            user=user,
        ).exists():
            return Response(
                {"detail": "User is already a workspace member."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = add_workspace_member(
            workspace=workspace,
            user=user,
            role=role,
        )

        response_serializer = WorkspaceMembershipSerializer(membership)

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )


class WorkspaceInvitationCreateView(generics.GenericAPIView):
    serializer_class = WorkspaceInvitationCreateSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, workspace_id):
        try:
            workspace = Workspace.objects.get(pk=workspace_id)
        except Workspace.DoesNotExist:
            raise NotFound()

        actor_membership = get_workspace_membership(
            workspace=workspace,
            user=request.user,
        )

        if actor_membership is None:
            raise NotFound()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        role = serializer.validated_data["role"]

        if not can_invite_with_role(
            actor_membership=actor_membership,
            role=role,
        ):
            raise PermissionDenied("You cannot invite a user with this role.")

        try:
            invitation = create_workspace_invitation(
                workspace=workspace,
                email=serializer.validated_data["email"],
                invited_by=request.user,
                role=role,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "id": invitation.id,
                "email": invitation.email,
                "role": invitation.role,
                "status": invitation.status,
                "token": str(invitation.token),
                "expires_at": invitation.expires_at,
            },
            status=status.HTTP_201_CREATED,
        )


class WorkspaceInvitationAcceptView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, token):
        try:
            membership = accept_workspace_invitation(
                token=token,
                user=request.user,
            )
        except WorkspaceInvitation.DoesNotExist:
            raise NotFound("Invitation not found.")
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = WorkspaceMembershipSerializer(membership)

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )


class MyWorkspaceInvitationListView(generics.ListAPIView):
    serializer_class = WorkspaceInvitationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            WorkspaceInvitation.objects.filter(
                email__iexact=self.request.user.email,
                status=WorkspaceInvitation.Status.PENDING,
                expires_at__gt=timezone.now(),
            )
            .select_related(
                "workspace",
                "invited_by",
            )
            .order_by("-created_at")
        )


class WorkspaceInvitationCancelView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, workspace_id, invitation_id):
        try:
            invitation = WorkspaceInvitation.objects.select_related("workspace").get(
                pk=invitation_id,
                workspace_id=workspace_id,
            )
        except WorkspaceInvitation.DoesNotExist:
            raise NotFound()

        actor_membership = get_workspace_membership(
            workspace=invitation.workspace,
            user=request.user,
        )

        if actor_membership is None:
            raise NotFound()

        if not can_cancel_invitation(
            actor_membership=actor_membership,
        ):
            raise PermissionDenied("You cannot cancel invitations.")

        try:
            cancel_workspace_invitation(
                invitation=invitation,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )


class WorkspaceInvitationListCreateView(generics.ListCreateAPIView):
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

        if not can_manage_invitations(
            actor_membership=membership,
        ):
            raise PermissionDenied("You cannot manage workspace invitations.")

        return workspace

    def get_serializer_class(self):
        if self.request.method == "POST":
            return WorkspaceInvitationCreateSerializer

        return WorkspaceInvitationSerializer

    def get_queryset(self):
        workspace = self.get_workspace()

        return (
            WorkspaceInvitation.objects.filter(workspace=workspace)
            .select_related("invited_by")
            .order_by("-created_at")
        )

    def create(self, request, *args, **kwargs):
        workspace = self.get_workspace()

        actor_membership = get_workspace_membership(
            workspace=workspace,
            user=request.user,
        )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        role = serializer.validated_data["role"]

        if not can_invite_with_role(
            actor_membership=actor_membership,
            role=role,
        ):
            raise PermissionDenied("You cannot invite a user with this role.")

        try:
            invitation = create_workspace_invitation(
                workspace=workspace,
                email=serializer.validated_data["email"],
                invited_by=request.user,
                role=role,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        response_serializer = WorkspaceInvitationSerializer(invitation)

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )
