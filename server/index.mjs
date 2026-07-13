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
} from './auth.mjs';
import { handleCoreIntegration } from './integrations.mjs';
import { initEmail, sendEmail, otpEmail, resetEmail, welcomeEmail, adminNotifyEmail, inviteEmail } from './email.mjs';

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
initEmail(outboxEmail);

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
    /^\/api\/app-logs\//.test(pathname) ||
    /^\/uploads\//.test(pathname)
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
const LEGAL_SUITE_VERSION = 'RC-2026.07.11';
const REQUIRED_NOTICE_EVENT_TYPES = [
  'collection_notice_acknowledgement',
  'professional_use_acknowledgement',
  'ai_transparency_consent',
];

/**
 * True if sessionUser has recorded every mandatory practitioner-notice event
 * at the current suite version. Fails open (returns true) only if the
 * LegalAcceptanceEvent entity is not yet registered at all — a migration
 * safety valve, not a normal runtime path.
 */
function hasCurrentLegalAcceptance(userEmail) {
  const repo = repoFor('LegalAcceptanceEvent');
  if (!repo) return true;
  const events = repo
    .listAll()
    .filter((e) => e.user_email === userEmail && e.suite_version === LEGAL_SUITE_VERSION);
  return REQUIRED_NOTICE_EVENT_TYPES.every((t) => events.some((e) => e.event_type === t));
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
    // Same self-only integrity rule as LegalAcceptance, plus the generic
    // org-scope enforcement below (LegalAcceptanceEvent carries org_id, so it
    // is auto-scoped by ORG_SCOPED_ENTITIES/enforceWriteOrgScope — this branch
    // only adds the user_email self-check on top).
    if (isCreate && data && data.user_email && data.user_email !== sessionUser.email) {
      return { ok: false, status: 403, message: 'you may only record your own acceptance or consent' };
    }
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
    const record = repo.create(data, createdBy);
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
    const record = repo.update(rest, data);
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
    const created = items.map((item) => repo.create(item, createdBy));
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
    const updated = items
      .map((item) => (item.id ? repo.update(item.id, item) : null))
      .filter(Boolean);
    const result = entityName === 'User' ? updated.map(stripAuthFields) : updated;
    return sendJson(res, 200, result);
  }

  return sendError(res, 405, 'method not allowed');
}

async function handleUpdateMany(req, res, entityName) {
  if (req.method !== 'PATCH') return sendError(res, 405, 'method not allowed');
  const repo = repoFor(entityName);
  if (!repo) return sendError(res, 404, `entity ${entityName} not found`);
  const sessionUser = resolveSessionUser(req);
  const isAdmin = sessionUser?.role === 'admin';
  if (entityName === 'User' && !isAdmin) return sendError(res, 403, 'admin access required');
  if (entityAccessDenied(req, res, entityName, sessionUser, isAdmin)) return;

  const body = await readJsonBody(req);
  const { query, data } = body || {};
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
    const updated = userRepo.update(sessionUser.id, sanitized);
    return sendJson(res, 200, stripAuthFields(updated));
  }

  return sendError(res, 405, 'method not allowed');
}

// ---------------------------------------------------------------------------
// Auth endpoints (/api/apps/{appId}/auth/*, /users/invite-user, etc.)
// ---------------------------------------------------------------------------

function findUserByEmail(email) {
  return userRepo.listAll().find((u) => u.email === email) || null;
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
    const { email, password } = payload;
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
      return sendError(res, 409, 'a user with this email already exists');
    }
    if (existing && existing.otp_last_sent_at && Date.now() - Date.parse(existing.otp_last_sent_at) < RESEND_MIN_INTERVAL_MS) {
      return sendJson(res, 200, { message: 'registered', user_id: existing.id, otp_required: true });
    }
    const { password_hash, salt } = hashPassword(password);
    const { password: _pw, ...customFields } = payload;
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
  const { user_email, role } = await readJsonBody(req);
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
  //   RC-2026.07.11 (the immutable content identifier recorded in
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
// Static serving: /uploads/* and dist/ SPA fallback
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

function serveUpload(req, res, pathname) {
  const relative = decodeURIComponent(pathname.replace(/^\/uploads\//, ''));
  const resolved = path.join(uploadsDir, relative);
  if (!resolved.startsWith(uploadsDir)) {
    return sendError(res, 400, 'invalid path');
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return sendError(res, 404, 'not found');
  }
  return serveFile(res, resolved);
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

    // Uploads static serving.
    if (pathname.startsWith('/uploads/') && req.method === 'GET') {
      return serveUpload(req, res, pathname);
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
      return handleCoreIntegration(req, res, { endpointName, outboxEmail, outboxSms });
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
    console.error('[shim] unhandled error:', err);
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
