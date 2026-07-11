import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, Square, RotateCcw, Plus, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const NORMS = [
  { ageMin: 60, ageMax: 64, male: [87, 115], female: [75, 107] },
  { ageMin: 65, ageMax: 69, male: [86, 116], female: [73, 107] },
  { ageMin: 70, ageMax: 74, male: [80, 110], female: [68, 101] },
  { ageMin: 75, ageMax: 79, male: [73, 109], female: [68, 100] },
  { ageMin: 80, ageMax: 84, male: [71, 103], female: [60, 91] },
  { ageMin: 85, ageMax: 89, male: [59, 91],  female: [55, 85]  },
];

function getInterpretation(steps, age, gender) {
  const norm = NORMS.find(n => age >= n.ageMin && age <= n.ageMax);
  if (!norm) return null;
  const range = gender === "female" ? norm.female : norm.male;
  if (steps >= range[1]) return { label: "Above Average", color: "text-green-700", bg: "bg-green-100" };
  if (steps >= range[0]) return { label: "Average", color: "text-blue-700", bg: "bg-blue-100" };
  return { label: "Below Average", color: "text-red-700", bg: "bg-red-100" };
}

export default function TwoMinuteStepTestRunner({ client, onSave, onClose }) {
  const [steps, setSteps] = useState(0);
  const [hrPre, setHrPre] = useState("");
  const [hrPost, setHrPost] = useState("");
  const [bpPre, setBpPre] = useState("");
  const [bpPost, setBpPost] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(todayLocal());

  const [timeLeft, setTimeLeft] = useState(120);
  const [isRunning, setIsRunning] = useState(false);
  const [testDone, setTestDone] = useState(false);
  const intervalRef = useRef(null);

  const clientAge = client?.date_of_birth
    ? Math.floor((new Date() - new Date(client.date_of_birth)) / (365.25 * 24 * 3600 * 1000))
    : null;
  const clientGender = client?.gender === "female" ? "female" : "male";

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setIsRunning(false);
            setTestDone(true);
            toast.success("2 minutes completed! Record post-test vitals below.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const handleStart = () => {
    setTimeLeft(120);
    setSteps(0);
    setTestDone(false);
    setIsRunning(true);
    toast.info("Test started — count every right knee lift to target height.");
  };

  const handleStop = () => {
    setIsRunning(false);
    setTestDone(true);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTestDone(false);
    setTimeLeft(120);
    setSteps(0);
  };

  const handleSave = () => {
    if (steps === 0 && !testDone) {
      toast.error("Please complete the test and enter a step count before saving.");
      return;
    }

    const interpretation = clientAge ? getInterpretation(steps, clientAge, clientGender) : null;

    const soapLines = [
      `• 2-Minute Step Test`,
      `  Right Knee Steps: ${steps}`,
      interpretation ? `  Performance: ${interpretation.label}` : null,
      hrPre ? `  Pre-Test HR: ${hrPre} bpm` : null,
      bpPre ? `  Pre-Test BP: ${bpPre} mmHg` : null,
      hrPost ? `  Post-Test HR: ${hrPost} bpm` : null,
      bpPost ? `  Post-Test BP: ${bpPost} mmHg` : null,
      symptoms ? `  Symptoms: ${symptoms}` : null,
      notes ? `  Notes: ${notes}` : null,
    ].filter(Boolean).join("\n");

    onSave({
      status: "completed",
      result_value: steps,
      additional_data: {
        soap_text: soapLines,
        measurement_type: "two_min_step",
        steps_right_knee: steps,
        hr_pre: hrPre || null,
        hr_post: hrPost || null,
        bp_pre: bpPre || null,
        bp_post: bpPost || null,
        symptoms: symptoms || null,
        client_age_at_test: clientAge,
        client_gender: clientGender,
        interpretation: interpretation?.label || null,
      },
      notes,
      assessment_date: assessmentDate,
    });
    toast.success("Test results saved.");
  };

  const progressPct = ((120 - timeLeft) / 120) * 100;
  const mins = Math.floor(timeLeft / 60);
  const secs = String(timeLeft % 60).padStart(2, "0");
  const interpretation = clientAge && steps > 0 ? getInterpretation(steps, clientAge, clientGender) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full my-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">2-Minute Step Test</h2>
            <p className="text-sm text-slate-500">Rikli & Jones Senior Fitness Test</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Instructions */}
        <div className="px-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-2">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Clinician Instructions</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-800">
              <li>Client stands next to a wall. Mark the midpoint between the kneecap and iliac crest as the target height.</li>
              <li>Client marches in place, raising each knee to the marked height for exactly 2 minutes.</li>
              <li>Count only right knee raises that reach the target height. Client may rest briefly but keep counting.</li>
              <li>Record pre-test vitals before starting the timer.</li>
            </ol>
          </div>

          {/* Setup Diagram */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">Target Knee Height Setup</p>
            {/* Illustrated diagram */}
            <div className="bg-slate-100 rounded-lg border border-slate-200 p-4 flex gap-6 items-center">
              {/* Stick figure */}
              <div className="flex-shrink-0 relative w-28 h-48 mx-auto">
                <svg viewBox="0 0 80 160" className="w-full h-full">
                  {/* Wall */}
                  <rect x="68" y="0" width="4" height="160" fill="#cbd5e1" />
                  {/* Head */}
                  <circle cx="35" cy="14" r="10" fill="none" stroke="#334155" strokeWidth="2.5" />
                  {/* Torso */}
                  <line x1="35" y1="24" x2="35" y2="80" stroke="#334155" strokeWidth="2.5" />
                  {/* Arms */}
                  <line x1="35" y1="38" x2="60" y2="55" stroke="#334155" strokeWidth="2" />
                  <line x1="35" y1="38" x2="14" y2="55" stroke="#334155" strokeWidth="2" />
                  {/* Standing leg (left) */}
                  <line x1="35" y1="80" x2="25" y2="120" stroke="#334155" strokeWidth="2.5" />
                  <line x1="25" y1="120" x2="20" y2="148" stroke="#334155" strokeWidth="2.5" />
                  {/* Raised knee leg (right) */}
                  <line x1="35" y1="80" x2="45" y2="95" stroke="#2563eb" strokeWidth="2.5" />
                  <line x1="45" y1="95" x2="55" y2="112" stroke="#2563eb" strokeWidth="2.5" />
                  {/* Knee height marker line */}
                  <line x1="10" y1="95" x2="68" y2="95" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4,3" />
                  {/* Iliac crest dot */}
                  <circle cx="40" cy="78" r="3" fill="#f97316" />
                  {/* Kneecap dot (standing leg) */}
                  <circle cx="25" cy="120" r="3" fill="#f97316" />
                  {/* Midpoint label arrow */}
                  <text x="2" y="93" fontSize="7" fill="#dc2626" fontWeight="bold">Mid</text>
                  {/* Label: knee raised */}
                  <text x="48" y="88" fontSize="6.5" fill="#2563eb">↑ Knee</text>
                </svg>
              </div>
              <div className="text-sm text-slate-700 space-y-2 flex-1">
                <p className="font-semibold text-slate-800">Setup Steps:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600">
                  <li>Client stands side-on next to a wall for reference</li>
                  <li>Locate the <strong>iliac crest</strong> (top of hip bone) and <strong>kneecap (patella)</strong></li>
                  <li>Mark or measure the <strong>midpoint</strong> between these two landmarks on the thigh/wall — this is the target height <span className="text-red-600 font-semibold">(red dashed line)</span></li>
                  <li>Client marches in place, lifting each <strong>right</strong> knee to reach this height</li>
                  <li>Count only right knee raises that meet or exceed the marked height</li>
                </ol>
                <div className="bg-orange-50 border border-orange-200 rounded p-2 text-xs text-orange-800">
                  <strong>Tip:</strong> Use a piece of tape on the wall at the target height so the client has a visible target to aim for.
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-3">Mark the midpoint between the kneecap and iliac crest. Client marches in place, lifting the right knee to this height for 2 minutes.</p>
          </div>
        </div>

        {/* Pre-test Vitals */}
        <Card className="mx-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pre-Test Vitals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Assessment Date</Label>
                <Input type="date" value={assessmentDate} onChange={e => setAssessmentDate(e.target.value)} className="mt-1" />
              </div>
              <div />
              <div>
                <Label>Heart Rate (bpm)</Label>
                <Input type="number" value={hrPre} onChange={e => setHrPre(e.target.value)} placeholder="e.g. 72" className="mt-1" />
              </div>
              <div>
                <Label>Blood Pressure (mmHg)</Label>
                <Input type="text" value={bpPre} onChange={e => setBpPre(e.target.value)} placeholder="e.g. 120/80" className="mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timer + Step Counter */}
        <Card className="mx-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Test Timer & Step Counter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Timer Display */}
            <div className="flex flex-col items-center gap-3 py-4 bg-slate-50 rounded-lg border">
              <div className={`text-7xl font-bold tabular-nums ${timeLeft <= 30 && isRunning ? "text-red-600 animate-pulse" : "text-slate-800"}`}>
                {mins}:{secs}
              </div>
              <div className="w-full px-6">
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-1000 ${progressPct >= 90 ? "bg-red-500" : progressPct >= 60 ? "bg-yellow-500" : "bg-blue-600"}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                {!isRunning && !testDone && timeLeft === 120 && (
                  <Button onClick={handleStart} className="bg-green-600 hover:bg-green-700 px-8">
                    <Play className="w-5 h-5 mr-2" />Start Test
                  </Button>
                )}
                {isRunning && (
                  <Button onClick={handleStop} variant="destructive" className="px-8">
                    <Square className="w-5 h-5 mr-2" />Stop Early
                  </Button>
                )}
                {(testDone || (!isRunning && timeLeft < 120)) && (
                  <Button onClick={handleReset} variant="outline">
                    <RotateCcw className="w-4 h-4 mr-2" />Reset
                  </Button>
                )}
              </div>
              {timeLeft <= 30 && isRunning && (
                <Badge className="bg-red-600 text-white animate-pulse">Final 30 seconds — encourage client!</Badge>
              )}
              {testDone && (
                <Badge className="bg-green-600 text-white text-sm px-4 py-1">✓ Test Complete</Badge>
              )}
            </div>

            {/* Step Counter */}
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm font-medium text-slate-600">Right Knee Step Count</p>
              <div className="text-6xl font-bold text-blue-700 tabular-nums">{steps}</div>
              <div className="flex gap-3 items-center">
                <Button
                  onClick={() => setSteps(s => Math.max(0, s - 1))}
                  variant="outline"
                  size="lg"
                  className="w-14 h-14 text-xl rounded-full"
                >−</Button>
                <Button
                  onClick={() => setSteps(s => s + 1)}
                  className="w-20 h-20 text-2xl rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg"
                >
                  +
                </Button>
                <Button
                  onClick={() => setSteps(0)}
                  variant="outline"
                  size="lg"
                  className="w-14 h-14 rounded-full"
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>
              </div>
              <p className="text-xs text-slate-400">Tap + for each right knee raise that reaches the target height</p>
            </div>

            {/* Live interpretation */}
            {interpretation && (
              <div className={`${interpretation.bg} border rounded-lg p-3 text-center`}>
                <p className={`font-semibold ${interpretation.color}`}>{steps} steps — {interpretation.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">Based on norms for {clientGender}, age {clientAge}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Post-test Vitals */}
        <Card className="mx-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Post-Test Vitals & Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Post-Test Heart Rate (bpm)</Label>
                <Input type="number" value={hrPost} onChange={e => setHrPost(e.target.value)} placeholder="e.g. 110" className="mt-1" />
              </div>
              <div>
                <Label>Post-Test Blood Pressure (mmHg)</Label>
                <Input type="text" value={bpPost} onChange={e => setBpPost(e.target.value)} placeholder="e.g. 140/85" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Adverse Symptoms</Label>
              <Textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} placeholder="Any symptoms during/after test (chest pain, dizziness, dyspnea...)" rows={2} className="mt-1" />
            </div>
            <div>
              <Label>Clinical Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observations, pacing, assistive device use..." rows={2} className="mt-1" />
            </div>
          </CardContent>
        </Card>

        {/* Norms Reference */}
        <div className="mx-6">
          <details className="bg-slate-50 border rounded-lg">
            <summary className="p-3 text-sm font-medium text-slate-700 cursor-pointer">Normative Reference (Rikli & Jones, 2013)</summary>
            <div className="px-3 pb-3 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-slate-200">
                  <tr>
                    <th className="p-2 text-left border">Age</th>
                    <th className="p-2 text-center border">Men (avg range)</th>
                    <th className="p-2 text-center border">Women (avg range)</th>
                  </tr>
                </thead>
                <tbody>
                  {NORMS.map(n => (
                    <tr key={n.ageMin} className="border-t">
                      <td className="p-2 border">{n.ageMin}–{n.ageMax}</td>
                      <td className="p-2 text-center border">{n.male[0]}–{n.male[1]}</td>
                      <td className="p-2 text-center border">{n.female[0]}–{n.female[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>

        {/* Footer */}
        <div className="flex justify-between px-6 pb-6">
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Cancel</Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 px-8">
            <Save className="w-4 h-4 mr-2" />Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}