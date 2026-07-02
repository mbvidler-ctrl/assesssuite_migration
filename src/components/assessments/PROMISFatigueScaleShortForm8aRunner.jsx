import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, AlertCircle, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";

// PROMIS Fatigue SF8a raw-to-T-score conversion table
const SCORING_TABLE = [
  { rawScore: 8, tScore: 33.1 },
  { rawScore: 9, tScore: 38.5 },
  { rawScore: 10, tScore: 41.0 },
  { rawScore: 11, tScore: 42.8 },
  { rawScore: 12, tScore: 44.3 },
  { rawScore: 13, tScore: 45.6 },
  { rawScore: 14, tScore: 46.9 },
  { rawScore: 15, tScore: 48.1 },
  { rawScore: 16, tScore: 49.2 },
  { rawScore: 17, tScore: 50.4 },
  { rawScore: 18, tScore: 51.5 },
  { rawScore: 19, tScore: 52.5 },
  { rawScore: 20, tScore: 53.6 },
  { rawScore: 21, tScore: 54.6 },
  { rawScore: 22, tScore: 55.6 },
  { rawScore: 23, tScore: 56.6 },
  { rawScore: 24, tScore: 57.5 },
  { rawScore: 25, tScore: 58.5 },
  { rawScore: 26, tScore: 59.4 },
  { rawScore: 27, tScore: 60.4 },
  { rawScore: 28, tScore: 61.3 },
  { rawScore: 29, tScore: 62.3 },
  { rawScore: 30, tScore: 63.3 },
  { rawScore: 31, tScore: 64.3 },
  { rawScore: 32, tScore: 65.3 },
  { rawScore: 33, tScore: 66.4 },
  { rawScore: 34, tScore: 67.5 },
  { rawScore: 35, tScore: 68.6 },
  { rawScore: 36, tScore: 69.8 },
  { rawScore: 37, tScore: 71.0 },
  { rawScore: 38, tScore: 72.4 },
  { rawScore: 39, tScore: 74.2 },
  { rawScore: 40, tScore: 77.8 }
];

