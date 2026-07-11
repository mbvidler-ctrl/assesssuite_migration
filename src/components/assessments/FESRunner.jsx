import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const FES_ITEMS = [
  "Get dressed or undressed",
  "Prepare a simple meal",
  "Take a bath or shower",
  "Get in and out of a chair",
  "Get in and out of bed",
  "Answer the door or telephone",
  "Walk around the house",
  "Reach for something above your head or on the ground",
  "Go up or down stairs",
  "Walk outside to a car"
];

export default function FESRunner({ onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");

  const handleScoreChange = (index, value) => {
    setScores({ ...scores, [index]: value });
  };

  const calculateTotal = () => {
    return FES_ITEMS.reduce((sum, _, index) => sum + (parseInt(scores[index]) || 0), 0);
  };

  const total = calculateTotal();

  const getInterpretation = () => {
    const percentage = ((total / 100) * 100).toFixed(0);
    
    if (percentage >= 90) {
      return { level: 'High confidence - Low fall concern', color: 'text-green-600', bg: 'bg-green-50' };
    } else if (percentage >= 70) {
      return { level: 'Moderate confidence', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    } else {
      return { level: 'Low confidence - High fall concern', color: 'text-red-600', bg: 'bg-red-50' };
    }
  };

  const interpretation = Object.keys(scores).length === 10 ? getInterpretation() : null;

  const handleSave = () => {
    if (Object.keys(scores).length < 10) {
      toast.error("Please complete all 10 items");
      return;
    }

    onSave({
      result_value: total,
      additional_data: {
        soap_text: `• Falls Efficacy Scale (FES)\n  Total Score: ${total}/100 — ${interpretation?.level}`,
        total_score: total,
        percentage_confidence: ((total / 100) * 100).toFixed(0),
        item_scores: scores,
        interpretation: interpretation?.level
      },
      notes: notes,
      assessment_date: todayLocal()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Falls Efficacy Scale (FES)</h2>
              <p className="text-slate-600 mt-1">Assessing confidence in performing activities without falling</p>
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
                <p>"I'm going to ask you how confident you are that you can do certain activities without falling. For each activity, please rate your confidence on a scale from 0 to 10."</p>
                <p className="mt-2"><strong>0 = Not confident at all</strong></p>
                <p><strong>10 = Completely confident</strong></p>
                <p className="mt-2">"Think about how you usually do each activity. If you don't currently do an activity, imagine how confident you would feel doing it."</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>FES Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600 mb-4">How confident are you that you can do the following activities without falling?</p>
                {FES_ITEMS.map((item, index) => (
                  <div key={index} className="border-b pb-4 last:border-b-0">
                    <Label className="text-base mb-3 block font-semibold">
                      {index + 1}. {item}
                    </Label>
                    <div className="flex gap-2 flex-wrap">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                        <Button
                          key={score}
                          type="button"
                          variant={scores[index] === score.toString() ? "default" : "outline"}
                          onClick={() => handleScoreChange(index, score.toString())}
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

            {interpretation && (
              <Card className={`${interpretation.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-xl ${interpretation.color}`}>
                    {interpretation.level}
                  </CardTitle>
                </CardHeader>
                <CardContent className={interpretation.color}>
                  <p className="font-semibold text-2xl">Total Score: {total} / 100</p>
                  <p className="text-sm mt-2">Average confidence: {(total / 10).toFixed(1)} / 10</p>
                  {total < 70 && (
                    <p className="text-sm mt-3 p-3 bg-white/50 rounded">
                      <strong>Clinical Note:</strong> Low confidence may indicate fear of falling, which can lead to activity restriction and functional decline. Consider balance training and confidence-building exercises.
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
                  placeholder="Specific activities of concern, previous falls, confidence-building strategies..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={Object.keys(scores).length < 10} className="bg-emerald-600 hover:bg-emerald-700">
            <Save className="w-4 h-4 mr-2" />
            Save FES
          </Button>
        </div>
      </div>
    </div>
  );
}