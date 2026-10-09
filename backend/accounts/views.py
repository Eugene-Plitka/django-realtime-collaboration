from django.contrib.auth import logout as django_logout
from rest_framework import generics, status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import (
    LogoutSerializer,
    RegisterSerializer,
    UserSerializer,
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
