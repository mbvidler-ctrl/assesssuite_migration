import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Info, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

// PSQI Components and scoring
const COMPONENTS = [
  { label: "Subjective Sleep Quality", key: "c1" },
  { label: "Sleep Latency", key: "c2" },
  { label: "Sleep Duration", key: "c3" },
  { label: "Habitual Sleep Efficiency", key: "c4" },
  { label: "Sleep Disturbances", key: "c5" },
  { label: "Use of Sleep Medication", key: "c6" },
  { label: "Daytime Dysfunction", key: "c7" },
];

const Q1_OPTIONS = [
  { label: "Very good", value: 0 },
  { label: "Fairly good", value: 1 },
  { label: "Fairly bad", value: 2 },
  { label: "Very bad", value: 3 },
];

const FREQ_OPTIONS = [
  { label: "Not during the past month", value: 0 },
  { label: "Less than once a week", value: 1 },
  { label: "Once or twice a week", value: 2 },
  { label: "Three or more times a week", value: 3 },
];

const LATENCY_MIN_OPTIONS = [
  { label: "≤15 minutes", value: 0 },
  { label: "16–30 minutes", value: 1 },
  { label: "31–60 minutes", value: 2 },
  { label: ">60 minutes", value: 3 },
];

const DURATION_OPTIONS = [
  { label: "More than 7 hours", value: 0 },
  { label: "6–7 hours", value: 1 },
  { label: "5–6 hours", value: 2 },
  { label: "Less than 5 hours", value: 3 },
];

const DYSFUNCTION_OPTIONS = [
  { label: "No problem at all", value: 0 },
  { label: "Only a very slight problem", value: 1 },
  { label: "Somewhat of a problem", value: 2 },
  { label: "A very big problem", value: 3 },
];

