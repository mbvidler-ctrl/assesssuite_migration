import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Plus, Trash2, Info } from "lucide-react";
import { toast } from "sonner";

// RSI = Jump Height (m) / Ground Contact Time (s)
// RSI norms (modified RSI from drop jump)
function classifyRSI(rsi) {
  if (rsi >= 2.5) return { label: "Elite", color: "bg-green-100 text-green-800 border-green-300" };
  if (rsi >= 1.75) return { label: "Good", color: "bg-teal-100 text-teal-800 border-teal-300" };
  if (rsi >= 1.25) return { label: "Average", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  if (rsi >= 0.75) return { label: "Below Average", color: "bg-orange-100 text-orange-800 border-orange-300" };
  return { label: "Poor", color: "bg-red-100 text-red-800 border-red-300" };
}

export default function ReactiveStrengthIndexRSIRunner({ client, onSave, onClose }) {
  const [trials, setTrials] = useState([]);
  const [jumpHeight, setJumpHeight] = useState("");
  const [contactTime, setContactTime] = useState("");
  const [dropHeight, setDropHeight] = useState("30");
  const [notes, setNotes] = useState("");

  const addTrial = () => {
    const h = parseFloat(jumpHeight);
    const c = parseFloat(contactTime);
    if (isNaN(h) || isNaN(c) || h <= 0 || c <= 0) { toast.error("Enter valid jump height (cm) and contact time (ms)"); return; }
    const rsi = parseFloat((h / 100 / (c / 1000)).toFixed(3));
    setTrials([...trials, { jumpHeight: h, contactTime: c, rsi }]);
    setJumpHeight(""); setContactTime("");
  };

  const best = trials.length > 0 ? trials.reduce((b, t) => t.rsi > b.rsi ? t : b) : null;
  const cat = best ? classifyRSI(best.rsi) : null;

  const handleSave = () => {
    if (trials.length === 0) { toast.error("Record at least one trial"); return; }
    const trialLines = trials.map((t, i) => `  Trial ${i + 1}: Jump ${t.jumpHeight}cm | GCT ${t.contactTime}ms | RSI ${t.rsi}`).join("\n");
    const soap = `• Reactive Strength Index (RSI) — Drop Jump\n  Best RSI: ${best.rsi} (${cat.label})\n  Jump Height: ${best.jumpHeight}cm | Ground Contact Time: ${best.contactTime}ms\n  Drop Height: ${dropHeight}cm\n\n  All Trials:\n${trialLines}${notes ? `\n\n  Notes: ${notes}` : ""}\n  RSI = Jump Height (m) ÷ Ground Contact Time (s)\n  Elite athletes typically >2.5; general population 1.0–2.0\n  Reference: Young WB (1995). Laboratory strength assessment of athletes. NSCA Journal. McClymont D (2003).`;
    onSave({ status: "completed", result_value: best.rsi, notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "reactive_strength", best_rsi: best.rsi, best_jump_height_cm: best.jumpHeight, best_contact_time_ms: best.contactTime, drop_height_cm: parseFloat(dropHeight), trials, classification: cat.label } });
    toast.success("RSI saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-orange-50 to-red-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Reactive Strength Index (RSI)</h2><p className="text-slate-500 text-sm mt-0.5">Drop jump — plyometric capacity assessment</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Protocol</p>
            <p><strong>Drop Jump:</strong> Step off box at set height (not jumping off). Land on both feet, immediately jump maximally upward. Minimize ground contact time.</p>
            <p><strong>Measure:</strong> Jump height (cm) and ground contact time (ms) via jump mat or force plate. RSI = Height(m) ÷ GCT(s).</p>
            <p><strong>Trials:</strong> 3–5 attempts. Record best RSI.</p>
          </div>

          <div><Label>Drop Height (cm)</Label><Input type="number" step="5" value={dropHeight} onChange={e => setDropHeight(e.target.value)} className="mt-1" /></div>

          <Card>
            <CardHeader><CardTitle className="text-base">Add Trial</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Jump Height (cm)</Label><Input type="number" step="0.1" value={jumpHeight} onChange={e => setJumpHeight(e.target.value)} placeholder="e.g. 38.5" className="mt-1" /></div>
                <div><Label>Contact Time (ms)</Label><Input type="number" step="1" value={contactTime} onChange={e => setContactTime(e.target.value)} placeholder="e.g. 180" className="mt-1" /></div>
              </div>
              {jumpHeight && contactTime && !isNaN(parseFloat(jumpHeight)) && !isNaN(parseFloat(contactTime)) && parseFloat(contactTime) > 0 && (
                <div className="text-center bg-orange-50 p-2 rounded font-bold text-orange-700">
                  Calculated RSI: {(parseFloat(jumpHeight) / 100 / (parseFloat(contactTime) / 1000)).toFixed(3)}
                </div>
              )}
              <Button onClick={addTrial} className="w-full bg-orange-500 hover:bg-orange-600"><Plus className="w-4 h-4 mr-2" />Add Trial</Button>
            </CardContent>
          </Card>

          {trials.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Trials</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {trials.map((t, i) => (
                  <div key={i} className="flex justify-between items-center bg-orange-50 px-3 py-2 rounded-lg text-sm">
                    <span>T{i + 1}: <span className={`font-bold ${t.rsi === best?.rsi ? "text-orange-600" : ""}`}>RSI {t.rsi}</span> | {t.jumpHeight}cm / {t.contactTime}ms{t.rsi === best?.rsi ? " ★" : ""}</span>
                    <Button variant="ghost" size="icon" onClick={() => setTrials(trials.filter((_, x) => x !== i))}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {best && cat && (
            <div className={`border-2 rounded-xl p-5 text-center ${cat.color}`}>
              <p className="text-5xl font-bold">{best.rsi}</p>
              <p className="text-sm mt-0.5">RSI</p>
              <p className="font-bold text-xl mt-1">{cat.label}</p>
            </div>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Landing mechanics, asymmetry, technique cues..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={trials.length === 0} className="bg-orange-500 hover:bg-orange-600"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}