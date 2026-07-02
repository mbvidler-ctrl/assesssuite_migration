# Role, Approval, Entitlement and Isolation Analysis — Launch Gate QA Baseline

Produced 3 July 2026 by a read-only analysis agent under the migration mission; reviewed and adopted by the lead session. Drives gates G5 (RBAC / issue I1), G6 (tenant isolation), G7 (duplicates / issue I3), G8 (payment/entitlement separation). File:line citations are against the working tree at commit `0a6905e`.

## Headline findings

### G5 / I1 — admin surfaces (CONFIRMED, precisely characterised)

- There is **no route-level role guard anywhere**: `src/App.jsx:63-71` mounts every page in `src/pages.config.js:75-98` under one `ProtectedRoute`, which checks authentication only (`src/components/ProtectedRoute.jsx:11-29`).
- `src/Layout.jsx:189-216` hides the three admin sidebar links for non-admins — cosmetic only ("hidden, not guarded").
- `src/pages/AdminApprovals.jsx` IS guarded (data-load guard at :220-223; render guard at :569-581; the shim additionally 403s non-admin `User.list`).
- **`src/pages/AssessmentAudit.jsx` and `src/pages/AdminAnalytics.jsx` have zero role-awareness** — any authenticated ordinary user reaching them by direct URL gets the full admin UI and live (org-scoped) data, including audit fix/delete controls and the analytics dashboard with CSV export. This is the precise mechanism of issue I1.
- Exhaustiveness: grep of the whole `src` tree finds exactly 8 role-check sites; none belong to AssessmentAudit or AdminAnalytics.

### Approval-model incoherence (NEW finding, product-design question for Max/Brenton)

- `src/Layout.jsx:60-78` gates only on `account_status === "suspended"`; a **`rejected`** user (per `AdminApprovals.jsx:460-471`) with a completed profile and active subscription passes straight into the app. `pending` is likewise never checked.
- `src/pages/ProfileSetup.jsx:202-206` has the client set its own `account_status: "active"` via `updateMe` — self-activation. The admin approve/reject surface therefore administers a status the app does not consistently enforce.
- `src/pages/PendingApproval.jsx:49-51` renders "Account Suspended" copy regardless of actual status value.
- Assessment: the approval model is advisory, not enforced. Whether to enforce it (guard `account_status` server-side + extend the Layout gate) is a product decision — the current app design evidently intends payment-driven self-serve activation. Flagged for decision, not unilaterally changed.

### G8 — payment/role separation (STRUCTURALLY SOUND)

- No code path writes `role` from any payment/subscription event: `stripeWebhook` writes only entitlement fields (`base44/functions/stripeWebhook/entry.ts:26-68`); the sole role write paths are registration default (`'user'`), admin bootstrap, and the admin-only toggle at `AdminApprovals.jsx:1663-1680`.
- The shim additionally strips `role`, `email`, `id`, `created_date` from every `updateMe` (`server/auth.mjs:71,76-82`) and admin-gates direct User-collection writes.
- Minor code smell: `ProfileSetup.jsx:199` calls `updateMe({ role: "user" })` — a stripped no-op; verify end-to-end in QA (test 20).

### G6 — tenant isolation

- Entities layer (shim): org scoping enforced and self-tested (two-org cross-read denials).
- **Functions layer: unscoped and partially unguarded.** The captured source of `auditAssessmentIssues` contains **no auth check at all** — on the live platform, any caller able to reach the function URL receives a whole-database audit across every org's Client/ClientAssessment/Assessment data. `createTestClientWithAssessments` and `verifyTestAssessmentData` need the same review. The shim port preserved the captured (absent) checks; guards to be added as documented remediation.
- **Same-org under-scoping (separate defect class):** `src/pages/Finances.jsx:69,71` and `src/pages/NewAssessment.jsx:38` filter by `created_by` (creator email) instead of `org_id` — in a multi-clinician org, clinicians cannot see each other's clients on those two pages. Not a cross-tenant leak; an intra-tenant inconsistency.
- Org assignment is a copy-pasted get-or-create pattern in four places (`Onboarding.jsx:325-332`, `QuickOnboardModal.jsx:188-218`, `ReferralUploader.jsx:306-328`, `ProfileSetup.jsx:185-200`) — consistency risk. The existence of the `fixUserOrganizations` / `fixMissingOrgIds` remediation functions is direct evidence both failure modes (shared org; missing org_id) have occurred in live data.
- `Clients.jsx:122-137` fails closed (empty + toast) when a user has no OrganizationMember — good for isolation, poor UX.

### G7 / I3 — duplicate clients (CONFIRMED)

- The ONLY duplicate detection is in `ReferralUploader.jsx:211-237` (referral-upload path): exact-DOB AND bidirectional-substring-name, in-memory against the caller's own org's loaded list, advisory only — "Create New Client" is never disabled.
- The standard Onboarding flow and QuickOnboardModal have **no duplicate checking of any kind**.
- Heuristic fragility: no date-format tolerance, no fuzzy name matching ("Jon"/"John" misses), no normalisation beyond lowercase/trim.
- Unrelated: `AdminApprovals.jsx:521-558` "isDuplicate" concerns Assessment catalogue entries, not clients.

## QA negative-test programme (20 tests)

G5: (1) non-admin direct-URL to /AssessmentAudit and /AdminAnalytics — currently renders fully, must refuse after fix; (2) non-admin /AdminApprovals shows guard card and never issues User.list; (3) sidebar hiding is cosmetic-only control test; (4) raw GET entities/User as non-admin → 403; (5) admin-toggle control test.
G6: (6) two-org UI-level cross-reads incl. direct-URL ClientProfile of other org's client; (7) same-org second clinician on /Finances and /NewAssessment (created_by under-scoping); (8) direct POST to auditAssessmentIssues as non-admin cross-org — currently unscoped, must be guarded after fix; repeat for other unguarded functions; (9) no-org user fails closed on /Clients; (10) fixUserOrganizations record-ownership split behaviour (created_by vs assigned_clinician_email fixture).
G7: (11) exact duplicate via Onboarding flow — currently silent success; (12) same via QuickOnboardModal; (13) referral path shows warning but permits "Create New Client" anyway; (14) name-variant blind spot (Jon/Jonathan); (15) DOB transposition blind spot.
G8: (16) updateMe role escalation stripped; (17) full mock checkout + webhook leaves role unchanged while entitlement activates; (18) payment_failed/subscription.deleted only touch entitlement fields and Layout bounces on resulting "suspended"; (19) admin + cancelled subscription precedence (Layout checks suspended before admin bypass — confirm intended); (20) ProfileSetup role no-op end-to-end.

## Remediation queue (to implement in gate-QA phase, each as a documented deviation from capture)

1. Page-level role guards on `AssessmentAudit.jsx` and `AdminAnalytics.jsx`, following the existing `AdminApprovals.jsx` guard pattern (I1 fix, G5).
2. Admin-role guards on unguarded maintenance functions in the shim port (`auditAssessmentIssues`, `createTestClientWithAssessments`, `verifyTestAssessmentData`), matching their admin-only invocation surface (G6).
3. Minimal shared duplicate-check (name+DOB advisory) in Onboarding and QuickOnboardModal create paths, reusing one utility (G7 minimum; full merge workflow remains a product decision for Max/Brenton).
4. FLAG ONLY (product decisions, not unilateral changes): approval-model enforcement (`account_status` guard + Layout gate for pending/rejected); created_by vs org_id scoping on Finances/NewAssessment; Layout suspended-before-admin precedence; Paywall.jsx dead Stripe-payment-link path.
