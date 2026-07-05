import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Save, X, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2,
  Info, ExternalLink, RotateCcw, Activity, Zap, AlertCircle
} from "lucide-react";
import { toast } from "sonner";

// ─── Constants ───────────────────────────────────────────────────────────────

const SAFETY_FLAGS = [
  { id: "acute_injury", label: "Acute lumbar injury (< 72 hours)" },
  { id: "recent_surgery", label: "Recent spinal or hip surgery" },
  { id: "severe_pain_flare", label: "Severe pain flare (> 8/10 at rest)" },
  { id: "fracture_suspicion", label: "Fracture suspicion or osteoporosis risk" },
  { id: "cannot_supine", label: "Unable to lie supine comfortably" },
  { id: "severe_neuro", label: "Severe neurological deficit" },
  { id: "cauda_equina", label: "Cauda equina red flags (bowel/bladder/saddle)" },
];

const SYMPTOM_TYPES = [
  "None", "Hamstring tightness", "Posterior thigh stretch",
  "Sciatic pain", "Burning", "Tingling", "Numbness",
  "Lumbar pain", "Glute pain", "Calf pain"
];

const PAIN_DISTRIBUTION = [
  "Back only", "Buttock", "Posterior thigh", "Below knee", "Foot/toes", "Diffuse"
];

const END_FEELS = [
  "Soft tissue restriction", "Neural tension", "Pain limited", "Guarding"
];

const MODIFIERS = [
  { id: "ankle_df", label: "Ankle dorsiflexion (Bragard test)" },
  { id: "cervical_flex", label: "Cervical flexion" },
  { id: "hip_add_ir", label: "Hip adduction / internal rotation" },
  { id: "contralateral_slr", label: "Contralateral SLR" },
  { id: "slump", label: "Slump confirmation" },
];

const MODIFIER_RESPONSES = ["Symptoms increased", "Symptoms unchanged", "Symptoms decreased"];

const INITIAL_SIDE = {
  onsetAngle: "",
  maxAngle: "",
  symptomTypes: [],
  painSeverity: "",
  painDistribution: [],
  familiarReproduced: "",
  positive: "",
  endFeel: "",
};

// ─── Helper Components ────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, color = "slate" }) {
  const colors = {
    slate: "bg-slate-700",
    blue: "bg-blue-700",
    red: "bg-red-600",
    green: "bg-green-700",
    purple: "bg-purple-700",
    amber: "bg-amber-600",
  };
  return (
    <div className={`${colors[color]} text-white rounded-lg px-4 py-2.5 flex items-center gap-2 font-semibold text-sm`}>
      {Icon && <Icon className="w-4 h-4" />}
      {title}
    </div>
  );
}

function MultiSelect({ options, selected, onChange, columns = 2 }) {
  const toggle = (val) => {
    if (selected.includes(val)) onChange(selected.filter(v => v !== val));
    else onChange([...selected, val]);
  };
  return (
    <div className={`grid grid-cols-${columns} gap-2`}>
      {options.map(opt => (
        <label key={opt} className={`flex items-center gap-2 cursor-pointer text-sm p-2 rounded border transition-colors ${selected.includes(opt) ? "bg-blue-50 border-blue-300 text-blue-800" : "border-slate-200 hover:bg-slate-50"}`}>
          <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)} />
          {opt}
        </label>
      ))}
    </div>
  );
}

