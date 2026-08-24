import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Info, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";
import { PROM_NEURO_MAS_STROKE_ITEMS as ITEMS } from '@/lib/clinical/scorers/extrasPromNeuro';


export default function MotorAssessmentScaleMASStrokeRunner({ client, onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");
  const [showInstructions, setShowInstructions] = useState(true);

  const handleSave = () => {
    if (completedItems === 0) {
      toast.error("Please score at least one item before saving.");
      return;
    }
    const totalScore = ITEMS.reduce((acc, item) => acc + parseFloat(scores[item.key] || 0), 0);

    const soapLines = ITEMS.map(item => {
      const grade = ITEMS.find(i => i.key === item.key);
      const gradeInfo = grade?.grades.find(g => g.score === parseInt(scores[item.key]));
      return `  ${item.label}: ${scores[item.key]}/6${gradeInfo ? ` — ${gradeInfo.desc.split('.')[0]}` : ''}`;
    }).join('\n');

    const soapText = `• Motor Assessment Scale (MAS-Stroke): Total ${totalScore}/48\n${soapLines}${notes ? `\n\n  Clinical Notes: ${notes}` : ''}`;

    onSave({
      result_value: totalScore,
      additional_data: {
        ...scores,
        total_score: totalScore,
        measurement_type: 'mas_stroke',
        soap_text: soapText,
      },
      notes,
      assessment_date: todayLocal(),
    });
  };

  const totalScore = ITEMS.reduce((acc, item) => acc + parseFloat(scores[item.key] || 0), 0);
  const completedItems = ITEMS.filter(item => scores[item.key] !== undefined && scores[item.key] !== "").length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Motor Assessment Scale (MAS-Stroke)</h2>
            <p className="text-slate-600 text-sm mt-1">Rate each item 0–6 based on the patient's best performance</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Carr JH, Shepherd RB, Nordholm L, & Lynne D. (1985). Investigation of a new motor assessment scale for stroke patients. <em>Physical Therapy, 65</em>(2), 175–180.</p>
            <p>Poole JL & Whitney SL. (1988). Motor Assessment Scale for stroke patients: concurrent validity and interrater reliability. <em>Archives of Physical Medicine and Rehabilitation, 69</em>(3), 195–197.</p>
          </div>

          {/* Instructions toggle */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowInstructions(v => !v)}>
              <CardTitle className="text-base flex items-center justify-between text-blue-900">
                <span className="flex items-center gap-2"><Info className="w-4 h-4" />Clinician Instructions</span>
                {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </CardTitle>
            </CardHeader>
            {showInstructions && (
              <CardContent className="text-sm text-blue-800 space-y-2 pt-0">
                <p><strong>Purpose:</strong> The MAS assesses motor function and mobility in patients following stroke. It measures functional tasks in 8 areas.</p>
                <p><strong>Scoring:</strong> Each item is scored from <strong>0 (cannot perform)</strong> to <strong>6 (performs optimally)</strong>. Total score = 0–48. Higher scores indicate better motor function.</p>
                <p><strong>Instructions:</strong> Test the patient in each area using the criteria for each grade level. Assign the highest grade the patient can <em>consistently</em> achieve. Use the dropdown descriptions to guide grading.</p>
                <p><strong>Interpretation:</strong></p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>0–12: Severe impairment</li>
                  <li>13–24: Moderately severe impairment</li>
                  <li>25–36: Moderate impairment</li>
                  <li>37–47: Mild impairment</li>
                  <li>48: No impairment (optimal)</li>
                </ul>
              </CardContent>
            )}
          </Card>

          {/* Score items */}
          {ITEMS.map((item) => (
            <Card key={item.key} className={scores[item.key] !== undefined && scores[item.key] !== "" ? "border-green-200 bg-green-50" : ""}>
              <CardContent className="pt-4 space-y-2">
                <Label className="font-semibold text-slate-900">{item.label}</Label>
                <Select
                  value={scores[item.key] !== undefined ? String(scores[item.key]) : ""}
                  onValueChange={(val) => setScores(prev => ({ ...prev, [item.key]: val }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select grade (0–6)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {item.grades.map(g => (
                      <SelectItem key={g.score} value={String(g.score)}>
                        <span className="font-bold mr-2">{g.score}:</span> {g.desc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {scores[item.key] !== undefined && scores[item.key] !== "" && (
                  <p className="text-xs text-slate-600 italic">
                    {item.grades.find(g => g.score === parseInt(scores[item.key]))?.desc}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Notes */}
          <Card>
            <CardContent className="pt-4">
              <Label>Clinical Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observations, compensatory strategies, contraindications..."
                rows={3}
                className="mt-1"
              />
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <div className="text-sm text-slate-600">
            {completedItems}/8 items scored
            {completedItems > 0 && <span className="ml-3 font-semibold text-slate-900">Running total: {totalScore}/48</span>}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-2" />
              Save Assessment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
