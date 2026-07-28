# Agent admin provisioning runbook — `dev.agent@unimatter.com.au`

**Status:** ready. Tooling verified end-to-end in an isolated harness
(`node scripts/provision-agent-admin.selftest.mjs`, 16/16 pass). Step B below is
operator-run against production and requires human authorization.

## Purpose & scope
Provision **one** dedicated, attributable admin service identity —
`dev.agent@unimatter.com.au` — so an automation/agent can access production
without a paid subscription (`role: 'admin'` bypasses the Stripe gate by design).

This is the first step only. The other requested subagent accounts
(`dev.subagent.1..20`) are **out of scope here** and should be provisioned
separately — preferably as payment-exempt `role: 'user'` accounts, or with
per-agent tokens, rather than 20 shared superusers, to preserve attribution over
patient (PHI) data.

## Why this path
- Production already has exactly one admin (`admin@assesssuite.com`), and
  `bootstrapAdmin()` (`server/index.mjs:166`) early-returns once any admin exists.
  So a second admin **must** be minted via the admin-only `invite-user` endpoint
  (`server/index.mjs:1912`) using an existing admin's bearer token.
- `dev.agent@unimatter.com.au` can receive email, so it completes the normal
  **reset-password** flow (`server/index.mjs:1875`), which sets `email_verified:true`.
  Nothing is bypassed; no direct DB writes; no `fly ssh` (the go-live runbook
  retires ad-hoc prod shell/secret/deploy commands).
- The login `access_token` is a persisted, non-expiring session token
  (`server/db.mjs:402`) — reusable by the agent, revoked only by logout or
  deleting the `sessions` row.

## What is NOT done here
No sharing of a personal identity's token, no email-verification bypass, no
direct database/`fly ssh` writes, and no auto-push of the live change — a human
authorizes step B.

## A. Verify in isolation (no production, no PHI)
```
node scripts/provision-agent-admin.selftest.mjs
```
Boots a throwaway `NODE_ENV=test` server on an isolated temp `.db`, runs the real
`scripts/provision-agent-admin.mjs`, drives invite → reset → login, and asserts the
account is a working admin, could not log in before its password was set, and that
re-running creates no duplicate. Expect `16 passed, 0 failed`.

## B. Apply to live production (operator-run, human-authorized)
Prerequisite: you (the operator) hold the production `ADMIN_PASSWORD` (a Fly
secret). Set `BASE_URL` to the production host.

1. **Get an existing-admin bearer token** (do not commit it; keep it in the shell env):
   ```
   curl -s -X POST "$BASE_URL/api/apps/local-assesssuite/auth/login" \
     -H 'Content-Type: application/json' -H 'X-App-Id: local-assesssuite' \
     -d '{"email":"admin@assesssuite.com","password":"<ADMIN_PASSWORD>"}'
   # copy access_token -> export ADMIN_TOKEN=...
   ```
2. **Provision dev.agent as admin** (idempotent; supports `DRY_RUN=1` to preview):
   ```
   BASE_URL="$BASE_URL" ADMIN_TOKEN="$ADMIN_TOKEN" \
   TARGET_EMAIL=dev.agent@unimatter.com.au ROLE=admin \
   node scripts/provision-agent-admin.mjs
   ```
3. **Set the password via the emailed reset link** (proves mailbox control):
   ```
   curl -s -X POST "$BASE_URL/api/apps/local-assesssuite/auth/reset-password-request" \
     -H 'Content-Type: application/json' -H 'X-App-Id: local-assesssuite' \
     -d '{"email":"dev.agent@unimatter.com.au"}'
   ```
   Open the link in the delivered email (`/reset-password?token=...`) and set a
   strong password. This sets `email_verified:true`.
4. **Mint the agent token**:
   ```
   curl -s -X POST "$BASE_URL/api/apps/local-assesssuite/auth/login" \
     -H 'Content-Type: application/json' -H 'X-App-Id: local-assesssuite' \
     -d '{"email":"dev.agent@unimatter.com.au","password":"<the password>"}'
   # store access_token as a secret; the agent sends it as: Authorization: Bearer <token>
   ```

## Verification after B
- `dev.agent` logs in; its token returns 200 on `GET /api/apps/local-assesssuite/entities/User`.
- `admin@assesssuite.com` remains the only other admin; no other accounts changed.

## Rotation / revocation
- Rotate the agent token: `GET /api/apps/auth/logout` with the token (invalidates it),
  then log in again for a fresh one; or change the password.
- Emergency revoke: delete the account's row from the `sessions` table, or set its
  `role` back to `user` / suspend it via the admin surface.
- The token is long-lived and grants full platform + PHI access — store it only as a
  managed secret and rotate on any suspected exposure.
