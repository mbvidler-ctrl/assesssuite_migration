# Launch-readiness patches — unified scope and design

**Prepared:** 14 July 2026
**Author:** Maxwell Vidler (agent-assisted; UniMatter / AssessSuite)
**Repository:** `C:\Users\Maxwe\Projects\assesssuite_launch_ready`
**Branch:** `launch/legal-and-consent-integration`
**Status:** SCOPE AND DESIGN ONLY. No code has been applied, committed, pushed, or deployed. Production (`https://assesssuite.com`) is untouched. Enactment of either patch is reserved to Maxwell's separate, explicit direction after review.

**Consolidation.** This memorandum unifies and supersedes two prior scope-and-design documents, which remain on disk as historical artefacts:

- `docs/launch/20260617-manage-subscription-patch-scope-and-design.md` → **Part A** below, with Maxwell's two authorised decisions baked in as settled.
- `docs/launch/20260714-registration-and-checkout-scope-and-design.md` → **Part B** below, finalised.

**Decisions authorised by Maxwell (now settled, not options).**

- **Decision 1 — loss of access, not deletion (Option A).** The account-closure notice is a loss-of-**access** warning. No back-end deletion cascade is built. `deactivateAccount` retention behaviour is preserved (records retained per the seven-year clinical obligation). The `AccountDeactivated` landing copy is reworded so it does not undercut the notice. See Part A, clauses A.4.6 and A.5.
- **Decision 2 — immediate cancel with disclosure (immediate).** The combined "cancel and close" action cancels the Stripe subscription immediately and closes the account in the same step. The existing no-refund policy governs, disclosed in a secondary line beneath the primary notice. See Part A, clauses A.4.4 and A.4.6.

**Method note (state-truth).** Root causes are established by direct inspection of the exact code paths, each cited to file and line. No live end-to-end run on a server was performed in this pass; reproduction steps are written from the code and may be executed on request in a local mock-mode environment. Nothing below is asserted as observed at runtime that was not.

---

## Overview — two patches

| Patch | Scope | Character |
|---|---|---|
| **Part A — Manage Subscription** | Fix the "authentication required" failure on the billing portal; consolidate all subscription lifecycle actions (annual upgrade; cancel-and-close; payment update) into one interface; remove the stand-alone deactivate control; apply the loss-of-access notice. | Billing surface; depends on Stripe key/portal configuration. |
| **Part B — Registration / Checkout / Admin / Name** | Fix four registration-flow defects: no checkout redirect; duplicate pending registrations (case-sensitive email); admin-approval-appears-required; "No name" in the admin panel. | Onboarding surface; revenue-critical; no new Stripe permissions required. |

The two are independent code changes on largely disjoint files (the only shared files are `server/functions/index.mjs`, where Part A adds a function registration Part B does not touch, and `src/pages/AccountDeactivated.jsx`, touched only by Part A). Both belong to the launch-readiness surface and both should land on `launch/legal-and-consent-integration`. Sequencing is at clause "Sequencing and enactment order".

---

# PART A — Manage Subscription patch (decisions baked in)

## A.1 Executive summary

The "Manage Subscription" control on My Profile fails with "authentication required" because of a single client-side defect: it calls the billing-portal function with a raw `fetch()` that does not attach the session bearer token, whereas every other function call in the application uses the authenticated SDK path (`base44.functions.invoke`). The server is correct; it refuses an unauthenticated billing call by design.

The remedy is in two parts. First, route the call through the authenticated SDK, restoring the portal. Second, consolidate: "Manage Subscription" becomes the single interface for (a) switching to annual billing, (b) cancelling the subscription and closing the account, and (c) updating payment information; the stand-alone "Deactivate Account" control is removed and folded into action (b). Per Maxwell's Decision 1, the closure notice is a loss-of-access warning and no data is deleted; per Decision 2, the combined action cancels immediately.

## A.2 Stack, hosting, billing

