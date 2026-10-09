from django.contrib.auth import SESSION_KEY
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from .models import User


class AuthenticationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="alex@example.com",
            username="alex",
            password="StrongPassword123!",
        )

    def test_register_user(self):
        response = self.client.post(
            reverse("register"),
            {
                "email": "new@example.com",
                "username": "newuser",
                "password": "StrongPassword123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email="new@example.com").exists())

    def test_login_with_email_and_password(self):
        response = self.client.post(
            reverse("login"),
            {
                "email": "alex@example.com",
                "password": "StrongPassword123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_me_requires_authentication(self):
        response = self.client.get(reverse("me"))

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_authenticated_user_can_access_me(self):
        login_response = self.client.post(
            reverse("login"),
            {
                "email": "alex@example.com",
                "password": "StrongPassword123!",
            },
            format="json",
        )

        access_token = login_response.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

        response = self.client.get(reverse("me"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], self.user.email)
        self.assertEqual(response.data["username"], self.user.username)

    def test_register_rejects_weak_password(self):
        response = self.client.post(
            reverse("register"),
            {
                "email": "weak@example.com",
                "username": "weakuser",
                "password": "123",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_register_hashes_password(self):
        response = self.client.post(
            reverse("register"),
            {
                "email": "new@example.com",
                "username": "newuser",
                "password": "StrongPassword123!",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        user = User.objects.get(email="new@example.com")

        self.assertNotEqual(
            user.password,
            "StrongPassword123!",
        )
        self.assertTrue(user.check_password("StrongPassword123!"))


class SocialAuthenticationPreparationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="social@example.com",
            username="social-user",
            password="StrongPassword123!",
        )

    def test_google_login_url_is_registered(self):
        self.assertEqual(
            reverse("google_login"),
            "/accounts/google/login/",
        )

    def test_github_login_url_is_registered(self):
        self.assertEqual(
            reverse("github_login"),
            "/accounts/github/login/",
        )

    def test_social_jwt_exchange_requires_session_authentication(
        self,
    ):
        response = self.client.post(reverse("social-jwt-exchange"))

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_social_session_can_be_exchanged_for_jwt(
        self,
    ):
        self.client.force_login(
            self.user,
        )

        response = self.client.post(reverse("social-jwt-exchange"))

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertIn(
            "access",
            response.data,
        )

        self.assertIn(
            "refresh",
            response.data,
        )

        access_token = AccessToken(response.data["access"])

        self.assertEqual(
            int(access_token["user_id"]),
            self.user.id,
        )

    def test_social_session_is_removed_after_jwt_exchange(
        self,
    ):
        self.client.force_login(
            self.user,
        )

        self.assertIn(
            SESSION_KEY,
            self.client.session,
        )

        response = self.client.post(reverse("social-jwt-exchange"))

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertNotIn(
            SESSION_KEY,
            self.client.session,
        )
