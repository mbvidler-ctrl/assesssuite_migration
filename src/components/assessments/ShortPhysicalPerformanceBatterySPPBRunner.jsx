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
  Info, ExternalLink, Activity, Zap, AlertCircle, ChevronDown
} from "lucide-react";
import { toast } from "sonner";

// ─── Scoring Helpers ──────────────────────────────────────────────────────────

const calcGaitScore = (seconds, distance = 4) => {
  if (!seconds || isNaN(parseFloat(seconds))) return null;
  const t = parseFloat(seconds);
  // SPPB standard: 4m walk
  // Normalise to 4m if different distance used
  const t4 = distance === 4 ? t : (t / distance) * 4;
  if (t4 > 8.7) return 1;
  if (t4 >= 6.2) return 2;
  if (t4 >= 4.8) return 3;
  return 4;
};

const calcChairScore = (seconds) => {
  if (!seconds || isNaN(parseFloat(seconds))) return null;
  const t = parseFloat(seconds);
  if (t > 60) return 0;
  if (t > 16.7) return 1;
  if (t >= 13.7) return 2;
  if (t >= 11.2) return 3;
  return 4;
};

const calcBalanceScore = (sideBySide, semiTandem, tandem) => {
  if (sideBySide === null) return null;
  if (sideBySide === false) return 0;
  if (semiTandem === null) return null;
  if (semiTandem === false) return 1;
  if (tandem === null) return null;
  return 2 + (tandem === "10+" ? 2 : tandem === "3-9" ? 1 : 0);
};

const calcGaitSpeed = (seconds, distance) => {
  if (!seconds || isNaN(parseFloat(seconds))) return null;
  return (distance / parseFloat(seconds)).toFixed(2);
};

