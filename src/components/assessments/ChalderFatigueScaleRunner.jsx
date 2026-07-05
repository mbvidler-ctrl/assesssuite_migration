import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Info, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";

// Chalder Fatigue Scale — 11-item bimodal + Likert scoring
const PHYSICAL_Q = [
  "Do you have problems with fatigue?",
  "Do you need to rest more?",
  "Do you feel sleepy or drowsy?",
  "Do you have problems starting things?",
  "Do you start things without difficulty but get weak as you go on?",
  "Do you feel less strong in your muscles?",
  "Do you feel weak?",
  "Do you have difficulties concentrating?",
];

const MENTAL_Q = [
  "Do you have problems with your memory?",
  "Do you have difficulties thinking clearly?",
  "Do you make slips of the tongue when talking?",
];

const OPTIONS_LIKERT = ["Less than usual", "No more than usual", "More than usual", "Much more than usual"];
const OPTIONS_LABELS = ["Less", "No more", "More", "Much more"]; // Short labels for button display
const BIMODAL_MAP = [0, 1, 1, 1]; // 0,1,2,3 -> bimodal score (Likert options 2-3 = 1 in bimodal)

function getInterpretation(bimodalScore) {
  if (bimodalScore <= 3) return { label: "Minimal fatigue", color: "bg-green-100 text-green-800 border-green-300" };
  if (bimodalScore <= 6) return { label: "Mild fatigue", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  if (bimodalScore <= 9) return { label: "Moderate fatigue — clinical attention warranted", color: "bg-orange-100 text-orange-800 border-orange-300" };
  return { label: "Severe fatigue — CFS/ME criteria may apply", color: "bg-red-100 text-red-800 border-red-300" };
}

export default function ChalderFatigueScaleRunner({ client, onSave, onClose }) {
  const allQs = [...PHYSICAL_Q, ...MENTAL_Q];
  const [responses, setResponses] = useState(Array(11).fill(null));
  const [notes, setNotes] = useState("");
  const [showInfo, setShowInfo] = useState(false);

  const answered = responses.filter(r => r !== null).length;
  const allAnswered = answered === 11;

  const likertScore = responses.reduce((s, v) => s + (v ?? 0), 0);
   const bimodalScore = responses.reduce((s, v) => s + (v !== null ? BIMODAL_MAP[v] : 0), 0);
   const physicalScore = responses.slice(0, 8).reduce((s, v) => s + (v ?? 0), 0);
   const mentalScore = responses.slice(8).reduce((s, v) => s + (v ?? 0), 0);

  const interp = allAnswered ? getInterpretation(bimodalScore) : null;

  const handleSave = () => {
    if (!allAnswered) { toast.error("Please answer all 11 questions"); return; }
    const qLines = allQs.map((q, i) => `  Q${i + 1} (${OPTIONS_LIKERT[responses[i]]}): ${responses[i]}`).join("\n");
    const soap = `• Chalder Fatigue Scale (CFS-11)\n  Bimodal Score: ${bimodalScore}/11 — ${interp.label}\n  Likert Total: ${likertScore}/33\n  Physical Subscale: ${physicalScore}/24 | Mental Subscale: ${mentalScore}/9\n\n  Item Responses:\n${qLines}${notes ? `\n\n  Notes: ${notes}` : ""}\n  Interpretation: Bimodal score ≥4 = significant fatigue. Caseness: ≥4 bimodal points.\n  Reference: Chalder T et al. (1993). Development of a fatigue scale. J Psychosom Res, 37(2):147-53.`;
    onSave({ result_value: bimodalScore, notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "questionnaire", responses, bimodal_score: bimodalScore, likert_score: likertScore, physical_subscale: physicalScore, mental_subscale: mentalScore, fatigue_level: interp.label } });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white z-10 p-5 border-b flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Chalder Fatigue Scale</h2>
            <p className="text-slate-500 text-sm mt-0.5">11-item fatigue severity questionnaire</p>
          </div>
          {allAnswered && <div className={`px-3 py-1 rounded-full text-sm font-semibold border mr-2 ${interp.color}`}>{bimodalScore}/11</div>}
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Clinician Instructions for client */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Instructions to Client</p>
            <p>Rate how you have been feeling <strong>over the past month</strong> compared to when you were last feeling well. Read each question aloud and select the best answer.</p>
          </div>

          {/* Collapsible Clinician Reference Panel */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between bg-slate-50 px-4 py-3 text-left"
              onClick={() => setShowInfo(!showInfo)}
            >
              <span className="font-semibold text-slate-800 text-sm">📋 About this Scale — Clinician Reference</span>
              {showInfo ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
            </button>
            {showInfo && (
              <div className="px-4 py-4 space-y-4 text-sm bg-white">
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Purpose</h4>
                  <p className="text-slate-700">The Chalder Fatigue Scale (CFS-11) measures the severity of physical and mental fatigue. It is widely used in chronic fatigue syndrome (CFS/ME), post-viral fatigue, cancer-related fatigue, and general clinical settings.</p>
                </div>
                <div>
                <h4 className="font-semibold text-slate-800 mb-1">Administration</h4>
                <ul className="list-disc list-inside text-slate-700 space-y-1">
                 <li>Self-report or clinician-administered</li>
                 <li>Takes approximately 5 minutes to complete</li>
                 <li>Ask the client to reflect on the <strong>past month</strong>, compared to their usual healthy state</li>
                 <li>11 items: 7 physical fatigue, 3 mental fatigue, 1 concentration item</li>
                </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Scoring</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 px-2 py-1 text-left">Method</th>
                          <th className="border border-slate-300 px-2 py-1 text-left">Scale</th>
                          <th className="border border-slate-300 px-2 py-1 text-left">Caseness Threshold</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td className="border border-slate-300 px-2 py-1">Bimodal</td><td className="border border-slate-300 px-2 py-1">0–11</td><td className="border border-slate-300 px-2 py-1">≥4 = caseness (significant fatigue)</td></tr>
                        <tr className="bg-slate-50"><td className="border border-slate-300 px-2 py-1">Likert</td><td className="border border-slate-300 px-2 py-1">0–33</td><td className="border border-slate-300 px-2 py-1">Cumulative score (not primary)</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-slate-500 text-xs mt-1">Bimodal: "Less than usual" or "No more than usual" = 0; "More than usual" or "Much more than usual" = 1. Likert: options 0–3 summed (not standard for diagnosis).</p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Interpretation (Bimodal)</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-400 inline-block"></span><span>0–3: Minimal fatigue</span></div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"></span><span>4–6: Mild fatigue</span></div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block"></span><span>7–9: Moderate fatigue — clinical attention warranted</span></div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span><span>10–11: Severe fatigue — CFS/ME criteria may apply</span></div>
                  </div>
                </div>
                <div>
                   <h4 className="font-semibold text-slate-800 mb-2">Key Reference</h4>
                   <p className="text-xs text-slate-700 mb-2">Chalder T, Berelowitz G, Pawlikowska T, et al. (1993). Development of a fatigue scale. <em>Journal of Psychosomatic Research</em>, 37(2), 147–153.</p>
                   <p className="text-xs text-slate-500">The original validation study for the Chalder Fatigue Scale in post-viral fatigue populations. Bimodal scoring recommended for detecting CFS/ME caseness.</p>
                 </div>
              </div>
            )}
          </div>

          <div>
            <p className="font-semibold text-sm text-slate-700 mb-2">Physical Fatigue (Q1–8)</p>
            {PHYSICAL_Q.map((q, i) => (
              <Card key={i} className={`mb-2 ${responses[i] !== null ? "border-purple-200 bg-purple-50/20" : ""}`}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-700">Q{i + 1}. {q}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-2">
                    {OPTIONS_LABELS.map((label, v) => (
                       <Button key={v} type="button" size="sm" variant={responses[i] === v ? "default" : "outline"} className={`h-auto py-2 text-xs flex flex-col ${responses[i] === v ? "bg-purple-600 hover:bg-purple-700" : ""}`} onClick={() => { const n = [...responses]; n[i] = v; setResponses(n); }} title={OPTIONS_LIKERT[v]}>
                         <span className="font-bold">{label}</span>
                       </Button>
                     ))}
                    </div>
                    </CardContent>
                    </Card>
                    ))}
                    </div>

                    <div>
                    <p className="font-semibold text-sm text-slate-700 mb-2">Mental Fatigue (Q9–11)</p>
                    {MENTAL_Q.map((q, i) => (
                    <Card key={i} className={`mb-2 ${responses[i + 8] !== null ? "border-purple-200 bg-purple-50/20" : ""}`}>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-700">Q{i + 9}. {q}</CardTitle></CardHeader>
                    <CardContent>
                    <div className="grid grid-cols-4 gap-2">
                     {OPTIONS_LABELS.map((label, v) => (
                       <Button key={v} type="button" size="sm" variant={responses[i + 8] === v ? "default" : "outline"} className={`h-auto py-2 text-xs flex flex-col ${responses[i + 8] === v ? "bg-purple-600 hover:bg-purple-700" : ""}`} onClick={() => { const n = [...responses]; n[i + 8] = v; setResponses(n); }} title={OPTIONS_LIKERT[v]}>
                         <span className="font-bold">{label}</span>
                       </Button>
                     ))}
                    </div>
                    </CardContent>
                    </Card>
                    ))}
          </div>

          {allAnswered && (
            <div className={`border-2 rounded-xl p-4 text-center ${interp.color}`}>
              <p className="text-3xl font-bold">{bimodalScore} / 11 <span className="text-base font-normal">(bimodal)</span></p>
               <p className="text-sm mt-0.5">Likert: {likertScore}/33 | Physical: {physicalScore}/24 | Mental: {mentalScore}/9</p>
              <p className="font-semibold text-lg mt-1">{interp.label}</p>
            </div>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Onset, impact on work/ADL, sleep, contributing conditions..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between items-center">
          <span className="text-sm text-slate-500">{answered}/11 answered</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!allAnswered} className="bg-purple-600 hover:bg-purple-700"><Save className="w-4 h-4 mr-2" />Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}