import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Plus, Trash2, Info } from "lucide-react";
import { toast } from "sonner";

// Normative data for vertical jump height (cm) — Lewis et al. / ACSM
const NORMS = {
  male: [
    { ageMin: 15, ageMax: 19, excellent: 65, good: 55, avg: 45, fair: 38, poor: 0 },
    { ageMin: 20, ageMax: 29, excellent: 70, good: 58, avg: 48, fair: 40, poor: 0 },
    { ageMin: 30, ageMax: 39, excellent: 65, good: 53, avg: 43, fair: 36, poor: 0 },
    { ageMin: 40, ageMax: 49, excellent: 57, good: 47, avg: 37, fair: 30, poor: 0 },
    { ageMin: 50, ageMax: 120, excellent: 50, good: 40, avg: 30, fair: 24, poor: 0 },
  ],
  female: [
    { ageMin: 15, ageMax: 19, excellent: 50, good: 41, avg: 33, fair: 26, poor: 0 },
    { ageMin: 20, ageMax: 29, excellent: 53, good: 44, avg: 35, fair: 28, poor: 0 },
    { ageMin: 30, ageMax: 39, excellent: 48, good: 39, avg: 31, fair: 24, poor: 0 },
    { ageMin: 40, ageMax: 49, excellent: 42, good: 33, avg: 25, fair: 19, poor: 0 },
    { ageMin: 50, ageMax: 120, excellent: 36, good: 27, avg: 20, fair: 14, poor: 0 },
  ],
};

