# Operator deploy checklist — v16 clinical-AI remediation

**Prepared for:** Maxwell Vidler (Principal Solutions Architect and Technical Lead, AssessSuite Engagement)
**Branch:** `claude/v16-patch-clinical-ai-review-g36phy` → PR #21
**Status:** verification-complete; awaiting your review and merge. **No production change has been made by this work.**

This checklist is the only path from the review branch to production. Every step runs under your GitHub account through the guarded corridor; the automated session has no Fly access by design. Do the steps in order.

## 0. Preconditions
- [ ] PR #21 CI is green (it is, on the current head).
- [ ] You have read the incident report, the v16 patch review, and the model-attribution memo (`docs/qa/20260728-*`).
- [ ] You accept the documented residuals in the incident report §8 status table (the "Residual" rows) as out-of-scope for this release.

## 1. Merge
- [ ] Mark PR #21 ready for review (undraft) and merge to `main`. The merge itself deploys nothing.

## 2. Record current production state (read-only)
The corridor pre-binds the release it is deploying *from*, so drift is impossible. Capture it immediately before deploying.
- [ ] Run the **`production-state-snapshot`** workflow (confirmation phrase `SNAPSHOT assesssuite-production READ ONLY`). Record from its output: current `release`, `image` digest, sole `machine_id`, sole `volume_id`.
- [ ] These four values are inputs to the deploy workflow's `expected_current_*` fields.

## 3. Prepare the release
- [ ] Run **`production-prepare-release`** from the merged `main` SHA. It builds the candidate and rollback images and emits the sealed evidence bundle.
- [ ] The clinical-AI posture is unchanged from live v16 (`GENERAL_CLINICAL_LLM_ENABLED="1"`, `LLM_REQUIRED="1"`); the rollback image remains fail-closed (`="0"`). No `extraction_runtime_mode`/attestation inputs change.
- [ ] **Instantiate the release-evidence document** (`docs/deployment/20260719-release-evidence-template.md`) for this release — this is now expected practice, not optional. Fill the prior/candidate release rows from step 2.

## 4. Deploy
- [ ] Run **`production-deploy`** with the prepared bundle digest and the four `expected_current_*` values from step 2. The workflow re-verifies actor, ref, exact SHA, image/config digests, and machine/volume identity before mutating anything, and rolls back automatically if the post-deploy public-surface checks fail.
- [ ] After it completes, confirm `/api/version` on the production host reports the new release.

## 5. Post-deploy verification (do not skip — this is the detection gap the incident was about)
- [ ] Sign in as a real, activated clinician and confirm each AI surface responds: SOAP AI Help (Assessment + Plan), a treatment-protocol generation, medication alerts, a report-wizard section, nutrition advice. Any 503 here means the posture did not take — roll back.
- [ ] Confirm an AI-drafted protocol imported to a SOAP note now carries the `[AI-ASSISTED CONTENT — REQUIRES CLINICIAN REVIEW]` label and its contraindications.
- [ ] Confirm a published SOAP note refuses a non-amendment edit (the immutability guard).

## 6. Rollback (if needed)
- [ ] Run **`production-rollback`** to the prepared rollback image digest. Note: the rollback image deliberately disables the general clinical LLM and document extraction (test R00 pins this) — a rollback returns the app to the fail-closed posture, so tell clinicians AI features will be unavailable until a forward fix. This is the reviewed trade-off, recorded in the runbook.

## After go-live — the limited-manual-input items (each short of a code authorisation)
- [ ] **Error telemetry** — create a free Sentry project and set `SENTRY_DSN` (see `docs/deployment/20260729-error-telemetry-plan.md`); or, zero-account, add the Fly Grafana 5xx alert (Layer 2). Either ends the "silent for seven days" failure mode.
- [ ] **Posture-drift Routine** — already armed (daily, to mb.vidler@gmail.com). It emails you only on a config-flag change. Adjust cadence/recipient if you want.
- [ ] **Sandbox lane** — to exercise AI-enabled behaviour on synthetic data, authorise applying `docs/deployment/sandbox/20260729-sandbox-clinical-llm-lane.patch` to a dedicated branch and deploying `unimatter-demo` (unset `OPENAI_API_KEY` on that app first — the new guard makes a stale key a boot failure by design).
- [ ] **Governance follow-ups** (incident report §8 "Residual"): the per-function clinical gates (WP6.1), the `PDFFormFiller` orphan decision (WP6.2), and the merge-blocking release-evidence gate (G5) remain open and need a product/engineering decision.
