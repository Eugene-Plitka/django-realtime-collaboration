# CollabSpace Deployment Guide

## Purpose

This document describes the production deployment process for the CollabSpace project.

The application stack consists of:

- React + Vite frontend
- Nginx
- Django + Django REST Framework
- Daphne
- Django Channels
- PostgreSQL
- Redis
- Celery
- Google OAuth
- GitHub OAuth
- Docker Compose

The local production-like environment uses:

```text
http://localhost:8080
```

The real production environment must use a real domain and HTTPS.

---

# 1. Production architecture

Expected production request flow:

```text
Browser
   |
   v
HTTPS
   |
   v
Nginx
   |
   +--> React SPA
   |
   +--> /api/       -> Django / Daphne
   |
   +--> /accounts/  -> Django / django-allauth
   |
   +--> /admin/     -> Django
   |
   +--> /health/    -> Django
   |
   +--> /ws/        -> Django Channels / WebSocket
   |
   +--> /static/    -> collected Django static files
```

Internal Docker services:

```text
frontend
web
celery
db
redis
```

Only the public HTTP/HTTPS entry point should be exposed to the Internet.

PostgreSQL, Redis and Daphne should remain accessible only inside the Docker network.

---

# 2. Files used for production

Production configuration uses:

```text
docker-compose.prod.yml
.env.production
frontend/Dockerfile
frontend/nginx.conf
Dockerfile
```

The file:

```text
.env.production
```

must never be committed to Git.

The repository contains:

```text
.env.production.example
```

as a template.

---

# 3. Production environment variables

Create the real production file:

```powershell
Copy-Item .env.production.example .env.production
```

Then fill in the real values.

Example for a domain:

```text
collabspace.example.com
```

Production environment should look conceptually like this:

```env
DJANGO_SECRET_KEY=<strong-random-secret>

DJANGO_DEBUG=False

DJANGO_ALLOWED_HOSTS=collabspace.example.com
CORS_ALLOWED_ORIGINS=https://collabspace.example.com
CSRF_TRUSTED_ORIGINS=https://collabspace.example.com

DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SESSION_COOKIE_SECURE=True
DJANGO_CSRF_COOKIE_SECURE=True

DJANGO_SECURE_HSTS_SECONDS=3600
DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=False
DJANGO_SECURE_HSTS_PRELOAD=False

DJANGO_LOG_LEVEL=INFO

POSTGRES_DB=<database-name>
POSTGRES_USER=<database-user>
POSTGRES_PASSWORD=<strong-database-password>
POSTGRES_HOST=db
POSTGRES_PORT=5432

REDIS_HOST=redis
REDIS_PORT=6379

JWT_ACCESS_MINUTES=15
JWT_REFRESH_DAYS=7

CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

EMAIL_BACKEND=<production-email-backend>
DEFAULT_FROM_EMAIL=noreply@collabspace.example.com

GOOGLE_OAUTH_CLIENT_ID=<google-client-id>
GOOGLE_OAUTH_CLIENT_SECRET=<google-client-secret>

GITHUB_OAUTH_CLIENT_ID=<github-client-id>
GITHUB_OAUTH_CLIENT_SECRET=<github-client-secret>

FRONTEND_BASE_URL=https://collabspace.example.com
SOCIAL_LOGIN_REDIRECT_URL=https://collabspace.example.com/auth/social/callback
```

Do not copy the example domain literally.

Use the real production domain.

---

# 4. Generate a Django secret key

Use a strong random key.

One possible command:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Put the result into:

```env
DJANGO_SECRET_KEY=
```

Never commit or share the production key.

---

# 5. PostgreSQL credentials

Use strong unique values for:

```env
POSTGRES_DB=
POSTGRES_USER=
POSTGRES_PASSWORD=
```

Example structure:

```env
POSTGRES_DB=collabspace
POSTGRES_USER=collabspace_user
POSTGRES_PASSWORD=<strong-random-password>
```

Do not expose PostgreSQL port `5432` publicly.

The application connects using:

```env
POSTGRES_HOST=db
POSTGRES_PORT=5432
```

---

# 6. Redis

Redis remains internal to Docker.

Production values:

