import { createHash } from 'node:crypto';

const MAILTO = process.env.EVIDENCE_MAILTO || 'research@unimatter.com.au';
const USER_AGENT = `AssessSuite-evidence/2.0 (mailto:${MAILTO})`;
const SOURCE_REVISION = 'assesssuite-clinical-evidence/2.0.0';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_STALE_MS = 180 * 24 * 60 * 60 * 1000;

function cleanText(value, maxLength = 500) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function normalizeEvidenceQuery(value) {
  return cleanText(value, 240).normalize('NFKC').toLowerCase();
}

function normalizeTitle(value) {
  return cleanText(value, 600).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractDoi(value) {
  const match = String(value || '').match(/10\.\d{4,9}\/[^\s"'<>]+/i);
  return match ? match[0].replace(/[.,;)]+$/, '').toLowerCase() : null;
}

function safeYear(value) {
  const year = Number.parseInt(String(value || ''), 10);
  return year >= 1800 && year <= new Date().getUTCFullYear() + 2 ? year : null;
}

function cacheKeyFor(request) {
  return createHash('sha256').update(JSON.stringify({ revision: SOURCE_REVISION, ...request })).digest('hex');
}

async function getJson(fetchImpl, url, { timeoutMs = 12_000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : {}; } catch { /* handled below */ }
    if (!response.ok || body == null) {
      const error = new Error(`evidence source returned HTTP ${response.status}`);
      error.code = response.status === 429 ? 'rate_limited' : 'provider_error';
      throw error;
    }
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('evidence source timed out');
      timeoutError.code = 'timeout';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function publicationType(value) {
  const text = cleanText(Array.isArray(value) ? value.join(' ') : value, 300).toLowerCase();
  if (/clinical practice guideline|practice guideline|guideline/.test(text)) return 'guideline';
  if (/meta[- ]analysis/.test(text)) return 'meta_analysis';
  if (/systematic review/.test(text)) return 'systematic_review';
  if (/randomi[sz]ed controlled trial|controlled clinical trial/.test(text)) return 'randomized_trial';
  if (/review/.test(text)) return 'review';
  if (/interventional/.test(text)) return 'clinical_trial';
  return 'article';
}

function openAlexType(work) {
  const topics = [work?.type, work?.subtype, ...(work?.keywords || []).map((entry) => entry?.display_name)];
  return publicationType(topics);
}

function openAlexResult(work) {
  const doi = extractDoi(work?.doi || work?.ids?.doi);
  const title = cleanText(work?.display_name || work?.title, 600);
  if (!title) return null;
  return {
    title,
    authors: (work?.authorships || []).map((entry) => cleanText(entry?.author?.display_name, 120)).filter(Boolean).slice(0, 8),
    year: safeYear(work?.publication_year),
    doi,
    pmid: cleanText(work?.ids?.pmid, 80).replace(/^https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\//, '').replace(/\/$/, '') || null,
    nct_id: null,
    url: doi ? `https://doi.org/${doi}` : cleanText(work?.primary_location?.landing_page_url || work?.id, 800),
    evidence_type: openAlexType(work),
    cited_by_count: Number(work?.cited_by_count) || 0,
    status: 'published',
    sources: ['openalex'],
  };
}

async function searchOpenAlex(query, limit, fetchImpl) {
  const params = new URLSearchParams({
    search: query,
    'per-page': String(Math.min(limit * 2, 40)),
    sort: 'cited_by_count:desc',
    mailto: MAILTO,
  });
  const apiKey = String(process.env.OPENALEX_API_KEY || '').trim();
  if (apiKey) params.set('api_key', apiKey);
  const body = await getJson(fetchImpl, `https://api.openalex.org/works?${params}`);
  return (Array.isArray(body?.results) ? body.results : []).map(openAlexResult).filter(Boolean);
}

function pubmedResult(summary) {
  const title = cleanText(summary?.title, 600);
  if (!title) return null;
  const articleIds = Array.isArray(summary?.articleids) ? summary.articleids : [];
  const doi = extractDoi(articleIds.map((entry) => entry?.value).join(' '));
  const pmid = cleanText(summary?.uid, 40) || null;
  return {
    title,
    authors: (summary?.authors || []).map((entry) => cleanText(entry?.name, 120)).filter(Boolean).slice(0, 8),
    year: safeYear(summary?.pubdate),
    doi,
    pmid,
    nct_id: null,
    url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : (doi ? `https://doi.org/${doi}` : null),
    evidence_type: publicationType(summary?.pubtype),
    cited_by_count: 0,
    status: 'published',
    sources: ['pubmed'],
  };
}

async function searchPubMed(query, limit, fetchImpl) {
  const searchParams = new URLSearchParams({
    db: 'pubmed', term: query, retmax: String(Math.min(limit * 2, 40)), retmode: 'json',
    tool: 'AssessSuite', email: MAILTO,
  });
  const apiKey = String(process.env.NCBI_API_KEY || '').trim();
  if (apiKey) searchParams.set('api_key', apiKey);
  const search = await getJson(fetchImpl, `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`);
  const ids = Array.isArray(search?.esearchresult?.idlist) ? search.esearchresult.idlist.slice(0, limit * 2) : [];
  if (ids.length === 0) return [];
  const summaryParams = new URLSearchParams({
    db: 'pubmed', id: ids.join(','), retmode: 'json', tool: 'AssessSuite', email: MAILTO,
  });
  if (apiKey) summaryParams.set('api_key', apiKey);
  const summary = await getJson(fetchImpl, `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${summaryParams}`);
  return ids.map((id) => pubmedResult(summary?.result?.[id])).filter(Boolean);
}

function crossrefDate(item) {
  const parts = item?.published?.['date-parts']?.[0]
    || item?.['published-print']?.['date-parts']?.[0]
    || item?.['published-online']?.['date-parts']?.[0];
  return Array.isArray(parts) ? safeYear(parts[0]) : null;
}

function crossrefResult(item) {
  const title = cleanText(Array.isArray(item?.title) ? item.title[0] : item?.title, 600);
  if (!title) return null;
  const doi = extractDoi(item?.DOI);
  return {
    title,
    authors: (item?.author || []).map((author) => cleanText([author?.given, author?.family].filter(Boolean).join(' '), 120)).filter(Boolean).slice(0, 8),
    year: crossrefDate(item),
    doi,
    pmid: null,
    nct_id: null,
    url: doi ? `https://doi.org/${doi}` : cleanText(item?.URL, 800),
    evidence_type: publicationType(`${item?.type || ''} ${item?.subtype || ''} ${title}`),
    cited_by_count: Number(item?.['is-referenced-by-count']) || 0,
    status: 'published',
    sources: ['crossref'],
  };
}

async function searchCrossref(query, limit, fetchImpl) {
  const params = new URLSearchParams({
    'query.bibliographic': query,
    rows: String(Math.min(limit * 2, 40)),
    mailto: MAILTO,
  });
  const body = await getJson(fetchImpl, `https://api.crossref.org/works?${params}`);
  return (Array.isArray(body?.message?.items) ? body.message.items : []).map(crossrefResult).filter(Boolean);
}

function trialResult(study) {
  const protocol = study?.protocolSection || {};
  const identification = protocol?.identificationModule || {};
  const design = protocol?.designModule || {};
  const statusModule = protocol?.statusModule || {};
  const nctId = cleanText(identification?.nctId, 40);
  const title = cleanText(identification?.briefTitle || identification?.officialTitle, 600);
  if (!nctId || !title) return null;
  return {
    title,
    authors: [],
    year: safeYear(statusModule?.startDateStruct?.date),
    doi: null,
    pmid: null,
    nct_id: nctId,
    url: `https://clinicaltrials.gov/study/${encodeURIComponent(nctId)}`,
    evidence_type: publicationType(design?.studyType || 'clinical trial'),
    cited_by_count: 0,
    status: cleanText(statusModule?.overallStatus, 80).toLowerCase() || 'registered',
    sources: ['clinicaltrials_gov'],
  };
}

async function searchClinicalTrials(query, limit, fetchImpl) {
  const params = new URLSearchParams({
    'query.cond': query,
    pageSize: String(Math.min(limit, 20)),
    format: 'json',
  });
  const body = await getJson(fetchImpl, `https://clinicaltrials.gov/api/v2/studies?${params}`);
  return (Array.isArray(body?.studies) ? body.studies : []).map(trialResult).filter(Boolean);
}

function dedupeKey(result) {
  if (result.doi) return `doi:${result.doi}`;
  if (result.pmid) return `pmid:${result.pmid}`;
  if (result.nct_id) return `nct:${result.nct_id}`;
  return `title:${normalizeTitle(result.title)}:${result.year || ''}`;
}

const TYPE_WEIGHT = Object.freeze({
  guideline: 100,
  meta_analysis: 95,
  systematic_review: 90,
  randomized_trial: 80,
  review: 70,
  clinical_trial: 50,
  article: 40,
});

function score(result, reviewsOnly) {
  const year = result.year || 1990;
  const recency = Math.max(0, Math.min(12, year - 2014));
  const citations = Math.min(15, Math.log10((result.cited_by_count || 0) + 1) * 6);
  const type = TYPE_WEIGHT[result.evidence_type] || 35;
  const reviewPenalty = reviewsOnly && !['guideline', 'meta_analysis', 'systematic_review', 'review'].includes(result.evidence_type) ? -25 : 0;
  return type + recency + citations + reviewPenalty;
}

function mergeAndRank(groups, { limit, reviewsOnly }) {
  const merged = new Map();
  for (const group of groups) {
    for (const item of group) {
      const key = dedupeKey(item);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...item, sources: [...item.sources] });
        continue;
      }
      merged.set(key, {
        ...existing,
        doi: existing.doi || item.doi,
        pmid: existing.pmid || item.pmid,
        nct_id: existing.nct_id || item.nct_id,
        url: existing.url || item.url,
        authors: existing.authors.length >= item.authors.length ? existing.authors : item.authors,
        cited_by_count: Math.max(existing.cited_by_count || 0, item.cited_by_count || 0),
        sources: [...new Set([...existing.sources, ...item.sources])].sort(),
      });
    }
  }
  const ranked = [...merged.values()]
    .map((item) => ({
      ...item,
      source: item.sources[0],
      relevance_score: Number(score(item, reviewsOnly).toFixed(2)),
    }))
    .sort((a, b) => b.relevance_score - a.relevance_score || (b.year || 0) - (a.year || 0));
  if (reviewsOnly) {
    const preferredTypes = new Set(['guideline', 'meta_analysis', 'systematic_review', 'review']);
    const reviewLevel = ranked.filter((item) => preferredTypes.has(item.evidence_type));
    // Preserve the established contract: prefer a genuinely review-only set,
    // but broaden transparently when no review-level source exists.
    if (reviewLevel.length > 0) return reviewLevel.slice(0, limit);
  }
  return ranked.slice(0, limit);
}

function cacheMetadata(mode, entry = null) {
  return {
    mode,
    source_revision: SOURCE_REVISION,
    fetched_at: entry?.fetchedAt || null,
    expires_at: entry?.expiresAt || null,
    hit_count: entry?.hitCount || 0,
  };
}

export async function searchClinicalEvidence(query, {
  limit = 10,
  reviewsOnly = true,
  includeTrials = true,
  cacheRepository = null,
  forceRefresh = false,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
} = {}) {
  const normalizedQuery = normalizeEvidenceQuery(query);
  if (!normalizedQuery) {
    return { query: normalizedQuery, results: [], source_status: {}, networkError: false, cache: cacheMetadata('none') };
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('Evidence search requires fetch');
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);
  const request = { query: normalizedQuery, limit: safeLimit, reviews_only: reviewsOnly !== false, include_trials: includeTrials !== false };
  const cacheKey = cacheKeyFor(request);
  const observedNow = now();
  const nowDate = observedNow instanceof Date ? observedNow : new Date(observedNow);
  if (!Number.isFinite(nowDate.getTime())) throw new TypeError('Evidence search clock is invalid');
  cacheRepository?.pruneExpired?.(nowDate);
  const cached = cacheRepository?.get(cacheKey) || null;
  if (!forceRefresh && cached && new Date(cached.expiresAt).getTime() > nowDate.getTime()) {
    return { ...cached.result, cache: cacheMetadata('hit', cached) };
  }

  const adapters = [
    ['pubmed', () => searchPubMed(normalizedQuery, safeLimit, fetchImpl)],
    ['openalex', () => searchOpenAlex(normalizedQuery, safeLimit, fetchImpl)],
    ['crossref', () => searchCrossref(normalizedQuery, safeLimit, fetchImpl)],
    ...(request.include_trials ? [['clinicaltrials_gov', () => searchClinicalTrials(normalizedQuery, safeLimit, fetchImpl)]] : []),
  ];
  const settled = await Promise.allSettled(adapters.map(([, operation]) => operation()));
  const groups = [];
  const sourceStatus = {};
  settled.forEach((outcome, index) => {
    const source = adapters[index][0];
    if (outcome.status === 'fulfilled') {
      groups.push(outcome.value);
      sourceStatus[source] = { status: 'ok', result_count: outcome.value.length };
    } else {
      sourceStatus[source] = { status: 'error', code: outcome.reason?.code || 'source_unavailable' };
    }
  });
  const successfulSources = Object.values(sourceStatus).filter((entry) => entry.status === 'ok').length;
  if (successfulSources === 0 && cached && new Date(cached.staleUntil).getTime() > nowDate.getTime()) {
    return {
      ...cached.result,
      source_status: sourceStatus,
      networkError: true,
      cache: cacheMetadata('stale_fallback', cached),
    };
  }
  const rankedResults = mergeAndRank(groups, {
    limit: safeLimit,
    reviewsOnly: request.reviews_only,
  });
  const preferredTypes = new Set(['guideline', 'meta_analysis', 'systematic_review', 'review']);
  const result = {
    query: normalizedQuery,
    results: rankedResults,
    source_status: sourceStatus,
    networkError: successfulSources === 0,
    reviewsOnlyApplied: request.reviews_only && rankedResults.every((item) => preferredTypes.has(item.evidence_type)),
    searched_at: nowDate.toISOString(),
  };
  if (cacheRepository && successfulSources > 0) {
    const entry = cacheRepository.put({
      cacheKey,
      normalizedQuery,
      request,
      result,
      sourceRevision: SOURCE_REVISION,
      fetchedAt: nowDate,
      expiresAt: new Date(nowDate.getTime() + CACHE_TTL_MS),
      staleUntil: new Date(nowDate.getTime() + CACHE_STALE_MS),
    });
    return { ...result, cache: cacheMetadata('miss', entry) };
  }
  return { ...result, cache: cacheMetadata('none') };
}

export const CLINICAL_EVIDENCE_SOURCE_REVISION = SOURCE_REVISION;
