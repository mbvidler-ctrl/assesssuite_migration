const PHYSIO_PRODUCTION_FUNCTION_PARAGRAPH =
  'The restricted AssessSuite Physio Revision 3 production release approves the surfaced clinical AI, assessment interpretation and recommendation, management-protocol and medication-consideration generation, AI-assisted report drafting, document extraction, audio transcription, and finance and billing functions when the running production release reports the applicable real provider and capability as ready. Provider failures must be explicit; invented, mock or placeholder output is not authorised. Direct-patient accounts and functions absent from the verified production release remain excluded.';

const PHYSIO_FUNCTION_NOTICE =
  'The restricted AssessSuite Physio Revision 3 production release authorises real-patient use of the surfaced production functions below when the running exact release reports the applicable provider and capability as ready. Each output remains a draft or decision-support input until the treating physiotherapist reviews and adopts it. A provider failure must be shown as an operational error and must never be replaced by mock or invented output.';

const EXACT_PHYSIO_REPLACEMENTS = Object.freeze([
  [
    'RC-2026.07.19 does not approve general clinical text generation, clinical recommendation or prediction, treatment-protocol or medication-consideration generation, AI report drafting, audio recording or transcription, direct-patient accounts, under-13 provider egress, the Finances module or any unlisted AI function. Those functions remain disabled or excluded unless a separately approved Order Form identifies the exact function and an immutable release manifest proves the applicable regulatory, privacy, security and clinical controls.',
    PHYSIO_PRODUCTION_FUNCTION_PARAGRAPH,
  ],
  [
    'The Finances or patient-service payment module is excluded from the initial Service unless the Order Form expressly activates it after a complete privacy, access, retention, export and commercial review.',
    'The finance, subscription and patient-service payment modules may be used by authorised restricted-release users when the running production release reports the applicable Stripe provider, entitlement and webhook capabilities as ready.',
  ],
  [
    'Recording and transcription remain disabled unless every principal party gives a separate time-stamped express-consent event before capture or transmission.',
    'Recording and transcription may be used when every principal party gives a separate time-stamped express-consent event before capture or transmission.',
  ],
  [
    'Clinical functions may be used only in the Approved Production Mode identified in the applicable Order Form (including the Standard Online Order defined in the Practitioner and Clinic SaaS Terms), immutable release manifest and Regulatory Status and Funder Rules Schedule. Demo, synthetic-data, beta, disabled or unclassified functions must not be used for real patient care.\n\nThe following functions require specific regulatory and clinical release approval before production use:',
    `${PHYSIO_FUNCTION_NOTICE}\n\nThe approved surfaced functions include:`,
  ],
  [
    'It does not authorise a function that is marked disabled, test-only or awaiting TGA, privacy, security or clinical approval.',
    'For the restricted AssessSuite Physio Revision 3 production release, surfaced provider-backed functions are authorised only when the running exact release reports them ready; test-only, mock and unclassified functions remain unauthorised.',
  ],
  [
    'The initial clinical Service is for Australian exercise physiology practices and practitioners holding current Accredited Exercise Physiologist accreditation with Exercise & Sports Science Australia. AEP accreditation is not described as statutory registration.',
    'The restricted clinical Service is for Australian physiotherapy practices and practitioners holding current registration as a physiotherapist with the Physiotherapy Board of Australia through Ahpra.',
  ],
  [
    'AssessSuite Clinical is initially intended for Australian practitioners with current Accredited Exercise Physiologist accreditation from Exercise & Sports Science Australia and for authorised practice staff acting within assigned roles. AEPs are self-regulated and ESSA-accredited; this notice does not describe them as Ahpra-registered practitioners.',
    'AssessSuite Physio is intended for Australian practitioners holding current registration as a physiotherapist with the Physiotherapy Board of Australia through Ahpra, and for authorised practice staff acting within assigned roles.',
  ],
  [
    'We may verify professional information with ESSA, a public register, your practice or another authorised source.',
    'We may verify professional information through the Ahpra public register, your practice or another authorised source.',
  ],
]);

/**
 * The controlled source suite remains shared with EP. Physio production gets a
 * deterministic presentation layer so browser content and server-bound legal
 * fingerprints carry the same profession identity and Revision 3 function
 * position without mutating the EP release text.
 */
export function applyProfessionLegalContent(content, professionId) {
  if (professionId !== 'physio' || typeof content !== 'string') return content;
  let output = content;
  for (const [from, to] of EXACT_PHYSIO_REPLACEMENTS) output = output.replaceAll(from, to);

  /** @type {Array<[RegExp, string]>} */
  const replacements = [
    [/AssessSuite Clinical/g, 'AssessSuite Physio'],
    [/Australian AEP practices/g, 'Australian physiotherapy practices'],
    [/AEP practice customers/g, 'physiotherapy practice customers'],
    [/AEP practices/g, 'physiotherapy practices'],
    [/ESSA accreditation status and number/g, 'Ahpra registration status and number'],
    [/ESSA accreditation/g, 'Ahpra registration'],
    [/Exercise & Sports Science Australia/g, 'the Australian Health Practitioner Regulation Agency (Ahpra)'],
    [/Accredited Exercise Physiologists/g, 'registered physiotherapists'],
    [/Accredited Exercise Physiologist/g, 'registered physiotherapist'],
    [/Exercise Physiologists/g, 'Physiotherapists'],
    [/Exercise Physiologist/g, 'Physiotherapist'],
    [/Exercise Physiology/g, 'Physiotherapy'],
    [/exercise physiology/g, 'physiotherapy'],
    [/\bAEPs\b/g, 'physiotherapists'],
    [/\bAEP\b/g, 'physiotherapist'],
    [/\bESSA\b/g, 'Ahpra or the Physiotherapy Board of Australia'],
  ];
  for (const [pattern, replacement] of replacements) output = output.replace(pattern, replacement);
  return output;
}
