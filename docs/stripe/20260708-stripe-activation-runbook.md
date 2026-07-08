# Stripe activation runbook — AssessSuite migration backend

**Date prepared:** 8 July 2026
**Scope:** backend activation only. The demo frontend intentionally presents payments as simulated (Paywall.jsx; PaymentRequired.jsx) and this runbook does not change that posture. Flipping the frontend to live checkout is a separate decision (D5); the steps below prepare and prove the backend so that decision, if taken, is a frontend-only change.
**Principle:** supply a key and it works. With no key set, the four payment functions run against the deterministic mock (`server/mocks/stripe.mjs`) exactly as the deployed demo does today. `SELFTEST=1` always uses the mock, key or no key.

## 1. What was built

| Piece | Location | Behaviour |
|---|---|---|
| Real Stripe adapter | `server/stripeGateway.mjs` | Built-in `fetch` against `https://api.stripe.com`, form-encoded bodies, `Authorization: Bearer` — no new npm dependency. Covers checkout session (subscription mode), billing-portal session, customer lookup by email, subscription list/retrieve. |
| Webhook signature verification | `server/stripeGateway.mjs` (`verifyStripeSignatureHeader`) | Parses `Stripe-Signature` (`t=`, `v1=`), HMAC-SHA256 of `t.rawBody` with `STRIPE_WEBHOOK_SECRET`, timing-safe compare, rejects timestamps outside a five-minute window. Verified against the raw request bytes (`ctx.rawBody`, provided by `server/functions/index.mjs`). |
| Mode switch | `stripeEnabled()` in `server/stripeGateway.mjs` | True only when `STRIPE_SECRET_KEY` is set and `SELFTEST` is not `1`. The four functions branch on this helper and nothing else. |
| Branching functions | `server/functions/createCheckoutSession.mjs`, `createPortalSession.mjs`, `stripeWebhook.mjs`, `syncStripeSubscription.mjs` | Real gateway when enabled; existing mock otherwise. The User entitlement writes are identical in shape on both paths (`account_status`, `subscription_status`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_start_date`). |

## 2. Environment variables

| Variable | Purpose | Where obtained |
|---|---|---|
| `STRIPE_SECRET_KEY` | The single activation switch; secret API key (`sk_test_...` in test mode) | Stripe dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint signing secret (`whsec_...`); mandatory in real mode — unsigned webhook posts are rejected | `stripe listen` output locally; dashboard webhook endpoint "Signing secret" when deployed |
| `STRIPE_PRICE_ID_MONTHLY` | Price id (`price_...`) served when the caller passes `plan: "monthly"` (or no plan) | Stripe dashboard → Product catalogue |
| `STRIPE_PRICE_ID_ANNUAL` | Price id served when the caller passes `plan: "annual"` | Stripe dashboard → Product catalogue |
| `APP_URL` | Absolute origin (no trailing slash) for checkout success/cancel URLs and the portal return URL | `http://localhost:5173` locally; `https://unimatter-demo.fly.dev` on Fly |

All five are listed with comments in `.env.example`. The backend reads `process.env` directly — there is no dotenv loader — so set them in the shell (or with `node --env-file`) locally, and as Fly secrets when deployed.

## 3. Create test-mode keys and prices (Stripe dashboard)

1. Sign in at https://dashboard.stripe.com and switch the dashboard to **Test mode** (toggle, top right). Every step in this runbook stays in test mode; no live key is created or required.
2. Developers → API keys → copy the **Secret key** (`sk_test_...`). This becomes `STRIPE_SECRET_KEY`.
3. Product catalogue → **Add product**: name it (for example "AssessSuite Subscription"), add a **recurring** monthly price (AUD 55.00 to match the demo copy) and a recurring annual price. Copy the two price ids (`price_...`) into `STRIPE_PRICE_ID_MONTHLY` and `STRIPE_PRICE_ID_ANNUAL`.
4. Do not reuse the price ids embedded in the captured frontend (`price_1TbH07...`, `price_1TaUtn...`); they belong to the client's original Stripe account and do not exist in the new one.

## 4. Local end-to-end test (test mode)

Run everything from the repository root (`C:\Users\Maxwe\Projects\assesssuite_migration`).

1. Set the environment for the backend shell, then start the server:

   ```powershell
   $env:STRIPE_SECRET_KEY = "sk_test_..."
   $env:STRIPE_PRICE_ID_MONTHLY = "price_..."
   $env:STRIPE_PRICE_ID_ANNUAL = "price_..."
   $env:APP_URL = "http://localhost:5173"
   # STRIPE_WEBHOOK_SECRET is set in step 3 below, then restart the server.
   npm run server
   ```

   In a second shell, `npm run dev` for the Vite frontend (5173, proxying `/api` and `/functions` to 8787) if a browser flow is wanted; the backend can also be exercised directly on 8787 with curl.

2. Install the Stripe CLI if not present (https://stripe.com/docs/stripe-cli), then `stripe login` (test mode).
3. Forward webhooks to the local shim:

   ```powershell
   stripe listen --forward-to localhost:8787/functions/stripeWebhook
   ```

   The CLI prints a signing secret (`whsec_...`). Set it and restart the server:

   ```powershell
   $env:STRIPE_WEBHOOK_SECRET = "whsec_..."
   npm run server
   ```

4. Create a checkout session. Either click through PaymentRequired in the browser (it will now receive a real `https://checkout.stripe.com/...` URL), or directly:

   ```powershell
   curl -s -X POST http://localhost:8787/functions/createCheckoutSession -H "Content-Type: application/json" -d '{"plan":"monthly","userId":"<user id>","userEmail":"<user email>"}'
   ```

   Use the id and email of a real seeded user (for example the bootstrap admin) so the webhook can attribute the purchase. The response is `{"url":"https://checkout.stripe.com/..."}`.

5. Open the returned URL in a browser and pay with the standard test card: number `4242 4242 4242 4242`, any future expiry, any CVC, any postcode. Stripe fires `checkout.session.completed`; the CLI forwards it; the shim verifies the signature and writes the entitlement.
6. Verify the entitlement flipped on the User record (section 6).
7. Optional round trips: `syncStripeSubscription` (authenticated POST to `/functions/syncStripeSubscription`) should now return `success: true` with the same data shape; `createPortalSession` with the user's new `stripe_customer_id` should return a `https://billing.stripe.com/...` URL. Note the billing portal requires a saved portal configuration in test mode — the dashboard prompts to create the default configuration on first use (Settings → Billing → Customer portal).
8. Negative check: POST any JSON to `/functions/stripeWebhook` without a `Stripe-Signature` header — it must be rejected with 400 `Invalid signature`.

## 5. Deployed demo (Fly app `unimatter-demo`)

1. Set the secrets (this restarts the machine):

   ```powershell
   fly secrets set -a unimatter-demo STRIPE_SECRET_KEY="sk_test_..." STRIPE_PRICE_ID_MONTHLY="price_..." STRIPE_PRICE_ID_ANNUAL="price_..." APP_URL="https://unimatter-demo.fly.dev"
   ```

2. Create a dashboard webhook endpoint (test mode): Developers → Webhooks → **Add endpoint**.
   - Endpoint URL: `https://unimatter-demo.fly.dev/functions/stripeWebhook`
   - Events to subscribe: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
   - Handling note: the handler acts on `checkout.session.completed`, `customer.subscription.deleted` (and `.paused`), and `invoice.payment_failed`; `customer.subscription.updated` is acknowledged with 200 but not yet acted upon — the captured Base44 source did not handle it either. Subscribing it now means the endpoint history captures plan changes for when a handler is added.
3. Copy the endpoint's **Signing secret** (`whsec_...`) and set it:

   ```powershell
   fly secrets set -a unimatter-demo STRIPE_WEBHOOK_SECRET="whsec_..."
   ```

4. Repeat the section 4 checkout test against the deployed URL. The dashboard endpoint page shows each delivery and the shim's 200/400 responses.
5. Caution: the deployed demo reseeds synthetic data on boot (see `fly.toml` header comment); entitlement flips on the deployed database do not survive a reseed. Treat the deployed test as a wiring proof, not durable state.

## 6. Verifying the entitlement flipped

The webhook (and `syncStripeSubscription`) write these fields to the User record; both paths write the identical shape:

- `account_status`: `active`
- `subscription_status`: `active`
- `stripe_customer_id`: `cus_...`
- `stripe_subscription_id`: `sub_...`
- `subscription_start_date`: ISO 8601 timestamp

Check any of:

- Log in as the user; `base44.auth.me()` payloads (visible in the browser network tab on any page load) carry the fields.
- As an admin, `GET /api/apps/local-assesssuite/entities/User` and inspect the record.
- Locally, open `server/data/app.db` with any SQLite client and inspect the `User` table.

After a test-mode cancellation in the dashboard (`customer.subscription.deleted`), the record should show `account_status: suspended`, `subscription_status: cancelled`. A failed test invoice (`invoice.payment_failed`, e.g. via test clock or the `4000 0000 0000 0341` card) should show `subscription_status: payment_failed`.

## 7. Rollback

Unset the key and the mock returns — no code change, no redeploy of code:

- Locally: start the server without `STRIPE_SECRET_KEY` in the environment.
- Fly: `fly secrets unset -a unimatter-demo STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_ID_MONTHLY STRIPE_PRICE_ID_ANNUAL APP_URL` (only `STRIPE_SECRET_KEY` gates the mode; unsetting the rest keeps the environment clean).

With the key unset, `stripeEnabled()` is false, all four functions serve the deterministic mock, and the demo behaves exactly as before activation. Delete or disable the dashboard webhook endpoint at the same time so Stripe does not accumulate failed deliveries.

## 8. Known limits and cautions

- **Frontend posture unchanged (D5).** Paywall.jsx shows a simulation notice by design; PaymentRequired.jsx passes hard-coded price ids from the client's original account, which will fail cleanly in real mode with a Stripe "No such price" message unless D5 is taken and the frontend is updated. Backend-initiated flows (curl, ProfileSetup's `plan: "monthly"` path) use the `STRIPE_PRICE_ID_*` values and work as-is.
- **PendingApproval.jsx** invokes `createCheckoutSession` with `price_id`/`customer_email` (snake case), which the function has never read (a defect carried over from the captured source); in real mode that call falls back to `STRIPE_PRICE_ID_MONTHLY`.
- **No live keys.** Everything above is test mode. Moving to live keys is a separate, deliberate step outside this runbook.
- **API version.** No `Stripe-Version` header is pinned (matching the captured functions); the account's default version applies. The sync function tolerates both the pre-2025 and current locations of `current_period_start`.
