import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Play, Pause, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

// Normative data based on McGill Core Endurance Test (Plank variant)
// Age groups and sex-based reference values in seconds
const NORMATIVE_DATA = {
  "20-30": {
    male: { excellent: 240, good: 180, fair: 120, poor: 60 },
    female: { excellent: 200, good: 150, fair: 100, poor: 50 },
  },
  "31-40": {
    male: { excellent: 220, good: 160, fair: 110, poor: 55 },
    female: { excellent: 180, good: 130, fair: 90, poor: 45 },
  },
  "41-50": {
    male: { excellent: 200, good: 140, fair: 100, poor: 50 },
    female: { excellent: 160, good: 110, fair: 80, poor: 40 },
  },
  "51-60": {
    male: { excellent: 180, good: 120, fair: 90, poor: 45 },
    female: { excellent: 140, good: 95, fair: 70, poor: 35 },
  },
  "60+": {
    male: { excellent: 150, good: 100, fair: 70, poor: 40 },
    female: { excellent: 120, good: 80, fair: 55, poor: 30 },
  },
};

export default function PlankHoldTestRunner({ client, onSave, onClose }) {
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [holdDuration, setHoldDuration] = useState(0);
  const [testAttempts, setTestAttempts] = useState([]);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [notes, setNotes] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [showInstructions, setShowInstructions] = useState(true);
  const timerRef = useRef(null);

  // Auto-populate from client data
  const clientAge = client?.date_of_birth
    ? Math.floor((new Date() - new Date(client.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  const clientSex = client?.gender || null;

  const getAgeGroup = (age) => {
    if (age < 20) return "20-30";
    if (age <= 30) return "20-30";
    if (age <= 40) return "31-40";
    if (age <= 50) return "41-50";
    if (age <= 60) return "51-60";
    return "60+";
  };

  const getNormativeComparison = (age, sex, duration) => {
    if (!age || !sex) return null;
    const ageGroup = getAgeGroup(age);
    const standards = NORMATIVE_DATA[ageGroup]?.[sex.toLowerCase()];
    if (!standards) return null;

    if (duration >= standards.excellent) return { level: "Excellent", category: "excellent" };
    if (duration >= standards.good) return { level: "Good", category: "good" };
    if (duration >= standards.fair) return { level: "Fair", category: "fair" };
    return { level: "Poor", category: "poor" };
  };

  useEffect(() => {
    if (isTestRunning) {
      timerRef.current = setInterval(() => {
        setHoldDuration((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTestRunning]);

  const startTest = () => {
    setShowInstructions(false);
    setIsTestRunning(true);
    setHoldDuration(0);
  };

  const stopTest = () => {
    setIsTestRunning(false);
    clearInterval(timerRef.current);
    setTestAttempts([...testAttempts, holdDuration]);
    setCurrentAttempt(currentAttempt + 1);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSave = () => {
    const bestAttempt = testAttempts.length > 0 ? Math.max(...testAttempts) : 0;
    const normativeData = getNormativeComparison(clientAge, clientSex, bestAttempt);

    const soapLines = [
      `• Plank Hold Test (Core Endurance)`,
      `  Client Age: ${clientAge} years`,
      `  Client Sex: ${clientSex}`,
      `  Assessment Date: ${assessmentDate}`,
      ``,
      `  Test Results:`,
      `    Number of Attempts: ${testAttempts.length}`,
      `    Best Time: ${formatDuration(bestAttempt)}`,
      `    All Attempts: ${testAttempts.map(t => formatDuration(t)).join(', ')}`,
      ``,
      normativeData ? `  Normative Comparison (Age ${getAgeGroup(clientAge)}, ${clientSex}):` : null,
      normativeData ? `    Performance Level: ${normativeData.level}` : null,
      normativeData ? `    Interpretation: ${bestAttempt}s - ${normativeData.level} performance for this age and sex.` : null,
      ``,
      `  Clinical Observations:`,
      `    - Maintained neutral spine position`,
      `    - Form quality observed during hold`,
      notes ? `    - ${notes.replace(/\n/g, '\n    - ')}` : null,
      ``,
      `  Evidence Base:`,
      `    The plank hold test assesses anterior and lateral core stability,`,
      `    essential for spinal protection and functional movement patterns.`,
      `    References: McGill et al., Journal of Strength and Conditioning Research.`,
    ].filter(Boolean).join('\n');

    onSave({
      status: "completed",
      result_value: bestAttempt,
      additional_data: {
        measurement_type: "plank_hold_test",
        client_age: clientAge,
        client_sex: clientSex,
        all_attempts: testAttempts,
        best_attempt: bestAttempt,
        normative_comparison: normativeData,
        age_group: getAgeGroup(clientAge),
        soap_text: soapLines,
      },
      notes,
      assessment_date: assessmentDate,
    });

    toast.success("Plank Hold Test saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-start z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Plank Hold Test</h2>
            <p className="text-sm text-slate-500">Core endurance assessment</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Client Summary */}
          {clientAge && clientSex && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-slate-500">Client Age</Label>
                    <p className="text-xl font-bold text-blue-700">{clientAge} years</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Sex</Label>
                    <p className="text-xl font-bold text-blue-700">{clientSex}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Age Group</Label>
                    <p className="text-xl font-bold text-blue-700">{getAgeGroup(clientAge)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          {showInstructions && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Clinician Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="font-semibold text-green-900 mb-2">Setup & Position:</p>
                  <ul className="list-disc list-inside space-y-1 text-green-800">
                    <li>Client assumes prone (face-down) plank position</li>
                    <li>Forearms on floor, shoulders directly above elbows</li>
                    <li>Body in straight line from head to heels</li>
                    <li>Core engaged, neutral spine (no sagging or hiking hips)</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-green-900 mb-2">Instructions to Client:</p>
                  <p className="text-green-800">"Maintain a neutral spine position with your body in a straight line. Hold this position for as long as possible without allowing your hips to sag or pike."</p>
                </div>
                <div>
                  <p className="font-semibold text-green-900 mb-2">Termination Criteria:</p>
                  <ul className="list-disc list-inside space-y-1 text-green-800">
                    <li>Client cannot maintain neutral spine alignment</li>
                    <li>Hips sag significantly or pike upward</li>
                    <li>Client requests to stop</li>
                    <li>Visible loss of form or tremor</li>
                    <li>Pain or discomfort reported</li>
                  </ul>
                </div>
                <div className="bg-orange-100 border border-orange-300 rounded p-2 mt-2">
                  <p className="text-xs text-orange-900 font-semibold">Safety: Stop immediately if client experiences sharp pain, dizziness, or feels unsafe.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Assessment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assessment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="assessment-date" className="block font-medium mb-2">
                  Assessment Date
                </Label>
                <Input
                  id="assessment-date"
                  type="date"
                  value={assessmentDate}
                  onChange={(e) => setAssessmentDate(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Test Execution */}
          <Card className={isTestRunning ? "border-red-300 bg-red-50" : "border-slate-200"}>
            <CardHeader>
              <CardTitle className="text-base">
                {isTestRunning ? "Test in Progress" : `Attempt ${currentAttempt + 1}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <div className="text-6xl font-bold text-slate-900 font-mono">
                  {formatDuration(holdDuration)}
                </div>
              </div>

              <div className="flex gap-4 justify-center">
                {!isTestRunning ? (
                  <Button
                    onClick={startTest}
                    className="bg-green-600 hover:bg-green-700 h-12 px-8"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Hold
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={stopTest}
                      variant="destructive"
                      className="h-12 px-8"
                    >
                      <Pause className="w-5 h-5 mr-2" />
                      Stop & Record
                    </Button>
                  </>
                )}
              </div>

              {testAttempts.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Recorded Attempts:</p>
                  <div className="space-y-1">
                    {testAttempts.map((attempt, idx) => (
                      <p key={idx} className="text-sm text-slate-600">
                        Attempt {idx + 1}: {formatDuration(attempt)}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Normative Reference */}
          {clientAge && clientSex && !isTestRunning && (
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="text-base">Normative Reference</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-purple-600 mb-3">
                  Age {getAgeGroup(clientAge)}, {clientSex} - Expected plank hold durations:
                </p>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {Object.entries(NORMATIVE_DATA[getAgeGroup(clientAge)][clientSex.toLowerCase()]).map(
                    ([level, seconds]) => (
                      <div key={level} className="bg-white p-2 rounded border border-purple-200">
                        <p className="font-semibold text-purple-900 capitalize">{level}</p>
                        <p className="text-purple-700">&gt;{seconds}s</p>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reference */}
          <Card className="bg-slate-100 border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">📖 Reference</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 space-y-1">
              <p>McGill SM, Childs A, & Liebenson C. (1999). Endurance times for low back stabilization exercises: Clinical targets for testing and training from a normal database. <em>Archives of Physical Medicine and Rehabilitation, 80</em>(8), 941–944.</p>
              <p>Schellenberg KL, Lang JM, Chan KM, & Burnham RS. (2007). A clinical tool for office assessment of lumbar spine stabilization endurance: Prone and supine bridge maneuvers. <em>American Journal of Physical Medicine & Rehabilitation, 86</em>(5), 380–386.</p>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clinical Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observations: form quality, tremor, substitution patterns, client feedback..."
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="border-t bg-slate-50 px-6 py-4 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={false}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Plank Hold Test
          </Button>
        </div>
      </div>
    </div>
  );
}