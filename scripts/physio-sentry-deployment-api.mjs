import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const MAX_RESPONSE_BYTES = 1_048_576;
const MAX_PAGES = 100;
const SAFE_ID = /^[A-Za-z0-9_-]{1,160}$/u;

function fail(code, detail) {
  throw new Error(`${code}: ${detail}`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseLink(value, currentUrl) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 32_768) {
    fail('SENTRY_PAGINATION_LINK_INVALID', 'missing or oversized Link header');
  }
  const segments = value.split(',').map((row) => row.trim()).filter(Boolean);
  const next = segments.filter((row) => /(?:^|;)\s*rel="next"(?:;|$)/iu.test(row));
  if (next.length !== 1) fail('SENTRY_PAGINATION_LINK_INVALID', 'exactly one next relation is required');
  const match = next[0].match(/^<([^>]+)>;(.*)$/u);
  if (!match) fail('SENTRY_PAGINATION_LINK_INVALID', next[0]);
  const parameters = match[2].split(';').map((row) => row.trim());
  const results = parameters.find((row) => /^results="(?:true|false)"$/u.test(row));
  if (!results) fail('SENTRY_PAGINATION_LINK_INVALID', 'next results flag absent');
  const hasNext = results === 'results="true"';
  const nextUrl = new URL(match[1], currentUrl);
  const current = new URL(currentUrl);
  if (nextUrl.protocol !== 'https:' || nextUrl.origin !== current.origin ||
      nextUrl.pathname !== current.pathname || nextUrl.username || nextUrl.password || nextUrl.hash) {
    fail('SENTRY_PAGINATION_NEXT_URL_INVALID', nextUrl.toString());
  }
  if (hasNext && nextUrl.toString() === current.toString()) {
    fail('SENTRY_PAGINATION_LOOP', nextUrl.toString());
  }
  return { hasNext, nextUrl: nextUrl.toString() };
}

function requestIdHash(response) {
  const value = response.headers.get('x-sentry-request-id');
  return value ? sha256(value) : null;
}

function responseHeadersSha256(response) {
  const rows = [...response.headers.entries()].map(([name, value]) => [name.toLowerCase(), value])
    .sort(([left], [right]) => left.localeCompare(right));
  return sha256(Buffer.from(JSON.stringify(rows)));
}

async function responseBytes(response, label) {
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_RESPONSE_BYTES) fail('SENTRY_RESPONSE_OVERSIZE', label);
  return bytes;
}

function sanitizeDeployment(row) {
  const id = String(row?.id || '');
  if (!SAFE_ID.test(id) || typeof row?.environment !== 'string' || typeof row?.name !== 'string' ||
      typeof row?.url !== 'string') fail('SENTRY_DEPLOYMENT_ROW_INVALID', id || 'missing');
  return {
    id,
    environment: row.environment,
    name: row.name,
    url: row.url,
    date_started: row.dateStarted ?? null,
    date_finished: row.dateFinished ?? null,
  };
}

