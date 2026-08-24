import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sentryReleaseForProfession } from '../packages/profession-config/sentry-release.mjs';

export const PHYSIO_SENTRY_SOURCE_MAP_MANIFEST_CONTRACT =
  'assesssuite-physio-sentry-source-map-manifest/1.0.0';
export const PHYSIO_SENTRY_RELEASE_CONTRACT =
  'assesssuite-physio-sentry-release/1.0.0';
export const PHYSIO_SENTRY_DEPLOYMENT_CONTRACT =
  'assesssuite-physio-sentry-deployment/2.0.0';
export const PHYSIO_SENTRY_PHASE_CONTRACT =
  'assesssuite-physio-sentry-release-phase/2.0.0';
export const PHYSIO_SENTRY_RECONCILIATION_CONTRACT =
  'assesssuite-physio-sentry-release-reconciliation/2.0.0';
export const PHYSIO_SENTRY_CURRENT_READINESS_CONTRACT =
  'assesssuite-physio-sentry-current-readiness/1.0.0';
export const PHYSIO_SENTRY_ORG = 'unimatter';
export const PHYSIO_SENTRY_PROJECT = 'assesssuite-production';
export const PHYSIO_SENTRY_PROJECT_ID = '4511827129663488';
export const PHYSIO_SENTRY_ENVIRONMENT = 'physio-production';

const APPLICATION = 'assesssuite-physio-production';
const PROFESSION_ID = 'physio';
const SHA_RE = /^[0-9a-f]{40}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const IMAGE_RE = /^registry\.fly\.io\/assesssuite-physio-production@sha256:[0-9a-f]{64}$/;
const PREFIXED_HASH_RE = /^sha256:[0-9a-f]{64}$/;
const PROVIDER_EFFECT_RE = /^sha256:[0-9a-f]{64}$/;
const ARTIFACT_ID_RE = /^(?:0|[1-9][0-9]*)$/;
const ARTIFACT_DIGEST_RE = /^(?:0|sha256:[0-9a-f]{64})$/;
const PHASES = Object.freeze([
  'INTENT_STARTED',
  'COMPENSATION_STARTED',
  'COMPENSATION_COMPLETED',
  'CREATE_UPLOAD_FINALIZE_STARTED',
]);
const RECONCILIATION_RESULTS = Object.freeze([
  'EXACT_ABSENCE',
  'SAFE_ORPHAN',
  'DELETE_COMPLETED_ABSENT',
]);
const REQUEST_ID_HEADERS = Object.freeze([
  'cf-ray',
  'sentry-trace',
  'x-request-id',
  'x-sentry-request-id',
  // Sentry's API does not consistently emit a request-id header. It does,
  // however, guarantee these provider-generated rate-limit headers on every
  // API response (including the organization endpoint). Keep them as
  // response evidence so a real Sentry response cannot fail solely because
  // the edge did not add an opaque request id.
  'x-sentry-rate-limit-limit',
  'x-sentry-rate-limit-remaining',
  'x-sentry-rate-limit-reset',
  'x-sentry-rate-limit-concurrentlimit',
  'x-sentry-rate-limit-concurrentremaining',
]);
const SENTRY_RATE_LIMIT_HEADERS = new Set([
  'x-sentry-rate-limit-limit',
  'x-sentry-rate-limit-remaining',
  'x-sentry-rate-limit-reset',
  'x-sentry-rate-limit-concurrentlimit',
  'x-sentry-rate-limit-concurrentremaining',
]);
const SENTRY_RATE_LIMIT_REQUIRED_HEADERS = Object.freeze([
  'x-sentry-rate-limit-limit',
  'x-sentry-rate-limit-remaining',
  'x-sentry-rate-limit-reset',
]);
const PHASE_RECEIPT_KEYS = Object.freeze([
  'application', 'application_sha', 'authority_reference', 'candidate_core_receipt_sha256',
  'capability_intent_id', 'contract_version', 'generation', 'phase', 'phase_sequence',
  'previous_phase_artifact_digest', 'previous_phase_artifact_id',
  'previous_phase_receipt_sha256', 'previous_phase', 'profession_id', 'provider_effect_id',
  'reconciliation_artifact_digest', 'reconciliation_artifact_id',
  'reconciliation_receipt_sha256', 'reconciliation_result', 'release_version', 'result',
  'sentry_environment', 'sentry_org', 'sentry_project', 'sentry_project_id',
  'source_map_archive_sha256', 'source_map_manifest_sha256', 'started_at',
]);

function fail(message) {
  throw new Error(`Physio Sentry release contract: ${message}`);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    fail(`${label} key set differs`);
  }
}

function exactIdentity(receipt, applicationSha, label) {
  const expectedRelease = sentryReleaseForProfession(PROFESSION_ID, applicationSha);
  if (!SHA_RE.test(applicationSha || '') || receipt.application !== APPLICATION ||
      receipt.application_sha !== applicationSha || receipt.profession_id !== PROFESSION_ID ||
      receipt.sentry_org !== PHYSIO_SENTRY_ORG ||
      receipt.sentry_project !== PHYSIO_SENTRY_PROJECT ||
      receipt.sentry_project_id !== PHYSIO_SENTRY_PROJECT_ID ||
      receipt.sentry_environment !== PHYSIO_SENTRY_ENVIRONMENT ||
      receipt.release_version !== expectedRelease) {
    fail(`${label} identity differs`);
  }
}

function requireHashes(receipt, fields, label) {
  for (const field of fields) {
    if (!HASH_RE.test(receipt[field] || '')) fail(`${label} ${field} differs`);
  }
}

function requireTimestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) fail(`${label} differs`);
}

function requireArtifactBinding(id, digest, receiptSha256, label, { allowZero = false } = {}) {
  if (!ARTIFACT_ID_RE.test(id || '') || !ARTIFACT_DIGEST_RE.test(digest || '')) {
    fail(`${label} artifact identity differs`);
  }
  if (id === '0') {
    if (!allowZero || digest !== '0' || receiptSha256 !== 'sha256:na') {
      fail(`${label} absent artifact binding differs`);
    }
    return;
  }
  if (!PREFIXED_HASH_RE.test(digest) || !HASH_RE.test(receiptSha256 || '')) {
    fail(`${label} artifact hash binding differs`);
  }
}

function safeReadFile(file, { maximumBytes = 1_048_576, label = 'file' } = {}) {
  const resolved = path.resolve(file || '');
  const descriptor = fs.openSync(resolved, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(descriptor);
    if (!before.isFile() || before.size <= 0 || before.size > maximumBytes) fail(`${label} is invalid`);
    const bytes = fs.readFileSync(descriptor);
    const after = fs.fstatSync(descriptor);
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size ||
        before.mtimeMs !== after.mtimeMs || bytes.length !== before.size) {
      fail(`${label} changed while it was admitted`);
    }
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
}

export function validatePhysioSentryReconciliationReceipt(receipt, {
  applicationSha,
  providerEffectId,
  phaseArtifactId,
  phaseArtifactDigest,
  phaseReceiptSha256,
} = {}) {
  exactKeys(receipt, [
    'absence_http_status', 'application', 'application_sha', 'completed_at', 'contract_version',
    'delete_http_status', 'deploy_readback_sha256', 'generation', 'phase',
    'phase_artifact_digest', 'phase_artifact_id', 'phase_receipt_sha256', 'phase_sequence',
    'profession_id', 'provider_effect_id', 'provider_request_id_hashes_sha256',
    'release_http_status', 'release_readback_sha256', 'release_version', 'result',
    'sentry_environment', 'sentry_org', 'sentry_project', 'sentry_project_id',
  ], 'release reconciliation receipt');
  exactIdentity(receipt, applicationSha, 'release reconciliation receipt');
  if (receipt.contract_version !== PHYSIO_SENTRY_RECONCILIATION_CONTRACT ||
      !RECONCILIATION_RESULTS.includes(receipt.result) ||
      receipt.provider_effect_id !== providerEffectId ||
      !PHASES.includes(receipt.phase) || !Number.isSafeInteger(receipt.generation) ||
      receipt.generation < 0 || receipt.generation > 100 ||
      !Number.isSafeInteger(receipt.phase_sequence) || receipt.phase_sequence < 0 ||
      receipt.phase_sequence > 400 ||
      receipt.phase_artifact_id !== phaseArtifactId ||
      receipt.phase_artifact_digest !== phaseArtifactDigest ||
      receipt.phase_receipt_sha256 !== phaseReceiptSha256) {
    fail('release reconciliation identity differs');
  }
  requireArtifactBinding(
    receipt.phase_artifact_id,
    receipt.phase_artifact_digest,
    receipt.phase_receipt_sha256,
    'reconciled phase',
  );
  requireHashes(receipt, [
    'release_readback_sha256', 'deploy_readback_sha256', 'provider_request_id_hashes_sha256',
  ], 'release reconciliation receipt');
  const expectedStatuses = {
    EXACT_ABSENCE: [404, null, 404],
    SAFE_ORPHAN: [200, null, null],
    DELETE_COMPLETED_ABSENT: null,
  }[receipt.result];
  const actualStatuses = [
    receipt.release_http_status,
    receipt.delete_http_status,
    receipt.absence_http_status,
  ];
  const completedStatuses = [[200, 204, 404], [404, null, 404]];
  if (receipt.result === 'DELETE_COMPLETED_ABSENT'
    ? !completedStatuses.some((row) => JSON.stringify(row) === JSON.stringify(actualStatuses))
    : JSON.stringify(actualStatuses) !== JSON.stringify(expectedStatuses)) {
    fail('release reconciliation provider status differs');
  }
  requireTimestamp(receipt.completed_at, 'release reconciliation completed_at');
  return true;
}

