import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ApiUsageError,
  calculateChatCostMicrousd,
  calculateTranscriptionCostMicrousd,
  createApiUsageService,
  ensureApiUsageSchema,
} from '../apiUsage.mjs';
import { finalizeExtractionAccounting } from '../integrations.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function fixture({ environment = {}, start = '2026-08-12T00:00:00.000Z' } = {}) {
  const db = new DatabaseSync(':memory:');
  ensureApiUsageSchema(db);
  let now = new Date(start);
  let sequence = 0;
  const service = createApiUsageService(db, {
    environment,
    clock: () => new Date(now),
    idFactory: () => `reservation-${++sequence}`,
  });
  return {
    db,
    service,
    setNow(value) { now = new Date(value); },
    close() { db.close(); },
  };
}

function reserveChat(service, overrides = {}) {
  return service.reserve({
    userId: 'user-a',
    provider: 'openai',
    feature: 'invoke_llm',
    model: 'gpt-4.1-mini',
    estimatedCostMicrousd: 10_000,
    ...overrides,
  });
}

test('model price registry produces integer microusd for chat and transcription', () => {
  assert.equal(calculateChatCostMicrousd({
    model: 'gpt-4.1-mini',
    inputTokens: 2_000,
    outputTokens: 1_000,
  }), 2_400);
  assert.equal(calculateChatCostMicrousd({
    model: 'gpt-4.1',
    inputTokens: 8_000,
    cachedInputTokens: 1_000,
    outputTokens: 4_000,
  }), 46_500);
  assert.equal(calculateTranscriptionCostMicrousd({
    model: 'whisper-1',
    audioSeconds: 30 * 60,
  }), 180_000);
  assert.throws(
    () => calculateChatCostMicrousd({ model: 'unreviewed-model', inputTokens: 1, outputTokens: 1 }),
    (error) => error instanceof ApiUsageError && error.code === 'ai_usage_model_unpriced',
  );
});

test('user cap admits the exact boundary, refuses excess, and isolates users', () => {
  const f = fixture({
    environment: {
      AI_USAGE_USER_ROLLING_24H_USD: '0.02',
      AI_USAGE_USER_ROLLING_24H_CALLS: '2',
      AI_USAGE_GLOBAL_MONTHLY_USD: '10',
    },
  });
  try {
    reserveChat(f.service);
    reserveChat(f.service);
    assert.throws(
      () => reserveChat(f.service, { estimatedCostMicrousd: 1 }),
      (error) =>
        error instanceof ApiUsageError &&
        error.httpStatus === 429 &&
        error.code === 'api_usage_cap_reached' &&
        typeof error.resetsAt === 'string' &&
        error.retryAfterSeconds === 86_400,
    );
    assert.doesNotThrow(() => reserveChat(f.service, { userId: 'user-b' }));
  } finally {
    f.close();
  }
});

test('settlement replaces estimates while failed calls retain them and cancelled calls release them', () => {
  const f = fixture({
    environment: {
      AI_USAGE_USER_ROLLING_24H_USD: '0.02',
      AI_USAGE_USER_ROLLING_24H_CALLS: '10',
      AI_USAGE_GLOBAL_MONTHLY_USD: '10',
    },
  });
  try {
    const succeeded = reserveChat(f.service, { estimatedCostMicrousd: 10_000 });
    f.service.settle({
      reservationId: succeeded.id,
      status: 'succeeded',
      actualCostMicrousd: 1_000,
      inputTokens: 1_000,
      cachedInputTokens: 250,
      outputTokens: 375,
      providerRequestId: 'provider-request-private',
    });
    const failed = reserveChat(f.service, { estimatedCostMicrousd: 10_000 });
    f.service.settle({ reservationId: failed.id, status: 'failed' });
    assert.throws(
      () => reserveChat(f.service, { estimatedCostMicrousd: 9_001 }),
      (error) => error instanceof ApiUsageError && error.code === 'api_usage_cap_reached',
    );

    const cancellable = reserveChat(f.service, { estimatedCostMicrousd: 9_000 });
    f.service.cancel({ reservationId: cancellable.id });
    assert.doesNotThrow(() => reserveChat(f.service, { estimatedCostMicrousd: 9_000 }));

    const rows = f.db.prepare(`
      SELECT id, status, actual_cost_microusd, cached_input_tokens, provider_request_id_hash
      FROM api_usage_reservation ORDER BY id
    `).all();
    const succeededRow = rows.find((row) => row.id === succeeded.id);
    assert.equal(succeededRow.actual_cost_microusd, 1_000);
    assert.equal(succeededRow.cached_input_tokens, 250);
    assert.match(succeededRow.provider_request_id_hash, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(rows).includes('provider-request-private'), false);
    assert.equal(rows.find((row) => row.id === failed.id).actual_cost_microusd, null);
    assert.equal(rows.find((row) => row.id === cancellable.id).status, 'cancelled');
  } finally {
    f.close();
  }
});

