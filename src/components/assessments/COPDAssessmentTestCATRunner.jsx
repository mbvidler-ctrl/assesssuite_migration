import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

const questions = [
  { key: "cough", text: "Cough", anchorLeft: "I never cough", anchorRight: "I cough all the time" },
  { key: "phlegm", text: "Phlegm", anchorLeft: "I have no phlegm (mucus) in my chest at all", anchorRight: "My chest is completely full of phlegm (mucus)" },
  { key: "chestTightness", text: "Chest tightness", anchorLeft: "My chest does not feel tight at all", anchorRight: "My chest feels very tight" },
  { key: "breathlessness", text: "Breathlessness", anchorLeft: "When I walk up a hill or one flight of stairs I am not breathless", anchorRight: "When I walk up a hill or one flight of stairs I am very breathless" },
  { key: "activities", text: "Activity limitation", anchorLeft: "I am not limited doing any activities at home", anchorRight: "I am very limited doing activities at home" },
  { key: "confidence", text: "Confidence leaving home", anchorLeft: "I am confident leaving my home despite my lung condition", anchorRight: "I am not at all confident leaving my home because of my lung condition" },
  { key: "sleep", text: "Sleep", anchorLeft: "I sleep soundly", anchorRight: "I don't sleep soundly because of my lung condition" },
  { key: "energy", text: "Energy", anchorLeft: "I have lots of energy", anchorRight: "I have no energy at all" },
];

export default function COPDAssessmentTestCATRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({
    cough: null,
    phlegm: null,
    chestTightness: null,
    breathlessness: null,
    activities: null,
    confidence: null,
    sleep: null,
    energy: null,
  });
  const [notes, setNotes] = useState("");

  const handleResponseChange = (key, value) => {
    setResponses((prev) => ({ ...prev, [key]: value }));
  };

  const calculateScore = () => {
    return Object.values(responses).reduce((acc, val) => acc + (val || 0), 0);
  };

  const handleSubmit = () => {
    if (Object.values(responses).includes(null)) {
      toast.error("Please answer all questions before submitting.");
      return;
    }

    const score = calculateScore();

    const interpretation = score < 10 ? 'Low Impact' : score < 21 ? 'Medium Impact' : score < 31 ? 'High Impact' : 'Very High Impact';
    const soapText = `COPD Assessment Test (CAT):\n  Total Score: ${score}/40\n  Impact Level: ${interpretation}\n  Responses:\n${questions.map(q => `    - ${q.text}: ${responses[q.key]}/5`).join('\n')}`; 

    onSave({
      status: "completed",
      result_value: score,
      additional_data: {
        measurement_type: "cat",
        cat_data: { score, interpretation, responses },
        soap_text: soapText,
        responses,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>COPD Assessment Test (CAT)</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Clinician Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-900">
              <p className="font-semibold mb-2">Clinician Instructions</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Ask the patient to complete all 8 items by selecting a score from <strong>0 to 5</strong> for each question.</li>
                <li>Each item is anchored at either end with opposing statements (e.g., "I never cough" = 0, "I cough all the time" = 5).</li>
                <li>Total score ranges from <strong>0–40</strong>.</li>
              </ul>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="bg-green-100 border border-green-300 rounded px-2 py-1 text-green-800"><strong>0–9:</strong> Low Impact</div>
                <div className="bg-yellow-100 border border-yellow-300 rounded px-2 py-1 text-yellow-800"><strong>10–20:</strong> Medium Impact</div>
                <div className="bg-orange-100 border border-orange-300 rounded px-2 py-1 text-orange-800"><strong>21–30:</strong> High Impact</div>
                <div className="bg-red-100 border border-red-300 rounded px-2 py-1 text-red-800"><strong>31–40:</strong> Very High Impact</div>
              </div>
            </div>

            <div className="space-y-4">
              {questions.map(({ key, text, anchorLeft, anchorRight }) => (
                <div key={key} className="p-4 bg-slate-50 rounded-lg border">
                  <Label className="mb-3 block font-semibold text-slate-800">{text}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 w-40 text-right leading-tight">{anchorLeft}</span>
                    <div className="flex gap-1 flex-1 justify-center">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <button
                          key={i}
                          onClick={() => handleResponseChange(key, i)}
                          className={`w-10 h-10 rounded-full text-sm font-semibold border-2 transition-all ${
                            responses[key] === i
                              ? "bg-blue-600 text-white border-blue-600 scale-110 shadow"
                              : "bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600"
                          }`}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-slate-600 w-40 leading-tight">{anchorRight}</span>
                  </div>
                </div>
              ))}
              <div className="mt-4">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter any additional notes here..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-between items-center mt-4">
          <Badge variant="outline" className="text-sm">
            Total Score: {calculateScore()} / 40
          </Badge>
          <div className="flex space-x-2">
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
    </div>
  );
}