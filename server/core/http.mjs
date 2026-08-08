import { randomUUID } from 'node:crypto';

import { discoverAssessments } from '../../src/lib/clinical/assessmentDiscovery.js';
import {
  MAX_PROTOCOL_QUERY_LENGTH,
  searchProtocolCatalogue,
} from '../../src/lib/clinical/protocol-assistance/index.js';
import {
  LEGACY_REPORT_COMPATIBILITY_VERSION,
  composeReportDraft,
} from '../../src/lib/reports/core/index.js';
import { createAuditEvent } from './audit.mjs';
import { CORE_V1_SANDBOX_BINDINGS } from './bootstrap.mjs';
import { createContextSnapshot } from './contextSnapshot.mjs';
import {
  transitionArtifactState,
  transitionReviewState,
  transitionRunState,
} from './domainStates.mjs';
import { CoreContractError } from './errors.mjs';
import {
  createPendingIdempotencyRecord,
  fingerprintIdempotentRequest,
  hashIdempotencyKey,
  resolveIdempotencyReplay,
} from './idempotency.mjs';
import { deriveRequestContext } from './requestContext.mjs';
import { CORE_SCHEMA_CHECKSUM, CORE_SCHEMA_VERSION } from './schema.mjs';
import { isCoreV1SyntheticFixtureKey } from './syntheticFixtures.mjs';

export const CORE_V1_HTTP_BASE_PATH = '/api/core/v1';
export const CORE_V1_MAX_JSON_BYTES = 65_536;
export const CORE_V1_MAX_QUERY_BYTES = 2_048;
export const CORE_V1_MAX_REPORT_SOURCE_IDS = 500;
export const CORE_REPORT_RELEASE_BINDING_VERSION = 'assesssuite.report-release-binding.v1';

const ERROR_CODE_RE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_RE = /^sha256:[a-f0-9]{64}$/;
const ADMIN_ROLES = new Set(['admin', 'administrator', 'owner', 'super_admin']);
const REVIEW_DECISIONS = new Set(['approve', 'reject', 'changes_requested']);
const RELEASE_AUTHORIZATION_EVENT = 'core.report.release_authorized';
const RELEASE_AUTHORIZATION_STATE = 'release_authorized';
const RELEASE_POLICY_VERSION = 'core-report-release-v1';

const ROUTES = Object.freeze({
  assessment: Object.freeze({
    id: 'core_v1.assessment_discovery',
    purpose: 'assessment_discovery',
  }),
  protocol: Object.freeze({
    id: 'core_v1.protocol_assistance',
    purpose: 'protocol_assistance',
  }),
  reportDraft: Object.freeze({
    id: 'core_v1.report_drafts',
    purpose: 'report_composition',
  }),
  submitReview: Object.freeze({
    id: 'core_v1.submit_review',
    purpose: 'artifact_review',
  }),
  reviewDecision: Object.freeze({
    id: 'core_v1.review_decision',
    purpose: 'artifact_review',
  }),
  releaseAuthorization: Object.freeze({
    id: 'core_v1.release_authorization',
    purpose: 'artifact_review',
  }),
  syntheticFixtureProvision: Object.freeze({
    id: 'core_v1.synthetic_fixture_provision',
    purpose: 'core_administration',
  }),
  assurance: Object.freeze({
    id: 'core_v1.assurance_summary',
    purpose: 'core_administration',
  }),
  runDetail: Object.freeze({
    id: 'core_v1.run_detail',
    purpose: 'core_administration',
  }),
  artifactDetail: Object.freeze({
    id: 'core_v1.artifact_detail',
    purpose: 'core_administration',
  }),
});

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactObject(value, { allowed, required = [], field = 'body' }) {
  if (!isPlainObject(value)) {
    throw new CoreContractError('CORE_INVALID_BODY', `${field} must be a JSON object`);
  }
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      throw new CoreContractError('CORE_UNKNOWN_FIELD', `${field} contains an unsupported field`);
    }
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new CoreContractError('CORE_REQUIRED_FIELD', `${field}.${key} is required`);
    }
  }
  return value;
}

function opaqueId(value, field) {
  if (typeof value !== 'string' || !ID_RE.test(value)) {
    throw new CoreContractError('CORE_INVALID_ID', `${field} must be an opaque identifier`);
  }
  return value;
}

function boundedString(value, field, { min = 1, max = 512 } = {}) {
  if (typeof value !== 'string') {
    throw new CoreContractError('CORE_INVALID_STRING', `${field} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new CoreContractError('CORE_INVALID_STRING', `${field} is outside its allowed length`);
  }
  return trimmed;
}

function nonNegativeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CoreContractError('CORE_INVALID_INTEGER', `${field} must be a non-negative integer`);
  }
  return value;
}

function boundedInteger(value, field, { min = 1, max = 25 } = {}) {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new CoreContractError('CORE_INVALID_INTEGER', `${field} is outside its allowed range`);
  }
  return parsed;
}

function canonicalInstant(value, field) {
  if (typeof value !== 'string') {
    throw new CoreContractError('CORE_INVALID_TIMESTAMP', `${field} must be a timestamp`);
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) {
    throw new CoreContractError('CORE_INVALID_TIMESTAMP', `${field} must be canonical UTC`);
  }
  return value;
}

function bodySize(value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new CoreContractError('CORE_INVALID_JSON', 'request body is not valid JSON');
  }
  const bytes = Buffer.byteLength(serialized ?? '', 'utf8');
  if (bytes > CORE_V1_MAX_JSON_BYTES) {
    throw new CoreContractError('CORE_BODY_TOO_LARGE', 'request body exceeds the Core limit', {
      httpStatus: 413,
    });
  }
  return value;
}

function jsonCompatible(value, field) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    throw new CoreContractError('CORE_INVALID_JSON', `${field} is not JSON-compatible`);
  }
}

function exactQuery(searchParams, allowed) {
  const allowedSet = new Set(allowed);
  const seen = new Set();
  for (const [key] of searchParams.entries()) {
    if (!allowedSet.has(key)) {
      throw new CoreContractError('CORE_UNKNOWN_QUERY', 'query contains an unsupported field');
    }
    if (seen.has(key)) {
      throw new CoreContractError('CORE_DUPLICATE_QUERY', 'query fields must not repeat');
    }
    seen.add(key);
  }
}

function requestHeader(request, name) {
  const wanted = name.toLowerCase();
  const headers = request.headers;
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return Array.isArray(value) ? value[0] : value;
  }
  return null;
}

function nowIso(clock) {
  const raw = clock();
  const date = raw instanceof Date ? raw : new Date(raw);
  if (!Number.isFinite(date.getTime())) {
    throw new CoreContractError('CORE_INVALID_CLOCK', 'Core HTTP clock is invalid');
  }
  return date.toISOString();
}

function safeError(error) {
  if (
    error instanceof CoreContractError
    && ERROR_CODE_RE.test(error.code)
    && Number.isInteger(error.httpStatus)
  ) {
    return { code: error.code, status: error.httpStatus };
  }
  return { code: 'CORE_INTERNAL_ERROR', status: 500 };
}

function response(status, body, extra = {}) {
  return Object.freeze({ handled: true, status, body, ...extra });
}

function defaultIsAdmin(sessionUser) {
  return ADMIN_ROLES.has(String(sessionUser?.role || '').trim().toLowerCase());
}

function reportReleaseControl(artifact, reviews, releaseAuthorizations, subject) {
  if (!artifact || artifact.artifactType !== 'report') {
    return Object.freeze({ approvedReview: null, releaseAuthorization: null, complete: false });
  }
  const approvedReview = reviews.find((review) => (
    review.artifactId === artifact.artifactId
    && review.state === 'approved'
    && review.reviewerActorId
  ));
  const releaseAuthorization = releaseAuthorizations.find((event) => (
    event.eventType === RELEASE_AUTHORIZATION_EVENT
    && event.entityType === 'artifact'
    && event.entityId === artifact.artifactId
    && event.orgId === artifact.orgId
    && event.outcome === 'succeeded'
    && event.fromState === 'approved'
    && event.toState === RELEASE_AUTHORIZATION_STATE
    && event.actorUserId
    && event.actorUserId !== artifact.createdBy
    && event.actorUserId !== approvedReview?.reviewerActorId
    && event.metadata?.artifactType === 'report'
    && event.metadata?.policyVersion === RELEASE_POLICY_VERSION
    && event.metadata?.subjectType === subject?.type
    && event.metadata?.subjectId === subject?.id
    && event.metadata?.contentFingerprint === artifact.content?.version?.contentFingerprint
    && event.metadata?.compatibilityVersion === LEGACY_REPORT_COMPATIBILITY_VERSION
    && SHA256_RE.test(event.metadata?.renderFingerprint ?? '')
  ));
  const complete = artifact.state === 'approved'
    && artifact.content?.artifactType === 'report'
    && artifact.content?.subject?.type === subject?.type
    && artifact.content?.subject?.id === subject?.id
    && artifact.content?.lifecycle?.state === 'draft'
    && artifact.content?.validation?.blockerCount === 0
    && Boolean(approvedReview)
    && artifact.createdBy !== approvedReview.reviewerActorId
    && Boolean(releaseAuthorization);
  return Object.freeze({ approvedReview, releaseAuthorization, complete });
}

function assertReportApprovalEligible(artifact) {
  if (
    artifact?.artifactType !== 'report'
    || artifact.content?.artifactType !== 'report'
    || artifact.content?.artifactId !== artifact.artifactId
    || artifact.content?.lifecycle?.state !== 'draft'
    || !artifact.content?.version?.contentFingerprint
    || artifact.content?.version?.createdBy !== artifact.createdBy
  ) {
    throw new CoreContractError(
      'CORE_REPORT_LINEAGE_INVALID',
      'report content is not bound to the artifact under review',
      { httpStatus: 409 },
    );
  }
  if (
    artifact.content?.validation?.blockerCount !== 0
    || artifact.content?.validation?.status === 'blocked'
  ) {
    throw new CoreContractError(
      'CORE_REPORT_VALIDATION_BLOCKED',
      'a report with unresolved validation blockers cannot be approved',
      { httpStatus: 409 },
    );
  }
}

function validateAssessmentBody(body) {
  bodySize(body);
  exactObject(body, {
    allowed: ['subjectId', 'limit'],
    required: ['subjectId'],
  });
  return {
    subjectId: opaqueId(body.subjectId, 'body.subjectId'),
    limit: body.limit === undefined ? 5 : boundedInteger(body.limit, 'body.limit'),
  };
}

function validateTemplateSelector(value) {
  exactObject(value, {
    field: 'body.templateSelector',
    allowed: ['templateKey', 'legacyReportType', 'purpose', 'funder', 'horizon'],
  });
  const normalized = {};
  for (const [key, item] of Object.entries(value)) {
    normalized[key] = boundedString(item, `body.templateSelector.${key}`, { max: 160 });
  }
  if (Object.keys(normalized).length === 0) {
    throw new CoreContractError('CORE_REQUIRED_FIELD', 'a report template selector is required');
  }
  return normalized;
}

function validateReportingPeriod(value = {}) {
  exactObject(value, {
    field: 'body.reportingPeriod',
    allowed: ['start', 'end'],
  });
  const date = (item, field) => {
    if (item === undefined || item === null || item === '') return null;
    if (typeof item !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item)) {
      throw new CoreContractError('CORE_INVALID_DATE', `${field} must use YYYY-MM-DD`);
    }
    const parsed = new Date(`${item}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== item) {
      throw new CoreContractError('CORE_INVALID_DATE', `${field} is invalid`);
    }
    return item;
  };
  return {
    start: date(value.start, 'body.reportingPeriod.start'),
    end: date(value.end, 'body.reportingPeriod.end'),
  };
}

