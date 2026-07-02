import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Plus, Trash2, Info } from "lucide-react";
import { toast } from "sonner";

const JOINTS = [
  { joint: "Shoulder", movements: ["Flexion", "Extension", "Abduction", "Adduction", "Internal Rotation", "External Rotation"] },
  { joint: "Elbow", movements: ["Flexion", "Extension"] },
  { joint: "Wrist", movements: ["Flexion", "Extension", "Radial Deviation", "Ulnar Deviation"] },
  { joint: "Hip", movements: ["Flexion", "Extension", "Abduction", "Adduction", "Internal Rotation", "External Rotation"] },
  { joint: "Knee", movements: ["Flexion", "Extension"] },
  { joint: "Ankle", movements: ["Dorsiflexion", "Plantarflexion", "Inversion", "Eversion"] },
  { joint: "Trunk", movements: ["Flexion", "Extension", "Lateral Flexion Right", "Lateral Flexion Left", "Rotation Right", "Rotation Left"] }
];

export default function IsometricStrengthRunner({ onSave, onClose }) {
  const [tests, setTests] = useState([]);
  const [currentTest, setCurrentTest] = useState({
    joint: '',
    movement: '',
    side: 'bilateral',
    angle_degrees: '',
    left_force_kg: '',
    right_force_kg: '',
    bilateral_force_kg: ''
  });
  const [notes, setNotes] = useState('');
  const [selectedJointMovements, setSelectedJointMovements] = useState([]);

  const handleJointChange = (joint) => {
    const jointData = JOINTS.find(j => j.joint === joint);
    setSelectedJointMovements(jointData ? jointData.movements : []);
    setCurrentTest({...currentTest, joint, movement: ''});
  };

  const removeExercise = (index) => {
    setTests(tests.filter((_, i) => i !== index));
    toast.success("Test removed");
  };

  const addTest = () => {
    if (!currentTest.joint || !currentTest.movement) {
      toast.error("Please select joint and movement");
      return;
    }

    if (currentTest.side === 'bilateral' && !currentTest.bilateral_force_kg) {
      toast.error("Please enter force measurement");
      return;
    }

    if (currentTest.side === 'unilateral' && (!currentTest.left_force_kg || !currentTest.right_force_kg)) {
      toast.error("Please enter force for both sides");
      return;
    }

    setTests([...tests, {
      ...currentTest,
      left_force_kg: currentTest.left_force_kg ? parseFloat(currentTest.left_force_kg) : null,
      right_force_kg: currentTest.right_force_kg ? parseFloat(currentTest.right_force_kg) : null,
      bilateral_force_kg: currentTest.bilateral_force_kg ? parseFloat(currentTest.bilateral_force_kg) : null,
      angle_degrees: currentTest.angle_degrees ? parseFloat(currentTest.angle_degrees) : null
    }]);

    setCurrentTest({
      joint: '',
      movement: '',
      side: 'bilateral',
      angle_degrees: '',
      left_force_kg: '',
      right_force_kg: '',
      bilateral_force_kg: ''
    });
    setSelectedJointMovements([]);
    toast.success("Test added");
  };

  const handleSave = () => {
    const avgForce = tests.reduce((sum, test) => {
      return sum + (test.bilateral_force_kg || Math.max(test.left_force_kg || 0, test.right_force_kg || 0));
    }, 0) / tests.length;

    const testLines = tests.map(t => {
      if (t.side === 'bilateral') {
        return `  ${t.joint} ${t.movement}: ${t.bilateral_force_kg} kg${t.angle_degrees ? ` @ ${t.angle_degrees}Â°` : ''}`;
      } else {
        return `  ${t.joint} ${t.movement}: L ${t.left_force_kg} kg / R ${t.right_force_kg} kg${t.angle_degrees ? ` @ ${t.angle_degrees}Â°` : ''}`;
      }
    }).join('\n');

    const soapText = `â€¢ Isometric Strength Testing:\n${testLines}\n  Average Force: ${avgForce.toFixed(1)} kg${notes ? `\n  Notes: ${notes}` : ''}`;

    onSave({
      result_value: parseFloat(avgForce.toFixed(1)),
      additional_data: {
        soap_text: soapText,
        tests,
        total_tests: tests.length,
        average_force_kg: parseFloat(avgForce.toFixed(1)),
      },
      notes,
      assessment_date: new Date().toISOString().split('T')[0],
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Isometric Strength Testing</h2>
              <p className="text-slate-600 mt-1">Multi-joint strength assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Test Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>Position:</strong> Standardize joint angle (typically mid-range), stabilize proximal segments</p>
                <p><strong>Instruction:</strong> "Gradually build up to maximum force and hold for 3-5 seconds"</p>
                <p><strong>Equipment:</strong> Hand-held dynamometer or isokinetic device</p>
                <p><strong>Trials:</strong> Perform 2-3 trials per movement, record best</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Test</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label>Joint</Label>
                    <Select
                      value={currentTest.joint}
                      onValueChange={handleJointChange}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select joint" />
                      </SelectTrigger>
                      <SelectContent>
                        {JOINTS.map(j => (
                          <SelectItem key={j.joint} value={j.joint}>{j.joint}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Movement</Label>
                    <Select
                      value={currentTest.movement}
                      onValueChange={(value) => setCurrentTest({...currentTest, movement: value})}
                      disabled={!currentTest.joint}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select movement" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedJointMovements.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Test Angle (Â°)</Label>
                    <Input
                      type="number"
                      value={currentTest.angle_degrees}
                      onChange={(e) => setCurrentTest({...currentTest, angle_degrees: e.target.value})}
                      placeholder="e.g., 90"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label>Testing Side</Label>
                  <div className="flex gap-3 mt-2">
                    <Button
                      type="button"
                      variant={currentTest.side === 'bilateral' ? 'default' : 'outline'}
                      onClick={() => setCurrentTest({...currentTest, side: 'bilateral'})}
                    >
                      Bilateral
                    </Button>
                    <Button
                      type="button"
                      variant={currentTest.side === 'unilateral' ? 'default' : 'outline'}
                      onClick={() => setCurrentTest({...currentTest, side: 'unilateral'})}
                    >
                      Unilateral
                    </Button>
                  </div>
                </div>

                {currentTest.side === 'bilateral' ? (
                  <div>
                    <Label>Peak Force (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={currentTest.bilateral_force_kg}
                      onChange={(e) => setCurrentTest({...currentTest, bilateral_force_kg: e.target.value})}
                      placeholder="Best of 3 trials"
                      className="mt-1 text-xl font-bold"
                    />
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Left Peak Force (kg)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={currentTest.left_force_kg}
                        onChange={(e) => setCurrentTest({...currentTest, left_force_kg: e.target.value})}
                        placeholder="Best of 3 trials"
                        className="mt-1 text-xl font-bold"
                      />
                    </div>
                    <div>
                      <Label>Right Peak Force (kg)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={currentTest.right_force_kg}
                        onChange={(e) => setCurrentTest({...currentTest, right_force_kg: e.target.value})}
                        placeholder="Best of 3 trials"
                        className="mt-1 text-xl font-bold"
                      />
                    </div>
                  </div>
                )}

                <Button onClick={addTest} className="w-full bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add This Test
                </Button>
              </CardContent>
            </Card>

            {tests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recorded Tests ({tests.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tests.map((test, index) => (
                    <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold">{test.joint} - {test.movement}</p>
                        <div className="flex gap-4 mt-1">
                          {test.side === 'bilateral' ? (
                            <span className="text-lg font-bold text-blue-600">{test.bilateral_force_kg} kg</span>
                          ) : (
                            <>
                              <span className="text-sm">L: <span className="font-bold text-blue-600">{test.left_force_kg}kg</span></span>
                              <span className="text-sm">R: <span className="font-bold text-green-600">{test.right_force_kg}kg</span></span>
                            </>
                          )}
                        </div>
                        {test.angle_degrees && (
                          <p className="text-xs text-slate-500">Tested at {test.angle_degrees}Â°</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeExercise(index)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Pain during testing, asymmetries, compensations..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave}
            disabled={false}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Isometric Results
          </Button>
        </div>
      </div>
    </div>
  );
}