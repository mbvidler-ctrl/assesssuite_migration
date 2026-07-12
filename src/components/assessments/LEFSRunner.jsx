import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const LEFS_ACTIVITIES = [
  "Any of your usual work, housework, or school activities",
  "Your usual hobbies, recreational or sporting activities",
  "Getting into or out of the bath",
  "Walking between rooms",
  "Putting on your shoes or socks",
  "Squatting",
  "Lifting an object, like a bag of groceries from the floor",
  "Performing light activities around your home",
  "Performing heavy activities around your home",
  "Getting into or out of a car",
  "Walking 2 blocks",
  "Walking a mile",
  "Going up or down 10 stairs (about 1 flight of stairs)",
  "Standing for 1 hour",
  "Sitting for 1 hour",
  "Running on even ground",
  "Running on uneven ground",
  "Making sharp turns while running fast",
  "Hopping",
  "Rolling over in bed"
];

export default function LEFSRunner({ onSave, onClose }) {
  const [side, setSide] = useState("right");
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");

  const handleScoreChange = (index, score) => {
    setScores({ ...scores, [index]: score });
  };

  const calculateTotal = () => {
    return LEFS_ACTIVITIES.reduce((sum, _, index) => 
      sum + (parseInt(scores[index]) || 0), 0);
  };

  const total = calculateTotal();

  const getInterpretation = () => {
    if (total >= 60) return { level: 'Minimal Functional Limitation', color: 'text-green-600', bg: 'bg-green-50' };
    if (total >= 40) return { level: 'Moderate Functional Limitation', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { level: 'Severe Functional Limitation', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const interpretation = Object.keys(scores).length === 20 ? getInterpretation() : null;

  const handleSave = () => {
    if (Object.keys(scores).length < 20) {
      toast.error("Please complete all 20 items");
      return;
    }

    const itemDetails = LEFS_ACTIVITIES.map((activity, index) => 
      `Q${index + 1}. ${activity}: ${scores[index]}`
    ).join("\n");

    const soapText = `• Lower Extremity Functional Scale (LEFS): ${total} score (0-80)\n  Side: ${side}\n  Total Score: ${total}\n  Interpretation: ${interpretation?.level}\n\n  Item Responses:\n${itemDetails}${notes ? `\n\n  Clinical Notes: ${notes}` : ''}`;

    onSave({
      result_value: total,
      additional_data: {
        soap_text: soapText,
        side: side,
        total_score: total,
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
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Lower Extremity Functional Scale (LEFS)</h2>
              <p className="text-slate-600 mt-1">Lower limb functional disability questionnaire</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>Binkley JM, Stratford PW, Lott SA, & Riddle DL. (1999). The Lower Extremity Functional Scale (LEFS): Scale development, measurement properties, and clinical application. <em>Physical Therapy, 79</em>(4), 371–383.</p>
            </div>

            {/* Norms */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Score Interpretation (/80)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Score</th><th className="p-2 text-left">Interpretation</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">60–80</td><td className="p-2 text-green-700">Minimal functional limitation</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">40–59</td><td className="p-2 text-yellow-700">Moderate functional limitation</td></tr>
                    <tr className="border-t"><td className="p-2">&lt;40</td><td className="p-2 text-red-700">Severe functional limitation</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">0 = extreme difficulty/unable; 4 = no difficulty per item. MCID: 9 points. Higher scores = better function. Source: Binkley et al. (1999).</p>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p>"For each activity, please indicate the current level of difficulty you experience due to your lower limb problem."</p>
                <div className="mt-3 space-y-1">
                  <p><strong>0 = Extreme difficulty or unable to perform</strong></p>
                  <p><strong>1 = Quite a bit of difficulty</strong></p>
                  <p><strong>2 = Moderate difficulty</strong></p>
                  <p><strong>3 = A little bit of difficulty</strong></p>
                  <p><strong>4 = No difficulty</strong></p>
                </div>
              </CardContent>
            </Card>

            <div>
              <Label>Affected Lower Extremity</Label>
              <Select value={side} onValueChange={setSide}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="right">Right</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="bilateral">Bilateral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>LEFS Activities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {LEFS_ACTIVITIES.map((activity, index) => (
                  <div key={index} className="border-b pb-3 last:border-b-0">
                    <Label className="text-base mb-2 block">{index + 1}. {activity}</Label>
                    <div className="flex gap-2">
                      {[4, 3, 2, 1, 0].map((score) => (
                        <Button
                          key={score}
                          type="button"
                          variant={scores[index] === score ? "default" : "outline"}
                          onClick={() => handleScoreChange(index, score)}
                          className="flex-1"
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
                  <p className="font-semibold text-2xl">Total: {total} / 80</p>
                  <p className="text-sm mt-2">Higher scores = better function</p>
                  <p className="text-sm mt-3">
                    <strong>MCID:</strong> 9-point change indicates clinically meaningful improvement.
                  </p>
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
                  placeholder="Specific activity limitations, goals, treatment focus..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={Object.keys(scores).length < 20} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Save LEFS
          </Button>
        </div>
      </div>
    </div>
  );
}