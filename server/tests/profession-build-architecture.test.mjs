import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  DEFAULT_PROFESSION_ID,
  PROFESSIONS,
  PROFESSION_IDS,
  assertRuntimePlatformIdentity,
  composePlatformTarget,
  getProfession,
  resolveActiveProfessionContract,
  resolveProfession,
  toPublicProfession,
  validateProfession,
} from '../../packages/profession-config/index.mjs';
import { resolveDefaultDatabaseFileName } from '../db.mjs';
import { isInitialClinicalReleaseEligible } from '../../src/lib/clinicalRelease.js';
import {
  isManagementProfileProfession,
  isProfileProfessionAllowed,
  profileProfessionOptions,
} from '../../src/lib/profileProfession.js';
import epViteConfig from '../../apps/app-ep/vite.config.js';
import physioViteConfig from '../../apps/app-physio/vite.config.js';
import landingViteConfig from '../../apps/landing/vite.config.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

test('G1.1 registers exactly the explicit EP and Physio targets', () => {
  assert.deepEqual(PROFESSION_IDS, ['exercise-physiology', 'physio']);
  assert.equal(DEFAULT_PROFESSION_ID, 'exercise-physiology');
  assert.equal(resolveProfession({}).id, 'exercise-physiology');
  assert.equal(resolveProfession({ PROFESSION: '' }).id, 'exercise-physiology');
  assert.equal(resolveProfession({ PROFESSION: 'physio' }).id, 'physio');
  assert.throws(
    () => resolveProfession({ PROFESSION: 'physiotherapy' }),
    /unknown profession "physiotherapy"/,
  );
  assert.throws(
    () => resolveProfession({ PROFESSION: 'unknown-profession' }),
    /unknown profession/,
  );
});

test('G1.2 keeps deployment identities isolated across professions', () => {
  for (const id of PROFESSION_IDS) validateProfession(PROFESSIONS[id]);
  for (const field of [
    'shellId',
    'appId',
    'localAppPort',
    'localServerPort',
    'dataFile',
    'intendedAppHost',
  ]) {
    const values = PROFESSION_IDS.map((id) => PROFESSIONS[id].deployment[field]);
    assert.equal(new Set(values).size, values.length, `${field} must be unique`);
  }
  assert.equal(getProfession('exercise-physiology').deployment.dataFile, 'app.db');
  assert.equal(getProfession('physio').deployment.dataFile, 'physio.db');
});

test('G1.2b binds default SQLite filenames to the active profession', () => {
  assert.equal(resolveDefaultDatabaseFileName({}), 'app.db');
  assert.equal(resolveDefaultDatabaseFileName({
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
  }), 'physio.db');
  assert.equal(resolveDefaultDatabaseFileName({
    SELFTEST: '1',
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
  }), 'selftest.db');
  assert.throws(() => resolveDefaultDatabaseFileName({
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite',
  }));
});

test('G1.3 composes only exact registered shell/app-id/port tuples', () => {
  const ep = composePlatformTarget({
    professionId: 'exercise-physiology',
    shellId: 'app-ep',
    appId: 'local-assesssuite',
    port: 4101,
    serverPort: 8787,
  });
  assert.equal(ep.professionId, 'exercise-physiology');
  assert.equal(ep.appId, 'local-assesssuite');

  const physio = composePlatformTarget({
    professionId: 'physio',
    shellId: 'app-physio',
    appId: 'local-assesssuite-physio',
    port: 4201,
    serverPort: 8788,
  });
  assert.equal(physio.professionId, 'physio');
  assert.equal(physio.appId, 'local-assesssuite-physio');

  assert.throws(
    () => composePlatformTarget({
      ...physio,
      appId: 'local-assesssuite',
    }),
    /appId mismatch/,
  );
  assert.throws(
    () => composePlatformTarget({
      ...physio,
      shellId: 'app-ep',
    }),
    /shellId mismatch/,
  );
  assert.throws(
    () => composePlatformTarget({
      ...physio,
      serverPort: 8787,
    }),
    /serverPort mismatch/,
  );

  // Bidirectional isolation: neither correct tuple can be relabelled as the
  // other profession, even when every other field is internally consistent.
  assert.throws(
    () => composePlatformTarget({
      ...physio,
      professionId: 'exercise-physiology',
    }),
    /shellId mismatch/,
  );
  assert.throws(
    () => composePlatformTarget({
      ...ep,
      professionId: 'physio',
    }),
    /shellId mismatch/,
  );
});

