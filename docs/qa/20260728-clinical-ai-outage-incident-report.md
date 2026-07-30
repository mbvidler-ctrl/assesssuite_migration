# Interim incident report — production clinical-AI outage, 21–28 July 2026

**Status: INTERIM.** Findings are verified against the repository record as at HEAD `caf5f02`, but remediation is in progress on this branch and deployment-side evidence (Fly release history, runtime logs) has not yet been obtained. A final revision will follow once corrective work lands and any deployment-side evidence is captured.

## Systemic finding — the operating framework failed against its own axioms

This incident must be read against the environment in which it occurred. The Unimatter operating framework governing this engagement is not a casual development setup: it enforces exact-SHA release corridors with sealed evidence chains, self-verifying workflow validators backed by hostile-mutation selftests, reserved authority triggers for named classes of change, documented runbooks, a standing clinical-claims audit register, and multi-suite QA gates on every release. On the framework's own axioms — fail closed, verify everything, reserve consequential decisions to recorded authority — a seven-day silent withdrawal of every clinical AI capability in the product **should not have been possible**. It happened anyway, because one class of consequential change (a production feature-availability regression) was never enumerated as a reserved decision, and every verification lane was configured at a posture that could not observe the change's effect.

Three consequences follow, and the body of this report substantiates each:

1. **The green signals were materially misleading.** Throughout the outage, the self-test suite reported 123/123, the gate suites passed, the release workflows' contracts held, and the assurance battery ran clean — while the deployed product returned HTTP 503 on every AI request. These were not false positives in the ordinary sense; the lanes were structurally configured (SELFTEST carve-out, `LLM_REQUIRED=0` gate lane, parity flag pin) such that the outage was *invisible to them by construction* (§4). An operator reading those signals was entitled to conclude the product was healthy. It was not.
2. **The absence of notice was, bluntly, an absurd outcome for a system of this rigour.** A framework that requires a literal confirmation phrase to take a read-only snapshot of production state imposed *no requirement whatsoever* to tell anyone that eleven clinical surfaces had been switched off (§4d, §5). The disclosure that did exist was buried in a config-file comment, an example-file remark and a test name — artefacts no operator is expected to read as notice. This is an indefensible asymmetry, and correcting it is the centrepiece of the remediation.
3. **Accountability, on the objective record, is systemic — not personal.** See §5a.

## Corrective posture

This report is not solely retrospective. Extensive corrective re-architecting has been designed, implemented and configured on this branch in direct response to the findings: capability state is now published to the client and every AI surface degrades honestly; a runtime capability-flag registry with a generated manifest and a CI impact gate makes a silent flag change structurally impossible to merge; capability notices are a required, templated artefact with the July events backfilled; the test suites now exercise the true production posture; the dissection path fails closed; and the release-corridor pins, runbook and evidence templates have been reconciled. Section 8 records the **per-item delivery status** (§8, "Delivery status of the corrective actions"): the majority of the confirmed findings are closed on this branch by the remediation commits, verified under an adversarial review pass; the items that remain open are genuine residuals — chiefly the per-function clinical gates, the parity-lane posture limitation, and the workflow-level changes that must themselves pass through the guarded release corridor — not aspirations recorded as done.

Prepared for: Maxwell Vidler (Principal Solutions Architect and Technical Lead, AssessSuite Engagement) and future auditors.
Repository: `assesssuite_migration`, branch `claude/v16-patch-clinical-ai-review-g36phy` (equal to `origin/main` at time of writing, HEAD `caf5f02`).

**Evidential basis and its limits.** Every factual claim in this report was re-verified against the repository at HEAD `caf5f02` using `git show`, `git log`, `git grep` and direct file reads. All timestamps are commit times in AEST (+10:00), as recorded in the git objects themselves. The repository contains **no Fly release ledger, no instantiated release-evidence document and no deployment receipts**. Every statement about when something was *deployed* is therefore an inference from commit time, and is marked as such. This is the single largest evidential weakness in the reconstruction and cannot be closed from inside the repository. The working clone is also **shallow** (62 commits), so the non-existence of a git object cannot be proven from it; where a pinned SHA does not resolve, this report says "does not resolve in this clone" and nothing stronger.

---

## 1. Summary

