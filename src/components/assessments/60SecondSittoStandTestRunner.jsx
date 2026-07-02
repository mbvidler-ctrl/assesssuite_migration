import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, Square, RotateCcw, Info } from "lucide-react";
import { toast } from "sonner";

const NORMS = [
  { ageMin: 60, ageMax: 69, male: [29, 37], female: [24, 33] },
  { ageMin: 70, ageMax: 79, male: [24, 32], female: [20, 28] },
  { ageMin: 80, ageMax: 89, male: [19, 27], female: [15, 22] },
];

function getInterpretation(reps, age, gender) {
  const norm = NORMS.find(n => age >= n.ageMin && age <= n.ageMax);
  if (!norm) return null;
  const range = gender === "female" ? norm.female : norm.male;
  if (reps >= range[1]) return { label: "Above Average", color: "text-green-700", bg: "bg-green-100" };
  if (reps >= range[0]) return { label: "Average", color: "text-blue-700", bg: "bg-blue-100" };
  return { label: "Below Average â€” Elevated Fall Risk", color: "text-red-700", bg: "bg-red-100" };
}

export default function SixtySecondSittoStandTestRunner({ client, onSave, onClose }) {
  const [phase, setPhase] = useState("idle"); // idle | running | done
  const [timeLeft, setTimeLeft] = useState(60);
  const [reps, setReps] = useState(0);
  const [handsUsed, setHandsUsed] = useState(false);
  const [hrPre, setHrPre] = useState("");
  const [bpPre, setBpPre] = useState("");
  const [hrPost, setHrPost] = useState("");
  const [bpPost, setBpPost] = useState("");
  const [notes, setNotes] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split("T")[0]);
  const intervalRef = useRef(null);

  const clientAge = client?.date_of_birth
    ? Math.floor((new Date() - new Date(client.date_of_birth)) / (365.25 * 24 * 3600 * 1000))
    : null;
  const clientGender = client?.gender === "female" ? "female" : "male";

  useEffect(() => {
    if (phase === "running") {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setPhase("done");
            toast.success("60 seconds complete! Record the final rep count.");
            return 0;
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
    setReps(0);
    setTimeLeft(60);
    setPhase("running");
    toast.info("Test started â€” tap COUNT for each full stand!");
  };

  const handleStop = () => {
    clearInterval(intervalRef.current);
    setPhase("done");
  };

  const handleReset = () => {
    clearInterval(intervalRef.current);
    setPhase("idle");
    setTimeLeft(60);
    setReps(0);
  };

  const handleCount = () => {
    if (phase === "running") setReps(r => r + 1);
  };

  const handleSave = () => {
    if (reps === 0 && phase === "idle") {
      toast.error("Please complete the test or enter a rep count before saving.");
      return;
    }

    const interpretation = clientAge ? getInterpretation(reps, clientAge, clientGender) : null;

    const soapLines = [
      `â€¢ 60-Second Sit-to-Stand Test`,
      `  Repetitions: ${reps}${handsUsed ? " (hands used for support)" : ""}`,
      interpretation ? `  Performance: ${interpretation.label}` : null,
      (hrPre || bpPre) ? `  Pre-Test: HR ${hrPre || "N/A"} bpm | BP ${bpPre || "N/A"} mmHg` : null,
      (hrPost || bpPost) ? `  Post-Test: HR ${hrPost || "N/A"} bpm | BP ${bpPost || "N/A"} mmHg` : null,
      notes ? `  Clinical Notes: ${notes}` : null,
    ].filter(Boolean).join("\n");

    onSave({
      status: "completed",
      result_value: reps,
      assessment_date: assessmentDate,
      notes,
      additional_data: {
        soap_text: soapLines,
        measurement_type: "sixty_sec_sts",
        repetitions: reps,
        hands_used: handsUsed,
        hr_pre: hrPre || null,
        bp_pre: bpPre || null,
        hr_post: hrPost || null,
        bp_post: bpPost || null,
        interpretation: interpretation?.label || null,
        client_age_at_test: clientAge,
        client_gender: clientGender,
      },
    });
    toast.success("Assessment saved.");
  };

  const progressPct = ((60 - timeLeft) / 60) * 100;
  const interpretation = clientAge && reps > 0 ? getInterpretation(reps, clientAge, clientGender) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full my-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">60-Second Sit-to-Stand Test</h2>
            <p className="text-sm text-slate-500">Lower limb strength & functional mobility</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Instructions */}
        <div className="px-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-2">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Clinician Instructions</p>
            <ul className="list-decimal list-inside space-y-1 text-blue-800">
              <li>Standard chair (~43 cm) against a wall. Client sits in the middle, feet flat on floor.</li>
              <li>Arms crossed over chest throughout. No arm rests unless safety requires â€” document if used.</li>
              <li>On "Go" â€” client rises to full stand (hips & knees fully extended) then sits fully back down.</li>
              <li>Tap <strong>COUNT</strong> for every fully completed stand. Only count full stands.</li>
              <li>Stop if client shows signs of distress, dizziness, or unsafe movement.</li>
            </ul>
            <p className="italic text-blue-700 mt-1">"Rise to a full standing position and sit back down, as many times as you can in 60 seconds. Keep your arms folded across your chest."</p>
          </div>
        </div>

        {/* Pre-Test Vitals */}
        <Card className="mx-6">
          <CardHeader className="pb-2"><CardTitle className="text-base">Pre-Test Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
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

        {/* Timer + Counter */}
        <Card className="mx-6">
          <CardHeader className="pb-2"><CardTitle className="text-base">Test Timer & Counter</CardTitle></CardHeader>
          <CardContent className="space-y-5">

            {/* Timer */}
            <div className="flex flex-col items-center gap-3 py-4 bg-slate-50 rounded-lg border">
              <div className={`text-7xl font-bold tabular-nums ${timeLeft <= 10 && phase === "running" ? "text-red-600 animate-pulse" : "text-slate-800"}`}>
                {timeLeft}s
              </div>
              <div className="w-full px-6">
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-1000 ${progressPct >= 80 ? "bg-red-500" : progressPct >= 50 ? "bg-yellow-500" : "bg-blue-600"}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                {phase === "idle" && (
                  <Button onClick={handleStart} className="bg-green-600 hover:bg-green-700 px-10">
                    <Play className="w-5 h-5 mr-2" />Start Test
                  </Button>
                )}
                {phase === "running" && (
                  <Button onClick={handleStop} variant="destructive" className="px-8">
                    <Square className="w-5 h-5 mr-2" />Stop Early
                  </Button>
                )}
                {phase === "done" && (
                  <Button onClick={handleReset} variant="outline">
                    <RotateCcw className="w-4 h-4 mr-2" />Reset
                  </Button>
                )}
              </div>
              {phase === "done" && (
                <Badge className="bg-green-600 text-white text-sm px-4 py-1">âœ“ Test Complete</Badge>
              )}
            </div>

            {/* Rep Counter */}
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm font-medium text-slate-600">Repetitions (Full Stands)</p>
              <div className="text-6xl font-bold text-blue-700 tabular-nums">{reps}</div>

              {/* Big COUNT button */}
              <Button
                onClick={handleCount}
                disabled={phase !== "running"}
                className="w-48 h-20 text-2xl font-bold rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 transition-transform shadow-lg disabled:opacity-40"
              >
                + COUNT
              </Button>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReps(r => Math.max(0, r - 1))}
                  disabled={phase === "running"}
                >
                  âˆ’ Undo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReps(0)}
                  disabled={phase === "running"}
                >
                  Reset Count
                </Button>
              </div>
              <p className="text-xs text-slate-400">Tap COUNT for each fully completed stand. Use Undo to correct mis-counts.</p>
            </div>

            {/* Live interpretation */}
            {interpretation && (
              <div className={`${interpretation.bg} border rounded-lg p-3 text-center`}>
                <p className={`font-semibold ${interpretation.color}`}>{reps} reps â€” {interpretation.label}</p>
                {clientAge && <p className="text-xs text-slate-500 mt-0.5">Based on norms for {clientGender}, age {clientAge}</p>}
              </div>
            )}

            {/* Hands used toggle */}
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <input
                type="checkbox"
                id="handsUsed"
                checked={handsUsed}
                onChange={e => setHandsUsed(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <Label htmlFor="handsUsed" className="text-amber-800 cursor-pointer">
                Client used hands/armrests for support (document in notes)
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Post-Test */}
        <Card className="mx-6">
          <CardHeader className="pb-2"><CardTitle className="text-base">Post-Test Vitals & Notes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Post-Test HR (bpm)</Label>
                <Input type="number" value={hrPost} onChange={e => setHrPost(e.target.value)} placeholder="Immediate post-test" className="mt-1" />
              </div>
              <div>
                <Label>Post-Test BP (mmHg)</Label>
                <Input type="text" value={bpPost} onChange={e => setBpPost(e.target.value)} placeholder="e.g. 140/85" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Clinical Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Movement quality, compensation patterns, fatigue, symptoms, use of support..." className="mt-1" />
            </div>
          </CardContent>
        </Card>

        {/* Norms reference */}
        <div className="mx-6">
          <details className="bg-slate-50 border rounded-lg">
            <summary className="p-3 text-sm font-medium text-slate-700 cursor-pointer">Normative Reference (Bohannon, 2006)</summary>
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
                      <td className="p-2 border">{n.ageMin}â€“{n.ageMax}</td>
                      <td className="p-2 text-center border">{n.male[0]}â€“{n.male[1]}</td>
                      <td className="p-2 text-center border">{n.female[0]}â€“{n.female[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-500 mt-2">MCID: ~3â€“4 repetitions. Below average = elevated fall risk.</p>
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