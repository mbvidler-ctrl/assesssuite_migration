# Registration, checkout, and admin-approval — patch scope and design

**Prepared:** 14 July 2026
**Author:** Maxwell Vidler (agent-assisted; UniMatter / AssessSuite)
**Repository:** `C:\Users\Maxwe\Projects\assesssuite_launch_ready`
**Branch:** `launch/legal-and-consent-integration`
**Status:** SCOPE AND DESIGN ONLY. No code has been applied, committed, pushed, or deployed. Production (`https://assesssuite.com`) is untouched. Enactment is reserved to Maxwell's separate, explicit direction.

> **SUPERSEDED — historical artefact (retained).** This memorandum has been consolidated into `docs/launch/20260714-launch-readiness-patches-scope-and-design.md` (Part B). Read the unified memorandum for the operative plan; this file is kept for lineage only.

**Companion document.** This is the sibling to `docs/launch/20260617-manage-subscription-patch-scope-and-design.md` (the Manage Subscription patch). The two are kept separate because they are independently authorised for enactment, touch different surfaces (this one: registration, onboarding, checkout redirect, admin approvals; the other: the subscription-management interface), and each carries its own risk profile. Where they touch adjacent code (the Stripe checkout functions, the `User` entity), this document notes the overlap.

**A note on method (state-truth).** The four root causes below are established by direct inspection of the exact code paths, each cited to file and line. A live end-to-end reproduction on a running server was not performed in this pass; the reproduction steps at each issue are written from the code and can be executed on request (a local mock-mode run, fresh throwaway email). Nothing below is asserted as observed at runtime that was not.

**Origin.** A prospective customer (`lachlan_keirnan@outlook.com`) registered on 14 July 2026, received the "pending until payment" system email, but never reached the Stripe checkout, and appears twice in the admin panel — both entries labelled "No name". A colleague, seeing manual Approve / Reject controls, asked whether he must approve the account and whether that step was meant to be switched off. Four distinct defects are diagnosed.

---

## Summary of the four issues and their relationship

The four are not independent; three of them chain into the observed incident.

| Issue | One-line diagnosis | Severity |
|---|---|---|
| 1 — no checkout redirect | Stripe checkout fires only at the end of a long mandatory profile-and-consent form (`ProfileSetup`) placed between OTP and payment; there is no direct register→checkout path, and any incompletion or non-URL response leaves the account pending with no payment. | High (revenue-blocking) |
| 2 — duplicate registrations | Email is handled case-sensitively; a case-variant re-attempt (`lachlan_` vs `Lachlan_`, consistent with mobile auto-capitalisation) is treated as a new user, so the resume/idempotency logic never engages and a second pending record (and second organisation) is created. | High (data integrity, billing) |
| 3 — admin approval appears required | Auto-activation on payment works, but the admin "Pending Approvals" queue presents every not-yet-paid registrant with prominent Approve / Reject controls, reading as a required step it is not. | Medium (operational confusion; risk of granting unpaid access) |
| 4 — "No name" | Registration never captures a name, and the admin panel reads `full_name` whereas onboarding writes `clinician_name` — so pending users show "No name" and even onboarded users would not show their professional name. | Medium (admin usability) |

**The likely incident sequence:** the registrant completed registration (hence the system email), met the friction wall — either the OTP step or the long `ProfileSetup` form standing between him and payment (Issue 1) — abandoned, and retried; his second attempt used a leading capital (Issue 2), producing the duplicate; both records show "No name" because registration captured none (Issue 4); and the colleague, seeing the approvals queue, believed manual approval was required (Issue 3).

---

## Issue 1 — Registration does not route the user to the Stripe payment screen

### 1.1 Reproduction (from code)

