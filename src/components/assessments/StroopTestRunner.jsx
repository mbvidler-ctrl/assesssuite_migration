import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Save, X, Play, Square, RotateCcw, Info, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Clock, Activity, BookOpen, Brain, Flag, FileText, Eye
} from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// ─── STIMULUS CARDS ────────────────────────────────────────────────────────────
// 50-item lists matching Golden CJ standard form
const TRIAL1_WORDS = [
  { word: "RED", color: "#1a1a1a" }, { word: "BLUE", color: "#1a1a1a" },
  { word: "GREEN", color: "#1a1a1a" }, { word: "YELLOW", color: "#1a1a1a" },
  { word: "RED", color: "#1a1a1a" }, { word: "GREEN", color: "#1a1a1a" },
  { word: "BLUE", color: "#1a1a1a" }, { word: "YELLOW", color: "#1a1a1a" },
  { word: "GREEN", color: "#1a1a1a" }, { word: "RED", color: "#1a1a1a" },
  { word: "BLUE", color: "#1a1a1a" }, { word: "YELLOW", color: "#1a1a1a" },
  { word: "RED", color: "#1a1a1a" }, { word: "GREEN", color: "#1a1a1a" },
  { word: "BLUE", color: "#1a1a1a" }, { word: "YELLOW", color: "#1a1a1a" },
  { word: "GREEN", color: "#1a1a1a" }, { word: "RED", color: "#1a1a1a" },
  { word: "BLUE", color: "#1a1a1a" }, { word: "YELLOW", color: "#1a1a1a" },
];

const TRIAL2_COLORS = [
  { word: "XXXX", color: "#e53e3e", name: "RED" },
  { word: "XXXX", color: "#2b6cb0", name: "BLUE" },
  { word: "XXXX", color: "#276749", name: "GREEN" },
  { word: "XXXX", color: "#b7791f", name: "YELLOW" },
  { word: "XXXX", color: "#e53e3e", name: "RED" },
  { word: "XXXX", color: "#276749", name: "GREEN" },
  { word: "XXXX", color: "#2b6cb0", name: "BLUE" },
  { word: "XXXX", color: "#b7791f", name: "YELLOW" },
  { word: "XXXX", color: "#276749", name: "GREEN" },
  { word: "XXXX", color: "#e53e3e", name: "RED" },
  { word: "XXXX", color: "#2b6cb0", name: "BLUE" },
  { word: "XXXX", color: "#b7791f", name: "YELLOW" },
  { word: "XXXX", color: "#e53e3e", name: "RED" },
  { word: "XXXX", color: "#276749", name: "GREEN" },
  { word: "XXXX", color: "#2b6cb0", name: "BLUE" },
  { word: "XXXX", color: "#b7791f", name: "YELLOW" },
  { word: "XXXX", color: "#276749", name: "GREEN" },
  { word: "XXXX", color: "#e53e3e", name: "RED" },
  { word: "XXXX", color: "#2b6cb0", name: "BLUE" },
  { word: "XXXX", color: "#b7791f", name: "YELLOW" },
];

const TRIAL3_INTERFERENCE = [
  { word: "RED", color: "#2b6cb0", correct: "BLUE" },
  { word: "BLUE", color: "#276749", correct: "GREEN" },
  { word: "GREEN", color: "#e53e3e", correct: "RED" },
  { word: "YELLOW", color: "#2b6cb0", correct: "BLUE" },
  { word: "RED", color: "#b7791f", correct: "YELLOW" },
  { word: "BLUE", color: "#e53e3e", correct: "RED" },
  { word: "GREEN", color: "#b7791f", correct: "YELLOW" },
  { word: "YELLOW", color: "#276749", correct: "GREEN" },
  { word: "RED", color: "#276749", correct: "GREEN" },
  { word: "GREEN", color: "#2b6cb0", correct: "BLUE" },
  { word: "BLUE", color: "#b7791f", correct: "YELLOW" },
  { word: "YELLOW", color: "#e53e3e", correct: "RED" },
  { word: "RED", color: "#2b6cb0", correct: "BLUE" },
  { word: "GREEN", color: "#e53e3e", correct: "RED" },
  { word: "BLUE", color: "#276749", correct: "GREEN" },
  { word: "YELLOW", color: "#2b6cb0", correct: "BLUE" },
  { word: "RED", color: "#b7791f", correct: "YELLOW" },
  { word: "BLUE", color: "#e53e3e", correct: "RED" },
  { word: "GREEN", color: "#b7791f", correct: "YELLOW" },
  { word: "YELLOW", color: "#276749", correct: "GREEN" },
];

// ─── NORMATIVE DATA (Golden CJ, age-adjusted, 45s trial) ─────────────────────
// Word Reading (T1), Color Naming (T2), Interference (T3) — mean scores (correct items in 45s)
const NORMS_45S = {
  "17-29": { t1: { mean: 109, sd: 17 }, t2: { mean: 81, sd: 14 }, t3: { mean: 51, sd: 10 } },
  "30-39": { t1: { mean: 106, sd: 18 }, t2: { mean: 79, sd: 14 }, t3: { mean: 49, sd: 10 } },
  "40-49": { t1: { mean: 104, sd: 16 }, t2: { mean: 77, sd: 13 }, t3: { mean: 47, sd: 9 } },
  "50-59": { t1: { mean: 100, sd: 17 }, t2: { mean: 73, sd: 14 }, t3: { mean: 45, sd: 9 } },
  "60-69": { t1: { mean: 93, sd: 18 }, t2: { mean: 67, sd: 14 }, t3: { mean: 40, sd: 9 } },
  "70-79": { t1: { mean: 85, sd: 19 }, t2: { mean: 60, sd: 15 }, t3: { mean: 35, sd: 9 } },
  "80+":   { t1: { mean: 77, sd: 20 }, t2: { mean: 53, sd: 15 }, t3: { mean: 30, sd: 9 } },
};

function getAgeNorm(age) {
  if (!age) return null;
  if (age < 30) return NORMS_45S["17-29"];
  if (age < 40) return NORMS_45S["30-39"];
  if (age < 50) return NORMS_45S["40-49"];
  if (age < 60) return NORMS_45S["50-59"];
  if (age < 70) return NORMS_45S["60-69"];
  if (age < 80) return NORMS_45S["70-79"];
  return NORMS_45S["80+"];
}

function zScore(score, mean, sd) {
  if (!sd || !mean) return null;
  return parseFloat(((score - mean) / sd).toFixed(2));
}

