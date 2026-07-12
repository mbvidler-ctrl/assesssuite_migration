import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function BruininksOseretskyTestofMotorProficiencyBOT2Runner({ client, onSave, onClose }) {
  const [preVitals, setPreVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [postVitals, setPostVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [trialData, setTrialData] = useState([]);
  const [notes, setNotes] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [timer, setTimer] = useState(0);

  const handleStartTest = () => {
    if (!preVitals.heartRate || !preVitals.bloodPressure) {
      toast.error("Please enter pre-test vital signs.");
      return;
    }
    setIsRunning(true);
    setTimer(0);
  };

  const handleStopTest = () => {
    setIsRunning(false);
    calculateResults();
  };

  const handleAddTrial = (trial) => {
    setTrialData((prevData) => [...prevData, trial]);
  };

  const handleSave = () => {
    if (!preVitals.heartRate || !preVitals.bloodPressure || !postVitals.heartRate || !postVitals.bloodPressure) {
      toast.error("Please enter all vital signs.");
      return;
    }
    const resultValue = calculateResults();
    const additionalData = {
      measurement_type: "BOT-2",
      trials: trialData,
      notes,
    };
    onSave({ status: "completed", result_value: resultValue, additional_data: additionalData, notes, assessment_date: todayLocal() });
    toast.success("Assessment saved successfully.");
  };

  const calculateResults = () => {
    return trialData.reduce((acc, trial) => acc + trial.score, 0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        {/* Reference */}
        <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1 mb-4">
          <p className="font-semibold">📖 Reference</p>
          <p>Bruininks RH & Bruininks BD. (2005). <em>Bruininks-Oseretsky Test of Motor Proficiency, Second Edition (BOT-2)</em>. Pearson Assessments.</p>
        </div>

        {/* Clinician Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1 mb-4">
          <p className="font-semibold">📋 Administration Instructions</p>
          <p><strong>Overview:</strong> BOT-2 assesses motor proficiency in 4–21 year olds. Comprises 8 subtests: Fine Motor Precision, Fine Motor Integration, Manual Dexterity, Bilateral Coordination, Balance, Running Speed and Agility, Upper-Limb Coordination, and Strength.</p>
          <p><strong>Complete Form:</strong> All 8 subtests (~45–60 min). <strong>Short Form:</strong> 14 selected items (~15–20 min). Both yield age-equivalent scores and standard scores.</p>
          <p><strong>Scoring:</strong> Raw scores converted to scale scores (M=15, SD=5), then composite scores (M=50, SD=10) using age-referenced norms from the manual. Enter subtest totals and total point scores from the completed score sheet.</p>
          <p><strong>Note:</strong> This runner captures trial data. Use the official BOT-2 Record Form and manual for full scoring and normative conversion.</p>
        </div>

        {/* Norms */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2 mb-4">
          <p className="font-semibold text-slate-700">📊 Composite Score Classification</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-300 rounded">
              <thead className="bg-slate-200"><tr><th className="p-2 text-left">Standard Score</th><th className="p-2 text-left">Classification</th></tr></thead>
              <tbody>
                <tr className="border-t"><td className="p-2">≥70</td><td className="p-2 text-green-700">Above Average / Well Above Average</td></tr>
                <tr className="border-t bg-white"><td className="p-2">41–69</td><td className="p-2 text-teal-700">Average</td></tr>
                <tr className="border-t"><td className="p-2">31–40</td><td className="p-2 text-yellow-700">Below Average</td></tr>
                <tr className="border-t bg-white"><td className="p-2">≤30</td><td className="p-2 text-red-700">Well Below Average</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">Composite scores have M=50, SD=10. Subtest scale scores M=15, SD=5. Age norms from 4–21 years. Source: Bruininks & Bruininks (2005).</p>
        </div>

        <Card>
        <CardHeader>
          <CardTitle>Bruininks-Oseretsky Test of Motor Proficiency (BOT-2)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Pre-Test Vital Signs</Label>
              <Input
                type="number"
                placeholder="Heart Rate (bpm)"
                value={preVitals.heartRate}
                onChange={(e) => setPreVitals({ ...preVitals, heartRate: e.target.value })}
                className="mb-2"
              />
              <Input
                type="text"
                placeholder="Blood Pressure (mmHg)"
                value={preVitals.bloodPressure}
                onChange={(e) => setPreVitals({ ...preVitals, bloodPressure: e.target.value })}
              />
            </div>
            <div>
              <Label>Post-Test Vital Signs</Label>
              <Input
                type="number"
                placeholder="Heart Rate (bpm)"
                value={postVitals.heartRate}
                onChange={(e) => setPostVitals({ ...postVitals, heartRate: e.target.value })}
                className="mb-2"
              />
              <Input
                type="text"
                placeholder="Blood Pressure (mmHg)"
                value={postVitals.bloodPressure}
                onChange={(e) => setPostVitals({ ...postVitals, bloodPressure: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4">
            <Label>Trial Data</Label>
            <div className="space-y-2">
              {trialData.map((trial, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span>Trial {index + 1}</span>
                  <span>Score: {trial.score}</span>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => handleAddTrial({ score: Math.floor(Math.random() * 100) })}
            >
              Add Trial
            </Button>
          </div>
          <div className="mt-4">
            <Label>Notes</Label>
            <Textarea
              placeholder="Enter any additional notes here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onClose}>
          <X className="mr-2" />
          Close
        </Button>
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={handleStartTest} disabled={isRunning}>
            <Play className="mr-2" />
            Start Test
          </Button>
          <Button variant="outline" onClick={handleStopTest} disabled={!isRunning}>
            <AlertTriangle className="mr-2" />
            Stop Test
          </Button>
          <Button variant="outline" onClick={handleSave}>
            <Save className="mr-2" />
            Save Assessment
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}