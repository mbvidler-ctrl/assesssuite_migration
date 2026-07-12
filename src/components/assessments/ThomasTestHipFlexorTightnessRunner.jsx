import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// ─── Helpers ────────────────────────────────────────────────────────────────

function hipSeverity(angle) {
  const a = parseFloat(angle);
  if (isNaN(a) || a <= 0) return null;
  if (a <= 10) return "Mild (1–10°)";
  if (a <= 20) return "Moderate (11–20°)";
  return "Severe (>20°)";
}

function kneeSeverity(angle) {
  const a = parseFloat(angle);
  if (isNaN(a) || a >= 80) return null;
  if (a >= 70) return "Mild (70–79°)";
  if (a >= 50) return "Moderate (50–69°)";
  return "Severe (<50°)";
}

function buildInterpretation(data) {
  const hip = parseFloat(data.hipAngle);
  const knee = parseFloat(data.kneeAngle);
  const findings = [];
  const positiveStructures = [];
  const negativeStructures = [];

  // Iliopsoas
  if (!isNaN(hip) && hip > 0) {
    positiveStructures.push("Iliopsoas / hip flexors");
    findings.push(`Hip flexion of ${hip}° above table — ${hipSeverity(hip)} iliopsoas/hip flexor tightness.`);
  } else if (!isNaN(hip)) {
    negativeStructures.push("Iliopsoas");
    findings.push("Thigh rests flat — iliopsoas within normal limits.");
  }

  // Rectus femoris
  if (!isNaN(knee) && knee < 80) {
    positiveStructures.push("Rectus femoris");
    findings.push(`Knee flexion ${knee}° (normal ≥80°) — ${kneeSeverity(knee)} rectus femoris tightness.`);
  } else if (!isNaN(knee)) {
    negativeStructures.push("Rectus femoris");
    findings.push(`Knee flexion ${knee}° — rectus femoris within normal limits.`);
  }

  // TFL / ITB
  if (data.abduction && data.abduction !== "none") {
    positiveStructures.push("TFL / ITB");
    findings.push(`${data.abduction.charAt(0).toUpperCase() + data.abduction.slice(1)} hip abduction observed — indicates TFL/ITB tightness.`);
  } else if (data.abduction === "none") {
    negativeStructures.push("TFL / ITB");
    findings.push("No hip abduction — TFL/ITB within normal limits.");
  }

  // External rotation / Sartorius
  if (data.externalRotation && data.externalRotation !== "none") {
    positiveStructures.push("Sartorius / external rotators");
    findings.push(`${data.externalRotation.charAt(0).toUpperCase() + data.externalRotation.slice(1)} external rotation present — may indicate sartorius tightness or compensatory external rotator restriction.`);
  }

  // Compensation
  if (data.pelvicCompensation === "present") {
    findings.push("Pelvic compensation observed — test validity may be reduced; lumbar spine position must be controlled.");
  }
  if (data.lumbarExtension === "present") {
    findings.push("Lumbar extension compensation — anterior pelvic tilt may be masking hip flexor tightness. Reassess with stricter pelvic control.");
  }

  // Pain
  if (data.painPresent === "yes") {
    findings.push(`Pain provocation: ${data.painLocation || "location unspecified"} — severity ${data.painSeverity}/10. Interpret with caution; pain may limit test validity.`);
  }

  return { findings, positiveStructures, negativeStructures };
}

function buildRecommendations(data) {
  const recs = [];
  const hip = parseFloat(data.hipAngle);
  const knee = parseFloat(data.kneeAngle);

  if (!isNaN(hip) && hip > 0) {
    recs.push("Iliopsoas stretching: kneeling hip flexor stretch, supine hip flexor elongation, progressive holds 30–60s × 3–5 sets.");
    recs.push("Address anterior pelvic tilt and lumbar extension posture patterns.");
  }
  if (!isNaN(knee) && knee < 80) {
    recs.push("Rectus femoris stretching: prone knee bend, standing quad stretch, Thomas position stretch.");
  }
  if (data.abduction && data.abduction !== "none") {
    recs.push("ITB/TFL mobility: foam rolling lateral thigh, lateral hip stretching, hip adductor strengthening.");
  }
  if (data.externalRotation && data.externalRotation !== "none") {
    recs.push("Consider hip internal rotator strengthening and sartorius/external rotator flexibility program.");
  }
  if (data.pelvicCompensation === "present" || data.lumbarExtension === "present") {
    recs.push("Core stability and lumbopelvic control training: dead bug, glute bridge, posterior pelvic tilt exercises.");
  }
  recs.push("Reassess in 4–6 weeks following targeted stretching and strength program.");
  recs.push("Consider referral for gait analysis if bilateral tightness with functional implications.");
  return recs;
}

