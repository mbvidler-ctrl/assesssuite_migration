// Local Base44 shim server core: node:http, entities CRUD, auth,
// public-settings, telemetry stubs, and static serving (dist/ + uploads/).
//
// Deliberately dependency-free beyond Node built-ins, per the migration
// contract at docs/shim/20260702-sdk-wire-protocol.md.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

import { openDatabase, createEntityRepository, createSessionRepository, createOutboxRepository, loadOrgScopedEntities } from './db.mjs';
import { matchesQuery, applySortSkipLimit, applyProjection } from './query.mjs';
import {
  hashPassword,
  verifyPassword,
  parseBearerToken,
  stripAuthFields,
  sanitizeUpdateMePayload,
  generateOtp,
  normaliseEmail,
} from './auth.mjs';
import { handleCoreIntegration } from './integrations.mjs';
import { initEmail, sendEmail, otpEmail, resetEmail, welcomeEmail, adminNotifyEmail, inviteEmail } from './email.mjs';
import {
  UPLOAD_POLICY,
  UploadError,
  canonicalUploadPath,
  cleanupExpiredUploadAudit,
  cleanupExpiredUploads,
  createUploadRegistry,
  extractUploadIdsFromValue,
} from './uploadRegistry.mjs';
import { verifyFileAccessToken } from './fileAccess.mjs';
import {
  CONTRACT_BUNDLE_IDS,
  EVENT_TYPES,
  LEGAL_DOCUMENTS,
  PRACTITIONER_NOTICE_IDS,
  SUITE_VERSION,
  fingerprint as legalContentFingerprint,
} from '../src/lib/legal/documentRegistry.js';
import { effectiveLegalContent } from '../src/lib/legal/effectiveContent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');
// Must resolve identically to server/integrations.mjs (write) and
// server/functions/transcribeSession.mjs (read) — one env var, three readers.
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');

// Load .env.local for local runs (set-if-absent, so real environment variables
// — e.g. Fly secrets in production — always take precedence and are never
// overwritten). Keeps secrets like OPENAI_API_KEY out of the codebase.
(function loadDotEnvLocal() {
  if (process.env.SELFTEST === '1') return; // tests use the deterministic mock
  const file = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1];
    let val = m[2].replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = val;
  }
})();

const PORT = Number(process.env.PORT) || 8787;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@local.test';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-local';
// Access hardening for the private demo. Self-registration and the OTP
// endpoints (which accept the fixed code 000000, and would otherwise mint a
// session for any known email without a password) are DISABLED unless this is
// explicitly set to '1'. Seeded accounts use password login and are unaffected.
// The self-test spawns an isolated throwaway server (SELFTEST=1) and validates
// the registration/OTP flows, so they remain enabled there.
const ALLOW_OPEN_REGISTRATION =
  process.env.ALLOW_OPEN_REGISTRATION === '1' || process.env.SELFTEST === '1';
// OTP / reset hardening (launch): random per-user codes with expiry, attempt
// lockout, and per-account send throttles. The fixed 000000 code is accepted
// only under SELFTEST=1 (see verify-otp).
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCKOUT_MS = 15 * 60 * 1000;
const RESEND_MIN_INTERVAL_MS = 30 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
// Default app id used for the dev-only /functions/<name> relative path when it
// is served in single-process production (mirrors the vite proxy rewrite).
const DEFAULT_APP_ID = process.env.DEFAULT_APP_ID || 'local-assesssuite';

fs.mkdirSync(uploadsDir, { recursive: true });

const { db, entityNames } = openDatabase();
const sessions = createSessionRepository(db);
const outboxEmail = createOutboxRepository(db, 'email');
const outboxSms = createOutboxRepository(db, 'sms');
const uploadRegistry = createUploadRegistry(db, { uploadsDir });
initEmail(outboxEmail);

function runUploadLifecycleMaintenance() {
  try {
    cleanupExpiredUploads({ db, uploadsDir });
    cleanupExpiredUploadAudit({ db });
  } catch (error) {
    console.error('[shim] upload lifecycle maintenance failed:', error?.code || 'maintenance_failed');
  }
}
runUploadLifecycleMaintenance();
const uploadCleanupIntervalMinutes = Math.min(
  60,
  Math.max(1, Number(process.env.UPLOAD_CLEANUP_INTERVAL_MINUTES) || 15),
);
const uploadCleanupTimer = setInterval(
  runUploadLifecycleMaintenance,
  uploadCleanupIntervalMinutes * 60 * 1000,
);
uploadCleanupTimer.unref();

const userRepo = createEntityRepository(db, 'User');
const orgMemberRepo = entityNames.has('OrganizationMember')
  ? createEntityRepository(db, 'OrganizationMember')
  : null;

/**
 * Builds a repository per entity name on demand (repositories are cheap;
 * prepared statements are created lazily per table).
 */
const repoCache = new Map();
function repoFor(entityName) {
  if (!entityNames.has(entityName)) return null;
  if (!repoCache.has(entityName)) {
    repoCache.set(entityName, createEntityRepository(db, entityName));
  }
  return repoCache.get(entityName);
}

// ---------------------------------------------------------------------------
// Bootstrap: ensure a single admin user exists on startup.
// ---------------------------------------------------------------------------
function bootstrapAdmin() {
  const existingAdmin = userRepo.listAll().find((u) => u.role === 'admin');
  if (existingAdmin) return;
  const { password_hash, salt } = hashPassword(ADMIN_PASSWORD);
  const created = userRepo.create(
    {
      email: ADMIN_EMAIL,
      full_name: 'Local Administrator',
      role: 'admin',
      account_status: 'active',
      email_verified: true,
      password_hash,
      salt,
    },
    ADMIN_EMAIL,
  );
  // eslint-disable-next-line no-console
  console.log(`[shim] bootstrap admin created: ${created.email} (id ${created.id})`);
}
bootstrapAdmin();

// ---------------------------------------------------------------------------
// Functions router — replaceable, mounted from server/functions/index.mjs if
// present. Owned by a parallel workstream; this deliverable only wires the
// mount point and the 404 fallback.
// ---------------------------------------------------------------------------
let functionsRouter = null;
async function loadFunctionsRouter() {
  const functionsEntry = path.join(__dirname, 'functions', 'index.mjs');
  if (!fs.existsSync(functionsEntry)) {
    functionsRouter = null;
    return;
  }
  try {
    const mod = await import(pathToFileURL(functionsEntry).href);
    // If the functions router exports init(db, entityNames), hand it this
    // process's already-open db handle rather than letting it call
    // openDatabase() a second time — a second independent call would (a)
    // attempt to re-delete/recreate the SELFTEST db file that this process
    // already holds open (fails with EPERM on Windows file locking) and
    // (b) open a redundant DatabaseSync connection even outside selftest.
    if (typeof mod.init === 'function') {
      mod.init(db, entityNames);
    }
    const transcriptionModule = await import(
      pathToFileURL(path.join(__dirname, 'functions', 'transcribeSession.mjs')).href
    );
    if (typeof transcriptionModule.configureUploadResolver === 'function') {
      transcriptionModule.configureUploadResolver(resolveAudioUploadForFunction);
    }
    functionsRouter = mod.default || mod.handleFunction || null;
  } catch (err) {
    console.error('[shim] failed to load functions router:', err);
    functionsRouter = null;
  }
}
await loadFunctionsRouter();

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    // API responses must never be cached by the browser: entity reads (SOAP
    // notes, saved reports, assessments) were being served stale for minutes
    // after a save, so newly-saved records did not appear in the client profile
    // until the heuristic cache expired.
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.end(payload);
}

function sendNoContent(res) {
  res.writeHead(204);
  res.end();
}

function sendError(res, status, message, extra = {}) {
  sendJson(res, status, { message, ...extra });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return { raw: Buffer.alloc(0), contentType: req.headers['content-type'] || '' };
  return { raw: Buffer.concat(chunks), contentType: req.headers['content-type'] || '' };
}

async function readJsonBody(req) {
  const { raw, contentType } = await readBody(req);
  if (raw.length === 0) return {};
  if (contentType.includes('multipart/form-data')) {
    // Multipart handled separately by callers that need file access; JSON
    // consumers on multipart routes get the parsed fields only.
    const form = await bufferToFormData(raw, contentType);
    const obj = {};
    for (const [key, value] of form.entries()) {
      obj[key] = value;
    }
    return obj;
  }
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    return {};
  }
}

/**
 * Converts a raw multipart buffer into a WHATWG FormData using undici's
 * built-in Response(body, {headers}).formData() — no new dependency.
 */
async function bufferToFormData(raw, contentType) {
  const response = new Response(raw, { headers: { 'content-type': contentType } });
  return response.formData();
}

function parseUrl(req) {
  return new URL(req.url, `http://localhost:${PORT}`);
}

// ---------------------------------------------------------------------------
// Auth / authorisation helpers
// ---------------------------------------------------------------------------

/** Resolves the current session user (or null) from the Authorization header. */
function resolveSessionUser(req) {
  const token = parseBearerToken(req);
  if (!token) return null;
  const session = sessions.findByToken(token);
  if (!session) return null;
  const user = userRepo.getById(session.user_id);
  return user || null;
}

/** Returns true if the entity is unauthenticated-accessible per the contract allow-list. */
function isPublicRoute(pathname) {
  return (
    /^\/api\/apps\/[^/]+\/auth\//.test(pathname) ||
    /^\/api\/apps\/public\//.test(pathname) ||
    /^\/api\/apps\/[^/]+\/analytics\//.test(pathname) ||
    /^\/api\/app-logs\//.test(pathname)
  );
}

