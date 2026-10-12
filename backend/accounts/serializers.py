from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
    )

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
            "password",
        )

    def create(self, validated_data):
        password = validated_data.pop("password")

        user = User(**validated_data)
        user.set_password(password)
        user.save()

        return user


class UserSerializer(
    serializers.ModelSerializer,
):
    avatar_url = serializers.SerializerMethodField()

    avatar_source = serializers.SerializerMethodField()

    class Meta:
        model = User

        fields = (
            "id",
            "email",
            "username",
            "avatar_url",
            "avatar_source",
        )

        read_only_fields = (
            "id",
            "email",
            "avatar_url",
            "avatar_source",
        )

    def get_avatar_url(
        self,
        user,
    ) -> str | None:
        request = self.context.get(
            "request",
        )

        avatar = None

        if user.avatar:
            avatar = user.avatar
        elif user.social_avatar:
            avatar = user.social_avatar

        if avatar is None:
            return None

        avatar_url = avatar.url

        if request is not None:
            return request.build_absolute_uri(
                avatar_url,
            )

        return avatar_url

    def get_avatar_source(
        self,
        user,
    ) -> str:
        if user.avatar:
            return "custom"

        if user.social_avatar:
            return user.social_avatar_provider or "social"

        return "fallback"


class AvatarUploadSerializer(
    serializers.ModelSerializer,
):
    class Meta:
        model = User
        fields = ("avatar",)

    def validate_avatar(self, avatar):
        max_size = 5 * 1024 * 1024

        if avatar.size > max_size:
            raise serializers.ValidationError("Avatar must be 5 MB or smaller.")

        allowed_content_types = {
            "image/jpeg",
            "image/png",
            "image/webp",
        }

        content_type = getattr(
            avatar,
            "content_type",
            "",
        )

        if content_type not in allowed_content_types:
            raise serializers.ValidationError("Avatar must be JPEG, PNG or WebP.")

        return avatar


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()

    def validate(self, attrs):
        self.token = attrs["refresh"]
        return attrs

    def save(self, **kwargs):
        RefreshToken(self.token).blacklist()


class SocialJWTExchangeResponseSerializer(serializers.Serializer):
    refresh = serializers.CharField(
        read_only=True,
    )
    access = serializers.CharField(
        read_only=True,
    )


class SocialProviderStatusSerializer(serializers.Serializer):
    provider = serializers.CharField(
        read_only=True,
    )
    name = serializers.CharField(
        read_only=True,
    )
    connected = serializers.BooleanField(
        read_only=True,
    )


class SocialConnectionListSerializer(serializers.Serializer):
    password_login_available = serializers.BooleanField(
        read_only=True,
    )
    providers = SocialProviderStatusSerializer(
        many=True,
        read_only=True,
    )


class SocialConnectResponseSerializer(serializers.Serializer):
    redirect_url = serializers.CharField(
        read_only=True,
    )


class SetPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
    )
    password_confirm = serializers.CharField(
        write_only=True,
    )

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": ("Passwords do not match.")}
            )

        user = self.context["request"].user

        validate_password(
            attrs["password"],
            user=user,
        )

        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user

        user.set_password(self.validated_data["password"])

        user.save(
            update_fields=[
                "password",
            ]
        )

        return user
