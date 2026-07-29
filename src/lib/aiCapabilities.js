// Client-side reading and interpretation of the server's public capabilities
// contract (server/capabilities.mjs, published at /public-settings). This is
// the ONLY module a client surface should consult to decide whether an AI
// affordance is available, and the ONLY place user-facing AI-availability
// copy lives (AI_COPY below).
//
// Imports MUST be relative, never `@/...` — node --test resolves no Vite
// alias, and server/tests/ai-capability-degradation.test.mjs imports this
// module directly by relative path (precedent: sdk-error-contract.test.mjs
// importing ../../src/lib/sdkError.js from server/tests/).
import { normalizeSdkError } from './sdkError.js';

export const CAPABILITY_KEYS = Object.freeze(['general_clinical_llm', 'transcription', 'document_extraction']);

const ALLOWED_REASONS = new Set(['available', 'switched_off', 'unconfigured']);

// The only place user-facing AI-availability copy lives. Australian English.
export const AI_COPY = Object.freeze({
  featureName: 'AI writing assistance',
  unavailableSwitchedOff: 'AI writing assistance is switched off for this clinic. You can keep working — this feature will return when it is switched back on.',
  unavailableSwitchedOffShort: 'AI writing assistance is switched off for this clinic.',
  unavailableUnconfigured: 'AI writing assistance is switched on, but no AI provider is configured on this server. Ask your administrator to check the server settings.',
  unavailableUnconfiguredShort: 'No AI provider is configured on this server.',
  disabledButtonHint: 'Unavailable while AI writing assistance is switched off.',
  withdrawnMidSession: 'AI writing assistance has just been switched off. The AI buttons are now unavailable — nothing you have saved is affected.',
  requestFailed: 'The AI service did not respond. Nothing has been saved — please try again.',
  providerFailed: 'The AI service could not complete this request. Nothing has been saved — please try again.',
  notAuthorised: 'AI writing assistance is not approved for your account. This is an account permission, not a temporary outage, so retrying will not help — ask your administrator if you believe you should have access.',
  nonAiUnaffected: 'The information above does not come from AI and is unaffected.',
  ruleBasedBadge: 'Rule-based',
  ruleBasedExplanation: 'These suggestions are matched from the condition tags recorded in your assessment library. They are not AI-generated.',
  aiAssistedBadge: 'AI-assisted',
  analysingConditions: 'Analysing conditions…',
  protocolUnavailableNote: 'AI-assisted protocol generation has been switched off on this server. Reviewed protocols in the catalogue are unaffected and remain available.',
  statusOn: 'On',
  statusOff: 'Off',
  statusUnconfigured: 'Not configured',
  statusUnknown: 'Unknown',
  panelTitle: 'AI features',
  panelIntro: 'These features use AI to draft text for you. When a feature is off, the buttons that use it are disabled and labelled, so nothing is quietly replaced by a non-AI substitute.',
  panelLastChecked: 'Last checked',
  panelRecheck: 'Check again',
  panelUnknown: 'This server did not report its AI feature status. The buttons stay available and will tell you if a feature is unavailable when you use it.',
});

const UNKNOWN_CAPABILITY = Object.freeze({ available: true, reason: 'unknown', published: false });

function normalizeCapabilityEntry(entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.available !== 'boolean') {
    return { ...UNKNOWN_CAPABILITY };
  }
  const reason = ALLOWED_REASONS.has(entry.reason)
    ? entry.reason
    : (entry.available ? 'available' : 'switched_off');
  return { available: entry.available, reason, published: true };
}

/**
 * Read the tri-state capability posture for every known capability key from
 * a public-settings payload. Fail-open on absence, fail-closed on signal
 * (§0 F5): a missing block, a missing key, or a non-boolean `available`
 * always normalises to unknown-optimistic — never to false. This is what
 * lets an old bundle talking to a new server, and a new bundle talking to an
 * old server, both behave exactly as they do today.
 */
export function readCapabilities(appPublicSettings) {
  const publicSettings = appPublicSettings && typeof appPublicSettings === 'object'
    ? appPublicSettings.public_settings
    : null;
  const block = publicSettings && typeof publicSettings === 'object' ? publicSettings.capabilities : null;
  const hasBlock = block && typeof block === 'object' && !Array.isArray(block);

  const result = {};
  for (const key of CAPABILITY_KEYS) {
    result[key] = hasBlock ? normalizeCapabilityEntry(block[key]) : { ...UNKNOWN_CAPABILITY };
  }

  // Legacy bridge: when the capabilities block is absent (old server, new
  // bundle) but the legacy transcription_enabled boolean is present, use it
  // rather than reporting transcription as unknown.
  if (!hasBlock && publicSettings && typeof publicSettings.transcription_enabled === 'boolean') {
    const enabled = publicSettings.transcription_enabled;
    result.transcription = { available: enabled, reason: enabled ? 'available' : 'switched_off', published: true };
  }

  return result;
}

/**
 * A runtime withdrawal (learned from a 503 mid-session) always beats a stale
 * published `available:true` — the client never re-enables an affordance the
 * server has just refused, even if the next background refresh has not
 * landed yet.
 */