function validateSections(sections = []) {
  if (!Array.isArray(sections) || sections.length > 50) {
    throw new CoreContractError('CORE_INVALID_SECTIONS', 'sections must contain at most 50 items');
  }
  return sections.map((section, index) => {
    exactObject(section, {
      field: `body.sections[${index}]`,
      allowed: ['sectionKey', 'heading', 'body', 'sourceIds'],
      required: ['sectionKey', 'body'],
    });
    if (!Array.isArray(section.sourceIds ?? []) || (section.sourceIds ?? []).length > 100) {
      throw new CoreContractError('CORE_INVALID_SOURCE_IDS', 'section source identifiers are invalid');
    }
    const normalized = {
      sectionKey: boundedString(section.sectionKey, `body.sections[${index}].sectionKey`, { max: 96 }),
      body: typeof section.body === 'string' && section.body.length <= 12_000
        ? section.body
        : (() => { throw new CoreContractError('CORE_INVALID_SECTION_BODY', 'section body is invalid'); })(),
      sourceIds: (section.sourceIds ?? []).map((id, sourceIndex) => (
        opaqueId(id, `body.sections[${index}].sourceIds[${sourceIndex}]`)
      )),
    };
    if (section.heading !== undefined) {
      normalized.heading = boundedString(
        section.heading,
        `body.sections[${index}].heading`,
        { max: 240 },
      );
    }
    return normalized;
  });
}

function validateClaims(claims = []) {
  if (!Array.isArray(claims) || claims.length > 200) {
    throw new CoreContractError('CORE_INVALID_CLAIMS', 'claims must contain at most 200 items');
  }
  const allowed = [
    'claimId', 'sectionKey', 'text', 'assertionType', 'authoringMode', 'requiresSource',
    'sourceIds', 'factKey', 'factScope', 'factValue', 'contradictsClaimIds',
  ];
  return claims.map((claim, index) => {
    exactObject(claim, {
      field: `body.claims[${index}]`,
      allowed,
      required: ['claimId', 'sectionKey', 'text'],
    });
    for (const key of ['sourceIds', 'contradictsClaimIds']) {
      if (!Array.isArray(claim[key] ?? []) || (claim[key] ?? []).length > 100) {
        throw new CoreContractError('CORE_INVALID_CLAIMS', `claim ${key} is invalid`);
      }
    }
    if (typeof claim.text !== 'string' || claim.text.length > 4_000) {
      throw new CoreContractError('CORE_INVALID_CLAIMS', 'claim text is invalid');
    }
    if (claim.requiresSource !== undefined && typeof claim.requiresSource !== 'boolean') {
      throw new CoreContractError('CORE_INVALID_CLAIMS', 'requiresSource must be boolean');
    }
    return {
      ...claim,
      claimId: opaqueId(claim.claimId, `body.claims[${index}].claimId`),
      sectionKey: boundedString(claim.sectionKey, `body.claims[${index}].sectionKey`, { max: 96 }),
      sourceIds: (claim.sourceIds ?? []).map((id) => opaqueId(id, 'body.claims.sourceIds')),
      contradictsClaimIds: (claim.contradictsClaimIds ?? []).map((id) => opaqueId(id, 'body.claims.contradictsClaimIds')),
    };
  });
}

function validateReportBody(body) {
  bodySize(body);
  exactObject(body, {
    allowed: [
      'subjectId', 'templateSelector', 'sourceCutoff', 'reportingPeriod',
      'sections', 'claims', 'supersedesArtifactId',
    ],
    required: ['subjectId', 'templateSelector', 'sourceCutoff'],
  });
  return {
    subjectId: opaqueId(body.subjectId, 'body.subjectId'),
    templateSelector: validateTemplateSelector(body.templateSelector),
    sourceCutoff: canonicalInstant(body.sourceCutoff, 'body.sourceCutoff'),
    reportingPeriod: validateReportingPeriod(body.reportingPeriod),
    sections: validateSections(body.sections),
    claims: validateClaims(body.claims),
    supersedesArtifactId: body.supersedesArtifactId == null
      ? null
      : opaqueId(body.supersedesArtifactId, 'body.supersedesArtifactId'),
  };
}

function validateSubmitReviewBody(body) {
  bodySize(body);
  exactObject(body, {
    allowed: ['expectedArtifactStateVersion'],
    required: ['expectedArtifactStateVersion'],
  });
  return {
    expectedArtifactStateVersion: nonNegativeInteger(
      body.expectedArtifactStateVersion,
      'body.expectedArtifactStateVersion',
    ),
  };
}

