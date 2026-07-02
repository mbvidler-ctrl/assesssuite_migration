import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Play, Square, Info } from "lucide-react";
import { toast } from "sonner";

export default function StairClimbTestRunner({ client, onSave, onClose }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [recorded, setRecorded] = useState(null);
  const [stairCount, setStairCount] = useState("10");
  const [handrailUse, setHandrailUse] = useState(false);
  const [gaitStability, setGaitStability] = useState("stable");
  const [assistiveDevice, setAssistiveDevice] = useState("none");
  const [notes, setNotes] = useState("");
  const startRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const start = () => {
    startRef.current = Date.now();
    setElapsed(0);
    setRunning(true);
    intervalRef.current = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 50);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    const t = parseFloat(((Date.now() - startRef.current) / 1000).toFixed(2));
    setElapsed(t);
    setRecorded(t);
    setRunning(false);
    toast.success(`Time recorded: ${t}s`);
  };

  const handleSave = () => {
    const soap = `â€¢ Stair Climb Test\n  Stairs: ${stairCount} steps | Time: ${recorded}s | Handrail: ${handrailUse ? "Yes" : "No"} | Gait: ${gaitStability} | Device: ${assistiveDevice}${notes ? `\n  Notes: ${notes}` : ""}`;
    onSave({ status: "completed", result_value: recorded, notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "stair_climb_test", time_seconds: recorded, stair_count: parseInt(stairCount) || null, handrail_use: handrailUse, gait_stability: gaitStability, assistive_device: assistiveDevice } });
    toast.success("Saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-teal-50 to-cyan-50 flex justify-between items-start">
          <div><h2 className="text-xl font-bold text-slate-900">Stair Climb Test</h2><p className="text-slate-500 text-sm mt-0.5">Timed stair ascent â€” functional mobility</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />ðŸ“‹ Protocol & Administration</p>
            <p><strong>Standard:</strong> 10â€“12 stairs. Start time on "Go" (or when foot leaves floor). Stop when both feet reach the top step.</p>
            <p className="italic">"Climb the stairs as quickly as you safely can. I'll time you from start until both feet are at the top."</p>
            <p><strong>Safety:</strong> Stand close for assistance. Allow handrail use â€” document if used. Note step-over-step vs. step-to-step pattern.</p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-semibold text-slate-700">ðŸ“Š Norms â€” 10-Step Stair Climb (seconds)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Time</th><th className="p-2 text-left">Interpretation</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">&lt;6 s</td><td className="p-2 text-green-700">Excellent â€” independent, low fall risk</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">6â€“10 s</td><td className="p-2 text-yellow-700">Moderate â€” minor limitations</td></tr>
                  <tr className="border-t"><td className="p-2">&gt;10 s</td><td className="p-2 text-red-700">Slow â€” increased fall risk, requires monitoring</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">Norms vary by age, stair configuration, and population. Source: Bohannon et al. (1996).</p>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">ðŸ“– Reference</p>
            <p>Bohannon RW. (1996). Stair timed up and go test. <em>Archives of Physical Medicine and Rehabilitation, 78</em>(9), 1046.</p>
            <p>Nightingale EJ et al. (2014). Normative values of knee muscle strength and functional performance measures in adults aged 55â€“85 years. <em>Clinical Rehabilitation, 28</em>(10), 995â€“1008.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Number of Steps</Label><Input type="number" value={stairCount} onChange={e => setStairCount(e.target.value)} className="mt-1" placeholder="e.g. 10" /></div>
            <div><Label>Assistive Device</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {["none", "cane", "frame"].map(d => (
                  <Button key={d} size="sm" variant={assistiveDevice === d ? "default" : "outline"} onClick={() => setAssistiveDevice(d)} className="capitalize">{d}</Button>
                ))}
              </div>
            </div>
          </div>

          <Card className={running ? "border-red-300 bg-red-50" : recorded ? "border-green-300 bg-green-50" : "border-slate-200"}>
            <CardContent className="pt-5 pb-4 text-center space-y-3">
              <div className="text-6xl font-mono font-bold text-slate-800">{elapsed.toFixed(2)}s</div>
              <div className="flex justify-center gap-3">
                {!running ? (
                  <Button size="lg" onClick={start} className="bg-green-600 hover:bg-green-700 px-8"><Play className="w-5 h-5 mr-2" />Start</Button>
                ) : (
                  <Button size="lg" variant="destructive" onClick={stop} className="px-8"><Square className="w-5 h-5 mr-2" />Stop</Button>
                )}
              </div>
              {recorded && !running && <p className="text-green-700 font-semibold text-sm">Recorded: {recorded}s</p>}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Handrail Use</Label>
              <div className="flex gap-2 mt-1">
                <Button size="sm" variant={!handrailUse ? "default" : "outline"} onClick={() => setHandrailUse(false)}>No</Button>
                <Button size="sm" variant={handrailUse ? "default" : "outline"} onClick={() => setHandrailUse(true)}>Yes</Button>
              </div>
            </div>
            <div>
              <Label>Gait Stability</Label>
              <div className="flex gap-2 mt-1">
                {["stable", "cautious", "unstable"].map(g => (
                  <Button key={g} size="sm" variant={gaitStability === g ? "default" : "outline"} onClick={() => setGaitStability(g)} className="capitalize">{g}</Button>
                ))}
              </div>
            </div>
          </div>

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Compensations, pain, safety, step pattern..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-teal-600 hover:bg-teal-700"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}