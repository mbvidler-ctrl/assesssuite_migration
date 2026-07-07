import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Play, Square, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

const MAX_TRIALS = 4;

// Gait speed classification thresholds (m/s)
function classify(speed) {
  const s = parseFloat(speed);
  if (isNaN(s)) return null;
  if (s >= 1.22) return { label: "Unlimited Community Ambulator", color: "text-green-700", bg: "bg-green-50 border-green-300", desc: "Crosses street safely, unlimited community walking" };
  if (s >= 1.0)  return { label: "Community Ambulator", color: "text-blue-700",  bg: "bg-blue-50 border-blue-300",   desc: "Full community access, low fall risk" };
  if (s >= 0.8)  return { label: "Limited Community Ambulator", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-300", desc: "Limited outdoor access, monitor closely" };
  if (s >= 0.6)  return { label: "Household Ambulator", color: "text-orange-700", bg: "bg-orange-50 border-orange-300", desc: "Primarily indoors, high fall risk" };
  return           { label: "Physiological Ambulator", color: "text-red-700",  bg: "bg-red-50 border-red-300",    desc: "Requires significant assistance, exercise only" };
}

// Normative gait speed (comfortable) by age group (m/s) — Perry & Burnfield / Fritz & Lusardi
const NORMS = [
  { age: "20–29", male: 1.46, female: 1.34 },
  { age: "30–39", male: 1.43, female: 1.34 },
  { age: "40–49", male: 1.43, female: 1.39 },
  { age: "50–59", male: 1.39, female: 1.31 },
  { age: "60–69", male: 1.36, female: 1.24 },
  { age: "70–79", male: 1.26, female: 1.13 },
  { age: "80–89", male: 0.97, female: 0.94 },
];

export default function TenMetreWalkTest10MWTRunner({ client, onSave, onClose }) {
  const [trials, setTrials]             = useState([]);
  const [isTiming, setIsTiming]         = useState(false);
  const [elapsed, setElapsed]           = useState(0);
  const [pace, setPace]                 = useState("comfortable");
  const [ageGroup, setAgeGroup]         = useState("");
  const [gender, setGender]             = useState("");
  const [notes, setNotes]               = useState("");
  const [showInstructions, setShowInstructions] = useState(true);

  const startTimeRef = useRef(null);
  const intervalRef  = useRef(null);

  useEffect(() => {
    if (isTiming) {
      intervalRef.current = setInterval(() => {
        setElapsed(((Date.now() - startTimeRef.current) / 1000));
      }, 50);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isTiming]);

  const handleStart = () => {
    if (trials.length >= MAX_TRIALS) return;
    startTimeRef.current = Date.now();
    setElapsed(0);
    setIsTiming(true);
  };

  const handleStop = () => {
    const t = (Date.now() - startTimeRef.current) / 1000;
    const speed = (10 / t).toFixed(3);
    setIsTiming(false);
    setTrials(prev => [...prev, { time: t.toFixed(2), speed }]);
    setElapsed(0);
  };

  const handleReset = () => {
    clearInterval(intervalRef.current);
    setTrials([]);
    setIsTiming(false);
    setElapsed(0);
    startTimeRef.current = null;
  };

  const avgTime  = trials.length > 0 ? (trials.reduce((a, t) => a + parseFloat(t.time), 0) / trials.length).toFixed(2) : null;
  const avgSpeed = avgTime ? (10 / parseFloat(avgTime)).toFixed(3) : null;
  const cat      = avgSpeed ? classify(avgSpeed) : null;

  // Compare to normative if age/gender chosen
  const norm = NORMS.find(n => n.age === ageGroup);
  const normSpeed = norm ? (gender === "male" ? norm.male : norm.female) : null;
  const pctOfNorm = normSpeed && avgSpeed ? Math.round((parseFloat(avgSpeed) / normSpeed) * 100) : null;

  const handleSave = () => {
    if (trials.length === 0) return;
    const trialLines = trials.map((t, i) => `    Trial ${i + 1}: ${t.time}s — ${t.speed} m/s`).join("\n");
    const soapText = [
      `• 10-Metre Walk Test (10MWT)`,
      `  Pace: ${pace === "maximal" ? "Maximal" : "Comfortable"}`,
      `  Average Time: ${avgTime}s | Average Gait Speed: ${avgSpeed} m/s`,
      cat ? `  Classification: ${cat.label}` : "",
      ageGroup && gender && pctOfNorm ? `  vs. Normative (${ageGroup} ${gender}): ${pctOfNorm}% of expected gait speed (${normSpeed} m/s)` : "",
      trialLines,
      `  MCID: 0.10 m/s | MDC: 0.13 m/s`,
      notes ? `  Notes: ${notes}` : "",
    ].filter(Boolean).join("\n");

    onSave({
      result_value: parseFloat(avgSpeed),
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
      additional_data: {
        soap_text: soapText,
        trials,
        avg_time: avgTime,
        avg_speed: avgSpeed,
        pace,
        classification: cat?.label || null,
        pct_of_normative: pctOfNorm,
      }
    });
  };

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">10-Metre Walk Test (10MWT)</h2>
          <p className="text-sm text-slate-500">Gait speed — functional mobility &amp; fall risk classification</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {/* Collapsible Instructions */}
      <div className="border border-blue-200 rounded-lg overflow-hidden">
        <button onClick={() => setShowInstructions(v => !v)}
          className="w-full flex justify-between items-center bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          📋 Clinician Instructions &amp; Protocol
          {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showInstructions && (
          <div className="bg-white p-4 text-sm text-slate-700 space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <p className="font-bold text-slate-800 text-xs">🏁 Track Setup</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                  <li>Total walkway: <strong>14 m</strong> minimum (2 m acceleration + 10 m timed + 2 m deceleration)</li>
                  <li>Mark start and stop lines clearly with tape</li>
                  <li>Timing begins when leading foot crosses the <strong>2 m mark</strong></li>
                  <li>Timing ends when leading foot crosses the <strong>12 m mark</strong></li>
                  <li>Clear any obstacles; non-slip surface required</li>
                  <li>Usual footwear and assistive device (if applicable)</li>
                </ul>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <p className="font-bold text-slate-800 text-xs">🚶 Instructions to Client</p>
                <div className="text-xs space-y-2">
                  <div className="bg-blue-50 rounded p-2 border border-blue-100">
                    <p className="font-semibold text-blue-800">Comfortable Pace:</p>
                    <p className="italic text-blue-700">"Walk at your normal, comfortable walking speed, as if you are walking down the street."</p>
                  </div>
                  <div className="bg-red-50 rounded p-2 border border-red-100">
                    <p className="font-semibold text-red-800">Maximal Pace:</p>
                    <p className="italic text-red-700">"Walk as fast as you safely can without running."</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                <p className="font-semibold text-amber-800">⚡ Recommended Trials</p>
                <p className="text-amber-700">Minimum 2 practice walks + 2–3 timed trials. Average the timed trials. Up to 4 trials supported.</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs">
                <p className="font-semibold text-green-800">📏 Key Metrics</p>
                <p className="text-green-700"><strong>MCID:</strong> 0.10 m/s (meaningful change)</p>
                <p className="text-green-700"><strong>MDC:</strong> 0.13 m/s (true change beyond error)</p>
                <p className="text-green-700"><strong>Fall risk:</strong> &lt;0.8 m/s</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
                <p className="font-semibold text-red-800">⚠ Safety / Exclusions</p>
                <p className="text-red-700">Unstable fracture · Severe pain on walking · Inability to follow instructions · Non-ambulatory without max assist</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Client Setup */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Test Setup</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="text-xs font-semibold text-slate-600">Pace</Label>
            <div className="flex gap-2 mt-1">
              {["comfortable", "maximal"].map(p => (
                <button key={p} onClick={() => { setPace(p); handleReset(); }} disabled={isTiming}
                  className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${pace === p ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
                  {p === "comfortable" ? "Comfortable" : "Maximal"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600">Age Group</Label>
            <Select value={ageGroup} onValueChange={setAgeGroup}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Select age..." /></SelectTrigger>
              <SelectContent>
                {NORMS.map(n => <SelectItem key={n.age} value={n.age} className="text-xs">{n.age} yrs</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600">Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male" className="text-xs">Male</SelectItem>
                <SelectItem value="female" className="text-xs">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Normative Table */}
      <div className="border border-slate-200 rounded-lg p-3">
        <p className="font-semibold text-slate-700 text-sm mb-2">📊 Normative Gait Speed — Comfortable Pace (m/s)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-slate-300 rounded overflow-hidden">
            <thead className="bg-slate-200">
              <tr>
                <th className="p-2 text-left">Age Group</th>
                <th className="p-2 text-center">Men (m/s)</th>
                <th className="p-2 text-center">Women (m/s)</th>
              </tr>
            </thead>
            <tbody>
              {NORMS.map((n, i) => (
                <tr key={n.age} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className={`p-2 font-medium ${n.age === ageGroup ? "text-blue-700 font-bold" : "text-slate-700"}`}>{n.age} years</td>
                  <td className={`p-2 text-center ${n.age === ageGroup && gender === "male" ? "text-blue-700 font-bold" : ""}`}>{n.male.toFixed(2)}</td>
                  <td className={`p-2 text-center ${n.age === ageGroup && gender === "female" ? "text-blue-700 font-bold" : ""}`}>{n.female.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-xs text-slate-500 space-y-0.5">
          <p><strong>Gait Speed Classification:</strong> ≥1.22 m/s = Unlimited community · ≥1.0 = Community · ≥0.8 = Limited community · ≥0.6 = Household · &lt;0.6 = Physiological</p>
          <p>Source: Fritz &amp; Lusardi (2009); Perry &amp; Burnfield (2010); Bohannon &amp; Andrews (2011).</p>
        </div>
      </div>

      {/* Timer / Trial Runner */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 flex justify-between">
          <span>Trial Runner — {pace === "maximal" ? "Maximal" : "Comfortable"} Pace</span>
          <span>{trials.length}/{MAX_TRIALS} trials recorded</span>
        </div>
        <div className="bg-white p-4 text-center space-y-3">
          <div className={`text-6xl font-bold font-mono tabular-nums ${isTiming ? "text-blue-600" : "text-slate-300"}`}>
            {isTiming ? elapsed.toFixed(2) : trials.length > 0 ? parseFloat(trials[trials.length - 1].time).toFixed(2) : "0.00"}s
          </div>
          {isTiming && <p className="text-xs text-blue-500 animate-pulse">⏱ Timing — press Stop when leading foot crosses the 12 m mark</p>}
          <div className="flex justify-center gap-3 flex-wrap">
            {!isTiming ? (
              <Button onClick={handleStart} disabled={trials.length >= MAX_TRIALS}
                className="bg-blue-600 hover:bg-blue-700 text-white">
                <Play className="w-4 h-4 mr-2" />
                {trials.length === 0 ? "Start Trial 1" : `Start Trial ${trials.length + 1}`}
              </Button>
            ) : (
              <Button onClick={handleStop} variant="destructive">
                <Square className="w-4 h-4 mr-2" /> Stop
              </Button>
            )}
            <Button variant="outline" onClick={handleReset} disabled={isTiming}>
              <RotateCcw className="w-4 h-4 mr-2" /> Reset
            </Button>
          </div>
        </div>

        {/* Trial Results */}
        {trials.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50 p-3 space-y-2">
            {trials.map((t, i) => {
              const c = classify(t.speed);
              return (
                <div key={i} className="flex justify-between items-center bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <span className="font-medium text-slate-700">Trial {i + 1}</span>
                  <span className="text-slate-600">{t.time}s</span>
                  <span className="font-semibold text-slate-800">{t.speed} m/s</span>
                  <span className={`text-xs font-medium ${c?.color}`}>{c?.label}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-red-400 hover:text-red-600"
                    onClick={() => setTrials(prev => prev.filter((_, idx) => idx !== i))} disabled={isTiming}>
                    Remove
                  </Button>
                </div>
              );
            })}

            {/* Average Result */}
            {trials.length >= 2 && cat && (
              <div className={`rounded-lg border px-4 py-3 mt-1 ${cat.bg}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className={`font-bold ${cat.color}`}>{cat.label}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{cat.desc}</p>
                    {pctOfNorm && normSpeed && (
                      <p className="text-xs text-slate-500 mt-0.5">{pctOfNorm}% of expected speed for {ageGroup} {gender} ({normSpeed} m/s)</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold tabular-nums ${cat.color}`}>{avgSpeed}</p>
                    <p className="text-xs text-slate-500">m/s avg</p>
                    <p className="text-xs text-slate-500">{avgTime}s avg</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <Label className="text-sm font-semibold text-slate-700">Clinical Notes</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="Assistive device used, gait deviations observed, pain during test, falls risk concerns..."
          className="mt-1 text-sm" />
      </div>

      {/* References */}
      <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">📖 References</p>
        <p>1. Fritz S &amp; Lusardi M. (2009). White paper: "Walking speed: the sixth vital sign." <em>Journal of Geriatric Physical Therapy</em>, 32(2), 2–5.</p>
        <p>2. Bohannon RW &amp; Andrews AW. (2011). Normal walking speed: a descriptive meta-analysis. <em>Physiotherapy</em>, 97(3), 182–189.</p>
        <p>3. Perry J &amp; Burnfield JM. (2010). <em>Gait Analysis: Normal and Pathological Function</em> (2nd ed.). Slack Incorporated.</p>
        <p>4. Middleton A, Fritz SL, Lusardi M. (2015). Walking speed: the functional vital sign. <em>Journal of Aging and Physical Activity</em>, 23(2), 314–322.</p>
        <p>5. Graham JE, Ostir GV, Fisher SR, Ottenbacher KJ. (2008). Assessing walking speed in clinical research: a systematic review. <em>Journal of Evaluation in Clinical Practice</em>, 14(4), 552–562.</p>
      </div>

      {/* Footer */}
      <div className="flex justify-between pt-2 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={trials.length === 0}
          className="bg-green-600 hover:bg-green-700 text-white">
          Save Results
        </Button>
      </div>
    </div>
  );
}