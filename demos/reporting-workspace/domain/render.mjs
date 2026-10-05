// Deterministic fact generation and document rendering.
//
// generateFactSections() derives every "facts" section of a report type from
// the pinned SourceSet alone: dates, scores, tables and calculated changes
// come from structured data, never from free text. The outcome comparison
// reuses the live application's deterministic comparison logic
// (src/lib/clinical/outcomeComparison.js) by read-only import, so the demo
// projects the same numbers the live wizard would.
//
// renderDocumentHtml() turns a document model (facts + clinician narrative +
// provenance) into HTML. Given the same model it produces byte-identical
// output; generation timestamps live in the model's approval metadata, not in
// the renderer.

import { buildOutcomeComparison, formatChange, formatScore, SINGLE_POINT_LABEL, OUTCOME_DIRECTION_NOTE } from '../../../src/lib/clinical/outcomeComparison.js';
import { AI_SECTION_TAG, AI_REPORT_DISCLOSURE_SENTENCE } from '../../../src/lib/clinical/aiProvenance.js';

import { GENERATOR_VERSION, REQUIREMENTS, getReportType } from './reportTypes.mjs';
import { WorkflowError, escapeHtml, formatDateDisplay, formatDateTimeDisplay, sortBy } from './util.mjs';

const NOT_RECORDED = 'Not recorded';

function valueOrNotRecorded(value) {
  if (value === null || value === undefined || value === '') return NOT_RECORDED;
  return String(value);
}

function itemsBy(sourceSet, category) {
  return sourceSet.items.filter((entry) => entry.category === category);
}

function findPath(sourceSet, pathPrefix) {
  return sourceSet.items.find((entry) => entry.path === pathPrefix) || null;
}

function referralQuestionFacts({ sourceSet, request }) {
  const referral = findPath(sourceSet, 'referral');
  const refs = referral ? [referral.source_id] : [];
  const content = referral?.content || {};
  const blocks = [
    {
      type: 'key_values',
      entries: [
        ['Referrer', valueOrNotRecorded(content.referrer_name)],
        ['Referral source', valueOrNotRecorded(content.source)],
        ['Referral date', content.referral_date ? formatDateDisplay(content.referral_date) : NOT_RECORDED],
        ['Funding source', valueOrNotRecorded(content.funding_source)],
        ['Referral reason', valueOrNotRecorded(content.reason)],
        ['Presenting problem', valueOrNotRecorded(content.presenting_problem)],
        ['Body region', valueOrNotRecorded(content.body_region)],
        ['Episode start', content.episode_start_date ? formatDateDisplay(content.episode_start_date) : NOT_RECORDED],
        ['Sessions', content.approved_sessions === null || content.approved_sessions === undefined
          ? (content.sessions_used === null || content.sessions_used === undefined ? NOT_RECORDED : `${content.sessions_used} used`)
          : `${content.sessions_used ?? 0} of ${content.approved_sessions} approved`],
      ],
    },
    {
      type: 'key_values',
      entries: [
        ['Report purpose', valueOrNotRecorded(request.purpose)],
        ['Recipient', [request.recipient?.name, request.recipient?.organisation].filter(Boolean).join(', ') || NOT_RECORDED],
      ],
    },
  ];
  if (Array.isArray(request.clinical_questions) && request.clinical_questions.length > 0) {
    blocks.push({ type: 'list', title: 'Questions this report is asked to answer', items: [...request.clinical_questions] });
  } else {
    blocks.push({ type: 'notice', text: 'No specific clinical questions were recorded on the request.' });
  }
  return { blocks, source_refs: refs };
}

