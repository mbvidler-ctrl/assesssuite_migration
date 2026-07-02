// Bridges the functions router to the same session-resolution logic used by
// server/index.mjs's entities router, without importing index.mjs itself
// (which would re-run its top-level bootstrap and server.listen()).
//
// This duplicates the small resolveSessionUser body from server/index.mjs
// deliberately: index.mjs is not designed to be imported as a module (it
// starts an HTTP listener as a side effect of import), so the functions
// router re-derives the same token -> session -> user lookup directly
// against the shared db handle it is given at load time.

import { createSessionRepository, createEntityRepository } from '../db.mjs';
import { parseBearerToken, stripAuthFields } from '../auth.mjs';

const sessionsCache = new WeakMap();
const userRepoCache = new WeakMap();

function sessionsFor(db) {
  if (!sessionsCache.has(db)) sessionsCache.set(db, createSessionRepository(db));
  return sessionsCache.get(db);
}

function userRepoFor(db) {
  if (!userRepoCache.has(db)) userRepoCache.set(db, createEntityRepository(db, 'User'));
  return userRepoCache.get(db);
}

/**
 * Resolves the current session user (full record, including auth-internal
 * fields) from the Authorization header, or null if unauthenticated/invalid.
 * Callers that hand the user to entity-write logic use the full record;
 * callers returning the user to the client must strip auth fields first.
 */
export function resolveSessionUserFromReq(req, db) {
  const token = parseBearerToken(req);
  if (!token) return null;
  const session = sessionsFor(db).findByToken(token);
  if (!session) return null;
  const user = userRepoFor(db).getById(session.user_id);
  return user || null;
}

export { stripAuthFields };
