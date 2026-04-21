# Authflow — Code Review & Function Reference

Purpose: a single-file study guide describing the backend code, main files, exported functions/handlers, DB models, migrations, environment variables, and the runtime flows (authorize / token / login / refresh / session). Use this to learn the codebase quickly and to find the functions to extend or test.

How to use: read the "Top-level flows" section first, then consult the file map for function-level details. Each file entry lists exported functions, responsibilities, inputs, side-effects, and important implementation notes.

---

Top-level flows

- Authorization Code (with PKCE):
  1. Client redirects user to `/api/auth/authorize` with `client_id`, `redirect_uri`, optional `code_challenge` and `state`.
  2. If user is authenticated (SSO cookie or Bearer token), server issues an authorization code (stores `codeChallenge` and `codeChallengeMethod` if present) and redirects to `redirect_uri?code=...&state=...`.
  3. Client (or backend) exchanges `code` at `POST /api/auth/token` with `grant_type=authorization_code`, `code`, `client_id`, `redirect_uri` and `code_verifier` (if PKCE used). Server validates code, PKCE, creates a session and returns `access_token` and `refresh_token`.

- Login + Redirect flow (for SPAs):
  - Unauthenticated requests to `/authorize` are redirected to `FRONTEND_LOGIN_URL` with client params propagated. After login, the SPA should call `/login` providing PKCE params so server can create an auth code and redirect back to client.

- Refresh flow:
  - `POST /api/auth/refresh` accepts `refreshToken` in the body (or cookie-based session), rotates refresh tokens and returns a new `accessToken` and rotated refresh token.

- Session detection (SSO):
  - `GET /api/auth/session` returns `{ authenticated: true/false, user }` based on refresh cookie or Bearer token.

---

File map and function reference

- `src/app.js`
  - Purpose: Express app configuration and middleware.
  - Key behavior: CORS (controlled by `FRONTEND_ORIGINS`), `helmet` security headers, global rate limiting (`express-rate-limit`), `express.json()` parsing, mounts `router` at `/api`.
  - Notes: CORS origin acceptance allows null/no-origin (server-to-server requests). `FRONTEND_ORIGINS` must be set to production client origins.

- `src/server.js`
  - Purpose: HTTP server bootstrap (load `app` and listen). Typical entry point for `npm run dev`.

- `src/routes/index.js`
  - Purpose: top-level router that mounts auth routes at `/auth` (so endpoints live under `/api/auth/...`).

- `src/database/index.js`
  - Purpose: dynamic Sequelize model loader and DB connection bootstrap.
  - Important: converts model file paths to `file://` URLs on Windows so dynamic `import()` works; loads `.cjs` model files as well. This resolves the Windows ESM error `Received protocol 'c:'`.

- `src/modules/auth/auth.controller.js`
  - Exports and responsibilities (implementations split into `src/modules/auth/controllers/`):
    - `register(req, res)`: validations, calls `auth.service.registerUser`, writes audit log `REGISTER_SUCCESS`/`REGISTER_FAILURE`.
    - `login(req, res)`: validates credentials, calls `auth.service.loginUser`, sets session cookie via `setSessionCookie`, if `client_id`+`redirect_uri` provided creates an authorization code (with `code_challenge` if present) and redirects to client; otherwise returns tokens JSON.
    - `authorize(req, res)`: validates `client_id`/`redirect_uri`, if user authenticated issues authorization code and redirects to client; otherwise redirects to `FRONTEND_LOGIN_URL` with client params.
    - `token(req, res)`: `grant_type=authorization_code` handling; validates client (and optional secret), calls `auth.service.consumeAuthorizationCode` (verifies PKCE), creates session via `auth.service.createSession`, returns `access_token`/`refresh_token`.
    - `refresh(req, res)`: accepts `{ refreshToken }` in body, calls `auth.service.refreshAccessToken`, returns rotated tokens.
    - `logout(req, res)`: revokes session via `auth.service.revokeSession`, clears cookie.
    - `clientToken(req, res)`: machine-to-machine token issuance for validated clients (uses `validateClient` middleware).
    - `session(req, res)`: SSO check; inspects cookie or Bearer token to return authenticated state.
  - Helpers inside controller:
    - `parseCookies(cookieHeader)`: simple cookie parser used to find session cookie.
    - `getRefreshTokenFromRequest(req)`: extracts refresh token from cookie named by `AUTH_SESSION_COOKIE_NAME`.
    - `setSessionCookie(res, refreshToken)`: sets secure, httpOnly cookie; honors `AUTH_COOKIE_DOMAIN` and `ALLOW_CROSS_SITE_SSO` (SameSite and `secure` behavior).
    - `getAuthenticatedUser(req)`: tries cookie-based session lookup (refresh token), otherwise checks `Authorization: Bearer` header.
  - Notes: controller uses `zod` for input validation and emits audit logs at key events.

