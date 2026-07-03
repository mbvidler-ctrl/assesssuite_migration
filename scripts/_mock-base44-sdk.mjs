// Test-only stand-in for 'npm:@base44/sdk@X.X.X', used by
// validate-entry-ts-guards.mjs to dry-run role-guard logic in
// base44/functions/*/entry.ts locally, without contacting the live
// Base44 platform. Reads scenario state fresh from globalThis.__mock on
// every call so one import can be reused across multiple functions and
// roles within a single process.
export function createClientFromRequest(_req) {
  const state = globalThis.__mock;
  return {
    auth: {
      async me() {
        if (!state.role) return null;
        return { role: state.role, email: state.email || 'test@example.com', id: 'mock-user-id' };
      },
    },
    entities: new Proxy(
      {},
      {
        get(_target, entityName) {
          const fx = (state.fixtures && state.fixtures[entityName]) || {};
          return {
            async filter() {
              return fx.filter ?? [];
            },
            async list() {
              return fx.list ?? [];
            },
            async get(_id) {
              return fx.get ?? null;
            },
            async create(data) {
              return fx.create ? fx.create(data) : { id: `mock-${entityName}-${Math.random().toString(36).slice(2)}`, ...data };
            },
            async update(id, data) {
              return fx.update ? fx.update(id, data) : { id, ...data };
            },
          };
        },
      },
    ),
  };
}