```env
REDIS_HOST=redis
REDIS_PORT=6379

CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2
```

Do not expose Redis port `6379` publicly.

---

# 7. Google OAuth production configuration

Open the Google Cloud Console OAuth client used by CollabSpace.

Add the production redirect URI:

```text
https://collabspace.example.com/accounts/google/login/callback/
```

Replace the example domain with the real domain.

Keep development redirect URIs only if local development still needs them.

Local development callback:

```text
http://localhost:8000/accounts/google/login/callback/
```

Local production-like callback:

```text
http://localhost:8080/accounts/google/login/callback/
```

Production callback:

```text
https://collabspace.example.com/accounts/google/login/callback/
```

The Django-to-React redirect is separate:

```text
https://collabspace.example.com/auth/social/callback
```

That value belongs in:

```env
SOCIAL_LOGIN_REDIRECT_URL=
```

---

# 8. GitHub OAuth production configuration

The production GitHub callback must be:

```text
https://collabspace.example.com/accounts/github/login/callback/
```

Replace the example domain with the real domain.

For a clean production setup, using a separate GitHub OAuth App for production is recommended.

Production credentials go into:

```env
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
```

Development credentials should remain separate from production credentials.

---

# 9. Frontend production URL

Production:

```env
FRONTEND_BASE_URL=https://collabspace.example.com
```

This is used by Django templates such as:

```text
Back to sign in
Cancel and return to sign in
```

The social authentication final redirect is:

```env
SOCIAL_LOGIN_REDIRECT_URL=https://collabspace.example.com/auth/social/callback
```

---

# 10. HTTPS requirements

Real production must use HTTPS.

When HTTPS is active:

```env
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SESSION_COOKIE_SECURE=True
DJANGO_CSRF_COOKIE_SECURE=True
```

Django already trusts the reverse proxy header:

```text
X-Forwarded-Proto
```

The reverse proxy must send:

```text
X-Forwarded-Proto: https
```

for HTTPS requests.

---

# 11. HSTS

Start carefully.

Initial production value:

```env
DJANGO_SECURE_HSTS_SECONDS=3600
```

After the domain and HTTPS configuration have been verified for a reasonable period, this can be increased to:

```env
DJANGO_SECURE_HSTS_SECONDS=31536000
```

Do not enable the following immediately:

```env
DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=True
DJANGO_SECURE_HSTS_PRELOAD=True
```

Only enable them after confirming that all required subdomains permanently support HTTPS.

HSTS configuration should be treated as difficult to reverse once browsers cache it.

---

# 12. DNS

Before starting production deployment, create DNS records for the real domain.

Typical configuration:

```text
A
collabspace.example.com
<VPS IPv4 address>
```

If IPv6 is configured:

```text
AAAA
collabspace.example.com
<VPS IPv6 address>
```

Wait until DNS resolves to the correct VPS before issuing the final HTTPS certificate.

---

# 13. Firewall

Typical public ports:

```text
22/tcp
80/tcp
443/tcp
```

Meaning:

```text
22   SSH
80   HTTP
443  HTTPS
```

Do not expose:

```text
5432 PostgreSQL
6379 Redis
8000 Daphne
```

to the public Internet.

If the SSH port is changed, allow that port instead of `22`.

---

# 14. Build the production containers

From the project root:

```powershell
docker compose -f docker-compose.prod.yml build
```

Check the resolved Compose configuration:

```powershell
docker compose -f docker-compose.prod.yml config
```

Never continue if Compose reports configuration errors.

---

# 15. Start PostgreSQL and Redis first

```powershell
docker compose -f docker-compose.prod.yml up -d db redis
```

Check:

```powershell
docker compose -f docker-compose.prod.yml ps
```

Expected:

```text
db       healthy
redis    healthy
```

---

# 16. Run migrations

Before starting the full application:

```powershell
docker compose -f docker-compose.prod.yml run --rm web python manage.py migrate
```

Do not use:

```text
makemigrations
```

on the production server.

Migrations should already be committed to Git before deployment.

---

# 17. Check Django configuration

Run:

```powershell
docker compose -f docker-compose.prod.yml run --rm web python manage.py check
```

Then:

