import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import { toast } from "sonner";
import { scoreFabq } from "@/lib/clinical/scorers/coreB";

const FABQ_QUESTIONS = [
  "My pain was caused by physical activity",
  "Physical activity makes my pain worse",
  "Physical activity might harm my back",
  "I should not do physical activities which might make my pain worse",
  "I cannot do physical activities which might make my pain worse",
  "My pain was caused by my work or by an accident at work",
  "My work aggravated my pain",
  "I have a claim for compensation for my pain",
  "My work is too heavy for me",
  "My work makes or would make my pain worse",
  "My work might harm my back",
  "I should not do my normal work with my present pain",
  "I cannot do my normal work with my present pain",
  "I cannot do my normal work till my pain is treated",
  "I do not think I will be back to normal work within 3 months",
  "I do not think I will ever be able to go back to work",
];

export default function FearAvoidanceBeliefsQuestionnaireFABQRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState(Array(16).fill(null));
  const [notes, setNotes] = useState("");

  const handleResponseChange = (index, value) => {
    const newResponses = [...responses];
    newResponses[index] = value;
    setResponses(newResponses);
  };

  const handleSubmit = () => {
    try {
      onSave(scoreFabq({ responses, notes }, { assessmentName: 'Fear-Avoidance Beliefs Questionnaire (FABQ)', client }));
      toast.success("Assessment saved successfully.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save FABQ assessment.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
        <CardHeader>
          <CardTitle>Fear-Avoidance Beliefs Questionnaire (FABQ)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            Rate your agreement (0 = Completely disagree, 6 = Completely agree)
          </p>
          <div className="space-y-3">
            {FABQ_QUESTIONS.map((question, index) => (
              <div key={index}>
                <Label className="mb-2">{question}</Label>
                <div className="flex space-x-2">
                  {[0, 1, 2, 3, 4, 5, 6].map((value) => (
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
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any additional notes"
            />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end space-x-2 mt-4">
        <Button variant="outline" onClick={onClose}>
          <X className="mr-2" />
          Cancel
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
