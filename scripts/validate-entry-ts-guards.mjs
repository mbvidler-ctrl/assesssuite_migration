// Dry-run validation for role guards added to base44/functions/*/entry.ts
// (the pristine captured Deno source, distinct from the shim's ported
// server/functions/*.mjs). Rewrites the SDK import to a local mock,
// transpile-checks the result for syntax errors, then executes each
// captured Deno.serve handler directly against the mock with no network
// calls and no contact with the live Base44 platform.
//
// Run: node scripts/validate-entry-ts-guards.mjs
//
// Used first for ASX-SEC-20260703-01 (admin-only guards on
// auditAssessmentIssues, createTestClientWithAssessments,
// verifyTestAssessmentData, getMissingTestRunners); reusable for any
// future patch to these files by adding a FIXTURES entry.

import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';

const REPO = path.resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:'), '..');
const MOCK_SDK_PATH = `file:///${path.join(REPO, 'scripts', '_mock-base44-sdk.mjs').replace(/\\/g, '/')}`;

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name} — ${detail}`);
}

const FIXTURES = {
  auditAssessmentIssues: {
    Client: { filter: [{ id: 'client-1', full_name: 'Test Client - Automated' }] },
    ClientAssessment: {
      filter: [{ id: 'ca-1', assessment_id: 'assess-1', additional_data: { x: 1 }, result_value: 10 }],
    },
    Assessment: { list: [{ id: 'assess-1', name: 'Modified Ashworth Scale', is_questionnaire: false, is_deleted: false, questions: [] }] },
  },
  createTestClientWithAssessments: {
    OrganizationMember: { filter: [{ id: 'om-1', org_id: 'org-1', user_email: 'test@example.com' }] },
    Client: { create: (data) => ({ id: 'client-new', full_name: data.full_name }) },
    Assessment: { list: [{ id: 'assess-1', name: 'Modified Ashworth Scale', unit_of_measure: 'Grade (0-4+)', is_deleted: false, is_questionnaire: false, questions: [] }] },
    Appointment: { create: (data) => ({ id: 'appt-1', ...data }) },
    SOAPNote: {
      create: (data) => ({ id: 'soap-1', objective: data.objective }),
      update: (id, data) => ({ id, ...data }),
    },
    ClientAssessment: { create: (data) => ({ id: 'ca-new', ...data }) },
  },
  verifyTestAssessmentData: {
    Client: { filter: [{ id: 'client-1', full_name: 'Test Client - Automated' }] },
    ClientAssessment: { filter: [{ id: 'ca-1', assessment_id: 'assess-1', result_value: 10, additional_data: { x: 1 }, notes: 'n', appointment_id: 'appt-1' }] },
    SOAPNote: { filter: [{ id: 'soap-1', objective: 'Automated Assessment Session\n', status: 'draft' }] },
    Assessment: { list: [{ id: 'assess-1', name: 'Modified Ashworth Scale' }] },
  },
  getMissingTestRunners: {
    Assessment: { list: [{ id: 'assess-1', name: 'Some Unrecognised Assessment', is_deleted: false, is_questionnaire: false, questions: [] }] },
  },
};

async function loadHandler(functionName, scratchDir) {
  const srcPath = path.join(REPO, 'base44', 'functions', functionName, 'entry.ts');
  const source = await readFile(srcPath, 'utf8');

  if (!/from 'npm:@base44\/sdk@[^']+'/.test(source)) {
    throw new Error(`${functionName}: could not find the expected SDK import line to replace`);
  }
  const rewritten = source.replace(/from 'npm:@base44\/sdk@[^']+'/, `from '${MOCK_SDK_PATH}'`);

  const transpiled = ts.transpileModule(rewritten, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  if (transpiled.diagnostics && transpiled.diagnostics.length > 0) {
    const messages = transpiled.diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    throw new Error(`${functionName}: syntax diagnostics: ${messages.join('; ')}`);
  }

  const scratchFile = path.join(scratchDir, `entry-${functionName}.mjs`);
  await writeFile(scratchFile, transpiled.outputText, 'utf8');

  let capturedHandler = null;
  globalThis.Deno = { serve: (handler) => { capturedHandler = handler; } };
  globalThis.Response = { json: (body, init) => ({ __isMockResponse: true, status: init?.status ?? 200, body }) };

  await import(`file:///${scratchFile.replace(/\\/g, '/')}`);

  if (typeof capturedHandler !== 'function') {
    throw new Error(`${functionName}: Deno.serve was not called with a handler function`);
  }
  return capturedHandler;
}

async function invoke(handler, role, fixtures) {
  globalThis.__mock = { role, email: 'test@example.com', fixtures };
  const fakeReq = { headers: { get: () => null }, json: async () => ({}) };
  try {
    return await handler(fakeReq);
  } catch (err) {
    return { __threw: true, error: err.message };
  }
}

async function main() {
  console.log('Dry-run validation of base44/functions/*/entry.ts role guards\n');
  const scratchDir = await mkdtemp(path.join(tmpdir(), 'entry-ts-validate-'));

  for (const functionName of Object.keys(FIXTURES)) {
    let handler;
    try {
      handler = await loadHandler(functionName, scratchDir);
    } catch (err) {
      record(`${functionName}: load/syntax`, false, err.message);
      continue;
    }
    record(`${functionName}: syntax + module load`, true, 'transpiled clean, Deno.serve handler captured');

    const nonAdmin = await invoke(handler, 'user', FIXTURES[functionName]);
    record(
      `${functionName}: non-admin caller`,
      !nonAdmin.__threw && nonAdmin.status === 403,
      `status=${nonAdmin.status} body=${JSON.stringify(nonAdmin.body)}`,
    );

    const admin = await invoke(handler, 'admin', FIXTURES[functionName]);
    record(
      `${functionName}: admin caller`,
      !admin.__threw && admin.status !== 403,
      `status=${admin.status}`,
    );

    const anonymous = await invoke(handler, null, FIXTURES[functionName]);
    record(
      `${functionName}: unauthenticated caller`,
      !anonymous.__threw && anonymous.status !== 200,
      `status=${anonymous.status}`,
    );
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\nValidation complete: ${pass}/${results.length} passed.`);
  if (pass !== results.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Harness error:', err);
  process.exitCode = 1;
});
