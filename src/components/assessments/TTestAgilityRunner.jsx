import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Save, X, Play, Square, RotateCcw, Info, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Clock, Activity, BookOpen, Flag, FileText, Zap, Target
} from "lucide-react";
import { toast } from "sonner";

// â”€â”€â”€ NORMATIVE DATA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Pauole et al. 2000 + Semenick 1990 + sport-adjusted ranges
const NORMS = {
  male: [
    { label: "Elite / Excellent", max: 9.5, color: "bg-green-100 text-green-800 border-green-300" },
    { label: "Good", max: 10.0, color: "bg-teal-100 text-teal-800 border-teal-300" },
    { label: "Average", max: 10.5, color: "bg-blue-100 text-blue-800 border-blue-300" },
    { label: "Below Average", max: 11.5, color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    { label: "Poor", max: 999, color: "bg-red-100 text-red-800 border-red-300" },
  ],
  female: [
    { label: "Elite / Excellent", max: 10.5, color: "bg-green-100 text-green-800 border-green-300" },
    { label: "Good", max: 11.0, color: "bg-teal-100 text-teal-800 border-teal-300" },
    { label: "Average", max: 11.5, color: "bg-blue-100 text-blue-800 border-blue-300" },
    { label: "Below Average", max: 12.5, color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    { label: "Poor", max: 999, color: "bg-red-100 text-red-800 border-red-300" },
  ],
};

function classifyTime(time, gender) {
  if (!time || !gender) return null;
  const rows = NORMS[gender === "male" ? "male" : "female"];
  return rows.find(r => time < r.max) || rows[rows.length - 1];
}

// Return-to-sport thresholds
const RTS_THRESHOLDS = {
  male: { clearance: 10.5, caution: 11.5 },
  female: { clearance: 11.5, caution: 12.5 },
};

function rtsStatus(time, gender) {
  if (!time || !gender) return null;
  const t = RTS_THRESHOLDS[gender === "male" ? "male" : "female"];
  if (time <= t.clearance) return { label: "RTS â€” Cleared", color: "bg-green-100 text-green-800 border-green-300" };
  if (time <= t.caution) return { label: "RTS â€” Caution / Progressive", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  return { label: "RTS â€” Not Cleared", color: "bg-red-100 text-red-800 border-red-300" };
}

function formatTime(s) {
  return s != null ? `${s.toFixed(2)}s` : "â€”";
}

// â”€â”€â”€ SAFETY ITEMS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SAFETY_ITEMS = [
  { id: "cleared_running", label: "Cleared for running and cutting activities" },
  { id: "no_acute_pain", label: "No acute pain in lower limb at rest or movement" },
  { id: "no_instability", label: "No knee instability or giving-way episodes" },
  { id: "no_swelling", label: "No acute joint swelling" },
  { id: "warmup_done", label: "Warm-up completed (â‰¥5 min dynamic warm-up)" },
  { id: "safe_footwear", label: "Appropriate footwear worn" },
  { id: "safe_surface", label: "Surface safe and appropriate for sprinting" },
  { id: "consent", label: "Patient consent obtained" },
];

// â”€â”€â”€ MOVEMENT QUALITY ITEMS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const QUALITY_ITEMS = [
  { key: "acceleration", label: "Acceleration quality (Aâ†’B)" },
  { key: "deceleration", label: "Deceleration control (B transitions)" },
  { key: "lateral_shuffle", label: "Lateral shuffle technique" },
  { key: "foot_placement", label: "Foot placement & cone contact" },
  { key: "cod_control", label: "Change-of-direction control" },
  { key: "knee_valgus", label: "Knee valgus (lower = better control)" },
  { key: "trunk_control", label: "Dynamic trunk control" },
  { key: "arm_coordination", label: "Arm coordination" },
  { key: "turning_efficiency", label: "Turning efficiency" },
];

// â”€â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Section({ title, icon: Icon, children, defaultOpen = false, accent = "amber" }) {
  const [open, setOpen] = useState(defaultOpen);
  const map = {
    amber: "border-amber-200 bg-amber-50", blue: "border-blue-200 bg-blue-50",
    green: "border-green-200 bg-green-50", red: "border-red-200 bg-red-50",
    slate: "border-slate-200 bg-slate-50", purple: "border-purple-200 bg-purple-50",
    teal: "border-teal-200 bg-teal-50", yellow: "border-yellow-200 bg-yellow-50",
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

function QualitySlider({ label, value, onChange, invertLabel = false }) {
  const LABELS = ["Severe deficit", "Poor", "Fair", "Good", "Excellent"];
  const colors = ["text-red-600", "text-orange-600", "text-yellow-600", "text-teal-600", "text-green-600"];
  return (
    <div>
      <div className="flex justify-between items-center mb-0.5">
        <Label className="text-xs font-medium text-slate-700">{label}</Label>
        <span className={`text-xs font-bold ${colors[value ?? 2]}`}>{LABELS[value ?? 2]}</span>
      </div>
      <input type="range" min={0} max={4} step={1} value={value ?? 2}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full accent-amber-500" />
      <div className="flex justify-between text-xs text-slate-400 mt-0.5">
        <span>{invertLabel ? "Excellent" : "Severe"}</span>
        <span>{invertLabel ? "Severe" : "Excellent"}</span>
      </div>
    </div>
  );
}

function ImageCard({ url, caption }) {
  const [ex, setEx] = useState(false);
  return (
    <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
      <img src={url} alt={caption} className={`w-full object-cover cursor-pointer transition-all ${ex ? "max-h-96" : "max-h-36"}`} onClick={() => setEx(e => !e)} onError={e => { e.target.style.display = "none"; }} />
      <p className="text-xs text-slate-500 text-center p-2">{caption} <span className="text-amber-500 cursor-pointer" onClick={() => setEx(e => !e)}>{ex ? "(collapse)" : "(expand)"}</span></p>
    </div>
  );
}

// â”€â”€â”€ CONE DIAGRAM (SVG) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ConeDiagram() {
  return (
    <div className="p-4 bg-slate-900 rounded-xl">
      <svg viewBox="0 0 300 220" className="w-full max-w-xs mx-auto">
        {/* Vertical line Aâ†’B */}
        <line x1="150" y1="190" x2="150" y2="90" stroke="#f59e0b" strokeWidth="2" strokeDasharray="6,3" />
        {/* Horizontal line Câ†’Bâ†’D */}
        <line x1="50" y1="90" x2="250" y2="90" stroke="#f59e0b" strokeWidth="2" strokeDasharray="6,3" />
        {/* Arrows */}
        <defs>
          <marker id="arr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#f59e0b" />
          </marker>
        </defs>
        {/* Sprint Aâ†’B */}
        <line x1="150" y1="188" x2="150" y2="105" stroke="#22c55e" strokeWidth="2.5" markerEnd="url(#arr)" />
        {/* Shuffle Bâ†’C */}
        <line x1="148" y1="88" x2="65" y2="88" stroke="#60a5fa" strokeWidth="2.5" markerEnd="url(#arr)" />
        {/* Shuffle Câ†’D */}
        <line x1="52" y1="92" x2="235" y2="92" stroke="#60a5fa" strokeWidth="2.5" markerEnd="url(#arr)" />
        {/* Shuffle Dâ†’B */}
        <line x1="248" y1="88" x2="165" y2="88" stroke="#60a5fa" strokeWidth="2.5" markerEnd="url(#arr)" />
        {/* Backpedal Bâ†’A */}
        <line x1="152" y1="94" x2="152" y2="178" stroke="#f472b6" strokeWidth="2.5" markerEnd="url(#arr)" />

        {/* Cones */}
        {[
          { x: 150, y: 195, label: "A", sub: "Start/Finish", fill: "#22c55e" },
          { x: 150, y: 82, label: "B", sub: "9.14m", fill: "#f59e0b" },
          { x: 50, y: 82, label: "C", sub: "4.57m L", fill: "#60a5fa" },
          { x: 250, y: 82, label: "D", sub: "4.57m R", fill: "#f472b6" },
        ].map(c => (
          <g key={c.label}>
            <circle cx={c.x} cy={c.y} r="14" fill={c.fill} />
            <text x={c.x} y={c.y + 5} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">{c.label}</text>
            <text x={c.x} y={c.y + 24} textAnchor="middle" fill="#94a3b8" fontSize="8">{c.sub}</text>
          </g>
        ))}

        {/* Legend */}
        <g transform="translate(5, 140)">
          <line x1="0" y1="5" x2="18" y2="5" stroke="#22c55e" strokeWidth="2" />
          <text x="22" y="9" fill="#94a3b8" fontSize="8">Sprint</text>
          <line x1="0" y1="20" x2="18" y2="20" stroke="#60a5fa" strokeWidth="2" />
          <text x="22" y="24" fill="#94a3b8" fontSize="8">Shuffle</text>
          <line x1="0" y1="35" x2="18" y2="35" stroke="#f472b6" strokeWidth="2" />
          <text x="22" y="39" fill="#94a3b8" fontSize="8">Backpedal</text>
        </g>
      </svg>
      <div className="text-center text-xs text-slate-400 mt-2">T-Test Agility â€” Standard Layout</div>
    </div>
  );
}

// â”€â”€â”€ MAIN COMPONENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function TTestAgilityRunner({ client, onSave, onClose }) {
  const [step, setStep] = useState(0);

  // Safety
  const [safety, setSafety] = useState({});

  // Setup
  const [setup, setSetup] = useState({
    surface: "Indoor court", footwear: "Athletic shoes", indoor: true,
    dominantLeg: "", injuredSide: "None", testingSport: "",
    warmupDone: false, sprintConfidence: 5, fatigueLevel: 2,
  });

  // Trials: { time, invalid, invalidReason, notes }
  const MAX_TRIALS = 3;
  const [trialResults, setTrialResults] = useState([]);
  const [activeTrial, setActiveTrial] = useState(0); // 0-indexed
  const [trialState, setTrialState] = useState("idle"); // idle | running | done
  const [elapsed, setElapsed] = useState(0);
  const [falseStart, setFalseStart] = useState(false);
  const [invalidReasons, setInvalidReasons] = useState([]);
  const startRef = useRef(null);
  const intervalRef = useRef(null);

  // Quality scores: keyed by quality item key, value 0â€“4
  const [quality, setQuality] = useState({
    acceleration: 2, deceleration: 2, lateral_shuffle: 2, foot_placement: 2,
    cod_control: 2, knee_valgus: 2, trunk_control: 2, arm_coordination: 2, turning_efficiency: 2,
  });

  const [clinicalNotes, setClinicalNotes] = useState("");

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const validTrials = trialResults.filter(t => !t.invalid).map(t => t.time);
  const bestTime = validTrials.length > 0 ? Math.min(...validTrials) : null;
  const avgTime = validTrials.length > 0
    ? parseFloat((validTrials.reduce((a, b) => a + b, 0) / validTrials.length).toFixed(2))
    : null;
  const trialVariability = validTrials.length > 1
    ? parseFloat((Math.max(...validTrials) - Math.min(...validTrials)).toFixed(2))
    : null;
  const consistency = trialVariability !== null && avgTime
    ? parseFloat((100 - (trialVariability / avgTime * 100)).toFixed(1))
    : null;

  const gender = client?.gender;
  const classification = bestTime ? classifyTime(bestTime, gender) : null;
  const rts = bestTime ? rtsStatus(bestTime, gender) : null;

  // Timer controls
  const startTimer = () => {
    setFalseStart(false);
    setInvalidReasons([]);
    setElapsed(0);
    setTrialState("running");
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 50);
  };

  const stopTimer = () => {
    clearInterval(intervalRef.current);
    const t = parseFloat(((Date.now() - startRef.current) / 1000).toFixed(2));
    setElapsed(t);
    setTrialState("done");
  };

  const resetTimer = () => {
    clearInterval(intervalRef.current);
    setElapsed(0);
    setTrialState("idle");
    setFalseStart(false);
    setInvalidReasons([]);
  };

  const saveTrial = (invalid = false) => {
    const t = parseFloat(elapsed.toFixed(2));
    const record = { time: t, invalid, invalidReason: invalidReasons.join(", "), trialNum: activeTrial + 1 };
    const updated = [...trialResults];
    updated[activeTrial] = record;
    setTrialResults(updated);
    if (!invalid) toast.success(`Trial ${activeTrial + 1} saved: ${formatTime(t)}`);
    else toast.warning(`Trial ${activeTrial + 1} marked invalid`);
    setElapsed(0);
    setTrialState("idle");
    setInvalidReasons([]);
    if (activeTrial < MAX_TRIALS - 1) setActiveTrial(i => i + 1);
  };

  const INVALID_REASONS = ["False start", "Missed cone", "Loss of balance", "Slip / fall", "Foot crossing during shuffle", "Early stop"];

  // Average quality
  const avgQuality = parseFloat((Object.values(quality).reduce((a, b) => a + b, 0) / Object.keys(quality).length).toFixed(1));
  const qualityLabel = avgQuality >= 3.5 ? "Excellent" : avgQuality >= 2.5 ? "Good" : avgQuality >= 1.5 ? "Fair" : "Poor";

  // Interpretation
  const generateInterpretation = () => {
    if (!bestTime) return "";
    const cls = classification?.label || "â€”";
    const rtsL = rts?.label || "â€”";
    const kv = quality.knee_valgus;
    const dec = quality.deceleration;
    const cods = quality.cod_control;
    let text = `T-Test Agility completed across ${trialResults.filter(t => !t.invalid).length} valid trial(s). Best time recorded was ${formatTime(bestTime)}`;
    if (avgTime && validTrials.length > 1) text += `, with a mean of ${formatTime(avgTime)}`;
    text += `. Performance was classified as ${cls}.`;
    if (rts) text += ` Return-to-sport status: ${rtsL}.`;
    if (kv <= 1) text += " Dynamic knee valgus was evident during directional changes, indicating potential neuromuscular control deficit and elevated ACL re-injury risk.";
    else if (kv === 2) text += " Mild knee valgus was noted â€” monitor with progressive loading.";
    if (dec <= 1) text += " Deceleration control was poor, suggesting deficits in eccentric lower-limb strength and braking mechanics.";
    if (cods <= 1) text += " Change-of-direction control was significantly reduced.";
    if (consistency !== null && consistency < 90) text += ` Performance consistency was reduced (${consistency}%), which may reflect fatigue, technique variability, or apprehension.`;
    text += " Findings should be contextualised with the client's clinical history, rehabilitation stage, and sport-specific demands.";
    return text;
  };

  // Flags
  const generateFlags = () => {
    const flags = [];
    if (!bestTime) return flags;
    const g = gender === "male" ? "male" : "female";
    const t = RTS_THRESHOLDS[g];
    if (bestTime > t.caution) flags.push({ label: "Significantly reduced agility â€” RTS not indicated", severity: "high" });
    else if (bestTime > t.clearance) flags.push({ label: "Reduced agility â€” progressive RTS programme recommended", severity: "medium" });
    if (quality.knee_valgus <= 1) flags.push({ label: "Dynamic valgus collapse â€” ACL re-injury risk", severity: "high" });
    else if (quality.knee_valgus === 2) flags.push({ label: "Mild knee valgus â€” monitor during loading progression", severity: "medium" });
    if (quality.deceleration <= 1) flags.push({ label: "Poor deceleration control â€” eccentric strengthening required", severity: "high" });
    if (quality.cod_control <= 1) flags.push({ label: "Change-of-direction deficit â€” agility progression indicated", severity: "medium" });
    if (consistency !== null && consistency < 85) flags.push({ label: "Low performance consistency â€” consider fatigue or apprehension", severity: "medium" });
    if (trialResults.some(t => !t.invalid && t.time) && validTrials.length > 1) {
      const trend = validTrials[validTrials.length - 1] - validTrials[0];
      if (trend > 0.5) flags.push({ label: "Fatigue-related performance decline across trials", severity: "medium" });
    }
    if (setup.fatigueLevel >= 6) flags.push({ label: "High pre-test fatigue â€” may compromise results", severity: "low" });
    flags.push({ label: "Reassess at next RTS milestone", severity: "info" });
    flags.push({ label: "Correlate with LSI hop testing and quad strength", severity: "info" });
    return flags;
  };

  const flagColorMap = { high: "bg-red-100 text-red-800 border-red-200", medium: "bg-yellow-100 text-yellow-800 border-yellow-200", low: "bg-blue-100 text-blue-800 border-blue-200", info: "bg-slate-100 text-slate-700 border-slate-200" };

  // SOAP
  const generateSoap = () => {
    if (!bestTime) return "";
    const lines = [`â€¢ T-Test Agility`];
    
    // Setup/environmental context
    if (setup.surface || setup.footwear || setup.testingSport) {
      lines.push(`  Setup & Environment:`);
      if (setup.testingSport) lines.push(`    â€¢ Context: ${setup.testingSport}`);
      if (setup.surface) lines.push(`    â€¢ Surface: ${setup.surface}`);
      if (setup.footwear) lines.push(`    â€¢ Footwear: ${setup.footwear}`);
      if (setup.dominantLeg && setup.dominantLeg !== "Unknown") lines.push(`    â€¢ Dominant leg: ${setup.dominantLeg}`);
      if (setup.injuredSide && setup.injuredSide !== "None") lines.push(`    â€¢ Injured side: ${setup.injuredSide}`);
    }
    
    // Pre-test observations
    if (setup.sprintConfidence !== undefined || setup.fatigueLevel !== undefined) {
      lines.push(`  Pre-Test Status:`);
      if (setup.sprintConfidence !== undefined) lines.push(`    â€¢ Sprint confidence: ${setup.sprintConfidence}/10`);
      if (setup.fatigueLevel !== undefined) lines.push(`    â€¢ Pre-test fatigue: ${setup.fatigueLevel}/10`);
    }
    
    // Trial results
    trialResults.forEach(t => {
      if (t) lines.push(`  Trial ${t.trialNum}: ${formatTime(t.time)}${t.invalid ? ` [INVALID â€” ${t.invalidReason}]` : " [Valid]"}`);
    });
    if (bestTime) lines.push(`  Best Time: ${formatTime(bestTime)}${classification ? ` â€” ${classification.label}` : ""}`);
    if (avgTime && validTrials.length > 1) lines.push(`  Mean Time: ${formatTime(avgTime)}`);
    if (consistency !== null) lines.push(`  Consistency: ${consistency}%`);
    if (rts) lines.push(`  Return-to-Sport Status: ${rts.label}`);
    lines.push(`  Movement Quality: ${qualityLabel} (avg score ${avgQuality}/4)`);
    
    // Quality details if any notable
    const qualityDetails = [];
    if (quality.knee_valgus <= 2) qualityDetails.push(`Dynamic knee valgus noted â€” ACL risk consideration`);
    if (quality.deceleration <= 1) qualityDetails.push(`Poor deceleration control`);
    if (quality.cod_control <= 1) qualityDetails.push(`Reduced change-of-direction control`);
    if (qualityDetails.length > 0) lines.push(`  Quality observations: ${qualityDetails.join("; ")}`);
    
    if (clinicalNotes) lines.push(`  Clinical Notes: ${clinicalNotes}`);
    lines.push(`  Interpretation: ${generateInterpretation()}`);
    lines.push(`  Reference: Pauole et al. J Strength Cond Res 2000. Norms: Male Excellent <9.5s | Female Excellent <10.5s`);
    return lines.join("\n");
  };

  const canSave = validTrials.length > 0;

  const handleSave = () => {
    if (!canSave) { toast.error("Complete at least one valid trial before saving."); return; }
    onSave({
      status: "completed",
      result_value: bestTime,
      notes: clinicalNotes,
      assessment_date: new Date().toISOString().split("T")[0],
      additional_data: {
        soap_text: generateSoap(),
        measurement_type: "T_test_agility",
        best_time_s: bestTime,
        mean_time_s: avgTime,
        consistency_pct: consistency,
        trial_variability_s: trialVariability,
        valid_trials: validTrials,
        all_trials: trialResults,
        classification: classification?.label,
        rts_status: rts?.label,
        quality_scores: quality,
        avg_quality: avgQuality,
        quality_label: qualityLabel,
        setup,
        flags: generateFlags().map(f => f.label),
        interpretation: generateInterpretation(),
      },
    });
    toast.success("T-Test Agility saved successfully.");
  };

  const allSafeClear = SAFETY_ITEMS.every(s => safety[s.id]);

  const STEPS = [
    { label: "Overview", icon: Info },
    { label: "Safety", icon: AlertTriangle },
    { label: "Setup", icon: Target },
    { label: "Trials", icon: Clock },
    { label: "Quality", icon: Activity },
    { label: "Results", icon: FileText },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[98vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b bg-gradient-to-r from-amber-50 to-yellow-50 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">T-Test Agility</h2>
            <p className="text-xs text-slate-500 mt-0.5">Multidirectional agility â€¢ Change of direction â€¢ Return to sport</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Step Nav */}
        <div className="flex overflow-x-auto border-b bg-slate-50 shrink-0 px-2 py-1 gap-1">
          {STEPS.map((s, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${step === i ? "bg-amber-500 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
              <s.icon className="w-3 h-3" />{s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* â”€â”€ STEP 0: OVERVIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2"><Zap className="w-4 h-4" />Assessment Overview</h3>
                <p className="text-sm text-amber-800 mb-3">The T-Test Agility measures multidirectional agility, change-of-direction speed, lateral movement, acceleration, deceleration, and neuromuscular control. A gold-standard functional performance test for return-to-sport and athletic profiling.</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {["Return to sport", "ACL rehabilitation", "Sports performance", "Agility screening", "Functional performance", "Change-of-direction speed", "Neuromuscular readiness", "Dynamic balance", "Athletic profiling", "Strength & conditioning"].map(u => (
                    <div key={u} className="flex items-center gap-1.5 text-amber-700"><CheckCircle2 className="w-3 h-3 shrink-0" />{u}</div>
                  ))}
                </div>
              </div>

              <Section title="T-Test Course Layout" icon={Target} defaultOpen accent="yellow">
                <ConeDiagram />
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="font-semibold text-green-800">Sprint A â†’ B (9.14m)</p>
                    <p className="text-green-700 text-xs">Forward sprint to centre cone</p>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="font-semibold text-blue-800">Shuffle B â†’ C (4.57m left)</p>
                    <p className="text-blue-700 text-xs">Lateral shuffle left, touch cone C</p>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="font-semibold text-blue-800">Shuffle C â†’ D (9.14m right)</p>
                    <p className="text-blue-700 text-xs">Lateral shuffle right, touch cone D</p>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="font-semibold text-blue-800">Shuffle D â†’ B (4.57m left)</p>
                    <p className="text-blue-700 text-xs">Lateral shuffle back to B, touch cone</p>
                  </div>
                  <div className="p-3 bg-pink-50 border border-pink-200 rounded-lg">
                    <p className="font-semibold text-pink-800">Backpedal B â†’ A (9.14m)</p>
                    <p className="text-pink-700 text-xs">Backpedal to start/finish â€” timer stops</p>
                  </div>
                </div>
              </Section>

              <Section title="Instructional Images" icon={Activity} accent="slate">
                <div className="grid grid-cols-2 gap-3">

                  {/* Diagram 1: Sprint Phase A â†’ B */}
                  <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
                    <svg viewBox="0 0 200 160" className="w-full" xmlns="http://www.w3.org/2000/svg">
                      <rect width="200" height="160" fill="#f0fdf4"/>
                      {/* Ground line */}
                      <line x1="10" y1="130" x2="190" y2="130" stroke="#cbd5e1" strokeWidth="1.5"/>
                      {/* Cone A (start) */}
                      <polygon points="30,130 44,130 37,115" fill="#22c55e" stroke="#16a34a" strokeWidth="1"/>
                      <text x="37" y="143" textAnchor="middle" fontSize="9" fill="#15803d" fontWeight="700">A</text>
                      <text x="37" y="152" textAnchor="middle" fontSize="7" fill="#64748b">START</text>
                      {/* Cone B (centre) */}
                      <polygon points="156,88 170,88 163,73" fill="#f59e0b" stroke="#d97706" strokeWidth="1"/>
                      <text x="163" y="101" textAnchor="middle" fontSize="9" fill="#b45309" fontWeight="700">B</text>
                      {/* Sprint path */}
                      <path d="M37,115 Q80,100 155,82" stroke="#22c55e" strokeWidth="3" fill="none" strokeDasharray="5,3"/>
                      <polygon points="150,79 162,82 152,88" fill="#22c55e"/>
                      {/* Runner figure â€” sprinting */}
                      <circle cx="90" cy="75" r="9" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5"/>
                      {/* torso */}
                      <line x1="90" y1="84" x2="90" y2="108" stroke="#0369a1" strokeWidth="5" strokeLinecap="round"/>
                      {/* forward lean */}
                      <line x1="90" y1="84" x2="88" y2="108" stroke="#0369a1" strokeWidth="5" strokeLinecap="round"/>
                      {/* drive arm (front) */}
                      <line x1="88" y1="90" x2="76" y2="98" stroke="#0369a1" strokeWidth="3.5" strokeLinecap="round"/>
                      {/* swing arm (back) */}
                      <line x1="88" y1="90" x2="100" y2="102" stroke="#0369a1" strokeWidth="3.5" strokeLinecap="round"/>
                      {/* drive knee up */}
                      <line x1="88" y1="108" x2="78" y2="120" stroke="#0369a1" strokeWidth="4" strokeLinecap="round"/>
                      <line x1="78" y1="120" x2="72" y2="130" stroke="#0369a1" strokeWidth="3.5" strokeLinecap="round"/>
                      {/* push-off leg */}
                      <line x1="88" y1="108" x2="100" y2="120" stroke="#0369a1" strokeWidth="4" strokeLinecap="round"/>
                      <line x1="100" y1="120" x2="110" y2="130" stroke="#0369a1" strokeWidth="3.5" strokeLinecap="round"/>
                      {/* Speed lines */}
                      <line x1="60" y1="78" x2="70" y2="78" stroke="#22c55e" strokeWidth="1.5" opacity="0.6"/>
                      <line x1="58" y1="83" x2="68" y2="83" stroke="#22c55e" strokeWidth="1" opacity="0.4"/>
                      <line x1="62" y1="73" x2="70" y2="73" stroke="#22c55e" strokeWidth="1" opacity="0.4"/>
                      {/* Label */}
                      <text x="100" y="15" textAnchor="middle" fontSize="9" fill="#166534" fontWeight="700">SPRINT PHASE</text>
                      <text x="100" y="26" textAnchor="middle" fontSize="8" fill="#4d7c0f">A â†’ B (9.14 m forward)</text>
                      {/* Distance marker */}
                      <line x1="37" y1="135" x2="163" y2="135" stroke="#94a3b8" strokeWidth="0.8"/>
                      <line x1="37" y1="132" x2="37" y2="138" stroke="#94a3b8" strokeWidth="0.8"/>
                      <line x1="163" y1="132" x2="163" y2="138" stroke="#94a3b8" strokeWidth="0.8"/>
                      <text x="100" y="148" textAnchor="middle" fontSize="7" fill="#64748b">9.14 m</text>
                    </svg>
                    <p className="text-xs text-slate-500 text-center px-2 pb-2">Sprint Acceleration Phase â€” A to B (9.14m)</p>
                  </div>

                  {/* Diagram 2: Lateral Shuffle Technique */}
                  <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
                    <svg viewBox="0 0 200 160" className="w-full" xmlns="http://www.w3.org/2000/svg">
                      <rect width="200" height="160" fill="#eff6ff"/>
                      {/* Ground */}
                      <line x1="10" y1="130" x2="190" y2="130" stroke="#cbd5e1" strokeWidth="1.5"/>
                      {/* Cone C */}
                      <polygon points="18,130 32,130 25,115" fill="#60a5fa" stroke="#2563eb" strokeWidth="1"/>
                      <text x="25" y="143" textAnchor="middle" fontSize="9" fill="#1d4ed8" fontWeight="700">C</text>
                      {/* Cone B centre */}
                      <polygon points="88,130 102,130 95,115" fill="#f59e0b" stroke="#d97706" strokeWidth="1"/>
                      <text x="95" y="143" textAnchor="middle" fontSize="9" fill="#b45309" fontWeight="700">B</text>
                      {/* Cone D */}
                      <polygon points="168,130 182,130 175,115" fill="#f472b6" stroke="#db2777" strokeWidth="1"/>
                      <text x="175" y="143" textAnchor="middle" fontSize="9" fill="#be185d" fontWeight="700">D</text>
                      {/* Shuffle path arrow Bâ†’C */}
                      <path d="M90,112 L30,112" stroke="#60a5fa" strokeWidth="2.5" fill="none"/>
                      <polygon points="25,112 36,107 36,117" fill="#60a5fa"/>
                      {/* Shuffle path arrow Câ†’D */}
                      <path d="M30,108 L170,108" stroke="#60a5fa" strokeWidth="2" fill="none" strokeDasharray="4,2"/>
                      <polygon points="175,108 164,103 164,113" fill="#60a5fa"/>
                      {/* Runner figure â€” side shuffle stance */}
                      <circle cx="60" cy="68" r="9" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5"/>
                      {/* Torso upright */}
                      <line x1="60" y1="77" x2="60" y2="100" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round"/>
                      {/* Arms out for balance */}
                      <line x1="60" y1="84" x2="44" y2="90" stroke="#7c3aed" strokeWidth="3.5" strokeLinecap="round"/>
                      <line x1="60" y1="84" x2="76" y2="90" stroke="#7c3aed" strokeWidth="3.5" strokeLinecap="round"/>
                      {/* Wide stance legs */}
                      <line x1="60" y1="100" x2="46" y2="120" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round"/>
                      <line x1="46" y1="120" x2="42" y2="130" stroke="#7c3aed" strokeWidth="3.5" strokeLinecap="round"/>
                      <line x1="60" y1="100" x2="74" y2="120" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round"/>
                      <line x1="74" y1="120" x2="78" y2="130" stroke="#7c3aed" strokeWidth="3.5" strokeLinecap="round"/>
                      {/* NO CROSSOVER label */}
                      <rect x="100" y="55" width="90" height="36" rx="5" fill="#fef2f2" stroke="#fca5a5" strokeWidth="1.5"/>
                      <text x="145" y="68" textAnchor="middle" fontSize="8" fill="#dc2626" fontWeight="700">âŒ NO CROSSOVER</text>
                      <text x="145" y="80" textAnchor="middle" fontSize="7" fill="#ef4444">Feet must NOT cross</text>
                      <text x="145" y="89" textAnchor="middle" fontSize="7" fill="#ef4444">during shuffle</text>
                      <text x="100" y="15" textAnchor="middle" fontSize="9" fill="#1e40af" fontWeight="700">LATERAL SHUFFLE</text>
                      <text x="100" y="26" textAnchor="middle" fontSize="8" fill="#3b82f6">Feet stay parallel â€” face forward</text>
                    </svg>
                    <p className="text-xs text-slate-500 text-center px-2 pb-2">Lateral Shuffle Technique â€” feet parallel, no crossover</p>
                  </div>

                  {/* Diagram 3: Cone Touch Position */}
                  <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
                    <svg viewBox="0 0 200 160" className="w-full" xmlns="http://www.w3.org/2000/svg">
                      <rect width="200" height="160" fill="#fefce8"/>
                      {/* Ground */}
                      <line x1="10" y1="135" x2="190" y2="135" stroke="#cbd5e1" strokeWidth="1.5"/>
                      {/* Cone on ground */}
                      <polygon points="90,135 114,135 102,110" fill="#f59e0b" stroke="#d97706" strokeWidth="2"/>
                      <rect x="84" y="135" width="36" height="5" rx="2" fill="#d97706"/>
                      <text x="102" y="150" textAnchor="middle" fontSize="9" fill="#92400e" fontWeight="700">CONE BASE</text>
                      {/* Hand reaching down to touch cone base */}
                      {/* Arm line */}
                      <line x1="62" y1="75" x2="88" y2="130" stroke="#0369a1" strokeWidth="4" strokeLinecap="round"/>
                      {/* Hand shape */}
                      <ellipse cx="88" cy="133" rx="7" ry="5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5"/>
                      <text x="88" y="136" textAnchor="middle" fontSize="7" fill="#92400e">âœ‹</text>
                      {/* Runner body â€” crouched to touch */}
                      <circle cx="55" cy="55" r="10" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5"/>
                      {/* Torso bent forward */}
                      <line x1="55" y1="65" x2="62" y2="85" stroke="#0369a1" strokeWidth="5" strokeLinecap="round"/>
                      {/* Other arm up for balance */}
                      <line x1="62" y1="75" x2="45" y2="68" stroke="#0369a1" strokeWidth="3.5" strokeLinecap="round"/>
                      {/* Legs in athletic stance */}
                      <line x1="62" y1="85" x2="48" y2="110" stroke="#0369a1" strokeWidth="4" strokeLinecap="round"/>
                      <line x1="48" y1="110" x2="44" y2="135" stroke="#0369a1" strokeWidth="3.5" strokeLinecap="round"/>
                      <line x1="62" y1="85" x2="76" y2="108" stroke="#0369a1" strokeWidth="4" strokeLinecap="round"/>
                      <line x1="76" y1="108" x2="80" y2="130" stroke="#0369a1" strokeWidth="3.5" strokeLinecap="round"/>
                      {/* Key points callout */}
                      <rect x="115" y="40" width="75" height="70" rx="5" fill="#fef9c3" stroke="#fde047" strokeWidth="1.5"/>
                      <text x="152" y="54" textAnchor="middle" fontSize="8" fill="#713f12" fontWeight="700">KEY RULES</text>
                      <text x="119" y="66" fontSize="7" fill="#854d0e">âœ“ Touch BASE of cone</text>
                      <text x="119" y="77" fontSize="7" fill="#854d0e">âœ“ With fingertips</text>
                      <text x="119" y="88" fontSize="7" fill="#854d0e">âœ“ Maintain direction</text>
                      <text x="119" y="99" fontSize="7" fill="#854d0e">âœ— Knocking cone =</text>
                      <text x="119" y="109" fontSize="7" fill="#dc2626">  INVALID trial</text>
                      <text x="100" y="15" textAnchor="middle" fontSize="9" fill="#92400e" fontWeight="700">CONE TOUCH TECHNIQUE</text>
                    </svg>
                    <p className="text-xs text-slate-500 text-center px-2 pb-2">Cone Touch Position â€” hand must touch cone base</p>
                  </div>

                  {/* Diagram 4: Backpedal Return B â†’ A */}
                  <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
                    <svg viewBox="0 0 200 160" className="w-full" xmlns="http://www.w3.org/2000/svg">
                      <rect width="200" height="160" fill="#fdf4ff"/>
                      {/* Ground */}
                      <line x1="10" y1="130" x2="190" y2="130" stroke="#cbd5e1" strokeWidth="1.5"/>
                      {/* Cone B */}
                      <polygon points="156,95 170,95 163,80" fill="#f59e0b" stroke="#d97706" strokeWidth="1"/>
                      <text x="163" y="108" textAnchor="middle" fontSize="9" fill="#b45309" fontWeight="700">B</text>
                      {/* Cone A finish */}
                      <polygon points="28,130 42,130 35,115" fill="#22c55e" stroke="#16a34a" strokeWidth="1"/>
                      <text x="35" y="143" textAnchor="middle" fontSize="9" fill="#15803d" fontWeight="700">A</text>
                      <text x="35" y="152" textAnchor="middle" fontSize="7" fill="#64748b">FINISH</text>
                      {/* Backpedal path â€” moving toward A, facing B */}
                      <path d="M155,88 Q100,100 45,122" stroke="#f472b6" strokeWidth="3" fill="none" strokeDasharray="5,3"/>
                      <polygon points="40,120 52,115 50,126" fill="#f472b6"/>
                      {/* Runner figure â€” backpedaling (facing forward/toward B but moving backward) */}
                      <circle cx="100" cy="72" r="9" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5"/>
                      {/* Body slight back lean */}
                      <line x1="100" y1="81" x2="102" y2="103" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round"/>
                      {/* Arms back for balance */}
                      <line x1="102" y1="90" x2="88" y2="96" stroke="#7c3aed" strokeWidth="3.5" strokeLinecap="round"/>
                      <line x1="102" y1="90" x2="116" y2="96" stroke="#7c3aed" strokeWidth="3.5" strokeLinecap="round"/>
                      {/* Legs backpedaling â€” knees lifted backward */}
                      <line x1="102" y1="103" x2="90" y2="118" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round"/>
                      <line x1="90" y1="118" x2="86" y2="130" stroke="#7c3aed" strokeWidth="3.5" strokeLinecap="round"/>
                      <line x1="102" y1="103" x2="114" y2="116" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round"/>
                      <line x1="114" y1="116" x2="120" y2="128" stroke="#7c3aed" strokeWidth="3.5" strokeLinecap="round"/>
                      {/* Direction of movement arrow */}
                      <text x="78" y="48" textAnchor="middle" fontSize="7" fill="#be185d" fontWeight="700">â† MOVING</text>
                      <text x="125" y="55" textAnchor="middle" fontSize="7" fill="#7c3aed">FACING â†’</text>
                      {/* Eyes / gaze direction */}
                      <ellipse cx="104" cy="70" rx="2" ry="1.5" fill="#1e293b"/>
                      <ellipse cx="96" cy="70" rx="2" ry="1.5" fill="#1e293b"/>
                      {/* Timing stop label */}
                      <rect x="3" y="100" width="38" height="20" rx="3" fill="#dcfce7" stroke="#86efac" strokeWidth="1"/>
                      <text x="22" y="111" textAnchor="middle" fontSize="6.5" fill="#166534" fontWeight="700">TIMER</text>
                      <text x="22" y="119" textAnchor="middle" fontSize="6" fill="#166534">STOPS</text>
                      <text x="100" y="15" textAnchor="middle" fontSize="9" fill="#7e22ce" fontWeight="700">BACKPEDAL RETURN</text>
                      <text x="100" y="26" textAnchor="middle" fontSize="8" fill="#a855f7">B â†’ A facing forward â€” do NOT turn</text>
                    </svg>
                    <p className="text-xs text-slate-500 text-center px-2 pb-2">Backpedal Return â€” B to A facing forward, timer stops at A</p>
                  </div>

                </div>
                <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700 space-y-1">
                  <p><strong>Key Technique Points:</strong></p>
                  <p>â‘  Do not cross feet during lateral shuffles</p>
                  <p>â‘¡ Touch each cone with hand (base)</p>
                  <p>â‘¢ Face forward throughout â€” do not turn body</p>
                  <p>â‘£ Maintain athletic stance â€” low centre of gravity</p>
                  <p>â‘¤ Full speed â€” not technique demonstration</p>
                  <p>â‘¥ Backpedal to finish â€” do not turn and run</p>
                </div>
              </Section>

              <Button onClick={() => setStep(1)} className="w-full bg-amber-500 hover:bg-amber-600">Begin Assessment â†’</Button>
            </div>
          )}

          {/* â”€â”€ STEP 1: SAFETY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="font-bold text-red-800 mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Safety & Readiness Screen</h3>
                <p className="text-sm text-red-700">Confirm all criteria before high-speed testing. Use clinical judgment if any concern exists.</p>
              </div>
              <div className="space-y-2">
                {SAFETY_ITEMS.map(s => (
                  <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg border bg-slate-50 hover:bg-white transition-colors">
                    <Checkbox checked={!!safety[s.id]} onCheckedChange={v => setSafety(p => ({ ...p, [s.id]: !!v }))} className="mt-0.5" />
                    <span className="text-sm text-slate-700">{s.label}</span>
                  </div>
                ))}
              </div>
              {!safety.cleared_running || !safety.no_acute_pain || !safety.no_instability ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span><strong>Caution:</strong> High-speed agility testing may not be appropriate. Review clinical clearance before proceeding.</span>
                </div>
              ) : allSafeClear ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />All safety criteria confirmed. Safe to proceed.</div>
              ) : null}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1">â† Back</Button>
                <Button onClick={() => setStep(2)} className="flex-1 bg-amber-500 hover:bg-amber-600">{allSafeClear ? "Proceed to Setup â†’" : "Override & Continue â†’"}</Button>
              </div>
            </div>
          )}

          {/* â”€â”€ STEP 2: SETUP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                <Target className="w-4 h-4 inline mr-1" /><strong>Equipment & Environment Setup</strong>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Surface Type</Label>
                  <select value={setup.surface} onChange={e => setSetup(p => ({ ...p, surface: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                    <option>Indoor court</option><option>Outdoor grass</option><option>Synthetic turf</option><option>Gym floor</option><option>Concrete</option><option>Rubber</option>
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Footwear</Label>
                  <input value={setup.footwear} onChange={e => setSetup(p => ({ ...p, footwear: e.target.value }))} placeholder="e.g. Court shoes, runners" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Dominant Leg</Label>
                  <div className="flex gap-2 mt-1">
                    {["Left", "Right", "Unknown"].map(v => (
                      <button key={v} onClick={() => setSetup(p => ({ ...p, dominantLeg: v }))} className={`flex-1 py-1.5 rounded-lg border text-xs transition-colors ${setup.dominantLeg === v ? "bg-amber-500 text-white border-amber-500" : "bg-white text-slate-600 border-slate-300"}`}>{v}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Injured Side</Label>
                  <div className="flex gap-2 mt-1">
                    {["None", "Left", "Right"].map(v => (
                      <button key={v} onClick={() => setSetup(p => ({ ...p, injuredSide: v }))} className={`flex-1 py-1.5 rounded-lg border text-xs transition-colors ${setup.injuredSide === v ? "bg-amber-500 text-white border-amber-500" : "bg-white text-slate-600 border-slate-300"}`}>{v}</button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium">Testing Sport / Context</Label>
                  <input value={setup.testingSport} onChange={e => setSetup(p => ({ ...p, testingSport: e.target.value }))} placeholder="e.g. Football, Tennis, ACL rehab, General fitness" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border">
                <Checkbox checked={setup.indoor} onCheckedChange={v => setSetup(p => ({ ...p, indoor: !!v }))} />
                <Label className="text-sm">Indoor testing</Label>
              </div>
              <div>
                <Label className="text-sm font-medium">Sprint Confidence (0 = none, 10 = full)</Label>
                <div className="flex items-center gap-3 mt-1">
                  <input type="range" min={0} max={10} value={setup.sprintConfidence} onChange={e => setSetup(p => ({ ...p, sprintConfidence: Number(e.target.value) }))} className="flex-1 accent-amber-500" />
                  <span className="font-bold text-amber-600 w-5">{setup.sprintConfidence}</span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Pre-Test Fatigue (0 = fresh, 10 = exhausted)</Label>
                <div className="flex items-center gap-3 mt-1">
                  <input type="range" min={0} max={10} value={setup.fatigueLevel} onChange={e => setSetup(p => ({ ...p, fatigueLevel: Number(e.target.value) }))} className="flex-1 accent-amber-500" />
                  <span className="font-bold text-amber-600 w-5">{setup.fatigueLevel}</span>
                </div>
              </div>

              {/* Clinician script */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h4 className="font-semibold text-green-800 text-sm mb-2">ðŸ“‹ Clinician Script (read aloud)</h4>
                <p className="text-sm text-green-800 italic">"Complete the course as quickly as possible while maintaining control. Sprint forward to the centre cone, shuffle left to cone C, shuffle all the way right to cone D, shuffle back to centre cone B, then backpedal backwards to the start. Touch each cone with your hand. Do not cross your feet when shuffling. Face forward throughout. Ready?"</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">â† Back</Button>
                <Button onClick={() => setStep(3)} className="flex-1 bg-amber-500 hover:bg-amber-600">Start Trials â†’</Button>
              </div>
            </div>
          )}

          {/* â”€â”€ STEP 3: TRIAL RUNNER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Live best */}
              {bestTime && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-sm font-semibold text-amber-800">Live Best Time</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-mono font-bold text-amber-700">{formatTime(bestTime)}</span>
                    {classification && <Badge className={`text-xs ${classification.color}`}>{classification.label}</Badge>}
                  </div>
                </div>
              )}

              {/* Trial tabs */}
              <div className="flex gap-2">
                {[0, 1, 2].map(i => (
                  <button key={i} onClick={() => { setActiveTrial(i); setTrialState("idle"); setElapsed(0); }}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${activeTrial === i ? "bg-amber-500 text-white border-amber-500" : trialResults[i] ? (trialResults[i].invalid ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200") : "bg-white text-slate-600 border-slate-300"}`}>
                    Trial {i + 1}
                    {trialResults[i] && !trialResults[i].invalid && <span className="ml-1 text-xs">({formatTime(trialResults[i].time)})</span>}
                    {trialResults[i]?.invalid && <span className="ml-1 text-xs">[Invalid]</span>}
                  </button>
                ))}
              </div>

              {/* Timer */}
              <div className={`rounded-2xl p-6 text-center border-2 transition-colors ${trialState === "running" ? "bg-amber-50 border-amber-400" : trialState === "done" ? "bg-green-50 border-green-400" : "bg-slate-50 border-slate-200"}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  {trialState === "running" ? "â–¶ TRIAL RUNNING â€” Press STOP when finished" : trialState === "done" ? "âœ“ Trial Stopped" : `Trial ${activeTrial + 1} Ready`}
                </p>
                <p className={`text-7xl font-mono font-bold ${trialState === "running" ? "text-amber-600" : trialState === "done" ? "text-green-700" : "text-slate-400"}`}>
                  {trialState === "running" ? elapsed.toFixed(2) : elapsed > 0 ? elapsed.toFixed(2) : "0.00"}<span className="text-2xl">s</span>
                </p>
                <div className="mt-4 flex justify-center gap-3 flex-wrap">
                  {trialState === "idle" && <Button onClick={startTimer} size="lg" className="bg-amber-500 hover:bg-amber-600 px-8"><Play className="w-5 h-5 mr-2" />Start Trial {activeTrial + 1}</Button>}
                  {trialState === "running" && <Button onClick={stopTimer} variant="destructive" size="lg" className="px-8"><Square className="w-5 h-5 mr-2" />Stop</Button>}
                  {trialState === "done" && (
                    <div className="flex gap-2 flex-wrap justify-center w-full">
                      <Button onClick={() => saveTrial(false)} size="lg" className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="w-4 h-4 mr-1" />Save Valid</Button>
                      <Button onClick={() => saveTrial(true)} variant="outline" size="sm" className="border-red-300 text-red-600 hover:bg-red-50">Mark Invalid</Button>
                      <Button onClick={resetTimer} variant="outline" size="sm"><RotateCcw className="w-4 h-4 mr-1" />Reset</Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Invalid reasons */}
              {trialState === "done" && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">Mark any issues (optional)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {INVALID_REASONS.map(r => (
                      <button key={r} onClick={() => setInvalidReasons(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r])}
                        className={`px-3 py-2 rounded-lg border text-xs transition-colors ${invalidReasons.includes(r) ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-600 border-slate-300 hover:bg-red-50"}`}>{r}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trial summary table */}
              {trialResults.some(Boolean) && (
                <div className="p-4 bg-slate-50 rounded-xl border">
                  <p className="font-semibold text-sm text-slate-700 mb-2">Trial Summary</p>
                  <div className="space-y-2">
                    {trialResults.map((t, i) => t && (
                      <div key={i} className={`flex justify-between items-center px-3 py-2 rounded-lg text-sm ${t.invalid ? "bg-red-50 border border-red-200" : t.time === bestTime ? "bg-amber-50 border-2 border-amber-400" : "bg-white border"}`}>
                        <span className="font-medium">Trial {t.trialNum}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{formatTime(t.time)}</span>
                          {t.invalid && <Badge className="bg-red-100 text-red-700 text-xs">Invalid</Badge>}
                          {!t.invalid && t.time === bestTime && <Badge className="bg-amber-500 text-white text-xs">Best â˜…</Badge>}
                        </div>
                      </div>
                    ))}
                    {validTrials.length > 1 && (
                      <div className="flex justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-semibold">
                        <span>Mean</span><span className="font-mono">{formatTime(avgTime)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">â† Back</Button>
                <Button onClick={() => setStep(4)} disabled={!canSave} className="flex-1 bg-amber-500 hover:bg-amber-600">Movement Quality â†’</Button>
              </div>
            </div>
          )}

          {/* â”€â”€ STEP 4: MOVEMENT QUALITY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                <Activity className="w-4 h-4 inline mr-1" /><strong>Movement Quality Scoring</strong> â€” Rate clinician observations (0 = Severe deficit â†’ 4 = Excellent). For knee valgus, higher score = better control.
              </div>
              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border">
                {QUALITY_ITEMS.map(item => (
                  <QualitySlider
                    key={item.key}
                    label={item.label}
                    value={quality[item.key]}
                    onChange={v => setQuality(p => ({ ...p, [item.key]: v }))}
                  />
                ))}
              </div>
              <div className={`p-3 rounded-xl border-2 text-center ${avgQuality >= 3 ? "bg-green-50 border-green-300" : avgQuality >= 2 ? "bg-yellow-50 border-yellow-300" : "bg-red-50 border-red-300"}`}>
                <p className="text-xs text-slate-500">Overall Movement Quality</p>
                <p className="text-3xl font-bold">{avgQuality} / 4</p>
                <p className="font-semibold">{qualityLabel}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1">â† Back</Button>
                <Button onClick={() => setStep(5)} className="flex-1 bg-amber-500 hover:bg-amber-600">View Results â†’</Button>
              </div>
            </div>
          )}

          {/* â”€â”€ STEP 5: RESULTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 5 && (
            <div className="space-y-4">

              {/* Score card */}
              {bestTime && (
                <div className={`border-2 rounded-2xl p-5 text-center ${classification?.color || "bg-slate-50 border-slate-200"}`}>
                  <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-2">Best Time</p>
                  <p className="text-6xl font-mono font-bold">{formatTime(bestTime)}</p>
                  {classification && <p className="font-bold text-xl mt-2">{classification.label}</p>}
                  {rts && <Badge className={`mt-2 text-sm ${rts.color}`}>{rts.label}</Badge>}
                </div>
              )}

              {/* Performance metrics */}
              <Section title="Performance Metrics" icon={Activity} defaultOpen accent="amber">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {[
                    ["Best Time", formatTime(bestTime)],
                    ["Mean Time", formatTime(avgTime)],
                    ["Variability", trialVariability != null ? `${trialVariability}s` : "â€”"],
                    ["Consistency", consistency != null ? `${consistency}%` : "â€”"],
                    ["Valid Trials", validTrials.length],
                    ["Avg Quality", `${avgQuality}/4 (${qualityLabel})`],
                  ].map(([label, val]) => (
                    <div key={label} className="p-2 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="font-semibold text-slate-800">{val}</p>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Normative table */}
              {gender && (
                <Section title="Normative Comparison" icon={Activity} defaultOpen accent="blue">
                  <div className="space-y-1 text-xs">
                    <p className="text-slate-500 mb-2">Sex: {gender} | Source: Pauole et al. 2000, Semenick 1990</p>
                    {NORMS[gender === "male" ? "male" : "female"].map(row => (
                      <div key={row.label} className={`flex justify-between items-center px-3 py-2 rounded-lg ${classification?.label === row.label ? "border-2 font-bold" : "bg-slate-50"} ${row.color}`}>
                        <span>{row.label}</span>
                        <span>{row.max === 999 ? `> ${NORMS[gender === "male" ? "male" : "female"].find(r => r.max !== 999 && NORMS[gender === "male" ? "male" : "female"].indexOf(r) === NORMS[gender === "male" ? "male" : "female"].indexOf(row) - 1)?.max || "â€”"}s` : `< ${row.max}s`}</span>
                        {classification?.label === row.label && bestTime && <Badge className={`text-xs ml-2 ${row.color}`}>â†‘ {formatTime(bestTime)}</Badge>}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Trial comparison */}
              {trialResults.some(Boolean) && (
                <Section title="Trial Comparison" icon={Clock} defaultOpen accent="yellow">
                  <div className="space-y-2">
                    {trialResults.map((t, i) => t && (
                      <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${t.invalid ? "bg-red-50 border border-red-200" : "bg-white border"}`}>
                        <span className="text-sm font-medium w-16">Trial {t.trialNum}</span>
                        {!t.invalid && (
                          <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: bestTime ? `${Math.min(100, (bestTime / t.time) * 100)}%` : "0%" }} />
                          </div>
                        )}
                        <span className="font-mono text-sm font-bold w-16 text-right">{formatTime(t.time)}</span>
                        {t.invalid && <Badge className="bg-red-100 text-red-700 text-xs">Invalid</Badge>}
                        {!t.invalid && t.time === bestTime && <Badge className="bg-amber-500 text-white text-xs">Best</Badge>}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Interpretation */}
              <Section title="Clinical Interpretation" icon={Activity} defaultOpen accent="amber">
                <p className="text-sm text-slate-700 leading-relaxed">{generateInterpretation() || "Complete at least one trial to generate interpretation."}</p>
              </Section>

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
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 rounded-lg p-3 border">{generateSoap() || "Complete a trial to generate SOAP output."}</pre>
              </Section>

              {/* References */}
              <Section title="Evidence-Based References" icon={BookOpen} accent="slate">
                <div className="space-y-2 text-xs text-slate-600">
                  {[
                    { n: 1, t: "Pauole K, Madole K, Garhammer J, Lacourse M, Rozenek R.", s: "Reliability and validity of the T-test as a measure of agility, leg power, and leg speed in college-aged men and women. J Strength Cond Res. 2000;14(4):443â€“450." },
                    { n: 2, t: "Semenick D.", s: "Tests and measurements: The T-test. NSCA Journal. 1990;12(1):36â€“37." },
                    { n: 3, t: "Sheppard JM, Young WB.", s: "Agility literature review: Classifications, training and testing. J Sports Sci. 2006;24(9):919â€“932." },
                    { n: 4, t: "Nimphius S, Callaghan SJ, Spiteri T, Lockie RG.", s: "Change of direction deficit: A more isolated measure of change of direction performance than total 505 time. J Strength Cond Res. 2016;30(11):3024â€“3032." },
                    { n: 5, t: "Young WB, James R, Montgomery I.", s: "Is muscle power related to running speed with changes of direction? J Sports Med Phys Fitness. 2002;42(3):282â€“288." },
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
                <Textarea value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)} placeholder="Movement observations, sport context, rehabilitation stage, return-to-sport considerations..." rows={3} className="mt-1" />
              </div>

              {!canSave && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />Complete at least one valid agility trial before saving.
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(4)} className="flex-1">â† Back</Button>
                <Button onClick={handleSave} disabled={!canSave} className="flex-1 bg-amber-500 hover:bg-amber-600">
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
            {validTrials.length > 0 && <span className="text-green-600 font-medium">{validTrials.length} valid trial(s)</span>}
            {bestTime && <span className="text-amber-600 font-medium">Best: {formatTime(bestTime)}</span>}
            {rts && <span className={`font-medium text-xs px-2 py-0.5 rounded-full border ${rts.color}`}>{rts.label}</span>}
          </div>
          {step === 5 && (
            <Button onClick={handleSave} disabled={!canSave} size="sm" className="bg-amber-500 hover:bg-amber-600">
              <Save className="w-3 h-3 mr-1" />Save
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}