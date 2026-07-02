import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';

// Age correction factors per Ã…strand protocol
function getAgeCorrectionFactor(age) {
  if (age <= 24) return 1.10;
  if (age <= 34) return 1.00;
  if (age <= 44) return 0.87;
  if (age <= 54) return 0.83;
  if (age <= 64) return 0.78;
  return 0.75;
}

function getVO2Category(vo2, sex, age) {
  // ACSM categories by sex and broad age group
  const norms = {
    male: [
      { maxAge: 29, excellent: 52, good: 43, fair: 34 },
      { maxAge: 39, excellent: 50, good: 41, fair: 32 },
      { maxAge: 49, excellent: 45, good: 38, fair: 30 },
      { maxAge: 59, excellent: 42, good: 35, fair: 27 },
      { maxAge: 200, excellent: 38, good: 31, fair: 24 },
    ],
    female: [
      { maxAge: 29, excellent: 41, good: 35, fair: 27 },
      { maxAge: 39, excellent: 39, good: 33, fair: 25 },
      { maxAge: 49, excellent: 36, good: 29, fair: 22 },
      { maxAge: 59, excellent: 34, good: 27, fair: 20 },
      { maxAge: 200, excellent: 30, good: 24, fair: 17 },
    ]
  };
  const bracket = (norms[sex] || norms.male).find(n => age <= n.maxAge);
  if (!bracket) return 'Unknown';
  if (vo2 >= bracket.excellent) return 'Excellent';
  if (vo2 >= bracket.good) return 'Good';
  if (vo2 >= bracket.fair) return 'Fair';
  return 'Poor';
}

