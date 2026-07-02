import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, Square, RotateCcw, Info, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

// 30-15 IFT stage speeds: starts at 8 km/h, +0.5 every 45s (30s run + 15s walk)
function buildStages() {
  const stages = [];
  for (let i = 0; i <= 30; i++) {
    stages.push(parseFloat((8 + i * 0.5).toFixed(1)));
  }
  return stages;
}
const STAGES = buildStages();

function getInterpretation(vift) {
  if (vift >= 19) return { label: "Elite", color: "text-purple-700", bg: "bg-purple-100" };
  if (vift >= 14) return { label: "High Fitness", color: "text-green-700", bg: "bg-green-100" };
  if (vift >= 10) return { label: "Moderate Fitness", color: "text-blue-700", bg: "bg-blue-100" };
  return { label: "Low Fitness", color: "text-orange-700", bg: "bg-orange-100" };
}

const PHASE_DURATION = { run: 30, rest: 15 };

export default function ThreeZeroOneFiveIntermittentFitnessTestRunner({ client, onSave, onClose }) {
  const [phase, setPhase] = useState("idle"); // idle | run | rest | done
  const [stageIndex, setStageIndex] = useState(0); // 0 = 8.0 km/h
  const [phaseTime, setPhaseTime] = useState(PHASE_DURATION.run);
  const [totalStages, setTotalStages] = useState(0);

  // Manual result entry (clinician enters vIFT after test)
  const [viftManual, setViftManual] = useState("");
  const [finalStagesManual, setFinalStagesManual] = useState("");
  const [hrPre, setHrPre] = useState("");
  const [hrPost, setHrPost] = useState("");
  const [bpPre, setBpPre] = useState("");
  const [rpe, setRpe] = useState("");
  const [notes, setNotes] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [showInstructions, setShowInstructions] = useState(true);

  const intervalRef = useRef(null);

  useEffect(() => {
    if (phase === "run" || phase === "rest") {
      intervalRef.current = setInterval(() => {
        setPhaseTime(prev => {
          if (prev <= 1) {
            // Phase ended
            if (phase === "run") {
              setPhase("rest");
              return PHASE_DURATION.rest;
            } else {
              // Rest ended â†’ next stage
              setStageIndex(si => Math.min(si + 1, STAGES.length - 1));
              setTotalStages(ts => ts + 1);
              setPhase("run");
              return PHASE_DURATION.run;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [phase]);

  const handleStart = () => {
    setStageIndex(0);
    setTotalStages(1);
    setPhaseTime(PHASE_DURATION.run);
    setPhase("run");
    toast.info("Test started â€” Stage 1, 8.0 km/h. Client begins running!");
  };

  const handleStop = () => {
    clearInterval(intervalRef.current);
    // Record the last completed stage speed as vIFT
    const lastSpeed = STAGES[stageIndex];
    setViftManual(lastSpeed.toFixed(1));
    setFinalStagesManual(String(totalStages));
    setPhase("done");
    toast.success("Test stopped. Confirm the final VÌ‡IFT speed below.");
  };

  const handleReset = () => {
    clearInterval(intervalRef.current);
    setPhase("idle");
    setStageIndex(0);
    setTotalStages(0);
    setPhaseTime(PHASE_DURATION.run);
    setViftManual("");
    setFinalStagesManual("");
  };

  const handleSave = () => {
    const vift = parseFloat(viftManual);
    if (!viftManual || isNaN(vift) || vift < 8) {
      toast.error("Please enter a valid VÌ‡IFT speed (km/h).");
      return;
    }

    const stages = parseInt(finalStagesManual) || totalStages;
    const interp = getInterpretation(vift);

    const soapLines = [
      `â€¢ 30-15 Intermittent Fitness Test (30-15IFT)`,
      `  VÌ‡IFT (Final Speed): ${vift.toFixed(1)} km/h â€” ${interp.label}`,
      stages ? `  Total Stages Completed: ${stages}` : null,
      `  Training Prescription: ${(vift * 1.0).toFixed(1)}â€“${(vift * 1.3).toFixed(1)} km/h interval target`,
      hrPre ? `  Pre-Test HR: ${hrPre} bpm` : null,
      bpPre ? `  Pre-Test BP: ${bpPre} mmHg` : null,
      hrPost ? `  Post-Test HR: ${hrPost} bpm` : null,
      rpe ? `  RPE (6â€“20): ${rpe}` : null,
      notes ? `  Notes: ${notes}` : null,
    ].filter(Boolean).join("\n");

    onSave({
      status: "completed",
      result_value: vift,
      vift_kmh: vift,
      total_stages: stages,
      rpe: rpe ? parseInt(rpe) : null,
      notes,
      assessment_date: assessmentDate,
      additional_data: {
        soap_text: soapLines,
        measurement_type: "thirty_fifteen_ift",
        vift_kmh: vift,
        total_stages: stages,
        hr_pre: hrPre || null,
        bp_pre: bpPre || null,
        hr_post: hrPost || null,
        rpe: rpe ? parseInt(rpe) : null,
        interpretation: interp.label,
        training_min_kmh: parseFloat((vift * 1.0).toFixed(1)),
        training_max_kmh: parseFloat((vift * 1.3).toFixed(1)),
      },
    });
    toast.success("Test results saved.");
  };

  const currentSpeed = STAGES[stageIndex];
  const isActive = phase === "run" || phase === "rest";
  const viftPreview = parseFloat(viftManual);
  const interpPreview = !isNaN(viftPreview) && viftPreview >= 8 ? getInterpretation(viftPreview) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full my-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">30-15 Intermittent Fitness Test</h2>
            <p className="text-sm text-slate-500">30-15IFT â€” Buchheit (2008)</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Instructions (collapsible) */}
        <div className="px-6">
          <button
            className="w-full bg-blue-50 border border-blue-200 rounded-lg p-3 text-left flex items-center justify-between"
            onClick={() => setShowInstructions(v => !v)}
          >
            <span className="font-semibold text-blue-900 text-sm flex items-center gap-2"><Info className="w-4 h-4" />Clinician Instructions & Protocol</span>
            {showInstructions ? <ChevronUp className="w-4 h-4 text-blue-700" /> : <ChevronDown className="w-4 h-4 text-blue-700" />}
          </button>
          {showInstructions && (
            <div className="bg-blue-50 border border-blue-200 border-t-0 rounded-b-lg px-4 pb-4 text-sm text-blue-900 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <p className="font-semibold mb-1">Setup</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800 text-xs">
                    <li>40m flat course, cones at 0m and 40m</li>
                    <li>Use official 30-15IFT audio track (Buchheit)</li>
                    <li>Starts at 8.0 km/h, +0.5 km/h each stage</li>
                    <li>30s running + 15s passive recovery per stage</li>
                    <li>Client must reach end cone before beep</li>
                  </ul>
                </div>
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <p className="font-semibold mb-1">Termination & Result</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800 text-xs">
                    <li>Stop when client fails to reach line on 2 consecutive shuttles</li>
                    <li>VÌ‡IFT = speed of LAST COMPLETED stage</li>
                    <li>Use timer below to track stage/phase in real time</li>
                    <li>Enter final VÌ‡IFT manually after test</li>
                  </ul>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-100 text-xs">
                <p className="font-semibold mb-1">Script</p>
                <p className="italic text-blue-700">"You will run 40 metres back and forth in time with the audio signal. You have 30 seconds of running, then 15 seconds to walk to the nearest end. The speed increases every stage. Stop when you can no longer reach the line in time on two consecutive shuttles."</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <p className="font-semibold mb-2 text-xs">VÌ‡IFT Reference Ranges</p>
                <div className="grid grid-cols-4 gap-1 text-center text-xs">
                  {[
                    { label: "Low Fitness", range: "8â€“10", bg: "bg-orange-100", color: "text-orange-700" },
                    { label: "Moderate", range: "10â€“14", bg: "bg-blue-100", color: "text-blue-700" },
                    { label: "High", range: "14â€“18", bg: "bg-green-100", color: "text-green-700" },
                    { label: "Elite", range: "â‰¥19", bg: "bg-purple-100", color: "text-purple-700" },
                  ].map(c => (
                    <div key={c.label} className={`${c.bg} rounded p-2`}>
                      <p className={`font-bold ${c.color}`}>{c.range}</p>
                      <p className="text-slate-600">{c.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pre-Test Vitals */}
        <Card className="mx-6">
          <CardHeader className="pb-2"><CardTitle className="text-base">Pre-Test Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Assessment Date</Label>
                <Input type="date" value={assessmentDate} onChange={e => setAssessmentDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Pre-Test HR (bpm)</Label>
                <Input type="number" value={hrPre} onChange={e => setHrPre(e.target.value)} placeholder="e.g. 72" className="mt-1" />
              </div>
              <div>
                <Label>Pre-Test BP (mmHg)</Label>
                <Input type="text" value={bpPre} onChange={e => setBpPre(e.target.value)} placeholder="e.g. 120/80" className="mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Timer */}
        <Card className="mx-6">
          <CardHeader className="pb-2"><CardTitle className="text-base">Stage Timer (Optional â€” follows audio track)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4 bg-slate-50 rounded-lg border">
              {/* Phase indicator */}
              <div className={`text-xs font-bold uppercase tracking-widest px-4 py-1 rounded-full ${
                phase === "run" ? "bg-green-200 text-green-800" :
                phase === "rest" ? "bg-yellow-200 text-yellow-800" :
                phase === "done" ? "bg-blue-200 text-blue-800" :
                "bg-slate-200 text-slate-600"
              }`}>
                {phase === "idle" ? "Ready" : phase === "run" ? "â–¶ RUNNING" : phase === "rest" ? "â¸ REST" : "âœ“ Completed"}
              </div>

              {/* Timer */}
              <div className={`text-7xl font-bold tabular-nums ${
                phase === "run" && phaseTime <= 5 ? "text-red-600 animate-pulse" :
                phase === "run" ? "text-green-700" :
                phase === "rest" ? "text-yellow-700" : "text-slate-600"
              }`}>
                {isActive || phase === "done" ? (phase === "done" ? "â€”" : String(phaseTime).padStart(2, "0")) : "30"}
              </div>

              {/* Stage info */}
              {(isActive || phase === "done") && (
                <div className="flex gap-6 text-center text-sm">
                  <div>
                    <p className="text-slate-500">Stage</p>
                    <p className="text-2xl font-bold text-slate-800">{totalStages}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Speed</p>
                    <p className="text-2xl font-bold text-blue-700">{currentSpeed.toFixed(1)} km/h</p>
                  </div>
                </div>
              )}

              {/* Phase progress bar */}
              {isActive && (
                <div className="w-full px-6">
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-1000 ${phase === "run" ? "bg-green-500" : "bg-yellow-400"}`}
                      style={{ width: `${phase === "run" ? ((PHASE_DURATION.run - phaseTime) / PHASE_DURATION.run) * 100 : ((PHASE_DURATION.rest - phaseTime) / PHASE_DURATION.rest) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>{phase === "run" ? "Running" : "Rest"}</span>
                    <span>{phaseTime}s remaining</span>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="flex gap-3">
                {phase === "idle" && (
                  <Button onClick={handleStart} className="bg-green-600 hover:bg-green-700 px-8">
                    <Play className="w-5 h-5 mr-2" />Start Timer
                  </Button>
                )}
                {isActive && (
                  <Button onClick={handleStop} variant="destructive" className="px-8">
                    <Square className="w-5 h-5 mr-2" />Stop Test
                  </Button>
                )}
                {(phase === "done") && (
                  <Button onClick={handleReset} variant="outline">
                    <RotateCcw className="w-4 h-4 mr-2" />Reset
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-400 text-center max-w-xs">Use this timer alongside the official audio track, or use the audio track alone and manually enter the result below.</p>
            </div>
          </CardContent>
        </Card>

        {/* Result Entry */}
        <Card className="mx-6">
          <CardHeader className="pb-2"><CardTitle className="text-base">Test Result</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>VÌ‡IFT â€” Final Completed Speed (km/h) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  step="0.5"
                  min="8"
                  max="23"
                  value={viftManual}
                  onChange={e => setViftManual(e.target.value)}
                  placeholder="e.g. 15.5"
                  className="mt-1 text-lg font-semibold"
                />
                <p className="text-xs text-slate-400 mt-1">Speed of the last <strong>fully completed</strong> stage</p>
              </div>
              <div>
                <Label>Total Stages Completed</Label>
                <Input
                  type="number"
                  min="0"
                  value={finalStagesManual}
                  onChange={e => setFinalStagesManual(e.target.value)}
                  placeholder="e.g. 15"
                  className="mt-1"
                />
              </div>
            </div>

            {interpPreview && (
              <div className={`${interpPreview.bg} border rounded-lg p-3 flex items-center justify-between`}>
                <div>
                  <p className={`font-bold ${interpPreview.color}`}>{viftPreview.toFixed(1)} km/h â€” {interpPreview.label}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Training target: {(viftPreview * 1.0).toFixed(1)}â€“{(viftPreview * 1.3).toFixed(1)} km/h
                  </p>
                </div>
                <Badge className={`${interpPreview.bg} ${interpPreview.color} border-0`}>{interpPreview.label}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Post-Test */}
        <Card className="mx-6">
          <CardHeader className="pb-2"><CardTitle className="text-base">Post-Test & Notes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Post-Test HR (bpm)</Label>
                <Input type="number" value={hrPost} onChange={e => setHrPost(e.target.value)} placeholder="e.g. 185" className="mt-1" />
              </div>
              <div>
                <Label>RPE (6â€“20)</Label>
                <Input type="number" min="6" max="20" value={rpe} onChange={e => setRpe(e.target.value)} placeholder="e.g. 18" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Clinical Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Observations, termination reason, performance notes..." className="mt-1" />
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex justify-between px-6 pb-6">
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Cancel</Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 px-8" disabled={!viftManual}>
            <Save className="w-4 h-4 mr-2" />Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}