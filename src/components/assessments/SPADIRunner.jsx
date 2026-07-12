import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, X, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const PAIN_ITEMS = [
  "At its worst?",
  "When lying on the involved side?",
  "Reaching for something on a high shelf?",
  "Touching the back of your neck?",
  "Pushing with the involved arm?",
];

const DISABILITY_ITEMS = [
  "Washing your hair?",
  "Washing your back?",
  "Putting on an undershirt or pullover sweater?",
  "Putting on a shirt that buttons down the front?",
  "Putting on your pants?",
  "Placing an object on a high shelf?",
  "Carrying a heavy object of 10 pounds (4.5 kg)?",
  "Removing something from your back pocket?",
];

function ScaleInput({ label, index, value, onChange }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-medium text-slate-700 mb-2">
        <span className="text-slate-400 mr-1">{index + 1}.</span> {label}
      </p>
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={`w-9 h-9 rounded-lg text-sm font-semibold border transition-all ${
              value === i
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600"
            }`}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-1 px-0.5">
        <span>No pain / No difficulty</span>
        <span>Worst pain / Can't do</span>
      </div>
    </div>
  );
}

export default function SPADIRunner({ client, onSave, onClose }) {
  const [step, setStep] = useState("pain"); // pain | disability | summary
  const [painScores, setPainScores] = useState({});
  const [disabilityScores, setDisabilityScores] = useState({});
  const [notes, setNotes] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(todayLocal());

  const setPain = (i, val) => setPainScores(prev => ({ ...prev, [i]: val }));
  const setDisability = (i, val) => setDisabilityScores(prev => ({ ...prev, [i]: val }));

  const painComplete = PAIN_ITEMS.every((_, i) => painScores[i] !== undefined);
  const disabilityComplete = DISABILITY_ITEMS.every((_, i) => disabilityScores[i] !== undefined);

  const painSum = Object.values(painScores).reduce((a, b) => a + b, 0);
  const disabilitySum = Object.values(disabilityScores).reduce((a, b) => a + b, 0);
  const painSubscale = painComplete ? (painSum / 50) * 100 : null;
  const disabilitySubscale = disabilityComplete ? (disabilitySum / 80) * 100 : null;
  const totalScore = (painSubscale !== null && disabilitySubscale !== null)
    ? Math.round((painSubscale + disabilitySubscale) / 2)
    : null;

  const getInterpretation = (score) => {
    if (score < 20) return { label: "Minimal disability", color: "bg-green-50 border-green-300 text-green-800" };
    if (score < 40) return { label: "Mild disability", color: "bg-yellow-50 border-yellow-300 text-yellow-800" };
    if (score < 60) return { label: "Moderate disability", color: "bg-orange-50 border-orange-300 text-orange-800" };
    return { label: "Severe disability", color: "bg-red-50 border-red-300 text-red-800" };
  };

  const interp = totalScore !== null ? getInterpretation(totalScore) : null;

  const handleSave = () => {
    const soapLines = [
      `• Shoulder Pain and Disability Index (SPADI)`,
      `  Assessment Date: ${assessmentDate}`,
      ``,
      `  Subscale Scores:`,
      `    Pain Subscale: ${painSubscale?.toFixed(1)}%  (sum ${painSum}/50)`,
      `    Disability Subscale: ${disabilitySubscale?.toFixed(1)}%  (sum ${disabilitySum}/80)`,
      `    Total SPADI Score: ${totalScore}%`,
      ``,
      `  Interpretation: ${interp?.label}`,
      `    Score interpretation: <20% Minimal, 20-40% Mild, 40-60% Moderate, >60% Severe disability`,
      ``,
      `  Pain Items (0=no pain, 10=worst pain):`,
      ...PAIN_ITEMS.map((item, i) => `    ${i + 1}. ${item} → ${painScores[i]}/10`),
      ``,
      `  Disability Items (0=no difficulty, 10=can't do):`,
      ...DISABILITY_ITEMS.map((item, i) => `    ${i + 1}. ${item} → ${disabilityScores[i]}/10`),
      notes ? `\n  Clinical Notes: ${notes}` : null,
      ``,
      `  Reference: Roach KE et al. (1991). Development of a shoulder pain and disability index. Arthritis Care & Research, 4(4), 143-149.`,
    ].filter(l => l !== null).join('\n');

    onSave({
      status: "completed",
      result_value: totalScore,
      notes,
      assessment_date: assessmentDate,
      additional_data: {
        pain_subscale: parseFloat(painSubscale?.toFixed(1)),
        disability_subscale: parseFloat(disabilitySubscale?.toFixed(1)),
        total_score: totalScore,
        pain_sum: painSum,
        disability_sum: disabilitySum,
        interpretation: interp?.label,
        soap_text: soapLines,
      }
    });

    toast.success("SPADI assessment saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-start z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Shoulder Pain and Disability Index (SPADI)</h2>
            <p className="text-sm text-slate-500">{client?.full_name} · 13-item subscale assessment</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4 flex gap-2">
          {["Pain Subscale", "Disability Subscale", "Summary"].map((label, i) => {
            const stepMap = ["pain", "disability", "summary"];
            const isActive = step === stepMap[i];
            const isDone = (step === "disability" && i === 0) || (step === "summary" && i <= 1);
            return (
              <div key={label} className={`flex-1 text-center text-xs py-1 rounded-full font-medium border ${isActive ? "bg-blue-600 text-white border-blue-600" : isDone ? "bg-green-100 text-green-700 border-green-300" : "bg-slate-100 text-slate-400 border-slate-200"}`}>
                {label}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-1">

          {/* Pain Step */}
          {step === "pain" && (
            <>
              <Card className="border-blue-200 bg-blue-50 mb-4">
                <CardContent className="pt-4 pb-3">
                  <div className="flex gap-2 text-sm text-blue-800">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>Rate how much pain you experience during the following activities. (0 = No pain, 10 = Worst pain imaginable)</p>
                  </div>
                </CardContent>
              </Card>
              <p className="text-base font-semibold text-slate-700 mb-3">How severe is your pain…</p>
              {PAIN_ITEMS.map((item, i) => (
                <ScaleInput key={i} label={item} index={i} value={painScores[i]} onChange={(v) => setPain(i, v)} />
              ))}
            </>
          )}

          {/* Disability Step */}
          {step === "disability" && (
            <>
              <Card className="border-blue-200 bg-blue-50 mb-4">
                <CardContent className="pt-4 pb-3">
                  <div className="flex gap-2 text-sm text-blue-800">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>Rate how much difficulty you experience performing each activity. (0 = No difficulty, 10 = Can't do)</p>
                  </div>
                </CardContent>
              </Card>
              <p className="text-base font-semibold text-slate-700 mb-3">How much difficulty do you have…</p>
              {DISABILITY_ITEMS.map((item, i) => (
                <ScaleInput key={i} label={item} index={i} value={disabilityScores[i]} onChange={(v) => setDisability(i, v)} />
              ))}
            </>
          )}

          {/* Summary Step */}
          {step === "summary" && interp && (
            <>
              <div className={`border-2 rounded-xl p-5 text-center mb-4 ${interp.color}`}>
                <p className="text-sm font-medium mb-1">Total SPADI Score</p>
                <p className="text-5xl font-bold">{totalScore}%</p>
                <p className="text-base font-semibold mt-2">{interp.label}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <Card className="border-slate-200">
                  <CardContent className="pt-4 pb-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Pain Subscale</p>
                    <p className="text-2xl font-bold text-slate-800">{painSubscale?.toFixed(1)}%</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardContent className="pt-4 pb-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Disability Subscale</p>
                    <p className="text-2xl font-bold text-slate-800">{disabilitySubscale?.toFixed(1)}%</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-sm">Assessment Date</CardTitle></CardHeader>
                <CardContent>
                  <input
                    type="date"
                    value={assessmentDate}
                    onChange={e => setAssessmentDate(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
                  />
                </CardContent>
              </Card>

              <Card className="mt-3">
                <CardHeader><CardTitle className="text-sm">Clinical Notes (optional)</CardTitle></CardHeader>
                <CardContent>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Clinical observations, treatment plans..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
                  />
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-slate-50 px-6 py-4 flex justify-between items-center">
          <Button variant="outline" onClick={() => {
            if (step === "pain") onClose();
            else if (step === "disability") setStep("pain");
            else setStep("disability");
          }}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            {step === "pain" ? "Cancel" : "Back"}
          </Button>

          {step === "pain" && (
            <Button
              disabled={!painComplete}
              onClick={() => setStep("disability")}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {step === "disability" && (
            <Button
              disabled={!disabilityComplete}
              onClick={() => setStep("summary")}
              className="bg-blue-600 hover:bg-blue-700"
            >
              View Results <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {step === "summary" && (
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Save Assessment
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}