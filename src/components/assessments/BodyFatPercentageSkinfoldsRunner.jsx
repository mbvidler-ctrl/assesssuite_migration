import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

export default function BodyFatPercentageSkinfoldsRunner({ client, onSave, onClose }) {
  const [measurements, setMeasurements] = useState({
    biceps: "",
    triceps: "",
    subscapular: "",
    suprailiac: "",
    chest: "",
    midaxillary: "",
    abdominal: "",
    thigh: "",
  });
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [notes, setNotes] = useState("");

  const handleMeasurementChange = (site) => (e) => {
    setMeasurements((prev) => ({
      ...prev,
      [site]: e.target.value,
    }));
  };

  const handleAgeChange = (e) => {
    setAge(e.target.value);
  };

  const handleSexChange = (e) => {
    setSex(e.target.value);
  };

  const handleNotesChange = (e) => {
    setNotes(e.target.value);
  };

  const handleSave = () => {
    const { biceps, triceps, subscapular, suprailiac, chest, midaxillary, abdominal, thigh } = measurements;
    const skinfolds = [biceps, triceps, subscapular, suprailiac, chest, midaxillary, abdominal, thigh].map(Number);
    const validMeasurements = skinfolds.filter((value) => !isNaN(value) && value > 0);

    if (validMeasurements.length < 4) {
      toast.error("Please provide at least four valid skinfold measurements.");
      return;
    }

    const sumOfSkinfolds = validMeasurements.reduce((acc, val) => acc + val, 0);
    let bodyDensity;
    let bodyFatPercentage;

    if (sex === "male") {
      if (validMeasurements.length === 4) {
        bodyDensity = 1.10938 - 0.0008267 * sumOfSkinfolds + 0.0000016 * sumOfSkinfolds ** 2 - 0.0002574 * age;
      } else if (validMeasurements.length === 7) {
        bodyDensity = 1.112 - 0.00043499 * sumOfSkinfolds + 0.00000055 * sumOfSkinfolds ** 2 - 0.00028826 * age;
      } else {
        toast.error("Invalid number of measurements for male.");
        return;
      }
    } else if (sex === "female") {
      if (validMeasurements.length === 4) {
        bodyDensity = 1.0994921 - 0.0009929 * sumOfSkinfolds + 0.0000023 * sumOfSkinfolds ** 2 - 0.0001392 * age;
      } else if (validMeasurements.length === 7) {
        bodyDensity = 1.097 - 0.00046971 * sumOfSkinfolds + 0.00000056 * sumOfSkinfolds ** 2 - 0.00012828 * age;
      } else {
        toast.error("Invalid number of measurements for female.");
        return;
      }
    } else {
      toast.error("Invalid sex.");
      return;
    }

    bodyFatPercentage = (495 / bodyDensity) - 450;

    const result_value = bodyFatPercentage.toFixed(2);
    const additional_data = {
      soap_text: `â€¢ Body Fat Percentage (Skinfolds)\n  Result: ${result_value}%\n  Sum of Skinfolds: ${sumOfSkinfolds} mm\n  Body Density: ${bodyDensity.toFixed(4)}\n  Age: ${age} | Sex: ${sex}`,
      measurement_type: "skinfold",
      measurements: validMeasurements,
      sum_of_skinfolds: sumOfSkinfolds,
      body_density: bodyDensity.toFixed(4),
      body_fat_percentage: result_value,
    };

    onSave({
      status: "completed",
      result_value,
      additional_data,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });

    toast.success("Assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Body Fat Percentage (Skinfolds) Assessment</CardTitle>
          </CardHeader>
          <CardContent>
          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1 mb-4">
            <p className="font-semibold">ðŸ“– Reference</p>
            <p>Jackson AS & Pollock ML. (1978). Generalized equations for predicting body density of men. <em>British Journal of Nutrition, 40</em>(3), 497â€“504.</p>
            <p>Jackson AS, Pollock ML, & Ward A. (1980). Generalized equations for predicting body density of women. <em>Medicine & Science in Sports & Exercise, 12</em>(3), 175â€“181.</p>
            <p>Siri WE. (1956). The gross composition of the body. <em>Advances in Biological and Medical Physics, 4</em>, 239â€“280. [Siri equation: BF% = (495/BD) âˆ’ 450]</p>
          </div>

          {/* Clinician Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1 mb-4">
            <p className="font-semibold">ðŸ“‹ Administration Instructions (Jackson & Pollock Protocol)</p>
            <p><strong>Equipment:</strong> Calibrated skinfold calipers (Harpenden or Lange). Take all measurements on the RIGHT side of the body. Client should not have exercised in the 4 hours prior.</p>
            <p><strong>Technique:</strong> Grasp skinfold firmly with thumb and index finger ~1 cm from site. Apply calipers perpendicular to fold. Read after 1â€“2 seconds. Take 2â€“3 readings per site, rotating through sites. Average if within 1â€“2 mm; discard outliers.</p>
            <p><strong>4-site (Durnin & Womersley):</strong> Biceps, Triceps, Subscapular, Suprailiac. <strong>7-site (Jackson & Pollock):</strong> Chest, Midaxillary, Triceps, Subscapular, Abdominal, Suprailiac, Thigh.</p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2 mb-4">
            <p className="font-semibold text-slate-700">ðŸ“Š Body Fat % Classification â€” ACSM</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Category</th><th className="p-2 text-center">Men (20â€“39)</th><th className="p-2 text-center">Men (40â€“59)</th><th className="p-2 text-center">Women (20â€“39)</th><th className="p-2 text-center">Women (40â€“59)</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">Excellent</td><td className="p-2 text-center">&lt;11%</td><td className="p-2 text-center">&lt;14%</td><td className="p-2 text-center">&lt;16%</td><td className="p-2 text-center">&lt;20%</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">Good</td><td className="p-2 text-center">11â€“13%</td><td className="p-2 text-center">14â€“17%</td><td className="p-2 text-center">16â€“19%</td><td className="p-2 text-center">20â€“23%</td></tr>
                  <tr className="border-t"><td className="p-2">Fair</td><td className="p-2 text-center">14â€“20%</td><td className="p-2 text-center">18â€“24%</td><td className="p-2 text-center">20â€“27%</td><td className="p-2 text-center">24â€“31%</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">Poor</td><td className="p-2 text-center">â‰¥21%</td><td className="p-2 text-center">â‰¥25%</td><td className="p-2 text-center">â‰¥28%</td><td className="p-2 text-center">â‰¥32%</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                value={age}
                onChange={handleAgeChange}
                className="w-24"
              />
            </div>
            <div className="flex items-center space-x-4">
              <Label htmlFor="sex">Sex</Label>
              <select
                id="sex"
                value={sex}
                onChange={handleSexChange}
                className="w-24"
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Biceps", site: "biceps" },
                { label: "Triceps", site: "triceps" },
                { label: "Subscapular", site: "subscapular" },
                { label: "Suprailiac", site: "suprailiac" },
                { label: "Chest", site: "chest" },
                { label: "Midaxillary", site: "midaxillary" },
                { label: "Abdominal", site: "abdominal" },
                { label: "Thigh", site: "thigh" },
              ].map(({ label, site }) => (
                <div key={site} className="flex items-center space-x-4">
                  <Label htmlFor={site}>{label}</Label>
                  <Input
                    id={site}
                    type="number"
                    value={measurements[site]}
                    onChange={handleMeasurementChange(site)}
                    className="w-24"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center space-x-4">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={handleNotesChange}
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-between mt-4">
        <Button variant="outline" onClick={onClose}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Save Assessment
        </Button>
      </div>
      </div>
    </div>
  );
}