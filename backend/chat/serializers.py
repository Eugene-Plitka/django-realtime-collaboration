from rest_framework import serializers

from .models import Channel, ChannelMembership


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
