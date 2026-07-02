import { base44 } from '@/api/base44Client';

// Legacy '@/functions/createCheckoutSession' shim. Functions responses are
// NOT unwrapped by the SDK's functions client — callers (e.g.
// src/pages/ProfileSetup.jsx) read the axios response's `.data`.
export const createCheckoutSession = (payload) => base44.functions.invoke('createCheckoutSession', payload);