function buildRedFlags(data) {
  const flags = [];
  const pain = parseInt(data.painSeverity);
  if (data.painPresent === "yes" && !isNaN(pain) && pain >= 7) flags.push("Strong pain provocation (≥7/10) — test validity compromised. Investigate pathology before stretching.");
  if (data.pelvicCompensation === "present" && data.lumbarExtension === "present") flags.push("Unable to maintain pelvic/lumbar neutral — test result may be invalid. Repeat with strict positioning or use alternative assessment.");
  const hip = parseFloat(data.hipAngle);
  const hipR = parseFloat(data.hipAngleR);
  if (!isNaN(hip) && !isNaN(hipR) && Math.abs(hip - hipR) >= 10) flags.push(`Significant bilateral asymmetry in hip flexion (${Math.abs(hip - hipR).toFixed(0)}°) — investigate unilateral pathology.`);
  if (data.setupConfirmed === false) flags.push("Test setup checklist not confirmed — results may be unreliable.");
  return flags;
}

function overallResult(data) {
  const hip = parseFloat(data.hipAngle);
  const knee = parseFloat(data.kneeAngle);
  const positiveCount = [
    !isNaN(hip) && hip > 0,
    !isNaN(knee) && knee < 80,
    data.abduction && data.abduction !== "none",
    data.externalRotation && data.externalRotation !== "none",
  ].filter(Boolean).length;
  if (positiveCount === 0) return "Negative";
  if (positiveCount === 1) return "Positive";
  return "Mixed Findings";
}

// ─── Side data init ──────────────────────────────────────────────────────────

const emptySide = () => ({
  hipAngle: "",
  kneeAngle: "",
  abduction: "",
  externalRotation: "",
  painPresent: "",
  painLocation: "",
  painSeverity: "",
  pelvicCompensation: "",
  lumbarExtension: "",
});

// ─── Side Form ───────────────────────────────────────────────────────────────

