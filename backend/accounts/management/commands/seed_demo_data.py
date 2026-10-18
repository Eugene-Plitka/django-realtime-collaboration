import os
from datetime import timedelta

from django.conf import settings
from django.contrib.sessions.models import Session
from django.core.management.base import (
    BaseCommand,
    CommandError,
)
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)

from accounts.models import User
from chat.models import (
    Channel,
    ChannelMembership,
    DirectConversation,
    DirectConversationParticipant,
    DirectMessage,
    Message,
    MessageReaction,
)
from chat.services import (
    create_direct_conversation,
    create_direct_message,
    create_group_conversation,
    delete_direct_message,
    edit_direct_message,
)
from notifications.models import Notification
from workspaces.models import (
    Workspace,
    WorkspaceInvitation,
    WorkspaceMembership,
)


CONFIRMATION_PHRASE = "RESET-LOCAL-COLLABSPACE"
DEFAULT_PASSWORD = "test12345"  # Local development only


USERS = [
    {
        "username": "EthanCole",
        "first_name": "Ethan",
        "last_name": "Cole",
        "email": "EthanCole@example.com",
        "status": User.Status.ONLINE,
        "avatar": "avatars/ethan.cole.webp",
    },
    {
        "username": "MayaBennett",
        "first_name": "Maya",
        "last_name": "Bennett",
        "email": "MayaBennett@example.com",
        "status": User.Status.AWAY,
        "avatar": "avatars/maya.bennett.webp",
    },
    {
        "username": "LiamFoster",
        "first_name": "Liam",
        "last_name": "Foster",
        "email": "LiamFoster@example.com",
        "status": User.Status.ONLINE,
        "avatar": "avatars/liam.foster.webp",
    },
    {
        "username": "ChloeMorgan",
        "first_name": "Chloe",
        "last_name": "Morgan",
        "email": "ChloeMorgan@example.com",
        "status": User.Status.DND,
        "avatar": "avatars/chloe.morgan.webp",
    },
    {
        "username": "NoahCarter",
        "first_name": "Noah",
        "last_name": "Carter",
        "email": "NoahCarter@example.com",
        "status": User.Status.ONLINE,
        "avatar": "avatars/noah.carter.webp",
    },
    {
        "username": "LucasReed",
        "first_name": "Lucas",
        "last_name": "Reed",
        "email": "LucasReed@example.com",
        "status": User.Status.AWAY,
        "avatar": "avatars/lucas.reed.webp",
    },
    {
        "username": "DanielBrooks",
        "first_name": "Daniel",
        "last_name": "Brooks",
        "email": "DanielBrooks@example.com",
        "status": User.Status.ONLINE,
        "avatar": None,
    },
    {
        "username": "GraceMiller",
        "first_name": "Grace",
        "last_name": "Miller",
        "email": "GraceMiller@example.com",
        "status": User.Status.ONLINE,
        "avatar": "avatars/grace.miller.webp",
    },
    {
        "username": "OwenParker",
        "first_name": "Owen",
        "last_name": "Parker",
        "email": "OwenParker@example.com",
        "status": User.Status.AWAY,
        "avatar": None,
    },
    {
        "username": "EmmaCollins",
        "first_name": "Emma",
        "last_name": "Collins",
        "email": "EmmaCollins@example.com",
        "status": User.Status.ONLINE,
        "avatar": "avatars/emma.collins.webp",
    },
]


