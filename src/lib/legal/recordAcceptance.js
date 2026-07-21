import { base44 } from "@/api/base44Client";
import { SUITE_VERSION, LEGAL_DOCUMENTS, fingerprint } from "@/lib/legal/documentRegistry";
import { loadLegalContent } from "@/lib/legal/loadContent";

/**
 * Writes one immutable LegalAcceptanceEvent row. Never call this to mutate an
 * existing acceptance — a changed decision is always a NEW event (append-only
 * history, per policy-suite doc 27 clause 5/6).
 *
 * @param {object} params
 * @param {string} params.eventType - one of EVENT_TYPES in documentRegistry.js
 * @param {string} [params.documentId] - registry id (documentRegistry.js) if this event is bound to one document
 * @param {string} params.userEmail
 * @param {string} params.orgId
 * @param {string} [params.actorCapacity] - e.g. "practice owner", "invited clinician"
 * @param {string} [params.sessionContext] - appointment/SOAP-note id for recording_consent
 */
export async function recordLegalEvent({
  eventType,
  documentId,
  userEmail,
  orgId,
  actorCapacity,
  sessionContext,
}) {
  let documentTitle = null;
  let documentFingerprint = null;
  if (documentId) {
    const doc = LEGAL_DOCUMENTS[documentId];
    if (doc) {
      documentTitle = doc.title;
      documentFingerprint = fingerprint(loadLegalContent(doc.file));
    }
  }

  return base44.entities.LegalAcceptanceEvent.create({
    event_type: eventType,
    user_email: userEmail,
    org_id: orgId,
    actor_capacity: actorCapacity || "",
    suite_version: SUITE_VERSION,
    document_id: documentId || null,
    document_title: documentTitle,
    document_fingerprint: documentFingerprint,
    session_context: sessionContext || null,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    ip_address: "not-collected-local-shim",
  });
}

/** Convenience: record several events for the same actor/org in sequence. */
export async function recordLegalEvents(events) {
  const results = [];
  for (const evt of events) {
    results.push(await recordLegalEvent(evt));
  }
  return results;
}

/**
 * Atomically records the complete server-derived legal bundle for the current
 * practitioner and organisation. The browser does not choose document ids,
 * titles, versions or fingerprints.
 *
 * @param {{orgId: string, marketingOptIn?: boolean}} params
 */
export async function recordLegalAcceptanceBundle({ orgId, marketingOptIn = false }) {
  return /** @type {Promise<{status: 'success', recorded: number, owner_bundle: boolean}>} */ (
    (/** @type {any} */ (base44.integrations.Core)).RecordLegalAcceptanceBundle({
      org_id: orgId,
      marketing_opt_in: marketingOptIn === true,
    })
  );
}
