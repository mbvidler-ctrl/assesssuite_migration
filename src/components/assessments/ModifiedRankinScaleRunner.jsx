import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { X, Save, Info, CheckCircle2, ChevronDown, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";

// ─── Grade definitions ────────────────────────────────────────────────────────
const MRS_GRADES = [
  { score: 0, label: "No symptoms", description: "No symptoms at all.", color: "green" },
  { score: 1, label: "No significant disability", description: "No significant disability despite symptoms; able to carry out all usual duties and activities.", color: "teal" },
  { score: 2, label: "Slight disability", description: "Unable to carry out all previous activities, but able to look after own affairs without assistance.", color: "yellow" },
  { score: 3, label: "Moderate disability", description: "Requiring some help, but able to walk without assistance.", color: "orange" },
  { score: 4, label: "Moderately severe disability", description: "Unable to walk without assistance and unable to attend to own bodily needs without assistance.", color: "red" },
  { score: 5, label: "Severe disability", description: "Bedridden, incontinent, and requiring constant nursing care and attention.", color: "rose" },
  { score: 6, label: "Dead", description: "Deceased.", color: "slate" },
];

const gradeColorMap = {
  green:  { border: "border-green-400",  bg: "bg-green-50",  text: "text-green-800",  badge: "bg-green-100 text-green-800" },
  teal:   { border: "border-teal-400",   bg: "bg-teal-50",   text: "text-teal-800",   badge: "bg-teal-100 text-teal-800" },
  yellow: { border: "border-yellow-400", bg: "bg-yellow-50", text: "text-yellow-800", badge: "bg-yellow-100 text-yellow-800" },
  orange: { border: "border-orange-400", bg: "bg-orange-50", text: "text-orange-800", badge: "bg-orange-100 text-orange-800" },
  red:    { border: "border-red-400",    bg: "bg-red-50",    text: "text-red-800",    badge: "bg-red-100 text-red-800" },
  rose:   { border: "border-rose-400",   bg: "bg-rose-50",   text: "text-rose-800",   badge: "bg-rose-100 text-rose-800" },
  slate:  { border: "border-slate-400",  bg: "bg-slate-100", text: "text-slate-700",  badge: "bg-slate-200 text-slate-700" },
};

// ─── Interview questions ──────────────────────────────────────────────────────
const INTERVIEW_QUESTIONS = [
  { id: "walk_independently",    label: "Can the client walk independently?" },
  { id: "needs_gait_aid",        label: "Does the client require a gait aid?" },
  { id: "needs_dressing_help",   label: "Does the client need help with dressing?" },
  { id: "needs_bathing_help",    label: "Does the client need help with bathing/showering?" },
  { id: "needs_toileting_help",  label: "Does the client need help with toileting?" },
  { id: "needs_meals_help",      label: "Does the client need help preparing meals?" },
  { id: "leave_home_independently", label: "Can the client leave the home independently?" },
  { id: "manage_medications",    label: "Can the client manage medications independently?" },
  { id: "manage_appointments",   label: "Can the client manage appointments/finances independently?" },
  { id: "return_to_previous",    label: "Can the client return to previous work, usual duties, or hobbies?" },
  { id: "needs_supervision",     label: "Does the client require supervision for safety?" },
  { id: "needs_constant_care",   label: "Does the client require constant nursing/care support?" },
];

// ─── Observation checkboxes ───────────────────────────────────────────────────
const OBSERVATIONS = [
  "Independent transfers observed",
  "Ambulates independently",
  "Uses gait aid",
  "Requires verbal cueing",
  "Requires physical assistance",
  "Communication impairment observed",
  "Cognitive impairment observed",
  "Fatigue limits function",
  "Balance impairment observed",
  "Falls risk concern identified",
];

// ─── Score suggestion logic ───────────────────────────────────────────────────
function suggestGrade(interview) {
  const yes = (k) => interview[k] === "yes";
  const no  = (k) => interview[k] === "no";

  const allAnswered = INTERVIEW_QUESTIONS.every(q => interview[q.id]);
  if (!allAnswered) return null;

  if (yes("needs_constant_care")) return 5;
  if (no("walk_independently") && yes("needs_bathing_help") && yes("needs_toileting_help")) return 4;
  if (yes("needs_gait_aid") || yes("needs_dressing_help") || yes("needs_bathing_help") || yes("needs_toileting_help") || yes("needs_supervision")) return 3;
  if (no("return_to_previous") && yes("walk_independently") && no("needs_bathing_help") && no("needs_dressing_help")) return 2;
  if (yes("walk_independently") && yes("return_to_previous") && no("needs_dressing_help") && no("needs_supervision")) return 1;
  if (yes("walk_independently") && yes("return_to_previous") && no("needs_gait_aid") && no("needs_dressing_help") && no("needs_bathing_help") && no("needs_toileting_help") && no("needs_supervision") && no("needs_constant_care")) return 0;
  return null;
}

// ─── Risk flags ───────────────────────────────────────────────────────────────
function getRiskFlags(interview, observations) {
  const flags = [];
  if (interview["needs_supervision"] === "yes" || observations.includes("Falls risk concern identified") || observations.includes("Balance impairment observed")) flags.push("⚠ Falls risk concern");
  if (interview["needs_dressing_help"] === "yes" || interview["needs_bathing_help"] === "yes" || interview["needs_toileting_help"] === "yes") flags.push("👤 Carer/support needs identified");
  if (observations.includes("Falls risk concern identified") || observations.includes("Balance impairment observed")) flags.push("🏠 Home safety review may be required");
  if (observations.includes("Balance impairment observed") || observations.includes("Fatigue limits function") || interview["needs_gait_aid"] === "yes") flags.push("🩺 Physiotherapy/OT referral may be appropriate");
  return flags;
}

// ─── YNU toggle ──────────────────────────────────────────────────────────────
function YNUToggle({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {["yes", "no", "unable"].map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all
            ${value === opt
              ? opt === "yes" ? "bg-green-600 border-green-600 text-white"
                : opt === "no" ? "bg-red-500 border-red-500 text-white"
                : "bg-slate-500 border-slate-500 text-white"
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
        >
          {opt === "unable" ? "?" : opt.charAt(0).toUpperCase() + opt.slice(1)}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ModifiedRankinScaleRunner({ client, onSave, onClose }) {
  const [interview, setInterview]       = useState({});
  const [observations, setObservations] = useState([]);
  const [context, setContext]           = useState({ diagnosis: "", eventDate: "", affectedSide: "", livingSituation: "", supports: "", previousScore: "", previousScoreDate: "" });
  const [clinicalReasoning, setClinicalReasoning] = useState("");
  const [selectedScore, setSelectedScore] = useState(null);
  const [showClinician, setShowClinician]   = useState(true);
  const [showNormatives, setShowNormatives] = useState(false);
  const [showReferences, setShowReferences] = useState(false);

  const suggestedGrade = useMemo(() => suggestGrade(interview), [interview]);
  const riskFlags = useMemo(() => getRiskFlags(interview, observations), [interview, observations]);

  const prevScore = context.previousScore !== "" ? parseInt(context.previousScore) : null;
  const scoreChange = (selectedScore !== null && prevScore !== null && !isNaN(prevScore))
    ? selectedScore - prevScore : null;

  const changeLabel = scoreChange === null ? null
    : scoreChange < 0 ? "Improved"
    : scoreChange > 0 ? "Worsened"
    : "Unchanged";

  const selectedGradeInfo = selectedScore !== null ? MRS_GRADES.find(g => g.score === selectedScore) : null;

  // ─── Auto-report text ──────────────────────────────────────────────────────
  const reportText = selectedGradeInfo ? (() => {
    const walkStr = interview.walk_independently === "yes" ? "walks independently"
      : interview.walk_independently === "no" ? "does not walk independently" : "walking status unclear";
    const careStr = (interview.needs_bathing_help === "yes" || interview.needs_dressing_help === "yes" || interview.needs_toileting_help === "yes")
      ? "requires personal care assistance" : "is independent in personal care";
    const supStr = interview.needs_supervision === "yes" ? "requires supervision for safety" : "does not require supervision";
    return `Modified Rankin Scale score: ${selectedScore}/6. This indicates ${selectedGradeInfo.label.toLowerCase()}. The client ${walkStr}, ${careStr}, and ${supStr}. Clinical reasoning: ${clinicalReasoning || "(not provided)"}`;
  })() : "";

  // ─── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (selectedScore === null) { toast.error("Please select a final disability grade."); return; }
    if (!clinicalReasoning.trim()) { toast.error("Clinical reasoning is required before saving."); return; }

    const interviewSummary = INTERVIEW_QUESTIONS
      .filter(q => interview[q.id])
      .map(q => `    ${q.label}: ${interview[q.id]}`)
      .join("\n");

    const obsSummary = observations.length ? observations.map(o => `    ✓ ${o}`).join("\n") : "    None recorded";

    const soapText = [
      `• Modified Rankin Scale (mRS): Grade ${selectedScore}/6 — ${selectedGradeInfo.label}`,
      `  ${selectedGradeInfo.description}`,
      suggestedGrade !== null ? `  Suggested Grade (logic): ${suggestedGrade} — clinician confirmed: ${selectedScore}` : null,
      scoreChange !== null ? `  Change from previous score (${prevScore}): ${scoreChange > 0 ? "+" : ""}${scoreChange} grade(s) — ${changeLabel}` : null,
      ``,
      `  Structured Interview:`,
      interviewSummary || "    Not completed",
      ``,
      `  Observations:`,
      obsSummary,
      context.diagnosis ? `  Primary diagnosis: ${context.diagnosis}` : null,
      context.eventDate ? `  Event date: ${context.eventDate}` : null,
      context.affectedSide ? `  Affected side: ${context.affectedSide}` : null,
      context.livingSituation ? `  Living situation: ${context.livingSituation}` : null,
      context.supports ? `  Supports/carers: ${context.supports}` : null,
      riskFlags.length ? `\n  Risk Flags:\n${riskFlags.map(f => `    ${f}`).join("\n")}` : null,
      ``,
      `  Clinical reasoning: ${clinicalReasoning}`,
      ``,
      `  Report: ${reportText}`,
    ].filter(l => l !== null).join("\n");

    onSave({
      result_value: selectedScore,
      additional_data: {
        soap_text: soapText,
        grade: selectedScore,
        label: selectedGradeInfo.label,
        suggested_grade: suggestedGrade,
        previous_score: prevScore,
        score_change: scoreChange,
        change_label: changeLabel,
        interview_responses: interview,
        observations,
        clinical_context: context,
        clinical_reasoning: clinicalReasoning,
        risk_flags: riskFlags,
        report_text: reportText,
        measurement_type: "modified_rankin",
      },
      notes: clinicalReasoning,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Modified Rankin Scale saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Modified Rankin Scale (mRS)</h2>
            <p className="text-slate-600 text-sm mt-0.5">Clinician-guided functional disability assessment</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Client info */}
          {client && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-700">
              <span className="font-medium">Client:</span> {client.full_name}
              {client.date_of_birth && <span className="ml-3 text-slate-500">DOB: {new Date(client.date_of_birth).toLocaleDateString("en-AU")}</span>}
            </div>
          )}

          {/* Clinician Instructions */}
          <Collapsible open={showClinician} onOpenChange={setShowClinician}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg font-semibold text-blue-900 text-sm hover:bg-blue-100 transition-colors">
              <ChevronDown className={`w-4 h-4 transition-transform ${showClinician ? "rotate-180" : ""}`} />
              <Info className="w-4 h-4" /> Clinician Instructions
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
              <p>Complete the structured interview and observation checklist, then select the clinician-confirmed final grade. The system will suggest a grade based on your responses, but <strong>the final score must always be clinician-confirmed</strong>.</p>
              <p className="italic">"I'm going to ask you about your ability to perform daily activities. Please describe what you can and cannot do without help."</p>
              <p><strong>Key criterion:</strong> Grade 0–2 = independent living. Grade 3 = needs some help but independent in personal care and walking. Grade 4–5 = dependent on others. Grade 6 = death.</p>
            </CollapsibleContent>
          </Collapsible>

          {/* Score Interpretation Table */}
          <Collapsible open={showNormatives} onOpenChange={setShowNormatives}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 text-sm hover:bg-slate-100 transition-colors">
              <ChevronDown className={`w-4 h-4 transition-transform ${showNormatives ? "rotate-180" : ""}`} />
              📊 Score Interpretation
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200">
                    <tr><th className="p-2 text-left">Score</th><th className="p-2 text-left">Disability</th><th className="p-2 text-left">Discharge Implication</th></tr>
                  </thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">0–1</td><td className="p-2 text-green-700">No/minimal disability</td><td className="p-2">Community — no support needed</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">2</td><td className="p-2 text-teal-700">Slight disability</td><td className="p-2">Community with some support</td></tr>
                    <tr className="border-t"><td className="p-2">3</td><td className="p-2 text-yellow-700">Moderate disability</td><td className="p-2">Needs carer support</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">4–5</td><td className="p-2 text-red-700">Severe disability</td><td className="p-2">Institutional or high-level care</td></tr>
                    <tr className="border-t"><td className="p-2">6</td><td className="p-2 text-slate-600">Deceased</td><td className="p-2">—</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 mt-2">MCID: 1 grade point. Widely used stroke outcome measure. Source: Rankin (1957); van Swieten et al. (1988).</p>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTION 1: Clinical Context ─────────────────────────────────── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-3 font-semibold text-slate-800 text-sm">1. Clinical Context (Optional)</div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                { key: "diagnosis",         label: "Primary diagnosis / reason for assessment" },
                { key: "eventDate",         label: "Date of neurological event/stroke",        type: "date" },
                { key: "affectedSide",      label: "Affected side",                            placeholder: "e.g. Left, Right, Bilateral" },
                { key: "livingSituation",   label: "Living situation",                         placeholder: "e.g. Lives alone, with family" },
                { key: "supports",          label: "Current supports/carers" },
                { key: "previousScore",     label: "Previous mRS score (if known)",            type: "number", placeholder: "0–6" },
                { key: "previousScoreDate", label: "Date of previous score",                   type: "date" },
              ].map(({ key, label, type = "text", placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">{label}</label>
                  <Input
                    type={type}
                    placeholder={placeholder || label}
                    value={context[key]}
                    min={type === "number" ? 0 : undefined}
                    max={type === "number" ? 6 : undefined}
                    onChange={e => setContext(prev => ({ ...prev, [key]: e.target.value }))}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── SECTION 2: Structured Interview ─────────────────────────────── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-indigo-50 px-4 py-3 font-semibold text-indigo-900 text-sm">2. Structured Interview</div>
            <div className="divide-y divide-slate-100">
              {INTERVIEW_QUESTIONS.map(q => (
                <div key={q.id} className="flex items-center justify-between px-4 py-3 gap-4">
                  <span className="text-sm text-slate-800 flex-1">{q.label}</span>
                  <YNUToggle value={interview[q.id]} onChange={val => setInterview(prev => ({ ...prev, [q.id]: val }))} />
                </div>
              ))}
            </div>
          </div>

          {/* ── SECTION 3: Observation Checklist ────────────────────────────── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-teal-50 px-4 py-3 font-semibold text-teal-900 text-sm">3. Clinical Observation Checklist</div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OBSERVATIONS.map(obs => (
                <label key={obs} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1.5 rounded">
                  <input
                    type="checkbox"
                    checked={observations.includes(obs)}
                    onChange={e => setObservations(prev => e.target.checked ? [...prev, obs] : prev.filter(o => o !== obs))}
                    className="w-4 h-4 accent-teal-600"
                  />
                  <span className="text-slate-700">{obs}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Suggested Grade ──────────────────────────────────────────────── */}
          {suggestedGrade !== null && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-amber-900">
                <AlertTriangle className="w-4 h-4" />
                Score Guidance
              </div>
              <p className="text-sm text-amber-800">
                Based on interview responses: <strong>Suggested Grade {suggestedGrade}</strong> — {MRS_GRADES[suggestedGrade].description}
              </p>
              <p className="text-xs text-amber-700 font-medium italic">Suggested Grade Only – clinician must confirm final score below.</p>
              <Button size="sm" variant="outline" className="mt-1 text-xs border-amber-400 text-amber-800 hover:bg-amber-100" onClick={() => setSelectedScore(suggestedGrade)}>
                Apply Suggested Grade {suggestedGrade}
              </Button>
            </div>
          )}

          {/* ── Risk Flags ───────────────────────────────────────────────────── */}
          {riskFlags.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
              <p className="font-semibold text-red-900 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Risk & Referral Flags</p>
              <div className="space-y-1">
                {riskFlags.map(flag => (
                  <p key={flag} className="text-sm text-red-800">{flag}</p>
                ))}
              </div>
            </div>
          )}

          {/* ── SECTION 4: Grade Selection ───────────────────────────────────── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-3 font-semibold text-slate-800 text-sm">4. Final Grade Selection (Clinician-Confirmed)</div>
            <div className="p-4 space-y-2">
              {MRS_GRADES.map(grade => {
                const c = gradeColorMap[grade.color];
                const isSelected = selectedScore === grade.score;
                return (
                  <button
                    key={grade.score}
                    onClick={() => setSelectedScore(grade.score)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${isSelected ? `${c.border} ${c.bg}` : "border-slate-200 bg-white hover:border-slate-300"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <span className={`font-bold text-lg w-6 shrink-0 ${isSelected ? c.text : "text-slate-700"}`}>{grade.score}</span>
                        <div>
                          <p className={`font-semibold ${isSelected ? c.text : "text-slate-800"}`}>{grade.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{grade.description}</p>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${c.text}`} />}
                      {suggestedGrade === grade.score && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-800 shrink-0">Suggested</Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Change Over Time ─────────────────────────────────────────────── */}
          {scoreChange !== null && (
            <div className={`rounded-xl p-4 border-2 space-y-1 ${changeLabel === "Improved" ? "bg-green-50 border-green-300" : changeLabel === "Worsened" ? "bg-red-50 border-red-300" : "bg-slate-50 border-slate-300"}`}>
              <p className={`font-semibold text-sm ${changeLabel === "Improved" ? "text-green-900" : changeLabel === "Worsened" ? "text-red-900" : "text-slate-800"}`}>
                Change Over Time
              </p>
              <div className="text-sm space-y-0.5">
                <p>Previous score: <strong>{prevScore}</strong> &nbsp;→&nbsp; Current score: <strong>{selectedScore}</strong></p>
                <p>Change: <strong>{scoreChange > 0 ? "+" : ""}{scoreChange} grade(s)</strong> — <strong>{changeLabel}</strong></p>
                <p className="text-xs text-slate-500 italic">A change of 1 grade may be clinically meaningful depending on context.</p>
              </div>
            </div>
          )}

          {/* ── SECTION 5: Clinical Reasoning ───────────────────────────────── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-3">
              <p className="font-semibold text-slate-800 text-sm">5. Clinical Reasoning for Selected Score <span className="text-red-500">*</span></p>
            </div>
            <div className="p-4">
              <Textarea
                value={clinicalReasoning}
                onChange={e => setClinicalReasoning(e.target.value)}
                placeholder="Explain why this grade was selected, including the client's independence, walking ability, personal care needs, supervision requirements, and support needs."
                rows={5}
              />
            </div>
          </div>

          {/* ── Auto-Generated Report Text ───────────────────────────────────── */}
          {selectedScore !== null && clinicalReasoning.trim() && (
            <div className="border border-indigo-200 rounded-xl overflow-hidden">
              <div className="bg-indigo-50 px-4 py-3 flex items-center gap-2 font-semibold text-indigo-900 text-sm">
                <FileText className="w-4 h-4" /> Auto-Generated Report Text
              </div>
              <div className="p-4">
                <p className="text-sm text-slate-700 italic leading-relaxed">{reportText}</p>
              </div>
            </div>
          )}

          {/* References */}
          <Collapsible open={showReferences} onOpenChange={setShowReferences}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 text-sm hover:bg-slate-100 transition-colors">
              <ChevronDown className={`w-4 h-4 transition-transform ${showReferences ? "rotate-180" : ""}`} />
              📚 References
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs text-slate-600">
              <p>1. Rankin J. (1957). Cerebral vascular accidents in patients over the age of 60. <em>Scottish Medical Journal, 2</em>, 200–215.</p>
              <p>2. van Swieten JC, Koudstaal PJ, Visser MC, Schouten HJA, van Gijn J. (1988). Interobserver agreement for the assessment of handicap in stroke patients. <em>Stroke, 19</em>(5), 604–607.</p>
              <p>3. Wilson JT, Hareendran A, Hendry A, Potter J, Bone I, Muir KW. (2005). Reliability of the modified Rankin Scale across multiple raters and over time. <em>Stroke, 36</em>(4), 777–781.</p>
              <p>4. Quinn TJ, Dawson J, Walters MR, Lees KR. (2009). Reliability of the modified Rankin Scale. <em>Expert Review of Neurotherapeutics, 9</em>(9), 1231–1237.</p>
              <p>5. Banks JL, Marotta CA. (2007). Outcomes validity and reliability of the modified Rankin Scale: implications for stroke clinical trials. <em>Stroke, 38</em>(3), 1091–1096.</p>
            </CollapsibleContent>
          </Collapsible>

        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <p className="text-sm text-slate-500">Final grade must be clinician-confirmed</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" /> Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={selectedScore === null || !clinicalReasoning.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" /> Save Assessment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}