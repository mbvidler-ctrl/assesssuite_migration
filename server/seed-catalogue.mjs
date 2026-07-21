// Production seed entrypoint: catalogues ONLY (Assessment / Exercise /
// TreatmentProtocol), only-if-empty. Creates no synthetic organisations,
// users, clients, or legal acceptances, and writes no credential files —
// the clean-slate launch database. Run once against the production volume:
//
//   fly ssh console -a <app> -C "node server/seed-catalogue.mjs"
//
// (or locally: node server/seed-catalogue.mjs). Idempotent; safe to re-run.
import { openDatabase } from './db.mjs';
import { runCatalogueSeed } from './seed.mjs';

const { db, entityNames } = openDatabase();
runCatalogueSeed({ db, entityNames });
