/**
 * Return one fail-closed acceptance audience for every distinct practice
 * membership. A conflicting duplicate is treated as owner-scoped (the
 * stricter bundle), and primary practices retain first position.
 */
export function resolveLegalConsentAudiences(memberships) {
  const rows = Array.isArray(memberships) ? memberships.filter(Boolean) : [];
  const byOrganization = new Map();

  rows.forEach((row, index) => {
    if (typeof row?.org_id !== "string" || row.org_id.length === 0) return;
    const current = byOrganization.get(row.org_id);
    if (!current) {
      byOrganization.set(row.org_id, {
        orgId: row.org_id,
        ownerBundle: row.role === "owner",
        willCreateOrganization: false,
        isPrimary: row.is_primary === true,
        sourceIndex: index,
      });
      return;
    }
    current.ownerBundle = current.ownerBundle || row.role === "owner";
    current.isPrimary = current.isPrimary || row.is_primary === true;
  });

  return [...byOrganization.values()]
    .sort((left, right) => (
      Number(right.isPrimary) - Number(left.isPrimary) || left.sourceIndex - right.sourceIndex
    ))
    .map((audience) => ({
      orgId: audience.orgId,
      ownerBundle: audience.ownerBundle,
      willCreateOrganization: false,
    }));
}

export function resolveLegalConsentAudience(memberships, preferredOrgId = null) {
  const audiences = resolveLegalConsentAudiences(memberships);
  const audience = (
    typeof preferredOrgId === "string" && preferredOrgId.length > 0
      ? audiences.find((item) => item.orgId === preferredOrgId)
      : null
  ) || audiences[0] || null;
  if (!audience) {
    return {
      orgId: null,
      ownerBundle: true,
      willCreateOrganization: true,
    };
  }
  return audience;
}