test('G1.4 refuses compiled, URL and stored Physio app-id mismatches', () => {
  assert.deepEqual(
    assertRuntimePlatformIdentity('physio', {
      compiledProfessionId: 'physio',
      compiledAppId: 'local-assesssuite-physio',
      search: '?app_id=local-assesssuite-physio',
      storedAppId: 'local-assesssuite-physio',
    }),
    {
      professionId: 'physio',
      appId: 'local-assesssuite-physio',
    },
  );
  assert.throws(
    () => assertRuntimePlatformIdentity('physio', {
      compiledProfessionId: 'exercise-physiology',
      compiledAppId: 'local-assesssuite-physio',
    }),
    /compiled profession mismatch/,
  );
  assert.throws(
    () => assertRuntimePlatformIdentity('physio', {
      compiledProfessionId: 'physio',
      compiledAppId: 'local-assesssuite',
    }),
    /compiled app id mismatch/,
  );
  assert.throws(
    () => assertRuntimePlatformIdentity('physio', {
      compiledProfessionId: 'physio',
      compiledAppId: 'local-assesssuite-physio',
      search: '?app_id=local-assesssuite',
    }),
    /URL app_id/,
  );
  assert.throws(
    () => assertRuntimePlatformIdentity('physio', {
      compiledProfessionId: 'physio',
      compiledAppId: 'local-assesssuite-physio',
      storedAppId: 'local-assesssuite',
    }),
    /stored app_id/,
  );

  assert.deepEqual(
    assertRuntimePlatformIdentity('exercise-physiology', {
      compiledProfessionId: 'exercise-physiology',
      compiledAppId: 'local-assesssuite',
    }),
    {
      professionId: 'exercise-physiology',
      appId: 'local-assesssuite',
    },
  );
  assert.throws(
    () => assertRuntimePlatformIdentity('exercise-physiology', {
      compiledProfessionId: 'exercise-physiology',
      compiledAppId: 'local-assesssuite-physio',
    }),
    /compiled app id mismatch/,
  );
  assert.throws(
    () => assertRuntimePlatformIdentity('exercise-physiology', {
      compiledProfessionId: 'physio',
      compiledAppId: 'local-assesssuite',
    }),
    /compiled profession mismatch/,
  );
});

test('G1.5 exposes one strict active manifest contract for server lanes', () => {
  const ep = resolveActiveProfessionContract({});
  assert.equal(ep.professionId, 'exercise-physiology');
  assert.equal(ep.appId, 'local-assesssuite');
  assert.deepEqual(
    ep.releaseProfessions,
    ['Exercise Physiologist', 'Gym Management', 'Clinic Management'],
  );

  const physio = resolveActiveProfessionContract({
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
  });
  assert.equal(physio.professionId, 'physio');
  assert.equal(physio.appId, 'local-assesssuite-physio');
  assert.deepEqual(physio.releaseProfessions, ['Physiotherapist', 'Clinic Management']);
  assert.equal(Object.isFrozen(physio), true);
  assert.equal(Object.isFrozen(physio.releaseProfessions), true);
  assert.equal(Object.isFrozen(physio.profession), true);
  assert.equal(Object.isFrozen(physio.profession.releaseProfessions), true);

  assert.throws(
    () => resolveActiveProfessionContract({
      PROFESSION: 'physio',
      DEFAULT_APP_ID: 'local-assesssuite',
    }),
    /does not match PROFESSION="physio"/,
  );
  assert.throws(
    () => resolveActiveProfessionContract({
      PROFESSION: 'exercise-physiology',
      DEFAULT_APP_ID: 'local-assesssuite-physio',
    }),
    /does not match PROFESSION="exercise-physiology"/,
  );
});

test('G1.6 preserves EP eligibility by default and permits only Physio professions when explicit', () => {
  const ep = { country: 'australia', profession: 'Exercise Physiologist' };
  const physio = { country: 'australia', profession: 'Physiotherapist' };
  assert.equal(isInitialClinicalReleaseEligible(ep), true);
  assert.equal(isInitialClinicalReleaseEligible(physio), false);

  const physioRelease = new Set(getProfession('physio').releaseProfessions);
  assert.equal(isInitialClinicalReleaseEligible(physio, physioRelease), true);
  assert.equal(isInitialClinicalReleaseEligible(ep, physioRelease), false);
  assert.equal(
    isInitialClinicalReleaseEligible(
      { country: 'Australia', profession: 'Physiotherapist' },
      physioRelease,
    ),
    false,
  );
});

