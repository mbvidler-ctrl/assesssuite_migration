// AssessSuite Core V1 report-template registry.
//
// Templates are deliberately data-only. They describe the clinical/reporting
// contract but do not contain prompts, call a model, or render HTML. A caller
// must select a purpose, funder and reporting horizon explicitly (or provide a
// stable template/legacy identifier), which prevents a generic report path
// from silently applying the wrong funder contract.

export const REPORT_TEMPLATE_REGISTRY_VERSION = "2026-08-08.1";

export const REPORT_PURPOSES = Object.freeze([
  "referral_update",
  "initial_assessment",
  "progress_review",
  "end_of_cycle",
  "functional_capacity",
  "custom",
]);

export const REPORT_FUNDERS = Object.freeze([
  "gp",
  "medicare",
  "dva",
  "workers_compensation",
  "ndis",
  "private_health",
  "general",
  "custom",
]);

export const REPORT_HORIZONS = Object.freeze([
  "point_in_time",
  "reporting_period",
  "episode_to_date",
  "end_of_cycle",
]);

const FUNDER_ALIASES = Object.freeze({
  gp: "gp",
  referrer: "gp",
  medicare: "medicare",
  dva: "dva",
  workcover: "workers_compensation",
  workers_compensation: "workers_compensation",
  workerscompensation: "workers_compensation",
  sira: "workers_compensation",
  worksafe: "workers_compensation",
  tac: "workers_compensation",
  maic: "workers_compensation",
  ctp: "workers_compensation",
  ndis: "ndis",
  private: "private_health",
  private_health: "private_health",
  general: "general",
  custom: "custom",
});

function normaliseToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function normaliseReportFunder(value) {
  const token = normaliseToken(value);
  return FUNDER_ALIASES[token] || token;
}

function clonePlain(value) {
  if (Array.isArray(value)) return value.map(clonePlain);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clonePlain(item)]));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function section(key, heading, { required = true, outcomeTable = false } = {}) {
  return { key, heading, required, outcomeTable };
}

