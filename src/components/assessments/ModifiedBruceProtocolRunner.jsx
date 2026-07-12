import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, ChevronDown, ChevronUp, AlertTriangle, Info, ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function ModifiedBruceProtocolRunner({ client, onSave, onClose }) {
  const [preTestVitals, setPreTestVitals] = useState({
    heartRate: "",
    bloodPressure: "",
    weight: "",
    height: "",
  });
  const [stageData, setStageData] = useState([]);
  const [postTestVitals, setPostTestVitals] = useState({
    heartRate: "",
    bloodPressure: "",
    reasonForStop: "",
  });
  const [notes, setNotes] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [stageTime, setStageTime] = useState(0);
  const [expandedSection, setExpandedSection] = useState("instructions");

  const stages = [
    { number: 1, speed: 1.7, grade: 0, duration: 3 },
    { number: 2, speed: 1.7, grade: 5, duration: 3 },
    { number: 3, speed: 1.7, grade: 10, duration: 3 },
    { number: 4, speed: 2.5, grade: 12, duration: 3 },
    { number: 5, speed: 3.4, grade: 14, duration: 3 },
    { number: 6, speed: 4.2, grade: 16, duration: 3 },
    { number: 7, speed: 5.0, grade: 18, duration: 3 },
    { number: 8, speed: 5.5, grade: 20, duration: 3 },
    { number: 9, speed: 6.0, grade: 22, duration: 3 },
  ];

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => setStageTime(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleStart = () => {
    if (!preTestVitals.heartRate || !preTestVitals.bloodPressure) {
      toast.error("Please enter pre-test vitals.");
      return;
    }
    setIsRunning(true);
    setCurrentStage(0);
    setStageTime(0);
    setStageData([]);
    toast.success("Test started. Begin stage 1.");
  };

  const handleAddStageData = () => {
    const stage = stages[currentStage];
    const hrInput = document.getElementById(`stageHR_${currentStage}`)?.value;
    
    if (!hrInput) {
      toast.error("Please enter heart rate for this stage.");
      return;
    }

    const newStageData = {
      stage: stage.number,
      speed: stage.speed,
      grade: stage.grade,
      duration: stageTime,
      heartRate: parseInt(hrInput),
      rpe: document.getElementById(`stageRPE_${currentStage}`)?.value || "-",
    };

    setStageData(prev => [...prev, newStageData]);

    if (currentStage < stages.length - 1) {
      setCurrentStage(prev => prev + 1);
      setStageTime(0);
      toast.success(`Stage ${stage.number} complete. Ready for stage ${stage.number + 1}.`);
    } else {
      setIsRunning(false);
      toast.success("All stages completed. Enter post-test vitals and save.");
    }
  };

  const handleStopTest = () => {
    setIsRunning(false);
    toast.info("Test stopped early. Enter post-test vitals and reason.");
  };

  const handleSave = () => {
    if (!postTestVitals.heartRate || !postTestVitals.bloodPressure) {
      toast.error("Please enter post-test vitals.");
      return;
    }
    if (stageData.length === 0) {
      toast.error("Please complete at least one stage.");
      return;
    }

    const totalTime = stageData.reduce((acc, s) => acc + s.duration, 0);
    const maxStage = stageData[stageData.length - 1].stage;
    const finalHR = stageData[stageData.length - 1].heartRate;
    
    const stageDetails = stageData.map(s => 
      `  Stage ${s.stage}: ${s.speed} mph @ ${s.grade}% — HR: ${s.heartRate} bpm, Time: ${s.duration}s, RPE: ${s.rpe}`
    ).join("\n");

    const stopReason = isRunning ? "Patient-initiated stop" : (postTestVitals.reasonForStop || "Completed all stages");

    const soapText = `• Modified Bruce Protocol Test
  Total Duration: ${totalTime} seconds (${(totalTime / 60).toFixed(1)} minutes)
  Stages Completed: ${maxStage} of 9
  Stop Reason: ${stopReason}

Pre-Test Vitals:
  Heart Rate: ${preTestVitals.heartRate} bpm
  Blood Pressure: ${preTestVitals.bloodPressure} mmHg
  Weight: ${preTestVitals.weight ? preTestVitals.weight + ' kg' : 'Not recorded'}
  Height: ${preTestVitals.height ? preTestVitals.height + ' cm' : 'Not recorded'}

Stage Data:
${stageDetails}

Post-Test Vitals:
  Heart Rate: ${postTestVitals.heartRate} bpm
  Blood Pressure: ${postTestVitals.bloodPressure} mmHg
  Heart Rate Recovery: ${Math.max(0, finalHR - parseInt(postTestVitals.heartRate))} bpm

Interpretation:
  • Modified Bruce test suitable for deconditioned/elderly populations
  • Patient tolerated ${maxStage}/9 stages before ${stopReason.toLowerCase()}
  • ${maxStage >= 5 ? "Good exercise tolerance achieved" : maxStage >= 3 ? "Moderate exercise tolerance" : "Limited exercise tolerance"}
  • HR response: ${finalHR <= 85 ? 'Normal' : 'Elevated'}, Recovery: ${postTestVitals.heartRate < finalHR ? 'Normal' : 'Delayed'}${notes ? `

Additional Notes:
  ${notes}` : ''}

Reference: Bruce RA (1973); ACSM Guidelines for Exercise Testing and Prescription (11th ed., 2022)`;

    onSave({
      status: "completed",
      result_value: maxStage,
      additional_data: {
        soap_text: soapText,
        stageData,
        preTestVitals,
        postTestVitals,
        totalTime,
        maxStage,
      },
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("Test data saved to SOAP notes.");
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-5 border-b bg-gradient-to-r from-sky-50 to-blue-50 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Modified Bruce Protocol Test</h2>
            <p className="text-slate-500 text-sm mt-0.5">Treadmill exercise test with extended warm-up stages</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Collapsible Clinician Instructions */}
          <button
            className="w-full flex justify-between items-center px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg font-semibold text-blue-900 hover:bg-blue-100 transition-colors"
            onClick={() => setExpandedSection(expandedSection === "instructions" ? null : "instructions")}
          >
            <span>📋 Clinician Instructions & Evidence</span>
            {expandedSection === "instructions" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expandedSection === "instructions" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-3">
              <div>
                <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Test Overview</p>
                <p className="mt-1"><strong>Modified vs Standard Bruce:</strong> The Modified Bruce protocol includes two warm-up stages (1.7 mph @ 0% and 1.7 mph @ 5%) before the standard Bruce begins. This gentle introduction makes it suitable for elderly, deconditioned, post-MI, or cardiac populations who may not tolerate the abrupt intensity of the standard protocol.</p>
              </div>

              <div>
                <p className="font-semibold">Administration Protocol</p>
                <ul className="text-xs list-disc list-inside space-y-1 mt-1">
                  <li><strong>Each stage duration:</strong> 3 minutes (allows steady-state HR/BP response)</li>
                  <li><strong>Speed/Grade progression:</strong> Increases with each stage (see stage table below)</li>
                  <li><strong>Heart rate:</strong> Record at end of each stage (last 15 seconds)</li>
                  <li><strong>Blood pressure:</strong> Record at baseline, midway through test, and at termination</li>
                  <li><strong>RPE (Rate of Perceived Exertion):</strong> Use Borg 6–20 scale (or 0–10 modified scale)</li>
                  <li><strong>Patient instruction:</strong> "Walk at a comfortable pace. Speed and incline will increase every 3 minutes. Tell me immediately if you feel chest pain, shortness of breath, dizziness, or fatigue."</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold">Stop Criteria (Absolute)</p>
                <ul className="text-xs list-disc list-inside space-y-1 mt-1 text-red-700">
                  <li>Chest pain or pressure</li>
                  <li>Severe dyspnoea or breathlessness preventing conversation</li>
                  <li>Dizziness, lightheadedness, or confusion</li>
                  <li>Significant drop in systolic BP (≥10 mmHg from peak despite increased workload)</li>
                  <li>ST segment depression ≥2 mm (if ECG monitored)</li>
                  <li>Ventricular arrhythmias or heart rate {">"}220 bpm (or age-predicted max)</li>
                  <li>Patient request/volitional fatigue</li>
                  <li>Clinician concern for safety</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold">Modified Bruce Stage Table</p>
                <div className="overflow-x-auto text-xs mt-2">
                  <table className="w-full border border-slate-300">
                    <thead className="bg-slate-200"><tr><th className="p-2">Stage</th><th className="p-2">Speed (mph)</th><th className="p-2">Grade (%)</th><th className="p-2">Duration</th><th className="p-2">Notes</th></tr></thead>
                    <tbody>
                      <tr className="border-t"><td className="p-2">1–2</td><td className="p-2 text-center">1.7</td><td className="p-2 text-center">0, 5</td><td className="p-2">3 min</td><td className="p-2">Warm-up (Modified only)</td></tr>
                      <tr className="border-t bg-blue-100"><td className="p-2">3–9</td><td className="p-2">2.5–6.0</td><td className="p-2">10–22</td><td className="p-2">3 min</td><td className="p-2">Standard Bruce (3-min stages)</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="font-semibold">VO2max Estimation & Normative Data (ACSM)</p>
                <div className="overflow-x-auto text-xs mt-2">
                  <table className="w-full border border-slate-300">
                    <thead className="bg-slate-200"><tr><th className="p-2">Fitness Category</th><th className="p-2">Men 20–39</th><th className="p-2">Men 40–59</th><th className="p-2">Women 20–39</th><th className="p-2">Women 40–59</th></tr></thead>
                    <tbody>
                      <tr className="border-t"><td className="p-2">Excellent</td><td className="p-2 text-center">≥52</td><td className="p-2 text-center">≥45</td><td className="p-2 text-center">≥41</td><td className="p-2 text-center">≥35</td></tr>
                      <tr className="border-t bg-white"><td className="p-2">Good</td><td className="p-2 text-center">43–51</td><td className="p-2 text-center">38–44</td><td className="p-2 text-center">35–40</td><td className="p-2 text-center">29–34</td></tr>
                      <tr className="border-t"><td className="p-2">Fair</td><td className="p-2 text-center">34–42</td><td className="p-2 text-center">30–37</td><td className="p-2 text-center">27–34</td><td className="p-2 text-center">23–28</td></tr>
                      <tr className="border-t bg-white"><td className="p-2">Poor</td><td className="p-2 text-center">≤33</td><td className="p-2 text-center">≤29</td><td className="p-2 text-center">≤26</td><td className="p-2 text-center">≤22</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-600 mt-2">Values in ml/kg/min. Use regression equations or nomograms to estimate VO2max from final stage achieved and duration.</p>
              </div>

              <div>
                <p className="font-semibold">Evidence & Clinical Utility</p>
                <ul className="text-xs list-disc list-inside space-y-1 mt-1">
                  <li><strong>Risk stratification:</strong> Identifies high-risk patients for CAD, arrhythmias, and poor prognosis in cardiac rehabilitation settings</li>
                  <li><strong>Functional capacity:</strong> Stage achieved predicts work capacity and ADL tolerance</li>
                  <li><strong>Diagnostic accuracy:</strong> ECG changes, BP drop, symptom cluster (chest pain + ST depression) = ↑ pretest probability of CAD</li>
                  <li><strong>Prognostic value:</strong> Early termination ({"<"}5 min) associated with ↑ mortality risk; good functional capacity (&ge;10 min) = favorable prognosis</li>
                  <li><strong>Modality choice:</strong> Treadmill preferred over cycle ergometer for functional relevance (walking); modified Bruce for safety in deconditioned populations</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold">External Resources</p>
                <div className="space-y-1 text-xs mt-2">
                  <p>
                    <strong>ACSM Guidelines for Exercise Testing & Prescription (11th ed., 2022):</strong>{" "}
                    <a href="https://www.acsm.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                      www.acsm.org <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                  <p>
                    <strong>Original Bruce Protocol (1973):</strong> Bruce RA, Kusumi F, Hosmer D. <em>American Heart Journal, 85</em>(4):546–562.
                  </p>
                  <p>
                    <strong>Exercise Testing Nomogram:</strong> Download calculator at{" "}
                    <a href="https://www.acsm.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                      ACSM <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pre-Test Vitals */}
          {!isRunning && stageData.length === 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Pre-Test Vitals</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Heart Rate (bpm)</Label>
                  <Input
                    type="number"
                    value={preTestVitals.heartRate}
                    onChange={(e) => setPreTestVitals({ ...preTestVitals, heartRate: e.target.value })}
                    placeholder="60–100 bpm typical"
                  />
                </div>
                <div>
                  <Label>Blood Pressure (mmHg)</Label>
                  <Input
                    type="text"
                    value={preTestVitals.bloodPressure}
                    onChange={(e) => setPreTestVitals({ ...preTestVitals, bloodPressure: e.target.value })}
                    placeholder="e.g., 120/80"
                  />
                </div>
                <div>
                  <Label>Weight (kg)</Label>
                  <Input
                    type="number"
                    value={preTestVitals.weight}
                    onChange={(e) => setPreTestVitals({ ...preTestVitals, weight: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Height (cm)</Label>
                  <Input
                    type="number"
                    value={preTestVitals.height}
                    onChange={(e) => setPreTestVitals({ ...preTestVitals, height: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Test */}
          {isRunning && (
            <Card className="border-2 border-blue-400 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg text-blue-900">
                  Stage {stages[currentStage].number}: {stages[currentStage].speed} mph @ {stages[currentStage].grade}%
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-4xl font-bold text-blue-600 text-center">{formatTime(stageTime)}</div>
                <p className="text-center text-sm text-slate-600">Elapsed Time (target: 180s per stage)</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Heart Rate at End of Stage (bpm)</Label>
                    <Input
                      id={`stageHR_${currentStage}`}
                      type="number"
                      placeholder="Record final 15s HR"
                    />
                  </div>
                  <div>
                    <Label>RPE (Borg 6–20 or 0–10)</Label>
                    <Input
                      id={`stageRPE_${currentStage}`}
                      type="text"
                      placeholder="e.g., 11 or 5/10"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAddStageData} className="flex-1 bg-green-600 hover:bg-green-700">
                    <Play className="w-4 h-4 mr-2" />
                    {currentStage < stages.length - 1 ? `Next Stage` : "Complete"}
                  </Button>
                  <Button onClick={handleStopTest} variant="destructive" className="flex-1">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Stop Test
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Completed Stages Summary */}
          {stageData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Completed Stages</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full">
                    <thead className="bg-slate-100"><tr><th className="p-2 text-left">Stage</th><th className="p-2 text-center">Speed (mph)</th><th className="p-2 text-center">Grade (%)</th><th className="p-2 text-center">HR (bpm)</th><th className="p-2 text-center">RPE</th><th className="p-2 text-center">Duration</th></tr></thead>
                    <tbody>
                      {stageData.map((s, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{s.stage}</td>
                          <td className="p-2 text-center">{s.speed}</td>
                          <td className="p-2 text-center">{s.grade}</td>
                          <td className="p-2 text-center font-semibold">{s.heartRate}</td>
                          <td className="p-2 text-center">{s.rpe}</td>
                          <td className="p-2 text-center">{s.duration}s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Post-Test Vitals */}
          {!isRunning && stageData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Post-Test Vitals & Reason for Stopping</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Heart Rate (bpm)</Label>
                  <Input
                    type="number"
                    value={postTestVitals.heartRate}
                    onChange={(e) => setPostTestVitals({ ...postTestVitals, heartRate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Blood Pressure (mmHg)</Label>
                  <Input
                    type="text"
                    value={postTestVitals.bloodPressure}
                    onChange={(e) => setPostTestVitals({ ...postTestVitals, bloodPressure: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Reason for Stopping (if early termination)</Label>
                  <Textarea
                    value={postTestVitals.reasonForStop}
                    onChange={(e) => setPostTestVitals({ ...postTestVitals, reasonForStop: e.target.value })}
                    placeholder="e.g., Fatigue, chest pain, dizziness, BP drop, patient request..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Clinical Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ST changes, arrhythmias, patient behavior, blood pressure pattern, exercise-induced symptoms..."
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <div className="flex gap-2">
            {!isRunning && stageData.length === 0 && (
              <Button onClick={handleStart} className="bg-blue-600 hover:bg-blue-700">
                <Play className="w-4 h-4 mr-2" />
                Start Test
              </Button>
            )}
            {stageData.length > 0 && !isRunning && (
              <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                <Save className="w-4 h-4 mr-2" />
                Save Results
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}