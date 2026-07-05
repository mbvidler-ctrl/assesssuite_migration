import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

const questions = [
  { id: 1, text: "I feel tense or wound up", type: "anxiety" },
  { id: 2, text: "I get a sort of frightened feeling as if something awful is about to happen", type: "anxiety" },
  { id: 3, text: "Worrying thoughts go through my mind", type: "anxiety" },
  { id: 4, text: "I can sit at ease and feel relaxed", type: "anxiety" },
  { id: 5, text: "I get a sort of frightened feeling like 'butterflies' in the stomach", type: "anxiety" },
  { id: 6, text: "I feel restless as I have to be on the move", type: "anxiety" },
  { id: 7, text: "I get sudden feelings of panic", type: "anxiety" },
  { id: 8, text: "I still enjoy the things I used to enjoy", type: "depression" },
  { id: 9, text: "I can laugh and see the funny side of things", type: "depression" },
  { id: 10, text: "I feel cheerful", type: "depression" },
  { id: 11, text: "I feel as if I am slowed down", type: "depression" },
  { id: 12, text: "I have lost interest in my appearance", type: "depression" },
  { id: 13, text: "I look forward with enjoyment to things", type: "depression" },
  { id: 14, text: "I can enjoy a good book or radio or TV program", type: "depression" },
];

const getSeverity = (score) => {
  if (score <= 7) return "Normal";
  if (score <= 10) return "Borderline";
  return "Clinical case";
};

export default function HospitalAnxietyandDepressionScaleHADSRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");

  const handleResponseChange = (id, value) => {
    setResponses((prev) => ({ ...prev, [id]: value }));
  };

  const handleSave = () => {
    const missing = questions.filter(q => responses[q.id] === undefined);
    if (missing.length > 0) {
      toast.error(`Please answer all questions. ${missing.length} remaining.`);
      return;
    }

    const anxietyScore = questions
      .filter(q => q.type === "anxiety")
      .reduce((sum, q) => sum + (responses[q.id] || 0), 0);
    const depressionScore = questions
      .filter(q => q.type === "depression")
      .reduce((sum, q) => sum + (responses[q.id] || 0), 0);

    const anxietySeverity = getSeverity(anxietyScore);
    const depressionSeverity = getSeverity(depressionScore);
    const totalScore = anxietyScore + depressionScore;

    const soapText = `• Hospital Anxiety and Depression Scale (HADS)\n  Anxiety (HADS-A): ${anxietyScore}/21 — ${anxietySeverity}\n  Depression (HADS-D): ${depressionScore}/21 — ${depressionSeverity}\n  Total: ${totalScore}/42\n  Score Ranges: 0–7 Normal | 8–10 Borderline | 11–21 Clinical case\n  Reference: Zigmond & Snaith (1983). Acta Psychiatrica Scandinavica, 67(6), 361–370.`;

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        soap_text: soapText,
        measurement_type: "questionnaire",
        anxiety_score: anxietyScore,
        depression_score: depressionScore,
        anxiety_severity: anxietySeverity,
        depression_severity: depressionSeverity,
        responses,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hospital Anxiety and Depression Scale (HADS)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                Rate how you have felt over the past week. 0 = Not at all, 3 = Most of the time.
              </p>
              <div className="space-y-4">
                {questions.map((q) => (
                  <div key={q.id} className="flex items-center justify-between gap-2">
                    <Label className="flex-1 text-sm">
                      <span className="text-xs text-gray-400 mr-1">[{q.type === "anxiety" ? "A" : "D"}]</span>
                      {q.text}
                    </Label>
                    <div className="flex space-x-1">
                      {[0, 1, 2, 3].map((value) => (
                        <Button
                          key={value}
                          variant={responses[q.id] === value ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleResponseChange(q.id, value)}
                          className="w-9"
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
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Enter any additional notes..." rows={3} />
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="outline" onClick={onClose}><X className="mr-2" />Close</Button>
            <Button onClick={handleSave}><Save className="mr-2" />Save Assessment</Button>
          </div>
        </div>
      </div>
    </div>
  );
}