/** org_ids the given user belongs to (via OrganizationMember), for non-admins. */
function orgIdsForUser(userEmail) {
  if (!orgMemberRepo) return [];
  return orgMemberRepo
    .listAll()
    .filter((m) => m.user_email === userEmail)
    .map((m) => m.org_id)
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Entities router
// ---------------------------------------------------------------------------

const ENTITY_ROUTE_RE = /^\/api\/apps\/([^/]+)\/entities\/([^/]+)(?:\/(.*))?$/;

// Entities holding client/clinical records: refused entirely to authenticated
// non-admin users whose account is not approved (account_status !== 'active').
const CLINICAL_ENTITIES = new Set([
  'AdverseEvent',
  'Appointment',
  'AssessmentRequest',
  'Client',
  'ClientAssessment',
  'ClientCondition',
  'ClientDocument',
  'ClientNutritionPlan',
  'ClientOnboardingEpisode',
  'ClientReport',
  'Payment',
  'SOAPNote',
  'SavedReport',
]);

// Entities a not-yet-approved user may still WRITE: profile/organisation
// setup and legal acceptance necessarily happen before approval.
const PRE_APPROVAL_WRITE_ENTITIES = new Set([
  'Organization',
  'OrganizationMember',
  'LegalAcceptance',
  'LegalAcceptanceEvent',
  'ClinicPolicy',
]);

// Mirrors src/lib/legal/documentRegistry.js SUITE_VERSION and
// PRACTITIONER_NOTICE_IDS' eventType values. Keep both in sync: bump this
// when the suite version changes, and add/remove an event type here if a
// mandatory practitioner notice is added or retired. This is the server-side
// half of the L-15/L-08 fix — the old model relied solely on the client
// (Layout.jsx) gate, which any direct API caller could bypass entirely.
const LEGAL_SUITE_VERSION = SUITE_VERSION;
const SERVER_DERIVED_LEGAL_EVENT_TYPES = new Set([
  EVENT_TYPES.CONTRACT_ACCEPTANCE,
  EVENT_TYPES.COLLECTION_NOTICE_ACKNOWLEDGEMENT,
  EVENT_TYPES.PROFESSIONAL_USE_ACKNOWLEDGEMENT,
  EVENT_TYPES.AI_TRANSPARENCY_CONSENT,
  EVENT_TYPES.MARKETING_CONSENT,
]);

function legalPresentationContent(documentId) {
  const document = LEGAL_DOCUMENTS[documentId];
  if (!document) throw new Error(`Unknown mandatory legal document: ${documentId}`);
  const raw = fs.readFileSync(path.join(repoRoot, 'src', 'legal-content', document.file), 'utf8');
  return effectiveLegalContent(raw, {
    status: process.env.LEGAL_STATUS === 'effective' ? 'effective' : 'rc',
    effectiveDate: process.env.LEGAL_EFFECTIVE_DATE || null,
  });
}

const CURRENT_LEGAL_DOCUMENT_RECEIPTS = new Map(
  [...PRACTITIONER_NOTICE_IDS, ...CONTRACT_BUNDLE_IDS].map((documentId) => {
    const document = LEGAL_DOCUMENTS[documentId];
    return [documentId, {
      eventType: document.eventType,
      title: document.title,
      fingerprint: legalContentFingerprint(legalPresentationContent(documentId)),
    }];
  }),
);
const AI_NOTICE_FINGERPRINT = CURRENT_LEGAL_DOCUMENT_RECEIPTS.get('ai-notice').fingerprint;

function parseCompatibilityVersions() {
  const raw = process.env.LEGAL_COMPATIBILITY_ACCEPTED_VERSIONS;
  if (!raw) return [];
  if (process.env.DOCUMENT_EXTRACTION_ENABLED === '1') {
    throw new Error(
      'LEGAL_COMPATIBILITY_ACCEPTED_VERSIONS cannot be used while document extraction is enabled',
    );
  }
  const values = [...new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))];
  if (
    values.length !== 2 ||
    values[0] !== 'RC-2026.07.11' ||
    values[1] !== LEGAL_SUITE_VERSION
  ) {
    throw new Error(
      `LEGAL_COMPATIBILITY_ACCEPTED_VERSIONS must be exactly RC-2026.07.11,${LEGAL_SUITE_VERSION}`,
    );
  }
  return values;
}

const LEGAL_GATE_VERSIONS = new Set([
  LEGAL_SUITE_VERSION,
  ...parseCompatibilityVersions(),
]);

/**
 * True if sessionUser has recorded every mandatory practitioner-notice event
 * at the current suite version. Fails open (returns true) only if the
 * LegalAcceptanceEvent entity is not yet registered at all — a migration
 * safety valve, not a normal runtime path.
 */
function hasCurrentLegalAcceptance(userEmail) {
  const repo = repoFor('LegalAcceptanceEvent');
  if (!repo || !orgMemberRepo) return false;
  const events = repo.listAll().filter((event) => event.user_email === userEmail);
  const memberships = orgMemberRepo.listAll().filter((membership) => membership.user_email === userEmail);
  if (memberships.length === 0) return false;

  const currentBundleAccepted = memberships.some((membership) => {
    const requiredIds = membership.role === 'owner'
      ? [...PRACTITIONER_NOTICE_IDS, ...CONTRACT_BUNDLE_IDS]
      : PRACTITIONER_NOTICE_IDS;
    return requiredIds.every((documentId) => {
      const expected = CURRENT_LEGAL_DOCUMENT_RECEIPTS.get(documentId);
      return events.some(
        (event) =>
          event.org_id === membership.org_id &&
          event.suite_version === LEGAL_SUITE_VERSION &&
          event.event_type === expected.eventType &&
          event.document_id === documentId &&
          event.document_title === expected.title &&
          event.document_fingerprint === expected.fingerprint,
      );
    });
  });
  if (currentBundleAccepted) return true;

  // Compatibility images never enable document extraction. Their exact
  // two-version allowlist preserves the prior notice-only rollback contract.
  return [...LEGAL_GATE_VERSIONS]
    .filter((version) => version !== LEGAL_SUITE_VERSION)
    .some((version) => {
      const versionEvents = events.filter((event) => event.suite_version === version);
      return PRACTITIONER_NOTICE_IDS.every((documentId) => {
        const eventType = LEGAL_DOCUMENTS[documentId].eventType;
        return versionEvents.some((event) => event.event_type === eventType);
      });
    });
}

/** Current, document-bound AI acceptance for the selected organisation. */
function hasExtractionAcceptance(userEmail, orgId) {
  const repo = repoFor('LegalAcceptanceEvent');
  if (!repo || !userEmail || !orgId) return false;
  return repo.listAll().some(
    (event) =>
      event.user_email === userEmail &&
      event.org_id === orgId &&
      event.suite_version === LEGAL_SUITE_VERSION &&
      event.event_type === 'ai_transparency_consent' &&
      event.document_id === 'ai-notice' &&
      event.document_title === LEGAL_DOCUMENTS['ai-notice'].title &&
      event.document_fingerprint === AI_NOTICE_FINGERPRINT,
  );
}

function recordLegalAcceptanceBundle({ sessionUser, orgId, marketingOptIn }) {
  const acceptanceRepo = repoFor('LegalAcceptanceEvent');
  if (!acceptanceRepo || !orgMemberRepo) {
    throw new UploadError(503, 'legal_acceptance_unavailable', 'Legal acceptance is currently unavailable.');
  }
  const membership = orgMemberRepo
    .listAll()
    .find((item) => item.user_email === sessionUser.email && item.org_id === orgId);
  if (!membership) {
    throw new UploadError(403, 'org_forbidden', 'The selected organisation is unavailable.');
  }
  const ownerBundle = membership.role === 'owner';
  const documentIds = ownerBundle
    ? [...PRACTITIONER_NOTICE_IDS, ...CONTRACT_BUNDLE_IDS]
    : [...PRACTITIONER_NOTICE_IDS];
  const actorCapacity = ownerBundle ? 'practice owner' : 'invited clinician';
  const records = documentIds.map((documentId) => {
    const document = LEGAL_DOCUMENTS[documentId];
    const receipt = CURRENT_LEGAL_DOCUMENT_RECEIPTS.get(documentId);
    return {
      event_type: receipt.eventType,
      user_email: sessionUser.email,
      org_id: orgId,
      actor_capacity: actorCapacity,
      suite_version: LEGAL_SUITE_VERSION,
      document_id: documentId,
      document_title: document.title,
      document_fingerprint: receipt.fingerprint,
      session_context: null,
      user_agent: 'server-derived-bundle',
      ip_address: 'not-collected-local-shim',
    };
  });
  if (marketingOptIn) {
    records.push({
      event_type: EVENT_TYPES.MARKETING_CONSENT,
      user_email: sessionUser.email,
      org_id: orgId,
      actor_capacity: actorCapacity,
      suite_version: LEGAL_SUITE_VERSION,
      document_id: null,
      document_title: null,
      document_fingerprint: null,
      session_context: null,
      user_agent: 'server-derived-bundle',
      ip_address: 'not-collected-local-shim',
    });
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const created = records.map((record) => acceptanceRepo.create(record, sessionUser.email));
    db.exec('COMMIT');
    return { status: 'success', recorded: created.length, owner_bundle: ownerBundle };
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Preserve the original transaction failure.
    }
    throw error;
  }
}

