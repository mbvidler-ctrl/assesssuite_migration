// Functions router — mounted by server/index.mjs (see loadFunctionsRouter
// there) at POST /api/apps/{appId}/functions/{functionName}. Dispatches to
// the 15 ported Base44 functions (base44/functions/*/entry.ts) plus the
// transcribeSession mock, building each handler's `ctx` from the phase-1
// server's shared db/entity/auth conventions.
//
// This module intentionally does not import server/index.mjs (which starts
// an HTTP listener as an import side effect). It receives the already-open
// db handle from server/index.mjs via the optional init(db, entityNames)
// export below (called from loadFunctionsRouter() immediately after this
// module is dynamically imported). A second independent openDatabase() call
// in the same process is unsafe under SELFTEST=1: openDatabase() deletes
// and recreates the selftest db file, which fails with EPERM on Windows
// while server/index.mjs's own DatabaseSync handle to that same file is
// still open. init() avoids that entirely by sharing the one handle. If this
// module is ever loaded standalone (without init() having been called — not
// the case in the shipped server/index.mjs), it falls back to opening its
// own handle so it remains independently usable.

import {
  openDatabase,
  createOutboxRepository,
  createSessionRepository,
  createPhysioAiGenerationRepository,
  createStripeCheckoutIntentRepository,
  createStripeWebhookEventRepository,
  createIntegrationConnectionRepository,
  createEvidenceCacheRepository,
  createTranscriptionSessionRepository,
} from '../db.mjs';
import { createApiUsageService } from '../apiUsage.mjs';
import {
  createEntitiesAccessor,
  readRawBody,
  parseJsonBody,
  resolveUser,
  respond,
  createUpdateMe,
  createSubscriptionEntitlementUpdater,
} from './_shared.mjs';
import { stripAuthFields } from './_auth-bridge.mjs';
import {
  isInitialClinicalReleaseEligible,
  resolveClinicalReleasePolicy,
} from '../clinicalRelease.mjs';

import createCheckoutSession from './createCheckoutSession.mjs';
import createPortalSession from './createPortalSession.mjs';
import getComorbidityReport from './getComorbidityReport.mjs';
import stripeWebhook from './stripeWebhook.mjs';
import syncStripeSubscription from './syncStripeSubscription.mjs';
import verifyReferences from './verifyReferences.mjs';
import searchEvidence from './searchEvidence.mjs';
import medicalLookup from './medicalLookup.mjs';
import transcribeSession from './transcribeSession.mjs';
import deactivateAccount from './deactivateAccount.mjs';
import cancelSubscriptionAndDeactivate from './cancelSubscriptionAndDeactivate.mjs';
import managePromotions from './managePromotions.mjs';
import physioAiTask from './physioAiTask.mjs';
import savePhysioAiGeneration from './savePhysioAiGeneration.mjs';
import manageOrganizationAccess from './manageOrganizationAccess.mjs';
import manageIntegrations from './manageIntegrations.mjs';
import manageTranscriptionSession from './manageTranscriptionSession.mjs';

const REGISTRY = {
  createCheckoutSession,
  createPortalSession,
  getComorbidityReport,
  stripeWebhook,
  syncStripeSubscription,
  verifyReferences,
  searchEvidence,
  medicalLookup,
  transcribeSession,
  deactivateAccount,
  cancelSubscriptionAndDeactivate,
  managePromotions,
  physioAiTask,
  savePhysioAiGeneration,
  manageOrganizationAccess,
  manageIntegrations,
  manageTranscriptionSession,
};

// The legacy EP maintenance/debug functions are not part of the public
// Physio production application and their module is omitted from its runtime
// dependency tree. Existing EP and isolated test behaviour remains available.
if (process.env.NODE_ENV !== 'production' || process.env.PROFESSION !== 'physio') {
  const maintenanceUrl = new URL('./epMaintenanceRegistry.mjs', import.meta.url);
  Object.assign(REGISTRY, (await import(maintenanceUrl.href)).default);
}

// Functions that read or produce clinical content: require a session AND an
// approved (active) account for non-admins — mirroring the entities router's
// hard approval gate. Billing functions (createCheckoutSession,
// createPortalSession, syncStripeSubscription) stay available while pending
// (entitlement is a separate axis from approval), and stripeWebhook is
// tokenless by design (Stripe calls it; signature-verified in real mode).
const REQUIRES_ACTIVE_ACCOUNT = new Set([
  'getComorbidityReport',
  'verifyReferences',
  'searchEvidence',
  'medicalLookup',
  'transcribeSession',
  'physioAiTask',
  'savePhysioAiGeneration',
  'manageTranscriptionSession',
]);

// Functions that require a session but not approval — billing actions a
// pending user must still be able to take (checkout/portal). Anonymous
// reachability of these was a Stripe-abuse vector in real mode.
const REQUIRES_SESSION = new Set([
  'createCheckoutSession',
  'createPortalSession',
  'syncStripeSubscription',
  // Self-service deactivation needs a session but must work from any
  // account status (an unapproved or suspended user may still close their
  // account).
  'deactivateAccount',
  // Combined cancel-and-close: same rationale as deactivateAccount — a
  // session is required, but it must work from any account status.
  'cancelSubscriptionAndDeactivate',
  'managePromotions',
  'manageOrganizationAccess',
  'manageIntegrations',
]);

let state = null;

