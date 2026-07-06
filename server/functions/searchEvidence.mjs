// Shim function: retrieve real, citable evidence for a clinical topic so
// generation can be grounded (cite only from the supplied list) rather than
// inventing references. Backed by server/evidence.mjs (OpenAlex). Topic strings
// only — no client data.
//
// Request body: { query: string, limit?: number, reviewsOnly?: boolean }
import { searchEvidence } from '../evidence.mjs';

export default async function searchEvidenceFn(ctx) {
  const { body, respond, user } = ctx;
  if (!user) return respond(401, { error: 'authentication required' });
  const query = typeof body?.query === 'string' ? body.query : '';
  if (!query.trim()) return respond(400, { error: 'a non-empty query is required' });
  const limit = Math.min(Math.max(Number(body?.limit) || 5, 1), 10);
  const reviewsOnly = body?.reviewsOnly !== false;
  const result = await searchEvidence(query, { limit, reviewsOnly });
  return respond(200, result);
}
