// End-to-end DB check for P-A/P-B against a FRESH isolated DB (SELFTEST=1 uses a
// throwaway selftest.db, wiped on open). Single process / single handle to avoid
// the documented Windows EPERM hazard. Run: node scripts/pa-e2e-verify.mjs
process.env.SELFTEST = '1';

const { openDatabase, createEntityRepository } = await import('../server/db.mjs');
const { runSeed } = await import('../server/seed.mjs');
const { generateInterpretation, selectNorm } = await import('../src/lib/clinical/generateInterpretation.js');
const { deriveItems } = await import('../src/lib/clinical/assessmentResults.js');
const { DASS21_QUESTIONS, DASS21_OPTIONS } = await import('../src/lib/clinical/dass21.js');

let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log(`[PASS] ${n}`); } else { fail++; console.log(`[FAIL] ${n}${extra ? ' — ' + extra : ''}`); } };

const { db, entityNames } = openDatabase();
await runSeed({ db, entityNames });

const CA = createEntityRepository(db, 'ClientAssessment');
const AS = createEntityRepository(db, 'Assessment');
const CL = createEntityRepository(db, 'Client');

const assessments = AS.listAll();
const clientAssessments = CA.listAll();
const clients = CL.listAll();

// --- P-A: DASS-21 completed row with all 21 items ---
const dassCat = assessments.find(a => a.name === 'DASS-21');
ok('seed created DASS-21 catalogue entry', !!dassCat);
const dassRows = clientAssessments.filter(ca => ca.assessment_id === dassCat?.id);
ok('seed created DASS-21 ClientAssessment rows', dassRows.length > 0, `count=${dassRows.length}`);
const d0 = dassRows[0];
ok('DASS row has 21 structured items', d0?.additional_data?.items?.length === 21);
ok('DASS row soap_text carries item block', d0?.additional_data?.soap_text?.includes('Individual Item Responses:'));
ok('DASS row soap_text names Q21', d0?.additional_data?.soap_text?.includes('Q21.'));
const derived = deriveItems(d0.additional_data, { questions: DASS21_QUESTIONS, options: DASS21_OPTIONS });
ok('deriveItems reconstructs 21 labelled items from the stored row', derived.length === 21 && !!derived[20].question_text && !!derived[20].response_label);

// --- P-B: seeded normative_data with direction, and a correct interpretation ---
const tug = assessments.find(a => a.name === 'Timed Up and Go');
ok('TUG has normative_data seeded', Array.isArray(tug?.normative_data) && tug.normative_data.length > 0);
ok('TUG carries direction=lower_better', tug?.normative_direction === 'lower_better');
ok('TUG norm marked synthetic in source', /SYNTHETIC/.test(tug?.normative_source || ''));
// simulate the save-path interpretation for a 70yo with a slow (high) TUG time
const norm70 = selectNorm(tug.normative_data, 72, 'both');
ok('selectNorm matches the 70-79 band', norm70 && norm70.age_min === 70);
const interp = generateInterpretation({
  resultValue: 14, unit: tug.unit_of_measure,
  norm: { ...norm70, direction: tug.normative_direction, source: tug.normative_source, clinical_inference: norm70.clinical_inference },
  ageLabel: '70-79', genderLabel: 'both', subjectName: 'Smith',
});
ok('interpretation produced', !!interp);
ok('slow TUG reads as Below average (direction-correct)', interp.performanceLevel === 'Below average', interp?.performanceLevel);
ok('interpretation carries synthetic provenance', /SYNTHETIC/.test(interp.comparisonText));
ok('interpretation emits curated falls-risk inference for above_p75 band', interp.comparisonText.includes('falls risk'));

console.log(`\nP-A/P-B end-to-end: ${pass}/${pass + fail} passed.`);
if (fail > 0) process.exit(1);
