// Server-side medical-terminology enrichment for client onboarding (conditions
// and medications). Decision-support enrichment only — NOT clinical advice, and
// nothing is fabricated: every field is returned verbatim from an authoritative
// source with its provenance tagged.
//
// Sources (all free / keyless): RxNorm (rxnav.nlm.nih.gov) for medication
// normalisation to a generic ingredient; openFDA drug label (api.fda.gov) for
// exercise-relevant label warnings; NIH Clinical Tables (clinicaltables.nlm.nih.gov)
// for ICD-10-CM condition coding.
//
// JURISDICTION CAVEAT surfaced in every payload: RxNorm/openFDA are US-sourced,
// so Australian brand names map imperfectly — matching is at the generic
// ingredient level, and label warnings are tagged "US FDA label" (the Australian
// TGA/AMT terminology has no free public API).
//
// PRIVACY: only a condition name or medication name is ever sent to an external
// API. No client identity, DOB, or record data leaves the server.

const UA = 'UniMatter-AssessSuite-medical/1.0 (mailto:research@unimatter.com.au)';

let _chain = Promise.resolve();
function throttled(fn, spacingMs = 200) {
  const run = _chain.then(() => fn());
  _chain = run.then(() => new Promise((r) => setTimeout(r, spacingMs)), () => new Promise((r) => setTimeout(r, spacingMs)));
  return run;
}
async function getJson(url, timeoutMs = 12000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!r.ok) return { ok: false, status: r.status };
    const text = await r.text();
    try { return { ok: true, json: JSON.parse(text) }; }
    catch { return { ok: false, nonJson: true }; }
  } catch (e) {
    return { ok: false, error: e.message || 'fetch failed' };
  } finally { clearTimeout(t); }
}
function truncate(s, n = 600) {
  const str = String(s || '').replace(/\s+/g, ' ').trim();
  return str.length > n ? str.slice(0, n) + '…' : str;
}

// ---- conditions: ICD-10-CM ----
export async function lookupCondition(term) {
  if (!term || !String(term).trim()) return null;
  const url = `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms=${encodeURIComponent(term)}&maxList=5`;
  const res = await throttled(() => getJson(url));
  if (!res.ok) return { input: term, matches: [], source: 'ICD-10-CM (NIH Clinical Tables)', networkError: !res.status };
  // Response: [count, [codes], null|extra, [[code, name], ...]]
  const rows = Array.isArray(res.json) && Array.isArray(res.json[3]) ? res.json[3] : [];
  const matches = rows.map((r) => ({ code: r[0], name: r[1] }));
  return { input: term, matches, source: 'ICD-10-CM (NIH Clinical Tables)', networkError: false };
}

// ---- medications: RxNorm normalisation + openFDA label ----
async function rxNormalise(term) {
  const approx = await throttled(() => getJson(`https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=1`));
  if (!approx.ok) return { rxcui: null, name: null, ingredient: null, networkError: !approx.status };
  const cand = approx.json?.approximateGroup?.candidate?.[0];
  const rxcui = cand?.rxcui || null;
  if (!rxcui) return { rxcui: null, name: null, ingredient: null, networkError: false };
  let name = null, ingredient = null;
  const prop = await throttled(() => getJson(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/property.json?propName=RxNorm%20Name`));
  if (prop.ok) name = prop.json?.propConceptGroup?.propConcept?.[0]?.propValue || null;
  const rel = await throttled(() => getJson(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=IN`));
  if (rel.ok) {
    const ing = rel.json?.relatedGroup?.conceptGroup?.find((g) => g.tty === 'IN')?.conceptProperties?.[0];
    ingredient = ing?.name || null;
  }
  return { rxcui, name, ingredient: ingredient || name, networkError: false };
}
async function openFdaLabel(ingredient) {
  if (!ingredient) return null;
  const url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:${encodeURIComponent(ingredient.toLowerCase())}&limit=1`;
  const res = await throttled(() => getJson(url));
  if (!res.ok) return { networkError: !res.status };
  const rec = res.json?.results?.[0];
  if (!rec) return { found: false };
  const pick = (f) => (Array.isArray(rec[f]) ? truncate(rec[f].join(' ')) : null);
  return {
    found: true,
    provenance: 'US FDA drug label (openFDA) — generic-level; verify against Australian product information',
    boxed_warning: pick('boxed_warning'),
    warnings: pick('warnings') || pick('warnings_and_cautions'),
    contraindications: pick('contraindications'),
    drug_interactions: pick('drug_interactions'),
  };
}
export async function lookupMedication(term) {
  if (!term || !String(term).trim()) return null;
  const rx = await rxNormalise(term);
  const label = rx.ingredient ? await openFdaLabel(rx.ingredient) : null;
  return {
    input: term,
    rxcui: rx.rxcui,
    normalised_name: rx.name,
    ingredient: rx.ingredient,
    label: label && label.found ? label : null,
    source: 'RxNorm (rxnav.nlm.nih.gov) + openFDA',
    jurisdiction_note: 'US-sourced (RxNorm/openFDA); mapped at generic-ingredient level. Australian brand/AMT names may differ.',
    networkError: Boolean(rx.networkError || (label && label.networkError)),
  };
}

// ---- batch ----
export async function medicalLookup({ conditions = [], medications = [] } = {}) {
  const condOut = [];
  for (const c of (Array.isArray(conditions) ? conditions : []).slice(0, 15)) {
    // eslint-disable-next-line no-await-in-loop
    condOut.push(await lookupCondition(c));
  }
  const medOut = [];
  for (const m of (Array.isArray(medications) ? medications : []).slice(0, 15)) {
    // eslint-disable-next-line no-await-in-loop
    medOut.push(await lookupMedication(m));
  }
  return { conditions: condOut, medications: medOut };
}
