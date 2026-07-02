import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

const PROBLEM_LIST = {
  "Practical Problems": [
    "Child care", "Housing", "Insurance/financial", "Transportation", "Work/school"
  ],
  "Family Problems": [
    "Dealing with children", "Dealing with partner", "Ability to have children", "Family health issues"
  ],
  "Emotional Problems": [
    "Depression", "Fears", "Nervousness", "Sadness", "Worry", "Loss of interest in usual activities"
  ],
  "Spiritual/Religious Concerns": [
    "Relating to God", "Loss of faith", "Spiritual/religious concerns"
  ],
  "Physical Problems": [
    "Appearance", "Bathing/dressing", "Breathing", "Changes in urination", "Constipation",
    "Diarrhoea", "Eating", "Fatigue", "Feeling swollen", "Fevers", "Getting around",
    "Indigestion", "Memory/concentration", "Mouth sores", "Nausea", "Nose dry/congested",
    "Pain", "Sexual", "Skin dry/itchy", "Sleep", "Tingling in hands/feet"
  ]
};

function getInterpretation(score) {
  if (score <= 3) return { label: "Mild / No clinical concern", color: "text-green-700", bg: "bg-green-50 border-green-200", flag: false };
  if (score <= 6) return { label: "Moderate distress â€” consider follow-up", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", flag: true };
  return { label: "Severe distress â€” further assessment recommended", color: "text-red-700", bg: "bg-red-50 border-red-200", flag: true };
}

export default function DistressThermometerRunner({ client, onSave, onClose }) {
  const [score, setScore] = useState(null);
  const [checkedProblems, setCheckedProblems] = useState({});
  const [notes, setNotes] = useState("");

  const toggleProblem = (problem) => {
    setCheckedProblems(prev => ({ ...prev, [problem]: !prev[problem] }));
  };

  const selectedProblems = Object.entries(checkedProblems).filter(([, v]) => v).map(([k]) => k);

  const handleSave = () => {
    if (score === null) {
      toast.error("Please select a distress score (0â€“10).");
      return;
    }

    const interp = getInterpretation(score);

    const problemsByCategory = Object.entries(PROBLEM_LIST).reduce((acc, [cat, items]) => {
      const checked = items.filter(i => checkedProblems[i]);
      if (checked.length > 0) acc[cat] = checked;
      return acc;
    }, {});

    let soapText = `â€¢ Distress Thermometer (NCCN):\n`;
    soapText += `  Score: ${score}/10 â€” ${interp.label}\n`;
    if (selectedProblems.length > 0) {
      soapText += `  Reported problems:\n`;
      Object.entries(problemsByCategory).forEach(([cat, items]) => {
        soapText += `    ${cat}: ${items.join(", ")}\n`;
      });
    } else {
      soapText += `  No specific problems endorsed.\n`;
    }

    onSave({
      status: "completed",
      result_value: score,
      additional_data: {
        measurement_type: "distress_thermometer",
        score,
        interpretation: interp.label,
        flagged: interp.flag,
        problems_by_category: problemsByCategory,
        selected_problems: selectedProblems,
        soap_text: soapText,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Distress Thermometer saved.");
  };

  const interp = score !== null ? getInterpretation(score) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-xl font-bold text-slate-900">Distress Thermometer (NCCN)</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="p-5 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm space-y-1">
            <p className="font-semibold text-blue-800">Clinician Instructions</p>
            <p className="text-slate-700">Ask the client: <em>"Please circle the number (0â€“10) that best describes how much distress you have been experiencing in the past week, including today."</em></p>
            <p className="text-slate-700">0 = No distress &nbsp;|&nbsp; 10 = Extreme distress</p>
            <p className="text-slate-700 font-medium">Clinical cut-off: â‰¥4 indicates significant distress warranting further assessment.</p>
          </div>

          {/* Visual thermometer scale */}
          <div>
            <Label className="text-sm font-semibold mb-3 block">Select Distress Level (0â€“10):</Label>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 11 }, (_, i) => {
                const color =
                  i <= 3 ? "bg-green-100 border-green-400 hover:bg-green-200" :
                  i <= 6 ? "bg-yellow-100 border-yellow-400 hover:bg-yellow-200" :
                           "bg-red-100 border-red-400 hover:bg-red-200";
                const selected =
                  i <= 3 ? "bg-green-500 text-white border-green-600" :
                  i <= 6 ? "bg-yellow-500 text-white border-yellow-600" :
                           "bg-red-500 text-white border-red-600";
                const isSelected = score === i;
                return (
                  <button
                    key={i}
                    onClick={() => setScore(i)}
                    className={`w-12 h-12 rounded-lg border-2 font-bold text-lg transition-all ${isSelected ? selected : color}`}
                  >
                    {i}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1 px-1">
              <span>No distress</span>
              <span>Extreme distress</span>
            </div>
          </div>

          {/* Score interpretation */}
          {interp && (
            <div className={`rounded-lg border p-3 ${interp.bg}`}>
              <p className={`font-semibold ${interp.color}`}>Score {score}/10 â€” {interp.label}</p>
            </div>
          )}

          {/* Problem list */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Problem List (tick all that apply):</Label>
            <div className="space-y-3">
              {Object.entries(PROBLEM_LIST).map(([category, problems]) => (
                <div key={category}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{category}</p>
                  <div className="flex flex-wrap gap-2">
                    {problems.map(problem => (
                      <button
                        key={problem}
                        onClick={() => toggleProblem(problem)}
                        className={`px-3 py-1 rounded-full text-sm border transition-all ${
                          checkedProblems[problem]
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {problem}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-semibold mb-1 block">Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional observations, referrals made, follow-up plan..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}><X className="mr-2 w-4 h-4" />Cancel</Button>
            <Button onClick={handleSave}><Save className="mr-2 w-4 h-4" />Save to SOAP</Button>
          </div>
        </div>
      </div>
    </div>
  );
}