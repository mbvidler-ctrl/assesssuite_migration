import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Save, X, Play, Square, RotateCcw, Info, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Clock, Activity, BookOpen, Heart, Flag,
  FileText, Zap, Music
} from "lucide-react";
import { toast } from "sonner";
import CadencePlayerModal from "./CadencePlayerModal";

// ─── PROTOCOLS ────────────────────────────────────────────────────────────────
const PROTOCOLS = {
  ymca: {
    id: "ymca",
    name: "YMCA 3-Minute Step Test",
    duration: 180,
    cadence: 96,
    stepHeight: 30.5,
    recoveryAt: 60,
    population: "General adults (18–65)",
    description: "Submaximal aerobic fitness test. Step up-up-down-down at 96 steps/min for 3 minutes. Measure HR at 1 minute of recovery.",
    notes: "Most widely used submaximal step test. Recovery HR is the primary outcome.",
    cadenceUrl: "https://www.youtube.com/watch?v=iJwwJgCIHBU",
    cadenceDescription: "96 BPM cadence and timing structure for the YMCA 3-Minute Step Test. Assists in maintaining correct stepping rhythm throughout the assessment.",
  },
  queens: {
    id: "queens",
    name: "Queen's College Step Test",
    duration: 180,
    cadence: { male: 96, female: 88 },
    stepHeight: 41.3,
    recoveryAt: 15,
    population: "College-age adults (18–35)",
    description: "Submaximal VO2max estimation. Males step at 24 cycles/min, females at 22 cycles/min for 3 minutes.",
    notes: "VO2max estimated from recovery HR. Males: VO2max = 111.33 − (0.42 × HR). Females: VO2max = 65.81 − (0.1847 × HR).",
    cadenceUrl: { male: "https://www.youtube.com/watch?v=mO0DiN5t8PE", female: "https://www.youtube.com/watch?v=Ln9rNK1eeBg" },
    cadenceDescription: { male: "96 BPM cadence track for the male Queen's College Step Test protocol.", female: "88 BPM cadence track for the female Queen's College Step Test protocol." },
  },
  modified_older: {
    id: "modified_older",
    name: "Modified Older Adult Step Test",
    duration: 120,
    cadence: 60,
    stepHeight: 20,
    recoveryAt: 60,
    population: "Older adults (65+), deconditioned",
    description: "Reduced cadence and step height for older or deconditioned clients. 2-minute duration at 60 steps/min.",
    notes: "Interpret HR recovery relative to baseline. Safety and symptom monitoring is primary.",
    cadenceUrl: "https://www.youtube.com/watch?v=ymJIXzvDvj4",
    cadenceDescription: "Reduced cadence metronome designed for lower functional capacity populations to support safe and controlled pacing.",
  },
  harvard: {
    id: "harvard",
    name: "Harvard Step Test (Full)",
    duration: 300,
    cadence: 120,
    stepHeight: 50.8,
    recoveryAt: 60,
    population: "Young athletic adults",
    description: "5-minute step test at 120 steps/min (30 cycles/min). Score = (duration × 100) / (2 × sum of 3 recovery HRs).",
    notes: "Fitness Index calculated from 3 recovery HRs (1–1:30, 2–2:30, 3–3:30 min post-exercise).",
    cadenceUrl: "https://www.youtube.com/results?search_query=120+bpm+metronome",
    cadenceDescription: "120 BPM cadence resource for the Harvard Step Test cardiovascular endurance protocol.",
  },
  custom: {
    id: "custom",
    name: "Custom Step Test",
    duration: 180,
    cadence: 96,
    stepHeight: 30,
    recoveryAt: 60,
    population: "Clinician-defined",
    description: "Fully customisable protocol. Set your own duration, cadence, and step height.",
    notes: "Document rationale for modified parameters in clinical notes.",
  },
};

// ─── NORMATIVE DATA (YMCA Recovery HR classification) ─────────────────────────
const YMCA_NORMS = {
  male: {
    "18-25": [
      { label: "Excellent", min: 0, max: 79 },
      { label: "Good", min: 80, max: 89 },
      { label: "Above Average", min: 90, max: 99 },
      { label: "Average", min: 100, max: 105 },
      { label: "Below Average", min: 106, max: 116 },
      { label: "Poor", min: 117, max: 130 },
      { label: "Very Poor", min: 131, max: 999 },
    ],
    "26-35": [
      { label: "Excellent", min: 0, max: 81 },
      { label: "Good", min: 82, max: 89 },
      { label: "Above Average", min: 90, max: 99 },
      { label: "Average", min: 100, max: 107 },
      { label: "Below Average", min: 108, max: 118 },
      { label: "Poor", min: 119, max: 128 },
      { label: "Very Poor", min: 129, max: 999 },
    ],
    "36-45": [
      { label: "Excellent", min: 0, max: 83 },
      { label: "Good", min: 84, max: 91 },
      { label: "Above Average", min: 92, max: 101 },
      { label: "Average", min: 102, max: 111 },
      { label: "Below Average", min: 112, max: 119 },
      { label: "Poor", min: 120, max: 130 },
      { label: "Very Poor", min: 131, max: 999 },
    ],
    "46-55": [
      { label: "Excellent", min: 0, max: 87 },
      { label: "Good", min: 88, max: 95 },
      { label: "Above Average", min: 96, max: 104 },
      { label: "Average", min: 105, max: 113 },
      { label: "Below Average", min: 114, max: 122 },
      { label: "Poor", min: 123, max: 132 },
      { label: "Very Poor", min: 133, max: 999 },
    ],
    "56-65": [
      { label: "Excellent", min: 0, max: 86 },
      { label: "Good", min: 87, max: 97 },
      { label: "Above Average", min: 98, max: 108 },
      { label: "Average", min: 109, max: 117 },
      { label: "Below Average", min: 118, max: 126 },
      { label: "Poor", min: 127, max: 135 },
      { label: "Very Poor", min: 136, max: 999 },
    ],
  },
  female: {
    "18-25": [
      { label: "Excellent", min: 0, max: 85 },
      { label: "Good", min: 86, max: 98 },
      { label: "Above Average", min: 99, max: 108 },
      { label: "Average", min: 109, max: 117 },
      { label: "Below Average", min: 118, max: 126 },
      { label: "Poor", min: 127, max: 140 },
      { label: "Very Poor", min: 141, max: 999 },
    ],
    "26-35": [
      { label: "Excellent", min: 0, max: 88 },
      { label: "Good", min: 89, max: 99 },
      { label: "Above Average", min: 100, max: 111 },
      { label: "Average", min: 112, max: 119 },
      { label: "Below Average", min: 120, max: 126 },
      { label: "Poor", min: 127, max: 138 },
      { label: "Very Poor", min: 139, max: 999 },
    ],
    "36-45": [
      { label: "Excellent", min: 0, max: 90 },
      { label: "Good", min: 91, max: 102 },
      { label: "Above Average", min: 103, max: 110 },
      { label: "Average", min: 111, max: 118 },
      { label: "Below Average", min: 119, max: 128 },
      { label: "Poor", min: 129, max: 140 },
      { label: "Very Poor", min: 141, max: 999 },
    ],
    "46-55": [
      { label: "Excellent", min: 0, max: 94 },
      { label: "Good", min: 95, max: 104 },
      { label: "Above Average", min: 105, max: 115 },
      { label: "Average", min: 116, max: 120 },
      { label: "Below Average", min: 121, max: 129 },
      { label: "Poor", min: 130, max: 140 },
      { label: "Very Poor", min: 141, max: 999 },
    ],
    "56-65": [
      { label: "Excellent", min: 0, max: 95 },
      { label: "Good", min: 96, max: 106 },
      { label: "Above Average", min: 107, max: 118 },
      { label: "Average", min: 119, max: 126 },
      { label: "Below Average", min: 127, max: 135 },
      { label: "Poor", min: 136, max: 148 },
      { label: "Very Poor", min: 149, max: 999 },
    ],
  },
};

function getAgeGroup(age) {
  if (age < 26) return "18-25";
  if (age < 36) return "26-35";
  if (age < 46) return "36-45";
  if (age < 56) return "46-55";
  return "56-65";
}

