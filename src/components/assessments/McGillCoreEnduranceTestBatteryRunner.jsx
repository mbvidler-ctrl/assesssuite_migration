import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Play, Square, Info, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";

// McGill norms: Flexor:Extensor <1.0, Side:Extensor 0.55-1.0 (each side)
// Reference: McGill SM et al. (1999). Endurance times for low back stabilization exercises.

const TESTS = [
  { id: "extensor", label: "Trunk Extensor (Biering-Sørensen)", color: "bg-amber-50 border-amber-200", cue: "Prone, upper body unsupported, arms crossed. Hold position horizontally as long as possible." },
  { id: "flexor", label: "Trunk Flexor (Modified Sorensen)", color: "bg-blue-50 border-blue-200", cue: "Seated, knees bent 90°, back at 60°, arms crossed. Hold position as long as possible." },
  { id: "right_side", label: "Right Lateral Side Bridge", color: "bg-emerald-50 border-emerald-200", cue: "Right side lying, elbow under shoulder, hips lifted. Hold as long as possible." },
  { id: "left_side", label: "Left Lateral Side Bridge", color: "bg-purple-50 border-purple-200", cue: "Left side lying, elbow under shoulder, hips lifted. Hold as long as possible." },
];

function Timer({ onRecord }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const start = () => {
    startRef.current = Date.now();
    setRunning(true);
    intervalRef.current = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 100);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    const t = parseFloat(((Date.now() - startRef.current) / 1000).toFixed(1));
    setElapsed(0);
    onRecord(t);
  };

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-2xl font-bold text-slate-700 w-20">{running ? elapsed.toFixed(1) : "0.0"}s</span>
      {!running ? (
        <Button size="sm" onClick={start} className="bg-slate-700 hover:bg-slate-800"><Play className="w-3.5 h-3.5 mr-1" />Start</Button>
      ) : (
        <Button size="sm" variant="destructive" onClick={stop}><Square className="w-3.5 h-3.5 mr-1" />Stop</Button>
      )}
    </div>
  );
}

