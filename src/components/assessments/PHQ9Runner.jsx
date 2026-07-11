import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const PHQ9_QUESTIONS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself - or that you are a failure or have let yourself or your family down",
  "Trouble concentrating on things, such as reading the newspaper or watching television",
  "Moving or speaking so slowly that other people could have noticed. Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual",
  "Thoughts that you would be better off dead, or of hurting yourself in some way"
];

const RESPONSE_OPTIONS = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" }
];

export default function PHQ9Runner({ onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [functionalImpact, setFunctionalImpact] = useState('');

  const handleResponseChange = (questionIndex, value) => {
    setResponses(prev => ({ ...prev, [questionIndex]: value }));
  };

  const calculateTotal = () => {
    return Object.values(responses).reduce((sum, val) => sum + val, 0);
  };

  const getInterpretation = (total) => {
    if (total <= 4) return { severity: "Minimal Depression", color: "text-green-600", bg: "bg-green-50" };
    if (total <= 9) return { severity: "Mild Depression", color: "text-blue-600", bg: "bg-blue-50" };
    if (total <= 14) return { severity: "Moderate Depression", color: "text-yellow-600", bg: "bg-yellow-50" };
    if (total <= 19) return { severity: "Moderately Severe Depression", color: "text-orange-600", bg: "bg-orange-50" };
    return { severity: "Severe Depression", color: "text-red-600", bg: "bg-red-50" };
  };

  const handleSave = () => {
    if (Object.keys(responses).length < 9) {
      toast.error("Please answer all 9 questions");
      return;
    }

    if (responses[8] > 0) {
      toast.warning("Client endorsed suicidal ideation (Q9) - clinical follow-up required", {
        duration: 8000
      });
    }

    const total = calculateTotal();
    const interpretation = getInterpretation(total);
    const today = todayLocal();

    const questionLines = PHQ9_QUESTIONS.map((q, i) => {
      const val = responses[i];
      const label = RESPONSE_OPTIONS.find(o => o.value === val)?.label || '';
      return `    Q${i + 1}. ${q}: ${val}/3 — ${label}`;
    }).join('\n');

    const soapText = [
      `• PHQ-9 (Patient Health Questionnaire-9)`,
      `  Total Score: ${total}/27 → ${interpretation.severity}`,
      `  Severity Bands: 0–4 Minimal | 5–9 Mild | 10–14 Moderate | 15–19 Moderately Severe | 20–27 Severe`,
      `  Item Responses (Over the last 2 weeks, how often bothered by...):`,
      questionLines,
      functionalImpact ? `  Functional Impact: ${functionalImpact}` : null,
      responses[8] > 0 ? `  ⚠ ALERT: Suicidal ideation endorsed (Q9) — clinical follow-up and safety planning required.` : null,
    ].filter(Boolean).join('\n');

    onSave({
      status: "completed",
      result_value: total,
      additional_data: {
        responses,
        severity: interpretation.severity,
        functional_impact: functionalImpact,
        suicidal_ideation_endorsed: responses[8] > 0,
        soap_text: soapText,
      },
      assessment_date: today,
    });
  };

  const total = calculateTotal();
  const interpretation = total > 0 ? getInterpretation(total) : null;
  const allAnswered = Object.keys(responses).length === 9;
  const hasPositiveQ9 = responses[8] > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">PHQ-9</h2>
              <p className="text-slate-600 mt-1">Patient Health Questionnaire for Depression</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Instructions */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  📋 Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-blue-800 italic">
                  "Over the last 2 weeks, how often have you been bothered by any of the following problems?"
                </p>
                <p className="text-sm text-blue-800"><strong>Timeframe:</strong> Past 2 weeks. Self-administered or clinician-administered. Always follow up on Q9 if positive.</p>
              </CardContent>
            </Card>

            {/* Norms */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Score Interpretation (/27)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Score</th><th className="p-2 text-left">Severity</th><th className="p-2 text-left">Action</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">0–4</td><td className="p-2 text-green-700">Minimal depression</td><td className="p-2">None required</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">5–9</td><td className="p-2 text-yellow-700">Mild depression</td><td className="p-2">Watchful waiting; repeat PHQ-9</td></tr>
                    <tr className="border-t"><td className="p-2">10–14</td><td className="p-2 text-orange-700">Moderate depression</td><td className="p-2">Treatment plan; consider referral</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">15–19</td><td className="p-2 text-red-600">Moderately severe</td><td className="p-2">Active treatment/referral</td></tr>
                    <tr className="border-t"><td className="p-2">20–27</td><td className="p-2 text-red-800">Severe depression</td><td className="p-2">Urgent referral to mental health</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">MCID: ~5 points. Sensitivity 88%, Specificity 88% for MDD at ≥10. Source: Kroenke et al. (2001).</p>
            </div>

            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>Kroenke K, Spitzer RL, & Williams JBW. (2001). The PHQ-9: Validity of a brief depression severity measure. <em>Journal of General Internal Medicine, 16</em>(9), 606–613.</p>
            </div>

            {/* Questions */}
            {PHQ9_QUESTIONS.map((question, index) => (
              <Card 
                key={index} 
                className={`${
                  responses[index] !== undefined ? "border-green-200 bg-green-50/30" : ""
                } ${
                  index === 8 && responses[index] > 0 ? "border-red-300 bg-red-50" : ""
                }`}
              >
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-900 flex items-start justify-between">
                    <span>{index + 1}. {question}</span>
                    {index === 8 && (
                      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 ml-2">
                        Safety Question
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {RESPONSE_OPTIONS.map(option => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={responses[index] === option.value ? "default" : "outline"}
                        onClick={() => handleResponseChange(index, option.value)}
                        className={`h-auto py-3 px-2 text-xs ${
                          responses[index] === option.value 
                            ? index === 8 && option.value > 0
                              ? 'bg-red-600 text-white'
                              : 'bg-blue-600 text-white'
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
            ))}

            {/* Suicidal Ideation Alert */}
            {hasPositiveQ9 && (
              <Card className="bg-red-50 border-red-300 border-2">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                      !
                    </div>
                    <div>
                      <p className="font-bold text-red-900 mb-1">Suicidal Ideation Endorsed</p>
                      <p className="text-sm text-red-800">
                        Client has endorsed thoughts of self-harm. Ensure appropriate clinical follow-up, safety planning, and referral to mental health services if indicated.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Functional Impact Question */}
            {allAnswered && total > 0 && (
              <Card className="bg-purple-50 border-purple-200">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Functional Impact
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-purple-800 mb-3 italic">
                    "How difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?"
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      "Not difficult at all",
                      "Somewhat difficult",
                      "Very difficult",
                      "Extremely difficult"
                    ].map(option => (
                      <Button
                        key={option}
                        type="button"
                        variant={functionalImpact === option ? "default" : "outline"}
                        onClick={() => setFunctionalImpact(option)}
                        className="text-xs h-auto py-2"
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Score Summary */}
            {allAnswered && interpretation && (
              <Card className={`${interpretation.bg} border-2`}>
                <CardContent className="py-6">
                  <div className="text-center space-y-3">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Total Score</p>
                      <p className="text-5xl font-bold text-slate-900">{total} / 27</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Severity</p>
                      <p className={`text-2xl font-bold ${interpretation.color}`}>
                        {interpretation.severity}
                      </p>
                    </div>
                    <div className="text-xs text-slate-600 pt-3 border-t">
                      <p>Minimal: 0-4 | Mild: 5-9 | Moderate: 10-14 | Moderately Severe: 15-19 | Severe: 20-27</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Clinical Notes */}
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="py-4 text-xs text-amber-800">
                <p><strong>Clinical Use:</strong> PHQ-9 is a validated screening and monitoring tool. Scores ≥10 typically warrant further evaluation. Always assess suicide risk when Q9 is positive. Consider referral to GP or psychologist for moderate-severe depression.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <div className="text-sm text-slate-600">
            {Object.keys(responses).length} / 9 questions answered
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!allAnswered}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Save PHQ-9 Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}