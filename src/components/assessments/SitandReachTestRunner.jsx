import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Plus, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// Wells & Dillon (1952) / ACSM norms for standard sit-and-reach (cm, box method)
const NORMS = {
  male: [
    { ageMin: 15, ageMax: 19, excellent: 39, good: 34, avg: 29, fair: 24, poor: 0 },
    { ageMin: 20, ageMax: 29, excellent: 40, good: 34, avg: 30, fair: 25, poor: 0 },
    { ageMin: 30, ageMax: 39, excellent: 38, good: 33, avg: 28, fair: 23, poor: 0 },
    { ageMin: 40, ageMax: 49, excellent: 35, good: 29, avg: 24, fair: 18, poor: 0 },
    { ageMin: 50, ageMax: 59, excellent: 35, good: 28, avg: 24, fair: 16, poor: 0 },
    { ageMin: 60, ageMax: 120, excellent: 33, good: 25, avg: 20, fair: 15, poor: 0 },
  ],
  female: [
    { ageMin: 15, ageMax: 19, excellent: 43, good: 38, avg: 34, fair: 29, poor: 0 },
    { ageMin: 20, ageMax: 29, excellent: 41, good: 37, avg: 33, fair: 28, poor: 0 },
    { ageMin: 30, ageMax: 39, excellent: 41, good: 36, avg: 32, fair: 27, poor: 0 },
    { ageMin: 40, ageMax: 49, excellent: 38, good: 34, avg: 30, fair: 25, poor: 0 },
    { ageMin: 50, ageMax: 59, excellent: 39, good: 33, avg: 30, fair: 25, poor: 0 },
    { ageMin: 60, ageMax: 120, excellent: 35, good: 31, avg: 27, fair: 23, poor: 0 },
  ],
};

function classify(cm, age, gender) {
  const rows = NORMS[gender === "male" ? "male" : "female"];
  if (!rows || !age) return null;
  const row = rows.find(r => age >= r.ageMin && age <= r.ageMax);
  if (!row) return null;
  if (cm >= row.excellent) return { label: "Excellent", color: "bg-green-100 text-green-800 border-green-300" };
  if (cm >= row.good) return { label: "Good", color: "bg-teal-100 text-teal-800 border-teal-300" };
  if (cm >= row.avg) return { label: "Average", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  if (cm >= row.fair) return { label: "Below Average", color: "bg-orange-100 text-orange-800 border-orange-300" };
  return { label: "Poor", color: "bg-red-100 text-red-800 border-red-300" };
}

export default function SitandReachTestRunner({ client, onSave, onClose }) {
  const [trials, setTrials] = useState([]);
  const [input, setInput] = useState("");
  const [boxOffset, setBoxOffset] = useState("23"); // standard box footline at 23cm
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
    const soap = `• Sit and Reach Test (Standard Box Method)\n  Best Score: ${best} cm${cat ? ` — ${cat.label}` : ""}\n  Trials: ${trials.map(t => t + " cm").join(", ")}\n  Box footline position: ${boxOffset} cm\n  Measures lower back and hamstring flexibility${notes ? `\n  Notes: ${notes}` : ""}\n  Reference: ACSM Guidelines for Exercise Testing and Prescription; Wells KF & Dillon EK (1952). The sit and reach: a test of back and leg flexibility. Research Quarterly, 23:115-118.`;
    onSave({ status: "completed", result_value: best, notes, assessment_date: todayLocal(), additional_data: { soap_text: soap, measurement_type: "flexibility_cm", best_cm: best, trials, box_offset_cm: parseFloat(boxOffset), classification: cat?.label } });
    toast.success("Saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-teal-50 to-cyan-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Sit and Reach Test</h2><p className="text-slate-500 text-sm mt-0.5">Lower back & hamstring flexibility</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Protocol</p>
            <p><strong>Position:</strong> Seated on floor, knees straight, feet flat against box. Shoes removed.</p>
            <p><strong>Action:</strong> Reach forward slowly with hands overlapping. Hold 2 seconds at maximum reach. No bouncing.</p>
            <p><strong>Record:</strong> 2 attempts. Best score to nearest 0.5 cm.</p>
          </div>

          <div><Label>Box Footline Position (cm)</Label>
            <Input type="number" step="0.5" value={boxOffset} onChange={e => setBoxOffset(e.target.value)} className="mt-1 max-w-xs" />
            <p className="text-xs text-slate-400 mt-1">Standard box = 23 cm. Adjusted box = enter correct value.</p>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Trial Results (cm)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input type="number" step="0.5" placeholder="e.g. 32.5" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addTrial()} />
                <Button onClick={addTrial} disabled={!input}><Plus className="w-4 h-4 mr-1" />Add</Button>
              </div>
              {trials.map((v, i) => (
                <div key={i} className="flex justify-between items-center bg-teal-50 px-3 py-2 rounded-lg">
                  <span>Trial {i + 1}: <span className={`font-bold ${v === best ? "text-teal-600" : "text-slate-700"}`}>{v} cm{v === best ? " ★" : ""}</span></span>
                  <Button variant="ghost" size="icon" onClick={() => setTrials(trials.filter((_, x) => x !== i))}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {best !== null && cat && (
            <div className={`border-2 rounded-xl p-4 text-center ${cat.color}`}>
              <p className="text-4xl font-bold">{best} cm</p>
              <p className="font-bold text-xl mt-1">{cat.label}</p>
            </div>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Hamstring tightness, low back pain, asymmetry..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={trials.length === 0} className="bg-teal-600 hover:bg-teal-700"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}