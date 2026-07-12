import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Save, Play, Pause, RotateCcw, Square } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const NORMS = [
  { population: "Healthy older adults (60–80 yrs)", range: "142–175 m", mcid: "~12 m", color: "text-green-700" },
  { population: "Stroke survivors (mild–moderate)", range: "56–126 m", mcid: "12 m", color: "text-blue-700" },
  { population: "Parkinson's disease", range: "80–120 m", mcid: "~10 m", color: "text-purple-700" },
  { population: "Community ambulatory threshold", range: "≥100 m (≈0.8 m/s)", mcid: "—", color: "text-slate-700" },
];

export default function TwoMinuteWalkRunner({ client, onSave, onClose }) {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [distance, setDistance] = useState("");
  const [hrPre, setHrPre] = useState("");
  const [hrPost, setHrPost] = useState("");
  const [bpPre, setBpPre] = useState("");
  const [bpPost, setBpPost] = useState("");
  const [spo2Pre, setSpo2Pre] = useState("");
  const [spo2Post, setSpo2Post] = useState("");
  const [rpe, setRpe] = useState("");
  const [assistiveDevice, setAssistiveDevice] = useState("no");
  const [deviceType, setDeviceType] = useState("");
  const [restsTaken, setRestsTaken] = useState(0);
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");
  const [testDone, setTestDone] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTime(prev => {
          if (prev >= 119) {
            clearInterval(intervalRef.current);
            setIsRunning(false);
            setTestDone(true);
            toast.success("2 minutes complete! Record distance and post-test vitals.");
            return 120;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const handleReset = () => { setTime(0); setIsRunning(false); setTestDone(false); };

  const handleSave = () => {
    if (!distance) { toast.error("Please enter the distance walked."); return; }
    const dist = parseFloat(distance);
    const soapLines = [
      `• 2-Minute Walk Test (2MWT)`,
      `  Distance: ${dist} m`,
      hrPre ? `  Pre-Test HR: ${hrPre} bpm` : null,
      bpPre ? `  Pre-Test BP: ${bpPre} mmHg` : null,
      spo2Pre ? `  Pre-Test SpO₂: ${spo2Pre}%` : null,
      hrPost ? `  Post-Test HR: ${hrPost} bpm` : null,
      bpPost ? `  Post-Test BP: ${bpPost} mmHg` : null,
      spo2Post ? `  Post-Test SpO₂: ${spo2Post}%` : null,
      rpe ? `  RPE (Borg 6–20): ${rpe}` : null,
      assistiveDevice === "yes" ? `  Assistive Device: ${deviceType || "Yes"}` : null,
      restsTaken > 0 ? `  Rests Taken: ${restsTaken}` : null,
      symptoms ? `  Symptoms: ${symptoms}` : null,
      notes ? `  Notes: ${notes}` : null,
      `  References: Butland et al. (1982); Bohannon & Crouch (2017).`,
    ].filter(Boolean).join("\n");

    onSave({
      result_value: dist,
      additional_data: {
        soap_text: soapLines,
        measurement_type: "two_minute_walk",
        distance_metres: dist,
        hr_pre: hrPre || null,
        hr_post: hrPost || null,
        bp_pre: bpPre || null,
        bp_post: bpPost || null,
        spo2_pre: spo2Pre || null,
        spo2_post: spo2Post || null,
        rpe: rpe ? parseInt(rpe) : null,
        assistive_device_used: assistiveDevice === "yes",
        device_type: deviceType || null,
        rests_taken: restsTaken,
        symptoms: symptoms || null,
      },
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("2MWT saved.");
  };

  const timeLeft = 120 - time;
  const mins = Math.floor(timeLeft / 60);
  const secs = String(timeLeft % 60).padStart(2, "0");
  const progressPct = (time / 120) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full my-4 shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-slate-900">2-Minute Walk Test (2MWT)</h2>
            <p className="text-sm text-slate-500 mt-0.5">Functional walking capacity — distance covered in 2 minutes</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="p-6 space-y-5">

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-2">
            <p className="font-semibold">📋 Administration Instructions</p>
            <p><strong>Setup:</strong> Measure a 30 m straight course (or use a 15 m shuttle). Client should be rested and wearing appropriate footwear. Assistive devices permitted but must be documented.</p>
            <p className="italic">"I am going to ask you to walk as far as possible in 2 minutes. You will walk back and forth along this course. I will tell you when to start and stop. You may slow down or rest if you need to, but try to cover as much ground as possible."</p>
            <p><strong>During test:</strong> Encourage with standardised phrases only (e.g., "You are doing well," "Keep up the good work"). Do not pace alongside the client.</p>
            <p><strong>Stopping criteria:</strong> Chest pain, severe dyspnea, pallor, dizziness, loss of coordination, or client request to stop.</p>
          </div>

          {/* Pre-Test Vitals */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Pre-Test Vitals</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Heart Rate (bpm)</Label>
                  <Input type="number" value={hrPre} onChange={e => setHrPre(e.target.value)} placeholder="e.g. 72" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Blood Pressure (mmHg)</Label>
                  <Input type="text" value={bpPre} onChange={e => setBpPre(e.target.value)} placeholder="e.g. 120/80" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">SpO₂ (%)</Label>
                  <Input type="number" value={spo2Pre} onChange={e => setSpo2Pre(e.target.value)} placeholder="e.g. 98" className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timer */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Test Timer</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4 bg-slate-50 rounded-lg border">
                <div className={`text-7xl font-bold tabular-nums ${timeLeft <= 30 && isRunning ? "text-red-600 animate-pulse" : "text-slate-800"}`}>
                  {mins}:{secs}
                </div>
                <div className="w-full px-6">
                  <div className="w-full bg-slate-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-1000 ${progressPct >= 90 ? "bg-red-500" : progressPct >= 60 ? "bg-yellow-500" : "bg-green-600"}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  {!isRunning && time < 120 && (
                    <Button onClick={() => setIsRunning(true)} className="bg-green-600 hover:bg-green-700 px-8">
                      <Play className="w-5 h-5 mr-2" />{time === 0 ? "Start Test" : "Resume"}
                    </Button>
                  )}
                  {isRunning && (
                    <Button onClick={() => setIsRunning(false)} variant="outline" className="px-8">
                      <Pause className="w-5 h-5 mr-2" />Pause
                    </Button>
                  )}
                  {time > 0 && (
                    <Button onClick={handleReset} variant="outline">
                      <RotateCcw className="w-4 h-4 mr-2" />Reset
                    </Button>
                  )}
                </div>
                {timeLeft <= 30 && isRunning && (
                  <Badge className="bg-red-600 text-white animate-pulse">Final 30 seconds — standardised encouragement only</Badge>
                )}
                {testDone && <Badge className="bg-green-600 text-white text-sm px-4 py-1">✓ Test Complete — record distance below</Badge>}
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Test Results</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-semibold">Distance Walked (metres) *</Label>
                  <Input type="number" value={distance} onChange={e => setDistance(e.target.value)} placeholder="e.g. 165" className="mt-1 text-xl font-bold" />
                </div>
                <div>
                  <Label className="text-xs">Rests Taken (count)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Button variant="outline" size="sm" onClick={() => setRestsTaken(r => Math.max(0, r - 1))}>−</Button>
                    <span className="text-xl font-bold w-8 text-center">{restsTaken}</span>
                    <Button variant="outline" size="sm" onClick={() => setRestsTaken(r => r + 1)}>+</Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Assistive Device Used?</Label>
                  <Select value={assistiveDevice} onValueChange={setAssistiveDevice}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {assistiveDevice === "yes" && (
                  <div>
                    <Label className="text-xs">Device Type</Label>
                    <Input value={deviceType} onChange={e => setDeviceType(e.target.value)} placeholder="e.g. walking stick, frame" className="mt-1" />
                  </div>
                )}
                <div>
                  <Label className="text-xs">RPE — Borg Scale (6–20)</Label>
                  <Input type="number" min={6} max={20} value={rpe} onChange={e => setRpe(e.target.value)} placeholder="e.g. 13" className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Post-Test Vitals */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Post-Test Vitals</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Heart Rate (bpm)</Label>
                  <Input type="number" value={hrPost} onChange={e => setHrPost(e.target.value)} placeholder="e.g. 108" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Blood Pressure (mmHg)</Label>
                  <Input type="text" value={bpPost} onChange={e => setBpPost(e.target.value)} placeholder="e.g. 138/85" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">SpO₂ (%)</Label>
                  <Input type="number" value={spo2Post} onChange={e => setSpo2Post(e.target.value)} placeholder="e.g. 95" className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Adverse Symptoms During/After Test</Label>
                <Textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} placeholder="Chest pain, dyspnea, dizziness, leg fatigue, claudication..." rows={2} className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 Norms & Interpretation</p>
            <table className="w-full text-xs border border-slate-300 rounded overflow-hidden">
              <thead className="bg-slate-200">
                <tr>
                  <th className="p-2 text-left">Population</th>
                  <th className="p-2 text-left">Reference Values</th>
                  <th className="p-2 text-left">MCID</th>
                </tr>
              </thead>
              <tbody>
                {NORMS.map((n, i) => (
                  <tr key={i} className="border-t">
                    <td className={`p-2 ${n.color}`}>{n.population}</td>
                    <td className="p-2 font-medium">{n.range}</td>
                    <td className="p-2 text-slate-600">{n.mcid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-500">MCID = Minimal Clinically Important Difference. A change of ≥12 m is meaningful for most populations.</p>
          </div>

          {/* References */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">📖 References</p>
            <p>Butland RJ et al. (1982). Two-, six-, and 12-minute walking tests in respiratory disease. <em>BMJ, 284</em>(6329), 1607–1608.</p>
            <p>Bohannon RW & Crouch R. (2017). Two-minute walk test performance by adults 18 to 85 years. <em>Arch Phys Med Rehab, 98</em>(8), 1736–1740.</p>
          </div>

          {/* Clinical Notes */}
          <div>
            <Label className="font-semibold text-sm">Clinical Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Gait pattern observations, verbal encouragement given, environmental factors..." rows={3} className="mt-1" />
          </div>

          {/* Footer */}
          <div className="flex justify-between pt-2 border-t">
            <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Cancel</Button>
            <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700 px-8">
              <Save className="w-4 h-4 mr-2" />Save Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}