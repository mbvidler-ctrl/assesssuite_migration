import {
  REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS,
} from '../../../src/lib/referralExtractionSchema.js';
import {
  csvFixture,
  pdfFixture,
  pngFixture,
} from './synthetic-fixtures.mjs';

export { csvFixture, pdfFixture, pngFixture };

export const CANONICAL_REFERRAL_PROFILE_A = Object.freeze({
  full_name: 'Alex River',
  date_of_birth: '1990-01-02',
  referral_source: 'gp',
  referral_source_name: 'Dr Synthetic',
  primary_condition: 'ankle sprain',
  comorbidities: Object.freeze(['asthma']),
  primary_gp_name: 'Dr Synthetic',
});

export const CANONICAL_REFERRAL_PROFILE_DOB_CHANGE = Object.freeze({
  ...CANONICAL_REFERRAL_PROFILE_A,
  date_of_birth: '1991-03-04',
});

/**
 * A deliberately synthetic but format-faithful referral containing a stated
 * value for every production field. Reserved identifier prefixes and the
 * example.invalid domain prevent accidental treatment as a real person.
 */
export const CANONICAL_REFERRAL_PROFILE_FULL_39 = Object.freeze({
  full_name: 'Alex River',
  date_of_birth: '1990-01-02',
  gender: 'female',
  phone: '+61 400 000 101',
  email: 'alex.river@example.invalid',
  address: '101 Synthetic Way, Brisbane QLD 4000',
  referral_source: 'gp',
  referral_source_name: 'Dr Casey Example',
  referral_source_address: '9 Referral Road, Brisbane QLD 4000',
  referral_source_email: 'casey.example@example.invalid',
  referral_provider_number: 'SYN-REF-0001',
  referral_reason: 'Allied health assessment following a workplace ankle injury',
  referral_date: '2026-07-20',
  funding_source: 'workcover_qld',
  medicare_number: 'SYN-MED-000001',
  medicare_irn: '1',
  dva_card_number: 'SYN-DVA-CARD-001',
  dva_card_type: 'gold',
  dva_file_number: 'SYN-DVA-FILE-001',
  dva_accepted_conditions: 'Synthetic ankle sprain; synthetic asthma',
  ndis_number: 'SYN-NDIS-000001',
  ndis_goals: 'Return to safe community walking and independent exercise',
  private_health_fund_name: 'Synthetic Health Fund',
  private_health_fund_number: 'SYN-PHF-000001',
  workcover_claim_number: 'SYN-WCQ-000001',
  workcover_date_of_injury: '2026-06-15',
  workcover_injury_description: 'Rolled the left ankle on a synthetic workplace step',
  primary_condition: 'Left ankle sprain',
  comorbidities: Object.freeze(['Asthma', 'Migraine']),
  medications: Object.freeze(['Salbutamol inhaler', 'Paracetamol 500 mg as needed']),
  medical_history: 'Synthetic appendicectomy in 2010; no other stated history',
  primary_gp_name: 'Dr Morgan Test',
  primary_gp_clinic_name: 'Synthetic Family Practice',
  primary_gp_address: '12 Example Street, Brisbane QLD 4000',
  primary_gp_phone: '+61 7 3000 0101',
  primary_gp_email: 'morgan.test@example.invalid',
  primary_gp_provider_number: 'SYN-GP-0001',
  client_goals: 'Walk five kilometres and return to full synthetic work duties',
  medicare_referral_type: 'cdm',
});

export const CANONICAL_REFERRAL_PROFILE_MULTI_PRIMARY = Object.freeze({
  full_name: 'Alex River',
  date_of_birth: '1990-01-02',
  phone: '0400 111 111',
  referral_source: 'gp',
  referral_source_name: 'Dr Primary',
  primary_condition: 'Ankle sprain',
  comorbidities: Object.freeze(['Asthma']),
  medications: Object.freeze(['Ibuprofen 200 mg']),
});

export const CANONICAL_REFERRAL_PROFILE_MULTI_ADDITIONAL = Object.freeze({
  full_name: 'Conflicting Synthetic Name',
  date_of_birth: '1980-05-06',
  phone: '0499 222 222',
  email: 'alex.river@example.invalid',
  referral_source: 'other',
  referral_source_name: 'Conflicting Referrer',
  primary_condition: 'Conflicting shoulder pain',
  comorbidities: Object.freeze(['asthma', 'Migraine']),
  medications: Object.freeze(['ibuprofen 200 mg', 'Paracetamol 500 mg']),
  client_goals: 'Return to safe walking',
});

