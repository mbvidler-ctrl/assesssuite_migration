import { harnessState } from './harness-state.js';

function recordWrite(entity, operation, payload) {
  harnessState.calls.writes.push({ entity, operation, payload: { ...payload } });
}

function createEntity(entity, idPrefix) {
  return {
    async create(payload) {
      recordWrite(entity, 'create', payload);
      return { id: `${idPrefix}-${harnessState.calls.writes.length}`, ...payload };
    },
  };
}

export const base44 = {
  auth: {
    async me() {
      harnessState.calls.auth.push({ operation: 'me' });
      return { ...harnessState.user };
    },
  },
  entities: {
    OrganizationMember: {
      async filter(query) {
        harnessState.calls.memberships.push({ ...query });
        return harnessState.memberships.map((membership) => ({ ...membership }));
      },
    },
    Organization: {
      async get(id) {
        harnessState.calls.organizations.push({ id });
        const organization = harnessState.organizations[id];
        if (!organization) throw new Error('Synthetic organization not found');
        return { ...organization };
      },
    },
    LegalAcceptanceEvent: {
      async filter() {
        return [];
      },
    },
    Client: {
      async filter(query) {
        harnessState.calls.clientQueries.push({ ...query });
        return harnessState.clients
          .filter((client) => !query?.org_id || client.org_id === query.org_id)
          .map((client) => ({ ...client }));
      },
      async create(payload) {
        recordWrite('Client', 'create', payload);
        return { id: 'synthetic-client-created', ...payload };
      },
      async update(id, payload) {
        recordWrite('Client', 'update', { id, ...payload });
        return { id, ...payload };
      },
    },
    ClientCondition: createEntity('ClientCondition', 'synthetic-condition'),
    ClientDocument: createEntity('ClientDocument', 'synthetic-document'),
    ClientAssessment: createEntity('ClientAssessment', 'synthetic-assessment'),
  },
  functions: {
    async invoke(name, payload) {
      harnessState.calls.functions.push({
        name,
        payload: JSON.parse(JSON.stringify(payload)),
      });
      if (harnessState.scenario === 'commit-retry' && harnessState.calls.functions.length === 1) {
        // The server committed and created its receipt, but the response was
        // lost. The helper must reconcile automatically with the same key.
        const error = new Error('Synthetic transport failure');
        throw error;
      }
      const clientId = payload.operation === 'update'
        ? payload.client_id
        : 'synthetic-client-created';
      return {
        data: {
          status: 'success',
          operation: payload.operation,
          client_id: clientId,
          counts: {
            conditions_created: payload.conditions.length,
            documents_retained: payload.upload_ids.length,
            historical_assessments_created: 0,
          },
        },
      };
    },
  },
};
