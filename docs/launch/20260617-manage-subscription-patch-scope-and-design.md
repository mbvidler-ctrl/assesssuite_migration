# Manage Subscription — patch scope and design

**Prepared:** 14 July 2026
**Author:** Maxwell Vidler (agent-assisted; UniMatter / AssessSuite)
**Repository:** `C:\Users\Maxwe\Projects\assesssuite_launch_ready`
**Branch:** `launch/legal-and-consent-integration`
**Status:** SCOPE AND DESIGN ONLY. No code in this proposal has been applied. Nothing has been committed, pushed, or deployed. Enactment on the live codebase at `https://assesssuite.com` is reserved to Maxwell's express, separate authorisation.

> **SUPERSEDED — historical artefact (retained).** This memorandum has been consolidated into `docs/launch/20260714-launch-readiness-patches-scope-and-design.md` (Part A), which folds in Maxwell's two authorised decisions (loss-of-access notice; immediate cancel) as settled and adds cross-patch sequencing, risk, test, and rollout planning. Read the unified memorandum for the operative plan; this file is kept for lineage only.

> **Filename note (flag).** This memorandum was requested under the filename `20260617-...`. The workspace naming convention dates a file to its creation date, which is 14 July 2026 (`20260714-...`). The requested name has been used verbatim so the reviewer finds the file where it was expected; the date component appears to be a transposition. The file may be renamed to `20260714-manage-subscription-patch-scope-and-design.md` on request.

---

## 1. Executive summary

The "Manage Subscription" control on the My Profile page fails with "authentication required" because of a single client-side defect: it calls the billing-portal function with a raw `fetch()` that does not attach the session bearer token, whereas every other function call in the application uses the authenticated SDK path (`base44.functions.invoke`). The server is behaving correctly; it refuses an unauthenticated billing call by design.

The remedy is in two parts. First, a one-line-class correction to route the call through the authenticated SDK, restoring the portal. Second, a consolidation: "Manage Subscription" becomes the single interface for all subscription lifecycle actions — (a) switching to annual billing, (b) cancelling the subscription and closing the account, and (c) updating payment information — and the present stand-alone "Deactivate Account" control is removed and folded into action (b). The misleading closure copy (which reassures the user that records are retained) is replaced with the verbatim loss-of-access notice Maxwell has specified.

One matter requires Maxwell's decision before enactment and is flagged prominently at clause 5 and clause 8: the new notice speaks of the "loss of ... all data associated with that account", whereas the platform deliberately **retains** clinical records on closure (it does not delete them), for professional record-keeping reasons already built into the retention model. Whether the notice is a loss-of-*access* warning (recommended, and consistent with the current, lawful behaviour) or a promise of actual deletion (a much larger change that conflicts with the seven-year clinical retention obligation) is a product and compliance decision that only Maxwell may take.

---

## 2. Stack, hosting, and billing provider

| Dimension | Finding |
|---|---|
| Front end | React 18 (Vite 6), React Router 7, Tailwind, Radix UI. Single-page application built to `dist/`. |
| Back end | Node ≥ 24 dependency-free HTTP shim (`server/index.mjs`) reproducing the Base44 SDK wire protocol; SQLite (`node:sqlite`) persistence; a ported functions router (`server/functions/index.mjs`) dispatching fifteen-plus Base44 functions. |
| Auth mechanism | Session bearer token. Login mints a token (`server/index.mjs:797`); the SDK stores it and attaches `Authorization: Bearer <token>` on every entity, integration, and function call. The server resolves the caller from that header (`resolveSessionUser`, `server/index.mjs:229`; `resolveUser`, `server/functions/_shared.mjs:129`). |
| Billing provider | **Stripe.** Four ported functions — `createCheckoutSession`, `createPortalSession`, `stripeWebhook`, `syncStripeSubscription` — behind a single mode switch (`server/stripeGateway.mjs:39`, `stripeEnabled()`). Default is a deterministic in-memory mock (`server/mocks/stripe.mjs`); setting `STRIPE_SECRET_KEY` switches to the live api.stripe.com adapter. |
| Plans | Two: Monthly (AUD 55) and Annual (AUD 540). Resolved from `STRIPE_PRICE_ID_MONTHLY` / `STRIPE_PRICE_ID_ANNUAL` by a `plan` value of `"monthly"` or `"annual"` (`server/functions/createCheckoutSession.mjs:31-33`). |
| Deploy pipeline | Fly.io, single machine + single encrypted volume (SQLite topology constraint). Production app `assesssuite-production` (`fly.production.toml:28`), region `syd`. Deploy command `fly deploy -c fly.production.toml --strategy immediate`. Public domain `assesssuite.com` maps to this app (go-live runbook, `docs/launch/20260713-go-live-runbook.md`). The demo app `unimatter-demo` (`fly.toml`) is a separate, mock-mode target. |

