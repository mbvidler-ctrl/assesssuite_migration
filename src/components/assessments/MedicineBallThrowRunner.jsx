import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { X, Save, Trash2, Plus, Info } from "lucide-react";
import { toast } from "sonner";

export default function MedicineBallThrowRunner({ client, onSave, onClose }) {
  const [trials, setTrials] = useState([]);
  const [currentDistance, setCurrentDistance] = useState("");
  const [preTestVitals, setPreTestVitals] = useState({ systolic: "", diastolic: "", heartRate: "" });
  const [postTestVitals, setPostTestVitals] = useState({ systolic: "", diastolic: "", heartRate: "" });
  const [notes, setNotes] = useState("");

  const addTrial = () => {
    const distance = parseFloat(currentDistance);
    if (!currentDistance || isNaN(distance) || distance <= 0) {
      toast.error("Please enter a valid distance");
      return;
    }
    setTrials([...trials, distance]);
    setCurrentDistance("");
  };

  const removeTrial = (index) => {
    setTrials(trials.filter((_, i) => i !== index));
  };

  const bestTrial = trials.length > 0 ? Math.max(...trials) : null;
  const avgTrial = trials.length > 0 ? (trials.reduce((a, b) => a + b, 0) / trials.length).toFixed(2) : null;

  const handleSave = () => {
    if (trials.length === 0) {
      toast.error("Please add at least one trial distance");
      return;
    }

    let vitalsSummary = "";
    if (preTestVitals.systolic || preTestVitals.diastolic || preTestVitals.heartRate) {
      vitalsSummary += `\n  Pre-Test Vitals:${preTestVitals.systolic ? ` BP ${preTestVitals.systolic}/${preTestVitals.diastolic}` : ""}${preTestVitals.heartRate ? ` HR ${preTestVitals.heartRate}bpm` : ""}`;
    }
    if (postTestVitals.systolic || postTestVitals.diastolic || postTestVitals.heartRate) {
      vitalsSummary += `\n  Post-Test Vitals:${postTestVitals.systolic ? ` BP ${postTestVitals.systolic}/${postTestVitals.diastolic}` : ""}${postTestVitals.heartRate ? ` HR ${postTestVitals.heartRate}bpm` : ""}`;
    }

    const soapText = `â€¢ Medicine Ball Throw Assessment:\n  Trials: ${trials.map(t => `${t}m`).join(", ")}\n  Best Trial: ${bestTrial}m\n  Average: ${avgTrial}m${vitalsSummary}${notes ? `\n  Notes: ${notes}` : ""}`;

    onSave({
      result_value: bestTrial,
      additional_data: {
        soap_text: soapText,
        trials,
        best_trial: bestTrial,
        average_trial: parseFloat(avgTrial),
        pre_test_vitals: preTestVitals,
        post_test_vitals: postTestVitals,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Medicine Ball Throw</h2>
              <p className="text-slate-600 text-sm mt-1">Upper body power assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Instructions */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  ðŸ“‹ Instructions & Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>Ball weight:</strong> Typically 3 kg (men) or 2 kg (women) seated chest pass. Document ball weight used.</p>
                <p><strong>Position:</strong> Seated against wall, back straight, feet flat on floor. Ball held at chest level with both hands.</p>
                <p className="italic">"Throw the ball as far as you can â€” straight forward, not upward. Push from the chest using both hands. Do not lean forward or leave the seat."</p>
                <p><strong>Measurement:</strong> Measure to where the ball first contacts the floor. Record 3 trials with 60s rest. Use best distance.</p>
                <p><strong>Note:</strong> Client must not push off the wall or use leg drive. Document any deviations.</p>
              </CardContent>
            </Card>

            {/* Norms */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-slate-700">ðŸ“Š Norms â€” Seated Medicine Ball Throw (3 kg, metres)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Category</th><th className="p-2 text-center">Men 20â€“29</th><th className="p-2 text-center">Men 40â€“49</th><th className="p-2 text-center">Women 20â€“29</th><th className="p-2 text-center">Women 40â€“49</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">Excellent</td><td className="p-2 text-center">â‰¥6.5 m</td><td className="p-2 text-center">â‰¥5.5 m</td><td className="p-2 text-center">â‰¥4.5 m</td><td className="p-2 text-center">â‰¥3.8 m</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">Good</td><td className="p-2 text-center">5.5â€“6.4 m</td><td className="p-2 text-center">4.5â€“5.4 m</td><td className="p-2 text-center">3.8â€“4.4 m</td><td className="p-2 text-center">3.0â€“3.7 m</td></tr>
                    <tr className="border-t"><td className="p-2">Average</td><td className="p-2 text-center">4.5â€“5.4 m</td><td className="p-2 text-center">3.5â€“4.4 m</td><td className="p-2 text-center">3.0â€“3.7 m</td><td className="p-2 text-center">2.2â€“2.9 m</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">Poor</td><td className="p-2 text-center">&lt;4.5 m</td><td className="p-2 text-center">&lt;3.5 m</td><td className="p-2 text-center">&lt;3.0 m</td><td className="p-2 text-center">&lt;2.2 m</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">Measures upper body muscular power. Source: Stockbrugger & Haennel (2001).</p>
            </div>

            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">ðŸ“– Reference</p>
              <p>Stockbrugger BA & Haennel RG. (2001). Validity and reliability of a medicine ball explosive power test. <em>Journal of Strength and Conditioning Research, 15</em>(4), 431â€“438.</p>
            </div>

            {/* Pre-Test Vitals */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pre-Test Vitals</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Systolic BP (mmHg)</Label>
                  <Input
                    type="number"
                    value={preTestVitals.systolic}
                    onChange={(e) => setPreTestVitals({ ...preTestVitals, systolic: e.target.value })}
                    placeholder="Systolic"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Diastolic BP (mmHg)</Label>
                  <Input
                    type="number"
                    value={preTestVitals.diastolic}
                    onChange={(e) => setPreTestVitals({ ...preTestVitals, diastolic: e.target.value })}
                    placeholder="Diastolic"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Heart Rate (bpm)</Label>
                  <Input
                    type="number"
                    value={preTestVitals.heartRate}
                    onChange={(e) => setPreTestVitals({ ...preTestVitals, heartRate: e.target.value })}
                    placeholder="HR"
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Trial Entry */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Record Trials</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-sm text-slate-600">Distance (meters)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={currentDistance}
                      onChange={(e) => setCurrentDistance(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTrial()}
                      placeholder="Enter distance"
                      className="mt-1 text-lg font-semibold"
                    />
                  </div>
                  <Button onClick={addTrial} className="bg-blue-600 hover:bg-blue-700 h-[42px] mt-6">
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>

                {trials.length > 0 && (
                  <div className="space-y-2">
                    <div className="grid gap-2">
                      {trials.map((trial, index) => (
                        <div key={index} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border">
                          <div>
                            <p className="font-semibold text-slate-900">Trial {index + 1}</p>
                            <p className="text-lg font-bold text-blue-600">{trial}m</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTrial(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Results Summary */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mt-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-green-700 font-semibold">Best Trial</p>
                          <p className="text-2xl font-bold text-green-600">{bestTrial}m</p>
                        </div>
                        <div>
                          <p className="text-sm text-green-700 font-semibold">Average</p>
                          <p className="text-2xl font-bold text-green-600">{avgTrial}m</p>
                        </div>
                        <div>
                          <p className="text-sm text-green-700 font-semibold">Total Trials</p>
                          <p className="text-2xl font-bold text-green-600">{trials.length}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Post-Test Vitals */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Post-Test Vitals</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Systolic BP (mmHg)</Label>
                  <Input
                    type="number"
                    value={postTestVitals.systolic}
                    onChange={(e) => setPostTestVitals({ ...postTestVitals, systolic: e.target.value })}
                    placeholder="Systolic"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Diastolic BP (mmHg)</Label>
                  <Input
                    type="number"
                    value={postTestVitals.diastolic}
                    onChange={(e) => setPostTestVitals({ ...postTestVitals, diastolic: e.target.value })}
                    placeholder="Diastolic"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Heart Rate (bpm)</Label>
                  <Input
                    type="number"
                    value={postTestVitals.heartRate}
                    onChange={(e) => setPostTestVitals({ ...postTestVitals, heartRate: e.target.value })}
                    placeholder="HR"
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any observations during test..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={trials.length === 0} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}