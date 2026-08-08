import {
  transitionCapabilityState,
  transitionConfigState,
} from './domainStates.mjs';
import { CoreContractError } from './errors.mjs';
import { sha256CanonicalJson } from './json.mjs';

export const CORE_V1_SANDBOX_BINDINGS = Object.freeze({
  assessment_discovery: Object.freeze({
    capabilityKey: 'assessment_discovery',
    configVersionId: 'core-v1-assessment-discovery-config-v1',
    version: 1,
    config: Object.freeze({
      algorithm: 'deterministic_catalogue_ranking_v1',
      maximumResults: 25,
      generation: 'disabled',
      executionMode: 'sandbox',
    }),
  }),
  protocol_assistance: Object.freeze({
    capabilityKey: 'protocol_assistance',
    configVersionId: 'core-v1-protocol-assistance-config-v1',
    version: 1,
    config: Object.freeze({
      algorithm: 'reviewed_catalogue_search_v1',
      maximumResults: 25,
      patientContext: 'denied',
      generation: 'disabled',
      executionMode: 'sandbox',
    }),
  }),
  report_composition: Object.freeze({
    capabilityKey: 'report_composition',
    configVersionId: 'core-v1-report-composition-config-v1',
    version: 1,
    config: Object.freeze({
      algorithm: 'deterministic_report_composition_v1',
      outputState: 'draft',
      export: 'disabled',
      generation: 'disabled',
      executionMode: 'sandbox',
    }),
  }),
  artifact_review: Object.freeze({
    capabilityKey: 'artifact_review',
    configVersionId: 'core-v1-artifact-review-config-v1',
    version: 1,
    config: Object.freeze({
      authority: 'relational_state',
      selfApproval: 'denied',
      clinicalReviewerRequired: true,
      executionMode: 'sandbox',
    }),
  }),
});

function nowIso(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new CoreContractError('CORE_INVALID_CLOCK', 'sandbox bootstrap clock is invalid');
  }
  return date.toISOString();
}

function assertSafeExistingConfig(config, binding) {
  if (
    config.configKey !== binding.capabilityKey
    || config.version !== binding.version
    || config.orgId !== null
    || config.contentHash !== sha256CanonicalJson(binding.config)
  ) {
    throw new CoreContractError(
      'CORE_SANDBOX_CONFIG_CONFLICT',
      'sandbox config identifier is already bound to another contract',
      { httpStatus: 409 },
    );
  }
  if (!['draft', 'validated'].includes(config.state)) {
    throw new CoreContractError(
      'CORE_SANDBOX_CONFIG_STATE_DENIED',
      'sandbox bootstrap will not adopt an approved or active config',
      { httpStatus: 409 },
    );
  }
  if (config.approvalRef !== null || config.deploymentAuthorityRef !== null) {
    throw new CoreContractError(
      'CORE_SANDBOX_DEPLOYMENT_REF_DENIED',
      'sandbox bootstrap cannot adopt a deployment authority reference',
      { httpStatus: 409 },
    );
  }
}

/**
 * Installs deterministic, global sandbox-only bindings.
 *
 * This function has no production activation path. It never creates an
 * approval or deployment reference and never advances a capability beyond
 * `sandbox_only`, or a config beyond `validated`.
 */
export function bootstrapCoreV1Sandbox(
  repositories,
  {
    sandboxEnabled = false,
    createdBy = 'core-v1-sandbox-bootstrap',
    validationRef = 'core-v1-sandbox-contract-validation',
    clock = () => new Date(),
  } = {},
) {
  if (sandboxEnabled !== true) {
    throw new CoreContractError(
      'CORE_SANDBOX_DISABLED',
      'sandbox bootstrap requires an explicit enablement',
      { httpStatus: 404 },
    );
  }
  if (!repositories?.configs || !repositories?.capabilities) {
    throw new CoreContractError('CORE_REPOSITORIES_REQUIRED', 'Core repositories are required');
  }
  const timestamp = nowIso(clock);
  const results = [];

  for (const binding of Object.values(CORE_V1_SANDBOX_BINDINGS)) {
    let config = repositories.configs.get(binding.configVersionId);
    if (config === null) {
      config = repositories.configs.create({
        configVersionId: binding.configVersionId,
        orgId: null,
        configKey: binding.capabilityKey,
        version: binding.version,
        config: binding.config,
        createdBy,
        createdAt: timestamp,
      });
    } else {
      assertSafeExistingConfig(config, binding);
    }
    if (config.state === 'draft') {
      config = repositories.configs.transition({
        configVersionId: config.configVersionId,
        expectedStateVersion: config.stateVersion,
        transition: transitionConfigState('draft', 'validated', { validationRef }),
        updatedAt: timestamp,
      });
    }

    let capability = repositories.capabilities.register({
      capabilityKey: binding.capabilityKey,
      createdAt: timestamp,
    });
    if (capability.state === 'registered') {
      capability = repositories.capabilities.transition({
        capabilityKey: capability.capabilityKey,
        expectedStateVersion: capability.stateVersion,
        transition: transitionCapabilityState('registered', 'sandbox_only'),
        updatedAt: timestamp,
      });
    }
    if (capability.state !== 'sandbox_only') {
      throw new CoreContractError(
        'CORE_SANDBOX_CAPABILITY_STATE_DENIED',
        'sandbox bootstrap will not adopt an elevated capability state',
        { httpStatus: 409 },
      );
    }
    if (
      capability.approvalRef !== null
      || capability.deploymentAuthorityRef !== null
      || capability.activeConfigVersionId !== null
    ) {
      throw new CoreContractError(
        'CORE_SANDBOX_CAPABILITY_EVIDENCE_DENIED',
        'sandbox capability contains production evidence',
        { httpStatus: 409 },
      );
    }
    results.push(Object.freeze({ binding, config, capability }));
  }

  return Object.freeze(results);
}
