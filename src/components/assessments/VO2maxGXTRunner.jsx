import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Save, AlertTriangle, CheckCircle, XCircle, Activity } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";
import { sanitizeHtml } from "@/lib/safeHtml";

// ─── ACSM VO₂ FORMULAS ─────────────────────────────────────────────────────
// Treadmill: VO₂ (ml/kg/min) = (speed × 0.1) + (speed × grade × 1.8) + 3.5
// speed in m/min, grade as decimal
// Cycle: VO₂ (ml/kg/min) = (1.8 × workload / body_mass) + 7
// workload in kgm/min (1W = ~6 kgm/min)
function calcTreadmillVO2(speedKmh, gradePercent) {
  const speedMmin = (speedKmh * 1000) / 60;
  const grade = gradePercent / 100;
  return speedMmin * 0.1 + speedMmin * grade * 1.8 + 3.5;
}
function calcCycleVO2(wattsNum, bodyMassKg) {
  const kgmMin = wattsNum * 6;
  return (1.8 * kgmMin) / bodyMassKg + 7;
}

// ─── NORMATIVE VO₂ CLASSIFICATION (ACSM) ───────────────────────────────────
const VO2_NORMS = {
  male: {
    "20-29": [{ label: "Poor", max: 36 }, { label: "Fair", max: 43 }, { label: "Good", max: 51 }, { label: "Excellent", max: 55 }, { label: "Superior", max: Infinity }],
    "30-39": [{ label: "Poor", max: 34 }, { label: "Fair", max: 40 }, { label: "Good", max: 47 }, { label: "Excellent", max: 52 }, { label: "Superior", max: Infinity }],
    "40-49": [{ label: "Poor", max: 30 }, { label: "Fair", max: 36 }, { label: "Good", max: 44 }, { label: "Excellent", max: 48 }, { label: "Superior", max: Infinity }],
    "50-59": [{ label: "Poor", max: 26 }, { label: "Fair", max: 32 }, { label: "Good", max: 39 }, { label: "Excellent", max: 43 }, { label: "Superior", max: Infinity }],
    "60-69": [{ label: "Poor", max: 24 }, { label: "Fair", max: 30 }, { label: "Good", max: 37 }, { label: "Excellent", max: 41 }, { label: "Superior", max: Infinity }],
    "70+":   [{ label: "Poor", max: 20 }, { label: "Fair", max: 26 }, { label: "Good", max: 32 }, { label: "Excellent", max: 36 }, { label: "Superior", max: Infinity }],
  },
  female: {
    "20-29": [{ label: "Poor", max: 31 }, { label: "Fair", max: 37 }, { label: "Good", max: 44 }, { label: "Excellent", max: 49 }, { label: "Superior", max: Infinity }],
    "30-39": [{ label: "Poor", max: 28 }, { label: "Fair", max: 33 }, { label: "Good", max: 40 }, { label: "Excellent", max: 45 }, { label: "Superior", max: Infinity }],
    "40-49": [{ label: "Poor", max: 28 }, { label: "Fair", max: 34 }, { label: "Good", max: 40 }, { label: "Excellent", max: 45 }, { label: "Superior", max: Infinity }],
    "50-59": [{ label: "Poor", max: 24 }, { label: "Fair", max: 29 }, { label: "Good", max: 35 }, { label: "Excellent", max: 40 }, { label: "Superior", max: Infinity }],
    "60-69": [{ label: "Poor", max: 23 }, { label: "Fair", max: 28 }, { label: "Good", max: 32 }, { label: "Excellent", max: 37 }, { label: "Superior", max: Infinity }],
    "70+":   [{ label: "Poor", max: 18 }, { label: "Fair", max: 23 }, { label: "Good", max: 28 }, { label: "Excellent", max: 32 }, { label: "Superior", max: Infinity }],
  }
};

const AGE_BAND_LABELS = { male: ["20-29","30-39","40-49","50-59","60-69","70+"], female: ["20-29","30-39","40-49","50-59","60-69","70+"] };

function getAgeBand(age) {
  if (age < 30) return "20-29";
  if (age < 40) return "30-39";
  if (age < 50) return "40-49";
  if (age < 60) return "50-59";
  if (age < 70) return "60-69";
  return "70+";
}

function classifyVO2(vo2, age, sex) {
  if (!vo2 || !age || !sex) return null;
  const band = getAgeBand(parseInt(age));
  const norms = VO2_NORMS[sex]?.[band];
  if (!norms) return null;
  for (const tier of norms) { if (vo2 < tier.max) return tier.label; }
  return "Superior";
}

