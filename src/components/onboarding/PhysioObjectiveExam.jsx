import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, Plus, Trash2, Activity } from "lucide-react";

// The Oxford (Medical Research Council) 0-5 manual muscle testing scale is
// non-proprietary and may be reproduced in full, unlike the item wording of
// commercial region-specific outcome measures (ODI, NDI, DASH/QuickDASH,
// KOOS, HOOS, STarT Back, Tampa Scale, Pain Catastrophising Scale), none of
// which are reproduced anywhere in this form.
const OXFORD_GRADES = [
  { value: "0", label: "0 - No contraction" },
  { value: "1", label: "1 - Flicker or trace of contraction" },
  { value: "2", label: "2 - Active movement, gravity eliminated" },
  { value: "3", label: "3 - Active movement against gravity" },
  { value: "4", label: "4 - Active movement against gravity and some resistance" },
  { value: "5", label: "5 - Normal power against full resistance" },
];

const SPECIAL_TEST_RESULTS = [
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Negative" },
  { value: "inconclusive", label: "Inconclusive" },
];

const emptyActiveRomRow = () => ({ movement_name: "", range_degrees: "", pain_response: "" });
const emptyMuscleStrengthRow = () => ({ muscle_group: "", grade_left: "", grade_right: "" });
const emptySpecialTestRow = () => ({ test_name: "", result: "" });

// Grouped pass/fail neurological screen items. Myotomes, dermatomes, and
// reflexes are kept as three distinct pass/fail judgements (rather than one
// combined "neuro screen" field) because a failure in any one of the three
// has a different clinical meaning and follow-up pathway from a failure in
// another, and each therefore needs its own recorded detail.
const NEURO_SCREEN_ITEMS = [
  { key: "myotomes", label: "Myotomes" },
  { key: "dermatomes", label: "Dermatomes" },
  { key: "reflexes", label: "Reflexes" },
];

