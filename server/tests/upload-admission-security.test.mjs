import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { handleCoreIntegration } from '../integrations.mjs';

function deferred() {
  let resolve;
  const promise = new Promise((settle) => { resolve = settle; });
  return { promise, resolve };
}

async function within(promise, label, timeoutMs = 2_000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function syntheticRequest({ held = false } = {}) {
  const gate = deferred();
  const started = deferred();
  const state = { iterated: false, resumed: false };
  const req = {
    headers: { 'content-type': 'application/json' },
    on() { return this; },
    resume() {
      state.resumed = true;
      return this;
    },
    async *[Symbol.asyncIterator]() {
      state.iterated = true;
      started.resolve();
      if (held) await gate.promise;
    },
  };
  return { req, state, started: started.promise, release: gate.resolve };
}

function syntheticResponse() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body) {
      this.body = JSON.parse(body);
    },
  };
}

function invoke(endpointName, request, userId = 'synthetic-upload-user') {
  const response = syntheticResponse();
  const promise = handleCoreIntegration(request.req, response, {
    endpointName,
    orgIds: [],
    sessionUser: {
      id: userId,
      email: `${userId}@example.test`,
      account_status: 'active',
    },
  });
  return { promise, response };
}

test('UploadFile admission is acquired before buffering, rejects without retaining, and always releases', { concurrency: false, timeout: 5_000 }, async () => {
  const held = [syntheticRequest({ held: true }), syntheticRequest({ held: true })];
  const active = [
    invoke('UploadFile', held[0], 'synthetic-user-a'),
    invoke('UploadFile', held[1], 'synthetic-user-b'),
  ];
  try {
    await within(Promise.all(held.map((request) => request.started)), 'distinct-user upload admission');

    const nonUpload = syntheticRequest();
    const nonUploadInvocation = invoke('GenerateImage', nonUpload, 'synthetic-user-a');
    await nonUploadInvocation.promise;
    assert.equal(nonUploadInvocation.response.statusCode, 200);
    assert.equal(nonUpload.state.iterated, true);

    const globallyRejected = syntheticRequest();
    const globalRejection = invoke('UploadFile', globallyRejected, 'synthetic-user-c');
    await globalRejection.promise;
    assert.equal(globalRejection.response.statusCode, 429);
    assert.equal(globalRejection.response.body?.code, 'upload_capacity_exceeded');
    assert.equal(globalRejection.response.body?.stage, 'upload_request');
    assert.equal(globallyRejected.state.resumed, true);
    assert.equal(globallyRejected.state.iterated, false);
  } finally {
    for (const request of held) request.release();
    await within(Promise.all(active.map(({ promise }) => promise)), 'admitted upload release');
  }

  const afterRelease = syntheticRequest();
  const afterReleaseInvocation = invoke('UploadFile', afterRelease);
  await afterReleaseInvocation.promise;
  assert.equal(afterRelease.state.iterated, true);
  assert.equal(afterReleaseInvocation.response.statusCode, 400);
  assert.equal(afterReleaseInvocation.response.body?.code, 'org_required');
});

test('UploadFile admission permits only one buffered request per session user', { concurrency: false, timeout: 5_000 }, async () => {
  const held = syntheticRequest({ held: true });
  const active = invoke('UploadFile', held, 'synthetic-same-user');
  try {
    await within(held.started, 'per-user upload admission');
    const rejected = syntheticRequest();
    const rejection = invoke('UploadFile', rejected, 'synthetic-same-user');
    await rejection.promise;
    assert.equal(rejection.response.statusCode, 429);
    assert.equal(rejection.response.body?.code, 'upload_capacity_exceeded');
    assert.equal(rejected.state.resumed, true);
    assert.equal(rejected.state.iterated, false);
  } finally {
    held.release();
    await within(active.promise, 'per-user upload release');
  }
});

test('UploadFile admission contract remains scoped before request parsing with finally release', () => {
  const source = fs.readFileSync(new URL('../integrations.mjs', import.meta.url), 'utf8');
  const dispatchStart = source.indexOf('export async function handleCoreIntegration');
  const dispatch = source.slice(dispatchStart);
  const scopedAcquire = dispatch.indexOf("if (endpointName === 'UploadFile')");
  const parse = dispatch.indexOf('await parseIntegrationBody(req, endpointName)');
  const finalRelease = dispatch.indexOf('finally {\n    releaseUploadAdmission?.();');

  assert.ok(dispatchStart >= 0);
  assert.ok(scopedAcquire >= 0 && scopedAcquire < parse);
  assert.ok(parse >= 0);
  assert.ok(finalRelease > parse);
  assert.match(source, /MAX_CONCURRENT_UPLOAD_REQUESTS = 2/);
  assert.match(source, /MAX_CONCURRENT_UPLOAD_REQUESTS_PER_USER = 1/);
  assert.match(source, /activeUploadRequests >= MAX_CONCURRENT_UPLOAD_REQUESTS[\s\S]*?activeForUser >= MAX_CONCURRENT_UPLOAD_REQUESTS_PER_USER[\s\S]*?req\.resume\(\)[\s\S]*?upload_capacity_exceeded/);
});
