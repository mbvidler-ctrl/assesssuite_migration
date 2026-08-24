import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wrapperRelativePath = 'scripts/run-physio-live-self-service.mjs';
const playwrightConfigRelativePath = 'e2e/physio-live-self-service/playwright.config.mjs';
const resumeCleanupRelativePath = 'e2e/physio-live-self-service/resume-cleanup.mjs';
const validatePaymentRelativePath = 'e2e/physio-live-self-service/validate-payment.mjs';

const actions = Object.freeze({
  provision: Object.freeze({ phase: 'provision', runner: 'playwright' }),
  validate_payment: Object.freeze({
    phase: 'validate-payment',
    runner: 'node',
    entry: validatePaymentRelativePath,
  }),
  finalize: Object.freeze({ phase: 'finalize', runner: 'playwright' }),
  resume_cleanup: Object.freeze({
    phase: 'resume-cleanup',
    runner: 'node',
    entry: resumeCleanupRelativePath,
  }),
});

const expectedPackageScripts = Object.freeze({
  'test:physio-live-self-service': `node ${wrapperRelativePath} check`,
  'test:physio-live-self-service:provision': `node ${wrapperRelativePath} provision`,
  'test:physio-live-self-service:validate_payment': `node ${wrapperRelativePath} validate_payment`,
  'test:physio-live-self-service:finalize': `node ${wrapperRelativePath} finalize`,
  'test:physio-live-self-service:resume_cleanup': `node ${wrapperRelativePath} resume_cleanup`,
  'check:physio-live-self-service-commands': `node ${wrapperRelativePath} check`,
});

function exactRegularFile(relativePath) {
  const filename = path.join(repoRoot, relativePath);
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new TypeError(`${relativePath} must be a checked-out regular file`);
  }
  return filename;
}

function assertStaticCommandWiring() {
  const packageJson = JSON.parse(fs.readFileSync(exactRegularFile('package.json'), 'utf8'));
  for (const [name, command] of Object.entries(expectedPackageScripts)) {
    if (packageJson.scripts?.[name] !== command) {
      throw new TypeError(`package.json script ${name} differs from the frozen command`);
    }
  }

  const config = fs.readFileSync(exactRegularFile(playwrightConfigRelativePath), 'utf8');
  const contract = fs.readFileSync(
    exactRegularFile('e2e/physio-live-self-service/self-service-contract.mjs'),
    'utf8',
  );
  const resume = fs.readFileSync(exactRegularFile(resumeCleanupRelativePath), 'utf8');
  for (const marker of [
    "live.phase === 'provision' ? 'provision.spec.mjs' : 'finalize.spec.mjs'",
    "!['provision', 'finalize'].includes(live.phase)",
  ]) {
    if (!config.includes(marker)) throw new TypeError(`Playwright phase dispatch omitted ${marker}`);
  }
  for (const marker of [
    "'PHYSIO_SELF_SERVICE_FLY_HOST_QA_RECEIPT_SHA256'",
    "'PHYSIO_SELF_SERVICE_RESTART_RECEIPT_SHA256'",
    "'PHYSIO_SELF_SERVICE_CUSTOM_HOST_QA_RECEIPT_SHA256'",
    "'PHYSIO_SELF_SERVICE_DNS_TLS_RECEIPT_SHA256'",
    "if (phase === 'finalize')",
    'fly_host_qa_receipt_sha256: configuration.flyHostQaReceiptSha256',
    'restart_receipt_sha256: configuration.restartReceiptSha256',
    'custom_host_qa_receipt_sha256: configuration.customHostQaReceiptSha256',
    'dns_tls_receipt_sha256: configuration.dnsTlsReceiptSha256',
  ]) {
    if (!contract.includes(marker)) {
      throw new TypeError(`Self-service finalization binding omitted ${marker}`);
    }
  }
  if (!resume.includes("resolveSelfServiceConfiguration(process.env, 'resume-cleanup')")) {
    throw new TypeError('Cleanup-only resume does not resolve the exact resume-cleanup phase');
  }

  return Object.freeze({
    result: 'PASS',
    provider_effects_executed: false,
    commands: Object.keys(actions),
  });
}

function execute(action) {
  const descriptor = actions[action];
  if (!descriptor) {
    throw new TypeError(
      'Expected one action: provision, validate_payment, finalize, resume_cleanup or check',
    );
  }
  if (process.env.PHYSIO_SELF_SERVICE_EXTERNAL_EFFECTS_AUTHORIZED !== '1') {
    throw new TypeError('An exact authorised external-effect lane is required before execution');
  }
  const suppliedPhase = String(process.env.PHYSIO_SELF_SERVICE_PHASE || '').trim();
  if (suppliedPhase && suppliedPhase !== descriptor.phase) {
    throw new TypeError(`PHYSIO_SELF_SERVICE_PHASE must equal ${descriptor.phase} for ${action}`);
  }
  const environment = {
    ...process.env,
    PHYSIO_SELF_SERVICE_PHASE: descriptor.phase,
  };
  const command = descriptor.runner === 'playwright'
    ? [
        process.execPath,
        [
          exactRegularFile('node_modules/@playwright/test/cli.js'),
          'test',
          '--config',
          playwrightConfigRelativePath,
        ],
      ]
    : [process.execPath, [exactRegularFile(descriptor.entry)]];
  const result = spawnSync(command[0], command[1], {
    cwd: repoRoot,
    env: environment,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`${action} terminated by ${result.signal}`);
  process.exitCode = result.status ?? 1;
}

const [action, ...unexpected] = process.argv.slice(2);
if (unexpected.length > 0) throw new TypeError('Self-service commands do not accept unbound arguments');
if (action === 'check') {
  process.stdout.write(`${JSON.stringify(assertStaticCommandWiring())}\n`);
} else {
  execute(action);
}