function RepeatableRowCard({ children, onRemove, canRemove }) {
  return (
    <Card className="p-4 bg-slate-50 border-slate-200/80 relative">
      <CardContent className="pt-2 space-y-4">
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 text-slate-500 hover:bg-red-100 hover:text-red-600"
            onClick={onRemove}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
export default function PhysioObjectiveExam({ data, onNext, onBack, onSaveAndFinishLater, canGoBack, isSubmitting }) {
  const [formData, setFormData] = useState({
    physio_obj_observation_posture: data.physio_obj_observation_posture || "",
    physio_obj_passive_rom_findings: data.physio_obj_passive_rom_findings || "",
    physio_obj_neuro_myotomes_result: data.physio_obj_neuro_myotomes_result || "",
    physio_obj_neuro_myotomes_details: data.physio_obj_neuro_myotomes_details || "",
    physio_obj_neuro_dermatomes_result: data.physio_obj_neuro_dermatomes_result || "",
    physio_obj_neuro_dermatomes_details: data.physio_obj_neuro_dermatomes_details || "",
    physio_obj_neuro_reflexes_result: data.physio_obj_neuro_reflexes_result || "",
    physio_obj_neuro_reflexes_details: data.physio_obj_neuro_reflexes_details || "",
    physio_obj_palpation_findings: data.physio_obj_palpation_findings || "",
    physio_obj_functional_tests: data.physio_obj_functional_tests || "",
    physio_obj_diagnosis_clinical_impression: data.physio_obj_diagnosis_clinical_impression || "",
  });

  const [activeRom, setActiveRom] = useState(
    data.physio_obj_active_rom?.length > 0 ? data.physio_obj_active_rom : [emptyActiveRomRow()]
  );
  const [muscleStrength, setMuscleStrength] = useState(
    data.physio_obj_muscle_strength?.length > 0 ? data.physio_obj_muscle_strength : [emptyMuscleStrengthRow()]
  );
  const [specialTests, setSpecialTests] = useState(
    data.physio_obj_special_tests?.length > 0 ? data.physio_obj_special_tests : [emptySpecialTestRow()]
  );

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateRow = (rows, setRows, index, field, value) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  };

  const addRow = (rows, setRows, emptyRow) => setRows([...rows, emptyRow()]);
  const removeRow = (rows, setRows, index) => setRows(rows.filter((_, i) => i !== index));

  const handleSubmit = (e) => {
    e.preventDefault();
    const filledActiveRom = activeRom.filter((row) => row.movement_name?.trim());
    const filledMuscleStrength = muscleStrength.filter((row) => row.muscle_group?.trim());
    const filledSpecialTests = specialTests.filter((row) => row.test_name?.trim());
    onNext({
      ...formData,
      physio_obj_active_rom: filledActiveRom,
      physio_obj_muscle_strength: filledMuscleStrength,
      physio_obj_special_tests: filledSpecialTests,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-800">
            <Activity className="w-5 h-5" />
            Objective Examination
          </CardTitle>
          <p className="text-sm text-indigo-600">Record clinical findings from physical assessment.</p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Observation and posture</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="physio_obj_observation_posture"
            value={formData.physio_obj_observation_posture}
            onChange={(e) => handleChange("physio_obj_observation_posture", e.target.value)}
            placeholder="Static and dynamic posture, deformity, muscle bulk, gait, use of aids..."
            rows={3}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Active range of motion</CardTitle>
          <p className="text-sm text-slate-600">Add a row for each movement tested</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeRom.map((row, index) => (
            <RepeatableRowCard
              key={index}
              canRemove={activeRom.length > 1}
              onRemove={() => removeRow(activeRom, setActiveRom, index)}
            >
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor={`active_rom_movement_${index}`} className="text-sm font-medium text-slate-700">
                    Movement
                  </Label>
                  <Input
                    id={`active_rom_movement_${index}`}
                    value={row.movement_name}
                    onChange={(e) => updateRow(activeRom, setActiveRom, index, "movement_name", e.target.value)}
                    placeholder="e.g., Lumbar flexion"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`active_rom_range_${index}`} className="text-sm font-medium text-slate-700">
                    Range (degrees)
                  </Label>
                  <Input
                    id={`active_rom_range_${index}`}
                    type="number"
                    value={row.range_degrees}
                    onChange={(e) => updateRow(activeRom, setActiveRom, index, "range_degrees", e.target.value)}
                    placeholder="e.g., 45"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`active_rom_pain_${index}`} className="text-sm font-medium text-slate-700">
                    Pain response
                  </Label>
                  <Input
                    id={`active_rom_pain_${index}`}
                    value={row.pain_response}
                    onChange={(e) => updateRow(activeRom, setActiveRom, index, "pain_response", e.target.value)}
                    placeholder="e.g., Pain at end range"
                    className="mt-1"
                  />
                </div>
              </div>
            </RepeatableRowCard>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => addRow(activeRom, setActiveRom, emptyActiveRomRow)}
            className="w-full flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Another Movement
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Passive range of motion</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="physio_obj_passive_rom_findings"
            value={formData.physio_obj_passive_rom_findings}
            onChange={(e) => handleChange("physio_obj_passive_rom_findings", e.target.value)}
            placeholder="Passive range findings, end feel, and any difference from active range..."
            rows={3}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Muscle strength</CardTitle>
          <p className="text-sm text-slate-600">Oxford (MRC) 0-5 grading scale</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {muscleStrength.map((row, index) => (
            <RepeatableRowCard
              key={index}
              canRemove={muscleStrength.length > 1}
              onRemove={() => removeRow(muscleStrength, setMuscleStrength, index)}
            >
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor={`muscle_group_${index}`} className="text-sm font-medium text-slate-700">
                    Muscle group
                  </Label>
                  <Input
                    id={`muscle_group_${index}`}
                    value={row.muscle_group}
                    onChange={(e) => updateRow(muscleStrength, setMuscleStrength, index, "muscle_group", e.target.value)}
                    placeholder="e.g., Hip abductors"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Grade (left)</Label>
                  <Select
                    value={row.grade_left?.toString() || ""}
                    onValueChange={(v) => updateRow(muscleStrength, setMuscleStrength, index, "grade_left", v)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {OXFORD_GRADES.map((grade) => (
                        <SelectItem key={grade.value} value={grade.value}>{grade.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Grade (right)</Label>
                  <Select
                    value={row.grade_right?.toString() || ""}
                    onValueChange={(v) => updateRow(muscleStrength, setMuscleStrength, index, "grade_right", v)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {OXFORD_GRADES.map((grade) => (
                        <SelectItem key={grade.value} value={grade.value}>{grade.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </RepeatableRowCard>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => addRow(muscleStrength, setMuscleStrength, emptyMuscleStrengthRow)}
            className="w-full flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Another Muscle Group
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Neurological screen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {NEURO_SCREEN_ITEMS.map((item) => {
            const resultField = `physio_obj_neuro_${item.key}_result`;
            const detailsField = `physio_obj_neuro_${item.key}_details`;
            return (
              <div key={item.key} className="border-b border-slate-200 pb-4 last:border-b-0 last:pb-0">
                <Label className="text-sm font-medium text-slate-700 block mb-2">{item.label}</Label>
                <RadioGroup
                  value={formData[resultField]}
                  onValueChange={(value) => handleChange(resultField, value)}
                >
                  <div className="flex gap-6">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pass" id={`${resultField}_pass`} />
                      <Label htmlFor={`${resultField}_pass`} className="cursor-pointer font-normal">Pass</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="fail" id={`${resultField}_fail`} />
                      <Label htmlFor={`${resultField}_fail`} className="cursor-pointer font-normal">Fail</Label>
                    </div>
                  </div>
                </RadioGroup>
                <Textarea
                  id={detailsField}
                  value={formData[detailsField]}
                  onChange={(e) => handleChange(detailsField, e.target.value)}
                  placeholder="Details — levels tested, findings..."
                  className="mt-2"
                  rows={2}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Special tests</CardTitle>
          <p className="text-sm text-slate-600">Add a row for each special test performed</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {specialTests.map((row, index) => (
            <RepeatableRowCard
              key={index}
              canRemove={specialTests.length > 1}
              onRemove={() => removeRow(specialTests, setSpecialTests, index)}
            >
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`special_test_name_${index}`} className="text-sm font-medium text-slate-700">
                    Test name
                  </Label>
                  <Input
                    id={`special_test_name_${index}`}
                    value={row.test_name}
                    onChange={(e) => updateRow(specialTests, setSpecialTests, index, "test_name", e.target.value)}
                    placeholder="e.g., Straight leg raise"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Result</Label>
                  <Select
                    value={row.result}
                    onValueChange={(v) => updateRow(specialTests, setSpecialTests, index, "result", v)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select result" />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECIAL_TEST_RESULTS.map((result) => (
                        <SelectItem key={result.value} value={result.value}>{result.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </RepeatableRowCard>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => addRow(specialTests, setSpecialTests, emptySpecialTestRow)}
            className="w-full flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Another Special Test
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Palpation findings</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="physio_obj_palpation_findings"
            value={formData.physio_obj_palpation_findings}
            onChange={(e) => handleChange("physio_obj_palpation_findings", e.target.value)}
            placeholder="Tenderness, muscle tone, swelling, temperature, joint position..."
            rows={3}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Functional tests</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="physio_obj_functional_tests"
            value={formData.physio_obj_functional_tests}
            onChange={(e) => handleChange("physio_obj_functional_tests", e.target.value)}
            placeholder="Sit-to-stand, single leg balance, functional reach, task-specific movement analysis..."
            rows={3}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Physiotherapy diagnosis / clinical impression</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="physio_obj_diagnosis_clinical_impression"
            value={formData.physio_obj_diagnosis_clinical_impression}
            onChange={(e) => handleChange("physio_obj_diagnosis_clinical_impression", e.target.value)}
            placeholder="Working diagnosis and clinical reasoning drawn from the subjective and objective findings above"
            rows={4}
          />
        </CardContent>
      </Card>

      <div className="flex justify-between pt-6">
        <div className="flex gap-2">
          {canGoBack && (
            <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          {onSaveAndFinishLater && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onSaveAndFinishLater({
                  ...formData,
                  physio_obj_active_rom: activeRom.filter((row) => row.movement_name?.trim()),
                  physio_obj_muscle_strength: muscleStrength.filter((row) => row.muscle_group?.trim()),
                  physio_obj_special_tests: specialTests.filter((row) => row.test_name?.trim()),
                })
              }
              className="text-slate-600"
              disabled={isSubmitting}
            >
              Save & Finish Later
            </Button>
          )}
        </div>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </form>
  );
}
