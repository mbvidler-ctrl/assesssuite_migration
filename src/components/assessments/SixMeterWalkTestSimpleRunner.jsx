import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Play, Square, Trash2, Info } from "lucide-react";
import { toast } from "sonner";

export default function SixMeterWalkTestSimpleRunner({ client, onSave, onClose }) {
  const [trials, setTrials] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [assistiveDevice, setAssistiveDevice] = useState("none");
  const [notes, setNotes] = useState("");
  const intervalRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const start = () => {
    startRef.current = Date.now();
    setElapsed(0);
    setIsRunning(true);
    intervalRef.current = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 50);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    const t = (Date.now() - startRef.current) / 1000;
    const speed = 6 / t;
    setTrials(prev => [...prev, { time: parseFloat(t.toFixed(2)), speed: parseFloat(speed.toFixed(3)) }]);
    setElapsed(0);
  };

  const avgSpeed = trials.length > 0 ? (trials.reduce((s, t) => s + t.speed, 0) / trials.length) : 0;

  const getInterp = (s) => {
    if (s >= 1.0) return { label: "Community Ambulator â€” Normal", color: "bg-green-100 text-green-800 border-green-300" };
    if (s >= 0.8) return { label: "Limited Community Ambulator", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
    if (s >= 0.4) return { label: "Household Ambulator", color: "bg-orange-100 text-orange-800 border-orange-300" };
    return { label: "Non-functional Ambulator â€” High Fall Risk", color: "bg-red-100 text-red-800 border-red-300" };
  };

  const interp = trials.length > 0 ? getInterp(avgSpeed) : null;

  const handleSave = () => {
    const avg = avgSpeed.toFixed(3);
    const trialLines = trials.map((t, i) => `  Trial ${i + 1}: ${t.time}s â†’ ${t.speed} m/s`).join("\n");
    const soap = `â€¢ 6-Metre Walk Test\n  Average Speed: ${avg} m/s â€” ${interp?.label}\n  Trials:\n${trialLines}${assistiveDevice !== "none" ? `\n  Assistive Device: ${assistiveDevice}` : ""}${notes ? `\n  Notes: ${notes}` : ""}\n  Reference: â‰¥1.0 m/s community ambulation | 0.8â€“0.99 limited | <0.8 household/non-functional`;
    onSave({ result_value: parseFloat(avg), notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "6_meter_walk_test", average_speed_ms: parseFloat(avg), trials, assistive_device: assistiveDevice, interpretation: interp?.label } });
    toast.success("Saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-violet-50 to-purple-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">6-Metre Walk Test</h2><p className="text-slate-500 text-sm mt-0.5">Gait speed assessment</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Protocol</p>
            <p><strong>Setup:</strong> 10 m walkway â€” 2 m acceleration, 6 m timed, 2 m deceleration. Mark start/end of 6 m zone.</p>
            <p><strong>Instruction:</strong> "Walk at your usual comfortable pace until I tell you to stop."</p>
            <p><strong>Timing:</strong> Start timer as first foot crosses start line; stop as first foot crosses end line.</p>
            <p><strong>Trials:</strong> 2â€“3 trials, rest 2 min between. Report average speed (m/s).</p>
          </div>

          <div>
            <Label>Assistive Device</Label>
            <Select value={assistiveDevice} onValueChange={setAssistiveDevice}>
              <SelectTrigger className="w-64 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="cane">Cane</SelectItem>
                <SelectItem value="quad_cane">Quad Cane</SelectItem>
                <SelectItem value="walker">Walker</SelectItem>
                <SelectItem value="rollator">Rollator</SelectItem>
                <SelectItem value="crutches">Crutches</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-slate-50 border rounded-xl p-5 text-center space-y-3">
            <p className="text-5xl font-mono font-bold text-violet-600">{isRunning ? elapsed.toFixed(2) : "0.00"}s</p>
            {!isRunning ? (
              <Button onClick={start} size="lg" className="bg-violet-600 hover:bg-violet-700 w-full max-w-xs"><Play className="w-4 h-4 mr-2" />Start Trial {trials.length + 1}</Button>
            ) : (
              <Button onClick={stop} size="lg" variant="destructive" className="w-full max-w-xs"><Square className="w-4 h-4 mr-2" />Stop & Record</Button>
            )}
          </div>

          {trials.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Recorded Trials</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {trials.map((t, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg">
                    <span className="text-sm">Trial {i + 1}: <span className="font-mono font-bold">{t.time}s</span> â†’ <span className="text-violet-700 font-bold">{t.speed} m/s</span></span>
                    <Button variant="ghost" size="icon" onClick={() => setTrials(trials.filter((_, x) => x !== i))}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                  </div>
                ))}
                <div className="pt-2 border-t font-semibold text-center text-violet-700">Average: {avgSpeed.toFixed(3)} m/s</div>
              </CardContent>
            </Card>
          )}

          {interp && (
            <div className={`border rounded-xl p-4 text-center font-semibold text-lg ${interp.color}`}>
              {interp.label}
              <p className="text-xs font-normal mt-1">â‰¥1.0 community | 0.8â€“1.0 limited | 0.4â€“0.8 household | &lt;0.4 non-functional</p>
            </div>
          )}

          <div>
            <Label>Clinical Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Gait deviations, pain, balance concerns..." rows={3} className="mt-1" />
          </div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-violet-600 hover:bg-violet-700"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}