function validateProviderRequestProof(proof, label, { receipt, deployPages } = {}) {
  exactKeys(proof, ['requests'], label);
  if (!Array.isArray(proof.requests) || proof.requests.length === 0 || proof.requests.length > 500) {
    fail(`${label} request collection differs`);
  }
  const operations = new Set();
  for (const row of proof.requests) {
    exactKeys(row, [
      'http_status', 'operation', 'request_id_count', 'request_id_header_names', 'request_id_sha256',
    ], `${label} request`);
    if (!/^[a-z][a-z0-9-]{0,79}$/.test(row.operation || '') || operations.has(row.operation) ||
        !Number.isSafeInteger(row.http_status) || row.http_status < 100 || row.http_status > 599 ||
        !Number.isSafeInteger(row.request_id_count) || row.request_id_count <= 0 ||
        !Array.isArray(row.request_id_header_names) || row.request_id_header_names.length === 0 ||
        !row.request_id_header_names.every((name) => REQUEST_ID_HEADERS.includes(name)) ||
        JSON.stringify(row.request_id_header_names) !==
          JSON.stringify([...new Set(row.request_id_header_names)].sort()) ||
        !Array.isArray(row.request_id_sha256) || row.request_id_sha256.length !== row.request_id_count ||
        !row.request_id_sha256.every((value) => HASH_RE.test(value)) ||
        new Set(row.request_id_sha256).size !== row.request_id_sha256.length) {
      fail(`${label} request identity differs`);
    }
    operations.add(row.operation);
  }
  if (!receipt) return;
  const rows = new Map(proof.requests.map((row) => [row.operation, row]));
  const expected = new Map([
    ['project', 200],
  ]);
  const hasGlobalOrganizationRead = rows.has('organization-global');
  const hasRegionalOrganizationRead = rows.has('organization-region');
  if (hasGlobalOrganizationRead || hasRegionalOrganizationRead) {
    const globalStatus = rows.get('organization-global')?.http_status;
    const directGlobalRead = hasGlobalOrganizationRead && !hasRegionalOrganizationRead &&
      !rows.has('organization') && globalStatus === 200;
    const redirectedGlobalRead = hasGlobalOrganizationRead && hasRegionalOrganizationRead &&
      !rows.has('organization') && [301, 302, 307, 308].includes(globalStatus) &&
      rows.get('organization-region')?.http_status === 200;
    if (!directGlobalRead && !redirectedGlobalRead) {
      fail(`${label} organization redirect proof differs`);
    }
    expected.set('organization-global', globalStatus);
    if (redirectedGlobalRead) expected.set('organization-region', 200);
  } else {
    expected.set('organization', 200);
  }
  if (receipt.result === 'EXACT_ABSENCE') {
    expected.set('release', 404);
  } else if (receipt.result === 'SAFE_ORPHAN') {
    expected.set('release', 200);
    for (const index of deployPages.keys()) expected.set(`deploy-page-${index}`, 200);
  } else if (receipt.release_http_status === 200) {
    expected.set('predelete', 200);
    for (const index of deployPages.keys()) expected.set(`deploy-page-${index}`, 200);
    expected.set('delete', 204);
    expected.set('absence', 404);
  } else if (rows.has('release')) {
    expected.set('release', 404);
  } else {
    expected.set('predelete', 404);
    expected.set('absence', 404);
  }
  if (rows.size !== expected.size || [...expected].some(([operation, status]) =>
    rows.get(operation)?.http_status !== status)) {
    fail(`${label} operation or HTTP-status set differs`);
  }
}

function validateProviderTargetReadback(readback, { applicationSha, releaseState, deployPages }) {
  exactKeys(readback, ['organization', 'project', 'release'], 'provider target readback');
  exactKeys(readback.organization, ['region_url', 'slug'], 'provider organization readback');
  exactKeys(readback.project, [
    'id', 'organization_slug', 'region_url', 'slug',
  ], 'provider project readback');
  const regionUrl = readback.organization.region_url;
  if (readback.organization.slug !== PHYSIO_SENTRY_ORG ||
      !['https://us.sentry.io', 'https://de.sentry.io'].includes(regionUrl) ||
      readback.project.id !== PHYSIO_SENTRY_PROJECT_ID ||
      readback.project.slug !== PHYSIO_SENTRY_PROJECT ||
      readback.project.organization_slug !== PHYSIO_SENTRY_ORG ||
      readback.project.region_url !== regionUrl) {
    fail('provider organization or project readback differs');
  }
  const expectedRelease = sentryReleaseForProfession(PROFESSION_ID, applicationSha);
  if (releaseState === 'absent') {
    exactKeys(readback.release, ['status', 'version'], 'absent release readback');
    if (readback.release.status !== 404 || readback.release.version !== expectedRelease) {
      fail('exact release absence readback differs');
    }
  } else {
    validatePhysioSentrySafeOrphanReadback(readback.release, deployPages, {
      applicationSha,
    });
  }
}

export function validatePhysioSentryReconciliationPacket(packet, options = {}) {
  const root = path.resolve(packet || '');
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('reconciliation packet root is invalid');
  const expectedFiles = [
    'SHA256SUMS',
    'provider-deploy-readback.json',
    'provider-release-readback.json',
    'provider-request-id-hashes.json',
    'sentry-reconciliation.json',
  ];
  const actualFiles = fs.readdirSync(root).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    fail('reconciliation packet file set differs');
  }
  const fileBytes = new Map(expectedFiles.filter((name) => name !== 'SHA256SUMS')
    .map((name) => [name, safeReadFile(path.join(root, name), { label: `reconciliation ${name}` })]));
  const sums = safeReadFile(path.join(root, 'SHA256SUMS'), { label: 'reconciliation checksum' });
  const expectedSums = [...fileBytes].sort(([left], [right]) => left.localeCompare(right))
    .map(([name, bytes]) => `${createHash('sha256').update(bytes).digest('hex')}  ${name}\n`).join('');
  if (sums.includes(13) || sums.toString('utf8') !== expectedSums) {
    fail('reconciliation packet checksum differs');
  }
  const receipt = JSON.parse(fileBytes.get('sentry-reconciliation.json').toString('utf8'));
  validatePhysioSentryReconciliationReceipt(receipt, options);
  const hash = (name) => createHash('sha256').update(fileBytes.get(name)).digest('hex');
  if (receipt.release_readback_sha256 !== hash('provider-release-readback.json') ||
      receipt.deploy_readback_sha256 !== hash('provider-deploy-readback.json') ||
      receipt.provider_request_id_hashes_sha256 !== hash('provider-request-id-hashes.json')) {
    fail('reconciliation proof-file hash binding differs');
  }
  const requestProof = JSON.parse(fileBytes.get('provider-request-id-hashes.json').toString('utf8'));
  const release = JSON.parse(fileBytes.get('provider-release-readback.json').toString('utf8'));
  const deploy = JSON.parse(fileBytes.get('provider-deploy-readback.json').toString('utf8'));
  exactKeys(deploy, ['pages'], 'provider deploy readback');
  if (!Array.isArray(deploy.pages)) fail('provider deploy readback pages differ');
  if (receipt.result === 'SAFE_ORPHAN') {
    validateProviderTargetReadback(release, {
      applicationSha: options.applicationSha, releaseState: 'safe-orphan', deployPages: deploy.pages,
    });
  } else if (receipt.result === 'EXACT_ABSENCE' ||
      (receipt.result === 'DELETE_COMPLETED_ABSENT' && receipt.release_http_status === 404)) {
    validateProviderTargetReadback(release, {
      applicationSha: options.applicationSha, releaseState: 'absent', deployPages: deploy.pages,
    });
    if (deploy.pages.length !== 0) fail('absent release deploy readback differs');
  } else if (receipt.result === 'DELETE_COMPLETED_ABSENT' && receipt.release_http_status === 200) {
    validateProviderTargetReadback(release, {
      applicationSha: options.applicationSha, releaseState: 'safe-orphan', deployPages: deploy.pages,
    });
  }
  validateProviderRequestProof(requestProof, 'reconciliation provider proof', {
    receipt, deployPages: deploy.pages,
  });
  return true;
}