function baselineFindingsFacts({ sourceSet }) {
  const subjective = findPath(sourceSet, 'subjective_examination');
  const objective = findPath(sourceSet, 'objective_examination');
  const findings = findPath(sourceSet, 'initial_findings');
  const screen = findPath(sourceSet, 'red_flag_screen');
  const refs = [subjective, objective, findings, screen].filter(Boolean).map((entry) => entry.source_id);
  const blocks = [];
  const s = subjective?.content || {};
  const o = objective?.content || {};
  const f = findings?.content || {};
  const r = screen?.content || {};
  const stateNote = (label, status) => (status === 'complete' ? `${label} (recorded as complete)` : status === 'draft' ? `${label} (still in draft)` : `${label} (completion state not recorded)`);
  blocks.push({
    type: 'key_values',
    title: stateNote('Subjective examination', s.completion_status),
    entries: [
      ['Presenting complaint', valueOrNotRecorded(s.presenting_complaint)],
      ['Area', valueOrNotRecorded(s.body_chart_area)],
      ['Mechanism of onset', valueOrNotRecorded(s.mechanism_of_onset)],
      ['Duration', valueOrNotRecorded(s.duration)],
      ['Aggravating factors', valueOrNotRecorded(s.aggravating_factors)],
      ['Easing factors', valueOrNotRecorded(s.easing_factors)],
      ['Current pain (0-10)', s.current_pain === null || s.current_pain === undefined ? NOT_RECORDED : formatScore(s.current_pain)],
      ['Worst pain last week (0-10)', s.worst_pain_last_week === null || s.worst_pain_last_week === undefined ? NOT_RECORDED : formatScore(s.worst_pain_last_week)],
      ['Patient goals (as reported)', valueOrNotRecorded(s.patient_goals)],
      ['Occupation and functional demands', valueOrNotRecorded(s.occupation_and_functional_demands)],
    ],
  });
  blocks.push({
    type: 'key_values',
    title: stateNote('Objective examination', o.completion_status),
    entries: [
      ['Observation and posture', valueOrNotRecorded(o.observation_posture)],
      ['Functional tests', valueOrNotRecorded(o.functional_tests)],
      ['Palpation', valueOrNotRecorded(o.palpation_findings)],
      ['Special tests', Array.isArray(o.special_tests) && o.special_tests.length
        ? o.special_tests.map((entry) => `${entry.name || 'Test'}: ${entry.result || NOT_RECORDED}`).join('; ')
        : NOT_RECORDED],
      ['Recorded clinical impression', valueOrNotRecorded(o.diagnosis_clinical_impression)],
    ],
  });
  blocks.push({
    type: 'key_values',
    title: 'Initial findings snapshot and screening',
    entries: [
      ['Subjective summary', valueOrNotRecorded(f.subjective_summary)],
      ['Objective summary', valueOrNotRecorded(f.objective_summary)],
      ['Physiotherapy diagnosis (recorded)', valueOrNotRecorded(f.physiotherapy_diagnosis)],
      ['Precautions', valueOrNotRecorded(f.precautions)],
      ['Red-flag screen', r.completion_status === 'complete'
        ? `Complete: ${valueOrNotRecorded(r.outcome)}${r.activity_restriction ? `; activity restriction: ${r.activity_restriction}` : ''}`
        : r.outcome
          ? `Outcome recorded (${r.outcome}) but the structured screen is not marked complete`
          : NOT_RECORDED],
    ],
  });
  return { blocks, source_refs: refs };
}

/** Group pinned measurements into ordered series per instrument. */
export function pinnedMeasurementSeries(sourceSet) {
  const series = new Map();
  for (const entry of sortBy(itemsBy(sourceSet, 'measurement'), (item) => `${item.content.assessment_date}|${item.source_id}`)) {
    if (entry.content.result_value === null) continue;
    const key = entry.content.assessment_id || entry.content.name;
    if (!series.has(key)) series.set(key, []);
    series.get(key).push(entry);
  }
  return series;
}

export function outcomeComparisonRows(sourceSet) {
  const series = pinnedMeasurementSeries(sourceSet);
  const records = [];
  for (const entries of series.values()) {
    for (const entry of entries) {
      records.push({
        id: entry.source_id,
        assessment_id: entry.content.assessment_id || entry.content.name,
        name: entry.content.name,
        unit_of_measure: entry.content.unit,
        normative_direction: entry.content.direction === 'higher_better' || entry.content.direction === 'lower_better' ? entry.content.direction : undefined,
        result_value: entry.content.result_value,
        assessment_date: entry.content.assessment_date,
      });
    }
  }
  const comparison = buildOutcomeComparison(records);
  return comparison.map((row) => {
    const entries = series.get(row.key) || [];
    const first = entries[0];
    const last = entries[entries.length - 1];
    const versions = new Set(entries.map((entry) => entry.content.scoring_version));
    return {
      key: row.key,
      name: row.name,
      unit: row.unit,
      direction: row.direction,
      count: row.count,
      baseline_value: row.baselineValue,
      baseline_date: first?.content.assessment_date || '',
      latest_value: row.hasComparison ? row.latestValue : null,
      latest_date: row.hasComparison ? last?.content.assessment_date || '' : '',
      change: row.hasComparison ? row.change : null,
      interpretation: row.interpretation.label,
      has_comparison: row.hasComparison,
      scoring_version_break: versions.size > 1,
      source_refs: entries.map((entry) => entry.source_id),
    };
  });
}

