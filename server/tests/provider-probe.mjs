// Deliberately NOT a default test. This harness may incur provider processing
// and may transmit only the in-memory synthetic fixtures generated here. It
// imports the production adapter directly: no server, SQLite database, upload
// registry, mounted volume, or local file is opened or written by the probe.

import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DOCUMENT_EXTRACTION_PROVIDER_PROBE_ACK,
  assertProviderRequestPolicy,
  buildResponsesRequest,
  extractDocumentData,
  prepareExtractionSchema,
} from '../../server/documentExtraction.mjs';
import {
  REFERRAL_EXTRACTION_SCHEMA,
  REFERRAL_EXTRACTION_SCHEMA_PROPERTY_COUNT,
  REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS,
  REFERRAL_EXTRACTION_SCHEMA_SHA256,
} from '../../src/lib/referralExtractionSchema.js';
import {
  CANONICAL_REFERRAL_PROFILE_FULL_39,
  CANONICAL_REFERRAL_PROFILE_MULTI_FORWARD,
  CANONICAL_REFERRAL_PROFILE_MULTI_REVERSED,
  CANONICAL_REFERRAL_PROFILE_A,
  CANONICAL_REFERRAL_PROFILE_DOB_CHANGE,
  canonicalMultiFileCsvFixture,
  fullFieldReferralPdfFixture,
  pdfFixture,
} from './support/syntheticReferralFixtures.mjs';

const REQUIRED_ACKNOWLEDGEMENT = 'I_ACKNOWLEDGE_SYNTHETIC_OPENAI_DOCUMENT_PROBE';

function emit(metadata) {
  process.stdout.write(`${JSON.stringify(metadata)}\n`);
}

function gateProviderProbe() {
  const gates = {
    explicit_acknowledgement: process.env.RUN_DOCUMENT_EXTRACTION_PROVIDER_PROBE === REQUIRED_ACKNOWLEDGEMENT,
    paid_probe_gate: process.env.ALLOW_PAID_PROVIDER_PROBE === '1',
    extraction_enabled: process.env.DOCUMENT_EXTRACTION_ENABLED === '1',
    health_data_terms_confirmed: process.env.OPENAI_HEALTH_DATA_TERMS_CONFIRMED === '1',
    credential_present: typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0,
    fake_base_absent: !process.env.DOCUMENT_EXTRACTION_TEST_BASE_URL,
  };
  if (!Object.values(gates).every(Boolean)) {
    emit({ probe: 'provider-probe-gate', result: 'REFUSED', ...gates });
    process.exitCode = 2;
    return false;
  }
  return true;
}

function adapterFile(bytes, detectedMime, storedName) {
  return {
    upload: {
      byteSize: bytes.length,
      detectedMime,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      storedName,
    },
    buffer: bytes,
  };
}

export function providerPolicyAssurance() {
  const bytes = pdfFixture();
  const prepared = prepareExtractionSchema(REFERRAL_EXTRACTION_SCHEMA);
  const payload = buildResponsesRequest({
    files: [adapterFile(bytes, 'application/pdf', 'synthetic-policy-check.pdf')],
    sourceSchema: prepared.sourceSchema,
    providerSchema: prepared.providerSchema,
    model: 'synthetic-policy-check',
  });
  const metadata = assertProviderRequestPolicy(payload);
  const sourcePropertyCount = Object.keys(prepared.sourceSchema.properties).length;
  const schemaMetadata = {
    canonical_schema_hash: prepared.schemaHash,
    canonical_schema_property_count: sourcePropertyCount,
    canonical_schema_key_parity:
      JSON.stringify(Object.keys(prepared.providerSchema.properties)) ===
      JSON.stringify(REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS),
    provider_required_key_parity:
      JSON.stringify(prepared.providerSchema.required) ===
      JSON.stringify(REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS),
  };
  const schemaIntegrity = {
    hash: prepared.schemaHash === REFERRAL_EXTRACTION_SCHEMA_SHA256,
    keyCount: sourcePropertyCount === REFERRAL_EXTRACTION_SCHEMA_PROPERTY_COUNT,
    providerKeyParity: schemaMetadata.canonical_schema_key_parity,
    providerRequiredParity: schemaMetadata.provider_required_key_parity,
  };
  return {
    schemaIntegrity,
    schemaMetadata,
    metadata: {
      store_false: metadata.store,
      background_false: metadata.background,
      shortest_prompt_cache_retention: metadata.prompt_cache_retention,
      tools_absent: metadata.tools,
      inline_only: metadata.inline,
      conversation_state_absent: !metadata.has_conversation_state,
    },
  };
}

function normalized(value) {
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (Array.isArray(value)) return value.map(normalized);
  return value;
}

