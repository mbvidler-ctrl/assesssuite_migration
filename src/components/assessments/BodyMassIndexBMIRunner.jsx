import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

const BMI_CATEGORIES = [
  { max: 18.5, label: "Underweight",       risk: "Increased",    color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { max: 25,   label: "Healthy Weight",    risk: "Minimal",      color: "bg-green-100 text-green-800 border-green-300" },
  { max: 30,   label: "Overweight",        risk: "Increased",    color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { max: 35,   label: "Obesity Class I",   risk: "Moderate",     color: "bg-orange-100 text-orange-800 border-orange-300" },
  { max: 40,   label: "Obesity Class II",  risk: "Severe",       color: "bg-red-100 text-red-800 border-red-300" },
  { max: Infinity, label: "Obesity Class III", risk: "Very Severe", color: "bg-red-200 text-red-900 border-red-400" },
];

function getCategory(bmi) {
  return BMI_CATEGORIES.find(c => bmi < c.max) || BMI_CATEGORIES[BMI_CATEGORIES.length - 1];
}

export default function BodyMassIndexBMIRunner({ client, onSave, onClose }) {
  const [heightCm, setHeightCm] = useState("");
  const [weight, setWeight]     = useState("");
  const [notes, setNotes]       = useState("");
  const [bmi, setBmi]           = useState(null);
  const [category, setCategory] = useState(null);

  // Auto-calculate whenever height or weight changes
  useEffect(() => {
    const h = parseFloat(heightCm);
    const w = parseFloat(weight);
    if (h > 0 && w > 0) {
      const hM = h / 100;
      const calc = w / (hM * hM);
      setBmi(calc);
      setCategory(getCategory(calc));
    } else {
      setBmi(null);
      setCategory(null);
    }
  }, [heightCm, weight]);

  const handleSave = () => {
    if (!bmi) {
      toast.error("Please enter valid height and weight first.");
      return;
    }
    const hM = parseFloat(heightCm) / 100;
    onSave({
      status: "completed",
      result_value: parseFloat(bmi.toFixed(2)),
      assessment_date: new Date().toISOString().split("T")[0],
      notes,
      additional_data: {
        soap_text: `• Body Mass Index (BMI) Assessment\n  Height: ${heightCm} cm | Weight: ${weight} kg\n  BMI: ${bmi.toFixed(2)} kg/m²\n  Classification: ${category.label} (Health Risk: ${category.risk})${notes ? `\n  Notes: ${notes}` : ""}`,
        measurement_type: "BMI",
        height_cm: heightCm,
        height_m: hM.toFixed(3),
        weight_kg: weight,
        bmi: bmi.toFixed(2),
        bmi_category: category.label,
        health_risk: category.risk,
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg flex flex-col max-h-[92vh] shadow-2xl">

        {/* Header */}
        <div className="px-6 py-4 border-b shrink-0">
          <h2 className="text-xl font-bold text-slate-800 text-center">Body Mass Index (BMI)</h2>
          <p className="text-sm text-slate-500 text-center mt-0.5">Anthropometric Assessment</p>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

          {/* Reference */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">📖 References</p>
            <p>World Health Organization. (1995). <em>Physical status: the use and interpretation of anthropometry</em>. WHO Technical Report Series No. 854. Geneva: WHO.</p>
            <p>NHMRC. (2013). <em>Clinical Practice Guidelines for the Management of Overweight and Obesity in Adults</em>.</p>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1.5">
            <p className="font-semibold">📋 Administration Instructions</p>
            <p><strong>Height:</strong> Measure barefoot using a stadiometer. Client stands erect, heels together, eyes forward (Frankfort plane). Record to nearest 0.1 cm.</p>
            <p><strong>Weight:</strong> Measure in light clothing, no shoes, on a calibrated scale. Record to nearest 0.1 kg.</p>
            <p><strong>Formula:</strong> BMI = Weight (kg) ÷ Height² (m²).</p>
            <p><strong>Note:</strong> BMI does not distinguish fat from muscle. Interpret with clinical context — especially in athletes, older adults, and Asian populations (lower cut-offs: overweight ≥23, obese ≥27.5).</p>
          </div>

          {/* WHO Classification Table */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <p className="font-semibold text-slate-700 text-sm">📊 WHO Classification (Adults)</p>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 text-slate-700">
                  <th className="p-2 text-left border border-slate-300">BMI (kg/m²)</th>
                  <th className="p-2 text-left border border-slate-300">Classification</th>
                  <th className="p-2 text-left border border-slate-300">Health Risk</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["< 18.5",    "Underweight",        "Increased",    "text-yellow-700"],
                  ["18.5–24.9", "Healthy Weight",     "Minimal",      "text-green-700"],
                  ["25.0–29.9", "Overweight",         "Increased",    "text-yellow-700"],
                  ["30.0–34.9", "Obesity Class I",    "Moderate",     "text-orange-700"],
                  ["35.0–39.9", "Obesity Class II",   "Severe",       "text-red-700"],
                  ["≥ 40.0",    "Obesity Class III",  "Very Severe",  "text-red-900"],
                ].map(([range, label, risk, color], i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="p-2 border border-slate-200">{range}</td>
                    <td className={`p-2 border border-slate-200 font-medium ${color}`}>{label}</td>
                    <td className="p-2 border border-slate-200 text-slate-600">{risk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="height">Height (cm)</Label>
              <Input
                id="height"
                type="number"
                step="0.1"
                min="0"
                value={heightCm}
                onChange={e => setHeightCm(e.target.value)}
                placeholder="e.g. 175.0"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                min="0"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="e.g. 80.0"
                className="mt-1"
              />
            </div>
          </div>

          {/* Live Result */}
          {bmi !== null && category && (
            <div className={`rounded-lg border p-4 text-center ${category.color}`}>
              <p className="text-3xl font-bold">{bmi.toFixed(2)} <span className="text-base font-normal">kg/m²</span></p>
              <p className="text-lg font-semibold mt-1">{category.label}</p>
              <p className="text-sm mt-0.5">Health Risk: <strong>{category.risk}</strong></p>
            </div>
          )}

          {/* Clinical Notes */}
          <div>
            <Label htmlFor="notes">Clinical Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Document any relevant clinical observations..."
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between shrink-0">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" /> Cancel
          </Button>
          <Button onClick={handleSave} disabled={bmi === null}>
            <Save className="h-4 w-4 mr-2" /> Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}