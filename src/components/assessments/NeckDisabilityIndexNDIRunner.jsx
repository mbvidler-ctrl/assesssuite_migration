import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";
import { PROM_NEURO_NDI_SECTIONS as sections } from '@/lib/clinical/scorers/extrasPromNeuro';


function getInterpretation(percentage) {
  if (percentage <= 8) return { label: "No Disability", color: "text-green-700 bg-green-50 border-green-200" };
  if (percentage <= 28) return { label: "Mild Disability", color: "text-yellow-700 bg-yellow-50 border-yellow-200" };
  if (percentage <= 48) return { label: "Moderate Disability", color: "text-orange-700 bg-orange-50 border-orange-200" };
  if (percentage <= 64) return { label: "Severe Disability", color: "text-red-700 bg-red-50 border-red-200" };
  return { label: "Complete Disability", color: "text-red-900 bg-red-100 border-red-300" };
}

export default function NeckDisabilityIndexNDIRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");

  const answeredCount = Object.keys(responses).length;
  const totalScore = Object.values(responses).reduce((sum, v) => sum + v, 0);
  const percentage = answeredCount === sections.length ? (totalScore / 50) * 100 : null;
  const interpretation = percentage !== null ? getInterpretation(percentage) : null;

  const handleSave = () => {
    if (answeredCount !== sections.length) {
      toast.error(`Please answer all 10 sections (${answeredCount}/10 completed).`);
      return;
    }

    const responseLabels = {};
    sections.forEach((section, idx) => {
      const val = responses[idx];
      const opt = section.options.find(o => o.value === val);
      responseLabels[section.title] = opt?.label || val;
    });

    const soapLines = sections.map((section, idx) => {
      const val = responses[idx];
      const opt = section.options.find(o => o.value === val);
      return `  ${section.title}: ${val}/5 — ${opt?.label || ''}`;
    }).join('\n');

    const soapText = `• Neck Disability Index (NDI): ${percentage.toFixed(1)}% (${totalScore}/50) — ${interpretation.label}\n\n  Individual Section Responses:\n${soapLines}`;

    onSave({
      status: "completed",
      result_value: parseFloat(percentage.toFixed(1)),
      additional_data: {
        measurement_type: "questionnaire",
        total_score: totalScore,
        percentage: parseFloat(percentage.toFixed(1)),
        interpretation: interpretation.label,
        responses,
        response_labels: responseLabels,
        soap_text: soapText,
      },
      notes,
      assessment_date: todayLocal(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><ClipboardList className="w-5 h-5 text-blue-600" /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Neck Disability Index (NDI)</h2>
              <p className="text-xs text-slate-500">Vernon & Mior, 1991 — {answeredCount}/10 sections completed</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Instructions */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700">
            <strong>Instructions:</strong> This questionnaire has been designed to give the clinician information as to how neck pain has affected the patient's ability to manage in everyday life. Please select <strong>one statement per section</strong> that best applies to the patient right now.
          </div>

          {/* Sections */}
          {sections.map((section, idx) => (
            <div key={idx} className={`rounded-lg border p-4 ${responses[idx] !== undefined ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200'}`}>
              <p className="font-semibold text-slate-800 mb-3">{section.title}</p>
              <div className="space-y-2">
                {section.options.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${responses[idx] === option.value ? 'bg-blue-100 border border-blue-300' : 'hover:bg-slate-50 border border-transparent'}`}
                  >
                    <input
                      type="radio"
                      name={`section-${idx}`}
                      checked={responses[idx] === option.value}
                      onChange={() => setResponses(prev => ({ ...prev, [idx]: option.value }))}
                      className="mt-0.5 h-4 w-4 accent-blue-600 flex-shrink-0"
                    />
                    <span className="text-sm text-slate-700">
                      <span className="font-medium text-slate-500 mr-1">{option.value} —</span>
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Score summary */}
          {percentage !== null && interpretation && (
            <div className={`rounded-lg border p-4 ${interpretation.color}`}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-lg font-bold">{interpretation.label}</p>
                  <p className="text-sm mt-0.5">Score: {totalScore}/50 ({percentage.toFixed(1)}%)</p>
                </div>
                <div className="text-right text-xs space-y-1">
                  <div>0–8%: No Disability</div>
                  <div>10–28%: Mild</div>
                  <div>30–48%: Moderate</div>
                  <div>50–64%: Severe</div>
                  <div>≥65%: Complete</div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="font-medium">Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional clinical observations..."
              className="mt-1"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between pb-2">
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />Cancel
            </Button>
            <Button onClick={handleSave} disabled={answeredCount !== sections.length}>
              <Save className="w-4 h-4 mr-2" />
              Save NDI Assessment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
