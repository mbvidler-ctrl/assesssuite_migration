import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

export default function WaistCircumferenceRunner({ client, onSave, onClose }) {
  const [waistCircumference, setWaistCircumference] = useState("");
  const [notes, setNotes] = useState("");


  const handleSave = () => {
    if (!waistCircumference) { toast.error("Please enter a waist circumference value."); return; }
    const resultValue = parseFloat(waistCircumference);
    const riskLevel = calculateRisk();
    onSave({
      status: "completed",
      result_value: resultValue,
      additional_data: {
        soap_text: `â€¢ Waist Circumference Measurement\n  Result: ${resultValue} cm\n  Risk Category: ${riskLevel}`,
        measurement_type: "waist_circumference",
        waist_circumference: resultValue,
        notes,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Measurement saved successfully.");
  };

  const handleWaistCircumferenceChange = (e) => {
    const value = e.target.value;
    if (/^\d*\.?\d{0,1}$/.test(value)) {
      setWaistCircumference(value);
    }
  };

  const handleNotesChange = (e) => {
    setNotes(e.target.value);
  };

  const calculateRisk = () => {
    if (!waistCircumference) return null;
    const wc = parseFloat(waistCircumference);
    const isMale = client.gender === "male";
    if (isMale) {
      if (wc >= 102) return "Substantially increased risk";
      if (wc >= 94) return "Increased risk";
    } else {
      if (wc >= 88) return "Substantially increased risk";
      if (wc >= 80) return "Increased risk";
    }
    return "Normal risk";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Waist Circumference Measurement</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="mt-4">
            <Label htmlFor="waistCircumference">Waist Circumference (cm)</Label>
            <Input
              id="waistCircumference"
              type="text"
              value={waistCircumference}
              onChange={handleWaistCircumferenceChange}
              placeholder="Enter waist circumference"
            />
          </div>
          <div className="mt-4">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={handleNotesChange}
              placeholder="Enter any additional notes"
            />
          </div>
          {waistCircumference && (
            <div className="mt-4">
              <Badge>{calculateRisk()}</Badge>
            </div>
          )}

          {/* Clinician Instructions */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
            <p className="font-semibold">ðŸ“‹ Administration Instructions (WHO Protocol)</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Client should be standing, relaxed, with feet together and arms at sides</li>
              <li>Locate the measurement site: midway between the lowest rib margin and the top of the iliac crest (superior border)</li>
              <li>Apply tape horizontally, parallel to the floor â€” snug but not compressing skin</li>
              <li>Measure at end of normal expiration (not forced)</li>
              <li>Record to nearest 0.1 cm; take two measurements and average if within 1 cm</li>
            </ul>
            <p className="italic mt-2">"Stand with your feet together and relax your abdomen. I'm going to measure around your waist. Please breathe normally."</p>
          </div>

          {/* Norms & Interpretation */}
          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 space-y-2">
            <p className="font-semibold">ðŸ“Š Norms & Interpretation (WHO/NHMRC)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded mt-1">
                <thead className="bg-slate-200">
                  <tr>
                    <th className="p-2 text-left">Risk Level</th>
                    <th className="p-2 text-left">Men</th>
                    <th className="p-2 text-left">Women</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-200"><td className="p-2">Low / Normal risk</td><td className="p-2">&lt; 94 cm</td><td className="p-2">&lt; 80 cm</td></tr>
                  <tr className="border-t border-slate-200 bg-white"><td className="p-2">Increased risk</td><td className="p-2">94â€“101 cm</td><td className="p-2">80â€“87 cm</td></tr>
                  <tr className="border-t border-slate-200"><td className="p-2">Substantially increased risk</td><td className="p-2">â‰¥ 102 cm</td><td className="p-2">â‰¥ 88 cm</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-1">Increased risk = metabolic syndrome, cardiovascular disease, type 2 diabetes. Risk thresholds vary by ethnicity â€” lower thresholds apply for Asian populations (â‰¥90 cm men, â‰¥80 cm women).</p>
          </div>

          {/* Reference */}
          <div className="mt-4 bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">ðŸ“– Reference</p>
            <p>World Health Organization. (2011). <em>Waist Circumference and Waist-Hip Ratio: Report of a WHO Expert Consultation</em>. WHO Press.</p>
            <p>National Health and Medical Research Council (NHMRC). (2013). Clinical practice guidelines for the management of overweight and obesity in adults. Commonwealth of Australia.</p>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-between mt-4">
        <Button variant="outline" onClick={onClose}>
          <X className="mr-2" />Cancel
        </Button>
        <Button onClick={handleSave}>
          <Save className="mr-2" />Save Measurement
        </Button>
      </div>
      </div>
    </div>
  );
}