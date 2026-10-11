from allauth.socialaccount.models import SocialAccount
from django.contrib.auth import (
    login as django_login,
    logout as django_logout,
)
from django.urls import reverse
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import (
    LogoutSerializer,
    RegisterSerializer,
    SetPasswordSerializer,
    SocialConnectionListSerializer,
    SocialConnectResponseSerializer,
    SocialJWTExchangeResponseSerializer,
    UserSerializer,
)

SOCIAL_PROVIDERS = {
    "google": {
        "name": "Google",
        "login_url_name": "google_login",
    },
    "github": {
        "name": "GitHub",
        "login_url_name": "github_login",
    },
}


@extend_schema(
    request=None,
    responses={
        204: None,
    },
)
@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf_cookie_view(request):
    return Response(
        status=status.HTTP_204_NO_CONTENT,
    )


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class LogoutView(generics.GenericAPIView):
    serializer_class = LogoutSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(status=status.HTTP_204_NO_CONTENT)


class SocialJWTExchangeView(generics.GenericAPIView):
    authentication_classes = [
        SessionAuthentication,
    ]
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        request=None,
        responses={
            200: SocialJWTExchangeResponseSerializer,
        },
    )
    def post(self, request):
        refresh = RefreshToken.for_user(
            request.user,
        )

        response_data = {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }

        django_logout(request)

        return Response(
            response_data,
            status=status.HTTP_200_OK,
        )


class SocialConnectionListView(generics.GenericAPIView):
    serializer_class = SocialConnectionListSerializer
    permission_classes = [
        IsAuthenticated,
    ]

    def get(self, request):
        connected_providers = set(
            SocialAccount.objects.filter(
                user=request.user,
            ).values_list(
                "provider",
                flat=True,
            )
        )

        response_data = {
            "password_login_available": request.user.has_usable_password(),
            "providers": [
                {
                    "provider": provider,
                    "name": config["name"],
                    "connected": provider in connected_providers,
                }
                for provider, config in SOCIAL_PROVIDERS.items()
            ],
        }

        serializer = self.get_serializer(
            response_data,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


class SocialConnectStartView(generics.GenericAPIView):
    serializer_class = SocialConnectResponseSerializer
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        request=None,
        responses={
            200: SocialConnectResponseSerializer,
        },
    )
    def post(
        self,
        request,
        provider,
    ):
        provider_config = SOCIAL_PROVIDERS.get(
            provider,
        )

        if provider_config is None:
            raise NotFound("Social provider not found.")

        if SocialAccount.objects.filter(
            user=request.user,
            provider=provider,
        ).exists():
            return Response(
                {"detail": (f"{provider_config['name']} is already connected.")},
                status=(status.HTTP_400_BAD_REQUEST),
            )

        django_login(
            request._request,
            request.user,
            backend=("django.contrib.auth.backends.ModelBackend"),
        )

        provider_login_url = reverse(provider_config["login_url_name"])

        response_data = {"redirect_url": (f"{provider_login_url}?process=connect")}

        serializer = self.get_serializer(
            response_data,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


class SocialDisconnectView(generics.GenericAPIView):
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        request=None,
        responses={
            204: None,
        },
    )
    def delete(
        self,
        request,
        provider,
    ):
        provider_config = SOCIAL_PROVIDERS.get(
            provider,
        )

        if provider_config is None:
            raise NotFound("Social provider not found.")

        try:
            social_account = SocialAccount.objects.get(
                user=request.user,
                provider=provider,
            )
        except SocialAccount.DoesNotExist:
            raise NotFound((f"{provider_config['name']} is not connected."))

        has_other_social_account = (
            SocialAccount.objects.filter(
                user=request.user,
            )
            .exclude(
                pk=social_account.pk,
            )
            .exists()
        )

        if not request.user.has_usable_password() and not has_other_social_account:
            return Response(
                {
                    "detail": (
                        "You cannot disconnect "
                        "your last sign-in method. "
                        "Connect another provider "
                        "or set a password first."
                    )
                },
                status=(status.HTTP_400_BAD_REQUEST),
            )

        social_account.delete()

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )


class SetPasswordView(generics.GenericAPIView):
    serializer_class = SetPasswordSerializer
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        responses={
            204: None,
        },
    )
    def post(self, request):
        if request.user.has_usable_password():
            return Response(
                {"detail": ("Password sign-in is already configured.")},
                status=(status.HTTP_400_BAD_REQUEST),
            )

        serializer = self.get_serializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        serializer.save()

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )
