import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, AlertCircle, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function QuickDASHRunner({ client, onSave, onClose }) {
  const [state, setState] = useState("setup"); // setup, score_entry, complete
  const [rawSum, setRawSum] = useState("");
  const [totalScore, setTotalScore] = useState("");
  const [notes, setNotes] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(todayLocal());
  const [assessorName, setAssessorName] = useState("");

  const getInterpretation = (score) => {
    const s = parseFloat(score);
    if (s <= 20) return { level: "Minimal upper limb disability", color: "bg-green-50 border-green-300" };
    if (s <= 40) return { level: "Mild disability", color: "bg-blue-50 border-blue-300" };
    if (s <= 60) return { level: "Moderate disability", color: "bg-yellow-50 border-yellow-300" };
    return { level: "Severe disability", color: "bg-red-50 border-red-300" };
  };

  const isFormValid = totalScore && parseFloat(totalScore) >= 0 && parseFloat(totalScore) <= 100;
  const interpretation = isFormValid ? getInterpretation(totalScore) : null;

  const handleSave = () => {
    if (!isFormValid) {
      toast.error("Please enter a valid QuickDASH score (0-100).");
      return;
    }

    const score = parseFloat(totalScore);
    const rawSumValue = rawSum ? parseInt(rawSum) : null;
    
    const soapLines = [
      `• QuickDASH (Disabilities of the Arm, Shoulder and Hand)`,
      `  Assessment Date: ${assessmentDate}`,
      ``,
      rawSumValue ? `  Sum of Item Scores: ${rawSumValue}/55` : ``,
      `  QuickDASH Score: ${score}/100`,
      `  Interpretation: ${interpretation.level}`,
      ``,
      `  Scoring Scale:`,
      `    0-20: Minimal upper limb disability`,
      `    21-40: Mild disability`,
      `    41-60: Moderate disability`,
      `    61-100: Severe disability`,
      ``,
      notes ? `  Clinician Notes:\n    ${notes.replace(/\n/g, '\n    ')}` : `  Clinician Notes: None provided`,
      ``,
      `  Reference:`,
      `    Institute for Work & Health. Disabilities of the Arm, Shoulder and Hand (DASH) and QuickDASH.`,
      `    https://dash.iwh.on.ca`,
    ].filter(Boolean).join('\n');

    onSave({
      status: "completed",
      result_value: score,
      additional_data: {
        measurement_type: "questionnaire_external",
        raw_sum: rawSumValue,
        total_score: score,
        interpretation: interpretation.level,
        soap_text: soapLines,
      },
      notes,
      assessment_date: assessmentDate,
    });

    toast.success("QuickDASH assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-start z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">QuickDASH</h2>
            <p className="text-sm text-slate-500">Upper limb disability and symptoms assessment</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Setup State */}
          {state === "setup" && (
            <>
              {/* Clinician Instructions */}
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Clinician Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-blue-900 space-y-2">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Open the official QuickDASH questionnaire using the button below.</li>
                    <li>Administer the questionnaire to the client using the official form.</li>
                    <li>Return to this screen and enter the responses or final score.</li>
                  </ol>
                </CardContent>
              </Card>

              {/* Assessment Information */}
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

              {/* Copyright Notice & External Link */}
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Copyright Notice
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-orange-900 space-y-3">
                  <p>
                    The QuickDASH questionnaire is copyrighted by the Institute for Work & Health and cannot be reproduced within this software. The questionnaire must be accessed via the official source.
                  </p>
                  <Button
                    onClick={() => window.open('https://dash.iwh.on.ca/quickdash', '_blank')}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Official QuickDASH Questionnaire
                  </Button>
                </CardContent>
              </Card>

              {/* Interpretation Guidance */}
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">Interpretation Guidance</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="bg-slate-50 p-3 rounded space-y-1 text-xs">
                    <p><strong>0–20:</strong> Minimal upper limb disability</p>
                    <p><strong>21–40:</strong> Mild disability</p>
                    <p><strong>41–60:</strong> Moderate disability</p>
                    <p><strong>61–100:</strong> Severe disability</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Score Entry State */}
          {state === "score_entry" && (
            <>
              <Card className="border-blue-200">
                <CardHeader>
                  <CardTitle className="text-base">Score Entry</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="raw-sum" className="block text-sm font-medium mb-2">
                      Sum of Item Scores (11–55)
                    </Label>
                    <Input
                      id="raw-sum"
                      type="number"
                      min="11"
                      max="55"
                      value={rawSum}
                      onChange={(e) => setRawSum(e.target.value)}
                      placeholder="11–55 (optional)"
                    />
                    <p className="text-xs text-slate-500 mt-1">Optional: helps verify score conversion</p>
                  </div>

                  <div>
                    <Label htmlFor="total-score" className="block text-sm font-medium mb-2">
                      QuickDASH Score (0–100) *
                    </Label>
                    <Input
                      id="total-score"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={totalScore}
                      onChange={(e) => setTotalScore(e.target.value)}
                      placeholder="Enter total score"
                    />
                  </div>

                  {isFormValid && (
                    <div className={`border-2 p-4 rounded ${interpretation.color}`}>
                      <p className="font-semibold text-slate-900">Score: {totalScore}</p>
                      <p className="text-sm text-slate-700 mt-1">{interpretation.level}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Complete State */}
          {state === "complete" && (
            <>
              <Card className={`border-2 ${interpretation.color}`}>
                <CardHeader>
                  <CardTitle className="text-base">Assessment Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-slate-600 mb-2">QuickDASH Score</p>
                    <p className="text-4xl font-bold text-slate-900">{totalScore}</p>
                    <p className="text-sm text-slate-500 mt-1">/100</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="font-semibold text-slate-900">{interpretation.level}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Clinical Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Clinician Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Clinical observations, impact on upper limb function, treatment recommendations..."
                    rows={4}
                  />
                </CardContent>
              </Card>

              {/* References */}
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">Reference</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-700 space-y-2">
                  <p>
                    Institute for Work & Health. Disabilities of the Arm, Shoulder and Hand (DASH) and QuickDASH.
                  </p>
                  <a
                    href="https://dash.iwh.on.ca"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-block"
                  >
                    https://dash.iwh.on.ca
                  </a>
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

          {state === "setup" && (
            <Button onClick={() => setState("score_entry")} className="bg-blue-600 hover:bg-blue-700">
              Continue to Score Entry →
            </Button>
          )}

          {state === "score_entry" && (
            <Button
              onClick={() => setState("complete")}
              disabled={!isFormValid}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Review Results →
            </Button>
          )}

          {state === "complete" && (
            <Button
              onClick={handleSave}
              disabled={!isFormValid}
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