# Report output workflow — design record (ADR-lite)

**Status:** demonstrated in `demos/reporting-workspace/`; not applied to the live application.
**Baseline:** `e5def8832c9505ab072e269a888840112ffbc2a2` (`main`).
**Companion:** `20260906-report-generation-discovery-note.md` (observed architecture), `walkthrough/` (screenshots and evidence from the deterministic browser run).
**Date:** 6 September 2026.

This record states each material design decision, the alternatives that were rejected, and the consequences. It is written so that a reviewer can accept or reverse a decision without reading the code.

---

## D1. Build the slice in a cloned workspace, not in the live application

**Context.** The engagement owner directed that the live application must not be edited. The live report path is the `UnifiedReportWizard`; the eleven legacy generators are orphaned code (discovery note §2.2).

**Decision.** The workflow is implemented as a self-contained workspace under `demos/reporting-workspace/` with its own Vite shell, Node API and SQLite store. It reuses the live application's UI primitives (`src/components/ui`) and its deterministic clinical libraries (`src/lib/clinical/outcomeComparison.js`, `src/lib/clinical/aiProvenance.js`) by read-only import so that the demonstration projects the same numbers and the same provenance vocabulary the live wizard uses.

**Consequences.** No live file changed; the root `npm run selftest`, `npm run lint`, `npm run typecheck`, `npm run build:platform` and `npm run build:physio` gates are unaffected. The workspace has its own `demo:test`, `demo:lint`, `demo:build` and `demo:walkthrough` scripts. Transplanting the domain modules into `server/` is a file move plus entity registration (D9).

**Rejected.** Editing `UnifiedReportWizard`, `Reports.jsx` or `server/index.mjs` directly; building a separate repository (the canonical repository is the required home for the engineering record).

## D2. One aggregate request entity and one immutable snapshot entity

**Context.** The product direction names seven canonical objects (OutputRequest, SourceSet, CompletenessAssessment, DraftRevision, DocumentDefinitionVersion, DocumentSnapshot, Amendment/Supersession, DeliveryEvent). The live shim stores every entity as a JSON document in an `entity_<Name>(id, data)` table and derives organisation scoping from an `org_id` schema property.

**Decision.** Two entities:

| Entity | Holds | Mutability |
|---|---|---|
| `ReportOutputRequest` | the OutputRequest fields; `completeness` (CompletenessAssessment); `source_sets[]` (every SourceSet ever pinned, with the pinned content); `draft_revisions[]` (every DraftRevision); `snapshot_ids[]` and `snapshot_chain[]` (supersession links); `delivery_events[]`, `export_events[]`; `history[]` (append-only); `processed_commands[]` (idempotency); `version` (optimistic concurrency) | replaced whole by the service after each command; never mutated in place by a command |
| `ReportDocumentSnapshot` | the frozen sections, a copy of the SourceSet, the document model, the rendered HTML, content/document/manifest hashes, approver and time, staleness acknowledgement, `supersedes_snapshot_id`, amendment reason | never updated or deleted; the store refuses `update`/`replace` on this entity |

The DocumentDefinitionVersion is the `template_version` string pinned on the request, on every SourceSet and on every snapshot (`physio-progress-report/1.0.0`, `physio-referrer-update/1.0.0`) together with `generator_version`.

**Consequences.** The request row grows with each revision and source set. For a demonstration and for a first production slice this is acceptable (a SourceSet for the richer fixture is 24 items); the split into separate rows is a mechanical change when row size becomes a concern. Reads of a request require no joins.

**Rejected.** Reusing `SavedReport.revision_history` as the snapshot mechanism (it records prior row content; it does not freeze an output, pin sources or link successors). Seven separate entities now (more surface for the first review, no functional gain at this scale).

## D3. A SourceSet pins content, not just identifiers

