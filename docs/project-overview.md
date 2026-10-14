# CollabSpace Project Overview

## 1. Project Purpose

`django-realtime-collaboration` is a full-stack realtime collaboration platform inspired by Slack, Discord, and Microsoft Teams.

The project was created as a portfolio application with an emphasis on practical backend architecture, authorization, realtime communication, asynchronous tasks, relational data modeling, testing, performance, documentation, and production readiness.

The product combines:

- a Django REST API;
- authenticated WebSocket communication with Django Channels;
- PostgreSQL for persistent application data;
- Redis for the Channels layer and Celery;
- Celery for asynchronous background tasks;
- React + Vite for the single-page frontend;
- Docker and Docker Compose for local and production-like environments.

---

## 2. Main Product Capabilities

The application supports:

- account registration and authentication;
- JWT access and refresh tokens;
- Google and GitHub social authentication;
- workspace creation and management;
- role-based workspace permissions;
- workspace invitations;
- public and private channels;
- channel membership management;
- realtime channel messaging;
- message edit and soft delete;
- replies;
- mentions;
- emoji reactions;
- typing indicators;
- persistent notifications;
- user presence and status;
- direct messages;
- group direct messages;
- direct-message unread counters;
- user avatars;
- profile settings;
- password settings;
- sign-in method management;
- appearance settings;
- OpenAPI / Swagger API documentation;
- automated backend and frontend validation through GitHub Actions.

---

## 3. Authentication and Accounts

### Email and password

Users can register with email, username, and password.

Authentication uses JWT access and refresh tokens.

The application supports:

- access-token authentication;
- refresh-token rotation;
- refresh-token blacklist behavior;
- authenticated current-user requests;
- logout behavior;
- password changes;
- password setup for social-only accounts.

### Social authentication

Google and GitHub authentication are integrated through `django-allauth`.

Social authentication is optional and configured through environment variables.

Supported account flows include:

- social login;
- social signup;
- connecting a social provider to an existing account;
- disconnecting a provider when another valid sign-in method remains available;
- setting a password for accounts originally created through social login.

### Username

Email is used for authentication.

Username is the public identity used in the collaboration interface and in features such as mentions.

---

## 4. Workspace Roles and Permissions

Workspace access is role-aware.

The available roles are:

### OWNER

The workspace owner has the highest level of control.

Typical capabilities include:

- managing workspace settings;
- managing members;
- changing member roles;
- transferring ownership;
- managing channels;
- managing private-channel membership;
- managing invitations;
- deleting or leaving the workspace according to ownership rules.

### ADMIN

Administrators have elevated workspace-management permissions.

Typical capabilities include:

- managing channels;
- managing members within allowed role rules;
- managing invitations;
- managing private-channel membership.

Administrators do not replace the workspace owner and cannot perform owner-only operations such as ownership transfer unless explicitly allowed by the backend.

### MEMBER

Regular members participate in the workspace and its collaboration features.

They can typically:

- access the workspace;
- use channels they belong to;
- discover and explicitly join eligible public channels;
- send and interact with messages;
- use mentions, replies, reactions, and typing indicators;
- participate in direct conversations.

### GUEST

Guests have more restricted workspace access.

Their permissions are intentionally narrower than regular members and are enforced by backend permission logic.

---

## 5. Workspaces

Users can create and belong to multiple workspaces.

Workspace functionality includes:

- workspace creation;
- workspace listing;
- workspace detail access;
- member listing;
- adding and removing members according to permissions;
- changing member roles;
- transferring ownership;
- leaving a workspace;
- role-aware UI behavior.

The application keeps authorization checks on the backend rather than relying only on frontend visibility.

---

## 6. Workspace Invitations

Workspace members with appropriate permissions can invite users by email.

Invitation functionality includes:

- creating invitations;
- binding invitations to the invited email address;
- invitation expiration;
- pending invitation listing;
- accepting invitations;
- cancelling invitations;
- notification delivery;
- asynchronous invitation email tasks.

Invitation states include concepts such as pending, accepted, expired, and cancelled.

Celery is used for invitation email delivery.

