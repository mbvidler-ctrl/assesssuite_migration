import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, ChevronDown, ChevronUp, BookOpen, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";
import { PROM_NEURO_CBM_TASKS as TASKS } from '@/lib/clinical/scorers/extrasPromNeuro';


function getInterpretation(score) {
  if (score >= 55) return { label: "Community Ambulatory — High Level", color: "text-green-700", bg: "bg-green-50 border-green-200" };
  if (score >= 40) return { label: "Community Ambulatory — Moderate Level", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" };
  if (score >= 25) return { label: "Limited Community Ambulation", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" };
  return { label: "Supervised/Supported Ambulation Required", color: "text-red-700", bg: "bg-red-50 border-red-200" };
}

export default function CommunityBalanceMobilityScaleCBMRunner({ client, onSave, onClose }) {
  const [showInstructions, setShowInstructions] = useState(true);
  const [preVitals, setPreVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [postVitals, setPostVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");

  const handleScoreChange = (task, value) => {
    const parsed = parseInt(value);
    if (value === "" || (parsed >= 0 && parsed <= 5)) {
      setScores(prev => ({ ...prev, [task]: value === "" ? undefined : parsed }));
    }
  };

  const totalScore = Object.values(scores).reduce((acc, s) => acc + (s ?? 0), 0);
  const answered = Object.values(scores).filter(v => v !== undefined).length;
  const interp = getInterpretation(totalScore);

  const handleSave = () => {
    // Sanitize scores - remove undefined values which break JSON serialization
    const cleanScores = Object.fromEntries(
      Object.entries(scores).filter(([, v]) => v !== undefined && v !== null)
    );
    const scoreLines = TASKS.map(t => `    ${t.name}: ${cleanScores[t.name] ?? "-"}/5`).join("\n");

    const preVitalsText = (preVitals.heartRate || preVitals.bloodPressure)
      ? `\n\n  Pre-Test Vitals:${preVitals.heartRate ? `\n    Heart Rate: ${preVitals.heartRate} bpm` : ""}${preVitals.bloodPressure ? `\n    Blood Pressure: ${preVitals.bloodPressure} mmHg` : ""}`
      : "";

    const postVitalsText = (postVitals.heartRate || postVitals.bloodPressure)
      ? `\n\n  Post-Test Vitals:${postVitals.heartRate ? `\n    Heart Rate: ${postVitals.heartRate} bpm` : ""}${postVitals.bloodPressure ? `\n    Blood Pressure: ${postVitals.bloodPressure} mmHg` : ""}`
      : "";

    const soap_text = `• Community Balance & Mobility Scale (CB&M)\n  Total Score: ${totalScore}/65\n  Classification: ${interp.label}` +
      preVitalsText +
      `\n\n  Item Scores:\n${scoreLines}` +
      postVitalsText +
      (notes ? `\n\n  Clinical Notes: ${notes}` : "");

    onSave({
      result_value: totalScore,
      additional_data: {
        soap_text,
        measurement_type: "cbm",
        preVitals,
        postVitals,
        scores: cleanScores,
        totalScore,
        interpretation: interp.label,
      },
      notes,
      assessment_date: todayLocal(),
    });
  };

  return (
    <div className="bg-white rounded-xl w-full flex flex-col overflow-hidden" style={{ maxHeight: "85vh" }}>
      {/* Header */}
      <div className="p-5 border-b bg-gradient-to-r from-blue-50 to-slate-50 flex justify-between items-start shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Community Balance & Mobility Scale (CB&M)</h2>
          <p className="text-sm text-slate-500 mt-0.5">13 tasks · 0–65 total · Community-level balance assessment</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

        {/* Instructions */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowInstructions(!showInstructions)}>
            <CardTitle className="text-base flex items-center justify-between text-blue-800">
              <span className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Administration Instructions</span>
              {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CardTitle>
          </CardHeader>
          {showInstructions && (
            <CardContent className="text-sm text-blue-900 space-y-3">
              <div>
                <p className="font-semibold mb-1">Purpose</p>
                <p className="text-blue-800">The CB&M was designed to assess balance and mobility skills in higher-functioning community-dwelling adults who may be at risk for falls but exceed the ceiling of tools like the Berg Balance Scale.</p>
              </div>
              <div>
                <p className="font-semibold mb-1">Equipment Required</p>
                <ul className="list-disc list-inside text-blue-800 space-y-0.5">
                  <li>Foam balance pad (medium density)</li>
                  <li>3 metre straight walkway marked on floor</li>
                  <li>3 traffic cones</li>
                  <li>Stable 20cm step/stair</li>
                  <li>Tray with 2–3 cups (partially filled)</li>
                  <li>Stopwatch</li>
                  <li>Full flight of stairs (or equivalent)</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-1">General Scoring</p>
                <p className="text-blue-800">Each of 13 tasks is rated 0–5. Total maximum = 65. Each task has specific behavioural criteria — observe the client and select the highest score that matches their performance.</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded p-3">
                <p className="font-semibold text-amber-800 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Stop Criteria</p>
                <ul className="list-disc list-inside text-amber-800 space-y-0.5">
                  <li>Chest pain, dizziness, or loss of balance causing fall risk</li>
                  <li>Client refuses or expresses significant pain</li>
                  <li>Clinician judgement — safety first</li>
                </ul>
              </div>
              <div className="bg-white border border-blue-200 rounded p-3 text-xs">
                <p className="font-semibold text-blue-800 mb-1">Score Interpretation</p>
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-blue-100">
                    <tr><th className="p-1.5 text-left">Score</th><th className="p-1.5 text-left">Classification</th></tr>
                  </thead>
                  <tbody>
                    <tr className="border-t"><td className="p-1.5">55–65</td><td className="p-1.5">Community ambulatory — high level</td></tr>
                    <tr className="border-t bg-blue-50"><td className="p-1.5">40–54</td><td className="p-1.5">Community ambulatory — moderate level</td></tr>
                    <tr className="border-t"><td className="p-1.5">25–39</td><td className="p-1.5">Limited community ambulation</td></tr>
                    <tr className="border-t bg-blue-50"><td className="p-1.5">&lt;25</td><td className="p-1.5">Supervised / supported ambulation</td></tr>
                  </tbody>
                </table>
                <p className="text-blue-600 mt-1.5">MCID: ~5 points. MDC: ~8 points. Falls risk increases significantly below 45.</p>
              </div>
              <p className="text-xs text-blue-600 italic">Reference: Howe JA et al. (2006). The Community Balance and Mobility Scale – a balance measure for individuals with mild-to-moderate neurological challenges. <em>Clin Rehabil, 20</em>(2), 160–170.</p>
            </CardContent>
          )}
        </Card>

        {/* Pre-Test Vitals */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Pre-Test Vitals (Optional)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Heart Rate (bpm)</Label>
                <Input type="number" placeholder="e.g., 72" value={preVitals.heartRate} onChange={e => setPreVitals(p => ({ ...p, heartRate: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Blood Pressure</Label>
                <Input type="text" placeholder="e.g., 120/80" value={preVitals.bloodPressure} onChange={e => setPreVitals(p => ({ ...p, bloodPressure: e.target.value }))} className="mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Scores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Task Scores (0–5 per task)</span>
              <span className="text-sm font-normal text-slate-500">{answered}/13 rated · Running total: <strong>{totalScore}</strong>/65</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {TASKS.map((task, index) => (
              <div key={index} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">{index + 1}</span>
                      <p className="font-semibold text-slate-900 text-sm">{task.name}</p>
                    </div>
                    <p className="text-xs text-slate-500 ml-7">{task.description}</p>
                    <p className="text-xs text-blue-700 ml-7 mt-1 bg-blue-50 rounded px-2 py-1">{task.scoring}</p>
                  </div>
                  <div className="shrink-0 text-center">
                    <Input
                      type="number" min="0" max="5"
                      value={scores[task.name] ?? ""}
                      onChange={e => handleScoreChange(task.name, e.target.value)}
                      placeholder="0–5"
                      className={`w-16 text-center font-bold text-lg ${scores[task.name] !== undefined ? "border-blue-400 bg-blue-50" : ""}`}
                    />
                    <p className="text-xs text-slate-400 mt-0.5">/ 5</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Post-Test Vitals */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Post-Test Vitals (Optional)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Heart Rate (bpm)</Label>
                <Input type="number" placeholder="e.g., 88" value={postVitals.heartRate} onChange={e => setPostVitals(p => ({ ...p, heartRate: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Blood Pressure</Label>
                <Input type="text" placeholder="e.g., 130/85" value={postVitals.bloodPressure} onChange={e => setPostVitals(p => ({ ...p, bloodPressure: e.target.value }))} className="mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <div>
          <Label>Clinical Notes</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional observations, deviations, or clinical comments..." rows={3} className="mt-1" />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-slate-50 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">{answered}/13 tasks rated</p>
            {answered > 0 && (
              <div className={`mt-1 px-3 py-1 rounded-full border text-sm font-semibold inline-block ${interp.bg} ${interp.color}`}>
                Score: {totalScore}/65 — {interp.label}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" /> Save Assessment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
