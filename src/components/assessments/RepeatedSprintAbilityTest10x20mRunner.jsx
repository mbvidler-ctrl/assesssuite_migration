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

export default function RepeatedSprintAbilityTest10x20mRunner({ client, onSave, onClose }) {
  const [sprintTimes, setSprintTimes] = useState(Array(10).fill(""));
  const [isRunning, setIsRunning] = useState(false);
  const [currentSprint, setCurrentSprint] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [bestTime, setBestTime] = useState(null);
  const [notes, setNotes] = useState("");
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    if (currentSprint > 0) {
      const newTotalTime = sprintTimes.slice(0, currentSprint).reduce((acc, time) => acc + parseFloat(time), 0);
      setTotalTime(newTotalTime);
      setBestTime(Math.min(...sprintTimes.slice(0, currentSprint).map(time => parseFloat(time))));
    }
  }, [sprintTimes, currentSprint]);

  const handleStart = () => {
    setIsRunning(true);
    setCurrentSprint(0);
    setSprintTimes(Array(10).fill(""));
    setTotalTime(0);
    setBestTime(null);
    setNotes("");
    setIsValid(true);
  };

  const handleStop = () => {
    setIsRunning(false);
    if (currentSprint > 0) {
      const decrement = ((totalTime / (bestTime * 10)) * 100) - 100;
      const resultValue = {
        totalTime,
        bestTime,
        decrement,
      };
      const additionalData = {
        measurement_type: "repeated_sprint_ability_test",
        sprint_times: sprintTimes,
      };
      onSave({ status: "completed", result_value: resultValue, additional_data: additionalData, notes, assessment_date: new Date().toISOString().split("T")[0] });
      toast.success("Test completed successfully.");
    } else {
      toast.error("No sprints recorded. Please start the test first.");
    }
  };

  const handleSprintTimeChange = (index, value) => {
    const newSprintTimes = [...sprintTimes];
    newSprintTimes[index] = value;
    setSprintTimes(newSprintTimes);
    setIsValid(newSprintTimes.every(time => time !== ""));
  };

  const handleNotesChange = (event) => {
    setNotes(event.target.value);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        {/* Header */}
        <div className="border-b pb-4">
          <h1 className="text-3xl font-bold text-slate-900">Repeated Sprint Ability Test – 10 x 20 m</h1>
          <p className="text-slate-600 mt-2">Assessment of maximum sprint speed and repeated fatigue resistance over shorter, high-frequency sprints</p>
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
                    <li>Mark a 20-meter course (starting line and turning line)</li>
                    <li>Use cones or tape to clearly mark the 20-meter distance</li>
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
                      <li>Client performs maximal sprint from start to 20m line and back (40m total)</li>
                      <li>Record sprint time to nearest 0.01 second</li>
                      <li>20–30 second passive rest period between sprints</li>
                      <li>Repeat for 10 consecutive maximal sprints</li>
                    </ul>
                    <p><strong>Effort:</strong> Client should perform each sprint at maximum effort with complete recovery between sprints</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="interpretation" className="mt-4 space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-2">Interpretation</h4>
                  <div className="space-y-2 text-sm text-purple-800">
                    <p><strong>Peak Sprint Time:</strong> Fastest sprint—indicates maximum explosive power at short distance</p>
                    <p><strong>Mean Sprint Time:</strong> Average across all 10 sprints—reflects overall sprint capacity</p>
                    <p><strong>Performance Decrement (%):</strong> (Total Time / (Best Time × 10) − 1) × 100 → Indicates fatigue resistance</p>
                    <p className="mt-3">
                      <strong>Decrement Reference:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>&lt;5%: Excellent fatigue resistance</li>
                      <li>5–10%: Good fatigue resistance</li>
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
          <CardTitle>Sprint Times (10 Sprints)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Enter the time (in seconds) for each maximal 20-meter sprint. Each sprint should be performed with maximum effort, followed by a 20–30 second recovery.
          </p>
          <div className="mt-4">
            {Array.from({ length: 10 }, (_, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Label htmlFor={`sprint-${index + 1}`} className="w-24">
                  Sprint {index + 1} (s)
                </Label>
                <Input
                  id={`sprint-${index + 1}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={sprintTimes[index]}
                  onChange={(e) => handleSprintTimeChange(index, e.target.value)}
                  disabled={isRunning}
                  className="w-24"
                />
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Label htmlFor="notes" className="font-semibold block mb-2">Clinical Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={handleNotesChange}
              disabled={isRunning}
              placeholder="Record sprint technique, fatigue patterns, environmental conditions..."
              rows={3}
            />
          </div>
          </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between items-center gap-3 pt-4 border-t">
          <div className="flex gap-2">
          <Button
            onClick={handleStart}
            disabled={isRunning}
            variant="default"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Test
          </Button>
          <Button
            onClick={handleStop}
            disabled={!isRunning || !isValid}
            variant="default"
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Complete Test
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
          >
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          </div>
          </div>
          {!isValid && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertTriangle className="inline-block w-4 h-4 mr-2" />
          Please enter times for all 10 sprints before completing the test.
          </div>
          )}
      </div>
    </div>
  );
}