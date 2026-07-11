# AssessSuite Migration — Codex Operating Manual

This file governs Codex work inside this repository:
`C:\Users\Maxwe\Projects\assesssuite_migration`

It is the Codex counterpart to `.claude/agents/` (Claude Code's subagent
configuration for this repo). Read this file in full before material work.

## What this is

AssessSuite (assesssuite.com) is an allied-health workflow application —
onboarding, referral intake, assessments, SOAP notes, report generation,
Stripe subscriptions — being delivered by Maxwell Vidler under UniMatter as a
paid engagement for Brenton Primmer (Prime Health Clinics Australia). This
repository is a captured-verbatim copy of the live Base44-built frontend
(553 files, taken via a read-only connector on 2 July 2026) running against a
local Node backend shim built from scratch to speak the Base44 SDK wire
protocol, so the frontend runs unmodified against `localhost`.

The governing document is the mission order at:
`C:\Users\Maxwe\OneDrive - Maxwell Vidler\Unimatter\00_System\autonomy\mission-orders\20260702-assesssuite-migration-engineering-security-draft.md`
— Annex A governs Claude's engineering/migration/QA lane; **Annex B governs
Codex's independent security-review lane** (withdrawn 2 July 2026, reactivated
by Maxwell 11 July 2026). Read the reactivation note at the top of that
document and Annex B in full before scanning. Its Permitted Scope, Excluded
Scope, Approval Triggers, and Stop Conditions bind Codex exactly as they bind
Claude — nothing in this repository-level file narrows or widens them.

**Role boundary specific to this mission:** the workspace's general agent
router (`Unimatter\00_Context\07-agent-router.md`) treats Codex as the default
conductor for local implementation and verification workspace-wide. This
mission order overrides that default for this specific engagement: Claude is
the engineering/migration/QA/deployment lead here; Codex's role under Annex B
is independent security review, validation, and bounded remediation
proposals — not general feature implementation. Do not take on engineering
work beyond security remediation without Maxwell's separate direction.

## Architecture

- Frontend: Vite/React (`src/`), Radix UI, TanStack Query, React Router —
  captured verbatim from the live Base44 app, largely unmodified except where
  hardening required a change.
- Backend: `server/` — Node `node:http` + `node:sqlite`, zero added
  dependencies, replicating the Base44 SDK wire protocol (entities, auth,
  functions, integrations) so the frontend needs no code changes to run
  locally.
- 15 backend functions ported from Base44 (Stripe checkout/portal/webhook,
  transcription, admin/maintenance functions, etc.).
- 6 platform integrations mocked with deterministic fallbacks (LLM, email,
  SMS, file upload, image generation, document extraction) — the real OpenAI
  model (`server/llm.mjs`) and real Whisper transcription
  (`server/functions/transcribeSession.mjs`) are wired in behind
  `OPENAI_API_KEY`; unset or `SELFTEST=1` always uses the mock.
- Stripe: `server/stripeGateway.mjs` is a real, env-gated adapter behind the
  existing mock contract — see `docs/stripe/20260708-stripe-activation-runbook.md`.
  No live Stripe keys are present in this repository.

## Current verified baseline (confirmed live, 11 July 2026)

- `npm run selftest` — 98/98 passing.
- Gate tests — 13/13. Smoke tests — 10/10.
- `npm run build` — clean (one non-blocking Rollup chunk-size warning).
- Deployed to `unimatter-demo.fly.dev` (Fly.io, Sydney, single always-on
  machine, reseeds synthetic data on boot — do not scale beyond one machine,
  SQLite state would split).
- Branch `main`, working tree clean as at last check.

## Run and test commands

```
npm install          # if node_modules is absent
npm run dev           # Vite dev server, :5173
npm run server        # local backend shim, :8787 (see .env.example for ports/env)
npm run seed          # (re)seed the local SQLite store with synthetic data
npm run selftest      # server/selftest.mjs — the primary regression suite
npm run build         # production build
npm run lint
npm run typecheck
```

No secrets are required to run or test this repository — every integration
falls back to a deterministic mock when its environment variable is unset.
`.env.example` documents every variable; `.env.local` (gitignored) holds this
machine's real values (an OpenAI key, for real-model/transcription testing) —
never read `.env.local`'s contents into a commit, log, or report.

## Security history — read before scanning

Since this repository's creation, Claude ran several engineering and
hardening missions (see mission order Handover Notes and
`docs/qa/` for the full record). Most relevant to Codex:

