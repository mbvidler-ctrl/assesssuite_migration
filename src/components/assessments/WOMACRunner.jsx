import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

const WOMAC_SECTIONS = {
  pain: [
    "Walking on a flat surface",
    "Going up or down stairs",
    "At night while in bed",
    "Sitting or lying",
    "Standing upright"
  ],
  stiffness: [
    "After first waking in the morning",
    "After sitting, lying, or resting later in the day"
  ],
  function: [
    "Descending stairs",
    "Ascending stairs",
    "Rising from sitting",
    "Standing",
    "Bending to floor",
    "Walking on flat surface",
    "Getting in/out of car",
    "Going shopping",
    "Putting on socks",
    "Rising from bed",
    "Taking off socks",
    "Lying in bed",
    "Getting in/out of bath",
    "Sitting",
    "Getting on/off toilet",
    "Heavy domestic duties",
    "Light domestic duties"
  ]
};

export default function WOMACRunner({ onSave, onClose }) {
  const [joint, setJoint] = useState("knee");
  const [side, setSide] = useState("right");
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");

  const handleScoreChange = (section, index, score) => {
    const key = `${section}_${index}`;
    setScores({ ...scores, [key]: score });
  };

  const calculateScores = () => {
    const pain = WOMAC_SECTIONS.pain.reduce((sum, _, i) => 
      sum + (parseInt(scores[`pain_${i}`]) || 0), 0);
    const stiffness = WOMAC_SECTIONS.stiffness.reduce((sum, _, i) => 
      sum + (parseInt(scores[`stiffness_${i}`]) || 0), 0);
    const function_score = WOMAC_SECTIONS.function.reduce((sum, _, i) => 
      sum + (parseInt(scores[`function_${i}`]) || 0), 0);
    
    return {
      pain,
      stiffness,
      function: function_score,
      total: pain + stiffness + function_score,
      painPercent: ((pain / 20) * 100).toFixed(0),
      stiffnessPercent: ((stiffness / 8) * 100).toFixed(0),
      functionPercent: ((function_score / 68) * 100).toFixed(0)
    };
  };

  const scores_calc = calculateScores();

  const isComplete = () => {
    return Object.keys(scores).length === 24; // 5 pain + 2 stiffness + 17 function
  };

  const SCORE_LABELS = { 0: "None", 1: "Mild", 2: "Moderate", 3: "Severe", 4: "Extreme" };

  const handleSave = () => {
    if (Object.keys(scores).length === 0) {
      toast.error("Please score at least one item before saving.");
      return;
    }

    const painLines = WOMAC_SECTIONS.pain.map((item, i) => {
      const s = scores[`pain_${i}`];
      return `    ${i + 1}. ${item}: ${s !== undefined ? `${s} â€” ${SCORE_LABELS[s]}` : "â€”"}`;
    });
    const stiffnessLines = WOMAC_SECTIONS.stiffness.map((item, i) => {
      const s = scores[`stiffness_${i}`];
      return `    ${i + 1}. ${item}: ${s !== undefined ? `${s} â€” ${SCORE_LABELS[s]}` : "â€”"}`;
    });
    const functionLines = WOMAC_SECTIONS.function.map((item, i) => {
      const s = scores[`function_${i}`];
      return `    ${i + 1}. ${item}: ${s !== undefined ? `${s} â€” ${SCORE_LABELS[s]}` : "â€”"}`;
    });

    const soapText = [
      `â€¢ WOMAC (${joint} - ${side})`,
      `  Total: ${scores_calc.total}/96`,
      `  Pain: ${scores_calc.pain}/20 (${scores_calc.painPercent}%) | Stiffness: ${scores_calc.stiffness}/8 (${scores_calc.stiffnessPercent}%) | Function: ${scores_calc.function}/68 (${scores_calc.functionPercent}%)`,
      ``,
      `  PAIN SUBSCALE (${scores_calc.pain}/20):`,
      ...painLines,
      ``,
      `  STIFFNESS SUBSCALE (${scores_calc.stiffness}/8):`,
      ...stiffnessLines,
      ``,
      `  PHYSICAL FUNCTION SUBSCALE (${scores_calc.function}/68):`,
      ...functionLines,
    ].join("\n");

    onSave({
      result_value: scores_calc.total,
      additional_data: {
        measurement_type: "womac",
        soap_text: soapText,
        joint: joint,
        side: side,
        pain_score: scores_calc.pain,
        stiffness_score: scores_calc.stiffness,
        function_score: scores_calc.function,
        total_score: scores_calc.total,
        pain_percent: parseFloat(scores_calc.painPercent),
        stiffness_percent: parseFloat(scores_calc.stiffnessPercent),
        function_percent: parseFloat(scores_calc.functionPercent),
        item_scores: scores
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  const renderSection = (sectionName, items) => (
    <Card key={sectionName}>
      <CardHeader>
        <CardTitle className="text-lg capitalize">{sectionName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="border-b pb-3 last:border-b-0">
            <Label className="text-sm mb-2 block">{item}</Label>
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4].map((score) => (
                <Button
                  key={score}
                  type="button"
                  variant={scores[`${sectionName}_${index}`] === score ? "default" : "outline"}
                  onClick={() => handleScoreChange(sectionName, index, score)}
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
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Western Ontario and McMaster Universities Osteoarthritis Index (WOMAC)</h2>
              <p className="text-slate-600 mt-1">Hip and knee osteoarthritis assessment</p>
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
                  Scoring
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p>"For each activity, please rate your experience over the past 48 hours."</p>
                <p className="mt-2"><strong>0 = None</strong> | <strong>1 = Mild</strong> | <strong>2 = Moderate</strong> | <strong>3 = Severe</strong> | <strong>4 = Extreme</strong></p>
                <p className="mt-2">Lower scores indicate less symptom severity and better function.</p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Joint Assessed</Label>
                <Select value={joint} onValueChange={setJoint}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="knee">Knee</SelectItem>
                    <SelectItem value="hip">Hip</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Side</Label>
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
            </div>

            {renderSection("pain", WOMAC_SECTIONS.pain)}
            {renderSection("stiffness", WOMAC_SECTIONS.stiffness)}
            {renderSection("function", WOMAC_SECTIONS.function)}

            {isComplete() && (
              <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2">
                <CardHeader>
                  <CardTitle className="text-xl text-purple-900">Results</CardTitle>
                </CardHeader>
                <CardContent className="text-purple-900 space-y-2">
                  <p className="font-semibold text-2xl">Total: {scores_calc.total} / 96</p>
                  <div className="space-y-1 text-sm">
                    <p>Pain: {scores_calc.pain}/20 ({scores_calc.painPercent}%)</p>
                    <p>Stiffness: {scores_calc.stiffness}/8 ({scores_calc.stiffnessPercent}%)</p>
                    <p>Function: {scores_calc.function}/68 ({scores_calc.functionPercent}%)</p>
                  </div>
                  <p className="text-sm mt-3">
                    <strong>MCID:</strong> Change of 20% indicates clinically meaningful improvement.
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
                  placeholder="Functional limitations, aggravating factors, treatment response..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Save WOMAC
          </Button>
        </div>
      </div>
    </div>
  );
}