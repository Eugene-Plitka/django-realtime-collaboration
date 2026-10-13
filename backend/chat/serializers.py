from drf_spectacular.utils import (
    extend_schema_field,
)
from rest_framework import serializers

from accounts.avatar_utils import (
    get_user_avatar_url,
)
from accounts.models import User

from .models import (
    Channel,
    ChannelMembership,
    DirectConversation,
    DirectConversationParticipant,
    DirectMessage,
    Message,
)


class ChannelSerializer(
    serializers.ModelSerializer,
):
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


class ChannelCreateSerializer(
    serializers.ModelSerializer,
):
    class Meta:
        model = Channel

        fields = (
            "name",
            "description",
            "type",
        )


class ChannelMembershipSerializer(
    serializers.ModelSerializer,
):
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

    status = serializers.CharField(
        source="user.status",
        read_only=True,
    )

    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = ChannelMembership

        fields = (
            "id",
            "user_id",
            "username",
            "email",
            "avatar_url",
            "status",
            "joined_at",
        )

    def get_avatar_url(
        self,
        membership,
    ) -> str | None:
        return get_user_avatar_url(
            membership.user,
            request=self.context.get(
                "request",
            ),
        )


class ChannelMemberAddSerializer(
    serializers.Serializer,
):
    user_id = serializers.IntegerField()


class ReplyToMessageSerializer(
    serializers.Serializer,
):
    id = serializers.IntegerField(
        read_only=True,
    )

    author_id = serializers.IntegerField(
        read_only=True,
    )

    author_username = serializers.CharField(
        read_only=True,
    )

    author_avatar_url = serializers.CharField(
        allow_null=True,
        read_only=True,
    )

    author_status = serializers.CharField(
        read_only=True,
    )

    text = serializers.CharField(
        allow_null=True,
        read_only=True,
    )

    is_deleted = serializers.BooleanField(
        read_only=True,
    )


class MessageReactionSummarySerializer(
    serializers.Serializer,
):
    emoji = serializers.CharField(
        read_only=True,
    )

    count = serializers.IntegerField(
        read_only=True,
    )

    user_reacted = serializers.BooleanField(
        read_only=True,
    )


class MessageSerializer(
    serializers.ModelSerializer,
):
    author_username = serializers.CharField(
        source="author.username",
        read_only=True,
    )

    author_status = serializers.CharField(
        source="author.status",
        read_only=True,
    )

    author_avatar_url = serializers.SerializerMethodField()

    reply_to_message = serializers.SerializerMethodField()

    reactions = serializers.SerializerMethodField()

    class Meta:
        model = Message

        fields = (
            "id",
            "channel",
            "author",
            "author_username",
            "author_avatar_url",
            "author_status",
            "reply_to",
            "reply_to_message",
            "reactions",
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
            "author_avatar_url",
            "author_status",
            "reply_to",
            "reply_to_message",
            "reactions",
            "created_at",
            "updated_at",
            "edited_at",
            "is_deleted",
        )

    def get_author_avatar_url(
        self,
        message,
    ) -> str | None:
        return get_user_avatar_url(
            message.author,
            request=self.context.get(
                "request",
            ),
        )

    @extend_schema_field(ReplyToMessageSerializer)
    def get_reply_to_message(
        self,
        instance,
    ):
        if instance.reply_to_id is None:
            return None

        reply_to = instance.reply_to

        return {
            "id": reply_to.id,
            "author_id": reply_to.author_id,
            "author_username": reply_to.author.username,
            "author_avatar_url": get_user_avatar_url(
                reply_to.author,
                request=self.context.get(
                    "request",
                ),
            ),
            "author_status": reply_to.author.status,
            "text": (None if reply_to.is_deleted else reply_to.text),
            "is_deleted": reply_to.is_deleted,
        }

    @extend_schema_field(
        MessageReactionSummarySerializer(
            many=True,
        )
    )
    def get_reactions(
        self,
        instance,
    ):
        request = self.context.get(
            "request",
        )

        current_user_id = (
            request.user.id
            if request is not None and request.user.is_authenticated
            else None
        )

        reaction_rows = list(instance.reactions.all())

        summaries = []

        for emoji, _label in instance.reactions.model.Emoji.choices:
            matching_reactions = [
                reaction for reaction in reaction_rows if reaction.emoji == emoji
            ]

            if not matching_reactions:
                continue

            summaries.append(
                {
                    "emoji": emoji,
                    "count": len(
                        matching_reactions,
                    ),
                    "user_reacted": any(
                        reaction.user_id == current_user_id
                        for reaction in matching_reactions
                    ),
                }
            )

        return summaries

    def to_representation(
        self,
        instance,
    ):
        data = super().to_representation(
            instance,
        )

        if instance.is_deleted:
            data["text"] = None

        return data


