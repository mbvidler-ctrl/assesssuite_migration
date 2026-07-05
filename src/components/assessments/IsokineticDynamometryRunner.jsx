import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Plus, Trash2, Info } from "lucide-react";
import { toast } from "sonner";

// H:Q ratio interpretation
function interpretHQ(ratio) {
  if (!ratio || isNaN(ratio)) return null;
  if (ratio >= 0.55 && ratio <= 0.80) return { label: "Normal (0.55–0.80)", color: "text-green-600" };
  if (ratio < 0.55) return { label: "Low — Possible hamstring weakness / injury risk", color: "text-red-600" };
  return { label: "High — Possible quadriceps weakness", color: "text-orange-600" };
}

const SPEEDS = ["60°/s", "180°/s", "240°/s", "300°/s", "Custom"];

const emptySet = (side) => ({ side, speed: "60°/s", customSpeed: "", peakTorque: "", avgTorque: "", work: "", power: "", reps: "" });

export default function IsokineticDynamometryRunner({ client, onSave, onClose }) {
  const [sets, setSets] = useState([emptySet("right"), emptySet("left")]);
  const [joint, setJoint] = useState("Knee Flexion/Extension");
  const [device, setDevice] = useState("");
  const [preHR, setPreHR] = useState("");
  const [postHR, setPostHR] = useState("");
  const [notes, setNotes] = useState("");

  const updateSet = (i, field, val) => setSets(sets.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  const addSet = () => setSets([...sets, emptySet("right")]);
  const removeSet = (i) => setSets(sets.filter((_, idx) => idx !== i));

  // H:Q ratio for right and left (at 60°/s)
  const hqCalc = (side) => {
    const flexSet = sets.find(s => s.side === side && s.speed === "60°/s" && parseFloat(s.peakTorque) > 0);
    const extSet = sets.find(s => s.side !== side && s.speed === "60°/s" && parseFloat(s.peakTorque) > 0);
    // Simpler: find flex and ext for same side by index pairs
    const sideSets = sets.filter(s => s.side === side && s.speed === "60°/s");
    if (sideSets.length < 2) return null;
    const [s1, s2] = sideSets;
    const t1 = parseFloat(s1.peakTorque), t2 = parseFloat(s2.peakTorque);
    if (!t1 || !t2) return null;
    return parseFloat((Math.min(t1, t2) / Math.max(t1, t2)).toFixed(2));
  };

  const handleSave = () => {
    const validSets = sets.filter(s => s.peakTorque && !isNaN(parseFloat(s.peakTorque)));
    const maxPeak = Math.max(...validSets.map(s => parseFloat(s.peakTorque)));
    const setLines = validSets.map((s, i) => `  ${s.side} ${s.speed}${s.customSpeed ? ` (${s.customSpeed}°/s)` : ""}: Peak ${s.peakTorque}Nm${s.avgTorque ? ` | Avg ${s.avgTorque}Nm` : ""}${s.work ? ` | Work ${s.work}J` : ""}${s.power ? ` | Power ${s.power}W` : ""}${s.reps ? ` | ${s.reps} reps` : ""}`).join("\n");
    const soap = `• Isokinetic Dynamometry — ${joint}\n  Device: ${device || "Not specified"}\n  Pre-test HR: ${preHR || "N/A"} bpm | Post-test HR: ${postHR || "N/A"} bpm\n\n  Results:\n${setLines}${notes ? `\n\n  Notes: ${notes}` : ""}\n  Hamstring:Quadriceps ratio norms: 0.55–0.80 at 60°/s. <0.55 indicates increased injury risk.\n  Reference: Coombs R & Garbutt G (2002). Developments in the use of the hamstring/quadriceps ratio for assessment of muscle balance. J Sports Sci Med, 1(3):56-62.`;
    onSave({ status: "completed", result_value: maxPeak, notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "isokinetic_dynamometry", joint, device, pre_hr: preHR ? parseInt(preHR) : null, post_hr: postHR ? parseInt(postHR) : null, sets: validSets.map(s => ({ side: s.side, speed_deg_per_s: s.customSpeed || s.speed, peak_torque_nm: parseFloat(s.peakTorque), avg_torque_nm: s.avgTorque ? parseFloat(s.avgTorque) : null, work_j: s.work ? parseFloat(s.work) : null, power_w: s.power ? parseFloat(s.power) : null, reps: s.reps ? parseInt(s.reps) : null })) } });
    toast.success("Isokinetics saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Isokinetic Dynamometry</h2><p className="text-slate-500 text-sm mt-0.5">Constant-velocity strength assessment</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Protocol</p>
            <p><strong>Setup:</strong> Align dynamometer axis with joint axis of rotation. Secure stabilisation straps.</p>
            <p><strong>Common speeds:</strong> 60°/s (strength), 180–240°/s (power), 300°/s (endurance).</p>
            <p><strong>Recording:</strong> Device outputs peak torque, average torque, total work. Record per side and per speed.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Joint / Movement</Label><Input value={joint} onChange={e => setJoint(e.target.value)} placeholder="e.g. Knee Flex/Ext" className="mt-1" /></div>
            <div><Label>Device / Dynamometer</Label><Input value={device} onChange={e => setDevice(e.target.value)} placeholder="e.g. Biodex, HUMAC" className="mt-1" /></div>
            <div><Label>Pre-Test HR (bpm)</Label><Input type="number" value={preHR} onChange={e => setPreHR(e.target.value)} className="mt-1" /></div>
            <div><Label>Post-Test HR (bpm)</Label><Input type="number" value={postHR} onChange={e => setPostHR(e.target.value)} className="mt-1" /></div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">Test Sets</CardTitle>
                <Button size="sm" variant="outline" onClick={addSet}><Plus className="w-3.5 h-3.5 mr-1" />Add Set</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {sets.map((s, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {["right", "left"].map(side => (
                        <Button key={side} size="sm" variant={s.side === side ? "default" : "outline"} className="capitalize" onClick={() => updateSet(i, "side", side)}>{side}</Button>
                      ))}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeSet(i)} disabled={sets.length === 1}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {SPEEDS.map(sp => (
                      <Button key={sp} size="sm" variant={s.speed === sp ? "default" : "outline"} onClick={() => updateSet(i, "speed", sp)}>{sp}</Button>
                    ))}
                  </div>
                  {s.speed === "Custom" && <Input type="number" placeholder="Enter speed (°/s)" value={s.customSpeed} onChange={e => updateSet(i, "customSpeed", e.target.value)} className="w-40" />}
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-xs">Peak Torque (Nm)*</Label><Input type="number" step="0.1" value={s.peakTorque} onChange={e => updateSet(i, "peakTorque", e.target.value)} className="mt-0.5" /></div>
                    <div><Label className="text-xs">Avg Torque (Nm)</Label><Input type="number" step="0.1" value={s.avgTorque} onChange={e => updateSet(i, "avgTorque", e.target.value)} className="mt-0.5" /></div>
                    <div><Label className="text-xs">Work (J)</Label><Input type="number" step="1" value={s.work} onChange={e => updateSet(i, "work", e.target.value)} className="mt-0.5" /></div>
                    <div><Label className="text-xs">Power (W)</Label><Input type="number" step="0.1" value={s.power} onChange={e => updateSet(i, "power", e.target.value)} className="mt-0.5" /></div>
                    <div><Label className="text-xs">Reps</Label><Input type="number" step="1" value={s.reps} onChange={e => updateSet(i, "reps", e.target.value)} className="mt-0.5" /></div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Alignment, effort, pain, side difference, H:Q ratio clinical impression..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}