// Tenant-scoped entities, derived statically from the schema (carry org_id).
const ORG_SCOPED_ENTITIES = loadOrgScopedEntities();

// Shared reference catalogues: readable by any authenticated user, but
// mutated by admins only. They are global (no org_id), so a non-admin write
// or a deleteMany would corrupt or wipe every tenant's catalogue at once.
const GLOBAL_READONLY_ENTITIES = new Set(['Assessment', 'Exercise', 'TreatmentProtocol']);

/**
 * Central write-authorisation for a non-admin entity mutation. Returns
 * { ok } or { ok:false, status, message }. Layers, in order:
 *  - User: never writable via the generic entity API (admin/register/invite
 *    only) — the create path was previously un-gated, an admin-mint vector;
 *  - shared catalogues: admin-only writes;
 *  - LegalAcceptance: a user may only write their own acceptance;
 *  - Organization: create (founding) allowed; update/delete gated by
 *    isWithinOrgScope at the call site;
 *  - org-scoped entities: enforceWriteOrgScope (forces org_id to a member org).
 */
function writeAuthDenied(entityName, data, sessionUser, { isCreate }) {
  if (entityName === 'User') {
    return { ok: false, status: 403, message: 'admin access required' };
  }
  if (GLOBAL_READONLY_ENTITIES.has(entityName)) {
    return { ok: false, status: 403, message: 'admin access required to modify a shared catalogue' };
  }
  if (entityName === 'LegalAcceptance') {
    if (isCreate && data && data.user_email && data.user_email !== sessionUser.email) {
      return { ok: false, status: 403, message: 'you may only record your own acceptance' };
    }
    return { ok: true };
  }
  if (entityName === 'LegalAcceptanceEvent') {
    if (!isCreate) {
      return { ok: false, status: 405, message: 'legal acceptance events are append-only' };
    }
    // Same self-only integrity rule as LegalAcceptance, plus the generic
    // org-scope enforcement below (LegalAcceptanceEvent carries org_id, so it
    // is auto-scoped by ORG_SCOPED_ENTITIES/enforceWriteOrgScope — this branch
    // only adds the user_email self-check on top).
    if (isCreate && data && data.user_email && data.user_email !== sessionUser.email) {
      return { ok: false, status: 403, message: 'you may only record your own acceptance or consent' };
    }
    if (SERVER_DERIVED_LEGAL_EVENT_TYPES.has(data?.event_type)) {
      return {
        ok: false,
        status: 403,
        message: 'mandatory and marketing legal events must use the server-derived bundle endpoint',
      };
    }
    if (data?.event_type !== EVENT_TYPES.RECORDING_CONSENT) {
      return { ok: false, status: 400, message: 'unsupported legal event type' };
    }
    data.user_email = sessionUser.email;
    data.suite_version = LEGAL_SUITE_VERSION;
    data.document_id = null;
    data.document_title = null;
    data.document_fingerprint = null;
    return enforceWriteOrgScope(entityName, data, sessionUser, { isCreate });
  }
  return enforceWriteOrgScope(entityName, data, sessionUser, { isCreate });
}

/**
 * Hard authorisation gate for the entities router. Sends the refusal and
 * returns true when the request must not proceed:
 *  - every request requires a session (an anonymous caller could previously
 *    read any non-org-scoped collection — enumerating tenants and catalogues
 *    — and create records);
 *  - a non-admin session whose account_status is not 'active' cannot touch
 *    clinical entities at all, and may write only the setup entities.
 */
function entityAccessDenied(req, res, entityName, sessionUser, isAdmin) {
  if (!sessionUser) {
    sendError(res, 401, 'authentication required');
    return true;
  }
  const isMutation = req.method !== 'GET';
  if (!isAdmin && sessionUser.account_status !== 'active') {
    if (CLINICAL_ENTITIES.has(entityName)) {
      sendError(res, 403, 'account pending approval');
      return true;
    }
    if (isMutation && !PRE_APPROVAL_WRITE_ENTITIES.has(entityName)) {
      sendError(res, 403, 'account pending approval');
      return true;
    }
  }
  // Server-side half of the L-15/L-08 fix: clinical access requires the
  // mandatory practitioner notices to be recorded at the current suite
  // version, not merely the client-side Layout.jsx gate having been shown
  // once. Also re-gates an already-approved user whose acceptance predates a
  // suite version bump (the reacceptance-trigger requirement in policy-suite
  // doc 27 clause 6) — a stale acceptance is treated the same as none.
  if (!isAdmin && CLINICAL_ENTITIES.has(entityName) && !hasCurrentLegalAcceptance(sessionUser.email)) {
    sendError(res, 403, 'current legal acceptance required');
    return true;
  }
  return false;
}

/** The caller's primary org id (is_primary membership, else first). */
function primaryOrgIdForUser(userEmail) {
  if (!orgMemberRepo || !userEmail) return null;
  const memberships = orgMemberRepo.listAll().filter((m) => m.user_email === userEmail);
  const primary = memberships.find((m) => m.is_primary) || memberships[0];
  return primary?.org_id || null;
}

/**
 * Forces the org_id of a non-admin WRITE to an organisation the caller
 * belongs to, closing the cross-tenant injection vector (a caller-supplied
 * foreign or null org_id was previously trusted). Mutates `data.org_id`.
 * Returns { ok } or { ok:false, status, message }.
 * OrganizationMember is exempt (it is how a user joins an org, so it cannot
 * require prior membership) — instead a non-admin may only enrol their own
 * email. Organization carries no org_id and passes through.
 */
function enforceWriteOrgScope(entityName, data, sessionUser, { isCreate }) {
  if (entityName === 'OrganizationMember') {
    // A non-admin may only enrol their OWN account. On CREATE, into an org
    // they already belong to or one they are founding (no existing members).
    // On UPDATE, the org_id may not be relocated to an org they are not
    // already a member of — otherwise a member could move their own
    // membership into another tenant and gain its scope (the update path
    // previously fell through unchecked).
    if (data && data.user_email && data.user_email !== sessionUser.email) {
      return { ok: false, status: 403, message: 'you may only add your own account to an organisation' };
    }
    const targetOrg = data?.org_id;
    if (targetOrg !== undefined && targetOrg !== null) {
      const callerOrgs = orgIdsForUser(sessionUser.email);
      if (!callerOrgs.includes(targetOrg)) {
        if (!isCreate) {
          return { ok: false, status: 403, message: 'you cannot move a membership to another organisation' };
        }
        const existingMembers = orgMemberRepo
          ? orgMemberRepo.listAll().filter((m) => m.org_id === targetOrg)
          : [];
        if (existingMembers.length > 0) {
          return { ok: false, status: 403, message: 'you cannot join an existing organisation' };
        }
      }
    }
    return { ok: true };
  }
  if (!ORG_SCOPED_ENTITIES.has(entityName)) return { ok: true };
  const orgIds = orgIdsForUser(sessionUser.email);
  const supplied = data?.org_id;
  if (supplied !== undefined && supplied !== null) {
    if (!orgIds.includes(supplied)) {
      return { ok: false, status: 403, message: 'org_id is outside your organisations' };
    }
    return { ok: true }; // a member org — keep it.
  }
  // No org_id supplied: on create, force to the caller's primary org (never
  // let a null-org record persist — that collapsed list scoping); on update,
  // leave the existing org_id untouched.
  if (!isCreate) return { ok: true };
  const primary = primaryOrgIdForUser(sessionUser.email);
  if (!primary) return { ok: false, status: 403, message: 'no organisation membership' };
  data.org_id = primary;
  return { ok: true };
}

