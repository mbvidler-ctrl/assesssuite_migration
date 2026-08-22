# Physio live self-service release evidence

Contract: `assesssuite-physio-live-self-service/4.0.0`

This lane proves one normal public Physio account through two ordered browser journey phases, one intervening provider-direct validation action, and one cleanup-only recovery action. Provision and payment validation are release-bound to `https://assesssuite-physio-production.fly.dev` before custom DNS; finalization is release-bound to `https://physio.app.assesssuite.com` after the restart, DNS, TLS and second acceptance pass. Both hosts share app ID `local-assesssuite-physio`, profession ID `physio`, the exact merged SHA/image/catalogue, the same 12-hex sequence suffix, and the same synthetic account throughout.

The ordered production journey is:

1. `provision` on the exact Fly provider host before custom DNS: public registration, direct Gmail API OTP readback with a passing `assesssuite.com` DKIM signature, normal verification, and a server-created live Stripe hosted Checkout Session. The content-free runtime email-readiness and Gmail/DKIM receipts are persisted locally. Only after the PASS provision receipt exists does the lane emit `assesssuite-physio-email-configuration/1.0.0`, bound to the deploy, exact-image canary, provision, exact runtime host/release/image, configured `RESEND_API_KEY` readiness and observed Gmail/DKIM evidence. The Session URL is written only to an exact, mode-0600 transient file outside the repository and evidence tree. Maxwell's existing trusted Chrome profile completes hosted Checkout using its own autofill, Link or wallet. The controller returns only a content-free admission receipt; live Session, subscription, Customer and default `pm_` readback is the sole completion gate before the application resumes its server-owned Fly-host return URL, confirms entitlement, completes clinician/practice onboarding and proves logout/login. It leaves the one account and its 30-day trial active.
2. `validate_payment`: after durable provision, require the emitted email-configuration receipt hash, create one metadata-bound live PaymentIntent for exactly AUD 1.00 (100 minor units) against the exact Checkout-collected default PaymentMethod, read back its non-invoice Charge, immediately issue and read back a full AUD 1.00 Refund, and snapshot the resulting cleanup ledger. The v2 payment receipt carries the email-configuration hash so later phases derive it from that immutable receipt. Direct Charges API creation and invoice-only reconciliation are prohibited.
3. The external controller uses that same account for the Fly-host functional pass, restart, DNS/TLS attachment, and custom-host functional pass.
4. `finalize`: normal recovery email and password reset, exact pre-mutation provider readback, UI cancellation/deactivation during trial, immediate Account Deactivated route, fresh persisted 403/no-token login denial, cancellation/refund reconciliation, and terminal provider readback. It consumes the exact payment-validation receipt and ledger snapshot.

`resume_cleanup` is not another journey phase. It is a cleanup-only action for an interrupted provision, validation or finalize. It cannot register an account, create Checkout, or create a new validation PaymentIntent. If the PaymentIntent or Refund response was lost, it discovers the exact metadata-bound provider object and completes the full refund without duplicate creation.

No live/provider effects are performed by static validation, `node --check`, the focused Node tests, lint, or Playwright `--list`.

## Commands

Load all values into the child process through the L5 executor. Do not put credentials on a command line.

Provision:

```powershell
$env:PHYSIO_SELF_SERVICE_PHASE = 'provision'
npm run test:physio-live-self-service
```

Finalize:

```powershell
$env:PHYSIO_SELF_SERVICE_PHASE = 'finalize'
npm run test:physio-live-self-service
```

Payment validation, after provision and before functional QA/finalization:

```powershell
$env:PHYSIO_SELF_SERVICE_PHASE = 'validate-payment'
npm run test:physio-live-self-service:validate_payment
```

The exact underlying Playwright command for both phases is:

```powershell
npx playwright test --config e2e/physio-live-self-service/playwright.config.mjs
```

Cleanup-only recovery:

```powershell
$env:PHYSIO_SELF_SERVICE_PHASE = 'resume-cleanup'
node e2e/physio-live-self-service/resume-cleanup.mjs
```

The control-plane action names are `provision`, `validate_payment`, `finalize`, and `resume_cleanup`; the underscore actions map to executable phase values `validate-payment` and `resume-cleanup`.

## Common release-bound inputs

Every action requires these names unless a phase rule below says otherwise:

