// Deliberately NOT a default test. This harness may incur provider processing
// and may transmit only the in-memory synthetic fixtures generated here. It
// imports the production adapter directly: no server, SQLite database, upload
// registry, mounted volume, or local file is opened or written by the probe.

import { createHash } from 'node:crypto';

import {
  DOCUMENT_EXTRACTION_PROVIDER_PROBE_ACK,
  assertProviderRequestPolicy,
  buildResponsesRequest,
  extractDocumentData,
  prepareExtractionSchema,
} from '../../server/documentExtraction.mjs';
import { REFERRAL_SCHEMA, pdfFixture, pngFixture } from './support/synthetic-fixtures.mjs';

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

function providerPolicyMetadata() {
  const bytes = pdfFixture();
  const prepared = prepareExtractionSchema(REFERRAL_SCHEMA);
  const payload = buildResponsesRequest({
    files: [adapterFile(bytes, 'application/pdf', 'synthetic-policy-check.pdf')],
    sourceSchema: prepared.sourceSchema,
    providerSchema: prepared.providerSchema,
    model: 'synthetic-policy-check',
  });
  const metadata = assertProviderRequestPolicy(payload);
  return {
    store_false: metadata.store,
    background_false: metadata.background,
    tools_absent: metadata.tools,
    inline_only: metadata.inline,
    conversation_state_absent: !metadata.has_conversation_state,
  };
}

function groundedAndConformant(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return false;
  if (typeof output.full_name !== 'string' || output.full_name.toLowerCase() !== 'alex river') return false;
  if (output.date_of_birth !== '1990-01-02') return false;
  if (!Array.isArray(output.diagnoses)) return false;
  const diagnoses = output.diagnoses.map((value) => String(value).toLowerCase());
  if (!diagnoses.some((value) => value.includes('ankle sprain'))) return false;
  if (!diagnoses.some((value) => value.includes('asthma'))) return false;
  if (typeof output.referrer !== 'string' || !output.referrer.toLowerCase().includes('synthetic')) return false;
  if (!(output.phone === null || output.phone === undefined || output.phone === '')) return false;
  return !/mock|placeholder|example patient|unknown patient/i.test(JSON.stringify(output));
}

async function probeFixture({ fixture, bytes, detectedMime, storedName }) {
  try {
    const result = await extractDocumentData({
      files: [adapterFile(bytes, detectedMime, storedName)],
      schema: REFERRAL_SCHEMA,
      subjectAgeBands: ['13_or_over'],
    });
    const policy = result?.requestPolicy;
    const policyPass = policy?.store === true && policy?.background === true &&
      policy?.tools === true && policy?.inline === true && policy?.has_conversation_state === false;
    const grounded = groundedAndConformant(result?.output);
    return {
      fixture,
      result: policyPass && grounded ? 'PASS' : 'FAIL',
      adapter_completed: Boolean(result?.output),
      grounded_schema_conformant: Boolean(grounded),
      store_false: policy?.store === true,
      no_tools: policy?.tools === true,
      background_false: policy?.background === true,
      inline_only: policy?.inline === true,
    };
  } catch (error) {
    return { fixture, result: 'FAIL', adapter_completed: false, error_class: error?.name || 'Error' };
  }
}

async function main() {
  if (!gateProviderProbe()) return;
  const policy = providerPolicyMetadata();
  if (!Object.values(policy).every(Boolean)) {
    emit({ probe: 'provider-request-policy', result: 'FAIL', ...policy });
    process.exitCode = 1;
    return;
  }
  emit({ probe: 'provider-request-policy', result: 'PASS', ...policy });

  // The exact opt-in makes SELFTEST select the hardcoded production Responses
  // endpoint rather than a fake endpoint. These assignments do not carry any
  // database meaning because no server/database module is imported.
  process.env.SELFTEST = '1';
  process.env.DOCUMENT_EXTRACTION_PROVIDER_PROBE = '1';
  process.env.DOCUMENT_EXTRACTION_PROVIDER_PROBE_ACK = DOCUMENT_EXTRACTION_PROVIDER_PROBE_ACK;

  const results = [
    await probeFixture({
      fixture: 'synthetic-pdf',
      bytes: pdfFixture(),
      detectedMime: 'application/pdf',
      storedName: 'synthetic-provider-probe.pdf',
    }),
    await probeFixture({
      fixture: 'synthetic-image',
      bytes: pngFixture(),
      detectedMime: 'image/png',
      storedName: 'synthetic-provider-probe.png',
    }),
  ];
  results.forEach(emit);
  const passed = results.every((result) => result.result === 'PASS');
  emit({
    probe: 'provider-probe-summary',
    result: passed ? 'PASS' : 'FAIL',
    passed: results.filter((result) => result.result === 'PASS').length,
    total: results.length,
    database_writes: 0,
    filesystem_writes: 0,
  });
  if (!passed) process.exitCode = 1;
}

await main();