```powershell
docker compose -f docker-compose.prod.yml run --rm web python manage.py check --deploy
```

With the real HTTPS production environment, the deployment check should not report the warnings that were intentionally present in the local HTTP production-like environment.

If warnings remain, review them before exposing the application publicly.

---

# 18. Validate OpenAPI schema

Run:

```powershell
docker compose -f docker-compose.prod.yml run --rm web python manage.py spectacular --validate --fail-on-warn --file /tmp/schema.yml
```

Expected:

```text
0 warnings
0 errors
```

---

# 19. Run tests before deployment

Backend:

```powershell
docker compose -f docker-compose.prod.yml run --rm web python manage.py test
```

Frontend:

```powershell
cd frontend
npm ci
npm run lint
npm run build
cd ..
```

Do not deploy a version with failing tests, lint or frontend build.

---

# 20. Static files

The production `web` service runs:

```text
python manage.py collectstatic --noinput
```

before starting Daphne.

Static files are written into the shared volume:

```text
static_data
```

and mounted into Nginx at:

```text
/var/www/static
```

Verify:

```powershell
docker compose -f docker-compose.prod.yml exec web python manage.py findstatic admin/css/base.css
```

Then verify that Django Admin loads with CSS through the public domain:

```text
https://collabspace.example.com/admin/
```

---

# 21. Start the complete application

```powershell
docker compose -f docker-compose.prod.yml up -d
```

Check:

```powershell
docker compose -f docker-compose.prod.yml ps
```

Expected state:

```text
db         healthy
redis      healthy
web        healthy
frontend   healthy
celery     Up
```

---

# 22. Create an admin user

Only if a production superuser does not already exist:

```powershell
docker compose -f docker-compose.prod.yml exec web python manage.py createsuperuser
```

Use a unique production administrator account.

Do not reuse weak development credentials.

---

# 23. Health check

Public health endpoint:

```text
https://collabspace.example.com/health/
```

The response must indicate a healthy application and database.

Container status:

```powershell
docker compose -f docker-compose.prod.yml ps
```

Backend logs:

```powershell
docker compose -f docker-compose.prod.yml logs web --tail=100
```

Nginx/frontend logs:

```powershell
docker compose -f docker-compose.prod.yml logs frontend --tail=100
```

Celery logs:

```powershell
docker compose -f docker-compose.prod.yml logs celery --tail=100
```

---

# 24. Production smoke tests

After every deployment verify the following.

## Authentication

- email/password login works
- logout works
- JWT refresh works
- Google login works
- GitHub login works
- social signup works
- username selection works
- Sign-in methods modal works
- Google account connect works
- GitHub account connect works
- disconnect protection works
- social-only user can set a password
- password login works after setting a password

## Workspace

- workspace list loads
- workspace creation works
- workspace members load
- invitations load
- invitation acceptance works

## Channels

- public channels load
- private channels load
- public channel join works
- channel creation works
- channel editing works
- channel deletion works
- channel member management works

## Messaging

- message history loads
- message creation works
- message editing works
- message deletion works
- replies work
- mentions work
- typing indicator works

## Realtime

Open the same workspace in two browser sessions.

Verify:

- new message appears without refresh
- edited message updates without refresh
- deleted message updates without refresh
- typing events appear
- notifications appear
- WebSocket reconnect works

## Notifications

- notification list loads
- unread count works
- mark read works
- mark unread works
- mention notification navigation works

## Admin and static

Verify:

```text
https://collabspace.example.com/admin/
```

The page must load with styles.

---

# 25. WebSocket production check

The browser should connect using:

```text
wss://collabspace.example.com/ws/...
```

not:

```text
ws://
```

when the site is loaded through HTTPS.

The frontend derives the WebSocket protocol automatically from the current site protocol.

Check browser DevTools:

```text
Network -> WS
```

Expected WebSocket status:

```text
101 Switching Protocols
```

---

# 26. Nginx and backend container recreation

The Nginx configuration uses Docker DNS resolution for the backend service.

This prevents the previously observed scenario:

```text
web container recreated
-> new Docker IP
-> nginx keeps old IP
-> 502 Bad Gateway
```

Test after deployment:

```powershell
docker compose -f docker-compose.prod.yml up -d --force-recreate web
```

Wait until:

```powershell
docker compose -f docker-compose.prod.yml ps
```

shows:

```text
web healthy
```

Then verify the application again without recreating the frontend container.

The login page and API requests must continue to work.

---

# 27. Logs

Follow all application logs:

```powershell
docker compose -f docker-compose.prod.yml logs -f
```

Backend only:

```powershell
docker compose -f docker-compose.prod.yml logs -f web
```

Celery:

```powershell
docker compose -f docker-compose.prod.yml logs -f celery
```

Nginx:

```powershell
docker compose -f docker-compose.prod.yml logs -f frontend
```

Database:

```powershell
docker compose -f docker-compose.prod.yml logs -f db
```

Redis:

```powershell
docker compose -f docker-compose.prod.yml logs -f redis
```

Application logs must never intentionally log:

- passwords
- JWT tokens
- OAuth secrets
- session cookies
- database passwords

---

# 28. PostgreSQL backup

A production database backup strategy is required.

Manual logical backup example:

```powershell
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U <POSTGRES_USER> <POSTGRES_DB> > backup.sql
```

The values must match `.env.production`.

Example restoration command:

```powershell
Get-Content backup.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U <POSTGRES_USER> <POSTGRES_DB>
```

Always test the restore procedure before relying on backups.

Do not keep the only backup on the same VPS as the live database.

Use off-server backup storage.

---

# 29. Backup policy

Recommended minimum policy for a portfolio production deployment:

```text
daily database backup
multiple recent backup generations
at least one off-server copy
periodic restore test
```

Also back up any future user-uploaded media if file uploads are added later.

---

# 30. Updating production

Typical update sequence:

```powershell
git pull
```

Review changes.

Then:

```powershell
docker compose -f docker-compose.prod.yml build
```

Run migrations:

```powershell
docker compose -f docker-compose.prod.yml run --rm web python manage.py migrate
```

Run checks:

```powershell
docker compose -f docker-compose.prod.yml run --rm web python manage.py check
```

Start updated containers:

```powershell
docker compose -f docker-compose.prod.yml up -d
```

Verify:

```powershell
docker compose -f docker-compose.prod.yml ps
```

Then perform the smoke tests.

---

# 31. Before every production update

Recommended sequence:

```text
1. Ensure main branch is clean.
2. Ensure CI is green.
3. Create a PostgreSQL backup.
4. Pull the new code.
5. Build containers.
6. Run migrations.
7. Run Django checks.
8. Start updated services.
9. Verify container health.
10. Perform smoke tests.
```

---

# 32. Rollback preparation

Before a risky release record the current Git commit:

```powershell
git rev-parse HEAD
```

Keep a database backup made immediately before deployment.

If application code must be rolled back:

```powershell
git checkout <previous-good-commit>
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Database rollback is more complicated.

Django migrations must not be blindly reversed in production.

If the deployment includes destructive or incompatible database changes, prepare a migration-specific rollback strategy before deployment.

---

# 33. Docker cleanup

Inspect disk usage:

```powershell
docker system df
```

Remove unused images carefully:

```powershell
docker image prune
```

Do not run destructive cleanup commands without understanding what will be deleted.

Especially avoid deleting production volumes.

The PostgreSQL data lives in a Docker volume and must be treated as persistent data.

---

# 34. Never remove the production database volume casually

Commands such as:

```powershell
docker compose -f docker-compose.prod.yml down
```

normally keep named volumes.

But:

```powershell
docker compose -f docker-compose.prod.yml down -v
```

removes named volumes.

On production this can destroy PostgreSQL data.

Do not use:

```text
down -v
```

against the production stack unless the explicit intention is to delete production data.

---

# 35. Production email

Current local configuration uses the console email backend.

Before real public deployment, configure a real email provider.

Production variables should include:

```env
EMAIL_BACKEND=
DEFAULT_FROM_EMAIL=
```

Depending on the chosen provider, additional SMTP or API-specific variables may be required.

Invitation and future account email flows should be tested using the real provider.

---

# 36. Secrets

Never commit:

```text
.env
.env.production
```

Never commit or expose:

```text
DJANGO_SECRET_KEY
POSTGRES_PASSWORD
GOOGLE_OAUTH_CLIENT_SECRET
GITHUB_OAUTH_CLIENT_SECRET
email credentials
```

If a secret is accidentally committed to Git, removing it from the latest file is not sufficient.

Rotate the compromised secret.

---

# 37. OAuth secrets

Use separate production credentials where practical.

Recommended separation:

```text
development Google OAuth client
production Google OAuth client

