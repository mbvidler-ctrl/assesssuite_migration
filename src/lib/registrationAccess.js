export const REGISTRATION_ACCESS_MODES = Object.freeze({
  OPEN: 'open',
  INVITATION_ONLY: 'invitation_only',
  UNAVAILABLE: 'unavailable',
});

/**
 * Determines the UI surface from two independent facts: the sealed build
 * identity and the public posture emitted by the app-scoped server. An EP
 * build never assumes that self-registration is available if the response is
 * stale, unavailable, or malformed. A Physio build is permanently rendered
 * as its invitation flow, even if it receives an unexpected cross-product
 * payload.
 */
export function resolveRegistrationAccessMode(professionId, appPublicSettings) {
  if (professionId === 'physio') return REGISTRATION_ACCESS_MODES.INVITATION_ONLY;
  if (professionId !== 'exercise-physiology') return REGISTRATION_ACCESS_MODES.UNAVAILABLE;

  const registration = appPublicSettings?.public_settings?.registration;
  if (registration?.mode === REGISTRATION_ACCESS_MODES.OPEN && registration?.open === true) {
    return REGISTRATION_ACCESS_MODES.OPEN;
  }
  return REGISTRATION_ACCESS_MODES.UNAVAILABLE;
}