function ScoreButtons({ options, value, onChange }) {
  return (
    <div className="flex flex-col gap-1 mt-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
            value === opt.value
              ? "bg-blue-600 text-white border-blue-600 font-semibold"
              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SectionHeader({ number, title, subtitle }) {
  return (
    <div className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 mb-3">
      <p className="font-bold text-slate-800 text-sm">Component {number}: {title}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

export default function PittsburghSleepQualityIndexPSQIRunner({ client, onSave, onClose }) {
  const [showInfo, setShowInfo] = useState(false);
  const [notes, setNotes] = useState("");

  // Raw question responses
  const [q1, setQ1] = useState(null);           // bedtime
  const [q2min, setQ2min] = useState(null);     // minutes to fall asleep
  const [q3, setQ3] = useState("");             // wake time
  const [q4hrs, setQ4hrs] = useState(null);     // hours of actual sleep
  const [q5a, setQ5a] = useState(null);         // can't sleep within 30 min
  const [q5b, setQ5b] = useState(null);         // wake in night or early morning
  const [q5c, setQ5c] = useState(null);         // bathroom
  const [q5d, setQ5d] = useState(null);         // can't breathe comfortably
  const [q5e, setQ5e] = useState(null);         // cough/snore
  const [q5f, setQ5f] = useState(null);         // too cold
  const [q5g, setQ5g] = useState(null);         // too hot
  const [q5h, setQ5h] = useState(null);         // bad dreams
  const [q5i, setQ5i] = useState(null);         // pain
  const [q5j, setQ5j] = useState(null);         // other
  const [q6, setQ6] = useState(null);           // sleep medication
  const [q7, setQ7] = useState(null);           // trouble staying awake
  const [q8, setQ8] = useState(null);           // keeping enthusiasm
  const [q9, setQ9] = useState(null);           // overall sleep quality
  const [bedtime, setBedtime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [bedHours, setBedHours] = useState("");

  // Component scores
  const c1 = q9 ?? null;

  const c2 = (() => {
    if (q2min === null || q5a === null) return null;
    const sum = q2min + q5a;
    if (sum === 0) return 0;
    if (sum <= 2) return 1;
    if (sum <= 4) return 2;
    return 3;
  })();

  const c3 = q4hrs;

  const c4 = (() => {
    const actualHrs = parseFloat(bedHours);
    const sleepHrs = q4hrs !== null ? [7, 6.5, 5.5, 4][q4hrs] : null;
    if (!actualHrs || sleepHrs === null) return null;
    const efficiency = (sleepHrs / actualHrs) * 100;
    if (efficiency >= 85) return 0;
    if (efficiency >= 75) return 1;
    if (efficiency >= 65) return 2;
    return 3;
  })();

  const c5 = (() => {
    const items = [q5b, q5c, q5d, q5e, q5f, q5g, q5h, q5i, q5j];
    if (items.some(v => v === null)) return null;
    const sum = items.reduce((a, b) => a + b, 0);
    if (sum === 0) return 0;
    if (sum <= 9) return 1;
    if (sum <= 18) return 2;
    return 3;
  })();

  const c6 = q6;

  const c7 = (() => {
    if (q7 === null || q8 === null) return null;
    const sum = q7 + q8;
    if (sum === 0) return 0;
    if (sum <= 2) return 1;
    if (sum <= 4) return 2;
    return 3;
  })();

  const components = [c1, c2, c3, c4, c5, c6, c7];
  const allScored = components.every(c => c !== null);
  const totalScore = allScored ? components.reduce((a, b) => a + b, 0) : null;

  const getInterpretation = (score) => {
    if (score <= 5) return { label: "Good Sleep Quality", color: "green", detail: "Score ≤5 indicates good overall sleep quality. No significant sleep disturbance." };
    if (score <= 10) return { label: "Poor Sleep Quality", color: "yellow", detail: "Score 6–10 indicates poor sleep quality. Consider sleep hygiene education and monitoring." };
    return { label: "Severely Disturbed Sleep", color: "red", detail: "Score >10 indicates severely disturbed sleep. Clinical intervention and referral recommended." };
  };

  const handleSave = () => {
    if (!allScored) {
      toast.error("Please complete all questions before saving.");
      return;
    }
    const interp = getInterpretation(totalScore);
    const compLabels = COMPONENTS.map((c, i) => `${c.label}: ${components[i]}/3`).join("\n  ");
    const soapText = `• Pittsburgh Sleep Quality Index (PSQI)\n  Total Score: ${totalScore}/21 — ${interp.label}\n\n  Component Scores:\n  ${compLabels}`;
    onSave({
      status: "completed",
      result_value: totalScore,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
      additional_data: {
        soap_text: soapText,
        components: { c1, c2, c3, c4, c5, c6, c7 },
        interpretation: interp.label,
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50 sticky top-0">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Pittsburgh Sleep Quality Index (PSQI)</h2>
              <p className="text-slate-600 mt-1">Self-reported sleep quality assessment — past month</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Clinician Info */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="w-full flex justify-between items-center px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg font-semibold text-blue-900 hover:bg-blue-100 transition-colors text-sm"
          >
            <span className="flex items-center gap-2"><Info className="w-4 h-4" />Clinician Instructions & Scoring Guide</span>
            {showInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-800 space-y-2">
              <p><strong>Purpose:</strong> The PSQI assesses sleep quality over the past month across 7 components. Each component scored 0–3; total score 0–21.</p>
              <p><strong>Cut-off:</strong> Score &gt;5 = poor sleep quality (sensitivity 89.6%, specificity 86.5% — Buysse et al. 1989).</p>
              <p><strong>Administration:</strong> Can be self-administered or clinician-assisted. Ask client to think about their <em>usual</em> sleep over the past month.</p>
              <p><strong>Components:</strong> C1 Subjective Quality · C2 Latency · C3 Duration · C4 Efficiency · C5 Disturbances · C6 Medication · C7 Daytime Function</p>
            </div>
          )}

          {/* Patient instruction banner */}
          <div className="bg-indigo-600 text-white rounded-lg px-4 py-3 text-sm">
            <p className="font-semibold mb-1">Instructions for Client:</p>
            <p>Think about your sleep over the <strong>past month only</strong>. Answer each question as accurately as possible. There are no right or wrong answers.</p>
          </div>

          {/* Sleep Timing */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <p className="font-semibold text-slate-800 text-sm">Sleep Timing (used to calculate efficiency)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Usual bedtime</Label>
                <Input value={bedtime} onChange={e => setBedtime(e.target.value)} placeholder="e.g. 10:30 PM" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Usual wake time</Label>
                <Input value={wakeTime} onChange={e => setWakeTime(e.target.value)} placeholder="e.g. 6:30 AM" className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Hours spent in bed (bedtime to wake time)</Label>
              <Input type="number" step="0.5" value={bedHours} onChange={e => setBedHours(e.target.value)} placeholder="e.g. 8" className="mt-1 w-32" />
            </div>
          </div>

          {/* C2: Sleep Latency */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <SectionHeader number={2} title="Sleep Latency" subtitle="How long it takes to fall asleep" />
            <p className="text-sm font-medium text-slate-700">How long has it usually taken you to fall asleep each night during the past month?</p>
            <ScoreButtons options={LATENCY_MIN_OPTIONS} value={q2min} onChange={setQ2min} />
            <p className="text-sm font-medium text-slate-700 mt-2">During the past month, how often have you had trouble sleeping because you <strong>could not get to sleep within 30 minutes</strong>?</p>
            <ScoreButtons options={FREQ_OPTIONS} value={q5a} onChange={setQ5a} />
          </div>

          {/* C3: Sleep Duration */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <SectionHeader number={3} title="Sleep Duration" subtitle="Actual hours of sleep (not time in bed)" />
            <p className="text-sm font-medium text-slate-700">During the past month, how many hours of <strong>actual sleep</strong> did you get at night? (This may be different from the number of hours you spent in bed.)</p>
            <ScoreButtons options={DURATION_OPTIONS} value={q4hrs} onChange={setQ4hrs} />
          </div>

          {/* C4: Sleep Efficiency (auto-calculated from bedtime data) */}
          <div className="border border-slate-200 rounded-lg p-4">
            <SectionHeader number={4} title="Habitual Sleep Efficiency" subtitle="Calculated from hours slept ÷ hours in bed" />
            <p className="text-xs text-slate-500">Automatically calculated once sleep duration and hours in bed are entered above.</p>
            {c4 !== null && (
              <div className="mt-2">
                <Badge className={c4 === 0 ? "bg-green-100 text-green-800" : c4 === 1 ? "bg-lime-100 text-lime-800" : c4 === 2 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}>
                  Component Score: {c4}/3
                </Badge>
              </div>
            )}
          </div>

          {/* C5: Sleep Disturbances */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <SectionHeader number={5} title="Sleep Disturbances" subtitle="How often in the past month did you have trouble sleeping because of..." />
            {[
              { label: "Waking in the night or early morning", state: q5b, set: setQ5b },
              { label: "Having to get up to use the bathroom", state: q5c, set: setQ5c },
              { label: "Cannot breathe comfortably", state: q5d, set: setQ5d },
              { label: "Coughing or snoring loudly", state: q5e, set: setQ5e },
              { label: "Feeling too cold", state: q5f, set: setQ5f },
              { label: "Feeling too hot", state: q5g, set: setQ5g },
              { label: "Having bad dreams", state: q5h, set: setQ5h },
              { label: "Having pain", state: q5i, set: setQ5i },
              { label: "Other reason(s)", state: q5j, set: setQ5j },
            ].map(({ label, state, set }, i) => (
              <div key={i}>
                <p className="text-sm font-medium text-slate-700">{label}</p>
                <ScoreButtons options={FREQ_OPTIONS} value={state} onChange={set} />
              </div>
            ))}
          </div>

          {/* C1: Subjective Sleep Quality */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <SectionHeader number={1} title="Subjective Sleep Quality" />
            <p className="text-sm font-medium text-slate-700">During the past month, how would you rate your <strong>sleep quality overall</strong>?</p>
            <ScoreButtons options={Q1_OPTIONS} value={q9} onChange={setQ9} />
          </div>

          {/* C6: Sleep Medication */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <SectionHeader number={6} title="Use of Sleep Medication" />
            <p className="text-sm font-medium text-slate-700">During the past month, how often have you taken medicine (prescribed or over-the-counter) to help you sleep?</p>
            <ScoreButtons options={FREQ_OPTIONS} value={q6} onChange={setQ6} />
          </div>

          {/* C7: Daytime Dysfunction */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <SectionHeader number={7} title="Daytime Dysfunction" />
            <p className="text-sm font-medium text-slate-700">During the past month, how often have you had <strong>trouble staying awake</strong> while driving, eating meals, or engaging in social activity?</p>
            <ScoreButtons options={FREQ_OPTIONS} value={q7} onChange={setQ7} />
            <p className="text-sm font-medium text-slate-700 mt-2">During the past month, how much of a <strong>problem</strong> has it been for you to keep up enough enthusiasm to get things done?</p>
            <ScoreButtons options={DYSFUNCTION_OPTIONS} value={q8} onChange={setQ8} />
          </div>

          {/* Live Score Summary */}
          <div className="border-2 border-indigo-200 rounded-xl p-4 bg-indigo-50">
            <p className="font-bold text-slate-800 mb-3">Component Score Summary</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {COMPONENTS.map((comp, i) => (
                <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-200">
                  <span className="text-xs text-slate-600">{comp.label}</span>
                  <span className={`text-sm font-bold ml-2 ${components[i] === null ? "text-slate-300" : components[i] === 0 ? "text-green-600" : components[i] === 1 ? "text-lime-600" : components[i] === 2 ? "text-yellow-600" : "text-red-600"}`}>
                    {components[i] !== null ? `${components[i]}/3` : "–"}
                  </span>
                </div>
              ))}
            </div>
            {allScored && (() => {
              const interp = getInterpretation(totalScore);
              return (
                <div className={`rounded-lg p-3 border ${interp.color === "green" ? "bg-green-100 border-green-300" : interp.color === "yellow" ? "bg-yellow-100 border-yellow-300" : "bg-red-100 border-red-300"}`}>
                  <p className={`font-bold text-lg ${interp.color === "green" ? "text-green-800" : interp.color === "yellow" ? "text-yellow-800" : "text-red-800"}`}>
                    Total Score: {totalScore}/21 — {interp.label}
                  </p>
                  <p className={`text-xs mt-1 ${interp.color === "green" ? "text-green-700" : interp.color === "yellow" ? "text-yellow-700" : "text-red-700"}`}>{interp.detail}</p>
                </div>
              );
            })()}
            {!allScored && <p className="text-xs text-slate-500 italic">Complete all sections to see total score.</p>}
          </div>

          {/* Notes */}
          <div>
            <Label>Clinical Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Observations, context, client comments..." className="mt-1" />
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center sticky bottom-0">
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Close</Button>
          <Button onClick={handleSave} disabled={!allScored} className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="w-4 h-4 mr-2" />Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}