async function handleEntitiesRoute(req, res, url, match) {
  const [, appId, entityName, rest] = match;

  // /me is handled specially (auth.me / auth.updateMe), not entity CRUD.
  if (entityName === 'User' && rest === 'me') {
    return handleMe(req, res);
  }

  if (rest === 'bulk') {
    return handleBulk(req, res, entityName);
  }
  if (rest === 'update-many') {
    return handleUpdateMany(req, res, entityName);
  }

  const repo = repoFor(entityName);
  if (!repo) {
    return sendError(res, 404, `entity ${entityName} not found`);
  }

  const sessionUser = resolveSessionUser(req);
  const isAdmin = sessionUser?.role === 'admin';

  // User collection: list/get/update restricted to admins.
  const isUserCollection = entityName === 'User';

  if (entityAccessDenied(req, res, entityName, sessionUser, isAdmin)) return;

  if (
    entityName === 'LegalAcceptanceEvent' &&
    req.method !== 'GET' &&
    !(req.method === 'POST' && !rest)
  ) {
    return sendError(res, 405, 'legal acceptance events are append-only');
  }

  if (req.method === 'GET' && !rest) {
    if (isUserCollection && !isAdmin) return sendError(res, 403, 'admin access required');
    if (!sessionUser && isUserCollection) return sendError(res, 401, 'authentication required');
    return handleList(req, res, repo, entityName, sessionUser, isAdmin, url);
  }

  if (req.method === 'GET' && rest) {
    const record = repo.getById(rest);
    if (!record) return sendError(res, 404, 'record not found');
    if (isUserCollection && !isAdmin) return sendError(res, 403, 'admin access required');
    if (!isAdmin && !isUserCollection && !isWithinOrgScope(record, sessionUser, entityName)) {
      return sendError(res, 404, 'record not found');
    }
    const stripped = isUserCollection ? stripAuthFields(record) : record;
    return sendJson(res, 200, stripped);
  }

  if (req.method === 'POST' && !rest) {
    const data = await readJsonBody(req);
    const createdBy = sessionUser?.email || null;
    if (!isAdmin) {
      // Central write-authorisation: refuses User/catalogue writes and scopes
      // org-bearing writes to a membership the caller holds.
      const auth = writeAuthDenied(entityName, data, sessionUser, { isCreate: true });
      if (!auth.ok) return sendError(res, auth.status, auth.message);
    }
    const bindingOrgId = entityName === 'Organization' ? null : data?.org_id;
    const pendingBindings = bindingOrgId
      ? prepareUploadBindings(entityName, data, bindingOrgId)
      : [];
    const record = repo.create(data, createdBy);
    if (pendingBindings.length > 0) {
      commitUploadBindings(pendingBindings, {
        entityName,
        entityId: record.id,
        orgId: bindingOrgId,
        actorUserId: sessionUser.id,
      });
    }
    const stripped = isUserCollection ? stripAuthFields(record) : record;
    return sendJson(res, 200, stripped);
  }

  if (req.method === 'PUT' && rest) {
    if (isUserCollection && !isAdmin) return sendError(res, 403, 'admin access required');
    const existing = repo.getById(rest);
    if (!existing) return sendError(res, 404, 'record not found');
    if (!isAdmin && !isUserCollection && !isWithinOrgScope(existing, sessionUser, entityName)) {
      return sendError(res, 404, 'record not found');
    }
    const data = await readJsonBody(req);
    if (!isAdmin) {
      const auth = writeAuthDenied(entityName, data, sessionUser, { isCreate: false });
      if (!auth.ok) return sendError(res, auth.status, auth.message);
    }
    const bindingOrgId = data?.org_id || existing?.org_id || (entityName === 'Organization' ? existing.id : null);
    const pendingBindings = bindingOrgId
      ? prepareUploadBindings(entityName, data, bindingOrgId, existing.id)
      : [];
    const record = repo.update(rest, data);
    if (pendingBindings.length > 0) {
      commitUploadBindings(pendingBindings, {
        entityName,
        entityId: record.id,
        orgId: bindingOrgId,
        actorUserId: sessionUser.id,
      });
    }
    // Welcome email on activation (admin approval path; the payment
    // auto-approve path sends its own from stripeWebhook). Fire-and-forget —
    // an email failure must not fail the update.
    if (isUserCollection && existing.account_status !== 'active' && record.account_status === 'active') {
      sendEmail({ to: record.email, ...welcomeEmail(record.clinician_name || record.full_name) }).catch(() => {});
    }
    const stripped = isUserCollection ? stripAuthFields(record) : record;
    return sendJson(res, 200, stripped);
  }

  if (req.method === 'DELETE' && rest) {
    const existing = repo.getById(rest);
    if (!existing) return sendError(res, 404, 'record not found');
    if (isUserCollection && !isAdmin) return sendError(res, 403, 'admin access required');
    if (!isAdmin && GLOBAL_READONLY_ENTITIES.has(entityName)) {
      return sendError(res, 403, 'admin access required to modify a shared catalogue');
    }
    // Retention: a Client is the root of a clinical record and its hard delete
    // orphans every child (assessments, notes, documents…). Non-admins must
    // use archive (archived:true) — the raw DELETE would otherwise bypass the
    // archive convention and destroy records that must be retained.
    // Item-level deletes (SOAPNote, ClientAssessment, ClientDocument …) remain
    // ordinary clinician workflow; only the Client root is protected here.
    if (!isAdmin && entityName === 'Client') {
      return sendError(res, 403, 'clients are archived, not deleted');
    }
    if (!isAdmin && !isUserCollection && !isWithinOrgScope(existing, sessionUser, entityName)) {
      return sendError(res, 404, 'record not found');
    }
    repo.remove(rest);
    return sendJson(res, 200, { id: rest, deleted: true });
  }

  if (req.method === 'DELETE' && !rest) {
    // DELETE-with-body deleteMany.
    if (!isAdmin && (isUserCollection || GLOBAL_READONLY_ENTITIES.has(entityName))) {
      // Never let a non-admin bulk-delete Users or a shared catalogue.
      return sendError(res, 403, 'admin access required');
    }
    if (!isAdmin && entityName === 'Client') {
      // Same retention rule as the single-record path: clients are archived.
      return sendError(res, 403, 'clients are archived, not deleted');
    }
    const query = await readJsonBody(req);
    const scopedQuery = scopeQueryToOrg(query, entityName, sessionUser, isAdmin);
    const all = repo.listAll();
    const matched = all.filter((record) => matchesQuery(record, scopedQuery));
    for (const record of matched) repo.remove(record.id);
    return sendJson(res, 200, { deleted: matched.length });
  }

  return sendError(res, 404, 'route not found');
}

/**
 * Whether a non-admin session user may see/write a specific record. Scoping is
 * keyed off the STATIC entity classification, and fails CLOSED: an org-scoped
 * record with a missing/null org_id is denied (previously such a record was
 * treated as universally visible/writable — a cross-tenant hole).
 */
function isWithinOrgScope(record, sessionUser, entityName) {
  if (!sessionUser) return false;
  const orgIds = orgIdsForUser(sessionUser.email);
  if (entityName === 'Organization') {
    return orgIds.includes(record.id);
  }
  if (entityName === 'LegalAcceptance') {
    return record.user_email === sessionUser.email;
  }
  if (ORG_SCOPED_ENTITIES.has(entityName)) {
    if (record.org_id === undefined || record.org_id === null) return false; // fail closed.
    return orgIds.includes(record.org_id);
  }
  return true; // global reference catalogues — readable by any authenticated user.
}

/** Merges an org-scoping constraint into a query object for non-admin requesters. */
function scopeQueryToOrg(query, entityName, sessionUser, isAdmin) {
  if (isAdmin) return query || {};
  const orgIds = orgIdsForUser(sessionUser?.email);
  // Organization carries no org_id; its own id IS the org id, so scope the
  // list to the caller's memberships by id (else all org names/subscription
  // states enumerate cross-tenant).
  if (entityName === 'Organization') {
    return { ...(query || {}), id: { $in: orgIds } };
  }
  if (entityName === 'LegalAcceptance') {
    return { ...(query || {}), user_email: sessionUser?.email };
  }
  if (!ORG_SCOPED_ENTITIES.has(entityName)) return query || {};
  return { ...(query || {}), org_id: { $in: orgIds } };
}

function handleList(req, res, repo, entityName, sessionUser, isAdmin, url) {
  const params = url.searchParams;
  const q = params.get('q');
  let query = {};
  if (q) {
    try {
      query = JSON.parse(q);
    } catch {
      return sendError(res, 400, 'invalid q parameter');
    }
  }
  query = scopeQueryToOrg(query, entityName, sessionUser, isAdmin);

  let records = repo.listAll().filter((record) => matchesQuery(record, query));
  // Archived clients (retention model: user-facing "delete" archives, never
  // destroys) are excluded from EVERY list/filter unless the caller asks for
  // them explicitly with an `archived` key in the query — one enforcement
  // point covering all ~20 client-picker surfaces, so components cannot
  // disagree about what archived means. Get-by-id still returns an archived
  // record (restore/inspection path).
  if (entityName === 'Client' && !Object.prototype.hasOwnProperty.call(query || {}, 'archived')) {
    records = records.filter((record) => record.archived !== true);
  }
  records = applySortSkipLimit(records, {
    sort: params.get('sort'),
    limit: params.get('limit'),
    skip: params.get('skip'),
  });
  const fields = params.get('fields');
  if (fields) {
    records = records.map((record) => applyProjection(record, fields));
  }
  if (entityName === 'User') {
    records = records.map(stripAuthFields);
  }
  return sendJson(res, 200, records);
}

