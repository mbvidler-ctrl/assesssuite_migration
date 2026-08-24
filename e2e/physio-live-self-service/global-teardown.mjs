import {
  cleanupTransientEvidence,
  finalizeSelfServiceReceipt,
  readCleanupLedger,
  resolveSelfServiceConfiguration,
} from './self-service-contract.mjs';

export default function globalTeardown() {
  const configuration = resolveSelfServiceConfiguration(process.env);
  try {
    if (
      configuration.phase === 'finalize'
      && readCleanupLedger(configuration).state === 'completed'
    ) {
      finalizeSelfServiceReceipt(process.env);
    }
  } finally {
    cleanupTransientEvidence(process.env);
  }
}
