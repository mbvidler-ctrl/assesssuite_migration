import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

const FES_ACTIVITIES = [
  "Cleaning the house",
  "Getting dressed or undressed",
  "Preparing simple meals",
  "Taking a bath or shower",
  "Going shopping",
  "Getting in or out of a chair",
  "Going up or down stairs",
  "Walking around in the neighborhood",
  "Reaching for something above your head or on the ground",
  "Going to answer the telephone before it stops ringing",
];

export default function FallsEfficacyScaleFESRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState(Array(10).fill(null));
  const [notes, setNotes] = useState("");

  const handleResponseChange = (index, value) => {
    const newResponses = [...responses];
    newResponses[index] = value;
    setResponses(newResponses);
  };

  const handleSubmit = () => {
    if (responses.includes(null)) {
      toast.error("Please answer all questions before submitting.");
      return;
    }

    const totalScore = responses.reduce((acc, curr) => acc + curr, 0);
    const interpretation = totalScore <= 70 ? "Low fall concern" : totalScore <= 80 ? "Moderate fall concern" : "High fall concern";

    // Build soap_text for direct SOAP injection
    let soapText = `• Falls Efficacy Scale (FES):\n  Total Score: ${totalScore}/100 (${interpretation})\n\n  Individual Item Scores (1=Not confident, 10=Completely confident):\n`;
    FES_ACTIVITIES.forEach((activity, i) => {
      soapText += `    ${i + 1}. ${activity}: ${responses[i]}/10\n`;
    });

    const additionalData = {
      measurement_type: "fes",
      soap_text: soapText,
      responses,
      interpretation,
    };

    const today = new Date();
    const assessmentDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        ...additionalData,
        soap_text: soapText  // Explicitly ensure soap_text is included
      },
      notes,
      assessment_date: assessmentDate,
    });

    toast.success("Assessment saved successfully.");
    onClose();
  };

  const answeredCount = responses.filter(r => r !== null).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Falls Efficacy Scale (FES)</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Clinician Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1 text-sm text-blue-900">
              <p className="font-semibold text-blue-800">Clinician Instructions</p>
              <p><strong>Purpose:</strong> Measures fear of falling / fall-related self-efficacy across 10 activities of daily living.</p>
              <p><strong>Administration:</strong> Self-report or interviewer-administered. Ask the client to rate their <em>confidence</em> in performing each activity without falling (1 = not at all confident, 10 = completely confident).</p>
              <p><strong>Scoring:</strong> Sum all items (range 10–100). Higher scores indicate greater confidence. Scores ≤70 = low concern, 71–80 = moderate concern, &gt;80 = high concern.</p>
              <p><strong>Population:</strong> Community-dwelling older adults. Not suitable for clients who are completely unable to perform an activity.</p>
              <p><strong>Reference form:</strong> <a href="https://www.physio-pedia.com/Falls_Efficacy_Scale" target="_blank" rel="noopener noreferrer" className="underline text-blue-700 hover:text-blue-900">FES Reference ↗</a></p>
            </div>

            <p className="text-sm text-gray-500">
              Rate your confidence in doing each activity <strong>without falling</strong> (1 = Not confident at all, 10 = Completely confident)
            </p>

            <div className="space-y-4">
              {FES_ACTIVITIES.map((activity, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <Label className="mb-2 block font-medium">{index + 1}. {activity}</Label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                      <Button
                        key={value}
                        variant={responses[index] === value ? "default" : "outline"}
                        onClick={() => handleResponseChange(index, value)}
                        size="sm"
                        className="w-9 h-9"
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {answeredCount === 10 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                <strong>Total Score: {responses.reduce((a, b) => a + b, 0)}/100</strong>
                {" — "}{responses.reduce((a, b) => a + b, 0) <= 70 ? "Low fall concern" : responses.reduce((a, b) => a + b, 0) <= 80 ? "Moderate fall concern" : "High fall concern"}
              </div>
            )}

            <div>
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any additional notes"
                className="mt-1"
              />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={onClose}><X className="mr-2 w-4 h-4" />Cancel</Button>
              <Button onClick={handleSubmit}><Save className="mr-2 w-4 h-4" />Save Assessment</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}