# Brenton unblocker ask-sheet — Stripe (DRAFT for Maxwell to send; not sent)

**Why this exists:** the 12 July email did not actually contain a usable secret key. The `sk_live_...76b4` line is the Stripe dashboard's masked display, not the token; the `mk_...` strings are key IDs; the restricted key was sent in full but its access policy shows "None" (no permissions). The publishable key is not needed at all — AssessSuite's checkout is redirect-based and never loads Stripe.js.

---

Suggested wording (Maxwell to adapt/send):

Hi Brenton,

Five short Stripe items to make payments live — all in the Stripe dashboard (about ten minutes total):

1. **API key.** The secret key in your last email came through as the masked display (`sk_live_...76b4`) rather than the full token. Easiest fix — instead of the secret key, use the restricted key you already created: Developers → API keys → your Restricted key → Edit, and set these four permissions, then send me the key again (it may rotate on edit):
   - Checkout Sessions: **Write**
   - Billing Portal: **Write**
   - Customers: **Read**
   - Subscriptions: **Read**
   (Alternatively: click "Reveal live key token" on the Secret key and send the full `sk_live_...` string. The restricted key is the safer option.)
2. **Test key for rehearsal.** Toggle the dashboard to Test mode and send the test Secret key (`sk_test_...`) too — I will prove the whole flow end to end with Stripe's test cards before any live switch.
3. **Products/prices (Live mode).** Product catalogue → Add product: "AssessSuite Subscription", with two recurring prices — **A$55.00 monthly** and **A$540.00 yearly**. Send me the two `price_...` IDs.
4. **Webhook (Live mode).** Developers → Webhooks → Add endpoint. URL: `https://assesssuite.com/functions/stripeWebhook`. Select events: `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.paused`, `invoice.payment_failed`. Send me the endpoint's Signing secret (`whsec_...`).
5. **Customer portal (Live mode).** Settings → Billing → Customer portal → save the default configuration (one click — this is what lets subscribers manage/cancel their own billing).

One housekeeping note: because these keys have travelled by email, once we have verified the first live payment I recommend rolling them (dashboard → the key's menu → Roll key) and sending the replacement through a safer channel — I will remind you at the time.

---

**Also owed by Maxwell (not Brenton):**
- Resend account (free) + `assesssuite.com` domain verification (SPF/DKIM/DMARC records at GoDaddy) + API key into Fly secrets — real email (OTP signup) does not deliver until this is done.
- Canonical-host decision (apex vs www) before the webhook URL in item 4 is final.
- Answer to Brenton's separate question about fixing the live Base44 app as a backup (out of this mission's scope).
