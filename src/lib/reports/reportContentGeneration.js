import { getProfession } from "../../../packages/profession-config/index.mjs";

const REPORT_SECTION_METADATA_SUFFIX = /_(?:ai_drafted|signature|attachments)$/i;

function resolveReportProfession(explicitProfessionId) {
  const runtimeProcess = Reflect.get(globalThis, "process");
  const professionId = explicitProfessionId
    || import.meta.env?.VITE_PROFESSION
    || runtimeProcess?.env?.PROFESSION;
  if (typeof professionId !== "string" || professionId.trim() === "") {
    throw new TypeError("report drafting requires an explicit profession target");
  }
  return getProfession(professionId.trim());
}

export const REPORT_PROMPT_LIMITS = Object.freeze({
  priorReports: 5,
  priorContextCharacters: 5_000,
  soapNotes: 10,
  soapFieldCharacters: 600,
  soapContextCharacters: 4_000,
});

export const REPORT_FORM_PROFILES = Object.freeze({
  workcover_pmp: Object.freeze({
    label: "Queensland Provider Management Plan",
    audience: "claims manager and treating team",
    purpose: "record injury-related function, measurable goals, barriers, requested services and return-to-work planning",
    targetWords: 900,
    rules: Object.freeze([
      "Use short field-ready answers rather than a general narrative.",
      "Quantify current capacity, work demand and planned dosage only when recorded.",
      "Do not repeat the mechanism, diagnosis or claim details across fields.",
    ]),
  }),
  sira_ahtr: Object.freeze({
    label: "NSW Allied Health Treatment Request",
    audience: "insurer and recovery team",
    purpose: "support a treatment request with measured function, recovery goals, barriers and planned services",
    targetWords: 850,
    rules: Object.freeze([
      "Answer the named AHTR section directly and keep supporting evidence adjacent to the claim it supports.",
      "Use recorded work and participation goals; do not infer approval, entitlement or capacity.",
      "Prefer values, dates and concise lists over repeated clinical history.",
    ]),
  }),
  dva_patient_care_plan: Object.freeze({
    label: "DVA Patient Care Plan",
    audience: "veteran, referrer and treating team",
    purpose: "document cycle goals, baseline measures, management and review plan",
    targetWords: 850,
    rules: Object.freeze([
      "Use measurable goals and preserve accepted-condition wording exactly when supplied.",
      "Keep the plan practical and cycle-specific; do not add unsupplied services or arrangements.",
    ]),
  }),
  dva_end_cycle_report: Object.freeze({
    label: "DVA End of Cycle Report",
    audience: "referrer and treating team",
    purpose: "summarise treatment delivered, measured change, current function and next-step recommendation",
    targetWords: 750,
    rules: Object.freeze([
      "Lead with measured change and goal status.",
      "State further-care reasoning once; do not repeat it in every section.",
    ]),
  }),
  medicare_referral_acceptance: Object.freeze({
    label: "Medicare referral acceptance",
    audience: "referring practitioner",
    purpose: "confirm receipt and state the planned initial service succinctly",
    targetWords: 150,
    rules: Object.freeze(["Use labelled lines or a very short letter; omit background not needed to confirm acceptance."]),
  }),
  medicare_initial: Object.freeze({
    label: "Medicare initial assessment report",
    audience: "referring practitioner",
    purpose: "communicate key findings, goals and the initial management plan",
    targetWords: 500,
    rules: Object.freeze(["Put the clinically actionable message first and avoid reproducing the complete assessment record."]),
  }),
  medicare_final: Object.freeze({
    label: "Medicare final report",
    audience: "referring practitioner",
    purpose: "communicate services delivered, measured outcomes and discharge or follow-up recommendations",
    targetWords: 500,
    rules: Object.freeze(["Use baseline-to-final values once and make the next action explicit."]),
  }),
  gp_summary: Object.freeze({
    label: "GP summary letter",
    audience: "general practitioner or specialist referrer",
    purpose: "provide a concise clinical update and a clear requested or recommended next action",
    targetWords: 300,
    rules: Object.freeze(["Put the key message in the first two sentences and omit routine detail that does not change management."]),
  }),
  ndis_initial: Object.freeze({
    label: "NDIS initial assessment report",
    audience: "participant and funding decision-maker",
    purpose: "describe recorded disability-related function, goals, baseline measures and proposed supports",
    targetWords: 1_200,
    rules: Object.freeze([
      "Link each proposed support to a recorded goal, functional limitation and supporting assessment.",
      "Do not assert eligibility, approval or value for money without supplied evidence.",
    ]),
  }),
  ndis_progress: Object.freeze({
    label: "NDIS progress report",
    audience: "participant and funding decision-maker",
    purpose: "show measured progress, residual functional needs and the next support plan",
    targetWords: 1_000,
    rules: Object.freeze(["Use goal-by-goal evidence and state missing or non-comparable baseline data explicitly."]),
  }),
  ndis_fce: Object.freeze({
    label: "NDIS functional capacity evaluation",
    audience: "participant and funding decision-maker",
    purpose: "record observed and measured capacity across relevant participation domains",
    targetWords: 1_500,
    rules: Object.freeze(["Separate measured capacity, reported difficulty and clinician interpretation in every domain."]),
  }),
  ndis_discharge: Object.freeze({
    label: "NDIS discharge or transition summary",
    audience: "participant and support team",
    purpose: "summarise outcomes, current function, self-management and transition needs",
    targetWords: 700,
    rules: Object.freeze(["Prioritise durable supports, unresolved needs and ownership of each next action."]),
  }),
});