function outcomeMeasuresFacts({ sourceSet }) {
  const rows = outcomeComparisonRows(sourceSet);
  if (rows.length === 0) {
    return {
      blocks: [{ type: 'notice', text: 'No completed outcome measure with a numeric score is pinned for this report. No comparison is available.' }],
      source_refs: [],
    };
  }
  const cell = (value, unit, date) => `${formatScore(value)}${unit ? ` ${unit}` : ''}${date ? ` (${formatDateDisplay(date)})` : ''}`;
  const table = {
    type: 'table',
    columns: ['Assessment', 'Baseline', 'Most recent', 'Change', 'Interpretation'],
    rows: rows.map((row) => [
      row.name,
      cell(row.baseline_value, row.unit, row.baseline_date),
      row.has_comparison ? cell(row.latest_value, row.unit, row.latest_date) : '—',
      row.has_comparison ? formatChange(row.change, row.unit) : '—',
      row.has_comparison ? `${row.interpretation}${row.scoring_version_break ? ' (scoring-version break; comparability limited)' : ''}` : SINGLE_POINT_LABEL,
    ]),
    note: rows.some((row) => row.has_comparison) ? OUTCOME_DIRECTION_NOTE : '',
  };
  const definitions = {
    type: 'list',
    title: 'Measure definitions pinned for this report',
    items: sourceSet.measure_definitions.map((definition) => `${definition.name}: unit ${definition.unit || 'not recorded'}; direction of benefit ${definition.direction || 'not recorded'}; scoring version ${definition.scoring_version || 'unversioned'}`),
  };
  return { blocks: [table, definitions], source_refs: rows.flatMap((row) => row.source_refs) };
}

function goalProgressFacts({ sourceSet }) {
  const goals = sortBy(itemsBy(sourceSet, 'goal'), (entry) => `${entry.content.target_date}|${entry.source_id}`);
  if (goals.length === 0) {
    return { blocks: [{ type: 'notice', text: 'No goals are recorded for this episode.' }], source_refs: [] };
  }
  return {
    blocks: [{
      type: 'table',
      columns: ['Goal', 'Baseline', 'Target', 'Target date', 'Recorded status'],
      rows: goals.map((entry) => [
        valueOrNotRecorded(entry.content.description),
        valueOrNotRecorded(entry.content.baseline),
        valueOrNotRecorded(entry.content.target),
        entry.content.target_date ? formatDateDisplay(entry.content.target_date) : NOT_RECORDED,
        valueOrNotRecorded(entry.content.status).replace(/_/g, ' '),
      ]),
    }],
    source_refs: goals.map((entry) => entry.source_id),
  };
}

