import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const results = {
      soapNotesUpdated: 0,
      appointmentsUpdated: 0,
      clientAssessmentsUpdated: 0,
      errors: []
    };

    // Fix SOAP Notes
    try {
      const allSOAPNotes = await base44.asServiceRole.entities.SOAPNote.list();
      
      for (const note of allSOAPNotes) {
        if (!note.org_id && note.client_id) {
          try {
            const client = await base44.asServiceRole.entities.Client.get(note.client_id);
            if (client && client.org_id) {
              await base44.asServiceRole.entities.SOAPNote.update(note.id, {
                org_id: client.org_id
              });
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

    // Fix Appointments
    try {
      const allAppointments = await base44.asServiceRole.entities.Appointment.list();
      
      for (const appointment of allAppointments) {
        if (!appointment.org_id && appointment.client_id) {
          try {
            const client = await base44.asServiceRole.entities.Client.get(appointment.client_id);
            if (client && client.org_id) {
              await base44.asServiceRole.entities.Appointment.update(appointment.id, {
                org_id: client.org_id
              });
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

    // Fix Client Assessments
    try {
      const allClientAssessments = await base44.asServiceRole.entities.ClientAssessment.list();
      
      for (const assessment of allClientAssessments) {
        if (!assessment.org_id && assessment.client_id) {
          try {
            const client = await base44.asServiceRole.entities.Client.get(assessment.client_id);
            if (client && client.org_id) {
              await base44.asServiceRole.entities.ClientAssessment.update(assessment.id, {
                org_id: client.org_id
              });
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

    return Response.json({
      success: true,
      results
    });

  } catch (error) {
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});