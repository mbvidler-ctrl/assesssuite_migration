import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

export default function WeightRunner({ client, onSave, onClose }) {
  const [weight, setWeight] = useState("");
  const [clothingAdjustment, setClothingAdjustment] = useState("0");
  const [notes, setNotes] = useState("");

  const adjustedWeight = weight && !isNaN(parseFloat(weight))
    ? (parseFloat(weight) - parseFloat(clothingAdjustment || 0)).toFixed(1)
    : null;

  const handleSave = () => {
    if (!weight) return;
    const w = parseFloat(adjustedWeight || weight);
    const soapLines = [
      `â€¢ Body Weight Measurement`,
      `  Measured Weight: ${weight} kg`,
      clothingAdjustment && parseFloat(clothingAdjustment) > 0 ? `  Clothing Deduction: ${clothingAdjustment} kg` : "",
      `  Adjusted Weight: ${w} kg`,
      notes ? `  Notes: ${notes}` : "",
      `  Protocol: Calibrated digital scale, light clothing, no shoes, post-void`,
    ].filter(Boolean).join("\n");

    onSave({
      result_value: w,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
      additional_data: {
        soap_text: soapLines,
        weight_kg: w,
        measured_kg: parseFloat(weight),
        clothing_adjustment_kg: parseFloat(clothingAdjustment) || 0,
      }
    });
  };

  return (
    <div className="space-y-5 p-1">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Body Weight Measurement</h2>
          <p className="text-sm text-slate-500">Anthropometric measurement</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {/* Protocol */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
        <p className="font-semibold">ðŸ“‹ Measurement Protocol (ISAK/ESSA)</p>
        <ul className="list-disc list-inside text-xs space-y-1 text-blue-700">
          <li>Calibrate scale to zero before measurement</li>
          <li>Client should be post-void (bladder empty)</li>
          <li>Minimal clothing â€” light shorts/shirt only</li>
          <li>Remove shoes, heavy belts, jewellery, phone</li>
          <li>Client stands in centre of scale, evenly distributed</li>
          <li>Record to nearest 0.1 kg</li>
          <li>Standardise time of day (preferably morning)</li>
        </ul>
        <p className="italic text-xs">"Please remove your shoes and stand in the middle of the scale with your weight evenly distributed. Look straight ahead."</p>
      </div>

      {/* Entry */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-semibold text-slate-700">Measured Weight (kg) <span className="text-red-500">*</span></Label>
            <Input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)}
              placeholder="e.g. 75.4" className="mt-1 text-lg font-bold" />
          </div>
          <div>
            <Label className="text-sm font-semibold text-slate-700">Clothing Deduction (kg)</Label>
            <p className="text-xs text-slate-400">Light clothing â‰ˆ 0.3â€“0.5 kg</p>
            <Input type="number" step="0.1" value={clothingAdjustment} onChange={e => setClothingAdjustment(e.target.value)}
              placeholder="0.0" className="mt-1" />
          </div>
        </div>
        {adjustedWeight && (
          <div className="bg-slate-100 rounded-lg px-4 py-3 text-center">
            <p className="text-xs text-slate-500">Adjusted Body Weight</p>
            <p className="text-4xl font-bold text-slate-800">{adjustedWeight} kg</p>
          </div>
        )}
      </div>

      <div>
        <Label className="text-sm font-semibold text-slate-700">Notes</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Scale type, time of day, oedema noted, recent illness, trends..." className="mt-1 text-sm" />
      </div>

      {/* References */}
      <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">ðŸ“– References</p>
        <p>1. Norton K &amp; Olds T. (1996). <em>Anthropometrica</em>. University of New South Wales Press.</p>
        <p>2. Exercise &amp; Sports Science Australia (ESSA). (2020). Health Outcome Measures Manual. ESSA.</p>
        <p>3. ISAK. (2001). International Standards for Anthropometric Assessment. International Society for the Advancement of Kinanthropometry.</p>
      </div>

      <div className="flex justify-between pt-2 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={!weight} className="bg-blue-600 hover:bg-blue-700 text-white">
          Save Weight
        </Button>
      </div>
    </div>
  );
}