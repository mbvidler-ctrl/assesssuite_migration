import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ChevronRight, ChevronLeft, AlertTriangle, CheckCircle2, Clock,
  Play, Pause, Square, RotateCcw, Activity, TrendingUp, FileText,
  BookOpen, Shield, User, Target, BarChart3, Flag, Info, ChevronDown
} from "lucide-react";

const NORMATIVE_DATA = [
  { ageMin: 18, ageMax: 39, label: "18–39 yrs", eyesOpen: { excellent: 45, good: 30, fair: 15, poor: 5 }, eyesClosed: { excellent: 25, good: 15, fair: 8, poor: 3 } },
  { ageMin: 40, ageMax: 49, label: "40–49 yrs", eyesOpen: { excellent: 38, good: 25, fair: 12, poor: 4 }, eyesClosed: { excellent: 20, good: 12, fair: 6, poor: 2 } },
  { ageMin: 50, ageMax: 59, label: "50–59 yrs", eyesOpen: { excellent: 28, good: 18, fair: 9, poor: 3 }, eyesClosed: { excellent: 15, good: 9, fair: 4, poor: 1 } },
  { ageMin: 60, ageMax: 69, label: "60–69 yrs", eyesOpen: { excellent: 20, good: 12, fair: 6, poor: 2 }, eyesClosed: { excellent: 10, good: 6, fair: 3, poor: 1 } },
  { ageMin: 70, ageMax: 120, label: "70+ yrs", eyesOpen: { excellent: 12, good: 7, fair: 3, poor: 1 }, eyesClosed: { excellent: 5, good: 3, fair: 2, poor: 0 } },
];

const QUALITY_LABELS = ["Severe", "Poor", "Fair", "Good", "Excellent"];
const QUALITY_COLORS = ["bg-red-100 text-red-700", "bg-orange-100 text-orange-700", "bg-yellow-100 text-yellow-700", "bg-blue-100 text-blue-700", "bg-green-100 text-green-700"];

const STEPS = [
  { id: "overview", label: "Overview" },
  { id: "safety", label: "Safety" },
  { id: "instructions", label: "Instructions" },
  { id: "setup", label: "Setup" },
  { id: "left", label: "Left Leg" },
  { id: "right", label: "Right Leg" },
  { id: "results", label: "Results" },
];

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const dec = Math.floor((ms % 1000) / 100);
  return `${s}.${dec}`;
}