const DEFAULT_REPORT_TEMPLATES = [
  {
    key: "gp.referral-update.point-in-time.v1",
    version: 1,
    title: "GP Summary Letter",
    purpose: "referral_update",
    funder: "gp",
    horizon: "point_in_time",
    legacyReportType: "GP_SUMMARY_LETTER",
    legacyAliases: ["gp_summary", "gp_progress_letter", "ep_referral_letter", "treating_team_update"],
    sections: [
      section("reason_for_referral", "Reason for Referral"),
      section("assessment_findings", "Clinical Assessment Findings"),
      section("outcome_measures", "Baseline Outcome Measures & Results", { outcomeTable: true }),
      section("intervention_and_progress", "Intervention and Progress"),
      section("recommendations", "Recommendations & Next Steps"),
      section("provider_signature", "Provider Signature", { required: false }),
    ],
  },
  {
    key: "medicare.initial-assessment.point-in-time.v1",
    version: 1,
    title: "Medicare Initial Assessment",
    purpose: "initial_assessment",
    funder: "medicare",
    horizon: "point_in_time",
    legacyReportType: "MEDICARE_INITIAL_ASSESSMENT",
    legacyAliases: ["medicare_initial"],
    sections: [
      section("reason_for_referral", "Reason for Referral"),
      section("history_and_medications", "Relevant Medical History & Current Medications"),
      section("assessment_findings", "Baseline Assessment Findings & Outcome Measures", { outcomeTable: true }),
      section("client_goals", "Client Goals"),
      section("management_plan", "Proposed Management Plan"),
      section("clinical_comments", "Interpretation & Clinical Comments"),
      section("provider_signature", "Provider Signature", { required: false }),
    ],
  },
  {
    key: "dva.end-of-cycle.end-of-cycle.v1",
    version: 1,
    title: "DVA End of Cycle Report",
    purpose: "end_of_cycle",
    funder: "dva",
    horizon: "end_of_cycle",
    legacyReportType: "DVA_END_OF_CYCLE_REPORT",
    legacyAliases: ["dva_end_cycle_report"],
    sections: [
      section("intervention_summary", "Summary of Intervention Provided"),
      section("outcome_measures", "Outcome Measures (baseline vs end of cycle results)", { outcomeTable: true }),
      section("goal_progress", "Response to Treatment & Progress Against Goals"),
      section("functional_status", "Current Functional Status"),
      section("barriers_and_risks", "Barriers / Risks Encountered"),
      section("recommendations", "Recommendations & Next Steps"),
      section("further_treatment", "Justification for Further Treatment", { required: false }),
      section("provider_signature", "Provider Signature", { required: false }),
    ],
  },
  {
    key: "workers-compensation.progress-review.reporting-period.v1",
    version: 1,
    title: "Workers Compensation Progress Report",
    purpose: "progress_review",
    funder: "workers_compensation",
    horizon: "reporting_period",
    legacyReportType: "WORKCOVER_PROGRESS_REPORT",
    legacyAliases: [
      "workcover_progress",
      "sira_progress",
      "worksafe_vic_progress",
      "rtwsa_progress",
      "wa_workcover_progress",
      "tac_progress",
      "maic_progress",
      "ctp_progress",
    ],
    sections: [
      section("treatment_summary", "Summary of Treatment Provided to Date"),
      section("outcome_measures", "Outcome Measures (baseline vs current results)", { outcomeTable: true }),
      section("goal_progress", "Progress Against Goals"),
      section("work_capacity", "Current Work Capacity & Duties"),
      section("barriers_and_risks", "Barriers / Setbacks"),
      section("next_period_plan", "Plan for Next Treatment Period"),
      section("rtw_recommendations", "Updated Return to Work Recommendations"),
      section("provider_signature", "Provider Signature", { required: false }),
    ],
  },
  {
    key: "ndis.progress-review.reporting-period.v1",
    version: 1,
    title: "NDIS Progress Report",
    purpose: "progress_review",
    funder: "ndis",
    horizon: "reporting_period",
    legacyReportType: "NDIS_PROGRESS_REPORT",
    legacyAliases: ["ndis_progress"],
    sections: [
      section("support_summary", "Summary of Supports Delivered"),
      section("outcome_measures", "Outcome Measures (baseline vs current)", { outcomeTable: true }),
      section("goal_progress", "Progress Against Participant Goals"),
      section("functional_impact", "Current Functional Impact"),
      section("barriers_and_risks", "Barriers and Risks"),
      section("recommendations", "Recommendations for Next Plan Period"),
      section("provider_signature", "Provider Signature", { required: false }),
    ],
  },
  {
    key: "private-health.progress-review.reporting-period.v1",
    version: 1,
    title: "Private Health Progress Report",
    purpose: "progress_review",
    funder: "private_health",
    horizon: "reporting_period",
    legacyReportType: "PRIVATE_HEALTH_PROGRESS_REPORT",
    legacyAliases: ["private_health_progress"],
    sections: [
      section("treatment_summary", "Summary of Treatment to Date"),
      section("outcome_measures", "Outcome Measures (baseline vs current results)", { outcomeTable: true }),
      section("goal_progress", "Progress Against Goals"),
      section("functional_capacity", "Current Functional Capacity"),
      section("next_period_plan", "Plan for Next Treatment Period"),
      section("recommendations", "Recommendations"),
      section("provider_signature", "Provider Signature", { required: false }),
    ],
  },
  {
    key: "general.progress-review.reporting-period.v1",
    version: 1,
    title: "Progress Report",
    purpose: "progress_review",
    funder: "general",
    horizon: "reporting_period",
    legacyReportType: "PROGRESS_NOTE",
    legacyAliases: ["progress_note", "custom_progress_report"],
    sections: [
      section("reason_for_report", "Reason for Report"),
      section("treatment_summary", "Summary of Treatment to Date"),
      section("outcome_measures", "Outcome Measures (baseline vs current)", { outcomeTable: true }),
      section("current_status", "Current Status & Progress"),
      section("goal_progress", "Goals Update"),
      section("next_period_plan", "Plan Going Forward"),
      section("provider_signature", "Provider Signature", { required: false }),
    ],
  },
  {
    key: "general.functional-capacity.point-in-time.v1",
    version: 1,
    title: "Functional Capacity Evaluation",
    purpose: "functional_capacity",
    funder: "general",
    horizon: "point_in_time",
    legacyReportType: "FUNCTIONAL_CAPACITY_EVALUATION",
    legacyAliases: ["ndis_fce", "legal_fce", "tac_functional", "nz_acc_fce", "uk_fce"],
    sections: [
      section("referral_and_scope", "Referral Details and Scope"),
      section("methods", "Assessment Methods"),
      section("outcome_measures", "Objective Findings & Outcome Measures", { outcomeTable: true }),
      section("functional_tolerances", "Functional Tolerances and Limitations"),
      section("consistency_and_limits", "Consistency, Limitations and Qualifications"),
      section("recommendations", "Recommendations"),
      section("provider_signature", "Provider Signature", { required: false }),
    ],
  },
  {
    key: "custom.custom.reporting-period.v1",
    version: 1,
    title: "Custom Report",
    purpose: "custom",
    funder: "custom",
    horizon: "reporting_period",
    legacyReportType: "CUSTOM_REPORT",
    legacyAliases: ["custom_report"],
    sections: [
      section("purpose", "Purpose of Report"),
      section("background", "Background"),
      section("assessment_findings", "Assessment Findings & Results", { outcomeTable: true }),
      section("plan_and_recommendations", "Plan / Recommendations"),
      section("provider_signature", "Provider Signature", { required: false }),
    ],
  },
];

