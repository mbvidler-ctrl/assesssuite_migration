/**
 * Centralized logic for generating SOAP objective text from assessment data.
 * CRITICAL: This ensures ALL assessment details captured in test runners are fully represented in SOAP notes.
 * 
 * Priority:
 * 1. Use soap_text if present (comprehensive pre-formatted detail from test runners)
 * 2. Fall back to measurement_type-specific formatting
 * 3. Generic formatting as last resort
 */

export function generateObjectiveText(assessment, assessmentData) {
  const rawDs = assessmentData.assessment_date || new Date().toISOString().split('T')[0];
  // Handle both date-only strings (YYYY-MM-DD) and full ISO strings
  const datePart = rawDs.includes('T') ? rawDs.split('T')[0] : rawDs;
  const dp = datePart.split('-').map(Number);
  const today = (dp.length === 3 && !isNaN(dp[0]) && dp[0] > 1900) ? new Date(dp[0], dp[1]-1, dp[2]) : new Date();
  const dateStr = today.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  let objectiveText = `Assessment completed on ${dateStr}:\n\n• ${assessment.name}:\n`;
  
  const data = assessmentData.additional_data || {};

  // ============================================================================
  // PRIORITY 1: If soap_text exists, use it as the main content
  // This captures all detailed results from test runners (questions, responses, clinical impressions)
  // ============================================================================
  if (data.soap_text) {
    objectiveText += data.soap_text.trim().split('\n').map(line => '  ' + line).join('\n') + '\n';
  } else {
    // ============================================================================
    // PRIORITY 2: Fall back to measurement_type-specific formatting
    // Extract and format structured data from additional_data
    // ============================================================================
    if (data.measurement_type === 'knee_stability' && data.knee_stability_data) {
      const ksd = data.knee_stability_data;
      objectiveText += `  Test Type: ${ksd.test_type}\n`;
      if (ksd.left_result) {
        objectiveText += `  Left Knee:\n`;
        objectiveText += `    Result: ${ksd.left_result}\n`;
        if (ksd.left_pain) objectiveText += `    Pain Response: ${ksd.left_pain}\n`;
        if (ksd.left_interpretation) objectiveText += `    Impression: ${ksd.left_interpretation}\n`;
      }
      if (ksd.right_result) {
        objectiveText += `  Right Knee:\n`;
        objectiveText += `    Result: ${ksd.right_result}\n`;
        if (ksd.right_pain) objectiveText += `    Pain Response: ${ksd.right_pain}\n`;
        if (ksd.right_interpretation) objectiveText += `    Impression: ${ksd.right_interpretation}\n`;
      }
      objectiveText += '\n';
    } else {
      // Generic fallback: format all structured data from additional_data
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'measurement_type' || key === 'soap_text' || !value) return;
        if (typeof value === 'object') {
          objectiveText += `  ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:\n`;
          Object.entries(value).forEach(([k, v]) => {
            if (v !== null && v !== undefined && v !== '') {
              objectiveText += `    ${k.replace(/_/g, ' ')}: ${v}\n`;
            }
          });
        } else if (value !== null && value !== undefined && value !== '') {
          objectiveText += `  ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${value}\n`;
        }
      });
      objectiveText += '\n';
    }
  }

  // ============================================================================
  // Add global notes and barriers if not already included in soap_text
  // ============================================================================
  if (assessmentData.notes && assessmentData.notes.trim()) {
    if (!data.soap_text || !data.soap_text.includes(assessmentData.notes)) {
      objectiveText += `  Clinical Notes: ${assessmentData.notes}\n`;
    }
  }
  if (assessmentData.barriers && assessmentData.barriers.trim()) {
    if (!data.soap_text || !data.soap_text.includes(assessmentData.barriers)) {
      objectiveText += `  Barriers Identified: ${assessmentData.barriers}\n`;
    }
  }

  return objectiveText;
}