import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const PCL5_ITEMS = [
  { id: 1, text: "Repeated, disturbing, and unwanted memories of the stressful experience?" },
  { id: 2, text: "Repeated, disturbing dreams of the stressful experience?" },
  { id: 3, text: "Suddenly feeling or acting as if the stressful experience were happening again (as if you were reliving it)?" },
  { id: 4, text: "Feeling very upset when something reminded you of the stressful experience?" },
  { id: 5, text: "Having strong physical reactions when something reminded you of the stressful experience (for example, heart pounding, sweating, or trembling)?" },
  { id: 6, text: "Avoiding memories, thoughts, or feelings related to the stressful experience?" },
  { id: 7, text: "Avoiding external reminders of the stressful experience (for example, people, places, conversations, activities, objects, or situations)?" },
  { id: 8, text: "Trouble remembering important parts of the stressful experience?" },
  { id: 9, text: "Having strong negative beliefs about yourself, other people, or the world (for example, having thoughts such as: I am bad, there is something seriously wrong with me, no one can be trusted, the world is completely dangerous)?" },
  { id: 10, text: "Blaming yourself or the other person for the stressful experience or what happened after it?" },
  { id: 11, text: "Having strong negative feelings such as fear, anger, guilt, or shame?" },
  { id: 12, text: "Loss of interest in activities that you used to enjoy?" },
  { id: 13, text: "Feeling distant or cut off from other people?" },
  { id: 14, text: "Trouble experiencing positive emotions (for example, you were unable to feel happiness or have loving feelings for people close to you)?" },
  { id: 15, text: "Irritable behavior, angry outbursts, or acting aggressively?" },
  { id: 16, text: "Taking too many risks or doing things that could cause you harm?" },
  { id: 17, text: "Being \"on guard\" or watchful or suspicious of others around you?" },
  { id: 18, text: "Trouble concentrating?" },
  { id: 19, text: "Trouble falling or staying asleep?" },
  { id: 20, text: "Trouble controlling your temper?" },
];

const RESPONSE_OPTIONS = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "A little bit" },
  { value: 2, label: "Moderately" },
  { value: 3, label: "Quite a bit" },
  { value: 4, label: "Extremely" },
];