WORKSPACES = [
    {
        "name": "Northstar Product",
        "slug": "northstar-product",
        "owner": "EthanCole",
        "members": {
            "EthanCole": WorkspaceMembership.Role.OWNER,
            "NoahCarter": WorkspaceMembership.Role.MEMBER,
            "LucasReed": WorkspaceMembership.Role.MEMBER,
            "GraceMiller": WorkspaceMembership.Role.MEMBER,
            "OwenParker": WorkspaceMembership.Role.GUEST,
        },
        "channels": [
            {
                "name": "product",
                "description": "Product priorities, discovery, and delivery decisions.",
                "type": Channel.Type.PUBLIC,
            },
            {
                "name": "engineering",
                "description": "Implementation details, reviews, and technical coordination.",
                "type": Channel.Type.PUBLIC,
            },
            {
                "name": "launch",
                "description": "Launch planning, release readiness, and follow-up.",
                "type": Channel.Type.PUBLIC,
            },
            {
                "name": "partner-review",
                "description": "Private coordination with external product partners.",
                "type": Channel.Type.PRIVATE,
                "members": [
                    "EthanCole",
                    "GraceMiller",
                    "OwenParker",
                ],
            },
        ],
    },
    {
        "name": "Harbor Design Lab",
        "slug": "harbor-design-lab",
        "owner": "MayaBennett",
        "members": {
            "MayaBennett": WorkspaceMembership.Role.OWNER,
            "EthanCole": WorkspaceMembership.Role.ADMIN,
            "LiamFoster": WorkspaceMembership.Role.MEMBER,
            "DanielBrooks": WorkspaceMembership.Role.MEMBER,
            "GraceMiller": WorkspaceMembership.Role.MEMBER,
            "EmmaCollins": WorkspaceMembership.Role.GUEST,
        },
        "channels": [
            {
                "name": "design",
                "description": "Design reviews, UI decisions, and visual polish.",
                "type": Channel.Type.PUBLIC,
            },
            {
                "name": "research",
                "description": "User interviews, findings, and research planning.",
                "type": Channel.Type.PUBLIC,
            },
            {
                "name": "random",
                "description": "Lightweight team conversation and informal updates.",
                "type": Channel.Type.PUBLIC,
            },
            {
                "name": "client-review",
                "description": "Private client feedback and review preparation.",
                "type": Channel.Type.PRIVATE,
                "members": [
                    "MayaBennett",
                    "DanielBrooks",
                    "GraceMiller",
                    "EmmaCollins",
                ],
            },
        ],
    },
    {
        "name": "Atlas Operations",
        "slug": "atlas-operations",
        "owner": "LiamFoster",
        "members": {
            "LiamFoster": WorkspaceMembership.Role.OWNER,
            "MayaBennett": WorkspaceMembership.Role.ADMIN,
            "ChloeMorgan": WorkspaceMembership.Role.MEMBER,
            "NoahCarter": WorkspaceMembership.Role.MEMBER,
            "LucasReed": WorkspaceMembership.Role.MEMBER,
            "DanielBrooks": WorkspaceMembership.Role.MEMBER,
            "OwenParker": WorkspaceMembership.Role.GUEST,
        },
        "channels": [
            {
                "name": "operations",
                "description": "Daily operations, ownership, and cross-team coordination.",
                "type": Channel.Type.PUBLIC,
            },
            {
                "name": "logistics",
                "description": "Scheduling, vendor coordination, and delivery tracking.",
                "type": Channel.Type.PUBLIC,
            },
            {
                "name": "planning",
                "description": "Weekly planning, dependencies, and capacity.",
                "type": Channel.Type.PUBLIC,
            },
            {
                "name": "incident-room",
                "description": "Private incident handling and sensitive operational updates.",
                "type": Channel.Type.PRIVATE,
                "members": [
                    "LiamFoster",
                    "MayaBennett",
                    "DanielBrooks",
                    "OwenParker",
                ],
            },
        ],
    },
    {
        "name": "Aurora Growth",
        "slug": "aurora-growth",
        "owner": "ChloeMorgan",
        "members": {
            "ChloeMorgan": WorkspaceMembership.Role.OWNER,
            "EthanCole": WorkspaceMembership.Role.ADMIN,
            "MayaBennett": WorkspaceMembership.Role.MEMBER,
            "NoahCarter": WorkspaceMembership.Role.MEMBER,
            "LucasReed": WorkspaceMembership.Role.MEMBER,
            "DanielBrooks": WorkspaceMembership.Role.MEMBER,
            "GraceMiller": WorkspaceMembership.Role.MEMBER,
            "EmmaCollins": WorkspaceMembership.Role.GUEST,
        },
        "channels": [
            {
                "name": "campaigns",
                "description": "Campaign planning, launch checks, and performance notes.",
                "type": Channel.Type.PUBLIC,
            },
            {
                "name": "analytics",
                "description": "Growth metrics, experiments, and reporting.",
                "type": Channel.Type.PUBLIC,
            },
            {
                "name": "content",
                "description": "Content planning, reviews, and publication coordination.",
                "type": Channel.Type.PUBLIC,
            },
            {
                "name": "partnerships",
                "description": "Private partner conversations and commercial coordination.",
                "type": Channel.Type.PRIVATE,
                "members": [
                    "ChloeMorgan",
                    "EthanCole",
                    "MayaBennett",
                    "EmmaCollins",
                ],
            },
        ],
    },
]