| Dimension | Finding |
|---|---|
| Front end | React 18 (Vite 6), React Router 7, Tailwind, Radix UI; SPA built to `dist/`. |
| Back end | Node ≥ 24 dependency-free HTTP shim (`server/index.mjs`) reproducing the Base44 wire protocol; SQLite persistence; functions router (`server/functions/index.mjs`). |
| Auth | Session bearer token; login mints it (`server/index.mjs:797`); the SDK attaches `Authorization: Bearer <token>` on every call; server resolves the caller from that header (`server/index.mjs:229`; `server/functions/_shared.mjs:129`). |
| Billing | Stripe. Functions `createCheckoutSession`, `createPortalSession`, `stripeWebhook`, `syncStripeSubscription` behind one switch (`server/stripeGateway.mjs:39`). Default is the in-memory mock (`server/mocks/stripe.mjs`); `STRIPE_SECRET_KEY` selects the live adapter. |
| Plans | Monthly (AUD 55), Annual (AUD 540); resolved from `STRIPE_PRICE_ID_MONTHLY` / `_ANNUAL` (`server/functions/createCheckoutSession.mjs:31-33`). |
| Deploy | Fly.io, single machine + single volume; production app `assesssuite-production` (`fly.production.toml:28`); `fly deploy -c fly.production.toml --strategy immediate`; domain `assesssuite.com`. |

## A.3 Diagnosis of "authentication required"

**Failing path.** The "Manage Subscription" button (`src/pages/MyProfile.jsx:706-708`) calls `handleManageSubscription` (`src/pages/MyProfile.jsx:228-244`), which issues a raw `fetch('/functions/createPortalSession', ...)` with only a `Content-Type` header — no `Authorization` (`src/pages/MyProfile.jsx:230-233`). The relative-functions passthrough (`server/index.mjs:1196-1203`) forwards it; the router resolves no bearer token, and because `createPortalSession` is in `REQUIRES_SESSION` (`server/functions/index.mjs:92-99`), returns 401 `{ error: 'authentication required' }` (`server/functions/index.mjs:162-166`), surfaced via `alert` (`src/pages/MyProfile.jsx:239`).

**Root cause.** The server is correct (anonymous billing calls were closed as a Stripe-abuse vector). The defect is client-side and singular: `handleManageSubscription` is the **only** place in the entire `src/` tree calling a function by raw `fetch` rather than the authenticated SDK — sole caller of `createPortalSession` (`src/pages/MyProfile.jsx:230`) and sole raw `fetch('/functions/...')` in `src/` (same line). Every other call uses `base44.functions.invoke` (e.g. `src/functions/createCheckoutSession.js:6`; `src/pages/PaymentRequired.jsx:18`; the sibling deactivate at `src/pages/MyProfile.jsx:75`).

**Secondary latent fault.** `createPortalSession` returns 400 when `stripeCustomerId` is absent (`server/functions/createPortalSession.mjs:18-20`); the handler passes `user?.stripe_customer_id` (`src/pages/MyProfile.jsx:233`), so an administrator-activated or never-synced account sees a raw error. The design handles this gracefully (sync-then-fallback).

## A.4 Design — one interface, three actions

A Radix `Dialog` presents three actions; the stand-alone "Deactivate Account" card and dialog are removed (A.5).

```
Manage Subscription
├─ (a) Switch to annual billing        → Stripe Billing Portal (subscription-update flow)
├─ (c) Update payment information       → Stripe Billing Portal (payment-method-update flow)
└─ (b) Cancel subscription & close account → in-app combined action + loss-of-access notice
```

Actions (a) and (c) route to the Stripe Billing Portal so card data never touches our servers (PCI scope minimisation; the workspace prohibition on handling payment secrets). Action (b) must be custom code, because it combines a Stripe cancellation with an AssessSuite account-state change and carries a specific notice the portal cannot present.

### A.4.2 Action (a) — Switch to annual billing

No implementation exists on an existing subscription (a fresh checkout would create a second subscription). Recommended: open the Billing Portal with `flow_data[type]=subscription_update`, extending `createPortalSession` to accept an optional `flow` argument (`server/functions/createPortalSession.mjs`; gateway `server/stripeGateway.mjs:146-151`). Dashboard precondition: the annual price is a portal product and plan-switching is enabled. Alternative (native subscription-item price swap) requires **Subscriptions: Write** on the Stripe key (A.4.4.2); the portal route is preferred. Stripe call: `POST /v1/billing_portal/sessions` with `flow_data`.

### A.4.3 Action (c) — Update payment information

Open the Billing Portal with `flow_data[type]=payment_method_update`. Same server/gateway extension as (a). Stripe call: `POST /v1/billing_portal/sessions`.

### A.4.4 Action (b) — Cancel subscription and close account (Decision 2: immediate)

Consolidates Stripe cancellation with AssessSuite deactivation, resolving the open decision recorded at `docs/launch/20260713-go-live-runbook.md:82`.