test('rolling user window expires while the global UTC-month circuit remains independent', () => {
  const f = fixture({
    environment: {
      AI_USAGE_USER_ROLLING_24H_USD: '5',
      AI_USAGE_USER_ROLLING_24H_CALLS: '1',
      AI_USAGE_GLOBAL_MONTHLY_USD: '0.02',
    },
  });
  try {
    reserveChat(f.service, { estimatedCostMicrousd: 10_000 });
    assert.throws(
      () => reserveChat(f.service, { estimatedCostMicrousd: 1 }),
      (error) => error instanceof ApiUsageError && error.code === 'api_usage_cap_reached',
    );

    f.setNow('2026-08-13T00:00:00.001Z');
    reserveChat(f.service, { estimatedCostMicrousd: 10_000 });
    assert.throws(
      () => reserveChat(f.service, { userId: 'user-b', estimatedCostMicrousd: 1 }),
      (error) =>
        error instanceof ApiUsageError &&
        error.httpStatus === 503 &&
        error.code === 'api_usage_global_cap_reached',
    );
  } finally {
    f.close();
  }
});

test('document reservations count each provider request unit', () => {
  const f = fixture({
    environment: {
      AI_USAGE_USER_ROLLING_24H_USD: '5',
      AI_USAGE_USER_ROLLING_24H_CALLS: '2',
      AI_USAGE_GLOBAL_MONTHLY_USD: '10',
    },
  });
  try {
    const reservation = f.service.reserve({
      userId: 'user-a',
      orgId: 'org-a',
      provider: 'openai',
      feature: 'document_extraction',
      model: 'gpt-4.1-mini-2025-04-14',
      estimatedCostMicrousd: 400_000,
      requestUnits: 2,
    });
    assert.equal(reservation.requestUnits, 2);
    assert.throws(
      () => reserveChat(f.service, { estimatedCostMicrousd: 1 }),
      (error) => error instanceof ApiUsageError && error.code === 'api_usage_cap_reached',
    );
  } finally {
    f.close();
  }
});

test('three-dollar audio reservation prevents two concurrent calls but actual settlement restores headroom', () => {
  const f = fixture();
  try {
    assert.equal(f.service.estimates.transcriptionMicrousd, 3_000_000);
    const first = f.service.reserve({
      userId: 'user-a',
      provider: 'openai',
      feature: 'transcription',
      model: 'whisper-1',
      estimatedCostMicrousd: f.service.estimates.transcriptionMicrousd,
    });
    assert.throws(
      () => f.service.reserve({
        userId: 'user-a',
        provider: 'openai',
        feature: 'transcription',
        model: 'whisper-1',
        estimatedCostMicrousd: f.service.estimates.transcriptionMicrousd,
      }),
      (error) => error instanceof ApiUsageError && error.code === 'api_usage_cap_reached',
    );
    f.service.settle({
      reservationId: first.id,
      status: 'succeeded',
      actualCostMicrousd: 180_000,
      audioSeconds: 1_800,
    });
    assert.doesNotThrow(() => f.service.reserve({
      userId: 'user-a',
      provider: 'openai',
      feature: 'transcription',
      model: 'whisper-1',
      estimatedCostMicrousd: f.service.estimates.transcriptionMicrousd,
    }));
  } finally {
    f.close();
  }
});