- `PHYSIO_SELF_SERVICE_EXTERNAL_EFFECTS_AUTHORIZED=1`
- `PHYSIO_SELF_SERVICE_ORIGIN`, phase-bound exactly as follows: Fly provider origin for `provision` and `validate-payment`; custom origin for `finalize`; either exact origin for `resume-cleanup`
- `PHYSIO_SELF_SERVICE_SEQUENCE_ID=assesssuite-physio-self-service-<12hex>`
- `PHYSIO_SELF_SERVICE_NAMESPACE=physio-self-service-<same-12hex>`
- `PHYSIO_SELF_SERVICE_ACCOUNT_EMAIL` using the exact `+assesssuite-physio-self-service-<same-12hex>` alias
- `PHYSIO_SELF_SERVICE_EXPECTED_EMAIL_SHA256`
- `PHYSIO_SELF_SERVICE_EXPECTED_SHA`
- `PHYSIO_SELF_SERVICE_EXPECTED_IMAGE`
- `PHYSIO_SELF_SERVICE_EXPECTED_CATALOGUE_CHECKSUM`
- `PHYSIO_SELF_SERVICE_DEPLOY_RECEIPT_SHA256`
- `PHYSIO_SELF_SERVICE_EXACT_IMAGE_CANARY_RECEIPT_SHA256`
- `PHYSIO_SELF_SERVICE_STRIPE_CHECKOUT_CONFIGURATION_RECEIPT_SHA256`
- `PHYSIO_SELF_SERVICE_STRIPE_PRODUCT_RECEIPT_SHA256`
- `PHYSIO_SELF_SERVICE_STRIPE_PRICE_RECEIPT_SHA256`
- `PHYSIO_SELF_SERVICE_STRIPE_ANNUAL_PRICE_RECEIPT_SHA256`
- `PHYSIO_SELF_SERVICE_STRIPE_WEBHOOK_RECEIPT_SHA256`
- `PHYSIO_SELF_SERVICE_JOURNEY_MANIFEST_SHA256`
- `PHYSIO_SELF_SERVICE_L5_INTENT_ID`
- `PHYSIO_SELF_SERVICE_STRIPE_SECRET_KEY`
- `PHYSIO_SELF_SERVICE_STRIPE_PRODUCT_ID`
- `PHYSIO_SELF_SERVICE_STRIPE_PRICE_ID`
- `PHYSIO_SELF_SERVICE_STRIPE_ANNUAL_PRICE_ID`
- `PHYSIO_SELF_SERVICE_EXPECTED_DUE_TODAY_AUD_CENTS=0`
- `PHYSIO_SELF_SERVICE_MAX_CHARGE_AUD_CENTS=2000`
- `PHYSIO_SELF_SERVICE_RECURRING_AMOUNT_AUD_CENTS=5500`
- `PHYSIO_SELF_SERVICE_ANNUAL_RECURRING_AMOUNT_AUD_CENTS=54000`
- `PHYSIO_SELF_SERVICE_TRIAL_DAYS=30`

`PHYSIO_SELF_SERVICE_EVIDENCE_DIR` is optional, but if supplied it must resolve inside the repository. The default is `output/playwright/physio-live-self-service/<sequence-id>`.

`PHYSIO_SELF_SERVICE_TRUSTED_BROWSER_HANDOFF_DIR` is optional. If supplied, it must resolve outside both the repository and evidence tree. The default is the operating-system temporary directory under `assesssuite-physio-self-service`. The exact sequence-bound handoff is deleted after admission and by teardown/resume cleanup.

## Phase-specific inputs

Provision additionally requires:

- `PHYSIO_SELF_SERVICE_INITIAL_PASSWORD`
- `PHYSIO_SELF_SERVICE_REPLACEMENT_PASSWORD`
- `PHYSIO_SELF_SERVICE_CLINICIAN_NAME`
- `PHYSIO_SELF_SERVICE_CLINIC_NAME`
- `PHYSIO_SELF_SERVICE_CLINIC_ADDRESS`
- `PHYSIO_SELF_SERVICE_CLINIC_PHONE`
- `PHYSIO_SELF_SERVICE_QUALIFICATION`
- `PHYSIO_SELF_SERVICE_REGISTRATION_NUMBER`
- `PHYSIO_SELF_SERVICE_GMAIL_API_BEARER_TOKEN`
- `PHYSIO_SELF_SERVICE_GMAIL_MAILBOX_ID`
- optional `PHYSIO_SELF_SERVICE_CARD_ENTRY_MECHANISM=trusted-browser-autofill`; any other value fails

