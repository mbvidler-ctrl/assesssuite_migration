// HTTP surface for the reporting-workflow demo.
//
// A small node:http router in the style of the live shim (server/index.mjs):
// bearer-token principal resolution, bounded JSON bodies, explicit error
// envelopes ({ error, code }) and content-free logging. Static files from the
// built workspace are served when a dist directory exists; in development
// Vite proxies /api to this server.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { WorkflowError } from '../domain/util.mjs';
import { PUBLIC_COMMAND_NAMES } from '../domain/workflow.mjs';

const MAX_BODY_BYTES = 1024 * 1024;
const STATIC_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
});

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(payload);
}

function sendHtml(res, status, html) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
  });
  res.end(html);
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new WorkflowError(413, 'body_too_large', 'The request body exceeds the 1 MiB limit.');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new WorkflowError(400, 'invalid_json', 'The request body must be a JSON object.');
    }
    return parsed;
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    throw new WorkflowError(400, 'invalid_json', 'The request body is not valid JSON.');
  }
}

function bearerToken(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : '';
}

function errorEnvelope(error) {
  if (error instanceof WorkflowError) {
    return { status: error.status, body: { error: error.message, code: error.code, ...(error.detail !== undefined ? { detail: error.detail } : {}) } };
  }
  return { status: 500, body: { error: 'The request could not be completed.', code: 'internal_error' } };
}

export function createDemoHttpServer({ service, staticDir = null, log = console } = {}) {
  if (!service) throw new Error('A reporting service is required.');

  async function handleApi(req, res, url) {
    const { pathname } = url;
    const method = req.method;

    if (pathname === '/api/demo/identities' && method === 'GET') {
      return sendJson(res, 200, { identities: service.listIdentities(), notice: 'Demo identities only. This workspace has no real authentication; it exists to demonstrate role-based admission.' });
    }
    if (pathname === '/api/demo/session' && method === 'POST') {
      const body = await readJsonBody(req);
      const session = service.openSession(String(body.identity_key || ''));
      return sendJson(res, 200, session);
    }
    if (pathname === '/api/reporting/report-types' && method === 'GET') {
      return sendJson(res, 200, { report_types: service.reportTypes() });
    }

    const principal = service.resolvePrincipal(bearerToken(req));
    if (!principal) throw new WorkflowError(401, 'authentication_required', 'Authentication is required.');

    if (pathname === '/api/demo/session' && method === 'GET') {
      return sendJson(res, 200, { principal });
    }
    if (pathname === '/api/reporting/episodes' && method === 'GET') {
      return sendJson(res, 200, { episodes: service.listEpisodes(principal) });
    }
    let match = /^\/api\/reporting\/episodes\/([^/]+)$/.exec(pathname);
    if (match && method === 'GET') {
      return sendJson(res, 200, service.getEpisodeWorkspace(principal, decodeURIComponent(match[1])));
    }
    if (pathname === '/api/reporting/requests' && method === 'GET') {
      return sendJson(res, 200, {
        requests: service.listRequests(principal, {
          status: url.searchParams.get('status') || null,
          episodeId: url.searchParams.get('episode_id') || null,
        }),
      });
    }
    if (pathname === '/api/reporting/requests' && method === 'POST') {
      const body = await readJsonBody(req);
      const result = service.createRequest(principal, body);
      return sendJson(res, result.replayed ? 200 : 201, { request_id: result.request.id, status: result.request.status, version: result.request.version, replayed: result.replayed });
    }
    match = /^\/api\/reporting\/requests\/([^/]+)$/.exec(pathname);
    if (match && method === 'GET') {
      return sendJson(res, 200, service.getRequest(principal, decodeURIComponent(match[1])));
    }
    match = /^\/api\/reporting\/requests\/([^/]+)\/preview$/.exec(pathname);
    if (match && method === 'GET') {
      const preview = service.getPreview(principal, decodeURIComponent(match[1]));
      return sendHtml(res, 200, preview.html);
    }
    match = /^\/api\/reporting\/requests\/([^/]+)\/commands\/([A-Za-z]+)$/.exec(pathname);
    if (match && method === 'POST') {
      const commandName = match[2];
      if (!PUBLIC_COMMAND_NAMES.includes(commandName)) throw new WorkflowError(404, 'unknown_command', `Unknown command ${commandName}.`);
      const body = await readJsonBody(req);
      const result = service.runCommand(principal, decodeURIComponent(match[1]), commandName, body);
      return sendJson(res, 200, {
        request_id: result.request.id,
        status: result.request.status,
        version: result.request.version,
        replayed: result.replayed,
        ...(result.snapshot ? { snapshot_id: result.snapshot.id, content_sha256: result.snapshot.content_sha256 } : {}),
      });
    }
    match = /^\/api\/reporting\/requests\/([^/]+)\/ai\/draft-section$/.exec(pathname);
    if (match && method === 'POST') {
      const body = await readJsonBody(req);
      const result = await service.requestAiSectionDraft(principal, decodeURIComponent(match[1]), body);
      return sendJson(res, 200, { request_id: result.request.id, status: result.request.status, version: result.request.version, replayed: result.replayed });
    }
    match = /^\/api\/reporting\/snapshots\/([^/]+)$/.exec(pathname);
    if (match && method === 'GET') {
      const snapshot = service.getSnapshot(principal, decodeURIComponent(match[1]));
      const { rendered_html: _html, ...rest } = snapshot;
      return sendJson(res, 200, rest);
    }
    match = /^\/api\/reporting\/snapshots\/([^/]+)\/document$/.exec(pathname);
    if (match && method === 'GET') {
      const snapshot = service.getSnapshot(principal, decodeURIComponent(match[1]));
      return sendHtml(res, 200, snapshot.rendered_html);
    }
    if (pathname === '/api/demo/simulate-source-change' && method === 'POST') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, service.simulateSourceChange(principal, body));
    }
    throw new WorkflowError(404, 'not_found', 'Unknown API route.');
  }

  function serveStatic(req, res, url) {
    if (!staticDir || !fs.existsSync(staticDir)) {
      return sendJson(res, 404, { error: 'The demo workspace has not been built. Run the Vite development server or build the workspace.', code: 'workspace_not_built' });
    }
    const requested = path.normalize(decodeURIComponent(url.pathname)).replace(/^([.][.][/\\])+/, '');
    let filePath = path.join(staticDir, requested);
    if (!filePath.startsWith(staticDir)) return sendJson(res, 403, { error: 'Forbidden', code: 'forbidden' });
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(staticDir, 'index.html');
    const type = STATIC_TYPES[path.extname(filePath)] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': content.length, 'Cache-Control': 'no-store' });
    res.end(content);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url);
        return;
      }
      serveStatic(req, res, url);
    } catch (error) {
      const { status, body } = errorEnvelope(error);
      // Expected workflow refusals (including the fail-closed 503 for AI
      // drafting) are part of the contract; only unexpected failures are
      // logged, and never with request content.
      if (!(error instanceof WorkflowError)) log.error('[reporting-demo] request failed:', error);
      sendJson(res, status, body);
    }
  });

  return server;
}

export function listen(server, { port = 0, host = '127.0.0.1' } = {}) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      resolve({ port: address.port, host: address.address, baseUrl: `http://${address.address}:${address.port}` });
    });
  });
}
