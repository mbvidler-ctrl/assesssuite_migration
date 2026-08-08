import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditProtocolCatalogue,
  MAX_PROTOCOL_RESULT_LIMIT,
  normaliseProtocolQuery,
  PROTOCOL_SEARCH_STATE,
  searchProtocolCatalogue,
  validateProtocolGovernance,
} from '../../src/lib/clinical/protocol-assistance/index.js';

const AS_OF = '2026-08-08';
const CONTEXT = Object.freeze({
  profession: 'Accredited Exercise Physiologist',
  scope: 'Exercise Physiology',
  asOf: AS_OF,
});

function governedProtocol({
  id,
  condition,
  aliases = [],
  profession = ['accredited_exercise_physiologist'],
  scope = ['exercise_physiology'],
  version = '1.0.0',
  expiry = '2027-08-08',
  category = 'synthetic_test',
} = {}) {
  return {
    id: id || `synthetic:${condition}`,
    condition_name: condition,
    aliases,
    category,
    overview: { summary: 'Synthetic catalogue fixture; not clinical advice.' },
    governance: {
      profession,
      scope,
      source: [{
        title: 'Synthetic protocol governance fixture',
        source_id: `source:${id || condition}`,
      }],
      reviewer: {
        name: 'Synthetic Reviewer',
        credentials: 'Test fixture only',
        reviewed_at: '2026-08-01',
      },
      version,
      expiry,
      rights: {
        status: 'internal_original',
        holder: 'Synthetic Test Fixture',
      },
      management_target: {
        code: 'functional_capacity',
        label: 'Functional capacity management',
      },
      approval_status: 'approved',
    },
  };
}

function resultIds(result) {
  return result.matches.map((entry) => entry.id);
}

test('free-text Enter and autocomplete preset inputs use identical query normalisation and results', () => {
  const catalogue = [
    governedProtocol({
      id: 'knee-oa',
      condition: 'Knee Osteoarthritis',
      aliases: ['Knee OA'],
    }),
  ];

  const freeText = searchProtocolCatalogue({
    query: '  KNEE---OA  ',
    catalogue,
    ...CONTEXT,
  });
  const preset = searchProtocolCatalogue({
    query: { name: 'Knee OA' },
    catalogue,
    ...CONTEXT,
  });

  assert.equal(normaliseProtocolQuery('  KNEE---OA  ').normalised, 'knee oa');
  assert.equal(normaliseProtocolQuery({ name: 'Knee OA' }).normalised, 'knee oa');
  assert.equal(freeText.state, PROTOCOL_SEARCH_STATE.MATCHES);
  assert.equal(preset.state, PROTOCOL_SEARCH_STATE.MATCHES);
  assert.deepEqual(resultIds(freeText), resultIds(preset));
  assert.equal(freeText.matches[0].match.kind, 'exact_alias');
});

test('unsupported and no-match topics are explicit and never return protocol content', () => {
  const catalogue = [
    governedProtocol({ id: 'knee-oa', condition: 'Knee Osteoarthritis' }),
    {
      id: 'unsupported-procedure',
      condition_name: 'Invasive spinal procedure',
      aliases: ['spinal procedure'],
      support_status: 'unsupported',
      unsupported_reason: 'Outside the reviewed exercise-physiology catalogue and professional scope.',
    },
  ];

  const unsupported = searchProtocolCatalogue({
    query: 'spinal procedure',
    catalogue,
    ...CONTEXT,
  });
  const noMatch = searchProtocolCatalogue({
    query: 'Synthetic unknown syndrome',
    catalogue,
    ...CONTEXT,
  });

  assert.equal(unsupported.state, PROTOCOL_SEARCH_STATE.UNSUPPORTED);
  assert.equal(unsupported.code, 'explicitly_unsupported');
  assert.deepEqual(unsupported.matches, []);
  assert.equal(unsupported.reasons[0].condition_name, 'Invasive spinal procedure');
  assert.equal(noMatch.state, PROTOCOL_SEARCH_STATE.NO_MATCH);
  assert.equal(noMatch.code, 'no_reviewed_match');
  assert.deepEqual(noMatch.matches, []);
});

test('profession or scope mismatch fails as unsupported', () => {
  const catalogue = [governedProtocol({ id: 'knee-oa', condition: 'Knee Osteoarthritis' })];
  const result = searchProtocolCatalogue({
    query: 'Knee Osteoarthritis',
    catalogue,
    profession: 'Physiotherapist',
    scope: 'Physiotherapy',
    asOf: AS_OF,
  });

  assert.equal(result.state, PROTOCOL_SEARCH_STATE.UNSUPPORTED);
  assert.equal(result.code, 'profession_out_of_bounds');
  assert.deepEqual(result.matches, []);
});

