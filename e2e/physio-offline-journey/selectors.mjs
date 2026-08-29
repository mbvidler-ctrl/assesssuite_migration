const credentialFieldSelector = '#password';

export const physioOfflineSelectors = Object.freeze({
  registration: Object.freeze({
    fullName: '#fullName',
    email: '#email',
    password: credentialFieldSelector,
    confirmation: '#confirm',
    verificationCode: '#otp',
  }),
  invitation: Object.freeze({
    fullName: '#fullName',
    password: credentialFieldSelector,
    confirmation: '#confirmPassword',
  }),
  profile: Object.freeze({
    clinicianName: '#clinician_name',
    qualifications: '#qualifications',
    registrationNumber: '#registration_number',
    clinicName: '#clinic_name',
    clinicAddress: '#clinic_address',
    clinicPhone: '#clinic_phone',
    clinicEmail: '#clinic_email',
    consent: '#consent-accepted',
  }),
  client: Object.freeze({
    fullName: '#full_name',
    dateOfBirth: '#date_of_birth',
    phone: '#phone',
    email: '#email',
  }),
  redFlag: Object.freeze({
    negativeAnswers: '[id^="physio_screen_"][id$="_no"]',
    noRedFlagsOutcome: '#physio_screen_outcome_none',
    clinicalReasoning: '#physio_screen_clinical_reasoning',
  }),
  subjective: Object.freeze({
    presentingComplaint: '#physio_subj_presenting_complaint',
    bodyChartArea: '#physio_subj_body_chart_area',
    mechanism: '#physio_subj_mechanism_of_onset',
    duration: '#physio_subj_duration',
    goals: '#physio_subj_patient_goals',
  }),
  objective: Object.freeze({
    observation: '#physio_obj_observation_posture',
    functionalTests: '#physio_obj_functional_tests',
    impression: '#physio_obj_diagnosis_clinical_impression',
  }),
  ai: Object.freeze({
    additionalContext: '#physio-ai-additional-context',
    editableDraft: '#physio-ai-editable-draft',
  }),
  librarySearchPlaceholder: 'Search assessments by name, description, conditions, or tags...',
});

export function cardByTitle(page, title) {
  return page.getByText(title, { exact: true }).locator('xpath=ancestor::*[self::div or self::section][.//button][1]');
}
