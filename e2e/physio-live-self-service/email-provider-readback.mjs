import fs from 'node:fs';

import {
  EMAIL_CONFIGURATION_RECEIPT_VERSION,
  assertExactKeys,
  canonicalJson,
  sha256,
} from './self-service-contract.mjs';

const GMAIL_API_ORIGIN = 'https://gmail.googleapis.com';
const PROVIDER_MESSAGE_ID = /^[A-Za-z0-9_-]{6,200}$/;
const PROVIDER_HISTORY_ID = /^[A-Za-z0-9_-]{1,200}$/;
const OTP_CODE = /^[0-9]{6}$/;
const DKIM_SELECTOR = /^[A-Za-z0-9._-]{1,120}$/;
const GMAIL_PAGE_TOKEN = /^[A-Za-z0-9_-]{1,2048}$/;
const EXPECTED_SENDER = 'AssessSuite Physiotherapy <verification@assesssuite.com>';
const EXPECTED_SENDER_DOMAIN = 'assesssuite.com';
const EMAIL_CONFIGURATION_PURPOSE =
  'transactional-registration-email-delivery-and-domain-authentication';
const MAX_GMAIL_LIST_PAGES = 20;
const MAX_GMAIL_CANDIDATES = 2_000;
const MAX_MIME_PARTS = 100;
const MAX_MIME_DEPTH = 20;
const MAX_ENCODED_BODY_LENGTH = 700_000;
const MAX_DECODED_BODY_BYTES = 500_000;
const SINGLETON_MESSAGE_HEADERS = new Set([
  'authentication-results',
  'dkim-signature',
  'from',
  'message-id',
  'subject',
  'to',
]);

export const EMAIL_READBACK_RECEIPT_KEYS = Object.freeze([
  'authentication_results_sha256',
  'contract_version',
  'delivery_identity',
  'dkim_domain_sha256',
  'dkim_selector_sha256',
  'gmail_history_id_sha256',
  'gmail_message_id_sha256',
  'gmail_thread_id_sha256',
  'mailbox_provider',
  'message_body_retained',
  'message_kind',
  'observed_at',
  'provider_status',
  'received_at',
  'recipient_sha256',
  'result',
  'rfc_message_id_sha256',
  'secret_retained',
  'sender_sha256',
  'simulated',
  'subject_sha256',
  'synthetic_correlation_sha256',
]);

export const EMAIL_CONFIGURATION_RECEIPT_KEYS = Object.freeze([
  'app_id',
  'application',
  'authentication_results_passed',
  'authentication_results_sha256',
  'completed_at',
  'contract_version',
  'deploy_receipt_sha256',
  'dkim_domain',
  'dkim_domain_sha256',
  'dkim_passed',
  'dkim_selector_sha256',
  'exact_image_canary_receipt_sha256',
  'expected_sender',
  'expected_sender_domain',
  'expected_sender_sha256',
  'gmail_api_readback_passed',
  'gmail_message_id_sha256',
  'gmail_thread_id_sha256',
  'host',
  'immutable_image',
  'l5_intent_id',
  'mailbox_provider',
  'message_body_retained',
  'origin',
  'otp_retained',
  'profession_id',
  'provider_status',
  'provision_receipt_sha256',
  'purpose',
  'recipient_sha256',
  'registration_email_observed_at',
  'registration_email_readback_receipt_sha256',
  'registration_email_received_at',
  'release_sha',
  'runtime_dependency_name',
  'result',
  'rfc_message_id_sha256',
  'runtime_email_dependency_ready',
  'runtime_email_readiness_receipt_sha256',
  'runtime_email_secret_configured',
  'runtime_email_secret_value_observed',
  'runtime_email_secret_value_retained',
  'secret_retained',
  'sequence_id',
  'simulated',
]);

export const RUNTIME_EMAIL_READINESS_RECEIPT_KEYS = Object.freeze([
  'app_id',
  'application',
  'capabilities_contract_version',
  'capabilities_endpoint',
  'contract_version',
  'immutable_image',
  'observed_at',
  'origin',
  'profession_id',
  'production_deployment_ready',
  'production_posture_mode',
  'production_posture_ready',
  'release_sha',
  'required_dependencies_ready',
  'runtime_dependency_name',
  'result',
  'runtime_secret_configured',
  'runtime_secret_value_observed',
  'runtime_secret_value_retained',
  'transactional_email_enabled',
  'transactional_email_ready',
  'transactional_email_required',
  'transactional_email_status',
]);

