import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, X, ExternalLink, ChevronDown, Info } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const RMI_TASKS = [
  { id: 1, name: "Turning in Bed", description: "Can client turn in bed unaided?" },
  { id: 2, name: "Lying to Sitting", description: "Can client lie to sitting unaided?" },
  { id: 3, name: "Sitting Balance (Unsupported)", description: "Can client sit unsupported for 5 seconds?" },
  { id: 4, name: "Sitting to Standing", description: "Can client sit to stand unaided?" },
  { id: 5, name: "Standing Balance (Unsupported)", description: "Can client stand unsupported for 5 seconds?" },
  { id: 6, name: "Standing Balance (Eyes Closed)", description: "Can client stand with eyes closed for 3 seconds?" },
  { id: 7, name: "Standing to Sitting", description: "Can client stand to sit safely?" },
  { id: 8, name: "Transfer: Bed to Chair", description: "Can client transfer from bed to chair?" },
  { id: 9, name: "Transfer: Chair to Toilet", description: "Can client transfer to toilet?" },
  { id: 10, name: "Walking (Indoors) on Level Surface", description: "Can client walk 10m on level surface?" },
  { id: 11, name: "Walking (Outdoors) on Level Surface", description: "Can client walk outdoors?" },
  { id: 12, name: "Walking Up Stairs", description: "Can client walk up stairs?" },
  { id: 13, name: "Walking Down Stairs", description: "Can client walk down stairs?" },
  { id: 14, name: "Walking (Carpet or Uneven)", description: "Can client walk on carpet/uneven surfaces?" },
  { id: 15, name: "Walking (Outdoor Terrain)", description: "Can client walk on outdoor terrain?" },
];

