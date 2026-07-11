import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Save, X, RotateCcw, AlertTriangle, CheckCircle2,
  Info, ExternalLink, Activity, Zap, AlertCircle, Target
} from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getBestDistance = (t1, t2, t3) => {
  const vals = [t1, t2, t3].map(v => parseFloat(v)).filter(v => !isNaN(v) && v > 0);
  return vals.length ? Math.max(...vals) : null;
};

const getFastestTime = (t1, t2) => {
  const vals = [t1, t2].map(v => parseFloat(v)).filter(v => !isNaN(v) && v > 0);
  return vals.length ? Math.min(...vals) : null;
};

const calcLSI = (injured, uninjured) => {
  if (!injured || !uninjured || uninjured === 0) return null;
  return ((injured / uninjured) * 100).toFixed(1);
};

// For timed hop: lower = better, so LSI = uninjured/injured * 100
const calcTimedLSI = (injuredTime, uninjuredTime) => {
  if (!injuredTime || !uninjuredTime || injuredTime === 0) return null;
  return ((uninjuredTime / injuredTime) * 100).toFixed(1);
};

const lsiColor = (lsi) => {
  if (!lsi) return { bg: "bg-slate-100", text: "text-slate-500", border: "border-slate-200", label: "—" };
  const v = parseFloat(lsi);
  if (v >= 90) return { bg: "bg-green-100", text: "text-green-800", border: "border-green-300", label: "Good — RTS criteria met" };
  if (v >= 85) return { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300", label: "Borderline — address deficits" };
  return { bg: "bg-red-100", text: "text-red-800", border: "border-red-300", label: "Significant asymmetry — defer RTS" };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, color = "slate", subtitle }) {
  const bg = {
    slate: "bg-slate-700", blue: "bg-blue-700", green: "bg-green-700",
    purple: "bg-purple-700", amber: "bg-amber-600", red: "bg-red-600",
    teal: "bg-teal-700", indigo: "bg-indigo-700"
  }[color] || "bg-slate-700";
  return (
    <div className={`${bg} text-white rounded-lg px-4 py-3`}>
      <div className="flex items-center gap-2 font-semibold text-sm">
        {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
        {title}
      </div>
      {subtitle && <p className="text-xs mt-0.5 opacity-80">{subtitle}</p>}
    </div>
  );
}

function YesNoButtons({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[{ v: true, l: "Yes", c: "green" }, { v: false, l: "No", c: "red" }].map(({ v, l, c }) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)}
          className={`text-sm px-4 py-1.5 rounded border font-medium transition-colors ${
            value === v
              ? c === "green" ? "bg-green-600 text-white border-green-600" : "bg-red-500 text-white border-red-500"
              : "border-slate-300 hover:bg-slate-50 text-slate-700"
          }`}>{l}</button>
      ))}
    </div>
  );
}

function RadioButtons({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt.val} type="button" onClick={() => onChange(opt.val)}
          className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
            value === opt.val ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 hover:bg-slate-50 text-slate-700"
          }`}>{opt.label}</button>
      ))}
    </div>
  );
}

function LSIPill({ lsi, label }) {
  const c = lsiColor(lsi);
  return (
    <div className={`border rounded-xl px-3 py-2.5 text-center ${c.bg} ${c.border}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className={`text-xl font-bold ${c.text}`}>{lsi ? `${lsi}%` : "—"}</p>
      <p className={`text-xs mt-0.5 ${c.text}`}>{lsi ? c.label : "No data"}</p>
    </div>
  );
}

// ─── Hop Test Panel (bilateral entry) ─────────────────────────────────────────

