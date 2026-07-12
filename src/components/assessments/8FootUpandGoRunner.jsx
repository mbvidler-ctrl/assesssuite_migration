import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, Square, RotateCcw, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function EightFootUpandGoRunner({ client, onSave, onClose }) {
  const [timerMs, setTimerMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [trials, setTrials] = useState([]);
  const [notes, setNotes] = useState('');
  const [chairHeight, setChairHeight] = useState('standard'); // standard | high | low
  const [assistanceUsed, setAssistanceUsed] = useState('none'); // none | arm_rest | hand_held
  const [footwear, setFootwear] = useState('');
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
      setTrials(prev => [...prev, { time_s: timeS }]);
      toast.success(`Trial ${trials.length + 1}: ${timeS}s`);
      setIsRunning(false);
      setTimerMs(0);
    } else {
      setTimerMs(0);
      setIsRunning(true);
    }
  };

  const handleRemoveTrial = (idx) => setTrials(prev => prev.filter((_, i) => i !== idx));

  const bestTrial = trials.length > 0 ? trials.reduce((best, t) => t.time_s < best.time_s ? t : best) : null;

  const getInterpretation = (timeS) => {
    if (timeS <= 8.1) return { label: 'Low fall risk', color: 'bg-green-100 text-green-800' };
    if (timeS <= 9.2) return { label: 'Moderate fall risk', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'High fall risk — increased mobility limitations', color: 'bg-red-100 text-red-800' };
  };

  const handleSave = () => {
    if (trials.length === 0) {
      toast.error("Complete at least one trial.");
      return;
    }
    onSave({
      result_value: bestTrial?.time_s,
      assessment_date: todayLocal(),
      notes,
      additional_data: {
        soap_text: `• 8-Foot Up-and-Go Test\n  Best Time: ${bestTrial?.time_s?.toFixed(2)}s\n  Interpretation: ${bestTrial ? getInterpretation(bestTrial.time_s).label : 'N/A'}\n  Chair Height: ${chairHeight} | Assistance: ${assistanceUsed}`,
        measurement_type: '8_foot_up_and_go',
        trials,
        best_time_s: bestTrial?.time_s,
        chair_height: chairHeight,
        assistance_used: assistanceUsed,
        footwear,
        interpretation: bestTrial ? getInterpretation(bestTrial.time_s).label : null,
      }
    });
    toast.success("Assessment saved.");
  };

  const interp = bestTrial ? getInterpretation(bestTrial.time_s) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-cyan-50 to-blue-50 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-slate-900">8-Foot Up-and-Go Test</h2>
            <p className="text-sm text-slate-500">Timed mobility — sit-to-stand, walk 8ft, return, sit down</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Safety */}
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="pt-4 text-xs text-amber-800 space-y-1">
              <p className="font-semibold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Safety — ensure:</p>
              <p>• Clear path 8 feet ahead with no obstacles</p>
              <p>• Sturdy chair against wall to prevent sliding</p>
              <p>• Clinician positioned to provide assistance if needed</p>
              <p>• Proper footwear or bare feet (consistent across trials)</p>
            </CardContent>
          </Card>

          {/* Protocol */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-blue-800"><Info className="w-4 h-4" />Protocol</CardTitle></CardHeader>
            <CardContent className="text-xs text-blue-800 space-y-1">
              <p>1. Client sits in chair with back straight, feet flat, hands on thighs</p>
              <p>2. Demonstrate test at 50% speed — client practices once</p>
              <p>3. On 'GO': client stands, walks 8 feet (2.44m), around cone, returns, sits</p>
              <p>4. Time: from GO until buttocks touch chair</p>
              <p>5. Perform 2 trials, rest 1 min between trials</p>
              <p>6. Record best (fastest) time</p>
            </CardContent>
          </Card>

          {/* Test conditions */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-sm">Chair Height</Label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {['standard', 'high', 'low'].map(type => (
                  <Button
                    key={type}
                    size="sm"
                    variant={chairHeight === type ? 'default' : 'outline'}
                    onClick={() => setChairHeight(type)}
                    className="text-xs"
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm">Assistance</Label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {['none', 'arm_rest', 'hand_held'].map(type => (
                  <Button
                    key={type}
                    size="sm"
                    variant={assistanceUsed === type ? 'default' : 'outline'}
                    onClick={() => setAssistanceUsed(type)}
                    className="text-xs"
                  >
                    {type === 'arm_rest' ? 'Arm Rest' : type === 'hand_held' ? 'Hand Held' : 'None'}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm">Footwear</Label>
              <input
                type="text"
                value={footwear}
                onChange={e => setFootwear(e.target.value)}
                placeholder="Shoes/Bare..."
                className="mt-1 w-full px-2 py-1.5 text-xs border rounded"
              />
            </div>
          </div>

          {/* Timer */}
          <Card className="border-2 border-slate-200">
            <CardContent className="pt-4 text-center">
              <div className="text-6xl font-bold font-mono text-cyan-600 mb-1">{formatTime(timerMs)}</div>
              <p className="text-sm text-slate-500 mb-4">Trial {trials.length + 1} of 2</p>
              <div className="flex justify-center gap-3">
                <Button onClick={handleStartStop} variant={isRunning ? 'destructive' : 'default'} size="lg">
                  {isRunning ? <><Square className="w-5 h-5 mr-2" />Stop & Record</> : <><Play className="w-5 h-5 mr-2" />Start Timer</>}
                </Button>
                <Button onClick={() => { setIsRunning(false); setTimerMs(0); }} variant="outline" size="lg" disabled={isRunning}>
                  <RotateCcw className="w-4 h-4 mr-2" />Reset
                </Button>
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
                        <span className="font-mono font-semibold text-cyan-700">{t.time_s.toFixed(2)}s</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-600" onClick={() => handleRemoveTrial(i)}><X className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
                {bestTrial && (
                  <div className="pt-3 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Best Time:</span>
                      <span className="font-bold text-cyan-700 text-lg">{bestTrial.time_s.toFixed(2)}s</span>
                    </div>
                    {interp && <div className={`rounded px-3 py-2 text-xs font-medium ${interp.color}`}>{interp.label}</div>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Norms & Interpretation */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 Norms & Interpretation (Rikli & Jones — older adults)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Time</th><th className="p-2 text-left">Classification</th><th className="p-2 text-left">Fall Risk</th></tr></thead>
                <tbody>
                  <tr className="border-t border-slate-200"><td className="p-2">≤ 8.1 s</td><td className="p-2">Normal / Low concern</td><td className="p-2 text-green-600">Low</td></tr>
                  <tr className="border-t border-slate-200 bg-white"><td className="p-2">8.2–9.2 s</td><td className="p-2">Borderline</td><td className="p-2 text-yellow-600">Moderate</td></tr>
                  <tr className="border-t border-slate-200"><td className="p-2">≥ 9.3 s</td><td className="p-2">Mobility limitation</td><td className="p-2 text-red-600">High</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">MCID: 0.67 s. Community-dwelling older adults aged 60–94. Best of 2 trials used. Source: Rikli & Jones (2013).</p>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Rikli RE & Jones CJ. (1999). Development and validation of a functional fitness test for community-residing older adults. <em>Journal of Aging and Physical Activity, 7</em>(2), 129–161.</p>
            <p>Podsiadlo D & Richardson S. (1991). The Timed "Up & Go": a test of basic functional mobility for frail elderly persons. <em>Journal of the American Geriatrics Society, 39</em>(2), 142–148.</p>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm">Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Balance, hesitation, tremor, use of arms, stumbling, gait quality, pain reported..."
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={trials.length === 0} className="bg-cyan-600 hover:bg-cyan-700">
            <Save className="w-4 h-4 mr-2" />Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}