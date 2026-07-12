import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const BILATERAL_ITEMS = [
  {
    key: "littleFinger",
    label: "Little Finger",
    description: "Passive dorsiflexion of 5th MCP joint >90°",
  },
  {
    key: "thumb",
    label: "Thumb",
    description: "Passive apposition of thumb to flexor aspect of forearm",
  },
  {
    key: "elbow",
    label: "Elbow",
    description: "Hyperextension of elbow >10°",
  },
  {
    key: "knee",
    label: "Knee",
    description: "Hyperextension of knee >10°",
  },
];

function ScoreToggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-12 h-10 rounded-lg border-2 text-sm font-bold transition-all ${
        checked
          ? "bg-orange-500 border-orange-600 text-white"
          : "bg-white border-slate-300 text-slate-400 hover:border-slate-400"
      }`}
    >
      {checked ? "1" : "0"}
    </button>
  );
}

export default function BeightonHypermobilityScoreRunner({ client, onSave, onClose }) {
  const [scores, setScores] = useState({
    leftLittleFinger: false,
    rightLittleFinger: false,
    leftThumb: false,
    rightThumb: false,
    leftElbow: false,
    rightElbow: false,
    leftKnee: false,
    rightKnee: false,
    trunkFlexion: false,
  });
  const [notes, setNotes] = useState("");

  const toggle = (key) => setScores(prev => ({ ...prev, [key]: !prev[key] }));

  const total = Object.values(scores).filter(Boolean).length;

  const getClassification = (score) => {
    if (score >= 5) return { label: "Hypermobility Likely", color: "text-orange-600", bg: "bg-orange-50 border-orange-200" };
    if (score === 4) return { label: "Borderline", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" };
    return { label: "Below Threshold", color: "text-green-600", bg: "bg-green-50 border-green-200" };
  };

  const classification = getClassification(total);

  const handleSave = () => {
    const positiveItems = Object.entries(scores)
      .filter(([, v]) => v)
      .map(([k]) => k.replace(/([A-Z])/g, ' $1').trim());

    let soapText = `• Beighton Hypermobility Score: ${total}/9 — ${classification.label}\n`;
    soapText += `  Bilateral items:\n`;
    BILATERAL_ITEMS.forEach(item => {
      const left = scores[`left${item.key.charAt(0).toUpperCase() + item.key.slice(1)}`];
      const right = scores[`right${item.key.charAt(0).toUpperCase() + item.key.slice(1)}`];
      soapText += `    ${item.label}: L ${left ? "+" : "−"} | R ${right ? "+" : "−"}\n`;
    });
    soapText += `  Trunk flexion (palms flat, knees straight): ${scores.trunkFlexion ? "+" : "−"}\n`;
    if (positiveItems.length === 0) soapText += `  No positive items\n`;
    if (notes) soapText += `  Notes: ${notes}\n`;

    onSave({
      status: "completed",
      result_value: total,
      additional_data: {
        soap_text: soapText,
        measurement_type: "beighton_hypermobility",
        scores,
        classification: classification.label,
      },
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("Assessment saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-5 border-b bg-gradient-to-r from-orange-50 to-amber-50 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Beighton Hypermobility Score</h2>
            <p className="text-sm text-slate-500 mt-0.5">9-point scale — passive range of motion only</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Clinician Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-2">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" /> Clinician Instructions</p>
            <p><strong>Protocol:</strong> All items assessed passively. Do not apply force beyond the point of resistance. Record only ROM achieved passively.</p>
            <ul className="list-disc ml-5 space-y-1 text-xs mt-2">
              <li><strong>Little fingers:</strong> Passive dorsiflexion of 5th MCP joint &gt;90° — 1 point each side</li>
              <li><strong>Thumbs:</strong> Passive apposition of thumb to flexor aspect of forearm — 1 point each side</li>
              <li><strong>Elbows:</strong> Passive hyperextension &gt;10° — 1 point each side</li>
              <li><strong>Knees:</strong> Passive hyperextension &gt;10° — 1 point each side</li>
              <li><strong>Trunk:</strong> Standing forward flexion — palms flat on floor with knees straight — 1 point</li>
            </ul>
            <p className="text-xs text-blue-700 mt-1 italic">Tap each button to toggle 0/1 for each item. Live score updates automatically.</p>
          </div>

          {/* Live Score Banner */}
          <div className={`rounded-xl border-2 p-4 flex items-center justify-between ${classification.bg}`}>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total Score</p>
              <p className={`text-4xl font-bold ${classification.color}`}>{total}<span className="text-xl font-normal text-slate-400">/9</span></p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${classification.color}`}>{classification.label}</p>
              <p className="text-xs text-slate-500 mt-1">
                {total >= 5 ? "Screen for hEDS/HSD per 2017 criteria" : total === 4 ? "Consider age, sex, and symptoms" : "Hypermobility syndrome unlikely"}
              </p>
            </div>
          </div>

          {/* Bilateral Scoring Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700">Bilateral Items (1 pt per side)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 w-1/2">Test Item</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 w-1/4">Left</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 w-1/4">Right</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BILATERAL_ITEMS.map((item, i) => {
                      const leftKey = `left${item.key.charAt(0).toUpperCase() + item.key.slice(1)}`;
                      const rightKey = `right${item.key.charAt(0).toUpperCase() + item.key.slice(1)}`;
                      return (
                        <tr key={item.key} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">{item.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <ScoreToggle checked={scores[leftKey]} onChange={() => toggle(leftKey)} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <ScoreToggle checked={scores[rightKey]} onChange={() => toggle(rightKey)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Trunk Flexion — Axial Item */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700">Axial Item (1 pt)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">Trunk Flexion</p>
                  <p className="text-xs text-slate-500 mt-0.5">Standing forward flexion — palms flat on floor, knees fully extended</p>
                </div>
                <ScoreToggle checked={scores.trunkFlexion} onChange={() => toggle("trunkFlexion")} />
              </div>
            </CardContent>
          </Card>

          {/* Score Interpretation Table */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 Score Interpretation (Beighton Criteria)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200">
                  <tr>
                    <th className="p-2 text-left">Score</th>
                    <th className="p-2 text-left">Classification</th>
                    <th className="p-2 text-left">Clinical Note</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">≥5/9</td><td className="p-2 text-orange-600 font-semibold">Hypermobility Likely</td><td className="p-2">Screen for hEDS/HSD per 2017 criteria</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">4/9</td><td className="p-2 text-yellow-600 font-semibold">Borderline</td><td className="p-2">Contextual — consider age, sex, symptoms</td></tr>
                  <tr className="border-t"><td className="p-2">≤3/9</td><td className="p-2 text-green-600 font-semibold">Below Threshold</td><td className="p-2">Hypermobility syndrome unlikely</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">Note: Beighton score alone is insufficient for hEDS diagnosis. 2017 criteria also require musculoskeletal symptoms and absence of alternative diagnoses. Threshold may vary (≥4 in post-pubertal adults).</p>
          </div>

          {/* References */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 References</p>
            <p>Beighton P, Solomon L, & Soskolne CL. (1973). Articular mobility in an African population. <em>Annals of the Rheumatic Diseases, 32</em>(5), 413–418.</p>
            <p>Malfait F et al. (2017). The 2017 international classification of the Ehlers-Danlos syndromes. <em>American Journal of Medical Genetics Part C, 175</em>(1), 8–26.</p>
            <p>Hakim AJ & Grahame R. (2003). A simple questionnaire to detect hypermobility: an adjunct to the assessment of patients with diffuse musculoskeletal pain. <em>International Journal of Clinical Practice, 57</em>(3), 163–166.</p>
          </div>

          {/* Clinical Notes */}
          <div>
            <Label>Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Pain responses, functional limitations, symptom history, previous diagnoses..."
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-slate-50 flex justify-between shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-orange-600 hover:bg-orange-700">
            <Save className="w-4 h-4 mr-2" /> Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}