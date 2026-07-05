import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";

const LEVELS = [
  { score: -7, label: "A very great deal worse", color: "bg-red-200 text-red-900 border-red-400" },
  { score: -6, label: "A great deal worse", color: "bg-red-100 text-red-800 border-red-300" },
  { score: -5, label: "Quite a bit worse", color: "bg-red-100 text-red-800 border-red-300" },
  { score: -4, label: "Moderately worse", color: "bg-orange-100 text-orange-800 border-orange-300" },
  { score: -3, label: "Somewhat worse", color: "bg-orange-100 text-orange-800 border-orange-300" },
  { score: -2, label: "A little worse", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { score: -1, label: "A tiny bit worse", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { score: 0, label: "About the same (no change)", color: "bg-slate-100 text-slate-700 border-slate-300" },
  { score: 1, label: "A tiny bit better", color: "bg-lime-100 text-lime-800 border-lime-300" },
  { score: 2, label: "A little better", color: "bg-green-100 text-green-800 border-green-300" },
  { score: 3, label: "Somewhat better", color: "bg-green-100 text-green-800 border-green-300" },
  { score: 4, label: "Moderately better", color: "bg-green-200 text-green-800 border-green-400" },
  { score: 5, label: "Quite a bit better", color: "bg-teal-100 text-teal-800 border-teal-300" },
  { score: 6, label: "A great deal better", color: "bg-teal-200 text-teal-800 border-teal-400" },
  { score: 7, label: "A very great deal better", color: "bg-emerald-200 text-emerald-900 border-emerald-400" },
];

export default function GlobalRatingofChangeScaleGROCRunner({ client, onSave, onClose }) {
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");

  const level = selected !== null ? LEVELS.find(l => l.score === selected) : null;
  const clinicalMeaning = selected !== null
    ? selected >= 2 ? "Clinically meaningful improvement"
    : selected <= -2 ? "Clinically meaningful deterioration"
    : selected === 0 ? "No change"
    : "Below threshold for meaningful change (±1)"
    : null;

  const handleSave = () => {
    const soap = `• Global Rating of Change Scale (GROC)\n  Score: ${selected > 0 ? "+" : ""}${selected} / +7\n  Response: "${level.label}"\n  Interpretation: ${clinicalMeaning}${notes ? `\n  Notes: ${notes}` : ""}\n  MCID: ±2 points (±1 is below threshold for meaningful change)\n  Reference: Jaeschke R et al. (1989). Measurement of health status: ascertaining the minimal clinically important difference. Control Clin Trials, 10(4):407-15.`;
    onSave({ status: "completed", result_value: selected, notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "patient_reported", score: selected, label: level.label, clinical_meaning: clinicalMeaning } });
    toast.success("GROC saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-green-50 to-teal-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Global Rating of Change Scale</h2><p className="text-slate-500 text-sm mt-0.5">GROC — Patient-reported change (−7 to +7)</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Instructions for Patient</p>
            <p>Compared to when you first sought treatment, how would you describe your condition <strong>overall</strong>? Please select the option that best describes your current state.</p>
          </div>

          <div className="space-y-1.5">
            {[...LEVELS].reverse().map(lvl => (
              <button key={lvl.score} type="button" onClick={() => setSelected(lvl.score)} className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-sm ${selected === lvl.score ? `${lvl.color} font-semibold` : "border-slate-200 hover:bg-slate-50"}`}>
                <span className={`w-10 text-center font-bold text-base shrink-0 ${selected === lvl.score ? "" : "text-slate-400"}`}>{lvl.score > 0 ? "+" : ""}{lvl.score}</span>
                <span>{lvl.label}</span>
              </button>
            ))}
          </div>

          {level && (
            <div className={`border-2 rounded-xl p-4 text-center ${level.color}`}>
              <p className="text-3xl font-bold">{selected > 0 ? "+" : ""}{selected}</p>
              <p className="font-semibold mt-0.5">{level.label}</p>
              <p className="text-sm mt-1 italic">{clinicalMeaning}</p>
            </div>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Treatment context, time since last assessment..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-teal-600 hover:bg-teal-700"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}