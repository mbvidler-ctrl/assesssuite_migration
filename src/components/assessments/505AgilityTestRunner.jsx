import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, Square, RotateCcw, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const TURN_DIRECTIONS = ['Left', 'Right'];

export default function FiveOFiveAgilityTestRunner({ client, onSave, onClose }) {
  const [timerMs, setTimerMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [trials, setTrials] = useState([]);
  const [currentDirection, setCurrentDirection] = useState('Left');
  const [dominantLeg, setDominantLeg] = useState('Right');
  const [notes, setNotes] = useState('');
  const [manualTime, setManualTime] = useState('');
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
      // Stop and record
      const time = parseFloat((timerMs / 1000).toFixed(2));
      setTrials(prev => [...prev, { time, direction: currentDirection }]);
      toast.success(`Trial recorded: ${time}s (Turn ${currentDirection})`);
      setIsRunning(false);
      setTimerMs(0);
    } else {
      setTimerMs(0);
      setIsRunning(true);
    }
  };

  const handleAddManual = () => {
    const t = parseFloat(manualTime);
    if (!t || t <= 0) { toast.error("Enter a valid time"); return; }
    setTrials(prev => [...prev, { time: t, direction: currentDirection }]);
    setManualTime('');
    toast.success(`Manual trial added: ${t}s`);
  };

  const handleRemoveTrial = (idx) => setTrials(prev => prev.filter((_, i) => i !== idx));

  const leftTrials = trials.filter(t => t.direction === 'Left');
  const rightTrials = trials.filter(t => t.direction === 'Right');
  const bestLeft = leftTrials.length > 0 ? Math.min(...leftTrials.map(t => t.time)) : null;
  const bestRight = rightTrials.length > 0 ? Math.min(...rightTrials.map(t => t.time)) : null;
  const bestOverall = trials.length > 0 ? Math.min(...trials.map(t => t.time)) : null;
  const asymmetry = bestLeft && bestRight ? Math.abs(bestLeft - bestRight).toFixed(2) : null;

  const handleSave = () => {
    if (trials.length === 0) { toast.error("Complete at least one trial."); return; }
    let soapText = `• 505 Agility Test:\n`;
    soapText += `  Best Overall Time: ${bestOverall}s | Dominant Leg: ${dominantLeg}\n`;
    if (bestLeft !== null) soapText += `  Best Left Turn: ${bestLeft.toFixed(2)}s\n`;
    if (bestRight !== null) soapText += `  Best Right Turn: ${bestRight.toFixed(2)}s\n`;
    if (asymmetry !== null) soapText += `  L/R Asymmetry: ${asymmetry}s${parseFloat(asymmetry) > 0.1 ? ' (clinically significant >0.1s)' : ''}\n`;
    soapText += `\n  All Trials:\n`;
    trials.forEach((t, i) => { soapText += `    Trial ${i+1} (Turn ${t.direction}): ${t.time.toFixed(2)}s\n`; });
    if (notes.trim()) soapText += `\n  Clinical Notes: ${notes}`;
    onSave({
      result_value: bestOverall,
      assessment_date: todayLocal(),
      notes: soapText,
      additional_data: {
        measurement_type: '505_agility_test',
        trials,
        best_time_overall: bestOverall,
        best_time_left: bestLeft,
        best_time_right: bestRight,
        asymmetry_seconds: asymmetry ? parseFloat(asymmetry) : null,
        dominant_leg: dominantLeg,
        total_trials: trials.length,
        soap_text: soapText,
      }
    });
    toast.success("Assessment recorded — please confirm and save.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-orange-50 to-amber-50 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-slate-900">505 Agility Test</h2>
            <p className="text-sm text-slate-500">Change-of-direction speed — 10m run + 180° turn</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Clinician Instructions */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 space-y-2">
            <p className="font-semibold">📋 Standardised Administration Instructions</p>
            <p><strong>Warm-up:</strong> 5–10 min general warm-up including dynamic stretching and 2–3 practice trials at submaximal effort.</p>
            <p className="italic">"Sprint from the start line through the 10m gate, continue to the turning line 5m ahead, turn as fast as you can, and sprint back through the 10m gate. Your time is only measured between the two passes through the 10m gate. Turn on your [left/right] foot."</p>
            <p><strong>Rest:</strong> 3–5 minutes between trials. 2–3 recorded trials per direction. Record best time for each direction.</p>
            <p><strong>Footwear:</strong> Document footwear and surface as these significantly affect scores.</p>
          </div>

          {/* Norms & Interpretation */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 Norms & Interpretation (seconds)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Level</th><th className="p-2 text-center">Men</th><th className="p-2 text-center">Women</th></tr></thead>
                <tbody>
                  <tr className="border-t border-slate-200"><td className="p-2">Excellent (elite team sport)</td><td className="p-2 text-center">&lt;2.10 s</td><td className="p-2 text-center">&lt;2.40 s</td></tr>
                  <tr className="border-t border-slate-200 bg-white"><td className="p-2">Good (sub-elite)</td><td className="p-2 text-center">2.10–2.35 s</td><td className="p-2 text-center">2.40–2.60 s</td></tr>
                  <tr className="border-t border-slate-200"><td className="p-2">Average (recreational)</td><td className="p-2 text-center">2.35–2.60 s</td><td className="p-2 text-center">2.60–2.80 s</td></tr>
                  <tr className="border-t border-slate-200 bg-white"><td className="p-2">Below average</td><td className="p-2 text-center">&gt;2.60 s</td><td className="p-2 text-center">&gt;2.80 s</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">L/R asymmetry &gt;0.1 s may indicate neuromuscular imbalance or previous injury affecting change-of-direction mechanics. Source: Brughelli et al. (2008).</p>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Draper JA & Lancaster MG. (1985). The 505 test: a test for agility in the horizontal plane. <em>Australian Journal of Science and Medicine in Sport, 17</em>(1), 15–18.</p>
            <p>Brughelli M et al. (2008). Understanding change of direction ability in sport. <em>Sports Medicine, 38</em>(12), 1045–1063.</p>
          </div>

          {/* Instructions */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-blue-800"><Info className="w-4 h-4" />Protocol</CardTitle></CardHeader>
            <CardContent className="text-xs text-blue-800 space-y-1">
              <p>• Set up two timing gates 10m apart, with a turning line 5m past the first gate.</p>
              <p>• Client starts 0.3m behind the start gate, runs forward through the 10m gate, continues 5m to the turning line, performs a 180° turn, and sprints back through the 10m gate.</p>
              <p>• Time is measured between the two passes through the 10m gate.</p>
              <p>• Test both left and right turns separately. Allow 3–5 minutes rest between trials.</p>
              <p>• Typically 2–3 trials per direction; record the best time.</p>
            </CardContent>
          </Card>

          {/* Setup */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Dominant Leg</Label>
              <div className="flex gap-2 mt-1">
                {['Left', 'Right'].map(side => (
                  <Button key={side} variant={dominantLeg === side ? 'default' : 'outline'} size="sm" onClick={() => setDominantLeg(side)}>{side}</Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm">Turn Direction (current trial)</Label>
              <div className="flex gap-2 mt-1">
                {TURN_DIRECTIONS.map(dir => (
                  <Button key={dir} variant={currentDirection === dir ? 'default' : 'outline'} size="sm" onClick={() => setCurrentDirection(dir)} disabled={isRunning}>{dir}</Button>
                ))}
              </div>
            </div>
          </div>

          {/* Timer */}
          <Card className="border-2 border-slate-200">
            <CardContent className="pt-4 text-center">
              <div className="text-7xl font-bold font-mono text-orange-500 mb-2">{formatTime(timerMs)}</div>
              <p className="text-sm text-slate-500 mb-4">Turn Direction: <strong>{currentDirection}</strong></p>
              <div className="flex justify-center gap-3">
                <Button onClick={handleStartStop} variant={isRunning ? 'destructive' : 'default'} size="lg">
                  {isRunning ? <><Square className="w-5 h-5 mr-2" />Stop & Record</> : <><Play className="w-5 h-5 mr-2" />Start Timer</>}
                </Button>
                <Button onClick={() => { setIsRunning(false); setTimerMs(0); }} variant="outline" size="lg" disabled={isRunning}>
                  <RotateCcw className="w-4 h-4 mr-2" />Reset
                </Button>
              </div>
              {/* Manual entry */}
              <div className="mt-4 pt-3 border-t flex items-end gap-2 justify-center">
                <div>
                  <Label className="text-xs text-slate-500">Manual time (s)</Label>
                  <Input type="number" step="0.01" value={manualTime} onChange={e => setManualTime(e.target.value)} placeholder="e.g. 2.45" className="mt-1 w-28" />
                </div>
                <Button variant="outline" size="sm" onClick={handleAddManual}>Add</Button>
              </div>
            </CardContent>
          </Card>

          {/* Trials recorded */}
          {trials.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Trials Recorded</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {trials.map((t, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                      <span className="text-slate-600">Trial {i + 1} — Turn {t.direction}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{t.time.toFixed(2)}s</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-600" onClick={() => handleRemoveTrial(i)}><X className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-3 text-center text-sm">
                  {bestLeft !== null && <div><p className="text-xs text-slate-500">Best Left Turn</p><p className="font-bold text-lg">{bestLeft.toFixed(2)}s</p></div>}
                  {bestRight !== null && <div><p className="text-xs text-slate-500">Best Right Turn</p><p className="font-bold text-lg">{bestRight.toFixed(2)}s</p></div>}
                  {asymmetry !== null && (
                    <div>
                      <p className="text-xs text-slate-500">L/R Difference</p>
                      <p className={`font-bold text-lg ${parseFloat(asymmetry) > 0.1 ? 'text-amber-600' : 'text-green-600'}`}>{asymmetry}s</p>
                    </div>
                  )}
                </div>
                {asymmetry && parseFloat(asymmetry) > 0.1 && (
                  <p className="text-xs text-amber-700 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Asymmetry &gt;0.1s between directions — consider clinical follow-up.</p>
                )}
              </CardContent>
            </Card>
          )}

          <div>
            <Label className="text-sm">Clinical Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Technique observations, hesitation at turn, any pain, footwear, surface conditions, recommendations..." rows={3} className="mt-1" />
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={trials.length === 0} className="bg-orange-600 hover:bg-orange-700">
            <Save className="w-4 h-4 mr-2" />Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}