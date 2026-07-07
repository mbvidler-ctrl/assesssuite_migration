import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Save, Info, AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const K10_QUESTIONS = [
  "In the past 4 weeks, about how often did you feel tired out for no good reason?",
  "In the past 4 weeks, about how often did you feel nervous?",
  "In the past 4 weeks, about how often did you feel so nervous that nothing could calm you down?",
  "In the past 4 weeks, about how often did you feel hopeless?",
  "In the past 4 weeks, about how often did you feel restless or fidgety?",
  "In the past 4 weeks, about how often did you feel so restless you could not sit still?",
  "In the past 4 weeks, about how often did you feel depressed?",
  "In the past 4 weeks, about how often did you feel that everything was an effort?",
  "In the past 4 weeks, about how often did you feel so sad that nothing could cheer you up?",
  "In the past 4 weeks, about how often did you feel worthless?"
];

const RESPONSE_OPTIONS = [
  { value: 1, label: "None of the time" },
  { value: 2, label: "A little of the time" },
  { value: 3, label: "Some of the time" },
  { value: 4, label: "Most of the time" },
  { value: 5, label: "All of the time" }
];

export default function K10Runner({ onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [expandedSection, setExpandedSection] = useState("overview");

  const handleResponseChange = (questionIndex, value) => {
    setResponses(prev => {
      const newResponses = { ...prev, [questionIndex]: value };
      
      // Auto-skip logic: If Q2 answered "none of the time", auto-set Q3 to 1
      if (questionIndex === 1 && value === 1) {
        newResponses[2] = 1;
      }
      // Auto-skip logic: If Q5 answered "none of the time", auto-set Q6 to 1
      if (questionIndex === 4 && value === 1) {
        newResponses[5] = 1;
      }
      
      return newResponses;
    });
  };

  const calculateTotal = () => {
    return Object.values(responses).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
  };

  const getInterpretation = (total) => {
    if (total < 20) return { severity: "Likely to be well", color: "text-green-600", bg: "bg-green-50", risk: "low" };
    if (total <= 24) return { severity: "Likely to have a mild disorder", color: "text-blue-600", bg: "bg-blue-50", risk: "mild" };
    if (total <= 29) return { severity: "Likely to have a moderate disorder", color: "text-yellow-600", bg: "bg-yellow-50", risk: "moderate" };
    return { severity: "Likely to have a severe disorder", color: "text-red-600", bg: "bg-red-50", risk: "severe" };
  };

  const handleSave = () => {
    if (Object.keys(responses).length < 10) {
      toast.error("Please answer all 10 questions");
      return;
    }

    const total = calculateTotal();
    const interpretation = getInterpretation(total);

    // Build detailed SOAP text with all responses
    let soapText = `Kessler Psychological Distress Scale (K10):\n`;
    soapText += `Total Score: ${total}/50\n`;
    soapText += `Severity: ${interpretation.severity}\n`;
    soapText += `Risk Level: ${interpretation.risk}\n\n`;
    soapText += `Individual Item Responses:\n`;
    K10_QUESTIONS.forEach((question, idx) => {
      const response = responses[idx];
      if (response !== undefined) {
        const responseLabel = RESPONSE_OPTIONS.find(opt => opt.value === response)?.label || '';
        soapText += `Q${idx + 1}: ${responseLabel} (${response})\n`;
      }
    });

    onSave({
      responses,
      total_score: total,
      severity: interpretation.severity,
      risk_level: interpretation.risk,
      assessment_date: new Date().toISOString().split('T')[0],
      additional_data: {
        measurement_type: "k10_distress_scale",
        total_score: total,
        severity: interpretation.severity,
        risk_level: interpretation.risk,
        individual_responses: responses,
        soap_text: soapText
      }
    });
  };

  const total = calculateTotal();
  const interpretation = total >= 10 ? getInterpretation(total) : null;
  const allAnswered = Object.keys(responses).length === 10;

  // Check if Q3 and Q6 should be auto-skipped
  const shouldShowQ3 = responses[1] !== 1;
  const shouldShowQ6 = responses[4] !== 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">K10</h2>
              <p className="text-slate-600 mt-1">Kessler Psychological Distress Scale</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            
            {/* Expandable Clinician Overview */}
            <button
              onClick={() => setExpandedSection(expandedSection === "overview" ? null : "overview")}
              className="w-full flex justify-between items-center px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg font-semibold text-blue-900 hover:bg-blue-100 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                Clinician Overview & Administration
              </span>
              {expandedSection === "overview" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expandedSection === "overview" && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6 space-y-4 text-sm">
                  <div>
                    <p className="font-semibold text-blue-900 mb-2">Purpose & Clinical Use</p>
                    <p className="text-blue-800 mb-2">
                      The Kessler Psychological Distress Scale (K10) is a <strong>brief screening tool</strong> designed to identify non-specific psychological distress in the general population. It is <strong>not diagnostic</strong> for any mental health condition, but serves as a sensitive indicator that further assessment may be warranted.
                    </p>
                    <ul className="text-blue-800 list-disc list-inside space-y-1">
                      <li>Primary use in Australian primary care (Medicare Mental Health Plans)</li>
                      <li>Rapid screening in injury/rehabilitation rehabilitation settings</li>
                      <li>Identifies clients who may benefit from psychological referral or support</li>
                      <li>Monitoring distress changes over the course of treatment</li>
                      <li>Population-level mental health surveillance</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-blue-900 mb-2">Administration Protocol</p>
                    <ul className="text-blue-800 space-y-2 list-disc list-inside">
                      <li><strong>Timeframe:</strong> Questions specifically ask about the past 4 weeks. This is a fixed window and should be used consistently.</li>
                      <li><strong>Response Format:</strong> 5-point Likert scale from "None of the time" (1) to "All of the time" (5).</li>
                      <li><strong>Auto-Skip Logic:</strong> If Q2 (nervous) is answered "1", Q3 (so nervous nothing could calm you) is automatically scored as 1. Same for Q5 (restless) and Q6 (too restless to sit still).</li>
                      <li><strong>Completion Time:</strong> 2–3 minutes for client response.</li>
                      <li><strong>Setting:</strong> Can be administered in clinic or self-completed. Ensure privacy and confidentiality.</li>
                      <li><strong>Readability:</strong> Questions are written at approximately Year 6–7 literacy level, suitable for most Australian adults.</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-blue-900 mb-2">Scope of Practice & Professional Responsibility</p>
                    <div className="bg-white p-3 rounded border border-blue-300 space-y-2">
                      <p className="text-blue-800"><strong>Who Can Administer:</strong> The K10 can be used by any trained healthcare professional including allied health practitioners (physiotherapists, occupational therapists, exercise physiologists), nurses, and GPs. No specialized credential is required for administration.</p>
                      <p className="text-blue-800"><strong>Clinical Responsibility:</strong> Clinicians using the K10 must <strong>understand its limitations</strong> as a screening tool. Abnormal scores require <strong>appropriate GP or psychology referral</strong> rather than independent diagnosis or treatment initiation by non-mental-health professionals.</p>
                      <p className="text-blue-800"><strong>Informed Consent:</strong> Clients should be informed that the K10 is a brief screening tool and that results will inform referral decisions if warranted. Maintain confidentiality of responses consistent with your professional standards.</p>
                      <p className="text-blue-800"><strong>Documentation:</strong> Record K10 score, interpretation, and any referrals made in the clinical record. Note the date and context of administration.</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-blue-900 mb-2">What K10 Does NOT Do</p>
                    <div className="bg-white p-3 rounded border border-blue-300 space-y-2">
                      <p className="text-blue-800"><strong>❌ K10 is NOT diagnostic:</strong> High scores do not diagnose depression, anxiety, PTSD, or any specific mental health disorder. Diagnosis requires comprehensive assessment by a qualified mental health professional (psychologist, psychiatrist).</p>
                      <p className="text-blue-800"><strong>❌ K10 does not measure:</strong> Specific symptoms of particular disorders, functional impairment in detail, suicidality, substance use, personality traits, or cognitive ability.</p>
                      <p className="text-blue-800"><strong>❌ K10 is not:</strong> A replacement for clinical interview, comprehensive mental health assessment, or formal diagnostic instruments (e.g., DSM-5 criteria).</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-blue-900 mb-2">Score Interpretation & Clinical Thresholds</p>
                    <div className="bg-white p-3 rounded border border-blue-300 space-y-2 text-xs">
                      <p className="text-blue-800"><strong>Score 10–19 ("Likely well"):</strong> Client reports minimal psychological distress in the past 4 weeks. Consistent with general population norms. Continue monitoring; supportive care as needed.</p>
                      <p className="text-blue-800"><strong>Score 20–24 ("Mild disorder likely"):</strong> Elevated distress but not severe. Warrants GP consultation; consider brief psychological intervention or support. Monitor at follow-up appointments.</p>
                      <p className="text-blue-800"><strong>Score 25–29 ("Moderate disorder likely"):</strong> Significant distress. <strong>Recommend GP or psychology referral</strong> for comprehensive mental health assessment. May benefit from formal psychological or psychiatric evaluation.</p>
                      <p className="text-blue-800"><strong>Score 30–50 ("Severe disorder likely"):</strong> High level of distress. <strong>Urgent GP or mental health referral warranted.</strong> Consider risk assessment (if applicable). Document and communicate findings to client's GP and relevant care team.</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-blue-900 mb-2">Referral Pathways in Australia</p>
                    <div className="bg-white p-3 rounded border border-blue-300 space-y-2 text-xs">
                      <p className="text-blue-800"><strong>Medicare Mental Health Plans (MHCP):</strong> If a client scores ≥20, GP can refer for up to 10 psychological sessions with Medicare rebate under items 2715 (assessment) and 2717 (treatment).</p>
                      <p className="text-blue-800"><strong>Beyond Blue:</strong> <a href="https://www.beyondblue.org.au/" target="_blank" className="text-blue-600 underline flex items-center gap-1">www.beyondblue.org.au <ExternalLink className="w-3 h-3" /></a> — Free phone counselling (1300 224 636) and online support for anyone experiencing anxiety or depression.</p>
                      <p className="text-blue-800"><strong>Lifeline:</strong> <a href="https://www.lifeline.org.au/" target="_blank" className="text-blue-600 underline flex items-center gap-1">www.lifeline.org.au <ExternalLink className="w-3 h-3" /></a> — Crisis support (13 11 14) for people in distress.</p>
                      <p className="text-blue-800"><strong>Australian Psychological Society:</strong> <a href="https://www.psychology.org.au/" target="_blank" className="text-blue-600 underline flex items-center gap-1">www.psychology.org.au <ExternalLink className="w-3 h-3" /></a> — Find registered psychologists in your area.</p>
                      <p className="text-blue-800"><strong>WorkCover/Comcare:</strong> For work-injured clients, psychological services may be covered under workplace injury rehabilitation provisions.</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-blue-900 mb-2">Clinical Considerations in Rehabilitation Context</p>
                    <ul className="text-blue-800 space-y-2 list-disc list-inside">
                      <li><strong>Injury-Related Distress:</strong> Psychological distress is common during injury recovery. K10 helps identify clients whose distress level warrants mental health support alongside physical rehabilitation.</li>
                      <li><strong>Confounding Stressors:</strong> Consider life stressors beyond injury (financial, family, work-related) when interpreting elevated scores.</li>
                      <li><strong>Medication Effects:</strong> Some medications can affect mood and distress perception. Note any analgesics or other medications in clinical documentation.</li>
                      <li><strong>Fear-Avoidance:</strong> High psychological distress may be related to fear of movement/re-injury. Address through graded exposure and cognitive-behavioral strategies.</li>
                      <li><strong>Serial Monitoring:</strong> Repeat K10 at regular intervals to track changes in distress over treatment course.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Instructions for Client */}
            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-green-600" />
                  Client Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-green-800">
                  The following questions ask about how you have been feeling during the <strong>past 4 weeks</strong>. 
                  For each question, please select the response that best describes how often you felt or behaved this way.
                </p>
                <p className="text-sm text-green-800 italic">"These questions are about how you have been feeling. There are no right or wrong answers. Please answer honestly."</p>
              </CardContent>
            </Card>

            {/* Score Interpretation Reference */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Score Interpretation (/50)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Score</th><th className="p-2 text-left">Interpretation</th><th className="p-2 text-left">Clinical Action</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2 font-medium">10–19</td><td className="p-2 text-green-700 font-medium">Likely well</td><td className="p-2">Continue supportive care; monitor at follow-ups</td></tr>
                    <tr className="border-t bg-white"><td className="p-2 font-medium">20–24</td><td className="p-2 text-yellow-700 font-medium">Mild distress likely</td><td className="p-2">GP consultation; consider brief intervention or monitoring</td></tr>
                    <tr className="border-t"><td className="p-2 font-medium">25–29</td><td className="p-2 text-orange-700 font-medium">Moderate distress likely</td><td className="p-2"><strong>Recommend GP or psychology referral</strong> for comprehensive assessment</td></tr>
                    <tr className="border-t bg-white"><td className="p-2 font-medium">30–50</td><td className="p-2 text-red-700 font-medium">Severe distress likely</td><td className="p-2"><strong>Urgent mental health referral;</strong> consider risk assessment</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Important: Non-Diagnostic Statement */}
            <Card className="bg-red-50 border-red-200 border-2">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-bold text-red-900 mb-2">⚠ IMPORTANT: This is a Screening Tool, NOT a Diagnosis</p>
                    <p className="text-sm text-red-800 mb-2">
                      The K10 <strong>cannot diagnose</strong> depression, anxiety, PTSD, or any mental health disorder. A high score indicates that further assessment by a mental health professional (psychologist, psychiatrist) is recommended, but does not confirm any diagnosis.
                    </p>
                    <p className="text-sm text-red-800">
                      Diagnosis requires comprehensive clinical interview, detailed symptom assessment, and evaluation of functional impact by a qualified mental health professional.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Evidence Base */}
            <Card className="bg-slate-100 border-slate-300">
              <CardHeader>
                <CardTitle className="text-lg">📖 Evidence Base & Key References</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-700 space-y-3">
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Primary Development Study</p>
                  <p>Kessler RC et al. (2002). Short screening scales to monitor population prevalences and trends in non-specific psychological distress. <em>Psychological Medicine, 32</em>(6), 959–976.</p>
                  <a href="https://doi.org/10.1017/S0033291702006074" target="_blank" className="text-blue-600 underline flex items-center gap-1 mt-1">
                    View full text <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Australian Validation & Interpretation</p>
                  <p>Andrews G & Slade T. (2001). Interpreting scores on the Kessler Psychological Distress Scale (K10). <em>Australian and New Zealand Journal of Public Health, 25</em>(6), 494–497.</p>
                  <a href="https://doi.org/10.1111/j.1467-842X.2001.tb00294.x" target="_blank" className="text-blue-600 underline flex items-center gap-1 mt-1">
                    View full text <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Australian Mental Health Information Platform (amhocn.org)</p>
                  <p>Guidelines and use in Australian mental health and primary care settings.</p>
                  <a href="https://www.amhocn.org/" target="_blank" className="text-blue-600 underline flex items-center gap-1 mt-1">
                    Visit AMHOCN <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Psychometric Properties</p>
                  <p>Sensitivity 88%, Specificity 73% for detecting non-specific psychological distress. Test-retest reliability ICC = 0.80 (good). Cronbach's alpha ≈ 0.93 (excellent internal consistency).</p>
                </div>
              </CardContent>
            </Card>

            {/* Questions */}
            {K10_QUESTIONS.map((question, index) => {
              // Auto-skip Q3 if Q2 was "none of the time"
              if (index === 2 && !shouldShowQ3) {
                return (
                  <Card key={index} className="border-slate-200 bg-slate-50/50">
                    <CardHeader>
                      <CardTitle className="text-base font-semibold text-slate-600">
                        {index + 1}. {question}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline" className="bg-blue-100">
                        Auto-skipped (Q2 answered "None of the time")
                      </Badge>
                    </CardContent>
                  </Card>
                );
              }

              // Auto-skip Q6 if Q5 was "none of the time"
              if (index === 5 && !shouldShowQ6) {
                return (
                  <Card key={index} className="border-slate-200 bg-slate-50/50">
                    <CardHeader>
                      <CardTitle className="text-base font-semibold text-slate-600">
                        {index + 1}. {question}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline" className="bg-blue-100">
                        Auto-skipped (Q5 answered "None of the time")
                      </Badge>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <Card key={index} className={responses[index] !== undefined ? "border-green-200 bg-green-50/30" : ""}>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-slate-900">
                      {index + 1}. {question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {RESPONSE_OPTIONS.map(option => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={responses[index] === option.value ? "default" : "outline"}
                          onClick={() => handleResponseChange(index, option.value)}
                          className={`h-auto py-3 px-2 text-xs ${
                            responses[index] === option.value 
                              ? 'bg-purple-600 text-white' 
                              : 'hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-bold">{option.value}</span>
                            <span className="text-[10px] leading-tight text-center">{option.label}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Score Summary */}
            {allAnswered && interpretation && (
              <Card className={`${interpretation.bg} border-2`}>
                <CardContent className="py-6">
                  <div className="text-center space-y-3">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Total Score</p>
                      <p className="text-5xl font-bold text-slate-900">{total} / 50</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Interpretation</p>
                      <p className={`text-2xl font-bold ${interpretation.color}`}>
                        {interpretation.severity}
                      </p>
                    </div>
                    <div className="text-xs text-slate-600 pt-3 border-t">
                      <p>Well: 10-19 | Mild: 20-24 | Moderate: 25-29 | Severe: 30-50</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* High Distress Alert */}
            {total >= 30 && (
              <Card className="bg-red-50 border-red-300 border-2">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-red-900 mb-1">High Psychological Distress Detected</p>
                      <p className="text-sm text-red-800">
                        This score suggests severe psychological distress. Consider referral to GP or mental health professional for comprehensive assessment and treatment planning.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Auto-Skip and Scoring Notes */}
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="py-4 text-xs text-amber-800 space-y-2">
                <p><strong>Auto-Skip Logic:</strong> If Q2 "nervous" is answered "None of the time", Q3 "so nervous nothing could calm you" is automatically set to 1. Similarly, if Q5 "restless" is "None of the time", Q6 "too restless to sit still" is set to 1. This reflects the conditional structure of the original questionnaire.</p>
                <p><strong>Scoring:</strong> Sum all 10 responses (range 10–50). Lower scores indicate less distress, higher scores indicate greater distress.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <div className="text-sm text-slate-600">
            {Object.keys(responses).length} / 10 questions answered
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!allAnswered}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Save K10 Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}