---

## 3. Reproduction and diagnosis of "authentication required"

### 3.1 The failing path

1. My Profile renders a "Manage Subscription" button (`src/pages/MyProfile.jsx:706-708`).
2. Its handler, `handleManageSubscription` (`src/pages/MyProfile.jsx:228-244`), issues a **raw** `fetch('/functions/createPortalSession', ...)` with only a `Content-Type` header — **no `Authorization` header** (`src/pages/MyProfile.jsx:230-233`).
3. The request reaches the relative-functions passthrough (`server/index.mjs:1196-1203`), which forwards to the functions router without adding auth.
4. The router resolves the caller from the (absent) bearer token, obtains `null`, and — because `createPortalSession` is in the `REQUIRES_SESSION` set (`server/functions/index.mjs:92-99`) — returns **HTTP 401 `{ error: 'authentication required' }`** (`server/functions/index.mjs:162-166`).
5. The handler surfaces that message to the user via `alert(data.error ...)` (`src/pages/MyProfile.jsx:239`).

### 3.2 Root cause

The server is correct: anonymous reachability of the billing functions was deliberately closed as a Stripe-abuse vector (`server/functions/index.mjs:89-99`). The defect is entirely client-side. `handleManageSubscription` is the **only** place in the entire `src/` tree that calls a function by raw `fetch` rather than through the authenticated SDK:

- Sole caller of `createPortalSession`: `src/pages/MyProfile.jsx:230`.
- Sole raw `fetch('/functions/...')` in `src/`: `src/pages/MyProfile.jsx:230`.

Every other function call uses `base44.functions.invoke(name, payload)`, which attaches the bearer token — for example the checkout shim (`src/functions/createCheckoutSession.js:6`), the payment page (`src/pages/PaymentRequired.jsx:18`), and the sibling deactivation call in this very file (`src/pages/MyProfile.jsx:75`). The raw-fetch handler is an anomaly, almost certainly a remnant of an earlier iteration written before the billing functions were session-gated.

### 3.3 Secondary latent fault

Even once authenticated, `createPortalSession` requires a `stripeCustomerId` in the body and returns HTTP 400 `{ error: 'No Stripe customer ID found.' }` when it is absent (`server/functions/createPortalSession.mjs:18-20`). The handler passes `user?.stripe_customer_id` (`src/pages/MyProfile.jsx:233`). Any user without that field populated — an administrator-activated account, or a subscriber whose entitlement was never synced — will therefore see a portal error rather than a portal. The design at clause 4 handles this gracefully (attempt a sync, then a plain-language fallback) rather than surfacing a raw error.

---

## 4. Design — Manage Subscription as a single interface

### 4.1 Shape

"Manage Subscription" opens an in-application dialog (Radix `Dialog`, already a dependency) presenting three actions. This is the single home for all subscription lifecycle operations; the stand-alone "Deactivate Account" card and its confirmation dialog are removed (clause 4.5).

```
Manage Subscription
├─ (a) Switch to annual billing        → Stripe Billing Portal (subscription-update flow)
├─ (c) Update payment information       → Stripe Billing Portal (payment-method-update flow)
└─ (b) Cancel subscription & close account → in-app combined action + verbatim notice
```

