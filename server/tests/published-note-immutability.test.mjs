// WP1 — a published SOAP note is a finalised clinical record.
//
// The critical finding this suite pins: the treatment-protocol import wrote
// `{ plan: <appended text> }` straight into whichever same-day note it
// found, published or not, and the server accepted it. A finalised,
// countersigned clinical note could be silently rewritten with AI-drafted
// content and no history entry.
//
// The only sanctioned change to a published note is an amendment, which
// SOAPNoteModal records as ONE appended history entry attributed to the
// caller. Everything else is refused with 409. The single documented
// carve-out is attachment/audio-only partial writes, which the modal fires
// as immediate writes while amending (residual R3).
//
// One server boot, offline, no provider, no network.

import assert from 'node:assert/strict';
import { once } from 'node:events';
import net from 'node:net';
import { after, before, test } from 'node:test';

import {
  activateUser,
  createOrganizationForUser,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

function delay(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

const REFUSAL = 'a published clinical note may only be changed by recording an amendment';

let server;
let adminToken;
let clinician;
let clinicianOrg;
let second;
let secondOrg;
let outsider;
let client;

function route(suffix) {
  return `/api/apps/${server.appId}${suffix}`;
}

async function provisionClinician(suffix) {
  const user = await registerUser(server, `synthetic-published-note-${suffix}@example.test`);
  await activateUser(server, adminToken, user.id);
  const org = await createOrganizationForUser(server, adminToken, user);
  const bundle = await requestJson(
    server,
    route('/integration-endpoints/Core/RecordLegalAcceptanceBundle'),
    { method: 'POST', token: user.token, body: { org_id: org.id, marketing_opt_in: false } },
  );
  assert.equal(bundle.status, 200, bundle.text);
  return { user, org };
}

async function joinOrganization(user, org) {
  const membership = await requestJson(server, route('/entities/OrganizationMember'), {
    method: 'POST',
    token: adminToken,
    body: { org_id: org.id, user_email: user.email, role: 'clinician', is_primary: false },
  });
  assert.equal(membership.status, 200, membership.text);
  const bundle = await requestJson(
    server,
    route('/integration-endpoints/Core/RecordLegalAcceptanceBundle'),
    { method: 'POST', token: user.token, body: { org_id: org.id, marketing_opt_in: false } },
  );
  assert.equal(bundle.status, 200, bundle.text);
}

async function createNote(overrides = {}) {
  const created = await requestJson(server, route('/entities/SOAPNote'), {
    method: 'POST',
    token: clinician.user.token,
    body: {
      org_id: clinicianOrg.id,
      client_id: client.id,
      note_date: new Date().toISOString(),
      subjective: 'baseline subjective',
      objective: 'baseline objective',
      assessment: 'baseline assessment',
      plan: 'baseline plan',
      status: 'draft',
      ...overrides,
    },
  });
  assert.equal(created.status, 200, created.text);
  return created.body;
}

// Exactly the shape SOAPNoteModal writes when the clinician clicks Publish.
async function publish(note, { withHistory = true } = {}) {
  const result = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT',
    token: clinician.user.token,
    body: {
      status: 'published',
      published_date: new Date().toISOString(),
      published_by: clinician.user.email,
      ...(withHistory
        ? {
            history: [{
              timestamp: new Date().toISOString(),
              user_email: clinician.user.email,
              action: 'published',
            }],
          }
        : {}),
    },
  });
  assert.equal(result.status, 200, result.text);
  return result.body;
}

function amendmentBody(note, overrides = {}) {
  return {
    subjective: note.subjective,
    objective: note.objective,
    assessment: note.assessment,
    plan: `${note.plan}\n\nAmended after review.`,
    status: 'published',
    published_date: note.published_date,
    published_by: note.published_by,
    history: [
      ...(Array.isArray(note.history) ? note.history : []),
      {
        timestamp: new Date().toISOString(),
        user_email: clinician.user.email,
        action: 'amended',
      },
    ],
    ...overrides,
  };
}

before(async () => {
  server = await startTestServer();
  adminToken = await loginAdmin(server);
  clinician = await provisionClinician('primary');
  clinicianOrg = clinician.org;
  second = await provisionClinician('second');
  secondOrg = second.org;
  await joinOrganization(second.user, clinicianOrg);
  outsider = second;
  // N14 needs the primary clinician to hold a SECOND, legitimate org
  // membership, so that supplying secondOrg.id on an amendment passes the
  // ordinary org-scope check (writeAuthDenied) and reaches the
  // identity-pin under test in publishedNoteMutationDenied, rather than
  // being refused earlier by "org_id is outside your organisations".
  await joinOrganization(clinician.user, secondOrg);

  const created = await requestJson(server, route('/entities/Client'), {
    method: 'POST',
    token: clinician.user.token,
    body: { org_id: clinicianOrg.id, full_name: 'Synthetic Immutability Patient' },
  });
  assert.equal(created.status, 200, created.text);
  client = created.body;
  assert.ok(secondOrg.id);
});

