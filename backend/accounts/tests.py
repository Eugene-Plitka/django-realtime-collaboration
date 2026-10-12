from allauth.socialaccount.models import SocialAccount
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


class SocialConnectionManagementTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="connections@example.com",
            username="connections-user",
            password="StrongPassword123!",
        )

        self.client.force_authenticate(
            user=self.user,
        )

    def test_connection_list_returns_supported_providers(
        self,
    ):
        SocialAccount.objects.create(
            user=self.user,
            provider="google",
            uid="google-test-user",
        )

        response = self.client.get(
            reverse(
                "social-connection-list",
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(response.data["password_login_available"])

        providers = {
            item["provider"]: item["connected"] for item in response.data["providers"]
        }

        self.assertTrue(providers["google"])

        self.assertFalse(providers["github"])

    def test_connect_start_creates_authenticated_session(
        self,
    ):
        response = self.client.post(
            reverse(
                "social-connect-start",
                kwargs={
                    "provider": "google",
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["redirect_url"],
            ("/accounts/google/login/?process=connect"),
        )

        self.assertIn(
            SESSION_KEY,
            self.client.session,
        )

    def test_connect_start_rejects_already_connected_provider(
        self,
    ):
        SocialAccount.objects.create(
            user=self.user,
            provider="google",
            uid="google-existing-user",
        )

        response = self.client.post(
            reverse(
                "social-connect-start",
                kwargs={
                    "provider": "google",
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_disconnect_provider_when_password_is_available(
        self,
    ):
        SocialAccount.objects.create(
            user=self.user,
            provider="google",
            uid="google-disconnect-user",
        )

        response = self.client.delete(
            reverse(
                "social-disconnect",
                kwargs={
                    "provider": "google",
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

        self.assertFalse(
            SocialAccount.objects.filter(
                user=self.user,
                provider="google",
            ).exists()
        )

    def test_last_social_provider_cannot_be_disconnected_without_password(
        self,
    ):
        self.user.set_unusable_password()
        self.user.save(
            update_fields=[
                "password",
            ]
        )

        SocialAccount.objects.create(
            user=self.user,
            provider="google",
            uid="google-only-login",
        )

        response = self.client.delete(
            reverse(
                "social-disconnect",
                kwargs={
                    "provider": "google",
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertTrue(
            SocialAccount.objects.filter(
                user=self.user,
                provider="google",
            ).exists()
        )

    def test_social_provider_can_be_disconnected_when_another_provider_exists(
        self,
    ):
        self.user.set_unusable_password()
        self.user.save(
            update_fields=[
                "password",
            ]
        )

        google_account = SocialAccount.objects.create(
            user=self.user,
            provider="google",
            uid="google-login",
        )

        SocialAccount.objects.create(
            user=self.user,
            provider="github",
            uid="github-login",
        )

        response = self.client.delete(
            reverse(
                "social-disconnect",
                kwargs={
                    "provider": "google",
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

        self.assertFalse(
            SocialAccount.objects.filter(
                pk=google_account.pk,
            ).exists()
        )

        self.assertTrue(
            SocialAccount.objects.filter(
                user=self.user,
                provider="github",
            ).exists()
        )

    def test_unknown_social_provider_returns_not_found(
        self,
    ):
        response = self.client.post(
            reverse(
                "social-connect-start",
                kwargs={
                    "provider": "unknown",
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )


class SetPasswordTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="social-only@example.com",
            username="social-only",
        )

        self.user.set_unusable_password()

        self.user.save(
            update_fields=[
                "password",
            ]
        )

        self.client.force_authenticate(
            user=self.user,
        )

    def test_social_only_user_can_set_password(
        self,
    ):
        response = self.client.post(
            reverse("set-password"),
            {
                "password": "StrongPassword456!",
                "password_confirm": "StrongPassword456!",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

        self.user.refresh_from_db()

        self.assertTrue(self.user.has_usable_password())

        self.assertTrue(self.user.check_password("StrongPassword456!"))

    def test_set_password_rejects_mismatched_passwords(
        self,
    ):
        response = self.client.post(
            reverse("set-password"),
            {
                "password": "StrongPassword456!",
                "password_confirm": "DifferentPassword456!",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.user.refresh_from_db()

        self.assertFalse(self.user.has_usable_password())

    def test_set_password_rejects_weak_password(
        self,
    ):
        response = self.client.post(
            reverse("set-password"),
            {
                "password": "123",
                "password_confirm": "123",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_existing_password_cannot_be_replaced_by_set_endpoint(
        self,
    ):
        self.user.set_password("ExistingPassword123!")

        self.user.save(
            update_fields=[
                "password",
            ]
        )

        response = self.client.post(
            reverse("set-password"),
            {
                "password": "ReplacementPassword456!",
                "password_confirm": "ReplacementPassword456!",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.user.refresh_from_db()

        self.assertTrue(self.user.check_password("ExistingPassword123!"))

    def test_password_login_works_after_setting_password(
        self,
    ):
        response = self.client.post(
            reverse("set-password"),
            {
                "password": "StrongPassword456!",
                "password_confirm": "StrongPassword456!",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

        self.client.force_authenticate(
            user=None,
        )

        login_response = self.client.post(
            reverse("login"),
            {
                "email": "social-only@example.com",
                "password": "StrongPassword456!",
            },
            format="json",
        )

        self.assertEqual(
            login_response.status_code,
            status.HTTP_200_OK,
        )

        self.assertIn(
            "access",
            login_response.data,
        )

        self.assertIn(
            "refresh",
            login_response.data,
        )


class ChangePasswordTests(
    APITestCase,
):
    def setUp(self):
        self.user = User.objects.create_user(
            email=("password-change@example.com"),
            username=("password-change-user"),
            password=("ExistingPassword123!"),
        )

        self.client.force_authenticate(
            user=self.user,
        )

    def test_user_can_change_password(
        self,
    ):
        response = self.client.post(
            reverse(
                "change-password",
            ),
            {
                "current_password": ("ExistingPassword123!"),
                "new_password": ("NewStrongPassword456!"),
                "new_password_confirm": ("NewStrongPassword456!"),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

        self.user.refresh_from_db()

        self.assertTrue(
            self.user.check_password(
                "NewStrongPassword456!",
            )
        )

    def test_change_password_rejects_wrong_current_password(
        self,
    ):
        response = self.client.post(
            reverse(
                "change-password",
            ),
            {
                "current_password": ("WrongPassword123!"),
                "new_password": ("NewStrongPassword456!"),
                "new_password_confirm": ("NewStrongPassword456!"),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_change_password_rejects_mismatched_confirmation(
        self,
    ):
        response = self.client.post(
            reverse(
                "change-password",
            ),
            {
                "current_password": ("ExistingPassword123!"),
                "new_password": ("NewStrongPassword456!"),
                "new_password_confirm": ("DifferentPassword456!"),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_change_password_rejects_same_password(
        self,
    ):
        response = self.client.post(
            reverse(
                "change-password",
            ),
            {
                "current_password": ("ExistingPassword123!"),
                "new_password": ("ExistingPassword123!"),
                "new_password_confirm": ("ExistingPassword123!"),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )


class InterfaceScaleTests(
    APITestCase,
):
    def setUp(self):
        self.user = User.objects.create_user(
            email="appearance@example.com",
            username="appearance-user",
            password="StrongPassword123!",
        )

        self.client.force_authenticate(
            user=self.user,
        )

    def test_default_interface_scale_is_standard(
        self,
    ):
        response = self.client.get(
            reverse("me"),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["interface_scale_level"],
            3,
        )

    def test_user_can_update_interface_scale(
        self,
    ):
        response = self.client.patch(
            reverse("me"),
            {
                "interface_scale_level": 5,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.interface_scale_level,
            5,
        )

    def test_invalid_interface_scale_is_rejected(
        self,
    ):
        response = self.client.patch(
            reverse("me"),
            {
                "interface_scale_level": 7,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