Rationale for the split between portal-routed and in-application actions:

- Actions (a) and (c) are **Stripe Billing Portal** natives. Routing them to the portal keeps all card data on Stripe's infrastructure — the application never sees, enters, or stores a card number, which satisfies both PCI scope minimisation and the workspace prohibition on handling payment secrets. It also adds almost no new billing code.
- Action (b) **must** be custom in-application code, because it does something the portal cannot: it combines a Stripe cancellation with an AssessSuite account-state change (deactivation) and carries a specific, mandated confirmation notice. The portal can cancel billing, but it cannot close the AssessSuite account, and it cannot present Maxwell's notice.

### 4.2 Action (a) — Switch to annual billing

**Current implementation.** None on an existing subscription. `createCheckoutSession` supports `plan: 'annual'`, but that is for *new* subscriptions (the pending-user flow, `src/pages/PaymentRequired.jsx:9-41`). Issuing a fresh checkout for an already-subscribed user would create a **second** subscription — wrong.

**Recommended (portal, least code, PCI-clean).** Open the Billing Portal with a subscription-update flow so Stripe handles the plan swap and proration:

- Server: extend `createPortalSession` to accept an optional `flow` argument and pass Stripe `flow_data[type]=subscription_update` (or `subscription_update_confirm` with the target price) — `server/functions/createPortalSession.mjs` and the gateway `createPortalSession` (`server/stripeGateway.mjs:146-151`).
- Stripe dashboard precondition: the annual price must be listed as a portal product and plan-switching enabled in the Customer Portal configuration.

**Alternative (native API).** A new gateway method updating the subscription item's price to `STRIPE_PRICE_ID_ANNUAL` with a proration behaviour. More control, more code, and it requires **Subscriptions: Write** on the Stripe key (see clause 4.4). The portal route is preferred unless Maxwell wants the annual upgrade to happen without leaving the application.

**Billing-provider calls.** `POST /v1/billing_portal/sessions` with `flow_data` (portal route), or `POST /v1/subscriptions/{id}` with the new price item (native route).

### 4.3 Action (c) — Update payment information

**Current implementation.** Indirect only: the (broken) "Manage Subscription" button opened the general portal, where a user could reach the payment-method screen.

**Recommended.** Open the Billing Portal with `flow_data[type]=payment_method_update`, landing the user directly on the card-update screen. Same server and gateway extension as action (a).

**Billing-provider call.** `POST /v1/billing_portal/sessions`.

### 4.4 Action (b) — Cancel subscription and close account

This is the consolidation of the two operations that presently live apart: Stripe cancellation (only reachable today by wandering into the external portal) and AssessSuite deactivation (`server/functions/deactivateAccount.mjs`). It resolves the open decision already recorded at `docs/launch/20260713-go-live-runbook.md:82` and `docs/qa/20260713-launch-readiness-session-note.md:26` ("billing on deactivation").

**Proposed new server function** `cancelSubscriptionAndDeactivate` (register in `REQUIRES_SESSION`, `server/functions/index.mjs:92-99`; it must work from any account status, as deactivation does):

1. Resolve the caller (`ctx.user`); refuse if absent (401) or an administrator (403), mirroring `deactivateAccount` (`server/functions/deactivateAccount.mjs:18-25`).
2. If the user has a `stripe_subscription_id`, cancel it via a **new** gateway method (clause 4.4.1). If the field is absent (administrator-activated, never synced, or already cancelled), skip cancellation silently and proceed — no error.
3. Set `account_status: 'deactivated'` and `deactivated_date` (identical to `deactivateAccount`).
4. Return `{ status: 'deactivated', subscription: 'cancelled' | 'none' }`.

