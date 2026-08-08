<!--capability-notice
notice_id: 20260808-general-clinical-llm-core-v1-containment
date: 2026-08-08
flags: GENERAL_CLINICAL_LLM_ENABLED,CORE_V1_SANDBOX_ENABLED
direction: reduces
release: AssessSuite Core V1 production candidate
surfaces_affected: 6
owner_acknowledgement: M. Vidler's 7-8 August 2026 AssessSuite Core V1 directive authorised every identified weakness, vulnerability and defect to be solved under mission order UM-AUTO-20260807-ASSESSSUITE-CORE-V1; this does not authorise live deployment.
expected_duration: indefinite, until a purpose-specific clinical capability is separately governed, validated and expressly authorised for production
capability-notice-->

# Generic clinical AI is contained for the Core V1 production candidate

## User-visible effect

The remaining legacy generic AI drafting actions are unavailable in the production candidate. All reachable controls read the published capability posture and remain visible, disabled and labelled. Deterministic assessment discovery, governed treatment-protocol catalogue lookup and draft-only Core V1 report composition remain available because they no longer use the generic `InvokeLLM` capability.

The same governed change introduces `CORE_V1_SANDBOX_ENABLED` at `0` in candidate, rollback and parity configurations. This adds no production capability and causes no user-visible change: `/api/core/v1/*` remains hidden, and the production server retains a separate absolute hard-disable. It is named in this notice only because the capability-impact gate mechanically requires every co-changed registered flag to be covered; the `direction: reduces` classification belongs to the generic-LLM containment above, not to a claimed reduction of a previously available Core route.

## Surfaces affected

`fly.production.toml` now pins `GENERAL_CLINICAL_LLM_ENABLED="0"`, enforced by the preparation and parity workflow configuration checks and by the server gate in `server/integrations.mjs`. The generated manifest records six remaining generic call sites across four reachable client files: SOAP note drafting (two), assessment-audit draft generation (two), medication-alert drafting (one) and nutrition-plan drafting (one). `src/components/client/AssessmentRecommendations.jsx`, `src/pages/TreatmentProtocols.jsx`, `src/components/reports/wizard-steps/SectionEditor.jsx` and `src/pages/ClientConditions.jsx` are removed from the inventory because their Core V1 paths contain no `InvokeLLM` call. Seven independently verified orphan report generators (`PDFFormFiller`, `DVAPatientCarePlan`, `GPSummary`, `PrivateHealthProgressReport`, `PrivateHealthInitialAssessment`, `CustomReportGenerator` and `Form32Generator`) are deleted; the routed `UnifiedReportWizard`, dual saved-report read path, `ClientReport` data and Core legacy adapter remain intact.

`CORE_V1_SANDBOX_ENABLED` is separately pinned to `0` in production and rollback, required as `0` by parity assurance, forbidden as an opaque Fly-secret override, and absent by default from local development. Its server gate covers `ALL /api/core/v1/*`; when off, those routes remain unmounted or return `404 CORE_NOT_FOUND`. This records a dormant engineering sandbox boundary, not production availability.

## Detection and monitoring

`npm run flags:check` verifies the registry, both generated manifests, Fly configurations, exact client-call-site inventory and notice grammar. Capability registry, rollback compatibility, flag-impact, preparation-workflow, parity-contract and deploy-workflow validator tests pin the reviewed disabled value. The public settings capability posture exposes `general_clinical_llm.available=false` when the server runs with this configuration. No live deployment or production observation is claimed by this notice.

## Restoration criteria

Do not restore this generic capability. Any future AI-assisted clinical function must be purpose-specific, server-owned, tenant-scoped, source-traceable, evaluated on frozen synthetic/public cases, independently reviewed, deliberately disabled until approved, and covered by a new capability notice and express production authority. Mission order `UM-AUTO-20260807-ASSESSSUITE-CORE-V1` authorises preparation and remediation only; the mandated stop immediately before live deployment remains in force.
