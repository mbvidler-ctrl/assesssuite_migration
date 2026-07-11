import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  X,
  CheckCircle,
  Calendar,
  User,
  BarChart3,
  FileText,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye
} from "lucide-react";
import { format, differenceInYears } from "date-fns";
import AssessmentResultDisplay from "./AssessmentResultDisplay";
import { deriveItems, hasBespokeItemRenderer } from "@/lib/clinical/assessmentResults";
import { DASS21_QUESTIONS, DASS21_OPTIONS } from "@/lib/clinical/dass21";
import { generateInterpretation } from "@/lib/clinical/generateInterpretation";

export default function CompletedAssessmentViewer({ assessment, client, clientAssessment, onClose }) {
  const clientAge = differenceInYears(new Date(), new Date(client.date_of_birth));
  const clientGender = client.gender;
  const isGripStrengthTest = assessment.name.toLowerCase().includes('grip strength');

  const getNormativeData = () => {
    if (!assessment.normative_data || assessment.normative_data.length === 0) return null;
    return assessment.normative_data.find(norm =>
      clientAge >= norm.age_min &&
      clientAge <= norm.age_max &&
      (norm.gender === clientGender || norm.gender === 'both')
    );
  };

  const normativeData = getNormativeData();

  // Direction-aware normative comparison via the shared clinical module, so the
  // completed view and the SOAP objective agree, and a lower-is-better test
  // (e.g. Timed Up and Go) never reads a slow time as "above average".
  const getNormativeComparison = (score, normData) => {
    if (!normData) return null;
    const interp = generateInterpretation({
      resultValue: score,
      norm: {
        ...normData,
        direction: assessment.normative_direction,
        source: assessment.normative_source,
        clinical_inference: normData.clinical_inference,
      },
      unit: assessment.unit_of_measure || "",
      ageLabel: `${normData.age_min}-${normData.age_max}`,
      genderLabel: normData.gender,
      subjectName: (client.full_name || "The client").split(" ")[0],
    });
    if (!interp) return null;
    const styleByEnum = {
      above_average: { color: "text-green-600", bgColor: "bg-green-100", icon: TrendingUp },
      average: { color: "text-yellow-600", bgColor: "bg-yellow-100", icon: Minus },
      below_average: { color: "text-red-600", bgColor: "bg-red-100", icon: TrendingDown },
    };
    const s = styleByEnum[interp.normativeEnum] || styleByEnum.average;
    return {
      level: interp.performanceLevel,
      color: s.color,
      bgColor: s.bgColor,
      icon: s.icon,
      description: interp.comparisonText,
    };
  };

  const normativeComparison = clientAssessment.result_value !== null && clientAssessment.result_value !== undefined
    ? getNormativeComparison(clientAssessment.result_value, normativeData)
    : null;

  const isDASS21 = (clientAssessment.additional_data?.measurement_type === 'dass21' || 
                    assessment.name.toLowerCase().includes('dass')) && 
                   clientAssessment.additional_data?.depression_score !== undefined;

  const isISI = assessment.name.toLowerCase().includes('insomnia') && 
                clientAssessment.additional_data?.responses !== undefined;

  const getScoreInterpretation = (score, testName) => {
    switch (testName) {
      case "Berg Balance Scale":
        if (score >= 45) return { level: "Low fall risk", color: "text-green-600", bgColor: "bg-green-100", description: "Client demonstrates good balance and low fall risk." };
        if (score >= 21) return { level: "Medium fall risk", color: "text-yellow-600", bgColor: "bg-yellow-100", description: "Client shows moderate balance impairment. Monitor closely." };
        return { level: "High fall risk", color: "text-red-600", bgColor: "bg-red-100", description: "Client has significant balance issues. Implement fall prevention strategies." };
      case "PHQ-9":
        if (score <= 4) return { level: "Minimal depression", color: "text-green-600", bgColor: "bg-green-100", description: "Little to no depression symptoms present." };
        if (score <= 9) return { level: "Mild depression", color: "text-yellow-600", bgColor: "bg-yellow-100", description: "Mild depression symptoms. Monitor and consider intervention." };
        if (score <= 14) return { level: "Moderate depression", color: "text-orange-600", bgColor: "bg-orange-100", description: "Moderate depression. Clinical intervention recommended." };
        if (score <= 19) return { level: "Moderately severe depression", color: "text-red-600", bgColor: "bg-red-100", description: "Significant depression. Urgent clinical attention needed." };
        return { level: "Severe depression", color: "text-red-800", bgColor: "bg-red-100", description: "Severe depression. Immediate clinical intervention required." };
      case "GAD-7":
        if (score <= 4) return { level: "Minimal anxiety", color: "text-green-600", bgColor: "bg-green-100", description: "Little to no anxiety symptoms present." };
        if (score <= 9) return { level: "Mild anxiety", color: "text-yellow-600", bgColor: "bg-yellow-100", description: "Mild anxiety symptoms. Monitor progress." };
        if (score <= 14) return { level: "Moderate anxiety", color: "text-orange-600", bgColor: "bg-orange-100", description: "Moderate anxiety. Consider treatment options." };
        return { level: "Severe anxiety", color: "text-red-600", bgColor: "bg-red-100", description: "Severe anxiety. Clinical intervention recommended." };
      case "Kessler Psychological Distress Scale (K10)":
        if (score <= 19) return { level: "Low distress", color: "text-green-600", bgColor: "bg-green-100", description: "Low levels of psychological distress." };
        if (score <= 24) return { level: "Mild distress", color: "text-yellow-600", bgColor: "bg-yellow-100", description: "Mild psychological distress." };
        if (score <= 29) return { level: "Moderate distress", color: "text-orange-600", bgColor: "bg-orange-100", description: "Moderate psychological distress." };
        return { level: "High distress", color: "text-red-600", bgColor: "bg-red-100", description: "High levels of psychological distress. Clinical support recommended." };
      default:
        return normativeComparison;
    }
  };

  const interpretation = isDASS21 ? null : getScoreInterpretation(clientAssessment.result_value, assessment.name);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            {assessment.name}
            {assessment.is_deleted && (
              <span className="text-orange-600 font-normal">(Historical)</span>
            )}
            {" - Results for "}{client.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Date Completed</p>
                    <p className="text-lg">{format(new Date(clientAssessment.assessment_date), 'PPP')}</p>
                  </div>

                  {clientAssessment.additional_data?.measurement_type === '10_second_repeated_jump' ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: "Valid Jumps", value: clientAssessment.additional_data.total_jumps, unit: "", color: "text-blue-700", bg: "bg-blue-50" },
                          { label: "Best RSI", value: clientAssessment.additional_data.best_rsi, unit: "", color: "text-purple-700", bg: "bg-purple-50" },
                          { label: "Average RSI", value: clientAssessment.additional_data.average_rsi, unit: "", color: "text-indigo-700", bg: "bg-indigo-50" },
                          { label: "Avg Flight Time", value: clientAssessment.additional_data.average_flight_time_ms, unit: "ms", color: "text-teal-700", bg: "bg-teal-50" },
                        ].map(({ label, value, unit, color, bg }) => (
                          <div key={label} className={`${bg} border rounded-lg p-3 text-center`}>
                            <p className="text-xs text-slate-500 mb-1">{label}</p>
                            <p className={`text-2xl font-bold ${color}`}>{value ?? "—"}{unit && <span className="text-sm ml-1">{unit}</span>}</p>
                          </div>
                        ))}
                      </div>
                      {clientAssessment.additional_data.average_contact_time_ms && (
                        <div className="bg-slate-50 border rounded-lg p-3 grid grid-cols-2 gap-3 text-sm">
                          <div><span className="text-slate-500">Avg Contact Time: </span><strong>{clientAssessment.additional_data.average_contact_time_ms} ms</strong></div>
                          {clientAssessment.additional_data.fatigue_index !== null && clientAssessment.additional_data.fatigue_index !== undefined && (
                            <div><span className="text-slate-500">Fatigue Index: </span><strong>{clientAssessment.additional_data.fatigue_index}%</strong></div>
                          )}
                        </div>
                      )}
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-amber-800 mb-1">RSI Interpretation</p>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-red-100 rounded p-2"><p className="font-bold text-red-800">&lt; 1.0</p><p>Poor</p></div>
                          <div className="bg-yellow-100 rounded p-2"><p className="font-bold text-yellow-800">1.0 – 1.5</p><p>Average</p></div>
                          <div className="bg-green-100 rounded p-2"><p className="font-bold text-green-800">&gt; 1.5</p><p>Good–Elite</p></div>
                        </div>
                      </div>
                      {clientAssessment.additional_data.jumps?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-slate-600 mb-2">Individual Jump Data</p>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs border rounded-lg overflow-hidden">
                              <thead className="bg-slate-100">
                                <tr>
                                  <th className="px-3 py-2 text-left">#</th>
                                  <th className="px-3 py-2 text-left">Flight (ms)</th>
                                  <th className="px-3 py-2 text-left">Contact (ms)</th>
                                  <th className="px-3 py-2 text-left">RSI</th>
                                  {clientAssessment.additional_data.jumps.some(j => j.jump_height_cm) && <th className="px-3 py-2 text-left">Height (cm)</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {clientAssessment.additional_data.jumps.map((j, i) => (
                                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                    <td className="px-3 py-2">{i + 1}</td>
                                    <td className="px-3 py-2">{j.flight_time_ms}</td>
                                    <td className="px-3 py-2">{j.contact_time_ms}</td>
                                    <td className="px-3 py-2 font-semibold text-purple-700">{j.flight_time_ms && j.contact_time_ms ? (j.flight_time_ms / j.contact_time_ms).toFixed(3) : "—"}</td>
                                    {clientAssessment.additional_data.jumps.some(j => j.jump_height_cm) && <td className="px-3 py-2">{j.jump_height_cm ?? "—"}</td>}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (clientAssessment.additional_data?.measurement_type === '12_minute_walk_run_test' || clientAssessment.additional_data?.measurement_type === 'cooper_test') ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                          <p className="text-xs text-slate-500 mb-1">Distance Covered</p>
                          <p className="text-3xl font-bold text-blue-700">{clientAssessment.additional_data.distance_covered_m?.toLocaleString() ?? clientAssessment.additional_data.distance_covered}</p>
                          <p className="text-sm text-slate-500">metres</p>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                          <p className="text-xs text-slate-500 mb-1">Estimated VO2max</p>
                          <p className="text-3xl font-bold text-purple-700">{clientAssessment.additional_data.vo2_max?.toFixed(1) ?? clientAssessment.result_value}</p>
                          <p className="text-sm text-slate-500">ml/kg/min</p>
                        </div>
                        {clientAssessment.additional_data.fitness_category && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                            <p className="text-xs text-slate-500 mb-1">Fitness Category</p>
                            <p className="text-2xl font-bold text-green-700">{clientAssessment.additional_data.fitness_category}</p>
                            {clientAssessment.additional_data.client_gender && clientAssessment.additional_data.client_age_at_test && (
                              <p className="text-xs text-slate-500">{clientAssessment.additional_data.client_gender}, age {clientAssessment.additional_data.client_age_at_test}</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="bg-slate-50 border rounded-lg p-3 text-sm">
                        <p className="font-semibold mb-1">VO2max Reference Ranges (Cooper, 1968)</p>
                        <div className="grid grid-cols-5 gap-1 text-center text-xs">
                          {["Poor","Fair","Good","Excellent","Superior"].map((cat, i) => (
                            <div key={cat} className={`rounded p-2 ${["bg-red-100","bg-yellow-100","bg-blue-100","bg-green-100","bg-purple-100"][i]}`}>
                              <p className={`font-bold ${["text-red-700","text-yellow-700","text-blue-700","text-green-700","text-purple-700"][i]}`}>{cat}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : clientAssessment.additional_data?.measurement_type === 'slr' && clientAssessment.additional_data?.slr_data ? (
                    <div className="space-y-3">
                      {clientAssessment.additional_data.slr_data.soap_text ? (
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                          <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans">
                            {clientAssessment.additional_data.slr_data.soap_text}
                          </pre>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {[['Left', clientAssessment.additional_data.slr_data.left_side || clientAssessment.additional_data.slr_data.left_data],
                            ['Right', clientAssessment.additional_data.slr_data.right_side || clientAssessment.additional_data.slr_data.right_data]].map(([label, side]) => side && (
                            <div key={label} className={`p-3 rounded-lg border ${label === 'Left' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
                              <p className="font-semibold text-slate-800 mb-2">{label} Side</p>
                              <div className="space-y-1 text-sm">
                                {side.symptom_onset_angle_deg !== undefined && <p>Symptom onset angle: <strong>{side.symptom_onset_angle_deg}°</strong></p>}
                                {side.max_flexion_angle_deg && <p>Max flexion: <strong>{side.max_flexion_angle_deg}°</strong></p>}
                                {side.symptom_location && <p>Symptom location: <strong>{side.symptom_location}</strong></p>}
                                {side.symptom_quality && <p>Symptom quality: <strong>{side.symptom_quality}</strong></p>}
                                {side.ankle_dorsiflexion_effect && <p>Ankle dorsiflexion effect: <strong>{side.ankle_dorsiflexion_effect}</strong></p>}
                                {side.cervical_flexion_effect && <p>Cervical flexion effect: <strong>{side.cervical_flexion_effect}</strong></p>}
                                {side.interpretation && <p className="mt-2 font-semibold">{side.interpretation}</p>}
                              </div>
                            </div>
                          ))}
                          {clientAssessment.additional_data.slr_data.crossed_slr && clientAssessment.additional_data.slr_data.crossed_slr !== 'not_tested' && (
                            <p className="text-sm text-slate-700">Crossed SLR: <strong>{clientAssessment.additional_data.slr_data.crossed_slr}</strong></p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : isGripStrengthTest && clientAssessment.additional_data?.measurement_type === 'hand_grip_strength' ? (
                    <div className="space-y-4">
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-sm font-semibold text-blue-900 mb-3">
                          {clientAssessment.additional_data.dominant_hand === 'right' ? 'Right Hand (Dominant)' : 'Left Hand (Dominant)'}
                        </p>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {['dominant_trial_1', 'dominant_trial_2', 'dominant_trial_3'].map((key, i) => (
                            <div key={key} className="text-center p-2 bg-white rounded">
                              <p className="text-xs text-slate-600">Trial {i + 1}</p>
                              <p className="text-lg font-bold text-slate-900">{clientAssessment.additional_data[key] || '-'}</p>
                            </div>
                          ))}
                        </div>
                        <div className="text-center p-2 bg-green-100 rounded border border-green-300">
                          <p className="text-xs text-green-700 font-medium">Best</p>
                          <p className="text-xl font-bold text-green-700">{clientAssessment.additional_data.dominant_best} kg</p>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <p className="text-sm font-semibold text-slate-700 mb-3">
                          {clientAssessment.additional_data.dominant_hand === 'right' ? 'Left Hand (Non-Dominant)' : 'Right Hand (Non-Dominant)'}
                        </p>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {['non_dominant_trial_1', 'non_dominant_trial_2', 'non_dominant_trial_3'].map((key, i) => (
                            <div key={key} className="text-center p-2 bg-white rounded">
                              <p className="text-xs text-slate-600">Trial {i + 1}</p>
                              <p className="text-lg font-bold text-slate-900">{clientAssessment.additional_data[key] || '-'}</p>
                            </div>
                          ))}
                        </div>
                        <div className="text-center p-2 bg-blue-100 rounded border border-blue-200">
                          <p className="text-xs text-blue-700 font-medium">Best</p>
                          <p className="text-xl font-bold text-blue-700">{clientAssessment.additional_data.non_dominant_best} kg</p>
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border-2 border-green-300">
                        <p className="text-sm font-semibold text-green-900 mb-1">Overall Best Result</p>
                        <p className="text-3xl font-bold text-green-700">{clientAssessment.result_value} kg</p>
                        <p className="text-xs text-green-600 mt-1">
                          ({clientAssessment.additional_data.dominant_hand === 'right' ? 'Right' : 'Left'} Hand - Dominant)
                        </p>
                      </div>
                    </div>
                  ) : clientAssessment.additional_data?.measurement_type === 'back_scratch' ? (
                    (() => {
                      const ad = clientAssessment.additional_data;
                      // Support both storage patterns:
                      // Old BackScratchRunner: left_best, right_best, left_trial1, left_trial2, right_trial1, right_trial2
                      // New BackScratchTestRunner: best_left_cm, best_right_cm, left_trials[], right_trials[]
                      const leftBest = ad.left_best ?? ad.best_left_cm ?? null;
                      const rightBest = ad.right_best ?? ad.best_right_cm ?? null;
                      const leftTrials = ad.left_trials ?? (ad.left_trial1 !== undefined ? [ad.left_trial1, ad.left_trial2].filter(v => v !== null && v !== undefined) : []);
                      const rightTrials = ad.right_trials ?? (ad.right_trial1 !== undefined ? [ad.right_trial1, ad.right_trial2].filter(v => v !== null && v !== undefined) : []);
                      const average = leftBest !== null && rightBest !== null ? ((leftBest + rightBest) / 2) : (ad.average_distance ?? null);
                      const asymmetry = leftBest !== null && rightBest !== null ? Math.abs(leftBest - rightBest) : (ad.asymmetry ?? null);
                      const fmtCm = (v) => v !== null && v !== undefined ? `${typeof v === 'number' ? (v >= 0 ? '+' : '') + v.toFixed(1) : v} cm` : '—';
                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <p className="text-sm font-semibold text-blue-900 mb-3">Left Hand Over Shoulder</p>
                              <div className="space-y-2">
                                {leftTrials.map((v, i) => (
                                  <div key={i} className="flex justify-between text-sm"><span className="text-slate-600">Trial {i + 1}:</span><span className="font-semibold">{fmtCm(v)}</span></div>
                                ))}
                                <div className="pt-2 border-t border-blue-200 flex justify-between">
                                  <span className="text-sm font-medium text-blue-800">Best:</span>
                                  <span className="text-lg font-bold text-blue-700">{fmtCm(leftBest)}</span>
                                </div>
                                {ad.left_classification && <div className="text-xs text-center mt-1 font-semibold text-blue-600">{ad.left_classification}</div>}
                              </div>
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                              <p className="text-sm font-semibold text-green-900 mb-3">Right Hand Over Shoulder</p>
                              <div className="space-y-2">
                                {rightTrials.map((v, i) => (
                                  <div key={i} className="flex justify-between text-sm"><span className="text-slate-600">Trial {i + 1}:</span><span className="font-semibold">{fmtCm(v)}</span></div>
                                ))}
                                <div className="pt-2 border-t border-green-200 flex justify-between">
                                  <span className="text-sm font-medium text-green-800">Best:</span>
                                  <span className="text-lg font-bold text-green-700">{fmtCm(rightBest)}</span>
                                </div>
                                {ad.right_classification && <div className="text-xs text-center mt-1 font-semibold text-green-600">{ad.right_classification}</div>}
                              </div>
                            </div>
                          </div>
                          <div className="bg-slate-100 rounded-lg p-4 grid grid-cols-2 gap-4 text-center">
                            <div>
                              <p className="text-xs text-slate-500">Average</p>
                              <p className="text-2xl font-bold text-slate-800">{fmtCm(average)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Asymmetry</p>
                              <p className="text-2xl font-bold text-slate-800">{asymmetry !== null ? `${asymmetry.toFixed(1)} cm` : '—'}</p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 italic">Positive = overlap; Negative = gap between fingertips</p>
                        </div>
                      );
                    })()
                  ) : clientAssessment.additional_data?.measurement_type === 'skinfold' ? (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-lg p-4 text-center">
                        <p className="text-xs text-slate-500 mb-1">Body Fat Percentage</p>
                        <p className="text-4xl font-bold text-blue-600">{clientAssessment.result_value ?? clientAssessment.additional_data.body_fat_percentage}%</p>
                        <div className="flex justify-center gap-6 mt-3 text-sm text-slate-600">
                          {clientAssessment.additional_data.total_sum && <span>Sum: <strong>{clientAssessment.additional_data.total_sum} mm</strong></span>}
                          {clientAssessment.additional_data.body_density && <span>Body Density: <strong>{clientAssessment.additional_data.body_density}</strong></span>}
                          {clientAssessment.additional_data.protocol && <span>Protocol: <strong>{clientAssessment.additional_data.protocol}</strong></span>}
                        </div>
                      </div>

                      {clientAssessment.additional_data.measurements && Object.keys(clientAssessment.additional_data.measurements).length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-slate-700 mb-2">Site Measurements</p>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm border rounded-lg overflow-hidden">
                              <thead className="bg-slate-100">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600">Site</th>
                                  <th className="px-3 py-2 text-center font-medium text-slate-600">Trial 1</th>
                                  <th className="px-3 py-2 text-center font-medium text-slate-600">Trial 2</th>
                                  <th className="px-3 py-2 text-center font-medium text-slate-600">Trial 3</th>
                                  <th className="px-3 py-2 text-center font-medium text-slate-600">Average</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(clientAssessment.additional_data.measurements).map(([site, data], i) => (
                                  <tr key={site} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                    <td className="px-3 py-2 font-medium capitalize">{site.replace(/_/g, ' ')}</td>
                                    <td className="px-3 py-2 text-center">{data.trial1 ?? '—'}</td>
                                    <td className="px-3 py-2 text-center">{data.trial2 ?? '—'}</td>
                                    <td className="px-3 py-2 text-center">{data.trial3 ?? '—'}</td>
                                    <td className="px-3 py-2 text-center font-bold text-blue-700">{data.average ?? '—'} mm</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {(clientAssessment.notes || clientAssessment.additional_data?.observations) && (
                        <div>
                          <p className="text-sm font-medium text-slate-600">Observations</p>
                          <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded">{clientAssessment.notes || clientAssessment.additional_data?.observations}</p>
                        </div>
                      )}
                    </div>
                  ) : clientAssessment.additional_data?.measurement_type === 'balke_ware' ? (
                    <div className="space-y-4">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                          {clientAssessment.additional_data.soap_text}
                        </pre>
                      </div>
                      {clientAssessment.additional_data.stage_heart_rates && Object.keys(clientAssessment.additional_data.stage_heart_rates).length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-slate-700 mb-2">❤ Heart Rate Log</p>
                          <div className="grid grid-cols-4 gap-2">
                            {Object.entries(clientAssessment.additional_data.stage_heart_rates)
                              .filter(([, v]) => v)
                              .sort(([a], [b]) => Number(a) - Number(b))
                              .map(([min, hr]) => (
                                <div key={min} className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                                  <p className="text-xs text-slate-500">Min {min} ({min}%)</p>
                                  <p className="text-lg font-bold text-red-600">{hr}</p>
                                  <p className="text-xs text-slate-400">bpm</p>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : clientAssessment.additional_data?.measurement_type === 'four_stage_balance_test' ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-xs text-slate-500 mb-1">Highest Stage Achieved</p>
                          <p className="text-4xl font-bold text-blue-700">{clientAssessment.result_value}</p>
                          <p className="text-sm text-slate-600 mt-2">Out of 4 stages</p>
                        </div>
                        {clientAssessment.additional_data.pass_time_seconds && (
                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <p className="text-xs text-slate-500 mb-1">Time on Final Stage</p>
                            <p className="text-3xl font-bold text-purple-700">{clientAssessment.additional_data.pass_time_seconds}s</p>
                            <p className="text-sm text-slate-600 mt-2">Duration held</p>
                          </div>
                        )}
                      </div>

                      {clientAssessment.additional_data.stages && (
                        <div>
                          <p className="text-sm font-semibold text-slate-700 mb-3">Stage Performance</p>
                          <div className="space-y-2">
                            {[
                              { name: 'Side-by-Side Stand', key: 'side_by_side' },
                              { name: 'Semi-Tandem Stand', key: 'semi_tandem' },
                              { name: 'Tandem Stand', key: 'tandem' },
                              { name: 'Single Leg Stand', key: 'single_leg' }
                            ].map((stage, i) => {
                              const stageData = clientAssessment.additional_data.stages[stage.key];
                              const passed = stageData?.passed;
                              const time = stageData?.time_seconds;
                              return (
                                <div key={stage.key} className={`p-3 rounded-lg border ${passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-medium text-slate-900">{i + 1}. {stage.name}</p>
                                      <p className={`text-sm ${passed ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}`}>
                                        {passed ? '✓ Passed' : '✗ Failed'}
                                      </p>
                                    </div>
                                    {time && <p className="text-lg font-bold text-slate-700">{time}s</p>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {clientAssessment.additional_data.fall_risk && (
                        <div className={`rounded-lg p-4 border-2 ${
                          clientAssessment.additional_data.fall_risk === 'high' ? 'bg-red-50 border-red-300' :
                          clientAssessment.additional_data.fall_risk === 'moderate' ? 'bg-yellow-50 border-yellow-300' :
                          'bg-green-50 border-green-300'
                        }`}>
                          <p className="font-semibold text-slate-900 mb-1">Fall Risk Classification</p>
                          <p className={`text-lg font-bold ${
                            clientAssessment.additional_data.fall_risk === 'high' ? 'text-red-700' :
                            clientAssessment.additional_data.fall_risk === 'moderate' ? 'text-yellow-700' :
                            'text-green-700'
                          }`}>
                            {clientAssessment.additional_data.fall_risk?.charAt(0).toUpperCase() + clientAssessment.additional_data.fall_risk?.slice(1)}
                          </p>
                        </div>
                      )}

                      {clientAssessment.additional_data.soap_text && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <p className="text-sm font-semibold text-slate-700 mb-2">Clinical Notes</p>
                          <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                            {clientAssessment.additional_data.soap_text}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : isISI && clientAssessment.additional_data?.responses ? (
                   <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                       <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
                         <p className="text-xs text-slate-500 mb-1">Total Score</p>
                         <p className="text-4xl font-bold text-indigo-700">{clientAssessment.result_value}/28</p>
                       </div>
                       <div className={`rounded-lg p-4 text-center border-2 ${
                         clientAssessment.result_value <= 7 ? 'bg-green-100 border-green-300' :
                         clientAssessment.result_value <= 14 ? 'bg-yellow-100 border-yellow-300' :
                         clientAssessment.result_value <= 21 ? 'bg-orange-100 border-orange-300' :
                         'bg-red-100 border-red-300'
                       }`}>
                         <p className="text-xs text-slate-600 mb-1">Severity</p>
                         <p className={`text-lg font-bold ${
                           clientAssessment.result_value <= 7 ? 'text-green-700' :
                           clientAssessment.result_value <= 14 ? 'text-yellow-700' :
                           clientAssessment.result_value <= 21 ? 'text-orange-700' :
                           'text-red-700'
                         }`}>
                           {clientAssessment.result_value <= 7 ? 'None' :
                            clientAssessment.result_value <= 14 ? 'Subthreshold' :
                            clientAssessment.result_value <= 21 ? 'Moderate' :
                            'Severe'}
                         </p>
                       </div>
                     </div>

                     <div>
                       <p className="text-sm font-semibold text-slate-700 mb-3">Item-by-Item Responses</p>
                       <div className="overflow-x-auto">
                         <table className="min-w-full text-sm border rounded-lg overflow-hidden">
                           <thead className="bg-slate-100">
                             <tr>
                               <th className="px-3 py-2 text-left">Question</th>
                               <th className="px-3 py-2 text-center">Score</th>
                             </tr>
                           </thead>
                           <tbody>
                             {[
                               {q: 1, text: 'Difficulty falling asleep'},
                               {q: 2, text: 'Difficulty staying asleep'},
                               {q: 3, text: 'Problem waking up too early'},
                               {q: 4, text: 'Satisfaction with sleep'},
                               {q: 5, text: 'Daytime impairment'},
                               {q: 6, text: 'Worry/distress'},
                               {q: 7, text: 'Interference with quality of life'}
                             ].map((item, i) => {
                               const score = clientAssessment.additional_data.responses[`q${item.q}`];
                               return (
                                 <tr key={item.q} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                   <td className="px-3 py-2">{item.q}. {item.text}</td>
                                   <td className="px-3 py-2 text-center font-bold text-indigo-700">{score ?? '—'}/4</td>
                                 </tr>
                               );
                             })}
                           </tbody>
                         </table>
                       </div>
                     </div>

                     <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                       <p className="text-xs font-semibold text-slate-600 mb-2">Severity Thresholds</p>
                       <div className="grid grid-cols-2 gap-2 text-xs">
                         <div className="bg-green-100 rounded p-2"><strong className="text-green-700">0–7:</strong> No insomnia</div>
                         <div className="bg-yellow-100 rounded p-2"><strong className="text-yellow-700">8–14:</strong> Subthreshold</div>
                         <div className="bg-orange-100 rounded p-2"><strong className="text-orange-700">15–21:</strong> Moderate</div>
                         <div className="bg-red-100 rounded p-2"><strong className="text-red-700">22–28:</strong> Severe</div>
                       </div>
                     </div>
                   </div>
                  ) : clientAssessment.additional_data?.measurement_type === 'rom_assessment' && (clientAssessment.additional_data?.measurements || clientAssessment.additional_data?.rom_data?.measurements) ? (
                    (() => {
                      // The persisted shape nests the detail under rom_data;
                      // resolve through it so stored records render.
                      const rd = clientAssessment.additional_data.rom_data || clientAssessment.additional_data;
                      return (
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-blue-900 mb-2">Joint Assessed</p>
                        <p className="text-lg font-bold text-blue-700">{rd.jointName || 'ROM Assessment'}</p>
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-slate-700">Measurements by Movement</p>
                        {Object.entries(rd.measurements || {}).map(([movement, values]) => (
                          <div key={movement} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                            <p className="font-medium text-slate-900 mb-2">{movement}</p>
                            <div className="grid grid-cols-2 gap-3">
                              {values.left !== undefined && values.left !== null && (
                                <div className="bg-blue-100 rounded p-2">
                                  <p className="text-xs text-slate-600">Left</p>
                                  <p className="text-lg font-bold text-blue-700">{values.left}°</p>
                                </div>
                              )}
                              {values.right !== undefined && values.right !== null && (
                                <div className="bg-green-100 rounded p-2">
                                  <p className="text-xs text-slate-600">Right</p>
                                  <p className="text-lg font-bold text-green-700">{values.right}°</p>
                                </div>
                              )}
                            </div>
                            {rd.comments?.[movement] && (
                              <p className="text-xs text-slate-600 mt-2 italic">Note: {rd.comments[movement]}</p>
                            )}
                          </div>
                        ))}
                      </div>

                      {(rd.soap_text || clientAssessment.additional_data.soap_text) && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <p className="text-sm font-semibold text-slate-700 mb-2">SOAP Summary</p>
                          <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                            {rd.soap_text || clientAssessment.additional_data.soap_text}
                          </pre>
                        </div>
                      )}
                    </div>
                      );
                    })()
                  ) : clientAssessment.additional_data?.measurement_type === 'womac' && clientAssessment.additional_data?.item_scores ? (
                    (() => {
                      const ad = clientAssessment.additional_data;
                      const SCORE_LABELS = { 0: "None", 1: "Mild", 2: "Moderate", 3: "Severe", 4: "Extreme" };
                      const SCORE_COLORS = { 0: "text-green-700 bg-green-50", 1: "text-yellow-700 bg-yellow-50", 2: "text-orange-700 bg-orange-50", 3: "text-red-600 bg-red-50", 4: "text-red-800 bg-red-100" };
                      const PAIN_ITEMS = ["Walking on a flat surface","Going up or down stairs","At night while in bed","Sitting or lying","Standing upright"];
                      const STIFFNESS_ITEMS = ["After first waking in the morning","After sitting, lying, or resting later in the day"];
                      const FUNCTION_ITEMS = ["Descending stairs","Ascending stairs","Rising from sitting","Standing","Bending to floor","Walking on flat surface","Getting in/out of car","Going shopping","Putting on socks","Rising from bed","Taking off socks","Lying in bed","Getting in/out of bath","Sitting","Getting on/off toilet","Heavy domestic duties","Light domestic duties"];

                      const renderSubscale = (label, items, prefix, max) => {
                        const total = items.reduce((sum, _, i) => sum + (parseInt(ad.item_scores[`${prefix}_${i}`]) || 0), 0);
                        const pct = ((total / max) * 100).toFixed(0);
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between bg-slate-100 px-3 py-2 rounded font-semibold text-sm text-slate-700">
                              <span>{label}</span>
                              <span>{total}/{max} ({pct}%)</span>
                            </div>
                            {items.map((item, i) => {
                              const score = ad.item_scores[`${prefix}_${i}`];
                              const sc = score !== undefined ? parseInt(score) : null;
                              return (
                                <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded border border-slate-100 bg-white text-sm">
                                  <span className="text-slate-700">{i + 1}. {item}</span>
                                  {sc !== null
                                    ? <span className={`text-xs font-semibold px-2 py-0.5 rounded ${SCORE_COLORS[sc]}`}>{sc} — {SCORE_LABELS[sc]}</span>
                                    : <span className="text-xs text-slate-400">—</span>
                                  }
                                </div>
                              );
                            })}
                          </div>
                        );
                      };

                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-3 text-center">
                            {[
                              { label: "Pain", score: ad.pain_score, max: 20, pct: ad.pain_percent, color: "text-red-600 bg-red-50 border-red-200" },
                              { label: "Stiffness", score: ad.stiffness_score, max: 8, pct: ad.stiffness_percent, color: "text-orange-600 bg-orange-50 border-orange-200" },
                              { label: "Function", score: ad.function_score, max: 68, pct: ad.function_percent, color: "text-blue-600 bg-blue-50 border-blue-200" },
                            ].map(s => (
                              <div key={s.label} className={`rounded-lg border p-3 ${s.color}`}>
                                <p className="text-xs font-medium mb-1">{s.label}</p>
                                <p className="text-2xl font-bold">{s.score}/{s.max}</p>
                                <p className="text-xs">{s.pct}%</p>
                              </div>
                            ))}
                          </div>
                          <div className="text-center py-2 bg-slate-800 text-white rounded-lg">
                            <p className="text-xs text-slate-300">Total WOMAC Score ({ad.joint} - {ad.side})</p>
                            <p className="text-3xl font-bold">{ad.total_score}/96</p>
                          </div>
                          {renderSubscale("Pain Subscale", PAIN_ITEMS, "pain", 20)}
                          {renderSubscale("Stiffness Subscale", STIFFNESS_ITEMS, "stiffness", 8)}
                          {renderSubscale("Physical Function Subscale", FUNCTION_ITEMS, "function", 68)}
                        </div>
                      );
                    })()
                  ) : clientAssessment.additional_data?.soap_text ? (
                    // Qualitative special tests — render the full SOAP text directly
                    <div className="space-y-3">
                      {clientAssessment.additional_data.measurement_type === 'anterior_drawer_knee' && (
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${
                          clientAssessment.result_value === 1
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {clientAssessment.result_value === 1 ? "✕ Positive — ACL insufficiency suspected" : "✓ Negative — ACL likely intact"}
                        </div>
                      )}
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                          {clientAssessment.additional_data.soap_text}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {clientAssessment.result_value !== null && clientAssessment.result_value !== undefined ? (
                        <AssessmentResultDisplay assessment={assessment} client={client} clientAssessment={clientAssessment} normativeComparison={normativeComparison} />
                      ) : (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                          <div className="text-red-600 font-semibold">
                            <p className="text-lg">Please enter a result value.</p>
                            <p className="text-sm font-normal mt-1">This assessment was created but no result was recorded. Please delete and re-run the assessment.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {interpretation && !isDASS21 && (
                    <div className="space-y-2 mt-4">
                      <Badge className={`text-md px-3 py-1 ${interpretation.bgColor}`}>
                        {interpretation.level}
                      </Badge>
                      <p className="text-slate-600 mt-2 text-sm">{interpretation.description}</p>
                    </div>
                  )}

                  {(clientAssessment.notes || clientAssessment.additional_data?.notes) && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-slate-600">Notes</p>
                      <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded whitespace-pre-wrap">
                        {clientAssessment.notes || clientAssessment.additional_data?.notes}
                      </p>
                    </div>
                  )}

                  {/* Full item-level results (P-A): totals AND every individual answer,
                      shown for any family whose data carries per-item detail and that
                      does not already have a bespoke full-item table above. */}
                  {(() => {
                    const ad = clientAssessment.additional_data || {};
                    if (isDASS21) {
                      const subs = [
                        { name: "Depression", score: ad.depression_score, level: ad.depression_interpretation },
                        { name: "Anxiety", score: ad.anxiety_score, level: ad.anxiety_interpretation },
                        { name: "Stress", score: ad.stress_score, level: ad.stress_interpretation },
                      ];
                      const items = deriveItems(ad, { questions: DASS21_QUESTIONS, options: DASS21_OPTIONS });
                      return (
                        <div className="mt-4">
                          <h4 className="font-medium text-slate-900 mb-2">DASS-21 Subscale Scores</h4>
                          <div className="grid grid-cols-3 gap-3 text-center mb-2">
                            {subs.map((s) => (
                              <div key={s.name} className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                                <p className="text-xs font-medium mb-1">{s.name}</p>
                                <p className="text-2xl font-bold">{s.score}/42</p>
                                <p className="text-xs text-slate-600">{s.level}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-slate-500 mb-3">Severity bands: Lovibond &amp; Lovibond (1995), DASS Manual (2nd ed.).</p>
                          {items.length > 0 && (
                            <div>
                              <h4 className="font-medium text-slate-900 mb-2">All Item Responses ({items.length})</h4>
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-sm border border-slate-200">
                                  <thead className="bg-slate-50">
                                    <tr>
                                      <th className="px-2 py-1 text-left font-medium text-slate-500">#</th>
                                      <th className="px-2 py-1 text-left font-medium text-slate-500">Item</th>
                                      <th className="px-2 py-1 text-left font-medium text-slate-500">Score</th>
                                      <th className="px-2 py-1 text-left font-medium text-slate-500">Response</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.map((it) => (
                                      <tr key={it.number} className="border-t border-slate-100">
                                        <td className="px-2 py-1 align-top">{it.number}</td>
                                        <td className="px-2 py-1 align-top">{it.question_text}{it.category ? ` [${it.category}]` : ""}</td>
                                        <td className="px-2 py-1 align-top font-medium">{it.value}</td>
                                        <td className="px-2 py-1 align-top text-slate-600">{it.response_label}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (!isISI && !hasBespokeItemRenderer(ad.measurement_type)) {
                      const items = deriveItems(ad, {});
                      if (items.length > 0) {
                        return (
                          <div className="mt-4">
                            <h4 className="font-medium text-slate-900 mb-2">All Recorded Responses ({items.length})</h4>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm border border-slate-200">
                                <thead className="bg-slate-50">
                                  <tr>
                                    <th className="px-2 py-1 text-left font-medium text-slate-500">#</th>
                                    <th className="px-2 py-1 text-left font-medium text-slate-500">Item</th>
                                    <th className="px-2 py-1 text-left font-medium text-slate-500">Value</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((it) => (
                                    <tr key={it.number} className="border-t border-slate-100">
                                      <td className="px-2 py-1 align-top">{it.number}</td>
                                      <td className="px-2 py-1 align-top">{it.question_text || `Item ${it.number}`}</td>
                                      <td className="px-2 py-1 align-top font-medium">{it.value}{it.response_label ? ` — ${it.response_label}` : ""}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                </div>

                <div>
                  <h4 className="font-medium text-slate-900 mb-3">Normative Comparison</h4>
                  {normativeData && normativeComparison ? (
                    <div className="space-y-4">
                      <div className="bg-slate-50 p-3 rounded-lg">
                        <div className="text-sm text-slate-600">Client Information</div>
                        <div className="space-y-1">
                          <div><strong>Age:</strong> {clientAge} years</div>
                          <div><strong>Gender:</strong> {clientGender}</div>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg">
                        <div className="text-sm text-slate-600">Normative Group</div>
                        <div className="space-y-1">
                          <div><strong>Age Range:</strong> {normativeData.age_min}-{normativeData.age_max} years</div>
                          <div><strong>Gender:</strong> {normativeData.gender === 'both' ? 'All' : normativeData.gender}</div>
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg ${normativeComparison.bgColor}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <normativeComparison.icon className={`w-6 h-6 ${normativeComparison.color}`} />
                          <Badge className={`${normativeComparison.bgColor} ${normativeComparison.color}`}>
                            {normativeComparison.level}
                          </Badge>
                        </div>
                        <p className={`text-sm ${normativeComparison.color}`}>{normativeComparison.description}</p>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Measure</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Value</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-200">
                            <tr className="bg-blue-50">
                              <td className="px-4 py-3 text-sm font-medium text-slate-900">Client Score</td>
                              <td className="px-4 py-3 text-sm text-slate-900 font-bold">{clientAssessment.result_value} {assessment.unit_of_measure}</td>
                            </tr>
                            <tr>
                              <td className="px-4 py-3 text-sm text-slate-900">Mean (Average)</td>
                              <td className="px-4 py-3 text-sm text-slate-900">{normativeData.mean} {assessment.unit_of_measure}</td>
                            </tr>
                            <tr>
                              <td className="px-4 py-3 text-sm text-slate-900">25th Percentile</td>
                              <td className="px-4 py-3 text-sm text-slate-900">{normativeData.percentile_25} {assessment.unit_of_measure}</td>
                            </tr>
                            <tr>
                              <td className="px-4 py-3 text-sm text-slate-900">75th Percentile</td>
                              <td className="px-4 py-3 text-sm text-slate-900">{normativeData.percentile_75} {assessment.unit_of_measure}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-500">
                        No normative data available for this client's age ({clientAge} years) and gender ({client.gender}).
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}