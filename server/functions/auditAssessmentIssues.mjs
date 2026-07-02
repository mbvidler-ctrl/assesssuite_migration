// Ported from base44/functions/auditAssessmentIssues/entry.ts.
//
// No auth check in the captured source — ported unchanged (public to any
// caller, matching entry.ts exactly).

export default async function auditAssessmentIssues(ctx) {
  const { entities, respond } = ctx;

  const testClients = await entities.Client.filter({ full_name: 'Test Client - Automated' });
  if (!testClients || testClients.length === 0) {
    return respond(404, { error: 'Test client not found' });
  }

  const testClient = testClients[0];
  const clientAssessments = await entities.ClientAssessment.filter({ client_id: testClient.id });
  const allAssessments = await entities.Assessment.list();

  const issues = {
    no_test_runner: [],
    missing_additional_data: [],
    incomplete_soap_data: [],
    no_result_value: [],
  };

  for (const ca of clientAssessments) {
    const assessment = allAssessments.find((a) => a.id === ca.assessment_id);
    if (!assessment) continue;

    if (!ca.additional_data || Object.keys(ca.additional_data).length === 0) {
      issues.missing_additional_data.push({
        name: assessment.name,
        id: assessment.id,
        has_questions: assessment.is_questionnaire,
      });
    }

    if (ca.result_value === null || ca.result_value === undefined) {
      issues.no_result_value.push({ name: assessment.name, id: assessment.id });
    }
  }

  const testRunnerPatterns = [
    'Six Meter Walk', '6-Meter Walk', '6 Meter Walk',
    'Eight Foot', '8-Foot', '8 Foot', 'Up and Go',
    'Four Hundred', '400-Meter', '400 Meter',
    'Six Minute Step', '6-Minute Step', '6 Minute Step',
  ];

  for (const assessment of allAssessments) {
    if (assessment.is_deleted) continue;

    const hasRunner = testRunnerPatterns.some((pattern) => assessment.name.includes(pattern));

    if (!hasRunner && !assessment.is_questionnaire && assessment.questions?.length === 0) {
      issues.no_test_runner.push({
        name: assessment.name,
        id: assessment.id,
        is_questionnaire: assessment.is_questionnaire,
      });
    }
  }

  return respond(200, {
    test_client: testClient.id,
    total_assessments: clientAssessments.length,
    issues: {
      missing_additional_data_count: issues.missing_additional_data.length,
      missing_additional_data_sample: issues.missing_additional_data.slice(0, 10),
      no_result_value_count: issues.no_result_value.length,
      no_test_runner_count: issues.no_test_runner.length,
      no_test_runner_sample: issues.no_test_runner.slice(0, 15),
    },
  });
}
