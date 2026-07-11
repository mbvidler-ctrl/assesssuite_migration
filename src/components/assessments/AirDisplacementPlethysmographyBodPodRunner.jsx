import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// ACSM body fat % classification norms
const FAT_NORMS = {
  male: [
    { ageMin: 20, ageMax: 29, essential: 5, athletic: 6, fitness: 12, acceptable: 18, obese: 25 },
    { ageMin: 30, ageMax: 39, essential: 5, athletic: 8, fitness: 14, acceptable: 21, obese: 27 },
    { ageMin: 40, ageMax: 49, essential: 5, athletic: 10, fitness: 16, acceptable: 23, obese: 29 },
    { ageMin: 50, ageMax: 120, essential: 5, athletic: 12, fitness: 18, acceptable: 25, obese: 31 },
  ],
  female: [
    { ageMin: 20, ageMax: 29, essential: 13, athletic: 16, fitness: 20, acceptable: 26, obese: 33 },
    { ageMin: 30, ageMax: 39, essential: 13, athletic: 18, fitness: 22, acceptable: 28, obese: 35 },
    { ageMin: 40, ageMax: 49, essential: 13, athletic: 20, fitness: 24, acceptable: 30, obese: 37 },
    { ageMin: 50, ageMax: 120, essential: 13, athletic: 22, fitness: 26, acceptable: 32, obese: 39 },
  ],
};