function groundedAndConformant(output, expectedProfile) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return false;
  if (
    JSON.stringify(Object.keys(output).sort()) !==
    JSON.stringify(Object.keys(expectedProfile).sort())
  ) return false;
  const valuesMatch = Object.keys(expectedProfile).every(
    (key) => JSON.stringify(normalized(output[key])) === JSON.stringify(normalized(expectedProfile[key])),
  );
  return valuesMatch && !/mock|placeholder|example patient|unknown patient/i.test(JSON.stringify(output));
}

async function probeFixture({ fixture, documents, expectedProfile }) {
  try {
    const result = await extractDocumentData({
      files: documents.map(({ bytes, detectedMime, storedName }) => adapterFile(bytes, detectedMime, storedName)),
      schema: REFERRAL_EXTRACTION_SCHEMA,
      subjectAgeBands: documents.map(() => '13_or_over'),
    });
    const policy = result?.requestPolicy;
    const policyPass = policy?.store === true && policy?.background === true &&
      policy?.prompt_cache_retention === true &&
      policy?.tools === true && policy?.inline === true && policy?.has_conversation_state === false;
    const grounded = groundedAndConformant(result?.output, expectedProfile);
    return {
      fixture,
      result: policyPass && grounded ? 'PASS' : 'FAIL',
      adapter_completed: Boolean(result?.output),
      grounded_schema_conformant: Boolean(grounded),
      store_false: policy?.store === true,
      no_tools: policy?.tools === true,
      background_false: policy?.background === true,
      shortest_prompt_cache_retention: policy?.prompt_cache_retention === true,
      inline_only: policy?.inline === true,
      output: result?.output,
      requestedFilenames: documents.map(({ storedName }) => storedName),
    };
  } catch (error) {
    return { fixture, result: 'FAIL', adapter_completed: false, error_class: error?.name || 'Error' };
  }
}

export function providerProbeDifferentialMetadata(first, second) {
  const resultsPassed = first?.result === 'PASS' && second?.result === 'PASS';
  const baselineDateMatch = first?.output?.date_of_birth === CANONICAL_REFERRAL_PROFILE_A.date_of_birth;
  const changedDateMatch = second?.output?.date_of_birth === CANONICAL_REFERRAL_PROFILE_DOB_CHANGE.date_of_birth;
  const sameRequestedFilename = Array.isArray(first?.requestedFilenames) &&
    JSON.stringify(first.requestedFilenames) === JSON.stringify(second?.requestedFilenames);
  const changedKeys = REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS.filter(
    (key) => JSON.stringify(normalized(first?.output?.[key])) !== JSON.stringify(normalized(second?.output?.[key])),
  );
  const stableGroundedFields = changedKeys.length === 1 && changedKeys[0] === 'date_of_birth';
  const passed = resultsPassed && baselineDateMatch && changedDateMatch &&
    sameRequestedFilename && stableGroundedFields;
  return {
    probe: 'provider-probe-differential-grounding',
    result: passed ? 'PASS' : 'FAIL',
    same_requested_filename: sameRequestedFilename,
    changed_source_field: 'date_of_birth',
    grounded_fields_stable: stableGroundedFields,
    compared_field_count: REFERRAL_EXTRACTION_SCHEMA_PROPERTY_COUNT,
    stable_field_count: REFERRAL_EXTRACTION_SCHEMA_PROPERTY_COUNT - changedKeys.length,
  };
}

export function providerProbeFullFieldMetadata(result) {
  const schemaOrder = JSON.stringify(Object.keys(result?.output || {})) ===
    JSON.stringify(REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS);
  const grounded = groundedAndConformant(result?.output, CANONICAL_REFERRAL_PROFILE_FULL_39);
  const passed = result?.result === 'PASS' && schemaOrder && grounded;
  return {
    probe: 'provider-probe-full-field-grounding',
    result: passed ? 'PASS' : 'FAIL',
    compared_field_count: REFERRAL_EXTRACTION_SCHEMA_PROPERTY_COUNT,
    all_fields_meaningful: Object.values(result?.output || {}).every((value) =>
      Array.isArray(value) ? value.length > 0 : typeof value === 'string' && Boolean(value.trim())),
    canonical_key_order: schemaOrder,
  };
}

export function providerProbeMultiFileMetadata(forward, reversed) {
  const forwardMatch = groundedAndConformant(forward?.output, CANONICAL_REFERRAL_PROFILE_MULTI_FORWARD);
  const reverseMatch = groundedAndConformant(reversed?.output, CANONICAL_REFERRAL_PROFILE_MULTI_REVERSED);
  const passed = forward?.result === 'PASS' && reversed?.result === 'PASS' && forwardMatch && reverseMatch;
  return {
    probe: 'provider-probe-multi-file-reconciliation',
    result: passed ? 'PASS' : 'FAIL',
    forward_primary_precedence: forwardMatch,
    reversed_primary_precedence: reverseMatch,
    fill_empty_observed: forward?.output?.email === CANONICAL_REFERRAL_PROFILE_MULTI_FORWARD.email,
    stable_array_union_observed:
      Array.isArray(forward?.output?.comorbidities) && forward.output.comorbidities.length === 2 &&
      Array.isArray(forward?.output?.medications) && forward.output.medications.length === 2,
  };
}

