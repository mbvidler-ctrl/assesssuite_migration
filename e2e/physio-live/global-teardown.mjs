import {
  cleanupTransientPhysioLiveQaEvidence,
  finalizePhysioLiveQaReceipt,
} from './live-qa-contract.mjs';

export default function globalTeardown() {
  try {
    finalizePhysioLiveQaReceipt(process.env);
  } finally {
    cleanupTransientPhysioLiveQaEvidence(process.env);
  }
}