**New server function** `cancelSubscriptionAndDeactivate` (register in `REQUIRES_SESSION`, `server/functions/index.mjs:92-99`; works from any account status):

1. Resolve `ctx.user`; refuse if absent (401) or administrator (403), mirroring `deactivateAccount` (`server/functions/deactivateAccount.mjs:18-25`).
2. If the user has a `stripe_subscription_id`, cancel it **immediately** via the new gateway method (A.4.4.1). If absent (administrator-activated, never synced, already cancelled), skip silently and proceed.
3. Set `account_status: 'deactivated'` and `deactivated_date` — identical to `deactivateAccount`. **No data is deleted (Decision 1).**
4. Return `{ status: 'deactivated', subscription: 'cancelled' | 'none' }`.

The client invokes it via `base44.functions.invoke('cancelSubscriptionAndDeactivate', {})`, then logs out to `AccountDeactivated` (as `confirmDeactivate` does today, `src/pages/MyProfile.jsx:75-80`). The loss-of-access notice (A.4.6) is shown in the confirmation step before the action fires.

**A.4.4.1 New gateway method (Decision 2: immediate cancel).** `server/stripeGateway.mjs` gains `cancelSubscription(subscriptionId)` performing `DELETE /v1/subscriptions/{id}` — billing stops at once, consistent with the account closing at once. The user forfeits the remainder of any paid period; the existing no-refund policy governs (`src/legal-content/08_subscription_cancellation_and_refund_policy.md`; `src/pages/Landing.jsx:766`) and is disclosed in the secondary notice line (A.4.6). A mock counterpart in `server/mocks/stripe.mjs` marks the mock subscription `canceled` so the self-test never touches the network. Users needing cancel-at-period-end (rare) are directed to admin@assesssuite.com for bespoke handling.

**A.4.4.2 Stripe key permission (dependency).** The restricted key currently requested grants **Subscriptions: Read** only (`docs/launch/20260713-go-live-runbook.md:40`). An immediate cancellation is a **write**. **Subscriptions: Write** must be added to the key before this action functions in live mode (a merchant action). Mock mode and the self-test are unaffected.

**A.4.4.3 Portal native-cancel (configuration).** Because (a) and (c) send users into the Billing Portal, and the portal exposes its own "Cancel subscription" button, the portal's native cancellation must be **disabled** in the Customer Portal configuration — otherwise a user could cancel billing without closing the account, re-opening the gap this patch closes.

### A.4.5 Portal-open fix and removal of the stand-alone control

Replace the raw fetch in `handleManageSubscription` (`src/pages/MyProfile.jsx:228-244`) with the authenticated SDK path:

```jsx
// PROPOSED — not applied
const handleManageSubscription = async () => {
  try {
    const me = await base44.auth.me();
    let customerId = me?.stripe_customer_id;
    if (!customerId) {
      try { await base44.functions.invoke('syncStripeSubscription', {}); } catch { /* fall through */ }
      customerId = (await base44.auth.me())?.stripe_customer_id;
    }
    if (!customerId) {
      toast.error('No billing account is linked yet. Complete a subscription first, or contact admin@assesssuite.com.');
      return;
    }
    const res = await base44.functions.invoke('createPortalSession', { stripeCustomerId: customerId });
    const url = res?.data?.url;
    if (url) window.location.href = url;
    else toast.error(res?.data?.error || 'Unable to open the subscription portal. Please contact support.');
  } catch {
    toast.error('Something went wrong. Please try again.');
  }
};
```

The stand-alone "Deactivate Account" card (`src/pages/MyProfile.jsx:733-757`) and its `AlertDialog` (`src/pages/MyProfile.jsx:759-782`) are deleted; their logic (`handleDeactivateAccount`, `confirmDeactivate`, `isDeactivating`, `showDeactivateDialog`) moves into the dialog's action (b). The "Logout" card (`:713-731`) is retained.

### A.4.6 Notice copy (verbatim, settled)

Primary notice, verbatim as Maxwell specified:

> **Notice:** closing your account will result in the loss of access to the AssessSuite platform and all data associated with that account, including but not limited to treatment records, patient details, policies, and consents.

Secondary disclosure line, immediately below (Decision 2, verbatim):

> Your subscription will be cancelled and billing will stop. No refund is provided for the unused portion of the current billing period.

## A.5 Copy change — closure surfaces (Decision 1)

