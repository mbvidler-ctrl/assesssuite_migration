import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, Pause, RotateCcw, AlertTriangle, Flag } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// 400m = 10 laps of a 40m course (standard protocol)
const LAP_DISTANCE_M = 40;
const TOTAL_LAPS = 10;

export default function FourHundredMeterWalkTestRunner({ client, assessment, onSave, onClose }) {
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [testStarted, setTestStarted] = useState(false);
  const [testComplete, setTestComplete] = useState(false);
  const [laps, setLaps] = useState([]);
  const [restBreaks, setRestBreaks] = useState([]);
  const [preHR, setPreHR] = useState('');
  const [preBP, setPreBP] = useState('');
  const [preSpO2, setPreSpO2] = useState('');
  const [postHR, setPostHR] = useState('');
  const [postBP, setPostBP] = useState('');
  const [postSpO2, setPostSpO2] = useState('');
  const [gaitObservations, setGaitObservations] = useState('');
  const [symptomsObserved, setSymptomsObserved] = useState('');
  const [clinicianNotes, setClinicianNotes] = useState('');
  const [stoppedEarly, setStoppedEarly] = useState(false);
  const [stopsReason, setStopsReason] = useState('');
  const [manualTotalTime, setManualTotalTime] = useState('');
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => setTimerSeconds(p => parseFloat((p + 0.1).toFixed(1))), 100);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const tenths = Math.round((s % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
  };

  const handleStart = () => {
    setTestStarted(true);
    setIsRunning(true);
  };

  const handleLap = () => {
    if (!isRunning) return;
    const lapTime = timerSeconds;
    const prevLapTime = laps.length > 0 ? laps[laps.length - 1].cumulative : 0;
    const splitTime = lapTime - prevLapTime;
    const newLaps = [...laps, { lap: laps.length + 1, cumulative: lapTime, split: splitTime }];
    setLaps(newLaps);
    toast.success(`Lap ${newLaps.length} recorded — ${LAP_DISTANCE_M * newLaps.length}m`);
    if (newLaps.length >= TOTAL_LAPS) {
      setIsRunning(false);
      setTestComplete(true);
      toast.success("400 metres completed!");
    }
  };

  const handleRestBreak = () => {
    setRestBreaks(prev => [...prev, { at_time: timerSeconds, at_metres: laps.length * LAP_DISTANCE_M }]);
    toast("Rest break recorded at " + formatTime(timerSeconds));
  };

  const handleStopEarly = () => {
    setIsRunning(false);
    setStoppedEarly(true);
    setTestComplete(true);
  };

  const handleSave = () => {
    const totalTime = testComplete ? (laps.length > 0 ? laps[laps.length - 1].cumulative : timerSeconds) : parseFloat(manualTotalTime) || timerSeconds;
    const distanceCovered = stoppedEarly ? laps.length * LAP_DISTANCE_M : 400;

    // Build detailed SOAP text including all lap splits
    const lapLines = laps.length > 0
      ? laps.map(l => `    Lap ${l.lap} (${l.lap * LAP_DISTANCE_M}m): split ${formatTime(l.split)} | cumulative ${formatTime(l.cumulative)}`).join('\n')
      : null;

    const restLines = restBreaks.length > 0
      ? restBreaks.map((r, i) => `    Break ${i + 1}: at ${r.at_metres}m (${formatTime(r.at_time)})`).join('\n')
      : null;

    const soapLines = [
      `• 400-Metre Walk Test`,
      `  Total Time: ${formatTime(totalTime)} (${totalTime.toFixed(1)}s)`,
      `  Distance Covered: ${distanceCovered}m`,
      `  Test Completed: ${!stoppedEarly ? 'Yes' : `No — ${stopsReason || 'stopped early'}`}`,
      lapLines ? `  Lap Splits (${laps.length} laps):\n${lapLines}` : null,
      restBreaks.length > 0 ? `  Rest Breaks: ${restBreaks.length}\n${restLines}` : `  Rest Breaks: 0`,
      (preHR || preBP || preSpO2) ? `  Pre-Test: HR ${preHR || 'N/A'} bpm | BP ${preBP || 'N/A'} | SpO2 ${preSpO2 || 'N/A'}%` : null,
      (postHR || postBP || postSpO2) ? `  Post-Test: HR ${postHR || 'N/A'} bpm | BP ${postBP || 'N/A'} | SpO2 ${postSpO2 || 'N/A'}%` : null,
      gaitObservations ? `  Gait Observations: ${gaitObservations}` : null,
      symptomsObserved ? `  Symptoms: ${symptomsObserved}` : null,
      clinicianNotes ? `  Clinical Notes: ${clinicianNotes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      status: "completed",
      result_value: parseFloat(totalTime.toFixed(1)),
      assessment_date: todayLocal(),
      notes: clinicianNotes,
      additional_data: {
        soap_text: soapLines,
        measurement_type: '400_meter_walk_test',
        total_time_seconds: totalTime,
        distance_covered_m: distanceCovered,
        completed: !stoppedEarly,
        laps,
        rest_breaks: restBreaks,
        number_of_rests: restBreaks.length,
        stopped_early: stoppedEarly,
        early_stop_reason: stopsReason,
        pre_test: { heart_rate: preHR, blood_pressure: preBP, spo2: preSpO2 },
        post_test: { heart_rate: postHR, blood_pressure: postBP, spo2: postSpO2 },
        gait_observations: gaitObservations,
        symptoms_observed: symptomsObserved,
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b bg-gradient-to-r from-teal-50 to-cyan-50 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-slate-900">400-Metre Walk Test</h2>
            <p className="text-sm text-slate-500">10 × 40m laps — record lap splits, rests, and observations</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Clinician Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
            <p className="font-semibold">📋 Administration Instructions (Simonsick et al. Protocol)</p>
            <p><strong>Setup:</strong> 20m indoor course (10 laps × 40m back and forth) or equivalent outdoor course. Assistive devices permitted — document type. No active encouragement during test.</p>
            <p className="italic">"I want you to walk 400 metres as quickly as you can without running. You will walk back and forth along this course. You may stop and rest if necessary, but try to complete the distance as fast as possible."</p>
            <p><strong>Record:</strong> Total time in seconds. If client rests, note duration and location. Test is failed if client cannot complete 400m.</p>
          </div>

          {/* Norms & Interpretation */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 Norms & Interpretation</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Performance</th><th className="p-2 text-left">Time (seconds)</th><th className="p-2 text-left">Clinical Significance</th></tr></thead>
                <tbody>
                  <tr className="border-t border-slate-200"><td className="p-2">Excellent (older adults)</td><td className="p-2">&lt;287 s (&lt;4:47)</td><td className="p-2 text-green-600">Low disability/mortality risk</td></tr>
                  <tr className="border-t border-slate-200 bg-white"><td className="p-2">Average</td><td className="p-2">287–400 s</td><td className="p-2 text-yellow-600">Moderate functional limitation</td></tr>
                  <tr className="border-t border-slate-200"><td className="p-2">Slow (mobility limitation)</td><td className="p-2">&gt;400 s (&gt;6:40)</td><td className="p-2 text-red-600">High disability/mortality risk</td></tr>
                  <tr className="border-t border-slate-200 bg-white"><td className="p-2">Unable to complete</td><td className="p-2">Did not complete</td><td className="p-2 text-red-700">Very high risk — clinical referral</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">MCID: ~30 seconds. Inability to complete 400m associated with 35% increased mortality risk at 5 years (Simonsick et al., 2008).</p>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Simonsick EM et al. (2001). Measuring higher level physical function in well-functioning older adults: expanding familiar approaches in the Health ABC study. <em>Journals of Gerontology: Medical Sciences, 56</em>(10), M644–M649.</p>
            <p>Newman AB et al. (2006). Association of long-distance corridor walk performance with mortality, cardiovascular disease, mobility limitation, and disability. <em>JAMA, 295</em>(17), 2018–2026.</p>
          </div>

          {/* Safety */}
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="pt-4 text-xs text-amber-800 space-y-1">
              <p className="font-semibold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Stop the test if the client experiences:</p>
              <p>• Chest pain or pressure, severe dyspnoea, dizziness/pre-syncope, leg cramps, claudication, or requests to stop.</p>
            </CardContent>
          </Card>

          {/* Pre-test vitals */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Pre-Test Measurements</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">HR (bpm)</Label><Input type="number" value={preHR} onChange={e => setPreHR(e.target.value)} placeholder="e.g. 72" className="mt-1" /></div>
              <div><Label className="text-xs">BP (mmHg)</Label><Input value={preBP} onChange={e => setPreBP(e.target.value)} placeholder="120/80" className="mt-1" /></div>
              <div><Label className="text-xs">SpO2 (%)</Label><Input type="number" value={preSpO2} onChange={e => setPreSpO2(e.target.value)} placeholder="e.g. 98" className="mt-1" /></div>
            </CardContent>
          </Card>

          {/* Timer + controls */}
          <Card className="border-2 border-slate-200">
            <CardContent className="pt-4">
              <div className="text-center mb-4">
                <div className="text-6xl font-bold font-mono text-blue-600 mb-1">{formatTime(timerSeconds)}</div>
                <div className="text-sm text-slate-500">{laps.length} / {TOTAL_LAPS} laps — {laps.length * LAP_DISTANCE_M}m covered</div>
                {testComplete && <Badge className="mt-2 bg-green-600">{stoppedEarly ? 'Stopped Early' : 'Test Complete!'}</Badge>}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {!testStarted ? (
                  <Button onClick={handleStart} size="lg" className="bg-green-600 hover:bg-green-700">
                    <Play className="w-5 h-5 mr-2" />Start Test
                  </Button>
                ) : !testComplete ? (
                  <>
                    <Button onClick={() => setIsRunning(!isRunning)} variant={isRunning ? "destructive" : "default"} size="lg">
                      {isRunning ? <><Pause className="w-4 h-4 mr-1" />Pause</> : <><Play className="w-4 h-4 mr-1" />Resume</>}
                    </Button>
                    <Button onClick={handleLap} size="lg" className="bg-blue-600 hover:bg-blue-700" disabled={!isRunning}>
                      <Flag className="w-4 h-4 mr-1" />Lap ({laps.length + 1})
                    </Button>
                    <Button onClick={handleRestBreak} variant="outline" size="lg" disabled={!isRunning}>
                      Rest Break
                    </Button>
                    <Button onClick={handleStopEarly} variant="outline" size="lg">
                      Stop Early
                    </Button>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Laps table */}
          {laps.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Lap Splits</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-slate-500 border-b"><th className="text-left py-1">Lap</th><th className="text-right py-1">Distance</th><th className="text-right py-1">Split</th><th className="text-right py-1">Cumulative</th></tr></thead>
                    <tbody>
                      {laps.map(l => (
                        <tr key={l.lap} className="border-b last:border-0">
                          <td className="py-1 font-medium">{l.lap}</td>
                          <td className="text-right text-slate-600">{l.lap * LAP_DISTANCE_M}m</td>
                          <td className="text-right font-mono">{formatTime(l.split)}</td>
                          <td className="text-right font-mono text-blue-600">{formatTime(l.cumulative)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {restBreaks.length > 0 && (
                  <p className="text-xs text-amber-700 mt-2">{restBreaks.length} rest break(s) recorded at: {restBreaks.map(r => `${r.at_metres}m (${formatTime(r.at_time)})`).join(', ')}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stop early reason */}
          {stoppedEarly && (
            <div>
              <Label className="text-sm">Reason for Stopping Early</Label>
              <Textarea value={stopsReason} onChange={e => setStopsReason(e.target.value)} placeholder="e.g. client requested to stop, chest discomfort, claudication..." rows={2} className="mt-1" />
            </div>
          )}

          {/* Manual time entry if not using timer */}
          {!testStarted && (
            <div>
              <Label className="text-sm">Manual Total Time (seconds) — if timer not used</Label>
              <Input type="number" value={manualTotalTime} onChange={e => setManualTotalTime(e.target.value)} placeholder="e.g. 312" className="mt-1 w-40" />
            </div>
          )}

          {/* Post-test vitals */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Post-Test Measurements</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">HR (bpm)</Label><Input type="number" value={postHR} onChange={e => setPostHR(e.target.value)} placeholder="Immediate post" className="mt-1" /></div>
              <div><Label className="text-xs">BP (mmHg)</Label><Input value={postBP} onChange={e => setPostBP(e.target.value)} placeholder="120/80" className="mt-1" /></div>
              <div><Label className="text-xs">SpO2 (%)</Label><Input type="number" value={postSpO2} onChange={e => setPostSpO2(e.target.value)} placeholder="e.g. 97" className="mt-1" /></div>
            </CardContent>
          </Card>

          {/* Observations */}
          <div>
            <Label className="text-sm">Gait Observations</Label>
            <Textarea value={gaitObservations} onChange={e => setGaitObservations(e.target.value)} placeholder="Walking speed, stride length, balance, assistive device use, footwear, gait deviations..." rows={3} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Symptoms Observed / Reported</Label>
            <Textarea value={symptomsObserved} onChange={e => setSymptomsObserved(e.target.value)} placeholder="Dyspnoea, chest discomfort, leg pain, none reported..." rows={2} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Additional Clinical Notes</Label>
            <Textarea value={clinicianNotes} onChange={e => setClinicianNotes(e.target.value)} placeholder="Test quality, motivational encouragement given, clinical impressions, recommendations..." rows={3} className="mt-1" />
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-teal-600 hover:bg-teal-700" disabled={laps.length === 0 && !manualTotalTime && timerSeconds === 0}>
            <Save className="w-4 h-4 mr-2" />Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}