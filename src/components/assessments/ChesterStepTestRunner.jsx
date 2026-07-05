import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle, Info, Zap, Heart, Trash2, Clock, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";

function InlineTimer({ stageNumber, onDone }) {
  const [seconds, setSeconds] = useState(180);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isActive) return;
    if (seconds <= 0) {
      toast.success("Stage complete! Record HR and RPE.");
      onDone();
      return;
    }
    const interval = setInterval(() => setSeconds(s => s - 1), 1000);
    return () => clearInterval(interval);
  }, [isActive, seconds]);

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className={`text-5xl font-bold font-mono ${isActive ? 'text-orange-600' : 'text-slate-400'}`}>
        {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>
      {isActive && (
        <Button variant="outline" size="sm" onClick={() => { setIsActive(false); onDone(); }}>
          I'm Done Early
        </Button>
      )}
      {!isActive && seconds > 0 && (
        <p className="text-sm text-slate-500">Timer stopped — enter HR and RPE below</p>
      )}
    </div>
  );
}

export default function ChesterStepTestRunner({ client, onSave, onClose }) {
  const [age, setAge] = useState("");
  const [stepHeight, setStepHeight] = useState(20);
  const [stages, setStages] = useState([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [currentStageHR, setCurrentStageHR] = useState("");
  const [currentStageRPE, setCurrentStageRPE] = useState("");
  const [showTimer, setShowTimer] = useState(false);
  const [notes, setNotes] = useState("");
  const [showInfo, setShowInfo] = useState(false);

  const predictedMaxHR = age ? 220 - parseInt(age) : null;
  const targetHRRange = predictedMaxHR ? [Math.round(predictedMaxHR * 0.7), Math.round(predictedMaxHR * 0.8)] : null;

  const handleStartTest = () => {
    if (!age || isNaN(age) || age <= 0) {
      toast.error("Please enter a valid age.");
      return;
    }
    setIsTestRunning(true);
    setStages([{ stage: 1, hr: "", rpe: "" }]);
    setCurrentStageIndex(0);
    setCurrentStageHR("");
    setCurrentStageRPE("");
    setShowTimer(true);
  };

  const handleAddStage = () => {
    if (!currentStageHR || !currentStageRPE) {
      toast.error("Please enter HR and RPE for current stage before progressing.");
      return;
    }

    // Check if HR reached target range
    const hr = parseInt(currentStageHR);
    if (targetHRRange && hr >= targetHRRange[1]) {
      toast.info("Target HR range reached. You may stop or continue for one more stage.");
    }

    // Add current stage data
    const newStages = [...stages];
    newStages[currentStageIndex] = {
      stage: currentStageIndex + 1,
      hr: currentStageHR,
      rpe: currentStageRPE
    };
    setStages(newStages);

    // Move to next stage
    const nextStageIndex = currentStageIndex + 1;
    const nextStageNum = nextStageIndex + 1;
    
    if (nextStageNum > 5) {
      toast.warning("Maximum 5 stages reached. Please save results.");
      setCurrentStageIndex(nextStageIndex - 1);
      return;
    }

    newStages.push({ stage: nextStageNum, hr: "", rpe: "" });
    setStages(newStages);
    setCurrentStageIndex(nextStageIndex);
    setCurrentStageHR("");
    setCurrentStageRPE("");
    setShowTimer(true);
  };

  const handleStopTest = () => {
    if (currentStageHR && currentStageRPE) {
      const newStages = [...stages];
      newStages[currentStageIndex] = {
        stage: currentStageIndex + 1,
        hr: currentStageHR,
        rpe: currentStageRPE
      };
      setStages(newStages);
    }
    setIsTestRunning(false);
    toast.success("Test stopped.");
  };

  const handleDeleteStage = (index) => {
    const newStages = stages.filter((_, i) => i !== index);
    setStages(newStages);
    if (currentStageIndex >= newStages.length) {
      setCurrentStageIndex(Math.max(0, newStages.length - 1));
    }
  };

  const handleSave = () => {
    const completedStages = stages.filter(s => s.hr && s.rpe);
    if (completedStages.length === 0) {
      toast.error("Please complete at least one stage with HR and RPE.");
      return;
    }

    // Use final HR for result_value (must be a number)
    const finalStage = completedStages[completedStages.length - 1];
    const resultValue = finalStage.hr ? parseFloat(finalStage.hr) : 0;

    // Format stages data
    const stagesText = completedStages.map(s => 
      `  Stage ${s.stage}: HR ${s.hr} bpm, RPE ${s.rpe}`
    ).join('\n');

    const additionalData = {
      soap_text: `• Chester Step Test (Step Height: ${stepHeight} cm):\n${stagesText}${notes ? `\n\n  Clinical Notes: ${notes}` : ''}`,
      stages: completedStages,
      stepHeight,
      predictedMaxHR,
      stagesCompleted: completedStages.length
    };

    onSave({
      result_value: resultValue,
      additional_data: additionalData,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-orange-50 to-red-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Chester Step Test</h2>
              <p className="text-slate-600 mt-1">Progressive multi-stage aerobic fitness assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Quick Reference */}
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
                  <Info className="w-5 h-5" />
                  Protocol Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>3 minutes per stage</strong> at progressively increasing intensity</p>
                <p><strong>Record HR at end of each stage:</strong> Measure 15 sec pulse × 4</p>
                <p><strong>Record RPE on Borg scale</strong> (6-20)</p>
                <p><strong>Stop when:</strong> HR ≥80% max HR ({targetHRRange ? `${targetHRRange[1]} bpm` : 'N/A'}) or client unable to continue</p>
                {predictedMaxHR && <p className="font-semibold mt-2">Predicted Max HR: {predictedMaxHR} bpm | Target Range: {targetHRRange[0]}-{targetHRRange[1]} bpm</p>}
              </CardContent>
            </Card>

            {/* Collapsible Info Panel */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between bg-slate-50 px-4 py-3 text-left"
                onClick={() => setShowInfo(!showInfo)}
              >
                <span className="font-semibold text-slate-800 text-sm">📋 Equipment, Administration & References</span>
                {showInfo ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
              </button>

              {showInfo && (
                <div className="px-4 py-4 space-y-4 text-sm bg-white">

                  <div>
                    <h4 className="font-semibold text-slate-800 mb-1">Purpose</h4>
                    <p className="text-slate-700">The Chester Step Test (CST) is a submaximal, multi-stage exercise test used to estimate aerobic fitness (VO₂max) from heart rate responses to stepping. It is safe, low-cost, and suitable for a wide range of populations including occupational and clinical groups.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-800 mb-1">Equipment Required</h4>
                    <ul className="list-disc list-inside text-slate-700 space-y-1">
                      <li>Step box (15, 20, 25, or 30 cm — select based on fitness level)</li>
                      <li><strong>Metronome</strong> (audible beep, app, or YouTube video to maintain cadence — <em>audio is not required</em>; can use visual timing or silent counting)</li>
                      <li>Heart rate monitor or manually count pulse (15 sec × 4)</li>
                      <li>Stopwatch or timer for 3-minute stages</li>
                      <li>Borg RPE scale (6–20) — visible to client</li>
                    </ul>
                  </div>

                  {/* Step Height Visual */}
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-2">Step Height Guide</h4>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      {[
                        { h: 15, label: "Low fitness / elderly / rehab" },
                        { h: 20, label: "Standard (most adults)" },
                        { h: 25, label: "Active adults" },
                        { h: 30, label: "High fitness / athletes" },
                      ].map(({ h, label }) => (
                        <div key={h} className={`rounded-lg border p-2 ${stepHeight === h ? "border-orange-400 bg-orange-50" : "border-slate-200 bg-slate-50"}`}>
                          <div className="font-bold text-lg text-slate-800">{h} cm</div>
                          <div className="text-slate-500 leading-tight mt-1">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-800 mb-1">Stage Cadences (steps/min)</h4>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 px-2 py-1 text-left">Stage</th>
                          <th className="border border-slate-300 px-2 py-1 text-center">Cadence (steps/min)</th>
                          <th className="border border-slate-300 px-2 py-1 text-center">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          [1, 15], [2, 20], [3, 25], [4, 30], [5, 35]
                        ].map(([stage, cadence], i) => (
                          <tr key={stage} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                            <td className="border border-slate-300 px-2 py-1">Stage {stage}</td>
                            <td className="border border-slate-300 px-2 py-1 text-center">{cadence}</td>
                            <td className="border border-slate-300 px-2 py-1 text-center">3 min</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-800 mb-1">Borg RPE Scale (6–20)</h4>
                    <div className="grid grid-cols-5 gap-1 text-xs text-center">
                      {[
                        [6, "No exertion", "bg-green-100"], [8, "Very light", "bg-green-100"],
                        [11, "Light", "bg-yellow-100"], [13, "Somewhat hard", "bg-orange-100"],
                        [15, "Hard", "bg-red-100"], [17, "Very hard", "bg-red-200"],
                        [19, "Extreme", "bg-red-300"], [20, "Max", "bg-red-400"],
                      ].map(([val, label, bg]) => (
                        <div key={val} className={`rounded p-1 border border-slate-200 ${bg}`}>
                          <div className="font-bold">{val}</div>
                          <div className="text-slate-600 leading-tight">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-800 mb-1">Stop Criteria</h4>
                    <ul className="list-disc list-inside text-slate-700 space-y-1">
                      <li>HR ≥ 80% of predicted maximum (220 − age)</li>
                      <li>RPE ≥ 17 (Very hard)</li>
                      <li>Client cannot maintain cadence</li>
                      <li>Chest pain, dizziness, or syncope</li>
                      <li>Client requests to stop</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-800 mb-2">Instructional Video & References</h4>
                    <div className="space-y-1.5">
                      <a href="https://www.youtube.com/results?search_query=Chester+Step+Test+protocol" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 underline">
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        Search: Chester Step Test demonstration (YouTube)
                      </a>
                      <a href="https://www.sralab.org/rehabilitation-measures/chester-step-test" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 underline">
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        Shirley Ryan AbilityLab – Chester Step Test
                      </a>
                      <a href="https://www.physio-pedia.com/Chester_Step_Test" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 underline">
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        Physiopedia – Chester Step Test
                      </a>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Sykes K. (1998). The Chester Step Test: a simple yet effective tool for the prediction of aerobic capacity. <em>Physiotherapy, 84</em>(8), 395–402.</p>
                  </div>

                </div>
              )}
            </div>

            {/* Test Parameters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="age">Age (years)</Label>
                  <Input
                    id="age"
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Enter age"
                    disabled={isTestRunning}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Step Height</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[15, 20, 25, 30].map((height) => (
                      <Button
                        key={height}
                        variant={stepHeight === height ? "default" : "outline"}
                        onClick={() => setStepHeight(height)}
                        disabled={isTestRunning}
                      >
                        {height} cm
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Typically 20 cm; adjust based on client fitness level</p>
                </div>
              </CardContent>
            </Card>

            {/* Stage Data Collection */}
            {isTestRunning && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="text-lg">Stage {currentStageIndex + 1}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {showTimer && (
                    <InlineTimer
                      stageNumber={currentStageIndex + 1}
                      onDone={() => setShowTimer(false)}
                    />
                  )}
                  {!showTimer && <p className="text-sm text-orange-700">Timer complete — enter HR and RPE below</p>}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="stage-hr" className="flex items-center gap-2">
                        <Heart className="w-4 h-4" />
                        Heart Rate (bpm)
                      </Label>
                      <Input
                        id="stage-hr"
                        type="number"
                        value={currentStageHR}
                        onChange={(e) => setCurrentStageHR(e.target.value)}
                        placeholder="Enter HR"
                        className="mt-1"
                      />
                      <p className="text-xs text-slate-500 mt-1">15 sec pulse × 4</p>
                    </div>
                    <div>
                      <Label htmlFor="stage-rpe" className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        RPE (Borg 6-20)
                      </Label>
                      <Input
                        id="stage-rpe"
                        type="number"
                        value={currentStageRPE}
                        onChange={(e) => setCurrentStageRPE(e.target.value)}
                        placeholder="6-20"
                        min="6"
                        max="20"
                        className="mt-1"
                      />
                      <p className="text-xs text-slate-500 mt-1">Perceived exertion</p>
                    </div>
                  </div>

                  {currentStageHR && (
                    <div className={`p-3 rounded ${
                      parseInt(currentStageHR) >= targetHRRange?.[1] 
                        ? 'bg-yellow-100 border border-yellow-300' 
                        : 'bg-green-100 border border-green-300'
                    }`}>
                      <p className="text-sm font-semibold">
                        {parseInt(currentStageHR) >= targetHRRange?.[1]
                          ? '⚠ï¸ Target HR reached or exceeded'
                          : '✓ HR within safe range'
                        }
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddStage}
                      disabled={!currentStageHR || !currentStageRPE || stages.length >= 5}
                      className="flex-1"
                    >
                      Next Stage →
                    </Button>
                    <Button
                      onClick={handleStopTest}
                      variant="destructive"
                      className="flex-1"
                    >
                      Stop Test
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Completed Stages Summary */}
            {stages.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Stages Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stages.map((stage, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                        <div>
                          <p className="font-semibold">Stage {stage.stage}</p>
                          {stage.hr && stage.rpe && (
                            <p className="text-sm text-slate-600">
                              HR: {stage.hr} bpm | RPE: {stage.rpe}
                              {parseInt(stage.hr) >= targetHRRange?.[1] && (
                                <span className="ml-2 text-yellow-600 font-semibold">• Target reached</span>
                              )}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStage(idx)}
                          disabled={isTestRunning}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Clinical Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reason for stopping, client symptoms, movement quality, any concerns..."
                  rows={3}
                  className="text-sm"
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex flex-wrap justify-between items-center gap-3">
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              {isTestRunning ? `Stage ${currentStageIndex + 1} Running` : `${stages.length} stages completed`}
            </Badge>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!isTestRunning && (
              <Button
                variant="default"
                onClick={handleStartTest}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Test
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={isTestRunning || stages.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Results
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}