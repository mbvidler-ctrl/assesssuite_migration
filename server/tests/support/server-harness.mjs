import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const supportDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(supportDir, '..', '..', '..');
const serverEntry = path.join(repoRoot, 'server', 'index.mjs');
const IMAGE_DIGEST_RE = /^[^\s@]+@sha256:[0-9a-f]{64}$/i;

export function assertImmutableImageReference(image, label = 'compatibility image') {
  if (typeof image !== 'string' || !IMAGE_DIGEST_RE.test(image.trim())) {
    throw new Error(`${label} must be an immutable sha256 digest reference`);
  }
  return image.trim();
}

/**
 * A caller-owned SQLite/uploads root that can survive several server
 * processes. Ordinary startTestServer() callers still receive an isolated
 * store that is removed automatically on stop.
 */
export function createTestStore(prefix = 'assesssuite-assurance-shared-') {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const uploadsDir = path.join(tempRoot, 'uploads');
  const dbPath = path.join(tempRoot, 'assurance.db');
  fs.mkdirSync(uploadsDir, { recursive: true });
  let removed = false;
  return {
    tempRoot,
    uploadsDir,
    dbPath,
    cleanup() {
      if (removed) return;
      removed = true;
      fs.rmSync(tempRoot, { recursive: true, force: true });
    },
  };
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.on('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      socket.close(() => resolve(address.port));
    });
  });
}

async function waitForServer(baseUrl, timeoutMs = 15_000, signal = null) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !signal?.aborted) {
    try {
      const response = await fetch(
        `${baseUrl}/api/apps/public/prod/public-settings/by-id/assurance-probe`,
        { signal },
      );
      if (response.status === 200) return;
    } catch {
      // The child has not bound its port yet.
    }
    if (signal?.aborted) return;
    await new Promise((resolve) => {
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, 100);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
  if (signal?.aborted) return;
  throw new Error('assurance server did not become ready before timeout');
}

async function terminateChild(child) {
  if (child.exitCode !== null) return;
  const exited = once(child, 'exit').catch(() => {});
  child.kill();
  await exited;
}

async function runControlCommand(command, args) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const [code] = await Promise.race([
    once(child, 'exit'),
    once(child, 'error').then(([error]) => { throw error; }),
  ]);
  return { code, output };
}

async function terminateContainer(child, { cli, name }) {
  if (child.exitCode !== null || !child.pid) return;
  const exited = once(child, 'exit').catch(() => {});
  await runControlCommand(cli, ['stop', '--time', '5', name]).catch(() => {});
  await exited;
}

/**
 * Starts the loopback-only shim either from this checkout or from an exact
 * container image. A supplied store is never removed by stop(); this is the
 * narrow preservation mechanism used by forward -> rollback -> forward
 * compatibility tests. Container mode deliberately requires an immutable
 * digest and host networking so both the app and synthetic provider remain
 * on 127.0.0.1.
 */