function HopTestPanel({ title, subtitle, unit = "cm", trialsPerSide = 3, isTimed = false,
  leftTrials, setLeftTrials, rightTrials, setRightTrials,
  leftObs, setLeftObs, rightObs, setRightObs, injuredSide, lsi }) {

  const lsiC = lsiColor(lsi);

  const setTrial = (side, idx, val) => {
    if (side === "left") {
      const n = [...leftTrials]; n[idx] = val; setLeftTrials(n);
    } else {
      const n = [...rightTrials]; n[idx] = val; setRightTrials(n);
    }
  };

  const leftBest = isTimed
    ? getFastestTime(leftTrials[0], leftTrials[1])
    : getBestDistance(leftTrials[0], leftTrials[1], leftTrials[2]);
  const rightBest = isTimed
    ? getFastestTime(rightTrials[0], rightTrials[1])
    : getBestDistance(rightTrials[0], rightTrials[1], rightTrials[2]);

  const STABILITY_OPTIONS = [
    { val: "stable", label: "Stable landing" },
    { val: "minor_sway", label: "Minor sway" },
    { val: "significant_sway", label: "Significant sway" },
    { val: "stumble", label: "Stumble/step" },
    { val: "failed", label: "Failed attempt" },
  ];

  return (
    <Card className="border-2 border-slate-200">
      <CardHeader className="bg-slate-50 py-3 px-4">
        <CardTitle className="text-sm text-slate-900">{title}</CardTitle>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {["left", "right"].map(side => {
            const trials = side === "left" ? leftTrials : rightTrials;
            const setT = (i, v) => setTrial(side, i, v);
            const obs = side === "left" ? leftObs : rightObs;
            const setO = side === "left" ? setLeftObs : setRightObs;
            const best = side === "left" ? leftBest : rightBest;
            const isInjured = injuredSide === side;

            return (
              <div key={side} className={`rounded-lg border p-3 space-y-3 ${isInjured ? "border-orange-300 bg-orange-50/30" : "border-slate-200"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800 capitalize">{side} Leg</p>
                  <div className="flex gap-1">
                    {isInjured && <Badge className="text-xs bg-orange-100 text-orange-700 border border-orange-300">Injured</Badge>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  {Array.from({ length: trialsPerSide }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-12">Trial {i + 1}</span>
                      <Input type="number" step="0.1" min="0" value={trials[i] || ""} onChange={e => setT(i, e.target.value)}
                        placeholder={`${unit}`} className="h-8 text-sm" />
                    </div>
                  ))}
                </div>

                {best !== null && (
                  <div className="bg-slate-100 rounded px-2 py-1.5 text-xs">
                    <span className="text-slate-600">{isTimed ? "Fastest" : "Best"}:</span>
                    <span className="font-bold ml-1">{best} {unit}</span>
                  </div>
                )}

                <div>
                  <p className="text-xs text-slate-500 mb-1.5">Landing quality</p>
                  <div className="flex flex-wrap gap-1">
                    {STABILITY_OPTIONS.map(o => (
                      <button key={o.val} type="button" onClick={() => setO(obs === o.val ? "" : o.val)}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                          obs === o.val ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"
                        }`}>{o.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* LSI display */}
        {lsi && (
          <div className={`rounded-lg border px-4 py-3 ${lsiC.bg} ${lsiC.border}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Limb Symmetry Index</span>
              <span className={`text-xl font-bold ${lsiC.text}`}>{lsi}%</span>
            </div>
            <p className={`text-xs mt-0.5 ${lsiC.text}`}>{lsiC.label}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Safety items ──────────────────────────────────────────────────────────────

const SAFETY_ITEMS = [
  { id: "cleared_jump", label: "Cleared for jumping/landing activities", concern: false },
  { id: "no_swelling", label: "No acute joint swelling", concern: false },
  { id: "no_severe_pain", label: "No severe pain at rest or with weight-bearing", concern: false },
  { id: "sl_balance", label: "Able to perform safe single-leg balance", concern: false },
  { id: "rom_ok", label: "Knee ROM adequate for full hop/land", concern: false },
  { id: "no_instability", label: "No instability episode today", concern: false },
  { id: "warmup", label: "Warm-up completed (5–10 min dynamic activity)", concern: false },
  { id: "consent", label: "Patient consent obtained", concern: false },
];

// ─── Main Component ────────────────────────────────────────────────────────────

export default function SingleLegHopTestsRunner({ client, onSave, onClose }) {

  // Safety
  const [safetyChecks, setSafetyChecks] = useState({});
  const [safetyDone, setSafetyDone] = useState(false);

  // Setup
  const [injuredSide, setInjuredSide] = useState("");
  const [dominantSide, setDominantSide] = useState("");
  const [surface, setSurface] = useState("");
  const [footwear, setFootwear] = useState("");
  const [braceUsed, setBraceUsed] = useState(null);
  const [baselinePain, setBaselinePain] = useState("");
  const [confidenceLevel, setConfidenceLevel] = useState("");
  const [fatigue, setFatigue] = useState("");

  // Test selection
  const [enabledTests, setEnabledTests] = useState({
    single: true, triple: true, crossover: true, timed: true
  });

  // Single Hop
  const [singleLeft, setSingleLeft] = useState(["", "", ""]);
  const [singleRight, setSingleRight] = useState(["", "", ""]);
  const [singleLeftObs, setSingleLeftObs] = useState("");
  const [singleRightObs, setSingleRightObs] = useState("");

  // Triple Hop
  const [tripleLeft, setTripleLeft] = useState(["", "", ""]);
  const [tripleRight, setTripleRight] = useState(["", "", ""]);
  const [tripleLeftObs, setTripleLeftObs] = useState("");
  const [tripleRightObs, setTripleRightObs] = useState("");

  // Crossover Hop
  const [crossLeft, setCrossLeft] = useState(["", "", ""]);
  const [crossRight, setCrossRight] = useState(["", "", ""]);
  const [crossLeftObs, setCrossLeftObs] = useState("");
  const [crossRightObs, setCrossRightObs] = useState("");

  // Timed Hop
  const [timedLeft, setTimedLeft] = useState(["", ""]);
  const [timedRight, setTimedRight] = useState(["", ""]);
  const [timedLeftObs, setTimedLeftObs] = useState("");
  const [timedRightObs, setTimedRightObs] = useState("");

  // Notes
  const [notes, setNotes] = useState("");

  // Collapsible
  const [open, setOpen] = useState({ overview: true, setup: true, single: true, triple: true, crossover: true, timed: true, refs: false });
  const tog = k => setOpen(p => ({ ...p, [k]: !p[k] }));

  // ── Derived ───────────────────────────────────────────────────────────────

  const singleBestLeft = useMemo(() => getBestDistance(...singleLeft), [singleLeft]);
  const singleBestRight = useMemo(() => getBestDistance(...singleRight), [singleRight]);
  const tripleBestLeft = useMemo(() => getBestDistance(...tripleLeft), [tripleLeft]);
  const tripleBestRight = useMemo(() => getBestDistance(...tripleRight), [tripleRight]);
  const crossBestLeft = useMemo(() => getBestDistance(...crossLeft), [crossLeft]);
  const crossBestRight = useMemo(() => getBestDistance(...crossRight), [crossRight]);
  const timedBestLeft = useMemo(() => getFastestTime(timedLeft[0], timedLeft[1]), [timedLeft]);
  const timedBestRight = useMemo(() => getFastestTime(timedRight[0], timedRight[1]), [timedRight]);

  const getInjuredAndUninjured = (left, right) => {
    if (injuredSide === "left") return { injured: left, uninjured: right };
    if (injuredSide === "right") return { injured: right, uninjured: left };
    return { injured: Math.min(left || Infinity, right || Infinity) === left ? left : right, uninjured: Math.max(left || 0, right || 0) };
  };

  const singleLSI = useMemo(() => {
    if (!singleBestLeft || !singleBestRight) return null;
    const { injured, uninjured } = getInjuredAndUninjured(singleBestLeft, singleBestRight);
    return calcLSI(injured, uninjured);
  }, [singleBestLeft, singleBestRight, injuredSide]);

  const tripleLSI = useMemo(() => {
    if (!tripleBestLeft || !tripleBestRight) return null;
    const { injured, uninjured } = getInjuredAndUninjured(tripleBestLeft, tripleBestRight);
    return calcLSI(injured, uninjured);
  }, [tripleBestLeft, tripleBestRight, injuredSide]);

  const crossLSI = useMemo(() => {
    if (!crossBestLeft || !crossBestRight) return null;
    const { injured, uninjured } = getInjuredAndUninjured(crossBestLeft, crossBestRight);
    return calcLSI(injured, uninjured);
  }, [crossBestLeft, crossBestRight, injuredSide]);

  const timedLSI = useMemo(() => {
    if (!timedBestLeft || !timedBestRight) return null;
    if (injuredSide === "left") return calcTimedLSI(timedBestLeft, timedBestRight);
    if (injuredSide === "right") return calcTimedLSI(timedBestRight, timedBestLeft);
    // no known injured side: worse (slower) vs faster
    const worst = Math.max(timedBestLeft, timedBestRight);
    const best = Math.min(timedBestLeft, timedBestRight);
    return calcTimedLSI(worst, best);
  }, [timedBestLeft, timedBestRight, injuredSide]);

  const allLSIs = [singleLSI, tripleLSI, crossLSI, timedLSI].filter(Boolean).map(parseFloat);
  const meanLSI = allLSIs.length ? (allLSIs.reduce((a, b) => a + b, 0) / allLSIs.length).toFixed(1) : null;

  const hasAnyData = singleBestLeft || singleBestRight || tripleBestLeft || tripleBestRight || crossBestLeft || crossBestRight || timedBestLeft || timedBestRight;
  const hasBilateral = (singleBestLeft && singleBestRight) || (tripleBestLeft && tripleBestRight) || (crossBestLeft && crossBestRight) || (timedBestLeft && timedBestRight);

  // ── Interpretation ────────────────────────────────────────────────────────

  const interpretation = useMemo(() => {
    if (!meanLSI) return null;
    const v = parseFloat(meanLSI);
    const lsis = [];
    if (singleLSI) lsis.push(`Single Hop ${singleLSI}%`);
    if (tripleLSI) lsis.push(`Triple Hop ${tripleLSI}%`);
    if (crossLSI) lsis.push(`Crossover ${crossLSI}%`);
    if (timedLSI) lsis.push(`Timed Hop ${timedLSI}%`);

    const symmetryText = lsis.join(', ');
    const side = injuredSide ? `${injuredSide.charAt(0).toUpperCase() + injuredSide.slice(1)}-sided` : "Bilateral";

    if (v >= 90) {
      return {
        level: "Good Symmetry — RTS Criteria Met",
        color: "text-green-700", bg: "bg-green-50 border-green-200",
        narrative: `${side} single-leg hop testing demonstrates good limb symmetry with mean LSI of ${meanLSI}% (${symmetryText}). Results meet the ≥90% threshold for return-to-sport consideration. Clinical decision should incorporate strength testing, psychological readiness, and sport-specific performance criteria.`
      };
    }
    if (v >= 85) {
      return {
        level: "Borderline Symmetry — Address Deficits",
        color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200",
        narrative: `${side} single-leg hop testing demonstrates borderline limb symmetry with mean LSI of ${meanLSI}% (${symmetryText}). Residual asymmetry is present. Continued rehabilitation with progressive plyometric loading is recommended prior to return-to-sport clearance. Reassess in 3–4 weeks.`
      };
    }
    return {
      level: "Significant Asymmetry — Return to Sport Not Recommended",
      color: "text-red-700", bg: "bg-red-50 border-red-200",
      narrative: `${side} single-leg hop testing reveals significant lower-limb asymmetry with mean LSI of ${meanLSI}% (${symmetryText}). Findings indicate incomplete restoration of unilateral power and neuromuscular control. Return to sport is not recommended at this time. Structured plyometric and strength progression is indicated.`
    };
  }, [meanLSI, singleLSI, tripleLSI, crossLSI, timedLSI, injuredSide]);

  // ── Flags ─────────────────────────────────────────────────────────────────

  const flags = useMemo(() => {
    const f = [];
    if (!meanLSI) return f;
    const v = parseFloat(meanLSI);
    if (v < 90) f.push("Reinjury risk elevated — LSI below 90% threshold");
    if (v < 85) f.push("Significant power deficit — defer return to sport");
    if ([singleLeftObs, singleRightObs, tripleLeftObs, tripleRightObs, crossLeftObs, crossRightObs].some(o => o === "failed")) f.push("Failed hop attempts recorded — neuromuscular control concern");
    if ([singleLeftObs, singleRightObs, tripleLeftObs, tripleRightObs, crossLeftObs, crossRightObs].some(o => o === "significant_sway" || o === "stumble")) f.push("Poor landing mechanics — address dynamic control");
    if (confidenceLevel && parseInt(confidenceLevel) <= 5) f.push("Low confidence reported — psychological readiness concern");
    if (baselinePain && parseInt(baselinePain) >= 3) f.push("Elevated baseline pain — testing validity may be compromised");
    if (v < 90) f.push("Requires progressive plyometric program before RTS");
    if (v < 85) f.push("Consider formal strength & power re-assessment (isokinetics, SLQT)");
    return f;
  }, [meanLSI, singleLeftObs, singleRightObs, tripleLeftObs, tripleRightObs, crossLeftObs, crossRightObs, confidenceLevel, baselinePain]);

  // ── SOAP ──────────────────────────────────────────────────────────────────

  const buildSOAP = () => {
    const lines = [
      `• Single Leg Hop Test Battery`,
      ``,
      `  Test Results:`,
      singleBestLeft && singleBestRight ? `    Single Hop for Distance: L ${singleBestLeft}cm | R ${singleBestRight}cm | LSI ${singleLSI}%` : null,
      tripleBestLeft && tripleBestRight ? `    Triple Hop for Distance: L ${tripleBestLeft}cm | R ${tripleBestRight}cm | LSI ${tripleLSI}%` : null,
      crossBestLeft && crossBestRight ? `    Crossover Hop for Distance: L ${crossBestLeft}cm | R ${crossBestRight}cm | LSI ${crossLSI}%` : null,
      timedBestLeft && timedBestRight ? `    6m Timed Hop: L ${timedBestLeft}s | R ${timedBestRight}s | LSI ${timedLSI}%` : null,
      ``,
      meanLSI ? `  Mean LSI: ${meanLSI}%` : null,
      interpretation ? `  Interpretation: ${interpretation.level}` : null,
      interpretation ? `  ${interpretation.narrative}` : null,
      ``,
      flags.length > 0 ? `  Clinical Flags:` : null,
      ...flags.map(f => `    ⚑ ${f}`),
      ``,
      notes ? `  Clinician Notes: ${notes}` : null,
      ``,
      `  References: Noyes et al. (1991) Am J Sports Med; Reid et al. (2007) Phys Ther; Gustavsson et al. (2006) KSSTA.`,
    ].filter(v => v !== null).join('\n');
    return lines;
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!hasBilateral) {
      toast.error("Complete bilateral testing (at least one test with both legs) before saving.");
      return;
    }
    onSave({
      status: "completed",
      result_value: meanLSI ? parseFloat(meanLSI) : null,
      additional_data: {
        measurement_type: "single_leg_hop",
        injured_side: injuredSide,
        dominant_side: dominantSide,
        single_hop: { left_best: singleBestLeft, right_best: singleBestRight, lsi: singleLSI, left_obs: singleLeftObs, right_obs: singleRightObs },
        triple_hop: { left_best: tripleBestLeft, right_best: tripleBestRight, lsi: tripleLSI },
        crossover_hop: { left_best: crossBestLeft, right_best: crossBestRight, lsi: crossLSI },
        timed_hop: { left_best: timedBestLeft, right_best: timedBestRight, lsi: timedLSI },
        mean_lsi: parseFloat(meanLSI) || null,
        interpretation: interpretation?.level,
        interpretation_narrative: interpretation?.narrative,
        clinical_flags: flags,
        baseline_pain: baselinePain,
        confidence_level: confidenceLevel,
        brace_used: braceUsed,
        soap_text: buildSOAP(),
      },
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("Single Leg Hop Tests saved.");
  };

  const handleReset = () => {
    setSafetyChecks({}); setSafetyDone(false);
    setInjuredSide(""); setDominantSide(""); setSurface(""); setFootwear(""); setBraceUsed(null);
    setBaselinePain(""); setConfidenceLevel(""); setFatigue("");
    setSingleLeft(["","",""]); setSingleRight(["","",""]); setSingleLeftObs(""); setSingleRightObs("");
    setTripleLeft(["","",""]); setTripleRight(["","",""]); setTripleLeftObs(""); setTripleRightObs("");
    setCrossLeft(["","",""]); setCrossRight(["","",""]); setCrossLeftObs(""); setCrossRightObs("");
    setTimedLeft(["",""]); setTimedRight(["",""]); setTimedLeftObs(""); setTimedRightObs("");
    setNotes("");
  };

  const coreConsent = safetyChecks["consent"] && safetyChecks["cleared_jump"] && safetyChecks["no_swelling"];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">

        {/* Sticky Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 z-10 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Single Leg Hop Test Battery</h1>
            <p className="text-sm text-slate-500 mt-0.5">Bilateral power · LSI · Return-to-Sport readiness</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Sticky LSI panel */}
        {hasAnyData && (
          <div className="sticky top-[73px] bg-slate-50 border-b border-slate-200 px-6 py-3 z-10">
            <div className="grid grid-cols-5 gap-2">
              <LSIPill lsi={singleLSI} label="Single Hop" />
              <LSIPill lsi={tripleLSI} label="Triple Hop" />
              <LSIPill lsi={crossLSI} label="Crossover" />
              <LSIPill lsi={timedLSI} label="Timed Hop" />
              <LSIPill lsi={meanLSI} label="Mean LSI" />
            </div>
          </div>
        )}

        <div className="p-6 space-y-5">

          {/* ── SECTION 1: Overview ── */}
          <Collapsible open={open.overview} onOpenChange={() => tog("overview")}>
            <CollapsibleTrigger className="w-full text-left">
              <SectionHeader icon={Info} title="1. Assessment Overview" color="slate"
                subtitle="Single Leg Hop Battery — Bilateral power & limb symmetry" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-sm">
                <p className="text-slate-700"><strong>Purpose:</strong> Assessment of unilateral lower-limb power, dynamic control, and return-to-sport readiness using a battery of single-leg hop tasks.</p>
                <div className="flex flex-wrap gap-2">
                  {["ACL Rehabilitation", "Return-to-Sport", "Knee Injury", "Lower Limb Symmetry", "Power Testing", "Sports Rehab", "Orthopedic Screening"].map(c => (
                    <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="bg-white border rounded p-2 text-center"><p className="font-semibold text-slate-700">RTS Threshold</p><p>≥90% LSI</p></div>
                  <div className="bg-white border rounded p-2 text-center"><p className="font-semibold text-slate-700">Borderline</p><p>85–89%</p></div>
                  <div className="bg-white border rounded p-2 text-center"><p className="font-semibold text-slate-700">Defer RTS</p><p>&lt;85%</p></div>
                  <div className="bg-white border rounded p-2 text-center"><p className="font-semibold text-slate-700">MCID</p><p>~5% LSI</p></div>
                </div>
                <p className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded p-2">
                  <strong>LSI formula:</strong> (Injured limb ÷ Uninjured limb) × 100. Timed hop uses inverse (faster = better).
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTION 2: Safety ── */}
          {!safetyDone ? (
            <div className="border-2 border-amber-300 rounded-xl overflow-hidden">
              <div className="bg-amber-500 text-white px-4 py-3 flex items-center gap-2 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" /> 2. Safety & Readiness Screen
              </div>
              <div className="p-4 bg-amber-50 space-y-3">
                <div className="grid grid-cols-1 gap-2">
                  {SAFETY_ITEMS.map(item => (
                    <label key={item.id} className={`flex items-center gap-3 cursor-pointer text-sm p-2.5 rounded border transition-colors ${
                      safetyChecks[item.id] ? "bg-green-50 border-green-300 text-green-800" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}>
                      <Checkbox checked={!!safetyChecks[item.id]} onCheckedChange={v => setSafetyChecks(p => ({ ...p, [item.id]: v }))} />
                      {item.label}
                    </label>
                  ))}
                </div>
                <Button onClick={() => setSafetyDone(true)} disabled={!coreConsent} className="w-full bg-amber-600 hover:bg-amber-700">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Safety & Proceed
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-800 font-medium">Safety check completed.</span>
              <button onClick={() => setSafetyDone(false)} className="ml-auto text-xs text-green-700 underline">Edit</button>
            </div>
          )}

          {/* ── SECTION 3: Instructions ── */}
          <div className="bg-blue-600 text-white rounded-lg px-4 py-3 text-sm">
            <p className="font-semibold mb-1">💬 3. Clinician Instructions</p>
            <p className="text-blue-100">Patient performs maximal effort single-leg hop tasks on each limb. Record 2–3 trials per side and use the best (for distance) or fastest (for timed). Calculate LSI = (injured ÷ uninjured) × 100. ≥90% = RTS criteria met. Observe landing quality, valgus, and confidence throughout.</p>
          </div>

          {/* ── SECTION 4: Setup ── */}
          <Collapsible open={open.setup} onOpenChange={() => tog("setup")}>
            <CollapsibleTrigger className="w-full text-left">
              <SectionHeader icon={Activity} title="4. Test Setup" color="blue" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Injured / Operative Side</Label>
                  <RadioButtons options={[{ val: "left", label: "Left" }, { val: "right", label: "Right" }, { val: "bilateral", label: "Bilateral" }, { val: "none", label: "None" }]}
                    value={injuredSide} onChange={setInjuredSide} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Dominant Limb</Label>
                  <RadioButtons options={[{ val: "left", label: "Left" }, { val: "right", label: "Right" }]}
                    value={dominantSide} onChange={setDominantSide} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Surface</Label>
                  <RadioButtons options={[{ val: "gym_floor", label: "Gym floor" }, { val: "carpet", label: "Carpet" }, { val: "grass", label: "Grass" }, { val: "other", label: "Other" }]}
                    value={surface} onChange={setSurface} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Footwear</Label>
                  <RadioButtons options={[{ val: "sports_shoes", label: "Sports shoes" }, { val: "bare", label: "Barefoot" }, { val: "other", label: "Other" }]}
                    value={footwear} onChange={setFootwear} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Knee Brace Used?</Label>
                  <YesNoButtons value={braceUsed} onChange={setBraceUsed} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 block mb-1">Pain (0–10)</Label>
                    <Input type="number" min="0" max="10" value={baselinePain} onChange={e => setBaselinePain(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 block mb-1">Confidence (0–10)</Label>
                    <Input type="number" min="0" max="10" value={confidenceLevel} onChange={e => setConfidenceLevel(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 block mb-1">Fatigue (0–10)</Label>
                    <Input type="number" min="0" max="10" value={fatigue} onChange={e => setFatigue(e.target.value)} placeholder="0" />
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTION 5: Test Selection ── */}
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <p className="text-sm font-semibold text-slate-700 mb-3">5. Test Battery Selection</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "single", label: "Single Hop for Distance" },
                { key: "triple", label: "Triple Hop for Distance" },
                { key: "crossover", label: "Crossover Hop for Distance" },
                { key: "timed", label: "6-Metre Timed Hop" },
              ].map(({ key, label }) => (
                <label key={key} className={`flex items-center gap-2 text-sm cursor-pointer p-2.5 rounded border transition-colors ${
                  enabledTests[key] ? "bg-blue-50 border-blue-300 text-blue-800" : "bg-white border-slate-200 text-slate-600"
                }`}>
                  <Checkbox checked={enabledTests[key]} onCheckedChange={v => setEnabledTests(p => ({ ...p, [key]: v }))} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* ── SECTION 6: Single Hop ── */}
          {enabledTests.single && (
            <Collapsible open={open.single} onOpenChange={() => tog("single")}>
              <CollapsibleTrigger className="w-full text-left">
                <SectionHeader icon={Zap} title="6. Single Hop for Distance" color="green"
                  subtitle="Maximum single explosive hop — 3 trials per side, use best" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3">
                  <HopTestPanel
                    title="Single Hop for Distance" unit="cm" trialsPerSide={3}
                    leftTrials={singleLeft} setLeftTrials={setSingleLeft}
                    rightTrials={singleRight} setRightTrials={setSingleRight}
                    leftObs={singleLeftObs} setLeftObs={setSingleLeftObs}
                    rightObs={singleRightObs} setRightObs={setSingleRightObs}
                    injuredSide={injuredSide} lsi={singleLSI}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* ── SECTION 7: Triple Hop ── */}
          {enabledTests.triple && (
            <Collapsible open={open.triple} onOpenChange={() => tog("triple")}>
              <CollapsibleTrigger className="w-full text-left">
                <SectionHeader icon={Zap} title="7. Triple Hop for Distance" color="purple"
                  subtitle="3 consecutive hops — total distance per side, use best trial" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3">
                  <HopTestPanel
                    title="Triple Hop for Distance" unit="cm" trialsPerSide={3}
                    leftTrials={tripleLeft} setLeftTrials={setTripleLeft}
                    rightTrials={tripleRight} setRightTrials={setTripleRight}
                    leftObs={tripleLeftObs} setLeftObs={setTripleLeftObs}
                    rightObs={tripleRightObs} setRightObs={setTripleRightObs}
                    injuredSide={injuredSide} lsi={tripleLSI}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* ── SECTION 8: Crossover Hop ── */}
          {enabledTests.crossover && (
            <Collapsible open={open.crossover} onOpenChange={() => tog("crossover")}>
              <CollapsibleTrigger className="w-full text-left">
                <SectionHeader icon={Target} title="8. Crossover Hop for Distance" color="teal"
                  subtitle="3 crossover hops over centre line — total distance per side, use best" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3">
                  <HopTestPanel
                    title="Crossover Hop for Distance" unit="cm" trialsPerSide={3}
                    leftTrials={crossLeft} setLeftTrials={setCrossLeft}
                    rightTrials={crossRight} setRightTrials={setCrossRight}
                    leftObs={crossLeftObs} setLeftObs={setCrossLeftObs}
                    rightObs={crossRightObs} setRightObs={setCrossRightObs}
                    injuredSide={injuredSide} lsi={crossLSI}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* ── SECTION 9: Timed Hop ── */}
          {enabledTests.timed && (
            <Collapsible open={open.timed} onOpenChange={() => tog("timed")}>
              <CollapsibleTrigger className="w-full text-left">
                <SectionHeader icon={Activity} title="9. 6-Metre Timed Hop" color="indigo"
                  subtitle="Time to hop 6 metres — 2 trials per side, use fastest" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3">
                  <HopTestPanel
                    title="6-Metre Timed Hop" unit="sec" trialsPerSide={2} isTimed
                    leftTrials={timedLeft} setLeftTrials={setTimedLeft}
                    rightTrials={timedRight} setRightTrials={setTimedRight}
                    leftObs={timedLeftObs} setLeftObs={setTimedLeftObs}
                    rightObs={timedRightObs} setRightObs={setTimedRightObs}
                    injuredSide={injuredSide} lsi={timedLSI}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* ── SECTIONS 10–14: Results & Interpretation ── */}
          {interpretation && (
            <div className="space-y-4">

              {/* Summary table */}
              <div className="bg-slate-800 text-white rounded-xl p-5">
                <p className="text-sm font-medium text-slate-300 mb-3">Bilateral Comparison Summary</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  {singleBestLeft && singleBestRight && (
                    <>
                      <p className="text-slate-300">Single Hop — Left: <span className="text-white font-bold">{singleBestLeft}cm</span></p>
                      <p className="text-slate-300">Single Hop — Right: <span className="text-white font-bold">{singleBestRight}cm</span></p>
                    </>
                  )}
                  {tripleBestLeft && tripleBestRight && (
                    <>
                      <p className="text-slate-300">Triple Hop — Left: <span className="text-white font-bold">{tripleBestLeft}cm</span></p>
                      <p className="text-slate-300">Triple Hop — Right: <span className="text-white font-bold">{tripleBestRight}cm</span></p>
                    </>
                  )}
                  {crossBestLeft && crossBestRight && (
                    <>
                      <p className="text-slate-300">Crossover — Left: <span className="text-white font-bold">{crossBestLeft}cm</span></p>
                      <p className="text-slate-300">Crossover — Right: <span className="text-white font-bold">{crossBestRight}cm</span></p>
                    </>
                  )}
                  {timedBestLeft && timedBestRight && (
                    <>
                      <p className="text-slate-300">Timed Hop — Left: <span className="text-white font-bold">{timedBestLeft}s</span></p>
                      <p className="text-slate-300">Timed Hop — Right: <span className="text-white font-bold">{timedBestRight}s</span></p>
                    </>
                  )}
                </div>
                <div className="mt-4 border-t border-slate-700 pt-3">
                  <p className="text-slate-300 text-sm">Mean LSI: <span className="text-2xl font-bold text-white ml-2">{meanLSI}%</span></p>
                </div>
              </div>

              {/* Interpretation */}
              <div className={`${interpretation.bg} border rounded-xl p-4`}>
                <p className={`font-semibold ${interpretation.color} mb-2 flex items-center gap-2`}>
                  <Info className="w-4 h-4" /> Clinical Interpretation
                </p>
                <p className="text-sm text-slate-800 leading-relaxed">{interpretation.narrative}</p>
              </div>

              {/* RTS Classification */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <p className="font-semibold text-indigo-900 mb-2">Return-to-Sport Classification</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { range: "≥90%", label: "RTS Criteria Met", sub: "Good symmetry", bg: "bg-green-100 border-green-300 text-green-800" },
                    { range: "85–89%", label: "Borderline", sub: "Address deficits", bg: "bg-yellow-100 border-yellow-300 text-yellow-800" },
                    { range: "<85%", label: "Defer RTS", sub: "Significant asymmetry", bg: "bg-red-100 border-red-300 text-red-800" },
                  ].map(r => {
                    const v = parseFloat(meanLSI);
                    const active = (r.range === "≥90%" && v >= 90) || (r.range === "85–89%" && v >= 85 && v < 90) || (r.range === "<85%" && v < 85);
                    return (
                      <div key={r.range} className={`border rounded-lg p-2.5 text-center ${r.bg} ${active ? "ring-2 ring-offset-1 ring-slate-700" : "opacity-70"}`}>
                        <p className="font-bold text-lg">{r.range}</p>
                        <p className="font-semibold">{r.label}</p>
                        <p className="opacity-70">{r.sub}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-indigo-800 mt-3">Note: LSI ≥90% is a necessary but not sufficient criterion for RTS. Integrate with strength testing (quadriceps symmetry), psychological readiness (ACL-RSI), and sport-specific performance.</p>
              </div>

              {/* Flags */}
              {flags.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="font-semibold text-red-900 mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Clinical Flags</p>
                  <div className="space-y-1.5">
                    {flags.map((f, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5 flex-shrink-0">⚑</span>
                        <p className="text-sm text-red-800">{f}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Clinical Notes ── */}
          <div>
            <Label className="font-semibold block mb-2 text-sm">Clinical Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Landing quality observations, dynamic valgus, compensatory patterns, confidence, pain response, brace use, sport-specific context..."
              rows={3} />
          </div>

          {/* ── References ── */}
          <Collapsible open={open.refs} onOpenChange={() => tog("refs")}>
            <CollapsibleTrigger className="w-full text-left">
              <SectionHeader icon={ExternalLink} title="Evidence-Based References" color="amber" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2.5 text-xs text-amber-800">
                {[
                  { text: "Noyes FR, Barber SD, Mangine RE. Abnormal lower limb symmetry determined by function hop tests after ACL rupture. Am J Sports Med. 1991;19(5):513–518.", url: "https://pubmed.ncbi.nlm.nih.gov/1897659/" },
                  { text: "Reid A, Birmingham TB, Stratford PW, et al. Hop testing provides a reliable and valid outcome measure during rehabilitation after ACL reconstruction. Phys Ther. 2007;87(3):337–349.", url: "https://pubmed.ncbi.nlm.nih.gov/17272543/" },
                  { text: "Logerstedt D, Grindem H, Lynch A, et al. Single-legged hop tests as predictors of self-reported knee function after ACL reconstruction. Am J Sports Med. 2012;40(10):2348–2356.", url: "https://pubmed.ncbi.nlm.nih.gov/22773832/" },
                  { text: "Gustavsson A, Neeter C, Thomeé P, et al. A test battery for evaluating hop performance in patients with ACL injury and patients who have undergone ACL reconstruction. Knee Surg Sports Traumatol Arthrosc. 2006;14(8):778–788.", url: "https://pubmed.ncbi.nlm.nih.gov/16525782/" },
                  { text: "Myer GD, Schmitt LC, Brent JL, et al. Utilization of modified NFL combine testing to identify lower extremity functional asymmetries in adolescent athletes. Clin J Sport Med. 2011;21(6):530–537.", url: "https://pubmed.ncbi.nlm.nih.gov/21378549/" },
                ].map((ref, i) => (
                  <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 hover:underline">
                    <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {ref.text}
                  </a>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Actions ── */}
          <div className="flex justify-between items-center gap-3 pt-4 border-t border-slate-200">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Cancel</Button>
              <Button variant="outline" onClick={handleReset} className="text-slate-600"><RotateCcw className="w-4 h-4 mr-2" />Reset</Button>
            </div>
            {!hasBilateral && <p className="text-xs text-slate-500 flex-1 text-center">Complete bilateral testing before saving.</p>}
            <Button onClick={handleSave} disabled={!hasBilateral} className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-2" />Save Hop Battery
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}