export function validatePhysioSentryPhaseReceipt(receipt, {
  applicationSha,
  capabilityIntentId,
  authorityReference,
  sourceMapManifestSha256 = '',
  sourceMapArchiveSha256 = '',
  previousPhaseReceipt = null,
  reconciliationReceipt = null,
} = {}) {
  exactKeys(receipt, PHASE_RECEIPT_KEYS, 'release phase receipt');
  exactIdentity(receipt, applicationSha, 'release phase receipt');
  if (receipt.contract_version !== PHYSIO_SENTRY_PHASE_CONTRACT ||
      !PHASES.includes(receipt.phase) || !Number.isSafeInteger(receipt.generation) ||
      receipt.generation < 0 || receipt.generation > 100 ||
      !Number.isSafeInteger(receipt.phase_sequence) || receipt.phase_sequence < 0 || receipt.phase_sequence > 400 ||
      !PROVIDER_EFFECT_RE.test(receipt.provider_effect_id || '') ||
      receipt.capability_intent_id !== capabilityIntentId ||
      receipt.authority_reference !== authorityReference ||
      !HASH_RE.test(receipt.candidate_core_receipt_sha256 || '') ||
      !HASH_RE.test(receipt.source_map_manifest_sha256 || '') ||
      !HASH_RE.test(receipt.source_map_archive_sha256 || '') ||
      (sourceMapManifestSha256 && receipt.source_map_manifest_sha256 !== sourceMapManifestSha256) ||
      (sourceMapArchiveSha256 && receipt.source_map_archive_sha256 !== sourceMapArchiveSha256)) {
    fail('release phase receipt binding differs');
  }
  requireTimestamp(receipt.started_at, 'release phase receipt started_at');
  requireArtifactBinding(
    receipt.previous_phase_artifact_id,
    receipt.previous_phase_artifact_digest,
    receipt.previous_phase_receipt_sha256,
    'previous phase',
    { allowZero: true },
  );
  requireArtifactBinding(
    receipt.reconciliation_artifact_id,
    receipt.reconciliation_artifact_digest,
    receipt.reconciliation_receipt_sha256,
    'phase reconciliation',
    { allowZero: receipt.phase === 'INTENT_STARTED' },
  );
  if (receipt.phase === 'INTENT_STARTED') {
    if (receipt.generation !== 0 || receipt.previous_phase_artifact_id !== '0' ||
        receipt.reconciliation_artifact_id !== '0' || receipt.phase_sequence !== 0 ||
        receipt.result !== 'STARTED' || receipt.previous_phase !== 'NONE' ||
        receipt.reconciliation_result !== 'NOT_APPLICABLE' || previousPhaseReceipt || reconciliationReceipt) {
      fail('initial release phase chain differs');
    }
    return true;
  }
  if (receipt.previous_phase_artifact_id === '0' || receipt.reconciliation_artifact_id === '0' ||
      !previousPhaseReceipt || !reconciliationReceipt) {
    fail('mutating release phase is not chained to admitted prior phase and provider reconciliation bytes');
  }
  exactKeys(previousPhaseReceipt, PHASE_RECEIPT_KEYS, 'previous release phase receipt');
  exactIdentity(previousPhaseReceipt, applicationSha, 'previous release phase receipt');
  if (previousPhaseReceipt.contract_version !== PHYSIO_SENTRY_PHASE_CONTRACT ||
      !PHASES.includes(previousPhaseReceipt.phase) ||
      !['STARTED', 'COMPLETED'].includes(previousPhaseReceipt.result) ||
      !Number.isSafeInteger(previousPhaseReceipt.generation) || previousPhaseReceipt.generation < 0 ||
      !Number.isSafeInteger(previousPhaseReceipt.phase_sequence) || previousPhaseReceipt.phase_sequence < 0 ||
      previousPhaseReceipt.provider_effect_id !== receipt.provider_effect_id ||
      previousPhaseReceipt.capability_intent_id !== capabilityIntentId ||
      previousPhaseReceipt.authority_reference !== authorityReference ||
      previousPhaseReceipt.source_map_manifest_sha256 !== receipt.source_map_manifest_sha256 ||
      previousPhaseReceipt.source_map_archive_sha256 !== receipt.source_map_archive_sha256 ||
      previousPhaseReceipt.candidate_core_receipt_sha256 !== receipt.candidate_core_receipt_sha256 ||
      Date.parse(receipt.started_at) < Date.parse(previousPhaseReceipt.started_at)) {
    fail('previous release phase receipt identity differs');
  }
  const transition = `${previousPhaseReceipt.phase}->${receipt.phase}`;
  const reusesDeleteProof = transition ===
      'COMPENSATION_COMPLETED->CREATE_UPLOAD_FINALIZE_STARTED' &&
    reconciliationReceipt.result === 'DELETE_COMPLETED_ABSENT';
  if (reusesDeleteProof && (receipt.reconciliation_artifact_id !==
        previousPhaseReceipt.reconciliation_artifact_id ||
      receipt.reconciliation_artifact_digest !== previousPhaseReceipt.reconciliation_artifact_digest ||
      receipt.reconciliation_receipt_sha256 !== previousPhaseReceipt.reconciliation_receipt_sha256)) {
    fail('post-compensation create does not reuse the exact completed DELETE proof');
  }
  const reconciliationBinding = reusesDeleteProof ? {
    id: previousPhaseReceipt.previous_phase_artifact_id,
    digest: previousPhaseReceipt.previous_phase_artifact_digest,
    receiptSha256: previousPhaseReceipt.previous_phase_receipt_sha256,
  } : {
    id: receipt.previous_phase_artifact_id,
    digest: receipt.previous_phase_artifact_digest,
    receiptSha256: receipt.previous_phase_receipt_sha256,
  };
  validatePhysioSentryReconciliationReceipt(reconciliationReceipt, {
    applicationSha,
    providerEffectId: receipt.provider_effect_id,
    phaseArtifactId: reconciliationBinding.id,
    phaseArtifactDigest: reconciliationBinding.digest,
    phaseReceiptSha256: reconciliationBinding.receiptSha256,
  });
  if (previousPhaseReceipt.contract_version !== PHYSIO_SENTRY_PHASE_CONTRACT ||
      previousPhaseReceipt.provider_effect_id !== receipt.provider_effect_id ||
      previousPhaseReceipt.application_sha !== applicationSha ||
      previousPhaseReceipt.phase !== receipt.previous_phase ||
      previousPhaseReceipt.phase_sequence + 1 !== receipt.phase_sequence ||
      reconciliationReceipt.phase !== (reusesDeleteProof ? 'COMPENSATION_STARTED' : previousPhaseReceipt.phase) ||
      reconciliationReceipt.generation !== previousPhaseReceipt.generation ||
      reconciliationReceipt.phase_sequence !== (reusesDeleteProof
        ? previousPhaseReceipt.phase_sequence - 1 : previousPhaseReceipt.phase_sequence) ||
      reconciliationReceipt.result !== receipt.reconciliation_result) {
    fail('release phase predecessor or reconciliation transition differs');
  }
  if (transition === 'INTENT_STARTED->COMPENSATION_STARTED' ||
      transition === 'CREATE_UPLOAD_FINALIZE_STARTED->COMPENSATION_STARTED') {
    if (previousPhaseReceipt.result !== 'STARTED' || receipt.result !== 'STARTED' ||
        receipt.reconciliation_result !== 'SAFE_ORPHAN' ||
        receipt.generation !== previousPhaseReceipt.generation) {
      fail('compensation start transition differs');
    }
  } else if (transition === 'COMPENSATION_STARTED->COMPENSATION_COMPLETED') {
    if (previousPhaseReceipt.result !== 'STARTED' || receipt.result !== 'COMPLETED' ||
        receipt.reconciliation_result !== 'DELETE_COMPLETED_ABSENT' ||
        receipt.generation !== previousPhaseReceipt.generation) {
      fail('compensation completion transition differs');
    }
  } else if (transition === 'INTENT_STARTED->CREATE_UPLOAD_FINALIZE_STARTED') {
    if (previousPhaseReceipt.result !== 'STARTED' || receipt.result !== 'STARTED' ||
        receipt.reconciliation_result !== 'EXACT_ABSENCE' ||
        receipt.generation !== previousPhaseReceipt.generation + 1) {
      fail('initial create transition differs');
    }
  } else if (transition === 'COMPENSATION_COMPLETED->CREATE_UPLOAD_FINALIZE_STARTED') {
    if (previousPhaseReceipt.result !== 'COMPLETED' || receipt.result !== 'STARTED' ||
        !['DELETE_COMPLETED_ABSENT', 'EXACT_ABSENCE'].includes(receipt.reconciliation_result) ||
        receipt.generation !== previousPhaseReceipt.generation + 1) {
      fail('post-compensation create transition differs');
    }
  } else {
    fail(`release phase transition ${transition} is not permitted`);
  }
  return true;
}

