import { base44 } from "@/api/base44Client";

async function ensureSoapText(assessmentToUpdateId) {
  // Legacy enrichment that POSTed to a foreign Base44 app
  // (superagent-1-96aa301b.base44.app) on every assessment save. Removed so the
  // migrated app makes no calls to any live Base44 deployment. The SOAP note is
  // already written to the local backend above (SOAPNote.create/update), so this
  // is behaviour-neutral. Restore a first-party endpoint here if server-side SOAP
  // enrichment is reintroduced.
  return;
}

export async function saveAssessmentToSOAP({ clientToUse, appointmentId, objectiveText, assessmentToUpdateId, updateData, assessment }) {
  if (!objectiveText && updateData?.additional_data?.soap_text) {
    const rawDs = (updateData.assessment_date || '').length === 10 ? updateData.assessment_date : new Date().toISOString().split('T')[0];
    const [y2, m2, d2] = rawDs.split('-').map(Number);
    const dateStr2 = new Date(y2, m2-1, d2).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    objectiveText = 'Assessment completed on ' + dateStr2 + ':\n\n' + updateData.additional_data.soap_text;
    if (updateData.notes && updateData.notes.trim() && !objectiveText.includes(updateData.notes)) {
      objectiveText += '\n  Clinical Notes: ' + updateData.notes;
    }
  }

  if (!objectiveText || !clientToUse) return;

  let finalAppointmentId = appointmentId;

  if (!finalAppointmentId) {
    const rawDate = (updateData.assessment_date || '').length === 10
      ? updateData.assessment_date
      : new Date().toISOString().split('T')[0];
    const [y, m, d] = rawDate.split('-').map(Number);
    const assessmentDate = new Date(y, m - 1, d);

    const existingAppointments = await base44.entities.Appointment.filter({ client_id: clientToUse.id });
    const onSameDay = existingAppointments.filter(apt => {
      const aptDate = new Date(apt.start_time);
      return aptDate.getFullYear() === assessmentDate.getFullYear() &&
             aptDate.getMonth() === assessmentDate.getMonth() &&
             aptDate.getDate() === assessmentDate.getDate();
    });

    let appointmentToUse;
    if (onSameDay.length > 0) {
      appointmentToUse = onSameDay[0];
    } else {
      const now = new Date();
      const startTime = new Date(assessmentDate.getFullYear(), assessmentDate.getMonth(), assessmentDate.getDate(), now.getHours(), now.getMinutes(), 0, 0);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      const fields = Object.assign({}, clientToUse);
      appointmentToUse = await base44.entities.Appointment.create({
        org_id: fields.org_id,
        title: fields.full_name,
        client_id: fields.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'completed',
        notes: 'Assessment session'
      });
    }

    finalAppointmentId = appointmentToUse.id;

    if (assessmentToUpdateId) {
      await base44.entities.ClientAssessment.update(assessmentToUpdateId, {
        ...updateData,
        appointment_id: finalAppointmentId
      });
    }
  }

  if (!finalAppointmentId) return;

  const existingSOAPNotes = await base44.entities.SOAPNote.filter({ appointment_id: finalAppointmentId });
  const fields = Object.assign({}, clientToUse);

  if (existingSOAPNotes.length === 0) {
    await base44.entities.SOAPNote.create({
      org_id: fields.org_id,
      client_id: fields.id,
      appointment_id: finalAppointmentId,
      note_date: new Date().toISOString(),
      subjective: '',
      objective: objectiveText,
      assessment: '',
      plan: '',
      status: 'draft'
    });
  } else {
    const existingNote = existingSOAPNotes[0];
    let updatedObjective = existingNote.objective || '';
    if (updatedObjective && !updatedObjective.trim().endsWith('\n')) {
      updatedObjective += '\n\n';
    }
    updatedObjective += objectiveText;
    await base44.entities.SOAPNote.update(existingNote.id, { objective: updatedObjective });
  }

  await ensureSoapText(assessmentToUpdateId);
}