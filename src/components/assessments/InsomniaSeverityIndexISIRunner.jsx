import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const questions = [
  {
    number: 1,
    text: "Difficulty falling asleep",
    subscale: "Initiation"
  },
  {
    number: 2,
    text: "Difficulty staying asleep (frequent awakenings or long periods awake)",
    subscale: "Maintenance"
  },
  {
    number: 3,
    text: "Problem waking up too early in the morning",
    subscale: "Maintenance"
  },
  {
    number: 4,
    text: "Satisfaction with current sleep pattern",
    subscale: "Satisfaction (Reverse)"
  },
  {
    number: 5,
    text: "Noticeability of impairment in daytime functioning due to sleep problem",
    subscale: "Daytime Impairment"
  },
  {
    number: 6,
    text: "Worry or distress caused by the sleep problem",
    subscale: "Concern"
  },
  {
    number: 7,
    text: "Interference with quality of life caused by the sleep problem",
    subscale: "Daytime Impairment"
  }
];

export default function InsomniaSeverityIndexISIRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({
    q1: null,
    q2: null,
    q3: null,
    q4: null,
    q5: null,
    q6: null,
    q7: null,
  });
  const [notes, setNotes] = useState("");

  const handleResponseChange = (question, value) => {
    setResponses((prev) => ({
      ...prev,
      [question]: value,
    }));
  };

  const handleSave = () => {
    if (Object.values(responses).includes(null)) {
      toast.error("Please answer all questions before saving.");
      return;
    }

    const totalScore = Object.values(responses).reduce((acc, val) => acc + val, 0);
    
    let severity = "";
    if (totalScore <= 7) severity = "No clinically significant insomnia";
    else if (totalScore <= 14) severity = "Subthreshold insomnia";
    else if (totalScore <= 21) severity = "Clinical insomnia (moderate severity)";
    else severity = "Clinical insomnia (severe)";

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        soap_text: `• Insomnia Severity Index (ISI)\n  Total Score: ${totalScore}/28 — ${severity}`,
        measurement_type: "questionnaire",
        responses,
        severity,
      },
      notes,
      assessment_date: todayLocal(),
    });
    
    toast.success("Assessment saved successfully.");
  };

  const totalScore = Object.values(responses).reduce((acc, val) => acc + (val !== null ? val : 0), 0);
  const isComplete = !Object.values(responses).includes(null);
  
  let severityCategory = "";
  let severityDescription = "";
  let severityColor = "";
  
  if (isComplete) {
    if (totalScore <= 7) {
      severityCategory = "No clinically significant insomnia";
      severityColor = "bg-green-100 border-green-300 text-green-800";
    } else if (totalScore <= 14) {
      severityCategory = "Subthreshold insomnia";
      severityColor = "bg-yellow-100 border-yellow-300 text-yellow-800";
    } else if (totalScore <= 21) {
      severityCategory = "Clinical insomnia (moderate severity)";
      severityColor = "bg-orange-100 border-orange-300 text-orange-800";
    } else {
      severityCategory = "Clinical insomnia (severe)";
      severityColor = "bg-red-100 border-red-300 text-red-800";
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="text-2xl">Insomnia Severity Index (ISI)</CardTitle>
            <p className="text-sm text-gray-600 mt-2">7-item self-report questionnaire assessing insomnia severity over past 2 weeks</p>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Clinician Instructions */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg">📋 Clinician Instructions</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p>Patient self-completes or clinician administers. Refers to <strong>past 2 weeks</strong>. Q1–3: rate severity of sleep difficulty. Q4: rate satisfaction. Q5–7: rate daytime impact.</p>
                <p className="italic">"For each question, please rate the <strong>severity</strong> of your sleep problem over the past 2 weeks. 0 = No problem at all, 4 = Very severe problem."</p>
                <p><strong>Note:</strong> Q4 (Satisfaction) is rated inversely — 0 = Very satisfied, 4 = Very dissatisfied.</p>
              </CardContent>
            </Card>

            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>Morin CM. (1993). <em>Insomnia: Psychological Assessment and Management</em>. Guilford Press.</p>
              <p>Bastien CH, Vallières A, & Morin CM. (2001). Validation of the Insomnia Severity Index (ISI) as an outcome measure for insomnia research. <em>Sleep Medicine, 2</em>(4), 297–307.</p>
            </div>

            {/* Scale Legend */}
            <Card className="bg-gray-50 border-gray-200">
              <CardHeader>
                <CardTitle className="text-base">Response Scale</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-5 gap-2 text-sm">
                <div className="text-center"><strong>0</strong><p className="text-xs text-gray-600">Not at all</p></div>
                <div className="text-center"><strong>1</strong><p className="text-xs text-gray-600">Slight</p></div>
                <div className="text-center"><strong>2</strong><p className="text-xs text-gray-600">Moderate</p></div>
                <div className="text-center"><strong>3</strong><p className="text-xs text-gray-600">Serious</p></div>
                <div className="text-center"><strong>4</strong><p className="text-xs text-gray-600">Very Serious</p></div>
              </CardContent>
            </Card>

            {/* Questions */}
            <div className="space-y-4">
              <Label className="text-lg font-semibold">Assessment Items</Label>
              {questions.map((q) => (
                <Card key={q.number} className="border-l-4 border-l-indigo-400">
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <Label className="text-sm font-semibold">{q.number}. {q.text}</Label>
                          <Badge variant="outline" className="mt-1 text-xs">{q.subscale}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {[0, 1, 2, 3, 4].map((value) => (
                          <Button
                            key={value}
                            variant={responses[`q${q.number}`] === value ? "default" : "outline"}
                            onClick={() => handleResponseChange(`q${q.number}`, value)}
                            size="sm"
                            className="w-10 h-10 p-0"
                          >
                            {value}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Score Interpretation */}
            {isComplete && (
              <Card className={`border-2 ${severityColor}`}>
                <CardHeader>
                  <CardTitle className="text-lg">Total Score & Severity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-white rounded">
                      <p className="text-sm font-semibold text-gray-600 mb-1">Total ISI Score</p>
                      <p className="text-3xl font-bold">{totalScore}/28</p>
                    </div>
                    <div className="text-center p-3 bg-white rounded">
                      <p className="text-sm font-semibold text-gray-600 mb-1">Severity Classification</p>
                      <p className="text-lg font-bold">{severityCategory}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Norms & Interpretation */}
            <Card className="bg-amber-50 border-amber-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  Norms & Interpretation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-amber-900">
                <div>
                  <p><strong>0-7:</strong> No clinically significant insomnia</p>
                </div>
                <div>
                  <p><strong>8-14:</strong> Subthreshold insomnia</p>
                </div>
                <div>
                  <p><strong>15-21:</strong> Clinical insomnia (moderate severity)</p>
                </div>
                <div>
                  <p><strong>22-28:</strong> Clinical insomnia (severe)</p>
                </div>
                <p className="text-xs mt-3 italic">Note: Score of ≥15 suggests moderate to severe insomnia warranting clinical intervention.</p>
              </CardContent>
            </Card>

            {/* Clinical Notes */}
            <div>
              <Label className="text-lg font-semibold mb-2 block">Clinical Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Document sleep patterns, comorbidities, medications, treatment response..."
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose} className="flex-1">
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!isComplete}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Assessment
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}