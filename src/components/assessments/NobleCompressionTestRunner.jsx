import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

const PAIN_TYPES = ["Sharp", "Burning", "Aching", "Stabbing", "Pressure", "Tingling", "None"];
const PAIN_LOCATIONS = ["Lateral femoral condyle", "Distal ITB", "Gerdy's tubercle", "Along ITB tract", "Other"];

export default function NobleCompressionTestRunner({ client, onSave, onClose }) {
  const [side, setSide] = useState("right");
  const [kneeAngle, setKneeAngle] = useState("30");
  const [painLevel, setPainLevel] = useState("");
  const [painType, setPainType] = useState("");
  const [painLocation, setPainLocation] = useState("");
  const [isPositive, setIsPositive] = useState(null); // true/false/null
  const [reproduced, setReproduced] = useState(null);
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    if (isPositive === null) {
      toast.error("Please indicate whether the test result is Positive or Negative.");
      return;
    }

    const resultLabel = isPositive ? "Positive" : "Negative";

    const soapLines = [
      `• Noble Compression Test: ${resultLabel}`,
      `  Side Tested: ${side.charAt(0).toUpperCase() + side.slice(1)}`,
      `  Knee Flexion Angle at Compression: ${kneeAngle ? kneeAngle + '°' : 'Not recorded'}`,
      reproduced !== null ? `  Pain Reproduced at 30° Flexion: ${reproduced ? 'Yes' : 'No'}` : null,
      painLevel !== "" ? `  Pain Intensity (NRS): ${painLevel}/10` : null,
      painType ? `  Pain Quality/Type: ${painType}` : null,
      painLocation ? `  Pain Location: ${painLocation}` : null,
      notes ? `  Additional Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      status: "completed",
      result_value: isPositive ? 1 : 0,
      additional_data: {
        measurement_type: "Noble Compression Test",
        result: resultLabel,
        side,
        knee_angle_degrees: kneeAngle,
        pain_reproduced_at_30deg: reproduced,
        pain_level: painLevel !== "" ? Number(painLevel) : null,
        pain_type: painType,
        pain_location: painLocation,
        soap_text: soapLines,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Noble Compression Test</h2>
            <p className="text-xs text-slate-500">IT Band Syndrome — lateral knee compression assessment</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Clinician instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <strong>Procedure:</strong> With the client supine, apply direct pressure with the thumb over the lateral femoral condyle (~2–3 cm above the joint line). Slowly flex and extend the knee. The test is <strong>positive</strong> if pain is reproduced at approximately <strong>30° of knee flexion</strong>, consistent with ITB impingement.
          </div>

          {/* Side */}
          <div>
            <Label className="font-semibold text-slate-800 mb-2 block">Side Tested</Label>
            <div className="flex gap-3">
              {["right", "left"].map(s => (
                <button key={s} onClick={() => setSide(s)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${side === s ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Knee angle */}
          <div>
            <Label className="font-medium">Knee Flexion Angle at Compression (degrees)</Label>
            <Input
              type="number"
              value={kneeAngle}
              onChange={e => setKneeAngle(e.target.value)}
              placeholder="e.g. 30"
              className="mt-1 max-w-xs"
            />
            <p className="text-xs text-slate-500 mt-1">Standard test angle is 30°</p>
          </div>

          {/* Pain reproduced at 30° */}
          <div>
            <Label className="font-semibold text-slate-800 mb-2 block">Pain Reproduced at ~30° Flexion?</Label>
            <div className="flex gap-3">
              {[{ label: "Yes", val: true }, { label: "No", val: false }].map(opt => (
                <button key={String(opt.val)} onClick={() => setReproduced(opt.val)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${reproduced === opt.val ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pain level */}
          <div>
            <Label className="font-medium">Pain Intensity (NRS 0–10)</Label>
            <Input
              type="number"
              min="0"
              max="10"
              value={painLevel}
              onChange={e => setPainLevel(e.target.value)}
              placeholder="0–10"
              className="mt-1 max-w-xs"
            />
          </div>

          {/* Pain type */}
          <div>
            <Label className="font-medium mb-2 block">Pain Quality / Type</Label>
            <div className="flex flex-wrap gap-2">
              {PAIN_TYPES.map(type => (
                <button key={type} onClick={() => setPainType(type === painType ? "" : type)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${painType === type ? 'bg-orange-500 text-white border-orange-500' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Pain location */}
          <div>
            <Label className="font-medium mb-2 block">Pain Location</Label>
            <div className="flex flex-wrap gap-2">
              {PAIN_LOCATIONS.map(loc => (
                <button key={loc} onClick={() => setPainLocation(loc === painLocation ? "" : loc)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${painLocation === loc ? 'bg-purple-500 text-white border-purple-500' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Overall result */}
          <div>
            <Label className="font-semibold text-slate-800 mb-2 block">Overall Test Result</Label>
            <div className="flex gap-3">
              {[{ label: "Positive", val: true, color: "bg-red-500 border-red-500" }, { label: "Negative", val: false, color: "bg-green-600 border-green-600" }].map(opt => (
                <button key={String(opt.val)} onClick={() => setIsPositive(opt.val)}
                  className={`px-5 py-2 rounded-lg border text-sm font-semibold transition-colors ${isPositive === opt.val ? `${opt.color} text-white` : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {isPositive !== null && (
              <p className={`mt-2 text-sm font-medium ${isPositive ? 'text-red-600' : 'text-green-700'}`}>
                {isPositive
                  ? "Positive — suggests ITB syndrome / lateral knee impingement"
                  : "Negative — ITB compression pain not reproduced"}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label className="font-medium">Clinical Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Additional observations..." className="mt-1" />
          </div>

          {/* Actions */}
          <div className="flex justify-between pb-2">
            <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Cancel</Button>
            <Button onClick={handleSave} disabled={isPositive === null}>
              <Save className="w-4 h-4 mr-2" />Save Assessment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}