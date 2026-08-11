// Durable, content-free accounting for paid AI provider calls.
//
// A reservation is written before provider egress. Successful calls replace
// the conservative estimate with provider-reported usage; failed or
// interrupted calls retain the estimate so retries cannot become a spending
// bypass. Local failures before provider contact are explicitly cancelled.

import { createHash, randomUUID } from 'node:crypto';

const MICROUSD_PER_USD = 1_000_000;
const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;

export const API_USAGE_FEATURES = Object.freeze([
  'invoke_llm',
  'transcription',
  'soap_dissection',
  'document_extraction',
]);

export const OPENAI_PRICE_REGISTRY = Object.freeze({
  'gpt-4.1-mini': Object.freeze({
    kind: 'chat', inputUsdPerMillion: 0.4, cachedInputUsdPerMillion: 0.1, outputUsdPerMillion: 1.6,
  }),
  'gpt-4.1-mini-2025-04-14': Object.freeze({
    kind: 'chat', inputUsdPerMillion: 0.4, cachedInputUsdPerMillion: 0.1, outputUsdPerMillion: 1.6,
  }),
  'gpt-4.1': Object.freeze({
    kind: 'chat', inputUsdPerMillion: 2, cachedInputUsdPerMillion: 0.5, outputUsdPerMillion: 8,
  }),
  'gpt-4.1-2025-04-14': Object.freeze({
    kind: 'chat', inputUsdPerMillion: 2, cachedInputUsdPerMillion: 0.5, outputUsdPerMillion: 8,
  }),
  'whisper-1': Object.freeze({ kind: 'audio', usdPerMinute: 0.006 }),
});

const DEFAULTS = Object.freeze({
  userRolling24hMicrousd: 5 * MICROUSD_PER_USD,
  // This is the hard API-use ceiling. Dollar admission uses conservative
  // reservations and then replaces them with provider-reported actual cost.
  userRolling24hCalls: 100,
  globalMonthlyMicrousd: 100 * MICROUSD_PER_USD,
  invokeFastEstimateMicrousd: 70_000,
  invokeQualityEstimateMicrousd: 330_000,
  transcriptionEstimateMicrousd: 3_000_000,
  soapEstimateMicrousd: 330_000,
  documentExtractionEstimateMicrousd: 200_000,
});

export class ApiUsageError extends Error {
  constructor(status, code, publicMessage, details = {}) {
    super(publicMessage);
    this.name = 'ApiUsageError';
    this.httpStatus = status;
    this.code = code;
    this.publicMessage = publicMessage;
    if (details.resetsAt) this.resetsAt = details.resetsAt;
    if (Number.isInteger(details.retryAfterSeconds)) this.retryAfterSeconds = details.retryAfterSeconds;
  }
}

function boundedInteger(raw, fallback, { min, max }) {
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < min) return fallback;
  return Math.min(parsed, max);
}

function boundedUsdAsMicrousd(raw, fallback, { min = 0.01, max = 1_000 } = {}) {
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.round(Math.min(parsed, max) * MICROUSD_PER_USD);
}

function loadConfig(environment) {
  return Object.freeze({
    userRolling24hMicrousd: boundedUsdAsMicrousd(
      environment.AI_USAGE_USER_ROLLING_24H_USD,
      DEFAULTS.userRolling24hMicrousd,
      { max: 50 },
    ),
    userRolling24hCalls: boundedInteger(
      environment.AI_USAGE_USER_ROLLING_24H_CALLS,
      DEFAULTS.userRolling24hCalls,
      { min: 1, max: 1_000 },
    ),
    globalMonthlyMicrousd: boundedUsdAsMicrousd(
      environment.AI_USAGE_GLOBAL_MONTHLY_USD,
      DEFAULTS.globalMonthlyMicrousd,
      { max: 1_000 },
    ),
  });
}

