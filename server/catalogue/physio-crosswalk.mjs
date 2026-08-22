/**
 * Explicit source-to-canonical relationships for the 23-record legacy
 * physiotherapy library. Names are exact source names: this file deliberately
 * avoids substring matching so catalogue identity cannot be changed by runner
 * detector order.
 *
 * A null target means the Physio definition is additive to the EP runtime
 * catalogue. Rights/provenance labels remain source data and are copied into
 * the generated manifest without interpretation.
 */
export const PHYSIO_SOURCE_CROSSWALK = Object.freeze([
  {
    physioName: 'Numeric Pain Rating Scale',
    targetRuntimeName: 'Pain Scales (VAS/NPRS)',
    relationship: 'same-instrument',
  },
  {
    physioName: 'Patient-Specific Functional Scale',
    targetRuntimeName: 'Patient-Specific Functional Scale (PSFS)',
    relationship: 'same-instrument',
  },
  {
    physioName: 'Global Rating of Change',
    targetRuntimeName: 'Global Rating of Change Scale (GROC)',
    relationship: 'same-instrument',
  },
  {
    physioName: 'Timed Up and Go',
    targetRuntimeName: 'Timed Up and Go (TUG)',
    relationship: 'same-instrument',
  },
  {
    physioName: 'Functional Reach Test',
    targetRuntimeName: 'Functional Reach Test',
    relationship: 'same-instrument',
  },
  {
    physioName: 'Six-Minute Walk Test',
    targetRuntimeName: '6-Minute Walk Test',
    relationship: 'same-instrument',
  },
  {
    physioName: 'Berg Balance Scale',
    targetRuntimeName: 'Berg Balance Scale',
    relationship: 'same-instrument',
  },
  {
    physioName: 'Roland-Morris Disability Questionnaire',
    targetRuntimeName: 'Roland-Morris Disability Questionnaire',
    relationship: 'same-instrument',
  },
  {
    physioName: 'Oswestry Disability Index',
    targetRuntimeName: 'Oswestry Disability Index (ODI)',
    relationship: 'same-instrument',
  },
  {
    physioName: 'Neck Disability Index',
    targetRuntimeName: 'Neck Disability Index (NDI)',
    relationship: 'same-instrument',
  },
  {
    physioName: 'QuickDASH',
    targetRuntimeName: null,
    relationship: 'physio-addition',
  },
  {
    physioName: 'Knee injury and Osteoarthritis Outcome Score',
    targetRuntimeName: 'Knee Injury and Osteoarthritis Outcome Score (KOOS)',
    relationship: 'same-instrument',
  },
  {
    physioName: 'Hip disability and Osteoarthritis Outcome Score',
    targetRuntimeName: 'Hip Outcome Score (HOOS)',
    relationship: 'same-instrument',
  },
  {
    physioName: 'Lower Extremity Functional Scale',
    targetRuntimeName: 'Lower Extremity Functional Scale (LEFS)',
    relationship: 'same-instrument',
  },
  {
    physioName: 'STarT Back Screening Tool',
    targetRuntimeName: null,
    relationship: 'physio-addition',
  },
  {
    physioName: 'Orebro Musculoskeletal Pain Screening Questionnaire',
    targetRuntimeName: null,
    relationship: 'physio-addition',
  },
  {
    physioName: 'Tampa Scale for Kinesiophobia',
    targetRuntimeName: 'Tampa Scale for Kinesiophobia (TSK)',
    relationship: 'same-instrument',
  },
  {
    physioName: 'Pain Catastrophising Scale',
    targetRuntimeName: 'Pain Catastrophizing Scale (PCS)',
    relationship: 'same-instrument',
  },
  {
    physioName: 'Victorian Institute of Sport Assessment - Achilles',
    targetRuntimeName: 'VISA-A',
    relationship: 'same-instrument',
  },
  {
    physioName: 'Victorian Institute of Sport Assessment - Patellar',
    targetRuntimeName: 'VISA-P',
    relationship: 'same-instrument',
  },
  {
    physioName: 'Active Range of Motion',
    targetRuntimeName: 'Range of Motion (Goniometry)',
    relationship: 'same-instrument',
  },
  {
    physioName: 'Manual Muscle Testing - Oxford Scale',
    targetRuntimeName: 'Manual Muscle Testing (MMT)',
    relationship: 'same-instrument',
  },
  {
    physioName: 'Neurological Screening Examination',
    targetRuntimeName: null,
    relationship: 'physio-addition',
  },
]);

export const EXPECTED_PHYSIO_SOURCE_COUNT = 23;
export const EXPECTED_PHYSIO_ADDITION_COUNT = 4;
