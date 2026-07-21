import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  assertCanonicalReferralExtractionSchema,
  buildResponsesRequest,
  prepareExtractionSchema,
  validateExtractionOutput,
} from '../documentExtraction.mjs';
import {
  REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION as SERVER_AUTHORITY_VERSION,
} from '../uploadRegistry.mjs';
import {
  REFERRAL_EXTRACTION_SCHEMA,
  REFERRAL_EXTRACTION_SCHEMA_PROPERTY_COUNT,
  REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS,
  REFERRAL_EXTRACTION_SCHEMA_SHA256,
} from '../../src/lib/referralExtractionSchema.js';
import {
  CANONICAL_REFERRAL_PROFILE_A,
  CANONICAL_REFERRAL_PROFILE_DOB_CHANGE,
  CANONICAL_REFERRAL_PROFILE_FULL_39,
  canonicalProviderProfile,
  fullFieldReferralPdfFixture,
  pdfFixture,
} from './support/syntheticReferralFixtures.mjs';
import { NARROW_REFERRAL_ASSURANCE_SCHEMA } from './support/synthetic-fixtures.mjs';
import {
  buildReferralClientData,
  buildReferralConditionData,
  prepareReferralReviewData,
} from '../../src/lib/referralReview.js';
import { buildReviewedReferralCommitPayload } from '../../src/lib/referralCommit.js';

const EXPECTED_PRODUCTION_KEYS = Object.freeze([
  'full_name',
  'date_of_birth',
  'gender',
  'phone',
  'email',
  'address',
  'referral_source',
  'referral_source_name',
  'referral_source_address',
  'referral_source_email',
  'referral_provider_number',
  'referral_reason',
  'referral_date',
  'funding_source',
  'medicare_number',
  'medicare_irn',
  'dva_card_number',
  'dva_card_type',
  'dva_file_number',
  'dva_accepted_conditions',
  'ndis_number',
  'ndis_goals',
  'private_health_fund_name',
  'private_health_fund_number',
  'workcover_claim_number',
  'workcover_date_of_injury',
  'workcover_injury_description',
  'primary_condition',
  'comorbidities',
  'medications',
  'medical_history',
  'primary_gp_name',
  'primary_gp_clinic_name',
  'primary_gp_address',
  'primary_gp_phone',
  'primary_gp_email',
  'primary_gp_provider_number',
  'client_goals',
  'medicare_referral_type',
]);

test('canonical referral schema has the exact 39-field production key contract and immutable hash', () => {
  assert.equal(REFERRAL_EXTRACTION_SCHEMA_PROPERTY_COUNT, 39);
  assert.deepEqual(REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS, EXPECTED_PRODUCTION_KEYS);
  assert.deepEqual(Object.keys(REFERRAL_EXTRACTION_SCHEMA.properties), EXPECTED_PRODUCTION_KEYS);
  assert.equal(REFERRAL_EXTRACTION_SCHEMA.additionalProperties, false);
  assert.equal(Object.hasOwn(REFERRAL_EXTRACTION_SCHEMA, 'required'), false);
  assert.equal(Object.isFrozen(REFERRAL_EXTRACTION_SCHEMA), true);
  assert.equal(Object.isFrozen(REFERRAL_EXTRACTION_SCHEMA.properties.comorbidities.items), true);

  const schemaHash = createHash('sha256')
    .update(JSON.stringify(REFERRAL_EXTRACTION_SCHEMA))
    .digest('hex');
  assert.equal(schemaHash, REFERRAL_EXTRACTION_SCHEMA_SHA256);
});

test('server locks referral processing authority to the exact reviewed version', () => {
  assert.equal(SERVER_AUTHORITY_VERSION, 'referral-processing-authority-v2026-07-21.1');
});

test('canonical referral validation rejects expanded, reduced, and reordered property contracts', () => {
  assert.equal(assertCanonicalReferralExtractionSchema(REFERRAL_EXTRACTION_SCHEMA), REFERRAL_EXTRACTION_SCHEMA);

  const expanded = structuredClone(REFERRAL_EXTRACTION_SCHEMA);
  expanded.properties.unreviewed_field = { type: 'string' };
  const reduced = structuredClone(REFERRAL_EXTRACTION_SCHEMA);
  delete reduced.properties.medicare_referral_type;
  const reordered = structuredClone(REFERRAL_EXTRACTION_SCHEMA);
  reordered.properties = Object.fromEntries(Object.entries(reordered.properties).reverse());

  for (const [label, schema] of [
    ['expanded', expanded],
    ['reduced', reduced],
    ['reordered', reordered],
  ]) {
    assert.throws(
      () => assertCanonicalReferralExtractionSchema(schema),
      (error) => error?.httpStatus === 400 && error?.code === 'noncanonical_referral_schema',
      label,
    );
  }
});

test('strict provider transformation preserves canonical key order and requires every nullable provider field', () => {
  const prepared = prepareExtractionSchema(REFERRAL_EXTRACTION_SCHEMA);
  assert.equal(prepared.schemaHash, REFERRAL_EXTRACTION_SCHEMA_SHA256);
  assert.deepEqual(Object.keys(prepared.providerSchema.properties), EXPECTED_PRODUCTION_KEYS);
  assert.deepEqual(prepared.providerSchema.required, EXPECTED_PRODUCTION_KEYS);
  assert.equal(prepared.providerSchema.additionalProperties, false);
  for (const key of EXPECTED_PRODUCTION_KEYS) {
    const type = prepared.providerSchema.properties[key].type;
    assert.ok(Array.isArray(type) && type.includes('null'), `${key} remains nullable when absent from source`);
  }
});

