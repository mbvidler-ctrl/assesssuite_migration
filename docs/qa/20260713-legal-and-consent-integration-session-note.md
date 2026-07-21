# Legal and consent integration — session note

**Branch:** `launch/legal-and-consent-integration` (pushed to origin only after Max's review — not merged to `main`, not deployed)
**Repo:** this clone, `assesssuite_launch_ready` (cloned fresh from `origin/main` at `4e2faad`, designated the "Launch Ready Codebase" per Max's direction)
**Instruction:** "Clone the most up-to-date codebase ... and integrate each of the necessary policies/terms/notices into it such that they appear at the appropriate time."
**Baseline:** `npm run selftest` 98/98, `node scripts/gate-tests.mjs` 13/13, `node scripts/smoke.mjs` 10/10, `npm run build` clean, `npm run lint` unchanged (7 pre-existing errors, none new).

## What changed

### 1. Legal document content and registry

- `src/legal-content/*.md` — verbatim copies (byte-diffed against source) of 12 approved instruments from `policy-suite-20260711` (RC-2026.07.11): Terms (02), Privacy (03), Clinical Use Notice (04), AI Notice (05), Collection Notice (06), AUP (07), Subscription Policy (08), Website Terms (09), Cookie Notice (10), DPA (11), Subprocessor Schedule template (25), Vulnerability Disclosure (28). Single source of truth — no hand-transcription.
- `src/lib/legal/documentRegistry.js` — id/title/slug/file/release-status/event-type map for every instrument, plus `SUITE_VERSION` and the `EVENT_TYPES` enum. Both the client and the server-side gate read the same version constant conceptually (server keeps its own copy, commented to stay in sync — see below).
- `src/lib/legal/loadContent.js` — Vite `import.meta.glob` bulk loader for the copied markdown.
- `src/lib/legal/recordAcceptance.js` — `recordLegalEvent`/`recordLegalEvents`, the only path that writes `LegalAcceptanceEvent` rows (document title/fingerprint snapshot, actor, org, capacity).
- `src/components/legal/LegalMarkdown.jsx` — `react-markdown` + `remark-gfm` (new dependency) renderer with Tailwind-styled table/heading/list components.
- `src/components/legal/ReleaseStatusBanner.jsx` — surfaces the suite's own release-status line verbatim; never silently drops the release-candidate boundary.
- `src/pages/LegalDocument.jsx` + `App.jsx` route `/legal/:slug` (public, no auth) — the single rendering surface for every published instrument.

### 2. New data model: `LegalAcceptanceEvent`

Replaces the old `LegalAcceptance` stub (one monolithic record, hardcoded version string, caused the "7 July legal-modal loop" documented in the old `Layout.jsx`). Added to `server/local-entity-schemas.json`; org-scoped (carries `org_id`, so the generic `ORG_SCOPED_ENTITIES` machinery in `server/index.mjs` handles read/write scoping with no bespoke code beyond a self-only write check mirroring `LegalAcceptance`'s existing one). Exported in `src/entities/all.js`.

### 3. Server-side enforcement (`server/index.mjs`)

- `LEGAL_SUITE_VERSION` + `REQUIRED_NOTICE_EVENT_TYPES` constants (mirror `documentRegistry.js` — comment says so; keep in sync manually).
- `hasCurrentLegalAcceptance(userEmail)` — synchronous check against the `LegalAcceptanceEvent` table.
- `entityAccessDenied()` extended: `CLINICAL_ENTITIES` access (read and write) for a non-admin now also requires current-version acceptance, not just `account_status === 'active'`. This is the actual L-15 fix — the old model was enforced **only** in the client (`Layout.jsx`), which any direct API caller bypassed entirely.
- `PRE_APPROVAL_WRITE_ENTITIES` gained `LegalAcceptanceEvent` (must be writable during onboarding, before approval).
- `writeAuthDenied()` gained a `LegalAcceptanceEvent` branch (self-only write, then falls through to the generic org-scope enforcement).

### 4. Onboarding flow (`ProfileSetup.jsx`)

Two new sections, both write `LegalAcceptanceEvent` rows on submit, before the Stripe checkout redirect:

- **Practitioner Notices** (`PractitionerNoticesSection.jsx`) — shown to every user, org owner or invited clinician. Three separately-recorded, separately-labelled ticks (collection notice = acknowledgement, not "agree"; clinical-use = agreement; AI = consent) plus one independent, unticked, optional marketing opt-in. Mirrors the mandatory-separation list in policy-suite doc 27 clause 2.
- **Practice Agreement** (`PracticeAgreementSection.jsx`) — shown only when this submission founds a new organisation (determined via an `OrganizationMember` pre-check on page load, mirroring the same branch `handleSubmit` already used). Captures jurisdiction(s) served, an adult-only-population affirmation (required — paediatric use stays blocked per doc 00/23), and one consolidated contract-acceptance tick linking Terms/DPA/AUP/Subscription/Subprocessor-schedule. This is deliberately **not** the full commercial Order Form (policy-suite doc 24) — it captures the practical gating facts (jurisdictions, adult-only) and binds the day-to-day clickwrap contract acceptance; the Order Form's fuller field set (ABN, named users, plan, Approved Production Mode table) remains a separate, so-far-unbuilt process. Flagged for Max, not actioned further this session.

`Organization` gained two schemaless fields on creation: `served_jurisdictions`, `adult_only_confirmed` — captured but **not yet wired into any feature gate** (e.g. disabling clinical-recommendation functions for non-confirmed practices). Noted as a real gap, not silently deferred.

### 5. Reacceptance path (`Layout.jsx` + `LegalNotices.jsx`)

`Layout.jsx`'s gate no longer checks the old `LegalAcceptance` entity/hardcoded version. It now checks the same `REQUIRED_NOTICE_EVENT_TYPES` against `SUITE_VERSION` (imported from the shared registry — one source of truth, fixing the drift bug class). Missing or stale acceptance (e.g. after a suite version bump) routes to the new standalone `/LegalNotices` page (added to `BYPASS_PATHS`), which re-shows only the three practitioner notices and records fresh events — not the old floating `LegalAcceptanceModal` (left on disk, now unreferenced — not deleted, per workspace convention; a candidate for removal on Max's say).

### 6. Just-in-time recording consent (`SOAPNoteModal.jsx`)

Recording consent cannot be satisfied by a signup-time tick (policy-suite doc 27 clause 2 requires it per session/participant). Added an `AlertDialog` shown when "Record" is clicked, before `getUserMedia` is invoked; confirming records a `recording_consent` event (session-scoped to the SOAP note/appointment id) and only then starts capture. States plainly that the clinician's own consent is being logged and that client consent remains the treating practice's separate duty.

### 7. Adjacent defects fixed (found via required end-to-end browser verification, not assumed)

These were pre-existing and block the entire onboarding funnel, independent of the legal work — fixed because the legal integration is inert without them:

1. **`Signup.jsx` retired as a live route** (`/signup` now redirects to `/register`) — it was an incomplete duplicate of the real OTP flow (no OTP, dead `href="#"` legal-link stubs), competing with `Register.jsx`.
2. **`LandingLive.jsx`'s stale inline Terms/Privacy modals removed**, replaced with links to the real `/legal/terms` and `/legal/privacy` routes; the "Coming Soon" gate on every sign-in/sign-up CTA removed, now navigates straight to `/register`. The old copy was hand-drafted, dated "June 2026", and diverged from the approved RC-2026.07.11 suite — leaving it live would have directly contradicted the integration.
3. **Post-auth redirect bug**: both `Register.jsx` and `Login.jsx` redirected to `/`, which `App.jsx` renders unconditionally as the marketing `LandingLive` page for every visitor, authenticated or not. No user — new or returning — could ever reach `ProfileSetup`/`Dashboard` through the normal sign-in path. Fixed by redirecting to `createPageUrl("Dashboard")` instead, which correctly passes through `ProtectedRoute` → `Layout`'s gate chain.
4. **`ProfileSetup.jsx` had no way to set `clinician_name`** despite `validateForm` requiring it (`"Your full name is required"`) — the field was only ever auto-filled from `currentUser.full_name`, which nothing in the OTP registration flow ever sets. No new user could complete setup. Added the missing "Your Full Name" input.

All four were caught only by actually driving the flow in a browser (per the project's own verification discipline) — not by code reading alone.

## Fixture updates required by the new server-side gate

`server/seed.mjs` and `server/selftest.mjs` both needed the mandatory `LegalAcceptanceEvent` rows seeded for their fixture users — otherwise every existing clinical-entity test (org scoping, bulk operations, admin approval) failed on "current legal acceptance required" rather than testing what it was designed to test. Added `seedLegalAcceptance()`/`seedRequiredLegalAcceptance()` helpers in each; `selftest.mjs`'s pending-user fixture additionally needed an `OrganizationMember` row added (it previously created only an `Organization`, which the real `ProfileSetup` flow never does in isolation). Full baseline restored: 98/98, 13/13, 10/10.

## New dependency

`remark-gfm` (^4.0.1) — added for GFM table support in `react-markdown` (already present at ^9.0.1); several suite instruments use pipe tables. `npm audit` flagged 4 pre-existing vulnerabilities (dompurify/jspdf/quill/react-quill, already in the dependency tree before this change) — unrelated to this addition, not actioned, noted for Max.

## Verified end-to-end in browser (not just unit-level)

Full new-user journey: landing page → Sign In/Sign Up → Register (email/password) → OTP (`000000`) → **ProfileSetup with Practice Agreement + Practitioner Notices** → ticked QLD, adult-only, contract-acceptance, and all three notices (marketing left unticked) → Complete Setup → Stripe checkout redirect issued. Confirmed server-side via direct API query after login: exactly 4 `LegalAcceptanceEvent` rows (no marketing row, as expected), correct `document_id`/`suite_version`/`actor_capacity`/`org_id` on each; `Organization` record carries `served_jurisdictions: ["QLD"]` and `adult_only_confirmed: true`. Confirmed `/legal/terms` and `/legal/subprocessors` (a table-heavy instrument) render correctly, release-status banner intact, table with navy header and horizontal scroll working.

## Explicitly NOT done this session (flagged, not silently skipped)

- **Full commercial Order Form** (policy-suite doc 24) — only the practical gating-fact subset (jurisdictions, adult-only) and the clickwrap contract acceptance were built into onboarding; the fuller instrument (ABN, named users/seats, plan terms, Approved Production Mode function-by-function table, signature-level acceptance record) remains a separate, unbuilt process.
- **`served_jurisdictions`/`adult_only_confirmed` are captured but not wired to any feature gate** — e.g. clinical-recommendation or treatment-protocol functions are not currently disabled based on these facts. Doc 00/23 already disable those functions pending a specialist TGA pathway regardless, so there is no live gap today, but the facts collected here do nothing yet.
- **Patient-facing consent** (the Patient Collection Notice and Consent Pack, doc 12) already has a working, more sophisticated implementation at `src/components/onboarding/Consent.jsx` (client-onboarding wizard, canvas signature, policy snapshot) — reviewed but not touched; it is a different, already-adequate mechanism for a different audience (patients, not practitioners).
- **Real transactional email** (`server/integrations.mjs` still mocks `SendEmail`/`SendSMS`) — unrelated to this task but relevant to a future "accessible copy delivered" requirement in doc 27 clause 4; not actioned.
- **Old `LegalAcceptanceModal.jsx`** left on disk, now unreferenced by any route — not deleted per workspace convention.
- No push to origin, no merge to `main`, no deploy. Local commits on the feature branch only.