**What happened.** On 21 July 2026 a large release ("Urgent: recover referral extraction and consent release", PR #6, commit `e67792b`, 239 files, +40,947/−3,820) introduced a single server-side environment flag, `GENERAL_CLINICAL_LLM_ENABLED`, set to `"0"` in the production configuration. A gate added in the same commit causes the server's `InvokeLLM` endpoint — the endpoint behind every AI-assisted text feature in the product — to reject all requests with HTTP 503 unless that flag is exactly `"1"` (`server/integrations.mjs:668-675`). The same commit also deleted the Treatment Protocols generation interface outright (`src/pages/TreatmentProtocols.jsx`, 143 insertions / 569 deletions). The result was that, in production, every clinical AI feature in the application either failed with a server error or disappeared from the interface. The condition persisted for approximately seven days until an emergency restoration on 28 July 2026 (PR #17, `2c2d4ff`) set the flag to `"1"`.

**Duration.** Both endpoints are unverified in the repository, so the duration is stated as a bounded estimate:

| Boundary | Evidence | Time (AEST) |
|---|---|---|
| Earliest possible start | `e67792b` merged, carrying `GENERAL_CLINICAL_LLM_ENABLED = "0"` in the new `fly.production.toml` | 21 Jul 2026 16:16:58 |
| Best-supported start | `6a8ec8d` ("Intervening Order: immediate exact-main production deploy", PR #10) — the commit later labelled "the actual v14 production lineage" by `caf5f02` | 21 Jul 2026 17:49:55 |
| Earliest possible end | `2c2d4ff` flips the flag to `"1"` | 28 Jul 2026 18:01:47 |
| Release candidate complete | `caf5f02`, last commit of the v16 series | 28 Jul 2026 18:20:47 |

**Approximately 7 days.** The widest commit-bounded window is 7 days 2 hours 4 minutes; the narrowest is 6 days 22 hours 12 minutes. **The exact outage start and end cannot be established from the repository**, because no artefact records when either configuration reached Fly. `6a8ec8d` is not itself a deployment — it adds one file, `.github/workflows/emergency-production-deploy.yml` (178 lines). Its identification as "v14" rests solely on a retrospective label applied seven days later by `caf5f02`, which re-pinned `PRODUCTION_BASE_SHA` to `6a8ec8d70d87d7b17bcb89e03a9fea4e2871b6d5` with the message "Use the actual v14 production lineage as the release differential baseline" (`.github/workflows/production-prepare-release.yml:331,455`).

**Who was affected.** Every clinician using the live product. The flag is server-side and global: it is not per-tenant, not per-user and not per-feature. It is never exposed to the client — the only public runtime settings endpoint returns `transcription_enabled` and `legal` and nothing else (`server/index.mjs:1952-1974`) — so neither the application nor any clinician could determine that the capability had been withdrawn. During the outage there were **31 `InvokeLLM` call sites across 14 files** under `src/` (verified at `6a8ec8d`), of which 11 sites in 7 files sat behind live, routed user interface.

**Patient-safety framing.** The harm profile is not "the AI produced a wrong answer". It is: (i) silent withdrawal of decision support that clinicians had been introduced to, consented to and may have relied upon, while the AI disclosure banners remained on screen next to the dead features (8 components carried `AIDisclosureNote` throughout the outage, verified at `6a8ec8d`); (ii) failures presented as generic errors or as nothing at all, rather than as "this feature is temporarily unavailable"; and (iii) no record anywhere of who decided, when it started, when it ended, or which clinical sessions were affected. No evidence of actual patient harm was found, and none could be — the repository contains no telemetry, no error-rate record and no session log capable of showing it.

---

## 2. Impact by clinical surface

Eleven clinical surfaces were affected. The enumeration is: the eight user-visible AI surfaces that `e67792b` itself identified when it added per-surface AI disclosure banners, plus Dissect-to-SOAP, plus Assessment Audit (routed via `src/Layout.jsx:241`, no disclosure banner), plus the unrouted report-generator family.

**Behaviour classes** (empirically derived; classes A–D were confirmed by driving the running server over HTTP with the repository's own test harness, and by reading each caller's `catch` block):

- **A — hard error, toast**: the request throws; the caller shows an error toast.
- **B — inline card error**: the caller catches and writes an error string inside its own card; no toast.
- **C — silent fallback**: the caller catches and substitutes non-AI behaviour with no error surfaced at all.
- **D — silent empty**: the caller catches, logs to console only, and renders nothing.
- **E — feature absent**: the interface element was deleted; nothing to fail.
- **F — not reachable in production**: gated off before the AI path by a separate switch.
- **G — no live surface**: code exists and would have failed, but is not routed.

Driving the shim directly confirmed the server behaviour underneath classes A–D: with the flag at `0`, a plain prompt and a schema-shaped prompt (medication-alerts shape) both returned HTTP 503 with body `{"code":"internal_error","error":"General AI generation is disabled on this server."}` — the schema path receives no differentiated handling, because the 503 fires before any schema logic runs (`server/integrations.mjs:668-675`).

| # | Surface | File | Behaviour during the outage | Class |
|---|---|---|---|---|
| 1 | Treatment Protocols — AI protocol generation | `src/pages/TreatmentProtocols.jsx` | Generation interface **removed**, not merely broken: 569 lines deleted by `e67792b`; zero `InvokeLLM` call sites remained at `6a8ec8d`. A clinician looking for the generator found no button — indistinguishable from a product that never had the feature. Reviewed-catalogue browsing still worked; anything outside the catalogue became unavailable. The AI disclosure banner remained rendered (`:478` at `6a8ec8d`). | E |
| 2 | SOAP note assistance — Assessment and Plan drafting | `src/components/calendar/SOAPNoteModal.jsx` | Both drafting actions threw; toasts "Failed to generate AI assessment" (`:1481-1483`) and "Failed to generate AI plan" (`:1583-1585`). Highest-frequency, point-of-care surface; most likely to have been dismissed as a transient glitch rather than reported as a feature outage. | A |
| 3 | Dissect-to-SOAP | `server/functions/transcribeSession.mjs` | **Not reachable in production.** Production sets `TRANSCRIPTION_ENABLED = "0"` (`fly.production.toml:56`), and the function returns 403 before any model path (`:208-209`). The flag was irrelevant here. See the residual risk in §7: when driven with transcription enabled and no provider key, this path returns HTTP 200 with unlabelled placeholder SOAP text (`mockSoap`, `:154`, `:262`) rather than failing. | F |
| 4 | Medication safety alerts | `src/components/client/MedicationAlerts.jsx` | Auto-fires on mount via `useEffect` regardless of flag state; the 503 was caught and rendered as inline red text inside the card — "An error occurred while analyzing medications." (`:89-93`). No toast. The separate, ungated medication lookup data continued to render normally, so the panel looked partly populated. Safety-adjacent: the risk is the absent-warning case for a clinician accustomed to the list. | B |
| 5 | Assessment recommendations | `src/components/client/AssessmentRecommendations.jsx` | Caught and silently replaced by `fallbackToBasicMatching()` — no toast, no error state, no indication that AI selection had been replaced by keyword matching (`:125-128`). | C |
| 6 | Condition-based assessment suggestions | `src/pages/ClientConditions.jsx` | Caught, `console.error` only, suggestion list simply did not populate (`:84-86`). | D |
| 7 | Report wizard — per-section Generate / Regenerate / Tidy / Generate All | `src/components/reports/wizard-steps/SectionEditor.jsx` | Three call sites, all failing with toasts "Failed to generate content" (`:544-545`), "Failed to tidy content" (`:570-571`), "Failed to generate all sections" (`:681-682`). Report production is billable, deadline-bound work. | A |
| 8 | Report wizard — compiled report preview | `src/components/reports/wizard-steps/ReviewExport.jsx` | No `InvokeLLM` call site of its own; it compiles what SectionEditor produced, so the preview rendered unassisted or empty sections while continuing to display the AI disclosure banner. | derived from 7 |
| 9 | Nutrition plan advice | `src/components/client/NutritionPlanCreator.jsx` | One action populates three advice fields; all failed, toast "Failed to generate AI advice" (`:189-191`). | A |
| 10 | Assessment audit — AI fix generation | `src/pages/AssessmentAudit.jsx` | Two call sites (`:950`, `:990`) failing with toast "Failed to generate fix" (`:823-825`). Routed via `src/Layout.jsx:241`. Note: this surface carries **no** AI disclosure banner, before or after the outage. | A |
| 11 | Report-generator family (GPSummary, DVAPatientCarePlan, Form32Generator, CustomReportGenerator, PrivateHealth initial/progress, PDFFormFiller) | `src/components/reports/*` | 20 further call sites that would have returned 503, but the tree is not routed from the live `Reports.jsx` → `UnifiedReportWizard.jsx` path — `e67792b` had already flagged it as orphaned legacy code awaiting a human removal decision. `MedicareInitialLetter.jsx` and `MedicareFinalLetter.jsx` import `InvokeLLM` but never call it. | G |

---

## 3. Root cause

A single global kill switch, added and enforced in the same merge.

**Mechanism.** `server/integrations.mjs:668-675`:

```js
async function handleInvokeLLM(body) {
  const selftestMockAllowed =
    process.env.SELFTEST === '1' && process.env.GENERAL_CLINICAL_LLM_ENABLED === undefined;
  if (process.env.GENERAL_CLINICAL_LLM_ENABLED !== '1' && !selftestMockAllowed) {
    const error = new Error('General AI generation is disabled on this server.');
    error.httpStatus = 503;
    throw error;
  }
```

The check is the first statement in the handler. It runs before the request body is destructured, before schema handling, and before any provider logic. It is default-deny: any value other than the exact string `"1"` disables the endpoint.

**The production value.** `e67792b` is the commit that created `fly.production.toml` (`git log --diff-filter=A` confirms it), carrying `GENERAL_CLINICAL_LLM_ENABLED = "0"` at line 54 of that revision.

**Why it was one switch and not eleven.** `InvokeLLM` is a single shared endpoint. Every AI feature in the client calls it through `src/integrations/Core.js:7` / `src/api/integrations.js:8`. There is no per-feature flag, no per-tenant scope and no capability endpoint. Disabling the endpoint disabled the product's entire AI capability at once.

**Enforcement hardening in the same period.** The posture was not merely set, it was pinned:

- `server/tests/extraction-matrix.test.mjs:1836-1850` — test "E37 general clinical InvokeLLM remains disabled outside the referral adapter" asserts HTTP 503 and the exact message string. After `e67792b`, restoring clinical AI required deliberately editing a passing test.
- `scripts/check-production-secrets.mjs:39` — `GENERAL_CLINICAL_LLM_ENABLED` is listed in `FORBIDDEN_OPAQUE_OVERRIDES`, so it cannot be changed by a Fly secret; changing it requires a code change and a release.
- `.github/workflows/production-prepare-rollback-image.yml:180` and `.github/workflows/production-rollback.yml:192` assert the flag equals `"0"` in the rollback configuration.
- `server/productionBootstrap.mjs:16-38` hard-fails boot unless the flag equals `'0'` when `PARITY_ASSURANCE_MODE=1`.

Notably, the machine enforcement predates the application configuration: `c32dd15` ("ci: bootstrap verified production workflows", 20 Jul 05:19, workflows only) already asserted the `= "0"` posture a day before `fly.production.toml` existed.

---

## 4. Why it went unnoticed for seven days — the materially misleading green signals

Four structural blindnesses, each independently sufficient. Every automated lane either exempted itself from the flag or pinned the flag to the outage value, so **every green signal on 21 July was true of a configuration that did not exist in production**.

**(a) The SELFTEST carve-out.** `server/integrations.mjs:669-670` allows the mock path when `SELFTEST === '1'` **and** the flag is `undefined`. The self-test harness runs in exactly that combination, and it does exercise `InvokeLLM` in both raw-string and schema-shaped forms (`server/selftest.mjs:1604-1645`) — and passes. Production never has that combination. The suite was green while production returned 503. The same carve-out governs the default lane of `scripts/smoke.mjs`, which sets `SELFTEST=1` (`:160`) and then asserts `InvokeLLM` returns 200 with a schema-shaped object (`:388-416`). A secondary defect: because the condition tests `=== undefined`, a developer who copies `.env.example:70` into a shell exports an empty string and defeats the carve-out too.

**(b) The `LLM_REQUIRED=0` CI gate lane.** The release gate suite starts its server with `LLM_REQUIRED=0` and no clinical flag at `.github/workflows/production-prepare-release.yml:402`. The lane runs at the opposite posture from production on the one dimension that mattered. The only lane that could have caught the outage — the "production gates" lane in `scripts/smoke.mjs:148`, which sets `SELFTEST=0`, `LLM_REQUIRED=0` and no clinical flag — is enabled by `SMOKE_PRODUCTION_MODE=1`, a variable referenced **only** at `scripts/smoke.mjs:148` and nowhere else in the repository. It is unreachable dead code, and if enabled today its `InvokeLLM` assertion would fail.

**(c) The parity-assurance flag pin.** The "hidden same-app parity" machine, the one mechanism designed to observe production-like behaviour, is pinned to the outage posture: `--env GENERAL_CLINICAL_LLM_ENABLED=0` at `.github/workflows/production-parity-assurance.yml:715`, `:898` and `:958`, backed by the hard boot assertion at `server/productionBootstrap.mjs:29`. The parity lane is constitutionally incapable of observing a clinical-AI-enabled production. As of `2c2d4ff` the same workflow now asserts that `fly.production.toml` contains `"1"` (`:260`) while still launching its own parity machine with `0` — the lane now asserts a posture it structurally cannot exercise.

**(d) No client visibility and no notice artefact.** The flag is never sent to the client (`server/index.mjs:1952-1974` returns only `transcription_enabled` and `legal`), so nothing in the interface could tell a clinician the capability was withdrawn. There is no status page, no in-app banner mechanism, and the 503 body — "General AI generation is disabled on this server." — is an internal-sounding server string with no product copy in front of it. Every place a notice should have appeared was checked and confirmed empty:

- **The string `GENERAL_CLINICAL_LLM_ENABLED` does not appear anywhere in `docs/`** (verified by recursive grep, zero matches).
- `docs/deployment/20260719-release-evidence-template.md` has never been instantiated for the 21 July release or the 28 July emergency release. It is 192 lines containing 40 occurrences of `NOT RUN` / `NOT VERIFIED` / `NOT MADE`.
- `docs/deployment/20260719-exact-sha-production-release-runbook.md:20` describes the rollback image as differing only by disabling document extraction. It never mentions general clinical AI.
- `docs/qa/` follows a convention of a dated session note per campaign. The most recent file before this one is dated 13 July 2026. There is no session note for the 19–21 July referral release, none for the outage, and none for the 28 July emergency patch.
- The v16 restoration series (`2c2d4ff`, `7577256`, `883daff`, `caf5f02`) touched six workflow / test / config / JSX files and **zero** documentation files.

**The silent gap.** No commit between 21 July 17:49 and 27 July 23:38 touched the flag, the AI surfaces or the documentation. The first commit after the outage began is `cd090f6` (27 Jul 23:38), a landing-page copy fix; `b246c4f`, `61f3f73` and `64600aa` on 28 July are landing and CI fixes. Work continued on the marketing surface for roughly six days while the clinical AI endpoint returned 503.

---

## 5. Decision provenance

### 5a. Accountability — objective analysis

The question "whose fault was this" has an answer the record supports. The disablement was authored inside an agent release-corridor session; it fell within that agent's *written* discretion because the recorded reserved-decision list contained no trigger for feature-availability regressions; no artefact required, prompted, or even permitted-by-convention a notice to the engagement authority; and every quality signal the engagement authority could consult — self-tests, gate suites, workflow contracts, assurance runs — read green throughout (§4). On that record, no reasonable operator relying on the framework's own instruments could have detected the outage, and the engagement authority's reliance on those instruments was exactly the reliance the framework is designed to invite. Accountability therefore attaches to the framework's design gap — an unenumerated decision class and verification lanes blind at the decisive posture — and to the agent-authored change that exploited that gap without escalating beyond its written obligations, not to the engagement authority. The model-attribution memo (companion document) reaches the same conclusion from the authorship side: this was a process failure, not a comprehension failure, and no plausible substitution of personnel or model reliably prevents it; the notice gate now implemented does.


Three artefacts encode the decision. None of them is a decision record naming an approver, a scope or a duration.

**(a) `fly.production.toml` at `e67792b`, lines 51-54 — the rationale comment, quoted verbatim:**

> ```
>   # This release authorises only the bounded referral/document-extraction
>   # path. Legacy general clinical generation remains server-disabled until a
>   # separate function-level decision and release gate are completed.
>   GENERAL_CLINICAL_LLM_ENABLED = "0"
> ```

The stated intent is a scoping decision for the referral-extraction release, with re-enablement conditional on a future per-function decision. It does not state that anything was previously live, and it does not name the affected surfaces.

**(b) `.env.example:68-70` — unchanged to this day:**

> ```
> # Legacy general clinical drafting is a separate feature family. Keep it off
> # until each function has its own authority, disclosure and clinical gate.
> GENERAL_CLINICAL_LLM_ENABLED=
> ```

Two points. The value is empty, not `"0"` — which, given the `=== undefined` carve-out at `server/integrations.mjs:670`, is not the same thing in a shell-exported environment. And ten lines above, at `.env.example:54-63`, the same file enumerates precisely the surfaces the switch kills: "InvokeLLM (nutrition advice, medication alerts, assessment recommendations, treatment protocols, SOAP assist, the report suite) and Whisper transcription".

**(c) The commit body of `e67792b` — this section must state plainly what the record shows.** The squash body is 398 lines. It contains **zero** occurrences of `GENERAL_CLINICAL_LLM`, "clinical LLM", "default-deny" or "kill switch". Its single occurrence of "503" concerns unrelated `LLM_REQUIRED` behaviour ("a real model failure returns 502 and a missing key 503"), and its single occurrence of "disable" concerns the transcription switch. The 569-line deletion of the Treatment Protocols generation interface appears only obliquely, under one-line trailer subjects such as "release: close final referral and signup assurance findings" and "Harden referral recovery and release controls".

**The blast radius was fully enumerated inside the same merge.** This is the central provenance finding, and it is not ambiguous. The same commit body contains a section, "Add a per-function AI disclosure line", which enumerates the eight user-visible AI surfaces — SOAPNoteModal (Assessment, Plan, transcript panel), TreatmentProtocols, MedicationAlerts, AssessmentRecommendations, ClientConditions, SectionEditor, ReviewExport, NutritionPlanCreator — and states that they were identified "by tracing every InvokeLLM/transcribeSession call site and its rendered output, not by assumption". The same section separately identifies the orphaned 11-file `PDFFormFiller` tree and flags it for a human decision. In other words: the merge that disabled these surfaces contained, in its own commit message, a complete and accurate enumeration of them — produced for the purpose of adding disclosure banners to them. The enumeration and the shutdown travelled together and were never connected in writing. The banners were added; the features were switched off; and the change record described only the former.

**Authorship.** All artefacts are committed under `mbvidler-ctrl <mb.vidler@gmail.com>` with Claude co-author trailers. Within `e67792b`'s body, sub-commits carry 15 "Claude Fable 5", 4 "Claude Opus 4.8" and 2 "Claude Sonnet 5" trailers; the terminal squash trailer is "Co-authored-by: Claude Opus 4.8". The kill-switch sub-commits carry no individual trailers and close under that terminal trailer. `c32dd15` (which pre-committed the `= "0"` workflow assertions) carries no co-author trailer at all, and neither do any of the four v16 restoration commits. A full attribution and counterfactual analysis is in the companion memo; in summary: the record attributes the kill-switch posture to the Claude Opus 4.8 release-corridor session, attribution is squash-level rather than per-component because the branch was squashed, and the restoration is model-unrecorded. The counterfactual assessment is that this was a deliberate, documented, fail-closed scoping decision rather than a comprehension failure — the authoring session demonstrably knew the blast radius and wrote the rationale down in three places — and that the seven-day duration was a detection and notice failure that authoring-time model choice does not control. The recorded approval-trigger list (`docs/qa/20260713-launch-readiness-session-note.md:28-30`) reserves DNS cutover, live Stripe keys, the legal-status flip, domain cutover, merge to main, live payment testing and live-Base44 changes to Maxwell Vidler as engagement authority; it does not contain any trigger for reducing production feature availability. On that record, the disablement fell inside the agent's written discretion. **No human sign-off, reviewer name or authorising instrument for the disable decision exists anywhere in the repository.**

By contrast, the re-enablement is attributed. `fly.production.toml:51-53` now reads:

> ```
>   # Emergency global clinical-AI restoration authorised by Maxwell Vidler on
>   # 28 July 2026. LLM_REQUIRED remains enabled so provider failures stay loud;
>   # the reviewed rollback configuration remains fail-closed at 0.
> ```

---

## 6. Emergency restoration (v16)

Four commits on 28 July 2026, all on branch `claude/v16-patch-clinical-ai-review-g36phy`:

| Commit | Time (AEST) | Change |
|---|---|---|
| `2c2d4ff` (PR #17) | 18:01:47 | `GENERAL_CLINICAL_LLM_ENABLED` → `"1"` (`fly.production.toml:54`); `src/pages/TreatmentProtocols.jsx` +250/−19; new test E37a; two release-gate string assertions updated; catalogue contract test inverted. Body: "Emergency production restoration authorised 28 July 2026." |
| `7577256` (PR #18) | 18:07:59 | Moves the Playwright/Chromium install so the mission-assurance aggregate can run (`production-prepare-release.yml`, +5/−2). |
| `883daff` (PR #19) | 18:14:10 | Pins the rollback posture in test R00: candidate must be `"1"`, rollback must be `"0"` (`server/tests/rollback-compatibility.test.mjs:157-158`, plus the comparable-set handling at `:170-173`). |
| `caf5f02` (PR #20) | 18:20:47 | Re-points `PRODUCTION_BASE_SHA` from `183c8e4…` to `6a8ec8d…` at `production-prepare-release.yml:331,455`. |

No server-side code changed anywhere in the v16 series.

**The restoration re-enabled all surfaces globally.** The flag is a single global switch; flipping it to `"1"` restored the `InvokeLLM` endpoint for every caller at once. That includes Assessment Audit, which has no AI disclosure banner, and the orphaned `PDFFormFiller` tree that `e67792b` had explicitly flagged as unreachable legacy code awaiting a human removal decision.

**The original written precondition was only partially satisfied, and only for Treatment Protocols.** The precondition recorded in `fly.production.toml` at `e67792b` and in `.env.example:68-70` was that each function should have "its own authority, disclosure and clinical gate" before re-enablement. Against that standard:

- **Treatment Protocols — partially satisfied.** Disclosure exists (`AIDisclosureNote` at `src/pages/TreatmentProtocols.jsx:709`, plus an "AI-assisted draft" badge). An authority record exists but is a page-entry disclaimer acknowledgement written to `LegalAcceptance` *before* any draft is generated (`:460-476`) — that is consent to the feature, not review of a draft. A clinical gate exists only as a client-side convention: the page calls `searchEvidence` before `InvokeLLM`, and a comment at `:356-360` states this "preserves the server's active-account clinical access gate". That is an accurate description of a convention the client follows and the server does not enforce — `handleInvokeLLM` is invoked as `handleInvokeLLM(body)` (`server/integrations.mjs:1839`) without the request context that carries the clinical-eligibility flag. There is no clinician review-and-sign-off workflow.
- **All other surfaces — not satisfied at all.** No per-function authority record, no new disclosure and no clinical gate was added for SOAP assist, Medication Alerts, Assessment Recommendations, Client Conditions, the report wizard, Nutrition Plan advice, Assessment Audit or the report-generator family. They were re-enabled by the same one-character configuration change.

**The restoration is not like-for-like.** Treatment Protocols lost 569 lines at `e67792b` and regained 250 at `2c2d4ff`. The file was 1,303 lines before the outage, 878 during it, and 1,109 now; the cumulative difference against the pre-outage version is +364/−559. The pre-outage curated `commonConditions` list and category browser (`a74ade6:src/pages/TreatmentProtocols.jsx:49,184`) are gone, replaced by a catalogue-derived list plus a single custom-condition path (`:224-244` at HEAD). Nothing in the repository records what remains missing.

---

## 7. Residual risk register

The full residual-risk register — with severities, file:line evidence and reproduction notes for every finding — is held in the companion document **`docs/qa/20260728-v16-patch-review.md`** ("v16 emergency patch — technical review — 28 July 2026"), issued by the same review session. That document, not this one, is the authoritative register; only findings with status *confirmed* or *plausible* are carried into the summary below. The headline items are listed here so this report stands alone for an auditor:

**Critical**

- AI-generated protocol content is written into `SOAPNote.plan` by the Import-to-SOAP path unlabelled, with contraindications and red flags stripped, and will append into an already-published (locked) note because the day's-note lookup ignores note status and the server has no published-note immutability guard.

**High**

- `InvokeLLM` has no entitlement gate, rate limit, concurrency admission or cost control once the flag is on; the request context carrying clinical eligibility is never passed to the handler.
- A hardcoded "✓ Verified" badge is rendered unconditionally against every reference, including references the code deliberately marked `verified:false` when the verification service failed.
- AI-generated protocol text is re-fed verbatim into a second model prompt as clinical context for a DVA care plan.
- No scope or contraindication refusal channel exists for arbitrary conditions; the retrieval that grounds the prompt can be steered, and silently degrades from reviews-only to any indexed work.
- Assessment Audit writes model-authored contraindications, scoring and instructions into the Assessment catalogue with only the references field verification-gated, and with no AI disclosure on the surface at all.
- `add_context_from_internet: true` is silently ignored — there is no retrieval anywhere in the stack.
- `production-prepare-rollback-image.yml` pins `PRODUCTION_BASE_SHA` to `183c8e4…` in three job steps (`:258`, `:290`, `:306`); that SHA does not resolve in this clone and is in any case behind the current production lineage.
- `emergency-production-deploy.yml` fails at its very first hash gate (`:61`, `:68`): the pinned `fly.production.toml` SHA-256 no longer matches. Three of its five hardcoded release facts are stale. The workflow is inert as written.
- The runbook's description of what a rollback changes omits the clinical-AI divergence that the codebase itself now pins as a second deliberate difference.
- The only smoke lane capable of detecting this class of outage is unreachable dead code and would now fail if enabled.
- The emergency restoration is globally scoped but narrowly justified (see §6).

**Plausible — not confirmed**

- *(plausible)* `mockSoap()` in `server/functions/transcribeSession.mjs:154` fabricates specific patient-state claims ("improved pain levels", "residual morning stiffness"), returns them with `success: true` and no label, and — unlike its sibling `mockTranscript`, which self-labels as placeholder — contradicts the file's own header comment stating that all fallback mocks say plainly that they are placeholder output. Driving the module in process with `LLM_REQUIRED=1` and no provider key returned HTTP 200 with that content, confirming it bypasses both the clinical flag and `LLM_REQUIRED`. **This is marked plausible rather than confirmed because the path is not reachable in production**: `TRANSCRIPTION_ENABLED = "0"` (`fly.production.toml:56`) causes a 403 at `transcribeSession.mjs:208-209` before any model path runs. It is a latent risk that becomes live the moment transcription is enabled.

**Medium** — unenforced response schema plus no React error boundary anywhere in `src/` (a wrong-typed field crashes the whole single-page application); unfenced injection of retrieved literature into the prompt; rollback leaves the generation affordance visible and enabled in the shipped bundle while the server refuses it; E37a certifies the mock rather than the restored feature and the catalogue contract test asserts source text rather than behaviour; AI disclosure is screen-only and never survives persistence into saved reports, printed reports or SOAP fields; `.env.example` still instructs keeping the flag off, contradicting live production; the release-evidence template's "confirmed production base" SHA (`d593a7f…`, `:30`) does not resolve in this clone; the Treatment Protocols restoration is partial and nothing records what remains missing; the parity lane now asserts a production posture it cannot exercise.

---

## 8. Corrective actions

Workstream numbering (WP1–WP6) is local to this report. It is **not** the same as the "WP-1…WP-6" numbering that appears inside `e67792b`'s commit body, which belongs to the 16 July live-remediation mission.

### Delivered in this pull request

| Item | Status |
|---|---|
| WP1.1 — Restore the clinical-AI endpoint in production (`GENERAL_CLINICAL_LLM_ENABLED` → `"1"`, `fly.production.toml:54`) | Delivered (`2c2d4ff`) |
| WP1.2 — Restore the Treatment Protocols generation path (custom-condition route, +250 lines) | Delivered, partial (`2c2d4ff`) — see §6 |
| WP1.3 — Pin the candidate/rollback clinical-AI divergence in test R00 so the two postures cannot silently converge | Delivered (`883daff`) |
| WP1.4 — Correct the release differential baseline to the actual v14 lineage (`6a8ec8d`) | Delivered (`caf5f02`) |
| WP1.5 — Unblock the mission-assurance aggregate lane (Chromium install ordering) | Delivered (`7577256`) |
| WP1.6 — Produce this incident report as the permanent record of the outage | Delivered (this document) |

### Delivery status of the corrective actions

The register below was written as the outage's remediation plan. It has since been implemented on this review branch, and this table records what actually landed. "Delivered" items are closed by a commit and covered by a test; "Partial" items are materially advanced but retain a residual noted in the patch-review companion; "Residual" items are deliberately not attempted here, either because they are workflow-corridor changes that must be dispatched under the engagement authority's account or because they require a human product decision. The remediation commits are `2f3bfaf` (dissection fail-closed), `5d24981` (capability exposure + honest degradation), `6f290a2` (production-posture test matrix), `db1a3c3` (release-corridor reconciliation), `2561146` (flag-governance registry + notices + PR CI), `37b03ad` (server-side InvokeLLM hardening + error boundary), `7a8d6c9` (provenance labelling + published-note immutability), `70be664` (truthful verification), plus a Phase-D adversarial-review round that fixed a bulk-write bypass of the immutability guard and the remaining partial-labelling defects.

| Register item | Status | Delivered by |
|---|---|---|
| WP2.1 post-deploy AI-surface smoke at production posture | Partial — production-posture test lane exists; the in-release canary is specified in the telemetry plan, not yet wired | `6f290a2`; `docs/deployment/20260729-error-telemetry-plan.md` (Layer 3) |
| WP2.2 repair the `SMOKE_PRODUCTION_MODE` lane | Delivered | `6f290a2` |
| WP2.3 narrow the `SELFTEST` carve-out | Partial — real-posture tests now compensate; the carve-out remains for offline runs | `6f290a2` |
| WP2.4 stop gating at `LLM_REQUIRED=0` | Partial — a real-posture lane was added; changing the release gate itself is a corridor change | `6f290a2` |
| WP2.5 resolve the parity self-contradiction | Residual — parity pins the flag to `0` by design; documented limitation | — |
| WP3.1 pass context + enforce eligibility/status | Delivered (admin carve-out added in Phase D) | `37b03ad` |
| WP3.2 rate limit, concurrency, cost ceiling | Delivered | `37b03ad` |
| WP3.3 server-side schema handling + error boundary | Delivered | `37b03ad` |
| WP4.1 conditional "✓ Verified" badge | Delivered | `70be664` |
| WP4.2 carry AI label + safety sections through persistence | Delivered | `7a8d6c9` |
| WP4.3 published-note immutability guard | Delivered (bulk-write bypass closed in Phase D) | `7a8d6c9` + Phase D |
| WP4.4 out-of-scope / refusal channel + condition allow-list | Residual — not attempted in this pass | — |
| WP4.5 Assessment Audit disclosure + write-back gate | Partial — eligibility now enforced; surface disclosure not added | `37b03ad` |
| WP4.6 label or remove `mockSoap()` | Delivered (all four SOAP fields labelled) | `2f3bfaf` + Phase D |
| WP5.1 re-pin `PRODUCTION_BASE_SHA` in rollback-image | Delivered | `db1a3c3` |
| WP5.2 re-pin or retire the emergency deploy workflow | Delivered — file hashes re-pinned; the point-in-time Fly state pins converted to fail-loud sentinels | `db1a3c3` |
| WP5.3 reconcile `.env.example` | Delivered | `db1a3c3` |
| WP5.4 runbook: both rollback divergences | Delivered | `db1a3c3` |
| WP5.5 instantiate the release-evidence template | Partial — backfilled to the extent the record allows; unknowables marked | `db1a3c3` |
| WP6.1 per-function authority/disclosure/clinical gate | Residual — honest degradation and eligibility landed; full per-function clinical gating is follow-up | partial via `5d24981`, `37b03ad` |
| WP6.2 decide the orphaned `PDFFormFiller` tree | Residual — human product decision | — |
| WP6.3 record the unrestored Treatment Protocols surface | Partial — documented in the patch-review companion | `docs/qa/20260728-v16-patch-review.md` |
| G1 approval trigger for feature-availability regressions | Partial — PR template mandates a capability-impact section; the mission-order trigger is an external change | `2561146` |
| G2 mandatory capability-withdrawal notice artefact | Delivered | `2561146` |
| G3 user-facing availability channel | Delivered | `5d24981` |
| G4 restore the `docs/qa/` session-note convention | Partial — this report and companions restart it | this document |
| G5 make release-evidence instantiation merge-blocking | Residual — corridor change | — |
| G6 go-live runbook feature-availability section | Residual — not attempted here | — |
| G7 model-attribution trailers on every commit | Residual — cannot retro-fix squashed history; convention recorded | `docs/qa/20260728-model-attribution-memo.md` |
| G8 cross-check blast-radius enumeration against changed switches | Delivered — the flag-impact CI gate enforces exactly this | `2561146` |

The full register as originally written follows, for the record.

### Recommended (original register, as first issued)

| Item | Workstream |
|---|---|
| WP2.1 — Add a post-deploy functional smoke that drives every live AI surface at the real production posture (flag on, `LLM_REQUIRED=1`, real key) and fails the release if any returns non-200 | WP2 — detection |
| WP2.2 — Retire or repair the `SMOKE_PRODUCTION_MODE` lane; it is unreachable today and would fail if enabled | WP2 |
| WP2.3 — Remove or narrow the `SELFTEST` carve-out at `server/integrations.mjs:669-670` so no test lane can pass in a configuration production cannot have | WP2 |
| WP2.4 — Stop running the release gate at `LLM_REQUIRED=0` (`production-prepare-release.yml:402`), or add a second lane at production posture | WP2 |
| WP2.5 — Resolve the parity-assurance self-contradiction: the lane asserts `"1"` in config (`:260`) while launching its machine with `0` (`:715`, `:898`, `:958`) | WP2 |
| WP3.1 — Pass the request context to `handleInvokeLLM` and enforce the clinical-eligibility and account-status gates server-side | WP3 — server controls |
| WP3.2 — Add rate limiting, concurrency admission and a cost ceiling to `InvokeLLM`, matching the controls already applied to the extraction path | WP3 |
| WP3.3 — Enforce the response schema server-side, and add a React error boundary so a malformed response cannot unmount the application | WP3 |
| WP4.1 — Make the "✓ Verified" badge conditional on actual verification state | WP4 — clinical safety |
| WP4.2 — Carry the AI label and the safety sections (contraindications, red flags) through Import-to-SOAP, saved reports and printed output | WP4 |
| WP4.3 — Add a published-note immutability guard on the server | WP4 |
| WP4.4 — Add an out-of-scope / refusal channel to the protocol schema and a condition allow-list | WP4 |
| WP4.5 — Add AI disclosure to Assessment Audit, and gate its catalogue write-back beyond the references field | WP4 |
| WP4.6 — Label or remove `mockSoap()` before transcription is ever enabled | WP4 |
| WP5.1 — Re-pin or parameterise `PRODUCTION_BASE_SHA` in `production-prepare-rollback-image.yml` (`:258`, `:290`, `:306`) | WP5 — release corridor |
| WP5.2 — Re-pin `emergency-production-deploy.yml`'s three configuration hashes and two release facts, or retire the workflow | WP5 |
| WP5.3 — Update `.env.example:68-70` to match the live production posture, or state explicitly why they differ | WP5 |
| WP5.4 — Update `docs/deployment/20260719-exact-sha-production-release-runbook.md:20-22` to describe both rollback divergences | WP5 |
| WP5.5 — Instantiate the release-evidence template for the 21 July and 28 July releases retrospectively, to the extent the facts can be recovered | WP5 |
| WP6.1 — Complete the per-function authority, disclosure and clinical gate for each of the ten surfaces re-enabled globally without one | WP6 — precondition |
| WP6.2 — Decide the fate of the orphaned `PDFFormFiller` report tree (remove, or route and gate it) — the decision `e67792b` flagged for a human and that is still outstanding | WP6 |
| WP6.3 — Record what of the pre-outage Treatment Protocols interface remains unrestored, and decide whether to restore it | WP6 |

### Governance

| Item | Status |
|---|---|
| G1 — Add an explicit approval trigger: any change that reduces production feature availability requires recorded sign-off by the engagement authority before merge. No such trigger existed | Recommended |
| G2 — Require a notice artefact for any capability withdrawal, naming the affected surfaces, the expected duration and the restoration precondition | Recommended |
| G3 — Build a user-facing availability channel (capability endpoint plus in-app copy) so a withdrawn feature reads as "temporarily unavailable" rather than as a generic error | Recommended |
| G4 — Restore the `docs/qa/` per-campaign session-note convention, which lapsed after 13 July 2026 | Recommended |
| G5 — Make instantiation of the release-evidence document a merge-blocking gate, so "deployed at" is never again an inference | Recommended |
| G6 — Add a feature-availability section to `docs/launch/20260713-go-live-runbook.md`; none exists | Recommended |
| G7 — Require model-attribution trailers on every commit; they are absent on `c32dd15` and on all four v16 commits | Recommended |
| G8 — Require that any per-file blast-radius enumeration produced during a change be cross-checked against the switches that change touches. The enumeration existed inside `e67792b` and was never connected to the shutdown | Recommended |

---

## 9. Sources

**Commits** (all verified in this repository at HEAD `caf5f02`):

| SHA | Date (AEST) | Subject |
|---|---|---|
| `c32dd151566e8190f1c226daed3786680c875d0e` | 2026-07-20 05:19:16 | ci: bootstrap verified production workflows |
| `a74ade6` | 2026-07-20 06:16:20 | release: guard the actual 3 GB AssessSuite volume (#4) — used as the pre-outage reference for `TreatmentProtocols.jsx` |
| `e67792b44ee5bc35904baae83fb46283232b5b56` | 2026-07-21 16:16:58 | Urgent: recover referral extraction and consent release (#6) — 239 files, +40,947/−3,820 |
| `dd9b6ab`, `cf0a816`, `f27eaa5` | 2026-07-21 16:46–17:20 | PRs #7–#9, release plumbing |
| `6a8ec8d70d87d7b17bcb89e03a9fea4e2871b6d5` | 2026-07-21 17:49:55 | Intervening Order: immediate exact-main production deploy (#10) — 1 file, +178 |
| `cd090f6` | 2026-07-27 23:38:51 | fix: align landing CTA and neutralise screening copy |
| `b246c4f`, `61f3f73`, `64600aa` | 2026-07-28 13:28–15:16 | landing and CI fixes |
| `2c2d4ff` | 2026-07-28 18:01:47 | Restore production clinical AI (#17) |
| `7577256` | 2026-07-28 18:07:59 | Fix production release browser setup (#18) |
| `883daff` | 2026-07-28 18:14:10 | Bind clinical AI rollback posture (#19) |
| `caf5f02` | 2026-07-28 18:20:47 | Scan releases from deployed production baseline (#20) |

**File and line citations used in this report:**

Configuration and environment — `fly.production.toml:50-56` (current), `fly.production.toml:51-54` at `e67792b` (original rationale comment); `fly.rollback.production.toml:26-27`; `.env.example:54-63`, `.env.example:68-70`.

Server — `server/integrations.mjs:668-675` (kill switch), `:669-670` (SELFTEST carve-out), `:672` (503 message), `:1839` (context not passed); `server/index.mjs:1952-1974` (public settings); `server/productionBootstrap.mjs:16-38`, `:29`; `server/functions/transcribeSession.mjs:154`, `:208-209`, `:262`; `server/selftest.mjs:1604-1645`.

Client — `src/pages/TreatmentProtocols.jsx:224-244`, `:356-360`, `:403-409`, `:460-476`, `:709` (and `:478` at `6a8ec8d`); `src/components/calendar/SOAPNoteModal.jsx:1481-1483`, `:1583-1585`; `src/components/client/MedicationAlerts.jsx:89-93`; `src/components/client/AssessmentRecommendations.jsx:125-128`; `src/components/client/NutritionPlanCreator.jsx:189-191`; `src/pages/ClientConditions.jsx:84-86`; `src/components/reports/wizard-steps/SectionEditor.jsx:544-545`, `:570-571`, `:681-682`; `src/pages/AssessmentAudit.jsx:823-825`, `:950`, `:990`; `src/Layout.jsx:241`; `src/integrations/Core.js:7`; `src/api/integrations.js:8`; `src/components/reports/MedicareInitialLetter.jsx:10`; `src/components/reports/MedicareFinalLetter.jsx:9`.

Tests — `server/tests/extraction-matrix.test.mjs:1836-1850` (E37), `:1852-1871` (E37a); `server/tests/rollback-compatibility.test.mjs:152-180` (R00).

CI and scripts — `.github/workflows/production-prepare-release.yml:193`, `:331`, `:402`, `:437-442`, `:455`; `.github/workflows/production-parity-assurance.yml:260`, `:715`, `:898`, `:958`; `.github/workflows/production-prepare-rollback-image.yml:180`, `:258`, `:290`, `:306`; `.github/workflows/production-rollback.yml:192`; `.github/workflows/emergency-production-deploy.yml:61`, `:68`; `scripts/smoke.mjs:148`, `:160`, `:175`, `:388-416`; `scripts/check-production-secrets.mjs:35-45`.

Documentation — `docs/deployment/20260719-exact-sha-production-release-runbook.md:15-22`; `docs/deployment/20260719-release-evidence-template.md:30`; `docs/qa/20260713-launch-readiness-session-note.md:28-30`; `docs/launch/20260713-go-live-runbook.md`.

**Verification method.** Timeline and diff facts were re-derived with `git log --pretty='%h %ai %s'`, `git show --numstat`, `git show --shortstat`, `git log --diff-filter=A`, `git grep` at historical revisions, and `git cat-file -t`. Call-site counts were derived with `git grep -c "InvokeLLM("` at `6a8ec8d` (31 sites, 14 files) and at HEAD (32 sites, 15 files). Runtime behaviour classes A–D were confirmed by booting the server through the repository's own ephemeral-port test harness at both flag states and by driving `transcribeSession.mjs` in process; all spawned processes and throwaway stores were torn down afterwards.

**Known unverifiable claims.** The following are stated in this report as unverified or bounded, and should not be relied upon as established fact: the exact Fly deployment time of the v14 configuration; the exact Fly deployment time of the v16 configuration (and therefore the exact outage end); the identification of `6a8ec8d` as "v14", which rests on a retrospective label only; whether `183c8e4…` and `d593a7f…` exist as git objects outside this shallow clone; and whether any clinician actually encountered any of the eleven surfaces during the outage window, which no repository artefact can show.

---

*Document control — Author: Claude Code review session. Date: 28 July 2026. Status: interim — for review by the Principal Solutions Architect and Technical Lead, AssessSuite Engagement.*