function validateReviewDecisionBody(body) {
  bodySize(body);
  exactObject(body, {
    allowed: ['decision', 'expectedReviewStateVersion', 'expectedArtifactStateVersion'],
    required: ['decision', 'expectedReviewStateVersion', 'expectedArtifactStateVersion'],
  });
  if (!REVIEW_DECISIONS.has(body.decision)) {
    throw new CoreContractError('CORE_INVALID_REVIEW_DECISION', 'review decision is invalid');
  }
  return {
    decision: body.decision,
    expectedReviewStateVersion: nonNegativeInteger(
      body.expectedReviewStateVersion,
      'body.expectedReviewStateVersion',
    ),
    expectedArtifactStateVersion: nonNegativeInteger(
      body.expectedArtifactStateVersion,
      'body.expectedArtifactStateVersion',
    ),
  };
}

function validateReleaseAuthorizationBody(body) {
  bodySize(body);
  exactObject(body, {
    allowed: [
      'expectedArtifactStateVersion',
      'contentFingerprint',
      'reportHtmlFingerprint',
      'compatibilityVersion',
    ],
    required: [
      'expectedArtifactStateVersion',
      'contentFingerprint',
      'reportHtmlFingerprint',
      'compatibilityVersion',
    ],
  });
  const contentFingerprint = opaqueId(body.contentFingerprint, 'body.contentFingerprint');
  const reportHtmlFingerprint = String(body.reportHtmlFingerprint || '');
  if (!SHA256_RE.test(reportHtmlFingerprint)) {
    throw new CoreContractError(
      'CORE_INVALID_RENDER_FINGERPRINT',
      'reportHtmlFingerprint must be a SHA-256 digest',
    );
  }
  if (body.compatibilityVersion !== LEGACY_REPORT_COMPATIBILITY_VERSION) {
    throw new CoreContractError(
      'CORE_COMPATIBILITY_VERSION_MISMATCH',
      'legacy compatibility version is not supported',
      { httpStatus: 409 },
    );
  }
  return {
    expectedArtifactStateVersion: nonNegativeInteger(
      body.expectedArtifactStateVersion,
      'body.expectedArtifactStateVersion',
    ),
    contentFingerprint,
    reportHtmlFingerprint,
    compatibilityVersion: body.compatibilityVersion,
  };
}

function validateSyntheticFixtureProvisionBody(body) {
  bodySize(body);
  exactObject(body, {
    allowed: ['fixtureKey'],
    required: ['fixtureKey'],
  });
  if (!isCoreV1SyntheticFixtureKey(body.fixtureKey)) {
    throw new CoreContractError(
      'CORE_SYNTHETIC_FIXTURE_NOT_ALLOWLISTED',
      'synthetic fixture key is not allowlisted',
    );
  }
  return { fixtureKey: body.fixtureKey };
}

function validateSyntheticFixtureProvisionResult(value, requestedFixtureKey) {
  const fail = () => {
    throw new CoreContractError(
      'CORE_SYNTHETIC_FIXTURE_PROVISION_FAILED',
      'synthetic fixture provisioner returned an invalid result',
      { httpStatus: 500 },
    );
  };
  const hasExactKeys = (candidate, expectedKeys) => {
    if (!isPlainObject(candidate)) return false;
    const actual = Object.keys(candidate).sort();
    const expected = [...expectedKeys].sort();
    return actual.length === expected.length
      && actual.every((key, index) => key === expected[index]);
  };
  if (
    !hasExactKeys(value, ['fixtureKey', 'subject', 'sources', 'sourceCutoff', 'created'])
    || value.fixtureKey !== requestedFixtureKey
    || !hasExactKeys(value.subject, ['type', 'id'])
    || value.subject.type !== 'client'
    || !hasExactKeys(value.sources, ['clientConditionId', 'clientAssessmentId'])
    || typeof value.created !== 'boolean'
  ) fail();
  let subjectId;
  let clientConditionId;
  let clientAssessmentId;
  let sourceCutoff;
  try {
    subjectId = opaqueId(value.subject.id, 'provisionResult.subject.id');
    clientConditionId = opaqueId(
      value.sources.clientConditionId,
      'provisionResult.sources.clientConditionId',
    );
    clientAssessmentId = opaqueId(
      value.sources.clientAssessmentId,
      'provisionResult.sources.clientAssessmentId',
    );
    sourceCutoff = canonicalInstant(value.sourceCutoff, 'provisionResult.sourceCutoff');
  } catch {
    fail();
  }
  if (new Set([subjectId, clientConditionId, clientAssessmentId]).size !== 3) fail();
  return {
    fixtureKey: requestedFixtureKey,
    subject: { type: 'client', id: subjectId },
    sources: { clientConditionId, clientAssessmentId },
    sourceCutoff,
    created: value.created,
  };
}

function assertResolverResult(value, field) {
  if (!isPlainObject(value)) {
    throw new CoreContractError('CORE_SOURCE_RESOLUTION_FAILED', `${field} did not return an object`);
  }
  if (!Array.isArray(value.sourceReferences) || value.sourceReferences.length === 0) {
    throw new CoreContractError('CORE_SOURCE_RESOLUTION_FAILED', `${field} returned no source lineage`);
  }
  return value;
}

function assertBindingReady(repositories, purpose) {
  const binding = CORE_V1_SANDBOX_BINDINGS[purpose];
  if (!binding) throw new CoreContractError('CORE_BINDING_NOT_FOUND', 'sandbox binding is missing');
  const capability = repositories.capabilities.get(binding.capabilityKey);
  const config = repositories.configs.get(binding.configVersionId);
  if (capability?.state !== 'sandbox_only' || config?.state !== 'validated') {
    throw new CoreContractError(
      'CORE_SANDBOX_NOT_BOOTSTRAPPED',
      'sandbox capability and config are not ready',
      { httpStatus: 503 },
    );
  }
  if (
    capability.approvalRef !== null
    || capability.deploymentAuthorityRef !== null
    || capability.activeConfigVersionId !== null
    || config.deploymentAuthorityRef !== null
  ) {
    throw new CoreContractError(
      'CORE_SANDBOX_ELEVATION_DENIED',
      'sandbox binding contains production authority',
      { httpStatus: 409 },
    );
  }
  return binding;
}

async function readBoundedJson(req, maxBytes = CORE_V1_MAX_JSON_BYTES) {
  const declared = Number(req.headers?.['content-length']);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new CoreContractError('CORE_BODY_TOO_LARGE', 'request body exceeds the Core limit', {
      httpStatus: 413,
    });
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) {
      throw new CoreContractError('CORE_BODY_TOO_LARGE', 'request body exceeds the Core limit', {
        httpStatus: 413,
      });
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new CoreContractError('CORE_INVALID_JSON', 'request body is not valid JSON');
  }
}

function writeNodeJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(payload);
}

/**
 * Creates a disabled-by-default, dependency-injected Core V1 sandbox router.
 *
 * Mount contract:
 *   `if (await router.handle(req, res, parsedUrl)) return;`
 *
 * `resolveSessionUser`, `resolveAuthorisedOrgIds`, `resolveSelectedOrgId`,
 * profession/scope and admin checks must be backed by server-side session and
 * membership state. The router never trusts identity, profession, purpose or
 * route from body, query or headers. An injected assurance-only tenant selector
 * may accept a query value only after intersecting it with server-derived
 * authorised organisations.
 */