| # | File | Lines | Change |
|---|---|---|---|
| 1 | `src/pages/MyProfile.jsx` | 733-734 | Remove comment when the card is removed (A.4.5). |
| 2 | `src/pages/MyProfile.jsx` | 740-744 | Card removed; superseded by the notice in the new dialog. |
| 3 | `src/pages/MyProfile.jsx` | 764-772 | Dialog removed; replaced by the notice at A.4.6. |
| 4 | `src/pages/AccountDeactivated.jsx` | 22-26 | Reword to speak of loss of access, not record retention (Decision 1). Settled replacement wording below. |

**AccountDeactivated landing — settled replacement copy (Decision 1):**

> Your account has been closed. You no longer have access to the AssessSuite platform, or to the treatment records, patient details, policies, and consents associated with that account. Any records that Assess Suite Pty Ltd is required to retain under law and professional obligation are held securely and are not accessible through your account.

**Out of scope (unchanged):** `src/pages/Clients.jsx:230-239` and `src/pages/ClientProfile.jsx:269-283` (client archiving — genuinely retains; accurate); `src/pages/Landing.jsx:707, 720, 766` (Terms/Privacy/cancellation legal text); `src/legal-content/*` (policy corpus).

## A.6 Data-integrity position (Decision 1, settled)

`deactivateAccount` deletes nothing (`server/functions/deactivateAccount.mjs:9-30`); records are retained, org-scoped and encrypted, for the professional retention period, and the server refuses clinical access for any non-active status (`server/index.mjs:381-390`). The user loses access immediately; the data persists. The notice is truthful as a loss-of-access statement, and the reworded landing copy is consistent with it. No deletion cascade is built. This position is settled per Decision 1 and is **not** an open question.

---

# PART B — Registration / Checkout / Admin / Name patch (finalised)

## B.0 Summary and incident chain

A prospective customer (`lachlan_keirnan@outlook.com`) registered on 14 July 2026, received the "pending until payment" email, never reached Stripe checkout, and appears twice in the admin panel — both "No name". A colleague, seeing Approve/Reject controls, asked whether approval was required.

| Issue | Diagnosis | Severity |
|---|---|---|
| 1 — no checkout redirect | Checkout fires only at the end of the long mandatory `ProfileSetup` form placed between OTP and payment; no direct register→checkout path; any incompletion or non-URL response leaves the account pending, unpaid. | High (revenue) |
| 2 — duplicate registrations | Case-sensitive email handling; a case-variant re-attempt (`lachlan_` vs `Lachlan_`) defeats the resume logic and creates a second pending record and organisation. | High (integrity/billing) |
| 3 — admin approval appears required | Auto-activation works, but the "Pending Approvals" queue presents unpaid registrants with prominent Approve/Reject, reading as a required step it is not. | Medium |
| 4 — "No name" | Registration captures no name, and the admin panel reads `full_name` while onboarding writes `clinician_name`. | Medium |

**Likely chain:** registered (email fired) → hit the friction wall (OTP or the long form) → abandoned → retried with a leading capital → duplicate; both "No name" (none captured); colleague read the approvals queue as mandatory.

## B.1 Issue 1 — no checkout redirect

**Reproduction (from code).** Landing CTAs navigate to `/register` with no plan (`src/pages/LandingLive.jsx:522, 533`); `/register` collects email+password only (`src/pages/Register.jsx:33`); OTP verify redirects to Dashboard (`src/pages/Register.jsx:52`); `Layout` sends a user with no `clinician_name` to `/ProfileSetup` (`src/Layout.jsx:67-70`); `ProfileSetup` is a long form (`src/pages/ProfileSetup.jsx:164-217`), and only its successful submission calls `createCheckoutSession` and redirects to Stripe (`src/pages/ProfileSetup.jsx:290-298`).

**Root cause.** Checkout is gated behind completing `ProfileSetup`; there is no direct register→checkout path. Failure modes: abandonment at the form (primary); silent failure if `createCheckoutSession` returns no URL (`src/pages/ProfileSetup.jsx:296-303`), which occurs in live mode when the price is unset — 500 "Stripe price not configured" (`server/functions/createCheckoutSession.mjs:35-40`); OTP non-delivery (contributing); and the landing plan selection is discarded, so `ProfileSetup` hard-codes `plan: "monthly"` (`src/pages/ProfileSetup.jsx:291`).

