import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const QUESTIONS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself, or that you are a failure, or have let yourself or your family down",
  "Trouble concentrating on things, such as reading the newspaper or watching television",
  "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
  "Thoughts that you would be better off dead or of hurting yourself in some way",
];

const OPTIONS = ["Not at all", "Several days", "More than half the days", "Nearly every day"];

function getInterpretation(score) {
  if (score <= 4) return { label: "Minimal Depression", color: "bg-green-100 text-green-800 border-green-300", action: "None indicated; monitor" };
  if (score <= 9) return { label: "Mild Depression", color: "bg-yellow-100 text-yellow-800 border-yellow-300", action: "Watchful waiting; psychoeducation" };
  if (score <= 14) return { label: "Moderate Depression", color: "bg-orange-100 text-orange-800 border-orange-300", action: "Formal management plan; psychological treatment" };
  if (score <= 19) return { label: "Moderately Severe Depression", color: "bg-red-100 text-red-800 border-red-300", action: "Pharmacotherapy and/or psychotherapy" };
  return { label: "Severe Depression", color: "bg-red-200 text-red-900 border-red-400", action: "Immediate pharmacotherapy/referral" };
}

export default function PHQ9PatientHealthQuestionnaire9Runner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState(Array(9).fill(null));
  const [functional, setFunctional] = useState(null);
  const [notes, setNotes] = useState("");

  const answered = responses.filter(r => r !== null).length;
  const total = responses.reduce((s, v) => s + (v ?? 0), 0);
  const allAnswered = answered === 9;
  const interp = allAnswered ? getInterpretation(total) : null;
  const q9Positive = responses[8] !== null && responses[8] > 0;

  const FUNCTIONAL_Q = "How difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?";
  const FUNCTIONAL_OPTS = ["Not difficult at all", "Somewhat difficult", "Very difficult", "Extremely difficult"];

  const handleSave = () => {
    if (!allAnswered) { toast.error("Please answer all 9 questions"); return; }
    const qLines = QUESTIONS.map((q, i) => `  Q${i + 1} (${OPTIONS[responses[i]]}): ${responses[i]}`).join("\n");
    const soap = `• PHQ-9 Depression Scale\n  Total Score: ${total}/27 — ${interp.label}\n  Suggested action: ${interp.action}\n\n  Item Responses:\n${qLines}${functional !== null ? `\n  Functional Impairment: ${FUNCTIONAL_OPTS[functional]}` : ""}${q9Positive ? `\n  ⚠ Suicidal ideation screen (Q9): POSITIVE — requires immediate risk assessment` : ""}${notes ? `\n\n  Notes: ${notes}` : ""}\n  Interpretation: 0–4 minimal | 5–9 mild | 10–14 moderate | 15–19 mod-severe | 20–27 severe\n  MCID: 5-point change. Score ≥10 = likely major depressive disorder.\n  Reference: Kroenke K et al. (2001). The PHQ-9. J Gen Intern Med, 16(9):606-13.`;
    onSave({ status: "completed", result_value: total, notes, assessment_date: todayLocal(), additional_data: { soap_text: soap, measurement_type: "questionnaire", responses, severity: interp.label, q9_suicidal_ideation: q9Positive, functional_impairment: functional !== null ? FUNCTIONAL_OPTS[functional] : null } });
    toast.success("PHQ-9 saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white z-10 p-5 border-b flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">PHQ-9</h2>
            <p className="text-slate-500 text-sm mt-0.5">Patient Health Questionnaire — 9 items</p>
          </div>
          <div className="flex items-center gap-3">
            {allAnswered && <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${interp.color}`}>{total}/27 — {interp.label}</div>}
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Instructions</p>
            <p>Over the last <strong>2 weeks</strong>, how often have you been bothered by any of the following problems?</p>
          </div>

          {QUESTIONS.map((q, i) => (
            <Card key={i} className={`${responses[i] !== null ? "border-blue-200 bg-blue-50/20" : ""} ${i === 8 && responses[8] > 0 ? "border-red-300 bg-red-50" : ""}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm font-medium ${i === 8 ? "text-red-700" : "text-slate-700"}`}>
                  Q{i + 1}. {q}{i === 8 && " ⚠"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {OPTIONS.map((opt, v) => (
                    <Button key={v} type="button" size="sm" variant={responses[i] === v ? "default" : "outline"} className={`h-auto py-2 text-xs flex flex-col ${responses[i] === v ? (i === 8 && v > 0 ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700") : ""}`} onClick={() => { const n = [...responses]; n[i] = v; setResponses(n); }}>
                      <span className="font-bold text-base">{v}</span>
                      <span className="text-[10px] leading-tight text-center">{opt}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {allAnswered && (
            <>
              {q9Positive && (
                <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-800">Suicidal Ideation Flagged (Q9)</p>
                    <p className="text-sm text-red-700 mt-1">Client has endorsed thoughts of self-harm. Conduct a full suicide risk assessment immediately.</p>
                  </div>
                </div>
              )}
              <Card className="bg-slate-50">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{FUNCTIONAL_Q}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {FUNCTIONAL_OPTS.map((opt, v) => (
                      <Button key={v} type="button" size="sm" variant={functional === v ? "default" : "outline"} className={functional === v ? "bg-blue-600 hover:bg-blue-700" : ""} onClick={() => setFunctional(v)}>{opt}</Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <div className={`border-2 rounded-xl p-4 text-center ${interp.color}`}>
                <p className="text-3xl font-bold">{total} / 27</p>
                <p className="font-semibold text-lg mt-1">{interp.label}</p>
                <p className="text-sm mt-1">{interp.action}</p>
              </div>
            </>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Duration, contributing factors, risk management, referral plan..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between items-center">
          <span className="text-sm text-slate-500">{answered}/9 answered</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!allAnswered} className="bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" />Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}