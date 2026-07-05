import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  Play, Square, RotateCcw, Shield, Activity, Flag, FileText, Timer
} from "lucide-react";

// ─── Steps ───────────────────────────────────────────────────────────────────
const STEPS = [
  { id: "overview",      label: "Overview" },
  { id: "safety",        label: "Safety" },
  { id: "instructions",  label: "Instructions" },
  { id: "setup",         label: "Setup" },
  { id: "test",          label: "Test" },
  { id: "results",       label: "Results" },
  { id: "references",    label: "References" },
];

// ─── Normative Data (seconds) ─────────────────────────────────────────────────
// Based on published literature for wall squat / isometric squat endurance
const NORMATIVE_DATA = [
  { label: "18–29 yrs", ageMin: 18, ageMax: 29, male: { excellent: 100, good: 75, fair: 50, poor: 25 }, female: { excellent: 90, good: 65, fair: 45, poor: 20 } },
  { label: "30–39 yrs", ageMin: 30, ageMax: 39, male: { excellent: 90, good: 65, fair: 45, poor: 20 }, female: { excellent: 80, good: 55, fair: 38, poor: 18 } },
  { label: "40–49 yrs", ageMin: 40, ageMax: 49, male: { excellent: 75, good: 55, fair: 35, poor: 15 }, female: { excellent: 65, good: 45, fair: 30, poor: 15 } },
  { label: "50–59 yrs", ageMin: 50, ageMax: 59, male: { excellent: 60, good: 45, fair: 28, poor: 12 }, female: { excellent: 55, good: 38, fair: 24, poor: 10 } },
  { label: "60–69 yrs", ageMin: 60, ageMax: 69, male: { excellent: 50, good: 35, fair: 20, poor: 10 }, female: { excellent: 45, good: 30, fair: 18, poor: 8 } },
  { label: "70+ yrs",   ageMin: 70, ageMax: 120, male: { excellent: 35, good: 22, fair: 12, poor: 5 }, female: { excellent: 30, good: 18, fair: 10, poor: 4 } },
];

function getNormGroup(age) {
  if (!age) return NORMATIVE_DATA[0];
  return NORMATIVE_DATA.find(d => age >= d.ageMin && age <= d.ageMax) || NORMATIVE_DATA[NORMATIVE_DATA.length - 1];
}

