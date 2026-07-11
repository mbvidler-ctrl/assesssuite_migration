import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Play, Square, Trash2, Info, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// Hexagon Agility Test norms (seconds for 3 circuits)
const NORMS = {
  male: [
    { level: "Excellent", under: 11.2, color: "text-green-600 bg-green-50" },
    { level: "Good", under: 13.3, color: "text-teal-600 bg-teal-50" },
    { level: "Average", under: 15.5, color: "text-yellow-600 bg-yellow-50" },
    { level: "Below Average", under: 17.8, color: "text-orange-600 bg-orange-50" },
    { level: "Poor", under: 999, color: "text-red-600 bg-red-50" },
  ],
  female: [
    { level: "Excellent", under: 12.0, color: "text-green-600 bg-green-50" },
    { level: "Good", under: 14.5, color: "text-teal-600 bg-teal-50" },
    { level: "Average", under: 17.0, color: "text-yellow-600 bg-yellow-50" },
    { level: "Below Average", under: 19.5, color: "text-orange-600 bg-orange-50" },
    { level: "Poor", under: 999, color: "text-red-600 bg-red-50" },
  ],
};

function classify(time, gender) {
  const rows = NORMS[gender === "male" ? "male" : "female"];
  return rows.find(r => time < r.under) || rows[rows.length - 1];
}