const CATEGORY_STYLE = {
  Poor:     { color: "text-red-700", bg: "bg-red-50 border-red-200" },
  Fair:     { color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  Good:     { color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  Excellent:{ color: "text-green-700", bg: "bg-green-50 border-green-200" },
  Superior: { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
};

// ─── MAXIMAL CRITERIA VALIDATION ────────────────────────────────────────────
function validateMaximalCriteria(peakHR, age, rer, rpe, vo2Plateau) {
  const aphr = age ? 220 - parseInt(age) : null;
  const hrPct = aphr && peakHR ? (parseFloat(peakHR) / aphr) * 100 : null;
  return [
    { label: "RER ≥ 1.10", met: rer ? parseFloat(rer) >= 1.10 : null, value: rer ? `${rer}` : null, criterion: "≥ 1.10" },
    { label: "HR ≥ 90% age-predicted max", met: hrPct ? hrPct >= 90 : null, value: hrPct ? `${hrPct.toFixed(0)}%` : null, criterion: "≥ 90% (220 − age)" },
    { label: "RPE ≥ 17/20", met: rpe ? parseInt(rpe) >= 17 : null, value: rpe ? `${rpe}/20` : null, criterion: "≥ 17" },
    { label: "VO₂ plateau observed", met: vo2Plateau === "yes" ? true : vo2Plateau === "no" ? false : null, value: vo2Plateau || null, criterion: "< 150 mL/min rise" },
  ];
}

// ─── RISK FLAGS ─────────────────────────────────────────────────────────────
function assessRiskFlags({ peakSBP, baseSBP, peakHR, age, rer, ecg, recovHR1, recovHR2, hrPct }) {
  const flags = [];
  if (peakSBP && parseFloat(peakSBP) > 250) flags.push({ label: "Hypertensive response", detail: `Peak SBP ${peakSBP} mmHg — stop if >250/115 mmHg`, severity: "red" });
  if (peakSBP && baseSBP && (parseFloat(baseSBP) - parseFloat(peakSBP)) > 10) flags.push({ label: "Exertional hypotension", detail: `SBP dropped ≥10 mmHg below baseline — high-risk sign`, severity: "red" });
  if (rer && parseFloat(rer) > 1.30) flags.push({ label: "Very high RER (>1.30)", detail: `RER ${rer} — may indicate severe acidosis or hyperventilation`, severity: "yellow" });
  if (ecg && ecg !== "normal") flags.push({ label: `ECG: ${ecg.replace(/_/g," ")}`, detail: "Abnormal ECG finding — cardiology review warranted", severity: "red" });
  if (recovHR1 && recovHR1 !== "" && peakHR && (parseFloat(peakHR) - parseFloat(recovHR1)) < 12)
    flags.push({ label: "Impaired HRR (1 min)", detail: `Recovery HR drop <12 bpm at 1 min — associated with increased CV mortality`, severity: "yellow" });
  if (recovHR2 && recovHR2 !== "" && peakHR && (parseFloat(peakHR) - parseFloat(recovHR2)) < 22)
    flags.push({ label: "Impaired HRR (2 min)", detail: `Recovery HR drop <22 bpm at 2 min — impaired autonomic recovery`, severity: "yellow" });
  return flags;
}

// ─── AUTO INTERPRETATION ────────────────────────────────────────────────────
function generateInterpretation({ modality, protocol, vo2Rel, vo2Abs, category, hrPct, rer, rpe, criteria, peakWorkload, bodyMass, rer_at_vt, ventilatory_threshold, termination, peakSBP, flags, recovHR1, recovHR2, economy }) {
  const criteriaCount = criteria.filter(c => c.met === true).length;
  const isMaximal = criteriaCount >= 2;

  let para = "";
  if (vo2Rel) {
    para += `The client achieved a ${isMaximal ? "maximal" : "peak"} VO₂ of ${parseFloat(vo2Rel).toFixed(1)} ml/kg/min`;
    if (vo2Abs) para += ` (${parseFloat(vo2Abs).toFixed(2)} L/min)`;
    para += ` on a ${modality === "treadmill" ? "treadmill" : "cycle ergometer"} ${protocol ? `using the ${protocol} protocol` : ""}. `;
    if (category) para += `This places the client in the <strong>${category}</strong> category for their age and sex (ACSM norms). `;
  }
  if (hrPct) para += `Peak heart rate was ${hrPct.toFixed(0)}% of age-predicted maximum. `;
  if (rer) {
    const rerVal = parseFloat(rer);
    para += `Peak RER was ${rerVal.toFixed(2)}, `;
    para += rerVal >= 1.10 ? "confirming maximal effort. " : "which does not confirm true maximal effort — interpret as peak VO₂. ";
  }
  if (ventilatory_threshold && vo2Rel) {
    const vtPct = ((parseFloat(ventilatory_threshold) / parseFloat(vo2Rel)) * 100).toFixed(0);
    para += `Ventilatory threshold occurred at ${ventilatory_threshold} ml/kg/min (${vtPct}% of peak VO₂). `;
  }
  if (economy && economy !== "") para += `Exercise economy was ${economy} ml/kg/min. `;
  if (recovHR1) para += `Heart rate recovery at 1 minute post-exercise was ${recovHR1} bpm${parseFloat(recovHR1) >= 12 ? " (normal)" : " (impaired)"}. `;
  if (flags.length > 0) {
    const redFlags = flags.filter(f => f.severity === "red");
    if (redFlags.length > 0) para += `<strong class="text-red-600">Clinical flags were identified: ${redFlags.map(f => f.label).join("; ")}. Cardiology review is recommended.</strong> `;
  }
  if (!isMaximal) para += `<em>Note: Fewer than 2 maximal criteria were met — result represents peak VO₂ rather than true VO₂max.</em>`;
  return para;
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function VO2maxGXTRunner({ client, onSave, onClose }) {
  // Config
  const [modality, setModality] = useState("treadmill");
  const [protocol, setProtocol] = useState("");
  const [testIndication, setTestIndication] = useState("clinical");
  const [testDuration, setTestDuration] = useState("");
  const [bodyMass, setBodyMass] = useState(client?.weight_kg || "");
  const [clientAge, setClientAge] = useState("");
  const [clientSex, setClientSex] = useState("male");

  // Baseline vitals
  const [baselineHR, setBaselineHR] = useState("");
  const [baselineSBP, setBaselineSBP] = useState("");
  const [baselineDBP, setBaselineDBP] = useState("");

  // ACSM formula inputs (auto-calculated VO₂)
  const [peakSpeedKmh, setPeakSpeedKmh] = useState("");
  const [peakGradePct, setPeakGradePct] = useState("");
  const [peakWatts, setPeakWatts] = useState("");

  // Peak measurements
  const [peakHR, setPeakHR] = useState("");
  const [peakSBP, setPeakSBP] = useState("");
  const [peakDBP, setPeakDBP] = useState("");
  const [peakRER, setPeakRER] = useState("");
  const [peakRPE, setPeakRPE] = useState("");
  const [peakVE, setPeakVE] = useState(""); // Ventilatory equivalents
  const [peakVEVCO2, setPeakVEVCO2] = useState(""); // VE/VCO2 at AT

  // Override manual if needed
  const [manualVO2Override, setManualVO2Override] = useState("");
  const [vo2Plateau, setVo2Plateau] = useState(""); // yes/no

  // Thresholds
  const [ventilatoryThreshold, setVentilatoryThreshold] = useState("");
  const [rerAtVT, setRerAtVT] = useState("");

  // Recovery
  const [recovHR1, setRecovHR1] = useState("");
  const [recovHR2, setRecovHR2] = useState("");
  const [recovSBP, setRecovSBP] = useState("");
  const [recovSymptoms, setRecovSymptoms] = useState("");

  // Termination & ECG
  const [terminationReason, setTerminationReason] = useState("");
  const [ecgFindings, setEcgFindings] = useState("normal");
  const [adverseEvents, setAdverseEvents] = useState("none");

  // Notes
  const [notes, setNotes] = useState("");

  // ─── COMPUTED VALUES ───────────────────────────────────────────────────────
  const computedVO2 = useMemo(() => {
    if (modality === "treadmill" && peakSpeedKmh && peakGradePct !== "") {
      return calcTreadmillVO2(parseFloat(peakSpeedKmh), parseFloat(peakGradePct));
    }
    if (modality === "cycle" && peakWatts && bodyMass) {
      return calcCycleVO2(parseFloat(peakWatts), parseFloat(bodyMass));
    }
    return null;
  }, [modality, peakSpeedKmh, peakGradePct, peakWatts, bodyMass]);

  const peakVO2Rel = useMemo(() => {
    if (manualVO2Override) return parseFloat(manualVO2Override);
    return computedVO2 ? parseFloat(computedVO2.toFixed(1)) : null;
  }, [computedVO2, manualVO2Override]);

  const peakVO2Abs = useMemo(() => {
    if (!peakVO2Rel || !bodyMass) return null;
    return (peakVO2Rel * parseFloat(bodyMass)) / 1000;
  }, [peakVO2Rel, bodyMass]);

  const agePredictedMaxHR = useMemo(() => clientAge ? 220 - parseInt(clientAge) : null, [clientAge]);
  const hrPct = useMemo(() => agePredictedMaxHR && peakHR ? (parseFloat(peakHR) / agePredictedMaxHR) * 100 : null, [agePredictedMaxHR, peakHR]);

  const vo2Category = useMemo(() => classifyVO2(peakVO2Rel, clientAge, clientSex), [peakVO2Rel, clientAge, clientSex]);

  // Exercise economy: VO₂ at submaximal workload (approximated as %VO₂ at 65% HR reserve)
  const oxygenPulse = useMemo(() => {
    if (!peakVO2Abs || !peakHR) return null;
    return ((peakVO2Abs * 1000) / parseFloat(peakHR)).toFixed(1);
  }, [peakVO2Abs, peakHR]);

  const maximalCriteria = useMemo(() => validateMaximalCriteria(peakHR, clientAge, peakRER, peakRPE, vo2Plateau), [peakHR, clientAge, peakRER, peakRPE, vo2Plateau]);
  const criteriaMetCount = maximalCriteria.filter(c => c.met === true).length;
  const isMaximal = criteriaMetCount >= 2;

  const riskFlags = useMemo(() => assessRiskFlags({
    peakSBP, baseSBP: baselineSBP, peakHR, age: clientAge, rer: peakRER, ecg: ecgFindings, recovHR1, recovHR2, hrPct
  }), [peakSBP, baselineSBP, peakHR, clientAge, peakRER, ecgFindings, recovHR1, recovHR2, hrPct]);

  const interpretationPara = useMemo(() => {
    if (!peakVO2Rel) return null;
    return generateInterpretation({
      modality, protocol, vo2Rel: peakVO2Rel, vo2Abs: peakVO2Abs, category: vo2Category,
      hrPct, rer: peakRER, rpe: peakRPE, criteria: maximalCriteria, bodyMass,
      ventilatory_threshold: ventilatoryThreshold, termination: terminationReason,
      peakSBP, flags: riskFlags, recovHR1, recovHR2,
    });
  }, [peakVO2Rel, peakVO2Abs, vo2Category, hrPct, peakRER, peakRPE, maximalCriteria, bodyMass, ventilatoryThreshold, terminationReason, peakSBP, riskFlags, recovHR1, recovHR2, modality, protocol]);

  // ─── SAVE ─────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!peakVO2Rel) { toast.error("Please enter peak workload data to calculate VO₂, or use manual override."); return; }
    const criteriaNames = maximalCriteria.filter(c => c.met === true).map(c => c.label).join("; ") || "None met";

    const soapText = [
      `• CPET / VO₂max GXT (${modality === "treadmill" ? "Treadmill" : "Cycle Ergometer"}, ${protocol || "Protocol not specified"})`,
      `  Result Type: ${isMaximal ? "Maximal VO₂max" : "Peak VO₂ (sub-maximal criteria)"}`,
      `  Peak VO₂: ${peakVO2Rel.toFixed(1)} ml/kg/min${peakVO2Abs ? ` (${peakVO2Abs.toFixed(2)} L/min)` : ""}`,
      vo2Category ? `  Normative Category: ${vo2Category} (ACSM, ${clientSex}, age ${clientAge})` : null,
      peakHR ? `  Peak HR: ${peakHR} bpm${hrPct ? ` (${hrPct.toFixed(0)}% age-predicted max)` : ""}` : null,
      peakRER ? `  Peak RER: ${peakRER}` : null,
      peakRPE ? `  Peak RPE: ${peakRPE}/20` : null,
      oxygenPulse ? `  O₂ Pulse: ${oxygenPulse} mL/beat` : null,
      ventilatoryThreshold ? `  Ventilatory Threshold: ${ventilatoryThreshold} ml/kg/min` : null,
      peakVEVCO2 ? `  VE/VCO₂ slope: ${peakVEVCO2}` : null,
      recovHR1 ? `  HRR 1 min: ${recovHR1} bpm` : null,
      recovHR2 ? `  HRR 2 min: ${recovHR2} bpm` : null,
      terminationReason ? `  Test Termination: ${terminationReason}` : null,
      ecgFindings !== "normal" ? `  ECG: ${ecgFindings}` : null,
      riskFlags.length > 0 ? `  Risk Flags: ${riskFlags.map(f => f.label).join(", ")}` : null,
      `  Maximal Criteria Met: ${criteriaMetCount}/4 (${criteriaNames})`,
      notes ? `  Notes: ${notes}` : null,
    ].filter(Boolean).join("\n");

    onSave({
      result_value: parseFloat(peakVO2Rel.toFixed(1)),
      additional_data: {
        soap_text: soapText,
        measurement_type: "vo2max_gxt_cpet",
        is_maximal: isMaximal,
        modality, protocol, test_indication: testIndication,
        body_mass_kg: bodyMass ? parseFloat(bodyMass) : null,
        client_age: clientAge ? parseInt(clientAge) : null,
        client_sex: clientSex,
        vo2_formula_used: computedVO2 ? (modality === "treadmill" ? "ACSM Treadmill" : "ACSM Cycle") : "Manual",
        peak_vo2_relative: parseFloat(peakVO2Rel.toFixed(1)),
        peak_vo2_absolute: peakVO2Abs ? parseFloat(peakVO2Abs.toFixed(3)) : null,
        normative_category: vo2Category || null,
        peak_hr: peakHR ? parseInt(peakHR) : null,
        hr_pct_age_predicted: hrPct ? parseFloat(hrPct.toFixed(1)) : null,
        peak_sbp: peakSBP ? parseInt(peakSBP) : null,
        peak_dbp: peakDBP ? parseInt(peakDBP) : null,
        peak_rer: peakRER ? parseFloat(peakRER) : null,
        peak_rpe: peakRPE ? parseInt(peakRPE) : null,
        peak_ve: peakVE ? parseFloat(peakVE) : null,
        ve_vco2: peakVEVCO2 ? parseFloat(peakVEVCO2) : null,
        oxygen_pulse_ml_beat: oxygenPulse ? parseFloat(oxygenPulse) : null,
        ventilatory_threshold: ventilatoryThreshold ? parseFloat(ventilatoryThreshold) : null,
        recovery_hr_1min: recovHR1 ? parseInt(recovHR1) : null,
        recovery_hr_2min: recovHR2 ? parseInt(recovHR2) : null,
        recovery_sbp: recovSBP || null,
        maximal_criteria_met: criteriaMetCount,
        risk_flags: riskFlags.map(f => f.label),
        ecg_findings: ecgFindings,
        termination_reason: terminationReason,
        adverse_events: adverseEvents,
        interpretation: interpretationPara ? interpretationPara.replace(/<[^>]+>/g, "") : null,
      },
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("CPET / VO₂max GXT results saved.");
  };

  // ─── UI HELPERS ───────────────────────────────────────────────────────────
  const catStyle = vo2Category ? CATEGORY_STYLE[vo2Category] : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-5xl w-full my-4 shadow-xl">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-blue-50 to-cyan-50 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">VO₂max Testing — Maximal GXT / CPET</h2>
            <p className="text-sm text-slate-500 mt-0.5">Cardiopulmonary Exercise Testing Engine · ACSM Formula-Based</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="p-6 space-y-5">

          {/* Safety */}
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-900 space-y-1.5">
            <p className="font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Safety — Maximal Test Requirements</p>
            <p><strong>Medical clearance required.</strong> Absolute contraindications: acute MI, unstable angina, uncontrolled arrhythmias, severe aortic stenosis, acute PE, acute myocarditis.</p>
            <p><strong>Terminate immediately if:</strong> severe chest pain, marked dyspnoea, dizziness, pallor, serious arrhythmias, significant ECG changes, or ≥10 mmHg drop in SBP with increasing workload.</p>
          </div>

          {/* Demographics + Config */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Test Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Modality *</Label>
                  <Select value={modality} onValueChange={setModality}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="treadmill">Treadmill</SelectItem>
                      <SelectItem value="cycle">Cycle Ergometer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Protocol</Label>
                  <Input value={protocol} onChange={e => setProtocol(e.target.value)} placeholder="e.g. Bruce, Ramp, Modified Bruce" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Test Indication</Label>
                  <Select value={testIndication} onValueChange={setTestIndication}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clinical">Clinical / Diagnostic</SelectItem>
                      <SelectItem value="performance">Performance / Fitness</SelectItem>
                      <SelectItem value="exercise_prescription">Exercise Prescription</SelectItem>
                      <SelectItem value="pre_surgical">Pre-Surgical Clearance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Test Duration (min)</Label>
                  <Input type="number" value={testDuration} onChange={e => setTestDuration(e.target.value)} placeholder="e.g. 12.5" className="mt-1" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Client Demographics</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Age (years) *</Label>
                    <Input type="number" value={clientAge} onChange={e => setClientAge(e.target.value)} placeholder="e.g. 45" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Sex *</Label>
                    <Select value={clientSex} onValueChange={setClientSex}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Body Mass (kg) — required for ACSM formula</Label>
                  <Input type="number" value={bodyMass} onChange={e => setBodyMass(e.target.value)} placeholder="e.g. 80" className="mt-1" />
                </div>
                {agePredictedMaxHR && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
                    Age-predicted max HR (220 − {clientAge}) = <strong>{agePredictedMaxHR} bpm</strong>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Baseline Vitals */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Baseline / Resting Vitals</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">HR (bpm)</Label><Input type="number" value={baselineHR} onChange={e => setBaselineHR(e.target.value)} placeholder="72" className="mt-1" /></div>
                <div><Label className="text-xs">SBP (mmHg)</Label><Input type="number" value={baselineSBP} onChange={e => setBaselineSBP(e.target.value)} placeholder="120" className="mt-1" /></div>
                <div><Label className="text-xs">DBP (mmHg)</Label><Input type="number" value={baselineDBP} onChange={e => setBaselineDBP(e.target.value)} placeholder="80" className="mt-1" /></div>
              </div>
            </CardContent>
          </Card>

          {/* ACSM VO₂ Calculator */}
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                ACSM VO₂ Calculator — Peak Workload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {modality === "treadmill" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Peak Speed (km/h)</Label>
                    <Input type="number" step="0.1" value={peakSpeedKmh} onChange={e => setPeakSpeedKmh(e.target.value)} placeholder="e.g. 10.0" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Peak Grade (%)</Label>
                    <Input type="number" step="0.5" value={peakGradePct} onChange={e => setPeakGradePct(e.target.value)} placeholder="e.g. 12" className="mt-1" />
                  </div>
                  <p className="col-span-2 text-xs text-blue-700 font-medium">Formula: VO₂ = (speed × 0.1) + (speed × grade × 1.8) + 3.5 &nbsp;[speed in m/min]</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Peak Power (Watts)</Label>
                    <Input type="number" value={peakWatts} onChange={e => setPeakWatts(e.target.value)} placeholder="e.g. 250" className="mt-1" />
                  </div>
                  <p className="text-xs text-blue-700 font-medium self-end pb-1">Formula: VO₂ = (1.8 × kgm/min) / BM + 7 &nbsp;[requires body mass]</p>
                </div>
              )}

              {computedVO2 && (
                <div className="bg-blue-600 text-white rounded-lg p-3 text-center">
                  <p className="text-xs opacity-80 mb-1">ACSM Calculated Peak VO₂</p>
                  <p className="text-3xl font-bold">{computedVO2.toFixed(1)}</p>
                  <p className="text-xs opacity-80">ml/kg/min</p>
                  {peakVO2Abs && <p className="text-sm mt-1">{peakVO2Abs.toFixed(2)} L/min</p>}
                </div>
              )}

              <div>
                <Label className="text-xs text-slate-500">Manual VO₂ Override (if gas analyser used — ml/kg/min)</Label>
                <Input type="number" step="0.1" value={manualVO2Override} onChange={e => setManualVO2Override(e.target.value)} placeholder="Leave blank to use ACSM formula above" className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Peak Exercise Data */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Peak Exercise Measurements</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Peak HR (bpm)</Label><Input type="number" value={peakHR} onChange={e => setPeakHR(e.target.value)} placeholder="e.g. 178" className="mt-1" /></div>
                <div><Label className="text-xs">Peak SBP (mmHg)</Label><Input type="number" value={peakSBP} onChange={e => setPeakSBP(e.target.value)} placeholder="e.g. 200" className="mt-1" /></div>
                <div><Label className="text-xs">Peak DBP (mmHg)</Label><Input type="number" value={peakDBP} onChange={e => setPeakDBP(e.target.value)} placeholder="e.g. 90" className="mt-1" /></div>
                <div>
                  <Label className="text-xs">Peak RER</Label>
                  <Input type="number" step="0.01" value={peakRER} onChange={e => setPeakRER(e.target.value)} placeholder="e.g. 1.15" className="mt-1" />
                  {peakRER && <p className={`text-xs mt-1 ${parseFloat(peakRER) >= 1.10 ? "text-green-600" : "text-orange-600"}`}>{parseFloat(peakRER) >= 1.10 ? "✓ Maximal criterion met" : "⚠ Below 1.10 threshold"}</p>}
                </div>
                <div>
                  <Label className="text-xs">Peak RPE (6–20)</Label>
                  <Input type="number" value={peakRPE} onChange={e => setPeakRPE(e.target.value)} placeholder="e.g. 19" className="mt-1" />
                  {peakRPE && <p className={`text-xs mt-1 ${parseInt(peakRPE) >= 17 ? "text-green-600" : "text-orange-600"}`}>{parseInt(peakRPE) >= 17 ? "✓ Maximal criterion met" : "⚠ Below 17 threshold"}</p>}
                </div>
                <div>
                  <Label className="text-xs">VO₂ Plateau Observed?</Label>
                  <Select value={vo2Plateau} onValueChange={setVo2Plateau}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes (gold standard criterion)</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* CPET Respiratory Variables */}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">CPET Respiratory Variables</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">Peak V̇E (L/min)</Label><Input type="number" step="0.1" value={peakVE} onChange={e => setPeakVE(e.target.value)} placeholder="e.g. 120" className="mt-1" /></div>
                  <div>
                    <Label className="text-xs">VE/VCO₂ slope (at AT)</Label>
                    <Input type="number" step="0.1" value={peakVEVCO2} onChange={e => setPeakVEVCO2(e.target.value)} placeholder="e.g. 28" className="mt-1" />
                    {peakVEVCO2 && <p className={`text-xs mt-1 ${parseFloat(peakVEVCO2) < 34 ? "text-green-600" : parseFloat(peakVEVCO2) < 40 ? "text-yellow-600" : "text-red-600"}`}>{parseFloat(peakVEVCO2) < 34 ? "Normal" : parseFloat(peakVEVCO2) < 40 ? "Mildly elevated" : "Elevated — impaired ventilatory efficiency"}</p>}
                  </div>
                  <div>
                    <Label className="text-xs">Ventilatory Threshold (ml/kg/min)</Label>
                    <Input type="number" step="0.1" value={ventilatoryThreshold} onChange={e => setVentilatoryThreshold(e.target.value)} placeholder="e.g. 28" className="mt-1" />
                    {ventilatoryThreshold && peakVO2Rel && <p className="text-xs mt-1 text-blue-600">= {((parseFloat(ventilatoryThreshold) / peakVO2Rel) * 100).toFixed(0)}% of peak VO₂</p>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Maximal Criteria Validation */}
          <Card className={`border-2 ${isMaximal ? "border-green-300 bg-green-50/30" : "border-orange-300 bg-orange-50/30"}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {isMaximal
                  ? <CheckCircle className="w-5 h-5 text-green-600" />
                  : <XCircle className="w-5 h-5 text-orange-500" />
                }
                Maximal Criteria Validation ({criteriaMetCount}/4 met)
                <Badge className={isMaximal ? "bg-green-600" : "bg-orange-500"}>
                  {isMaximal ? "TRUE VO₂max" : "PEAK VO₂ only"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {maximalCriteria.map((c, i) => (
                  <div key={i} className={`flex items-center gap-2 p-2 rounded border text-sm ${c.met === true ? "bg-green-50 border-green-200" : c.met === false ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
                    {c.met === true ? <CheckCircle className="w-4 h-4 text-green-600 shrink-0" /> : c.met === false ? <XCircle className="w-4 h-4 text-red-500 shrink-0" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-400 shrink-0" />}
                    <div>
                      <p className="font-medium text-xs">{c.label}</p>
                      {c.value && <p className="text-xs text-slate-500">Recorded: {c.value} (criterion: {c.criterion})</p>}
                    </div>
                  </div>
                ))}
              </div>
              {!isMaximal && (
                <p className="text-xs text-orange-700 mt-2 bg-orange-50 p-2 rounded border border-orange-200">
                  ⚠ Fewer than 2 maximal criteria met. Results represent <strong>peak VO₂</strong> (not true VO₂max). Clinical interpretation should reflect this limitation.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Normative Classification */}
          {peakVO2Rel && clientAge && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Normative VO₂ Classification (ACSM)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {catStyle && (
                  <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${catStyle.bg}`}>
                    <div>
                      <p className="text-sm text-slate-600">Classification for {clientSex === "male" ? "Male" : "Female"}, Age {clientAge}</p>
                      <p className={`text-2xl font-bold ${catStyle.color}`}>{vo2Category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-slate-900">{peakVO2Rel.toFixed(1)}</p>
                      <p className="text-xs text-slate-500">ml/kg/min</p>
                      {peakVO2Abs && <p className="text-sm text-slate-600">{peakVO2Abs.toFixed(2)} L/min</p>}
                    </div>
                  </div>
                )}
                {oxygenPulse && (
                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="bg-slate-50 rounded p-2 border">
                      <p className="text-slate-500 mb-0.5">O₂ Pulse</p>
                      <p className="font-bold text-base text-slate-800">{oxygenPulse} mL/beat</p>
                      <p className="text-slate-400">Cardiac output proxy</p>
                    </div>
                    {hrPct && (
                      <div className="bg-slate-50 rounded p-2 border">
                        <p className="text-slate-500 mb-0.5">% Age-predicted HRmax</p>
                        <p className={`font-bold text-base ${hrPct >= 90 ? "text-green-700" : "text-orange-600"}`}>{hrPct.toFixed(0)}%</p>
                        <p className="text-slate-400">{hrPct >= 90 ? "Adequate effort" : "Sub-maximal effort"}</p>
                      </div>
                    )}
                    {ventilatoryThreshold && (
                      <div className="bg-slate-50 rounded p-2 border">
                        <p className="text-slate-500 mb-0.5">VT / Peak VO₂</p>
                        <p className="font-bold text-base text-slate-800">{((parseFloat(ventilatoryThreshold) / peakVO2Rel) * 100).toFixed(0)}%</p>
                        <p className="text-slate-400">Exercise economy</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Full norms table */}
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-xs border border-slate-200 rounded">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="p-1.5 text-left">Category</th>
                        {AGE_BAND_LABELS[clientSex].map(b => <th key={b} className="p-1.5 text-center">{b}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {["Superior","Excellent","Good","Fair","Poor"].map((cat, ci) => (
                        <tr key={cat} className={`border-t ${ci % 2 === 0 ? "" : "bg-slate-50"}`}>
                          <td className={`p-1.5 font-medium ${CATEGORY_STYLE[cat]?.color}`}>{cat}</td>
                          {AGE_BAND_LABELS[clientSex].map(band => {
                            const norms = VO2_NORMS[clientSex][band];
                            const idx = ["Poor","Fair","Good","Excellent","Superior"].indexOf(cat);
                            const low = idx === 0 ? 0 : norms[idx - 1].max;
                            const high = norms[idx].max;
                            const inRange = peakVO2Rel && peakVO2Rel >= low && (high === Infinity ? true : peakVO2Rel < high);
                            const isCurBand = getAgeBand(parseInt(clientAge)) === band;
                            return (
                              <td key={band} className={`p-1.5 text-center ${inRange && isCurBand ? "bg-blue-100 font-bold text-blue-800 ring-1 ring-blue-400 rounded" : ""}`}>
                                {high === Infinity ? `≥${low}` : low === 0 ? `<${high}` : `${low}–${high}`}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-slate-400 text-xs mt-1">Blue cell = client's current result. Source: ACSM Guidelines, 11th ed.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Flags */}
          {riskFlags.length > 0 && (
            <Card className="border-red-200 bg-red-50/40">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2 text-red-700"><AlertTriangle className="w-4 h-4" />Cardiovascular Risk Flags</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {riskFlags.map((f, i) => (
                  <div key={i} className={`flex gap-3 p-2 rounded border text-sm ${f.severity === "red" ? "bg-red-50 border-red-300 text-red-800" : "bg-yellow-50 border-yellow-300 text-yellow-800"}`}>
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div><p className="font-semibold">{f.label}</p><p className="text-xs opacity-80">{f.detail}</p></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recovery Physiology */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Recovery Physiology</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">HR at 1 min recovery (bpm)</Label>
                  <Input type="number" value={recovHR1} onChange={e => setRecovHR1(e.target.value)} placeholder="e.g. 155" className="mt-1" />
                  {recovHR1 && peakHR && <p className={`text-xs mt-1 ${(parseFloat(peakHR) - parseFloat(recovHR1)) >= 12 ? "text-green-600" : "text-red-600"}`}>Drop: {(parseFloat(peakHR) - parseFloat(recovHR1)).toFixed(0)} bpm {(parseFloat(peakHR) - parseFloat(recovHR1)) >= 12 ? "✓ Normal" : "⚠ Impaired"}</p>}
                </div>
                <div>
                  <Label className="text-xs">HR at 2 min recovery (bpm)</Label>
                  <Input type="number" value={recovHR2} onChange={e => setRecovHR2(e.target.value)} placeholder="e.g. 130" className="mt-1" />
                  {recovHR2 && peakHR && <p className={`text-xs mt-1 ${(parseFloat(peakHR) - parseFloat(recovHR2)) >= 22 ? "text-green-600" : "text-red-600"}`}>Drop: {(parseFloat(peakHR) - parseFloat(recovHR2)).toFixed(0)} bpm {(parseFloat(peakHR) - parseFloat(recovHR2)) >= 22 ? "✓ Normal" : "⚠ Impaired"}</p>}
                </div>
                <div>
                  <Label className="text-xs">SBP at 3 min recovery (mmHg)</Label>
                  <Input type="text" value={recovSBP} onChange={e => setRecovSBP(e.target.value)} placeholder="e.g. 150" className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Recovery Symptoms / Observations</Label>
                <Textarea value={recovSymptoms} onChange={e => setRecovSymptoms(e.target.value)} placeholder="Dyspnoea resolution, chest discomfort, dizziness, pallor, monitored until..." rows={2} className="mt-1" />
              </div>
              <div className="bg-slate-50 border rounded p-2 text-xs text-slate-600">
                <strong>Clinical reference:</strong> HRR &lt;12 bpm at 1 min post-exercise is associated with 2× increased mortality risk (Cole et al., 1999). HRR &lt;22 bpm at 2 min indicates impaired autonomic recovery.
              </div>
            </CardContent>
          </Card>

          {/* Termination & ECG */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Test Termination & Clinical Findings</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Reason for Termination</Label>
                  <Select value={terminationReason} onValueChange={setTerminationReason}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select reason" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="volitional_exhaustion">Volitional Exhaustion</SelectItem>
                      <SelectItem value="vo2_plateau">VO₂ Plateau Confirmed</SelectItem>
                      <SelectItem value="symptoms">Symptoms (specify in notes)</SelectItem>
                      <SelectItem value="ecg_changes">ECG Changes</SelectItem>
                      <SelectItem value="bp_response">Abnormal BP Response</SelectItem>
                      <SelectItem value="protocol_complete">Protocol Complete</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">ECG Findings</Label>
                  <Select value={ecgFindings} onValueChange={setEcgFindings}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal Sinus Rhythm</SelectItem>
                      <SelectItem value="st_depression">ST Depression</SelectItem>
                      <SelectItem value="st_elevation">ST Elevation</SelectItem>
                      <SelectItem value="arrhythmia">Arrhythmia</SelectItem>
                      <SelectItem value="lbbb">LBBB</SelectItem>
                      <SelectItem value="pvcs">PVCs / Ectopics</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Adverse Events During/After Test</Label>
                <Textarea value={adverseEvents} onChange={e => setAdverseEvents(e.target.value)} placeholder="None, or describe..." rows={2} className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Auto Interpretation */}
          {interpretationPara && (
            <Card className="border-blue-200 bg-blue-50/40">
              <CardHeader className="pb-2"><CardTitle className="text-base text-blue-900">🧠 Auto-Generated CPET Interpretation</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-blue-900 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(interpretationPara) }} />
                <p className="text-xs text-blue-500 mt-2">Auto-generated based on entered data. Review and customise in clinical notes below.</p>
              </CardContent>
            </Card>
          )}

          {/* Clinical Notes */}
          <div>
            <Label className="font-semibold text-sm">Clinical Notes & Exercise Prescription</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Clinical judgment, training zones, exercise prescription, follow-up, referral recommendations..." rows={4} className="mt-1" />
          </div>

          {/* References */}
          <div className="bg-slate-100 border border-slate-200 rounded p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">📖 References</p>
            <p>ACSM (2022). <em>Guidelines for Exercise Testing and Prescription</em>, 11th ed. Wolters Kluwer.</p>
            <p>Balady GJ et al. (2010). Clinician's Guide to CPET in Adults. <em>Circulation, 122</em>(2), 191–225.</p>
            <p>Cole CR et al. (1999). Heart-rate recovery immediately after exercise. <em>NEJM, 341</em>(18), 1351–1357.</p>
            <p>Guazzi M et al. (2017). EACPR/AHA Scientific Statement: Clinical Recommendations for Cardiopulmonary Exercise Testing Data Assessment. <em>JACC, 69</em>(13).</p>
          </div>

          {/* Footer */}
          <div className="flex justify-between pt-2 border-t">
            <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Cancel</Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 px-8">
              <Save className="w-4 h-4 mr-2" />Save VO₂max GXT / CPET Results
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
