import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, X, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

const TASKS = {
  "7-item": [
    { id: "task_1_sentence", name: "Writing a sentence", number: 1 },
    { id: "task_2_eating", name: "Simulated eating", number: 2 },
    { id: "task_3_book_lift", name: "Lifting a book overhead", number: 3 },
    { id: "task_4_jacket", name: "Putting on and removing a jacket", number: 4 },
    { id: "task_5_pickup", name: "Picking up a small object from the floor", number: 5 },
    { id: "task_6_turn", name: "Turning 360 degrees", number: 6 },
    { id: "task_7_walk", name: "50-foot (15 m) walk test", number: 7 },
  ],
  "9-item": [
    { id: "task_1_sentence", name: "Writing a sentence", number: 1 },
    { id: "task_2_eating", name: "Simulated eating", number: 2 },
    { id: "task_3_book_lift", name: "Lifting a book overhead", number: 3 },
    { id: "task_4_jacket", name: "Putting on and removing a jacket", number: 4 },
    { id: "task_5_pickup", name: "Picking up a small object from the floor", number: 5 },
    { id: "task_6_turn", name: "Turning 360 degrees", number: 6 },
    { id: "task_7_walk", name: "50-foot (15 m) walk test", number: 7 },
    { id: "task_8_stairs", name: "Stair task", number: 8 },
    { id: "task_9_progressive_romberg", name: "Progressive standing balance task", number: 9 },
  ],
};

const SAFETY_CONCERNS = [
  { label: "Falls risk", value: "falls_risk" },
  { label: "Pain", value: "pain" },
  { label: "Dizziness", value: "dizziness" },
  { label: "Breathlessness", value: "breathlessness" },
  { label: "Fatigue", value: "fatigue" },
  { label: "Cardiac symptoms", value: "cardiac_symptoms" },
];

