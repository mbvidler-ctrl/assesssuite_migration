import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

const PPT_TASKS = [
  { task: "Writing a sentence", maxScore: 4 },
  { task: "Simulated eating", maxScore: 4 },
  { task: "Lifting a book overhead", maxScore: 4 },
  { task: "Putting on and removing a jacket", maxScore: 4 },
  { task: "Picking up a penny from floor", maxScore: 4 },
  { task: "Turning 360 degrees", maxScore: 4 },
  { task: "50-foot (15m) walk test", maxScore: 4 }
];

export default function PPTRunner({ onSave, onClose }) {
  const [taskScores, setTaskScores] = useState({});
  const [assistiveDevice, setAssistiveDevice] = useState('none');
  const [safetyObservations, setSafetyObservations] = useState('');
  const [notes, setNotes] = useState('');

  const updateTaskScore = (index, score) => {
    setTaskScores({ ...taskScores, [index]: parseInt(score) });
  };

  const calculateTotal = () => {
    return Object.values(taskScores).reduce((sum, score) => sum + score, 0);
  };

  const getInterpretation = (total) => {
    if (total < 19) return { text: 'Frailty/Reduced Independence', color: 'text-red-600', bg: 'bg-red-50' };
    if (total < 25) return { text: 'Mild Impairment', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { text: 'Good Function', color: 'text-green-600', bg: 'bg-green-50' };
  };

  const totalScore = calculateTotal();
  const interpretation = totalScore > 0 ? getInterpretation(totalScore) : null;

  const handleSave = () => {
    if (Object.keys(taskScores).length < PPT_TASKS.length) {
      toast.error("Please score all tasks");
      return;
    }

    onSave({
      result_value: totalScore,
      task_scores: taskScores,
      total_score: totalScore,
      max_possible: 28,
      assistive_device: assistiveDevice,
      safety_observations: safetyObservations,
      interpretation: interpretation?.text,
      notes: notes,
      assessment_date: new Date().toISOString()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-violet-50 to-purple-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Physical Performance Test (PPT)</h2>
              <p className="text-slate-600 mt-1">Functional assessment for older adults</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>Reuben DB & Siu AL. (1990). An objective measure of physical function of elderly outpatients: the Physical Performance Test. <em>Journal of the American Geriatrics Society, 38</em>(10), 1105–1112.</p>
            </div>

            {/* Norms */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Score Interpretation (/28)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Score</th><th className="p-2 text-left">Interpretation</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">25–28</td><td className="p-2 text-green-700">Good function — no/minimal impairment</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">19–24</td><td className="p-2 text-yellow-700">Mild impairment</td></tr>
                    <tr className="border-t"><td className="p-2">&lt;19</td><td className="p-2 text-red-700">Frailty/reduced independence</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">MCID: ~1.5 points. Scores predict hospitalisation, nursing home admission, and mortality in older adults. Source: Reuben & Siu (1990).</p>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Scoring Guidelines
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-1">
                <p>Each task is scored 0-4 points based on time or ability:</p>
                <p>• 4 points = Excellent performance</p>
                <p>• 3 points = Good performance</p>
                <p>• 2 points = Fair performance</p>
                <p>• 1 point = Poor performance</p>
                <p>• 0 points = Unable to complete</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Task Scores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {PPT_TASKS.map((task, index) => (
                  <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <Label className="mb-2 block">{index + 1}. {task.task}</Label>
                    <div className="flex gap-2">
                      {[0, 1, 2, 3, 4].map(score => (
                        <Button
                          key={score}
                          type="button"
                          variant={taskScores[index] === score ? "default" : "outline"}
                          onClick={() => updateTaskScore(index, score)}
                          className="flex-1"
                        >
                          {score}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {totalScore > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-indigo-50 border-2 border-indigo-300 rounded-lg p-4 text-center">
                    <p className="text-sm text-indigo-700 mb-1">Total PPT Score</p>
                    <p className="text-5xl font-bold text-indigo-600">{totalScore}</p>
                    <p className="text-xs text-indigo-600">out of 28</p>
                  </div>

                  {interpretation && (
                    <div className={`p-4 rounded-lg border-2 ${interpretation.bg} border-current`}>
                      <p className="text-sm mb-1">Interpretation</p>
                      <p className={`text-lg font-bold ${interpretation.color}`}>{interpretation.text}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Assistive Device Used</Label>
                  <Select value={assistiveDevice} onValueChange={setAssistiveDevice}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="cane">Cane</SelectItem>
                      <SelectItem value="walker">Walker</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Safety Observations</Label>
                  <Textarea
                    value={safetyObservations}
                    onChange={(e) => setSafetyObservations(e.target.value)}
                    placeholder="Gait stability, balance concerns, need for assistance..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Clinical Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Functional limitations, recommendations, intervention needs..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave}
            disabled={Object.keys(taskScores).length < PPT_TASKS.length}
            className="bg-violet-600 hover:bg-violet-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save PPT Results
          </Button>
        </div>
      </div>
    </div>
  );
}