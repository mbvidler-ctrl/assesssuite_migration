import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Play, Square, ChevronDown, ChevronUp } from "lucide-react";

// Full normative table: [age_group][gender] = {Excellent, Good, Average, Poor}
// Values are upper bounds (bpm). "Poor" = anything above Average upper bound.
const NORMS = {
  "20-29": {
    male:   { Excellent: 78, Good: 89, Average: 99 },
    female: { Excellent: 82, Good: 95, Average: 109 },
  },
  "30-39": {
    male:   { Excellent: 80, Good: 91, Average: 101 },
    female: { Excellent: 83, Good: 97, Average: 111 },
  },
  "40-49": {
    male:   { Excellent: 84, Good: 95, Average: 106 },
    female: { Excellent: 90, Good: 101, Average: 113 },
  },
  "50-59": {
    male:   { Excellent: 88, Good: 100, Average: 112 },
    female: { Excellent: 94, Good: 106, Average: 118 },
  },
  "60+": {
    male:   { Excellent: 90, Good: 102, Average: 115 },
    female: { Excellent: 96, Good: 109, Average: 122 },
  },
};

const AGE_GROUPS = ["20-29", "30-39", "40-49", "50-59", "60+"];

function getCategory(hr, ageGroup, gender) {
  if (!hr || !ageGroup || !gender) return null;
  const norm = NORMS[ageGroup]?.[gender];
  if (!norm) return null;
  const bpm = parseInt(hr);
  if (bpm <= norm.Excellent) return { label: "Excellent", color: "text-green-700", bg: "bg-green-50 border-green-300" };
  if (bpm <= norm.Good)      return { label: "Good",      color: "text-blue-700",  bg: "bg-blue-50 border-blue-300" };
  if (bpm <= norm.Average)   return { label: "Average",   color: "text-yellow-700",bg: "bg-yellow-50 border-yellow-300" };
  return { label: "Poor", color: "text-red-700", bg: "bg-red-50 border-red-300" };
}

