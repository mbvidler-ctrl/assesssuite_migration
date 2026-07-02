import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Plus, Trash2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { toast } from "sonner";

const SIMPLE_SCORE_CRITERIA = [
  { score: 5, label: "Perfect clock: correct circle, numbers in correct order and placement, correct time shown" },
  { score: 4, label: "Minor spacing errors but numbers and time correct" },
  { score: 3, label: "Numbers correct but poorly spaced OR hands incorrect" },
  { score: 2, label: "Numbers missing, repeated, or severely misplaced" },
  { score: 1, label: "Very poor representation of a clock" },
  { score: 0, label: "No attempt or not recognizable as a clock" },
];

const TEN_POINT_ITEMS = [
  { key: "closedCircle", label: "Closed circle drawn", points: 1 },
  { key: "allNumbers", label: "All numbers present", points: 1 },
  { key: "numbersOrder", label: "Numbers in correct order", points: 1 },
  { key: "numbersPositioned", label: "Numbers correctly positioned", points: 1 },
  { key: "onlyOneToTwelve", label: "Only numbers 1â€“12 used", points: 1 },
  { key: "twoHands", label: "Two hands drawn", points: 1 },
  { key: "correctTime", label: "Correct time shown", points: 2 },
  { key: "hourMinuteDist", label: "Hour/minute distinction correct", points: 1 },
  { key: "handsCentered", label: "Hands centered correctly", points: 1 },
];

const ABNORMAL_PATTERNS = [
  "Numbers all on one side (visuospatial deficit)",
  "Wrong time but good clock (executive function issue)",
  "Hands reversed or same length (conceptual deficit)",
  "Random numbers or letters (delirium/severe dementia)",
  "Cannot start the task (executive dysfunction)",
];

function getSimpleInterpretation(score) {
  if (score >= 4) return { label: "Normal", color: "bg-green-100 text-green-800" };
  if (score === 3) return { label: "Possible mild impairment", color: "bg-yellow-100 text-yellow-800" };
  return { label: "Likely cognitive impairment", color: "bg-red-100 text-red-800" };
}

function getTenPointInterpretation(score) {
  if (score >= 8) return { label: "Normal", color: "bg-green-100 text-green-800" };
  if (score >= 6) return { label: "Mild impairment", color: "bg-yellow-100 text-yellow-800" };
  return { label: "Moderateâ€“severe impairment", color: "bg-red-100 text-red-800" };
}

function emptyAttempt() {
  return {
    scoringMethod: "simple",
    simpleScore: null,
    tenPointItems: {},
    abnormalPatterns: [],
    notes: "",
  };
}

