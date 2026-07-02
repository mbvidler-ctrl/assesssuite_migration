// Ported from base44/functions/fixUserOrganizations/entry.ts.
// Admin-only: ensures each user has their own Organization, splitting shared
// orgs and moving each user's Clients/Appointments/ClientConditions/SOAPNotes
// to their newly separated org where a shared org is detected.

export default async function fixUserOrganizations(ctx) {
  const { user, entities, respond } = ctx;

  if (user?.role !== 'admin') {
    return respond(403, { error: 'Forbidden: Admin access required' });
  }

  const allUsers = await entities.User.list();
  const results = [];

  for (const targetUser of allUsers) {
    const memberships = await entities.OrganizationMember.filter({ user_email: targetUser.email });

    let userOrgId;

    if (memberships.length === 0) {
      const newOrg = await entities.Organization.create({
        name: `${targetUser.full_name || targetUser.email}'s Clinic`,
      });

      await entities.OrganizationMember.create({
        org_id: newOrg.id,
        user_email: targetUser.email,
        role: 'owner',
        is_primary: true,
      });

      userOrgId = newOrg.id;
      results.push({ user: targetUser.email, action: 'created_new_org', org_id: newOrg.id });
    } else {
      const primaryMembership = memberships.find((m) => m.is_primary) || memberships[0];
      userOrgId = primaryMembership.org_id;

      const otherMembersInSameOrg = await entities.OrganizationMember.filter({ org_id: userOrgId });

      if (otherMembersInSameOrg.length > 1) {
        const newOrg = await entities.Organization.create({
          name: `${targetUser.full_name || targetUser.email}'s Clinic`,
        });

        await entities.OrganizationMember.update(primaryMembership.id, { org_id: newOrg.id });

        const userClients = await entities.Client.list();
        const clientsToUpdate = userClients.filter(
          (c) => c.created_by === targetUser.email || c.assigned_clinician_email === targetUser.email,
        );

        for (const client of clientsToUpdate) {
          await entities.Client.update(client.id, { org_id: newOrg.id });
        }

        const allAppointments = await entities.Appointment.list();
        const appointmentsToUpdate = allAppointments.filter((apt) =>
          clientsToUpdate.some((c) => c.id === apt.client_id),
        );

        for (const apt of appointmentsToUpdate) {
          await entities.Appointment.update(apt.id, { org_id: newOrg.id });
        }

        const allConditions = await entities.ClientCondition.list();
        const conditionsToUpdate = allConditions.filter((cond) =>
          clientsToUpdate.some((c) => c.id === cond.client_id),
        );

        for (const cond of conditionsToUpdate) {
          await entities.ClientCondition.update(cond.id, { org_id: newOrg.id });
        }

        const allNotes = await entities.SOAPNote.list();
        const notesToUpdate = allNotes.filter((note) => clientsToUpdate.some((c) => c.id === note.client_id));

        for (const note of notesToUpdate) {
          await entities.SOAPNote.update(note.id, { org_id: newOrg.id });
        }

        results.push({
          user: targetUser.email,
          action: 'separated_from_shared_org',
          old_org_id: userOrgId,
          new_org_id: newOrg.id,
          clients_moved: clientsToUpdate.length,
          appointments_moved: appointmentsToUpdate.length,
          conditions_moved: conditionsToUpdate.length,
          notes_moved: notesToUpdate.length,
        });
      } else {
        results.push({ user: targetUser.email, action: 'already_has_own_org', org_id: userOrgId });
      }
    }
  }

  return respond(200, { success: true, results });
}