The client (the new dialog's action (b)) invokes it via `base44.functions.invoke('cancelSubscriptionAndDeactivate', {})`, then logs out to the `AccountDeactivated` landing (as `confirmDeactivate` does today, `src/pages/MyProfile.jsx:75-80`). The verbatim notice (clause 4.6) is shown in the confirmation step **before** the action fires.

**4.4.1 New gateway method (design).** `server/stripeGateway.mjs` gains `cancelSubscription(subscriptionId)`:

- **Immediate cancellation (recommended for a combined "cancel and close now"):** `DELETE /v1/subscriptions/{id}`. Billing stops at once, consistent with the account closing at once. The user forfeits the remainder of any paid period; the existing no-refund policy (`src/pages/Landing.jsx:766`; `src/legal-content/08_subscription_cancellation_and_refund_policy.md`) governs, and this should be disclosed (clause 4.6, secondary line). **This is a genuine product/legal edge — see clause 8, open question 2.**
- **Mock mode:** a mock counterpart in `server/mocks/stripe.mjs` that marks the mock subscription `canceled`, so `npm run selftest` and local development never touch the network.

**4.4.2 Stripe key permission (dependency).** The restricted key currently being requested from the merchant grants **Subscriptions: Read** only (`docs/launch/20260713-go-live-runbook.md:40`). A native cancellation is a **write**. Either (i) add **Subscriptions: Write** to the restricted key, or (ii) perform the cancellation through the portal instead — but option (ii) cannot be chained to an immediate deactivation after an external redirect, so option (i) is required for the combined action. This must be settled with the merchant before enactment.

**4.4.3 Portal native-cancel (configuration flag).** Because actions (a) and (c) send the user into the Billing Portal, and the portal exposes its own "Cancel subscription" button, the portal's native cancellation should be **disabled** in the Customer Portal configuration. Otherwise a user could cancel billing in the portal without closing the account — re-opening the very gap this patch closes, and defeating Maxwell's instruction that cancel/deactivate live in the Manage Subscription tool only.

### 4.5 The portal-open fix and the removal of the stand-alone control

**Fix (design, not applied).** Replace the raw fetch in `handleManageSubscription` (`src/pages/MyProfile.jsx:228-244`) with the authenticated SDK path, mirroring `PaymentRequired.jsx`:

```jsx
// PROPOSED — not applied
const handleManageSubscription = async () => {
  try {
    const me = await base44.auth.me();
    let customerId = me?.stripe_customer_id;
    if (!customerId) {
      // No customer id yet — try a one-shot sync before giving up.
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

**Removal.** The stand-alone "Deactivate Account" card (`src/pages/MyProfile.jsx:733-757`) and its `AlertDialog` (`src/pages/MyProfile.jsx:759-782`) are deleted. Their logic (`handleDeactivateAccount`, `confirmDeactivate`, and the `isDeactivating` / `showDeactivateDialog` state) is superseded by the Manage Subscription dialog's action (b). The "Logout" card (`src/pages/MyProfile.jsx:713-731`) is retained.

### 4.6 Notice copy (verbatim)

The confirmation step for action (b) presents, verbatim:

> **Notice:** closing your account will result in the loss of access to the AssessSuite platform and all data associated with that account, including but not limited to treatment records, patient details, policies, and consents.

Recommended secondary line (plain, ACL-safe, discloses the billing consequence — subject to Maxwell's approval):

> Your subscription will be cancelled and billing will stop. No refund is provided for the unused portion of the current billing period.

---

## 5. Copy change — every location of the misleading closure copy

The present copy tells the user, on closure, that records are **retained** and nothing is deleted. Maxwell has directed that this be replaced by the loss-of-access notice. The copy appears in **two** files (account-closure surfaces). Each is enumerated:

| # | File | Lines | Present text (abridged) | Change |
|---|---|---|---|---|
| 1 | `src/pages/MyProfile.jsx` | 733-734 | Code comment: "records are retained (never deleted) per the Records Retention policy." | Remove/replace comment when the card is removed (clause 4.5). |
| 2 | `src/pages/MyProfile.jsx` | 740-744 | Card body: "...clinical records are retained securely — nothing is deleted — in line with professional record-keeping obligations..." | Card removed (clause 4.5); copy superseded by the verbatim notice in the new dialog. |
| 3 | `src/pages/MyProfile.jsx` | 764-772 | Dialog body: "...Your practice's records are retained securely and are not deleted. Reactivation requires contacting admin@assesssuite.com." | Dialog removed (clause 4.5); replaced by the verbatim notice at clause 4.6. |
| 4 | `src/pages/AccountDeactivated.jsx` | 22-26 | Post-closure landing: "...Your practice's clinical records are retained securely — nothing has been deleted — in line with professional record-keeping obligations and the AssessSuite Privacy Policy." | Replace the reassurance with copy consistent with the new notice. **Exact replacement wording depends on the clause 8 open question 1 decision** (loss of access vs deletion). |

**Explicitly out of scope (do not change):**

- `src/pages/Clients.jsx:230-239` and `src/pages/ClientProfile.jsx:269-283` — "records are retained securely" copy on **client archiving**, a different action that genuinely retains. Accurate; leave as is.
- `src/pages/Landing.jsx:707, 720, 766` — Terms / Privacy / cancellation legal text. These are the actual retention and cancellation policy; they are correct and are not a closure UI. Any change here is a legal-instrument decision, not part of this patch.
- `src/legal-content/*` — the policy corpus (including `08_subscription_cancellation_and_refund_policy.md`). Out of scope.

---

## 6. Data-integrity implications (must be read before enactment)

**What the platform actually does on closure.** `deactivateAccount` sets `account_status: 'deactivated'` and a timestamp. It **deletes nothing** (`server/functions/deactivateAccount.mjs:9-30`). The organisation, clients, assessments, notes, documents, policies, and consents are retained, org-scoped and encrypted at rest, for at least the professional retention period (adult clinical records: seven years). The server refuses all clinical access for any non-active status (`server/index.mjs:381-390`), so the user loses access immediately, but the data persists. This retention is deliberate, is reflected in the legal corpus (the Privacy Policy, the Data Processing and Security Schedule at `src/legal-content/11_...md:75`), and exists to satisfy record-keeping obligations that survive the practitioner's departure.

**The gap.** Maxwell's notice states "the loss of ... all data associated with that account, including ... treatment records, patient details, policies, and consents". Read as a loss-of-**access** statement, this is **accurate**: the user does lose access to the platform and to all of that data on closure. Read as a promise of **deletion**, it is **stronger than the current behaviour**, which retains the data.

**This is a policy decision only Maxwell can take (see clause 8, open question 1):**

- **Option A — copy is a loss-of-access warning (recommended).** No back-end change. The notice is truthful as to loss of access; the data is retained server-side, as the law and the compliance model require. The `AccountDeactivated` copy (#4 above) is reworded to speak of access loss, not deletion, so it does not contradict the notice.
- **Option B — closure actually deletes the data.** A far larger, riskier change: it requires a hard-delete cascade across every clinical entity, it conflicts directly with the seven-year clinical retention obligation and the Data Processing Schedule, and honouring it for records inside their statutory retention window may itself be unlawful. Not recommended without formal legal review, and out of scope for a copy-and-consolidation patch.

The agent will not implement Option B under the fabrication and record-integrity rules without Maxwell's express, informed instruction; the recommendation is Option A.

---

## 7. Test plan

All suites must pass before enactment. The application ships a deterministic self-test (`npm run selftest`, currently 102/102) and gate-tests.

**Unit**

- `stripeGateway.cancelSubscription` — issues `DELETE /v1/subscriptions/{id}` in live mode; the mock counterpart marks the mock subscription `canceled`; a missing/blank `subscriptionId` is handled without throwing.
- `createPortalSession` `flow` argument — passes the correct `flow_data[type]` for `subscription_update` and `payment_method_update`; omits `flow_data` when no flow is requested (unchanged behaviour).

**Integration (functions router, via selftest harness)**

- `createPortalSession` **with** a valid bearer token and a `stripeCustomerId` → 200 with a `url` (mock). **Without** a token → 401 `{ error: 'authentication required' }`. This pair documents the contract and pins the exact pre-patch failure to a missing header, not a server fault.
- `cancelSubscriptionAndDeactivate` — authenticated non-admin with a subscription → 200, mock subscription `canceled`, `account_status: 'deactivated'`; authenticated with **no** subscription → 200, `subscription: 'none'`, still deactivated; administrator → 403; anonymous → 401.
- Regression: an administrator-activated user with no `stripe_customer_id` invoking the portal path receives the graceful fallback, not a raw 400.

**End-to-end (browser, mock mode) — this is where the reported symptom is reproduced and confirmed fixed**

- **Pre-patch reproduction:** logged-in user clicks "Manage Subscription" → observes the "authentication required" alert (the reported bug).
- **Post-patch confirmation:** the same click opens the portal (mock URL) with no auth error.
- New dialog: each of the three actions from the dialog — (a) routes to a portal subscription-update URL; (c) routes to a portal payment-update URL; (b) shows the verbatim notice, then on confirm deactivates and lands on `AccountDeactivated`.
- Full launch smoke path remains green (register → OTP → consents → pay → clinical flow → report → archive client → close account), per `docs/launch/20260713-go-live-runbook.md:61`.

**Live-mode verification (Maxwell, personally).** Agents never execute payments (runbook invariant 5). The live cancel/close test — real subscription cancelled, billing confirmed stopped, account deactivated, then reactivated by admin — is performed by Maxwell against a throwaway subscriber with a real card.

---

## 8. Rollout and risks

### 8.1 Rollout

1. Implement on `launch/legal-and-consent-integration` (or a short-lived branch off it). Do **not** touch `SUITE_VERSION` / `LEGAL_SUITE_VERSION` (runbook invariant 1).
2. `npm run selftest` and gate-tests green; `npm run build` clean; lint at baseline.
3. Local browser smoke in mock mode (clause 7 e2e).
4. Staging rehearsal: deploy the image to a non-public target (the `unimatter-demo` app, or a throwaway preview app) and repeat the smoke path. There is no separate persistent staging environment; the demo app is the closest analogue and runs in mock mode.
5. Production deploy to `assesssuite-production`: `fly deploy -c fly.production.toml --strategy immediate` (single-volume topology — never blue-green, never scale beyond one machine; runbook line 6).
6. Post-deploy smoke on `assesssuite.com`: portal opens; the three dialog actions behave; the closure notice reads verbatim.

**Rollback.** Fly retains prior release images: `fly releases -a assesssuite-production` then `fly deploy --image <previous>` (or `fly releases rollback`). The change is code-only — no schema migration, no data transformation — so rollback is a clean image swap. Daily volume snapshots (5-day retention) remain the data backstop.

**Feature flag.** Not required; the surface is small and self-contained. If Maxwell prefers a staged exposure, the new dialog can be gated behind an env-driven public setting (the `public_settings` channel already exists, `server/index.mjs:1031-1040`), but this is optional.

**Comms to existing subscribers.** There is a genuine **behaviour change**: today, closing an account leaves the Stripe subscription running (the user keeps being billed until they cancel separately); after this patch, closing the account cancels billing in the same step. This is an improvement, but any existing subscriber who has already self-deactivated and is still being billed should be identified and handled out of band before or at enactment.

### 8.2 Risks and open questions for Maxwell (decide before enactment)

1. **Deletion vs loss of access (the material one).** Does the new notice describe loss of *access* (Option A, recommended — no data deleted, consistent with the seven-year clinical retention obligation and the legal corpus), or an actual *deletion* of data (Option B — large, risky, and potentially unlawful within the retention window)? Clause 6 refers. The recommendation is Option A, with the `AccountDeactivated` copy reworded to match.
2. **Immediate cancel vs cancel-at-period-end, and refunds.** The recommended combined action cancels immediately (billing stops now; account closes now), which forfeits the remainder of a paid period under the existing no-refund policy. Is that the intended user experience, or should the closure honour the "cancellation takes effect at the end of the billing period" wording in the current policy (`src/legal-content/08_...md`; `src/pages/Landing.jsx:766`)? The secondary notice line at clause 4.6 discloses the immediate-cancel consequence and needs Maxwell's approval.
3. **Stripe key permission.** A native cancellation needs **Subscriptions: Write** added to the restricted key (currently Read-only, runbook line 40). This must be arranged with the merchant, or the annual-upgrade and payment-update actions kept portal-only while cancellation still requires the write scope.
4. **Stripe Customer Portal configuration.** For the portal-routed actions to work and to keep cancellation solely within the Manage Subscription tool, the live portal must (i) list the annual price and permit plan switching, (ii) enable the payment-method-update flow, and (iii) **disable** the portal's native cancellation button (clause 4.4.3).
5. **`stripe_customer_id` / `stripe_subscription_id` absence.** Administrator-activated accounts may carry neither. The design degrades gracefully (attempt a sync, then a plain-language message; skip cancellation if there is no subscription), but Maxwell should confirm that an administrator-activated user seeing "no billing account is linked" is acceptable.
6. **Financial-action boundary.** Building this self-service feature is a product change, not the agent executing a financial action on Maxwell's behalf. Enactment nonetheless touches live billing and is reserved to Maxwell; the live cancel/refund test is performed personally by Maxwell (runbook invariant 5). No autonomous financial action is contemplated by this patch.
7. **Filename date.** As flagged at the head of this memorandum.

---

## Appendix — surface area for review (exact paths and lines)

**Diagnosis (no change; cited for review):**
- `server/functions/index.mjs:92-99` — `REQUIRES_SESSION` (includes `createPortalSession`).
- `server/functions/index.mjs:162-166` — the 401 "authentication required" branch.
- `server/index.mjs:1196-1203` — relative `/functions/<name>` passthrough.

**Files to change:**

| File | Lines | Nature of change |
|---|---|---|
| `src/pages/MyProfile.jsx` | 228-244 | Replace raw-fetch `handleManageSubscription` with authenticated SDK path + graceful no-customer handling (clause 4.5). |
| `src/pages/MyProfile.jsx` | 698-711 | "Subscription" card button opens the new Manage Subscription dialog (three actions). |
| `src/pages/MyProfile.jsx` | 733-757 | **Remove** stand-alone "Deactivate Account" card. |
| `src/pages/MyProfile.jsx` | 759-782 | **Remove** stand-alone deactivate `AlertDialog`. |
| `src/pages/MyProfile.jsx` | 66-86 | Remove/retarget `isDeactivating`, `showDeactivateDialog`, `handleDeactivateAccount`, `confirmDeactivate` into the new dialog's action (b). |
| `src/pages/AccountDeactivated.jsx` | 22-26 | Replace retention-reassurance copy per clause 5 #4 (wording pending open question 1). |
| `server/functions/createPortalSession.mjs` | 14-40 | Accept optional `flow`; pass `flow_data` for subscription-update / payment-method-update. |
| `server/stripeGateway.mjs` | 146-151 | Extend `createPortalSession` to forward `flow_data`; add new `cancelSubscription(subscriptionId)` (`DELETE /v1/subscriptions/{id}`). |
| `server/mocks/stripe.mjs` | new | Mock `cancelSubscription` marking the mock subscription `canceled`. |
| `server/functions/cancelSubscriptionAndDeactivate.mjs` | new | Combined cancel-and-deactivate function (clause 4.4). |
| `server/functions/index.mjs` | 31-99 | Import/register the new function; add it to `REQUIRES_SESSION`. |
| `src/functions/createPortalSession.js` | new (optional) | SDK shim mirroring `src/functions/createCheckoutSession.js:6`, for symmetry. |

**Reference (unchanged) — invocation pattern to mirror:** `src/pages/PaymentRequired.jsx:9-41`; `src/functions/createCheckoutSession.js:6`; `src/pages/MyProfile.jsx:75` (existing authenticated `deactivateAccount` call).

*End of memorandum.*
