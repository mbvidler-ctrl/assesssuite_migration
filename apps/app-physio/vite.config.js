import path from 'node:path';
import { makeAppConfig } from '../_shared/makeAppConfig.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

// The Physio shell is composed explicitly. makeAppConfig validates this exact
// profession/app-id/port tuple against the registered target and refuses any
// mismatch before Vite starts. Tests which stop and reopen Vite use the
// factory so each process receives fresh plugin/config state.
export function createPhysioViteConfig() {
  return makeAppConfig({
    appDir: import.meta.dirname,
    professionId: 'physio',
    appId: 'local-assesssuite-physio',
    port: 4201,
    serverPort: 8788,
    outDir: path.join(repoRoot, 'dist'),
    sourcemap: 'hidden',
  });
}

export default createPhysioViteConfig();
