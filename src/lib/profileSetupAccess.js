/**
 * Resolve the only route an authenticated user may take before ProfileSetup.
 * Layout deliberately bypasses ProfileSetup to avoid a self-navigation loading
 * loop, so the page repeats the payment/status guard before it reads practice
 * membership or permits any profile/legal mutation.
 */
export function profileSetupRedirectForUser(user) {
  if (!user || typeof user !== 'object') return '/Login';
  if (user.role === 'admin') return '/Dashboard';

  if (user.account_status === 'deactivated') return '/AccountDeactivated';
  if (user.account_status === 'suspended' || user.account_status === 'rejected') {
    return '/PendingApproval';
  }
  if (user.account_status !== 'active' || user.subscription_status !== 'active') {
    return '/PaymentRequired';
  }
  return null;
}
