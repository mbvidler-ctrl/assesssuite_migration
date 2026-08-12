// Keep this as the first application import. Sentry must initialize before
// node:http and the application modules are evaluated so its ESM/OpenTelemetry
// hooks can instrument incoming requests, outbound calls and dependencies.
// Configuration and SDK failures are intentionally fail-open in the factory.
import { createErrorTelemetry } from './telemetry.mjs';

export const errorTelemetry = createErrorTelemetry({ environment: process.env });
export { browserProfilingDocumentPolicyHeaders } from './telemetry.mjs';