// ─── Helper Components ────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, color = "slate", subtitle }) {
  const bg = {
    slate: "bg-slate-700", blue: "bg-blue-700", green: "bg-green-700",
    purple: "bg-purple-700", amber: "bg-amber-600", red: "bg-red-600", teal: "bg-teal-700"
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

function ScorePill({ score, max, label, complete }) {
  const pct = max > 0 ? score / max : 0;
  const color = !complete ? "bg-slate-100 text-slate-400 border-slate-200"
    : pct >= 0.75 ? "bg-green-100 text-green-800 border-green-300"
    : pct >= 0.5 ? "bg-yellow-100 text-yellow-800 border-yellow-300"
    : "bg-red-100 text-red-800 border-red-300";
  return (
    <div className={`border rounded-xl px-4 py-3 text-center ${color}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-0.5">{complete ? score : "—"}<span className="text-sm font-normal">/{max}</span></p>
    </div>
  );
}

function YesNoButtons({ value, onChange, yesLabel = "Yes", noLabel = "No" }) {
  return (
    <div className="flex gap-3">
      {[{ val: true, label: yesLabel, col: "green" }, { val: false, label: noLabel, col: "red" }].map(({ val, label, col }) => (
        <button key={String(val)} type="button" onClick={() => onChange(val)}
          className={`text-sm px-5 py-2 rounded border font-medium transition-colors ${
            value === val
              ? col === "green" ? "bg-green-600 text-white border-green-600" : "bg-red-500 text-white border-red-500"
              : "border-slate-300 hover:bg-slate-50 text-slate-700"
          }`}>
          {label}
        </button>
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
          }`}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Safety Flags ─────────────────────────────────────────────────────────────

const SAFETY_ITEMS = [
  { id: "safe_stand", label: "Safe to stand independently", concern: false },
  { id: "safe_walk", label: "Safe to ambulate", concern: false },
  { id: "no_dizziness", label: "No acute dizziness", concern: false },
  { id: "no_cv", label: "No unstable cardiovascular symptoms", concern: false },
  { id: "no_severe_pain", label: "No severe pain limiting movement", concern: false },
  { id: "walking_aid", label: "Walking aid required (note: still proceed, document aid)", concern: true },
  { id: "consent", label: "Patient consent obtained", concern: false },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ShortPhysicalPerformanceBatterySPPBRunner({ client, onSave, onClose }) {
  // Safety
  const [safetyChecks, setSafetyChecks] = useState({});
  const [safetyDone, setSafetyDone] = useState(false);

  // Setup
  const [assistiveDevice, setAssistiveDevice] = useState("");
  const [shoesOff, setShoesOff] = useState("");
  const [surface, setSurface] = useState("");
  const [baselinePain, setBaselinePain] = useState("");
  const [baselineFatigue, setBaselineFatigue] = useState("");

  // Balance
  const [sideBySide, setSideBySide] = useState(null);    // true/false
  const [semiTandem, setSemiTandem] = useState(null);    // true/false
  const [tandemResult, setTandemResult] = useState(null); // "10+", "3-9", "<3"
  const [balanceNotes, setBalanceNotes] = useState("");

  // Gait
  const [walkDistance, setWalkDistance] = useState(4);
  const [gaitTrial1, setGaitTrial1] = useState("");
  const [gaitTrial2, setGaitTrial2] = useState("");
  const [gaitAidUsed, setGaitAidUsed] = useState("");
  const [gaitDeviations, setGaitDeviations] = useState([]);
  const [gaitNotes, setGaitNotes] = useState("");

  // Chair stand
  const [singleRiseAble, setSingleRiseAble] = useState(null);
  const [chairStandTime, setChairStandTime] = useState("");
  const [chairStoppedEarly, setChairStoppedEarly] = useState(null);
  const [chairNotes, setChairNotes] = useState("");

  // Notes
  const [notes, setNotes] = useState("");

  // Section open states
  const [open, setOpen] = useState({ overview: true, setup: true, balance: true, gait: true, chair: true, refs: false });
  const tog = k => setOpen(p => ({ ...p, [k]: !p[k] }));

  // ── Derived scores ────────────────────────────────────────────────────────

  const balanceScore = useMemo(() => calcBalanceScore(sideBySide, semiTandem, tandemResult), [sideBySide, semiTandem, tandemResult]);

  const fastestGait = useMemo(() => {
    const t1 = parseFloat(gaitTrial1), t2 = parseFloat(gaitTrial2);
    if (!isNaN(t1) && !isNaN(t2)) return Math.min(t1, t2);
    if (!isNaN(t1)) return t1;
    if (!isNaN(t2)) return t2;
    return null;
  }, [gaitTrial1, gaitTrial2]);

  const gaitScore = useMemo(() => fastestGait !== null ? calcGaitScore(fastestGait, walkDistance) : null, [fastestGait, walkDistance]);
  const gaitSpeed = useMemo(() => fastestGait !== null ? calcGaitSpeed(fastestGait, walkDistance) : null, [fastestGait, walkDistance]);
  const chairScore = useMemo(() => chairStoppedEarly ? 0 : calcChairScore(chairStandTime), [chairStandTime, chairStoppedEarly]);

  const balanceComplete = balanceScore !== null;
  const gaitComplete = gaitScore !== null;
  const chairComplete = singleRiseAble !== null && (singleRiseAble === false || chairScore !== null);
  const allComplete = balanceComplete && gaitComplete && chairComplete;

  const totalScore = allComplete ? (balanceScore || 0) + (gaitScore || 0) + (singleRiseAble === false ? 0 : (chairScore || 0)) : null;

  // ── Interpretation ────────────────────────────────────────────────────────

  const interpretation = useMemo(() => {
    if (totalScore === null) return null;
    let level, color, bg, narrative;

    if (totalScore <= 3) {
      level = "Severe Limitation"; color = "text-red-700"; bg = "bg-red-50 border-red-200";
      narrative = `SPPB score of ${totalScore}/12 indicates severe lower extremity functional limitation. Findings suggest very high falls risk, significant mobility impairment, and probable frailty. Urgent functional rehabilitation intervention is indicated.`;
    } else if (totalScore <= 6) {
      level = "Moderate Impairment"; color = "text-orange-700"; bg = "bg-orange-50 border-orange-200";
      narrative = `SPPB score of ${totalScore}/12 suggests moderate lower extremity functional impairment. Reduced gait performance and/or impaired balance and chair stand ability indicate elevated falls risk and reduced mobility reserve. Structured exercise intervention is recommended.`;
    } else if (totalScore <= 9) {
      level = "Mild Functional Limitation"; color = "text-yellow-700"; bg = "bg-yellow-50 border-yellow-200";
      narrative = `SPPB score of ${totalScore}/12 indicates mild-to-moderate lower extremity functional limitation. Performance below expected norms for age suggests early functional decline with increased risk of disability progression. Targeted strength and balance training is recommended.`;
    } else {
      level = "High Functional Performance"; color = "text-green-700"; bg = "bg-green-50 border-green-200";
      narrative = `SPPB score of ${totalScore}/12 reflects high lower extremity functional performance. Balance, gait speed, and chair stand performance are within expected norms. Continue current physical activity and reassess as part of routine monitoring.`;
    }

    return { level, color, bg, narrative };
  }, [totalScore]);

  // ── Clinical flags ────────────────────────────────────────────────────────

  const flags = useMemo(() => {
    if (totalScore === null) return [];
    const f = [];
    if (totalScore <= 6) f.push("High falls risk");
    if (totalScore <= 6) f.push("Frailty likely — refer for comprehensive frailty assessment");
    if (gaitScore !== null && gaitScore <= 2) f.push("Reduced gait speed — mobility intervention indicated");
    if (balanceScore !== null && balanceScore <= 2) f.push("Poor balance — targeted balance training recommended");
    if (singleRiseAble === false) f.push("Unable to perform single chair rise — strength deficit significant");
    if (chairScore !== null && chairScore <= 2) f.push("Impaired chair stand performance — reduced lower limb power");
    if (totalScore <= 9) f.push("Candidate for structured strength and balance program");
    if (totalScore <= 6) f.push("Recommend further falls risk assessment (TUG, BBS)");
    if (gaitScore !== null && gaitScore <= 2) f.push("Sarcopenia screening trigger — consider SARC-F and grip strength");
    return f;
  }, [totalScore, gaitScore, balanceScore, chairScore, singleRiseAble]);

  // ── SOAP builder ──────────────────────────────────────────────────────────

  const buildSOAP = () => {
    const gaitSpeedStr = gaitSpeed ? `${gaitSpeed} m/s` : "N/A";
    const lines = [
      `• Short Physical Performance Battery (SPPB)`,
      ``,
      `  Domain Scores:`,
      `    Balance: ${balanceScore !== null ? balanceScore : "—"}/4`,
      `    Gait Speed: ${gaitScore !== null ? gaitScore : "—"}/4 (${gaitSpeedStr}, fastest ${fastestGait ? fastestGait + "s" : "—"} over ${walkDistance}m)`,
      `    Chair Stand: ${singleRiseAble === false ? "0 (unable single rise)" : chairScore !== null ? chairScore + "/4 (" + chairStandTime + "s)" : "—/4"}`,
      `    Total SPPB Score: ${totalScore !== null ? totalScore + "/12" : "—"}`,
      ``,
      interpretation ? `  Interpretation: ${interpretation.level}` : null,
      interpretation ? `  ${interpretation.narrative}` : null,
      ``,
      flags.length > 0 ? `  Clinical Flags:` : null,
      ...flags.map(f => `    ⚑ ${f}`),
      ``,
      notes ? `  Clinician Notes: ${notes}` : null,
      ``,
      `  References: Guralnik JM et al. (1994). J Gerontol 49(2):M85–M94. MCID = 1 point.`,
    ].filter(v => v !== null).join('\n');
    return lines;
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!allComplete) {
      toast.error("Complete all SPPB domains before saving.");
      return;
    }
    const chairFinalScore = singleRiseAble === false ? 0 : (chairScore || 0);
    const soap = buildSOAP();
    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        measurement_type: "sppb",
        balance_score: balanceScore,
        gait_score: gaitScore,
        chair_score: chairFinalScore,
        total_score: totalScore,
        gait_speed_ms: parseFloat(gaitSpeed),
        gait_fastest_time: fastestGait,
        gait_distance: walkDistance,
        gait_trial_1: parseFloat(gaitTrial1) || null,
        gait_trial_2: parseFloat(gaitTrial2) || null,
        balance_side_by_side: sideBySide,
        balance_semi_tandem: semiTandem,
        balance_tandem: tandemResult,
        chair_single_rise: singleRiseAble,
        chair_stand_time: parseFloat(chairStandTime) || null,
        chair_stopped_early: chairStoppedEarly,
        baseline_pain: baselinePain,
        assistive_device: assistiveDevice,
        clinical_flags: flags,
        interpretation: interpretation?.level,
        interpretation_narrative: interpretation?.narrative,
        soap_text: soap,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("SPPB Assessment saved.");
  };

  const handleReset = () => {
    setSafetyChecks({}); setSafetyDone(false);
    setSideBySide(null); setSemiTandem(null); setTandemResult(null); setBalanceNotes("");
    setGaitTrial1(""); setGaitTrial2(""); setGaitAidUsed(""); setGaitDeviations([]); setGaitNotes("");
    setSingleRiseAble(null); setChairStandTime(""); setChairStoppedEarly(null); setChairNotes("");
    setBaselinePain(""); setBaselineFatigue(""); setNotes("");
  };

  // ── Safety helpers ────────────────────────────────────────────────────────
  const hasSafetyConcern = SAFETY_ITEMS.filter(i => i.concern).some(i => safetyChecks[i.id]);
  const coreConsent = safetyChecks["consent"] && safetyChecks["safe_stand"] && safetyChecks["safe_walk"];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">

        {/* Sticky Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 z-10 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Short Physical Performance Battery (SPPB)</h1>
            <p className="text-sm text-slate-500 mt-0.5">Balance · Gait Speed · Chair Stand · Total Score 0–12</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Sticky Live Score Panel */}
        {(balanceComplete || gaitComplete || chairComplete) && (
          <div className="sticky top-[73px] bg-slate-50 border-b border-slate-200 px-6 py-3 z-10">
            <div className="grid grid-cols-4 gap-3">
              <ScorePill score={balanceScore || 0} max={4} label="Balance" complete={balanceComplete} />
              <ScorePill score={gaitScore || 0} max={4} label="Gait Speed" complete={gaitComplete} />
              <ScorePill score={singleRiseAble === false ? 0 : (chairScore || 0)} max={4} label="Chair Stand" complete={chairComplete} />
              <ScorePill score={totalScore || 0} max={12} label="TOTAL SPPB" complete={allComplete} />
            </div>
          </div>
        )}

        <div className="p-6 space-y-5">

          {/* ── SECTION 1: Overview ── */}
          <Collapsible open={open.overview} onOpenChange={() => tog("overview")}>
            <CollapsibleTrigger className="w-full text-left">
              <SectionHeader icon={Info} title="1. Assessment Overview" color="slate"
                subtitle="Short Physical Performance Battery — Lower extremity functional performance" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-sm">
                <p className="text-slate-700"><strong>Purpose:</strong> Objective assessment of lower extremity performance using balance, gait speed, and repeated chair stand to quantify functional status in older adults.</p>
                <div className="flex flex-wrap gap-2">
                  {["Frailty Screening", "Falls Risk", "Mobility Screening", "Sarcopenia", "Rehabilitation", "Aged Care", "DVA", "Medicare", "NDIS"].map(c => (
                    <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="bg-white border rounded p-2 text-center"><p className="font-semibold text-slate-700">Score Range</p><p>0–12</p></div>
                  <div className="bg-white border rounded p-2 text-center"><p className="font-semibold text-slate-700">MCID</p><p>1 point</p></div>
                  <div className="bg-white border rounded p-2 text-center"><p className="font-semibold text-slate-700">Duration</p><p>10–15 min</p></div>
                  <div className="bg-white border rounded p-2 text-center"><p className="font-semibold text-slate-700">Domains</p><p>3</p></div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTION 2: Safety Screen ── */}
          {!safetyDone ? (
            <div className="border-2 border-amber-300 rounded-xl overflow-hidden">
              <div className="bg-amber-500 text-white px-4 py-3 flex items-center gap-2 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" /> 2. Safety Check — Complete Before Testing
              </div>
              <div className="p-4 bg-amber-50 space-y-3">
                <div className="grid grid-cols-1 gap-2">
                  {SAFETY_ITEMS.map(item => (
                    <label key={item.id} className={`flex items-center gap-3 cursor-pointer text-sm p-2.5 rounded border transition-colors ${
                      safetyChecks[item.id]
                        ? item.concern ? "bg-orange-50 border-orange-300 text-orange-800" : "bg-green-50 border-green-300 text-green-800"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}>
                      <Checkbox checked={!!safetyChecks[item.id]} onCheckedChange={v => setSafetyChecks(p => ({ ...p, [item.id]: v }))} />
                      {item.label}
                    </label>
                  ))}
                </div>
                {hasSafetyConcern && (
                  <div className="bg-orange-100 border border-orange-300 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-orange-800">Walking aid noted. Proceed with supervision and document device used during testing.</p>
                  </div>
                )}
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
            <p className="text-blue-100">SPPB consists of 3 domains: (1) Standing balance — three progressive positions; (2) Gait speed — 4-metre walk timed; (3) Chair stand — 5 sit-to-stands timed. Each domain scored 0–4. Total score = 0–12. Score &lt;10 predicts disability and mortality in older adults (MCID = 1 point).</p>
          </div>

          {/* ── SECTION 4: Setup ── */}
          <Collapsible open={open.setup} onOpenChange={() => tog("setup")}>
            <CollapsibleTrigger className="w-full text-left">
              <SectionHeader icon={Activity} title="4. Test Setup" color="blue" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Assistive Device</Label>
                  <RadioButtons
                    options={[{ val: "none", label: "None" }, { val: "cane", label: "Cane" }, { val: "walker", label: "Walker" }, { val: "other", label: "Other" }]}
                    value={assistiveDevice} onChange={setAssistiveDevice}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Footwear</Label>
                  <RadioButtons
                    options={[{ val: "off", label: "Shoes off" }, { val: "on", label: "Shoes on" }]}
                    value={shoesOff} onChange={setShoesOff}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Surface</Label>
                  <RadioButtons
                    options={[{ val: "floor", label: "Hard floor" }, { val: "carpet", label: "Carpet" }, { val: "mat", label: "Mat" }]}
                    value={surface} onChange={setSurface}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Baseline Pain (0–10)</Label>
                  <Input type="number" min="0" max="10" value={baselinePain} onChange={e => setBaselinePain(e.target.value)} placeholder="0" className="w-24" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Baseline Fatigue (0–10)</Label>
                  <Input type="number" min="0" max="10" value={baselineFatigue} onChange={e => setBaselineFatigue(e.target.value)} placeholder="0" className="w-24" />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTION 5: Balance ── */}
          <Collapsible open={open.balance} onOpenChange={() => tog("balance")}>
            <CollapsibleTrigger className="w-full text-left">
              <SectionHeader icon={Activity} title="5. Balance Testing" color="teal"
                subtitle="Three progressive positions — each held for 10 seconds" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 space-y-4">

                {/* Position 1: Side-by-side */}
                <Card className="border-2 border-teal-200">
                  <CardHeader className="bg-teal-50 py-3 px-4">
                    <CardTitle className="text-sm text-teal-900">Position 1 — Side-by-Side Stand</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <p className="text-xs text-slate-600">Feet together, hold for 10 seconds. 1 point if achieved.</p>
                    <div>
                      <Label className="text-xs font-semibold text-slate-600 block mb-2">Completed 10 seconds?</Label>
                      <YesNoButtons value={sideBySide} onChange={v => { setSideBySide(v); if (!v) { setSemiTandem(null); setTandemResult(null); }}} />
                    </div>
                    {sideBySide === true && (
                      <div className="bg-green-50 border border-green-200 rounded px-3 py-2 text-xs text-green-800">
                        ✓ Side-by-side completed. Proceed to semi-tandem.
                      </div>
                    )}
                    {sideBySide === false && (
                      <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-800">
                        Balance score = 0. Testing stops here for balance domain.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Position 2: Semi-tandem */}
                {sideBySide === true && (
                  <Card className="border-2 border-teal-200">
                    <CardHeader className="bg-teal-50 py-3 px-4">
                      <CardTitle className="text-sm text-teal-900">Position 2 — Semi-Tandem Stand</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                      <p className="text-xs text-slate-600">Heel of one foot beside big toe of other foot. Hold 10 seconds. 1 additional point.</p>
                      <div>
                        <Label className="text-xs font-semibold text-slate-600 block mb-2">Completed 10 seconds?</Label>
                        <YesNoButtons value={semiTandem} onChange={v => { setSemiTandem(v); if (!v) setTandemResult(null); }} />
                      </div>
                      {semiTandem === false && (
                        <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-800">
                          Balance score = 1. Testing stops here for balance domain.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Position 3: Tandem */}
                {sideBySide === true && semiTandem === true && (
                  <Card className="border-2 border-teal-200">
                    <CardHeader className="bg-teal-50 py-3 px-4">
                      <CardTitle className="text-sm text-teal-900">Position 3 — Full Tandem Stand</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                      <p className="text-xs text-slate-600">Heel of one foot directly in front of other. Scored 0–2 based on hold time.</p>
                      <div>
                        <Label className="text-xs font-semibold text-slate-600 block mb-2">How long was tandem position held?</Label>
                        <RadioButtons
                          options={[
                            { val: "10+", label: "≥10 seconds (2 pts)" },
                            { val: "3-9", label: "3–9 seconds (1 pt)" },
                            { val: "<3", label: "< 3 seconds (0 pts)" }
                          ]}
                          value={tandemResult} onChange={setTandemResult}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Balance summary */}
                {balanceComplete && (
                  <div className={`rounded-lg px-4 py-3 border ${balanceScore >= 3 ? "bg-green-50 border-green-200" : balanceScore >= 2 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"}`}>
                    <p className={`font-semibold text-sm ${balanceScore >= 3 ? "text-green-800" : balanceScore >= 2 ? "text-yellow-800" : "text-red-800"}`}>
                      Balance Score: {balanceScore}/4
                    </p>
                    <p className="text-xs mt-0.5 text-slate-600">
                      {balanceScore === 4 ? "Excellent balance performance" : balanceScore === 3 ? "Good balance — tandem limited" : balanceScore <= 2 ? "Reduced balance — falls risk elevated" : ""}
                    </p>
                  </div>
                )}

                <Textarea value={balanceNotes} onChange={e => setBalanceNotes(e.target.value)} placeholder="Balance observations (sway, hesitation, compensatory strategies)..." rows={2} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTION 6: Gait ── */}
          <Collapsible open={open.gait} onOpenChange={() => tog("gait")}>
            <CollapsibleTrigger className="w-full text-left">
              <SectionHeader icon={Zap} title="6. Gait Speed Test" color="purple"
                subtitle="Timed walk — 2 trials, use fastest time" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-2">Walkway Distance</Label>
                  <RadioButtons
                    options={[{ val: 4, label: "4 metres (standard)" }, { val: 6, label: "6 metres" }, { val: 10, label: "10 metres" }]}
                    value={walkDistance} onChange={setWalkDistance}
                  />
                  {walkDistance !== 4 && <p className="text-xs text-amber-700 mt-1">⚠ Non-standard distance. Score will be normalised to 4m equivalent.</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 block mb-1">Trial 1 Time (seconds)</Label>
                    <Input type="number" step="0.01" min="0" value={gaitTrial1} onChange={e => setGaitTrial1(e.target.value)} placeholder="e.g. 6.8" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 block mb-1">Trial 2 Time (seconds)</Label>
                    <Input type="number" step="0.01" min="0" value={gaitTrial2} onChange={e => setGaitTrial2(e.target.value)} placeholder="e.g. 6.4" />
                  </div>
                </div>

                {fastestGait !== null && (
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div className="bg-slate-50 border rounded-lg p-3">
                      <p className="text-xs text-slate-500">Fastest Trial</p>
                      <p className="font-bold text-lg">{fastestGait}s</p>
                    </div>
                    <div className="bg-slate-50 border rounded-lg p-3">
                      <p className="text-xs text-slate-500">Gait Speed</p>
                      <p className="font-bold text-lg">{gaitSpeed} m/s</p>
                    </div>
                    <div className={`border rounded-lg p-3 ${gaitScore >= 3 ? "bg-green-50 border-green-200" : gaitScore === 2 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"}`}>
                      <p className="text-xs text-slate-500">Gait Score</p>
                      <p className={`font-bold text-lg ${gaitScore >= 3 ? "text-green-700" : gaitScore === 2 ? "text-yellow-700" : "text-red-700"}`}>{gaitScore}/4</p>
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-xs font-semibold text-slate-600 block mb-2">Walking aid used during test?</Label>
                  <YesNoButtons value={gaitAidUsed === true} onChange={v => setGaitAidUsed(v)} yesLabel="Yes" noLabel="No" />
                </div>

                <Textarea value={gaitNotes} onChange={e => setGaitNotes(e.target.value)} placeholder="Gait deviations, stops, compensatory strategies, confidence..." rows={2} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTION 7: Chair Stand ── */}
          <Collapsible open={open.chair} onOpenChange={() => tog("chair")}>
            <CollapsibleTrigger className="w-full text-left">
              <SectionHeader icon={Activity} title="7. Chair Stand Test" color="green"
                subtitle="Single rise screen → 5× sit-to-stand timed" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 space-y-4">

                {/* Stage 1: Single rise */}
                <Card className="border-2 border-green-200">
                  <CardHeader className="bg-green-50 py-3 px-4">
                    <CardTitle className="text-sm text-green-900">Stage 1 — Single Chair Rise (Screen)</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-xs text-slate-600 mb-3">Ask patient to stand once from chair with arms folded. Chair height 43–47 cm. If unable, score = 0 and stop.</p>
                    <Label className="text-xs font-semibold text-slate-600 block mb-2">Able to rise without using hands?</Label>
                    <YesNoButtons value={singleRiseAble} onChange={v => { setSingleRiseAble(v); if (!v) { setChairStandTime(""); setChairStoppedEarly(null); }}} />
                    {singleRiseAble === false && (
                      <div className="mt-3 bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-800">
                        Unable to perform single rise — Chair Stand Score = 0. Skip Stage 2.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Stage 2: 5× timed */}
                {singleRiseAble === true && (
                  <Card className="border-2 border-green-200">
                    <CardHeader className="bg-green-50 py-3 px-4">
                      <CardTitle className="text-sm text-green-900">Stage 2 — Five Times Sit-to-Stand (Timed)</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <p className="text-xs text-slate-600">Arms crossed over chest. Stand fully upright and sit down 5 times as fast as possible. Start timer on "Go", stop when standing for 5th time.</p>
                      <div>
                        <Label className="text-xs font-semibold text-slate-600 block mb-1">Total Time (seconds)</Label>
                        <Input type="number" step="0.1" min="0" value={chairStandTime} onChange={e => setChairStandTime(e.target.value)} placeholder="e.g. 12.5" className="w-32" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-600 block mb-2">Test stopped early / unable to complete?</Label>
                        <YesNoButtons value={chairStoppedEarly} onChange={setChairStoppedEarly} />
                      </div>
                      {chairScore !== null && !chairStoppedEarly && (
                        <div className={`rounded-lg px-4 py-3 border ${chairScore >= 3 ? "bg-green-50 border-green-200" : chairScore === 2 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"}`}>
                          <p className={`font-semibold text-sm ${chairScore >= 3 ? "text-green-800" : chairScore === 2 ? "text-yellow-800" : "text-red-800"}`}>
                            Chair Stand Score: {chairScore}/4
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {chairScore === 4 ? "Excellent lower limb power" : chairScore === 3 ? "Good — within normal range" : chairScore === 2 ? "Moderate — consider strength intervention" : "Poor — significant lower limb weakness"}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Textarea value={chairNotes} onChange={e => setChairNotes(e.target.value)} placeholder="Observations: use of momentum, trunk lean, balance during transfers, symptoms..." rows={2} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── SECTIONS 8–12: Results, Interpretation, Flags ── */}
          {allComplete && interpretation && (
            <div className="space-y-4">

              {/* Total Score */}
              <div className="bg-slate-800 text-white rounded-xl p-5 text-center">
                <p className="text-sm font-medium text-slate-300 mb-1">Total SPPB Score</p>
                <p className="text-5xl font-bold">{totalScore}<span className="text-2xl text-slate-400">/12</span></p>
                <p className={`text-lg font-semibold mt-2 ${interpretation.color.replace("text-", "text-").replace("700", "300").replace("red", "red").replace("orange", "orange").replace("yellow", "yellow").replace("green", "green")}`}>
                  {interpretation.level}
                </p>
              </div>

              {/* Clinical Interpretation */}
              <div className={`${interpretation.bg} border rounded-xl p-4`}>
                <p className={`font-semibold ${interpretation.color} mb-2 flex items-center gap-2`}>
                  <Info className="w-4 h-4" /> Clinical Interpretation
                </p>
                <p className="text-sm text-slate-800 leading-relaxed">{interpretation.narrative}</p>
              </div>

              {/* Normative */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <p className="font-semibold text-indigo-900 mb-2">Normative & Risk Classification</p>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {[
                    { range: "10–12", label: "High Function", sub: "Low risk", bg: "bg-green-100 border-green-300 text-green-800" },
                    { range: "7–9", label: "Mild Limitation", sub: "Elevated risk", bg: "bg-yellow-100 border-yellow-300 text-yellow-800" },
                    { range: "4–6", label: "Moderate Impairment", sub: "High risk", bg: "bg-orange-100 border-orange-300 text-orange-800" },
                    { range: "0–3", label: "Severe Limitation", sub: "Very high risk", bg: "bg-red-100 border-red-300 text-red-800" },
                  ].map(r => (
                    <div key={r.range} className={`border rounded-lg p-2 text-center ${r.bg} ${totalScore !== null && ((totalScore >= parseInt(r.range) && totalScore <= (parseInt(r.range.split("–")[1]))) ? "ring-2 ring-offset-1 ring-slate-700" : "opacity-70")}`}>
                      <p className="font-bold text-base">{r.range}</p>
                      <p className="font-semibold">{r.label}</p>
                      <p className="opacity-70">{r.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-indigo-800 space-y-1">
                  <p>• Score &lt;10 predicts disability, institutionalisation, and mortality (Guralnik 1994)</p>
                  <p>• Gait speed &lt;0.8 m/s associated with falls risk and sarcopenia</p>
                  <p>• MCID = 1 point (Perera et al.)</p>
                </div>
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
              placeholder="Document patient behaviour, fatigue, pain during testing, environmental factors, walking aid use, or any relevant contextual observations..."
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
                  { text: "Guralnik JM, Simonsick EM, Ferrucci L, et al. A Short Physical Performance Battery Assessing Lower Extremity Function. Journal of Gerontology. 1994;49(2):M85–M94.", url: "https://pubmed.ncbi.nlm.nih.gov/8126356/" },
                  { text: "Guralnik JM, Ferrucci L, Pieper CF, et al. Lower Extremity Function and Subsequent Disability. New England Journal of Medicine. 1995;332:556–561.", url: "https://pubmed.ncbi.nlm.nih.gov/7838189/" },
                  { text: "Pavasini R, Guralnik J, Brown JC, et al. Short Physical Performance Battery and all-cause mortality: systematic review and meta-analysis. BMC Medicine. 2016;14:215.", url: "https://pubmed.ncbi.nlm.nih.gov/27938375/" },
                  { text: "Perera S, Mody SH, Woodman RC, Studenski SA. Meaningful change and responsiveness in common physical performance measures in older adults. J Am Geriatr Soc. 2006;54(5):743–749.", url: "https://pubmed.ncbi.nlm.nih.gov/16696738/" },
                  { text: "Freiberger E, de Vreede P, Schoene D, et al. Performance-based physical function in older community-dwelling persons: a systematic review of instruments. Age and Ageing. 2012;41(6):712–721.", url: "https://pubmed.ncbi.nlm.nih.gov/22843639/" },
                ].map((ref, i) => (
                  <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 hover:underline">
                    <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {ref.text}
                  </a>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Action Buttons ── */}
          <div className="flex justify-between items-center gap-3 pt-4 border-t border-slate-200">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Cancel</Button>
              <Button variant="outline" onClick={handleReset} className="text-slate-600"><RotateCcw className="w-4 h-4 mr-2" />Reset</Button>
            </div>
            {!allComplete && (
              <p className="text-xs text-slate-500 text-center flex-1">Complete all SPPB domains before saving.</p>
            )}
            <Button onClick={handleSave} disabled={!allComplete} className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-2" />Save SPPB Assessment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}