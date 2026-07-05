import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";

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
    if (!height || !weight || !age || !gender) {
      toast.error("Please fill in height, weight, age and gender.");
      return;
    }
    if (!bodyFatPct && !resistance) {
      toast.error("Please enter at least the body fat % or resistance/reactance from the BIA machine.");
      return;
    }

    const resultValue = bodyFatPct ? parseFloat(bodyFatPct) : null;

    const hydrationLabels = { euhydrated: "Euhydrated", dehydrated: "Dehydrated", overhydrated: "Overhydrated" };
    const placementLabels = { handFoot: "Hand and Foot", footFoot: "Foot and Foot" };

    const soap_text =
      `Bioelectrical Impedance Analysis (BIA)\n\n` +
      `--- Client Parameters ---\n` +
      `  Height: ${height} cm\n` +
      `  Weight: ${weight} kg\n` +
      `  Age: ${age} years\n` +
      `  Gender: ${gender.charAt(0).toUpperCase() + gender.slice(1)}\n` +
      `  Hydration Status: ${hydrationLabels[hydrationStatus] || hydrationStatus || 'Not recorded'}\n` +
      `  Electrode Placement: ${placementLabels[electrodePlacement] || electrodePlacement || 'Not recorded'}\n` +
      `\n--- BIA Machine Output ---\n` +
      (bodyFatPct    ? `  Body Fat %:           ${bodyFatPct}%\n` : '') +
      (fatFreeMass   ? `  Fat-Free Mass:        ${fatFreeMass} kg\n` : '') +
      (totalBodyWater? `  Total Body Water:     ${totalBodyWater} L\n` : '') +
      (skeletalMuscleMass ? `  Skeletal Muscle Mass: ${skeletalMuscleMass} kg\n` : '') +
      (visceralFatLevel   ? `  Visceral Fat Level:   ${visceralFatLevel}\n` : '') +
      (bmi           ? `  BMI (device):         ${bmi} kg/m²\n` : '') +
      (basalMetabolicRate ? `  Basal Metabolic Rate: ${basalMetabolicRate} kcal/day\n` : '') +
      `\n--- Raw Impedance Values ---\n` +
      (resistance ? `  Resistance:  ${resistance} Ω\n` : '  Resistance:  Not recorded\n') +
      (reactance  ? `  Reactance:   ${reactance} Ω\n` : '  Reactance:   Not recorded\n') +
      (notes ? `\nClinical Notes: ${notes}` : '');

    onSave({
      result_value: resultValue,
      additional_data: {
        measurement_type: "BIA",
        soap_text,
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
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
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
                <Input type="number" value={height} onChange={e => setHeight(e.target.value)} className="mt-1" placeholder="e.g. 170" />
              </div>
              <div>
                <Label>Weight (kg) *</Label>
                <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="mt-1" placeholder="e.g. 70" />
              </div>
              <div>
                <Label>Age (years) *</Label>
                <Input type="number" value={age} onChange={e => setAge(e.target.value)} className="mt-1" placeholder="e.g. 45" />
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
            <p className="text-xs text-slate-500 mb-3">Enter all values displayed by the BIA machine. Leave blank if not provided.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Body Fat % *</Label>
                <Input type="number" step="0.1" value={bodyFatPct} onChange={e => setBodyFatPct(e.target.value)} className="mt-1" placeholder="e.g. 22.5" />
              </div>
              <div>
                <Label>Fat-Free Mass (kg)</Label>
                <Input type="number" step="0.1" value={fatFreeMass} onChange={e => setFatFreeMass(e.target.value)} className="mt-1" placeholder="e.g. 54.5" />
              </div>
              <div>
                <Label>Total Body Water (L)</Label>
                <Input type="number" step="0.1" value={totalBodyWater} onChange={e => setTotalBodyWater(e.target.value)} className="mt-1" placeholder="e.g. 38.0" />
              </div>
              <div>
                <Label>Skeletal Muscle Mass (kg)</Label>
                <Input type="number" step="0.1" value={skeletalMuscleMass} onChange={e => setSkeletalMuscleMass(e.target.value)} className="mt-1" placeholder="e.g. 28.0" />
              </div>
              <div>
                <Label>Visceral Fat Level</Label>
                <Input type="number" step="1" value={visceralFatLevel} onChange={e => setVisceralFatLevel(e.target.value)} className="mt-1" placeholder="e.g. 8" />
              </div>
              <div>
                <Label>BMI (device) (kg/m²)</Label>
                <Input type="number" step="0.1" value={bmi} onChange={e => setBmi(e.target.value)} className="mt-1" placeholder="e.g. 24.2" />
              </div>
              <div>
                <Label>Basal Metabolic Rate (kcal/day)</Label>
                <Input type="number" value={basalMetabolicRate} onChange={e => setBasalMetabolicRate(e.target.value)} className="mt-1" placeholder="e.g. 1650" />
              </div>
            </div>
          </div>

          {/* Raw impedance */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Raw Impedance Values</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Resistance (Ω)</Label>
                <Input type="number" value={resistance} onChange={e => setResistance(e.target.value)} className="mt-1" placeholder="e.g. 520" />
              </div>
              <div>
                <Label>Reactance (Ω)</Label>
                <Input type="number" value={reactance} onChange={e => setReactance(e.target.value)} className="mt-1" placeholder="e.g. 65" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Clinical Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional observations..." className="mt-1" />
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