async function handleBulk(req, res, entityName) {
  const repo = repoFor(entityName);
  if (!repo) return sendError(res, 404, `entity ${entityName} not found`);
  const sessionUser = resolveSessionUser(req);
  const isAdmin = sessionUser?.role === 'admin';
  if (entityName === 'User' && !isAdmin) return sendError(res, 403, 'admin access required');
  if (entityAccessDenied(req, res, entityName, sessionUser, isAdmin)) return;
  if (entityName === 'LegalAcceptanceEvent' && req.method !== 'POST') {
    return sendError(res, 405, 'legal acceptance events are append-only');
  }

  const body = await readJsonBody(req);

  if (req.method === 'POST') {
    // bulkCreate: JSON array of records.
    const items = Array.isArray(body) ? body : body.items || [];
    const createdBy = sessionUser?.email || null;
    if (!isAdmin) {
      // Same central write-authorisation as single create, per item.
      for (const item of items) {
        const auth = writeAuthDenied(entityName, item, sessionUser, { isCreate: true });
        if (!auth.ok) return sendError(res, auth.status, auth.message);
      }
    }
    const planned = items.map((item) => ({
      item,
      orgId: entityName === 'Organization' ? null : item?.org_id,
      uploads: entityName === 'Organization' || !item?.org_id
        ? []
        : prepareUploadBindings(entityName, item, item.org_id),
    }));
    const created = planned.map(({ item }) => repo.create(item, createdBy));
    created.forEach((record, index) => {
      const plan = planned[index];
      if (plan.uploads.length > 0) {
        commitUploadBindings(plan.uploads, {
          entityName,
          entityId: record.id,
          orgId: plan.orgId,
          actorUserId: sessionUser.id,
        });
      }
    });
    const result = entityName === 'User' ? created.map(stripAuthFields) : created;
    return sendJson(res, 200, result);
  }

  if (req.method === 'PUT') {
    // bulkUpdate: JSON array of records, each carrying its own id.
    const items = Array.isArray(body) ? body : body.items || [];
    if (!isAdmin) {
      // Mirror the single-PUT guards: refuse User/catalogue writes, only
      // update records within the caller's org, and never relocate one into
      // another tenant. Without this, bulkUpdate was a cross-tenant
      // edit/relocate-by-id hole.
      for (const item of items) {
        if (!item.id) continue;
        const existing = repo.getById(item.id);
        if (!existing) continue;
        if (!isWithinOrgScope(existing, sessionUser, entityName)) {
          return sendError(res, 404, 'record not found');
        }
        const auth = writeAuthDenied(entityName, item, sessionUser, { isCreate: false });
        if (!auth.ok) return sendError(res, auth.status, auth.message);
      }
    }
    const planned = items.filter((item) => item.id).map((item) => {
      const existing = repo.getById(item.id);
      const orgId = item?.org_id || existing?.org_id || (entityName === 'Organization' ? existing?.id : null);
      return {
        item,
        orgId,
        uploads: orgId ? prepareUploadBindings(entityName, item, orgId, item.id) : [],
      };
    });
    const updated = planned.map(({ item }) => repo.update(item.id, item)).filter(Boolean);
    updated.forEach((record, index) => {
      const plan = planned[index];
      if (plan.uploads.length > 0) {
        commitUploadBindings(plan.uploads, {
          entityName,
          entityId: record.id,
          orgId: plan.orgId,
          actorUserId: sessionUser.id,
        });
      }
    });
    const result = entityName === 'User' ? updated.map(stripAuthFields) : updated;
    return sendJson(res, 200, result);
  }

  return sendError(res, 405, 'method not allowed');
}

async function handleUpdateMany(req, res, entityName) {
  if (req.method !== 'PATCH') return sendError(res, 405, 'method not allowed');
  if (entityName === 'LegalAcceptanceEvent') {
    return sendError(res, 405, 'legal acceptance events are append-only');
  }
  const repo = repoFor(entityName);
  if (!repo) return sendError(res, 404, `entity ${entityName} not found`);
  const sessionUser = resolveSessionUser(req);
  const isAdmin = sessionUser?.role === 'admin';
  if (entityName === 'User' && !isAdmin) return sendError(res, 403, 'admin access required');
  if (entityAccessDenied(req, res, entityName, sessionUser, isAdmin)) return;

  const body = await readJsonBody(req);
  const { query, data } = body || {};
  if (extractUploadIdsFromValue(data).length > 0) {
    return sendError(res, 400, 'file references must be bound to one explicit record');
  }
  if (!isAdmin) {
    // Refuse User/catalogue writes; the query is org-scoped, but the data
    // payload could still relocate the matched (own-org) records into another
    // tenant via a mutated org_id.
    const auth = writeAuthDenied(entityName, data, sessionUser, { isCreate: false });
    if (!auth.ok) return sendError(res, auth.status, auth.message);
  }
  const scopedQuery = scopeQueryToOrg(query, entityName, sessionUser, isAdmin);
  const matched = repo.listAll().filter((record) => matchesQuery(record, scopedQuery));
  const updated = matched.map((record) => repo.update(record.id, data));
  const result = entityName === 'User' ? updated.map(stripAuthFields) : updated;
  return sendJson(res, 200, { updated: result.length, records: result });
}

// ---------------------------------------------------------------------------
// auth.me / auth.updateMe
// ---------------------------------------------------------------------------

async function handleMe(req, res) {
  const sessionUser = resolveSessionUser(req);
  if (!sessionUser) return sendError(res, 401, 'authentication required');

  if (req.method === 'GET') {
    return sendJson(res, 200, stripAuthFields(sessionUser));
  }

  if (req.method === 'PUT') {
    const payload = await readJsonBody(req);
    const sanitized = sanitizeUpdateMePayload(payload);
    const orgId = primaryOrgIdForUser(sessionUser.email);
    const pendingBindings = orgId
      ? prepareUploadBindings('User', sanitized, orgId, sessionUser.id)
      : [];
    const updated = userRepo.update(sessionUser.id, sanitized);
    if (pendingBindings.length > 0) {
      commitUploadBindings(pendingBindings, {
        entityName: 'User',
        entityId: sessionUser.id,
        orgId,
        actorUserId: sessionUser.id,
      });
    }
    return sendJson(res, 200, stripAuthFields(updated));
  }

  return sendError(res, 405, 'method not allowed');
}

// ---------------------------------------------------------------------------
// Auth endpoints (/api/apps/{appId}/auth/*, /users/invite-user, etc.)
// ---------------------------------------------------------------------------

function findUserByEmail(email) {
  const target = normaliseEmail(email);
  return userRepo.listAll().find((u) => normaliseEmail(u.email) === target) || null;
}

