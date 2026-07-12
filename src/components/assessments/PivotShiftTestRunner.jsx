import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, ChevronDown, ChevronUp, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const GRADES = [
  {
    value: 0,
    label: "Grade 0 — Negative",
    description: "No tibial movement. Normal ACL integrity (or patient guarding).",
    color: "bg-green-100 border-green-400 text-green-900",
    selectedColor: "bg-green-500 text-white border-green-500",
  },
  {
    value: 1,
    label: "Grade 1 — Glide",
    description: "Subtle anterior tibial glide. Possible partial ACL tear or lateral capsular laxity.",
    color: "bg-yellow-50 border-yellow-400 text-yellow-900",
    selectedColor: "bg-yellow-500 text-white border-yellow-500",
  },
  {
    value: 2,
    label: "Grade 2 — Clunk",
    description: "Palpable clunk as tibia reduces at ~20–30° flexion. Significant ACL deficiency.",
    color: "bg-orange-50 border-orange-400 text-orange-900",
    selectedColor: "bg-orange-500 text-white border-orange-500",
  },
  {
    value: 3,
    label: "Grade 3 — Locking",
    description: "Tibial subluxation momentarily locks before reducing. Severe ACL damage.",
    color: "bg-red-50 border-red-400 text-red-900",
    selectedColor: "bg-red-500 text-white border-red-500",
  },
];

