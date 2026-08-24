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
  { file: 'production-deploy.yml', mutations: 167, pinsValidator: true },
  { file: 'production-prepare-release.yml', mutations: 74, pinsValidator: true },
  { file: 'production-prepare-rollback-image.yml', mutations: 8, pinsValidator: false },
  { file: 'production-rollback.yml', mutations: 99, pinsValidator: true },
  { file: 'production-parity-assurance.yml', mutations: 86, pinsValidator: true },
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

for (const { file, mutations, pinsValidator } of GOVERNED_WORKFLOWS) {
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
    if (pinsValidator) {
      assert.match(text, new RegExp(`EXPECTED_TRUSTED_VALIDATOR_SHA256:\\s*${validatorSelfSha()}\\b`));
    } else {
      assert.doesNotMatch(text, /EXPECTED_TRUSTED_VALIDATOR_SHA256|uses:|\$\{\{ secrets\./);
      assert.match(text, /name: RETIRED - Production prepare rollback image/);
      assert.match(text, /exit 1/);
    }
  });
}

test('V05 the obsolete rollback-image preparation lane is an exact fail-closed tombstone', () => {
  const rollbackText = fs.readFileSync(workflowPath('production-prepare-rollback-image.yml'), 'utf8');
  assert.match(rollbackText, /^name: RETIRED - Production prepare rollback image$/m);
  assert.match(rollbackText, /Use production-prepare-release\.yml with the dispatch-frozen current production image/);
  assert.match(rollbackText, /exit 1/);
  assert.doesNotMatch(rollbackText, /FLY_API_TOKEN|fly deploy|docker |npm |node |uses:/);
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
  assert.equal(programs.length, 5, 'all five active governed process-guard sites must be executable');
  assert.equal(new Set(programs).size, 1, 'all five sites must use the same parser contract');
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
  assert.equal(programs.length, 2, 'both live release readers must be executable');

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
  const volumeId = 'vol_productionr12';
  const legacyVolumeId = 'vol_legacy123';
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
      mounts: [{
        volume: volumeId,
        name: 'assesssuite_data_r12',
        path: '/app/server/data',
        encrypted: true,
        size_gb: 3,
      }],
    },
  };
  const volume = {
    id: volumeId,
    state: 'created',
    name: 'assesssuite_data_r12',
    region: 'syd',
    size_gb: 3,
    encrypted: true,
    attached_machine_id: machineId,
    snapshot_retention: 5,
    auto_backup_enabled: true,
  };
  const legacyVolume = {
    id: legacyVolumeId,
    state: 'created',
    name: 'assesssuite_data',
    region: 'syd',
    size_gb: 3,
    encrypted: true,
    attached_machine_id: null,
    attached_alloc_id: null,
    snapshot_retention: 5,
    auto_backup_enabled: true,
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
    {
      label: 'legacy production Volume attached',
      releases: [release(17, 'complete')],
      machines: [machine],
      volumes: [volume, { ...legacyVolume, attached_machine_id: machineId }],
    },
    {
      label: 'legacy production Volume absent',
      releases: [release(17, 'complete')],
      machines: [machine],
      volumes: [volume],
    },
    {
      label: 'active production Volume policy drift',
      releases: [release(17, 'complete')],
      machines: [machine],
      volumes: [{ ...volume, auto_backup_enabled: false }, legacyVolume],
    },
    {
      label: 'parity selector aliases preserved legacy production Volume',
      releases: [release(17, 'complete')],
      machines: [machine],
      volumes: [volume, legacyVolume],
      currentVolumeId: legacyVolumeId,
    },
  ];

  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-parity-inventory-'));
  const label = 'fixture';
  const write = (suffix, value) => fs.writeFileSync(
    path.join(fixtureDir, `${label}-${suffix}.json`),
    `${JSON.stringify(value)}\n`,
    'utf8',
  );
  const execute = (
    releases,
    machines,
    volumes = [volume, legacyVolume],
    currentVolumeId = 'NOT-CREATED',
  ) => {
    write('releases', releases);
    write('machines', machines);
    write('volumes', volumes);
    return spawnSync(process.execPath, ['--input-type=module', '-'], {
      input: program,
      encoding: 'utf8',
      env: {
        ...process.env,
        RUNNER_TEMP: fixtureDir,
        LABEL: label,
        PHASE: 'clean',
        CURRENT_MACHINE_ID: 'NOT-CREATED',
        CURRENT_VOLUME_ID: currentVolumeId,
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
      const result = execute(
        fixture.releases,
        fixture.machines,
        fixture.volumes,
        fixture.currentVolumeId,
      );
      assert.notEqual(result.status, 0, `parity inventory unexpectedly accepted ${fixture.label}`);
    }
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('V09 previous-image rollback is dispatch-frozen, ancestrally bound, and verified before and after mutation', () => {
  const prepare = fs.readFileSync(workflowPath('production-prepare-release.yml'), 'utf8');
  const deploy = fs.readFileSync(workflowPath('production-deploy.yml'), 'utf8');
  const rollback = fs.readFileSync(workflowPath('production-rollback.yml'), 'utf8');

  assert.match(prepare, /ROLLBACK_SOURCE_SHA: \$\{\{ inputs\.rollback_source_sha \}\}/);
  assert.match(prepare, /git merge-base --is-ancestor "\$ROLLBACK_SOURCE_SHA" "\$APPLICATION_SHA"/);
  assert.match(prepare, /\[\[ "\$ROLLBACK_IMAGE" == "\$EXPECTED_CURRENT_IMAGE" \]\]/);
  assert.match(prepare, /assesssuite\.image-publication-receipt\.v2/);
  assert.match(prepare, /assesssuite\.exact-image-compatibility-receipt\.v2/);
  assert.match(prepare, /assesssuite\.deploy-bundle-manifest\.v2/);
  assert.equal((prepare.match(/rollback_source_sha: process\.env\.ROLLBACK_SOURCE_SHA/g) || []).length, 2);
  assert.match(prepare, /rollback_source_sha: e\.ROLLBACK_SOURCE_SHA/);
  assert.match(prepare, /expected_volume_id: process\.env\.EXPECTED_VOLUME_ID/);
  assert.match(prepare, /expected_legacy_volume_id: process\.env\.EXPECTED_LEGACY_VOLUME_ID/);
  assert.match(prepare, /expected_legacy_volume_id: e\.EXPECTED_LEGACY_VOLUME_ID/);
  assert.match(prepare, /npm run build:platform[\s\S]*?npm run build:landing[\s\S]*?npm run verify:split-build[\s\S]*?npm run test:split-hosting/);
  assert.match(prepare, /is_prohibited_release_filename\(\)/);
  assert.match(prepare, /if \[\[ "\$changed_file" == '\.env\.example' \]\]; then/);
  assert.match(prepare, /"\$normalized" =~ \(\^\|\/\)\\\.env\(\$\|\\\.\)/);
  assert.equal(
    (prepare.match(/PRODUCTION_BASE_SHA: 145958d895aef289b9652f850e32e237f2b62f70/g) || []).length,
    2,
    'release typecheck and content gates must use the exact current production base',
  );
  assert.equal(
    (prepare.match(/git merge-base --is-ancestor "\$PRODUCTION_BASE_SHA" HEAD/g) || []).length,
    2,
    'both production-base differential gates must prove that the exact live base is an ancestor',
  );
  assert.match(
    prepare,
    /git worktree add --detach "\$reference_dir" "\$PRODUCTION_BASE_SHA"/,
    'the reviewed typecheck fingerprint reference must stay bound to the exact production base',
  );
  assert.doesNotMatch(prepare, /eae2f229886b8aa2071864767ba61c0d6e4a548d/);

  assert.match(deploy, /merge_base_commit\?\.sha !== process\.env\.ROLLBACK_SOURCE_SHA/);
  assert.match(deploy, /EXPECTED_LEGACY_VOLUME_ID: \$\{\{ inputs\.expected_legacy_volume_id \}\}/);
  assert.match(deploy, /legacyVolume\.id !== process\.env\.EXPECTED_LEGACY_VOLUME_ID/);
  assert.match(deploy, /same\(manifest\.expected_legacy_volume_id, e\.EXPECTED_LEGACY_VOLUME_ID/);
  assert.doesNotMatch(deploy, /^      rollback_release_sha:$/m);
  assert.match(deploy, /read_version 'https:\/\/app\.assesssuite\.com' "\$ROLLBACK_SOURCE_SHA" "\$RUNNER_TEMP\/pre-mutation-app-version\.json"/);
  assert.match(deploy, /same\(manifest\.rollback_source_sha, e\.ROLLBACK_SOURCE_SHA/);
  assert.match(deploy, /same\(manifest\.rollback_image_ref, e\.EXPECTED_CURRENT_IMAGE/);
  assert.match(deploy, /Exercise Physiology at its Clinical Best\./);
  assert.match(deploy, /for route in legal\/privacy login; do/);
  assert.match(deploy, /assert_volume_snapshot_policy postrollback/);

  assert.match(rollback, /ref: \$\{\{ inputs\.trusted_workflow_sha \}\}/);
  assert.match(rollback, /git -C "\$source_dir" merge-base --is-ancestor "\$ROLLBACK_SOURCE_SHA" "\$FAILED_APPLICATION_SHA"/);
  assert.match(rollback, /read_version 'https:\/\/app\.assesssuite\.com' "\$FAILED_APPLICATION_SHA" "\$RUNNER_TEMP\/pre-mutation-app-version\.json"/);
  assert.match(rollback, /assert_topology postrollback/);
  assert.match(rollback, /EXPECTED_LEGACY_VOLUME_ID: \$\{\{ inputs\.expected_legacy_volume_id \}\}/);
  assert.match(rollback, /legacyVolume\.id !== process\.env\.EXPECTED_LEGACY_VOLUME_ID/);
  assert.match(rollback, /ROLLBACK_RELEASE_SHA: \$\{\{ inputs\.rollback_source_sha \}\}/);
  assert.doesNotMatch(rollback, /^      rollback_release_sha:$/m);

  for (const text of [prepare, deploy, rollback]) {
    assert.doesNotMatch(text, /096b24db145187542b71cb76cd613e8909515a5a/);
    assert.doesNotMatch(text, /32e2046af97040ce5fc62df3fdc97e82c123201b61e137861329a9b171925510/);
  }
});

test('V10 the release filename preflight allows only root .env.example and scans its content', () => {
  const prepare = fs.readFileSync(workflowPath('production-prepare-release.yml'), 'utf8')
    .replaceAll('\r\n', '\n');
  const functionStart = prepare.indexOf('          is_prohibited_release_filename() {');
  const functionEnd = prepare.indexOf('\n          prohibited_file_list=', functionStart);
  assert.notEqual(functionStart, -1);
  assert.ok(functionEnd > functionStart);
  const functionSource = prepare.slice(functionStart, functionEnd)
    .split('\n')
    .map((line) => line.startsWith('          ') ? line.slice(10) : line)
    .join('\n');
  const bash = process.platform === 'win32'
    ? [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    ].find((candidate) => fs.existsSync(candidate))
    : 'bash';
  assert.ok(bash, 'Bash is required to execute the release filename predicate');
  const classify = (filename) => spawnSync(
    bash,
    ['-c', `${functionSource}\nis_prohibited_release_filename "$1"`, 'filename-preflight', filename],
    { cwd: repoRoot, encoding: 'utf8' },
  );

  for (const filename of ['.env.example', 'README.md', 'src/example.js']) {
    const result = classify(filename);
    assert.equal(result.status, 1, `${filename} should be allowed: ${result.stderr}`);
  }
  for (const filename of [
    '.env', '.env.preview', '.env.production', '.ENV.EXAMPLE',
    'config/.env.example', 'config/.env.local', 'credentials.json', 'src/secrets.pem',
  ]) {
    const result = classify(filename);
    assert.equal(result.status, 0, `${filename} should be prohibited: ${result.stderr}`);
  }

  assert.ok(fs.readFileSync(path.join(repoRoot, '.env.example'), 'utf8').length > 0);
  assert.match(prepare, /git diff --binary "\$PRODUCTION_BASE_SHA"\.\.\.HEAD >"\$RUNNER_TEMP\/release\.diff"/);
  assert.match(prepare, /node scripts\/scan-release-diff\.mjs "\$RUNNER_TEMP\/release\.diff"/);
  assert.doesNotMatch(prepare, /:!\.env\.example/);
});
