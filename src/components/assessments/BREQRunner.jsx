import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

// BREQ-2 items with subscale mapping
// Markland & Tobin (2004)
const ITEMS = [
  { num: 1,  text: "I exercise because other people say I should",                    subscale: "external" },
  { num: 2,  text: "I feel guilty when I don't exercise",                              subscale: "introjected" },
  { num: 3,  text: "I value the benefits of exercise",                                 subscale: "identified" },
  { num: 4,  text: "I exercise because it's fun",                                      subscale: "intrinsic" },
  { num: 5,  text: "I don't see why I should have to exercise",                        subscale: "amotivation" },
  { num: 6,  text: "I take part in exercise because my friends/family/partner say I should", subscale: "external" },
  { num: 7,  text: "I feel ashamed when I miss an exercise session",                   subscale: "introjected" },
  { num: 8,  text: "It's important to me to exercise regularly",                       subscale: "identified" },
  { num: 9,  text: "I can't see why I should bother exercising",                       subscale: "amotivation" },
  { num: 10, text: "I enjoy my exercise sessions",                                     subscale: "intrinsic" },
  { num: 11, text: "I exercise because others will not be pleased with me if I don't", subscale: "external" },
  { num: 12, text: "I don't see the point in exercising",                              subscale: "amotivation" },
  { num: 13, text: "I feel like a failure when I haven't exercised in a while",        subscale: "introjected" },
  { num: 14, text: "I think it is important to make the effort to exercise regularly", subscale: "identified" },
  { num: 15, text: "I find exercise a pleasurable activity",                           subscale: "intrinsic" },
  { num: 16, text: "I feel under pressure from my friends/family to exercise",         subscale: "external" },
  { num: 17, text: "I get restless if I don't exercise regularly",                     subscale: "identified" },
  { num: 18, text: "I get pleasure and satisfaction from participating in exercise",   subscale: "intrinsic" },
  { num: 19, text: "I think exercising is a waste of time",                            subscale: "amotivation" },
];

const RESPONSE_OPTIONS = [
  { value: 0, label: "0 – Not true for me" },
  { value: 1, label: "1 – Not very true for me" },
  { value: 2, label: "2 – Sometimes true for me" },
  { value: 3, label: "3 – Often true for me" },
  { value: 4, label: "4 – Very true for me" },
];

const SUBSCALE_INFO = {
  amotivation:   { label: "Amotivation",           color: "bg-red-100 text-red-800 border-red-200",     items: [5,9,12,19] },
  external:      { label: "External Regulation",   color: "bg-orange-100 text-orange-800 border-orange-200", items: [1,6,11,16] },
  introjected:   { label: "Introjected Regulation",color: "bg-yellow-100 text-yellow-800 border-yellow-200", items: [2,7,13] },
  identified:    { label: "Identified Regulation", color: "bg-blue-100 text-blue-800 border-blue-200",   items: [3,8,14,17] },
  intrinsic:     { label: "Intrinsic Motivation",  color: "bg-green-100 text-green-800 border-green-200", items: [4,10,15,18] },
};

