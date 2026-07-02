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

## G9 — Report generator — PARTIAL (structural defect found; content-quality blocked on a real LLM)

G9 (issue I2: reports too long; tables/baseline comparisons not right). The report generators call `InvokeLLM`, which is mocked here (deterministic placeholder prose), so LLM-generated content QUALITY cannot be assessed locally. What IS assessable — the report structure, the wizard flow, and the data-table layer — was assessed and yielded a concrete root-cause finding for I2:

- **"Tables / baseline comparisons not right" — root cause identified.** `src/components/reports/wizard-steps/OutcomeTable.jsx` is an unimplemented placeholder (its entire body renders `<p>Outcome table component (placeholder)</p>`), and it is **never imported or rendered anywhere** in the codebase. There is therefore no data-driven outcome table in the product at all: every "Outcome Measures (baseline vs current)" section — a mandatory section across ~30 report-type definitions in `UnifiedReportWizard.jsx` — is produced entirely as LLM prose, with the model expected to transcribe assessment values into a baseline-vs-current narrative. That is exactly the failure mode I2 reports. Remediation is a feature build (a real OutcomeTable that renders selected assessments' baseline and current values as a structured table, fed from the already-selected assessment data) — a product-scoped change, flagged for Max/Brenton rather than built unilaterally in this pass.
- **"Reports too long" — instructions already present; residual is model behaviour.** The report-type definitions carry explicit length discipline in their `ai_instruction` fields (e.g. "2–4 sentences maximum", "1–3 short paragraphs", "1-page referral", "do NOT pad with unnecessary background"). Conciseness is therefore already instructed; if live output is still too long, that is the LLM not honouring the instruction — addressable only with a real LLM (prompt-tuning and/or a hard post-generation length cap), not assessable under the mock.
- **Edit/export workflow — functional.** `ReviewExport.jsx` provides a working HTML review + direct-edit + print/export path; verified structurally.

Conclusion: G9 cannot be closed under a mocked LLM. Two concrete outputs stand regardless: the OutcomeTable placeholder is a real product defect (build a data table), and the length-control instructions are already in place (tune against a real model). Wiring a real LLM (a free-tier/local model would suffice at zero cost) is the prerequisite for a full G9 content-quality pass — recorded as a deferred item in the Decision, Cost and Risk Register.