1. From the live landing page, "Get Started" / "Sign In / Sign Up" navigates to `/register` (`src/pages/LandingLive.jsx:522, 533`). The plan selected on the pricing cards (monthly/annual) is **not** carried across — both buttons call `navigate('/register')` with no plan.
2. `/register` (`src/pages/Register.jsx`) collects **email and password only** and calls `base44.auth.register` (`src/pages/Register.jsx:33`).
3. On OTP verification, the handler redirects to **Dashboard**, not checkout (`src/pages/Register.jsx:52`).
4. `Layout` intercepts: a user with no `clinician_name` is sent to `/ProfileSetup` (`src/Layout.jsx:67-70`).
5. `ProfileSetup` is a long form — full name, profession, qualifications, provider/registration numbers, clinic name/address/phone/email, professional biography, at least one specialization, three mandatory practitioner-notice checkboxes, and (for a new organisation) jurisdictions, an adult-only confirmation, and contract acceptance (`src/pages/ProfileSetup.jsx:164-217` validation).
6. Only on successful submission of that entire form does the code create the organisation, write the profile, record the legal events, and finally call `createCheckoutSession` and redirect to Stripe (`src/pages/ProfileSetup.jsx:290-298`).

### 1.2 Root-cause diagnosis

The Stripe redirect is gated behind the completion of `ProfileSetup`. There is **no** direct register→checkout path. The consequences:

- **Friction/abandonment (primary).** A registrant who expects "register → pay" is instead required to complete a full clinical-profile and consent form before any payment screen appears. Abandonment there leaves the account `pending`, unpaid, and — because the organisation and profile writes happen *before* the checkout call (`src/pages/ProfileSetup.jsx:239-257`, then checkout at `:291`) — partially provisioned.
- **Silent-failure surface.** If `createCheckoutSession` returns no URL, `handleSubmit` throws and shows "Failed to save profile" (`src/pages/ProfileSetup.jsx:296-303`); the user is stranded on `ProfileSetup` with no route to payment. In real Stripe mode this occurs whenever the price is not configured — `createCheckoutSession` returns HTTP 500 "Stripe price not configured" if `STRIPE_PRICE_ID_MONTHLY` is unset (`server/functions/createCheckoutSession.mjs:35-40`). In mock mode it returns a mock URL (`/mock-stripe/checkout/...`) that is not a real payment page — so if production were still in mock mode at the time, "reaching checkout" would render a non-functional local URL.
- **OTP dependency (contributing).** If the OTP email did not arrive or was not entered, the user never even reaches `ProfileSetup`; the account remains `pending` and unverified. This cannot be confirmed from the available data but is a real contributor to "registered but never paid".
- **Lost plan selection (minor).** Because the landing plan choice is discarded, `ProfileSetup` hard-codes `plan: "monthly"` (`src/pages/ProfileSetup.jsx:291`) — a user who chose Annual on the pricing page is nonetheless sent to a monthly checkout.

### 1.3 Proposed design

Two options; the recommendation is a hybrid.

- **Design A (reorder — recommended): take payment before the heavy profile form.** After OTP verification, route the user straight to `/PaymentRequired` (the two-plan chooser that already exists and already calls `createCheckoutSession` correctly, `src/pages/PaymentRequired.jsx:9-41`), carrying the plan chosen on the landing page. Move the full clinical profile (`ProfileSetup`) and the practitioner notices to **after** activation, as a first-run gate on the Dashboard. This front-loads the revenue event, matches the "completing your subscription activates it immediately" messaging, and removes the abandonment wall. Legal-notice capture is retained as a mandatory gate (it already exists independently at `/LegalNotices`, enforced server-side, `server/index.mjs:397-400`), so consents are not lost by the reorder.
- **Design B (minimal — de-risk the existing order).** Keep the current order but (i) make the `createCheckoutSession` failure explicit and recoverable — on a non-URL response, show a clear message and a persistent "Return to payment" control rather than stranding the user; (ii) ensure `STRIPE_PRICE_ID_MONTHLY` / `_ANNUAL` are set in production and that the app is in real Stripe mode (a deployment/runbook check, not code); (iii) carry the landing plan selection through to `ProfileSetup` so Annual is honoured.

Recommendation: **Design A**, because it removes the structural cause (a long form between intent and payment) rather than only hardening the failure path, and it aligns the flow with the auto-activation model. Design B's items (i) and (iii) are worth adopting regardless, as defence in depth.