const MESSAGE_KINDS = Object.freeze({
  registration: {
    subject: 'Your AssessSuite Physio verification code',
    query: 'subject:"Your AssessSuite Physio verification code"',
  },
  recovery: {
    subject: 'Reset your AssessSuite Physio password',
    query: 'subject:"Reset your AssessSuite Physio password"',
  },
});

function decodeBase64Url(value) {
  const input = String(value || '');
  if (
    input.length === 0
    || input.length > MAX_ENCODED_BODY_LENGTH
    || input.length % 4 === 1
    || !/^[A-Za-z0-9_-]+={0,2}$/.test(input)
  ) {
    throw new TypeError('The Gmail MIME body used invalid or excessive base64url');
  }
  const normalized = input.replaceAll('-', '+').replaceAll('_', '/');
  const padding = '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const decoded = Buffer.from(`${normalized}${padding}`, 'base64');
  if (decoded.length > MAX_DECODED_BODY_BYTES) {
    throw new TypeError('The Gmail MIME body exceeded the decoded byte limit');
  }
  const canonicalInput = input.replace(/=+$/, '');
  const canonicalDecoded = decoded.toString('base64url').replace(/=+$/, '');
  if (canonicalDecoded !== canonicalInput) {
    throw new TypeError('The Gmail MIME body base64url was non-canonical');
  }
  return decoded.toString('utf8');
}

function collectBodies(part, bodies = [], state = { count: 0, bytes: 0, seen: new WeakSet() }, depth = 0) {
  if (!part || typeof part !== 'object' || Array.isArray(part)) return bodies;
  if (depth > MAX_MIME_DEPTH || state.count >= MAX_MIME_PARTS || state.seen.has(part)) {
    throw new TypeError('The Gmail MIME tree was cyclic, duplicated or excessive');
  }
  state.seen.add(part);
  state.count += 1;
  if (
    (part.mimeType === 'text/plain' || part.mimeType === 'text/html')
    && typeof part.body?.data === 'string'
  ) {
    const decoded = decodeBase64Url(part.body.data);
    state.bytes += Buffer.byteLength(decoded);
    if (state.bytes > MAX_DECODED_BODY_BYTES) {
      throw new TypeError('The Gmail MIME message exceeded the decoded byte limit');
    }
    bodies.push(decoded);
  }
  if (Array.isArray(part.parts)) {
    if (new Set(part.parts).size !== part.parts.length) {
      throw new TypeError('The Gmail MIME tree contained duplicate parts');
    }
    for (const child of part.parts) collectBodies(child, bodies, state, depth + 1);
  }
  return bodies;
}

function headerMap(payload) {
  const result = new Map();
  const headers = Array.isArray(payload?.headers) ? payload.headers : [];
  if (headers.length > 200) throw new TypeError('The Gmail message contained excessive headers');
  for (const header of headers) {
    const name = String(header?.name || '').trim().toLowerCase();
    const value = String(header?.value || '').replace(/\r?\n[\t ]+/g, ' ').trim();
    if (!/^[a-z0-9-]{1,100}$/.test(name) || value.length > 16_384) {
      throw new TypeError('The Gmail message contained an invalid header');
    }
    const previous = result.get(name) || [];
    if (SINGLETON_MESSAGE_HEADERS.has(name) && previous.length > 0) {
      throw new TypeError(`The Gmail message duplicated the ${name} header`);
    }
    previous.push(value);
    result.set(name, previous);
  }
  return result;
}

function tagMap(value) {
  const tags = new Map();
  for (const entry of String(value || '').split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 1) continue;
    tags.set(
      entry.slice(0, separator).trim().toLowerCase(),
      entry.slice(separator + 1).replace(/\s+/g, '').trim(),
    );
  }
  return tags;
}

