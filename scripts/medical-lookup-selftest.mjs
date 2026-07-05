// Live tests for the medical-lookup enrichment service (real calls to RxNorm,
// openFDA, NIH Clinical Tables — condition/medication terms only, no client data).
// Run: node scripts/medical-lookup-selftest.mjs
import { lookupCondition, lookupMedication, medicalLookup } from '../server/medicalLookup.mjs';

let pass = 0, fail = 0, skip = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log(`[PASS] ${n}`); } else { fail++; console.log(`[FAIL] ${n}${extra ? ' — ' + extra : ''}`); } };
const netSkip = (n, r) => { if (r && r.networkError) { skip++; console.log(`[SKIP] ${n} — network`); return true; } return false; };

// ---- condition: ICD-10-CM ----
{
  const r = await lookupCondition('type 2 diabetes');
  if (!netSkip('condition lookup', r)) {
    ok('condition returns ICD-10-CM matches', r.matches.length > 0, JSON.stringify(r.matches.slice(0,1)));
    ok('condition match has code+name', !!r.matches[0].code && !!r.matches[0].name);
    ok('condition tagged with source', /ICD-10-CM/.test(r.source));
  }
}
// gibberish condition -> no matches (degrade, not fabricate)
{
  const r = await lookupCondition('zzxqwv nonsense condition 999');
  if (!netSkip('gibberish condition', r)) ok('gibberish condition -> no matches', r.matches.length === 0);
}

// ---- medication: RxNorm + openFDA ----
{
  const r = await lookupMedication('metformin');
  if (!netSkip('medication lookup', r)) {
    ok('medication normalises to an ingredient', !!r.ingredient, JSON.stringify({ rxcui: r.rxcui, ingredient: r.ingredient }));
    ok('medication carries jurisdiction note', /US-sourced/.test(r.jurisdiction_note));
    ok('medication label provenance tagged when present', !r.label || /US FDA/.test(r.label.provenance));
  }
}
// brand-name style input still normalises to ingredient
{
  const r = await lookupMedication('Lipitor');
  if (!netSkip('brand-name medication', r)) {
    ok('brand name maps toward atorvastatin ingredient', (r.ingredient || '').toLowerCase().includes('atorvastatin') || !!r.rxcui, JSON.stringify({ rxcui: r.rxcui, ingredient: r.ingredient }));
  }
}

// ---- batch ----
{
  const r = await medicalLookup({ conditions: ['hypertension'], medications: ['atorvastatin'] });
  ok('batch returns both arrays', Array.isArray(r.conditions) && Array.isArray(r.medications) && r.conditions.length === 1 && r.medications.length === 1);
}

console.log(`\nMedical-lookup self-test: ${pass} passed, ${fail} failed, ${skip} skipped (network).`);
if (fail > 0) process.exit(1);
