# AssessSuite go-live runbook

**Prepared:** 13 July 2026, under UM-AUTO-20260713-ASSESSSUITE-LAUNCH-READINESS.
**Principle:** everything below Phase 4 is staged and reversible; Phase 4 runs only on Maxwell's word, in order, and every step has a one-operation rollback.
**Production app:** `assesssuite-production` (Fly.io, syd, one machine + one 3 GB encrypted volume; the trusted deployment workflow must verify scheduled snapshots and five-day retention before each release). [Fly's published block-device model](https://community.fly.io/t/we-are-going-to-start-charging-for-volume-snapshots-from-january-2026/26202/3) states that encrypted volume devices are snapshotted without decryption; this is the platform basis for snapshot-encryption evidence because the snapshot-list API exposes no independent encryption field.
**Deployment corridor (always):** dispatch the reviewed `production-deploy.yml` definition from the immutable default-branch revision with its exact-SHA, image-digest, current-state, topology, snapshot and rollback inputs. The enabled `fly.production.toml` and extraction-disabled `fly.rollback.production.toml` are reviewed in that same revision; no mutable rollback branch is permitted. The sealed workflow is the only place permitted to invoke `fly deploy --strategy immediate --ha=false --update-only`; never run that command locally. The single-volume topology must never use blue-green deployment or scale beyond one machine (a second machine gets an empty volume and splits the data).

**Supersession notice (21 July 2026):** Phases 1-4 below are a historical launch record, not an executable operator procedure. Every direct `fly secrets`, `fly ssh`, `fly ips`, certificate, deploy, or rollback command formerly recorded in those phases is superseded by the immutable workflow corridor and the current exact-SHA release runbook at `docs/deployment/20260719-exact-sha-production-release-runbook.md`. No agent or operator may revive those commands from this historical record.

## Invariants (do not violate at any phase)

1. **Do not change `SUITE_VERSION` / `LEGAL_SUITE_VERSION` outside a controlled legal-content release** (`src/lib/legal/documentRegistry.js`, `server/index.mjs`). The current immutable receipt version is `RC-2026.07.19`; `RC-2026.07.11` is accepted only by the extraction-disabled compatibility configuration. A version change intentionally requires re-acceptance and must never be smuggled into an unrelated release.
2. **Never run `server/seed.mjs` against production** (synthetic tenants + publicly-known passwords). Normal production startup runs `server/productionBootstrap.mjs`, which seeds approved reference catalogues only. The separately labelled parity machine may run the full seed solely under `NODE_ENV=test`, against its exact isolated parity database and volume, before switching to the fail-closed production-parity posture.
3. **`ALLOW_OPEN_REGISTRATION=1` may only ever ride an image containing the hardened OTP flow** (random expiring codes; 000000 gated to SELFTEST; lockout) — true of every image built from commit `df7ed19` onward.
4. **Secrets live in the authorised platform secret store only** — never in fly.toml, the repo, reports, or candidate-runner contexts. Release automation may verify required names but must never retrieve or emit values.
5. **Agents never execute payments.** The live payment test is performed personally by Maxwell/Brenton.

## Phase 0 — Code complete (DONE, 13 July 2026)

All launch workstreams committed on `launch/legal-and-consent-integration`; suites green: selftest 102/102, gate-tests 22/22, smoke 10/10, build clean, lint at baseline.

## Phase 1 — Production app staged (DONE, 13 July 2026)

App + volume were created and catalogue-seeded during the historical launch; the resulting state was verified in the contemporaneous session note. This sentence records that completed event and is not authority to repeat the former direct command.

**Historical rollback note:** the pre-public launch retreat no longer applies. Current rollback uses the exact default-branch rollback workflow and never destroys the production app.

## Phase 2 — Email + DNS preparation (MAXWELL — safe now; does not touch the live site)

1. Create a Resend account (free tier) — account creation is a Maxwell action; agents cannot create accounts. Add domain `assesssuite.com`.
2. In GoDaddy (delegate access granted 12 July): add Resend's records — SPF TXT, DKIM CNAMEs, and a DMARC TXT (`v=DMARC1; p=none; rua=mailto:admin@assesssuite.com`). These are additive TXT/CNAME records and do not affect the live Base44 site's A/CNAME.
3. Verify the domain in Resend. Any credential update is a separately authorised platform-administration action outside this deployment runbook; release evidence records its name/presence only, never its value.
4. Deliverability check: register a throwaway account against the production URL with an external inbox (Gmail/Outlook); confirm the OTP lands in the inbox, not spam. Password-reset link check likewise.
5. Certificates ahead of cutover: historically, certificates were prepared for the apex and `www` hosts. Current operators must verify certificate and canonical-host state read-only through the sealed release evidence; certificate mutation requires a separately reviewed, immutable workflow path and must never be performed from this historical runbook.
   **Why this matters:** the SPA's API base and login token are per-origin, and Stripe success/cancel URLs come from `APP_URL` — if users land on a host different from `APP_URL`, the post-checkout redirect strands them on a token-less origin that looks logged-out.

**Rollback:** none needed — the live site is untouched throughout Phase 2.

## Phase 3 — Stripe unblock + test-mode rehearsal (BRENTON items, then agent/Maxwell rehearsal)

Brenton (one email, drafted at `docs/launch/20260713-brenton-stripe-ask-sheet.md`):
1. Grant the existing restricted key the four permissions (Checkout Sessions W, Billing Portal Sessions W, Customers R, Subscriptions R) **or** reveal and send the full secret key. The publishable key is not needed (redirect checkout; no Stripe.js).
2. Send a **test-mode** secret key for rehearsal.
3. Create live Products/Prices: AssessSuite Subscription — 55.00 AUD monthly recurring; 540.00 AUD annual recurring; send both `price_` IDs.
4. Create the live webhook endpoint: `https://assesssuite.com/functions/stripeWebhook` (canonical host), events `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.paused`, `invoice.payment_failed`; send the `whsec_` signing secret.
5. Save the **live** Customer Portal default configuration (Settings → Billing → Customer portal — the test-mode configuration does not transfer).

Historical rehearsal (completed before cutover): test-mode Stripe configuration and the register-to-portal journey were exercised under the then-current launch authority. Direct secret mutation is no longer an authorised rehearsal or rollback mechanism.

## Phase 4 — GO (Maxwell's word; execute in this order)

1. **DNS cutover:** completed historically; current DNS/certificate state is verified read-only before a release and is not mutated by this runbook.
2. **APP_URL:** established historically; the trusted release verifies the canonical public host without altering opaque secrets.
3. **Live Stripe:** established historically; current releases verify required secret names and explicit payment capability posture without reading or mutating values.
4. **Legal publication:** current legal status/effective date are immutable reviewed configuration in `fly.production.toml`, not opaque secret overrides.
   **DONE — 14 July 2026.** Authorisation recorded verbatim: "I, Maxwell Vidler, trading as and through UniMatter, duly authorised agent for AssessSuite Pty Ltd authorise the legal instruments above." Executed `LEGAL_STATUS=effective`, `LEGAL_EFFECTIVE_DATE="14 July 2026"` (no other date specified, so today's date was used). Verified live via the public-settings endpoint: `{"legal":{"status":"effective","effective_date":"14 July 2026"}}`.
5. **Live payment proof (Maxwell + Brenton personally):** register/log in on the live site, complete a real $55 checkout, confirm auto-activation and dashboard access, then cancel and refund from the Stripe dashboard. Confirm the cancellation webhook suspends the account, then reactivate.
6. **Launch smoke:** register → OTP → pay → professional profile + consolidated consent → clinical flow (client, assessment incl. VISA-A, SOAP note) → report generate → archive client → deactivate/reactivate a throwaway account.
7. **Post-launch key hygiene (recommended):** roll the Stripe keys (they transited email/PDF) and update the secrets; Maxwell moves all credentials to Bitwarden.

**Current rollback boundary:** use only the exact default-branch rollback workflow and its reviewed extraction-disabled configuration. Payment, legal-publication, signup, DNS, or secret-state changes require their own reviewed configuration/administration authority and are not ad hoc rollback commands.

## Backups and restore

- The trusted deployment workflow must pin and re-verify scheduled snapshots with five-day retention on the exact existing volume and prove one unambiguous on-demand snapshot before deployment. The TOML settings alone govern only newly created volumes and are not proof of the current volume state.
- Restore is a separately authorised, off-traffic recovery operation: create a new encrypted volume from the selected snapshot, attach it only to an isolated replacement machine, and obtain an authoritative content-free lifecycle delta from the snapshot timestamp to the then-live estate (or a durable off-volume ledger). Replay only later, more-restrictive deletion, expiry, quarantine, provider-block and disposition states. If that delta is unavailable or incomplete, traffic promotion is prohibited. Run startup upload-lifecycle reconciliation and content-free SQLite/file-integrity checks, requiring zero unregistered managed artefacts, unresolved `registering` rows, registry/file mismatches or provider-block inconsistencies before a separately authorised switch decision.
- No independent restore drill has yet proved restoration success. Snapshot availability is a recovery control, not a restoration guarantee.
- A future logical-backup capability must be separately designed, reviewed, automated and tested. This runbook does not authorise an ad hoc production shell, database copy, or download.
- The snapshot schedule can imply an approximate one-day recovery-point interval, but actual recoverability and data loss depend on the most recent successfully created snapshot and the separately verified restore process.

## Standing operational notes

- Deploys: the trusted workflow alone uses `--strategy immediate`; expect a brief (~10-20 s) outage while the existing volume persists. The sealed job performs the names-only required-secret preflight and aborts before mutation if the exact production secret-name set is incomplete. Do not run `npm run deploy:prod`; it is intentionally fail-closed. This gate exists because Fly secrets are app-specific and a credential present on another app proves nothing about `assesssuite-production`.
- `unimatter-demo` (the reseeding demo) is unchanged and remains the safe demonstration surface.
- Transcription remains disabled. Re-enablement requires a reviewed default-branch configuration release and its own assurance; it is not an opaque-secret toggle.
- The Brenton "fix the Base44 app as a backup?" question is out of scope of this mission (live Base44 is an approval trigger) — Maxwell to answer.
- **Open decision — billing on deactivation.** `deactivateAccount` does not cancel the user's Stripe subscription; a self-closed account keeps being billed until the user cancels via the billing portal (the deactivate dialog says so). If you want deactivation to also cancel/pause the subscription, that is a small follow-up (call the gateway's cancel from the function) — deferred because it is a financial-action product choice, not a bug. Decide before real subscribers exist.
