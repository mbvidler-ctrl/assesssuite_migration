# Report generation — discovery note (current architecture as observed)

**Repository:** `mbvidler-ctrl/assesssuite_migration`
**Baseline commit:** `e5def8832c9505ab072e269a888840112ffbc2a2` (`main`, "Probe the admitted EP application identity (#117)")
**Prepared:** 6 September 2026
**Method:** every claim below was read from the checkout at the baseline commit. Line numbers refer to that commit. Historical documents (the 31 July 2026 master specification and the 21–28 July 2026 incident report) were treated as leads only; where they and the code disagree, the code is stated.
**Scope of change:** none. This note records what exists. The cloned demonstration workspace under `demos/reporting-workspace/` and the design record `20260906-report-output-workflow-adr.md` are the only additions; no live application file was modified.

---

## 1. Report routes, screens and navigation

| Observation | Evidence |
|---|---|
| `Reports` is a shared page in both verticals. | `src/pages.config.js:100` (`SHARED_PAGES`), composed into `PHYSIO_PAGES` and `EP_PAGES` at `:111-133`. |
| The page reads three query parameters only: `clientId`, `editReportId`, and `careEpisodeId` (alias `episode_id`). There is no `reportType` parameter. | `src/pages/Reports.jsx:284-286`. |
| In the physiotherapy build the page refuses to render without an episode: it redirects to `PhysioEpisodes` when `careEpisodeId` is absent. | `src/pages/Reports.jsx:434-438`. |
| Entry points into the page are the "New Report" and "Create First Report" buttons of the saved-reports panel, which is mounted on the client profile without an episode and on the episode page with one. | `src/components/client/SavedReports.jsx:201-206, 274-279`; `src/pages/ClientProfile.jsx:681`; `src/pages/PhysioEpisodes.jsx:555`. `src/pages/PhysioFundingForms.jsx:305` navigates to the bare page. |
| The saved-reports panel also opens the wizard directly for in-place editing, passing the persisted upper-case `report_type` and, on the episode page, the episode id. No clinician object is passed on that path. | `src/components/client/SavedReports.jsx:293-302`. |
| Edit-by-URL (`editReportId`) exists but nothing in the application emits it. | `src/pages/Reports.jsx:365-390`; repository-wide search finds no producer. |
| Sidebar navigation is profession-driven: the physiotherapy profession lists `PhysioEpisodes` and `Reports` among its primary pages; a page absent from `allowedPages` is bounced to the dashboard. | `packages/profession-config/professions/physiotherapy.mjs:51-94`; `src/Layout.jsx:28-50, 74-85, 224-226`. |
| Adding a page requires four edits: the page file, `src/pages.config.js`, the profession's `navigation` block, and `src/Layout.jsx` `navigationDefinitions`. | `src/pages.config.js:71-114`; `src/Layout.jsx:28-41` (throws at module load for an undefined primary page, `:43-47`). |

## 2. Report components, templates and render/export paths

### 2.1 The live path: `UnifiedReportWizard`

