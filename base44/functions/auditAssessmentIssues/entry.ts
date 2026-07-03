import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Security patch ASX-SEC-20260703-01: this function previously had no
    // caller-identity or role check, allowing any caller (including
    // non-admin users) to retrieve full cross-organisation client
    // assessment data. Admin-only guard added; see
    // docs/ASX-SEC-20260703-01-patch-note.md.
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const testClients = await base44.entities.Client.filter({ full_name: 'Test Client - Automated' });
    if (!testClients || testClients.length === 0) {
      return Response.json({ error: 'Test client not found' }, { status: 404 });
    }

    const testClient = testClients[0];
    const clientAssessments = await base44.entities.ClientAssessment.filter({ client_id: testClient.id });
    const allAssessments = await base44.entities.Assessment.list();
    
    const issues = {
      no_test_runner: [],
      missing_additional_data: [],
      incomplete_soap_data: [],
      no_result_value: []
    };

    // Check each assessment
    for (const ca of clientAssessments) {
      const assessment = allAssessments.find(a => a.id === ca.assessment_id);
      if (!assessment) continue;

      // Check for missing additional_data
      if (!ca.additional_data || Object.keys(ca.additional_data).length === 0) {
        issues.missing_additional_data.push({
          name: assessment.name,
          id: assessment.id,
          has_questions: assessment.is_questionnaire
        });
      }

      // Check for missing result value
      if (ca.result_value === null || ca.result_value === undefined) {
        issues.no_result_value.push({
          name: assessment.name,
          id: assessment.id
        });
      }
    }

    // Find assessments with no test runner by checking AssessmentTestRunnerRouter
    const testRunnerPatterns = [
      'Six Meter Walk', '6-Meter Walk', '6 Meter Walk',
      'Eight Foot', '8-Foot', '8 Foot', 'Up and Go',
      'Four Hundred', '400-Meter', '400 Meter',
      'Six Minute Step', '6-Minute Step', '6 Minute Step'
    ];

    for (const assessment of allAssessments) {
      if (assessment.is_deleted) continue;

      const hasRunner = testRunnerPatterns.some(pattern => 
        assessment.name.includes(pattern)
      );

      if (!hasRunner && !assessment.is_questionnaire && assessment.questions?.length === 0) {
        issues.no_test_runner.push({
          name: assessment.name,
          id: assessment.id,
          is_questionnaire: assessment.is_questionnaire
        });
      }
    }

    return Response.json({
      test_client: testClient.id,
      total_assessments: clientAssessments.length,
      issues: {
        missing_additional_data_count: issues.missing_additional_data.length,
        missing_additional_data_sample: issues.missing_additional_data.slice(0, 10),
        no_result_value_count: issues.no_result_value.length,
        no_test_runner_count: issues.no_test_runner.length,
        no_test_runner_sample: issues.no_test_runner.slice(0, 15)
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});