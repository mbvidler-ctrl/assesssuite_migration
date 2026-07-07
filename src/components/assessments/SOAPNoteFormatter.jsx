/**
 * SOAP Note formatters for assessment types
 */

export function formatODIForSOAP(data) {
  if (!data.odi_data) return '';
  const odi = data.odi_data;
  return `  Total Score: ${odi.result_value}/50 (${odi.percentage}%)\n  Disability Level: ${odi.disability_level}\n`;
}

export function formatQuickDASHForSOAP(data) {
  if (!data.quick_dash_data) return '';
  const qd = data.quick_dash_data;
  return `  Total Score: ${qd.result_value}/100\n`;
}

export function formatConstantMurleyForSOAP(data) {
  if (!data.constant_murley_data) return '';
  const cm = data.constant_murley_data;
  return `  Total Score: ${cm.result_value}/100\n  Pain: ${cm.pain}/15 | ADL: ${Object.values(cm.adlScores).reduce((a,b) => a+b, 0)}/20 | ROM: ${cm.rom_score}/40 | Strength: ${cm.strength}/25\n`;
}

export function formatLysholmForSOAP(data) {
  if (!data.lysholm_data) return '';
  const ly = data.lysholm_data;
  return `  Total Score: ${ly.result_value}/100\n`;
}

export function formatACLRSIForSOAP(data) {
  if (!data.aclrsi_data) return '';
  const acl = data.aclrsi_data;
  return `  Percentage Score: ${acl.percentage_score}%\n  Total Score: ${acl.total_score}/120\n`;
}

export function formatGROCForSOAP(data) {
  if (!data.groc_data) return '';
  const groc = data.groc_data;
  const interpretation = groc.score === 0 ? 'No change' : groc.score > 0 ? `Improved (+${groc.score})` : `Worse (${groc.score})`;
  return `  Score: ${groc.score} (-7 to +7)\n  Interpretation: ${interpretation}\n`;
}

export function formatConleyForSOAP(data) {
  if (!data.conley_data) return '';
  const conley = data.conley_data;
  const riskLevel = conley.total_score >= 2 ? '⚠ High fall risk' : '✓ Low fall risk';
  return `  Total Score: ${conley.total_score}/12\n  Fall Risk: ${riskLevel}\n`;
}

export function formatClinicalFrailtyScaleForSOAP(data) {
  if (data.frailty_score === undefined) return '';
  return `  Frailty Score: ${data.frailty_score}/9\n  Interpretation: ${
    data.frailty_score <= 3 ? 'Fit to Managing Well' :
    data.frailty_score <= 6 ? 'Vulnerable to Moderately Frail' :
    'Severely Frail to Terminally Ill'
  }\n`;
}

export function formatABCScaleForSOAP(data) {
  if (!data.abc_scale_data) return '';
  const abc = data.abc_scale_data;
  return `  Average Score: ${abc.result_value}%\n  Interpretation: ${abc.interpretation}\n`;
}

export function formatBodPodForSOAP(data) {
  if (!data.bod_pod_data) return '';
  const bod = data.bod_pod_data;
  return `  Body Fat Percentage: ${bod.body_fat_percentage}%\n  Category: ${bod.interpretation}\n`;
}

export function formatKneeStabilityForSOAP(data) {
  if (!data.knee_stability_data) return '';
  const ks = data.knee_stability_data;
  let text = '';
  if (ks.left_result) {
    text += `  Left Knee: ${ks.left_result}`;
    if (ks.left_pain && ks.left_pain !== 'none') text += ` (Pain: ${ks.left_pain})`;
    text += '\n';
    if (ks.left_interpretation) text += `    → ${ks.left_interpretation}\n`;
  }
  if (ks.right_result) {
    text += `  Right Knee: ${ks.right_result}`;
    if (ks.right_pain && ks.right_pain !== 'none') text += ` (Pain: ${ks.right_pain})`;
    text += '\n';
    if (ks.right_interpretation) text += `    → ${ks.right_interpretation}\n`;
  }
  return text;
}

