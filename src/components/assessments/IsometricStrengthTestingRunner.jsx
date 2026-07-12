import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const MUSCLE_GROUPS = [
  { label: "Grip Strength - Right", value: "grip_right", side: "right" },
  { label: "Grip Strength - Left", value: "grip_left", side: "left" },
  { label: "Elbow Flexion - Right", value: "elbow_flexion_right", side: "right" },
  { label: "Elbow Flexion - Left", value: "elbow_flexion_left", side: "left" },
  { label: "Elbow Extension - Right", value: "elbow_extension_right", side: "right" },
  { label: "Elbow Extension - Left", value: "elbow_extension_left", side: "left" },
  { label: "Shoulder Abduction - Right", value: "shoulder_abduction_right", side: "right" },
  { label: "Shoulder Abduction - Left", value: "shoulder_abduction_left", side: "left" },
  { label: "Shoulder Flexion - Right", value: "shoulder_flexion_right", side: "right" },
  { label: "Shoulder Flexion - Left", value: "shoulder_flexion_left", side: "left" },
  { label: "Hip Abduction - Right", value: "hip_abduction_right", side: "right" },
  { label: "Hip Abduction - Left", value: "hip_abduction_left", side: "left" },
  { label: "Hip Flexion - Right", value: "hip_flexion_right", side: "right" },
  { label: "Hip Flexion - Left", value: "hip_flexion_left", side: "left" },
  { label: "Knee Extension - Right", value: "knee_extension_right", side: "right" },
  { label: "Knee Extension - Left", value: "knee_extension_left", side: "left" },
  { label: "Ankle Dorsiflexion - Right", value: "ankle_dorsiflexion_right", side: "right" },
  { label: "Ankle Dorsiflexion - Left", value: "ankle_dorsiflexion_left", side: "left" },
];

