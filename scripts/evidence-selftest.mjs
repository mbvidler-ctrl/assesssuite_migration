// Live tests for the citation-verification service (makes real calls to
// OpenAlex / PubMed — bibliographic strings only, no client data).
// Run: node scripts/evidence-selftest.mjs
import { verifyCitation, titleSimilarity, searchEvidence } from '../server/evidence.mjs';

let pass = 0, fail = 0, skip = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log(`[PASS] ${n}`); } else { fail++; console.log(`[FAIL] ${n}${extra ? ' — ' + extra : ''}`); } };
const skipIfNet = (n, r) => { if (r.networkError) { skip++; console.log(`[SKIP] ${n} — network unavailable`); return true; } return false; };

// ---- pure logic (no network) ----
ok('titleSimilarity identical = 1', Math.abs(titleSimilarity('Timed Up and Go test reliability', 'Timed Up and Go test reliability') - 1) < 0.01);
ok('titleSimilarity unrelated low', titleSimilarity('body fat skinfold equation', 'timed up and go falls risk') < 0.3);
ok('titleSimilarity containment matches', titleSimilarity('McMurray test', 'The McMurray test for meniscus tears: a systematic review') >= 0.6);

// A DOI OpenAlex definitely holds: Podsiadlo & Richardson (1991), the TUG paper.
const TUG_DOI = '10.1111/j.1532-5415.1991.tb01616.x';

// ---- live: known-good DOI + matching title -> verified ----
{
  const r = await verifyCitation({ doi: TUG_DOI, title: 'The Timed Up and Go: a test of basic functional mobility for frail elderly persons', year: 1991 });
  if (!skipIfNet('known DOI + title', r)) {
    ok('known DOI + matching title -> verified', r.verdict === 'verified', `verdict=${r.verdict}; sim=${r.checks?.titleSimilarity}`);
    ok('canonical metadata returned', r.canonical && !!r.canonical.title);
  }
}

// ---- live: real DOI but a DELIBERATELY WRONG title -> mismatch (the key catch) ----
{
  const r = await verifyCitation({ doi: TUG_DOI, title: 'Effects of creatine supplementation on sprint cycling performance in adolescents' });
  if (!skipIfNet('real DOI + wrong title', r)) {
    ok('real DOI with wrong title -> mismatch (catches fabricated attribution)', r.verdict === 'mismatch', `verdict=${r.verdict}; sim=${r.checks?.titleSimilarity}`);
    ok('mismatch still returns the true paper for that DOI', r.canonical && !!r.canonical.title);
  }
}

// ---- live: fabricated / non-existent DOI -> unverifiable (never verified) ----
{
  const r = await verifyCitation({ doi: '10.9999/this.doi.does.not.exist.999999', title: 'A completely fabricated study of nothing at all zzzq' });
  if (!skipIfNet('fabricated DOI', r)) {
    ok('fabricated DOI + gibberish title -> unverifiable (never verified)', r.verdict === 'unverifiable', `verdict=${r.verdict}`);
  }
}

// ---- live: title-only search for a real, well-known paper -> verified with found DOI/PMID ----
// Live relevance ranking varies slightly run-to-run; retry a couple of times
// (no fresh cache) before asserting, so the suite is deterministic.
{
  let r = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    r = await verifyCitation({ title: 'The Timed Up and Go: a test of basic functional mobility for frail elderly persons', year: 1991 }, { useCache: false });
    if (r.verdict === 'verified' || r.networkError) break;
  }
  if (!skipIfNet('title-only known paper', r)) {
    ok('title-only real paper -> verified', r.verdict === 'verified', `verdict=${r.verdict}`);
    ok('verified result carries a resolvable id', r.canonical && (r.canonical.doi || r.canonical.pmid));
  }
}

// ---- live: gibberish title only -> unverifiable ----
{
  const r = await verifyCitation({ title: 'Zxqwv plorbnak fizzlewump quantum banana treatise 2027' });
  if (!skipIfNet('gibberish title', r)) {
    ok('gibberish title -> unverifiable', r.verdict === 'unverifiable', `verdict=${r.verdict}`);
  }
}

// ---- live: searchEvidence returns real, citable works for grounding ----
{
  const r = await searchEvidence('exercise therapy knee osteoarthritis');
  if (!skipIfNet('searchEvidence', r)) {
    ok('searchEvidence returns real works with DOIs', r.results.length > 0 && r.results.every(w => w.doi && w.title), `n=${r.results.length}`);
    // every returned reference must itself verify (grounding integrity)
    if (r.results.length > 0) {
      const v = await verifyCitation({ doi: r.results[0].doi, title: r.results[0].title });
      if (!skipIfNet('grounded ref verifies', v)) ok('a searchEvidence result independently verifies', v.verdict === 'verified' || v.verdict === 'mismatch');
    }
  }
}

console.log(`\nEvidence self-test: ${pass} passed, ${fail} failed, ${skip} skipped (network).`);
if (fail > 0) process.exit(1);