---

## 7. Channels

A workspace can contain public and private channels.

### General channel

Every workspace has a mandatory `#general` channel.

The general channel has additional protection and cannot be treated like an ordinary removable channel.

### Public channels

Public-channel behavior includes:

- discovery by eligible workspace users;
- explicit join behavior;
- leaving a channel;
- normal realtime messaging after membership is established.

### Private channels

Private channels use explicit membership.

Users without membership cannot access their messages or WebSocket connection.

### Channel management

Role-aware channel management includes:

- channel creation;
- editing channel name and description;
- deleting eligible channels;
- managing private-channel membership;
- protected behavior for the general channel.

---

## 8. Channel Messaging

Channel messaging uses a combination of REST and WebSockets.

### REST responsibilities

REST is used for persistent operations such as:

- loading message history;
- cursor pagination;
- channel and membership management.

### WebSocket responsibilities

WebSockets are used for realtime operations such as:

- message creation;
- message editing;
- message deletion;
- reactions;
- typing events;
- realtime broadcasts.

### Message editing

Edit permissions are enforced by the backend.

### Message deletion

Messages use soft-delete behavior.

A deleted message remains represented in the conversation, while its text is no longer exposed as normal message content.

---

## 9. Replies

Users can reply to messages.

Reply behavior includes:

- replying to a message in the same channel;
- reply previews;
- reply snapshots in REST and WebSocket payloads;
- source-message navigation in the frontend;
- safe representation of deleted reply targets.

A reply cannot reference a message from another channel or direct conversation.

---

## 10. Mentions

The application supports `@username` mentions.

Mention behavior includes:

- username detection;
- frontend mention autocomplete;
- notification creation;
- realtime notification delivery;
- persisted notification history.

Mention notifications are only created where the mentioned user is eligible to receive them according to channel and workspace access rules.

---

## 11. Emoji Reactions

Messages support predefined emoji reactions.

Reaction functionality includes:

- adding a reaction;
- removing the current user's reaction;
- aggregate reaction counts;
- realtime updates for connected clients;
- validation of supported emojis;
- protection against reacting to deleted messages.

---

## 12. Typing Indicators

Realtime typing events are supported in workspace channels, direct conversations, and group direct conversations.

The sender does not receive their own typing event.

The frontend sends:

- `typing.start`;
- `typing.stop`.

The backend broadcasts the corresponding realtime events to other eligible participants.

---

## 13. Presence

The application supports user presence and status.

Status information is displayed in collaboration UI areas such as member interfaces, channel messaging, and direct messages.

Presence updates are delivered through a dedicated authenticated WebSocket connection.

The current user-status model supports values such as:

- online;
- away;
- do not disturb.

Presence updates are scoped to shared workspace relationships rather than broadcast globally to unrelated users.

---

## 14. Notifications

Notifications are persistent database records and can also be delivered in realtime.

Notification functionality includes:

- notification history;
- unread count;
- mark read;
- mark unread;
- realtime notification delivery;
- mention navigation;
- invitation notifications.

Current notification categories include concepts such as:

- mentions;
- channel-added events;
- workspace invitations.

The notification WebSocket also carries personalized direct-message unread updates.

---

## 15. Direct Messages

Direct conversations are global to the user rather than nested under a single active workspace.

Users can start conversations with users they are eligible to communicate with through shared workspace membership.

### One-to-one conversations

A direct conversation can contain two users.

The platform prevents unnecessary duplicate direct-pair conversations through backend constraints and creation logic.

### Group direct messages

A direct conversation can also contain multiple participants.

Group conversations support:

- multiple participants;
- optional conversation naming;
- realtime messaging;
- replies;
- edit and delete behavior;
- typing indicators;
- presence information.

### Realtime direct messaging

Direct conversations have their own authenticated WebSocket endpoint.

Realtime features include:

- create message;
- edit message;
- delete message;
- replies;
- typing indicators;
- conversation activity updates.

Only participants can connect to the conversation WebSocket or access its message history.

---

## 16. Direct-Message Unread State

Unread state is persisted on the backend.

The UI displays:

