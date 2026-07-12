import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { X, Save, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// PASE weights per the Washburn et al. 1993 scoring algorithm
const LEISURE_ITEMS = [
  { id: "walking", label: "Walking for exercise" },
  { id: "light_sport", label: "Light sport / recreation (e.g. bowling, golf)" },
  { id: "moderate_sport", label: "Moderate sport / recreation (e.g. doubles tennis, ballroom dancing)" },
  { id: "strenuous_sport", label: "Strenuous sport / recreation (e.g. swimming, singles tennis, aerobics)" },
  { id: "muscle_exercise", label: "Muscle strengthening exercises (e.g. weights, resistance bands)" },
];

const LEISURE_HOURS = [
  { value: 1, label: "< 1 hr/week" },
  { value: 2, label: "1–2 hrs/week" },
  { value: 3, label: "2–4 hrs/week" },
  { value: 4, label: "> 4 hrs/week" },
];

// Leisure weights mapped to hours option value (Washburn 1993)
const LEISURE_WEIGHTS = {
  walking: [0.11, 0.32, 0.64, 1.07],
  light_sport: [0.13, 0.38, 0.76, 1.27],
  moderate_sport: [0.25, 0.75, 1.50, 2.50],
  strenuous_sport: [0.38, 1.13, 2.26, 3.77],
  muscle_exercise: [0.19, 0.57, 1.14, 1.90],
};

const HOUSEHOLD_ITEMS = [
  { id: "light_housework", label: "Light housework (e.g. dusting, washing dishes)" },
  { id: "heavy_housework", label: "Heavy housework (e.g. vacuuming, scrubbing floors)" },
  { id: "home_repairs", label: "Home repairs (e.g. painting, carpentry)" },
  { id: "lawn_garden", label: "Lawn work or gardening" },
  { id: "outdoor_tasks", label: "Outdoor work or yardwork (e.g. mowing, raking, watering)" },
  { id: "caregiving", label: "Caring for another person (e.g. child, elderly)" },
];

const HOUSEHOLD_WEIGHTS = {
  light_housework: 0.25,
  heavy_housework: 0.50,
  home_repairs: 0.50,
  lawn_garden: 0.50,
  outdoor_tasks: 0.50,
  caregiving: 0.35,
};

const WORK_ITEM = {
  id: "work",
  label: "Worked for pay or as a volunteer",
};

const WORK_HOURS = [
  { value: 1, label: "< 10 hrs/week" },
  { value: 2, label: "10–19 hrs/week" },
  { value: 3, label: "20–29 hrs/week" },
  { value: 4, label: "30–39 hrs/week" },
  { value: 5, label: "≥ 40 hrs/week" },
];

const WORK_WEIGHTS = [10, 20, 30, 40, 50]; // approximate composite contribution

function getInterpretation(score) {
  if (score >= 120) return { text: "Very High Physical Activity", color: "text-green-700" };
  if (score >= 75) return { text: "High Physical Activity", color: "text-green-600" };
  if (score >= 40) return { text: "Moderate Physical Activity", color: "text-yellow-600" };
  return { text: "Low Physical Activity", color: "text-red-600" };
}

export default function PhysicalActivityScalefortheElderlyPASERunner({ onSave, onClose }) {
  const [leisureResponses, setLeisureResponses] = useState({}); // { id: hoursValue }
  const [householdResponses, setHouseholdResponses] = useState({}); // { id: boolean }
  const [workDone, setWorkDone] = useState(null); // true/false
  const [workHours, setWorkHours] = useState(null);
  const [workType, setWorkType] = useState(""); // sitting/standing/walking/heavy
  const [notes, setNotes] = useState("");

  const calcScore = () => {
    let score = 0;

    // Leisure
    LEISURE_ITEMS.forEach(item => {
      const hrs = leisureResponses[item.id];
      if (hrs) {
        const weights = LEISURE_WEIGHTS[item.id];
        score += (weights[hrs - 1] || 0) * 100; // scale to PASE units
      }
    });

    // Household (each item = 1 if done, weighted)
    HOUSEHOLD_ITEMS.forEach(item => {
      if (householdResponses[item.id]) {
        score += HOUSEHOLD_WEIGHTS[item.id] * 100;
      }
    });

    // Work
    if (workDone && workHours) {
      score += WORK_WEIGHTS[workHours - 1] || 0;
    }

    return Math.round(score);
  };

  const handleSave = () => {
    const leisureAnswered = LEISURE_ITEMS.every(i => leisureResponses[i.id] !== undefined);
    const householdAnswered = HOUSEHOLD_ITEMS.every(i => householdResponses[i.id] !== undefined);
    if (!leisureAnswered || !householdAnswered || workDone === null) {
      toast.error("Please answer all sections before saving.");
      return;
    }
    if (workDone && !workHours) {
      toast.error("Please select hours worked per week.");
      return;
    }

    const score = calcScore();
    const interp = getInterpretation(score);
    const today = todayLocal();

    const leisureLines = LEISURE_ITEMS.map(item => {
      const hrs = leisureResponses[item.id];
      const label = LEISURE_HOURS.find(h => h.value === hrs)?.label || "Not performed";
      return `    • ${item.label}: ${hrs ? label : "Not performed"}`;
    }).join('\n');

    const householdLines = HOUSEHOLD_ITEMS.map(item => (
      `    • ${item.label}: ${householdResponses[item.id] ? "Yes" : "No"}`
    )).join('\n');

    const workLine = workDone
      ? `    • Work/volunteering: Yes — ${WORK_HOURS.find(h => h.value === workHours)?.label || ''}${workType ? `, type: ${workType}` : ''}`
      : `    • Work/volunteering: No`;

    const soapText = [
      `• Physical Activity Scale for the Elderly (PASE)`,
      `  Total PASE Score: ${score} → ${interp.text}`,
      `  Score Interpretation: <40 Low | 40–74 Moderate | 75–119 High | ≥120 Very High`,
      ``,
      `  Leisure Activities (past week):`,
      leisureLines,
      ``,
      `  Household Activities (past week):`,
      householdLines,
      ``,
      `  Work/Volunteer Activity:`,
      workLine,
      notes ? `\n  Clinical Notes: ${notes}` : null,
      ``,
      `  Reference: Washburn RA, et al. The Physical Activity Scale for the Elderly (PASE). J Clin Epidemiol. 1993;46(2):153-162.`,
    ].filter(line => line !== null).join('\n');

    onSave({
      status: "completed",
      result_value: score,
      additional_data: {
        score,
        interpretation: interp.text,
        leisure_responses: leisureResponses,
        household_responses: householdResponses,
        work_done: workDone,
        work_hours: workHours,
        work_type: workType,
        soap_text: soapText,
      },
      notes,
      assessment_date: today,
    });
  };

  const score = calcScore();
  const interp = getInterpretation(score);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-teal-50 to-emerald-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Physical Activity Scale for the Elderly (PASE)</h2>
              <p className="text-slate-600 mt-1">Self-report physical activity questionnaire for adults ≥65 years</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Info */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="py-4 text-sm text-blue-800 space-y-1">
              <p className="flex items-center gap-2"><Info className="w-4 h-4 flex-shrink-0" /><strong>Protocol:</strong> Ask about typical activities over the PAST 7 DAYS.</p>
              <p className="italic">"I'd like to ask about the physical activities you've done over the past week, including walking, housework, and hobbies. Please answer as accurately as you can."</p>
              <p><strong>Scoring:</strong> Weighted composite. Higher = more active. Population mean ≈ 90–100 for community-dwelling elderly.</p>
            </CardContent>
          </Card>

          {/* Section 1: Leisure */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Section 1: Leisure Activities</CardTitle>
              <p className="text-sm text-slate-500">During the past 7 days, did you participate in any of the following? If yes, how many hours per week on average?</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {LEISURE_ITEMS.map(item => (
                <div key={item.id}>
                  <p className="text-sm font-medium text-slate-800 mb-2">{item.label}</p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <button
                      onClick={() => setLeisureResponses(p => ({ ...p, [item.id]: 0 }))}
                      className={`p-2 rounded border text-xs transition-all ${leisureResponses[item.id] === 0 ? 'border-teal-500 bg-teal-50 font-semibold' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      Not done
                    </button>
                    {LEISURE_HOURS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setLeisureResponses(p => ({ ...p, [item.id]: opt.value }))}
                        className={`p-2 rounded border text-xs transition-all ${leisureResponses[item.id] === opt.value ? 'border-teal-500 bg-teal-50 font-semibold' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Section 2: Household */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Section 2: Household Activities</CardTitle>
              <p className="text-sm text-slate-500">During the past 7 days, did you do any of the following household activities?</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {HOUSEHOLD_ITEMS.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-800">{item.label}</span>
                  <div className="flex gap-2">
                    {["Yes", "No"].map(opt => (
                      <button
                        key={opt}
                        onClick={() => setHouseholdResponses(p => ({ ...p, [item.id]: opt === "Yes" }))}
                        className={`px-4 py-2 rounded border text-xs transition-all ${
                          householdResponses[item.id] === (opt === "Yes")
                            ? 'border-teal-500 bg-teal-50 font-semibold'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Section 3: Work */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Section 3: Work / Volunteer Activity</CardTitle>
              <p className="text-sm text-slate-500">During the past 7 days, did you work for pay or as a volunteer?</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                {["Yes", "No"].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setWorkDone(opt === "Yes")}
                    className={`px-6 py-2 rounded border text-sm transition-all ${workDone === (opt === "Yes") ? 'border-teal-500 bg-teal-50 font-semibold' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {workDone && (
                <>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">How many hours per week?</p>
                    <div className="flex flex-wrap gap-2">
                      {WORK_HOURS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setWorkHours(opt.value)}
                          className={`px-3 py-2 rounded border text-xs transition-all ${workHours === opt.value ? 'border-teal-500 bg-teal-50 font-semibold' : 'border-slate-200 hover:border-slate-300'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">Type of work (optional)</p>
                    <div className="flex flex-wrap gap-2">
                      {["Mostly sitting", "Mostly standing/walking", "Physical labour"].map(opt => (
                        <button
                          key={opt}
                          onClick={() => setWorkType(opt)}
                          className={`px-3 py-2 rounded border text-xs transition-all ${workType === opt ? 'border-teal-500 bg-teal-50 font-semibold' : 'border-slate-200 hover:border-slate-300'}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Score preview */}
          {score > 0 && (
            <Card className="bg-teal-50 border-teal-200">
              <CardContent className="py-4 text-center space-y-1">
                <p className="text-sm text-slate-600">Estimated PASE Score</p>
                <p className="text-4xl font-bold text-slate-900">{score}</p>
                <p className={`text-lg font-semibold ${interp.color}`}>{interp.text}</p>
                <p className="text-xs text-slate-500 mt-1">Population mean ≈ 90–100 for community-dwelling older adults</p>
              </CardContent>
            </Card>
          )}

          {/* Clinical Notes */}
          <Card>
            <CardHeader><CardTitle className="text-base">Clinical Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Observations, barriers, self-report reliability concerns..." />
            </CardContent>
          </Card>

          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="py-3 text-xs text-amber-800">
              <p className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /><strong>Reference:</strong> Washburn RA, Smith KW, Jette AM, Janney CA. The Physical Activity Scale for the Elderly (PASE): development and evaluation. J Clin Epidemiol. 1993;46(2):153-162.</p>
            </CardContent>
          </Card>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-teal-600 hover:bg-teal-700">
            <Save className="w-4 h-4 mr-2" />Save PASE Results
          </Button>
        </div>
      </div>
    </div>
  );
}