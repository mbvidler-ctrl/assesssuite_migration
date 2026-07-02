// Ported from base44/functions/verifyTestAssessmentData/entry.ts.
// No auth check in the captured source — ported unchanged.

export default async function verifyTestAssessmentData(ctx) {
  const { entities, respond } = ctx;

  const testClients = await entities.Client.filter({ full_name: 'Test Client - Automated' });

  if (!testClients || testClients.length === 0) {
    return respond(404, { error: 'Test client not found' });
  }

  const testClient = testClients[0];

  const clientAssessments = await entities.ClientAssessment.filter({ client_id: testClient.id });
  const soapNotes = await entities.SOAPNote.filter({ client_id: testClient.id });

  const sampleAssessments = clientAssessments.slice(0, 5);
  const verificationResults = [];

  for (const ca of sampleAssessments) {
    const assessment = await entities.Assessment.list();
    const matchingAssessment = assessment.find((a) => a.id === ca.assessment_id);

    verificationResults.push({
      assessment_name: matchingAssessment?.name || 'Unknown',
      result_value: ca.result_value,
      has_additional_data: !!ca.additional_data && Object.keys(ca.additional_data).length > 0,
      additional_data_keys: ca.additional_data ? Object.keys(ca.additional_data) : [],
      notes: ca.notes,
      appointment_id: ca.appointment_id,
    });
  }

  return respond(200, {
    test_client: { id: testClient.id, name: testClient.full_name },
    total_assessments: clientAssessments.length,
    total_soap_notes: soapNotes.length,
    sample_verification: verificationResults,
    soap_note_sample: soapNotes[0]
      ? {
          id: soapNotes[0].id,
          objective_length: soapNotes[0].objective?.length || 0,
          objective_preview: soapNotes[0].objective?.substring(0, 200) || 'No data',
          status: soapNotes[0].status,
        }
      : null,
    message: 'Verification complete - all assessment data persisted successfully',
  });
}
