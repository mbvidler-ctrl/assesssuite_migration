import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const supportDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(supportDir, '..', '..', '..');
const serverEntry = path.join(repoRoot, 'server', 'index.mjs');

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

async function waitForServer(baseUrl, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/apps/public/prod/public-settings/by-id/assurance-probe`);
      if (response.status === 200) return;
    } catch {
      // The child has not bound its port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('assurance server did not become ready before timeout');
}

async function terminateChild(child) {
  if (child.exitCode !== null) return;
  const exited = once(child, 'exit').catch(() => {});
  child.kill();
  await exited;
}

export async function startTestServer(extraEnv = {}) {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-assurance-'));
  const uploadsDir = path.join(tempRoot, 'uploads');
  const dbPath = path.join(tempRoot, 'assurance.db');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const child = spawn(process.execPath, [serverEntry], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SELFTEST: '1',
      PORT: String(port),
      ADMIN_EMAIL: 'admin@local.test',
      ADMIN_PASSWORD: 'change-me-local',
      UPLOADS_DIR: uploadsDir,
      ...extraEnv,
      ASSESSSUITE_DB_PATH: dbPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  try {
    const earlyExit = once(child, 'exit').then(([code]) => {
      throw new Error(`assurance server exited before readiness (code ${code})\nServer output:\n${output}`);
    });
    await Promise.race([waitForServer(baseUrl), earlyExit]);
  } catch (error) {
    await terminateChild(child);
    fs.rmSync(tempRoot, { recursive: true, force: true });
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
    async stop() {
      await terminateChild(child);
      fs.rmSync(tempRoot, { recursive: true, force: true });
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
    method: 'PUT', token: adminToken, body: { account_status: 'active' },
  });
  if (result.status !== 200) throw new Error(`activation failed: ${result.status} ${result.text}`);
}

export async function createOrganizationForUser(server, adminToken, user) {
  const organization = await requestJson(server, `/api/apps/${server.appId}/entities/Organization`, {
    method: 'POST', token: adminToken, body: { name: `Synthetic ${user.id}` },
  });
  if (organization.status !== 200) {
    throw new Error(`organization create failed: ${organization.status} ${organization.text}`);
  }
  const membership = await requestJson(server, `/api/apps/${server.appId}/entities/OrganizationMember`, {
    method: 'POST',
    token: adminToken,
    body: { org_id: organization.body.id, user_email: user.email, role: 'clinician', is_primary: true },
  });
  if (membership.status !== 200) {
    throw new Error(`membership create failed: ${membership.status} ${membership.text}`);
  }
  return organization.body;
}
