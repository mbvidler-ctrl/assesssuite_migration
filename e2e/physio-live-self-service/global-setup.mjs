import fs from 'node:fs';
import path from 'node:path';

import {
  assertInputLedgerHash,
  assertPaymentValidationLedgerSnapshot,
  assertProvisionLedgerSnapshot,
  createCleanupLedger,
  readCleanupLedger,
  readPaymentValidationReceipt,
  readProvisionReceipt,
  resolveSelfServiceConfiguration,
  writeCleanupLedger,
  writeProvisionAttemptReceipt,
} from './self-service-contract.mjs';
import { readEmailConfigurationReceipt } from './email-provider-readback.mjs';

export default function globalSetup() {
  const configuration = resolveSelfServiceConfiguration(process.env);
  fs.mkdirSync(configuration.evidenceDirectory, { recursive: true });
  if (configuration.phase === 'provision') {
    for (const filename of [
      configuration.cleanupLedgerPath,
      configuration.provisionAttemptReceiptPath,
      configuration.provisionInitialLedgerPath,
      configuration.provisionReceiptPath,
      configuration.provisionLedgerPath,
      configuration.runtimeEmailReadinessReceiptPath,
      configuration.registrationEmailReadbackReceiptPath,
      configuration.emailConfigurationReceiptPath,
      configuration.paymentValidationReceiptPath,
      configuration.paymentValidationLedgerPath,
      configuration.trustedBrowserAdmissionPath,
      configuration.trustedBrowserHandoffPath,
      configuration.finalFragmentPath,
      configuration.finalReceiptPath,
      path.join(configuration.evidenceDirectory, 'SHA256SUMS'),
      path.join(configuration.evidenceDirectory, 'PROVISION-SHA256SUMS'),
      path.join(configuration.evidenceDirectory, 'PROVISION-ATTEMPT-SHA256SUMS'),
      path.join(configuration.evidenceDirectory, 'PAYMENT-VALIDATION-SHA256SUMS'),
    ]) {
      if (fs.existsSync(filename)) {
        throw new TypeError(
          'Provision refuses an existing sequence artifact; use cleanup-only reconciliation, never replay creation',
        );
      }
    }
  } else if (configuration.phase === 'finalize') {
    readProvisionReceipt(configuration);
    assertProvisionLedgerSnapshot(configuration);
    const paymentValidationReceipt = readPaymentValidationReceipt(configuration);
    readEmailConfigurationReceipt(configuration, {
      expectedReceiptSha256:
        paymentValidationReceipt.email_configuration_receipt_sha256,
      expectedProvisionReceiptSha256: configuration.expectedProvisionReceiptSha256,
    });
    assertPaymentValidationLedgerSnapshot(configuration);
    assertInputLedgerHash(configuration, configuration.paymentValidationLedgerSha256);
    const ledger = readCleanupLedger(configuration);
    if (ledger.state !== 'provisioned-awaiting-functional-qa') {
      throw new TypeError('Finalize requires the exact provisioned-awaiting-functional-QA ledger');
    }
    for (const filename of [
      configuration.finalFragmentPath,
      configuration.finalReceiptPath,
      path.join(configuration.evidenceDirectory, 'SHA256SUMS'),
    ]) {
      if (fs.existsSync(filename)) {
        throw new TypeError('Finalize refuses an existing final artifact; use cleanup-only resume');
      }
    }
  }
  fs.rmSync(path.join(configuration.evidenceDirectory, 'artifacts'), {
    recursive: true,
    force: true,
  });
  if (configuration.phase === 'provision') {
    const ledger = createCleanupLedger(configuration, new Date().toISOString());
    writeCleanupLedger(configuration, ledger);
    writeProvisionAttemptReceipt(configuration, ledger);
  }
}
