import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Save, X } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const getRisk = (ratio, gender) => {
  if (!ratio || isNaN(ratio)) return null;
  if (gender === "male") {
    if (ratio < 0.90) return { label: "Low Risk", color: "bg-green-100 text-green-800" };
    if (ratio <= 0.99) return { label: "Moderate Risk", color: "bg-yellow-100 text-yellow-800" };
    return { label: "High Risk", color: "bg-red-100 text-red-800" };
  } else {
    if (ratio < 0.80) return { label: "Low Risk", color: "bg-green-100 text-green-800" };
    if (ratio <= 0.84) return { label: "Moderate Risk", color: "bg-yellow-100 text-yellow-800" };
    return { label: "High Risk", color: "bg-red-100 text-red-800" };
  }
};

export default function WaisttoHipRatioWHRRunner({ client, onSave, onClose }) {
  const [waist, setWaist] = useState("");
  const [hip, setHip] = useState("");
  const [gender, setGender] = useState(client?.gender === "female" ? "female" : "male");
  const [notes, setNotes] = useState("");

  const ratio = waist && hip && !isNaN(waist) && !isNaN(hip) && parseFloat(hip) > 0
    ? (parseFloat(waist) / parseFloat(hip))
    : null;
  const risk = ratio !== null ? getRisk(ratio, gender) : null;

  const handleSave = () => {
    if (!waist || !hip) { toast.error("Please enter both waist and hip measurements."); return; }
    if (!ratio || !risk) { toast.error("Invalid measurements."); return; }

    const soapText = `• Waist-to-Hip Ratio (WHR)\n  WHR: ${ratio.toFixed(3)} — ${risk.label}\n  Waist: ${waist} cm | Hip: ${hip} cm\n  WHO Thresholds (Males): Low <0.90 | Moderate 0.90–0.99 | High ≥1.0\n  WHO Thresholds (Females): Low <0.80 | Moderate 0.80–0.84 | High ≥0.85\n  Elevated WHR indicates increased risk of CVD, T2DM, and metabolic syndrome.\n  MCID: ~0.02 with lifestyle intervention.\n  Reference: WHO (2008). Waist Circumference and Waist-Hip Ratio. ISBN: 9789241501491.`;

    onSave({
      status: "completed",
      result_value: parseFloat(ratio.toFixed(3)),
      additional_data: {
        soap_text: soapText,
        measurement_type: "whr",
        waist_cm: parseFloat(waist),
        hip_cm: parseFloat(hip),
        gender,
        whr: ratio.toFixed(3),
        risk: risk.label,
      },
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("Assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Waist-to-Hip Ratio (WHR)</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
          </div>

          {/* Inputs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Measurements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Waist Circumference (cm)</Label>
                  <Input type="number" value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="e.g. 85" className="mt-1" />
                </div>
                <div>
                  <Label>Hip Circumference (cm)</Label>
                  <Input type="number" value={hip} onChange={(e) => setHip(e.target.value)} placeholder="e.g. 100" className="mt-1" />
                </div>
              </div>

              <div>
                <Label>Sex</Label>
                <div className="flex items-center space-x-6 mt-1">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" name="gender" value="male" checked={gender === "male"} onChange={() => setGender("male")} />
                    <span className="text-sm">Male</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" name="gender" value="female" checked={gender === "female"} onChange={() => setGender("female")} />
                    <span className="text-sm">Female</span>
                  </label>
                </div>
              </div>

              {/* Live result */}
              {ratio !== null && risk && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">WHR Result</p>
                    <p className="text-2xl font-bold text-gray-900">{ratio.toFixed(3)}</p>
                  </div>
                  <Badge className={`text-sm px-3 py-1 ${risk.color}`}>{risk.label}</Badge>
                </div>
              )}

              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional clinical notes" rows={2} className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Clinician Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
            <p className="font-semibold">📋 Administration Instructions (WHO Protocol)</p>
            <div className="space-y-3">
              <div>
                <p className="font-medium">Waist Measurement:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700 mt-1">
                  <li>Client standing, relaxed, feet together, arms at sides</li>
                  <li>Locate the narrowest point between the lowest rib margin and the iliac crest</li>
                  <li>Apply tape horizontally, parallel to the floor — snug but not compressing skin</li>
                  <li>Measure at end of normal expiration</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">Hip Measurement:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700 mt-1">
                  <li>Locate the widest circumference over the buttocks / greater trochanters</li>
                  <li>Apply tape horizontally at this level — keep parallel to floor</li>
                  <li>Client should be relaxed with weight evenly distributed</li>
                  <li>Record to nearest 0.1 cm; repeat if measurements differ by &gt;1 cm</li>
                </ul>
              </div>
              <p className="italic text-blue-600">"Stand with your feet together. Please breathe normally and relax. I'll take a measurement around your waist, then around your hips."</p>
            </div>
          </div>

          {/* Norms Table */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 space-y-2">
            <p className="font-semibold">📊 Norms & Risk Classification (WHO, 2008)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div>
                <p className="font-medium text-slate-600 mb-1">Males</p>
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200">
                    <tr>
                      <th className="p-2 text-left">WHR</th>
                      <th className="p-2 text-left">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-200 bg-green-50"><td className="p-2">&lt; 0.90</td><td className="p-2 text-green-700 font-medium">Low</td></tr>
                    <tr className="border-t border-slate-200 bg-yellow-50"><td className="p-2">0.90 – 0.99</td><td className="p-2 text-yellow-700 font-medium">Moderate</td></tr>
                    <tr className="border-t border-slate-200 bg-red-50"><td className="p-2">≥ 1.00</td><td className="p-2 text-red-700 font-medium">High</td></tr>
                  </tbody>
                </table>
              </div>
              <div>
                <p className="font-medium text-slate-600 mb-1">Females</p>
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200">
                    <tr>
                      <th className="p-2 text-left">WHR</th>
                      <th className="p-2 text-left">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-200 bg-green-50"><td className="p-2">&lt; 0.80</td><td className="p-2 text-green-700 font-medium">Low</td></tr>
                    <tr className="border-t border-slate-200 bg-yellow-50"><td className="p-2">0.80 – 0.84</td><td className="p-2 text-yellow-700 font-medium">Moderate</td></tr>
                    <tr className="border-t border-slate-200 bg-red-50"><td className="p-2">≥ 0.85</td><td className="p-2 text-red-700 font-medium">High</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">High WHR is associated with increased risk of cardiovascular disease, type 2 diabetes, and metabolic syndrome, independent of BMI. Lower thresholds may apply for Asian populations.</p>
            <p className="text-xs text-slate-500">MCID: approximately 0.02 reduction considered clinically meaningful with lifestyle intervention.</p>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 References</p>
            <p>World Health Organization. (2008). <em>Waist Circumference and Waist-Hip Ratio: Report of a WHO Expert Consultation</em>. Geneva: WHO Press. ISBN: 9789241501491.</p>
            <p>Lean, M.E.J., Han, T.S., & Morrison, C.E. (1995). Waist circumference as a measure for indicating need for weight management. <em>BMJ</em>, 311, 158–161.</p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={onClose}><X className="mr-2 h-4 w-4" />Close</Button>
            <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" />Save Assessment</Button>
          </div>

        </div>
      </div>
    </div>
  );
}