test('G1.7 Vite shells bake distinct identities and proxy to distinct app ids', () => {
  assert.equal(
    epViteConfig.define['import.meta.env.VITE_PROFESSION'],
    JSON.stringify('exercise-physiology'),
  );
  assert.equal(
    epViteConfig.define['import.meta.env.VITE_BASE44_APP_ID'],
    JSON.stringify('local-assesssuite'),
  );
  assert.equal(
    epViteConfig.server.proxy['/functions'].rewrite('/functions/example'),
    '/api/apps/local-assesssuite/functions/example',
  );

  assert.equal(
    physioViteConfig.define['import.meta.env.VITE_PROFESSION'],
    JSON.stringify('physio'),
  );
  assert.equal(
    physioViteConfig.define['import.meta.env.VITE_BASE44_APP_ID'],
    JSON.stringify('local-assesssuite-physio'),
  );
  assert.equal(
    physioViteConfig.server.proxy['/functions'].rewrite('/functions/example'),
    '/api/apps/local-assesssuite-physio/functions/example',
  );
  assert.equal(physioViteConfig.server.port, 4201);
  assert.equal(physioViteConfig.preview.port, 4201);

  const viteAppSurfaceDefine = ['import.meta.env', 'VITE_APP_SURFACE'].join('.');
  assert.equal(landingViteConfig.define[viteAppSurfaceDefine], '"marketing"');
  assert.equal(landingViteConfig.server.proxy, undefined);
});

test('G1.8 public profession projection omits deployment internals', () => {
  const projected = toPublicProfession('physio');
  assert.equal(projected.id, 'physio');
  assert.equal(projected.features.careEpisodes, true);
  assert.equal(projected.lexicon.clientPluralTitleCase, 'Patients');
  assert.ok(!('deployment' in projected));
  assert.ok(!('assessmentLibrary' in projected));
});

test('G1.9 Layout admits navigation and direct routes from the active profession allowlist', () => {
  const layout = readFileSync(path.join(repoRoot, 'src', 'Layout.jsx'), 'utf8');
  assert.match(layout, /activeProfession\.navigation\.primaryPages\.map/);
  assert.match(layout, /activeProfession\.navigation\.allowedPages\.map/);
  assert.match(layout, /const requestedPage = pathPage \|\|/);
  assert.match(layout, /isProfessionRouteDenied\(location\.pathname, currentPageName\)/);
  assert.match(layout, /activeReleaseProfessions/);
  assert.match(layout, /isInitialClinicalReleaseEligible\(freshUser, activeReleaseProfessions\)/);
});

test('G1.10 derives exact EP and Physio profile choices from their active manifests', () => {
  const ep = getProfession('exercise-physiology');
  assert.equal(ep.releaseCountry, 'australia');
  assert.deepEqual(profileProfessionOptions(ep), [
    {
      value: 'Exercise Physiologist',
      label: 'Accredited Exercise Physiologist (AEP)',
    },
    { value: 'Gym Management', label: 'Gym Management' },
    { value: 'Clinic Management', label: 'Clinic Management' },
  ]);
  assert.equal(isProfileProfessionAllowed(ep, 'Exercise Physiologist'), true);
  assert.equal(isProfileProfessionAllowed(ep, 'Physiotherapist'), false);
  assert.equal(isManagementProfileProfession(ep, 'Gym Management'), true);
  assert.equal(ep.signup.registrationNumberRequired, false);

  const physio = getProfession('physio');
  assert.equal(physio.releaseCountry, 'australia');
  assert.deepEqual(profileProfessionOptions(physio), [
    {
      value: 'Physiotherapist',
      label: 'Registered Physiotherapist (Ahpra)',
    },
    { value: 'Clinic Management', label: 'Clinic Management' },
  ]);
  assert.equal(isProfileProfessionAllowed(physio, 'Physiotherapist'), true);
  assert.equal(isProfileProfessionAllowed(physio, 'Exercise Physiologist'), false);
  assert.equal(isProfileProfessionAllowed(physio, 'Gym Management'), false);
  assert.equal(isManagementProfileProfession(physio, 'Clinic Management'), true);
  assert.equal(physio.signup.registrationNumberRequired, true);
  assert.equal(physio.signup.registrationNumberLabel, 'Ahpra Registration Number');
});

