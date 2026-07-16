# AssessSuite go-live runbook

**Prepared:** 13 July 2026, under UM-AUTO-20260713-ASSESSSUITE-LAUNCH-READINESS.
**Principle:** everything below Phase 4 is staged and reversible; Phase 4 runs only on Maxwell's word, in order, and every step has a one-operation rollback.
**Production app:** `assesssuite-production` (Fly.io, syd, one machine + one 3 GB encrypted volume, daily snapshots, 5-day retention).
**Deploy command (always):** `fly deploy -c fly.production.toml --strategy immediate` — single-volume topology: never blue-green, never scale beyond one machine (a second machine gets an empty volume and splits the data).

## Invariants (do not violate at any phase)

1. **Never bump `SUITE_VERSION` / `LEGAL_SUITE_VERSION`** (`src/lib/legal/documentRegistry.js`, `server/index.mjs`). `RC-2026.07.11` is the immutable content identifier recorded in every LegalAcceptanceEvent; changing it stales every acceptance and locks all users out into re-acceptance. The legal go-live flip is `LEGAL_STATUS` + `LEGAL_EFFECTIVE_DATE` env only (display-layer).
2. **Never run `server/seed.mjs` against production** (synthetic tenants + publicly-known passwords). Production uses `server/seed-catalogue.mjs` only.
3. **`ALLOW_OPEN_REGISTRATION=1` may only ever ride an image containing the hardened OTP flow** (random expiring codes; 000000 gated to SELFTEST; lockout) — true of every image built from commit `df7ed19` onward.
4. **Secrets live in Fly secrets only** — never in fly.toml, the repo, or reports. Admin bootstrap password: `Unimatter\00_System\autonomy\credentials\20260713-assesssuite-production-admin.txt` (Maxwell: move to Bitwarden).
5. **Agents never execute payments.** The live payment test is performed personally by Maxwell/Brenton.

## Phase 0 — Code complete (DONE, 13 July 2026)

All launch workstreams committed on `launch/legal-and-consent-integration`; suites green: selftest 102/102, gate-tests 22/22, smoke 10/10, build clean, lint at baseline.

## Phase 1 — Production app staged (DONE, 13 July 2026)

App + volume created; strong `ADMIN_PASSWORD` and `APP_URL=https://assesssuite-production.fly.dev` staged; deployed with registration open, transcription off, legal RC, Stripe mock, email outbox-only; catalogue-seeded once via `fly ssh console -a assesssuite-production -C "node server/seed-catalogue.mjs"`; verified (see the session note for the verification record).

**Rollback:** `fly apps destroy assesssuite-production` — zero blast radius, nothing public points at it.

## Phase 2 — Email + DNS preparation (MAXWELL — safe now; does not touch the live site)

1. Create a Resend account (free tier) — account creation is a Maxwell action; agents cannot create accounts. Add domain `assesssuite.com`.
2. In GoDaddy (delegate access granted 12 July): add Resend's records — SPF TXT, DKIM CNAMEs, and a DMARC TXT (`v=DMARC1; p=none; rua=mailto:admin@assesssuite.com`). These are additive TXT/CNAME records and do not affect the live Base44 site's A/CNAME.
3. Verify the domain in Resend; copy the API key; `fly secrets set -a assesssuite-production RESEND_API_KEY=<key>` (restarts the machine; OTP and all platform email go live from noreply@assesssuite.com).
4. Deliverability check: register a throwaway account against the production URL with an external inbox (Gmail/Outlook); confirm the OTP lands in the inbox, not spam. Password-reset link check likewise.
5. Certificates ahead of cutover: `fly certs add assesssuite.com -a assesssuite-production` and `fly certs add www.assesssuite.com -a assesssuite-production`. Decide the canonical host (recommendation: apex `assesssuite.com`); at cutover add the www→apex redirect at GoDaddy (domain forwarding) or leave www serving the same app.
   **Why this matters:** the SPA's API base and login token are per-origin, and Stripe success/cancel URLs come from `APP_URL` — if users land on a host different from `APP_URL`, the post-checkout redirect strands them on a token-less origin that looks logged-out.

**Rollback:** none needed — the live site is untouched throughout Phase 2.

## Phase 3 — Stripe unblock + test-mode rehearsal (BRENTON items, then agent/Maxwell rehearsal)

Brenton (one email, drafted at `docs/launch/20260713-brenton-stripe-ask-sheet.md`):
1. Grant the existing restricted key the four permissions (Checkout Sessions W, Billing Portal Sessions W, Customers R, Subscriptions R) **or** reveal and send the full secret key. The publishable key is not needed (redirect checkout; no Stripe.js).
2. Send a **test-mode** secret key for rehearsal.
3. Create live Products/Prices: AssessSuite Subscription — 55.00 AUD monthly recurring; 540.00 AUD annual recurring; send both `price_` IDs.
4. Create the live webhook endpoint: `https://assesssuite.com/functions/stripeWebhook` (canonical host), events `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.paused`, `invoice.payment_failed`; send the `whsec_` signing secret.
5. Save the **live** Customer Portal default configuration (Settings → Billing → Customer portal — the test-mode configuration does not transfer).