function calcSubscaleMean(responses, itemNums) {
  const vals = itemNums.map(n => responses[n]).filter(v => v !== undefined && v !== null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function calcRAI(means) {
  if (Object.values(means).some(v => v === null)) return null;
  return (
    (-3 * means.amotivation) +
    (-2 * means.external) +
    (-1 * means.introjected) +
    (2 * means.identified) +
    (3 * means.intrinsic)
  );
}

function interpretRAI(rai) {
  if (rai === null) return null;
  if (rai >= 6)  return { label: "Highly Self-Determined", color: "text-green-700" };
  if (rai >= 2)  return { label: "Moderately Self-Determined", color: "text-green-600" };
  if (rai >= -2) return { label: "Mixed / Moderate Motivation", color: "text-yellow-700" };
  if (rai >= -6) return { label: "Low Self-Determination", color: "text-orange-700" };
  return { label: "Very Low Self-Determination / Amotivated", color: "text-red-700" };
}

export default function BREQRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");

  const answered = Object.keys(responses).length;
  const allAnswered = answered === ITEMS.length;

  const means = Object.fromEntries(
    Object.entries(SUBSCALE_INFO).map(([key, info]) => [key, calcSubscaleMean(responses, info.items)])
  );
  const rai = allAnswered ? calcRAI(means) : null;
  const interp = interpretRAI(rai);

  const handleSave = () => {
    if (!allAnswered) {
      toast.error("Please answer all 19 questions before saving.");
      return;
    }

    const subscaleLines = Object.entries(SUBSCALE_INFO).map(([key, info]) => {
      const mean = means[key];
      const itemDetails = info.items.map(n => {
        const item = ITEMS.find(i => i.num === n);
        const resp = RESPONSE_OPTIONS.find(o => o.value === responses[n]);
        return `    Q${n}. ${item.text}\n      Answer: ${resp ? resp.label : responses[n]}`;
      }).join("\n");
      return `  ${info.label} (mean: ${mean !== null ? mean.toFixed(2) : 'N/A'}/4.00):\n${itemDetails}`;
    }).join("\n\n");

    const soap_text =
      `BREQ-2 Behavioural Regulation in Exercise Questionnaire\n\n` +
      `Relative Autonomy Index (RAI): ${rai !== null ? rai.toFixed(2) : 'N/A'} — ${interp?.label || ''}\n\n` +
      `Subscale Means:\n` +
      Object.entries(SUBSCALE_INFO).map(([key, info]) =>
        `  • ${info.label}: ${means[key] !== null ? means[key].toFixed(2) : 'N/A'}`
      ).join("\n") +
      `\n\nDetailed Responses:\n${subscaleLines}` +
      (notes ? `\n\nClinical Notes: ${notes}` : "");

    onSave({
      result_value: rai !== null ? parseFloat(rai.toFixed(2)) : null,
      additional_data: {
        measurement_type: "questionnaire",
        soap_text,
        rai: rai !== null ? parseFloat(rai.toFixed(2)) : null,
        interpretation: interp?.label,
        subscale_means: Object.fromEntries(
          Object.entries(means).map(([k, v]) => [k, v !== null ? parseFloat(v.toFixed(2)) : null])
        ),
        responses,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">BREQ-2</h2>
            <p className="text-sm text-slate-500 mt-0.5">Behavioural Regulation in Exercise Questionnaire — 19 items</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Instructions */}
        <div className="px-5 pt-4 shrink-0">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex gap-2">
            <Info className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
            <p className="text-xs text-indigo-800">
              Ask the client: <em>"Why do you exercise, or why don't you exercise? Please rate how true each statement is for you."</em>
              &nbsp;Rate each item 0 (not true for me) to 4 (very true for me).
            </p>
          </div>
        </div>

        {/* Scrollable questions */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {ITEMS.map((item) => {
            const subscaleInfo = SUBSCALE_INFO[item.subscale];
            return (
              <div key={item.num} className={`border rounded-lg p-3 ${responses[item.num] !== undefined ? "border-indigo-200 bg-indigo-50/30" : "border-slate-200 bg-white"}`}>
                <div className="flex items-start gap-2 mb-2">
                  <span className="bg-indigo-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                    {item.num}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{item.text}</p>
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full border font-medium ${subscaleInfo.color}`}>
                      {subscaleInfo.label}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-1 pl-7">
                  {RESPONSE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setResponses(prev => ({ ...prev, [item.num]: opt.value }))}
                      className={`py-1.5 rounded text-xs font-semibold border transition-all ${
                        responses[item.num] === opt.value
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                      }`}
                    >
                      {opt.value}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Notes */}
          <div>
            <Label>Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional observations..."
              className="mt-1"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 shrink-0">
          {allAnswered && (
            <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
              {Object.entries(SUBSCALE_INFO).map(([key, info]) => (
                <div key={key} className={`px-2 py-1.5 rounded border text-center font-medium ${info.color}`}>
                  {info.label.replace(" Regulation","").replace(" Motivation","")}: {means[key] !== null ? means[key].toFixed(2) : "—"}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">{answered}/19 answered</p>
              {rai !== null && interp && (
                <p className={`text-sm font-semibold mt-0.5 ${interp.color}`}>
                  RAI: {rai.toFixed(2)} — {interp.label}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={!allAnswered} className="bg-indigo-600 hover:bg-indigo-700">
                <Save className="w-4 h-4 mr-2" /> Save Assessment
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}