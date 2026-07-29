<!--capability-notice
notice_id: 20260728-general-clinical-llm-restored
date: 2026-07-28
flags: GENERAL_CLINICAL_LLM_ENABLED
direction: restores
release: v16
surfaces_affected: 32
owner_acknowledgement: "Emergency global clinical-AI restoration authorised by Maxwell Vidler on 28 July 2026." (fly.production.toml:51-53)
expected_duration: Indefinite — this is the current production posture as at caf5f02.
capability-notice-->

# Legacy general clinical AI drafting restored in production (v16)

## User-visible effect

On 28 July 2026 (commit `2c2d4ff`, "Restore production clinical AI"),
`GENERAL_CLINICAL_LLM_ENABLED` was flipped back to `1` in
`fly.production.toml`. Every AI-assisted drafting surface the
21 July 2026 change disabled (see
`docs/deployment/notices/20260721-general-clinical-llm-disabled.md`)
returns to its normal behaviour: SOAP note assist, the report suite,
medication alerts, nutrition advice, assessment recommendations and
condition-based suggestions all resume calling the real (or, outside
production, mocked) provider instead of returning a 503. Treatment
Protocols' custom-condition generation UI was separately restored
(`+250/-19` lines) — a partial rebuild, not a byte-identical revert of the
569 lines the 21 July change removed.

## Surfaces affected

**32** `InvokeLLM(` call sites across 15 files, per
`docs/deployment/flag-manifest.json`'s
`GENERAL_CLINICAL_LLM_ENABLED.clientSurfaces` — the same reproducible
count as the disable notice, verified independently at `caf5f02`.

## Detection and monitoring

`server/tests/extraction-matrix.test.mjs`'s E37/E37a pair pins both
directions of this flag (503 when off, 200 mock when on) and is part of
`npm run test:assurance`. This item additionally adds
`server/tests/capability-flag-registry.test.mjs` (R00–R13) and
`server/tests/flag-impact-gate.test.mjs`, and the `npm run check:flag-impact`
gate described in `docs/deployment/notices/README.md` — none of that
existed on either 21 or 28 July 2026.

## Restoration criteria

**This restoration did not satisfy the original per-function
precondition.** The 21 July change's own stated intent was re-enablement
"until a separate function-level decision and release gate are
completed" — a decision, disclosure review and clinical gate per surface.
That per-function work was completed for exactly one surface: Treatment
Protocols' custom-condition path, which is the only surface with a
substantive code change (`+250/-19`) accompanying this restoration. The
other ten live surfaces were re-enabled by the single global flag flip,
with no individually recorded authority, disclosure or clinical review.
`fly.production.toml:51-53`'s comment records blanket owner authorisation
for the restoration itself ("Emergency global clinical-AI restoration
authorised by Maxwell Vidler on 28 July 2026") — that is real and
verifiable, and it is the only authorisation this notice can honestly
report. It is not the same thing as the original per-function
precondition being met, and this notice does not claim otherwise.
