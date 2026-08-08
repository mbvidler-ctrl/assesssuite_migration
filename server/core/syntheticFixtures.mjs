import { canonicalJson, deepFreeze, sha256CanonicalJson } from './json.mjs';

export const CORE_V1_SYNTHETIC_PROVENANCE_SCHEMA_VERSION =
  'assesssuite.core-v1.synthetic-fixture-provenance.v1';
export const CORE_V1_SYNTHETIC_FIXTURE_KEY = 'persistent-pain-aep-v1';
export const CORE_V1_SYNTHETIC_FIXTURE_CREATED_BY = 'core-v1-synthetic-fixture-provisioner';
export const CORE_V1_SYNTHETIC_FIXTURE_TIMESTAMP = '2026-08-08T00:00:00.000Z';
export const CORE_V1_SYNTHETIC_PROVENANCE_FIELD = 'core_v1_synthetic_provenance';

export const CORE_V1_SYNTHETIC_PROVISIONED_ENTITIES = Object.freeze([
  'Client',
  'ClientCondition',
  'ClientAssessment',
]);

// SOAP notes are intentionally deny-only: Core V1 does not provision or
// resolve one, but generic CRUD must not attach one to the fixed subject.
export const CORE_V1_SYNTHETIC_PROTECTED_ENTITIES = Object.freeze([
  ...CORE_V1_SYNTHETIC_PROVISIONED_ENTITIES,
  'SOAPNote',
]);

const FIXTURE_VERSION = '1.0.0';
const PROVISIONING_ROUTE = 'core_v1.synthetic_fixture_provision';
const PROVENANCE_KEYS = Object.freeze([
  'schemaVersion',
  'fixtureKey',
  'fixtureVersion',
  'fixtureIdentity',
  'entityName',
  'recordId',
  'subjectId',
  'orgId',
  'provisionedByRoute',
]);

const FIXTURE_DEFINITIONS = deepFreeze({
  [CORE_V1_SYNTHETIC_FIXTURE_KEY]: {
    fixtureVersion: FIXTURE_VERSION,
    client: {
      full_name: 'Synthetic Core V1 Persistent Pain Fixture',
      gender: 'prefer_not_to_say',
      apss_s2_high_blood_pressure: true,
      apss_s2_smoking: true,
      apss_s2_bmi: 31,
    },
    condition: {
      condition_type: 'primary',
      condition_name: 'Persistent Pain',
      diagnosis_date: '2026-08-01',
      notes: 'Fixed synthetic fixture condition. No person data.',
    },
    clientAssessment: {
      assessment_id: 'core-fixture-persistent-pain-measure-v1',
      assessment_date: '2026-08-07',
      status: 'completed',
      result_value: 42,
      notes: 'Fixed synthetic fixture assessment. No person data.',
    },
  },
});

function fixtureDefinition(fixtureKey) {
  return Object.prototype.hasOwnProperty.call(FIXTURE_DEFINITIONS, fixtureKey)
    ? FIXTURE_DEFINITIONS[fixtureKey]
    : null;
}

export function isCoreV1SyntheticFixtureKey(value) {
  return typeof value === 'string' && fixtureDefinition(value) !== null;
}

function requireFixtureInputs({ fixtureKey, orgId }) {
  const definition = fixtureDefinition(fixtureKey);
  if (!definition) throw new TypeError('fixtureKey is not allowlisted');
  if (typeof orgId !== 'string' || orgId.trim() === '') {
    throw new TypeError('orgId is required');
  }
  return { definition, orgId: orgId.trim() };
}

function deterministicId(fixtureKey, orgId, entityName) {
  const digest = sha256CanonicalJson({
    namespace: 'assesssuite.core-v1.synthetic-fixture-record.v1',
    fixtureKey,
    orgId,
    entityName,
  }).slice('sha256:'.length);
  return `core-fixture-${entityName.toLowerCase()}-${digest.slice(0, 40)}`;
}

function provenanceFor({ fixtureKey, fixtureVersion, entityName, recordId, subjectId, orgId }) {
  const identityCore = {
    schemaVersion: CORE_V1_SYNTHETIC_PROVENANCE_SCHEMA_VERSION,
    fixtureKey,
    fixtureVersion,
    entityName,
    recordId,
    subjectId,
    orgId,
    provisionedByRoute: PROVISIONING_ROUTE,
  };
  return {
    ...identityCore,
    fixtureIdentity: sha256CanonicalJson({
      namespace: 'assesssuite.core-v1.synthetic-fixture-identity.v1',
      ...identityCore,
    }),
  };
}

