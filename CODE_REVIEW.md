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

## Interview Prep Guide

If you're preparing to discuss this project in an interview, follow this reading order and use the talking points and sample questions below.

- Reading order (30–45 minutes):
  1. `README.md` — high-level features, envs, and deployment notes.
  2. `CODE_REVIEW.md` (this file) — top-level flows and file map for quick orientation.
  3. `src/modules/auth/auth.service.js` — core business logic (tokens, sessions, PKCE).
  4. `src/modules/auth/controllers/*` and `src/modules/auth/auth.routes.js` — request handling and validation.
  5. `models/*.js` and `migrations/` — DB shape and lifetime of tokens/codes.
  6. `src/database/index.js` — dynamic loader and Windows-specific fixes (good talking point).
  7. `src/app.js` and `src/middleware/*` — CORS, security headers, rate-limiting, auth middleware.

- Key talking points to prepare (one-liners you can explain):
  - Why Authorization Code + PKCE is used for SPAs and how S256 works end-to-end.
  - Refresh token rotation and why it's safer than static refresh tokens.
  - Cookie SSO trade-offs: `SameSite=None`, `secure`, and `AUTH_COOKIE_DOMAIN` implications.
  - How audit logging is implemented and why try-catch is used to avoid failures.
  - Windows ESM import issue and the `file://` URL fix — shows platform-awareness.
  - Rate limiting and CORS choices you would change for production.

- Sample technical interview questions and short answers to prepare:
  - Q: "How does PKCE prevent code injection attacks?" — A: Explain code_challenge/code_verifier exchange and why attacker without verifier can't exchange the code.
  - Q: "How do you prevent replay of authorization codes?" — A: Single-use codes, mark `used=true`, validate client_id + redirect_uri, and expiry.
  - Q: "What would you change to harden this for production?" — A: Add strict `FRONTEND_ORIGINS`, rate limiting per route, HSTS, CSP, rotate/separate secrets, add CI that runs migrations and tests.
  - Q: "Why store refresh tokens in DB?" — A: Enables rotation, revocation, and SSO session checks via cookie.

- Practical tasks you might be asked to demo in an interview:
  - Walk through the `/authorize` -> `/token` exchange with PKCE and show the DB record for the authorization code.
  - Add a small unit test that asserts PKCE S256 verification works (provide input verifier -> expected challenge).
  - Explain and fix a failing CORS origin scenario (modify `FRONTEND_ORIGINS` and demonstrate behavior).

- Behavioral / design prompts to prepare for:
  - Trade-offs between storing sessions server-side vs stateless JWT-only.
  - How to roll out cookie domain changes safely across multiple client apps.

This section will help you quickly navigate to the code areas interviewers will likely probe and deliver concise, confident answers.

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

---

## Bugs and Troubleshooting

This section lists all known bugs, issues encountered during development, and their solutions or workarounds.

### 1. Windows ESM Import Error: "Received protocol 'c:'"

- **Description**: On Windows, dynamic `import()` of model files failed with `Received protocol 'c:'` because Node.js ESM requires `file://` URLs for absolute paths.
- **Encountered in**: `src/database/index.js` during model loading.
- **Solution**: Convert model file paths to `file://` URLs using `pathToFileURL(modulePath).href` before importing.
- **Code fix**: In `src/database/index.js`, added `const moduleURL = pathToFileURL(modulePath).href;` and used `import(moduleURL)`.

### 2. Role ID Handling in Authorization Middleware

- **Description**: Role-based authorization failed due to inconsistent role ID field names or types (numeric vs string) in JWT tokens.
- **Encountered in**: `src/middleware/RoleMiddleware.js`.
- **Solution**: Quick-fix B: Prefer `req.user.roleId`, fallback to `req.user.role_id`, support both numeric and string comparisons by converting to strings.
- **Code fix**: Added flexible role ID extraction and loose string comparison in middleware.

### 3. Authorization Code Reuse Prevention

- **Description**: Authorization codes could be reused multiple times, violating OAuth2 security.
- **Encountered in**: Token exchange flow (`POST /api/auth/token`).
- **Solution**: Mark authorization codes as used after successful exchange; reject subsequent uses.
- **Code fix**: In `auth.service.js`, `consumeAuthorizationCode` sets `used: true` and checks `!code.used` before proceeding.

### 4. Login Redirect Issues

- **Description**: Unauthenticated `/authorize` requests redirected to `FRONTEND_LOGIN_URL` without properly passing client parameters (`client_id`, `redirect_uri`, `state`).
- **Encountered in**: Authorization flow for SPAs.
- **Solution**: Ensure client params are propagated in the redirect URL query string.
- **Code fix**: In `authorize.js`, append `client_id`, `redirect_uri`, and `state` to the login URL.

### 5. Audit Log Errors Swallowed

