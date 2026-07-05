// Server-side citation-verification service (P-C Tranche 3 / the client's
// "evidence based" concern). Given a citation (DOI and/or title/authors/year),
// it confirms the reference actually EXISTS and that a supplied DOI genuinely
// belongs to the cited paper — catching the dominant fabrication mode of a real
// DOI attached to the wrong (or non-existent) paper.
//
// Backends, all zero-cost and keyless (polite pool via mailto): OpenAlex
// (primary — DOI lookup + title search, returns title/authors/year), PubMed
// E-utilities (secondary cross-check), Crossref (best-effort; skipped where
// unreachable). Verification NEVER asserts "verified" on a network failure — it
// degrades to "unverifiable" so nothing false is ever presented as confirmed.
//
// PRIVACY: this service handles bibliographic strings only (DOIs, titles,
// author names, years). No client, patient, or clinical record data is ever
// sent to an external API.

const MAILTO = process.env.EVIDENCE_MAILTO || 'research@unimatter.com.au';
const UA = `UniMatter-AssessSuite-evidence/1.0 (mailto:${MAILTO})`;
const TITLE_SIMILARITY_THRESHOLD = 0.6;

// ---- text helpers ----------------------------------------------------------
function normaliseTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[‐-―]/g, '-')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function tokenSet(s) {
  return new Set(normaliseTitle(s).split(' ').filter((t) => t.length > 2));
}
// Jaccard over significant tokens, with a containment boost (a short cited
// title fully contained in the canonical title still matches).
export function titleSimilarity(a, b) {
  const A = tokenSet(a), B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  const jaccard = inter / union;
  const containment = inter / Math.min(A.size, B.size);
  return Math.max(jaccard, containment * 0.95);
}
function extractDoi(s) {
  if (!s) return null;
  const m = String(s).match(/10\.\d{4,9}\/[^\s"'<>]+/i);
  return m ? m[0].replace(/[.,;)]+$/, '').toLowerCase() : null;
}
function surname(name) {
  const n = String(name || '').trim();
  if (!n) return '';
  if (n.includes(',')) return normaliseTitle(n.split(',')[0]);
  const parts = normaliseTitle(n).split(' ');
  return parts[parts.length - 1] || '';
}

// ---- rate-limited fetch ----------------------------------------------------
let _chain = Promise.resolve();
function throttled(fn, spacingMs = 250) {
  const run = _chain.then(() => fn());
  _chain = run.then(
    () => new Promise((r) => setTimeout(r, spacingMs)),
    () => new Promise((r) => setTimeout(r, spacingMs))
  );
  return run;
}
async function getJson(url, timeoutMs = 12000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!r.ok) return { ok: false, status: r.status };
    const text = await r.text();
    try {
      return { ok: true, status: r.status, json: JSON.parse(text) };
    } catch {
      return { ok: false, status: r.status, nonJson: true };
    }
  } catch (e) {
    return { ok: false, error: e.message || 'fetch failed' };
  } finally {
    clearTimeout(t);
  }
}

