export function resolveLegalConsentAudience(memberships) {
  const rows = Array.isArray(memberships) ? memberships.filter(Boolean) : [];
  const membership = rows.find((row) => row.is_primary === true) || rows[0] || null;
  if (!membership) {
    return {
      orgId: null,
      ownerBundle: true,
      willCreateOrganization: true,
    };
  }
  return {
    orgId: membership.org_id || null,
    ownerBundle: membership.role === "owner",
    willCreateOrganization: false,
  };
}