| Observation | Evidence |
|---|---|
| Steps: create mode "Report Type → Date Range → Select Assessments → Sections → Review & Export"; edit mode "Edit Sections → Review & Export". | `src/components/reports/UnifiedReportWizard.jsx:1681-1683`, dispatch `:1964-1992`. |
| All section definitions for every report type live in one object, `REPORT_TEMPLATES` (`{ id, title, funder, mandatory[], optional[] }`). The physiotherapy progress report has seven mandatory sections; the referrer update six. | `UnifiedReportWizard.jsx:263-1361`; progress `:278-290`; referrer update `:291-302`. |
| Three further registries must be kept in step when a type is added: meta template map, prior-report dependencies, funder groups. | `:55-207`, `:210-260`, `:1364-1430`. |
| The Reports page keeps its **own** per-region catalogue that is not derived from `REPORT_TEMPLATES`; several page tiles have no template and the wizard rejects them with "not yet available". | `src/pages/Reports.jsx:23-237`; `UnifiedReportWizard.jsx:1864-1867, 1876`. |
| For physiotherapy the "Recommended" band is always empty because `allowedTypeIds` is `['*']` and `reportTypes['*']` is undefined. | `src/pages/Reports.jsx:298-300`; `physiotherapy.mjs:96-99`. |
| Report HTML is built by `buildReportHtml` (letter variant `buildGpLetterHtml`). Two inputs are non-deterministic: "Date Generated" uses the wall clock and age is computed from `Date.now()`. | `UnifiedReportWizard.jsx:1529-1593`, `:1473-1527`, `:1538, :1540`. |
| The outcome table **is** rendered from structured data by a shared, deterministic comparison function used by both the on-screen table and the saved HTML. "Improved/Declined" is asserted only where the catalogue records a direction of benefit. | `src/lib/clinical/outcomeComparison.js:81-147, 164-185`; `wizard-steps/OutcomeTable.jsx:50`. |
| Export is browser print only: a new window receives sanitised HTML and `print()` is called. There is no PDF library on this path; `html2canvas` is a dependency used only by orphaned generators. | `UnifiedReportWizard.jsx:1918-1922`; `src/lib/safeHtml.js:235-262`; `SavedReports.jsx:158-160`. |
| The review step lifts the data table out of the prose so a prose edit cannot destroy it. | `wizard-steps/ReviewExport.jsx:62-148, 172`. |
| The date range chosen in step 1 is written as `startDate/endDate` but read everywhere as `start/end`; it therefore never filters assessments and is persisted as `null`. | `wizard-steps/SelectDateRange.jsx:23-24, 34-35` versus `UnifiedReportWizard.jsx:1849-1853, 1889-1890`. |

### 2.2 The eleven legacy generators are unreachable

A repository-wide search for importers of `CustomReportGenerator`, `DVAEndCycleReport`, `DVAPatientCarePlan`, `Form32Generator`, `GPSummary`, `MedicareFinalLetter`, `MedicareInitialLetter`, `MedicareReferralAcceptance`, `PDFFormFiller`, `PrivateHealthInitialAssessment` and `PrivateHealthProgressReport` returns only their own definitions and `PDFFormFiller.jsx`'s internal imports (`:19-26`). Nothing imports `PDFFormFiller`. The only report module reachable from the route table is `UnifiedReportWizard` (via `Reports.jsx:16` and `SavedReports.jsx:23`). This was verified independently of the exploration report by a second search during this session.

Facts worth retaining from the orphaned code, because they shaped the product direction:

- `MedicareInitialLetter.jsx:10` and `MedicareFinalLetter.jsx:9` import `InvokeLLM` and never call it; both letters are pure templating with clinician-typed fields. Their "Generate Content" step name is misleading.
- `MedicareFinalLetter.jsx:111-112` prints an unconditional statement that the patient "has completed their Exercise Physiology program under Medicare CDM".
- `PrivateHealthInitialAssessment.jsx:822-824` silently injects "Twice weekly", "60 minutes per session" and "12 weeks initial program" into persisted data after a model call.
- `GPSummary.jsx:152`, `MedicareInitialLetter.jsx:164`, `MedicareFinalLetter.jsx:146` and `MedicareReferralAcceptance.jsx:152` can print the literal placeholder `[Provider Number]`.
- Legacy generators wrote to `ClientReport`; the wizard writes to `SavedReport`. The saved-reports panel lists both but deletes only `SavedReport` (`SavedReports.jsx:104-113, 129`).

## 3. Entities, API calls and data shapes feeding reports

