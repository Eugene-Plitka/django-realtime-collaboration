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


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
        )


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
