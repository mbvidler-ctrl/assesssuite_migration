import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Play, StopCircle, Info } from "lucide-react";

// Balke-Ware stages: constant speed 3.3 mph, grade increases 1% per minute
const generateStages = () => {
  const stages = [];
  for (let min = 1; min <= 25; min++) {
    stages.push({ minute: min, speed_mph: 3.3, grade_pct: min });
  }
  return stages;
};

const STAGES = generateStages();

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Balke-Ware VO2max equation (ACSM): VO2max = 1.387 × T + 10.833 (T = time in minutes, for males)
// Female: VO2max = 1.38 × T + 5.22
function estimateVO2max(timeMins, sex) {
  if (!timeMins || timeMins <= 0) return null;
  if (sex === "female") return (1.38 * timeMins + 5.22).toFixed(1);
  return (1.387 * timeMins + 10.833).toFixed(1);
}

export default function BalkeWareTreadmillTestRunner({ client, onSave, onClose }) {
  const clientAge = client?.date_of_birth
    ? Math.floor((new Date() - new Date(client.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  const agePredictedHRmax = clientAge ? 220 - clientAge : null;

  const [sex, setSex] = useState(
    client?.gender === "female" ? "female" : "male"
  );
  const [preHR, setPreHR] = useState("");
  const [preBP, setPreBP] = useState("");
  const [preRPE, setPreRPE] = useState("");
  const [weight, setWeight] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [stageHRs, setStageHRs] = useState({});
  const [endReason, setEndReason] = useState("");
  const [peakRPE, setPeakRPE] = useState("");
  const [notes, setNotes] = useState("");
  const [testFinished, setTestFinished] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTotalSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const currentMinute = Math.floor(totalSeconds / 60) + 1;
  const currentStage = STAGES[Math.min(currentMinute - 1, STAGES.length - 1)];

  const handleStop = () => {
    setIsRunning(false);
    setTestFinished(true);
  };

  const totalTimeMins = totalSeconds / 60;
  const vo2max = estimateVO2max(testFinished ? totalTimeMins : null, sex);

  const handleSave = () => {
    const timeMins = parseFloat((totalSeconds / 60).toFixed(2));
    
    // Build comprehensive SOAP text
    let soapText = `• Balke-Ware Treadmill Test: ${timeMins} minutes (${formatTime(totalSeconds)})\n`;
    if (clientAge) soapText += `  Client Age: ${clientAge} yrs | Age-predicted HRmax: ${agePredictedHRmax} bpm\n`;
    if (preHR || preBP) soapText += `  Pre-test: HR ${preHR || '—'} bpm, BP ${preBP || '—'}${preRPE ? `, RPE ${preRPE}/20` : ''}\n`;
    if (weight) soapText += `  Body Weight: ${weight} kg\n`;
    if (vo2max) soapText += `  Estimated VO2max: ${vo2max} ml/kg/min (${sex})\n`;
    soapText += `  Protocol: 3.3 mph, +1% grade/min, last grade ${Math.min(Math.floor(timeMins), 25)}%\n`;
    if (peakRPE) soapText += `  Peak RPE: ${peakRPE}/20\n`;
    if (endReason) soapText += `  Test Stopped: ${endReason}\n`;
    const hrEntries = Object.entries(stageHRs).filter(([, v]) => v);
    if (hrEntries.length > 0) {
      soapText += `  Heart Rate Log:\n`;
      hrEntries.forEach(([min, hr]) => {
        soapText += `    Min ${min} (${min}% grade): ${hr} bpm\n`;
      });
    }
    if (notes) soapText += `  Clinical Notes: ${notes}\n`;

    onSave({
      result_value: timeMins,
      additional_data: {
        soap_text: soapText,
        total_time_minutes: timeMins,
        total_time_formatted: formatTime(totalSeconds),
        sex,
        client_age: clientAge,
        age_predicted_hrmax: agePredictedHRmax,
        pre_test_hr: preHR ? parseInt(preHR) : null,
        pre_test_bp: preBP || null,
        pre_test_rpe: preRPE ? parseInt(preRPE) : null,
        body_weight_kg: weight ? parseFloat(weight) : null,
        estimated_vo2max: vo2max ? parseFloat(vo2max) : null,
        peak_rpe: peakRPE ? parseInt(peakRPE) : null,
        end_reason: endReason,
        stage_heart_rates: stageHRs,
        last_stage_completed: Math.floor(timeMins),
        last_grade_pct: Math.min(Math.floor(timeMins), 25),
        measurement_type: 'balke_ware'
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-sky-50 flex justify-between items-start sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Balke-Ware Treadmill Test</h2>
            <p className="text-sm text-slate-600 mt-1">Incremental GXT — constant 3.3 mph, grade +1%/min</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Instructions */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
                <Info className="w-4 h-4" /> Clinician Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-blue-900 space-y-2">
              <p><strong>Setup:</strong> Set treadmill to <strong>3.3 mph (5.3 km/h)</strong>, starting at <strong>0% grade</strong>. Client wears HR monitor. Perform standard pre-exercise safety screen.</p>
              <p><strong>Protocol:</strong> Grade increases by <strong>1% every minute</strong> (speed remains constant at 3.3 mph throughout). Record HR at the end of each minute.</p>
              <p><strong>Stop criteria (any):</strong> Volitional fatigue, chest pain, dizziness, drop in BP, HR &gt; age-predicted max, clinician concern.</p>
              <p><strong>Result:</strong> Total test duration (minutes) is the primary outcome. VO2max is estimated using the Balke equation.</p>
              <p><strong>Script:</strong> <em>"You'll walk at a steady pace while the incline gradually increases each minute. Tell me immediately if you have chest pain, dizziness, or want to stop."</em></p>
              <div className="mt-2 pt-2 border-t border-blue-200">
                <p className="font-semibold">Stage reference (current grade shown live below):</p>
                <p>Min 1 = 1% | Min 5 = 5% | Min 10 = 10% | Min 15 = 15% | Min 20 = 20% | Min 25 = 25%</p>
              </div>
            </CardContent>
          </Card>

          {/* Client Info Banner */}
          {client && (
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-sm flex flex-wrap gap-4">
              <div><span className="text-slate-500">Client:</span> <span className="font-semibold text-slate-800">{client.full_name}</span></div>
              {clientAge && <div><span className="text-slate-500">Age:</span> <span className="font-semibold text-slate-800">{clientAge} yrs</span></div>}
              {agePredictedHRmax && (
                <div><span className="text-slate-500">Age-predicted HRmax:</span> <span className="font-semibold text-red-700">{agePredictedHRmax} bpm</span> <span className="text-xs text-slate-400">(220 − age)</span></div>
              )}
              {client.gender && <div><span className="text-slate-500">Sex:</span> <span className="font-semibold text-slate-800 capitalize">{client.gender}</span></div>}
            </div>
          )}

          {/* Sex selector */}
          <div>
            <Label>Client Sex (for VO2max equation)</Label>
            <div className="flex gap-3 mt-2">
              {["male", "female"].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSex(s)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${sex === s ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-300 text-slate-700"}`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Pre-test vitals */}
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-orange-800">⚠ï¸ Pre-Test Vitals</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Resting HR (bpm)</Label>
                <Input type="number" value={preHR} onChange={e => setPreHR(e.target.value)} placeholder="e.g., 72" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Blood Pressure</Label>
                <Input value={preBP} onChange={e => setPreBP(e.target.value)} placeholder="e.g., 120/80" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Resting RPE (6–20)</Label>
                <Input type="number" value={preRPE} onChange={e => setPreRPE(e.target.value)} placeholder="e.g., 6" min="6" max="20" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Body Weight (kg)</Label>
                <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g., 75" className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Timer & Current Stage */}
          <Card className="bg-slate-900 text-white">
            <CardContent className="pt-6 text-center space-y-2">
              <p className="text-slate-400 text-sm">Total Time</p>
              <p className="text-5xl font-mono font-bold">{formatTime(totalSeconds)}</p>
              {isRunning && (
                <div className="mt-2">
                  <p className="text-blue-300 text-sm">Current Stage — Minute {currentMinute}</p>
                  <p className="text-xl font-semibold text-white">{currentStage.speed_mph} mph @ {currentStage.grade_pct}% grade</p>
                  <p className="text-slate-400 text-xs mt-1">Next change: {60 - (totalSeconds % 60)}s</p>
                </div>
              )}
              {!isRunning && !testFinished && (
                <p className="text-slate-400 text-sm">Press Start to begin</p>
              )}
              {testFinished && (
                <p className="text-green-400 text-sm font-semibold">Test Complete — {formatTime(totalSeconds)}</p>
              )}
            </CardContent>
          </Card>

          {/* Live HR Log — visible once test is started */}
          {(isRunning || testFinished) && currentMinute > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">â¤ï¸ Heart Rate Log — enter at the end of each minute</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {Array.from({ length: testFinished ? Math.ceil(totalTimeMins) : currentMinute }, (_, i) => i + 1).map(min => (
                    <div key={min} className={`flex flex-col items-center p-1 rounded ${min === currentMinute && isRunning ? "bg-blue-50 border border-blue-300" : ""}`}>
                      <Label className="text-xs text-slate-500">Min {min} ({min}%)</Label>
                      <Input
                        type="number"
                        className="text-center text-sm mt-1"
                        placeholder="bpm"
                        value={stageHRs[min] || ""}
                        onChange={e => setStageHRs(prev => ({ ...prev, [min]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Controls */}
          {!testFinished ? (
            <div className="flex gap-3 justify-center">
              {!isRunning ? (
                <Button onClick={() => setIsRunning(true)} className="bg-blue-600 hover:bg-blue-700 px-8">
                  <Play className="w-4 h-4 mr-2" /> Start Test
                </Button>
              ) : (
                <Button onClick={handleStop} className="bg-red-600 hover:bg-red-700 px-8">
                  <StopCircle className="w-4 h-4 mr-2" /> Stop Test
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* VO2max result */}
              {vo2max && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-green-700">Estimated VO2max ({sex})</p>
                  <p className="text-4xl font-bold text-green-600">{vo2max} <span className="text-lg">ml/kg/min</span></p>
                  <p className="text-xs text-green-600 mt-1">Balke equation: {sex === "female" ? "VO₂max = 1.38 × T + 5.22" : "VO₂max = 1.387 × T + 10.833"}</p>
                </div>
              )}

              {/* End reason + Peak RPE */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Reason Test Ended</Label>
                  <Input
                    value={endReason}
                    onChange={e => setEndReason(e.target.value)}
                    placeholder="e.g., Volitional fatigue, HR max reached..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Peak RPE at Test End (6–20)</Label>
                  <Input
                    type="number"
                    value={peakRPE}
                    onChange={e => setPeakRPE(e.target.value)}
                    placeholder="e.g., 19"
                    min="6" max="20"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label>Clinical Notes</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Observations, RPE at end, client response..."
                  className="mt-1"
                />
              </div>

              {/* Norms */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
                <p className="font-semibold text-slate-700">📊 VO2max Norms (ml/kg/min) — ACSM Classification</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-slate-300 rounded">
                    <thead className="bg-slate-200"><tr><th className="p-2 text-left">Category</th><th className="p-2 text-center">Men 20–39</th><th className="p-2 text-center">Men 40–59</th><th className="p-2 text-center">Women 20–39</th><th className="p-2 text-center">Women 40–59</th></tr></thead>
                    <tbody>
                      <tr className="border-t"><td className="p-2">Excellent</td><td className="p-2 text-center">≥52</td><td className="p-2 text-center">≥45</td><td className="p-2 text-center">≥41</td><td className="p-2 text-center">≥35</td></tr>
                      <tr className="border-t bg-white"><td className="p-2">Good</td><td className="p-2 text-center">43–51</td><td className="p-2 text-center">38–44</td><td className="p-2 text-center">35–40</td><td className="p-2 text-center">29–34</td></tr>
                      <tr className="border-t"><td className="p-2">Fair</td><td className="p-2 text-center">34–42</td><td className="p-2 text-center">30–37</td><td className="p-2 text-center">27–34</td><td className="p-2 text-center">23–28</td></tr>
                      <tr className="border-t bg-white"><td className="p-2">Poor</td><td className="p-2 text-center">≤33</td><td className="p-2 text-center">≤29</td><td className="p-2 text-center">≤26</td><td className="p-2 text-center">≤22</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">Balke equation: Male = 1.387×T + 10.833; Female = 1.38×T + 5.22 (T = minutes). Source: ACSM (2022).</p>
              </div>

              {/* Reference */}
              <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                <p className="font-semibold">📖 Reference</p>
                <p>Balke B & Ware RW. (1959). An experimental study of physical fitness of Air Force personnel. <em>U.S. Armed Forces Medical Journal, 10</em>(6), 675–688.</p>
                <p>American College of Sports Medicine. (2022). <em>ACSM's Guidelines for Exercise Testing and Prescription</em> (11th ed.). Wolters Kluwer.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center sticky bottom-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {testFinished && (
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" /> Save Results
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}