from datetime import timedelta
from unittest.mock import patch

from django.core import mail
from django.test import TestCase

from accounts.models import User

from .models import (
    WorkspaceInvitation,
    WorkspaceMembership,
)
from .services import (
    create_workspace,
    create_workspace_invitation,
)
from .tasks import send_workspace_invitation_email


class WorkspaceInvitationTaskTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner-task@example.com",
            username="owner-task",
            password="StrongPassword123!",
        )

        self.workspace = create_workspace(
            name="Celery Workspace",
            slug="celery-workspace",
            user=self.owner,
        )

        self.invitation = WorkspaceInvitation.objects.create(
            workspace=self.workspace,
            email="invitee@example.com",
            invited_by=self.owner,
            role=WorkspaceMembership.Role.MEMBER,
            expires_at=(self.workspace.created_at + timedelta(days=7)),
        )

    def test_task_sends_workspace_invitation_email(self):
        send_workspace_invitation_email(self.invitation.id)

        self.assertEqual(
            len(mail.outbox),
            1,
        )

        email = mail.outbox[0]

        self.assertEqual(
            email.to,
            ["invitee@example.com"],
        )

        self.assertIn(
            self.workspace.name,
            email.subject,
        )

        self.assertIn(
            str(self.invitation.token),
            email.body,
        )

    def test_task_does_nothing_for_missing_invitation(self):
        send_workspace_invitation_email(
            999999,
        )

        self.assertEqual(
            len(mail.outbox),
            0,
        )

    def test_task_does_not_send_for_cancelled_invitation(self):
        self.invitation.status = WorkspaceInvitation.Status.CANCELLED

        self.invitation.save(update_fields=["status"])

        send_workspace_invitation_email(self.invitation.id)

        self.assertEqual(
            len(mail.outbox),
            0,
        )


class WorkspaceInvitationEnqueueTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="enqueue-owner@example.com",
            username="enqueue-owner",
            password="StrongPassword123!",
        )

        self.workspace = create_workspace(
            name="Enqueue Workspace",
            slug="enqueue-workspace",
            user=self.owner,
        )

    @patch("workspaces.services.send_workspace_invitation_email.delay")
    def test_invitation_email_is_enqueued_after_commit(
        self,
        mocked_delay,
    ):
        with self.captureOnCommitCallbacks(execute=True):
            invitation = create_workspace_invitation(
                workspace=self.workspace,
                email="enqueue@example.com",
                invited_by=self.owner,
                role=WorkspaceMembership.Role.MEMBER,
            )

        mocked_delay.assert_called_once_with(invitation.id)
