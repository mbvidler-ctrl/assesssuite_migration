import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Save, X, Play, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// ─── FITNESS CLASSIFICATION (RECOVERY HR) ──────────────────────────────────
const FITNESS_CATEGORIES = {
  male: [
    { label: "Excellent", maxHR: 76 },
    { label: "Good", maxHR: 84 },
    { label: "Average", maxHR: 96 },
    { label: "Below Average", maxHR: 104 },
    { label: "Poor", maxHR: Infinity },
  ],
  female: [
    { label: "Excellent", maxHR: 80 },
    { label: "Good", maxHR: 88 },
    { label: "Average", maxHR: 100 },
    { label: "Below Average", maxHR: 108 },
    { label: "Poor", maxHR: Infinity },
  ],
};

const getCategory = (recoveryHR, sex) => {
  const key = sex === "M" ? "male" : "female";
  const categories = FITNESS_CATEGORIES[key];
  const hr = parseInt(recoveryHR, 10);
  for (const cat of categories) {
    if (hr <= cat.maxHR) return cat.label;
  }
  return "Poor";
};

// ─── COMPONENT ──────────────────────────────────────────────────────────────
export default function YMCA3MinuteStepTestRunner({ client, onSave, onClose }) {
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [stepHeight, setStepHeight] = useState("30");
  const [restingHR, setRestingHR] = useState("");
  const [recoveryHR, setRecoveryHR] = useState("");
  const [rpe, setRpe] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showProtocol, setShowProtocol] = useState(true);

  useEffect(() => {
    if (!isRunning) return;
    if (timer >= 180) {
      setIsRunning(false);
      setIsCompleted(true);
      toast.success("Test complete — record recovery heart rate between 5–20 seconds post-exercise.");
      return;
    }
    const interval = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isRunning, timer]);

  const handleStart = () => {
    if (!age || !sex || !restingHR) {
      toast.error("Please provide age, sex, and resting heart rate.");
      return;
    }
    setTimer(0);
    setIsCompleted(false);
    setRecoveryHR("");
    setIsRunning(true);
    toast.success("Test started — step at approximately 96 bpm cadence. Maintain steady rhythm.");
  };

  const handleStop = () => {
    setIsRunning(false);
    setIsCompleted(true);
    toast.success("Test stopped. Record recovery heart rate.");
  };

  const handleSave = () => {
    if (!recoveryHR) {
      toast.error("Please record recovery heart rate before saving.");
      return;
    }
    const category = getCategory(recoveryHR, sex);
    const soapText = `• Allied 3-Minute Step Recovery Test
  Submaximal cardiovascular recovery and aerobic estimation assessment
  
  CLIENT DETAILS:
  Age: ${age} | Sex: ${sex === "M" ? "Male" : "Female"}
  
  PROTOCOL:
  Step Height: ${stepHeight} cm
  Cadence Target: 96 bpm (24 steps/min — 4-count pattern: up-up-down-down)
  Duration: 3 minutes continuous stepping
  
  VITAL SIGNS:
  Resting HR: ${restingHR} bpm
  Recovery HR (5–20 sec post): ${recoveryHR} bpm
  ${rpe ? `RPE (Borg 0–10): ${rpe}` : ""}
  
  INTERPRETATION:
  Fitness Category: ${category}
  
  CLINICAL NOTES:
  Lower recovery heart rate indicates better cardiovascular efficiency and aerobic fitness.
  Recovery HR of ${recoveryHR} bpm is classified as ${category} fitness for ${sex === "M" ? "male" : "female"} participants.
  ${symptoms ? `Symptoms noted: ${symptoms}` : "No symptoms reported."}
  
  IP STATEMENT:
  This assessment is an independently developed AssessSuite submaximal step recovery test.
  It does not use YMCA branding, copyrighted materials, or proprietary scoring sheets.
  The protocol is based on submaximal exercise physiology principles and recovery heart rate assessment.`;

    onSave({
      status: "completed",
      result_value: parseInt(recoveryHR),
      additional_data: {
        soap_text: soapText,
        measurement_type: "allied_step_recovery_test",
        age,
        sex,
        step_height_cm: parseInt(stepHeight),
        resting_hr: parseInt(restingHR),
        recovery_hr: parseInt(recoveryHR),
        fitness_category: category,
        rpe: rpe ? parseInt(rpe) : null,
        symptoms,
      },
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("Assessment saved.");
  };

  const mins = Math.floor(timer / 60);
  const secs = String(timer % 60).padStart(2, "0");
  const category = recoveryHR ? getCategory(recoveryHR, sex) : null;

  // ─── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <Card className="border-0 rounded-2xl">
          {/* Header */}
          <CardHeader className="bg-gradient-to-r from-teal-600 to-emerald-700 text-white rounded-t-2xl">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl">Allied 3-Minute Step Recovery Test</CardTitle>
                <p className="text-teal-100 text-sm mt-1">Submaximal cardiovascular recovery and aerobic estimation assessment</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-5">

            {/* IP Disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>This is an independently developed AssessSuite assessment. It does not use YMCA branding, copyrighted materials, or proprietary scoring sheets.</p>
            </div>

            {/* Protocol */}
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
                    <p className="font-semibold mb-1">Equipment</p>
                    <ul className="text-xs list-disc list-inside space-y-0.5 text-blue-700">
                      <li>30 cm step (or standard bench)</li>
                      <li>Metronome (set to 96 bpm)</li>
                      <li>Stopwatch or timer</li>
                      <li>Heart rate monitor or pulse palpation</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Procedure</p>
                    <ul className="text-xs list-disc list-inside space-y-0.5 text-blue-700">
                      <li>Client steps continuously for 3 minutes at approximately 96 bpm cadence</li>
                      <li>Pattern: Right foot up, left foot up, right foot down, left foot down (4-count cycle)</li>
                      <li>Maintain consistent stepping rhythm throughout</li>
                      <li>Immediately after stepping, client sits or stands at rest</li>
                      <li>Record recovery heart rate between 5–20 seconds post-test</li>
                    </ul>
                  </div>
                  <div className="bg-blue-100 rounded p-2 text-xs italic">
                    "Step up and down on the step to the beat of the metronome at 96 bpm. Continue stepping for 3 minutes at a steady pace."
                  </div>
                </div>
              )}
            </div>

            {/* Input Section */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Age (years)</Label>
                  <Input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="Age" disabled={isRunning} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Sex</Label>
                  <select value={sex} onChange={e => setSex(e.target.value)} disabled={isRunning} className="mt-1 w-full p-2 border border-input rounded-md text-sm bg-background">
                    <option value="">Select</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Step Height (cm)</Label>
                  <Input type="number" value={stepHeight} onChange={e => setStepHeight(e.target.value)} placeholder="30" disabled={isRunning} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Resting HR (bpm)</Label>
                  <Input type="number" value={restingHR} onChange={e => setRestingHR(e.target.value)} placeholder="bpm" disabled={isRunning} className="mt-1" />
                </div>
              </div>

              {/* Timer & Controls */}
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-4xl font-mono font-bold text-slate-900">{mins}:{secs}</div>
                  <div className="flex gap-2">
                    {isRunning && <Badge className="bg-green-500">Running</Badge>}
                    {isCompleted && <Badge className="bg-blue-500">Completed</Badge>}
                  </div>
                </div>
                <div className="flex gap-2 mb-3">
                  <Button onClick={handleStart} disabled={isRunning || isCompleted} className="bg-teal-600 hover:bg-teal-700">
                    <Play className="w-4 h-4 mr-2" />Start
                  </Button>
                  <Button variant="outline" onClick={handleStop} disabled={!isRunning}>
                    <X className="w-4 h-4 mr-2" />Stop
                  </Button>
                </div>
                {isRunning && (
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-teal-500 h-2 rounded-full transition-all duration-500" style={{ width: `${(timer / 180) * 100}%` }} />
                  </div>
                )}
              </div>

              {/* Recovery HR & Results */}
              {isCompleted && (
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
                  <div>
                    <Label className="text-sm font-semibold">Recovery HR (5–20 sec post-test, bpm)</Label>
                    <Input type="number" value={recoveryHR} onChange={e => setRecoveryHR(e.target.value)} placeholder="Enter recovery heart rate" className="mt-1" />
                  </div>
                  {category && (
                    <div className={`p-3 rounded-lg ${
                      category === "Excellent" ? "bg-green-100 text-green-800" :
                      category === "Good" ? "bg-blue-100 text-blue-800" :
                      category === "Average" ? "bg-yellow-100 text-yellow-800" :
                      category === "Below Average" ? "bg-orange-100 text-orange-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      <p className="font-semibold">Fitness Category: <span className="text-lg">{category}</span></p>
                      <p className="text-xs mt-1">Lower recovery HR indicates better cardiovascular efficiency and aerobic fitness.</p>
                    </div>
                  )}
                </div>
              )}

              {/* RPE & Symptoms */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">RPE (Borg 0–10)</Label>
                  <Input type="number" min="0" max="10" value={rpe} onChange={e => setRpe(e.target.value)} placeholder="0–10" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Symptoms During Test</Label>
                  <Input value={symptoms} onChange={e => setSymptoms(e.target.value)} placeholder="e.g. shortness of breath, fatigue" className="mt-1" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-sm">Additional Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Movement quality, pacing, compliance observations..." rows={2} className="mt-1" />
              </div>

              {/* Reference */}
              <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-700 mb-1">📖 Clinical Basis</p>
                <p>Recovery heart rate is a marker of parasympathetic reactivation and cardiovascular fitness. Faster heart rate recovery after submaximal exercise indicates better aerobic capacity and autonomic nervous system function.</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between pt-2 border-t">
              <Button variant="outline" onClick={onClose}>
                <X className="w-4 h-4 mr-2" />Close
              </Button>
              <Button onClick={handleSave} disabled={!isCompleted || !recoveryHR} className="bg-teal-600 hover:bg-teal-700 text-white">
                <Save className="w-4 h-4 mr-2" />Save Assessment
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}