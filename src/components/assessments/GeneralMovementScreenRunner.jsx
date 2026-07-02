import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";

const GMS_TESTS = [
  { key: "squat",            label: "Deep Squat",                  description: "Stand with feet shoulder-width apart, arms overhead. Squat as deep as possible while maintaining upright torso." },
  { key: "hip_hinge",        label: "Hip Hinge",                   description: "Stand with feet hip-width apart, light dowel behind head. Hinge forward from hips, keeping back neutral and soft knees." },
  { key: "lunge",            label: "Step & Lunge (L & R)",        description: "Step forward into a lunge, lower back knee toward floor. Assess both sides and score the worse side." },
  { key: "single_leg_stand", label: "Single Leg Stand (L & R)",    description: "Stand on one leg for 10 seconds with hands on hips. Assess both sides and score the worse side." },
  { key: "push_up",          label: "Push-Up",                     description: "Perform a push-up from toes (or knees if modified). Assess trunk control and shoulder stability." },
  { key: "shoulder_mob",     label: "Shoulder Mobility (L & R)",   description: "Reach one hand over shoulder, other behind back. Observe range and symmetry. Score the worse side." },
  { key: "trunk_rotation",   label: "Trunk Rotation (L & R)",      description: "Seated or standing, rotate torso fully to each side. Score the worse side." },
  { key: "hip_mob",          label: "Hip Mobility / 4-Point Rock",  description: "In 4-point kneeling, rock hips back toward heels then forward. Observe hip and lumbar control." },
  { key: "overhead_reach",   label: "Overhead Reach / Wall Angel",  description: "Stand with back against wall, arms at 90Â°/90Â°. Raise arms overhead while maintaining contact with wall." },
];

const SCORE_OPTIONS = [
  { value: 0, label: "0 â€“ Pain / Unsafe" },
  { value: 1, label: "1 â€“ Cannot Complete" },
  { value: 2, label: "2 â€“ Minor Compensation" },
  { value: 3, label: "3 â€“ Clean Pattern" },
];

const scoreColor = (v) => {
  if (v === undefined) return "";
  if (v === 0) return "bg-red-600 text-white hover:bg-red-700";
  if (v === 1) return "bg-orange-500 text-white hover:bg-orange-600";
  if (v === 2) return "bg-yellow-500 text-white hover:bg-yellow-600";
  return "bg-green-600 text-white hover:bg-green-700";
};

export default function GeneralMovementScreenRunner({ client, onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [showInstructions, setShowInstructions] = useState(false);

  const handleScoreChange = (key, value) => {
    setScores(prev => ({ ...prev, [key]: value }));
  };

  const totalScore = Object.values(scores).reduce((acc, v) => acc + v, 0);
  const maxScore = GMS_TESTS.length * 3;
  const answeredCount = Object.keys(scores).length;

  const handleSave = () => {
    if (answeredCount < GMS_TESTS.length) {
      toast.error(`Please score all ${GMS_TESTS.length} movement tests before saving.`);
      return;
    }

    const painTests = GMS_TESTS.filter(t => scores[t.key] === 0).map(t => t.label);
    const asymmetryTests = GMS_TESTS
      .filter(t => t.label.includes("L & R"))
      .map(t => t.label); // note: scoring already captures worst side

    const scoreLines = GMS_TESTS.map(t =>
      `  ${t.label}: ${scores[t.key]}/3`
    ).join('\n');

    const soapText = `General Movement Screen:\n\nTotal Score: ${totalScore}/${maxScore}\n${scoreLines}${painTests.length > 0 ? `\n  âš  Pain provoked: ${painTests.join(', ')}` : ''}${notes ? `\n  Notes: ${notes}` : ''}`;

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        measurement_type: "GeneralMovementScreen",
        soap_text: soapText,
        scores,
        pain_tests: painTests,
      },
      notes,
      assessment_date: assessmentDate,
    });

    toast.success("Assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto my-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full my-8 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-teal-50 to-blue-50 rounded-t-xl">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">General Movement Screen</h2>
              <p className="text-slate-600 mt-1">Score each movement pattern 0â€“3</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Date */}
          <div>
            <Label htmlFor="assessmentDate">Assessment Date</Label>
            <Input
              id="assessmentDate"
              type="date"
              value={assessmentDate}
              onChange={(e) => setAssessmentDate(e.target.value)}
              className="mt-1 max-w-xs"
            />
          </div>

          {/* Scoring key */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-red-100 text-red-800 font-medium">0 â€“ Pain / Unsafe</span>
            <span className="px-2 py-1 rounded bg-orange-100 text-orange-800 font-medium">1 â€“ Cannot Complete</span>
            <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 font-medium">2 â€“ Minor Compensation</span>
            <span className="px-2 py-1 rounded bg-green-100 text-green-800 font-medium">3 â€“ Clean Pattern</span>
          </div>

          {/* Tests */}
          <div className="space-y-3">
            {GMS_TESTS.map((test) => (
              <Card key={test.key} className={scores[test.key] !== undefined ? "border-teal-200" : "border-slate-200"}>
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm">{test.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{test.description}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {[0, 1, 2, 3].map((value) => (
                        <Button
                          key={value}
                          size="sm"
                          className={`w-10 h-10 text-sm font-bold ${scores[test.key] === value ? scoreColor(value) : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"}`}
                          onClick={() => handleScoreChange(test.key, value)}
                        >
                          {value}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Running score */}
          {answeredCount > 0 && (
            <div className="bg-slate-50 rounded-lg p-4 border text-center">
              <p className="text-sm text-slate-600">Score so far</p>
              <p className="text-3xl font-bold text-slate-900">{totalScore} / {answeredCount * 3}</p>
              <p className="text-xs text-slate-500">{answeredCount} of {GMS_TESTS.length} tests scored</p>
              {scores && Object.values(scores).some(v => v === 0) && (
                <p className="text-xs text-red-600 mt-1 font-medium">âš  Pain provoked in one or more tests â€” consider further assessment</p>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Clinical Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Document asymmetries, pain behaviour, cues given, clinical impressions..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 rounded-b-xl flex justify-between items-center">
          <p className="text-sm text-slate-600">{answeredCount} / {GMS_TESTS.length} tests scored</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={answeredCount < GMS_TESTS.length}
              className="bg-teal-600 hover:bg-teal-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}