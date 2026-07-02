import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

const HADS_ITEMS = [
  { id: 1, text: "I feel tense or 'wound up'", subscale: "anxiety", options: ["Most of the time", "A lot of the time", "Time to time, occasionally", "Not at all"], scores: [3,2,1,0] },
  { id: 2, text: "I still enjoy the things I used to enjoy", subscale: "depression", options: ["Definitely as much", "Not quite so much", "Only a little", "Hardly at all"], scores: [0,1,2,3] },
  { id: 3, text: "I get a sort of frightened feeling as if something awful is about to happen", subscale: "anxiety", options: ["Very definitely and quite badly", "Yes, but not too badly", "A little, but it doesn't worry me", "Not at all"], scores: [3,2,1,0] },
  { id: 4, text: "I can laugh and see the funny side of things", subscale: "depression", options: ["As much as I always could", "Not quite so much now", "Definitely not so much now", "Not at all"], scores: [0,1,2,3] },
  { id: 5, text: "Worrying thoughts go through my mind", subscale: "anxiety", options: ["A great deal of the time", "A lot of the time", "From time to time but not too often", "Only occasionally"], scores: [3,2,1,0] },
  { id: 6, text: "I feel cheerful", subscale: "depression", options: ["Not at all", "Not often", "Sometimes", "Most of the time"], scores: [3,2,1,0] },
  { id: 7, text: "I can sit at ease and feel relaxed", subscale: "anxiety", options: ["Definitely", "Usually", "Not often", "Not at all"], scores: [0,1,2,3] },
  { id: 8, text: "I feel as if I am slowed down", subscale: "depression", options: ["Nearly all the time", "Very often", "Sometimes", "Not at all"], scores: [3,2,1,0] },
  { id: 9, text: "I get a sort of frightened feeling like 'butterflies' in the stomach", subscale: "anxiety", options: ["Not at all", "Occasionally", "Quite often", "Very often"], scores: [0,1,2,3] },
  { id: 10, text: "I have lost interest in my appearance", subscale: "depression", options: ["Definitely", "I don't take as much care as I should", "I may not take quite as much care", "I take just as much care as ever"], scores: [3,2,1,0] },
  { id: 11, text: "I feel restless as if I have to be on the move", subscale: "anxiety", options: ["Very much indeed", "Quite a lot", "Not very much", "Not at all"], scores: [3,2,1,0] },
  { id: 12, text: "I look forward with enjoyment to things", subscale: "depression", options: ["As much as ever I did", "Rather less than I used to", "Definitely less than I used to", "Hardly at all"], scores: [0,1,2,3] },
  { id: 13, text: "I get sudden feelings of panic", subscale: "anxiety", options: ["Very often indeed", "Quite often", "Not very often", "Not at all"], scores: [3,2,1,0] },
  { id: 14, text: "I can enjoy a good book or radio or TV program", subscale: "depression", options: ["Often", "Sometimes", "Not often", "Very seldom"], scores: [0,1,2,3] }
];

