import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";

const DOMAINS = [
  {
    key: "cognition",
    label: "Cognition",
    question: "Clock drawing test — ask the client to draw a clock showing 11:10",
    options: [{ label: "Normal (0)", value: 0 }, { label: "Minor errors (1)", value: 1 }, { label: "More than minor errors (2)", value: 2 }],
  },
  {
    key: "general_health",
    label: "General Health Status",
    question: "In general, compared to other people your age, would you say your health is:",
    options: [{ label: "Excellent/Good (0)", value: 0 }, { label: "Fair (1)", value: 1 }, { label: "Poor (2)", value: 2 }],
  },
  {
    key: "functional_independence",
    label: "Functional Independence",
    question: "With how many of the following ADLs do you require help? (shopping, bathing, meal prep, transport, phone, finances)",
    options: [{ label: "0–1 of 6 (0)", value: 0 }, { label: "2–4 of 6 (1)", value: 1 }, { label: "5–6 of 6 (2)", value: 2 }],
  },
  {
    key: "social_support",
    label: "Social Support",
    question: "When you need help, can you count on someone who is willing to meet your needs?",
    options: [{ label: "Always (0)", value: 0 }, { label: "Sometimes (1)", value: 1 }, { label: "Never (2)", value: 2 }],
  },
  {
    key: "medication_use",
    label: "Medication Use",
    question: "Do you use 5 or more different prescription medications regularly?",
    options: [{ label: "No (0)", value: 0 }, { label: "Yes (1)", value: 1 }],
  },
  {
    key: "nutrition",
    label: "Nutrition",
    question: "Have you lost weight in the last 6 months such that your clothing has become looser?",
    options: [{ label: "No (0)", value: 0 }, { label: "Yes (1)", value: 1 }],
  },
  {
    key: "mood",
    label: "Mood",
    question: "Do you often feel sad or depressed?",
    options: [{ label: "No (0)", value: 0 }, { label: "Yes (1)", value: 1 }],
  },
  {
    key: "continence",
    label: "Continence",
    question: "Do you have a problem with losing control of urine when you don't want to?",
    options: [{ label: "No (0)", value: 0 }, { label: "Yes (1)", value: 1 }],
  },
  {
    key: "functional_performance",
    label: "Functional Performance",
    question: "Timed Up and Go (TUG): How many seconds does it take the patient to get up from a chair, walk 3 metres, and return?",
    options: [{ label: "0–10s (0)", value: 0 }, { label: "11–20s (1)", value: 1 }, { label: "≥20s or refused (2)", value: 2 }],
  },
];

function getInterpretation(score) {
  if (score <= 4) return { label: "Not Frail", color: "bg-green-100 text-green-800 border-green-300" };
  if (score <= 6) return { label: "Apparently Vulnerable", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  if (score <= 8) return { label: "Mildly Frail", color: "bg-orange-100 text-orange-800 border-orange-300" };
  if (score <= 10) return { label: "Moderately Frail", color: "bg-red-100 text-red-800 border-red-300" };
  return { label: "Severely Frail", color: "bg-red-200 text-red-900 border-red-400" };
}

export default function EdmontonFrailScaleEFSRunner({ client, onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");

  const answered = Object.keys(scores).length;
  const allAnswered = answered === DOMAINS.length;
  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  const interp = allAnswered ? getInterpretation(total) : null;

  const handleSave = () => {
    if (!allAnswered) { toast.error("Please answer all 9 domains"); return; }
    const lines = DOMAINS.map(d => `  ${d.label}: ${scores[d.key]}`).join("\n");
    const soap = `• Edmonton Frail Scale (EFS)\n  Total Score: ${total}/17 — ${interp.label}\n\n  Domain Scores:\n${lines}${notes ? `\n\n  Notes: ${notes}` : ""}\n  Interpretation: 0–4 not frail | 5–6 vulnerable | 7–8 mild | 9–10 moderate | 11+ severe\n  Reference: Rolfson DB et al. (2006). Validity and reliability of the Edmonton Frail Scale. Age and Ageing, 35(5):526-529.`;
    onSave({ status: "completed", result_value: total, notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "edmonton_frail_scale", domain_scores: scores, frailty_category: interp.label } });
    toast.success("EFS saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white z-10 p-5 border-b flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Edmonton Frail Scale</h2><p className="text-slate-500 text-sm mt-0.5">9-domain frailty assessment (EFS)</p></div>
          <div className="flex items-center gap-3">
            {allAnswered && <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${interp.color}`}>{total}/17 — {interp.label}</div>}
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Instructions</p>
            <p>Administer each domain verbally or via observation. The Clock Drawing Test requires the patient to draw a clock face showing the time 11:10.</p>
          </div>

          {DOMAINS.map(d => (
            <Card key={d.key} className={scores[d.key] !== undefined ? "border-indigo-200 bg-indigo-50/20" : ""}>
              <CardHeader className="pb-2">
                <p className="text-xs font-bold text-indigo-600 uppercase">{d.label}</p>
                <CardTitle className="text-sm font-normal text-slate-800">{d.question}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {d.options.map(opt => (
                    <Button key={opt.value} type="button" size="sm" variant={scores[d.key] === opt.value ? "default" : "outline"} className={`h-auto py-2 text-xs ${scores[d.key] === opt.value ? "bg-indigo-600 hover:bg-indigo-700" : ""}`} onClick={() => setScores(p => ({ ...p, [d.key]: opt.value }))}>
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {allAnswered && (
            <div className={`border-2 rounded-xl p-4 text-center ${interp.color}`}>
              <p className="text-3xl font-bold">{total} / 17</p>
              <p className="font-semibold text-lg mt-1">{interp.label}</p>
              <p className="text-xs mt-2">0–4 not frail | 5–6 vulnerable | 7–8 mild | 9–10 moderate | 11+ severe</p>
            </div>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Living situation, carer support, fall risk, clinical action plan..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between items-center">
          <span className="text-sm text-slate-500">{answered}/9 answered</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!allAnswered} className="bg-indigo-600 hover:bg-indigo-700"><Save className="w-4 h-4 mr-2" />Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}