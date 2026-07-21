import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Save, X, Play, Square, RotateCcw, Info, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Clock, Activity, BookOpen, Flag, FileText, Brain, Eye
} from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// ─── NORMATIVE DATA (Tombaugh 2004, age-stratified, seconds) ─────────────────
const NORMS = {
  A: [
    { age: "18–24", ageMin: 18, ageMax: 24, mean: 22.6, sd: 7.3 },
    { age: "25–34", ageMin: 25, ageMax: 34, mean: 24.5, sd: 8.9 },
    { age: "35–44", ageMin: 35, ageMax: 44, mean: 25.7, sd: 9.5 },
    { age: "45–54", ageMin: 45, ageMax: 54, mean: 28.6, sd: 11.3 },
    { age: "55–64", ageMin: 55, ageMax: 64, mean: 34.5, sd: 14.3 },
    { age: "65–74", ageMin: 65, ageMax: 74, mean: 39.5, sd: 16.3 },
    { age: "75–85", ageMin: 75, ageMax: 85, mean: 54.4, sd: 25.6 },
  ],
  B: [
    { age: "18–24", ageMin: 18, ageMax: 24, mean: 50.2, sd: 17.5 },
    { age: "25–34", ageMin: 25, ageMax: 34, mean: 54.4, sd: 18.4 },
    { age: "35–44", ageMin: 35, ageMax: 44, mean: 60.5, sd: 21.0 },
    { age: "45–54", ageMin: 45, ageMax: 54, mean: 69.5, sd: 27.1 },
    { age: "55–64", ageMin: 55, ageMax: 64, mean: 83.0, sd: 35.3 },
    { age: "65–74", ageMin: 65, ageMax: 74, mean: 105.0, sd: 46.0 },
    { age: "75–85", ageMin: 75, ageMax: 85, mean: 153.1, sd: 76.1 },
  ],
};

function getNorm(part, age) {
  if (!age) return null;
  return NORMS[part].find(n => age >= n.ageMin && age <= n.ageMax) || null;
}

function zScore(time, norm) {
  if (!norm) return null;
  return parseFloat(((time - norm.mean) / norm.sd).toFixed(2));
}

// For TMT, higher time = worse, so positive z = impaired
function classifyZ(z) {
  if (z === null) return null;
  if (z <= -0.5) return { label: "Superior / Fast", color: "bg-green-100 text-green-800 border-green-300" };
  if (z <= 0.5)  return { label: "Average", color: "bg-blue-100 text-blue-800 border-blue-300" };
  if (z <= 1.5)  return { label: "Below Average", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  if (z <= 2.0)  return { label: "Impaired", color: "bg-orange-100 text-orange-800 border-orange-300" };
  return { label: "Severely Impaired", color: "bg-red-100 text-red-800 border-red-300" };
}

function formatSecs(s) {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2);
  return m > 0 ? `${m}m ${sec}s` : `${parseFloat(s.toFixed(2))}s`;
}

// ─── NODE LAYOUT — fixed positions for reproducibility ───────────────────────
// Part A: numbers 1–13 (keeping count manageable for screen-based version)
const NODES_A = [
  { id: 1,  label: "1",  x: 20, y: 15 }, { id: 2,  label: "2",  x: 55, y: 30 },
  { id: 3,  label: "3",  x: 80, y: 12 }, { id: 4,  label: "4",  x: 70, y: 50 },
  { id: 5,  label: "5",  x: 35, y: 55 }, { id: 6,  label: "6",  x: 12, y: 42 },
  { id: 7,  label: "7",  x: 22, y: 72 }, { id: 8,  label: "8",  x: 50, y: 78 },
  { id: 9,  label: "9",  x: 78, y: 70 }, { id: 10, label: "10", x: 88, y: 42 },
  { id: 11, label: "11", x: 60, y: 88 }, { id: 12, label: "12", x: 30, y: 88 },
  { id: 13, label: "13", x: 8,  y: 82 },
];