CHANNEL_DIALOGUES = {
    "general": [
        "Morning everyone — I posted the priorities for this week and the scope still looks realistic.",
        "The main dependencies are clear. I will update the notes after the afternoon sync.",
        "I reviewed the open items and nothing looks blocked right now.",
        "Please flag anything that could affect the delivery date so we can address it early.",
    ],
    "product": [
        "The onboarding flow is still the highest-impact item for this sprint.",
        "I compared the latest feedback with the backlog and two edge cases need clearer acceptance criteria.",
        "The proposed scope looks good to me if we keep the first release focused on the core path.",
        "I added a short note about the empty-state behavior for the next review.",
    ],
    "engineering": [
        "The API changes are ready for review and the migration path stays backward compatible.",
        "I checked the query plan and the new index removes the slow scan we saw yesterday.",
        "I can take the frontend integration once the serializer shape is confirmed.",
        "There was one flaky local test on my first run, but I could not reproduce it after rebuilding.",
    ],
    "launch": [
        "The release checklist is almost complete; the remaining items are documentation and the final smoke test.",
        "I moved the rollout window by thirty minutes so support has time to prepare.",
        "The monitoring dashboard is ready and the alert thresholds match the last release.",
        "I will post a short launch summary after the first hour of production traffic.",
    ],
    "partner-review": [
        "The partner shared the revised requirements and the requested changes are smaller than expected.",
        "I checked the contract notes and the delivery milestone is unchanged.",
        "The only open question is whether they need the additional export format in the first release.",
        "I drafted a response with the proposed timeline and left it here for review.",
    ],
    "design": [
        "The updated navigation is in the review file and the spacing is more consistent now.",
        "I simplified the modal hierarchy so the primary action is easier to scan.",
        "The dark-theme contrast passes the checks I ran this morning.",
        "I would keep the current icon set and revisit custom illustrations after launch.",
    ],
    "research": [
        "Three interview notes are summarized and the same onboarding concern appeared in all of them.",
        "The next session should focus on how people understand workspace roles before they invite teammates.",
        "I tagged the strongest quotes and grouped them by task rather than by participant.",
        "The research summary will be ready before tomorrow's planning meeting.",
    ],
    "random": [
        "Quick note: the office playlist is finally less chaotic today.",
        "I found a good shortcut for the design handoff checklist and added it to our shared notes.",
        "Coffee machine status: operational again.",
        "Hope everyone gets a quiet hour for focused work this afternoon.",
    ],
    "client-review": [
        "The client deck is ready except for the final retention chart.",
        "I changed the order of the examples so the strongest workflow appears first.",
        "The open feedback is mostly wording; there are no structural changes requested.",
        "Let's do one final pass thirty minutes before the call.",
    ],
    "operations": [
        "Today's handoff is clean and the overnight queue is back to normal levels.",
        "Two recurring tasks still need owners for next week.",
        "I updated the runbook with the escalation path we used yesterday.",
        "No vendor issues are affecting the current schedule.",
    ],
    "logistics": [
        "The equipment shipment is confirmed for Thursday morning.",
        "I moved the vendor check-in earlier so we have buffer before the installation window.",
        "The backup supplier can cover the missing units if the primary delivery slips.",
        "I added the tracking references to the shared planning document.",
    ],
    "planning": [
        "Capacity looks balanced if we keep the two lower-priority requests out of this cycle.",
        "The dependency on the reporting work is the only item that could move the schedule.",
        "I split the large task into two deliverables so we can review progress midweek.",
        "The current plan leaves enough buffer for one unexpected support issue.",
    ],
    "incident-room": [
        "The affected workflow is stable again and the error rate has returned to baseline.",
        "I captured the timeline while the details are still fresh.",
        "The temporary mitigation can stay in place until we deploy the permanent fix.",
        "I will prepare the follow-up actions and owners for the incident review.",
    ],
    "campaigns": [
        "The launch campaign is ready for the final copy review.",
        "Paid and organic variants now use the same core message, which should make the results easier to compare.",
        "I scheduled the first performance check for the morning after launch.",
        "The fallback creative is uploaded in case the primary version needs to be paused.",
    ],
    "analytics": [
        "Yesterday's conversion rate recovered after the tracking fix and the trend is back inside the expected range.",
        "I added a cohort view so we can separate new users from returning teams.",
        "The experiment sample is still too small for a confident decision.",
        "I will refresh the dashboard after the next data load.",
    ],
    "content": [
        "The next two articles are drafted and both are waiting for technical review.",
        "I shortened the introduction so the first example appears above the fold.",
        "The release post can go live as soon as the screenshots are updated.",
        "I added the final metadata and internal links to the publishing checklist.",
    ],
    "partnerships": [
        "The partner call went well and they are comfortable with the revised rollout plan.",
        "Their legal review only has one remaining wording question.",
        "I added the commercial notes to the private summary.",
        "We should have final confirmation before Friday afternoon.",
    ],
}