class DirectConversationParticipantSerializer(
    serializers.ModelSerializer,
):
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

    status = serializers.CharField(
        source="user.status",
        read_only=True,
    )

    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = DirectConversationParticipant

        fields = (
            "id",
            "user_id",
            "username",
            "email",
            "status",
            "avatar_url",
            "joined_at",
        )

        read_only_fields = fields

    def get_avatar_url(
        self,
        participant,
    ) -> str | None:
        return get_user_avatar_url(
            participant.user,
            request=self.context.get(
                "request",
            ),
        )


class DirectConversationSerializer(
    serializers.ModelSerializer,
):
    participants = DirectConversationParticipantSerializer(
        many=True,
        read_only=True,
    )

    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = DirectConversation

        fields = (
            "id",
            "type",
            "name",
            "created_by",
            "participants",
            "unread_count",
            "created_at",
            "updated_at",
        )

        read_only_fields = fields

    def get_unread_count(
        self,
        conversation,
    ) -> int:
        request = self.context.get(
            "request",
        )

        if request is None or not request.user.is_authenticated:
            return 0

        current_user_id = request.user.id

        participant = next(
            (
                item
                for item in conversation.participants.all()
                if item.user_id == current_user_id
            ),
            None,
        )

        if participant is None:
            return 0

        return participant.unread_count


class DirectConversationUserSerializer(
    serializers.ModelSerializer,
):
    user_id = serializers.IntegerField(
        source="id",
        read_only=True,
    )

    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User

        fields = (
            "user_id",
            "username",
            "email",
            "status",
            "avatar_url",
        )

        read_only_fields = fields

    def get_avatar_url(
        self,
        user,
    ) -> str | None:
        return get_user_avatar_url(
            user,
            request=self.context.get(
                "request",
            ),
        )


class DirectConversationCreateSerializer(
    serializers.Serializer,
):
    type = serializers.ChoiceField(
        choices=DirectConversation.Type.choices,
    )

    participant_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
    )

    name = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default="",
    )

    def validate_participant_ids(
        self,
        value,
    ):
        unique_ids = list(dict.fromkeys(value))

        if not unique_ids:
            raise serializers.ValidationError("At least one participant is required.")

        return unique_ids


class DirectMessageReplySerializer(
    serializers.Serializer,
):
    id = serializers.IntegerField(
        read_only=True,
    )

    author_id = serializers.IntegerField(
        read_only=True,
    )

    author_username = serializers.CharField(
        read_only=True,
    )

    author_avatar_url = serializers.CharField(
        allow_null=True,
        read_only=True,
    )

    text = serializers.CharField(
        allow_null=True,
        read_only=True,
    )

    is_deleted = serializers.BooleanField(
        read_only=True,
    )


class DirectMessageSerializer(
    serializers.ModelSerializer,
):
    author_username = serializers.CharField(
        source="author.username",
        read_only=True,
    )

    author_status = serializers.CharField(
        source="author.status",
        read_only=True,
    )

    author_avatar_url = serializers.SerializerMethodField()

    reply_to_message = serializers.SerializerMethodField()

    class Meta:
        model = DirectMessage

        fields = (
            "id",
            "conversation",
            "author",
            "author_username",
            "author_status",
            "author_avatar_url",
            "reply_to",
            "reply_to_message",
            "text",
            "created_at",
            "updated_at",
            "edited_at",
            "is_deleted",
        )

        read_only_fields = fields

    def get_author_avatar_url(
        self,
        message,
    ) -> str | None:
        return get_user_avatar_url(
            message.author,
            request=self.context.get(
                "request",
            ),
        )

    @extend_schema_field(DirectMessageReplySerializer)
    def get_reply_to_message(
        self,
        instance,
    ):
        if instance.reply_to_id is None:
            return None

        reply_to = instance.reply_to

        return {
            "id": reply_to.id,
            "author_id": reply_to.author_id,
            "author_username": reply_to.author.username,
            "author_avatar_url": get_user_avatar_url(
                reply_to.author,
                request=self.context.get(
                    "request",
                ),
            ),
            "text": (None if reply_to.is_deleted else reply_to.text),
            "is_deleted": reply_to.is_deleted,
        }

    def to_representation(
        self,
        instance,
    ):
        data = super().to_representation(
            instance,
        )

        if instance.is_deleted:
            data["text"] = None

        return data