test('provider request construction cannot delegate multi-file reconciliation back to the provider', () => {
  const prepared = prepareExtractionSchema(REFERRAL_EXTRACTION_SCHEMA);
  assert.throws(
    () => buildResponsesRequest({
      files: [{}, {}],
      sourceSchema: prepared.sourceSchema,
      providerSchema: prepared.providerSchema,
    }),
    (error) => error?.httpStatus === 400 && error?.code === 'invalid_file_batch',
  );
});

test('format-faithful synthetic referral proves all 39 extracted values and their reviewed persistence mapping', () => {
  const fixtureBytes = fullFieldReferralPdfFixture();
  const fixtureText = fixtureBytes.toString('latin1');
  assert.match(fixtureText, /ASSURANCE_PROFILE_FULL_39/);
  assert.deepEqual(Object.keys(CANONICAL_REFERRAL_PROFILE_FULL_39), EXPECTED_PRODUCTION_KEYS);
  assert.equal(
    Object.values(CANONICAL_REFERRAL_PROFILE_FULL_39).every((value) =>
      Array.isArray(value)
        ? value.length > 0 && value.every((item) => typeof item === 'string' && item.trim())
        : typeof value === 'string' && Boolean(value.trim())),
    true,
  );
  for (const value of Object.values(CANONICAL_REFERRAL_PROFILE_FULL_39).flat()) {
    assert.equal(fixtureText.includes(value), true, `fixture must visibly ground ${value}`);
  }

  const providerOutput = canonicalProviderProfile(CANONICAL_REFERRAL_PROFILE_FULL_39);
  assert.equal(Object.values(providerOutput).includes(null), false);
  const extracted = validateExtractionOutput(providerOutput, REFERRAL_EXTRACTION_SCHEMA);
  assert.deepEqual(extracted, CANONICAL_REFERRAL_PROFILE_FULL_39);

  const reviewData = prepareReferralReviewData(extracted);
  assert.equal(reviewData.comorbidities, 'Asthma\nMigraine');
  assert.equal(reviewData.medications, 'Salbutamol inhaler\nParacetamol 500 mg as needed');

  const clinicalFields = new Set(['primary_condition', 'comorbidities', 'medications', 'medical_history']);
  const expectedClient = Object.fromEntries(
    Object.entries(CANONICAL_REFERRAL_PROFILE_FULL_39).filter(([key]) => !clinicalFields.has(key)),
  );
  const reviewedClient = buildReferralClientData(reviewData);
  assert.deepEqual(reviewedClient, expectedClient);
  assert.deepEqual(buildReferralConditionData(reviewData), [
    { condition_name: 'Left ankle sprain', condition_type: 'primary' },
    { condition_name: 'Asthma', condition_type: 'comorbidity' },
    { condition_name: 'Migraine', condition_type: 'comorbidity' },
    { condition_name: 'Medication', condition_type: 'comorbidity', medication: 'Salbutamol inhaler' },
    { condition_name: 'Medication', condition_type: 'comorbidity', medication: 'Paracetamol 500 mg as needed' },
    {
      condition_name: 'Relevant medical history',
      condition_type: 'comorbidity',
      notes: 'Synthetic appendicectomy in 2010; no other stated history',
    },
  ]);

  const payload = buildReviewedReferralCommitPayload({
    idempotencyKey: '00000000-0000-4000-8000-000000000039',
    orgId: 'synthetic-org',
    operation: 'create',
    client: reviewedClient,
    conditions: buildReferralConditionData(reviewData),
    uploadIds: ['synthetic-upload'],
  });
  assert.deepEqual(payload.client, expectedClient);
  assert.equal(payload.conditions.length, 6);
  assert.deepEqual(
    [...Object.keys(payload.client), 'primary_condition', 'comorbidities', 'medications', 'medical_history'].sort(),
    [...EXPECTED_PRODUCTION_KEYS].sort(),
  );
});

test('two grounded same-shape referral fixtures differ only in date_of_birth', () => {
  const baselineBytes = pdfFixture();
  const changedBytes = pdfFixture({
    dateOfBirth: CANONICAL_REFERRAL_PROFILE_DOB_CHANGE.date_of_birth,
  });
  assert.notEqual(
    createHash('sha256').update(baselineBytes).digest('hex'),
    createHash('sha256').update(changedBytes).digest('hex'),
  );

  const baseline = validateExtractionOutput(
    canonicalProviderProfile(CANONICAL_REFERRAL_PROFILE_A),
    REFERRAL_EXTRACTION_SCHEMA,
  );
  const changed = validateExtractionOutput(
    canonicalProviderProfile(CANONICAL_REFERRAL_PROFILE_DOB_CHANGE),
    REFERRAL_EXTRACTION_SCHEMA,
  );
  assert.deepEqual(baseline, CANONICAL_REFERRAL_PROFILE_A);
  assert.deepEqual(changed, CANONICAL_REFERRAL_PROFILE_DOB_CHANGE);
  assert.deepEqual(
    Object.keys(baseline).filter((key) => JSON.stringify(baseline[key]) !== JSON.stringify(changed[key])),
    ['date_of_birth'],
  );
});

test('the narrow backend assurance schema remains explicit and cannot masquerade as production', () => {
  assert.deepEqual(
    Object.keys(NARROW_REFERRAL_ASSURANCE_SCHEMA.properties),
    ['full_name', 'date_of_birth', 'diagnoses', 'referrer', 'phone'],
  );
  assert.notEqual(
    createHash('sha256').update(JSON.stringify(NARROW_REFERRAL_ASSURANCE_SCHEMA)).digest('hex'),
    REFERRAL_EXTRACTION_SCHEMA_SHA256,
  );
});
