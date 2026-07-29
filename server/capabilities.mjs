// Single source of truth for runtime feature availability.
//
// INVARIANT: every predicate here is BOTH the publication source for
// /public-settings AND the enforcement predicate at the endpoint. Changing
// availability means editing exactly one function in this file. A predicate
// published but not enforced (or vice versa) is what made the 21-28 July
// 2026 outage invisible to every client surface; the agreement is pinned by
// server/tests/public-capabilities-contract.test.mjs.

import { llmEnabled } from './llm.mjs';

export const CAPABILITY_CONTRACT_VERSION = 1;
export const CLINICAL_AI_DISABLED_CODE = 'ai_capability_disabled';
export const CLINICAL_AI_DISABLED_MESSAGE = 'General AI generation is disabled on this server.'; // byte-identical to today; E37 pins it
export const CLINICAL_AI_UNCONFIGURED_CODE = 'ai_provider_unconfigured';
export const CLINICAL_AI_UNCONFIGURED_MESSAGE = 'AI generation is not configured on this server.'; // byte-identical to today
export const CLINICAL_AI_PROVIDER_FAILED_CODE = 'ai_provider_failed';
export const TRANSCRIPTION_DISABLED_CODE = 'transcription_disabled';

const AVAILABLE = Object.freeze({ available: true, reason: 'available' });
const SWITCHED_OFF = Object.freeze({ available: false, reason: 'switched_off' });
const UNCONFIGURED = Object.freeze({ available: false, reason: 'unconfigured' });

/** Exactly equivalent to the boolean previously inlined at server/integrations.mjs:669-671, SELFTEST carve-out included. */
export function generalClinicalLlmSwitchedOn(environment = process.env) {
  const flag = environment.GENERAL_CLINICAL_LLM_ENABLED;
  const selftestMockAllowed = environment.SELFTEST === '1' && flag === undefined;
  return flag === '1' || selftestMockAllowed;
}

/** Exactly equivalent to !(TRANSCRIPTION_ENABLED !== '1' && SELFTEST !== '1') at server/functions/transcribeSession.mjs:208. */
export function transcriptionAvailable(environment = process.env) {
  return environment.TRANSCRIPTION_ENABLED === '1' || environment.SELFTEST === '1';
}

/** Server-level switch only; per-user eligibility/acceptance/age gates are separate and authoritative. */
export function documentExtractionAvailable(environment = process.env) {
  return environment.DOCUMENT_EXTRACTION_ENABLED === '1';
}

/**
 * Tri-state posture for general clinical generation. Mirrors BOTH refusal
 * branches of handleInvokeLLM: the flag gate (:669-675) and the production
 * "no provider configured" refusal under LLM_REQUIRED=1 (:696-699). A 502
 * (provider reachable but failing) is a runtime fault, not a posture, and is
 * deliberately not modelled.
 *
 * NOTE: server/integrations.mjs:79 keeps its own module-load-time
 * `LLM_REQUIRED` const; that duplication is deliberate (no churn in a hot
 * file) and is pinned equivalent by the C-matrix in
 * server/tests/public-capabilities-contract.test.mjs.
 */
export function generalClinicalLlmPosture(environment = process.env) {
  if (!generalClinicalLlmSwitchedOn(environment)) return SWITCHED_OFF;
  if (llmEnabled()) return AVAILABLE;
  return environment.LLM_REQUIRED === '1' ? UNCONFIGURED : AVAILABLE;
}

export function publicCapabilities(environment = process.env) {
  return {
    version: CAPABILITY_CONTRACT_VERSION,
    general_clinical_llm: { ...generalClinicalLlmPosture(environment) },
    transcription: transcriptionAvailable(environment) ? { ...AVAILABLE } : { ...SWITCHED_OFF },
    document_extraction: documentExtractionAvailable(environment) ? { ...AVAILABLE } : { ...SWITCHED_OFF },
  };
}
