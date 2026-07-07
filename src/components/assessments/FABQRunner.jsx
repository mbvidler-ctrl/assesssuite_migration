import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

const FABQ_ITEMS = {
  physical: [
    { id: 1, text: "Physical activity makes my pain worse" },
    { id: 2, text: "Physical activity might harm my back" },
    { id: 3, text: "I should not do physical activities which (might) make my pain worse" },
    { id: 4, text: "I cannot do physical activities which (might) make my pain worse" },
    { id: 5, text: "Physical activity causes a lot of pain" }
  ],
  work: [
    { id: 6, text: "My pain was caused by my work or by an accident at work" },
    { id: 7, text: "My work aggravated my pain" },
    { id: 8, text: "I have a claim for compensation for my pain" },
    { id: 9, text: "My work is too heavy for me" },
    { id: 10, text: "My work makes or would make my pain worse" },
    { id: 11, text: "My work might harm my back" },
    { id: 12, text: "I should not do my normal work with my present pain" },
    { id: 13, text: "I cannot do my normal work with my present pain" },
    { id: 14, text: "I cannot do my normal work till my pain is treated" },
    { id: 15, text: "I do not think that I will be back to my normal work within 3 months" },
    { id: 16, text: "I do not think that I will ever be able to go back to that work" }
  ]
};

export default function FABQRunner({ onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");

  const handleScoreChange = (itemId, value) => {
    setScores({ ...scores, [itemId]: value });
  };

  const calculateScores = () => {
    const physicalScore = FABQ_ITEMS.physical.reduce((sum, item) => 
      sum + (parseInt(scores[item.id]) || 0), 0);
    const workScore = FABQ_ITEMS.work.reduce((sum, item) => 
      sum + (parseInt(scores[item.id]) || 0), 0);
    return { physicalScore, workScore, totalScore: physicalScore + workScore };
  };

  const { physicalScore, workScore, totalScore } = calculateScores();

  const getInterpretation = () => {
    let interpretation = [];
    
    if (physicalScore >= 15) {
      interpretation.push("High fear-avoidance beliefs about physical activity");
    } else if (physicalScore >= 8) {
      interpretation.push("Moderate fear-avoidance beliefs about physical activity");
    } else {
      interpretation.push("Low fear-avoidance beliefs about physical activity");
    }
    
    if (workScore >= 34) {
      interpretation.push("High fear-avoidance beliefs about work");
    } else if (workScore >= 20) {
      interpretation.push("Moderate fear-avoidance beliefs about work");
    } else {
      interpretation.push("Low fear-avoidance beliefs about work");
    }
    
    return interpretation;
  };

  const handleSave = () => {
    if (Object.keys(scores).length < 16) {
      toast.error("Please complete all 16 items");
      return;
    }

    onSave({
      result_value: totalScore,
      additional_data: {
        soap_text: `• FABQ (Fear-Avoidance Beliefs Questionnaire)\n  Physical Activity: ${physicalScore}/30 | Work: ${workScore}/66 | Total: ${totalScore}/96\n  ${getInterpretation().join(' | ')}`,
        physical_activity_score: physicalScore,
        work_score: workScore,
        total_score: totalScore,
        item_scores: scores,
        interpretation: getInterpretation()
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Fear-Avoidance Beliefs Questionnaire (FABQ)</h2>
              <p className="text-slate-600 mt-1">Assessment of fear-avoidance beliefs in patients with low back pain</p>
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
                  Clinician Script
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p>"I'm going to read you some statements that people have made about their back pain. For each statement, I'd like you to tell me how much you agree using a scale from 0 to 6."</p>
                <p><strong>0 = Completely disagree</strong></p>
                <p><strong>6 = Completely agree</strong></p>
                <p>"There are no right or wrong answers - I'm interested in your honest beliefs about your pain and how it affects your activities and work."</p>
              </CardContent>
            </Card>

            <Card className="bg-amber-50 border-amber-200">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                  ⚠ Contraindications & Considerations
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-amber-800">
                <p>None for questionnaire administration. High scores indicate psychological barriers to recovery that require cognitive-behavioral approaches alongside physical rehabilitation. Consider referral to psychology if very high scores or if client expresses catastrophic thinking patterns.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Physical Activity Subscale</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {FABQ_ITEMS.physical.map((item) => (
                  <div key={item.id} className="border-b pb-4 last:border-b-0">
                    <Label className="text-base mb-2 block">{item.id}. {item.text}</Label>
                    <div className="flex gap-2 flex-wrap">
                      {[0, 1, 2, 3, 4, 5, 6].map((score) => (
                        <Button
                          key={score}
                          type="button"
                          variant={scores[item.id] === score.toString() ? "default" : "outline"}
                          onClick={() => handleScoreChange(item.id, score.toString())}
                          className="w-12"
                        >
                          {score}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Work Subscale</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {FABQ_ITEMS.work.map((item) => (
                  <div key={item.id} className="border-b pb-4 last:border-b-0">
                    <Label className="text-base mb-2 block">{item.id}. {item.text}</Label>
                    <div className="flex gap-2 flex-wrap">
                      {[0, 1, 2, 3, 4, 5, 6].map((score) => (
                        <Button
                          key={score}
                          type="button"
                          variant={scores[item.id] === score.toString() ? "default" : "outline"}
                          onClick={() => handleScoreChange(item.id, score.toString())}
                          className="w-12"
                        >
                          {score}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {Object.keys(scores).length === 16 && (
              <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200">
                <CardHeader>
                  <CardTitle className="text-xl text-purple-900">Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-purple-900">
                  <div>
                    <p className="font-semibold">Physical Activity Score: {physicalScore} / 30</p>
                    <p className="font-semibold">Work Score: {workScore} / 66</p>
                    <p className="font-semibold">Total Score: {totalScore} / 96</p>
                  </div>
                  <div className="mt-4">
                    <p className="font-semibold mb-2">Interpretation:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {getInterpretation().map((interp, idx) => (
                        <li key={idx}>{interp}</li>
                      ))}
                    </ul>
                  </div>
                  {(physicalScore >= 15 || workScore >= 34) && (
                    <p className="text-sm mt-3 p-3 bg-amber-100 border border-amber-300 rounded">
                      <strong>Clinical Note:</strong> High fear-avoidance beliefs are associated with poorer outcomes. Consider graduated exposure, education about pain neuroscience, and cognitive-behavioral strategies.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional observations, client responses, treatment implications..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave}
            disabled={Object.keys(scores).length < 16}
            className="bg-amber-600 hover:bg-amber-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save FABQ Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}