export default function IsometricStrengthTestingRunner({ client, onSave, onClose }) {
  const [tests, setTests] = useState([]);
  const [selectedMuscle, setSelectedMuscle] = useState("");
  const [trial1, setTrial1] = useState("");
  const [trial2, setTrial2] = useState("");
  const [trial3, setTrial3] = useState("");
  const [angle, setAngle] = useState("");
  const [notes, setNotes] = useState("");

  const addTest = () => {
    if (!selectedMuscle || !trial1) {
      toast.error("Please select a muscle group and enter at least trial 1.");
      return;
    }

    const t1 = parseFloat(trial1);
    const t2 = trial2 ? parseFloat(trial2) : null;
    const t3 = trial3 ? parseFloat(trial3) : null;

    const trials = [t1, t2, t3].filter(t => t !== null);
    const average = trials.reduce((a, b) => a + b, 0) / trials.length;
    const best = Math.max(...trials);

    const muscleLabel = MUSCLE_GROUPS.find(m => m.value === selectedMuscle)?.label;

    setTests([
      ...tests,
      {
        id: Date.now(),
        muscle: selectedMuscle,
        muscleLabel,
        trial1: t1,
        trial2: t2,
        trial3: t3,
        angle: angle || "default",
        average: parseFloat(average.toFixed(2)),
        best: best,
      },
    ]);

    setSelectedMuscle("");
    setTrial1("");
    setTrial2("");
    setTrial3("");
    setAngle("");
    toast.success("Test added successfully.");
  };

  const removeTest = (id) => {
    setTests(tests.filter(t => t.id !== id));
  };

  const handleSave = () => {
    // Calculate bilateral symmetry indices where applicable
    const symmetryAnalysis = {};
    const rightTests = tests.filter(t => MUSCLE_GROUPS.find(m => m.value === t.muscle)?.side === "right");
    const leftTests = tests.filter(t => MUSCLE_GROUPS.find(m => m.value === t.muscle)?.side === "left");

    rightTests.forEach(rTest => {
      const muscleBase = rTest.muscle.replace("_right", "").replace("_left", "");
      const lTest = leftTests.find(t => t.muscle.replace("_left", "").replace("_right", "") === muscleBase);
      if (lTest) {
        const ratio = (lTest.best / rTest.best) * 100;
        symmetryAnalysis[muscleBase] = {
          right: rTest.best,
          left: lTest.best,
          ratio: parseFloat(ratio.toFixed(1)),
          symmetrical: ratio >= 90 && ratio <= 110,
        };
      }
    });

    // Generate SOAP text
    const testSummaries = tests.map(t => 
      `${t.muscleLabel}: Trial 1=${t.trial1}N${t.trial2 ? `, Trial 2=${t.trial2}N` : ""}${t.trial3 ? `, Trial 3=${t.trial3}N` : ""}, Best=${t.best}N, Average=${t.average}N`
    );

    const symmetrySummary = Object.entries(symmetryAnalysis).map(([muscle, data]) =>
      `${muscle}: L/R Symmetry ${data.ratio}% (${data.symmetrical ? "symmetrical" : "asymmetrical"})`
    );

    const soapText = `Isometric Strength Testing:\n${testSummaries.join("\n")}${symmetrySummary.length > 0 ? `\n\nBilateral Symmetry Analysis:\n${symmetrySummary.join("\n")}` : ""}${notes ? `\n\nClinical Notes: ${notes}` : ""}`;

    onSave({
      result_value: tests.length > 0 ? tests[0].best : 0,
      additional_data: {
        soap_text: soapText,
        tests: tests,
        symmetry_analysis: symmetryAnalysis,
      },
      notes,
      assessment_date: todayLocal(),
    });

    toast.success("Isometric strength testing saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Isometric Strength Testing</h2>
              <p className="text-slate-600 text-sm mt-1">Measures peak force production during maximal voluntary isometric contraction</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Instructions */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg">Clinician Guidance</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-700 space-y-2">
              <p><strong>Protocol:</strong> Position joint at specified angle. Client produces maximum force against fixed resistance. Hold 3-5 seconds. Perform 3 trials with 1-min rest between trials.</p>
              <p><strong>Equipment:</strong> Hand dynamometer (grip), fixed dynamometer (other muscles), or load cell with stabilization frame.</p>
              <p><strong>Scoring:</strong> Record best trial and average across trials. Compare bilateral symmetry (&gt;90% indicates good symmetry).</p>
              <p><strong>Termination:</strong> Stop if client reports pain, dizziness, or chest discomfort.</p>
            </CardContent>
          </Card>

          {/* Test Entry */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add Test Entry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Muscle Group / Movement *</Label>
                <select
                  value={selectedMuscle}
                  onChange={(e) => setSelectedMuscle(e.target.value)}
                  className="w-full p-2 border rounded-md mt-1"
                >
                  <option value="">Select muscle group...</option>
                  {MUSCLE_GROUPS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label>Trial 1 (N) *</Label>
                  <Input
                    type="number"
                    value={trial1}
                    onChange={(e) => setTrial1(e.target.value)}
                    placeholder="Force in Newtons"
                    min="0"
                    step="0.1"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Trial 2 (N)</Label>
                  <Input
                    type="number"
                    value={trial2}
                    onChange={(e) => setTrial2(e.target.value)}
                    placeholder="Force in Newtons"
                    min="0"
                    step="0.1"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Trial 3 (N)</Label>
                  <Input
                    type="number"
                    value={trial3}
                    onChange={(e) => setTrial3(e.target.value)}
                    placeholder="Force in Newtons"
                    min="0"
                    step="0.1"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Joint Angle (°)</Label>
                  <Input
                    type="number"
                    value={angle}
                    onChange={(e) => setAngle(e.target.value)}
                    placeholder="e.g., 90"
                    min="0"
                    step="1"
                    className="mt-1"
                  />
                </div>
              </div>

              <Button onClick={addTest} className="w-full bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Test
              </Button>
            </CardContent>
          </Card>

          {/* Recorded Tests */}
          {tests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recorded Tests ({tests.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {tests.map(test => (
                  <div key={test.id} className="p-3 border rounded-lg bg-slate-50 flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">{test.muscleLabel}</p>
                      <p className="text-sm text-slate-600">
                        T1: {test.trial1}N
                        {test.trial2 && ` | T2: ${test.trial2}N`}
                        {test.trial3 && ` | T3: ${test.trial3}N`}
                      </p>
                      <p className="text-sm text-slate-600">Best: <span className="font-semibold">{test.best}N</span> | Average: {test.average}N</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTest(test.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Clinical Notes */}
          <div>
            <Label>Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Pain response, equipment issues, difficulty maintaining position, assistive device use, other observations..."
              rows={3}
              className="mt-1"
            />
          </div>

          {/* References */}
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">References</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 space-y-1">
              <p>• Bohannon, R. W. (2019). Hand-grip dynamometry: Adjusting values for age and sex. J Geriatr Phys Ther, 31(1), 16-20.</p>
              <p>• Mathiowetz, V., et al. (1985). Reliability and validity of grip and pinch strength evaluations. J Hand Surg, 10(2), 222-226.</p>
              <p>• Metter, E. J., et al. (1997). Relationship of age and gender to dominance, strength, and quality of upper extremity function. J Gerontol A Biol Sci Med Sci, 52(4), B207-B217.</p>
            </CardContent>
          </Card>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}