import assert from 'node:assert/strict';
import test from 'node:test';

import { createContextSnapshot } from '../../server/core/contextSnapshot.mjs';
import { CoreContractError } from '../../server/core/errors.mjs';
import {
  LEGACY_REPORT_SOURCE_CAP,
  createLegacySourceResolvers,
} from '../../server/core/legacySourceResolvers.mjs';
import { deriveRequestContext } from '../../server/core/requestContext.mjs';
import {
  CORE_V1_SYNTHETIC_FIXTURE_KEY,
  CORE_V1_SYNTHETIC_PROVENANCE_FIELD,
  buildCoreV1SyntheticFixture,
} from '../../server/core/syntheticFixtures.mjs';

const REQUEST_TIME = '2026-08-08T01:00:00.000Z';
const CUTOFF_TIME = '2026-08-08T00:30:00.000Z';
const EARLY_TIME = '2026-08-08T00:00:00.000Z';
const LATE_TIME = '2026-08-08T00:45:00.000Z';
const FUTURE_TIME = '2026-08-08T02:00:00.000Z';
const ORG_ID = 'org-alpha';

const COMPILED_FIXTURE = buildCoreV1SyntheticFixture({
  fixtureKey: CORE_V1_SYNTHETIC_FIXTURE_KEY,
  orgId: ORG_ID,
});
const CLIENT_ID = COMPILED_FIXTURE.ids.clientId;
const CONDITION_ID = COMPILED_FIXTURE.ids.clientConditionId;
const CLIENT_ASSESSMENT_ID = COMPILED_FIXTURE.ids.clientAssessmentId;
const CONDITION_SOURCE_ID = `ClientCondition:${CONDITION_ID}`;
const CLIENT_ASSESSMENT_SOURCE_ID = `ClientAssessment:${CLIENT_ASSESSMENT_ID}`;

function record(id, data = {}, timestamp = EARLY_TIME) {
  return {
    id,
    created_date: timestamp,
    updated_date: timestamp,
    created_by: 'synthetic-user',
    ...data,
  };
}

function provisionedRecord(entityName) {
  const compiled = COMPILED_FIXTURE.records.find((candidate) => (
    candidate.entityName === entityName
  ));
  if (!compiled) throw new Error(`fixture record ${entityName} is unavailable`);
  return {
    id: compiled.id,
    created_date: compiled.createdDate,
    updated_date: compiled.updatedDate,
    created_by: compiled.createdBy,
    ...structuredClone(compiled.data),
  };
}

function copiedFixtureRecord(entityName, id) {
  return { ...provisionedRecord(entityName), id };
}

function repository(rows) {
  return {
    listAll: () => rows.map((row) => structuredClone(row)),
    getById: (id) => {
      const found = rows.find((row) => row.id === id);
      return found ? structuredClone(found) : null;
    },
  };
}

