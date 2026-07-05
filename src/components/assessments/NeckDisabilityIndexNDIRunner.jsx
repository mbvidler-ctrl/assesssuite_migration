import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, ClipboardList } from "lucide-react";
import { toast } from "sonner";

const sections = [
  {
    title: "Section 1 – Pain Intensity",
    options: [
      { value: 0, label: "I have no pain at the moment" },
      { value: 1, label: "The pain is very mild at the moment" },
      { value: 2, label: "The pain is moderate at the moment" },
      { value: 3, label: "The pain is fairly severe at the moment" },
      { value: 4, label: "The pain is very severe at the moment" },
      { value: 5, label: "The pain is the worst imaginable at the moment" },
    ],
  },
  {
    title: "Section 2 – Personal Care (Washing, Dressing, etc.)",
    options: [
      { value: 0, label: "I can look after myself normally without causing extra pain" },
      { value: 1, label: "I can look after myself normally but it causes extra pain" },
      { value: 2, label: "It is painful to look after myself and I am slow and careful" },
      { value: 3, label: "I need some help but manage most of my personal care" },
      { value: 4, label: "I need help every day in most aspects of self care" },
      { value: 5, label: "I do not get dressed, I wash with difficulty and stay in bed" },
    ],
  },
  {
    title: "Section 3 – Lifting",
    options: [
      { value: 0, label: "I can lift heavy weights without extra pain" },
      { value: 1, label: "I can lift heavy weights but it gives extra pain" },
      { value: 2, label: "Pain prevents me lifting heavy weights off the floor, but I can manage if they are conveniently placed, e.g. on a table" },
      { value: 3, label: "Pain prevents me lifting heavy weights but I can manage light to medium weights if conveniently positioned" },
      { value: 4, label: "I can lift very light weights" },
      { value: 5, label: "I cannot lift or carry anything at all" },
    ],
  },
  {
    title: "Section 4 – Reading",
    options: [
      { value: 0, label: "I can read as much as I want to with no pain in my neck" },
      { value: 1, label: "I can read as much as I want to with slight pain in my neck" },
      { value: 2, label: "I can read as much as I want to with moderate pain in my neck" },
      { value: 3, label: "I cannot read as much as I want because of moderate pain in my neck" },
      { value: 4, label: "I can hardly read at all because of severe pain in my neck" },
      { value: 5, label: "I cannot read at all" },
    ],
  },
  {
    title: "Section 5 – Headaches",
    options: [
      { value: 0, label: "I have no headaches at all" },
      { value: 1, label: "I have slight headaches which come infrequently" },
      { value: 2, label: "I have moderate headaches which come infrequently" },
      { value: 3, label: "I have moderate headaches which come frequently" },
      { value: 4, label: "I have severe headaches which come frequently" },
      { value: 5, label: "I have headaches almost all the time" },
    ],
  },
  {
    title: "Section 6 – Concentration",
    options: [
      { value: 0, label: "I can concentrate fully when I want to with no difficulty" },
      { value: 1, label: "I can concentrate fully when I want to with slight difficulty" },
      { value: 2, label: "I have a fair degree of difficulty in concentrating when I want to" },
      { value: 3, label: "I have a lot of difficulty in concentrating when I want to" },
      { value: 4, label: "I have a great deal of difficulty in concentrating when I want to" },
      { value: 5, label: "I cannot concentrate at all" },
    ],
  },
  {
    title: "Section 7 – Work",
    options: [
      { value: 0, label: "I can do as much work as I want to" },
      { value: 1, label: "I can only do my usual work but no more" },
      { value: 2, label: "I can do most of my usual work but no more" },
      { value: 3, label: "I cannot do my usual work" },
      { value: 4, label: "I can hardly do any work at all" },
      { value: 5, label: "I cannot do any work at all" },
    ],
  },
  {
    title: "Section 8 – Driving",
    options: [
      { value: 0, label: "I can drive my car without any neck pain" },
      { value: 1, label: "I can drive my car as long as I want with slight pain in my neck" },
      { value: 2, label: "I can drive my car as long as I want with moderate pain in my neck" },
      { value: 3, label: "I cannot drive my car as long as I want because of moderate pain" },
      { value: 4, label: "I can hardly drive at all because of severe pain" },
      { value: 5, label: "I cannot drive my car at all" },
    ],
  },
  {
    title: "Section 9 – Sleeping",
    options: [
      { value: 0, label: "I have no trouble sleeping" },
      { value: 1, label: "My sleep is slightly disturbed (less than 1 hour sleepless)" },
      { value: 2, label: "My sleep is mildly disturbed (1–2 hours sleepless)" },
      { value: 3, label: "My sleep is moderately disturbed (2–3 hours sleepless)" },
      { value: 4, label: "My sleep is greatly disturbed (3–5 hours sleepless)" },
      { value: 5, label: "My sleep is completely disturbed (5–7 hours sleepless)" },
    ],
  },
  {
    title: "Section 10 – Recreation",
    options: [
      { value: 0, label: "I am able to engage in all my recreational activities with no neck pain" },
      { value: 1, label: "I am able to engage in all my recreational activities with some pain in my neck" },
      { value: 2, label: "I am able to engage in most but not all of my recreational activities because of pain in my neck" },
      { value: 3, label: "I am able to engage in only a few of my usual recreational activities because of pain" },
      { value: 4, label: "I can hardly engage in any recreational activities because of pain" },
      { value: 5, label: "I cannot engage in any recreational activities at all" },
    ],
  },
];

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
      assessment_date: new Date().toISOString().split("T")[0],
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