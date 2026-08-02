import path from 'node:path';
import { makeAppConfig } from '../_shared/makeAppConfig.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

// The authenticated application and API continue to share one Fly origin.
export default makeAppConfig({
  appDir: import.meta.dirname,
  port: 4101,
  serverPort: 8787,
  outDir: path.join(repoRoot, 'dist'),
  // Hidden maps are retained only in the isolated release workspace for
  // Sentry upload. The Dockerfile removes them from the runnable image.
  sourcemap: 'hidden',
});
