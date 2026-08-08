# Capability notices

A capability notice is a short, dated record of a change that reduces,
restores or otherwise materially affects a production runtime capability
switch (see `server/capabilityFlags.mjs` and
`docs/deployment/capability-manifest.md`). It exists so a change like the
21 July 2026 `GENERAL_CLINICAL_LLM_ENABLED` shutdown — which ran for seven
days with no record naming an approver, a scope or a duration — cannot
recur silently. See `20260721-general-clinical-llm-disabled.md` in this
directory for that back-filled record and
`20260728-general-clinical-llm-restored.md` for its restoration.

## When a notice is required

Any pull request that trips a trigger in `scripts/check-flag-impact.mjs`
(a production or rollback value changing, a flag added or removed, a
client surface or server gate disappearing, or a raw edit to the flag's
value inside `fly.production.toml`, `fly.rollback.production.toml`,
`.env.example` or a workflow file) must be covered by a notice naming
every triggering flag. For a capability-reducing change specifically, the
covering notice must carry `direction: reduces` and a non-empty,
non-`TBC` `owner_acknowledgement` — the diff gate refuses to pass
otherwise. See `.github/pull_request_template.md`'s "Production capability
impact" section for the checklist a reviewer sees.

## Naming

`YYYYMMDD-<kebab-slug>.md`, where `YYYYMMDD` is the date the notice's
`date:` field records. `README.md` and `TEMPLATE.md` are the two names
excluded from parsing by exact filename; every other `.md` file in this
directory is a notice and is validated by `npm run flags:check` and
`npm run check:flag-impact`.

## Grammar

Copy `TEMPLATE.md`. Every notice opens with an HTML-comment fence so it
renders cleanly on GitHub while still being machine-parseable:

```
<!--capability-notice
notice_id: 20260721-general-clinical-llm-disabled
date: 2026-07-21
flags: GENERAL_CLINICAL_LLM_ENABLED
direction: reduces | restores | neutral
release: v14
surfaces_affected: 32
owner_acknowledgement: <verbatim authorisation and date, or NOT OBTAINED>
expected_duration: <text>
capability-notice-->
```

All eight keys above are required; unrecognised keys are permitted and
ignored, so the fence can carry extra context without breaking the parser.
Rules a notice must satisfy:

- The filename stem is exactly `notice_id`.
- `date` matches the `YYYYMMDD` filename prefix.
- Every name in `flags:` (comma-separated) resolves in
  `server/capabilityFlags.mjs`.
- When `direction: reduces`, `owner_acknowledgement` must be non-empty and
  must not be the literal string `TBC`. Where the true authorisation
  record is thin or absent, say so plainly (`NOT OBTAINED`, with a date and
  a note) rather than inventing one — an uncomfortable string in a
  reviewed file is the point.

The body must contain four headings, each with at least one non-empty
line beneath it: `## User-visible effect`, `## Surfaces affected`,
`## Detection and monitoring`, `## Restoration criteria`.

## Enforcement

`scripts/check-flag-impact.mjs` is runnable locally
(`npm run check:flag-impact`), is covered by
`server/tests/flag-impact-gate.test.mjs`, and runs on every pull request
from `.github/workflows/ci.yml` — a `pull_request`-triggered,
`contents: read`, secret-free workflow that also runs the build, the lint,
`npm run selftest`, `npm run test:assurance` and
`node scripts/flag-manifest.mjs check`. That workflow checks out with
`fetch-depth: 0` and diffs against
`github.event.pull_request.base.sha`, so the gate always has a resolvable
base ref; if no `docs/deployment/flag-manifest.json` exists at that base
(a pull request opened from before this item landed) the step says so and
skips rather than exiting 2.

It is **not** yet part of the production release corridor. A future PR may
add a release-corridor assert: a step named **`Capability notice gate`** in
`.github/workflows/production-prepare-release.yml`, immediately after the
existing `npm run test:assurance` step, running
`node scripts/check-flag-impact.mjs --base "$PRODUCTION_BASE_SHA"`.

That PR — not this one — must: (a) insert the step name into
`EXPECTED_PREPARE_STEPS` in `scripts/validate-production-deploy-workflow.mjs`
at the matching ordinal position; (b) add a `requireStepText(...)` assertion
pinning the exact `run:` line, near the existing gate assertions;
(c) add a `--selftest` negative mutation proving the validator rejects a
workflow with the step removed; (d) recompute the validator digest with
`node scripts/validate-production-deploy-workflow.mjs --print-self-sha`
and re-pin `EXPECTED_TRUSTED_VALIDATOR_SHA256` in the four active workflow
consumers per the established re-pinning procedure; and (e) preserve
`production-prepare-rollback-image.yml` as the exact fail-closed tombstone.
The retired tombstone has no `PRODUCTION_BASE_SHA`, validator pin, credential,
build or deployment path. The active prepare-release workflow owns both
exact-live baseline pins used by its differential typecheck and release-diff
gates.

Splitting the work this way is deliberate: the registry, the generated
artefacts and the gate itself land now at near-zero risk to the release
corridor; mandatory enforcement remains a separately reviewed corridor
change.
