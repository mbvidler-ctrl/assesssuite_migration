// Sandbox startup bootstrap — the containerised production-parity sandbox.
//
// This entry point boots the SAME image production uses (NODE_ENV=production
// baked into the Dockerfile) but with sandbox semantics: on every boot it
// wipes the ephemeral database, reseeds the full synthetic dataset from the
// captured schemas, and then verifies the result against the seed manifest
// with the data-provenance gate before the server is allowed to start.
//
// The sandbox NEVER receives production data. Its dataset is synthesised
// from schema knowledge only (server/seed.mjs) — no real user, client,
// clinician, or organisation record is copied, scrubbed, or transformed.
//
// Fail-closed guards, in order, all before any database file is touched:
//   1. SANDBOX_MODE must be exactly '1' (set only by the sandbox Fly config).
//   2. FLY_APP_NAME must not be the production app — a copy-paste of this
//      process command into the production config refuses to run.
//   3. The parity-assurance lane (PARITY_ASSURANCE_MODE=1) is mutually
//      exclusive with the sandbox lane.
//   4. SELFTEST is forbidden (it has its own throwaway database contract).
//   5. ASSESSSUITE_DB_PATH overrides are forbidden except for the existing
//      isolated NODE_ENV=test gate harness — the sandbox always uses the
//      default ephemeral store, so it can never point at a mounted volume.
//   6. Outbound egress (email, SMS, payments) must be off: synthetic
//      records must never be able to message or bill anything real.
//   7. Open self-registration must be off — sandbox accounts come from the
//      seed manifest so the provenance gate stays meaningful.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { openDatabase, resolveDatabaseFile } from './db.mjs';
import { runSeed, PRODUCTION_FLY_APP_NAME } from './seed.mjs';
import { runProvenanceGate } from '../scripts/sandbox-data-provenance-gate.mjs';

export function assertSandboxBootstrapEnvironment(environment = process.env) {
  if (environment.SANDBOX_MODE !== '1') {
    throw new Error('The sandbox bootstrap requires SANDBOX_MODE=1.');
  }
  if (environment.FLY_APP_NAME === PRODUCTION_FLY_APP_NAME) {
    throw new Error(
      `The sandbox bootstrap must never run on the production app (${PRODUCTION_FLY_APP_NAME}).`,
    );
  }
  if (environment.PARITY_ASSURANCE_MODE === '1') {
    throw new Error('SANDBOX_MODE and PARITY_ASSURANCE_MODE are mutually exclusive.');
  }
  if (environment.SELFTEST === '1') {
    throw new Error('SELFTEST is forbidden during sandbox bootstrap.');
  }
  const isolatedGateHarness =
    environment.NODE_ENV === 'test' &&
    environment.ASSESSSUITE_DB_PATH_ACK ===
      'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE';
  if (environment.ASSESSSUITE_DB_PATH && !isolatedGateHarness) {
    throw new Error(
      'The sandbox uses only the default ephemeral database; ASSESSSUITE_DB_PATH is forbidden outside the isolated test harness.',
    );
  }
  for (const gate of ['OUTBOUND_EMAIL_ENABLED', 'OUTBOUND_SMS_ENABLED', 'PAYMENTS_ENABLED']) {
    if (environment[gate] === '1') {
      throw new Error(`The sandbox requires ${gate} to be 0 or unset.`);
    }
  }
  if (environment.ALLOW_OPEN_REGISTRATION === '1') {
    throw new Error('The sandbox requires ALLOW_OPEN_REGISTRATION=0 so every account traces to the seed manifest.');
  }
}

/**
 * Deletes the sandbox database file plus WAL/SHM/journal siblings so every
 * boot starts from a genuinely empty store — anything done in a previous
 * sandbox session (including any data a visitor typed in) is discarded.
 */
export function wipeSandboxDatabase(environment = process.env) {
  const dbFile = resolveDatabaseFile(environment);
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const candidate = `${dbFile}${suffix}`;
    if (fs.existsSync(candidate)) fs.rmSync(candidate);
  }
  return dbFile;
}

export function runSandboxBootstrap({
  environment = process.env,
  openDatabaseFn = openDatabase,
  seedFn = runSeed,
  provenanceGateFn = runProvenanceGate,
  wipeFn = wipeSandboxDatabase,
} = {}) {
  assertSandboxBootstrapEnvironment(environment);
  const dbFile = wipeFn(environment);
  console.log(`[sandbox] wiped ${dbFile}; reseeding synthetic dataset`);
  const opened = openDatabaseFn();
  if (!opened?.db || !(opened.entityNames instanceof Set)) {
    throw new Error('The sandbox database bootstrap contract is unavailable.');
  }
  try {
    seedFn({ db: opened.db, entityNames: opened.entityNames });
    const report = provenanceGateFn({ db: opened.db, environment });
    if (report.violations.length > 0) {
      for (const violation of report.violations) {
        console.error(`[sandbox] provenance violation: ${violation}`);
      }
      throw new Error(
        `Sandbox data-provenance gate failed with ${report.violations.length} violation(s); refusing to start.`,
      );
    }
    console.log(
      `[sandbox] provenance gate passed: ${report.checkedRecords} record(s) across ${report.checkedTables} table(s) all trace to the synthetic seed manifest`,
    );
  } finally {
    opened.db.close();
  }
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isMainModule()) {
  runSandboxBootstrap();
}
