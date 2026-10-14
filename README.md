# django-realtime-collaboration

A full-stack real-time collaboration platform inspired by Slack, Discord, and Microsoft Teams.

This project was built as a portfolio application to demonstrate practical backend and frontend engineering skills: Django REST APIs, WebSocket communication, authentication and authorization, PostgreSQL data modeling, Redis, Celery, Docker, testing, CI, production-oriented configuration, and a React single-page application.

## Highlights

- Django + Django REST Framework backend
- React + Vite frontend
- PostgreSQL database
- Redis for Django Channels and Celery
- WebSocket-based realtime communication
- JWT authentication
- Optional Google and GitHub social login with `django-allauth`
- Workspace and channel permissions
- Public and private channels
- Direct messages and group direct messages
- Realtime message create, edit, delete, replies, reactions, typing indicators, and presence
- Mentions and realtime notifications
- Persistent unread state for direct conversations
- User profile, avatar, password, appearance, and sign-in settings
- OpenAPI / Swagger documentation
- Automated backend and frontend CI
- Docker-based local and production-like environments

## What This Project Demonstrates

The project is intended to show experience with:

- designing relational data models and permissions;
- separating REST responsibilities from realtime WebSocket responsibilities;
- building authenticated WebSocket connections with Django Channels;
- implementing role-based access control;
- handling asynchronous work with Celery;
- using PostgreSQL indexes and query optimization;
- writing backend tests for API, permissions, WebSocket behavior, and query counts;
- building a reusable React interface for a realtime collaboration product;
- handling JWT refresh and authenticated frontend API access;
- integrating Google and GitHub OAuth;
- preparing an application for Docker-based production deployment;
- documenting API, WebSocket, and deployment behavior.

## Main Capabilities

CollabSpace supports:

- email/password and social authentication;
- workspaces with role-based permissions;
- workspace invitations and member management;
- public and private channels;
- realtime channel messaging;
- replies, mentions, emoji reactions, and typing indicators;
- online/presence status;
- persistent notifications;
- direct messages and group direct messages;
- direct-message unread counters;
- user profile and sign-in settings;
- Docker-based development and production-like environments.

For the complete feature list, architecture, role behavior, backend application structure, frontend structure, and detailed local setup instructions, see:

[`docs/project-overview.md`](docs/project-overview.md)

## Technology Stack

### Backend

- Python
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
- Pillow

### Frontend

- React
- React Router
- Vite
- Oxlint

### Infrastructure and Tooling

- Docker
- Docker Compose
- Nginx
- GitHub Actions
- OpenAPI
- Swagger UI

## Local Development

Clone the repository:

```bash
git clone https://github.com/Eugene-Plitka/django-realtime-collaboration.git
cd django-realtime-collaboration
```

Create the local environment file:

```powershell
Copy-Item .env.example .env
```

Start backend services:

```bash
docker compose up -d
```

Apply migrations:

```bash
docker compose exec web python manage.py migrate
```

Install and start the frontend:

```bash
cd frontend
npm ci
npm run dev
```

Default local URLs:

```text
Frontend:  http://localhost:5173
Backend:   http://localhost:8000
Swagger:   http://localhost:8000/api/docs/
Admin:     http://localhost:8000/admin/
Health:    http://localhost:8000/health/
```

For the full installation guide and environment configuration, see:

[`docs/project-overview.md`](docs/project-overview.md)

## Documentation

- [Project overview, architecture, complete feature list, and local setup](docs/project-overview.md)
- [WebSocket protocol](docs/websocket.md)
- [Production deployment guide](docs/deployment.md)

## Testing

Backend checks and tests:

```bash
docker compose exec web python manage.py check
docker compose exec web python manage.py makemigrations --check
docker compose exec web python manage.py spectacular --validate --fail-on-warn
docker compose exec web python manage.py test
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

GitHub Actions runs backend and frontend validation automatically on pushes and pull requests targeting `main`.

## API Documentation

Swagger UI:

```text
http://localhost:8000/api/docs/
```

OpenAPI schema:

```text
http://localhost:8000/api/schema/
```

The WebSocket protocol is documented separately in:

[`docs/websocket.md`](docs/websocket.md)

## Production

The repository includes production-oriented configuration such as:

- environment-based Django settings;
- production Docker Compose configuration;
- Nginx;
- secure cookie and HTTPS settings;
- health checks;
- static-file handling;
- logging;
- OpenAPI validation;
- automated CI.

The full deployment process is documented in:

[`docs/deployment.md`](docs/deployment.md)

## License

This project is intended to be distributed under the MIT License.

See the [`LICENSE`](LICENSE) file for the full license text.
