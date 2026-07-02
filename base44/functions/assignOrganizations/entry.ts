import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Admin only
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Get all users
        const allUsers = await base44.asServiceRole.entities.User.list();
        
        // Get all organization members
        const allOrgMembers = await base44.asServiceRole.entities.OrganizationMember.list();
        
        const results = {
            total_users: allUsers.length,
            users_with_orgs: 0,
            users_without_orgs: 0,
            created_orgs: [],
            all_users_with_orgs: [],
            errors: []
        };

        for (const currentUser of allUsers) {
            try {
                // Check if user already has an organization
                const existingMembership = allOrgMembers.find(m => m.user_email === currentUser.email);
                
                if (existingMembership) {
                    results.users_with_orgs++;
                    results.all_users_with_orgs.push({
                        email: currentUser.email,
                        full_name: currentUser.full_name,
                        org_id: existingMembership.org_id
                    });
                    
                    // Also ensure account_status is set to active if it's not already
                    if (currentUser.account_status !== 'active') {
                        await base44.asServiceRole.entities.User.update(currentUser.id, {
                            account_status: 'active'
                        });
                    }
                    continue;
                }

                // User doesn't have an org, create one
                const orgName = currentUser.clinic_name || currentUser.full_name || currentUser.email.split('@')[0] + "'s Organization";
                
                const org = await base44.asServiceRole.entities.Organization.create({
                    name: orgName
                });

                await base44.asServiceRole.entities.OrganizationMember.create({
                    org_id: org.id,
                    user_email: currentUser.email,
                    role: "owner",
                    is_primary: true
                });

                // Also ensure account_status is set to active
                if (currentUser.account_status !== 'active') {
                    await base44.asServiceRole.entities.User.update(currentUser.id, {
                        account_status: 'active'
                    });
                }

                results.users_without_orgs++;
                results.created_orgs.push({
                    email: currentUser.email,
                    org_id: org.id,
                    org_name: orgName
                });
                results.all_users_with_orgs.push({
                    email: currentUser.email,
                    full_name: currentUser.full_name,
                    org_id: org.id
                });

            } catch (error) {
                results.errors.push({
                    email: currentUser.email,
                    error: error.message
                });
            }
        }

        return Response.json(results);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});