import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";
import { PROM_NEURO_DGI_TASKS as TASKS } from '@/lib/clinical/scorers/extrasPromNeuro';


export default function DynamicGaitIndexDGIRunner({ client, onSave, onClose }) {
  const [scores, setScores] = useState(Array(8).fill(null));
  const [notes, setNotes] = useState("");
  const [preVitals, setPreVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [postVitals, setPostVitals] = useState({ heartRate: "", bloodPressure: "" });

  const handleScoreChange = (index, value) => {
    const newScores = [...scores];
    newScores[index] = value;
    setScores(newScores);
  };

  const totalScore = scores.reduce((acc, s) => acc + (s ?? 0), 0);
  const scoredCount = scores.filter(s => s !== null).length;

  const handleSave = () => {
    if (scoredCount < 8) {
      toast.error("Please score all 8 DGI tasks before saving.");
      return;
    }

    const interpretation = totalScore < 19 ? "Increased fall risk (score < 19)" : "Low fall risk (score ≥ 19)";
    const taskLines = TASKS.map((t, i) => `    ${t.name}: ${scores[i] ?? "—"}/3`).join("\n");

    const soapText = `• Dynamic Gait Index (DGI)\n  Total Score: ${totalScore}/24\n  Interpretation: ${interpretation}\n\n  Task Scores:\n${taskLines}${
      preVitals.heartRate || preVitals.bloodPressure
        ? `\n  Pre-Test Vitals: HR ${preVitals.heartRate || "—"} bpm, BP ${preVitals.bloodPressure || "—"} mmHg\n`
        : ""
    }${
      postVitals.heartRate || postVitals.bloodPressure
        ? `  Post-Test Vitals: HR ${postVitals.heartRate || "—"} bpm, BP ${postVitals.bloodPressure || "—"} mmHg\n`
        : ""
    }${notes ? `  Clinical Notes: ${notes}\n` : ""}`;

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        soap_text: soapText,
        measurement_type: "dgi",
        tasks: TASKS.map((t, i) => ({ name: t.name, score: scores[i] })),
        totalScore,
        interpretation,
        pre_vitals: preVitals,
        post_vitals: postVitals,
      },
      notes,
      assessment_date: todayLocal(),
    });

    toast.success("DGI assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-slate-50 border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Dynamic Gait Index (DGI)</h2>
            <p className="text-sm text-slate-600 mt-1">Client: {client?.full_name || "Unknown"}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="p-6 space-y-6">

          {/* Setup Banner */}
          <div className="bg-blue-600 text-white rounded-lg p-4 text-sm space-y-1">
            <p className="font-semibold">Setup Checklist:</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-100 text-xs">
              <li>20-foot clear flat walkway marked with cones</li>
              <li>Shoebox-height obstacle (~6 inches) for Task 6</li>
              <li>2 cones 60 cm apart for Task 7</li>
              <li>Staircase (min 3 steps) with handrail for Task 8</li>
              <li>Gait belt and spotter ready if fall risk suspected</li>
            </ul>
          </div>

          {/* Vitals */}
          <Card>
            <CardHeader><CardTitle className="text-base">Pre-Test & Post-Test Vitals</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Pre-Test Vitals</Label>
                  <div className="space-y-2">
                    <Input type="number" placeholder="Heart Rate (bpm)" value={preVitals.heartRate} onChange={(e) => setPreVitals(p => ({ ...p, heartRate: e.target.value }))} className="text-sm" />
                    <Input type="text" placeholder="BP (e.g., 140/90)" value={preVitals.bloodPressure} onChange={(e) => setPreVitals(p => ({ ...p, bloodPressure: e.target.value }))} className="text-sm" />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Post-Test Vitals</Label>
                  <div className="space-y-2">
                    <Input type="number" placeholder="Heart Rate (bpm)" value={postVitals.heartRate} onChange={(e) => setPostVitals(p => ({ ...p, heartRate: e.target.value }))} className="text-sm" />
                    <Input type="text" placeholder="BP (e.g., 140/90)" value={postVitals.bloodPressure} onChange={(e) => setPostVitals(p => ({ ...p, bloodPressure: e.target.value }))} className="text-sm" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Scoring - all visible immediately */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">DGI Task Scores</h3>
              <span className="text-sm text-slate-500">{scoredCount}/8 scored • Running total: <strong>{totalScore}/24</strong></span>
            </div>
            {TASKS.map((task, idx) => (
              <Card key={idx} className={`border-2 ${scores[idx] !== null ? "border-blue-200" : "border-slate-200"}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-slate-900">{idx + 1}. {task.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                    <p className="font-semibold mb-1 flex items-center gap-1"><Info className="w-3 h-3" /> Clinician Instructions:</p>
                    <p>{task.instructions}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[0, 1, 2, 3].map((value) => (
                      <button
                        key={value}
                        onClick={() => handleScoreChange(idx, value)}
                        className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all ${
                          scores[idx] === value
                            ? "border-blue-500 bg-blue-600 text-white shadow-md"
                            : "border-slate-200 bg-white hover:border-blue-300 text-slate-700"
                        }`}
                      >
                        <span className="text-lg font-bold">{value}</span>
                        <span className="text-xs mt-1 leading-tight text-center">{task.scores[value]}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Score Summary */}
          {scoredCount > 0 && (
            <Card className={`border-2 ${totalScore < 19 ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"}`}>
              <CardContent className="pt-4">
                <p className={`text-center font-bold text-lg ${totalScore < 19 ? "text-red-800" : "text-green-800"}`}>
                  Total: {totalScore}/24 — {totalScore < 19 ? "⚠ Increased fall risk (< 19)" : "✓ Low fall risk (≥ 19)"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader><CardTitle className="text-base">Clinical Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observations: balance loss, hesitation, fear of falling, fatigue, assistive device used, compensatory strategies..." rows={3} />
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t bg-slate-50 px-6 py-4 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Close</Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700" disabled={scoredCount < 8}>
            <Save className="w-4 h-4 mr-2" />Save Assessment ({scoredCount}/8)
          </Button>
        </div>
      </div>
    </div>
  );
}