export function mergeCapabilityOverrides(capabilities, overrides) {
  const merged = { ...capabilities };
  if (!overrides || typeof overrides !== 'object') return merged;
  for (const [key, reason] of Object.entries(overrides)) {
    merged[key] = { available: false, reason, published: true };
  }
  return merged;
}

/**
 * Classify an AI call failure into a posture the UI can act on. A null
 * status (transport failure) must NEVER classify as a capability
 * withdrawal — only an explicit server signal does.
 */
export function classifyAiError(error) {
  const { status, code, details } = normalizeSdkError(error, { stage: 'invoke_llm' });
  if (code === 'ai_capability_disabled') return 'withdrawn';
  if (code === 'ai_provider_unconfigured') return 'unconfigured';
  if (code === 'ai_provider_failed') return 'provider_failed';
  // Deterministic per-account authorisation refusal from the WP3 eligibility
  // gate (server/integrations.mjs). This is a permanent 403 for this account,
  // NOT a transient outage — it must never surface as "try again".
  if (code === 'clinical_release_unavailable' || code === 'account_inactive' || code === 'ai_not_authorised') {
    return 'not_authorised';
  }
  // Cross-version bridge: a NEW bundle against a PRE-capabilities server,
  // whose body still carries the generic {code:"internal_error"} shape.
  if (status === 503 && /general ai generation is disabled on this server/i.test(details || '')) return 'withdrawn';
  if (status === 503 && /ai generation is not configured on this server/i.test(details || '')) return 'unconfigured';
  if (status === 502) return 'provider_failed';
  return 'request_failed';
}

export function isCapabilityWithdrawnError(error) {
  const kind = classifyAiError(error);
  return kind === 'withdrawn' || kind === 'unconfigured';
}

export function aiErrorMessage(kind) {
  switch (kind) {
    case 'withdrawn':
      return AI_COPY.unavailableSwitchedOffShort;
    case 'unconfigured':
      return AI_COPY.unavailableUnconfiguredShort;
    case 'provider_failed':
      return AI_COPY.providerFailed;
    case 'not_authorised':
      return AI_COPY.notAuthorised;
    default:
      return AI_COPY.requestFailed;
  }
}

export function capabilityStatusLabel(capability) {
  if (!capability) return AI_COPY.statusUnknown;
  if (capability.reason === 'unknown') return AI_COPY.statusUnknown;
  if (capability.available) return AI_COPY.statusOn;
  if (capability.reason === 'unconfigured') return AI_COPY.statusUnconfigured;
  return AI_COPY.statusOff;
}

/**
 * Decide how a single AI surface should render, given its capability posture
 * and (optionally) the outcome of the most recent call. Evaluated in order:
 * a positive withdrawal always wins, then loading, then a reported error,
 * then the ready state.
 *
 * ALWAYS, independent of mode: showNonAiContent = Boolean(hasNonAiContent).
 * This is the V2 fix (MedicationAlerts openFDA label suppression) encoded as
 * a rule — an AI failure must never suppress non-AI content.
 *
 * UNKNOWN asymmetry (deliberate): reason 'unknown' behaves like AVAILABLE
 * for AFFORDANCE purposes (button live, auto-fire allowed) and like
 * UNAVAILABLE for CLAIM purposes (never label output as AI when it is not).
 * That asymmetry is what makes both bundle/server skew directions safe.
 *
 * @param {{capability?: {available: boolean, reason: string}|null, error?: unknown, isLoading?: boolean, hasContent?: boolean, hasNonAiContent?: boolean}} [options]
 */
export function resolveAiSurfaceState({
  capability,
  error = null,
  isLoading = false,
  hasContent = false,
  hasNonAiContent = false,
} = {}) {
  const showNonAiContent = Boolean(hasNonAiContent);
  const cap = capability || { ...UNKNOWN_CAPABILITY };

  if (cap.available === false && cap.reason === 'switched_off') {
    return {
      mode: 'unavailable',
      canTrigger: false,
      message: AI_COPY.unavailableSwitchedOffShort,
      tone: 'muted',
      showAiSection: false,
      showNonAiContent,
    };
  }
  if (cap.available === false && cap.reason === 'unconfigured') {
    return {
      mode: 'unavailable',
      canTrigger: false,
      message: AI_COPY.unavailableUnconfiguredShort,
      tone: 'muted',
      showAiSection: false,
      showNonAiContent,
    };
  }
  if (isLoading) {
    return {
      mode: 'loading',
      canTrigger: false,
      message: null,
      tone: 'muted',
      showAiSection: false,
      showNonAiContent,
    };
  }
  if (error) {
    const kind = classifyAiError(error);
    const withdrawn = kind === 'withdrawn' || kind === 'unconfigured';
    // A permanent per-account authorisation refusal closes the affordance
    // like a withdrawal: retrying cannot succeed for this account.
    const permanent = withdrawn || kind === 'not_authorised';
    return {
      mode: permanent ? 'unavailable' : 'failed',
      canTrigger: !permanent,
      message: aiErrorMessage(kind),
      tone: permanent ? 'muted' : 'warning',
      showAiSection: false,
      showNonAiContent,
    };
  }
  return {
    mode: 'ready',
    canTrigger: true,
    message: null,
    tone: 'muted',
    showAiSection: Boolean(hasContent),
    showNonAiContent,
  };
}
