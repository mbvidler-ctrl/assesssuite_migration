// Shared structural normaliser for the treatment-protocol response shape
// rendered by src/pages/TreatmentProtocols.jsx — NOT a JSON-schema engine.
//
// Rationale: TreatmentProtocols.jsx renders an AI-drafted (or reviewed
// catalogue) protocol object by calling `.map` on several nested arrays and
// interpolating several nested strings directly as React children. Neither
// the AI response nor a catalogue row is guaranteed to match that shape
// exactly; a single malformed field (e.g. `contraindications.absolute` sent
// as a string instead of a string array) would otherwise crash the whole
// page. This module walks the known contract, drops only what does not fit,
// and preserves everything else — including every unknown key — unchanged.
//
// Placement note: src/lib/** is excluded from jsconfig.json's `include` and
// from every eslint.config.js `files` glob, so this module is neither linted
// nor typechecked directly; it is still pulled into the TS program via the
// page import, so it is kept in plain ES2022 with no TS-hostile pattern
// (`strict` is off in jsconfig.json, so there is no implicit-any burden).

// The frozen contract table, data-driven: for each known top-level section,
// which of its fields are plain renderable strings, which are string[]
// fields, and which are object[] fields (with their own known string
// fields). The top level itself is treated as a section with stringFields
// `['clinical_note']` and objectArrayFields `['references']`.
export const PROTOCOL_RENDER_CONTRACT = Object.freeze({
  '': Object.freeze({
    stringFields: Object.freeze(['clinical_note']),
    stringArrayFields: Object.freeze([]),
    objectArrayFields: Object.freeze({
      references: Object.freeze(['citation', 'key_finding', 'study_type']),
    }),
  }),
  overview: Object.freeze({
    stringFields: Object.freeze(['pathophysiology', 'functional_impact', 'prevalence']),
    stringArrayFields: Object.freeze([]),
    objectArrayFields: Object.freeze({}),
  }),
  assessment: Object.freeze({
    stringFields: Object.freeze(['evidence_base']),
    stringArrayFields: Object.freeze(['key_assessments', 'outcome_measures', 'screening_tools']),
    objectArrayFields: Object.freeze({}),
  }),
  exercise_prescription: Object.freeze({
    stringFields: Object.freeze(['frequency', 'session_duration', 'program_duration', 'evidence_summary']),
    stringArrayFields: Object.freeze([]),
    objectArrayFields: Object.freeze({
      exercises: Object.freeze([
        'name', 'type', 'dosage', 'purpose', 'modifications', 'evidence_level', 'equipment', 'coaching_cues',
      ]),
    }),
  }),
  progression: Object.freeze({
    stringFields: Object.freeze(['evidence_base']),
    stringArrayFields: Object.freeze([]),
    objectArrayFields: Object.freeze({
      phases: Object.freeze(['phase_name', 'duration', 'goals', 'criteria']),
    }),
  }),
  contraindications: Object.freeze({
    stringFields: Object.freeze([]),
    stringArrayFields: Object.freeze(['absolute', 'relative', 'red_flags']),
    objectArrayFields: Object.freeze({}),
  }),
  outcomes: Object.freeze({
    stringFields: Object.freeze(['expected_timeframe', 'effect_sizes']),
    stringArrayFields: Object.freeze(['key_outcomes', 'success_indicators']),
    objectArrayFields: Object.freeze({}),
  }),
  meta_analysis_summary: Object.freeze({
    stringFields: Object.freeze(['pooled_effects', 'quality_of_evidence']),
    stringArrayFields: Object.freeze(['key_findings']),
    objectArrayFields: Object.freeze({}),
  }),
});

const KNOWN_SECTIONS = Object.freeze(Object.keys(PROTOCOL_RENDER_CONTRACT).filter((key) => key !== ''));

// User-facing, Australian English. Keyed by the first dotted-path segment a
// dropped entry from normaliseProtocolResponse() can carry, i.e. every known
// top-level field/section name (clinical_note, references, and the seven
// known sections).
export const PROTOCOL_SECTION_LABELS = Object.freeze({
  clinical_note: 'Clinical note',
  references: 'References',
  overview: 'Condition Overview',
  assessment: 'Assessment & Screening',
  exercise_prescription: 'Exercise Prescription',
  progression: 'Progression',
  contraindications: 'Contraindications & Precautions',
  outcomes: 'Outcomes',
  meta_analysis_summary: 'Evidence Summary',
});

