import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

export default function DualTaskGaitAssessmentRunner({ client, onSave, onClose }) {
  const [singleTaskTime, setSingleTaskTime] = useState("");
  const [dualTaskTime, setDualTaskTime] = useState("");
  const [cognitiveTask, setCognitiveTask] = useState("");
  const [notes, setNotes] = useState("");
  const handleSave = () => {
    if (!singleTaskTime || !dualTaskTime || !cognitiveTask) {
      toast.error("Please fill in all fields before saving.");
      return;
    }

    const singleTime = parseFloat(singleTaskTime);
    const dualTime = parseFloat(dualTaskTime);

    if (isNaN(singleTime) || isNaN(dualTime)) {
      toast.error("Please enter valid numerical values for times.");
      return;
    }

    // DTC = ((Dual - Single) / Single) * 100
    // Positive = slowing during dual task (worse), Negative = paradoxical (faster during dual task)
    const dualTaskCost = ((dualTime - singleTime) / singleTime) * 100;

    const soapText = `• Dual-Task Gait Assessment:\n  Single-Task Time: ${singleTime} seconds\n  Dual-Task Time: ${dualTime} seconds\n  Dual-Task Cost: ${dualTaskCost.toFixed(2)}%\n  Cognitive Task: ${cognitiveTask}\n  Interpretation: ${dualTaskCost > 20 ? "Clinically significant (>20%) - increased fall risk" : dualTaskCost < 0 ? "Paradoxical response (faster during dual-task) - unusual" : "Within normal range (<20%)"}\n${notes ? `\n  Clinician Notes:\n    ${notes.replace(/\n/g, '\n    ')}` : ""}`;

    const additionalData = {
      measurement_type: "dual_task_gait_assessment",
      single_task_time: singleTime,
      dual_task_time: dualTime,
      cognitive_task: cognitiveTask,
      dual_task_cost: dualTaskCost.toFixed(2),
      soap_text: soapText
    };

    onSave({
      status: "completed",
      result_value: dualTaskCost.toFixed(2),
      additional_data: additionalData,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });

    toast.success("Assessment saved successfully.");
    };

    return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Dual-Task Gait Assessment</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">

            {/* Clinician Instructions */}
            <div className="bg-blue-600 text-white rounded-lg p-4 space-y-2">
              <p className="font-semibold text-base">📋 Clinician Instructions</p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Set up a 10-metre walking course (or standard TUG course if preferred).</li>
                <li><strong>Trial 1 — Single Task:</strong> Client walks the course at their comfortable pace. Record time in seconds.</li>
                <li><strong>Trial 2 — Dual Task:</strong> Client walks the same course while simultaneously performing a cognitive task (e.g., counting backwards, naming animals). Record time in seconds.</li>
                <li>Allow a rest period (1–2 min) between trials.</li>
                <li>Dual-Task Cost (DTC%) is auto-calculated: DTC = ((Single − Dual) / Single) × 100. A positive % = slowing during dual task.</li>
                <li>DTC &gt;20% is considered clinically significant for fall risk.</li>
              </ul>
            </div>

            {/* Script for Client */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-green-800 text-sm">🗣ï¸ What to Say to the Client</p>
              <div className="space-y-2 text-sm text-slate-700">
                <div className="bg-white rounded p-2 border border-green-100">
                  <p className="font-semibold text-green-700 text-xs uppercase mb-1">Single-Task Trial</p>
                  <p className="italic">"I'd like you to walk from here to that cone at your normal, comfortable walking pace. Walk as you normally would. Ready? Go."</p>
                </div>
                <div className="bg-white rounded p-2 border border-green-100">
                  <p className="font-semibold text-green-700 text-xs uppercase mb-1">Dual-Task Trial</p>
                  <p className="italic">"This time, I'd like you to walk the same distance again, but while you're walking I'd like you to [count backwards from 100 by 3s / name as many animals as you can / say the months of the year backwards]. Try your best at both tasks. Ready? Go."</p>
                </div>
              </div>
            </div>

            {/* Cognitive Task Examples */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-slate-700 text-sm">💡 Example Cognitive Tasks</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white rounded p-2 border border-slate-100">
                  <p className="font-semibold text-slate-600">Serial Subtraction</p>
                  <p className="text-slate-500">Count backwards from 100 by 3s or 7s</p>
                </div>
                <div className="bg-white rounded p-2 border border-slate-100">
                  <p className="font-semibold text-slate-600">Animal Naming</p>
                  <p className="text-slate-500">Name as many animals as possible</p>
                </div>
                <div className="bg-white rounded p-2 border border-slate-100">
                  <p className="font-semibold text-slate-600">Months Backwards</p>
                  <p className="text-slate-500">Say the months of the year in reverse</p>
                </div>
                <div className="bg-white rounded p-2 border border-slate-100">
                  <p className="font-semibold text-slate-600">Carrying a Tray</p>
                  <p className="text-slate-500">Motor dual-task: carry a full cup of water</p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="singleTaskTime">Single-Task Time (seconds)</Label>
              <Input
                id="singleTaskTime"
                type="number"
                value={singleTaskTime}
                onChange={(e) => setSingleTaskTime(e.target.value)}
                placeholder="e.g. 12.5"
              />
            </div>
            <div>
              <Label htmlFor="dualTaskTime">Dual-Task Time (seconds)</Label>
              <Input
                id="dualTaskTime"
                type="number"
                value={dualTaskTime}
                onChange={(e) => setDualTaskTime(e.target.value)}
                placeholder="e.g. 16.2"
              />
            </div>
            <div>
              <Label htmlFor="cognitiveTask">Cognitive Task Performed</Label>
              <Input
                id="cognitiveTask"
                type="text"
                value={cognitiveTask}
                onChange={(e) => setCognitiveTask(e.target.value)}
                placeholder="e.g. Counting backwards from 100 by 3s"
              />
            </div>

            {/* Live DTC preview */}
             {singleTaskTime && dualTaskTime && !isNaN(parseFloat(singleTaskTime)) && !isNaN(parseFloat(dualTaskTime)) && (
               <div className={`p-3 rounded-lg border ${((parseFloat(dualTaskTime) - parseFloat(singleTaskTime)) / parseFloat(singleTaskTime) * 100) > 20 ? 'bg-red-50 border-red-200' : ((parseFloat(dualTaskTime) - parseFloat(singleTaskTime)) / parseFloat(singleTaskTime) * 100) < 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                 <p className="text-sm font-semibold">
                   Dual-Task Cost: {((parseFloat(dualTaskTime) - parseFloat(singleTaskTime)) / parseFloat(singleTaskTime) * 100).toFixed(1)}%
                   {((parseFloat(dualTaskTime) - parseFloat(singleTaskTime)) / parseFloat(singleTaskTime) * 100) > 20 ? " ⚠ï¸ Clinically significant (>20%)" : ((parseFloat(dualTaskTime) - parseFloat(singleTaskTime)) / parseFloat(singleTaskTime) * 100) < 0 ? " ⚠ï¸ Paradoxical response (faster during dual-task - unusual)" : " ✓ Within normal range (<20%)"}
                 </p>
               </div>
             )}

            <div>
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onClose}>
          <X className="mr-2" />
          Close
        </Button>
        <Button onClick={handleSave}>
          <Save className="mr-2" />
          Save Assessment
        </Button>
      </div>
      </div>
    </div>
  );
}