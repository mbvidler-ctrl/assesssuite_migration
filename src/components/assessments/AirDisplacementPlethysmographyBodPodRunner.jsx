import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";
import {
  computeBodPodResult,
  validateAndScoreBodPod,
} from "@/lib/clinical/scorers/maintainedPhysioAdditions";

export default function AirDisplacementPlethysmographyBodPodRunner({ onSave, onClose }) {
  const [bodyMass, setBodyMass] = useState("");
  const [bodyVolume, setBodyVolume] = useState("");
  const [bodyDensity, setBodyDensity] = useState("");
  const [fatMass, setFatMass] = useState("");
  const [fatFreeMass, setFatFreeMass] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [resting, setResting] = useState("");
  const [notes, setNotes] = useState("");

  const input = {
    body_mass_kg: bodyMass,
    body_volume_l: bodyVolume,
    body_density_g_cc: bodyDensity,
    fat_mass_kg: fatMass,
    fat_free_mass_kg: fatFreeMass,
    body_fat_pct: bodyFatPct,
    resting_metabolic_rate_kcal_day: resting,
    notes,
  };
  let preview = null;
  try {
    preview = computeBodPodResult(input);
  } catch {
    preview = null;
  }

  const handleSave = () => {
    try {
      const payload = validateAndScoreBodPod(input, {
        assessmentName: "Air Displacement Plethysmography (BOD POD)",
        assessmentDate: todayLocal(),
      });
      onSave(payload);
      toast.success("BOD POD result saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to score BOD POD result");
    }
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
              <div><Label>Body Mass (kg)</Label><Input type="number" min="0.01" max="500" step="0.01" value={bodyMass} onChange={e => setBodyMass(e.target.value)} placeholder="e.g. 82.3" className="mt-1" /></div>
              <div><Label>Body Volume (L)</Label><Input type="number" min="0.01" max="500" step="0.01" value={bodyVolume} onChange={e => setBodyVolume(e.target.value)} placeholder="e.g. 76.8" className="mt-1" /></div>
              <div><Label>Body Density (g/cc)</Label><Input type="number" min="0.5" max="2" step="0.001" value={bodyDensity} onChange={e => setBodyDensity(e.target.value)} placeholder="e.g. 1.062" className="mt-1" /></div>
              <div><Label>Body Fat %</Label><Input type="number" min="0" max="100" step="0.1" value={bodyFatPct} onChange={e => setBodyFatPct(e.target.value)} placeholder="e.g. 22.4" className="mt-1" /></div>
              <div><Label>Fat Mass (kg)</Label><Input type="number" min="0" max="500" step="0.01" value={fatMass} onChange={e => setFatMass(e.target.value)} placeholder="e.g. 18.4" className="mt-1" /></div>
              <div><Label>Fat-Free Mass (kg)</Label><Input type="number" min="0" max="500" step="0.01" value={fatFreeMass} onChange={e => setFatFreeMass(e.target.value)} placeholder="e.g. 63.9" className="mt-1" /></div>
              <div><Label>Resting Metabolic Rate (kcal/day)</Label><Input type="number" min="0" max="10000" step="1" value={resting} onChange={e => setResting(e.target.value)} placeholder="e.g. 1820" className="mt-1" /></div>
            </CardContent>
          </Card>

          {preview && (
            <div className="border-2 rounded-xl p-5 text-center bg-slate-50 text-slate-800 border-slate-300">
              <p className="text-5xl font-bold">{preview.body_fat_pct.toFixed(1)}%</p>
              <p className="text-sm mt-1">Body Fat</p>
              <p className="text-xs mt-2">{preview.result_source === "device-reported-body-fat-percentage" ? "Device-reported value" : "Calculated from fat mass and body mass"}</p>
            </div>
          )}

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
