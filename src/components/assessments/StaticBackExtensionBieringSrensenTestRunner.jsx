import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Save, X, Play, Square, RotateCcw, Info, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Clock, Activity, BookOpen, Camera, Flag, FileText
} from "lucide-react";
import { toast } from "sonner";
import BieringSorensenDiagrams from "./BieringSorensenDiagrams";
import { todayLocal } from "@/lib/localDate";

// ─── Normative Data (Biering-Sørensen 1984 + subsequent studies) ───────────────
const NORMS = {
  male: [
    { ageMin: 20, ageMax: 29, mean: 201, sd: 58, source: "Biering-Sørensen 1984 / Demoulin 2006" },
    { ageMin: 30, ageMax: 39, mean: 189, sd: 53, source: "Biering-Sørensen 1984 / Demoulin 2006" },
    { ageMin: 40, ageMax: 49, mean: 175, sd: 52, source: "Biering-Sørensen 1984 / Demoulin 2006" },
    { ageMin: 50, ageMax: 59, mean: 164, sd: 56, source: "Biering-Sørensen 1984 / Demoulin 2006" },
    { ageMin: 60, ageMax: 79, mean: 140, sd: 51, source: "Biering-Sørensen 1984 / Demoulin 2006" },
  ],
  female: [
    { ageMin: 20, ageMax: 29, mean: 189, sd: 60, source: "Biering-Sørensen 1984 / Demoulin 2006" },
    { ageMin: 30, ageMax: 39, mean: 165, sd: 56, source: "Biering-Sørensen 1984 / Demoulin 2006" },
    { ageMin: 40, ageMax: 49, mean: 152, sd: 58, source: "Biering-Sørensen 1984 / Demoulin 2006" },
    { ageMin: 50, ageMax: 59, mean: 148, sd: 60, source: "Biering-Sørensen 1984 / Demoulin 2006" },
    { ageMin: 60, ageMax: 79, mean: 131, sd: 53, source: "Biering-Sørensen 1984 / Demoulin 2006" },
  ],
};

function getNormativeRow(age, gender) {
  const rows = NORMS[gender === "male" ? "male" : "female"];
  if (!rows || !age) return null;
  return rows.find(r => age >= r.ageMin && age <= r.ageMax) || null;
}

function classifyResult(seconds, age, gender) {
  const row = getNormativeRow(age, gender);
  if (!row) return null;
  const z = (seconds - row.mean) / row.sd;
  if (z >= 1.0) return { label: "Excellent", sublabel: "> +1 SD above mean", color: "bg-green-100 text-green-800 border-green-300", z };
  if (z >= 0.0) return { label: "Above Average", sublabel: "Mean to +1 SD", color: "bg-teal-100 text-teal-800 border-teal-300", z };
  if (z >= -1.0) return { label: "Below Average", sublabel: "Mean to −1 SD", color: "bg-yellow-100 text-yellow-800 border-yellow-300", z };
  return { label: "Low Endurance", sublabel: "< −1 SD below mean", color: "bg-red-100 text-red-800 border-red-300", z };
}

