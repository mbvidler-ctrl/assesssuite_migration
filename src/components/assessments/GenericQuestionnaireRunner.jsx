import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Info, FileText } from "lucide-react";
import { toast } from "sonner";

export default function GenericQuestionnaireRunner({ client, assessment, onSave, onClose }) {
  const [score, setScore] = useState("");
  const [subscores, setSubscores] = useState({});
  const [notes, setNotes] = useState("");
  const [administeredBy, setAdministeredBy] = useState("clinician");

  const numericScore = parseFloat(score);

  const handleSave = () => {
    if (!score || isNaN(numericScore)) { toast.error("Enter a valid score"); return; }
    const name = assessment?.name || "Assessment";
    const unit = assessment?.unit_of_measure || "points";
    const soap = `• ${name}\n  Score: ${numericScore} ${unit}${assessment?.scoring_system ? `\n  Scoring: ${assessment.scoring_system}` : ""}${Object.keys(subscores).length > 0 ? `\n  Subscores: ${Object.entries(subscores).map(([k, v]) => `${k}: ${v}`).join(", ")}` : ""}${notes ? `\n  Notes: ${notes}` : ""}`;
    onSave({ status: "completed", result_value: numericScore, notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "questionnaire", assessment_name: name, administered_by: administeredBy, subscores: Object.keys(subscores).length > 0 ? subscores : undefined } });
    toast.success(`${name} saved.`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-slate-50 to-gray-50 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-slate-600" />
            <div><h2 className="text-2xl font-bold text-slate-900">{assessment?.name || "Assessment"}</h2><p className="text-slate-500 text-sm mt-0.5">{assessment?.category || "Clinical assessment"}</p></div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {assessment?.description && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
              <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />About this assessment</p>
              <p className="mt-1">{assessment.description}</p>
            </div>
          )}

          {assessment?.instructions && (
            <Card className="bg-amber-50 border-amber-200">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-800">Clinician Instructions</CardTitle></CardHeader>
              <CardContent className="text-sm text-amber-900">{assessment.instructions}</CardContent>
            </Card>
          )}

          {assessment?.scoring_system && (
            <Card className="bg-slate-50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Scoring Guide</CardTitle></CardHeader>
              <CardContent className="text-sm text-slate-700">{assessment.scoring_system}</CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Result Entry</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="score">Total Score {assessment?.unit_of_measure ? `(${assessment.unit_of_measure})` : ""} <span className="text-red-500">*</span></Label>
                <Input id="score" type="number" step="any" value={score} onChange={e => setScore(e.target.value)} placeholder="Enter score" className="mt-1" />
              </div>
              <div>
                <Label>Administered By</Label>
                <div className="flex gap-2 mt-1">
                  {["clinician", "self-report"].map(opt => (
                    <Button key={opt} type="button" size="sm" variant={administeredBy === opt ? "default" : "outline"} onClick={() => setAdministeredBy(opt)} className="capitalize">{opt}</Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observations, context, follow-up recommendations..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!score || isNaN(numericScore)} className="bg-slate-700 hover:bg-slate-800"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}