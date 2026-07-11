import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const LEVELS = [
  { score: 0, label: "Non-functional", desc: "Cannot ambulate, or requires assistance of 2 or more people.", color: "bg-red-100 text-red-800 border-red-300" },
  { score: 1, label: "Ambulatory — dependent Level II", desc: "Requires continuous manual contact from 1 person (support/balance).", color: "bg-red-100 text-red-800 border-red-300" },
  { score: 2, label: "Ambulatory — dependent Level I", desc: "Requires continuous or intermittent touching by person (balance/guarding).", color: "bg-orange-100 text-orange-800 border-orange-300" },
  { score: 3, label: "Ambulatory — dependent supervision", desc: "Requires verbal cuing or supervisory presence without physical contact.", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { score: 4, label: "Ambulatory — independent on level", desc: "Can walk independently on level surfaces only (not on stairs/ramps/uneven terrain).", color: "bg-teal-100 text-teal-800 border-teal-300" },
  { score: 5, label: "Ambulatory — independent", desc: "Can walk independently on level surfaces and non-level surfaces, stairs, and ramps.", color: "bg-green-100 text-green-800 border-green-300" },
];

export default function FunctionalAmbulationCategoriesFACRunner({ client, onSave, onClose }) {
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");

  const level = selected !== null ? LEVELS[selected] : null;

  const handleSave = () => {
    if (selected === null) { toast.error("Select an ambulation level"); return; }
    const soap = `• Functional Ambulation Categories (FAC)\n  Score: ${level.score}/5 — ${level.label}\n  Description: ${level.desc}${notes ? `\n  Notes: ${notes}` : ""}\n  FAC measures functional walking ability and dependence level.\n  Scores 0-2 = dependent; 3 = supervised; 4-5 = independent\n  MCID: 1 category point\n  Reference: Holden MK et al. (1984). Clinical gait assessment in the neurologically impaired. Phys Ther, 64(1):35-40.`;
    onSave({ status: "completed", result_value: level.score, notes, assessment_date: todayLocal(), additional_data: { soap_text: soap, measurement_type: "ordinal_scale", score: level.score, label: level.label } });
    toast.success("FAC saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Functional Ambulation Categories</h2><p className="text-slate-500 text-sm mt-0.5">FAC — 6-level walking ability scale (0–5)</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Instructions</p>
            <p>Observe the patient walking and select the category that best describes their current ambulatory status. Consider all walking environments observed.</p>
          </div>

          <div className="space-y-2">
            {LEVELS.map(lvl => (
              <button key={lvl.score} type="button" onClick={() => setSelected(lvl.score)} className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selected === lvl.score ? `${lvl.color} border-opacity-100` : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>
                <div className="flex items-start gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${selected === lvl.score ? "bg-white/70" : "bg-slate-100 text-slate-600"}`}>{lvl.score}</span>
                  <div>
                    <p className="font-semibold">{lvl.label}</p>
                    <p className="text-sm text-slate-600 mt-0.5">{lvl.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {level && (
            <div className={`border-2 rounded-xl p-4 text-center ${level.color}`}>
              <p className="text-3xl font-bold">{level.score} / 5</p>
              <p className="font-semibold text-lg mt-1">{level.label}</p>
            </div>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Gait aids, footwear, terrain observed, safety..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={selected === null} className="bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}