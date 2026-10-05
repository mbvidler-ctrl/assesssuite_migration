// Report-type registry for the reporting-workflow demo.
//
// Dependency-free on purpose: the browser workspace imports this module for
// labels, section definitions and state vocabulary, and the server imports it
// as the single source of truth for template versions and requirement rules.
//
// Report types are deliberately limited to the two outputs the live
// UnifiedReportWizard already supports for physiotherapy (persisted ids
// PHYSIO_PROGRESS_REPORT and PHYSIO_REFERRER_UPDATE, see
// src/components/reports/UnifiedReportWizard.jsx REPORT_TEMPLATES). The
// section structure adapts the wizard's mandatory sections into the
// facts / interpretation / recommendations separation required by the
// product direction.

export const GENERATOR_VERSION = 'assesssuite-reporting-demo/0.1.0';

export const SECTION_KINDS = Object.freeze({
  facts: 'facts', // generated deterministically from the pinned SourceSet; not editable
  narrative: 'narrative', // clinician-authored, or an AI-assisted draft awaiting review
});

export const SECTION_ORIGINS = Object.freeze({
  facts: 'facts',
  clinician: 'clinician',
  aiAssisted: 'ai_assisted',
});

export const REVIEW_STATES = Object.freeze({
  notStarted: 'not_started',
  inProgress: 'in_progress',
  reviewed: 'reviewed',
  notApplicable: 'not_applicable',
});

export const REQUIREMENT_STATES = Object.freeze({
  present: 'present',
  missing: 'missing',
  unknown: 'unknown',
  notApplicable: 'not_applicable',
});

export const REQUIREMENTS = Object.freeze({
  referral_question: Object.freeze({
    label: 'Referral question and context',
    description: 'Who referred the patient, when, why, and what the recipient wants answered.',
  }),
  baseline_findings: Object.freeze({
    label: 'Baseline findings',
    description: 'Initial subjective and objective findings with a recorded completion state.',
  }),
  baseline_measures: Object.freeze({
    label: 'Baseline outcome measures',
    description: 'At least one completed instrument with a numeric score and date.',
  }),
  goals: Object.freeze({
    label: 'Goals',
    description: 'Agreed goals with baseline, target and current status.',
  }),
  progress_reassessment: Object.freeze({
    label: 'Progress and reassessment',
    description: 'A repeated measurement on a comparable instrument, with comparability limits stated.',
  }),
  interventions_delivered: Object.freeze({
    label: 'Interventions delivered',
    description: 'Encounters, treatments and management protocols recorded during the episode.',
  }),
  exposure_adherence: Object.freeze({
    label: 'Exposure and adherence',
    description: 'Home-program prescription and the recorded adherence or response.',
  }),
  clinical_rationale: Object.freeze({
    label: 'Clinical rationale',
    description: 'A recorded clinical impression or diagnosis that the clinician can interpret.',
  }),
  recommendations: Object.freeze({
    label: 'Recommendations and plan',
    description: 'A recorded current plan or next steps that the clinician can confirm.',
  }),
  risks_limitations: Object.freeze({
    label: 'Risks, precautions and limitations',
    description: 'Red-flag screen outcome, precautions and any restriction on activity.',
  }),
});

export const REQUIREMENT_KEYS = Object.freeze(Object.keys(REQUIREMENTS));

function section({ key, title, kind, required = true, factsGenerator = null, guidance = '', aiAllowed = false }) {
  return Object.freeze({
    key,
    title,
    kind,
    required,
    facts_generator: factsGenerator,
    guidance,
    ai_allowed: aiAllowed,
  });
}

