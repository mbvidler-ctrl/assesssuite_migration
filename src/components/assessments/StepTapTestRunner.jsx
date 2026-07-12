import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Play, Square, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// Step Tap Test: count alternating foot taps on step in set time (15s or 30s)
// Normative data from Lord et al. (senior balance tests)

export default function StepTapTestRunner({ client, onSave, onClose }) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(15);
  const [reps, setReps] = useState("");
  const [stepHeight, setStepHeight] = useState("7.5");
  const [notes, setNotes] = useState("");
  const intervalRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const start = () => {
    setElapsed(0);
    setIsRunning(true);
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const e = (Date.now() - startRef.current) / 1000;
      if (e >= duration) {
        clearInterval(intervalRef.current);
        setElapsed(duration);
        setIsRunning(false);
        toast.info(`${duration} seconds complete`);
      } else {
        setElapsed(e);
      }
    }, 100);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
  };

  const r = parseInt(reps);
  const rate = !isNaN(r) && r > 0 ? (r / duration).toFixed(2) : null;

  const handleSave = () => {
    if (!reps || isNaN(r) || r < 0) { toast.error("Enter taps completed"); return; }
    const soap = `• Step Tap Test\n  Taps: ${r} in ${duration}s\n  Rate: ${rate} taps/sec\n  Step Height: ${stepHeight} cm${notes ? `\n  Notes: ${notes}` : ""}\n  Assesses lower limb agility, coordination, and dynamic balance\n  Reference: Lord SR et al. (2003). Balance, reaction time, and falls in older people. J Am Geriatr Soc.`;
    onSave({ status: "completed", result_value: r, notes, assessment_date: todayLocal(), additional_data: { soap_text: soap, measurement_type: "performance_timed", taps: r, duration_s: duration, rate_per_sec: parseFloat(rate), step_height_cm: parseFloat(stepHeight) } });
    toast.success("Step Tap Test saved.");
  };

  const remaining = Math.max(0, duration - elapsed);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-cyan-50 to-blue-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Step Tap Test</h2><p className="text-slate-500 text-sm mt-0.5">Alternating foot tap — agility & coordination</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Protocol</p>
            <p><strong>Setup:</strong> Patient stands in front of a step (7.5cm standard).</p>
            <p><strong>Task:</strong> Alternately tap each foot on top of the step as quickly as possible for the set duration. Each tap counts as one.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Duration (seconds)</Label>
              <div className="flex gap-2 mt-1">
                <Button size="sm" variant={duration === 15 ? "default" : "outline"} onClick={() => setDuration(15)}>15s</Button>
                <Button size="sm" variant={duration === 30 ? "default" : "outline"} onClick={() => setDuration(30)}>30s</Button>
              </div>
            </div>
            <div><Label>Step Height (cm)</Label><Input type="number" step="0.5" value={stepHeight} onChange={e => setStepHeight(e.target.value)} className="mt-1" /></div>
          </div>

          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <p className="text-5xl font-mono font-bold text-cyan-600">{remaining.toFixed(1)}s</p>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div className="bg-cyan-500 h-3 rounded-full transition-all" style={{ width: `${((duration - remaining) / duration) * 100}%` }} />
              </div>
              {!isRunning ? (
                <Button onClick={start} disabled={elapsed >= duration && elapsed > 0} className="bg-cyan-600 hover:bg-cyan-700 w-full"><Play className="w-4 h-4 mr-2" />Start {duration}s Timer</Button>
              ) : (
                <Button onClick={stop} variant="destructive" className="w-full"><Square className="w-4 h-4 mr-2" />Stop Early</Button>
              )}
            </CardContent>
          </Card>

          <div><Label>Total Taps Completed</Label><Input type="number" min="0" step="1" value={reps} onChange={e => setReps(e.target.value)} placeholder="e.g. 22" className="mt-1" />
            {rate && <p className="text-sm text-cyan-600 font-medium mt-1">Rate: {rate} taps/sec</p>}
          </div>

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Balance, asymmetry, footwear, assistive device..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!reps} className="bg-cyan-600 hover:bg-cyan-700"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}