**Design — recommendation Design A (payment before the profile form).** After OTP, route to `/PaymentRequired` (the working two-plan chooser, `src/pages/PaymentRequired.jsx:9-41`), carrying the chosen plan; move the full profile and practitioner notices to a post-activation first-run gate. Legal-notice capture remains a mandatory gate, enforced server-side (`server/index.mjs:397-400`). Design B (harden the existing order) is the minimal alternative: make the checkout failure explicit and recoverable, confirm live Stripe mode + prices, and carry the plan through. Recommendation: Design A; adopt Design B items (i) and (iii) regardless. Both depend on the deployment being in real Stripe mode with prices set (a go-live checklist item, `docs/launch/20260713-go-live-runbook.md` Phase 3).

## B.2 Issue 2 — duplicate pending registrations

**Reproduction (from code).** Register `lachlan_keirnan@...` (pending, unverified, `server/index.mjs:832-837`); re-register `Lachlan_keirnan@...`; `findUserByEmail` uses exact `u.email === email` (`server/index.mjs:777-779`), so the variant does not match and the resume branch (`server/index.mjs:810-837`) never engages — a second record is created.

**Root cause.** Email is never normalised; `server/auth.mjs` has no normalisation helper, and `email` is guarded on `updateMe` (`server/auth.mjs:76-85`). The duplicate-guard is otherwise correct (`server/index.mjs:810-821`) but keyed on the exact-match lookup. Same case-sensitivity is a latent login defect (`server/index.mjs:785`). `findUserByEmail` (`server/index.mjs:777`) is used by register (`:810`), verify-otp (`:855`), resend-otp (`:904`), reset-request (`:924`), login (`:784`), invite (`:994`).

**Design.** Normalise email (`trim().toLowerCase()`) at the server boundary — a `normaliseEmail` helper applied on create and inside `findUserByEmail`, making all lookups case-insensitive at once; the existing resume branch then handles the retry correctly (no duplicate). Optionally a clearer resume message. The two existing live records are reconciled manually (see rollout).

## B.3 Issue 3 — admin approval appears required

**Reproduction (from code).** An unpaid registrant stays `pending`; the "Pending Approvals" tab lists them with Approve/Reject (`src/pages/AdminApprovals.jsx:621-665`; filter `:515`); `handleApprove` sets `account_status: 'active'` directly (`src/pages/AdminApprovals.jsx:445-451`), bypassing payment.

**Root cause.** Auto-activation works (`server/functions/stripeWebhook.mjs:62-138`); `Layout` routes pending users to `/PaymentRequired` (`src/Layout.jsx:96-99`). The defect is presentation: the queue implies an admin decision is pending when the account is merely awaiting its own payment; approving grants unpaid access; the queue conflates ordinary not-yet-paid registrants with genuinely stuck accounts (payment_failed / webhook failure).

**Design — recommendation option (ii), re-scope as a labelled fallback.** Removing admin activation (option i) is rejected — legitimate needs remain (comp/enterprise accounts; webhook-failure recovery; the go-live plan contemplates it). Recommendation: relabel the queue "Awaiting payment" with a banner ("Accounts activate automatically on successful subscription payment; manual activation is a fallback for exceptions only"); guard `handleApprove` behind a confirmation stating it grants access without payment and rename it "Activate without payment (exception)"; segment payment_failed / long-pending accounts from fresh registrants; retain Reject unchanged.

## B.4 Issue 4 — "No name"

**Reproduction (from code).** Registration sends only `{email, password}` (`src/pages/Register.jsx:33`); the admin pending list renders `user.full_name || 'No name'` (`src/pages/AdminApprovals.jsx:634`).

**Root cause — two faults.** (a) Name is never captured at registration; the server persists custom fields (`server/index.mjs:823-836`) but none carry a name. (b) Field-name mismatch: the panel reads `full_name`, onboarding writes `clinician_name` (`src/pages/ProfileSetup.jsx:257`, name field `:49`), so even onboarded users show no name in admin, and other lists fall back only to email (`:683, :813`).

**Design.** Capture a name at registration (required first/last or single full-name field) and send it as `full_name` (and/or `clinician_name`). Fix the admin display to `clinician_name || full_name || email` at `src/pages/AdminApprovals.jsx:634` and, for consistency, `:683, :781, :813, :1484, :1597`. Optionally include the name in `adminNotifyEmail` (`server/email.mjs:128-134`).

---

# Sequencing and enactment order

**Independence.** Part A and Part B are independent code changes on largely disjoint files. Shared touch-points: `server/functions/index.mjs` (Part A adds a function to `REQUIRES_SESSION`; Part B does not touch it) and `src/pages/AccountDeactivated.jsx` (Part A only). There is no code conflict; neither patch depends on the other to compile or function.