async function handleAuthRoute(req, res, url, appId, action) {
  if (action === 'login' && req.method === 'POST') {
    const { email, password } = await readJsonBody(req);
    const user = findUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
      return sendError(res, 401, 'invalid email or password');
    }
    // A registered-but-unverified account has a valid password hash from the
    // moment of registration, so without this check login mints a full
    // session for an account that never completed OTP verification — the
    // verification step becomes cosmetic. email_verified is set true only by
    // verify-otp, a successful reset-password, or trusted server-side
    // provisioning (bootstrap admin) — never by registration itself.
    if (!user.email_verified) {
      return sendError(res, 403, 'please verify your email before signing in — request a new code from the registration page');
    }
    const token = sessions.create(user.id);
    return sendJson(res, 200, { access_token: token, user: stripAuthFields(user) });
  }

  if (action === 'register' && req.method === 'POST') {
    if (!ALLOW_OPEN_REGISTRATION) {
      return sendError(res, 403, 'self-registration is disabled for this deployment');
    }
    const payload = await readJsonBody(req);
    const { password } = payload;
    const email = normaliseEmail(payload.email);
    if (!email || !password) {
      return sendError(res, 400, 'email and password are required');
    }
    const existing = findUserByEmail(email);
    // A verified account owns this email outright — standard account-taken
    // 409. An existing but never-verified account (e.g. the user never
    // received the original code) is instead treated as a fresh verification
    // attempt on the same record, so the frontend's existing otpSent flow
    // resumes it rather than dead-ending in a 409 the user cannot act on.
    if (existing && existing.email_verified) {
      return sendError(res, 409, 'an account with this email already exists — please sign in instead, or use "Forgot password" to recover access');
    }
    if (existing && existing.otp_last_sent_at && Date.now() - Date.parse(existing.otp_last_sent_at) < RESEND_MIN_INTERVAL_MS) {
      return sendJson(res, 200, { message: 'registered', user_id: existing.id, otp_required: true });
    }
    const { password_hash, salt } = hashPassword(password);
    const { password: _pw, email: _em, ...customFields } = payload;
    const otpCode = generateOtp();
    const otpFields = {
      otp_code: otpCode,
      otp_expires: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      otp_attempts: 0,
      otp_locked_until: null,
      otp_last_sent_at: new Date().toISOString(),
    };
    const user = existing
      ? userRepo.update(existing.id, { ...customFields, password_hash, salt, ...otpFields })
      : userRepo.create(
          { ...customFields, email, role: 'user', account_status: 'pending', password_hash, salt, ...otpFields },
          email,
        );
    // The initial verification code is sent HERE — previously only resend-otp
    // ever wrote an email, so a real user could never complete signup once the
    // fixed-code bypass was removed. Admin is notified only of genuinely new
    // registrations, not repeat attempts on an existing unverified account.
    await sendEmail({ to: email, ...otpEmail(otpCode) });
    if (!existing) {
      const notify = adminNotifyEmail(email);
      await sendEmail(notify);
    }
    return sendJson(res, 200, { message: 'registered', user_id: user.id, otp_required: true });
  }

  if (action === 'verify-otp' && req.method === 'POST') {
    if (!ALLOW_OPEN_REGISTRATION) {
      return sendError(res, 403, 'account verification is disabled for this deployment');
    }
    const { email, otp_code } = await readJsonBody(req);
    const user = findUserByEmail(email);
    // Unknown email returns the SAME generic 401 as a known-email-wrong-code,
    // so this endpoint is not an account-existence oracle (consistent with the
    // resend/reset hardening). Registration's 409 remains the standard
    // account-taken UX and is a deliberate, separate tradeoff.
    if (!user) return sendError(res, 401, 'invalid or expired verification code');
    // Lockout window after repeated failures.
    if (user.otp_locked_until && Date.parse(user.otp_locked_until) > Date.now()) {
      return sendError(res, 429, 'too many attempts — try again later');
    }
    // The fixed test code is honoured ONLY under SELFTEST (the isolated test
    // server). In every real deployment the stored, expiring, per-user code is
    // the sole accepted value — the previous unconditional 000000 acceptance
    // was a session-mint primitive for any known email.
    const selftestBypass = process.env.SELFTEST === '1' && String(otp_code) === '000000';
    const storedValid =
      user.otp_code &&
      String(otp_code) === String(user.otp_code) &&
      user.otp_expires &&
      Date.parse(user.otp_expires) > Date.now();
    if (!selftestBypass && !storedValid) {
      const attempts = (Number(user.otp_attempts) || 0) + 1;
      const lockFields =
        attempts >= OTP_MAX_ATTEMPTS
          ? { otp_locked_until: new Date(Date.now() + OTP_LOCKOUT_MS).toISOString(), otp_attempts: 0 }
          : { otp_attempts: attempts };
      userRepo.update(user.id, lockFields);
      return sendError(res, 401, 'invalid or expired verification code');
    }
    // Email verification must not activate the account. Activation is granted
    // by successful subscription payment (stripeWebhook) or by an admin.
    const nextStatus = user.account_status === 'active' ? 'active' : 'pending';
    const updated = userRepo.update(user.id, {
      account_status: nextStatus,
      email_verified: true,
      otp_code: null,
      otp_expires: null,
      otp_attempts: 0,
      otp_locked_until: null,
    });
    const token = sessions.create(user.id);
    return sendJson(res, 200, { access_token: token, user: stripAuthFields(updated) });
  }

  if (action === 'resend-otp' && req.method === 'POST') {
    if (!ALLOW_OPEN_REGISTRATION) {
      return sendError(res, 403, 'account verification is disabled for this deployment');
    }
    const { email } = await readJsonBody(req);
    const user = findUserByEmail(email);
    if (user) {
      // Per-account send throttle: one code per RESEND_MIN_INTERVAL_MS.
      if (user.otp_last_sent_at && Date.now() - Date.parse(user.otp_last_sent_at) < RESEND_MIN_INTERVAL_MS) {
        return sendJson(res, 200, { status: 'sent' }); // do not reveal throttling to enumeration
      }
      const otpCode = generateOtp();
      userRepo.update(user.id, {
        otp_code: otpCode,
        otp_expires: new Date(Date.now() + OTP_TTL_MS).toISOString(),
        otp_attempts: 0,
        otp_last_sent_at: new Date().toISOString(),
      });
      await sendEmail({ to: email, ...otpEmail(otpCode) });
    }
    return sendJson(res, 200, { status: 'sent' });
  }

  if (action === 'reset-password-request' && req.method === 'POST') {
    const { email } = await readJsonBody(req);
    const user = findUserByEmail(email);
    if (user) {
      if (user.reset_last_request_at && Date.now() - Date.parse(user.reset_last_request_at) < RESEND_MIN_INTERVAL_MS) {
        return sendJson(res, 200, { status: 'sent' });
      }
      const resetToken = randomUUID();
      userRepo.update(user.id, {
        reset_token: resetToken,
        reset_token_expires: new Date(Date.now() + RESET_TTL_MS).toISOString(),
        reset_last_request_at: new Date().toISOString(),
      });
      // Single-origin production serves the SPA from APP_URL; local default
      // matches the shim origin (dist/ is served when built).
      const origin = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
      await sendEmail({ to: email, ...resetEmail(`${origin}/reset-password?token=${resetToken}`) });
    }
    return sendJson(res, 200, { status: 'sent' });
  }

  if (action === 'reset-password' && req.method === 'POST') {
    const { reset_token, new_password } = await readJsonBody(req);
    if (!reset_token) return sendError(res, 400, 'invalid or expired reset token');
    if (typeof new_password !== 'string' || new_password.length < 8) {
      return sendError(res, 400, 'a new password of at least 8 characters is required');
    }
    const user = userRepo.listAll().find((u) => u.reset_token === reset_token);
    if (!user || !user.reset_token_expires || Date.parse(user.reset_token_expires) < Date.now()) {
      return sendError(res, 400, 'invalid or expired reset token');
    }
    const { password_hash, salt } = hashPassword(new_password);
    // Completing a reset via a token that was emailed to the address is
    // proof of ownership equivalent to OTP verification — required so an
    // admin-invited user (created with no password, account_status:'invited')
    // can reach an email_verified state and actually log in afterward, given
    // login now refuses unverified accounts.
    userRepo.update(user.id, { password_hash, salt, email_verified: true, reset_token: null, reset_token_expires: null });
    return sendJson(res, 200, { status: 'reset' });
  }

  if (action === 'change-password' && req.method === 'POST') {
    const { user_id, current_password, new_password } = await readJsonBody(req);
    if (typeof new_password !== 'string' || new_password.length < 8) {
      return sendError(res, 400, 'a new password of at least 8 characters is required');
    }
    const user = userRepo.getById(user_id);
    if (!user || !verifyPassword(current_password, user.password_hash, user.salt)) {
      return sendError(res, 401, 'current password is incorrect');
    }
    const { password_hash, salt } = hashPassword(new_password);
    userRepo.update(user.id, { password_hash, salt });
    return sendJson(res, 200, { status: 'changed' });
  }

  return sendError(res, 404, 'auth route not found');
}

async function handleInviteUser(req, res) {
  if (req.method !== 'POST') return sendError(res, 405, 'method not allowed');
  // Inviting a user and assigning its role is an administrator action. The
  // endpoint previously performed no authorisation check, so an anonymous
  // caller could mint an admin account or escalate any existing user to
  // admin by email — an account-takeover primitive that bypassed every
  // org-scoping and approval control (admin authority is keyed on role).
  const sessionUser = resolveSessionUser(req);
  if (!sessionUser) return sendError(res, 401, 'authentication required');
  if (sessionUser.role !== 'admin') return sendError(res, 403, 'admin access required');
  const { user_email: rawEmail, role } = await readJsonBody(req);
  const user_email = normaliseEmail(rawEmail);
  if (!user_email || !['user', 'admin'].includes(role)) {
    return sendError(res, 400, 'user_email and a valid role are required');
  }
  let user = findUserByEmail(user_email);
  if (!user) {
    user = userRepo.create(
      { email: user_email, role, account_status: 'invited' },
      user_email,
    );
  } else {
    user = userRepo.update(user.id, { role });
  }
  await sendEmail({ to: user_email, ...inviteEmail(role) });
  return sendJson(res, 200, { status: 'invited', user: stripAuthFields(user) });
}

function handleLogout(req, res, url) {
  const token = parseBearerToken(req);
  if (token) sessions.remove(token);
  const fromUrl = url.searchParams.get('from_url') || '/';
  res.writeHead(302, { Location: fromUrl });
  res.end();
}

// ---------------------------------------------------------------------------
// Public settings + telemetry stubs
// ---------------------------------------------------------------------------