function managementDeliveredFacts({ sourceSet }) {
  const encounters = sortBy(itemsBy(sourceSet, 'encounter'), (entry) => `${entry.content.date}|${entry.source_id}`);
  const protocols = itemsBy(sourceSet, 'protocol');
  const programs = itemsBy(sourceSet, 'home_program');
  const notes = itemsBy(sourceSet, 'note');
  const blocks = [];
  if (encounters.length === 0) {
    blocks.push({ type: 'notice', text: 'No encounters are recorded for this episode.' });
  } else {
    blocks.push({
      type: 'table',
      title: `Encounters (${encounters.length})`,
      columns: ['Date', 'Type', 'Summary', 'Treatments', 'Recorded response'],
      rows: encounters.map((entry) => [
        entry.content.date ? formatDateDisplay(entry.content.date) : NOT_RECORDED,
        valueOrNotRecorded(entry.content.type),
        valueOrNotRecorded(entry.content.summary),
        entry.content.treatments.length ? entry.content.treatments.join('; ') : NOT_RECORDED,
        valueOrNotRecorded(entry.content.response),
      ]),
    });
  }
  if (protocols.length > 0) {
    blocks.push({
      type: 'list',
      title: 'Management protocols',
      items: protocols.map((entry) => `${entry.content.condition_name} — ${entry.content.status}${entry.content.added_date ? `, added ${formatDateDisplay(entry.content.added_date)}` : ''}${entry.content.source === 'ai_evidence_grounded' ? ' (AI evidence-grounded protocol, clinician reviewed at the time it was added)' : ''}`),
    });
  }
  if (programs.length > 0) {
    blocks.push({
      type: 'table',
      title: 'Home programs',
      columns: ['Program', 'Prescribed', 'Dosage', 'Recorded adherence', 'Status'],
      rows: programs.map((entry) => [
        valueOrNotRecorded(entry.content.name),
        entry.content.prescribed_date ? formatDateDisplay(entry.content.prescribed_date) : NOT_RECORDED,
        valueOrNotRecorded(entry.content.dosage),
        valueOrNotRecorded(entry.content.adherence),
        valueOrNotRecorded(entry.content.status),
      ]),
    });
  }
  if (notes.length > 0) {
    const published = notes.filter((entry) => entry.content.status === 'published').length;
    blocks.push({ type: 'paragraph', text: `${notes.length} clinical note${notes.length === 1 ? '' : 's'} pinned (${published} published, ${notes.length - published} unpublished). Note text is available in the evidence panel and is not reproduced here.` });
  }
  return {
    blocks,
    source_refs: [...encounters, ...protocols, ...programs, ...notes].map((entry) => entry.source_id),
  };
}

function limitationsProvenanceFacts({ sourceSet, completeness, sections }) {
  const items = [];
  const rows = outcomeComparisonRows(sourceSet);
  const singlePoint = rows.filter((row) => !row.has_comparison);
  if (singlePoint.length > 0) {
    items.push(`${singlePoint.length} instrument${singlePoint.length === 1 ? ' has' : 's have'} a baseline only, so no change is reported for: ${singlePoint.map((row) => row.name).join('; ')}.`);
  }
  const versionBreaks = rows.filter((row) => row.scoring_version_break);
  if (versionBreaks.length > 0) {
    items.push(`Scoring-version break detected for: ${versionBreaks.map((row) => row.name).join('; ')}. Comparability is limited.`);
  }
  const unpublishedNotes = itemsBy(sourceSet, 'note').filter((entry) => entry.content.status !== 'published');
  if (unpublishedNotes.length > 0) {
    items.push(`${unpublishedNotes.length} pinned clinical note${unpublishedNotes.length === 1 ? ' is' : 's are'} unpublished drafts.`);
  }
  const aiSources = sourceSet.items.filter((entry) => entry.ai_assisted);
  if (aiSources.length > 0) {
    items.push(`${aiSources.length} pinned source${aiSources.length === 1 ? ' is' : 's are'} AI-assisted drafts; they are context only and are not treated as verified evidence.`);
  }
  for (const entry of completeness?.requirements || []) {
    if (entry.state === 'missing') items.push(`${REQUIREMENTS[entry.key].label}: missing — ${entry.reason}`);
    if (entry.state === 'unknown') items.push(`${REQUIREMENTS[entry.key].label}: unknown — ${entry.reason}`);
  }
  const aiSections = (sections || []).filter((section) => section.origin === 'ai_assisted');
  if (aiSections.length > 0) {
    items.push(`Sections drafted with AI assistance and reviewed by the clinician: ${aiSections.map((section) => section.title).join('; ')}.`);
  }
  if (items.length === 0) items.push('No comparability limits or evidence gaps were detected in the pinned sources.');
  return {
    blocks: [
      { type: 'list', title: 'Limitations', items },
      {
        type: 'key_values',
        title: 'Provenance',
        entries: [
          ['Source set', `${sourceSet.id} (version ${sourceSet.version}, pinned ${formatDateTimeDisplay(sourceSet.created_at)})`],
          ['Source manifest hash', sourceSet.manifest_sha256],
          ['Sources pinned', String(sourceSet.items.length)],
          ['Template version', sourceSet.template_version],
          ['Generator version', sourceSet.generator_version],
        ],
      },
    ],
    source_refs: [],
  };
}

