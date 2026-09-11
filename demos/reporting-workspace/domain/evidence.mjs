// Evidence catalogue and requirement-based completeness.
//
// buildEvidenceCatalogue() turns the raw episode context (client, care
// episode, completed assessments, catalogue definitions, SOAP notes, prior
// reports and documents) into addressable, content-hashed evidence items.
// assessCompleteness() evaluates a report type's requirements against that
// catalogue and states, per requirement, whether evidence is present,
// missing, unknown or not applicable, and why.
//
// Two rules govern this module:
//   1. Nothing is invented. A field that is absent is reported as missing or
//      unknown; a filled field is evidence that something was recorded, not
//      proof that it was verified.
//   2. Everything is deterministic. The same context produces the same
//      catalogue, the same hashes and the same completeness assessment.

import { REQUIREMENTS, REQUIREMENT_STATES, getReportType } from './reportTypes.mjs';
import {
  WorkflowError,
  dateOnly,
  isPlainObject,
  sha256Canonical,
  sortBy,
  toFiniteNumber,
  trimmedString,
} from './util.mjs';

const IDENTIFYING_CLIENT_KEYS = /^(?:email|phone|mobile|address|date_of_birth|dob|medicare|dva|ndis|mrn|urn|emergency|next_of_kin)/i;

function text(value, max = 2000) {
  return trimmedString(typeof value === 'string' ? value : value == null ? '' : String(value), { max });
}

/**
 * The patient summary pinned into a SourceSet carries the display name and
 * referral context only. Contact, date-of-birth, funding-identifier and
 * next-of-kin fields are never copied, so the pinned copy cannot leak them.
 */
function minimiseClientSummary(client) {
  const summary = {
    display_name: text(client.full_name) || 'Patient',
    referral_source: text(client.referral_source),
    referral_reason: text(client.referral_reason),
    funding_source: text(client.funding_source),
    synthetic: client.synthetic === true,
  };
  const leaked = Object.keys(summary).filter((key) => IDENTIFYING_CLIENT_KEYS.test(key));
  if (leaked.length > 0) {
    throw new WorkflowError(500, 'client_summary_minimisation_failed', 'The patient summary would carry an identifying field.');
  }
  return summary;
}

function item({ sourceId, category, entity, recordId, path = '', label, recordedAt = '', recordVersion = '', content, aiAssisted = false, aiAttribution = null, flags = [] }) {
  const safeContent = isPlainObject(content) || Array.isArray(content) ? content : { value: content ?? null };
  return {
    source_id: sourceId,
    category,
    entity,
    record_id: recordId,
    path,
    label,
    recorded_at: dateOnly(recordedAt),
    record_version: recordVersion || '',
    content: safeContent,
    content_sha256: sha256Canonical(safeContent),
    ai_assisted: aiAssisted,
    ai_attribution: aiAttribution,
    flags,
  };
}

function scopeMismatch(record, { orgId, clientId, episodeId }, label) {
  if (!record || typeof record !== 'object') return true;
  if (record.org_id !== orgId) return true;
  if (record.client_id !== clientId) return true;
  if (record.physio_care_episode_id !== episodeId) return true;
  void label;
  return false;
}

/**
 * Build the evidence catalogue for one care episode.
 *
 * @param {object} context
 * @param {object} context.client
 * @param {object} context.episode
 * @param {object[]} [context.assessments] ClientAssessment rows for the episode
 * @param {object[]} [context.catalogue] Assessment definitions referenced by the rows
 * @param {object[]} [context.soapNotes]
 * @param {object[]} [context.savedReports]
 * @param {object[]} [context.documents]
 */
