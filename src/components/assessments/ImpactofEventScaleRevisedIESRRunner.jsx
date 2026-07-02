import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

const questions = [
  "Any reminder brought back feelings about it.",
  "I had trouble staying asleep.",
  "Other things kept making me think about it.",
  "I felt irritable and angry.",
  "I avoided letting myself get upset when I thought about it or was reminded of it.",
  "I thought about it when I didn't mean to.",
  "I felt as if it hadn't happened or wasn't real.",
  "I stayed away from reminders about it.",
  "Pictures about it popped into my mind.",
  "I was jumpy and easily startled.",
  "I tried not to think about it.",
  "I was aware that I still had a lot of feelings about it, but I didn't deal with them.",
  "My feelings about it were kind of numb.",
  "I found myself acting or feeling like I was back at that time.",
  "I had trouble falling asleep.",
  "I had waves of strong feelings about it.",
  "I tried to remove it from my memory.",
  "I had trouble concentrating.",
  "Reminders of it caused me to have physical reactions, such as sweating, trouble breathing, nausea, or a pounding heart.",
  "I had dreams about it.",
  "I felt watchful and on-guard.",
  "I tried not to talk about it."
];

const subscales = {
  intrusion: [0, 1, 2, 5, 8, 13, 15, 19],
  avoidance: [4, 6, 7, 10, 11, 12, 16, 21],
  hyperarousal: [3, 9, 14, 17, 18, 20]
};

export default function ImpactofEventScaleRevisedIESRRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState(Array(22).fill(null));
  const [notes, setNotes] = useState("");

  const handleResponseChange = (index, value) => {
    const newResponses = [...responses];
    newResponses[index] = value;
    setResponses(newResponses);
  };

  const calculateSubscaleScore = (indices) => {
    const scores = indices.map((index) => responses[index]);
    return scores.reduce((sum, score) => sum + score, 0) / indices.length;
  };

  const handleSave = () => {
    if (responses.includes(null)) {
      toast.error("Please answer all questions before saving.");
      return;
    }

    const totalScore = responses.reduce((sum, score) => sum + score, 0);
    const subscaleScores = {
      intrusion: calculateSubscaleScore(subscales.intrusion),
      avoidance: calculateSubscaleScore(subscales.avoidance),
      hyperarousal: calculateSubscaleScore(subscales.hyperarousal)
    };

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        measurement_type: "questionnaire",
        subscale_scores: subscaleScores
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0]
    });

    toast.success("Assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Impact of Event Scale-Revised (IES-R)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Please rate how much you have been distressed or bothered by each of the following difficulties during the past seven days.
            </p>
            <div className="space-y-3">
              {questions.map((question, index) => (
                <div key={index} className="border-b pb-3">
                  <Label className="mb-2 block">{index + 1}. {question}</Label>
                  <div className="flex space-x-2">
                    {[0, 1, 2, 3, 4].map((value) => (
                      <Button
                        key={value}
                        variant={responses[index] === value ? "default" : "outline"}
                        onClick={() => handleResponseChange(index, value)}
                        size="sm"
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Label>Additional Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any additional notes here..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2" /> Close
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-2" /> Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}