function buildState(db, entityNames, services = {}) {
  return {
    db,
    sessions: createSessionRepository(db),
    apiUsage: services.apiUsage || createApiUsageService(db),
    clinicalReleasePolicy: services.clinicalReleasePolicy || resolveClinicalReleasePolicy(process.env),
    outboxEmail: createOutboxRepository(db, 'email'),
    outboxSms: createOutboxRepository(db, 'sms'),
    stripeCheckoutIntents: createStripeCheckoutIntentRepository(db),
    stripeWebhookEvents: createStripeWebhookEventRepository(db),
    physioAiGenerations: createPhysioAiGenerationRepository(db),
    integrationConnections: createIntegrationConnectionRepository(db),
    evidenceCache: createEvidenceCacheRepository(db),
    transcriptionSessions: createTranscriptionSessionRepository(db),
    entities: createEntitiesAccessor(db, entityNames),
    stripeProvider: services.stripeProvider || null,
    transcriptionFallback: services.transcriptionFallback || null,
    uploadRegistry: services.uploadRegistry || null,
  };
}

/**
 * Called by server/index.mjs's loadFunctionsRouter() immediately after this
 * module is imported, handing over the already-open db handle + known
 * entity-name set so this router never opens a second, independent
 * connection.
 */
export function init(db, entityNames, services = {}) {
  state = buildState(db, entityNames, services);
}

function ensureState() {
  if (!state) {
    // Standalone fallback (this module imported without init() having run).
    const { db, entityNames } = openDatabase();
    state = buildState(db, entityNames);
  }
  return state;
}

/**
 * Handles POST /api/apps/{appId}/functions/{functionName}. Matches the
 * signature server/index.mjs's loadFunctionsRouter() expects
 * (`functionsRouter(req, res, {appId, functionName, url})`).
 */
export default async function handleFunction(req, res, { functionName }) {
  const handler = REGISTRY[functionName];
  if (!handler) {
    return respond(res, 404, { message: 'function not found' });
  }

  const {
    db,
    entities,
    outboxEmail,
    outboxSms,
    apiUsage,
    clinicalReleasePolicy,
    physioAiGenerations,
    integrationConnections,
    evidenceCache,
    transcriptionSessions,
    stripeCheckoutIntents,
    stripeWebhookEvents,
    stripeProvider,
    transcriptionFallback,
    sessions,
    uploadRegistry,
  } = ensureState();
  if (
    ['physioAiTask', 'savePhysioAiGeneration'].includes(functionName)
    && clinicalReleasePolicy.professionId !== 'physio'
  ) {
    return respond(res, 404, { message: 'function not found' });
  }

  // The body is read ONCE as raw bytes, then parsed. Both forms go on ctx:
  // stripeWebhook needs the exact raw bytes for Stripe-Signature HMAC
  // verification when real Stripe mode is enabled (re-serialised JSON would
  // not match the bytes Stripe signed). Every other handler keeps using the
  // parsed ctx.body exactly as before — behaviour is unchanged.
  const rawBody = await readRawBody(req);
  const body = parseJsonBody(rawBody);
  const sessionUser = resolveUser(req, db);
  const user = sessionUser ? stripAuthFields(sessionUser) : null;
  const updateMe = createUpdateMe(db, sessionUser);

  if (REQUIRES_ACTIVE_ACCOUNT.has(functionName)) {
    if (!user) {
      return respond(res, 401, { error: 'authentication required' });
    }
    if (user.role !== 'admin' && user.account_status !== 'active') {
      return respond(res, 403, { error: 'account pending approval' });
    }
    if (user.role !== 'admin' && !isInitialClinicalReleaseEligible(user, clinicalReleasePolicy)) {
      return respond(res, 403, { error: 'clinical access is not approved for this account profile' });
    }
  } else if (REQUIRES_SESSION.has(functionName)) {
    if (!user) {
      return respond(res, 401, { error: 'authentication required' });
    }
  }

  const ctx = {
    user,
    entities,
    body,
    rawBody,
    request: req,
    respond: (status, json) => respond(res, status, json),
    updateMe,
    ...(user ? { apiUsage: apiUsage.bindUser({ userId: user.id }) } : {}),
    ...(functionName === 'syncStripeSubscription'
      ? { updateSubscriptionEntitlement: createSubscriptionEntitlementUpdater(db, sessionUser) }
      : {}),
    ...(functionName === 'createCheckoutSession'
      ? { checkoutIntents: stripeCheckoutIntents }
      : {}),
    ...(functionName === 'stripeWebhook'
      ? { webhookEvents: stripeWebhookEvents }
      : {}),
    ...(['physioAiTask', 'savePhysioAiGeneration', 'manageOrganizationAccess', 'manageIntegrations', 'manageTranscriptionSession', 'transcribeSession'].includes(functionName)
      ? { physioAiGenerations, integrationConnections, transcriptionSessions, uploadRegistry, db }
      : {}),
    ...(functionName === 'manageOrganizationAccess' ? { sessions } : {}),
    ...(functionName === 'searchEvidence' ? { evidenceCache } : {}),
    outboxEmail,
    outboxSms,
    ...(stripeProvider ? { stripeProvider } : {}),
    ...(functionName === 'transcribeSession' && transcriptionFallback
      ? { transcriptionFallback }
      : {}),
  };

  try {
    await handler(ctx);
  } catch (err) {
    console.error(`[shim] function ${functionName} threw:`, err);
    if (!res.headersSent) {
      respond(res, 500, { error: err.message });
    } else {
      res.end();
    }
  }
}
