# UAT Remediation Session Note — 11–12 July 2026

Branch: `mission/20260711-uat-remediation` (base `209d893`). Mission order UM-AUTO-20260711-ASSESSSUITE-UAT-REMEDIATION.

Trigger: Brenton Primmer's "Saturday APP fixes" email, 11 July 2026 — first full external clinician onboarding walkthrough.

## What changed (10 commits, bd8b606 … ca43a86)

Defects D1–D9 from Brenton's email, all reproduced and fixed:

- **D1** scroll-to-top: `currentStep`-keyed `window.scrollTo` effect in `Onboarding.jsx`.
- **D2** duplicate clients: handlers branched on the stale `useSearchParams` `clientId` (never updated after `history.replaceState`); now branch on `clientIdRef.current`, retain id after create, in-flight lock on silent auto-saves.
- **D3** lost medical history: retained-id fix + `saveConditions` now runs on the client-view path before its early return; `pain_level` 0 preserved.
- **D4** UTC episode date: new `src/lib/localDate.js` (`todayLocal`/`parseDateOnlyLocal`); generalised to 321 UTC date-only derivations across ~293 files + 15 full-ISO `assessment_date` emitters.
- **D5** med-considerations density: collapsed summary + accordion + maximise dialog.
- **D6** false failure toast: runners pass `updateData` through `onComplete`; `handleAssessmentSave` short-circuits on empty payload; deep-link `/TestRunner` no longer double-updates.
- **D7** 1MSTS result lost: host wiring read camelCase keys + no submit branch; fixed wiring + guarded `isOneMinuteSitToStand` branch.
- **D8** AE signature not rehydrated: canvas ref-callback draws stored data URL at mount, `dataset.hydrated` guard.
- **D9** nutrition print pagination: house A4 print CSS with atomic blocks.

Brand/terminology: "Allied Assess"/"Assess Suite" → **AssessSuite** (18 user-facing sites); "APSS Stage 1/2" → **Safety Screen / Clinical Risk Review** (37 user-facing sites). Legal-entity "Assess Suite Pty Ltd", stored data keys, `apss_*` fields, and instrument citations deliberately unchanged. Legal-acceptance `document_set_version` 2.0.0 → 2.1.0 (Layout + modal in lockstep; users re-accept once).

Library audit (Brenton's "AI trawl"): 329 runners; static contract sweep + 60-agent deep verification. 26 runners/pathways confirmed defective (same D7 class — host reading legacy keys, fragment wirings losing the score, missing submit branches, unguarded null derefs, a second UTC-date family), all fixed across two rounds. Standalone wrappers (6-Metre Walk, 8-Foot Up-and-Go, 6-Minute Step) now update the launched pending record instead of creating a duplicate.

## Persistence contract (audit baseline, documented at the D7 fix site)

A completed assessment must reach the ClientAssessment record with: (1) `result_value` a finite number (NaN→null trips the viewer's "Please enter a result value"); (2) `additional_data` with `measurement_type` and ideally `soap_text`; (3) `notes`; (4) a local `assessment_date`; (5) `status: 'completed'`. Three hops (runner payload → host wiring → `handleSubmit` branch) must agree on snake_case keys; a detector rendered but not handled falls to the generic else and loses the result.

## Verification

selftest 98/98, smoke 10/10, gate 13/13, `vite build` clean. End-to-end journeys driven in-browser: full long-form onboarding (single client, history persisted, episode dated correctly, new labels live), 1MSTS completion (correct persistence + SOAP, no false toast), AE signature reopen, onboarding report read-back.

Fresh-context adversarial refutation over the diff (Sonnet lanes) found **four real regressions — two HIGH — all fixed in `3554f79`**: (1) the onboarding in-flight lock only covered silent autosaves, so a slow-connection race could still duplicate a client — fixed with a shared serialized-create promise (`clientCreationRef`/`awaitInFlightCreate`), re-verified in-browser (one client per onboarding); (2) the Berg branch's bare `&& bergData` short-circuit could write a NaN result as 'completed' (Berg has no manual field) — fixed with guard-and-return; (3) `onComplete(updateData)` caused a redundant second PUT + double toast per Client-Profile completion — reverted to no-payload `onComplete()` (the falsy guard already fixes D6); (4) ROM SOAP summary resolved through `rom_data` but not `rom_data.additional_data.soap_text` — fixed.

## Reusable lessons

- Fix-and-confirm and data-level audits miss false-negative UI-state defects and morning-only UTC bugs; a full human journey is the only pass that catches them.
- The 1MSTS defect was a *class*, not a one-off: 26 runners shared it. When a persistence bug appears in one runner, audit the whole library against the contract before assuming it is isolated.
- `history.replaceState` does not update React Router's `useSearchParams`; a ref is the reliable id carrier across a create-then-update flow.