function LegTimer({ side, color, data, onChange }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);
  const startRef = useRef(null);

  const start = () => {
    startRef.current = Date.now() - elapsed;
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - startRef.current);
    }, 50);
    setRunning(true);
  };

  const pause = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    const secs = parseFloat((elapsed / 1000).toFixed(1));
    const newTrials = [...(data.trials || []), secs];
    const best = Math.max(...newTrials);
    onChange({ ...data, trials: newTrials, best_time: best });
    setElapsed(0);
  };

  const reset = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    setElapsed(0);
  };

  const removeTrial = (idx) => {
    const newTrials = data.trials.filter((_, i) => i !== idx);
    const best = newTrials.length > 0 ? Math.max(...newTrials) : 0;
    onChange({ ...data, trials: newTrials, best_time: best });
  };

  const toggleObs = (key) => {
    onChange({ ...data, observations: { ...(data.observations || {}), [key]: !data.observations?.[key] } });
  };

  return (
    <div className={`rounded-xl border-2 ${color} p-5 space-y-4`}>
      <h3 className="text-lg font-bold text-slate-800">{side} Leg</h3>

      <div className="bg-slate-900 rounded-xl p-6 text-center">
        <div className="text-5xl font-mono font-bold text-white tracking-wider">
          {formatTime(elapsed)}
          <span className="text-2xl text-slate-400 ml-1">s</span>
        </div>
        {running && <div className="mt-2 flex justify-center gap-1">{[...Array(3)].map((_, i) => (
          <div key={i} className="w-2 h-2 rounded-full bg-green-400 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}</div>}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Button onClick={start} disabled={running} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
          <Play className="w-4 h-4" />
        </Button>
        <Button onClick={pause} disabled={!running} size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white">
          <Pause className="w-4 h-4" />
        </Button>
        <Button onClick={stop} disabled={running && elapsed === 0} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
          <Square className="w-4 h-4" />
        </Button>
        <Button onClick={reset} size="sm" variant="outline">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-xs text-slate-500 text-center">Start → Stop to record a trial. Record up to 3 trials.</p>

      {data.trials?.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-600 uppercase">Recorded Trials</p>
          {data.trials.map((t, i) => (
            <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-200">
              <span className="text-sm text-slate-700 font-medium">Trial {i + 1}: <strong>{t}s</strong></span>
              {t === data.best_time && <Badge className="bg-green-100 text-green-700 text-xs">Best</Badge>}
              <button onClick={() => removeTrial(i)} className="text-slate-400 hover:text-red-500 text-xs ml-2">×</button>
            </div>
          ))}
          <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-700">Best Time</span>
            <span className="text-lg font-bold text-slate-900">{data.best_time || 0}s</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-600 uppercase">Clinical Observations</p>
        <div className="grid grid-cols-1 gap-1.5">
          {[
            { key: "loss_of_balance", label: "Loss of balance" },
            { key: "excessive_sway", label: "Excessive sway" },
            { key: "hip_drop", label: "Hip drop" },
            { key: "required_guarding", label: "Required guarding" },
          ].map(opt => (
            <label key={opt.key} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded p-1">
              <Checkbox
                checked={!!data.observations?.[opt.key]}
                onCheckedChange={() => toggleObs(opt.key)}
              />
              <span className="text-sm text-slate-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function QualityScorer({ side, data, onChange }) {
  const DIMENSIONS = [
    { key: "postural_control", label: "Postural Control" },
    { key: "stability", label: "Overall Stability" },
    { key: "tremor", label: "Absence of Tremor" },
  ];

  const scores = data.quality_scores || {};

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-slate-700">{side} Leg — Balance Quality</h4>
      {DIMENSIONS.map(dim => (
        <div key={dim.key}>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-slate-600">{dim.label}</span>
            {scores[dim.key] !== undefined && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${QUALITY_COLORS[scores[dim.key]]}`}>
                {QUALITY_LABELS[scores[dim.key]]}
              </span>
            )}
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map(n => (
              <button key={n} onClick={() => onChange({ ...data, quality_scores: { ...scores, [dim.key]: n } })}
                className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-all ${scores[dim.key] === n ? QUALITY_COLORS[n] + ' border-current' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StandingStorkTestRunner({ client, onSave, onClose }) {
  const [step, setStep] = useState(0);
  const [safety, setSafety] = useState({
    safe_standing: false, no_dizziness: false, no_pain: false,
    no_recent_fall: false, weight_bear_ok: false, aid_nearby: false, consent: false
  });
  const [setup, setSetup] = useState({
    shoes: "off", surface: "firm", eyes: "open", dominant: "right", confidence: 5, pain: 0, dizziness: 0
  });
  const [leftData, setLeftData] = useState({ trials: [], best_time: 0, observations: {} });
  const [rightData, setRightData] = useState({ trials: [], best_time: 0, observations: {} });
  const [clinicalNotes, setClinicalNotes] = useState("");

  const safetyAll = Object.values(safety).every(Boolean);
  const leftDone = leftData.trials?.length > 0;
  const rightDone = rightData.trials?.length > 0;
  const canSave = leftDone && rightDone;

  const getAgeGroup = (age) => {
    if (!age) return NORMATIVE_DATA[0];
    const n = parseInt(age);
    return NORMATIVE_DATA.find(d => n >= d.ageMin && n <= d.ageMax) || NORMATIVE_DATA[NORMATIVE_DATA.length - 1];
  };

  const clientAge = client?.date_of_birth ? Math.floor((Date.now() - new Date(client.date_of_birth)) / (365.25 * 24 * 3600 * 1000)) : null;
  const normGroup = getAgeGroup(clientAge);
  const normKey = setup.eyes === "open" ? "eyesOpen" : "eyesClosed";
  const norms = normGroup[normKey];

  const leftBest = leftData.best_time || 0;
  const rightBest = rightData.best_time || 0;
  const asymmetry = leftBest + rightBest > 0 ? Math.round(Math.abs(leftBest - rightBest) / Math.max(leftBest, rightBest) * 100) : 0;

  const classifyTime = (t) => {
    if (t >= norms.excellent) return { label: "Excellent", color: "text-green-700", bg: "bg-green-50" };
    if (t >= norms.good) return { label: "Good", color: "text-blue-700", bg: "bg-blue-50" };
    if (t >= norms.fair) return { label: "Fair", color: "text-yellow-700", bg: "bg-yellow-50" };
    if (t >= norms.poor) return { label: "Poor", color: "text-orange-700", bg: "bg-orange-50" };
    return { label: "High Risk", color: "text-red-700", bg: "bg-red-50" };
  };

  const generateSOAP = () => {
    let text = `• Standing Stork Test (Unipedal Stance)\n`;
    text += `  Eyes: ${setup.eyes === "open" ? "Open" : "Closed"} | Surface: ${setup.surface}\n`;
    text += `  Left leg: ${leftBest}s best (${leftData.trials?.length || 0} trials)\n`;
    text += `  Right leg: ${rightBest}s best (${rightData.trials?.length || 0} trials)\n`;
    text += `  Asymmetry: ${asymmetry}%\n`;
    if (clinicalNotes) text += `  Notes: ${clinicalNotes}\n`;
    return text;
  };

  const handleSave = () => {
    onSave({
      result_value: Math.max(leftBest, rightBest),
      notes: clinicalNotes,
      additional_data: {
        soap_text: generateSOAP(),
        left_time: leftBest,
        right_time: rightBest,
        asymmetry: asymmetry,
        left_classification: classifyTime(leftBest).label,
        right_classification: classifyTime(rightBest).label,
      }
    });
  };

  const renderStep = () => {
    switch (STEPS[step].id) {
      case "overview":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Standing Stork Test</h2>
            <p className="text-sm text-slate-600">Unipedal stance assessment for static balance and proprioception.</p>
            <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-700">
              Patient stands on one leg with hands on hips and opposite foot on knee for as long as possible (max 60 seconds per leg).
            </div>
          </div>
        );

      case "safety":
        return (
          <div className="space-y-3">
            <h3 className="font-semibold">Safety Screening</h3>
            {[
              { key: "safe_standing", label: "Patient can stand independently and safely" },
              { key: "no_dizziness", label: "No acute dizziness or vertigo" },
              { key: "no_pain", label: "No severe lower limb pain" },
              { key: "no_recent_fall", label: "No fall has occurred today" },
              { key: "weight_bear_ok", label: "Full weight-bearing is safe" },
              { key: "aid_nearby", label: "Walking aid or support available" },
              { key: "consent", label: "Patient has consented to testing" },
            ].map(item => (
              <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={safety[item.key]} onCheckedChange={v => setSafety(s => ({ ...s, [item.key]: !!v }))} />
                <span className="text-sm">{item.label}</span>
              </label>
            ))}
            {safetyAll && <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">Safety confirmed ✓</div>}
          </div>
        );

      case "instructions":
        return (
          <div className="space-y-3">
            <h3 className="font-semibold">Instructions</h3>
            <ol className="text-sm space-y-2 text-slate-700">
              <li>1. Stand on one leg with hands on hips</li>
              <li>2. Place opposite foot lightly on knee of stance leg</li>
              <li>3. Look straight ahead</li>
              <li>4. Clinician starts timer when patient is steady</li>
              <li>5. Stop timing when: hands leave hips, raised foot touches ground, or patient loses balance</li>
              <li>6. Record up to 3 trials, use best time for scoring</li>
            </ol>
          </div>
        );

      case "setup":
        return (
          <div className="space-y-4">
            {[
              { label: "Footwear", key: "shoes", options: [["off", "Barefoot"], ["on", "Shoes On"]] },
              { label: "Surface", key: "surface", options: [["firm", "Firm"], ["foam", "Foam Pad"]] },
              { label: "Eyes", key: "eyes", options: [["open", "Open"], ["closed", "Closed"]] },
            ].map(({ label, key, options }) => (
              <div key={key}>
                <p className="text-sm font-semibold mb-2">{label}</p>
                <div className="flex gap-2">
                  {options.map(([val, lbl]) => (
                    <button key={val} onClick={() => setSetup(s => ({ ...s, [key]: val }))}
                      className={`px-3 py-1.5 rounded border text-sm ${setup[key] === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-700'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );

      case "left":
        return (
          <div className="space-y-4">
            <LegTimer side="LEFT" color="border-blue-200 bg-blue-50/30" data={leftData} onChange={setLeftData} />
            <QualityScorer side="Left" data={leftData} onChange={setLeftData} />
          </div>
        );

      case "right":
        return (
          <div className="space-y-4">
            <LegTimer side="RIGHT" color="border-emerald-200 bg-emerald-50/30" data={rightData} onChange={setRightData} />
            <QualityScorer side="Right" data={rightData} onChange={setRightData} />
          </div>
        );

      case "results":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[{ side: "Left", best: leftBest, done: leftDone }, { side: "Right", best: rightBest, done: rightDone }].map(({ side, best, done }) => {
                const cls = done ? classifyTime(best) : null;
                return (
                  <div key={side} className={`rounded-xl border-2 p-4 text-center ${cls ? cls.bg : 'border-slate-200 bg-slate-50'}`}>
                    <p className="text-xs text-slate-600 mb-1 uppercase">{side} Leg</p>
                    <p className="text-3xl font-bold text-slate-900">{best}<span className="text-lg text-slate-500">s</span></p>
                    {cls && <p className={`text-sm font-semibold mt-1 ${cls.color}`}>{cls.label}</p>}
                  </div>
                );
              })}
            </div>
            <div>
              <Label className="text-sm font-semibold">Clinical Notes</Label>
              <Textarea value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)} placeholder="Additional observations..." rows={3} className="mt-1.5" />
            </div>
            {canSave && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-700">Ready to save results</p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-white font-bold">Standing Stork Test</h1>
              <p className="text-indigo-200 text-xs">{STEPS[step].label}</p>
            </div>
            <button onClick={onClose} className="text-white text-2xl leading-none">×</button>
          </div>
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <button key={s.id} onClick={() => setStep(i)} className={`flex-1 h-1.5 rounded-full transition-all ${i < step ? 'bg-white' : i === step ? 'bg-white' : 'bg-white/30'}`} />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {renderStep()}
        </div>

        <div className="border-t border-slate-200 bg-white p-4 flex justify-between gap-3">
          <Button variant="outline" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={isFirst}>
            <ChevronLeft className="w-4 h-4" />Back
          </Button>
          <div className="flex gap-2">
            {canSave && (
              <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <CheckCircle2 className="w-4 h-4" />Save
              </Button>
            )}
            {!isLast && (
              <Button onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Next<ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}