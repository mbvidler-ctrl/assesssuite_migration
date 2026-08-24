export const PHYSIO_AI_DRAFT_TASKS = Object.freeze([
  {
    id: 'physio.initial_assessment_summary.v1',
    label: 'Initial assessment summary',
    description: 'Structure history, function, examination findings, baseline measures and review questions.',
  },
  {
    id: 'physio.soap_note.v1',
    label: 'SOAP note',
    description: 'Draft a complete SOAP note from the current encounter and episode context.',
  },
  {
    id: 'physio.management_plan.v1',
    label: 'Management plan draft',
    description: 'Organise problems, goals, management options, progression decisions and reassessment.',
  },
  {
    id: 'physio.progress_comparison.v1',
    label: 'Progress comparison',
    description: 'Compare baseline and review measures, function and goals without losing measurement context.',
  },
  {
    id: 'physio.referrer_update.v1',
    label: 'Referrer update',
    description: 'Prepare a concise clinical and functional progress update for review before sending.',
  },
  {
    id: 'physio.discharge_summary.v1',
    label: 'Discharge summary',
    description: 'Summarise the episode, management, outcomes, current function and follow-up draft.',
  },
]);

export const PHYSIO_AI_DRAFT_TASK_IDS = Object.freeze(
  PHYSIO_AI_DRAFT_TASKS.map((task) => task.id),
);

const TASK_BY_ID = new Map(PHYSIO_AI_DRAFT_TASKS.map((task) => [task.id, task]));

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function parseAiDraftJson(value) {
  let parsed;
  try {
    parsed = JSON.parse(String(value || ''));
  } catch {
    throw new TypeError('The edited draft must be valid JSON before it can be saved or exported.');
  }
  if (!isPlainObject(parsed)) {
    throw new TypeError('The edited draft must remain a structured JSON object.');
  }
  return parsed;
}

export function formatAiDraftJson(value) {
  if (!isPlainObject(value)) throw new TypeError('A structured AI draft object is required.');
  return JSON.stringify(value, null, 2);
}

export function physioAiDraftDestination(taskType) {
  if (!TASK_BY_ID.has(taskType)) throw new TypeError(`Unsupported physiotherapy AI task: ${String(taskType)}`);
  return taskType === 'physio.soap_note.v1' ? 'soap_note' : 'saved_report';
}