const FACT_GENERATORS = Object.freeze({
  referral_question: referralQuestionFacts,
  baseline_findings: baselineFindingsFacts,
  outcome_measures: outcomeMeasuresFacts,
  goal_progress: goalProgressFacts,
  management_delivered: managementDeliveredFacts,
  limitations_provenance: limitationsProvenanceFacts,
});

/**
 * Generate every facts section of the report type from the SourceSet.
 * @returns {Record<string, {blocks: object[], source_refs: string[]}>}
 */
export function generateFactSections({ reportTypeId, sourceSet, request, completeness, sections = [] }) {
  const reportType = getReportType(reportTypeId);
  if (!reportType) {
    throw new WorkflowError(400, 'unsupported_report_type', 'A supported report type is required.');
  }
  const output = {};
  for (const definition of reportType.sections) {
    if (definition.kind !== 'facts') continue;
    const generator = FACT_GENERATORS[definition.facts_generator];
    if (!generator) {
      throw new WorkflowError(500, 'facts_generator_missing', `No generator registered for ${definition.facts_generator}.`);
    }
    const generated = generator({ sourceSet, request, completeness, sections });
    output[definition.key] = { blocks: generated.blocks, source_refs: [...new Set(generated.source_refs)] };
  }
  return output;
}

function originLabel(section) {
  if (section.kind === 'facts') return 'Recorded facts, generated from pinned sources';
  if (section.origin === 'ai_assisted') {
    return section.review_state === 'reviewed'
      ? `${AI_SECTION_TAG}, clinician reviewed`
      : `${AI_SECTION_TAG}, NOT YET REVIEWED`;
  }
  return 'Clinician-authored';
}

function renderBlock(block) {
  const title = block.title ? `<h4>${escapeHtml(block.title)}</h4>` : '';
  switch (block.type) {
    case 'paragraph':
      return `${title}<p>${escapeHtml(block.text)}</p>`;
    case 'notice':
      return `${title}<p class="notice">${escapeHtml(block.text)}</p>`;
    case 'list':
      return `${title}<ul>${block.items.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>`;
    case 'key_values':
      return `${title}<table class="kv"><tbody>${block.entries.map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</tbody></table>`;
    case 'table':
      return `${title}<table class="outcome"><thead><tr>${block.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${block.rows.map((row) => `<tr>${row.map((cellValue) => `<td>${escapeHtml(cellValue)}</td>`).join('')}</tr>`).join('')}</tbody></table>${block.note ? `<p class="note">${escapeHtml(block.note)}</p>` : ''}`;
    default:
      return `<p>${escapeHtml(JSON.stringify(block))}</p>`;
  }
}

function renderNarrative(text) {
  const paragraphs = String(text || '').split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  if (paragraphs.length === 0) return '<p class="notice">Not provided.</p>';
  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br/>')}</p>`).join('');
}

/**
 * Build the document model rendered by renderDocumentHtml(). The model is a
 * plain object so it can be hashed, stored in a snapshot and re-rendered
 * later to prove the render is a pure function of the stored content.
 */
