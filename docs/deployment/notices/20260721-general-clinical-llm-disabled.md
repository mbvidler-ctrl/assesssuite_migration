<!--capability-notice
notice_id: 20260721-general-clinical-llm-disabled
date: 2026-07-21
flags: GENERAL_CLINICAL_LLM_ENABLED
direction: reduces
release: v14
surfaces_affected: 32
owner_acknowledgement: NOT OBTAINED AT THE TIME — reconstructed retrospectively on 28 July 2026.
expected_duration: Until a separate, per-function authority/disclosure/clinical-gate decision is made for each surface.
capability-notice-->

# Legacy general clinical AI drafting disabled in production (v14)

This notice is a retrospective reconstruction. No dedicated notice
artefact existed for the change it describes; this record was written on
28 July 2026, seven days after the fact, from `git log` and the tree at
`e67792b` and `caf5f02`. Where the authorisation record is thin, this
notice says so plainly rather than inventing one.

## User-visible effect

On or after 21 July 2026 (commit `e67792b`, deployed via the "Intervening
Order" exact-main corridor `6a8ec8d`, exact deploy time unrecorded), every
AI-assisted drafting action in the product outside the referral-extraction
path began returning a server error. The AI-disclosure banners that
`e67792b` added to these same surfaces remained on screen the whole time,
so the product continued to advertise AI assistance it would not deliver.
The failure was a generic server error, not a "this feature is
temporarily unavailable" message, and nothing in the product told a
clinician the feature had been withdrawn or for how long.

One surface behaved worse than the rest: Dissect-to-SOAP
(`server/functions/transcribeSession.mjs`) bypasses both this flag and
`LLM_REQUIRED`, so on any provider failure it silently returned a
placeholder SOAP note with `success: true` and no label distinguishing it
from a real transcription. That path was never governed by this flag and
is not fixed by this notice; it has since been made fail-closed under
`LLM_REQUIRED=1` and any mock it may still serve is explicitly labelled
`simulated: true` — see the caveat on `TRANSCRIPTION_ENABLED` in
`server/capabilityFlags.mjs`. It is recorded here because, during the
21-28 July window described above, a clinician could have received
fabricated clinical structure while every neighbouring feature was loudly
failing.

## Surfaces affected

The reproducible figure at `caf5f02` is **32 `InvokeLLM(` call sites
across 15 files** — see `docs/deployment/flag-manifest.json`'s
`GENERAL_CLINICAL_LLM_ENABLED.clientSurfaces`. The eleven live,
user-reachable surfaces (per Phase A's incident reconstruction) were:
Treatment Protocols (custom-condition generation, with 569 lines of the
generation UI itself deleted in the same commit); SOAP note Assessment/
Plan drafting assist; Dissect-to-SOAP (see above — not actually gated,
included here for completeness); Medication safety alerts; Assessment
recommendations; condition-based assessment suggestions (Client
Conditions); the report wizard's per-section Generate/Regenerate/Tidy and
the compiled preview; Nutrition plan advice; Assessment audit; and the
report-component family (GP Summary, DVA Patient Care Plan, Form 32,
Custom Report Generator, Private Health initial/progress). The PDF Form
Filler tree (2 call sites) is separately recorded as orphaned/unreachable
legacy code, not a live surface.

## Detection and monitoring

None of the automated lanes in this repository were capable of observing
this outage, for four independent reasons:

1. The self-test carve-out (`SELFTEST==='1' && GENERAL_CLINICAL_LLM_ENABLED
   === undefined`) is exactly the one combination production never has;
   `npm run selftest` stayed green throughout.
2. `scripts/smoke.mjs`'s default lane also sets `SELFTEST=1`; its separate
   "production gates" lane exists but is never invoked anywhere in this
   repository.
3. The release-gate lane (`production-prepare-release.yml`) starts its
   server with `LLM_REQUIRED=0` and no clinical flag set — the opposite
   posture from production on the one dimension that mattered.
4. The hidden same-app parity-assurance lane is constitutionally pinned to
   `GENERAL_CLINICAL_LLM_ENABLED=0` (`server/productionBootstrap.mjs`'s
   parity `required` map), so it can never observe the production posture
   on this flag by construction.

No test anywhere renders or drives Treatment Protocols, Medication Alerts,
Assessment Recommendations, SOAP assist, Nutrition advice or the report
wizard against the actual production flag posture. This was not
recognised by any automated gate; it was only recognised on 28 July when a
human decided to restore the flag.

## Restoration criteria

`fly.production.toml`'s own comment at the time of this change stated the
intent as scoping, not withdrawal: "Legacy general clinical generation
remains server-disabled until a separate function-level decision and
release gate are completed." No such per-function decision, disclosure or
clinical gate review is recorded for any of the eleven surfaces between
21 and 28 July 2026. See
`docs/deployment/notices/20260728-general-clinical-llm-restored.md` for
what actually happened instead.
