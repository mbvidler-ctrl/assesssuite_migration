import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const INTERPRETATIONS = [
  {
    condition: v => v < 7.8,
    classification: "Normal Glucose Tolerance",
    clinical_meaning: "The 2-hour plasma glucose level is within the normal range. This suggests normal glucose metabolism and no evidence of impaired glucose tolerance.",
    exercise_considerations: "Standard exercise prescription can be followed. Continue monitoring metabolic risk factors if present.",
    color: "bg-green-50 border-green-300 text-green-800",
    badge: "bg-green-100 text-green-800",
  },
  {
    condition: v => v >= 7.8 && v < 11.1,
    classification: "Impaired Glucose Tolerance (Prediabetes)",
    clinical_meaning: "This range indicates impaired glucose tolerance and an increased risk of developing type 2 diabetes.",
    exercise_considerations: "Lifestyle modification including structured exercise is strongly recommended. Aerobic and resistance training have been shown to improve insulin sensitivity.",
    color: "bg-orange-50 border-orange-300 text-orange-800",
    badge: "bg-orange-100 text-orange-800",
  },
  {
    condition: v => v >= 11.1,
    classification: "Diabetes Range",
    clinical_meaning: "A 2-hour plasma glucose ≥11.1 mmol/L is consistent with diabetes mellitus when confirmed by a medical practitioner.",
    exercise_considerations: "Medical follow-up is required. Exercise should be prescribed cautiously with monitoring of blood glucose levels and potential medication effects.",
    color: "bg-red-50 border-red-300 text-red-800",
    badge: "bg-red-100 text-red-800",
  },
];

function getInterpretation(val) {
  return INTERPRETATIONS.find(i => i.condition(val)) || null;
}

export default function OralGlucoseToleranceTestOGTTRunner({ client, onSave, onClose }) {
  const [fastingGlucose, setFastingGlucose] = useState("");
  const [twoHourGlucose, setTwoHourGlucose] = useState("");
  const [notes, setNotes] = useState("");

  const twoHourVal = twoHourGlucose !== "" ? parseFloat(twoHourGlucose) : null;
  const interp = twoHourVal !== null && !isNaN(twoHourVal) ? getInterpretation(twoHourVal) : null;

  const handleSave = () => {
    if (!twoHourGlucose) {
      toast.error("Please enter the 2-hour blood glucose result.");
      return;
    }

    const soapLines = [
      `• Oral Glucose Tolerance Test (OGTT)`,
      `  Source: External pathology / medical practitioner result`,
      fastingGlucose ? `  Fasting Blood Glucose: ${fastingGlucose} mmol/L` : null,
      `  2-Hour Blood Glucose: ${twoHourGlucose} mmol/L`,
      interp ? `  Classification: ${interp.classification}` : null,
      interp ? `  Clinical Meaning: ${interp.clinical_meaning}` : null,
      interp ? `  Exercise Considerations: ${interp.exercise_considerations}` : null,
      notes ? `  Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      status: "completed",
      result_value: parseFloat(twoHourGlucose),
      additional_data: {
        measurement_type: "OGTT",
        fasting_glucose: fastingGlucose ? parseFloat(fastingGlucose) : null,
        two_hour_glucose: parseFloat(twoHourGlucose),
        classification: interp?.classification || null,
        clinical_meaning: interp?.clinical_meaning || null,
        exercise_considerations: interp?.exercise_considerations || null,
        soap_text: soapLines,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("OGTT results saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Oral Glucose Tolerance Test (OGTT)</h2>
            <p className="text-xs text-slate-500">Metabolic — Result documentation only</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Scope of practice warning */}
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex gap-2 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Scope of Practice Notice:</strong> Exercise Physiologists should not administer the OGTT. This test must be ordered and conducted by a medical practitioner or pathology service. Record results obtained externally to guide exercise prescription.
            </div>
          </div>

          {/* Fasting glucose */}
          <div>
            <Label className="font-medium">Fasting Blood Glucose (mmol/L) <span className="text-slate-400 font-normal text-xs">— optional</span></Label>
            <Input
              type="number"
              step="0.1"
              value={fastingGlucose}
              onChange={e => setFastingGlucose(e.target.value)}
              placeholder="e.g. 5.2"
              className="mt-1 max-w-xs"
            />
          </div>

          {/* 2-hour glucose */}
          <div>
            <Label className="font-medium">2-Hour Blood Glucose Result (mmol/L) <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              step="0.1"
              value={twoHourGlucose}
              onChange={e => setTwoHourGlucose(e.target.value)}
              placeholder="e.g. 8.5"
              className="mt-1 max-w-xs"
            />
            <p className="text-xs text-slate-500 mt-1">Reference thresholds: &lt;7.8 Normal | 7.8–11.0 Impaired | ≥11.1 Diabetes Range</p>
          </div>

          {/* Live interpretation */}
          {interp && (
            <div className={`border rounded-xl p-4 space-y-2 text-sm ${interp.color}`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${interp.badge}`}>{interp.classification}</span>
              </div>
              <div>
                <p className="font-semibold">Clinical Meaning</p>
                <p>{interp.clinical_meaning}</p>
              </div>
              <div>
                <p className="font-semibold">Exercise Considerations</p>
                <p>{interp.exercise_considerations}</p>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="font-medium">Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Source of results, clinical context, referral details..."
              className="mt-1"
            />
          </div>

          {/* References */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">References</p>
            <p>• World Health Organization. Definition and diagnosis of diabetes mellitus and intermediate hyperglycaemia. WHO, 2006.</p>
            <p>• American Diabetes Association. Standards of Medical Care in Diabetes. <em>Diabetes Care.</em></p>
            <p>• Royal Australian College of General Practitioners (RACGP). Management of type 2 diabetes.</p>
            <p>• Diabetes Australia Clinical Guidelines.</p>
          </div>

          {/* Actions */}
          <div className="flex justify-between pb-2">
            <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Cancel</Button>
            <Button onClick={handleSave} disabled={!twoHourGlucose}>
              <Save className="w-4 h-4 mr-2" />Save Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}