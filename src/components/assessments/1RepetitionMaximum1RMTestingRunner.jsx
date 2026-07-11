import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Save, X, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const SUGGESTED_EXERCISES = [
  "Leg Press (Machine)",
  "Chest Press (Machine)",
  "Lat Pulldown (Machine)",
  "Seated Row (Machine)",
  "Knee Extension (Machine)",
  "Hip Abduction (Machine)",
  "Barbell Bench Press",
  "Back Squat",
  "Dumbbell Shoulder Press"
];

const NORMATIVE_DATA = {
  male: [
    { label: "Untrained", min: 0.0, max: 0.99, color: "bg-red-100 text-red-800" },
    { label: "Novice", min: 1.0, max: 1.29, color: "bg-yellow-100 text-yellow-800" },
    { label: "Intermediate", min: 1.3, max: 1.59, color: "bg-blue-100 text-blue-800" },
    { label: "Advanced", min: 1.6, max: 10.0, color: "bg-green-100 text-green-800" }
  ],
  female: [
    { label: "Untrained", min: 0.0, max: 0.69, color: "bg-red-100 text-red-800" },
    { label: "Novice", min: 0.7, max: 0.89, color: "bg-yellow-100 text-yellow-800" },
    { label: "Intermediate", min: 0.9, max: 1.09, color: "bg-blue-100 text-blue-800" },
    { label: "Advanced", min: 1.1, max: 10.0, color: "bg-green-100 text-green-800" }
  ]
};

