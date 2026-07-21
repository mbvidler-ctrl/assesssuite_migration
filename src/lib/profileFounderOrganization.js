import { base44 } from '@/api/base44Client';

/**
 * Ask the authenticated server to atomically ensure the founding practice and
 * its owner/primary membership. No identity, role or membership fields cross
 * this browser boundary.
 */
export async function ensureFounderOrganization({ clinicName }) {
  // This server-owned integration is added by the migration runtime and is
  // therefore newer than the generated Base44 client declaration bundled in
  // this repository.
  const coreIntegrations = /** @type {any} */ (base44.integrations.Core);
  const result = await coreIntegrations.EnsureFounderOrganization({
    clinic_name: clinicName,
  });
  if (
    !result ||
    typeof result.id !== 'string' ||
    result.id.length === 0 ||
    typeof result.name !== 'string' ||
    result.name.length === 0
  ) {
    throw new Error('Practice creation returned an invalid response.');
  }
  return { id: result.id, name: result.name };
}