| Observation | Evidence |
|---|---|
| The wizard reads `ClientAssessment` (episode-scoped when an episode id is present), `ClientCondition` (not episode-scoped), the `Assessment` catalogue, prior `SavedReport` rows and `SOAPNote` rows. It never reads `PhysioCareEpisode`; the episode id is only a filter. | `UnifiedReportWizard.jsx:1762-1767, 1809-1816`. |
| The wizard writes one `SavedReport` with `status: "final"` on every save, including when it re-saves an AI draft that was stored with `status: "draft"`. There is no locked state and a saved report can be reopened and overwritten indefinitely. | `UnifiedReportWizard.jsx:1882-1900, 1899`. |
| `ai_assisted_sections` and a per-section `[AI-assisted draft]` heading tag plus a footer disclosure are written into saved content when a section was AI-drafted. | `UnifiedReportWizard.jsx:1583-1584, 1591, 1897`; `src/lib/clinical/aiProvenance.js:34-40`. |
| Real immutability controls are server-side and physiotherapy-only: client-supplied revision fields are refused (403); updates require `expected_updated_date` (409 otherwise); prior content is appended to an append-only `revision_history`; bulk writes are 405; `ai_generation` is server-controlled. | `server/index.mjs:1329-1381`, `:585-593`, `:1382-1395`, `:1992-1998, 2205`. |
| The wizard forwards `expected_updated_date` only when an episode id is present; an episode-less edit of a physiotherapy report will be rejected with 409. | `UnifiedReportWizard.jsx:1902-1905`. |
| Every episode-linked child entity must carry `physio_care_episode_id` on create or the server refuses it. | `server/tests/physio-episode-linkage.test.mjs:166-200`. |
| `PhysioCareEpisode` already holds referral, red-flag screen, examinations, initial findings, goals, outcome measures, encounters, management protocols, home programs and a `reporting` block. `reporting.report_ids` is written once and never read; `reporting.ai_drafts` is populated server-side and never rendered. | `base44/entities/PhysioCareEpisode.jsonc` (reporting `:262-330`); `src/lib/physio/careEpisode.js:214-215`; repository search for readers. |
| `SavedReport` carries a server-owned `ai_generation` binding when the row was produced by the named physiotherapy AI task. | `base44/entities/SavedReport.jsonc` (`ai_generation`); `server/functions/savePhysioAiGeneration.mjs`. |
| Local-only entities are registered in `server/local-entity-schemas.json` and merged by the shim; organisation scoping is derived from the presence of an `org_id` property in the schema, never from sampled data. | `server/db.mjs:780-803`. |

## 4. Report-related AI callers and the generic prompt path

| Observation | Evidence |
|---|---|
| Thirty-three `InvokeLLM` call sites exist in fifteen source files, plus two unused imports. Twenty of the call sites are in the orphaned generators; four are in the live wizard's `SectionEditor`; the remaining nine are non-report surfaces (medication alerts, nutrition, assessment recommendations, SOAP notes, treatment protocols, assessment audit, client conditions) whose reachability is outside this note. | Repository search for `InvokeLLM(`; per-file lines: `SectionEditor.jsx:478, 517, 563, 581`. |
| The live wizard's three AI actions are: draft one section, "tidy" one section, and batch-draft all eligible sections with a response schema and one contract-repair retry. Tidying clinician-written text marks it as AI-drafted. | `wizard-steps/SectionEditor.jsx:454-495, 497-532, 534-616`, `:520-525`. |
| The prompt is assembled in the browser from client identity (name, date of birth, age), up to twenty conditions, goals, referral and funding details, normalised assessments, screening data and funder-specific blocks, plus prior report text and SOAP notes. | `SectionEditor.jsx:398-452`; `src/lib/reports/reportContentGeneration.js:199-346`. |
| The wizard's AI buttons are gated client-side by the profession flag `legacyGeneralClinicalLlm` (true for physiotherapy) and by the published capability. | `SectionEditor.jsx:32, 265, 677, 731, 735`; `physiotherapy.mjs:102`. |
| Server-side, the generic endpoint is `POST /integration-endpoints/Core/InvokeLLM`, switched by `GENERAL_CLINICAL_LLM_ENABLED` and off by default. | `server/integrations.mjs:755`; `server/capabilityFlags.mjs:274-287`. |
| A separate, server-owned named-task gateway exists for physiotherapy: reviewed task ids, server-built context, closed output schemas, provider receipt, usage settlement, content-free provenance hashes, idempotent generation and a review-then-save path into `SavedReport`/`SOAPNote`. It never uses the development mock and publishes `unconfigured` when no provider key is present. | `server/physioAiTasks.mjs`; `server/functions/physioAiTask.mjs`; `server/functions/savePhysioAiGeneration.mjs`; `server/capabilities.mjs:106-119`. |
| The episode page's AI workspace calls that gateway; the browser never creates the linked record itself. | `src/components/physio/PhysioAiWorkspace.jsx:132-195`; `src/pages/PhysioEpisodes.jsx:244-288`; `server/tests/physio-ai-draft-workspace.test.mjs:156-157`. |

## 5. Tests and fixtures

