import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Info, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const questions = [
  "My motivation is lower when I am fatigued.",
  "Exercise brings on my fatigue.",
  "I am easily fatigued.",
  "Fatigue interferes with my physical functioning.",
  "Fatigue causes frequent problems for me.",
  "My fatigue prevents sustained physical functioning.",
  "Fatigue interferes with carrying out certain duties and responsibilities.",
  "Fatigue is among my three most disabling symptoms.",
  "Fatigue interferes with my work, family, or social life."
];

export default function FatigueSeverityScaleFSSRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState(Array(9).fill(null));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);

  const handleChange = (index, value) => {
    const newResponses = [...responses];
    newResponses[index] = value;
    setResponses(newResponses);
  };

  const handleSubmit = () => {
    if (responses.includes(null)) {
      toast.error("Please answer all questions before submitting.");
      return;
    }

    setIsSubmitting(true);

    const totalScore = responses.reduce((acc, curr) => acc + curr, 0);
    const meanScore = totalScore / responses.length;

    let soapText = `• Fatigue Severity Scale (FSS):\n  Mean Score: ${meanScore.toFixed(2)}/7 (${meanScore >= 4 ? 'Significant fatigue' : 'Minimal fatigue'})\n  Total Score: ${totalScore}/63\n\n  Individual Question Responses:\n`;
    questions.forEach((q, i) => {
      soapText += `  Q${i + 1}. ${q}\n      Response: ${responses[i]}/7\n`;
    });

    onSave({
      status: "completed",
      result_value: meanScore,
      additional_data: {
        measurement_type: "questionnaire",
        questions,
        responses,
        totalScore,
        meanScore,
        soap_text: soapText
      },
      notes: soapText,
      assessment_date: todayLocal()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-slate-50 border-b px-6 py-4 flex justify-between items-start z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Fatigue Severity Scale (FSS)</h2>
            {client?.full_name && <p className="text-sm text-slate-600 mt-1">Client: {client.full_name}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Clinician Instructions */}
          {/* Clinician Instructions */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-2">
              <button
                onClick={() => setExpandedSection(expandedSection === "instructions" ? null : "instructions")}
                className="w-full flex items-center justify-between font-semibold text-blue-900 hover:text-blue-700"
              >
                <span className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Clinician Instructions
                </span>
                {expandedSection === "instructions" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </CardHeader>
            {expandedSection === "instructions" && (
              <CardContent className="text-sm text-blue-900 space-y-2">
                <div>
                  <p className="font-semibold">Purpose:</p>
                  <p>Measures the severity of fatigue and its impact on activities and daily functioning. Widely used to identify and monitor fatigue in chronic conditions.</p>
                </div>
                <div>
                  <p className="font-semibold">Administration:</p>
                  <p>Self-report questionnaire. Ask the client to read each statement and select a number from 1 to 7 that best describes their level of agreement over the <strong>past week</strong>.</p>
                </div>
                <div>
                  <p className="font-semibold">Scoring:</p>
                  <p>Calculate the mean (average) of all 9 items (range 1–7). A mean score of <strong>≥4.0</strong> indicates clinically significant fatigue. Higher scores = greater fatigue severity.</p>
                </div>
                <div>
                  <p className="font-semibold">Validated Populations:</p>
                  <p>Multiple sclerosis, systemic lupus erythematosus (SLE), fibromyalgia, myalgic encephalomyelitis/chronic fatigue syndrome (ME/CFS), cancer-related fatigue, and other chronic conditions.</p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Scoring & Interpretation */}
          <Card className="bg-green-50 border-green-200">
            <CardHeader className="pb-2">
              <button
                onClick={() => setExpandedSection(expandedSection === "interpretation" ? null : "interpretation")}
                className="w-full flex items-center justify-between font-semibold text-green-900 hover:text-green-700"
              >
                <span>Scoring &amp; Interpretation</span>
                {expandedSection === "interpretation" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </CardHeader>
            {expandedSection === "interpretation" && (
              <CardContent className="text-sm text-green-900 space-y-2">
                <div className="bg-white p-2 rounded border border-green-200">
                  <p className="font-semibold mb-1">Mean Score Thresholds:</p>
                  <p><strong>1.0–3.9:</strong> Minimal or no fatigue</p>
                  <p><strong>4.0–5.9:</strong> Moderate fatigue</p>
                  <p><strong>6.0–7.0:</strong> Severe fatigue</p>
                </div>
                <div className="bg-white p-2 rounded border border-green-200">
                  <p className="font-semibold mb-1">Clinical Significance:</p>
                  <p><strong>≥4.0:</strong> Indicates clinically significant fatigue requiring intervention. May warrant energy management strategies, graded activity, or specialist referral.</p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Response Scale Legend */}
          <Card className="bg-amber-50 border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Response Scale Guide</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-amber-900">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white p-2 rounded border border-amber-200">
                  <p className="font-semibold text-sm">1 = Strongly Disagree</p>
                  <p className="text-xs text-amber-700">You strongly do not agree with the statement</p>
                </div>
                <div className="bg-white p-2 rounded border border-amber-200">
                  <p className="font-semibold text-sm">7 = Strongly Agree</p>
                  <p className="text-xs text-amber-700">You strongly agree with the statement</p>
                </div>
                <div className="bg-white p-2 rounded border border-amber-200 col-span-2">
                  <p className="font-semibold text-sm">2–6 = In Between</p>
                  <p className="text-xs text-amber-700">Use these to indicate varying degrees of agreement</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* References */}
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader className="pb-2">
              <button
                onClick={() => setExpandedSection(expandedSection === "references" ? null : "references")}
                className="w-full flex items-center justify-between font-semibold text-slate-900 hover:text-slate-700"
              >
                <span>References &amp; Further Reading</span>
                {expandedSection === "references" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </CardHeader>
            {expandedSection === "references" && (
              <CardContent className="text-xs text-slate-700 space-y-2">
                <p>
                  <strong>Krupp, L. B., LaRocca, N. G., Muir-Nash, J., &amp; Steinberg, A. D.</strong> (1989). The Fatigue Severity Scale: Application to patients with multiple sclerosis and systemic lupus erythematosus. <em>Archives of Neurology</em>, 46(10), 1121–1123.
                </p>
                <div className="space-y-1">
                  <p className="font-semibold">External Resources:</p>
                  <Button
                    onClick={() => window.open("https://www.physio-pedia.com/Fatigue_Severity_Scale", "_blank")}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Physiopedia FSS
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

            {/* Questions */}
            <div className="space-y-4">
              {questions.map((question, index) => (
                <Card key={index}>
                  <CardContent className="pt-4 space-y-3">
                    <Label className="text-sm font-semibold text-slate-900">
                      Q{index + 1}. {question}
                    </Label>
                    <div className="flex gap-1 flex-wrap">
                      {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                        <Button
                          key={value}
                          variant={responses[index] === value ? "default" : "outline"}
                          onClick={() => handleChange(index, value)}
                          className="w-10 h-10"
                          title={value === 1 ? "Strongly Disagree" : value === 7 ? "Strongly Agree" : ""}
                        >
                          {value}
                        </Button>
                      ))}
                    </div>
                    <div className="text-xs text-slate-500 flex justify-between px-1">
                      <span>Disagree</span>
                      <span>Agree</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Progress */}
            {responses.filter(r => r !== null).length > 0 && (
              <div className="text-center text-sm text-slate-600 bg-slate-50 p-3 rounded">
                {responses.filter(r => r !== null).length} of {questions.length} questions answered
              </div>
            )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 border-t bg-slate-50 px-6 py-4 flex justify-between gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || responses.includes(null)} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Save Assessment
            </Button>
            </div>
            </div>
            </div>
            );
            }