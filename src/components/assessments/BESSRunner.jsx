import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

const BESS_CONDITIONS = [
  { id: 1, name: "Double leg stance on firm surface", surface: "firm" },
  { id: 2, name: "Single leg stance on firm surface (non-dominant foot)", surface: "firm" },
  { id: 3, name: "Tandem stance on firm surface (non-dominant foot back)", surface: "firm" },
  { id: 4, name: "Double leg stance on foam surface", surface: "foam" },
  { id: 5, name: "Single leg stance on foam surface (non-dominant foot)", surface: "foam" },
  { id: 6, name: "Tandem stance on foam surface (non-dominant foot back)", surface: "foam" }
];

export default function BESSRunner({ onSave, onClose }) {
  const [errors, setErrors] = useState({});
  const [notes, setNotes] = useState("");

  const handleErrorChange = (conditionId, value) => {
    const numValue = parseInt(value) || 0;
    setErrors({ ...errors, [conditionId]: Math.min(Math.max(numValue, 0), 10) });
  };

  const calculateTotal = () => {
    return Object.values(errors).reduce((sum, err) => sum + (err || 0), 0);
  };

  const total = calculateTotal();

  const getInterpretation = () => {
    if (total <= 3) return { level: 'Normal balance', color: 'text-green-600', bg: 'bg-green-50' };
    if (total <= 6) return { level: 'Mild balance impairment', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (total <= 12) return { level: 'Moderate balance impairment', color: 'text-orange-600', bg: 'bg-orange-50' };
    return { level: 'Severe balance impairment', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const interpretation = Object.keys(errors).length === 6 ? getInterpretation() : null;

  const handleSave = () => {
    if (Object.keys(errors).length === 0) {
      toast.error("Please score at least one condition before saving.");
      return;
    }

    const conditionLines = BESS_CONDITIONS.map(c => {
      const errs = errors[c.id] ?? 0;
      return `  ${c.name}: ${errs} error${errs !== 1 ? 's' : ''}`;
    }).join('\n');

    const soapText = `• Balance Error Scoring System (BESS)\n  Total Errors: ${total}/60\n  Interpretation: ${interpretation?.level ?? 'N/A'}\n\n  Condition Breakdown:\n${conditionLines}${notes ? `\n\n  Clinical Notes: ${notes}` : ''}`;

    onSave({
      result_value: total,
      additional_data: {
        soap_text: soapText,
        total_errors: total,
        condition_errors: errors,
        interpretation: interpretation?.level
      },
      notes: notes,
      assessment_date: new Date().toISOString()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Balance Error Scoring System (BESS)</h2>
              <p className="text-slate-600 mt-1">Objective balance assessment commonly used in concussion evaluation</p>
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
                  Clinician Script &amp; Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>Position:</strong> Hands on hips, eyes closed. Each stance held for 20 seconds.</p>
                <p><strong>Instructions:</strong> "Stand as still as possible in this position with your hands on your hips and eyes closed. I'll tell you when to start and stop."</p>
                <p className="mt-3"><strong>Error Scoring (1 point each):</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Hands lifted off iliac crest</li>
                  <li>Opening eyes</li>
                  <li>Step, stumble, or fall</li>
                  <li>Moving hip into &gt;30° abduction</li>
                  <li>Lifting forefoot or heel</li>
                  <li>Remaining out of position &gt;5 seconds</li>
                </ul>
                <p className="mt-2"><strong>Maximum 10 errors per condition.</strong> If unable to maintain position for 5+ seconds, score 10.</p>
              </CardContent>
            </Card>

            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>Riemann BL, Guskiewicz KM, & Shields EW. (1999). Relationship between clinical and forceplate measures of postural stability. <em>Journal of Sport Rehabilitation, 8</em>(2), 71–82.</p>
              <p>Guskiewicz KM et al. (2001). Postural stability and neuropsychological deficits after concussion. <em>Journal of Athletic Training, 36</em>(3), 263–273.</p>
            </div>

            {/* Norms */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Norms & Interpretation (Total Errors / 60)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Errors</th><th className="p-2 text-left">Interpretation</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">0–3</td><td className="p-2 text-green-700">Normal balance</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">4–6</td><td className="p-2 text-yellow-700">Mild impairment</td></tr>
                    <tr className="border-t"><td className="p-2">7–12</td><td className="p-2 text-orange-700">Moderate impairment</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">≥13</td><td className="p-2 text-red-700">Severe impairment / significant concussion indicator</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">MCID: ~7 errors post-concussion vs. baseline. A score ≥3 errors above individual baseline is clinically meaningful. Source: Guskiewicz et al. (2001).</p>
            </div>

            <Card className="bg-amber-50 border-amber-200">
              <CardHeader>
                <CardTitle className="text-sm text-amber-800">⚠ Contraindications</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-amber-800">
                <p><strong>Relative:</strong> Acute ankle/knee injury, severe dizziness, acute vestibular dysfunction. Provide spotting for all conditions. Stop if client at risk of falling.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">BESS Conditions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {BESS_CONDITIONS.map((condition) => (
                  <div key={condition.id} className="p-4 border rounded bg-slate-50">
                    <Label className="text-base font-semibold mb-2 block">
                      {condition.id}. {condition.name}
                    </Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Label className="text-sm">Errors (0-10):</Label>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        value={errors[condition.id] || ""}
                        onChange={(e) => handleErrorChange(condition.id, e.target.value)}
                        className="w-24"
                        placeholder="0"
                      />
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
                  <p className="font-semibold">Total Errors: {total} / 60</p>
                  <p className="text-sm mt-2">Lower scores indicate better balance control.</p>
                  {total > 12 && (
                    <p className="text-sm mt-3 p-3 bg-white/50 rounded">
                      <strong>Note:</strong> High error count may indicate concussion, vestibular dysfunction, or significant balance impairment. Consider further assessment.
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
                  placeholder="Error patterns observed, specific difficulties, safety concerns, comparison to baseline..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            Save BESS
          </Button>
        </div>
      </div>
    </div>
  );
}