export function buildEvidenceCatalogue(context) {
  const { client, episode } = context;
  if (!isPlainObject(client) || !isPlainObject(episode)) {
    throw new WorkflowError(409, 'episode_context_unavailable', 'The care episode context could not be loaded.');
  }
  const orgId = episode.org_id;
  const clientId = episode.client_id;
  const episodeId = episode.id;
  if (!orgId || !clientId || !episodeId || client.id !== clientId || client.org_id !== orgId) {
    throw new WorkflowError(409, 'care_episode_patient_mismatch', 'The care episode does not resolve to one patient in this organisation.');
  }
  const scope = { orgId, clientId, episodeId };
  const episodeVersion = String(episode.updated_date || '');
  const catalogueById = new Map((context.catalogue || []).map((row) => [row.id, row]));
  const items = [];

  items.push(item({
    sourceId: `client_summary:${clientId}`,
    category: 'client_summary',
    entity: 'Client',
    recordId: clientId,
    label: 'Patient summary (identity minimised)',
    recordedAt: client.updated_date,
    recordVersion: String(client.updated_date || ''),
    content: minimiseClientSummary(client),
  }));

  const referral = isPlainObject(episode.referral) ? episode.referral : {};
  items.push(item({
    sourceId: `referral:${episodeId}`,
    category: 'referral',
    entity: 'PhysioCareEpisode',
    recordId: episodeId,
    path: 'referral',
    label: 'Referral and funding',
    recordedAt: referral.referral_date || episode.episode_start_date,
    recordVersion: episodeVersion,
    content: {
      source: text(referral.source),
      referrer_name: text(referral.referrer_name),
      referral_date: dateOnly(referral.referral_date),
      reason: text(referral.reason),
      funding_source: text(referral.funding_source),
      approved_sessions: toFiniteNumber(referral.approved_sessions),
      sessions_used: toFiniteNumber(referral.sessions_used),
      presenting_problem: text(episode.presenting_problem),
      body_region: text(episode.body_region),
      episode_start_date: dateOnly(episode.episode_start_date),
      episode_status: text(episode.status),
    },
  }));

  const screen = isPlainObject(episode.red_flag_screen) ? episode.red_flag_screen : {};
  const screenSummary = isPlainObject(screen.physio_screen_summary) ? screen.physio_screen_summary : {};
  items.push(item({
    sourceId: `red_flag_screen:${episodeId}`,
    category: 'screening',
    entity: 'PhysioCareEpisode',
    recordId: episodeId,
    path: 'red_flag_screen',
    label: 'Red-flag screen',
    recordedAt: screenSummary.recorded_at,
    recordVersion: episodeVersion,
    content: {
      completion_status: text(screenSummary.completion_status),
      outcome: text(screen.physio_screen_outcome || screenSummary.outcome),
      clinical_reasoning: text(screen.physio_screen_clinical_reasoning || screenSummary.clinical_reasoning),
      escalation_disposition: text(screen.physio_screen_escalation_disposition),
      activity_restriction: text(screen.physio_screen_activity_restriction),
      finding_count: toFiniteNumber(screenSummary.finding_count),
    },
  }));

  const subjective = isPlainObject(episode.subjective_examination) ? episode.subjective_examination : {};
  items.push(item({
    sourceId: `subjective_examination:${episodeId}`,
    category: 'examination',
    entity: 'PhysioCareEpisode',
    recordId: episodeId,
    path: 'subjective_examination',
    label: 'Subjective examination',
    recordedAt: subjective.recorded_at,
    recordVersion: episodeVersion,
    content: {
      completion_status: text(subjective.completion_status),
      presenting_complaint: text(subjective.physio_subj_presenting_complaint),
      body_chart_area: text(subjective.physio_subj_body_chart_area),
      mechanism_of_onset: text(subjective.physio_subj_mechanism_of_onset),
      duration: text(subjective.physio_subj_duration),
      aggravating_factors: text(subjective.physio_subj_aggravating_factors),
      easing_factors: text(subjective.physio_subj_easing_factors),
      current_pain: toFiniteNumber(subjective.physio_subj_current_pain),
      worst_pain_last_week: toFiniteNumber(subjective.physio_subj_worst_pain_last_week),
      patient_goals: text(subjective.physio_subj_patient_goals),
      occupation_and_functional_demands: text(subjective.physio_subj_occupation_and_functional_demands),
    },
  }));

  const objective = isPlainObject(episode.objective_examination) ? episode.objective_examination : {};
  items.push(item({
    sourceId: `objective_examination:${episodeId}`,
    category: 'examination',
    entity: 'PhysioCareEpisode',
    recordId: episodeId,
    path: 'objective_examination',
    label: 'Objective examination',
    recordedAt: objective.recorded_at,
    recordVersion: episodeVersion,
    content: {
      completion_status: text(objective.completion_status),
      observation_posture: text(objective.physio_obj_observation_posture),
      functional_tests: text(objective.physio_obj_functional_tests),
      palpation_findings: text(objective.physio_obj_palpation_findings),
      special_tests: Array.isArray(objective.physio_obj_special_tests)
        ? objective.physio_obj_special_tests.map((entry) => ({ name: text(entry?.name), result: text(entry?.result) }))
        : [],
      diagnosis_clinical_impression: text(objective.physio_obj_diagnosis_clinical_impression),
    },
  }));

  const findings = isPlainObject(episode.initial_findings) ? episode.initial_findings : {};
  items.push(item({
    sourceId: `initial_findings:${episodeId}`,
    category: 'findings',
    entity: 'PhysioCareEpisode',
    recordId: episodeId,
    path: 'initial_findings',
    label: 'Initial findings snapshot',
    recordedAt: episode.episode_start_date,
    recordVersion: episodeVersion,
    content: {
      subjective_summary: text(findings.subjective_summary),
      objective_summary: text(findings.objective_summary),
      physiotherapy_diagnosis: text(findings.physiotherapy_diagnosis),
      red_flag_status: text(findings.red_flag_status),
      precautions: text(findings.precautions),
    },
  }));

  for (const goal of Array.isArray(episode.goals) ? episode.goals : []) {
    if (!isPlainObject(goal) || !goal.id) continue;
    items.push(item({
      sourceId: `goal:${episodeId}:${goal.id}`,
      category: 'goal',
      entity: 'PhysioCareEpisode',
      recordId: episodeId,
      path: `goals[${goal.id}]`,
      label: `Goal: ${text(goal.description, 120) || goal.id}`,
      recordedAt: goal.target_date,
      recordVersion: episodeVersion,
      content: {
        goal_id: goal.id,
        description: text(goal.description),
        baseline: text(goal.baseline),
        target: text(goal.target),
        target_date: dateOnly(goal.target_date),
        status: text(goal.status),
      },
    }));
  }

  const measurements = sortBy(
    (context.assessments || []).filter((row) => isPlainObject(row) && row.status === 'completed'),
    (row) => `${dateOnly(row.assessment_date)}|${row.id}`,
  );
  for (const row of measurements) {
    if (scopeMismatch(row, scope, 'ClientAssessment')) {
      throw new WorkflowError(409, 'care_episode_context_mismatch', 'An assessment record outside the selected care episode was supplied.');
    }
    const definition = catalogueById.get(row.assessment_id) || {};
    const value = toFiniteNumber(row.result_value);
    items.push(item({
      sourceId: `measurement:${row.id}`,
      category: 'measurement',
      entity: 'ClientAssessment',
      recordId: row.id,
      label: `${text(definition.name) || 'Outcome measure'} (${dateOnly(row.assessment_date) || 'undated'})`,
      recordedAt: row.assessment_date,
      recordVersion: String(row.updated_date || ''),
      content: {
        assessment_id: row.assessment_id,
        name: text(definition.name) || 'Outcome measure',
        unit: text(definition.unit_of_measure),
        direction: text(definition.normative_direction || definition.improvement_direction) || 'neutral',
        scoring_version: text(definition.scoring_version || definition.version) || 'unversioned',
        result_value: value,
        assessment_date: dateOnly(row.assessment_date),
        source: text(row.source) || 'live',
        notes: text(row.notes, 500),
      },
      flags: value === null ? ['non_numeric_result'] : [],
    }));
  }

  for (const encounter of Array.isArray(episode.encounters) ? episode.encounters : []) {
    if (!isPlainObject(encounter) || !encounter.id) continue;
    items.push(item({
      sourceId: `encounter:${episodeId}:${encounter.id}`,
      category: 'encounter',
      entity: 'PhysioCareEpisode',
      recordId: episodeId,
      path: `encounters[${encounter.id}]`,
      label: `Encounter ${dateOnly(encounter.date) || 'undated'} (${text(encounter.type) || 'unspecified'})`,
      recordedAt: encounter.date,
      recordVersion: episodeVersion,
      content: {
        encounter_id: encounter.id,
        date: dateOnly(encounter.date),
        type: text(encounter.type),
        summary: text(encounter.summary),
        treatments: Array.isArray(encounter.treatments) ? encounter.treatments.map((entry) => text(entry)).filter(Boolean) : [],
        response: text(encounter.response),
        next_plan: text(encounter.next_plan),
        soap_note_id: text(encounter.soap_note_id),
      },
    }));
  }

  for (const note of sortBy(context.soapNotes || [], (row) => `${dateOnly(row.note_date)}|${row.id}`)) {
    if (!isPlainObject(note) || !note.id) continue;
    if (scopeMismatch(note, scope, 'SOAPNote')) {
      throw new WorkflowError(409, 'care_episode_context_mismatch', 'A clinical note outside the selected care episode was supplied.');
    }
    items.push(item({
      sourceId: `soap_note:${note.id}`,
      category: 'note',
      entity: 'SOAPNote',
      recordId: note.id,
      label: `Clinical note ${dateOnly(note.note_date) || 'undated'} (${text(note.status) || 'draft'})`,
      recordedAt: note.note_date,
      recordVersion: String(note.updated_date || ''),
      content: {
        note_date: dateOnly(note.note_date),
        status: text(note.status),
        subjective: text(note.subjective),
        objective: text(note.objective),
        assessment: text(note.assessment),
        plan: text(note.plan),
      },
      aiAssisted: Array.isArray(note.ai_provenance) && note.ai_provenance.length > 0,
      flags: note.status === 'published' ? [] : ['unpublished_note'],
    }));
  }

  for (const protocol of Array.isArray(episode.management_protocols) ? episode.management_protocols : []) {
    if (!isPlainObject(protocol) || !protocol.id) continue;
    items.push(item({
      sourceId: `management_protocol:${episodeId}:${protocol.id}`,
      category: 'protocol',
      entity: 'PhysioCareEpisode',
      recordId: episodeId,
      path: `management_protocols[${protocol.id}]`,
      label: `Management protocol: ${text(protocol.condition_name, 120) || protocol.id}`,
      recordedAt: protocol.added_date,
      recordVersion: episodeVersion,
      content: {
        protocol_id: protocol.id,
        condition_name: text(protocol.condition_name),
        status: text(protocol.status),
        source: text(protocol.source),
        added_date: dateOnly(protocol.added_date),
        summary: text(protocol.summary),
        clinical_adaptation: text(protocol.clinical_adaptation),
      },
      aiAssisted: protocol.source === 'ai_evidence_grounded',
    }));
  }

  for (const program of Array.isArray(episode.home_programs) ? episode.home_programs : []) {
    if (!isPlainObject(program) || !program.id) continue;
    items.push(item({
      sourceId: `home_program:${episodeId}:${program.id}`,
      category: 'home_program',
      entity: 'PhysioCareEpisode',
      recordId: episodeId,
      path: `home_programs[${program.id}]`,
      label: `Home program: ${text(program.name, 120) || program.id}`,
      recordedAt: program.prescribed_date,
      recordVersion: episodeVersion,
      content: {
        program_id: program.id,
        name: text(program.name),
        status: text(program.status),
        prescribed_date: dateOnly(program.prescribed_date),
        dosage: text(program.dosage),
        adherence: text(program.adherence),
        instructions: text(program.instructions, 500),
      },
    }));
  }

  for (const report of sortBy(context.savedReports || [], (row) => `${dateOnly(row.report_date)}|${row.id}`)) {
    if (!isPlainObject(report) || !report.id) continue;
    if (scopeMismatch(report, scope, 'SavedReport')) {
      throw new WorkflowError(409, 'care_episode_context_mismatch', 'A prior report outside the selected care episode was supplied.');
    }
    const generation = isPlainObject(report.ai_generation) ? report.ai_generation : null;
    const sectionContent = isPlainObject(report.section_content) ? report.section_content : {};
    items.push(item({
      sourceId: `saved_report:${report.id}`,
      category: 'prior_report',
      entity: 'SavedReport',
      recordId: report.id,
      label: `${text(report.report_name, 120) || 'Prior report'} (${dateOnly(report.report_date) || 'undated'})`,
      recordedAt: report.report_date,
      recordVersion: String(report.updated_date || ''),
      content: {
        report_type: text(report.report_type),
        report_name: text(report.report_name),
        report_date: dateOnly(report.report_date),
        status: text(report.status),
        section_content: Object.fromEntries(
          Object.entries(sectionContent)
            .filter(([, value]) => typeof value === 'string')
            .map(([key, value]) => [key, text(value, 4000)]),
        ),
      },
      aiAssisted: generation !== null,
      aiAttribution: generation
        ? {
            generation_id: text(generation.generation_id),
            task_type: text(generation.task_type),
            source_output_state: text(generation.source_output_state),
            source_output_sha256: text(generation.source_output_sha256),
            model: text(generation.provenance?.model),
            provider: text(generation.provenance?.provider),
            generated_at: text(generation.provenance?.generated_at),
            reviewed_by: text(generation.reviewed_by),
            reviewed_at: text(generation.reviewed_at),
          }
        : null,
      flags: generation ? ['ai_assisted_draft'] : [],
    }));
  }

  for (const document of sortBy(context.documents || [], (row) => `${dateOnly(row.created_date)}|${row.id}`)) {
    if (!isPlainObject(document) || !document.id) continue;
    if (scopeMismatch(document, scope, 'ClientDocument')) {
      throw new WorkflowError(409, 'care_episode_context_mismatch', 'A document outside the selected care episode was supplied.');
    }
    items.push(item({
      sourceId: `document:${document.id}`,
      category: 'document',
      entity: 'ClientDocument',
      recordId: document.id,
      label: `Document: ${text(document.file_name, 120) || document.id}`,
      recordedAt: document.created_date,
      recordVersion: String(document.updated_date || ''),
      content: {
        document_type: text(document.document_type),
        file_name: text(document.file_name),
        notes: text(document.notes, 500),
      },
    }));
  }

  const byId = new Map(items.map((entry) => [entry.source_id, entry]));
  return {
    org_id: orgId,
    client_id: clientId,
    episode_id: episodeId,
    episode_version: episodeVersion,
    items,
    byId,
  };
}