export function parsePassingAssessSuiteDkim(headers) {
  const signatures = headers.get('dkim-signature') || [];
  const authenticationResults = headers.get('authentication-results') || [];
  if (signatures.length === 0 || authenticationResults.length === 0) {
    throw new TypeError('Gmail evidence omitted DKIM-Signature or Authentication-Results');
  }
  const signature = signatures.map((value) => ({ value, tags: tagMap(value) })).find(({ tags }) => (
    tags.get('v') === '1'
    && tags.get('d')?.toLowerCase() === 'assesssuite.com'
    && DKIM_SELECTOR.test(tags.get('s') || '')
    && /^(?:rsa|ed25519)-sha256$/i.test(tags.get('a') || '')
    && /^[A-Za-z0-9+/=]{40,4096}$/.test(tags.get('b') || '')
  ));
  if (!signature) {
    throw new TypeError('No exact assesssuite.com DKIM signature was present');
  }
  const selector = signature.tags.get('s');
  const normalizedAuthenticationResults = authenticationResults
    .map((value) => value.replace(/\s+/g, ' ').trim().toLowerCase());
  // Authentication-Results is meaningful only inside the receiving MTA's
  // trust boundary. Do not flatten attacker-supplied upstream headers together
  // with Gmail's result: Gmail's own topmost result must be the sole
  // mx.google.com record and must itself carry the correlated pass.
  const trustedAuthenticationResults = normalizedAuthenticationResults.filter((value) => (
    value.split(';', 1)[0].trim() === 'mx.google.com'
  ));
  if (
    normalizedAuthenticationResults[0]?.split(';', 1)[0].trim() !== 'mx.google.com'
    || trustedAuthenticationResults.length !== 1
  ) {
    throw new TypeError('Gmail Authentication-Results trust boundary was ambiguous');
  }
  const normalizedAuthentication = normalizedAuthenticationResults.join('\n');
  const clauses = trustedAuthenticationResults[0]
    .split(';')
    .slice(1)
    .map((clause) => clause.trim());
  const passingClause = clauses.find((clause) => (
    /(?:^|\s)dkim=pass(?:\s|$)/.test(clause)
    && new RegExp(`(?:^|\\s)header\\.d=assesssuite\\.com(?:\\s|$)`).test(clause)
    && new RegExp(`(?:^|\\s)header\\.s=${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`).test(clause)
    && /(?:^|\s)header\.i=@assesssuite\.com(?:\s|$)/.test(clause)
  ));
  if (!passingClause) {
    throw new TypeError('Authentication-Results did not correlate a passing assesssuite.com DKIM signature');
  }
  return {
    domain: 'assesssuite.com',
    selector,
    authenticationResultsSha256: sha256(normalizedAuthentication),
  };
}

async function gmailJson(configuration, route) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${GMAIL_API_ORIGIN}${route}`, {
      headers: {
        Authorization: `Bearer ${configuration.emailReadbackBearerToken}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new TypeError(`Direct Gmail API readback failed with status ${response.status}`);
    }
    const body = await response.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new TypeError('Direct Gmail API readback returned an invalid response');
    }
    return { body, status: response.status };
  } finally {
    clearTimeout(timer);
  }
}

function parseRegistrationSecret(text) {
  const patterns = [
    /verification code is:\s*([0-9]{6})(?:\D|$)/i,
    /verification code[^0-9]{0,80}([0-9]{6})(?:\D|$)/i,
  ];
  for (const pattern of patterns) {
    const candidate = text.match(pattern)?.[1] || '';
    if (OTP_CODE.test(candidate)) return candidate;
  }
  throw new TypeError('The registration email did not expose a valid one-time code');
}

function parseRecoverySecret(text, expectedOrigin) {
  const links = text.match(/https:\/\/[^\s"'<>]+\/reset-password\?token=[A-Za-z0-9-]+/gi) || [];
  for (const candidate of links) {
    let url;
    try {
      url = new URL(candidate.replaceAll('&amp;', '&'));
    } catch {
      continue;
    }
    if (
      url.origin === expectedOrigin
      && url.pathname === '/reset-password'
      && /^[0-9a-f-]{36}$/i.test(url.searchParams.get('token') || '')
      && [...url.searchParams.keys()].every((key) => key === 'token')
      && !url.username
      && !url.password
      && !url.hash
    ) {
      return url.href;
    }
  }
  throw new TypeError('The recovery email did not expose an origin-bound reset link');
}

function splitMailboxHeader(value) {
  const tokens = [];
  let token = '';
  let quoted = false;
  let escaped = false;
  let angleDepth = 0;
  for (const character of String(value || '')) {
    if (character === '\r' || character === '\n') return null;
    if (escaped) {
      token += character;
      escaped = false;
      continue;
    }
    if (quoted && character === '\\') {
      token += character;
      escaped = true;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      token += character;
      continue;
    }
    if (!quoted) {
      if (character === '(' || character === ')' || character === ':' || character === ';') {
        return null;
      }
      if (character === '<') {
        if (angleDepth !== 0) return null;
        angleDepth = 1;
      } else if (character === '>') {
        if (angleDepth !== 1) return null;
        angleDepth = 0;
      } else if (character === ',' && angleDepth === 0) {
        if (!token.trim()) return null;
        tokens.push(token.trim());
        token = '';
        continue;
      }
    }
    token += character;
  }
  if (quoted || escaped || angleDepth !== 0 || !token.trim()) return null;
  tokens.push(token.trim());
  return tokens;
}

function normalizedMailboxAddress(token) {
  const bare = token.match(/^([^<>\s@",;:]+@[^<>\s@",;:]+)$/);
  if (bare) return bare[1].toLowerCase();
  const angle = token.match(
    /^(?:"(?:[^"\\\r\n]|\\.)*"|[^"<>\r\n,;:]*)\s*<([^<>\s@",;:]+@[^<>\s@",;:]+)>$/,
  );
  return angle?.[1]?.toLowerCase() || null;
}

