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
import { todayLocal } from "@/lib/localDate";

export default function RepeatedSprintAbilityTestShuttle1515mRunner({ client, onSave, onClose }) {
  const [preTestVitals, setPreTestVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [postTestVitals, setPostTestVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [sprintTimes, setSprintTimes] = useState([]);
  const [currentSprint, setCurrentSprint] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(20);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        if (isResting) {
          if (restTime > 0) {
            setRestTime((prev) => prev - 1);
          } else {
            setIsResting(false);
            setRestTime(20);
            setSprintTimes((prev) => [...prev, { sprint: currentSprint, time: 0 }]);
            setCurrentSprint((prev) => prev + 1);
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isRunning, isResting, restTime, currentSprint]);

  const handleStart = () => {
    if (!preTestVitals.heartRate || !preTestVitals.bloodPressure) {
      toast.error("Please enter pre-test vital signs.");
      return;
    }
    setIsRunning(true);
    setIsResting(false);
    setSprintTimes([]);
    setCurrentSprint(1);
    toast.info("Test started. Sprint 1 in progress.");
  };

  const handleStop = () => {
    setIsRunning(false);
    setIsResting(false);
    setRestTime(20);
    toast.success("Test stopped.");
  };

  const handleSave = () => {
    if (sprintTimes.length === 0) {
      toast.error("No sprint data to save.");
      return;
    }
    const bestSprint = Math.min(...sprintTimes.map((s) => s.time));
    const totalSprintTime = sprintTimes.reduce((acc, s) => acc + s.time, 0);
    const resultValue = totalSprintTime / sprintTimes.length;
    const additionalData = {
      measurement_type: "repeated_sprint_ability_test",
      sprint_times: sprintTimes,
      best_sprint_time: bestSprint,
      total_sprint_time: totalSprintTime,
    };
    onSave({
      status: "completed",
      result_value: resultValue,
      additional_data: additionalData,
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("Test data saved.");
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        {/* Header */}
        <div className="border-b pb-4">
          <h1 className="text-3xl font-bold text-slate-900">Repeated Sprint Ability Test – Shuttle (15 + 15 m)</h1>
          <p className="text-slate-600 mt-2">Assessment of repeated sprint anaerobic capacity and fatigue resistance</p>
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
                    <li>Mark a 15-meter course (starting line and turning line)</li>
                    <li>Use cones or tape to clearly mark the 15-meter distance</li>
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
                      <li>Client performs maximal sprint from start to 15m line and back (30m total)</li>
                      <li>Record sprint time to nearest 0.01 second</li>
                      <li>20-second passive rest period between sprints</li>
                      <li>Repeat for 6–10 consecutive sprints</li>
                    </ul>
                    <p><strong>Effort:</strong> Client should perform each sprint at maximum effort</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="interpretation" className="mt-4 space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-2">Interpretation</h4>
                  <div className="space-y-2 text-sm text-purple-800">
                    <p><strong>Peak Sprint Time:</strong> Fastest sprint—indicates maximum explosive power</p>
                    <p><strong>Mean Sprint Time:</strong> Average across all sprints—reflects overall sprint capacity</p>
                    <p><strong>Fatigue Index (%):</strong> (Mean Time − Best Time) / Best Time × 100 → Indicates fatigue resistance</p>
                    <p className="mt-3">
                      <strong>Fatigue Index Reference:</strong>
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
                      Glaister M. (2005). Multiple-sprint work: Physiological responses, mechanisms of fatigue and the influence of aerobic fitness
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/16940694/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-amber-700 hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Impellizzeri FM, et al. (2006). Physiological assessment of high-performance rugby players
                    </a>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CollapsibleContent>
        </Collapsible>

        {/* Test Data Card */}
        <Card>
        <CardHeader>
          <CardTitle>Test Data & Vitals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Pre-Test Heart Rate</Label>
              <Input
                type="number"
                value={preTestVitals.heartRate}
                onChange={(e) => setPreTestVitals({ ...preTestVitals, heartRate: e.target.value })}
                placeholder="Enter heart rate"
              />
            </div>
            <div>
              <Label>Pre-Test Blood Pressure</Label>
              <Input
                type="text"
                value={preTestVitals.bloodPressure}
                onChange={(e) => setPreTestVitals({ ...preTestVitals, bloodPressure: e.target.value })}
                placeholder="Enter blood pressure"
              />
            </div>
          </div>
          <div className="mt-4">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any additional notes"
            />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-between items-center">
        <div>
          <Badge variant="outline" className="mr-2">
            Sprint {currentSprint}
          </Badge>
          <Badge variant="outline">
            {isResting ? `Resting: ${restTime}s` : `Running: ${restTime}s`}
          </Badge>
        </div>
        <div>
          <Button
            variant="default"
            className="mr-2"
            onClick={handleStart}
            disabled={isRunning}
            leftIcon={<Play />}
          >
            Start Test
          </Button>
          <Button
            variant="destructive"
            className="mr-2"
            onClick={handleStop}
            disabled={!isRunning}
            leftIcon={<X />}
          >
            Stop Test
          </Button>
          <Button
            variant="secondary"
            onClick={handleSave}
            disabled={sprintTimes.length === 0}
            leftIcon={<Save />}
          >
            Save Data
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}