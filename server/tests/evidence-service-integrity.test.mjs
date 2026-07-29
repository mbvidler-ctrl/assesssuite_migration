// WP2 — evidence-query integrity.
//
// Offline and pure: exercises searchEvidence() directly against a stubbed
// globalThis.fetch (same pattern as outbound-capability-gates.test.mjs).
// No sqlite/http-server harness needed — server/evidence.mjs's only external
// dependency is `fetch`.

import assert from 'node:assert/strict';
import test from 'node:test';

import { searchEvidence } from '../evidence.mjs';

function fakeOpenAlexWork(overrides = {}) {
  return {
    id: 'https://openalex.org/W1',
    display_name: overrides.title || 'A fabricated but well-formed work',
    title: overrides.title || 'A fabricated but well-formed work',
    publication_year: overrides.year || 2020,
    doi: overrides.doi || 'https://doi.org/10.1000/synthetic-a',
    authorships: [{ author: { display_name: 'Synthetic Author' } }],
  };
}

function jsonResponse(body) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

test('a comma in the condition string cannot inject a second OpenAlex filter clause', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const capturedUrls = [];
  globalThis.fetch = async (url) => {
    capturedUrls.push(url);
    return jsonResponse({ results: [fakeOpenAlexWork()] });
  };
  try {
    await searchEvidence('knee pain,type:dataset', { reviewsOnly: false, limit: 5 });
    assert.equal(capturedUrls.length, 1, 'exactly one fetch call expected');
    const requestedUrl = new URL(capturedUrls[0]);
    const filterParam = requestedUrl.searchParams.get('filter');
    // Only the comma (the OpenAlex clause separator) is sanitised; a
    // remaining colon inside the title.search value is inert here because,
    // with no comma left to end the clause, it never reaches the filter
    // builder as a second key:value pair.
    assert.equal(filterParam, 'title.search:knee pain type:dataset');
    assert.equal(filterParam.split(',').length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a comma cannot introduce a third clause or corrupt the reviews-only clause', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const capturedUrls = [];
  globalThis.fetch = async (url) => {
    capturedUrls.push(url);
    return jsonResponse({ results: [fakeOpenAlexWork()] });
  };
  try {
    await searchEvidence('knee pain,type:dataset', { reviewsOnly: true, limit: 5 });
    assert.equal(capturedUrls.length, 1, 'exactly one fetch call expected');
    const requestedUrl = new URL(capturedUrls[0]);
    const filterParam = requestedUrl.searchParams.get('filter');
    const clauses = filterParam.split(',');
    assert.equal(clauses.length, 2);
    assert.equal(clauses[0], 'title.search:knee pain type:dataset');
    assert.equal(clauses[1], 'type:review');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reviewsOnlyApplied reports the silent degradation to a broader search', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    const requestedUrl = new URL(url);
    const filterParam = requestedUrl.searchParams.get('filter') || '';
    if (filterParam.includes('type:review')) {
      return jsonResponse({ results: [] });
    }
    return jsonResponse({ results: [fakeOpenAlexWork()] });
  };
  try {
    const result = await searchEvidence('rare condition x');
    assert.equal(calls, 2, 'expected the reviews-only search then the broadened fallback');
    assert.equal(result.reviewsOnlyApplied, false);
    assert.ok(result.results.length > 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reviewsOnlyApplied is true when the reviews-only search itself succeeds', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse({ results: [fakeOpenAlexWork()] });
  };
  try {
    const result = await searchEvidence('common condition');
    assert.equal(calls, 1);
    assert.equal(result.reviewsOnlyApplied, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
