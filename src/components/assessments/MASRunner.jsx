import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const MAS_SCORES = [
  { score: 0, label: "No increase in muscle tone" },
  { score: 1, label: "Slight increase in tone (catch and release or minimal resistance at end range)" },
  { score: "1+", label: "Slight increase in tone (catch, followed by minimal resistance throughout <50% of ROM)" },
  { score: 2, label: "More marked increase in tone through most of ROM, but affected part easily moved" },
  { score: 3, label: "Considerable increase in tone, passive movement difficult" },
  { score: 4, label: "Affected part rigid in flexion or extension" }
];

export default function MASRunner({ onSave, onClose }) {
  const [muscles, setMuscles] = useState([{ muscle: "", side: "right", score: "" }]);
  const [notes, setNotes] = useState("");

  const handleAddMuscle = () => {
    setMuscles([...muscles, { muscle: "", side: "right", score: "" }]);
  };

  const handleRemoveMuscle = (index) => {
    if (muscles.length <= 1) {
      toast.error("At least one muscle group required");
      return;
    }
    setMuscles(muscles.filter((_, i) => i !== index));
  };

  const handleMuscleChange = (index, field, value) => {
    const newMuscles = [...muscles];
    newMuscles[index][field] = value;
    setMuscles(newMuscles);
  };

  const isValid = () => {
    return muscles.every(m => m.muscle && m.score !== "");
  };

  const handleSave = () => {
    if (!isValid()) {
      toast.error("Please complete all muscle assessments");
      return;
    }

    onSave({
      result_value: 0, // MAS doesn't have a total score
      additional_data: {
        muscle_assessments: muscles
      },
      notes: notes,
      assessment_date: new Date().toISOString()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-cyan-50 to-blue-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Modified Ashworth Scale (MAS)</h2>
              <p className="text-slate-600 mt-1">Assessment of muscle spasticity</p>
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
                  Assessment Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>Procedure:</strong> With client relaxed, move limb through full available ROM at moderate speed (approximately 1 second for full ROM).</p>
                <p className="mt-2"><strong>Key Points:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Client must be relaxed and comfortable</li>
                  <li>Assess resistance to passive movement</li>
                  <li>Note location of catch or resistance in ROM</li>
                  <li>Test each muscle group individually</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">MAS Scoring</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {MAS_SCORES.map((item) => (
                    <div key={item.score} className="p-2 border-l-4 border-blue-400 bg-slate-50">
                      <p className="text-sm">
                        <strong className="text-blue-600 text-base">{item.score}:</strong> {item.label}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Muscle Assessments</CardTitle>
                  <Button onClick={handleAddMuscle} size="sm" className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Muscle
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {muscles.map((muscle, index) => (
                  <div key={index} className="p-4 border rounded bg-slate-50 space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="font-semibold">Muscle Group {index + 1}</Label>
                      {muscles.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMuscle(index)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm">Muscle/Movement</Label>
                        <Input
                          value={muscle.muscle}
                          onChange={(e) => handleMuscleChange(index, 'muscle', e.target.value)}
                          placeholder="e.g., Elbow flexors, Knee extensors"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Side</Label>
                        <Select
                          value={muscle.side}
                          onValueChange={(value) => handleMuscleChange(index, 'side', value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="right">Right</SelectItem>
                            <SelectItem value="left">Left</SelectItem>
                            <SelectItem value="bilateral">Bilateral</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">MAS Score</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {MAS_SCORES.map((item) => (
                          <Button
                            key={item.score}
                            type="button"
                            variant={muscle.score === item.score.toString() ? "default" : "outline"}
                            onClick={() => handleMuscleChange(index, 'score', item.score.toString())}
                            className="text-xs h-auto py-2"
                          >
                            {item.score}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Patterns of spasticity, functional impact, response to positioning, medication effects..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isValid()} className="bg-cyan-600 hover:bg-cyan-700">
            <Save className="w-4 h-4 mr-2" />
            Save MAS
          </Button>
        </div>
      </div>
    </div>
  );
}