import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const FMS_TESTS = [
  { id: 1, name: "Deep Squat", bilateral: true },
  { id: 2, name: "Hurdle Step", bilateral: false },
  { id: 3, name: "Inline Lunge", bilateral: false },
  { id: 4, name: "Shoulder Mobility", bilateral: false },
  { id: 5, name: "Active Straight-Leg Raise", bilateral: false },
  { id: 6, name: "Trunk Stability Push-Up", bilateral: true },
  { id: 7, name: "Rotary Stability", bilateral: false }
];

const SCORING_CRITERIA = [
  { score: 3, description: "Performs movement correctly without compensation" },
  { score: 2, description: "Completes movement but with compensation" },
  { score: 1, description: "Unable to complete movement pattern" },
  { score: 0, description: "Pain during movement (STOP - refer for medical evaluation)" }
];

export default function FMSRunner({ onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [painReported, setPainReported] = useState({});
  const [notes, setNotes] = useState("");

  const handleScoreChange = (testId, side, score) => {
    const key = side ? `${testId}_${side}` : testId;
    setScores({ ...scores, [key]: score });
    
    if (score === 0) {
      setPainReported({ ...painReported, [key]: true });
      toast.warning("Pain reported - consider medical referral");
    } else {
      const newPain = { ...painReported };
      delete newPain[key];
      setPainReported(newPain);
    }
  };

  const calculateTotal = () => {
    let total = 0;
    FMS_TESTS.forEach(test => {
      if (test.bilateral) {
        total += parseInt(scores[test.id]) || 0;
      } else {
        const leftScore = parseInt(scores[`${test.id}_left`]) || 0;
        const rightScore = parseInt(scores[`${test.id}_right`]) || 0;
        total += Math.min(leftScore, rightScore); // Use lower score for asymmetric tests
      }
    });
    return total;
  };

  const total = calculateTotal();

  const getInterpretation = () => {
    if (Object.keys(painReported).length > 0) {
      return { level: 'Pain Present - Medical Referral Required', color: 'text-red-600', bg: 'bg-red-50' };
    }
    if (total <= 14) {
      return { level: 'Increased Injury Risk', color: 'text-red-600', bg: 'bg-red-50' };
    }
    if (total <= 16) {
      return { level: 'Moderate Risk - Movement Limitations Present', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    }
    return { level: 'Low Injury Risk', color: 'text-green-600', bg: 'bg-green-50' };
  };

  const isComplete = () => {
    return FMS_TESTS.every(test => {
      if (test.bilateral) {
        return scores[test.id] !== undefined;
      }
      return scores[`${test.id}_left`] !== undefined && scores[`${test.id}_right`] !== undefined;
    });
  };

  const interpretation = isComplete() ? getInterpretation() : null;

  const handleSave = () => {
    if (Object.keys(scores).length === 0) {
      toast.error("Please score at least one FMS test before saving.");
      return;
    }

    const soapText = [
      `• Functional Movement Screen (FMS)`,
      `  Total Score: ${total}/21 — ${interpretation?.level}`,
      Object.keys(painReported).length > 0 ? `  ⚠ Pain reported during testing — medical referral required` : null,
      notes ? `  Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: total,
      additional_data: {
        soap_text: soapText,
        total_score: total,
        test_scores: scores,
        pain_reported: Object.keys(painReported).length > 0,
        pain_locations: Object.keys(painReported),
        interpretation: interpretation?.level
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-orange-50 to-red-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Functional Movement Screen (FMS)</h2>
              <p className="text-slate-600 mt-1">Seven fundamental movement patterns to identify limitations and asymmetries</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  FMS Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>Scoring:</strong> Each test scored 0-3. For bilateral tests, use the lower score.</p>
                <p><strong>Total Score:</strong> 21 points maximum. ≤14 associated with increased injury risk.</p>
                <p><strong>Pain:</strong> Any pain during testing = 0 for that movement and requires medical clearance.</p>
              </CardContent>
            </Card>

            <Card className="bg-red-50 border-red-200">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-red-800">
                  <AlertTriangle className="w-5 h-5" />
                  Important Safety Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-red-800">
                <p><strong>STOP testing</strong> if pain is reported during any movement. Score 0 and refer to appropriate healthcare professional for clearance before exercise participation.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Scoring Reference</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {SCORING_CRITERIA.map((criteria) => (
                    <div key={criteria.score} className="flex items-start gap-3 p-2 border-l-4 border-blue-400">
                      <span className="font-bold text-lg text-blue-600">{criteria.score}</span>
                      <span className="text-sm">{criteria.description}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {FMS_TESTS.map((test) => (
              <Card key={test.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{test.id}. {test.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {test.bilateral ? (
                    <div className="flex gap-2">
                      {[3, 2, 1, 0].map((score) => (
                        <Button
                          key={score}
                          type="button"
                          variant={scores[test.id] === score ? "default" : "outline"}
                          onClick={() => handleScoreChange(test.id, null, score)}
                          className={`flex-1 ${score === 0 ? 'border-red-500 hover:bg-red-100' : ''}`}
                        >
                          {score}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label className="mb-2 block">Left Side</Label>
                        <div className="flex gap-2">
                          {[3, 2, 1, 0].map((score) => (
                            <Button
                              key={score}
                              type="button"
                              variant={scores[`${test.id}_left`] === score ? "default" : "outline"}
                              onClick={() => handleScoreChange(test.id, 'left', score)}
                              className={`flex-1 ${score === 0 ? 'border-red-500 hover:bg-red-100' : ''}`}
                            >
                              {score}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="mb-2 block">Right Side</Label>
                        <div className="flex gap-2">
                          {[3, 2, 1, 0].map((score) => (
                            <Button
                              key={score}
                              type="button"
                              variant={scores[`${test.id}_right`] === score ? "default" : "outline"}
                              onClick={() => handleScoreChange(test.id, 'right', score)}
                              className={`flex-1 ${score === 0 ? 'border-red-500 hover:bg-red-100' : ''}`}
                            >
                              {score}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {interpretation && (
              <Card className={`${interpretation.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-xl ${interpretation.color}`}>
                    {interpretation.level}
                  </CardTitle>
                </CardHeader>
                <CardContent className={interpretation.color}>
                  <p className="font-semibold text-2xl">Total Score: {total} / 21</p>
                  {total <= 14 && (
                    <p className="mt-3 text-sm">
                      Scores ≤14 are associated with higher injury risk. Focus on correcting identified movement limitations.
                    </p>
                  )}
                  {Object.keys(painReported).length > 0 && (
                    <p className="mt-3 text-sm font-semibold">
                      ⚠ Pain reported during testing. Medical clearance required before exercise participation.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Movement compensations observed, asymmetries, corrective exercise priorities..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-orange-600 hover:bg-orange-700">
            <Save className="w-4 h-4 mr-2" />
            Save FMS
          </Button>
        </div>
      </div>
    </div>
  );
}