function handlePublicSettings(req, res, appId) {
  // The single runtime config channel the frontend already reads
  // (src/lib/AuthContext.jsx -> appPublicSettings via useAuth()).
  // - transcription_enabled: launch posture is OFF for users (Max's
  //   direction, 13 July 2026); flip with TRANSCRIPTION_ENABLED=1. Recording
  //   remains available; only Transcribe/Dissect are gated.
  // - legal: the policy-suite display status. RC until Maxwell's go-live
  //   flip (LEGAL_STATUS=effective + LEGAL_EFFECTIVE_DATE). INVARIANT: the
  //   flip changes DISPLAY ONLY — SUITE_VERSION / LEGAL_SUITE_VERSION stay
  //   RC-2026.07.19 (the immutable content identifier recorded in
  //   LegalAcceptanceEvent rows); bumping them would stale every acceptance
  //   and lock out all active users.
  return sendJson(res, 200, {
    id: appId,
    public_settings: {
      transcription_enabled: process.env.TRANSCRIPTION_ENABLED === '1',
      legal: {
        status: process.env.LEGAL_STATUS === 'effective' ? 'effective' : 'rc',
        effective_date: process.env.LEGAL_EFFECTIVE_DATE || null,
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Tenant-bound upload access and static SPA serving
// ---------------------------------------------------------------------------

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  stream.pipe(res);
  stream.on('error', () => {
    if (!res.headersSent) sendError(res, 500, 'failed to read file');
    else res.end();
  });
}

const UPLOAD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_STORED_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const BINDABLE_UPLOAD_ENTITIES = new Set([...CLINICAL_ENTITIES, 'Organization', 'User']);
const CLINICAL_UPLOAD_PURPOSES = new Set([
  'referral-extraction',
  'clinical-attachment',
  'report-attachment',
  'audio-transcription',
]);

function decodeUploadRouteSegment(raw) {
  if (
    !raw ||
    raw.includes('/') ||
    raw.includes('\\') ||
    /%(?:2f|5c|25)/i.test(raw)
  ) return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (!LEGACY_STORED_NAME_RE.test(decoded) || decoded === '.' || decoded === '..') return null;
    return decoded;
  } catch {
    return null;
  }
}

function valueContainsLegacyReference(value, expected, depth = 0) {
  if (depth > 10 || value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const position = value.indexOf(expected);
    if (position < 0) return false;
    const next = value[position + expected.length];
    return next === undefined || next === '?' || next === '#' || next === '"' || next === "'";
  }
  if (Array.isArray(value)) return value.slice(0, 500).some((item) => valueContainsLegacyReference(item, expected, depth + 1));
  if (typeof value === 'object') {
    return Object.values(value).slice(0, 500).some((item) => valueContainsLegacyReference(item, expected, depth + 1));
  }
  return false;
}

function legacyPurpose(entityName, record) {
  if (entityName === 'User' || entityName === 'Organization') return 'profile-image';
  if (entityName === 'SOAPNote' && valueContainsLegacyReference(record?.audio_url, '/uploads/')) {
    return 'audio-transcription';
  }
  return 'clinical-attachment';
}

/**
 * Lazily isolates an old bare filename behind the new registry. Ownership is
 * proven only by an exact durable entity reference visible to the requester;
 * filenames are never treated as tenant identifiers.
 */
function resolveLegacyUploadForUser({ storedName, selectedOrgId = null, sessionUser }) {
  if (!sessionUser || !LEGACY_STORED_NAME_RE.test(storedName) || UPLOAD_ID_RE.test(storedName)) return null;
  const existing = uploadRegistry.getByStoredName(storedName);
  const memberOrgIds = orgIdsForUser(sessionUser.email);
  if (existing) {
    return memberOrgIds.includes(existing.orgId) && (!selectedOrgId || existing.orgId === selectedOrgId)
      ? existing
      : null;
  }
  const orgIds = selectedOrgId
    ? memberOrgIds.includes(selectedOrgId) ? [selectedOrgId] : []
    : memberOrgIds;
  if (orgIds.length === 0) return null;
  const expected = `/uploads/${storedName}`;
  let examined = 0;
  const maxRecords = 20_000;
  for (const entityName of entityNames) {
    if (examined >= maxRecords) break;
    if (!ORG_SCOPED_ENTITIES.has(entityName) && entityName !== 'Organization') continue;
    const repo = repoFor(entityName);
    if (!repo) continue;
    for (const record of repo.listAll()) {
      if (++examined > maxRecords) break;
      const orgId = entityName === 'Organization' ? record.id : record.org_id;
      if (!orgIds.includes(orgId) || !valueContainsLegacyReference(record, expected)) continue;
      try {
        return uploadRegistry.registerLegacy({
          storedName,
          originalName: storedName,
          orgId,
          uploaderUserId: sessionUser.id,
          purpose: legacyPurpose(entityName, record),
          boundEntityType: entityName,
          boundEntityId: record.id,
        });
      } catch {
        return null;
      }
    }
  }
  const ownRecord = userRepo.getById(sessionUser.id);
  if (ownRecord && valueContainsLegacyReference(ownRecord, expected)) {
    const orgId = selectedOrgId || primaryOrgIdForUser(sessionUser.email);
    if (orgId && orgIds.includes(orgId)) {
      try {
        return uploadRegistry.registerLegacy({
          storedName,
          originalName: storedName,
          orgId,
          uploaderUserId: sessionUser.id,
          purpose: 'profile-image',
          boundEntityType: 'User',
          boundEntityId: sessionUser.id,
        });
      } catch {
        return null;
      }
    }
  }
  return null;
}

function canUserAccessUpload(upload, sessionUser) {
  if (!upload || !sessionUser || !orgIdsForUser(sessionUser.email).includes(upload.orgId)) return false;
  if (upload.state !== 'bound' && !upload.isLegacy && upload.uploaderUserId !== sessionUser.id) return false;
  if (
    CLINICAL_UPLOAD_PURPOSES.has(upload.purpose) &&
    (sessionUser.account_status !== 'active' || !hasCurrentLegalAcceptance(sessionUser.email))
  ) return false;
  return true;
}

function uploadForMember(reference, sessionUser) {
  const upload = UPLOAD_ID_RE.test(reference)
    ? uploadRegistry.getById(reference.toLowerCase())
    : resolveLegacyUploadForUser({ storedName: reference, sessionUser });
  if (!upload || ['expired', 'deleted'].includes(upload.state)) return null;
  return canUserAccessUpload(upload, sessionUser) ? upload : null;
}

function resolveAudioUploadForFunction({ audioUrl, user, orgId }) {
  if (
    typeof audioUrl !== 'string' ||
    !audioUrl.startsWith('/uploads/') ||
    !user?.id ||
    typeof orgId !== 'string'
  ) return null;
  const currentUser = userRepo.getById(user.id);
  if (!currentUser || currentUser.email !== user.email || !orgIdsForUser(currentUser.email).includes(orgId)) {
    return null;
  }
  let pathname;
  try {
    pathname = new URL(audioUrl, 'http://local.invalid').pathname;
  } catch {
    return null;
  }
  const match = /^\/uploads\/([^/]*)$/.exec(pathname);
  const reference = match ? decodeUploadRouteSegment(match[1]) : null;
  if (!reference) return null;
  const upload = UPLOAD_ID_RE.test(reference)
    ? uploadRegistry.getById(reference.toLowerCase())
    : resolveLegacyUploadForUser({ storedName: reference, selectedOrgId: orgId, sessionUser: currentUser });
  if (
    !upload ||
    upload.orgId !== orgId ||
    upload.purpose !== 'audio-transcription' ||
    !String(upload.detectedMime || '').startsWith('audio/') ||
    ['expired', 'deleted'].includes(upload.state)
  ) return null;
  try {
    const filePath = canonicalUploadPath(uploadsDir, upload.storedName, { mustExist: true });
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== Number(upload.byteSize)) return null;
    return filePath;
  } catch {
    return null;
  }
}

function readUploadBuffer(filePath, expectedBytes) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== Number(expectedBytes)) {
    throw new UploadError(409, 'upload_integrity_failed', 'The uploaded file failed integrity validation.');
  }
  if (stat.size > UPLOAD_POLICY.maxRequestBytes) {
    throw new UploadError(413, 'upload_too_large', 'The uploaded file is too large.');
  }
  return fs.readFileSync(filePath);
}

function prepareUploadBindings(entityName, data, orgId, entityId = null) {
  if (!BINDABLE_UPLOAD_ENTITIES.has(entityName)) return [];
  const visitReferences = (value, depth = 0) => {
    if (depth > 12 || value === null || value === undefined) return;
    if (typeof value === 'string') {
      if (/\/api\/files\/[0-9a-f-]+/i.test(value)) {
        throw new UploadError(400, 'signed_url_not_durable', 'Temporary access URLs cannot be retained.');
      }
      const embedded = value.match(/\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
      if (embedded && value !== embedded[0]) {
        throw new UploadError(400, 'noncanonical_upload_reference', 'Retain only the canonical upload reference.');
      }
      const match = /^\/uploads\/([0-9a-f-]+)(.*)$/i.exec(value);
      if (match && (match[2] !== '' || !UPLOAD_ID_RE.test(match[1]))) {
        throw new UploadError(400, 'noncanonical_upload_reference', 'Retain only the canonical upload reference.');
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 1000)) visitReferences(item, depth + 1);
      return;
    }
    if (typeof value === 'object') {
      for (const item of Object.values(value).slice(0, 1000)) visitReferences(item, depth + 1);
    }
  };
  visitReferences(data);
  const ids = extractUploadIdsFromValue(data);
  if (ids.length > 20) throw new UploadError(400, 'too_many_upload_references', 'Too many file references were supplied.');
  return ids.map((id) => {
    const upload = uploadRegistry.getById(id);
    if (!upload || upload.orgId !== orgId || ['expired', 'deleted'].includes(upload.state)) {
      throw new UploadError(404, 'upload_not_found', 'File not found.');
    }
    if (
      upload.state === 'bound' &&
      (upload.boundEntityType !== entityName || (entityId && upload.boundEntityId !== entityId))
    ) {
      throw new UploadError(409, 'upload_already_bound', 'The file is already retained with another record.');
    }
    const purposeAllowed =
      ((entityName === 'User' || entityName === 'Organization') && upload.purpose === 'profile-image') ||
      (entityName === 'SOAPNote' && ['audio-transcription', 'clinical-attachment'].includes(upload.purpose)) ||
      (CLINICAL_ENTITIES.has(entityName) &&
        entityName !== 'SOAPNote' &&
        ['referral-extraction', 'clinical-attachment', 'report-attachment'].includes(upload.purpose));
    if (!purposeAllowed) {
      throw new UploadError(409, 'upload_purpose_mismatch', 'The file cannot be retained with that record.');
    }
    return upload;
  });
}

function commitUploadBindings(uploads, { entityName, entityId, orgId, actorUserId }) {
  for (const upload of uploads) {
    uploadRegistry.bind(upload.id, {
      orgId,
      actorUserId,
      entityType: entityName,
      entityId,
    });
  }
}

function uploadResponseHeaders(upload) {
  const mime = upload.detectedMime || 'application/octet-stream';
  const disposition = /^(?:image|audio|video)\//.test(mime) || mime === 'application/pdf' ? 'inline' : 'attachment';
  const safeName = String(upload.originalName || 'download').replace(/[\r\n"\\]/g, '_').slice(0, 180);
  return {
    'Content-Type': mime,
    'Content-Disposition': `${disposition}; filename="${safeName}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Accept-Ranges': 'bytes',
  };
}

function serveRegisteredUpload(req, res, url, { upload, signed = false, actorUserId }) {
  let filePath;
  let stat;
  try {
    filePath = canonicalUploadPath(uploadsDir, upload.storedName, { mustExist: true });
    stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== Number(upload.byteSize)) {
      return sendError(res, 404, 'not found');
    }
  } catch {
    return sendError(res, 404, 'not found');
  }
  const headers = uploadResponseHeaders(upload);
  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` });
      return res.end();
    }
    let start = match[1] ? Number(match[1]) : null;
    let end = match[2] ? Number(match[2]) : null;
    if (start === null) {
      const suffix = end;
      if (!Number.isInteger(suffix) || suffix <= 0) {
        res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` });
        return res.end();
      }
      start = Math.max(0, stat.size - suffix);
      end = stat.size - 1;
    } else {
      if (end === null) end = stat.size - 1;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= stat.size) {
        res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` });
        return res.end();
      }
      end = Math.min(end, stat.size - 1);
    }
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Content-Length': end - start + 1,
    });
    uploadRegistry.audit({
      uploadId: upload.id,
      orgId: upload.orgId,
      actorUserId,
      eventType: 'upload_accessed',
      outcome: 'success',
      metadata: { signed_url: signed, range_request: true, range_start: start, range_end: end },
    });
    const stream = fs.createReadStream(filePath, { start, end });
    stream.on('error', () => res.destroy());
    stream.pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
  uploadRegistry.audit({
    uploadId: upload.id,
    orgId: upload.orgId,
    actorUserId,
    eventType: 'upload_accessed',
    outcome: 'success',
    metadata: { signed_url: signed },
  });
}

