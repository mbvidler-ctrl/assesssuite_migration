import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Plus, Trash2, Info } from "lucide-react";
import { toast } from "sonner";

// Jones & Rikli (2002) Senior Fitness Test norms — Chair Sit & Reach (cm)
const NORMS = {
  male: [
    { ageMin: 60, ageMax: 64, excellent: 12.7, good: 7.6, avg: 2.5, fair: -2.5, poor: -999 },
    { ageMin: 65, ageMax: 69, excellent: 12.7, good: 7.6, avg: 2.5, fair: -2.5, poor: -999 },
    { ageMin: 70, ageMax: 74, excellent: 11.4, good: 6.3, avg: 1.3, fair: -3.8, poor: -999 },
    { ageMin: 75, ageMax: 79, excellent: 10.2, good: 5.1, avg: 0, fair: -5.1, poor: -999 },
    { ageMin: 80, ageMax: 120, excellent: 8.9, good: 3.8, avg: -1.3, fair: -6.3, poor: -999 },
  ],
  female: [
    { ageMin: 60, ageMax: 64, excellent: 16.5, good: 11.4, avg: 6.3, fair: 1.3, poor: -999 },
    { ageMin: 65, ageMax: 69, excellent: 16.5, good: 11.4, avg: 6.3, fair: 1.3, poor: -999 },
    { ageMin: 70, ageMax: 74, excellent: 15.2, good: 10.2, avg: 5.1, fair: 0, poor: -999 },
    { ageMin: 75, ageMax: 79, excellent: 15.2, good: 10.2, avg: 5.1, fair: 0, poor: -999 },
    { ageMin: 80, ageMax: 120, excellent: 14, good: 8.9, avg: 3.8, fair: -1.3, poor: -999 },
  ],
};

function classify(score, age, gender) {
  const rows = NORMS[gender === "male" ? "male" : "female"];
  if (!rows) return null;
  const row = rows.find(r => age >= r.ageMin && age <= r.ageMax);
  if (!row) return null;
  if (score >= row.excellent) return { label: "Excellent", color: "bg-green-100 text-green-800 border-green-300" };
  if (score >= row.good) return { label: "Good", color: "bg-teal-100 text-teal-800 border-teal-300" };
  if (score >= row.avg) return { label: "Average", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  if (score >= row.fair) return { label: "Below Average", color: "bg-orange-100 text-orange-800 border-orange-300" };
  return { label: "Low", color: "bg-red-100 text-red-800 border-red-300" };
}

export default function ChairSitandReachTestRunner({ client, onSave, onClose }) {
  const [trials, setTrials] = useState([]);
  const [input, setInput] = useState("");
  const [notes, setNotes] = useState("");

  const age = client?.date_of_birth ? Math.floor((Date.now() - new Date(client.date_of_birth)) / (365.25 * 24 * 3600 * 1000)) : null;
  const gender = client?.gender;
  const best = trials.length > 0 ? Math.max(...trials) : null;
  const cat = best !== null && age && gender ? classify(best, age, gender) : null;

  const addTrial = () => {
    const v = parseFloat(input);
    if (isNaN(v)) { toast.error("Enter a valid number"); return; }
    setTrials([...trials, v]);
    setInput("");
  };

  const handleSave = () => {
    if (trials.length === 0) { toast.error("Add at least one trial"); return; }
    const soap = `• Chair Sit and Reach Test (Senior Fitness Test)\n  Best Result: ${best} cm${cat ? ` — ${cat.label}` : ""}\n  Trials: ${trials.map(t => `${t} cm`).join(", ")}${notes ? `\n  Notes: ${notes}` : ""}\n  Positive = fingertips beyond foot; Negative = fingertips short of foot\n  Normative Reference: Rikli & Jones (2001) Senior Fitness Test Manual\n  Reference: Jones CJ, Rikli RE (2002). Measuring functional fitness of older adults. The Journal on Active Aging.`;
    onSave({ status: "completed", result_value: best, notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "chair_sit_and_reach", trials, best_cm: best, classification: cat?.label } });
    toast.success("Saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-teal-50 to-green-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Chair Sit and Reach Test</h2><p className="text-slate-500 text-sm mt-0.5">Senior Fitness Test — lower body flexibility</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Jones CJ, Rikli RE, & Beam WC. (1999). A 30-s chair-stand test as a measure of lower body strength in community-residing older adults. <em>Research Quarterly for Exercise and Sport, 70</em>(2), 113–119.</p>
            <p>Rikli RE & Jones CJ. (2001). <em>Senior Fitness Test Manual</em>. Human Kinetics.</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />📋 Protocol & Administration</p>
            <p><strong>Position:</strong> Seated on front edge of chair (~43–45 cm height). Dominant leg extended straight, foot flat on floor, heel at floor level. Non-dominant knee bent, foot flat.</p>
            <p><strong>Action:</strong> One hand on top of the other along the middle finger line. Lean forward slowly, sliding hands down the extended leg toward (or past) toes. Hold for 2 seconds.</p>
            <p className="italic">"Slowly reach forward as far as you can along your extended leg, hold for 2 seconds, then return. Do not bend your knee."</p>
            <p><strong>Measurement:</strong> Distance from middle fingertips to end of shoe. Positive (+) = fingertips past toe; Negative (−) = fingertips short of toe. Record best of 2 trials to nearest 0.5 cm.</p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 Norms — Chair Sit & Reach (cm) — Senior Fitness Test</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Age</th><th className="p-2 text-center">Men (avg range)</th><th className="p-2 text-center">Women (avg range)</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">60–64</td><td className="p-2 text-center">+2.5 to +12.7</td><td className="p-2 text-center">+6.3 to +16.5</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">65–69</td><td className="p-2 text-center">+2.5 to +12.7</td><td className="p-2 text-center">+6.3 to +16.5</td></tr>
                  <tr className="border-t"><td className="p-2">70–74</td><td className="p-2 text-center">+1.3 to +11.4</td><td className="p-2 text-center">+5.1 to +15.2</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">75+</td><td className="p-2 text-center">0 to +10.2</td><td className="p-2 text-center">+5.1 to +15.2</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">Source: Rikli & Jones (2001). Positive = reach past toes; Negative = short of toes.</p>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Trial Results (cm)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input type="number" step="0.5" placeholder="e.g. 5.5 or -3.0" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addTrial()} />
                <Button onClick={addTrial} disabled={!input}><Plus className="w-4 h-4 mr-1" />Add</Button>
              </div>
              {trials.map((v, i) => (
                <div key={i} className="flex justify-between items-center bg-teal-50 px-3 py-2 rounded-lg">
                  <span>Trial {i + 1}: <span className={`font-bold ${v >= 0 ? "text-teal-700" : "text-red-700"}`}>{v >= 0 ? "+" : ""}{v} cm</span></span>
                  <Button variant="ghost" size="icon" onClick={() => setTrials(trials.filter((_, x) => x !== i))}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {best !== null && (
            <div className="bg-gradient-to-r from-teal-50 to-green-50 border-2 border-teal-200 rounded-xl p-5 text-center">
              <p className="text-sm text-slate-500">Best Score</p>
              <p className={`text-5xl font-bold ${best >= 0 ? "text-teal-600" : "text-red-500"}`}>{best >= 0 ? "+" : ""}{best} cm</p>
            </div>
          )}

          {cat && <div className={`border-2 rounded-xl p-4 text-center font-bold text-xl ${cat.color}`}>{cat.label}</div>}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Flexibility, pain, hip/hamstring limitation..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={trials.length === 0} className="bg-teal-600 hover:bg-teal-700"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}