export default function PivotShiftTestRunner({ client, onSave, onClose }) {
  const [leftGrade, setLeftGrade] = useState(null);
  const [rightGrade, setRightGrade] = useState(null);
  const [notes, setNotes] = useState("");
  const [showClinicianInfo, setShowClinicianInfo] = useState(false);

  const canSave = leftGrade !== null && rightGrade !== null;

  const handleSave = () => {
    if (!canSave) {
      toast.error("Please grade both left and right sides before saving.");
      return;
    }
    const worstGrade = Math.max(leftGrade, rightGrade);
    const gradeLabel = GRADES[worstGrade].label;
    const soapText = `• Pivot Shift Test\n  Left: ${GRADES[leftGrade].label}\n  Right: ${GRADES[rightGrade].label}\n  Overall: ${gradeLabel}`;

    onSave({
      status: "completed",
      result_value: worstGrade,
      notes,
      assessment_date: todayLocal(),
      additional_data: {
        soap_text: soapText,
        measurement_type: "pivot_shift_test",
        left_grade: leftGrade,
        right_grade: rightGrade,
      },
    });
    toast.success("Pivot Shift Test results saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-50 to-blue-50 border-b px-6 py-4 flex justify-between items-start z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Pivot Shift Test</h2>
            <p className="text-sm text-slate-600 mt-0.5">Dynamic ACL instability assessment</p>
            {client?.full_name && (
              <p className="text-sm font-semibold text-indigo-700 mt-1">Client: {client.full_name}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Caution banner */}
          <div className="flex gap-2 bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
            <p><strong>CAUTION:</strong> A positive Pivot Shift strongly suggests ACL rupture. Perform alongside Lachman and Anterior Drawer tests. Refer for MRI and orthopaedic review if positive.</p>
          </div>

          {/* Clinician Instructions */}
          <button
            onClick={() => setShowClinicianInfo(!showClinicianInfo)}
            className="w-full flex justify-between items-center px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-lg font-semibold text-indigo-900 text-sm hover:bg-indigo-100 transition-colors"
          >
            <span className="flex items-center gap-2">📋 Clinician Instructions & Administration Guide</span>
            {showClinicianInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showClinicianInfo && (
            <Card className="bg-indigo-50 border-indigo-200">
              <CardContent className="pt-4 space-y-4 text-sm">
                <div>
                  <p className="font-semibold text-indigo-900 mb-1">Purpose</p>
                  <p className="text-indigo-800 text-xs">Most specific clinical test for ACL insufficiency. Assesses dynamic tibial subluxation/reduction during knee motion. Sensitivity 24–98%, Specificity 95–99% (varies with examiner experience and patient relaxation).</p>
                </div>

                <div>
                  <p className="font-semibold text-indigo-900 mb-1">Patient Position</p>
                  <ul className="text-indigo-800 text-xs list-disc list-inside space-y-1">
                    <li>Supine on a firm treatment table, fully relaxed</li>
                    <li>Hip flexed to <strong>20°</strong> with slight abduction</li>
                    <li>Knee starting in near-full extension (0–10°)</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-indigo-900 mb-1">Step-by-Step Technique</p>
                  <ol className="text-indigo-800 text-xs list-decimal list-inside space-y-1">
                    <li>One hand on distal femur, other grasps proximal tibia</li>
                    <li>Internally rotate tibia 15–30° with knee near-full extension</li>
                    <li>Apply gentle <strong>valgus stress</strong> (knee opening outward)</li>
                    <li>Slowly flex knee while maintaining valgus + internal rotation</li>
                    <li>At 20–30°: feel/observe for tibial subluxation or "clunk" (positive)</li>
                    <li>Slowly return to extension; repeat 3–5 trials</li>
                    <li>Always test unaffected side first for comparison</li>
                  </ol>
                </div>

                <div>
                  <p className="font-semibold text-indigo-900 mb-1">Key Tips</p>
                  <div className="bg-white p-3 rounded border border-indigo-200 space-y-1 text-xs text-indigo-800">
                    <p><strong>Patient relaxation is critical</strong> — hamstring/quad guarding masks the test. Speak calmly; move slowly.</p>
                    <p><strong>Hip at 20° (not 45°)</strong> — higher angles reduce sensitivity.</p>
                    <p><strong>Internal rotation ≤15°</strong> — excessive rotation causes false positives in normal knees.</p>
                    <p><strong>Bilateral comparison</strong> — always grade both sides.</p>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-indigo-900 mb-1">References</p>
                  <div className="bg-white p-3 rounded border border-indigo-200 space-y-1 text-xs text-indigo-700">
                    <p>Höher J, et al. (2001). <em>AJSM 29</em>(2): 199–207. [Sensitivity 24–98%, Specificity 95–99%]</p>
                    <p>Martinez-Cano DJ, et al. (2023). <em>Orthopaedic J Sports Med 11</em>(8).</p>
                    <p>AAOS ACL Management Guidelines (2014).</p>
                    <a href="https://www.youtube.com/watch?v=2TPfLOcxbTI" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-semibold">
                      <ExternalLink className="w-3 h-3" /> Watch: Pivot Shift Technique (YouTube)
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Technique diagram (text-based, no broken image) */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Test Technique — Position Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded border border-slate-200 p-3">
                    <p className="font-semibold text-slate-800 mb-1">Starting position</p>
                    <p>Supine · Hip 20° flexion · Knee ~0–10° (near full extension) · Tibia internally rotated 15–30°</p>
                  </div>
                  <div className="bg-white rounded border border-slate-200 p-3">
                    <p className="font-semibold text-slate-800 mb-1">Clinician hands</p>
                    <p>Proximal hand: distal femur · Distal hand: proximal tibia behind tuberosity · Apply valgus stress</p>
                  </div>
                  <div className="bg-white rounded border border-slate-200 p-3">
                    <p className="font-semibold text-slate-800 mb-1">Movement</p>
                    <p>Slowly flex knee maintaining valgus + internal rotation · Watch for shift/clunk at 20–30° flexion</p>
                  </div>
                  <div className="bg-white rounded border border-slate-200 p-3">
                    <p className="font-semibold text-slate-800 mb-1">Positive finding</p>
                    <p>Palpable/visible tibial subluxation (glide, clunk, or momentary lock) as knee is flexed past 20–30°</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* LEFT side grading */}
          <Card className="border-indigo-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Left Knee — Grade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {GRADES.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setLeftGrade(g.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                    leftGrade === g.value ? g.selectedColor : `${g.color} hover:opacity-80`
                  }`}
                >
                  <p className="font-semibold text-sm">{g.label}</p>
                  <p className={`text-xs mt-0.5 ${leftGrade === g.value ? "text-white/90" : ""}`}>{g.description}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* RIGHT side grading */}
          <Card className="border-indigo-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Right Knee — Grade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {GRADES.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setRightGrade(g.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                    rightGrade === g.value ? g.selectedColor : `${g.color} hover:opacity-80`
                  }`}
                >
                  <p className="font-semibold text-sm">{g.label}</p>
                  <p className={`text-xs mt-0.5 ${rightGrade === g.value ? "text-white/90" : ""}`}>{g.description}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Summary */}
          {canSave && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4 space-y-2">
                <p className="font-semibold text-blue-900 text-sm">Result Summary</p>
                <div className="flex gap-3 text-sm">
                  <Badge className="bg-indigo-100 text-indigo-800">Left: {GRADES[leftGrade].label}</Badge>
                  <Badge className="bg-indigo-100 text-indigo-800">Right: {GRADES[rightGrade].label}</Badge>
                </div>
                {(leftGrade > 0 || rightGrade > 0) && (
                  <p className="text-xs text-red-700 font-semibold">⚠ Positive finding — orthopaedic referral and MRI recommended.</p>
                )}
                {leftGrade === 0 && rightGrade === 0 && (
                  <p className="text-xs text-green-700 font-semibold">✅ Negative bilaterally — no dynamic ACL instability detected.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <div>
            <Label className="text-sm font-semibold text-slate-700">Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Patient relaxation, side of complaint, compensation patterns, associated tests performed..."
              rows={3}
              className="mt-1"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="border-t bg-slate-50 px-6 py-4 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}><X className="h-4 w-4 mr-2" />Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave} className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="h-4 w-4 mr-2" />Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}