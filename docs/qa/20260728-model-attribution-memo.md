# Model attribution and counterfactual — the clinical-AI kill switch — 28 July 2026

**Prepared at the owner's explicit request.**
**Subject:** the `GENERAL_CLINICAL_LLM_ENABLED = "0"` posture introduced at `e67792b` (21 July 2026) and reversed at `2c2d4ff` (28 July 2026).
**Method:** every git-record claim below was re-derived directly from the repository — `git log --format=%B` over the squash bodies, `git show` over the commits and their trees, and `git ls-remote` where a shallow-clone artefact was possible. Where the source analysis and the record disagree, the record is stated and the discrepancy is noted.
**Companion document:** `docs/qa/20260728-v16-patch-review.md` (technical review of the restoration patch).

---

## 1. Question

Two questions were asked, and they are separable:

1. **Which model authored the kill switch** that took the platform's clinical-AI surfaces dark for seven days?
2. **Would a different model have prevented the outage?**

The first is a question of record. The second is a counterfactual, and the honest answer to it turns out not to be about models at all.

---

## 2. Attribution findings

### 2.1 The three trailer bands in `e67792b`

`e67792b` ("Urgent: recover referral extraction and consent release (#6)", merged 21 July 2026 16:16 AEST) is a squash of roughly fifty sub-commits. Its body carries 21 `Co-Authored-By` lines, in three distinct bands:

| Band | Count | Trailer |
|---|---|---|
| Launch-hardening waves W0–W7, Waves 1–3, adversarial-QA fixes | 15 | `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` |
| OTP-bypass fix; legal-status-flip record | 2 | `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` |
| Policy-suite integration; the AI-disclosure commit; Option B consent | 3 | `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` |

A twenty-first trailer — `Co-authored-by: Claude Opus 4.8`, in the lower-case form GitHub emits — sits at the very end of the body, after the `---------` separator. That is the squash trailer, not a sub-commit trailer.

### 2.2 The final untrailered run closes under the sole Opus 4.8 squash trailer

The last individually trailered section ends at body line 339. Everything after it — **22 sub-commit headings**, carrying no individual trailers of any kind — closes under that single terminal `Co-authored-by: Claude Opus 4.8` line. That run contains every component of the kill switch:

- `feat(referrals): secure tenant-aware document extraction`
- `test(assurance): cover extraction signup and rollback contracts` — which added E37, `server/tests/extraction-matrix.test.mjs:1836-1846`, the test named "general clinical InvokeLLM **remains disabled** outside the referral adapter"
- `ci(release): add exact-sha deploy and rollback workflows`
- the `fly.production.toml` `GENERAL_CLINICAL_LLM_ENABLED = "0"` block with its three-line rationale comment
- the `InvokeLLM` 503 gate at `server/integrations.mjs:668-675`
- the `src/pages/TreatmentProtocols.jsx` reduction (−569/+143)

