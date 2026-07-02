// Ported from base44/functions/fixMissingOrgIds/entry.ts.
// Admin-only: backfills org_id on SOAPNote/Appointment/ClientAssessment
// records from their linked Client, where missing.

export default async function fixMissingOrgIds(ctx) {
  const { user, entities, respond } = ctx;

  if (user?.role !== 'admin') {
    return respond(403, { error: 'Forbidden: Admin access required' });
  }

  const results = {
    soapNotesUpdated: 0,
    appointmentsUpdated: 0,
    clientAssessmentsUpdated: 0,
    errors: [],
  };

  try {
    const allSOAPNotes = await entities.SOAPNote.list();
    for (const note of allSOAPNotes) {
      if (!note.org_id && note.client_id) {
        try {
          const client = await entities.Client.get(note.client_id);
          if (client && client.org_id) {
            await entities.SOAPNote.update(note.id, { org_id: client.org_id });
            results.soapNotesUpdated++;
          }
        } catch (err) {
          results.errors.push(`SOAP Note ${note.id}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    results.errors.push(`SOAP Notes fetch error: ${err.message}`);
  }

  try {
    const allAppointments = await entities.Appointment.list();
    for (const appointment of allAppointments) {
      if (!appointment.org_id && appointment.client_id) {
        try {
          const client = await entities.Client.get(appointment.client_id);
          if (client && client.org_id) {
            await entities.Appointment.update(appointment.id, { org_id: client.org_id });
            results.appointmentsUpdated++;
          }
        } catch (err) {
          results.errors.push(`Appointment ${appointment.id}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    results.errors.push(`Appointments fetch error: ${err.message}`);
  }

  try {
    const allClientAssessments = await entities.ClientAssessment.list();
    for (const assessment of allClientAssessments) {
      if (!assessment.org_id && assessment.client_id) {
        try {
          const client = await entities.Client.get(assessment.client_id);
          if (client && client.org_id) {
            await entities.ClientAssessment.update(assessment.id, { org_id: client.org_id });
            results.clientAssessmentsUpdated++;
          }
        } catch (err) {
          results.errors.push(`ClientAssessment ${assessment.id}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    results.errors.push(`ClientAssessments fetch error: ${err.message}`);
  }

  return respond(200, { success: true, results });
}