// Phase: idle | exercise | waiting | measuring | done
const EXERCISE_DURATION = 180; // 3 min
const WAIT_DURATION     = 60;  // 1 min post-exercise wait
const MEASURE_DURATION  = 30;  // 30-sec HR count window

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TecumsehStepTestRunner({ client, onSave, onClose }) {
  const [phase, setPhase]               = useState("idle");      // idle|exercise|waiting|measuring|done
  const [elapsed, setElapsed]           = useState(0);
  const [preHR, setPreHR]               = useState("");
  const [recoveryHR, setRecoveryHR]     = useState("");
  const [ageGroup, setAgeGroup]         = useState("");
  const [gender, setGender]             = useState("");
  const [notes, setNotes]               = useState("");
  const [showInstructions, setShowInstructions] = useState(true);
  const intervalRef = useRef(null);

  const phaseMax = phase === "exercise" ? EXERCISE_DURATION : phase === "waiting" ? WAIT_DURATION : MEASURE_DURATION;

  useEffect(() => {
    if (phase === "exercise" || phase === "waiting" || phase === "measuring") {
      intervalRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1;
          if (next >= phaseMax) {
            clearInterval(intervalRef.current);
            advancePhase();
            return phaseMax;
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [phase]);

  const advancePhase = () => {
    setElapsed(0);
    if (phase === "exercise") setPhase("waiting");
    else if (phase === "waiting") setPhase("measuring");
    else if (phase === "measuring") setPhase("done");
  };

  const startExercise = () => {
    setElapsed(0);
    setPhase("exercise");
  };

  const stopEarly = () => {
    clearInterval(intervalRef.current);
    setElapsed(0);
    setPhase("waiting");
  };

  const category = getCategory(recoveryHR, ageGroup, gender);

  const handleSave = () => {
    const bpm = parseInt(recoveryHR);
    const soapLines = [
      `• Tecumseh Step Test`,
      `  Protocol: 20 cm step, 24 steps/min (96 bpm metronome), 3 minutes`,
      `  Pre-Exercise HR: ${preHR || "Not recorded"} bpm`,
      `  Recovery HR (1-min post-exercise, 30-sec count × 2): ${bpm} bpm`,
      `  Age Group: ${ageGroup || "Not specified"} | Gender: ${gender || "Not specified"}`,
      category ? `  Classification: ${category.label} aerobic fitness` : "",
      notes ? `  Notes: ${notes}` : "",
    ].filter(Boolean).join("\n");

    onSave({
      result_value: bpm,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
      additional_data: {
        soap_text: soapLines,
        pre_hr: parseInt(preHR) || null,
        recovery_hr: bpm,
        age_group: ageGroup,
        gender,
        classification: category?.label || null,
      }
    });
  };

  // Phase display helpers
  const phaseInfo = {
    idle:      { label: "Ready to Start", color: "text-slate-600", bg: "bg-slate-50" },
    exercise:  { label: "⚡ Exercise Phase — Step Up & Down", color: "text-blue-700", bg: "bg-blue-50" },
    waiting:   { label: "⏳ Recovery Wait — Client Resting (1 min)", color: "text-orange-700", bg: "bg-orange-50" },
    measuring: { label: "❤ Measure Pulse Now — 30 Seconds", color: "text-red-700", bg: "bg-red-50" },
    done:      { label: "✅ Measurement Window Complete — Enter HR Below", color: "text-green-700", bg: "bg-green-50" },
  };

  const progressPct = phase === "idle" || phase === "done" ? 100 : Math.round((elapsed / phaseMax) * 100);

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Tecumseh Step Test</h2>
          <p className="text-sm text-slate-500">Submaximal aerobic fitness — recovery heart rate protocol</p>
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
            <div className="grid md:grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="font-bold text-slate-800 text-xs mb-1">🪜 Equipment Setup</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                  <li>Step height: <strong>20 cm (8 inches)</strong></li>
                  <li>Metronome: <strong>96 bpm</strong> (= 24 complete step cycles/min)</li>
                  <li>Stopwatch or timer</li>
                  <li>Pulse oximeter or manual pulse palpation</li>
                  <li>Chair for recovery seated rest</li>
                </ul>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="font-bold text-blue-800 text-xs mb-1">🏃 Exercise Phase (3 min)</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                  <li>4-beat cycle: Up-Up-Down-Down</li>
                  <li>Maintain cadence with metronome throughout</li>
                  <li>Arms swing naturally — no holding rails</li>
                  <li>Stop if chest pain, dizziness, excessive dyspnoea</li>
                </ul>
                <p className="text-xs italic text-blue-700 mt-2">"Step up and down in time with the metronome for 3 minutes. Keep the same rhythm throughout."</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="font-bold text-orange-800 text-xs mb-1">❤ Recovery HR Measurement</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                  <li>Client sits immediately after stepping</li>
                  <li>Wait exactly <strong>1 minute post-exercise</strong></li>
                  <li>Count pulse for <strong>30 seconds</strong></li>
                  <li>Multiply by 2 = Recovery HR (bpm)</li>
                  <li><strong>Lower HR = better cardiovascular fitness</strong></li>
                </ul>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
              <p className="font-semibold text-red-800">⚠ Stop Test Immediately If:</p>
              <p className="text-red-700">Chest pain or tightness · Severe dyspnoea · Dizziness or near-syncope · Pallor or cyanosis · Client requests to stop · Irregular pulse detected</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
              <p className="font-semibold text-slate-700 mb-1">📋 Pre-Test Contraindications</p>
              <p className="text-slate-600">Acute illness · Uncontrolled hypertension (resting BP &gt;180/100) · Recent MI or cardiac event · Severe musculoskeletal limitation preventing stepping · Pregnancy (caution)</p>
            </div>
          </div>
        )}
      </div>

      {/* Client Details */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Client Details for Classification</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs font-semibold text-slate-600">Age Group</Label>
            <Select value={ageGroup} onValueChange={setAgeGroup}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Select age..." /></SelectTrigger>
              <SelectContent>
                {AGE_GROUPS.map(ag => <SelectItem key={ag} value={ag} className="text-xs">{ag} years</SelectItem>)}
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
          <div>
            <Label className="text-xs font-semibold text-slate-600">Pre-Exercise HR (bpm)</Label>
            <Input type="number" value={preHR} onChange={e => setPreHR(e.target.value)} className="mt-1 h-8 text-xs" placeholder="Resting HR" disabled={phase === "exercise"} />
          </div>
        </div>
      </div>

      {/* Normative Table */}
      <div className="border border-slate-200 rounded-lg p-3">
        <p className="font-semibold text-slate-700 text-sm mb-2">📊 Normative Data — Recovery HR (bpm, 1 min post-exercise)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-slate-300 rounded overflow-hidden">
            <thead className="bg-slate-200">
              <tr>
                <th className="p-2 text-left">Category</th>
                {AGE_GROUPS.map(ag => (
                  <React.Fragment key={ag}>
                    <th className="p-2 text-center">Men {ag}</th>
                    <th className="p-2 text-center">Women {ag}</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {["Excellent", "Good", "Average", "Poor"].map((cat, ri) => (
                <tr key={cat} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className={`p-2 font-medium ${cat === "Excellent" ? "text-green-700" : cat === "Good" ? "text-blue-700" : cat === "Average" ? "text-yellow-700" : "text-red-700"}`}>{cat}</td>
                  {AGE_GROUPS.map(ag => {
                    const mn = NORMS[ag].male;
                    const fn = NORMS[ag].female;
                    const mVal = cat === "Excellent" ? `≤${mn.Excellent}` : cat === "Good" ? `${mn.Excellent+1}–${mn.Good}` : cat === "Average" ? `${mn.Good+1}–${mn.Average}` : `>${mn.Average}`;
                    const fVal = cat === "Excellent" ? `≤${fn.Excellent}` : cat === "Good" ? `${fn.Excellent+1}–${fn.Good}` : cat === "Average" ? `${fn.Good+1}–${fn.Average}` : `>${fn.Average}`;
                    return (
                      <React.Fragment key={ag}>
                        <td className="p-2 text-center">{mVal}</td>
                        <td className="p-2 text-center">{fVal}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-1">Source: Montoye et al. (1969). Tecumseh Community Health Study normative data.</p>
      </div>

      {/* Test Runner */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {/* Phase Status Bar */}
        <div className={`px-4 py-3 font-semibold text-sm ${phaseInfo[phase].bg} ${phaseInfo[phase].color}`}>
          {phaseInfo[phase].label}
        </div>

        {/* Progress Bar */}
        {phase !== "idle" && phase !== "done" && (
          <div className="px-4 pt-3 bg-white">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{formatTime(elapsed)}</span>
              <span>{formatTime(phaseMax)}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-1000 ${phase === "exercise" ? "bg-blue-500" : phase === "waiting" ? "bg-orange-400" : "bg-red-500"}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1 text-center">
              {phase === "exercise" && `${EXERCISE_DURATION - elapsed}s remaining`}
              {phase === "waiting" && `Pulse measurement starts in ${WAIT_DURATION - elapsed}s`}
              {phase === "measuring" && `Count pulse — ${MEASURE_DURATION - elapsed}s remaining`}
            </p>
          </div>
        )}

        {/* Large Timer Display */}
        {(phase === "exercise" || phase === "waiting" || phase === "measuring") && (
          <div className="text-center py-4 bg-white">
            <div className={`text-5xl font-bold font-mono tabular-nums ${phase === "exercise" ? "text-blue-600" : phase === "waiting" ? "text-orange-500" : "text-red-600"}`}>
              {formatTime(phaseMax - elapsed)}
            </div>
          </div>
        )}

        {/* Phase Instructions */}
        {phase === "exercise" && (
          <div className="mx-4 mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            🎵 Maintain cadence with metronome — 24 steps/min (96 bpm). Stay with the rhythm: Up-Up-Down-Down.
          </div>
        )}
        {phase === "waiting" && (
          <div className="mx-4 mb-3 bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-800">
            ✋ Client is seated and resting. Do NOT measure pulse yet. Wait for the full 1 minute before counting.
          </div>
        )}
        {phase === "measuring" && (
          <div className="mx-4 mb-3 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 font-semibold">
            ❤ COUNT PULSE NOW for 30 seconds. Palpate radial or carotid. Count until timer reaches 0:00.
          </div>
        )}
        {phase === "done" && (
          <div className="mx-4 mb-3 mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800">
            ✅ 30-second counting window complete. Enter the pulse count below and multiply by 2 for HR (bpm).
          </div>
        )}

        {/* Controls */}
        <div className="p-4 bg-white border-t border-slate-100 flex gap-3 flex-wrap">
          {phase === "idle" && (
            <Button onClick={startExercise} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Play className="w-4 h-4 mr-2" /> Start 3-Minute Exercise
            </Button>
          )}
          {phase === "exercise" && (
            <Button onClick={stopEarly} variant="destructive">
              <Square className="w-4 h-4 mr-2" /> Stop Early
            </Button>
          )}
          {(phase === "waiting" || phase === "measuring") && (
            <Button disabled variant="outline" className="opacity-60 cursor-not-allowed">
              Timer Running...
            </Button>
          )}
          {phase === "done" && (
            <Button onClick={() => { setPhase("idle"); setElapsed(0); setRecoveryHR(""); }} variant="outline">
              Restart Test
            </Button>
          )}
        </div>
      </div>

      {/* Recovery HR Entry */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Recovery Heart Rate Entry</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <Label className="text-xs font-semibold text-slate-600">30-Second Pulse Count</Label>
            <p className="text-xs text-slate-500 mb-1">Enter beats counted over 30 sec — app will calculate bpm (× 2)</p>
            <Input type="number" placeholder="e.g. 45 beats → 90 bpm"
              onChange={e => setRecoveryHR(e.target.value ? String(parseInt(e.target.value) * 2) : "")}
              className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600">Recovery HR (bpm)</Label>
            <Input type="number" value={recoveryHR} onChange={e => setRecoveryHR(e.target.value)}
              placeholder="Or enter bpm directly" className="h-9 text-sm" />
          </div>
        </div>

        {/* Classification Result */}
        {category && (
          <div className={`rounded-lg border px-4 py-3 ${category.bg}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-bold text-base ${category.color}`}>{category.label} Aerobic Fitness</p>
                <p className="text-xs text-slate-600 mt-0.5">Recovery HR: {recoveryHR} bpm · {ageGroup} years · {gender === "male" ? "Male" : "Female"}</p>
              </div>
              <div className={`text-3xl font-bold ${category.color}`}>{recoveryHR}</div>
            </div>
          </div>
        )}
      </div>

      {/* Clinical Notes */}
      <div>
        <Label className="text-sm font-semibold text-slate-700">Clinical Notes</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="Effort level, dyspnoea, cadence maintained, any stops, RPE, relevant observations..."
          className="mt-1 text-sm" />
      </div>

      {/* References */}
      <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">📖 References</p>
        <p>1. Montoye HJ, Willis PW III, Cunningham DA, &amp; Keller JB. (1969). Heart rate response to a modified Harvard step test: the Tecumseh study. <em>Research Quarterly for Exercise and Sport</em>, 40(1), 153–162.</p>
        <p>2. Shephard RJ. (1969). A nomogram to calculate the oxygen cost of running at slow speeds. <em>Journal of Sports Medicine and Physical Fitness</em>, 9(1), 10–16.</p>
        <p>3. American College of Sports Medicine. (2022). <em>ACSM's Guidelines for Exercise Testing and Prescription</em> (11th ed.). Wolters Kluwer.</p>
        <p>4. Noonan V &amp; Dean E. (2000). Submaximal exercise testing: clinical application and interpretation. <em>Physical Therapy</em>, 80(8), 782–807.</p>
      </div>

      {/* Footer */}
      <div className="flex justify-between pt-2 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={!recoveryHR} className="bg-green-600 hover:bg-green-700 text-white">
          Save Results
        </Button>
      </div>
    </div>
  );
}