function fixtures() {
  const fixtureAssessment = provisionedRecord('ClientAssessment');
  const copiedClient = copiedFixtureRecord('Client', 'client-copied-provenance');
  const wrongBindingClient = copiedFixtureRecord('Client', 'client-wrong-binding');
  wrongBindingClient[CORE_V1_SYNTHETIC_PROVENANCE_FIELD].recordId = wrongBindingClient.id;

  const copiedCondition = copiedFixtureRecord(
    'ClientCondition',
    'condition-copied-provenance',
  );
  const wrongBindingCondition = copiedFixtureRecord(
    'ClientCondition',
    'condition-wrong-binding',
  );
  wrongBindingCondition[CORE_V1_SYNTHETIC_PROVENANCE_FIELD].recordId =
    wrongBindingCondition.id;
  wrongBindingCondition[CORE_V1_SYNTHETIC_PROVENANCE_FIELD].subjectId =
    'client-wrong-binding';

  const copiedAssessment = copiedFixtureRecord(
    'ClientAssessment',
    'client-assessment-copied-provenance',
  );

  const rows = {
    Client: [
      provisionedRecord('Client'),
      record('client-unmarked', {
        org_id: ORG_ID,
        full_name: 'Same Tenant Unmarked Client',
      }),
      record('client-marker-only', {
        org_id: ORG_ID,
        core_v1_synthetic: true,
        full_name: 'Caller Relabelled Client',
      }),
      record('client-string-marker', {
        org_id: ORG_ID,
        core_v1_synthetic: 'true',
        full_name: 'Same Tenant Incorrect Marker Client',
      }),
      copiedClient,
      wrongBindingClient,
      record('client-bravo', { org_id: 'org-bravo', full_name: 'Foreign Person' }),
    ],
    ClientCondition: [
      provisionedRecord('ClientCondition'),
      record('condition-arbitrary', {
        org_id: ORG_ID,
        client_id: CLIENT_ID,
        updated_date: 'caller-controlled-invalid-timestamp',
        condition_type: 'primary',
        condition_name: 'Caller Attached Condition',
        notes: 'SENSITIVE CALLER CONTROLLED CONDITION NOTE',
      }),
      copiedCondition,
      wrongBindingCondition,
      record('condition-after-cutoff', {
        org_id: ORG_ID,
        client_id: CLIENT_ID,
        condition_type: 'comorbidity',
        condition_name: 'After cutoff',
      }, LATE_TIME),
      record('condition-foreign', {
        org_id: 'org-bravo',
        client_id: 'client-bravo',
        condition_type: 'primary',
        condition_name: 'Foreign condition',
      }),
    ],
    ClientAssessment: [
      fixtureAssessment,
      record('client-assessment-arbitrary', {
        org_id: ORG_ID,
        client_id: CLIENT_ID,
        assessment_id: 'assessment-pain',
        assessment_date: '2026-08-07',
        status: 'completed',
      }),
      copiedAssessment,
      record('client-assessment-pending', {
        org_id: ORG_ID,
        client_id: CLIENT_ID,
        assessment_id: 'assessment-pain',
        assessment_date: '2026-08-07',
        status: 'pending',
      }),
    ],
    Assessment: [
      record('assessment-pain', {
        name: 'Persistent Pain Functional Impact Scale',
        category: 'musculoskeletal',
        description: 'Persistent pain function',
        conditions_indicated: ['Persistent Pain'],
      }),
      record(fixtureAssessment.assessment_id, {
        name: 'Core Fixture Persistent Pain Measure',
        category: 'musculoskeletal',
        description: 'Fixed synthetic measure',
      }),
      record('assessment-deleted', {
        name: 'Deleted Measure',
        category: 'general',
        description: 'Deleted',
        is_deleted: true,
      }),
    ],
    TreatmentProtocol: [
      record('protocol-z', {
        condition_name: 'Persistent Pain',
        category: 'musculoskeletal',
        clinical_note: 'Legacy row intentionally lacks Core governance.',
      }),
      record('protocol-a', {
        condition_name: 'Hypertension',
        category: 'cardio_pulmonary',
      }),
      record('protocol-future', {
        condition_name: 'Future Protocol',
        category: 'general',
      }, FUTURE_TIME),
    ],
    SOAPNote: [
      record('soap-arbitrary-published', {
        org_id: ORG_ID,
        client_id: CLIENT_ID,
        note_date: 'caller-controlled-invalid-timestamp',
        note_name: 'Patient Name Must Not Become Title',
        subjective: 'Caller-controlled synthetic clinical content',
        status: 'published',
      }),
      record('soap-draft', {
        org_id: ORG_ID,
        client_id: CLIENT_ID,
        note_date: EARLY_TIME,
        status: 'draft',
      }),
      record('soap-after-cutoff', {
        org_id: ORG_ID,
        client_id: CLIENT_ID,
        note_date: LATE_TIME,
        status: 'published',
      }, LATE_TIME),
    ],
    SavedReport: [
      record('saved-report-1', {
        org_id: ORG_ID,
        client_id: CLIENT_ID,
        report_date: '2026-08-07',
        report_name: 'Patient Named Historical Report',
        report_type: 'gp_summary',
        status: 'final',
      }),
      record('saved-report-draft', {
        org_id: ORG_ID,
        client_id: CLIENT_ID,
        report_date: '2026-08-07',
        report_name: 'Unreviewed draft',
        report_type: 'gp_summary',
        status: 'draft',
      }),
    ],
    ClientReport: [
      record('client-report-1', {
        org_id: ORG_ID,
        client_id: CLIENT_ID,
        report_date: '2026-08-06',
        report_name: 'Patient Named Legacy Report',
        report_type: 'gp_summary',
      }),
    ],
  };
  const repositories = Object.fromEntries(
    Object.entries(rows).map(([entity, entityRows]) => [entity, repository(entityRows)]),
  );
  return { rows, repositories };
}

