import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import {
  Save, X, RotateCcw, AlertTriangle, CheckCircle2,
  Info, ExternalLink, Activity, AlertCircle, ChevronDown, ChevronRight, Wind
} from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// ─── SGRQ Question Definitions ────────────────────────────────────────────────
// Weights sourced from Jones PW (1991) original SGRQ manual

// Part 1: Symptoms — each question weighted separately
const SYMPTOMS_QUESTIONS = [
  {
    id: "s1", text: "Over the last year, I have coughed:",
    type: "radio",
    options: [
      { label: "Most days a week", weight: 1.8350 },
      { label: "Several days a week", weight: 1.1975 },
      { label: "A few days a month", weight: 0.6025 },
      { label: "Only with respiratory infections", weight: 0.3350 },
      { label: "Not at all", weight: 0 },
    ]
  },
  {
    id: "s2", text: "Over the last year, I have brought up phlegm (sputum):",
    type: "radio",
    options: [
      { label: "Most days a week", weight: 1.8350 },
      { label: "Several days a week", weight: 1.1975 },
      { label: "A few days a month", weight: 0.6025 },
      { label: "Only with respiratory infections", weight: 0.3350 },
      { label: "Not at all", weight: 0 },
    ]
  },
  {
    id: "s3", text: "Over the last year, I have had shortness of breath:",
    type: "radio",
    options: [
      { label: "Most days a week", weight: 2.6630 },
      { label: "Several days a week", weight: 2.1075 },
      { label: "A few days a month", weight: 1.0850 },
      { label: "Only with respiratory infections", weight: 0.4025 },
      { label: "Not at all", weight: 0 },
    ]
  },
  {
    id: "s4", text: "Over the last year, I have had attacks of wheezing:",
    type: "radio",
    options: [
      { label: "Most days a week", weight: 1.8375 },
      { label: "Several days a week", weight: 1.1975 },
      { label: "A few days a month", weight: 0.6025 },
      { label: "Only with respiratory infections", weight: 0.3350 },
      { label: "Not at all", weight: 0 },
    ]
  },
  {
    id: "s5", text: "During the last year, how many severe or very unpleasant attacks of chest trouble have you had?",
    type: "radio",
    options: [
      { label: "More than 3 attacks", weight: 2.3500 },
      { label: "3 attacks", weight: 1.7325 },
      { label: "2 attacks", weight: 1.1975 },
      { label: "1 attack", weight: 0.4025 },
      { label: "None", weight: 0 },
    ]
  },
  {
    id: "s6", text: "How long did the worst attack last? (Skip if no attacks)",
    type: "radio",
    optional: true,
    options: [
      { label: "A week or more", weight: 2.3500 },
      { label: "3 or more days", weight: 1.6775 },
      { label: "1 or 2 days", weight: 0.9325 },
      { label: "Less than a day", weight: 0.4025 },
      { label: "No attacks / not applicable", weight: 0 },
    ]
  },
  {
    id: "s7", text: "Over the last year, in an average week, how many good days (with little chest trouble) have you had?",
    type: "radio",
    options: [
      { label: "No good days", weight: 3.5900 },
      { label: "1 or 2 good days", weight: 2.8175 },
      { label: "3 or 4 good days", weight: 1.6025 },
      { label: "Nearly every day is good", weight: 0.8025 },
      { label: "Every day is good", weight: 0 },
    ]
  },
  {
    id: "s8", text: "If you have a wheeze, is it worse in the morning?",
    type: "radio",
    options: [
      { label: "Yes", weight: 0.7025 },
      { label: "No", weight: 0 },
    ]
  },
];

// Symptom domain max weight (sum of max weights from each question)
const SYMPTOMS_MAX = SYMPTOMS_QUESTIONS.reduce((sum, q) => sum + Math.max(...q.options.map(o => o.weight)), 0);

