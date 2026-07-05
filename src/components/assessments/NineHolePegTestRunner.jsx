import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, Play, Square, RotateCcw, Hand, ExternalLink, ChevronDown, ChevronUp, CheckCircle, AlertCircle, BookOpen } from "lucide-react";
import { toast } from "sonner";

const NORMS = {
  male:   { right: { mean: 19.0, sd: 3.2 }, left: { mean: 20.6, sd: 3.9 } },
  female: { right: { mean: 17.9, sd: 2.8 }, left: { mean: 19.6, sd: 3.4 } },
};

function classifyResult(time, gender, side) {
  const norm = NORMS[gender]?.[side];
  if (!norm) return null;
  const z = (time - norm.mean) / norm.sd;
  if (z <= -1) return { label: "Above Average", color: "text-green-700 bg-green-50 border-green-200" };
  if (z <= 1)  return { label: "Average", color: "text-blue-700 bg-blue-50 border-blue-200" };
  if (z <= 2)  return { label: "Below Average", color: "text-orange-700 bg-orange-50 border-orange-200" };
  return { label: "Significantly Below Average", color: "text-red-700 bg-red-50 border-red-200" };
}

function Timer({ label, side, gender, onCapture }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(null);
  const [captured, setCaptured] = useState(null);
  const startRef = useRef(null);
  const intervalRef = useRef(null);

  const start = () => {
    startRef.current = Date.now() - (elapsed || 0) * 1000;
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed(((Date.now() - startRef.current) / 1000));
    }, 50);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
  };

  const reset = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    setElapsed(null);
    setCaptured(null);
  };

  const use = () => {
    const val = parseFloat(elapsed?.toFixed(2));
    setCaptured(val);
    onCapture(val);
    toast.success(`${label} time recorded: ${val}s`);
  };

  const classification = captured && gender ? classifyResult(captured, gender, side) : null;

  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hand className="w-4 h-4 text-slate-500" />
          <span className="font-semibold text-slate-800">{label}</span>
        </div>
        {captured && <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Recorded</span>}
      </div>

      <div className="text-4xl font-mono font-bold text-blue-600">
        {elapsed !== null ? `${elapsed.toFixed(1)}s` : "0.0s"}
      </div>

      <div className="flex gap-2 flex-wrap">
        {!running ? (
          <Button size="sm" onClick={start} className="bg-blue-600 hover:bg-blue-700">
            <Play className="w-3 h-3 mr-1" />Start
          </Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={stop}>
            <Square className="w-3 h-3 mr-1" />Stop
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={reset}>
          <RotateCcw className="w-3 h-3 mr-1" />Reset
        </Button>
        {elapsed !== null && !running && (
          <Button size="sm" variant="outline" onClick={use} className="border-green-400 text-green-700 hover:bg-green-50">
            Use Time ({elapsed.toFixed(2)}s)
          </Button>
        )}
      </div>

      {captured && (
        <div className="text-sm font-semibold text-slate-700">
          Recorded: <span className="text-blue-600">{captured}s</span>
          {classification && (
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full border font-medium ${classification.color}`}>
              {classification.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function NineHolePegTestRunner({ client, onSave, onClose }) {
  const [dominantTime, setDominantTime] = useState(null);
  const [nonDominantTime, setNonDominantTime] = useState(null);
  const [dominantSide, setDominantSide] = useState("right");
  const [notes, setNotes] = useState("");
  const [showInstructions, setShowInstructions] = useState(true);

  const gender = client?.gender === "male" || client?.gender === "female" ? client.gender : null;
  const nonDominantSide = dominantSide === "right" ? "left" : "right";

  const normRef = gender ? NORMS[gender] : null;

  const handleSave = () => {
    if (!dominantTime && !nonDominantTime) {
      toast.error("Please record at least one hand time.");
      return;
    }

    const primaryResult = dominantTime || nonDominantTime;
    const domClass = dominantTime && gender ? classifyResult(dominantTime, gender, dominantSide) : null;
    const nonDomClass = nonDominantTime && gender ? classifyResult(nonDominantTime, gender, nonDominantSide) : null;

    const soapLines = [
      `• Nine-Hole Peg Test (NHPT)`,
      dominantTime ? `  Dominant Hand (${dominantSide}): ${dominantTime}s${domClass ? ` — ${domClass.label}` : ''}` : null,
      nonDominantTime ? `  Non-Dominant Hand (${nonDominantSide}): ${nonDominantTime}s${nonDomClass ? ` — ${nonDomClass.label}` : ''}` : null,
      normRef ? `  Reference Norms (${gender}): Right ${normRef.right.mean}s ±${normRef.right.sd}, Left ${normRef.left.mean}s ±${normRef.left.sd}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      status: "completed",
      result_value: primaryResult,
      additional_data: {
        measurement_type: "nine_hole_peg_test",
        dominant_side: dominantSide,
        dominant_hand_time: dominantTime,
        non_dominant_hand_time: nonDominantTime,
        dominant_classification: domClass?.label || null,
        non_dominant_classification: nonDomClass?.label || null,
        soap_text: soapLines,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Nine-Hole Peg Test (NHPT)</h2>
            <p className="text-xs text-slate-500">Fine motor dexterity — Mathiowetz et al., 1985</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Instructions collapsible */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
              onClick={() => setShowInstructions(v => !v)}
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-slate-800 text-sm">Clinician Instructions & Setup</span>
              </div>
              {showInstructions ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
            {showInstructions && (
              <div className="px-4 py-4 space-y-4 text-sm text-slate-700 bg-gradient-to-br from-slate-50 to-blue-50/30">

                {/* Visual Reference */}
                <div className="border-2 border-blue-200 rounded-lg overflow-hidden bg-white p-3">
                  <p className="font-semibold text-slate-800 mb-2 text-center">Test Equipment Setup</p>
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68746e3e91f52664774f3d05/9holePegTestSetup.jpg"
                    alt="Nine-Hole Pegboard Test setup"
                    className="w-full rounded-lg"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />Purpose & Clinical Context
                  </p>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    The Nine-Hole Peg Test (NHPT) measures fine motor dexterity and upper extremity function. It is widely used in clinical settings to assess hand coordination, speed, and functional ability in conditions such as multiple sclerosis, Parkinson's disease, stroke, and other neurological or musculoskeletal disorders.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-2">Equipment Required</p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600">
                    <li>Jamar Nine-Hole Peg Board (standard 10cm × 10cm board with 9 holes)</li>
                    <li>9 wooden pegs (diameter: ~6mm)</li>
                    <li>Container for pegs</li>
                    <li>Digital stopwatch (0.01s accuracy recommended)</li>
                    <li>Flat, stable table and comfortable chair</li>
                    <li>Non-slip mat or damp cloth under board</li>
                  </ul>
                  <a href="https://www.amazon.com.au/Jamar-Coordination-Dexterity-Rehabilitation-Occupational/dp/B0056PQ6VQ" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:underline font-medium">
                    <ExternalLink className="w-3 h-3" />Purchase Jamar Nine-Hole Peg Board (Amazon AU)
                  </a>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-2">Setup Instructions</p>
                  <ol className="list-decimal pl-5 space-y-1.5 text-slate-600">
                    <li><strong>Positioning:</strong> Seat client at a comfortable height with feet flat on the floor and back supported</li>
                    <li><strong>Board placement:</strong> Position pegboard at client's midline, approximately 10cm from the edge of the table</li>
                    <li><strong>Peg container:</strong> Place container on the same side as the hand being tested, directly below the board holes</li>
                    <li><strong>Stabilization:</strong> Client may use the non-testing hand to stabilize the board (but NOT to assist in placing pegs)</li>
                    <li><strong>Practice trial:</strong> Allow one full untimed practice trial per hand before beginning the timed test</li>
                  </ol>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-2">Test Administration</p>
                  <div className="space-y-2.5">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="font-semibold text-blue-900 mb-1">Verbal Instructions to Client</p>
                      <p className="text-blue-900 italic text-xs leading-relaxed">
                        "I want you to pick up these pegs one at a time with your [hand name] hand and place them in the holes on the board, starting from the hole farthest from you. Once all nine holes are filled, remove the pegs one at a time and place them back in this container, starting with the hole closest to you. Work as quickly and accurately as you can. Ready? Go."
                      </p>
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs">
                      <li>Emphasize starting from the <strong>farthest corner</strong> (prevents accidental knock-outs)</li>
                      <li>Test the <strong>unaffected/non-dominant hand first</strong> for demonstration</li>
                      <li>Allow client to practice once per hand before timing</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-2">Timing Rules</p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs">
                    <li><strong>Start timing:</strong> When the client's finger first touches the first peg</li>
                    <li><strong>Stop timing:</strong> When the last peg is placed back in the container</li>
                    <li><strong>If peg is dropped:</strong> Stop, replace the peg in the correct hole, and resume timing (include the time spent)</li>
                    <li><strong>Record:</strong> Time to the nearest 0.01 second</li>
                    <li>Conduct test twice per hand; report the fastest time (better hand) or average if requested</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-2">Clinical Observations</p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs">
                    <li>Tremor or difficulty grasping pegs</li>
                    <li>Loss of coordination or dropping pegs</li>
                    <li>Fatigue or slowing during test</li>
                    <li>Use of alternative strategies (e.g., two-handed placement)</li>
                    <li>Pain or hesitation during movement</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-2">Instructional Video</p>
                  <a href="https://www.youtube.com/watch?v=kkyfI5OvfJo" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
                    <ExternalLink className="w-3 h-3" />Watch Nine-Hole Peg Test demonstration — Central Piedmont OTA (YouTube)
                  </a>
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <p className="font-semibold text-slate-800 mb-2">Evidence & References</p>
                  <ul className="space-y-1.5 text-xs">
                    <li>
                      <a href="https://pubmed.ncbi.nlm.nih.gov/3818032/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        <ExternalLink className="w-3 h-3" /><strong>Mathiowetz et al. (1985)</strong> — Normative data in healthy adults; establishes reference values for age & gender
                      </a>
                    </li>
                    <li>
                      <a href="https://pubmed.ncbi.nlm.nih.gov/19307571/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        <ExternalLink className="w-3 h-3" /><strong>Earhart et al. (2011)</strong> — Sensitive outcome measure in Parkinson's disease; shows responsiveness to intervention
                      </a>
                    </li>
                    <li>
                      <a href="https://pubmed.ncbi.nlm.nih.gov/11380024/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        <ExternalLink className="w-3 h-3" /><strong>Oxford Grice et al. (2003)</strong> — High test-retest reliability (ICC = 0.93–0.97) and validity in healthy & patient populations
                      </a>
                    </li>
                    <li>
                      <a href="https://www.sralab.org/rehabilitation-measures/nine-hole-peg-test" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        <ExternalLink className="w-3 h-3" /><strong>Shirley Ryan AbilityLab</strong> — Comprehensive NHPT rehab measures summary & evidence synthesis
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Dominant hand selector */}
          <div>
            <Label className="font-semibold text-slate-800 mb-2 block">Dominant Hand</Label>
            <div className="flex gap-3">
              {["right", "left"].map(side => (
                <button
                  key={side}
                  onClick={() => setDominantSide(side)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${dominantSide === side ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                >
                  {side.charAt(0).toUpperCase() + side.slice(1)} Hand
                </button>
              ))}
            </div>
          </div>

          {/* Timers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Timer
              label={`Dominant Hand (${dominantSide.charAt(0).toUpperCase() + dominantSide.slice(1)})`}
              side={dominantSide}
              gender={gender}
              onCapture={setDominantTime}
            />
            <Timer
              label={`Non-Dominant (${nonDominantSide.charAt(0).toUpperCase() + nonDominantSide.slice(1)})`}
              side={nonDominantSide}
              gender={gender}
              onCapture={setNonDominantTime}
            />
          </div>

          {/* Normative reference */}
          {normRef && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-700 mb-1">Normative Reference ({gender})</p>
              <div className="grid grid-cols-2 gap-2">
                <div>Right hand: <strong>{normRef.right.mean}s</strong> (±{normRef.right.sd}s)</div>
                <div>Left hand: <strong>{normRef.left.mean}s</strong> (±{normRef.left.sd}s)</div>
              </div>
              <p className="mt-1 text-slate-500">Source: Mathiowetz et al., 1985</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="font-medium">Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Observations, pain, fatigue, technique notes..."
              className="mt-1"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between pb-2">
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />Cancel
            </Button>
            <Button onClick={handleSave} disabled={!dominantTime && !nonDominantTime}>
              <Save className="w-4 h-4 mr-2" />Save Assessment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}