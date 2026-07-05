import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

const GAD7_QUESTIONS = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it's hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid as if something awful might happen"
];

const RESPONSE_OPTIONS = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" }
];

export default function GAD7Runner({ onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [functionalImpact, setFunctionalImpact] = useState('');

  const handleResponseChange = (questionIndex, value) => {
    setResponses(prev => ({ ...prev, [questionIndex]: value }));
  };

  const calculateTotal = () => {
    return Object.values(responses).reduce((sum, val) => sum + val, 0);
  };

  const getInterpretation = (total) => {
    if (total <= 4) return { severity: "Minimal Anxiety", color: "text-green-600", bg: "bg-green-50" };
    if (total <= 9) return { severity: "Mild Anxiety", color: "text-blue-600", bg: "bg-blue-50" };
    if (total <= 14) return { severity: "Moderate Anxiety", color: "text-yellow-600", bg: "bg-yellow-50" };
    return { severity: "Severe Anxiety", color: "text-red-600", bg: "bg-red-50" };
  };

  const handleSave = () => {
    if (Object.keys(responses).length < 7) {
      toast.error("Please answer all 7 questions");
      return;
    }

    const total = calculateTotal();
    const interpretation = getInterpretation(total);

    const questionLines = GAD7_QUESTIONS.map((q, i) => {
      const resp = RESPONSE_OPTIONS.find(o => o.value === responses[i]);
      return `  Q${i+1}. ${q}: ${resp ? resp.label : ''} (${responses[i]})`;
    }).join('\n');

    const soapText = `GAD-7 (Generalized Anxiety Disorder 7)\n\nTotal Score: ${total}/21\n  Severity: ${interpretation.severity}\n${questionLines}${functionalImpact ? `\n  Functional Impact: ${functionalImpact}` : ''}`;

    onSave({
      result_value: total,
      additional_data: {
        soap_text: soapText,
        total_score: total,
        severity: interpretation.severity,
        responses,
        functional_impact: functionalImpact,
        measurement_type: 'gad7'
      },
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  const total = calculateTotal();
  const interpretation = total > 0 ? getInterpretation(total) : null;
  const allAnswered = Object.keys(responses).length === 7;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">GAD-7</h2>
              <p className="text-slate-600 mt-1">Generalized Anxiety Disorder Assessment</p>
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
                  Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-blue-800 italic">
                  "Over the last 2 weeks, how often have you been bothered by the following problems?"
                </p>
              </CardContent>
            </Card>

            {/* Questions */}
            {GAD7_QUESTIONS.map((question, index) => (
              <Card key={index} className={responses[index] !== undefined ? "border-green-200 bg-green-50/30" : ""}>
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    {index + 1}. {question}
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
                            ? 'bg-blue-600 text-white' 
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
                    "If you checked off any problems, how difficult have these made it for you to do your work, take care of things at home, or get along with other people?"
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
                      <p className="text-5xl font-bold text-slate-900">{total} / 21</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Severity</p>
                      <p className={`text-2xl font-bold ${interpretation.color}`}>
                        {interpretation.severity}
                      </p>
                    </div>
                    <div className="text-xs text-slate-600 pt-3 border-t">
                      <p>Minimal: 0-4 | Mild: 5-9 | Moderate: 10-14 | Severe: 15-21</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Clinical Notes */}
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="py-4 text-xs text-amber-800">
                <p><strong>Note:</strong> GAD-7 is a screening tool, not a diagnostic instrument. Scores ≥10 suggest further clinical assessment may be warranted. Consider referral to GP or mental health professional for moderate-severe anxiety.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <div className="text-sm text-slate-600">
            {Object.keys(responses).length} / 7 questions answered
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
              Save GAD-7 Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}