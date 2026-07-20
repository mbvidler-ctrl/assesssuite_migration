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
    details: 'Current AI document-extraction acceptance is required.',
  });

  const metadata = sdkErrorLogMetadata(error, { stage: 'extraction' });
  assert.deepEqual(metadata, {
    stage: 'extraction',
    status: 403,
    code: 'acceptance_required',
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
