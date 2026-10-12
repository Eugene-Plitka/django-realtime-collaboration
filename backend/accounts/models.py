from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Status(models.TextChoices):
        ONLINE = (
            "ONLINE",
            "Online",
        )
        AWAY = (
            "AWAY",
            "Away",
        )
        DND = (
            "DND",
            "Do Not Disturb",
        )

    email = models.EmailField(
        unique=True,
    )

    avatar = models.ImageField(
        upload_to="avatars/",
        null=True,
        blank=True,
    )

    social_avatar = models.ImageField(
        upload_to="social_avatars/",
        null=True,
        blank=True,
    )

    social_avatar_provider = models.CharField(
        max_length=20,
        blank=True,
    )

    interface_scale_level = models.PositiveSmallIntegerField(
        default=3,
        choices=[
            (0, "80%"),
            (1, "87%"),
            (2, "94%"),
            (3, "100%"),
            (4, "107%"),
            (5, "113%"),
            (6, "120%"),
        ],
    )

    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.ONLINE,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]