export const REPORT_TYPES = Object.freeze({
  PHYSIO_PROGRESS_REPORT: Object.freeze({
    id: 'PHYSIO_PROGRESS_REPORT',
    label: 'Physiotherapy progress report',
    description: 'Baseline-to-current measures, functional change, goal progress and the next plan, for a funder or referrer.',
    template_version: 'physio-progress-report/1.0.0',
    audiences: Object.freeze(['funder', 'referrer', 'treating_team']),
    requirements: Object.freeze([
      'referral_question',
      'baseline_findings',
      'baseline_measures',
      'goals',
      'progress_reassessment',
      'interventions_delivered',
      'exposure_adherence',
      'clinical_rationale',
      'recommendations',
      'risks_limitations',
    ]),
    sections: Object.freeze([
      section({ key: 'referral_question', title: 'Referral question and context', kind: 'facts', factsGenerator: 'referral_question' }),
      section({ key: 'baseline_findings', title: 'Relevant history and baseline findings', kind: 'facts', factsGenerator: 'baseline_findings' }),
      section({ key: 'outcome_measures', title: 'Baseline versus current outcome measures', kind: 'facts', factsGenerator: 'outcome_measures' }),
      section({ key: 'goal_progress', title: 'Goal progress', kind: 'facts', factsGenerator: 'goal_progress' }),
      section({ key: 'management_delivered', title: 'Management delivered to date', kind: 'facts', factsGenerator: 'management_delivered' }),
      section({
        key: 'functional_change',
        title: 'Functional and participation change',
        kind: 'narrative',
        aiAllowed: true,
        guidance: 'Describe the change in function and participation since baseline. Refer to the recorded measures and goals; do not introduce findings that are not in the pinned sources.',
      }),
      section({
        key: 'clinical_interpretation',
        title: 'Clinical interpretation',
        kind: 'narrative',
        aiAllowed: true,
        guidance: 'State the clinical impression and the reasoning behind it. Separate what was measured from what is inferred. Note comparability limits where a measure has a single data point.',
      }),
      section({
        key: 'recommendations_plan',
        title: 'Recommendations and plan',
        kind: 'narrative',
        aiAllowed: true,
        guidance: 'State the proposed plan, reassessment timing and any request of the recipient. Recommendations are clinician decisions; they must not be presented as generated content.',
      }),
      section({ key: 'limitations_provenance', title: 'Limitations and provenance', kind: 'facts', factsGenerator: 'limitations_provenance' }),
    ]),
  }),
  PHYSIO_REFERRER_UPDATE: Object.freeze({
    id: 'PHYSIO_REFERRER_UPDATE',
    label: 'Physiotherapy referrer update',
    description: 'A concise clinical and functional update for the referrer or treating team.',
    template_version: 'physio-referrer-update/1.0.0',
    audiences: Object.freeze(['referrer', 'treating_team']),
    requirements: Object.freeze([
      'referral_question',
      'baseline_findings',
      'baseline_measures',
      'progress_reassessment',
      'interventions_delivered',
      'clinical_rationale',
      'recommendations',
      'risks_limitations',
    ]),
    sections: Object.freeze([
      section({ key: 'referral_question', title: 'Referral question and context', kind: 'facts', factsGenerator: 'referral_question' }),
      section({ key: 'objective_progress', title: 'Objective progress', kind: 'facts', factsGenerator: 'outcome_measures' }),
      section({ key: 'management_to_date', title: 'Management to date', kind: 'facts', factsGenerator: 'management_delivered' }),
      section({
        key: 'clinical_functional_update',
        title: 'Clinical and functional update',
        kind: 'narrative',
        aiAllowed: true,
        guidance: 'A concise update on symptoms, function and response to management, grounded in the pinned sources.',
      }),
      section({
        key: 'current_plan',
        title: 'Current plan',
        kind: 'narrative',
        aiAllowed: true,
        guidance: 'The current management plan and expected timeframe, as confirmed by the treating clinician.',
      }),
      section({
        key: 'questions_for_referrer',
        title: 'Questions or requests for the referrer',
        kind: 'narrative',
        required: false,
        guidance: 'Anything the referrer is asked to consider, investigate or authorise.',
      }),
      section({ key: 'limitations_provenance', title: 'Limitations and provenance', kind: 'facts', factsGenerator: 'limitations_provenance' }),
    ]),
  }),
});

export const REPORT_TYPE_IDS = Object.freeze(Object.keys(REPORT_TYPES));

export function getReportType(id) {
  return REPORT_TYPES[id] || null;
}

export const REQUEST_STATUSES = Object.freeze({
  requested: 'requested',
  assemblingEvidence: 'assembling_evidence',
  draft: 'draft',
  needsReview: 'needs_review',
  approved: 'approved',
  sent: 'sent',
  amendmentInProgress: 'amendment_in_progress',
  cancelled: 'cancelled',
});

export const STATUS_LABELS = Object.freeze({
  requested: 'Requested',
  assembling_evidence: 'Assembling evidence',
  draft: 'Draft',
  needs_review: 'Needs review',
  approved: 'Approved',
  sent: 'Sent (recorded manually)',
  amendment_in_progress: 'Amendment in progress',
  cancelled: 'Cancelled',
});

/** Statuses in which the draft may still be edited or refreshed. */
export const EDITABLE_STATUSES = Object.freeze(['draft', 'needs_review', 'amendment_in_progress']);

/** Statuses that hold an approved, immutable snapshot as the current output. */
export const APPROVED_STATUSES = Object.freeze(['approved', 'sent']);

export const RECIPIENT_ROLES = Object.freeze([
  'referring_gp',
  'specialist',
  'funder_case_manager',
  'employer_rehab_provider',
  'treating_team',
  'patient',
  'other',
]);

export const RECIPIENT_ROLE_LABELS = Object.freeze({
  referring_gp: 'Referring GP',
  specialist: 'Specialist',
  funder_case_manager: 'Funder or case manager',
  employer_rehab_provider: 'Employer or rehabilitation provider',
  treating_team: 'Treating team',
  patient: 'Patient',
  other: 'Other',
});

export const EVIDENCE_CATEGORIES = Object.freeze({
  client_summary: 'Patient summary (identity minimised)',
  referral: 'Referral',
  screening: 'Red-flag screen',
  examination: 'Examination',
  findings: 'Initial findings',
  goal: 'Goal',
  measurement: 'Outcome measurement',
  encounter: 'Encounter',
  note: 'Clinical note',
  protocol: 'Management protocol',
  home_program: 'Home program',
  prior_report: 'Prior report',
  document: 'Document',
});
