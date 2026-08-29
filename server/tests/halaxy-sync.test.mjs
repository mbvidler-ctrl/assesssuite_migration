import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import {
  createEntityRepository,
  createIntegrationConnectionRepository,
} from '../db.mjs';
import {
  appointmentFromHalaxy,
  patientFromHalaxy,
  patientToHalaxy,
  syncHalaxy,
} from '../integrations/halaxySync.mjs';

function createDb() {
  const db = new DatabaseSync(':memory:');
  for (const name of ['Client', 'Appointment']) {
    db.exec(`
      CREATE TABLE entity_${name} (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_date TEXT NOT NULL,
        updated_date TEXT NOT NULL,
        created_by TEXT
      );
    `);
  }
  return db;
}

function bundle(resources) {
  return {
    body: {
      resourceType: 'Bundle',
      type: 'searchset',
      total: resources.length,
      entry: resources.map((resource) => ({ resource })),
    },
    status: 200,
    rateLimit: { limit: 500, remaining: 490 },
  };
}

test('Halaxy FHIR adapters preserve useful patient and appointment fields', () => {
  const patient = patientFromHalaxy({
    resourceType: 'Patient',
    id: 'P-1',
    name: [{ use: 'official', given: ['Alex', 'J'], family: 'Morgan' }],
    birthDate: '1985-04-03',
    gender: 'custom gender',
    telecom: [
      { system: 'email', value: 'alex@example.test' },
      { system: 'sms', value: '+61400000000' },
    ],
    address: [{ line: ['1 Example Street'], city: 'Brisbane', state: 'QLD', postalCode: '4000' }],
  }, { orgId: 'org-1', clinicianEmail: 'clinician@example.test' });
  assert.deepEqual(patient, {
    org_id: 'org-1',
    assigned_clinician_email: 'clinician@example.test',
    full_name: 'Alex J Morgan',
    date_of_birth: '1985-04-03',
    gender: 'other',
    email: 'alex@example.test',
    phone: '+61400000000',
    address: '1 Example Street, Brisbane, QLD, 4000',
    consent_confirmed: false,
  });
  assert.equal(patientFromHalaxy({ name: [{ text: 'Missing DOB' }] }, { orgId: 'org-1' }), null);
  assert.equal(patientToHalaxy({ full_name: 'Invalid Patient' }), null);

  const appointment = appointmentFromHalaxy({
    resourceType: 'Appointment',
    id: 'A-1',
    start: '2026-09-01T09:00:00+10:00',
    end: '2026-09-01T10:00:00+10:00',
    description: 'Initial physiotherapy consultation',
    participant: [{
      actor: { type: 'Patient', reference: '/main/Patient/P-1' },
      modifierExtension: [{
        url: 'https://terminology.halaxy.com/StructureDefinition/appointment-participant-status',
        valueCoding: { code: 'attended' },
      }],
    }],
  }, { orgId: 'org-1', clientId: 'client-1' });
  assert.equal(appointment.status, 'completed');
  assert.equal(appointment.client_id, 'client-1');
  assert.equal(appointment.title, 'Initial physiotherapy consultation');
});