export default function PhysicalPerformanceTestPPTRunner({ client, onSave, onClose }) {
  const [state, setState] = useState("setup"); // setup, safety, tasks, complete
  const [version, setVersion] = useState("7-item");
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [assessorName, setAssessorName] = useState("");
  const [usedGaitAid, setUsedGaitAid] = useState(false);
  const [supervisionLevel, setSupervisionLevel] = useState("independent");
  const [generalNotes, setGeneralNotes] = useState("");
  const [safeToProc, setSafeToProc] = useState(true);
  const [safetyConcerns, setSafetyConcerns] = useState([]);
  const [taskScores, setTaskScores] = useState({});
  const [taskTimes, setTaskTimes] = useState({});
  const [taskNotes, setTaskNotes] = useState({});
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);

  const tasks = TASKS[version];
  const maxScore = version === "9-item" ? 36 : 28;

  const handleTaskScore = (taskId, score) => {
    setTaskScores({ ...taskScores, [taskId]: parseInt(score) });
  };

  const handleTaskTime = (taskId, time) => {
    setTaskTimes({ ...taskTimes, [taskId]: parseFloat(time) || 0 });
  };

  const handleTaskNotes = (taskId, notes) => {
    setTaskNotes({ ...taskNotes, [taskId]: notes });
  };

  const toggleSafetyConcern = (value) => {
    setSafetyConcerns(prev =>
      prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value]
    );
  };

  const calculateTotal = () => {
    return Object.values(taskScores).reduce((sum, score) => sum + (score || 0), 0);
  };

  const allTasksScored = Object.keys(taskScores).length === tasks.length;

  const handleProceedToTasks = () => {
    if (!safeToProc) {
      toast.error("Assessment cannot proceed: Safety concerns identified.");
      return;
    }
    setState("tasks");
  };

  const handleNextTask = () => {
    if (currentTaskIndex < tasks.length - 1) {
      setCurrentTaskIndex(currentTaskIndex + 1);
    } else {
      setState("complete");
    }
  };

  const handlePreviousTask = () => {
    if (currentTaskIndex > 0) {
      setCurrentTaskIndex(currentTaskIndex - 1);
    }
  };

  const handleSave = () => {
    if (Object.keys(taskScores).length === 0) {
      toast.error("Please score at least one task before saving.");
      return;
    }

    const totalScore = calculateTotal();

    // Build SOAP text
    const soapLines = [
      `â€¢ Physical Performance Test (PPT) - ${version}`,
      `  Total Score: ${totalScore}/${maxScore}`,
      `  Assessment Date: ${assessmentDate}`,
      `  Gait Aid Used: ${usedGaitAid ? 'Yes' : 'No'}`,
      `  Supervision Level: ${supervisionLevel}`,
      ``,
      `  Task Results:`,
      ...tasks.map(task => {
        const score = taskScores[task.id];
        const time = taskTimes[task.id];
        const notes = taskNotes[task.id];
        let line = `    Task ${task.number} - ${task.name}: Score ${score}/4`;
        if (time) line += ` | Time: ${time}s`;
        if (notes) line += ` | Notes: ${notes}`;
        return line;
      }),
      ``,
      `  Clinical Interpretation:`,
      totalScore >= maxScore * 0.75
        ? `    Higher functional performance observed.`
        : totalScore >= maxScore * 0.5
        ? `    Moderate functional limitation present.`
        : `    Marked functional limitation requiring further assessment and support.`,
      ``,
      generalNotes ? `  General Notes: ${generalNotes}` : null,
      safetyConcerns.length > 0 ? `  Safety Concerns Noted: ${safetyConcerns.join(', ')}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        version,
        total_score: totalScore,
        max_score: maxScore,
        gait_aid_used: usedGaitAid,
        supervision_level: supervisionLevel,
        taskScores,
        taskTimes,
        taskNotes,
        safety_concerns: safetyConcerns,
        soap_text: soapLines,
      },
      notes: generalNotes,
      assessment_date: assessmentDate,
    });

    toast.success("PPT assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-start z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Physical Performance Test (PPT)</h2>
            <p className="text-sm text-slate-500">Functional assessment for older adults</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Setup State */}
          {state === "setup" && (
            <>
              {/* Reference */}
              <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                <p className="font-semibold">ðŸ“– Reference</p>
                <p>Reuben DB & Siu AL. (1990). An objective measure of physical function of elderly outpatients: the Physical Performance Test. <em>Journal of the American Geriatrics Society, 38</em>(10), 1105â€“1112.</p>
              </div>

              {/* Norms */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
                <p className="font-semibold text-slate-700">ðŸ“Š Score Interpretation</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-slate-300 rounded">
                    <thead className="bg-slate-200"><tr><th className="p-2 text-left">Score</th><th className="p-2 text-left">Interpretation</th></tr></thead>
                    <tbody>
                      <tr className="border-t"><td className="p-2">â‰¥25/28</td><td className="p-2 text-green-700">Good function</td></tr>
                      <tr className="border-t bg-white"><td className="p-2">19â€“24/28</td><td className="p-2 text-yellow-700">Mild impairment</td></tr>
                      <tr className="border-t"><td className="p-2">&lt;19/28</td><td className="p-2 text-red-700">Frailty/reduced independence</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">7-item max 28; 9-item max 36. Each task 0â€“4. Higher = better function. Source: Reuben & Siu (1990).</p>
              </div>

              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Scoring Guidelines
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-blue-900 space-y-1">
                  <p>Each task is scored 0-4 points based on time or ability:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>4 points</strong> = Excellent performance</li>
                    <li><strong>3 points</strong> = Good performance</li>
                    <li><strong>2 points</strong> = Fair performance</li>
                    <li><strong>1 point</strong> = Poor performance</li>
                    <li><strong>0 points</strong> = Unable to complete</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Task Scores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="block text-xs text-slate-500 font-medium mb-1">Client Name</Label>
                      <Input
                        value={client?.full_name || ""}
                        disabled
                        className="bg-slate-100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="assessor-name" className="block text-xs text-slate-500 font-medium mb-1">
                        Assessor Name
                      </Label>
                      <Input
                        id="assessor-name"
                        value={assessorName}
                        onChange={(e) => setAssessorName(e.target.value)}
                        placeholder="Enter assessor name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="assessment-date" className="block text-xs text-slate-500 font-medium mb-1">
                        Assessment Date
                      </Label>
                      <Input
                        id="assessment-date"
                        type="date"
                        value={assessmentDate}
                        onChange={(e) => setAssessmentDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="version" className="block text-xs text-slate-500 font-medium mb-1">
                        PPT Version
                      </Label>
                      <select
                        id="version"
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        className="w-full border border-slate-300 rounded-md p-2"
                      >
                        <option value="7-item">7-item</option>
                        <option value="9-item">9-item</option>
                      </select>
                    </div>
                    <div>
                      <Label className="flex items-center gap-2 cursor-pointer pt-6">
                        <Checkbox checked={usedGaitAid} onCheckedChange={setUsedGaitAid} />
                        <span className="text-xs">Gait aid used</span>
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Safety State */}
          {state === "safety" && (
            <Card className={safeToProc ? "border-green-300" : "border-red-500 bg-red-50"}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Safety Check
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2 cursor-pointer mb-4">
                    <Checkbox checked={safeToProc} onCheckedChange={setSafeToProc} />
                    <span className="font-medium">Clinician judges client safe to proceed *</span>
                  </Label>
                </div>

                <div>
                  <Label className="block font-medium mb-3">Safety Concerns Observed</Label>
                  <div className="space-y-2">
                    {SAFETY_CONCERNS.map(concern => (
                      <div key={concern.value} className="flex items-center gap-2">
                        <Checkbox
                          checked={safetyConcerns.includes(concern.value)}
                          onCheckedChange={() => toggleSafetyConcern(concern.value)}
                        />
                        <Label className="text-sm cursor-pointer">{concern.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tasks State */}
          {state === "tasks" && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Task {currentTaskIndex + 1} of {tasks.length}</p>
                    <p>Score this task: 4 (Excellent), 3 (Good), 2 (Fair), 1 (Poor), 0 (Unable)</p>
                  </div>
                </div>
              </div>

              {(() => {
                const task = tasks[currentTaskIndex];
                return (
                  <Card key={task.id} className="border-slate-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">
                        {task.name}
                      </CardTitle>
                      <div className="w-full bg-slate-200 rounded-full h-2 mt-3">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${((currentTaskIndex + 1) / tasks.length) * 100}%` }}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`${task.id}_score`} className="block font-medium mb-2">
                            Score (0-4) *
                          </Label>
                          <div className="grid grid-cols-5 gap-2">
                            {[0, 1, 2, 3, 4].map(n => (
                              <Button
                                key={n}
                                variant={taskScores[task.id] === n ? "default" : "outline"}
                                onClick={() => handleTaskScore(task.id, n)}
                                className="h-14 flex flex-col"
                              >
                                <span className="font-bold text-lg">{n}</span>
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label htmlFor={`${task.id}_time`} className="block font-medium mb-2">
                            Time (seconds)
                          </Label>
                          <Input
                            id={`${task.id}_time`}
                            type="number"
                            min="0"
                            step="0.1"
                            value={taskTimes[task.id] ?? ""}
                            onChange={(e) => handleTaskTime(task.id, e.target.value)}
                            placeholder="0.0"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor={`${task.id}_notes`} className="block font-medium mb-2">
                          Task Notes
                        </Label>
                        <Textarea
                          id={`${task.id}_notes`}
                          value={taskNotes[task.id] ?? ""}
                          onChange={(e) => handleTaskNotes(task.id, e.target.value)}
                          placeholder="Observations, difficulties, cueing provided..."
                          rows={2}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </>
          )}

          {/* Complete State */}
          {state === "complete" && (
            <>
              <Card className="bg-slate-50 border-slate-300">
                <CardHeader>
                  <CardTitle className="text-base">Assessment Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-slate-600 mb-2">Total Score</p>
                    <p className="text-5xl font-bold text-blue-700">{calculateTotal()}/{maxScore}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <p className="text-sm text-slate-700">
                      {calculateTotal() >= maxScore * 0.75
                        ? "Higher functional performance observed."
                        : calculateTotal() >= maxScore * 0.5
                        ? "Moderate functional limitation present. Consider which domains were limited."
                        : "Marked functional limitation. Further assessment and support recommended."}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">General Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    placeholder="Any additional clinical observations..."
                    rows={3}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-slate-50 px-6 py-4 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>

          {state === "setup" && (
            <Button onClick={() => setState("safety")} className="bg-blue-600 hover:bg-blue-700">
              Proceed to Safety Check â†’
            </Button>
          )}

          {state === "safety" && (
            <Button onClick={handleProceedToTasks} disabled={!safeToProc} className="bg-blue-600 hover:bg-blue-700">
              Start Task Scoring â†’
            </Button>
          )}

          {state === "tasks" && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePreviousTask} disabled={currentTaskIndex === 0}>
                â† Previous
              </Button>
              <Button onClick={handleNextTask} className="bg-blue-600 hover:bg-blue-700">
                {currentTaskIndex === tasks.length - 1 ? "Review Results" : "Next Task"} â†’
              </Button>
            </div>
          )}

          {state === "complete" && (
            <Button onClick={handleSave} disabled={Object.keys(taskScores).length === 0} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Save Assessment
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}