export default function AstrandTestRunner({ onSave, onClose, initialData, client }) {
  const [data, setData] = useState({
    sex: initialData?.sex || client?.gender || "",
    age: initialData?.age || "",
    body_mass_kg: initialData?.body_mass_kg || "",
    workload_watts: initialData?.workload_watts || "",
    hr_minute4: initialData?.hr_minute4 || "",
    hr_minute5: initialData?.hr_minute5 || "",
    hr_minute6: initialData?.hr_minute6 || "",
    observations: initialData?.observations || ""
  });

  const calc = useMemo(() => {
    const age = parseFloat(data.age);
    const bodyMass = parseFloat(data.body_mass_kg);
    const watts = parseFloat(data.workload_watts);
    const hr5 = parseFloat(data.hr_minute5);
    const hr6 = parseFloat(data.hr_minute6);
    const hr4 = parseFloat(data.hr_minute4) || null;

    const errors = [];
    const warnings = [];

    // Required field validation
    if (!data.sex) errors.push("Sex is required.");
    if (!age || age < 15 || age > 80) errors.push("Age must be between 15 and 80.");
    if (!bodyMass || bodyMass <= 0) errors.push("Body mass must be > 0 kg.");
    if (!watts || watts <= 0) errors.push("Workload must be > 0 watts.");
    if (!hr5 || hr5 < 60 || hr5 > 170) errors.push("Minute 5 HR must be between 60â€“170 bpm.");
    if (!hr6 || hr6 < 60 || hr6 > 170) errors.push("Minute 6 HR must be between 60â€“170 bpm.");

    if (errors.length > 0) return { errors, warnings, valid: false };

    // Steady-state check
    const steadyStateDiff = Math.abs(hr6 - hr5);
    if (steadyStateDiff > 5) {
      errors.push(`Steady state not achieved (|HR6 - HR5| = ${steadyStateDiff} bpm > 5 bpm). Extend test or repeat at a more suitable workload.`);
      return { errors, warnings, valid: false };
    }

    const steadyStateHR = (hr5 + hr6) / 2;
    const predictedHRmax = 220 - age;

    // Caution flags
    if (steadyStateHR < 120) warnings.push("Average steady-state HR < 120 bpm â€” result may be less reliable.");
    if (steadyStateHR > 170) warnings.push("Average steady-state HR > 170 bpm â€” result may be less reliable.");
    if (steadyStateHR > 0.85 * predictedHRmax) warnings.push("Heart rate too high for reliable submaximal prediction (>85% of age-predicted HRmax).");
    if (hr4 && Math.abs(hr4 - hr5) > 5) warnings.push("Minute 4 and 5 HR differ by >5 bpm â€” steady state may have been entered late.");

    // Core calculation
    const kgmMin = watts * 6.12;
    const vo2Submax = (1.8 * kgmMin) / bodyMass + 7;
    const vo2Uncorrected = vo2Submax * (predictedHRmax / steadyStateHR);
    const ageFactor = getAgeCorrectionFactor(age);
    const vo2Final = vo2Uncorrected * ageFactor;

    const category = getVO2Category(vo2Final, data.sex, age);

    return {
      valid: true,
      errors,
      warnings,
      steadyStateHR: steadyStateHR.toFixed(1),
      predictedHRmax,
      kgmMin: kgmMin.toFixed(1),
      vo2Submax: vo2Submax.toFixed(1),
      vo2Uncorrected: vo2Uncorrected.toFixed(1),
      ageFactor,
      vo2Final: vo2Final.toFixed(1),
      category
    };
  }, [data]);

  const handleSave = () => {
    if (!calc.valid) return;

    const soapLines = [
      `â€¢ Ã…strand-Rhyming Cycle Ergometer Test`,
      `  Sex: ${data.sex} | Age: ${data.age} yrs | Body mass: ${data.body_mass_kg} kg`,
      `  Workload: ${data.workload_watts} W (${calc.kgmMin} kgm/min)`,
      `  HR: Min 5 = ${data.hr_minute5} bpm | Min 6 = ${data.hr_minute6} bpm${data.hr_minute4 ? ` | Min 4 = ${data.hr_minute4} bpm` : ''}`,
      `  Steady-state HR: ${calc.steadyStateHR} bpm | Predicted HRmax: ${calc.predictedHRmax} bpm`,
      `  VO2submax: ${calc.vo2Submax} ml/kg/min | Age-correction factor: ${calc.ageFactor}`,
      `  Estimated VO2max: ${calc.vo2Final} ml/kg/min (${calc.category})`,
    ];
    if (calc.warnings.length > 0) soapLines.push(`  Flags: ${calc.warnings.join('; ')}`);
    if (data.observations) soapLines.push(`  Observations: ${data.observations}`);

    onSave({
      result_value: parseFloat(calc.vo2Final),
      additional_data: {
        measurement_type: 'astrand',
        soap_text: soapLines.join('\n'),
        sex: data.sex,
        age: parseFloat(data.age),
        body_mass_kg: parseFloat(data.body_mass_kg),
        workload_watts: parseFloat(data.workload_watts),
        hr_minute4: parseFloat(data.hr_minute4) || null,
        hr_minute5: parseFloat(data.hr_minute5),
        hr_minute6: parseFloat(data.hr_minute6),
        steady_state_hr: parseFloat(calc.steadyStateHR),
        predicted_hrmax: calc.predictedHRmax,
        age_correction_factor: calc.ageFactor,
        vo2_submax: parseFloat(calc.vo2Submax),
        vo2_uncorrected: parseFloat(calc.vo2Uncorrected),
        estimated_vo2max: parseFloat(calc.vo2Final),
        category: calc.category,
        warnings: calc.warnings,
        observations: data.observations,
      },
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  const set = (field) => (e) => setData(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl bg-white max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-xl font-bold">Ã…strand-Rhyming Cycle Ergometer Test</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Submaximal VO2max estimation</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>

        <CardContent className="space-y-5">

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">ðŸ“‹ Administration Instructions</p>
            <p><strong>Setup:</strong> Calibrated cycle ergometer. Cadence: <strong>50 rpm</strong>. Workload: 50â€“100 W (women), 100â€“150 W (men) â€” adjust to target HR 125â€“170 bpm by minute 2â€“3.</p>
            <p><strong>Protocol:</strong> 2 min warm-up â†’ steady workload. Record HR at end of minutes 4, 5, and 6. Steady state = |HR5 âˆ’ HR6| â‰¤ 5 bpm.</p>
            <p className="italic">"Pedal steadily at this pace. Tell me immediately if you feel chest pain, dizziness, or any unusual symptoms."</p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm">
            <p className="font-semibold text-slate-700 mb-2">ðŸ“Š VO2max Norms (ml/kg/min) â€” ACSM</p>
            <table className="w-full text-xs border border-slate-300 rounded">
              <thead className="bg-slate-200">
                <tr>
                  <th className="p-2 text-left">Category</th>
                  <th className="p-2 text-center">Men 20â€“39</th>
                  <th className="p-2 text-center">Men 40â€“59</th>
                  <th className="p-2 text-center">Women 20â€“39</th>
                  <th className="p-2 text-center">Women 40â€“59</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t"><td className="p-2">Excellent</td><td className="p-2 text-center">â‰¥52</td><td className="p-2 text-center">â‰¥45</td><td className="p-2 text-center">â‰¥41</td><td className="p-2 text-center">â‰¥35</td></tr>
                <tr className="border-t bg-white"><td className="p-2">Good</td><td className="p-2 text-center">43â€“51</td><td className="p-2 text-center">38â€“44</td><td className="p-2 text-center">35â€“40</td><td className="p-2 text-center">29â€“34</td></tr>
                <tr className="border-t"><td className="p-2">Fair</td><td className="p-2 text-center">34â€“42</td><td className="p-2 text-center">30â€“37</td><td className="p-2 text-center">27â€“34</td><td className="p-2 text-center">23â€“28</td></tr>
                <tr className="border-t bg-white"><td className="p-2">Poor</td><td className="p-2 text-center">â‰¤33</td><td className="p-2 text-center">â‰¤29</td><td className="p-2 text-center">â‰¤26</td><td className="p-2 text-center">â‰¤22</td></tr>
              </tbody>
            </table>
          </div>

          {/* Inputs */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Sex <span className="text-red-500">*</span></Label>
              <Select value={data.sex} onValueChange={(v) => setData(p => ({ ...p, sex: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select sex" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Age (years) <span className="text-red-500">*</span></Label>
              <Input type="number" value={data.age} onChange={set('age')} className="mt-1" placeholder="e.g. 45" />
            </div>
            <div>
              <Label>Body Mass (kg) <span className="text-red-500">*</span></Label>
              <Input type="number" value={data.body_mass_kg} onChange={set('body_mass_kg')} className="mt-1" placeholder="e.g. 75" />
            </div>
            <div>
              <Label>Workload (Watts) <span className="text-red-500">*</span></Label>
              <Input type="number" value={data.workload_watts} onChange={set('workload_watts')} className="mt-1" placeholder="e.g. 100" />
            </div>
          </div>

          {/* Heart rates */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-3">Steady-State Heart Rates (bpm)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Minute 4 <span className="text-slate-400 text-xs">(optional)</span></Label>
                <Input type="number" value={data.hr_minute4} onChange={set('hr_minute4')} className="mt-1" placeholder="HR" />
              </div>
              <div>
                <Label>Minute 5 <span className="text-red-500">*</span></Label>
                <Input type="number" value={data.hr_minute5} onChange={set('hr_minute5')} className="mt-1" placeholder="HR" />
              </div>
              <div>
                <Label>Minute 6 <span className="text-red-500">*</span></Label>
                <Input type="number" value={data.hr_minute6} onChange={set('hr_minute6')} className="mt-1" placeholder="HR" />
              </div>
            </div>
            {data.hr_minute5 && data.hr_minute6 && (
              <p className="text-sm text-green-700 mt-2">
                Steady-state HR: <strong>{((parseFloat(data.hr_minute5) + parseFloat(data.hr_minute6)) / 2).toFixed(1)} bpm</strong>
                {' Â· '}Diff: <strong>{Math.abs(parseFloat(data.hr_minute6) - parseFloat(data.hr_minute5))} bpm</strong>
                {Math.abs(parseFloat(data.hr_minute6) - parseFloat(data.hr_minute5)) <= 5
                  ? <span className="text-green-600"> âœ“ Steady state achieved</span>
                  : <span className="text-red-600"> âœ— Not in steady state</span>}
              </p>
            )}
          </div>

          {/* Errors */}
          {calc.errors.length > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-4 space-y-1">
              {calc.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-red-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{e}</span>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {calc.valid && calc.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-1">
              {calc.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Result */}
          {calc.valid && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-lg p-5 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-slate-900">Estimated VO2max</h4>
              </div>
              <p className="text-4xl font-bold text-blue-600">{calc.vo2Final} <span className="text-lg font-normal">ml/kg/min</span></p>
              <p className="text-sm text-slate-600">
                Category: <strong>{calc.category}</strong>
                {' Â· '}Steady-state HR: <strong>{calc.steadyStateHR} bpm</strong>
                {' Â· '}Age-correction: <strong>Ã—{calc.ageFactor}</strong>
              </p>
              <div className="text-xs text-slate-500 pt-1 border-t border-blue-200">
                VO2submax = {calc.vo2Submax} ml/kg/min â†’ Uncorrected VO2max = {calc.vo2Uncorrected} ml/kg/min â†’ Corrected = {calc.vo2Final} ml/kg/min
              </div>
            </div>
          )}

          {/* Observations */}
          <div>
            <Label>Observations</Label>
            <Textarea
              value={data.observations}
              onChange={set('observations')}
              className="mt-1"
              rows={2}
              placeholder="RPE, symptoms, cycling form, HR response..."
            />
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
            <p className="font-semibold">ðŸ“– Reference</p>
            <p>Ã…strand PO & Rhyming I. (1954). A nomogram for calculation of aerobic capacity from pulse rate during submaximal work. <em>J Appl Physiol, 7</em>(2), 218â€“221.</p>
            <p>ACSM Guidelines for Exercise Testing and Prescription (11th ed., 2022).</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!calc.valid}>
              <Save className="w-4 h-4 mr-2" />Save Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}