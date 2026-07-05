import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle, ChevronDown, ChevronUp, BookOpen, Plus } from "lucide-react";
import { toast } from "sonner";

export default function TimedPushUpTestPressUpTestRunner({ client, onSave, onClose }) {
  const [showInstructions, setShowInstructions] = useState(false);
  const [phase, setPhase] = useState('vitals'); // vitals, testing, completed
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [pushUpCount, setPushUpCount] = useState(0);
  const [notes, setNotes] = useState("");
  const [qualityNotes, setQualityNotes] = useState("");

  // Pre-test vitals
  const [restingHR, setRestingHR] = useState("");
  const [restingBP, setRestingBP] = useState("");
  const [restingSPO2, setRestingSPO2] = useState("");

  // Post-test vitals
  const [postHR, setPostHR] = useState("");
  const [postBP, setPostBP] = useState("");
  const [postSPO2, setPostSPO2] = useState("");

  useEffect(() => {
    let timer;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      setPhase('completed');
      toast.success("Test completed. Record post-test vitals and save.");
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  const handleStartTest = () => {
    if (!restingHR || !restingBP || !restingSPO2) {
      toast.error("Please record all pre-test vitals before starting.");
      return;
    }
    setPhase('testing');
    setIsRunning(true);
    setTimeLeft(60);
    setPushUpCount(0);
    toast.info("Test started. Perform as many push-ups as possible.");
  };

  const handleStopTest = () => {
    setIsRunning(false);
    setPhase('completed');
    toast.success("Test stopped. Record post-test vitals.");
  };

  const handlePushUp = () => {
    if (isRunning) {
      setPushUpCount((prevCount) => prevCount + 1);
    }
  };

  const handleSave = () => {
    if (!postHR || !postBP || !postSPO2) {
      toast.error("Please record all post-test vitals.");
      return;
    }

    const result_value = pushUpCount;
    const additional_data = {
      measurement_type: "Timed Push-Up Test",
      duration_seconds: 60 - timeLeft,
      pre_test: { restingHR, restingBP, restingSPO2 },
      post_test: { postHR, postBP, postSPO2 },
      quality_observations: qualityNotes,
    };

    onSave({
      status: "completed",
      result_value,
      additional_data,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Results saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-4xl w-full my-4 space-y-4">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 rounded-t-lg">
          <h2 className="text-2xl font-bold">Timed Push-Up Test (Press-Up Test)</h2>
          <p className="text-slate-300 text-sm mt-1">Muscular endurance assessment</p>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)] px-6 py-4">
          {/* Instructions */}
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="w-full mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between hover:bg-blue-100 transition"
          >
            <div className="flex items-center gap-2 text-blue-900 font-semibold">
              <BookOpen className="w-5 h-5" />
              Clinician Instructions
            </div>
            {showInstructions ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {showInstructions && (
            <Card className="mb-4 border-blue-200 bg-blue-50">
              <CardContent className="pt-6 text-sm text-slate-700 space-y-3">
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Purpose:</h4>
                  <p>Assess upper body muscular endurance and strength through maximum repetitions of properly executed push-ups in a timed interval.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Equipment Required:</h4>
                  <p>Exercise mat or clean floor, stopwatch, step/bench (optional for modified form)</p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Starting Position:</h4>
                  <p>Hands shoulder-width apart, body in straight line from head to heels, weight on hands and toes (or knees for modified form). Elbows extended.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Test Protocol:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Lower body by bending elbows until chest nearly touches floor</li>
                    <li>Push back up to starting position</li>
                    <li>Count only repetitions with proper form</li>
                    <li>Continue for 60 seconds or until failure</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Scoring:</h4>
                  <p>Total number of correctly executed push-ups completed. Higher repetitions indicate better upper body muscular endurance.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Safety Considerations:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Stop if participant experiences pain or significant dyspnoea</li>
                    <li>Monitor for form degradation as fatigue increases</li>
                    <li>Ensure proper spine alignment throughout</li>
                  </ul>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mt-3">
                  <p className="text-yellow-800"><strong>Reference:</strong> Australian Society of Physiotherapy (ASP). (2021). Upper Limb Functional Testing in Clinical Practice.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {phase === 'vitals' && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-lg">Pre-Test Vitals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Resting HR (bpm)</Label>
                    <Input
                      type="number"
                      value={restingHR}
                      onChange={(e) => setRestingHR(e.target.value)}
                      placeholder="e.g., 72"
                    />
                  </div>
                  <div>
                    <Label>Resting BP (mmHg)</Label>
                    <Input
                      type="text"
                      value={restingBP}
                      onChange={(e) => setRestingBP(e.target.value)}
                      placeholder="e.g., 120/80"
                    />
                  </div>
                  <div>
                    <Label>Resting SpO₂ (%)</Label>
                    <Input
                      type="number"
                      value={restingSPO2}
                      onChange={(e) => setRestingSPO2(e.target.value)}
                      placeholder="e.g., 98"
                    />
                  </div>
                </div>
                <Button onClick={handleStartTest} className="w-full bg-green-600 hover:bg-green-700">
                  <Play className="w-4 h-4 mr-2" />
                  Start Test
                </Button>
              </CardContent>
            </Card>
          )}

          {phase === 'testing' && (
            <Card className="mb-4 border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-lg text-green-900">Test in Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center space-y-4">
                  <div className="bg-white p-6 rounded-lg border-2 border-green-300">
                    <p className="text-sm text-slate-600 mb-2">Time Remaining</p>
                    <p className="text-5xl font-bold text-green-600">{timeLeft}s</p>
                  </div>
                  <div className="bg-white p-6 rounded-lg border-2 border-green-300">
                    <p className="text-sm text-slate-600 mb-2">Push-Ups Completed</p>
                    <p className="text-5xl font-bold text-slate-900">{pushUpCount}</p>
                  </div>
                </div>
                <Button
                  onClick={handlePushUp}
                  className="w-full h-16 bg-slate-900 hover:bg-slate-800 text-lg font-semibold"
                  disabled={!isRunning}
                >
                  <Plus className="w-6 h-6 mr-2" />
                  Record Push-Up
                </Button>
                <Button onClick={handleStopTest} variant="outline" className="w-full">
                  Stop Test
                </Button>
              </CardContent>
            </Card>
          )}

          {phase === 'completed' && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-lg">Post-Test Vitals & Quality Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <Label>Post HR (bpm)</Label>
                    <Input
                      type="number"
                      value={postHR}
                      onChange={(e) => setPostHR(e.target.value)}
                      placeholder="e.g., 110"
                    />
                  </div>
                  <div>
                    <Label>Post BP (mmHg)</Label>
                    <Input
                      type="text"
                      value={postBP}
                      onChange={(e) => setPostBP(e.target.value)}
                      placeholder="e.g., 130/85"
                    />
                  </div>
                  <div>
                    <Label>Post SpO₂ (%)</Label>
                    <Input
                      type="number"
                      value={postSPO2}
                      onChange={(e) => setPostSPO2(e.target.value)}
                      placeholder="e.g., 97"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="quality">Form Quality Observations</Label>
                  <Textarea
                    id="quality"
                    value={qualityNotes}
                    onChange={(e) => setQualityNotes(e.target.value)}
                    placeholder="e.g., Form degradation after 45s, elbows not full extension, poor control..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Clinical Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional observations, modifications used, client feedback..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-slate-50 px-6 py-4 rounded-b-lg flex justify-between items-center gap-3">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          {phase === 'completed' && (
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              <Save className="mr-2 h-4 w-4" />
              Save Results
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}