DM_SCENARIOS = [
    [
        "Do you have ten minutes to review the handoff notes?",
        "Yes, I just opened them. The scope looks clear from my side.",
        "Great. I mainly wanted to confirm the Friday deadline.",
        "Friday works for me. I will flag anything unexpected before then.",
    ],
    [
        "I saw your comment on the planning thread. Do you want me to update the checklist?",
        "Please do. The current version still references the old review step.",
        "Got it. I will clean that up and send you the link.",
        "Perfect, thanks. That will make tomorrow's handoff much easier.",
    ],
    [
        "Can we align on the client call before the afternoon meeting?",
        "Sure. I think the main point is to keep the first release narrow.",
        "Agreed. I will frame the optional items as follow-up work.",
        "Sounds good. I will join five minutes early in case we need a quick sync.",
    ],
    [
        "The logistics note looks good. Did the vendor confirm the backup window?",
        "Yes, they confirmed it this morning.",
        "Excellent. Then I can close the scheduling risk on my side.",
        "Please do. I will let you know immediately if anything changes.",
    ],
    [
        "Quick check — are you comfortable with the new engineering estimate?",
        "Yes. The smaller milestones make the risk much easier to manage.",
        "That was my thought too. I will keep the buffer in the final plan.",
        "Good call. The team should be able to commit to that.",
    ],
    [
        "Could you review the wording in the partnership summary?",
        "Absolutely. Send me the section you are least sure about.",
        "The second paragraph feels too formal for the relationship.",
        "I agree. I will rewrite it in a more direct tone.",
    ],
    [
        "Do you have the latest research summary handy?",
        "Yes, I can send it over now.",
        "Thanks. I want to use the role-permission finding in tomorrow's discussion.",
        "That is the strongest finding in the set, so it should work well.",
    ],
    [
        "I updated the dashboard filters. Can you sanity-check the numbers?",
        "I checked the main totals and they match the source report.",
        "Great. I will leave the experiment segment marked as preliminary.",
        "That is the right call until we have another day of data.",
    ],
]


DIRECT_PAIRS = [
    ("EthanCole", "NoahCarter"),
    ("EthanCole", "MayaBennett"),
    ("MayaBennett", "LiamFoster"),
    ("LiamFoster", "OwenParker"),
    ("OwenParker", "LucasReed"),
    ("LucasReed", "EmmaCollins"),
    ("EmmaCollins", "GraceMiller"),
    ("GraceMiller", "DanielBrooks"),
]