- `src/modules/auth/auth.service.js`
  - Exported functions and behavior:
    - `registerUser({ email, password })` — creates user (ensures role exists), hashes password with `bcrypt`.
    - `loginUser({ email, password }, meta)` — validates password, calls `createSession`, returns tokens and `userId`, logs `LOGIN_SUCCESS`.
    - `createSession({ user, ipAddress, userAgent })` — generates JWT access token (15m), generates random refresh token, persists a `Session` row (token, refreshToken, expiresAt), returns `{ accessToken, refreshToken }`.
    - `createAuthorizationCode({ userId, clientId, redirectUri, codeChallenge, codeChallengeMethod, expiresInMs })` — generates a random code, stores `AuthorizationCode` record with optional PKCE fields and expiry.
    - `consumeAuthorizationCode({ code, clientId, redirectUri, codeVerifier })` — finds unused code for `clientId`+`redirectUri`, enforces expiry, validates PKCE (`S256` or `PLAIN`) if `codeChallenge` present, marks code used, returns code record (including `userId`).
    - `generateToken(payload, expiresIn)` — signs JWT using `JWT_SECRET`.
    - `refreshAccessToken(refreshToken, meta)` — validates session by `refreshToken`, checks expiry, rotates refresh token and access token, persists session, logs `TOKEN_REFRESH`.
    - `revokeSession({ refreshToken, accessToken })` — destroys session record and logs `LOGOUT`.
  - Notes: PKCE S256 verification uses SHA-256 and base64url encoding (server-side). Authorization codes are single-use and short-lived.

- `src/modules/auth/auth.routes.js`
  - Maps endpoints to controller functions:
    - `POST /register` -> `register`
    - `POST /login` -> `login`
    - `GET /authorize` -> `authorize`
    - `POST /token` -> `token`
    - `GET /session` -> `session`
    - `POST /refresh` -> `refresh`
    - `POST /logout` -> `logout`
    - `POST /client-token` -> `clientToken` (protect via `validateClient` middleware)
    - `GET /me` -> protected example using `authenticate` middleware

- `src/modules/auth/auth.middleware.js`
  - `authenticate(req, res, next)` — expects `Authorization: Bearer <token>`, verifies token with `JWT_SECRET`, sets `req.user` to decoded payload, logs `AUTH_FAILURE` on errors and returns 401.

- `src/middleware/ClientMiddleware.js`
  - `validateClient(req, res, next)` — reads `x-client-id` and `x-client-secret` headers, loads `Application` by `clientId`, verifies secret (bcrypt or plain), attaches `req.client`.

- `src/middleware/RoleMiddleware.js`
  - Exports a factory `(allowedRoles) => middleware` which checks `req.user.roleId` against allowed list, logs `AUTHZ_DENIED`/`AUTHZ_GRANTED` and returns 403 if unauthorized.

- `src/modules/audit/log.js`
  - `auditLog(action, { userId, ipAddress, meta })` — lightweight wrapper that logs an `AuditLog` DB record; errors are swallowed and printed to console.

- `models/` (Sequelize model summaries)
  - `models/user.js` — fields: `email`, `password`, `roleId`.
  - `models/session.js` — fields: `token`, `expiresAt`, `userId`, `refreshToken`, `userAgent`, `ipAddress`.
  - `models/application.js` — fields: `name`, `clientId`, `clientSecret`, `redirectUri`.
  - `models/authorizationCode.js` — fields: `code`, `clientId`, `redirectUri`, `codeChallenge`, `codeChallengeMethod`, `userId`, `expiresAt`, `used`.
  - `models/auditlog.js` — fields: `action`, `ipAddress`, `userId`.
  - `models/role.js` — fields: `name`.

- `migrations/` (what to expect)
  - Migration scripts create the DB tables for roles, users, applications, sessions, audit logs, and authorization codes, plus a migration that adds PKCE columns to authorization codes and refresh columns to sessions.

- `seeders/`
  - Seeds include an initial `ROLE` set and (example) a seeded demo client with `clientId`/`clientSecret` for tests.

- `tests` (`src/modules/*/__test__/`)
  - Auth test suites cover register/login, refresh flows, client token, and authorization-code/PKCE exchange. Use `npm run test` (vitest) to run them.

---

Environment variables (summary)

- `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT` — DB connection
- `JWT_SECRET` — used for signing JWT access tokens
- `FRONTEND_ORIGINS` — comma-separated allowed origins for CORS
- `FRONTEND_LOGIN_URL` — where to redirect unauthenticated authorize requests
- `AUTH_COOKIE_DOMAIN` — domain to set on auth cookie for cross-site SSO
- `ALLOW_CROSS_SITE_SSO` — when `true` allows `SameSite=None` on cookies (requires `secure`)
- `AUTH_SESSION_COOKIE_NAME` — cookie name (defaults to `auth_session`)

---

Operational notes & tips

- Always run migrations before starting the app in a new environment: `npx sequelize-cli db:migrate`.
- For Windows development ensure `src/database/index.js` conversion to `file://` URLs is present (this repo includes that fix).
- PKCE: prefer S256; if you use `PLAIN` it's less secure and should be avoided for public clients.
- Cookie SSO: for cross-site SSO set `AUTH_COOKIE_DOMAIN=.example.com` and `ALLOW_CROSS_SITE_SSO=true`, serve over HTTPS and configure `FRONTEND_ORIGINS` correctly.
- Rotate `JWT_SECRET` and client secrets carefully; implement token revocation where needed.

---

Recommended next reading

- `src/modules/auth/auth.controller.js` and `src/modules/auth/auth.service.js` together to understand the end-to-end flow.
- `models/authorizationCode.js` and matching migrations — to see the PKCE DB shape and lifetime.

---

If you want, I can now:

- generate a per-function call graph or sequence diagrams for `authorize -> token -> session` flows, or
- produce a single-page HTML interactive map for exploring functions.