**Recommended order: Part B first, then Part A.**

1. **Stripe configuration — before Part A, any time, no deploy (merchant + dashboard).** These are prerequisites for Part A only; Part B needs none of them.
   - Add **Subscriptions: Write** to the restricted Stripe key (A.4.4.2) — required for the immediate-cancel action to function in live mode.
   - Configure the live Customer Portal (A.4.4.3): list the annual price and enable plan switching (action a); enable the payment-method-update flow (action c); **disable** the portal's native cancellation button. This can be done independently at any time before Part A lands and does not affect Part B.
   - Confirm live Stripe mode with `STRIPE_PRICE_ID_MONTHLY` / `_ANNUAL` set — this is a prerequisite for **Part B** (Issue 1) as well, and a standing go-live item.
2. **Part B lands first.** Rationale: the broken registration→checkout flow is presently blocking real subscribers from paying — it is the revenue-critical defect and the one the live incident surfaced. It also exercises the highest-traffic path (register / OTP / checkout / admin), so shaking out CI on Part B first de-risks the launch surface most. Part B requires no new Stripe permissions, so it is not gated on the merchant action in step 1 (only on live Stripe mode + prices, already required for launch).
3. **Part A lands second**, once the Stripe key/portal configuration in step 1 is in place, so its cancel/upgrade/payment actions function in live mode on arrival.

**Branch and deploy shape.** Single working branch off `launch/legal-and-consent-integration` (the current branch), with two logically-separate commit groups — Part B first, then Part A — so each is independently revertible. Two options for deployment:

- **Recommended: two sequential deploys off the one branch.** Commit Part B → deploy → verify registration/checkout/admin in production → commit Part A → deploy → verify subscription management. This isolates the revenue-critical fix, lets it soak, and keeps each rollback a clean single-image swap. The single-machine topology makes a full image deploy cheap and atomic.
- **Alternative: one branch, one deploy.** Both commit groups, a single image, one smoke pass. Faster, but couples the two verifications and a rollback reverts both. Acceptable only if step 1's Stripe configuration is fully in place and Maxwell wants a single cutover.

Separate branches are not warranted: there is no file conflict, and a single branch with ordered commit groups already provides independent revertibility.

---

# Consolidated risks and open questions for Maxwell

**Resolved and closed (no longer open):**

- ~~Deletion vs loss of access~~ — **settled: Decision 1 (loss of access; no deletion; landing reworded).**
- ~~Immediate cancel vs period-end~~ — **settled: Decision 2 (immediate cancel; no-refund disclosure line).**
- ~~Filename date of the original memo~~ — moot; this unified memorandum is correctly dated.

**Open:**

1. **Part B, Issue 1 design.** Design A (payment before the profile form; recommended) vs Design B (harden the existing order). Design A reorders the onboarding gate chain — a larger change. Which does Maxwell want?
2. **Part B, consent timing under Design A.** Moving the full `ProfileSetup` after payment captures the practitioner notices post-payment (still before any clinical use, enforced server-side). Acceptable, or retain notice capture pre-payment while moving only the heavy profile fields?
3. **Part B, Issue 3 direction.** Confirm option (ii) (re-scoped fallback; recommended) over option (i) (remove manual activation entirely).
4. **Part B, Issue 4 name shape.** First/last pair or single full-name field; and canonical store (`full_name`, `clinician_name`, or both kept in sync). Recommendation: capture at registration; read `clinician_name || full_name || email` in admin.
5. **Part A, Stripe key permission.** Arrange **Subscriptions: Write** on the restricted key with the merchant before Part A lands (sequencing step 1).
6. **Part A, Stripe portal configuration.** Annual price listed + plan switching on; payment-method-update flow on; native cancel **disabled** (sequencing step 1).
7. **Part A, `stripe_customer_id` / `stripe_subscription_id` absence.** Administrator-activated accounts may carry neither; the design degrades gracefully. Confirm the "no billing account is linked" message is acceptable.
8. **Part B, existing duplicate data.** Who reconciles the two live `lachlan_keirnan@...` records and any duplicate organisation, and when (an administrator action on production data).
9. **Enactment authority.** Both patches remain scope-and-design; nothing is enacted until Maxwell directs it. The live payment leg is performed personally by Maxwell (runbook invariant 5); agents never execute payments.

---