after(async () => {
  if (server) await server.stop();
});

test('N01 draft notes stay freely editable', async () => {
  const note = await createNote();
  const result = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT', token: clinician.user.token, body: { plan: 'x' },
  });
  assert.equal(result.status, 200, result.text);
  assert.equal(result.body.plan, 'x');
});

test('N02 the protocol-import write shape is refused on a published note', async () => {
  const note = await publish(await createNote());
  const result = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT',
    token: clinician.user.token,
    body: { plan: `${note.plan}\n\nTREATMENT PROTOCOL: Dementia\n\nEXERCISE PRESCRIPTION:\n` },
  });
  assert.equal(result.status, 409, result.text);
  assert.equal(result.body?.message, REFUSAL, result.text);
});

test('N03 a refused write leaves the record byte-identical', async () => {
  const note = await publish(await createNote());
  const before_ = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    token: clinician.user.token,
  });
  assert.equal(before_.status, 200, before_.text);

  const refused = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT', token: clinician.user.token, body: { plan: 'silently rewritten' },
  });
  assert.equal(refused.status, 409, refused.text);

  const after_ = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    token: clinician.user.token,
  });
  assert.equal(after_.status, 200, after_.text);
  assert.deepEqual(after_.body, before_.body);
});

test('N04 a sanctioned amendment succeeds, including on a legacy note with no history', async () => {
  const note = await publish(await createNote());
  const amended = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT', token: clinician.user.token, body: amendmentBody(note),
  });
  assert.equal(amended.status, 200, amended.text);
  assert.equal(amended.body.history.length, 2);
  assert.equal(amended.body.history[1].action, 'amended');

  // R2: rows published before the history field existed carry no array at
  // all. If the guard treated that as a mismatch, every legacy published
  // note would become permanently unamendable.
  const legacy = await publish(await createNote(), { withHistory: false });
  assert.equal(legacy.history, undefined);
  const legacyAmended = await requestJson(server, route(`/entities/SOAPNote/${legacy.id}`), {
    method: 'PUT', token: clinician.user.token, body: amendmentBody(legacy),
  });
  assert.equal(legacyAmended.status, 200, legacyAmended.text);
  assert.equal(legacyAmended.body.history.length, 1);
});

test('N05 an amendment cannot be attributed to another user', async () => {
  const note = await publish(await createNote());
  const body = amendmentBody(note);
  body.history[body.history.length - 1].user_email = outsider.user.email;
  const result = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT', token: clinician.user.token, body,
  });
  assert.equal(result.status, 409, result.text);
  assert.equal(result.body?.message, REFUSAL, result.text);
});

test('N06 prior history cannot be rewritten or truncated', async () => {
  const note = await publish(await createNote());

  const rewritten = amendmentBody(note);
  rewritten.history[0] = { ...rewritten.history[0], action: 'published', user_email: 'someone.else@example.test' };
  const rewrittenResult = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT', token: clinician.user.token, body: rewritten,
  });
  assert.equal(rewrittenResult.status, 409, rewrittenResult.text);

  const truncated = amendmentBody(note);
  truncated.history = [truncated.history[truncated.history.length - 1]];
  const truncatedResult = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT', token: clinician.user.token, body: truncated,
  });
  assert.equal(truncatedResult.status, 409, truncatedResult.text);

  const missingTimestamp = amendmentBody(note);
  missingTimestamp.history[missingTimestamp.history.length - 1].timestamp = 'not-a-timestamp';
  const missingResult = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT', token: clinician.user.token, body: missingTimestamp,
  });
  assert.equal(missingResult.status, 409, missingResult.text);
});

test('N07 unpublishing is refused', async () => {
  const note = await publish(await createNote());
  const result = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT', token: clinician.user.token, body: { status: 'draft' },
  });
  assert.equal(result.status, 409, result.text);
  assert.equal(result.body?.message, REFUSAL, result.text);
});

test('N08 published_date and published_by cannot be reassigned', async () => {
  const note = await publish(await createNote());
  const reassignedBy = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT',
    token: clinician.user.token,
    body: amendmentBody(note, { published_by: outsider.user.email }),
  });
  assert.equal(reassignedBy.status, 409, reassignedBy.text);

  const reassignedDate = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT',
    token: clinician.user.token,
    body: amendmentBody(note, { published_date: new Date(Date.now() + 86_400_000).toISOString() }),
  });
  assert.equal(reassignedDate.status, 409, reassignedDate.text);
});

