import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all users
    const allUsers = await base44.asServiceRole.entities.User.list();
    const results = [];

    for (const targetUser of allUsers) {
      // Check if user has organization membership
      const memberships = await base44.asServiceRole.entities.OrganizationMember.filter({ 
        user_email: targetUser.email 
      });

      let userOrgId;

      if (memberships.length === 0) {
        // Create new organization for this user
        const newOrg = await base44.asServiceRole.entities.Organization.create({
          name: `${targetUser.full_name || targetUser.email}'s Clinic`
        });

        // Create membership
        await base44.asServiceRole.entities.OrganizationMember.create({
          org_id: newOrg.id,
          user_email: targetUser.email,
          role: 'owner',
          is_primary: true
        });

        userOrgId = newOrg.id;
        results.push({
          user: targetUser.email,
          action: 'created_new_org',
          org_id: newOrg.id
        });
      } else {
        // Check if sharing org with others
        const primaryMembership = memberships.find(m => m.is_primary) || memberships[0];
        userOrgId = primaryMembership.org_id;

        // Check if other users share this org
        const otherMembersInSameOrg = await base44.asServiceRole.entities.OrganizationMember.filter({
          org_id: userOrgId
        });

        if (otherMembersInSameOrg.length > 1) {
          // Multiple users in same org - create separate org for this user
          const newOrg = await base44.asServiceRole.entities.Organization.create({
            name: `${targetUser.full_name || targetUser.email}'s Clinic`
          });

          // Update membership to new org
          await base44.asServiceRole.entities.OrganizationMember.update(primaryMembership.id, {
            org_id: newOrg.id
          });

          // Update all clients created by this user to new org
          const userClients = await base44.asServiceRole.entities.Client.list();
          const clientsToUpdate = userClients.filter(c => 
            c.created_by === targetUser.email || c.assigned_clinician_email === targetUser.email
          );

          for (const client of clientsToUpdate) {
            await base44.asServiceRole.entities.Client.update(client.id, {
              org_id: newOrg.id
            });
          }

          // Update appointments
          const allAppointments = await base44.asServiceRole.entities.Appointment.list();
          const appointmentsToUpdate = allAppointments.filter(apt => 
            clientsToUpdate.some(c => c.id === apt.client_id)
          );

          for (const apt of appointmentsToUpdate) {
            await base44.asServiceRole.entities.Appointment.update(apt.id, {
              org_id: newOrg.id
            });
          }

          // Update client conditions
          const allConditions = await base44.asServiceRole.entities.ClientCondition.list();
          const conditionsToUpdate = allConditions.filter(cond =>
            clientsToUpdate.some(c => c.id === cond.client_id)
          );

          for (const cond of conditionsToUpdate) {
            await base44.asServiceRole.entities.ClientCondition.update(cond.id, {
              org_id: newOrg.id
            });
          }

          // Update SOAP notes
          const allNotes = await base44.asServiceRole.entities.SOAPNote.list();
          const notesToUpdate = allNotes.filter(note =>
            clientsToUpdate.some(c => c.id === note.client_id)
          );

          for (const note of notesToUpdate) {
            await base44.asServiceRole.entities.SOAPNote.update(note.id, {
              org_id: newOrg.id
            });
          }

          results.push({
            user: targetUser.email,
            action: 'separated_from_shared_org',
            old_org_id: userOrgId,
            new_org_id: newOrg.id,
            clients_moved: clientsToUpdate.length,
            appointments_moved: appointmentsToUpdate.length,
            conditions_moved: conditionsToUpdate.length,
            notes_moved: notesToUpdate.length
          });
        } else {
          results.push({
            user: targetUser.email,
            action: 'already_has_own_org',
            org_id: userOrgId
          });
        }
      }
    }

    return Response.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error fixing user organizations:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});