**Context.** A draft must be reproducible and a later change to a source must be detectable without trusting `updated_date` alone (episode sub-objects such as goals share the episode's `updated_date`).

**Decision.** Each SourceSet item stores the source id, entity, record id, path within the record, label, recorded date, record version, a **minimised copy of the content** and its SHA-256. The manifest hash covers item hashes, measure definitions, template and generator versions. Staleness is detected by comparing item hashes with a freshly built catalogue and by finding sources the selection rule would now include (added) or no longer finds (removed). A refresh is an explicit command that pins a new SourceSet version and creates a new revision carrying the narrative forward marked for review, with the diff recorded on the revision. Approval against stale sources is refused unless the approver explicitly acknowledges it; the acknowledgement and the change list are recorded in the snapshot and rendered in the document.

**Consequences.** Deterministic rendering needs no live record. Identity minimisation happens once, at catalogue build time (`client_summary` carries display name and referral context only; a test proves contact, date-of-birth and funding identifiers never enter the catalogue).

**Rejected.** Pinning ids and versions only (cannot reproduce or diff); silent re-pinning on read (violates "a refresh is explicit, never silent").

## D4. Facts are generated; narrative is authored; the renderer is pure

**Context.** Exact dates, scores, tables and calculated changes must render deterministically from structured data; clinician interpretation must not be presented as a recorded fact, and model-generated text must not be presented as either.

**Decision.** Every section has a `kind`: `facts` sections are generated from the pinned SourceSet by a registered generator and are refused as free-text edits (`facts_not_editable`); `narrative` sections carry an `origin` of `clinician` or `ai_assisted` and a review state. The outcome comparison rows are produced by the live `buildOutcomeComparison` function; dates are formatted from ISO strings without a `Date` object so the output does not depend on the host time zone; the only timestamps in a document are approval and pinning metadata that live in the model, not in the renderer. The document model is a plain object that is hashed and stored; re-rendering the stored model reproduces the stored HTML byte for byte (tested).

**Consequences.** The live wizard's two non-deterministic inputs (wall-clock "Date Generated" and `Date.now()`-derived age) are not carried into the new path. Missingness renders as "Not recorded" or an explicit notice, never as blank prose.

**Rejected.** A single editable HTML body (the live wizard's model, which required the review step to lift the data table out of the prose to protect it).

## D5. An approved snapshot is immutable; a correction is a successor

**Decision.** `approve` is allowed only from `needs_review`, requires every required narrative section to have text or a recorded not-applicable reason, refuses unreviewed AI-assisted sections, and produces a snapshot whose `content_sha256` covers the sections, source manifest, template and generator versions. After approval, `saveDraft`, `refreshSources`, `importAiDraftSection` and `cancel` are refused with `approved_snapshot_immutable`. `openAmendment` creates a revision from the snapshot's sections and source set with a recorded reason; the amendment passes through review and approval like any draft, and its snapshot records `supersedes_snapshot_id` while the request's `snapshot_chain` records `superseded_by_snapshot_id` on the predecessor. The predecessor row is never touched (tested by deep comparison before and after).

**Rejected.** Editing the approved row with a revision counter (the live `SavedReport` model); deleting or overwriting the predecessor.

## D6. Named commands, optimistic concurrency, idempotency and role admission

**Decision.** The browser calls named commands (`assembleEvidence`, `startDraft`, `saveDraft`, `importAiDraftSection`, `submitForReview`, `approve`, `refreshSources`, `openAmendment`, `recordDelivery`, `recordExport`, `cancel`) and never writes entity rows. Every mutating command requires `expected_version` (409 `request_changed` on mismatch) and accepts an optional `command_id` whose fingerprint is stored so a retry replays the prior result and a different payload under the same id is refused. Admission is layered: any active member of the organisation may raise a request, record delivery or cancel; only a clinical role may author; only a clinical role with the `can_approve_reports` capability may approve. Practice administrators cannot author clinical content. Cross-organisation reads return 403 or 404 and never leak the existence of a foreign record beyond that status.

**Owner decision surfaced, not made.** Whether a treating clinician may approve their own report, and which roles hold the approval capability, are policy questions. The demonstration gives the senior clinician the capability and withholds it from the treating clinician to make the gate visible.

## D7. AI is a named, fail-closed task; generated text is labelled until approved

**Decision.** The only route by which model text can enter a draft is the named task `report.draft_section.v1`: server-owned input built from the pinned sources with identity fields stripped, a closed output schema (`additionalProperties: false`, bounded lengths and item counts), claims that must cite pinned source ids, a provider receipt check, and content-free provenance (input hash, schema hash, provider, model, time). The demonstration registers no adapter, so the task returns 503 `ai_drafting_unavailable` and nothing is generated or fabricated. A validated generation, when one exists, is applied as an `ai_assisted` section in review state `in_progress`; approval is refused until the clinician marks it reviewed; the rendered output labels the section "AI-assisted draft, clinician reviewed", prints the attribution and adds the live application's disclosure sentence. The same labelling applies to a prior AI-assisted `SavedReport` imported as a section, which remains context rather than verified evidence in the limitations section.

**Rejected.** Browser-authored prompts through the generic `InvokeLLM` route; treating a configured-but-unproven provider as evidence; any "verified" state for a source.

## D8. Delivery is recorded, not performed

**Decision.** `recordDelivery` stores channel, recipient, note, actor and time with `status: recorded_manually` and `integration: none`, and moves the request to `sent`. No message is sent and the interface says so. A delivery integration is an owner decision.

## D9. Storage mirrors the live shim so that coexistence is a registration, not a migration

**Decision and migration path.** The workspace store uses `entity_<Name>(id, data)` tables with the shim's stamped fields. To bring the workflow into the live application:

1. Register `ReportOutputRequest` and `ReportDocumentSnapshot` in `server/local-entity-schemas.json` with an `org_id` property (organisation scoping is derived from the schema, `server/db.mjs:800-803`).
2. Add one function, `reportOutputWorkflow`, to `server/functions/index.mjs` `REGISTRY` and `REQUIRES_ACTIVE_ACCOUNT`, dispatching to the domain commands with the functions router's `ctx` (user, entities, db, respond), loading the episode context with the same episode-scoped filters `physioAiTask.mjs` uses.
3. Refuse client writes to the two entities on the generic entity route, in the manner of `preparePhysioReportMutation` (403) and the physiotherapy bulk-write refusal (405).
4. Move `demos/reporting-workspace/domain/` into `server/reporting/` unchanged; move the tests into `server/tests/` and list them in the assurance manifest.
5. Add the page under `src/pages/`, the `pages.config.js` entry, the profession `navigation` entries and the `Layout.jsx` definition; add the episode entry point in the "Progress, reporting and discharge" section of `PhysioEpisodes.jsx` and a link from `SavedReports.jsx`.
6. Leave the `UnifiedReportWizard` in place. Its `SavedReport` rows are read by the new workflow as prior-report evidence; nothing is dual-written from the browser.

**Rollback.** The feature is additive. Removing the function, the page and the two entity registrations restores the baseline; the two tables can be dropped with no effect on other entities.

**Legacy data.** No backfill is proposed. Historical `SavedReport` and `ClientReport` rows have unknown provenance; they remain unknown and are surfaced as prior reports only.

## D10. Two report types, matching the live wizard's persisted identifiers

**Decision.** `PHYSIO_PROGRESS_REPORT` and `PHYSIO_REFERRER_UPDATE`, the ids the live wizard already persists for the physiotherapy vertical, with section structures adapted from the wizard's mandatory sections into the facts/interpretation/recommendations separation. The first supported pair is an owner decision; these two were chosen because the fixtures and the existing named AI tasks (`physio.progress_comparison.v1`, `physio.referrer_update.v1`) already serve them.

---

## Residual risks and limitations of the demonstration

- Demonstration identities replace authentication; the admission logic is real, the credential is not.
- Equality filters are evaluated in memory; adequate for a fixture dataset, not for production volumes.
- Pinned content copies enlarge the request row; separation into rows is deferred (D2).
- Export is browser print; no PDF artefact is produced or stored.
- The workflow is exercised for physiotherapy only.
- No rate limiting, audit export or retention rule is implemented in the demonstration API.
- The live wizard's date-range defect and non-deterministic header remain as observed; they are outside the change.

## Rejected shortcuts, for the record

Editing the live application; routing new work through `InvokeLLM`; a single completeness percentage; silent re-pinning on refresh; mutating an approved snapshot; browser dual-writes; a fabricated fallback draft when no provider is configured; labelling any source "verified".
