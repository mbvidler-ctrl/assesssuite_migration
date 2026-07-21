import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  buildResponsesRequest,
  prepareExtractionSchema,
  resolveDocumentExtractionModel,
} from '../documentExtraction.mjs';
import { REFERRAL_EXTRACTION_SCHEMA } from '../../src/lib/referralExtractionSchema.js';

test('document extraction is pinned to the reviewed OpenAI model snapshot', () => {
  const priorOverride = process.env.OPENAI_DOCUMENT_EXTRACTION_MODEL;
  const priorSelftest = process.env.SELFTEST;
  const priorNodeEnv = process.env.NODE_ENV;
  try {
    delete process.env.OPENAI_DOCUMENT_EXTRACTION_MODEL;
    delete process.env.SELFTEST;
    delete process.env.NODE_ENV;
    const model = resolveDocumentExtractionModel();
    assert.equal(model, 'gpt-4.1-mini-2025-04-14');

    const prepared = prepareExtractionSchema(REFERRAL_EXTRACTION_SCHEMA);
    const bytes = Buffer.from('%PDF-1.4 synthetic');
    const payload = buildResponsesRequest({
      files: [{
        upload: {
          byteSize: bytes.length,
          detectedMime: 'application/pdf',
          sha256: createHash('sha256').update(bytes).digest('hex'),
          storedName: 'synthetic.pdf',
        },
        buffer: bytes,
      }],
      sourceSchema: prepared.sourceSchema,
      providerSchema: prepared.providerSchema,
      model,
    });
    assert.equal(payload.model, 'gpt-4.1-mini-2025-04-14');
  } finally {
    if (priorOverride === undefined) delete process.env.OPENAI_DOCUMENT_EXTRACTION_MODEL;
    else process.env.OPENAI_DOCUMENT_EXTRACTION_MODEL = priorOverride;
    if (priorSelftest === undefined) delete process.env.SELFTEST;
    else process.env.SELFTEST = priorSelftest;
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorNodeEnv;
  }
});
