import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Save } from "lucide-react";

const RMI_ITEMS = [
  { id: "rmi_01_bed_turning", label: "Bed mobility: turning over" },
  { id: "rmi_02_lying_to_sitting", label: "Bed mobility: lying to sitting" },
  { id: "rmi_03_sitting_balance", label: "Sitting balance" },
  { id: "rmi_04_sit_to_stand", label: "Sit to stand" },
  { id: "rmi_05_standing_unsupported", label: "Standing unsupported" },
  { id: "rmi_06_transfer", label: "Transfer between surfaces" },
  { id: "rmi_07_walking_with_aid", label: "Walking indoors with aid if needed" },
  { id: "rmi_08_stairs", label: "Stairs or step negotiation" },
  { id: "rmi_09_walking_outdoors", label: "Walking outdoors on even ground" },
  { id: "rmi_10_walking_without_aid", label: "Walking indoors without physical assistance" },
  { id: "rmi_11_pick_up_object", label: "Picking an object up from the floor" },
  { id: "rmi_12_bathing_or_washing", label: "Bathing / washing mobility task" },
  { id: "rmi_13_walking_distance", label: "Walking longer functional distance" },
  { id: "rmi_14_uneven_ground", label: "Mobility over uneven ground or community environment" },
  { id: "rmi_15_running", label: "Running or higher-level mobility" },
];

const OPTIONS = ["Able", "Unable", "Not tested"];

function getInterpretation(score) {
  if (score === 15) return "High functional mobility on this scale";
  if (score >= 11) return "Mild mobility limitation";
  if (score >= 6) return "Moderate mobility limitation";
  return "Severe mobility limitation";
}

export default function RivermeadMobilityIndexRunner({ client, onSave, onClose }) {
  const initial = {};
  RMI_ITEMS.forEach(item => { initial[item.id] = ""; });
  const [responses, setResponses] = useState(initial);
  const [clinicalNotes, setClinicalNotes] = useState("");

  const answeredCount = Object.values(responses).filter(v => v !== "").length;
  const totalScore = Object.values(responses).filter(v => v === "Able").length;

  const handleSave = () => {
    const soapText = [
      `Rivermead Mobility Index completed.`,
      answeredCount > 0 ? `Score: ${totalScore}/15 (${answeredCount} items assessed).` : null,
      answeredCount > 0 ? `Interpretation: ${getInterpretation(totalScore)}.` : null,
      clinicalNotes?.trim() ? `Notes: ${clinicalNotes}.` : null,
    ].filter(Boolean).join(" ");

    const additionalData = { measurement_type: "rivermead", clinical_notes: clinicalNotes || null, soap_text: soapText };
    RMI_ITEMS.forEach(item => {
      additionalData[item.id] = responses[item.id] || null;
    });
    additionalData.total_score = totalScore;
    additionalData.items_assessed = answeredCount;
    additionalData.interpretation = answeredCount > 0 ? getInterpretation(totalScore) : null;

    const status = answeredCount === 15 ? "complete" : answeredCount > 0 ? "partial" : "incomplete";
    additionalData.completion_status = status;

    onSave({
      result_value: totalScore,
      additional_data: additionalData,
      notes: clinicalNotes || "",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Rivermead Mobility Index</h2>
              {client && <p className="text-sm text-slate-500 mt-0.5">Client: {client.full_name}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>

          {/* Score summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Score so far</p>
              <p className="text-3xl font-bold text-blue-600">{totalScore}<span className="text-lg text-slate-400">/15</span></p>
              {answeredCount > 0 && (
                <p className="text-sm text-slate-600 mt-0.5">{getInterpretation(totalScore)}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Items assessed</p>
              <p className="text-2xl font-semibold text-slate-700">{answeredCount}<span className="text-base text-slate-400">/15</span></p>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {RMI_ITEMS.map((item, idx) => (
              <div key={item.id} className={`rounded-lg border p-3 transition-colors ${
                responses[item.id] === "Able" ? "bg-green-50 border-green-200" :
                responses[item.id] === "Unable" ? "bg-red-50 border-red-200" :
                responses[item.id] === "Not tested" ? "bg-slate-50 border-slate-200" :
                "bg-white border-slate-200"
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-slate-800">
                    <span className="text-slate-400 mr-1">{idx + 1}.</span> {item.label}
                  </p>
                  <div className="flex gap-1.5 shrink-0">
                    {OPTIONS.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setResponses(prev => ({
                          ...prev,
                          [item.id]: prev[item.id] === opt ? "" : opt
                        }))}
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                          responses[item.id] === opt
                            ? opt === "Able" ? "bg-green-500 text-white border-green-500"
                              : opt === "Unable" ? "bg-red-500 text-white border-red-500"
                              : "bg-slate-500 text-white border-slate-500"
                            : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Clinical notes */}
          <div>
            <Label>Clinical Notes</Label>
            <Textarea
              className="mt-1"
              rows={3}
              placeholder="Observations, barriers, assistive device use, environmental limitations..."
              value={clinicalNotes}
              onChange={e => setClinicalNotes(e.target.value)}
            />
          </div>

          {/* Save note */}
          {answeredCount === 0 && (
            <p className="text-xs text-slate-400 text-center">You can save a partial assessment â€” at least 1 item is recommended.</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Assessment {answeredCount < 15 && answeredCount > 0 ? `(${answeredCount}/15 items)` : ""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}