test('missing governance metadata identifies every required field and blocks matching legacy rows', () => {
  const legacyRow = {
    id: 'legacy-knee-oa',
    condition_name: 'Knee Osteoarthritis',
    category: 'musculoskeletal',
    source_id: 'legacy-base44-source',
  };
  const validation = validateProtocolGovernance(legacyRow, { asOf: AS_OF });
  const fields = new Set(validation.errors.map((entry) => entry.field.split('.')[0]));

  for (const required of [
    'profession',
    'scope',
    'source',
    'reviewer',
    'version',
    'expiry',
    'rights',
    'management_target',
  ]) {
    assert.ok(fields.has(required), `expected missing ${required} to be reported`);
  }

  const search = searchProtocolCatalogue({
    query: 'Knee Osteoarthritis',
    catalogue: [legacyRow],
    ...CONTEXT,
  });
  assert.equal(search.state, PROTOCOL_SEARCH_STATE.CATALOGUE_BLOCKED);
  assert.equal(search.code, 'matching_catalogue_entry_failed_governance');
  assert.equal(search.blocked[0].id, 'legacy-knee-oa');
  assert.deepEqual(search.matches, []);

  const audit = auditProtocolCatalogue([legacyRow], { asOf: AS_OF });
  assert.equal(audit.ok, false);
  assert.equal(audit.code, 'catalogue_governance_incomplete');
});

test('bare source labels fail traceability and cannot become controlled catalogue sources', () => {
  const bareLabel = governedProtocol({
    id: 'bare-source-label',
    condition: 'Bare Source Label Condition',
  });
  bareLabel.governance.source = ['Unversioned guideline label'];

  const validation = validateProtocolGovernance(bareLabel, { asOf: AS_OF });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some(
    (entry) => entry.field === 'source' && entry.code === 'traceable_source_required',
  ));

  const result = searchProtocolCatalogue({
    query: 'Bare Source Label Condition',
    catalogue: [bareLabel],
    ...CONTEXT,
  });
  assert.equal(result.state, PROTOCOL_SEARCH_STATE.CATALOGUE_BLOCKED);
  assert.deepEqual(result.matches, []);
});

test('ordering is deterministic across catalogue input order', () => {
  const catalogue = [
    governedProtocol({ id: 'knee-zeta', condition: 'Knee Zeta Capacity' }),
    governedProtocol({ id: 'knee-exact', condition: 'Knee', aliases: ['Knee exact'] }),
    governedProtocol({ id: 'knee-alpha', condition: 'Knee Alpha Capacity' }),
    governedProtocol({ id: 'knee-alias', condition: 'Lower Limb Capacity', aliases: ['Knee'] }),
  ];

  const forward = searchProtocolCatalogue({ query: 'knee', catalogue, ...CONTEXT });
  const reverse = searchProtocolCatalogue({ query: 'knee', catalogue: [...catalogue].reverse(), ...CONTEXT });

  assert.equal(forward.state, PROTOCOL_SEARCH_STATE.MATCHES);
  assert.deepEqual(resultIds(forward), [
    'knee-exact',
    'knee-alias',
    'knee-alpha',
    'knee-zeta',
  ]);
  assert.deepEqual(resultIds(forward), resultIds(reverse));
});

test('unrelated catalogue growth does not change matches and result growth is hard-bounded', () => {
  const anchors = [
    governedProtocol({ id: 'knee-alpha', condition: 'Knee Alpha Capacity' }),
    governedProtocol({ id: 'knee-beta', condition: 'Knee Beta Capacity' }),
  ];
  const unrelated = Array.from({ length: 5_000 }, (_, index) => governedProtocol({
    id: `unrelated-${String(index).padStart(5, '0')}`,
    condition: `Zeta Synthetic Topic ${String(index).padStart(5, '0')}`,
  }));

  const baseline = searchProtocolCatalogue({ query: 'knee', catalogue: anchors, ...CONTEXT });
  const grown = searchProtocolCatalogue({ query: 'knee', catalogue: [...unrelated, ...anchors], ...CONTEXT });
  assert.deepEqual(resultIds(grown), resultIds(baseline));

  const manyMatches = Array.from({ length: 100 }, (_, index) => governedProtocol({
    id: `knee-${String(index).padStart(3, '0')}`,
    condition: `Knee Synthetic Topic ${String(index).padStart(3, '0')}`,
  }));
  const bounded = searchProtocolCatalogue({
    query: 'knee',
    catalogue: manyMatches,
    limit: 10_000,
    ...CONTEXT,
  });
  assert.equal(bounded.matches.length, MAX_PROTOCOL_RESULT_LIMIT);
  assert.deepEqual(
    resultIds(bounded),
    manyMatches.slice(0, MAX_PROTOCOL_RESULT_LIMIT).map((entry) => entry.id),
  );
});

test('expired reviewed cards are blocked, not silently returned', () => {
  const expired = governedProtocol({
    id: 'expired-knee',
    condition: 'Knee Osteoarthritis',
    expiry: '2026-08-07',
  });
  const result = searchProtocolCatalogue({
    query: 'Knee Osteoarthritis',
    catalogue: [expired],
    ...CONTEXT,
  });

  assert.equal(result.state, PROTOCOL_SEARCH_STATE.CATALOGUE_BLOCKED);
  assert.ok(result.blocked[0].issues.some((entry) => entry.field === 'expiry' && entry.code === 'expired'));
  assert.deepEqual(result.matches, []);
});
