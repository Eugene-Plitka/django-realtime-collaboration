from rest_framework import serializers

from .models import (
    Channel,
    ChannelMembership,
    Message,
)


class ChannelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Channel
        fields = (
            "id",
            "workspace",
            "name",
            "description",
            "type",
            "is_general",
            "created_by",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "workspace",
            "is_general",
            "created_by",
            "created_at",
            "updated_at",
        )


class ChannelCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Channel
        fields = (
            "name",
            "description",
            "type",
        )


class ChannelMembershipSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(
        source="user.id",
        read_only=True,
    )
    username = serializers.CharField(
        source="user.username",
        read_only=True,
    )
    email = serializers.EmailField(
        source="user.email",
        read_only=True,
    )

    class Meta:
        model = ChannelMembership
        fields = (
            "id",
            "user_id",
            "username",
            "email",
            "joined_at",
        )


class ChannelMemberAddSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()


class MessageSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(
        source="author.username",
        read_only=True,
    )

    class Meta:
        model = Message
        fields = (
            "id",
            "channel",
            "author",
            "author_username",
            "text",
            "created_at",
            "updated_at",
            "edited_at",
            "is_deleted",
        )

        read_only_fields = (
            "id",
            "channel",
            "author",
            "author_username",
            "created_at",
            "updated_at",
            "edited_at",
            "is_deleted",
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)

        if instance.is_deleted:
            data["text"] = None

        return data
