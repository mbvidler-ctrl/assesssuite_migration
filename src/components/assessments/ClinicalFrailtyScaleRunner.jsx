import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";

const LEVELS = [
  { score: 1, label: "Very Fit", desc: "Robust, active, energetic, motivated and fit. These people commonly exercise regularly and are among the fittest for their age.", icon: "💪", color: "bg-green-100 border-green-400 text-green-900" },
  { score: 2, label: "Well", desc: "No active disease symptoms, but less fit than level 1. Often exercises or very active occasionally (e.g. seasonally).", icon: "🏃", color: "bg-green-50 border-green-300 text-green-800" },
  { score: 3, label: "Managing Well", desc: "Medical problems are well controlled, but not regularly active beyond routine walking.", icon: "🚶", color: "bg-lime-100 border-lime-400 text-lime-900" },
  { score: 4, label: "Vulnerable", desc: "While not dependent on others, symptoms often limit activities. A common complaint is slowing down and/or fatigue.", icon: "🧍", color: "bg-yellow-100 border-yellow-400 text-yellow-900" },
  { score: 5, label: "Mildly Frail", desc: "More evident slowing, need help with high order IADLs (finances, transportation, heavy housework). Typically impaired shopping and walking outside alone.", icon: "🦯", color: "bg-orange-100 border-orange-400 text-orange-900" },
  { score: 6, label: "Moderately Frail", desc: "Need help with all outside activities and with keeping house. Indoors, often have problems with stairs and need help with bathing.", icon: "👨‍🦽", color: "bg-orange-100 border-orange-500 text-orange-900" },
  { score: 7, label: "Severely Frail", desc: "Completely dependent for personal care, from whatever cause (physical or cognitive). Even so, they seem stable without high risk of dying (within ~6 months).", icon: "🛌", color: "bg-red-100 border-red-400 text-red-900" },
  { score: 8, label: "Very Severely Frail", desc: "Completely dependent, approaching end of life. Typically, they could not recover even from a minor illness.", icon: "🏥", color: "bg-red-200 border-red-500 text-red-900" },
  { score: 9, label: "Terminally Ill", desc: "Approaching the end of life. This category applies to people with a life expectancy <6 months who are not otherwise evidently frail.", icon: "🕊", color: "bg-red-300 border-red-600 text-red-900" },
];

export default function ClinicalFrailtyScaleRunner({ client, onSave, onClose }) {
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");

  const level = LEVELS.find(l => l.score === selected);

  const handleSave = () => {
    if (!selected) { toast.error("Select a frailty level"); return; }
    const soap = `• Clinical Frailty Scale (CFS)\n  Score: ${selected}/9 — ${level.label}\n  Description: ${level.desc}${notes ? `\n  Notes: ${notes}` : ""}\n  Interpretation: 1–3 = fit | 4 = vulnerable | 5–6 = frail | 7–8 = severely frail | 9 = terminally ill\n  Reference: Rockwood et al. (2005). A global clinical measure of fitness and frailty in elderly people. CMAJ, 173(5):489-495.`;
    onSave({ status: "completed", result_value: selected, notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "clinical_frailty_scale", frailty_label: level.label } });
    toast.success("Saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-purple-50 to-pink-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Clinical Frailty Scale</h2><p className="text-slate-500 text-sm mt-0.5">Rockwood 9-point global frailty assessment</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Instructions</p>
            <p>Select the score that best represents the patient's functional status. Base rating on their function 2 weeks prior to any acute illness. In acute illness, always score before the illness when possible.</p>
          </div>

          {LEVELS.map(l => (
            <button key={l.score} type="button" onClick={() => setSelected(l.score)} className={`w-full text-left rounded-xl border-2 p-4 transition-all ${selected === l.score ? l.color + " shadow-md ring-2 ring-offset-1 ring-blue-400" : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300"}`}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center font-bold text-slate-700 shrink-0">{l.score}</div>
                <div>
                  <p className="font-semibold">{l.icon} {l.label}</p>
                  <p className="text-sm mt-0.5 text-slate-600">{l.desc}</p>
                </div>
              </div>
            </button>
          ))}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Functional status, living situation, care needs, specific observations..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between items-center">
          <span className="text-sm text-slate-600">{selected ? `Score ${selected}: ${level?.label}` : "No selection"}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!selected} className="bg-purple-600 hover:bg-purple-700"><Save className="w-4 h-4 mr-2" />Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}