export function createCoreV1HttpRouter({
  repositories,
  sandboxEnabled = false,
  resolveSessionUser,
  resolveAuthorisedOrgIds,
  resolveSelectedOrgId = () => null,
  resolveProfession = (sessionUser) => sessionUser?.profession ?? null,
  resolveProtocolScope,
  isAdmin = defaultIsAdmin,
  isClinicalReviewer = ({ requestContext }) => (
    requestContext.actor.profession === 'exercise_physiologist'
    || requestContext.actor.profession === 'accredited_exercise_physiologist'
  ),
  isReleaseController = ({ requestContext }) => ADMIN_ROLES.has(requestContext.actor.role),
  productionReleaseAuthority = false,
  resolveAssessmentSources,
  resolveProtocolCatalogue,
  resolveVerifiedReportSources,
  provisionSyntheticFixture,
  resolveRequestId = () => randomUUID(),
  resolveCorrelationId = () => null,
  clock = () => new Date(),
  idFactory = randomUUID,
  readJsonBody = readBoundedJson,
  sendJson = writeNodeJson,
} = {}) {
  if (!repositories) throw new TypeError('repositories are required');
  if (typeof resolveSessionUser !== 'function') throw new TypeError('resolveSessionUser is required');
  if (typeof resolveAuthorisedOrgIds !== 'function') throw new TypeError('resolveAuthorisedOrgIds is required');
  if (typeof resolveAssessmentSources !== 'function') throw new TypeError('resolveAssessmentSources is required');
  if (typeof resolveProtocolCatalogue !== 'function') throw new TypeError('resolveProtocolCatalogue is required');
  if (typeof resolveVerifiedReportSources !== 'function') throw new TypeError('resolveVerifiedReportSources is required');
  if (typeof provisionSyntheticFixture !== 'function') throw new TypeError('provisionSyntheticFixture is required');
  if (typeof resolveProtocolScope !== 'function') throw new TypeError('resolveProtocolScope is required');
  if (typeof isReleaseController !== 'function') throw new TypeError('isReleaseController must be a function');
  if (typeof productionReleaseAuthority !== 'boolean') {
    throw new TypeError('productionReleaseAuthority must be boolean');
  }

  function appendAudit(requestContext, {
    eventType,
    action,
    outcome,
    entityType = 'system',
    entityId = null,
    runId = null,
    fromState = null,
    toState = null,
    reasonCode = null,
    metadata = {},
  }) {
    return repositories.audit.append(createAuditEvent({
      eventId: idFactory(),
      eventType,
      action,
      outcome,
      entityType,
      entityId,
      orgId: requestContext.orgId,
      actorUserId: requestContext.actor.userId,
      requestId: requestContext.requestId,
      runId,
      fromState,
      toState,
      reasonCode,
      metadata: { sandbox: true, ...metadata },
      occurredAt: nowIso(clock),
    }));
  }

  function artifactReleaseAuthorizations(artifact) {
    return repositories.audit.listSummaries({
      orgId: artifact.orgId,
      eventType: RELEASE_AUTHORIZATION_EVENT,
      entityType: 'artifact',
      entityId: artifact.artifactId,
      limit: 100,
    });
  }

  function artifactReportSubject(artifact) {
    if (!artifact || artifact.artifactType !== 'report') return null;
    const snapshot = repositories.contextSnapshots.get(
      artifact.contextSnapshotId,
      artifact.orgId,
    );
    const snapshotSubject = snapshot?.subject;
    const contentSubject = artifact.content?.subject;
    const contentSubjectKeys = contentSubject && typeof contentSubject === 'object' && !Array.isArray(contentSubject)
      ? Object.keys(contentSubject).sort()
      : [];
    if (
      !snapshot
      || snapshot.orgId !== artifact.orgId
      || !snapshotSubject
      || contentSubjectKeys.length !== 2
      || contentSubjectKeys[0] !== 'id'
      || contentSubjectKeys[1] !== 'type'
      || contentSubject.type !== snapshotSubject.type
      || contentSubject.id !== snapshotSubject.id
    ) {
      throw new CoreContractError(
        'CORE_REPORT_SUBJECT_MISMATCH',
        'report subject is not bound to its immutable context snapshot',
        { httpStatus: 409 },
      );
    }
    return snapshotSubject;
  }

  function productionReleaseReady(artifact) {
    if (sandboxEnabled === true || productionReleaseAuthority !== true) return false;
    const capability = repositories.capabilities.get('report_composition');
    const config = repositories.configs.get(artifact.configVersionId);
    return capability?.state === 'production_active'
      && capability.activeConfigVersionId === artifact.configVersionId
      && Boolean(capability.deploymentAuthorityRef)
      && config?.state === 'active'
      && config.configKey === 'report_composition'
      && config.config?.export === 'enabled'
      && Boolean(config.deploymentAuthorityRef);
  }

  function releasePosture(artifact, reviews = null, authorizations = null) {
    const subject = artifactReportSubject(artifact);
    const resolvedReviews = reviews ?? repositories.reviews.listSummaries({
      orgId: artifact.orgId,
      artifactId: artifact.artifactId,
      limit: 100,
    });
    const resolvedAuthorizations = authorizations ?? artifactReleaseAuthorizations(artifact);
    const control = reportReleaseControl(artifact, resolvedReviews, resolvedAuthorizations, subject);
    const releaseEligible = control.complete && productionReleaseReady(artifact);
    const releaseBinding = control.complete
      ? Object.freeze({
          schemaVersion: CORE_REPORT_RELEASE_BINDING_VERSION,
          environment: sandboxEnabled === true ? 'sandbox' : 'production',
          artifactId: artifact.artifactId,
          orgId: artifact.orgId,
          subjectType: subject.type,
          subjectId: subject.id,
          artifactState: artifact.state,
          artifactStateVersion: artifact.stateVersion,
          authorActorId: artifact.content.version.createdBy,
          contentHash: artifact.contentHash,
          contentFingerprint: artifact.content.version.contentFingerprint,
          reportHtmlFingerprint: control.releaseAuthorization.metadata.renderFingerprint,
          compatibilityVersion: control.releaseAuthorization.metadata.compatibilityVersion,
          reviewId: control.approvedReview.reviewId,
          reviewerActorId: control.approvedReview.reviewerActorId,
          releaseAuthorizationEventId: control.releaseAuthorization.eventId,
          releaseControllerActorId: control.releaseAuthorization.actorUserId,
          releaseControlComplete: control.complete,
          releaseEligible,
          productionReleaseAuthority: productionReleaseReady(artifact),
        })
      : null;
    return Object.freeze({
      reviews: resolvedReviews,
      releaseAuthorizations: resolvedAuthorizations,
      releaseControlComplete: control.complete,
      releaseEligible,
      releaseBinding,
    });
  }

  async function trustedContext(route, request) {
    const sessionUser = await resolveSessionUser(request.rawRequest ?? request);
    if (!sessionUser) {
      throw new CoreContractError('CORE_AUTH_REQUIRED', 'authentication is required', { httpStatus: 401 });
    }
    if (!await isAdmin(sessionUser, request.rawRequest ?? request)) {
      throw new CoreContractError('CORE_ADMIN_REQUIRED', 'sandbox routes require an administrator', {
        httpStatus: 403,
      });
    }
    const authorisedOrgIds = await resolveAuthorisedOrgIds(
      sessionUser,
      request.rawRequest ?? request,
    );
    const selectedOrgId = await resolveSelectedOrgId({
      sessionUser,
      authorisedOrgIds,
      request: request.rawRequest ?? request,
    });
    const profession = await resolveProfession(sessionUser, request.rawRequest ?? request);
    return deriveRequestContext({
      requestId: await resolveRequestId(request.rawRequest ?? request),
      correlationId: await resolveCorrelationId(request.rawRequest ?? request),
      sessionUser: { ...sessionUser, profession },
      authorisedOrgIds,
      selectedOrgId,
      purpose: route.purpose,
      routeId: route.id,
      receivedAt: nowIso(clock),
    });
  }

  function persistExecution({
    requestContext,
    purpose,
    subject,
    sourceReferences,
    snapshotContext,
    cutoffAt,
    requestPayload,
    artifactId = idFactory(),
    artifactType,
    artifactContent,
    supersedesArtifactId = null,
    audit = null,
  }) {
    const binding = assertBindingReady(repositories, purpose);
    const createdAt = nowIso(clock);
    const snapshot = createContextSnapshot({
      requestContext,
      subject,
      sources: sourceReferences,
      context: jsonCompatible(
        { requestId: requestContext.requestId, resolved: snapshotContext },
        'snapshot context',
      ),
      cutoffAt,
      createdAt,
      idFactory,
    });
    const requestHash = fingerprintIdempotentRequest({ requestContext, payload: requestPayload });
    return repositories.withTransaction(() => {
      repositories.contextSnapshots.insert(snapshot);
      let run = repositories.runs.create({
        requestContext,
        runId: idFactory(),
        runType: purpose,
        executionMode: 'sandbox',
        contextSnapshotId: snapshot.snapshotId,
        capabilityKey: binding.capabilityKey,
        configVersionId: binding.configVersionId,
        requestHash,
        createdAt,
      });
      run = repositories.runs.transition({
        requestContext,
        runId: run.runId,
        expectedStateVersion: run.stateVersion,
        transition: transitionRunState('queued', 'running', {
          contextSnapshotId: snapshot.snapshotId,
          configVersionId: binding.configVersionId,
          capabilityKey: binding.capabilityKey,
        }),
      });
      const artifact = repositories.artifacts.create({
        requestContext,
        artifactId,
        artifactType,
        contextSnapshotId: snapshot.snapshotId,
        runId: run.runId,
        configVersionId: binding.configVersionId,
        content: jsonCompatible(artifactContent, 'artifact content'),
        supersedesArtifactId,
        createdAt,
      });
      run = repositories.runs.transition({
        requestContext,
        runId: run.runId,
        expectedStateVersion: run.stateVersion,
        transition: transitionRunState('running', 'succeeded', {
          resultArtifactIds: [artifact.artifactId],
          completedAt: nowIso(clock),
        }),
      });
      if (audit) audit({ snapshot, run, artifact });
      return { snapshot, run, artifact };
    });
  }

  async function assessmentDiscovery(request, requestContext) {
    const input = validateAssessmentBody(request.body);
    const resolved = assertResolverResult(await resolveAssessmentSources({
      requestContext,
      subjectId: input.subjectId,
      sourceCutoff: requestContext.receivedAt,
    }), 'assessment source resolver');
    if (!Array.isArray(resolved.assessments) || !Array.isArray(resolved.conditions)) {
      throw new CoreContractError('CORE_SOURCE_RESOLUTION_FAILED', 'assessment sources are incomplete');
    }
    const result = discoverAssessments({
      assessments: resolved.assessments,
      conditions: resolved.conditions,
      existingAssessmentIds: resolved.existingAssessmentIds ?? [],
      limit: input.limit,
    });
    const lineage = persistExecution({
      requestContext,
      purpose: 'assessment_discovery',
      subject: resolved.subject ?? { type: 'client', id: input.subjectId },
      sourceReferences: resolved.sourceReferences,
      snapshotContext: resolved.context ?? {
        assessmentCount: resolved.assessments.length,
        conditionCount: resolved.conditions.length,
      },
      cutoffAt: resolved.cutoffAt ?? requestContext.receivedAt,
      requestPayload: input,
      artifactType: 'assessment_discovery',
      artifactContent: result,
      audit: ({ run, artifact }) => appendAudit(requestContext, {
        eventType: 'core.assessment.completed',
        action: 'discover',
        outcome: 'succeeded',
        entityType: 'artifact',
        entityId: artifact.artifactId,
        runId: run.runId,
        metadata: {
          artifactType: artifact.artifactType,
          itemCount: result.recommendations?.length ?? 0,
          sourceCount: resolved.sourceReferences.length,
        },
      }),
    });
    return response(200, {
      runId: lineage.run.runId,
      artifactId: lineage.artifact.artifactId,
      state: result.status,
      recommendations: result.recommendations,
      counts: result.counts,
      releaseEligible: false,
    });
  }

  async function protocolAssistance(request, requestContext) {
    exactQuery(request.searchParams, ['q', 'limit']);
    const query = boundedString(request.searchParams.get('q') ?? '', 'query.q', {
      min: 1,
      max: MAX_PROTOCOL_QUERY_LENGTH,
    });
    const limit = request.searchParams.has('limit')
      ? boundedInteger(request.searchParams.get('limit'), 'query.limit')
      : 10;
    const profession = requestContext.actor.profession;
    const scope = await resolveProtocolScope({
      requestContext,
      sessionUser: request.sessionUser,
      request: request.rawRequest ?? request,
    });
    if (!profession || !scope) {
      throw new CoreContractError('CORE_CLINICAL_SCOPE_REQUIRED', 'clinical profession and scope are required', {
        httpStatus: 403,
      });
    }
    const resolved = assertResolverResult(await resolveProtocolCatalogue({
      requestContext,
      profession,
      scope,
    }), 'protocol catalogue resolver');
    if (!Array.isArray(resolved.catalogue)) {
      throw new CoreContractError('CORE_SOURCE_RESOLUTION_FAILED', 'protocol catalogue is unavailable');
    }
    const result = searchProtocolCatalogue({
      query,
      catalogue: resolved.catalogue,
      profession,
      scope,
      limit,
      asOf: requestContext.receivedAt.slice(0, 10),
    });
    const lineage = persistExecution({
      requestContext,
      purpose: 'protocol_assistance',
      subject: null,
      sourceReferences: resolved.sourceReferences,
      snapshotContext: resolved.context ?? { catalogueCount: resolved.catalogue.length },
      cutoffAt: resolved.cutoffAt ?? requestContext.receivedAt,
      requestPayload: { query, limit },
      artifactType: 'protocol_search_result',
      artifactContent: result,
      audit: ({ run, artifact }) => appendAudit(requestContext, {
        eventType: 'core.protocol.completed',
        action: 'search',
        outcome: 'succeeded',
        entityType: 'artifact',
        entityId: artifact.artifactId,
        runId: run.runId,
        metadata: {
          artifactType: artifact.artifactType,
          itemCount: result.matches?.length ?? 0,
          sourceCount: resolved.sourceReferences.length,
        },
      }),
    });
    return response(200, {
      runId: lineage.run.runId,
      artifactId: lineage.artifact.artifactId,
      ...result,
      releaseEligible: false,
    });
  }

  async function reportDraft(request, requestContext) {
    const input = validateReportBody(request.body);
    const requestedSourceIds = [...new Set([
      ...input.sections.flatMap((section) => section.sourceIds),
      ...input.claims.flatMap((claim) => claim.sourceIds),
    ])].sort((left, right) => left.localeCompare(right));
    if (requestedSourceIds.length === 0) {
      throw new CoreContractError(
        'CORE_REPORT_SOURCE_REQUIRED',
        'report drafts require at least one explicit source identifier',
      );
    }
    if (requestedSourceIds.length > CORE_V1_MAX_REPORT_SOURCE_IDS) {
      throw new CoreContractError(
        'CORE_REPORT_SOURCE_LIMIT',
        'report source identifiers exceed the bounded Core limit',
        { httpStatus: 413 },
      );
    }
    const idempotencyKey = requestHeader(request, 'idempotency-key');
    if (typeof idempotencyKey !== 'string') {
      throw new CoreContractError('CORE_IDEMPOTENCY_REQUIRED', 'report drafts require an idempotency key');
    }
    const requestHash = fingerprintIdempotentRequest({ requestContext, payload: input });
    const existing = repositories.idempotency.get(
      requestContext.orgId,
      requestContext.routeId,
      hashIdempotencyKey(idempotencyKey),
    );
    if (existing) {
      const posture = resolveIdempotencyReplay(existing, {
        requestHash,
        now: requestContext.receivedAt,
      });
      if (posture.action === 'in_progress') {
        throw new CoreContractError('CORE_IDEMPOTENCY_IN_PROGRESS', 'request is already in progress', {
          httpStatus: 409,
        });
      }
      if (posture.action === 'replay') {
        const artifact = repositories.artifacts.get(posture.responseRef, requestContext.orgId);
        if (!artifact) {
          throw new CoreContractError('CORE_IDEMPOTENCY_RESPONSE_MISSING', 'stored response is unavailable', {
            httpStatus: 409,
          });
        }
        appendAudit(requestContext, {
          eventType: 'core.report.replayed',
          action: 'replay',
          outcome: 'noop',
          entityType: 'artifact',
          entityId: artifact.artifactId,
          runId: artifact.runId,
          metadata: { artifactType: 'report', idempotentReplay: true },
        });
        const currentReleasePosture = releasePosture(artifact);
        return response(posture.responseStatus, {
          runId: artifact.runId,
          artifactId: artifact.artifactId,
          state: artifact.state,
          report: artifact.content,
          releaseControlComplete: currentReleasePosture.releaseControlComplete,
          releaseEligible: currentReleasePosture.releaseEligible,
          releaseBinding: currentReleasePosture.releaseBinding,
          idempotentReplay: true,
        });
      }
      repositories.idempotency.removeExpired(existing, requestContext.receivedAt);
    }

    const resolved = assertResolverResult(await resolveVerifiedReportSources({
      requestContext,
      subjectId: input.subjectId,
      sourceCutoff: input.sourceCutoff,
      requestedSourceIds,
    }), 'report source resolver');
    if (!Array.isArray(resolved.reportSources)) {
      throw new CoreContractError('CORE_SOURCE_RESOLUTION_FAILED', 'verified report sources are incomplete');
    }
    const reportSubject = resolved.subject ?? { type: 'client', id: input.subjectId };
    if (reportSubject.type !== 'client' || reportSubject.id !== input.subjectId) {
      throw new CoreContractError(
        'CORE_SOURCE_RESOLUTION_FAILED',
        'verified report sources do not match the requested subject',
        { httpStatus: 409 },
      );
    }
    const artifactId = idFactory();
    let composed;
    try {
      composed = composeReportDraft({
        artifactId,
        subject: reportSubject,
        templateSelector: input.templateSelector,
        sourceCutoff: input.sourceCutoff,
        reportingPeriod: input.reportingPeriod,
        sources: resolved.reportSources,
        sections: input.sections,
        claims: input.claims,
        generatedAt: requestContext.receivedAt,
        createdBy: requestContext.actor.userId,
        supersedesArtifactId: input.supersedesArtifactId,
      });
    } catch (error) {
      throw new CoreContractError('CORE_INVALID_REPORT_DRAFT', 'report draft failed validation', {
        cause: error,
      });
    }
    if (composed.lifecycle.state !== 'draft') {
      throw new CoreContractError('CORE_REPORT_NOT_DRAFT', 'composition must produce a draft', {
        httpStatus: 409,
      });
    }
    const createdAt = requestContext.receivedAt;
    const pending = createPendingIdempotencyRecord({
      requestContext,
      idempotencyKey,
      requestHash,
      createdAt,
      expiresAt: new Date(Date.parse(createdAt) + 24 * 60 * 60 * 1000).toISOString(),
    });
    const lineage = repositories.withTransaction(() => {
      const claim = repositories.idempotency.claim(pending);
      if (!claim.created) {
        throw new CoreContractError('CORE_IDEMPOTENCY_IN_PROGRESS', 'request is already in progress', {
          httpStatus: 409,
        });
      }
      const persisted = persistExecution({
        requestContext,
        purpose: 'report_composition',
        subject: reportSubject,
        sourceReferences: resolved.sourceReferences,
        snapshotContext: resolved.context ?? {
          sourceCount: resolved.reportSources.length,
          sourceCutoff: input.sourceCutoff,
        },
        cutoffAt: input.sourceCutoff,
        requestPayload: input,
        artifactId,
        artifactType: 'report',
        artifactContent: composed,
        supersedesArtifactId: input.supersedesArtifactId,
        audit: ({ run, artifact }) => appendAudit(requestContext, {
          eventType: 'core.report.created',
          action: 'compose',
          outcome: 'succeeded',
          entityType: 'artifact',
          entityId: artifact.artifactId,
          runId: run.runId,
          metadata: {
            artifactType: 'report',
            sourceCount: resolved.sourceReferences.length,
            idempotentReplay: false,
          },
        }),
      });
      repositories.idempotency.complete(claim.record, {
        responseRef: artifactId,
        responseStatus: 201,
      });
      return persisted;
    });
    return response(201, {
      runId: lineage.run.runId,
      artifactId: lineage.artifact.artifactId,
      state: lineage.artifact.state,
      report: lineage.artifact.content,
      releaseControlComplete: false,
      releaseEligible: false,
      releaseBinding: null,
      idempotentReplay: false,
    });
  }

  function submitReview(request, requestContext, artifactId) {
    const input = validateSubmitReviewBody(request.body);
    const artifact = repositories.artifacts.get(artifactId, requestContext.orgId);
    if (!artifact) {
      throw new CoreContractError('CORE_ARTIFACT_NOT_FOUND', 'artifact was not found', { httpStatus: 404 });
    }
    if (artifact.artifactType !== 'report') {
      throw new CoreContractError('CORE_ARTIFACT_NOT_REVIEWABLE', 'only report drafts use this review path', {
        httpStatus: 409,
      });
    }
    const result = repositories.withTransaction(() => {
      const transitioned = repositories.artifacts.transition({
        requestContext,
        artifactId,
        expectedStateVersion: input.expectedArtifactStateVersion,
        transition: transitionArtifactState('draft', 'review'),
        updatedAt: requestContext.receivedAt,
      });
      const review = repositories.reviews.create({
        requestContext,
        reviewId: idFactory(),
        artifactId,
        createdAt: requestContext.receivedAt,
      });
      appendAudit(requestContext, {
        eventType: 'core.review.submitted',
        action: 'submit',
        outcome: 'succeeded',
        entityType: 'review',
        entityId: review.reviewId,
        runId: transitioned.runId,
        fromState: 'draft',
        toState: 'review',
        metadata: { artifactType: 'report' },
      });
      return { artifact: transitioned, review };
    });
    return response(201, {
      artifact: result.artifact,
      review: result.review,
      releaseEligible: false,
    });
  }

  async function reviewDecision(request, requestContext, reviewId) {
    const input = validateReviewDecisionBody(request.body);
    let review = repositories.reviews.get(reviewId, requestContext.orgId);
    if (!review) {
      throw new CoreContractError('CORE_REVIEW_NOT_FOUND', 'review was not found', { httpStatus: 404 });
    }
    const artifact = repositories.artifacts.get(review.artifactId, requestContext.orgId);
    if (!artifact || artifact.artifactType !== 'report') {
      throw new CoreContractError('CORE_ARTIFACT_NOT_FOUND', 'review artifact was not found', { httpStatus: 404 });
    }
    if (input.decision === 'approve') assertReportApprovalEligible(artifact);
    if (input.decision === 'approve' && artifact.createdBy === requestContext.actor.userId) {
      throw new CoreContractError('CORE_SELF_APPROVAL_DENIED', 'an artifact creator cannot approve it', {
        httpStatus: 403,
      });
    }
    artifactReportSubject(artifact);
    if (!await isClinicalReviewer({
      requestContext,
      artifact,
      review,
      sessionUser: request.sessionUser,
      request: request.rawRequest ?? request,
    })) {
      throw new CoreContractError('CORE_CLINICAL_REVIEWER_REQUIRED', 'a clinical reviewer is required', {
        httpStatus: 403,
      });
    }
    const targetReviewState = input.decision === 'approve'
      ? 'approved'
      : input.decision === 'reject'
        ? 'rejected'
        : 'changes_requested';
    const targetArtifactState = input.decision === 'approve'
      ? 'approved'
      : input.decision === 'reject'
        ? 'rejected'
        : 'draft';
    const decisionCode = input.decision === 'approve'
      ? 'clinician_approved'
      : input.decision === 'reject'
        ? 'clinician_rejected'
        : 'clinician_changes_requested';
    const result = repositories.withTransaction(() => {
      const predecessor = input.decision === 'approve'
        ? repositories.artifacts.validatePredecessor({
            requestContext,
            artifactId: artifact.artifactId,
          })
        : null;
      review = repositories.reviews.transition({
        requestContext,
        reviewId,
        expectedStateVersion: input.expectedReviewStateVersion,
        transition: transitionReviewState('pending', 'in_review', {
          reviewerActorId: requestContext.actor.userId,
        }),
        updatedAt: requestContext.receivedAt,
      });
      review = repositories.reviews.transition({
        requestContext,
        reviewId,
        expectedStateVersion: review.stateVersion,
        transition: transitionReviewState('in_review', targetReviewState, {
          reviewerActorId: requestContext.actor.userId,
          decisionAt: requestContext.receivedAt,
          decisionCode,
        }),
        updatedAt: requestContext.receivedAt,
      });
      const transitionedArtifact = repositories.artifacts.transition({
        requestContext,
        artifactId: artifact.artifactId,
        expectedStateVersion: input.expectedArtifactStateVersion,
        transition: transitionArtifactState('review', targetArtifactState, { reviewId }),
        updatedAt: requestContext.receivedAt,
      });
      let supersededArtifact = null;
      if (predecessor) {
        supersededArtifact = repositories.artifacts.transition({
          requestContext,
          artifactId: predecessor.artifactId,
          expectedStateVersion: predecessor.stateVersion,
          transition: transitionArtifactState('approved', 'superseded', {
            successorArtifactId: transitionedArtifact.artifactId,
          }),
          updatedAt: requestContext.receivedAt,
        });
        appendAudit(requestContext, {
          eventType: 'core.report.superseded',
          action: 'supersede',
          outcome: 'succeeded',
          entityType: 'artifact',
          entityId: predecessor.artifactId,
          runId: predecessor.runId,
          fromState: 'approved',
          toState: 'superseded',
          metadata: { artifactType: 'report' },
        });
      }
      appendAudit(requestContext, {
        eventType: 'core.review.decided',
        action: 'decide',
        outcome: 'succeeded',
        entityType: 'review',
        entityId: review.reviewId,
        runId: transitionedArtifact.runId,
        fromState: 'review',
        toState: transitionedArtifact.state,
        metadata: { artifactType: 'report', decisionCode },
      });
      return { artifact: transitionedArtifact, review, supersededArtifact };
    });
    const posture = releasePosture(result.artifact, [result.review], []);
    return response(200, {
      artifact: result.artifact,
      review: result.review,
      supersededArtifact: result.supersededArtifact,
      releaseControlComplete: posture.releaseControlComplete,
      releaseEligible: posture.releaseEligible,
      releaseBinding: posture.releaseBinding,
    });
  }

  async function authorizeRelease(request, requestContext, artifactId) {
    const input = validateReleaseAuthorizationBody(request.body);
    const artifact = repositories.artifacts.get(artifactId, requestContext.orgId);
    if (!artifact || artifact.artifactType !== 'report') {
      throw new CoreContractError('CORE_ARTIFACT_NOT_FOUND', 'report artifact was not found', {
        httpStatus: 404,
      });
    }
    artifactReportSubject(artifact);
    if (artifact.state !== 'approved' || artifact.stateVersion !== input.expectedArtifactStateVersion) {
      throw new CoreContractError(
        'CORE_STALE_ARTIFACT',
        'report approval state changed before release authorization',
        { httpStatus: 409 },
      );
    }
    assertReportApprovalEligible(artifact);
    if (artifact.content.version.contentFingerprint !== input.contentFingerprint) {
      throw new CoreContractError(
        'CORE_RELEASE_CONTENT_MISMATCH',
        'release authorization does not match the approved report content',
        { httpStatus: 409 },
      );
    }
    const reviews = repositories.reviews.listSummaries({
      orgId: requestContext.orgId,
      artifactId,
      limit: 100,
    });
    const approvedReview = reviews.find((candidate) => (
      candidate.state === 'approved' && candidate.reviewerActorId
    ));
    if (!approvedReview) {
      throw new CoreContractError(
        'CORE_CLINICAL_APPROVAL_REQUIRED',
        'release control requires a completed clinical approval',
        { httpStatus: 409 },
      );
    }
    if (
      requestContext.actor.userId === artifact.createdBy
      || requestContext.actor.userId === approvedReview.reviewerActorId
    ) {
      throw new CoreContractError(
        'CORE_RELEASE_CONTROLLER_SEPARATION_REQUIRED',
        'the report author and clinical reviewer cannot authorize release',
        { httpStatus: 403 },
      );
    }
    if (!await isReleaseController({
      requestContext,
      artifact,
      review: approvedReview,
      sessionUser: request.sessionUser,
      request: request.rawRequest ?? request,
    })) {
      throw new CoreContractError(
        'CORE_RELEASE_CONTROLLER_REQUIRED',
        'a server-authorized release controller is required',
        { httpStatus: 403 },
      );
    }
    if (artifactReleaseAuthorizations(artifact).length > 0) {
      throw new CoreContractError(
        'CORE_RELEASE_ALREADY_AUTHORIZED',
        'report release control has already been completed',
        { httpStatus: 409 },
      );
    }

    const result = repositories.withTransaction(() => {
      const current = repositories.artifacts.get(artifactId, requestContext.orgId);
      if (
        !current
        || current.state !== 'approved'
        || current.stateVersion !== input.expectedArtifactStateVersion
        || current.content.version.contentFingerprint !== input.contentFingerprint
      ) {
        throw new CoreContractError(
          'CORE_STALE_ARTIFACT',
          'report approval state changed before release authorization',
          { httpStatus: 409 },
        );
      }
      const currentSubject = artifactReportSubject(current);
      if (artifactReleaseAuthorizations(current).length > 0) {
        throw new CoreContractError(
          'CORE_RELEASE_ALREADY_AUTHORIZED',
          'report release control has already been completed',
          { httpStatus: 409 },
        );
      }
      const authorization = appendAudit(requestContext, {
        eventType: RELEASE_AUTHORIZATION_EVENT,
        action: 'authorize_release',
        outcome: 'succeeded',
        entityType: 'artifact',
        entityId: current.artifactId,
        runId: current.runId,
        fromState: 'approved',
        toState: RELEASE_AUTHORIZATION_STATE,
        reasonCode: 'release_control_completed',
        metadata: {
          artifactType: 'report',
          policyVersion: RELEASE_POLICY_VERSION,
          subjectType: currentSubject.type,
          subjectId: currentSubject.id,
          contentFingerprint: input.contentFingerprint,
          renderFingerprint: input.reportHtmlFingerprint,
          compatibilityVersion: input.compatibilityVersion,
        },
      });
      return { artifact: current, authorization };
    });
    const posture = releasePosture(result.artifact, reviews, [result.authorization]);
    return response(201, {
      artifact: result.artifact,
      review: approvedReview,
      releaseAuthorization: result.authorization,
      releaseControlComplete: posture.releaseControlComplete,
      releaseEligible: posture.releaseEligible,
      releaseBinding: posture.releaseBinding,
    });
  }

  function assuranceSummary(request, requestContext) {
    exactQuery(request.searchParams, ['org_id', 'limit']);
    const requestedOrgId = request.searchParams.get('org_id');
    if (requestedOrgId !== null && requestedOrgId !== requestContext.orgId) {
      throw new CoreContractError(
        'CORE_ORG_OUTSIDE_SCOPE',
        'assurance organisation does not match the server-selected scope',
        { httpStatus: 403 },
      );
    }
    const limit = request.searchParams.has('limit')
      ? boundedInteger(request.searchParams.get('limit'), 'query.limit', { min: 1, max: 100 })
      : 50;
    const capabilities = repositories.capabilities.listSummaries({ limit });
    const configVersions = repositories.configs.listSummaries({ orgId: requestContext.orgId, limit });
    const runs = repositories.runs.listSummaries({ orgId: requestContext.orgId, limit });
    const artifacts = repositories.artifacts.listSummaries({ orgId: requestContext.orgId, limit });
    const reviews = repositories.reviews.listSummaries({ orgId: requestContext.orgId, limit });
    const jobs = repositories.jobs.listSummaries({ orgId: requestContext.orgId, limit });
    const body = {
      schema: { version: String(CORE_SCHEMA_VERSION), checksum: CORE_SCHEMA_CHECKSUM },
      environment: { mode: 'sandbox', production_enabled: false },
      summary: {
        org_id: requestContext.orgId,
        capability_count: capabilities.length,
        config_version_count: configVersions.length,
        run_count: runs.length,
        artifact_count: artifacts.length,
        review_count: reviews.length,
        job_count: jobs.length,
      },
      capabilities,
      config_versions: configVersions,
      runs,
      artifacts,
      reviews,
      jobs,
    };
    return response(200, body);
  }

  async function syntheticFixtureProvision(request, requestContext) {
    exactQuery(request.searchParams, []);
    const input = validateSyntheticFixtureProvisionBody(request.body);
    const provisioned = validateSyntheticFixtureProvisionResult(
      await provisionSyntheticFixture({
        requestContext,
        fixtureKey: input.fixtureKey,
      }),
      input.fixtureKey,
    );
    appendAudit(requestContext, {
      eventType: 'core.synthetic_fixture.provisioned',
      action: 'provision',
      outcome: provisioned.created ? 'succeeded' : 'noop',
      metadata: {
        routeId: ROUTES.syntheticFixtureProvision.id,
        purpose: ROUTES.syntheticFixtureProvision.purpose,
        itemCount: 3,
        idempotentReplay: !provisioned.created,
      },
    });
    return response(provisioned.created ? 201 : 200, {
      ...provisioned,
      releaseEligible: false,
    });
  }

  function runDetail(request, requestContext, runId) {
    exactQuery(request.searchParams, []);
    const run = repositories.runs.get(runId, requestContext.orgId);
    if (!run) throw new CoreContractError('CORE_RUN_NOT_FOUND', 'run was not found', { httpStatus: 404 });
    return response(200, { run });
  }

  function artifactDetail(request, requestContext, artifactId) {
    exactQuery(request.searchParams, []);
    const artifact = repositories.artifacts.get(artifactId, requestContext.orgId);
    if (!artifact) {
      throw new CoreContractError('CORE_ARTIFACT_NOT_FOUND', 'artifact was not found', { httpStatus: 404 });
    }
    const reviews = repositories.reviews.listSummaries({
      orgId: requestContext.orgId,
      artifactId,
      limit: 100,
    });
    const posture = releasePosture(artifact, reviews);
    return response(200, {
      artifact,
      reviews,
      releaseAuthorizations: posture.releaseAuthorizations,
      releaseControlComplete: posture.releaseControlComplete,
      releaseEligible: posture.releaseEligible,
      releaseBinding: posture.releaseBinding,
    });
  }

  function matchRoute(method, pathname) {
    if (method === 'POST' && pathname === `${CORE_V1_HTTP_BASE_PATH}/assessment-discovery`) {
      return { route: ROUTES.assessment, handler: assessmentDiscovery };
    }
    if (method === 'GET' && pathname === `${CORE_V1_HTTP_BASE_PATH}/protocol-assistance/search`) {
      return { route: ROUTES.protocol, handler: protocolAssistance };
    }
    if (method === 'POST' && pathname === `${CORE_V1_HTTP_BASE_PATH}/report-drafts`) {
      return { route: ROUTES.reportDraft, handler: reportDraft };
    }
    if (
      method === 'POST'
      && pathname === `${CORE_V1_HTTP_BASE_PATH}/admin/synthetic-fixtures/provision`
    ) {
      return {
        route: ROUTES.syntheticFixtureProvision,
        handler: syntheticFixtureProvision,
      };
    }
    let match = new RegExp(`^${CORE_V1_HTTP_BASE_PATH}/artifacts/([^/]+)/submit-review$`).exec(pathname);
    if (method === 'POST' && match) {
      return {
        route: ROUTES.submitReview,
        handler: (request, context) => submitReview(request, context, opaqueId(match[1], 'artifactId')),
      };
    }
    match = new RegExp(`^${CORE_V1_HTTP_BASE_PATH}/reviews/([^/]+)/decision$`).exec(pathname);
    if (method === 'POST' && match) {
      return {
        route: ROUTES.reviewDecision,
        handler: (request, context) => reviewDecision(request, context, opaqueId(match[1], 'reviewId')),
      };
    }
    match = new RegExp(`^${CORE_V1_HTTP_BASE_PATH}/artifacts/([^/]+)/authorize-release$`).exec(pathname);
    if (method === 'POST' && match) {
      return {
        route: ROUTES.releaseAuthorization,
        handler: (request, context) => authorizeRelease(
          request,
          context,
          opaqueId(match[1], 'artifactId'),
        ),
      };
    }
    if (method === 'GET' && pathname === `${CORE_V1_HTTP_BASE_PATH}/assurance/summary`) {
      return { route: ROUTES.assurance, handler: assuranceSummary };
    }
    if (method === 'GET' && pathname === `${CORE_V1_HTTP_BASE_PATH}/admin/assurance`) {
      return { route: ROUTES.assurance, handler: assuranceSummary };
    }
    match = new RegExp(`^${CORE_V1_HTTP_BASE_PATH}/runs/([^/]+)$`).exec(pathname);
    if (method === 'GET' && match) {
      return {
        route: ROUTES.runDetail,
        handler: (request, context) => runDetail(request, context, opaqueId(match[1], 'runId')),
      };
    }
    match = new RegExp(`^${CORE_V1_HTTP_BASE_PATH}/artifacts/([^/]+)$`).exec(pathname);
    if (method === 'GET' && match) {
      return {
        route: ROUTES.artifactDetail,
        handler: (request, context) => artifactDetail(request, context, opaqueId(match[1], 'artifactId')),
      };
    }
    return null;
  }

  async function dispatch(input) {
    const method = String(input?.method || 'GET').toUpperCase();
    const url = input?.url instanceof URL
      ? input.url
      : new URL(input?.url || input?.pathname || '/', 'http://core.local');
    if (!url.pathname.startsWith(`${CORE_V1_HTTP_BASE_PATH}/`) && url.pathname !== CORE_V1_HTTP_BASE_PATH) {
      return Object.freeze({ handled: false });
    }
    if (sandboxEnabled !== true) {
      return response(404, { error: { code: 'CORE_NOT_FOUND' } });
    }
    if (Buffer.byteLength(url.search, 'utf8') > CORE_V1_MAX_QUERY_BYTES) {
      return response(414, { error: { code: 'CORE_QUERY_TOO_LARGE' } });
    }
    const matched = matchRoute(method, url.pathname);
    if (!matched) return response(404, { error: { code: 'CORE_NOT_FOUND' } });
    let requestContext = null;
    try {
      const request = {
        method,
        pathname: url.pathname,
        searchParams: url.searchParams,
        headers: input.headers ?? {},
        body: input.body ?? {},
        rawRequest: input.rawRequest ?? null,
        sessionUser: null,
      };
      requestContext = await trustedContext(matched.route, request);
      request.sessionUser = requestContext.actor;
      return await matched.handler(request, requestContext);
    } catch (error) {
      const safe = safeError(error);
      if (requestContext) {
        try {
          appendAudit(requestContext, {
            eventType: 'core.request.failed',
            action: 'execute',
            outcome: safe.status >= 500 ? 'failed' : 'denied',
            reasonCode: safe.code.toLowerCase(),
            metadata: {
              routeId: matched.route.id,
              purpose: matched.route.purpose,
              errorCode: safe.code,
              httpStatus: safe.status,
            },
          });
        } catch {
          // Audit failure must not widen the public error surface or expose the
          // rejected payload. The mount's infrastructure telemetry can record
          // only the fixed status/code response.
        }
      }
      return response(safe.status, { error: { code: safe.code } });
    }
  }

  async function handle(req, res, parsedUrl = null) {
    const url = parsedUrl instanceof URL
      ? parsedUrl
      : new URL(req.url || '/', 'http://core.local');
    if (!url.pathname.startsWith(`${CORE_V1_HTTP_BASE_PATH}/`) && url.pathname !== CORE_V1_HTTP_BASE_PATH) {
      return false;
    }
    if (sandboxEnabled !== true) {
      sendJson(res, 404, { error: { code: 'CORE_NOT_FOUND' } });
      return true;
    }
    let body = {};
    if (String(req.method || '').toUpperCase() === 'POST') {
      try {
        body = await readJsonBody(req, CORE_V1_MAX_JSON_BYTES);
      } catch (error) {
        const safe = safeError(error);
        sendJson(res, safe.status, { error: { code: safe.code } });
        return true;
      }
    }
    const result = await dispatch({
      method: req.method,
      url,
      headers: req.headers,
      body,
      rawRequest: req,
    });
    sendJson(res, result.status, result.body);
    return true;
  }

  return Object.freeze({ dispatch, handle });
}
