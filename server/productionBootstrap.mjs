// Production startup bootstrap.
//
// This entry point is intentionally separate from server/seed.mjs. It may
// populate only the idempotent reference catalogues required by the captured
// application. It must never create demo organisations, accounts, legal
// receipts, clients or clinical records.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { openDatabase, PARITY_ASSURANCE_DB_PATH } from './db.mjs';
import { runProductionCatalogueSeed } from './productionCatalogue.mjs';
import { resolveActiveProfessionContract } from '../packages/profession-config/runtime.mjs';
import {
  assertPhysioProductionPosture,
  PHYSIO_EXACT_IMAGE_CANARY_MODE,
  PHYSIO_PRODUCTION_DATA_FILE,
  PHYSIO_PRODUCTION_UPLOADS_DIR,
  PHYSIO_R1_COMPARISON_PUBLIC_URL,
  PHYSIO_R1_COMPARISON_VARIANT,
} from './productionPosture.mjs';

export const PARITY_ASSURANCE_UPLOADS_DIR = '/app/server/data/assesssuite-parity-uploads';
export const PRODUCTION_APP_URL = 'https://app.assesssuite.com';
export const PHYSIO_CANARY_BOOTSTRAP_RECEIPT_CONTRACT_VERSION =
  'assesssuite-physio-exact-image-canary-bootstrap/1.0.0';

export function productionAppUrlFor(environment = process.env) {
  if (environment.ASSESSSUITE_DEPLOYMENT_VARIANT === PHYSIO_R1_COMPARISON_VARIANT) {
    return PHYSIO_R1_COMPARISON_PUBLIC_URL;
  }
  const { profession } = resolveActiveProfessionContract(environment);
  return `https://${profession.deployment.intendedAppHost}`;
}

export function assertParityAssuranceEnvironment(environment = process.env) {
  const mode = environment.PARITY_ASSURANCE_MODE;
  if (mode !== undefined && mode !== '' && mode !== '0' && mode !== '1') {
    throw new Error('PARITY_ASSURANCE_MODE must be exactly 0 or 1 when set.');
  }
  if (mode !== '1') return;

  const required = {
    OUTBOUND_EMAIL_ENABLED: '0',
    OUTBOUND_SMS_ENABLED: '0',
    PAYMENTS_ENABLED: '0',
    DOCUMENT_EXTRACTION_ENABLED: '1',
    DOCUMENT_EXTRACTION_UNDER_13_ENABLED: '0',
    GENERAL_CLINICAL_LLM_ENABLED: '0',
    TRANSCRIPTION_ENABLED: '0',
    ASSESSSUITE_DB_PATH: PARITY_ASSURANCE_DB_PATH,
    UPLOADS_DIR: PARITY_ASSURANCE_UPLOADS_DIR,
  };
  for (const [name, expected] of Object.entries(required)) {
    if (environment[name] !== expected) {
      throw new Error(`Production parity assurance requires ${name}=${expected}.`);
    }
  }
}

export function assertProductionBootstrapEnvironment(environment = process.env) {
  if (environment.NODE_ENV !== 'production') {
    throw new Error('The production bootstrap requires NODE_ENV=production.');
  }
  if (environment.SELFTEST === '1') {
    throw new Error('SELFTEST is forbidden during production bootstrap.');
  }
  const expectedProductionAppUrl = productionAppUrlFor(environment);
  if (environment.EXPECTED_APP_URL !== expectedProductionAppUrl) {
    throw new Error(`Production bootstrap requires EXPECTED_APP_URL=${expectedProductionAppUrl}.`);
  }
  if (environment.APP_URL !== environment.EXPECTED_APP_URL) {
    throw new Error('Production bootstrap requires APP_URL to match EXPECTED_APP_URL.');
  }
  const physioPosture = assertPhysioProductionPosture(environment);
  assertParityAssuranceEnvironment(environment);
  return physioPosture;
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function writePhysioCanaryBootstrapReceipt(
  environment,
  posture,
  writeFileFn = fs.writeFileSync,
) {
  if (environment[PHYSIO_EXACT_IMAGE_CANARY_MODE] !== '1') return null;
  const activeContract = resolveActiveProfessionContract(environment);
  const output = environment.PHYSIO_EXACT_IMAGE_CANARY_BOOTSTRAP_RECEIPT;
  const receipt = {
    contract_version: PHYSIO_CANARY_BOOTSTRAP_RECEIPT_CONTRACT_VERSION,
    result: 'PASS',
    mode: 'exact-image-canary',
    node_env: environment.NODE_ENV,
    profession_id: activeContract.professionId,
    app_id: activeContract.appId,
    application_sha: environment.RELEASE_SHA,
    build_timestamp: environment.BUILD_TIMESTAMP,
    database_path_sha256: sha256(PHYSIO_PRODUCTION_DATA_FILE),
    uploads_path_sha256: sha256(PHYSIO_PRODUCTION_UPLOADS_DIR),
    production_posture_contract_version: posture.contract_version,
    production_posture_sha256: posture.posture_sha256,
    catalogue_bootstrap_completed: true,
    completed_at: new Date().toISOString(),
  };
  writeFileFn(output, `${JSON.stringify(receipt, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  return Object.freeze(receipt);
}

export function runProductionBootstrap({
  environment = process.env,
  openDatabaseFn = openDatabase,
  catalogueSeedFn = runProductionCatalogueSeed,
  writeFileFn = fs.writeFileSync,
} = {}) {
  const physioPosture = assertProductionBootstrapEnvironment(environment);
  const opened = openDatabaseFn();
  if (!opened?.db || !(opened.entityNames instanceof Set)) {
    throw new Error('The production database bootstrap contract is unavailable.');
  }
  try {
    catalogueSeedFn({
      db: opened.db,
      entityNames: opened.entityNames,
      environment,
    });
  } finally {
    opened.db.close();
  }
  return writePhysioCanaryBootstrapReceipt(environment, physioPosture, writeFileFn);
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isMainModule()) {
  runProductionBootstrap();
}