function requestContext(purpose) {
  return deriveRequestContext({
    requestId: `request-${purpose}`,
    sessionUser: {
      id: 'user-alpha',
      role: 'admin',
      account_status: 'active',
      profession: 'Accredited Exercise Physiologist',
    },
    authorisedOrgIds: [ORG_ID],
    purpose,
    routeId: `core.${purpose}`,
    receivedAt: REQUEST_TIME,
  });
}

function resolversFor(repositories) {
  return createLegacySourceResolvers({
    repoFor: (entityName) => repositories[entityName] ?? null,
  });
}

function harness() {
  const { rows, repositories } = fixtures();
  return { rows, repositories, resolvers: resolversFor(repositories) };
}

function assertSubjectNotFound(resolvers, subjectId) {
  assert.throws(
    () => resolvers.resolveAssessmentSources({
      requestContext: requestContext('assessment_discovery'),
      subjectId,
    }),
    (error) => (
      error instanceof CoreContractError
      && error.code === 'CORE_SUBJECT_NOT_FOUND'
      && error.httpStatus === 404
    ),
  );
}

test('assessment resolution accepts only the fixed provisioned subject and child graph', () => {
  const { resolvers } = harness();
  const context = requestContext('assessment_discovery');
  const result = resolvers.resolveAssessmentSources({
    requestContext: context,
    subjectId: CLIENT_ID,
    sourceCutoff: CUTOFF_TIME,
  });

  assert.deepEqual(result.assessments.map(({ id }) => id), [
    'assessment-pain',
    'core-fixture-persistent-pain-measure-v1',
  ]);
  assert.deepEqual(result.existingAssessmentIds, [
    'core-fixture-persistent-pain-measure-v1',
  ]);
  assert.deepEqual(result.conditions.map(({ name }) => name), [
    'Persistent Pain',
    'Hypertension / High Blood Pressure',
    'Smoking / Nicotine Use',
    'Obesity (BMI >= 30)',
  ]);
  assert.equal(JSON.stringify(result.conditions).includes('Caller Attached'), false);
  assert.equal(JSON.stringify(result.sourceReferences).includes('SENSITIVE'), false);
  assert.equal(
    result.sourceReferences.some(({ sourceId }) => sourceId.includes('condition-arbitrary')),
    false,
  );
  assert.equal(
    result.sourceReferences.some(({ sourceId }) => sourceId.includes('copied-provenance')),
    false,
  );
  assert.ok(result.sourceReferences.every(({ contentHash }) => (
    /^sha256:[a-f0-9]{64}$/.test(contentHash)
  )));
  assert.ok(result.sourceReferences.some(({ sourceId }) => sourceId === (
    `ClientCondition:${CONDITION_ID}`
  )));
  assert.ok(result.sourceReferences.some(({ sourceId }) => sourceId === (
    `ClientAssessment:${CLIENT_ASSESSMENT_ID}`
  )));

  const snapshot = createContextSnapshot({
    requestContext: context,
    subject: result.subject,
    sources: result.sourceReferences,
    context: result.context,
    cutoffAt: result.cutoffAt,
    createdAt: REQUEST_TIME,
    idFactory: () => 'snapshot-assessment',
  });
  assert.equal(snapshot.orgId, ORG_ID);
  assert.equal(snapshot.subject.id, CLIENT_ID);
});

