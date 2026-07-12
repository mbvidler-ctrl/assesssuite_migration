import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Info, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const ITEMS = [
  { id: "gait_level", label: "1. Gait on Level Surface" },
  { id: "change_speed", label: "2. Change in Gait Speed" },
  { id: "horizontal_head", label: "3. Gait with Horizontal Head Turns" },
  { id: "vertical_head", label: "4. Gait with Vertical Head Turns" },
  { id: "pivot_turn", label: "5. Gait and Pivot Turn" },
  { id: "over_obstacle", label: "6. Step Over Obstacle" },
  { id: "narrow_bos", label: "7. Gait with Narrow Base of Support" },
  { id: "eyes_closed", label: "8. Gait with Eyes Closed" },
  { id: "backwards", label: "9. Walking Backwards" },
  { id: "stairs", label: "10. Steps" },
];

const SCORE_LABELS = ["0 — Severe impairment", "1 — Moderate impairment", "2 — Mild impairment", "3 — Normal"];

function getInterpretation(score) {
  if (score >= 27) return { label: "Normal / Minimal Risk", color: "bg-green-100 text-green-800 border-green-300" };
  if (score >= 22) return { label: "Low Fall Risk", color: "bg-teal-100 text-teal-800 border-teal-300" };
  if (score >= 17) return { label: "Moderate Fall Risk", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  return { label: "High Fall Risk", color: "bg-red-100 text-red-800 border-red-300" };
}

export default function FunctionalGaitAssessmentFGARunner({ client, onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");
  const [showInfo, setShowInfo] = useState(true);

  const answered = Object.keys(scores).length;
  const allAnswered = answered === ITEMS.length;
  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  const interp = allAnswered ? getInterpretation(total) : null;

  const handleSave = () => {
    if (answered === 0) { toast.error("Please score at least one item before saving."); return; }
    const lines = ITEMS.map(it => `  ${it.label}: ${scores[it.id]}/3`).join("\n");
    const interpLabel = interp ? interp.label : "Partial assessment";
    const soap = `• Functional Gait Assessment (FGA)\n  Total Score: ${total}/30 — ${interpLabel}\n\n  Item Scores:\n${lines}${notes ? `\n\n  Notes: ${notes}` : ""}\n  Cutoff: <22/30 = fall risk in community-dwelling older adults\n  MCID: 4 points\n  Reference: Wrisley DM et al. (2004). Functional Gait Assessment: concurrent, discriminative, and predictive validity in community-dwelling older adults. Phys Ther, 84:906-918.`;
    onSave({ status: "completed", result_value: total, notes, assessment_date: todayLocal(), additional_data: { soap_text: soap, measurement_type: "performance_based", total_score: total, item_scores: scores, fall_risk: interpLabel } });
    toast.success("FGA saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white z-10 p-5 border-b flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Functional Gait Assessment</h2><p className="text-slate-500 text-sm mt-0.5">FGA — 10 items, 0–3 each (max 30)</p></div>
          {allAnswered && <div className={`px-3 py-1 rounded-full text-sm font-semibold border mr-2 ${interp.color}`}>{total}/30</div>}
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">

          {/* Clinician Info Panel */}
          <div className="border border-indigo-200 rounded-lg overflow-hidden">
            <button onClick={() => setShowInfo(v => !v)} className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 transition-colors">
              <span className="flex items-center gap-2 text-indigo-800 font-semibold text-sm"><Info className="w-4 h-4" />Clinician Information &amp; References</span>
              {showInfo ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4 text-indigo-600" />}
            </button>
            {showInfo && (
              <div className="px-4 py-4 space-y-4 text-sm bg-white">

                {/* Purpose */}
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Purpose</p>
                  <p className="text-xs text-slate-600">The Functional Gait Assessment (FGA) is a 10-item clinical tool designed to assess postural stability during walking tasks in individuals with neurological, vestibular, or balance-related disorders. It evaluates gait performance across a range of conditions including changes in speed, head turns, narrowed base of support, and stair climbing. It is commonly used to identify fall risk and track rehabilitation progress.</p>
                </div>

                {/* Administration */}
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Administration Instructions</p>
                  <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
                    <li>Ensure a clear, unobstructed walkway of at least 6 metres</li>
                    <li>Patient may use their usual gait aid (note this in clinical notes)</li>
                    <li>Demonstrate each task before the patient attempts it</li>
                    <li>Score 0–3 for each item based on observed gait quality and safety</li>
                    <li>Allow one practice trial per task if needed; score the formal attempt</li>
                    <li>Safety: stand close to patient, especially for tasks with eyes closed or narrow BOS</li>
                  </ul>
                </div>

                {/* Scoring */}
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Scoring Guide</p>
                  <div className="grid grid-cols-4 gap-1.5 text-xs text-center">
                    <div className="bg-red-50 border border-red-200 rounded p-2"><p className="font-bold text-red-700 text-base">0</p><p className="text-red-800">Severe impairment</p></div>
                    <div className="bg-orange-50 border border-orange-200 rounded p-2"><p className="font-bold text-orange-700 text-base">1</p><p className="text-orange-800">Moderate impairment</p></div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2"><p className="font-bold text-yellow-700 text-base">2</p><p className="text-yellow-800">Mild impairment</p></div>
                    <div className="bg-green-50 border border-green-200 rounded p-2"><p className="font-bold text-green-700 text-base">3</p><p className="text-green-800">Normal</p></div>
                  </div>
                </div>

                {/* Interpretation */}
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Interpretation (max 30)</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between bg-green-50 px-3 py-1.5 rounded"><span className="font-medium text-green-800">27–30</span><span className="text-green-700">Normal / Minimal fall risk</span></div>
                    <div className="flex justify-between bg-teal-50 px-3 py-1.5 rounded"><span className="font-medium text-teal-800">22–26</span><span className="text-teal-700">Low fall risk</span></div>
                    <div className="flex justify-between bg-yellow-50 px-3 py-1.5 rounded"><span className="font-medium text-yellow-800">17–21</span><span className="text-yellow-700">Moderate fall risk</span></div>
                    <div className="flex justify-between bg-red-50 px-3 py-1.5 rounded"><span className="font-medium text-red-800">&lt; 17</span><span className="text-red-700">High fall risk</span></div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Community-dwelling older adults: cutoff &lt;22/30. MCID: 4 points.</p>
                </div>

                {/* Psychometrics */}
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Psychometric Properties</p>
                  <ul className="text-xs text-slate-600 list-disc list-inside space-y-0.5">
                    <li>Excellent inter-rater reliability (ICC = 0.93)</li>
                    <li>Excellent test-retest reliability (ICC = 0.84)</li>
                    <li>Concurrent validity with Dynamic Gait Index (r = 0.93)</li>
                    <li>Predictive validity for falls in vestibular and older adult populations</li>
                  </ul>
                </div>

                {/* References */}
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Key References</p>
                  <div className="text-xs text-slate-600 space-y-1.5">
                    <p><strong>Wrisley DM, Marchetti GF, Kuharsky DK, Whitney SL.</strong> (2004). Reliability, internal consistency, and validity of data obtained with the Functional Gait Assessment. <em>Physical Therapy</em>, 84(10), 906–918.</p>
                    <p><strong>Walker ML et al.</strong> (2007). Reference group data for the Functional Gait Assessment. <em>Physical Therapy</em>, 87(11), 1468–1477.</p>
                    <p><strong>Beninato M, Portney LG, Sullivan PE.</strong> (2009). Using the International Classification of Functioning, Disability and Health as a framework to examine the association between falls and clinical assessment tools in people with stroke. <em>Physical Therapy</em>, 89(8), 816–825.</p>
                  </div>
                  <button onClick={() => window.open('https://www.sralab.org/rehabilitation-measures/functional-gait-assessment', '_blank')} className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    <ExternalLink className="w-3 h-3" /> Rehab Measures Database — FGA
                  </button>
                </div>
              </div>
            )}
          </div>

          {ITEMS.map(item => (
            <Card key={item.id} className={scores[item.id] !== undefined ? "border-indigo-200 bg-indigo-50/20" : ""}>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-700">{item.label}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map(v => (
                    <Button key={v} type="button" size="sm" variant={scores[item.id] === v ? "default" : "outline"} className={`flex flex-col h-auto py-2 text-xs ${scores[item.id] === v ? "bg-indigo-600 hover:bg-indigo-700" : ""}`} onClick={() => setScores(p => ({ ...p, [item.id]: v }))}>
                      <span className="font-bold text-base">{v}</span>
                      <span className="text-[9px] leading-tight text-center">{SCORE_LABELS[v].split("—")[1].trim().split(" ")[0]}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {allAnswered && (
            <div className={`border-2 rounded-xl p-4 text-center ${interp.color}`}>
              <p className="text-3xl font-bold">{total} / 30</p>
              <p className="font-semibold text-xl mt-1">{interp.label}</p>
            </div>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Gait aids, assistive device, environmental context..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between items-center">
          <span className="text-sm text-slate-500">{answered}/10 scored</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700"><Save className="w-4 h-4 mr-2" />Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}