// Part B: alternating 1-A-2-B-3-C-4-D-5-E-6-F-7-G (13 nodes)
const NODES_B = [
  { id: 1,  label: "1",  x: 15, y: 20, type: "num" }, { id: 2,  label: "A",  x: 45, y: 12, type: "let" },
  { id: 3,  label: "2",  x: 75, y: 18, type: "num" }, { id: 4,  label: "B",  x: 85, y: 45, type: "let" },
  { id: 5,  label: "3",  x: 60, y: 55, type: "num" }, { id: 6,  label: "C",  x: 30, y: 48, type: "let" },
  { id: 7,  label: "4",  x: 10, y: 60, type: "num" }, { id: 8,  label: "D",  x: 20, y: 82, type: "let" },
  { id: 9,  label: "5",  x: 50, y: 80, type: "num" }, { id: 10, label: "E",  x: 80, y: 75, type: "let" },
  { id: 11, label: "6",  x: 90, y: 55, type: "num" }, { id: 12, label: "F",  x: 68, y: 88, type: "let" },
  { id: 13, label: "7",  x: 40, y: 90, type: "num" },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = false, accent = "indigo" }) {
  const [open, setOpen] = useState(defaultOpen);
  const map = {
    indigo: "border-indigo-200 bg-indigo-50", blue: "border-blue-200 bg-blue-50",
    green: "border-green-200 bg-green-50", red: "border-red-200 bg-red-50",
    slate: "border-slate-200 bg-slate-50", amber: "border-amber-200 bg-amber-50",
    orange: "border-orange-200 bg-orange-50", purple: "border-purple-200 bg-purple-50",
  };
  return (
    <div className={`border rounded-xl overflow-hidden ${map[accent] || map.indigo}`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left font-semibold text-slate-800 hover:bg-white/50 transition-colors">
        <span className="flex items-center gap-2 text-sm">{Icon && <Icon className="w-4 h-4" />}{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1 bg-white/70">{children}</div>}
    </div>
  );
}

function ImageCard({ url, caption }) {
  const [ex, setEx] = useState(false);
  return (
    <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
      <img src={url} alt={caption} className={`w-full object-cover cursor-pointer transition-all ${ex ? "max-h-96" : "max-h-36"}`}
        onClick={() => setEx(e => !e)} onError={e => { e.target.style.display = "none"; }} />
      <p className="text-xs text-slate-500 text-center p-2">{caption} <span className="text-indigo-500 cursor-pointer" onClick={() => setEx(e => !e)}>{ex ? "(collapse)" : "(expand)"}</span></p>
    </div>
  );
}

// ─── INTERACTIVE TRAIL CANVAS ─────────────────────────────────────────────────
function TrailCanvas({ part, nodes, onComplete, onError }) {
  const [phase, setPhase] = useState("ready"); // ready | running | done
  const [nextIdx, setNextIdx] = useState(0);   // index into nodes array
  const [connections, setConnections] = useState([]); // [{from, to}]
  const [errors, setErrors] = useState(0);
  const [corrections, setCorrections] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [flash, setFlash] = useState(null); // nodeId that flashed red
  const startRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const startTrial = () => {
    setPhase("running");
    setNextIdx(0);
    setConnections([]);
    setErrors(0);
    setCorrections(0);
    setElapsed(0);
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 80);
  };

  const resetTrial = () => {
    clearInterval(intervalRef.current);
    setPhase("ready");
    setNextIdx(0);
    setConnections([]);
    setErrors(0);
    setElapsed(0);
    setFlash(null);
  };

  const handleNodeClick = (node, idx) => {
    if (phase !== "running") return;
    if (idx === nextIdx) {
      // Correct
      if (nextIdx > 0) setConnections(c => [...c, { from: nodes[nextIdx - 1].id, to: node.id }]);
      const newNext = nextIdx + 1;
      setNextIdx(newNext);
      if (newNext >= nodes.length) {
        // Complete!
        clearInterval(intervalRef.current);
        const t = parseFloat(((Date.now() - startRef.current) / 1000).toFixed(2));
        setElapsed(t);
        setPhase("done");
        onComplete({ time: t, errors, corrections });
        toast.success(`Part ${part} complete in ${t}s`);
      }
    } else {
      // Error
      setErrors(e => e + 1);
      setFlash(node.id);
      setTimeout(() => setFlash(null), 500);
      onError();
    }
  };

  const completedIds = new Set(nodes.slice(0, nextIdx).map(n => n.id));
  const nextNode = nodes[nextIdx];

  // Build SVG lines for connections
  const getPos = (id) => {
    const n = nodes.find(n => n.id === id);
    return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
  };

  const partColor = part === "A" ? "#4f46e5" : "#ea580c";
  const partLight = part === "A" ? "bg-indigo-50 border-indigo-300" : "bg-orange-50 border-orange-300";
  const partText = part === "A" ? "text-indigo-700" : "text-orange-700";

  return (
    <div className="space-y-3">
      {/* Timer bar */}
      <div className={`rounded-xl border-2 p-4 text-center transition-colors ${phase === "running" ? partLight : phase === "done" ? "bg-green-50 border-green-400" : "bg-slate-50 border-slate-200"}`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
          {phase === "ready" ? `Part ${part} — Ready` : phase === "running" ? `▶ Part ${part} Running` : `✓ Part ${part} Complete`}
        </p>
        <p className={`text-5xl font-mono font-bold ${phase === "running" ? partText : phase === "done" ? "text-green-700" : "text-slate-300"}`}>
          {elapsed.toFixed(1)}<span className="text-xl">s</span>
        </p>
        {phase === "running" && (
          <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
            <span>Errors: <strong className="text-red-600">{errors}</strong></span>
            <span>Progress: <strong>{nextIdx}/{nodes.length}</strong></span>
            <span>Corrections: <strong className="text-amber-600">{corrections}</strong></span>
          </div>
        )}
        {phase === "done" && (
          <div className="mt-2 text-sm text-green-800">
            <CheckCircle2 className="w-4 h-4 inline mr-1" />
            Completed in <strong>{formatSecs(elapsed)}</strong> | Errors: <strong>{errors}</strong>
          </div>
        )}
      </div>

      {/* Trail canvas */}
      <div className="relative border-2 border-slate-200 rounded-xl overflow-hidden bg-white" style={{ paddingBottom: "66%" }}>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 66" preserveAspectRatio="xMidYMid meet">
          {/* Connection lines */}
          {connections.map((c, i) => {
            const from = getPos(c.from), to = getPos(c.to);
            return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={partColor} strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />;
          })}
          {/* Next-target indicator line (ghost) */}
          {phase === "running" && nextIdx > 0 && nextNode && (() => {
            const from = getPos(nodes[nextIdx - 1].id);
            return <line x1={from.x} y1={from.y} x2={nextNode.x} y2={nextNode.y} stroke={partColor} strokeWidth="0.5" strokeDasharray="1.5,1" opacity="0.3" />;
          })()}
          {/* Nodes */}
          {nodes.map((node, idx) => {
            const done = completedIds.has(node.id);
            const isNext = phase === "running" && idx === nextIdx;
            const isFlash = flash === node.id;
            return (
              <g key={node.id} onClick={() => handleNodeClick(node, idx)} style={{ cursor: phase === "running" ? "pointer" : "default" }}>
                <circle
                  cx={node.x} cy={node.y} r="4.5"
                  fill={isFlash ? "#ef4444" : done ? partColor : isNext ? "white" : "#f1f5f9"}
                  stroke={isFlash ? "#dc2626" : done ? partColor : isNext ? partColor : "#94a3b8"}
                  strokeWidth={isNext ? "1.5" : "0.8"}
                  opacity={1}
                />
                {isNext && !done && (
                  <circle cx={node.x} cy={node.y} r="5.5" fill="none" stroke={partColor} strokeWidth="0.8" opacity="0.4">
                    <animate attributeName="r" values="4.5;6.5;4.5" dur="1s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1s" repeatCount="indefinite" />
                  </circle>
                )}
                <text x={node.x} y={node.y + 1.3} textAnchor="middle" fontSize="2.8" fontWeight="bold"
                  fill={done ? "white" : isNext ? partColor : "#64748b"}>
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hint */}
      {phase === "running" && nextNode && (
        <div className={`text-center text-sm font-semibold py-2 rounded-lg border ${partLight} ${partText}`}>
          Next: tap <strong className="text-lg">{nextNode.label}</strong>
          {part === "B" && nextNode.type && <span className="text-xs ml-2 opacity-70">({nextNode.type === "num" ? "number" : "letter"})</span>}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2 justify-center flex-wrap">
        {phase === "ready" && (
          <Button onClick={startTrial} size="lg" className={part === "A" ? "bg-indigo-600 hover:bg-indigo-700 px-8" : "bg-orange-600 hover:bg-orange-700 px-8"}>
            <Play className="w-5 h-5 mr-2" />Start Part {part}
          </Button>
        )}
        {phase === "running" && (
          <Button onClick={resetTrial} variant="outline" size="sm">
            <RotateCcw className="w-4 h-4 mr-1" />Reset
          </Button>
        )}
        {phase === "done" && (
          <Button onClick={resetTrial} variant="outline" size="sm">
            <RotateCcw className="w-4 h-4 mr-1" />Redo Part {part}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function TrailMakingTestTMTPartsAandBRunner({ client, onSave, onClose }) {
  const [step, setStep] = useState(0);

  // Setup
  const [setup, setSetup] = useState({
    environment: "Quiet clinic room",
    visualImpairment: false, glassesWorn: false,
    handDominance: "Right", neurologicalDiagnosis: "",
    baselineFatigue: 0, baselineAttention: 5,
    languageProficiency: "English (native)",
    clinicianAdministered: true,
  });

  // Practice
  const [practiceConfirmed, setPracticeConfirmed] = useState(false);

  // Results
  const [partAResult, setPartAResult] = useState(null); // { time, errors, corrections }
  const [partBResult, setPartBResult] = useState(null);
  const [partAErrors, setPartAErrors] = useState(0); // manual add on top of canvas errors
  const [partBErrors, setPartBErrors] = useState(0);
  const [observations, setObservations] = useState({
    hesitation: false, confusion: false, perseveration: false,
    tremor: false, fatigue: false, frustration: false, verbalStrategy: false,
    impulsivity: false, notes: "",
  });
  const [clinicalNotes, setClinicalNotes] = useState("");

  const age = client?.date_of_birth
    ? Math.floor((Date.now() - new Date(client.date_of_birth)) / (365.25 * 24 * 3600 * 1000))
    : null;

  // Metrics
  const timeA = partAResult?.time || null;
  const timeB = partBResult?.time || null;
  const errorsA = (partAResult?.errors || 0) + partAErrors;
  const errorsB = (partBResult?.errors || 0) + partBErrors;
  const bMinusA = timeA && timeB ? parseFloat((timeB - timeA).toFixed(2)) : null;
  const baRatio = timeA && timeB ? parseFloat((timeB / timeA).toFixed(2)) : null;

  const normA = getNorm("A", age);
  const normB = getNorm("B", age);
  const zA = timeA ? zScore(timeA, normA) : null;
  const zB = timeB ? zScore(timeB, normB) : null;
  const clsA = classifyZ(zA);
  const clsB = classifyZ(zB);

  // Percentile approx from z (using normal distribution approximation)
  function zToPercentile(z) {
    if (z === null) return null;
    // Approximate percentile where LOWER time is better (so we flip)
    const p = 0.5 * (1 + erf(-z / Math.sqrt(2)));
    return Math.round(p * 100);
  }
  function erf(x) {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }
  const pctA = zToPercentile(zA);
  const pctB = zToPercentile(zB);

  // Interpretation
  const generateInterpretation = () => {
    if (!timeA && !timeB) return "";
    let text = "Trail Making Test completed";
    if (timeA && timeB) text += ` across both parts.`;
    else if (timeA) text += ` (Part A only).`;
    else text += ` (Part B only).`;

    if (timeA) text += ` Part A (visual scanning/sequencing) completed in ${formatSecs(timeA)}${clsA ? `, classified as ${clsA.label}` : ""}${errorsA > 0 ? ` with ${errorsA} error(s)` : ""}.`;
    if (timeB) text += ` Part B (executive function/set-shifting) completed in ${formatSecs(timeB)}${clsB ? `, classified as ${clsB.label}` : ""}${errorsB > 0 ? ` with ${errorsB} error(s)` : ""}.`;

    if (baRatio !== null) {
      if (baRatio > 3.0) text += ` The B/A ratio of ${baRatio} exceeds the threshold of 3.0, indicating executive dysfunction disproportionate to processing speed — consistent with frontal lobe inefficiency.`;
      else if (baRatio > 2.5) text += ` The B/A ratio of ${baRatio} is elevated, suggesting borderline executive task-switching difficulty.`;
      else text += ` The B/A ratio of ${baRatio} is within expected range, suggesting intact executive flexibility relative to processing speed.`;
    }

    if (observations.perseveration) text += " Perseverative errors were noted, which may reflect frontal lobe executive dysfunction.";
    if (observations.hesitation) text += " Significant hesitation was observed during task transitions.";
    if (observations.confusion) text += " The participant demonstrated confusion between alternating sequences during Part B.";
    if (observations.tremor) text += " Tremor was noted which may have impacted accuracy.";
    if (setup.baselineFatigue >= 7) text += " High pre-test fatigue may have compromised performance.";

    text += " Results should be interpreted in the context of the broader neuropsychological profile, educational background, and clinical history.";
    return text;
  };

  // Flags
  const generateFlags = () => {
    const flags = [];
    if (!timeA && !timeB) return flags;
    if (zA !== null && zA > 2.0) flags.push({ label: "Part A severely impaired — processing speed deficit", severity: "high" });
    else if (zA !== null && zA > 1.5) flags.push({ label: "Part A impaired — slowed visual scanning/attention", severity: "medium" });
    if (zB !== null && zB > 2.0) flags.push({ label: "Part B severely impaired — executive dysfunction", severity: "high" });
    else if (zB !== null && zB > 1.5) flags.push({ label: "Part B impaired — reduced cognitive flexibility", severity: "medium" });
    if (baRatio !== null && baRatio > 3.0) flags.push({ label: "B/A ratio > 3.0 — executive dysfunction beyond processing speed", severity: "high" });
    else if (baRatio !== null && baRatio > 2.5) flags.push({ label: "Elevated B/A ratio — borderline executive difficulty", severity: "medium" });
    if (errorsB > 3) flags.push({ label: "High error rate on Part B — task-switching deficit", severity: "high" });
    else if (errorsB > 1) flags.push({ label: "Errors on Part B — monitor cognitive switching", severity: "medium" });
    if (observations.perseveration) flags.push({ label: "Perseverative errors — frontal lobe involvement", severity: "high" });
    if (observations.confusion) flags.push({ label: "Sequence confusion observed during Part B", severity: "medium" });
    if (setup.baselineFatigue >= 7) flags.push({ label: "High pre-test fatigue — interpret with caution", severity: "low" });
    if (zA !== null && zA > 1.5) flags.push({ label: "Consider neuropsychological referral", severity: "info" });
    flags.push({ label: "Serial monitoring recommended at next cognitive review", severity: "info" });
    return flags;
  };

  const flagColorMap = { high: "bg-red-100 text-red-800 border-red-200", medium: "bg-yellow-100 text-yellow-800 border-yellow-200", low: "bg-blue-100 text-blue-800 border-blue-200", info: "bg-slate-100 text-slate-700 border-slate-200" };

  // SOAP
  const generateSoap = () => {
    if (!timeA && !timeB) return "";
    const lines = ["• Trail Making Test (TMT) — Parts A & B"];
    if (timeA) {
      lines.push(`  Part A (Visual scanning / Sequencing): ${formatSecs(timeA)}${errorsA > 0 ? ` | Errors: ${errorsA}` : ""}${clsA ? ` | ${clsA.label}` : ""}${pctA != null ? ` | ~${pctA}th percentile` : ""}`);
    }
    if (timeB) {
      lines.push(`  Part B (Executive function / Set-shifting): ${formatSecs(timeB)}${errorsB > 0 ? ` | Errors: ${errorsB}` : ""}${clsB ? ` | ${clsB.label}` : ""}${pctB != null ? ` | ~${pctB}th percentile` : ""}`);
    }
    if (bMinusA != null) lines.push(`  B − A Difference: ${bMinusA}s (executive burden indicator)`);
    if (baRatio != null) lines.push(`  B/A Ratio: ${baRatio} ${baRatio > 3.0 ? "⚠ > 3.0 — executive dysfunction" : "(within expected range)"}`);
    if (clinicalNotes) lines.push(`  Clinical Notes: ${clinicalNotes}`);
    lines.push(`  Interpretation: ${generateInterpretation()}`);
    lines.push(`  Reference: Tombaugh (2004) Arch Clin Neuropsychol | Norms age-stratified`);
    return lines.join("\n");
  };

  const canSave = !!timeA && !!timeB;

  const handleSave = () => {
    if (!canSave) { toast.error("Complete both TMT parts before saving."); return; }
    onSave({
      status: "completed",
      result_value: timeB,
      notes: clinicalNotes,
      assessment_date: todayLocal(),
      additional_data: {
        soap_text: generateSoap(),
        measurement_type: "TMT_AB",
        part_a_seconds: timeA,
        part_b_seconds: timeB,
        part_a_errors: errorsA,
        part_b_errors: errorsB,
        b_minus_a: bMinusA,
        b_a_ratio: baRatio,
        z_score_a: zA,
        z_score_b: zB,
        percentile_a: pctA,
        percentile_b: pctB,
        classification_a: clsA?.label,
        classification_b: clsB?.label,
        setup,
        observations,
        flags: generateFlags().map(f => f.label),
        interpretation: generateInterpretation(),
      },
    });
    toast.success("TMT saved successfully.");
  };

  const STEPS = [
    { label: "Overview", icon: Info },
    { label: "Setup", icon: Activity },
    { label: "Practice", icon: Eye },
    { label: "Part A", icon: Brain },
    { label: "Part B", icon: Brain },
    { label: "Observations", icon: Flag },
    { label: "Results", icon: FileText },
  ];

  const stepDone = (i) => {
    if (i === 3) return !!partAResult;
    if (i === 4) return !!partBResult;
    return false;
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[98vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Trail Making Test — Parts A & B</h2>
            <p className="text-xs text-slate-500 mt-0.5">Processing speed • Executive function • Cognitive flexibility • Attention</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Step Nav */}
        <div className="flex overflow-x-auto border-b bg-slate-50 shrink-0 px-2 py-1 gap-1">
          {STEPS.map((s, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${step === i ? "bg-indigo-600 text-white" : stepDone(i) ? "bg-green-100 text-green-700" : "text-slate-500 hover:bg-slate-100"}`}>
              {stepDone(i) ? <CheckCircle2 className="w-3 h-3" /> : <s.icon className="w-3 h-3" />}
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ── STEP 0: OVERVIEW ─────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2"><Brain className="w-4 h-4" />Assessment Overview</h3>
                <p className="text-sm text-indigo-800 mb-3">The Trail Making Test (TMT) is a foundational neuropsychological instrument assessing visual attention, processing speed, cognitive sequencing (Part A), and executive function with cognitive flexibility and task-switching ability (Part B).</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {["Cognitive screening", "Executive dysfunction", "Parkinson's disease", "Dementia screening", "Concussion / TBI", "Attention assessment", "Frontal lobe function", "Dual-tasking", "Cognitive rehabilitation", "Neuropsychological monitoring"].map(u => (
                    <div key={u} className="flex items-center gap-1.5 text-indigo-700"><CheckCircle2 className="w-3 h-3 shrink-0" />{u}</div>
                  ))}
                </div>
              </div>

              <Section title="Part A vs Part B — What They Measure" icon={Brain} defaultOpen accent="indigo">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <p className="font-bold text-indigo-800 mb-1">Part A</p>
                    <p className="text-xs text-indigo-700 mb-2">Connect numbers 1 → 2 → 3 … in order</p>
                    <div className="space-y-0.5 text-xs text-indigo-600">
                      <p>• Visual scanning speed</p>
                      <p>• Psychomotor speed</p>
                      <p>• Sequential attention</p>
                      <p>• Processing speed</p>
                    </div>
                  </div>
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                    <p className="font-bold text-orange-800 mb-1">Part B</p>
                    <p className="text-xs text-orange-700 mb-2">Alternate: 1 → A → 2 → B → 3 → C …</p>
                    <div className="space-y-0.5 text-xs text-orange-600">
                      <p>• Executive function</p>
                      <p>• Cognitive flexibility</p>
                      <p>• Task switching</p>
                      <p>• Working memory</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800">
                  <p className="font-semibold mb-1">B/A Ratio (executive index)</p>
                  <p>B − A isolates executive contribution. B/A ratio &lt; 3.0 = normal. &gt; 3.0 = executive dysfunction beyond processing speed.</p>
                </div>
              </Section>

              <Section title="Instructional Images" icon={Eye} accent="slate">
                <div className="grid grid-cols-2 gap-3">
                  <ImageCard url="https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400" caption="Trail A — Sequential numbering" />
                  <ImageCard url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400" caption="Trail B — Number-letter alternating" />
                  <ImageCard url="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400" caption="Correct sequencing — plan before moving" />
                  <ImageCard url="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400" caption="Cognitive domains — frontal executive" />
                </div>
                <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-700 space-y-1">
                  <p><strong>Clinician Tips:</strong></p>
                  <p>① Complete practice trial first to ensure understanding</p>
                  <p>② Allow rest between Part A and Part B (60–90 seconds)</p>
                  <p>③ On error — say "wrong, go back" without stopping timer</p>
                  <p>④ Tap each numbered/lettered circle in sequence</p>
                  <p>⑤ Record all errors, hesitations, and strategies used</p>
                </div>
              </Section>

              <Button onClick={() => setStep(1)} className="w-full bg-indigo-600 hover:bg-indigo-700">Begin Assessment →</Button>
            </div>
          )}

          {/* ── STEP 1: SETUP ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm text-indigo-800">
                <Activity className="w-4 h-4 inline mr-1" /><strong>Test Setup</strong> — Capture environmental and client factors.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Environment</Label>
                  <select value={setup.environment} onChange={e => setSetup(p => ({ ...p, environment: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <option>Quiet clinic room</option><option>Clinic — some noise</option><option>Ward / bedside</option><option>Home visit</option><option>Noisy environment</option>
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Hand Dominance</Label>
                  <div className="flex gap-2 mt-1">
                    {["Right", "Left", "Ambidextrous"].map(v => (
                      <button key={v} onClick={() => setSetup(p => ({ ...p, handDominance: v }))} className={`flex-1 py-1.5 rounded-lg border text-xs transition-colors ${setup.handDominance === v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-300"}`}>{v}</button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium">Neurological Diagnosis</Label>
                  <input value={setup.neurologicalDiagnosis} onChange={e => setSetup(p => ({ ...p, neurologicalDiagnosis: e.target.value }))} placeholder="e.g. Parkinson's, TBI, nil known" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium">Language Proficiency</Label>
                  <input value={setup.languageProficiency} onChange={e => setSetup(p => ({ ...p, languageProficiency: e.target.value }))} placeholder="e.g. English (native)" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
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
              <div>
                <Label className="text-sm font-medium">Baseline Fatigue (0–10)</Label>
                <div className="flex items-center gap-3 mt-1">
                  <input type="range" min={0} max={10} value={setup.baselineFatigue} onChange={e => setSetup(p => ({ ...p, baselineFatigue: Number(e.target.value) }))} className="flex-1 accent-indigo-600" />
                  <span className="font-bold text-indigo-600 w-5">{setup.baselineFatigue}</span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Baseline Attention / Alertness (0–10)</Label>
                <div className="flex items-center gap-3 mt-1">
                  <input type="range" min={0} max={10} value={setup.baselineAttention} onChange={e => setSetup(p => ({ ...p, baselineAttention: Number(e.target.value) }))} className="flex-1 accent-indigo-600" />
                  <span className="font-bold text-indigo-600 w-5">{setup.baselineAttention}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1">← Back</Button>
                <Button onClick={() => setStep(2)} className="flex-1 bg-indigo-600 hover:bg-indigo-700">Practice Trial →</Button>
              </div>
            </div>
          )}

          {/* ── STEP 2: PRACTICE ──────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h3 className="font-bold text-green-800 mb-1">Practice Trial</h3>
                <p className="text-sm text-green-700">Ensure the participant understands both tasks before timed trials begin. Use this to demonstrate the sequence.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
                  <p className="font-bold text-indigo-800 text-sm mb-2">Part A Example</p>
                  <div className="flex justify-center gap-2 items-center flex-wrap">
                    {[1, 2, 3, 4, 5].map((n, i) => (
                      <React.Fragment key={n}>
                        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow">{n}</div>
                        {i < 4 && <span className="text-indigo-400 font-bold">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  <p className="text-xs text-indigo-600 mt-2">Connect numbers in order</p>
                </div>
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-center">
                  <p className="font-bold text-orange-800 text-sm mb-2">Part B Example</p>
                  <div className="flex justify-center gap-1 items-center flex-wrap">
                    {["1","A","2","B","3"].map((n, i) => (
                      <React.Fragment key={i}>
                        <div className={`w-9 h-9 rounded-full font-bold text-sm flex items-center justify-center shadow ${isNaN(n) ? "bg-orange-500 text-white" : "bg-indigo-600 text-white"}`}>{n}</div>
                        {i < 4 && <span className="text-slate-400 text-xs">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  <p className="text-xs text-orange-600 mt-2">Alternate number → letter</p>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                <p className="font-semibold text-green-800 text-sm">📋 Read aloud to participant:</p>
                <div className="p-3 bg-white rounded-lg border border-green-200 text-sm text-slate-700 italic">
                  "I'm going to show you some circles with numbers in them. I want you to connect them in order, starting from 1, then 2, then 3, as fast as you can. When you make a mistake, I'll tell you to go back and fix it, but keep going as fast as you can. Do you understand?"
                </div>
                <div className="p-3 bg-white rounded-lg border border-green-200 text-sm text-slate-700 italic">
                  "For the next part, the circles have both numbers and letters. Connect them in order, alternating between number and letter — 1, then A, then 2, then B, then 3, then C, and so on. Do you understand?"
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-slate-50 border rounded-xl">
                <Checkbox checked={practiceConfirmed} onCheckedChange={v => setPracticeConfirmed(!!v)} className="mt-0.5" />
                <div>
                  <Label className="text-sm font-semibold">Participant understands both tasks</Label>
                  <p className="text-xs text-slate-500 mt-0.5">Confirm before proceeding to timed trials</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">← Back</Button>
                <Button onClick={() => setStep(3)} disabled={!practiceConfirmed} className="flex-1 bg-indigo-600 hover:bg-indigo-700">Begin Part A →</Button>
              </div>
            </div>
          )}

          {/* ── STEP 3: PART A ────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm text-indigo-800">
                <Brain className="w-4 h-4 inline mr-1" /><strong>Part A — Sequencing (Numbers 1–13)</strong><br />
                <span className="text-xs">Tap each numbered circle in order: 1 → 2 → 3 → … → 13. Timer starts on first tap.</span>
              </div>
              <TrailCanvas
                part="A"
                nodes={NODES_A}
                onComplete={(data) => setPartAResult(data)}
                onError={() => {}}
              />
              {partAResult && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 space-y-1">
                  <p><CheckCircle2 className="w-4 h-4 inline mr-1" />Part A recorded: <strong>{formatSecs(partAResult.time)}</strong> | Errors: <strong>{partAResult.errors}</strong></p>
                  <div className="flex items-center gap-3 mt-2">
                    <Label className="text-xs">Additional errors to add:</Label>
                    <button onClick={() => setPartAErrors(e => Math.max(0, e - 1))} className="w-7 h-7 rounded border bg-white font-bold">−</button>
                    <span className="font-bold w-6 text-center">{partAErrors}</span>
                    <button onClick={() => setPartAErrors(e => e + 1)} className="w-7 h-7 rounded border bg-white font-bold">+</button>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">← Back</Button>
                <Button onClick={() => setStep(4)} disabled={!partAResult} className="flex-1 bg-orange-600 hover:bg-orange-700">Begin Part B →</Button>
              </div>
            </div>
          )}

          {/* ── STEP 4: PART B ────────────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-800">
                <Brain className="w-4 h-4 inline mr-1" /><strong>Part B — Set-Shifting (Numbers & Letters)</strong><br />
                <span className="text-xs">Alternate: 1 → A → 2 → B → 3 → C → 4 → D → 5 → E → 6 → F → 7</span>
              </div>
              <TrailCanvas
                part="B"
                nodes={NODES_B}
                onComplete={(data) => setPartBResult(data)}
                onError={() => {}}
              />
              {partBResult && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 space-y-1">
                  <p><CheckCircle2 className="w-4 h-4 inline mr-1" />Part B recorded: <strong>{formatSecs(partBResult.time)}</strong> | Errors: <strong>{partBResult.errors}</strong></p>
                  <div className="flex items-center gap-3 mt-2">
                    <Label className="text-xs">Additional errors to add:</Label>
                    <button onClick={() => setPartBErrors(e => Math.max(0, e - 1))} className="w-7 h-7 rounded border bg-white font-bold">−</button>
                    <span className="font-bold w-6 text-center">{partBErrors}</span>
                    <button onClick={() => setPartBErrors(e => e + 1)} className="w-7 h-7 rounded border bg-white font-bold">+</button>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1">← Back</Button>
                <Button onClick={() => setStep(5)} disabled={!partBResult} className="flex-1 bg-indigo-600 hover:bg-indigo-700">Observations →</Button>
              </div>
            </div>
          )}

          {/* ── STEP 5: OBSERVATIONS ─────────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm text-indigo-800">
                <Flag className="w-4 h-4 inline mr-1" /><strong>Behavioural Observations</strong> — Record what was observed.
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "hesitation", label: "Hesitation / slow initiation" },
                  { key: "confusion", label: "Confusion during alternating sequence" },
                  { key: "perseveration", label: "Perseverative errors" },
                  { key: "tremor", label: "Tremor noted" },
                  { key: "fatigue", label: "Cognitive fatigue during test" },
                  { key: "frustration", label: "Frustration / emotional distress" },
                  { key: "verbalStrategy", label: "Used verbal strategy" },
                  { key: "impulsivity", label: "Impulsive responding" },
                ].map(item => (
                  <div key={item.key} className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border">
                    <Checkbox checked={!!observations[item.key]} onCheckedChange={v => setObservations(p => ({ ...p, [item.key]: !!v }))} className="mt-0.5" />
                    <Label className="text-sm">{item.label}</Label>
                  </div>
                ))}
              </div>
              <div>
                <Label className="text-sm font-medium">Observation Notes</Label>
                <Textarea value={observations.notes} onChange={e => setObservations(p => ({ ...p, notes: e.target.value }))} placeholder="Strategy used, body language, verbalisations, distractibility..." rows={3} className="mt-1" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(4)} className="flex-1">← Back</Button>
                <Button onClick={() => setStep(6)} className="flex-1 bg-indigo-600 hover:bg-indigo-700">View Results →</Button>
              </div>
            </div>
          )}

          {/* ── STEP 6: RESULTS ──────────────────────────────────────────── */}
          {step === 6 && (
            <div className="space-y-4">

              {/* Score cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`border-2 rounded-xl p-4 text-center ${clsA?.color || "bg-indigo-50 border-indigo-200"}`}>
                  <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">Part A</p>
                  <p className="text-3xl font-mono font-bold">{formatSecs(timeA)}</p>
                  {errorsA > 0 && <p className="text-xs text-red-600">{errorsA} errors</p>}
                  {clsA && <p className="font-semibold text-xs mt-1">{clsA.label}</p>}
                  {pctA != null && <p className="text-xs opacity-70">~{pctA}th percentile</p>}
                </div>
                <div className={`border-2 rounded-xl p-4 text-center ${clsB?.color || "bg-orange-50 border-orange-200"}`}>
                  <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">Part B</p>
                  <p className="text-3xl font-mono font-bold">{formatSecs(timeB)}</p>
                  {errorsB > 0 && <p className="text-xs text-red-600">{errorsB} errors</p>}
                  {clsB && <p className="font-semibold text-xs mt-1">{clsB.label}</p>}
                  {pctB != null && <p className="text-xs opacity-70">~{pctB}th percentile</p>}
                </div>
              </div>

              {/* B/A Ratio */}
              {baRatio !== null && (
                <div className={`border-2 rounded-xl p-4 text-center ${baRatio > 3.0 ? "bg-red-50 border-red-300 text-red-800" : baRatio > 2.5 ? "bg-yellow-50 border-yellow-300 text-yellow-800" : "bg-green-50 border-green-300 text-green-800"}`}>
                  <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">B/A Ratio (Executive Index)</p>
                  <p className="text-4xl font-bold">{baRatio}</p>
                  <p className="text-sm font-semibold mt-1">{baRatio > 3.0 ? "⚠ Executive Dysfunction" : baRatio > 2.5 ? "Borderline" : "Within Expected Range"}</p>
                  <p className="text-xs opacity-70 mt-1">B − A = {bMinusA}s | Normal B/A &lt; 3.0</p>
                </div>
              )}

              {/* Normative Table */}
              {age && (
                <Section title={`Normative Comparison — Age ${age} (Tombaugh 2004)`} icon={Activity} defaultOpen accent="blue">
                  <div className="space-y-2 text-xs">
                    <p className="text-slate-500 mb-2">Comparison against age-matched normative data (mean ± SD, Tombaugh 2004)</p>
                    {[
                      { label: "Part A", time: timeA, norm: normA, z: zA, cls: clsA, pct: pctA },
                      { label: "Part B", time: timeB, norm: normB, z: zB, cls: clsB, pct: pctB },
                    ].map(row => row.norm && (
                      <div key={row.label} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-slate-700">{row.label}</span>
                          {row.cls && <Badge className={`text-xs ${row.cls.color}`}>{row.cls.label}</Badge>}
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-slate-600">
                          <div><span className="text-slate-400">Score</span><br /><strong>{formatSecs(row.time)}</strong></div>
                          <div><span className="text-slate-400">Mean</span><br />{row.norm.mean}s</div>
                          <div><span className="text-slate-400">SD</span><br />±{row.norm.sd}s</div>
                          <div><span className="text-slate-400">Z / %ile</span><br />{row.z} / ~{row.pct}th</div>
                        </div>
                        {row.time && (
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden mt-2">
                            <div className={`h-full rounded-full ${row.z > 1.5 ? "bg-red-500" : row.z > 0.5 ? "bg-yellow-400" : "bg-green-500"}`}
                              style={{ width: `${Math.min(100, Math.max(5, (row.norm.mean / row.time) * 100))}%` }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Interpretation */}
              <Section title="Clinical Interpretation" icon={Brain} defaultOpen accent="indigo">
                <p className="text-sm text-slate-700 leading-relaxed">{generateInterpretation() || "Complete both parts to generate interpretation."}</p>
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

              {/* SOAP */}
              <Section title="SOAP Note Preview" icon={FileText} accent="green">
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 rounded-lg p-3 border">{generateSoap() || "Complete both parts to generate SOAP."}</pre>
              </Section>

              {/* References */}
              <Section title="Evidence-Based References" icon={BookOpen} accent="slate">
                <div className="space-y-2 text-xs text-slate-600">
                  {[
                    { n: 1, t: "Reitan RM.", s: "Trail Making Test: Manual for Administration and Scoring. Reitan Neuropsychology Laboratory; 1958, 1992." },
                    { n: 2, t: "Tombaugh TN.", s: "Trail Making Test A and B: Normative data stratified by age and education. Archives of Clinical Neuropsychology. 2004;19(2):203–214." },
                    { n: 3, t: "Lezak MD, Howieson DB, Bigler ED, Tranel D.", s: "Neuropsychological Assessment. 5th ed. Oxford University Press; 2012." },
                    { n: 4, t: "Strauss E, Sherman EMS, Spreen O.", s: "A Compendium of Neuropsychological Tests: Administration, Norms, and Commentary. 3rd ed. Oxford University Press; 2006." },
                    { n: 5, t: "Bowie CR, Harvey PD.", s: "Administration and interpretation of the Trail Making Test. Nature Protocols. 2006;1(5):2277–2281." },
                  ].map(r => (
                    <div key={r.n} className="p-2 bg-slate-50 rounded border border-slate-200">
                      <p><span className="font-semibold">{r.n}.</span> {r.t} <em>{r.s}</em></p>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Clinical Notes */}
              <div>
                <Label className="text-sm font-semibold">Clinical Notes</Label>
                <Textarea value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)} placeholder="Hesitation, confusion, tremor, strategy used, mood, neurological context..." rows={3} className="mt-1" />
              </div>

              {!canSave && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />Complete both TMT parts before saving.
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(5)} className="flex-1">← Back</Button>
                <Button onClick={handleSave} disabled={!canSave} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
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
            {timeA && <span className="text-green-600 font-medium">A: {formatSecs(timeA)}</span>}
            {timeB && <span className="text-orange-600 font-medium">B: {formatSecs(timeB)}</span>}
            {baRatio && <span className={`font-medium ${baRatio > 3 ? "text-red-600" : "text-slate-500"}`}>B/A: {baRatio}</span>}
          </div>
          {step === 6 && (
            <Button onClick={handleSave} disabled={!canSave} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
              <Save className="w-3 h-3 mr-1" />Save
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}