test('missing, foreign, marker-only and copied-provenance clients share not-found posture', () => {
  const { resolvers } = harness();
  for (const subjectId of [
    'client-missing',
    'client-bravo',
    'client-unmarked',
    'client-marker-only',
    'client-string-marker',
    'client-copied-provenance',
    'client-wrong-binding',
  ]) {
    assertSubjectNotFound(resolvers, subjectId);
  }
});

test('wrong provenance binding, fixed data changes and storage metadata changes invalidate subject', () => {
  for (const mutate of [
    (client) => {
      client[CORE_V1_SYNTHETIC_PROVENANCE_FIELD].orgId = 'org-bravo';
    },
    (client) => {
      client.full_name = 'Relabelled existing client';
    },
    (client) => {
      client.updated_date = LATE_TIME;
    },
  ]) {
    const { rows, repositories } = fixtures();
    mutate(rows.Client[0]);
    repositories.Client = repository(rows.Client);
    assertSubjectNotFound(resolversFor(repositories), CLIENT_ID);
  }
});

test('protocol resolution retains the deterministic legacy catalogue without invented governance', () => {
  const { resolvers } = harness();
  const context = requestContext('protocol_assistance');
  const result = resolvers.resolveProtocolCatalogue({ requestContext: context });

  assert.deepEqual(result.catalogue.map(({ id }) => id), ['protocol-a', 'protocol-z']);
  assert.equal(result.catalogue.some(({ id }) => id === 'protocol-future'), false);
  assert.equal(result.catalogue.every((row) => row.governance === undefined), true);
  assert.equal(result.sourceReferences.length, 1);
  assert.match(result.sourceReferences[0].contentHash, /^sha256:[a-f0-9]{64}$/);
  const snapshot = createContextSnapshot({
    requestContext: context,
    sources: result.sourceReferences,
    context: result.context,
    cutoffAt: result.cutoffAt,
    createdAt: REQUEST_TIME,
    idFactory: () => 'snapshot-protocol',
  });
  assert.equal(snapshot.sources[0].sourceType, 'legacy_protocol_catalogue');
});

test('report resolution admits only the provisioned condition and completed assessment', () => {
  const { resolvers } = harness();
  const context = requestContext('report_composition');
  const result = resolvers.resolveVerifiedReportSources({
    requestContext: context,
    subjectId: CLIENT_ID,
    sourceCutoff: CUTOFF_TIME,
    requestedSourceIds: [CONDITION_SOURCE_ID, CLIENT_ASSESSMENT_SOURCE_ID],
  });

  assert.deepEqual(result.reportSources.map(({ sourceId }) => sourceId), [
    CLIENT_ASSESSMENT_SOURCE_ID,
    CONDITION_SOURCE_ID,
  ]);
  assert.deepEqual(result.context.countsByKind, {
    recorded_condition: 1,
    recorded_assessment: 1,
    soap_note: 0,
  });
  assert.equal(JSON.stringify(result.reportSources).includes('Patient Name'), false);
  assert.ok(result.reportSources.every(({ contentDigest }) => (
    /^sha256:[a-f0-9]{64}$/.test(contentDigest)
  )));
  assert.ok(result.reportSources.every(({ recordedAt, sourceVersion }) => (
    recordedAt === sourceVersion
  )));
  assert.deepEqual(
    result.sourceReferences.map(({ sourceId }) => sourceId),
    result.reportSources.map(({ sourceId }) => sourceId),
  );

  const snapshot = createContextSnapshot({
    requestContext: context,
    subject: result.subject,
    sources: result.sourceReferences,
    context: result.context,
    cutoffAt: result.cutoffAt,
    createdAt: REQUEST_TIME,
    idFactory: () => 'snapshot-report',
  });
  assert.equal(snapshot.sources.length, 2);
});

