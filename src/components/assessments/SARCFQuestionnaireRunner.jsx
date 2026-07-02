import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Save, X, RotateCcw, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Info, ExternalLink } from "lucide-react";
import { toast } from "sonner";

// â”€â”€â”€ Question Definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const QUESTIONS = [
  {
    id: 1,
    domain: "Strength",
    icon: "ðŸ’ª",
    script: "How much difficulty do you have lifting and carrying 10 pounds (approximately 4.5 kg)?",
    example: "e.g. a heavy shopping bag or a gallon of milk",
    options: [
      { value: 0, label: "None" },
      { value: 1, label: "Some difficulty" },
      { value: 2, label: "A lot of difficulty or unable" },
    ],
  },
  {
    id: 2,
    domain: "Assistance Walking",
    icon: "ðŸš¶",
    script: "How much difficulty do you have walking across a room?",
    example: "e.g. walking from one side of a room to the other without stopping",
    options: [
      { value: 0, label: "None" },
      { value: 1, label: "Some difficulty" },
      { value: 2, label: "A lot of difficulty, use aids, or unable" },
    ],
  },
  {
    id: 3,
    domain: "Rise from Chair",
    icon: "ðŸª‘",
    script: "How much difficulty do you have transferring from a chair or bed?",
    example: "e.g. rising from a chair without using the armrests",
    options: [
      { value: 0, label: "None" },
      { value: 1, label: "Some difficulty" },
      { value: 2, label: "A lot of difficulty or requires assistance" },
    ],
  },
  {
    id: 4,
    domain: "Climb Stairs",
    icon: "ðŸªœ",
    script: "How much difficulty do you have climbing a flight of 10 stairs?",
    example: "e.g. climbing one full flight of stairs indoors",
    options: [
      { value: 0, label: "None" },
      { value: 1, label: "Some difficulty" },
      { value: 2, label: "A lot of difficulty or unable" },
    ],
  },
  {
    id: 5,
    domain: "Falls",
    icon: "âš ï¸",
    script: "How many times have you fallen in the last year?",
    example: "Include any unplanned descent to the ground, regardless of injury",
    options: [
      { value: 0, label: "None" },
      { value: 1, label: "1â€“3 falls" },
      { value: 2, label: "4 or more falls" },
    ],
  },
];