export function format6MeterWalkForSOAP(data) {
  // data may be the additional_data object directly, or an object with additional_data nested
  const walkData = data?.measurement_type === '6_meter_walk_test' ? data : data?.additional_data;
  if (!walkData || walkData.measurement_type !== '6_meter_walk_test') return '';
  let text = '';
  if (walkData.best_speed_ms != null) text += `  Best Speed: ${walkData.best_speed_ms} m/s`;
  if (walkData.best_time_s != null) text += ` (${parseFloat(walkData.best_time_s).toFixed(2)}s)`;
  if (text) text += '\n';
  if (walkData.average_speed_ms) text += `  Average Speed: ${walkData.average_speed_ms} m/s\n`;
  if (walkData.test_condition) text += `  Test Condition: ${walkData.test_condition.replace('_', ' ')}\n`;
  if (walkData.trials && walkData.trials.length > 0) {
    text += `  Trials (${walkData.trials.length}):\n`;
    walkData.trials.forEach((t, i) => {
      text += `    Trial ${i+1}: ${t.time_s}s = ${t.speed_ms} m/s\n`;
    });
  }
  if (walkData.interpretation) text += `  Category: ${walkData.interpretation}\n`;
  if (walkData.gait_aids) text += `  Gait Aids: ${walkData.gait_aids}\n`;
  if (walkData.footwear) text += `  Footwear: ${walkData.footwear}\n`;
  return text;
}

export function format400MeterWalkForSOAP(data) {
  const walkData = data?.measurement_type === '400_meter_walk_test' ? data : data?.additional_data;
  if (!walkData || walkData.measurement_type !== '400_meter_walk_test') return '';

  // If runner already built a detailed soap_text, use it directly
  if (walkData.soap_text) return walkData.soap_text;

  const formatT = (s) => {
    if (s == null) return '?';
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const tenths = Math.round((s % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
  };

  let text = `• 400-Metre Walk Test\n`;
  text += `  Total Time: ${formatT(walkData.total_time_seconds)} (${Number(walkData.total_time_seconds).toFixed(1)}s)\n`;
  text += `  Distance Covered: ${walkData.distance_covered_m}m\n`;
  text += `  Test Completed: ${walkData.completed !== false ? 'Yes' : `No${walkData.early_stop_reason ? ` — ${walkData.early_stop_reason}` : ''}`}\n`;

  if (walkData.laps && walkData.laps.length > 0) {
    text += `  Lap Splits (${walkData.laps.length} laps):\n`;
    walkData.laps.forEach(l => {
      text += `    Lap ${l.lap} (${l.lap * 40}m): split ${formatT(l.split)} | cumulative ${formatT(l.cumulative)}\n`;
    });
  }

  if (walkData.rest_breaks && walkData.rest_breaks.length > 0) {
    text += `  Rest Breaks: ${walkData.rest_breaks.length}\n`;
    walkData.rest_breaks.forEach((r, i) => {
      text += `    Break ${i + 1}: at ${r.at_metres}m (${formatT(r.at_time)})\n`;
    });
  } else if (walkData.number_of_rests != null) {
    text += `  Rest Breaks: ${walkData.number_of_rests}\n`;
  }

  const pre = walkData.pre_test;
  if (pre && (pre.heart_rate || pre.blood_pressure || pre.spo2)) {
    text += `  Pre-Test: HR ${pre.heart_rate || 'N/A'} bpm | BP ${pre.blood_pressure || 'N/A'} | SpO2 ${pre.spo2 || 'N/A'}%\n`;
  }
  const post = walkData.post_test;
  if (post && (post.heart_rate || post.blood_pressure || post.spo2)) {
    text += `  Post-Test: HR ${post.heart_rate || 'N/A'} bpm | BP ${post.blood_pressure || 'N/A'} | SpO2 ${post.spo2 || 'N/A'}%\n`;
  }
  if (walkData.gait_observations) text += `  Gait Observations: ${walkData.gait_observations}\n`;
  if (walkData.symptoms_observed) text += `  Symptoms: ${walkData.symptoms_observed}\n`;
  return text;
}