function handleUploadAccess(req, res, url, rawReference, { signedRoute }) {
  const reference = decodeUploadRouteSegment(rawReference);
  if (!reference || (signedRoute && !UPLOAD_ID_RE.test(reference))) return sendError(res, 404, 'not found');
  let upload;
  let signed = false;
  let actorUserId = null;
  if (signedRoute && url.searchParams.has('access_token')) {
    const grant = verifyFileAccessToken(url.searchParams.get('access_token'), { uploadId: reference.toLowerCase() });
    const grantUser = grant ? userRepo.getById(grant.userId) : null;
    if (!grant || !grantUser || grant.orgId !== uploadRegistry.getById(reference.toLowerCase())?.orgId) {
      return sendError(res, 404, 'not found');
    }
    upload = uploadRegistry.getById(reference.toLowerCase());
    if (!canUserAccessUpload(upload, grantUser) || upload.orgId !== grant.orgId) {
      return sendError(res, 404, 'not found');
    }
    signed = true;
    actorUserId = grantUser.id;
  } else {
    const sessionUser = resolveSessionUser(req);
    if (!sessionUser) return sendError(res, 401, 'authentication required');
    upload = uploadForMember(reference, sessionUser);
    actorUserId = sessionUser.id;
  }
  if (!upload || ['expired', 'deleted'].includes(upload.state)) return sendError(res, 404, 'not found');
  return serveRegisteredUpload(req, res, url, { upload, signed, actorUserId });
}

function serveDistOrFallback(req, res, pathname) {
  if (!fs.existsSync(distDir)) {
    return sendError(res, 404, 'not found');
  }
  const candidate = path.join(distDir, decodeURIComponent(pathname));
  if (candidate.startsWith(distDir) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return serveFile(res, candidate);
  }
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    return serveFile(res, indexPath);
  }
  return sendError(res, 404, 'not found');
}

// ---------------------------------------------------------------------------
// Main request handler
// ---------------------------------------------------------------------------

async function requestListener(req, res) {
  try {
    const url = parseUrl(req);
    const pathname = url.pathname;

    // Telemetry stubs — always 204, never error.
    if (/^\/api\/apps\/[^/]+\/analytics\/track\/batch$/.test(pathname) && req.method === 'POST') {
      await readBody(req); // drain body (may arrive via sendBeacon)
      return sendNoContent(res);
    }
    const appLogsMatch = /^\/api\/app-logs\/([^/]+)\/log-user-in-app\/([^/]+)$/.exec(pathname);
    if (appLogsMatch && req.method === 'POST') {
      await readBody(req);
      return sendNoContent(res);
    }

    // Public settings.
    const publicSettingsMatch = /^\/api\/apps\/public\/prod\/public-settings\/by-id\/([^/]+)$/.exec(
      pathname,
    );
    if (publicSettingsMatch && req.method === 'GET') {
      return handlePublicSettings(req, res, publicSettingsMatch[1]);
    }

    if (pathname === '/api/version' && req.method === 'GET') {
      const clean = (value, fallback) =>
        typeof value === 'string' && /^[A-Za-z0-9._:+-]{1,120}$/.test(value) ? value : fallback;
      return sendJson(res, 200, {
        release_sha: clean(process.env.RELEASE_SHA, 'unknown'),
        build_timestamp: clean(process.env.BUILD_TIMESTAMP || process.env.RELEASE_BUILD_TIMESTAMP, 'unknown'),
      });
    }

    // Durable upload URLs are never anonymous. Native browser media may use a
    // short-lived opaque access token issued by CreateFileAccessUrl.
    const uploadAccessMatch = /^\/uploads\/([^/]*)$/.exec(pathname);
    if (uploadAccessMatch) {
      if (req.method !== 'GET') return sendError(res, 405, 'method not allowed');
      return handleUploadAccess(req, res, url, uploadAccessMatch[1], { signedRoute: false });
    }
    const signedFileMatch = /^\/api\/files\/([^/]*)$/.exec(pathname);
    if (signedFileMatch) {
      if (req.method !== 'GET') return sendError(res, 405, 'method not allowed');
      return handleUploadAccess(req, res, url, signedFileMatch[1], { signedRoute: true });
    }
    if (pathname.startsWith('/uploads/') || pathname.startsWith('/api/files/')) {
      return sendError(res, 404, 'not found');
    }

    // Auth routes.
    const authMatch = /^\/api\/apps\/([^/]+)\/auth\/([^/]+)$/.exec(pathname);
    if (authMatch) {
      // MUST await (like the entities route below): handleAuthRoute is async,
      // and an unawaited rejection escapes this listener's try/catch — no HTTP
      // response is written (client hangs) and Node crashes on the unhandled
      // rejection. A reset/change-password with a missing new_password is one
      // reachable trigger; see the presence guards in those handlers.
      return await handleAuthRoute(req, res, url, authMatch[1], authMatch[2]);
    }
    const logoutMatch = /^\/api\/apps\/auth\/logout$/.exec(pathname);
    if (logoutMatch && req.method === 'GET') {
      return handleLogout(req, res, url);
    }
    const inviteMatch = /^\/api\/apps\/([^/]+)\/(?:users|runtime\/users)\/invite-user$/.exec(pathname);
    if (inviteMatch) {
      return handleInviteUser(req, res);
    }

    // Entities routes.
    const entityMatch = ENTITY_ROUTE_RE.exec(pathname);
    if (entityMatch) {
      return await handleEntitiesRoute(req, res, url, entityMatch);
    }

    // Functions routes.
    const functionMatch = /^\/api\/apps\/([^/]+)\/functions\/([^/]+)$/.exec(pathname);
    if (functionMatch && req.method === 'POST') {
      const [, appId, functionName] = functionMatch;
      if (!functionsRouter) {
        return sendError(res, 404, 'function not found');
      }
      return functionsRouter(req, res, { appId, functionName, url });
    }

    // Integration endpoints (Core.InvokeLLM, Core.SendEmail, etc.) — mocked
    // per docs/shim/20260702-sdk-wire-protocol.md, "Integrations".
    const integrationMatch =
      /^\/api\/apps\/([^/]+)\/integration-endpoints\/Core\/([^/]+)$/.exec(pathname);
    if (integrationMatch && req.method === 'POST') {
      const [, , endpointName] = integrationMatch;
      // Require an authenticated session: these endpoints reach the real model
      // (and email/SMS/upload) and spend a real API key. Without this gate,
      // anyone with the public URL could burn the key. The in-app SDK forwards
      // the session bearer token on integration calls, so authenticated use is
      // unaffected.
      const integrationUser = resolveSessionUser(req);
      if (!integrationUser) return sendError(res, 401, 'authentication required');
      return handleCoreIntegration(req, res, {
        endpointName,
        outboxEmail,
        outboxSms,
        sessionUser: integrationUser,
        orgIds: orgIdsForUser(integrationUser.email),
        uploadRegistry,
        uploadsDir,
        hasExtractionAcceptance,
        hasCurrentLegalAcceptance,
        recordLegalAcceptanceBundle,
        canAccessUpload: (upload) => canUserAccessUpload(upload, integrationUser),
        resolveLegacyUpload: ({ storedName, selectedOrgId }) =>
          resolveLegacyUploadForUser({ storedName, selectedOrgId, sessionUser: integrationUser }),
        readUploadBuffer,
      });
    }
    if (/^\/api\/apps\/[^/]+\/integration-endpoints\//.test(pathname)) {
      return sendError(res, 404, 'integration endpoint not implemented in this shim build');
    }

    // Relative /functions/<name> passthrough. In dev the vite proxy rewrites
    // this to the app-scoped route; in single-process production we do the
    // equivalent here so relative calls (e.g. MyProfile.jsx createPortalSession)
    // work without a rebuild. The functions router ignores appId.
    const relFunctionMatch = /^\/functions\/([^/]+)$/.exec(pathname);
    if (relFunctionMatch && req.method === 'POST') {
      const [, functionName] = relFunctionMatch;
      if (!functionsRouter) {
        return sendError(res, 404, 'function not found');
      }
      return functionsRouter(req, res, { appId: DEFAULT_APP_ID, functionName, url });
    }

    // Static SPA serving (dist/), when present.
    if (req.method === 'GET' && fs.existsSync(distDir)) {
      return serveDistOrFallback(req, res, pathname);
    }

    return sendError(res, 404, 'not found');
  } catch (err) {
    if (err instanceof UploadError) {
      if (!res.headersSent) return sendError(res, err.httpStatus || 400, err.publicMessage || 'request rejected');
      return res.end();
    }
    console.error('[shim] unhandled error:', err?.code || err?.name || 'internal_error');
    if (!res.headersSent) {
      sendError(res, 500, 'internal server error');
    } else {
      res.end();
    }
  }
}

const server = http.createServer(requestListener);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[shim] listening on http://localhost:${PORT}`);
});

export { server, db };
