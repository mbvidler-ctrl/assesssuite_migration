# Launch-Gate Test Results — G5 / G6 / G7 / G8

Executed 3 July 2026 against the live seeded shim instance (port 8787) + Vite dev app (5173). Reproducible: `npm run seed` then `node scripts/gate-tests.mjs` (API layer), plus the browser confirmations recorded below. Test numbering follows `20260703-role-entitlement-isolation-analysis.md`.

## Environment

- Shim commit line: capture `768b038` → functions `107a042` → G6 guards `8da2d9a` → G5 guards `1abd08d` → G7 `49642f5` → seed `08cb291`.
- Synthetic two-tenant seed: Org Alpha (clients Grace Ellington ×2 [deliberate G7 duplicate], Tobias Ferreira, Simone Okafor), Org Beta (Callum Ashworth, Rosalind Meiklejohn). Credentials: `scripts/seed-credentials.md`.
- Self-test: 64/64. Smoke: 10/10. Gate harness: 12/12.

## G5 — Auth and RBAC — PASS

API (`scripts/gate-tests.mjs`):
- G5.4 non-admin `GET entities/User` → 403. PASS.
- G5.4b admin `GET entities/User` → 200, no `password_hash`/`salt` leaked. PASS.
- non-admin `POST functions/auditAssessmentIssues` → 403. PASS.

UI (browser, logged in as `clinician@org-alpha.seed.test`, role `user`):
- Direct URL `/AssessmentAudit` → renders "Admin Access Required" card; audit controls absent (`hasAuditUI=false`). PASS.
- Direct URL `/AdminAnalytics` → renders "Admin Access Required" card; analytics UI absent. PASS.
- Network log across both visits shows only `entities/User/me` (auth) and the one setup `LegalAcceptance` write — **no `Client`/`ClientCondition`/`Assessment` list calls issued**, confirming the data-load guard returns before any entity query for a non-admin. PASS.
- Sidebar shows no admin links for the non-admin (cosmetic layer intact). PASS.

Conclusion: I1 remediated. Admin surfaces are guarded at both the UI (page-level card + suppressed data-load) and the API (User collection admin-only; admin functions 403).

## G6 — Tenant/client isolation — PASS (with two documented product/scoping flags)

API:
- G6.6a Beta clinician `GET` an Alpha client by id → 404. PASS.
- G6.6b Beta clinician `Client` list excludes all Alpha records. PASS.
- G6.6c Alpha clinician list returns only own-org rows (4/4 org_id match). PASS.
- non-admin `createTestClientWithAssessments`, `verifyTestAssessmentData` → 403 each. PASS.

UI: Clients page as Alpha clinician shows only Alpha clients; no Beta records visible. PASS.

Flags carried to the handover (not blocking G6's object-level isolation, but recorded): (i) `Finances.jsx`/`NewAssessment.jsx` scope by `created_by` rather than `org_id` — an intra-org under-scoping inconsistency; (ii) the live-platform `auditAssessmentIssues` shipped with no auth check (critical) — hardened in the shim, must be fixed on the live app.

## G7 — Duplicate/client integrity — PASS (advisory; full merge workflow deferred to product)

- `scripts/check-duplicates.mjs`: 6/6 (exact match; DD/MM/YYYY vs ISO same date; different DOB not matched; Jon/John documented miss; token-subset match; missing DOB → no match).
- Deployed module (`/src/lib/clientDuplicates.js`) run live in the browser against Org Alpha's seeded clients: a candidate "Grace Ellington" with DOB `14/03/1958` flags both existing "Grace Ellington / 1958-03-14" records (cross-format match confirmed); a novel candidate flags none. PASS.
- Handler wiring reviewed: both `Onboarding.jsx` and `QuickOnboardModal.jsx` call the check before `Client.create` and block on an advisory confirm, releasing their submit locks on cancel. Build green.

Conclusion: I3 remediated to the advisory-check level in the two previously-unprotected create paths. A safe merge/dedupe workflow remains a Brenton/Max product decision.

## G8 — Stripe/payment entitlement — PASS (mocked; real wiring deferred to D5)

- G8.16 non-admin `updateMe{role:'admin'}` → role stays `user`; non-guarded field on the same call still applied. PASS.
- G8.17a `createCheckoutSession` returns a checkout URL. PASS.
- G8.17b after a `checkout.session.completed` webhook, the user's role is unchanged (`user`→`user`) while entitlement fields activate. PASS.
- Self-test additionally confirms the webhook writes `account_status`/`subscription_status`/`stripe_*` and `syncStripeSubscription` reconciles from the mock store.

Conclusion: billing state is structurally separate from role/data scope; payment cannot grant admin. Stripe is fully mocked behind identical contracts (Max direction); real test-mode wiring is deferred to the launch decision (D5).

## G9 — Report generator — see separate assessment

G9 (issue I2: reports too long; tables/baseline comparisons not right) is content-quality-dependent. The report generators call `InvokeLLM`, which is mocked (deterministic placeholder text), so report STRUCTURE, table scaffolding, and the edit/export workflow are assessable locally but LLM-generated content QUALITY is not. Assessed separately; see the handover note and run-state.