test('G1.11 ProfileSetup and MyProfile use only the active manifest for profile admission', () => {
  const profileSetup = readFileSync(path.join(repoRoot, 'src', 'pages', 'ProfileSetup.jsx'), 'utf8');
  const myProfile = readFileSync(path.join(repoRoot, 'src', 'pages', 'MyProfile.jsx'), 'utf8');

  for (const source of [profileSetup, myProfile]) {
    assert.match(source, /buildTimeProfession as activeProfession/);
    assert.match(source, /profileProfessionOptions\(activeProfession\)/);
    assert.match(source, /activeProfessionOptions\.map/);
    assert.match(source, /activeProfession\.signup\.registrationNumberLabel/);
    assert.match(source, /activeProfession\.signup\.registrationNumberPlaceholder/);
    assert.match(source, /activeProfession\.signup\.registrationNumberRequired/);
    assert.doesNotMatch(source, /<SelectItem value=["'](?:Exercise Physiologist|Physiotherapist|Gym Management|Clinic Management)["']/);
  }

  assert.doesNotMatch(profileSetup, /INITIAL_RELEASE_PROFESSIONS/);
  assert.match(
    profileSetup,
    /isProfileProfessionAllowed\(activeProfession, currentUser\.profession\)/,
  );
  assert.match(
    profileSetup,
    /isProfileProfessionAllowed\(activeProfession, formData\.profession\)/,
  );
  assert.match(profileSetup, /country:\s*activeProfession\.releaseCountry/);
  assert.match(profileSetup, /updatedData\.country = activeProfession\.releaseCountry/);

  assert.match(
    myProfile,
    /if \(!isProfileProfessionAllowed\(activeProfession, formData\.profession\)\)/,
  );
  assert.match(myProfile, /country:\s*activeProfession\.releaseCountry/);
  assert.match(myProfile, /userData\.country \|\| activeProfession\.releaseCountry/);
});

test('G1.12 pull-request CI fails closed on both professions and the full typecheck', () => {
  const ci = readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
  for (const requiredCommand of [
    'npm run typecheck',
    'npm run catalogue:physio:check',
    'npm run build:platform',
    'npm run build:physio',
    'npm run test:physio',
    'npm run lint',
    'npm run test:ep-assessment-browser',
    'npm run test:physio-public-browser',
    'npm run test:physio-offline-journey',
    'npm run check:physio-live-self-service-commands',
  ]) {
    assert.ok(ci.includes(requiredCommand), `pull-request CI is missing ${requiredCommand}`);
  }
  assert.match(ci, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(ci, /FLY_API_TOKEN|OPENAI_API_KEY|RESEND_API_KEY|STRIPE_SECRET_KEY/);
});

test('G1.13 wires explicit self-service phases while PR CI remains provider-free', () => {
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const wrapper = readFileSync(
    path.join(repoRoot, 'scripts', 'run-physio-live-self-service.mjs'),
    'utf8',
  );
  const ci = readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
  const prefix = 'node scripts/run-physio-live-self-service.mjs';
  assert.equal(packageJson.scripts['test:physio-live-self-service'], `${prefix} check`);
  assert.equal(packageJson.scripts['test:physio-live-self-service:provision'], `${prefix} provision`);
  assert.equal(
    packageJson.scripts['test:physio-live-self-service:validate_payment'],
    `${prefix} validate_payment`,
  );
  assert.equal(packageJson.scripts['test:physio-live-self-service:finalize'], `${prefix} finalize`);
  assert.equal(
    packageJson.scripts['test:physio-live-self-service:resume_cleanup'],
    `${prefix} resume_cleanup`,
  );
  assert.equal(
    packageJson.scripts['check:physio-live-self-service-commands'],
    `${prefix} check`,
  );
  assert.match(wrapper, /provider_effects_executed:\s*false/);
  assert.match(wrapper, /PHYSIO_SELF_SERVICE_EXTERNAL_EFFECTS_AUTHORIZED/);
  assert.match(
    wrapper,
    /resume_cleanup:\s*Object\.freeze\(\{\s*phase:\s*'resume-cleanup'/,
  );
  assert.match(
    wrapper,
    /validate_payment:\s*Object\.freeze\(\{\s*phase:\s*'validate-payment'/,
  );
  assert.match(ci, /npm run check:physio-live-self-service-commands/);
  assert.doesNotMatch(
    ci,
    /npm run test:physio-live-self-service:(?:provision|validate_payment|finalize|resume_cleanup)/,
  );
  assert.doesNotMatch(ci, /PHYSIO_SELF_SERVICE_EXTERNAL_EFFECTS_AUTHORIZED/);
});
