// Production startup bootstrap.
//
// This entry point is intentionally separate from server/seed.mjs. It may
// populate only the idempotent reference catalogues required by the captured
// application. It must never create demo organisations, accounts, legal
// receipts, clients or clinical records.

import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { openDatabase, PARITY_ASSURANCE_DB_PATH } from './db.mjs';
import { runCatalogueSeed } from './seed.mjs';

export const PARITY_ASSURANCE_UPLOADS_DIR = '/app/server/data/assesssuite-parity-uploads';

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
  assertParityAssuranceEnvironment(environment);
}

export function runProductionBootstrap({
  environment = process.env,
  openDatabaseFn = openDatabase,
  catalogueSeedFn = runCatalogueSeed,
} = {}) {
  assertProductionBootstrapEnvironment(environment);
  const opened = openDatabaseFn();
  if (!opened?.db || !(opened.entityNames instanceof Set)) {
    throw new Error('The production database bootstrap contract is unavailable.');
  }
  try {
    catalogueSeedFn({ db: opened.db, entityNames: opened.entityNames });
  } finally {
    opened.db.close();
  }
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isMainModule()) {
  runProductionBootstrap();
}
