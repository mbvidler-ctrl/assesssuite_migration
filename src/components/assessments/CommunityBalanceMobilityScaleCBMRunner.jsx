import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, ChevronDown, ChevronUp, BookOpen, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const TASKS = [
  {
    name: "Unilateral Stance",
    description: "Stand on one leg on a foam surface. Eyes open. Score based on duration and quality.",
    scoring: "0=Unable, 1=<5s, 2=5â€“10s, 3=10â€“20s, 4=20â€“30s with difficulty, 5=30s stable",
  },
  {
    name: "Tandem Walking",
    description: "Walk heel-to-toe along a 3m line. 10 steps total.",
    scoring: "0=Unable, 1=â‰¥4 steps off, 2=2â€“3 steps off, 3=1 step off, 4=Completed with arm raise, 5=Perfect",
  },
  {
    name: "180Â° Tandem Pivot",
    description: "Turn 180Â° using small steps while maintaining tandem stance.",
    scoring: "0=Unable, 1=Major difficulty, 2=Loses tandem 2+, 3=Loses tandem once, 4=Completed slowly, 5=Smooth and controlled",
  },
  {
    name: "Lateral Foot Scooting",
    description: "Sidestep 3m to the right, then 3m to left as fast as possible without crossing feet.",
    scoring: "0=Unable, 2=Crosses feet or uses support, 3=Slow/hesitant, 4=Adequate speed with minor error, 5=Fast and controlled",
  },
  {
    name: "Hopping Forward",
    description: "Hop forward on one foot for 2m. Repeated on other foot.",
    scoring: "0=Unable, 1=1â€“2 hops only, 2=<1m, 3=1â€“2m with difficulty, 4=2m with arm use, 5=2m controlled",
  },
  {
    name: "Crouch and Walk",
    description: "Walk 3m in a crouched position (knees bent ~45Â°), return to start.",
    scoring: "0=Unable, 1=Falls or uses support, 2=Cannot maintain crouch, 3=Crouch inconsistent, 4=Completed slowly, 5=Fluid and controlled",
  },
  {
    name: "Lateral Dodging",
    description: "Walk forward, dodge around 3 cones placed 1m apart.",
    scoring: "0=Unable, 1=Hits â‰¥2 cones, 2=Hits 1 cone, 3=Avoids but slow, 4=Adequate with minor imbalance, 5=Smooth and fast",
  },
  {
    name: "Walking and Looking",
    description: "Walk 6m while turning head left/right every 2 steps.",
    scoring: "0=Unable, 2=Stops or grabs support, 3=Veers or slows significantly, 4=Minor deviation, 5=Smooth gaze with stable gait",
  },
  {
    name: "Running with Controlled Stop",
    description: "Run 6m and stop within 1m of a marked line on command.",
    scoring: "0=Unable/refuses, 1=Cannot run, 2=Overshoots >1m, 3=Overshoots slightly, 4=Stops within 1m awkwardly, 5=Controlled stop",
  },
  {
    name: "Forward to Backward Walking",
    description: "Walk forward 3m, then backward 3m on command.",
    scoring: "0=Unable, 1=Cannot walk backward, 2=Loses balance, 3=Very slow, 4=Adequate with hesitation, 5=Smooth transition",
  },
  {
    name: "Walk, Look, and Carry",
    description: "Walk 6m while carrying a tray with cups and looking at the cups.",
    scoring: "0=Unable, 1=Drops tray/cups, 2=Spills or veers significantly, 3=Spills minor amount, 4=Slow and careful, 5=Controlled and efficient",
  },
  {
    name: "Descending Stairs",
    description: "Descend a full flight of stairs without rail if possible. Score for safety and efficiency.",
    scoring: "0=Unable, 1=Requires physical assist, 2=Requires rail both directions, 3=Requires rail one direction, 4=Slow without rail, 5=Normal speed without rail",
  },
  {
    name: "Step-Ups",
    description: "Step up and down from a 20cm step as fast as possible 5 times each leg.",
    scoring: "0=Unable, 1=Requires support, 2=Very slow or unstable, 3=Slow but independent, 4=Adequate speed with minor difficulty, 5=Fast and controlled",
  },
];

function getInterpretation(score) {
  if (score >= 55) return { label: "Community Ambulatory â€” High Level", color: "text-green-700", bg: "bg-green-50 border-green-200" };
  if (score >= 40) return { label: "Community Ambulatory â€” Moderate Level", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" };
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

    const soap_text = `â€¢ Community Balance & Mobility Scale (CB&M)\n  Total Score: ${totalScore}/65\n  Classification: ${interp.label}` +
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
      assessment_date: new Date().toISOString().split("T")[0],
    });
  };

  return (
    <div className="bg-white rounded-xl w-full flex flex-col overflow-hidden" style={{ maxHeight: "85vh" }}>
      {/* Header */}
      <div className="p-5 border-b bg-gradient-to-r from-blue-50 to-slate-50 flex justify-between items-start shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Community Balance & Mobility Scale (CB&M)</h2>
          <p className="text-sm text-slate-500 mt-0.5">13 tasks Â· 0â€“65 total Â· Community-level balance assessment</p>
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
                  <li>Tray with 2â€“3 cups (partially filled)</li>
                  <li>Stopwatch</li>
                  <li>Full flight of stairs (or equivalent)</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-1">General Scoring</p>
                <p className="text-blue-800">Each of 13 tasks is rated 0â€“5. Total maximum = 65. Each task has specific behavioural criteria â€” observe the client and select the highest score that matches their performance.</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded p-3">
                <p className="font-semibold text-amber-800 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Stop Criteria</p>
                <ul className="list-disc list-inside text-amber-800 space-y-0.5">
                  <li>Chest pain, dizziness, or loss of balance causing fall risk</li>
                  <li>Client refuses or expresses significant pain</li>
                  <li>Clinician judgement â€” safety first</li>
                </ul>
              </div>
              <div className="bg-white border border-blue-200 rounded p-3 text-xs">
                <p className="font-semibold text-blue-800 mb-1">Score Interpretation</p>
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-blue-100">
                    <tr><th className="p-1.5 text-left">Score</th><th className="p-1.5 text-left">Classification</th></tr>
                  </thead>
                  <tbody>
                    <tr className="border-t"><td className="p-1.5">55â€“65</td><td className="p-1.5">Community ambulatory â€” high level</td></tr>
                    <tr className="border-t bg-blue-50"><td className="p-1.5">40â€“54</td><td className="p-1.5">Community ambulatory â€” moderate level</td></tr>
                    <tr className="border-t"><td className="p-1.5">25â€“39</td><td className="p-1.5">Limited community ambulation</td></tr>
                    <tr className="border-t bg-blue-50"><td className="p-1.5">&lt;25</td><td className="p-1.5">Supervised / supported ambulation</td></tr>
                  </tbody>
                </table>
                <p className="text-blue-600 mt-1.5">MCID: ~5 points. MDC: ~8 points. Falls risk increases significantly below 45.</p>
              </div>
              <p className="text-xs text-blue-600 italic">Reference: Howe JA et al. (2006). The Community Balance and Mobility Scale â€“ a balance measure for individuals with mild-to-moderate neurological challenges. <em>Clin Rehabil, 20</em>(2), 160â€“170.</p>
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
              <span>Task Scores (0â€“5 per task)</span>
              <span className="text-sm font-normal text-slate-500">{answered}/13 rated Â· Running total: <strong>{totalScore}</strong>/65</span>
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
                      placeholder="0â€“5"
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
                Score: {totalScore}/65 â€” {interp.label}
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