Rehearsal (test mode, against the production app, before cutover):
1. `fly secrets set -a assesssuite-production STRIPE_SECRET_KEY=sk_test_... STRIPE_PRICE_ID_MONTHLY=price_... STRIPE_PRICE_ID_ANNUAL=price_...` (+ a test webhook endpoint against the fly.dev URL, `STRIPE_WEBHOOK_SECRET=whsec_...`).
2. Full journey: register → OTP (real email) → profile + consents → PaymentRequired → test card 4242… → webhook fires → **account auto-activates** → dashboard loads → portal opens.
3. `fly secrets unset -a assesssuite-production STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET` (back to mock until go).

**Rollback:** unset the Stripe secrets — mock returns instantly.

## Phase 4 — GO (Maxwell's word; execute in this order)

1. **DNS cutover** (GoDaddy): point `assesssuite.com` A/AAAA (and www per the canonical-host decision) at the Fly app (`fly ips list -a assesssuite-production` for the addresses). Confirm both certs show issued; site loads on the canonical host.
2. **Update APP_URL:** `fly secrets set -a assesssuite-production APP_URL=https://assesssuite.com` (must exactly match the canonical host).
3. **Live Stripe:** `fly secrets set -a assesssuite-production STRIPE_SECRET_KEY=<live rk/sk> STRIPE_WEBHOOK_SECRET=<live whsec> STRIPE_PRICE_ID_MONTHLY=<live> STRIPE_PRICE_ID_ANNUAL=<live>`. Confirm the live webhook endpoint URL matches the canonical host.
4. **Legal flip:** `fly secrets set -a assesssuite-production LEGAL_STATUS=effective LEGAL_EFFECTIVE_DATE="<date>"`. (Display-only; see Invariant 1. Run only once an authorised Assess Suite Pty Ltd officer has approved the instruments — the flip IS the publication act.)
   **DONE — 14 July 2026.** Authorisation recorded verbatim: "I, Maxwell Vidler, trading as and through UniMatter, duly authorised agent for AssessSuite Pty Ltd authorise the legal instruments above." Executed `LEGAL_STATUS=effective`, `LEGAL_EFFECTIVE_DATE="14 July 2026"` (no other date specified, so today's date was used). Verified live via the public-settings endpoint: `{"legal":{"status":"effective","effective_date":"14 July 2026"}}`.
5. **Live payment proof (Maxwell + Brenton personally):** register/log in on the live site, complete a real $55 checkout, confirm auto-activation and dashboard access, then cancel and refund from the Stripe dashboard. Confirm the cancellation webhook suspends the account, then reactivate.
6. **Launch smoke:** register → OTP → profile + consents → pay → clinical flow (client, assessment incl. VISA-A, SOAP note) → report generate → archive client → deactivate/reactivate a throwaway account.
7. **Post-launch key hygiene (recommended):** roll the Stripe keys (they transited email/PDF) and update the secrets; Maxwell moves all credentials to Bitwarden.

**Rollback points (any time, in isolation):**
- Payments off: `fly secrets unset -a assesssuite-production STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET` → deterministic mock, no charges possible.
- Legal back to RC: `fly secrets unset -a assesssuite-production LEGAL_STATUS LEGAL_EFFECTIVE_DATE`.
- Freeze signups: `fly secrets set -a assesssuite-production ALLOW_OPEN_REGISTRATION=0` (secret overrides the toml env at runtime — verify with `fly ssh console -C "printenv ALLOW_OPEN_REGISTRATION"`).
- Full retreat: revert the GoDaddy A/CNAME records to the old Base44 target.

## Backups and restore

- Fly volume snapshots: automatic daily, 5-day retention (`fly volumes snapshots list <vol id>`). Restore = create new volume from snapshot, attach to a replacement machine.
- Recommended addition post-launch: scheduled logical backup — `fly ssh console -a assesssuite-production -C "sqlite3 /app/server/data/app.db 'VACUUM INTO \"/app/server/data/backup-$(date +%F).db\"'"` and download via `fly ssh sftp`; keep an off-Fly copy. (sqlite3 CLI availability on the image should be checked; `node -e` with node:sqlite backup API is the fallback.)
- RPO with snapshots alone: up to ~24 h. Acceptable for launch scale (two users); revisit with uptake.

## Standing operational notes

- Deploys: always `--strategy immediate`; expect a brief (~10-20 s) outage; data persists on the volume. **Preflight the secret set first:** `npm run check:prod-secrets` (or deploy via `npm run deploy:prod`, which runs the check as a hard gate and aborts if any required secret is missing — ADMIN_PASSWORD, APP_URL, RESEND_API_KEY, the four Stripe values, OPENAI_API_KEY, LEGAL_STATUS/DATE). This gate exists because OPENAI_API_KEY was live on `unimatter-demo` but never propagated to `assesssuite-production` (Fly secrets are per-app), so every AI surface served mock content in production until it was set on 16 July 2026.
- `unimatter-demo` (the reseeding demo) is unchanged and remains the safe demonstration surface.
- Transcription re-enable (post-launch, after the pricing decision): `fly secrets set -a assesssuite-production TRANSCRIPTION_ENABLED=1` — UI reappears and the function accepts calls; no deploy needed.
- The Brenton "fix the Base44 app as a backup?" question is out of scope of this mission (live Base44 is an approval trigger) — Maxwell to answer.
- **Open decision — billing on deactivation.** `deactivateAccount` does not cancel the user's Stripe subscription; a self-closed account keeps being billed until the user cancels via the billing portal (the deactivate dialog says so). If you want deactivation to also cancel/pause the subscription, that is a small follow-up (call the gateway's cancel from the function) — deferred because it is a financial-action product choice, not a bug. Decide before real subscribers exist.
