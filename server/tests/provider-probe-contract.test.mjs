import assert from 'node:assert/strict';
import test from 'node:test';

import {
  providerPolicyAssurance,
  providerProbeDifferentialMetadata,
  providerProbeFullFieldMetadata,
  providerProbeMultiFileMetadata,
} from './provider-probe.mjs';
import {
  REFERRAL_EXTRACTION_SCHEMA_PROPERTY_COUNT,
  REFERRAL_EXTRACTION_SCHEMA_SHA256,
} from '../../src/lib/referralExtractionSchema.js';
import {
  CANONICAL_REFERRAL_PROFILE_A,
  CANONICAL_REFERRAL_PROFILE_DOB_CHANGE,
  CANONICAL_REFERRAL_PROFILE_FULL_39,
  CANONICAL_REFERRAL_PROFILE_MULTI_FORWARD,
  CANONICAL_REFERRAL_PROFILE_MULTI_REVERSED,
} from './support/syntheticReferralFixtures.mjs';

const SHARED_FILENAME = 'synthetic-differential-referral.pdf';

function probeResult(output, requestedFilename = SHARED_FILENAME) {
  return { result: 'PASS', output, requestedFilenames: [requestedFilename] };
}

test('provider policy metadata exposes the exact canonical schema hash, count, and key parity', () => {
  const assurance = providerPolicyAssurance();
  assert.deepEqual(assurance.schemaMetadata, {
    canonical_schema_hash: REFERRAL_EXTRACTION_SCHEMA_SHA256,
    canonical_schema_property_count: REFERRAL_EXTRACTION_SCHEMA_PROPERTY_COUNT,
    canonical_schema_key_parity: true,
    provider_required_key_parity: true,
  });
  assert.equal(Object.values(assurance.schemaIntegrity).every(Boolean), true);
  assert.equal(Object.values(assurance.metadata).every(Boolean), true);
});

test('differential metadata proves same filename, changed DOB, and stable grounded fields without values', () => {
  const metadata = providerProbeDifferentialMetadata(
    probeResult(CANONICAL_REFERRAL_PROFILE_A),
    probeResult(CANONICAL_REFERRAL_PROFILE_DOB_CHANGE),
  );
  assert.deepEqual(metadata, {
    probe: 'provider-probe-differential-grounding',
    result: 'PASS',
    same_requested_filename: true,
    changed_source_field: 'date_of_birth',
    grounded_fields_stable: true,
    compared_field_count: 39,
    stable_field_count: 38,
  });
  assert.doesNotMatch(JSON.stringify(metadata), /Alex|1990|1991|Synthetic|ankle|asthma/i);
});

test('differential metadata fails closed for filename, DOB, or grounded-field drift', () => {
  const filenameDrift = providerProbeDifferentialMetadata(
    probeResult(CANONICAL_REFERRAL_PROFILE_A),
    probeResult(CANONICAL_REFERRAL_PROFILE_DOB_CHANGE, 'different-name.pdf'),
  );
  assert.equal(filenameDrift.result, 'FAIL');
  assert.equal(filenameDrift.same_requested_filename, false);

  const noDobChange = providerProbeDifferentialMetadata(
    probeResult(CANONICAL_REFERRAL_PROFILE_A),
    probeResult(CANONICAL_REFERRAL_PROFILE_A),
  );
  assert.equal(noDobChange.result, 'FAIL');

  const groundedDrift = providerProbeDifferentialMetadata(
    probeResult(CANONICAL_REFERRAL_PROFILE_A),
    probeResult({ ...CANONICAL_REFERRAL_PROFILE_DOB_CHANGE, primary_condition: 'different condition' }),
  );
  assert.equal(groundedDrift.result, 'FAIL');
  assert.equal(groundedDrift.grounded_fields_stable, false);
});

test('full-field metadata proves all 39 meaningful values without emitting any referral value', () => {
  const metadata = providerProbeFullFieldMetadata(probeResult(CANONICAL_REFERRAL_PROFILE_FULL_39));
  assert.deepEqual(metadata, {
    probe: 'provider-probe-full-field-grounding',
    result: 'PASS',
    compared_field_count: 39,
    all_fields_meaningful: true,
    canonical_key_order: true,
  });
  for (const value of Object.values(CANONICAL_REFERRAL_PROFILE_FULL_39).flat()) {
    assert.equal(JSON.stringify(metadata).includes(value), false);
  }
});

test('multi-file metadata proves forward and reversed precedence, fill-empty, and array union', () => {
  const metadata = providerProbeMultiFileMetadata(
    probeResult(CANONICAL_REFERRAL_PROFILE_MULTI_FORWARD),
    probeResult(CANONICAL_REFERRAL_PROFILE_MULTI_REVERSED),
  );
  assert.deepEqual(metadata, {
    probe: 'provider-probe-multi-file-reconciliation',
    result: 'PASS',
    forward_primary_precedence: true,
    reversed_primary_precedence: true,
    fill_empty_observed: true,
    stable_array_union_observed: true,
  });
  assert.doesNotMatch(JSON.stringify(metadata), /Alex|Conflicting|asthma|Migraine|Ibuprofen|Paracetamol/i);
});
