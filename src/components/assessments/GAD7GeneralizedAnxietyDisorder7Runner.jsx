import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

const QUESTIONS = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it's hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid, as if something awful might happen",
];

const OPTIONS = ["Not at all", "Several days", "More than half the days", "Nearly every day"];

function getInterpretation(score) {
  if (score <= 4) return { label: "Minimal Anxiety", color: "bg-green-100 text-green-800 border-green-300", action: "No specific treatment usually needed" };
  if (score <= 9) return { label: "Mild Anxiety", color: "bg-yellow-100 text-yellow-800 border-yellow-300", action: "Watchful waiting; retest in 2 weeks" };
  if (score <= 14) return { label: "Moderate Anxiety", color: "bg-orange-100 text-orange-800 border-orange-300", action: "Consider formal support; further assessment advised" };
  return { label: "Severe Anxiety", color: "bg-red-100 text-red-800 border-red-300", action: "Active treatment warranted; referral to mental health" };
}

export default function GAD7GeneralizedAnxietyDisorder7Runner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState(Array(7).fill(null));
  const [functional, setFunctional] = useState(null);
  const [notes, setNotes] = useState("");

  const answered = responses.filter(r => r !== null).length;
  const total = responses.reduce((s, v) => s + (v ?? 0), 0);
  const allAnswered = answered === 7;
  const interp = allAnswered ? getInterpretation(total) : null;

  const FUNCTIONAL_Q = "If you checked off any problems, how difficult have these made it for you to do your work, take care of things at home, or get along with other people?";
  const FUNCTIONAL_OPTS = ["Not difficult at all", "Somewhat difficult", "Very difficult", "Extremely difficult"];

  const handleSave = () => {
    if (!allAnswered) { toast.error("Please answer all 7 questions"); return; }
    const qLines = QUESTIONS.map((q, i) => `  Q${i + 1} (${OPTIONS[responses[i]]}): ${responses[i]}`).join("\n");
    const soap = `• GAD-7 Generalised Anxiety Disorder Scale\n  Total Score: ${total}/21 — ${interp.label}\n  Suggested action: ${interp.action}\n\n  Item Responses:\n${qLines}${functional !== null ? `\n  Functional Impairment: ${FUNCTIONAL_OPTS[functional]}` : ""}${notes ? `\n\n  Notes: ${notes}` : ""}\n  Interpretation: 0–4 minimal | 5–9 mild | 10–14 moderate | 15–21 severe\n  MCID: 5-point change. Refer if score ≥10 or Q9 > 0.\n  Reference: Spitzer RL et al. (2006). A brief measure for assessing generalised anxiety disorder. Arch Intern Med, 166(10):1092-7.`;
    onSave({ status: "completed", result_value: total, notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "questionnaire", responses, severity: interp.label, functional_impairment: functional !== null ? FUNCTIONAL_OPTS[functional] : null } });
    toast.success("GAD-7 saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white z-10 p-5 border-b flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">GAD-7</h2>
            <p className="text-slate-500 text-sm mt-0.5">Generalised Anxiety Disorder — 7 items</p>
          </div>
          <div className="flex items-center gap-3">
            {allAnswered && <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${interp.color}`}>{total}/21 — {interp.label}</div>}
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Instructions</p>
            <p>Over the last <strong>2 weeks</strong>, how often have you been bothered by the following problems?</p>
          </div>

          {QUESTIONS.map((q, i) => (
            <Card key={i} className={responses[i] !== null ? "border-blue-200 bg-blue-50/20" : ""}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-700">Q{i + 1}. {q}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {OPTIONS.map((opt, v) => (
                    <Button key={v} type="button" size="sm" variant={responses[i] === v ? "default" : "outline"} className={`h-auto py-2 text-xs flex flex-col ${responses[i] === v ? "bg-blue-600 hover:bg-blue-700" : ""}`} onClick={() => { const n = [...responses]; n[i] = v; setResponses(n); }}>
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
                <p className="text-3xl font-bold">{total} / 21</p>
                <p className="font-semibold text-lg mt-1">{interp.label}</p>
                <p className="text-sm mt-1">{interp.action}</p>
                {total >= 15 && <div className="flex items-center justify-center gap-2 mt-2"><AlertTriangle className="w-4 h-4" /><span className="text-sm font-semibold">Consider mental health referral</span></div>}
              </div>
            </>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Context, duration of symptoms, relevant history, referral plan..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between items-center">
          <span className="text-sm text-slate-500">{answered}/7 answered</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!allAnswered} className="bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" />Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}