# Consolidated test plan

The application ships a deterministic self-test (`npm run selftest`, currently 102/102) and gate-tests; both must stay green. Pre-patch failure cases are pinned as contract tests.

**Contract tests (pin the five reported failures):**

- **Part A — 401 on Manage Subscription.** `createPortalSession` with a valid bearer token + `stripeCustomerId` → 200 `{ url }` (mock); without a token → 401 `{ error: 'authentication required' }`. Documents that the pre-patch failure was a missing header, not a server fault, and locks the fix.
- **Part B — missing checkout redirect.** Post-fix, a fresh registration → OTP → lands on `/PaymentRequired` with the chosen plan and reaches a checkout URL without first completing the full profile form.
- **Part B — duplicate pending record.** Register `A@x.com` then `a@x.com` → the second resumes the first: one pending record, code re-sent, no second organisation; login succeeds with either casing.
- **Part B — missing name.** Register with a name → the created `User` carries it and it renders in the admin pending list (not "No name").
- **Part B — admin approval when auto-activation intended.** `checkout.session.completed` flips `pending → active` (auto-activation intact); the pending queue reads "Awaiting payment" with the banner; manual activation requires confirmation and is labelled an exception.

**Unit / integration (server, selftest harness):**

- Part A: `stripeGateway.cancelSubscription` issues `DELETE /v1/subscriptions/{id}` in live mode; mock counterpart marks the subscription `canceled`; missing/blank id handled without throwing. `createPortalSession` `flow` argument passes the correct `flow_data[type]` and omits it when absent. `cancelSubscriptionAndDeactivate`: non-admin with a subscription → 200, canceled + deactivated; with no subscription → 200, `subscription: 'none'`, still deactivated; admin → 403; anonymous → 401.
- Part B: email normalisation across register/login/otp/resend/reset (case-insensitive); name persisted on register and exposed via `stripAuthFields`; webhook `rejected`/`deactivated` never activated (unchanged).

**End-to-end (browser, mock mode):**

- Part A: click "Manage Subscription" (logged in) → portal opens (no auth error); dialog action (a) → portal subscription-update URL; (c) → portal payment-update URL; (b) → shows the loss-of-access notice + disclosure line, then deactivates and lands on the reworded `AccountDeactivated`.
- Part B: registration → payment (Design A); case-variant retry → single record; admin queue re-scoped; name shown.
- Full launch smoke path green (register → OTP → consents → pay → clinical flow → report → archive client → close account), per `docs/launch/20260713-go-live-runbook.md:61`.

**Live (Maxwell).** Agents never execute payments. The live cancel/close and the live checkout are performed personally by Maxwell against throwaway accounts with a real card.

---

# Consolidated rollout plan

**Branch.** Single working branch off `launch/legal-and-consent-integration`, two commit groups (Part B, then Part A). Do **not** touch `SUITE_VERSION` / `LEGAL_SUITE_VERSION` (runbook invariant 1).

**Pre-flight (no deploy).** Complete sequencing step 1 (Stripe key **Subscriptions: Write**; portal configuration; confirm live Stripe mode + prices). Part B may proceed once live Stripe mode + prices are confirmed; Part A additionally requires the key/portal changes.

**Deploy (recommended two-stage):**

1. `npm run selftest` + gate-tests green; `npm run build` clean; lint at baseline.
2. Local browser smoke (mock mode); staging rehearsal on the demo app (`unimatter-demo`).
3. Commit Part B → `fly deploy -c fly.production.toml --strategy immediate` → post-deploy smoke on `assesssuite.com` (registration → checkout → admin queue → name). Soak.
4. Commit Part A → `fly deploy -c fly.production.toml --strategy immediate` → post-deploy smoke (portal opens; three dialog actions; the loss-of-access notice reads verbatim; the reworded landing).

**Rollback playbook.** Each stage is a clean image swap: `fly releases -a assesssuite-production` then `fly releases rollback` (or `fly deploy --image <previous>`). Both patches are code-only with no schema migration, so rollback restores the prior image without data transformation. Daily volume snapshots (5-day retention) are the data backstop. Because Part B deploys first and soaks before Part A, a fault in either is isolated to a single-image rollback.

**Data reconciliation (Part B).** Before or at Part B enactment, reconcile the two live `lachlan_keirnan@...` records and any duplicate organisation: keep the record the customer proceeds on, reject/close the other, confirm no orphaned organisation remains. An administrator action on production data, reserved to Maxwell.