export default function RivermadMobilityIndexRunner({ client, onSave, onClose }) {
  const [taskScores, setTaskScores] = useState({});
  const [notes, setNotes] = useState("");

  const handleTaskChange = (taskId, completed) => {
    setTaskScores(prev => ({
      ...prev,
      [taskId]: completed ? 1 : 0
    }));
  };

  const totalScore = Object.values(taskScores).reduce((sum, val) => sum + (val || 0), 0);
  const completedTasks = Object.keys(taskScores).length;
  const allTasksScored = completedTasks === 15;

  const handleSave = () => {
    // Determine completion status based on answered items
    const statusMap = {
      complete: completedTasks === 15,
      partial: completedTasks > 0 && completedTasks < 15,
      incomplete: completedTasks === 0
    };

    const assessmentStatus = statusMap.complete ? "completed" : statusMap.partial ? "partial" : "incomplete";

    // Build SOAP text based on status
    let soapText;
    if (statusMap.complete) {
      soapText = `â€¢ Rivermead Mobility Index (RMI): ${totalScore}/15. Mobility self-report completed. Interpretation: ${getMobilityLevel(totalScore)}.${notes ? ` Notes: ${notes}` : ""}`;
    } else if (statusMap.partial) {
      const unansweredCount = 15 - completedTasks;
      soapText = `â€¢ Rivermead Mobility Index (RMI): Partial assessment completed. ${completedTasks}/15 items answered, current score ${totalScore}/${completedTasks} from answered items. ${unansweredCount} item${unansweredCount !== 1 ? "s" : ""} left unanswered.${notes ? ` Notes: ${notes}` : ""}`;
    } else {
      soapText = `â€¢ Rivermead Mobility Index (RMI): Assessment saved as incomplete/draft. No scored items completed.${notes ? ` Notes: ${notes}` : ""}`;
    }

    onSave({
      status: assessmentStatus,
      result_value: completedTasks > 0 ? totalScore : null,
      additional_data: {
        measurement_type: "rivermead_mobility_index",
        score: completedTasks > 0 ? totalScore : null,
        max_score: 15,
        answered_count: completedTasks,
        yes_count: Object.values(taskScores).filter(v => v === 1).length,
        no_count: Object.values(taskScores).filter(v => v === 0).length,
        unanswered_count: 15 - completedTasks,
        completion_status: assessmentStatus,
        mobility_level: completedTasks > 0 ? getMobilityLevel(totalScore) : "Not assessed",
        individual_tasks: taskScores,
        soap_text: soapText,
        completed_at: new Date().toISOString()
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });

    const successMsg = statusMap.complete ? "Assessment completed and saved" : statusMap.partial ? "Partial assessment saved" : "Draft saved (no items scored)";
    toast.success(successMsg);
  };

  const getMobilityLevel = (score) => {
    if (score <= 6) return "Poor mobility";
    if (score <= 11) return "Limited mobility";
    return "Good mobility";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] overflow-y-auto p-6 space-y-4">
        {/* Header */}
        <div className="border-b pb-4 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Rivermead Mobility Index</h1>
            <p className="text-slate-600 mt-2">Structured assessment of 15 key mobility tasks</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Instructions & Guidance */}
        <Collapsible defaultOpen={true}>
          <CollapsibleTrigger className="flex items-center gap-2 font-semibold text-slate-900 hover:bg-slate-50 p-2 rounded">
            <ChevronDown className="w-4 h-4" /> Instructions & Clinical Guidance
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-4">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="scoring">Scoring</TabsTrigger>
                <TabsTrigger value="interpretation">Interpretation</TabsTrigger>
                <TabsTrigger value="references">References</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <Info className="w-5 h-5" /> Assessment Overview
                  </h4>
                  <div className="space-y-3 text-sm text-blue-800">
                    <p>
                      The Rivermead Mobility Index (RMI) is a 15-item observational assessment that measures functional mobility.
                    </p>
                    <p>
                      <strong>Purpose:</strong> To assess the ability to perform key mobility tasks essential for independent living, including transfers, balance, and walking on various surfaces.
                    </p>
                    <p>
                      <strong>Population:</strong> Originally developed for stroke survivors but applicable to various conditions affecting mobility (e.g., neurological, orthopedic, geriatric).
                    </p>
                    <p>
                      <strong>Duration:</strong> Typically 10â€“15 minutes depending on client capability.
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="scoring" className="mt-4 space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-3">Scoring Instructions</h4>
                  <div className="space-y-4 text-sm text-green-800">
                    <div>
                      <p className="font-semibold mb-2">Scoring Method (Yes/No):</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li><strong>1 Point:</strong> Client can perform the task (unaided or with minimal assistance)</li>
                        <li><strong>0 Points:</strong> Client cannot perform the task or requires significant assistance</li>
                      </ul>
                    </div>
                    <div className="pt-2 border-t border-green-300">
                      <p className="font-semibold mb-2">Administration Guidelines:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Observe or ask client to demonstrate each task</li>
                        <li>Score based on actual performance, not potential ability</li>
                        <li>Document any assistance required (verbal cues, physical support)</li>
                        <li>Ensure safety throughout assessment</li>
                        <li>Stop task if client is fatigued or at risk of falls</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="interpretation" className="mt-4 space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-3">Interpretation Guidelines</h4>
                  <div className="space-y-3 text-sm text-purple-800">
                    <p>
                      <strong>Total Score Range:</strong> 0â€“15 points (higher = better mobility)
                    </p>
                    <div className="grid gap-2 pt-2">
                      <div className="bg-white border border-purple-200 rounded p-3">
                        <p className="font-semibold text-red-700">0â€“6: Poor Mobility</p>
                        <p className="text-xs mt-1">Significant functional limitations; dependent for most activities</p>
                      </div>
                      <div className="bg-white border border-purple-200 rounded p-3">
                        <p className="font-semibold text-amber-700">7â€“11: Limited Mobility</p>
                        <p className="text-xs mt-1">Moderate functional limitations; partial independence with some tasks</p>
                      </div>
                      <div className="bg-white border border-purple-200 rounded p-3">
                        <p className="font-semibold text-green-700">12â€“15: Good Mobility</p>
                        <p className="text-xs mt-1">Minimal limitations; independent in most mobility tasks</p>
                      </div>
                    </div>
                    <p className="pt-2 text-xs italic">
                      Use scores to guide rehabilitation planning and monitor progress over time.
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="references" className="mt-4 space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-900 mb-3">References & Evidence</h4>
                  <div className="space-y-2 text-sm">
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/1748779/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-amber-700 hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Collen FM, et al. (1991). The Rivermead Mobility Index: A further development
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/8063304/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-amber-700 hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Foley NC, et al. (1994). Reliability of the Rivermead Mobility Index
                    </a>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CollapsibleContent>
        </Collapsible>

        {/* Task Scoring */}
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Mobility Tasks (15 Items)</span>
              <span className="text-sm font-normal text-slate-600">{completedTasks}/15 scored</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {RMI_TASKS.map((task) => (
                <div key={task.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <Checkbox
                    id={`task-${task.id}`}
                    checked={taskScores[task.id] === 1}
                    onCheckedChange={(checked) => handleTaskChange(task.id, checked)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor={`task-${task.id}`} className="font-semibold text-slate-900 cursor-pointer">
                      {task.id}. {task.name}
                    </Label>
                    <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                  </div>
                  <div className="text-xs font-semibold text-slate-500 mt-1">
                    {taskScores[task.id] === 1 ? (
                      <span className="text-green-600">âœ“ Yes</span>
                    ) : taskScores[task.id] === 0 ? (
                      <span className="text-red-600">âœ— No</span>
                    ) : (
                      <span className="text-slate-400">â€”</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Score Summary */}
        {completedTasks > 0 && (
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-300">
            <CardHeader>
              <CardTitle className="text-center">Current Score Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-white rounded-lg border border-blue-200">
                  <p className="text-xs text-slate-600 font-semibold">Total Score</p>
                  <p className="text-3xl font-bold text-blue-600">{totalScore}/15</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border border-purple-200">
                  <p className="text-xs text-slate-600 font-semibold">Percentage</p>
                  <p className="text-3xl font-bold text-purple-600">{Math.round((totalScore / 15) * 100)}%</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-600 font-semibold">Mobility Level</p>
                  <p className={`text-sm font-bold ${
                    totalScore <= 6 ? "text-red-600" :
                    totalScore <= 11 ? "text-amber-600" :
                    "text-green-600"
                  }`}>
                    {getMobilityLevel(totalScore)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clinical Notes */}
        <div>
          <Label htmlFor="notes" className="font-semibold block mb-2">Clinical Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Record observations about task performance, compensatory strategies, balance concerns, fall risk, or environmental modifications needed..."
            rows={4}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save RMI Results
          </Button>
        </div>
      </div>
    </div>
  );
}