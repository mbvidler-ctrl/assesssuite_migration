import { makeAppConfig } from '../_shared/makeAppConfig.mjs';

// The marketing build has no backend relay and cannot reach the clinical API.
export default makeAppConfig({
  appDir: import.meta.dirname,
  port: 4001,
});
