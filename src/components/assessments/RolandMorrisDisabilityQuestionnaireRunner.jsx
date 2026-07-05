import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";

const STATEMENTS = [
  "Because of my back (or leg) pain, I am unable to care for myself without my partner's help.",
  "Because of my back (or leg) pain, I am limited in my work or other regular daily activities.",
  "Because of my back (or leg) pain, I try to handle my back (leg) pain by treating it myself, without seeing a doctor.",
  "Because of my back (or leg) pain, I get less sleep than usual.",
  "Because of my back (or leg) pain, I rest more often during the day than usual.",
  "Because of my back (or leg) pain, some of my home responsibilities are not being done.",
  "Because of my back (or leg) pain, I am more irritable and bad tempered with people than usual.",
  "Because of my back (or leg) pain, I find it difficult to get into or out of bed.",
  "Because of my back (or leg) pain, I walk more slowly than usual.",
  "Because of my back (or leg) pain, I do not do any of the jobs that I usually do around the house.",
  "Because of my back (or leg) pain, I am more confined to my chair.",
  "Because of my back (or leg) pain, I only stand for short periods of time.",
  "Because of my back (or leg) pain, I try not to bend or kneel down.",
  "Because of my back (or leg) pain, I find it difficult to get out of a chair.",
  "Because of my back (or leg) pain, my appetite is not very good.",
  "Because of my back (or leg) pain, I have trouble putting on my shoes or socks.",
  "Because of my back (or leg) pain, I only walk short distances.",
  "Because of my back (or leg) pain, I sleep in a different room than usual.",
  "Because of my back (or leg) pain, most of the time my back is painful.",
  "Because of my back (or leg) pain, I change position frequently to try to get my back comfortable.",
  "Because of my back (or leg) pain, I am afraid that I might fall in the bathroom.",
  "Because of my back (or leg) pain, I use a handrail to get upstairs.",
  "Because of my back (or leg) pain, I hold on to something to get off a toilet.",
  "Because of my back (or leg) pain, I am afraid I might fall at home, even if I try to be careful.",
];

export default function RolandMorrisDisabilityQuestionnaireRunner({ client, onSave, onClose }) {
  const [checked, setChecked] = useState(Array(24).fill(false));
  const [notes, setNotes] = useState("");

  const total = checked.filter(Boolean).length;

  const getInterpretation = (score) => {
    if (score === 0) return "No disability";
    if (score <= 4) return "Minimal disability";
    if (score <= 8) return "Moderate disability";
    if (score <= 16) return "Severe disability";
    return "Very severe disability";
  };

  const handleSave = () => {
    const checkedItems = checked.map((c, i) => c ? i + 1 : null).filter(x => x !== null);
    const checkedLines = checkedItems.length > 0 ? `\n  Items answered 'yes': ${checkedItems.join(", ")}` : "";
    const soap = `• Roland-Morris Disability Questionnaire\n  Total Score: ${total}/24 — ${getInterpretation(total)}${checkedLines}${notes ? `\n  Notes: ${notes}` : ""}\n  Interpretation: 0 = no disability | 1–4 = minimal | 5–8 = moderate | 9–16 = severe | 17+ = very severe\n  MCID: 5 points\n  Reference: Roland & Morris (1983). Back pain measures and outcome prediction for acute admissions to hospital following the occurrence of low back pain.`;
    onSave({ status: "completed", result_value: total, notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "questionnaire", items_checked: checked, disability_level: getInterpretation(total) } });
    toast.success("Saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Roland-Morris Disability Questionnaire</h2><p className="text-slate-500 text-sm mt-0.5">Back pain disability assessment — 24 items</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />📋 Administration Instructions</p>
            <p>Patient self-completes. Refers to <strong>today</strong> (current status). Check only the statements that are true for the patient due to back or leg pain.</p>
            <p className="italic">"Check only the statements that describe you today due to your back (or leg) pain. Some questions may look similar but they are all different — please tick all that apply."</p>
            <p><strong>Note:</strong> Count only items ticked as true = total score. Items not ticked = 0. No partial scoring.</p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 Score Interpretation (/24)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Score</th><th className="p-2 text-left">Disability Level</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">0</td><td className="p-2 text-green-700">No disability</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">1–4</td><td className="p-2 text-teal-700">Minimal disability</td></tr>
                  <tr className="border-t"><td className="p-2">5–8</td><td className="p-2 text-yellow-700">Moderate disability</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">9–16</td><td className="p-2 text-orange-700">Severe disability</td></tr>
                  <tr className="border-t"><td className="p-2">17–24</td><td className="p-2 text-red-700">Very severe disability</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">MCID: 5 points. Higher scores = greater disability. Source: Roland & Morris (1983).</p>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Roland M & Morris R. (1983). A study of the natural history of back pain. Part I: Development of a reliable and sensitive measure of disability in low-back pain. <em>Spine, 8</em>(2), 141–144.</p>
          </div>

          <div className="space-y-2">
            {STATEMENTS.map((statement, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200">
                <Checkbox id={`q${i}`} checked={checked[i]} onCheckedChange={c => { const n = [...checked]; n[i] = c; setChecked(n); }} className="mt-1.5" />
                <label htmlFor={`q${i}`} className="text-sm text-slate-700 leading-snug cursor-pointer flex-1">{statement}</label>
              </div>
            ))}
          </div>

          {total > 0 && (
            <Card className={`${total <= 4 ? "bg-green-50 border-green-300" : total <= 8 ? "bg-yellow-50 border-yellow-300" : total <= 16 ? "bg-orange-50 border-orange-300" : "bg-red-50 border-red-300"} border-2`}>
              <CardContent className="py-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-slate-900">{total} / 24</p>
                  <p className="font-semibold text-lg mt-1">{getInterpretation(total)}</p>
                  <p className="text-xs text-slate-600 mt-2">0=none | 1–4=minimal | 5–8=moderate | 9–16=severe | 17+=very severe</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Functional limitations, impact on work/ADL, pain characteristics..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between items-center">
          <span className="text-sm font-medium">{total} items checked</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" />Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}