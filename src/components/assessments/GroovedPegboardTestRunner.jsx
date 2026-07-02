import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, Play, Square, RotateCcw, ExternalLink, ChevronDown, ChevronUp, Info } from "lucide-react";
import { toast } from "sonner";

const MAX_TIME = 300; // 5 minutes

const formatTime = (s) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

// Phases in order
const PHASES = ["dominant", "non_dominant", "assembly", "done"];

const PHASE_LABELS = {
  dominant: "Peg Only â€” Dominant Hand",
  non_dominant: "Peg Only â€” Non-Dominant Hand",
  assembly: "Assembly (Peg + Washer + Nut) â€” Both Hands",
  done: "All trials complete",
};

const PHASE_INSTRUCTIONS = {
  dominant: "Place 25 grooved pegs into the board using the dominant hand only, as fast as possible.",
  non_dominant: "Place 25 grooved pegs into the board using the non-dominant hand only, as fast as possible.",
  assembly: "Using both hands, insert a peg into a hole, then place a washer over the peg, then a collar. Complete as many assemblies as possible in 30 seconds. Count total pieces placed (max = pegs Ã— 4).",
};

export default function GroovedPegboardTestRunner({ client, onSave, onClose }) {
  const [phase, setPhase] = useState("dominant");
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dominantHand, setDominantHand] = useState("right");
  const [showInfo, setShowInfo] = useState(true);

  // Results per phase
  const [results, setResults] = useState({
    dominant: { time: null, drops: 0, manual: "" },
    non_dominant: { time: null, drops: 0, manual: "" },
    assembly: { time: null, pieces: "", manual: "" }, // assembly is 30s timed count
  });

  const [notes, setNotes] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split("T")[0]);
  const intervalRef = useRef(null);

  const isAssembly = phase === "assembly";
  const ASSEMBLY_DURATION = 30;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed(prev => {
          const limit = isAssembly ? ASSEMBLY_DURATION : MAX_TIME;
          if (prev + 1 >= limit) {
            clearInterval(intervalRef.current);
            setRunning(false);
            handleStopInternal(limit);
            if (isAssembly) toast.info("30 seconds complete â€” record pieces assembled.");
            else toast.warning("5-minute limit reached â€” trial discontinued.");
            return limit;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, phase]);

  const handleStopInternal = (time) => {
    if (phase === "dominant" || phase === "non_dominant") {
      setResults(prev => ({ ...prev, [phase]: { ...prev[phase], time } }));
      const nextPhase = phase === "dominant" ? "non_dominant" : "assembly";
      setPhase(nextPhase);
      toast.success(`${PHASE_LABELS[phase]} complete. Now: ${PHASE_LABELS[nextPhase]}`);
    } else if (phase === "assembly") {
      setResults(prev => ({ ...prev, assembly: { ...prev.assembly, time } }));
      setPhase("done");
      toast.success("Assembly trial complete â€” all subtests done!");
    }
    setElapsed(0);
  };

  const handleStart = () => { setElapsed(0); setRunning(true); };
  const handleStop = () => { setRunning(false); handleStopInternal(elapsed); };

  const handleReset = (p) => {
    setResults(prev => ({ ...prev, [p]: { ...prev[p], time: null, manual: "" } }));
    setPhase(p);
    setElapsed(0);
    setRunning(false);
  };

  const updateResult = (p, field, value) => {
    setResults(prev => ({ ...prev, [p]: { ...prev[p], [field]: value } }));
  };

  const handleSave = () => {
    const domSec = results.dominant.time ?? (results.dominant.manual ? parseFloat(results.dominant.manual) : null);
    const nonDomSec = results.non_dominant.time ?? (results.non_dominant.manual ? parseFloat(results.non_dominant.manual) : null);
    const assemblyPieces = results.assembly.pieces ? parseInt(results.assembly.pieces) : null;

    if (!domSec && !nonDomSec) {
      toast.error("Please complete at least the peg subtests before saving.");
      return;
    }

    const domLabel = dominantHand === "right" ? "Right" : "Left";
    const nonDomLabel = dominantHand === "right" ? "Left" : "Right";

    const lines = [
      `Grooved Pegboard Test`,
      ``,
      `Peg Only â€” Dominant Hand (${domLabel}): ${domSec ? formatTime(Math.round(domSec)) + (domSec >= MAX_TIME ? " (DNF)" : "") + (results.dominant.drops > 0 ? ` | Drops: ${results.dominant.drops}` : "") : "Not completed"}`,
      `Peg Only â€” Non-Dominant Hand (${nonDomLabel}): ${nonDomSec ? formatTime(Math.round(nonDomSec)) + (nonDomSec >= MAX_TIME ? " (DNF)" : "") + (results.non_dominant.drops > 0 ? ` | Drops: ${results.non_dominant.drops}` : "") : "Not completed"}`,
      assemblyPieces != null ? `Assembly (Peg + Washer + Nut, 30s): ${assemblyPieces} pieces` : `Assembly: Not completed`,
      notes ? `\nNotes: ${notes}` : "",
    ].filter(Boolean).join("\n");

    onSave({
      status: "completed",
      result_value: domSec ? Math.round(domSec) : 0,
      additional_data: {
        measurement_type: "grooved_pegboard_test",
        soap_text: lines,
        dominant_hand: dominantHand,
        dominant_hand_time_seconds: domSec ? Math.round(domSec) : null,
        non_dominant_hand_time_seconds: nonDomSec ? Math.round(nonDomSec) : null,
        dominant_drops: results.dominant.drops,
        non_dominant_drops: results.non_dominant.drops,
        assembly_pieces: assemblyPieces,
      },
      notes,
      assessment_date: assessmentDate,
    });

    toast.success("Assessment saved successfully.");
  };

  const phaseIndex = PHASES.indexOf(phase);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-violet-50 to-blue-50 rounded-t-xl flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Grooved Pegboard Test</h2>
            <p className="text-slate-600 text-sm mt-1">Hand dexterity & fine motor coordination â€” 3 subtests</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="p-6 space-y-5">

          {/* Clinician Info Panel */}
          <div className="border border-blue-200 rounded-lg overflow-hidden">
            <button
              className="w-full flex justify-between items-center px-4 py-3 bg-blue-50 text-blue-800 font-semibold text-sm hover:bg-blue-100 transition-colors"
              onClick={() => setShowInfo(v => !v)}
            >
              <span className="flex items-center gap-2"><Info className="w-4 h-4" />Clinician Instructions & Protocol</span>
              {showInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showInfo && (
              <div className="p-4 text-sm text-slate-700 space-y-3">
                <div className="space-y-1">
                  <p className="font-semibold">Setup:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                    <li>Client seated at table, board positioned directly in front at elbow height</li>
                    <li>Pegs, washers, and nuts available in cup beside the board</li>
                    <li>Test dominant hand first, then non-dominant, then assembly</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">Subtests:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                    <li><strong>Peg Only (Dominant):</strong> Place all 25 pegs using dominant hand â€” time to completion (max 5 min)</li>
                    <li><strong>Peg Only (Non-Dominant):</strong> Same task with non-dominant hand</li>
                    <li><strong>Assembly:</strong> Both hands â€” insert peg, add washer, add nut, repeat for 30 seconds. Count total pieces placed.</li>
                  </ul>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded p-2 text-xs text-orange-800">
                  If a peg is dropped, participant must retrieve it and continue. Record the number of drops.
                </div>
                <div className="flex gap-3 flex-wrap">
                  <a href="https://www.limef.com/downloads/MAN-32025-forpdf-rev0.pdf" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <ExternalLink className="w-3 h-3" /> Test Manual (PDF)
                  </a>
                  <a href="https://www.parinc.com/products/GROOVE_PEGB" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <ExternalLink className="w-3 h-3" /> Purchase Kit (PAR Inc.)
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Setup */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Assessment Date</Label>
              <Input type="date" value={assessmentDate} onChange={e => setAssessmentDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Dominant Hand</Label>
              <div className="flex gap-2 mt-1">
                {["right", "left"].map(h => (
                  <Button key={h} size="sm" variant={dominantHand === h ? "default" : "outline"}
                    onClick={() => setDominantHand(h)} className="flex-1 capitalize">{h}</Button>
                ))}
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-1">
            {["dominant", "non_dominant", "assembly"].map((p, i) => (
              <React.Fragment key={p}>
                <div className={`flex-1 text-center text-xs rounded py-1.5 font-medium border ${
                  phase === p ? "bg-violet-600 text-white border-violet-600" :
                  PHASES.indexOf(phase) > PHASES.indexOf(p) ? "bg-green-100 text-green-800 border-green-300" :
                  "bg-slate-100 text-slate-500 border-slate-200"
                }`}>
                  {i === 0 ? "Peg / Dom." : i === 1 ? "Peg / Non-Dom." : "Assembly"}
                  {PHASES.indexOf(phase) > PHASES.indexOf(p) && " âœ“"}
                </div>
                {i < 2 && <div className="w-3 h-0.5 bg-slate-300" />}
              </React.Fragment>
            ))}
          </div>

          {/* Active Timer */}
          {phase !== "done" && (
            <div className="bg-slate-50 border rounded-lg p-5 text-center space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{PHASE_LABELS[phase]}</p>
              <p className="text-xs text-slate-500 italic">{PHASE_INSTRUCTIONS[phase]}</p>
              <div className={`text-6xl font-mono font-bold ${
                isAssembly
                  ? "text-amber-600"
                  : elapsed >= 270 ? "text-red-600" : "text-violet-600"
              }`}>
                {isAssembly ? formatTime(ASSEMBLY_DURATION - elapsed) : formatTime(elapsed)}
              </div>
              {!isAssembly && elapsed >= 270 && <p className="text-red-600 text-sm font-medium">âš  Approaching 5-minute limit</p>}
              <div className="flex justify-center gap-3 pt-1">
                <Button onClick={handleStart} disabled={running} className="bg-green-600 hover:bg-green-700">
                  <Play className="w-4 h-4 mr-2" /> Start
                </Button>
                <Button onClick={handleStop} disabled={!running} variant="destructive">
                  <Square className="w-4 h-4 mr-2" /> Stop
                </Button>
              </div>
            </div>
          )}

          {/* Results Cards */}
          <div className="space-y-3">

            {/* Dominant Peg */}
            {["dominant", "non_dominant"].map((p) => {
              const label = p === "dominant"
                ? `Peg Only â€” Dominant (${dominantHand === "right" ? "Right" : "Left"})`
                : `Peg Only â€” Non-Dominant (${dominantHand === "right" ? "Left" : "Right"})`;
              const res = results[p];
              const done = res.time !== null;
              return (
                <div key={p} className={`border rounded-lg p-4 ${done ? "border-green-300 bg-green-50" : PHASES.indexOf(phase) < PHASES.indexOf(p) ? "opacity-40" : "border-slate-200"}`}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-semibold text-sm">{label}</p>
                    {done && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleReset(p)}>
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  {done ? (
                    <p className="text-2xl font-bold text-green-700">{formatTime(res.time)}{res.time >= MAX_TIME ? " (DNF)" : ""}</p>
                  ) : (
                    <div>
                      <Label className="text-xs text-slate-500">Manual entry (seconds)</Label>
                      <Input type="number" placeholder="e.g. 65" value={res.manual}
                        onChange={e => updateResult(p, "manual", e.target.value)} className="mt-1" />
                    </div>
                  )}
                  <div className="mt-2">
                    <Label className="text-xs">Drops</Label>
                    <Input type="number" min="0" value={res.drops}
                      onChange={e => updateResult(p, "drops", parseInt(e.target.value) || 0)} className="mt-1 h-8" />
                  </div>
                </div>
              );
            })}

            {/* Assembly */}
            <div className={`border rounded-lg p-4 ${results.assembly.time !== null ? "border-green-300 bg-green-50" : PHASES.indexOf(phase) < PHASES.indexOf("assembly") ? "opacity-40" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex justify-between items-center mb-2">
                <p className="font-semibold text-sm">Assembly â€” Peg + Washer + Nut (30s, Both Hands)</p>
                {results.assembly.time !== null && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleReset("assembly")}>
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <div>
                <Label className="text-xs text-slate-600">Total pieces placed in 30 seconds</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 28"
                  value={results.assembly.pieces}
                  onChange={e => updateResult("assembly", "pieces", e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-slate-400 mt-1">Each peg + washer + nut = 3 pieces. Count all placed individually.</p>
              </div>
            </div>
          </div>

          {phase === "done" && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-3 text-center">
              <p className="text-green-800 font-semibold">âœ“ All trials complete â€” ready to save</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label>Clinical Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Observations, tremor, hesitation, grip difficulties, drop frequency..." rows={3} className="mt-1" />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 rounded-b-xl flex justify-between">
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" /> Cancel</Button>
          <Button onClick={handleSave} className="bg-violet-600 hover:bg-violet-700">
            <Save className="w-4 h-4 mr-2" /> Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}