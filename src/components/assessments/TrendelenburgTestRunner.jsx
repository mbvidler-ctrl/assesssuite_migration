import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, X, Play, Square, ChevronDown, ChevronUp } from "lucide-react";

const SIGNS = [
  { key: "hip_drop", label: "Contralateral Hip Drop", description: "Pelvis on the non-standing side drops below horizontal â€” positive Trendelenburg sign, indicates ipsilateral gluteus medius/minimus weakness." },
  { key: "trunk_lurch", label: "Trunk Lateral Lean / Compensatory Lurch", description: "Client shifts trunk toward the standing leg to unload weak abductors â€” Trendelenburg gait compensation." },
  { key: "early_drop", label: "Inability to Hold 30 Seconds", description: "Foot dropped before 30s due to loss of balance or weakness. Note time of onset." },
  { key: "pelvic_obliquity", label: "Pelvic Obliquity / Rotation", description: "Visible pelvic rotation or obliquity during single-leg stance beyond expected." },
];

function SidePanel({ side, color, data, onChange }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  const startTimer = () => {
    setElapsed(0);
    setRunning(true);
    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev >= 30) {
          clearInterval(timerRef.current);
          setRunning(false);
          return 30;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    clearInterval(timerRef.current);
    setRunning(false);
  };

  const toggleSign = (key) => {
    const signs = data.signs || {};
    onChange({ ...data, signs: { ...signs, [key]: !signs[key] } });
  };

  const anyPositive = SIGNS.some(s => data.signs?.[s.key]);
  const overallResult = data.result;

  return (
    <div className={`rounded-xl border-2 p-4 space-y-4 ${color}`}>
      <h3 className="font-bold text-slate-800 text-base">{side} Leg</h3>

      {/* Timer */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-slate-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${elapsed >= 30 ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${Math.min(100, (elapsed / 30) * 100)}%` }}
          />
        </div>
        <span className="text-sm font-mono font-bold text-slate-700 w-14 text-right">{elapsed}s / 30s</span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={startTimer} disabled={running} className="flex-1">
          <Play className="w-3.5 h-3.5 mr-1" />Start
        </Button>
        <Button size="sm" variant="outline" onClick={stopTimer} disabled={!running} className="flex-1">
          <Square className="w-3.5 h-3.5 mr-1" />Stop
        </Button>
      </div>

      {/* Observed Signs */}
      <div>
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Observed Signs</p>
        <div className="space-y-2">
          {SIGNS.map(sign => (
            <label key={sign.key} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
              <Checkbox
                checked={!!data.signs?.[sign.key]}
                onCheckedChange={() => toggleSign(sign.key)}
                className="mt-0.5 shrink-0"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">{sign.label}</p>
                <p className="text-xs text-slate-500 leading-snug mt-0.5">{sign.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Overall Result for this side */}
      <div>
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Overall Result â€” {side}</p>
        <div className="flex gap-2">
          {["Positive", "Negative", "Equivocal"].map(r => (
            <button
              key={r}
              onClick={() => onChange({ ...data, result: r })}
              className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all ${
                overallResult === r
                  ? r === "Positive" ? "bg-red-500 border-red-500 text-white"
                    : r === "Negative" ? "bg-green-500 border-green-500 text-white"
                    : "bg-yellow-400 border-yellow-400 text-white"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        {anyPositive && !overallResult && (
          <p className="text-xs text-amber-600 mt-1">Signs observed â€” please select a result above.</p>
        )}
      </div>
    </div>
  );
}

export default function TrendelenburgTestRunner({ client, onSave, onClose }) {
  const [left, setLeft] = useState({ signs: {}, result: null });
  const [right, setRight] = useState({ signs: {}, result: null });
  const [notes, setNotes] = useState("");
  const [refOpen, setRefOpen] = useState(false);

  const canSave = left.result || right.result;

  const handleSave = () => {
    const leftSigns = SIGNS.filter(s => left.signs?.[s.key]).map(s => s.label);
    const rightSigns = SIGNS.filter(s => right.signs?.[s.key]).map(s => s.label);

    const overallResult = (left.result === "Positive" || right.result === "Positive") ? "Positive" : "Negative";

    let soap = `â€¢ Trendelenburg Test\n`;
    soap += `  Left: ${left.result || "Not recorded"}${leftSigns.length ? ` â€” Signs: ${leftSigns.join(", ")}` : ""}\n`;
    soap += `  Right: ${right.result || "Not recorded"}${rightSigns.length ? ` â€” Signs: ${rightSigns.join(", ")}` : ""}\n`;
    soap += `  Overall: ${overallResult}\n`;
    if (notes) soap += `  Notes: ${notes}\n`;

    onSave({
      status: "completed",
      result_value: overallResult === "Positive" ? 1 : 0,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
      additional_data: {
        measurement_type: "Trendelenburg_Test",
        left_result: left.result,
        right_result: right.result,
        left_signs: leftSigns,
        right_signs: rightSigns,
        overall_result: overallResult,
        soap_text: soap,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-4 rounded-t-xl flex items-center justify-between z-10">
          <div>
            <h2 className="text-white font-bold text-lg">Trendelenburg Test</h2>
            <p className="text-indigo-200 text-xs">Hip Abductor Strength â€” Bilateral Assessment</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">Ã—</button>
        </div>

        <div className="p-5 space-y-5">

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm space-y-2">
            <p className="font-semibold text-blue-900">ðŸ“‹ Administration Instructions</p>
            <ol className="space-y-1.5 text-blue-800 list-none">
              {[
                "Client stands facing clinician on a firm, flat surface.",
                "Instruct client to stand on one leg (test the symptomatic/affected side first) and flex the opposite knee to approximately 90Â°.",
                "Patient instruction: \"Stand on your [left/right] leg and lift the other foot off the ground. Hold as still as you can for 30 seconds.\"",
                "Observe the pelvis and trunk from the front â€” note any pelvic drop, trunk sway, or compensatory movements.",
                "Test is positive if pelvis drops on the non-standing side within 30 seconds.",
                "Rest 1â€“2 minutes between sides. Test both sides and compare.",
              ].map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <div className="bg-blue-100 rounded-lg p-2.5 text-xs text-blue-800 mt-1">
              <p className="font-semibold">Key Anatomy:</p>
              <p>The <strong>ipsilateral gluteus medius</strong> (standing leg) must contract eccentrically to prevent contralateral pelvic drop. Weakness = pelvis drops on the <em>opposite</em> side to the weak muscle.</p>
            </div>
          </div>

          {/* Bilateral Testing Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SidePanel side="Left" color="border-blue-200 bg-blue-50/20" data={left} onChange={setLeft} />
            <SidePanel side="Right" color="border-emerald-200 bg-emerald-50/20" data={right} onChange={setRight} />
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional observations, context, hip history, pain provocation..."
              className="mt-1.5"
            />
          </div>

          {/* Diagnostic Accuracy */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
            <p className="font-semibold text-slate-700 mb-2">ðŸ“Š Diagnostic Accuracy</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["Sensitivity (hip abductor weakness)", "~73%"],
                ["Specificity", "~77%"],
                ["Positive LR", "~3.2"],
                ["Negative LR", "~0.35"],
              ].map(([label, val]) => (
                <div key={label} className="bg-white rounded-lg border border-slate-200 p-2 flex justify-between items-center">
                  <span className="text-slate-600">{label}</span>
                  <span className="font-bold text-slate-800">{val}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">Common in: hip OA, post-hip surgery, Legg-CalvÃ©-Perthes, IT band syndrome, neurological conditions.</p>
          </div>

          {/* References â€” collapsible */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setRefOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-semibold text-slate-700"
            >
              <span>ðŸ“– References</span>
              {refOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {refOpen && (
              <div className="p-4 space-y-3 text-xs text-slate-600 bg-white">
                {[
                  {
                    authors: "Trendelenburg F. (1895).",
                    title: "Ueber den Gang bei angeborener HÃ¼ftgelenksluxation.",
                    journal: "Deutsche Medicinische Wochenschrift, 21(21), 21â€“24.",
                    detail: "Original description of the pelvic drop sign during single-leg stance.",
                  },
                  {
                    authors: "Hardcastle P & Nade S. (1985).",
                    title: "The significance of the Trendelenburg test.",
                    journal: "Journal of Bone and Joint Surgery (Br), 67(5), 741â€“746.",
                    detail: "Established diagnostic accuracy values and clinical significance. Sensitivity ~73%, Specificity ~77%.",
                  },
                  {
                    authors: "Youdas JW et al. (2010).",
                    title: "Electromyographic analysis of trunk and hip musculature during single-leg stance.",
                    journal: "Journal of Orthopaedic & Sports Physical Therapy, 40(3), 152â€“160.",
                    detail: "Quantified gluteus medius activation during single-leg tasks relevant to Trendelenburg assessment.",
                  },
                  {
                    authors: "Reiman MP et al. (2012).",
                    title: "Diagnostic accuracy of clinical tests for assessment of hamstring injury.",
                    journal: "Journal of Orthopaedic & Sports Physical Therapy, 43(4).",
                    detail: "Context on hip abductor assessment accuracy within clinical orthopaedic tests.",
                  },
                ].map((ref, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-0.5">
                    <p className="font-semibold text-slate-700">{i + 1}. {ref.authors}</p>
                    <p className="italic text-slate-600">{ref.title}</p>
                    <p className="text-slate-500">{ref.journal}</p>
                    <p className="text-indigo-600">{ref.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-4 flex justify-between items-center rounded-b-xl">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-1.5" />Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Save className="w-4 h-4 mr-1.5" />Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}