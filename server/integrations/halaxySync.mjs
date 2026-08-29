import { createEntityRepository } from '../db.mjs';
import { HalaxyApiError } from './halaxy.mjs';

const PROVIDER_ID = 'halaxy';
const PAGE_SIZE = 100;
const MAX_PAGES_PER_RESOURCE = 100;
const REMOTE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

function syncError(message, code = 'halaxy_sync_failed', status = 502) {
  const error = new HalaxyApiError(message, { code, status });
  return error;
}

function cleanRemoteId(value, label = 'resource') {
  const id = String(value || '').trim();
  if (!REMOTE_ID_PATTERN.test(id)) {
    throw syncError(`Halaxy returned an invalid ${label} identifier.`, 'halaxy_resource_invalid');
  }
  return id;
}

function cleanText(value, max = 500) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isIsoDateTime(value) {
  return typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value));
}

function remoteVersion(resource) {
  return cleanText(resource?.meta?.versionId || resource?.meta?.lastUpdated || '', 200) || null;
}

function bundleResources(bundle, resourceType) {
  if (bundle?.resourceType !== 'Bundle' || !Array.isArray(bundle.entry)) {
    throw syncError(`Halaxy returned an invalid ${resourceType} collection.`, 'halaxy_invalid_response');
  }
  return bundle.entry
    .map((entry) => entry?.resource)
    .filter((resource) => resource?.resourceType === resourceType && resource?.id);
}

async function fetchAllResources(client, resourceType, { updatedAfter = null } = {}) {
  const resources = [];
  for (let page = 1; page <= MAX_PAGES_PER_RESOURCE; page += 1) {
    const query = new URLSearchParams({
      page: String(page),
      _count: String(PAGE_SIZE),
      pagination: 'true',
      _summary: 'false',
      _sort: resourceType === 'Appointment' ? 'date' : '_lastUpdated',
    });
    if (updatedAfter) query.set('_lastUpdated', `gt${updatedAfter}`);
    const result = await client.request(`/${resourceType}?${query.toString()}`);
    const pageResources = bundleResources(result.body, resourceType);
    resources.push(...pageResources);
    const total = Number(result.body?.total);
    const complete = pageResources.length < PAGE_SIZE
      || (Number.isFinite(total) && resources.length >= total);
    if (complete) return resources;
  }
  throw syncError(
    `Halaxy returned more than ${PAGE_SIZE * MAX_PAGES_PER_RESOURCE} ${resourceType} records in one sync window. Narrow the sync window and retry.`,
    'halaxy_sync_window_too_large',
    409,
  );
}

function patientName(resource) {
  const names = Array.isArray(resource?.name) ? resource.name : [];
  const selected = names.find((name) => name?.use === 'usual')
    || names.find((name) => name?.use === 'official')
    || names[0];
  if (!selected) return '';
  if (cleanText(selected.text, 200)) return cleanText(selected.text, 200);
  return cleanText([...(selected.prefix || []), ...(selected.given || []), selected.family].filter(Boolean).join(' '), 200);
}

function telecomValue(resource, systems) {
  const contacts = Array.isArray(resource?.telecom) ? resource.telecom : [];
  for (const system of systems) {
    const match = contacts.find((entry) => entry?.system === system && cleanText(entry.value, 200));
    if (match) return cleanText(match.value, 200);
  }
  return '';
}

function patientAddress(resource) {
  const address = Array.isArray(resource?.address) ? resource.address[0] : null;
  if (!address) return '';
  if (cleanText(address.text, 500)) return cleanText(address.text, 500);
  return cleanText([
    ...(Array.isArray(address.line) ? address.line : []),
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ].filter(Boolean).join(', '), 500);
}

function localGender(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'male' || normalized === 'female') return normalized;
  if (normalized === 'other' || normalized === 'custom gender') return 'other';
  return 'prefer_not_to_say';
}