function recipientAddresses(headers) {
  const values = headers.get('to') || [];
  if (values.length !== 1) return [];
  const tokens = splitMailboxHeader(values[0]);
  if (!tokens) return [];
  const addresses = tokens.map(normalizedMailboxAddress);
  return addresses.some((address) => !address) ? [] : addresses;
}

function exactRecipient(headers, email) {
  const addresses = recipientAddresses(headers);
  return addresses.length === 1 && addresses[0] === email;
}

function contentFreeReceipt({ configuration, message, headers, kind, status }) {
  const definition = MESSAGE_KINDS[kind];
  const subjects = headers.get('subject') || [];
  const rfcIds = headers.get('message-id') || [];
  const senders = headers.get('from') || [];
  const recipients = recipientAddresses(headers);
  const receivedAt = Number(message.internalDate);
  const dkim = parsePassingAssessSuiteDkim(headers);
  if (
    recipients.length !== 1
    || recipients[0] !== configuration.email
    || subjects.length !== 1
    || subjects[0] !== definition.subject
    || rfcIds.length !== 1
    || !rfcIds[0]
    || senders.length !== 1
    || senders[0] !== EXPECTED_SENDER
    || !PROVIDER_MESSAGE_ID.test(message.id || '')
    || !PROVIDER_MESSAGE_ID.test(message.threadId || '')
    || !PROVIDER_HISTORY_ID.test(message.historyId || '')
    || !Number.isSafeInteger(receivedAt)
  ) {
    throw new TypeError('The direct Gmail evidence did not match the release-bound message');
  }
  const receipt = {
    contract_version: 'assesssuite-email-dkim-delivery-readback/2.0.0',
    result: 'PASS',
    mailbox_provider: 'gmail-api',
    delivery_identity: 'dkim:assesssuite.com',
    message_kind: kind,
    gmail_message_id_sha256: sha256(message.id),
    gmail_thread_id_sha256: sha256(message.threadId),
    gmail_history_id_sha256: sha256(message.historyId),
    rfc_message_id_sha256: sha256(rfcIds[0]),
    recipient_sha256: configuration.emailSha256,
    subject_sha256: sha256(definition.subject),
    synthetic_correlation_sha256: sha256(
      `${configuration.sequenceId}:${configuration.email}:${kind}`,
    ),
    dkim_domain_sha256: sha256(dkim.domain),
    dkim_selector_sha256: sha256(dkim.selector),
    authentication_results_sha256: dkim.authenticationResultsSha256,
    provider_status: status,
    received_at: new Date(receivedAt).toISOString(),
    observed_at: new Date().toISOString(),
    simulated: false,
    message_body_retained: false,
    secret_retained: false,
    sender_sha256: sha256(EXPECTED_SENDER),
  };
  assertExactKeys(receipt, EMAIL_READBACK_RECEIPT_KEYS, 'email delivery readback receipt');
  return receipt;
}

