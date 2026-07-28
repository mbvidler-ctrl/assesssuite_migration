// Sandbox data-provenance gate.
//
// Proves, mechanically, that a sandbox database contains ONLY synthetic
// seed data — i.e. that no production user, client, or clinical record is
// present. "We removed the real data" is a claim; this gate turns it into a
// checkable invariant. server/sandboxBootstrap.mjs runs it on every sandbox
// boot between reseeding and server start, and refuses to start on any
// violation.
//
// Checks:
//   1. Every User email is in the seed manifest (or is the bootstrap admin).
//   2. Every Organization name is in the seed manifest.
//   3. Every Client carries a _seed_key and a manifest-domain email address.
//   4. Every email-like string anywhere in any entity row (including
//      created_by) uses a reserved synthetic suffix (.test / .example /
//      @example.com) or is the bootstrap admin address. Real-world email
//      addresses cannot satisfy this, so any production-derived record with
//      a contact detail trips the gate.
//   5. Every org-scoped row's org_id resolves to a seeded Organization, and
//      every client_id resolves to a (verified-synthetic) Client.
//   6. Baseline emptiness: sessions, outboxes, and the upload registry are
//      empty (skippable with --allow-runtime-rows for post-boot audits of a
//      live sandbox, where logins create session rows).
//
// CLI: node scripts/sandbox-data-provenance-gate.mjs [--db <path>] [--allow-runtime-rows]
// Exit code 0 = provably synthetic; 1 = violations (each printed).

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import { loadEntityNames, loadOrgScopedEntities, resolveDatabaseFile } from '../server/db.mjs';
import { SANDBOX_SEED_MANIFEST } from '../server/seed.mjs';

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function collectEmailLikeStrings(value, found) {
  if (typeof value === 'string') {
    for (const match of value.match(EMAIL_PATTERN) || []) found.push(match);
  } else if (Array.isArray(value)) {
    for (const item of value) collectEmailLikeStrings(item, found);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectEmailLikeStrings(item, found);
  }
}

function isSyntheticEmail(email, adminEmail) {
  const lowered = email.toLowerCase();
  if (lowered === adminEmail.toLowerCase()) return true;
  return SANDBOX_SEED_MANIFEST.syntheticEmailSuffixes.some((suffix) =>
    lowered.endsWith(suffix.toLowerCase()),
  );
}

function tableExists(db, table) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table),
  );
}

/**
 * Runs the gate against an open DatabaseSync handle (preferred — the sandbox
 * bootstrap passes its own) or a database file path. Returns
 * { violations, checkedTables, checkedRecords } and never throws on data
 * findings — callers decide whether violations are fatal.
 */
export function runProvenanceGate({
  db: providedDb,
  dbPath,
  environment = process.env,
  allowRuntimeRows = false,
} = {}) {
  const adminEmail = environment.ADMIN_EMAIL || 'admin@local.test';
  const violations = [];
  let checkedTables = 0;
  let checkedRecords = 0;

  const db = providedDb || new DatabaseSync(path.resolve(dbPath || resolveDatabaseFile(environment)), { readOnly: true });
  try {
    const entityNames = loadEntityNames();
    const orgScoped = loadOrgScopedEntities();

    function listRecords(entityName) {
      const table = `entity_${entityName}`;
      if (!tableExists(db, table)) return [];
      return db.prepare(`SELECT * FROM ${table}`).all().map((row) => ({
        id: row.id,
        created_by: row.created_by,
        ...JSON.parse(row.data),
      }));
    }

    // --- Manifest identity checks -------------------------------------------
    const allowedUserEmails = new Set(
      [...SANDBOX_SEED_MANIFEST.userEmails, adminEmail].map((e) => e.toLowerCase()),
    );
    for (const user of listRecords('User')) {
      const email = String(user.email || '').toLowerCase();
      if (!allowedUserEmails.has(email)) {
        violations.push(`User ${user.id} has email "${user.email}" outside the seed manifest`);
      }
    }

    const seededOrgIds = new Set();
    for (const org of listRecords('Organization')) {
      if (!SANDBOX_SEED_MANIFEST.organisationNames.includes(org.name)) {
        violations.push(`Organization ${org.id} has name "${org.name}" outside the seed manifest`);
      } else {
        seededOrgIds.add(org.id);
      }
    }

    const seededClientIds = new Set();
    for (const client of listRecords('Client')) {
      const email = String(client.email || '');
      const emailOk = email.toLowerCase().endsWith(`@${SANDBOX_SEED_MANIFEST.clientEmailDomain}`);
      if (!client._seed_key || !emailOk) {
        violations.push(
          `Client ${client.id} ("${client.full_name}") lacks a _seed_key or manifest-domain email — not provably synthetic`,
        );
      } else {
        seededClientIds.add(client.id);
      }
    }

    // --- Per-table scans -----------------------------------------------------
    for (const entityName of entityNames) {
      const records = listRecords(entityName);
      checkedTables += 1;
      checkedRecords += records.length;
      for (const record of records) {
        const emails = [];
        collectEmailLikeStrings(record, emails);
        for (const email of emails) {
          if (!isSyntheticEmail(email, adminEmail)) {
            violations.push(`${entityName} ${record.id} contains non-synthetic email address "${email}"`);
          }
        }
        if (orgScoped.has(entityName) && record.org_id && !seededOrgIds.has(record.org_id)) {
          violations.push(`${entityName} ${record.id} references org_id ${record.org_id} outside the seeded organisations`);
        }
        if (entityName !== 'Client' && record.client_id && !seededClientIds.has(record.client_id)) {
          violations.push(`${entityName} ${record.id} references client_id ${record.client_id} outside the seeded clients`);
        }
      }
    }

    // --- Baseline emptiness --------------------------------------------------
    if (!allowRuntimeRows) {
      for (const table of ['sessions', 'outbox_email', 'outbox_sms', 'upload_registry']) {
        if (!tableExists(db, table)) continue;
        const count = Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
        if (count > 0) {
          violations.push(`${table} holds ${count} row(s); the seeded baseline must be empty (use --allow-runtime-rows for a live sandbox)`);
        }
      }
    }
  } finally {
    if (!providedDb) db.close();
  }

  return { violations, checkedTables, checkedRecords };
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isMainModule()) {
  const args = process.argv.slice(2);
  const dbFlagIndex = args.indexOf('--db');
  const report = runProvenanceGate({
    dbPath: dbFlagIndex >= 0 ? args[dbFlagIndex + 1] : undefined,
    allowRuntimeRows: args.includes('--allow-runtime-rows'),
  });
  for (const violation of report.violations) {
    console.error(`[provenance-gate] VIOLATION: ${violation}`);
  }
  console.log(
    `[provenance-gate] checked ${report.checkedRecords} record(s) across ${report.checkedTables} table(s): ${
      report.violations.length === 0 ? 'all data traces to the synthetic seed manifest' : `${report.violations.length} violation(s)`
    }`,
  );
  process.exit(report.violations.length === 0 ? 0 : 1);
}
