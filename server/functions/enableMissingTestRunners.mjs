// Ported from base44/functions/enableMissingTestRunners/entry.ts.
// Admin-only: forces has_test_runner=true / is_questionnaire=false for a
// fixed list of named assessments.

const RUNNER_ASSESSMENTS = ['Modified Ashworth Scale', 'Modified Rankin Scale'];

export default async function enableMissingTestRunners(ctx) {
  const { user, entities, respond } = ctx;

  if (user?.role !== 'admin') {
    return respond(403, { error: 'Forbidden: Admin access required' });
  }

  const results = [];

  for (const assessmentName of RUNNER_ASSESSMENTS) {
    const assessments = await entities.Assessment.filter({ name: assessmentName });

    if (assessments && assessments.length > 0) {
      const assessment = assessments[0];
      const updateData = {};
      let needsUpdate = false;

      if (!assessment.has_test_runner) {
        updateData.has_test_runner = true;
        needsUpdate = true;
      }

      if (assessment.is_questionnaire) {
        updateData.is_questionnaire = false;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await entities.Assessment.update(assessment.id, updateData);
        results.push({ name: assessmentName, status: 'updated', changes: Object.keys(updateData) });
      } else {
        results.push({ name: assessmentName, status: 'already configured' });
      }
    } else {
      results.push({ name: assessmentName, status: 'not found' });
    }
  }

  return respond(200, { success: true, results });
}