export default function HADSRunner({ onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");

  const handleScoreChange = (itemId, score) => {
    setScores({ ...scores, [itemId]: score });
  };

  const calculateScores = () => {
    const anxiety = HADS_ITEMS.filter(i => i.subscale === "anxiety")
      .reduce((sum, item) => sum + (parseInt(scores[item.id]) || 0), 0);
    const depression = HADS_ITEMS.filter(i => i.subscale === "depression")
      .reduce((sum, item) => sum + (parseInt(scores[item.id]) || 0), 0);
    return { anxiety, depression };
  };

  const { anxiety, depression } = calculateScores();

  const getInterpretation = (score, type) => {
    if (score <= 7) return { level: `Normal ${type}`, color: 'text-green-600' };
    if (score <= 10) return { level: `Borderline abnormal ${type}`, color: 'text-yellow-600' };
    return { level: `Abnormal ${type} - Clinical concern`, color: 'text-red-600' };
  };

  const anxietyInterp = getInterpretation(anxiety, "anxiety");
  const depressionInterp = getInterpretation(depression, "depression");

  const handleSave = () => {
    if (Object.keys(scores).length < 14) {
      toast.error("Please complete all 14 items");
      return;
    }

    // Generate comprehensive SOAP text with all Q&A
    let soapText = `Hospital Anxiety and Depression Scale (HADS) Assessment:\n\n`;
    soapText += `Individual Question Responses:\n`;
    
    HADS_ITEMS.forEach((item) => {
      const score = parseInt(scores[item.id]);
      const optionIndex = item.scores.indexOf(score);
      const selectedOption = item.options[optionIndex];
      soapText += `\nQ${item.id}. ${item.text} [${item.subscale}]\n`;
      soapText += `    Answer: ${selectedOption} (Score: ${score})\n`;
    });

    soapText += `\nSubscale Scores:\n`;
    soapText += `  â€¢ Anxiety: ${anxiety}/21 - ${anxietyInterp.level}\n`;
    soapText += `  â€¢ Depression: ${depression}/21 - ${depressionInterp.level}\n`;
    soapText += `  â€¢ Total HADS Score: ${anxiety + depression}/42\n`;

    if (notes && notes.trim()) {
      soapText += `\nClinical Notes: ${notes}\n`;
    }

    onSave({
      result_value: anxiety + depression,
      additional_data: {
        anxiety_score: anxiety,
        depression_score: depression,
        anxiety_interpretation: anxietyInterp.level,
        depression_interpretation: depressionInterp.level,
        item_scores: scores,
        soap_text: soapText
      },
      notes: notes,
      assessment_date: new Date().toISOString()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }} onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-teal-50 to-cyan-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Hospital Anxiety and Depression Scale (HADS)</h2>
              <p className="text-slate-600 mt-1">Screening for anxiety and depression symptoms</p>
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
              <CardContent className="text-sm text-blue-800">
                <p>"I'm going to read some statements about how you've been feeling recently. For each one, please choose the response that best describes how you've felt over the past week."</p>
                <p className="mt-2">"There are no right or wrong answers - we're interested in your recent experience."</p>
              </CardContent>
            </Card>

            <Card className="bg-amber-50 border-amber-200">
              <CardHeader>
                <CardTitle className="text-sm text-amber-800">âš ï¸ Clinical Considerations</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-amber-800">
                <p>Scores â‰¥11 indicate probable presence of mood disorder. Recommend referral to GP or mental health professional for further assessment. High scores may affect exercise tolerance, motivation, and safety.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">HADS Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {HADS_ITEMS.map((item) => (
                  <div key={item.id} className="border-b pb-4 last:border-b-0">
                    <Label className="text-base mb-2 block font-semibold">
                      {item.id}. {item.text}
                      <span className="text-xs text-slate-500 ml-2">({item.subscale})</span>
                    </Label>
                    <div className="space-y-2">
                      {item.options.map((option, idx) => (
                        <Button
                          key={idx}
                          type="button"
                          variant={scores[item.id] === item.scores[idx].toString() ? "default" : "outline"}
                          onClick={() => handleScoreChange(item.id, item.scores[idx].toString())}
                          className="w-full justify-start text-left h-auto py-2"
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {Object.keys(scores).length === 14 && (
              <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2">
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className={`font-semibold text-lg ${anxietyInterp.color}`}>
                      Anxiety: {anxiety}/21 - {anxietyInterp.level}
                    </p>
                    <p className={`font-semibold text-lg ${depressionInterp.color}`}>
                      Depression: {depression}/21 - {depressionInterp.level}
                    </p>
                  </div>
                  {(anxiety >= 11 || depression >= 11) && (
                    <p className="text-sm p-3 bg-red-100 border border-red-300 rounded">
                      <strong>Action Required:</strong> Scores indicate clinical concern. Refer to appropriate mental health services.
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
                  placeholder="Client presentation, referrals made, exercise modifications..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={Object.keys(scores).length < 14} className="bg-teal-600 hover:bg-teal-700">
            <Save className="w-4 h-4 mr-2" />
            Save HADS
          </Button>
        </div>
      </div>
    </div>
  );
}