Corroboration: the four release-corridor pull requests that followed — `dd9b6ab` (#7), `cf0a816` (#8), `f27eaa5` (#9) and `6a8ec8d` (#10, the "Intervening Order" that deployed v14) — are cumulative re-squashes of the same branch. Each carries forward the earlier per-commit trailers verbatim and appends its own new sub-commit headings bare, closing under the same single terminal `Co-authored-by: Claude Opus 4.8` trailer.

**Conclusion on attribution.** On the record, the kill-switch decision was authored in the Claude Opus 4.8 release-corridor session or sessions of 19–21 July. Attribution is squash-level rather than per-component — the branch was squashed, so per-component proof is not recoverable from this repository — but no evidence points to any other model for any kill-switch component.

*Note on a source figure.* The underlying analysis described this run as "~15" sub-commits; the verified count is 22. The substance is unchanged.

### 2.3 Two attribution gaps

**Gap A — the earliest artefact of the decision is model-unattributed.** `c32dd15` ("ci: bootstrap verified production workflows", 20 July 2026 05:19 AEST, author `mbvidler-ctrl <mb.vidler@gmail.com>`) carries **no `Co-Authored-By` trailer at all**. It is workflow-only ("No application code" — its own body) and creates `.github/workflows/production-deploy.yml`, which as committed asserts `GENERAL_CLINICAL_LLM_ENABLED = "0"` at `:182` and `:500` and refuses an opaque Fly-secret override of that variable at `:844-845`.

Verified: at `c32dd15` the flag existed in **neither** `fly.production.toml` nor `server/integrations.mjs` — `git show c32dd15:` returns zero occurrences in both. It first appears in application code at `e67792b`, roughly thirty-five hours later. The kill-switch posture was therefore first written down as a CI assertion, in a commit with no model attribution whatsoever, a day and a half before the switch itself existed.

(For completeness: those assertions have since moved. `production-deploy.yml` no longer references the flag; the `="0"` assertions now live in the two rollback lanes — `production-prepare-rollback-image.yml:180` and `production-rollback.yml:192` — and the opaque-override refusal now lives in `scripts/check-production-secrets.mjs:35-39`, enforced at `:66`. The design persisted; only its location changed.)

**Gap B — the restoration is model-unrecorded.** All four v16 pull requests — `2c2d4ff` (#17), `7577256` (#18), `883daff` (#19), `caf5f02` (#20), on branch `claude/v16-patch-clinical-ai-review-g36phy` — carry **zero** `Co-Authored-By` trailers. Branch naming establishes that the restoration is Claude-authored; nothing in the record establishes which model.

**Stated directly and without qualification: on the record, Claude Opus 4.8 authored the posture that took the platform's clinical-AI surfaces dark. The model that authored the restoration is unrecorded.**

---

## 3. What the operating rules required

`AGENTS.md:20-28` binds agents to the mission order's Permitted Scope, Excluded Scope, Approval Triggers and Stop Conditions. The mission order itself lives outside this repository; the in-repo record of the trigger list is `docs/qa/20260713-launch-readiness-session-note.md:28-30`, under the heading "Reserved to Maxwell (not done this session — approval triggers)", cross-referenced to `docs/launch/20260713-go-live-runbook.md`.

That recorded list reserves to Maxwell: DNS cutover; live Stripe secret keys; the `LEGAL_STATUS=effective` flip; public domain cutover; merge to `main`; any contact with Brenton; the real live payment test. The runbook adds that live Base44 changes are an approval trigger (`:76`) and that agents never execute payments (`:16`).

**Nothing in the recorded list requires owner acknowledgement of a production feature-availability regression.** On that record, disabling live clinical features by configuration fell *inside* the agent's written discretion, provided the merge and deploy were themselves authorised — and they were: PR #10 is titled "Intervening Order", and the merges ran under the owner's account.

The disablement was disclosed, but only diffusely. It is recorded in three places and one test name, and nowhere as a notice:

> "This release authorises only the bounded referral/document-extraction path. Legacy general clinical generation remains server-disabled until a separate function-level decision and release gate are completed."
> — `fly.production.toml:51-53` as at `e67792b`

> "Legacy general clinical drafting is a separate feature family. Keep it off until each function has its own authority, disclosure and clinical gate."
> — `.env.example:68-70` (still present, unchanged, in the current tree)

> "Publication does not by itself enable that function. The technical, contractual, child-data and release gates stated below must all be satisfied."
> — `src/legal-content/03_privacy_policy.md:12`, material-change note

To which add the test name itself, `E37 general clinical InvokeLLM remains disabled outside the referral adapter` (`server/tests/extraction-matrix.test.mjs:1836`).

Each of these is accurate. None of them is a notice. **No artefact anywhere in the repository says, in substance, "your eight user-visible AI surfaces will return 503 in production."** A reader had to already know what the flag governed in order to recognise what these sentences meant.

---

## 4. Counterfactual assessment

Both hypotheses are presented, because both were tested against the record.

### 4.1 Hypothesis A — capability failure (the authoring model did not grasp the consequences). Weak.

The record does not support it, and one artefact refutes it directly. The same pull request's Opus 4.8-trailered AI-disclosure commit enumerated the affected surfaces exhaustively, and said so:

> "New shared component, AIDisclosureNote.jsx, wired into the eight genuinely distinct user-visible AI surfaces (confirmed by tracing every InvokeLLM/transcribeSession call site and its rendered output, not by assumption)"

— followed by a named list: `SOAPNoteModal.jsx` (Assessment textarea, Plan textarea, transcript panel), `TreatmentProtocols.jsx`, `MedicationAlerts.jsx`, `AssessmentRecommendations.jsx`, `ClientConditions.jsx`, `SectionEditor.jsx`, `ReviewExport.jsx`, `NutritionPlanCreator.jsx`. The same commit went further and flagged an orphaned eleven-file `PDFFormFiller.jsx` tree with its own AI call sites as dead code awaiting a human removal decision.

The authoring lineage had, in writing, an exhaustive and correctly derived map of the blast radius. The rationale was recorded in three places. Restoration was explicitly gated on "a separate function-level decision". E37 pinned the disabled direction in test. This was a deliberate, documented, legally motivated fail-closed scoping decision — the concurrently published legal suite disclosed and gated the extraction path *only* — and not a comprehension failure.

The same sessions also show correct escalation on items the written rules did reserve: the Stripe cancellation-on-deactivation question was "left for Max" under the mission's no-autonomous-financial-action boundary (`20260713-launch-readiness-session-note.md:26`); the dead-code tree was flagged rather than removed; the `LEGAL_STATUS` flip was executed only against a verbatim recorded authorisation (`docs/launch/20260713-go-live-runbook.md:56`). Escalation tracked the written trigger list closely and accurately. Feature disablement was not on that list.

A different model, given the same mission framing ("Urgent: recover referral extraction", incident `ASX-INC-20260720-REFERRAL-02`), the same legal posture and the same trigger list, would very plausibly have made the same call. The model that made it was already the strongest in the record, and it did not treat the disablement as an approval item — because, on the written rules, it was not one.

### 4.2 Hypothesis B — process failure. Strong.

Three process facts, none of them a model choice, produced the seven-day duration:

1. **No approval trigger and no notice gate** existed for a change that reduces production feature availability (§3).
2. **No detection.** The only smoke assertion that exercises `Core/InvokeLLM` runs solely in the `SELFTEST=1` lane, which passes through the carve-out at `server/integrations.mjs:669-671`; the production-posture lane is gated on `SMOKE_PRODUCTION_MODE`, which is set nowhere in the repository. A green 10/10 smoke run and a hard 503 in production coexisted for the full week. There was no release ledger and no post-deploy functional check of the live AI surfaces.
3. **The corridor's own anti-tamper design** — correct in itself — converted recovery from a secret flip into a mandatory four-pull-request code release once the owner did decide to restore, because opaque Fly-secret override of this variable is deliberately refused and the workflows assert the literal value.

### 4.3 Calibrated conclusion

- **Roughly 15–25% likelihood** that substituting a different model would have prevented or materially shortened the outage. The decision was information-complete and rule-consistent; its seven-day persistence was a detection and notice failure that authoring-time model choice does not control.
- **Greater than 80% likelihood** that a notice gate or process change would have. A mandatory owner sign-off line item for any change reducing production feature availability, or a post-deploy functional smoke of the live AI surfaces, would each independently have surfaced the 503s on day zero or one.

The authoring model demonstrably enumerated the full blast radius before acting. **This was not a comprehension failure. The failure is in the process the model was bound to, which did not define this class of change as an escalation.**

One qualification the owner should hold alongside the above: the 28 July restoration comment at `fly.production.toml:51-53` records blanket owner authorisation, but the original written precondition — per-function authority, disclosure and clinical gates — was never satisfied for the surfaces other than TreatmentProtocols. The flip re-enabled the shared `Core/InvokeLLM` gate for all of them at once (32 direct call sites across 15 components and pages; 19 files reference the symbol). That is recorded as defect CS-6 in the companion review.

---

## 5. Recommendations

1. **Record model trailers on every agent commit, without exception — including CI-bootstrap and emergency pull requests.** The two gaps at §2.3 sit at precisely the two moments that matter most for accountability: the first artefact of the decision (`c32dd15`) and its reversal (`#17`–`#20`). A squash trailer on the merge commit is not sufficient; per-sub-commit trailers should survive the squash, as they did for the Fable 5 and Sonnet 5 bands and did not for the release-corridor run.
2. **Add feature-availability regression to the Approval Trigger list.** Any change that disables, gates or removes a production capability visible to a clinician requires recorded owner acknowledgement before merge, in the same form as the existing reserved items. This is the single change with the highest expected value, and it is a one-line addition to the mission order and to `docs/qa/20260713-launch-readiness-session-note.md:28-30`.
3. **The notice-gate design is delivered under the P2 governance workstream.** Its scope should include the mechanism (what artefact constitutes notice, who must acknowledge, at what point in the release corridor) and the paired detection control — a post-deploy functional check of the live AI surfaces run against the production posture, which is the same control that closes defect TT-3 in the companion review.

---

## Document control

| Field | Value |
|---|---|
| Document | `docs/qa/20260728-model-attribution-memo.md` |
| Status | **Draft — for owner review.** Prepared at the owner's explicit request |
| Date | 28 July 2026 |
| Branch | `claude/v16-patch-clinical-ai-review-g36phy` at `caf5f02` |
| Subject commits | `c32dd15`, `e67792b` (#6), `dd9b6ab` (#7), `cf0a816` (#8), `f27eaa5` (#9), `6a8ec8d` (#10), `2c2d4ff` (#17), `7577256` (#18), `883daff` (#19), `caf5f02` (#20) |
| Verification basis | Squash bodies read via `git log --format=%B`; trailer bands counted directly; commit trees inspected via `git show <sha>:<path>`; remote reference resolution checked via `git ls-remote` (this clone is shallow, so local object absence is not evidence of absence). Two source figures were corrected against the record and the corrections are marked in place |
| Attribution stated | Kill-switch posture: **Claude Opus 4.8**, per the squash trailer, 19–21 July 2026. Restoration: **model unrecorded** |
| Outage duration | `e67792b` merged 21 July 2026 16:16 AEST; `2c2d4ff` merged 28 July 2026 18:01 AEST — seven days |
| Companion document | `docs/qa/20260728-v16-patch-review.md` |
| Owner action required | Decide on recommendations 1 and 2; confirm that the notice-gate design belongs to the P2 governance workstream |