test('report resolution returns only explicitly requested provisioned evidence', () => {
  const { resolvers } = harness();
  const result = resolvers.resolveVerifiedReportSources({
    requestContext: requestContext('report_composition'),
    subjectId: CLIENT_ID,
    sourceCutoff: CUTOFF_TIME,
    requestedSourceIds: [CONDITION_SOURCE_ID],
  });

  assert.deepEqual(result.reportSources.map(({ sourceId }) => sourceId), [CONDITION_SOURCE_ID]);
  assert.deepEqual(result.sourceReferences.map(({ sourceId }) => sourceId), [CONDITION_SOURCE_ID]);
  assert.deepEqual(result.context.countsByKind, {
    recorded_condition: 1,
    recorded_assessment: 0,
    soap_note: 0,
  });
});

test('arbitrary, copied-provenance and SOAP child rows cannot become report evidence', () => {
  const { resolvers } = harness();
  for (const sourceId of [
    'ClientCondition:condition-arbitrary',
    'ClientCondition:condition-copied-provenance',
    'ClientCondition:condition-wrong-binding',
    'ClientAssessment:client-assessment-arbitrary',
    'ClientAssessment:client-assessment-copied-provenance',
    'SOAPNote:soap-arbitrary-published',
    'SOAPNote:soap-draft',
    'SOAPNote:soap-after-cutoff',
  ]) {
    assert.throws(
      () => resolvers.resolveVerifiedReportSources({
        requestContext: requestContext('report_composition'),
        subjectId: CLIENT_ID,
        sourceCutoff: CUTOFF_TIME,
        requestedSourceIds: [CONDITION_SOURCE_ID, sourceId],
      }),
      (error) => (
        error instanceof CoreContractError
        && error.code === 'CORE_REPORT_SOURCES_UNAVAILABLE'
        && error.httpStatus === 422
      ),
      `${sourceId} must fail the full selection`,
    );
  }
});

test('generated report entities never become verified sources from status or forged receipts', () => {
  const { rows, repositories } = fixtures();
  rows.SavedReport[0].core_metadata = {
    lifecycleState: 'approved',
    releaseEligible: true,
    releaseControlComplete: true,
    releaseBinding: {
      schemaVersion: 'assesssuite.report-release-binding.v1',
      environment: 'production',
      productionReleaseAuthority: true,
      releaseControllerActorId: 'forged-controller',
    },
  };
  rows.ClientReport[0].status = 'released';
  rows.ClientReport[0].coreMetadata = {
    lifecycleState: 'approved',
    releaseEligible: true,
  };
  repositories.SavedReport = repository(rows.SavedReport);
  repositories.ClientReport = repository(rows.ClientReport);
  const resolvers = resolversFor(repositories);

  for (const sourceId of ['SavedReport:saved-report-1', 'ClientReport:client-report-1']) {
    assert.throws(
      () => resolvers.resolveVerifiedReportSources({
        requestContext: requestContext('report_composition'),
        subjectId: CLIENT_ID,
        sourceCutoff: CUTOFF_TIME,
        requestedSourceIds: [sourceId],
      }),
      (error) => (
        error instanceof CoreContractError
        && error.code === 'CORE_REPORT_SOURCES_UNAVAILABLE'
        && error.httpStatus === 422
      ),
      `${sourceId} must not become evidence without immutable Core linkage`,
    );
  }
});

test('unknown and malformed selections fail without widening the source set', () => {
  const { resolvers } = harness();
  const context = requestContext('report_composition');
  assert.throws(
    () => resolvers.resolveVerifiedReportSources({
      requestContext: context,
      subjectId: CLIENT_ID,
      sourceCutoff: CUTOFF_TIME,
      requestedSourceIds: [CONDITION_SOURCE_ID, 'ClientCondition:unknown'],
    }),
    (error) => (
      error instanceof CoreContractError
      && error.code === 'CORE_REPORT_SOURCES_UNAVAILABLE'
      && error.httpStatus === 422
    ),
  );
  assert.throws(
    () => resolvers.resolveVerifiedReportSources({
      requestContext: context,
      subjectId: CLIENT_ID,
      sourceCutoff: CUTOFF_TIME,
      requestedSourceIds: [],
    }),
    (error) => (
      error instanceof CoreContractError
      && error.code === 'CORE_REPORT_SOURCE_SELECTION_REQUIRED'
    ),
  );
  assert.throws(
    () => resolvers.resolveVerifiedReportSources({
      requestContext: context,
      subjectId: CLIENT_ID,
      sourceCutoff: CUTOFF_TIME,
      requestedSourceIds: [CONDITION_SOURCE_ID, CONDITION_SOURCE_ID],
    }),
    (error) => (
      error instanceof CoreContractError
      && error.code === 'CORE_DUPLICATE_REPORT_SOURCE'
    ),
  );
});

