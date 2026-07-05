// Shim function: onboarding enrichment for conditions and medications via
// server/medicalLookup.mjs (ICD-10-CM terminology, RxNorm normalisation,
// openFDA label warnings). Decision-support enrichment only, from authoritative
// sources with provenance tags; nothing fabricated. Condition/medication terms
// only leave the server — never client identity or record data.
//
// Request body: { conditions?: string[], medications?: string[] }
import { medicalLookup } from '../medicalLookup.mjs';

export default async function medicalLookupFn(ctx) {
  const { body, respond, user } = ctx;
  if (!user) return respond(401, { error: 'authentication required' });
  const conditions = Array.isArray(body?.conditions) ? body.conditions.filter(Boolean) : [];
  const medications = Array.isArray(body?.medications) ? body.medications.filter(Boolean) : [];
  if (conditions.length === 0 && medications.length === 0) {
    return respond(400, { error: 'provide a non-empty conditions and/or medications array' });
  }
  const result = await medicalLookup({ conditions, medications });
  return respond(200, result);
}
