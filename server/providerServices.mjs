const TEST_PROVIDER_SERVICES = Symbol.for('assesssuite.test-provider-services');

function exactTestPosture(environment = process.env) {
  return environment.NODE_ENV === 'test' && environment.SELFTEST === '1';
}

function assertServiceBag(services) {
  if (!services || typeof services !== 'object' || Array.isArray(services)) {
    throw new TypeError('test provider services must be an object');
  }
  if (services.stripeProvider && services.stripeProvider.testOnly !== true) {
    throw new TypeError('an injected Stripe provider must be explicitly test-only');
  }
  if (services.invokeLlmFallback && typeof services.invokeLlmFallback !== 'function') {
    throw new TypeError('an injected InvokeLLM fallback must be a function');
  }
  if (services.transcriptionFallback && typeof services.transcriptionFallback !== 'function') {
    throw new TypeError('an injected transcription fallback must be a function');
  }
  return services;
}

export function readTestProviderServices(environment = process.env) {
  const services = globalThis[TEST_PROVIDER_SERVICES];
  if (!services) return Object.freeze({});
  if (!exactTestPosture(environment)) {
    throw new Error('installed test provider services are forbidden in this runtime posture');
  }
  return assertServiceBag(services);
}

export function assertTestProviderInjectionAbsent(environment = process.env) {
  if (globalThis[TEST_PROVIDER_SERVICES] || environment.ASSESSSUITE_TEST_PROVIDER_SERVICES) {
    throw new Error('test provider injection must be absent');
  }
  return true;
}