**Comms (Part A).** Behaviour change: closing an account now cancels billing in the same step (previously it left the subscription running). Any existing subscriber who self-deactivated and is still being billed should be identified and handled out of band before or at Part A enactment.

---

# Consolidated change surface — every file, every line

## Part A — Manage Subscription

| # | File | Lines | Change |
|---|---|---|---|
| A1 | `src/pages/MyProfile.jsx` | 228-244 | Replace raw-fetch `handleManageSubscription` with authenticated SDK path + graceful no-customer handling. |
| A2 | `src/pages/MyProfile.jsx` | 698-711 | "Subscription" card button opens the new Manage Subscription dialog (three actions). |
| A3 | `src/pages/MyProfile.jsx` | 733-757 | Remove stand-alone "Deactivate Account" card. |
| A4 | `src/pages/MyProfile.jsx` | 759-782 | Remove stand-alone deactivate `AlertDialog`. |
| A5 | `src/pages/MyProfile.jsx` | 66-86 | Move `isDeactivating` / `showDeactivateDialog` / `handleDeactivateAccount` / `confirmDeactivate` into the dialog's action (b). |
| A6 | `src/pages/AccountDeactivated.jsx` | 22-26 | Reword to loss-of-access copy (Decision 1; settled wording in A.5). |
| A7 | `server/functions/createPortalSession.mjs` | 14-40 | Accept optional `flow`; pass `flow_data` for subscription-update / payment-method-update. |
| A8 | `server/stripeGateway.mjs` | 146-151 | Extend `createPortalSession` to forward `flow_data`; add `cancelSubscription(subscriptionId)` = `DELETE /v1/subscriptions/{id}`. |
| A9 | `server/mocks/stripe.mjs` | new | Mock `cancelSubscription` marking the mock subscription `canceled`. |
| A10 | `server/functions/cancelSubscriptionAndDeactivate.mjs` | new | Combined immediate-cancel + deactivate function (A.4.4). |
| A11 | `server/functions/index.mjs` | 31-99 | Import/register the new function; add to `REQUIRES_SESSION`. |
| A12 | `src/functions/createPortalSession.js` | new (optional) | SDK shim mirroring `src/functions/createCheckoutSession.js:6`. |

*Reference (unchanged): `src/pages/PaymentRequired.jsx:9-41`; `src/functions/createCheckoutSession.js:6`; `src/pages/MyProfile.jsx:75`.*

## Part B — Registration / Checkout / Admin / Name

| # | File | Lines | Issue |
|---|---|---|---|
| B1 | `src/pages/Register.jsx` | 12-40, 160-220 | 1, 4 (route to payment; capture name) |
| B2 | `src/pages/Register.jsx` | 42-58 | 1 (post-OTP route to `/PaymentRequired`) |
| B3 | `src/pages/LandingLive.jsx` | 522, 533 | 1 (carry plan selection) |
| B4 | `src/pages/PaymentRequired.jsx` | 9-41 | 1 (honour incoming plan) |
| B5 | `src/Layout.jsx` | 67-99 | 1 (reorder gate: payment before full profile) |
| B6 | `src/pages/ProfileSetup.jsx` | 290-298 | 1 (remove checkout from this form once payment precedes it) |
| B7 | `server/auth.mjs` | new helper | 2 (`normaliseEmail`) |
| B8 | `server/index.mjs` | 777-779 | 2 (`findUserByEmail` case-insensitive) |
| B9 | `server/index.mjs` | 782-799, 801-847, 850-975, 994 | 2 (normalise email in register/login/otp/resend/reset/invite) |
| B10 | `src/pages/AdminApprovals.jsx` | 619-665 | 3 (relabel queue; auto-activation banner; segment stuck accounts) |
| B11 | `src/pages/AdminApprovals.jsx` | 445-458 | 3 (confirm + rename manual activation) |
| B12 | `src/pages/AdminApprovals.jsx` | 634, 683, 781, 813, 1484, 1597 | 4 (name fallback `clinician_name || full_name || email`) |
| B13 | `server/email.mjs` | 128-134 | 4 (optional: name in admin-notify email) |

**Diagnosis-only (cited, unchanged):** `server/functions/index.mjs:92-99, 162-166`; `server/index.mjs:1196-1203` (Part A); `server/functions/stripeWebhook.mjs:62-138`; `src/Layout.jsx:67-99`; `server/auth.mjs:76-85` (Part B).

*End of unified memorandum.*