function SideForm({ label, data, onChange }) {
  const hip = parseFloat(data.hipAngle);
  const knee = parseFloat(data.kneeAngle);

  const update = (field, val) => onChange({ ...data, [field]: val });

  const interp = buildInterpretation(data);
  const hasFindings = interp.positiveStructures.length > 0;
  const redFlags = buildRedFlags(data);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className={`px-4 py-2 font-semibold text-sm ${label === "Right" ? "bg-blue-50 text-blue-800 border-b border-blue-200" : "bg-purple-50 text-purple-800 border-b border-purple-200"}`}>
        {label} Side
      </div>
      <div className="p-4 space-y-4">

        {/* Angles */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-slate-600">Hip Flexion Angle (°)</Label>
            <p className="text-xs text-slate-400">Normal = 0° (flat on table)</p>
            <Input type="number" value={data.hipAngle} onChange={e => update("hipAngle", e.target.value)}
              placeholder="e.g. 15" className="mt-1 h-9 text-sm" />
            {!isNaN(hip) && hip > 0 && (
              <p className="text-xs font-medium text-orange-600 mt-1">⚠ {hipSeverity(data.hipAngle)} tightness</p>
            )}
            {!isNaN(hip) && hip <= 0 && <p className="text-xs text-green-600 mt-1">✓ Normal</p>}
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600">Knee Flexion Angle (°)</Label>
            <p className="text-xs text-slate-400">Normal ≥ 80°</p>
            <Input type="number" value={data.kneeAngle} onChange={e => update("kneeAngle", e.target.value)}
              placeholder="e.g. 65" className="mt-1 h-9 text-sm" />
            {!isNaN(knee) && knee < 80 && (
              <p className="text-xs font-medium text-orange-600 mt-1">⚠ {kneeSeverity(data.kneeAngle)} RF tightness</p>
            )}
            {!isNaN(knee) && knee >= 80 && <p className="text-xs text-green-600 mt-1">✓ Normal</p>}
          </div>
        </div>

        {/* Abduction + ER */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-slate-600">Hip Abduction (TFL/ITB)</Label>
            <Select value={data.abduction} onValueChange={v => update("abduction", v)}>
              <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="mild">Mild</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="marked">Marked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600">Hip External Rotation</Label>
            <Select value={data.externalRotation} onValueChange={v => update("externalRotation", v)}>
              <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="mild">Mild</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="marked">Marked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Compensation */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-slate-600">Pelvic Compensation</Label>
            <div className="flex gap-2 mt-1">
              {["present", "absent"].map(v => (
                <button key={v} onClick={() => update("pelvicCompensation", v)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border font-medium ${data.pelvicCompensation === v ? (v === "present" ? "bg-orange-500 text-white border-orange-500" : "bg-green-600 text-white border-green-600") : "bg-white text-slate-600 border-slate-300"}`}>
                  {v === "present" ? "Present" : "Absent"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600">Lumbar Extension Compensation</Label>
            <div className="flex gap-2 mt-1">
              {["present", "absent"].map(v => (
                <button key={v} onClick={() => update("lumbarExtension", v)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border font-medium ${data.lumbarExtension === v ? (v === "present" ? "bg-orange-500 text-white border-orange-500" : "bg-green-600 text-white border-green-600") : "bg-white text-slate-600 border-slate-300"}`}>
                  {v === "present" ? "Present" : "Absent"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pain */}
        <div className="border border-slate-100 rounded-lg p-3 space-y-3 bg-slate-50">
          <Label className="text-xs font-semibold text-slate-600">Pain During Test</Label>
          <div className="flex gap-2">
            {["yes", "no"].map(v => (
              <button key={v} onClick={() => update("painPresent", v)}
                className={`px-5 py-1.5 text-xs rounded-lg border font-medium ${data.painPresent === v ? (v === "yes" ? "bg-red-500 text-white border-red-500" : "bg-green-600 text-white border-green-600") : "bg-white text-slate-600 border-slate-300"}`}>
                {v === "yes" ? "Yes — Pain" : "No Pain"}
              </button>
            ))}
          </div>
          {data.painPresent === "yes" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500">Pain Location</Label>
                <Input value={data.painLocation} onChange={e => update("painLocation", e.target.value)}
                  placeholder="e.g. anterior hip" className="mt-1 h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Pain Severity (0–10)</Label>
                <Input type="number" min={0} max={10} value={data.painSeverity} onChange={e => update("painSeverity", e.target.value)}
                  placeholder="0–10" className="mt-1 h-8 text-xs" />
              </div>
            </div>
          )}
        </div>

        {/* Red flags */}
        {redFlags.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-3 space-y-1">
            <p className="text-xs font-bold text-red-800 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Red Flags</p>
            {redFlags.map((f, i) => <p key={i} className="text-xs text-red-700">• {f}</p>)}
          </div>
        )}

        {/* Mini findings */}
        {(interp.positiveStructures.length > 0 || interp.negativeStructures.length > 0) && (
          <div className={`rounded-lg border px-3 py-3 text-xs space-y-1 ${hasFindings ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200"}`}>
            {interp.positiveStructures.length > 0 && (
              <p className="text-orange-800"><strong>Positive:</strong> {interp.positiveStructures.join(", ")}</p>
            )}
            {interp.negativeStructures.length > 0 && (
              <p className="text-green-800"><strong>Normal:</strong> {interp.negativeStructures.join(", ")}</p>
            )}
            {interp.findings.map((f, i) => <p key={i} className="text-slate-700 mt-1">• {f}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ sides, testMode }) {
  const primary = sides.right;
  const secondary = sides.left;

  const iliopsoas = (d) => parseFloat(d.hipAngle) > 0 ? "Tight" : parseFloat(d.hipAngle) <= 0 ? "Normal" : "—";
  const rectusFem = (d) => parseFloat(d.kneeAngle) < 80 ? "Tight" : parseFloat(d.kneeAngle) >= 80 ? "Normal" : "—";
  const tfl = (d) => d.abduction && d.abduction !== "none" ? "Tight" : d.abduction === "none" ? "Normal" : "—";
  const compensation = (d) => d.pelvicCompensation === "present" || d.lumbarExtension === "present" ? "Yes" : "No";
  const painProv = (d) => d.painPresent === "yes" ? "Yes" : d.painPresent === "no" ? "No" : "—";

  const hipR = parseFloat(primary.hipAngle);
  const hipL = parseFloat(secondary.hipAngle);
  const asymmetry = !isNaN(hipR) && !isNaN(hipL) ? Math.abs(hipR - hipL) : null;
  const asymLabel = asymmetry === null ? "—" : asymmetry < 5 ? "Minimal" : asymmetry < 10 ? "Mild" : asymmetry < 15 ? "Moderate" : "Significant";

  const result = overallResult(testMode === "right" ? primary : testMode === "left" ? secondary : {
    ...primary,
    hipAngle: String(Math.max(parseFloat(primary.hipAngle) || 0, parseFloat(secondary.hipAngle) || 0)),
    kneeAngle: String(Math.min(parseFloat(primary.kneeAngle) || 80, parseFloat(secondary.kneeAngle) || 80)),
    abduction: [primary.abduction, secondary.abduction].find(a => a && a !== "none") || primary.abduction,
    externalRotation: [primary.externalRotation, secondary.externalRotation].find(a => a && a !== "none") || primary.externalRotation,
    painPresent: [primary.painPresent, secondary.painPresent].includes("yes") ? "yes" : "no",
    pelvicCompensation: [primary.pelvicCompensation, secondary.pelvicCompensation].includes("present") ? "present" : "absent",
    lumbarExtension: [primary.lumbarExtension, secondary.lumbarExtension].includes("present") ? "present" : "absent",
  });

  const resultColor = result === "Negative" ? "text-green-700" : result === "Positive" ? "text-red-700" : "text-orange-700";

  const rows = [
    { label: "Iliopsoas", right: iliopsoas(primary), left: iliopsoas(secondary) },
    { label: "Rectus Femoris", right: rectusFem(primary), left: rectusFem(secondary) },
    { label: "TFL / ITB", right: tfl(primary), left: tfl(secondary) },
    { label: "Compensation", right: compensation(primary), left: compensation(secondary) },
    { label: "Pain Provocation", right: painProv(primary), left: painProv(secondary) },
  ];

  const cellColor = (val) => val === "Tight" || val === "Yes" ? "text-red-700 font-semibold" : val === "Normal" || val === "No" ? "text-green-700" : "text-slate-400";

  return (
    <div className="border-2 border-slate-300 rounded-xl overflow-hidden">
      <div className="bg-slate-800 text-white px-4 py-2 font-bold text-sm">Thomas Test Summary</div>
      <div className="p-4 space-y-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-1 text-slate-600 font-semibold text-xs w-1/3">Structure</th>
              {(testMode === "bilateral" || testMode === "right") && <th className="text-center py-1 text-blue-700 font-semibold text-xs">Right</th>}
              {(testMode === "bilateral" || testMode === "left") && <th className="text-center py-1 text-purple-700 font-semibold text-xs">Left</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label} className="border-b border-slate-100">
                <td className="py-1.5 text-xs text-slate-700 font-medium">{r.label}</td>
                {(testMode === "bilateral" || testMode === "right") && <td className={`py-1.5 text-center text-xs ${cellColor(r.right)}`}>{r.right}</td>}
                {(testMode === "bilateral" || testMode === "left") && <td className={`py-1.5 text-center text-xs ${cellColor(r.left)}`}>{r.left}</td>}
              </tr>
            ))}
            {testMode === "bilateral" && asymmetry !== null && (
              <tr className="border-b border-slate-100">
                <td className="py-1.5 text-xs text-slate-700 font-medium">Side-to-Side Difference</td>
                <td colSpan={2} className={`py-1.5 text-center text-xs ${asymmetry >= 10 ? "text-red-700 font-semibold" : "text-slate-600"}`}>{asymLabel} ({asymmetry.toFixed(0)}°)</td>
              </tr>
            )}
          </tbody>
        </table>
        <div className={`text-center py-2 rounded-lg ${result === "Negative" ? "bg-green-50" : result === "Positive" ? "bg-red-50" : "bg-orange-50"}`}>
          <p className="text-xs text-slate-500">Overall Test Result</p>
          <p className={`text-lg font-bold ${resultColor}`}>{result}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const SETUP_CHECKS = [
  "Client positioned supine at edge of treatment table",
  "Contralateral hip/knee held to chest",
  "Lumbar spine flattened / posterior pelvic tilt maintained",
  "Tested leg relaxed passively",
  "Pelvis maintained in neutral alignment",
];

export default function ThomasTestHipFlexorTightnessRunner({ client, onSave, onClose }) {
  const [testMode, setTestMode] = useState("bilateral");
  const [setupChecks, setSetupChecks] = useState({});
  const [sides, setSides] = useState({ right: emptySide(), left: emptySide() });
  const [notes, setNotes] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);

  const allChecked = SETUP_CHECKS.every(c => setupChecks[c]);

  const updateSide = (side, data) => setSides(s => ({ ...s, [side]: data }));

  const buildSoapForSide = (label, d) => {
    const interp = buildInterpretation(d);
    return [
      `  ${label} Side:`,
      d.hipAngle ? `    Hip Flexion: ${d.hipAngle}° — ${parseFloat(d.hipAngle) > 0 ? hipSeverity(d.hipAngle) + " tightness" : "Normal"}` : "",
      d.kneeAngle ? `    Knee Flexion: ${d.kneeAngle}° — ${parseFloat(d.kneeAngle) < 80 ? kneeSeverity(d.kneeAngle) + " RF restriction" : "Normal"}` : "",
      d.abduction ? `    Hip Abduction: ${d.abduction}` : "",
      d.externalRotation ? `    External Rotation: ${d.externalRotation}` : "",
      d.pelvicCompensation ? `    Pelvic Compensation: ${d.pelvicCompensation}` : "",
      d.lumbarExtension ? `    Lumbar Extension: ${d.lumbarExtension}` : "",
      d.painPresent === "yes" ? `    Pain: Yes — ${d.painLocation || "?"} ${d.painSeverity}/10` : "    Pain: No",
      interp.positiveStructures.length > 0 ? `    Positive: ${interp.positiveStructures.join(", ")}` : "",
      interp.findings.map(f => `    → ${f}`).join("\n"),
    ].filter(Boolean).join("\n");
  };

  const handleSave = () => {
    if (!allChecked) { toast.error("Please confirm all setup checklist items before saving."); return; }

    const primaryData = testMode === "left" ? sides.left : sides.right;
    const hip = parseFloat(primaryData.hipAngle) || 0;

    const recs = buildRecommendations(primaryData);
    const redFlags = buildRedFlags(primaryData);

    const soapLines = [
      `• Thomas Test (Hip Flexor Tightness Assessment)`,
      `  Sides Tested: ${testMode === "bilateral" ? "Bilateral" : testMode === "right" ? "Right" : "Left"}`,
      (testMode === "bilateral" || testMode === "right") ? buildSoapForSide("Right", sides.right) : "",
      (testMode === "bilateral" || testMode === "left") ? buildSoapForSide("Left", sides.left) : "",
      redFlags.length > 0 ? `  ⚠ Red Flags: ${redFlags.join("; ")}` : "",
      `  Clinical Recommendations: ${recs.slice(0, 3).join(" | ")}`,
      notes ? `  Notes: ${notes}` : "",
      `  Reference: Harvey (1998); Clapis et al. (2008); Peeler & Anderson (2008)`,
    ].filter(Boolean).join("\n");

    onSave({
      result_value: hip,
      notes,
      assessment_date: todayLocal(),
      additional_data: {
        soap_text: soapLines,
        test_mode: testMode,
        right: sides.right,
        left: sides.left,
        setup_confirmed: allChecked,
        overall_result: overallResult(primaryData),
      }
    });
    toast.success("Thomas Test saved.");
  };

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Thomas Test</h2>
          <p className="text-sm text-slate-500">Hip flexor, rectus femoris &amp; TFL/ITB tightness — bilateral clinical assessment</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {/* Instructions toggle */}
      <div className="border border-blue-200 rounded-lg overflow-hidden">
        <button onClick={() => setShowInstructions(v => !v)}
          className="w-full flex justify-between items-center bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          📋 Protocol &amp; Clinician Instructions
          {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showInstructions && (
          <div className="bg-white p-4 text-sm space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                <p className="font-bold text-slate-800">Setup</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li>Supine at edge of table, both knees to chest</li>
                  <li>Hold untested knee — flattens lumbar spine</li>
                  <li>Lower tested leg passively toward table</li>
                  <li>Maintain neutral pelvis throughout</li>
                </ul>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs space-y-1">
                <p className="font-bold text-blue-800">Positive Signs</p>
                <ul className="list-disc pl-4 space-y-1 text-blue-700">
                  <li><strong>Hip flexion &gt;0°:</strong> Iliopsoas tight</li>
                  <li><strong>Knee flexion &lt;80°:</strong> Rectus femoris tight</li>
                  <li><strong>Hip abduction:</strong> TFL/ITB tight</li>
                  <li><strong>External rotation:</strong> Sartorius / rotators</li>
                </ul>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
              <p className="font-semibold text-amber-800">Severity Classification</p>
              <p className="text-amber-700 mt-1"><strong>Hip Flexion:</strong> Mild 1–10° | Moderate 11–20° | Severe &gt;20°</p>
              <p className="text-amber-700"><strong>Knee Flexion:</strong> Mild 70–79° | Moderate 50–69° | Severe &lt;50°</p>
            </div>
          </div>
        )}
      </div>

      {/* Setup Checklist */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-bold text-slate-800">✅ Test Setup Checklist <span className="text-xs text-slate-400 font-normal">(required before saving)</span></p>
        <div className="space-y-2">
          {SETUP_CHECKS.map(check => (
            <button key={check} onClick={() => setSetupChecks(s => ({ ...s, [check]: !s[check] }))}
              className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors ${setupChecks[check] ? "bg-green-50 border-green-300 text-green-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${setupChecks[check] ? "text-green-600" : "text-slate-300"}`} />
              {check}
            </button>
          ))}
        </div>
        {!allChecked && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">Confirm all setup steps to enable saving.</p>
        )}
      </div>

      {/* Test Mode */}
      <div>
        <Label className="text-sm font-semibold text-slate-700">Sides to Test</Label>
        <div className="flex gap-2 mt-2">
          {[{ v: "right", l: "Right Only" }, { v: "left", l: "Left Only" }, { v: "bilateral", l: "Bilateral" }].map(opt => (
            <button key={opt.v} onClick={() => setTestMode(opt.v)}
              className={`flex-1 py-2 text-sm rounded-lg border font-medium ${testMode === opt.v ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {/* Side Forms */}
      {(testMode === "right" || testMode === "bilateral") && (
        <SideForm label="Right" data={sides.right} onChange={d => updateSide("right", d)} />
      )}
      {(testMode === "left" || testMode === "bilateral") && (
        <SideForm label="Left" data={sides.left} onChange={d => updateSide("left", d)} />
      )}

      {/* Summary */}
      <SummaryCard sides={sides} testMode={testMode} />

      {/* Recommendations */}
      {(() => {
        const d = testMode === "left" ? sides.left : sides.right;
        const recs = buildRecommendations(d);
        return recs.length > 0 ? (
          <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50">
            <p className="text-sm font-bold text-indigo-800 mb-2">💡 Clinical Recommendations</p>
            <ul className="space-y-1">
              {recs.map((r, i) => <li key={i} className="text-xs text-indigo-700">• {r}</li>)}
            </ul>
          </div>
        ) : null;
      })()}

      {/* Notes */}
      <div>
        <Label className="text-sm font-semibold text-slate-700">Clinical Notes</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="End-feel, guarding, patient tolerance, functional relevance, previous findings..." className="mt-1 text-sm" />
      </div>

      {/* References */}
      <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">📖 References</p>
        <p>1. Harvey D. (1998). Assessment of the flexibility of elite athletes using the modified Thomas test. <em>BJSM</em>, 32(1), 68–70.</p>
        <p>2. Peeler J &amp; Anderson JE. (2008). Reliability of the Thomas Test for assessing range of motion about the hip. <em>Physical Therapy in Sport</em>, 9(1), 14–21.</p>
        <p>3. Clapis PA, Davis SM, Davis RO. (2008). Reliability of inclinometer and goniometric measurements of hip extension flexibility using the modified Thomas test. <em>Physiotherapy Theory and Practice</em>, 24(2), 135–141.</p>
        <p>4. Ober FR. (1936). The role of the iliotibial band and fascia lata as a factor in causation of low-back disabilities. <em>JBJS</em>, 18(1), 105–110.</p>
      </div>

      <div className="flex justify-between pt-2 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={!allChecked} className="bg-blue-600 hover:bg-blue-700 text-white">
          Save Assessment
        </Button>
      </div>
    </div>
  );
}