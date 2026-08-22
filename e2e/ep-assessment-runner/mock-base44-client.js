import { harnessState } from './harness-state.js';

function unexpectedProviderCall(surface) {
  return async (...args) => {
    harnessState.base44Calls.push({ surface, args });
    throw new Error(`Unexpected Base44 call from the embedded EP runner: ${surface}`);
  };
}

export const base44 = {
  auth: {
    me: unexpectedProviderCall('auth.me'),
  },
  entities: new Proxy({}, {
    get(_target, entityName) {
      return new Proxy({}, {
        get(_entityTarget, operation) {
          return unexpectedProviderCall(`entities.${String(entityName)}.${String(operation)}`);
        },
      });
    },
  }),
  functions: {
    invoke: unexpectedProviderCall('functions.invoke'),
  },
};
