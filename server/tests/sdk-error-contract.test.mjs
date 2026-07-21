import assert from 'node:assert/strict';
import test from 'node:test';

import { Base44Error } from '@base44/sdk/dist/utils/axios-client.js';
import { normalizeSdkError, sdkErrorLogMetadata } from '../../src/lib/sdkError.js';

test('normalizes the installed Base44Error shape without exposing its original request', () => {
  const originalError = {
    config: { data: 'synthetic referral content that must not be logged' },
    response: {
      status: 403,
      data: {
        details: 'Current AI document-extraction acceptance is required.',
        submitted_name: 'Synthetic Patient',
      },
    },
  };
  const error = new Base44Error(
    'Request failed with status code 403',
    403,
    'acceptance_required',
    originalError.response.data,
    originalError,
  );

  assert.deepEqual(normalizeSdkError(error, {
    stage: 'extraction',
    fallbackDetails: 'Extraction failed.',
  }), {
    stage: 'extraction',
    status: 403,
    code: 'acceptance_required',
    diagnosticReference: null,
    details: 'Current AI document-extraction acceptance is required.',
  });

  const metadata = sdkErrorLogMetadata(error, { stage: 'extraction' });
  assert.deepEqual(metadata, {
    stage: 'extraction',
    status: 403,
    code: 'acceptance_required',
    diagnosticReference: null,
  });
  assert.equal(JSON.stringify(metadata).includes('Synthetic Patient'), false);
  assert.equal(JSON.stringify(metadata).includes('synthetic referral content'), false);
});

test('supports the migration upload error field and Axios fallback shape', () => {
  assert.deepEqual(normalizeSdkError({
    response: {
      status: 422,
      data: {
        code: 'file_invalid',
        error: 'Upload a PDF, PNG, JPG or CSV document.',
        ignored_payload: 'Synthetic Patient',
      },
    },
  }, { stage: 'upload' }), {
    stage: 'upload',
    status: 422,
    code: 'file_invalid',
    diagnosticReference: null,
    details: 'Upload a PDF, PNG, JPG or CSV document.',
  });
});

test('uses a controlled fallback instead of an untrusted thrown message', () => {
  const normalized = normalizeSdkError({
    message: 'Internal failure mentioning Synthetic Patient',
    code: 'not a safe token',
  }, {
    stage: 'referral extraction',
    fallbackDetails: 'The referral could not be processed. No client data was changed.',
  });

  assert.deepEqual(normalized, {
    stage: 'request',
    status: null,
    code: 'request_failed',
    diagnosticReference: null,
    details: 'The referral could not be processed. No client data was changed.',
  });
  assert.equal(JSON.stringify(normalized).includes('Synthetic Patient'), false);
});

test('sanitizes server-controlled public details before display', () => {
  const normalized = normalizeSdkError({
    status: 502,
    data: { detail: '  Provider\n\trequest\u0000 failed.  ' },
  }, { stage: 'extraction' });

  assert.equal(normalized.details, 'Provider request failed.');
  assert.equal(normalized.code, 'http_502');
});

test('accepts only UUIDv4 diagnostic references from controlled response shapes', () => {
  const reference = '38b4329d-4674-4ff2-a3bb-e231b45676ac';
  assert.equal(normalizeSdkError({
    status: 409,
    data: {
      code: 'processing_authority_required',
      details: 'Confirm authority before extraction.',
      diagnostic_reference: reference,
    },
  }).diagnosticReference, reference);
  assert.equal(normalizeSdkError({
    status: 409,
    data: { diagnostic_reference: 'not-a-safe-reference' },
  }).diagnosticReference, null);
});