export function patientFromHalaxy(resource, { orgId, clinicianEmail }) {
  const fullName = patientName(resource);
  const dateOfBirth = String(resource?.birthDate || '');
  if (!fullName || !isIsoDate(dateOfBirth)) return null;
  const email = telecomValue(resource, ['email']);
  const phone = telecomValue(resource, ['sms', 'phone']);
  const address = patientAddress(resource);
  return {
    org_id: orgId,
    assigned_clinician_email: clinicianEmail,
    full_name: fullName,
    date_of_birth: dateOfBirth,
    gender: localGender(resource?.gender),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(address ? { address } : {}),
    consent_confirmed: false,
  };
}

function splitName(fullName) {
  const parts = cleanText(fullName, 200).split(' ').filter(Boolean);
  if (parts.length < 2) return { given: parts, family: parts[0] || 'Unknown' };
  return { given: parts.slice(0, -1), family: parts.at(-1) };
}

function halaxyGender(client) {
  if (client.gender === 'male' || client.gender === 'female' || client.gender === 'other') return client.gender;
  return 'other';
}

export function patientToHalaxy(client) {
  if (!cleanText(client?.full_name, 200) || !isIsoDate(client?.date_of_birth)) return null;
  const { given, family } = splitName(client.full_name);
  const telecom = [];
  if (cleanText(client.phone, 200)) telecom.push({ system: 'phone', value: cleanText(client.phone, 200), use: 'mobile' });
  if (cleanText(client.email, 200)) telecom.push({ system: 'email', value: cleanText(client.email, 200), use: 'home' });
  return {
    resourceType: 'Patient',
    active: true,
    name: [{ use: 'official', text: cleanText(client.full_name, 200), given, family }],
    birthDate: client.date_of_birth,
    gender: halaxyGender(client),
    ...(telecom.length ? { telecom } : {}),
    ...(cleanText(client.address, 500) ? { address: [{ text: cleanText(client.address, 500) }] } : {}),
  };
}

