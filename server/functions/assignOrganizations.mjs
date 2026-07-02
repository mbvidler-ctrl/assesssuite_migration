// Ported from base44/functions/assignOrganizations/entry.ts.
//
// Admin-only maintenance function: ensures every User has an Organization
// (creating one, plus an owner OrganizationMember row, where missing), and
// backfills account_status to 'active' for users who already have an org.

export default async function assignOrganizations(ctx) {
  const { user, entities, respond } = ctx;

  if (user?.role !== 'admin') {
    return respond(403, { error: 'Forbidden: Admin access required' });
  }

  const allUsers = await entities.User.list();
  const allOrgMembers = await entities.OrganizationMember.list();

  const results = {
    total_users: allUsers.length,
    users_with_orgs: 0,
    users_without_orgs: 0,
    created_orgs: [],
    all_users_with_orgs: [],
    errors: [],
  };

  for (const currentUser of allUsers) {
    try {
      const existingMembership = allOrgMembers.find((m) => m.user_email === currentUser.email);

      if (existingMembership) {
        results.users_with_orgs++;
        results.all_users_with_orgs.push({
          email: currentUser.email,
          full_name: currentUser.full_name,
          org_id: existingMembership.org_id,
        });

        if (currentUser.account_status !== 'active') {
          await entities.User.update(currentUser.id, { account_status: 'active' });
        }
        continue;
      }

      const orgName =
        currentUser.clinic_name || currentUser.full_name || `${currentUser.email.split('@')[0]}'s Organization`;

      const org = await entities.Organization.create({ name: orgName });

      await entities.OrganizationMember.create({
        org_id: org.id,
        user_email: currentUser.email,
        role: 'owner',
        is_primary: true,
      });

      if (currentUser.account_status !== 'active') {
        await entities.User.update(currentUser.id, { account_status: 'active' });
      }

      results.users_without_orgs++;
      results.created_orgs.push({ email: currentUser.email, org_id: org.id, org_name: orgName });
      results.all_users_with_orgs.push({
        email: currentUser.email,
        full_name: currentUser.full_name,
        org_id: org.id,
      });
    } catch (error) {
      results.errors.push({ email: currentUser.email, error: error.message });
    }
  }

  return respond(200, results);
}