function itemsOf(catalogue, category) {
  return catalogue.items.filter((entry) => entry.category === category);
}

function requirement(key, state, reason, evidence = []) {
  return {
    key,
    label: REQUIREMENTS[key].label,
    description: REQUIREMENTS[key].description,
    state,
    reason,
    evidence: [...new Set(evidence)],
  };
}

/** Group completed numeric measurements by instrument. */
export function measurementSeries(catalogue) {
  const series = new Map();
  for (const entry of itemsOf(catalogue, 'measurement')) {
    if (entry.content.result_value === null) continue;
    const key = entry.content.assessment_id || entry.content.name;
    if (!series.has(key)) series.set(key, []);
    series.get(key).push(entry);
  }
  return series;
}

/**
 * Evaluate a report type's requirements against the evidence catalogue.
 * Pure: the caller stamps assessed_at and source-set identity.
 */
export function assessCompleteness({ reportTypeId, catalogue, clinicalQuestions = [] }) {
  const reportType = getReportType(reportTypeId);
  if (!reportType) {
    throw new WorkflowError(400, 'unsupported_report_type', 'A supported report type is required.');
  }
  const applicable = new Set(reportType.requirements);
  const results = [];
  const { present, missing, unknown, notApplicable } = REQUIREMENT_STATES;

  const referral = catalogue.byId.get(`referral:${catalogue.episode_id}`);
  const referralContent = referral?.content || {};
  {
    const evidence = [];
    if (referral && (referralContent.reason || referralContent.presenting_problem)) evidence.push(referral.source_id);
    if (!applicable.has('referral_question')) {
      results.push(requirement('referral_question', notApplicable, 'Not required by this report type.'));
    } else if (evidence.length === 0 && clinicalQuestions.length === 0) {
      results.push(requirement('referral_question', missing, 'No referral reason or presenting problem is recorded, and the request lists no clinical questions.'));
    } else if (evidence.length === 0) {
      results.push(requirement('referral_question', unknown, 'The request lists clinical questions but the episode records no referral reason or presenting problem.'));
    } else {
      const detail = [];
      if (!referralContent.referrer_name) detail.push('referrer name not recorded');
      if (!referralContent.referral_date) detail.push('referral date not recorded');
      results.push(requirement(
        'referral_question',
        present,
        detail.length ? `Referral reason recorded; ${detail.join('; ')}.` : 'Referral reason, referrer and date are recorded.',
        evidence,
      ));
    }
  }

  const subjective = catalogue.byId.get(`subjective_examination:${catalogue.episode_id}`);
  const objective = catalogue.byId.get(`objective_examination:${catalogue.episode_id}`);
  const findings = catalogue.byId.get(`initial_findings:${catalogue.episode_id}`);
  {
    if (!applicable.has('baseline_findings')) {
      results.push(requirement('baseline_findings', notApplicable, 'Not required by this report type.'));
    } else {
      const completeExams = [subjective, objective].filter((entry) => entry?.content.completion_status === 'complete');
      const draftExams = [subjective, objective].filter((entry) => entry?.content.completion_status === 'draft');
      const snapshotFilled = findings && (findings.content.subjective_summary || findings.content.objective_summary);
      if (completeExams.length === 2) {
        results.push(requirement('baseline_findings', present, 'Subjective and objective examinations are recorded as complete.', completeExams.map((entry) => entry.source_id).concat(snapshotFilled ? [findings.source_id] : [])));
      } else if (completeExams.length === 1 || draftExams.length > 0 || snapshotFilled) {
        const parts = [];
        if (completeExams.length === 1) parts.push(`${completeExams[0].label.toLowerCase()} complete`);
        if (draftExams.length > 0) parts.push(`${draftExams.map((entry) => entry.label.toLowerCase()).join(' and ')} still in draft`);
        if (snapshotFilled && completeExams.length === 0) parts.push('findings snapshot filled without a completed examination');
        results.push(requirement('baseline_findings', unknown, `Baseline findings are partially recorded: ${parts.join('; ')}.`, [...completeExams, ...draftExams].map((entry) => entry.source_id).concat(snapshotFilled ? [findings.source_id] : [])));
      } else {
        results.push(requirement('baseline_findings', missing, 'No subjective or objective examination has been recorded for this episode.'));
      }
    }
  }

  const series = measurementSeries(catalogue);
  {
    if (!applicable.has('baseline_measures')) {
      results.push(requirement('baseline_measures', notApplicable, 'Not required by this report type.'));
    } else if (series.size === 0) {
      const nonNumeric = itemsOf(catalogue, 'measurement').length;
      results.push(requirement(
        'baseline_measures',
        missing,
        nonNumeric > 0
          ? `${nonNumeric} completed assessment${nonNumeric === 1 ? '' : 's'} recorded without a numeric score; no baseline measure can be tabulated.`
          : 'No completed outcome measure with a numeric score is recorded.',
      ));
    } else {
      const baselines = [...series.values()].map((entries) => entries[0].source_id);
      results.push(requirement('baseline_measures', present, `${series.size} instrument${series.size === 1 ? '' : 's'} with a dated baseline score.`, baselines));
    }
  }

  const goals = itemsOf(catalogue, 'goal');
  {
    if (!applicable.has('goals')) {
      results.push(requirement('goals', notApplicable, 'Not required by this report type.'));
    } else if (goals.length === 0) {
      results.push(requirement('goals', missing, 'No goals are recorded for this episode.'));
    } else {
      const withoutTarget = goals.filter((entry) => !entry.content.target).length;
      results.push(requirement(
        'goals',
        withoutTarget === goals.length ? unknown : present,
        withoutTarget > 0
          ? `${goals.length} goal${goals.length === 1 ? '' : 's'} recorded; ${withoutTarget} without a target.`
          : `${goals.length} goal${goals.length === 1 ? '' : 's'} recorded with baseline and target.`,
        goals.map((entry) => entry.source_id),
      ));
    }
  }

  {
    if (!applicable.has('progress_reassessment')) {
      results.push(requirement('progress_reassessment', notApplicable, 'Not required by this report type.'));
    } else {
      const repeated = [...series.values()].filter((entries) => entries.length >= 2);
      const single = [...series.values()].filter((entries) => entries.length < 2);
      if (repeated.length === 0 && series.size === 0) {
        results.push(requirement('progress_reassessment', missing, 'No outcome measure has been recorded, so no change over time can be reported.'));
      } else if (repeated.length === 0) {
        results.push(requirement(
          'progress_reassessment',
          missing,
          `${single.length} instrument${single.length === 1 ? ' has' : 's have'} a baseline only; no reassessment is recorded.`,
          single.map((entries) => entries[0].source_id),
        ));
      } else {
        const mixedVersions = repeated.filter((entries) => new Set(entries.map((entry) => entry.content.scoring_version)).size > 1);
        results.push(requirement(
          'progress_reassessment',
          present,
          `${repeated.length} instrument${repeated.length === 1 ? '' : 's'} reassessed${single.length ? `; ${single.length} baseline-only` : ''}${mixedVersions.length ? `; ${mixedVersions.length} with a scoring-version break` : ''}.`,
          repeated.flatMap((entries) => entries.map((entry) => entry.source_id)),
        ));
      }
    }
  }

  const encounters = itemsOf(catalogue, 'encounter');
  const notes = itemsOf(catalogue, 'note');
  const protocols = itemsOf(catalogue, 'protocol').filter((entry) => entry.content.status === 'current' || entry.content.status === 'completed');
  {
    if (!applicable.has('interventions_delivered')) {
      results.push(requirement('interventions_delivered', notApplicable, 'Not required by this report type.'));
    } else {
      // An encounter counts as delivered management only when it records a
      // treatment; an assessment-only visit is not an intervention.
      const treated = encounters.filter((entry) => entry.content.treatments.length > 0);
      const evidence = [...treated, ...protocols, ...notes.filter((entry) => entry.content.plan || entry.content.objective)].map((entry) => entry.source_id);
      if (evidence.length === 0) {
        results.push(requirement('interventions_delivered', missing, 'No encounter, treatment, protocol or published note records what was delivered.'));
      } else {
        results.push(requirement(
          'interventions_delivered',
          present,
          `${treated.length} encounter${treated.length === 1 ? '' : 's'}, ${protocols.length} protocol${protocols.length === 1 ? '' : 's'} and ${notes.length} note${notes.length === 1 ? '' : 's'} recorded.`,
          evidence,
        ));
      }
    }
  }

  const programs = itemsOf(catalogue, 'home_program');
  {
    if (!applicable.has('exposure_adherence')) {
      results.push(requirement('exposure_adherence', notApplicable, 'Not required by this report type.'));
    } else if (programs.length === 0) {
      results.push(requirement('exposure_adherence', missing, 'No home program is recorded, so exposure and adherence cannot be reported.'));
    } else {
      const withAdherence = programs.filter((entry) => entry.content.adherence);
      if (withAdherence.length === 0) {
        results.push(requirement('exposure_adherence', unknown, `${programs.length} home program${programs.length === 1 ? '' : 's'} prescribed; adherence has not been recorded.`, programs.map((entry) => entry.source_id)));
      } else {
        results.push(requirement('exposure_adherence', present, `Adherence recorded for ${withAdherence.length} of ${programs.length} home program${programs.length === 1 ? '' : 's'}.`, programs.map((entry) => entry.source_id)));
      }
    }
  }

  {
    if (!applicable.has('clinical_rationale')) {
      results.push(requirement('clinical_rationale', notApplicable, 'Not required by this report type.'));
    } else {
      const impression = objective?.content.diagnosis_clinical_impression;
      const diagnosis = findings?.content.physiotherapy_diagnosis;
      const evidence = [impression ? objective.source_id : null, diagnosis ? findings.source_id : null].filter(Boolean);
      if (evidence.length === 0) {
        results.push(requirement('clinical_rationale', missing, 'No clinical impression or physiotherapy diagnosis is recorded. The clinician must supply the interpretation in the draft.'));
      } else {
        results.push(requirement('clinical_rationale', present, 'A recorded clinical impression is available for the clinician to interpret in the draft.', evidence));
      }
    }
  }

  {
    if (!applicable.has('recommendations')) {
      results.push(requirement('recommendations', notApplicable, 'Not required by this report type.'));
    } else {
      const latestEncounterPlan = [...encounters].reverse().find((entry) => entry.content.next_plan);
      const latestNotePlan = [...notes].reverse().find((entry) => entry.content.plan);
      const evidence = [latestEncounterPlan?.source_id, latestNotePlan?.source_id].filter(Boolean);
      if (evidence.length === 0) {
        results.push(requirement('recommendations', missing, 'No current plan is recorded. Recommendations must be authored by the clinician in the draft.'));
      } else {
        results.push(requirement('recommendations', present, 'A recorded current plan is available; the clinician confirms the recommendations in the draft.', evidence));
      }
    }
  }

  const screen = catalogue.byId.get(`red_flag_screen:${catalogue.episode_id}`);
  {
    if (!applicable.has('risks_limitations')) {
      results.push(requirement('risks_limitations', notApplicable, 'Not required by this report type.'));
    } else if (screen?.content.completion_status === 'complete' && screen.content.outcome) {
      results.push(requirement('risks_limitations', present, `Red-flag screen complete (${screen.content.outcome}).`, [screen.source_id, findings?.content.precautions ? findings.source_id : null].filter(Boolean)));
    } else if (screen?.content.outcome || findings?.content.red_flag_status === 'clear' || findings?.content.red_flag_status === 'managed') {
      results.push(requirement('risks_limitations', unknown, 'A red-flag status is recorded but the structured screen is not marked complete.', [screen?.source_id, findings?.source_id].filter(Boolean)));
    } else {
      results.push(requirement('risks_limitations', missing, 'No red-flag screen outcome is recorded.'));
    }
  }

  const summary = { present: 0, missing: 0, unknown: 0, not_applicable: 0 };
  for (const entry of results) summary[entry.state] += 1;
  return {
    report_type: reportType.id,
    template_version: reportType.template_version,
    requirements: results,
    summary,
    blocking_gaps: results.filter((entry) => entry.state === missing).map((entry) => entry.key),
  };
}

/** Default source selection for a report type: every catalogue item that a requirement can use. */
export function defaultSourceSelection({ reportTypeId, catalogue }) {
  const reportType = getReportType(reportTypeId);
  if (!reportType) {
    throw new WorkflowError(400, 'unsupported_report_type', 'A supported report type is required.');
  }
  const categories = new Set([
    'client_summary',
    'referral',
    'screening',
    'examination',
    'findings',
    'measurement',
    'encounter',
    'note',
    'protocol',
    'prior_report',
    'document',
  ]);
  if (reportType.requirements.includes('goals')) categories.add('goal');
  if (reportType.requirements.includes('exposure_adherence')) categories.add('home_program');
  const sourceIds = catalogue.items.filter((entry) => categories.has(entry.category)).map((entry) => entry.source_id);
  return {
    source_ids: sourceIds,
    rules: [
      `All episode-linked records for care episode ${catalogue.episode_id} in the categories: ${[...categories].sort().join(', ')}.`,
      'Only completed assessments are eligible as measurements.',
      'Prior reports and notes are pinned as context; AI-assisted drafts are labelled and never treated as verified evidence.',
    ],
  };
}