test('N09 attachment and audio-only writes during an amendment still succeed', async () => {
  const note = await publish(await createNote());
  const attachments = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT',
    token: clinician.user.token,
    body: { plan_attachments: [{ file_name: 'scan.pdf', uploaded_at: new Date().toISOString() }] },
  });
  assert.equal(attachments.status, 200, attachments.text);

  const audio = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT',
    token: clinician.user.token,
    body: { session_audio_urls: [], session_audio_url: '' },
  });
  assert.equal(audio.status, 200, audio.text);

  // An empty payload is not an "additive-only" write — it must not slip past.
  const empty = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT', token: clinician.user.token, body: {},
  });
  assert.equal(empty.status, 409, empty.text);

  // Nor may a plan ride alongside a permitted attachment key.
  const smuggled = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT',
    token: clinician.user.token,
    body: { plan_attachments: [], plan: 'smuggled' },
  });
  assert.equal(smuggled.status, 409, smuggled.text);
});

test('N10 bulkUpdate cannot bypass the guard', async () => {
  const note = await publish(await createNote());
  const result = await requestJson(server, route('/entities/SOAPNote/bulk'), {
    method: 'PUT',
    token: clinician.user.token,
    body: [{ id: note.id, plan: 'bulk rewrite' }],
  });
  assert.equal(result.status, 409, result.text);
  assert.equal(result.body?.message, REFUSAL, result.text);

  const reread = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    token: clinician.user.token,
  });
  assert.equal(reread.body.plan, note.plan);
});

test('N11 updateMany cannot bypass the guard', async () => {
  const note = await publish(await createNote());
  const result = await requestJson(server, route('/entities/SOAPNote/update-many'), {
    method: 'PATCH',
    token: clinician.user.token,
    body: { query: { id: note.id }, data: { plan: 'sweeping rewrite' } },
  });
  assert.equal(result.status, 409, result.text);
  assert.equal(result.body?.message, REFUSAL, result.text);

  const reread = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    token: clinician.user.token,
  });
  assert.equal(reread.body.plan, note.plan);
});

test('N12 cross-tenant refusal is unchanged and still wins over the new guard', async () => {
  const note = await publish(await createNote());
  const stranger = await provisionClinician('stranger');
  const result = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT', token: stranger.user.token, body: { plan: 'cross tenant rewrite' },
  });
  assert.equal(result.status, 404, result.text);
  assert.equal(result.body?.message, 'record not found', result.text);
});

test('N10b bulk publish-then-tamper in one array is refused, baseline unchanged', async () => {
  // The confirmed critical bypass: item 1 publishes the note, item 2 rewrites
  // its content in the SAME request. Validating both against a pre-write
  // snapshot let item 2 pass because the snapshot still showed a draft.
  const note = await createNote();
  const result = await requestJson(server, route('/entities/SOAPNote/bulk'), {
    method: 'PUT',
    token: clinician.user.token,
    body: [
      {
        id: note.id,
        status: 'published',
        published_date: new Date().toISOString(),
        published_by: clinician.user.email,
        history: [{
          timestamp: new Date().toISOString(),
          user_email: clinician.user.email,
          action: 'published',
        }],
      },
      { id: note.id, subjective: 'TAMPERED-VIA-BULK', plan: 'TAMPERED-PLAN' },
    ],
  });
  assert.equal(result.status, 409, result.text);

  const reread = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    token: clinician.user.token,
  });
  assert.equal(reread.status, 200, reread.text);
  assert.equal(reread.body.status, 'draft');
  assert.equal(reread.body.subjective, note.subjective);
  assert.equal(reread.body.plan, note.plan);
});

test('N10c three duplicate amendments in one bulk array are refused, not silently multiply-applied', async () => {
  // The second confirmed variant: three valid-looking amendments for the SAME
  // already-published note in one array. Each was validated against the same
  // pre-write snapshot, so all three applied while only one 'amended' history
  // entry was ever recorded.
  const note = await publish(await createNote());
  const result = await requestJson(server, route('/entities/SOAPNote/bulk'), {
    method: 'PUT',
    token: clinician.user.token,
    body: [
      { id: note.id, ...amendmentBody(note, { subjective: 'AMEND-1' }) },
      { id: note.id, ...amendmentBody(note, { subjective: 'AMEND-2' }) },
      { id: note.id, ...amendmentBody(note, { subjective: 'AMEND-3' }) },
    ],
  });
  // Duplicate ids in one bulk array are refused outright; if duplicates were
  // ever tolerated in future, at most one content rewrite may land per
  // recorded 'amended' entry — never three rewrites behind one entry.
  assert.equal(result.status, 409, result.text);

  const reread = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    token: clinician.user.token,
  });
  assert.equal(reread.body.subjective, note.subjective);
  assert.equal((reread.body.history || []).length, 1);
});