export default function PROMISFatigueScaleShortForm8aRunner({ client, onSave, onClose }) {
  const [state, setState] = useState("setup"); // setup, questionnaire, complete
  const [rawScore, setRawScore] = useState("");
  const [tScore, setTScore] = useState("");
  const [notes, setNotes] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [assessorName, setAssessorName] = useState("");

  const getInterpretation = (score) => {
    if (score < 50) {
      return { level: "Fatigue below general population average", color: "bg-green-50 border-green-300" };
    }
    if (score < 60) {
      return { level: "Mild fatigue", color: "bg-yellow-50 border-yellow-300" };
    }
    if (score < 70) {
      return { level: "Moderate fatigue", color: "bg-orange-50 border-orange-300" };
    }
    return { level: "Severe fatigue", color: "bg-red-50 border-red-300" };
  };

  const getTScoreFromRaw = (raw) => {
    const entry = SCORING_TABLE.find(t => t.rawScore === parseInt(raw));
    return entry ? entry.tScore : null;
  };

  const handleRawScoreChange = (e) => {
    const raw = e.target.value;
    setRawScore(raw);
    if (raw) {
      const convertedTScore = getTScoreFromRaw(raw);
      if (convertedTScore !== null) {
        setTScore(convertedTScore.toString());
      }
    }
  };

  const handleTScoreChange = (e) => {
    setTScore(e.target.value);
  };

  const isFormValid = tScore && parseFloat(tScore) > 0;
  const finalTScore = parseFloat(tScore);
  const interpretation = isFormValid ? getInterpretation(finalTScore) : null;

  const handleSave = () => {
    if (!isFormValid) {
      toast.error("Please enter a valid T-Score before saving.");
      return;
    }

    const soapLines = [
      `â€¢ PROMIS Fatigue Scale â€“ Short Form 8a`,
      `  Assessment Date: ${assessmentDate}`,
      ``,
      `  Raw Score (sum of 8 items, 1-5 each): ${rawScore || 'Not provided'}`,
      `  PROMIS T-Score: ${finalTScore}`,
      ``,
      `  Interpretation:`,
      `    ${interpretation.level}`,
      ``,
      `  PROMIS Scoring Scale:`,
      `    T-Score <50: Fatigue below general population average`,
      `    T-Score 50-60: Mild fatigue`,
      `    T-Score 60-70: Moderate fatigue`,
      `    T-Score >70: Severe fatigue`,
      ``,
      `  Clinical Notes:`,
      notes ? `    ${notes.replace(/\n/g, '\n    ')}` : `    None provided`,
      ``,
      `  Reference:`,
      `    PROMIS Fatigue Short Form v1.0 â€“ Fatigue 8a`,
      `    Source: HealthMeasures / PROMIS (https://www.healthmeasures.net)`,
    ].join('\n');

    onSave({
      status: "completed",
      result_value: finalTScore,
      additional_data: {
        measurement_type: "questionnaire_external",
        raw_score: rawScore ? parseInt(rawScore) : null,
        t_score: finalTScore,
        interpretation: interpretation.level,
        soap_text: soapLines,
      },
      notes,
      assessment_date: assessmentDate,
    });

    toast.success("PROMIS Fatigue assessment saved successfully.");
  };

  const startQuestionnaire = () => {
    setState("questionnaire");
  };

  const completeAndReview = () => {
    setState("complete");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-start z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">PROMIS Fatigue Scale â€“ Short Form 8a</h2>
            <p className="text-sm text-slate-500">Patient-reported fatigue severity assessment</p>
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
                <CardContent className="text-sm text-blue-900">
                  <p>Ask client to rate 8 items about fatigue experiences and impact over the past 7 days using a 5-point scale (1 = never, 5 = always).</p>
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

              {/* Copyright & External Link */}
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Copyright Notice
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-orange-900 space-y-3">
                  <p>
                    The PROMIS Fatigue Short Form 8a questionnaire is copyrighted. Access the official questionnaire through HealthMeasures.
                  </p>
                  <Button
                    onClick={() => window.open('https://www.healthmeasures.net/index.php?option=com_instruments&view=measure&id=161', '_blank')}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Official PROMIS Questionnaire
                  </Button>
                </CardContent>
              </Card>

              {/* Norms & Interpretation */}
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="text-base">Norms & Interpretation</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-yellow-900">
                  <p>Raw score converted to T-score (mean=50, SD=10). T-score &gt;55 = Above average fatigue, &gt;60 = Significant fatigue, &gt;70 = Severe fatigue. Allows comparison to general population.</p>
                </CardContent>
              </Card>
            </>
          )}

          {/* Questionnaire State */}
          {state === "questionnaire" && (
            <>
              <Card className="border-blue-200">
                <CardHeader>
                  <CardTitle className="text-base">Score Entry</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="raw-score" className="block text-sm font-medium mb-2">
                        Raw Score (sum of 8 items)
                      </Label>
                      <Input
                        id="raw-score"
                        type="number"
                        min="8"
                        max="40"
                        value={rawScore}
                        onChange={handleRawScoreChange}
                        placeholder="8â€“40"
                      />
                      <p className="text-xs text-slate-500 mt-1">Auto-converts to T-Score</p>
                    </div>
                    <div>
                      <Label htmlFor="t-score" className="block text-sm font-medium mb-2">
                        PROMIS T-Score
                      </Label>
                      <Input
                        id="t-score"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={tScore}
                        onChange={handleTScoreChange}
                        placeholder="33.1â€“77.8"
                      />
                    </div>
                  </div>
                  {isFormValid && (
                    <div className={`border-2 p-4 rounded ${interpretation.color}`}>
                      <p className="font-semibold text-slate-900">T-Score: {finalTScore}</p>
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
                    <p className="text-sm text-slate-600">PROMIS T-Score</p>
                    <p className="text-4xl font-bold text-slate-900">{finalTScore}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="font-semibold text-slate-900">{interpretation.level}</p>
                  </div>
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
                    placeholder="Clinical observations, fatigue impact on daily activities, treatment recommendations..."
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

          {state === "setup" && (
            <Button onClick={startQuestionnaire} className="bg-blue-600 hover:bg-blue-700">
              Start Assessment â†’
            </Button>
          )}

          {state === "questionnaire" && (
            <Button
              onClick={completeAndReview}
              disabled={!isFormValid}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Review Results â†’
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