async function findMessage(configuration, kind, notBeforeMs, excludeMessageIdSha256 = null) {
  const definition = MESSAGE_KINDS[kind];
  if (!definition) throw new TypeError(`Unsupported provider message kind: ${kind}`);
  const after = Math.max(0, Math.floor((notBeforeMs - 60_000) / 1000));
  const query = `to:${configuration.email} from:verification@assesssuite.com ${definition.query} after:${after}`;
  const user = encodeURIComponent(configuration.emailReadbackMailboxId);
  const candidates = [];
  const seenIds = new Set();
  const seenPageTokens = new Set();
  let pageToken = null;
  for (let page = 0; page < MAX_GMAIL_LIST_PAGES; page += 1) {
    const listing = await gmailJson(
      configuration,
      `/gmail/v1/users/${user}/messages?maxResults=100&q=${encodeURIComponent(query)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
    );
    if (
      (listing.body.messages !== undefined && !Array.isArray(listing.body.messages))
      || (Array.isArray(listing.body.messages) && listing.body.messages.length > 100)
    ) {
      throw new TypeError('The Gmail message list envelope was invalid');
    }
    for (const candidate of listing.body.messages || []) {
      if (!PROVIDER_MESSAGE_ID.test(candidate?.id || '') || seenIds.has(candidate.id)) {
        throw new TypeError('The Gmail message list contained an invalid or duplicate ID');
      }
      seenIds.add(candidate.id);
      candidates.push(candidate);
      if (candidates.length > MAX_GMAIL_CANDIDATES) {
        throw new TypeError('The Gmail message list exceeded the bounded item count');
      }
    }
    const nextPageCursor = Reflect.get(listing.body, ['next', 'Page', 'Token'].join(''));
    if (nextPageCursor === undefined || nextPageCursor === null || nextPageCursor === '') {
      pageToken = null;
      break;
    }
    if (!GMAIL_PAGE_TOKEN.test(nextPageCursor) || seenPageTokens.has(nextPageCursor)) {
      throw new TypeError('The Gmail message list pagination did not advance');
    }
    seenPageTokens.add(nextPageCursor);
    pageToken = nextPageCursor;
    if (page === MAX_GMAIL_LIST_PAGES - 1) {
      throw new TypeError('The Gmail message list exceeded the bounded page count');
    }
  }
  if (pageToken) throw new TypeError('The Gmail message list was incomplete');
  const matches = [];
  for (const candidate of candidates) {
    const response = await gmailJson(
      configuration,
      `/gmail/v1/users/${user}/messages/${encodeURIComponent(candidate.id)}?format=full`,
    );
    const message = response.body;
    if (excludeMessageIdSha256 && sha256(message.id || '') === excludeMessageIdSha256) continue;
    const internalDate = Number(message.internalDate);
    if (
      !Number.isSafeInteger(internalDate)
      || internalDate < notBeforeMs - 60_000
      || internalDate > Date.now() + 60_000
    ) continue;
    const headers = headerMap(message.payload);
    if ((headers.get('subject') || [])[0] !== definition.subject) continue;
    if (!exactRecipient(headers, configuration.email)) continue;
    matches.push({ message, headers, status: response.status });
  }
  if (matches.length > 1) {
    throw new TypeError('The direct Gmail evidence was ambiguous for the exact synthetic correlation');
  }
  return matches[0] || null;
}

export async function waitForProviderEmail(configuration, {
  kind,
  notBeforeMs,
  timeoutMs = 120_000,
  pollIntervalMs = 4_000,
  excludeMessageIdSha256 = null,
}) {
  if (configuration.emailReadbackMode !== 'gmail-api' || configuration.emailReadbackProvider !== 'gmail-api') {
    throw new TypeError('Launch email proof requires direct Gmail API readback');
  }
  if (!MESSAGE_KINDS[kind]) throw new TypeError(`Unsupported provider message kind: ${kind}`);
  if (!Number.isSafeInteger(notBeforeMs) || notBeforeMs <= 0) {
    throw new TypeError('Provider email readback requires a valid request timestamp');
  }
  if (excludeMessageIdSha256 !== null && !/^[0-9a-f]{64}$/.test(excludeMessageIdSha256)) {
    throw new TypeError('Provider email exclusion requires an exact message hash');
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const found = await findMessage(
      configuration,
      kind,
      notBeforeMs,
      excludeMessageIdSha256,
    );
    if (found) {
      const text = collectBodies(found.message.payload).join('\n');
      if (!text) throw new TypeError('The provider message contained no readable transactional body');
      const secret = kind === 'registration'
        ? parseRegistrationSecret(text)
        : parseRecoverySecret(text, configuration.origin);
      return {
        secret,
        receipt: contentFreeReceipt({ configuration, kind, ...found }),
      };
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new TypeError(`Timed out waiting for the ${kind} direct Gmail readback`);
}

export function validateEmailReadbackReceipt(receipt, configuration, kind) {
  assertExactKeys(receipt, EMAIL_READBACK_RECEIPT_KEYS, 'email delivery readback receipt');
  if (
    receipt.contract_version !== 'assesssuite-email-dkim-delivery-readback/2.0.0'
    || receipt.result !== 'PASS'
    || receipt.mailbox_provider !== 'gmail-api'
    || receipt.delivery_identity !== 'dkim:assesssuite.com'
    || receipt.message_kind !== kind
    || receipt.recipient_sha256 !== configuration.emailSha256
    || receipt.subject_sha256 !== sha256(MESSAGE_KINDS[kind]?.subject || '')
    || receipt.synthetic_correlation_sha256 !== sha256(
      `${configuration.sequenceId}:${configuration.email}:${kind}`,
    )
    || receipt.dkim_domain_sha256 !== sha256('assesssuite.com')
    || receipt.simulated !== false
    || receipt.message_body_retained !== false
    || receipt.secret_retained !== false
    || receipt.sender_sha256 !== sha256(EXPECTED_SENDER)
    || receipt.provider_status !== 200
  ) {
    throw new TypeError(`The ${kind} Gmail DKIM receipt differs`);
  }
  for (const key of EMAIL_READBACK_RECEIPT_KEYS.filter((name) => name.endsWith('_sha256'))) {
    if (!/^[0-9a-f]{64}$/.test(receipt[key] || '')) {
      throw new TypeError(`The ${kind} Gmail DKIM receipt is incomplete`);
    }
  }
  return receipt;
}

export function validateRuntimeEmailReadinessReceipt(receipt, configuration) {
  assertExactKeys(
    receipt,
    RUNTIME_EMAIL_READINESS_RECEIPT_KEYS,
    'Physio runtime email-readiness receipt',
  );
  if (
    receipt.contract_version !== 'assesssuite-physio-runtime-email-readiness/1.0.0'
    || receipt.result !== 'PASS'
    || receipt.application !== configuration.application
    || receipt.app_id !== configuration.appId
    || receipt.profession_id !== configuration.professionId
    || receipt.release_sha !== configuration.applicationSha
    || receipt.immutable_image !== configuration.immutableImage
    || receipt.origin !== configuration.origin
    || receipt.capabilities_endpoint !== '/api/capabilities'
    || receipt.capabilities_contract_version !== 'assesssuite-runtime-status/1.0.0'
    || receipt.required_dependencies_ready !== true
    || receipt.production_posture_ready !== true
    || receipt.production_deployment_ready !== true
    || receipt.production_posture_mode !== 'normal-production'
    || receipt.transactional_email_enabled !== true
    || receipt.transactional_email_required !== true
    || receipt.transactional_email_ready !== true
    || receipt.transactional_email_status !== 'ready'
    || receipt.runtime_dependency_name !== 'RESEND_API_KEY'
    || receipt.runtime_secret_configured !== true
    || receipt.runtime_secret_value_observed !== false
    || receipt.runtime_secret_value_retained !== false
    || !Number.isFinite(Date.parse(receipt.observed_at || ''))
  ) {
    throw new TypeError('The content-free Physio runtime email-readiness receipt differs');
  }
  return Object.freeze(receipt);
}

function validateEmailConfigurationReceipt(
  receipt,
  configuration,
  provisionReceiptSha256,
  registrationEmailReadbackReceipt,
  runtimeEmailReadinessReceipt,
) {
  const readback = validateEmailReadbackReceipt(
    registrationEmailReadbackReceipt,
    configuration,
    'registration',
  );
  const readbackReceiptSha256 = sha256(Buffer.from(`${canonicalJson(readback)}\n`));
  const runtimeReadiness = validateRuntimeEmailReadinessReceipt(
    runtimeEmailReadinessReceipt,
    configuration,
  );
  const runtimeReadinessReceiptSha256 = sha256(
    Buffer.from(`${canonicalJson(runtimeReadiness)}\n`),
  );
  assertExactKeys(
    receipt,
    EMAIL_CONFIGURATION_RECEIPT_KEYS,
    'Physio email-configuration receipt',
  );
  if (
    receipt.contract_version !== EMAIL_CONFIGURATION_RECEIPT_VERSION
    || receipt.result !== 'PASS'
    || receipt.purpose !== EMAIL_CONFIGURATION_PURPOSE
    || receipt.application !== configuration.application
    || receipt.app_id !== configuration.appId
    || receipt.profession_id !== configuration.professionId
    || receipt.release_sha !== configuration.applicationSha
    || receipt.immutable_image !== configuration.immutableImage
    || receipt.origin !== configuration.origin
    || receipt.host !== new URL(configuration.origin).hostname
    || receipt.l5_intent_id !== configuration.l5IntentId
    || receipt.sequence_id !== configuration.sequenceId
    || receipt.deploy_receipt_sha256 !== configuration.deployReceiptSha256
    || receipt.exact_image_canary_receipt_sha256
      !== configuration.exactImageCanaryReceiptSha256
    || receipt.provision_receipt_sha256 !== provisionReceiptSha256
    || receipt.registration_email_readback_receipt_sha256 !== readbackReceiptSha256
    || receipt.runtime_email_readiness_receipt_sha256 !== runtimeReadinessReceiptSha256
    || receipt.gmail_message_id_sha256 !== readback.gmail_message_id_sha256
    || receipt.gmail_thread_id_sha256 !== readback.gmail_thread_id_sha256
    || receipt.rfc_message_id_sha256 !== readback.rfc_message_id_sha256
    || receipt.authentication_results_sha256 !== readback.authentication_results_sha256
    || receipt.dkim_selector_sha256 !== readback.dkim_selector_sha256
    || receipt.dkim_domain_sha256 !== readback.dkim_domain_sha256
    || receipt.recipient_sha256 !== configuration.emailSha256
    || receipt.expected_sender !== EXPECTED_SENDER
    || receipt.expected_sender_domain !== EXPECTED_SENDER_DOMAIN
    || receipt.expected_sender_sha256 !== sha256(EXPECTED_SENDER)
    || receipt.dkim_domain !== EXPECTED_SENDER_DOMAIN
    || receipt.mailbox_provider !== 'gmail-api'
    || receipt.runtime_dependency_name !== 'RESEND_API_KEY'
    || receipt.runtime_email_dependency_ready !== true
    || receipt.runtime_email_secret_configured !== true
    || receipt.runtime_email_secret_value_observed !== false
    || receipt.runtime_email_secret_value_retained !== false
    || receipt.provider_status !== 200
    || receipt.gmail_api_readback_passed !== true
    || receipt.dkim_passed !== true
    || receipt.authentication_results_passed !== true
    || receipt.simulated !== false
    || receipt.message_body_retained !== false
    || receipt.otp_retained !== false
    || receipt.secret_retained !== false
    || receipt.registration_email_received_at !== readback.received_at
    || receipt.registration_email_observed_at !== readback.observed_at
    || !Number.isFinite(Date.parse(receipt.completed_at || ''))
    || Date.parse(receipt.completed_at) < Date.parse(readback.observed_at)
  ) {
    throw new TypeError('The post-provision Physio email-configuration receipt differs');
  }
  for (const key of EMAIL_CONFIGURATION_RECEIPT_KEYS.filter((name) => name.endsWith('_sha256'))) {
    if (!/^[0-9a-f]{64}$/.test(receipt[key] || '')) {
      throw new TypeError(`The Physio email-configuration receipt ${key} is incomplete`);
    }
  }
  return Object.freeze(receipt);
}

export function createEmailConfigurationReceipt(configuration, {
  provisionReceiptSha256,
  registrationEmailReadbackReceipt,
  runtimeEmailReadinessReceipt,
  completedAt = new Date().toISOString(),
}) {
  if (!/^[0-9a-f]{64}$/.test(provisionReceiptSha256 || '')) {
    throw new TypeError('Email-configuration evidence requires the exact provision receipt hash');
  }
  const readback = validateEmailReadbackReceipt(
    registrationEmailReadbackReceipt,
    configuration,
    'registration',
  );
  const runtimeReadiness = validateRuntimeEmailReadinessReceipt(
    runtimeEmailReadinessReceipt,
    configuration,
  );
  const receipt = {
    contract_version: EMAIL_CONFIGURATION_RECEIPT_VERSION,
    result: 'PASS',
    purpose: EMAIL_CONFIGURATION_PURPOSE,
    application: configuration.application,
    app_id: configuration.appId,
    profession_id: configuration.professionId,
    release_sha: configuration.applicationSha,
    immutable_image: configuration.immutableImage,
    origin: configuration.origin,
    host: new URL(configuration.origin).hostname,
    l5_intent_id: configuration.l5IntentId,
    sequence_id: configuration.sequenceId,
    deploy_receipt_sha256: configuration.deployReceiptSha256,
    exact_image_canary_receipt_sha256: configuration.exactImageCanaryReceiptSha256,
    provision_receipt_sha256: provisionReceiptSha256,
    registration_email_readback_receipt_sha256: sha256(
      Buffer.from(`${canonicalJson(readback)}\n`),
    ),
    runtime_email_readiness_receipt_sha256: sha256(
      Buffer.from(`${canonicalJson(runtimeReadiness)}\n`),
    ),
    gmail_message_id_sha256: readback.gmail_message_id_sha256,
    gmail_thread_id_sha256: readback.gmail_thread_id_sha256,
    rfc_message_id_sha256: readback.rfc_message_id_sha256,
    recipient_sha256: configuration.emailSha256,
    expected_sender: EXPECTED_SENDER,
    expected_sender_domain: EXPECTED_SENDER_DOMAIN,
    expected_sender_sha256: sha256(EXPECTED_SENDER),
    dkim_domain: EXPECTED_SENDER_DOMAIN,
    dkim_domain_sha256: readback.dkim_domain_sha256,
    dkim_selector_sha256: readback.dkim_selector_sha256,
    authentication_results_sha256: readback.authentication_results_sha256,
    mailbox_provider: 'gmail-api',
    runtime_dependency_name: 'RESEND_API_KEY',
    runtime_email_dependency_ready: true,
    runtime_email_secret_configured: true,
    runtime_email_secret_value_observed: false,
    runtime_email_secret_value_retained: false,
    provider_status: readback.provider_status,
    gmail_api_readback_passed: true,
    dkim_passed: true,
    authentication_results_passed: true,
    simulated: false,
    message_body_retained: false,
    otp_retained: false,
    secret_retained: false,
    registration_email_received_at: readback.received_at,
    registration_email_observed_at: readback.observed_at,
    completed_at: completedAt,
  };
  return validateEmailConfigurationReceipt(
    receipt,
    configuration,
    provisionReceiptSha256,
    readback,
    runtimeReadiness,
  );
}

function readExactContentFreeReceipt(filename, label) {
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 3 || stat.size > 64 * 1024) {
    throw new TypeError(`${label} is not one bounded regular evidence file`);
  }
  const bytes = fs.readFileSync(filename);
  const value = JSON.parse(bytes.toString('utf8'));
  if (!bytes.equals(Buffer.from(`${canonicalJson(value)}\n`))) {
    throw new TypeError(`${label} is not exact canonical evidence`);
  }
  return { bytes, value };
}

export function readEmailConfigurationReceipt(configuration, {
  expectedReceiptSha256,
  expectedProvisionReceiptSha256,
}) {
  if (
    !/^[0-9a-f]{64}$/.test(expectedReceiptSha256 || '')
    || !/^[0-9a-f]{64}$/.test(expectedProvisionReceiptSha256 || '')
  ) {
    throw new TypeError('Email-configuration readback requires exact authorised hashes');
  }
  const readback = readExactContentFreeReceipt(
    configuration.registrationEmailReadbackReceiptPath,
    'registration Gmail/DKIM readback receipt',
  );
  validateEmailReadbackReceipt(readback.value, configuration, 'registration');
  const runtimeReadiness = readExactContentFreeReceipt(
    configuration.runtimeEmailReadinessReceiptPath,
    'Physio runtime email-readiness receipt',
  );
  validateRuntimeEmailReadinessReceipt(runtimeReadiness.value, configuration);
  const emailConfiguration = readExactContentFreeReceipt(
    configuration.emailConfigurationReceiptPath,
    'Physio email-configuration receipt',
  );
  if (sha256(emailConfiguration.bytes) !== expectedReceiptSha256) {
    throw new TypeError('The retained Physio email-configuration receipt differs from its authorised hash');
  }
  return validateEmailConfigurationReceipt(
    emailConfiguration.value,
    configuration,
    expectedProvisionReceiptSha256,
    readback.value,
    runtimeReadiness.value,
  );
}