export function validatePhysioSentryPhasePacket(packet, options = {}) {
  const root = path.resolve(packet || '');
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('phase packet root is invalid');
  const phaseBytes = safeReadFile(path.join(root, 'sentry-phase.json'), { label: 'phase receipt' });
  const phaseReceipt = JSON.parse(phaseBytes.toString('utf8'));
  const sequence = phaseReceipt.phase_sequence;
  if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence > 400) {
    fail('phase packet sequence differs');
  }
  const indexedName = (prefix, index) => `${prefix}-${String(index).padStart(4, '0')}.json`;
  const expectedFiles = ['SHA256SUMS', 'sentry-phase.json'];
  for (let index = 0; index < sequence; index += 1) {
    expectedFiles.push(indexedName('phase', index));
  }
  for (let index = 1; index <= sequence; index += 1) {
    expectedFiles.push(indexedName('reconciliation', index));
  }
  expectedFiles.sort();
  const actualFiles = fs.readdirSync(root).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) fail('phase packet file set differs');
  for (const name of actualFiles) {
    const stat = fs.lstatSync(path.join(root, name));
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > 1_048_576) {
      fail(`phase packet ${name} is invalid`);
    }
  }
  const checksums = safeReadFile(path.join(root, 'SHA256SUMS'), { label: 'phase checksum' });
  const checksummed = expectedFiles.filter((name) => name !== 'SHA256SUMS').sort()
    .map((name) => `${createHash('sha256').update(safeReadFile(path.join(root, name), {
      label: `phase packet ${name}`,
    })).digest('hex')}  ${name}\n`).join('');
  if (checksums.includes(13) || checksums.at(-1) !== 10 || checksums.at(-2) === 10 ||
      checksums.toString('utf8') !== checksummed) {
    fail('phase packet checksum differs');
  }
  const phases = [];
  const phaseByteRows = [];
  for (let index = 0; index < sequence; index += 1) {
    const bytes = safeReadFile(path.join(root, indexedName('phase', index)), {
      label: `phase-chain receipt ${index}`,
    });
    phaseByteRows.push(bytes);
    phases.push(JSON.parse(bytes.toString('utf8')));
  }
  phases.push(phaseReceipt);
  phaseByteRows.push(phaseBytes);
  validatePhysioSentryPhaseReceipt(phases[0], options);
  for (let index = 1; index <= sequence; index += 1) {
    const reconciliationBytes = safeReadFile(path.join(root, indexedName('reconciliation', index)), {
      label: `phase-chain reconciliation ${index}`,
    });
    const reconciliationReceipt = JSON.parse(reconciliationBytes.toString('utf8'));
    if (createHash('sha256').update(phaseByteRows[index - 1]).digest('hex') !==
          phases[index].previous_phase_receipt_sha256 ||
        createHash('sha256').update(reconciliationBytes).digest('hex') !==
          phases[index].reconciliation_receipt_sha256) {
      fail('phase packet predecessor byte binding differs');
    }
    validatePhysioSentryPhaseReceipt(phases[index], {
      ...options,
      previousPhaseReceipt: phases[index - 1],
      reconciliationReceipt,
    });
  }
  return true;
}

export function extractSentryProviderRequestIdHashes(headerBytes, { label = 'provider response' } = {}) {
  const text = Buffer.isBuffer(headerBytes) ? headerBytes.toString('utf8') : String(headerBytes || '');
  const statusLines = text.split(/\r?\n/).filter((line) => /^HTTP\/\d(?:\.\d)?\s+\d{3}(?:\s|$)/i.test(line));
  if (statusLines.length !== 1) fail(`${label} has an ambiguous response chain`);
  const statusMatch = /^HTTP\/\d(?:\.\d)?\s+(\d{3})(?:\s|$)/i.exec(statusLines[0]);
  if (!statusMatch) fail(`${label} has no exact HTTP status`);
  const values = [];
  for (const line of text.split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (!REQUEST_ID_HEADERS.includes(name) || !value || value.length > 512 || /[\x00-\x1f\x7f]/.test(value)) continue;
    // Rate-limit headers are accepted only in the numeric form emitted by
    // Sentry. This keeps arbitrary caller-controlled values out of the proof
    // while remaining compatible with the API's guaranteed response headers.
    if (SENTRY_RATE_LIMIT_HEADERS.has(name) && !/^\d+$/u.test(value)) continue;
    values.push({ name, value });
  }
  const requestIds = values.filter((row) => !SENTRY_RATE_LIMIT_HEADERS.has(row.name));
  if (requestIds.length === 0 &&
      !SENTRY_RATE_LIMIT_REQUIRED_HEADERS.every((name) => values.some((row) => row.name === name))) {
    fail(`${label} has no provider-derived request identifier or complete Sentry rate-limit evidence`);
  }
  const unique = [...new Map(values.map((row) => [`${row.name}\0${row.value}`, row])).values()]
    .sort((left, right) => left.name.localeCompare(right.name) || left.value.localeCompare(right.value));
  if (unique.length === 0) fail(`${label} has no provider-derived request identifier`);
  return Object.freeze({
    http_status: Number(statusMatch[1]),
    request_id_count: unique.length,
    request_id_header_names: [...new Set(unique.map((row) => row.name))].sort(),
    request_id_sha256: unique.map((row) => createHash('sha256')
      .update(`${row.name}\0${row.value}`, 'utf8').digest('hex')),
  });
}

export function validatePhysioSentrySafeOrphanReadback(release, deployPages, {
  applicationSha,
} = {}) {
  const expectedRelease = sentryReleaseForProfession(PROFESSION_ID, applicationSha);
  if (!release || typeof release !== 'object' || Array.isArray(release) ||
      release.version !== expectedRelease || release.status !== 'open' ||
      release.deployCount !== 0 || release.lastDeploy !== null ||
      release.firstEvent !== null || release.lastEvent !== null ||
      !Array.isArray(release.projects) || release.projects.length !== 1 ||
      String(release.projects[0]?.id) !== PHYSIO_SENTRY_PROJECT_ID ||
      release.projects[0]?.slug !== PHYSIO_SENTRY_PROJECT) {
    fail('existing release is not the exact undeployed event-free Physio orphan');
  }
  if (!Array.isArray(deployPages) || deployPages.length === 0 || deployPages.length > 100) {
    fail('deploy pagination proof differs');
  }
  for (const [index, page] of deployPages.entries()) {
    exactKeys(page, ['items', 'next_cursor', 'results'], `deploy page ${index}`);
    const final = index === deployPages.length - 1;
    if (!Array.isArray(page.items) || page.items.length !== 0 ||
        (final && (page.results !== false || page.next_cursor !== null)) ||
        (!final && (page.results !== true || typeof page.next_cursor !== 'string' ||
          page.next_cursor.length === 0 || page.next_cursor.length > 2048))) {
      fail('deploy inventory is not exact and exhaustively empty');
    }
  }
  return true;
}

export function validatePhysioSentrySourceMapManifest(manifest, { applicationSha } = {}) {
  const expectedRelease = sentryReleaseForProfession(PROFESSION_ID, applicationSha);
  exactKeys(manifest, [
    'application', 'application_sha', 'build_timestamp', 'contract_version',
    'profession_id', 'release_version', 'runtime_js', 'sentry_environment', 'source_maps',
  ], 'source-map manifest');
  if (manifest.contract_version !== PHYSIO_SENTRY_SOURCE_MAP_MANIFEST_CONTRACT ||
      manifest.application !== APPLICATION || manifest.application_sha !== applicationSha ||
      manifest.profession_id !== PROFESSION_ID ||
      manifest.release_version !== expectedRelease ||
      manifest.sentry_environment !== PHYSIO_SENTRY_ENVIRONMENT ||
      !SHA_RE.test(applicationSha || '')) {
    fail('source-map manifest identity differs');
  }
  requireTimestamp(manifest.build_timestamp, 'source-map manifest build_timestamp');
  if (!Array.isArray(manifest.runtime_js) || manifest.runtime_js.length === 0 ||
      manifest.runtime_js.length > 100 ||
      !Array.isArray(manifest.source_maps) ||
      manifest.source_maps.length !== manifest.runtime_js.length) {
    fail('source-map manifest relation differs');
  }
  const runtimePaths = new Set();
  for (const row of manifest.runtime_js) {
    exactKeys(row, ['bytes', 'path', 'sha256'], 'runtime JavaScript row');
    if (!/^assets\/[A-Za-z0-9._-]+\.js$/.test(row.path || '') ||
        runtimePaths.has(row.path) || !Number.isSafeInteger(row.bytes) ||
        row.bytes <= 0 || row.bytes > 50_000_000 || !HASH_RE.test(row.sha256 || '')) {
      fail('runtime JavaScript row differs');
    }
    runtimePaths.add(row.path);
  }
  const mapPaths = new Set();
  for (const row of manifest.source_maps) {
    exactKeys(row, ['bytes', 'path', 'runtime_path', 'sha256'], 'source-map row');
    if (!/^assets\/[A-Za-z0-9._-]+\.js\.map$/.test(row.path || '') ||
        mapPaths.has(row.path) || row.path !== `${row.runtime_path}.map` ||
        !runtimePaths.has(row.runtime_path) || !Number.isSafeInteger(row.bytes) ||
        row.bytes <= 0 || row.bytes > 50_000_000 || !HASH_RE.test(row.sha256 || '')) {
      fail('source-map row differs');
    }
    mapPaths.add(row.path);
  }
  if ([...manifest.runtime_js, ...manifest.source_maps]
    .reduce((total, row) => total + row.bytes, 0) > 67_108_864) {
    fail('source-map payload exceeds 64 MiB');
  }
  return true;
}

