function assertProfileProfessionManifest(profession) {
  if (
    !profession
    || typeof profession !== 'object'
    || !Array.isArray(profession.releaseProfessions)
    || !profession.signup
    || typeof profession.signup !== 'object'
  ) {
    throw new TypeError('profile profession helpers require an active profession manifest');
  }
}

/**
 * Build the complete profession selector from the active target manifest.
 * The manifest schema guarantees this list exactly matches releaseProfessions.
 */
export function profileProfessionOptions(profession) {
  assertProfileProfessionManifest(profession);
  return [
    {
      value: profession.signup.clinicalProfessionValue,
      label: profession.signup.clinicalProfessionLabel,
    },
    ...profession.signup.managementRoles.map((role) => ({
      value: role,
      label: role,
    })),
  ];
}

export function isProfileProfessionAllowed(profession, value) {
  assertProfileProfessionManifest(profession);
  return typeof value === 'string' && profession.releaseProfessions.includes(value);
}

export function isManagementProfileProfession(profession, value) {
  assertProfileProfessionManifest(profession);
  return typeof value === 'string' && profession.signup.managementRoles.includes(value);
}
