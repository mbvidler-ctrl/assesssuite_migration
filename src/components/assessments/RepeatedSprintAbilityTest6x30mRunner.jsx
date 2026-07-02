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

export default function RepeatedSprintAbilityTest6x30mRunner({ client, onSave, onClose }) {
  const [sprintTimes, setSprintTimes] = useState([]);
  const [preTestVitals, setPreTestVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [postTestVitals, setPostTestVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [isRunning, setIsRunning] = useState(false);
  const [currentSprint, setCurrentSprint] = useState(1);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (sprintTimes.length === 6) {
      const bestTime = Math.min(...sprintTimes);
      const totalTime = sprintTimes.reduce((acc, time) => acc + time, 0);
      const meanTime = totalTime / 6;
      const performanceDecrement = ((totalTime / (bestTime * 6)) - 1) * 100;

      const resultValue = {
        bestSprintTime: bestTime,
        meanSprintTime: meanTime,
        performanceDecrement,
      };

      const additionalData = {
        measurementType: "repeated_sprint_ability_test",
        preTestVitals,
        postTestVitals,
        sprintTimes,
      };

      onSave({
        status: "completed",
        resultValue,
        additionalData,
        notes,
        assessmentDate: new Date().toISOString().split("T")[0],
      });
    }
  }, [sprintTimes, preTestVitals, postTestVitals, onSave, notes]);

  const handleStartTest = () => {
    if (!preTestVitals.heartRate || !preTestVitals.bloodPressure) {
      toast.error("Please enter pre-test vitals.");
      return;
    }
    setIsRunning(true);
    setCurrentSprint(1);
    setSprintTimes([]);
    setNotes("");
    toast.success("Test started. Please record each sprint time.");
  };

  const handleStopTest = () => {
    setIsRunning(false);
    setCurrentSprint(1);
    toast.success("Test stopped.");
  };

  const handleSprintTimeChange = (e) => {
    const time = parseFloat(e.target.value);
    if (!isNaN(time) && time > 0) {
      setSprintTimes((prevTimes) => {
        const newTimes = [...prevTimes];
        newTimes[currentSprint - 1] = time;
        return newTimes;
      });
    }
  };

  const handleNextSprint = () => {
    if (currentSprint < 6) {
      setCurrentSprint((prevSprint) => prevSprint + 1);
    } else {
      toast.success("All sprints completed.");
      setIsRunning(false);
    }
  };

  const handlePreTestVitalsChange = (e) => {
    const { name, value } = e.target;
    setPreTestVitals((prevVitals) => ({
      ...prevVitals,
      [name]: value,
    }));
  };

  const handlePostTestVitalsChange = (e) => {
    const { name, value } = e.target;
    setPostTestVitals((prevVitals) => ({
      ...prevVitals,
      [name]: value,
    }));
  };

  const handleNotesChange = (e) => {
    setNotes(e.target.value);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        {/* Header */}
        <div className="border-b pb-4">
          <h1 className="text-3xl font-bold text-slate-900">Repeated Sprint Ability Test â€“ 6 x 30 m</h1>
          <p className="text-slate-600 mt-2">Assessment of maximal sprint speed and repeated sprint fatigue resistance over longer distances</p>
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
                    <li>Mark a 30-meter course (starting line and turning line)</li>
                    <li>Use cones or tape to clearly mark the 30-meter distance</li>
                    <li>Ensure adequate space for safe sprinting and turning</li>
                    <li>Have timing equipment ready (stopwatch or electronic timer)</li>
                    <li>Ensure surface is non-slip and safe for high-speed running</li>
                    <li>Place recovery area with seating nearby for post-test vitals</li>
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
                      <li>Client performs maximal sprint from start to 30m line and back (60m total)</li>
                      <li>Record sprint time to nearest 0.01 second</li>
                      <li>25-second passive rest period between sprints</li>
                      <li>Repeat for 6 consecutive maximal sprints</li>
                    </ul>
                    <p><strong>Effort:</strong> Client should perform each sprint at maximum effort with complete recovery between sprints</p>
                    <p><strong>Post-Test:</strong> Record heart rate and blood pressure within 2 minutes of test completion</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="interpretation" className="mt-4 space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-2">Interpretation</h4>
                  <div className="space-y-2 text-sm text-purple-800">
                    <p><strong>Peak Sprint Time:</strong> Fastest sprintâ€”indicates maximum explosive power for longer distance</p>
                    <p><strong>Mean Sprint Time:</strong> Average across all 6 sprintsâ€”reflects overall sprint capacity</p>
                    <p><strong>Performance Decrement (%):</strong> (Total Time / (Best Time Ã— 6) âˆ’ 1) Ã— 100 â†’ Indicates fatigue resistance</p>
                    <p className="mt-3">
                      <strong>Performance Decrement Reference:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>&lt;5%: Excellent fatigue resistance</li>
                      <li>5â€“10%: Good fatigue resistance</li>
                      <li>&gt;10%: Poor fatigue resistance</li>
                    </ul>
                    <p className="mt-3">
                      <strong>Typical Values:</strong> Elite male athletes average 4.0â€“4.2 seconds per 30m sprint with &lt;5% decrement
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
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/12708646/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-amber-700 hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Buchheit M, et al. (2010). Repeated-sprint sequences during youth soccer matches
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
          <div className="space-y-4">
            <div>
              <Label>Pre-Test Vitals</Label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  name="heartRate"
                  value={preTestVitals.heartRate}
                  onChange={handlePreTestVitalsChange}
                  placeholder="Heart Rate (bpm)"
                  disabled={isRunning}
                />
                <Input
                  type="text"
                  name="bloodPressure"
                  value={preTestVitals.bloodPressure}
                  onChange={handlePreTestVitalsChange}
                  placeholder="Blood Pressure (mmHg)"
                  disabled={isRunning}
                />
              </div>
            </div>
            <div>
              <Label>Post-Test Vitals</Label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  name="heartRate"
                  value={postTestVitals.heartRate}
                  onChange={handlePostTestVitalsChange}
                  placeholder="Heart Rate (bpm)"
                  disabled={isRunning}
                />
                <Input
                  type="text"
                  name="bloodPressure"
                  value={postTestVitals.bloodPressure}
                  onChange={handlePostTestVitalsChange}
                  placeholder="Blood Pressure (mmHg)"
                  disabled={isRunning}
                />
              </div>
            </div>
            <div>
              <Label>Sprint {currentSprint} Time (seconds)</Label>
              <Input
                type="number"
                value={sprintTimes[currentSprint - 1] || ""}
                onChange={handleSprintTimeChange}
                placeholder="Enter time"
                disabled={!isRunning}
              />
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="default"
                onClick={handleStartTest}
                disabled={isRunning}
                className="flex items-center space-x-2"
              >
                <Play className="h-4 w-4" />
                <span>Start Test</span>
              </Button>
              <Button
                variant="destructive"
                onClick={handleStopTest}
                disabled={!isRunning}
                className="flex items-center space-x-2"
              >
                <X className="h-4 w-4" />
                <span>Stop Test</span>
              </Button>
              {isRunning && (
                <Button
                  variant="secondary"
                  onClick={handleNextSprint}
                  className="flex items-center space-x-2"
                >
                  <span>Next Sprint</span>
                </Button>
              )}
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={handleNotesChange}
                placeholder="Enter any additional notes"
                disabled={isRunning}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Badge variant="outline">Category: Cardio-Pulmonary</Badge>
        <Badge variant="outline">Unit: Seconds</Badge>
      </div>
      </div>
    </div>
  );
}