export function validatePhysioSentryReleaseReceipt(receipt, {
  applicationSha,
  sourceMapManifestSha256 = '',
  sourceMapArchiveSha256 = '',
} = {}) {
  exactKeys(receipt, [
    'application', 'application_sha', 'completed_at', 'contract_version',
    'credential_scope', 'fly_credential_absent', 'profession_id',
    'effect_reconciliation_receipt_sha256', 'provider_release_readback_sha256',
    'provider_request_id_hashes_sha256', 'release_finalized', 'release_version', 'result',
    'sentry_dsn_absent', 'sentry_environment', 'sentry_org', 'sentry_project',
    'sentry_project_id', 'source_map_archive_sha256', 'source_map_count',
    'source_map_manifest_sha256', 'source_map_runtime_count',
    'source_map_upload_stderr_sha256', 'source_map_upload_stdout_sha256',
    'source_maps_uploaded', 'started_effect_artifact_digest', 'started_effect_artifact_id',
    'started_effect_receipt_sha256',
  ], 'release receipt');
  if (receipt.contract_version !== PHYSIO_SENTRY_RELEASE_CONTRACT || receipt.result !== 'PASS') {
    fail('release receipt result differs');
  }
  exactIdentity(receipt, applicationSha, 'release receipt');
  requireHashes(receipt, [
    'source_map_archive_sha256', 'source_map_manifest_sha256',
    'source_map_upload_stderr_sha256', 'source_map_upload_stdout_sha256',
    'provider_release_readback_sha256', 'provider_request_id_hashes_sha256',
    'started_effect_receipt_sha256', 'effect_reconciliation_receipt_sha256',
  ], 'release receipt');
  if ((sourceMapManifestSha256 && receipt.source_map_manifest_sha256 !== sourceMapManifestSha256) ||
      (sourceMapArchiveSha256 && receipt.source_map_archive_sha256 !== sourceMapArchiveSha256)) {
    fail('release receipt source-map hash binding differs');
  }
  if (!Number.isSafeInteger(receipt.source_map_runtime_count) || receipt.source_map_runtime_count <= 0 ||
      receipt.source_map_count !== receipt.source_map_runtime_count ||
      receipt.release_finalized !== true || receipt.source_maps_uploaded !== true ||
      !/^[1-9][0-9]*$/.test(receipt.started_effect_artifact_id || '') ||
      !/^sha256:[0-9a-f]{64}$/.test(receipt.started_effect_artifact_digest || '') ||
      receipt.fly_credential_absent !== true || receipt.sentry_dsn_absent !== true ||
      JSON.stringify(receipt.credential_scope) !== JSON.stringify(['SENTRY_AUTH_TOKEN'])) {
    fail('release receipt proof differs');
  }
  requireTimestamp(receipt.completed_at, 'release receipt completed_at');
  return true;
}

function validateFinalPagination(pages, { label, totalItems = 0 } = {}) {
  if (!Array.isArray(pages) || pages.length === 0 || pages.length > 100) {
    fail(`${label} pagination proof differs`);
  }
  let itemCount = 0;
  for (const [index, page] of pages.entries()) {
    exactKeys(page, ['item_count', 'next_cursor', 'results'], `${label} page ${index}`);
    const final = index === pages.length - 1;
    if (!Number.isSafeInteger(page.item_count) || page.item_count < 0 || page.item_count > 1000 ||
        (final && (page.results !== false || page.next_cursor !== null)) ||
        (!final && (page.results !== true || typeof page.next_cursor !== 'string' ||
          page.next_cursor.length === 0 || page.next_cursor.length > 2048))) {
      fail(`${label} pagination proof differs`);
    }
    itemCount += page.item_count;
  }
  if (itemCount !== totalItems) fail(`${label} paginated item total differs`);
}