export const CANONICAL_REFERRAL_PROFILE_MULTI_FORWARD = Object.freeze({
  ...CANONICAL_REFERRAL_PROFILE_MULTI_PRIMARY,
  email: CANONICAL_REFERRAL_PROFILE_MULTI_ADDITIONAL.email,
  comorbidities: Object.freeze(['Asthma', 'Migraine']),
  medications: Object.freeze(['Ibuprofen 200 mg', 'Paracetamol 500 mg']),
  client_goals: CANONICAL_REFERRAL_PROFILE_MULTI_ADDITIONAL.client_goals,
});

export const CANONICAL_REFERRAL_PROFILE_MULTI_REVERSED = Object.freeze({
  ...CANONICAL_REFERRAL_PROFILE_MULTI_ADDITIONAL,
  comorbidities: Object.freeze(['asthma', 'Migraine']),
  medications: Object.freeze(['ibuprofen 200 mg', 'Paracetamol 500 mg']),
});

export const CANONICAL_REFERRAL_PROFILE_MERGED = Object.freeze({
  ...CANONICAL_REFERRAL_PROFILE_A,
  phone: '0400000000',
  comorbidities: Object.freeze(['asthma', 'migraine']),
});

export const CANONICAL_REFERRAL_PROFILE_UNDER_13 = Object.freeze({
  ...CANONICAL_REFERRAL_PROFILE_A,
  full_name: 'Synthetic Minor',
  date_of_birth: '2020-01-02',
});

const CANONICAL_MULTI_FILE_CSV = Object.freeze({
  primary: [
    'fixture_id,full_name,date_of_birth,phone,email,referral_source,referral_source_name,primary_condition,comorbidities,medications,client_goals',
    'ASSURANCE_CANONICAL_MULTI_PRIMARY,Alex River,1990-01-02,0400 111 111,,gp,Dr Primary,Ankle sprain,Asthma,Ibuprofen 200 mg,',
  ].join('\n'),
  additional: [
    'fixture_id,full_name,date_of_birth,phone,email,referral_source,referral_source_name,primary_condition,comorbidities,medications,client_goals',
    'ASSURANCE_CANONICAL_MULTI_ADDITIONAL,Conflicting Synthetic Name,1980-05-06,0499 222 222,alex.river@example.invalid,other,Conflicting Referrer,Conflicting shoulder pain,asthma|Migraine,ibuprofen 200 mg|Paracetamol 500 mg,Return to safe walking',
  ].join('\n'),
});

export function canonicalMultiFileCsvFixture(kind) {
  const fixture = CANONICAL_MULTI_FILE_CSV[kind];
  if (!fixture) throw new Error('unknown canonical multi-file fixture');
  return Buffer.from(`${fixture}\n`, 'utf8');
}

