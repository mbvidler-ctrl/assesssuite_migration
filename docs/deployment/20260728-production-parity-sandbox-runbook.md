# Production-Parity Sandbox — Runbook (28 July 2026)

## What this is

The `unimatter-demo` Fly app is the containerised secure sandbox for
AssessSuite: a clone of the live production **application** (same repository,
same Dockerfile, same image build) whose **data** is entirely synthetic. It
exists so that demonstrations, training, UAT, and exploratory testing can run
against something that behaves exactly like production without any real user
or patient data being present, ever.

## Data provenance decision (the important part)

**No production data is used, copied, scrubbed, transformed, or referenced —
not even transiently.** The sandbox dataset is synthesised purely from the
captured entity schemas (`base44/entities/*.jsonc`,
`docs/source-capture/20260702-live-entity-schemas.json`,
`server/local-entity-schemas.json`) by `server/seed.mjs`.

This is deliberate. The alternative ("clone production, then delete the
users/patients") would put real allied-health data — health information under
the Australian Privacy Act — through the sandbox build pipeline, and deletion
from SQLite (free pages, WAL segments, uploads) is hard to prove. Schema-only
synthesis makes the privacy question moot: there is nothing to remove because
nothing real ever arrives. The only production-derived content in the seed is
the de-identified reference catalogue import under `server/data-import/`
(content-only, authorised per mission UM-AUTO-20260707 Amendment 3, verified
free of any email-like or personal string).

## Synthetic dataset

`server/seed.mjs` (idempotent; shared with local dev and smoke tests) seeds:

- 2 organisations, 4 clinicians (owner + clinician per org), 1 bootstrap
  admin — all on reserved `.test` email domains, passwords documented in
  `scripts/seed-credentials.md`.
- 7 clients (including one deliberate near-duplicate pair for duplicate-
  detection testing), each with conditions, appointments, payments,
  completed assessments (including a full DASS-21 built by the real scoring
  library), SOAP notes, reports, an onboarding episode, and a referral
  document record.
- Nutrition plans and adverse-event reports on a subset of clients,
  clinic consent policies and assessment requests per organisation, legal
  acceptance events derived from the real legal-content registry, and the
  full assessment/exercise/treatment-protocol catalogues.

Every seeded identity uses reserved synthetic markers: `.test` / `.example`
email domains, a `_seed_key` on every Client, and `seed://` URLs for
document records.

## Boot sequence (every boot, every deploy)

`fly.toml` overrides the image CMD with:

```
node server/sandboxBootstrap.mjs && exec node server/index.mjs
```

1. **Guard checks** (fail-closed, before any file is touched): requires
   `SANDBOX_MODE=1`; refuses the production Fly app by name; refuses the
   parity-assurance lane, SELFTEST, and any database-path override; requires
   outbound email/SMS/payments off and open registration off.
2. **Wipe** the ephemeral SQLite store (plus WAL/SHM/journal). No volume is
   mounted on this app, so nothing survives a redeploy anyway; the wipe also
   resets plain restarts. The sandbox is self-healing — anything done in it
   is discarded on the next boot.
3. **Reseed** the full synthetic dataset.
4. **Provenance gate** (`scripts/sandbox-data-provenance-gate.mjs`): every
   record must trace to the seed manifest — manifest users/orgs only, every
   Client provably synthetic, every email-like string anywhere on a reserved
   synthetic suffix, referential containment to seeded orgs/clients, and an
   empty sessions/outbox/upload baseline. Any violation aborts startup.

"The sandbox holds no real data" is therefore not a claim; it is a startup
invariant, re-proven mechanically on every boot.

## Why production cannot run this lane

Defence in depth, any one of which is sufficient:

- The production Fly config (`fly.production.toml`) boots
  `productionBootstrap.mjs`, which seeds only reference catalogues; the
  release workflows reject any Dockerfile that references the seeder.
- `SANDBOX_MODE` is not set on production, and the sandbox bootstrap
  requires it exactly.
- Even with both wrong, the bootstrap and the seeder both refuse when
  `FLY_APP_NAME` is `assesssuite-production`.
- `server/tests/sandbox-bootstrap.test.mjs` (in `npm run test:assurance`)
  pins all of the above, including that `fly.production.toml` never
  references the sandbox lane.

## Egress posture

`fly.toml` pins `OUTBOUND_EMAIL_ENABLED=0`, `OUTBOUND_SMS_ENABLED=0`,
`PAYMENTS_ENABLED=0`, `TRANSCRIPTION_ENABLED=0`,
`GENERAL_CLINICAL_LLM_ENABLED=0`, `DOCUMENT_EXTRACTION_ENABLED=0`, and
`ALLOW_OPEN_REGISTRATION=0`; the bootstrap re-asserts the critical ones.
Synthetic records can never email, message, or bill anything real.

**Secrets:** keep provider secrets **unset** on this app. All integrations
fall back to their deterministic mocks. In particular, if `OPENAI_API_KEY`
is still set on `unimatter-demo` from earlier testing, remove it:
`fly secrets unset OPENAI_API_KEY -a unimatter-demo`. A strong
`ADMIN_PASSWORD` secret is still recommended (the repo default is public).

## Operating the sandbox

- Deploy: `fly deploy --config fly.toml` (this app is outside the
  production-only immutable deploy corridor, which remains the sole path
  for `assesssuite-production`).
- Reset the sandbox remotely: restart the machine (`fly machine restart`) —
  the boot sequence wipes and reseeds.
- Audit a live sandbox: `npm run sandbox:gate -- --allow-runtime-rows`
  (session rows from logins are expected post-boot; note that records
  created *through the UI during a sandbox session* will be reported, which
  is correct — they are not seed-traceable and will be wiped at next boot).
- Local dry-run of the exact boot sequence:
  `SANDBOX_MODE=1 npm run sandbox:bootstrap && npm run server`.
- Credentials for demonstration logins: `scripts/seed-credentials.md`.
- Topology: one machine only, same as production (SQLite would split across
  machines).