function validatePhysioSentryReleasePacketV2({
  started,
  effect,
  requestProof,
  providerReadback,
  sourceMapManifest,
  receipt,
  applicationSha,
  capabilityIntentId,
  authorityReference,
  expectedProviderEffectId,
}) {
  exactKeys(started, PHASE_RECEIPT_KEYS, 'release STARTED phase');
  exactIdentity(started, applicationSha, 'release STARTED phase');
  if (started.contract_version !== PHYSIO_SENTRY_PHASE_CONTRACT || started.result !== 'STARTED' ||
      started.phase !== 'CREATE_UPLOAD_FINALIZE_STARTED' ||
      !Number.isSafeInteger(started.phase_sequence) || started.phase_sequence <= 0 ||
      !Number.isSafeInteger(started.generation) || started.generation <= 0 ||
      started.provider_effect_id !== expectedProviderEffectId ||
      started.capability_intent_id !== capabilityIntentId || started.authority_reference !== authorityReference ||
      started.source_map_manifest_sha256 !== receipt.source_map_manifest_sha256 ||
      started.source_map_archive_sha256 !== receipt.source_map_archive_sha256 ||
      !HASH_RE.test(started.candidate_core_receipt_sha256 || '') ||
      started.previous_phase_artifact_id === '0' || started.reconciliation_artifact_id === '0' ||
      !['INTENT_STARTED', 'COMPENSATION_COMPLETED'].includes(started.previous_phase) ||
      !['EXACT_ABSENCE', 'DELETE_COMPLETED_ABSENT'].includes(started.reconciliation_result)) {
    fail('release STARTED phase binding differs');
  }
  requireArtifactBinding(started.previous_phase_artifact_id, started.previous_phase_artifact_digest,
    started.previous_phase_receipt_sha256, 'release STARTED predecessor');
  requireArtifactBinding(started.reconciliation_artifact_id, started.reconciliation_artifact_digest,
    started.reconciliation_receipt_sha256, 'release STARTED reconciliation');
  requireTimestamp(started.started_at, 'release STARTED phase started_at');

  exactKeys(effect, [
    'application', 'application_sha', 'build_timestamp', 'completed_at', 'contract_version', 'generation',
    'mutation_started', 'phase_sequence', 'prestate_http_status', 'profession_id',
    'provider_effect_id', 'provider_release_readback_sha256', 'provider_request_id_hashes_sha256',
    'release_finalize_exit_code', 'release_new_exit_code', 'release_version', 'result',
    'sentry_environment', 'sentry_org', 'sentry_project', 'sentry_project_id',
    'source_map_archive_sha256', 'source_map_manifest_sha256', 'source_map_upload_exit_code',
    'started_effect_artifact_digest', 'started_effect_artifact_id', 'started_effect_receipt_sha256',
  ], 'release effect reconciliation');
  exactIdentity(effect, applicationSha, 'release effect reconciliation');
  if (effect.contract_version !== 'assesssuite-physio-sentry-release-effect/2.0.0' ||
      effect.result !== 'COMPLETED' || effect.provider_effect_id !== expectedProviderEffectId ||
      effect.generation !== started.generation || effect.phase_sequence !== started.phase_sequence ||
      effect.mutation_started !== true || effect.prestate_http_status !== 404 ||
      effect.release_new_exit_code !== 0 || effect.source_map_upload_exit_code !== 0 ||
      effect.release_finalize_exit_code !== 0 ||
      !Number.isFinite(Date.parse(effect.build_timestamp)) ||
      effect.source_map_manifest_sha256 !== receipt.source_map_manifest_sha256 ||
      effect.source_map_archive_sha256 !== receipt.source_map_archive_sha256 ||
      effect.provider_release_readback_sha256 !== receipt.provider_release_readback_sha256 ||
      effect.provider_request_id_hashes_sha256 !== receipt.provider_request_id_hashes_sha256 ||
      effect.started_effect_artifact_id !== receipt.started_effect_artifact_id ||
      effect.started_effect_artifact_digest !== receipt.started_effect_artifact_digest ||
      effect.started_effect_receipt_sha256 !== receipt.started_effect_receipt_sha256) {
    fail('release effect reconciliation binding differs');
  }
  requireTimestamp(effect.completed_at, 'release effect completed_at');
  if (Date.parse(effect.completed_at) < Date.parse(started.started_at)) {
    fail('release effect chronology differs');
  }
  if (effect.build_timestamp !== sourceMapManifest.build_timestamp) {
    fail('release effect build timestamp differs from the frozen source-map manifest');
  }

  exactKeys(requestProof, [
    'phase_artifact_digest', 'phase_artifact_id', 'phase_receipt_sha256', 'requests',
  ], 'release provider request proof');
  requireArtifactBinding(requestProof.phase_artifact_id, requestProof.phase_artifact_digest,
    requestProof.phase_receipt_sha256, 'release provider phase');
  if (requestProof.phase_artifact_id !== receipt.started_effect_artifact_id ||
      requestProof.phase_artifact_digest !== receipt.started_effect_artifact_digest ||
      requestProof.phase_receipt_sha256 !== receipt.started_effect_receipt_sha256) {
    fail('release provider request phase binding differs');
  }
  validateProviderRequestProof({ requests: requestProof.requests }, 'release provider request proof');

  exactKeys(providerReadback, [
    'deploy_pages', 'file_pages', 'organization', 'project', 'release', 'source_map_files',
  ], 'release provider readback');
  exactKeys(providerReadback.release, [
    'date_released', 'deploy_count', 'first_event', 'last_deploy', 'last_event',
    'projects', 'status', 'version',
  ], 'release provider release readback');
  const providerRelease = providerReadback.release;
  const safeRelease = {
    version: providerRelease.version,
    status: providerRelease.status,
    deployCount: providerRelease.deploy_count,
    lastDeploy: providerRelease.last_deploy,
    firstEvent: providerRelease.first_event,
    lastEvent: providerRelease.last_event,
    projects: providerRelease.projects,
  };
  validateProviderTargetReadback({
    organization: providerReadback.organization,
    project: providerReadback.project,
    release: safeRelease,
  }, { applicationSha, releaseState: 'safe-orphan', deployPages: providerReadback.deploy_pages });
  if (providerRelease.date_released !== effect.build_timestamp ||
      !Number.isFinite(Date.parse(providerRelease.date_released))) {
    fail('release provider finalized timestamp differs');
  }

  const files = providerReadback.source_map_files;
  const expectedFileCount = receipt.source_map_count + receipt.source_map_runtime_count;
  const expectedProviderFiles = [...sourceMapManifest.runtime_js, ...sourceMapManifest.source_maps]
    .map((row) => ({ name: `~/${row.path}`, bytes: row.bytes, sha256: row.sha256 }))
    .sort((left, right) => left.name.localeCompare(right.name));
  if (receipt.source_map_runtime_count !== sourceMapManifest.runtime_js.length ||
      receipt.source_map_count !== sourceMapManifest.source_maps.length ||
      expectedProviderFiles.length !== expectedFileCount ||
      !Array.isArray(files) || files.length !== expectedFileCount ||
      JSON.stringify(files.map((row) => row.name)) !==
        JSON.stringify(expectedProviderFiles.map((row) => row.name))) {
    fail('release provider source-map file count differs');
  }
  const names = new Set();
  const providerFileIds = new Set();
  let runtimeCount = 0;
  let mapCount = 0;
  for (const [index, row] of files.entries()) {
    exactKeys(row, ['bytes', 'name', 'provider_file_id_sha256', 'sha256'], 'release provider file');
    const expected = expectedProviderFiles[index];
    if (!/^~\/assets\/[A-Za-z0-9._-]+\.js(?:\.map)?$/.test(row.name || '') || names.has(row.name) ||
        providerFileIds.has(row.provider_file_id_sha256) ||
        !Number.isSafeInteger(row.bytes) || row.bytes <= 0 || row.bytes > 50_000_000 ||
        !HASH_RE.test(row.sha256 || '') || !HASH_RE.test(row.provider_file_id_sha256 || '') ||
        row.name !== expected.name || row.bytes !== expected.bytes || row.sha256 !== expected.sha256) {
      fail('release provider source-map file differs');
    }
    names.add(row.name);
    providerFileIds.add(row.provider_file_id_sha256);
    if (row.name.endsWith('.js.map')) mapCount += 1;
    else runtimeCount += 1;
  }
  if (runtimeCount !== receipt.source_map_runtime_count || mapCount !== receipt.source_map_count ||
      [...names].some((name) => name.endsWith('.js') && !names.has(`${name}.map`))) {
    fail('release provider runtime/source-map relation differs');
  }
  validateFinalPagination(providerReadback.file_pages, {
    label: 'release file', totalItems: files.length,
  });

  const deployPages = providerReadback.deploy_pages;
  const rows = new Map(requestProof.requests.map((row) => [row.operation, row.http_status]));
  const expectedOperations = new Map([
    ['organization', 200], ['project', 200], ['precreate', 404], ['create', 201],
    ['finalize', 200], ['final', 200],
  ]);
  for (let index = 0; index < expectedFileCount; index += 1) {
    expectedOperations.set(`upload-${index}`, 201);
    expectedOperations.set(`download-${index}`, 200);
  }
  for (const index of deployPages.keys()) expectedOperations.set(`deploy-page-${index}`, 200);
  for (const index of providerReadback.file_pages.keys()) expectedOperations.set(`files-page-${index}`, 200);
  if (rows.size !== expectedOperations.size || [...expectedOperations].some(([operation, status]) =>
    rows.get(operation) !== status)) {
    fail('release provider operation or HTTP-status set differs');
  }
  return true;
}

