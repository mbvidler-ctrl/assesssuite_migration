import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle, ExternalLink, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function RepeatedSprintAbilityTest7x35mRunner({ client, onSave, onClose }) {
  const [sprintTimes, setSprintTimes] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentSprint, setCurrentSprint] = useState(1);
  const [totalTime, setTotalTime] = useState(0);
  const [bestTime, setBestTime] = useState(null);
  const [notes, setNotes] = useState("");
  const [isTestCompleted, setIsTestCompleted] = useState(false);

  useEffect(() => {
    if (sprintTimes.length === 7) {
      setIsTestCompleted(true);
    }
  }, [sprintTimes]);

  const handleStartTest = () => {
    setIsRunning(true);
    setCurrentSprint(1);
    setSprintTimes([]);
    setTotalTime(0);
    setBestTime(null);
    setIsTestCompleted(false);
    toast.success("Test started. Sprint 1: Ready.");
  };

  const handleStopTest = () => {
    setIsRunning(false);
    setIsTestCompleted(false);
    toast.success("Test stopped.");
  };

  const handleSprintTime = (time) => {
    if (isRunning && currentSprint <= 7) {
      const newSprintTimes = [...sprintTimes, time];
      setSprintTimes(newSprintTimes);
      setTotalTime(totalTime + time);
      setBestTime(Math.min(...newSprintTimes));
      setCurrentSprint(currentSprint + 1);
      toast.success(`Sprint ${currentSprint} completed. Rest for 25â€“30 seconds.`);
    }
  };

  const handleSave = () => {
    if (isTestCompleted) {
      const fatigueIndex = calculateFatigueIndex();
      const resultValue = totalTime;
      const additionalData = {
        measurement_type: "repeated_sprint_ability_test",
        fatigue_index: fatigueIndex,
        best_time: bestTime,
        total_time: totalTime,
        sprint_times: sprintTimes,
      };
      onSave({
        status: "completed",
        result_value: resultValue,
        additional_data: additionalData,
        notes,
        assessment_date: new Date().toISOString().split("T")[0],
      });
      toast.success("Test results saved.");
    } else {
      toast.error("Test is not completed. Please finish all sprints before saving.");
    }
  };

  const calculateFatigueIndex = () => {
    const bestSprintTime = Math.min(...sprintTimes);
    const totalSprintTime = sprintTimes.reduce((acc, time) => acc + time, 0);
    return ((totalSprintTime - bestSprintTime * 7) / (bestSprintTime * 7)) * 100;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        {/* Header */}
        <div className="border-b pb-4">
          <h1 className="text-3xl font-bold text-slate-900">Repeated Sprint Ability Test â€“ 7 x 35 m</h1>
          <p className="text-slate-600 mt-2">Assessment of maximal sprint speed and fatigue resistance over extended distance</p>
        </div>

        {/* Instructions & Clinical Guidance */}
        <Collapsible defaultOpen={true}>
          <CollapsibleTrigger className="flex items-center gap-2 font-semibold text-slate-900 hover:bg-slate-50 p-2 rounded">
            <ChevronDown className="w-4 h-4" /> Instructions & Clinical Guidance
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-4">
            <Tabs defaultValue="setup" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="setup">Setup</TabsTrigger>
                <TabsTrigger value="protocol">Protocol</TabsTrigger>
                <TabsTrigger value="interpretation">Interpretation</TabsTrigger>
                <TabsTrigger value="references">References</TabsTrigger>
              </TabsList>

              <TabsContent value="setup" className="mt-4 space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Test Setup</h4>
                  <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside">
                    <li>Mark a 35-meter course (starting line and turning line)</li>
                    <li>Use cones or tape to clearly mark the 35-meter distance</li>
                    <li>Ensure adequate space for safe sprinting and turning</li>
                    <li>Have timing equipment ready (stopwatch or electronic timer)</li>
                    <li>Ensure surface is non-slip and safe for high-speed running</li>
                  </ul>
                </div>
              </TabsContent>

              <TabsContent value="protocol" className="mt-4 space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-2">Test Protocol</h4>
                  <div className="space-y-3 text-sm text-green-800">
                    <p><strong>Warm-up:</strong> 5 minutes of light aerobic activity and dynamic stretching</p>
                    <p><strong>Test Procedure:</strong></p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Client performs maximal sprint from start to 35m line and back (70m total)</li>
                      <li>Record sprint time to nearest 0.01 second</li>
                      <li>25â€“30 second passive rest period between sprints</li>
                      <li>Repeat for 7 consecutive maximal sprints</li>
                    </ul>
                    <p><strong>Effort:</strong> Client should perform each sprint at maximum effort</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="interpretation" className="mt-4 space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-2">Interpretation</h4>
                  <div className="space-y-2 text-sm text-purple-800">
                    <p><strong>Peak Sprint Time:</strong> Fastest sprintâ€”indicates maximum speed at longer distance</p>
                    <p><strong>Mean Sprint Time:</strong> Average across all sprintsâ€”reflects overall sprint capacity</p>
                    <p><strong>Fatigue Index (%):</strong> ((Total Time âˆ’ Best Time Ã— 7) / (Best Time Ã— 7)) Ã— 100</p>
                    <p className="mt-3">
                      <strong>Fatigue Index Reference:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>&lt;5%: Excellent fatigue resistance</li>
                      <li>5â€“10%: Good fatigue resistance</li>
                      <li>&gt;10%: Poor fatigue resistance</li>
                    </ul>
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
                      Glaister M. (2005). Multiple-sprint work: Physiological responses, mechanisms of fatigue
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/16940694/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-amber-700 hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Impellizzeri FM, et al. (2006). Physiological assessment of high-performance athletes
                    </a>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CollapsibleContent>
        </Collapsible>

        <Card>
        <CardHeader>
          <CardTitle>Test Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>Perform maximal sprint efforts, recording time for each sprint.</p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between items-center gap-3 pt-4 border-t">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onClose}
            title="Close"
          >
            <X className="w-4 h-4" />
          </Button>
          <Button
            variant="default"
            onClick={handleStartTest}
            disabled={isRunning || isTestCompleted}
            title="Start test"
          >
            <Play className="w-4 h-4 mr-2" />
            Start
          </Button>
          <Button
            variant="destructive"
            onClick={handleStopTest}
            disabled={!isRunning || isTestCompleted}
            title="Stop test"
          >
            <X className="w-4 h-4 mr-2" />
            Stop
          </Button>
        </div>
        <Button
          variant="default"
          onClick={handleSave}
          disabled={!isTestCompleted}
          className="bg-green-600 hover:bg-green-700"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Results
        </Button>
      </div>

      {/* Results Summary */}
      {isTestCompleted && (
        <Card className="bg-green-50 border-green-300">
          <CardHeader>
            <CardTitle className="text-green-900">Test Completed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>Total Time:</strong> {totalTime.toFixed(2)} seconds</p>
            <p><strong>Best Sprint Time:</strong> {bestTime.toFixed(2)} seconds</p>
            <p><strong>Fatigue Index:</strong> {calculateFatigueIndex().toFixed(2)}%</p>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <div>
        <Label htmlFor="notes" className="font-semibold">Clinical Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Record sprint technique, fatigue patterns, environmental conditions..."
          className="mt-2"
        />
      </div>
      </div>
    </div>
  );
}