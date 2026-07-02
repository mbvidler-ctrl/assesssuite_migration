import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Play, Square, ChevronDown, ChevronUp } from "lucide-react";

const STAGES = [
  { label: "Stage 1", watts: 25, duration: 120 },
  { label: "Stage 2", watts: 50, duration: 120 },
  { label: "Stage 3", watts: 75, duration: 120 },
];

export default function TriLevelArmErgometerTestRunner({ client, onSave, onClose }) {
  const [heartRates, setHeartRates] = useState(["", "", ""]);
  const [rpeBorg, setRpeBorg] = useState("");
  const [notes, setNotes] = useState("");
  const [stage, setStage] = useState(0); // 0 = not started, 1-3 = active, 4 = done
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1;
          if (next >= STAGES[stage - 1]?.duration) {
            clearInterval(intervalRef.current);
            setRunning(false);
            if (stage < 3) {
              setStage(s => s + 1);
              setElapsed(0);
            } else {
              setStage(4);
            }
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, stage]);

  const startStage = () => {
    if (stage === 0) setStage(1);
    setElapsed(0);
    setRunning(true);
  };

  const stopStage = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    if (stage < 3) setStage(s => s + 1);
    else setStage(4);
    setElapsed(0);
  };

  const avgHR = heartRates.filter(h => h && !isNaN(parseFloat(h))).reduce((a, b, _, arr) => a + parseFloat(b) / arr.length, 0);
  const finalHR = heartRates[2] ? parseFloat(heartRates[2]) : avgHR;

  const handleSave = () => {
    const soapText = [
      `â€¢ Tri-Level Arm Ergometer Test`,
      `  Protocol: 3 stages Ã— 2 min | 25W â†’ 50W â†’ 75W | 50 rpm`,
      `  Stage 1 HR: ${heartRates[0] || "â€”"} bpm`,
      `  Stage 2 HR: ${heartRates[1] || "â€”"} bpm`,
      `  Stage 3 HR: ${heartRates[2] || "â€”"} bpm`,
      rpeBorg ? `  RPE (Borg 6â€“20): ${rpeBorg}` : "",
      notes ? `  Notes: ${notes}` : "",
    ].filter(Boolean).join("\n");

    onSave({
      result_value: finalHR || avgHR || 0,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
      additional_data: {
        soap_text: soapText,
        stage1_hr: parseFloat(heartRates[0]) || null,
        stage2_hr: parseFloat(heartRates[1]) || null,
        stage3_hr: parseFloat(heartRates[2]) || null,
        rpe: rpeBorg ? parseInt(rpeBorg) : null,
      }
    });
  };

  const stageInfo = stage > 0 && stage <= 3 ? STAGES[stage - 1] : null;
  const progressPct = stageInfo ? Math.round((elapsed / stageInfo.duration) * 100) : 0;

  return (
    <div className="space-y-5 p-1">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Tri-Level Arm Ergometer Test</h2>
          <p className="text-sm text-slate-500">Upper body submaximal aerobic capacity assessment</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {/* Instructions */}
      <div className="border border-blue-200 rounded-lg overflow-hidden">
        <button onClick={() => setShowInstructions(v => !v)}
          className="w-full flex justify-between items-center bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          ðŸ“‹ Protocol &amp; Instructions
          {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showInstructions && (
          <div className="bg-white p-4 text-sm space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              {STAGES.map((s, i) => (
                <div key={i} className={`rounded-lg p-3 text-xs border ${i === 0 ? "bg-blue-50 border-blue-200" : i === 1 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"}`}>
                  <p className="font-bold">{s.label}</p>
                  <p className="mt-1"><strong>{s.watts}W</strong> for 2 minutes</p>
                  <p className="text-slate-600">Record HR in final 30s</p>
                </div>
              ))}
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold text-slate-700">Key Points</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li>Maintain 50â€“60 rpm throughout</li>
                <li>Seat height: arm horizontal at mid-range of crank</li>
                <li>Record HR at end of each 2-minute stage (last 30s)</li>
                <li>Used for SCI, upper limb dominant or lower limb injured populations</li>
                <li>Stop if HR &gt;85% age-predicted max or symptoms develop</li>
              </ul>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
              <p className="font-semibold text-red-800">Contraindications</p>
              <p className="text-red-700">Active shoulder/elbow injury Â· Uncontrolled hypertension Â· Acute cardiac event Â· Inability to maintain safe ergometer contact</p>
            </div>
          </div>
        )}
      </div>

      {/* Timer */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className={`px-4 py-2 text-sm font-semibold ${stage === 0 ? "bg-slate-100 text-slate-600" : stage === 4 ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}>
          {stage === 0 ? "Ready to start" : stage === 4 ? "âœ… Test Complete" : `${STAGES[stage-1].label} â€” ${STAGES[stage-1].watts}W`}
        </div>
        {stage > 0 && stage <= 3 && (
          <div className="bg-white p-4 space-y-3 text-center">
            <div className="text-5xl font-bold font-mono tabular-nums text-blue-600">
              {Math.floor((STAGES[stage-1].duration - elapsed) / 60)}:{String((STAGES[stage-1].duration - elapsed) % 60).padStart(2, "0")}
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5">
              <div className="h-2.5 rounded-full bg-blue-500 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}
        <div className="bg-white p-3 border-t border-slate-100 flex justify-center gap-3">
          {stage === 0 && (
            <Button onClick={startStage} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Play className="w-4 h-4 mr-2" /> Start Stage 1
            </Button>
          )}
          {stage > 0 && stage <= 3 && !running && (
            <Button onClick={startStage} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Play className="w-4 h-4 mr-2" /> Start Stage {stage}
            </Button>
          )}
          {running && (
            <Button onClick={stopStage} variant="destructive">
              <Square className="w-4 h-4 mr-2" /> End Stage / Skip
            </Button>
          )}
        </div>
      </div>

      {/* HR Entry */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Heart Rate at End of Each Stage (bpm)</p>
        <div className="grid grid-cols-3 gap-3">
          {STAGES.map((s, i) => (
            <div key={i}>
              <Label className="text-xs text-slate-600">{s.label} ({s.watts}W)</Label>
              <Input type="number" value={heartRates[i]} onChange={e => setHeartRates(h => h.map((v, j) => j === i ? e.target.value : v))}
                placeholder="bpm" className="mt-1 h-8 text-sm" />
            </div>
          ))}
        </div>
        <div className="w-40">
          <Label className="text-xs text-slate-600">RPE (Borg 6â€“20)</Label>
          <Input type="number" min={6} max={20} value={rpeBorg} onChange={e => setRpeBorg(e.target.value)} placeholder="e.g. 15" className="mt-1 h-8 text-sm" />
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold text-slate-700">Clinical Notes</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="Cadence maintenance, dyspnoea, shoulder pain, purpose of test, population (SCI, upper limb rehab)..." className="mt-1 text-sm" />
      </div>

      {/* References */}
      <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">ðŸ“– References</p>
        <p>1. Franklin BA. (1985). Exercise testing, training and arm ergometry. <em>Sports Medicine</em>, 2(2), 100â€“119.</p>
        <p>2. Exercise &amp; Sports Science Australia (ESSA). (2020). Health Outcome Measures â€” Cardiorespiratory Section. ESSA.</p>
        <p>3. American College of Sports Medicine. (2022). <em>ACSM's Guidelines for Exercise Testing and Prescription</em> (11th ed.). Wolters Kluwer.</p>
      </div>

      <div className="flex justify-between pt-2 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={heartRates.every(h => !h)} className="bg-blue-600 hover:bg-blue-700 text-white">
          Save Results
        </Button>
      </div>
    </div>
  );
}