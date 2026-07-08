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

import { openDatabase, createEntityRepository, createSessionRepository, createOutboxRepository } from './db.mjs';
import { matchesQuery, applySortSkipLimit, applyProjection } from './query.mjs';
import {
  hashPassword,
  verifyPassword,
  parseBearerToken,
  stripAuthFields,
  sanitizeUpdateMePayload,
} from './auth.mjs';
import { handleCoreIntegration } from './integrations.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');
const uploadsDir = path.join(__dirname, 'uploads');

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
// Default app id used for the dev-only /functions/<name> relative path when it
// is served in single-process production (mirrors the vite proxy rewrite).
const DEFAULT_APP_ID = process.env.DEFAULT_APP_ID || 'local-assesssuite';

fs.mkdirSync(uploadsDir, { recursive: true });

const { db, entityNames } = openDatabase();
const sessions = createSessionRepository(db);
const outboxEmail = createOutboxRepository(db, 'email');
const outboxSms = createOutboxRepository(db, 'sms');

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
  'ClinicPolicy',
]);

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
  return false;
}

/** The caller's primary org id (is_primary membership, else first). */
function primaryOrgIdForUser(userEmail) {
  if (!orgMemberRepo || !userEmail) return null;
  const memberships = orgMemberRepo.listAll().filter((m) => m.user_email === userEmail);
  const primary = memberships.find((m) => m.is_primary) || memberships[0];
  return primary?.org_id || null;
}

/** Whether an entity is organisation-scoped (carries org_id), by payload or sample. */
function entityCarriesOrgId(entityName, data) {
  if (data && typeof data === 'object' && 'org_id' in data) return true;
  const repo = repoFor(entityName);
  const sample = repo?.listAll()[0];
  return sample ? 'org_id' in sample : false;
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
    if (isCreate && data && data.user_email && data.user_email !== sessionUser.email) {
      return { ok: false, status: 403, message: 'you may only add your own account to an organisation' };
    }
    return { ok: true };
  }
  if (!entityCarriesOrgId(entityName, data)) return { ok: true };
  const orgIds = orgIdsForUser(sessionUser.email);
  const supplied = data?.org_id;
  if (supplied !== undefined && supplied !== null) {
    if (!orgIds.includes(supplied)) {
      return { ok: false, status: 403, message: 'org_id is outside your organisations' };
    }
    return { ok: true }; // a member org — keep it.
  }
  if (!isCreate) return { ok: true }; // update without an org_id change — leave as is.
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
    if (!isAdmin && !isUserCollection && !isWithinOrgScope(record, sessionUser)) {
      return sendError(res, 404, 'record not found');
    }
    // Organization carries no org_id, so isWithinOrgScope cannot scope it —
    // a non-admin may read only organisations they belong to (the record's
    // own id is the org id), else the org name and subscription status leak
    // cross-tenant.
    if (!isAdmin && entityName === 'Organization'
      && !orgIdsForUser(sessionUser.email).includes(record.id)) {
      return sendError(res, 404, 'record not found');
    }
    const stripped = isUserCollection ? stripAuthFields(record) : record;
    return sendJson(res, 200, stripped);
  }

  if (req.method === 'POST' && !rest) {
    const data = await readJsonBody(req);
    const createdBy = sessionUser?.email || null;
    if (!isAdmin && entityName !== 'User') {
      // Non-admin writes are org-scoped to a membership the caller holds; a
      // caller-supplied foreign or null org_id is rejected/replaced, closing
      // the cross-tenant injection vector.
      const scope = enforceWriteOrgScope(entityName, data, sessionUser, { isCreate: true });
      if (!scope.ok) return sendError(res, scope.status, scope.message);
    }
    const record = repo.create(data, createdBy);
    const stripped = isUserCollection ? stripAuthFields(record) : record;
    return sendJson(res, 200, stripped);
  }

  if (req.method === 'PUT' && rest) {
    if (isUserCollection && !isAdmin) return sendError(res, 403, 'admin access required');
    const existing = repo.getById(rest);
    if (!existing) return sendError(res, 404, 'record not found');
    if (!isAdmin && !isUserCollection && !isWithinOrgScope(existing, sessionUser)) {
      return sendError(res, 404, 'record not found');
    }
    const data = await readJsonBody(req);
    if (!isAdmin && entityName !== 'User') {
      // Prevent relocating a record into another tenant via a mutated org_id.
      const scope = enforceWriteOrgScope(entityName, data, sessionUser, { isCreate: false });
      if (!scope.ok) return sendError(res, scope.status, scope.message);
    }
    const record = repo.update(rest, data);
    const stripped = isUserCollection ? stripAuthFields(record) : record;
    return sendJson(res, 200, stripped);
  }

  if (req.method === 'DELETE' && rest) {
    const existing = repo.getById(rest);
    if (!existing) return sendError(res, 404, 'record not found');
    if (isUserCollection && !isAdmin) return sendError(res, 403, 'admin access required');
    if (!isAdmin && !isUserCollection && !isWithinOrgScope(existing, sessionUser)) {
      return sendError(res, 404, 'record not found');
    }
    repo.remove(rest);
    return sendJson(res, 200, { id: rest, deleted: true });
  }

  if (req.method === 'DELETE' && !rest) {
    // DELETE-with-body deleteMany.
    const query = await readJsonBody(req);
    const scopedQuery = scopeQueryToOrg(query, entityName, sessionUser, isAdmin);
    const all = repo.listAll();
    const matched = all.filter((record) => matchesQuery(record, scopedQuery));
    for (const record of matched) repo.remove(record.id);
    return sendJson(res, 200, { deleted: matched.length });
  }

  return sendError(res, 404, 'route not found');
}