export async function startTestServer(extraEnv = {}, options = {}) {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const suppliedStore = options.store || null;
  const store = suppliedStore || createTestStore('assesssuite-assurance-');
  const { tempRoot, uploadsDir, dbPath } = store;
  fs.mkdirSync(uploadsDir, { recursive: true });
  const selftest = options.selftest === undefined ? true : Boolean(options.selftest);
  const image = options.image
    ? assertImmutableImageReference(options.image, options.imageLabel || 'compatibility image')
    : null;

  const controlledEnvironment = {
    SELFTEST: selftest ? '1' : '0',
    NODE_ENV: 'test',
    ASSESSSUITE_DB_PATH_ACK: 'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE',
    PORT: String(port),
    ADMIN_EMAIL: 'admin@local.test',
    ADMIN_PASSWORD: 'change-me-local',
    UPLOADS_DIR: uploadsDir,
    ...extraEnv,
    ASSESSSUITE_BIND_HOST: '127.0.0.1',
    ASSESSSUITE_DB_PATH: dbPath,
  };

  let child;
  let container = null;
  if (image) {
    const cli = process.env.COMPATIBILITY_CONTAINER_CLI || 'docker';
    const name = `assesssuite-compat-${randomUUID()}`;
    const containerDataDir = '/app/server/data/compatibility-proof';
    const containerEnvironment = {
      ...controlledEnvironment,
      UPLOADS_DIR: `${containerDataDir}/uploads`,
      ASSESSSUITE_DB_PATH: `${containerDataDir}/${path.basename(dbPath)}`,
    };
    const args = [
      'run', '--rm', '--name', name,
      '--network', 'host',
      '--mount', `type=bind,source=${tempRoot},target=${containerDataDir}`,
    ];
    for (const [key, value] of Object.entries(containerEnvironment)) {
      args.push('--env', `${key}=${value ?? ''}`);
    }
    args.push(image, 'node', 'server/index.mjs');
    child = spawn(cli, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    container = { cli, name };
  } else {
    child = spawn(process.execPath, [serverEntry], {
      cwd: repoRoot,
      env: { ...process.env, ...controlledEnvironment },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  try {
    const readinessAbort = new AbortController();
    const earlyExit = once(child, 'exit').then(([code]) => {
      throw new Error(`assurance server exited before readiness (code ${code})\nServer output:\n${output}`);
    });
    const earlyError = once(child, 'error').then(([error]) => {
      throw new Error(`assurance server process failed to start: ${error.message}`);
    });
    try {
      await Promise.race([
        waitForServer(baseUrl, options.startupTimeoutMs || 15_000, readinessAbort.signal),
        earlyExit,
        earlyError,
      ]);
    } finally {
      readinessAbort.abort();
    }
    const expectedListener = `[shim] listening on http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 100 && !output.split(/\r?\n/).includes(expectedListener); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (!output.split(/\r?\n/).includes(expectedListener)) {
      throw new Error('assurance server did not prove an actual loopback-only listener');
    }
  } catch (error) {
    if (container) await terminateContainer(child, container);
    else await terminateChild(child);
    if (!suppliedStore) store.cleanup();
    throw new Error(`${error.message}\nServer output:\n${output}`);
  }

  return {
    appId: 'assurance-app',
    baseUrl,
    child,
    getOutput: () => output,
    tempRoot,
    uploadsDir,
    dbPath,
    listenerAddress: '127.0.0.1',
    listenerPort: port,
    runtimeKind: image ? 'container' : 'local',
    image,
    async stop() {
      if (container) await terminateContainer(child, container);
      else await terminateChild(child);
      if (!suppliedStore) store.cleanup();
    },
  };
}

export async function requestJson(server, route, { method = 'GET', token, body, headers = {} } = {}) {
  const requestHeaders = { 'X-App-Id': server.appId, ...headers };
  if (body !== undefined && !requestHeaders['Content-Type']) requestHeaders['Content-Type'] = 'application/json';
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  const response = await fetch(`${server.baseUrl}${route}`, {
    method,
    headers: requestHeaders,
    body: body === undefined
      ? undefined
      : requestHeaders['Content-Type'] === 'application/json'
        ? JSON.stringify(body)
        : body,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Binary and deliberately malformed responses remain available as text.
  }
  return { response, status: response.status, body: json, text };
}

export async function loginAdmin(server) {
  const result = await requestJson(server, `/api/apps/${server.appId}/auth/login`, {
    method: 'POST',
    body: { email: 'admin@local.test', password: 'change-me-local' },
  });
  if (result.status !== 200 || !result.body?.access_token) {
    throw new Error(`admin login failed: ${result.status} ${result.text}`);
  }
  return result.body.access_token;
}

export async function registerUser(server, email) {
  const registration = await requestJson(server, `/api/apps/${server.appId}/auth/register`, {
    method: 'POST',
    body: { email, password: 'Synthetic-Assurance-Password-1!' },
  });
  if (registration.status !== 200) {
    throw new Error(`registration failed: ${registration.status} ${registration.text}`);
  }
  const verification = await requestJson(server, `/api/apps/${server.appId}/auth/verify-otp`, {
    method: 'POST',
    body: { email, otp_code: '000000' },
  });
  if (verification.status !== 200 || !verification.body?.access_token) {
    throw new Error(`verification failed: ${verification.status} ${verification.text}`);
  }
  return { id: registration.body?.user_id, email, token: verification.body.access_token };
}

export async function activateUser(server, adminToken, userId) {
  const result = await requestJson(server, `/api/apps/${server.appId}/entities/User/${userId}`, {
    method: 'PUT',
    token: adminToken,
    body: {
      account_status: 'active',
      country: 'australia',
      profession: 'Exercise Physiologist',
    },
  });
  if (result.status !== 200) throw new Error(`activation failed: ${result.status} ${result.text}`);
}

export async function createOrganizationForUser(server, adminToken, user, role = 'clinician') {
  const organization = await requestJson(server, `/api/apps/${server.appId}/entities/Organization`, {
    method: 'POST', token: adminToken, body: { name: `Synthetic ${user.id}` },
  });
  if (organization.status !== 200) {
    throw new Error(`organization create failed: ${organization.status} ${organization.text}`);
  }
  const membership = await requestJson(server, `/api/apps/${server.appId}/entities/OrganizationMember`, {
    method: 'POST',
    token: adminToken,
    body: { org_id: organization.body.id, user_email: user.email, role, is_primary: true },
  });
  if (membership.status !== 200) {
    throw new Error(`membership create failed: ${membership.status} ${membership.text}`);
  }
  return organization.body;
}
