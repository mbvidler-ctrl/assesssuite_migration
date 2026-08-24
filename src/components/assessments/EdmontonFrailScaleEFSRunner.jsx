import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";
import {
  EFS_ITEMS,
  getEfsInterpretation,
  validateAndScoreEfs,
} from "@/lib/clinical/scorers/maintainedPhysioAdditions";

function interpretationColor(label) {
  if (label === "Not Frail") return "bg-green-100 text-green-800 border-green-300";
  if (label === "Apparently Vulnerable") return "bg-yellow-100 text-yellow-800 border-yellow-300";
  if (label === "Mildly Frail") return "bg-orange-100 text-orange-800 border-orange-300";
  if (label === "Moderately Frail") return "bg-red-100 text-red-800 border-red-300";
  return "bg-red-200 text-red-900 border-red-400";
}

export default function EdmontonFrailScaleEFSRunner({ onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");

  const answered = Object.keys(scores).length;
  const allAnswered = answered === EFS_ITEMS.length;
  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  const interp = allAnswered ? getEfsInterpretation(total) : null;
  const interpColor = interp ? interpretationColor(interp) : "";

  const handleSave = () => {
    try {
      const payload = validateAndScoreEfs(
        { responses: scores, notes },
        { assessmentName: "Edmonton Frail Scale (EFS)", assessmentDate: todayLocal() },
      );
      onSave(payload);
      toast.success("EFS saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to score EFS");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white z-10 p-5 border-b flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Edmonton Frail Scale</h2><p className="text-slate-500 text-sm mt-0.5">11-item, 9-domain frailty assessment (EFS)</p></div>
          <div className="flex items-center gap-3">
            {allAnswered && <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${interpColor}`}>{total}/17 — {interp}</div>}
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Instructions</p>
            <p>Administer all eleven items. The Clock Drawing Test and Timed Up and Go are performance based. Use the complete wording and response options shown below.</p>
          </div>

          {EFS_ITEMS.map((item, index) => (
            <Card key={item.key} className={scores[item.key] !== undefined ? "border-indigo-200 bg-indigo-50/20" : ""}>
              <CardHeader className="pb-2">
                <p className="text-xs font-bold text-indigo-600 uppercase">{index + 1}. {item.domain}</p>
                <CardTitle className="text-sm font-normal text-slate-800">{item.prompt}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {item.options.map((option) => (
                    <Button key={option.value} type="button" size="sm" variant={scores[item.key] === option.value ? "default" : "outline"} className={`h-auto py-2 text-xs ${scores[item.key] === option.value ? "bg-indigo-600 hover:bg-indigo-700" : ""}`} onClick={() => setScores((current) => ({ ...current, [item.key]: option.value }))}>
                      {option.label} ({option.value})
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {allAnswered && (
            <div className={`border-2 rounded-xl p-4 text-center ${interpColor}`}>
              <p className="text-3xl font-bold">{total} / 17</p>
              <p className="font-semibold text-lg mt-1">{interp}</p>
              <p className="text-xs mt-2">0–4 not frail | 5–6 vulnerable | 7–8 mild | 9–10 moderate | 11+ severe</p>
            </div>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Living situation, carer support, fall risk, clinical action plan..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between items-center">
          <span className="text-sm text-slate-500">{answered}/{EFS_ITEMS.length} answered</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!allAnswered} className="bg-indigo-600 hover:bg-indigo-700"><Save className="w-4 h-4 mr-2" />Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
