import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Plus, Trash2, Info } from "lucide-react";
import { toast } from "sonner";

const NORMS_CM = {
  male: [
    { ageMin: 15, ageMax: 19, excellent: 65, good: 55, avg: 45, fair: 35, poor: 0 },
    { ageMin: 20, ageMax: 29, excellent: 70, good: 60, avg: 50, fair: 40, poor: 0 },
    { ageMin: 30, ageMax: 39, excellent: 65, good: 55, avg: 45, fair: 35, poor: 0 },
    { ageMin: 40, ageMax: 49, excellent: 60, good: 50, avg: 40, fair: 30, poor: 0 },
    { ageMin: 50, ageMax: 120, excellent: 55, good: 45, avg: 35, fair: 25, poor: 0 },
  ],
  female: [
    { ageMin: 15, ageMax: 19, excellent: 50, good: 40, avg: 30, fair: 20, poor: 0 },
    { ageMin: 20, ageMax: 29, excellent: 55, good: 45, avg: 35, fair: 25, poor: 0 },
    { ageMin: 30, ageMax: 39, excellent: 50, good: 40, avg: 30, fair: 20, poor: 0 },
    { ageMin: 40, ageMax: 49, excellent: 45, good: 35, avg: 25, fair: 15, poor: 0 },
    { ageMin: 50, ageMax: 120, excellent: 40, good: 30, avg: 20, fair: 10, poor: 0 },
  ],
};