/** Whether a non-admin session user may see/write a record, based on org_id scoping. */
function isWithinOrgScope(record, sessionUser) {
  if (!('org_id' in record) || record.org_id === undefined || record.org_id === null) {
    return true; // entity does not carry org_id — no scoping applies.
  }
  if (!sessionUser) return false;
  const orgIds = orgIdsForUser(sessionUser.email);
  return orgIds.includes(record.org_id);
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
  const repo = repoFor(entityName);
  const sample = repo?.listAll()[0];
  const carriesOrgId = sample ? 'org_id' in sample : entityName !== 'User';
  if (!carriesOrgId) return query || {};
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
    if (!isAdmin && entityName !== 'User') {
      // Same cross-tenant scoping as single create, per item.
      for (const item of items) {
        const scope = enforceWriteOrgScope(entityName, item, sessionUser, { isCreate: true });
        if (!scope.ok) return sendError(res, scope.status, scope.message);
      }
    }
    const created = items.map((item) => repo.create(item, createdBy));
    const result = entityName === 'User' ? created.map(stripAuthFields) : created;
    return sendJson(res, 200, result);
  }

  if (req.method === 'PUT') {
    // bulkUpdate: JSON array of records, each carrying its own id.
    const items = Array.isArray(body) ? body : body.items || [];
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
    if (findUserByEmail(email)) {
      return sendError(res, 409, 'a user with this email already exists');
    }
    const { password_hash, salt } = hashPassword(password);
    const { password: _pw, ...customFields } = payload;
    const user = userRepo.create(
      {
        ...customFields,
        email,
        role: 'user',
        account_status: 'pending',
        password_hash,
        salt,
        otp_code: '000000',
      },
      email,
    );
    return sendJson(res, 200, { message: 'registered', user_id: user.id, otp_required: true });
  }

  if (action === 'verify-otp' && req.method === 'POST') {
    if (!ALLOW_OPEN_REGISTRATION) {
      // The blanket 000000 code would otherwise return a session for any known
      // email without a password; disabled with registration for the demo.
      return sendError(res, 403, 'account verification is disabled for this deployment');
    }
    const { email, otp_code } = await readJsonBody(req);
    const user = findUserByEmail(email);
    if (!user) return sendError(res, 404, 'user not found');
    if (String(otp_code) !== '000000' && String(otp_code) !== String(user.otp_code)) {
      return sendError(res, 401, 'invalid verification code');
    }
    // Email verification must not activate the account: activation is an
    // admin approval decision (AdminApprovals). Never demote an already-active
    // user who happens to pass through the OTP path.
    const nextStatus = user.account_status === 'active' ? 'active' : 'pending';
    const updated = userRepo.update(user.id, {
      account_status: nextStatus,
      email_verified: true,
      otp_code: null,
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
      outboxEmail.record({ to: email, subject: 'Your verification code', body: 'Code: 000000' });
    }
    return sendJson(res, 200, { status: 'sent' });
  }

  if (action === 'reset-password-request' && req.method === 'POST') {
    const { email } = await readJsonBody(req);
    const user = findUserByEmail(email);
    if (user) {
      const resetToken = randomUUID();
      userRepo.update(user.id, { reset_token: resetToken });
      outboxEmail.record({ to: email, subject: 'Password reset', body: `Reset token: ${resetToken}` });
    }
    return sendJson(res, 200, { status: 'sent' });
  }

  if (action === 'reset-password' && req.method === 'POST') {
    const { reset_token, new_password } = await readJsonBody(req);
    const user = userRepo.listAll().find((u) => u.reset_token === reset_token);
    if (!user) return sendError(res, 400, 'invalid or expired reset token');
    const { password_hash, salt } = hashPassword(new_password);
    userRepo.update(user.id, { password_hash, salt, reset_token: null });
    return sendJson(res, 200, { status: 'reset' });
  }

  if (action === 'change-password' && req.method === 'POST') {
    const { user_id, current_password, new_password } = await readJsonBody(req);
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
  outboxEmail.record({ to: user_email, subject: 'You have been invited', body: `Role: ${role}` });
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
  return sendJson(res, 200, { id: appId, public_settings: {} });
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
      return handleAuthRoute(req, res, url, authMatch[1], authMatch[2]);
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