function loadEstimates(environment) {
  return Object.freeze({
    invokeFastMicrousd: boundedUsdAsMicrousd(
      environment.AI_USAGE_INVOKE_FAST_ESTIMATE_USD,
      DEFAULTS.invokeFastEstimateMicrousd,
      { min: 0.001, max: 1 },
    ),
    invokeQualityMicrousd: boundedUsdAsMicrousd(
      environment.AI_USAGE_INVOKE_QUALITY_ESTIMATE_USD,
      DEFAULTS.invokeQualityEstimateMicrousd,
      { min: 0.001, max: 2 },
    ),
    transcriptionMicrousd: boundedUsdAsMicrousd(
      environment.AI_USAGE_TRANSCRIPTION_ESTIMATE_USD,
      DEFAULTS.transcriptionEstimateMicrousd,
      { min: 0.001, max: 5 },
    ),
    soapMicrousd: boundedUsdAsMicrousd(
      environment.AI_USAGE_SOAP_ESTIMATE_USD,
      DEFAULTS.soapEstimateMicrousd,
      { min: 0.001, max: 2 },
    ),
    documentExtractionMicrousd: boundedUsdAsMicrousd(
      environment.AI_USAGE_DOCUMENT_EXTRACTION_ESTIMATE_USD,
      DEFAULTS.documentExtractionEstimateMicrousd,
      { min: 0.001, max: 2 },
    ),
  });
}

function accountingUnavailable(cause) {
  const error = new ApiUsageError(
    503,
    'api_usage_accounting_unavailable',
    'AI usage accounting is temporarily unavailable. Please try again.',
  );
  error.cause = cause;
  return error;
}

function assertIdentifier(value, label, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > 200) {
    throw accountingUnavailable(new Error(`${label} is invalid`));
  }
  return value.trim();
}

function nonNegativeInteger(value, label, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined)) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw accountingUnavailable(new Error(`${label} is invalid`));
  }
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw accountingUnavailable(new Error(`${label} is invalid`));
  }
  return value;
}

function modelPrice(model, expectedKind, environment = process.env) {
  const selected = assertIdentifier(model, 'model');
  const price = OPENAI_PRICE_REGISTRY[selected] || (
    environment.SELFTEST === '1' && /^synthetic-[a-z0-9_-]+$/i.test(selected)
      ? OPENAI_PRICE_REGISTRY['gpt-4.1-mini-2025-04-14']
      : null
  );
  if (!price || (expectedKind && price.kind !== expectedKind)) {
    throw new ApiUsageError(
      503,
      'ai_usage_model_unpriced',
      'The selected AI model does not have an approved usage price.',
    );
  }
  return price;
}

export function calculateChatCostMicrousd({ model, inputTokens, cachedInputTokens = 0, outputTokens }) {
  const price = modelPrice(model, 'chat');
  if (!Number.isSafeInteger(inputTokens) || inputTokens < 0) return null;
  if (
    !Number.isSafeInteger(cachedInputTokens) ||
    cachedInputTokens < 0 ||
    cachedInputTokens > inputTokens
  ) return null;
  if (!Number.isSafeInteger(outputTokens) || outputTokens < 0) return null;
  const uncachedInputTokens = inputTokens - cachedInputTokens;
  const inputCost =
    uncachedInputTokens * price.inputUsdPerMillion +
    cachedInputTokens * price.cachedInputUsdPerMillion;
  const outputCost = outputTokens * price.outputUsdPerMillion;
  return Math.ceil(inputCost + outputCost);
}

export function calculateTranscriptionCostMicrousd({ model, audioSeconds }) {
  const price = modelPrice(model, 'audio');
  if (!Number.isFinite(audioSeconds) || audioSeconds < 0) return null;
  return Math.ceil((audioSeconds / 60) * price.usdPerMinute * MICROUSD_PER_USD);
}

