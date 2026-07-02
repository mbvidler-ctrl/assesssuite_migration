import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

const PSS_QUESTIONS = [
  { text: "In the last month, how often have you been upset because of something that happened unexpectedly?", reversed: false },
  { text: "In the last month, how often have you felt that you were unable to control the important things in your life?", reversed: false },
  { text: "In the last month, how often have you felt nervous and stressed?", reversed: false },
  { text: "In the last month, how often have you felt confident about your ability to handle your personal problems?", reversed: true },
  { text: "In the last month, how often have you felt that things were going your way?", reversed: true },
  { text: "In the last month, how often have you found that you could not cope with all the things that you had to do?", reversed: false },
  { text: "In the last month, how often have you been able to control irritations in your life?", reversed: true },
  { text: "In the last month, how often have you felt that you were on top of things?", reversed: true },
  { text: "In the last month, how often have you been angered because of things that were outside of your control?", reversed: false },
  { text: "In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?", reversed: false },
];

const RESPONSE_OPTIONS = [
  { value: 0, label: "Never" },
  { value: 1, label: "Almost Never" },
  { value: 2, label: "Sometimes" },
  { value: 3, label: "Fairly Often" },
  { value: 4, label: "Very Often" },
];

export default function PerceivedStressScalePSSRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState(Array(10).fill(null));
  const [notes, setNotes] = useState("");

  const handleResponseChange = (index, value) => {
    const newResponses = [...responses];
    newResponses[index] = value;
    setResponses(newResponses);
  };

  const handleSubmit = () => {
    if (responses.includes(null)) {
      toast.error("Please answer all questions.");
      return;
    }

    const adjustedResponses = responses.map((response, index) =>
      PSS_QUESTIONS[index].reversed ? 4 - response : response
    );

    const totalScore = adjustedResponses.reduce((acc, curr) => acc + curr, 0);
    const stressLevel = totalScore <= 13 ? 'Low Stress' : totalScore <= 26 ? 'Moderate Stress' : 'High Stress';

    let soapText = `â€¢ Perceived Stress Scale (PSS-10): ${totalScore}/40 (${stressLevel})\n\n  Individual Responses:\n`;
    PSS_QUESTIONS.forEach((q, i) => {
      const opt = RESPONSE_OPTIONS.find(o => o.value === responses[i]);
      soapText += `  Q${i+1}. ${q.text}\n      Answer: ${opt ? opt.label : responses[i]}${q.reversed ? ' (reversed)' : ''}\n`;
    });

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        measurement_type: "pss",
        soap_text: soapText,
        responses,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });

    toast.success("Assessment saved successfully.");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Perceived Stress Scale (PSS-10)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Rate how often you felt or thought a certain way in the last month.
            </p>
            <div className="space-y-4">
              {PSS_QUESTIONS.map((question, index) => (
                <div key={index} className="border p-3 rounded-md">
                  <Label className="mb-2 block">{index + 1}. {question.text}</Label>
                  <div className="flex flex-wrap gap-2">
                    {RESPONSE_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        variant={responses[index] === option.value ? "default" : "outline"}
                        onClick={() => handleResponseChange(index, option.value)}
                        size="sm"
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any additional notes"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2" />
            Close
          </Button>
          <Button onClick={handleSubmit}>
            <Save className="mr-2" />
            Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}