export default function McGillCoreEnduranceTestBatteryRunner({ client, onSave, onClose }) {
  const [times, setTimes] = useState({ extensor: "", flexor: "", right_side: "", left_side: "" });
  const [notes, setNotes] = useState("");
  const [expandedSection, setExpandedSection] = useState("instructions");

  const setTime = (id, val) => setTimes(t => ({ ...t, [id]: val }));

  const ext = parseFloat(times.extensor);
  const flex = parseFloat(times.flexor);
  const rSide = parseFloat(times.right_side);
  const lSide = parseFloat(times.left_side);

  const ratios = {
    flexExt: ext > 0 && flex > 0 ? (flex / ext).toFixed(2) : null,
    rightExt: ext > 0 && rSide > 0 ? (rSide / ext).toFixed(2) : null,
    leftExt: ext > 0 && lSide > 0 ? (lSide / ext).toFixed(2) : null,
    sideSym: rSide > 0 && lSide > 0 ? (Math.min(rSide, lSide) / Math.max(rSide, lSide)).toFixed(2) : null,
  };

  const ratioFlag = (val, idealMin, idealMax) => {
    if (!val) return "";
    const v = parseFloat(val);
    if (v >= idealMin && v <= idealMax) return "text-green-600";
    return "text-red-600";
  };

  const handleSave = () => {
    const anyTime = Object.values(times).some(v => v && !isNaN(parseFloat(v)));
    if (!anyTime) { toast.error("Record at least one hold time"); return; }
    const lines = TESTS.filter(t => times[t.id] && !isNaN(parseFloat(times[t.id]))).map(t => `  ${t.label}: ${times[t.id]}s`).join("\n");
    const ratioLines = [
      ratios.flexExt ? `  Flexor:Extensor: ${ratios.flexExt} (target <1.0)` : null,
      ratios.rightExt ? `  Right Side:Extensor: ${ratios.rightExt} (target 0.55–1.0)` : null,
      ratios.leftExt ? `  Left Side:Extensor: ${ratios.leftExt} (target 0.55–1.0)` : null,
      ratios.sideSym ? `  Side Bridge Symmetry: ${ratios.sideSym} (target >0.95)` : null,
    ].filter(Boolean).join("\n");
    const soap = `• McGill Core Endurance Test Battery\n\n  Hold Times:\n${lines}${ratioLines ? `\n\n  Ratios:\n${ratioLines}` : ""}${notes ? `\n\n  Notes: ${notes}` : ""}\n  Normal: Flexor:Extensor <1.0 | Side:Extensor 0.55–1.0 each side\n  Reference: McGill SM et al. (1999). Endurance times for low back stabilization exercises. Arch Phys Med Rehabil, 80(10):1157-62.`;
    onSave({ status: "completed", result_value: ext || null, notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "endurance_hold_battery", times: { extensor: ext || null, flexor: flex || null, right_side: rSide || null, left_side: lSide || null }, ratios: { flexor_extensor: ratios.flexExt ? parseFloat(ratios.flexExt) : null, right_side_extensor: ratios.rightExt ? parseFloat(ratios.rightExt) : null, left_side_extensor: ratios.leftExt ? parseFloat(ratios.leftExt) : null, side_symmetry: ratios.sideSym ? parseFloat(ratios.sideSym) : null } } });
    toast.success("McGill Test Battery saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-slate-50 to-stone-50 flex justify-between items-start">
          <div><h2 className="text-xl font-bold text-slate-900">McGill Core Endurance Test Battery</h2><p className="text-slate-500 text-sm mt-0.5">4-position trunk endurance — ratio-based interpretation</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Collapsible Clinician Guide */}
          <button
            className="w-full flex justify-between items-center px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg font-semibold text-blue-900 hover:bg-blue-100 transition-colors"
            onClick={() => setExpandedSection(expandedSection === "instructions" ? null : "instructions")}
          >
            <span>📋 Clinician Instructions & Evidence</span>
            {expandedSection === "instructions" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expandedSection === "instructions" && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6 space-y-5 text-sm">
                <div>
                  <p className="font-semibold text-blue-900 mb-2">Clinical Context: Trunk Stability & LBP Assessment</p>
                  <p className="text-blue-800">
                    Core endurance (trunk stabilizer muscle fatigue resistance) is a key component of functional trunk stability and is often impaired in individuals with low back pain (LBP), particularly those with chronic LBP or recurrent episodes. The McGill Core Endurance Test Battery quantifies endurance capacity of four key trunk stabilizer groups and uses ratio-based interpretation to identify muscle imbalances that may contribute to LBP risk.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-blue-900 mb-2">Test Administration: Key Points</p>
                  <ul className="text-blue-800 list-disc list-inside space-y-2">
                    <li><strong>Warm-up:</strong> 5 min light activity before testing; ensure patient understands positions and cues.</li>
                    <li><strong>Termination Criteria:</strong> Stop when patient cannot maintain neutral spine/position (verify form) or requests to stop. Do NOT encourage "maximal" effort at pain cost; stop if pain increases significantly.</li>
                    <li><strong>Best of 2 Trials:</strong> Conduct 2 trials per position (with 5-min rest between trials); record the longer of 2 times for analysis.</li>
                    <li><strong>Order:</strong> Typically extensor → flexor → right side → left side (less fatiguing to more fatiguing) to minimize fatigue carryover.</li>
                    <li><strong>Measurement:</strong> Use stopwatch (preferred) or electronic timer. Document to 0.1 second precision.</li>
                    <li><strong>Form Integrity:</strong> Poor form invalidates results. Clinician must observe carefully for loss of neutral spine, hip drop (side bridges), or excessive lumbar extension (flexor test).</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-blue-900 mb-2">The 4 Test Positions — Setup, Cues & Common Errors</p>
                  <div className="bg-white p-3 rounded border border-blue-200 space-y-4">
                    <div className="border-l-4 border-amber-400 pl-3">
                      <p className="font-semibold text-amber-900">🔴 Trunk Extensor Hold (Biering-Sørensen)</p>
                      <p className="text-blue-800 text-xs mt-1"><strong>Setup:</strong> Prone on examination table, pelvis at table edge, legs supported (or weighted). Upper body off table, arms crossed over chest. Maintain neutral (horizontal) spine position — not extended.</p>
                      <p className="text-blue-800 text-xs mt-1"><strong>Cue:</strong> "Hold this horizontal position as long as you can. Don't let your upper body drop or extend upward."</p>
                      <p className="text-blue-800 text-xs mt-1"><strong>Common Errors:</strong> Lumbar hyperextension (increases intradiscal pressure; unsafe in LBP); spinal sagging (loss of neutral). Corrective: "Keep your spine straight, not arched."</p>
                    </div>

                    <div className="border-l-4 border-blue-400 pl-3">
                      <p className="font-semibold text-blue-900">🔵 Trunk Flexor Hold (Modified Sorensen)</p>
                      <p className="text-blue-800 text-xs mt-1"><strong>Setup:</strong> Seated, knees bent 90° (feet supported or held). Back at 60° recline (not full recline). Arms crossed over chest. Maintain position without backrest contact.</p>
                      <p className="text-blue-800 text-xs mt-1"><strong>Cue:</strong> "Lean back to 60° and hold. Keep your core tight. Don't let yourself slide back toward the rest."</p>
                      <p className="text-blue-800 text-xs mt-1"><strong>Common Errors:</strong> Excessive recline (&gt;60°, reduces abdominal demand); using upper back/arms for support; loss of neutral spine. Corrective: "Sit up straighter" or "Tighten your abdomen more."</p>
                    </div>

                    <div className="border-l-4 border-emerald-400 pl-3">
                      <p className="font-semibold text-emerald-900">🟢 Right Lateral Side Bridge</p>
                      <p className="text-blue-800 text-xs mt-1"><strong>Setup:</strong> Right side-lying on floor or mat. Elbow under shoulder, knees bent 90° (or straight for advanced). Hips off ground, body straight from ear to ankle. Lower arm across chest; upper arm supported.</p>
                      <p className="text-blue-800 text-xs mt-1"><strong>Cue:</strong> "Lift your hips off the ground. Keep your body in a straight line. Don't let your hips drop or rotate."</p>
                      <p className="text-blue-800 text-xs mt-1"><strong>Common Errors:</strong> Hip drop (most common; reduces challenge to obliques); trunk rotation (loss of neutral); insufficient lift. Corrective: "Tighten your side muscles and lift your hips higher."</p>
                    </div>

                    <div className="border-l-4 border-purple-400 pl-3">
                      <p className="font-semibold text-purple-900">🟣 Left Lateral Side Bridge</p>
                      <p className="text-blue-800 text-xs mt-1"><strong>Setup:</strong> Same as right side bridge, but left side down.</p>
                      <p className="text-blue-800 text-xs mt-1"><strong>Cue:</strong> (same as right)</p>
                      <p className="text-blue-800 text-xs mt-1"><strong>Common Errors:</strong> (same as right)</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-blue-900 mb-2">Normative Data & Interpretation</p>
                  <div className="bg-white p-3 rounded border border-blue-200 space-y-2">
                    <p className="text-blue-800 text-xs"><strong>Healthy Young Adults (18–35y, McGill 1999):</strong></p>
                    <ul className="text-blue-800 text-xs list-disc list-inside ml-2 space-y-1">
                      <li>Extensor: 144 ± 34 s</li>
                      <li>Flexor: 116 ± 41 s (note: typically lower than extensor)</li>
                      <li>Right Side: 75 ± 20 s</li>
                      <li>Left Side: 75 ± 20 s</li>
                    </ul>

                    <p className="text-blue-800 text-xs mt-2"><strong>Low Back Pain Patients:</strong> Generally show reduced absolute times AND/OR altered ratios (imbalance).</p>

                    <p className="text-blue-800 text-xs mt-2"><strong>⚠ï¸ Most Important: Ratio-Based Interpretation</strong></p>
                    <p className="text-blue-800 text-xs italic">Do NOT rely on absolute times alone. Ratios identify structural imbalances associated with LBP risk:</p>
                    <ul className="text-blue-800 text-xs list-disc list-inside ml-2 space-y-1 mt-1">
                      <li><strong>Flexor:Extensor Ratio &lt;1.0:</strong> Normal (extensor &gt; flexor). Ratio &gt;1.0 indicates flexor dominance or extensor weakness → anterior core dominance → ↑ LBP risk.</li>
                      <li><strong>Side Bridge:Extensor Ratios 0.55–1.0:</strong> Normal. Ratio &lt;0.55 indicates lateral weakness; &gt;1.0 indicates lateral dominance (unusual).</li>
                      <li><strong>Side Bridge Symmetry &gt;0.95:</strong> Indicates balanced oblique function. Asymmetry (&lt;0.95) suggests unilateral weakness or dysfunction.</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-blue-900 mb-2">Clinical Interpretation & Decision-Making</p>
                  <div className="bg-white p-3 rounded border border-blue-200 space-y-2 text-xs">
                    <p className="text-blue-800"><strong>Finding: Low absolute times (all &lt;50s)</strong></p>
                    <p className="text-blue-800">→ Generalized core fatigue; indicates need for general endurance training (strengthening + conditioning).</p>

                    <p className="text-blue-800 mt-2"><strong>Finding: Flexor:Extensor &gt;1.0</strong></p>
                    <p className="text-blue-800">→ Anterior core dominance / extensor weakness; common in desk workers, persistent flexed postures. Prescribe extensor-focused exercises (prone holds, back extensions, bridges).</p>

                    <p className="text-blue-800 mt-2"><strong>Finding: Side Bridge &lt;0.55 relative to extensor</strong></p>
                    <p className="text-blue-800">→ Lateral stability deficit; risk for lateral shift/scoliosis mechanics. Prescribe side bridges, lateral planks, oblique activation.</p>

                    <p className="text-blue-800 mt-2"><strong>Finding: Side Bridge Asymmetry (&lt;0.95)</strong></p>
                    <p className="text-blue-800">→ Unilateral weakness; may indicate asymmetrical load history or motor control deficit. Focus training on weaker side.</p>

                    <p className="text-blue-800 mt-2"><strong>Finding: All ratios normal but patient reports pain during test</strong></p>
                    <p className="text-blue-800">→ May indicate motor control dysfunction, poor position sense, or fear-avoidance behavior rather than endurance deficit. Consider Motor Control Stabilization training.</p>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-blue-900 mb-2">Clinical Use in Rehabilitation</p>
                  <ul className="text-blue-800 list-disc list-inside space-y-1 text-xs">
                    <li><strong>Baseline Assessment:</strong> Establish endurance profile pre-treatment; identify muscle imbalances guiding exercise prescription.</li>
                    <li><strong>Monitoring Progression:</strong> Retest at 4–6-week intervals to verify training response (expect 10–20% improvement with structured training).</li>
                    <li><strong>Return-to-Sport/Work:</strong> Use McGill battery + functional assessments (single-leg stance, hop tests, loaded tasks) to clear for return.</li>
                    <li><strong>Compliance Monitoring:</strong> Improving McGill ratios indicate compliance with prescribed stabilization training.</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-blue-900 mb-2">Contraindications & Safety</p>
                  <ul className="text-blue-800 list-disc list-inside space-y-1 text-xs">
                    <li><strong>Acute LBP:</strong> Generally avoid; risk of pain exacerbation. Wait 2–3 weeks for acute pain to settle.</li>
                    <li><strong>Severe Osteoporosis / Vertebral Compression Fracture:</strong> Contraindicated (prone/lateral loading dangerous).</li>
                    <li><strong>Recent Spinal Surgery:</strong> Follow surgeon's clearance; typically avoid &lt;6–8 weeks post-op.</li>
                    <li><strong>Neurological Deficit:</strong> Avoid if motor weakness prevents safe positioning.</li>
                    <li><strong>Stop Testing if:</strong> Significant pain increase, paresthesias, loss of balance/control, patient distress.</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-blue-900 mb-2">Evidence Base & References</p>
                  <div className="bg-white p-3 rounded border border-blue-200 space-y-2 text-xs">
                    <p><strong>Primary Validation:</strong> McGill SM, Childs A, Liebenson C. (1999). Endurance times for low back stabilization exercises: clinical targets for testing and training from a normal population. <em>Arch Phys Med Rehabil, 80</em>(8):941–944. DOI: <a href="https://doi.org/10.1016/S0003-9993(99)90087-4" target="_blank" className="text-blue-600 hover:underline inline-flex items-center gap-1">10.1016/S0003-9993(99)90087-4 <ExternalLink className="w-3 h-3" /></a></p>
                    <p><strong>Clinical LBP Application:</strong> McGill SM. (2015). <em>Low Back Disorders: Evidence-Based Prevention and Rehabilitation</em> (3rd ed.). Champaign, IL: Human Kinetics. (Foundational text on core stabilization principles.)</p>
                    <p><strong>Ratio-Based Interpretation:</strong> Saragiotto BT, Maher CG, Yamato TP, et al. (2016). Motor control exercise for non-specific low back pain: a systematic review within the framework of the Cochrane Back and Neck Review Group. <em>J Orthop Sports Phys Ther, 46</em>(1):13–29.</p>
                    <p><strong>Clinical Guidelines:</strong> Australian Physiotherapy Association (APA) & Exercise & Sports Science Australia (ESSA) recommend McGill Core Battery as part of comprehensive LBP assessment.</p>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-blue-900 mb-2">Quick Position Reference (Setup Images)</p>
                  <p className="text-blue-800 text-xs">For detailed anatomical diagrams and setup photos, refer to McGill's official resources or clinical guidelines from ESSA / APA. Ensure clinician can demonstrate correct form before testing patient.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {TESTS.map(t => (
            <Card key={t.id} className={`border ${t.color}`}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t.label}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-slate-600 italic">{t.cue}</p>
                <div className="flex items-end gap-4">
                  <Timer onRecord={val => setTime(t.id, val.toString())} />
                  <div>
                    <Label className="text-xs">Manual Entry (s)</Label>
                    <Input type="number" step="0.1" value={times[t.id]} onChange={e => setTime(t.id, e.target.value)} className="w-24 mt-0.5" placeholder="0.0" />
                  </div>
                  {times[t.id] && <span className="font-bold text-lg text-slate-700">{times[t.id]}s</span>}
                </div>
              </CardContent>
            </Card>
          ))}

          {(ratios.flexExt || ratios.rightExt || ratios.leftExt || ratios.sideSym) && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Ratio Analysis</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                {ratios.flexExt && <div><p className="text-slate-500 text-xs">Flexor:Extensor</p><p className={`font-bold text-lg ${ratioFlag(ratios.flexExt, 0, 1.0)}`}>{ratios.flexExt} <span className="text-xs text-slate-400">(target &lt;1.0)</span></p></div>}
                {ratios.rightExt && <div><p className="text-slate-500 text-xs">Right Side:Extensor</p><p className={`font-bold text-lg ${ratioFlag(ratios.rightExt, 0.55, 1.0)}`}>{ratios.rightExt} <span className="text-xs text-slate-400">(0.55–1.0)</span></p></div>}
                {ratios.leftExt && <div><p className="text-slate-500 text-xs">Left Side:Extensor</p><p className={`font-bold text-lg ${ratioFlag(ratios.leftExt, 0.55, 1.0)}`}>{ratios.leftExt} <span className="text-xs text-slate-400">(0.55–1.0)</span></p></div>}
                {ratios.sideSym && <div><p className="text-slate-500 text-xs">Side Bridge Symmetry</p><p className={`font-bold text-lg ${ratioFlag(ratios.sideSym, 0.95, 1.05)}`}>{ratios.sideSym} <span className="text-xs text-slate-400">(&gt;0.95)</span></p></div>}
              </CardContent>
            </Card>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Pain, position quality, termination reason..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-slate-700 hover:bg-slate-800"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}