Both designs depend on the deployment being in **real** Stripe mode with prices configured; that is a go-live checklist item (`docs/launch/20260713-go-live-runbook.md`, Phase 3), not a code change, and must be confirmed before enactment either way.

### 1.4 Change surface (Design A)

| File | Lines | Change |
|---|---|---|
| `src/pages/Register.jsx` | 42-58 | After `verifyOtp`, route to `/PaymentRequired` (carry plan) instead of `Dashboard`. |
| `src/pages/LandingLive.jsx` | 522, 533 | Carry the selected plan (query param or stored intent) into `/register`. |
| `src/pages/PaymentRequired.jsx` | 9-41 | Accept and honour the incoming plan; default monthly. |
| `src/Layout.jsx` | 67-99 | Reorder the gate: allow an active, paid user to reach the first-run `ProfileSetup`; do not force the full profile before payment. |
| `src/pages/ProfileSetup.jsx` | 290-298 | Remove the checkout call from this form once payment precedes it; retain profile + notice capture as a post-activation gate. |

---

## Issue 2 — Duplicate pending registrations for the same email

### 2.1 Reproduction (from code)

1. Register `lachlan_keirnan@outlook.com`. A `pending`, unverified `User` is created (`server/index.mjs:832-837`).
2. Without verifying, register again as `Lachlan_keirnan@outlook.com` (leading capital — the default on most mobile keyboards).
3. The server looks up the existing user with an **exact, case-sensitive** string comparison (`findUserByEmail`, `server/index.mjs:777-779`: `u.email === email`). The capitalised variant does not match, so the resume/idempotency branch (`server/index.mjs:810-837`) never engages and a **second** `User` record is created.

### 2.2 Root-cause diagnosis

Email is never normalised. There is no lowercasing or trimming at registration, login, OTP verification, resend, or reset; `server/auth.mjs` contains no normalisation helper, and `email` is a guarded field on `updateMe` (`server/auth.mjs:76-85`), so it is fixed at whatever casing it was first stored with. The register handler's duplicate-guard is otherwise correct (`server/index.mjs:810-821`: a verified duplicate returns 409, an unverified one resumes) — but it is keyed on the exact-match lookup, so any case or whitespace variance defeats it. The same case-sensitivity is a **latent login defect**: a user who registers as `Lachlan_...` must later log in as `Lachlan_...` exactly (`server/index.mjs:785`), which will surprise users.

Every call site of the exact-match lookup: `findUserByEmail` is defined at `server/index.mjs:777` and used by register (`:810`), verify-otp (`:855`), resend-otp (`:904`), reset-password-request (`:924`), login (`:784`), and invite (`:994`). The client entry points are `base44.auth.register` (`src/pages/Register.jsx:33`) and the login page.

### 2.3 Proposed design

Normalise email to a canonical form (`trim().toLowerCase()`) at the **server** boundary — the authoritative fix, independent of any client. A single helper (e.g. `normaliseEmail`) applied:

- on user creation (register) so stored email is canonical;
- inside `findUserByEmail` (compare canonical to canonical) so all lookups — register, login, OTP, resend, reset, invite — become case-insensitive at once.

With that, the existing resume branch handles the retry correctly: the second attempt matches the first unverified record and resends the code rather than creating a duplicate. No separate idempotency mechanism is needed. Optionally, surface a clearer message on the resume path ("You already have a pending registration for this email — we have re-sent your code").

**Data note:** two records already exist in production for this person. This patch prevents recurrence but does not itself merge the existing pair; the duplicate (and its duplicate organisation) should be reconciled manually (see clause "Data reconciliation" below).

### 2.4 Change surface

| File | Lines | Change |
|---|---|---|
| `server/auth.mjs` | new helper | Add `normaliseEmail(email)` = `String(email).trim().toLowerCase()`. |
| `server/index.mjs` | 777-779 | `findUserByEmail` compares normalised values. |
| `server/index.mjs` | 801-847 | Store normalised email on create; use normalised value throughout register. |
| `server/index.mjs` | 782-799, 850-975 | Normalise the inbound email in login, verify-otp, resend-otp, reset-password-request, invite. |
| `server/functions/index.mjs` / handlers | — | No change (webhook already lower-cases for its email match, `server/functions/stripeWebhook.mjs:127`). |

