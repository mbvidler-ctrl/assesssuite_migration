import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Info, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

const PCL5_ITEMS = [
  "Repeated, disturbing, and unwanted memories of the stressful experience",
  "Repeated, disturbing dreams of the stressful experience",
  "Sudden, intense feeling as if the stressful experience were happening again (flashbacks)",
  "Intense or prolonged psychological distress at exposure to internal or external cues",
  "Marked physiological reactions to internal or external cues",
  "Avoidance of distressing memories, thoughts, or feelings",
  "Avoidance of external reminders (people, places, conversations, activities)",
  "Inability to remember an important aspect of the stressful experience",
  "Persistent and exaggerated negative beliefs or expectations",
  "Persistent, distorted cognitions about the cause or consequences",
  "Persistent negative emotional state (fear, horror, anger, guilt, shame)",
  "Marked diminished interest or participation in significant activities",
  "Feelings of detachment or estrangement from others",
  "Persistent inability to experience positive emotions",
  "Irritable behavior and angry outbursts",
  "Reckless or self-destructive behavior",
  "Hypervigilance",
  "Exaggerated startle response",
  "Problems with concentration",
  "Sleep disturbance"
];

export default function PTSDChecklistforDSM5PCL5Runner({ client, onSave, onClose }) {
  const [assessmentState, setAssessmentState] = useState("setup"); // setup, questionnaire, complete
  const [responses, setResponses] = useState(Array(20).fill(null));
  const [notes, setNotes] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [assessorName, setAssessorName] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);

  const handleResponseChange = (index, value) => {
    const newResponses = [...responses];
    newResponses[index] = value;
    setResponses(newResponses);
  };

  const totalScore = responses.reduce((sum, score) => sum + (score !== null ? score : 0), 0);
  const answeredCount = responses.filter(r => r !== null).length;

  const getInterpretation = (score) => {
    if (score >= 33) {
      return {
        category: "Provisional PTSD diagnosis",
        description: "Score â‰¥33 or symptom cluster method. Likely meets PTSD criteria per DSM-5.",
        color: "bg-red-50 border-red-300"
      };
    }
    if (score >= 24) {
      return {
        category: "Moderate PTSD symptoms",
        description: "Significant symptom burden; clinical attention warranted.",
        color: "bg-orange-50 border-orange-300"
      };
    }
    if (score >= 14) {
      return {
        category: "Mild PTSD symptoms",
        description: "Some distress present; may benefit from further assessment.",
        color: "bg-yellow-50 border-yellow-300"
      };
    }
    return {
      category: "Minimal or no PTSD symptoms",
      description: "Score suggests low symptom burden.",
      color: "bg-green-50 border-green-300"
    };
  };

  const interpretation = getInterpretation(totalScore);

  const handleSave = () => {
    if (answeredCount === 0) {
      toast.error("Please answer at least one question before saving.");
      return;
    }

    const soapLines = [
      `â€¢ PTSD Checklist for DSM-5 (PCL-5)`,
      `  Client Name: ${client?.full_name || 'Not specified'}`,
      `  Assessor Name: ${assessorName || 'Not specified'}`,
      `  Assessment Date: ${assessmentDate}`,
      ``,
      `  Total Score: ${totalScore}/80`,
      `  Interpretation: ${interpretation.category}`,
      `    ${interpretation.description}`,
      ``,
      `  Item-by-Item Responses:`,
      ...PCL5_ITEMS.map((item, idx) => {
        const score = responses[idx];
        const scoreLabel = {
          0: "Not at all",
          1: "A little bit",
          2: "Moderately",
          3: "Quite a bit",
          4: "Extremely"
        }[score];
        return `    ${idx + 1}. ${item}: ${score} (${scoreLabel})`;
      }),
      ``,
      `  Clinical Notes:`,
      notes ? `    ${notes.replace(/\n/g, '\n    ')}` : `    None provided`,
      ``,
      `  DSM-5 Diagnostic Criteria:`,
      `    Monitors PTSD symptom severity across:`,
      `    - Intrusion cluster (Items 1-5)`,
      `    - Avoidance cluster (Items 6-7)`,
      `    - Negative alterations in cognition and mood (Items 8-14)`,
      `    - Alterations in arousal and reactivity (Items 15-20)`,
      ``,
      `  Provisional PTSD Diagnosis: ${totalScore >= 33 ? 'Criterion met (score â‰¥33)' : 'Criterion not met'}`,
    ].join('\n');

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        measurement_type: "questionnaire",
        responses,
        totalScore,
        interpretation: interpretation.category,
        assessorName,
        provisionalDiagnosis: totalScore >= 33,
        soap_text: soapLines,
      },
      notes,
      assessment_date: assessmentDate,
    });

    toast.success("PCL-5 assessment saved successfully.");
  };

  const startQuestionnaire = () => {
    setAssessmentState("questionnaire");
    setCurrentQuestion(0);
  };

  const handleNextQuestion = () => {
    if (currentQuestion < PCL5_ITEMS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setAssessmentState("complete");
    }
  };

  const handleSkipQuestion = () => {
    handleNextQuestion();
  };

  const completeWithResponses = () => {
    setAssessmentState("complete");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-start z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">PTSD Checklist for DSM-5 (PCL-5)</h2>
            <p className="text-sm text-slate-500">20-item PTSD symptom severity assessment</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Setup State */}
          {assessmentState === "setup" && (
            <>
              {/* Scope & Clinical Context */}
              <Card className="border-emerald-200 bg-emerald-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="w-5 h-5 text-emerald-600" />
                    Scope & Clinical Context
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-emerald-900 space-y-2">
                  <p className="font-semibold">Purpose:</p>
                  <p>The PCL-5 is a 20-item screening tool that measures PTSD symptom severity across four DSM-5 diagnostic clusters: intrusion, avoidance, negative cognitions/mood, and hyperarousal. It is not a diagnostic instrument but a validated assessment of symptom burden and treatment response.</p>
                  <p className="font-semibold mt-2">When to Use:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Screen for PTSD symptoms in trauma-exposed populations</li>
                    <li>Monitor symptom change during treatment (high sensitivity to change)</li>
                    <li>Assess trauma-related distress in military veterans, first responders, or clinical populations</li>
                    <li>Document baseline severity for medico-legal or insurance documentation</li>
                  </ul>
                  <p className="font-semibold mt-2">Limitations:</p>
                  <p className="text-xs">Not diagnostic alone; requires clinical interview. Does not assess trauma exposure directly. Past-month timeframe may miss chronic presentations. Sensitive to response style.</p>
                </CardContent>
              </Card>

              {/* Reference */}
              <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                <p className="font-semibold">ðŸ“– Reference</p>
                <p>Weathers FW, Litz BT, Keane TM, Palmieri PA, Marx BP, & Schnurr PP. (2013). The PTSD Checklist for DSM-5 (PCL-5). Scale available from the National Center for PTSD. www.ptsd.va.gov</p>
              </div>

              {/* Norms */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
                <p className="font-semibold text-slate-700">ðŸ“Š Score Interpretation (/80)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-slate-300 rounded">
                    <thead className="bg-slate-200"><tr><th className="p-2 text-left">Score</th><th className="p-2 text-left">Interpretation</th></tr></thead>
                    <tbody>
                      <tr className="border-t"><td className="p-2">&lt;14</td><td className="p-2 text-green-700">Minimal/no PTSD symptoms</td></tr>
                      <tr className="border-t bg-white"><td className="p-2">14â€“23</td><td className="p-2 text-yellow-700">Mild symptoms â€” monitor</td></tr>
                      <tr className="border-t"><td className="p-2">24â€“32</td><td className="p-2 text-orange-700">Moderate symptoms â€” clinical assessment recommended</td></tr>
                      <tr className="border-t bg-white"><td className="p-2">â‰¥33</td><td className="p-2 text-red-700">Provisional PTSD â€” referral to mental health</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">Past month timeframe. 0 = Not at all; 4 = Extremely. MCID: ~5â€“10 points for treatment response. Source: Weathers et al. (2013).</p>
              </div>

              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    ðŸ“‹ Clinician Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-blue-900 space-y-1">
                  <p>Client rates how bothered by 20 PTSD symptoms in past month on 0â€“4 scale. Based on DSM-5 criteria. Administer with sensitivity â€” content may be distressing.</p>
                  <p className="italic">"The following questions ask about problems you may have had in response to a very stressful experience. Please read each carefully, then circle one of the numbers to indicate how much you have been bothered by that problem in the past month."</p>
                </CardContent>
              </Card>

              {/* Client Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assessment Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="block text-xs text-slate-500 font-medium mb-1">Client Name</Label>
                      <Input
                        value={client?.full_name || ""}
                        disabled
                        className="bg-slate-100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="assessor-name" className="block text-xs text-slate-500 font-medium mb-1">
                        Assessor Name
                      </Label>
                      <Input
                        id="assessor-name"
                        value={assessorName}
                        onChange={(e) => setAssessorName(e.target.value)}
                        placeholder="Enter assessor name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="assessment-date" className="block text-xs text-slate-500 font-medium mb-1">
                        Assessment Date
                      </Label>
                      <Input
                        id="assessment-date"
                        type="date"
                        value={assessmentDate}
                        onChange={(e) => setAssessmentDate(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Norms & Interpretation */}
              <Card className={`border-2 ${interpretation.color}`}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Norms & Interpretation
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p className="font-semibold">
                    Total 0â€“80. Provisional PTSD diagnosis: score â‰¥33 or symptom cluster method. Monitors treatment response.
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {/* Questionnaire State */}
          {assessmentState === "questionnaire" && (
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="text-base">Question {currentQuestion + 1} of 20</CardTitle>
                <div className="w-full bg-slate-200 rounded-full h-2 mt-3">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${((currentQuestion + 1) / 20) * 100}%` }}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="block text-lg font-semibold mb-4 text-slate-900">
                    {currentQuestion + 1}. {PCL5_ITEMS[currentQuestion]}
                  </Label>
                  <p className="text-xs text-slate-500 mb-4">
                    Rate how bothered you are by this problem over the past month
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { value: 0, label: "Not at all" },
                      { value: 1, label: "A little bit" },
                      { value: 2, label: "Moderately" },
                      { value: 3, label: "Quite a bit" },
                      { value: 4, label: "Extremely" }
                    ].map((option) => (
                      <Button
                        key={option.value}
                        variant={responses[currentQuestion] === option.value ? "default" : "outline"}
                        onClick={() => {
                          const newResponses = [...responses];
                          newResponses[currentQuestion] = option.value;
                          setResponses(newResponses);
                        }}
                        className="flex flex-col h-20"
                      >
                        <span className="text-lg font-bold">{option.value}</span>
                        <span className="text-xs">{option.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Progress Info */}
                <div className="bg-slate-50 p-3 rounded text-xs text-slate-600">
                  {currentQuestion + 1 === 20 ? "Last question" : `${20 - currentQuestion - 1} questions remaining`}
                  {answeredCount > 0 && ` â€¢ ${answeredCount} answered`}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Complete State */}
          {assessmentState === "complete" && (
            <>
              <Card className={`border-2 ${interpretation.color}`}>
                <CardHeader>
                  <CardTitle className="text-base">Assessment Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-slate-600">Total Score</p>
                    <p className="text-4xl font-bold text-slate-900">{totalScore}</p>
                    <p className="text-sm text-slate-500 mt-1">/80</p>
                  </div>
                  <div className="bg-white p-4 rounded border border-slate-200">
                    <p className="font-semibold text-slate-900">{interpretation.category}</p>
                    <p className="text-sm text-slate-700 mt-1">{interpretation.description}</p>
                  </div>
                  <p className="text-xs text-slate-500">
                    {answeredCount} of 20 questions answered
                  </p>
                </CardContent>
              </Card>

              {/* Clinical Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Clinical Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional clinical observations, trauma history, treatment recommendations..."
                    rows={4}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-slate-50 px-6 py-4 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>

          {assessmentState === "setup" && (
            <Button
              onClick={startQuestionnaire}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Start Questionnaire â†’
            </Button>
          )}

          {assessmentState === "questionnaire" && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSkipQuestion}>
                Skip Question
              </Button>
              <Button
                onClick={handleNextQuestion}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {currentQuestion === 19 ? "Complete" : "Next Question"} â†’
              </Button>
            </div>
          )}

          {assessmentState === "complete" && (
            <Button
              onClick={handleSave}
              disabled={answeredCount === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Assessment
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}