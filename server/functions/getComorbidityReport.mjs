// Ported from base44/functions/getComorbidityReport/entry.ts.
// Admin-only: aggregates ClientCondition records, optionally scoped to a
// single clinician's clients via the `userEmail` request body field.

export default async function getComorbidityReport(ctx) {
  const { user, entities, body, respond } = ctx;

  if (user?.role !== 'admin') {
    return respond(403, { error: 'Forbidden: Admin access required' });
  }

  const { userEmail } = body || {};

  let clientIds = null;

  if (userEmail) {
    const allClients = await entities.Client.list();
    const userClients = allClients.filter(
      (c) => c.created_by === userEmail || c.assigned_clinician_email === userEmail,
    );
    clientIds = userClients.map((c) => c.id);

    if (clientIds.length === 0) {
      return respond(200, {
        total_comorbidities: 0,
        unique_comorbidities: 0,
        comorbidities: [],
        userEmail,
      });
    }
  }

  let allConditions;
  if (clientIds) {
    const allClientConditions = await entities.ClientCondition.list();
    allConditions = allClientConditions.filter((c) => clientIds.includes(c.client_id));
  } else {
    allConditions = await entities.ClientCondition.list();
  }

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
      medication: condition.medication,
    });
  }

  const sortedComorbidities = Object.entries(comorbidityCount)
    .map(([name, count]) => ({ name, count, clients: clientsByComorbidity[name] }))
    .sort((a, b) => b.count - a.count);

  return respond(200, {
    total_comorbidities: allConditions.length,
    unique_comorbidities: sortedComorbidities.length,
    comorbidities: sortedComorbidities,
    userEmail: userEmail || null,
  });
}
