from django.conf import settings
from django.db import models
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