function AttemptPanel({ attempt, index, onChange, onDelete, canDelete }) {
  const [showInfo, setShowInfo] = useState(index === 0);

  const tenPointScore = TEN_POINT_ITEMS.reduce((sum, item) =>
    attempt.tenPointItems[item.key] ? sum + item.points : sum, 0);

  const simpleInterp = attempt.simpleScore !== null ? getSimpleInterpretation(attempt.simpleScore) : null;
  const tenInterp = getTenPointInterpretation(tenPointScore);

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-800">Attempt {index + 1}</CardTitle>
          {canDelete && (
            <Button variant="ghost" size="icon" onClick={onDelete} className="text-red-500 hover:text-red-700 h-7 w-7">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Scoring method toggle */}
        <div>
          <Label className="text-sm font-medium text-slate-700">Scoring Method</Label>
          <div className="flex gap-2 mt-1">
            <Button
              size="sm"
              variant={attempt.scoringMethod === "simple" ? "default" : "outline"}
              onClick={() => onChange({ ...attempt, scoringMethod: "simple" })}
            >0â€“5 Simple</Button>
            <Button
              size="sm"
              variant={attempt.scoringMethod === "ten" ? "default" : "outline"}
              onClick={() => onChange({ ...attempt, scoringMethod: "ten" })}
            >10-Point Detail</Button>
          </div>
        </div>

        {/* Simple scoring */}
        {attempt.scoringMethod === "simple" && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Select Score (0â€“5)</Label>
            <div className="space-y-2">
              {SIMPLE_SCORE_CRITERIA.map(({ score, label }) => (
                <button
                  key={score}
                  onClick={() => onChange({ ...attempt, simpleScore: score })}
                  className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                    attempt.simpleScore === score
                      ? "bg-blue-50 border-blue-400 text-blue-900 font-medium"
                      : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className="font-bold mr-2">{score}</span>â€” {label}
                </button>
              ))}
            </div>
            {simpleInterp && (
              <div className={`mt-2 inline-flex px-3 py-1 rounded-full text-sm font-semibold ${simpleInterp.color}`}>
                Score {attempt.simpleScore}/5 â€” {simpleInterp.label}
              </div>
            )}
          </div>
        )}

        {/* 10-point scoring */}
        {attempt.scoringMethod === "ten" && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">10-Point Checklist</Label>
            <div className="space-y-2">
              {TEN_POINT_ITEMS.map((item) => (
                <label key={item.key} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!attempt.tenPointItems[item.key]}
                    onChange={() => {
                      const updated = { ...attempt.tenPointItems, [item.key]: !attempt.tenPointItems[item.key] };
                      onChange({ ...attempt, tenPointItems: updated });
                    }}
                    className="w-4 h-4 mt-0.5"
                  />
                  <span className="text-sm text-slate-700 flex-1">{item.label}</span>
                  <span className="text-xs text-slate-500 shrink-0">+{item.points}pt{item.points > 1 ? "s" : ""}</span>
                </label>
              ))}
            </div>
            <div className={`mt-2 inline-flex px-3 py-1 rounded-full text-sm font-semibold ${tenInterp.color}`}>
              Score {tenPointScore}/10 â€” {tenInterp.label}
            </div>
          </div>
        )}

        {/* Abnormal patterns */}
        <div>
          <Label className="text-sm font-medium text-slate-700">Observed Abnormal Patterns</Label>
          <div className="mt-1 space-y-1">
            {ABNORMAL_PATTERNS.map((pattern) => (
              <label key={pattern} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attempt.abnormalPatterns.includes(pattern)}
                  onChange={() => {
                    const current = attempt.abnormalPatterns;
                    const updated = current.includes(pattern)
                      ? current.filter(p => p !== pattern)
                      : [...current, pattern];
                    onChange({ ...attempt, abnormalPatterns: updated });
                  }}
                  className="w-4 h-4 mt-0.5"
                />
                <span className="text-sm text-slate-600">{pattern}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label className="text-sm font-medium text-slate-700">Notes for this attempt</Label>
          <Textarea
            value={attempt.notes}
            onChange={(e) => onChange({ ...attempt, notes: e.target.value })}
            placeholder="Specific observations for this attempt..."
            rows={2}
            className="mt-1 text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ClockDrawingTestRunner({ client, onSave, onClose }) {
  const [attempts, setAttempts] = useState([emptyAttempt()]);
  const [showClinicalInfo, setShowClinicalInfo] = useState(false);
  const [globalNotes, setGlobalNotes] = useState("");

  const updateAttempt = (index, updated) => {
    setAttempts(prev => prev.map((a, i) => i === index ? updated : a));
  };

  const deleteAttempt = (index) => {
    setAttempts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const attemptSummaries = attempts.map((attempt, i) => {
      const tenScore = TEN_POINT_ITEMS.reduce((sum, item) =>
        attempt.tenPointItems[item.key] ? sum + item.points : sum, 0);
      const score = attempt.scoringMethod === "simple" ? attempt.simpleScore : tenScore;
      const maxScore = attempt.scoringMethod === "simple" ? 5 : 10;

      let text = `  Attempt ${i + 1} (${attempt.scoringMethod === "simple" ? "0â€“5 method" : "10-point method"}): ${score !== null ? score : "â€”"}/${maxScore}`;
      if (attempt.abnormalPatterns.length > 0) {
        text += `\n    Patterns: ${attempt.abnormalPatterns.join("; ")}`;
      }
      if (attempt.notes) text += `\n    Notes: ${attempt.notes}`;
      return text;
    });

    const soapText = `â€¢ Clock Drawing Test (instruction: "Draw a clock showing 10 past 11"):\n${attemptSummaries.join("\n")}${globalNotes ? `\n\n  General Notes: ${globalNotes}` : ""}`;

    // Use score from last attempt for result_value
    const last = attempts[attempts.length - 1];
    const lastTenScore = TEN_POINT_ITEMS.reduce((sum, item) =>
      last.tenPointItems[item.key] ? sum + item.points : sum, 0);
    const resultValue = last.scoringMethod === "simple" ? (last.simpleScore ?? 0) : lastTenScore;

    onSave({
      result_value: resultValue,
      additional_data: {
        soap_text: soapText,
        attempts,
      },
      notes: globalNotes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Assessment saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-indigo-50 shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Clock Drawing Test (CDT)</h2>
              <p className="text-slate-600 mt-1 text-sm">Instruction to patient: <em>"Draw a clock, put in all the numbers, and set the hands to 10 past 11."</em></p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Clinical Info Accordion */}
          <div className="border border-indigo-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowClinicalInfo(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 text-indigo-900 font-semibold text-sm hover:bg-indigo-100 transition-colors"
            >
              <span className="flex items-center gap-2"><Info className="w-4 h-4" /> Clinical Reference & Scoring Guide</span>
              {showClinicalInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showClinicalInfo && (
              <div className="p-4 bg-white space-y-4 text-sm text-slate-700">
                <p>The CDT screens for <strong>cognitive impairment, executive function, visuospatial ability, and planning</strong>. Relevant for Alzheimer's disease, vascular dementia, delirium, and post-stroke cognitive impairment.</p>
                <p>It assesses multiple brain areas: <strong>frontal lobe</strong> (planning/executive), <strong>parietal lobe</strong> (spatial awareness), <strong>temporal lobe</strong> (memory), and motor planning.</p>

                <div>
                  <p className="font-semibold text-slate-800 mb-1">Simple 0â€“5 Interpretation</p>
                  <div className="space-y-1">
                    <div className="flex gap-2 items-center"><Badge className="bg-green-100 text-green-800">4â€“5</Badge><span>Normal</span></div>
                    <div className="flex gap-2 items-center"><Badge className="bg-yellow-100 text-yellow-800">3</Badge><span>Possible mild impairment</span></div>
                    <div className="flex gap-2 items-center"><Badge className="bg-red-100 text-red-800">0â€“2</Badge><span>Likely cognitive impairment</span></div>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-1">10-Point Interpretation</p>
                  <div className="space-y-1">
                    <div className="flex gap-2 items-center"><Badge className="bg-green-100 text-green-800">8â€“10</Badge><span>Normal</span></div>
                    <div className="flex gap-2 items-center"><Badge className="bg-yellow-100 text-yellow-800">6â€“7</Badge><span>Mild impairment</span></div>
                    <div className="flex gap-2 items-center"><Badge className="bg-red-100 text-red-800">â‰¤5</Badge><span>Moderateâ€“severe impairment</span></div>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-1">Clinical Observation Tips</p>
                  <p className="text-xs text-slate-500 mb-1">How the patient approaches the task is often more informative than the score:</p>
                  <ul className="list-disc pl-4 space-y-1 text-xs">
                    <li><strong>Numbers all on one side</strong> â†’ visuospatial deficit</li>
                    <li><strong>Wrong time but good clock</strong> â†’ executive function issue</li>
                    <li><strong>Hands reversed or same length</strong> â†’ conceptual deficit</li>
                    <li><strong>Random numbers or letters</strong> â†’ delirium or severe dementia</li>
                    <li><strong>Cannot start the task</strong> â†’ executive dysfunction</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Attempts */}
          {attempts.map((attempt, index) => (
            <AttemptPanel
              key={index}
              attempt={attempt}
              index={index}
              onChange={(updated) => updateAttempt(index, updated)}
              onDelete={() => deleteAttempt(index)}
              canDelete={attempts.length > 1}
            />
          ))}

          <Button
            variant="outline"
            onClick={() => setAttempts(prev => [...prev, emptyAttempt()])}
            className="w-full border-dashed"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Another Attempt
          </Button>

          {/* Global notes */}
          <div>
            <Label className="text-sm font-medium text-slate-700">General Clinical Notes</Label>
            <Textarea
              value={globalNotes}
              onChange={(e) => setGlobalNotes(e.target.value)}
              placeholder="Overall clinical impression, context, follow-up plan..."
              rows={3}
              className="mt-1 text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" /> Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}