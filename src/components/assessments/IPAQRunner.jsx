import React, { useState } from "react";
import { todayLocal } from "@/lib/localDate";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";
import {
  IPAQ_SHORT_FORM_ITEMS,
  computeIpaqShortFormScore,
  validateAndScoreIpaqShortForm,
} from "@/lib/clinical/scorers/maintainedPhysioAdditions";

const INITIAL_RESPONSES = Object.freeze(Object.fromEntries(
  IPAQ_SHORT_FORM_ITEMS.map(({ key }) => [key, ""]),
));

function categoryStyles(category) {
  if (category === "High Physical Activity") return "text-green-700 bg-green-50 border-green-200";
  if (category === "Moderate Physical Activity") return "text-yellow-700 bg-yellow-50 border-yellow-200";
  return "text-red-700 bg-red-50 border-red-200";
}

export default function IPAQRunner({ onSave, onClose }) {
  const [responses, setResponses] = useState(INITIAL_RESPONSES);
  const [notes, setNotes] = useState("");
  const complete = IPAQ_SHORT_FORM_ITEMS.every(({ key }) => responses[key] !== "");
  let preview = null;
  if (complete) {
    try {
      preview = computeIpaqShortFormScore(responses);
    } catch {
      preview = null;
    }
  }

  const handleSave = () => {
    try {
      const payload = validateAndScoreIpaqShortForm(
        { ...responses, notes },
        {
          assessmentName: "International Physical Activity Questionnaire – Short Form (IPAQ-SF)",
          assessmentDate: todayLocal(),
        },
      );
      onSave(payload);
      toast.success("IPAQ-SF saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to score IPAQ-SF");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">International Physical Activity Questionnaire (IPAQ-SF)</h2>
              <p className="text-slate-600 mt-1">Short form — last seven days recall</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Info className="w-5 h-5 text-blue-600" />Administration and scoring</CardTitle></CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p>Record all seven responses. Count activity performed for at least ten minutes at a time. Sitting time is reported separately and is not included in the activity score.</p>
                <p>The production scorer applies the IPAQ 2005 minimum-duration, 180-minute truncation, 960-minute outlier, MET weighting and categorical rules.</p>
              </CardContent>
            </Card>

            {IPAQ_SHORT_FORM_ITEMS.map((item, index) => (
              <Card key={item.key}>
                <CardHeader className="pb-2">
                  <p className="text-xs font-bold uppercase text-green-700">Item {index + 1} of {IPAQ_SHORT_FORM_ITEMS.length}</p>
                  <CardTitle className="text-base font-normal">{item.prompt}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-w-xs">
                    <Label htmlFor={`ipaq-${item.key}`}>{item.unit}</Label>
                    <Input
                      id={`ipaq-${item.key}`}
                      type="number"
                      min={item.min}
                      max={item.max}
                      step={item.step}
                      value={responses[item.key]}
                      onChange={(event) => setResponses((current) => ({ ...current, [item.key]: event.target.value }))}
                      placeholder={`${item.min}–${item.max}`}
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            {preview && (
              <Card className={`${categoryStyles(preview.activity_category)} border-2`}>
                <CardHeader><CardTitle className="text-xl">{preview.activity_category}</CardTitle></CardHeader>
                <CardContent>
                  <p className="font-semibold text-2xl">Total: {preview.total_met_mins.toFixed(1)} MET-minutes/week</p>
                  <div className="text-sm space-y-1 mt-2">
                    <p>Vigorous: {preview.vigorous_met_mins.toFixed(1)} MET-minutes/week</p>
                    <p>Moderate: {preview.moderate_met_mins.toFixed(1)} MET-minutes/week</p>
                    <p>Walking: {preview.walking_met_mins.toFixed(1)} MET-minutes/week</p>
                    <p>Weekday sitting: {preview.sitting_minutes} minutes/day</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle>Clinical Notes</CardTitle></CardHeader>
              <CardContent>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Recall context, barriers to activity, preferences and goals..." rows={4} />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!complete} className="bg-green-600 hover:bg-green-700"><Save className="w-4 h-4 mr-2" />Save IPAQ-SF</Button>
        </div>
      </div>
    </div>
  );
}