- `docs/qa/20260703-role-entitlement-isolation-analysis.md` and
  `20260703-gate-test-results.md` — the original RBAC/tenant-isolation gate
  assessment (Gates G5–G9).
- `20260709-final-hardening-session-note.md` — four rounds of adversarial
  multi-agent testing (each finding independently re-verified before being
  logged as closed) found and closed **13 real vulnerabilities** (5/3/5/0
  across the four rounds, the fourth dry): anonymous admin-mint via
  `/users/invite-user` and via unguarded `POST /entities/User`; a mock-mode
  `stripeWebhook` DoS; cross-tenant `org_id` injection across create, PUT,
  bulk-PUT, update-many, `OrganizationMember` self-enrolment and relocation,
  and fail-open behaviour on empty collections/null `org_id`; anonymous
  entity reads; and a report-editing regression that stripped the outcome
  table and letterhead on save. The org-scoping fix was ultimately a
  **structural rewrite** (a static, schema-derived org-scoped entity set,
  `loadOrgScopedEntities()`; a central `writeAuthDenied()`; fail-closed
  `isWithinOrgScope`) — patching instances round-by-round did not converge;
  rewriting the model did.

Treat this record as a floor to independently re-verify, not a substitute for
your own scan — Claude's testing is adversarial multi-agent QA against known
attack classes, not a formal security review, and it is not a replacement for
Annex B's function. Look for what that process would not have been shaped to
find: anything outside the classes above, dependency/supply-chain issues,
anything in the newer Stripe/transcription scaffolding (items 9–10 below),
and anything in code changed after 9 July (the price-id fix in
`PaymentRequired.jsx`, commit `5e4e331`, has not been adversarially tested by
Claude's team).

## Where things stand as of 10–11 July 2026

On 10 July 2026 Maxwell confirmed, directly:
- **Launch vehicle = this repository** ("Path A") — assesssuite.com is to cut
  over to a production deployment of this codebase, not remain on Base44.
- **Stripe = go live** on Brenton's account, test-mode proof first.
- **Transcription = OpenAI Whisper**, already built (item 10 above).

Still open, owed by Maxwell/Brenton, not something to action unprompted:
Stripe live keys; control of the assesssuite.com DNS registrar; an email
provider decision (`server/integrations.mjs` still mocks `SendEmail`/
`SendSMS` — real transactional email is launch-critical for the OTP
signup/login flow and has not been built); a dedicated production Fly app
(any live deploy is authority level L5, reserved to Maxwell); Decision D4
(real versus synthetic launch data, still open).

## Hard boundaries (bind Codex exactly as Claude — see the mission order for the authoritative text)

- No writes to Brenton's live Base44 application; no live Base44 record
  reads beyond schema-level inspection already performed. No live Stripe
  account or live payment flow.
- No real client, patient, clinician, or payment data in any AI tool or
  context — synthetic/de-identified only, until Decision D4 resolves
  otherwise.
- No outbound contact with Brenton or any third party.
- No financial actions of any kind.
- Mission budget is $0 — do not seek approval to spend; use a free/
  open-source alternative and log the deferred recommendation in the
  AssessSuite Decision, Cost and Risk Register instead.
- Any live deployment, DNS change, or credential use beyond what is already
  registered in the mission order's Credential Labels section is an Approval
  Trigger — stop and ask.
- A Live-Verification Action Schedule (LVAS) is required before any live,
  observe-only verification against the production Base44 app; see
  "Controlled Live-Verification Exemption" in the mission order. No LVAS
  authorises Codex (or any agent) to autonomously generate a test account or
  credential on the live app, under any framing.

## Coordination with Claude

Per Annex A/B's mutual coordination rules in the mission order: read the
run-state note and engineering-notes file (in
`Unimatter\02_Client_and_Venture_Matters\AssessSuite\work-product\service-delivery-20260701\`)
before material work; keep a security-notes file and findings register
(format specified in Annex B) rather than a free-standing root-level file in
this repository; do not overwrite Claude's engineering notes; record any
unresolved disagreement in the AssessSuite Decision, Cost and Risk Register.

## Credential handling

Follow the Spend and Credentials Policy at
`Unimatter\05_Agent_Operations\autonomous-operations\spend-and-credentials-policy.md`.
Request credentials by exact environment variable name and purpose; never
commit, log, or print a raw secret; never hardcode a credential; never commit
`.env` or `.env.local`. Record every credential label in
`credential-scope-register.csv` and every external action in
`external-action-register.csv` (both under
`Unimatter\00_System\autonomy\`).
