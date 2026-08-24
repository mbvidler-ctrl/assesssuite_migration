import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  episodeLinkedQuery,
  isLegacyUnassignedRecord,
  legacyUnassignedQuery,
  recordBelongsToEpisode,
  withEpisodeLink,
} from '../../src/lib/physio/episodeLinkage.js';
import { buildEpisodeScopedPhysioClinicalContext } from '../functions/physioAiTask.mjs';
import { createEntityRepository } from '../db.mjs';
import {
  loginAdmin,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

function route(server, value) {
  return `/api/apps/${server.appId}/entities/${value}`;
}

async function create(server, token, entityName, body) {
  const response = await requestJson(server, route(server, entityName), {
    method: 'POST',
    token,
    body,
  });
  assert.equal(response.status, 200, response.text);
  return response.body;
}

async function filter(server, token, entityName, query) {
  const response = await requestJson(
    server,
    `${route(server, entityName)}?q=${encodeURIComponent(JSON.stringify(query))}`,
    { token },
  );
  assert.equal(response.status, 200, response.text);
  return response.body;
}

test('all episode-owned clinical record schemas expose one canonical optional link', () => {
  for (const entityName of [
    'ClientAssessment',
    'SOAPNote',
    'SavedReport',
    'ClientReport',
    'ClientDocument',
  ]) {
    const schema = JSON.parse(read('base44', 'entities', `${entityName}.jsonc`));
    assert.equal(schema.properties.physio_care_episode_id.type, 'string', entityName);
    assert.equal(schema.required?.includes('physio_care_episode_id') || false, false, entityName);
  }
});

test('linkage helpers distinguish an exact episode from explicit legacy-unassigned records', () => {
  const linked = withEpisodeLink({ client_id: 'patient-1', result_value: 0 }, 'episode-1');
  assert.equal(recordBelongsToEpisode(linked, 'episode-1'), true);
  assert.equal(recordBelongsToEpisode(linked, 'episode-2'), false);
  assert.equal(isLegacyUnassignedRecord(linked), false);
  assert.equal(isLegacyUnassignedRecord({ client_id: 'patient-1' }), true);
  assert.deepEqual(episodeLinkedQuery({ clientId: 'patient-1', episodeId: 'episode-1' }), {
    client_id: 'patient-1',
    physio_care_episode_id: 'episode-1',
  });
  assert.equal(legacyUnassignedQuery({ clientId: 'patient-1' }).$or.length, 3);
  assert.equal(linked.result_value, 0, 'a zero score must survive linkage unchanged');
});

test('two concurrent episodes cannot read, create or reassign each other clinical records', async () => {
  const server = await startTestServer({
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
  });
  try {
    const token = await loginAdmin(server);
    const org = await create(server, token, 'Organization', { name: 'Episode Linkage Practice' });
    const otherOrg = await create(server, token, 'Organization', { name: 'Other Linkage Practice' });
    const patient = await create(server, token, 'Client', { org_id: org.id, full_name: 'Episode Patient' });
    const otherPatient = await create(server, token, 'Client', { org_id: org.id, full_name: 'Other Patient' });
    const episodeOne = await create(server, token, 'PhysioCareEpisode', {
      schema_version: 3,
      org_id: org.id,
      client_id: patient.id,
      episode_number: 1,
      status: 'active',
      episode_start_date: '2026-08-01',
    });
    const episodeTwo = await create(server, token, 'PhysioCareEpisode', {
      schema_version: 3,
      org_id: org.id,
      client_id: patient.id,
      episode_number: 99,
      status: 'active',
      episode_start_date: '2026-08-15',
    });
    assert.equal(episodeOne.episode_number, 1);
    assert.equal(episodeTwo.episode_number, 2, 'caller-authored numbering must be ignored');
    const parallelEpisodes = await Promise.all([777, 777].map((episodeNumber) => create(
      server,
      token,
      'PhysioCareEpisode',
      {
        schema_version: 3,
        org_id: org.id,
        client_id: patient.id,
        episode_number: episodeNumber,
        status: 'draft',
        episode_start_date: '2026-08-20',
      },
    )));
    assert.deepEqual(
      parallelEpisodes.map((episode) => episode.episode_number).sort((a, b) => a - b),
      [3, 4],
      'parallel creation must allocate unique server-owned episode numbers',
    );

    const firstEpisodeEdit = await requestJson(
      server,
      route(server, `PhysioCareEpisode/${episodeOne.id}`),
      {
        method: 'PUT',
        token,
        body: {
          title: 'Concurrent edit winner',
          expected_updated_date: episodeOne.updated_date,
        },
      },
    );
    assert.equal(firstEpisodeEdit.status, 200, firstEpisodeEdit.text);
    const staleEpisodeEdit = await requestJson(
      server,
      route(server, `PhysioCareEpisode/${episodeOne.id}`),
      {
        method: 'PUT',
        token,
        body: {
          title: 'Concurrent edit loser',
          expected_updated_date: episodeOne.updated_date,
        },
      },
    );
    assert.equal(staleEpisodeEdit.status, 409, staleEpisodeEdit.text);
    const episodeAfterStaleEdit = await requestJson(
      server,
      route(server, `PhysioCareEpisode/${episodeOne.id}`),
      { token },
    );
    assert.equal(episodeAfterStaleEdit.body.title, 'Concurrent edit winner');

    const unlinkedCreationBodies = {
      ClientAssessment: {
        assessment_id: 'unlinked-assessment-denial',
        status: 'completed',
        result_value: 0,
        assessment_date: '2026-08-01',
      },
      SOAPNote: {
        note_date: '2026-08-01T09:00:00.000Z',
        subjective: 'UNLINKED_SOAP_DENIAL',
      },
      SavedReport: {
        report_type: 'gp_summary',
        report_name: 'UNLINKED_SAVED_REPORT_DENIAL',
        report_date: '2026-08-01',
      },
      ClientReport: {
        report_type: 'gp_summary',
        report_name: 'UNLINKED_CLIENT_REPORT_DENIAL',
        report_date: '2026-08-01',
      },
      ClientDocument: {
        document_type: 'other',
        file_url: 'https://example.invalid/unlinked-document.pdf',
        file_name: 'UNLINKED_DOCUMENT_DENIAL.pdf',
      },
    };
    for (const [entityName, fields] of Object.entries(unlinkedCreationBodies)) {
      const denied = await requestJson(server, route(server, entityName), {
        method: 'POST',
        token,
        body: { org_id: org.id, client_id: patient.id, ...fields },
      });
      assert.equal(denied.status, 400, `${entityName}: ${denied.text}`);
      assert.match(denied.text, /saved Physio care episode is required/, entityName);
      const deniedBulk = await requestJson(server, route(server, `${entityName}/bulk`), {
        method: 'POST',
        token,
        body: [{ org_id: org.id, client_id: patient.id, ...fields }],
      });
      assert.equal(deniedBulk.status, 400, `${entityName} bulk: ${deniedBulk.text}`);
      assert.match(deniedBulk.text, /saved Physio care episode is required/, `${entityName} bulk`);
    }

    const zeroScore = await create(server, token, 'ClientAssessment', {
      org_id: org.id,
      client_id: patient.id,
      physio_care_episode_id: episodeOne.id,
      assessment_id: 'canonical-zero-score',
      status: 'completed',
      result_value: 0,
      notes: 'EPISODE_ONE_ASSESSMENT_CANARY',
      assessment_date: '2026-08-02',
    });
    const secondScore = await create(server, token, 'ClientAssessment', {
      org_id: org.id,
      client_id: patient.id,
      physio_care_episode_id: episodeTwo.id,
      assessment_id: 'canonical-second-score',
      status: 'completed',
      result_value: 17,
      notes: 'EPISODE_TWO_ASSESSMENT_CANARY',
      assessment_date: '2026-08-16',
    });
    const migrationDb = new DatabaseSync(server.dbPath);
    const unassigned = createEntityRepository(migrationDb, 'ClientAssessment').create({
      org_id: org.id,
      client_id: patient.id,
      assessment_id: 'legacy-unassigned-score',
      status: 'completed',
      result_value: 9,
      assessment_date: '2026-07-01',
    }, 'offline-migration');
    migrationDb.close();

    const episodeRecords = {
      SOAPNote: [
        await create(server, token, 'SOAPNote', {
          org_id: org.id,
          client_id: patient.id,
          physio_care_episode_id: episodeOne.id,
          note_date: '2026-08-02T09:00:00.000Z',
          subjective: 'EPISODE_ONE_SOAP_CANARY',
          full_transcript: 'EPISODE_ONE_TRANSCRIPT_CANARY',
          session_audio_url: 'https://example.invalid/episode-one-audio.webm',
          session_audio_urls: [{
            url: 'https://example.invalid/episode-one-audio.webm',
            recorded_at: '2026-08-02T09:00:00.000Z',
            label: 'EPISODE_ONE_AUDIO_CANARY',
          }],
        }),
        await create(server, token, 'SOAPNote', {
          org_id: org.id,
          client_id: patient.id,
          physio_care_episode_id: episodeTwo.id,
          note_date: '2026-08-16T09:00:00.000Z',
          subjective: 'EPISODE_TWO_SOAP_CANARY',
          full_transcript: 'EPISODE_TWO_TRANSCRIPT_CANARY',
          session_audio_url: 'https://example.invalid/episode-two-audio.webm',
          session_audio_urls: [{
            url: 'https://example.invalid/episode-two-audio.webm',
            recorded_at: '2026-08-16T09:00:00.000Z',
            label: 'EPISODE_TWO_AUDIO_CANARY',
          }],
        }),
      ],
      SavedReport: [
        await create(server, token, 'SavedReport', {
          org_id: org.id,
          client_id: patient.id,
          physio_care_episode_id: episodeOne.id,
          report_type: 'gp_summary',
          report_name: 'EPISODE_ONE_SAVED_REPORT_CANARY',
          report_date: '2026-08-03',
          report_html: '<p>EPISODE_ONE_SAVED_REPORT_BODY_CANARY</p>',
        }),
        await create(server, token, 'SavedReport', {
          org_id: org.id,
          client_id: patient.id,
          physio_care_episode_id: episodeTwo.id,
          report_type: 'gp_summary',
          report_name: 'EPISODE_TWO_SAVED_REPORT_CANARY',
          report_date: '2026-08-17',
          report_html: '<p>EPISODE_TWO_SAVED_REPORT_BODY_CANARY</p>',
        }),
      ],
      ClientReport: [
        await create(server, token, 'ClientReport', {
          org_id: org.id,
          client_id: patient.id,
          physio_care_episode_id: episodeOne.id,
          report_type: 'gp_summary',
          report_name: 'EPISODE_ONE_CLIENT_REPORT_CANARY',
          report_date: '2026-08-04',
          report_data: { summary: 'EPISODE_ONE_CLIENT_REPORT_BODY_CANARY' },
        }),
        await create(server, token, 'ClientReport', {
          org_id: org.id,
          client_id: patient.id,
          physio_care_episode_id: episodeTwo.id,
          report_type: 'gp_summary',
          report_name: 'EPISODE_TWO_CLIENT_REPORT_CANARY',
          report_date: '2026-08-18',
          report_data: { summary: 'EPISODE_TWO_CLIENT_REPORT_BODY_CANARY' },
        }),
      ],
      ClientDocument: [
        await create(server, token, 'ClientDocument', {
          org_id: org.id,
          client_id: patient.id,
          physio_care_episode_id: episodeOne.id,
          document_type: 'other',
          file_url: 'https://example.invalid/episode-one-document.pdf',
          file_name: 'EPISODE_ONE_DOCUMENT_CANARY.pdf',
          notes: 'EPISODE_ONE_DOCUMENT_BODY_CANARY',
        }),
        await create(server, token, 'ClientDocument', {
          org_id: org.id,
          client_id: patient.id,
          physio_care_episode_id: episodeTwo.id,
          document_type: 'other',
          file_url: 'https://example.invalid/episode-two-document.pdf',
          file_name: 'EPISODE_TWO_DOCUMENT_CANARY.pdf',
          notes: 'EPISODE_TWO_DOCUMENT_BODY_CANARY',
        }),
      ],
    };

    for (const entityName of ['SavedReport', 'ClientReport']) {
      const original = episodeRecords[entityName][0];
      assert.equal(original.revision_number, 1, `${entityName} starts at revision one`);
      assert.deepEqual(original.revision_history, []);
      const changedField = entityName === 'SavedReport'
        ? { report_name: 'EPISODE_ONE_SAVED_REPORT_REVISED_CANARY' }
        : { notes: 'EPISODE_ONE_CLIENT_REPORT_REVISED_CANARY' };
      const revised = await requestJson(server, route(server, `${entityName}/${original.id}`), {
        method: 'PUT',
        token,
        body: { ...changedField, expected_updated_date: original.updated_date },
      });
      assert.equal(revised.status, 200, `${entityName}: ${revised.text}`);
      assert.equal(revised.body.revision_number, 2);
      assert.equal(revised.body.revision_history.length, 1);
      assert.equal(revised.body.revision_history[0].revision_number, 1);
      assert.equal(revised.body.revision_history[0].actor_email, 'admin@local.test');
      assert.equal(revised.body.revision_history[0].prior_content.report_name, original.report_name);
      const stale = await requestJson(server, route(server, `${entityName}/${original.id}`), {
        method: 'PUT',
        token,
        body: { ...changedField, expected_updated_date: original.updated_date },
      });
      assert.equal(stale.status, 409, `${entityName}: ${stale.text}`);
      episodeRecords[entityName][0] = revised.body;
    }

    const forgedRevision = await requestJson(server, route(server, 'SavedReport'), {
      method: 'POST',
      token,
      body: {
        org_id: org.id,
        client_id: patient.id,
        physio_care_episode_id: episodeOne.id,
        report_type: 'gp_summary',
        report_name: 'FORGED_REPORT_REVISION_DENIAL',
        report_date: '2026-08-05',
        revision_number: 99,
        revision_history: [],
      },
    });
    assert.equal(forgedRevision.status, 403, forgedRevision.text);

    const episodeOneRows = await filter(
      server,
      token,
      'ClientAssessment',
      episodeLinkedQuery({ clientId: patient.id, episodeId: episodeOne.id }),
    );
    const episodeTwoRows = await filter(
      server,
      token,
      'ClientAssessment',
      episodeLinkedQuery({ clientId: patient.id, episodeId: episodeTwo.id }),
    );
    assert.deepEqual(episodeOneRows.map((row) => row.id), [zeroScore.id]);
    assert.equal(episodeOneRows[0].result_value, 0);
    assert.deepEqual(episodeTwoRows.map((row) => row.id), [secondScore.id]);

    const episodeOneContextRecords = { assessment_records: episodeOneRows };
    const contextKeyByEntity = {
      SOAPNote: 'soap_notes',
      SavedReport: 'saved_reports',
      ClientReport: 'client_reports',
      ClientDocument: 'document_records',
    };
    for (const [entityName, [episodeOneRecord, episodeTwoRecord]] of Object.entries(episodeRecords)) {
      const episodeOneEntityRows = await filter(
        server,
        token,
        entityName,
        episodeLinkedQuery({ clientId: patient.id, episodeId: episodeOne.id }),
      );
      const episodeTwoEntityRows = await filter(
        server,
        token,
        entityName,
        episodeLinkedQuery({ clientId: patient.id, episodeId: episodeTwo.id }),
      );
      assert.deepEqual(episodeOneEntityRows.map((row) => row.id), [episodeOneRecord.id], entityName);
      assert.deepEqual(episodeTwoEntityRows.map((row) => row.id), [episodeTwoRecord.id], entityName);
      assert.doesNotMatch(JSON.stringify(episodeOneEntityRows), /EPISODE_TWO_/, entityName);
      assert.doesNotMatch(JSON.stringify(episodeTwoEntityRows), /EPISODE_ONE_/, entityName);
      episodeOneContextRecords[contextKeyByEntity[entityName]] = episodeOneEntityRows;
    }

    const aiContext = buildEpisodeScopedPhysioClinicalContext({
      orgId: org.id,
      episode: episodeOne,
      client: patient,
      records: episodeOneContextRecords,
      clinicianContext: 'Episode one only',
    });
    assert.equal(aiContext.assessment_records.length, 1);
    assert.equal(aiContext.assessment_records[0].result_value, 0, 'zero score must reach AI context');
    assert.equal(aiContext.assessment_records[0].notes, 'EPISODE_ONE_ASSESSMENT_CANARY');
    assert.doesNotMatch(JSON.stringify(aiContext), /EPISODE_TWO_/);
    assert.equal('physio_care_episode_id' in aiContext.assessment_records[0], false);
    assert.equal('client_id' in aiContext.assessment_records[0], false);
    assert.throws(
      () => buildEpisodeScopedPhysioClinicalContext({
        orgId: org.id,
        episode: episodeOne,
        client: patient,
        records: {
          ...episodeOneContextRecords,
          assessment_records: [zeroScore, secondScore],
        },
      }),
      (error) => error?.code === 'care_episode_context_mismatch',
    );

    const wrongPatient = await requestJson(server, route(server, 'SOAPNote'), {
      method: 'POST', token, body: {
        org_id: org.id,
        client_id: otherPatient.id,
        physio_care_episode_id: episodeOne.id,
        note_date: '2026-08-22T09:00:00.000Z',
      },
    });
    assert.equal(wrongPatient.status, 409, wrongPatient.text);

    const wrongOrg = await requestJson(server, route(server, 'ClientDocument'), {
      method: 'POST', token, body: {
        org_id: otherOrg.id,
        client_id: patient.id,
        physio_care_episode_id: episodeOne.id,
        document_type: 'other',
        file_url: '/api/files/synthetic',
        file_name: 'synthetic.txt',
      },
    });
    assert.equal(wrongOrg.status, 404, wrongOrg.text);

    const reassigned = await requestJson(
      server,
      route(server, `ClientAssessment/${zeroScore.id}`),
      { method: 'PUT', token, body: { physio_care_episode_id: episodeTwo.id } },
    );
    assert.equal(reassigned.status, 409, reassigned.text);

    const deletedEpisode = await requestJson(
      server,
      route(server, `PhysioCareEpisode/${episodeOne.id}`),
      { method: 'DELETE', token },
    );
    assert.equal(deletedEpisode.status, 405, deletedEpisode.text);
    const deletedLinkedChild = await requestJson(
      server,
      route(server, `ClientAssessment/${zeroScore.id}`),
      { method: 'DELETE', token },
    );
    assert.equal(deletedLinkedChild.status, 405, deletedLinkedChild.text);

    const unassignedEdit = await requestJson(
      server,
      route(server, `ClientAssessment/${unassigned.id}`),
      { method: 'PUT', token, body: { notes: 'UNASSIGNED_CONTENT_REWRITE_DENIAL' } },
    );
    assert.equal(unassignedEdit.status, 409, unassignedEdit.text);
    const staleAssignment = await requestJson(
      server,
      route(server, `ClientAssessment/${unassigned.id}`),
      {
        method: 'PUT',
        token,
        body: {
          physio_care_episode_id: episodeOne.id,
          expected_updated_date: '1900-01-01T00:00:00.000Z',
        },
      },
    );
    assert.equal(staleAssignment.status, 409, staleAssignment.text);
    const assignmentWithRewrite = await requestJson(
      server,
      route(server, `ClientAssessment/${unassigned.id}`),
      {
        method: 'PUT',
        token,
        body: {
          physio_care_episode_id: episodeOne.id,
          expected_updated_date: unassigned.updated_date,
          notes: 'ASSIGNMENT_CONTENT_REWRITE_DENIAL',
        },
      },
    );
    assert.equal(assignmentWithRewrite.status, 409, assignmentWithRewrite.text);

    const assigned = await requestJson(
      server,
      route(server, `ClientAssessment/${unassigned.id}`),
      {
        method: 'PUT',
        token,
        body: {
          physio_care_episode_id: episodeOne.id,
          expected_updated_date: unassigned.updated_date,
        },
      },
    );
    assert.equal(assigned.status, 200, assigned.text);
    assert.equal(assigned.body.physio_care_episode_id, episodeOne.id);
    assert.equal(assigned.body.result_value, 9);

    const remainingUnassigned = await filter(
      server,
      token,
      'ClientAssessment',
      legacyUnassignedQuery({ clientId: patient.id }),
    );
    assert.equal(remainingUnassigned.length, 0);
  } finally {
    await server.stop();
  }
});

test('episode workspace and child editors carry the link through queries, creation and AI context', () => {
  const workspace = read('src', 'pages', 'PhysioEpisodes.jsx');
  const notes = read('src', 'components', 'client', 'ClientSOAPNotes.jsx');
  const soapModal = read('src', 'components', 'calendar', 'SOAPNoteModal.jsx');
  const reports = read('src', 'components', 'reports', 'UnifiedReportWizard.jsx');
  const documents = read('src', 'components', 'client', 'ClientDocuments.jsx');
  const ai = read('src', 'components', 'physio', 'PhysioAiWorkspace.jsx');
  assert.match(workspace, /episodeLinkedQuery\(\{ clientId: client\.id, episodeId: selected\.id \}\)/);
  assert.match(workspace, /legacyUnassignedQuery\(\{ clientId: client\.id \}\)/);
  assert.match(workspace, /Older unassigned patient records/);
  assert.match(notes, /physio_care_episode_id: careEpisodeId/);
  assert.match(soapModal, /physio_care_episode_id: careEpisodeId/);
  assert.match(reports, /physio_care_episode_id: careEpisodeId/);
  assert.match(documents, /physio_care_episode_id: careEpisodeId/);
  assert.match(ai, /care_episode_id: requestedCareEpisodeId/);
  assert.match(ai, /clinician_context: additionalContext\.trim\(\)/);
  assert.doesNotMatch(ai, /assessment_records/);
});