Provision explicitly refuses `PHYSIO_SELF_SERVICE_EMAIL_CONFIGURATION_RECEIPT_SHA256`. That receipt does not exist before the journey: provision creates it only after real Gmail/DKIM delivery and the PASS provision receipt have both been observed.

Payment validation additionally requires:

- `PHYSIO_SELF_SERVICE_PROVISION_RECEIPT_SHA256`
- `PHYSIO_SELF_SERVICE_PROVISION_LEDGER_SHA256`
- `PHYSIO_SELF_SERVICE_EMAIL_CONFIGURATION_RECEIPT_SHA256`, exactly as emitted by provision
- `PHYSIO_SELF_SERVICE_VALIDATION_INPUT_LEDGER_SHA256`, the raw hash of the exact untouched provisioned cleanup ledger

Finalize additionally requires:

- `PHYSIO_SELF_SERVICE_INITIAL_PASSWORD`
- `PHYSIO_SELF_SERVICE_REPLACEMENT_PASSWORD`
- `PHYSIO_SELF_SERVICE_GMAIL_API_BEARER_TOKEN`
- `PHYSIO_SELF_SERVICE_GMAIL_MAILBOX_ID`
- `PHYSIO_SELF_SERVICE_PROVISION_RECEIPT_SHA256`
- `PHYSIO_SELF_SERVICE_PROVISION_LEDGER_SHA256`
- `PHYSIO_SELF_SERVICE_PAYMENT_VALIDATION_RECEIPT_SHA256`
- `PHYSIO_SELF_SERVICE_PAYMENT_VALIDATION_LEDGER_SHA256`
- `PHYSIO_SELF_SERVICE_FLY_HOST_QA_RECEIPT_SHA256`
- `PHYSIO_SELF_SERVICE_RESTART_RECEIPT_SHA256`
- `PHYSIO_SELF_SERVICE_CUSTOM_HOST_QA_RECEIPT_SHA256`
- `PHYSIO_SELF_SERVICE_DNS_TLS_RECEIPT_SHA256`

Cleanup-only recovery always requires:

- `PHYSIO_SELF_SERVICE_INITIAL_PASSWORD`
- `PHYSIO_SELF_SERVICE_REPLACEMENT_PASSWORD`
- `PHYSIO_SELF_SERVICE_PROVISION_BINDING_KIND=pass|attempt`
- `PHYSIO_SELF_SERVICE_RESUME_INPUT_LEDGER_SHA256`, the raw SHA-256 of the current evolving cleanup-ledger bytes before any resume mutation

For `pass`, it additionally requires `PHYSIO_SELF_SERVICE_PROVISION_RECEIPT_SHA256` and `PHYSIO_SELF_SERVICE_PROVISION_LEDGER_SHA256`. If validation completed, the control plane also supplies `PHYSIO_SELF_SERVICE_PAYMENT_VALIDATION_RECEIPT_SHA256` and `PHYSIO_SELF_SERVICE_PAYMENT_VALIDATION_LEDGER_SHA256` together. A completed validation ledger without those exact bindings fails closed.

For `attempt`, including an interrupted provision with no PASS receipt, it additionally requires:

- `PHYSIO_SELF_SERVICE_PROVISION_ATTEMPT_RECEIPT_SHA256`
- `PHYSIO_SELF_SERVICE_PROVISION_INITIAL_LEDGER_SHA256`

If that attempt ledger is already `created-unknown` or otherwise indicates that registration may have been submitted, direct Gmail readback also requires `PHYSIO_SELF_SERVICE_GMAIL_API_BEARER_TOKEN` and `PHYSIO_SELF_SERVICE_GMAIL_MAILBOX_ID`. They are deliberately optional for the exact immutable `not-submitted`/no-effect marker: that path performs no mailbox, application or Stripe call and closes locally without replaying creation.

The named credential labels are exactly:

- `PHYSIO_SELF_SERVICE_INITIAL_PASSWORD`
- `PHYSIO_SELF_SERVICE_REPLACEMENT_PASSWORD`
- `PHYSIO_SELF_SERVICE_GMAIL_API_BEARER_TOKEN`
- `PHYSIO_SELF_SERVICE_GMAIL_MAILBOX_ID`
- `PHYSIO_SELF_SERVICE_STRIPE_SECRET_KEY`

There is deliberately no PAN, expiry, CVC, direct `pm_`, or protected-runner card credential. Supplying one of the former raw-card/direct-PaymentMethod inputs fails configuration. The disabled `protected-runner-ephemeral-secret` alternate requires separate authority and is not implemented by this lane.

