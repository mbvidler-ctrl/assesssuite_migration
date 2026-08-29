// Product-facing runtime feature availability.
//
// INVARIANT: every predicate here is BOTH the publication source for
// /public-settings AND the enforcement predicate at the endpoint. Changing
// availability means editing exactly one function in this file. A predicate
// published but not enforced (or vice versa) is what made the 21-28 July
// 2026 outage invisible to every client surface; the agreement is pinned by
// server/tests/public-capabilities-contract.test.mjs.
//
// LAYERING: this module owns the *product* capability vocabulary — which
// capabilities appear in the public contract, how a tri-state posture is
// derived, and the machine-readable refusal codes. It owns NO flag literals.
// Every environment switch it consults resolves through
// server/capabilityFlags.mjs, the low-level registry that owns flag names,
// self-test/parity postures, blast-radius metadata and the generated
// manifests (docs/deployment/flag-manifest.json, capability-manifest.md).
// The two modules never hold parallel lists: adding a switch means
// registering it there and — only if it belongs in the public contract —
// exposing it here. The chokepoint audit in scripts/flag-manifest.mjs fails
// this file if it ever reads process.env.<FLAG> directly again.

import { capabilityEnabled, selftestMockAllowed } from './capabilityFlags.mjs';
import { llmEnabled } from './llm.mjs';

export const CAPABILITY_CONTRACT_VERSION = 1;
export const CLINICAL_AI_DISABLED_CODE = 'ai_capability_disabled';
export const CLINICAL_AI_DISABLED_MESSAGE = 'General AI generation is disabled on this server.'; // byte-identical to today; E37 pins it
export const CLINICAL_AI_UNCONFIGURED_CODE = 'ai_provider_unconfigured';
export const CLINICAL_AI_UNCONFIGURED_MESSAGE = 'AI generation is not configured on this server.'; // byte-identical to today
export const CLINICAL_AI_PROVIDER_FAILED_CODE = 'ai_provider_failed';
export const TRANSCRIPTION_DISABLED_CODE = 'transcription_disabled';
export const TRANSCRIPTION_DISABLED_MESSAGE = 'Transcription is not enabled on this deployment.';
export const TRANSCRIPTION_UNCONFIGURED_CODE = 'transcription_provider_unconfigured';
export const TRANSCRIPTION_UNCONFIGURED_MESSAGE = 'Transcription is not configured on this server.';
export const TRANSCRIPTION_PROVIDER_FAILED_CODE = 'transcription_provider_failed';

const AVAILABLE = Object.freeze({ available: true, reason: 'available' });
const SWITCHED_OFF = Object.freeze({ available: false, reason: 'switched_off' });
const UNCONFIGURED = Object.freeze({ available: false, reason: 'unconfigured' });

/**
 * Exactly equivalent to the boolean previously inlined at
 * server/integrations.mjs:669-671, SELFTEST carve-out included. The registry
 * models the two halves separately — capabilityEnabled() is the strict
 * switch reading, selftestMockAllowed() is the `SELFTEST=1 && flag unset`
 * mock carve-out — and their disjunction is the historical expression,
 * pinned literal-for-literal by R04/R05 in
 * server/tests/capability-flag-registry.test.mjs.
 */
export function generalClinicalLlmSwitchedOn(environment = process.env) {
  return capabilityEnabled('GENERAL_CLINICAL_LLM_ENABLED', environment)
    || selftestMockAllowed('GENERAL_CLINICAL_LLM_ENABLED', environment);
}

/**
 * Exactly equivalent to !(TRANSCRIPTION_ENABLED !== '1' && SELFTEST !== '1')
 * at server/functions/transcribeSession.mjs — the registry records exactly
 * that as TRANSCRIPTION_ENABLED's 'implied-on' posture.
 */
export function transcriptionAvailable(environment = process.env) {
  return capabilityEnabled('TRANSCRIPTION_ENABLED', environment);
}

/**
 * Provider-aware posture for transcription. The feature switch remains the
 * endpoint's first gate; with the switch on, production publishes
 * `unconfigured` when LLM_REQUIRED is enabled but no provider key is loaded.
 * Development retains the explicitly labelled deterministic mock when
 * LLM_REQUIRED is not enabled, while SELFTEST remains offline by design.
 */
export function transcriptionPosture(environment = process.env) {
  if (!transcriptionAvailable(environment)) return SWITCHED_OFF;
  if (llmEnabled()) return AVAILABLE;
  return capabilityEnabled('LLM_REQUIRED', environment) ? UNCONFIGURED : AVAILABLE;
}

/** Server-level switch only; per-user eligibility/acceptance/age gates are separate and authoritative. */
export function documentExtractionAvailable(environment = process.env) {
  return capabilityEnabled('DOCUMENT_EXTRACTION_ENABLED', environment);
}

/**
 * Tri-state posture for general clinical generation. Mirrors BOTH refusal
 * branches of handleInvokeLLM: the flag gate and the production "no provider
 * configured" refusal under LLM_REQUIRED=1. A 502 (provider reachable but
 * failing) is a runtime fault, not a posture, and is deliberately not
 * modelled.
 *
 * NOTE: server/integrations.mjs keeps its own module-load-time `LLM_REQUIRED`
 * const; that duplication is deliberate (no churn in a hot file) and both
 * readings now resolve through capabilityEnabled('LLM_REQUIRED'), so the two
 * cannot diverge on the posture taxonomy. Equivalence is pinned by the
 * C-matrix in server/tests/public-capabilities-contract.test.mjs.
 */
export function generalClinicalLlmPosture(environment = process.env) {
  if (!generalClinicalLlmSwitchedOn(environment)) return SWITCHED_OFF;
  if (llmEnabled()) return AVAILABLE;
  return capabilityEnabled('LLM_REQUIRED', environment) ? UNCONFIGURED : AVAILABLE;
}

/**
 * The versioned Physio task gateway is part of the Physio application target,
 * not the legacy free-form AI switch. It never has a mock fallback: when the
 * target is active but the provider is absent, publish `unconfigured`.
 */
export function physioAiTasksAvailable(
  environment = process.env,
  professionId = environment.PROFESSION,
) {
  return professionId === 'physio';
}

export function physioAiTasksPosture(
  environment = process.env,
  professionId = environment.PROFESSION,
) {
  if (!physioAiTasksAvailable(environment, professionId)) return SWITCHED_OFF;
  return llmEnabled() ? AVAILABLE : UNCONFIGURED;
}

export function publicCapabilities(
  environment = process.env,
  {
    professionId = environment.PROFESSION || 'exercise-physiology',
    legacyGeneralClinicalLlmAllowed = true,
  } = {},
) {
  const capabilities = {
    version: CAPABILITY_CONTRACT_VERSION,
    general_clinical_llm: {
      ...(legacyGeneralClinicalLlmAllowed
        ? generalClinicalLlmPosture(environment)
        : SWITCHED_OFF),
    },
    transcription: { ...transcriptionPosture(environment) },
    document_extraction: documentExtractionAvailable(environment) ? { ...AVAILABLE } : { ...SWITCHED_OFF },
  };
  if (professionId === 'physio') {
    capabilities.physio_ai_tasks = { ...physioAiTasksPosture(environment, professionId) };
  }
  return capabilities;
}