test('N13 TOCTOU: a stalled chunked PUT cannot land tampered content by racing a publish', async () => {
  // The guard read `existing` before the awaited body read. Because the body
  // stream is caller-paced (chunked transfer-encoding), an attacker can hold
  // that await open, let a second request publish the note in the meantime,
  // then finish the body — the guard evaluates against the pre-publish
  // (draft) snapshot it captured before either await, and the write lands on
  // the now-published record with no amendment entry.
  const note = await createNote();
  const requestPath = route(`/entities/SOAPNote/${note.id}`);
  const socket = net.connect(server.listenerPort, '127.0.0.1');
  await once(socket, 'connect');
  const head =
    `PUT ${requestPath} HTTP/1.1\r\n`
    + `Host: 127.0.0.1:${server.listenerPort}\r\n`
    + `X-App-Id: ${server.appId}\r\n`
    + `Authorization: Bearer ${clinician.user.token}\r\n`
    + 'Content-Type: application/json\r\n'
    + 'Transfer-Encoding: chunked\r\n'
    + 'Connection: close\r\n\r\n';
  socket.write(head);
  const firstChunk = '{"subjective":"TAMPERED-VIA-RACE",';
  socket.write(`${firstChunk.length.toString(16)}\r\n${firstChunk}\r\n`);

  // Give the stalled request's body-await a moment to actually be pending,
  // then publish the note through an ordinary, complete request.
  await delay(300);
  const published = await publish(note);
  assert.equal(published.status, 'published');

  const secondChunk = '"plan":"TAMPERED-PLAN"}';
  socket.write(`${secondChunk.length.toString(16)}\r\n${secondChunk}\r\n0\r\n\r\n`);

  const raw = await new Promise((resolve, reject) => {
    let buffer = '';
    socket.on('data', (chunk) => { buffer += chunk.toString('utf8'); });
    socket.on('end', () => resolve(buffer));
    socket.on('error', reject);
  });
  const statusLine = raw.split('\r\n')[0];
  assert.match(statusLine, /409/, raw);

  const reread = await requestJson(server, requestPath, { token: clinician.user.token });
  assert.equal(reread.status, 200, reread.text);
  assert.equal(reread.body.status, 'published');
  assert.equal(reread.body.subjective, note.subjective);
  assert.equal(reread.body.plan, note.plan);
  assert.equal((reread.body.history || []).length, 1);
  assert.equal(reread.body.history[0].action, 'published');
});

test('N14 an amendment cannot reattach a published note to a different client or org', async () => {
  const note = await publish(await createNote());
  const otherClient = await requestJson(server, route('/entities/Client'), {
    method: 'POST',
    token: clinician.user.token,
    body: { org_id: clinicianOrg.id, full_name: 'Synthetic Second Patient' },
  });
  assert.equal(otherClient.status, 200, otherClient.text);

  const reattachedClient = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT',
    token: clinician.user.token,
    body: amendmentBody(note, { client_id: otherClient.body.id }),
  });
  assert.equal(reattachedClient.status, 409, reattachedClient.text);
  assert.equal(reattachedClient.body?.message, REFUSAL, reattachedClient.text);

  const reparentedOrg = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT',
    token: clinician.user.token,
    body: amendmentBody(note, { org_id: secondOrg.id }),
  });
  assert.equal(reparentedOrg.status, 409, reparentedOrg.text);
  assert.equal(reparentedOrg.body?.message, REFUSAL, reparentedOrg.text);

  const reread = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    token: clinician.user.token,
  });
  assert.equal(reread.body.client_id, note.client_id);
  assert.equal(reread.body.org_id, note.org_id);

  // The same pin applies through bulkUpdate.
  const bulkReattach = await requestJson(server, route('/entities/SOAPNote/bulk'), {
    method: 'PUT',
    token: clinician.user.token,
    body: [{ id: note.id, ...amendmentBody(note, { client_id: otherClient.body.id }) }],
  });
  assert.equal(bulkReattach.status, 409, bulkReattach.text);

  // A sanctioned amendment that resends the SAME client_id/org_id (exactly
  // what SOAPNoteModal does on every amendment save) must still succeed.
  const sanctioned = await requestJson(server, route(`/entities/SOAPNote/${note.id}`), {
    method: 'PUT',
    token: clinician.user.token,
    body: amendmentBody(note, { client_id: note.client_id, org_id: note.org_id }),
  });
  assert.equal(sanctioned.status, 200, sanctioned.text);
});
