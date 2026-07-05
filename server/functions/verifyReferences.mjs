// Shim function: verify a batch of citations against free academic databases
// (OpenAlex primary, PubMed cross-check, Crossref best-effort) via
// server/evidence.mjs. The frontend calls this instead of trusting an
// LLM-supplied DOI, so a fabricated or mis-attributed reference is caught
// server-side. Bibliographic strings only — no client data leaves the server.
//
// Request body: { citations: [ { doi?, title?, authors?[], year? } | "citation string" ] }
// Response: { results: [ { verdict, canonical, checks, networkError, input } ], summary }
import { verifyCitations } from '../evidence.mjs';

export default async function verifyReferences(ctx) {
  const { body, respond, user } = ctx;
  if (!user) return respond(401, { error: 'authentication required' });
  const citations = Array.isArray(body?.citations) ? body.citations : [];
  if (citations.length === 0) {
    return respond(400, { error: 'a non-empty citations array is required' });
  }
  if (citations.length > 25) {
    return respond(400, { error: 'too many citations in one request (max 25)' });
  }
  const { results, summary } = await verifyCitations(citations);
  return respond(200, { results, summary });
}
