import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Plus, Trash2, Info } from "lucide-react";
import { toast } from "sonner";

// Rikli & Jones (2001) Senior Fitness Test norms — Back Scratch (cm)
const NORMS = {
  male: [
    { ageMin: 60, ageMax: 64, excellent: 1.3, good: -3.8, avg: -8.9, fair: -14, poor: -999 },
    { ageMin: 65, ageMax: 69, excellent: 0, good: -5.1, avg: -10.2, fair: -15.2, poor: -999 },
    { ageMin: 70, ageMax: 74, excellent: -1.3, good: -6.3, avg: -11.4, fair: -16.5, poor: -999 },
    { ageMin: 75, ageMax: 79, excellent: -2.5, good: -7.6, avg: -12.7, fair: -17.8, poor: -999 },
    { ageMin: 80, ageMax: 120, excellent: -3.8, good: -8.9, avg: -14, fair: -19, poor: -999 },
  ],
  female: [
    { ageMin: 60, ageMax: 64, excellent: 7.6, good: 2.5, avg: -2.5, fair: -7.6, poor: -999 },
    { ageMin: 65, ageMax: 69, excellent: 7.6, good: 2.5, avg: -2.5, fair: -7.6, poor: -999 },
    { ageMin: 70, ageMax: 74, excellent: 6.3, good: 1.3, avg: -3.8, fair: -8.9, poor: -999 },
    { ageMin: 75, ageMax: 79, excellent: 5.1, good: 0, avg: -5.1, fair: -10.2, poor: -999 },
    { ageMin: 80, ageMax: 120, excellent: 3.8, good: -1.3, avg: -6.3, fair: -11.4, poor: -999 },
  ],
};

