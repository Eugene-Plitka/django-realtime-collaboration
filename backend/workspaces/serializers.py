from rest_framework import serializers

from .models import (
    Workspace,
    WorkspaceInvitation,
    WorkspaceMembership,
)


class WorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workspace
        fields = (
            "id",
            "name",
            "slug",
            "created_by",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "created_by",
            "created_at",
            "updated_at",
        )


class WorkspaceMembershipSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = WorkspaceMembership
        fields = (
            "id",
            "user_id",
            "username",
            "email",
            "role",
            "joined_at",
        )


class WorkspaceMembershipRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspaceMembership
        fields = ("role",)

    def validate_role(self, value):
        if value == WorkspaceMembership.Role.OWNER:
            raise serializers.ValidationError(
                "Owner role can only be assigned through ownership transfer."
            )

        return value


class TransferOwnershipSerializer(serializers.Serializer):
    membership_id = serializers.IntegerField()


class AddWorkspaceMemberSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()

    role = serializers.ChoiceField(
        choices=(
            WorkspaceMembership.Role.ADMIN,
            WorkspaceMembership.Role.MEMBER,
            WorkspaceMembership.Role.GUEST,
        )
    )


class WorkspaceInvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()

    role = serializers.ChoiceField(
        choices=(
            WorkspaceMembership.Role.ADMIN,
            WorkspaceMembership.Role.MEMBER,
            WorkspaceMembership.Role.GUEST,
        )
    )


class WorkspaceInvitationSerializer(serializers.ModelSerializer):
    workspace_name = serializers.CharField(
        source="workspace.name",
        read_only=True,
    )

    invited_by_username = serializers.CharField(
        source="invited_by.username",
        read_only=True,
    )

    class Meta:
        model = WorkspaceInvitation
        fields = (
            "id",
            "workspace",
            "workspace_name",
            "email",
            "role",
            "status",
            "token",
            "invited_by",
            "invited_by_username",
            "created_at",
            "expires_at",
            "accepted_at",
        )

        read_only_fields = fields
