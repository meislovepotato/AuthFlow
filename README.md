# Authflow — Centralized Authorization Server

This repository implements a centralized authorization/authentication server (backend only) with Sequelize models/migrations, an OAuth2-style Authorization Code flow with PKCE, refresh-token rotation, cookie-based SSO session detection, and audit logging.

This README documents backend setup, architecture, security considerations, tests, and operational notes. Client/frontends (PKCE examples) are maintained separately and are not included in this repository.

---

## Quick overview

- Features:
  - Authorization Code flow (server-side exchange)
  - PKCE support (S256 + PLAIN)
  - Refresh token rotation
  - Session cookie for SSO checks (`GET /api/auth/session`)
  - Client credentials endpoint for machine-to-machine tokens
  - Audit logging hooks

- Tech stack:
  - Node.js + Express
  - Sequelize ORM + migrations
  - JWT (`jsonwebtoken`), `bcrypt`, `crypto`
  - Validation with `zod`
  - Tests: `vitest` + `supertest`

---

## Repository structure (high level)

- `src/` — application source
  - `app.js` — express app, CORS and middleware
  - `server.js` — http server entry
  - `modules/auth/` — register/login/authorize/token/session/logout handlers and service logic
  - `config/` — runtime/environment configuration
  - `database/` — DB bootstrap and dynamic model loader
- `models/` — Sequelize model definitions used for migrations and runtime
- `migrations/` — Sequelize migration scripts
- `seeders/` — optional seed data
- Frontend clients (PKCE examples) are kept separately from this backend repository; consult your frontend project for SPA examples.
- `test/` and `src/modules/**/__test__/` — test suites

---

## Important files

- `src/modules/auth/auth.controller.js` — HTTP handlers for `/authorize`, `/token`, `/login`, `/refresh`, `/logout`, `/session`
  - Note: handler implementations live in `src/modules/auth/controllers/` (`auth.controller.js` now re-exports them).
- `src/modules/auth/auth.service.js` — core auth logic: create/consume authorization codes (PKCE), create sessions, refresh rotation, token generation
- `models/authorizationCode.js` — authorization code model (stores `codeChallenge`, `codeChallengeMethod`)
- `src/database/index.js` — dynamic model loader (Windows-safe file:// import fix)

---

## Environment & setup

Prerequisites:

- Node.js (16+ recommended)
- A PostgreSQL database configured via `DATABASE_URL`

Install:

```bash
npm install
```

Environment variables (summary) — set these in `.env` or your deployment environment:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — secret for signing access tokens
- `FRONTEND_ORIGINS` — comma-separated allowed origins for CORS
- `FRONTEND_LOGIN_URL` — URL to redirect unauthenticated authorize requests to (SPA login)
- `AUTH_COOKIE_DOMAIN` — optional, domain to set on SSO cookie for cross-site SSO
- `ALLOW_CROSS_SITE_SSO` — set to `"true"` to allow `SameSite=None` on auth cookies (requires `secure`)
- `NODE_ENV` — `development` or `production`

Database setup and migrations:

```bash
# run migrations (uses sequelize-cli config in repo)
npx sequelize-cli db:migrate

# run seeders if needed
npx sequelize-cli db:seed:all
```

---

## Running the app

Development:

```bash
npm run dev   # or whatever start script you prefer
```

Run the tests:

```bash
npm run test
```

You should see the vitest runner; test suites for auth (including authorization-code-flow) are present under `src/modules/auth/__test__/`.

---

## Security & production notes (do not skip)

- Cookie SSO:
  - The project supports setting an SSO cookie with `SameSite=None` to enable cross-site SSO when `ALLOW_CROSS_SITE_SSO` is `true`. This requires `secure` cookies (HTTPS) and careful `AUTH_COOKIE_DOMAIN` configuration.
  - For central-auth-domain SSO (e.g., auth.example.com used by multiple client apps), set `AUTH_COOKIE_DOMAIN=.example.com` and make sure all client apps are in that domain space.

- CORS:
  - `FRONTEND_ORIGINS` should be restricted to known client origins. The server uses explicit methods/headers and enables `credentials` when configured.

- PKCE:
  - The server stores the `code_challenge` and `code_challenge_method` on the authorization code record and verifies `code_verifier` during token exchange. S256 is supported and recommended.

- Refresh token rotation:
  - Refresh tokens are rotated on use — old refresh tokens are invalidated.

- Secrets:
  - Keep `JWT_SECRET` and any client secrets safe and rotated periodically.

- Rate limiting & abuse:
  - Token endpoints should be rate-limited in production (not implemented in this demo).

- HTTPS/HSTS:
  - Serve the production auth service over HTTPS and enable HSTS. Cookies with `SameSite=None` require `secure`.

---

## Tests and CI

- Unit and integration tests use `vitest`. Auth flows including PKCE token exchange are covered by tests under `src/modules/auth/__test__/`.

Typical test command:

```bash
npm run test
```

If you add CI (GitHub Actions, etc.), run migrations in a test DB and execute the test command.

---

## Troubleshooting

- "Received protocol 'c:'" when importing models on Windows: ensure `src/database/index.js` converts model paths to `file://` URLs (this repo includes that fix).
- Authorization code reuse / invalid code: Authorization codes are single-use, short-lived, and verified against `client_id` and `redirect_uri` when exchanged.
- If login redirects issue: check `FRONTEND_LOGIN_URL` and ensure client params (`client_id`, `redirect_uri`) are passed through.

---

## Where to look next in the code

- `src/modules/auth/auth.controller.js` — request/response handling and cookie setting
- `src/modules/auth/auth.service.js` — business logic (create/consume code, PKCE verification, sessions)
- `models/authorizationCode.js` and matching migrations — DB schema for codes
- `src/app.js` — CORS config and middleware

---

## Contributing

PRs welcome. When contributing:

- Run tests locally (`npm run test`) and ensure new behavior is covered
- Follow existing code style

Generated on: 2026-04-21