- **Description**: Audit logging failures could cause unhandled exceptions, potentially crashing the server.
- **Encountered in**: `src/modules/audit/log.js` and various controllers.
- **Solution**: Wrap audit calls in try-catch, log errors to console but don't throw.
- **Code fix**: In `auditLog` function, catch errors and `console.error`; in controllers, similar error handling.

### 6. Invalid Credentials Handling

- **Description**: Login attempts with wrong password or non-existent email threw unhandled errors.
- **Encountered in**: `auth.service.js` `loginUser` function.
- **Solution**: Throw specific "Invalid credentials" error for both cases.
- **Code fix**: Check user existence and password validity, throw Error("Invalid credentials") in both failure paths.

### 7. Client Secret Verification

- **Description**: Client middleware failed to verify hashed secrets correctly.
- **Encountered in**: `src/middleware/ClientMiddleware.js`.
- **Solution**: Use `bcrypt.compare` for hashed secrets.
- **Code fix**: Added bcrypt comparison in middleware.

### 8. PKCE Verification Failures

- **Description**: Code verifier validation failed for S256 challenges due to incorrect base64url encoding/decoding.
- **Encountered in**: `consumeAuthorizationCode` in `auth.service.js`.
- **Solution**: Implement proper SHA-256 hashing and base64url encoding for S256; support PLAIN method.
- **Code fix**: Added crypto-based verification logic.

### 9. Session Expiry and Refresh Token Rotation

- **Description**: Refresh tokens not rotated, leading to indefinite validity; sessions not properly expired.
- **Encountered in**: Refresh flow.
- **Solution**: Rotate refresh tokens on use; check session expiry.
- **Code fix**: In `refreshAccessToken`, generate new refresh token and update DB.

### 10. CORS Configuration Issues

- **Description**: CORS not allowing credentials or wrong origins in production.
- **Encountered in**: `src/app.js`.
- **Solution**: Set `credentials: true` when origins are specified; allow null origin for server-to-server.
- **Code fix**: Conditional CORS setup based on `FRONTEND_ORIGINS`.

### 11. Database Connection Errors

- **Description**: Unhandled DB connection failures during startup.
- **Encountered in**: `src/database/index.js` and `test-db.js`.
- **Solution**: Log errors and handle gracefully.
- **Code fix**: Added try-catch in connection tests.

### 12. Migration and Seeder Errors

- **Description**: Seeders failing due to missing roles or duplicate data.
- **Encountered in**: `seeders/seed-demo-client.js`.
- **Solution**: Check for existing data before inserting.
- **Code fix**: Added existence checks in seeders.

### 13. Test Cleanup Failures

- **Description**: Test teardown not cleaning up DB records, causing test pollution.
- **Encountered in**: Various test files.
- **Solution**: Use try-catch in afterAll hooks; best-effort cleanup.
- **Code fix**: Added error logging in cleanup blocks.

### 14. Rate Limiting Absence

- **Description**: No rate limiting on auth endpoints, vulnerable to brute force.
- **Encountered in**: Production considerations.
- **Solution**: Implement `express-rate-limit` on sensitive routes.
- **Note**: Not implemented in demo; recommended for production.

### 15. HTTPS and Cookie Security

- **Description**: Cookies not secure in production; SameSite issues for cross-site SSO.
- **Encountered in**: Cookie setting in controllers.
- **Solution**: Set `secure` flag in production; configure `SameSite=None` for cross-site when allowed.
- **Code fix**: Conditional cookie options based on env vars.

### 16. Environment Variable Validation

- **Description**: Missing required env vars caused runtime errors.
- **Encountered in**: App startup.
- **Solution**: Validate critical env vars at startup.
- **Note**: Not fully implemented; recommended.

### 17. Zod Validation Errors

- **Description**: Input validation failing silently or with unclear messages.
- **Encountered in**: Controllers using zod schemas.
- **Solution**: Ensure zod errors are caught and returned as 400 responses.
- **Code fix**: Added try-catch around zod.parse in controllers.

### 18. Audit Log User ID Issues

- **Description**: Audit logs missing userId for client token issuances.
- **Encountered in**: Client token endpoint.
- **Solution**: Pass userId: null for machine-to-machine logs.
- **Code fix**: Explicit null userId in audit calls.

### 19. Session Cookie Domain Configuration

- **Description**: SSO cookies not shared across subdomains.
- **Encountered in**: Cookie setting.
- **Solution**: Set `domain` on cookies for cross-subdomain SSO.
- **Code fix**: Use `AUTH_COOKIE_DOMAIN` env var.

### 20. Authorization Code Expiry

- **Description**: Codes not expiring, allowing indefinite use.
- **Encountered in**: Code creation and consumption.
- **Solution**: Set short expiry (e.g., 10 minutes) and enforce in validation.
- **Code fix**: Added `expiresAt` check in `consumeAuthorizationCode`.
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

- `DATABASE_URL` — PostgreSQL connection string
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
