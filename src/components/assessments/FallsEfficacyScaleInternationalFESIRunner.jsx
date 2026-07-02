import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

const FESI_ACTIVITIES = [
  "Cleaning the house",
  "Getting dressed or undressed",
  "Preparing simple meals",
  "Taking a bath or shower",
  "Going to the shop",
  "Getting in or out of a chair",
  "Going up or down stairs",
  "Walking around in the neighborhood",
  "Reaching for something above your head or on the ground",
  "Going to answer the telephone before it stops ringing",
  "Walking on a slippery surface",
  "Visiting a friend or relative",
  "Walking in a place with crowds",
  "Walking on an uneven surface",
  "Walking up or down a slope",
  "Going out to a social event",
];

const CONCERN_LABELS = { 1: "Not at all concerned", 2: "Somewhat concerned", 3: "Fairly concerned", 4: "Very concerned" };

export default function FallsEfficacyScaleInternationalFESIRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState(Array(16).fill(null));
  const [notes, setNotes] = useState("");

  const handleResponseChange = (index, value) => {
    const newResponses = [...responses];
    newResponses[index] = value;
    setResponses(newResponses);
  };

  const handleSave = () => {
    if (responses.includes(null)) {
      toast.error("Please answer all questions before saving.");
      return;
    }

    const totalScore = responses.reduce((sum, score) => sum + score, 0);
    let concernLevel = "Low concern about falling (16â€“19)";
    if (totalScore >= 20 && totalScore <= 27) concernLevel = "Moderate concern about falling (20â€“27)";
    else if (totalScore >= 28) concernLevel = "High concern about falling (28â€“64)";

    // Build soap_text for direct SOAP injection
    let soapText = `â€¢ Falls Efficacy Scale â€“ International (FES-I):\n  Total Score: ${totalScore}/64 â€” ${concernLevel}\n\n  Individual Item Scores (1=Not concerned, 4=Very concerned):\n`;
    FESI_ACTIVITIES.forEach((activity, i) => {
      soapText += `    ${i + 1}. ${activity}: ${responses[i]} (${CONCERN_LABELS[responses[i]]})\n`;
    });

    const additionalData = {
      measurement_type: "fesi",
      soap_text: soapText,
      responses,
      concern_level: concernLevel,
      activities: FESI_ACTIVITIES,
    };

    const today = new Date();
    const assessmentDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: additionalData,
      notes: soapText,
      assessment_date: assessmentDate,
    });

    toast.success("Assessment recorded â€” please confirm and save.");
  };

  const answeredCount = responses.filter(r => r !== null).length;
  const currentScore = responses.filter(r => r !== null).reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Falls Efficacy Scale â€“ International (FES-I)</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Clinician Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1 text-sm text-blue-900">
              <p className="font-semibold text-blue-800">Clinician Instructions</p>
              <p><strong>Purpose:</strong> Measures concern about falling during 16 activities of daily living, including social activities and outdoor tasks.</p>
              <p><strong>Administration:</strong> Self-report or interviewer-administered. Ask the client to rate their level of <em>concern</em> about falling when performing each activity, even if they don't normally do the activity.</p>
              <p><strong>Scoring:</strong> Sum all 16 items (range 16â€“64). Higher scores = greater concern. <strong>16â€“19</strong> = Low concern; <strong>20â€“27</strong> = Moderate concern; <strong>â‰¥28</strong> = High concern.</p>
              <p><strong>Clinically important difference:</strong> 4â€“6 points.</p>
              <p><strong>Population:</strong> Older adults (community and clinical). Validated in multiple languages.</p>
              <p><strong>Reference form:</strong> <a href="https://www.physio-pedia.com/Falls_Efficacy_Scale_-_International_(FES-I)" target="_blank" rel="noopener noreferrer" className="underline text-blue-700 hover:text-blue-900">FES-I Reference â†—</a></p>
            </div>

            <p className="text-sm text-gray-500">
              Rate your <strong>concern about falling</strong> when performing each activity (1 = Not at all concerned, 4 = Very concerned)
            </p>

            <div className="space-y-4">
              {FESI_ACTIVITIES.map((activity, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <Label className="mb-2 block font-medium">{index + 1}. {activity}</Label>
                  <div className="flex gap-3 flex-wrap">
                    {[1, 2, 3, 4].map((value) => (
                      <Button
                        key={value}
                        variant={responses[index] === value ? "default" : "outline"}
                        onClick={() => handleResponseChange(index, value)}
                        className="flex flex-col h-auto py-2 px-3 text-xs"
                      >
                        <span className="font-bold">{value}</span>
                        <span className="text-xs opacity-80 whitespace-nowrap">{CONCERN_LABELS[value]}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {answeredCount === 16 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                <strong>Total Score: {currentScore}/64</strong>
                {" â€” "}{currentScore <= 19 ? "Low concern" : currentScore <= 27 ? "Moderate concern" : "High concern"}
              </div>
            )}

            <div>
              <Label>Additional Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any additional notes"
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={onClose}><X className="mr-2 w-4 h-4" />Close</Button>
              <Button onClick={handleSave}><Save className="mr-2 w-4 h-4" />Save</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}