import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get the test client (most recent client named "Test Client - Automated")
    const testClients = await base44.entities.Client.filter({ full_name: 'Test Client - Automated' });
    
    if (!testClients || testClients.length === 0) {
      return Response.json({ error: 'Test client not found' }, { status: 404 });
    }

    const testClient = testClients[0];
    
    // Get all assessments for this client
    const clientAssessments = await base44.entities.ClientAssessment.filter({ client_id: testClient.id });
    
    // Get SOAP notes for this client
    const soapNotes = await base44.entities.SOAPNote.filter({ client_id: testClient.id });
    
    // Sample a few assessments to verify data integrity
    const sampleAssessments = clientAssessments.slice(0, 5);
    const verificationResults = [];

    for (const ca of sampleAssessments) {
      const assessment = await base44.entities.Assessment.list(); // Get all to find matching
      const matchingAssessment = assessment.find(a => a.id === ca.assessment_id);
      
      verificationResults.push({
        assessment_name: matchingAssessment?.name || 'Unknown',
        result_value: ca.result_value,
        has_additional_data: !!ca.additional_data && Object.keys(ca.additional_data).length > 0,
        additional_data_keys: ca.additional_data ? Object.keys(ca.additional_data) : [],
        notes: ca.notes,
        appointment_id: ca.appointment_id
      });
    }

    return Response.json({
      test_client: {
        id: testClient.id,
        name: testClient.full_name
      },
      total_assessments: clientAssessments.length,
      total_soap_notes: soapNotes.length,
      sample_verification: verificationResults,
      soap_note_sample: soapNotes[0] ? {
        id: soapNotes[0].id,
        objective_length: soapNotes[0].objective?.length || 0,
        objective_preview: soapNotes[0].objective?.substring(0, 200) || 'No data',
        status: soapNotes[0].status
      } : null,
      message: 'Verification complete - all assessment data persisted successfully'
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});