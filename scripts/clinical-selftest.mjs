// Deterministic unit tests for the shared clinical modules (P-A results
// derivation + P-B normative interpretation). Run: node scripts/clinical-selftest.mjs
import { deriveItems, buildItemBlockText, soapTextHasItemBlock, hasBespokeItemRenderer } from '../src/lib/clinical/assessmentResults.js';
import { DASS21_QUESTIONS, DASS21_OPTIONS, getDassLevel, buildDass21Payload } from '../src/lib/clinical/dass21.js';
import { generateInterpretation } from '../src/lib/clinical/generateInterpretation.js';

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`[PASS] ${name}`); }
  else { fail++; console.log(`[FAIL] ${name}${extra ? ' — ' + extra : ''}`); }
}

// ---- deriveItems: raw_scores (object keyed by index) + question array (DASS shape) ----
const dassItems = deriveItems(
  { raw_scores: { 0: 3, 1: 0, 2: 2 }, measurement_type: 'dass21' },
  { questions: DASS21_QUESTIONS, options: DASS21_OPTIONS }
);
ok('deriveItems DASS raw_scores -> 3 items', dassItems.length === 3, JSON.stringify(dassItems));
ok('deriveItems maps question text', dassItems[0].question_text === DASS21_QUESTIONS[0].text);
ok('deriveItems maps response label', dassItems[0].response_label === DASS21_OPTIONS[3]);
ok('deriveItems numbers are 1-based', dassItems[0].number === 1 && dassItems[2].number === 3);

// ---- deriveItems: responses as ARRAY (K10 shape) ----
const arrItems = deriveItems({ responses: [1, 5, 3] });
ok('deriveItems responses array -> 3 items', arrItems.length === 3);
ok('deriveItems array values preserved', arrItems[1].value === 5);

// ---- deriveItems: already-canonical items[] pass-through ----
const passthrough = deriveItems({ items: [{ number: 1, value: 9 }] });
ok('deriveItems items[] passthrough', passthrough.length === 1 && passthrough[0].value === 9);

// ---- deriveItems: no per-item data -> [] (degrade silently) ----
ok('deriveItems empty -> []', deriveItems({ soap_text: 'summary only' }).length === 0);
ok('deriveItems null -> []', deriveItems(null).length === 0);

// ---- buildItemBlockText ----
const block = buildItemBlockText(dassItems);
ok('buildItemBlockText has marker', block.includes('Individual Item Responses:'));
ok('buildItemBlockText numbers items', block.includes('Q1.') && block.includes('Q3.'));
ok('soapTextHasItemBlock detects marker', soapTextHasItemBlock(block) === true);
ok('soapTextHasItemBlock false on summary', soapTextHasItemBlock('• DASS-21\n  Depression: 10/42') === false);
ok('buildItemBlockText empty -> ""', buildItemBlockText([]) === '');

// ---- hasBespokeItemRenderer ----
ok('hasBespokeItemRenderer womac true', hasBespokeItemRenderer('womac') === true);
ok('hasBespokeItemRenderer dass21 false', hasBespokeItemRenderer('dass21') === false);

// ---- getDassLevel against Lovibond & Lovibond bands ----
ok('DASS depression 8 -> Normal', getDassLevel(8, 'depression') === 'Normal');
ok('DASS depression 22 -> Severe', getDassLevel(22, 'depression') === 'Severe');
ok('DASS anxiety 20 -> Extremely Severe', getDassLevel(20, 'anxiety') === 'Extremely Severe');
ok('DASS stress 15 -> Mild', getDassLevel(15, 'stress') === 'Mild');

// ---- generateInterpretation: HIGHER-better test (e.g. 30s sit-to-stand reps) ----
const higher = generateInterpretation({
  resultValue: 20, unit: 'reps', ageLabel: '60-64', genderLabel: 'female', subjectName: 'Smith',
  norm: { mean: 15, std_dev: 3.5, percentile_25: 12, percentile_75: 17, direction: 'higher_better', source: 'SYNTHETIC example' },
});
ok('higher_better: not null', higher !== null);
ok('higher_better: above p75 -> Above average', higher.performanceLevel === 'Above average', higher && higher.performanceLevel);
ok('higher_better: enum above_average', higher.normativeEnum === 'above_average');
ok('higher_better: factor phrasing higher', higher.comparisonText.includes('times higher than'));
ok('higher_better: carries provenance', higher.comparisonText.includes('Norm source'));

