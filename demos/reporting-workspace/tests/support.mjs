// Shared test support for the reporting-workflow demo.

import { buildDataset, episodeContext, principalFor, USERS, OTHER_ORG_USER, SYNTHETIC_NOW } from '../fixtures/syntheticDataset.mjs';
import { buildEvidenceCatalogue } from '../domain/evidence.mjs';
import * as workflow from '../domain/workflow.mjs';
import { createDemoHttpServer, listen } from '../server/http.mjs';
import { seedDemoStore } from '../server/seed.mjs';
import { createReportingService } from '../server/service.mjs';
import { openStore } from '../server/store.mjs';

export { SYNTHETIC_NOW };

export function deterministicIds(prefix = '') {
  let counter = 0;
  return (kind) => `${prefix}${kind}-${String(++counter).padStart(4, '0')}`;
}

export function tickingClock(start = SYNTHETIC_NOW, stepMs = 60_000) {
  let current = Date.parse(start);
  return () => {
    current += stepMs;
    return new Date(current).toISOString();
  };
}

export function fixtures() {
  const dataset = buildDataset();
  const principals = {
    treating: principalFor(USERS[0], dataset),
    senior: principalFor(USERS[1], dataset),
    admin: principalFor(USERS[2], dataset),
    inactive: principalFor(USERS[3], dataset),
    other: principalFor(OTHER_ORG_USER, dataset),
  };
  return { dataset, principals };
}

export function catalogueFor(dataset, episodeId) {
  return buildEvidenceCatalogue(episodeContext(dataset, episodeId));
}

export function makeCtx({ actor, now = SYNTHETIC_NOW, idFactory = deterministicIds(), extra = {} }) {
  return { now, idFactory, actor, ...extra };
}

export const KNEE = 'episode-synthetic-knee-1';
export const SHOULDER = 'episode-synthetic-shoulder-1';

export function createKneeRequest({ actor, idFactory, now = SYNTHETIC_NOW, reportType = 'PHYSIO_PROGRESS_REPORT' }) {
  return workflow.createOutputRequest({
    org_id: 'org-synthetic-physio',
    client_id: 'client-synthetic-knee',
    physio_care_episode_id: KNEE,
    report_type: reportType,
    purpose: 'Eight-week progress report for the referrer',
    recipient: { name: 'Dr Synthetic Referrer', role: 'referring_gp', organisation: 'Synthetic Medical Centre' },
    clinical_questions: ['Has function improved since baseline?', 'Is further treatment indicated?'],
    owner_user_id: actor.user_id,
    due_date: '2026-09-12',
  }, { now, idFactory, actor });
}

const NARRATIVE = Object.freeze({
  functional_change: 'Synthetic functional change narrative.',
  clinical_interpretation: 'Synthetic interpretation narrative.',
  recommendations_plan: 'Synthetic recommendations narrative.',
  clinical_functional_update: 'Synthetic update narrative.',
  current_plan: 'Synthetic current plan narrative.',
});

/** Drive a request from creation to approval. Returns every intermediate state. */
export function driveToApproved({ dataset, principals, reportType = 'PHYSIO_PROGRESS_REPORT', idFactory = deterministicIds(), clock = tickingClock() }) {
  const catalogue = catalogueFor(dataset, KNEE);
  const ctx = (actor, extra = {}) => ({ now: clock(), idFactory, actor, ...extra });
  const states = {};
  let request = createKneeRequest({ actor: principals.treating, idFactory, now: clock(), reportType });
  states.created = request;
  ({ request } = workflow.assembleEvidence(request, { expected_version: request.version }, ctx(principals.treating, { catalogue })));
  states.assembled = request;
  ({ request } = workflow.startDraft(request, { expected_version: request.version }, ctx(principals.treating)));
  states.drafted = request;
  const sections = request.draft_revisions.at(-1).sections
    .filter((section) => section.kind === 'narrative' && NARRATIVE[section.key])
    .map((section) => ({ key: section.key, text: NARRATIVE[section.key] }));
  ({ request } = workflow.saveDraft(request, { expected_version: request.version, sections }, ctx(principals.treating)));
  states.saved = request;
  ({ request } = workflow.submitForReview(request, { expected_version: request.version }, ctx(principals.treating)));
  states.submitted = request;
  const approved = workflow.approve(request, { expected_version: request.version }, ctx(principals.senior, { catalogue, ownerName: principals.treating.display_name, synthetic: true }));
  states.approved = approved.request;
  return { ...states, request: approved.request, snapshot: approved.snapshot, catalogue, ctx, idFactory, clock };
}

export async function startTestApi({ aiAdapter = null } = {}) {
  const store = openStore(':memory:');
  const seeded = seedDemoStore(store);
  const service = createReportingService({ store, aiAdapter, clock: tickingClock(), idFactory: deterministicIds('api-') });
  const server = createDemoHttpServer({ service, log: { error() {} } });
  const { baseUrl } = await listen(server);
  async function call(route, { method = 'GET', token = '', body, raw = false } = {}) {
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
    const text = await response.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* not JSON */ }
    return { status: response.status, body: parsed, text, headers: response.headers };
  }
  async function login(identityKey) {
    const session = await call('/api/demo/session', { method: 'POST', body: { identity_key: identityKey } });
    if (session.status !== 200) throw new Error(`login failed for ${identityKey}: ${session.text}`);
    return session.body;
  }
  return {
    store,
    service,
    seeded,
    baseUrl,
    call,
    login,
    async stop() {
      await new Promise((resolve) => server.close(resolve));
      store.close();
    },
  };
}

export const workflowApi = workflow;