---

## Issue 3 — Admin approval appears active when activation should be automatic

### 3.1 Reproduction (from code)

1. Any registrant who has not paid remains `account_status: 'pending'`.
2. The admin panel's "Pending Approvals" tab lists every such user with prominent Approve / Reject buttons (`src/pages/AdminApprovals.jsx:621-665`; `pendingUsers` filter at `:515`).
3. `handleApprove` sets `account_status: 'active'` directly (`src/pages/AdminApprovals.jsx:445-451`) — a manual activation that bypasses payment entirely.

### 3.2 Root-cause diagnosis

Auto-activation itself works: `stripeWebhook` flips `pending → active` on `checkout.session.completed` (`server/functions/stripeWebhook.mjs:62-138`), and `Layout` routes a pending user to `/PaymentRequired` rather than to any approval queue (`src/Layout.jsx:96-99`). Nothing is broken in the activation path — an unpaid registrant like Lachlan is *correctly* still pending, because no payment webhook has fired for him.

The defect is one of **presentation and semantics**, not mechanism:

- (a) The webhook path reliably auto-activates on payment (confirmed by inspection).
- (b) The admin Approve/Reject UI is **not** dead code — it is a genuine capability — but it is presented as if it were the primary path. A "Pending Approvals" queue implies the pending accounts are awaiting an admin decision. In the launch model they are not; they are awaiting **their own payment**. Manually approving one grants full access without payment.
- (c) There is no feature flag that turned auto-activation off; it is on. The confusion is that the pending queue conflates two very different populations: ordinary not-yet-paid registrants (no action wanted) and genuinely stuck accounts (payment failed, or webhook failure — where a break-glass activation is legitimate).

### 3.3 Proposed design — recommendation: option (ii), re-scope as a clearly-labelled fallback

Option (i) — removing admin activation entirely — is rejected: legitimate needs remain (complimentary/enterprise accounts provisioned out of band; recovering an account whose payment succeeded but whose webhook failed; the go-live plan itself contemplates an admin path for edge cases). A break-glass must survive.

The recommendation is therefore **option (ii)** with option (i)'s guard-rails:

1. **Relabel** the pending queue from "Pending Approvals" to reflect reality — e.g. "Awaiting payment" — and add a one-line banner: "Accounts activate automatically on successful subscription payment. Manual activation here is a fallback for exceptions only."
2. **Guard** the manual "Approve" (activate) control behind a confirmation that states plainly it grants access **without** payment, and rename it "Activate without payment (exception)".
3. **Distinguish** the genuinely stuck population: surface `subscription_status: 'payment_failed'` and long-pending accounts separately from ordinary fresh registrants, so an administrator can see at a glance who actually needs help.
4. Retain Reject (it is the abuse/spam disposition) with unchanged semantics.

This keeps the safety valve, ends the "must I approve?" confusion, and prevents inadvertent grants of unpaid access.

### 3.4 Change surface

| File | Lines | Change |
|---|---|---|
| `src/pages/AdminApprovals.jsx` | 619-665 | Relabel the tab/section; add the auto-activation banner; segment payment_failed / long-pending from fresh registrants. |
| `src/pages/AdminApprovals.jsx` | 445-458 | Wrap `handleApprove` in a confirmation dialog; rename control to "Activate without payment (exception)". |

---

## Issue 4 — Registrations show "No name" in the admin panel

### 4.1 Reproduction (from code)

1. Register any account. The form sends only `{ email, password }` (`src/pages/Register.jsx:33`); no name is captured.
2. The admin pending list renders `user.full_name || 'No name'` (`src/pages/AdminApprovals.jsx:634`). With no name captured, it shows "No name".

### 4.2 Root-cause diagnosis — two independent faults