export default function PCL5Runner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");
  const [showClinicianInfo, setShowClinicianInfo] = useState(false);

  const handleResponseChange = (itemId, value) => {
    setResponses(prev => ({ ...prev, [itemId]: value }));
  };

  const getTotalScore = () => {
    const allResponses = Object.values(responses).filter(r => r !== undefined);
    if (allResponses.length === 0) return null;
    return allResponses.reduce((acc, val) => acc + val, 0);
  };

  const getSeverityLevel = (score) => {
    if (score < 14) return { level: "Minimal", color: "text-green-600", bg: "bg-green-50" };
    if (score < 28) return { level: "Mild", color: "text-yellow-600", bg: "bg-yellow-50" };
    if (score < 44) return { level: "Moderate", color: "text-orange-600", bg: "bg-orange-50" };
    if (score < 59) return { level: "Severe", color: "text-red-600", bg: "bg-red-50" };
    return { level: "Extreme", color: "text-red-800", bg: "bg-red-100" };
  };

  const isAllAnswered = Object.keys(responses).length === PCL5_ITEMS.length;
  const totalScore = getTotalScore();
  const severity = totalScore !== null ? getSeverityLevel(totalScore) : null;

  const handleSave = () => {
    if (!isAllAnswered) {
      toast.error(`Please answer all 20 questions (${Object.keys(responses).length}/20 completed)`);
      return;
    }

    const soapText = `• PCL-5 (PTSD Checklist for DSM-5)\n  Total Score: ${totalScore}/80\n  Severity: ${severity.level}\n  Interpretation: ${
      totalScore >= 33 ? "Probable PTSD diagnosis (clinical cutoff >= 33)" :
      totalScore >= 14 ? "Subclinical PTSD symptoms; monitor and reassess" :
      "Minimal PTSD symptoms"
    }`;

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        soap_text: soapText,
        total_score: totalScore,
        severity_level: severity.level,
        measurement_type: "pcl5",
        raw_responses: responses,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("PCL-5 assessment completed and saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">PCL-5</h2>
              <p className="text-slate-600 mt-1">PTSD Checklist for DSM-5</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            
            {/* Patient Instructions */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800">
                <p>Below is a list of problems and complaints that people sometimes have in response to a very stressful experience. Please rate how much you have been bothered by that problem in the <strong>past month</strong>.</p>
                <p className="mt-2"><strong>Response Scale: 0 = Not at all, 1 = A little bit, 2 = Moderately, 3 = Quite a bit, 4 = Extremely</strong></p>
              </CardContent>
            </Card>

            {/* Clinician Info */}
            <button
              className="w-full flex justify-between items-center px-4 py-3 bg-red-50 border border-red-200 rounded-lg font-semibold text-red-900 text-sm hover:bg-red-100 transition-colors"
              onClick={() => setShowClinicianInfo(!showClinicianInfo)}
            >
              <span className="flex items-center gap-2">📋 Clinician Information & Evidence</span>
              {showClinicianInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showClinicianInfo && (
              <Card className="bg-red-50 border-red-200">
                <CardContent className="pt-6 space-y-4 text-sm">
                  <div>
                    <p className="font-semibold text-red-900 mb-2">Purpose & Clinical Context</p>
                    <p className="text-red-800">
                      The PCL-5 (PTSD Checklist for DSM-5) is a 20-item self-report measure assessing PTSD symptoms aligned with DSM-5 diagnostic criteria. It evaluates symptoms across 4 clusters: re-experiencing, avoidance, negative alterations in cognitions/mood, and hyperarousal. The PCL-5 is widely used in clinical practice, research, and screening for PTSD in trauma-exposed populations.
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-red-900 mb-2">DSM-5 PTSD Symptom Clusters</p>
                    <div className="bg-white p-3 rounded border border-red-100 space-y-2">
                      <div>
                        <p className="font-semibold text-red-900 text-xs">🔴 <strong>Cluster B — Re-experiencing (Items 1–5)</strong></p>
                        <p className="text-red-800 text-xs">Intrusive thoughts, nightmares, flashbacks, physiological reactivity to trauma reminders. At least 1 symptom required for PTSD diagnosis.</p>
                      </div>
                      <div>
                        <p className="font-semibold text-red-900 text-xs">🟠 <strong>Cluster C — Avoidance (Items 6–7)</strong></p>
                        <p className="text-red-800 text-xs">Avoidance of trauma-related thoughts/feelings and external reminders. At least 1 symptom required for PTSD diagnosis.</p>
                      </div>
                      <div>
                        <p className="font-semibold text-red-900 text-xs">🟡 <strong>Cluster D — Negative Alterations in Cognitions & Mood (Items 8–14)</strong></p>
                        <p className="text-red-800 text-xs">Memory gaps, negative self/world beliefs, blame, persistent negative emotions, anhedonia, social withdrawal, inability to experience positive emotions. At least 2 symptoms required for PTSD diagnosis.</p>
                      </div>
                      <div>
                        <p className="font-semibold text-red-900 text-xs">🔵 <strong>Cluster E — Hyperarousal (Items 15–20)</strong></p>
                        <p className="text-red-800 text-xs">Irritability, recklessness, hypervigilance, concentration difficulties, sleep disturbance, aggressive behavior. At least 2 symptoms required for PTSD diagnosis.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-red-900 mb-2">Scoring & Interpretation</p>
                    <div className="bg-white p-3 rounded border border-red-100 space-y-2 text-xs">
                      <p className="text-red-800"><strong>Total Score Range:</strong> 0–80</p>
                      <p className="text-red-800"><strong>Minimal (0–13):</strong> No/minimal PTSD symptoms.</p>
                      <p className="text-red-800"><strong>Mild (14–27):</strong> Subclinical symptoms; may meet partial PTSD criteria.</p>
                      <p className="text-red-800"><strong>Moderate (28–43):</strong> Moderate symptom severity; likely meets full PTSD criteria.</p>
                      <p className="text-red-800"><strong>Severe (44–58):</strong> Severe PTSD symptoms; significant functional impairment.</p>
                      <p className="text-red-800"><strong>Extreme (59–80):</strong> Extreme PTSD severity; urgent treatment needed.</p>
                      <p className="text-red-800 mt-2"><strong>⚠ï¸ Clinical Cutoff:</strong> Score ≥33 suggests probable PTSD diagnosis. Score ≥31 (alternative cutoff) also used in some populations.</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-red-900 mb-2">Psychometric Properties</p>
                    <ul className="text-red-800 list-disc list-inside space-y-1 text-xs">
                      <li><strong>Sensitivity:</strong> 0.94 (excellent); detects PTSD cases well.</li>
                      <li><strong>Specificity:</strong> 0.95 (excellent); minimizes false positives.</li>
                      <li><strong>Internal Consistency (α):</strong> 0.96 (excellent).</li>
                      <li><strong>Test-Retest Reliability:</strong> r = 0.84 (strong).</li>
                      <li><strong>Responsiveness:</strong> Sensitive to symptom change over 2–4 weeks treatment.</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-red-900 mb-2">Clinical Decision-Making</p>
                    <div className="bg-white p-3 rounded border border-red-100 space-y-2 text-xs">
                      <p className="text-red-800"><strong>✅ Score ≥33 + trauma history + functional impairment:</strong> Probable PTSD. Recommend specialist referral (psychiatry/trauma-informed psychology), evidence-based treatment (CBT, EMDR, prolonged exposure).</p>
                      <p className="text-red-800"><strong>⚠ï¸ Score 14–32 + trauma history:</strong> Subclinical PTSD; elevated risk. Recommend psychoeducation, stress management, peer support, repeat assessment in 4 weeks.</p>
                      <p className="text-red-800"><strong>âŒ Score &lt;14 + trauma history:</strong> Minimal symptoms. Monitor; normal stress response. Reassure and offer support.</p>
                      <p className="text-red-800"><strong>🆘 Score &gt;59 + acute distress:</strong> Urgent psychiatric evaluation; assess suicide/self-harm risk, crisis support, possible inpatient treatment.</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-red-900 mb-2">Evidence Base & References</p>
                    <div className="bg-white p-3 rounded border border-red-100 space-y-2 text-xs">
                      <p><strong>PCL-5 Development:</strong> Weathers FW, et al. (2013). The PTSD Checklist for DSM-5 (PCL-5). <em>National Center for PTSD</em>.</p>
                      <p><strong>Validation Study:</strong> Blevins CA, Weathers FW, Davis MT, et al. (2015). The Posttraumatic Stress Disorder Checklist for DSM-5 (PCL-5): Development and initial psychometric evaluation. <em>Journal of Traumatic Stress, 28</em>(6), 489–498.</p>
                      <p><strong>Clinical Utility:</strong> Bovin MJ, Marx BP. (2011). The importance of the DSM-5 PTSD criterion structure: Comment on the Diagnostic Criteria for PTSD. <em>Journal of Anxiety Disorders</em>.</p>
                      <p><strong>Australian Context:</strong> RANZCP (Royal Australian and New Zealand College of Psychiatrists) and Phoenix Australia recommend PCL-5 for PTSD screening and monitoring.</p>
                      <Button
                        onClick={() => window.open('https://www.ptsd.va.gov/professional/assessment/adult-sr/ptsd-checklist.asp', '_blank')}
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 w-full justify-start mt-2"
                      >
                        <ExternalLink className="w-3 h-3 mr-2" />
                        Official PCL-5 (VA National Center for PTSD)
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-red-900 mb-2">Clinical Recommendations</p>
                    <ul className="text-red-800 list-disc list-inside space-y-1 text-xs">
                      <li><strong>Trauma-informed approach:</strong> Normalize responses, validate experience, emphasize resilience.</li>
                      <li><strong>Safety assessment:</strong> Always assess suicide/self-harm risk, especially if score &gt;59.</li>
                      <li><strong>Functional assessment:</strong> PCL-5 score should correlate with functional impairment (work, relationships, self-care).</li>
                      <li><strong>Serial monitoring:</strong> Repeat PCL-5 every 4 weeks during treatment to track progress.</li>
                      <li><strong>Evidence-based treatment:</strong> Cognitive Processing Therapy (CPT), Prolonged Exposure (PE), Eye Movement Desensitization and Reprocessing (EMDR), Cognitive Behavioral Therapy (CBT).</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Progress */}
            <div className="text-center text-sm text-slate-600">
              {Object.keys(responses).length} / {PCL5_ITEMS.length} questions answered
            </div>

            {/* Items */}
            <div className="space-y-4">
              {PCL5_ITEMS.map((item) => (
                <Card key={item.id} className={responses[item.id] !== undefined ? "border-green-200 bg-green-50/30" : ""}>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">
                      {item.id}. {item.text}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-5 gap-2">
                      {RESPONSE_OPTIONS.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={responses[item.id] === option.value ? "default" : "outline"}
                          onClick={() => handleResponseChange(item.id, option.value)}
                          className={`h-auto py-2 px-1 text-xs ${
                            responses[item.id] === option.value ? "bg-red-600 text-white" : "hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-bold">{option.value}</span>
                            <span className="text-[9px] leading-tight text-center">{option.label}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Score Display */}
            {isAllAnswered && severity && (
              <div className="space-y-3">
                <Card className={`${severity.bg} border-2`}>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-slate-600 mb-2">Total Score</p>
                      <p className={`text-4xl font-bold ${severity.color}`}>{totalScore}</p>
                      <p className="text-sm text-slate-600 mt-2">/ 80</p>
                      <p className={`text-lg font-semibold ${severity.color} mt-3`}>{severity.level} PTSD Severity</p>
                      {totalScore >= 33 && (
                        <p className="text-xs text-red-700 mt-2 font-semibold">⚠ï¸ Score indicates probable PTSD diagnosis</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Clinical Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Clinical observations, trauma history, functional impact, safety concerns, treatment recommendations..."
                      rows={4}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isAllAnswered} className="bg-red-600 hover:bg-red-700">
            <Save className="w-4 h-4 mr-2" />
            Save PCL-5 Results
          </Button>
        </div>
      </div>
    </div>
  );
}