export const PHYSIO_CARE_EPISODE_SCHEMA_VERSION = 3;

export const PHYSIO_EPISODE_TRANSITIONS = Object.freeze({
  draft: Object.freeze(['active', 'cancelled']),
  active: Object.freeze(['on_hold', 'discharged', 'cancelled']),
  on_hold: Object.freeze(['active', 'discharged', 'cancelled']),
  discharged: Object.freeze(['active']),
  cancelled: Object.freeze(['active']),
});

/** @typedef {{ reason?: string, now?: Date, dischargeDate?: string }} EpisodeTransitionOptions */

export function dateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
}

export function localEpisodeId(prefix = 'item') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeEpisode(episode, idFactory = localEpisodeId) {
  if (!episode) return episode;
  const collectionPrefixes = {
    goals: 'goal',
    outcome_measures: 'measure',
    encounters: 'encounter',
    management_protocols: 'protocol',
    home_programs: 'program',
  };
  return Object.entries(collectionPrefixes).reduce((current, [collection, prefix]) => ({
    ...current,
    [collection]: (current[collection] || []).map((item) => ({
      ...item,
      id: item.id || idFactory(prefix),
    })),
  }), {
    schema_version: PHYSIO_CARE_EPISODE_SCHEMA_VERSION,
    red_flag_screen: {},
    subjective_examination: {},
    objective_examination: {},
    goals: [],
    outcome_measures: [],
    encounters: [],
    management_protocols: [],
    home_programs: [],
    reporting: {},
    status_history: [],
    ...episode,
  });
}

export function buildManagementProtocolEntry({
  conditionName,
  protocolData,
  provenance,
  category = 'general',
  sourceProtocolId = '',
  droppedPaths = [],
  now = new Date(),
  idFactory = localEpisodeId,
}) {
  const name = String(conditionName || '').trim();
  if (!name) throw new TypeError('A protocol condition is required');
  if (!protocolData || typeof protocolData !== 'object' || Array.isArray(protocolData)) {
    throw new TypeError('A structured management protocol is required');
  }

  const source = provenance === 'reviewed_protocol'
    ? 'reviewed_protocol'
    : 'ai_evidence_grounded';
  const references = Array.isArray(protocolData.references) ? protocolData.references : [];
  const summary = String(
    protocolData.overview?.functional_impact
      || protocolData.overview?.pathophysiology
      || protocolData.clinical_note
      || '',
  ).trim();

  return {
    id: idFactory('protocol'),
    condition_name: name,
    category: String(category || 'general'),
    status: 'current',
    source,
    source_protocol_id: String(sourceProtocolId || ''),
    added_date: now.toISOString().slice(0, 10),
    review_date: '',
    clinical_adaptation: '',
    summary,
    evidence_count: references.length,
    dropped_paths: Array.isArray(droppedPaths)
      ? [...new Set(droppedPaths.filter((path) => typeof path === 'string' && path.trim()))]
      : [],
    protocol_data: structuredClone(protocolData),
  };
}

