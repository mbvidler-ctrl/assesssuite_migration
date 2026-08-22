import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";
import {
  BIA_NUMERIC_CONSTRAINTS,
  BIA_RUNNER_SPEC,
  validateAndScoreBia,
} from "@/lib/clinical/scorers/classDRepairs";

export default function BioelectricalImpedanceAnalysisBIARunner({ client, onSave, onClose }) {
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [hydrationStatus, setHydrationStatus] = useState("");
  const [electrodePlacement, setElectrodePlacement] = useState("");
  const [resistance, setResistance] = useState("");
  const [reactance, setReactance] = useState("");
  // BIA machine output fields
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [fatFreeMass, setFatFreeMass] = useState("");
  const [totalBodyWater, setTotalBodyWater] = useState("");
  const [skeletalMuscleMass, setSkeletalMuscleMass] = useState("");
  const [visceralFatLevel, setVisceralFatLevel] = useState("");
  const [bmi, setBmi] = useState("");
  const [basalMetabolicRate, setBasalMetabolicRate] = useState("");
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    try {
      const payload = validateAndScoreBia({
        height,
        weight,
        age,
        gender,
        hydration_status: hydrationStatus,
        electrode_placement: electrodePlacement,
        resistance,
        reactance,
        body_fat_pct: bodyFatPct,
        fat_free_mass: fatFreeMass,
        total_body_water: totalBodyWater,
        skeletal_muscle_mass: skeletalMuscleMass,
        visceral_fat_level: visceralFatLevel,
        bmi,
        basal_metabolic_rate: basalMetabolicRate,
        notes,
      }, { assessmentDate: todayLocal() });
      onSave(payload);
      toast.success("BIA result validated and ready to save.");
    } catch (error) {
      toast.error(error?.message || "Unable to validate the BIA result.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-5 border-b bg-gradient-to-r from-green-50 to-teal-50 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Bioelectrical Impedance Analysis (BIA)</h2>
            {client && <p className="text-sm text-slate-500 mt-0.5">Client: <span className="font-medium text-slate-700">{client.full_name}</span></p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800">
              <strong>Standardised conditions:</strong> Fasted 4–8 hrs; euhydrated; no exercise 12 hrs; no alcohol 24 hrs; no diuretics. Void bladder before test. Position supine with electrodes on hand and foot (or per device protocol). Follow manufacturer instructions and enter values below.
            </p>
          </div>

          {/* Body Fat Classification */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 Body Fat % Classification — ACSM</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Category</th><th className="p-2 text-center">Men</th><th className="p-2 text-center">Women</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">Essential fat</td><td className="p-2 text-center">2–5%</td><td className="p-2 text-center">10–13%</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">Athlete</td><td className="p-2 text-center">6–13%</td><td className="p-2 text-center">14–20%</td></tr>
                  <tr className="border-t"><td className="p-2">Fitness</td><td className="p-2 text-center">14–17%</td><td className="p-2 text-center">21–24%</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">Acceptable</td><td className="p-2 text-center">18–24%</td><td className="p-2 text-center">25–31%</td></tr>
                  <tr className="border-t"><td className="p-2">Obese</td><td className="p-2 text-center">≥25%</td><td className="p-2 text-center">≥32%</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* References */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 References</p>
            <p>Lukaski HC, Johnson PE, Bolonchuk WW, & Lykken GI. (1985). Assessment of fat-free mass using bioelectrical impedance measurements of the human body. <em>American Journal of Clinical Nutrition, 41</em>(4), 810–817.</p>
            <p>Kyle UG et al. (2004). Bioelectrical impedance analysis — Part I: review of principles and methods. <em>Clinical Nutrition, 23</em>(5), 1226–1243.</p>
          </div>

          {/* Client parameters */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Client Parameters</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Height (cm) *</Label>
                <Input type="number" min={BIA_NUMERIC_CONSTRAINTS.height.min} max={BIA_NUMERIC_CONSTRAINTS.height.max} step={BIA_NUMERIC_CONSTRAINTS.height.step} value={height} onChange={e => setHeight(e.target.value)} className="mt-1" placeholder="e.g. 170" />
              </div>
              <div>
                <Label>Weight (kg) *</Label>
                <Input type="number" min={BIA_NUMERIC_CONSTRAINTS.weight.min} max={BIA_NUMERIC_CONSTRAINTS.weight.max} step={BIA_NUMERIC_CONSTRAINTS.weight.step} value={weight} onChange={e => setWeight(e.target.value)} className="mt-1" placeholder="e.g. 70" />
              </div>
              <div>
                <Label>Age (years) *</Label>
                <Input type="number" min={BIA_NUMERIC_CONSTRAINTS.age.min} max={BIA_NUMERIC_CONSTRAINTS.age.max} step={BIA_NUMERIC_CONSTRAINTS.age.step} value={age} onChange={e => setAge(e.target.value)} className="mt-1" placeholder="e.g. 45" />
              </div>
              <div>
                <Label>Gender *</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Hydration Status</Label>
                <Select value={hydrationStatus} onValueChange={setHydrationStatus}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="euhydrated">Euhydrated</SelectItem>
                    <SelectItem value="dehydrated">Dehydrated</SelectItem>
                    <SelectItem value="overhydrated">Overhydrated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Electrode Placement</Label>
                <Select value={electrodePlacement} onValueChange={setElectrodePlacement}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select placement" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="handFoot">Hand and Foot</SelectItem>
                    <SelectItem value="footFoot">Foot and Foot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* BIA machine output */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-1">BIA Machine Output</h3>
            <p className="text-xs text-slate-500 mb-3">Body fat percentage is the required primary device result. Enter other displayed values where available.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Body Fat % *</Label>
                <Input type="number" min={BIA_NUMERIC_CONSTRAINTS.body_fat_pct.min} max={BIA_NUMERIC_CONSTRAINTS.body_fat_pct.max} step={BIA_NUMERIC_CONSTRAINTS.body_fat_pct.step} value={bodyFatPct} onChange={e => setBodyFatPct(e.target.value)} className="mt-1" placeholder="e.g. 22.5" />
              </div>
              <div>
                <Label>Fat-Free Mass (kg)</Label>
                <Input type="number" min={BIA_NUMERIC_CONSTRAINTS.fat_free_mass.min} max={BIA_NUMERIC_CONSTRAINTS.fat_free_mass.max} step={BIA_NUMERIC_CONSTRAINTS.fat_free_mass.step} value={fatFreeMass} onChange={e => setFatFreeMass(e.target.value)} className="mt-1" placeholder="e.g. 54.5" />
              </div>
              <div>
                <Label>Total Body Water (L)</Label>
                <Input type="number" min={BIA_NUMERIC_CONSTRAINTS.total_body_water.min} max={BIA_NUMERIC_CONSTRAINTS.total_body_water.max} step={BIA_NUMERIC_CONSTRAINTS.total_body_water.step} value={totalBodyWater} onChange={e => setTotalBodyWater(e.target.value)} className="mt-1" placeholder="e.g. 38.0" />
              </div>
              <div>
                <Label>Skeletal Muscle Mass (kg)</Label>
                <Input type="number" min={BIA_NUMERIC_CONSTRAINTS.skeletal_muscle_mass.min} max={BIA_NUMERIC_CONSTRAINTS.skeletal_muscle_mass.max} step={BIA_NUMERIC_CONSTRAINTS.skeletal_muscle_mass.step} value={skeletalMuscleMass} onChange={e => setSkeletalMuscleMass(e.target.value)} className="mt-1" placeholder="e.g. 28.0" />
              </div>
              <div>
                <Label>Visceral Fat Level</Label>
                <Input type="number" min={BIA_NUMERIC_CONSTRAINTS.visceral_fat_level.min} max={BIA_NUMERIC_CONSTRAINTS.visceral_fat_level.max} step={BIA_NUMERIC_CONSTRAINTS.visceral_fat_level.step} value={visceralFatLevel} onChange={e => setVisceralFatLevel(e.target.value)} className="mt-1" placeholder="e.g. 8" />
              </div>
              <div>
                <Label>BMI (device) (kg/m²)</Label>
                <Input type="number" min={BIA_NUMERIC_CONSTRAINTS.bmi.min} max={BIA_NUMERIC_CONSTRAINTS.bmi.max} step={BIA_NUMERIC_CONSTRAINTS.bmi.step} value={bmi} onChange={e => setBmi(e.target.value)} className="mt-1" placeholder="e.g. 24.2" />
              </div>
              <div>
                <Label>Basal Metabolic Rate (kcal/day)</Label>
                <Input type="number" min={BIA_NUMERIC_CONSTRAINTS.basal_metabolic_rate.min} max={BIA_NUMERIC_CONSTRAINTS.basal_metabolic_rate.max} step={BIA_NUMERIC_CONSTRAINTS.basal_metabolic_rate.step} value={basalMetabolicRate} onChange={e => setBasalMetabolicRate(e.target.value)} className="mt-1" placeholder="e.g. 1650" />
              </div>
            </div>
          </div>

          {/* Raw impedance */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Raw Impedance Values</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Resistance (Ω)</Label>
                <Input type="number" min={BIA_NUMERIC_CONSTRAINTS.resistance.min} max={BIA_NUMERIC_CONSTRAINTS.resistance.max} step={BIA_NUMERIC_CONSTRAINTS.resistance.step} value={resistance} onChange={e => setResistance(e.target.value)} className="mt-1" placeholder="e.g. 520" />
              </div>
              <div>
                <Label>Reactance (Ω)</Label>
                <Input type="number" min={BIA_NUMERIC_CONSTRAINTS.reactance.min} max={BIA_NUMERIC_CONSTRAINTS.reactance.max} step={BIA_NUMERIC_CONSTRAINTS.reactance.step} value={reactance} onChange={e => setReactance(e.target.value)} className="mt-1" placeholder="e.g. 65" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Clinical Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={4000} rows={2} placeholder="Additional observations..." className="mt-1" />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 shrink-0 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-teal-600 hover:bg-teal-700">
            <Save className="w-4 h-4 mr-2" /> Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}