export function resolveReportFormProfile(reportTypeKey) {
  if (typeof reportTypeKey !== "string" || reportTypeKey.trim() === "") return null;
  const exact = REPORT_FORM_PROFILES[reportTypeKey];
  if (exact) return exact;
  if (/(?:fce|fca|functional_capacity)/i.test(reportTypeKey)) {
    return Object.freeze({
      label: "Functional capacity report",
      audience: "clinical or funding decision-maker",
      purpose: "state measured tolerances, task demands and supported functional conclusions",
      targetWords: 1_500,
      rules: Object.freeze([
        "Separate measured performance, reported symptoms and interpretation.",
        "Do not infer effort reliability, causation or capacity beyond the tests supplied.",
      ]),
    });
  }
  if (/(?:progress|review)/i.test(reportTypeKey)) {
    return Object.freeze({
      label: "Progress report",
      audience: "referrer, funder or treating team",
      purpose: "show baseline-to-current change, goal progress, barriers and the next plan",
      targetWords: 900,
      rules: Object.freeze(["Use each measured value once and distinguish change from attribution."]),
    });
  }
  if (/(?:discharge|completion|final)/i.test(reportTypeKey)) {
    return Object.freeze({
      label: "Discharge or completion report",
      audience: "referrer, funder or treating team",
      purpose: "summarise services, outcomes, current function and follow-up",
      targetWords: 700,
      rules: Object.freeze(["Lead with goal and outcome status; keep the maintenance plan action-oriented."]),
    });
  }
  return null;
}

export function hasRecordedReportValue(value) {
  return value !== null
    && value !== undefined
    && !(typeof value === "string" && value.trim() === "");
}

