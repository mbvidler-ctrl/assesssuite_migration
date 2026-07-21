/**
 * Canonical schema for the referral-upload production journey.
 *
 * This is deliberately the only production definition of these fields. Keep
 * provider probes, canaries and the browser uploader pointed at this export so
 * an assurance path cannot silently exercise a narrower contract.
 */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const REFERRAL_EXTRACTION_SCHEMA = deepFreeze({
  type: 'object',
  additionalProperties: false,
  properties: {
    // Personal details
    full_name: { type: 'string', description: "Patient's full name" },
    date_of_birth: { type: 'string', format: 'date', description: 'Date of birth in YYYY-MM-DD format' },
    gender: { type: 'string', enum: ['male', 'female', 'other'], description: "Patient's gender" },
    phone: { type: 'string', description: 'Contact phone number' },
    email: { type: 'string', description: 'Email address' },
    address: { type: 'string', description: 'Home address' },

    // Referral source details
    referral_source: {
      type: 'string',
      enum: ['gp', 'wc_case_manager', 'aged_care_case_manager', 'ndis_support_coordinator', 'dva', 'self_referral', 'other'],
      description: 'Type of referral source',
    },
    referral_source_name: { type: 'string', description: 'Name of referring person/organization' },
    referral_source_address: { type: 'string', description: 'Address of referrer' },
    referral_source_email: { type: 'string', description: 'Email of referrer' },
    referral_provider_number: { type: 'string', description: 'Provider number of referring professional' },
    referral_reason: { type: 'string', description: 'Reason for referral' },
    referral_date: { type: 'string', format: 'date', description: 'Date of referral in YYYY-MM-DD format' },

    // Funding details
    funding_source: {
      type: 'string',
      enum: ['dva', 'private_health', 'medicare', 'self_funded', 'workcover_qld', 'ndis', 'tac_maic', 'aged_care', 'my_aged_care', 'other'],
      description: 'Primary funding source',
    },
    medicare_number: { type: 'string', description: 'Medicare card number' },
    medicare_irn: { type: 'string', description: 'Medicare IRN' },
    dva_card_number: { type: 'string', description: 'DVA card number' },
    dva_card_type: { type: 'string', enum: ['white', 'gold', 'gold_tpi'], description: 'DVA card type' },
    dva_file_number: { type: 'string', description: 'DVA file number' },
    dva_accepted_conditions: { type: 'string', description: 'DVA accepted conditions' },
    ndis_number: { type: 'string', description: 'NDIS participant number' },
    ndis_goals: { type: 'string', description: 'NDIS goals from plan' },
    private_health_fund_name: { type: 'string', description: 'Private health fund name' },
    private_health_fund_number: { type: 'string', description: 'Private health fund member number' },
    workcover_claim_number: { type: 'string', description: 'WorkCover claim number' },
    workcover_date_of_injury: { type: 'string', format: 'date', description: 'Date of workplace injury in YYYY-MM-DD format' },
    workcover_injury_description: { type: 'string', description: 'Description of workplace injury' },

    // Medical details
    primary_condition: { type: 'string', description: 'Primary diagnosis or condition' },
    comorbidities: { type: 'array', items: { type: 'string' }, description: 'List of other medical conditions' },
    medications: { type: 'array', items: { type: 'string' }, description: 'Current medications' },
    medical_history: { type: 'string', description: 'Relevant medical history' },

    // GP details
    primary_gp_name: { type: 'string', description: 'Primary GP name' },
    primary_gp_clinic_name: { type: 'string', description: 'GP clinic name' },
    primary_gp_address: { type: 'string', description: 'GP clinic address' },
    primary_gp_phone: { type: 'string', description: 'GP clinic phone' },
    primary_gp_email: { type: 'string', description: 'GP clinic email' },
    primary_gp_provider_number: { type: 'string', description: 'GP provider number' },

    // Goals and report classification
    client_goals: { type: 'string', description: "Client's goals or referrer's goals for treatment" },
    medicare_referral_type: { type: 'string', enum: ['tca', 'epc', 'cdm'], description: 'Medicare referral type' },
  },
});

export const REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS = Object.freeze(
  Object.keys(REFERRAL_EXTRACTION_SCHEMA.properties),
);

export const REFERRAL_EXTRACTION_SCHEMA_PROPERTY_COUNT = 39;

// SHA-256(JSON.stringify(REFERRAL_EXTRACTION_SCHEMA)). A Node assurance test
// recomputes this value, preventing an unreviewed field or semantic drift.
export const REFERRAL_EXTRACTION_SCHEMA_SHA256 = '0d6aac7327638f31dea44480fee0402f1e7dd62e2d2023c2f91a7846a2ffa815';

export default REFERRAL_EXTRACTION_SCHEMA;
