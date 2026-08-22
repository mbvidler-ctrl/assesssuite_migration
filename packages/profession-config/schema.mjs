// Architecture-only contract for an AssessSuite profession target.
//
// This package owns product identity and deployment composition. Clinical,
// regulatory, instrument-rights and assurance policy deliberately live outside
// this contract so an application build cannot silently acquire policy by
// importing its target identity.

export const PROFESSION_SCHEMA_VERSION = '2.0.0';

const REQUIRED_STRINGS = [
  'id',
  'productName',
  'shortName',
  'practitionerNoun',
  'practitionerNounPlural',
  'practitionerShort',
  'disciplineName',
  'clinicalPromptRole',
  'releaseCountry',
];

const REQUIRED_LEXICON = [
  'client',
  'clientPlural',
  'clientTitleCase',
  'clientPluralTitleCase',
  'practitioner',
  'practitionerTitleCase',
  'episode',
  'session',
  'plan',
  'planTitleCase',
  'intervention',
  'interventionTitleCase',
  'protocol',
  'protocolTitleCase',
  'protocolLibrary',
  'assessmentLibrary',
];

const REQUIRED_DEPLOYMENT_STRINGS = [
  'shellId',
  'appId',
  'dataFile',
  'intendedAppHost',
];

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty, trimmed string`);
  }
}

function assertUniqueNonEmptyStrings(values, label) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError(`${label} must contain at least one value`);
  }
  values.forEach((value, index) => assertNonEmptyString(value, `${label}[${index}]`));
  if (new Set(values).size !== values.length) {
    throw new TypeError(`${label} must not contain duplicate values`);
  }
}

function assertPort(value, label) {
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new TypeError(`${label} must be an integer between 1024 and 65535`);
  }
}

/**
 * Validate one profession manifest. Invalid manifests fail during module load,
 * before Vite or the server can compose a target from them.
 */
export function validateProfession(definition) {
  assertPlainObject(definition, 'profession definition');

  for (const key of REQUIRED_STRINGS) {
    assertNonEmptyString(definition[key], `profession.${key}`);
  }
  if (!/^[a-z][a-z0-9-]*$/.test(definition.id)) {
    throw new TypeError(`profession.id "${definition.id}" is not a stable kebab-case identifier`);
  }
  if (definition.releaseCountry !== 'australia') {
    throw new TypeError(
      `profession "${definition.id}" releaseCountry must remain the existing canonical value "australia"`,
    );
  }

  assertPlainObject(definition.lexicon, `profession "${definition.id}" lexicon`);
  for (const key of REQUIRED_LEXICON) {
    assertNonEmptyString(definition.lexicon[key], `profession "${definition.id}" lexicon.${key}`);
  }

  assertUniqueNonEmptyStrings(
    definition.releaseProfessions,
    `profession "${definition.id}" releaseProfessions`,
  );

  assertPlainObject(definition.signup, `profession "${definition.id}" signup`);
  for (const key of [
    'clinicalProfessionValue',
    'clinicalProfessionLabel',
    'registrationNumberLabel',
    'registrationNumberPlaceholder',
    'qualificationsPlaceholder',
    'ineligibleMessage',
  ]) {
    assertNonEmptyString(definition.signup[key], `profession "${definition.id}" signup.${key}`);
  }
  if (typeof definition.signup.registrationNumberRequired !== 'boolean') {
    throw new TypeError(
      `profession "${definition.id}" signup.registrationNumberRequired must be boolean`,
    );
  }
  assertUniqueNonEmptyStrings(
    definition.signup.managementRoles,
    `profession "${definition.id}" signup.managementRoles`,
  );
  const expectedReleaseProfessions = [
    definition.signup.clinicalProfessionValue,
    ...definition.signup.managementRoles,
  ];
  if (
    expectedReleaseProfessions.length !== definition.releaseProfessions.length
    || expectedReleaseProfessions.some((value) => !definition.releaseProfessions.includes(value))
  ) {
    throw new TypeError(
      `profession "${definition.id}" releaseProfessions must exactly match its signup professions`,
    );
  }

  assertPlainObject(
    definition.assessmentLibrary,
    `profession "${definition.id}" assessmentLibrary`,
  );
  if (!['all', 'explicit'].includes(definition.assessmentLibrary.mode)) {
    throw new TypeError(
      `profession "${definition.id}" assessmentLibrary.mode must be "all" or "explicit"`,
    );
  }
  assertUniqueNonEmptyStrings(
    definition.assessmentLibrary.seedFiles,
    `profession "${definition.id}" assessmentLibrary.seedFiles`,
  );

  assertPlainObject(definition.navigation, `profession "${definition.id}" navigation`);
  assertUniqueNonEmptyStrings(
    definition.navigation.primaryPages,
    `profession "${definition.id}" navigation.primaryPages`,
  );
  assertUniqueNonEmptyStrings(
    definition.navigation.allowedPages,
    `profession "${definition.id}" navigation.allowedPages`,
  );
  for (const page of [...definition.navigation.primaryPages, ...definition.navigation.allowedPages]) {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(page)) {
      throw new TypeError(`profession "${definition.id}" navigation page "${page}" must be a registered PascalCase page key`);
    }
  }
  if (definition.navigation.primaryPages.some((page) => !definition.navigation.allowedPages.includes(page))) {
    throw new TypeError(`profession "${definition.id}" navigation.primaryPages must be a subset of navigation.allowedPages`);
  }

  assertPlainObject(definition.reports, `profession "${definition.id}" reports`);
  assertUniqueNonEmptyStrings(
    definition.reports.allowedRegions,
    `profession "${definition.id}" reports.allowedRegions`,
  );
  assertUniqueNonEmptyStrings(
    definition.reports.allowedTypeIds,
    `profession "${definition.id}" reports.allowedTypeIds`,
  );
  for (const [field, values] of [
    ['allowedRegions', definition.reports.allowedRegions],
    ['allowedTypeIds', definition.reports.allowedTypeIds],
  ]) {
    if (values.includes('*') && values.length !== 1) {
      throw new TypeError(`profession "${definition.id}" reports.${field} wildcard must be the only value`);
    }
  }
  for (const region of definition.reports.allowedRegions) {
    if (region !== '*' && !/^[a-z][a-z0-9]*$/.test(region)) {
      throw new TypeError(`profession "${definition.id}" report region "${region}" is invalid`);
    }
  }
  for (const reportType of definition.reports.allowedTypeIds) {
    if (reportType !== '*' && !/^[a-z][a-z0-9_]*$/.test(reportType)) {
      throw new TypeError(`profession "${definition.id}" report type "${reportType}" is invalid`);
    }
  }

  assertPlainObject(definition.features, `profession "${definition.id}" features`);
  if (typeof definition.features.careEpisodes !== 'boolean') {
    throw new TypeError(`profession "${definition.id}" features.careEpisodes must be boolean`);
  }
  if (typeof definition.features.legacyGeneralClinicalLlm !== 'boolean') {
    throw new TypeError(
      `profession "${definition.id}" features.legacyGeneralClinicalLlm must be boolean`,
    );
  }
  if (!Array.isArray(definition.features.aiTaskIds)) {
    throw new TypeError(`profession "${definition.id}" features.aiTaskIds must be an array`);
  }
  for (const [index, taskId] of definition.features.aiTaskIds.entries()) {
    assertNonEmptyString(taskId, `profession "${definition.id}" features.aiTaskIds[${index}]`);
    if (!/^[a-z][a-z0-9_.-]*\.v[1-9][0-9]*$/.test(taskId)) {
      throw new TypeError(
        `profession "${definition.id}" AI task "${taskId}" is not a versioned stable task id`,
      );
    }
  }
  if (new Set(definition.features.aiTaskIds).size !== definition.features.aiTaskIds.length) {
    throw new TypeError(`profession "${definition.id}" features.aiTaskIds must not contain duplicates`);
  }
  if (!Array.isArray(definition.features.disabledCoreIntegrationIds)) {
    throw new TypeError(
      `profession "${definition.id}" features.disabledCoreIntegrationIds must be an array`,
    );
  }
  for (const [index, integrationId] of definition.features.disabledCoreIntegrationIds.entries()) {
    assertNonEmptyString(
      integrationId,
      `profession "${definition.id}" features.disabledCoreIntegrationIds[${index}]`,
    );
    if (!/^[A-Z][A-Za-z0-9]*$/.test(integrationId)) {
      throw new TypeError(
        `profession "${definition.id}" disabled Core integration "${integrationId}" is invalid`,
      );
    }
  }
  if (
    new Set(definition.features.disabledCoreIntegrationIds).size
    !== definition.features.disabledCoreIntegrationIds.length
  ) {
    throw new TypeError(
      `profession "${definition.id}" features.disabledCoreIntegrationIds must not contain duplicates`,
    );
  }
  if (
    definition.features.legacyGeneralClinicalLlm
    && definition.features.aiTaskIds.length > 0
  ) {
    throw new TypeError(
      `profession "${definition.id}" cannot expose both legacy general AI and versioned task AI`,
    );
  }

  assertPlainObject(definition.branding, `profession "${definition.id}" branding`);
  for (const key of ['accent', 'accentDark', 'logoAlt']) {
    assertNonEmptyString(definition.branding[key], `profession "${definition.id}" branding.${key}`);
  }

  assertPlainObject(definition.deployment, `profession "${definition.id}" deployment`);
  for (const key of REQUIRED_DEPLOYMENT_STRINGS) {
    assertNonEmptyString(
      definition.deployment[key],
      `profession "${definition.id}" deployment.${key}`,
    );
  }
  if (!/^app-[a-z0-9-]+$/.test(definition.deployment.shellId)) {
    throw new TypeError(
      `profession "${definition.id}" deployment.shellId must name an app-* shell`,
    );
  }
  if (!/^local-assesssuite(?:-[a-z0-9-]+)?$/.test(definition.deployment.appId)) {
    throw new TypeError(
      `profession "${definition.id}" deployment.appId is outside the AssessSuite app-id namespace`,
    );
  }
  if (!/^[a-z0-9][a-z0-9-]*\.db$/.test(definition.deployment.dataFile)) {
    throw new TypeError(
      `profession "${definition.id}" deployment.dataFile must be a bare lowercase .db filename`,
    );
  }
  if (!/^[a-z0-9](?:[a-z0-9-]*\.)+[a-z]{2,}$/.test(definition.deployment.intendedAppHost)) {
    throw new TypeError(
      `profession "${definition.id}" deployment.intendedAppHost must be a bare DNS hostname`,
    );
  }
  assertPort(
    definition.deployment.localAppPort,
    `profession "${definition.id}" deployment.localAppPort`,
  );
  assertPort(
    definition.deployment.localServerPort,
    `profession "${definition.id}" deployment.localServerPort`,
  );
  if (definition.deployment.localAppPort === definition.deployment.localServerPort) {
    throw new TypeError(`profession "${definition.id}" app and server ports must differ`);
  }

  return definition;
}

/**
 * Assert that a concrete shell is the exact deployment target registered for
 * its profession. There is no fallback from a malformed Physio target to EP.
 */
export function validateTargetComposition(definition, candidate) {
  validateProfession(definition);
  assertPlainObject(candidate, `profession "${definition.id}" target composition`);

  const expected = {
    professionId: definition.id,
    shellId: definition.deployment.shellId,
    appId: definition.deployment.appId,
    port: definition.deployment.localAppPort,
    serverPort: definition.deployment.localServerPort,
  };
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (candidate[key] !== expectedValue) {
      throw new TypeError(
        `profession "${definition.id}" target ${key} mismatch: expected `
        + `${JSON.stringify(expectedValue)}, received ${JSON.stringify(candidate[key])}`,
      );
    }
  }
  return Object.freeze({ ...expected });
}

/**
 * Browser-side preflight for the Base44-compatible app identity. This runs
 * before the Physio shell imports App.jsx, so a stale or injected app_id cannot
 * initialise the SDK against another vertical.
 */
export function validateRuntimeTargetIdentity(definition, runtime = {}) {
  validateProfession(definition);
  const expectedProfessionId = definition.id;
  const expectedAppId = definition.deployment.appId;

  if (runtime.compiledProfessionId !== expectedProfessionId) {
    throw new TypeError(
      `compiled profession mismatch: expected ${expectedProfessionId}, received `
      + `${String(runtime.compiledProfessionId || '<missing>')}`,
    );
  }
  if (runtime.compiledAppId !== expectedAppId) {
    throw new TypeError(
      `compiled app id mismatch for ${expectedProfessionId}: expected ${expectedAppId}, received `
      + `${String(runtime.compiledAppId || '<missing>')}`,
    );
  }

  const params = new URLSearchParams(String(runtime.search || '').replace(/^\?/, ''));
  const requestedAppIds = params.getAll('app_id').filter(Boolean);
  if (requestedAppIds.some((appId) => appId !== expectedAppId)) {
    throw new TypeError(
      `URL app_id does not match the ${expectedProfessionId} target`,
    );
  }
  if (runtime.storedAppId && runtime.storedAppId !== expectedAppId) {
    throw new TypeError(
      `stored app_id does not match the ${expectedProfessionId} target`,
    );
  }

  return Object.freeze({ professionId: expectedProfessionId, appId: expectedAppId });
}
