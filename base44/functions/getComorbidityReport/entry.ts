import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get payload to check for userEmail filter
    const payload = await req.json().catch(() => ({}));
    const { userEmail } = payload;

    let clientIds = null;
    
    // If userEmail provided, get their clients first
    if (userEmail) {
      const allClients = await base44.asServiceRole.entities.Client.list();
      console.log(`Total clients in system: ${allClients.length}`);
      console.log(`Looking for clients with created_by or assigned_clinician_email = ${userEmail}`);
      
      const userClients = allClients.filter(c => 
        c.created_by === userEmail || c.assigned_clinician_email === userEmail
      );
      console.log(`Found ${userClients.length} clients for user ${userEmail}`);
      
      clientIds = userClients.map(c => c.id);
      console.log(`Client IDs: ${JSON.stringify(clientIds)}`);
      
      if (clientIds.length === 0) {
        return Response.json({
          total_comorbidities: 0,
          unique_comorbidities: 0,
          comorbidities: [],
          userEmail
        });
      }
    }

    // Fetch all client conditions (both primary and comorbidity)
    let allConditions;
    if (clientIds) {
      // Fetch all conditions and filter in memory since we need to check multiple client_ids
      const allClientConditions = await base44.asServiceRole.entities.ClientCondition.list();
      console.log(`Total client conditions in system: ${allClientConditions.length}`);
      allConditions = allClientConditions.filter(c => clientIds.includes(c.client_id));
      console.log(`Filtered client conditions for user's clients: ${allConditions.length}`);
    } else {
      allConditions = await base44.asServiceRole.entities.ClientCondition.list();
    }

    // Aggregate data
    const comorbidityCount = {};
    const clientsByComorbidity = {};

    for (const condition of allConditions) {
      const name = condition.condition_name;
      if (!comorbidityCount[name]) {
        comorbidityCount[name] = 0;
        clientsByComorbidity[name] = [];
      }
      comorbidityCount[name]++;
      clientsByComorbidity[name].push({
        client_id: condition.client_id,
        diagnosis_date: condition.diagnosis_date,
        medication: condition.medication
      });
    }

    // Sort by count
    const sortedComorbidities = Object.entries(comorbidityCount)
      .map(([name, count]) => ({
        name,
        count,
        clients: clientsByComorbidity[name]
      }))
      .sort((a, b) => b.count - a.count);

    return Response.json({
      total_comorbidities: allConditions.length,
      unique_comorbidities: sortedComorbidities.length,
      comorbidities: sortedComorbidities,
      userEmail: userEmail || null
    });
  } catch (error) {
    console.error('Error generating comorbidity report:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});