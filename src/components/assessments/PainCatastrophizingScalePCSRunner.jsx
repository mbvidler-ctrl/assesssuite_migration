import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

// Subscale groupings (0-indexed)
// Rumination: items 8,9,10,11 (0-indexed: 7,8,9,10)
// Magnification: items 6,7,13 (0-indexed: 5,6,12)
// Helplessness: items 1,2,3,4,5,12 (0-indexed: 0,1,2,3,4,11)
const PCS_ITEMS = [
  { text: "I worry all the time about whether the pain will end.", subscale: "Helplessness" },
  { text: "I feel I can't go on.", subscale: "Helplessness" },
  { text: "It's terrible and I think it's never going to get any better.", subscale: "Helplessness" },
  { text: "It's awful and I feel that it overwhelms me.", subscale: "Helplessness" },
  { text: "I feel I can't stand it anymore.", subscale: "Helplessness" },
  { text: "I become afraid that the pain will get worse.", subscale: "Magnification" },
  { text: "I keep thinking of other painful events.", subscale: "Magnification" },
  { text: "I anxiously want the pain to go away.", subscale: "Rumination" },
  { text: "I can't seem to keep it out of my mind.", subscale: "Rumination" },
  { text: "I keep thinking about how much it hurts.", subscale: "Rumination" },
  { text: "I keep thinking about how badly I want the pain to stop.", subscale: "Rumination" },
  { text: "There's nothing I can do to reduce the intensity of the pain.", subscale: "Helplessness" },
  { text: "I wonder whether something serious may happen.", subscale: "Magnification" },
];

const SCORE_LABELS = ["0 – Not at all", "1 – Slight", "2 – Moderate", "3 – Great degree", "4 – All the time"];

function getInterpretation(total) {
  if (total <= 20) return { level: "Low Catastrophizing", color: "text-green-700", bg: "bg-green-50 border-green-300", desc: "Scores ≤20 suggest minimal pain catastrophizing. Client is unlikely to have significant psychological barriers to recovery." };
  if (total <= 29) return { level: "Moderate Catastrophizing", color: "text-orange-700", bg: "bg-orange-50 border-orange-300", desc: "Scores 21–29 indicate moderate catastrophizing. Consider addressing cognitive barriers alongside physical rehabilitation." };
  return { level: "High Catastrophizing (Clinically Significant)", color: "text-red-700", bg: "bg-red-50 border-red-300", desc: "Scores ≥30 are clinically significant. Strong predictor of poor outcomes. Referral to psychology or pain management may be warranted." };
}

export default function PainCatastrophizingScalePCSRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState(Array(13).fill(null));
  const [notes, setNotes] = useState("");

  const answered = responses.filter(r => r !== null).length;
  const totalScore = responses.every(r => r !== null) ? responses.reduce((s, v) => s + v, 0) : null;

  const rumination = [7,8,9,10].reduce((s,i) => s + (responses[i] ?? 0), 0);
  const magnification = [5,6,12].reduce((s,i) => s + (responses[i] ?? 0), 0);
  const helplessness = [0,1,2,3,4,11].reduce((s,i) => s + (responses[i] ?? 0), 0);

  const interp = totalScore !== null ? getInterpretation(totalScore) : null;

  const handleSubmit = () => {
    if (responses.includes(null)) {
      toast.error("Please answer all 13 questions.");
      return;
    }

    const soapLines = [
      `• Pain Catastrophizing Scale (PCS)`,
      `  Total Score: ${totalScore}/52 → ${interp.level}`,
      `  Subscale Scores:`,
      `    - Rumination: ${rumination}/16`,
      `    - Magnification: ${magnification}/12`,
      `    - Helplessness: ${helplessness}/24`,
      `  Item Responses:`,
      ...PCS_ITEMS.map((item, i) => `    Q${i+1} [${item.subscale}] (score: ${responses[i]}): ${item.text}`),
      `  Clinical Significance: Scores ≥30 indicate clinically significant catastrophizing (Sullivan et al., 1995)`,
      `  Interpretation: ${interp.desc}`,
      notes ? `  Clinical Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        measurement_type: "questionnaire",
        total_score: totalScore,
        rumination,
        magnification,
        helplessness,
        interpretation: interp.level,
        responses: responses.reduce((obj, v, i) => ({ ...obj, [`q${i+1}`]: v }), {}),
        soap_text: soapLines,
      },
      notes: notes || `Total: ${totalScore}/52 | Rumination: ${rumination} | Magnification: ${magnification} | Helplessness: ${helplessness}`,
      assessment_date: new Date().toISOString().split("T")[0],
    });

    toast.success("PCS saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-start z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Pain Catastrophizing Scale (PCS)</h2>
            <p className="text-sm text-slate-500">Sullivan et al., 1995 — 13-item self-report questionnaire</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Clinical context */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-2">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" /> Clinician Guidance</p>
            <p>The PCS measures the extent to which a person experiences catastrophic thinking about pain. It has three subscales: <strong>Rumination</strong> (inability to stop thinking about pain), <strong>Magnification</strong> (exaggerating threat), and <strong>Helplessness</strong> (inability to cope).</p>
            <p><strong>Clinical cut-off: ≥30</strong> is considered clinically significant and is associated with increased disability, prolonged recovery, and poor response to standard treatment.</p>
            <p><strong>Script:</strong> "Please read each statement and indicate the degree to which you have these thoughts and feelings when you are experiencing pain. Use the 0–4 scale — 0 means not at all, 4 means all the time."</p>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            {PCS_ITEMS.map((item, index) => (
              <div key={index} className="border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-slate-400 mt-0.5 w-6 shrink-0">{index + 1}.</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{item.text}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{item.subscale}</p>
                  </div>
                  {responses[index] !== null && (
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{responses[index]}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {[0,1,2,3,4].map(v => (
                    <button
                      key={v}
                      onClick={() => {
                        const r = [...responses]; r[index] = v; setResponses(r);
                      }}
                      className={`flex-1 min-w-[52px] text-xs py-2 px-1 rounded border transition-all ${
                        responses[index] === v
                          ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-400 px-1">
                  <span>Not at all</span><span>All the time</span>
                </div>
              </div>
            ))}
          </div>

          {/* Running score */}
          {answered > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-slate-700">Running Score ({answered}/13 answered)</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white border rounded p-2">
                  <p className="text-xs text-slate-500">Rumination</p>
                  <p className="text-lg font-bold text-slate-800">{rumination}<span className="text-xs text-slate-400">/16</span></p>
                </div>
                <div className="bg-white border rounded p-2">
                  <p className="text-xs text-slate-500">Magnification</p>
                  <p className="text-lg font-bold text-slate-800">{magnification}<span className="text-xs text-slate-400">/12</span></p>
                </div>
                <div className="bg-white border rounded p-2">
                  <p className="text-xs text-slate-500">Helplessness</p>
                  <p className="text-lg font-bold text-slate-800">{helplessness}<span className="text-xs text-slate-400">/24</span></p>
                </div>
              </div>
              {totalScore !== null && (
                <div className="text-center pt-1">
                  <p className="text-xl font-bold text-slate-900">Total: {totalScore}<span className="text-sm text-slate-500">/52</span></p>
                </div>
              )}
            </div>
          )}

          {/* Interpretation */}
          {interp && (
            <div className={`border rounded-xl p-4 space-y-1 text-sm ${interp.bg}`}>
              <p className={`font-bold text-base ${interp.color}`}>{interp.level}</p>
              <p className={interp.color}>{interp.desc}</p>
              {totalScore >= 30 && (
                <div className="flex items-start gap-2 mt-2 bg-white/60 rounded p-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <p className="text-red-700 text-xs font-medium">Consider referral to psychology or pain management. Document in treatment plan.</p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="font-medium">Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Context, barriers, referral considerations..."
              className="mt-1"
            />
          </div>

          {/* References */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">References</p>
            <p>• Sullivan MJL, Bishop SR, Pivik J. The Pain Catastrophizing Scale: Development and validation. <em>Psychol Assess.</em> 1995;7(4):524–532.</p>
            <p>• Osman A, et al. The Pain Catastrophizing Scale: Further psychometric evaluation. <em>J Behav Med.</em> 2000;23(4):351–365.</p>
            <p>• Sullivan MJL. The Pain Catastrophizing Scale: User manual. 2009.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-slate-50 px-6 py-4 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Cancel</Button>
          <Button onClick={handleSubmit} disabled={answered < 13} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />Save PCS
          </Button>
        </div>
      </div>
    </div>
  );
}