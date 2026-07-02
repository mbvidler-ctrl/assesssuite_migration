import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ASSESSMENTS_TO_CREATE = [
  {
    name: 'Modified Ashworth Scale',
    category: 'neurological',
    description: 'Assesses muscle spasticity using a 6-point ordinal scale (0-4 with 1+ intermediate level)',
    instructions: 'Passively move joint through ROM at moderate speed. Grade resistance felt: 0=none, 1=slight catch, 1+=slight catch then minimal resistance, 2=marked increase through most ROM, 3=considerable increase, 4=rigid.',
    scoring_system: '0=No increase in muscle tone, 1=Slight increase in muscle tone, 1+=Slight increase with brief catch, 2=More marked increase in tone through most of ROM, 3=Considerable increase in tone with difficulty moving limb, 4=Affected part rigid',
    unit_of_measure: 'Grade (0-4+)',
    equipment_needed: 'Patient in supine or seated position',
    is_questionnaire: false,
    has_test_runner: true,
    has_instructions: true
  }
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const results = [];

    for (const assessmentData of ASSESSMENTS_TO_CREATE) {
      // Check if already exists
      const existing = await base44.entities.Assessment.filter({ 
        name: assessmentData.name 
      });

      if (existing && existing.length > 0) {
        results.push({ 
          name: assessmentData.name, 
          status: 'already exists',
          id: existing[0].id
        });
      } else {
        const created = await base44.entities.Assessment.create(assessmentData);
        results.push({ 
          name: assessmentData.name, 
          status: 'created',
          id: created.id
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