import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Play, Pause, AlertTriangle, Info, ExternalLink, BookOpen, Video } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// Normative data by age group and sex (number of pegs in 30 seconds)
const NORMATIVE_DATA = {
  "20-29": {
    male: { rightHand: 19.5, leftHand: 17.8, bothHands: 14.2, assembly: 8.5 },
    female: { rightHand: 18.2, leftHand: 16.9, bothHands: 13.5, assembly: 7.8 },
  },
  "30-39": {
    male: { rightHand: 19.2, leftHand: 17.5, bothHands: 14.0, assembly: 8.2 },
    female: { rightHand: 17.9, leftHand: 16.6, bothHands: 13.2, assembly: 7.5 },
  },
  "40-49": {
    male: { rightHand: 18.8, leftHand: 17.2, bothHands: 13.7, assembly: 8.0 },
    female: { rightHand: 17.5, leftHand: 16.2, bothHands: 12.8, assembly: 7.2 },
  },
  "50-59": {
    male: { rightHand: 18.2, leftHand: 16.8, bothHands: 13.2, assembly: 7.6 },
    female: { rightHand: 16.9, leftHand: 15.8, bothHands: 12.3, assembly: 6.8 },
  },
  "60+": {
    male: { rightHand: 17.0, leftHand: 15.8, bothHands: 12.5, assembly: 7.0 },
    female: { rightHand: 15.8, leftHand: 14.8, bothHands: 11.5, assembly: 6.2 },
  },
};