function referenceId(reference, resourceType) {
  const text = String(reference || '').split(/[?#]/, 1)[0];
  const match = new RegExp(`(?:^|/)${resourceType}/([^/]+)$`).exec(text);
  if (!match) return null;
  try {
    return cleanRemoteId(decodeURIComponent(match[1]), resourceType);
  } catch {
    return null;
  }
}

function appointmentPatientId(resource) {
  for (const participant of Array.isArray(resource?.participant) ? resource.participant : []) {
    if (participant?.actor?.type === 'Patient' || String(participant?.actor?.reference || '').includes('/Patient/')) {
      const id = referenceId(participant.actor.reference, 'Patient');
      if (id) return id;
    }
  }
  return null;
}

function appointmentPatientStatus(resource) {
  const participant = (Array.isArray(resource?.participant) ? resource.participant : []).find((entry) => (
    entry?.actor?.type === 'Patient' || String(entry?.actor?.reference || '').includes('/Patient/')
  ));
  const extension = (Array.isArray(participant?.modifierExtension) ? participant.modifierExtension : []).find((entry) => (
    String(entry?.url || '').endsWith('/appointment-participant-status')
  ));
  return cleanText(extension?.valueCoding?.code || participant?.status || resource?.status, 80).toLowerCase();
}

function localAppointmentStatus(resource) {
  const status = appointmentPatientStatus(resource);
  if (['cancelled', 'cancelled (no charge)', 'declined', 'rejected'].includes(status)) return 'cancelled';
  if (status === 'did not attend') return 'no_show';
  if (['attended', 'fulfilled', 'complete', 'completed'].includes(status)) return 'completed';
  return 'scheduled';
}

export function appointmentFromHalaxy(resource, { orgId, clientId }) {
  if (!isIsoDateTime(resource?.start) || !isIsoDateTime(resource?.end) || !clientId) return null;
  const description = cleanText(resource.description || resource.comment || '', 1_000);
  return {
    org_id: orgId,
    title: description || 'Halaxy appointment',
    client_id: clientId,
    start_time: new Date(resource.start).toISOString(),
    end_time: new Date(resource.end).toISOString(),
    ...(description ? { notes: description } : {}),
    status: localAppointmentStatus(resource),
  };
}

function remoteAppointmentStatus(status) {
  if (status === 'completed') return 'attended';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'no_show') return 'did not attend';
  return 'booked';
}

function patientParticipant(client, patientRemoteId, appointmentStatus, baseUrl) {
  const terminologyOrigin = new URL(baseUrl).origin;
  return {
    actor: {
      reference: `${baseUrl}/Patient/${cleanRemoteId(patientRemoteId, 'Patient')}`,
      type: 'Patient',
      display: cleanText(client?.full_name, 200),
    },
    modifierExtension: [{
      url: 'https://terminology.halaxy.com/StructureDefinition/appointment-participant-status',
      valueCoding: {
        system: `${terminologyOrigin}/presets/CodeSystem/appointment-participant-status`,
        code: remoteAppointmentStatus(appointmentStatus),
      },
    }],
  };
}

function appointmentResource(local, client, patientRemoteId, baseUrl) {
  if (!isIsoDateTime(local?.start_time) || !isIsoDateTime(local?.end_time)) return null;
  const start = new Date(local.start_time);
  const end = new Date(local.end_time);
  if (end <= start) return null;
  return {
    resourceType: 'Appointment',
    start: start.toISOString(),
    end: end.toISOString(),
    minutesDuration: Math.max(1, Math.round((end - start) / 60_000)),
    description: cleanText(local.notes || local.title || 'AssessSuite appointment', 1_000),
    participant: [patientParticipant(client, patientRemoteId, local.status, baseUrl)],
  };
}

function resourceFromProviderResponse(body, resourceType) {
  if (body?.resourceType === resourceType) return body;
  const parameterResource = (Array.isArray(body?.parameter) ? body.parameter : [])
    .map((entry) => entry?.resource)
    .find((resource) => resource?.resourceType === resourceType);
  return parameterResource || null;
}

function warning(summary, type, remoteOrLocalId, reason) {
  summary.skipped += 1;
  if (summary.warnings.length < 50) summary.warnings.push({ type, id: String(remoteOrLocalId || ''), reason });
}

function makeSummary() {
  return {
    patients: { imported: 0, updated: 0, exported: 0, skipped: 0, warnings: [] },
    appointments: { imported: 0, updated: 0, exported: 0, skipped: 0, warnings: [] },
  };
}

function shouldExport(local, mapping, touchedLocalIds) {
  if (touchedLocalIds.has(local.id)) return false;
  if (!mapping) return true;
  const localUpdated = Date.parse(local.updated_date || local.created_date || '');
  const synced = Date.parse(mapping.lastSyncedAt || '');
  return Number.isFinite(localUpdated) && (!Number.isFinite(synced) || localUpdated > synced);
}

function validOptionalConfigId(value, label) {
  const clean = String(value || '').trim();
  if (!clean) return null;
  return cleanRemoteId(clean, label);
}

export async function syncHalaxy({
  db,
  connectionRepository,
  halaxyClient,
  connection,
  orgId,
  actorUserId,
  actorEmail,
  now = () => new Date(),
}) {
  if (!db || !connectionRepository || !halaxyClient || !connection || !orgId) {
    throw new TypeError('Halaxy sync dependencies are required');
  }
  const settings = connection.settings || {};
  const syncStartedAt = now().toISOString();
  const previousCursor = cleanText(connection.capabilities?.last_sync_started_at || '', 64) || null;
  const clients = createEntityRepository(db, 'Client');
  const appointments = createEntityRepository(db, 'Appointment');
  const summary = makeSummary();
  const importedClientIds = new Set();
  const importedAppointmentIds = new Set();

  if (settings.import_patients !== false) {
    const remotePatients = await fetchAllResources(halaxyClient, 'Patient', { updatedAfter: previousCursor });
    for (const remote of remotePatients) {
      const remoteId = cleanRemoteId(remote.id, 'Patient');
      const payload = patientFromHalaxy(remote, { orgId, clinicianEmail: actorEmail });
      if (!payload) {
        warning(summary.patients, 'Patient', remoteId, 'A name and valid birth date are required for AssessSuite.');
        continue;
      }
      const mapping = connectionRepository.getResourceMapByRemote(orgId, PROVIDER_ID, 'Patient', remoteId);
      let local;
      if (mapping) {
        local = clients.getById(mapping.localId);
        if (!local || local.org_id !== orgId) {
          throw syncError('A Halaxy patient mapping points to a missing local patient.', 'halaxy_mapping_invalid', 409);
        }
        const remoteDemographics = { ...payload };
        delete remoteDemographics.consent_confirmed;
        delete remoteDemographics.assigned_clinician_email;
        local = clients.update(local.id, remoteDemographics);
        summary.patients.updated += 1;
      } else {
        local = clients.create(payload, actorEmail);
        summary.patients.imported += 1;
      }
      importedClientIds.add(local.id);
      connectionRepository.putResourceMap({
        orgId, providerId: PROVIDER_ID, resourceType: 'Patient', localEntity: 'Client',
        localId: local.id, remoteId, remoteVersion: remoteVersion(remote), lastSyncedAt: syncStartedAt,
      });
    }
  }

  if (settings.import_appointments !== false) {
    const remoteAppointments = await fetchAllResources(halaxyClient, 'Appointment', { updatedAfter: previousCursor });
    for (const remote of remoteAppointments) {
      const remoteId = cleanRemoteId(remote.id, 'Appointment');
      const remotePatientId = appointmentPatientId(remote);
      const patientMap = remotePatientId
        ? connectionRepository.getResourceMapByRemote(orgId, PROVIDER_ID, 'Patient', remotePatientId)
        : null;
      const payload = appointmentFromHalaxy(remote, { orgId, clientId: patientMap?.localId });
      if (!payload) {
        warning(summary.appointments, 'Appointment', remoteId, 'A mapped patient and valid start/end times are required.');
        continue;
      }
      const mapping = connectionRepository.getResourceMapByRemote(orgId, PROVIDER_ID, 'Appointment', remoteId);
      let local;
      if (mapping) {
        local = appointments.getById(mapping.localId);
        if (!local || local.org_id !== orgId) {
          throw syncError('A Halaxy appointment mapping points to a missing local appointment.', 'halaxy_mapping_invalid', 409);
        }
        local = appointments.update(local.id, payload);
        summary.appointments.updated += 1;
      } else {
        local = appointments.create(payload, actorEmail);
        summary.appointments.imported += 1;
      }
      importedAppointmentIds.add(local.id);
      connectionRepository.putResourceMap({
        orgId, providerId: PROVIDER_ID, resourceType: 'Appointment', localEntity: 'Appointment',
        localId: local.id, remoteId, remoteVersion: remoteVersion(remote), lastSyncedAt: syncStartedAt,
      });
    }
  }

  if (settings.export_patients === true) {
    for (const local of clients.listAll().filter((row) => row.org_id === orgId)) {
      const mapping = connectionRepository.getResourceMapByLocal(orgId, PROVIDER_ID, 'Patient', local.id);
      if (!shouldExport(local, mapping, importedClientIds)) continue;
      const resource = patientToHalaxy(local);
      if (!resource) {
        warning(summary.patients, 'Client', local.id, 'A full name and valid birth date are required for Halaxy.');
        continue;
      }
      const response = mapping
        ? await halaxyClient.request(`/Patient/${cleanRemoteId(mapping.remoteId, 'Patient')}`, { method: 'PATCH', body: resource })
        : await halaxyClient.request('/Patient', { method: 'POST', body: resource });
      const returned = resourceFromProviderResponse(response.body, 'Patient');
      const remoteId = mapping?.remoteId || returned?.id;
      if (!remoteId) throw syncError('Halaxy created a patient without returning its identifier.', 'halaxy_resource_invalid');
      connectionRepository.putResourceMap({
        orgId, providerId: PROVIDER_ID, resourceType: 'Patient', localEntity: 'Client',
        localId: local.id, remoteId: cleanRemoteId(remoteId, 'Patient'),
        remoteVersion: remoteVersion(returned), lastSyncedAt: syncStartedAt,
      });
      summary.patients.exported += 1;
    }
  }

  if (settings.export_appointments === true) {
    const practitionerRoleId = validOptionalConfigId(settings.practitioner_role_id, 'PractitionerRole');
    const healthcareServiceId = validOptionalConfigId(settings.healthcare_service_id, 'HealthcareService');
    if (!practitionerRoleId || !healthcareServiceId) {
      throw syncError(
        'Appointment export requires a default Halaxy practitioner role and appointment type.',
        'halaxy_appointment_export_configuration_required',
        409,
      );
    }
    for (const local of appointments.listAll().filter((row) => row.org_id === orgId)) {
      const mapping = connectionRepository.getResourceMapByLocal(orgId, PROVIDER_ID, 'Appointment', local.id);
      if (!shouldExport(local, mapping, importedAppointmentIds)) continue;
      const patient = clients.getById(local.client_id);
      const patientMap = patient
        ? connectionRepository.getResourceMapByLocal(orgId, PROVIDER_ID, 'Patient', patient.id)
        : null;
      const resource = patientMap
        ? appointmentResource(local, patient, patientMap.remoteId, halaxyClient.baseUrl)
        : null;
      if (!resource) {
        warning(summary.appointments, 'Appointment', local.id, 'A mapped Halaxy patient and valid start/end times are required.');
        continue;
      }
      let response;
      if (mapping) {
        response = await halaxyClient.request(`/Appointment/${cleanRemoteId(mapping.remoteId, 'Appointment')}`, {
          method: 'PATCH', body: resource,
        });
      } else {
        const parameters = {
          resourceType: 'Parameters',
          parameter: [
            {
              name: 'appt-resource',
              resource: {
                ...resource,
                participant: [{
                  actor: {
                    reference: `${halaxyClient.baseUrl}/PractitionerRole/${practitionerRoleId}`,
                    type: 'PractitionerRole',
                  },
                }],
              },
            },
            {
              name: 'patient-id',
              valueReference: {
                reference: `${halaxyClient.baseUrl}/Patient/${cleanRemoteId(patientMap.remoteId, 'Patient')}`,
                type: 'Patient',
              },
            },
            {
              name: 'healthcare-service-id',
              valueReference: {
                reference: `${halaxyClient.baseUrl}/HealthcareService/${healthcareServiceId}`,
                type: 'HealthcareService',
              },
            },
            { name: 'location-type', valueCode: cleanText(settings.location_type || 'clinic', 40) },
            { name: 'status', valueCode: remoteAppointmentStatus(local.status) },
          ],
        };
        response = await halaxyClient.request('/Appointment/$book', { method: 'POST', body: parameters });
      }
      const returned = resourceFromProviderResponse(response.body, 'Appointment');
      const remoteId = mapping?.remoteId || returned?.id;
      if (!remoteId) throw syncError('Halaxy created an appointment without returning its identifier.', 'halaxy_resource_invalid');
      connectionRepository.putResourceMap({
        orgId, providerId: PROVIDER_ID, resourceType: 'Appointment', localEntity: 'Appointment',
        localId: local.id, remoteId: cleanRemoteId(remoteId, 'Appointment'),
        remoteVersion: remoteVersion(returned), lastSyncedAt: syncStartedAt,
      });
      summary.appointments.exported += 1;
    }
  }

  return {
    provider_id: PROVIDER_ID,
    sync_started_at: syncStartedAt,
    sync_completed_at: now().toISOString(),
    previous_cursor: previousCursor,
    summary,
    actor: { id: actorUserId, email: actorEmail },
  };
}
