import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart, Legend
} from "recharts";
import { Save, X, Play, Square, RotateCcw, Zap, Activity, TrendingDown, Award, ChevronDown, ChevronUp, Info } from "lucide-react";
import { toast } from "sonner";

// ─── NORMS ─────────────────────────────────────────────────────────────────────
const PEAK_POWER_NORMS = {
  male:   [{ label: "Elite",        min: 13.0, color: "bg-purple-100 text-purple-800" },
           { label: "Excellent",    min: 10.0, color: "bg-green-100 text-green-800" },
           { label: "Good",         min: 8.5,  color: "bg-teal-100 text-teal-800" },
           { label: "Average",      min: 7.0,  color: "bg-yellow-100 text-yellow-800" },
           { label: "Below Average",min: 5.5,  color: "bg-orange-100 text-orange-800" },
           { label: "Poor",         min: 0,    color: "bg-red-100 text-red-800" }],
  female: [{ label: "Elite",        min: 11.0, color: "bg-purple-100 text-purple-800" },
           { label: "Excellent",    min: 8.5,  color: "bg-green-100 text-green-800" },
           { label: "Good",         min: 7.0,  color: "bg-teal-100 text-teal-800" },
           { label: "Average",      min: 5.5,  color: "bg-yellow-100 text-yellow-800" },
           { label: "Below Average",min: 4.0,  color: "bg-orange-100 text-orange-800" },
           { label: "Poor",         min: 0,    color: "bg-red-100 text-red-800" }],
};

const MEAN_POWER_NORMS = {
  male:   [{ label: "Elite", min: 9.0 }, { label: "Excellent", min: 7.5 }, { label: "Good", min: 6.5 },
           { label: "Average", min: 5.5 }, { label: "Below Average", min: 4.5 }, { label: "Poor", min: 0 }],
  female: [{ label: "Elite", min: 7.5 }, { label: "Excellent", min: 6.5 }, { label: "Good", min: 5.5 },
           { label: "Average", min: 4.5 }, { label: "Below Average", min: 3.5 }, { label: "Poor", min: 0 }],
};

const SPORT_NORMS = {
  "General Population": { pp_male: 8.2,  pp_female: 6.3,  mp_male: 6.1,  mp_female: 4.8 },
  "Cyclist":            { pp_male: 14.5, pp_female: 11.2, mp_male: 10.2, mp_female: 8.1 },
  "Team Sport Athlete": { pp_male: 12.0, pp_female: 9.5,  mp_male: 8.8,  mp_female: 7.0 },
  "Sprinter":           { pp_male: 15.2, pp_female: 12.0, mp_male: 10.5, mp_female: 8.5 },
  "Endurance Athlete":  { pp_male: 9.5,  pp_female: 7.5,  mp_male: 7.8,  mp_female: 6.2 },
  "Recreational":       { pp_male: 9.0,  pp_female: 7.0,  mp_male: 6.8,  mp_female: 5.3 },
};

const FATIGUE_INTERP = [
  { max: 25, label: "Excellent anaerobic capacity maintenance", color: "text-green-700" },
  { max: 35, label: "Good anaerobic capacity", color: "text-teal-700" },
  { max: 45, label: "Average fatigue resistance", color: "text-yellow-700" },
  { max: 60, label: "High fatigue — limited anaerobic endurance", color: "text-orange-700" },
  { max: 100, label: "Very high fatigue — poor anaerobic capacity", color: "text-red-700" },
];

// ─── HELPERS ────────────────────────────────────────────────────────────────────
const classify = (norms, value) => norms.find(n => value >= n.min) || norms[norms.length - 1];
const ergPower = (kp, rpm) => kp * rpm * 0.98; // Monark formula: W = kp × rev/min × 6m/rev × 9.81/60 ≈ kp×rpm×0.98

function buildPowerCurve(intervals) {
  // intervals: array of 5-second rev counts
  return intervals.map((revs, i) => {
    const t = (i + 1) * 5;
    return { time: t, label: `${(i * 5)}-${t}s`, revs: revs ?? 0 };
  });
}

