import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

export default function MaximalPushUpTestRunner({ client, onSave, onClose }) {
  const [trials, setTrials] = useState([]);
  const [currentTrialCount, setCurrentTrialCount] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const [notes, setNotes] = useState("");

  const handleStartTrial = () => {
    setIsTesting(true);
    setCurrentTrialCount(0);
  };

  const handleEndTrial = () => {
    if (currentTrialCount === 0) {
      toast.error("Please record at least one push-up for this trial.");
      return;
    }
    setTrials([...trials, { reps: currentTrialCount }]);
    setCurrentTrialCount(0);
    setIsTesting(false);
    toast.success(`Trial ${trials.length + 1} completed: ${currentTrialCount} reps`);
  };

  const handleIncrement = () => {
    setCurrentTrialCount((prev) => prev + 1);
  };

  const handleDecrement = () => {
    if (currentTrialCount > 0) {
      setCurrentTrialCount((prev) => prev - 1);
    }
  };

  const handleDeleteTrial = (index) => {
    setTrials(trials.filter((_, i) => i !== index));
    toast.success("Trial deleted.");
  };

  const handleSave = () => {
    const bestResult = trials.length > 0 ? Math.max(...trials.map((t) => t.reps)) : 0;
    let soapText = `• Maximal Push-Up Test: ${bestResult} repetitions (best of ${trials.length} trial${trials.length > 1 ? 's' : ''})\n`;
    trials.forEach((trial, i) => {
      soapText += `  Trial ${i + 1}: ${trial.reps} reps\n`;
    });
    if (notes.trim()) soapText += `  Clinical Notes: ${notes}\n`;

    onSave({
      status: "completed",
      result_value: bestResult,
      additional_data: {
        measurement_type: "maximal_push_up",
        trials: trials,
        best_result: bestResult,
        soap_text: soapText
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Maximal Push-Up Test</CardTitle>
            <p className="text-sm text-slate-600 mt-2">Assess upper body muscular endurance with multiple trials</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Clinician Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
              <p className="font-semibold">📋 Administration Instructions</p>
              <p><strong>Position:</strong> Full push-up (hands shoulder-width, body straight, toes on floor) OR modified (knees on floor). Document which position used. Same position each re-test.</p>
              <p className="italic">"Do as many complete push-ups as you can without stopping. Keep your body straight throughout. Stop if you cannot maintain form or experience pain."</p>
              <p><strong>Count:</strong> Count only complete repetitions (full extension to 90° elbow flexion). Stop if technique breaks down significantly.</p>
            </div>

            {/* Norms */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Norms — Full Push-Up (ACSM)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Category</th><th className="p-2 text-center">Men 20–29</th><th className="p-2 text-center">Men 40–49</th><th className="p-2 text-center">Women 20–29</th><th className="p-2 text-center">Women 40–49</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">Excellent</td><td className="p-2 text-center">≥36</td><td className="p-2 text-center">≥25</td><td className="p-2 text-center">≥30</td><td className="p-2 text-center">≥20</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">Good</td><td className="p-2 text-center">29–35</td><td className="p-2 text-center">18–24</td><td className="p-2 text-center">21–29</td><td className="p-2 text-center">13–19</td></tr>
                    <tr className="border-t"><td className="p-2">Average</td><td className="p-2 text-center">22–28</td><td className="p-2 text-center">13–17</td><td className="p-2 text-center">15–20</td><td className="p-2 text-center">8–12</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">Poor</td><td className="p-2 text-center">≤17</td><td className="p-2 text-center">≤9</td><td className="p-2 text-center">≤10</td><td className="p-2 text-center">≤5</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">Source: ACSM Guidelines for Exercise Testing and Prescription (2022). Norms for full push-up to 90° elbow flexion.</p>
            </div>

            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>American College of Sports Medicine. (2022). <em>ACSM's Guidelines for Exercise Testing and Prescription</em> (11th ed.). Wolters Kluwer.</p>
            </div>

            {/* Current Trial Counter */}
            {isTesting && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center space-y-4">
                <Label className="text-sm text-slate-600">Current Trial {trials.length + 1} Repetitions</Label>
                <div className="text-6xl font-bold text-amber-700">{currentTrialCount}</div>
                <div className="flex gap-4 justify-center">
                  <Button 
                    onClick={handleDecrement}
                    variant="outline" 
                    size="lg"
                    className="w-20"
                  >
                    <Minus className="w-6 h-6" />
                  </Button>
                  <Button 
                    onClick={handleIncrement}
                    size="lg"
                    className="w-20"
                  >
                    <Plus className="w-6 h-6" />
                  </Button>
                </div>
                <Button 
                  onClick={handleEndTrial}
                  className="w-full mt-4"
                >
                  Complete Trial
                </Button>
              </div>
            )}

            {!isTesting && (
              <Button 
                onClick={handleStartTrial}
                size="lg"
                className="w-full"
              >
                Start Trial {trials.length + 1}
              </Button>
            )}

            {/* Completed Trials */}
            {trials.length > 0 && (
              <div className="space-y-3">
                <Label className="font-semibold">Completed Trials</Label>
                <div className="space-y-2">
                  {trials.map((trial, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                      <div className="font-semibold">Trial {i + 1}: {trial.reps} reps</div>
                      <Button 
                        onClick={() => handleDeleteTrial(i)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm"><strong>Best Result:</strong> {Math.max(...trials.map(t => t.reps))} reps</p>
                </div>
              </div>
            )}

            {/* Clinical Notes */}
            <div>
              <Label htmlFor="notes">Clinical Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any additional observations..."
                rows={3}
                className="mt-2"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={onClose}>
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
              <Button 
                onClick={handleSave}
                disabled={false}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Assessment
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}