function validatePhysioSentryCurrentReadiness({
  receipt,
  readback,
  requestProof,
  releaseReceipt,
  releaseReceiptSha256,
  sourceMapManifest,
  applicationSha,
  buildTimestamp,
}) {
  exactKeys(receipt, [
    'application', 'application_sha', 'completed_at', 'contract_version', 'profession_id',
    'provider_readback_sha256', 'provider_request_id_hashes_sha256',
    'release_receipt_sha256', 'release_version', 'result', 'sentry_environment',
    'sentry_org', 'sentry_project', 'sentry_project_id', 'source_map_manifest_sha256',
  ], 'Sentry current-readiness receipt');
  exactIdentity(receipt, applicationSha, 'Sentry current-readiness receipt');
  if (receipt.contract_version !== PHYSIO_SENTRY_CURRENT_READINESS_CONTRACT ||
      receipt.result !== 'PASS' || receipt.release_receipt_sha256 !== releaseReceiptSha256 ||
      receipt.source_map_manifest_sha256 !== releaseReceipt.source_map_manifest_sha256 ||
      receipt.provider_readback_sha256 !== readback.sha256 ||
      receipt.provider_request_id_hashes_sha256 !== requestProof.sha256) {
    fail('Sentry current-readiness receipt binding differs');
  }
  requireTimestamp(receipt.completed_at, 'Sentry current-readiness completed_at');
  if (Date.parse(receipt.completed_at) < Date.parse(releaseReceipt.completed_at)) {
    fail('Sentry current-readiness chronology differs');
  }

  const providerReadback = readback.value;
  exactKeys(providerReadback, [
    'deploy_pages', 'file_pages', 'organization', 'project', 'release', 'source_map_files',
  ], 'Sentry current-readiness provider readback');
  exactKeys(providerReadback.release, [
    'date_released', 'deploy_count', 'first_event', 'last_deploy', 'last_event',
    'projects', 'status', 'version',
  ], 'Sentry current-readiness release readback');
  const providerRelease = providerReadback.release;
  validateProviderTargetReadback({
    organization: providerReadback.organization,
    project: providerReadback.project,
    release: {
      version: providerRelease.version,
      status: providerRelease.status,
      deployCount: providerRelease.deploy_count,
      lastDeploy: providerRelease.last_deploy,
      firstEvent: providerRelease.first_event,
      lastEvent: providerRelease.last_event,
      projects: providerRelease.projects,
    },
  }, { applicationSha, releaseState: 'safe-orphan', deployPages: providerReadback.deploy_pages });
  if (providerRelease.date_released !== buildTimestamp ||
      !Number.isFinite(Date.parse(providerRelease.date_released))) {
    fail('Sentry current-readiness finalized timestamp differs');
  }

  const expectedFiles = [...sourceMapManifest.runtime_js, ...sourceMapManifest.source_maps]
    .map((row) => ({ name: `~/${row.path}`, bytes: row.bytes, sha256: row.sha256 }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const providerFiles = providerReadback.source_map_files;
  if (!Array.isArray(providerFiles) || providerFiles.length !== expectedFiles.length ||
      JSON.stringify(providerFiles.map((row) => row.name)) !==
        JSON.stringify(expectedFiles.map((row) => row.name))) {
    fail('Sentry current-readiness provider file set differs');
  }
  const providerIds = new Set();
  for (const [index, row] of providerFiles.entries()) {
    exactKeys(row, ['bytes', 'name', 'provider_file_id_sha256', 'sha256'],
      'Sentry current-readiness provider file');
    const expected = expectedFiles[index];
    if (row.name !== expected.name || row.bytes !== expected.bytes || row.sha256 !== expected.sha256 ||
        !HASH_RE.test(row.provider_file_id_sha256 || '') || providerIds.has(row.provider_file_id_sha256)) {
      fail('Sentry current-readiness provider file differs');
    }
    providerIds.add(row.provider_file_id_sha256);
  }
  validateFinalPagination(providerReadback.file_pages, {
    label: 'Sentry current-readiness file', totalItems: providerFiles.length,
  });

  exactKeys(requestProof.value, ['release_receipt_sha256', 'requests'],
    'Sentry current-readiness provider proof');
  if (requestProof.value.release_receipt_sha256 !== releaseReceiptSha256) {
    fail('Sentry current-readiness provider proof release binding differs');
  }
  validateProviderRequestProof({ requests: requestProof.value.requests },
    'Sentry current-readiness provider proof');
  const rows = new Map(requestProof.value.requests.map((row) => [row.operation, row.http_status]));
  const expectedOperations = new Map([
    ['organization', 200], ['project', 200], ['release', 200],
  ]);
  for (const index of providerReadback.deploy_pages.keys()) {
    expectedOperations.set(`deploy-page-${index}`, 200);
  }
  for (const index of providerReadback.file_pages.keys()) {
    expectedOperations.set(`files-page-${index}`, 200);
  }
  for (const index of providerFiles.keys()) expectedOperations.set(`download-${index}`, 200);
  if (rows.size !== expectedOperations.size || [...expectedOperations].some(([operation, status]) =>
    rows.get(operation) !== status)) {
    fail('Sentry current-readiness provider operation or HTTP-status set differs');
  }
  return true;
}

export function validatePhysioSentryReleasePacket(packet, {
  applicationSha,
  capabilityIntentId,
  authorityReference,
  sourceMapManifestSha256 = '',
  sourceMapArchiveSha256 = '',
} = {}) {
  const root = path.resolve(packet || '');
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('release packet root is invalid');
  const phaseRoot = path.join(root, 'sentry-phase-packet');
  if (!fs.existsSync(phaseRoot)) fail('release phase packet root is missing');
  const phaseRootStat = fs.lstatSync(phaseRoot);
  if (!phaseRootStat.isDirectory() || phaseRootStat.isSymbolicLink()) {
    fail('release phase packet root is invalid');
  }
  const phaseBytes = safeReadFile(path.join(phaseRoot, 'sentry-phase.json'), {
    label: 'release terminal phase receipt',
  });
  const phaseReceipt = JSON.parse(phaseBytes.toString('utf8'));
  const sequence = phaseReceipt.phase_sequence;
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 400) {
    fail('release phase sequence differs');
  }
  const indexedName = (prefix, index) => `${prefix}-${String(index).padStart(4, '0')}.json`;
  const expectedPhaseFiles = ['SHA256SUMS', 'sentry-phase.json'];
  for (let index = 0; index < sequence; index += 1) {
    expectedPhaseFiles.push(indexedName('phase', index));
  }
  for (let index = 1; index <= sequence; index += 1) {
    expectedPhaseFiles.push(indexedName('reconciliation', index));
  }
  expectedPhaseFiles.sort();
  const readinessFiles = [
    'provider-current-readiness-readback.json',
    'provider-current-readiness-request-id-hashes.json',
    'sentry-current-readiness.json',
  ];
  const readinessFileCount = readinessFiles.filter((name) => fs.existsSync(path.join(root, name))).length;
  if (![0, readinessFiles.length].includes(readinessFileCount)) {
    fail('release current-readiness file set is incomplete');
  }
  const expectedTopLevel = [
    'SHA256SUMS',
    'physio-sentry-release.json',
    'provider-release-readback.json',
    'provider-request-id-hashes.json',
    'sentry-phase-packet',
    'sentry-release-effect-reconciliation.json',
    'sentry-source-map-manifest.json',
    'sentry-started-effect.json',
    ...(readinessFileCount === readinessFiles.length ? readinessFiles : []),
  ].sort();
  const actualTopLevel = fs.readdirSync(root).sort();
  if (JSON.stringify(actualTopLevel) !== JSON.stringify(expectedTopLevel)) {
    fail('release packet file set differs');
  }
  for (const name of expectedTopLevel.filter((value) => value !== 'sentry-phase-packet')) {
    const stat = fs.lstatSync(path.join(root, name));
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > 1_048_576) {
      fail(`release packet ${name} is invalid`);
    }
  }
  if (JSON.stringify(fs.readdirSync(phaseRoot).sort()) !== JSON.stringify(expectedPhaseFiles)) {
    fail('release phase packet file set differs');
  }
  const expectedChecksummedFiles = [
    ...expectedTopLevel.filter((name) => name !== 'SHA256SUMS' && name !== 'sentry-phase-packet'),
    ...expectedPhaseFiles.map((name) => `sentry-phase-packet/${name}`),
  ].sort();
  const fileBytes = new Map(expectedChecksummedFiles.map((name) => [name, safeReadFile(
    path.join(root, ...name.split('/')),
    { label: `release packet ${name}` },
  )]));
  const fileHash = (name) => createHash('sha256').update(fileBytes.get(name) || safeReadFile(
    path.join(root, name), { label: `release packet ${name}` },
  )).digest('hex');
  const checksumBytes = safeReadFile(path.join(root, 'SHA256SUMS'), {
    label: 'release packet checksum',
  });
  const expectedSums = expectedChecksummedFiles
    .map((name) => `${fileHash(name)}  ${name}\n`).join('');
  if (checksumBytes.includes(13) || checksumBytes.toString('utf8') !== expectedSums) {
    fail('release packet SHA256SUMS binding differs');
  }
  const receipt = readJson(path.join(root, 'physio-sentry-release.json'));
  validatePhysioSentryReleaseReceipt(receipt, {
    applicationSha,
    sourceMapManifestSha256,
    sourceMapArchiveSha256,
  });
  if (fileHash('provider-release-readback.json') !== receipt.provider_release_readback_sha256 ||
      fileHash('provider-request-id-hashes.json') !== receipt.provider_request_id_hashes_sha256 ||
      fileHash('sentry-release-effect-reconciliation.json') !== receipt.effect_reconciliation_receipt_sha256 ||
      fileHash('sentry-started-effect.json') !== receipt.started_effect_receipt_sha256) {
    fail('release packet proof-file hash binding differs');
  }

  const manifestBytes = fileBytes.get('sentry-source-map-manifest.json');
  const manifestSha256 = createHash('sha256').update(manifestBytes).digest('hex');
  if (manifestSha256 !== receipt.source_map_manifest_sha256 ||
      (sourceMapManifestSha256 && manifestSha256 !== sourceMapManifestSha256)) {
    fail('release packet frozen source-map manifest binding differs');
  }
  const sourceMapManifest = JSON.parse(manifestBytes.toString('utf8'));
  validatePhysioSentrySourceMapManifest(sourceMapManifest, { applicationSha });
  validatePhysioSentryPhasePacket(phaseRoot, {
    applicationSha,
    capabilityIntentId,
    authorityReference,
    sourceMapManifestSha256: manifestSha256,
    sourceMapArchiveSha256: receipt.source_map_archive_sha256,
  });
  const startedBytes = fileBytes.get('sentry-started-effect.json');
  if (!startedBytes.equals(phaseBytes)) {
    fail('release terminal phase is not the exact admitted phase-packet terminal bytes');
  }

  const expectedRelease = sentryReleaseForProfession(PROFESSION_ID, applicationSha);
  const started = JSON.parse(startedBytes.toString('utf8'));
  const providerIdentity = {
    application_sha: applicationSha,
    release_version: expectedRelease,
    source_map_manifest_sha256: receipt.source_map_manifest_sha256,
    source_map_archive_sha256: receipt.source_map_archive_sha256,
    capability_intent_id: capabilityIntentId,
    authority_reference: authorityReference,
  };
  const expectedProviderEffectId = `sha256:${createHash('sha256')
    .update(JSON.stringify(providerIdentity)).digest('hex')}`;
  if (started.contract_version !== PHYSIO_SENTRY_PHASE_CONTRACT) {
    fail('completed release lacks the exact v2 phase state-machine packet');
  }
  const effectV2 = readJson(path.join(root, 'sentry-release-effect-reconciliation.json'));
  const requestProofV2 = readJson(path.join(root, 'provider-request-id-hashes.json'));
  const providerReadbackV2 = readJson(path.join(root, 'provider-release-readback.json'));
  validatePhysioSentryReleasePacketV2({
    started,
    effect: effectV2,
    requestProof: requestProofV2,
    providerReadback: providerReadbackV2,
    sourceMapManifest,
    receipt,
    applicationSha,
    capabilityIntentId,
    authorityReference,
    expectedProviderEffectId,
  });
  if (readinessFileCount === readinessFiles.length) {
    const readinessReceipt = readJson(path.join(root, 'sentry-current-readiness.json'));
    const readinessReadbackBytes = fileBytes.get('provider-current-readiness-readback.json');
    const readinessRequestBytes = fileBytes.get('provider-current-readiness-request-id-hashes.json');
    validatePhysioSentryCurrentReadiness({
      receipt: readinessReceipt,
      readback: {
        value: JSON.parse(readinessReadbackBytes.toString('utf8')),
        sha256: createHash('sha256').update(readinessReadbackBytes).digest('hex'),
      },
      requestProof: {
        value: JSON.parse(readinessRequestBytes.toString('utf8')),
        sha256: createHash('sha256').update(readinessRequestBytes).digest('hex'),
      },
      releaseReceipt: receipt,
      releaseReceiptSha256: fileHash('physio-sentry-release.json'),
      sourceMapManifest,
      applicationSha,
      buildTimestamp: sourceMapManifest.build_timestamp,
    });
  }
  return true;
}