function classify(cm, age, gender) {
  const rows = NORMS_CM[gender === "male" ? "male" : "female"];
  if (!rows) return null;
  const row = rows.find(r => age >= r.ageMin && age <= r.ageMax);
  if (!row) return null;
  if (cm >= row.excellent) return { label: "Excellent", color: "bg-green-100 text-green-800 border-green-300" };
  if (cm >= row.good) return { label: "Good", color: "bg-teal-100 text-teal-800 border-teal-300" };
  if (cm >= row.avg) return { label: "Average", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  if (cm >= row.fair) return { label: "Below Average", color: "bg-orange-100 text-orange-800 border-orange-300" };
  return { label: "Poor", color: "bg-red-100 text-red-800 border-red-300" };
}

export default function VerticalJumpTestRunner({ client, onSave, onClose }) {
  const [trials, setTrials] = useState([]);
  const [input, setInput] = useState("");
  const [method, setMethod] = useState("jump_mat");
  const [standingReach, setStandingReach] = useState("");
  const [jumpReach, setJumpReach] = useState("");
  const [notes, setNotes] = useState("");

  const age = client?.date_of_birth ? Math.floor((Date.now() - new Date(client.date_of_birth)) / (365.25 * 24 * 3600 * 1000)) : null;
  const gender = client?.gender;

  const directHeight = method === "sargent" && standingReach && jumpReach
    ? (parseFloat(jumpReach) - parseFloat(standingReach)).toFixed(1)
    : null;

  const addTrial = () => {
    const v = directHeight ? parseFloat(directHeight) : parseFloat(input);
    if (isNaN(v) || v <= 0) { toast.error("Enter a valid jump height"); return; }
    setTrials([...trials, v]);
    setInput("");
    if (directHeight) { setStandingReach(""); setJumpReach(""); }
  };

  const best = trials.length > 0 ? Math.max(...trials) : null;
  const cat = best && age && gender ? classify(best, age, gender) : null;

  const handleSave = () => {
    if (trials.length === 0) { toast.error("Record at least one trial"); return; }
    const soap = `â€¢ Vertical Jump Test\n  Best Height: ${best} cm${cat ? ` â€” ${cat.label}` : ""}\n  Method: ${method === "jump_mat" ? "Jump mat/force plate" : method === "sargent" ? "Sargent (reach) method" : "Other"}\n  Trials: ${trials.map(t => `${t} cm`).join(", ")}${notes ? `\n  Notes: ${notes}` : ""}\n  Measures lower-body explosive power (anaerobic power/force production)\n  Reference: ACSM; Harman et al. (1991). Estimation of human power output from maximal vertical jump. J Strength Cond Res.`;
    onSave({ status: "completed", result_value: best, notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "vertical_jump", best_cm: best, trials, method, classification: cat?.label } });
    toast.success("Saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-emerald-50 to-green-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Vertical Jump Test</h2><p className="text-slate-500 text-sm mt-0.5">Lower-body explosive power</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />ðŸ“‹ Protocol & Administration</p>
            <p><strong>Countermovement Jump:</strong> Stand with feet shoulder-width apart on mat. Dip and swing arms, then jump maximally. Land on both feet simultaneously on the mat.</p>
            <p className="italic">"Jump as high as you can. You may bend your knees and swing your arms. Try to land on both feet at the same time."</p>
            <p><strong>Trials:</strong> 3 attempts with 30s rest. Record best.</p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-semibold text-slate-700">ðŸ“Š Norms (countermovement jump, cm)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Category</th><th className="p-2 text-center">Men 20â€“29</th><th className="p-2 text-center">Men 40â€“49</th><th className="p-2 text-center">Women 20â€“29</th><th className="p-2 text-center">Women 40â€“49</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">Excellent</td><td className="p-2 text-center">â‰¥70</td><td className="p-2 text-center">â‰¥60</td><td className="p-2 text-center">â‰¥55</td><td className="p-2 text-center">â‰¥45</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">Good</td><td className="p-2 text-center">60â€“69</td><td className="p-2 text-center">50â€“59</td><td className="p-2 text-center">45â€“54</td><td className="p-2 text-center">35â€“44</td></tr>
                  <tr className="border-t"><td className="p-2">Average</td><td className="p-2 text-center">50â€“59</td><td className="p-2 text-center">40â€“49</td><td className="p-2 text-center">35â€“44</td><td className="p-2 text-center">25â€“34</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">Poor</td><td className="p-2 text-center">&lt;50</td><td className="p-2 text-center">&lt;40</td><td className="p-2 text-center">&lt;35</td><td className="p-2 text-center">&lt;25</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">ðŸ“– Reference</p>
            <p>Harman EA, Rosenstein MT, Frykman PN, & Rosenstein RM. (1991). Estimation of human power output from maximal vertical jump and body mass. <em>Journal of Strength and Conditioning Research, 5</em>(3), 116â€“120.</p>
            <p>American College of Sports Medicine. (2022). <em>ACSM's Guidelines for Exercise Testing and Prescription</em> (11th ed.). Wolters Kluwer.</p>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Measurement Method</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="jump_mat">Jump mat / force plate (direct cm)</SelectItem>
                  <SelectItem value="sargent">Sargent reach method (wall)</SelectItem>
                  <SelectItem value="other">Other device</SelectItem>
                </SelectContent>
              </Select>

              {method === "sargent" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Standing Reach (cm)</Label><Input type="number" step="0.5" value={standingReach} onChange={e => setStandingReach(e.target.value)} placeholder="e.g. 215" className="mt-1" /></div>
                  <div><Label>Jump Reach (cm)</Label><Input type="number" step="0.5" value={jumpReach} onChange={e => setJumpReach(e.target.value)} placeholder="e.g. 260" className="mt-1" /></div>
                  {directHeight && <div className="col-span-2 text-center bg-emerald-50 p-2 rounded font-bold text-emerald-700">Jump Height: {directHeight} cm</div>}
                </div>
              ) : (
                <div><Label>Jump Height (cm)</Label><Input type="number" step="0.5" value={input} onChange={e => setInput(e.target.value)} placeholder="e.g. 52" className="mt-1" /></div>
              )}

              <Button onClick={addTrial} disabled={method === "sargent" ? !directHeight : !input} className="w-full"><Plus className="w-4 h-4 mr-2" />Record Trial {trials.length + 1}</Button>
            </CardContent>
          </Card>

          {trials.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Trials</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {trials.map((v, i) => (
                  <div key={i} className="flex justify-between items-center bg-emerald-50 px-3 py-2 rounded-lg">
                    <span>Trial {i + 1}: <span className={`font-bold ${v === best ? "text-emerald-600" : "text-slate-700"}`}>{v} cm{v === best ? " â˜…" : ""}</span></span>
                    <Button variant="ghost" size="icon" onClick={() => setTrials(trials.filter((_, x) => x !== i))}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {best && (
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-xl p-5 text-center">
              <p className="text-5xl font-bold text-emerald-600">{best} cm</p>
              {cat && <p className={`font-bold text-xl mt-1 ${cat.color.split(" ")[1]}`}>{cat.label}</p>}
            </div>
          )}

          {cat && <div className={`border-2 rounded-xl p-3 text-center font-semibold ${cat.color}`}>{cat.label}</div>}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Jump technique, arm swing, asymmetry..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={trials.length === 0} className="bg-emerald-600 hover:bg-emerald-700"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}