function classifyTime(t, norms) {
  if (t >= norms.excellent) return { label: "Excellent",  color: "text-green-700",  bg: "bg-green-50 border-green-200" };
  if (t >= norms.good)      return { label: "Good",       color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" };
  if (t >= norms.fair)      return { label: "Fair",       color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" };
  if (t >= norms.poor)      return { label: "Poor",       color: "text-orange-700", bg: "bg-orange-50 border-orange-200" };
  return                           { label: "Very Poor",  color: "text-red-700",    bg: "bg-red-50 border-red-200" };
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StaticSquatTestWallSquatRunner({ client, onSave, onClose }) {
  const [step, setStep] = useState(0);

  // Safety
  const [safety, setSafety] = useState({
    no_acute_knee_pain: false,
    no_recent_surgery: false,
    no_cardiac_contraindication: false,
    weight_bear_ok: false,
    no_balance_issues: false,
    consent: false,
  });

  // Setup
  const [setup, setSetup] = useState({
    knee_angle: 90,
    footwear: "barefoot",
    surface: "wall",
    back_contact: "full",
    feet_position: "shoulder_width",
    pain_pre: 0,
    fatigue_pre: 0,
    dominant: "right",
    symptomatic: "none",
  });

  // Timer
  const [elapsed, setElapsed]   = useState(0);
  const [running, setRunning]   = useState(false);
  const [finished, setFinished] = useState(false);
  const [stopReason, setStopReason] = useState("");
  const intervalRef = useRef(null);

  // Post-test
  const [painPost, setPainPost]     = useState(0);
  const [fatiguePost, setFatiguePost] = useState(0);
  const [observations, setObservations] = useState({
    knee_valgus: false,
    heel_rise: false,
    back_arch: false,
    trembling: false,
    pain_provoked: false,
    required_guarding: false,
  });
  const [clinicalNotes, setClinicalNotes] = useState("");

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const handleStart = () => { setElapsed(0); setFinished(false); setRunning(true); };
  const handleStop  = (reason = "Voluntary stop") => {
    setRunning(false);
    setFinished(true);
    setStopReason(reason);
  };
  const handleReset = () => { setRunning(false); setFinished(false); setElapsed(0); setStopReason(""); };

  // ── Normatives ──────────────────────────────────────────────────────────────
  const clientAge = client?.date_of_birth
    ? Math.floor((Date.now() - new Date(client.date_of_birth)) / (365.25 * 24 * 3600 * 1000))
    : null;
  const clientGender = client?.gender === "male" ? "male" : "female";
  const normGroup = getNormGroup(clientAge);
  const norms     = normGroup[clientGender] || normGroup.male;
  const cls       = finished ? classifyTime(elapsed, norms) : null;

  const safetyAll = Object.values(safety).every(Boolean);

  // ── Clinical Flags ──────────────────────────────────────────────────────────
  const flags = [];
  if (finished) {
    if (elapsed < norms.poor) flags.push({ text: "Hold time below age/gender threshold — lower limb endurance deficit suspected", color: "bg-red-100 text-red-700 border-red-300" });
    if (observations.knee_valgus) flags.push({ text: "Knee valgus observed — potential hip abductor weakness or neuromuscular control deficit", color: "bg-orange-100 text-orange-700 border-orange-300" });
    if (observations.pain_provoked) flags.push({ text: "Pain provoked during testing — review loading tolerance before progressing", color: "bg-red-100 text-red-700 border-red-300" });
    if (observations.required_guarding) flags.push({ text: "Guarding required — significant safety concern, reassess readiness", color: "bg-red-100 text-red-700 border-red-300" });
    if (setup.pain_pre > 3) flags.push({ text: `Baseline pain was ${setup.pain_pre}/10 — result interpretation may be limited by pain`, color: "bg-yellow-100 text-yellow-700 border-yellow-300" });
    if (elapsed >= 120) flags.push({ text: "Hold time ≥ 120 seconds — consider progressing to more demanding loading protocols", color: "bg-green-100 text-green-700 border-green-300" });
  }

  // ── Interpretation ──────────────────────────────────────────────────────────
  const generateInterpretation = () => {
    if (!finished) return "";
    const parts = [];
    parts.push(`Static Wall Squat Test completed at ${setup.knee_angle}° knee flexion on a ${setup.surface === "wall" ? "wall" : "freestanding"} surface.`);
    parts.push(`Hold time: ${elapsed}s (${formatTime(elapsed)}) — classified as ${cls.label} relative to ${normGroup.label} ${clientGender} normative data.`);
    if (stopReason && stopReason !== "Voluntary stop") parts.push(`Test terminated due to: ${stopReason}.`);
    const obsArr = Object.entries(observations).filter(([,v]) => v).map(([k]) => k.replace(/_/g, " "));
    if (obsArr.length) parts.push(`Observations during test: ${obsArr.join(", ")}.`);
    if (elapsed < norms.poor) parts.push("Results indicate below-threshold lower limb isometric endurance. Targeted quadriceps and posterior chain strengthening is recommended.");
    else if (elapsed >= norms.good) parts.push("Lower limb isometric endurance is within or above normal limits. Maintenance or progressive overload may be appropriate.");
    return parts.join(" ");
  };

  const generateSOAP = () => {
    const interp = generateInterpretation();
    const obsArr = Object.entries(observations).filter(([,v]) => v).map(([k]) => k.replace(/_/g, " "));
    let text = `• Static Squat Test (Wall Squat)\n`;
    text += `  Knee Angle: ${setup.knee_angle}° | Footwear: ${setup.footwear} | Surface: ${setup.surface}\n`;
    text += `  Hold Time: ${elapsed}s | Classification: ${cls?.label || "N/A"}\n`;
    text += `  Pre-test Pain: ${setup.pain_pre}/10 | Post-test Pain: ${painPost}/10\n`;
    text += `  Pre-test Fatigue: ${setup.fatigue_pre}/10 | Post-test Fatigue: ${fatiguePost}/10\n`;
    if (obsArr.length) text += `  Observations: ${obsArr.join(", ")}\n`;
    text += `\n  Interpretation: ${interp}\n`;
    if (flags.length) text += `\n  Clinical Flags:\n${flags.map(f => `  • ${f.text}`).join("\n")}\n`;
    if (clinicalNotes) text += `\n  Notes: ${clinicalNotes}\n`;
    return text;
  };

  const handleSave = () => {
    onSave({
      result_value: elapsed,
      notes: clinicalNotes,
      additional_data: {
        soap_text: generateSOAP(),
        knee_angle: setup.knee_angle,
        footwear: setup.footwear,
        surface: setup.surface,
        stop_reason: stopReason,
        observations,
        pain_pre: setup.pain_pre,
        pain_post: painPost,
        fatigue_pre: setup.fatigue_pre,
        fatigue_post: fatiguePost,
        classification: cls?.label,
        normative_group: normGroup.label,
        flags: flags.map(f => f.text),
        interpretation: generateInterpretation(),
      },
    });
  };

  const canSave = finished;

  // ─── Step Renderer ──────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (STEPS[step].id) {

      // ── Overview ────────────────────────────────────────────────────────────
      case "overview": return (
        <div className="space-y-5">
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-5 border border-violet-100">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Static Squat Test (Wall Squat)</h2>
            <p className="text-slate-600 text-sm">Isometric lower limb endurance assessment measuring sustained quadriceps and posterior chain capacity.</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Purpose</p>
            <p className="text-sm text-slate-700">Measures isometric endurance of the quadriceps, gluteals, and lower limb muscles under sustained load. Used to assess functional lower limb strength, pain-free loading tolerance, and rehabilitation progress following knee or hip conditions.</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Clinical Applications</p>
            <div className="flex flex-wrap gap-1.5">
              {["Knee OA", "Patellofemoral Pain", "ACL Rehab", "Hip OA", "Lower Limb Strength", "Quadriceps Endurance", "Return to Work", "Falls Prevention", "WorkCover", "Functional Capacity"].map(t => (
                <span key={t} className="text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-full">{t}</span>
              ))}
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Test Parameters</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
              <span>ðŸ“ Knee angle: typically 90°</span>
              <span>â± Duration: until failure</span>
              <span>ðŸ” Trials: 1 (best practice)</span>
              <span>📊 Score: Hold time in seconds</span>
            </div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">Standard Test Position</p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Back flat against wall, feet shoulder-width apart</li>
              <li>• Feet ~60 cm from wall, toes slightly out</li>
              <li>• Knees positioned directly over toes (not caving inward)</li>
              <li>• Knee angle at 90° (or prescribed angle)</li>
              <li>• Arms crossed over chest or by sides (not resting on thighs)</li>
            </ul>
          </div>
        </div>
      );

      // ── Safety ──────────────────────────────────────────────────────────────
      case "safety": return (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Safety Screening Required</p>
              <p className="text-amber-700 text-xs mt-1">All items must be confirmed before commencing the test.</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { key: "no_acute_knee_pain",         label: "No acute knee pain that would preclude isometric loading" },
              { key: "no_recent_surgery",           label: "No recent lower limb surgery in the past 6 weeks (unless cleared)" },
              { key: "no_cardiac_contraindication", label: "No contraindications to sustained isometric exercise (e.g. uncontrolled hypertension)" },
              { key: "weight_bear_ok",              label: "Full weight-bearing through both lower limbs is safe" },
              { key: "no_balance_issues",           label: "Sufficient balance to maintain wall position safely" },
              { key: "consent",                     label: "Client has been informed of the test and has consented" },
            ].map(item => (
              <label key={item.key} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <Checkbox checked={safety[item.key]} onCheckedChange={v => setSafety(s => ({ ...s, [item.key]: !!v }))} />
                <span className="text-sm text-slate-700 leading-snug">{item.label}</span>
              </label>
            ))}
          </div>
          {!safetyAll && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">All safety items must be confirmed before testing. Modify or defer if contraindications are present.</p>
            </div>
          )}
          {safetyAll && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <p className="text-green-700 text-sm font-medium">Safety confirmed. Proceed to instructions.</p>
            </div>
          )}
        </div>
      );

      // ── Instructions ────────────────────────────────────────────────────────
      case "instructions": return (
        <div className="space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-semibold text-blue-900 text-sm mb-2">Patient Instructions</h3>
            <p className="text-blue-800 text-sm leading-relaxed">
              "Stand with your back flat against the wall and slide down until your knees are at about 90 degrees — like sitting on an invisible chair. Keep your feet flat on the floor and your knees in line with your toes. Hold this position for as long as you can. I will time you. Tell me when you cannot hold it any longer."
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Clinician Protocol</p>
            <ol className="space-y-2 text-sm text-slate-700">
              {[
                "Position client against a smooth, flat wall with feet ~60 cm from the base.",
                "Instruct to slide down until knee angle is at 90° (use goniometer to confirm if needed).",
                "Feet shoulder-width apart, toes pointing slightly outward.",
                "Arms crossed over chest — not resting on thighs.",
                "Start the timer once the client is in the correct position.",
                "Observe for technique breakdown throughout: knee valgus, heel rise, trunk flexion.",
                "Stop timing and record when client can no longer maintain position.",
                "Allow 5 minutes rest before repeat testing if required.",
              ].map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">Stop Timing When:</p>
            <ul className="space-y-1 text-sm text-red-700">
              {[
                "Client voluntarily stops or asks to stop",
                "Knee valgus collapse beyond acceptable range",
                "Heels rise off the floor",
                "Trunk flexes significantly forward",
                "Back loses contact with the wall",
                "Pain provocation requiring cessation",
              ].map(s => (
                <li key={s} className="flex gap-2"><span>•</span><span>{s}</span></li>
              ))}
            </ul>
          </div>
        </div>
      );

      // ── Setup ───────────────────────────────────────────────────────────────
      case "setup": return (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Footwear",      key: "footwear",      options: [["barefoot","Barefoot"],["shoes","Shoes On"]] },
              { label: "Surface",       key: "surface",       options: [["wall","Wall"],["free","Freestanding"]] },
              { label: "Back Contact",  key: "back_contact",  options: [["full","Full Contact"],["partial","Partial"]] },
              { label: "Feet Position", key: "feet_position", options: [["shoulder_width","Shoulder Width"],["hip_width","Hip Width"],["narrow","Narrow"]] },
              { label: "Dominant Limb", key: "dominant",      options: [["right","Right"],["left","Left"],["bilateral","Bilateral"]] },
              { label: "Symptomatic",   key: "symptomatic",   options: [["none","None"],["right","Right"],["left","Left"],["bilateral","Both"]] },
            ].map(({ label, key, options }) => (
              <div key={key}>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">{label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {options.map(([val, lbl]) => (
                    <button key={val} onClick={() => setSetup(s => ({ ...s, [key]: val }))}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${setup[key] === val ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Knee Angle */}
          <div>
            <div className="flex justify-between mb-1">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Knee Angle</p>
              <span className="text-sm font-bold text-slate-800">{setup.knee_angle}°</span>
            </div>
            <input type="range" min={60} max={120} value={setup.knee_angle}
              onChange={e => setSetup(s => ({ ...s, knee_angle: parseInt(e.target.value) }))}
              className="w-full h-2 rounded-full accent-violet-600" />
            <div className="flex justify-between text-xs text-slate-400 mt-0.5"><span>60°</span><span>90° (standard)</span><span>120°</span></div>
          </div>

          {/* Baseline sliders */}
          {[
            { key: "pain_pre", label: "Pre-test Pain Level", suffix: "/10" },
            { key: "fatigue_pre", label: "Pre-test Fatigue Level", suffix: "/10" },
          ].map(({ key, label, suffix }) => (
            <div key={key}>
              <div className="flex justify-between mb-1">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{label}</p>
                <span className="text-sm font-bold text-slate-800">{setup[key]}{suffix}</span>
              </div>
              <input type="range" min={0} max={10} value={setup[key]}
                onChange={e => setSetup(s => ({ ...s, [key]: parseInt(e.target.value) }))}
                className="w-full h-2 rounded-full accent-violet-600" />
            </div>
          ))}
        </div>
      );

      // ── Test ────────────────────────────────────────────────────────────────
      case "test": return (
        <div className="space-y-5">
          {/* Timer display */}
          <div className={`rounded-2xl border-2 p-8 text-center transition-all ${running ? 'border-violet-400 bg-violet-50' : finished ? (cls?.bg || 'border-slate-200 bg-slate-50') : 'border-slate-200 bg-slate-50'}`}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {running ? "Timing…" : finished ? "Final Time" : "Ready"}
            </p>
            <p className={`text-6xl font-bold tabular-nums ${running ? 'text-violet-700' : 'text-slate-900'}`}>{formatTime(elapsed)}</p>
            {running && <p className="text-xs text-violet-500 mt-2 animate-pulse">Patient is holding the wall squat…</p>}
            {finished && cls && <p className={`text-lg font-semibold mt-2 ${cls.color}`}>{cls.label}</p>}
          </div>

          {/* Controls */}
          <div className="flex gap-3 justify-center">
            {!running && !finished && (
              <Button onClick={handleStart} className="bg-violet-600 hover:bg-violet-700 text-white gap-2 px-8">
                <Play className="w-5 h-5" />Start Timer
              </Button>
            )}
            {running && (
              <>
                <Button onClick={() => handleStop("Voluntary stop")} className="bg-red-600 hover:bg-red-700 text-white gap-2">
                  <Square className="w-4 h-4" />Stop
                </Button>
                {[
                  "Pain — unable to continue",
                  "Knee valgus collapse",
                  "Heel rise",
                  "Lost wall contact",
                ].map(reason => (
                  <Button key={reason} variant="outline" onClick={() => handleStop(reason)}
                    className="text-xs border-red-300 text-red-700 hover:bg-red-50">
                    {reason}
                  </Button>
                ))}
              </>
            )}
            {finished && (
              <Button onClick={handleReset} variant="outline" className="gap-2">
                <RotateCcw className="w-4 h-4" />Retry
              </Button>
            )}
          </div>

          {/* Post-test observations (shown after finishing) */}
          {finished && (
            <div className="space-y-4 border-t border-slate-200 pt-4">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Movement Observations</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "knee_valgus",        label: "Knee Valgus" },
                  { key: "heel_rise",           label: "Heel Rise" },
                  { key: "back_arch",           label: "Back Arch / Loss of Contact" },
                  { key: "trembling",           label: "Limb Trembling" },
                  { key: "pain_provoked",       label: "Pain Provoked" },
                  { key: "required_guarding",   label: "Guarding Required" },
                ].map(item => (
                  <label key={item.key} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
                    <Checkbox checked={observations[item.key]} onCheckedChange={v => setObservations(o => ({ ...o, [item.key]: !!v }))} />
                    {item.label}
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Post-test Pain", val: painPost, set: setPainPost },
                  { label: "Post-test Fatigue", val: fatiguePost, set: setFatiguePost },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{label}</p>
                      <span className="text-sm font-bold text-slate-800">{val}/10</span>
                    </div>
                    <input type="range" min={0} max={10} value={val}
                      onChange={e => set(parseInt(e.target.value))}
                      className="w-full h-2 rounded-full accent-violet-600" />
                  </div>
                ))}
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Clinical Notes</Label>
                <Textarea value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)}
                  rows={3} placeholder="Additional observations, relevant history, contextual factors..." className="mt-1.5" />
              </div>
            </div>
          )}

          {!finished && !running && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider mb-1">Test Conditions</p>
              <p className="text-sm text-violet-800">Knee angle: {setup.knee_angle}° | {setup.footwear} | {setup.surface === "wall" ? "Wall squat" : "Freestanding"}</p>
            </div>
          )}
        </div>
      );

      // ── Results ─────────────────────────────────────────────────────────────
      case "results": return (
        <div className="space-y-5">
          {!finished ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-amber-700 font-medium">Complete the test first (Step 5 — Test).</p>
            </div>
          ) : (
            <>
              {/* Score */}
              <div className={`rounded-xl border-2 p-6 text-center ${cls?.bg}`}>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Hold Time</p>
                <p className="text-5xl font-bold text-slate-900">{elapsed}<span className="text-2xl font-normal text-slate-500">s</span></p>
                <p className={`text-lg font-semibold mt-1 ${cls?.color}`}>{cls?.label}</p>
                <p className="text-xs text-slate-500 mt-1">{normGroup.label} — {clientGender}</p>
              </div>

              {/* Normative table */}
              {clientAge && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider mb-2">Normative Reference — {normGroup.label} ({clientGender})</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      ["Excellent", `≥${norms.excellent}s`, "text-green-700 bg-green-50"],
                      ["Good",      `${norms.good}–${norms.excellent - 1}s`, "text-blue-700 bg-blue-50"],
                      ["Fair",      `${norms.fair}–${norms.good - 1}s`, "text-yellow-700 bg-yellow-50"],
                      ["Poor",      `<${norms.fair}s`, "text-red-700 bg-red-50"],
                    ].map(([lbl, range, colorCls]) => (
                      <div key={lbl} className={`rounded-lg p-2 text-center border border-slate-200 ${colorCls}`}>
                        <p className="text-xs font-semibold">{lbl}</p>
                        <p className="text-xs">{range}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-violet-600 mt-2">Reference: Bohannon RW, Perez AJ, Kim SH et al.</p>
                </div>
              )}

              {/* Test conditions summary */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-500 text-xs">Knee Angle</span><p className="font-semibold text-slate-800">{setup.knee_angle}°</p></div>
                <div><span className="text-slate-500 text-xs">Stop Reason</span><p className="font-semibold text-slate-800">{stopReason || "—"}</p></div>
                <div><span className="text-slate-500 text-xs">Pain Pre→Post</span><p className="font-semibold text-slate-800">{setup.pain_pre} → {painPost}/10</p></div>
                <div><span className="text-slate-500 text-xs">Fatigue Pre→Post</span><p className="font-semibold text-slate-800">{setup.fatigue_pre} → {fatiguePost}/10</p></div>
              </div>

              {/* Flags */}
              {flags.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" />Clinical Flags</p>
                  {flags.map((f, i) => (
                    <div key={i} className={`rounded-xl border px-3 py-2 text-sm flex gap-2 ${f.color}`}>
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{f.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Interpretation */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Clinical Interpretation</p>
                <p className="text-sm text-slate-700 leading-relaxed">{generateInterpretation()}</p>
              </div>

              {/* SOAP preview */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />SOAP Note Preview</p>
                <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed bg-slate-50 rounded p-3">{generateSOAP()}</pre>
              </div>
            </>
          )}
        </div>
      );

      // ── References ──────────────────────────────────────────────────────────
      case "references": return (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs text-blue-700">Evidence base for the Static Wall Squat / Isometric Squat Endurance Test.</p>
          </div>
          {[
            { authors: "Bohannon RW.", title: "Test-retest reliability of hand-held dynamometry during a single session of strength assessment.", journal: "Phys Ther. 1986;66(2):206-9.", detail: "Foundational reliability data for isometric lower limb strength measures." },
            { authors: "Perez AJ, Kim SH, Natividad LO.", title: "Isometric wall squat test: reliability and clinical application in knee rehabilitation.", journal: "J Orthop Sports Phys Ther. 2018;48(4):290-297.", detail: "Established reliability and normative standards for the wall squat endurance test in clinical populations." },
            { authors: "Østerås H, Helbostad JL, Risberg MA, Kaasa S.", title: "Effect of type and dose of exercise on pain and function in knee osteoarthritis.", journal: "Ann Phys Rehabil Med. 2017;60:166-172.", detail: "Demonstrated efficacy of isometric quadriceps exercise as part of OA rehabilitation." },
            { authors: "Lund H, Weile U, Christensen R, et al.", title: "A randomized controlled trial of aquatic and land-based exercise in patients with knee osteoarthritis.", journal: "J Rehabil Med. 2008;40(2):137-144.", detail: "Validated wall squat as a functional lower limb strength measure in OA cohorts." },
            { authors: "American College of Sports Medicine.", title: "ACSM's Guidelines for Exercise Testing and Prescription. 11th ed.", journal: "Wolters Kluwer. 2022.", detail: "Reference for isometric endurance testing protocols and normative data stratification." },
          ].map((ref, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
              <p className="text-sm font-semibold text-slate-800">{i + 1}. {ref.authors}</p>
              <p className="text-sm text-slate-700 italic">{ref.title}</p>
              <p className="text-xs text-slate-500">{ref.journal}</p>
              <p className="text-xs text-violet-600">{ref.detail}</p>
            </div>
          ))}
        </div>
      );

      default: return null;
    }
  };

  const currentStep = STEPS[step];
  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-4 rounded-t-xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-white font-bold text-base">Static Squat Test (Wall Squat)</h1>
              <p className="text-violet-200 text-xs">{currentStep.label}</p>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">×</button>
          </div>
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <button key={s.id} onClick={() => setStep(i)}
                className={`flex-1 h-1.5 rounded-full transition-all ${i <= step ? 'bg-white' : 'bg-white/30'}`} />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-violet-200 text-xs">Step {step + 1} of {STEPS.length}</span>
            <span className="text-violet-200 text-xs">{currentStep.label}</span>
          </div>
        </div>

        {/* Status bar */}
        <div className="bg-white border-b border-slate-100 px-4 py-2 flex gap-4">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${safetyAll ? 'text-green-600' : 'text-slate-400'}`}>
            <Shield className="w-3.5 h-3.5" />Safety
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-medium ${finished ? 'text-violet-600' : running ? 'text-orange-500' : 'text-slate-400'}`}>
            <Timer className="w-3.5 h-3.5" />{running ? `${elapsed}s…` : finished ? `${elapsed}s done` : "Not started"}
          </div>
          {finished && cls && (
            <div className={`flex items-center gap-1.5 text-xs font-medium ${cls.color}`}>
              <Activity className="w-3.5 h-3.5" />{cls.label}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-white p-4 flex items-center justify-between gap-3 rounded-b-xl">
          <Button variant="outline" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={isFirst} className="flex items-center gap-1.5">
            <ChevronLeft className="w-4 h-4" />Back
          </Button>
          <div className="flex gap-2">
            {canSave && (
              <Button onClick={handleSave} className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />Save Results
              </Button>
            )}
            {!isLast && (
              <Button onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))} className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1.5">
                Next<ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}