function escapeFullFieldPdfText(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function buildTextPdf(pages) {
  const pageCount = pages.length;
  const fontObjectId = 3 + pageCount * 2;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pageCount} >>`,
  ];
  for (let index = 0; index < pageCount; index += 1) {
    const pageObjectId = 3 + index * 2;
    const contentObjectId = pageObjectId + 1;
    const stream = [
      'BT',
      '/F1 9 Tf',
      '54 760 Td',
      ...pages[index].flatMap((line, lineIndex) => [
        lineIndex === 0 ? '' : '0 -20 Td',
        `(${escapeFullFieldPdfText(line)}) Tj`,
      ]).filter(Boolean),
      'ET',
    ].join('\n');
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    );
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}

export function fullFieldReferralPdfFixture() {
  const p = CANONICAL_REFERRAL_PROFILE_FULL_39;
  const lines = [
    'SYNTHETIC REFERRAL - NOT A REAL PATIENT',
    'FIXTURE ID: ASSURANCE_PROFILE_FULL_39',
    'PATIENT DETAILS',
    `FULL NAME: ${p.full_name}`,
    `DATE OF BIRTH: ${p.date_of_birth}`,
    `GENDER: ${p.gender}`,
    `PHONE: ${p.phone}`,
    `EMAIL: ${p.email}`,
    `ADDRESS: ${p.address}`,
    'REFERRAL DETAILS',
    `REFERRAL SOURCE: ${p.referral_source}`,
    `REFERRAL SOURCE NAME: ${p.referral_source_name}`,
    `REFERRAL SOURCE ADDRESS: ${p.referral_source_address}`,
    `REFERRAL SOURCE EMAIL: ${p.referral_source_email}`,
    `REFERRAL PROVIDER NUMBER: ${p.referral_provider_number}`,
    `REFERRAL REASON: ${p.referral_reason}`,
    `REFERRAL DATE: ${p.referral_date}`,
    'FUNDING DETAILS',
    `FUNDING SOURCE: ${p.funding_source}`,
    `MEDICARE NUMBER: ${p.medicare_number}`,
    `MEDICARE IRN: ${p.medicare_irn}`,
    `DVA CARD NUMBER: ${p.dva_card_number}`,
    `DVA CARD TYPE: ${p.dva_card_type}`,
    `DVA FILE NUMBER: ${p.dva_file_number}`,
    `DVA ACCEPTED CONDITIONS: ${p.dva_accepted_conditions}`,
    `NDIS NUMBER: ${p.ndis_number}`,
    `NDIS GOALS: ${p.ndis_goals}`,
    `PRIVATE HEALTH FUND NAME: ${p.private_health_fund_name}`,
    `PRIVATE HEALTH FUND NUMBER: ${p.private_health_fund_number}`,
    `WORKCOVER CLAIM NUMBER: ${p.workcover_claim_number}`,
    `WORKCOVER DATE OF INJURY: ${p.workcover_date_of_injury}`,
    `WORKCOVER INJURY DESCRIPTION: ${p.workcover_injury_description}`,
    'CLINICAL DETAILS',
    `PRIMARY CONDITION: ${p.primary_condition}`,
    `COMORBIDITIES: ${p.comorbidities.join(' | ')}`,
    `MEDICATIONS: ${p.medications.join(' | ')}`,
    `MEDICAL HISTORY: ${p.medical_history}`,
    'PRIMARY GP DETAILS',
    `PRIMARY GP NAME: ${p.primary_gp_name}`,
    `PRIMARY GP CLINIC NAME: ${p.primary_gp_clinic_name}`,
    `PRIMARY GP ADDRESS: ${p.primary_gp_address}`,
    `PRIMARY GP PHONE: ${p.primary_gp_phone}`,
    `PRIMARY GP EMAIL: ${p.primary_gp_email}`,
    `PRIMARY GP PROVIDER NUMBER: ${p.primary_gp_provider_number}`,
    `CLIENT GOALS: ${p.client_goals}`,
    `MEDICARE REFERRAL TYPE: ${p.medicare_referral_type}`,
  ];
  return buildTextPdf([lines.slice(0, 24), lines.slice(24)]);
}

/** Mimics strict-provider output: every canonical field is present and absent facts are null. */
export function canonicalProviderProfile(profile) {
  return Object.fromEntries(
    REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS.map((key) => [key, profile[key] ?? null]),
  );
}

export function detectCanonicalReferralFixtureProfile(rawText) {
  if (rawText.includes('ASSURANCE_PROFILE_UNDER_13') || rawText.includes('2020-01-02')) {
    return CANONICAL_REFERRAL_PROFILE_UNDER_13;
  }
  if (rawText.includes('ASSURANCE_PROFILE_FULL_39')) {
    return CANONICAL_REFERRAL_PROFILE_FULL_39;
  }
  const primaryIndex = rawText.indexOf('ASSURANCE_CANONICAL_MULTI_PRIMARY');
  const additionalIndex = rawText.indexOf('ASSURANCE_CANONICAL_MULTI_ADDITIONAL');
  if (primaryIndex !== -1 || additionalIndex !== -1) {
    return additionalIndex !== -1 && (primaryIndex === -1 || additionalIndex < primaryIndex)
      ? CANONICAL_REFERRAL_PROFILE_MULTI_ADDITIONAL
      : CANONICAL_REFERRAL_PROFILE_MULTI_PRIMARY;
  }
  if (rawText.includes('ASSURANCE_PROFILE_DOB_CHANGE') || rawText.includes('1991-03-04')) {
    return CANONICAL_REFERRAL_PROFILE_DOB_CHANGE;
  }
  return CANONICAL_REFERRAL_PROFILE_A;
}