function RadioButtons({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${value === opt ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 hover:bg-slate-50 text-slate-700"}`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function YesNoButtons({ value, onChange }) {
  return (
    <div className="flex gap-3">
      {["Yes", "No"].map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`text-sm px-5 py-2 rounded border font-medium transition-colors ${value === opt
            ? opt === "Yes" ? "bg-red-600 text-white border-red-600" : "bg-green-600 text-white border-green-600"
            : "border-slate-300 hover:bg-slate-50 text-slate-700"}`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function LegTestPanel({ side, data, onChange }) {
  const label = side === "left" ? "Left" : "Right";
  const color = side === "left" ? "blue" : "purple";
  const borderColor = side === "left" ? "border-blue-300" : "border-purple-300";
  const headerBg = side === "left" ? "bg-blue-600" : "bg-purple-600";

  const update = (field, val) => onChange({ ...data, [field]: val });

  return (
    <Card className={`border-2 ${borderColor}`}>
      <CardHeader className={`${headerBg} text-white rounded-t-lg py-3 px-4`}>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4" />
          {label} Leg Assessment
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-5">

        {/* Angles */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold text-slate-600 block mb-1">Symptom Onset Angle (°)</Label>
            <Input
              type="number" min="0" max="180"
              value={data.onsetAngle}
              onChange={e => update("onsetAngle", e.target.value)}
              placeholder="e.g. 42"
            />
            <p className="text-xs text-slate-500 mt-1">Leave blank if no symptoms</p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600 block mb-1">Maximum ROM Achieved (°) *</Label>
            <Input
              type="number" min="0" max="180"
              value={data.maxAngle}
              onChange={e => update("maxAngle", e.target.value)}
              placeholder="e.g. 65"
            />
          </div>
        </div>

        {/* Symptom Type */}
        <div>
          <Label className="text-xs font-semibold text-slate-600 block mb-2">Symptom Type (select all that apply)</Label>
          <MultiSelect
            options={SYMPTOM_TYPES}
            selected={data.symptomTypes}
            onChange={val => update("symptomTypes", val)}
            columns={2}
          />
        </div>

        {/* Pain Severity */}
        <div>
          <Label className="text-xs font-semibold text-slate-600 block mb-2">
            Pain Severity at Symptom Onset (0–10) — <span className="font-normal">0 = none, 10 = worst</span>
          </Label>
          <div className="flex items-center gap-3">
            <Input
              type="number" min="0" max="10"
              value={data.painSeverity}
              onChange={e => update("painSeverity", e.target.value)}
              placeholder="0"
              className="w-20"
            />
            {data.painSeverity !== "" && (
              <span className={`text-sm font-semibold ${parseFloat(data.painSeverity) >= 7 ? "text-red-600" : parseFloat(data.painSeverity) >= 4 ? "text-amber-600" : "text-green-600"}`}>
                {parseFloat(data.painSeverity) >= 7 ? "Severe" : parseFloat(data.painSeverity) >= 4 ? "Moderate" : "Mild/None"}
              </span>
            )}
          </div>
        </div>

        {/* Pain Distribution */}
        <div>
          <Label className="text-xs font-semibold text-slate-600 block mb-2">Pain Distribution</Label>
          <MultiSelect
            options={PAIN_DISTRIBUTION}
            selected={data.painDistribution}
            onChange={val => update("painDistribution", val)}
            columns={3}
          />
        </div>

        {/* Familiar Symptoms */}
        <div>
          <Label className="text-xs font-semibold text-slate-600 block mb-2">Familiar symptoms reproduced?</Label>
          <YesNoButtons value={data.familiarReproduced} onChange={val => update("familiarReproduced", val)} />
        </div>

        {/* Positive Test */}
        <div>
          <Label className="text-xs font-semibold text-slate-600 block mb-2">Positive SLR Test?</Label>
          <YesNoButtons value={data.positive} onChange={val => update("positive", val)} />
          <p className="text-xs text-slate-500 mt-1">Positive = familiar radicular symptoms reproduced, especially below knee</p>
        </div>

        {/* End Feel */}
        <div>
          <Label className="text-xs font-semibold text-slate-600 block mb-2">End Feel</Label>
          <RadioButtons options={END_FEELS} value={data.endFeel} onChange={val => update("endFeel", val)} />
        </div>

        {/* Live interpretation chip */}
        {data.maxAngle && (
          <LegInterpChip data={data} />
        )}
      </CardContent>
    </Card>
  );
}

function LegInterpChip({ data }) {
  const angle = parseFloat(data.maxAngle);
  if (isNaN(angle)) return null;
  const belowKnee = data.painDistribution.some(d => ["Below knee", "Foot/toes"].includes(d));
  const neuralSymptoms = data.symptomTypes.some(s => ["Sciatic pain", "Burning", "Tingling", "Numbness"].includes(s));
  const isPositive = data.positive === "Yes" || (angle < 70 && (belowKnee || neuralSymptoms));

  let label, bg, text;
  if (isPositive && angle <= 70) {
    label = `⚠ Positive SLR — Neural tension at ${angle}°`;
    bg = "bg-red-50 border-red-200"; text = "text-red-700";
  } else if (isPositive) {
    label = `⚠ Positive SLR — Symptoms reproduced`;
    bg = "bg-orange-50 border-orange-200"; text = "text-orange-700";
  } else if (angle < 60) {
    label = `Limited ROM at ${angle}° — Hamstring/neural restriction`;
    bg = "bg-amber-50 border-amber-200"; text = "text-amber-700";
  } else if (angle < 80) {
    label = `Mild limitation at ${angle}° — Monitor`;
    bg = "bg-yellow-50 border-yellow-200"; text = "text-yellow-700";
  } else {
    label = `Normal ROM at ${angle}° — Negative SLR`;
    bg = "bg-green-50 border-green-200"; text = "text-green-700";
  }

  return (
    <div className={`${bg} border rounded-lg px-3 py-2`}>
      <p className={`text-sm font-semibold ${text}`}>{label}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StraightLegRaiseSLRRunner({ client, onSave, onClose }) {
  // Safety screen
  const [safetyFlags, setSafetyFlags] = useState([]);
  const [consentObtained, setConsentObtained] = useState(false);
  const [safetyDone, setSafetyDone] = useState(false);

  // Setup
  const [surface, setSurface] = useState("");
  const [shoesOff, setShoesOff] = useState("");
  const [warmupDone, setWarmupDone] = useState("");
  const [baselinePain, setBaselinePain] = useState("");
  const [symptomaticSide, setSymptomaticSide] = useState("");

  // Leg data
  const [left, setLeft] = useState({ ...INITIAL_SIDE });
  const [right, setRight] = useState({ ...INITIAL_SIDE });

  // Modifiers
  const [modifiers, setModifiers] = useState({});

  // Notes
  const [notes, setNotes] = useState("");

  // Section expand states
  const [openSections, setOpenSections] = useState({
    overview: true, setup: true, left: true, right: true, modifiers: false,
    analysis: true, interpretation: true, flags: true, references: false
  });
  const toggleSection = (key) => setOpenSections(s => ({ ...s, [key]: !s[key] }));

  const hasRedFlag = safetyFlags.length > 0;

  // ── Derived Analysis ──────────────────────────────────────────────────────

  const analysis = useMemo(() => {
    const lAngle = parseFloat(left.maxAngle);
    const rAngle = parseFloat(right.maxAngle);
    if (isNaN(lAngle) || isNaN(rAngle)) return null;

    const diff = Math.abs(lAngle - rAngle);
    const lPositive = left.positive === "Yes";
    const rPositive = right.positive === "Yes";
    const lBelowKnee = left.painDistribution.some(d => ["Below knee", "Foot/toes"].includes(d));
    const rBelowKnee = right.painDistribution.some(d => ["Below knee", "Foot/toes"].includes(d));
    const lNeural = left.symptomTypes.some(s => ["Sciatic pain", "Burning", "Tingling", "Numbness"].includes(s));
    const rNeural = right.symptomTypes.some(s => ["Sciatic pain", "Burning", "Tingling", "Numbness"].includes(s));

    // Flags
    const flags = [];
    if (lPositive || rPositive) flags.push("Positive SLR — neural mechanosensitivity present");
    if (lPositive && rPositive) flags.push("Bilateral positive SLR — consider central sensitisation");
    if ((lBelowKnee || lNeural) && lPositive) flags.push("Left-sided lumbar radiculopathy suspected");
    if ((rBelowKnee || rNeural) && rPositive) flags.push("Right-sided lumbar radiculopathy suspected");
    if (lAngle < 70 || rAngle < 70) flags.push("Reduced SLR ROM — neural or hamstring restriction");
    if (diff > 10) flags.push(`Asymmetry > 10° (${diff}°) — unilateral pathology likely`);
    if (!lPositive && !rPositive && (lAngle < 70 || rAngle < 70)) flags.push("Hamstring restriction — no neural reproduction");
    if (lPositive || rPositive) flags.push("Recommend Slump Test for confirmation");
    if ((lBelowKnee || rBelowKnee)) flags.push("Below-knee symptom distribution — neurological screen recommended");

    // Auto-summary text
    const lDesc = `Left SLR: ${lPositive ? "POSITIVE" : "negative"} — max ROM ${lAngle}°${left.onsetAngle ? `, onset at ${left.onsetAngle}°` : ""}. ${left.symptomTypes.filter(s => s !== "None").join(", ") || "No symptoms"}. Distribution: ${left.painDistribution.join(", ") || "none"}.`;
    const rDesc = `Right SLR: ${rPositive ? "POSITIVE" : "negative"} — max ROM ${rAngle}°${right.onsetAngle ? `, onset at ${right.onsetAngle}°` : ""}. ${right.symptomTypes.filter(s => s !== "None").join(", ") || "No symptoms"}. Distribution: ${right.painDistribution.join(", ") || "none"}.`;

    // Interpretation paragraph
    let interp = "";
    if (lPositive && !rPositive) {
      interp = `Positive left-sided SLR${left.onsetAngle ? ` with symptom onset at ${left.onsetAngle}°` : ""}. ${lBelowKnee ? "Familiar symptoms reproduced into posterior thigh and below knee, consistent with sciatic nerve mechanosensitivity and possible lumbar nerve root irritation (L4–S1)." : "Symptoms reproduced in posterior thigh without below-knee radiation."} Right SLR negative to ${rAngle}°. Findings suggest unilateral left-sided neural tension.`;
    } else if (rPositive && !lPositive) {
      interp = `Positive right-sided SLR${right.onsetAngle ? ` with symptom onset at ${right.onsetAngle}°` : ""}. ${rBelowKnee ? "Familiar symptoms reproduced into posterior thigh and below knee, consistent with sciatic nerve mechanosensitivity and possible lumbar nerve root irritation (L4–S1)." : "Symptoms reproduced in posterior thigh without below-knee radiation."} Left SLR negative to ${lAngle}°. Findings suggest unilateral right-sided neural tension.`;
    } else if (lPositive && rPositive) {
      interp = `Bilateral positive SLR findings. Left onset ${left.onsetAngle || "N/A"}°, right onset ${right.onsetAngle || "N/A"}°. Bilateral neural mechanosensitivity may reflect central sensitisation, diffuse lumbar pathology, or high neural irritability. Recommend Slump Test and comprehensive lumbar assessment.`;
    } else if (!lPositive && !rPositive && (lAngle < 70 || rAngle < 70)) {
      interp = `SLR bilaterally negative for neural symptom reproduction. Limitation present${lAngle < 70 ? ` left (${lAngle}°)` : ""}${rAngle < 70 ? ` right (${rAngle}°)` : ""}. Findings suggest muscular flexibility limitation (hamstring restriction) rather than radiculopathy.`;
    } else {
      interp = `SLR assessment bilaterally negative. Left ${lAngle}°, Right ${rAngle}°. No neural symptom provocation noted. ROM within or near normal limits.`;
    }

    return { lAngle, rAngle, diff, lPositive, rPositive, flags, lDesc, rDesc, interp };
  }, [left, right]);

  // ── SOAP text builder ─────────────────────────────────────────────────────

  const buildSOAP = () => {
    if (!analysis) return "";
    const { lAngle, rAngle, diff, lPositive, rPositive, flags, lDesc, rDesc, interp } = analysis;

    const modLines = Object.entries(modifiers)
      .filter(([, v]) => v)
      .map(([k, v]) => {
        const mod = MODIFIERS.find(m => m.id === k);
        return mod ? `    - ${mod.label}: ${v}` : null;
      }).filter(Boolean);

    return [
      `• Straight Leg Raise (SLR) Assessment — Neurodynamic & Orthopedic Test`,
      ``,
      `  Bilateral Results:`,
      `    ${lDesc}`,
      `    ${rDesc}`,
      `    Bilateral asymmetry: ${diff}°`,
      ``,
      baselinePain ? `  Baseline Pain: ${baselinePain}/10` : null,
      symptomaticSide ? `  Symptomatic Side: ${symptomaticSide}` : null,
      ``,
      modLines.length > 0 ? `  Neurodynamic Modifiers:` : null,
      ...modLines,
      ``,
      `  Clinical Interpretation:`,
      `    ${interp}`,
      ``,
      flags.length > 0 ? `  Clinical Flags:` : null,
      ...flags.map(f => `    ⚑ ${f}`),
      ``,
      notes ? `  Clinician Notes: ${notes}` : null,
      ``,
      `  References:`,
      `    Scaia V, Baxter D, Cook C. (2012). Pain provocation-based SLR test for lumbar disc herniation. J Back Musculoskelet Rehabil 25(4):215–223.`,
      `    Willhuber GO, Piuzzi NS. Straight Leg Raise Test. StatPearls Publishing; Updated 2023.`,
    ].filter(v => v !== null).join('\n');
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const canSave = left.maxAngle && right.maxAngle && left.positive && right.positive;

  const handleSave = () => {
    if (!canSave) {
      toast.error("Complete both limb assessments (max ROM and positive/negative result) before saving.");
      return;
    }

    const soap = buildSOAP();
    const { lAngle, rAngle, diff, lPositive, rPositive, flags, interp } = analysis;

    onSave({
      status: "completed",
      result_value: Math.max(lAngle, rAngle),
      additional_data: {
        measurement_type: "slr_neurodynamic",
        left: { ...left, maxAngle: lAngle, onsetAngle: parseFloat(left.onsetAngle) || null },
        right: { ...right, maxAngle: rAngle, onsetAngle: parseFloat(right.onsetAngle) || null },
        bilateral_asymmetry: diff,
        left_positive: lPositive,
        right_positive: rPositive,
        symptom_modifiers: modifiers,
        baseline_pain: baselinePain,
        symptomatic_side: symptomaticSide,
        clinical_flags: flags,
        interpretation: interp,
        safety_flags_noted: safetyFlags,
        soap_text: soap,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("SLR Assessment saved.");
  };

  const handleReset = () => {
    setLeft({ ...INITIAL_SIDE });
    setRight({ ...INITIAL_SIDE });
    setModifiers({});
    setNotes("");
    setBaselinePain("");
    setSymptomaticSide("");
    setSafetyFlags([]);
    setConsentObtained(false);
    setSafetyDone(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">

        {/* ── Top Header ── */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-start z-10">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Straight Leg Raise (SLR) Assessment</h1>
            <p className="text-sm text-slate-500 mt-0.5">Neurodynamic · Lumbar Radiculopathy · Neural Tension · Hip Flexibility</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="p-6 space-y-5">

          {/* ── SECTION 1: Overview ── */}
          <Collapsible open={openSections.overview} onOpenChange={() => toggleSection("overview")}>
            <CollapsibleTrigger className="w-full">
              <SectionHeader icon={Info} title="1. Assessment Overview" color="slate" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-sm">
                <p className="text-slate-700"><strong>Purpose:</strong> Assess neural tension, sciatic nerve mechanosensitivity, lumbar radiculopathy, hamstring restriction, and hip flexion mobility.</p>
                <div>
                  <p className="font-semibold text-slate-800 mb-2">Clinical Categories:</p>
                  <div className="flex flex-wrap gap-2">
                    {["Lumbar Radiculopathy", "Sciatica", "Neurodynamic Testing", "Hip Flexibility", "Neural Tension", "Low Back Pain"].map(c => (
                      <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="bg-white border rounded p-2"><p className="font-semibold text-slate-700">Sensitivity</p><p className="text-slate-600">72–97% (lumbar disc herniation)</p></div>
                  <div className="bg-white border rounded p-2"><p className="font-semibold text-slate-700">Specificity</p><p className="text-slate-600">11–66% (lumbar disc herniation)</p></div>
                  <div className="bg-white border rounded p-2"><p className="font-semibold text-slate-700">Time</p><p className="text-slate-600">5–10 min bilateral</p></div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTION 2: Safety Screen ── */}
          {!safetyDone ? (
            <div className="border-2 border-amber-300 rounded-xl overflow-hidden">
              <div className="bg-amber-500 text-white px-4 py-3 flex items-center gap-2 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" /> 2. Safety Screen — Complete Before Testing
              </div>
              <div className="p-4 space-y-4 bg-amber-50">
                <p className="text-sm text-amber-800 font-medium">Check any that apply to this patient:</p>
                <div className="grid grid-cols-1 gap-2">
                  {SAFETY_FLAGS.map(f => (
                    <label key={f.id} className={`flex items-center gap-3 cursor-pointer text-sm p-2.5 rounded border transition-colors ${safetyFlags.includes(f.id) ? "bg-red-50 border-red-300 text-red-800" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
                      <Checkbox
                        checked={safetyFlags.includes(f.id)}
                        onCheckedChange={checked => {
                          if (checked) setSafetyFlags(p => [...p, f.id]);
                          else setSafetyFlags(p => p.filter(x => x !== f.id));
                        }}
                      />
                      {f.label}
                    </label>
                  ))}
                </div>

                {hasRedFlag && (
                  <div className="bg-red-100 border border-red-300 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800 font-medium">Red flag identified. Proceed with clinical caution or defer assessment pending medical review.</p>
                  </div>
                )}

                <label className="flex items-center gap-3 cursor-pointer text-sm p-2.5 rounded border bg-white border-slate-200">
                  <Checkbox checked={consentObtained} onCheckedChange={setConsentObtained} />
                  <span className="font-medium text-slate-800">Patient consent obtained for assessment</span>
                </label>

                <Button
                  onClick={() => setSafetyDone(true)}
                  disabled={!consentObtained}
                  className="w-full bg-amber-600 hover:bg-amber-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirm Safety Screen & Proceed
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-800 font-medium">Safety screen completed. {hasRedFlag ? "⚠ Red flags noted — proceed with caution." : "No red flags identified."}</span>
              <button onClick={() => setSafetyDone(false)} className="ml-auto text-xs text-green-700 underline">Edit</button>
            </div>
          )}

          {/* ── SECTION 3: Clinician Instructions ── */}
          <div className="bg-blue-600 text-white rounded-lg px-4 py-3 text-sm">
            <p className="font-semibold mb-1">💬 3. Clinician Instructions</p>
            <p className="text-blue-100">Patient lies supine with knee fully extended. Passively raise the limb into hip flexion while monitoring for symptom reproduction. Maintain neutral pelvis, avoid knee flexion, raise slowly (approx 10°/sec). Monitor symptom onset angle. Differentiate hamstring stretch sensation from neural pain (burning, radiating, familiar).</p>
          </div>

          {/* ── SECTION 4: Test Setup ── */}
          <Collapsible open={openSections.setup} onOpenChange={() => toggleSection("setup")}>
            <CollapsibleTrigger className="w-full">
              <SectionHeader icon={Activity} title="4. Test Setup" color="blue" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Surface Used</Label>
                  <RadioButtons
                    options={["Plinth", "Mat table", "Firm bed", "Floor"]}
                    value={surface}
                    onChange={setSurface}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Footwear</Label>
                  <RadioButtons
                    options={["Shoes off", "Shoes on"]}
                    value={shoesOff}
                    onChange={setShoesOff}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Warm-up performed?</Label>
                  <YesNoButtons value={warmupDone} onChange={setWarmupDone} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Symptomatic side</Label>
                  <RadioButtons
                    options={["Left", "Right", "Bilateral", "None"]}
                    value={symptomaticSide}
                    onChange={setSymptomaticSide}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Baseline Pain (0–10)</Label>
                  <Input
                    type="number" min="0" max="10"
                    value={baselinePain}
                    onChange={e => setBaselinePain(e.target.value)}
                    placeholder="0"
                    className="w-24"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTIONS 5 & 6: Bilateral Test Runners ── */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">5 & 6. Bilateral Test Runners</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LegTestPanel side="left" data={left} onChange={setLeft} />
              <LegTestPanel side="right" data={right} onChange={setRight} />
            </div>
          </div>

          {/* ── SECTION 7: Modifiers ── */}
          <Collapsible open={openSections.modifiers} onOpenChange={() => toggleSection("modifiers")}>
            <CollapsibleTrigger className="w-full">
              <SectionHeader icon={Zap} title="7. Symptom Modification Testing (Optional Neurodynamic Modifiers)" color="purple" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 space-y-3">
                {MODIFIERS.map(mod => (
                  <div key={mod.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-slate-800 mb-2">{mod.label}</p>
                    <RadioButtons
                      options={MODIFIER_RESPONSES}
                      value={modifiers[mod.id] || ""}
                      onChange={val => setModifiers(p => ({ ...p, [mod.id]: val }))}
                    />
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTIONS 8–11: Analysis, Interpretation, Flags ── */}
          {analysis && (
            <div className="space-y-4">
              {/* Comparative Analysis */}
              <div className="bg-slate-800 text-white rounded-xl p-4 space-y-3">
                <p className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4" /> 8. Comparative Analysis</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white/10 rounded-lg p-3">
                    <p className="text-xs text-slate-300">Left Max ROM</p>
                    <p className="text-2xl font-bold">{analysis.lAngle}°</p>
                    <Badge className={analysis.lPositive ? "bg-red-600 text-white" : "bg-green-600 text-white"}>{analysis.lPositive ? "Positive" : "Negative"}</Badge>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <p className="text-xs text-slate-300">Asymmetry</p>
                    <p className="text-2xl font-bold">{analysis.diff}°</p>
                    <p className={`text-xs mt-1 ${analysis.diff > 10 ? "text-amber-300" : "text-green-300"}`}>{analysis.diff > 10 ? "⚠ Clinically significant" : "Within limits"}</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <p className="text-xs text-slate-300">Right Max ROM</p>
                    <p className="text-2xl font-bold">{analysis.rAngle}°</p>
                    <Badge className={analysis.rPositive ? "bg-red-600 text-white" : "bg-green-600 text-white"}>{analysis.rPositive ? "Positive" : "Negative"}</Badge>
                  </div>
                </div>
              </div>

              {/* Interpretation */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="font-semibold text-blue-900 mb-2 flex items-center gap-2"><Info className="w-4 h-4" /> 9. Clinical Interpretation</p>
                <p className="text-sm text-blue-800 leading-relaxed">{analysis.interp}</p>
              </div>

              {/* Normative */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <p className="font-semibold text-indigo-900 mb-2">10. Normative Reference Ranges</p>
                <div className="text-sm text-indigo-800 space-y-1">
                  <p>• 70–90° hip flexion commonly tolerated in asymptomatic individuals</p>
                  <p>• Symptom reproduction between 30–70° may indicate neural involvement</p>
                  <p>• Below-knee symptoms are more clinically meaningful than posterior thigh tightness alone</p>
                  <p>• Asymmetry &gt;10° suggests unilateral pathology</p>
                </div>
              </div>

              {/* Clinical Flags */}
              {analysis.flags.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="font-semibold text-red-900 mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> 11. Clinical Flags</p>
                  <div className="space-y-2">
                    {analysis.flags.map((f, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">⚑</span>
                        <p className="text-sm text-red-800">{f}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SECTION 12: Clinical Notes ── */}
          <div>
            <Label className="font-semibold block mb-2 text-sm">12. Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Document movement quality, patient behaviour, test modifications, co-morbidities, or any contextual observations..."
              rows={3}
            />
          </div>

          {/* ── SECTION 13: References ── */}
          <Collapsible open={openSections.references} onOpenChange={() => toggleSection("references")}>
            <CollapsibleTrigger className="w-full">
              <SectionHeader icon={ExternalLink} title="13. Evidence-Based References" color="amber" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3 text-xs text-amber-800">
                {[
                  { text: "Majlesi J, Togay H, Ünalan H, Toprak S. The sensitivity and specificity of the Slump and Straight Leg Raising tests in patients with lumbar disc herniation. J Clin Rheumatol. 2008;14(2):87–91.", url: "https://pubmed.ncbi.nlm.nih.gov/18391700/" },
                  { text: "Scaia V, Baxter D, Cook C. The pain provocation-based straight leg raise test for diagnosis of lumbar disc herniation, lumbar radiculopathy and sciatica. J Back Musculoskelet Rehabil. 2012;25(4):215–223.", url: "https://pubmed.ncbi.nlm.nih.gov/23220805/" },
                  { text: "Willhuber GO, Piuzzi NS, Strahl A. Straight Leg Raise Test. StatPearls Publishing; Updated 2023.", url: "https://www.ncbi.nlm.nih.gov/books/NBK539717/" },
                  { text: "van der Windt DA, Simons E, Riphagen II et al. Physical examination for lumbar radiculopathy due to disc herniation in patients with low-back pain. Cochrane Database Syst Rev. 2010.", url: "https://pubmed.ncbi.nlm.nih.gov/20238349/" },
                  { text: "Deville WL et al. The test of Lasègue: systematic review of the accuracy in diagnosing herniated discs. Spine. 2000;25(9):1140–1147.", url: "https://pubmed.ncbi.nlm.nih.gov/10788860/" },
                ].map((ref, i) => (
                  <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 hover:underline">
                    <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {ref.text}
                  </a>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Action Buttons ── */}
          <div className="flex justify-between items-center gap-3 pt-4 border-t border-slate-200">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Cancel</Button>
              <Button variant="outline" onClick={handleReset} className="text-slate-600"><RotateCcw className="w-4 h-4 mr-2" />Reset</Button>
            </div>
            {!canSave && (
              <p className="text-xs text-slate-500 text-center">Complete both limb assessments before saving.</p>
            )}
            <Button
              onClick={handleSave}
              disabled={!canSave}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Save SLR Assessment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}