export default function PurduePegboardTestRunner({ client, onSave, onClose }) {
  const [showInstructions, setShowInstructions] = useState(true);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [currentSubtestIndex, setCurrentSubtestIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [scores, setScores] = useState({ rightHand: null, leftHand: null, bothHands: null, assembly: null });
  const [notes, setNotes] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(todayLocal());
  const [isTestComplete, setIsTestComplete] = useState(false);
  const timerRef = useRef(null);

  // Auto-populate from client data
  const clientAge = client?.date_of_birth
    ? Math.floor((new Date() - new Date(client.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  const clientSex = client?.gender || null;

  const getAgeGroup = (age) => {
    if (age < 30) return "20-29";
    if (age < 40) return "30-39";
    if (age < 50) return "40-49";
    if (age < 60) return "50-59";
    return "60+";
  };

  const subtests = [
    { key: "rightHand", label: "Right Hand", time: 30 },
    { key: "leftHand", label: "Left Hand", time: 30 },
    { key: "bothHands", label: "Both Hands", time: 30 },
    { key: "assembly", label: "Assembly", time: 60 },
  ];

  const currentSubtest = subtests[currentSubtestIndex];

  useEffect(() => {
    if (isTestRunning && timeRemaining > 0) {
      timerRef.current = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
    } else if (isTestRunning && timeRemaining === 0) {
      // Time is up for current subtest
      if (currentSubtestIndex < subtests.length - 1) {
        // Move to next subtest
        setCurrentSubtestIndex(currentSubtestIndex + 1);
        setTimeRemaining(subtests[currentSubtestIndex + 1].time);
      } else {
        // All subtests complete
        setIsTestRunning(false);
        setIsTestComplete(true);
      }
    }
    return () => clearTimeout(timerRef.current);
  }, [isTestRunning, timeRemaining, currentSubtestIndex]);

  const startTest = () => {
    if (!clientAge || !clientSex) {
      toast.error("Client age and gender required for normative comparison.");
      return;
    }
    setShowInstructions(false);
    setIsTestRunning(true);
    setCurrentSubtestIndex(0);
    setTimeRemaining(subtests[0].time);
  };

  const incrementScore = () => {
    const key = currentSubtest.key;
    setScores(prev => ({
      ...prev,
      [key]: (prev[key] ?? 0) + 1
    }));
  };

  const decrementScore = () => {
    const key = currentSubtest.key;
    setScores(prev => ({
      ...prev,
      [key]: prev[key] && prev[key] > 0 ? prev[key] - 1 : prev[key]
    }));
  };

  const skipToNext = () => {
    if (currentSubtestIndex < subtests.length - 1) {
      setCurrentSubtestIndex(currentSubtestIndex + 1);
      setTimeRemaining(subtests[currentSubtestIndex + 1].time);
    } else {
      setIsTestRunning(false);
      setIsTestComplete(true);
    }
  };

  const stopTest = () => {
    setIsTestRunning(false);
    setIsTestComplete(true);
    clearTimeout(timerRef.current);
  };

  const getInterpretation = (subtest, score) => {
    if (!clientAge || !clientSex) return null;
    const ageGroup = getAgeGroup(clientAge);
    const normative = NORMATIVE_DATA[ageGroup]?.[clientSex.toLowerCase()]?.[subtest];
    if (!normative) return null;

    const percentile = ((score / normative) * 100).toFixed(0);
    if (percentile >= 90) return { level: "Excellent", color: "text-green-700" };
    if (percentile >= 75) return { level: "Above Average", color: "text-blue-700" };
    if (percentile >= 25) return { level: "Average", color: "text-slate-700" };
    return { level: "Below Average", color: "text-orange-700" };
  };

  const handleSave = () => {
    const ageGroup = clientAge ? getAgeGroup(clientAge) : "unknown";
    const completedScores = Object.fromEntries(
      Object.entries(scores).filter(([_, v]) => v !== null)
    );

    if (Object.keys(completedScores).length === 0) {
      toast.error("Please record at least one score before saving.");
      return;
    }

    const soapLines = [
      `• Purdue Pegboard Test`,
      `  Assessment Date: ${assessmentDate}`,
      `  Client Age: ${clientAge} years (${ageGroup})`,
      `  Client Sex: ${clientSex}`,
      ``,
      `  Test Scores (number of pegs placed in allotted time):`,
      `    Right Hand (30 sec): ${scores.rightHand ?? 'Not completed'}`,
      `    Left Hand (30 sec): ${scores.leftHand ?? 'Not completed'}`,
      `    Both Hands (30 sec): ${scores.bothHands ?? 'Not completed'}`,
      `    Assembly (60 sec): ${scores.assembly ?? 'Not completed'}`,
      ``,
      `  Clinical Interpretation:`,
      `    The Purdue Pegboard Test measures fine motor dexterity and hand-eye coordination.`,
      `    Scores reflect the number of pegs placed within time limits for each subtest.`,
      `    Laterality differences may indicate dominant vs. non-dominant hand performance.`,
      ``,
      `  Clinical Notes:`,
      notes ? `    ${notes.replace(/\n/g, '\n    ')}` : `    None provided`,
      ``,
      `  References:`,
      `    Tiffin J, Asher EJ. The Purdue Pegboard Test: norms and studies of reliability and validity.`,
      `    J Clin Psychol. 1950;6(4):390-395.`,
    ].join('\n');

    const totalValue = Object.values(completedScores).reduce((a, b) => (a ?? 0) + (b ?? 0), 0);

    onSave({
      status: "completed",
      result_value: totalValue,
      additional_data: {
        measurement_type: "dexterity_test",
        scores,
        client_age: clientAge,
        client_sex: clientSex,
        age_group: ageGroup,
        soap_text: soapLines,
      },
      notes,
      assessment_date: assessmentDate,
    });

    toast.success("Purdue Pegboard Test saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-start z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Purdue Pegboard Test</h2>
            <p className="text-sm text-slate-500">Fine motor dexterity and hand-eye coordination</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Instructions Panel */}
          {showInstructions && (
            <>
              {/* Clinician Instructions */}
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Clinician Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-blue-900">
                  <div>
                    <p className="font-semibold mb-2">Test Setup:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Client seated comfortably with pegboard on table at elbow height</li>
                      <li>Pegboard positioned directly in front of client, 9 inches from body edge</li>
                      <li>Pegs placed in small cup at the client's non-test hand side</li>
                      <li>Client's other hand rests flat on table, palm down</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold mb-2">Four Subtests (30 seconds each for first 3, 60 seconds for assembly):</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>Right Hand:</strong> Place pegs in right column (30 sec)</li>
                      <li><strong>Left Hand:</strong> Place pegs in left column (30 sec)</li>
                      <li><strong>Both Hands:</strong> Alternate pegs between columns (30 sec)</li>
                      <li><strong>Assembly:</strong> Insert pegs, washers, collars in sequence (60 sec)</li>
                    </ul>
                  </div>
                  <div className="bg-orange-100 border border-orange-300 rounded p-2 mt-2">
                    <p className="text-xs text-orange-900 font-semibold">Safety: Monitor hand coordination and fatigue. Stop if client experiences pain.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Resources */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Equipment & Resources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-2">Equipment Purchase:</p>
                    <a
                      href="https://www.ausmedsupply.com.au/product-categories/diagnostic-eveluation/dexterity-function/purdue-peg-board"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:underline text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Australian Medical Supply – Purdue Pegboard
                    </a>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-2">Video Demonstration:</p>
                    <a
                      href="https://www.youtube.com/watch?v=cvQbo0CzScI"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:underline text-sm"
                    >
                      <Video className="w-4 h-4" />
                      YouTube: How to Administer Purdue Pegboard Test
                    </a>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-2">Manuals & Guides:</p>
                    <div className="space-y-1">
                      <a
                        href="https://lafayetteinstrument.com/downloads/manuals/32108A-quick-start-pdf-rev1.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:underline text-sm"
                      >
                        <BookOpen className="w-4 h-4" />
                        Lafayette Instruments – Quick Start Guide
                      </a>
                      <a
                        href="https://www.limef.com/downloads/MAN-32020A-forpdf-rev0.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:underline text-sm"
                      >
                        <BookOpen className="w-4 h-4" />
                        LIMEF – Complete Manual
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Client Info */}
          {clientAge && clientSex && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-slate-500">Client Age</Label>
                    <p className="text-lg font-bold text-blue-700">{clientAge} years</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Sex</Label>
                    <p className="text-lg font-bold text-blue-700">{clientSex}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Age Group</Label>
                    <p className="text-lg font-bold text-blue-700">{getAgeGroup(clientAge)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Assessment Date */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assessment Date</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="date"
                value={assessmentDate}
                onChange={(e) => setAssessmentDate(e.target.value)}
                disabled={isTestRunning}
              />
            </CardContent>
          </Card>

          {/* Active Test Section */}
          {isTestRunning && currentSubtest && (
            <Card className="border-red-300 bg-red-50">
              <CardHeader>
                <CardTitle className="text-base">
                  Test in Progress: {currentSubtest.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center items-center gap-4">
                  <div className="text-6xl font-bold text-red-700 font-mono">{timeRemaining}</div>
                  <div className="text-lg font-semibold text-slate-700">seconds remaining</div>
                </div>

                <div className="bg-white p-6 rounded-lg border-2 border-red-300">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{currentSubtest.label}</p>
                      <p className="text-xs text-slate-500">{currentSubtest.time} seconds</p>
                    </div>
                    {clientAge && clientSex && (
                      <p className="text-xs text-slate-600">
                        Expected: ~{NORMATIVE_DATA[getAgeGroup(clientAge)]?.[clientSex.toLowerCase()]?.[currentSubtest.key]?.toFixed(1) || 'N/A'} pegs
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 justify-center mb-4">
                    <Button
                      onClick={decrementScore}
                      variant="outline"
                      size="lg"
                      className="h-12 w-12"
                    >
                      −
                    </Button>
                    <div className="text-5xl font-bold text-center w-32">{scores[currentSubtest.key] ?? 0}</div>
                    <Button
                      onClick={incrementScore}
                      variant="outline"
                      size="lg"
                      className="h-12 w-12"
                    >
                      +
                    </Button>
                  </div>

                  <div className="flex gap-3 justify-center">
                    <Button
                      onClick={skipToNext}
                      variant="secondary"
                      className="h-10"
                    >
                      Skip & Continue →
                    </Button>
                    <Button
                      onClick={stopTest}
                      variant="destructive"
                      className="h-10"
                    >
                      <Pause className="w-4 h-4 mr-2" />
                      Stop Test
                    </Button>
                  </div>
                </div>

                {/* Test Progress */}
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Test Progress:</p>
                  <div className="space-y-2">
                    {subtests.map((subtest, idx) => (
                      <div key={subtest.key} className={`text-sm p-2 rounded ${idx === currentSubtestIndex ? 'bg-red-100 font-semibold' : idx < currentSubtestIndex ? 'bg-green-100' : 'bg-slate-100'}`}>
                        {idx === currentSubtestIndex ? '▶ ' : idx < currentSubtestIndex ? '✓ ' : '○ '}
                        {subtest.label}: {scores[subtest.key] ?? '–'}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Test Complete Section */}
          {isTestComplete && !isTestRunning && (
            <Card className="border-green-300 bg-green-50">
              <CardHeader>
                <CardTitle className="text-base">Test Complete</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {subtests.map((subtest) => (
                    <div key={subtest.key} className="flex justify-between items-center p-3 bg-white rounded border">
                      <div>
                        <p className="text-sm font-semibold">{subtest.label}</p>
                        <p className="text-xs text-slate-500">{subtest.time} seconds</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-900">{scores[subtest.key] ?? '—'}</p>
                        {clientAge && clientSex && scores[subtest.key] !== null && (
                          <p className={`text-xs font-semibold ${getInterpretation(subtest.key, scores[subtest.key])?.color || 'text-slate-600'}`}>
                            {getInterpretation(subtest.key, scores[subtest.key])?.level || ''}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => {
                    setIsTestComplete(false);
                    setCurrentSubtestIndex(0);
                    setScores({ rightHand: null, leftHand: null, bothHands: null, assembly: null });
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Redo Test
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Before Test Section */}
          {!isTestRunning && !isTestComplete && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ready to Start</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={startTest}
                  className="w-full bg-green-600 hover:bg-green-700 h-12"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Start Test
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Clinical Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clinical Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Hand dominance, tremor, dropping pegs, fatigue, form quality..."
                rows={4}
                disabled={isTestRunning}
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
            disabled={Object.values(scores).every(s => s === 0)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Purdue Pegboard Test
          </Button>
        </div>
      </div>
    </div>
  );
}