import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, AlertCircle, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function QuebecBackPainDisabilityScaleQBPDSRunner({ client, onSave, onClose }) {
  const [state, setState] = useState("setup"); // setup, score_entry, complete
  const [totalScore, setTotalScore] = useState("");
  const [notes, setNotes] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(todayLocal());
  const [assessorName, setAssessorName] = useState("");

  const getInterpretation = (score) => {
    const s = parseFloat(score);
    if (s <= 20) return { level: "Minimal disability", color: "bg-green-50 border-green-300" };
    if (s <= 40) return { level: "Mild disability", color: "bg-blue-50 border-blue-300" };
    if (s <= 60) return { level: "Moderate disability", color: "bg-yellow-50 border-yellow-300" };
    if (s <= 80) return { level: "Severe disability", color: "bg-orange-50 border-orange-300" };
    return { level: "Very severe disability", color: "bg-red-50 border-red-300" };
  };

  const isFormValid = totalScore && parseFloat(totalScore) >= 0 && parseFloat(totalScore) <= 100;
  const interpretation = isFormValid ? getInterpretation(totalScore) : null;

  const handleSave = () => {
    if (!isFormValid) {
      toast.error("Please enter a valid score (0-100).");
      return;
    }

    const score = parseFloat(totalScore);
    const soapLines = [
      `• Quebec Back Pain Disability Scale (QBPDS)`,
      `  Assessment Date: ${assessmentDate}`,
      ``,
      `  Total Score: ${score}/100`,
      `  Interpretation: ${interpretation.level}`,
      ``,
      `  Scoring:`,
      `    0-20: Minimal disability`,
      `    21-40: Mild disability`,
      `    41-60: Moderate disability`,
      `    61-80: Severe disability`,
      `    81-100: Very severe disability`,
      ``,
      `  Clinical Interpretation:`,
      `    Higher scores indicate greater functional disability related to low back pain.`,
      ``,
      notes ? `  Clinician Notes:\n    ${notes.replace(/\n/g, '\n    ')}` : `  Clinician Notes: None provided`,
      ``,
      `  Reference:`,
      `    Kopec JA, Esdaile JM, Abrahamowicz M, et al. The Quebec Back Pain Disability Scale: measurement properties. Spine. 1995.`,
    ].join('\n');

    onSave({
      status: "completed",
      result_value: score,
      additional_data: {
        measurement_type: "questionnaire_external",
        total_score: score,
        interpretation: interpretation.level,
        soap_text: soapLines,
      },
      notes,
      assessment_date: assessmentDate,
    });

    toast.success("Quebec Back Pain Disability Scale assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-start z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Quebec Back Pain Disability Scale</h2>
            <p className="text-sm text-slate-500">Patient-reported functional disability assessment</p>
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
                    <li>Click the button below to open the official Quebec Back Pain Disability Scale questionnaire.</li>
                    <li>Administer the questionnaire to the client using the official form.</li>
                    <li>After completing the questionnaire, return to this screen.</li>
                    <li>Enter the total score obtained.</li>
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
                    The Quebec Back Pain Disability Scale is copyrighted. The questionnaire items cannot be reproduced within this software. Users must complete the questionnaire using an authorised source.
                  </p>
                  <Button
                    onClick={() => window.open('https://www.physiotutors.com/questionnaires/quebec-back-pain-disability-scale-qbpds/', '_blank')}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Quebec Back Pain Disability Scale Questionnaire
                  </Button>
                </CardContent>
              </Card>

              {/* Interpretation Guidance */}
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">Interpretation Guidance</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p className="text-slate-700">Higher scores indicate greater disability related to back pain.</p>
                  <div className="bg-slate-50 p-3 rounded space-y-1 text-xs">
                    <p><strong>0-20:</strong> Minimal disability</p>
                    <p><strong>21-40:</strong> Mild disability</p>
                    <p><strong>41-60:</strong> Moderate disability</p>
                    <p><strong>61-80:</strong> Severe disability</p>
                    <p><strong>81-100:</strong> Very severe disability</p>
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
                    <Label htmlFor="total-score" className="block text-sm font-medium mb-2">
                      Total Score (0-100) *
                    </Label>
                    <Input
                      id="total-score"
                      type="number"
                      min="0"
                      max="100"
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
                    <p className="text-sm text-slate-600 mb-2">Total Score</p>
                    <p className="text-4xl font-bold text-slate-900">{totalScore}</p>
                    <p className="text-sm text-slate-500 mt-1">/100</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="font-semibold text-slate-900">{interpretation.level}</p>
                    <p className="text-sm text-slate-700 mt-1">Higher scores indicate greater functional disability related to low back pain.</p>
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
                    placeholder="Clinical observations, impact on function, treatment recommendations..."
                    rows={4}
                  />
                </CardContent>
              </Card>

              {/* References */}
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">Reference</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-700">
                   <p>
                     Kopec JA, Esdaile JM, Abrahamowicz M, et al. The Quebec Back Pain Disability Scale: measurement properties. Spine. 1995.
                   </p>
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