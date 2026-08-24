import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle, Info, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { scoreYmcaCycle } from "@/lib/clinical/scorers/extrasBodyFitness";

const colorForClassification = (classification) => {
  switch (classification) {
    case "Excellent":
      return "border-green-300 bg-green-50";
    case "Good":
      return "border-blue-300 bg-blue-50";
    case "Fair":
      return "border-amber-300 bg-amber-50";
    case "Poor":
      return "border-red-300 bg-red-50";
    default:
      return "border-slate-300 bg-slate-50";
  }
};

// ─── COMPONENT ──────────────────────────────────────────────────────────────
export default function YMCACycleErgometerProtocolRunner({ client, onSave, onClose }) {
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [workload, setWorkload] = useState(25);
  const [stage, setStage] = useState(1);
  const [heartRates, setHeartRates] = useState([]);
  const [workloads, setWorkloads] = useState([]);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [timer, setTimer] = useState(0);
  const [rpe, setRpe] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");
  const [testComplete, setTestComplete] = useState(false);
  const [vo2maxResult, setVo2maxResult] = useState(null);
  const [showProtocol, setShowProtocol] = useState(true);

  useEffect(() => {
    if (isTestRunning) {
      const interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isTestRunning]);

  const handleStartTest = () => {
    if (!age || !weight || !gender) {
      toast.error("Please enter age, weight, and gender.");
      return;
    }
    setIsTestRunning(true);
    setHeartRates([]);
    setWorkloads([]);
    setTimer(0);
    setStage(1);
    setWorkload(25);
    setTestComplete(false);
  };

  const handleStopTest = () => {
    setIsTestRunning(false);
    setTimer(0);
    setStage(1);
    setWorkload(25);
  };

  const handleHeartRateSubmit = () => {
    if (!heartRate) {
      toast.error("Please enter heart rate.");
      return;
    }
    const hrNum = parseInt(heartRate);
    const newHeartRates = [...heartRates, hrNum];
    const newWorkloads = [...workloads, workload];
    setHeartRates(newHeartRates);
    setWorkloads(newWorkloads);
    setHeartRate("");

    // Check for steady-state (HR diff ≤5 bpm) at 110–150 bpm
    if (newHeartRates.length >= 2) {
      const [prevHR, currHR] = newHeartRates.slice(-2);
      const diff = Math.abs(currHR - prevHR);
      
      if (currHR >= 110 && currHR <= 150 && diff <= 5 && newHeartRates.length >= 2) {
        // Steady-state achieved
        setIsTestRunning(false);
        calculateResult(newHeartRates, newWorkloads);
        return;
      }
    }

    // Progress to next stage
    if (newHeartRates.length < 4) {
      setStage(stage + 1);
      setWorkload(workload + 25);
    }
  };

  const calculateResult = (finalHeartRates, finalWorkloads) => {
    try {
      const payload = scoreYmcaCycle({ age, weight_kg: weight, gender, heart_rates: finalHeartRates, workloads: finalWorkloads }, { assessmentName: "Allied Submaximal Cycle Ergometer VO2 Assessment", client });
      setVo2maxResult({
        vo2Max: payload.additional_data.vo2max,
        heartRates: payload.additional_data.heartRates,
        workloads: payload.additional_data.workloads,
        maxHeartRate: payload.additional_data.maxHeartRate,
        lastWorkload: payload.additional_data.lastWorkload,
        age: Number(age),
        weight: Number(weight),
        gender,
        classification: payload.additional_data.classification,
      });
      setTestComplete(true);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleSaveResult = () => {
    if (!vo2maxResult) return;
    try {
      onSave(scoreYmcaCycle({ age: vo2maxResult.age, weight_kg: vo2maxResult.weight, gender: vo2maxResult.gender, heart_rates: vo2maxResult.heartRates, workloads: vo2maxResult.workloads, rpe, symptoms, notes }, { assessmentName: "Allied Submaximal Cycle Ergometer VO2 Assessment", client }));
      toast.success("Assessment saved.");
      setTimeout(() => onClose(), 500);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const mins = Math.floor(timer / 60);
  const secs = String(timer % 60).padStart(2, "0");

  // ─── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-t-2xl px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-bold">Allied Submaximal Cycle Ergometer VO2 Assessment</h2>
            <p className="text-teal-100 text-sm mt-1">Multi-stage cardiovascular fitness prediction using heart rate response</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">

          {/* IP Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>This assessment is independently developed and does not reproduce YMCA proprietary manuals or materials.</p>
          </div>

          {/* Result Display */}
          {testComplete && vo2maxResult && (
            <>
              <Card className={`border-2 ${colorForClassification(vo2maxResult.classification)}`}>
                <CardHeader>
                  <CardTitle>Test Results — Estimated VO2max</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-slate-600 mb-2">Predicted VO2max</p>
                    <p className="text-5xl font-bold text-slate-900">{vo2maxResult.vo2Max}</p>
                    <p className="text-base text-slate-600 mt-1">ml/kg/min</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-slate-200 text-center">
                    <Badge className={`text-sm px-3 py-1 ${
                      vo2maxResult.classification === "Excellent" ? "bg-green-600" :
                      vo2maxResult.classification === "Good" ? "bg-blue-600" :
                      vo2maxResult.classification === "Fair" ? "bg-amber-600" :
                      "bg-red-600"
                    }`}>
                      {vo2maxResult.classification} Aerobic Fitness
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="p-3 bg-slate-50 rounded border border-slate-200">
                      <p className="text-xs text-slate-600">Age</p>
                      <p className="font-semibold text-lg">{vo2maxResult.age}</p>
                      <p className="text-xs text-slate-500">years</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded border border-slate-200">
                      <p className="text-xs text-slate-600">Weight</p>
                      <p className="font-semibold text-lg">{vo2maxResult.weight}</p>
                      <p className="text-xs text-slate-500">kg</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded border border-slate-200">
                      <p className="text-xs text-slate-600">Final Workload</p>
                      <p className="font-semibold text-lg">{vo2maxResult.lastWorkload}</p>
                      <p className="text-xs text-slate-500">W</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded border border-slate-200">
                      <p className="text-xs text-slate-600">Max Predicted HR</p>
                      <p className="font-semibold text-lg">{vo2maxResult.maxHeartRate}</p>
                      <p className="text-xs text-slate-500">bpm</p>
                    </div>
                  </div>
                  <div className="p-3 bg-teal-50 rounded border border-teal-200">
                    <p className="text-xs font-semibold text-slate-700 mb-2">Heart Rate & Workload Progression</p>
                    <div className="space-y-1">
                      {vo2maxResult.workloads.map((w, i) => (
                        <p key={i} className="text-sm text-teal-800">
                          Stage {i + 1}: {w}W → {vo2maxResult.heartRates[i]} bpm
                        </p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Clinical Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Clinical observations, exercise tolerance, perceived exertion, safety concerns..."
                    rows={4}
                  />
                </CardContent>
              </Card>
            </>
          )}

          {/* Test Interface */}
          {!testComplete && (
            <>
              {/* Protocol Instructions */}
              <div className="border border-blue-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowProtocol(v => !v)}
                  className="w-full flex justify-between items-center bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900 hover:bg-blue-100 transition-colors"
                >
                  <span>📋 Clinician Instructions & Protocol</span>
                  {showProtocol ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showProtocol && (
                  <div className="p-4 text-sm text-blue-800 space-y-3 bg-blue-50 border-t border-blue-200">
                    <div>
                      <p className="font-semibold">Equipment</p>
                      <ul className="text-xs list-disc list-inside space-y-0.5 text-blue-700 mt-1">
                        <li>Calibrated cycle ergometer (25–250W range)</li>
                        <li>Heart rate monitor or pulse oximeter</li>
                        <li>Stopwatch for 3-minute stage intervals</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold">Procedure</p>
                      <ul className="text-xs list-disc list-inside space-y-0.5 text-blue-700 mt-1">
                        <li>Client cycles through progressive workloads, 3 minutes per stage</li>
                        <li>Maintain constant cadence at 50 rpm</li>
                        <li>Record heart rate during final 30 seconds of each stage</li>
                        <li>Continue until two consecutive steady-state HR values achieved (110–150 bpm, diff ≤5 bpm)</li>
                      </ul>
                    </div>
                    <div className="bg-blue-100 rounded p-2 text-xs italic">
                      "Pedal at a steady pace at 50 rpm. We'll gradually increase the resistance every 3 minutes. Let me know immediately if you experience chest pain, dizziness, or shortness of breath."
                    </div>
                  </div>
                )}
              </div>

              {/* Safety Alert */}
              <Card className="border-red-200 bg-red-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-red-900">
                    <AlertTriangle className="w-5 h-5" />
                    Absolute Contraindications — STOP Test Immediately
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-red-800 space-y-1">
                  <ul className="list-disc list-inside space-y-0.5 text-xs">
                    <li>Chest pain, pressure, or discomfort</li>
                    <li>Severe dyspnea or dizziness</li>
                    <li>Pallor, confusion, or severe fatigue</li>
                    <li>Uncontrolled hypertension (SBP &gt;180, DBP &gt;110)</li>
                    <li>Recent cardiac event or unstable angina</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Data Entry */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Client Data & Test Control</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="age" className="text-xs">Age (years) *</Label>
                      <Input
                        id="age"
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        disabled={isTestRunning}
                        placeholder="e.g., 35"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="weight" className="text-xs">Weight (kg) *</Label>
                      <Input
                        id="weight"
                        type="number"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        disabled={isTestRunning}
                        placeholder="e.g., 75"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="gender" className="text-xs">Gender *</Label>
                      <select
                        id="gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        disabled={isTestRunning}
                        className="mt-1 w-full p-2 border border-input rounded-md text-sm bg-background"
                      >
                        <option value="">Select</option>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </select>
                    </div>
                  </div>

                  {isTestRunning && (
                    <div className="space-y-3 p-4 bg-teal-50 rounded-lg border border-teal-200">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-slate-600 mb-1">Stage</p>
                          <p className="text-2xl font-bold text-teal-700">{stage}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 mb-1">Workload</p>
                          <p className="text-2xl font-bold text-teal-700">{workload}W</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 mb-1">Timer</p>
                          <p className="text-2xl font-bold text-teal-700">{mins}:{secs}</p>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="hr" className="text-sm">Record HR at Stage End (bpm)</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            id="hr"
                            type="number"
                            value={heartRate}
                            onChange={(e) => setHeartRate(e.target.value)}
                            placeholder="e.g., 120"
                          />
                          <Button onClick={handleHeartRateSubmit} className="bg-teal-600 hover:bg-teal-700">
                            Record
                          </Button>
                        </div>
                      </div>

                      {heartRates.length > 0 && (
                        <div className="bg-white p-2 rounded border border-teal-200">
                          <p className="text-xs font-semibold text-slate-700 mb-1">Recorded Heart Rates:</p>
                          <p className="text-sm text-teal-800">
                            {heartRates.map((hr, i) => `${workloads[i]}W→${hr}bpm`).join(" | ")}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">RPE (Borg 0–10)</Label>
                      <Input type="number" min="0" max="10" value={rpe} onChange={(e) => setRpe(e.target.value)} placeholder="0–10" className="mt-1" disabled={isTestRunning} />
                    </div>
                    <div>
                      <Label className="text-xs">Symptoms During Test</Label>
                      <Input value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="e.g., none, dyspnea" className="mt-1" disabled={isTestRunning} />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Clinical Notes</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={isTestRunning}
                      placeholder="Observations, technique, compliance..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>

                  <div className="flex gap-3">
                    {!isTestRunning ? (
                      <Button onClick={handleStartTest} className="flex-1 bg-green-600 hover:bg-green-700 h-10">
                        <Play className="w-4 h-4 mr-2" />
                        Start Test
                      </Button>
                    ) : (
                      <Button onClick={handleStopTest} variant="destructive" className="flex-1 h-10">
                        <X className="w-4 h-4 mr-2" />
                        Stop Test
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* VO2max Norms Reference */}
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">VO2max Classification (ACSM)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-200 border-b-2 border-slate-400">
                          <th className="p-2 text-left font-semibold">Category</th>
                          <th className="p-2 text-center font-semibold">Men 20–39</th>
                          <th className="p-2 text-center font-semibold">Men 40–59</th>
                          <th className="p-2 text-center font-semibold">Women 20–39</th>
                          <th className="p-2 text-center font-semibold">Women 40–59</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { cat: "Excellent", men1: "≥52", men2: "≥45", women1: "≥41", women2: "≥35", bg: "bg-green-50" },
                          { cat: "Good", men1: "43–51", men2: "38–44", women1: "35–40", women2: "29–34", bg: "bg-blue-50" },
                          { cat: "Fair", men1: "34–42", men2: "30–37", women1: "27–34", women2: "23–28", bg: "bg-amber-50" },
                          { cat: "Poor", men1: "≤33", men2: "≤29", women1: "≤26", women2: "≤22", bg: "bg-red-50" },
                        ].map(row => (
                          <tr key={row.cat} className={`border-b ${row.bg}`}>
                            <td className="p-2 font-semibold">{row.cat}</td>
                            <td className="p-2 text-center">{row.men1}</td>
                            <td className="p-2 text-center">{row.men2}</td>
                            <td className="p-2 text-center">{row.women1}</td>
                            <td className="p-2 text-center">{row.women2}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Values in ml/kg/min. Reference: ACSM Guidelines for Exercise Testing & Prescription (11th ed.)</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t bg-slate-50 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          {testComplete && (
            <Button onClick={handleSaveResult} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Save className="w-4 h-4 mr-2" />
              Save Assessment
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
