from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Type(models.TextChoices):
        MENTION = "mention", "Mention"
        CHANNEL_ADDED = "channel_added", "Added to channel"
        WORKSPACE_INVITATION = "workspace_invitation", "Workspace invitation"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    type = models.CharField(
        max_length=50,
        choices=Type.choices,
    )

    payload = models.JSONField(
        default=dict,
        blank=True,
    )

    is_read = models.BooleanField(
        default=False,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["user", "is_read", "-created_at"],
                name="notif_user_read_idx",
            )
        ]

    def __str__(self):
        return f"{self.user} - {self.type}"
