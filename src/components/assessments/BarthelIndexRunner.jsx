import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

const ITEMS = [
  {
    key: "feeding",
    label: "Feeding",
    description: "Ability to eat from a tray or plate when food is within reach.",
    options: [
      { value: 0, label: "0 – Unable (needs to be fed)" },
      { value: 5, label: "5 – Needs help (cutting, spreading butter, etc.)" },
      { value: 10, label: "10 – Independent (food provided within reach)" },
    ],
  },
  {
    key: "bathing",
    label: "Bathing",
    description: "Ability to bath or shower independently.",
    options: [
      { value: 0, label: "0 – Dependent" },
      { value: 5, label: "5 – Independent (bath, shower, or sponge bath)" },
    ],
  },
  {
    key: "grooming",
    label: "Grooming / Personal Hygiene",
    description: "Face washing, hair combing, shaving, teeth cleaning.",
    options: [
      { value: 0, label: "0 – Needs help" },
      { value: 5, label: "5 – Independent (implements provided)" },
    ],
  },
  {
    key: "dressing",
    label: "Dressing",
    description: "Ability to dress and undress, including buttons/zips and braces.",
    options: [
      { value: 0, label: "0 – Dependent" },
      { value: 5, label: "5 – Needs help (≥50% of task independently)" },
      { value: 10, label: "10 – Independent (including buttons, zips, braces)" },
    ],
  },
  {
    key: "bowelControl",
    label: "Bowel Control",
    description: "Ability to control bowels over the previous week.",
    options: [
      { value: 0, label: "0 – Incontinent (or needs enemas)" },
      { value: 5, label: "5 – Occasional accident (≤1/week)" },
      { value: 10, label: "10 – Continent" },
    ],
  },
  {
    key: "bladderControl",
    label: "Bladder Control",
    description: "Ability to control bladder over the previous week (or manages catheter).",
    options: [
      { value: 0, label: "0 – Incontinent / catheter not self-managed" },
      { value: 5, label: "5 – Occasional accident (≤1/24h)" },
      { value: 10, label: "10 – Continent (or self-manages catheter)" },
    ],
  },
  {
    key: "toiletUse",
    label: "Toilet Use",
    description: "Use of toilet or commode, including clothing and hygiene.",
    options: [
      { value: 0, label: "0 – Dependent" },
      { value: 5, label: "5 – Needs some help but can do some tasks independently" },
      { value: 10, label: "10 – Independent (on/off, dressing, wiping)" },
    ],
  },
  {
    key: "transfers",
    label: "Transfers (Bed ↔ Chair)",
    description: "Moving from bed to chair and back.",
    options: [
      { value: 0, label: "0 – Unable (no sitting balance)" },
      { value: 5, label: "5 – Major help (1–2 people, physical), can sit" },
      { value: 10, label: "10 – Minor help (verbal/physical)" },
      { value: 15, label: "15 – Independent" },
    ],
  },
  {
    key: "mobility",
    label: "Mobility (on level surfaces)",
    description: "Ability to walk on level ground or propel a wheelchair.",
    options: [
      { value: 0, label: "0 – Immobile or < 50 m" },
      { value: 5, label: "5 – Wheelchair independent ≥ 50 m" },
      { value: 10, label: "10 – Walks with help (verbal/physical) ≥ 50 m" },
      { value: 15, label: "15 – Independent (may use aid) ≥ 50 m" },
    ],
  },
  {
    key: "stairs",
    label: "Stairs",
    description: "Ability to ascend and descend a flight of stairs.",
    options: [
      { value: 0, label: "0 – Unable" },
      { value: 5, label: "5 – Needs help (verbal, physical, or carrying aid)" },
      { value: 10, label: "10 – Independent (may use rail or aid)" },
    ],
  },
];