export default function OneRepetitionMaximum1RMTestingRunner({ client, onSave, onClose }) {
  const [exerciseTested, setExerciseTested] = useState("");
  const [customExercise, setCustomExercise] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [units, setUnits] = useState("kg");
  const [bodyMass, setBodyMass] = useState("");
  const [bodyMassUnits, setBodyMassUnits] = useState("kg");
  const [assistiveConsiderations, setAssistiveConsiderations] = useState("");
  
  const [attempts, setAttempts] = useState([]);
  const [currentAttempt, setCurrentAttempt] = useState({
    load: "",
    success: false,
    techniqueOk: false,
    notes: ""
  });

  const [oneRmLoad, setOneRmLoad] = useState("");
  const [romStandard, setRomStandard] = useState("");
  const [machineSettings, setMachineSettings] = useState("");
  const [spotterUsed, setSpotterUsed] = useState(false);
  const [rpePost, setRpePost] = useState("");
  const [painPost, setPainPost] = useState("");
  const [clinicianNotes, setClinicianNotes] = useState("");

  const getFinalExercise = () => exerciseTested === "custom" ? customExercise : exerciseTested;

  const addAttempt = () => {
    if (!currentAttempt.load) {
      toast.error("Please enter a load for the attempt");
      return;
    }

    const newAttempt = {
      attemptNumber: attempts.length + 1,
      load: parseFloat(currentAttempt.load),
      success: currentAttempt.success,
      techniqueOk: currentAttempt.techniqueOk,
      notes: currentAttempt.notes
    };

    setAttempts([...attempts, newAttempt]);
    
    // Auto-update 1RM to the highest successful attempt
    if (newAttempt.success) {
      const successfulAttempts = [...attempts.filter(a => a.success), newAttempt];
      const maxLoad = Math.max(...successfulAttempts.map(a => a.load));
      setOneRmLoad(maxLoad.toString());
    }

    // Reset current attempt
    setCurrentAttempt({
      load: (parseFloat(currentAttempt.load) + (units === "kg" ? 2.5 : 5)).toString(),
      success: false,
      techniqueOk: false,
      notes: ""
    });

    toast.success("Attempt logged");
  };

  const removeAttempt = (index) => {
    const newAttempts = attempts.filter((_, i) => i !== index);
    setAttempts(newAttempts);
    
    // Recalculate 1RM
    const successfulAttempts = newAttempts.filter(a => a.success);
    if (successfulAttempts.length > 0) {
      const maxLoad = Math.max(...successfulAttempts.map(a => a.load));
      setOneRmLoad(maxLoad.toString());
    } else {
      setOneRmLoad("");
    }
  };

  const convertToKg = (value, fromUnit) => {
    if (!value) return null;
    const num = parseFloat(value);
    return fromUnit === "lb" ? num * 0.453592 : num;
  };

  const calculateRelativeStrength = () => {
    const loadKg = convertToKg(oneRmLoad, units);
    const massKg = convertToKg(bodyMass, bodyMassUnits);
    if (!loadKg || !massKg) return null;
    return loadKg / massKg;
  };

  const getNormativeLabel = () => {
    const relativeStrength = calculateRelativeStrength();
    if (!relativeStrength || !client?.gender) {
      return "Normative comparison unavailable (missing body mass and/or gender)";
    }

    const gender = client.gender.toLowerCase();
    const norms = NORMATIVE_DATA[gender];
    if (!norms) return "Normative comparison unavailable (gender not specified)";

    const band = norms.find(b => relativeStrength >= b.min && relativeStrength < b.max);
    return band ? band.label : "Outside normative range";
  };

  const getNormativeBadgeColor = () => {
    const relativeStrength = calculateRelativeStrength();
    if (!relativeStrength || !client?.gender) return "bg-slate-100 text-slate-800";

    const gender = client.gender.toLowerCase();
    const norms = NORMATIVE_DATA[gender];
    if (!norms) return "bg-slate-100 text-slate-800";

    const band = norms.find(b => relativeStrength >= b.min && relativeStrength < b.max);
    return band ? band.color : "bg-slate-100 text-slate-800";
  };

  const getInterpretation = () => {
    const exercise = getFinalExercise();
    const relativeStrength = calculateRelativeStrength();
    const normativeLabel = getNormativeLabel();

    if (relativeStrength) {
      return `1RM recorded for ${exercise}: ${oneRmLoad} ${units}. Relative strength: ${relativeStrength.toFixed(2)} x body mass. Classification: ${normativeLabel}.`;
    } else {
      return `1RM recorded for ${exercise}: ${oneRmLoad} ${units}. ${normativeLabel}. Use this value to prescribe training loads and track within-client change over time.`;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const exercise = getFinalExercise();
    if (!exercise) {
      toast.error("Please select or enter an exercise");
      return;
    }
    if (!equipmentType) {
      toast.error("Please select equipment type");
      return;
    }
    if (!oneRmLoad) {
      toast.error("Please record the 1RM load");
      return;
    }

    const relativeStrength = calculateRelativeStrength();
    const normativeLabel = getNormativeLabel();
    const interpretation = getInterpretation();

    const additionalData = {
      measurement_type: '1rm_testing',
      exercise_tested: exercise,
      equipment_type: equipmentType,
      units: units,
      body_mass: bodyMass ? parseFloat(bodyMass) : null,
      body_mass_units: bodyMassUnits,
      assistive_considerations: assistiveConsiderations,
      attempts: attempts,
      one_rm_load: parseFloat(oneRmLoad),
      relative_strength: relativeStrength,
      normative_label: normativeLabel,
      rom_standard_used: romStandard,
      machine_settings: machineSettings,
      spotter_used: spotterUsed,
      rpe_post: rpePost ? parseFloat(rpePost) : null,
      pain_post: painPost ? parseFloat(painPost) : null,
      clinician_notes: clinicianNotes,
      interpretation_summary: interpretation,
      soap_text: `• 1RM Testing — ${exercise} (${equipmentType})\n  1RM: ${oneRmLoad} ${units}${relativeStrength ? ` | Relative strength: ${relativeStrength.toFixed(2)} × BM | Classification: ${normativeLabel}` : ` | ${normativeLabel}`}${romStandard ? `\n  ROM Standard: ${romStandard}` : ''}${machineSettings ? `\n  Machine Settings: ${machineSettings}` : ''}${spotterUsed ? '\n  Spotter used' : ''}${rpePost ? ` | RPE: ${rpePost}/10` : ''}${painPost ? ` | Pain: ${painPost}/10` : ''}${assistiveConsiderations ? `\n  Considerations: ${assistiveConsiderations}` : ''}${clinicianNotes ? `\n  Notes: ${clinicianNotes}` : ''}\n  Training Load Guide: 60–70% = ${(parseFloat(oneRmLoad)*0.65).toFixed(1)} ${units} | 70–85% = ${(parseFloat(oneRmLoad)*0.775).toFixed(1)} ${units} | 85–95% = ${(parseFloat(oneRmLoad)*0.9).toFixed(1)} ${units}`,
      soap_objective: `1RM Testing - ${exercise}: ${oneRmLoad} ${units}. ${relativeStrength ? `Relative strength: ${relativeStrength.toFixed(2)} x body mass.` : ''} ${normativeLabel}.`,
      soap_assessment: interpretation,
      soap_plan: `Use ~60–80% of 1RM (${(parseFloat(oneRmLoad) * 0.6).toFixed(1)}-${(parseFloat(oneRmLoad) * 0.8).toFixed(1)} ${units}) for general strength development with appropriate technique and progression; re-test in 4–8 weeks or as clinically indicated.`
    };

    onSave({
      status: 'completed',
      result_value: parseFloat(oneRmLoad),
      additional_data: additionalData,
      notes: clinicianNotes,
      assessment_date: todayLocal()
    });

    toast.success("1RM test saved successfully!");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-5xl bg-white my-8">
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-slate-900">
                1-Repetition Maximum (1RM) Testing
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                {client?.full_name} • Gold-standard measure of maximal dynamic strength
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Safety Warning */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-900">
                  <p className="font-semibold mb-1">Safety Considerations:</p>
                  <ul className="list-disc ml-4 space-y-1">
                    <li>Mandatory spotter for free-weight bench press and squat variants</li>
                    <li>Stop immediately if chest pain, dizziness, or concerning symptoms occur</li>
                    <li>End test when technique breaks down</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Test Setup */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-slate-900 border-b pb-2">Test Setup</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Exercise Tested *</Label>
                  <Select value={exerciseTested} onValueChange={setExerciseTested}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select exercise..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SUGGESTED_EXERCISES.map(ex => (
                        <SelectItem key={ex} value={ex}>{ex}</SelectItem>
                      ))}
                      <SelectItem value="custom">Other (specify)</SelectItem>
                    </SelectContent>
                  </Select>
                  {exerciseTested === "custom" && (
                    <Input
                      className="mt-2"
                      placeholder="Enter custom exercise..."
                      value={customExercise}
                      onChange={(e) => setCustomExercise(e.target.value)}
                    />
                  )}
                </div>

                <div>
                  <Label>Equipment Type *</Label>
                  <Select value={equipmentType} onValueChange={setEquipmentType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select equipment..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Machine">Machine</SelectItem>
                      <SelectItem value="Barbell">Barbell</SelectItem>
                      <SelectItem value="Dumbbell">Dumbbell</SelectItem>
                      <SelectItem value="Cable">Cable</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Load Units *</Label>
                  <Select value={units} onValueChange={setUnits}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kilograms (kg)</SelectItem>
                      <SelectItem value="lb">Pounds (lb)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Body Mass (optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Enter body mass..."
                      value={bodyMass}
                      onChange={(e) => setBodyMass(e.target.value)}
                    />
                    <Select value={bodyMassUnits} onValueChange={setBodyMassUnits}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="lb">lb</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div>
                <Label>Restrictions / Notes (ROM, pain, precautions)</Label>
                <Textarea
                  placeholder="E.g., limited to 90° shoulder abduction, mild knee discomfort noted..."
                  value={assistiveConsiderations}
                  onChange={(e) => setAssistiveConsiderations(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            {/* Attempt Log */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-slate-900 border-b pb-2">Attempt Log</h3>
              
              {attempts.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">#</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Load ({units})</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Success</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Technique OK</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Notes</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {attempts.map((attempt, idx) => (
                        <tr key={idx} className={attempt.success ? "bg-green-50" : "bg-slate-50"}>
                          <td className="px-3 py-2 text-sm">{attempt.attemptNumber}</td>
                          <td className="px-3 py-2 text-sm font-medium">{attempt.load}</td>
                          <td className="px-3 py-2">
                            {attempt.success ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <X className="w-4 h-4 text-red-600" />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {attempt.techniqueOk ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <X className="w-4 h-4 text-slate-400" />
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-600">{attempt.notes || "-"}</td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAttempt(idx)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add Attempt Form */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <Label>Load ({units})</Label>
                      <Input
                        type="number"
                        step="0.5"
                        placeholder="Enter load..."
                        value={currentAttempt.load}
                        onChange={(e) => setCurrentAttempt({...currentAttempt, load: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Input
                        placeholder="Optional notes..."
                        value={currentAttempt.notes}
                        onChange={(e) => setCurrentAttempt({...currentAttempt, notes: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="success"
                        checked={currentAttempt.success}
                        onCheckedChange={(checked) => setCurrentAttempt({...currentAttempt, success: checked})}
                      />
                      <Label htmlFor="success" className="cursor-pointer">Successful rep</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="technique"
                        checked={currentAttempt.techniqueOk}
                        onCheckedChange={(checked) => setCurrentAttempt({...currentAttempt, techniqueOk: checked})}
                      />
                      <Label htmlFor="technique" className="cursor-pointer">Technique OK</Label>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={addAttempt}
                    className="mt-3 bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Log Attempt
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Final Results */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-slate-900 border-b pb-2">Final Results</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Final 1RM Load ({units}) *</Label>
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="Highest successful load..."
                    value={oneRmLoad}
                    onChange={(e) => setOneRmLoad(e.target.value)}
                  />
                </div>

                <div>
                  <Label>ROM/Technique Standard Used</Label>
                  <Input
                    placeholder="E.g., Full ROM, 90° knee flexion..."
                    value={romStandard}
                    onChange={(e) => setRomStandard(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Machine Settings (if applicable)</Label>
                  <Input
                    placeholder="E.g., Seat position 3, lever at 4..."
                    value={machineSettings}
                    onChange={(e) => setMachineSettings(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <Checkbox
                    id="spotter"
                    checked={spotterUsed}
                    onCheckedChange={setSpotterUsed}
                  />
                  <Label htmlFor="spotter" className="cursor-pointer">Spotter Used</Label>
                </div>

                <div>
                  <Label>RPE Post-Test (0-10)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    placeholder="Rate of perceived exertion..."
                    value={rpePost}
                    onChange={(e) => setRpePost(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Pain Post-Test (0-10)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    placeholder="Pain rating..."
                    value={painPost}
                    onChange={(e) => setPainPost(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Clinician Notes</Label>
                <Textarea
                  placeholder="Additional observations, technique notes, client feedback..."
                  value={clinicianNotes}
                  onChange={(e) => setClinicianNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {/* Interpretation Preview */}
            {oneRmLoad && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 mb-3">Interpretation Preview</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">1RM:</span>
                    <span className="font-bold text-lg">{oneRmLoad} {units}</span>
                  </div>
                  {calculateRelativeStrength() && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">Relative Strength:</span>
                        <span className="font-semibold">{calculateRelativeStrength().toFixed(2)} x body mass</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">Classification:</span>
                        <Badge className={getNormativeBadgeColor()}>
                          {getNormativeLabel()}
                        </Badge>
                      </div>
                    </>
                  )}
                  <p className="text-sm text-slate-700 pt-2 border-t">
                    {getInterpretation()}
                  </p>
                </div>
              </div>
            )}

            {/* Clinician Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
              <p className="font-semibold">📋 Administration Instructions</p>
              <p><strong>Warm-up:</strong> 2–3 sets at 50–70% estimated 1RM (8–10 reps, then 3–5 reps), with 3–5 min rest between warm-up and first test attempt.</p>
              <p><strong>Protocol:</strong> Start at 50–70% of estimated 1RM. Increase load by 5–10% (upper body) or 10–20% (lower body) per attempt. Allow 3–5 minutes rest between attempts. Achieve 1RM within 3–5 attempts.</p>
              <p className="italic">"I want you to lift this weight once through the full range of motion with good technique. Only attempt this if you feel you can complete it safely."</p>
            </div>

            {/* Norms & Interpretation */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Relative Strength Norms — Bench Press (1RM ÷ body mass)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Category</th><th className="p-2 text-center">Men</th><th className="p-2 text-center">Women</th></tr></thead>
                  <tbody>
                    <tr className="border-t border-slate-200"><td className="p-2">Untrained</td><td className="p-2 text-center">&lt;1.0×</td><td className="p-2 text-center">&lt;0.7×</td></tr>
                    <tr className="border-t border-slate-200 bg-white"><td className="p-2">Novice</td><td className="p-2 text-center">1.0–1.3×</td><td className="p-2 text-center">0.7–0.9×</td></tr>
                    <tr className="border-t border-slate-200"><td className="p-2">Intermediate</td><td className="p-2 text-center">1.3–1.6×</td><td className="p-2 text-center">0.9–1.1×</td></tr>
                    <tr className="border-t border-slate-200 bg-white"><td className="p-2">Advanced</td><td className="p-2 text-center">≥1.6×</td><td className="p-2 text-center">≥1.1×</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">Training loads: 60–70% 1RM = muscular endurance; 70–85% = hypertrophy; 85–95% = maximal strength. Source: Baechle & Earle (2008).</p>
            </div>

            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>Baechle TR & Earle RW (Eds.). (2008). <em>Essentials of Strength Training and Conditioning</em> (3rd ed.). Human Kinetics.</p>
              <p>American College of Sports Medicine. (2022). <em>ACSM's Guidelines for Exercise Testing and Prescription</em> (11th ed.). Wolters Kluwer.</p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" />
                Save 1RM Test
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}