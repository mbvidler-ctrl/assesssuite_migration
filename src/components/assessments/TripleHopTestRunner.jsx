import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { todayLocal } from "@/lib/localDate";

function getLSI(tested, contralateral) {
  if (!tested || !contralateral || parseFloat(contralateral) === 0) return null;
  return ((parseFloat(tested) / parseFloat(contralateral)) * 100).toFixed(1);
}

function getLSICategory(lsi) {
  const v = parseFloat(lsi);
  if (isNaN(v)) return null;
  if (v >= 90) return { label: "Symmetrical (≥90%) — RTS criteria met", color: "text-green-700", bg: "bg-green-50 border-green-200" };
  if (v >= 80) return { label: "Mild asymmetry (80–89%) — monitor", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" };
  return { label: "Significant asymmetry (<80%) — not RTS ready", color: "text-red-700", bg: "bg-red-50 border-red-200" };
}

export default function TripleHopTestRunner({ client, onSave, onClose }) {
  const [side, setSide] = useState("right");
  const [hops, setHops] = useState({ right: ["", "", ""], left: ["", "", ""] });
  const [notes, setNotes] = useState("");
  const [showInstructions, setShowInstructions] = useState(true);

  const updateHop = (leg, idx, val) => {
    setHops(h => ({ ...h, [leg]: h[leg].map((v, i) => i === idx ? val : v) }));
  };

  const bestFor = (leg) => {
    const valid = hops[leg].map(parseFloat).filter(v => !isNaN(v) && v > 0);
    return valid.length > 0 ? Math.max(...valid).toFixed(1) : null;
  };

  const bestRight = bestFor("right");
  const bestLeft = bestFor("left");
  const lsi = bestRight && bestLeft
    ? (side === "right" ? getLSI(bestRight, bestLeft) : getLSI(bestLeft, bestRight))
    : null;
  const lsiCat = lsi ? getLSICategory(lsi) : null;

  const handleSave = () => {
    const tested = side === "right" ? bestRight : bestLeft;
    const contra = side === "right" ? bestLeft : bestRight;
    const soapText = [
      `• Triple Hop Test for Distance`,
      `  Tested limb: ${side === "right" ? "Right" : "Left"}`,
      bestRight ? `  Right — Best: ${bestRight} cm (trials: ${hops.right.filter(v => v).join(", ")} cm)` : "",
      bestLeft ? `  Left — Best: ${bestLeft} cm (trials: ${hops.left.filter(v => v).join(", ")} cm)` : "",
      lsi ? `  Limb Symmetry Index (LSI): ${lsi}%` : "",
      lsiCat ? `  Interpretation: ${lsiCat.label}` : "",
      notes ? `  Notes: ${notes}` : "",
      `  LSI ≥90% required for return-to-sport clearance (Noyes et al., 1991)`,
    ].filter(Boolean).join("\n");

    onSave({
      result_value: tested ? parseFloat(tested) : null,
      notes,
      assessment_date: todayLocal(),
      additional_data: {
        soap_text: soapText,
        tested_side: side,
        best_right_cm: bestRight ? parseFloat(bestRight) : null,
        best_left_cm: bestLeft ? parseFloat(bestLeft) : null,
        lsi_percent: lsi ? parseFloat(lsi) : null,
        lsi_category: lsiCat?.label,
        right_trials: hops.right.map(parseFloat).filter(v => !isNaN(v)),
        left_trials: hops.left.map(parseFloat).filter(v => !isNaN(v)),
      }
    });
  };

  return (
    <div className="space-y-5 p-1">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Triple Hop Test for Distance</h2>
          <p className="text-sm text-slate-500">Lower limb power &amp; return-to-sport symmetry assessment</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {/* Instructions */}
      <div className="border border-blue-200 rounded-lg overflow-hidden">
        <button onClick={() => setShowInstructions(v => !v)}
          className="w-full flex justify-between items-center bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          📋 Protocol &amp; Instructions
          {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showInstructions && (
          <div className="bg-white p-4 text-sm space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                <p className="font-bold text-slate-800">Setup</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li>Tape measure on firm flat surface</li>
                  <li>Starting line marked at 0 cm</li>
                  <li>Athlete starts behind line on one foot</li>
                  <li>Usual footwear (consistent between tests)</li>
                </ul>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
                <p className="font-bold text-blue-800">Execution</p>
                <ul className="list-disc pl-4 space-y-1 text-blue-700">
                  <li>Perform 3 consecutive single-leg hops forward</li>
                  <li>Land and maintain balance on last hop</li>
                  <li>Measure from start line to heel of landing foot</li>
                  <li>3 trials per limb — best recorded</li>
                </ul>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
              <p className="font-semibold text-amber-800">LSI &amp; Return to Sport</p>
              <p className="text-amber-700">Limb Symmetry Index (LSI) = (tested/contralateral) × 100</p>
              <p className="text-amber-700"><strong>≥90%</strong> = symmetrical — RTS criteria met</p>
              <p className="text-amber-700"><strong>80–89%</strong> = mild deficit — continue rehab</p>
              <p className="text-amber-700"><strong>&lt;80%</strong> = significant deficit — not RTS ready</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
              <p className="font-semibold text-red-800">Safety</p>
              <p className="text-red-700">Ensure full warm-up. Contraindicated in active pain or &lt;6 weeks post-surgery. Land softly — assess knee valgus on landing.</p>
            </div>
          </div>
        )}
      </div>

      {/* Normative Table */}
      <div className="border border-slate-200 rounded-lg p-3 text-sm">
        <p className="font-semibold text-slate-700 mb-2">📊 Normative Reference Values (cm)</p>
        <table className="w-full text-xs border border-slate-300 rounded overflow-hidden">
          <thead className="bg-slate-200">
            <tr><th className="p-2 text-left">Population</th><th className="p-2 text-center">Males</th><th className="p-2 text-center">Females</th></tr>
          </thead>
          <tbody>
            <tr className="border-t"><td className="p-2">Healthy adults (20–40 yrs)</td><td className="p-2 text-center">~500–560</td><td className="p-2 text-center">~380–430</td></tr>
            <tr className="border-t bg-white"><td className="p-2">Post-ACL reconstruction (RTS)</td><td className="p-2 text-center" colSpan={2}>LSI ≥ 90% of contralateral</td></tr>
          </tbody>
        </table>
        <p className="text-xs text-slate-500 mt-1">Source: Noyes et al. (1991); Reid et al. (2007). Values vary by sport and fitness level.</p>
      </div>

      {/* Data Entry */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-4">
        <div>
          <Label className="text-xs font-semibold text-slate-600">Tested / Injured Side</Label>
          <div className="flex gap-2 mt-1">
            {["right", "left"].map(s => (
              <button key={s} onClick={() => setSide(s)}
                className={`px-4 py-1.5 text-sm rounded-lg border font-medium ${side === s ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-300"}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {(["right", "left"]).map(leg => (
          <div key={leg}>
            <p className="text-sm font-semibold text-slate-700 mb-2">{leg === "right" ? "Right" : "Left"} Leg — Hop Distances (cm)</p>
            <div className="grid grid-cols-3 gap-3">
              {hops[leg].map((val, idx) => (
                <div key={idx}>
                  <Label className="text-xs text-slate-500">Trial {idx + 1}</Label>
                  <Input type="number" step="0.5" value={val} onChange={e => updateHop(leg, idx, e.target.value)}
                    placeholder="e.g. 495" className="mt-1 text-sm h-8" />
                </div>
              ))}
            </div>
            {bestFor(leg) && <p className="text-xs font-semibold text-blue-700 mt-1">Best: {bestFor(leg)} cm</p>}
          </div>
        ))}
      </div>

      {/* LSI Result */}
      {lsi && lsiCat && (
        <div className={`rounded-lg border px-4 py-3 ${lsiCat.bg}`}>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold text-2xl text-slate-900">{lsi}%</p>
              <p className="text-xs text-slate-600">Limb Symmetry Index ({side === "right" ? "Right" : "Left"} / {side === "right" ? "Left" : "Right"})</p>
            </div>
            <p className={`text-sm font-semibold text-right ${lsiCat.color}`}>{lsiCat.label}</p>
          </div>
        </div>
      )}

      <div>
        <Label className="text-sm font-semibold text-slate-700">Clinical Notes</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="Landing quality, knee valgus, pain on landing, patient confidence, footwear..." className="mt-1 text-sm" />
      </div>

      {/* References */}
      <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">📖 References</p>
        <p>1. Noyes FR, Barber SD, &amp; Mangine RE. (1991). Abnormal lower limb symmetry determined by function hop tests after anterior cruciate ligament rupture. <em>American Journal of Sports Medicine</em>, 19(5), 513–518.</p>
        <p>2. Reid A, Birmingham TB, Stratford PW, Alcock GK, &amp; Giffin JR. (2007). Hop testing provides a reliable and valid outcome measure during rehabilitation after anterior cruciate ligament reconstruction. <em>Physical Therapy</em>, 87(3), 337–349.</p>
        <p>3. Grindem H, Snyder-Mackler L, Moksnes H, et al. (2016). Simple decision rules can reduce reinjury risk by 84% after ACL reconstruction. <em>British Journal of Sports Medicine</em>, 50(13), 804–808.</p>
      </div>

      <div className="flex justify-between pt-2 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={!bestRight && !bestLeft} className="bg-green-600 hover:bg-green-700 text-white">
          Save Results
        </Button>
      </div>
    </div>
  );
}