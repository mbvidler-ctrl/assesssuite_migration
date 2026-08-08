import { CoreContractError } from './errors.mjs';
import { sha256CanonicalJson } from './json.mjs';
import {
  CORE_V1_SYNTHETIC_PROVENANCE_FIELD,
  isCoreV1SyntheticFixtureRecord,
} from './syntheticFixtures.mjs';

export const LEGACY_ASSESSMENT_CATALOGUE_CAP = 25_000;
export const LEGACY_PROTOCOL_CATALOGUE_CAP = 25_000;
// A corrupt or accidentally unscoped legacy relation must not create an
// unbounded Core snapshot. The report cap keeps the manifest comfortably
// below the Core JSON node limit while retaining a clinically useful history.
export const LEGACY_SUBJECT_RECORD_CAP = 2_000;
export const LEGACY_REPORT_SOURCE_CAP = 500;

const APSS_STAGE_2_LABELS = Object.freeze([
  ['apss_s2_high_blood_pressure', 'Hypertension / High Blood Pressure'],
  ['apss_s2_high_cholesterol', 'High Cholesterol / Dyslipidaemia'],
  ['apss_s2_high_blood_sugar', 'High Blood Sugar / Glucose Intolerance'],
  ['apss_s2_smoking', 'Smoking / Nicotine Use'],
  ['apss_s2_vaping', 'Vaping'],
  ['apss_s2_family_history', 'Family History of Cardiovascular Disease'],
  ['apss_s2_musculoskeletal_issues', 'Musculoskeletal Issues'],
  ['apss_s2_hospital_admissions', 'Recent Hospital Admission'],
  ['apss_s2_pregnancy', 'Pregnancy / Recent Childbirth'],
]);

const REPORT_ENTITY_DEFINITIONS = Object.freeze([
  Object.freeze({
    entity: 'ClientCondition',
    kind: 'recorded_condition',
    title: 'Recorded condition',
    occurredAtFields: Object.freeze(['diagnosis_date']),
  }),
  Object.freeze({
    entity: 'ClientAssessment',
    kind: 'recorded_assessment',
    title: 'Recorded assessment',
    occurredAtFields: Object.freeze(['assessment_date']),
  }),
  Object.freeze({
    entity: 'SOAPNote',
    kind: 'soap_note',
    title: 'SOAP note',
    occurredAtFields: Object.freeze(['note_date']),
  }),
  // SavedReport and ClientReport are generated outputs, not independent
  // clinical evidence. Their legacy JSON rows have no server-authoritative,
  // immutable release linkage and therefore cannot be promoted back into a
  // Core source manifest merely by carrying status:"final" or a caller-
  // supplied release receipt. A future governed report-source adapter must
  // resolve a durable Core authorization record rather than trust either
  // generic entity.
]);

const REPORT_SOURCE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function contract(code, message, httpStatus = 400) {
  throw new CoreContractError(code, message, { httpStatus });
}

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    contract('CORE_SOURCE_RECORD_INVALID', `${field} is unavailable`);
  }
  return value.trim();
}

