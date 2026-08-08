import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const suites = [
  'sdk-error-contract.test.mjs',
  'app-params-security.test.mjs',
  'patient-consent-policy-security.test.mjs',
  'referral-diagnostics.test.mjs',
  'referral-extraction-schema.test.mjs',
  'referral-review.test.mjs',
  'referral-review-identity.test.mjs',
  'referral-commit.test.mjs',
  'referral-reviewed-age-gate.test.mjs',
  'signup-contract.test.mjs',
  'usage-analytics-routes.test.mjs',
  'profile-setup-access.test.mjs',
  'profile-founder-organization.test.mjs',
  'provider-model-contract.test.mjs',
  'provider-probe-contract.test.mjs',
  'production-startup.test.mjs',
  'outbound-capability-gates.test.mjs',
  'billing-portal-authorization.test.mjs',
  'billing-checkout-authorization.test.mjs',
  'promotion-management.test.mjs',
  'billing-account-closure.test.mjs',
  'billing-webhook-authorization.test.mjs',
  'rate-limit.test.mjs',
  'registration-rate-limit.test.mjs',
  'session-lifecycle.test.mjs',
  'invoke-llm-authorization.test.mjs',
  'invoke-llm-throttling.test.mjs',
  'invoke-llm-param-contract.test.mjs',
  'file-access-grants.test.mjs',
  'send-email-relay-security.test.mjs',
  'upload-admission-security.test.mjs',
  'published-note-immutability.test.mjs',
  'report-generic-crud-governance.test.mjs',
  'protocol-client-picker.test.mjs',
  'ai-provenance-labelling.test.mjs',
  'treatment-protocol-catalogue.test.mjs',
  'protocol-response-structure.test.mjs',
  'evidence-service-integrity.test.mjs',
  'reference-verification-badge.test.mjs',
  'evidence-grounding-status.test.mjs',
  'apss-user-facing-copy.test.mjs',
  'landing-responsive-layout.test.mjs',
  'split-hosting-boundary.test.mjs',
  'static-spa-routing.test.mjs',
  'ci-release-gates.test.mjs',
  'root-error-boundary.test.mjs',
  'rich-text-editor-security.test.mjs',
  'upload-lifecycle-config.test.mjs',
  'production-parity-contract.test.mjs',
  'production-state-snapshot-workflow.test.mjs',
  'extraction-matrix.test.mjs',
  'referral-sdk-journey.test.mjs',
  'referral-production-canary.test.mjs',
  'rollback-compatibility.test.mjs',
  'release-tools.test.mjs',
  'public-capabilities-contract.test.mjs',
  'ai-capability-degradation.test.mjs',
  'ai-surface-honesty.test.mjs',
  'assessment-discovery.test.mjs',
  'core-v1-legacy-llm-retirement.test.mjs',
  'entity-repository-authoritative-columns.test.mjs',
  'core-v1-server-integration.test.mjs',
  '../../scripts/core-v1/contracts.test.mjs',
  '../../scripts/core-v1/state-machines.test.mjs',
  '../../scripts/core-v1/schema-repository.test.mjs',
  '../../scripts/core-v1/runtime-gate.test.mjs',
  '../../scripts/core-v1/legacy-source-resolvers.test.mjs',
  '../../scripts/core-v1/core-http.test.mjs',
  '../../scripts/core-v1/orchestration.test.mjs',
  '../../scripts/core-v1/protocol-assistance-search.test.mjs',
  '../../scripts/core-v1/report-template-registry.test.mjs',
  '../../scripts/core-v1/report-composition-engine.test.mjs',
  '../../scripts/core-v1/report-legacy-compatibility.test.mjs',
  '../../scripts/core-v1/report-ui-safety.test.mjs',
  '../../scripts/core-v1/saved-report-release-gate.test.mjs',
  '../../scripts/core-v1/core-assurance-ui.test.mjs',
  'soap-dissection-fail-closed.test.mjs',
  'clinical-ai-feature-matrix.test.mjs',
  'production-deploy-workflow-validator.test.mjs',
  'capability-flag-registry.test.mjs',
  'flag-impact-gate.test.mjs',
];

for (const suite of suites) {
  const exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, ['--test', path.join(testsDir, suite)], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', () => resolve(1));
    child.on('exit', (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) {
    process.exitCode = exitCode;
    break;
  }
}
