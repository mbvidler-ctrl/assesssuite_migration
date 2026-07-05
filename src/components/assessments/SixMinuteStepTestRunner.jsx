import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, Square, Timer } from "lucide-react";
import { toast } from "sonner";
import { differenceInYears, parseISO } from "date-fns";

const TOTAL_SECONDS = 360; // 6 minutes

function getAgeFromDOB(dob) {
  if (!dob) return "";
  try {
    return String(differenceInYears(new Date(), parseISO(dob)));
  } catch {
    return "";
  }
}

function getGenderFromClient(client) {
  if (!client?.gender) return "";
  if (client.gender === "male") return "male";
  if (client.gender === "female") return "female";
  return "";
}

export default function SixMinuteStepTestRunner({ client, onSave, onClose }) {
  const [stepHeight, setStepHeight] = useState("20");
  const [age, setAge] = useState(getAgeFromDOB(client?.date_of_birth));
  const [gender, setGender] = useState(getGenderFromClient(client));

  const [preHR, setPreHR] = useState("");
  const [preBP, setPreBP] = useState("");
  const [preSpO2, setPreSpO2] = useState("");

  const [postHR, setPostHR] = useState("");
  const [postBP, setPostBP] = useState("");
  const [postSpO2, setPostSpO2] = useState("");

  const [stepCount, setStepCount] = useState(0);
  const [testInProgress, setTestInProgress] = useState(false);
  const [testDone, setTestDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS);
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split("T")[0]);

  const intervalRef = useRef(null);

  useEffect(() => {
    if (testInProgress) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setTestInProgress(false);
            setTestDone(true);
            toast.success("6 minutes complete! Record post-test vitals and save.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [testInProgress]);

  const elapsed = TOTAL_SECONDS - timeLeft;
  const elapsedMin = Math.floor(elapsed / 60);
  const elapsedSec = String(elapsed % 60).padStart(2, "0");
  const timeLeftMin = Math.floor(timeLeft / 60);
  const timeLeftSec = String(timeLeft % 60).padStart(2, "0");

  const handleStart = () => {
    if (!stepHeight || !age || !gender) {
      toast.error("Please enter step height, age, and gender before starting.");
      return;
    }
    setTestInProgress(true);
    setTestDone(false);
    setStepCount(0);
    setTimeLeft(TOTAL_SECONDS);
    toast.success("Test started! 6 minutes on the clock.");
  };

  const handleStop = () => {
    clearInterval(intervalRef.current);
    setTestInProgress(false);
    setTestDone(true);
    toast.success("Test stopped. Record post-test vitals and save.");
  };

  const handleSave = () => {
    if (!stepCount && stepCount !== 0) {
      toast.error("Please enter the step count.");
      return;
    }

    const noteParts = [`Step height: ${stepHeight} cm. Total steps: ${stepCount}.`];
    if (symptoms.trim()) noteParts.push(`Symptoms: ${symptoms}`);
    if (notes.trim()) noteParts.push(notes);

    const additionalData = {
      measurement_type: "6-minute_step_test",
      step_height: Number(stepHeight),
      age: Number(age),
      gender,
      pre_test_hr: preHR,
      pre_test_bp: preBP,
      pre_test_spO2: preSpO2,
      post_test_hr: postHR,
      post_test_bp: postBP,
      post_test_spO2: postSpO2,
      symptoms,
      elapsed_seconds: elapsed,
    };

    onSave({
      status: "completed",
      result_value: Number(stepCount),
      additional_data: additionalData,
      notes: noteParts.join(" "),
      assessment_date: assessmentDate,
    });
    toast.success("Results saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-slate-900">6-Minute Step Test</h2>
            {client && <p className="text-sm text-slate-500 mt-0.5">{client.full_name}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Clinician Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">📋 Administration Instructions (Butland Protocol)</p>
            <p><strong>Step height:</strong> Standard = 20 cm. Client steps up and down at self-selected pace for 6 minutes. Count total step cycles (up-up-down-down = 1 step cycle).</p>
            <p className="italic">"Step up and down on the step for 6 minutes, pacing yourself. You may slow down or rest if needed. Try to step as many times as possible."</p>
            <p><strong>Safety:</strong> Supervise closely, especially in those with respiratory or cardiac conditions. Have chair nearby. Monitor SpO2 continuously if available.</p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 Normative Values — 6-Minute Step Test (20 cm, steps)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Age</th><th className="p-2 text-center">Men (avg)</th><th className="p-2 text-center">Women (avg)</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">55–64</td><td className="p-2 text-center">78–107</td><td className="p-2 text-center">72–94</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">65–74</td><td className="p-2 text-center">70–96</td><td className="p-2 text-center">64–85</td></tr>
                  <tr className="border-t"><td className="p-2">75–84</td><td className="p-2 text-center">55–80</td><td className="p-2 text-center">50–70</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">MCID: ~12 steps. Source: Rikli & Jones (2013) Senior Fitness Test.</p>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Rikli RE & Jones CJ. (2013). <em>Senior Fitness Test Manual</em> (2nd ed.). Human Kinetics.</p>
            <p>Butland RJ et al. (1982). Two-, six-, and 12-minute walking tests in respiratory disease. <em>British Medical Journal, 284</em>(6329), 1607.</p>
          </div>

          {/* Assessment Date */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label>Assessment Date</Label>
              <Input type="date" value={assessmentDate} onChange={e => setAssessmentDate(e.target.value)} className="mt-1" />
            </div>
          </div>

          {/* Client Info */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Step Height (cm)</Label>
              <Input
                type="number"
                value={stepHeight}
                onChange={e => setStepHeight(e.target.value)}
                placeholder="e.g. 20"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Age</Label>
              <Input
                type="number"
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="Auto-filled from client"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pre-Test Vitals */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Pre-Test Vitals</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Heart Rate (bpm)</Label>
                <Input type="number" value={preHR} onChange={e => setPreHR(e.target.value)} placeholder="e.g. 72" className="mt-1" />
              </div>
              <div>
                <Label>Blood Pressure</Label>
                <Input value={preBP} onChange={e => setPreBP(e.target.value)} placeholder="e.g. 120/80" className="mt-1" />
              </div>
              <div>
                <Label>SpO2 (%)</Label>
                <Input type="number" value={preSpO2} onChange={e => setPreSpO2(e.target.value)} placeholder="e.g. 98" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Timer & Controls */}
          <div className="bg-slate-50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Timer className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-semibold text-slate-700">Test Timer</span>
              </div>
              <div className="flex gap-2">
                {!testInProgress && !testDone && (
                  <Button onClick={handleStart} className="bg-blue-600 hover:bg-blue-700">
                    <Play className="w-4 h-4 mr-2" /> Start Test
                  </Button>
                )}
                {testInProgress && (
                  <Button onClick={handleStop} variant="destructive">
                    <Square className="w-4 h-4 mr-2" /> Stop Test
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-slate-500 mb-1">Elapsed</p>
                <p className="text-2xl font-bold text-blue-600 font-mono">{elapsedMin}:{elapsedSec}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-slate-500 mb-1">Remaining</p>
                <p className={`text-2xl font-bold font-mono ${timeLeft <= 30 && testInProgress ? 'text-red-600' : 'text-slate-800'}`}>
                  {timeLeftMin}:{timeLeftSec}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-slate-500 mb-1">Steps</p>
                <div className="flex items-center justify-center gap-1">
                  <p className="text-2xl font-bold text-green-600">{stepCount}</p>
                </div>
              </div>
            </div>

            {/* Manual step count entry (editable after test) */}
            <div className="mt-4">
              <Label>Total Step Count (enter manually after test)</Label>
              <Input
                type="number"
                value={stepCount}
                onChange={e => setStepCount(Number(e.target.value))}
                placeholder="Enter final step count"
                className="mt-1"
              />
            </div>
          </div>

          {/* Post-Test Vitals */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Post-Test Vitals</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Heart Rate (bpm)</Label>
                <Input type="number" value={postHR} onChange={e => setPostHR(e.target.value)} placeholder="e.g. 110" className="mt-1" />
              </div>
              <div>
                <Label>Blood Pressure</Label>
                <Input value={postBP} onChange={e => setPostBP(e.target.value)} placeholder="e.g. 140/90" className="mt-1" />
              </div>
              <div>
                <Label>SpO2 (%)</Label>
                <Input type="number" value={postSpO2} onChange={e => setPostSpO2(e.target.value)} placeholder="e.g. 96" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Symptoms */}
          <div>
            <Label>Symptoms During Test</Label>
            <Textarea
              value={symptoms}
              onChange={e => setSymptoms(e.target.value)}
              placeholder="Record any symptoms (shortness of breath, chest pain, dizziness, leg cramps, etc.)"
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Clinical Notes */}
          <div>
            <Label>Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional clinical observations..."
              rows={2}
              className="mt-1"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t bg-slate-50 rounded-b-xl">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" /> Close
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" /> Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}