function classifyBodyFat(pct, age, gender) {
  const rows = FAT_NORMS[gender === "male" ? "male" : "female"];
  if (!rows || !age) return null;
  const row = rows.find(r => age >= r.ageMin && age <= r.ageMax);
  if (!row) return null;
  if (pct < row.essential) return { label: "Below Essential Fat", color: "bg-red-100 text-red-800 border-red-300" };
  if (pct < row.athletic) return { label: "Athletic", color: "bg-green-200 text-green-900 border-green-400" };
  if (pct < row.fitness) return { label: "Fitness", color: "bg-green-100 text-green-800 border-green-300" };
  if (pct < row.acceptable) return { label: "Acceptable", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  if (pct < row.obese) return { label: "Overweight", color: "bg-orange-100 text-orange-800 border-orange-300" };
  return { label: "Obese", color: "bg-red-100 text-red-800 border-red-300" };
}

export default function AirDisplacementPlethysmographyBodPodRunner({ client, onSave, onClose }) {
  const [bodyMass, setBodyMass] = useState("");
  const [bodyVolume, setBodyVolume] = useState("");
  const [bodyDensity, setBodyDensity] = useState("");
  const [fatMass, setFatMass] = useState("");
  const [fatFreeMass, setFatFreeMass] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [resting, setResting] = useState("");
  const [notes, setNotes] = useState("");

  const age = client?.date_of_birth ? Math.floor((Date.now() - new Date(client.date_of_birth)) / (365.25 * 24 * 3600 * 1000)) : null;
  const gender = client?.gender;

  const computedFatPct = bodyFatPct ? parseFloat(bodyFatPct) :
    (fatMass && bodyMass ? (parseFloat(fatMass) / parseFloat(bodyMass) * 100) : null);

  const cat = computedFatPct && age && gender ? classifyBodyFat(computedFatPct, age, gender) : null;

  const handleSave = () => {
    if (!bodyFatPct && !fatMass) { toast.error("Enter body fat % or fat mass"); return; }
    const pct = computedFatPct?.toFixed(1);
    const ffm = fatFreeMass || (bodyMass && fatMass ? (parseFloat(bodyMass) - parseFloat(fatMass)).toFixed(1) : null);
    const soap = `• Air Displacement Plethysmography (BOD POD)\n  Body Fat: ${pct}%${cat ? ` — ${cat.label}` : ""}\n  Body Mass: ${bodyMass || "N/A"} kg\n  Body Volume: ${bodyVolume || "N/A"} L\n  Body Density: ${bodyDensity || "N/A"} g/cc\n  Fat Mass: ${fatMass || "N/A"} kg\n  Fat-Free Mass: ${ffm || "N/A"} kg${resting ? `\n  Resting Metabolic Rate (Measured): ${resting} kcal/day` : ""}${notes ? `\n  Notes: ${notes}` : ""}\n  Reference: Siri equation: %BF = (4.95/D - 4.50) × 100`;
    onSave({ status: "completed", result_value: parseFloat(pct), notes, assessment_date: todayLocal(), additional_data: { soap_text: soap, measurement_type: "body_composition", body_fat_pct: parseFloat(pct), fat_mass_kg: fatMass ? parseFloat(fatMass) : null, fat_free_mass_kg: ffm ? parseFloat(ffm) : null, body_mass_kg: bodyMass ? parseFloat(bodyMass) : null, classification: cat?.label } });
    toast.success("BOD POD result saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-blue-50 to-cyan-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">BOD POD — Air Displacement Plethysmography</h2><p className="text-slate-500 text-sm mt-0.5">Body composition by ADP</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Protocol Notes</p>
            <p>BOD POD uses air displacement to measure body volume, calculates body density, then estimates body fat via the Siri/Lohman equations. Results reported directly by the device.</p>
            <p><strong>Pre-test:</strong> 2-hr fast, no exercise within 8 hrs, wear minimal tight-fitting clothing (swimsuit/Lycra). Remove jewellery.</p>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">BOD POD Device Output</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><Label>Body Mass (kg)</Label><Input type="number" step="0.01" value={bodyMass} onChange={e => setBodyMass(e.target.value)} placeholder="e.g. 82.3" className="mt-1" /></div>
              <div><Label>Body Volume (L)</Label><Input type="number" step="0.01" value={bodyVolume} onChange={e => setBodyVolume(e.target.value)} placeholder="e.g. 76.8" className="mt-1" /></div>
              <div><Label>Body Density (g/cc)</Label><Input type="number" step="0.001" value={bodyDensity} onChange={e => setBodyDensity(e.target.value)} placeholder="e.g. 1.062" className="mt-1" /></div>
              <div><Label>Body Fat %</Label><Input type="number" step="0.1" value={bodyFatPct} onChange={e => setBodyFatPct(e.target.value)} placeholder="e.g. 22.4" className="mt-1" /></div>
              <div><Label>Fat Mass (kg)</Label><Input type="number" step="0.01" value={fatMass} onChange={e => setFatMass(e.target.value)} placeholder="e.g. 18.4" className="mt-1" /></div>
              <div><Label>Fat-Free Mass (kg)</Label><Input type="number" step="0.01" value={fatFreeMass} onChange={e => setFatFreeMass(e.target.value)} placeholder="e.g. 63.9" className="mt-1" /></div>
              <div><Label>Resting Metabolic Rate (kcal/day)</Label><Input type="number" step="1" value={resting} onChange={e => setResting(e.target.value)} placeholder="e.g. 1820" className="mt-1" /></div>
            </CardContent>
          </Card>

          {computedFatPct && (
            <div className={`border-2 rounded-xl p-5 text-center ${cat?.color || "bg-slate-50 text-slate-800 border-slate-300"}`}>
              <p className="text-5xl font-bold">{computedFatPct.toFixed(1)}%</p>
              <p className="text-sm mt-1">Body Fat</p>
              {cat && <p className="font-semibold text-lg mt-2">{cat.label}</p>}
            </div>
          )}

          {/* Norms & Interpretation */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 Body Fat % Classifications (ACSM)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Category</th><th className="p-2 text-center">Men 20–39</th><th className="p-2 text-center">Men 40–59</th><th className="p-2 text-center">Women 20–39</th><th className="p-2 text-center">Women 40–59</th></tr></thead>
                <tbody>
                  <tr className="border-t border-slate-200"><td className="p-2">Essential fat</td><td className="p-2 text-center">2–5%</td><td className="p-2 text-center">2–5%</td><td className="p-2 text-center">10–13%</td><td className="p-2 text-center">10–13%</td></tr>
                  <tr className="border-t border-slate-200 bg-white"><td className="p-2">Athletic</td><td className="p-2 text-center">6–13%</td><td className="p-2 text-center">8–17%</td><td className="p-2 text-center">14–20%</td><td className="p-2 text-center">20–26%</td></tr>
                  <tr className="border-t border-slate-200"><td className="p-2">Fitness</td><td className="p-2 text-center">14–17%</td><td className="p-2 text-center">18–21%</td><td className="p-2 text-center">21–24%</td><td className="p-2 text-center">27–30%</td></tr>
                  <tr className="border-t border-slate-200 bg-white"><td className="p-2">Acceptable</td><td className="p-2 text-center">18–24%</td><td className="p-2 text-center">22–27%</td><td className="p-2 text-center">25–31%</td><td className="p-2 text-center">31–36%</td></tr>
                  <tr className="border-t border-slate-200"><td className="p-2">Obese</td><td className="p-2 text-center">≥25%</td><td className="p-2 text-center">≥28%</td><td className="p-2 text-center">≥32%</td><td className="p-2 text-center">≥37%</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">BOD POD TEE ±1–2% vs hydrostatic weighing. Siri equation: %BF = (4.95/D − 4.50) × 100. Source: ACSM Guidelines (2022).</p>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Dempster P & Aitkens S. (1995). A new air displacement method for the determination of human body composition. <em>Medicine & Science in Sports & Exercise, 27</em>(12), 1692–1697.</p>
            <p>Siri WE. (1956). The gross composition of the body. <em>Advances in Biological and Medical Physics, 4</em>, 239–280.</p>
          </div>

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Clinical context, limitations, body composition goals..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}