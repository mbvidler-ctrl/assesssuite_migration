import {
  PROFESSION_SCHEMA_VERSION,
  validateProfession,
  validateRuntimeTargetIdentity,
  validateTargetComposition,
} from './schema.mjs';
import exercisePhysiologyDefinition from './professions/exercise-physiology.mjs';
import physiotherapyDefinition from './professions/physiotherapy.mjs';

export {
  PROFESSION_SCHEMA_VERSION,
  validateProfession,
  validateRuntimeTargetIdentity,
  validateTargetComposition,
};

export const DEFAULT_PROFESSION_ID = 'exercise-physiology';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const registeredDefinitions = [exercisePhysiologyDefinition, physiotherapyDefinition]
  .map((definition) => deepFreeze(validateProfession(definition)));

export const PROFESSIONS = Object.freeze(Object.fromEntries(
  registeredDefinitions.map((definition) => [definition.id, definition]),
));

export const PROFESSION_IDS = Object.freeze(Object.keys(PROFESSIONS));

function assertIsolatedDeploymentField(field) {
  const values = PROFESSION_IDS.map((id) => PROFESSIONS[id].deployment[field]);
  if (new Set(values).size !== values.length) {
    throw new TypeError(`profession deployment field "${field}" must be unique across targets`);
  }
}

for (const field of [
  'shellId',
  'appId',
  'localAppPort',
  'localServerPort',
  'dataFile',
  'intendedAppHost',
]) {
  assertIsolatedDeploymentField(field);
}

export function getProfession(id) {
  const definition = PROFESSIONS[id];
  if (!definition) {
    throw new TypeError(
      `unknown profession "${String(id)}"; expected one of ${PROFESSION_IDS.join(', ')}`,
    );
  }
  return definition;
}

/**
 * Server-side resolver. Only an absent value retains the existing EP default;
 * any supplied unknown value refuses to boot.
 */
function currentEnvironment() {
  const runtimeProcess = Reflect.get(globalThis, 'process');
  return runtimeProcess?.env && typeof runtimeProcess.env === 'object'
    ? runtimeProcess.env
    : {};
}

export function resolveProfession(environment = currentEnvironment()) {
  const requested = typeof environment.PROFESSION === 'string'
    ? environment.PROFESSION.trim()
    : '';
  return requested ? getProfession(requested) : getProfession(DEFAULT_PROFESSION_ID);
}

/**
 * Exact process-level identity contract for server lanes. An absent
 * DEFAULT_APP_ID uses the selected manifest's own app id; a supplied mismatch
 * refuses startup so an EP process cannot serve the Physio identity (or vice
 * versa).
 */
export function resolveActiveProfessionContract(environment = currentEnvironment()) {
  const profession = resolveProfession(environment);
  const requestedAppId = typeof environment.DEFAULT_APP_ID === 'string'
    ? environment.DEFAULT_APP_ID.trim()
    : '';
  const appId = requestedAppId || profession.deployment.appId;
  if (appId !== profession.deployment.appId) {
    throw new TypeError(
      `DEFAULT_APP_ID="${appId}" does not match PROFESSION="${profession.id}" `
      + `(${profession.deployment.appId})`,
    );
  }
  return Object.freeze({
    profession,
    professionId: profession.id,
    appId,
    releaseCountry: profession.releaseCountry,
    releaseProfessions: Object.freeze([...profession.releaseProfessions]),
  });
}

export function composePlatformTarget(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    throw new TypeError('platform target composition must be an object');
  }
  return validateTargetComposition(getProfession(candidate.professionId), candidate);
}

export function assertRuntimePlatformIdentity(professionId, runtime) {
  return validateRuntimeTargetIdentity(getProfession(professionId), runtime);
}

export function toPublicProfession(definitionOrId) {
  const definition = typeof definitionOrId === 'string'
    ? getProfession(definitionOrId)
    : validateProfession(definitionOrId);
  return {
    schemaVersion: PROFESSION_SCHEMA_VERSION,
    id: definition.id,
    productName: definition.productName,
    shortName: definition.shortName,
    practitionerNoun: definition.practitionerNoun,
    practitionerNounPlural: definition.practitionerNounPlural,
    practitionerShort: definition.practitionerShort,
    disciplineName: definition.disciplineName,
    clinicalPromptRole: definition.clinicalPromptRole,
    lexicon: { ...definition.lexicon },
    releaseCountry: definition.releaseCountry,
    releaseProfessions: [...definition.releaseProfessions],
    signup: {
      ...definition.signup,
      managementRoles: [...definition.signup.managementRoles],
    },
    navigation: {
      primaryPages: [...definition.navigation.primaryPages],
      allowedPages: [...definition.navigation.allowedPages],
    },
    reports: {
      allowedRegions: [...definition.reports.allowedRegions],
      allowedTypeIds: [...definition.reports.allowedTypeIds],
    },
    features: {
      ...definition.features,
      aiTaskIds: [...definition.features.aiTaskIds],
      disabledCoreIntegrationIds: [...definition.features.disabledCoreIntegrationIds],
    },
    branding: { ...definition.branding },
  };
}

export function term(definition, token) {
  if (!definition || typeof definition !== 'object') {
    throw new TypeError('profession term lookup requires a profession object');
  }
  if (typeof token !== 'string' || token.length === 0) {
    throw new TypeError('profession term lookup requires a token');
  }
  const value = definition.lexicon?.[token];
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`profession "${definition.id || '?'}" has no lexicon token "${token}"`);
  }
  return value;
}