class Command(BaseCommand):
    help = (
        "Reset CollabSpace application data and create a deterministic "
        "portfolio demo dataset."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm",
            default="",
            help=(
                "Required destructive-action confirmation. "
                f"Use exactly: {CONFIRMATION_PHRASE}"
            ),
        )

    def handle(self, *args, **options):
        self._validate_environment(
            confirmation=options["confirm"],
        )

        self.stdout.write(
            self.style.WARNING(
                "This command deletes all non-superuser accounts and "
                "all application conversations and workspaces."
            )
        )

        with transaction.atomic():
            self._clear_existing_data()

            users = self._create_users()
            workspaces, channels = self._create_workspaces_and_channels(
                users=users,
            )

            channel_message_stats = self._create_channel_messages(
                users=users,
                channels=channels,
            )

            self._create_invitations(
                users=users,
                workspaces=workspaces,
            )

            direct_message_stats = self._create_direct_messages(
                users=users,
            )

        self._print_summary(
            channel_message_stats=channel_message_stats,
            direct_message_stats=direct_message_stats,
        )

    def _validate_environment(
        self,
        *,
        confirmation,
    ):
        if confirmation != CONFIRMATION_PHRASE:
            raise CommandError(
                "Destructive operation not confirmed. Run the command with "
                f"--confirm {CONFIRMATION_PHRASE}"
            )

        if not settings.DEBUG:
            if os.environ.get("COLLAB_DEMO_RESET_ALLOWED") != "yes":
                raise CommandError(
                    "Production reset is disabled. Set "
                    "COLLAB_DEMO_RESET_ALLOWED=yes only for the reset process."
                )
            if not os.environ.get("DEMO_USER_PASSWORD"):
                raise CommandError(
                    "DEMO_USER_PASSWORD is required for production reset."
                )
            if not User.objects.filter(is_superuser=True).exists():
                raise CommandError("Refusing production reset: no superuser exists.")

    def _clear_existing_data(self):
        self.stdout.write("Clearing application data; preserving superusers...")

        Notification.objects.all().delete()
        WorkspaceInvitation.objects.all().delete()

        MessageReaction.objects.all().delete()
        Message.objects.all().delete()

        DirectMessage.objects.all().delete()
        DirectConversationParticipant.objects.all().delete()
        DirectConversation.objects.all().delete()

        ChannelMembership.objects.all().delete()
        Channel.objects.all().delete()

        WorkspaceMembership.objects.all().delete()
        Workspace.objects.all().delete()

        # Deletes visitor-linked allauth records through Django's cascading
        # relationships while preserving superuser OAuth connections.
        User.objects.filter(is_superuser=False).delete()

        # End active sessions and revoke refresh tokens after the reset.
        Session.objects.all().delete()
        BlacklistedToken.objects.all().delete()
        OutstandingToken.objects.all().delete()

    def _create_users(self):
        self.stdout.write("Creating demo users...")

        users = {}

        now = timezone.now()

        for index, user_data in enumerate(USERS):
            user = User.objects.create_user(
                username=user_data["username"],
                email=user_data["email"],
                password=os.environ.get("DEMO_USER_PASSWORD", DEFAULT_PASSWORD),
                first_name=user_data["first_name"],
                last_name=user_data["last_name"],
                status=user_data["status"],
            )

            if user_data["avatar"]:
                user.avatar = user_data["avatar"]
                user.save(update_fields=["avatar"])

            created_at = now - timedelta(
                days=90 - (index * 3),
                hours=index,
            )

            User.objects.filter(
                pk=user.pk,
            ).update(
                created_at=created_at,
                updated_at=created_at,
            )

            users[user.username] = user

        return users

    def _create_workspaces_and_channels(
        self,
        *,
        users,
    ):
        self.stdout.write("Creating workspaces, memberships, and channels...")

        workspaces = {}
        channels = {}

        now = timezone.now()

        for workspace_index, config in enumerate(WORKSPACES):
            owner = users[config["owner"]]

            workspace = Workspace.objects.create(
                name=config["name"],
                slug=config["slug"],
                created_by=owner,
            )

            workspace_created_at = now - timedelta(
                days=70 - (workspace_index * 6),
            )

            Workspace.objects.filter(
                pk=workspace.pk,
            ).update(
                created_at=workspace_created_at,
                updated_at=workspace_created_at,
            )

            workspaces[workspace.slug] = workspace

            memberships = {}

            for member_index, (
                username,
                role,
            ) in enumerate(config["members"].items()):
                membership = WorkspaceMembership.objects.create(
                    workspace=workspace,
                    user=users[username],
                    role=role,
                )

                WorkspaceMembership.objects.filter(
                    pk=membership.pk,
                ).update(
                    joined_at=workspace_created_at
                    + timedelta(
                        days=member_index + 1,
                    )
                )

                memberships[username] = membership

            general = Channel.objects.create(
                workspace=workspace,
                name="general",
                description="Workspace-wide coordination and team updates.",
                type=Channel.Type.PUBLIC,
                is_general=True,
                created_by=owner,
            )

            Channel.objects.filter(
                pk=general.pk,
            ).update(
                created_at=workspace_created_at + timedelta(hours=2),
                updated_at=workspace_created_at + timedelta(hours=2),
            )

            for username, membership in memberships.items():
                if membership.role == WorkspaceMembership.Role.GUEST:
                    continue

                channel_membership = ChannelMembership.objects.create(
                    channel=general,
                    user=users[username],
                )

                ChannelMembership.objects.filter(
                    pk=channel_membership.pk,
                ).update(joined_at=workspace_created_at + timedelta(days=1))

            channels[(workspace.slug, "general")] = general

            non_guest_usernames = [
                username
                for username, membership in memberships.items()
                if membership.role != WorkspaceMembership.Role.GUEST
            ]

            for channel_offset, channel_config in enumerate(
                config["channels"],
                start=1,
            ):
                channel = Channel.objects.create(
                    workspace=workspace,
                    name=channel_config["name"],
                    description=channel_config["description"],
                    type=channel_config["type"],
                    is_general=False,
                    created_by=owner,
                )

                channel_created_at = workspace_created_at + timedelta(
                    days=2 + channel_offset,
                    hours=channel_offset,
                )

                Channel.objects.filter(
                    pk=channel.pk,
                ).update(
                    created_at=channel_created_at,
                    updated_at=channel_created_at,
                )

                if channel.type == Channel.Type.PUBLIC:
                    channel_usernames = non_guest_usernames
                else:
                    channel_usernames = channel_config["members"]

                for member_offset, username in enumerate(
                    channel_usernames,
                ):
                    channel_membership = ChannelMembership.objects.create(
                        channel=channel,
                        user=users[username],
                    )

                    ChannelMembership.objects.filter(
                        pk=channel_membership.pk,
                    ).update(
                        joined_at=channel_created_at
                        + timedelta(
                            minutes=member_offset + 1,
                        )
                    )

                    if (
                        channel.type == Channel.Type.PRIVATE
                        and username != owner.username
                    ):
                        notification = Notification.objects.create(
                            user=users[username],
                            type=Notification.Type.CHANNEL_ADDED,
                            payload={
                                "workspace_id": workspace.id,
                                "channel_id": channel.id,
                                "channel_name": channel.name,
                            },
                            is_read=(member_offset % 2 == 0),
                        )

                        Notification.objects.filter(
                            pk=notification.pk,
                        ).update(
                            created_at=channel_created_at
                            + timedelta(
                                minutes=member_offset + 2,
                            )
                        )

                channels[(workspace.slug, channel.name)] = channel

        return (
            workspaces,
            channels,
        )

    def _create_channel_messages(
        self,
        *,
        users,
        channels,
    ):
        self.stdout.write(
            "Creating channel conversations, replies, edits, deletions, "
            "mentions, and reactions..."
        )

        now = timezone.now()

        message_count = 0
        reply_count = 0
        edited_count = 0
        deleted_count = 0
        reaction_count = 0
        mention_count = 0

        for channel_index, (
            (_workspace_slug, _channel_name),
            channel,
        ) in enumerate(
            sorted(
                channels.items(),
                key=lambda item: (
                    item[0][0],
                    item[0][1],
                ),
            )
        ):
            members = list(
                User.objects.filter(
                    channel_memberships__channel=channel,
                )
                .order_by(
                    "username",
                )
                .distinct()
            )

            if not members:
                continue

            dialogue = CHANNEL_DIALOGUES[channel.name]

            channel_start = (
                now
                - timedelta(
                    days=8,
                )
                + timedelta(
                    hours=channel_index * 6,
                )
            )

            created_messages = []

            for message_index, base_text in enumerate(dialogue):
                author = members[
                    message_index
                    % len(
                        members,
                    )
                ]

                text = base_text

                should_mention = (
                    message_index == 1 and len(members) > 1 and channel_index % 3 == 0
                )

                mentioned_user = None

                if should_mention:
                    mentioned_user = members[
                        (message_index + 1)
                        % len(
                            members,
                        )
                    ]

                    if mentioned_user.id == author.id:
                        mentioned_user = members[
                            (message_index + 2)
                            % len(
                                members,
                            )
                        ]

                    text = f"@{mentioned_user.username} {text[0].lower()}{text[1:]}"

                reply_to = None

                if message_index == 2 and channel_index % 2 == 0 and created_messages:
                    reply_to = created_messages[0]
                    reply_count += 1

                created_at = channel_start + timedelta(
                    minutes=15 + (message_index * 43),
                )

                message = Message.objects.create(
                    channel=channel,
                    author=author,
                    reply_to=reply_to,
                    text=text,
                )

                Message.objects.filter(
                    pk=message.pk,
                ).update(
                    created_at=created_at,
                    updated_at=created_at,
                )

                message.refresh_from_db()

                created_messages.append(
                    message,
                )

                message_count += 1

                if mentioned_user is not None:
                    notification = Notification.objects.create(
                        user=mentioned_user,
                        type=Notification.Type.MENTION,
                        payload={
                            "message_id": message.id,
                            "channel_id": channel.id,
                            "channel_name": channel.name,
                            "workspace_id": channel.workspace_id,
                            "author_id": author.id,
                            "author_username": author.username,
                        },
                        is_read=(channel_index % 2 == 0),
                    )

                    Notification.objects.filter(
                        pk=notification.pk,
                    ).update(created_at=created_at + timedelta(seconds=5))

                    mention_count += 1

            if len(created_messages) >= 2 and channel_index % 3 == 0:
                edited_message = created_messages[1]

                edited_at = edited_message.created_at + timedelta(
                    minutes=11,
                )

                Message.objects.filter(
                    pk=edited_message.pk,
                ).update(
                    text=(
                        f"{edited_message.text} I updated this after the latest review."
                    ),
                    edited_at=edited_at,
                    updated_at=edited_at,
                )

                edited_count += 1

            if len(created_messages) >= 4 and channel_index % 4 == 0:
                deleted_message = created_messages[3]

                deleted_at = deleted_message.created_at + timedelta(
                    minutes=9,
                )

                Message.objects.filter(
                    pk=deleted_message.pk,
                ).update(
                    is_deleted=True,
                    updated_at=deleted_at,
                )

                deleted_count += 1

            first_message = created_messages[0]

            reaction_candidates = [
                member for member in members if member.id != first_message.author_id
            ]

            emojis = [
                MessageReaction.Emoji.THUMBS_UP,
                MessageReaction.Emoji.HEART,
                MessageReaction.Emoji.PARTY,
                MessageReaction.Emoji.FIRE,
                MessageReaction.Emoji.LAUGH,
            ]

            for reaction_index, reacting_user in enumerate(
                reaction_candidates[:2],
            ):
                reaction = MessageReaction.objects.create(
                    message=first_message,
                    user=reacting_user,
                    emoji=emojis[
                        (channel_index + reaction_index)
                        % len(
                            emojis,
                        )
                    ],
                )

                MessageReaction.objects.filter(
                    pk=reaction.pk,
                ).update(
                    created_at=first_message.created_at
                    + timedelta(
                        minutes=3 + reaction_index,
                    )
                )

                reaction_count += 1

        return {
            "messages": message_count,
            "replies": reply_count,
            "edited": edited_count,
            "deleted": deleted_count,
            "reactions": reaction_count,
            "mentions": mention_count,
        }

    def _create_invitations(
        self,
        *,
        users,
        workspaces,
    ):
        self.stdout.write("Creating sample workspace invitations...")

        now = timezone.now()

        invitation_configs = [
            {
                "workspace": "northstar-product",
                "email": "ava.contractor@example.com",
                "invited_by": "EthanCole",
                "role": WorkspaceMembership.Role.MEMBER,
                "status": WorkspaceInvitation.Status.PENDING,
            },
            {
                "workspace": "harbor-design-lab",
                "email": "ben.review@example.com",
                "invited_by": "MayaBennett",
                "role": WorkspaceMembership.Role.GUEST,
                "status": WorkspaceInvitation.Status.PENDING,
            },
            {
                "workspace": "aurora-growth",
                "email": "mia.partner@example.com",
                "invited_by": "ChloeMorgan",
                "role": WorkspaceMembership.Role.MEMBER,
                "status": WorkspaceInvitation.Status.CANCELLED,
            },
        ]

        for index, config in enumerate(invitation_configs):
            invitation = WorkspaceInvitation.objects.create(
                workspace=workspaces[config["workspace"]],
                email=config["email"],
                invited_by=users[config["invited_by"]],
                role=config["role"],
                status=config["status"],
                expires_at=now
                + timedelta(
                    days=7 + index,
                ),
            )

            WorkspaceInvitation.objects.filter(
                pk=invitation.pk,
            ).update(
                created_at=now
                - timedelta(
                    days=2 - index,
                )
            )

    def _create_direct_messages(
        self,
        *,
        users,
    ):
        self.stdout.write("Creating direct and group direct conversations...")

        now = timezone.now()

        direct_message_count = 0
        direct_reply_count = 0
        direct_edited_count = 0
        direct_deleted_count = 0

        for pair_index, (
            first_username,
            second_username,
        ) in enumerate(DIRECT_PAIRS):
            first_user = users[first_username]
            second_user = users[second_username]

            conversation, _created = create_direct_conversation(
                created_by=first_user,
                participant_users=[
                    second_user,
                ],
            )

            conversation_start = now - timedelta(
                days=6 - (pair_index % 4),
                hours=pair_index,
            )

            messages = []

            for message_index, text in enumerate(
                DM_SCENARIOS[pair_index],
            ):
                author = first_user if message_index % 2 == 0 else second_user

                reply_to = None

                if message_index == 2 and pair_index % 2 == 0:
                    reply_to = messages[0]
                    direct_reply_count += 1

                message = create_direct_message(
                    conversation=conversation,
                    author=author,
                    text=text,
                    reply_to=reply_to,
                )

                created_at = conversation_start + timedelta(
                    minutes=12 + (message_index * 37),
                )

                DirectMessage.objects.filter(
                    pk=message.pk,
                ).update(
                    created_at=created_at,
                    updated_at=created_at,
                )

                message.refresh_from_db()

                messages.append(
                    message,
                )

                direct_message_count += 1

            if pair_index % 3 == 0:
                message = messages[1]

                edit_direct_message(
                    message=message,
                    text=(
                        f"{message.text} "
                        "I clarified the last detail after checking the notes."
                    ),
                )

                edited_at = conversation_start + timedelta(
                    hours=1,
                    minutes=5,
                )

                DirectMessage.objects.filter(
                    pk=message.pk,
                ).update(
                    edited_at=edited_at,
                    updated_at=edited_at,
                )

                direct_edited_count += 1

            if pair_index % 4 == 1:
                message = messages[3]

                delete_direct_message(
                    message=message,
                )

                DirectMessage.objects.filter(
                    pk=message.pk,
                ).update(
                    updated_at=conversation_start
                    + timedelta(
                        hours=2,
                        minutes=20,
                    )
                )

                direct_deleted_count += 1

            latest_created_at = max(
                message.created_at
                for message in DirectMessage.objects.filter(
                    conversation=conversation,
                )
            )

            DirectConversation.objects.filter(
                pk=conversation.pk,
            ).update(
                created_at=conversation_start - timedelta(minutes=5),
                updated_at=latest_created_at,
            )

            participants = list(
                DirectConversationParticipant.objects.filter(
                    conversation=conversation,
                ).order_by(
                    "user_id",
                )
            )

            for participant_index, participant in enumerate(
                participants,
            ):
                participant.unread_count = (
                    0 if participant_index == pair_index % 2 else 1 + (pair_index % 3)
                )

                participant.save(
                    update_fields=[
                        "unread_count",
                    ]
                )

                DirectConversationParticipant.objects.filter(
                    pk=participant.pk,
                ).update(joined_at=conversation_start)

        group_users = [
            users["EthanCole"],
            users["MayaBennett"],
            users["LiamFoster"],
            users["ChloeMorgan"],
        ]

        group_conversation = create_group_conversation(
            created_by=users["EthanCole"],
            participant_users=group_users[1:],
            name="Quarterly Launch Crew",
        )

        group_start = now - timedelta(
            days=2,
            hours=3,
        )

        group_texts = [
            (
                users["EthanCole"],
                "I created this thread so we can keep the cross-team launch decisions in one place.",
            ),
            (
                users["MayaBennett"],
                "Perfect. I will use it for the design and client-review checkpoints.",
            ),
            (
                users["LiamFoster"],
                "Operations is ready. I only need the final launch window before I lock the support schedule.",
            ),
            (
                users["ChloeMorgan"],
                "Growth is aligned too. The campaign assets can go live as soon as the release is confirmed.",
            ),
            (
                users["EthanCole"],
                "Let's target the Thursday afternoon window unless tomorrow's smoke test shows a blocker.",
            ),
            (
                users["MayaBennett"],
                "That works for design. I will finish the final visual pass in the morning.",
            ),
            (
                users["LiamFoster"],
                "I have added the monitoring and escalation owners to the runbook.",
            ),
            (
                users["ChloeMorgan"],
                "Great. I will schedule the announcement but keep it in draft until we give the go-ahead.",
            ),
        ]

        group_messages = []

        for message_index, (
            author,
            text,
        ) in enumerate(group_texts):
            reply_to = None

            if message_index == 4:
                reply_to = group_messages[0]
                direct_reply_count += 1

            message = create_direct_message(
                conversation=group_conversation,
                author=author,
                text=text,
                reply_to=reply_to,
            )

            created_at = group_start + timedelta(
                minutes=message_index * 31,
            )

            DirectMessage.objects.filter(
                pk=message.pk,
            ).update(
                created_at=created_at,
                updated_at=created_at,
            )

            message.refresh_from_db()

            group_messages.append(
                message,
            )

            direct_message_count += 1

        edit_direct_message(
            message=group_messages[5],
            text=(
                "That works for design. I will finish the final visual pass "
                "before 11 AM."
            ),
        )

        group_edit_time = group_messages[5].created_at + timedelta(
            minutes=8,
        )

        DirectMessage.objects.filter(
            pk=group_messages[5].pk,
        ).update(
            edited_at=group_edit_time,
            updated_at=group_edit_time,
        )

        direct_edited_count += 1

        DirectConversation.objects.filter(
            pk=group_conversation.pk,
        ).update(
            created_at=group_start - timedelta(minutes=10),
            updated_at=group_messages[-1].created_at,
        )

        group_participants = list(
            DirectConversationParticipant.objects.filter(
                conversation=group_conversation,
            ).order_by(
                "user_id",
            )
        )

        for participant_index, participant in enumerate(
            group_participants,
        ):
            participant.unread_count = participant_index

            participant.save(
                update_fields=[
                    "unread_count",
                ]
            )

            DirectConversationParticipant.objects.filter(
                pk=participant.pk,
            ).update(joined_at=group_start)

        return {
            "direct_messages": direct_message_count,
            "direct_replies": direct_reply_count,
            "direct_edited": direct_edited_count,
            "direct_deleted": direct_deleted_count,
        }

    def _print_summary(
        self,
        *,
        channel_message_stats,
        direct_message_stats,
    ):
        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS("CollabSpace demo dataset created successfully.")
        )
        self.stdout.write("")
        self.stdout.write(f"Users: {User.objects.count()}")
        self.stdout.write(
            f"Users with custom avatar paths: "
            f"{User.objects.exclude(avatar='').exclude(avatar__isnull=True).count()}"
        )
        self.stdout.write(f"Workspaces: {Workspace.objects.count()}")
        self.stdout.write(
            f"Workspace memberships: {WorkspaceMembership.objects.count()}"
        )
        self.stdout.write(f"Channels: {Channel.objects.count()}")
        self.stdout.write(f"Channel memberships: {ChannelMembership.objects.count()}")
        self.stdout.write(f"Channel messages: {channel_message_stats['messages']}")
        self.stdout.write(f"Replies: {channel_message_stats['replies']}")
        self.stdout.write(f"Edited channel messages: {channel_message_stats['edited']}")
        self.stdout.write(
            f"Deleted channel messages: {channel_message_stats['deleted']}"
        )
        self.stdout.write(f"Reactions: {channel_message_stats['reactions']}")
        self.stdout.write(f"Mentions: {channel_message_stats['mentions']}")
        self.stdout.write(f"Notifications: {Notification.objects.count()}")
        self.stdout.write(
            f"Workspace invitations: {WorkspaceInvitation.objects.count()}"
        )
        self.stdout.write(
            f"Direct conversations: "
            f"{DirectConversation.objects.filter(type=DirectConversation.Type.DIRECT).count()}"
        )
        self.stdout.write(
            f"Group direct conversations: "
            f"{DirectConversation.objects.filter(type=DirectConversation.Type.GROUP).count()}"
        )
        self.stdout.write(f"Direct messages: {direct_message_stats['direct_messages']}")
        self.stdout.write(f"Direct replies: {direct_message_stats['direct_replies']}")
        self.stdout.write(
            f"Edited direct messages: {direct_message_stats['direct_edited']}"
        )
        self.stdout.write(
            f"Deleted direct messages: {direct_message_stats['direct_deleted']}"
        )
        self.stdout.write("")
        self.stdout.write("Demo user passwords loaded from environment.")
