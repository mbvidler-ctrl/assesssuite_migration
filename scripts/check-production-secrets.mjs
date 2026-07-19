// Preflight: assert every required Fly secret is set on the target app BEFORE a
// production deploy. Catches the class of defect where a freshly-created app
// (or a newly-added integration) is deployed without a secret it needs — e.g.
// OPENAI_API_KEY, which was live on the demo app (unimatter-demo) but never
// propagated to assesssuite-production, so every AI surface silently served
// mock content in production until 16 July 2026.
//
// Names only — never values. A secret's presence is necessary, not sufficient
// (a wrong value still fails at runtime); this catches the most common and most
// silent failure mode: a required secret entirely absent.
//
// Usage:  node scripts/check-production-secrets.mjs [app-name]
//         npm run check:prod-secrets
//         npm run deploy:prod   (runs this as a hard gate before `fly deploy`)

import { execFileSync } from 'node:child_process';

const app = process.argv[2] || process.env.FLY_APP || 'assesssuite-production';

const REQUIRED = [
  'ADMIN_PASSWORD',
  'APP_URL',
  'RESEND_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_MONTHLY',
  'STRIPE_PRICE_ID_ANNUAL',
  'OPENAI_API_KEY',
];

const FORBIDDEN_OPAQUE_OVERRIDES = [
  'DOCUMENT_EXTRACTION_ENABLED',
  'DOCUMENT_EXTRACTION_UNDER_13_ENABLED',
  'OPENAI_HEALTH_DATA_TERMS_CONFIRMED',
  'GENERAL_CLINICAL_LLM_ENABLED',
  'TRANSCRIPTION_ENABLED',
  'LEGAL_STATUS',
  'LEGAL_EFFECTIVE_DATE',
];

let raw;
try {
  raw = execFileSync('fly', ['secrets', 'list', '-a', app, '--json'], { encoding: 'utf8' });
} catch (err) {
  console.error(`[preflight] could not list secrets for "${app}" via flyctl.`);
  console.error(`[preflight] ${String(err.message).split('\n')[0]}`);
  console.error('[preflight] Ensure flyctl is installed and authenticated (`fly auth whoami`).');
  process.exit(2);
}

let present;
try {
  present = new Set(JSON.parse(raw).map((s) => s.Name || s.name));
} catch {
  console.error('[preflight] unexpected `fly secrets list --json` output; cannot verify.');
  process.exit(2);
}

const missing = REQUIRED.filter((name) => !present.has(name));
const forbidden = FORBIDDEN_OPAQUE_OVERRIDES.filter((name) => present.has(name));
if (missing.length) {
  console.error(`\n[preflight] FAIL — ${missing.length} required secret(s) missing on "${app}":`);
  for (const name of missing) console.error(`  - ${name}`);
  console.error(`\nSet each with:  fly secrets set <NAME>=<value> -a ${app}`);
  console.error('Deploy is BLOCKED until these are set.\n');
  process.exit(1);
}
if (forbidden.length) {
  console.error(`\n[preflight] FAIL — ${forbidden.length} reviewed non-secret setting(s) are overridden by opaque Fly secrets:`);
  for (const name of forbidden) console.error(`  - ${name}`);
  process.exit(1);
}

console.log(`[preflight] OK — all ${REQUIRED.length} required secrets present on "${app}".`);