function getInterpretation(score) {
  if (score >= 100) return { label: "Fully Independent", color: "text-green-700", bg: "bg-green-50 border-green-200" };
  if (score >= 80)  return { label: "Minimal Dependence", color: "text-green-600", bg: "bg-green-50 border-green-200" };
  if (score >= 60)  return { label: "Partial Dependence", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" };
  if (score >= 40)  return { label: "Moderate Dependence", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" };
  return { label: "High Dependence", color: "text-red-700", bg: "bg-red-50 border-red-200" };
}

export default function BarthelIndexRunner({ client, assessment, onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const answered = Object.keys(scores).length;
  const allAnswered = answered === ITEMS.length;
  const interp = allAnswered ? getInterpretation(totalScore) : null;

  const handleSave = () => {
    if (!allAnswered) {
      toast.error("Please rate all 10 items before saving.");
      return;
    }

    const lines = ITEMS.map(item => {
      const selected = item.options.find(o => o.value === scores[item.key]);
      return `  • ${item.label}: ${selected ? selected.label : scores[item.key]}`;
    });

    const soap_text =
      `Barthel Index — Total Score: ${totalScore}/100\n` +
      `Functional Independence Level: ${interp.label}\n\n` +
      `Item Scores:\n${lines.join("\n")}` +
      (notes ? `\n\nClinical Notes: ${notes}` : "");

    onSave({
      result_value: totalScore,
      additional_data: {
        measurement_type: "questionnaire",
        soap_text,
        interpretation: interp.label,
        item_scores: scores,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
  };

  return (
    <div className="bg-white rounded-xl w-full flex flex-col overflow-hidden" style={{maxHeight: '85vh'}}>
        {/* Header */}
        <div className="p-5 border-b bg-gradient-to-r from-blue-50 to-slate-50 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Barthel Index</h2>
            <p className="text-sm text-slate-500 mt-0.5">Activities of Daily Living — 10 items, 0–100</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Scrollable items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800">
              Rate each item based on the client's <strong>actual performance</strong> in the past week, not their potential ability. 
              Score reflects what they <em>do</em>, not what they <em>could</em> do. Use observation, interview, or medical records.
            </p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2">
            <p className="font-semibold text-slate-700">📊 Score Interpretation</p>
            <div className="overflow-x-auto">
              <table className="w-full border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Score</th><th className="p-2 text-left">Classification</th><th className="p-2 text-left">Clinical Implication</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">100</td><td className="p-2">Fully Independent</td><td className="p-2">No support needed for basic ADLs</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">80–99</td><td className="p-2">Minimal Dependence</td><td className="p-2">Mostly independent; minor assistance</td></tr>
                  <tr className="border-t"><td className="p-2">60–79</td><td className="p-2">Partial Dependence</td><td className="p-2">Some help needed; community living possible</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">40–59</td><td className="p-2">Moderate Dependence</td><td className="p-2">Significant support required</td></tr>
                  <tr className="border-t"><td className="p-2">&lt;40</td><td className="p-2">High Dependence</td><td className="p-2">Major care needs; consider residential care</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-slate-500">MCID: 1.85 points. Score ≥60 associated with community discharge after stroke. Source: Mahoney & Barthel (1965).</p>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Mahoney FI & Barthel DW. (1965). Functional evaluation: the Barthel Index. <em>Maryland State Medical Journal, 14</em>, 61–65.</p>
            <p>Collin C et al. (1988). The Barthel ADL Index: a reliability study. <em>International Disability Studies, 10</em>(2), 61–63.</p>
          </div>
          {ITEMS.map((item, idx) => (
            <div key={item.key} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-1">
                <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 pl-7">
                {item.options.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setScores(prev => ({ ...prev, [item.key]: opt.value }))}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                      scores[item.key] === opt.value
                        ? "bg-blue-600 text-white border-blue-600 font-medium"
                        : "bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Notes */}
          <div>
            <Label>Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional observations, context, or clinical comments..."
              className="mt-1"
            />
          </div>
        </div>

        {/* Footer with live score */}
        <div className="p-4 border-t bg-slate-50 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">{answered}/10 items rated</div>
              {allAnswered && interp && (
                <div className={`mt-1 px-3 py-1 rounded-full border text-sm font-semibold inline-block ${interp.bg} ${interp.color}`}>
                  Score: {totalScore}/100 — {interp.label}
                </div>
              )}
              {!allAnswered && answered > 0 && (
                <div className="text-lg font-bold text-slate-700">Running total: {totalScore}</div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={!allAnswered} className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" /> Save Assessment
              </Button>
            </div>
          </div>
        </div>
    </div>
  );
}