export function deriveOutcomeMeasures(clientAssessments = [], catalogue = [], idFactory = localEpisodeId) {
  const catalogueById = new Map(catalogue.map((item) => [item.id, item]));
  const groups = new Map();

  for (const item of clientAssessments.filter((assessment) => assessment.status === 'completed')) {
    const key = item.assessment_id || item.id;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  return [...groups.entries()].map(([assessmentId, records]) => {
    const sorted = records
      .slice()
      .sort((a, b) => String(a.assessment_date || '').localeCompare(String(b.assessment_date || '')));
    const source = catalogueById.get(assessmentId) || {};
    return {
      id: idFactory('measure'),
      assessment_id: assessmentId,
      client_assessment_ids: sorted.map((record) => record.id).filter(Boolean),
      name: source.name || sorted[0]?.assessment_name || 'Recorded outcome measure',
      baseline_value: sorted[0]?.result_value ?? sorted[0]?.score ?? '',
      current_value: sorted.at(-1)?.result_value ?? sorted.at(-1)?.score ?? '',
      target_value: '',
      unit: source.unit_of_measure || sorted.at(-1)?.unit || '',
      direction: source.improvement_direction || 'descriptive',
      last_measured_date: dateOnly(sorted.at(-1)?.assessment_date),
    };
  });
}

export function deriveEncounters(notes = [], idFactory = localEpisodeId) {
  const sorted = notes
    .slice()
    .sort((a, b) => String(b.note_date || '').localeCompare(String(a.note_date || '')));

  return sorted.map((note, index) => ({
    id: idFactory('encounter'),
    appointment_id: note.appointment_id || '',
    practitioner_id: note.practitioner_id || note.user_id || '',
    date: note.note_date || new Date().toISOString(),
    type: note.encounter_type || (index === sorted.length - 1 ? 'initial' : 'treatment'),
    summary: note.assessment || note.subjective || note.note_name || 'Consultation note',
    treatments: note.objective ? [note.objective] : [],
    response: note.other || '',
    next_plan: note.plan || '',
    soap_note_id: note.id,
  }));
}

export function createEpisodeDraft({
  client,
  episodeNumber,
  clientAssessments = [],
  catalogue = [],
  notes = [],
  reports = [],
  orgId,
  primaryPractitionerId = '',
  now = new Date(),
  idFactory = localEpisodeId,
}) {
  if (!client?.id) throw new TypeError('A client is required to create a physiotherapy episode');
  if (!orgId) throw new TypeError('An organisation is required to create a physiotherapy episode');

  const latestReport = reports
    .slice()
    .sort((a, b) => String(b.report_date || b.created_date || '').localeCompare(
      String(a.report_date || a.created_date || ''),
    ))[0];

  return normalizeEpisode({
    schema_version: PHYSIO_CARE_EPISODE_SCHEMA_VERSION,
    org_id: orgId,
    client_id: client.id,
    primary_practitioner_id: primaryPractitionerId,
    episode_number: Number(episodeNumber) || 1,
    title: client.referral_reason || `Episode ${Number(episodeNumber) || 1}`,
    status: 'active',
    presenting_problem: client.referral_reason || '',
    body_region: '',
    onset_date: '',
    episode_start_date: now.toISOString().slice(0, 10),
    target_discharge_date: '',
    referral: {
      source: client.referral_source || 'self_referral',
      referrer_name: client.referral_source_name || '',
      referral_date: dateOnly(client.referral_date),
      reason: client.referral_reason || '',
      funding_source: client.funding_source || 'self_funded',
      claim_or_plan_number: client.workcover_claim_number || client.ndis_number || '',
      approved_sessions: '',
      sessions_used: notes.length,
      authorization_expiry: '',
    },
    red_flag_screen: {},
    subjective_examination: {},
    objective_examination: {},
    initial_findings: {
      subjective_summary: '',
      objective_summary: '',
      physiotherapy_diagnosis: '',
      red_flag_status: 'not_recorded',
      precautions: '',
    },
    goals: [],
    outcome_measures: deriveOutcomeMeasures(clientAssessments, catalogue, idFactory),
    encounters: deriveEncounters(notes, idFactory),
    management_protocols: [],
    home_programs: [],
    reporting: {
      progress_report_status: latestReport ? 'finalised' : 'not_due',
      referrer_update_due: '',
      discharge_status: 'not_ready',
      discharge_date: '',
      discharge_outcome: '',
      report_id: latestReport?.id || '',
      report_ids: reports.map((report) => report.id).filter(Boolean),
    },
  }, idFactory);
}

export function prepareEpisodePayload(episode, { orgId, clientId, now = new Date() }) {
  if (!episode) throw new TypeError('A physiotherapy episode is required');
  if (!orgId) throw new TypeError('An organisation is required');
  if (!clientId) throw new TypeError('A client is required');

  const {
    id: _id,
    created_date: _createdDate,
    updated_date: _updatedDate,
    created_by: _createdBy,
    status_history: _statusHistory,
    ...data
  } = episode;
  if (_id && !_updatedDate) {
    throw new TypeError('Reload the care episode before saving changes');
  }

  const referral = { ...(data.referral || {}) };
  for (const key of ['approved_sessions', 'sessions_used']) {
    if (referral[key] === '' || referral[key] == null) continue;
    const numeric = Number(referral[key]);
    referral[key] = Number.isFinite(numeric) ? Math.max(0, numeric) : '';
  }

  return {
    ...data,
    schema_version: PHYSIO_CARE_EPISODE_SCHEMA_VERSION,
    org_id: orgId,
    client_id: clientId,
    episode_number: Math.max(1, Number(data.episode_number) || 1),
    status: data.status || 'active',
    episode_start_date: data.episode_start_date || now.toISOString().slice(0, 10),
    last_reviewed_at: now.toISOString(),
    referral,
    ...(_id ? { expected_updated_date: _updatedDate } : {}),
  };
}

export function transitionEpisodeStatus(episode, to, {
  reason = '',
  now = new Date(),
  dischargeDate = now.toISOString().slice(0, 10),
} = /** @type {EpisodeTransitionOptions} */ ({})) {
  if (!episode?.id) throw new TypeError('Save the care episode before changing its lifecycle status');
  const from = String(episode.status || 'active');
  const target = String(to || '');
  if (!PHYSIO_EPISODE_TRANSITIONS[from]?.includes(target)) {
    throw new TypeError(`Unsupported care-episode transition: ${from} to ${target}`);
  }
  const transitionReason = String(reason || '').trim();
  if (!transitionReason) throw new TypeError('A reason is required to change episode status');
  if (!episode.updated_date) throw new TypeError('Reload the care episode before changing its lifecycle status');

  const reporting = { ...(episode.reporting || {}) };
  if (target === 'discharged') {
    reporting.discharge_status = 'completed';
    reporting.discharge_date = reporting.discharge_date || dischargeDate;
  } else if (from === 'discharged') {
    reporting.discharge_status = 'not_ready';
    reporting.discharge_date = '';
    reporting.discharge_outcome = '';
  }

  return {
    ...episode,
    status: target,
    reporting,
    lifecycle_transition: {
      from,
      to: target,
      reason: transitionReason,
      expected_updated_date: episode.updated_date,
    },
  };
}

export function completeDischarge(episode, {
  reason = '',
  dischargeDate = new Date().toISOString().slice(0, 10),
} = /** @type {EpisodeTransitionOptions} */ ({})) {
  return transitionEpisodeStatus(episode, 'discharged', { reason, dischargeDate });
}

export function reopenEpisode(
  episode,
  { reason = '' } = /** @type {EpisodeTransitionOptions} */ ({}),
) {
  if (!['discharged', 'cancelled'].includes(episode?.status)) {
    throw new TypeError('Only a discharged or cancelled care episode can be reopened');
  }
  return transitionEpisodeStatus(episode, 'active', { reason });
}
