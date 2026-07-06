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

import { openDatabase, createOutboxRepository } from '../db.mjs';
import { createEntitiesAccessor, readJsonBody, resolveUser, respond, createUpdateMe } from './_shared.mjs';
import { stripAuthFields } from './_auth-bridge.mjs';

import assignOrganizations from './assignOrganizations.mjs';
import auditAssessmentIssues from './auditAssessmentIssues.mjs';
import createCheckoutSession from './createCheckoutSession.mjs';
import createMissingAssessments from './createMissingAssessments.mjs';
import createPortalSession from './createPortalSession.mjs';
import createTestClientWithAssessments from './createTestClientWithAssessments.mjs';
import enableMissingTestRunners from './enableMissingTestRunners.mjs';
import fixHasTestRunnerFlags from './fixHasTestRunnerFlags.mjs';
import fixMissingOrgIds from './fixMissingOrgIds.mjs';
import fixUserOrganizations from './fixUserOrganizations.mjs';
import getComorbidityReport from './getComorbidityReport.mjs';
import getMissingTestRunners from './getMissingTestRunners.mjs';
import stripeWebhook from './stripeWebhook.mjs';
import syncStripeSubscription from './syncStripeSubscription.mjs';
import verifyTestAssessmentData from './verifyTestAssessmentData.mjs';
import verifyReferences from './verifyReferences.mjs';
import searchEvidence from './searchEvidence.mjs';
import medicalLookup from './medicalLookup.mjs';
import transcribeSession from './transcribeSession.mjs';

const REGISTRY = {
  assignOrganizations,
  auditAssessmentIssues,
  createCheckoutSession,
  createMissingAssessments,
  createPortalSession,
  createTestClientWithAssessments,
  enableMissingTestRunners,
  fixHasTestRunnerFlags,
  fixMissingOrgIds,
  fixUserOrganizations,
  getComorbidityReport,
  getMissingTestRunners,
  stripeWebhook,
  syncStripeSubscription,
  verifyTestAssessmentData,
  verifyReferences,
  searchEvidence,
  medicalLookup,
  transcribeSession,
};

let state = null;

function buildState(db, entityNames) {
  return {
    db,
    outboxEmail: createOutboxRepository(db, 'email'),
    outboxSms: createOutboxRepository(db, 'sms'),
    entities: createEntitiesAccessor(db, entityNames),
  };
}

/**
 * Called by server/index.mjs's loadFunctionsRouter() immediately after this
 * module is imported, handing over the already-open db handle + known
 * entity-name set so this router never opens a second, independent
 * connection.
 */
export function init(db, entityNames) {
  state = buildState(db, entityNames);
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

  const { db, entities, outboxEmail, outboxSms } = ensureState();

  const body = await readJsonBody(req);
  const sessionUser = resolveUser(req, db);
  const user = sessionUser ? stripAuthFields(sessionUser) : null;
  const updateMe = createUpdateMe(db, sessionUser);

  const ctx = {
    user,
    entities,
    body,
    request: req,
    respond: (status, json) => respond(res, status, json),
    updateMe,
    outboxEmail,
    outboxSms,
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
