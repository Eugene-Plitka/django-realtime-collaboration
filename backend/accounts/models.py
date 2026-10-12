from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(unique=True)

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

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]
