import { installTestProviderServices } from './install-provider-services.mjs';
import { testProviderServices } from './provider-services.mjs';

installTestProviderServices(testProviderServices, process.env);
await import('../../index.mjs');
