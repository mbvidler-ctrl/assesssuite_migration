export const CHECKOUT_RETURN_MAX_ATTEMPTS = 30;
export const CHECKOUT_RETURN_INTERVAL_MS = 3_000;

export function isAuthoritativeTrialEntitlement(user) {
  return Boolean(
    user
    && user.account_status === "active"
    && user.subscription_status === "active"
    && user.stripe_subscription_status === "trialing"
    && typeof user.stripe_customer_id === "string"
    && user.stripe_customer_id.length > 0
    && typeof user.stripe_subscription_id === "string"
    && user.stripe_subscription_id.length > 0
  );
}

function aborted(signal) {
  return signal?.aborted === true;
}

export async function confirmCheckoutReturn({
  readUser,
  syncSubscription,
  wait,
  signal,
  maxAttempts = CHECKOUT_RETURN_MAX_ATTEMPTS,
  intervalMs = CHECKOUT_RETURN_INTERVAL_MS,
}) {
  if (
    typeof readUser !== "function"
    || typeof syncSubscription !== "function"
    || typeof wait !== "function"
    || !Number.isSafeInteger(maxAttempts)
    || maxAttempts < 1
    || maxAttempts > CHECKOUT_RETURN_MAX_ATTEMPTS
    || !Number.isSafeInteger(intervalMs)
    || intervalMs < 0
    || intervalMs > CHECKOUT_RETURN_INTERVAL_MS
  ) {
    throw new TypeError("Checkout return confirmation inputs are invalid");
  }

  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (aborted(signal)) return { status: "aborted", attempts: attempt - 1 };
    try {
      const beforeSync = await readUser();
      if (isAuthoritativeTrialEntitlement(beforeSync)) {
        return { status: "confirmed", attempts: attempt, user: beforeSync };
      }
    } catch (error) {
      lastError = error;
    }

    if (aborted(signal)) return { status: "aborted", attempts: attempt };
    try {
      await syncSubscription();
    } catch (error) {
      // A 404 while Stripe or the webhook is propagating is retryable only
      // inside this bounded loop. It is surfaced if the entitlement never
      // becomes authoritative.
      lastError = error;
    }

    if (aborted(signal)) return { status: "aborted", attempts: attempt };
    try {
      const afterSync = await readUser();
      if (isAuthoritativeTrialEntitlement(afterSync)) {
        return { status: "confirmed", attempts: attempt, user: afterSync };
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < maxAttempts) await wait(intervalMs, signal);
  }

  return {
    status: "timeout",
    attempts: maxAttempts,
    error: lastError instanceof Error ? lastError : null,
  };
}
