import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Save, X, RotateCcw, AlertTriangle, CheckCircle2,
  Info, ExternalLink, Activity, AlertCircle, ChevronDown, ChevronRight
} from "lucide-react";
import { toast } from "sonner";

// ─── Helper Components ────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, color = "slate", subtitle }) {
  const bg = {
    slate: "bg-slate-700", blue: "bg-blue-700", green: "bg-green-700",
    purple: "bg-purple-700", amber: "bg-amber-600", red: "bg-red-600",
    teal: "bg-teal-700", indigo: "bg-indigo-700"
  }[color] || "bg-slate-700";
  return (
    <div className={`${bg} text-white rounded-lg px-4 py-3`}>
      <div className="flex items-center gap-2 font-semibold text-sm">
        {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
        {title}
      </div>
      {subtitle && <p className="text-xs mt-0.5 opacity-80">{subtitle}</p>}
    </div>
  );
}

function YesNoButtons({ value, onChange, yesLabel = "Yes", noLabel = "No" }) {
  return (
    <div className="flex gap-2">
      {[{ v: true, l: yesLabel, c: "green" }, { v: false, l: noLabel, c: "red" }].map(({ v, l, c }) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)}
          className={`text-sm px-4 py-1.5 rounded border font-medium transition-colors ${
            value === v
              ? c === "green" ? "bg-green-600 text-white border-green-600" : "bg-red-500 text-white border-red-500"
              : "border-slate-300 hover:bg-slate-50 text-slate-700"
          }`}>{l}</button>
      ))}
    </div>
  );
}