// ---- generateInterpretation: LOWER-better test (Timed Up and Go seconds) — the critical direction case ----
const lower = generateInterpretation({
  resultValue: 18, unit: 's', ageLabel: '70-79', genderLabel: 'both', subjectName: 'Smith',
  norm: { mean: 9, std_dev: 3, percentile_25: 7, percentile_75: 11, direction: 'lower_better', source: 'SYNTHETIC example' },
});
ok('lower_better: a slow (high) time is BELOW average, not above', lower.performanceLevel === 'Below average', lower && lower.performanceLevel);
ok('lower_better: enum below_average', lower.normativeEnum === 'below_average');
ok('lower_better: numeric says higher than mean (true)', lower.comparisonText.includes('times higher than'));
ok('lower_better: direction clause says lower is better', lower.comparisonText.includes('lower scores indicate better'));

// ---- generateInterpretation: curated clinical inference emitted only when present ----
const curated = generateInterpretation({
  resultValue: 18, unit: 's',
  norm: { mean: 9, std_dev: 3, percentile_25: 7, percentile_75: 11, direction: 'lower_better',
    clinical_inference: { above_p75: 'This may indicate elevated falls risk; further balance assessment may be warranted.' } },
});
ok('curated inference emitted when band matches', curated.comparisonText.includes('elevated falls risk'));
ok('curated flagged', curated.hasCuratedInference === true);
const noCurated = generateInterpretation({
  resultValue: 8, unit: 's',
  norm: { mean: 9, std_dev: 3, percentile_25: 7, percentile_75: 11, direction: 'lower_better',
    clinical_inference: { above_p75: 'x' } },
});
ok('no curated inference when band does not match', noCurated.hasCuratedInference === false);

// ---- generateInterpretation: degrade silently ----
ok('null norm -> null', generateInterpretation({ resultValue: 5, norm: null }) === null);
ok('missing mean -> null', generateInterpretation({ resultValue: 5, norm: { std_dev: 2 } }) === null);
ok('missing result -> null', generateInterpretation({ resultValue: undefined, norm: { mean: 5 } }) === null);

// ---- neutral direction: raw relationship only, no benefit claim ----
const neutral = generateInterpretation({ resultValue: 12, norm: { mean: 10, percentile_25: 8, percentile_75: 11, direction: 'unknown' } });
ok('neutral: no better/worse claim', !neutral.comparisonText.includes('better performance'));
ok('neutral: enum above_average by raw position', neutral.normativeEnum === 'above_average');

// ---- buildDass21Payload: totals + all 21 items + severity, single source ----
const allTwo = {}; for (let i = 0; i < 21; i++) allTwo[i] = 2; // every item = 2
const payload = buildDass21Payload(allTwo, 'note');
ok('DASS payload result_value = sum of ×2 subscales', payload.result_value === 84, String(payload.result_value)); // 7 items each subscale ×2×2 = 28 each ×3 = 84
ok('DASS payload has 21 items', payload.additional_data.items.length === 21);
ok('DASS payload soap_text has summary', payload.additional_data.soap_text.includes('• DASS-21'));
ok('DASS payload soap_text has item block', payload.additional_data.soap_text.includes('Individual Item Responses:'));
ok('DASS payload soap_text names Q21', payload.additional_data.soap_text.includes('Q21.'));
ok('DASS payload subscale = 28 each', payload.additional_data.depression_score === 28 && payload.additional_data.anxiety_score === 28 && payload.additional_data.stress_score === 28);
ok('DASS payload measurement_type dass21', payload.additional_data.measurement_type === 'dass21');
// derive items back out of the payload (viewer path)
const roundTrip = deriveItems(payload.additional_data, { questions: DASS21_QUESTIONS, options: DASS21_OPTIONS });
ok('DASS payload items round-trip via deriveItems', roundTrip.length === 21 && roundTrip[20].question_text === DASS21_QUESTIONS[20].text);

console.log(`\nClinical self-test: ${pass}/${pass + fail} passed.`);
if (fail > 0) process.exit(1);