export function limitReportText(value, maxCharacters = 1_000) {
  if (!hasRecordedReportValue(value)) return null;
  const limit = Number.isFinite(maxCharacters) && maxCharacters > 0
    ? Math.floor(maxCharacters)
    : 1_000;
  const text = typeof value === "string" ? value.trim() : JSON.stringify(value);
  if (!text || text.length <= limit) return text || null;
  if (limit === 1) return "…";
  return `${text.slice(0, limit - 1).trimEnd()}…`;
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function firstRecordedValue(...values) {
  return values.find(hasRecordedReportValue) ?? null;
}

function timeValue(value) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Convert persisted ClientAssessment rows into the small, stable shape sent
 * to report drafting. In particular, a measured zero is data, not absence.
 */
export function normaliseReportAssessments(assessments) {
  if (!Array.isArray(assessments)) return [];

  return assessments
    .filter((assessment) => assessment && typeof assessment === "object")
    .map((assessment) => {
      const additional = asObject(assessment.additional_data);
      const normativeComparison = firstRecordedValue(
        assessment.normative_comparison,
        additional.normative_comparison,
      );
      const interpretation = firstRecordedValue(
        assessment.interpretation,
        additional.interpretation,
      );

      return {
        name: limitReportText(
          firstRecordedValue(assessment.name, assessment.assessment_name, "Unknown Assessment"),
          200,
        ),
        date: firstRecordedValue(assessment.assessment_date, assessment.created_date),
        result: firstRecordedValue(assessment.result_value, assessment.result),
        unit: limitReportText(
          firstRecordedValue(assessment.unit_of_measure, additional.units, additional.unit),
          80,
        ),
        notes: limitReportText(firstRecordedValue(assessment.notes, additional.notes), 400),
        soap_text: limitReportText(firstRecordedValue(assessment.soap_text, additional.soap_text), 600),
        normative_comparison: limitReportText(normativeComparison, 300),
        interpretation: limitReportText(interpretation, 500),
        classification: limitReportText(
          firstRecordedValue(
            assessment.classification,
            additional.classification,
            interpretation,
            normativeComparison,
          ),
          500,
        ),
      };
    })
    .sort((a, b) => timeValue(b.date) - timeValue(a.date));
}

export function buildReportAssessmentSummary(assessments) {
  if (!Array.isArray(assessments) || assessments.length === 0) {
    return "No assessment results available.";
  }

  return [
    "Test | Date | Result | Normative Range | Classification",
    "-----|------|--------|-----------------|---------------",
    ...assessments.map((assessment) => {
      const result = hasRecordedReportValue(assessment?.result)
        ? `${assessment.result}${hasRecordedReportValue(assessment?.unit) ? ` ${assessment.unit}` : ""}`
        : "Not recorded";
      return [
        assessment?.name || "Unknown Assessment",
        assessment?.date || "Not recorded",
        result,
        assessment?.normative_comparison || "—",
        assessment?.classification || "—",
      ].join(" | ");
    }),
  ].join("\n");
}

function isClinicalSectionEntry([key, value]) {
  const lowerKey = typeof key === "string" ? key.toLowerCase() : "";
  return typeof key === "string"
    && !REPORT_SECTION_METADATA_SUFFIX.test(key)
    && !lowerKey.includes("signature")
    && !lowerKey.includes("attachment")
    && typeof value === "string"
    && value.trim() !== "";
}

/**
 * Prior report blobs also contain booleans, signatures and attachment arrays.
 * Only clinician-authored section text is relevant drafting context.
 */
export function buildPriorReportContext(priorReports, {
  maxReports = REPORT_PROMPT_LIMITS.priorReports,
  maxSectionCharacters = 300,
  maxTotalCharacters = REPORT_PROMPT_LIMITS.priorContextCharacters,
} = {}) {
  if (!Array.isArray(priorReports) || priorReports.length === 0) return null;

  const reportLimit = Number.isFinite(maxReports) && maxReports > 0
    ? Math.floor(maxReports)
    : REPORT_PROMPT_LIMITS.priorReports;
  const limit = Number.isFinite(maxSectionCharacters) && maxSectionCharacters > 0
    ? Math.floor(maxSectionCharacters)
    : 300;
  const totalLimit = Number.isFinite(maxTotalCharacters) && maxTotalCharacters > 0
    ? Math.floor(maxTotalCharacters)
    : REPORT_PROMPT_LIMITS.priorContextCharacters;

  const newestFirst = priorReports
    .map((report, index) => ({ report, index }))
    .sort((a, b) => timeValue(b.report?.report_date) - timeValue(a.report?.report_date) || a.index - b.index)
    .slice(0, reportLimit)
    .map(({ report }) => report);

  const context = newestFirst.map((report) => {
    const sectionContent = asObject(report?.section_content);
    const sections = Object.entries(sectionContent)
      .filter(isClinicalSectionEntry)
      .map(([key, value]) => `  ${key}: ${value.trim().slice(0, limit)}`)
      .join("\n");
    const label = report?.report_name || "Prior report";
    const date = report?.report_date || "Date not recorded";
    return `--- ${label} (${date}) ---\n${sections || "No section content available."}`;
  }).join("\n\n");
  return limitReportText(context, totalLimit);
}

export function buildSoapReportContext(soapNotes, {
  maxNotes = REPORT_PROMPT_LIMITS.soapNotes,
  maxFieldCharacters = REPORT_PROMPT_LIMITS.soapFieldCharacters,
  maxTotalCharacters = REPORT_PROMPT_LIMITS.soapContextCharacters,
} = {}) {
  if (!Array.isArray(soapNotes) || soapNotes.length === 0) return null;
  const noteLimit = Number.isFinite(maxNotes) && maxNotes > 0
    ? Math.floor(maxNotes)
    : REPORT_PROMPT_LIMITS.soapNotes;
  const fieldLimit = Number.isFinite(maxFieldCharacters) && maxFieldCharacters > 0
    ? Math.floor(maxFieldCharacters)
    : REPORT_PROMPT_LIMITS.soapFieldCharacters;
  const totalLimit = Number.isFinite(maxTotalCharacters) && maxTotalCharacters > 0
    ? Math.floor(maxTotalCharacters)
    : REPORT_PROMPT_LIMITS.soapContextCharacters;

  const newestFirst = soapNotes
    .map((note, index) => ({ note, index }))
    .sort((a, b) => timeValue(b.note?.note_date) - timeValue(a.note?.note_date) || a.index - b.index)
    .slice(0, noteLimit)
    .map(({ note }) => note);
  const context = newestFirst.map((note) => [
    `[${note?.note_date || "Date unknown"}]`,
    `S: ${limitReportText(note?.subjective, fieldLimit) || ""}`,
    `O: ${limitReportText(note?.objective, fieldLimit) || ""}`,
    `A: ${limitReportText(note?.assessment, fieldLimit) || ""}`,
    `P: ${limitReportText(note?.plan, fieldLimit) || ""}`,
  ].join("\n")).join("\n---\n");
  return limitReportText(context, totalLimit);
}

export function isDraftableReportSection(section) {
  if (typeof section !== "string" || section.trim() === "") return false;
  const lower = section.toLowerCase();
  return !lower.includes("signature") && !lower.includes("attachment");
}

export function getDraftableReportSections(sections) {
  if (!Array.isArray(sections)) return [];
  return [...new Set(sections.filter(isDraftableReportSection))];
}

export function findReportOutcomeSection(sections) {
  return getDraftableReportSections(sections).find((section) => /outcome/i.test(section)) || null;
}

export function buildReportBatchSchema(sections) {
  const eligibleSections = getDraftableReportSections(sections);
  return {
    type: "object",
    properties: Object.fromEntries(
      eligibleSections.map((section) => [section, { type: "string", minLength: 1 }]),
    ),
    required: eligibleSections,
    additionalProperties: false,
  };
}

function guidanceWordLimit(guidance, meta) {
  if (Number.isFinite(guidance?.maxWords) && guidance.maxWords > 0) {
    return Math.floor(guidance.maxWords);
  }
  const text = `${guidance?.prompt || ""} ${guidance?.hint || ""}`;
  const patterns = [
    /write\s+max(?:imum)?\s+(\d+)\s+words(?:\s+total)?(?:[.,;]|$)/i,
    /max(?:imum)?\s+(\d+)\s+words\s+total(?:[.,;]|$)/i,
    /max(?:imum)?\s+(\d+)\s+words(?:[.,;]|$)/i,
    /no\s+more\s+than\s+(\d+)\s+words\s+for\s+this\s+section/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  if (meta?.key === "short_referral_letter") return 100;
  if (meta?.key === "functional_capacity_evaluation") return 250;
  return 200;
}

function stripReportFiller(text, section) {
  const escapedSection = String(section || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(new RegExp(`^\\s*(?:#{1,6}\\s*|\\*{1,2})?${escapedSection}(?:\\*{1,2})?\\s*:?\\s*(?:\\r?\\n)+`, "i"), "")
    .replace(/^\s*(?:this report (?:aims|provides|outlines)|the purpose of this (?:report|section) is)[^.]*\.\s*/i, "")
    .replace(/(?:\r?\n)+\s*(?:please do not hesitate to contact[^\n]*|kind regards|yours sincerely|sincerely)\s*$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncateReportWords(text, maxWords) {
  const words = [...text.matchAll(/\S+/g)];
  if (words.length <= maxWords) return text;
  const populatedLines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const tableRows = populatedLines.filter((line) => line.includes("|")).length;
  const labelledRows = populatedLines.filter((line) => /^[A-Za-z][^:\n]{0,80}:\s*\S/.test(line)).length;
  // Tables and form-labelled rows are data-bearing structure, not verbosity.
  // Cutting from their tail can silently remove an assessment, NDIS domain or
  // required form field while leaving output that appears complete.
  if (tableRows >= 2 || (labelledRows >= 3 && labelledRows / populatedLines.length >= 0.6)) {
    return text;
  }
  const hardEnd = words[maxWords - 1].index + words[maxWords - 1][0].length;
  const prefix = text.slice(0, hardEnd);
  const minimumUsefulEnd = words[Math.max(0, Math.floor(maxWords * 0.72) - 1)]?.index || 0;
  const boundaryCandidates = [prefix.lastIndexOf("\n"), prefix.lastIndexOf(". "), prefix.lastIndexOf("; ")]
    .filter((index) => index >= minimumUsefulEnd);
  const cleanEnd = boundaryCandidates.length > 0 ? Math.max(...boundaryCandidates) + 1 : hardEnd;
  return prefix.slice(0, cleanEnd).trimEnd();
}

export function normaliseReportSectionOutput(value, {
  section = "",
  guidance = null,
  meta = null,
} = {}) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Report drafting omitted content for: ${section || "section"}`);
  }
  const cleaned = stripReportFiller(value, section);
  if (!cleaned) throw new Error(`Report drafting omitted content for: ${section || "section"}`);
  return truncateReportWords(cleaned, guidanceWordLimit(guidance, meta));
}

export function validateReportBatchResponse(response, sections, {
  sectionGuidance = {},
  meta = null,
} = {}) {
  const eligibleSections = getDraftableReportSections(sections);
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new Error("Report drafting returned an invalid response.");
  }

  const invalidSections = eligibleSections.filter(
    (section) => typeof response[section] !== "string" || response[section].trim() === "",
  );
  if (invalidSections.length > 0) {
    throw new Error(`Report drafting omitted content for: ${invalidSections.join(", ")}`);
  }

  return Object.fromEntries(
    eligibleSections.map((section) => [section, normaliseReportSectionOutput(response[section], {
      section,
      guidance: sectionGuidance?.[section],
      meta,
    })]),
  );
}

const CLINICAL_WRITING_RULES = `CLINICAL WRITING RULES — FOLLOW STRICTLY:

1. SOURCE FIDELITY:
   - The supplied client record, assessment results, prior reports and SOAP notes are the only factual sources.
   - Preserve recorded dates, values and units exactly, including a measured value of 0.
   - Never invent a diagnosis, symptom, normative range, practitioner, referrer, attendance rate, funding code, service, recommendation detail or clinical event.
   - If information required by a section is unavailable, omit it or state "Not documented in the available record." Do not guess.
   - Distinguish client-reported information from measured, observed and clinician-interpreted information.

2. WORD LIMITS — enforce without exception:
   - Referral acceptance / confirmation letters: max 150 words total
   - GP/specialist summary letters: max 300 words total
   - Individual progress, initial, or discharge report sections: max 200 words per section
   - FCE / functional capacity sections: max 250 words per section
   - Treatment plan / care plan sections: max 200 words per section
   Stop at the limit. Do not pad to fill space.

3. NO REPETITION:
   - Put each clinical fact in the most relevant section once.
   - Do not restate diagnosis, DOB, background or assessment values in multiple sections.
   - Where a cross-reference is essential, refer to the relevant finding without repeating its values.

4. STRUCTURE — use the most scannable format for the content type:
   - Assessment results: plain text table (Test | Result | Norm | Interpretation)
   - Goal progress: one line per goal (Goal -> Baseline -> Current -> Rating)
   - Recommendations: numbered list with frequency/hours on every line, but only when recorded or supportable from the supplied facts
   - Barriers: plain hyphens as bullet points, one per line
   - Prose paragraphs: only for narrative sections (background, prognosis, clinical reasoning)

5. GOAL AND FUNCTION LINKING:
   - Explain the functional significance of a finding only where the record supports that link.
   - Link measured change to a recorded client goal or functional outcome where available.
   - Use progress ratings only where baseline and current evidence supports the rating.

6. FUNDER AUDIENCE — adjust tone and terminology to the report type:
   - NDIS: ICF language and support domains; include line item codes only if supplied
   - WorkCover / RTW: work capacity, recorded job demands, RTW timeline and barriers
   - Medicare / DVA: chronic disease management, functional change and cycle justification
   - FCE / Legal: consistency of effort, reliability of results and overall work capacity
   - GP letter: plain clinical English, key message in the first two sentences
   - International programmes and insurers: use the named programme terminology only where supported by the record

7. SIGN-OFF READINESS:
   - Do not generate a practitioner identity, signature or sign-off; AssessSuite inserts the configured sign-off separately.
   - Use explicit recorded dates rather than "recently" or "previously".
   - Include units with every recorded number where a unit is available.

8. EXCLUDE:
   - Preamble ("This report aims to...", "It is my pleasure to...")
   - Sign-offs ("Please do not hesitate to contact me...")
   - Repeated section headers within body text
   - Unsupported causal, diagnostic or prognostic claims
   - Generic filler ("The client has been working hard toward their goals")`;

function formatSectionRequirements(sections, sectionGuidance, outcomeSection) {
  return sections.map((section) => {
    const guidance = asObject(sectionGuidance?.[section]);
    const requirements = typeof guidance.prompt === "string" && guidance.prompt.trim()
      ? guidance.prompt.trim()
      : "Write concise clinician-to-clinician content appropriate to this section.";
    const wordLimit = Number.isFinite(guidance.maxWords)
      ? `\n- Write no more than ${guidance.maxWords} words for this section.`
      : "";
    const outcomeRule = section === outcomeSection
      ? "\n- A verified deterministic outcome comparison table is inserted automatically beneath this heading. Provide concise clinical interpretation only; do not recreate the table or repeat its row values."
      : "";
    return `SECTION: ${section}\n${requirements}${wordLimit}${outcomeRule}`;
  }).join("\n\n");
}

/** Build the prompt used by both single-section and atomic whole-report drafting. */
export function buildReportDraftPrompt({
  professionId = undefined,
  reportTitle,
  reportTypeKey,
  clientContext,
  assessmentSummary,
  priorReportContext,
  soapContext,
  sections,
  sectionGuidance,
  meta,
  outcomeSection,
}) {
  const activeProfession = resolveReportProfession(professionId);
  const eligibleSections = getDraftableReportSections(sections);
  if (eligibleSections.length === 0) {
    throw new Error("At least one report section is required for drafting.");
  }

  const title = reportTitle || reportTypeKey || "Clinical Report";
  const isBatch = eligibleSections.length > 1;
  const metaInstruction = meta && typeof meta.ai_instruction === "string"
    ? `\nREPORT FORMAT GUIDANCE (${meta.label || "report"}${meta.recommended_length_pages ? ` — target ${meta.recommended_length_pages} page${meta.recommended_length_pages > 1 ? "s" : ""}` : ""}):\n${meta.ai_instruction}\n`
    : "";
  const formProfile = resolveReportFormProfile(reportTypeKey);
  const formProfileInstruction = formProfile
    ? `\nFORM-SPECIFIC OUTPUT PROFILE:\n- Template: ${formProfile.label}\n- Audience: ${formProfile.audience}\n- Purpose: ${formProfile.purpose}\n- Whole-report target: no more than ${formProfile.targetWords} words unless a named field imposes a lower limit.\n${formProfile.rules.map((rule) => `- ${rule}`).join("\n")}\n- Missing required fact: write exactly "Not documented in the available record."; never fill the gap by inference.\n`
    : "";
  const sectionRequirements = formatSectionRequirements(
    eligibleSections,
    sectionGuidance,
    outcomeSection,
  );
  const outputInstruction = isBatch
    ? `Draft every section in one coordinated pass. Return one JSON string property for each exact section name supplied by the response schema. Plan the allocation of facts before writing so sections do not duplicate one another. Each property value must be plain text: no HTML, no markdown headings and no code fences.`
    : `Write ONLY the "${eligibleSections[0]}" section. Return ONLY plain text — no HTML, no markdown headings and no code fences. Plain hyphens and pipe-delimited tables are permitted where the section requires them.`;

  const promptClientContext = { ...asObject(clientContext), assessments: undefined };
  const clientBlock = limitReportText(JSON.stringify(promptClientContext, null, 2), 5_000) || "{}";
  const assessmentBlock = limitReportText(assessmentSummary, 4_500) || "No assessment results available.";
  const priorBlock = limitReportText(priorReportContext, 5_000);
  const soapBlock = limitReportText(soapContext, 3_000);
  const requirementsBlock = limitReportText(sectionRequirements, 4_500) || sectionRequirements;
  const boundedMetaInstruction = limitReportText(metaInstruction, 1_000) || "";

  return `You are an expert ${activeProfession.clinicalPromptRole} drafting ${isBatch ? "a complete set of sections" : "one section"} for a ${activeProfession.disciplineName.toLowerCase()} clinical report.

REPORT TYPE: ${title}
SECTIONS TO DRAFT:
${eligibleSections.map((section) => `- ${section}`).join("\n")}
${boundedMetaInstruction}${formProfileInstruction}
CLIENT INFORMATION:
${clientBlock}

ASSESSMENT RESULTS:
${assessmentBlock}

${priorBlock ? `PRIOR REPORTS FOR THIS CLIENT (use only for documented continuity and progress):\n${priorBlock}\n\n` : ""}${soapBlock ? `RECENT SOAP / SESSION NOTES (use only as evidence of treatment actually delivered):\n${soapBlock}\n\n` : ""}SECTION-SPECIFIC REQUIREMENTS:
${requirementsBlock}

${CLINICAL_WRITING_RULES}

OUTPUT REQUIREMENT:
${outputInstruction}`;
}
