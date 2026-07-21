// deactivateAccount — self-service account deactivation (launch, 13 July 2026).
//
// Sets the CALLER'S OWN account_status to 'deactivated'. This is deliberately
// a dedicated function rather than an updateMe field: account_status is in
// UPDATE_ME_GUARDED_FIELDS (a user must never set an arbitrary status on
// themselves — that guard closed the self-activation hole), so the one
// permitted self-service transition gets its own narrow, explicit endpoint.
//
// Retention model (per the AssessSuite Records Retention policy and Max's
// direction): deactivation destroys NOTHING. The user's organisation, clients
// and clinical records are retained, org-scoped and encrypted at rest, for at
// least the professional retention period (adult clinical records: seven
// years). The server's entityAccessDenied gate already refuses clinical
// access for any non-active status, so no additional enforcement is needed
// here. Reactivation is an administrator action (AdminApprovals).
export default async function deactivateAccount(ctx) {
  const { user, entities, respond } = ctx;
  if (!user) {
    return respond(401, { error: 'authentication required' });
  }
  if (user.role === 'admin') {
    // The bootstrap admin deactivating itself would orphan the deployment
    // (approvals, reactivations and catalogue writes are admin-only).
    return respond(403, { error: 'an administrator account cannot self-deactivate' });
  }
  await entities.User.update(user.id, {
    account_status: 'deactivated',
    deactivated_date: new Date().toISOString(),
  });
  return respond(200, { status: 'deactivated' });
}