export async function listAllSentryDeployments({ url, token, fetchImpl = globalThis.fetch,
  expectedEnvironment, expectedName, expectedUrl, onPage }) {
  if (typeof token !== 'string' || token.length < 20 || typeof fetchImpl !== 'function') {
    fail('SENTRY_API_CLIENT_INVALID', 'token or fetch');
  }
  const pages = [];
  const seen = new Set();
  const seenDeploymentIds = new Set();
  let nextUrl = new URL(url).toString();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    if (seen.has(nextUrl)) fail('SENTRY_PAGINATION_LOOP', nextUrl);
    seen.add(nextUrl);
    const response = await fetchImpl(nextUrl, { method: 'GET', redirect: 'error',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    const bytes = await responseBytes(response, `GET page ${page}`);
    if (response.status !== 200) fail('SENTRY_INVENTORY_HTTP_STATUS', String(response.status));
    let rows;
    try { rows = JSON.parse(bytes.toString('utf8')); } catch {
      fail('SENTRY_INVENTORY_JSON_INVALID', `page ${page}`);
    }
    if (!Array.isArray(rows) || rows.length > 100) fail('SENTRY_INVENTORY_PAGE_INVALID', String(page));
    const link = parseLink(response.headers.get('link'), nextUrl);
    const pageReceipt = {
      page, request_url: nextUrl, http_status: response.status, row_count: rows.length,
      response_body_sha256: sha256(bytes), inventory_x_sentry_request_id_sha256: requestIdHash(response),
      response_headers_sha256: responseHeadersSha256(response),
      next_results: link.hasNext,
    };
    if (onPage) await onPage({ page, bytes, receipt: pageReceipt });
    const sanitizedRows = rows.map(sanitizeDeployment);
    for (const deployment of sanitizedRows) {
      if (seenDeploymentIds.has(deployment.id)) {
        fail('SENTRY_PAGINATION_DUPLICATE_DEPLOYMENT', deployment.id);
      }
      seenDeploymentIds.add(deployment.id);
    }
    pages.push({ receipt: pageReceipt, rows: sanitizedRows });
    if (!link.hasNext) break;
    nextUrl = link.nextUrl;
    if (page === MAX_PAGES) fail('SENTRY_PAGINATION_BOUND_EXCEEDED', String(MAX_PAGES));
  }
  const deployments = pages.flatMap((page) => page.rows);
  const exact = deployments.filter((row) => row.environment === expectedEnvironment &&
    row.name === expectedName && row.url === expectedUrl);
  if (exact.length > 1) fail('SENTRY_EXACT_DEPLOYMENT_AMBIGUOUS', String(exact.length));
  return {
    contract_version: 'assesssuite-physio-sentry-deployment-inventory/1.0.0', result: 'PASS',
    page_count: pages.length, inventory_calls_attempted: pages.length,
    inventory_calls_confirmed: pages.length, pages: pages.map((page) => page.receipt),
    exact_count: exact.length, deployments: exact,
  };
}

export async function createSentryDeployment({ url, token, payload, fetchImpl = globalThis.fetch,
  onResponse }) {
  if (typeof token !== 'string' || token.length < 20 || typeof fetchImpl !== 'function') {
    fail('SENTRY_API_CLIENT_INVALID', 'token or fetch');
  }
  const expected = ['environment', 'name', 'url'];
  if (!payload || JSON.stringify(Object.keys(payload).sort()) !== JSON.stringify(expected) ||
      !['physio-production'].includes(payload.environment) || typeof payload.name !== 'string' ||
      typeof payload.url !== 'string') fail('SENTRY_MUTATION_PAYLOAD_INVALID', 'payload');
  const body = Buffer.from(JSON.stringify(payload));
  const response = await fetchImpl(url, { method: 'POST', redirect: 'error',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json',
      'Content-Type': 'application/json' }, body });
  const bytes = await responseBytes(response, 'POST deployment');
  const receipt = {
    request_url: new URL(url).toString(), request_body_sha256: sha256(body), http_status: response.status,
    response_body_sha256: sha256(bytes), mutation_x_sentry_request_id_sha256: requestIdHash(response),
    response_headers_sha256: responseHeadersSha256(response),
    mutation_calls_attempted: 1, mutation_calls_confirmed: response.status === 201 ? 1 : 0,
  };
  if (onResponse) await onResponse({ bytes, receipt });
  if (response.status !== 201) fail('SENTRY_MUTATION_HTTP_STATUS', String(response.status));
  let row;
  try { row = sanitizeDeployment(JSON.parse(bytes.toString('utf8'))); } catch (error) {
    fail('SENTRY_MUTATION_RESPONSE_INVALID', error.message);
  }
  if (row.environment !== payload.environment || row.name !== payload.name || row.url !== payload.url) {
    fail('SENTRY_MUTATION_RESPONSE_INVALID', 'identity');
  }
  return { contract_version: 'assesssuite-physio-sentry-deployment-mutation/1.0.0', result: 'PASS',
    ...receipt, deployment: row };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index];
    if (!token?.startsWith('--') || argv[index + 1] === undefined) fail('SENTRY_API_ARGUMENT_INVALID', token || 'missing');
    args[token.slice(2)] = argv[index + 1];
  }
  return args;
}

function writeNew(file, value) {
  fs.writeFileSync(file, canonical(value), { flag: 'wx', mode: 0o600 });
}

export async function main(argv = process.argv.slice(2), options = {}) {
  const command = argv.shift();
  const args = parseArgs(argv);
  const token = process.env[args['token-env'] || 'SENTRY_AUTH_TOKEN'];
  fs.mkdirSync(args['evidence-directory'], { recursive: false, mode: 0o700 });
  if (command === 'list') {
    const result = await listAllSentryDeployments({ url: args.url, token, fetchImpl: options.fetchImpl,
      expectedEnvironment: args.environment, expectedName: args.name, expectedUrl: args['deployment-url'],
      onPage: ({ page, bytes, receipt }) => {
        fs.writeFileSync(`${args['evidence-directory']}/page-${String(page).padStart(3, '0')}.raw.json`, bytes,
          { flag: 'wx', mode: 0o600 });
        writeNew(`${args['evidence-directory']}/page-${String(page).padStart(3, '0')}.receipt.json`, receipt);
      } });
    writeNew(args.output, result);
    return;
  }
  if (command === 'create') {
    const payload = JSON.parse(fs.readFileSync(args.request, 'utf8'));
    const result = await createSentryDeployment({ url: args.url, token, payload, fetchImpl: options.fetchImpl,
      onResponse: ({ bytes, receipt }) => {
        fs.writeFileSync(`${args['evidence-directory']}/mutation.raw.json`, bytes, { flag: 'wx', mode: 0o600 });
        writeNew(`${args['evidence-directory']}/mutation.http-receipt.json`, receipt);
      } });
    writeNew(args.output, result);
    return;
  }
  fail('SENTRY_API_COMMAND_INVALID', String(command));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
