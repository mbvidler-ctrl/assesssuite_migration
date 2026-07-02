import { 
  formatODIForSOAP,
  formatQuickDASHForSOAP,
  formatConstantMurleyForSOAP,
  formatLysholmForSOAP,
  formatACLRSIForSOAP,
  formatGROCForSOAP,
  formatConleyForSOAP,
  formatClinicalFrailtyScaleForSOAP,
  formatABCScaleForSOAP,
  formatBodPodForSOAP,
  formatKneeStabilityForSOAP,
  format6MeterWalkForSOAP,
  format400MeterWalkForSOAP
} from './SOAPNoteFormatter';

/**
 * Generate SOAP note objective text from additional_data
 * Used as extension to the main generateObjectiveFromAssessment function
 */
export function generateSOAPForSpecialMeasurements(assessment, data, assessmentData) {
  if (!data) return null;
  let objectiveText = '';
  
  // Support being called with either additional_data directly or a wrapper object
  const measurementType = data.measurement_type || data.additional_data?.measurement_type;
  
  switch(measurementType) {
    case 'odi':
      objectiveText += formatODIForSOAP(data);
      break;
    case 'quick_dash':
      objectiveText += formatQuickDASHForSOAP(data);
      break;
    case 'constant_murley':
      objectiveText += formatConstantMurleyForSOAP(data);
      break;
    case 'lysholm':
      objectiveText += formatLysholmForSOAP(data);
      break;
    case 'aclrsi':
      objectiveText += formatACLRSIForSOAP(data);
      break;
    case 'groc':
      objectiveText += formatGROCForSOAP(data);
      break;
    case 'conley':
      objectiveText += formatConleyForSOAP(data);
      break;
    case 'clinical_frailty_scale':
      objectiveText += formatClinicalFrailtyScaleForSOAP(data);
      break;
    case 'abc_scale':
      objectiveText += formatABCScaleForSOAP(data);
      break;
    case 'bod_pod':
      objectiveText += formatBodPodForSOAP(data);
      break;
    case 'knee_stability':
      objectiveText += formatKneeStabilityForSOAP(data);
      break;
    case '6_meter_walk_test':
      objectiveText += format6MeterWalkForSOAP(data);
      break;
    case '400_meter_walk_test':
      objectiveText += format400MeterWalkForSOAP(data);
      break;
    default:
      // Generic fallback: if a soap_text was pre-built by the runner, use it directly
      if (data.soap_text) return data.soap_text;
      return null;
  }
  
  return objectiveText;
}