function compiledRecord({ entityName, id, subjectId, orgId, fixtureKey, fixtureVersion, data }) {
  return {
    entityName,
    id,
    data: {
      org_id: orgId,
      ...(entityName === 'Client' ? {} : { client_id: subjectId }),
      ...data,
      core_v1_synthetic: true,
      [CORE_V1_SYNTHETIC_PROVENANCE_FIELD]: provenanceFor({
        fixtureKey,
        fixtureVersion,
        entityName,
        recordId: id,
        subjectId,
        orgId,
      }),
    },
    createdDate: CORE_V1_SYNTHETIC_FIXTURE_TIMESTAMP,
    updatedDate: CORE_V1_SYNTHETIC_FIXTURE_TIMESTAMP,
    createdBy: CORE_V1_SYNTHETIC_FIXTURE_CREATED_BY,
  };
}

/** Returns the complete deterministic subject/source graph for one org. */
export function buildCoreV1SyntheticFixture({ fixtureKey, orgId }) {
  const input = requireFixtureInputs({ fixtureKey, orgId });
  const { definition } = input;
  const clientId = deterministicId(fixtureKey, input.orgId, 'Client');
  const ids = {
    clientId,
    clientConditionId: deterministicId(fixtureKey, input.orgId, 'ClientCondition'),
    clientAssessmentId: deterministicId(fixtureKey, input.orgId, 'ClientAssessment'),
  };
  const records = [
    compiledRecord({
      entityName: 'Client',
      id: ids.clientId,
      subjectId: ids.clientId,
      orgId: input.orgId,
      fixtureKey,
      fixtureVersion: definition.fixtureVersion,
      data: definition.client,
    }),
    compiledRecord({
      entityName: 'ClientCondition',
      id: ids.clientConditionId,
      subjectId: ids.clientId,
      orgId: input.orgId,
      fixtureKey,
      fixtureVersion: definition.fixtureVersion,
      data: definition.condition,
    }),
    compiledRecord({
      entityName: 'ClientAssessment',
      id: ids.clientAssessmentId,
      subjectId: ids.clientId,
      orgId: input.orgId,
      fixtureKey,
      fixtureVersion: definition.fixtureVersion,
      data: definition.clientAssessment,
    }),
  ];
  return deepFreeze({
    fixtureKey,
    fixtureVersion: definition.fixtureVersion,
    orgId: input.orgId,
    subject: { type: 'client', id: ids.clientId },
    sourceCutoff: CORE_V1_SYNTHETIC_FIXTURE_TIMESTAMP,
    ids,
    records,
  });
}

function exactProvenanceIdentity(record, entityName) {
  const provenance = record?.[CORE_V1_SYNTHETIC_PROVENANCE_FIELD];
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) return null;
  const keys = Object.keys(provenance).sort();
  const expectedKeys = [...PROVENANCE_KEYS].sort();
  if (keys.length !== expectedKeys.length) return null;
  if (!keys.every((key, index) => key === expectedKeys[index])) return null;
  if (
    provenance.schemaVersion !== CORE_V1_SYNTHETIC_PROVENANCE_SCHEMA_VERSION
    || provenance.entityName !== entityName
    || provenance.recordId !== record?.id
    || provenance.orgId !== record?.org_id
    || provenance.provisionedByRoute !== PROVISIONING_ROUTE
    || !isCoreV1SyntheticFixtureKey(provenance.fixtureKey)
  ) return null;
  const fixture = buildCoreV1SyntheticFixture({
    fixtureKey: provenance.fixtureKey,
    orgId: provenance.orgId,
  });
  const expectedRecord = fixture.records.find((candidate) => candidate.entityName === entityName);
  if (
    !expectedRecord
    || expectedRecord.id !== record.id
    || provenance.subjectId !== fixture.subject.id
    || provenance.fixtureVersion !== fixture.fixtureVersion
    || canonicalJson(provenance) !== canonicalJson(
      expectedRecord.data[CORE_V1_SYNTHETIC_PROVENANCE_FIELD],
    )
  ) return null;
  return { fixture, expectedRecord };
}

/**
 * Identifies a server-issued fixture identity even if other fixed clinical
 * fields were later corrupted. Generic mutation uses this fail-closed form.
 */
export function hasCoreV1SyntheticFixtureIdentity(record, entityName) {
  return exactProvenanceIdentity(record, entityName) !== null;
}

/** Resolver-grade check: identity, marker, fixed data and storage metadata. */
export function isCoreV1SyntheticFixtureRecord(record, entityName) {
  const identity = exactProvenanceIdentity(record, entityName);
  if (!identity || record?.core_v1_synthetic !== true) return false;
  const expected = {
    id: identity.expectedRecord.id,
    created_date: identity.expectedRecord.createdDate,
    updated_date: identity.expectedRecord.updatedDate,
    created_by: identity.expectedRecord.createdBy,
    ...identity.expectedRecord.data,
  };
  return canonicalJson(record) === canonicalJson(expected);
}

export function fixtureEntityRecord(fixture, entityName) {
  return fixture?.records?.find((record) => record.entityName === entityName) ?? null;
}