function classifyYMCA(recoveryHR, age, gender) {
  if (!recoveryHR || !age || !gender) return null;
  const g = gender === "male" ? "male" : "female";
  const ag = getAgeGroup(age);
  const rows = YMCA_NORMS[g]?.[ag];
  if (!rows) return null;
  const match = rows.find(r => recoveryHR >= r.min && recoveryHR <= r.max);
  return match || null;
}

// Queens College VO2max estimation
function queensVO2max(recoveryHR, gender) {
  if (!recoveryHR) return null;
  if (gender === "male") return parseFloat((111.33 - 0.42 * recoveryHR).toFixed(1));
  return parseFloat((65.81 - 0.1847 * recoveryHR).toFixed(1));
}

// Harvard Fitness Index
function harvardIndex(durationSeconds, hr1, hr2, hr3) {
  if (!hr1 || !hr2 || !hr3) return null;
  return parseFloat(((durationSeconds * 100) / (2 * (hr1 + hr2 + hr3))).toFixed(1));
}

function classifyHarvard(index) {
  if (!index) return null;
  if (index > 96) return { label: "Excellent", color: "bg-green-100 text-green-800 border-green-300" };
  if (index >= 83) return { label: "Good", color: "bg-teal-100 text-teal-800 border-teal-300" };
  if (index >= 68) return { label: "High Average", color: "bg-blue-100 text-blue-800 border-blue-300" };
  if (index >= 54) return { label: "Low Average", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  return { label: "Poor", color: "bg-red-100 text-red-800 border-red-300" };
}

function classificationColor(label) {
  if (!label) return "bg-slate-100 text-slate-600 border-slate-200";
  if (label === "Excellent") return "bg-green-100 text-green-800 border-green-300";
  if (label === "Good") return "bg-teal-100 text-teal-800 border-teal-300";
  if (label === "Above Average") return "bg-blue-100 text-blue-800 border-blue-300";
  if (label === "Average") return "bg-yellow-100 text-yellow-800 border-yellow-300";
  if (label === "Below Average") return "bg-orange-100 text-orange-800 border-orange-300";
  if (label === "Poor" || label === "Low Average") return "bg-red-100 text-red-800 border-red-300";
  if (label === "Very Poor") return "bg-red-200 text-red-900 border-red-400";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// ─── SAFETY ITEMS ─────────────────────────────────────────────────────────────
const SAFETY_ITEMS = [
  { id: "safe_exercise", label: "Safe to perform aerobic exercise" },
  { id: "no_angina", label: "No unstable angina or uncontrolled cardiac symptoms" },
  { id: "no_hypertension", label: "No uncontrolled hypertension (resting BP < 180/110)" },
  { id: "no_dizziness", label: "No dizziness, syncope, or pre-syncope at rest" },
  { id: "no_acute_illness", label: "No acute illness, fever, or systemic infection" },
  { id: "no_limb_pain", label: "No severe lower limb pain limiting stepping" },
  { id: "balance_ok", label: "Adequate balance to safely step up and down" },
  { id: "consent", label: "Patient consent obtained" },
];

// ─── STOP REASONS ─────────────────────────────────────────────────────────────
const STOP_REASONS = [
  "Completed full protocol", "Fatigue", "Dyspnoea", "Chest pain / discomfort",
  "Dizziness / light-headedness", "Lower limb pain", "Balance loss",
  "Clinician stopped test", "Client requested stop", "Other"
];

// ─── HELPER COMPONENTS ────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = false, accent = "blue" }) {
  const [open, setOpen] = useState(defaultOpen);
  const map = {
    blue: "border-blue-200 bg-blue-50", amber: "border-amber-200 bg-amber-50",
    green: "border-green-200 bg-green-50", red: "border-red-200 bg-red-50",
    slate: "border-slate-200 bg-slate-50", purple: "border-purple-200 bg-purple-50",
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

function NumInput({ label, value, onChange, placeholder, unit, min = 0, max = 300, required }) {
  return (
    <div>
      <Label className="text-sm font-medium text-slate-700">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="number" value={value} min={min} max={max}
          onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder={placeholder}
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        {unit && <span className="text-sm text-slate-500 whitespace-nowrap">{unit}</span>}
      </div>
    </div>
  );
}

function RatingRow({ label, value, onChange, max = 10 }) {
  return (
    <div>
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      <div className="flex items-center gap-3 mt-1">
        <input type="range" min={0} max={max} step={1} value={value ?? 0}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 h-2 rounded-full accent-sky-600" />
        <span className={`text-lg font-bold w-6 text-center ${(value ?? 0) <= 3 ? "text-green-600" : (value ?? 0) <= 6 ? "text-yellow-600" : "text-red-600"}`}>
          {value ?? 0}
        </span>
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-0.5"><span>None</span><span>Max {max}</span></div>
    </div>
  );
}

function ImageCard({ url, caption }) {
  const [ex, setEx] = useState(false);
  return (
    <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
      <img src={url} alt={caption} className={`w-full object-cover cursor-pointer transition-all ${ex ? "max-h-96" : "max-h-36"}`} onClick={() => setEx(e => !e)} onError={e => { e.target.style.display = "none"; }} />
      <p className="text-xs text-slate-500 text-center p-2">{caption} <span className="text-blue-500 cursor-pointer" onClick={() => setEx(e => !e)}>{ex ? "(collapse)" : "(expand)"}</span></p>
    </div>
  );
}

// ─── METRONOME HOOK ────────────────────────────────────────────────────────────
function useMetronome(bpm, active) {
  const [beat, setBeat] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!active || !bpm) { clearInterval(ref.current); return; }
    const interval = (60 / bpm) * 1000;
    ref.current = setInterval(() => setBeat(b => !b), interval);
    return () => clearInterval(ref.current);
  }, [active, bpm]);
  return beat;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function StepTestAerobicStepTestRunner({ client, onSave, onClose }) {
  const [step, setStep] = useState(0);

  // Safety
  const [safety, setSafety] = useState({});

  // Protocol
  const [protocolKey, setProtocolKey] = useState(null);
  const [customProtocol, setCustomProtocol] = useState({ duration: 180, cadence: 96, stepHeight: 30 });

  // Setup
  const [setup, setSetup] = useState({
    stepHeight: "", cadence: "", surface: "firm floor", shoesOn: true,
    assistiveDeviceNearby: false, dominantLeg: "", balanceConcern: false,
    baselinePain: 0, baselineRPE: 0, baselineDyspnea: 0, baselineFatigue: 0,
  });

  // Pre vitals
  const [preVitals, setPreVitals] = useState({ hr: "", bp: "", spo2: "", rpe: 0, dyspnea: 0 });

  // Timer
  const [timerState, setTimerState] = useState("idle"); // idle | running | paused | done
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  const pauseAccRef = useRef(0);
  const intervalRef = useRef(null);
  const [completedFull, setCompletedFull] = useState(null);
  const [stopReason, setStopReason] = useState("");
  const [otherStopReason, setOtherStopReason] = useState("");

  // During
  const [duringSymptoms, setDuringSymptoms] = useState({ rpe: 0, dyspnea: 0, pain: 0, symptoms: [] });

  // Post
  const [postVitals, setPostVitals] = useState({ hr: "", bp: "", spo2: "", rpe: 0, dyspnea: 0 });

  // Recovery
  const [recovery, setRecovery] = useState({ hr1: "", hr2: "", hr3: "", dyspnea: 0, fatigue: 0, dizziness: false, chestDiscomfort: false });
  const [recoveryTimer, setRecoveryTimer] = useState(0);
  const [recoveryRunning, setRecoveryRunning] = useState(false);
  const recoveryRef = useRef(null);

  // Cadence modal
  const [cadenceOpen, setCadenceOpen] = useState(false);

  // Notes
  const [clinicalNotes, setClinicalNotes] = useState("");

  useEffect(() => () => { clearInterval(intervalRef.current); clearInterval(recoveryRef.current); }, []);

  const protocol = protocolKey ? (protocolKey === "custom" ? { ...PROTOCOLS.custom, ...customProtocol } : PROTOCOLS[protocolKey]) : null;
  const duration = protocol?.duration || 180;
  const cadence = protocol ? (typeof protocol.cadence === "object"
    ? (client?.gender === "female" ? protocol.cadence.female : protocol.cadence.male)
    : protocol.cadence) : 96;

  const beat = useMetronome(cadence, timerState === "running");

  // Resolve cadence URL and description (gender-specific for Queen's)
  const isGenderSplit = protocol && typeof protocol.cadence === "object";
  const genderKey = client?.gender === "female" ? "female" : "male";
  const cadenceUrl = protocol
    ? (isGenderSplit && protocol.cadenceUrl ? protocol.cadenceUrl[genderKey] : protocol.cadenceUrl)
    : null;
  const cadenceDesc = protocol
    ? (isGenderSplit && protocol.cadenceDescription ? protocol.cadenceDescription[genderKey] : protocol.cadenceDescription)
    : null;

  // Age
  const age = client?.date_of_birth
    ? Math.floor((Date.now() - new Date(client.date_of_birth)) / (365.25 * 24 * 3600 * 1000))
    : null;

  // Timer controls
  const startTimer = () => {
    startRef.current = Date.now();
    setTimerState("running");
    intervalRef.current = setInterval(() => {
      const total = pauseAccRef.current + (Date.now() - startRef.current) / 1000;
      setElapsed(total);
      if (total >= duration) {
        clearInterval(intervalRef.current);
        setElapsed(duration);
        setTimerState("done");
        setCompletedFull(true);
        setStopReason("Completed full protocol");
        toast.success("Test complete! Record post-test vitals.");
      }
    }, 100);
  };

  const pauseTimer = () => {
    clearInterval(intervalRef.current);
    pauseAccRef.current += (Date.now() - startRef.current) / 1000;
    setTimerState("paused");
  };

  const resumeTimer = () => {
    startRef.current = Date.now();
    setTimerState("running");
    intervalRef.current = setInterval(() => {
      const total = pauseAccRef.current + (Date.now() - startRef.current) / 1000;
      setElapsed(total);
      if (total >= duration) {
        clearInterval(intervalRef.current);
        setElapsed(duration);
        setTimerState("done");
        setCompletedFull(true);
        setStopReason("Completed full protocol");
        toast.success("Test complete!");
      }
    }, 100);
  };

  const stopTimer = () => {
    clearInterval(intervalRef.current);
    pauseAccRef.current += (Date.now() - startRef.current) / 1000;
    setElapsed(pauseAccRef.current);
    setTimerState("done");
    setCompletedFull(false);
  };

  const resetTimer = () => {
    clearInterval(intervalRef.current);
    pauseAccRef.current = 0;
    setElapsed(0);
    setTimerState("idle");
    setCompletedFull(null);
    setStopReason("");
  };

  // Recovery timer
  const startRecovery = () => {
    setRecoveryTimer(0);
    setRecoveryRunning(true);
    const start = Date.now();
    recoveryRef.current = setInterval(() => {
      const t = Math.floor((Date.now() - start) / 1000);
      setRecoveryTimer(t);
      if (t >= 180) { clearInterval(recoveryRef.current); setRecoveryRunning(false); }
    }, 1000);
  };

  // Scoring
  const primaryRecoveryHR = Number(recovery.hr1) || Number(postVitals.hr) || null;
  const ymcaClass = protocolKey === "ymca" || protocolKey === "modified_older"
    ? classifyYMCA(primaryRecoveryHR, age, client?.gender)
    : null;
  const vo2max = protocolKey === "queens" && primaryRecoveryHR
    ? queensVO2max(primaryRecoveryHR, client?.gender)
    : null;
  const hr1n = Number(recovery.hr1); const hr2n = Number(recovery.hr2); const hr3n = Number(recovery.hr3);
  const harvardIdx = protocolKey === "harvard" && hr1n && hr2n && hr3n
    ? harvardIndex(Math.floor(elapsed), hr1n, hr2n, hr3n) : null;
  const harvardClass = classifyHarvard(harvardIdx);
  const hrRecovery = postVitals.hr && recovery.hr1
    ? Number(postVitals.hr) - Number(recovery.hr1) : null;

  // Interpretation
  const generateInterpretation = () => {
    if (!protocol || timerState === "idle") return "";
    const timeLabel = `${Math.floor(elapsed)}s (${formatTime(Math.floor(elapsed))})`;
    const fullDone = completedFull ? "Full protocol duration was achieved." : `Test was terminated early at ${timeLabel}.`;
    const stopLabel = stopReason === "Other" ? (otherStopReason || "unspecified reason") : (stopReason || "unspecified");
    let score = "";
    if (ymcaClass) score = ` Recovery HR classification: ${ymcaClass.label}.`;
    if (vo2max) score = ` Estimated VO₂max (Queens College): ${vo2max} mL/kg/min.`;
    if (harvardIdx) score = ` Harvard Fitness Index: ${harvardIdx} (${harvardClass?.label || "—"}).`;
    const hrRecText = hrRecovery ? ` HR recovery (post to 1-min): ${hrRecovery} bpm — ${hrRecovery >= 12 ? "adequate" : "reduced"} recovery response.` : "";
    const dyspText = duringSymptoms.dyspnea >= 5 ? " Significant dyspnoea was noted during the test." : "";
    const balText = setup.balanceConcern ? " Balance concerns were noted — modify future testing as appropriate." : "";
    return `${protocol.name} completed. ${fullDone} Stopped due to ${stopLabel}.${score}${hrRecText}${dyspText}${balText} Findings should be interpreted in the context of the client's clinical presentation and functional goals.`;
  };

  // Flags
  const generateFlags = () => {
    const flags = [];
    if (!protocol) return flags;
    if (!completedFull) flags.push({ label: "Incomplete protocol — reduced test validity", severity: "medium" });
    if (ymcaClass && ["Below Average", "Poor", "Very Poor"].includes(ymcaClass.label))
      flags.push({ label: `Reduced aerobic fitness — ${ymcaClass.label}`, severity: "high" });
    if (hrRecovery !== null && hrRecovery < 12)
      flags.push({ label: "Delayed HR recovery — impaired cardiovascular recovery", severity: "high" });
    if (duringSymptoms.dyspnea >= 5) flags.push({ label: "Dyspnoea-limited performance", severity: "medium" });
    if (duringSymptoms.symptoms.includes("Chest pain")) flags.push({ label: "Chest pain during test — urgent review required", severity: "high" });
    if (setup.balanceConcern) flags.push({ label: "Balance limitation noted — falls risk consideration", severity: "medium" });
    if (recovery.dizziness) flags.push({ label: "Dizziness in recovery — monitor closely", severity: "medium" });
    if (recovery.chestDiscomfort) flags.push({ label: "Chest discomfort in recovery — urgent review", severity: "high" });
    if (vo2max && vo2max < 35) flags.push({ label: `Low estimated VO₂max (${vo2max} mL/kg/min)`, severity: "medium" });
    flags.push({ label: "Review aerobic conditioning program", severity: "info" });
    return flags;
  };

  const flagColorMap = {
    high: "bg-red-100 text-red-800 border-red-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-blue-100 text-blue-800 border-blue-200",
    info: "bg-slate-100 text-slate-700 border-slate-200",
  };

  // SOAP
  const generateSoap = () => {
    if (!protocol) return "";
    const stopLabel = stopReason === "Other" ? (otherStopReason || "Other") : (stopReason || "Not recorded");
    let lines = [`• Step Test (Aerobic Step Test) — ${protocol.name}`];
    lines.push(`  Duration: ${Math.floor(elapsed)}s (${formatTime(Math.floor(elapsed))}) / ${duration}s — ${completedFull ? "Full protocol completed" : "Early termination"}`);
    lines.push(`  Stopped due to: ${stopLabel}`);
    if (preVitals.hr) lines.push(`  Pre-test HR: ${preVitals.hr} bpm${preVitals.bp ? ` | BP: ${preVitals.bp}` : ""}${preVitals.spo2 ? ` | SpO₂: ${preVitals.spo2}%` : ""}`);
    if (postVitals.hr) lines.push(`  Post-test HR: ${postVitals.hr} bpm${postVitals.bp ? ` | BP: ${postVitals.bp}` : ""}${postVitals.spo2 ? ` | SpO₂: ${postVitals.spo2}%` : ""}`);
    if (recovery.hr1) lines.push(`  Recovery HR: 1-min: ${recovery.hr1} bpm${recovery.hr2 ? ` | 2-min: ${recovery.hr2} bpm` : ""}${recovery.hr3 ? ` | 3-min: ${recovery.hr3} bpm` : ""}`);
    if (hrRecovery) lines.push(`  HR Recovery (post to 1-min): ${hrRecovery} bpm (${hrRecovery >= 12 ? "adequate" : "reduced"})`);
    if (ymcaClass) lines.push(`  Aerobic Fitness Category: ${ymcaClass.label}`);
    if (vo2max) lines.push(`  Estimated VO₂max: ${vo2max} mL/kg/min`);
    if (harvardIdx) lines.push(`  Harvard Fitness Index: ${harvardIdx} (${harvardClass?.label})`);
    if (duringSymptoms.symptoms.length) lines.push(`  Symptoms during: ${duringSymptoms.symptoms.join(", ")}`);
    if (clinicalNotes) lines.push(`  Clinical Notes: ${clinicalNotes}`);
    lines.push(`  Interpretation: ${generateInterpretation()}`);
    return lines.join("\n");
  };

  const canSave = () => {
    if (!protocol) return false;
    if (timerState === "idle") return false;
    if (!postVitals.hr) return false;
    if (!recovery.hr1) return false;
    if (!stopReason) return false;
    return true;
  };

  const handleSave = () => {
    if (!canSave()) {
      toast.error("Complete required fields: protocol, post-test HR, recovery HR, and stop reason.");
      return;
    }
    onSave({
      status: "completed",
      result_value: Number(recovery.hr1) || Number(postVitals.hr),
      notes: clinicalNotes,
      assessment_date: new Date().toISOString().split("T")[0],
      additional_data: {
        soap_text: generateSoap(),
        measurement_type: "step_test",
        protocol: protocol?.name,
        protocol_key: protocolKey,
        duration_completed: Math.floor(elapsed),
        completed_full_protocol: completedFull,
        stop_reason: stopReason === "Other" ? (otherStopReason || "Other") : stopReason,
        step_height_cm: setup.stepHeight || protocol?.stepHeight,
        cadence_steps_per_min: cadence,
        pre_vitals: preVitals,
        post_vitals: postVitals,
        recovery,
        hr_recovery_bpm: hrRecovery,
        during_symptoms: duringSymptoms,
        setup,
        classification: ymcaClass?.label,
        vo2max_estimated: vo2max,
        harvard_index: harvardIdx,
        flags: generateFlags().map(f => f.label),
        interpretation: generateInterpretation(),
      },
    });
    toast.success("Step Test saved successfully.");
  };

  const STEPS = [
    { label: "Overview", icon: Info },
    { label: "Safety", icon: AlertTriangle },
    { label: "Protocol", icon: Zap },
    { label: "Setup", icon: Activity },
    { label: "Pre-Test", icon: Heart },
    { label: "Test", icon: Clock },
    { label: "Recovery", icon: RotateCcw },
    { label: "Results", icon: FileText },
  ];

  const allSafeClear = SAFETY_ITEMS.every(s => safety[s.id]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[98vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b bg-gradient-to-r from-sky-50 to-blue-50 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Step Test — Aerobic Step Test</h2>
            <p className="text-xs text-slate-500 mt-0.5">Submaximal aerobic fitness • Cardiovascular response • Recovery capacity</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Step Nav */}
        <div className="flex overflow-x-auto border-b bg-slate-50 shrink-0 px-2 py-1 gap-1">
          {STEPS.map((s, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${step === i ? "bg-sky-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
              <s.icon className="w-3 h-3" />{s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ── STEP 0: OVERVIEW ──────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                <h3 className="font-bold text-sky-900 mb-2 flex items-center gap-2"><Info className="w-4 h-4" />Assessment Overview</h3>
                <p className="text-sm text-sky-800 mb-3">A validated submaximal aerobic fitness test using a standardised step protocol to assess cardiovascular response, aerobic endurance, and recovery capacity. Suitable for clinical, rehabilitation, and functional assessment settings.</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {["Cardiovascular screening", "Functional endurance", "Aerobic conditioning", "Pulmonary rehab", "Falls conditioning", "Older adult fitness", "Submaximal fitness testing", "Work capacity / FCE", "Cardiac rehab", "DVA / Medicare / NDIS"].map(u => (
                    <div key={u} className="flex items-center gap-1.5 text-sky-700"><CheckCircle2 className="w-3 h-3 shrink-0" />{u}</div>
                  ))}
                </div>
              </div>

              <Section title="Protocol Options" icon={Zap} defaultOpen accent="slate">
                <div className="space-y-2 text-sm text-slate-700">
                  {Object.values(PROTOCOLS).map(p => (
                    <div key={p.id} className="p-3 rounded-lg bg-slate-50 border">
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.population} • {p.duration}s • {typeof p.cadence === "object" ? `${p.cadence.male}/${p.cadence.female} steps/min` : `${p.cadence} steps/min`} • {p.stepHeight}cm step</p>
                      <p className="text-xs text-slate-600 mt-1">{p.description}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Instructional Diagrams" icon={Activity} accent="slate">
                <div className="grid grid-cols-2 gap-3">

                  {/* Diagram 1: Starting Position */}
                  <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    <svg viewBox="0 0 200 160" className="w-full" xmlns="http://www.w3.org/2000/svg">
                      <rect width="200" height="160" fill="#f8fafc"/>
                      {/* Step platform */}
                      <rect x="60" y="115" width="80" height="18" rx="3" fill="#94a3b8" stroke="#64748b" strokeWidth="1.5"/>
                      <rect x="55" y="133" width="90" height="6" rx="2" fill="#64748b"/>
                      {/* Floor */}
                      <line x1="10" y1="139" x2="190" y2="139" stroke="#cbd5e1" strokeWidth="1.5"/>
                      {/* Body — torso upright */}
                      <circle cx="100" cy="38" r="12" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5"/>
                      <rect x="90" y="50" width="20" height="35" rx="6" fill="#3b82f6"/>
                      {/* Left arm */}
                      <line x1="90" y1="58" x2="75" y2="78" stroke="#3b82f6" strokeWidth="5" strokeLinecap="round"/>
                      {/* Right arm */}
                      <line x1="110" y1="58" x2="125" y2="78" stroke="#3b82f6" strokeWidth="5" strokeLinecap="round"/>
                      {/* Left leg down on floor */}
                      <line x1="93" y1="85" x2="85" y2="120" stroke="#1d4ed8" strokeWidth="5" strokeLinecap="round"/>
                      <line x1="85" y1="120" x2="80" y2="139" stroke="#1d4ed8" strokeWidth="5" strokeLinecap="round"/>
                      {/* Right leg down on floor */}
                      <line x1="107" y1="85" x2="115" y2="120" stroke="#1d4ed8" strokeWidth="5" strokeLinecap="round"/>
                      <line x1="115" y1="120" x2="120" y2="139" stroke="#1d4ed8" strokeWidth="5" strokeLinecap="round"/>
                      {/* Arrow pointing to step */}
                      <path d="M135 110 L155 100" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3,2" markerEnd="url(#arr)"/>
                      <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#ef4444"/></marker></defs>
                      <text x="100" y="155" textAnchor="middle" fontSize="9" fill="#475569" fontWeight="600">Starting Position</text>
                    </svg>
                    <p className="text-xs text-slate-500 text-center px-2 pb-2">Stand facing the step, upright posture, arms relaxed</p>
                  </div>

                  {/* Diagram 2: Stepping Up — Full Foot Contact */}
                  <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    <svg viewBox="0 0 200 160" className="w-full" xmlns="http://www.w3.org/2000/svg">
                      <rect width="200" height="160" fill="#f0fdf4"/>
                      {/* Step platform */}
                      <rect x="55" y="110" width="90" height="18" rx="3" fill="#94a3b8" stroke="#64748b" strokeWidth="1.5"/>
                      <rect x="50" y="128" width="100" height="6" rx="2" fill="#64748b"/>
                      {/* Floor */}
                      <line x1="10" y1="134" x2="190" y2="134" stroke="#cbd5e1" strokeWidth="1.5"/>
                      {/* Body — upright on step */}
                      <circle cx="100" cy="38" r="12" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5"/>
                      <rect x="90" y="50" width="20" height="33" rx="6" fill="#16a34a"/>
                      {/* Arms natural swing */}
                      <line x1="90" y1="58" x2="73" y2="72" stroke="#16a34a" strokeWidth="5" strokeLinecap="round"/>
                      <line x1="110" y1="58" x2="127" y2="72" stroke="#16a34a" strokeWidth="5" strokeLinecap="round"/>
                      {/* Lead leg — foot fully on step */}
                      <line x1="107" y1="83" x2="115" y2="100" stroke="#15803d" strokeWidth="5" strokeLinecap="round"/>
                      <rect x="108" y="104" width="22" height="6" rx="2" fill="#15803d"/>
                      {/* Trail leg — still on floor */}
                      <line x1="93" y1="83" x2="82" y2="118" stroke="#15803d" strokeWidth="5" strokeLinecap="round"/>
                      <rect x="74" y="128" width="18" height="6" rx="2" fill="#15803d"/>
                      {/* Full foot label */}
                      <rect x="118" y="96" width="48" height="16" rx="3" fill="#dcfce7" stroke="#16a34a" strokeWidth="1"/>
                      <text x="142" y="107" textAnchor="middle" fontSize="8" fill="#15803d" fontWeight="700">FULL FOOT ✓</text>
                      <text x="100" y="150" textAnchor="middle" fontSize="9" fill="#475569" fontWeight="600">Correct Step Technique</text>
                    </svg>
                    <p className="text-xs text-slate-500 text-center px-2 pb-2">Lead foot placed fully flat on step — no toe-only contact</p>
                  </div>

                  {/* Diagram 3: Step Height Measurement */}
                  <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    <svg viewBox="0 0 200 160" className="w-full" xmlns="http://www.w3.org/2000/svg">
                      <rect width="200" height="160" fill="#eff6ff"/>
                      {/* Step side view */}
                      <rect x="50" y="90" width="100" height="40" rx="3" fill="#94a3b8" stroke="#64748b" strokeWidth="1.5"/>
                      {/* Floor */}
                      <line x1="10" y1="130" x2="190" y2="130" stroke="#cbd5e1" strokeWidth="2"/>
                      {/* Measurement arrow vertical */}
                      <line x1="30" y1="90" x2="30" y2="130" stroke="#3b82f6" strokeWidth="2"/>
                      <line x1="25" y1="90" x2="35" y2="90" stroke="#3b82f6" strokeWidth="2"/>
                      <line x1="25" y1="130" x2="35" y2="130" stroke="#3b82f6" strokeWidth="2"/>
                      {/* Label */}
                      <rect x="6" y="102" width="22" height="18" rx="3" fill="#dbeafe"/>
                      <text x="17" y="111" textAnchor="middle" fontSize="7.5" fill="#1d4ed8" fontWeight="700">30.5</text>
                      <text x="17" y="119" textAnchor="middle" fontSize="6.5" fill="#1d4ed8">cm</text>
                      {/* YMCA label on step */}
                      <text x="100" y="106" textAnchor="middle" fontSize="8" fill="#ffffff" fontWeight="700">YMCA Step</text>
                      <text x="100" y="118" textAnchor="middle" fontSize="7" fill="#e2e8f0">12 inches / 30.5 cm</text>
                      {/* Tape measure icon */}
                      <rect x="140" y="82" width="28" height="12" rx="3" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1"/>
                      <text x="154" y="91" textAnchor="middle" fontSize="7" fill="#78350f" fontWeight="700">📏 Measure</text>
                      {/* Protocol reference */}
                      <rect x="46" y="136" width="108" height="18" rx="3" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1"/>
                      <text x="100" y="143" textAnchor="middle" fontSize="7" fill="#1e40af">YMCA: 30.5cm | Queens: 41.3cm</text>
                      <text x="100" y="151" textAnchor="middle" fontSize="7" fill="#1e40af">Harvard: 50.8cm | Modified: 20cm</text>
                    </svg>
                    <p className="text-xs text-slate-500 text-center px-2 pb-2">Confirm step height matches protocol before starting</p>
                  </div>

                  {/* Diagram 4: Recovery HR Monitoring */}
                  <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    <svg viewBox="0 0 200 160" className="w-full" xmlns="http://www.w3.org/2000/svg">
                      <rect width="200" height="160" fill="#fff7ed"/>
                      {/* Seated figure */}
                      <circle cx="70" cy="42" r="12" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5"/>
                      {/* Torso seated */}
                      <rect x="60" y="54" width="20" height="30" rx="6" fill="#f97316"/>
                      {/* Chair */}
                      <rect x="45" y="84" width="50" height="5" rx="2" fill="#92400e"/>
                      <rect x="45" y="89" width="5" height="25" rx="2" fill="#92400e"/>
                      <rect x="90" y="89" width="5" height="25" rx="2" fill="#92400e"/>
                      {/* Legs on chair */}
                      <line x1="65" y1="84" x2="60" y2="114" stroke="#c2410c" strokeWidth="5" strokeLinecap="round"/>
                      <line x1="75" y1="84" x2="80" y2="114" stroke="#c2410c" strokeWidth="5" strokeLinecap="round"/>
                      {/* Left arm raised to neck (palpation) */}
                      <line x1="60" y1="62" x2="48" y2="52" stroke="#f97316" strokeWidth="5" strokeLinecap="round"/>
                      <line x1="48" y1="52" x2="58" y2="44" stroke="#f97316" strokeWidth="5" strokeLinecap="round"/>
                      {/* Pulse point indicator */}
                      <circle cx="58" cy="44" r="5" fill="#ef4444" opacity="0.8"/>
                      <text x="58" y="47" textAnchor="middle" fontSize="6" fill="white" fontWeight="700">♥</text>
                      {/* Pulse label */}
                      <rect x="30" y="28" width="24" height="13" rx="3" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1"/>
                      <text x="42" y="35" textAnchor="middle" fontSize="6.5" fill="#dc2626" fontWeight="700">Carotid</text>
                      <text x="42" y="39" textAnchor="middle" fontSize="6" fill="#dc2626">Pulse</text>
                      {/* Stopwatch */}
                      <circle cx="150" cy="65" r="30" fill="#ffffff" stroke="#f97316" strokeWidth="2"/>
                      <circle cx="150" cy="65" r="24" fill="#fff7ed" stroke="#fed7aa" strokeWidth="1"/>
                      <text x="150" y="60" textAnchor="middle" fontSize="9" fill="#9a3412" fontWeight="700">STOP</text>
                      <text x="150" y="72" textAnchor="middle" fontSize="13" fill="#ea580c" fontWeight="900">1:00</text>
                      <text x="150" y="82" textAnchor="middle" fontSize="7" fill="#9a3412">1-min mark</text>
                      {/* Timer hand */}
                      <line x1="150" y1="65" x2="150" y2="44" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="150" y1="65" x2="165" y2="70" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
                      {/* Label */}
                      <text x="100" y="152" textAnchor="middle" fontSize="9" fill="#475569" fontWeight="600">Recovery HR Monitoring</text>
                    </svg>
                    <p className="text-xs text-slate-500 text-center px-2 pb-2">Measure pulse at 1-min post-exercise — carotid or radial</p>
                  </div>

                </div>
                <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 space-y-1">
                  <p><strong>Key Stepping Technique:</strong></p>
                  <p>① Full foot on step — no toe-only contact</p>
                  <p>② Upright posture — no trunk lean</p>
                  <p>③ Step up-up-down-down in sequence</p>
                  <p>④ Maintain cadence throughout</p>
                  <p>⑤ Arms relaxed at sides or swinging naturally</p>
                  <p>⑥ Breathe normally throughout</p>
                </div>
              </Section>

              <Button onClick={() => setStep(1)} className="w-full bg-sky-600 hover:bg-sky-700">Begin Assessment →</Button>
            </div>
          )}

          {/* ── STEP 1: SAFETY ────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="font-bold text-red-800 mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Safety Screening</h3>
                <p className="text-sm text-red-700">Confirm all items before administering. Use clinical judgment if any concern is present.</p>
              </div>
              <div className="space-y-3">
                {SAFETY_ITEMS.map(s => (
                  <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg border bg-slate-50 hover:bg-white transition-colors">
                    <Checkbox checked={!!safety[s.id]} onCheckedChange={v => setSafety(p => ({ ...p, [s.id]: !!v }))} className="mt-0.5" />
                    <span className="text-sm text-slate-700">{s.label}</span>
                  </div>
                ))}
              </div>
              {allSafeClear
                ? <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />All safety criteria confirmed. Safe to proceed.</div>
                : <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800"><AlertTriangle className="w-4 h-4 inline mr-1" />Confirm all items. If concerns exist, document in clinical notes before proceeding.</div>
              }
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1">← Back</Button>
                <Button onClick={() => setStep(2)} className="flex-1 bg-sky-600 hover:bg-sky-700">{allSafeClear ? "Proceed →" : "Override & Continue →"}</Button>
              </div>
            </div>
          )}

          {/* ── STEP 2: PROTOCOL SELECTION ────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-sm text-sky-800">
                <Zap className="w-4 h-4 inline mr-1" /><strong>Select Protocol</strong> — Parameters will be auto-filled. You can override for Custom.
              </div>
              <div className="space-y-3">
                {Object.values(PROTOCOLS).map(p => (
                  <button key={p.id} onClick={() => { setProtocolKey(p.id); if (p.id !== "custom") { setSetup(prev => ({ ...prev, stepHeight: p.stepHeight, cadence: typeof p.cadence === "object" ? (client?.gender === "female" ? p.cadence.female : p.cadence.male) : p.cadence })); } }}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${protocolKey === p.id ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white hover:border-sky-300"}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{p.population}</p>
                        <p className="text-xs text-slate-600 mt-1">{p.description}</p>
                      </div>
                      <div className="text-right ml-3 shrink-0 text-xs text-slate-500 space-y-0.5">
                        <p className="font-medium text-slate-700">{Math.floor(p.duration / 60)}:{String(p.duration % 60).padStart(2, "0")}</p>
                        <p>{p.stepHeight}cm</p>
                        <p>{typeof p.cadence === "object" ? `${p.cadence.male}/${p.cadence.female}` : p.cadence} spm</p>
                      </div>
                    </div>
                    {protocolKey === p.id && <Badge className="mt-2 bg-sky-600 text-white text-xs">Selected</Badge>}
                  </button>
                ))}
              </div>

              {protocolKey === "custom" && (
                <div className="p-4 bg-slate-50 rounded-xl border space-y-3">
                  <p className="font-semibold text-sm text-slate-700">Custom Protocol Parameters</p>
                  <div className="grid grid-cols-3 gap-3">
                    <NumInput label="Duration" value={customProtocol.duration} onChange={v => setCustomProtocol(p => ({ ...p, duration: v }))} unit="sec" />
                    <NumInput label="Cadence" value={customProtocol.cadence} onChange={v => setCustomProtocol(p => ({ ...p, cadence: v }))} unit="spm" />
                    <NumInput label="Step Height" value={customProtocol.stepHeight} onChange={v => setCustomProtocol(p => ({ ...p, stepHeight: v }))} unit="cm" />
                  </div>
                </div>
              )}

              {protocol && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" /><strong>{protocol.name}</strong> selected. {protocol.notes}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">← Back</Button>
                <Button onClick={() => setStep(3)} disabled={!protocolKey} className="flex-1 bg-sky-600 hover:bg-sky-700">Setup →</Button>
              </div>
            </div>
          )}

          {/* ── STEP 3: SETUP ─────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              {protocol && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
                  <strong>Protocol:</strong> {protocol.name} | <strong>Duration:</strong> {formatTime(duration)} | <strong>Cadence:</strong> {cadence} steps/min | <strong>Step Height:</strong> {protocol.stepHeight}cm
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <NumInput label="Step Height (confirm)" value={setup.stepHeight} onChange={v => setSetup(p => ({ ...p, stepHeight: v }))} unit="cm" placeholder={String(protocol?.stepHeight || "")} />
                <NumInput label="Cadence (confirm)" value={setup.cadence} onChange={v => setSetup(p => ({ ...p, cadence: v }))} unit="steps/min" placeholder={String(cadence)} />
                <div>
                  <Label className="text-sm font-medium">Surface</Label>
                  <select value={setup.surface} onChange={e => setSetup(p => ({ ...p, surface: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
                    <option>Firm floor</option><option>Carpet</option><option>Gym mat</option><option>Outdoor</option>
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Dominant Leg</Label>
                  <div className="flex gap-2 mt-1">
                    {["Left", "Right", "Unknown"].map(v => (
                      <button key={v} onClick={() => setSetup(p => ({ ...p, dominantLeg: v }))}
                        className={`flex-1 py-1.5 rounded-lg border text-sm transition-colors ${setup.dominantLeg === v ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>{v}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "shoesOn", label: "Shoes on" }, { key: "assistiveDeviceNearby", label: "Assistive device nearby" },
                  { key: "balanceConcern", label: "Balance concern noted" },
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border">
                    <Checkbox checked={!!setup[item.key]} onCheckedChange={v => setSetup(p => ({ ...p, [item.key]: !!v }))} />
                    <Label className="text-sm">{item.label}</Label>
                  </div>
                ))}
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h4 className="font-semibold text-green-800 text-sm mb-2">📋 Clinician Script</h4>
                <p className="text-sm text-green-800 italic">"Step up and down in rhythm with the cadence cue for the full test duration. Maintain upright posture. Tell me immediately if you feel chest pain, severe breathlessness, dizziness, or loss of coordination."</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">← Back</Button>
                <Button onClick={() => setStep(4)} className="flex-1 bg-sky-600 hover:bg-sky-700">Pre-Test Vitals →</Button>
              </div>
            </div>
          )}

          {/* ── STEP 4: PRE-TEST VITALS ──────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
                <Heart className="w-4 h-4 inline mr-1" /><strong>Pre-Test Physiological Baseline</strong> — Record before the test begins.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumInput label="Heart Rate" value={preVitals.hr} onChange={v => setPreVitals(p => ({ ...p, hr: v }))} unit="bpm" placeholder="e.g. 68" min={30} max={200} />
                <div>
                  <Label className="text-sm font-medium">Blood Pressure</Label>
                  <input value={preVitals.bp} onChange={e => setPreVitals(p => ({ ...p, bp: e.target.value }))} placeholder="e.g. 120/78" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
                </div>
                <NumInput label="SpO₂" value={preVitals.spo2} onChange={v => setPreVitals(p => ({ ...p, spo2: v }))} unit="%" placeholder="e.g. 98" min={70} max={100} />
              </div>
              <RatingRow label="Pre-Test RPE (0–10)" value={preVitals.rpe} onChange={v => setPreVitals(p => ({ ...p, rpe: v }))} />
              <RatingRow label="Pre-Test Dyspnea (0–10)" value={preVitals.dyspnea} onChange={v => setPreVitals(p => ({ ...p, dyspnea: v }))} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1">← Back</Button>
                <Button onClick={() => setStep(5)} className="flex-1 bg-sky-600 hover:bg-sky-700">Start Test →</Button>
              </div>
            </div>
          )}

          {/* ── STEP 5: GUIDED STEP RUNNER ──────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-4">
              {protocol && (
                <div className="text-center text-xs text-slate-500 font-medium">
                  {protocol.name} | {cadence} steps/min | {formatTime(duration)} duration
                </div>
              )}

              {/* Cadence Button */}
              {cadenceUrl && (
                <button
                  onClick={() => setCadenceOpen(true)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-sky-300 bg-sky-50 hover:bg-sky-100 transition-colors text-sky-800"
                >
                  <div className="flex items-center gap-2.5">
                    <Music className="w-5 h-5 text-sky-600" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">Start Cadence Audio</p>
                      <p className="text-xs text-sky-600">{cadence} steps/min — maintain this rhythm throughout</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium bg-sky-600 text-white px-2.5 py-1 rounded-lg">Open ▶</span>
                </button>
              )}

              {/* Timer Block */}
              <div className={`rounded-2xl p-6 text-center border-2 transition-all ${timerState === "running" ? "bg-sky-50 border-sky-400" : timerState === "done" ? "bg-green-50 border-green-400" : "bg-slate-50 border-slate-200"}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  {timerState === "running" ? "▶ STEPPING — MAINTAIN RHYTHM" : timerState === "done" ? "✓ Test Complete" : timerState === "paused" ? "⏸ Paused" : "Ready to Start"}
                </p>
                <p className={`text-7xl font-mono font-bold transition-colors ${timerState === "running" ? "text-sky-700" : timerState === "done" ? "text-green-700" : "text-slate-400"}`}>
                  {formatTime(Math.floor(elapsed))}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {timerState !== "idle" ? `${Math.floor(elapsed)}s / ${duration}s` : `Target: ${formatTime(duration)}`}
                </p>

                {/* Cadence beat indicator */}
                {timerState === "running" && (
                  <div className="mt-3 flex justify-center items-center gap-4">
                    <div className={`w-8 h-8 rounded-full transition-all duration-100 ${beat ? "bg-sky-500 scale-125 shadow-lg" : "bg-sky-200"}`} />
                    <p className="text-sm text-sky-700 font-semibold">{cadence} steps/min</p>
                    <div className={`w-8 h-8 rounded-full transition-all duration-100 ${!beat ? "bg-sky-500 scale-125 shadow-lg" : "bg-sky-200"}`} />
                  </div>
                )}

                {/* Progress bar */}
                {timerState !== "idle" && duration > 0 && (
                  <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${Math.min(100, (elapsed / duration) * 100)}%` }} />
                  </div>
                )}

                <div className="mt-4 flex justify-center gap-3 flex-wrap">
                  {timerState === "idle" && <Button onClick={startTimer} size="lg" className="bg-sky-600 hover:bg-sky-700 px-8"><Play className="w-5 h-5 mr-2" />Start Test</Button>}
                  {timerState === "running" && <>
                    <Button onClick={pauseTimer} variant="outline" size="lg">⏸ Pause</Button>
                    <Button onClick={stopTimer} variant="destructive" size="lg"><Square className="w-5 h-5 mr-2" />Stop</Button>
                  </>}
                  {timerState === "paused" && <>
                    <Button onClick={resumeTimer} size="lg" className="bg-sky-600 hover:bg-sky-700"><Play className="w-5 h-5 mr-2" />Resume</Button>
                    <Button onClick={stopTimer} variant="destructive" size="lg"><Square className="w-5 h-5 mr-2" />Stop</Button>
                  </>}
                  {timerState === "done" && <Button onClick={resetTimer} variant="outline" size="sm"><RotateCcw className="w-4 h-4 mr-1" />Retest</Button>}
                </div>
              </div>

              {/* Stop reason */}
              <div>
                <Label className="text-sm font-semibold text-slate-700">Reason Test Stopped *</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {STOP_REASONS.map(r => (
                    <button key={r} onClick={() => setStopReason(r)}
                      className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${stopReason === r ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-600 border-slate-300 hover:bg-sky-50"}`}>{r}</button>
                  ))}
                </div>
                {stopReason === "Other" && (
                  <input value={otherStopReason} onChange={e => setOtherStopReason(e.target.value)} placeholder="Describe stop reason..." className="mt-2 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
                )}
              </div>

              {/* During Symptoms */}
              <div className="p-4 bg-slate-50 rounded-xl border space-y-3">
                <p className="font-semibold text-sm text-slate-700">Symptoms During Test</p>
                <RatingRow label="RPE During Test" value={duringSymptoms.rpe} onChange={v => setDuringSymptoms(p => ({ ...p, rpe: v }))} />
                <RatingRow label="Dyspnea During Test" value={duringSymptoms.dyspnea} onChange={v => setDuringSymptoms(p => ({ ...p, dyspnea: v }))} />
                <RatingRow label="Pain During Test" value={duringSymptoms.pain} onChange={v => setDuringSymptoms(p => ({ ...p, pain: v }))} />
                <div>
                  <Label className="text-sm font-medium text-slate-700">Symptoms Noted (select all)</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {["Chest pain", "Palpitations", "Dizziness", "Leg fatigue", "Breathlessness", "Nausea", "Calf pain", "Other"].map(sym => (
                      <button key={sym} onClick={() => setDuringSymptoms(p => ({ ...p, symptoms: p.symptoms.includes(sym) ? p.symptoms.filter(s => s !== sym) : [...p.symptoms, sym] }))}
                        className={`px-3 py-2 rounded-lg border text-sm transition-colors ${duringSymptoms.symptoms.includes(sym) ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-600 border-slate-300 hover:bg-red-50"}`}>{sym}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(4)} className="flex-1">← Back</Button>
                <Button onClick={() => setStep(6)} disabled={timerState === "idle"} className="flex-1 bg-sky-600 hover:bg-sky-700">Post-Test / Recovery →</Button>
              </div>
            </div>
          )}

          {/* ── STEP 6: POST-TEST + RECOVERY ─────────────────────────────── */}
          {step === 6 && (
            <div className="space-y-4">
              {/* Recovery Timer */}
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-center">
                <p className="font-semibold text-sky-800 mb-1">Recovery Stopwatch</p>
                <p className="text-4xl font-mono font-bold text-sky-700">{formatTime(recoveryTimer)}</p>
                <p className="text-xs text-slate-500 mt-1">Use this to time recovery HR measurements</p>
                <div className="flex justify-center gap-3 mt-3">
                  {!recoveryRunning
                    ? <Button onClick={startRecovery} size="sm" className="bg-sky-600 hover:bg-sky-700"><Play className="w-4 h-4 mr-1" />Start Recovery Timer</Button>
                    : <Button onClick={() => { clearInterval(recoveryRef.current); setRecoveryRunning(false); }} size="sm" variant="outline">Stop Recovery Timer</Button>
                  }
                </div>
                <div className="flex justify-around mt-3 text-xs text-slate-500">
                  <span className={recoveryTimer >= 60 ? "text-sky-700 font-bold" : ""}>1-min: {Math.max(0, 60 - recoveryTimer)}s</span>
                  <span className={recoveryTimer >= 120 ? "text-sky-700 font-bold" : ""}>2-min: {Math.max(0, 120 - recoveryTimer)}s</span>
                  <span className={recoveryTimer >= 180 ? "text-sky-700 font-bold" : ""}>3-min: {Math.max(0, 180 - recoveryTimer)}s</span>
                </div>
              </div>

              {/* Immediate Post Vitals */}
              <div className="p-4 bg-slate-50 rounded-xl border space-y-3">
                <p className="font-semibold text-sm text-slate-700">Immediate Post-Test Vitals</p>
                <div className="grid grid-cols-2 gap-3">
                  <NumInput label="Post-Test HR *" value={postVitals.hr} onChange={v => setPostVitals(p => ({ ...p, hr: v }))} unit="bpm" required />
                  <div>
                    <Label className="text-sm font-medium">Post-Test BP</Label>
                    <input value={postVitals.bp} onChange={e => setPostVitals(p => ({ ...p, bp: e.target.value }))} placeholder="e.g. 145/85" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
                  </div>
                  <NumInput label="Post-Test SpO₂" value={postVitals.spo2} onChange={v => setPostVitals(p => ({ ...p, spo2: v }))} unit="%" min={70} max={100} />
                </div>
                <RatingRow label="Post-Test RPE" value={postVitals.rpe} onChange={v => setPostVitals(p => ({ ...p, rpe: v }))} />
                <RatingRow label="Post-Test Dyspnea" value={postVitals.dyspnea} onChange={v => setPostVitals(p => ({ ...p, dyspnea: v }))} />
              </div>

              {/* Recovery HRs */}
              <div className="p-4 bg-slate-50 rounded-xl border space-y-3">
                <p className="font-semibold text-sm text-slate-700">Recovery Heart Rate *</p>
                <div className="grid grid-cols-3 gap-3">
                  <NumInput label="1-min HR *" value={recovery.hr1} onChange={v => setRecovery(p => ({ ...p, hr1: v }))} unit="bpm" required />
                  <NumInput label="2-min HR" value={recovery.hr2} onChange={v => setRecovery(p => ({ ...p, hr2: v }))} unit="bpm" />
                  <NumInput label="3-min HR" value={recovery.hr3} onChange={v => setRecovery(p => ({ ...p, hr3: v }))} unit="bpm" />
                </div>
                {hrRecovery !== null && (
                  <div className={`p-2 rounded-lg text-sm font-medium ${hrRecovery >= 12 ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                    HR Recovery (post → 1-min): {hrRecovery} bpm — {hrRecovery >= 12 ? "Adequate" : "Reduced (< 12 bpm expected)"}
                  </div>
                )}
              </div>

              {/* Recovery Symptoms */}
              <div className="p-4 bg-slate-50 rounded-xl border space-y-3">
                <p className="font-semibold text-sm text-slate-700">Recovery Symptoms</p>
                <RatingRow label="Recovery Dyspnea" value={recovery.dyspnea} onChange={v => setRecovery(p => ({ ...p, dyspnea: v }))} />
                <RatingRow label="Recovery Fatigue" value={recovery.fatigue} onChange={v => setRecovery(p => ({ ...p, fatigue: v }))} />
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "dizziness", label: "Dizziness in recovery" },
                    { key: "chestDiscomfort", label: "Chest discomfort in recovery" },
                  ].map(item => (
                    <div key={item.key} className="flex items-center gap-2 p-3 bg-white rounded-lg border">
                      <Checkbox checked={!!recovery[item.key]} onCheckedChange={v => setRecovery(p => ({ ...p, [item.key]: !!v }))} />
                      <Label className="text-sm">{item.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(5)} className="flex-1">← Back</Button>
                <Button onClick={() => setStep(7)} disabled={!postVitals.hr || !recovery.hr1} className="flex-1 bg-sky-600 hover:bg-sky-700">View Results →</Button>
              </div>
            </div>
          )}

          {/* ── STEP 7: RESULTS ──────────────────────────────────────────── */}
          {step === 7 && (
            <div className="space-y-4">

              {/* Score summary */}
              <div className={`border-2 rounded-2xl p-5 text-center ${ymcaClass ? classificationColor(ymcaClass.label) : harvardClass ? classificationColor(harvardClass.label) : "bg-slate-50 border-slate-200"}`}>
                <p className="text-sm font-semibold uppercase tracking-wider opacity-70 mb-2">
                  {protocol?.name || "Step Test"} Result
                </p>
                {ymcaClass && <><p className="text-4xl font-bold">{ymcaClass.label}</p><p className="text-lg font-medium mt-1">Recovery HR: {recovery.hr1} bpm</p></>}
                {vo2max && <><p className="text-4xl font-bold">{vo2max} <span className="text-xl">mL/kg/min</span></p><p className="text-lg font-medium mt-1">Estimated VO₂max (Queens College)</p></>}
                {harvardIdx && <><p className="text-4xl font-bold">{harvardIdx}</p><p className="text-lg font-medium mt-1">Harvard Fitness Index — {harvardClass?.label}</p></>}
                {!ymcaClass && !vo2max && !harvardIdx && <p className="text-xl font-medium">Recovery HR: {recovery.hr1 || "—"} bpm</p>}
                {hrRecovery !== null && <p className="text-sm mt-2 opacity-80">HR Recovery: {hrRecovery} bpm</p>}
              </div>

              {/* Vitals summary */}
              <Section title="Physiological Summary" icon={Heart} defaultOpen accent="blue">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {[
                    ["Pre HR", `${preVitals.hr || "—"} bpm`],
                    ["Post HR", `${postVitals.hr || "—"} bpm`],
                    ["1-min Recovery", `${recovery.hr1 || "—"} bpm`],
                    ["2-min Recovery", `${recovery.hr2 || "—"} bpm`],
                    ["3-min Recovery", `${recovery.hr3 || "—"} bpm`],
                    ["HR Recovery", hrRecovery !== null ? `${hrRecovery} bpm` : "—"],
                    ["Pre BP", preVitals.bp || "—"],
                    ["Post BP", postVitals.bp || "—"],
                    ["Post SpO₂", postVitals.spo2 ? `${postVitals.spo2}%` : "—"],
                    ["Duration", `${Math.floor(elapsed)}s / ${duration}s`],
                    ["Full Protocol", completedFull === null ? "—" : completedFull ? "Yes ✓" : "No"],
                    ["RPE (post)", postVitals.rpe],
                  ].map(([label, val]) => (
                    <div key={label} className="p-2 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="font-semibold text-slate-800">{val}</p>
                    </div>
                  ))}
                </div>
              </Section>

              {/* YMCA norms table */}
              {(protocolKey === "ymca" || protocolKey === "modified_older") && age && client?.gender && (
                <Section title="Normative Comparison (YMCA Recovery HR)" icon={Activity} defaultOpen accent="blue">
                  <div className="space-y-1 text-xs">
                    <p className="text-slate-500 mb-2">Age group: {getAgeGroup(age)} | Sex: {client.gender}</p>
                    {(YMCA_NORMS[client.gender === "male" ? "male" : "female"]?.[getAgeGroup(age)] || []).map(row => (
                      <div key={row.label} className={`flex justify-between items-center px-3 py-1.5 rounded-lg ${ymcaClass?.label === row.label ? "bg-sky-100 border border-sky-300 font-bold" : "bg-slate-50"}`}>
                        <span>{row.label}</span>
                        <span className="text-slate-500">{row.max === 999 ? `> ${row.min - 1}` : `${row.min}–${row.max}`} bpm</span>
                        {ymcaClass?.label === row.label && <Badge className="bg-sky-600 text-white text-xs ml-2">↑ Client</Badge>}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Interpretation */}
              <Section title="Clinical Interpretation" icon={FileText} defaultOpen accent="amber">
                <p className="text-sm text-slate-700 leading-relaxed">{generateInterpretation() || "Complete the test to generate interpretation."}</p>
              </Section>

              {/* Clinical Flags */}
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
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 rounded-lg p-3 border">{generateSoap() || "Complete all steps to generate SOAP output."}</pre>
              </Section>

              {/* References */}
              <Section title="Evidence-Based References" icon={BookOpen} accent="slate">
                <div className="space-y-3 text-xs text-slate-600">
                  {[
                    { n: 1, t: "YMCA of the USA.", s: "YMCA Fitness Testing and Assessment Manual. 4th ed. Human Kinetics; 2000." },
                    { n: 2, t: "McArdle WD, Katch FI, Pechar GS.", s: "Reliability and interrelationships between maximal oxygen intake, physical work capacity and step-test scores in college women. Med Sci Sports. 1972;4(4):182–186." },
                    { n: 3, t: "Chatterjee S et al.", s: "Queen's College Step Test. A simple but effective predictor of maximal oxygen uptake in college-age men and women. Ergonomics. 1979." },
                    { n: 4, t: "American College of Sports Medicine.", s: "ACSM's Guidelines for Exercise Testing and Prescription. 11th ed. Lippincott Williams & Wilkins." },
                    { n: 5, t: "Buckley JP, Sim J, Eston RG, Hession R, Fox R.", s: "Reliability and validity of measures taken during the Chester step test to predict aerobic power and to prescribe aerobic exercise. Br J Sports Med. 2004;38(2):197–205." },
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
                <Textarea value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)} placeholder="Observations, patient response, rehabilitation implications, conditioning recommendations..." rows={3} className="mt-1" />
              </div>

              {!canSave() && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Complete required fields to save: protocol selected, test performed, post-test HR, 1-min recovery HR, and stop reason.
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(6)} className="flex-1">← Back</Button>
                <Button onClick={handleSave} disabled={!canSave()} className="flex-1 bg-sky-600 hover:bg-sky-700">
                  <Save className="w-4 h-4 mr-2" />Save Assessment
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Cadence Modal */}
        <CadencePlayerModal
          isOpen={cadenceOpen}
          onClose={() => setCadenceOpen(false)}
          youtubeUrl={cadenceUrl}
          title={protocol?.name || "Step Test"}
          cadence={cadence}
          description={cadenceDesc}
        />

        {/* Footer */}
        <div className="border-t px-5 py-3 bg-slate-50 flex justify-between items-center shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-500">Cancel</Button>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {protocol && <span className="text-sky-600 font-medium">✓ {protocol.name}</span>}
            {timerState === "done" && <span className="text-green-600 font-medium">✓ {formatTime(Math.floor(elapsed))} recorded</span>}
            {recovery.hr1 && <span className="text-blue-600 font-medium">✓ Recovery HR</span>}
          </div>
          {step === 7 && (
            <Button onClick={handleSave} disabled={!canSave()} size="sm" className="bg-sky-600 hover:bg-sky-700">
              <Save className="w-3 h-3 mr-1" />Save
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}