// ---- backends --------------------------------------------------------------
function normaliseOpenAlexWork(w) {
  if (!w) return null;
  return {
    source: 'openalex',
    title: w.display_name || w.title || '',
    year: w.publication_year || null,
    doi: extractDoi(w.doi || (w.ids && w.ids.doi) || ''),
    authors: (w.authorships || []).map((a) => (a.author && a.author.display_name) || '').filter(Boolean),
  };
}
async function openAlexByDoi(doi) {
  // Encode special characters but keep the DOI's slashes raw — OpenAlex's doi
  // filter rejects a percent-encoded slash (%2F) and returns no result.
  const doiParam = encodeURIComponent(doi).replace(/%2F/gi, '/');
  const url = `https://api.openalex.org/works?filter=doi:${doiParam}&per-page=1&mailto=${encodeURIComponent(MAILTO)}`;
  const res = await throttled(() => getJson(url));
  if (!res.ok) return { networkError: !res.status, work: null };
  const w = res.json && Array.isArray(res.json.results) ? res.json.results[0] : null;
  return { networkError: false, work: normaliseOpenAlexWork(w) };
}
async function openAlexByTitle(title) {
  const url = `https://api.openalex.org/works?filter=title.search:${encodeURIComponent(title)}&per-page=3&mailto=${encodeURIComponent(MAILTO)}`;
  const res = await throttled(() => getJson(url));
  if (!res.ok) return { networkError: !res.status, works: [] };
  const works = res.json && Array.isArray(res.json.results) ? res.json.results.map(normaliseOpenAlexWork).filter(Boolean) : [];
  return { networkError: false, works };
}
async function pubmedByTitle(title) {
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(title)}%5BTitle%5D&retmax=3&retmode=json`;
  const s = await throttled(() => getJson(searchUrl), 12000);
  if (!s.ok) return { networkError: !s.status, works: [] };
  const ids = (s.json && s.json.esearchresult && s.json.esearchresult.idlist) || [];
  if (ids.length === 0) return { networkError: false, works: [] };
  const sumUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
  const sum = await throttled(() => getJson(sumUrl), 12000);
  if (!sum.ok) return { networkError: !sum.status, works: [] };
  const result = (sum.json && sum.json.result) || {};
  const works = ids
    .map((id) => result[id])
    .filter(Boolean)
    .map((r) => ({
      source: 'pubmed',
      title: r.title || '',
      year: r.pubdate ? parseInt(String(r.pubdate).slice(0, 4), 10) || null : null,
      pmid: r.uid || null,
      doi: extractDoi((r.articleids || []).map((a) => a.value).join(' ')),
      authors: (r.authors || []).map((a) => a.name).filter(Boolean),
    }));
  return { networkError: false, works };
}

// ---- matching --------------------------------------------------------------
function authorMatch(inputAuthors, canonAuthors) {
  if (!inputAuthors || !inputAuthors.length) return null; // not asserted
  const canon = new Set((canonAuthors || []).map(surname).filter(Boolean));
  return inputAuthors.map(surname).some((s) => s && canon.has(s));
}
function yearMatch(inputYear, canonYear) {
  if (!inputYear || !canonYear) return null;
  return Math.abs(Number(inputYear) - Number(canonYear)) <= 1;
}
function candidateMatches(input, canon) {
  const sim = input.title ? titleSimilarity(input.title, canon.title) : null;
  const am = authorMatch(input.authors, canon.authors);
  const ym = yearMatch(input.year, canon.year);
  const titleOk = sim == null ? null : sim >= TITLE_SIMILARITY_THRESHOLD;
  // A candidate matches when the title is similar and nothing supplied contradicts.
  const matched = titleOk === true && am !== false && ym !== false;
  return { matched, checks: { titleSimilarity: sim, authorMatch: am, yearMatch: ym } };
}

const _cache = new Map();
function cacheKey(input) {
  return `${extractDoi(input.doi) || ''}|${normaliseTitle(input.title)}`;
}

// ---- public API ------------------------------------------------------------
export async function verifyCitation(input, { useCache = true } = {}) {
  const doi = extractDoi(input.doi) || extractDoi(input.title);
  const norm = { doi, title: input.title || '', authors: input.authors || [], year: input.year || null };
  const key = cacheKey(norm);
  if (useCache && _cache.has(key)) return _cache.get(key);

  let out;
  try {
    if (doi) {
      const { networkError, work } = await openAlexByDoi(doi);
      if (work) {
        // DOI resolved. If a title was supplied, verify it matches this DOI's
        // actual paper — this catches "real DOI, wrong paper".
        if (norm.title) {
          const m = candidateMatches(norm, work);
          out = {
            verdict: m.matched ? 'verified' : 'mismatch',
            canonical: work,
            checks: { doiResolved: true, ...m.checks },
            networkError: false,
          };
        } else {
          out = { verdict: 'verified', canonical: work, checks: { doiResolved: true }, networkError: false };
        }
      } else if (networkError) {
        out = { verdict: 'unverifiable', canonical: null, checks: { doiResolved: null }, networkError: true };
      } else {
        // DOI did not resolve anywhere; fall through to title search if we have one.
        out = null;
      }
    }

    if (!out) {
      if (!norm.title) {
        out = { verdict: 'unverifiable', canonical: null, checks: { doiResolved: doi ? false : null }, networkError: false };
      } else {
        let netErr = false;
        const oa = await openAlexByTitle(norm.title);
        netErr = netErr || oa.networkError;
        let hit = oa.works.map((w) => ({ w, m: candidateMatches(norm, w) })).find((x) => x.m.matched);
        if (!hit) {
          const pm = await pubmedByTitle(norm.title);
          netErr = netErr || pm.networkError;
          hit = pm.works.map((w) => ({ w, m: candidateMatches(norm, w) })).find((x) => x.m.matched);
        }
        if (hit) {
          out = { verdict: 'verified', canonical: hit.w, checks: { doiResolved: doi ? false : null, ...hit.m.checks }, networkError: false };
        } else if (netErr) {
          out = { verdict: 'unverifiable', canonical: null, checks: { doiResolved: doi ? false : null }, networkError: true };
        } else {
          out = { verdict: 'unverifiable', canonical: null, checks: { doiResolved: doi ? false : null }, networkError: false };
        }
      }
    }
  } catch (e) {
    out = { verdict: 'unverifiable', canonical: null, checks: {}, networkError: true, error: e.message };
  }

  out.input = { doi: norm.doi || null, title: norm.title || null };
  if (useCache) _cache.set(key, out);
  return out;
}

export async function verifyCitations(citations, opts) {
  const list = Array.isArray(citations) ? citations : [];
  const results = [];
  for (const c of list) {
    const input = typeof c === 'string' ? { title: c } : c || {};
    // eslint-disable-next-line no-await-in-loop
    results.push(await verifyCitation(input, opts));
  }
  const summary = results.reduce(
    (acc, r) => { acc[r.verdict] = (acc[r.verdict] || 0) + 1; return acc; },
    { verified: 0, mismatch: 0, unverifiable: 0 }
  );
  return { results, summary };
}
