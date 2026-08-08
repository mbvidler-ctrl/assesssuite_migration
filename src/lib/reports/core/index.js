export {
  REPORT_TEMPLATE_REGISTRY_VERSION,
  REPORT_PURPOSES,
  REPORT_FUNDERS,
  REPORT_HORIZONS,
  createReportTemplateRegistry,
  listReportTemplates,
  normaliseReportFunder,
  reportTemplateRegistry,
  resolveReportTemplate,
} from "./templateRegistry.js";

export {
  REPORT_ARTIFACT_SCHEMA_VERSION,
  REPORT_COMPOSITION_ENGINE_VERSION,
  SOURCE_MANIFEST_SCHEMA_VERSION,
  CLAIM_LEDGER_SCHEMA_VERSION,
  REPORT_LIFECYCLE_STATES,
  buildDeterministicExportInput,
  canonicalStringify,
  composeReportDraft,
  createSourceManifest,
  stableFingerprint,
  transitionReportLifecycle,
} from "./reportCompositionEngine.js";

export {
  LEGACY_REPORT_COMPATIBILITY_VERSION,
  LEGACY_REPORT_COMPATIBILITY_CONTRACT,
  OUTCOME_TABLE_SLOT_TEXT,
  OUTCOME_TABLE_SLOT_HTML,
  buildLegacySavedReportPayload,
  createLegacyEditEnvelope,
  inspectLegacyRenderCompatibility,
  legacyPayloadFingerprint,
  recomposeLegacyReportHtml,
  reportHtmlFingerprint,
} from "./legacyCompatibility.js";