function RadioButtons({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt.val} type="button" onClick={() => onChange(opt.val)}
          className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
            value === opt.val ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 hover:bg-slate-50 text-slate-700"
          }`}>{opt.label}</button>
      ))}
    </div>
  );
}

function MultiSelect({ options, values, onChange }) {
  const toggle = (val) => {
    if (values.includes(val)) onChange(values.filter(v => v !== val));
    else onChange([...values, val]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            values.includes(opt) ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}>{opt}</button>
      ))}
    </div>
  );
}

// ─── Stage Image with caption ─────────────────────────────────────────────────

const STAGE_IMAGES = {
  slump: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80",
  cervical: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=400&q=80",
  knee: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&q=80",
  dorsiflex: "https://images.unsplash.com/photo-1616279967983-ec413476e824?w=400&q=80",
};

// ─── Limb Panel ───────────────────────────────────────────────────────────────

const SYMPTOM_LOCATIONS = [
  "Lumbar only", "Buttock", "Posterior thigh", "Knee", "Posterior calf", "Foot/toes", "Diffuse leg", "Anterior thigh"
];
const SYMPTOM_TYPES = [
  "Hamstring stretch", "Posterior thigh pain", "Sciatic-type pain", "Burning", "Tingling", "Numbness", "Calf ache", "Foot symptoms"
];

function LimbPanel({ side, data, onChange, isInjured }) {
  const set = (key, val) => onChange({ ...data, [key]: val });
  const label = side === "left" ? "Left Limb" : "Right Limb";

  return (
    <Card className={`border-2 ${isInjured ? "border-orange-300" : "border-slate-200"}`}>
      <CardHeader className={`py-3 px-4 ${isInjured ? "bg-orange-50" : "bg-slate-50"}`}>
        <CardTitle className="text-sm text-slate-900 flex items-center gap-2">
          {label}
          {isInjured && <Badge className="text-xs bg-orange-100 text-orange-700 border border-orange-300">Symptomatic</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">

        {/* Knee extension angle */}
        <div>
          <Label className="text-xs font-semibold text-slate-600 block mb-1">Knee Extension Angle at Symptom Onset (°)</Label>
          <div className="flex items-center gap-2">
            <Input type="number" min="0" max="180" value={data.kneeAngle || ""} onChange={e => set("kneeAngle", e.target.value)}
              placeholder="e.g. 30" className="w-28" />
            <span className="text-xs text-slate-500">degrees from full extension</span>
          </div>
        </div>

        {/* Pain severity */}
        <div>
          <Label className="text-xs font-semibold text-slate-600 block mb-1">Pain Severity (0–10)</Label>
          <Input type="number" min="0" max="10" value={data.painSeverity || ""} onChange={e => set("painSeverity", e.target.value)}
            placeholder="0" className="w-20" />
        </div>

        {/* Symptom type */}
        <div>
          <Label className="text-xs font-semibold text-slate-600 block mb-2">Symptom Type</Label>
          <MultiSelect options={SYMPTOM_TYPES} values={data.symptomTypes || []} onChange={v => set("symptomTypes", v)} />
        </div>

        {/* Location */}
        <div>
          <Label className="text-xs font-semibold text-slate-600 block mb-2">Symptom Distribution</Label>
          <MultiSelect options={SYMPTOM_LOCATIONS} values={data.symptomLocations || []} onChange={v => set("symptomLocations", v)} />
        </div>

        {/* Below-knee */}
        <div>
          <Label className="text-xs font-semibold text-slate-600 block mb-2">Symptoms below the knee?</Label>
          <YesNoButtons value={data.belowKnee} onChange={v => set("belowKnee", v)} />
        </div>

        {/* Familiar */}
        <div>
          <Label className="text-xs font-semibold text-slate-600 block mb-2">Familiar symptoms reproduced?</Label>
          <YesNoButtons value={data.familiarSymptoms} onChange={v => set("familiarSymptoms", v)} />
        </div>

        {/* Cervical release response */}
        <div>
          <Label className="text-xs font-semibold text-slate-600 block mb-2">Response to cervical extension release</Label>
          <RadioButtons
            options={[
              { val: "decreased", label: "Symptoms decreased ✓" },
              { val: "unchanged", label: "Unchanged" },
              { val: "increased", label: "Symptoms increased" },
            ]}
            value={data.cervicalResponse} onChange={v => set("cervicalResponse", v)}
          />
        </div>

        {/* Positive test */}
        <div>
          <Label className="text-xs font-semibold text-slate-600 block mb-2">Positive neural response?</Label>
          <YesNoButtons value={data.positive} onChange={v => set("positive", v)} yesLabel="Positive" noLabel="Negative" />
        </div>

        {/* Ankle dorsiflexion effect */}
        <div>
          <Label className="text-xs font-semibold text-slate-600 block mb-2">Symptoms with ankle dorsiflexion</Label>
          <RadioButtons
            options={[
              { val: "increased", label: "Increased" },
              { val: "unchanged", label: "Unchanged" },
              { val: "decreased", label: "Decreased" },
            ]}
            value={data.dorsiflex} onChange={v => set("dorsiflex", v)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Safety items ──────────────────────────────────────────────────────────────

const SAFETY_ITEMS = [
  { id: "no_acute_pain", label: "No severe acute lumbar pain", redFlag: false },
  { id: "no_recent_surgery", label: "No recent spinal surgery (within 6 weeks)", redFlag: false },
  { id: "no_disc_flare", label: "No acute disc flare or severe exacerbation", redFlag: false },
  { id: "no_cauda_equina", label: "No cauda equina red flags (bowel/bladder/bilateral deficit)", redFlag: true },
  { id: "no_severe_deficit", label: "No severe progressive neurological deficit", redFlag: true },
  { id: "can_tolerate_sitting", label: "Able to tolerate sustained seated posture", redFlag: false },
  { id: "consent", label: "Patient consent obtained", redFlag: false },
];

// ─── Guided stages ────────────────────────────────────────────────────────────

const SLUMP_STAGES = [
  {
    num: 1,
    label: "Thoracic / Lumbar Flexion",
    instruction: "Patient sits upright with hands behind back. Ask patient to slump the thoracic and lumbar spine into full flexion. Hold and observe.",
    tip: "Monitor for any immediate symptom onset. Note if symptoms are lumbar-local only."
  },
  {
    num: 2,
    label: "Add Cervical Flexion",
    instruction: "With spinal slump maintained, instruct patient to bring chin to chest (cervical flexion). Apply gentle overpressure if needed.",
    tip: "This adds further tension to the neural axis. Compare symptom change vs Stage 1."
  },
  {
    num: 3,
    label: "Passive Knee Extension",
    instruction: "Passively extend the knee on the symptomatic side (or left side first). Observe for symptom onset during range.",
    tip: "Note angle at which symptoms begin. Differentiate hamstring stretch from neural tension."
  },
  {
    num: 4,
    label: "Add Ankle Dorsiflexion",
    instruction: "With slump + cervical flexion + knee extension maintained, passively dorsiflex the ankle.",
    tip: "Dorsiflexion sensitises the sciatic nerve. Symptom increase = elevated neural tension."
  },
  {
    num: 5,
    label: "Cervical Extension Release",
    instruction: "While maintaining slump + knee extension + dorsiflexion, ask patient to extend the neck (look up). Observe symptom change.",
    tip: "KEY: Symptom relief with cervical extension confirms neural contribution. Relief = Positive neural test."
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

const INIT_LIMB = {
  kneeAngle: "", painSeverity: "", symptomTypes: [], symptomLocations: [],
  belowKnee: null, familiarSymptoms: null, cervicalResponse: "", positive: null, dorsiflex: ""
};

export default function SlumpTestRunner({ client, onSave, onClose }) {

  // Safety
  const [safetyChecks, setSafetyChecks] = useState({});
  const [safetyDone, setSafetyDone] = useState(false);

  // Setup
  const [symptomaticSide, setSymptomaticSide] = useState("");
  const [baselinePain, setBaselinePain] = useState("");
  const [irritability, setIrritability] = useState("");
  const [surface, setSurface] = useState("");

  // Guided stages
  const [stageCompleted, setStageCompleted] = useState({});
  const [stageSymptoms, setStageSymptoms] = useState({});

  // Limb data
  const [leftData, setLeftData] = useState({ ...INIT_LIMB });
  const [rightData, setRightData] = useState({ ...INIT_LIMB });

  // Neural differentiation
  const [diffModifiers, setDiffModifiers] = useState({
    cervicalExtension: "", plantarflexion: "", reducedSlump: "", hipReposition: ""
  });

  // Notes
  const [notes, setNotes] = useState("");

  // Collapsibles
  const [open, setOpen] = useState({ overview: true, setup: true, stages: true, left: true, right: true, diff: true, refs: false });
  const tog = k => setOpen(p => ({ ...p, [k]: !p[k] }));

  // ── Derived ───────────────────────────────────────────────────────────────

  const leftPositive = leftData.positive === true ||
    (leftData.familiarSymptoms === true && leftData.cervicalResponse === "decreased" && leftData.belowKnee === true);
  const rightPositive = rightData.positive === true ||
    (rightData.familiarSymptoms === true && rightData.cervicalResponse === "decreased" && rightData.belowKnee === true);

  const limbsComplete = (leftData.kneeAngle || leftData.positive !== null) && (rightData.kneeAngle || rightData.positive !== null);

  // ── Interpretation ────────────────────────────────────────────────────────

  const interpretation = useMemo(() => {
    if (!limbsComplete) return null;

    const side = symptomaticSide || "bilateral";
    const leftAngle = leftData.kneeAngle;
    const rightAngle = rightData.kneeAngle;

    // Comparison
    let comparisonText = "";
    if (leftAngle && rightAngle) {
      const diff = Math.abs(parseFloat(leftAngle) - parseFloat(rightAngle));
      if (diff > 10) {
        const more = parseFloat(leftAngle) > parseFloat(rightAngle) ? "Left" : "Right";
        comparisonText = `${more} limb demonstrated earlier symptom onset during knee extension (${diff}° asymmetry), indicating greater neural mechanosensitivity on the ${more.toLowerCase()} side.`;
      } else {
        comparisonText = "Bilateral knee extension angles were comparable, suggesting symmetrical neural mobility.";
      }
    }

    if (leftPositive && rightPositive) {
      return {
        level: "Bilateral Positive Slump Test",
        color: "text-red-700", bg: "bg-red-50 border-red-200",
        narrative: `Bilateral positive Slump Test with reproduction of familiar neural symptoms on both sides. ${comparisonText} Findings indicate bilateral sciatic neural mechanosensitivity. Comprehensive lumbar spine assessment and neurological screening is recommended.`
      };
    }
    if (leftPositive || rightPositive) {
      const positiveSide = leftPositive ? "left" : "right";
      const posData = leftPositive ? leftData : rightData;
      const locationStr = posData.symptomLocations?.length ? posData.symptomLocations.join(", ").toLowerCase() : "lower limb";
      const cervRelief = posData.cervicalResponse === "decreased";
      return {
        level: `Positive Slump Test — ${positiveSide.charAt(0).toUpperCase() + positiveSide.slice(1)} Side`,
        color: "text-orange-700", bg: "bg-orange-50 border-orange-200",
        narrative: `Positive ${positiveSide}-sided Slump Test with reproduction of familiar symptoms into ${locationStr}${posData.belowKnee ? ", including below-knee distribution" : ""}. ${cervRelief ? "Symptoms reduced following cervical extension release, confirming neural mechanosensitivity." : ""} ${comparisonText} Findings are consistent with ${positiveSide}-sided sciatic neural tension and possible lumbar nerve root irritation.`
      };
    }
    if (!leftPositive && !rightPositive) {
      const onlyStretch = [leftData.symptomTypes, rightData.symptomTypes].flat().some(s => s === "Hamstring stretch");
      return {
        level: "Negative Slump Test",
        color: "text-green-700", bg: "bg-green-50 border-green-200",
        narrative: `Slump Test did not reproduce familiar neural symptoms bilaterally. ${onlyStretch ? "Posterior thigh stretch sensation only was noted, which is a normal finding consistent with hamstring restriction rather than neurodynamic dysfunction. " : ""}No symptom modification with cervical extension was observed. Findings do not support significant lumbar neural tension at this time.`
      };
    }
    return null;
  }, [limbsComplete, leftPositive, rightPositive, leftData, rightData, symptomaticSide]);

  // ── Flags ─────────────────────────────────────────────────────────────────

  const flags = useMemo(() => {
    const f = [];
    if (!interpretation) return f;
    if (leftPositive || rightPositive) f.push("Sciatic neural mechanosensitivity identified");
    if (leftPositive && rightPositive) f.push("Bilateral neural involvement — lumbar canal or central pathology to consider");
    if (leftData.belowKnee === true || rightData.belowKnee === true) f.push("Below-knee symptom distribution — higher specificity for radiculopathy");
    if (leftData.familiarSymptoms === true || rightData.familiarSymptoms === true) f.push("Familiar symptom reproduction — clinically meaningful finding");
    if (leftPositive || rightPositive) f.push("Recommend SLR test comparison for convergent validity");
    if (leftPositive || rightPositive) f.push("Recommend lumbar neurological screen (myotomes, dermatomes, reflexes)");
    if (irritability && parseInt(irritability) >= 7) f.push("Elevated symptom irritability — proceed with caution in further testing");
    if (leftData.cervicalResponse === "unchanged" || rightData.cervicalResponse === "unchanged") f.push("No cervical release effect — consider non-neural or central origin");
    return f;
  }, [interpretation, leftPositive, rightPositive, leftData, rightData, irritability]);

  // ── SOAP ──────────────────────────────────────────────────────────────────

  const buildSOAP = () => {
    const lines = [
      `• Slump Test — Neurodynamic Assessment`,
      ``,
      `  Left Side:`,
      `    Knee extension angle at onset: ${leftData.kneeAngle || "—"}°`,
      `    Pain severity: ${leftData.painSeverity || "—"}/10`,
      leftData.symptomLocations?.length ? `    Distribution: ${leftData.symptomLocations.join(", ")}` : null,
      `    Below-knee symptoms: ${leftData.belowKnee === true ? "Yes" : leftData.belowKnee === false ? "No" : "—"}`,
      `    Familiar symptoms: ${leftData.familiarSymptoms === true ? "Yes" : leftData.familiarSymptoms === false ? "No" : "—"}`,
      `    Cervical release response: ${leftData.cervicalResponse || "—"}`,
      `    Result: ${leftPositive ? "POSITIVE" : "Negative"}`,
      ``,
      `  Right Side:`,
      `    Knee extension angle at onset: ${rightData.kneeAngle || "—"}°`,
      `    Pain severity: ${rightData.painSeverity || "—"}/10`,
      rightData.symptomLocations?.length ? `    Distribution: ${rightData.symptomLocations.join(", ")}` : null,
      `    Below-knee symptoms: ${rightData.belowKnee === true ? "Yes" : rightData.belowKnee === false ? "No" : "—"}`,
      `    Familiar symptoms: ${rightData.familiarSymptoms === true ? "Yes" : rightData.familiarSymptoms === false ? "No" : "—"}`,
      `    Cervical release response: ${rightData.cervicalResponse || "—"}`,
      `    Result: ${rightPositive ? "POSITIVE" : "Negative"}`,
      ``,
      interpretation ? `  Interpretation: ${interpretation.level}` : null,
      interpretation ? `  ${interpretation.narrative}` : null,
      ``,
      flags.length ? `  Clinical Flags:` : null,
      ...flags.map(f => `    ⚑ ${f}`),
      ``,
      notes ? `  Notes: ${notes}` : null,
      ``,
      `  References: Majlesi et al. (2008) J Clin Rheumatol; Butler DS The Sensitive Nervous System; Shacklock M Clinical Neurodynamics.`,
    ].filter(v => v !== null).join('\n');
    return lines;
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!limbsComplete) {
      toast.error("Complete bilateral limb findings before saving.");
      return;
    }
    onSave({
      status: "completed",
      result_value: (leftPositive ? 1 : 0) + (rightPositive ? 1 : 0),
      additional_data: {
        measurement_type: "slump_test",
        left: { ...leftData, positive: leftPositive },
        right: { ...rightData, positive: rightPositive },
        left_positive: leftPositive,
        right_positive: rightPositive,
        symptomatic_side: symptomaticSide,
        baseline_pain: baselinePain,
        irritability,
        differentiation_modifiers: diffModifiers,
        interpretation: interpretation?.level,
        interpretation_narrative: interpretation?.narrative,
        clinical_flags: flags,
        soap_text: buildSOAP(),
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Slump Test saved.");
  };

  const handleReset = () => {
    setSafetyChecks({}); setSafetyDone(false);
    setSymptomaticSide(""); setBaselinePain(""); setIrritability(""); setSurface("");
    setStageCompleted({}); setStageSymptoms({});
    setLeftData({ ...INIT_LIMB }); setRightData({ ...INIT_LIMB });
    setDiffModifiers({ cervicalExtension: "", plantarflexion: "", reducedSlump: "", hipReposition: "" });
    setNotes("");
  };

  const coreConsent = safetyChecks["consent"] && !safetyChecks["no_cauda_equina_off"] && safetyChecks["can_tolerate_sitting"];
  const hasConcern = safetyChecks["no_cauda_equina"] === false || safetyChecks["no_severe_deficit"] === false;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">

        {/* Sticky Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 z-10 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Slump Test</h1>
            <p className="text-sm text-slate-500 mt-0.5">Neurodynamic assessment — sciatic nerve mechanosensitivity &amp; lumbar radiculopathy screening</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Sticky result bar */}
        {limbsComplete && interpretation && (
          <div className={`sticky top-[73px] border-b px-6 py-2.5 z-10 flex items-center gap-3 ${interpretation.bg}`}>
            <AlertCircle className={`w-4 h-4 flex-shrink-0 ${interpretation.color}`} />
            <span className={`text-sm font-semibold ${interpretation.color}`}>{interpretation.level}</span>
            <span className="text-xs text-slate-500 ml-auto">
              L: {leftPositive ? "✓ Positive" : "Negative"} &nbsp;|&nbsp; R: {rightPositive ? "✓ Positive" : "Negative"}
            </span>
          </div>
        )}

        <div className="p-6 space-y-5">

          {/* ── SECTION 1: Overview ── */}
          <Collapsible open={open.overview} onOpenChange={() => tog("overview")}>
            <CollapsibleTrigger className="w-full text-left">
              <SectionHeader icon={Info} title="1. Assessment Overview" color="slate"
                subtitle="Slump Test — Neurodynamic lumbar/sciatic nerve assessment" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-sm">
                <p className="text-slate-700"><strong>Purpose:</strong> Assess sciatic nerve mechanosensitivity, lumbar nerve root irritability, and differentiate neural tension from hamstring restriction.</p>
                <div className="flex flex-wrap gap-2">
                  {["Lumbar Radiculopathy", "Sciatica", "Neural Tension", "Neurodynamic Testing", "Posterior Chain Neural Mobility", "Low Back Pain Screening"].map(c => (
                    <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white border rounded p-2"><p className="font-semibold text-slate-700">Sensitivity</p><p>~84% for disc herniation (Majlesi 2008)</p></div>
                  <div className="bg-white border rounded p-2"><p className="font-semibold text-slate-700">Key Positive Criterion</p><p>Familiar symptoms + cervical extension relief</p></div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
                  <strong>Test sequence:</strong> Spinal slump → Cervical flexion → Knee extension → Ankle dorsiflexion → Cervical extension release
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTION 2: Safety ── */}
          {!safetyDone ? (
            <div className="border-2 border-amber-300 rounded-xl overflow-hidden">
              <div className="bg-amber-500 text-white px-4 py-3 flex items-center gap-2 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" /> 2. Safety / Contraindications Screen
              </div>
              <div className="p-4 bg-amber-50 space-y-3">
                <div className="grid grid-cols-1 gap-2">
                  {SAFETY_ITEMS.map(item => (
                    <label key={item.id} className={`flex items-center gap-3 cursor-pointer text-sm p-2.5 rounded border transition-colors ${
                      safetyChecks[item.id]
                        ? item.redFlag ? "bg-red-50 border-red-300 text-red-800" : "bg-green-50 border-green-300 text-green-800"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}>
                      <Checkbox checked={!!safetyChecks[item.id]} onCheckedChange={v => setSafetyChecks(p => ({ ...p, [item.id]: v }))} />
                      <span>{item.label}{item.redFlag && <span className="ml-1 text-red-500 text-xs font-medium">(red flag)</span>}</span>
                    </label>
                  ))}
                </div>
                {(safetyChecks["no_cauda_equina"] || safetyChecks["no_severe_deficit"]) && (
                  <div className="bg-red-100 border border-red-300 rounded px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-800">Red flag confirmed. Proceed with extreme caution or defer and refer for urgent medical assessment.</p>
                  </div>
                )}
                <Button onClick={() => setSafetyDone(true)}
                  disabled={!safetyChecks["consent"] || !safetyChecks["can_tolerate_sitting"]}
                  className="w-full bg-amber-600 hover:bg-amber-700">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Safety & Proceed
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-800 font-medium">Safety check completed.</span>
              <button onClick={() => setSafetyDone(false)} className="ml-auto text-xs text-green-700 underline">Edit</button>
            </div>
          )}

          {/* ── SECTION 3: Instructions ── */}
          <div className="bg-blue-600 text-white rounded-lg px-4 py-3 text-sm">
            <p className="font-semibold mb-2">💬 3. Clinical Instructions — Test Sequence</p>
            <ol className="space-y-1 text-blue-100 list-decimal list-inside text-xs">
              <li>Patient seated upright, hands behind back (prevents arm support compensation)</li>
              <li>Thoracic and lumbar flexion — full spinal slump</li>
              <li>Add cervical flexion (chin to chest) — maintained throughout</li>
              <li>Passive knee extension — note angle at symptom onset</li>
              <li>Add ankle dorsiflexion — observe symptom change</li>
              <li>Release cervical flexion (extend neck) — <strong>symptom relief = positive neural test</strong></li>
            </ol>
            <p className="text-blue-200 text-xs mt-2">Differentiate: Hamstring stretch (normal) vs familiar neural symptoms (clinically significant).</p>
          </div>

          {/* ── SECTION 4: Setup ── */}
          <Collapsible open={open.setup} onOpenChange={() => tog("setup")}>
            <CollapsibleTrigger className="w-full text-left">
              <SectionHeader icon={Activity} title="4. Test Setup" color="blue" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Symptomatic Side</Label>
                  <RadioButtons options={[{ val: "left", label: "Left" }, { val: "right", label: "Right" }, { val: "bilateral", label: "Bilateral" }, { val: "none", label: "None" }]}
                    value={symptomaticSide} onChange={setSymptomaticSide} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Surface</Label>
                  <RadioButtons options={[{ val: "plinth", label: "Plinth" }, { val: "chair", label: "Chair" }, { val: "other", label: "Other" }]}
                    value={surface} onChange={setSurface} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Baseline Pain (0–10)</Label>
                  <Input type="number" min="0" max="10" value={baselinePain} onChange={e => setBaselinePain(e.target.value)} placeholder="0" className="w-20" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Symptom Irritability (0–10)</Label>
                  <Input type="number" min="0" max="10" value={irritability} onChange={e => setIrritability(e.target.value)} placeholder="0" className="w-20" />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTION 5: Guided Stage Runner ── */}
          <Collapsible open={open.stages} onOpenChange={() => tog("stages")}>
            <CollapsibleTrigger className="w-full text-left">
              <SectionHeader icon={ChevronRight} title="5. Step-by-Step Slump Runner" color="teal"
                subtitle="Work through each stage in sequence" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 space-y-3">
                {SLUMP_STAGES.map((stage) => {
                  const completed = stageCompleted[stage.num];
                  return (
                    <Card key={stage.num} className={`border-2 transition-colors ${completed ? "border-green-300 bg-green-50/30" : "border-slate-200"}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${completed ? "bg-green-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                            {completed ? "✓" : stage.num}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800">{stage.label}</p>
                            <p className="text-xs text-slate-600 mt-1">{stage.instruction}</p>
                            <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2 text-xs text-amber-800">
                              💡 {stage.tip}
                            </div>
                            <div className="mt-3">
                              <Label className="text-xs font-semibold text-slate-600 block mb-1.5">Symptoms at this stage</Label>
                              <div className="flex gap-2 mb-2">
                                <Input
                                  value={stageSymptoms[stage.num] || ""}
                                  onChange={e => setStageSymptoms(p => ({ ...p, [stage.num]: e.target.value }))}
                                  placeholder="e.g. posterior thigh tingling, no symptoms..."
                                  className="text-xs h-8"
                                />
                                <Button
                                  size="sm" variant={completed ? "outline" : "default"}
                                  onClick={() => setStageCompleted(p => ({ ...p, [stage.num]: !completed }))}
                                  className={`text-xs flex-shrink-0 ${!completed ? "bg-teal-600 hover:bg-teal-700" : ""}`}
                                >
                                  {completed ? "Undo" : "Confirm ✓"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTION 6 & 7: Bilateral Limb Findings ── */}
          <div>
            <SectionHeader icon={Activity} title="6 & 7. Bilateral Limb Findings" color="purple"
              subtitle="Capture left and right side findings independently" />
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <LimbPanel side="left" data={leftData} onChange={setLeftData}
                isInjured={symptomaticSide === "left" || symptomaticSide === "bilateral"} />
              <LimbPanel side="right" data={rightData} onChange={setRightData}
                isInjured={symptomaticSide === "right" || symptomaticSide === "bilateral"} />
            </div>
          </div>

          {/* ── SECTION 8: Neural Differentiation ── */}
          <Collapsible open={open.diff} onOpenChange={() => tog("diff")}>
            <CollapsibleTrigger className="w-full text-left">
              <SectionHeader icon={Activity} title="8. Neural Differentiation Testing" color="indigo"
                subtitle="Optional sensitisation and de-sensitisation modifiers" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 space-y-4">
                {[
                  { key: "cervicalExtension", label: "Cervical Extension Release" },
                  { key: "plantarflexion", label: "Ankle Plantarflexion (de-sensitise)" },
                  { key: "reducedSlump", label: "Reduced Slump Position" },
                  { key: "hipReposition", label: "Hip Repositioning" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <Label className="text-xs font-semibold text-slate-600 block mb-2">{label}</Label>
                    <RadioButtons
                      options={[
                        { val: "increased", label: "Symptoms increased" },
                        { val: "unchanged", label: "Unchanged" },
                        { val: "decreased", label: "Symptoms decreased" },
                      ]}
                      value={diffModifiers[key]}
                      onChange={v => setDiffModifiers(p => ({ ...p, [key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTION 9–11: Comparison, Interpretation, Flags ── */}
          {interpretation && (
            <div className="space-y-4">

              {/* Bilateral comparison */}
              <div className="bg-slate-800 text-white rounded-xl p-4">
                <p className="text-sm font-medium text-slate-300 mb-3">Bilateral Comparison</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400 text-xs mb-1">Left Limb</p>
                    <p className="font-bold text-lg">{leftPositive ? "✓ Positive" : "Negative"}</p>
                    {leftData.kneeAngle && <p className="text-xs text-slate-300">Onset at {leftData.kneeAngle}°</p>}
                    {leftData.cervicalResponse && <p className="text-xs text-slate-300">Cervical: {leftData.cervicalResponse}</p>}
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs mb-1">Right Limb</p>
                    <p className="font-bold text-lg">{rightPositive ? "✓ Positive" : "Negative"}</p>
                    {rightData.kneeAngle && <p className="text-xs text-slate-300">Onset at {rightData.kneeAngle}°</p>}
                    {rightData.cervicalResponse && <p className="text-xs text-slate-300">Cervical: {rightData.cervicalResponse}</p>}
                  </div>
                </div>
              </div>

              {/* Interpretation */}
              <div className={`${interpretation.bg} border rounded-xl p-4`}>
                <p className={`font-semibold ${interpretation.color} mb-2 flex items-center gap-2`}>
                  <Info className="w-4 h-4" /> Clinical Interpretation
                </p>
                <p className="text-sm text-slate-800 leading-relaxed">{interpretation.narrative}</p>
              </div>

              {/* Positive criteria reminder */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <p className="font-semibold text-indigo-900 mb-2 text-sm">Slump Test — Positive Criteria</p>
                <div className="grid grid-cols-2 gap-3 text-xs text-indigo-800">
                  <div>
                    <p className="font-semibold mb-1">Positive (Neural):</p>
                    <ul className="space-y-0.5">
                      <li>• Familiar symptoms reproduced</li>
                      <li>• Below-knee distribution</li>
                      <li>• Cervical extension relieves symptoms</li>
                      <li>• Ankle dorsiflexion increases symptoms</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Negative / Non-Neural:</p>
                    <ul className="space-y-0.5">
                      <li>• Hamstring stretch sensation only</li>
                      <li>• No symptom change with cervical movement</li>
                      <li>• No distal neural reproduction</li>
                      <li>• Symptoms local to lumbar spine only</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Flags */}
              {flags.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="font-semibold text-red-900 mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Clinical Flags</p>
                  <div className="space-y-1.5">
                    {flags.map((f, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5 flex-shrink-0">⚑</span>
                        <p className="text-sm text-red-800">{f}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Clinical Notes ── */}
          <div>
            <Label className="font-semibold block mb-2 text-sm">Clinical Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Symptom quality (burning, tingling, ache), patient behaviour, guarding, cooperation, comparison with prior testing, clinical reasoning..."
              rows={3} />
          </div>

          {/* ── References ── */}
          <Collapsible open={open.refs} onOpenChange={() => tog("refs")}>
            <CollapsibleTrigger className="w-full text-left">
              <SectionHeader icon={ExternalLink} title="Evidence-Based References" color="amber" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2.5 text-xs text-amber-800">
                {[
                  { text: "Majlesi J, Togay H, Ünalan H, Toprak S. The sensitivity and specificity of the Slump and the Straight Leg Raising tests in patients with lumbar disc herniation. J Clin Rheumatol. 2008;14(2):87–91.", url: "https://pubmed.ncbi.nlm.nih.gov/18391676/" },
                  { text: "Maitland GD. Vertebral Manipulation. 5th ed. Butterworth-Heinemann; 1986. [Foundational neurodynamic text — library reference]", url: "https://www.elsevier.com/books/vertebral-manipulation/maitland/978-0-7506-0757-5" },
                  { text: "Butler DS. The Sensitive Nervous System. Noigroup Publications; 2000. [Neural mechanosensitivity and neurodynamic testing principles]", url: "https://www.noigroup.com/product/the-sensitive-nervous-system/" },
                  { text: "Shacklock M. Clinical Neurodynamics: A New System of Neuromusculoskeletal Treatment. Elsevier; 2005.", url: "https://www.elsevier.com/books/clinical-neurodynamics/shacklock/978-0-7506-5456-2" },
                  { text: "Schäfer A, Hall T, Briffa K. Classification of low back-related leg pain — a proposed patho-mechanism-based approach. Manual Therapy. 2009;14(2):222–230.", url: "https://pubmed.ncbi.nlm.nih.gov/17766743/" },
                ].map((ref, i) => (
                  <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 hover:underline">
                    <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {ref.text}
                  </a>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Actions ── */}
          <div className="flex justify-between items-center gap-3 pt-4 border-t border-slate-200">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Cancel</Button>
              <Button variant="outline" onClick={handleReset} className="text-slate-600"><RotateCcw className="w-4 h-4 mr-2" />Reset</Button>
            </div>
            {!limbsComplete && <p className="text-xs text-slate-500 flex-1 text-center">Complete bilateral limb findings before saving.</p>}
            <Button onClick={handleSave} disabled={!limbsComplete} className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-2" />Save Slump Test
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}