function classifyZ(z) {
  if (z === null) return { label: "Unclassified", color: "bg-slate-100 text-slate-600 border-slate-200" };
  if (z >= 1.5) return { label: "Superior", color: "bg-green-100 text-green-800 border-green-300" };
  if (z >= 0.5) return { label: "Above Average", color: "bg-teal-100 text-teal-800 border-teal-300" };
  if (z >= -0.5) return { label: "Average", color: "bg-blue-100 text-blue-800 border-blue-300" };
  if (z >= -1.5) return { label: "Below Average", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  if (z >= -2.0) return { label: "Low", color: "bg-orange-100 text-orange-800 border-orange-300" };
  return { label: "Impaired", color: "bg-red-100 text-red-800 border-red-300" };
}

// Stroop Interference Score (Golden formula): T3_score - (T1_score × T2_score)/(T1_score + T2_score)
function calcInterference(t1, t2, t3) {
  if (!t1 || !t2 || !t3) return null;
  const predicted = (t1 * t2) / (t1 + t2);
  return parseFloat((t3 - predicted).toFixed(2));
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = String(Math.floor((s % 1) * 10));
  return `${m}:${String(sec).padStart(2, "0")}.${ms}`;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = false, accent = "purple" }) {
  const [open, setOpen] = useState(defaultOpen);
  const map = {
    purple: "border-purple-200 bg-purple-50", blue: "border-blue-200 bg-blue-50",
    green: "border-green-200 bg-green-50", red: "border-red-200 bg-red-50",
    slate: "border-slate-200 bg-slate-50", amber: "border-amber-200 bg-amber-50",
    teal: "border-teal-200 bg-teal-50",
  };
  return (
    <div className={`border rounded-xl overflow-hidden ${map[accent]}`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left font-semibold text-slate-800 hover:bg-white/50 transition-colors">
        <span className="flex items-center gap-2 text-sm">{Icon && <Icon className="w-4 h-4" />}{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1 bg-white/70">{children}</div>}
    </div>
  );
}

function RatingRow({ label, value, onChange, max = 10 }) {
  return (
    <div>
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      <div className="flex items-center gap-3 mt-1">
        <input type="range" min={0} max={max} step={1} value={value ?? 0} onChange={e => onChange(Number(e.target.value))} className="flex-1 h-2 rounded-full accent-purple-600" />
        <span className={`text-lg font-bold w-6 text-center ${(value ?? 0) <= 3 ? "text-green-600" : (value ?? 0) <= 6 ? "text-yellow-600" : "text-red-600"}`}>{value ?? 0}</span>
      </div>
    </div>
  );
}

function ImageCard({ url, caption }) {
  const [ex, setEx] = useState(false);
  return (
    <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
      <img src={url} alt={caption} className={`w-full object-cover cursor-pointer transition-all ${ex ? "max-h-96" : "max-h-36"}`} onClick={() => setEx(e => !e)} onError={e => { e.target.style.display = "none"; }} />
      <p className="text-xs text-slate-500 text-center p-2">{caption} <span className="text-purple-500 cursor-pointer" onClick={() => setEx(e => !e)}>{ex ? "(collapse)" : "(expand)"}</span></p>
    </div>
  );
}

// ─── TRIAL RUNNER COMPONENT ────────────────────────────────────────────────────
function TrialRunner({ trial, stimuli, onComplete, trialLabel, instruction, color }) {
  const [phase, setPhase] = useState("ready"); // ready | running | done
  const [elapsed, setElapsed] = useState(0);
  const [errors, setErrors] = useState(0);
  const [selfCorrections, setSelfCorrections] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const startRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const start = () => {
    setPhase("running");
    setElapsed(0);
    setErrors(0);
    setSelfCorrections(0);
    setCurrentIdx(0);
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 100);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    const t = parseFloat(((Date.now() - startRef.current) / 1000).toFixed(2));
    setElapsed(t);
    setPhase("done");
    // Estimate correct items based on items shown (currentIdx completed)
    const completed = currentIdx;
    const accuracy = completed > 0 ? parseFloat(((completed - errors) / completed * 100).toFixed(1)) : 0;
    onComplete({ trial, time: t, errors, selfCorrections, completed, accuracy });
  };

  const next = () => {
    if (currentIdx < stimuli.length - 1) setCurrentIdx(i => i + 1);
    else stop();
  };

  const markError = () => {
    setErrors(e => e + 1);
    toast.warning("Error recorded");
  };

  const markSelfCorrection = () => {
    setSelfCorrections(s => s + 1);
    toast.info("Self-correction recorded");
  };

  const reset = () => {
    clearInterval(intervalRef.current);
    setPhase("ready");
    setElapsed(0);
    setErrors(0);
    setSelfCorrections(0);
    setCurrentIdx(0);
  };

  const current = stimuli[currentIdx];

  return (
    <div className="space-y-4">
      <div className={`rounded-xl p-3 border text-sm ${color}`}>
        <p className="font-semibold mb-1">{trialLabel}</p>
        <p>{instruction}</p>
      </div>

      {/* Timer bar */}
      <div className={`rounded-2xl p-5 text-center border-2 transition-colors ${phase === "running" ? "bg-purple-50 border-purple-400" : phase === "done" ? "bg-green-50 border-green-400" : "bg-slate-50 border-slate-200"}`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
          {phase === "running" ? "▶ TRIAL IN PROGRESS" : phase === "done" ? "✓ Trial Complete" : "Ready"}
        </p>
        <p className={`text-5xl font-mono font-bold ${phase === "running" ? "text-purple-700" : phase === "done" ? "text-green-700" : "text-slate-400"}`}>
          {formatTime(elapsed)}
        </p>
        {phase === "running" && (
          <p className="text-xs text-slate-500 mt-1">Item {currentIdx + 1} / {stimuli.length}</p>
        )}
      </div>

      {/* Stimulus card */}
      {phase === "running" && current && (
        <div className="rounded-xl border-2 border-purple-200 bg-white p-6 text-center shadow-md">
          <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">
            {trial === "interference" ? "Name the INK COLOR (ignore the word)" : trial === "color" ? "Name the COLOR" : "Read the WORD"}
          </p>
          <p className="text-5xl font-bold tracking-widest" style={{ color: current.color }}>
            {current.word}
          </p>
          {trial === "interference" && (
            <p className="text-xs text-slate-400 mt-3">Correct answer: <strong style={{ color: current.color }}>{current.correct}</strong></p>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2 flex-wrap justify-center">
        {phase === "ready" && <Button onClick={start} size="lg" className="bg-purple-600 hover:bg-purple-700 px-8"><Play className="w-5 h-5 mr-2" />Start Trial</Button>}
        {phase === "running" && (
          <>
            <Button onClick={next} size="lg" className="bg-indigo-600 hover:bg-indigo-700 px-6">Next →</Button>
            <Button onClick={markError} variant="destructive" size="lg">Error ✗</Button>
            <Button onClick={markSelfCorrection} variant="outline" size="sm">Self-Correct ↩</Button>
            <Button onClick={stop} variant="outline" size="sm"><Square className="w-4 h-4 mr-1" />Stop</Button>
          </>
        )}
        {phase === "done" && (
          <>
            <div className="w-full text-center p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
              <CheckCircle2 className="w-4 h-4 inline mr-1" />
              Completed in <strong>{formatTime(elapsed)}</strong> | Errors: <strong>{errors}</strong> | Self-corrections: <strong>{selfCorrections}</strong>
            </div>
            <Button onClick={reset} variant="outline" size="sm"><RotateCcw className="w-4 h-4 mr-1" />Redo Trial</Button>
          </>
        )}
      </div>

      {phase === "running" && (
        <div className="flex justify-between text-sm bg-slate-50 rounded-lg p-3 border">
          <span className="text-slate-600">Errors: <span className="font-bold text-red-600">{errors}</span></span>
          <span className="text-slate-600">Self-Corrections: <span className="font-bold text-amber-600">{selfCorrections}</span></span>
          <span className="text-slate-600">Progress: <span className="font-bold">{currentIdx}/{stimuli.length}</span></span>
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function StroopTestRunner({ client, onSave, onClose }) {
  const [step, setStep] = useState(0);

  // Setup
  const [setup, setSetup] = useState({
    environment: "Quiet clinic room", noiseLevel: "Low",
    visualImpairment: false, glassesWorn: false,
    dominantLanguage: "English", educationLevel: "",
    baselineFatigue: 0, baselineConcentration: 0,
    neurologicalDiagnosis: "", clinicianAdministered: true,
  });

  // Trial results
  const [t1, setT1] = useState(null); // { time, errors, selfCorrections, completed, accuracy }
  const [t2, setT2] = useState(null);
  const [t3, setT3] = useState(null);

  // Observations
  const [observations, setObservations] = useState({
    frustration: false, selfMonitoring: false, impulsivity: false,
    perseveration: false, fatigueDuringTest: false, verbalStrategies: false,
    behaviorNotes: "",
  });

  const [clinicalNotes, setClinicalNotes] = useState("");

  // Client age
  const age = client?.date_of_birth
    ? Math.floor((Date.now() - new Date(client.date_of_birth)) / (365.25 * 24 * 3600 * 1000))
    : null;

  const norms = getAgeNorm(age);

  // Scores per 45s (estimated from time + completed items)
  const score45 = (trial) => {
    if (!trial) return null;
    if (trial.time <= 0) return null;
    // Items per second × 45
    const rate = trial.completed / trial.time;
    return parseFloat((rate * 45).toFixed(1));
  };

  const s1 = score45(t1);
  const s2 = score45(t2);
  const s3 = score45(t3);
  const interferenceScore = calcInterference(s1, s2, s3);

  const z1 = norms && s1 ? zScore(s1, norms.t1.mean, norms.t1.sd) : null;
  const z2 = norms && s2 ? zScore(s2, norms.t2.mean, norms.t2.sd) : null;
  const z3 = norms && s3 ? zScore(s3, norms.t3.mean, norms.t3.sd) : null;

  const c1 = classifyZ(z1); const c2 = classifyZ(z2); const c3 = classifyZ(z3);

  // Interference index classification
  function classifyInterference(idx) {
    if (idx === null) return null;
    if (idx >= 5) return { label: "Minimal Interference", color: "bg-green-100 text-green-800 border-green-300" };
    if (idx >= 0) return { label: "Mild Interference", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
    if (idx >= -5) return { label: "Moderate Interference", color: "bg-orange-100 text-orange-800 border-orange-300" };
    return { label: "Severe Interference", color: "bg-red-100 text-red-800 border-red-300" };
  }
  const intClass = classifyInterference(interferenceScore);

  // Auto interpretation
  const generateInterpretation = () => {
    if (!t1 || !t2 || !t3) return "";
    const iLabel = intClass?.label || "—";
    const execLabel = c3?.label || "—";
    const speedLabel = c1?.label || "—";
    const colorLabel = c2?.label || "—";
    const errorsT3 = t3?.errors || 0;

    let text = `Stroop Test completed across all three conditions. Word reading speed was classified as ${speedLabel}, colour naming as ${colorLabel}, and interference condition performance as ${execLabel}.`;
    if (interferenceScore !== null) text += ` The Stroop Interference Index was ${interferenceScore} (${iLabel}), indicating ${interferenceScore < 0 ? "greater-than-expected performance decrement during the incongruent condition, consistent with reduced inhibitory control" : "performance within expected range for the interference effect"}.`;
    if (errorsT3 > 3) text += ` Elevated error rate during the interference trial (${errorsT3} errors) suggests impulsivity or difficulty suppressing the dominant word-reading response.`;
    if (observations.perseveration) text += " Perseverative errors were noted, which may reflect frontal lobe executive dysfunction.";
    if (observations.impulsivity) text += " Impulsive responding was observed during the interference condition.";
    if (observations.fatigueDuringTest) text += " Cognitive fatigue was noted during testing.";
    text += " Findings should be interpreted alongside the broader neuropsychological profile and clinical history.";
    return text;
  };

  // Flags
  const generateFlags = () => {
    const flags = [];
    if (!t1 || !t2 || !t3) return flags;
    if (c3?.label === "Impaired" || c3?.label === "Low") flags.push({ label: "Impaired interference condition — executive dysfunction concern", severity: "high" });
    else if (c3?.label === "Below Average") flags.push({ label: "Below average inhibitory control", severity: "medium" });
    if (c2?.label === "Impaired" || c2?.label === "Low") flags.push({ label: "Slowed colour naming — processing speed concern", severity: "high" });
    if (interferenceScore !== null && interferenceScore < -5) flags.push({ label: "Severe Stroop interference effect", severity: "high" });
    if ((t3?.errors || 0) > 5) flags.push({ label: "High error rate in interference trial — impulsivity / inhibitory control deficit", severity: "high" });
    if (observations.perseveration) flags.push({ label: "Perseverative errors — possible frontal lobe involvement", severity: "medium" });
    if (observations.impulsivity) flags.push({ label: "Impulsive responding observed", severity: "medium" });
    if (setup.visualImpairment) flags.push({ label: "Visual impairment present — interpret with caution", severity: "low" });
    if (setup.baselineFatigue >= 6) flags.push({ label: "High baseline fatigue — may affect performance", severity: "medium" });
    if (z3 !== null && z3 < -1.5) flags.push({ label: "Consider neuropsychological referral", severity: "info" });
    flags.push({ label: "Monitor with serial testing for cognitive change", severity: "info" });
    return flags;
  };

  const flagColorMap = { high: "bg-red-100 text-red-800 border-red-200", medium: "bg-yellow-100 text-yellow-800 border-yellow-200", low: "bg-blue-100 text-blue-800 border-blue-200", info: "bg-slate-100 text-slate-700 border-slate-200" };

  // SOAP
  const generateSoap = () => {
    if (!t1) return "";
    const lines = ["• Stroop Test (Selective Attention, Inhibitory Control, Processing Speed)"];
    if (t1) lines.push(`  Trial 1 — Word Reading: ${t1.time}s | Items: ${t1.completed} | Errors: ${t1.errors}${s1 ? ` | Score/45s: ${s1}` : ""}${z1 !== null ? ` | Z-score: ${z1} (${c1.label})` : ""}`);
    if (t2) lines.push(`  Trial 2 — Colour Naming: ${t2.time}s | Items: ${t2.completed} | Errors: ${t2.errors}${s2 ? ` | Score/45s: ${s2}` : ""}${z2 !== null ? ` | Z-score: ${z2} (${c2.label})` : ""}`);
    if (t3) lines.push(`  Trial 3 — Interference: ${t3.time}s | Items: ${t3.completed} | Errors: ${t3.errors}${s3 ? ` | Score/45s: ${s3}` : ""}${z3 !== null ? ` | Z-score: ${z3} (${c3.label})` : ""}`);
    if (interferenceScore !== null) lines.push(`  Stroop Interference Index: ${interferenceScore} (${intClass?.label})`);
    if (clinicalNotes) lines.push(`  Clinical Notes: ${clinicalNotes}`);
    lines.push(`  Interpretation: ${generateInterpretation()}`);
    return lines.join("\n");
  };

  const allTrialsDone = !!t1 && !!t2 && !!t3;
  const canSave = allTrialsDone;

  const handleSave = () => {
    if (!canSave) { toast.error("Complete all three trials before saving."); return; }
    onSave({
      status: "completed",
      result_value: t3?.time || 0,
      notes: clinicalNotes,
      assessment_date: todayLocal(),
      additional_data: {
        soap_text: generateSoap(),
        measurement_type: "stroop_test",
        trial1: { ...t1, score_45s: s1, z_score: z1, classification: c1?.label },
        trial2: { ...t2, score_45s: s2, z_score: z2, classification: c2?.label },
        trial3: { ...t3, score_45s: s3, z_score: z3, classification: c3?.label },
        interference_index: interferenceScore,
        interference_classification: intClass?.label,
        setup,
        observations,
        flags: generateFlags().map(f => f.label),
        interpretation: generateInterpretation(),
      },
    });
    toast.success("Stroop Test saved successfully.");
  };

  const STEPS = [
    { label: "Overview", icon: Info },
    { label: "Setup", icon: Activity },
    { label: "Trial 1", icon: Eye },
    { label: "Trial 2", icon: Eye },
    { label: "Trial 3", icon: Brain },
    { label: "Observations", icon: Flag },
    { label: "Results", icon: FileText },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[98vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b bg-gradient-to-r from-purple-50 to-indigo-50 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Stroop Test</h2>
            <p className="text-xs text-slate-500 mt-0.5">Selective attention • Inhibitory control • Executive function • Processing speed</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Step Nav */}
        <div className="flex overflow-x-auto border-b bg-slate-50 shrink-0 px-2 py-1 gap-1">
          {STEPS.map((s, i) => {
            const done = (i === 2 && t1) || (i === 3 && t2) || (i === 4 && t3);
            return (
              <button key={i} onClick={() => setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${step === i ? "bg-purple-600 text-white" : done ? "bg-green-100 text-green-700" : "text-slate-500 hover:bg-slate-100"}`}>
                {done ? <CheckCircle2 className="w-3 h-3" /> : <s.icon className="w-3 h-3" />}
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ── STEP 0: OVERVIEW ─────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <h3 className="font-bold text-purple-900 mb-2 flex items-center gap-2"><Brain className="w-4 h-4" />Assessment Overview</h3>
                <p className="text-sm text-purple-800 mb-3">The Stroop Test is a foundational neuropsychological instrument measuring selective attention, inhibitory control, processing speed, and cognitive flexibility. It exploits the automaticity of word reading versus the effortful process of colour naming to reveal frontal lobe executive function.</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {["Cognitive screening", "Executive dysfunction", "Parkinson's disease", "TBI / Concussion", "Dementia screening", "ADHD", "Dual-tasking", "Frontal lobe function", "Cognitive rehabilitation", "Falls risk — dual task", "Neuro rehab", "Neuropsychological profiling"].map(u => (
                    <div key={u} className="flex items-center gap-1.5 text-purple-700"><CheckCircle2 className="w-3 h-3 shrink-0" />{u}</div>
                  ))}
                </div>
              </div>

              <Section title="Trial Structure" icon={Clock} defaultOpen accent="purple">
                <div className="space-y-3 text-sm">
                  {[
                    { label: "Trial 1 — Word Reading", desc: "Read the printed words aloud as quickly and accurately as possible. Words are printed in black ink.", color: "bg-slate-50 border-slate-200" },
                    { label: "Trial 2 — Colour Naming", desc: "Name the colour of the ink/patch. Do not read the letters. Respond as quickly and accurately as possible.", color: "bg-blue-50 border-blue-200" },
                    { label: "Trial 3 — Interference (Incongruent)", desc: "Name the INK colour only — ignore the printed word. This creates cognitive conflict requiring inhibitory control.", color: "bg-purple-50 border-purple-200" },
                  ].map((t, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${t.color}`}>
                      <p className="font-semibold text-slate-900">{t.label}</p>
                      <p className="text-slate-600 mt-0.5">{t.desc}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Instructional Images" icon={Eye} accent="slate">
                <div className="grid grid-cols-2 gap-3">

                  {/* Diagram 1: Congruent Colour-Word Stimuli */}
                  <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
                    <svg viewBox="0 0 200 160" className="w-full" xmlns="http://www.w3.org/2000/svg">
                      <rect width="200" height="160" fill="#f8fafc"/>
                      {/* Card border */}
                      <rect x="8" y="8" width="184" height="120" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
                      {/* Header */}
                      <rect x="8" y="8" width="184" height="22" rx="6" fill="#dcfce7"/>
                      <rect x="8" y="22" width="184" height="8" fill="#dcfce7"/>
                      <text x="100" y="23" textAnchor="middle" fontSize="9" fill="#166534" fontWeight="700">CONGRUENT STIMULI — Trial 1 &amp; 2</text>
                      {/* Word grid — word matches ink colour */}
                      <text x="30" y="52" textAnchor="middle" fontSize="14" fill="#dc2626" fontWeight="800">RED</text>
                      <text x="80" y="52" textAnchor="middle" fontSize="14" fill="#2563eb" fontWeight="800">BLUE</text>
                      <text x="135" y="52" textAnchor="middle" fontSize="14" fill="#16a34a" fontWeight="800">GREEN</text>
                      <text x="30" y="76" textAnchor="middle" fontSize="14" fill="#16a34a" fontWeight="800">GREEN</text>
                      <text x="80" y="76" textAnchor="middle" fontSize="14" fill="#dc2626" fontWeight="800">RED</text>
                      <text x="140" y="76" textAnchor="middle" fontSize="14" fill="#ca8a04" fontWeight="800">YELLOW</text>
                      <text x="35" y="100" textAnchor="middle" fontSize="14" fill="#2563eb" fontWeight="800">BLUE</text>
                      <text x="90" y="100" textAnchor="middle" fontSize="14" fill="#ca8a04" fontWeight="800">YELLOW</text>
                      <text x="155" y="100" textAnchor="middle" fontSize="14" fill="#dc2626" fontWeight="800">RED</text>
                      {/* Tick */}
                      <circle cx="174" cy="118" r="7" fill="#16a34a"/>
                      <text x="174" y="122" textAnchor="middle" fontSize="10" fill="white" fontWeight="900">✓</text>
                      <text x="100" y="148" textAnchor="middle" fontSize="8" fill="#475569">Word colour = word meaning</text>
                    </svg>
                    <p className="text-xs text-slate-500 text-center px-2 pb-2">Congruent Colour-Word Stimuli — word matches ink colour</p>
                  </div>

                  {/* Diagram 2: Incongruent Colour-Word Stimuli */}
                  <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
                    <svg viewBox="0 0 200 160" className="w-full" xmlns="http://www.w3.org/2000/svg">
                      <rect width="200" height="160" fill="#faf5ff"/>
                      {/* Card border */}
                      <rect x="8" y="8" width="184" height="120" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
                      {/* Header */}
                      <rect x="8" y="8" width="184" height="22" rx="6" fill="#f3e8ff"/>
                      <rect x="8" y="22" width="184" height="8" fill="#f3e8ff"/>
                      <text x="100" y="23" textAnchor="middle" fontSize="9" fill="#6b21a8" fontWeight="700">INCONGRUENT STIMULI — Trial 3</text>
                      {/* Word grid — word DOES NOT match ink colour */}
                      <text x="30" y="52" textAnchor="middle" fontSize="14" fill="#2563eb" fontWeight="800">RED</text>
                      <text x="80" y="52" textAnchor="middle" fontSize="14" fill="#16a34a" fontWeight="800">BLUE</text>
                      <text x="138" y="52" textAnchor="middle" fontSize="14" fill="#ca8a04" fontWeight="800">GREEN</text>
                      <text x="35" y="76" textAnchor="middle" fontSize="14" fill="#dc2626" fontWeight="800">BLUE</text>
                      <text x="85" y="76" textAnchor="middle" fontSize="14" fill="#ca8a04" fontWeight="800">RED</text>
                      <text x="148" y="76" textAnchor="middle" fontSize="14" fill="#2563eb" fontWeight="800">YELLOW</text>
                      <text x="32" y="100" textAnchor="middle" fontSize="14" fill="#ca8a04" fontWeight="800">RED</text>
                      <text x="90" y="100" textAnchor="middle" fontSize="14" fill="#dc2626" fontWeight="800">GREEN</text>
                      <text x="153" y="100" textAnchor="middle" fontSize="14" fill="#16a34a" fontWeight="800">BLUE</text>
                      {/* Conflict arrows */}
                      <text x="170" y="55" fontSize="9" fill="#7c3aed" fontWeight="700">≠</text>
                      <text x="170" y="79" fontSize="9" fill="#7c3aed" fontWeight="700">≠</text>
                      <text x="174" y="118" textAnchor="middle" fontSize="8" fill="#7c3aed" fontWeight="700">INK!</text>
                      <text x="100" y="148" textAnchor="middle" fontSize="8" fill="#475569">Name the INK colour — ignore the word</text>
                    </svg>
                    <p className="text-xs text-slate-500 text-center px-2 pb-2">Incongruent Colour-Word Stimuli — word conflicts with ink colour</p>
                  </div>

                  {/* Diagram 3: Verbal Response / Administration */}
                  <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
                    <svg viewBox="0 0 200 160" className="w-full" xmlns="http://www.w3.org/2000/svg">
                      <rect width="200" height="160" fill="#f0f9ff"/>
                      {/* Clinician figure left */}
                      <circle cx="38" cy="42" r="11" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5"/>
                      <rect x="28" y="53" width="20" height="26" rx="5" fill="#0369a1"/>
                      <line x1="28" y1="61" x2="16" y2="72" stroke="#0369a1" strokeWidth="4" strokeLinecap="round"/>
                      <line x1="48" y1="61" x2="60" y2="68" stroke="#0369a1" strokeWidth="4" strokeLinecap="round"/>
                      <line x1="33" y1="79" x2="30" y2="100" stroke="#0369a1" strokeWidth="4" strokeLinecap="round"/>
                      <line x1="43" y1="79" x2="46" y2="100" stroke="#0369a1" strokeWidth="4" strokeLinecap="round"/>
                      <text x="38" y="115" textAnchor="middle" fontSize="7" fill="#0369a1" fontWeight="600">Clinician</text>
                      {/* Stroop card in clinician hand */}
                      <rect x="58" y="58" width="32" height="24" rx="3" fill="white" stroke="#94a3b8" strokeWidth="1.5"/>
                      <text x="74" y="68" textAnchor="middle" fontSize="7" fill="#dc2626" fontWeight="800">RED</text>
                      <text x="74" y="78" textAnchor="middle" fontSize="7" fill="#2563eb" fontWeight="800">BLUE</text>
                      {/* Speech bubble from client */}
                      <ellipse cx="148" cy="55" rx="38" ry="18" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5"/>
                      <polygon points="118,65 110,78 128,68" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1"/>
                      <text x="148" y="51" textAnchor="middle" fontSize="10" fill="#1e40af" fontWeight="800">"BLUE"</text>
                      <text x="148" y="63" textAnchor="middle" fontSize="7" fill="#3b82f6">verbal response</text>
                      {/* Client figure right */}
                      <circle cx="160" cy="100" r="11" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5"/>
                      <rect x="150" y="111" width="20" height="26" rx="5" fill="#7c3aed"/>
                      <line x1="150" y1="119" x2="138" y2="128" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round"/>
                      <line x1="170" y1="119" x2="182" y2="128" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round"/>
                      <text x="160" y="148" textAnchor="middle" fontSize="7" fill="#7c3aed" fontWeight="600">Participant</text>
                      {/* Timer */}
                      <circle cx="100" cy="118" r="12" fill="white" stroke="#f97316" strokeWidth="2"/>
                      <text x="100" y="115" textAnchor="middle" fontSize="7" fill="#ea580c" fontWeight="700">â±</text>
                      <text x="100" y="124" textAnchor="middle" fontSize="6" fill="#9a3412">45s</text>
                    </svg>
                    <p className="text-xs text-slate-500 text-center px-2 pb-2">Verbal Response Testing — clinician records timed oral responses</p>
                  </div>

                  {/* Diagram 4: Scoring / Response Recording Sheet */}
                  <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
                    <svg viewBox="0 0 200 160" className="w-full" xmlns="http://www.w3.org/2000/svg">
                      <rect width="200" height="160" fill="#fefce8"/>
                      {/* Sheet background */}
                      <rect x="12" y="10" width="176" height="135" rx="5" fill="white" stroke="#d1d5db" strokeWidth="1.5"/>
                      {/* Header row */}
                      <rect x="12" y="10" width="176" height="18" rx="5" fill="#fef3c7"/>
                      <rect x="12" y="20" width="176" height="8" fill="#fef3c7"/>
                      <text x="100" y="23" textAnchor="middle" fontSize="9" fill="#92400e" fontWeight="700">Stroop Test — Response Recording</text>
                      {/* Column headers */}
                      <text x="28" y="40" fontSize="8" fill="#64748b" fontWeight="600">Trial</text>
                      <text x="80" y="40" textAnchor="middle" fontSize="8" fill="#64748b" fontWeight="600">Time (s)</text>
                      <text x="130" y="40" textAnchor="middle" fontSize="8" fill="#64748b" fontWeight="600">Items</text>
                      <text x="172" y="40" textAnchor="middle" fontSize="8" fill="#64748b" fontWeight="600">Errors</text>
                      <line x1="16" y1="43" x2="184" y2="43" stroke="#e2e8f0" strokeWidth="1"/>
                      {/* Row 1 — Trial 1 */}
                      <rect x="14" y="44" width="172" height="22" fill="#f8fafc"/>
                      <text x="20" y="58" fontSize="8" fill="#1e293b">T1 — Word Read</text>
                      <rect x="64" y="48" width="32" height="13" rx="3" fill="white" stroke="#cbd5e1" strokeWidth="1"/>
                      <text x="80" y="58" textAnchor="middle" fontSize="8" fill="#334155">___</text>
                      <rect x="114" y="48" width="28" height="13" rx="3" fill="white" stroke="#cbd5e1" strokeWidth="1"/>
                      <text x="128" y="58" textAnchor="middle" fontSize="8" fill="#334155">___</text>
                      <rect x="158" y="48" width="22" height="13" rx="3" fill="white" stroke="#cbd5e1" strokeWidth="1"/>
                      <text x="169" y="58" textAnchor="middle" fontSize="8" fill="#334155">___</text>
                      {/* Row 2 — Trial 2 */}
                      <rect x="14" y="66" width="172" height="22" fill="white"/>
                      <text x="20" y="80" fontSize="8" fill="#1e293b">T2 — Colour Name</text>
                      <rect x="64" y="70" width="32" height="13" rx="3" fill="white" stroke="#cbd5e1" strokeWidth="1"/>
                      <text x="80" y="80" textAnchor="middle" fontSize="8" fill="#334155">___</text>
                      <rect x="114" y="70" width="28" height="13" rx="3" fill="white" stroke="#cbd5e1" strokeWidth="1"/>
                      <text x="128" y="80" textAnchor="middle" fontSize="8" fill="#334155">___</text>
                      <rect x="158" y="70" width="22" height="13" rx="3" fill="white" stroke="#cbd5e1" strokeWidth="1"/>
                      <text x="169" y="80" textAnchor="middle" fontSize="8" fill="#334155">___</text>
                      {/* Row 3 — Trial 3 */}
                      <rect x="14" y="88" width="172" height="22" fill="#faf5ff"/>
                      <text x="20" y="102" fontSize="8" fill="#6b21a8" fontWeight="600">T3 — Interference</text>
                      <rect x="64" y="92" width="32" height="13" rx="3" fill="white" stroke="#a78bfa" strokeWidth="1.5"/>
                      <text x="80" y="102" textAnchor="middle" fontSize="8" fill="#7c3aed">___</text>
                      <rect x="114" y="92" width="28" height="13" rx="3" fill="white" stroke="#a78bfa" strokeWidth="1.5"/>
                      <text x="128" y="102" textAnchor="middle" fontSize="8" fill="#7c3aed">___</text>
                      <rect x="158" y="92" width="22" height="13" rx="3" fill="white" stroke="#a78bfa" strokeWidth="1.5"/>
                      <text x="169" y="102" textAnchor="middle" fontSize="8" fill="#7c3aed">___</text>
                      {/* Interference index row */}
                      <line x1="16" y1="112" x2="184" y2="112" stroke="#e2e8f0" strokeWidth="1"/>
                      <text x="20" y="124" fontSize="8" fill="#334155" fontWeight="600">Interference Index</text>
                      <rect x="120" y="116" width="60" height="13" rx="3" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1.5"/>
                      <text x="150" y="126" textAnchor="middle" fontSize="8" fill="#6d28d9" fontWeight="700">T3−(T1×T2/T1+T2)</text>
                      <text x="100" y="147" textAnchor="middle" fontSize="7.5" fill="#64748b">Golden CJ (1978) — Standard Stroop Scoring</text>
                    </svg>
                    <p className="text-xs text-slate-500 text-center px-2 pb-2">Response Recording Sheet — time, items completed, and errors per trial</p>
                  </div>

                </div>
                <div className="mt-3 p-3 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-700 space-y-1">
                  <p><strong>Administration Tips:</strong></p>
                  <p>① Seat client comfortably at table in good lighting</p>
                  <p>② Confirm vision is adequate (glasses on if needed)</p>
                  <p>③ Demonstrate once before each trial</p>
                  <p>④ Record errors by pressing Error button — do not prompt corrections</p>
                  <p>⑤ Start timer on "Go" — stop when last item named</p>
                  <p>⑥ Allow brief rest between trials</p>
                </div>
              </Section>

              <Section title="Participant Instructions (Read Aloud)" icon={Info} accent="blue">
                <div className="space-y-3">
                  {[
                    { t: "Trial 1", s: '"I will show you a list of words. Please read each word aloud as quickly as you can, starting at the top left and working across each row. Ready? Go."' },
                    { t: "Trial 2", s: '"Now I will show you coloured patches. Please say the COLOUR of each patch as quickly as you can. Do not read any letters — name the colour. Ready? Go."' },
                    { t: "Trial 3", s: '"This time the words name colours, but they are printed in a different ink colour. Please say the INK COLOUR — ignore the word itself. For example, if you see the word RED printed in blue ink, say BLUE. Ready? Go."' },
                  ].map(item => (
                    <div key={item.t} className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                      <p className="font-semibold text-green-900 mb-1">{item.t}</p>
                      <p className="italic">{item.s}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Button onClick={() => setStep(1)} className="w-full bg-purple-600 hover:bg-purple-700">Begin Assessment →</Button>
            </div>
          )}

          {/* ── STEP 1: SETUP ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm text-purple-800">
                <Activity className="w-4 h-4 inline mr-1" /><strong>Test Setup</strong> — Capture environmental and client factors.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Environment</Label>
                  <select value={setup.environment} onChange={e => setSetup(p => ({ ...p, environment: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                    <option>Quiet clinic room</option><option>Clinic — some noise</option><option>Ward / bedside</option><option>Home visit</option><option>Noisy environment</option>
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Noise Level</Label>
                  <div className="flex gap-2 mt-1">
                    {["Low", "Moderate", "High"].map(v => (
                      <button key={v} onClick={() => setSetup(p => ({ ...p, noiseLevel: v }))} className={`flex-1 py-1.5 rounded-lg border text-xs transition-colors ${setup.noiseLevel === v ? "bg-purple-600 text-white border-purple-600" : "bg-white text-slate-600 border-slate-300"}`}>{v}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Dominant Language</Label>
                  <input value={setup.dominantLanguage} onChange={e => setSetup(p => ({ ...p, dominantLanguage: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Education Level</Label>
                  <select value={setup.educationLevel} onChange={e => setSetup(p => ({ ...p, educationLevel: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                    <option value="">Select...</option>
                    <option>Primary school</option><option>Secondary school</option><option>Trade / Cert</option><option>Undergraduate</option><option>Postgraduate</option>
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Neurological Diagnosis</Label>
                  <input value={setup.neurologicalDiagnosis} onChange={e => setSetup(p => ({ ...p, neurologicalDiagnosis: e.target.value }))} placeholder="e.g. Parkinson's, TBI, nil" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "visualImpairment", label: "Visual impairment present" },
                  { key: "glassesWorn", label: "Glasses worn for testing" },
                  { key: "clinicianAdministered", label: "Clinician administered" },
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border">
                    <Checkbox checked={!!setup[item.key]} onCheckedChange={v => setSetup(p => ({ ...p, [item.key]: !!v }))} />
                    <Label className="text-sm">{item.label}</Label>
                  </div>
                ))}
              </div>

              <RatingRow label="Baseline Fatigue (0–10)" value={setup.baselineFatigue} onChange={v => setSetup(p => ({ ...p, baselineFatigue: v }))} />
              <RatingRow label="Baseline Concentration (0–10)" value={setup.baselineConcentration} onChange={v => setSetup(p => ({ ...p, baselineConcentration: v }))} />

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1">â† Back</Button>
                <Button onClick={() => setStep(2)} className="flex-1 bg-purple-600 hover:bg-purple-700">Trial 1 →</Button>
              </div>
            </div>
          )}

          {/* ── STEP 2: TRIAL 1 ──────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <TrialRunner
                trial="reading"
                stimuli={TRIAL1_WORDS}
                trialLabel="Trial 1 — Word Reading"
                instruction="Read each word aloud, left to right, as quickly and accurately as possible."
                color="bg-slate-50 border-slate-200 text-slate-800"
                onComplete={data => { setT1(data); toast.success("Trial 1 complete!"); }}
              />
              {t1 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" />Trial 1 saved: <strong>{t1.time}s</strong> | {t1.completed} items | {t1.errors} errors | {t1.accuracy}% accuracy
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">â† Back</Button>
                <Button onClick={() => setStep(3)} disabled={!t1} className="flex-1 bg-purple-600 hover:bg-purple-700">Trial 2 →</Button>
              </div>
            </div>
          )}

          {/* ── STEP 3: TRIAL 2 ──────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <TrialRunner
                trial="color"
                stimuli={TRIAL2_COLORS}
                trialLabel="Trial 2 — Colour Naming"
                instruction="Name the INK COLOUR of each patch. Do not read the letters — name only the colour."
                color="bg-blue-50 border-blue-200 text-blue-800"
                onComplete={data => { setT2(data); toast.success("Trial 2 complete!"); }}
              />
              {t2 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" />Trial 2 saved: <strong>{t2.time}s</strong> | {t2.completed} items | {t2.errors} errors | {t2.accuracy}% accuracy
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">â† Back</Button>
                <Button onClick={() => setStep(4)} disabled={!t2} className="flex-1 bg-purple-600 hover:bg-purple-700">Trial 3 →</Button>
              </div>
            </div>
          )}

          {/* ── STEP 4: TRIAL 3 ──────────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-700">
                <AlertTriangle className="w-3 h-3 inline mr-1" /><strong>Interference Trial:</strong> The word and ink colour are DIFFERENT. Client must name the INK colour only — ignoring the word. This creates cognitive conflict.
              </div>
              <TrialRunner
                trial="interference"
                stimuli={TRIAL3_INTERFERENCE}
                trialLabel="Trial 3 — Interference (Incongruent)"
                instruction="Name the INK COLOUR — ignore the printed word completely."
                color="bg-purple-50 border-purple-200 text-purple-800"
                onComplete={data => { setT3(data); toast.success("Trial 3 complete!"); }}
              />
              {t3 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" />Trial 3 saved: <strong>{t3.time}s</strong> | {t3.completed} items | {t3.errors} errors | {t3.accuracy}% accuracy
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1">â† Back</Button>
                <Button onClick={() => setStep(5)} disabled={!t3} className="flex-1 bg-purple-600 hover:bg-purple-700">Observations →</Button>
              </div>
            </div>
          )}

          {/* ── STEP 5: OBSERVATIONS ─────────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm text-purple-800">
                <Flag className="w-4 h-4 inline mr-1" /><strong>Behavioural Observations</strong> — Record what was observed during testing.
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "frustration", label: "Frustration / emotional dysregulation" },
                  { key: "selfMonitoring", label: "Self-monitoring / self-correction" },
                  { key: "impulsivity", label: "Impulsive responses noted" },
                  { key: "perseveration", label: "Perseverative errors" },
                  { key: "fatigueDuringTest", label: "Cognitive fatigue during test" },
                  { key: "verbalStrategies", label: "Used verbal strategies" },
                ].map(item => (
                  <div key={item.key} className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border">
                    <Checkbox checked={!!observations[item.key]} onCheckedChange={v => setObservations(p => ({ ...p, [item.key]: !!v }))} className="mt-0.5" />
                    <Label className="text-sm">{item.label}</Label>
                  </div>
                ))}
              </div>
              <div>
                <Label className="text-sm font-medium">Behaviour Notes</Label>
                <Textarea value={observations.behaviorNotes} onChange={e => setObservations(p => ({ ...p, behaviorNotes: e.target.value }))} placeholder="Describe any notable behaviours, strategies, or observations..." rows={3} className="mt-1" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(4)} className="flex-1">â† Back</Button>
                <Button onClick={() => setStep(6)} className="flex-1 bg-purple-600 hover:bg-purple-700">View Results →</Button>
              </div>
            </div>
          )}

          {/* ── STEP 6: RESULTS ──────────────────────────────────────────── */}
          {step === 6 && (
            <div className="space-y-4">

              {/* Trial summary */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Trial 1\nWord Reading", data: t1, score: s1, z: z1, cls: c1, color: "slate" },
                  { label: "Trial 2\nColour Naming", data: t2, score: s2, z: z2, cls: c2, color: "blue" },
                  { label: "Trial 3\nInterference", data: t3, score: s3, z: z3, cls: c3, color: "purple" },
                ].map(({ label, data, score, z, cls, color }) => (
                  <div key={label} className={`p-3 rounded-xl border-2 text-center ${cls ? cls.color : "bg-slate-50 border-slate-200"}`}>
                    <p className="text-xs font-semibold whitespace-pre-line mb-1">{label}</p>
                    <p className="text-2xl font-mono font-bold">{data ? `${data.time}s` : "—"}</p>
                    {score && <p className="text-xs mt-0.5">{score}/45s</p>}
                    {z !== null && <p className="text-xs">z = {z}</p>}
                    {cls && <p className="text-xs font-semibold mt-1">{cls.label}</p>}
                    {data && <p className="text-xs text-red-600">{data.errors} errors</p>}
                  </div>
                ))}
              </div>

              {/* Interference Score */}
              {interferenceScore !== null && intClass && (
                <div className={`border-2 rounded-xl p-4 text-center ${intClass.color}`}>
                  <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">Stroop Interference Index</p>
                  <p className="text-4xl font-bold">{interferenceScore > 0 ? "+" : ""}{interferenceScore}</p>
                  <p className="font-semibold mt-1">{intClass.label}</p>
                  <p className="text-xs mt-1 opacity-70">Positive = better than predicted; Negative = worse than predicted</p>
                </div>
              )}

              {/* Normative Comparison */}
              {norms && allTrialsDone && (
                <Section title="Normative Comparison (Golden, age-adjusted)" icon={Activity} defaultOpen accent="blue">
                  <div className="space-y-2 text-sm">
                    <p className="text-xs text-slate-500 mb-2">Scores expressed as items completed per 45 seconds. Norms: Golden CJ, {age ? `age ${age}` : ""}.</p>
                    {[
                      { label: "Trial 1 — Word Reading", score: s1, norm: norms.t1, z: z1, cls: c1 },
                      { label: "Trial 2 — Colour Naming", score: s2, norm: norms.t2, z: z2, cls: c2 },
                      { label: "Trial 3 — Interference", score: s3, norm: norms.t3, z: z3, cls: c3 },
                    ].map(row => (
                      <div key={row.label} className="p-2 bg-slate-50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-slate-700">{row.label}</span>
                          {row.cls && <Badge className={`text-xs ${row.cls.color}`}>{row.cls.label}</Badge>}
                        </div>
                        <div className="flex gap-4 text-xs text-slate-500 mt-1">
                          <span>Score: <strong className="text-slate-800">{row.score ?? "—"}</strong></span>
                          <span>Mean: {row.norm.mean} ± {row.norm.sd}</span>
                          {row.z !== null && <span>Z: {row.z}</span>}
                        </div>
                        {row.score && (
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, Math.max(5, (row.score / (row.norm.mean + row.norm.sd * 2)) * 100))}%` }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Interpretation */}
              <Section title="Clinical Interpretation" icon={Brain} defaultOpen accent="purple">
                <p className="text-sm text-slate-700 leading-relaxed">{generateInterpretation() || "Complete all trials to generate interpretation."}</p>
              </Section>

              {/* Cognitive Domains */}
              {allTrialsDone && (
                <Section title="Cognitive Domain Summary" icon={Activity} defaultOpen accent="teal">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { domain: "Processing Speed", from: "Trial 1 time", cls: c1 },
                      { domain: "Colour Naming Speed", from: "Trial 2 time", cls: c2 },
                      { domain: "Inhibitory Control", from: "Trial 3 + Interference", cls: c3 },
                      { domain: "Interference Effect", from: "Index score", cls: intClass ? { label: intClass.label, color: intClass.color } : null },
                    ].map(d => (
                      <div key={d.domain} className="p-2 bg-white border rounded-lg">
                        <p className="font-semibold text-slate-700">{d.domain}</p>
                        <p className="text-slate-400 text-xs">{d.from}</p>
                        {d.cls && <Badge className={`text-xs mt-1 ${d.cls.color}`}>{d.cls.label}</Badge>}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Flags */}
              {generateFlags().length > 0 && (
                <Section title="Clinical Flags" icon={Flag} defaultOpen accent="red">
                  <div className="space-y-2">
                    {generateFlags().map((f, i) => (
                      <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${flagColorMap[f.severity]}`}>
                        <Flag className="w-3 h-3 shrink-0" />{f.label}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* SOAP Preview */}
              <Section title="SOAP Note Preview" icon={FileText} accent="green">
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 rounded-lg p-3 border">{generateSoap() || "Complete all trials to generate SOAP."}</pre>
              </Section>

              {/* References */}
              <Section title="Evidence-Based References" icon={BookOpen} accent="slate">
                <div className="space-y-2 text-xs text-slate-600">
                  {[
                    { n: 1, t: "Stroop JR.", s: "Studies of interference in serial verbal reactions. Journal of Experimental Psychology. 1935;18(6):643–662." },
                    { n: 2, t: "Golden CJ.", s: "Stroop Color and Word Test: A Manual for Clinical and Experimental Uses. Stoelting Co; 1978." },
                    { n: 3, t: "Scarpina F, Tagini S.", s: "The Stroop Color and Word Test. Frontiers in Psychology. 2017;8:557." },
                    { n: 4, t: "MacLeod CM.", s: "Half a century of research on the Stroop effect: An integrative review. Psychological Bulletin. 1991;109(2):163–203." },
                    { n: 5, t: "Lezak MD, Howieson DB, Bigler ED, Tranel D.", s: "Neuropsychological Assessment. 5th ed. Oxford University Press; 2012." },
                  ].map(r => (
                    <div key={r.n} className="p-2 bg-slate-50 rounded border border-slate-200">
                      <p><span className="font-semibold">{r.n}.</span> {r.t} <em>{r.s}</em></p>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Clinical Notes */}
              <div>
                <Label className="text-sm font-semibold text-slate-700">Clinical Notes</Label>
                <Textarea value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)} placeholder="Cognitive observations, strategy use, clinical context, rehabilitation implications..." rows={3} className="mt-1" />
              </div>

              {!canSave && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />Complete all three trials before saving.
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(5)} className="flex-1">â† Back</Button>
                <Button onClick={handleSave} disabled={!canSave} className="flex-1 bg-purple-600 hover:bg-purple-700">
                  <Save className="w-4 h-4 mr-2" />Save Assessment
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 bg-slate-50 flex justify-between items-center shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-500">Cancel</Button>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {t1 && <span className="text-green-600 font-medium">T1 ✓</span>}
            {t2 && <span className="text-green-600 font-medium">T2 ✓</span>}
            {t3 && <span className="text-green-600 font-medium">T3 ✓</span>}
            {interferenceScore !== null && <span className="text-purple-600 font-medium">Index: {interferenceScore > 0 ? "+" : ""}{interferenceScore}</span>}
          </div>
          {step === 6 && (
            <Button onClick={handleSave} disabled={!canSave} size="sm" className="bg-purple-600 hover:bg-purple-700">
              <Save className="w-3 h-3 mr-1" />Save
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}