const MAX_DROPPED_ENTRIES = 50;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function coerceRenderableString(value) {
  if (typeof value === 'string' && value !== '') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function pushDropped(dropped, path) {
  if (dropped.length < MAX_DROPPED_ENTRIES) dropped.push(path);
}

function normaliseKnownObjectArrayItem(item, itemStringFields) {
  if (!isPlainObject(item)) return undefined;
  const normalised = { ...item };
  for (const field of itemStringFields) {
    if (!Object.hasOwn(normalised, field)) continue;
    const coerced = coerceRenderableString(normalised[field]);
    if (coerced === undefined) delete normalised[field];
    else normalised[field] = coerced;
  }
  return normalised;
}

function normaliseSection(rawSection, spec, pathPrefix, dropped) {
  const section = { ...rawSection };

  for (const field of spec.stringFields) {
    if (!Object.hasOwn(section, field)) continue;
    const coerced = coerceRenderableString(section[field]);
    if (coerced === undefined) {
      delete section[field];
      pushDropped(dropped, pathPrefix ? `${pathPrefix}.${field}` : field);
    } else {
      section[field] = coerced;
    }
  }

  for (const field of spec.stringArrayFields) {
    if (!Object.hasOwn(section, field)) continue;
    const path = pathPrefix ? `${pathPrefix}.${field}` : field;
    if (!Array.isArray(section[field])) {
      delete section[field];
      pushDropped(dropped, path);
      continue;
    }
    const values = section[field].map(coerceRenderableString).filter((value) => value !== undefined);
    if (values.length === 0) {
      delete section[field];
      pushDropped(dropped, path);
    } else {
      section[field] = values;
    }
  }

  for (const [field, itemStringFields] of Object.entries(spec.objectArrayFields)) {
    if (!Object.hasOwn(section, field)) continue;
    const path = pathPrefix ? `${pathPrefix}.${field}` : field;
    if (!Array.isArray(section[field])) {
      delete section[field];
      pushDropped(dropped, path);
      continue;
    }
    const items = [];
    section[field].forEach((item, index) => {
      const normalisedItem = normaliseKnownObjectArrayItem(item, itemStringFields);
      if (normalisedItem === undefined) {
        pushDropped(dropped, `${path}[${index}]`);
      } else {
        items.push(normalisedItem);
      }
    });
    if (items.length === 0) {
      delete section[field];
      pushDropped(dropped, path);
    } else {
      section[field] = items;
    }
  }

  return section;
}

/**
 * Normalises a raw treatment-protocol response against PROTOCOL_RENDER_CONTRACT.
 * @param {unknown} raw
 * @returns {{ ok: boolean, protocol: object|null, degraded: boolean, dropped: string[] }}
 */
export function normaliseProtocolResponse(raw) {
  if (!isPlainObject(raw)) {
    return { ok: false, protocol: null, degraded: false, dropped: [] };
  }

  const dropped = [];
  const protocol = normaliseSection(raw, PROTOCOL_RENDER_CONTRACT[''], '', dropped);

  for (const sectionKey of KNOWN_SECTIONS) {
    if (!Object.hasOwn(protocol, sectionKey)) continue;
    const rawSection = protocol[sectionKey];
    if (!isPlainObject(rawSection)) {
      delete protocol[sectionKey];
      pushDropped(dropped, sectionKey);
      continue;
    }
    protocol[sectionKey] = normaliseSection(rawSection, PROTOCOL_RENDER_CONTRACT[sectionKey], sectionKey, dropped);
  }

  const hasClinicalNote = Object.hasOwn(protocol, 'clinical_note');
  const hasAnyKnownSection = KNOWN_SECTIONS.some((sectionKey) => Object.hasOwn(protocol, sectionKey));
  if (!hasClinicalNote && !hasAnyKnownSection) {
    return { ok: false, protocol: null, degraded: false, dropped: [] };
  }

  return { ok: true, protocol, degraded: dropped.length > 0, dropped };
}

/**
 * Contract helper (test/diagnostic use, not called by app code): walks
 * PROTOCOL_RENDER_CONTRACT over an arbitrary object and returns dotted paths
 * where the page would call `.map` on a non-array, or render a
 * non-string/non-number value as a React child.
 */
export function renderSafetyViolations(protocol) {
  const violations = [];
  if (!isPlainObject(protocol)) return violations;

  const checkSection = (section, spec, pathPrefix) => {
    if (!isPlainObject(section)) return;
    for (const field of spec.stringFields) {
      if (!Object.hasOwn(section, field)) continue;
      if (coerceRenderableString(section[field]) === undefined) {
        violations.push(pathPrefix ? `${pathPrefix}.${field}` : field);
      }
    }
    for (const field of spec.stringArrayFields) {
      if (!Object.hasOwn(section, field)) continue;
      const path = pathPrefix ? `${pathPrefix}.${field}` : field;
      if (!Array.isArray(section[field])) {
        violations.push(path);
        continue;
      }
      section[field].forEach((item, index) => {
        if (coerceRenderableString(item) === undefined) violations.push(`${path}[${index}]`);
      });
    }
    for (const [field, itemStringFields] of Object.entries(spec.objectArrayFields)) {
      if (!Object.hasOwn(section, field)) continue;
      const path = pathPrefix ? `${pathPrefix}.${field}` : field;
      if (!Array.isArray(section[field])) {
        violations.push(path);
        continue;
      }
      section[field].forEach((item, index) => {
        if (!isPlainObject(item)) {
          violations.push(`${path}[${index}]`);
          return;
        }
        for (const itemField of itemStringFields) {
          if (!Object.hasOwn(item, itemField)) continue;
          if (coerceRenderableString(item[itemField]) === undefined) {
            violations.push(`${path}[${index}].${itemField}`);
          }
        }
      });
    }
  };

  checkSection(protocol, PROTOCOL_RENDER_CONTRACT[''], '');
  for (const sectionKey of KNOWN_SECTIONS) {
    if (!Object.hasOwn(protocol, sectionKey)) continue;
    if (!isPlainObject(protocol[sectionKey])) {
      violations.push(sectionKey);
      continue;
    }
    checkSection(protocol[sectionKey], PROTOCOL_RENDER_CONTRACT[sectionKey], sectionKey);
  }
  return violations;
}
