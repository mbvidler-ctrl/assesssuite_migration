# Email deliverability launch runbook

Date: 2 August 2026  
Scope: AssessSuite transactional email through Resend  
Current visible sending domain: `assesssuite.com`  
Current Resend return-path domain: `send.assesssuite.com`

## Release decision

Transactional email is not launch-ready until every DNS check, Resend-side requirement, and inbox test below is complete. The DNS gate is read-only: it queries public DNS and never changes registrar or Resend configuration.

Run it from the repository root:

```powershell
npm run check:email-dns
```

The default organisational domain is `assesssuite.com`. To check another domain:

```powershell
npm run check:email-dns -- example.com
$env:EMAIL_DOMAIN = 'example.com'; npm run check:email-dns
```

The command exits `0` only when all four requirements pass:

1. `_dmarc.<domain>` has exactly one DMARC TXT record beginning `v=DMARC1`. Zero or multiple DMARC records block release.
2. `send.<domain>` has an SPF TXT record containing `include:amazonses.com`.
3. `send.<domain>` has at least one MX record.
4. `resend._domainkey.<domain>` has at least one TXT record.

DNS propagation is asynchronous. A failed result is a release block, not authority to edit DNS. Compare the public result with the exact records currently supplied by Resend before requesting any registrar change.

## Resend-side requirements

Before enabling real transactional sends:

- Add and verify the domain in Resend. A passing public-DNS gate does not prove that Resend has completed verification; the Resend dashboard must show the sending domain as verified.
- Turn off both open tracking and click tracking for transactional mail. Tracking can rewrite links or add remote pixels, which is inappropriate for OTP and password-reset messages and can degrade trust or deliverability.
- Keep verification traffic strictly transactional. The current configuration uses `assesssuite.com` in the visible From address and `send.assesssuite.com` as Resend's aligned return path. Do not send marketing or bulk traffic through this identity.
- As a planned reputation-isolation improvement, verify a dedicated visible auth subdomain such as `auth.assesssuite.com`, then move the From address to `verification@auth.assesssuite.com` only after its Resend SPF, DKIM, DMARC alignment and representative inbox placement have been proven. Do not confuse this future visible From domain with the existing `send.assesssuite.com` return path.
- Confirm the configured `From` address belongs to the verified sending domain and matches the production application's sender configuration.
- Confirm the production Resend account and API key belong to the intended AssessSuite environment. Do not print, copy into evidence, or commit the key.
- If Resend offers a 2048-bit DKIM rotation path for the current domain, rotate under a controlled overlap and prove the new selector passes before retiring the existing 1024-bit key.

## Inbox and raw-header tests

Send synthetic transactional tests only; do not use real patient or client data. Exercise at least initial verification, resend verification, password reset, and one administrative notification.

Deliver test messages to representative inboxes, including Gmail and Microsoft/Outlook where available. For every received message:

1. Save or inspect the raw message source, not just the rendered email.
2. Confirm `Authentication-Results` reports SPF pass, DKIM pass, and DMARC pass with aligned domains.
3. Confirm the visible `From`, envelope/return path, DKIM signing domain, links, subject, and intended recipient are correct.
4. Confirm no tracking redirect replaced application links and no tracking pixel was added.
5. Confirm the OTP or reset link works once, expires as designed, and does not disclose secrets in logs or screenshots.
6. Record provider, timestamp, message ID, authentication result, spam/inbox placement, and pass/fail outcome. Redact recipient addresses and tokens from retained evidence.

Do not infer deliverability from a Resend `sent` status. Launch requires actual inbox receipt and raw-header authentication evidence.

## Suppression and webhook monitoring

Before launch, nominate an operator and review cadence for the Resend dashboard and event stream:

- Review the suppression list before tests and after each test wave. Investigate bounced, complained, or suppressed recipients; never repeatedly send to a known hard bounce.
- Monitor Resend webhook events for at least delivered, bounced, complained, and failed outcomes. Authenticate webhook requests using Resend's current signing mechanism and keep the signing secret out of logs and repository files.
- Alert on sustained delivery failures, complaint events, webhook verification failures, or a sudden increase in suppressions.
- Reconcile application send attempts, Resend message IDs, webhook outcomes, and suppression entries without storing message bodies or authentication tokens in monitoring logs.
- Document the retry and escalation path. Retries must be bounded and must not bypass a provider suppression.

## Launch evidence checklist

- [ ] `npm run check:email-dns` passes against the intended domain.
- [ ] Resend dashboard shows the intended sending domain verified.
- [ ] Open tracking is off.
- [ ] Click tracking is off.
- [ ] `send.assesssuite.com` is the dedicated transactional sending target.
- [ ] Raw headers prove aligned SPF, DKIM, and DMARC passes in representative inboxes.
- [ ] OTP and password-reset journeys complete using synthetic accounts.
- [ ] Suppression-list ownership and review cadence are recorded.
- [ ] Authenticated Resend webhook monitoring is operational and tested.
- [ ] No secrets, tokens, message bodies, or real health information appear in retained evidence.
