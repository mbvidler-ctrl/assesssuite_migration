import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, Square, RotateCcw, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

// 6MWT: 6-metre instrumented corridor, 3 trials, middle 2m timed (acceleration/deceleration excluded)
const TRIALS_TARGET = 3;

export default function SixMeterWalkTestRunner({ client, onSave, onClose }) {
  const [timerMs, setTimerMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [trials, setTrials] = useState([]);
  const [notes, setNotes] = useState('');
  const [gaitAids, setGaitAids] = useState('');
  const [footwear, setFootwear] = useState('');
  const [manualTime, setManualTime] = useState('');
  const [testCondition, setTestCondition] = useState('self_selected'); // self_selected | fast
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => setTimerMs(p => p + 10), 10);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const centis = Math.floor((ms % 1000) / 10);
    return `${s}.${centis.toString().padStart(2, '0')}`;
  };

  const handleStartStop = () => {
    if (isRunning) {
      const timeS = parseFloat((timerMs / 1000).toFixed(2));
      const speedMs = parseFloat((6 / timeS).toFixed(3));
      setTrials(prev => [...prev, { time_s: timeS, speed_ms: speedMs }]);
      toast.success(`Trial ${trials.length + 1}: ${timeS}s â€” ${speedMs} m/s`);
      setIsRunning(false);
      setTimerMs(0);
    } else {
      setTimerMs(0);
      setIsRunning(true);
    }
  };

  const handleAddManual = () => {
    const t = parseFloat(manualTime);
    if (!t || t <= 0) { toast.error("Enter a valid time in seconds"); return; }
    const speedMs = parseFloat((6 / t).toFixed(3));
    setTrials(prev => [...prev, { time_s: t, speed_ms: speedMs }]);
    setManualTime('');
    toast.success(`Manual trial added: ${t}s â€” ${speedMs} m/s`);
  };

  const handleRemoveTrial = (idx) => setTrials(prev => prev.filter((_, i) => i !== idx));

  const bestTrial = trials.length > 0 ? trials.reduce((best, t) => t.speed_ms > best.speed_ms ? t : best) : null;
  const avgSpeed = trials.length > 0 ? parseFloat((trials.reduce((s, t) => s + t.speed_ms, 0) / trials.length).toFixed(3)) : null;

  const getInterpretation = (speedMs) => {
    if (speedMs >= 1.2) return { label: 'Community ambulation (fast)', color: 'bg-green-100 text-green-800' };
    if (speedMs >= 0.8) return { label: 'Community ambulation', color: 'bg-green-100 text-green-800' };
    if (speedMs >= 0.6) return { label: 'Limited community ambulation', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Household/limited ambulation â€” increased risk', color: 'bg-red-100 text-red-800' };
  };

  const handleSave = () => {
    if (trials.length === 0) { toast.error("Complete at least one trial."); return; }
    onSave({
      result_value: bestTrial?.speed_ms,
      assessment_date: new Date().toISOString().split('T')[0],
      notes,
      additional_data: {
        soap_text: `â€¢ 6-Metre Walk Test\n  Best Speed: ${bestTrial?.speed_ms} m/s (${bestTrial?.time_s?.toFixed(2)}s)\n  Average Speed: ${avgSpeed} m/s\n  Condition: ${testCondition === 'self_selected' ? 'Self-Selected' : 'Fast Speed'}\n  Interpretation: ${bestTrial ? getInterpretation(bestTrial.speed_ms).label : 'N/A'}${gaitAids ? `\n  Gait Aid: ${gaitAids}` : ''}`,
        measurement_type: '6_meter_walk_test',
        test_condition: testCondition,
        trials,
        best_speed_ms: bestTrial?.speed_ms,
        best_time_s: bestTrial?.time_s,
        average_speed_ms: avgSpeed,
        gait_aids: gaitAids,
        footwear,
        interpretation: bestTrial ? getInterpretation(bestTrial.speed_ms).label : null,
      }
    });
    toast.success("Assessment saved.");
  };

  const interp = bestTrial ? getInterpretation(bestTrial.speed_ms) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-violet-50 to-purple-50 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-slate-900">6-Metre Walk Test</h2>
            <p className="text-sm text-slate-500">Gait speed over 6m â€” multiple trials, best/average recorded</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Protocol */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-blue-800"><Info className="w-4 h-4" />Protocol</CardTitle></CardHeader>
            <CardContent className="text-xs text-blue-800 space-y-1">
              <p>â€¢ Mark a 10m walkway with start and finish lines. The client walks at their usual pace (self-selected) or as fast as safely possible (fast speed).</p>
              <p>â€¢ Time only the middle 6m (allow 2m acceleration and 2m deceleration zones) to minimise acceleration effects.</p>
              <p>â€¢ Conduct 3 trials. Allow at least 1 minute rest between trials.</p>
              <p>â€¢ Record time in seconds over 6m. Speed (m/s) = 6 Ã· time.</p>
              <p className="italic mt-1">References: Bohannon RW (1997). Comfortable and maximum walking speed of adults aged 20â€“79 years. Age Ageing. Graham JE et al. (2008). Walking speed threshold for classifying walking independence. Phys Ther.</p>
            </CardContent>
          </Card>

          {/* Conditions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Test Condition</Label>
              <div className="flex gap-2 mt-1">
                <Button size="sm" variant={testCondition === 'self_selected' ? 'default' : 'outline'} onClick={() => setTestCondition('self_selected')}>Self-Selected</Button>
                <Button size="sm" variant={testCondition === 'fast' ? 'default' : 'outline'} onClick={() => setTestCondition('fast')}>Fast Speed</Button>
              </div>
            </div>
            <div>
              <Label className="text-sm">Gait Aid Used</Label>
              <Input value={gaitAids} onChange={e => setGaitAids(e.target.value)} placeholder="None / cane / walker..." className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-sm">Footwear</Label>
            <Input value={footwear} onChange={e => setFootwear(e.target.value)} placeholder="e.g. standard shoes, bare feet..." className="mt-1" />
          </div>

          {/* Timer */}
          <Card className="border-2 border-slate-200">
            <CardContent className="pt-4 text-center">
              <div className="text-6xl font-bold font-mono text-violet-600 mb-1">{formatTime(timerMs)}</div>
              <p className="text-sm text-slate-500 mb-4">Trial {trials.length + 1} of {TRIALS_TARGET}</p>
              <div className="flex justify-center gap-3">
                <Button onClick={handleStartStop} variant={isRunning ? 'destructive' : 'default'} size="lg">
                  {isRunning ? <><Square className="w-5 h-5 mr-2" />Stop & Record</> : <><Play className="w-5 h-5 mr-2" />Start Timer</>}
                </Button>
                <Button onClick={() => { setIsRunning(false); setTimerMs(0); }} variant="outline" size="lg" disabled={isRunning}>
                  <RotateCcw className="w-4 h-4 mr-2" />Reset
                </Button>
              </div>
              <div className="mt-4 pt-3 border-t flex items-end gap-2 justify-center">
                <div>
                  <Label className="text-xs text-slate-500">Manual time (s)</Label>
                  <Input type="number" step="0.01" value={manualTime} onChange={e => setManualTime(e.target.value)} placeholder="e.g. 4.82" className="mt-1 w-28" />
                </div>
                <Button variant="outline" size="sm" onClick={handleAddManual}>Add</Button>
              </div>
            </CardContent>
          </Card>

          {/* Trials */}
          {trials.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Trials Recorded</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1 mb-3">
                  {trials.map((t, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                      <span className="text-slate-600">Trial {i + 1}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono">{t.time_s.toFixed(2)}s</span>
                        <span className="font-mono font-semibold text-violet-700">{t.speed_ms} m/s</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-600" onClick={() => handleRemoveTrial(i)}><X className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
                {bestTrial && (
                  <div className="pt-3 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Best Speed:</span>
                      <span className="font-bold text-violet-700 text-lg">{bestTrial.speed_ms} m/s</span>
                    </div>
                    {avgSpeed && <div className="flex justify-between text-sm"><span className="text-slate-500">Average Speed:</span><span className="font-semibold">{avgSpeed} m/s</span></div>}
                    {interp && <div className={`rounded px-3 py-2 text-xs font-medium ${interp.color}`}>{interp.label}</div>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <div>
            <Label className="text-sm">Clinical Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Gait quality, balance, pain, client effort, deviations from protocol..." rows={3} className="mt-1" />
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={trials.length === 0} className="bg-violet-600 hover:bg-violet-700">
            <Save className="w-4 h-4 mr-2" />Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}