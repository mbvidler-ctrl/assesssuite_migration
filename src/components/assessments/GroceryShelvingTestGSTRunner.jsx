import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Play, Square, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// GST: patient places as many tins as possible on overhead shelf in 30s
// Normative data varies; primary measure is number of tins placed (reps)

export default function GroceryShelvingTestGSTRunner({ client, onSave, onClose }) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [reps, setReps] = useState("");
  const [side, setSide] = useState("bilateral");
  const [weight, setWeight] = useState("400g");
  const [notes, setNotes] = useState("");
  const intervalRef = useRef(null);
  const startRef = useRef(null);
  const DURATION = 30;

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const start = () => {
    setElapsed(0);
    setIsRunning(true);
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const e = (Date.now() - startRef.current) / 1000;
      if (e >= DURATION) {
        clearInterval(intervalRef.current);
        setElapsed(DURATION);
        setIsRunning(false);
        toast.info("30 seconds complete — record repetitions");
      } else {
        setElapsed(e);
      }
    }, 100);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
  };

  const pct = Math.min((elapsed / DURATION) * 100, 100);

  const handleSave = () => {
    const r = parseInt(reps);
    if (!reps || isNaN(r) || r < 0) { toast.error("Enter repetitions completed"); return; }
    let interp = r >= 18 ? "Excellent" : r >= 14 ? "Good" : r >= 10 ? "Average" : "Below Average";
    const soap = `• Grocery Shelving Test (GST)\n  Items Placed: ${r} in 30s — ${interp}\n  Side: ${side} | Weight: ${weight}\n  The GST evaluates functional upper limb endurance and overhead task performance.\n  Reference: Conditioning for a 30s overhead shelf-stacking task (upper limb functional endurance). ${notes ? `\n  Notes: ${notes}` : ""}`;
    onSave({ status: "completed", result_value: r, notes, assessment_date: todayLocal(), additional_data: { soap_text: soap, measurement_type: "performance_timed", repetitions: r, duration_s: DURATION, side, weight, classification: interp } });
    toast.success("GST saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-amber-50 to-orange-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Grocery Shelving Test</h2><p className="text-slate-500 text-sm mt-0.5">30-second overhead upper limb endurance</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Protocol</p>
            <p><strong>Setup:</strong> Two shelves at waist height and above head height. 400g tins placed on lower shelf at start.</p>
            <p><strong>Task:</strong> Patient lifts tins from waist shelf to overhead shelf alternating hands (or bilateral) as fast as possible for 30 seconds.</p>
            <p><strong>Record:</strong> Total tins placed on overhead shelf in 30 seconds.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Side</Label>
              <Select value={side} onValueChange={setSide}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="bilateral">Bilateral</SelectItem><SelectItem value="right">Right</SelectItem><SelectItem value="left">Left</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Tin Weight</Label>
              <Select value={weight} onValueChange={setWeight}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="400g">400g (standard)</SelectItem><SelectItem value="500g">500g</SelectItem><SelectItem value="800g">800g</SelectItem><SelectItem value="1kg">1 kg</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Timer</CardTitle></CardHeader>
            <CardContent className="text-center space-y-3">
              <p className="text-5xl font-mono font-bold text-amber-600">{(DURATION - elapsed).toFixed(1)}s</p>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div className="bg-amber-500 h-3 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              {!isRunning ? (
                <Button onClick={start} disabled={elapsed >= DURATION} className="bg-amber-500 hover:bg-amber-600 w-full"><Play className="w-4 h-4 mr-2" />Start 30s Timer</Button>
              ) : (
                <Button onClick={stop} variant="destructive" className="w-full"><Square className="w-4 h-4 mr-2" />Stop</Button>
              )}
            </CardContent>
          </Card>

          <div><Label>Repetitions Completed</Label><Input type="number" min="0" step="1" value={reps} onChange={e => setReps(e.target.value)} placeholder="e.g. 16" className="mt-1" /></div>

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Compensatory patterns, pain, shoulder ROM limitation..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!reps} className="bg-amber-500 hover:bg-amber-600"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}