import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

export default function IsokineticsRunner({ onSave, onClose }) {
  const [testData, setTestData] = useState({
    joint: '',
    movement_pattern: '',
    angular_velocity: '60',
    left_peak_torque_nm: '',
    right_peak_torque_nm: '',
    left_total_work_j: '',
    right_total_work_j: '',
    repetitions: '5',
    rom_start: '',
    rom_end: ''
  });
  const [notes, setNotes] = useState('');

  const calculateAsymmetry = () => {
    const left = parseFloat(testData.left_peak_torque_nm) || 0;
    const right = parseFloat(testData.right_peak_torque_nm) || 0;
    if (left === 0 || right === 0) return null;
    const asymmetry = Math.abs(left - right) / Math.max(left, right) * 100;
    return asymmetry.toFixed(1);
  };

  const handleSave = () => {
    if (!testData.joint || !testData.movement_pattern) {
      toast.error("Please select joint and movement pattern");
      return;
    }

    if (!testData.left_peak_torque_nm || !testData.right_peak_torque_nm) {
      toast.error("Please enter peak torque for both limbs");
      return;
    }

    const asymmetry = calculateAsymmetry();
    const avgTorque = (parseFloat(testData.left_peak_torque_nm) + parseFloat(testData.right_peak_torque_nm)) / 2;

    const romStr = testData.rom_start && testData.rom_end ? `${testData.rom_start}°–${testData.rom_end}°` : null;
    const soapText = `• Isokinetic Dynamometry:\n  Joint: ${testData.joint} — ${testData.movement_pattern} @ ${testData.angular_velocity}°/s (${testData.repetitions} reps)\n  Left Peak Torque: ${testData.left_peak_torque_nm} Nm${testData.left_total_work_j ? ` | Total Work: ${testData.left_total_work_j} J` : ''}\n  Right Peak Torque: ${testData.right_peak_torque_nm} Nm${testData.right_total_work_j ? ` | Total Work: ${testData.right_total_work_j} J` : ''}${asymmetry ? `\n  Bilateral Asymmetry: ${asymmetry}%` : ''}${romStr ? `\n  ROM: ${romStr}` : ''}${notes ? `\n  Notes: ${notes}` : ''}`;

    onSave({
      result_value: parseFloat(avgTorque.toFixed(1)),
      additional_data: {
        soap_text: soapText,
        joint: testData.joint,
        movement_pattern: testData.movement_pattern,
        angular_velocity: parseFloat(testData.angular_velocity),
        left_peak_torque_nm: parseFloat(testData.left_peak_torque_nm),
        right_peak_torque_nm: parseFloat(testData.right_peak_torque_nm),
        left_total_work_j: testData.left_total_work_j ? parseFloat(testData.left_total_work_j) : null,
        right_total_work_j: testData.right_total_work_j ? parseFloat(testData.right_total_work_j) : null,
        repetitions: parseInt(testData.repetitions),
        asymmetry_percent: asymmetry ? parseFloat(asymmetry) : null,
        rom_range: romStr,
      },
      notes,
      assessment_date: new Date().toISOString().split('T')[0],
    });
  };

  const asymmetry = calculateAsymmetry();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Isokinetic Dynamometry</h2>
              <p className="text-slate-600 mt-1">Constant velocity strength assessment</p>
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
                <p><strong>Setup:</strong> Secure client per manufacturer guidelines, align dynamometer axis with joint</p>
                <p><strong>Instruction:</strong> "Push and pull as hard and fast as possible through full range"</p>
                <p><strong>Common speeds:</strong> 60°/s (strength), 180°/s (power), 300°/s (endurance)</p>
                <p><strong>Recording:</strong> Device captures peak torque and total work automatically</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Joint</Label>
                    <Select
                      value={testData.joint}
                      onValueChange={(value) => setTestData({...testData, joint: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select joint" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="knee">Knee</SelectItem>
                        <SelectItem value="shoulder">Shoulder</SelectItem>
                        <SelectItem value="hip">Hip</SelectItem>
                        <SelectItem value="ankle">Ankle</SelectItem>
                        <SelectItem value="elbow">Elbow</SelectItem>
                        <SelectItem value="trunk">Trunk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Movement Pattern</Label>
                    <Select
                      value={testData.movement_pattern}
                      onValueChange={(value) => setTestData({...testData, movement_pattern: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select movement" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flexion_extension">Flexion/Extension</SelectItem>
                        <SelectItem value="abduction_adduction">Abduction/Adduction</SelectItem>
                        <SelectItem value="internal_external_rotation">Internal/External Rotation</SelectItem>
                        <SelectItem value="inversion_eversion">Inversion/Eversion</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Angular Velocity (°/s)</Label>
                    <Select
                      value={testData.angular_velocity}
                      onValueChange={(value) => setTestData({...testData, angular_velocity: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="60">60°/s (Strength)</SelectItem>
                        <SelectItem value="90">90°/s</SelectItem>
                        <SelectItem value="120">120°/s</SelectItem>
                        <SelectItem value="180">180°/s (Power)</SelectItem>
                        <SelectItem value="240">240°/s</SelectItem>
                        <SelectItem value="300">300°/s (Endurance)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Repetitions</Label>
                    <Input
                      type="number"
                      value={testData.repetitions}
                      onChange={(e) => setTestData({...testData, repetitions: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>ROM Start Angle (°)</Label>
                    <Input
                      type="number"
                      value={testData.rom_start}
                      onChange={(e) => setTestData({...testData, rom_start: e.target.value})}
                      placeholder="e.g., 0"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>ROM End Angle (°)</Label>
                    <Input
                      type="number"
                      value={testData.rom_end}
                      onChange={(e) => setTestData({...testData, rom_end: e.target.value})}
                      placeholder="e.g., 90"
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                    <h4 className="font-semibold text-blue-900">Left Side</h4>
                    <div>
                      <Label>Peak Torque (Nm)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={testData.left_peak_torque_nm}
                        onChange={(e) => setTestData({...testData, left_peak_torque_nm: e.target.value})}
                        className="mt-1 text-xl font-bold"
                        placeholder="e.g., 150"
                      />
                    </div>
                    <div>
                      <Label>Total Work (J) - Optional</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={testData.left_total_work_j}
                        onChange={(e) => setTestData({...testData, left_total_work_j: e.target.value})}
                        className="mt-1"
                        placeholder="e.g., 450"
                      />
                    </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg space-y-3">
                    <h4 className="font-semibold text-green-900">Right Side</h4>
                    <div>
                      <Label>Peak Torque (Nm)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={testData.right_peak_torque_nm}
                        onChange={(e) => setTestData({...testData, right_peak_torque_nm: e.target.value})}
                        className="mt-1 text-xl font-bold"
                        placeholder="e.g., 145"
                      />
                    </div>
                    <div>
                      <Label>Total Work (J) - Optional</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={testData.right_total_work_j}
                        onChange={(e) => setTestData({...testData, right_total_work_j: e.target.value})}
                        className="mt-1"
                        placeholder="e.g., 430"
                      />
                    </div>
                  </div>
                </div>

                {asymmetry && (
                  <div className={`p-4 rounded-lg border-2 text-center ${
                    parseFloat(asymmetry) > 15 
                      ? 'bg-red-50 border-red-300' 
                      : parseFloat(asymmetry) > 10 
                      ? 'bg-yellow-50 border-yellow-300'
                      : 'bg-green-50 border-green-300'
                  }`}>
                    <p className="text-sm text-slate-600">Bilateral Asymmetry</p>
                    <p className="text-4xl font-bold text-slate-900">{asymmetry}%</p>
                    {parseFloat(asymmetry) > 15 && (
                      <p className="text-sm text-red-600 mt-1">⚠ï¸ Clinically significant asymmetry</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Pain during test, ROM limitations, compensations, agonist/antagonist ratios..."
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
            disabled={!testData.left_peak_torque_nm || !testData.right_peak_torque_nm}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Isokinetic Results
          </Button>
        </div>
      </div>
    </div>
  );
}