function calcTestValidity(peakW, meanW, minW, mass, resistance) {
  const scores = [];
  let total = 0;
  const checks = [
    { pass: resistance > 0, label: "Resistance recorded", pts: 15 },
    { pass: mass > 0, label: "Body mass recorded", pts: 10 },
    { pass: peakW > 0, label: "Peak power recorded", pts: 20 },
    { pass: meanW > 0, label: "Mean power recorded", pts: 20 },
    { pass: minW > 0, label: "Minimum power recorded", pts: 15 },
    { pass: peakW > meanW && meanW > minW, label: "Power hierarchy valid (peak > mean > min)", pts: 20 },
  ];
  checks.forEach(c => { scores.push(c); if (c.pass) total += c.pts; });
  return { score: total, checks: scores };
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function WingateAnaerobicTestRunner({ client, onSave, onClose, previousAssessments = [] }) {
  const [tab, setTab] = useState("setup");
  const [bodyMass, setBodyMass] = useState(client?.apss_s2_weight_kg?.toString() || "");
  const [resistance, setResistance] = useState("");
  const [sport, setSport] = useState("General Population");
  const [gender, setGender] = useState(client?.gender === "female" ? "female" : "male");

  // Live test state
  const [testPhase, setTestPhase] = useState("idle"); // idle | running | recovery | done
  const [elapsed, setElapsed] = useState(0);
  const [recoveryTime, setRecoveryTime] = useState(0);
  const timerRef = useRef(null);

  // 6 × 5-second interval rev counts
  const [intervals, setIntervals] = useState(["", "", "", "", "", ""]);
  const [peakPowerManual, setPeakPowerManual] = useState("");
  const [meanPowerManual, setMeanPowerManual] = useState("");
  const [minPowerManual, setMinPowerManual] = useState("");

  // Recovery vitals
  const [recHR1, setRecHR1] = useState("");
  const [recHR2, setRecHR2] = useState("");
  const [recHR3, setRecHR3] = useState("");
  const [rpe, setRpe] = useState("");
  const [notes, setNotes] = useState("");
  const [showProtocol, setShowProtocol] = useState(true);

  const mass = parseFloat(bodyMass) || 0;
  const res = parseFloat(resistance) || 0;
  const suggestedRes = mass > 0 ? (gender === "male" ? mass * 0.075 : mass * 0.065).toFixed(2) : "";

  // ─── DERIVED CALCULATIONS ───────────────────────────────────────────────────
  const intervalPowers = intervals.map(revs => {
    const r = parseFloat(revs);
    return !isNaN(r) && r > 0 && res > 0 ? ergPower(res, r * 12) : null; // revs per 5s → rpm (×12)
  });

  const validPowers = intervalPowers.filter(p => p !== null);
  const autoPeak = validPowers.length > 0 ? Math.max(...validPowers) : null;
  const autoMean = validPowers.length > 0 ? validPowers.reduce((a, b) => a + b, 0) / validPowers.length : null;
  const autoMin  = validPowers.length > 0 ? Math.min(...validPowers) : null;
  const peakTimingIndex = autoPeak ? intervalPowers.indexOf(autoPeak) : -1;

  const peakW  = autoPeak  ?? (parseFloat(peakPowerManual)  || null);
  const meanW  = autoMean  ?? (parseFloat(meanPowerManual)  || null);
  const minW   = autoMin   ?? (parseFloat(minPowerManual)   || null);

  const peakWkg  = peakW && mass > 0 ? peakW / mass : null;
  const meanWkg  = meanW && mass > 0 ? meanW / mass : null;
  const totalWork = meanW ? meanW * 30 : null; // joules = W × 30s

  const fatigueIndex = peakW && minW && peakW > 0
    ? ((peakW - minW) / peakW) * 100 : null;

  const peakCat  = peakWkg && gender ? classify(PEAK_POWER_NORMS[gender], peakWkg) : null;
  const meanCat  = meanWkg && gender ? classify(MEAN_POWER_NORMS[gender], meanWkg) : null;
  const fatigueCat = fatigueIndex != null ? FATIGUE_INTERP.find(f => fatigueIndex <= f.max) : null;

  const validity = peakW && meanW && minW
    ? calcTestValidity(peakW, meanW, minW, mass, res) : null;

  // Previous comparison
  const prevResult = previousAssessments?.find(a => a.additional_data?.measurement_type === "anaerobic_power");
  const prevPeak = prevResult?.additional_data?.peak_power_w_per_kg;

  // Chart data
  const powerCurveData = intervalPowers.map((p, i) => ({
    label: `${i * 5}-${(i + 1) * 5}s`,
    power: p ? Math.round(p) : null,
    wPerKg: p && mass > 0 ? parseFloat((p / mass).toFixed(2)) : null,
  }));

  // ─── TIMER LOGIC ────────────────────────────────────────────────────────────
  const startTest = () => {
    if (!resistance || !bodyMass) { toast.error("Set body mass and resistance first."); return; }
    setTestPhase("running"); setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(e => { if (e >= 29) { clearInterval(timerRef.current); setTestPhase("recovery"); } return e + 1; }), 1000);
  };

  const stopTest = () => { clearInterval(timerRef.current); setTestPhase("done"); };
  const startRecovery = () => { setTestPhase("recovery"); setRecoveryTime(0); timerRef.current = setInterval(() => setRecoveryTime(r => r + 1), 1000); };
  const stopRecovery = () => { clearInterval(timerRef.current); setTestPhase("done"); };
  useEffect(() => () => clearInterval(timerRef.current), []);

  // ─── SOAP EXPORT ────────────────────────────────────────────────────────────
  const buildSOAP = () => {
    const lines = [
      `• Wingate Anaerobic Test (WAnT) — 30-Second Maximal Cycle Sprint`,
      `  Body Mass: ${mass} kg | Resistance: ${res} kp (${(res / mass * 1000).toFixed(1)} g/kg)`,
      `  Sport Profile: ${sport}`,
      ``,
      `  POWER OUTPUT:`,
      `  Peak Power: ${peakW ? Math.round(peakW) : "N/A"} W${peakWkg ? ` (${peakWkg.toFixed(2)} W/kg)` : ""}${peakCat ? ` — ${peakCat.label}` : ""}`,
      `  Mean Power: ${meanW ? Math.round(meanW) : "N/A"} W${meanWkg ? ` (${meanWkg.toFixed(2)} W/kg)` : ""}${meanCat ? ` — ${meanCat.label}` : ""}`,
      `  Minimum Power: ${minW ? Math.round(minW) : "N/A"} W`,
      `  Total Work: ${totalWork ? Math.round(totalWork) : "N/A"} J`,
      `  Peak Power Timing: ${peakTimingIndex >= 0 ? `${peakTimingIndex * 5}-${(peakTimingIndex + 1) * 5}s interval` : "N/A"}`,
      ``,
      `  ANAEROBIC CAPACITY:`,
      `  Fatigue Index: ${fatigueIndex != null ? fatigueIndex.toFixed(1) : "N/A"}%${fatigueCat ? ` — ${fatigueCat.label}` : ""}`,
      `  Power Decline: Peak→Min = ${peakW && minW ? Math.round(peakW - minW) : "N/A"} W`,
      ``,
      prevPeak ? `  COMPARISON TO PREVIOUS: Peak ${peakWkg ? peakWkg.toFixed(2) : "?"} vs ${prevPeak.toFixed(2)} W/kg (${peakWkg ? ((peakWkg - prevPeak) / prevPeak * 100).toFixed(1) : "?"} % change)\n` : "",
      recHR1 || recHR2 || recHR3 ? `  RECOVERY HR: 1-min: ${recHR1 || "—"} bpm | 2-min: ${recHR2 || "—"} bpm | 3-min: ${recHR3 || "—"} bpm` : "",
      rpe ? `  RPE (Borg 6-20): ${rpe}` : "",
      validity ? `  Test Validity Score: ${validity.score}/100` : "",
      notes ? `  Notes: ${notes}` : "",
      `  Reference: Bar-Or O (1987). The Wingate anaerobic test. Sports Medicine, 4(6):381–394.`,
      `  Reference: Inbar O, Bar-Or O, Skinner JS (1996). The Wingate Anaerobic Test. Human Kinetics.`,
    ].filter(Boolean).join("\n");
    return lines;
  };

  const handleSave = () => {
    if (!peakW) { toast.error("Peak power is required."); return; }
    onSave({
      status: "completed",
      result_value: peakW ? parseFloat(peakW.toFixed(1)) : null,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
      additional_data: {
        soap_text: buildSOAP(),
        measurement_type: "anaerobic_power",
        peak_power_w: peakW ? Math.round(peakW) : null,
        peak_power_w_per_kg: peakWkg ? parseFloat(peakWkg.toFixed(3)) : null,
        mean_power_w: meanW ? Math.round(meanW) : null,
        mean_power_w_per_kg: meanWkg ? parseFloat(meanWkg.toFixed(3)) : null,
        min_power_w: minW ? Math.round(minW) : null,
        total_work_j: totalWork ? Math.round(totalWork) : null,
        fatigue_index_pct: fatigueIndex ? parseFloat(fatigueIndex.toFixed(1)) : null,
        body_mass_kg: mass,
        resistance_kp: res,
        sport_profile: sport,
        classification_peak: peakCat?.label,
        classification_mean: meanCat?.label,
        fatigue_classification: fatigueCat?.label,
        validity_score: validity?.score,
        recovery_hr_1min: recHR1 ? parseInt(recHR1) : null,
        recovery_hr_2min: recHR2 ? parseInt(recHR2) : null,
        recovery_hr_3min: recHR3 ? parseInt(recHR3) : null,
        rpe: rpe ? parseInt(rpe) : null,
        interval_powers: intervalPowers,
      },
    });
    toast.success("Wingate Test saved.");
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  const timerProgress = Math.min((elapsed / 30) * 100, 100);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[97vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-rose-600 to-red-700 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">Wingate Anaerobic Test</h2>
            <p className="text-rose-200 text-sm">30-second maximal cycle ergometer sprint — Performance Lab Engine</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20"><X className="w-5 h-5" /></Button>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="mx-6 mt-3 mb-0 grid grid-cols-5 h-9 shrink-0">
            <TabsTrigger value="setup" className="text-xs">Setup</TabsTrigger>
            <TabsTrigger value="live" className="text-xs">Live Test</TabsTrigger>
            <TabsTrigger value="results" className="text-xs">Results</TabsTrigger>
            <TabsTrigger value="graphs" className="text-xs">Graphs</TabsTrigger>
            <TabsTrigger value="report" className="text-xs">Report</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">

            {/* â•â•â• SETUP â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <TabsContent value="setup" className="p-6 space-y-5">
              {/* Protocol */}
              <div className="border border-blue-200 rounded-xl overflow-hidden">
                <button onClick={() => setShowProtocol(v => !v)}
                  className="w-full flex justify-between items-center bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
                  <span className="flex items-center gap-2"><Info className="w-4 h-4" />Protocol &amp; Clinician Instructions</span>
                  {showProtocol ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showProtocol && (
                  <div className="p-4 text-sm space-y-3">
                    <div className="grid md:grid-cols-2 gap-3 text-xs">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="font-bold text-blue-800 mb-2">Equipment Setup</p>
                        <ul className="text-blue-700 space-y-1 list-disc list-inside">
                          <li>Mechanically braked ergometer (Monark 834/894E or equivalent)</li>
                          <li>Set seat height: slight knee bend (5–10°) at bottom of stroke</li>
                          <li>Toe clips / straps secured firmly</li>
                          <li>Calibrate ergometer resistance before each test</li>
                        </ul>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="font-bold text-green-800 mb-2">Warm-Up</p>
                        <ul className="text-green-700 space-y-1 list-disc list-inside">
                          <li>5–10 min light cycling at 60–80 W</li>
                          <li>3 × 3-second sprint bursts (2 min apart)</li>
                          <li>3–5 min rest before test</li>
                          <li>Ensure HR has returned toward baseline</li>
                        </ul>
                      </div>
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <p className="font-bold text-orange-800 mb-2">Test Execution</p>
                        <ul className="text-orange-700 space-y-1 list-disc list-inside">
                          <li>Load resistance instantly at "Go" signal</li>
                          <li>Participant sprints maximally for 30 seconds</li>
                          <li>Count and record revolutions per 5-second interval</li>
                          <li>Verbal encouragement throughout</li>
                          <li>Do NOT allow standing on pedals</li>
                        </ul>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="font-bold text-red-800 mb-2">Contraindications / Safety</p>
                        <ul className="text-red-700 space-y-1 list-disc list-inside">
                          <li>Uncontrolled hypertension or cardiac disease</li>
                          <li>Recent MSK injury to lower limb</li>
                          <li>Stop if: chest pain, dizziness, pallor</li>
                          <li>Emergency equipment must be accessible</li>
                        </ul>
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                      <p className="font-semibold text-amber-800">Power Calculation (Monark Protocol)</p>
                      <p className="text-amber-700 mt-1">Power (W) = Force (kp) × Distance (m/5s) × 9.81 / 5<br />
                      Simplified: W = kp × RPM × 6 × 9.81/60 ≈ kp × RPM × 0.98<br />
                      Where RPM = (revolutions per 5s) × 12</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Setup Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Body Mass (kg)</Label>
                  <Input type="number" step="0.1" value={bodyMass} onChange={e => setBodyMass(e.target.value)} className="mt-1" placeholder="kg" />
                </div>
                <div>
                  <Label>Sex</Label>
                  <div className="flex gap-4 mt-2">
                    {["male", "female"].map(g => (
                      <label key={g} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="radio" name="gender" value={g} checked={gender === g} onChange={() => setGender(g)} />
                        <span className="capitalize">{g}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Resistance (kp)</Label>
                  <Input type="number" step="0.05" value={resistance} onChange={e => setResistance(e.target.value)} className="mt-1"
                    placeholder={suggestedRes ? `Suggested: ${suggestedRes} kp` : "kp"} />
                  {suggestedRes && <p className="text-xs text-slate-500 mt-1">Standard: {suggestedRes} kp ({gender === "male" ? "75" : "65"} g/kg)</p>}
                </div>
                <div>
                  <Label>Sport Profile</Label>
                  <select value={sport} onChange={e => setSport(e.target.value)} className="mt-1 w-full border border-input rounded-md px-3 py-1.5 text-sm bg-background">
                    {Object.keys(SPORT_NORMS).map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="text-center pt-2">
                <Button onClick={() => setTab("live")} className="bg-rose-600 hover:bg-rose-700 px-8">
                  <Play className="w-4 h-4 mr-2" />Proceed to Live Test
                </Button>
              </div>
            </TabsContent>

            {/* â•â•â• LIVE TEST â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <TabsContent value="live" className="p-6 space-y-5">
              {/* Timer */}
              <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-6 text-center space-y-3">
                <p className="text-sm font-semibold text-rose-700 uppercase tracking-wide">
                  {testPhase === "idle" ? "Ready" : testPhase === "running" ? "TEST IN PROGRESS" : testPhase === "recovery" ? "RECOVERY" : "COMPLETE"}
                </p>
                <div className="text-6xl font-mono font-black text-rose-700">
                  {testPhase === "recovery" ? `${recoveryTime}s` : `${30 - elapsed}s`}
                </div>
                {testPhase === "running" && (
                  <div className="w-full bg-rose-200 rounded-full h-3">
                    <div className="bg-rose-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${timerProgress}%` }} />
                  </div>
                )}
                <div className="flex gap-3 justify-center mt-2">
                  {testPhase === "idle" && <Button onClick={startTest} className="bg-rose-600 hover:bg-rose-700 px-8"><Play className="w-4 h-4 mr-2" />Start Test</Button>}
                  {testPhase === "running" && <Button onClick={stopTest} variant="outline" className="border-rose-400 text-rose-700"><Square className="w-4 h-4 mr-2" />Stop Early</Button>}
                  {testPhase === "recovery" && (
                    <>
                      <Button onClick={startRecovery} className="bg-blue-600 hover:bg-blue-700"><Activity className="w-4 h-4 mr-2" />Start Recovery Timer</Button>
                      <Button onClick={stopRecovery} variant="outline">Done</Button>
                    </>
                  )}
                  {testPhase === "done" && <Button onClick={() => { setTestPhase("idle"); setElapsed(0); }} variant="outline"><RotateCcw className="w-4 h-4 mr-2" />Reset</Button>}
                </div>
              </div>

              {/* Revolution Capture */}
              <div className="border border-slate-200 rounded-xl p-4">
                <h3 className="font-semibold text-slate-700 mb-3 text-sm">📊 Revolution Capture — 5-Second Intervals</h3>
                <p className="text-xs text-slate-500 mb-3">Enter pedal revolution count for each 5-second window. Power is auto-calculated from Force × RPM.</p>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {intervals.map((val, i) => (
                    <div key={i} className="text-center">
                      <p className="text-xs font-medium text-slate-600 mb-1">{i * 5}–{(i + 1) * 5}s</p>
                      <Input type="number" value={val} onChange={e => { const v = [...intervals]; v[i] = e.target.value; setIntervals(v); }}
                        className="text-center text-sm font-mono" placeholder="revs" />
                      {intervalPowers[i] != null && (
                        <p className={`text-xs font-semibold mt-1 ${i === peakTimingIndex ? "text-rose-600" : "text-slate-500"}`}>
                          {Math.round(intervalPowers[i])} W
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Manual fallback */}
              <div className="border border-dashed border-slate-300 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">Manual Entry (if revolution data unavailable)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">Peak Power (W)</Label><Input type="number" value={peakPowerManual} onChange={e => setPeakPowerManual(e.target.value)} className="mt-1 text-sm" /></div>
                  <div><Label className="text-xs">Mean Power (W)</Label><Input type="number" value={meanPowerManual} onChange={e => setMeanPowerManual(e.target.value)} className="mt-1 text-sm" /></div>
                  <div><Label className="text-xs">Min Power (W)</Label><Input type="number" value={minPowerManual} onChange={e => setMinPowerManual(e.target.value)} className="mt-1 text-sm" /></div>
                </div>
              </div>

              {/* Recovery vitals */}
              <div className="border border-blue-200 rounded-xl p-4 bg-blue-50">
                <h3 className="font-semibold text-blue-800 mb-3 text-sm flex items-center gap-2"><Activity className="w-4 h-4" />Recovery HR Monitoring</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs text-blue-700">1-Min Recovery HR (bpm)</Label><Input type="number" value={recHR1} onChange={e => setRecHR1(e.target.value)} className="mt-1 text-sm" /></div>
                  <div><Label className="text-xs text-blue-700">2-Min Recovery HR (bpm)</Label><Input type="number" value={recHR2} onChange={e => setRecHR2(e.target.value)} className="mt-1 text-sm" /></div>
                  <div><Label className="text-xs text-blue-700">3-Min Recovery HR (bpm)</Label><Input type="number" value={recHR3} onChange={e => setRecHR3(e.target.value)} className="mt-1 text-sm" /></div>
                </div>
              </div>

              <div>
                <Label className="text-sm">RPE (Borg 6–20)</Label>
                <Input type="number" min="6" max="20" value={rpe} onChange={e => setRpe(e.target.value)} className="mt-1 w-24 text-sm" />
              </div>
            </TabsContent>

            {/* â•â•â• RESULTS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <TabsContent value="results" className="p-6 space-y-5">
              {/* Power summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Peak Power", val: peakW, unit: "W", sub: peakWkg ? `${peakWkg.toFixed(2)} W/kg` : null, badge: peakCat, icon: <Zap className="w-5 h-5 text-rose-500" /> },
                  { label: "Mean Power", val: meanW, unit: "W", sub: meanWkg ? `${meanWkg.toFixed(2)} W/kg` : null, badge: meanCat, icon: <Activity className="w-5 h-5 text-blue-500" /> },
                  { label: "Min Power", val: minW, unit: "W", sub: null, badge: null, icon: <TrendingDown className="w-5 h-5 text-orange-500" /> },
                  { label: "Total Work", val: totalWork, unit: "J", sub: totalWork ? `${(totalWork / 1000).toFixed(2)} kJ` : null, badge: null, icon: <Award className="w-5 h-5 text-purple-500" /> },
                ].map(card => (
                  <div key={card.label} className="border border-slate-200 rounded-xl p-3 text-center">
                    <div className="flex justify-center mb-1">{card.icon}</div>
                    <p className="text-xs text-slate-500 mb-1">{card.label}</p>
                    <p className="text-2xl font-bold text-slate-900">{card.val != null ? Math.round(card.val) : "—"}<span className="text-sm font-normal ml-1">{card.unit}</span></p>
                    {card.sub && <p className="text-xs text-slate-500 mt-0.5">{card.sub}</p>}
                    {card.badge && <Badge className={`mt-1 text-xs ${card.badge.color}`}>{card.badge.label}</Badge>}
                  </div>
                ))}
              </div>

              {/* Fatigue Index */}
              {fatigueIndex != null && (
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-slate-700 text-sm">Fatigue Index (Anaerobic Capacity)</p>
                    <span className="text-3xl font-black text-rose-600">{fatigueIndex.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 mb-2">
                    <div className="h-3 rounded-full bg-gradient-to-r from-green-500 via-yellow-400 to-red-600 transition-all"
                      style={{ width: `${Math.min(fatigueIndex, 100)}%` }} />
                  </div>
                  <p className={`text-sm font-medium ${fatigueCat?.color}`}>{fatigueCat?.label}</p>
                  <p className="text-xs text-slate-500 mt-1">Formula: (Peak − Min) / Peak × 100. Lower = better anaerobic capacity maintenance.</p>
                </div>
              )}

              {/* Peak timing */}
              {peakTimingIndex >= 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                  <p className="font-semibold text-amber-800">⚡ Peak Power Timing: {peakTimingIndex * 5}–{(peakTimingIndex + 1) * 5}s interval</p>
                  <p className="text-amber-700 text-xs mt-1">
                    {peakTimingIndex === 0 ? "Peak in first interval — excellent fast-twitch recruitment and immediate maximal effort." :
                     peakTimingIndex === 1 ? "Peak in second interval — typical pattern; short acceleration phase." :
                     "Delayed peak — may indicate slow engagement, pacing, or fatigue onset before test."}
                  </p>
                </div>
              )}

              {/* Sport comparison */}
              {peakWkg && sport && SPORT_NORMS[sport] && (
                <div className="border border-slate-200 rounded-xl p-4">
                  <p className="font-semibold text-slate-700 text-sm mb-3">Sport-Specific Comparison ({sport})</p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { key: "Peak Power", client: peakWkg.toFixed(2), norm: gender === "male" ? SPORT_NORMS[sport].pp_male : SPORT_NORMS[sport].pp_female },
                      { key: "Mean Power", client: meanWkg?.toFixed(2) ?? "—", norm: gender === "male" ? SPORT_NORMS[sport].mp_male : SPORT_NORMS[sport].mp_female },
                    ].map(row => {
                      const diff = row.client !== "—" ? ((parseFloat(row.client) - row.norm) / row.norm * 100).toFixed(1) : null;
                      return (
                        <div key={row.key} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                          <p className="font-semibold text-slate-600 mb-1">{row.key}</p>
                          <p>Client: <span className="font-bold text-slate-900">{row.client} W/kg</span></p>
                          <p>Norm: <span className="font-medium">{row.norm} W/kg</span></p>
                          {diff && <p className={`font-semibold mt-1 ${parseFloat(diff) >= 0 ? "text-green-600" : "text-red-600"}`}>{parseFloat(diff) >= 0 ? "+" : ""}{diff}% vs norm</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Previous comparison */}
              {prevPeak && peakWkg && (
                <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50">
                  <p className="font-semibold text-indigo-800 text-sm mb-2">📈 Comparison to Previous Test</p>
                  <div className="flex gap-6 text-sm">
                    <div><p className="text-xs text-indigo-600">Previous</p><p className="font-bold text-indigo-900">{prevPeak.toFixed(2)} W/kg</p></div>
                    <div><p className="text-xs text-indigo-600">Current</p><p className="font-bold text-indigo-900">{peakWkg.toFixed(2)} W/kg</p></div>
                    <div>
                      <p className="text-xs text-indigo-600">Change</p>
                      <p className={`font-bold ${peakWkg >= prevPeak ? "text-green-700" : "text-red-700"}`}>
                        {peakWkg >= prevPeak ? "+" : ""}{((peakWkg - prevPeak) / prevPeak * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Test validity */}
              {validity && (
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <p className="font-semibold text-slate-700 text-sm">Test Validity Score</p>
                    <span className={`text-xl font-black ${validity.score >= 80 ? "text-green-600" : validity.score >= 60 ? "text-yellow-600" : "text-red-600"}`}>{validity.score}/100</span>
                  </div>
                  <div className="space-y-1">
                    {validity.checks.map(c => (
                      <div key={c.label} className="flex items-center gap-2 text-xs">
                        <span>{c.pass ? "✅" : "âŒ"}</span>
                        <span className={c.pass ? "text-slate-700" : "text-red-600"}>{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recovery HR */}
              {(recHR1 || recHR2 || recHR3) && (
                <div className="border border-blue-200 rounded-xl p-4 bg-blue-50">
                  <p className="font-semibold text-blue-800 text-sm mb-2">Recovery HR Profile</p>
                  <div className="flex gap-6 text-sm">
                    {recHR1 && <div><p className="text-xs text-blue-600">1-min</p><p className="font-bold text-blue-900">{recHR1} bpm</p></div>}
                    {recHR2 && <div><p className="text-xs text-blue-600">2-min</p><p className="font-bold text-blue-900">{recHR2} bpm</p></div>}
                    {recHR3 && <div><p className="text-xs text-blue-600">3-min</p><p className="font-bold text-blue-900">{recHR3} bpm</p></div>}
                    {recHR1 && recHR3 && <div><p className="text-xs text-blue-600">HR Decline</p><p className="font-bold text-blue-900">{parseInt(recHR1) - parseInt(recHR3)} bpm over 2 min</p></div>}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* â•â•â• GRAPHS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <TabsContent value="graphs" className="p-6 space-y-6">
              {powerCurveData.some(d => d.power != null) ? (
                <>
                  {/* Power Curve */}
                  <div>
                    <p className="font-semibold text-slate-700 mb-3 text-sm">⚡ Power Curve (W) — 5-Second Intervals</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={powerCurveData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                        <defs>
                          <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} label={{ value: "Watts", angle: -90, position: "insideLeft", fontSize: 11 }} />
                        <Tooltip formatter={(v) => [`${v} W`, "Power"]} />
                        {meanW && <ReferenceLine y={Math.round(meanW)} stroke="#6366f1" strokeDasharray="4 4" label={{ value: "Mean", fontSize: 10, fill: "#6366f1" }} />}
                        <Area type="monotone" dataKey="power" stroke="#e11d48" strokeWidth={2.5} fill="url(#powerGrad)" dot={{ r: 4, fill: "#e11d48" }} activeDot={{ r: 6 }} connectNulls />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Power Decline / Fatigue Curve */}
                  <div>
                    <p className="font-semibold text-slate-700 mb-3 text-sm">📉 Fatigue Curve — Power Decline over 30s</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={powerCurveData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [`${v} W`, "Power"]} />
                        <Bar dataKey="power" fill="#f97316" radius={[4, 4, 0, 0]}>
                          {powerCurveData.map((entry, index) => (
                            <rect key={index} fill={index === peakTimingIndex ? "#e11d48" : "#f97316"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-slate-500 text-center mt-1">Red bar = peak interval</p>
                  </div>

                  {/* W/kg curve */}
                  {mass > 0 && (
                    <div>
                      <p className="font-semibold text-slate-700 mb-3 text-sm">⚖ï¸ Relative Power Curve (W/kg)</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={powerCurveData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v) => [`${v} W/kg`, "Rel. Power"]} />
                          <Line type="monotone" dataKey="wPerKg" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Recovery HR */}
                  {(recHR1 && recHR2 && recHR3) && (
                    <div>
                      <p className="font-semibold text-slate-700 mb-3 text-sm">💓 Recovery Heart Rate</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={[{ t: "1-min", hr: parseInt(recHR1) }, { t: "2-min", hr: parseInt(recHR2) }, { t: "3-min", hr: parseInt(recHR3) }]}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="t" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="hr" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-16 text-slate-400">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Enter revolution data on the Live Test tab to generate graphs.</p>
                </div>
              )}
            </TabsContent>

            {/* â•â•â• REPORT â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <TabsContent value="report" className="p-6 space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="font-semibold text-slate-700 mb-2 text-sm">📋 SOAP Export Preview</p>
                <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed">{buildSOAP()}</pre>
              </div>

              <div>
                <Label className="text-sm font-semibold">Clinical Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="mt-1 text-sm"
                  placeholder="Warm-up quality, athlete effort, technique observations, pain or fatigue onset, purpose of test..." />
              </div>

              {/* References */}
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">📖 References</p>
                <p>1. Bar-Or O. (1987). The Wingate anaerobic test: an update on methodology, reliability and validity. <em>Sports Medicine</em>, 4(6), 381–394.</p>
                <p>2. Inbar O, Bar-Or O, Skinner JS. (1996). <em>The Wingate Anaerobic Test</em>. Human Kinetics.</p>
                <p>3. Maud PJ, Shultz BB. (1989). Norms for the Wingate anaerobic test with comparison to another similar test. <em>Research Quarterly for Exercise and Sport</em>, 60(2), 144–151.</p>
                <p>4. Zagatto AM, Beck WR, Gobatto CA. (2009). Validity of the running anaerobic sprint test for assessing anaerobic power. <em>Journal of Strength and Conditioning Research</em>, 23(6), 1820–1827.</p>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="border-t p-4 bg-slate-50 flex justify-between items-center shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!peakW} className="bg-rose-600 hover:bg-rose-700 text-white">
            <Save className="w-4 h-4 mr-2" />Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}