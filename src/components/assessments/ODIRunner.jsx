import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";
import { PROM_NEURO_ODI_ODI_SECTIONS as ODI_SECTIONS } from '@/lib/clinical/scorers/extrasPromNeuro';


export default function ODIRunner({ onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");

  const handleScoreChange = (sectionIndex, score) => {
    setScores({ ...scores, [sectionIndex]: score });
  };

  const calculateTotal = () => {
    const total = Object.values(scores).reduce((sum, score) => sum + (score || 0), 0);
    const percentage = ((total / 50) * 100).toFixed(0);
    return { total, percentage };
  };

  const { total, percentage } = calculateTotal();

  const getInterpretation = () => {
    const pct = parseInt(percentage);
    if (pct <= 20) return { level: 'Minimal Disability', color: 'text-green-600', bg: 'bg-green-50' };
    if (pct <= 40) return { level: 'Moderate Disability', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (pct <= 60) return { level: 'Severe Disability', color: 'text-orange-600', bg: 'bg-orange-50' };
    if (pct <= 80) return { level: 'Crippling Back Pain', color: 'text-red-600', bg: 'bg-red-50' };
    return { level: 'Bed-bound or Exaggerating', color: 'text-red-800', bg: 'bg-red-100' };
  };

  const interpretation = Object.keys(scores).length === 10 ? getInterpretation() : null;

  const handleSave = () => {
    if (Object.keys(scores).length < 10) {
      toast.error("Please complete all 10 sections");
      return;
    }

    const soapLines = [
      `• Oswestry Disability Index (ODI)`,
      `  Total Score: ${total}/50 (${percentage}% disability)`,
      `  Interpretation: ${interpretation?.level}`,
      ``,
      `  Section Responses:`,
      ...ODI_SECTIONS.map((section, i) => {
        const score = scores[i];
        return `    Section ${i + 1} - ${section.name} (score: ${score}): ${section.options[score]}`;
      }),
    ].join('\n');

    onSave({
      result_value: parseInt(percentage),
      additional_data: {
        total_score: total,
        percentage: parseInt(percentage),
        section_scores: scores,
        interpretation: interpretation?.level,
        soap_text: soapLines,
      },
      notes: notes,
      assessment_date: todayLocal()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Oswestry Disability Index (ODI)</h2>
              <p className="text-slate-600 mt-1">Low back pain disability questionnaire</p>
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
                  Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800">
                <p>"Please choose the ONE statement in each section that best describes your condition TODAY. Select only one statement from each section."</p>
              </CardContent>
            </Card>

            {ODI_SECTIONS.map((section, sectionIndex) => (
              <Card key={sectionIndex}>
                <CardHeader>
                  <CardTitle className="text-lg">Section {sectionIndex + 1}: {section.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {section.options.map((option, optionIndex) => (
                    <Button
                      key={optionIndex}
                      type="button"
                      variant={scores[sectionIndex] === optionIndex ? "default" : "outline"}
                      onClick={() => handleScoreChange(sectionIndex, optionIndex)}
                      className="w-full justify-start text-left h-auto py-3 px-4"
                    >
                      <span className="font-semibold mr-2">{optionIndex}.</span>
                      {option}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            ))}

            {interpretation && (
              <Card className={`${interpretation.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-xl ${interpretation.color}`}>
                    {interpretation.level}
                  </CardTitle>
                </CardHeader>
                <CardContent className={interpretation.color}>
                  <p className="font-semibold text-2xl">{percentage}% Disability</p>
                  <p className="text-sm mt-2">Total Score: {total} / 50</p>
                  <p className="text-sm mt-3">
                    <strong>MCID:</strong> 10-point (or 20%) change indicates clinically meaningful improvement.
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
                  placeholder="Specific limitations, functional goals, treatment response..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={Object.keys(scores).length < 10} className="bg-red-600 hover:bg-red-700">
            <Save className="w-4 h-4 mr-2" />
            Save ODI
          </Button>
        </div>
      </div>
    </div>
  );
}
