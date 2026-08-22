import { hasAssessmentResultValue } from './assessmentResultValue.js';

/**
 * Stable report/SOAP projection shared by report surfaces and catalogue
 * acceptance tests. Numeric zero is a completed result, not an absent value.
 */
export function projectAssessmentResult({ assessment, completedAssessment }) {
  if (!assessment?.name) throw new Error('Assessment name is required for report projection');
  if (!completedAssessment || completedAssessment.status !== 'completed') {
    throw new Error('A completed assessment payload is required for report projection');
  }
  if (!hasAssessmentResultValue(completedAssessment.result_value)) {
    throw new Error(`Completed assessment ${assessment.name} has no result value`);
  }
  const numericResult = Number(completedAssessment.result_value);
  if (!Number.isFinite(numericResult)) {
    throw new Error(`Completed assessment ${assessment.name} result must be finite`);
  }
  const soapText = String(completedAssessment.additional_data?.soap_text || '').trim();
  if (!soapText) throw new Error(`Completed assessment ${assessment.name} has no SOAP projection`);
  const unit = assessment.unit_of_measure || '';

  return Object.freeze({
    canonical_id: assessment.canonical_id,
    name: assessment.name,
    assessment_date: completedAssessment.assessment_date,
    result_value: numericResult,
    unit_of_measure: unit,
    result_label: `${numericResult}${unit ? ` ${unit}` : ''}`,
    measurement_type: completedAssessment.additional_data?.measurement_type || null,
    soap_text: soapText,
    report_text: `${assessment.name}: ${numericResult}${unit ? ` ${unit}` : ''}\n${soapText}`,
  });
}
