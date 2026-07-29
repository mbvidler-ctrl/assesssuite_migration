## Summary

<!-- What does this change do, and why? -->

## Production capability impact

<!-- Paste the output of: npm run check:flag-impact -->

- [ ] This change does **not** add, remove, or alter any runtime capability switch.
- [ ] This change **does** alter production capability. If ticked, all of the following are true:
  - [ ] `server/capabilityFlags.mjs` is updated (the registry is the source of truth).
  - [ ] `docs/deployment/flag-manifest.json` and `docs/deployment/capability-manifest.md`
        are regenerated (`npm run flags:write`).
  - [ ] A notice exists under `docs/deployment/notices/` naming the flag.
  - [ ] `npm run flags:check` and `npm run check:flag-impact` pass locally.

| Capability | Switch | Before | After | Surfaces affected | What the clinic loses |
|---|---|---|---|---|---|

**Notice:** <path, or "n/a">

## Verification

<!-- Commands run and their actual output — npm run selftest, npm run test:assurance, npm run lint, npm run typecheck, etc. -->

## Rollback

<!-- What reverts this change, and what (if anything) it changes about the rollback configuration. -->