test('accounting failure is fail-closed before a reservation can be returned', () => {
  const f = fixture();
  try {
    f.db.exec('DROP TABLE api_usage_reservation');
    assert.throws(
      () => reserveChat(f.service),
      (error) =>
        error instanceof ApiUsageError &&
        error.httpStatus === 503 &&
        error.code === 'api_usage_accounting_unavailable',
    );
  } finally {
    f.close();
  }
});

test('extraction slot is released even when one or both settlement stores throw', () => {
  let releases = 0;
  let legacyAttempts = 0;
  assert.throws(
    () => finalizeExtractionAccounting({
      apiUsage: {
        settle() { throw new Error('generic settlement failed'); },
        cancel() { throw new Error('unexpected cancel'); },
      },
      apiUsageReservation: { id: 'api-reservation' },
      apiUsageFinalized: false,
      providerCallStarted: true,
      uploadRegistry: {
        completeExtractionUsage() {
          legacyAttempts += 1;
          throw new Error('legacy settlement failed');
        },
      },
      extractionReservation: { id: 'legacy-reservation' },
      succeeded: false,
      actualCostMicrousd: null,
      releaseSlot() { releases += 1; },
    }),
    /generic settlement failed/,
  );
  assert.equal(legacyAttempts, 1, 'legacy finalization is still attempted after generic failure');
  assert.equal(releases, 1, 'slot release is unconditional');
});

test('reviewed production quota values are visible and cannot be shadowed by Fly secrets', () => {
  const envExample = fs.readFileSync(path.join(repoRoot, '.env.example'), 'utf8');
  const productionFly = fs.readFileSync(path.join(repoRoot, 'fly.production.toml'), 'utf8');
  const rollbackFly = fs.readFileSync(path.join(repoRoot, 'fly.rollback.production.toml'), 'utf8');
  const secretPreflight = fs.readFileSync(path.join(repoRoot, 'scripts', 'check-production-secrets.mjs'), 'utf8');
  const expected = Object.freeze({
    AI_USAGE_USER_ROLLING_24H_USD: '5',
    AI_USAGE_USER_ROLLING_24H_CALLS: '100',
    AI_USAGE_GLOBAL_MONTHLY_USD: '100',
    AI_USAGE_INVOKE_FAST_ESTIMATE_USD: '0.07',
    AI_USAGE_INVOKE_QUALITY_ESTIMATE_USD: '0.33',
    AI_USAGE_TRANSCRIPTION_ESTIMATE_USD: '3.00',
    AI_USAGE_SOAP_ESTIMATE_USD: '0.33',
    AI_USAGE_DOCUMENT_EXTRACTION_ESTIMATE_USD: '0.20',
    GENERAL_CLINICAL_LLM_MAX_OUTPUT_UNITS: '32768',
  });
  for (const [name, value] of Object.entries(expected)) {
    assert.match(envExample, new RegExp(`^${name}=${value.replace('.', '\\.')}$`, 'm'), `${name} .env.example`);
    assert.match(productionFly, new RegExp(`^\\s*${name}\\s*=\\s*"${value.replace('.', '\\.')}"$`, 'm'), `${name} fly`);
    assert.match(rollbackFly, new RegExp(`^\\s*${name}\\s*=\\s*"${value.replace('.', '\\.')}"$`, 'm'), `${name} rollback`);
    assert.match(secretPreflight, new RegExp(`'${name}'`), `${name} opaque-secret guard`);
  }
});