development GitHub OAuth App
production GitHub OAuth App
```

This prevents local callback configuration from interfering with production.

---

# 38. Final security check

With the real HTTPS production environment configured:

```powershell
docker compose -f docker-compose.prod.yml run --rm web python manage.py check --deploy
```

The goal is to eliminate deployment security warnings before public launch.

Expected production settings include:

```text
DEBUG=False
HTTPS redirect enabled
secure session cookie
secure CSRF cookie
HSTS enabled
correct ALLOWED_HOSTS
correct CSRF trusted origin
```

---

# 39. Final OpenAPI check

```powershell
docker compose -f docker-compose.prod.yml run --rm web python manage.py spectacular --validate --fail-on-warn --file /tmp/schema.yml
```

Do not deploy if schema validation fails.

---

# 40. Final frontend check

```powershell
cd frontend
npm ci
npm run lint
npm run build
cd ..
```

Do not deploy if lint or build fails.

---

# 41. Final test suite

```powershell
docker compose -f docker-compose.prod.yml run --rm web python manage.py test
```

Do not deploy if tests fail.

---

# 42. Final launch checklist

Before calling the project live, confirm all items below:

- [ ] Production domain points to the VPS
- [ ] HTTPS certificate is valid
- [ ] HTTP redirects to HTTPS
- [ ] `DEBUG=False`
- [ ] strong Django secret key configured
- [ ] strong PostgreSQL password configured
- [ ] PostgreSQL not publicly exposed
- [ ] Redis not publicly exposed
- [ ] Daphne not publicly exposed
- [ ] only required firewall ports are open
- [ ] `ALLOWED_HOSTS` contains the production domain
- [ ] `CSRF_TRUSTED_ORIGINS` uses the production HTTPS origin
- [ ] `FRONTEND_BASE_URL` uses the production HTTPS URL
- [ ] `SOCIAL_LOGIN_REDIRECT_URL` uses the production HTTPS URL
- [ ] Google production callback configured
- [ ] GitHub production callback configured
- [ ] Google login works
- [ ] GitHub login works
- [ ] email/password login works
- [ ] social account linking works
- [ ] social account disconnect protection works
- [ ] password setup for social-only users works
- [ ] Django Admin loads with static files
- [ ] REST API works
- [ ] WebSocket works through `wss://`
- [ ] realtime chat works
- [ ] notifications work
- [ ] Celery is running
- [ ] health endpoint works
- [ ] `check --deploy` reviewed
- [ ] OpenAPI validation passes
- [ ] backend tests pass
- [ ] frontend lint passes
- [ ] frontend build passes
- [ ] database backup exists
- [ ] backup restore procedure is understood
- [ ] production smoke tests completed

---

# 43. Current local production-like environment

Before the actual VPS deployment, the project has already been tested locally through:

```text
http://localhost:8080
```

The local production-like stack includes:

```text
Nginx
React production build
Django / Daphne
PostgreSQL
Redis
Celery
Django static files
WebSocket proxying
Google OAuth
GitHub OAuth
```

Confirmed local production-like authentication flows:

```text
email/password
Google
GitHub
```

The real deployment must preserve the same request flow while replacing:

```text
http://localhost:8080
```

with the real HTTPS domain.

---

# 44. VPS deployment boundary

Do not apply domain-specific, DNS-specific, HTTPS-certificate-specific or server-specific commands until the target VPS and production domain are known.

When the VPS is ready, continue from this document using the real:

```text
VPS IP
domain
Linux distribution
firewall
HTTPS termination method
OAuth production credentials
email provider
backup destination
```

At that stage, deployment commands should be adapted to the actual server rather than copied from generic examples.