test('report resolution enforces the fixed explicit-selection ceiling before eligibility', () => {
  const { resolvers } = harness();
  assert.throws(
    () => resolvers.resolveVerifiedReportSources({
      requestContext: requestContext('report_composition'),
      subjectId: CLIENT_ID,
      sourceCutoff: CUTOFF_TIME,
      requestedSourceIds: Array.from(
        { length: LEGACY_REPORT_SOURCE_CAP + 1 },
        (_, index) => `SOAPNote:too-many-${index}`,
      ),
    }),
    (error) => (
      error instanceof CoreContractError
      && error.code === 'CORE_REPORT_SOURCE_LIMIT_EXCEEDED'
    ),
  );
});

test('report resolution fails closed when no provisioned source exists', () => {
  const { repositories } = fixtures();
  for (const entityName of ['ClientCondition', 'ClientAssessment', 'SOAPNote', 'SavedReport']) {
    repositories[entityName] = repository([]);
  }
  const resolvers = resolversFor(repositories);
  assert.throws(
    () => resolvers.resolveVerifiedReportSources({
      requestContext: requestContext('report_composition'),
      subjectId: CLIENT_ID,
      sourceCutoff: CUTOFF_TIME,
      requestedSourceIds: ['ClientReport:client-report-1'],
    }),
    (error) => (
      error instanceof CoreContractError
      && error.code === 'CORE_REPORT_SOURCES_UNAVAILABLE'
      && error.httpStatus === 422
    ),
  );
  assert.equal(repositories.ClientReport.listAll().length, 1);
});

test('future/non-canonical cutoffs and unavailable repositories return controlled errors', () => {
  const { repositories } = fixtures();
  const resolvers = createLegacySourceResolvers({
    repoFor: (entityName) => entityName === 'TreatmentProtocol' ? null : repositories[entityName],
  });
  const assessmentContext = requestContext('assessment_discovery');
  assert.throws(
    () => resolvers.resolveAssessmentSources({
      requestContext: assessmentContext,
      subjectId: CLIENT_ID,
      sourceCutoff: '2026-08-08T00:30:00+00:00',
    }),
    (error) => error instanceof CoreContractError && error.code === 'CORE_INVALID_SOURCE_CUTOFF',
  );
  assert.throws(
    () => resolvers.resolveAssessmentSources({
      requestContext: assessmentContext,
      subjectId: CLIENT_ID,
      sourceCutoff: FUTURE_TIME,
    }),
    (error) => error instanceof CoreContractError && error.code === 'CORE_SOURCE_CUTOFF_IN_FUTURE',
  );
  assert.throws(
    () => resolvers.resolveProtocolCatalogue({
      requestContext: requestContext('protocol_assistance'),
    }),
    (error) => (
      error instanceof CoreContractError
      && error.code === 'CORE_SOURCE_UNAVAILABLE'
      && error.httpStatus === 503
    ),
  );

  const unreadableResolvers = createLegacySourceResolvers({
    repoFor: (entityName) => entityName === 'TreatmentProtocol'
      ? { listAll: () => { throw new Error('database detail must not escape'); } }
      : repositories[entityName],
  });
  assert.throws(
    () => unreadableResolvers.resolveProtocolCatalogue({
      requestContext: requestContext('protocol_assistance'),
    }),
    (error) => (
      error instanceof CoreContractError
      && error.code === 'CORE_SOURCE_UNAVAILABLE'
      && !error.message.includes('database detail')
    ),
  );
});
