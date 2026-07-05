import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const emptyGoal = () => ({ goal: "", importance: 0, difficulty: 0, attainmentLevel: null });

export default function GoalAttainmentScalingGASRunner({ client, onSave, onClose }) {
  const [goals, setGoals] = useState([emptyGoal()]);
  const [notes, setNotes] = useState("");

  const updateGoal = (index, field, value) => {
    setGoals(prev => prev.map((g, i) => i === index ? { ...g, [field]: value } : g));
  };

  const addGoal = () => setGoals(prev => [...prev, emptyGoal()]);

  const removeGoal = (index) => setGoals(prev => prev.filter((_, i) => i !== index));

  const handleSave = () => {
    for (let i = 0; i < goals.length; i++) {
      const g = goals[i];
      if (!g.goal.trim()) { toast.error(`Goal ${i + 1}: Please describe the goal.`); return; }
      if (g.attainmentLevel === null) { toast.error(`Goal ${i + 1}: Please select an attainment level.`); return; }
    }

    const goalLines = goals.map((g, i) =>
      `Goal ${i + 1}: ${g.goal}\n  Importance: ${g.importance}/3 | Difficulty: ${g.difficulty}/3 | Attainment: ${g.attainmentLevel >= 0 ? '+' : ''}${g.attainmentLevel}`
    ).join('\n');

    const totalScore = goals.reduce((sum, g) => sum + g.attainmentLevel * (g.importance + g.difficulty), 0);

    const soapText = `Goal Attainment Scaling (GAS):\n\n${goalLines}${notes ? `\n\nNotes: ${notes}` : ''}`;

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        measurement_type: "goal_attainment_scaling",
        soap_text: soapText,
        goals,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });

    toast.success("Assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Goal Attainment Scaling (GAS) Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Clinician Instructions */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-4">
                <h3 className="font-bold mb-2 flex items-center gap-2"><span>💬</span> Clinician Instructions</h3>
                <div className="text-sm leading-relaxed bg-white/10 rounded p-3 space-y-1">
                  <p>GAS measures individualised goal achievement on a 5-point scale:</p>
                  <p>• <strong>-2</strong> = Much less than expected | <strong>-1</strong> = Somewhat less than expected</p>
                  <p>• <strong>0</strong> = Expected outcome | <strong>+1</strong> = Somewhat more | <strong>+2</strong> = Much more than expected</p>
                  <p>• Rate <strong>Importance</strong> (0–3) and <strong>Difficulty</strong> (0–3) to weight the goal in the overall T-score.</p>
                </div>
              </div>

              {/* Goals */}
              {goals.map((g, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-slate-800">Goal {index + 1}</h4>
                    {goals.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeGoal(index)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label>Patient-Specific Goal</Label>
                    <Textarea
                      value={g.goal}
                      onChange={(e) => updateGoal(index, "goal", e.target.value)}
                      placeholder="Describe the patient's goal here..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Importance (0-3)</Label>
                      <Input
                        type="number"
                        value={g.importance}
                        onChange={(e) => updateGoal(index, "importance", Math.max(0, Math.min(3, parseInt(e.target.value) || 0)))}
                        min="0" max="3"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Difficulty (0-3)</Label>
                      <Input
                        type="number"
                        value={g.difficulty}
                        onChange={(e) => updateGoal(index, "difficulty", Math.max(0, Math.min(3, parseInt(e.target.value) || 0)))}
                        min="0" max="3"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Attainment Level</Label>
                    <div className="grid grid-cols-5 gap-2 mt-1">
                      {[
                        { value: -2, label: "Much less than expected" },
                        { value: -1, label: "Somewhat less than expected" },
                        { value: 0,  label: "Expected outcome" },
                        { value: 1,  label: "Somewhat more than expected" },
                        { value: 2,  label: "Much more than expected" },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updateGoal(index, "attainmentLevel", value)}
                          className={`flex flex-col items-center justify-center rounded-lg border-2 p-2 text-center transition-all cursor-pointer
                            ${g.attainmentLevel === value
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"}`}
                        >
                          <span className="text-lg font-bold">{value >= 0 ? `+${value}` : value}</span>
                          <span className="text-xs leading-tight mt-1">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              <Button variant="outline" onClick={addGoal} className="w-full border-dashed">
                <Plus className="w-4 h-4 mr-2" />
                Add Another Goal
              </Button>

              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter any additional notes here..."
                  rows={3}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={onClose} className="flex items-center space-x-2">
            <X size={16} />
            <span>Cancel</span>
          </Button>
          <Button onClick={handleSave} className="flex items-center space-x-2">
            <Save size={16} />
            <span>Save Assessment</span>
          </Button>
        </div>
      </div>
    </div>
  );
}