export function ensureApiUsageSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_usage_reservation (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      org_id TEXT,
      provider TEXT NOT NULL CHECK (provider IN ('openai')),
      feature TEXT NOT NULL CHECK (
        feature IN ('invoke_llm', 'transcription', 'soap_dissection', 'document_extraction')
      ),
      model TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('reserved', 'succeeded', 'failed', 'cancelled')),
      estimated_cost_microusd INTEGER NOT NULL CHECK (estimated_cost_microusd >= 0),
      actual_cost_microusd INTEGER CHECK (actual_cost_microusd IS NULL OR actual_cost_microusd >= 0),
      request_units INTEGER NOT NULL DEFAULT 1 CHECK (request_units > 0),
      input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
      cached_input_tokens INTEGER CHECK (cached_input_tokens IS NULL OR cached_input_tokens >= 0),
      output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
      audio_seconds INTEGER CHECK (audio_seconds IS NULL OR audio_seconds >= 0),
      provider_request_id_hash TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_api_usage_user_created
      ON api_usage_reservation (user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_api_usage_org_created
      ON api_usage_reservation (org_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_api_usage_feature_created
      ON api_usage_reservation (feature, created_at);
    CREATE INDEX IF NOT EXISTS idx_api_usage_created
      ON api_usage_reservation (created_at);
  `);
  const columns = new Set(
    db.prepare("PRAGMA table_info('api_usage_reservation')").all().map((column) => column.name),
  );
  if (!columns.has('cached_input_tokens')) {
    db.exec(`
      ALTER TABLE api_usage_reservation
      ADD COLUMN cached_input_tokens INTEGER
        CHECK (cached_input_tokens IS NULL OR cached_input_tokens >= 0);
    `);
  }
}

function usageCostExpression() {
  return `CASE
    WHEN status = 'cancelled' THEN 0
    WHEN actual_cost_microusd IS NOT NULL THEN actual_cost_microusd
    ELSE estimated_cost_microusd
  END`;
}

function usageUnitsExpression() {
  return `CASE WHEN status = 'cancelled' THEN 0 ELSE request_units END`;
}

function nextUtcMonth(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

function retryDetails(resetDate, now) {
  return {
    resetsAt: resetDate.toISOString(),
    retryAfterSeconds: Math.max(1, Math.ceil((resetDate.getTime() - now.getTime()) / 1000)),
  };
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    orgId: row.org_id,
    provider: row.provider,
    feature: row.feature,
    model: row.model,
    status: row.status,
    estimatedCostMicrousd: Number(row.estimated_cost_microusd),
    actualCostMicrousd: row.actual_cost_microusd === null ? null : Number(row.actual_cost_microusd),
    requestUnits: Number(row.request_units),
    inputTokens: row.input_tokens === null ? null : Number(row.input_tokens),
    cachedInputTokens: row.cached_input_tokens === null ? null : Number(row.cached_input_tokens),
    outputTokens: row.output_tokens === null ? null : Number(row.output_tokens),
    audioSeconds: row.audio_seconds === null ? null : Number(row.audio_seconds),
    providerRequestIdHash: row.provider_request_id_hash,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function createApiUsageService(
  db,
  {
    clock = () => new Date(),
    environment = process.env,
    idFactory = randomUUID,
  } = {},
) {
  if (!db || typeof db.prepare !== 'function' || typeof db.exec !== 'function') {
    throw accountingUnavailable(new Error('database handle is unavailable'));
  }

  const config = loadConfig(environment);
  const estimates = loadEstimates(environment);

  function reserve({
    userId,
    orgId = null,
    provider = 'openai',
    feature,
    model,
    estimatedCostMicrousd,
    requestUnits = 1,
  }) {
    const safeUserId = assertIdentifier(userId, 'userId');
    const safeOrgId = assertIdentifier(orgId, 'orgId', { nullable: true });
    const safeProvider = assertIdentifier(provider, 'provider');
    const safeFeature = assertIdentifier(feature, 'feature');
    const safeModel = assertIdentifier(model, 'model');
    if (safeProvider !== 'openai' || !API_USAGE_FEATURES.includes(safeFeature)) {
      throw accountingUnavailable(new Error('provider or feature is invalid'));
    }
    modelPrice(safeModel, safeFeature === 'transcription' ? 'audio' : 'chat', environment);
    const safeEstimate = nonNegativeInteger(estimatedCostMicrousd, 'estimatedCostMicrousd');
    const safeRequestUnits = positiveInteger(requestUnits, 'requestUnits');
    const now = new Date(clock());
    if (Number.isNaN(now.getTime())) throw accountingUnavailable(new Error('clock returned an invalid date'));
    const nowIso = now.toISOString();
    const rollingCutoff = new Date(now.getTime() - ROLLING_WINDOW_MS).toISOString();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const id = assertIdentifier(idFactory(), 'reservation id');

    try {
      db.exec('BEGIN IMMEDIATE');
      const userUsage = db.prepare(`
        SELECT
          COALESCE(SUM(${usageCostExpression()}), 0) AS cost_microusd,
          COALESCE(SUM(${usageUnitsExpression()}), 0) AS request_units,
          MIN(CASE WHEN status <> 'cancelled' THEN created_at END) AS earliest_created_at
        FROM api_usage_reservation
        WHERE user_id = ? AND created_at >= ?
      `).get(safeUserId, rollingCutoff);

      const globalUsage = db.prepare(`
        SELECT COALESCE(SUM(${usageCostExpression()}), 0) AS cost_microusd
        FROM api_usage_reservation
        WHERE created_at >= ?
      `).get(monthStart);

      const projectedUserCost = Number(userUsage.cost_microusd) + safeEstimate;
      const projectedUserCalls = Number(userUsage.request_units) + safeRequestUnits;
      const projectedGlobalCost = Number(globalUsage.cost_microusd) + safeEstimate;
      if (
        projectedUserCost > config.userRolling24hMicrousd ||
        projectedUserCalls > config.userRolling24hCalls
      ) {
        db.exec('ROLLBACK');
        const earliest = userUsage.earliest_created_at
          ? new Date(new Date(userUsage.earliest_created_at).getTime() + ROLLING_WINDOW_MS)
          : new Date(now.getTime() + ROLLING_WINDOW_MS);
        throw new ApiUsageError(
          429,
          'api_usage_cap_reached',
          'Daily AI usage limit reached. Try again after the reset time.',
          retryDetails(earliest, now),
        );
      }
      if (projectedGlobalCost > config.globalMonthlyMicrousd) {
        db.exec('ROLLBACK');
        throw new ApiUsageError(
          503,
          'api_usage_global_cap_reached',
          'AI generation is temporarily unavailable because its monthly usage limit was reached.',
          retryDetails(nextUtcMonth(now), now),
        );
      }

      db.prepare(`
        INSERT INTO api_usage_reservation (
          id, user_id, org_id, provider, feature, model, status,
          estimated_cost_microusd, actual_cost_microusd, request_units,
          input_tokens, cached_input_tokens, output_tokens, audio_seconds,
          provider_request_id_hash, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'reserved', ?, NULL, ?, NULL, NULL, NULL, NULL, NULL, ?, NULL)
      `).run(
        id,
        safeUserId,
        safeOrgId,
        safeProvider,
        safeFeature,
        safeModel,
        safeEstimate,
        safeRequestUnits,
        nowIso,
      );
      db.exec('COMMIT');
      return normalizeRow(db.prepare('SELECT * FROM api_usage_reservation WHERE id = ?').get(id));
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch { /* transaction was already closed */ }
      if (error instanceof ApiUsageError) throw error;
      throw accountingUnavailable(error);
    }
  }

  function settle({
    reservationId,
    status,
    actualCostMicrousd = null,
    inputTokens = null,
    cachedInputTokens = null,
    outputTokens = null,
    audioSeconds = null,
    providerRequestId = null,
    providerRequestIdHash = null,
  }) {
    const id = assertIdentifier(reservationId, 'reservationId');
    if (!['succeeded', 'failed'].includes(status)) {
      throw accountingUnavailable(new Error('settlement status is invalid'));
    }
    const safeActualCost = nonNegativeInteger(actualCostMicrousd, 'actualCostMicrousd', { nullable: true });
    const safeInputTokens = nonNegativeInteger(inputTokens, 'inputTokens', { nullable: true });
    const safeCachedInputTokens = nonNegativeInteger(cachedInputTokens, 'cachedInputTokens', { nullable: true });
    if (
      safeCachedInputTokens !== null &&
      (safeInputTokens === null || safeCachedInputTokens > safeInputTokens)
    ) {
      throw accountingUnavailable(new Error('cachedInputTokens is invalid'));
    }
    const safeOutputTokens = nonNegativeInteger(outputTokens, 'outputTokens', { nullable: true });
    const safeAudioSeconds = audioSeconds === null || audioSeconds === undefined
      ? null
      : Math.max(0, Math.ceil(Number(audioSeconds)));
    if (safeAudioSeconds !== null && !Number.isSafeInteger(safeAudioSeconds)) {
      throw accountingUnavailable(new Error('audioSeconds is invalid'));
    }
    let requestHash = null;
    if (typeof providerRequestIdHash === 'string' && /^[a-f0-9]{64}$/i.test(providerRequestIdHash)) {
      requestHash = providerRequestIdHash.toLowerCase();
    } else if (typeof providerRequestId === 'string' && providerRequestId) {
      requestHash = createHash('sha256').update(providerRequestId).digest('hex');
    }
    const completedAt = new Date(clock()).toISOString();
    try {
      const result = db.prepare(`
        UPDATE api_usage_reservation
        SET status = ?, actual_cost_microusd = ?, input_tokens = ?, cached_input_tokens = ?, output_tokens = ?,
            audio_seconds = ?, provider_request_id_hash = ?, completed_at = ?
        WHERE id = ? AND status = 'reserved'
      `).run(
        status,
        safeActualCost,
        safeInputTokens,
        safeCachedInputTokens,
        safeOutputTokens,
        safeAudioSeconds,
        requestHash,
        completedAt,
        id,
      );
      if (Number(result.changes) !== 1) {
        throw new Error('usage reservation is missing or already finalized');
      }
      return normalizeRow(db.prepare('SELECT * FROM api_usage_reservation WHERE id = ?').get(id));
    } catch (error) {
      if (error instanceof ApiUsageError) throw error;
      throw accountingUnavailable(error);
    }
  }

  function cancel({ reservationId }) {
    const id = assertIdentifier(reservationId, 'reservationId');
    const completedAt = new Date(clock()).toISOString();
    try {
      const result = db.prepare(`
        UPDATE api_usage_reservation
        SET status = 'cancelled', actual_cost_microusd = 0, completed_at = ?
        WHERE id = ? AND status = 'reserved'
      `).run(completedAt, id);
      if (Number(result.changes) !== 1) {
        throw new Error('usage reservation is missing or already finalized');
      }
      return normalizeRow(db.prepare('SELECT * FROM api_usage_reservation WHERE id = ?').get(id));
    } catch (error) {
      throw accountingUnavailable(error);
    }
  }

  function estimateChatMicrousd({ model, feature = 'invoke_llm' }) {
    const price = modelPrice(model, 'chat', environment);
    if (feature === 'soap_dissection') return estimates.soapMicrousd;
    return price.inputUsdPerMillion >= 2
      ? estimates.invokeQualityMicrousd
      : estimates.invokeFastMicrousd;
  }

  function bindUser({ userId, orgId = null }) {
    const safeUserId = assertIdentifier(userId, 'userId');
    const defaultOrgId = assertIdentifier(orgId, 'orgId', { nullable: true });
    return Object.freeze({
      config,
      estimates,
      reserve: (input) => reserve({ ...input, userId: safeUserId, orgId: input?.orgId ?? defaultOrgId }),
      settle,
      cancel,
      estimateChatMicrousd,
      calculateChatCostMicrousd,
      calculateTranscriptionCostMicrousd,
    });
  }

  return Object.freeze({
    config,
    estimates,
    reserve,
    settle,
    cancel,
    bindUser,
    estimateChatMicrousd,
    calculateChatCostMicrousd,
    calculateTranscriptionCostMicrousd,
  });
}
