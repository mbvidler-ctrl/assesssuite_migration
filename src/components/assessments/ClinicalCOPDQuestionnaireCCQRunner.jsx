import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";

// CCQ domains and items
const DOMAINS = [
  {
    label: "Symptoms (S)",
    items: [
      { id: 0, text: "On average, during the past week, how often did you feel short of breath at rest?" },
      { id: 1, text: "On average, during the past week, how often did you feel short of breath doing physical activities?" },
      { id: 2, text: "On average, during the past week, how often did you cough?" },
      { id: 3, text: "On average, during the past week, how often did you produce phlegm?" },
    ],
    color: "border-blue-200 bg-blue-50/30",
  },
  {
    label: "Functional State (F)",
    items: [
      { id: 4, text: "On average, during the past week, how limited were you in strenuous activities (e.g. climbing stairs, hurrying, sports)?" },
      { id: 5, text: "On average, during the past week, how limited were you in moderate activities (e.g. walking, housework, carrying things)?" },
      { id: 6, text: "On average, during the past week, how limited were you in daily activities at home (e.g. dressing, washing)?" },
    ],
    color: "border-green-200 bg-green-50/30",
  },
  {
    label: "Mental State (M)",
    items: [
      { id: 7, text: "On average, during the past week, how often did you feel concerned about getting a cold or your breathing getting worse?" },
      { id: 8, text: "On average, during the past week, how often did you feel depressed (down) because of your breathing problems?" },
      { id: 9, text: "On average, during the past week, how often did you feel worried about your breathing?" },
    ],
    color: "border-purple-200 bg-purple-50/30",
  },
];

const OPTIONS = [
  { value: 0, label: "0 – Never/Not limited at all" },
  { value: 1, label: "1 – Hardly ever/Hardly limited" },
  { value: 2, label: "2 – A few times/A little limited" },
  { value: 3, label: "3 – Several times/Moderately limited" },
  { value: 4, label: "4 – Many times/Very limited" },
  { value: 5, label: "5 – A great many times/Extremely limited" },
  { value: 6, label: "6 – Almost always/Unable to do" },
];

function getInterpretation(mean) {
  if (mean < 1.0) return { label: "Very good COPD control", color: "bg-green-100 text-green-800 border-green-300" };
  if (mean < 2.0) return { label: "Good COPD control", color: "bg-teal-100 text-teal-800 border-teal-300" };
  if (mean < 3.0) return { label: "Moderate COPD control", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  if (mean < 4.0) return { label: "Poor COPD control", color: "bg-orange-100 text-orange-800 border-orange-300" };
  return { label: "Very poor COPD control", color: "bg-red-100 text-red-800 border-red-300" };
}

export default function ClinicalCOPDQuestionnaireCCQRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");

  const allItems = DOMAINS.flatMap(d => d.items);
  const answered = Object.keys(responses).length;
  const allAnswered = answered === 10;

  const symptomIds = [0, 1, 2, 3];
  const functionalIds = [4, 5, 6];
  const mentalIds = [7, 8, 9];

  const domainMean = (ids) => {
    const vals = ids.map(id => responses[id]).filter(v => v !== undefined);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const totalMean = allAnswered ? Object.values(responses).reduce((a, b) => a + b, 0) / 10 : null;
  const interp = totalMean !== null ? getInterpretation(totalMean) : null;

  const handleSave = () => {
    if (!allAnswered) { toast.error("Please answer all 10 questions"); return; }
    const sMean = domainMean(symptomIds);
    const fMean = domainMean(functionalIds);
    const mMean = domainMean(mentalIds);
    const lines = allItems.map((item, i) => `  Q${i + 1}: ${responses[item.id]}/6`).join("\n");
    const soap = `• Clinical COPD Questionnaire (CCQ)\n  Total Score (mean): ${totalMean.toFixed(2)}/6 — ${interp.label}\n  Symptom Domain: ${sMean?.toFixed(2)} | Functional: ${fMean?.toFixed(2)} | Mental: ${mMean?.toFixed(2)}\n\n  Item Responses:\n${lines}${notes ? `\n\n  Notes: ${notes}` : ""}\n  MCID: 0.4 points | Scale: 0 (best) to 6 (worst)\n  Reference: van der Molen T et al. (2003). Development, validity, reliability of CCQ. Health Qual Life Outcomes, 1:13.`;
    onSave({ status: "completed", result_value: parseFloat(totalMean.toFixed(2)), notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "questionnaire", responses, total_mean: parseFloat(totalMean.toFixed(2)), symptom_domain: parseFloat(sMean?.toFixed(2)), functional_domain: parseFloat(fMean?.toFixed(2)), mental_domain: parseFloat(mMean?.toFixed(2)), control_level: interp.label } });
    toast.success("CCQ saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white z-10 p-5 border-b flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Clinical COPD Questionnaire (CCQ)</h2>
            <p className="text-slate-500 text-sm mt-0.5">10-item health status — 3 domains (0–6 scale)</p>
          </div>
          {allAnswered && <div className={`px-3 py-1 rounded-full text-sm font-semibold border mr-2 ${interp.color}`}>{totalMean?.toFixed(2)}/6</div>}
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Instructions</p>
            <p>Ask the patient to select the best answer for each question. Refer to their experience over the <strong>past week</strong>. Score 0 (best) to 6 (worst) per item.</p>
          </div>

          {DOMAINS.map(domain => (
            <div key={domain.label}>
              <p className="font-semibold text-sm text-slate-700 mb-2">{domain.label}</p>
              {domain.items.map(item => (
                <Card key={item.id} className={`mb-3 border ${responses[item.id] !== undefined ? domain.color : ""}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-normal text-slate-800">Q{item.id + 1}. {item.text}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-1.5">
                      {OPTIONS.map(opt => (
                        <Button key={opt.value} type="button" size="sm" variant={responses[item.id] === opt.value ? "default" : "outline"} className={`h-auto py-1.5 text-xs text-left justify-start ${responses[item.id] === opt.value ? "bg-blue-600 hover:bg-blue-700" : ""}`} onClick={() => setResponses(p => ({ ...p, [item.id]: opt.value }))}>
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}

          {allAnswered && (
            <div className={`border-2 rounded-xl p-4 text-center ${interp.color}`}>
              <p className="text-3xl font-bold">{totalMean?.toFixed(2)} / 6 <span className="text-base font-normal">(mean)</span></p>
              <p className="text-sm mt-0.5">Symptoms: {domainMean(symptomIds)?.toFixed(2)} | Functional: {domainMean(functionalIds)?.toFixed(2)} | Mental: {domainMean(mentalIds)?.toFixed(2)}</p>
              <p className="font-semibold text-lg mt-1">{interp.label}</p>
              <p className="text-xs mt-1">MCID = 0.4 | 0 = best control | 6 = worst control</p>
            </div>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Exacerbation history, current medications, exercise tolerance, referral needs..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between items-center">
          <span className="text-sm text-slate-500">{answered}/10 answered</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!allAnswered} className="bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" />Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}