export function validatePhysioSentryDeploymentReceipt(receipt, {
  applicationSha,
  immutableImage,
  releaseReceiptSha256 = '',
  deployReceiptSha256 = '',
} = {}) {
  exactKeys(receipt, [
    'application', 'application_sha', 'completed_at', 'contract_version',
    'credential_scope', 'deploy_receipt_sha256', 'deployment_environment',
    'deployment_name', 'deployment_provider_id_sha256', 'deployment_state',
    'deployment_url', 'deployments_provider_readback_sha256',
    'exact_live_deploy_receipt_bound', 'fly_credential_absent', 'immutable_image',
    'mutation_response_lost', 'mutation_x_sentry_request_id_sha256',
    'profession_id', 'provider_release_readback_sha256', 'release_receipt_sha256',
    'provider_inventory_calls_attempted', 'provider_inventory_calls_confirmed',
    'provider_mutation_calls_attempted', 'provider_mutation_calls_confirmed',
    'provider_mutation_http_receipt_sha256',
    'release_version', 'result', 'sentry_dsn_absent', 'sentry_environment',
    'sentry_org', 'sentry_project', 'sentry_project_id', 'started_effect_artifact_digest',
    'started_effect_artifact_id', 'started_effect_receipt_sha256',
  ], 'deployment receipt');
  if (receipt.contract_version !== PHYSIO_SENTRY_DEPLOYMENT_CONTRACT || receipt.result !== 'PASS') {
    fail('deployment receipt result differs');
  }
  exactIdentity(receipt, applicationSha, 'deployment receipt');
  if (!IMAGE_RE.test(immutableImage || '') || receipt.immutable_image !== immutableImage ||
      receipt.deployment_environment !== PHYSIO_SENTRY_ENVIRONMENT ||
      receipt.deployment_name !== `assesssuite-physio-production-${applicationSha.slice(0, 12)}` ||
      receipt.deployment_url !== 'https://assesssuite-physio-production.fly.dev' ||
      !['created', 'preexisting'].includes(receipt.deployment_state)) {
    fail('deployment receipt deployment identity differs');
  }
  requireHashes(receipt, [
    'deploy_receipt_sha256', 'deployment_provider_id_sha256',
    'deployments_provider_readback_sha256', 'provider_release_readback_sha256',
    'release_receipt_sha256', 'started_effect_receipt_sha256',
  ], 'deployment receipt');
  if ((releaseReceiptSha256 && receipt.release_receipt_sha256 !== releaseReceiptSha256) ||
      (deployReceiptSha256 && receipt.deploy_receipt_sha256 !== deployReceiptSha256) ||
      receipt.exact_live_deploy_receipt_bound !== true ||
      !/^[1-9][0-9]*$/.test(receipt.started_effect_artifact_id || '') ||
      !/^sha256:[0-9a-f]{64}$/.test(receipt.started_effect_artifact_digest || '') ||
      ![receipt.provider_mutation_calls_attempted, receipt.provider_mutation_calls_confirmed,
        receipt.provider_inventory_calls_attempted, receipt.provider_inventory_calls_confirmed]
        .every((value) => Number.isSafeInteger(value) && value >= 0) ||
      receipt.provider_mutation_calls_confirmed > receipt.provider_mutation_calls_attempted ||
      receipt.provider_inventory_calls_attempted < 1 ||
      receipt.provider_inventory_calls_attempted !== receipt.provider_inventory_calls_confirmed ||
      !(receipt.mutation_x_sentry_request_id_sha256 === null ||
        HASH_RE.test(receipt.mutation_x_sentry_request_id_sha256 || '')) ||
      !(receipt.provider_mutation_http_receipt_sha256 === null ||
        HASH_RE.test(receipt.provider_mutation_http_receipt_sha256 || '')) ||
      typeof receipt.mutation_response_lost !== 'boolean' ||
      receipt.fly_credential_absent !== true || receipt.sentry_dsn_absent !== true ||
      JSON.stringify(receipt.credential_scope) !== JSON.stringify(['SENTRY_AUTH_TOKEN'])) {
    fail('deployment receipt proof differs');
  }
  if (receipt.deployment_state === 'created'
    ? (receipt.provider_mutation_calls_attempted !== 1 || receipt.provider_mutation_calls_confirmed !== 1 ||
       (!receipt.mutation_response_lost && !HASH_RE.test(receipt.provider_mutation_http_receipt_sha256 || '')))
    : (receipt.provider_mutation_calls_attempted !== 0 || receipt.provider_mutation_calls_confirmed !== 0 ||
       receipt.provider_mutation_http_receipt_sha256 !== null ||
       receipt.mutation_x_sentry_request_id_sha256 !== null)) {
    fail('deployment receipt mutation proof differs');
  }
  requireTimestamp(receipt.completed_at, 'deployment receipt completed_at');
  return true;
}

function readJson(file) {
  return JSON.parse(safeReadFile(file, { label: 'receipt file' }).toString('utf8'));
}

function option(args, name, required = true) {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : '';
  if (required && (!value || value.startsWith('--'))) fail(`missing ${name}`);
  return value || '';
}

function main() {
  const args = process.argv.slice(2);
  const command = args.shift();
  if (command === 'validate-source-map-manifest') {
    validatePhysioSentrySourceMapManifest(readJson(option(args, '--manifest')), {
      applicationSha: option(args, '--application-sha'),
    });
  } else if (command === 'validate-release') {
    validatePhysioSentryReleaseReceipt(readJson(option(args, '--receipt')), {
      applicationSha: option(args, '--application-sha'),
      sourceMapManifestSha256: option(args, '--source-map-manifest-sha256', false),
      sourceMapArchiveSha256: option(args, '--source-map-archive-sha256', false),
    });
  } else if (command === 'validate-phase-packet') {
    validatePhysioSentryPhasePacket(option(args, '--packet'), {
      applicationSha: option(args, '--application-sha'),
      capabilityIntentId: option(args, '--capability-intent-id'),
      authorityReference: option(args, '--authority-reference'),
      sourceMapManifestSha256: option(args, '--source-map-manifest-sha256', false),
      sourceMapArchiveSha256: option(args, '--source-map-archive-sha256', false),
    });
  } else if (command === 'validate-reconciliation-packet') {
    validatePhysioSentryReconciliationPacket(option(args, '--packet'), {
      applicationSha: option(args, '--application-sha'),
      providerEffectId: option(args, '--provider-effect-id'),
      phaseArtifactId: option(args, '--phase-artifact-id'),
      phaseArtifactDigest: option(args, '--phase-artifact-digest'),
      phaseReceiptSha256: option(args, '--phase-receipt-sha256'),
    });
  } else if (command === 'extract-provider-request-ids') {
    const proof = extractSentryProviderRequestIdHashes(
      safeReadFile(option(args, '--headers'), { label: 'provider response headers' }),
      { label: option(args, '--label', false) || 'provider response' },
    );
    const output = path.resolve(option(args, '--output'));
    fs.writeFileSync(output, `${JSON.stringify(proof, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  } else if (command === 'validate-safe-orphan-readback') {
    const deployReadback = readJson(option(args, '--deploy-pages'));
    validatePhysioSentrySafeOrphanReadback(
      readJson(option(args, '--release')),
      Array.isArray(deployReadback) ? deployReadback : deployReadback.pages,
      { applicationSha: option(args, '--application-sha') },
    );
  } else if (command === 'validate-release-packet') {
    validatePhysioSentryReleasePacket(option(args, '--packet'), {
      applicationSha: option(args, '--application-sha'),
      capabilityIntentId: option(args, '--capability-intent-id'),
      authorityReference: option(args, '--authority-reference'),
      sourceMapManifestSha256: option(args, '--source-map-manifest-sha256', false),
      sourceMapArchiveSha256: option(args, '--source-map-archive-sha256', false),
    });
  } else if (command === 'validate-deployment') {
    validatePhysioSentryDeploymentReceipt(readJson(option(args, '--receipt')), {
      applicationSha: option(args, '--application-sha'),
      immutableImage: option(args, '--immutable-image'),
      releaseReceiptSha256: option(args, '--release-receipt-sha256', false),
      deployReceiptSha256: option(args, '--deploy-receipt-sha256', false),
    });
  } else {
    fail('usage: validate-source-map-manifest|validate-phase-packet|validate-reconciliation-packet|extract-provider-request-ids|validate-safe-orphan-readback|validate-release|validate-release-packet|validate-deployment');
  }
  process.stdout.write('{"result":"PASS"}\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exitCode = 1;
  }
}
