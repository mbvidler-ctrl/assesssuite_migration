import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const validator = path.join(repoRoot, 'scripts', 'validate-production-deploy-workflow.mjs');

const GOVERNED_WORKFLOWS = [
  { file: 'production-deploy.yml', mutations: 119 },
  { file: 'production-prepare-release.yml', mutations: 40 },
  { file: 'production-prepare-rollback-image.yml', mutations: 52 },
  { file: 'production-rollback.yml', mutations: 73 },
  { file: 'production-parity-assurance.yml', mutations: 70 },
];

function workflowPath(file) {
  return path.join(repoRoot, '.github', 'workflows', file);
}

function run(file, ...args) {
  return spawnSync(process.execPath, [validator, workflowPath(file), ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function validatorSelfSha() {
  return createHash('sha256')
    .update(fs.readFileSync(validator, 'utf8').replaceAll('\r\n', '\n'))
    .digest('hex');
}

test('V01 --print-self-sha matches an independently computed hash of the validator file', () => {
  const printed = spawnSync(process.execPath, [validator, '--print-self-sha'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.equal(printed.status, 0, printed.stdout + printed.stderr);
  assert.equal(printed.stdout.trim(), validatorSelfSha());
});

for (const { file, mutations } of GOVERNED_WORKFLOWS) {
  test(`V02 ${file} satisfies the trusted release-workflow contract`, () => {
    const result = run(file);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /workflow contract passed/);
  });

  test(`V03 ${file} rejects every adversarial mutation (${mutations}/${mutations})`, () => {
    const result = run(file, '--selftest');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(
      result.stdout,
      new RegExp(`mutation selftest passed \\(${mutations}/${mutations} rejected\\)`),
    );
  });

  test(`V04 ${file} pins EXPECTED_TRUSTED_VALIDATOR_SHA256 equal to the validator's actual hash`, () => {
    const text = fs.readFileSync(workflowPath(file), 'utf8');
    assert.match(
      text,
      new RegExp(`EXPECTED_TRUSTED_VALIDATOR_SHA256:\\s*${validatorSelfSha()}\\b`),
    );
  });
}

test('V05 the release and rollback-image prepare lanes diff against the same production baseline', () => {
  const releaseText = fs.readFileSync(workflowPath('production-prepare-release.yml'), 'utf8');
  const rollbackText = fs.readFileSync(workflowPath('production-prepare-rollback-image.yml'), 'utf8');
  const extractShas = (text) =>
    [...text.matchAll(/PRODUCTION_BASE_SHA:\s*([0-9a-f]{40})/g)].map((match) => match[1]);
  const releaseShas = new Set(extractShas(releaseText));
  const rollbackShas = new Set(extractShas(rollbackText));
  assert.equal(releaseShas.size, 1, 'release workflow should pin exactly one PRODUCTION_BASE_SHA value');
  assert.equal(
    rollbackShas.size,
    1,
    'rollback-image workflow should pin exactly one PRODUCTION_BASE_SHA value',
  );
  assert.deepEqual(
    [...rollbackShas],
    [...releaseShas],
    'rollback-image lane must diff against the same production baseline as the release lane, not a stale one',
  );
});

test('V06 every Fly process guard enforces the same semantic TOML contract', () => {
  const python = [
    { command: 'python3', prefix: [] },
    { command: 'python', prefix: [] },
    { command: 'py', prefix: ['-3'] },
  ].find(({ command, prefix }) =>
    spawnSync(command, [...prefix, '--version'], { encoding: 'utf8' }).status === 0);
  assert.ok(python, 'Python 3 is required to exercise the tomllib process guard');

  const programs = GOVERNED_WORKFLOWS.flatMap(({ file }) => {
    const text = fs.readFileSync(workflowPath(file), 'utf8').replaceAll('\r\n', '\n');
    return [...text.matchAll(/^ {10,12}python3 -I - [^\n]+ <<'PY'\n([\s\S]*?)^ {10}PY$/gm)]
      .map((match) => match[1]
        .split('\n')
        .map((line) => line.startsWith('          ') ? line.slice(10) : line)
        .join('\n'));
  });
  assert.equal(programs.length, 6, 'all six governed process-guard sites must be executable');
  assert.equal(new Set(programs).size, 1, 'all six sites must use the same parser contract');
  const [program] = programs;

  const allowed = [
    ['table.toml', '[http_service]\nprocesses = ["app"]\n'],
    ['dotted.toml', 'http_service.processes = ["app"]\n'],
    ['escaped.toml', '[http_service]\n"pro\\u0063esses" = ["app"]\n'],
  ];
  const forbidden = [
    ['process-table.toml', '[http_service]\nprocesses = ["app"]\n[processes]\napp = "node server/index.mjs"\n'],
    ['inline-processes.toml', 'processes = { app = "node server/index.mjs" }\n[http_service]\nprocesses = ["app"]\n'],
    ['dotted-processes.toml', 'processes.app = "node server/index.mjs"\n[http_service]\nprocesses = ["app"]\n'],
    ['escaped-processes.toml', '"pro\\u0063esses".app = "node server/index.mjs"\n[http_service]\nprocesses = ["app"]\n'],
    ['process-array.toml', '[[processes]]\napp = "node server/index.mjs"\n[http_service]\nprocesses = ["app"]\n'],
    ['nested-processes.toml', '[http_service]\nprocesses = ["app"]\n[other]\nprocesses = ["app"]\n'],
    ['array-nested-processes.toml', '[http_service]\nprocesses = ["app"]\n[[services]]\nprocesses = ["app"]\n'],
    ['missing-selector.toml', '[http_service]\nforce_https = true\n'],
    ['wrong-selector.toml', '[http_service]\nprocesses = ["worker"]\n'],
    ['multiple-selector-values.toml', '[http_service]\nprocesses = ["app", "worker"]\n'],
    ['scalar-selector.toml', '[http_service]\nprocesses = "app"\n'],
    ['invalid.toml', '[http_service\nprocesses = ["app"]\n'],
  ];

  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-fly-process-contract-'));
  try {
    const writeFixtures = (fixtures) => fixtures.map(([name, value]) => {
      const target = path.join(fixtureDir, name);
      fs.writeFileSync(target, value, 'utf8');
      return target;
    });
    const allowedPaths = writeFixtures(allowed);
    const forbiddenPaths = writeFixtures(forbidden);
    const allowedResult = spawnSync(
      python.command,
      [...python.prefix, '-I', '-', ...allowedPaths],
      {
      input: program,
      encoding: 'utf8',
      },
    );
    assert.equal(allowedResult.status, 0, allowedResult.stdout + allowedResult.stderr);
    for (const target of forbiddenPaths) {
      const result = spawnSync(python.command, [...python.prefix, '-I', '-', target], {
        input: program,
        encoding: 'utf8',
      });
      assert.notEqual(result.status, 0, `${path.basename(target)} unexpectedly passed`);
    }
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('V07 every live release reader selects a safe completed release and binds the sole Machine image', () => {
  const releaseReaderFiles = [
    'production-deploy.yml',
    'production-prepare-rollback-image.yml',
    'production-rollback.yml',
  ];
  const programs = releaseReaderFiles.flatMap((file) => {
    const text = fs.readFileSync(workflowPath(file), 'utf8').replaceAll('\r\n', '\n');
    return [...text.matchAll(
      /env -u FLY_API_TOKEN node --input-type=module - "\$releases_json" "\$machine_json" <<'NODE'\n([\s\S]*?)^ {10}NODE$/gm,
    )].map((match) => match[1]
      .split('\n')
      .map((line) => line.startsWith('          ') ? line.slice(10) : line)
      .join('\n'));
  });
  assert.equal(programs.length, 3, 'all three live release readers must be executable');

  const machineId = '0123456789abcdef';
  const digest = `sha256:${'a'.repeat(64)}`;
  const immutableImage = `registry.fly.io/assesssuite-production@${digest}`;
  const release = (version, status, extra = {}) => ({
    Version: version,
    Status: status,
    ImageRef: immutableImage,
    ...extra,
  });
  const machine = {
    id: machineId,
    state: 'started',
    image_ref: {
      registry: 'registry.fly.io',
      repository: 'assesssuite-production',
      digest,
    },
    config: { image: immutableImage },
  };
  const accepted = [
    {
      label: 'unordered completed rows',
      releases: [release(16, 'complete'), release(17, 'succeeded')],
      expected: `v17\t${immutableImage}`,
    },
    {
      label: 'higher terminal failed and cancelled rows',
      releases: [
        release(19, 'cancelled'),
        release(17, 'completed'),
        release(18, 'failed'),
      ],
      expected: `v17\t${immutableImage}`,
    },
  ];
  const rejected = [
    {
      label: 'duplicate numeric version',
      releases: [release('v17', 'complete'), release(17, 'complete')],
      machines: [machine],
    },
    {
      label: 'nonnumeric version',
      releases: [release('candidate', 'complete')],
      machines: [machine],
    },
    {
      label: 'higher in-progress release',
      releases: [release(17, 'complete'), release(18, 'pending', { InProgress: true })],
      machines: [machine],
    },
    {
      label: 'higher unknown nonterminal release',
      releases: [release(17, 'complete'), release(18, 'pending')],
      machines: [machine],
    },
    {
      label: 'nonboolean InProgress state',
      releases: [release(17, 'complete', { InProgress: 'false' })],
      machines: [machine],
    },
    {
      label: 'completed release still marked in progress',
      releases: [release(17, 'complete', { InProgress: true })],
      machines: [machine],
    },
    {
      label: 'non-sole Machine inventory',
      releases: [release(17, 'complete')],
      machines: [machine, machine],
    },
    {
      label: 'wrong Machine identity',
      releases: [release(17, 'complete')],
      machines: [{ ...machine, id: 'fedcba9876543210' }],
    },
    {
      label: 'Machine not started',
      releases: [release(17, 'complete')],
      machines: [{ ...machine, state: 'stopped' }],
    },
    {
      label: 'Machine config image drift',
      releases: [release(17, 'complete')],
      machines: [{ ...machine, config: { image: 'registry.fly.io/assesssuite-production:latest' } }],
    },
    {
      label: 'release image drift',
      releases: [{ ...release(17, 'complete'), ImageRef: `registry.fly.io/assesssuite-production@sha256:${'b'.repeat(64)}` }],
      machines: [machine],
    },
    {
      label: 'Machine repository drift',
      releases: [release(17, 'complete')],
      machines: [{
        ...machine,
        image_ref: { ...machine.image_ref, repository: 'different-app' },
      }],
    },
  ];

  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-release-reader-'));
  const releasesPath = path.join(fixtureDir, 'releases.json');
  const machinesPath = path.join(fixtureDir, 'machines.json');
  const execute = (program, releases, machines) => {
    fs.writeFileSync(releasesPath, `${JSON.stringify(releases)}\n`, 'utf8');
    fs.writeFileSync(machinesPath, `${JSON.stringify(machines)}\n`, 'utf8');
    return spawnSync(
      process.execPath,
      ['--input-type=module', '-', releasesPath, machinesPath],
      {
        input: program,
        encoding: 'utf8',
        env: { ...process.env, EXPECTED_MACHINE_ID: machineId },
      },
    );
  };
  try {
    for (const [programIndex, program] of programs.entries()) {
      for (const fixture of accepted) {
        const result = execute(program, fixture.releases, [machine]);
        assert.equal(
          result.status,
          0,
          `reader ${programIndex + 1} rejected ${fixture.label}: ${result.stderr}`,
        );
        assert.equal(result.stdout, fixture.expected);
      }
      for (const fixture of rejected) {
        const result = execute(program, fixture.releases, fixture.machines);
        assert.notEqual(
          result.status,
          0,
          `reader ${programIndex + 1} unexpectedly accepted ${fixture.label}`,
        );
      }
    }
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('V08 parity inventory binds the latest safe release to the exact started production Machine', () => {
  const text = fs.readFileSync(
    workflowPath('production-parity-assurance.yml'),
    'utf8',
  ).replaceAll('\r\n', '\n');
  const program = [...text.matchAll(/<<'NODE'\n([\s\S]*?)^ {10}NODE$/gm)]
    .map((match) => match[1]
      .split('\n')
      .map((line) => line.startsWith('          ') ? line.slice(10) : line)
      .join('\n'))
    .find((body) => body.includes('const parsedReleases = releases.map((row) => {'));
  assert.ok(program, 'parity inventory release/Machine program is executable');

  const machineId = '0123456789abcdef';
  const volumeId = 'vol_production123';
  const digest = `sha256:${'c'.repeat(64)}`;
  const immutableImage = `registry.fly.io/assesssuite-production@${digest}`;
  const release = (version, status, extra = {}) => ({
    Version: version,
    Status: status,
    ImageRef: immutableImage,
    ...extra,
  });
  const machine = {
    id: machineId,
    state: 'started',
    region: 'syd',
    image_ref: {
      registry: 'registry.fly.io',
      repository: 'assesssuite-production',
      digest,
    },
    config: {
      image: immutableImage,
      mounts: [{ volume: volumeId, path: '/app/server/data' }],
    },
  };
  const volume = {
    id: volumeId,
    state: 'created',
    name: 'assesssuite_data',
    region: 'syd',
    size_gb: 3,
    encrypted: true,
    attached_machine_id: machineId,
  };
  const accepted = [
    [release(16, 'complete'), release(17, 'succeeded')],
    [release(19, 'cancelled'), release(17, 'complete'), release(18, 'failed')],
  ];
  const rejected = [
    {
      label: 'all releases failed',
      releases: [release(17, 'failed')],
      machines: [machine],
    },
    {
      label: 'duplicate release version',
      releases: [release('v17', 'complete'), release(17, 'complete')],
      machines: [machine],
    },
    {
      label: 'higher unknown release',
      releases: [release(17, 'complete'), release(18, 'pending')],
      machines: [machine],
    },
    {
      label: 'completed release marked in progress',
      releases: [release(17, 'complete', { InProgress: true })],
      machines: [machine],
    },
    {
      label: 'production Machine stopped',
      releases: [release(17, 'complete')],
      machines: [{ ...machine, state: 'stopped' }],
    },
    {
      label: 'production Machine config image drift',
      releases: [release(17, 'complete')],
      machines: [{ ...machine, config: { ...machine.config, image: 'registry.fly.io/assesssuite-production:latest' } }],
    },
    {
      label: 'production Machine image_ref drift',
      releases: [release(17, 'complete')],
      machines: [{ ...machine, image_ref: { ...machine.image_ref, repository: 'different-app' } }],
    },
  ];

  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-parity-inventory-'));
  const label = 'fixture';
  const write = (suffix, value) => fs.writeFileSync(
    path.join(fixtureDir, `${label}-${suffix}.json`),
    `${JSON.stringify(value)}\n`,
    'utf8',
  );
  const execute = (releases, machines) => {
    write('releases', releases);
    write('machines', machines);
    write('volumes', [volume]);
    return spawnSync(process.execPath, ['--input-type=module', '-'], {
      input: program,
      encoding: 'utf8',
      env: {
        ...process.env,
        RUNNER_TEMP: fixtureDir,
        LABEL: label,
        PHASE: 'clean',
        CURRENT_MACHINE_ID: 'NOT-CREATED',
        CURRENT_VOLUME_ID: 'NOT-CREATED',
        CURRENT_PRIVATE_IPV6: 'NOT-CREATED',
        PARITY_MACHINE_NAME: 'parity-fixture',
        PARITY_VOLUME_NAME: 'parity-fixture-data',
        EXPECTED_PRODUCTION_MACHINE_ID: machineId,
        EXPECTED_PRODUCTION_VOLUME_ID: volumeId,
        EXPECTED_LIVE_RELEASE: 'v17',
        LIVE_IMAGE: immutableImage,
      },
    });
  };
  try {
    for (const releases of accepted) {
      const result = execute(releases, [machine]);
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
    for (const fixture of rejected) {
      const result = execute(fixture.releases, fixture.machines);
      assert.notEqual(result.status, 0, `parity inventory unexpectedly accepted ${fixture.label}`);
    }
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});