export function createAiDraftRecord({
  generationId,
  taskType,
  draft,
  provenance,
  sourceOutputState = 'ai_draft_unreviewed',
  wasEdited = false,
  savedBy = '',
  linkedRecord = null,
  now = new Date(),
  idFactory = () => `ai-draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
}) {
  const task = TASK_BY_ID.get(taskType);
  if (!task) throw new TypeError(`Unsupported physiotherapy AI task: ${String(taskType)}`);
  if (!isPlainObject(draft)) throw new TypeError('A structured AI draft object is required.');
  if (!isPlainObject(provenance)) throw new TypeError('Generation provenance is required before an AI draft can be saved.');
  if (typeof generationId !== 'string' || !generationId.trim()) {
    throw new TypeError('A durable AI generation identifier is required before an AI draft can be saved.');
  }

  const savedAt = new Date(now).toISOString();
  const linkedEntity = linkedRecord?.entity === 'SOAPNote' || linkedRecord?.entity === 'SavedReport'
    ? linkedRecord.entity
    : '';
  const linkedId = typeof linkedRecord?.id === 'string' ? linkedRecord.id : '';

  return {
    id: idFactory(),
    generation_id: generationId.trim(),
    task_type: task.id,
    task_label: task.label,
    output_state: wasEdited ? 'clinician_edited_draft' : 'clinician_reviewed_draft',
    source_output_state: sourceOutputState,
    output: cloneJson(draft),
    provenance: cloneJson(provenance),
    generated_at: provenance.generated_at,
    saved_at: savedAt,
    saved_by: String(savedBy || ''),
    destination: physioAiDraftDestination(task.id),
    ...(linkedEntity && linkedId
      ? { linked_entity: linkedEntity, linked_record_id: linkedId }
      : {}),
  };
}

export function appendAiDraftToEpisode(episode, aiDraftRecord) {
  if (!episode || typeof episode !== 'object') throw new TypeError('A care episode is required.');
  if (!aiDraftRecord?.id) throw new TypeError('A saved AI draft record is required.');
  const reporting = episode.reporting || {};
  return {
    ...episode,
    reporting: {
      ...reporting,
      ai_drafts: [...(Array.isArray(reporting.ai_drafts) ? reporting.ai_drafts : []), aiDraftRecord],
      latest_ai_draft: aiDraftRecord,
    },
  };
}

export function createAiDraftExportEnvelope({ taskType, draft, provenance, outputState, generatedAt }) {
  const task = TASK_BY_ID.get(taskType);
  if (!task) throw new TypeError(`Unsupported physiotherapy AI task: ${String(taskType)}`);
  if (!isPlainObject(draft)) throw new TypeError('A structured AI draft object is required.');
  if (!isPlainObject(provenance)) throw new TypeError('Generation provenance is required for export.');
  return {
    export_type: 'assesssuite_physio_ai_draft',
    task_type: task.id,
    task_label: task.label,
    output_state: outputState || 'ai_draft_unreviewed',
    generated_at: generatedAt || provenance.generated_at,
    exported_at: new Date().toISOString(),
    provenance: cloneJson(provenance),
    draft: cloneJson(draft),
  };
}

export function aiDraftFilename(taskType, generatedAt = new Date().toISOString()) {
  const task = TASK_BY_ID.get(taskType);
  if (!task) throw new TypeError(`Unsupported physiotherapy AI task: ${String(taskType)}`);
  const date = String(generatedAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  return `assesssuite-physio-${task.id}-${date}.json`;
}

function humaniseKey(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function clinicalText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((entry) => (
      typeof entry === 'string' ? `- ${entry}` : `- ${JSON.stringify(entry)}`
    )).join('\n');
  }
  return value && typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function generationMetadata({
  generationId,
  taskType,
  outputState,
  provenance,
  careEpisodeId,
  sourceOutputSha256 = '',
  provenanceSha256 = '',
}) {
  if (typeof generationId !== 'string' || !generationId.trim()) {
    throw new TypeError('A durable AI generation identifier is required for the clinical draft.');
  }
  return {
    generation_id: generationId.trim(),
    task_type: taskType,
    source_output_state: outputState || 'ai_draft_unreviewed',
    care_episode_id: String(careEpisodeId || ''),
    ...(sourceOutputSha256 ? { source_output_sha256: sourceOutputSha256 } : {}),
    ...(provenanceSha256 ? { provenance_sha256: provenanceSha256 } : {}),
    provenance: cloneJson(provenance),
  };
}

export function buildAiSoapNoteDraftPayload({
  generationId,
  orgId,
  clientId,
  careEpisodeId,
  draft,
  provenance,
  outputState,
  sourceOutputSha256 = '',
  provenanceSha256 = '',
  now = new Date(),
}) {
  if (!orgId || !clientId) throw new TypeError('Organisation and client are required for a SOAP note draft.');
  if (!isPlainObject(draft) || !isPlainObject(provenance)) {
    throw new TypeError('A structured draft and generation provenance are required.');
  }
  const unresolved = [
    ...(Array.isArray(draft.unresolved_safety_questions) ? draft.unresolved_safety_questions : []),
    ...(Array.isArray(draft.omissions_or_uncertainties) ? draft.omissions_or_uncertainties : []),
  ];
  return {
    org_id: orgId,
    client_id: clientId,
    physio_care_episode_id: String(careEpisodeId || ''),
    note_date: new Date(now).toISOString(),
    note_name: 'Physiotherapy SOAP note — AI-assisted draft',
    subjective: clinicalText(draft.subjective),
    objective: clinicalText(draft.objective),
    assessment: clinicalText(draft.assessment_for_clinician_review),
    plan: clinicalText(draft.plan_for_clinician_confirmation),
    other: unresolved.length ? `UNRESOLVED SAFETY QUESTIONS / OMISSIONS\n${clinicalText(unresolved)}` : '',
    status: 'draft',
    ai_generation: generationMetadata({
      generationId,
      taskType: 'physio.soap_note.v1',
      outputState,
      provenance,
      careEpisodeId,
      sourceOutputSha256,
      provenanceSha256,
    }),
  };
}

const REPORT_TYPE_BY_TASK = Object.freeze({
  'physio.initial_assessment_summary.v1': 'PHYSIO_INITIAL_ASSESSMENT',
  'physio.management_plan.v1': 'CUSTOM_REPORT',
  'physio.progress_comparison.v1': 'PHYSIO_PROGRESS_REPORT',
  'physio.referrer_update.v1': 'PHYSIO_REFERRER_UPDATE',
  'physio.discharge_summary.v1': 'PHYSIO_DISCHARGE_SUMMARY',
});

export function buildAiSavedReportDraftPayload({
  generationId,
  orgId,
  clientId,
  careEpisodeId,
  taskType,
  taskLabel,
  draft,
  provenance,
  outputState,
  sourceOutputSha256 = '',
  provenanceSha256 = '',
  assessmentIds = [],
  now = new Date(),
}) {
  if (!orgId || !clientId) throw new TypeError('Organisation and client are required for a report draft.');
  if (physioAiDraftDestination(taskType) !== 'saved_report') {
    throw new TypeError('SOAP note output must use the SOAP note save path.');
  }
  if (!isPlainObject(draft) || !isPlainObject(provenance)) {
    throw new TypeError('A structured draft and generation provenance are required.');
  }
  const task = TASK_BY_ID.get(taskType);
  const entries = Object.entries(draft).map(([key, value]) => [humaniseKey(key), clinicalText(value)]);
  const sectionContent = Object.fromEntries(entries);
  const activeSections = entries.map(([label]) => label);
  const generatedAt = provenance.generated_at || new Date(now).toISOString();
  const provenanceText = escapeHtml(JSON.stringify(provenance, null, 2));
  const sectionsHtml = entries.map(([label, value]) => (
    `<section><h2>${escapeHtml(label)}</h2><div class="section-content">${escapeHtml(value).replaceAll('\n', '<br>')}</div></section>`
  )).join('');
  const reportName = `${taskLabel || task.label} — AI-assisted draft`;
  return {
    org_id: orgId,
    client_id: clientId,
    physio_care_episode_id: String(careEpisodeId || ''),
    report_type: REPORT_TYPE_BY_TASK[taskType] || 'CUSTOM_REPORT',
    report_name: reportName,
    report_date: new Date(now).toISOString().slice(0, 10),
    assessment_ids: [...new Set(assessmentIds.filter((id) => typeof id === 'string' && id))],
    section_content: sectionContent,
    active_sections: activeSections,
    report_html: `<!doctype html><html><head><title>${escapeHtml(reportName)}</title><style>body{font-family:Arial,sans-serif;color:#0f172a;padding:32px;line-height:1.55}h1{font-size:24px}h2{font-size:16px;margin:24px 0 8px}.meta{color:#64748b;font-size:12px}.section-content{white-space:normal}.provenance{white-space:pre-wrap;overflow-wrap:anywhere;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;font:11px/1.45 Consolas,monospace}</style></head><body><h1>${escapeHtml(reportName)}</h1><p class="meta">Generated ${escapeHtml(generatedAt)}. Clinician review required; this record remains a draft.</p>${sectionsHtml}<section><h2>AI generation provenance</h2><pre class="provenance">${provenanceText}</pre></section></body></html>`,
    status: 'draft',
    ai_generation: generationMetadata({
      generationId,
      taskType,
      outputState,
      provenance,
      careEpisodeId,
      sourceOutputSha256,
      provenanceSha256,
    }),
  };
}
