import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { startTestServer } from './support/server-harness.mjs';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const distDir = path.join(repoRoot, 'dist');
const indexPath = path.join(distDir, 'index.html');

function rawGet(baseUrl, requestPath) {
  const target = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const request = http.get({
      hostname: target.hostname,
      port: target.port,
      path: requestPath,
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        contentType: response.headers['content-type'] ?? '',
        text: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.on('error', reject);
  });
}

test('static assets fail closed while application history routes retain the SPA fallback', async (t) => {
  assert.equal(
    fs.existsSync(indexPath),
    true,
    'dist/index.html must exist; build the authenticated platform before this assurance suite',
  );

  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  const scriptMatch = indexHtml.match(/<script[^>]+src="(\/assets\/[^"?]+\.js)"/u);
  assert.ok(scriptMatch, 'the authenticated platform build must emit a JavaScript asset under /assets/');
  const emittedScriptRoute = scriptMatch[1];
  const emittedMapRoute = `${emittedScriptRoute}.map`;
  assert.equal(
    fs.existsSync(path.join(distDir, emittedMapRoute)),
    true,
    'the local platform build must retain its private-upload source map so the server denial is exercised',
  );

  const server = await startTestServer();
  t.after(async () => server.stop());

  for (const route of [
    `${emittedMapRoute}?cache=1`,
    '/assets/definitely-missing.css',
  ]) {
    const response = await fetch(`${server.baseUrl}${route}`);
    assert.equal(response.status, 404, `${route} must not fall through to the SPA shell`);
    assert.match(response.headers.get('content-type') ?? '', /^application\/json\b/u);
    assert.deepEqual(await response.json(), { message: 'not found' });
  }

  for (const route of [
    '/assets%2F..%2Findex.html',
    '/assets/%2E%2E/index.html',
    '/assets%5C..%5Cindex.html',
  ]) {
    const response = await rawGet(server.baseUrl, route);
    assert.equal(response.status, 404, `${route} must not escape the asset namespace`);
    assert.match(response.contentType, /^application\/json\b/u);
    assert.deepEqual(JSON.parse(response.text), { message: 'not found' });
  }

  const malformedPathResponse = await rawGet(server.baseUrl, '/assets/%zz');
  assert.equal(malformedPathResponse.status, 400, 'malformed path encoding must not become a server error');
  assert.deepEqual(JSON.parse(malformedPathResponse.text), { message: 'invalid path' });

  for (const route of ['/Dashboard', '/legal/privacy']) {
    const response = await fetch(`${server.baseUrl}${route}`);
    assert.equal(response.status, 200, `${route} must retain the SPA history fallback`);
    assert.match(response.headers.get('content-type') ?? '', /^text\/html\b/u);
    assert.equal(await response.text(), indexHtml);
  }

  const assetResponse = await fetch(`${server.baseUrl}${emittedScriptRoute}`);
  assert.equal(assetResponse.status, 200, 'an emitted platform asset must still be served directly');
  assert.match(assetResponse.headers.get('content-type') ?? '', /javascript/u);
  assert.ok((await assetResponse.arrayBuffer()).byteLength > 0);

  const uploadResponse = await fetch(`${server.baseUrl}/uploads/legacy.report.pdf`);
  assert.equal(uploadResponse.status, 401, 'dotted upload routes must retain authentication dispatch');
  assert.deepEqual(await uploadResponse.json(), { message: 'authentication required' });

  const versionResponse = await fetch(`${server.baseUrl}/api/version`);
  assert.equal(versionResponse.status, 200, 'the version API must retain its explicit handler');
  assert.match(versionResponse.headers.get('content-type') ?? '', /^application\/json\b/u);
  const version = await versionResponse.json();
  assert.equal(typeof version.release_sha, 'string');
  assert.equal(typeof version.build_timestamp, 'string');
});