// â”€â”€â”€ Scoring Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getRiskLevel(score) {
  if (score <= 3) return { level: "Low Risk", color: "text-green-700", bg: "bg-green-50", border: "border-green-200", badge: "bg-green-100 text-green-800 border-green-300" };
  if (score <= 7) return { level: "Moderate Risk", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-800 border-amber-300" };
  return { level: "High Risk", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-800 border-red-300" };
}

function getFlags(answers) {
  const q1 = answers[1] ?? null;
  const q2 = answers[2] ?? null;
  const q3 = answers[3] ?? null;
  const q4 = answers[4] ?? null;
  const q5 = answers[5] ?? null;
  const total = Object.values(answers).reduce((s, v) => s + v, 0);

  return {
    sarcopeniaRisk: total >= 4 ? (total >= 8 ? "High" : "Moderate") : "Low",
    fallsRisk: q5 !== null && q5 >= 1,
    functionalDecline: (q2 !== null && q2 >= 1) && (q3 !== null && q3 >= 1) && (q4 !== null && q4 >= 1),
    mobilityLimitation: q2 !== null && q2 >= 1,
  };
}

function generateInterpretation(answers, total) {
  const risk = getRiskLevel(total);
  const flags = getFlags(answers);
  const q5 = answers[5] ?? 0;

  if (total <= 3) {
    return `SARC-F score of ${total}/10 suggests low likelihood of sarcopenia. Muscle function and mobility appear preserved based on screening responses. Ongoing monitoring with regular physical activity and adequate protein intake is recommended.`;
  }

  const parts = [];
  if (answers[1] >= 1) parts.push("upper limb strength");
  if (answers[2] >= 1) parts.push("walking ability");
  if (answers[3] >= 1) parts.push("sit-to-stand transfers");
  if (answers[4] >= 1) parts.push("stair climbing");
  if (q5 >= 1) parts.push(`falls history (${q5 === 1 ? "1â€“3 falls" : "4+ falls"} in past year)`);

  const domainText = parts.length > 0 ? ` Difficulty reported in: ${parts.join(", ")}.` : "";

  return `SARC-F score of ${total}/10 indicates probable sarcopenia risk.${domainText} Further investigation is warranted, including grip strength, sit-to-stand testing, gait speed assessment, muscle mass evaluation, and/or referral for resistance training intervention.${flags.fallsRisk ? " Falls history identified â€” falls prevention strategies are recommended." : ""}`;
}

function getSuggestedTests(total) {
  if (total < 4) return [];
  return [
    "Grip Strength Test",
    "30-Second Sit-to-Stand Test",
    "Timed Up and Go (TUG)",
    "Gait Speed Assessment",
    "Short Physical Performance Battery (SPPB)",
    "Edmonton Frail Scale",
    "Balance Assessment",
    "DEXA Scan / Muscle Mass Assessment",
  ];
}

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Section({ title, defaultOpen = false, children, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors font-semibold text-slate-800 text-sm">
          <span className="flex items-center gap-2">{title} {badge && <span className="ml-1">{badge}</span>}</span>
          {open ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border border-t-0 border-slate-200 rounded-b-lg px-4 py-4 bg-white">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function QuestionCard({ q, value, onChange, index, total }) {
  return (
    <div className={`rounded-xl border-2 transition-all ${value !== null ? "border-blue-300 bg-blue-50/30" : "border-slate-200 bg-white"} p-4`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{q.icon}</span>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Question {index + 1} of {total} â€” {q.domain}</p>
            <p className="font-semibold text-slate-900 mt-0.5 text-sm leading-snug">"{q.script}"</p>
          </div>
        </div>
        {value !== null && (
          <Badge className="bg-blue-100 text-blue-800 border border-blue-300 shrink-0 ml-2">{value} pts</Badge>
        )}
      </div>
      <p className="text-xs text-slate-500 italic mb-3 ml-7">{q.example}</p>

      {/* Options */}
      <div className="flex flex-col gap-2 ml-7">
        {q.options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(q.id, opt.value)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-left text-sm transition-all ${
              value === opt.value
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50"
            }`}
          >
            <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${
              value === opt.value ? "bg-white border-white text-blue-600" : "border-slate-300 text-slate-500"
            }`}>{opt.value}</span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function SARCFQuestionnaireRunner({ client, onSave, onClose }) {
  const [answers, setAnswers] = useState({});
  const [notes, setNotes] = useState("");

  const answered = Object.keys(answers).length;
  const total = Object.values(answers).reduce((s, v) => s + v, 0);
  const allAnswered = answered === 5;
  const risk = allAnswered ? getRiskLevel(total) : null;
  const flags = allAnswered ? getFlags(answers) : null;
  const interpretation = allAnswered ? generateInterpretation(answers, total) : null;
  const suggestedTests = allAnswered ? getSuggestedTests(total) : [];

  const handleAnswer = (qId, value) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const handleReset = () => {
    setAnswers({});
    setNotes("");
  };

  const handleSave = () => {
    if (!allAnswered) {
      toast.error("Please complete all 5 SARC-F questions before saving.");
      return;
    }

    const r = getRiskLevel(total);
    const f = getFlags(answers);
    const interp = generateInterpretation(answers, total);

    const domainLabels = { 1: "Strength", 2: "Assistance Walking", 3: "Rise from Chair", 4: "Climb Stairs", 5: "Falls" };
    const optionLabel = (qId, val) => QUESTIONS.find(q => q.id === qId)?.options.find(o => o.value === val)?.label || val;

    const soapLines = [
      `â€¢ SARC-F Questionnaire (Sarcopenia Screening)`,
      `  Total Score: ${total}/10 â€” ${r.level}`,
      `  Probable Sarcopenia: ${total >= 4 ? "Yes" : "No"}`,
      ``,
      `  Question Responses:`,
      ...QUESTIONS.map(q => `    Q${q.id} (${q.domain}): ${answers[q.id] ?? 0}/2 â€” ${optionLabel(q.id, answers[q.id] ?? 0)}`),
      ``,
      `  Clinical Flags:`,
      `    Sarcopenia Risk: ${f.sarcopeniaRisk}`,
      `    Falls Risk Elevated: ${f.fallsRisk ? "Yes" : "No"}`,
      `    Functional Decline Suspected: ${f.functionalDecline ? "Yes" : "No"}`,
      `    Mobility Limitation Present: ${f.mobilityLimitation ? "Yes" : "No"}`,
      ``,
      `  Interpretation: ${interp}`,
      suggestedTests.length > 0 ? `\n  Recommended Follow-Up Tests: ${suggestedTests.join(", ")}` : null,
      notes ? `\n  Clinical Notes: ${notes}` : null,
      ``,
      `  Reference: Malmstrom TK, Miller DK, Simonsick EM, et al. (2016). SARC-F: A Simple Questionnaire to Rapidly Diagnose Sarcopenia. J Am Geriatr Soc, 64(12):2594-2595.`,
    ].filter(v => v !== null).join("\n");

    onSave({
      result_value: total,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
      additional_data: {
        measurement_type: "sarc_f_questionnaire",
        soap_text: soapLines,
        total_score: total,
        risk_level: r.level,
        probable_sarcopenia: total >= 4,
        q1_strength: answers[1] ?? 0,
        q2_walking: answers[2] ?? 0,
        q3_chair_rise: answers[3] ?? 0,
        q4_stairs: answers[4] ?? 0,
        q5_falls: answers[5] ?? 0,
        sarcopenia_risk_flag: f.sarcopeniaRisk,
        falls_risk_elevated: f.fallsRisk,
        functional_decline_suspected: f.functionalDecline,
        mobility_limitation: f.mobilityLimitation,
        interpretation: interp,
        suggested_followup_tests: suggestedTests,
        tags: ["sarcopenia", "falls_risk", "older_adults", "functional_decline", "frailty_screening", "mobility"],
      },
    });

    toast.success("SARC-F results saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50 shrink-0 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-slate-900">SARC-F Questionnaire</h2>
            <p className="text-sm text-indigo-600 mt-0.5">Sarcopenia Screening Tool Â· 5 Questions Â· Score 0â€“10</p>
            {client && <p className="text-xs text-slate-500 mt-0.5">Client: {client.full_name}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Progress bar */}
        <div className="px-5 pt-3 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-600">{answered}/5 questions answered</span>
            {answered > 0 && (
              <span className={`text-xs font-bold ${answered < 5 ? "text-slate-500" : risk?.color}`}>
                Score: {total}/10 {answered === 5 && `â€” ${risk?.level}`}
              </span>
            )}
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(answered / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {/* Clinician script */}
          <div className="bg-blue-600 text-white rounded-lg px-4 py-3 text-sm">
            <p className="font-semibold mb-0.5">ðŸ’¬ Clinician Instructions</p>
            <p className="text-blue-100">Ask the patient each question. Record the most appropriate response. Higher score = higher sarcopenia risk. Score â‰¥4 warrants further assessment.</p>
          </div>

          {/* Questions */}
          <Section title="ðŸ“‹ SARC-F Questions" defaultOpen={true}>
            <div className="space-y-4">
              {QUESTIONS.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  value={answers[q.id] !== undefined ? answers[q.id] : null}
                  onChange={handleAnswer}
                  index={i}
                  total={5}
                />
              ))}
            </div>
          </Section>

          {/* Live score + flags */}
          {allAnswered && (
            <>
              <Section title="ðŸ“Š Score & Clinical Flags" defaultOpen={true}>
                <div className="space-y-3">
                  {/* Score strip */}
                  <div className={`rounded-lg border-2 ${risk.border} ${risk.bg} px-4 py-3 flex items-center justify-between`}>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Total Score</p>
                      <p className={`text-4xl font-bold ${risk.color}`}>{total}<span className="text-lg font-normal text-slate-400">/10</span></p>
                    </div>
                    <div className="text-right">
                      <Badge className={`text-sm px-3 py-1 border ${risk.badge}`}>{risk.level}</Badge>
                      {total >= 4 && (
                        <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1 justify-end">
                          <AlertTriangle className="w-3 h-3" /> Probable Sarcopenia
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Flag grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Sarcopenia Risk", value: flags.sarcopeniaRisk, alert: flags.sarcopeniaRisk !== "Low" },
                      { label: "Falls Risk Elevated", value: flags.fallsRisk ? "Yes" : "No", alert: flags.fallsRisk },
                      { label: "Functional Decline Suspected", value: flags.functionalDecline ? "Yes" : "No", alert: flags.functionalDecline },
                      { label: "Mobility Limitation", value: flags.mobilityLimitation ? "Yes" : "No", alert: flags.mobilityLimitation },
                    ].map(f => (
                      <div key={f.label} className={`rounded-lg border px-3 py-2 ${f.alert ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50"}`}>
                        <p className="text-xs text-slate-500 font-medium">{f.label}</p>
                        <p className={`text-sm font-bold mt-0.5 ${f.alert ? "text-orange-700" : "text-green-700"}`}>{f.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>

              {/* Interpretation */}
              <Section title="ðŸ§  Clinical Interpretation" defaultOpen={true}>
                <div className={`rounded-lg border p-4 ${total >= 4 ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200"}`}>
                  <p className={`text-sm leading-relaxed italic ${total >= 4 ? "text-orange-800" : "text-green-800"}`}>
                    {interpretation}
                  </p>
                </div>
              </Section>

              {/* Follow-up tests */}
              {suggestedTests.length > 0 && (
                <Section title="ðŸ”¬ Suggested Follow-Up Tests">
                  <div className="flex flex-wrap gap-2">
                    {suggestedTests.map(t => (
                      <span key={t} className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-xs font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}

          {/* Notes */}
          <Section title="ðŸ“ Clinical Notes">
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Functional observations, exercise habits, dietary protein intake, referral plans..."
              rows={3}
            />
          </Section>

          {/* Reference */}
          <Section title="ðŸ“š Reference">
            <div className="space-y-1 text-sm">
              <a href="https://pubmed.ncbi.nlm.nih.gov/27649914/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-indigo-700 hover:underline">
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                Malmstrom TK, et al. (2016). SARC-F: A Simple Questionnaire to Rapidly Diagnose Sarcopenia. J Am Geriatr Soc, 64(12):2594-2595.
              </a>
              <a href="https://pubmed.ncbi.nlm.nih.gov/31992385/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-indigo-700 hover:underline">
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                Cruz-Jentoft AJ, et al. (2019). Sarcopenia: revised European consensus. Age Ageing 48(1):16-31.
              </a>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-slate-500 hover:text-red-600">
              <RotateCcw className="w-4 h-4 mr-1" />Reset
            </Button>
          </div>
          <Button
            onClick={handleSave}
            disabled={!allAnswered}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}