`PHYSIO_SELF_SERVICE_STRIPE_SECRET_KEY` admits a live restricted key (`rk_live_`) as the preferred least-authority credential and an exact live secret key (`sk_live_`) only as the deliberate approved-account fallback. Test-mode keys fail closed.

## Email evidence contract

Launch proof permits direct Gmail API readback only. An alternate JSON adapter, browser-supplied receipt, fixed OTP, reset backdoor, or provider substitution fails configuration. The mailbox credential is an external prerequisite; this lane does not create a Gmail account.

The message must match the exact recipient alias, exact subject, creation window, Gmail message/thread/history identifiers and RFC message ID. The received headers must contain a syntactically valid DKIM signature with `d=assesssuite.com`, a selector, SHA-256 algorithm, and signature value, plus a correlated `Authentication-Results` clause with `dkim=pass`, the same `header.d` and selector. Before registration, the normal `/api/capabilities` readback must also report the required `transactional_email` dependency enabled, required and ready. The product runtime defines that content-free state as real-provider posture with a configured `RESEND_API_KEY`; the retained readiness receipt names that required secret but neither observes nor retains its value. The post-provision receipt truthfully binds this configuration readiness to Gmail readback of a DKIM-authenticated AssessSuite-domain message. It does not claim Resend account, message or request identity because no independently correlated Resend provider receipt is available.

Message bodies, OTPs, reset links, OAuth tokens, secret values and raw Gmail provider IDs are not retained. Only allowlisted content-free fields and hashes are written. No application endpoint or public writer/export surface is introduced; these are mode-0600 release evidence files created only by the authorised local journey.

## Stripe evidence and cost contract

All direct calls pin Stripe API `2026-07-29.dahlia`. The live product and prices must be:

- product lookup metadata `assesssuite_physio`
- monthly lookup key `assesssuite_physio_monthly_aud_5500`, AUD 5500, interval `month`
- annual lookup key `assesssuite_physio_annual_aud_54000`, AUD 54000, interval `year`
- product/price metadata `appId=local-assesssuite-physio`, `professionId=physio`
- server-derived Checkout and Subscription metadata `qaSequence=assesssuite-physio-self-service-<12hex>`
- server-generated Checkout `integration_identifier` matching `^assesssuite_physio_[a-z]{8}$`
- dynamic payment methods and no pinned `payment_method_types`
- `payment_method_collection=always`
- exactly 30 trial days and no immediate charge

Provision is hybrid and app-script-assisted; it is not browser-only. Playwright owns registration, verification, Session creation, provider-gated return, onboarding and login. Only hosted Checkout completion is handed to the existing trusted Chrome profile. Neither the runner nor the control plane receives or retains PAN/CVC, and direct `pm_` injection is forbidden. The content-free admission binds the exact sequence, Session hash, Checkout-URL hash, L5 intent, profile class and not-before time. It is insufficient on its own: live provider readback must confirm the completed zero-due Session, one trialing subscription, exact Customer and attached default PaymentMethod before the application journey can continue.

The separate validation action uses `POST /v1/payment_intents` with `amount=100`, `currency=aud`, `confirm=true`, `off_session=true`, the exact Customer/default PaymentMethod and metadata `appId`, `professionId`, `l5IntentId`, `qaSequence`, `subscriptionId`, `provisionReceiptSha256`, `provisionLedgerSha256`, and `emailConfigurationReceiptSha256`. It omits `payment_method_types`. Both deterministic, binding-derived PaymentIntent and Refund idempotency keys include the email-configuration receipt hash. A response loss is resolved by exact bounded provider discovery before any retry or later cleanup. The resulting Charge must be live, succeeded, captured for 100 cents, and have no invoice. The action then uses `POST /v1/refunds`, reads back the exact Refund and Charge, and admits PASS only when `amount_refunded=100`. If the saved default PaymentMethod cannot confirm off-session, validation fails loudly while cleanup retains the trial-cancellation path.

Before cancellation, refund, or incomplete-Checkout expiration, the lane refuses ambiguity and independently binds the unique sequence email and creation window to the expected user, Checkout Session, customer, subscription, price, product, application, profession and server-derived QA metadata. Every captured charge must bind through an exact invoice/subscription metadata readback. A charge above AUD 20 stops before refund mutation. An unexpected charge at or below AUD 20 is refunded and read back, but launch acceptance still fails because the provision/final receipt requires zero actual charge.