export function buildDocumentModel({ reportTypeId, request, sections, sourceSet, completeness, meta = {} }) {
  const reportType = getReportType(reportTypeId);
  if (!reportType) {
    throw new WorkflowError(400, 'unsupported_report_type', 'A supported report type is required.');
  }
  const client = sourceSet.items.find((entry) => entry.category === 'client_summary')?.content || {};
  const referral = findPath(sourceSet, 'referral')?.content || {};
  const orderedSections = reportType.sections.map((definition) => {
    const section = sections.find((entry) => entry.key === definition.key);
    if (!section) {
      throw new WorkflowError(500, 'section_missing', `Section ${definition.key} is missing from the draft.`);
    }
    return {
      key: section.key,
      title: definition.title,
      kind: definition.kind,
      origin: section.origin,
      review_state: section.review_state,
      not_applicable_reason: section.not_applicable_reason || '',
      blocks: section.kind === 'facts' ? section.blocks || [] : undefined,
      text: section.kind === 'narrative' ? section.text || '' : undefined,
      source_refs: [...(section.source_refs || [])],
      ai_attribution: section.ai_attribution || null,
    };
  });
  return {
    generator_version: GENERATOR_VERSION,
    template_version: reportType.template_version,
    report_type: reportType.id,
    title: reportType.label,
    synthetic: client.synthetic === true || meta.synthetic === true,
    patient: { display_name: client.display_name || 'Patient' },
    episode: {
      id: sourceSet.episode_id,
      presenting_problem: referral.presenting_problem || '',
      body_region: referral.body_region || '',
      start_date: referral.episode_start_date || '',
      status: referral.episode_status || '',
    },
    request: {
      id: request.id,
      purpose: request.purpose,
      recipient: { ...(request.recipient || {}) },
      clinical_questions: [...(request.clinical_questions || [])],
      due_date: request.due_date,
      owner_name: meta.owner_name || request.owner_user_id,
    },
    document_state: meta.document_state || 'DRAFT — NOT APPROVED',
    approval: meta.approval || null,
    amendment: meta.amendment || null,
    stale_sources_acknowledged: meta.stale_sources_acknowledged === true,
    sections: orderedSections,
    ai_disclosure: orderedSections.some((section) => section.origin === 'ai_assisted'),
    completeness_summary: completeness ? { ...completeness.summary } : null,
    source_manifest: {
      source_set_id: sourceSet.id,
      version: sourceSet.version,
      pinned_at: sourceSet.created_at,
      manifest_sha256: sourceSet.manifest_sha256,
      items: sourceSet.items.map((entry) => ({
        source_id: entry.source_id,
        label: entry.label,
        recorded_at: entry.recorded_at,
        record_version: entry.record_version,
        content_sha256: entry.content_sha256,
        ai_assisted: entry.ai_assisted,
      })),
    },
  };
}

const DOCUMENT_STYLES = `
  body { font-family: Georgia, 'Times New Roman', serif; color: #0f172a; margin: 32px auto; max-width: 860px; padding: 0 24px; line-height: 1.45; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 28px 0 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
  h4 { font-size: 13px; margin: 14px 0 4px; color: #334155; }
  p { margin: 6px 0; }
  .banner { border: 2px solid #b45309; background: #fffbeb; color: #78350f; padding: 8px 12px; font-family: Arial, sans-serif; font-size: 12px; margin-bottom: 16px; }
  .state { font-family: Arial, sans-serif; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: #1e3a8a; }
  .origin { font-family: Arial, sans-serif; font-size: 11px; color: #475569; margin: 0 0 8px; }
  .origin.ai { color: #9a3412; }
  .notice { color: #64748b; font-style: italic; }
  .note { font-size: 11px; color: #64748b; }
  table { border-collapse: collapse; width: 100%; margin: 6px 0 10px; font-size: 13px; }
  table.kv th { text-align: left; width: 34%; font-weight: 600; color: #334155; vertical-align: top; padding: 4px 8px 4px 0; border-bottom: 1px solid #f1f5f9; }
  table.kv td { padding: 4px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  table.outcome th, table.outcome td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; vertical-align: top; }
  table.outcome th { background: #f1f5f9; font-family: Arial, sans-serif; font-size: 12px; }
  .manifest { font-size: 11px; }
  .manifest td, .manifest th { border: 1px solid #e2e8f0; padding: 3px 5px; font-family: 'Courier New', monospace; }
  .meta { font-family: Arial, sans-serif; font-size: 12px; color: #334155; }
  .disclosure { border-left: 3px solid #9a3412; padding-left: 10px; font-size: 12px; color: #7c2d12; }
`;

