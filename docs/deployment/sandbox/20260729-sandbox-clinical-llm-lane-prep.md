# Sandbox lane prep — clinical-AI-enabled synthetic sandbox (SANDBOX.patch)

Prepared 29 July 2026 in a detached worktree at `/home/user/wt-sandbox`
(base `caf5f02`, cherry-picked from `a6bc8f3` / PR #14's sandbox commit,
plus the flag=1 review amendments below). No branch was pushed and nothing
was committed — this is a reviewable patch only.

## What the patch contains

Base cherry-pick (`a6bc8f3`, applied clean via `--no-commit`, both
`package.json` and `server/tests/run-assurance.mjs` auto-merged with no
manual conflict resolution needed):

- `server/sandboxBootstrap.mjs` (new) — fail-closed boot sequence for the
  `unimatter-demo` Fly app: wipe the ephemeral database, reseed the
  synthetic dataset, run the provenance gate, refuse to start on any
  violation.
- `scripts/sandbox-data-provenance-gate.mjs` (new) — proves every record in
  the sandbox database traces to the seed manifest.
- `server/tests/sandbox-bootstrap.test.mjs` (new) — guard-refusal, fly
  config, and end-to-end bootstrap/provenance tests.
- `server/seed.mjs`, `server/db.mjs`, `fly.toml`, `.env.example`,
  `package.json`, `server/tests/run-assurance.mjs`, and the new runbook —
  supporting wiring (seed additions, `SANDBOX_MODE` documentation, the
  `sandbox:bootstrap` / `sandbox:gate` / `test:sandbox-bootstrap` npm
  scripts, and `docs/deployment/20260728-production-parity-sandbox-runbook.md`).

Flag=1 amendments applied on top (this session, per the reviewed plan):

1. **`fly.toml`** — `GENERAL_CLINICAL_LLM_ENABLED` set to `"1"` (was `"0"`);
   `LLM_REQUIRED` confirmed absent/unset; header comment rewritten to
   describe the flag=1-with-deterministic-mock posture (clinical-AI
   surfaces behave as production does, but only the deterministic mock ever
   answers, because provider secrets are guarded off this app).
2. **`server/sandboxBootstrap.mjs`** — `assertSandboxBootstrapEnvironment`
   gained a new fail-closed guard (documented as guard 8): refuses to boot
   if `OPENAI_API_KEY`, `RESEND_API_KEY`, or `STRIPE_SECRET_KEY` is set,
   naming the offending variable in the thrown error.
3. **`server/tests/sandbox-bootstrap.test.mjs`** — three new refusal cases
   (one per secret) in the existing guard table, plus two new fly-config
   assertions pinning `GENERAL_CLINICAL_LLM_ENABLED = "1"` and the absence
   of any `LLM_REQUIRED =` line in `fly.toml`.
4. **`server/db.mjs` / `server/sandboxBootstrap.mjs`** — fixed the
   wipe/open environment mismatch: `openDatabase()` now accepts an optional
   `environment` parameter (defaulting to `process.env`, so every existing
   no-arg caller is unaffected), and `runSandboxBootstrap` now calls
   `openDatabaseFn(environment)` with the same `environment` object it
   already threads into `wipeFn(environment)`, so wipe and open can never
   target different environments.
5. **`docs/deployment/20260728-production-parity-sandbox-runbook.md`** —
   "Egress posture" section rewritten for the new posture: explains why
   `GENERAL_CLINICAL_LLM_ENABLED=1` is deliberate and safe only in
   combination with the absent `LLM_REQUIRED` and the new provider-secret
   guard, and adds the operator note below.

## Two operator steps required before the first deploy of this posture

1. **Unset provider secrets on the `unimatter-demo` app** (the guard makes a
   stale key a hard boot failure by design — this is not optional):
   ```
   fly secrets unset OPENAI_API_KEY -a unimatter-demo
   ```
   Repeat for `RESEND_API_KEY` and `STRIPE_SECRET_KEY` if either was ever
   set on this app, then confirm none of the three appears in
   `fly secrets list -a unimatter-demo`.
2. **Set a strong `ADMIN_PASSWORD` secret** on the app — the repository
   default is public and must not be relied on for a deployed instance.

## Deploy command (once the two steps above are done)

```
fly deploy --config fly.toml
```

(Sandbox topology only — single always-on machine in `syd`; this app sits
outside the production-only immutable deploy corridor, which remains the
sole path for `assesssuite-production`.)

## Verification run in this session (no network, no `fly`)

- `npm run test:sandbox-bootstrap` — 5/5 pass, including the three new
  provider-secret refusal cases and the two new fly-config pins.
- `node --test server/tests/sandbox-bootstrap.test.mjs` — 5/5 pass
  (identical run, direct invocation as required by the brief).
- `npm run selftest` — 123/123 passed.
- `node --test server/tests/production-startup.test.mjs` — 6/6 pass (sanity
  check that the `openDatabase()` signature widening did not regress the
  existing override-policy tests).
- `git apply --check --cached SANDBOX.patch` against the same worktree —
  applies cleanly.

## Authorisation

This patch and runbook update are prepared for review only. Applying this
to a pushed branch or PR, or running `fly deploy` against `unimatter-demo`,
awaits explicit authorisation from the lead session / user — nothing here
has been pushed, committed against the shared history, or deployed.
