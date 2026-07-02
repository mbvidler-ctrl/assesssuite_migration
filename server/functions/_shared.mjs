// Shared helpers for the ported Base44 functions router.
//
// Every ported function (server/functions/{name}.mjs) receives a `ctx` object
// built by dispatch(), below, so each handler can be written without
// re-deriving auth, body parsing, or entity access on every call. This
// mirrors the phase-1 server conventions in server/index.mjs / server/db.mjs
// (see docs/shim/20260702-sdk-wire-protocol.md, "Functions" section).
//
// `createClientFromRequest(req).auth.me()` in the captured Deno source maps
// to `ctx.user` here. `base44.asServiceRole.entities.X.*` (service role
// bypasses org scoping) and plain `base44.entities.X.*` (org-scoped in the
// live platform) both map to `ctx.entities.X.*` — the phase-1 shim does not
// yet enforce org scoping inside function bodies (only the entities router
// does), so a single unscoped helper set correctly reproduces both call
// styles found in the captured source.

import { createEntityRepository } from '../db.mjs';
import { resolveSessionUserFromReq } from './_auth-bridge.mjs';
import { sanitizeUpdateMePayload } from '../auth.mjs';

/**
 * Wraps a repository with the small set of async, Promise-returning methods
 * the captured Deno function bodies call (`.list()`, `.filter()`, `.get()`,
 * `.create()`, `.update()`, `.delete()`). The underlying repository methods
 * are synchronous (node:sqlite is synchronous); wrapping in
 * `Promise.resolve()` preserves the `await`-based call sites verbatim.
 */
function wrapEntity(repo, entityName) {
  return {
    async list(sort, limit, skip) {
      const { applySortSkipLimit } = await import('../query.mjs');
      let records = repo.listAll();
      records = applySortSkipLimit(records, { sort, limit, skip });
      return records;
    },
    async filter(query, sort, limit, skip) {
      const { matchesQuery, applySortSkipLimit } = await import('../query.mjs');
      let records = repo.listAll().filter((record) => matchesQuery(record, query || {}));
      records = applySortSkipLimit(records, { sort, limit, skip });
      return records;
    },
    async get(id) {
      const record = repo.getById(id);
      if (!record) throw new Error(`${entityName} ${id} not found`);
      return record;
    },
    async create(data) {
      return repo.create(data, null);
    },
    async update(id, data) {
      const updated = repo.update(id, data);
      if (!updated) throw new Error(`${entityName} ${id} not found`);
      return updated;
    },
    async delete(id) {
      const removed = repo.remove(id);
      if (!removed) throw new Error(`${entityName} ${id} not found`);
      return { id, deleted: true };
    },
  };
}

/**
 * Builds the `ctx.entities` surface: one wrapped repository per known
 * entity name, created lazily and cached for the lifetime of the process
 * (mirrors the repoCache pattern in server/index.mjs).
 */
export function createEntitiesAccessor(db, entityNames) {
  const cache = new Map();
  return new Proxy(
    {},
    {
      get(_target, entityName) {
        if (typeof entityName !== 'string') return undefined;
        if (!entityNames.has(entityName)) {
          throw new Error(`entity ${entityName} not found`);
        }
        if (!cache.has(entityName)) {
          cache.set(entityName, wrapEntity(createEntityRepository(db, entityName), entityName));
        }
        return cache.get(entityName);
      },
    },
  );
}

/**
 * Reads the request body as JSON (functions in this app are never invoked
 * with multipart bodies — only the Core integrations endpoints are).
 * Returns {} for an empty body, matching `req.json().catch(() => ({}))`
 * patterns seen in the captured source (e.g. getComorbidityReport).
 */
export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Resolves ctx.user (the equivalent of `createClientFromRequest(req).auth.me()`)
 * by delegating to the same session-lookup logic as the entities router.
 */
export function resolveUser(req, db) {
  return resolveSessionUserFromReq(req, db);
}

/** Sends a JSON response with the given status, matching Response.json(...) semantics used throughout entry.ts. */
export function respond(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * Builds ctx.updateMe(data) — the equivalent of `base44.auth.updateMe(data)`
 * used by syncStripeSubscription/entry.ts. Applies the same guarded-field
 * sanitisation as the entities router's /me PUT handler.
 */
export function createUpdateMe(db, sessionUser) {
  const userRepo = createEntityRepository(db, 'User');
  return async function updateMe(data) {
    if (!sessionUser) throw new Error('authentication required');
    const sanitized = sanitizeUpdateMePayload(data);
    return userRepo.update(sessionUser.id, sanitized);
  };
}
