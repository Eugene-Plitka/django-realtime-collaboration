# django-realtime-collaboration

A full-stack real-time collaboration platform inspired by Slack, Discord, and Microsoft Teams.

The project combines a Django REST API with Django Channels WebSockets, PostgreSQL, Redis, Celery, JWT authentication, and a React/Vite single-page application. It is built as a portfolio project with an emphasis on backend architecture, permissions, realtime communication, testing, performance, documentation, and production readiness.

## About

`django-realtime-collaboration` is a workspace-based collaboration application where users can create and join workspaces, communicate in public and private channels, manage members and invitations, exchange realtime messages, reply to messages, use mentions and typing indicators, and receive realtime notifications.

The backend separates persistent operations from realtime communication:

- REST API handles authentication, workspace and channel management, memberships, invitations, message history, and notification state.
- WebSockets handle realtime message creation, editing, deletion, typing events, and notification delivery.
- PostgreSQL stores persistent application data.
- Redis provides the Django Channels layer and Celery broker/backend.
- Celery handles asynchronous email tasks.
- React + Vite provides the frontend SPA.

## Features

### Authentication

- Email and password registration.
- JWT access and refresh tokens.
- Refresh token rotation.
- Refresh token blacklist on rotation/logout.
- Authenticated `/me` endpoint.
- JWT-authenticated WebSocket connections.
- Optional Google and GitHub social-login integration through `django-allauth`.
- Social-login credentials are environment-based and can remain disabled when not configured.

### Workspaces

- Create and list workspaces.
- Workspace detail access restricted to members.
- Workspace roles:
  - `OWNER`
  - `ADMIN`
  - `MEMBER`
  - `GUEST`
- Add and remove workspace members.
- Change member roles.
- Transfer workspace ownership.
- Leave a workspace.
- Role-aware permission checks.

### Workspace Invitations

- Invite users by email.
- Invitations are bound to the invited email address.
- Pending, accepted, expired, and cancelled invitation states.
- Invitation expiration support.
- Accept and cancel invitations.
- List pending invitations for the authenticated user.
- Asynchronous invitation email delivery with Celery.

### Channels

- Public and private channels.
- Mandatory `#general` channel.
- Public-channel discovery for eligible workspace roles.
- Explicit public-channel join.
- Leave channels.
- Private-channel membership management.
- OWNER/ADMIN channel management.
- Edit channel name and description.
- Delete non-general channels.
- Protected `#general` behavior.

### Realtime Messaging

- WebSocket-based channel communication.
- Create messages in realtime.
- Edit messages in realtime.
- Soft-delete messages in realtime.
- Message history through REST.
- Cursor pagination for message history.
- Permission-aware edit/delete rules.
- Realtime synchronization between connected clients.

### Replies

- Reply to another message in the same channel.
- Reply snapshots in REST and WebSocket payloads.
- Deleted reply targets remain represented without exposing deleted text.
- Frontend reply preview and source-message navigation.

### Mentions

- `@username` mention detection.
- Realtime notification creation for mentioned channel members.
- Mention autocomplete in the frontend.
- Mention notifications are persisted and delivered through WebSocket.

### Typing Indicators

- `typing.start` and `typing.stop` WebSocket events.
- Typing events are broadcast to other connected channel members.
- The sender does not receive their own typing event.

### Notifications

- Persistent notification model.
- Notification types:
  - mentions;
  - channel-added events;
  - workspace invitations.
- Realtime per-user notification WebSocket.
- REST notification history.
- Mark notifications as read/unread.
- Frontend notification and invitation popovers.

### Performance and Quality

- `select_related()` usage for common relation-heavy queries.
- Query-count regression tests for important list/history endpoints.
- Database indexes aligned with real query patterns.
- Functional PostgreSQL index for case-insensitive invitation email lookup.
- Composite indexes for message history, notifications, and invitations.
- Application logging for important realtime and domain events.
- No message bodies, tokens, or email addresses are intentionally written to application logs.

## Architecture

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

### Backend applications

```text
backend/
├── accounts/       Authentication, custom user, JWT/social auth integration
├── workspaces/     Workspaces, memberships, roles, invitations
├── chat/           Channels, channel memberships, messages, WebSockets
├── notifications/  Persistent and realtime notifications
└── config/         Django settings, ASGI, root URLs, healthcheck
```

### Frontend