- **(a) Name is never captured at registration.** `Register.jsx` collects email and password only; the server persists whatever custom fields are sent (`server/index.mjs:823-836`), but none carry a name, so `full_name` and `clinician_name` are both unset for a pre-onboarding user. The name is captured only later, at `ProfileSetup`.
- **(b) Field-name mismatch.** The admin panel reads `full_name`, but onboarding writes `clinician_name` (`src/pages/ProfileSetup.jsx:257`, spreading `formData` whose name field is `clinician_name`, `:49`). Consequently, **even a fully onboarded user** does not show a name in the pending list, and shows only their email in the other admin lists (`:683, :813`) — never their professional name. The `'No name'` literal (instead of an email fallback) makes the pending row the worst case.

### 4.3 Proposed design

- **Capture the name at registration.** Add a required first-name / last-name pair (or a single full-name field) to `Register.jsx`, and send it as `full_name` (and/or `clinician_name`) in the register payload. This immediately populates the admin panel and enriches the admin-notify email, which currently carries only the email address (`server/email.mjs:128-134`).
- **Fix the admin display binding** to read the canonical name with a sensible fallback chain: `clinician_name || full_name || email` — at minimum at `src/pages/AdminApprovals.jsx:634`, and for consistency at the active/rejected/suspended rows (`:683, :781, :813`).
- Optionally, include the registrant's name in `adminNotifyEmail` so the "new registration" notice is legible.

### 4.4 Change surface

| File | Lines | Change |
|---|---|---|
| `src/pages/Register.jsx` | 12-40, 160-220 | Add required name field(s); include in the `register` payload. |
| `src/pages/AdminApprovals.jsx` | 634 | Render `clinician_name || full_name || email` instead of `full_name || 'No name'`. |
| `src/pages/AdminApprovals.jsx` | 683, 781, 813, 1484, 1597 | Same fallback chain for name display, for consistency. |
| `server/email.mjs` | 128-134 | (Optional) include the registrant name in the admin-notify email. |
| `server/index.mjs` | 823-836 | No change required — arbitrary custom fields (incl. `full_name`) already persist on create; confirm `clinician_name` is written too if adopted. |

---

## Test plan (all four issues)

The application ships a deterministic self-test (`npm run selftest`, currently 102/102) and gate-tests; both must stay green.

**Unit / integration (server, selftest harness)**

- Email normalisation: register `A@x.com` then `a@x.com` → the second resumes the first (no duplicate); login with either casing succeeds; verify-otp, resend, reset all resolve case-insensitively. This is the direct regression test for Issue 2.
- Register with a name → the created `User` carries the name; `stripAuthFields` output exposes it to the admin list (Issue 4).
- Webhook auto-activation (already covered) remains green: `checkout.session.completed` flips `pending → active`; `rejected`/`deactivated` are never activated (Issue 3 mechanism unchanged).

**End-to-end (browser, mock mode)**

- **Issue 1 reproduction and fix:** fresh registration → OTP → (post-fix) lands on `/PaymentRequired` with the chosen plan, reaches a checkout URL without first completing the full profile form; abandoning no longer strands the user pre-payment.
- **Issue 2:** register, then re-register with a leading capital → a single pending record, code re-sent, no second organisation.
- **Issue 3:** as an admin, the pending queue reads "Awaiting payment" with the auto-activation banner; the manual activate control requires confirmation and is labelled an exception.
- **Issue 4:** a freshly registered user shows their name (not "No name") in the pending queue; an onboarded user shows their `clinician_name`.

**Manual/live (Maxwell).** Agents never execute payments (runbook invariant 5); the live payment leg is Maxwell's, per the go-live runbook.

---

## Rollout, data reconciliation, and risks

### Rollout