// Part 2: Activity — which activities cause breathlessness (each checked = weight)
const ACTIVITY_ITEMS = [
  { id: "a1", text: "Sitting or lying still", weight: 1.0000 },
  { id: "a2", text: "Washing or dressing yourself", weight: 2.6150 },
  { id: "a3", text: "Walking around the home", weight: 2.6150 },
  { id: "a4", text: "Walking outside on level ground", weight: 3.2200 },
  { id: "a5", text: "Walking up a flight of stairs or hills", weight: 3.2200 },
  { id: "a6", text: "Playing sports or games that are tiring", weight: 4.0150 },
  { id: "a7", text: "Strenuous sporting activities", weight: 4.0150 },
];
const ACTIVITY_MAX = ACTIVITY_ITEMS.reduce((s, i) => s + i.weight, 0);

// Part 3: Impacts — true/false statements
const IMPACT_ITEMS = [
  { id: "i1", text: "My cough or breathing is painful", weight: 1.2130 },
  { id: "i2", text: "My cough or breathing makes me tired", weight: 1.3970 },
  { id: "i3", text: "I am breathless when I talk", weight: 2.6400 },
  { id: "i4", text: "I am breathless when I bend over", weight: 2.6400 },
  { id: "i5", text: "My cough or breathing disturbs my sleep", weight: 2.0330 },
  { id: "i6", text: "I get exhausted easily", weight: 1.8400 },
  { id: "i7", text: "My chest condition affects me at home", weight: 2.0040 },
  { id: "i8", text: "My chest trouble is a nuisance to my family, friends or neighbours", weight: 2.5650 },
  { id: "i9", text: "I get afraid or panic when I cannot get my breath", weight: 2.9950 },
  { id: "i10", text: "I feel that I am not in control of my chest problem", weight: 2.3830 },
  { id: "i11", text: "I do not expect my chest to get any better", weight: 1.3400 },
  { id: "i12", text: "I have become frail or an invalid because of my chest", weight: 2.4270 },
  { id: "i13", text: "Exercise is not safe for me", weight: 2.2870 },
  { id: "i14", text: "Everything seems too much of an effort", weight: 1.5950 },
  { id: "i15", text: "My cough or breathing is embarrassing in public", weight: 2.2000 },
  { id: "i16", text: "My chest condition is a nuisance to others", weight: 2.7800 },
  { id: "i17", text: "My chest condition stops me doing what I would like", weight: 2.8600 },
  { id: "i18", text: "I cannot do sports or games", weight: 3.2100 },
  { id: "i19", text: "I cannot go out for entertainment or recreation", weight: 3.5200 },
  { id: "i20", text: "I cannot leave the house to do shopping", weight: 4.0300 },
  { id: "i21", text: "I cannot do household chores", weight: 3.5400 },
  { id: "i22", text: "I cannot climb stairs or hills", weight: 3.4850 },
];
const IMPACT_MAX = IMPACT_ITEMS.reduce((s, i) => s + i.weight, 0);

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function RadioButtons({ options, value, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((opt, i) => (
        <button key={i} type="button" onClick={() => onChange(i)}
          className={`text-sm px-3 py-2 rounded border text-left transition-colors ${
            value === i ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 hover:bg-blue-50 text-slate-700"
          }`}>{opt.label}</button>
      ))}
    </div>
  );
}

