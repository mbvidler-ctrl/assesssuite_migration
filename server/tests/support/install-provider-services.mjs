const TEST_PROVIDER_SERVICES = Symbol.for('assesssuite.test-provider-services');

export function installTestProviderServices(services, environment = process.env) {
  if (environment.NODE_ENV !== 'test' || environment.SELFTEST !== '1') {
    throw new Error('test provider services are forbidden outside an exact self-test posture');
  }
  if (!services || typeof services !== 'object' || Array.isArray(services)) {
    throw new TypeError('test provider services must be an object');
  }
  if (globalThis[TEST_PROVIDER_SERVICES]) {
    throw new Error('test provider services have already been installed');
  }
  globalThis[TEST_PROVIDER_SERVICES] = Object.freeze({ ...services });
}
