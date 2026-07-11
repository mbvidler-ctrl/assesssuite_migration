import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Plus, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const COMMON_EXERCISES = [
  "Bench Press", "Back Squat", "Deadlift", "Overhead Press", "Front Squat",
  "Romanian Deadlift", "Bent Over Row", "Leg Press", "Lat Pulldown",
  "Chest Press Machine", "Leg Extension", "Leg Curl", "Other"
];

export default function OneRMRunner({ onSave, onClose }) {
  const [exercises, setExercises] = useState([]);
  const [currentExercise, setCurrentExercise] = useState({
    exercise_name: '',
    one_rm_kg: '',
    method: 'actual',
    reps_performed: '',
    load_used_kg: ''
  });
  const [notes, setNotes] = useState('');

  const addExercise = () => {
    if (!currentExercise.exercise_name || !currentExercise.one_rm_kg) {
      toast.error("Please enter exercise name and 1RM value");
      return;
    }

    setExercises([...exercises, {
      ...currentExercise,
      one_rm_kg: parseFloat(currentExercise.one_rm_kg),
      reps_performed: currentExercise.reps_performed ? parseInt(currentExercise.reps_performed) : null,
      load_used_kg: currentExercise.load_used_kg ? parseFloat(currentExercise.load_used_kg) : null
    }]);

    setCurrentExercise({
      exercise_name: '',
      one_rm_kg: '',
      method: 'actual',
      reps_performed: '',
      load_used_kg: ''
    });
    toast.success("Exercise added");
  };

  const removeExercise = (index) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    // Primary result is the first exercise's 1RM (if any)
    const primaryRM = exercises.length > 0 ? exercises[0].one_rm_kg : null;

    const exerciseLines = exercises.map(ex => `  ${ex.exercise_name}: ${ex.one_rm_kg} kg (${ex.method === 'estimated' ? 'estimated' : 'actual'})`).join('\n');
    const soapText = `• 1RM Strength Testing\n${exerciseLines}${notes ? `\n  Notes: ${notes}` : ''}`;

    onSave({
      result_value: primaryRM,
      additional_data: {
        soap_text: soapText,
        exercises: exercises,
        total_exercises_tested: exercises.length,
      },
      notes: notes,
      assessment_date: todayLocal()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">1RM Strength Testing</h2>
              <p className="text-slate-600 mt-1">Maximum strength assessment</p>
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
                <p><strong>Warm-up:</strong> Light cardio followed by specific warm-up sets (50%, 70%, 90% estimated 1RM)</p>
                <p><strong>Testing:</strong> Progressively increase load until maximum is reached with strict form</p>
                <p><strong>Rest:</strong> 3-5 minutes between maximum attempts</p>
                <p><strong>Alternative:</strong> For higher-risk clients, estimate from submaximal loads (e.g., 5RM or 10RM)</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Exercise</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Exercise</Label>
                    <Select
                      value={currentExercise.exercise_name}
                      onValueChange={(value) => setCurrentExercise({...currentExercise, exercise_name: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select exercise" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_EXERCISES.map(ex => (
                          <SelectItem key={ex} value={ex}>{ex}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {currentExercise.exercise_name === 'Other' && (
                      <Input
                        value={currentExercise.custom_exercise || ''}
                        onChange={(e) => setCurrentExercise({...currentExercise, exercise_name: e.target.value})}
                        placeholder="Enter exercise name"
                        className="mt-2"
                      />
                    )}
                  </div>

                  <div>
                    <Label>Method</Label>
                    <Select
                      value={currentExercise.method}
                      onValueChange={(value) => setCurrentExercise({...currentExercise, method: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="actual">Actual 1RM Test</SelectItem>
                        <SelectItem value="estimated">Estimated from sub-max</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label>1RM (kg)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={currentExercise.one_rm_kg}
                      onChange={(e) => setCurrentExercise({...currentExercise, one_rm_kg: e.target.value})}
                      placeholder="e.g., 100"
                      className="mt-1 text-xl font-bold"
                    />
                  </div>

                  {currentExercise.method === 'estimated' && (
                    <>
                      <div>
                        <Label>Reps Performed</Label>
                        <Input
                          type="number"
                          value={currentExercise.reps_performed}
                          onChange={(e) => setCurrentExercise({...currentExercise, reps_performed: e.target.value})}
                          placeholder="e.g., 5"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Load Used (kg)</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={currentExercise.load_used_kg}
                          onChange={(e) => setCurrentExercise({...currentExercise, load_used_kg: e.target.value})}
                          placeholder="e.g., 80"
                          className="mt-1"
                        />
                      </div>
                    </>
                  )}
                </div>

                <Button onClick={addExercise} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Exercise
                </Button>
              </CardContent>
            </Card>

            {exercises.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recorded Exercises</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {exercises.map((ex, index) => (
                    <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-lg">{ex.exercise_name}</p>
                        <p className="text-3xl font-bold text-blue-600 my-1">{ex.one_rm_kg} kg</p>
                        <p className="text-sm text-slate-600">
                          {ex.method === 'estimated' 
                            ? `Estimated from ${ex.reps_performed} reps at ${ex.load_used_kg}kg`
                            : 'Actual 1RM test'}
                        </p>
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
                  placeholder="Form quality, limiting factors, safety considerations..."
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
            className="bg-red-600 hover:bg-red-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save 1RM Results
          </Button>
        </div>
      </div>
    </div>
  );
}