function classify(score, age, gender) {
  const rows = NORMS[gender === "male" ? "male" : "female"];
  if (!rows || !age) return null;
  const row = rows.find(r => age >= r.ageMin && age <= r.ageMax);
  if (!row) return null;
  if (score >= row.excellent) return { label: "Excellent", color: "bg-green-100 text-green-800 border-green-300" };
  if (score >= row.good) return { label: "Good", color: "bg-teal-100 text-teal-800 border-teal-300" };
  if (score >= row.avg) return { label: "Average", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  if (score >= row.fair) return { label: "Below Average", color: "bg-orange-100 text-orange-800 border-orange-300" };
  return { label: "Low", color: "bg-red-100 text-red-800 border-red-300" };
}

export default function BackScratchTestRunner({ client, onSave, onClose }) {
  const [leftTrials, setLeftTrials] = useState([]);
  const [rightTrials, setRightTrials] = useState([]);
  const [leftInput, setLeftInput] = useState("");
  const [rightInput, setRightInput] = useState("");
  const [notes, setNotes] = useState("");

  const age = client?.date_of_birth ? Math.floor((Date.now() - new Date(client.date_of_birth)) / (365.25 * 24 * 3600 * 1000)) : null;
  const gender = client?.gender;

  const bestLeft = leftTrials.length > 0 ? Math.max(...leftTrials) : null;
  const bestRight = rightTrials.length > 0 ? Math.max(...rightTrials) : null;
  const best = bestLeft !== null && bestRight !== null ? Math.max(bestLeft, bestRight) : (bestLeft ?? bestRight);

  const addLeft = () => {
    const v = parseFloat(leftInput);
    if (isNaN(v)) { toast.error("Enter a valid number"); return; }
    setLeftTrials([...leftTrials, v]);
    setLeftInput("");
  };

  const addRight = () => {
    const v = parseFloat(rightInput);
    if (isNaN(v)) { toast.error("Enter a valid number"); return; }
    setRightTrials([...rightTrials, v]);
    setRightInput("");
  };

  const catLeft = bestLeft !== null && age && gender ? classify(bestLeft, age, gender) : null;
  const catRight = bestRight !== null && age && gender ? classify(bestRight, age, gender) : null;

  const handleSave = () => {
    if (leftTrials.length === 0 && rightTrials.length === 0) { toast.error("Record at least one trial"); return; }
    const soap = `• Back Scratch Test (Senior Fitness Test)\n  Best Left: ${bestLeft !== null ? bestLeft + " cm" : "N/A"}${catLeft ? ` — ${catLeft.label}` : ""}\n  Best Right: ${bestRight !== null ? bestRight + " cm" : "N/A"}${catRight ? ` — ${catRight.label}` : ""}\n  Positive = overlap; Negative = gap${notes ? `\n  Notes: ${notes}` : ""}\n  Assesses upper body (shoulder) flexibility\n  Reference: Rikli RE & Jones CJ (2001). Senior Fitness Test Manual. Human Kinetics.`;
    onSave({ status: "completed", result_value: best, notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "back_scratch", best_left_cm: bestLeft, best_right_cm: bestRight, left_trials: leftTrials, right_trials: rightTrials, left_classification: catLeft?.label, right_classification: catRight?.label } });
    toast.success("Saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-pink-50 to-rose-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Back Scratch Test</h2><p className="text-slate-500 text-sm mt-0.5">Upper body shoulder flexibility</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Rikli RE & Jones CJ. (2001). <em>Senior Fitness Test Manual</em>. Human Kinetics.</p>
            <p>Jones CJ & Rikli RE. (2002). Measuring functional fitness of older adults. <em>The Journal on Active Aging, 1</em>, 24–30.</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />📋 Protocol & Administration</p>
            <p><strong>Position:</strong> Standing. Dominant hand reaches over same shoulder (palm on back); non-dominant hand behind lower back, palm facing outward.</p>
            <p className="italic">"Reach one hand over your shoulder and one behind your back, and try to get your fingertips as close together as possible along your spine."</p>
            <p><strong>Measure:</strong> Distance between middle fingertips. Positive = overlap; Negative = gap. Remove watches/bracelets. 2 trials each side — record best.</p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 Norms — Senior Fitness Test (cm)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Age</th><th className="p-2 text-center">Men (avg range)</th><th className="p-2 text-center">Women (avg range)</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">60–64</td><td className="p-2 text-center">−8.9 to +1.3</td><td className="p-2 text-center">−2.5 to +7.6</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">65–69</td><td className="p-2 text-center">−10.2 to 0</td><td className="p-2 text-center">−2.5 to +7.6</td></tr>
                  <tr className="border-t"><td className="p-2">70–74</td><td className="p-2 text-center">−11.4 to −1.3</td><td className="p-2 text-center">−3.8 to +6.3</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">75+</td><td className="p-2 text-center">−12.7 to −2.5</td><td className="p-2 text-center">−5.1 to +5.1</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">Positive = overlap; Negative = gap. Source: Rikli & Jones (2001).</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Left Hand Over Shoulder</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input type="number" step="0.5" placeholder="e.g. -3.0" value={leftInput} onChange={e => setLeftInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addLeft()} />
                  <Button onClick={addLeft} size="sm" disabled={!leftInput}><Plus className="w-3 h-3" /></Button>
                </div>
                {leftTrials.map((v, i) => (
                  <div key={i} className="flex justify-between items-center bg-pink-50 px-2 py-1.5 rounded text-sm">
                    <span className={`font-bold ${v >= 0 ? "text-green-700" : "text-red-700"}`}>{v >= 0 ? "+" : ""}{v} cm</span>
                    <Button variant="ghost" size="icon" onClick={() => setLeftTrials(leftTrials.filter((_, x) => x !== i))} className="h-6 w-6"><Trash2 className="w-3 h-3 text-red-500" /></Button>
                  </div>
                ))}
                {bestLeft !== null && <div className="text-center font-bold text-pink-700 text-sm">Best: {bestLeft >= 0 ? "+" : ""}{bestLeft} cm</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Right Hand Over Shoulder</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input type="number" step="0.5" placeholder="e.g. 2.5" value={rightInput} onChange={e => setRightInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addRight()} />
                  <Button onClick={addRight} size="sm" disabled={!rightInput}><Plus className="w-3 h-3" /></Button>
                </div>
                {rightTrials.map((v, i) => (
                  <div key={i} className="flex justify-between items-center bg-pink-50 px-2 py-1.5 rounded text-sm">
                    <span className={`font-bold ${v >= 0 ? "text-green-700" : "text-red-700"}`}>{v >= 0 ? "+" : ""}{v} cm</span>
                    <Button variant="ghost" size="icon" onClick={() => setRightTrials(rightTrials.filter((_, x) => x !== i))} className="h-6 w-6"><Trash2 className="w-3 h-3 text-red-500" /></Button>
                  </div>
                ))}
                {bestRight !== null && <div className="text-center font-bold text-pink-700 text-sm">Best: {bestRight >= 0 ? "+" : ""}{bestRight} cm</div>}
              </CardContent>
            </Card>
          </div>

          {(catLeft || catRight) && (
            <div className="grid grid-cols-2 gap-3">
              {catLeft && <div className={`border-2 rounded-lg p-3 text-center text-sm font-semibold ${catLeft.color}`}>Left: {catLeft.label}</div>}
              {catRight && <div className={`border-2 rounded-lg p-3 text-center text-sm font-semibold ${catRight.color}`}>Right: {catRight.label}</div>}
            </div>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Shoulder ROM limitations, pain, asymmetry..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={leftTrials.length === 0 && rightTrials.length === 0} className="bg-pink-600 hover:bg-pink-700"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}