| Observation | Evidence |
|---|---|
| The primary regression suite passed at the baseline: 123 of 123. Lint: 0 errors, 8 pre-existing warnings. Typecheck: clean. | `npm run selftest`, `npm run lint`, `npm run typecheck` on `e5def88`, run in this session with Node 24.20.0. |
| The assurance runner executes a hard-coded manifest of test files; a new test file is not discovered unless listed. | `server/tests/run-assurance.mjs:7` onwards. |
| An offline browser journey exists for physiotherapy that provisions an owner, invites a clinician, creates a patient and episode, completes an assessment, generates and saves an AI draft against a loopback fake provider, and proves restart persistence. | `e2e/physio-offline-journey/`; `server/tests/support/fake-openai-chat.mjs`. |
| Server-owned report revision history, episode linkage, AI-task admission and the draft workspace's source-text contracts are tested. | `server/tests/physio-episode-linkage.test.mjs:329-352`; `server/tests/physio-ai-tasks.test.mjs`; `server/tests/physio-ai-draft-workspace.test.mjs:139-171`. |
| Gaps: no test covers evidence completeness, pinned sources, deterministic rendering across time, approval immutability of report content (only revision history), explicit refresh after a source change, or an amendment chain. The date-range defect in §2.1 is untested. The wizard's unconditional `status: "final"` is untested. | Absence established by search of `server/tests/` and `e2e/`. |
| Application-level error handling is a single root boundary; a throw inside the wizard blanks the whole shell. | `src/main.jsx:9-11`; `src/components/system/RootErrorBoundary.jsx:13-44`; no `errorElement` or `Suspense` in `src/App.jsx` or `src/Layout.jsx`. |

## 6. Can the existing data objects support the vertical slice without a risky migration?

Yes, for the read side. Every evidence category the product direction requires already exists on `PhysioCareEpisode` and its episode-linked children, and the deterministic comparison library already projects measures into a comparison table. Three things are absent and cannot be represented in existing entities without overloading them:

1. an **OutputRequest** with recipient, purpose, questions, owner, due date and required evidence;
2. a **SourceSet** that pins record versions and content hashes;
3. an **immutable snapshot** with a source manifest and an amendment chain.

`SavedReport.revision_history` records what a row used to contain; it does not freeze an approved output, does not pin sources, and does not link a successor to a predecessor. The clean path is two new local-only entities, registered through the existing `server/local-entity-schemas.json` mechanism with an `org_id` property so organisation scoping applies automatically, written only through a controlled function command, and refused on the generic entity write route in the same way physiotherapy report revision fields are refused today.

## 7. The smallest safe seam (proposal)

The demonstration workspace exercises the proposed seam without touching the live application:

- **Domain** (`demos/reporting-workspace/domain/`): pure modules for report types, the evidence catalogue and completeness, SourceSet pinning and change detection, deterministic fact generation and rendering, the request state machine, admission checks and the named AI task contract. These are transplantable into `server/` unchanged.
- **Service and API** (`demos/reporting-workspace/server/`): a SQLite document store with the same `entity_<Name>(id, data)` layout as the live shim, a service that mirrors the live functions router's `ctx` conventions, and an HTTP surface that exposes named commands only.
- **Interface** (`demos/reporting-workspace/app/`): a Vite shell that imports the live UI primitives and deterministic libraries by read-only alias.

In the live application the same seam would be: `server/local-entity-schemas.json` (two entities), `server/functions/index.mjs` (one command function added to `REGISTRY` and `REQUIRES_ACTIVE_ACCOUNT`), a write refusal for the two entities on `ENTITY_ROUTE_RE`, one page under `src/pages/`, and the four navigation edits in §1. The legacy wizard remains untouched and continues to write `SavedReport` rows, which the new workflow reads as prior-report evidence.

---

### Appendix A — commands and results observed at the baseline

```
node --version                      v24.20.0
npm run selftest                    Self-test complete: 123/123 passed.
npm run lint                        0 errors, 8 warnings (pre-existing)
npm run typecheck                   clean (0 diagnostics)
git rev-parse HEAD                  e5def8832c9505ab072e269a888840112ffbc2a2
```

### Appendix B — separation of observed facts from proposals

Sections 1–5 are observations. Section 6 is an assessment drawn from those observations. Section 7 is a proposal; it is implemented only inside the demonstration workspace and is not applied to the live application in this change.
