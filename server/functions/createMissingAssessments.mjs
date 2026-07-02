// Ported from base44/functions/createMissingAssessments/entry.ts.
// Admin-only: seeds a fixed list of assessments if not already present.

const ASSESSMENTS_TO_CREATE = [
  {
    name: 'Modified Ashworth Scale',
    category: 'neurological',
    description: 'Assesses muscle spasticity using a 6-point ordinal scale (0-4 with 1+ intermediate level)',
    instructions:
      'Passively move joint through ROM at moderate speed. Grade resistance felt: 0=none, 1=slight catch, 1+=slight catch then minimal resistance, 2=marked increase through most ROM, 3=considerable increase, 4=rigid.',
    scoring_system:
      '0=No increase in muscle tone, 1=Slight increase in muscle tone, 1+=Slight increase with brief catch, 2=More marked increase in tone through most of ROM, 3=Considerable increase in tone with difficulty moving limb, 4=Affected part rigid',
    unit_of_measure: 'Grade (0-4+)',
    equipment_needed: 'Patient in supine or seated position',
    is_questionnaire: false,
    has_test_runner: true,
    has_instructions: true,
  },
];

export default async function createMissingAssessments(ctx) {
  const { user, entities, respond } = ctx;

  if (user?.role !== 'admin') {
    return respond(403, { error: 'Forbidden: Admin access required' });
  }

  const results = [];

  for (const assessmentData of ASSESSMENTS_TO_CREATE) {
    const existing = await entities.Assessment.filter({ name: assessmentData.name });

    if (existing && existing.length > 0) {
      results.push({ name: assessmentData.name, status: 'already exists', id: existing[0].id });
    } else {
      const created = await entities.Assessment.create(assessmentData);
      results.push({ name: assessmentData.name, status: 'created', id: created.id });
    }
  }

  return respond(200, { success: true, results });
}
