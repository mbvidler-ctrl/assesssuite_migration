import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { searchClinicalEvidence } from '../clinicalEvidence.mjs';
import { createEvidenceCacheRepository } from '../db.mjs';

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fixtureFetch(calls) {
  return async (url) => {
    const value = String(url);
    calls.push(value);
    if (value.includes('esearch.fcgi')) {
      return response({ esearchresult: { idlist: ['12345678'] } });
    }
    if (value.includes('esummary.fcgi')) {
      return response({
        result: {
          '12345678': {
            uid: '12345678',
            title: 'Exercise therapy for synthetic knee pain: a systematic review',
            pubdate: '2025 Jan',
            pubtype: ['Systematic Review', 'Meta-Analysis'],
            authors: [{ name: 'Example A' }],
            articleids: [{ idtype: 'doi', value: '10.1000/shared-evidence' }],
          },
        },
      });
    }
    if (value.includes('api.openalex.org')) {
      return response({
        results: [{
          id: 'https://openalex.org/W1',
          display_name: 'Exercise therapy for synthetic knee pain: a systematic review',
          publication_year: 2025,
          type: 'review',
          doi: 'https://doi.org/10.1000/shared-evidence',
          cited_by_count: 42,
          authorships: [{ author: { display_name: 'Example A' } }],
          ids: { pmid: 'https://pubmed.ncbi.nlm.nih.gov/12345678/' },
        }],
      });
    }
    if (value.includes('api.crossref.org')) {
      return response({
        message: {
          items: [{
            DOI: '10.1000/shared-evidence',
            title: ['Exercise therapy for synthetic knee pain: a systematic review'],
            author: [{ given: 'A', family: 'Example' }],
            published: { 'date-parts': [[2025, 1, 1]] },
            type: 'journal-article',
            'is-referenced-by-count': 41,
          }],
        },
      });
    }
    if (value.includes('clinicaltrials.gov')) {
      return response({
        studies: [{
          protocolSection: {
            identificationModule: { nctId: 'NCT00000001', briefTitle: 'Exercise trial for synthetic knee pain' },
            designModule: { studyType: 'INTERVENTIONAL' },
            statusModule: { overallStatus: 'COMPLETED', startDateStruct: { date: '2022-01' } },
          },
        }],
      });
    }
    throw new Error(`unexpected evidence URL ${value}`);
  };
}

test('clinical evidence aggregates four primary sources, deduplicates identifiers and persists a shared TTL cache', async () => {
  const db = new DatabaseSync(':memory:');
  let clock = new Date('2026-08-30T00:00:00.000Z');
  const cacheRepository = createEvidenceCacheRepository(db, { now: () => clock });
  const calls = [];
  const first = await searchClinicalEvidence('  Synthetic KNEE pain  ', {
    limit: 10,
    cacheRepository,
    fetchImpl: fixtureFetch(calls),
    now: () => clock,
  });

  assert.equal(first.cache.mode, 'miss');
  assert.equal(first.query, 'synthetic knee pain');
  assert.equal(calls.length, 5, 'PubMed uses search+summary; the other three sources use one call');
  assert.equal(first.results.length, 1, 'review-only mode returns the merged review and excludes lower-level trials when review evidence exists');
  assert.equal(first.reviewsOnlyApplied, true);
  const review = first.results.find((item) => item.doi === '10.1000/shared-evidence');
  assert.deepEqual(review.sources, ['crossref', 'openalex', 'pubmed']);
  assert.equal(review.source, 'crossref');
  assert.equal(review.pmid, '12345678');
  assert.equal(review.evidence_type, 'meta_analysis');

  const callsAfterFirstSearch = calls.length;
  const second = await searchClinicalEvidence('synthetic knee pain', {
    limit: 10,
    cacheRepository,
    fetchImpl: async () => { throw new Error('cache hit must not call a provider'); },
    now: () => clock,
  });
  assert.equal(second.cache.mode, 'hit');
  assert.equal(calls.length, callsAfterFirstSearch);
  assert.deepEqual(second.results, first.results);

  const callsBeforeRefresh = calls.length;
  const refreshed = await searchClinicalEvidence('synthetic knee pain', {
    limit: 10,
    cacheRepository,
    forceRefresh: true,
    fetchImpl: fixtureFetch(calls),
    now: () => clock,
  });
  assert.equal(refreshed.cache.mode, 'miss');
  assert.equal(calls.length, callsBeforeRefresh + 5, 'an explicit refresh bypasses the still-live cache');

  clock = new Date('2026-10-01T00:00:00.000Z');
  const stale = await searchClinicalEvidence('synthetic knee pain', {
    limit: 10,
    cacheRepository,
    fetchImpl: async () => { throw Object.assign(new Error('offline'), { code: 'offline' }); },
    now: () => clock,
  });
  assert.equal(stale.cache.mode, 'stale_fallback');
  assert.equal(stale.networkError, true);
  assert.deepEqual(stale.results, first.results);
  assert.ok(Object.values(stale.source_status).every((entry) => entry.status === 'error'));
  db.close();
});

test('review-only search broadens transparently only when no review-level evidence exists', async () => {
  const result = await searchClinicalEvidence('synthetic rare rehabilitation topic', {
    reviewsOnly: true,
    includeTrials: true,
    fetchImpl: async (url) => {
      const value = String(url);
      if (value.includes('esearch.fcgi')) return response({ esearchresult: { idlist: [] } });
      if (value.includes('esummary.fcgi')) return response({ result: {} });
      if (value.includes('api.openalex.org')) return response({ results: [] });
      if (value.includes('api.crossref.org')) return response({ message: { items: [] } });
      if (value.includes('clinicaltrials.gov')) {
        return response({ studies: [{ protocolSection: {
          identificationModule: { nctId: 'NCT99999999', briefTitle: 'Synthetic rehabilitation trial' },
          designModule: { studyType: 'INTERVENTIONAL' },
          statusModule: { overallStatus: 'RECRUITING', startDateStruct: { date: '2026-01' } },
        } }] });
      }
      throw new Error(`unexpected evidence URL ${value}`);
    },
  });
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].evidence_type, 'clinical_trial');
  assert.equal(result.reviewsOnlyApplied, false);
});

test('evidence query parameters remain data, not provider query-language structure', async () => {
  const calls = [];
  await searchClinicalEvidence('knee pain&api_key=attacker,filter:type:dataset', {
    limit: 2,
    includeTrials: false,
    fetchImpl: fixtureFetch(calls),
  });
  for (const raw of calls) {
    const url = new URL(raw);
    assert.equal(url.searchParams.get('api_key'), null);
    assert.equal(url.searchParams.get('filter'), null);
  }
});
