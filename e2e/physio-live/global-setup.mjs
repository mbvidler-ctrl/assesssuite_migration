import fs from 'node:fs';
import path from 'node:path';

import {
  PHYSIO_LIVE_QA_PROJECTS,
  resolvePhysioLiveQaConfiguration,
} from './live-qa-contract.mjs';

export default function globalSetup() {
  const configuration = resolvePhysioLiveQaConfiguration(process.env);
  fs.mkdirSync(configuration.evidenceDirectory, { recursive: true });

  const exactPriorOutputs = [
    ...PHYSIO_LIVE_QA_PROJECTS.map((project) => `physio-live-qa-${project}.json`),
    'physio-live-qa-receipt.json',
    'SHA256SUMS',
    'playwright-results.json',
  ];
  for (const name of exactPriorOutputs) {
    fs.rmSync(path.join(configuration.evidenceDirectory, name), { force: true });
  }
  fs.rmSync(path.join(configuration.evidenceDirectory, 'artifacts'), { recursive: true, force: true });
}
