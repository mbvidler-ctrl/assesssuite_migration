// SourceSet pinning and change detection.
//
// A SourceSet is the reproducible record of exactly which evidence a draft
// was built from: the selected source ids, the selection rules, a pinned
// copy of each item's minimised content with its content hash and record
// version, the measure definitions in force, and the template/generator
// versions. A later change to any pinned record is detected by comparing
// hashes; it is reported, never applied silently.

import { GENERATOR_VERSION, getReportType } from './reportTypes.mjs';
import { defaultSourceSelection } from './evidence.mjs';
import { WorkflowError, clone, sha256Canonical, sortBy } from './util.mjs';

function stripCatalogueItem(entry) {
  return {
    source_id: entry.source_id,
    category: entry.category,
    entity: entry.entity,
    record_id: entry.record_id,
    path: entry.path,
    label: entry.label,
    recorded_at: entry.recorded_at,
    record_version: entry.record_version,
    content_sha256: entry.content_sha256,
    content: clone(entry.content),
    ai_assisted: entry.ai_assisted === true,
    ai_attribution: entry.ai_attribution ? clone(entry.ai_attribution) : null,
    flags: [...(entry.flags || [])],
  };
}

export function measureDefinitionsFrom(items) {
  const definitions = new Map();
  for (const entry of items) {
    if (entry.category !== 'measurement') continue;
    const key = entry.content.assessment_id || entry.content.name;
    if (!definitions.has(key)) {
      definitions.set(key, {
        assessment_id: entry.content.assessment_id || '',
        name: entry.content.name,
        unit: entry.content.unit,
        direction: entry.content.direction,
        scoring_version: entry.content.scoring_version,
      });
    }
  }
  return sortBy([...definitions.values()], (definition) => `${definition.name}|${definition.assessment_id}`);
}

/**
 * Pin a SourceSet from the current catalogue.
 *
 * @param {object} args
 * @param {object} args.catalogue result of buildEvidenceCatalogue()
 * @param {string} args.reportTypeId
 * @param {string[]} [args.sourceIds] explicit selection; defaults to the report type's rule-based selection
 * @param {number} args.version monotonic per request
 * @param {string} args.id
 * @param {string} args.createdAt ISO date-time
 * @param {string} args.createdBy user id
 */
export function pinSourceSet({ catalogue, reportTypeId, sourceIds = null, version, id, createdAt, createdBy }) {
  const reportType = getReportType(reportTypeId);
  if (!reportType) {
    throw new WorkflowError(400, 'unsupported_report_type', 'A supported report type is required.');
  }
  const selection = defaultSourceSelection({ reportTypeId, catalogue });
  const requested = Array.isArray(sourceIds) ? [...new Set(sourceIds)] : selection.source_ids;
  const unknown = requested.filter((sourceId) => !catalogue.byId.has(sourceId));
  if (unknown.length > 0) {
    throw new WorkflowError(400, 'unknown_source', `Unknown evidence source${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}.`);
  }
  const items = sortBy(requested.map((sourceId) => stripCatalogueItem(catalogue.byId.get(sourceId))), (entry) => entry.source_id);
  const manifest = {
    template_version: reportType.template_version,
    generator_version: GENERATOR_VERSION,
    episode_id: catalogue.episode_id,
    items: items.map((entry) => ({
      source_id: entry.source_id,
      record_version: entry.record_version,
      content_sha256: entry.content_sha256,
    })),
    measure_definitions: measureDefinitionsFrom(items),
  };
  return {
    id,
    version,
    created_at: createdAt,
    created_by: createdBy,
    org_id: catalogue.org_id,
    client_id: catalogue.client_id,
    episode_id: catalogue.episode_id,
    episode_version: catalogue.episode_version,
    template_version: reportType.template_version,
    generator_version: GENERATOR_VERSION,
    selection: {
      rules: Array.isArray(sourceIds) ? ['Explicit clinician selection of evidence sources.', ...selection.rules] : selection.rules,
      source_ids: items.map((entry) => entry.source_id),
    },
    items,
    measure_definitions: manifest.measure_definitions,
    manifest_sha256: sha256Canonical(manifest),
  };
}

/**
 * Compare a pinned SourceSet with the current catalogue. Nothing is mutated.
 */
export function detectSourceChanges({ sourceSet, catalogue, reportTypeId }) {
  const pinned = new Map(sourceSet.items.map((entry) => [entry.source_id, entry]));
  const changed = [];
  const removed = [];
  for (const entry of sourceSet.items) {
    const current = catalogue.byId.get(entry.source_id);
    if (!current) {
      removed.push({ source_id: entry.source_id, label: entry.label, category: entry.category });
      continue;
    }
    if (current.content_sha256 !== entry.content_sha256) {
      changed.push({
        source_id: entry.source_id,
        label: entry.label,
        category: entry.category,
        pinned_sha256: entry.content_sha256,
        current_sha256: current.content_sha256,
        pinned_version: entry.record_version,
        current_version: current.record_version,
      });
    }
  }
  const selection = defaultSourceSelection({ reportTypeId, catalogue });
  const added = selection.source_ids
    .filter((sourceId) => !pinned.has(sourceId))
    .map((sourceId) => {
      const entry = catalogue.byId.get(sourceId);
      return { source_id: sourceId, label: entry.label, category: entry.category, recorded_at: entry.recorded_at };
    });
  return {
    source_set_id: sourceSet.id,
    source_set_version: sourceSet.version,
    is_stale: changed.length > 0 || removed.length > 0 || added.length > 0,
    changed,
    removed,
    added,
  };
}

/** Summarise a SourceSet for display without the pinned content bodies. */
export function sourceSetManifest(sourceSet) {
  return {
    id: sourceSet.id,
    version: sourceSet.version,
    created_at: sourceSet.created_at,
    created_by: sourceSet.created_by,
    episode_id: sourceSet.episode_id,
    episode_version: sourceSet.episode_version,
    template_version: sourceSet.template_version,
    generator_version: sourceSet.generator_version,
    manifest_sha256: sourceSet.manifest_sha256,
    selection_rules: [...sourceSet.selection.rules],
    measure_definitions: clone(sourceSet.measure_definitions),
    items: sourceSet.items.map((entry) => ({
      source_id: entry.source_id,
      category: entry.category,
      entity: entry.entity,
      record_id: entry.record_id,
      path: entry.path,
      label: entry.label,
      recorded_at: entry.recorded_at,
      record_version: entry.record_version,
      content_sha256: entry.content_sha256,
      ai_assisted: entry.ai_assisted,
      flags: [...entry.flags],
    })),
  };
}
