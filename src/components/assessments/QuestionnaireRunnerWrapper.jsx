import React from "react";
import OswestryDisabilityIndexODIRunner from './OswestryDisabilityIndexODIRunner';
import QuickDASHRunner from './QuickDASHRunner';
import ConstantMurleyScoreRunner from './ConstantMurleyScoreRunner';
import LysholmKneeScoreRunner from './LysholmKneeScoreRunner';
import ACLRSIRunner from './ACLRSIRunner';
import GlobalRatingofChangeScaleGROCRunner from './GlobalRatingofChangeScaleGROCRunner';

/**
 * Wrapper to handle questionnaire-based runners with proper data flow
 */
export default function QuestionnaireRunnerWrapper({ 
  assessmentType, 
  client, 
  onSave, 
  onClose 
}) {
  const handleSave = (data) => {
    // Extract the specific data from the runner's response
    let extractedData;
    switch(assessmentType) {
      case 'odi':
        extractedData = data.additional_data.odi_data;
        break;
      case 'quick_dash':
        extractedData = data.additional_data.quick_dash_data;
        break;
      case 'constant_murley':
        extractedData = data.additional_data.constant_murley_data;
        break;
      case 'lysholm':
        extractedData = data.additional_data.lysholm_data;
        break;
      case 'aclrsi':
        extractedData = data.additional_data.aclrsi_data;
        break;
      case 'groc':
        extractedData = data.additional_data.groc_data;
        break;
      default:
        extractedData = data;
    }
    
    // Call parent onSave with both the extracted data and the original data
    onSave({
      extractedData,
      rawData: data
    });
  };

  const RunnerComponent = {
    'odi': OswestryDisabilityIndexODIRunner,
    'quick_dash': QuickDASHRunner,
    'constant_murley': ConstantMurleyScoreRunner,
    'lysholm': LysholmKneeScoreRunner,
    'aclrsi': ACLRSIRunner,
    'groc': GlobalRatingofChangeScaleGROCRunner,
  }[assessmentType];

  if (!RunnerComponent) return null;

  return <RunnerComponent client={client} onSave={handleSave} onClose={onClose} />;
}