function validateSection(templateKey, candidate, seenKeys) {
  if (!candidate || typeof candidate !== "object") {
    throw new TypeError(`Template ${templateKey} contains a non-object section.`);
  }
  const key = normaliseToken(candidate.key);
  if (!key || !String(candidate.heading || "").trim()) {
    throw new TypeError(`Template ${templateKey} contains a section without a key or heading.`);
  }
  if (seenKeys.has(key)) throw new TypeError(`Template ${templateKey} repeats section key ${key}.`);
  seenKeys.add(key);
  return {
    key,
    heading: String(candidate.heading).trim(),
    required: candidate.required !== false,
    outcomeTable: candidate.outcomeTable === true,
  };
}

function validateTemplate(candidate) {
  if (!candidate || typeof candidate !== "object") throw new TypeError("Report template must be an object.");
  const key = String(candidate.key || "").trim();
  const purpose = normaliseToken(candidate.purpose);
  const funder = normaliseReportFunder(candidate.funder);
  const horizon = normaliseToken(candidate.horizon);
  const legacyReportType = String(candidate.legacyReportType || "").trim();
  const version = Number(candidate.version);
  if (!key || !String(candidate.title || "").trim() || !legacyReportType) {
    throw new TypeError("Each report template requires key, title and legacyReportType.");
  }
  if (!Number.isInteger(version) || version < 1) throw new TypeError(`Template ${key} has an invalid version.`);
  if (!REPORT_PURPOSES.includes(purpose)) throw new TypeError(`Template ${key} has unknown purpose ${purpose}.`);
  if (!REPORT_FUNDERS.includes(funder)) throw new TypeError(`Template ${key} has unknown funder ${funder}.`);
  if (!REPORT_HORIZONS.includes(horizon)) throw new TypeError(`Template ${key} has unknown horizon ${horizon}.`);
  const seenSections = new Set();
  const sections = (candidate.sections || []).map((item) => validateSection(key, item, seenSections));
  if (!sections.some((item) => item.required)) throw new TypeError(`Template ${key} needs a required section.`);
  return {
    key,
    version,
    title: String(candidate.title).trim(),
    purpose,
    funder,
    horizon,
    legacyReportType,
    legacyAliases: Array.from(new Set((candidate.legacyAliases || []).map(normaliseToken).filter(Boolean))).sort(),
    sections,
  };
}

export function createReportTemplateRegistry(definitions, { registryVersion = REPORT_TEMPLATE_REGISTRY_VERSION } = {}) {
  const templates = (definitions || []).map(validateTemplate);
  const byKey = new Map();
  const byLegacy = new Map();
  const byCoordinates = new Map();

  for (const template of templates) {
    if (byKey.has(template.key)) throw new TypeError(`Duplicate report template key ${template.key}.`);
    byKey.set(template.key, deepFreeze(template));

    const aliases = Array.from(new Set([template.legacyReportType, ...template.legacyAliases].map(normaliseToken)));
    for (const alias of aliases) {
      if (byLegacy.has(alias)) throw new TypeError(`Duplicate legacy report alias ${alias}.`);
      byLegacy.set(alias, template);
    }

    const coordinate = `${template.purpose}|${template.funder}|${template.horizon}`;
    if (byCoordinates.has(coordinate)) throw new TypeError(`Duplicate report-template coordinates ${coordinate}.`);
    byCoordinates.set(coordinate, template);
  }

  /** @param {any} selector */
  const resolve = (selector = {}) => {
    const { templateKey, legacyReportType, purpose, funder, horizon, allowGeneralFallback = false } = selector;
    let match = null;
    if (templateKey) match = byKey.get(String(templateKey).trim()) || null;
    if (!match && legacyReportType) match = byLegacy.get(normaliseToken(legacyReportType)) || null;
    if (!match && purpose && funder && horizon) {
      const normalisedPurpose = normaliseToken(purpose);
      const normalisedFunder = normaliseReportFunder(funder);
      const normalisedHorizon = normaliseToken(horizon);
      match = byCoordinates.get(`${normalisedPurpose}|${normalisedFunder}|${normalisedHorizon}`) || null;
      if (!match && allowGeneralFallback) {
        match = byCoordinates.get(`${normalisedPurpose}|general|${normalisedHorizon}`) || null;
      }
    }
    if (!match) {
      throw new RangeError("No report template matches the supplied key, legacy type, or purpose/funder/horizon coordinates.");
    }
    return clonePlain(match);
  };

  return Object.freeze({
    version: String(registryVersion),
    resolve,
    list: () => templates.map(clonePlain),
  });
}

export const reportTemplateRegistry = createReportTemplateRegistry(DEFAULT_REPORT_TEMPLATES);

export function resolveReportTemplate(selector) {
  return reportTemplateRegistry.resolve(selector);
}

export function listReportTemplates() {
  return reportTemplateRegistry.list();
}
