import React, { useState } from "react";
import { todayLocal } from "@/lib/localDate";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";
import {
  BESS_CONDITIONS,
  validateAndScoreBess,
} from "@/lib/clinical/scorers/maintainedPhysioAdditions";

export default function BESSRunner({ onSave, onClose }) {
  const [errors, setErrors] = useState(() => Object.fromEntries(
    BESS_CONDITIONS.map(({ key }) => [key, ""]),
  ));
  const [notes, setNotes] = useState("");

  const handleErrorChange = (conditionKey, value) => {
    if (value === "") {
      setErrors((current) => ({ ...current, [conditionKey]: "" }));
      return;
    }
    const numValue = Number(value);
    setErrors((current) => ({
      ...current,
      [conditionKey]: Number.isFinite(numValue) ? Math.min(Math.max(numValue, 0), 10) : value,
    }));
  };

  const allConditionsScored = BESS_CONDITIONS.every(({ key }) => errors[key] !== "");
  const total = allConditionsScored
    ? BESS_CONDITIONS.reduce((sum, { key }) => sum + Number(errors[key]), 0)
    : null;

  const handleSave = () => {
    try {
      const payload = validateAndScoreBess(
        { ...errors, notes },
        { assessmentName: "Balance Error Scoring System (BESS)", assessmentDate: todayLocal() },
      );
      onSave(payload);
      toast.success("BESS saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to score BESS");
    }
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
                {BESS_CONDITIONS.map((condition, index) => (
                  <div key={condition.key} className="p-4 border rounded bg-slate-50">
                    <Label className="text-base font-semibold mb-2 block">
                      {index + 1}. {condition.label}
                    </Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Label className="text-sm">Errors (0-10):</Label>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        step="1"
                        value={errors[condition.key] ?? ""}
                        onChange={(e) => handleErrorChange(condition.key, e.target.value)}
                        className="w-24"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {allConditionsScored && (
              <Card className="bg-emerald-50 border-2 border-emerald-200">
                <CardHeader><CardTitle className="text-xl text-emerald-800">Six conditions complete</CardTitle></CardHeader>
                <CardContent className="text-emerald-800">
                  <p className="font-semibold">Total Errors: {total} / 60</p>
                  <p className="text-sm mt-2">Lower scores indicate better balance control. Interpret against the applicable baseline and population context.</p>
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
          <Button onClick={handleSave} disabled={!allConditionsScored} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            Save BESS
          </Button>
        </div>
      </div>
    </div>
  );
}