- unread count for individual conversations;
- a global indicator showing how many direct conversations currently contain unread messages.

When a direct message is created:

- unread state is updated for other participants;
- personalized conversation state is delivered through the authenticated user-level WebSocket;
- the frontend can reorder the conversation based on recent activity.

When the user opens a direct conversation, the frontend calls the backend read endpoint and clears that user's unread state.

Because unread state is stored server-side, refreshing the browser does not lose unread information.

---

## 17. User Profile and Settings

The application includes user-facing settings.

Supported areas include:

### Profile

- username;
- avatar;
- personal profile information available to the application.

### Password

Users can:

- change an existing password;
- set a password where allowed for a social-only account.

### Sign-in methods

Users can manage available authentication methods such as password, Google, and GitHub.

### Appearance

The application includes appearance-related settings such as interface font scaling.

---

## 18. Member Profile UI

Users can inspect lightweight profile information for message authors and workspace members.

The interface uses reusable avatar and presence components.

This provides a consistent identity representation across channels, member lists, direct conversations, and message author views.

---

## 19. Architecture

The application is split into frontend, backend, persistent infrastructure, and realtime infrastructure.

```text
┌─────────────────────┐
│    React + Vite     │
│       Frontend      │
└─────────┬───────────┘
          │
          │ HTTP / WebSocket
          ▼
┌─────────────────────┐
│       Daphne        │
│   Django / ASGI     │
├─────────────────────┤
│ Django REST         │
│ Django Channels     │
│ SimpleJWT           │
│ django-allauth      │
└──────┬───────┬──────┘
       │       │
       │       └───────────────┐
       ▼                       ▼
┌──────────────┐       ┌──────────────┐
│ PostgreSQL   │       │    Redis     │
│ Persistent   │       │ Channels +   │
│ data         │       │ Celery       │
└──────────────┘       └──────┬───────┘
                              │
                              ▼
                       ┌──────────────┐
                       │    Celery    │
                       │ Background   │
                       │ tasks        │
                       └──────────────┘
```

### Request flow

REST requests are processed by Django and Django REST Framework.

Realtime connections are handled by Django Channels through ASGI and Daphne.

Redis provides the Django Channels layer, Celery broker storage, and Celery result backend storage.

PostgreSQL stores the persistent application state.

---

## 20. Backend Applications

The backend is separated into domain-focused Django applications.

```text
backend/
├── accounts/
├── workspaces/
├── chat/
├── notifications/
└── config/
```

### `accounts`

Responsible for:

- custom user model;
- JWT authentication integration;
- user profile;
- avatars;
- password management;
- social authentication integration;
- sign-in methods;
- presence;
- account-related context and utilities.

### `workspaces`

Responsible for:

- workspaces;
- memberships;
- workspace roles;
- invitations;
- workspace member management;
- ownership behavior;
- workspace-related asynchronous tasks.

### `chat`

Responsible for:

- channels;
- channel memberships;
- channel messages;
- replies;
- reactions;
- direct conversations;
- direct-conversation participants;
- direct messages;
- unread direct-message state;
- channel and direct-conversation WebSocket consumers;
- message permissions and chat services.

### `notifications`

Responsible for:

- persistent notifications;
- read/unread notification state;
- realtime user-level notification WebSocket;
- asynchronous notification email tasks;
- direct-message unread update delivery.

### `config`

Responsible for:

- Django settings;
- root URL configuration;
- ASGI;
- WSGI;
- middleware composition;
- Channels routing composition;
- production-related configuration;
- healthcheck configuration.

---

## 21. Frontend Structure

The frontend is a React single-page application built with Vite.

Important source areas include:

```text
frontend/src/
├── api/
├── auth/
├── chat/
├── components/
├── directMessages/
├── notifications/
├── pages/
└── ...
```

### `api`

Contains REST client behavior and JWT refresh handling.

### `auth`

Contains authentication context and related frontend account behavior.

### `chat`

Contains authenticated WebSocket client creation and chat-related frontend utilities.

### `components`

Contains reusable collaboration UI such as:

- channel chat;
- direct-conversation chat;
- settings;
- member management;
- avatars;
- presence indicators;
- workspace and channel menus;
- creation modals;
- account controls.

### `directMessages`

Contains direct-message specific frontend logic such as user-level conversation update handling.

### `notifications`

Contains notification state and realtime notification behavior.

### `pages`

Contains top-level application pages such as the collaboration dashboard.

---

## 22. REST and WebSocket Separation

The application intentionally separates persistent resource operations from realtime transport behavior.

### REST API

REST handles operations such as:

- authentication;
- profile and settings;
- workspaces;
- workspace memberships;
- invitations;
- channels;
- channel membership;
- message history;
- direct-conversation discovery;
- direct-conversation creation;
- direct-message history;
- read state;
- notification history;
- notification read/unread state.

### WebSockets

WebSockets handle operations such as:

- channel message creation;
- channel message editing;
- channel message deletion;
- channel reactions;
- channel typing indicators;
- direct-message creation;
- direct-message editing;
- direct-message deletion;
- direct-conversation typing indicators;
- realtime notifications;
- realtime unread-state synchronization;
- realtime presence changes.

For the exact event protocol, see:

[`websocket.md`](websocket.md)

---

## 23. Database and Query Design

PostgreSQL is the primary persistent data store.

The project includes query-performance considerations such as:

- `select_related()` usage;
- relation prefetching where appropriate;
- cursor pagination;
- indexes matching important query patterns;
- functional indexes for case-insensitive invitation email lookup;
- query-count regression tests.

Examples of indexed or performance-sensitive areas include:

- channel message history;
- notifications;
- workspace invitations;
- direct conversations;
- membership lookups.

---

## 24. Redis and Celery

Redis is used for two major responsibilities.

### Django Channels

Redis provides the channel layer used for communication between WebSocket connections and application processes.

### Celery

Redis is also used as the Celery broker and result backend.

Celery handles asynchronous tasks such as workspace invitation email delivery and notification email delivery.

---

## 25. Logging

Django logging is configured through environment-aware settings.

The application logs important operational events such as:

- WebSocket connections and disconnections;
- rejected realtime events;
- channel joins and leaves;
- message create/edit/delete actions;
- asynchronous task results.

The application is designed not to intentionally log sensitive values such as passwords, JWT tokens, OAuth client secrets, database passwords, or session cookies.

Message bodies and email addresses are also intentionally avoided in application-domain logging where possible.

---

## 26. API Documentation

REST API documentation is generated with `drf-spectacular`.

Local Swagger UI:

```text
http://localhost:8000/api/docs/
```

OpenAPI schema:

```text
http://localhost:8000/api/schema/
```

The schema can be validated from the command line:

```bash
docker compose exec web python manage.py spectacular --validate --fail-on-warn --file /tmp/schema.yml
```

---

## 27. WebSocket Documentation

The complete WebSocket protocol is maintained separately:

[`websocket.md`](websocket.md)

It documents:

- JWT WebSocket authentication;
- channel WebSocket events;
- direct-conversation WebSocket events;
- notification WebSocket events;
- unread-state updates;
- presence events;
- close codes;
- realtime error events;
- transport responsibilities.

---

## 28. Production Deployment Documentation

Production deployment is documented separately:

[`deployment.md`](deployment.md)

It includes:

- production architecture;
- Docker Compose;
- Nginx;
- environment variables;
- domain and DNS setup;
- HTTPS;
- OAuth callbacks;
- firewall rules;
- migrations;
- static files;
- health checks;
- backups;
- update procedure;
- rollback preparation;
- production smoke tests.

---

# Local Installation

## 29. Requirements

Recommended local requirements:

- Docker;
- Docker Compose;
- Node.js 22+;
- npm;
- Git.

---

## 30. Clone the Repository

```bash
git clone https://github.com/Eugene-Plitka/django-realtime-collaboration.git
cd django-realtime-collaboration
```

---

## 31. Create the Local Environment File

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

On Linux/macOS:

```bash
cp .env.example .env
```

At minimum, configure values such as:

```env
DJANGO_SECRET_KEY=change-me
DJANGO_DEBUG=True

POSTGRES_DB=collaboration
POSTGRES_USER=collaboration
POSTGRES_PASSWORD=change-me
POSTGRES_HOST=db
POSTGRES_PORT=5432

REDIS_HOST=redis
REDIS_PORT=6379
```

Local defaults are expected to include values similar to:

```env
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
CSRF_TRUSTED_ORIGINS=http://localhost:5173
```

Google and GitHub OAuth credentials are optional for local development.

---

## 32. Build and Start Backend Services

From the project root:

```bash
docker compose build
docker compose up -d
```

The development stack includes:

- PostgreSQL;
- Redis;
- Django / Daphne;
- Celery worker.

Check container state:

```bash
docker compose ps
```

---

## 33. Apply Database Migrations

```bash
docker compose exec web python manage.py migrate
```

Migrations should be committed to the repository.

Do not create production migrations directly on the production server.

---

## 34. Create an Admin User

If Django Admin access is needed:

```bash
docker compose exec web python manage.py createsuperuser
```

---

## 35. Install Frontend Dependencies

```bash
cd frontend
npm ci
```

---

## 36. Configure Frontend Environment

Create:

```text
frontend/.env
```

For the default local backend:

```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## 37. Start the Frontend

From `frontend/`:

```bash
npm run dev
```

The development frontend runs on:

```text
http://localhost:5173
```

---

## 38. Local URLs

Default local URLs:

```text
Frontend:  http://localhost:5173
Backend:   http://localhost:8000
Swagger:   http://localhost:8000/api/docs/
Schema:    http://localhost:8000/api/schema/
Admin:     http://localhost:8000/admin/
Health:    http://localhost:8000/health/
```

---

## 39. Common Development Commands

Start backend services:

```bash
docker compose up -d
```

Stop backend services:

```bash
docker compose down
```

View backend logs:

```bash
docker compose logs -f web
```

View Celery logs:

```bash
docker compose logs -f celery
```

Restart Django / Daphne:

```bash
docker compose restart web
```

Run frontend:

```bash
cd frontend
npm run dev
```

Build frontend:

```bash
cd frontend
npm run build
```

---

## 40. Backend Validation

Django system check:

```bash
docker compose exec web python manage.py check
```

Check for missing migrations:

```bash
docker compose exec web python manage.py makemigrations --check
```

Validate OpenAPI:

```bash
docker compose exec web python manage.py spectacular --validate --fail-on-warn --file /tmp/schema.yml
```

Run all backend tests:

```bash
docker compose exec web python manage.py test
```

Run individual Django application tests:

```bash
docker compose exec web python manage.py test accounts
docker compose exec web python manage.py test workspaces
docker compose exec web python manage.py test chat
docker compose exec web python manage.py test notifications
```

---

## 41. Frontend Validation

From `frontend/`:

```bash
npm run lint
npm run build
```

---

## 42. Continuous Integration

GitHub Actions runs backend and frontend checks for pushes and pull requests targeting `main`.

The backend CI verifies areas such as:

- Django checks;
- migration consistency;
- OpenAPI validation;
- complete Django test suite.

The frontend CI verifies:

- dependency installation;
- lint;
- production build.

Workflow configuration is stored in:

```text
.github/workflows/ci.yml
```

---

## 43. Production-Like Local Environment

The project also includes a production-like local environment used to validate the production request flow before VPS deployment.

The production-like environment includes:

- Nginx;
- React production build;
- Django / Daphne;
- PostgreSQL;
- Redis;
- Celery;
- Django static files;
- WebSocket proxying;
- optional Google and GitHub OAuth.

The full production process is described in:

[`deployment.md`](deployment.md)

---

## 44. Health Check

The backend exposes:

```text
GET /health/
```

A healthy response indicates that the application and database are available.

This endpoint is also used by Docker health checks.

---

## 45. Current Scope

The current project scope includes the implemented collaboration platform features described in this document.

File attachments are intentionally not part of the current deployed scope.

The project is maintained as a stable portfolio application rather than an open-ended roadmap of unfinished features.