/** Render the document model to a complete HTML document. Pure. */
export function renderDocumentHtml(model) {
  const sections = model.sections.map((section) => {
    const origin = originLabel(section);
    const body = section.kind === 'facts'
      ? (section.blocks || []).map(renderBlock).join('')
      : section.review_state === 'not_applicable'
        ? `<p class="notice">Not applicable: ${escapeHtml(section.not_applicable_reason || 'no reason recorded')}.</p>`
        : renderNarrative(section.text);
    const refs = section.source_refs.length
      ? `<p class="note">Sources: ${section.source_refs.map((ref) => escapeHtml(ref)).join(', ')}</p>`
      : '';
    const attribution = section.origin === 'ai_assisted' && section.ai_attribution
      ? `<p class="note">AI attribution: generation ${escapeHtml(section.ai_attribution.generation_id || 'unknown')}, task ${escapeHtml(section.ai_attribution.task_type || 'unknown')}, model ${escapeHtml(section.ai_attribution.model || 'unknown')}, generated ${escapeHtml(formatDateTimeDisplay(section.ai_attribution.generated_at) || 'unknown')}.</p>`
      : '';
    return `<section><h2>${escapeHtml(section.title)}</h2><p class="origin${section.origin === 'ai_assisted' ? ' ai' : ''}">${escapeHtml(origin)}</p>${body}${refs}${attribution}</section>`;
  }).join('');

  const approval = model.approval
    ? `<p class="meta">Approved by ${escapeHtml(model.approval.approved_by_name)} on ${escapeHtml(formatDateTimeDisplay(model.approval.approved_at))}. Snapshot ${escapeHtml(model.approval.snapshot_id)}; content hash ${escapeHtml(model.approval.content_sha256 || 'pending')}.</p>`
    : '';
  const amendment = model.amendment
    ? `<p class="meta">Amendment of snapshot ${escapeHtml(model.amendment.supersedes_snapshot_id)}: ${escapeHtml(model.amendment.reason)}</p>`
    : '';
  const stale = model.stale_sources_acknowledged
    ? '<p class="meta">The approver acknowledged that newer source material existed and approved this document as at its pinned sources.</p>'
    : '';
  const manifestRows = model.source_manifest.items
    .map((entry) => `<tr><td>${escapeHtml(entry.source_id)}</td><td>${escapeHtml(entry.label)}</td><td>${escapeHtml(entry.recorded_at ? formatDateDisplay(entry.recorded_at) : '')}</td><td>${escapeHtml(entry.record_version)}</td><td>${escapeHtml(entry.content_sha256.slice(0, 16))}</td><td>${entry.ai_assisted ? 'yes' : ''}</td></tr>`)
    .join('');
  const questions = model.request.clinical_questions.length
    ? `<ul>${model.request.clinical_questions.map((question) => `<li>${escapeHtml(question)}</li>`).join('')}</ul>`
    : '<p class="notice">No clinical questions recorded on the request.</p>';

  return `<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(model.title)} — ${escapeHtml(model.patient.display_name)}</title>
<style>${DOCUMENT_STYLES}</style>
</head>
<body>
${model.synthetic ? '<div class="banner">SYNTHETIC DEMONSTRATION DATA — this document was generated from fixture records that do not describe a real person.</div>' : ''}
<p class="state">${escapeHtml(model.document_state)}</p>
<h1>${escapeHtml(model.title)}</h1>
<p class="meta">Patient: ${escapeHtml(model.patient.display_name)} · Episode ${escapeHtml(model.episode.id)}${model.episode.presenting_problem ? ` · ${escapeHtml(model.episode.presenting_problem)}` : ''}${model.episode.start_date ? ` · commenced ${escapeHtml(formatDateDisplay(model.episode.start_date))}` : ''}</p>
<p class="meta">Recipient: ${escapeHtml([model.request.recipient.name, model.request.recipient.organisation].filter(Boolean).join(', ') || 'not recorded')} · Purpose: ${escapeHtml(model.request.purpose || 'not recorded')} · Owner: ${escapeHtml(model.request.owner_name)} · Due ${escapeHtml(model.request.due_date ? formatDateDisplay(model.request.due_date) : 'not recorded')}</p>
${approval}${amendment}${stale}
<h2>Questions this report answers</h2>
${questions}
${sections}
${model.ai_disclosure ? `<p class="disclosure">${escapeHtml(AI_REPORT_DISCLOSURE_SENTENCE)}</p>` : ''}
<h2>Source manifest</h2>
<p class="meta">Source set ${escapeHtml(model.source_manifest.source_set_id)} version ${escapeHtml(String(model.source_manifest.version))}, pinned ${escapeHtml(formatDateTimeDisplay(model.source_manifest.pinned_at))}. Manifest hash ${escapeHtml(model.source_manifest.manifest_sha256)}. Template ${escapeHtml(model.template_version)}; generator ${escapeHtml(model.generator_version)}.</p>
<table class="manifest"><thead><tr><th>Source</th><th>Label</th><th>Recorded</th><th>Record version</th><th>Content hash</th><th>AI</th></tr></thead><tbody>${manifestRows}</tbody></table>
</body>
</html>
`;
}