function formatTime(s) {
  if (!s && s !== 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatTimeLabel(s) {
  if (!s && s !== 0) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  if (m > 0) return `${m}m ${sec}s`;
  return `${Math.floor(s)}s`;
}

// ─── Collapsible Section ────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = false, accent = "blue" }) {
  const [open, setOpen] = useState(defaultOpen);
  const accentMap = {
    blue: "border-blue-200 bg-blue-50",
    amber: "border-amber-200 bg-amber-50",
    green: "border-green-200 bg-green-50",
    red: "border-red-200 bg-red-50",
    slate: "border-slate-200 bg-slate-50",
    purple: "border-purple-200 bg-purple-50",
  };
  return (
    <div className={`border rounded-xl overflow-hidden ${accentMap[accent]}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left font-semibold text-slate-800 hover:bg-white/50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm">
          {Icon && <Icon className="w-4 h-4" />}
          {title}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1 bg-white/70">{children}</div>}
    </div>
  );
}

// ─── Pain Slider ─────────────────────────────────────────────────────────────
function PainSlider({ value, onChange, label }) {
  const color = value <= 3 ? "text-green-600" : value <= 6 ? "text-yellow-600" : "text-red-600";
  return (
    <div>
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      <div className="flex items-center gap-3 mt-1">
        <input
          type="range" min={0} max={10} step={1} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 h-2 rounded-full accent-amber-600"
        />
        <span className={`text-lg font-bold w-6 text-center ${color}`}>{value}</span>
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-0.5">
        <span>No Pain</span><span>Moderate</span><span>Worst</span>
      </div>
    </div>
  );
}

// ─── STOP REASON OPTIONS ─────────────────────────────────────────────────────
const STOP_REASONS = [
  "Fatigue",
  "Pain",
  "Loss of horizontal position",
  ">10° trunk drop",
  "Client requested stop",
  "Safety concern",
  "Reached maximum / test ceiling",
  "Other",
];

// ─── CONTRAINDICATIONS ───────────────────────────────────────────────────────
const CONTRAINDICATIONS = [
  { id: "acute_pain", label: "No acute severe lumbar pain present" },
  { id: "no_surgery", label: "No recent spinal surgery (< 3 months)" },
  { id: "no_fracture", label: "No suspected or confirmed spinal fracture" },
  { id: "no_radicular", label: "No severe radicular symptoms (e.g. cauda equina)" },
  { id: "no_cardio", label: "No uncontrolled cardiovascular symptoms" },
  { id: "prone_safe", label: "Patient can safely lie prone" },
  { id: "consent", label: "Patient consent obtained" },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function StaticBackExtensionBieringSrensenTestRunner({ client, onSave, onClose }) {
  const [step, setStep] = useState(0); // 0=overview 1=safety 2=setup 3=test 4=technique 5=pain 6=results

  // Safety
  const [safetyChecks, setSafetyChecks] = useState({});
  const [safetyConcerns, setSafetyConcerns] = useState([]);

  // Setup
  const [setupData, setSetupData] = useState({
    equipment: "",
    securing: "straps",
    armsPosition: "crossed",
    testModified: false,
    modificationNote: "",
    baselinePain: 0,
  });

  // Timer
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finalTime, setFinalTime] = useState(null);
  const [stopReason, setStopReason] = useState("");
  const [otherStopReason, setOtherStopReason] = useState("");
  const [reachedMaxDuration, setReachedMaxDuration] = useState(false);
  const startRef = useRef(null);
  const intervalRef = useRef(null);

  // Technique
  const [technique, setTechnique] = useState({
    maintainedHorizontal: null,
    excessiveLumbarExtension: null,
    hipPelvicRotation: null,
    shoulderCompensation: null,
    breathHolding: null,
    requiredVerbalCueing: null,
    qualityRating: "",
  });

  // Pain / Symptoms
  const [symptoms, setSymptoms] = useState({
    painDuring: 0,
    painLocations: [],
    symptomsIncreased: null,
    neurologicalSymptoms: null,
    postTestPain: 0,
    rpeAfter: 0,
  });

  // Notes
  const [clinicalNotes, setClinicalNotes] = useState("");

  useEffect(() => () => clearInterval(intervalRef.current), []);

  // Client info
  const age = client?.date_of_birth
    ? Math.floor((Date.now() - new Date(client.date_of_birth)) / (365.25 * 24 * 3600 * 1000))
    : null;
  const normRow = finalTime && age && client?.gender ? getNormativeRow(age, client.gender) : null;
  const classification = finalTime && age && client?.gender ? classifyResult(finalTime, age, client.gender) : null;

  // ── Timer Logic ──────────────────────────────────────────────────────────────
  const startTimer = () => {
    setElapsed(0);
    setFinalTime(null);
    setStopReason("");
    setReachedMaxDuration(false);
    setIsRunning(true);
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 100);
  };

  const stopTimer = () => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    const t = parseFloat(((Date.now() - startRef.current) / 1000).toFixed(1));
    setFinalTime(t);
  };

  const resetTimer = () => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    setElapsed(0);
    setFinalTime(null);
    setStopReason("");
  };

  // ── Safety check helpers ────────────────────────────────────────────────────
  const allSafetyChecked = CONTRAINDICATIONS.every(c => safetyChecks[c.id]);

  // ── Auto-generated interpretation ──────────────────────────────────────────
  const generateInterpretation = () => {
    if (!finalTime) return "";
    const timeLabel = formatTimeLabel(finalTime);
    const stoppedBy = stopReason === "Other" ? (otherStopReason || "unspecified reason") : (stopReason || "unspecified reason");
    const classLabel = classification ? ` — classified as ${classification.label}` : "";
    const normText = normRow ? ` compared to an age/sex normative mean of ${normRow.mean}s (±${normRow.sd}s)` : "";
    const qualText = technique.qualityRating ? ` Technique quality was rated as ${technique.qualityRating.toLowerCase()}.` : "";
    const painText = symptoms.painDuring > 0
      ? ` Lumbar pain of ${symptoms.painDuring}/10 was reported during the test${symptoms.symptomsIncreased ? ", with symptoms increasing from baseline" : ""}.`
      : " No significant pain was reported during the test.";
    const neuroText = symptoms.neurologicalSymptoms ? " Neurological symptoms were noted and require clinical attention." : "";
    const modText = setupData.testModified ? " Note: Test was performed in a modified position; interpret results with caution." : "";
    const flagText = finalTime < 60
      ? " Hold time below 60 seconds may indicate significant impairment in lumbar extensor endurance."
      : finalTime < (normRow?.mean ?? 160)
      ? " Hold time is below the normative mean for this age and sex group, suggesting reduced lumbar extensor endurance."
      : " Hold time is within or above the normative range for this age and sex group.";

    return `Biering-Sørensen Back Extension Test completed with a hold time of ${timeLabel} (${finalTime}s)${classLabel}${normText}. Test was stopped due to ${stoppedBy}.${qualText}${painText}${neuroText}${flagText}${modText} Findings may inform progressive trunk endurance rehabilitation and should be interpreted alongside clinical presentation and functional goals.`;
  };

  // ── Clinical flags ──────────────────────────────────────────────────────────
  const generateFlags = () => {
    const flags = [];
    if (!finalTime) return flags;
    if (finalTime < 60) flags.push({ label: "Very low lumbar extensor endurance", severity: "high" });
    else if (classification?.label === "Low Endurance") flags.push({ label: "Reduced lumbar extensor endurance", severity: "medium" });
    if (stopReason === "Pain" || symptoms.painDuring >= 4) flags.push({ label: "Pain-limited performance", severity: "medium" });
    if (symptoms.neurologicalSymptoms) flags.push({ label: "Neurological symptoms noted — review urgently", severity: "high" });
    if (technique.qualityRating === "Poor" || technique.excessiveLumbarExtension) flags.push({ label: "Technique limitations — reduced test validity", severity: "medium" });
    if (setupData.testModified) flags.push({ label: "Modified test — interpret with caution", severity: "low" });
    if (symptoms.symptomsIncreased) flags.push({ label: "Symptoms increased during testing", severity: "medium" });
    if (finalTime > 0) flags.push({ label: "Consider progressive trunk endurance training", severity: "info" });
    if (finalTime > 0) flags.push({ label: "Reassess after 6–8 week training block", severity: "info" });
    return flags;
  };

  // ── SOAP text ───────────────────────────────────────────────────────────────
  const generateSoapText = () => {
    if (!finalTime) return "";
    const timeLabel = formatTimeLabel(finalTime);
    const stopLabel = stopReason === "Other" ? (otherStopReason || "Other") : (stopReason || "Not recorded");
    const techSummary = technique.qualityRating ? `Technique: ${technique.qualityRating}` : "";
    const painSummary = symptoms.painDuring > 0 ? `Pain during: ${symptoms.painDuring}/10` : "No pain during test";
    const neuro = symptoms.neurologicalSymptoms ? " Neurological symptoms reported." : "";
    const classLabel = classification ? ` (${classification.label})` : "";
    const norm = normRow ? ` Normative mean (${client?.gender}, ${age}yo): ${normRow.mean}s.` : "";

    let soap = `• Biering-Sørensen Back Extension Test\n`;
    soap += `  Hold Time: ${finalTime}s (${timeLabel})${classLabel}${norm}\n`;
    soap += `  Stopped due to: ${stopLabel}\n`;
    if (techSummary) soap += `  ${techSummary}. `;
    soap += `${painSummary}.${neuro}\n`;
    if (setupData.testModified) soap += `  Modified test — interpret with caution.\n`;
    if (clinicalNotes) soap += `  Clinical Notes: ${clinicalNotes}\n`;
    soap += `  Interpretation: ${generateInterpretation()}`;
    return soap;
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  const canSave = () => {
    if (!finalTime) return false;
    if (!stopReason) return false;
    if (symptoms.postTestPain === undefined || symptoms.postTestPain === null) return false;
    if (!technique.qualityRating) return false;
    return true;
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!canSave()) {
      toast.error("Complete all required fields: hold time, stop reason, pain score, and technique quality.");
      return;
    }
    const soap = generateSoapText();
    onSave({
      status: "completed",
      result_value: finalTime,
      notes: clinicalNotes,
      assessment_date: todayLocal(),
      additional_data: {
        soap_text: soap,
        measurement_type: "endurance_hold",
        hold_time_seconds: finalTime,
        hold_time_formatted: formatTimeLabel(finalTime),
        stop_reason: stopReason === "Other" ? (otherStopReason || "Other") : stopReason,
        reached_max_duration: reachedMaxDuration,
        classification: classification?.label,
        normative_mean: normRow?.mean,
        normative_sd: normRow?.sd,
        setup: setupData,
        technique,
        symptoms,
        flags: generateFlags().map(f => f.label),
        interpretation: generateInterpretation(),
      },
    });
    toast.success("Biering-Sørensen Test saved successfully.");
  };

  const steps = [
    { label: "Overview", icon: Info },
    { label: "Safety", icon: AlertTriangle },
    { label: "Setup", icon: Camera },
    { label: "Test", icon: Clock },
    { label: "Technique", icon: Activity },
    { label: "Pain", icon: Flag },
    { label: "Results", icon: FileText },
  ];

  const flagColorMap = { high: "bg-red-100 text-red-800 border-red-200", medium: "bg-yellow-100 text-yellow-800 border-yellow-200", low: "bg-blue-100 text-blue-800 border-blue-200", info: "bg-slate-100 text-slate-700 border-slate-200" };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[98vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b bg-gradient-to-r from-amber-50 to-stone-50 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Biering-Sørensen Back Extension Test</h2>
            <p className="text-xs text-slate-500 mt-0.5">Lumbar extensor endurance • Isometric hold assessment</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Step Nav */}
        <div className="flex overflow-x-auto border-b bg-slate-50 shrink-0 px-2 py-1 gap-1">
          {steps.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                step === i ? "bg-amber-600 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <s.icon className="w-3 h-3" />
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ── STEP 0: OVERVIEW ─────────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2"><Info className="w-4 h-4" />Assessment Overview</h3>
                <p className="text-sm text-amber-800 mb-3">The Biering-Sørensen Test measures isometric endurance of the lumbar and hip extensor musculature. It is a validated clinical tool with strong predictive validity for low back pain onset and recurrence.</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {["Low back pain assessment", "Lumbar extensor endurance", "Trunk endurance testing", "Work conditioning", "Rehabilitation monitoring", "Return-to-work / FCE"].map(u => (
                    <div key={u} className="flex items-center gap-1.5 text-amber-700"><CheckCircle2 className="w-3 h-3 shrink-0" />{u}</div>
                  ))}
                </div>
              </div>

              <Section title="Protocol Summary" icon={BookOpen} defaultOpen accent="slate">
                <div className="space-y-2 text-sm text-slate-700">
                  <div className="flex gap-2"><span className="font-semibold min-w-24 text-slate-900">Position:</span><span>Patient prone on bench/plinth. ASIS/iliac crest at the bench edge. Lower body fixed.</span></div>
                  <div className="flex gap-2"><span className="font-semibold min-w-24 text-slate-900">Task:</span><span>Maintain upper body horizontal with arms crossed. Hold as long as safely possible.</span></div>
                  <div className="flex gap-2"><span className="font-semibold min-w-24 text-slate-900">Start:</span><span>Timer begins once horizontal position is achieved and stable.</span></div>
                  <div className="flex gap-2"><span className="font-semibold min-w-24 text-slate-900">Stop:</span><span>Patient request, pain, neurological symptoms, or &gt;10° trunk drop.</span></div>
                  <div className="flex gap-2"><span className="font-semibold min-w-24 text-slate-900">Score:</span><span>Total hold time in seconds. Compare to age/sex normative data.</span></div>
                </div>
              </Section>

              <Section title="Instructional Diagrams" icon={Camera} accent="slate">
                <BieringSorensenDiagrams />
                <div className="mt-4 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">Video Reference</p>
                    <p className="text-xs text-slate-500">Biering-Sørensen Test — setup &amp; administration demonstration</p>
                  </div>
                  <a
                    href="https://www.youtube.com/watch?v=pLnSRlop4vk&t=250s"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Watch →
                  </a>
                </div>
              </Section>

              <Button onClick={() => setStep(1)} className="w-full bg-amber-600 hover:bg-amber-700">
                Begin Assessment →
              </Button>
            </div>
          )}

          {/* ── STEP 1: SAFETY ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="font-bold text-red-800 mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Safety Screening</h3>
                <p className="text-sm text-red-700">Confirm ALL items below before proceeding. If any concern is present, use clinical judgment before administering the test.</p>
              </div>

              <div className="space-y-3">
                {CONTRAINDICATIONS.map(c => (
                  <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border bg-slate-50 hover:bg-white transition-colors">
                    <Checkbox
                      checked={!!safetyChecks[c.id]}
                      onCheckedChange={v => setSafetyChecks(prev => ({ ...prev, [c.id]: !!v }))}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-slate-700">{c.label}</span>
                  </div>
                ))}
              </div>

              {safetyConcerns.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  <strong>Clinical Caution:</strong> Use clinical judgment. Consider modifying or deferring the test based on the patient's presentation.
                </div>
              )}

              {!allSafetyChecked && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Confirm all safety items above. If you have concerns, document them in the clinical notes before proceeding.
                </div>
              )}

              {allSafetyChecked && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />All safety criteria confirmed. Safe to proceed.
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1">â† Back</Button>
                <Button onClick={() => setStep(2)} className="flex-1 bg-amber-600 hover:bg-amber-700">
                  {allSafetyChecked ? "Proceed to Setup →" : "Override & Continue →"}
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 2: SETUP ──────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
                <h3 className="font-semibold mb-2 flex items-center gap-2"><Camera className="w-4 h-4" />Equipment & Position Setup</h3>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>Patient lies prone on bench/plinth.</li>
                  <li>Align ASIS/iliac crest exactly with bench edge.</li>
                  <li>Secure lower body — thighs, pelvis and calves.</li>
                  <li>Instruct arms crossed over chest.</li>
                  <li>Patient holds trunk horizontal. Support initially then release.</li>
                  <li>Confirm stable horizontal position before starting timer.</li>
                </ol>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Equipment Used</Label>
                  <input
                    value={setupData.equipment}
                    onChange={e => setSetupData(p => ({ ...p, equipment: e.target.value }))}
                    placeholder="e.g. Plinth, gym bench, treatment table"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium">Lower Body Secured By</Label>
                  <select
                    value={setupData.securing}
                    onChange={e => setSetupData(p => ({ ...p, securing: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="straps">Straps</option>
                    <option value="clinician">Clinician stabilisation</option>
                    <option value="both">Straps + Clinician</option>
                    <option value="none">Not secured</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <Label className="text-sm font-medium">Arms Position</Label>
                  <select
                    value={setupData.armsPosition}
                    onChange={e => setSetupData(p => ({ ...p, armsPosition: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="crossed">Crossed over chest (standard)</option>
                    <option value="sides">Hands by sides</option>
                    <option value="modified">Modified position</option>
                  </select>
                </div>

                <div>
                  <Label className="text-sm font-medium">Test Modified?</Label>
                  <div className="flex gap-2 mt-1">
                    {["No", "Yes"].map(v => (
                      <button
                        key={v}
                        onClick={() => setSetupData(p => ({ ...p, testModified: v === "Yes" }))}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          (v === "Yes") === setupData.testModified
                            ? "bg-amber-600 text-white border-amber-600"
                            : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                        }`}
                      >{v}</button>
                    ))}
                  </div>
                </div>
              </div>

              {setupData.testModified && (
                <div>
                  <Label className="text-sm font-medium">Modification Details</Label>
                  <input
                    value={setupData.modificationNote}
                    onChange={e => setSetupData(p => ({ ...p, modificationNote: e.target.value }))}
                    placeholder="Describe modification..."
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              )}

              <PainSlider value={setupData.baselinePain} onChange={v => setSetupData(p => ({ ...p, baselinePain: v }))} label="Baseline Pain Score (before test)" />

              {/* Clinician Script */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h4 className="font-semibold text-green-800 text-sm mb-2">📋 Clinician Script</h4>
                <p className="text-sm text-green-800 italic">
                  "Hold your upper body level with the bench for as long as you safely can. Keep your arms crossed over your chest. Tell me immediately if you feel sharp pain, dizziness, numbness, or need to stop for any reason."
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">â† Back</Button>
                <Button onClick={() => setStep(3)} className="flex-1 bg-amber-600 hover:bg-amber-700">Start Test →</Button>
              </div>
            </div>
          )}

          {/* ── STEP 3: TEST RUNNER ─────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Sticky timer */}
              <div className={`rounded-2xl p-6 text-center border-2 transition-colors ${isRunning ? "bg-amber-50 border-amber-400" : finalTime ? "bg-green-50 border-green-400" : "bg-slate-50 border-slate-200"}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  {isRunning ? "▶ TEST IN PROGRESS — HOLD POSITION" : finalTime ? "✓ Test Complete" : "Ready to Start"}
                </p>
                <p className={`text-7xl font-mono font-bold ${isRunning ? "text-amber-700" : finalTime ? "text-green-700" : "text-slate-400"}`}>
                  {isRunning ? formatTime(elapsed) : finalTime ? formatTime(finalTime) : "0:00"}
                </p>
                {(isRunning || finalTime) && (
                  <p className="text-sm text-slate-500 mt-1">
                    {isRunning ? `${Math.floor(elapsed)}s elapsed` : `${finalTime}s total`}
                  </p>
                )}

                <div className="mt-4 flex justify-center gap-3">
                  {!isRunning && !finalTime && (
                    <Button onClick={startTimer} size="lg" className="bg-amber-600 hover:bg-amber-700 px-8">
                      <Play className="w-5 h-5 mr-2" /> Start Test
                    </Button>
                  )}
                  {isRunning && (
                    <Button onClick={stopTimer} size="lg" variant="destructive" className="px-8">
                      <Square className="w-5 h-5 mr-2" /> Stop Test
                    </Button>
                  )}
                  {finalTime && !isRunning && (
                    <Button onClick={resetTimer} variant="outline" size="sm">
                      <RotateCcw className="w-4 h-4 mr-1" /> Retest
                    </Button>
                  )}
                </div>
              </div>

              {/* Stop reason */}
              <div>
                <Label className="text-sm font-semibold text-slate-700">Reason Test Stopped *</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {STOP_REASONS.map(r => (
                    <button
                      key={r}
                      onClick={() => setStopReason(r)}
                      className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                        stopReason === r
                          ? "bg-amber-600 text-white border-amber-600"
                          : "bg-white text-slate-600 border-slate-300 hover:bg-amber-50"
                      }`}
                    >{r}</button>
                  ))}
                </div>
                {stopReason === "Other" && (
                  <input
                    value={otherStopReason}
                    onChange={e => setOtherStopReason(e.target.value)}
                    placeholder="Describe stop reason..."
                    className="mt-2 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                )}
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                <Checkbox
                  checked={reachedMaxDuration}
                  onCheckedChange={v => setReachedMaxDuration(!!v)}
                />
                <Label className="text-sm">Patient reached maximum test duration / ceiling</Label>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">â† Back</Button>
                <Button onClick={() => setStep(4)} disabled={!finalTime} className="flex-1 bg-amber-600 hover:bg-amber-700">
                  Continue → Technique
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 4: TECHNIQUE ──────────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm text-purple-800">
                <Activity className="w-4 h-4 inline mr-1" />
                <strong>Technique Quality Assessment</strong> — Rate what was observed during the test.
              </div>

              {[
                { key: "maintainedHorizontal", label: "Maintained horizontal trunk position", good: true },
                { key: "excessiveLumbarExtension", label: "Excessive lumbar extension observed", good: false },
                { key: "hipPelvicRotation", label: "Hip/pelvic rotation observed", good: false },
                { key: "shoulderCompensation", label: "Shoulder compensation observed", good: false },
                { key: "breathHolding", label: "Breath holding observed", good: false },
                { key: "requiredVerbalCueing", label: "Required verbal cueing during test", good: false },
              ].map(item => (
                <div key={item.key} className="p-3 bg-slate-50 rounded-lg border">
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">{item.label}</Label>
                  <div className="flex gap-2">
                    {["Yes", "No"].map(v => (
                      <button
                        key={v}
                        onClick={() => setTechnique(p => ({ ...p, [item.key]: v === "Yes" }))}
                        className={`flex-1 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                          technique[item.key] === (v === "Yes")
                            ? `${(v === "Yes") === item.good ? "bg-green-600" : "bg-amber-600"} text-white border-transparent`
                            : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                        }`}
                      >{v}</button>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <Label className="text-sm font-semibold text-slate-700">Overall Technique Quality Rating *</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {["Poor", "Fair", "Good", "Excellent"].map(q => (
                    <button
                      key={q}
                      onClick={() => setTechnique(p => ({ ...p, qualityRating: q }))}
                      className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                        technique.qualityRating === q
                          ? q === "Poor" ? "bg-red-600 text-white" : q === "Fair" ? "bg-yellow-500 text-white" : q === "Good" ? "bg-teal-600 text-white" : "bg-green-600 text-white"
                          : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                      }`}
                    >{q}</button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1">â† Back</Button>
                <Button onClick={() => setStep(5)} disabled={!technique.qualityRating} className="flex-1 bg-amber-600 hover:bg-amber-700">
                  Continue → Pain/Symptoms
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 5: PAIN / SYMPTOMS ────────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
                <Flag className="w-4 h-4 inline mr-1" />
                <strong>Pain & Symptom Response</strong> — Record patient-reported symptoms during and after the test.
              </div>

              <PainSlider value={symptoms.painDuring} onChange={v => setSymptoms(p => ({ ...p, painDuring: v }))} label="Pain During Test (0–10)" />

              <div>
                <Label className="text-sm font-medium text-slate-700">Pain Location (select all that apply)</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {["Lumbar", "Thoracic", "Gluteal", "Hamstring", "Radicular leg symptoms", "Other"].map(loc => (
                    <button
                      key={loc}
                      onClick={() => setSymptoms(p => ({
                        ...p,
                        painLocations: p.painLocations.includes(loc)
                          ? p.painLocations.filter(l => l !== loc)
                          : [...p.painLocations, loc],
                      }))}
                      className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                        symptoms.painLocations.includes(loc)
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-white text-slate-600 border-slate-300 hover:bg-red-50"
                      }`}
                    >{loc}</button>
                  ))}
                </div>
              </div>

              {[
                { key: "symptomsIncreased", label: "Symptoms increased from baseline during test" },
                { key: "neurologicalSymptoms", label: "Neurological symptoms reported (tingling, numbness, weakness)" },
              ].map(item => (
                <div key={item.key} className="p-3 bg-slate-50 rounded-lg border">
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">{item.label}</Label>
                  <div className="flex gap-2">
                    {["Yes", "No"].map(v => (
                      <button
                        key={v}
                        onClick={() => setSymptoms(p => ({ ...p, [item.key]: v === "Yes" }))}
                        className={`flex-1 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                          symptoms[item.key] === (v === "Yes")
                            ? v === "Yes" ? "bg-red-600 text-white" : "bg-green-600 text-white"
                            : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                        }`}
                      >{v}</button>
                    ))}
                  </div>
                </div>
              ))}

              {symptoms.neurologicalSymptoms && (
                <div className="bg-red-100 border border-red-300 rounded-lg p-3 text-sm text-red-800 font-medium">
                  ⚠ Neurological symptoms reported. Document clearly and consider urgent review.
                </div>
              )}

              <PainSlider value={symptoms.postTestPain} onChange={v => setSymptoms(p => ({ ...p, postTestPain: v }))} label="Post-Test Pain Score (0–10)" />
              <PainSlider value={symptoms.rpeAfter} onChange={v => setSymptoms(p => ({ ...p, rpeAfter: v }))} label="Perceived Exertion After Test — RPE (0–10)" />

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(4)} className="flex-1">â† Back</Button>
                <Button onClick={() => setStep(6)} className="flex-1 bg-amber-600 hover:bg-amber-700">
                  View Results →
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 6: RESULTS ────────────────────────────────────────────── */}
          {step === 6 && (
            <div className="space-y-4">

              {/* Result Summary */}
              {finalTime ? (
                <div className={`border-2 rounded-2xl p-5 text-center ${classification ? classification.color : "bg-slate-50 border-slate-200"}`}>
                  <p className="text-sm font-semibold uppercase tracking-wider opacity-70 mb-1">Hold Time</p>
                  <p className="text-5xl font-mono font-bold">{formatTimeLabel(finalTime)}</p>
                  <p className="text-xl font-semibold mt-1">{finalTime}s</p>
                  {classification && (
                    <Badge className={`mt-2 text-sm ${classification.color}`}>
                      {classification.label} — {classification.sublabel}
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center text-yellow-800 text-sm">
                  No hold time recorded. <button className="underline" onClick={() => setStep(3)}>Go back to run the test.</button>
                </div>
              )}

              {/* Normative comparison */}
              {normRow && finalTime && (
                <Section title="Normative Comparison" icon={Activity} defaultOpen accent="blue">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Normative Mean ({client?.gender}, {age}yo)</span>
                      <span className="font-bold">{normRow.mean}s</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Standard Deviation</span>
                      <span className="font-bold">±{normRow.sd}s</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Patient Result</span>
                      <span className="font-bold">{finalTime}s</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Difference from Mean</span>
                      <span className={`font-bold ${finalTime >= normRow.mean ? "text-green-700" : "text-red-700"}`}>
                        {finalTime >= normRow.mean ? "+" : ""}{(finalTime - normRow.mean).toFixed(0)}s
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Source: {normRow.source}</p>
                    {/* Visual bar */}
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Low ({normRow.mean - normRow.sd}s)</span>
                        <span>Mean ({normRow.mean}s)</span>
                        <span>High ({normRow.mean + normRow.sd}s)</span>
                      </div>
                      <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${classification?.label === "Excellent" ? "bg-green-500" : classification?.label === "Above Average" ? "bg-teal-500" : classification?.label === "Below Average" ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(100, Math.max(5, (finalTime / (normRow.mean + normRow.sd * 2)) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Section>
              )}

              {/* Interpretation */}
              <Section title="Clinical Interpretation" icon={FileText} defaultOpen accent="amber">
                <p className="text-sm text-slate-700 leading-relaxed">{generateInterpretation()}</p>
              </Section>

              {/* Clinical Flags */}
              {generateFlags().length > 0 && (
                <Section title="Clinical Flags" icon={Flag} defaultOpen accent="red">
                  <div className="space-y-2">
                    {generateFlags().map((f, i) => (
                      <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${flagColorMap[f.severity]}`}>
                        <Flag className="w-3 h-3 shrink-0" /> {f.label}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* SOAP Preview */}
              <Section title="SOAP Note Preview" icon={FileText} accent="green">
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 rounded-lg p-3 border">
                  {generateSoapText() || "Run the test to generate SOAP output."}
                </pre>
              </Section>

              {/* References */}
              <Section title="Evidence-Based References" icon={BookOpen} accent="slate">
                <div className="space-y-3 text-xs text-slate-600">
                  {[
                    { num: 1, authors: "Biering-Sørensen F.", title: "Physical measurements as risk indicators for low-back trouble over a one-year period.", journal: "Spine. 1984;9(2):106–119." },
                    { num: 2, authors: "Demoulin C, Vanderthommen M, Duysens C, Crielaard JM.", title: "Spinal muscle evaluation using the Sorensen test: a critical appraisal of the literature.", journal: "Joint Bone Spine. 2006;73(1):43–50." },
                    { num: 3, authors: "Latimer J, Maher CG, Refshauge K, Colaco I.", title: "The reliability and validity of the Biering-Sorensen test in asymptomatic subjects and subjects reporting current or previous nonspecific low back pain.", journal: "Spine. 1999." },
                    { num: 4, authors: "Moreau CE, Green BN, Johnson CD, Moreau SR.", title: "Isometric back extension endurance tests: a review of the literature.", journal: "J Manipulative Physiol Ther. 2001." },
                    { num: 5, authors: "McGill SM.", title: "Low Back Disorders: Evidence-Based Prevention and Rehabilitation.", journal: "Human Kinetics." },
                  ].map(r => (
                    <div key={r.num} className="p-2 bg-slate-50 rounded border border-slate-200">
                      <p><span className="font-semibold">{r.num}.</span> {r.authors} <em>"{r.title}"</em> {r.journal}</p>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Clinical Notes */}
              <div>
                <Label className="text-sm font-semibold text-slate-700">Clinical Notes</Label>
                <Textarea
                  value={clinicalNotes}
                  onChange={e => setClinicalNotes(e.target.value)}
                  placeholder="Pain pattern, fatigue profile, patient history, barriers, clinical context..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              {/* Validation summary */}
              {!canSave() && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Complete all required fields before saving: hold time, stop reason, post-test pain, and technique quality.
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(5)} className="flex-1">â† Back</Button>
                <Button onClick={handleSave} disabled={!canSave()} className="flex-1 bg-amber-600 hover:bg-amber-700">
                  <Save className="w-4 h-4 mr-2" /> Save Assessment
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 bg-slate-50 flex justify-between items-center shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-500">Cancel</Button>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {finalTime && <span className="text-green-600 font-medium">✓ {formatTimeLabel(finalTime)} recorded</span>}
            {technique.qualityRating && <span className="text-blue-600 font-medium">✓ Technique rated</span>}
          </div>
          {step === 6 && (
            <Button onClick={handleSave} disabled={!canSave()} size="sm" className="bg-amber-600 hover:bg-amber-700">
              <Save className="w-3 h-3 mr-1" />Save
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}