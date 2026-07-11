import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const QUESTIONS = [
  "Tired out for no good reason",
  "Nervous",
  "So nervous that nothing could calm you down",
  "Hopeless",
  "Restless or fidgety",
  "So restless that you could not sit still",
  "Depressed",
  "That everything was an effort",
  "So sad that nothing could cheer you up",
  "Worthless",
];

const OPTIONS = [
  { label: "None of the time", value: 1 },
  { label: "A little of the time", value: 2 },
  { label: "Some of the time", value: 3 },
  { label: "Most of the time", value: 4 },
  { label: "All of the time", value: 5 },
];

function getInterpretation(score) {
  if (score <= 19) return { label: "Likely Well", color: "bg-green-100 text-green-800 border-green-300", action: "No specific action — monitor" };
  if (score <= 24) return { label: "Mild Distress", color: "bg-yellow-100 text-yellow-800 border-yellow-300", action: "Consider further screening; psychoeducation" };
  if (score <= 29) return { label: "Moderate Distress", color: "bg-orange-100 text-orange-800 border-orange-300", action: "Formal assessment; consider referral to GP or mental health" };
  return { label: "Severe Distress", color: "bg-red-100 text-red-800 border-red-300", action: "Urgent mental health review recommended" };
}

export default function KesslerPsychologicalDistressScaleK10Runner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState(Array(10).fill(null));
  const [notes, setNotes] = useState("");

  const answered = responses.filter(r => r !== null).length;
  const total = responses.reduce((s, v) => s + (v ?? 0), 0);
  const allAnswered = answered === 10;
  const interp = allAnswered ? getInterpretation(total) : null;

  const handleSave = () => {
    if (!allAnswered) { toast.error("Please answer all 10 questions"); return; }
    const qLines = QUESTIONS.map((q, i) => `  Q${i + 1} (${OPTIONS.find(o => o.value === responses[i])?.label}): ${responses[i]}`).join("\n");
    const soap = `• K10 Psychological Distress Scale\n  Total Score: ${total}/50 — ${interp.label}\n  Recommended action: ${interp.action}\n\n  Item Responses:\n${qLines}${notes ? `\n\n  Notes: ${notes}` : ""}\n  Interpretation: 10–19 well | 20–24 mild | 25–29 moderate | 30–50 severe\n  Reference: Kessler RC et al. (2002). Short screening scales to monitor population prevalences and trends in non-specific psychological distress. Psychol Med, 32(6):959-76.`;
    onSave({ status: "completed", result_value: total, notes, assessment_date: todayLocal(), additional_data: { soap_text: soap, measurement_type: "questionnaire", responses, distress_level: interp.label } });
    toast.success("K10 saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white z-10 p-5 border-b flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">K10 Distress Scale</h2>
            <p className="text-slate-500 text-sm mt-0.5">Kessler Psychological Distress Scale — 10 items</p>
          </div>
          <div className="flex items-center gap-3">
            {allAnswered && <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${interp.color}`}>{total}/50 — {interp.label}</div>}
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Instructions</p>
            <p>In the past <strong>4 weeks</strong>, about how often did you feel… (1=None of the time → 5=All of the time)</p>
          </div>

          {QUESTIONS.map((q, i) => (
            <Card key={i} className={responses[i] !== null ? "border-indigo-200 bg-indigo-50/20" : ""}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-700">Q{i + 1}. {q}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-1.5">
                  {OPTIONS.map(opt => (
                    <Button key={opt.value} type="button" size="sm" variant={responses[i] === opt.value ? "default" : "outline"} className={`h-auto py-2 text-xs flex flex-col ${responses[i] === opt.value ? "bg-indigo-600 hover:bg-indigo-700" : ""}`} onClick={() => { const n = [...responses]; n[i] = opt.value; setResponses(n); }}>
                      <span className="font-bold text-base">{opt.value}</span>
                      <span className="text-[9px] leading-tight text-center">{opt.label.replace(" of the time", "")}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {allAnswered && (
            <div className={`border-2 rounded-xl p-4 text-center ${interp.color}`}>
              <p className="text-3xl font-bold">{total} / 50</p>
              <p className="font-semibold text-lg mt-1">{interp.label}</p>
              <p className="text-sm mt-1">{interp.action}</p>
            </div>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Duration of symptoms, context, referral plan..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between items-center">
          <span className="text-sm text-slate-500">{answered}/10 answered</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!allAnswered} className="bg-indigo-600 hover:bg-indigo-700"><Save className="w-4 h-4 mr-2" />Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}