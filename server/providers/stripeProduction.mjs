import * as stripeGateway from '../stripeGateway.mjs';

export const productionStripeProvider = Object.freeze({
  providerId: 'stripe',
  testOnly: false,
  requiresSignedWebhook: true,
  corroboratesCheckoutSubscription: true,
  enabled: stripeGateway.stripeEnabled,
  stripeRequestIdFor: stripeGateway.stripeRequestIdFor,
  checkoutIdempotencyKeyFor: stripeGateway.checkoutIdempotencyKeyFor,
  checkoutSessionRequestSha256: stripeGateway.checkoutSessionRequestSha256,
  createCheckoutSession: stripeGateway.createCheckoutSession,
  retrieveCheckoutSession: stripeGateway.retrieveCheckoutSession,
  listPromotionCodes: stripeGateway.listPromotionCodes,
  createCoupon: stripeGateway.createCoupon,
  createPromotionCode: stripeGateway.createPromotionCode,
  deactivatePromotionCode: stripeGateway.deactivatePromotionCode,
  deleteCoupon: stripeGateway.deleteCoupon,
  createPortalSession: stripeGateway.createPortalSession,
  cancelSubscription: stripeGateway.cancelSubscription,
  findCustomerByEmail: stripeGateway.findCustomerByEmail,
  listSubscriptionsForCustomer: stripeGateway.listSubscriptionsForCustomer,
  retrieveSubscription: stripeGateway.retrieveSubscription,
  verifyStripeSignatureHeader: stripeGateway.verifyStripeSignatureHeader,
  errorClass: stripeGateway.StripeApiError,
});

const REQUIRED_METHODS = Object.freeze([
  'enabled',
  'stripeRequestIdFor',
  'checkoutIdempotencyKeyFor',
  'checkoutSessionRequestSha256',
  'createCheckoutSession',
  'retrieveCheckoutSession',
  'listPromotionCodes',
  'createCoupon',
  'createPromotionCode',
  'deactivatePromotionCode',
  'deleteCoupon',
  'createPortalSession',
  'cancelSubscription',
  'findCustomerByEmail',
  'listSubscriptionsForCustomer',
  'retrieveSubscription',
  'verifyStripeSignatureHeader',
]);

function assertProviderShape(provider) {
  if (!provider || typeof provider !== 'object' || Array.isArray(provider)) {
    throw new TypeError('Stripe provider is unavailable');
  }
  for (const method of REQUIRED_METHODS) {
    if (typeof provider[method] !== 'function') {
      throw new TypeError(`Stripe provider is missing ${method}`);
    }
  }
  return provider;
}

/**
 * Production always receives the one real Stripe adapter. A caller may
 * inject a test adapter only from the exact isolated test posture; the
 * production image contains no such adapter implementation.
 */
export function resolveStripeProvider(injected, environment = process.env) {
  if (!injected) return productionStripeProvider;
  if (environment.NODE_ENV !== 'test' || environment.SELFTEST !== '1') {
    throw new Error('injected Stripe providers are forbidden outside self-test');
  }
  if (injected.testOnly !== true) {
    throw new Error('an injected Stripe provider must be explicitly test-only');
  }
  return assertProviderShape(injected);
}

export function stripeProviderReady(provider, environment = process.env) {
  return provider.enabled(environment) === true;
}
