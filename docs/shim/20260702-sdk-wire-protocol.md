# Base44 SDK Wire Protocol — Local Shim Contract

Derived by direct inspection of `@base44/sdk@0.8.35` dist source (`node_modules/@base44/sdk/dist/`) on 2 July 2026, cross-referenced against captured call sites in `src/`. This document is the binding contract for the local shim server (`server/`). Where a response shape says "match call sites", the implementer must grep the consuming component and reproduce the exact keys it reads.

## Conventions

- All API paths are relative to `{serverUrl}/api` (the SDK's axios `baseURL` is `` `${serverUrl}/api` ``, `client.js:83`).
- The main axios client unwraps responses: handlers receive `response.data` directly (`axios-client.js:184`). The shim therefore returns plain JSON bodies.
- Errors: HTTP status + JSON body `{ "message": string, "detail"?: string, "code"?: string, ... }`. The SDK surfaces `message || detail`, `status`, `code`, and the whole body as `error.data` (`axios-client.js:186-196`). `AuthContext.jsx` specifically reads `error.status === 403` and `error.data.extra_data.reason`.
- Auth: `Authorization: Bearer <token>` header. Token provenance in the browser: `?access_token=` URL param or `localStorage['base44_access_token']`, set by `auth.setToken` after `loginViaEmailPassword`.
- Headers always sent: `X-App-Id`; browser also sends `X-Origin-URL` and (unauthenticated) `X-Base44-Anonymous-Id` — ignore them. The functions client may send `Base44-Functions-Version` — ignore it.
- The **functions** axios client does NOT unwrap (`interceptResponses: false`, `client.js:88-94`): `base44.functions.invoke` resolves to a full axios response; call sites read `response.data` / `response.status`.

## Entities (`modules/entities.js`)

Base: `/apps/{appId}/entities/{EntityName}`

| Method + path | SDK call | Notes |
|---|---|---|
| GET base | `.list(sort, limit, skip, fields)` | query params `sort`, `limit`, `skip`, `fields` (comma-joined) |
| GET base `?q={JSON}` | `.filter(query, sort, limit, skip, fields)` | `q` is a MongoDB-style query object, JSON-stringified |
| GET `base/{id}` | `.get(id)` | |
| POST base | `.create(data)` | returns created record |
| PUT `base/{id}` | `.update(id, data)` | returns updated record |
| DELETE `base/{id}` | `.delete(id)` | |
| DELETE base (JSON body = query) | `.deleteMany(query)` | |
| POST `base/bulk` (JSON array) | `.bulkCreate(array)` | used by `NewAssessment.jsx:99`, `Onboarding.jsx:322` |
| PUT `base/bulk` | `.bulkUpdate(array)` | not observed in app; implement trivially |
| PATCH `base/update-many` `{query, data}` | `.updateMany(query, data)` | not observed in app; implement trivially |

- Record envelope (platform built-ins on every record): `id`, `created_date` (ISO), `updated_date` (ISO), `created_by` (creator's email). Sort syntax: field name, `-` prefix for descending (e.g. `-created_date`).
- Filter operators to support: equality, `$in`, `$nin`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$exists`, `$regex` (with `$options` `i`), `$or`, `$and`, plus nested-field dot paths. App call sites use mostly flat equality (`{org_id, client_id, user_email, ...}`); implement the full set defensively.
- Entity set: the 20 live entities in `docs/source-capture/20260702-live-entity-schemas.json` (19 custom + built-in `User`). Unknown entity names → 404 `{message}`.
- Realtime `.subscribe` / websocket: NOT used by the app — do not implement.

## Auth (`modules/auth.js`)

| Method + path | SDK call | Contract |
|---|---|---|
| GET `/apps/{appId}/entities/User/me` | `auth.me()` | current user record (built-ins + custom `User.jsonc` fields + `role`: `admin`\|`user`) |
| PUT `/apps/{appId}/entities/User/me` | `auth.updateMe(data)` | updates own custom fields; must not allow `role`/`email` escalation |
| POST `/apps/{appId}/auth/login` `{email, password}` | `loginViaEmailPassword` | → `{access_token, user}`; 401 on bad credentials |
| POST `/apps/{appId}/auth/register` | `register(payload)` | match `src/pages/Register.jsx` / `CreateAccount.jsx` / `Signup.jsx` payloads and response handling |
| POST `/apps/{appId}/auth/verify-otp` `{email, otp_code}` | `verifyOtp` | mock: accept `000000` |
| POST `/apps/{appId}/auth/resend-otp` `{email}` | `resendOtp` | record to outbox, return `{status:'sent'}` |
| POST `/apps/{appId}/auth/reset-password-request` `{email}` | | mock reset token to outbox |
| POST `/apps/{appId}/auth/reset-password` `{reset_token, new_password}` | | |
| POST `/apps/{appId}/auth/change-password` `{user_id, current_password, new_password}` | | |
| POST `/apps/{appId}/users/invite-user` and `/apps/{appId}/runtime/users/invite-user` `{user_email, role}` | `inviteUser` | role constrained to `user`\|`admin` |
| GET `{appBaseUrl}/api/apps/auth/logout?from_url=…` | `logout()` (browser redirect) | clear any cookie state, 302 to `from_url`. `appBaseUrl` normalises to `''` in this app, so the request hits the app origin → Vite proxy |

- Login redirect: `redirectToLogin` sends the browser to `{appBaseUrl}/login?from_url=…` — with `appBaseUrl=''` that is the app's own `/login` route, which exists in `src/pages/Login.jsx`. No platform login page is required.
- Password storage: `node:crypto` scrypt with per-user salt. Sessions: opaque random tokens in a sessions table. No JWT needed.

## Public settings (consumed by `AuthContext.jsx:27-37`)

GET `/apps/public/prod/public-settings/by-id/{appId}` with header `X-App-Id`.
- 200 → object stored as `appPublicSettings` (shape `{id, public_settings}` per the code comment; return `{id: appId, public_settings: {...}}`).
- 403 with `{message, extra_data: {reason: 'auth_required' | 'user_not_registered' | ...}}` drives the app's error states. Default local behaviour: always 200.

## Functions (`modules/functions.js`)

POST `/apps/{appId}/functions/{functionName}` — JSON body, or multipart when any value is a `File`. Response NOT unwrapped by SDK (see Conventions). Function inventory to serve (bodies in `base44/functions/*/entry.ts`, ported):

`assignOrganizations, auditAssessmentIssues, createCheckoutSession, createMissingAssessments, createPortalSession, createTestClientWithAssessments, enableMissingTestRunners, fixHasTestRunnerFlags, fixMissingOrgIds, fixUserOrganizations, getComorbidityReport, getMissingTestRunners, stripeWebhook, syncStripeSubscription, verifyTestAssessmentData` — plus `transcribeSession` (invoked by `SOAPNoteModal.jsx:557,576` but absent from the captured functions directory; implement as a deterministic mock matching the call site's expected shape).

Also: `MyProfile.jsx:199` fetches `'/functions/createPortalSession'` relative to the app origin — the dev proxy must route `^/functions/` to the shim (rewritten to the functions path).

Stripe functions are **fully mocked** (Max's direction, 2 July 2026): identical request/response contracts and identical `User` entitlement writes (`account_status`, `subscription_status`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_start_date`), no external calls.

## Integrations (`modules/integrations.js`)

POST `/apps/{appId}/integration-endpoints/Core/{EndpointName}` — JSON or multipart (File values). Mocks, shapes matched to call sites:

| Endpoint | Mock behaviour |
|---|---|
| `InvokeLLM` | If `response_json_schema` present → return an object instantiating that schema with plausible deterministic values; else → return a string. Check consuming components for exact usage. |
| `SendEmail` | Record `{to, subject, body, from_name}` to an `outbox_email` table; return success shape per call sites |
| `SendSMS` | As above, `outbox_sms` |
| `UploadFile` | Store file under `server/uploads/`, return `{file_url}` pointing at a served URL |
| `GenerateImage` | Return `{url}` of a generated placeholder (local data or static file) |
| `ExtractDataFromUploadedFile` | Deterministic mock honouring the supplied `json_schema`; match `ReferralUploader.jsx` / `ClientDataExtractor.jsx` / `HistoricalAssessmentExtractor.jsx` expectations |

## Telemetry stubs (must not error)

- POST `/apps/{appId}/analytics/track/batch` → 204. Note `analytics.js:59` may deliver this via `navigator.sendBeacon` to the absolute URL — same path.
- POST `/app-logs/{appId}/log-user-in-app/{pageName}` → 204 (`NavigationTracker.jsx`).

## Authorisation model (shim v1 — groundwork for gates G5/G6)

- Unauthenticated: only `/auth/*`, public-settings, telemetry stubs, `/uploads/*`.
- `User` collection: `list`/`get(id)`/`update(id)` restricted to `role === 'admin'` (this is issue I1/R1 — ordinary users must never read or write other users). `me` endpoints available to any authenticated user.
- Org scoping (G6): for entities carrying `org_id`, non-admin requests are automatically constrained to org_ids where an `OrganizationMember` row links the requester's `user_email`; admin bypasses. Writes stamp `created_by` with the session user's email.
- `updateMe` field guard: `role`, `email`, `id`, `created_date` are not writable through `updateMe`.

## Dev topology

- Shim server: `http://localhost:8787` (`npm run server`). Vite dev: `http://localhost:5173`.
- `.env.local`: `VITE_BASE44_APP_ID=local-assesssuite`, `VITE_BASE44_BACKEND_URL=http://localhost:5173` (same-origin; no CORS).
- Vite `server.proxy`: `'/api'` → `http://localhost:8787`; `'/functions'` → `http://localhost:8787` with rewrite `^/functions/(.*)` → `/api/apps/local-assesssuite/functions/$1`.
- The shim also serves `dist/` statically with SPA fallback when present (single-origin private preview/staging mode).
- Persistence: `node:sqlite` (`DatabaseSync`), database file `server/data/app.db` (gitignored). Zero new production dependencies; multipart parsing via `new Response(body, {headers}).formData()` (undici built-in).