```text
frontend/
└── src/
    ├── api/         REST client and JWT refresh handling
    ├── chat/        WebSocket client
    ├── components/  Collaboration UI components
    └── ...
```

## Tech Stack

### Backend

- Python 3.14
- Django
- Django REST Framework
- SimpleJWT
- Django Channels
- Daphne
- PostgreSQL
- Redis
- Channels Redis
- Celery
- django-allauth
- django-cors-headers
- drf-spectacular

### Frontend

- React
- React Router
- Vite
- Oxlint

### Infrastructure and Tooling

- Docker
- Docker Compose
- GitHub Actions
- OpenAPI
- Swagger UI

## Installation

### Requirements

For the recommended local setup:

- Docker
- Docker Compose
- Node.js 22+
- npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/Eugene-Plitka/django-realtime-collaboration.git
cd django-realtime-collaboration
```

### 2. Create the environment file

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

On Linux/macOS:

```bash
cp .env.example .env
```

Set at least the following values in `.env`:

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

For local development, the defaults in `.env.example` already expect:

```env
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
CSRF_TRUSTED_ORIGINS=http://localhost:5173
```

Google and GitHub OAuth credentials are optional.

### 3. Build and start backend services

```bash
docker compose build
docker compose up -d
```

The Compose stack starts:

- PostgreSQL;
- Redis;
- Django/Daphne;
- Celery worker.

### 4. Apply migrations

```bash
docker compose exec web python manage.py migrate
```

### 5. Create a Django admin user if needed

```bash
docker compose exec web python manage.py createsuperuser
```

### 6. Install frontend dependencies

```bash
cd frontend
npm ci
```

### 7. Configure the frontend

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

### 8. Start the frontend

```bash
npm run dev
```

The local application is then available at:

```text
Frontend:  http://localhost:5173
Backend:   http://localhost:8000
Swagger:   http://localhost:8000/api/docs/
Admin:     http://localhost:8000/admin/
Health:    http://localhost:8000/health/
```

## Development

### Start backend services

```bash
docker compose up -d
```

### Stop backend services

```bash
docker compose down
```

### View backend logs

```bash
docker compose logs -f web
```

### View Celery logs

```bash
docker compose logs -f celery
```

### Restart Django/Daphne after Python changes when required

The development Compose configuration runs Daphne directly and does not use Django's autoreloader.

```bash
docker compose restart web
```

### Run the frontend

```bash
cd frontend
npm run dev
```

### Frontend production build

```bash
cd frontend
npm run build
```

## Testing

### Django system check

```bash
docker compose exec web python manage.py check
```

### Check for missing migrations

```bash
docker compose exec web python manage.py makemigrations --check
```

### Run the complete backend test suite

```bash
docker compose exec web python manage.py test
```

Individual backend test modules can also be run separately:

```bash
docker compose exec web python manage.py test accounts
docker compose exec web python manage.py test workspaces
docker compose exec web python manage.py test chat
docker compose exec web python manage.py test notifications
```

### Validate OpenAPI schema

```bash
docker compose exec web python manage.py spectacular --validate --fail-on-warn --file /tmp/schema.yml
```

### Frontend lint

```bash
cd frontend
npm run lint
```

### Frontend build

```bash
cd frontend
npm run build
```

## Continuous Integration

GitHub Actions runs automatically on pushes and pull requests targeting `main`.

The CI workflow contains independent backend and frontend jobs.

### Backend CI

The backend job starts PostgreSQL and Redis services and runs:

```text
Django system checks
Migration consistency check
OpenAPI validation
Complete Django test suite
```

### Frontend CI

The frontend job runs:

```text
npm ci
npm run lint
npm run build
```

CI configuration:

```text
.github/workflows/ci.yml
```

## API Documentation

The REST API is described with OpenAPI using `drf-spectacular`.

### Swagger UI

```text
http://localhost:8000/api/docs/
```

Swagger UI supports JWT Bearer authentication through the **Authorize** button.

### OpenAPI schema

```text
http://localhost:8000/api/schema/
```

The schema can also be generated and validated from the command line:

```bash
docker compose exec web python manage.py spectacular --validate --fail-on-warn --file /tmp/schema.yml
```

### Main REST areas

```text
/api/auth/                   Authentication and JWT
/api/workspaces/             Workspaces, members, invitations
/api/workspaces/...          Workspace-scoped operations
/api/channels/...            Channels and channel memberships
/api/channels/.../messages/  Message history
/api/notifications/          Notification history and state
```

The exact request and response schemas are available in Swagger UI.

## WebSocket Protocol

The project currently exposes two authenticated WebSocket endpoints.

### Channel socket

```text
/ws/channels/{channel_id}/
```

Used for:

- message creation;
- message editing;
- message deletion;
- replies;
- typing indicators;
- realtime message broadcasts.

### Notification socket

```text
/ws/notifications/
```

Used for:

- realtime notification delivery to the authenticated user.

### JWT authentication

WebSocket authentication is passed through the `Sec-WebSocket-Protocol` header using:

```text
jwt.<access_token>
```

Example:

```javascript
const socket = new WebSocket(
  "ws://localhost:8000/ws/channels/1/",
  [`jwt.${accessToken}`],
)
```

The complete WebSocket event protocol, payload examples, error codes, and connection lifecycle are documented in:

```text
docs/websocket.md
```

## Healthcheck

The backend exposes:

```text
GET /health/
```

A successful response:

```json
{
  "status": "ok",
  "database": "ok"
}
```

The Docker `web` service also uses this endpoint for its container healthcheck.

## Configuration

Application configuration is environment-based.

Important variables are documented in:

```text
.env.example
```

Configuration groups include:

- Django secret/debug settings;
- allowed hosts;
- CORS and CSRF origins;
- HTTPS/security flags;
- PostgreSQL;
- Redis;
- JWT lifetimes;
- Celery;
- email backend;
- logging level;
- optional Google/GitHub OAuth credentials.

Do not commit real production secrets to the repository.

## Logging

Application logging is configured through Django's `LOGGING` setting.

The application records important events such as:

- WebSocket connections and disconnections;
- rejected WebSocket events;
- channel joins/leaves;
- message creation/edit/delete;
- asynchronous email task results.

The application avoids intentionally logging message text, JWT tokens, or user email addresses in these domain logs.

The log level can be configured with:

```env
DJANGO_LOG_LEVEL=INFO
```

## Database Performance

The project includes database-query optimizations and regression coverage.

Examples include:

- `select_related()` for relation-heavy serializers;
- cursor-friendly message history ordering;
- `(channel, -created_at)` message index;
- `(user, -created_at)` notification index;
- workspace invitation indexes;
- functional `LOWER(email)` invitation lookup index;
- query-count tests protecting important endpoints from N+1 regressions.

## Production Readiness

The project already includes part of the production-readiness foundation:

- environment-based Django configuration;
- configurable allowed hosts;
- configurable CORS and CSRF origins;
- secure cookie/HTTPS flags;
- HSTS settings;
- reverse-proxy HTTPS awareness;
- `STATIC_ROOT`;
- backend healthcheck;
- Docker healthcheck;
- structured application logging;
- OpenAPI validation;
- automated CI.

The final production deployment configuration is intentionally handled as a separate project phase.

A live VPS deployment is not assumed by this README.

## Security Notes

Production deployments should use:

```env
DJANGO_DEBUG=False
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SESSION_COOKIE_SECURE=True
DJANGO_CSRF_COOKIE_SECURE=True
```

`DJANGO_SECRET_KEY` and database/OAuth credentials must be unique production secrets.

HSTS should only be enabled after HTTPS and reverse-proxy configuration have been verified.

## Current Project Status

The current stable scope includes:

- authentication;
- workspaces and roles;
- invitations;
- public/private channels;
- channel memberships;
- realtime chat;
- message edit/delete;
- replies;
- mentions;
- typing indicators;
- notifications;
- REST/OpenAPI documentation;
- WebSocket documentation;
- tests and query-performance coverage;
- database index audit;
- application logging;
- CI;
- production-readiness groundwork.

The actual VPS deployment is intentionally deferred until the deployment phase is started.

## Roadmap

Possible post-MVP extensions include:

- emoji reactions;
- direct messages;
- file attachments;
- message search and PostgreSQL full-text search;
- online presence;
- notification preferences;
- Celery Beat housekeeping jobs;
- richer message threads;
- pinned messages;
- channel mute;
- unread state and last-read positions;
- user avatars and custom status;
- workspace settings;
- administrative audit log;
- rate limiting;
- richer notification center;
- frontend virtualization for large message histories.

These features are intentionally considered post-MVP so the current project can remain stable and deployable before additional scope is introduced.

## License

No license has been specified for this repository yet.
