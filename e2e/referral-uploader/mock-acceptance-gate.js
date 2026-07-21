export function selectedOrganizationLegalAcceptanceStatus({ orgId }) {
  return {
    accepted: Boolean(orgId),
    orgId: orgId || null,
    ownerBundle: true,
    missingDocumentIds: [],
    reason: null,
  };
}