function canonicalInstant(value, field) {
  if (typeof value !== 'string') {
    contract('CORE_INVALID_SOURCE_CUTOFF', `${field} must be a canonical UTC timestamp`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    contract('CORE_INVALID_SOURCE_CUTOFF', `${field} must be a canonical UTC timestamp`);
  }
  return value;
}

function canonicalLegacyTemporal(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    contract('CORE_SOURCE_TIMESTAMP_INVALID', `${field} has no usable timestamp`, 422);
  }
  const trimmed = value.trim();
  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00.000Z`
    : trimmed;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) {
    contract('CORE_SOURCE_TIMESTAMP_INVALID', `${field} has no usable timestamp`, 422);
  }
  return new Date(parsed).toISOString();
}

function sourceWindow(requestContext, sourceCutoff = requestContext?.receivedAt) {
  const requestAt = canonicalInstant(requestContext?.receivedAt, 'requestContext.receivedAt');
  const cutoffAt = canonicalInstant(sourceCutoff, 'sourceCutoff');
  if (Date.parse(cutoffAt) > Date.parse(requestAt)) {
    contract('CORE_SOURCE_CUTOFF_IN_FUTURE', 'source cutoff cannot follow the request time');
  }
  const orgId = requireNonEmptyString(requestContext?.orgId, 'requestContext.orgId');
  return { requestAt, cutoffAt, orgId };
}

function requireRepository(repoFor, entityName) {
  let repository;
  try {
    repository = repoFor(entityName);
  } catch {
    contract('CORE_SOURCE_UNAVAILABLE', `${entityName} source repository is unavailable`, 503);
  }
  if (
    !repository
    || typeof repository.listAll !== 'function'
    || (entityName === 'Client' && typeof repository.getById !== 'function')
  ) {
    contract('CORE_SOURCE_UNAVAILABLE', `${entityName} source repository is unavailable`, 503);
  }
  return repository;
}

function readAll(repoFor, entityName) {
  const repository = requireRepository(repoFor, entityName);
  let rows;
  try {
    rows = repository.listAll();
  } catch {
    contract('CORE_SOURCE_UNAVAILABLE', `${entityName} source could not be read`, 503);
  }
  if (!Array.isArray(rows)) {
    contract('CORE_SOURCE_UNAVAILABLE', `${entityName} source returned an invalid result`, 503);
  }
  return rows;
}

function requireSubject(repoFor, subjectId, orgId) {
  const id = requireNonEmptyString(subjectId, 'subjectId');
  const repository = requireRepository(repoFor, 'Client');
  let subject;
  try {
    subject = repository.getById(id);
  } catch {
    contract('CORE_SOURCE_UNAVAILABLE', 'Client source could not be read', 503);
  }
  // Missing and foreign subjects deliberately share the same response so the
  // Core boundary cannot be used to enumerate another organisation's clients.
  if (
    !subject
    || subject.org_id !== orgId
    || !isCoreV1SyntheticFixtureRecord(subject, 'Client')
  ) {
    contract('CORE_SUBJECT_NOT_FOUND', 'subject was not found in the authorised organisation', 404);
  }
  return subject;
}

function capturedAt(record, entityName) {
  return canonicalLegacyTemporal(
    record.updated_date || record.created_date,
    `${entityName} record timestamp`,
  );
}

function createdAt(record, entityName) {
  return canonicalLegacyTemporal(
    record.created_date || record.updated_date,
    `${entityName} creation timestamp`,
  );
}

function recordAtOrBefore(record, entityName, cutoffAt) {
  return Date.parse(capturedAt(record, entityName)) <= Date.parse(cutoffAt);
}

function isDeletedRecord(record) {
  return record?.is_deleted === true || Boolean(record?.deleted_date);
}

function isEligibleReportRecord(record, entityName) {
  if (isDeletedRecord(record)) return false;
  switch (entityName) {
    case 'ClientCondition':
      return true;
    case 'ClientAssessment':
      return record.status === 'completed';
    case 'SOAPNote':
      return record.status === 'published';
    default:
      return false;
  }
}

function stableRecordId(record, entityName) {
  return requireNonEmptyString(record?.id, `${entityName}.id`);
}

function stableSort(records, entityName) {
  return [...records].sort((left, right) => {
    const leftId = stableRecordId(left, entityName);
    const rightId = stableRecordId(right, entityName);
    return leftId.localeCompare(rightId);
  });
}

function boundedSubjectRows(
  repoFor,
  entityName,
  { subjectId, orgId, cutoffAt, eligibleRecord = () => true },
) {
  const rows = readAll(repoFor, entityName);
  const matching = rows.filter((record) => (
    record?.client_id === subjectId
    && record?.org_id === orgId
  ));
  if (matching.length > LEGACY_SUBJECT_RECORD_CAP) {
    contract(
      'CORE_SOURCE_LIMIT_EXCEEDED',
      `${entityName} exceeds the bounded subject source limit`,
      503,
    );
  }
  return stableSort(
    matching
      .filter(eligibleRecord)
      .filter((record) => recordAtOrBefore(record, entityName, cutoffAt)),
    entityName,
  );
}

function boundedCatalogue(repoFor, entityName, cap) {
  const rows = readAll(repoFor, entityName);
  if (rows.length > cap) {
    contract('CORE_SOURCE_LIMIT_EXCEEDED', `${entityName} exceeds its catalogue limit`, 503);
  }
  return stableSort(rows, entityName);
}

function digestId(prefix, value) {
  const candidate = `${prefix}:${value}`;
  if (/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(candidate)) return candidate;
  return `${prefix}:${sha256CanonicalJson({ value }).slice('sha256:'.length)}`;
}

function sourceReference({ sourceType, sourceId, record, entityName }) {
  const timestamp = capturedAt(record, entityName);
  return {
    sourceType,
    sourceId,
    version: timestamp,
    contentHash: sha256CanonicalJson(record),
    capturedAt: timestamp,
  };
}

function aggregateReference({ sourceType, sourceId, records, capturedAt: sampledAt }) {
  const contentHash = sha256CanonicalJson(records);
  return {
    sourceType,
    sourceId,
    version: contentHash,
    contentHash,
    capturedAt: sampledAt,
  };
}

function apssProjection(subject) {
  return Object.fromEntries([
    ...APSS_STAGE_2_LABELS.map(([field]) => [field, subject[field] === true]),
    ['apss_s2_bmi', Number.isFinite(Number(subject.apss_s2_bmi)) ? Number(subject.apss_s2_bmi) : null],
  ]);
}

function apssConditions(subject) {
  const labels = APSS_STAGE_2_LABELS
    .filter(([field]) => subject[field] === true)
    .map(([field, name]) => ({
      id: digestId('apss', `${subject.id}:${field}`),
      name,
      source: 'apss_stage_2',
    }));
  const bmi = Number(subject.apss_s2_bmi);
  if (Number.isFinite(bmi) && bmi >= 30) {
    labels.push({
      id: digestId('apss', `${subject.id}:apss_s2_bmi_obesity`),
      name: 'Obesity (BMI >= 30)',
      source: 'apss_stage_2',
    });
  } else if (Number.isFinite(bmi) && bmi >= 25) {
    labels.push({
      id: digestId('apss', `${subject.id}:apss_s2_bmi_overweight`),
      name: 'Overweight (BMI 25-29.9)',
      source: 'apss_stage_2',
    });
  }
  return labels;
}

function reportOccurredAt(record, definition) {
  for (const field of definition.occurredAtFields) {
    if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
      return canonicalLegacyTemporal(record[field], `${definition.entity}.${field}`);
    }
  }
  return createdAt(record, definition.entity);
}

function reportSource(record, definition) {
  const rawId = stableRecordId(record, definition.entity);
  const sourceId = digestId(definition.entity, rawId);
  const version = capturedAt(record, definition.entity);
  return {
    sourceId,
    kind: definition.kind,
    // Titles intentionally contain neither client nor clinician names.
    title: definition.title,
    occurredAt: reportOccurredAt(record, definition),
    // The current legacy row represents the version last captured at
    // updated_date. Using creation time here would let a later edit appear to
    // pre-date the report cutoff.
    recordedAt: version,
    locator: { entity: definition.entity, id: rawId },
    contentDigest: sha256CanonicalJson(record),
    sourceVersion: version,
    _capturedAt: version,
    _sourceType: `legacy_${definition.entity.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()}`,
  };
}

function publicReportSource(source) {
  const { _capturedAt, _sourceType, ...publicSource } = source;
  return publicSource;
}

function normalizeRequestedSourceIds(value) {
  if (!Array.isArray(value) || value.length === 0) {
    contract(
      'CORE_REPORT_SOURCE_SELECTION_REQUIRED',
      'report composition requires an explicit source selection',
    );
  }
  if (value.length > LEGACY_REPORT_SOURCE_CAP) {
    contract(
      'CORE_REPORT_SOURCE_LIMIT_EXCEEDED',
      'report source selection exceeds the fixed source limit',
    );
  }
  const normalized = value.map((sourceId) => {
    if (typeof sourceId !== 'string' || !REPORT_SOURCE_ID_RE.test(sourceId)) {
      contract(
        'CORE_INVALID_REPORT_SOURCE_SELECTION',
        'report source selection contains an invalid identifier',
      );
    }
    return sourceId;
  });
  if (new Set(normalized).size !== normalized.length) {
    contract(
      'CORE_DUPLICATE_REPORT_SOURCE',
      'report source selection must not contain duplicates',
    );
  }
  return normalized;
}

/**
 * Adapts the retained JSON-entity repositories into Core V1 source contracts.
 * The adapter is read-only, deterministic and contains no provider/network
 * path. It returns content-addressed lineage without logging clinical data.
 */
export function createLegacySourceResolvers({ repoFor } = {}) {
  if (typeof repoFor !== 'function') {
    throw new TypeError('repoFor is required');
  }

  function resolveAssessmentSources({ requestContext, subjectId, sourceCutoff }) {
    const { cutoffAt, orgId } = sourceWindow(requestContext, sourceCutoff);
    const subject = requireSubject(repoFor, subjectId, orgId);
    const conditions = boundedSubjectRows(repoFor, 'ClientCondition', {
      subjectId,
      orgId,
      cutoffAt,
      eligibleRecord: (record) => isCoreV1SyntheticFixtureRecord(
        record,
        'ClientCondition',
      ),
    }).filter((record) => !isDeletedRecord(record));
    const clientAssessments = boundedSubjectRows(repoFor, 'ClientAssessment', {
      subjectId,
      orgId,
      cutoffAt,
      eligibleRecord: (record) => isCoreV1SyntheticFixtureRecord(
        record,
        'ClientAssessment',
      ),
    }).filter((record) => !isDeletedRecord(record));
    const assessments = boundedCatalogue(
      repoFor,
      'Assessment',
      LEGACY_ASSESSMENT_CATALOGUE_CAP,
    ).filter((record) => (
      !isDeletedRecord(record)
      && recordAtOrBefore(record, 'Assessment', cutoffAt)
    ));
    const recordedConditions = conditions
      .map((condition) => ({
        id: stableRecordId(condition, 'ClientCondition'),
        name: typeof condition.condition_name === 'string' ? condition.condition_name.trim() : '',
        type: condition.condition_type ?? null,
        source: 'client_condition',
      }))
      .filter((condition) => condition.name !== '');
    const subjectCapturedAt = capturedAt(subject, 'Client');
    const includeApss = Date.parse(subjectCapturedAt) <= Date.parse(cutoffAt);
    const assessmentSourceId = digestId('Assessment', 'catalogue');
    const sourceReferences = [
      aggregateReference({
        sourceType: 'legacy_assessment_catalogue',
        sourceId: assessmentSourceId,
        records: assessments,
        capturedAt: cutoffAt,
      }),
      sourceReference({
        sourceType: 'legacy_client',
        sourceId: digestId('Client', subject.id),
        record: {
          id: subject.id,
          org_id: subject.org_id,
          core_v1_synthetic: subject.core_v1_synthetic,
          [CORE_V1_SYNTHETIC_PROVENANCE_FIELD]:
            subject[CORE_V1_SYNTHETIC_PROVENANCE_FIELD],
          created_date: subject.created_date,
          updated_date: subject.updated_date,
          apss_stage_2: apssProjection(subject),
        },
        entityName: 'Client',
      }),
      ...conditions.map((record) => sourceReference({
        sourceType: 'legacy_client_condition',
        sourceId: digestId('ClientCondition', stableRecordId(record, 'ClientCondition')),
        record,
        entityName: 'ClientCondition',
      })),
      ...clientAssessments.map((record) => sourceReference({
        sourceType: 'legacy_client_assessment',
        sourceId: digestId('ClientAssessment', stableRecordId(record, 'ClientAssessment')),
        record,
        entityName: 'ClientAssessment',
      })),
    ];

    return {
      subject: { type: 'client', id: subjectId },
      sourceReferences,
      assessments,
      conditions: [
        ...recordedConditions,
        ...(includeApss ? apssConditions(subject) : []),
      ],
      existingAssessmentIds: [...new Set(clientAssessments
        .map((record) => record.assessment_id)
        .filter((id) => typeof id === 'string' && id.trim() !== ''))]
        .sort((left, right) => left.localeCompare(right)),
      context: {
        assessmentCount: assessments.length,
        conditionCount: recordedConditions.length + (includeApss ? apssConditions(subject).length : 0),
        existingAssessmentCount: clientAssessments.length,
        apssStage2LabelCount: includeApss ? apssConditions(subject).length : 0,
      },
      cutoffAt,
    };
  }

  function resolveProtocolCatalogue({ requestContext }) {
    const { cutoffAt } = sourceWindow(requestContext);
    const catalogue = boundedCatalogue(
      repoFor,
      'TreatmentProtocol',
      LEGACY_PROTOCOL_CATALOGUE_CAP,
    ).filter((record) => recordAtOrBefore(record, 'TreatmentProtocol', cutoffAt));
    return {
      sourceReferences: [aggregateReference({
        sourceType: 'legacy_protocol_catalogue',
        sourceId: digestId('TreatmentProtocol', 'catalogue'),
        records: catalogue,
        capturedAt: cutoffAt,
      })],
      // No governance metadata is invented here. Legacy rows flow unchanged
      // into the catalogue validator, which therefore fails closed until each
      // row has an approved, versioned governance envelope.
      catalogue,
      context: { catalogueCount: catalogue.length, catalogueKind: 'legacy' },
      cutoffAt,
    };
  }

  function resolveVerifiedReportSources({
    requestContext,
    subjectId,
    sourceCutoff,
    requestedSourceIds,
  }) {
    const { cutoffAt, orgId } = sourceWindow(requestContext, sourceCutoff);
    requireSubject(repoFor, subjectId, orgId);
    const requested = normalizeRequestedSourceIds(requestedSourceIds);
    const candidates = REPORT_ENTITY_DEFINITIONS.flatMap((definition) => (
      boundedSubjectRows(repoFor, definition.entity, {
        subjectId,
        orgId,
        cutoffAt,
        eligibleRecord: (record) => isCoreV1SyntheticFixtureRecord(
          record,
          definition.entity,
        ),
      })
        .filter((record) => isEligibleReportRecord(record, definition.entity))
        .map((record) => reportSource(record, definition))
        .filter((source) => Date.parse(source.occurredAt) <= Date.parse(cutoffAt))
    ));
    candidates.sort((left, right) => (
      Date.parse(right.occurredAt) - Date.parse(left.occurredAt)
      || left.kind.localeCompare(right.kind)
      || left.sourceId.localeCompare(right.sourceId)
    ));
    const eligibleById = new Map(candidates.map((source) => [source.sourceId, source]));
    const unavailable = requested.filter((sourceId) => !eligibleById.has(sourceId));
    if (unavailable.length > 0) {
      contract(
        'CORE_REPORT_SOURCES_UNAVAILABLE',
        'one or more requested report sources are unavailable',
        422,
      );
    }
    const requestedSet = new Set(requested);
    const selected = candidates.filter((source) => requestedSet.has(source.sourceId));
    const sourceReferences = selected.map((source) => ({
      sourceType: source._sourceType,
      sourceId: source.sourceId,
      version: source.sourceVersion,
      contentHash: source.contentDigest,
      capturedAt: source._capturedAt,
    }));
    const countsByKind = Object.fromEntries(REPORT_ENTITY_DEFINITIONS.map(({ kind }) => [kind, 0]));
    for (const source of selected) countsByKind[source.kind] += 1;

    return {
      subject: { type: 'client', id: subjectId },
      sourceReferences,
      reportSources: selected.map(publicReportSource),
      context: {
        verifiedSourceCount: selected.length,
        requestedSourceCount: requested.length,
        sourceCap: LEGACY_REPORT_SOURCE_CAP,
        countsByKind,
      },
      cutoffAt,
    };
  }

  return Object.freeze({
    resolveAssessmentSources,
    resolveProtocolCatalogue,
    resolveVerifiedReportSources,
  });
}