function ScorePill({ label, score, max = 100 }) {
  const pct = score !== null ? score : null;
  const color = pct === null ? "bg-slate-100 text-slate-400" :
    pct <= 25 ? "bg-green-100 text-green-800 border-green-300" :
    pct <= 50 ? "bg-yellow-100 text-yellow-800 border-yellow-300" :
    pct <= 75 ? "bg-orange-100 text-orange-800 border-orange-300" :
    "bg-red-100 text-red-800 border-red-300";

  return (
    <div className={`border rounded-xl px-3 py-2.5 text-center ${color}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="text-xl font-bold">{pct !== null ? `${pct}` : "—"}</p>
      <p className="text-xs opacity-70">/100</p>
    </div>
  );
}

function domainLabel(score) {
  if (score === null) return "—";
  if (score <= 25) return "Mild";
  if (score <= 50) return "Moderate";
  if (score <= 75) return "High";
  return "Severe";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StGeorgesRespiratoryQuestionnaireSGRQRunner({ client, onSave, onClose }) {

  // Setup
  const [diagnosis, setDiagnosis] = useState("");
  const [smokingStatus, setSmokingStatus] = useState("");
  const [oxygenUse, setOxygenUse] = useState(null);
  const [exacerbations, setExacerbations] = useState("");
  const [rehab, setRehab] = useState(null);
  const [adminMode, setAdminMode] = useState("");

  // Responses
  const [symptomsR, setSymptomsR] = useState({}); // { id: optionIndex }
  const [activityR, setActivityR] = useState({}); // { id: boolean }
  const [impactR, setImpactR] = useState({});     // { id: boolean }

  // Notes
  const [notes, setNotes] = useState("");

  // Section open state
  const [open, setOpen] = useState({ overview: true, instructions: true, setup: true, symptoms: true, activity: true, impact: true, refs: false });
  const tog = k => setOpen(p => ({ ...p, [k]: !p[k] }));

  // ── Scoring ───────────────────────────────────────────────────────────────

  const symptomsScore = useMemo(() => {
    const required = SYMPTOMS_QUESTIONS.filter(q => !q.optional).map(q => q.id);
    const answeredRequired = required.filter(id => symptomsR[id] !== undefined);
    if (answeredRequired.length < required.length) return null;

    let weighted = 0;
    SYMPTOMS_QUESTIONS.forEach(q => {
      const idx = symptomsR[q.id];
      if (idx !== undefined) weighted += q.options[idx]?.weight || 0;
    });
    return Math.round((weighted / SYMPTOMS_MAX) * 100);
  }, [symptomsR]);

  const activityScore = useMemo(() => {
    // Unchecked = not limited (false) — only need at least 1 interaction OR symptoms complete to calculate
    const weighted = ACTIVITY_ITEMS.reduce((sum, item) => sum + (activityR[item.id] === true ? item.weight : 0), 0);
    return Math.round((weighted / ACTIVITY_MAX) * 100);
  }, [activityR]);

  const impactScore = useMemo(() => {
    // Unchecked = not true (false) — checkboxes default to not applicable
    const weighted = IMPACT_ITEMS.reduce((sum, item) => sum + (impactR[item.id] === true ? item.weight : 0), 0);
    return Math.round((weighted / IMPACT_MAX) * 100);
  }, [impactR]);

  const totalScore = useMemo(() => {
    if (symptomsScore === null) return null;
    // SGRQ total = weighted sum / (sum of all max weights) * 100
    const allWeighted =
      SYMPTOMS_QUESTIONS.reduce((s, q) => {
        const idx = symptomsR[q.id];
        return s + (idx !== undefined ? q.options[idx]?.weight || 0 : 0);
      }, 0) +
      ACTIVITY_ITEMS.reduce((s, i) => s + (activityR[i.id] ? i.weight : 0), 0) +
      IMPACT_ITEMS.reduce((s, i) => s + (impactR[i.id] ? i.weight : 0), 0);
    const totalMax = SYMPTOMS_MAX + ACTIVITY_MAX + IMPACT_MAX;
    return Math.round((allWeighted / totalMax) * 100);
  }, [symptomsScore, activityScore, impactScore, symptomsR, activityR, impactR]);

  // ── Progress ──────────────────────────────────────────────────────────────

  const symptomsAnswered = SYMPTOMS_QUESTIONS.filter(q => symptomsR[q.id] !== undefined).length;
  const activityAnswered = ACTIVITY_ITEMS.filter(i => activityR[i.id] !== undefined).length;
  const impactAnswered = IMPACT_ITEMS.filter(i => impactR[i.id] !== undefined).length;
  const totalItems = SYMPTOMS_QUESTIONS.length + ACTIVITY_ITEMS.length + IMPACT_ITEMS.length;
  const totalAnswered = symptomsAnswered + activityAnswered + impactAnswered;
  const progressPct = Math.round((totalAnswered / totalItems) * 100);

  const isComplete = symptomsScore !== null;

  // ── Interpretation ────────────────────────────────────────────────────────

  const interpretation = useMemo(() => {
    if (totalScore === null) return null;
    const diagStr = diagnosis ? ` in the context of ${diagnosis}` : "";
    const dominated = [
      { label: "Symptoms", score: symptomsScore },
      { label: "Activity", score: activityScore },
      { label: "Impact", score: impactScore },
    ].sort((a, b) => b.score - a.score)[0];

    if (totalScore <= 25) {
      return {
        level: "Mild Respiratory Impact",
        color: "text-green-700", bg: "bg-green-50 border-green-200",
        narrative: `SGRQ total score of ${totalScore}/100 indicates mild respiratory-related health status limitation${diagStr}. Patient-reported symptoms, activity, and psychosocial impact are relatively preserved. Monitor for any functional decline and reassess periodically.`
      };
    }
    if (totalScore <= 50) {
      return {
        level: "Moderate Respiratory Impact",
        color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200",
        narrative: `SGRQ total score of ${totalScore}/100 indicates moderate respiratory disease burden${diagStr}. The highest burden domain is ${dominated.label} (${dominated.score}/100). Targeted intervention in exercise tolerance and symptom management is recommended. A score change of ≥4 points is the MCID for clinically meaningful improvement.`
      };
    }
    if (totalScore <= 75) {
      return {
        level: "High Respiratory Burden",
        color: "text-orange-700", bg: "bg-orange-50 border-orange-200",
        narrative: `SGRQ total score of ${totalScore}/100 indicates significant respiratory-related quality-of-life limitation${diagStr}, particularly affecting ${dominated.label.toLowerCase()} (${dominated.score}/100). Pulmonary rehabilitation, supervised exercise programming, and multidisciplinary review are strongly indicated.`
      };
    }
    return {
      level: "Severe Respiratory Impairment",
      color: "text-red-700", bg: "bg-red-50 border-red-200",
      narrative: `SGRQ total score of ${totalScore}/100 indicates severe respiratory health status impairment${diagStr}. Extensive activity limitation and psychosocial burden are present. Urgent specialist review, optimised pharmacotherapy, and structured pulmonary rehabilitation are recommended.`
    };
  }, [totalScore, symptomsScore, activityScore, impactScore, diagnosis]);

  // ── Flags ─────────────────────────────────────────────────────────────────

  const flags = useMemo(() => {
    if (totalScore === null) return [];
    const f = [];
    if (totalScore > 25) f.push("Significant respiratory quality-of-life burden identified");
    if (activityScore !== null && activityScore > 50) f.push("Reduced activity tolerance — exercise prescription indicated");
    if (impactScore !== null && impactScore > 50) f.push("Psychosocial respiratory impact — consider psychological support");
    if (symptomsScore !== null && symptomsScore > 60) f.push("Elevated symptom burden — pharmacotherapy review recommended");
    if (totalScore > 40) f.push("Pulmonary rehabilitation candidate");
    if (totalScore > 50) f.push("Consider referral for specialist respiratory review");
    if (oxygenUse) f.push("Patient on supplemental oxygen — monitor exercise safety carefully");
    if (exacerbations && parseInt(exacerbations) >= 2) f.push("Frequent exacerbations — high-risk profile for decline");
    if (activityScore !== null && activityScore > 75) f.push("Severe dyspnoea-driven functional limitation — exercise assessment required");
    return f;
  }, [totalScore, activityScore, impactScore, symptomsScore, oxygenUse, exacerbations]);

  // ── SOAP ──────────────────────────────────────────────────────────────────

  const buildSOAP = () => {
    const lines = [
      `• St George's Respiratory Questionnaire (SGRQ)`,
      ``,
      `  Domain Scores:`,
      `    Symptoms: ${symptomsScore !== null ? `${symptomsScore}/100 (${domainLabel(symptomsScore)})` : "Incomplete"}`,
      `    Activity: ${activityScore !== null ? `${activityScore}/100 (${domainLabel(activityScore)})` : "Incomplete"}`,
      `    Impact:   ${impactScore !== null ? `${impactScore}/100 (${domainLabel(impactScore)})` : "Incomplete"}`,
      `    Total:    ${totalScore !== null ? `${totalScore}/100 (${domainLabel(totalScore)})` : "Incomplete"}`,
      ``,
      interpretation ? `  Interpretation: ${interpretation.level}` : null,
      interpretation ? `  ${interpretation.narrative}` : null,
      ``,
      flags.length ? `  Clinical Flags:` : null,
      ...flags.map(f => `    ⚑ ${f}`),
      ``,
      diagnosis ? `  Primary Diagnosis: ${diagnosis}` : null,
      smokingStatus ? `  Smoking Status: ${smokingStatus}` : null,
      oxygenUse !== null ? `  Oxygen Use: ${oxygenUse ? "Yes" : "No"}` : null,
      exacerbations ? `  Exacerbations (last year): ${exacerbations}` : null,
      ``,
      notes ? `  Clinical Notes: ${notes}` : null,
      ``,
      `  References: Jones PW et al. (1991) Respir Med; MCID ≥4 points (Jones PW 2005 COPD J); Schäfer et al. Manual Therapy.`,
    ].filter(v => v !== null).join('\n');
    return lines;
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!isComplete) {
      toast.error("Complete all questionnaire domains before saving.");
      return;
    }
    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        measurement_type: "sgrq",
        symptoms_score: symptomsScore,
        activity_score: activityScore,
        impact_score: impactScore,
        total_score: totalScore,
        symptoms_responses: symptomsR,
        activity_responses: activityR,
        impact_responses: impactR,
        diagnosis,
        smoking_status: smokingStatus,
        oxygen_use: oxygenUse,
        exacerbations,
        rehab,
        admin_mode: adminMode,
        interpretation: interpretation?.level,
        interpretation_narrative: interpretation?.narrative,
        clinical_flags: flags,
        soap_text: buildSOAP(),
      },
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("SGRQ saved successfully.");
  };

  const handleReset = () => {
    setDiagnosis(""); setSmokingStatus(""); setOxygenUse(null); setExacerbations(""); setRehab(null); setAdminMode("");
    setSymptomsR({}); setActivityR({}); setImpactR({}); setNotes("");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">

        {/* Sticky Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 z-10 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">St George's Respiratory Questionnaire</h1>
            <p className="text-sm text-slate-500 mt-0.5">SGRQ — Health-related quality of life in respiratory disease</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Sticky progress + score panel */}
        <div className="sticky top-[73px] bg-slate-50 border-b border-slate-200 px-6 py-3 z-10 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-20 flex-shrink-0">Progress</span>
            <Progress value={progressPct} className="flex-1 h-2" />
            <span className="text-xs font-semibold text-slate-700 w-12 text-right">{totalAnswered}/{totalItems}</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <ScorePill label="Symptoms" score={symptomsScore} />
            <ScorePill label="Activity" score={activityScore} />
            <ScorePill label="Impact" score={impactScore} />
            <ScorePill label="Total" score={totalScore} />
          </div>
        </div>

        <div className="p-6 space-y-5">

          {/* ── SECTION 1: Overview ── */}
          <Collapsible open={open.overview} onOpenChange={() => tog("overview")}>
            <CollapsibleTrigger className="w-full text-left">
              <SectionHeader icon={Info} title="1. Assessment Overview" color="slate"
                subtitle="SGRQ — 0–100 scale. Higher = worse health status." />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-sm">
                <p className="text-slate-700"><strong>Purpose:</strong> Measure the impact of chronic respiratory disease on health-related quality of life across three domains: Symptoms, Activity, and Impact (psychosocial).</p>
                <div className="flex flex-wrap gap-2">
                  {["COPD", "Asthma", "ILD", "Pulmonary Rehab", "Chronic Respiratory", "DVA", "Medicare", "NDIS", "Cardiopulmonary Rehab"].map(c => (
                    <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="bg-green-100 border border-green-300 rounded p-2 text-center"><p className="font-semibold text-green-800">0–25</p><p className="text-green-700">Mild</p></div>
                  <div className="bg-yellow-100 border border-yellow-300 rounded p-2 text-center"><p className="font-semibold text-yellow-800">26–50</p><p className="text-yellow-700">Moderate</p></div>
                  <div className="bg-orange-100 border border-orange-300 rounded p-2 text-center"><p className="font-semibold text-orange-800">51–75</p><p className="text-orange-700">High</p></div>
                  <div className="bg-red-100 border border-red-300 rounded p-2 text-center"><p className="font-semibold text-red-800">76–100</p><p className="text-red-700">Severe</p></div>
                </div>
                <p className="text-xs text-blue-800 bg-blue-50 border border-blue-100 rounded p-2">
                  <strong>MCID:</strong> A change of ≥4 points is the minimum clinically important difference for the SGRQ total score (Jones PW, 2005).
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTION 2: Instructions ── */}
          <div className="bg-blue-600 text-white rounded-lg px-4 py-3 text-sm">
            <p className="font-semibold mb-2">💬 2. Clinician Instructions</p>
            <ul className="space-y-1 text-blue-100 text-xs list-disc list-inside">
              <li>Ask patient to answer based on their <strong>typical respiratory experience over the past year</strong></li>
              <li>All questions must be completed — missing items invalidate domain scoring</li>
              <li>Higher scores indicate greater impairment in that domain</li>
              <li>Each domain is <strong>independently weighted</strong> — do not average manually</li>
              <li>Familiar symptoms should be linked to their respiratory condition, not unrelated illness</li>
              <li>Mode: Clinician-administered or self-report both valid</li>
            </ul>
          </div>

          {/* ── SECTION 3: Setup ── */}
          <Collapsible open={open.setup} onOpenChange={() => tog("setup")}>
            <CollapsibleTrigger className="w-full text-left">
              <SectionHeader icon={Activity} title="3. Questionnaire Setup" color="blue" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Primary Respiratory Diagnosis</Label>
                  <Input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="e.g. COPD, Asthma, ILD, Bronchiectasis..." />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Smoking Status</Label>
                  <div className="flex flex-wrap gap-2">
                    {["Current smoker", "Ex-smoker", "Never smoked"].map(s => (
                      <button key={s} type="button" onClick={() => setSmokingStatus(s)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${smokingStatus === s ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>{s}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Supplemental Oxygen Use?</Label>
                  <div className="flex gap-2">
                    {[{ v: true, l: "Yes" }, { v: false, l: "No" }].map(({ v, l }) => (
                      <button key={String(v)} type="button" onClick={() => setOxygenUse(v)}
                        className={`text-sm px-4 py-1.5 rounded border font-medium transition-colors ${oxygenUse === v ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 hover:bg-slate-50 text-slate-700"}`}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Exacerbations in last year</Label>
                  <Input type="number" min="0" value={exacerbations} onChange={e => setExacerbations(e.target.value)} placeholder="0" className="w-20" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">In pulmonary rehabilitation?</Label>
                  <div className="flex gap-2">
                    {[{ v: true, l: "Yes" }, { v: false, l: "No" }].map(({ v, l }) => (
                      <button key={String(v)} type="button" onClick={() => setRehab(v)}
                        className={`text-sm px-4 py-1.5 rounded border font-medium transition-colors ${rehab === v ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 hover:bg-slate-50 text-slate-700"}`}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Administration Mode</Label>
                  <div className="flex gap-2">
                    {["Clinician-administered", "Self-report", "Caregiver-assisted"].map(m => (
                      <button key={m} type="button" onClick={() => setAdminMode(m)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${adminMode === m ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>{m}</button>
                    ))}
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTION 4: Symptoms Domain ── */}
          <Collapsible open={open.symptoms} onOpenChange={() => tog("symptoms")}>
            <CollapsibleTrigger className="w-full text-left">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <SectionHeader icon={Wind} title={`4. Symptoms Domain (${symptomsAnswered}/${SYMPTOMS_QUESTIONS.length} answered)`} color="teal"
                    subtitle="Frequency and severity of respiratory symptoms over the past year" />
                </div>
                {symptomsScore !== null && (
                  <div className="bg-teal-700 text-white text-sm font-bold px-3 py-1 rounded-lg flex-shrink-0">{symptomsScore}/100</div>
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 space-y-4">
                {SYMPTOMS_QUESTIONS.map((q, qi) => (
                  <Card key={q.id} className={`border-2 transition-colors ${symptomsR[q.id] !== undefined ? "border-teal-300" : "border-slate-200"}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${symptomsR[q.id] !== undefined ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                          {symptomsR[q.id] !== undefined ? "✓" : qi + 1}
                        </div>
                        <p className="text-sm font-medium text-slate-800">{q.text}{q.optional && <span className="ml-1 text-xs text-slate-400">(optional)</span>}</p>
                      </div>
                      <RadioButtons
                        options={q.options}
                        value={symptomsR[q.id]}
                        onChange={idx => setSymptomsR(p => ({ ...p, [q.id]: idx }))}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTION 5: Activity Domain ── */}
          <Collapsible open={open.activity} onOpenChange={() => tog("activity")}>
            <CollapsibleTrigger className="w-full text-left">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <SectionHeader icon={Activity} title={`5. Activity Domain (${activityAnswered}/${ACTIVITY_ITEMS.length} answered)`} color="purple"
                    subtitle="Activities that cause or are limited by breathlessness" />
                </div>
                {activityScore !== null && (
                  <div className="bg-purple-700 text-white text-sm font-bold px-3 py-1 rounded-lg flex-shrink-0">{activityScore}/100</div>
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2.5 mb-3 text-xs text-purple-800">
                  <strong>Instructions:</strong> For each activity below, indicate whether it causes you to feel breathless or is limited by your breathing.
                </div>
                <div className="space-y-2">
                  {ACTIVITY_ITEMS.map(item => (
                    <label key={item.id} className={`flex items-center gap-3 cursor-pointer text-sm p-3 rounded-lg border transition-colors ${
                      activityR[item.id] === true ? "bg-purple-50 border-purple-300 text-purple-900" :
                      activityR[item.id] === false ? "bg-green-50 border-green-300 text-green-900" :
                      "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}>
                      <Checkbox
                        checked={activityR[item.id] === true}
                        onCheckedChange={v => setActivityR(p => ({ ...p, [item.id]: v === true }))}
                      />
                      <span className="flex-1">{item.text}</span>
                      {activityR[item.id] === undefined && (
                        <button type="button" onClick={() => setActivityR(p => ({ ...p, [item.id]: false }))}
                          className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded px-2 py-0.5">
                          Not limited
                        </button>
                      )}
                      {activityR[item.id] === false && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">Check items that cause breathlessness. Click "Not limited" for activities that do not affect you.</p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTION 6: Impact Domain ── */}
          <Collapsible open={open.impact} onOpenChange={() => tog("impact")}>
            <CollapsibleTrigger className="w-full text-left">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <SectionHeader icon={AlertCircle} title={`6. Impact Domain (${impactAnswered}/${IMPACT_ITEMS.length} answered)`} color="indigo"
                    subtitle="Psychosocial and functional effects of respiratory disease" />
                </div>
                {impactScore !== null && (
                  <div className="bg-indigo-700 text-white text-sm font-bold px-3 py-1 rounded-lg flex-shrink-0">{impactScore}/100</div>
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3">
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5 mb-3 text-xs text-indigo-800">
                  <strong>Instructions:</strong> Select each statement that is <strong>true for you</strong> in relation to your respiratory condition. Leave unchecked if the statement does not apply.
                </div>
                <div className="space-y-2">
                  {IMPACT_ITEMS.map(item => (
                    <label key={item.id} className={`flex items-center gap-3 cursor-pointer text-sm p-3 rounded-lg border transition-colors ${
                      impactR[item.id] === true ? "bg-indigo-50 border-indigo-300 text-indigo-900" :
                      impactR[item.id] === false ? "bg-slate-50 border-slate-200 text-slate-500" :
                      "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}>
                      <Checkbox
                        checked={impactR[item.id] === true}
                        onCheckedChange={v => setImpactR(p => ({ ...p, [item.id]: v === true }))}
                      />
                      <span className="flex-1">{item.text}</span>
                      {impactR[item.id] === undefined && (
                        <button type="button" onClick={() => setImpactR(p => ({ ...p, [item.id]: false }))}
                          className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded px-2 py-0.5">
                          Not true
                        </button>
                      )}
                      {impactR[item.id] === false && <span className="text-xs text-slate-400">Not true</span>}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">Check all that are true. Click "Not true" for statements that don't apply.</p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTION 7–11: Scores + Interpretation + Flags ── */}
          {isComplete && interpretation && (
            <div className="space-y-4">

              {/* Score breakdown */}
              <div className="bg-slate-800 text-white rounded-xl p-5">
                <p className="text-sm font-medium text-slate-300 mb-3">Domain Score Breakdown</p>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[
                    { label: "Symptoms", score: symptomsScore, desc: "Frequency & severity of respiratory symptoms" },
                    { label: "Activity", score: activityScore, desc: "Activities limited by breathlessness" },
                    { label: "Impact", score: impactScore, desc: "Psychosocial & functional effects" },
                  ].map(({ label, score, desc }) => (
                    <div key={label} className="text-center">
                      <p className="text-slate-400 text-xs mb-1">{label}</p>
                      <p className="text-2xl font-bold">{score}</p>
                      <p className="text-xs text-slate-300">/100 — {domainLabel(score)}</p>
                      <p className="text-xs text-slate-400 mt-1 leading-tight">{desc}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-700 pt-3 text-center">
                  <p className="text-slate-300 text-sm">Total SGRQ Score</p>
                  <p className="text-4xl font-bold mt-1">{totalScore} <span className="text-xl text-slate-400">/ 100</span></p>
                  <p className={`text-sm font-semibold mt-1 ${
                    totalScore <= 25 ? "text-green-400" : totalScore <= 50 ? "text-yellow-400" : totalScore <= 75 ? "text-orange-400" : "text-red-400"
                  }`}>{interpretation.level}</p>
                </div>
              </div>

              {/* Interpretation */}
              <div className={`${interpretation.bg} border rounded-xl p-4`}>
                <p className={`font-semibold ${interpretation.color} mb-2 flex items-center gap-2`}>
                  <Info className="w-4 h-4" /> Clinical Interpretation
                </p>
                <p className="text-sm text-slate-800 leading-relaxed">{interpretation.narrative}</p>
              </div>

              {/* Score severity scale visual */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-600 mb-2">SGRQ Score Severity Scale</p>
                <div className="relative h-5 rounded-full overflow-hidden flex">
                  <div className="bg-green-300 flex-1 flex items-center justify-center text-xs font-bold text-green-900">Mild</div>
                  <div className="bg-yellow-300 flex-1 flex items-center justify-center text-xs font-bold text-yellow-900">Moderate</div>
                  <div className="bg-orange-300 flex-1 flex items-center justify-center text-xs font-bold text-orange-900">High</div>
                  <div className="bg-red-400 flex-1 flex items-center justify-center text-xs font-bold text-red-900">Severe</div>
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-1 px-1">
                  <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
                </div>
                {totalScore !== null && (
                  <div className="relative h-1 mt-1">
                    <div className="absolute w-3 h-3 bg-slate-800 rounded-full -top-1"
                      style={{ left: `calc(${totalScore}% - 6px)` }} />
                  </div>
                )}
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
              placeholder="Clinical context, response patterns, unusual findings, comparison with prior scores, functional goals..."
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
                  { text: "Jones PW, Quirk FH, Baveystock CM, Littlejohns P. A self-complete measure of health status for chronic airflow limitation: the St. George's Respiratory Questionnaire. Am Rev Respir Dis. 1992;145(6):1321–1327.", url: "https://pubmed.ncbi.nlm.nih.gov/1595997/" },
                  { text: "Jones PW. St. George's Respiratory Questionnaire: MCID. COPD. 2005;2(1):75–79.", url: "https://pubmed.ncbi.nlm.nih.gov/17136966/" },
                  { text: "Meguro M, Barley EA, Spencer S, Jones PW. Development and validation of an improved, COPD-specific version of the St. George Respiratory Questionnaire. Chest. 2007;132(2):456–463.", url: "https://pubmed.ncbi.nlm.nih.gov/17646240/" },
                  { text: "Wilson CB, Jones PW, O'Leary CJ, Hansell DM, Cole PJ, Wilson R. Validation of the St. George's Respiratory Questionnaire in bronchiectasis. Am J Respir Crit Care Med. 1997;156(2 Pt 1):536–541.", url: "https://pubmed.ncbi.nlm.nih.gov/9279236/" },
                  { text: "American Thoracic Society. ATS Statement: Guidelines for the Six-Minute Walk Test. Am J Respir Crit Care Med. 2002;166(1):111–117. [Context: respiratory QoL alongside functional testing]", url: "https://pubmed.ncbi.nlm.nih.gov/12091180/" },
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
            {!isComplete && (
              <p className="text-xs text-slate-500 flex-1 text-center">
                {totalItems - totalAnswered} item{totalItems - totalAnswered !== 1 ? "s" : ""} remaining before saving.
              </p>
            )}
            <Button onClick={handleSave} disabled={!isComplete} className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-2" />Save SGRQ
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}