test('Halaxy sync imports and exports patients and appointments idempotently', async () => {
  const db = createDb();
  const clients = createEntityRepository(db, 'Client');
  const appointments = createEntityRepository(db, 'Appointment');
  const mappings = createIntegrationConnectionRepository(db, {
    now: () => new Date('2030-01-01T00:00:00.000Z'),
  });
  const localPatient = clients.create({
    org_id: 'org-1',
    full_name: 'Local Export Patient',
    date_of_birth: '1990-05-06',
    gender: 'female',
    email: 'local@example.test',
    consent_confirmed: true,
  }, 'owner@example.test');
  const localAppointment = appointments.create({
    org_id: 'org-1',
    title: 'Local appointment',
    client_id: localPatient.id,
    start_time: '2030-01-05T00:00:00.000Z',
    end_time: '2030-01-05T01:00:00.000Z',
    status: 'scheduled',
  }, 'owner@example.test');

  const remotePatient = {
    resourceType: 'Patient', id: 'P-REMOTE', meta: { versionId: '7' },
    name: [{ use: 'official', text: 'Remote Patient' }],
    birthDate: '1980-02-03', gender: 'male',
  };
  const remoteAppointment = {
    resourceType: 'Appointment', id: 'A-REMOTE', meta: { versionId: '8' },
    start: '2030-01-06T00:00:00.000Z', end: '2030-01-06T00:30:00.000Z',
    description: 'Remote appointment',
    participant: [{ actor: { type: 'Patient', reference: '/main/Patient/P-REMOTE' } }],
  };
  const calls = [];
  const halaxyClient = {
    baseUrl: 'https://au-api.halaxy.com/main',
    async request(pathname, options = {}) {
      calls.push({ pathname, options });
      if (pathname.startsWith('/Patient?')) return bundle([remotePatient]);
      if (pathname.startsWith('/Appointment?')) return bundle([remoteAppointment]);
      if (pathname === '/Patient' && options.method === 'POST') {
        return { body: { ...options.body, id: 'P-EXPORTED', meta: { versionId: '1' } }, status: 201 };
      }
      if (pathname === '/Appointment/$book' && options.method === 'POST') {
        return { body: { resourceType: 'Appointment', id: 'A-EXPORTED', meta: { versionId: '1' } }, status: 201 };
      }
      throw new Error(`Unexpected Halaxy call: ${options.method || 'GET'} ${pathname}`);
    },
  };
  const connection = {
    settings: {
      import_patients: true,
      import_appointments: true,
      export_patients: true,
      export_appointments: true,
      practitioner_role_id: 'PR-123',
      healthcare_service_id: '33',
      location_type: 'clinic',
    },
    capabilities: {},
  };

  const result = await syncHalaxy({
    db,
    connectionRepository: mappings,
    halaxyClient,
    connection,
    orgId: 'org-1',
    actorUserId: 'owner-1',
    actorEmail: 'owner@example.test',
    now: () => new Date('2030-01-01T00:00:00.000Z'),
  });

  assert.deepEqual(result.summary.patients, {
    imported: 1, updated: 0, exported: 1, skipped: 0, warnings: [],
  });
  assert.deepEqual(result.summary.appointments, {
    imported: 1, updated: 0, exported: 1, skipped: 0, warnings: [],
  });
  assert.equal(clients.listAll().length, 2);
  assert.equal(appointments.listAll().length, 2);
  assert.equal(clients.getById(localPatient.id).consent_confirmed, true);
  assert.equal(mappings.getResourceMapByRemote('org-1', 'halaxy', 'Patient', 'P-REMOTE').localEntity, 'Client');
  assert.equal(mappings.getResourceMapByLocal('org-1', 'halaxy', 'Patient', localPatient.id).remoteId, 'P-EXPORTED');
  assert.equal(mappings.getResourceMapByLocal('org-1', 'halaxy', 'Appointment', localAppointment.id).remoteId, 'A-EXPORTED');

  const booking = calls.find((call) => call.pathname === '/Appointment/$book');
  assert.equal(booking.options.body.resourceType, 'Parameters');
  assert.ok(booking.options.body.parameter.some((entry) => entry.name === 'patient-id'));
  assert.ok(booking.options.body.parameter.some((entry) => entry.name === 'healthcare-service-id'));

  db.close();
});

test('resource maps reject contradictory local/remote pairings', () => {
  const db = createDb();
  const mappings = createIntegrationConnectionRepository(db);
  mappings.putResourceMap({
    orgId: 'org-1', providerId: 'halaxy', resourceType: 'Patient', localEntity: 'Client',
    localId: 'local-1', remoteId: 'remote-1',
  });
  assert.throws(() => mappings.putResourceMap({
    orgId: 'org-1', providerId: 'halaxy', resourceType: 'Patient', localEntity: 'Client',
    localId: 'local-1', remoteId: 'remote-2',
  }), (error) => error?.code === 'integration_resource_mapping_conflict');
  db.close();
});
