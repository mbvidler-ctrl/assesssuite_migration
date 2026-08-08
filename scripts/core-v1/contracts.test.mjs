import assert from 'node:assert/strict';
import test from 'node:test';

import { createAuditEvent, validateContentFreeAuditPayload } from '../../server/core/audit.mjs';
import { createContextSnapshot, validateContextSnapshot } from '../../server/core/contextSnapshot.mjs';
import {
  completeIdempotencyRecord,
  createPendingIdempotencyRecord,
  fingerprintIdempotentRequest,
  resolveIdempotencyReplay,
} from '../../server/core/idempotency.mjs';
import { deriveRequestContext, validateRequestContext } from '../../server/core/requestContext.mjs';

const NOW = '2026-08-08T01:00:00.000Z';
const LATER = '2026-08-08T02:00:00.000Z';

function requestContext(overrides = {}) {
  return deriveRequestContext({
    requestId: 'request-001',
    correlationId: 'correlation-001',
    sessionUser: {
      id: 'user-001',
      email: 'must-not-be-copied@example.test',
      role: 'user',
      account_status: 'active',
      profession: 'Exercise Physiologist',
    },
    authorisedOrgIds: ['org-alpha'],
    purpose: 'assessment_discovery',
    routeId: 'core.assessment_discovery',
    receivedAt: NOW,
    ...overrides,
  });
}

test('RequestContext is server-scoped, minimal and deeply immutable', () => {
  const context = requestContext();
  assert.equal(context.orgId, 'org-alpha');
  assert.equal(context.actor.profession, 'exercise_physiologist');
  assert.equal('email' in context.actor, false);
  assert.equal(Object.isFrozen(context), true);
  assert.equal(Object.isFrozen(context.actor), true);
  assert.throws(() => {
    context.actor.role = 'admin';
  }, TypeError);
  assert.equal(validateRequestContext(context), context);
});

test('RequestContext never accepts an organisation outside the derived scope', () => {
  assert.throws(
    () => requestContext({ selectedOrgId: 'org-bravo' }),
    (error) => error.code === 'CORE_ORG_OUTSIDE_SCOPE' && error.httpStatus === 403,
  );
  assert.throws(
    () => requestContext({ authorisedOrgIds: ['org-alpha', 'org-bravo'] }),
    (error) => error.code === 'CORE_ORG_REQUIRED',
  );
});

test('runtime context snapshots are stable, source-linked and purpose-bound', () => {
  const context = requestContext();
  const first = createContextSnapshot({
    requestContext: context,
    subject: { type: 'client', id: 'synthetic-client-001' },
    sources: [
      { sourceType: 'assessment', sourceId: 'a-2', version: 'v1', capturedAt: NOW },
      { sourceType: 'assessment', sourceId: 'a-1', version: 'v1', capturedAt: NOW },
    ],
    context: { z: 1, nested: { b: true, a: 'synthetic' } },
    cutoffAt: NOW,
    createdAt: LATER,
    idFactory: () => 'snapshot-001',
  });
  const second = createContextSnapshot({
    requestContext: context,
    subject: { id: 'synthetic-client-001', type: 'client' },
    sources: [...first.sources].reverse(),
    context: { nested: { a: 'synthetic', b: true }, z: 1 },
    cutoffAt: NOW,
    createdAt: LATER,
    idFactory: () => 'snapshot-002',
  });
  assert.equal(first.contentHash, second.contentHash);
  assert.equal(first.sources[0].sourceId, 'a-1');
  assert.equal(Object.isFrozen(first.context.nested), true);
  assert.equal(validateContextSnapshot(first), first);
  assert.throws(
    () => createContextSnapshot({
      requestContext: context,
      purpose: 'report_composition',
      sources: [],
      context: {},
      cutoffAt: NOW,
    }),
    (error) => error.code === 'CORE_PURPOSE_MISMATCH',
  );
});

test('idempotency stores only hashes and rejects semantic key reuse', () => {
  const context = requestContext();
  const requestHash = fingerprintIdempotentRequest({ requestContext: context, payload: { synthetic: true } });
  const pending = createPendingIdempotencyRecord({
    requestContext: context,
    idempotencyKey: 'request-key-001',
    requestHash,
    createdAt: NOW,
    expiresAt: LATER,
  });
  assert.equal('idempotencyKey' in pending, false);
  assert.deepEqual(resolveIdempotencyReplay(pending, { requestHash, now: NOW }), { action: 'in_progress' });
  const completed = completeIdempotencyRecord(pending, {
    responseRef: 'artifact-001',
    responseStatus: 201,
  });
  assert.deepEqual(resolveIdempotencyReplay(completed, { requestHash, now: NOW }), {
    action: 'replay',
    responseRef: 'artifact-001',
    responseStatus: 201,
  });
  assert.throws(
    () => resolveIdempotencyReplay(completed, {
      requestHash: `sha256:${'0'.repeat(64)}`,
      now: NOW,
    }),
    (error) => error.code === 'CORE_IDEMPOTENCY_CONFLICT',
  );
});

test('audit payload is content-free by construction', () => {
  const event = createAuditEvent({
    eventId: 'event-001',
    eventType: 'core.artifact.transitioned',
    action: 'transition',
    outcome: 'succeeded',
    entityType: 'artifact',
    entityId: 'artifact-001',
    orgId: 'org-alpha',
    actorUserId: 'user-001',
    requestId: 'request-001',
    fromState: 'draft',
    toState: 'review',
    metadata: { artifactType: 'assessment_recommendation', itemCount: 4 },
    occurredAt: NOW,
  });
  assert.equal(validateContentFreeAuditPayload(event), event);
  assert.throws(
    () => createAuditEvent({
      eventId: 'event-002',
      eventType: 'core.artifact.created',
      action: 'create',
      outcome: 'succeeded',
      entityType: 'artifact',
      entityId: 'artifact-001',
      orgId: 'org-alpha',
      metadata: { clinicalNote: 'patient content must never be logged' },
      occurredAt: NOW,
    }),
    (error) => error.code === 'CORE_AUDIT_CONTENT_FIELD_DENIED',
  );
});