export default function HexagonAgilityTestRunner({ client, onSave, onClose }) {
  const [trials, setTrials] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const startRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const start = () => {
    startRef.current = Date.now();
    setElapsed(0);
    setIsRunning(true);
    intervalRef.current = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 50);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    const t = parseFloat(((Date.now() - startRef.current) / 1000).toFixed(2));
    setTrials(prev => [...prev, t]);
    setElapsed(0);
  };

  const best = trials.length > 0 ? Math.min(...trials) : null;
  const cat = best && client?.gender ? classify(best, client.gender) : null;

  const handleSave = () => {
    if (trials.length === 0) { toast.error("Record at least one trial"); return; }
    const soap = `• Hexagon Agility Test\n  Best Time: ${best}s (3 circuits, ~${(best * 100 / 30.48).toFixed(0)}cm sides)${cat ? ` — ${cat.level}` : ""}\n  All Trials: ${trials.map(t => t + "s").join(", ")}${notes ? `\n  Notes: ${notes}` : ""}\n  Assesses agility, speed, and lower limb coordination.\n  Reference: Johnson BL & Nelson JK (1979). Practical Measurements for Evaluation in Physical Education. NSCA Performance Testing.`;
    onSave({ status: "completed", result_value: best, notes, assessment_date: todayLocal(), additional_data: { soap_text: soap, measurement_type: "agility_timed", best_time_s: best, trials, classification: cat?.level } });
    toast.success("Hexagon Test saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-violet-50 to-purple-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Hexagon Agility Test</h2><p className="text-slate-500 text-sm mt-0.5">3-circuit bi-directional agility (lower is better)</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Collapsible Clinician Guide */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              className="w-full flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
              onClick={() => setShowGuide(g => !g)}
            >
              <span className="font-semibold text-slate-800 flex items-center gap-2"><Info className="w-4 h-4 text-violet-600" />Clinician Guide, Protocol & References</span>
              {showGuide ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
            {showGuide && (
              <div className="p-4 space-y-4 text-sm">
                {/* Diagram image */}
                <div className="flex justify-center">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Hexagon_test.svg/400px-Hexagon_test.svg.png"
                    alt="Hexagon Agility Test diagram"
                    className="max-w-[220px] rounded-lg border border-slate-200 shadow-sm"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1 text-blue-900">
                  <p className="font-semibold">Purpose</p>
                  <p>Assess lower limb agility, dynamic balance, speed of movement, and neuromuscular coordination. Widely used in athletic performance testing and return-to-sport assessment.</p>
                </div>

                <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 space-y-1 text-violet-900">
                  <p className="font-semibold">Equipment & Setup</p>
                  <ul className="list-disc ml-4 space-y-0.5">
                    <li>Mark a hexagon on floor with tape — each side <strong>24 inches (61 cm)</strong>, interior angles 120°</li>
                    <li>Number each side 1–6 clockwise from the front</li>
                    <li>Stopwatch or electronic timer</li>
                    <li>Non-slip surface; appropriate footwear</li>
                  </ul>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1 text-green-900">
                  <p className="font-semibold">Administration Protocol</p>
                  <ol className="list-decimal ml-4 space-y-0.5">
                    <li>Client stands inside hexagon facing forward (toward side 1)</li>
                    <li>On "Go", client jumps forward over side 1, then immediately jumps back in</li>
                    <li>Continue jumping over each side clockwise, always returning to centre — 3 full circuits</li>
                    <li><strong>Feet must NOT touch the lines</strong>; client must always face forward</li>
                    <li>Stop timer when both feet return to centre after the 3rd circuit</li>
                    <li>Rest 60 seconds. Perform 2–3 trials; record best time</li>
                    <li>Disqualify trial if lines are touched or client loses balance</li>
                  </ol>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1 text-amber-900">
                  <p className="font-semibold">Contraindications / Precautions</p>
                  <ul className="list-disc ml-4 space-y-0.5">
                    <li>Acute lower limb injury (ankle sprain, knee pathology)</li>
                    <li>Post-operative lower limb within return-to-sport clearance</li>
                    <li>Significant balance impairment or vestibular dysfunction</li>
                    <li>Cardiovascular contraindications to explosive activity</li>
                    <li>Ensure surface is non-slip and area is clear of obstacles</li>
                  </ul>
                </div>

                {/* Score Interpretation Table */}
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 font-semibold text-slate-800 border-b">Score Interpretation (3 Circuits)</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-left px-3 py-2 font-semibold">Performance Level</th>
                          <th className="text-center px-3 py-2 font-semibold">Males</th>
                          <th className="text-center px-3 py-2 font-semibold">Females</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b bg-green-50"><td className="px-3 py-1.5"><strong className="text-green-700">Excellent</strong></td><td className="text-center text-green-700 font-mono">≤11.2s</td><td className="text-center text-green-700 font-mono">≤12.0s</td></tr>
                        <tr className="border-b bg-teal-50"><td className="px-3 py-1.5"><strong className="text-teal-700">Good</strong></td><td className="text-center text-teal-700 font-mono">11.3–13.3s</td><td className="text-center text-teal-700 font-mono">12.1–14.5s</td></tr>
                        <tr className="border-b bg-yellow-50"><td className="px-3 py-1.5"><strong className="text-yellow-700">Average</strong></td><td className="text-center text-yellow-700 font-mono">13.4–15.5s</td><td className="text-center text-yellow-700 font-mono">14.6–17.0s</td></tr>
                        <tr className="border-b bg-orange-50"><td className="px-3 py-1.5"><strong className="text-orange-700">Below Average</strong></td><td className="text-center text-orange-700 font-mono">15.6–17.8s</td><td className="text-center text-orange-700 font-mono">17.1–19.5s</td></tr>
                        <tr className="bg-red-50"><td className="px-3 py-1.5"><strong className="text-red-700">Poor</strong></td><td className="text-center text-red-700 font-mono">&gt;17.8s</td><td className="text-center text-red-700 font-mono">&gt;19.5s</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="text-xs text-slate-600 px-3 py-2 bg-slate-50 border-t">
                    <strong>Note:</strong> Best of 2–3 trials. Time of 3 complete hexagon circuits (18 jumps total). Feet must not touch lines; trial is disqualified if line contact occurs.
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                  <p className="font-semibold mb-1">⚠ Scoring & Recording</p>
                  <p>This tool records the <strong>best trial time only</strong>. Performance interpretation is automated and displayed during assessment. For official test administration, refer to primary sources and follow test protocols precisely.</p>
                </div>

                <div className="text-xs text-slate-600 space-y-2 border-t pt-3">
                  <p className="font-semibold text-slate-700">Primary Sources &amp; References</p>
                  <ul className="space-y-1.5 ml-3">
                    <li><strong>1. Johnson BL &amp; Nelson JK (1979).</strong> <em>Practical Measurements for Evaluation in Physical Education</em> (4th ed.). Burgess Publishing. — Original hexagon test description.</li>
                    <li><strong>2. Pauole K, Madole K, Garhammer J, et al. (2000).</strong> Reliability and validity of the T-test as a measure of agility. <em>J Strength Cond Res</em>, 14(4), 443–450. — Comparative agility test validation.</li>
                    <li><strong>3. NSCA (2016).</strong> <em>NSCA's Guide to Tests and Assessments</em>. Human Kinetics. — <a href="https://www.nsca.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">www.nsca.com</a></li>
                    <li><strong>4. Semenick D (1990).</strong> The T-test. <em>NSCA Journal</em>, 12(1), 36–37. — Agility assessment methodology.</li>
                  </ul>
                  <p className="text-slate-500 text-xs mt-2"><em>Not a copyrighted proprietary test. Public domain assessment widely used in athletic performance evaluation.</em></p>
                </div>
              </div>
            )}
          </div>

          {/* Protocol summary (always visible) */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Protocol Summary</p>
            <p><strong>Setup:</strong> Hexagon on floor — 24 inches (61 cm) sides.</p>
            <p><strong>Task:</strong> Start inside. Jump over each side clockwise and back for 3 complete circuits. Always face forward. Feet must not touch lines.</p>
            <p><strong>Rest:</strong> 60s between trials. Best of 2–3 trials.</p>
          </div>

          <div className="bg-slate-50 border rounded-xl p-5 text-center space-y-3">
            <p className="text-5xl font-mono font-bold text-violet-600">{isRunning ? elapsed.toFixed(2) : "0.00"}s</p>
            {!isRunning ? (
              <Button onClick={start} size="lg" className="bg-violet-600 hover:bg-violet-700 w-full max-w-xs"><Play className="w-4 h-4 mr-2" />Start Trial {trials.length + 1}</Button>
            ) : (
              <Button onClick={stop} size="lg" variant="destructive" className="w-full max-w-xs"><Square className="w-4 h-4 mr-2" />Stop & Record</Button>
            )}
          </div>

          {trials.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Trials</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {trials.map((t, i) => (
                  <div key={i} className="flex justify-between items-center bg-violet-50 px-3 py-2 rounded-lg">
                    <span>Trial {i + 1}: <span className={`font-bold ${t === best ? "text-violet-600" : "text-slate-700"}`}>{t}s{t === best ? " ★" : ""}</span></span>
                    <Button variant="ghost" size="icon" onClick={() => setTrials(trials.filter((_, x) => x !== i))}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {best && (
            <div className={`rounded-xl p-5 text-center border-2 border-violet-200 ${cat ? cat.color : "bg-violet-50"}`}>
              <p className="text-sm text-slate-500">Best Time</p>
              <p className="text-5xl font-bold text-violet-600">{best}s</p>
              <p className="text-xs text-slate-500 mt-1">Hexagon side: 24 in / 61 cm</p>
              {cat && <p className="font-bold text-xl mt-1">{cat.level}</p>}
            </div>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Footwear, errors, fatigue, surface..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={trials.length === 0} className="bg-violet-600 hover:bg-violet-700"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}