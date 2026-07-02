import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const RUNNER_ASSESSMENTS = [
  'Modified Ashworth Scale',
  'Modified Rankin Scale'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const results = [];

    for (const assessmentName of RUNNER_ASSESSMENTS) {
      const assessments = await base44.entities.Assessment.filter({ 
        name: assessmentName 
      });

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
          await base44.entities.Assessment.update(assessment.id, updateData);
          results.push({ 
            name: assessmentName, 
            status: 'updated',
            changes: Object.keys(updateData)
          });
        } else {
          results.push({ 
            name: assessmentName, 
            status: 'already configured'
          });
        }
      } else {
        results.push({ 
          name: assessmentName, 
          status: 'not found'
        });
      }
    }

    return Response.json({ 
      success: true, 
      results 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});