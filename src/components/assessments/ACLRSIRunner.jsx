import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";

const ACL_RSI_QUESTIONS = [
  { text: "Are you confident that you can perform at your previous level of sport?", id: "q1" },
  { text: "Do you think you are likely to re-injure your knee by participating in your sport?", id: "q2" },
  { text: "Are you nervous about playing your sport?", id: "q3" },
  { text: "Are you confident that your knee will not give way?", id: "q4" },
  { text: "Are you confident you could play your sport without concern for your knee?", id: "q5" },
  { text: "Do you find it frustrating to consider your knee with respect to sport?", id: "q6" },
  { text: "Are you fearful of re-injuring your knee by participating in your sport?", id: "q7" },
  { text: "Are you confident about your knee holding up under pressure?", id: "q8" },
  { text: "Are you afraid of accidentally injuring your knee?", id: "q9" },
  { text: "Do thoughts about your knee/surgery/rehabilitation prevent you from playing your sport?", id: "q10" },
  { text: "Are you confident about your ability to perform well at your sport?", id: "q11" },
  { text: "Do you feel relaxed about playing your sport?", id: "q12" },
];

export default function ACLRSIRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState(Array(12).fill(5));
  const [notes, setNotes] = useState("");

  const handleResponseChange = (index, value) => {
    const newResponses = [...responses];
    newResponses[index] = value[0];
    setResponses(newResponses);
  };

  const getTotalScore = () => {
    const total = responses.reduce((acc, curr) => acc + curr, 0);
    return total;
  };

  const getPercentageScore = () => {
    return ((getTotalScore() / 120) * 100).toFixed(1);
  };

  const handleSave = () => {
    const percentageScore = parseFloat(getPercentageScore());
    const readiness = percentageScore >= 77 ? 'Psychologically Ready' : percentageScore >= 56 ? 'Moderate Readiness' : 'Low Readiness';

    let soapText = `â€¢ ACL-RSI: ${percentageScore}% (${readiness})\n  Total: ${getTotalScore()}/120\n\n  Individual Responses:\n`;
    ACL_RSI_QUESTIONS.forEach((q, i) => {
      soapText += `  Q${i+1}. ${q.text}\n      Score: ${responses[i]}/10\n`;
    });

    onSave({
      status: "completed",
      result_value: percentageScore,
      additional_data: {
        measurement_type: "aclrsi",
        soap_text: soapText,
        aclrsi_data: {
          result_value: percentageScore,
          responses,
          total_score: getTotalScore(),
          percentage_score: percentageScore
        }
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0]
    });

    toast.success("Assessment saved successfully.");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>ACL Return to Sport after Injury (ACL-RSI)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p><strong>Total Score:</strong> {getTotalScore()}/120 ({getPercentageScore()}%)</p>
                  <p className="text-xs mt-1">Each question scored 0-10. Higher scores indicate greater psychological readiness to return to sport.</p>
                </div>
              </div>

              {ACL_RSI_QUESTIONS.map((question, index) => (
                <div key={question.id} className="border p-4 rounded-md">
                  <Label className="mb-3 block">{index + 1}. {question.text}</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[responses[index]]}
                      onValueChange={(value) => handleResponseChange(index, value)}
                      min={0}
                      max={10}
                      step={1}
                      className="flex-1"
                    />
                    <span className="w-12 text-center font-semibold text-lg">{responses[index]}/10</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>0 - Not confident/Very nervous</span>
                    <span>10 - Extremely confident/Not nervous</span>
                  </div>
                </div>
              ))}

              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter any additional notes"
                  rows={4}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2" />
            Close
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-2" />
            Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}