function classify(height, age, gender) {
  const rows = NORMS[gender === "male" ? "male" : "female"];
  if (!rows || !age) return null;
  const row = rows.find(r => age >= r.ageMin && age <= r.ageMax);
  if (!row) return null;
  if (height >= row.excellent) return { label: "Excellent", color: "bg-green-100 text-green-800 border-green-300" };
  if (height >= row.good) return { label: "Good", color: "bg-teal-100 text-teal-800 border-teal-300" };
  if (height >= row.avg) return { label: "Average", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  if (height >= row.fair) return { label: "Fair", color: "bg-orange-100 text-orange-800 border-orange-300" };
  return { label: "Poor", color: "bg-red-100 text-red-800 border-red-300" };
}

export default function VerticalJumpTestSargentJumpRunner({ client, onSave, onClose }) {
  const [standingReach, setStandingReach] = useState("");
  const [jumpReaches, setJumpReaches] = useState([]);
  const [jumpInput, setJumpInput] = useState("");
  const [notes, setNotes] = useState("");

  const age = client?.date_of_birth ? Math.floor((Date.now() - new Date(client.date_of_birth)) / (365.25 * 24 * 3600 * 1000)) : null;
  const gender = client?.gender;

  const jumpHeights = jumpReaches.map(jr => parseFloat((parseFloat(jr) - parseFloat(standingReach)).toFixed(1)));
  const bestHeight = jumpHeights.length > 0 ? Math.max(...jumpHeights) : null;
  const cat = bestHeight !== null && age && gender ? classify(bestHeight, age, gender) : null;

  const addJump = () => {
    const v = parseFloat(jumpInput);
    if (isNaN(v) || v <= 0) { toast.error("Enter a valid jump reach value"); return; }
    if (!standingReach) { toast.error("Enter standing reach first"); return; }
    setJumpReaches([...jumpReaches, jumpInput]);
    setJumpInput("");
  };

  const handleSave = () => {
    if (!standingReach || jumpReaches.length === 0) { toast.error("Enter standing reach and at least one jump trial"); return; }
    const trialsText = jumpHeights.map((h, i) => `  Trial ${i + 1}: Reach ${jumpReaches[i]} cm → Jump Height ${h} cm`).join("\n");
    const soap = `• Vertical Jump Test (Sargent Jump)\n  Standing Reach: ${standingReach} cm\n  Best Jump Height: ${bestHeight} cm${cat ? ` — ${cat.label}` : ""}\n\n  Trials:\n${trialsText}${notes ? `\n\n  Notes: ${notes}` : ""}\n  Measures explosive lower-body power. Jump height = jump reach − standing reach.\n  Reference: ACSM; Lewis AM (1974) formula for peak power estimation.`;
    onSave({ status: "completed", result_value: bestHeight, notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "vertical_jump_sargent", standing_reach_cm: parseFloat(standingReach), jump_reaches_cm: jumpReaches.map(parseFloat), jump_heights_cm: jumpHeights, best_jump_height_cm: bestHeight, classification: cat?.label } });
    toast.success("Saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Vertical Jump Test (Sargent)</h2><p className="text-slate-500 text-sm mt-0.5">Explosive lower-body power assessment</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />📋 Protocol & Administration</p>
            <p><strong>Standing Reach:</strong> Dominant hand flat against wall, feet flat on ground. Mark highest fingertip point (chalk on fingertips).</p>
            <p><strong>Jump:</strong> From a standing position, jump as high as possible and touch the wall at peak. Countermovement (arm swing allowed).</p>
            <p className="italic">"Jump as high as you can and mark the wall at your highest point."</p>
            <p><strong>Measure:</strong> Jump Height = Jump Reach − Standing Reach. Record to nearest 0.5 cm.</p>
            <p><strong>Trials:</strong> 3 attempts with 30s rest. Record best height.</p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 Norms — Sargent Jump Height (cm)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Category</th><th className="p-2 text-center">Men 20–29</th><th className="p-2 text-center">Men 40–49</th><th className="p-2 text-center">Women 20–29</th><th className="p-2 text-center">Women 40–49</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">Excellent</td><td className="p-2 text-center">≥70</td><td className="p-2 text-center">≥57</td><td className="p-2 text-center">≥53</td><td className="p-2 text-center">≥42</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">Good</td><td className="p-2 text-center">58–69</td><td className="p-2 text-center">47–56</td><td className="p-2 text-center">44–52</td><td className="p-2 text-center">33–41</td></tr>
                  <tr className="border-t"><td className="p-2">Average</td><td className="p-2 text-center">48–57</td><td className="p-2 text-center">37–46</td><td className="p-2 text-center">35–43</td><td className="p-2 text-center">25–32</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">Poor</td><td className="p-2 text-center">&lt;48</td><td className="p-2 text-center">&lt;37</td><td className="p-2 text-center">&lt;35</td><td className="p-2 text-center">&lt;25</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Sargent DA. (1921). The physical test of a man. <em>American Physical Education Review, 26</em>(4), 188–194.</p>
            <p>Johnson BL & Nelson JK. (1979). <em>Practical Measurements for Evaluation in Physical Education</em> (4th ed.). Burgess Publishing.</p>
          </div>

          <div>
            <Label>Standing Reach (cm) <span className="text-red-500">*</span></Label>
            <Input type="number" step="0.5" value={standingReach} onChange={e => setStandingReach(e.target.value)} placeholder="e.g. 220" className="mt-1 w-48" />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Jump Reach Trials (cm)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input type="number" step="0.5" placeholder="e.g. 255" value={jumpInput} onChange={e => setJumpInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addJump()} />
                <Button onClick={addJump} disabled={!jumpInput || !standingReach}><Plus className="w-4 h-4 mr-1" />Add</Button>
              </div>
              {jumpReaches.map((jr, i) => (
                <div key={i} className="flex justify-between items-center bg-indigo-50 px-3 py-2 rounded-lg">
                  <span className="text-sm">Trial {i + 1}: Reach <span className="font-bold">{jr} cm</span> → Height <span className="font-bold text-indigo-700">{jumpHeights[i]} cm</span></span>
                  <Button variant="ghost" size="icon" onClick={() => setJumpReaches(jumpReaches.filter((_, x) => x !== i))}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {bestHeight !== null && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-xl p-5 text-center">
              <p className="text-sm text-slate-500">Best Jump Height</p>
              <p className="text-5xl font-bold text-indigo-600">{bestHeight} cm</p>
            </div>
          )}

          {cat && <div className={`border-2 rounded-xl p-4 text-center font-bold text-xl ${cat.color}`}>{cat.label}</div>}

          {(age && gender) && (
            <div className="bg-slate-50 border rounded-lg p-3 text-xs text-slate-600">
              <p className="font-semibold mb-1">Normative Reference ({gender}, {age} yrs)</p>
              {(() => {
                const rows = NORMS[gender === "male" ? "male" : "female"];
                const row = rows?.find(r => age >= r.ageMin && age <= r.ageMax);
                if (!row) return null;
                return <p>Excellent ≥{row.excellent} | Good ≥{row.good} | Average ≥{row.avg} | Fair ≥{row.fair} cm</p>;
              })()}
            </div>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Arm swing, technique, pain, surface type, footwear..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!standingReach || jumpReaches.length === 0} className="bg-indigo-600 hover:bg-indigo-700"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}