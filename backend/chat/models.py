from django.conf import settings
from django.db import models
from django.db.models import Q
from workspaces.models import Workspace


class Channel(models.Model):
    class Type(models.TextChoices):
        PUBLIC = "PUBLIC", "Public"
        PRIVATE = "PRIVATE", "Private"

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="channels",
    )

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    type = models.CharField(
        max_length=20,
        choices=Type.choices,
        default=Type.PUBLIC,
    )

    is_general = models.BooleanField(default=False)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_channels",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "name"],
                name="unique_channel_name_per_workspace",
            )
        ]

    def __str__(self):
        return f"{self.workspace.name} / #{self.name}"


class ChannelMembership(models.Model):
    channel = models.ForeignKey(
        Channel,
        on_delete=models.CASCADE,
        related_name="memberships",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="channel_memberships",
    )

    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["channel", "user"],
                name="unique_channel_membership",
            )
        ]

    def __str__(self):
        return f"{self.user} - #{self.channel.name}"


class Message(models.Model):
    channel = models.ForeignKey(
        Channel,
        on_delete=models.CASCADE,
        related_name="messages",
    )

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="messages",
    )

    reply_to = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replies",
    )

    text = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    edited_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    is_deleted = models.BooleanField(
        default=False,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["channel", "-created_at"],
                name="msg_channel_created_idx",
            )
        ]

    def __str__(self):
        return f"{self.author} in #{self.channel.name}: {self.text[:30]}"


class MessageReaction(models.Model):
    class Emoji(models.TextChoices):
        THUMBS_UP = "👍", "Thumbs up"
        HEART = "❤️", "Heart"
        LAUGH = "😂", "Laugh"
        PARTY = "🎉", "Party"
        FIRE = "🔥", "Fire"

    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="reactions",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="message_reactions",
    )

    emoji = models.CharField(
        max_length=8,
        choices=Emoji.choices,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "message",
                    "user",
                    "emoji",
                ],
                name="unique_message_user_emoji_reaction",
            ),
        ]

        indexes = [
            models.Index(
                fields=[
                    "message",
                    "emoji",
                ],
                name="reaction_message_emoji_idx",
            ),
        ]

    def __str__(self):
        return f"{self.user} reacted {self.emoji} to message {self.message_id}"


class DirectConversation(models.Model):
    class Type(models.TextChoices):
        DIRECT = "DIRECT", "Direct"
        GROUP = "GROUP", "Group"

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="direct_conversations",
    )

    type = models.CharField(
        max_length=10,
        choices=Type.choices,
    )

    name = models.CharField(
        max_length=100,
        blank=True,
    )

    direct_key = models.CharField(
        max_length=64,
        null=True,
        blank=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_direct_conversations",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "workspace",
                    "direct_key",
                ],
                condition=Q(
                    direct_key__isnull=False,
                ),
                name="unique_direct_conversation_pair",
            ),
            models.CheckConstraint(
                condition=(
                    Q(
                        type="DIRECT",
                        direct_key__isnull=False,
                    )
                    | Q(
                        type="GROUP",
                        direct_key__isnull=True,
                    )
                ),
                name="direct_conversation_key_matches_type",
            ),
        ]

        indexes = [
            models.Index(
                fields=[
                    "workspace",
                    "-updated_at",
                ],
                name="dm_workspace_updated_idx",
            ),
        ]

    def __str__(self):
        if self.type == self.Type.GROUP:
            return self.name or f"Group conversation {self.pk}"

        return f"Direct conversation {self.pk}"


class DirectConversationParticipant(
    models.Model,
):
    conversation = models.ForeignKey(
        DirectConversation,
        on_delete=models.CASCADE,
        related_name="participants",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="direct_conversation_participations",
    )

    joined_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "conversation",
                    "user",
                ],
                name="unique_direct_conversation_participant",
            ),
        ]

        indexes = [
            models.Index(
                fields=[
                    "user",
                    "conversation",
                ],
                name="dm_part_user_conv_idx",
            ),
        ]

    def __str__(self):
        return f"{self.user} in conversation {self.conversation_id}"


class DirectMessage(models.Model):
    conversation = models.ForeignKey(
        DirectConversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="direct_messages",
    )

    reply_to = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replies",
    )

    text = models.TextField()

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    edited_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    is_deleted = models.BooleanField(
        default=False,
    )

    class Meta:
        ordering = [
            "-created_at",
        ]

        indexes = [
            models.Index(
                fields=[
                    "conversation",
                    "-created_at",
                ],
                name="dm_message_conv_created_idx",
            ),
        ]

    def __str__(self):
        return f"{self.author} in DM {self.conversation_id}: {self.text[:30]}"