An interrupted, uncharged Checkout Session can be found by exact sequence metadata before a customer or subscription exists. It is expired only after exact Session, price, product, optional customer, zero-subscription and zero-charge readbacks. Ambiguity or a financially active incomplete Session fails closed.

## Durable ledger and retained evidence

The evolving cleanup ledger is `physio-live-self-service-cleanup-ledger.json`. Its states are `provisioning-started`, `cleanup-required`, `provisioned-awaiting-functional-qa`, `finalization-started`, and `completed`. Registration state is `not-submitted`, `created-unknown`, or `verified`.

Cleanup steps are:

1. `registration-account-reconciliation`
2. `trusted-browser-checkout-completion`
3. `stripe-object-binding-reconciliation`
4. `stripe-live-payment-validation-reconciliation`
5. `application-account-deactivation`
6. `stripe-subscription-reconciliation`
7. `stripe-charge-refund-reconciliation`
8. `persisted-deactivation-login-denial`
9. `post-cleanup-provider-readback`

Each step records `pending|started|completed|failed`, timestamps and a content-free receipt hash. Global setup records an exact `not-submitted` marker before browser execution. Immediately before submit the registration step is recorded `started` and becomes `created-unknown`; response uncertainty never authorises a second submission. If execution fails before that transition, cleanup completes from the durable no-effect marker without requiring Gmail or attempting account creation. Cleanup resume validates the raw current-ledger hash before mutation, performs readback first for a `started` step, and only re-enters a failed step through the explicit resume action.

Provision always creates, before the first browser effect:

- `physio-live-self-service-provision-attempt-receipt.json`
- `physio-live-self-service-provision-initial-ledger.json`
- `physio-live-self-service-cleanup-ledger.json`
- `PROVISION-ATTEMPT-SHA256SUMS`

`PROVISION-ATTEMPT-SHA256SUMS` line order is attempt receipt, then immutable initial ledger.

A successful provision additionally creates:

- `physio-live-self-service-runtime-email-readiness-receipt.json`
- `physio-live-self-service-registration-email-readback-receipt.json`
- `physio-live-self-service-provision-receipt.json`
- `physio-live-self-service-email-configuration-receipt.json`
- `physio-live-self-service-provision-ledger.json`
- `physio-live-self-service-trusted-browser-admission.json`
- `PROVISION-SHA256SUMS`

`PROVISION-SHA256SUMS` line order is attempt receipt, immutable initial ledger, runtime email-readiness receipt, registration Gmail/DKIM readback receipt, PASS provision receipt, post-provision email-configuration receipt, immutable provisioned ledger, trusted-browser admission, then current cleanup ledger. The immutable provisioned ledger and PASS receipt raw hashes are consumed by payment validation; the emitted email-configuration receipt separately binds those provision bytes to the runtime readiness and real delivery proof.

Successful payment validation additionally creates:

- `physio-live-self-service-payment-validation-receipt.json`
- `physio-live-self-service-payment-validation-ledger.json`
- `PAYMENT-VALIDATION-SHA256SUMS`

The validation checksum order is provision receipt, immutable provision ledger, email-configuration receipt, validation receipt, immutable validation ledger, then the current cleanup ledger. The v2 validation receipt retains the email-configuration hash plus only hashes of the PaymentIntent, Charge, Refund, default PaymentMethod and idempotency keys and provider receipt digests; no raw provider ID or payment credential is retained.

Successful finalization creates `physio-live-self-service-final-receipt.json` and `SHA256SUMS`. Final `SHA256SUMS` line order is attempt receipt, initial ledger, runtime email-readiness receipt, registration Gmail/DKIM readback receipt, PASS provision receipt, email-configuration receipt, provisioned ledger, payment-validation receipt, payment-validation ledger, completed cleanup ledger, then final receipt. Finalization does not accept a standalone email-configuration input; it derives that hash from and revalidates it through the immutable v2 payment receipt.

Successful cleanup-only recovery creates `physio-live-self-service-resume-cleanup-receipt.json` and `RESUME-CLEANUP-SHA256SUMS`. The resume checksum order is the exact PASS-or-attempt receipt binding, its exact immutable provision-or-initial ledger binding, the completed cleanup ledger, then the resume receipt. The resume receipt separately records raw-file and canonical final-ledger hashes.

Playwright uses one desktop Chromium worker, zero retries, `forbidOnly`, and no trace, screenshot or video. The lane contains no skip/fixme, request interception, mock provider proof, placeholder result or silent fallback.