Standard for this repository: implement on branch → `npm run selftest` + gate-tests green → `npm run build` clean → local browser smoke (mock mode) → staging rehearsal on the demo app → production deploy `fly deploy -c fly.production.toml --strategy immediate` (single machine, single volume; never blue-green) → post-deploy smoke on `assesssuite.com`. Rollback is a clean image swap (`fly releases rollback`); these changes are code-only with no schema migration. Do **not** touch `SUITE_VERSION` / `LEGAL_SUITE_VERSION` (runbook invariant 1). Confirm real Stripe mode and configured prices before enactment (Issue 1 depends on it).

### Data reconciliation (the existing incident)

This patch prevents recurrence; it does not retroactively fix the live data. Before or at enactment, the two `lachlan_keirnan@outlook.com` records (and any duplicate organisation created by the second `ProfileSetup` run) should be reconciled manually: keep the record the customer actually proceeds on, reject/close the other, and confirm no orphaned organisation remains. This is an administrator action on production data and is Maxwell's to direct.

### Risks and open questions for Maxwell

1. **Issue 1 design choice.** Design A (payment before the profile form) is recommended but reorders the onboarding gate chain — a larger change than Design B (harden the existing order). Which does Maxwell want? Both require confirming production is in real Stripe mode with prices set.
2. **Consent timing (Design A).** Moving the full `ProfileSetup` after payment means the practitioner notices are captured post-payment (still before any clinical use, enforced server-side). Confirm this ordering is acceptable, or retain notice capture pre-payment while moving only the heavy profile fields.
3. **Issue 3 direction.** Confirm option (ii) (re-scoped fallback) over option (i) (remove entirely). The recommendation retains a break-glass; if Maxwell wants no manual activation at all, say so.
4. **Name field shape (Issue 4).** First-name + last-name pair, or a single full-name field? And should the canonical store be `full_name`, `clinician_name`, or both kept in sync? The recommendation writes a name at registration and reads `clinician_name || full_name || email` in admin.
5. **Existing duplicate data.** Confirm who reconciles the two live records and the possible duplicate organisation, and when.
6. **Enactment authority.** Issues 1–4 are authorised for enactment separately from the Manage Subscription patch. This remains scope-and-design; nothing is enacted until Maxwell directs it.

---

## Appendix — consolidated change surface (exact paths and lines)

**Diagnosis-only (cited, unchanged):**
- `server/functions/stripeWebhook.mjs:62-138` — auto-activation on payment (works).
- `src/Layout.jsx:67-99` — the onboarding gate chain.
- `server/auth.mjs:76-85` — `email` guarded on `updateMe`; no normalisation present.

**Proposed changes:**

| # | File | Lines | Issue |
|---|---|---|---|
| 1 | `src/pages/Register.jsx` | 12-40, 160-220 | 1, 4 (route to payment; capture name) |
| 2 | `src/pages/Register.jsx` | 42-58 | 1 (post-OTP route to `/PaymentRequired`) |
| 3 | `src/pages/LandingLive.jsx` | 522, 533 | 1 (carry plan selection) |
| 4 | `src/pages/PaymentRequired.jsx` | 9-41 | 1 (honour incoming plan) |
| 5 | `src/Layout.jsx` | 67-99 | 1 (reorder gate: payment before full profile) |
| 6 | `src/pages/ProfileSetup.jsx` | 290-298 | 1 (remove checkout from this form once payment precedes it) |
| 7 | `server/auth.mjs` | new helper | 2 (`normaliseEmail`) |
| 8 | `server/index.mjs` | 777-779 | 2 (`findUserByEmail` case-insensitive) |
| 9 | `server/index.mjs` | 782-799, 801-847, 850-975, 994 | 2 (normalise email in register/login/otp/resend/reset/invite) |
| 10 | `src/pages/AdminApprovals.jsx` | 619-665 | 3 (relabel queue; auto-activation banner; segment stuck accounts) |
| 11 | `src/pages/AdminApprovals.jsx` | 445-458 | 3 (confirm + rename manual activation) |
| 12 | `src/pages/AdminApprovals.jsx` | 634, 683, 781, 813, 1484, 1597 | 4 (name fallback `clinician_name || full_name || email`) |
| 13 | `server/email.mjs` | 128-134 | 4 (optional: name in admin-notify email) |

*End of memorandum.*