async function main() {
  if (!gateProviderProbe()) return;
  const policyAssurance = providerPolicyAssurance();
  const policy = policyAssurance.metadata;
  if (!Object.values(policy).every(Boolean) || !Object.values(policyAssurance.schemaIntegrity).every(Boolean)) {
    emit({
      probe: 'provider-request-policy',
      result: 'FAIL',
      ...policyAssurance.schemaMetadata,
      ...policy,
    });
    process.exitCode = 1;
    return;
  }
  emit({
    probe: 'provider-request-policy',
    result: 'PASS',
    ...policyAssurance.schemaMetadata,
    ...policy,
  });

  // The exact opt-in makes SELFTEST select the hardcoded production Responses
  // endpoint rather than a fake endpoint. These assignments do not carry any
  // database meaning because no server/database module is imported.
  process.env.SELFTEST = '1';
  process.env.DOCUMENT_EXTRACTION_PROVIDER_PROBE = '1';
  process.env.DOCUMENT_EXTRACTION_PROVIDER_PROBE_ACK = DOCUMENT_EXTRACTION_PROVIDER_PROBE_ACK;

  const results = [
    await probeFixture({
      fixture: 'synthetic-referral-baseline',
      documents: [{
        bytes: pdfFixture(),
        detectedMime: 'application/pdf',
        storedName: 'synthetic-differential-referral.pdf',
      }],
      expectedProfile: CANONICAL_REFERRAL_PROFILE_A,
    }),
    await probeFixture({
      fixture: 'synthetic-referral-dob-change',
      documents: [{
        bytes: pdfFixture({ dateOfBirth: '1991-03-04' }),
        detectedMime: 'application/pdf',
        storedName: 'synthetic-differential-referral.pdf',
      }],
      expectedProfile: CANONICAL_REFERRAL_PROFILE_DOB_CHANGE,
    }),
    await probeFixture({
      fixture: 'synthetic-referral-full-field',
      documents: [{
        bytes: fullFieldReferralPdfFixture(),
        detectedMime: 'application/pdf',
        storedName: 'synthetic-full-field-referral.pdf',
      }],
      expectedProfile: CANONICAL_REFERRAL_PROFILE_FULL_39,
    }),
    await probeFixture({
      fixture: 'synthetic-referral-multi-forward',
      documents: [
        {
          bytes: canonicalMultiFileCsvFixture('primary'),
          detectedMime: 'text/csv',
          storedName: 'synthetic-multi-primary.csv',
        },
        {
          bytes: canonicalMultiFileCsvFixture('additional'),
          detectedMime: 'text/csv',
          storedName: 'synthetic-multi-additional.csv',
        },
      ],
      expectedProfile: CANONICAL_REFERRAL_PROFILE_MULTI_FORWARD,
    }),
    await probeFixture({
      fixture: 'synthetic-referral-multi-reversed',
      documents: [
        {
          bytes: canonicalMultiFileCsvFixture('additional'),
          detectedMime: 'text/csv',
          storedName: 'synthetic-multi-additional.csv',
        },
        {
          bytes: canonicalMultiFileCsvFixture('primary'),
          detectedMime: 'text/csv',
          storedName: 'synthetic-multi-primary.csv',
        },
      ],
      expectedProfile: CANONICAL_REFERRAL_PROFILE_MULTI_REVERSED,
    }),
  ];
  results.forEach((result) => {
    const { output: _output, requestedFilenames: _requestedFilenames, ...contentFreeResult } = result;
    emit(contentFreeResult);
  });
  const differentialMetadata = providerProbeDifferentialMetadata(results[0], results[1]);
  const fullFieldMetadata = providerProbeFullFieldMetadata(results[2]);
  const multiFileMetadata = providerProbeMultiFileMetadata(results[3], results[4]);
  emit(differentialMetadata);
  emit(fullFieldMetadata);
  emit(multiFileMetadata);
  const passed = [differentialMetadata, fullFieldMetadata, multiFileMetadata].every(
    (metadata) => metadata.result === 'PASS',
  ) && results.every((result) => result.result === 'PASS');
  emit({
    probe: 'provider-probe-summary',
    result: passed ? 'PASS' : 'FAIL',
    passed: results.filter((result) => result.result === 'PASS').length,
    total: results.length,
    provider_requests: 7,
    database_writes: 0,
    filesystem_writes: 0,
    canonical_schema_hash: policyAssurance.schemaMetadata.canonical_schema_hash,
    canonical_schema_property_count: policyAssurance.schemaMetadata.canonical_schema_property_count,
  });
  if (!passed) process.exitCode = 1;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) await main();
