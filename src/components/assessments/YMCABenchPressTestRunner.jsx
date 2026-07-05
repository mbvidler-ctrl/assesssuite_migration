import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, Square, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

// ─── ENDURANCE CLASSIFICATION ──────────────────────────────────────────────
const getEnduranceCategory = (reps, gender) => {
  const isMale = gender === "M";
  if (isMale) {
    return reps >= 36 ? "Excellent" : reps >= 29 ? "Good" : reps >= 22 ? "Average" : reps >= 10 ? "Poor" : "Very Poor";
  } else {
    return reps >= 35 ? "Excellent" : reps >= 27 ? "Good" : reps >= 21 ? "Average" : reps >= 10 ? "Poor" : "Very Poor";
  }
};

const colorForCategory = (category) => {
  switch (category) {
    case "Excellent":
      return "border-green-300 bg-green-50";
    case "Good":
      return "border-blue-300 bg-blue-50";
    case "Average":
      return "border-amber-300 bg-amber-50";
    case "Poor":
      return "border-orange-300 bg-orange-50";
    case "Very Poor":
      return "border-red-300 bg-red-50";
    default:
      return "border-slate-300 bg-slate-50";
  }
};

// ─── COMPONENT ──────────────────────────────────────────────────────────────
export default function YMCABenchPressTestRunner({ client, onSave, onClose }) {
  const [isTesting, setIsTesting] = useState(false);
  const [testComplete, setTestComplete] = useState(false);
  const [bodyMass, setBodyMass] = useState("");
  const [gender, setGender] = useState("");
  const [testWeight, setTestWeight] = useState("36");
  const [repetitions, setRepetitions] = useState(0);
  const [cadenceBreakdown, setCadenceBreakdown] = useState("no");
  const [rpe, setRpe] = useState("");
  const [painPresent, setPainPresent] = useState("no");
  const [notes, setNotes] = useState("");
  const [showProtocol, setShowProtocol] = useState(true);

  const handleStartTest = () => {
    if (!bodyMass || !gender) {
      toast.error("Please enter body mass and gender.");
      return;
    }
    setIsTesting(true);
    setTestComplete(false);
    setRepetitions(0);
    toast.success("Test started — maintain metronome cadence. Stop on signal or failure.");
  };

  const handleStopTest = () => {
    setIsTesting(false);
    setTestComplete(true);
  };

  const handleSave = () => {
    if (testComplete === false) {
      toast.error("Test must be completed before saving.");
      return;
    }

    const category = getEnduranceCategory(repetitions, gender);
    const soapText = `• Allied Upper Body Endurance Press Test
  Standardized repetition endurance assessment for upper body muscular endurance
  
  CLIENT DETAILS:
  Body Mass: ${bodyMass} kg
  Gender: ${gender === "M" ? "Male" : "Female"}
  
  PROTOCOL:
  Test Load: ${testWeight} kg
  Cadence: 60 bpm via metronome (1 rep per 2 beats = 30 reps/min)
  Procedure: Continuous pressing until cadence breakdown or failure
  
  PERFORMANCE:
  Repetitions Completed: ${repetitions}
  Muscular Endurance Category: ${category}
  Cadence Maintained: ${cadenceBreakdown === "no" ? "Yes" : "No (breakdown occurred)"}
  ${rpe ? `Perceived Exertion (RPE): ${rpe}/10` : ""}
  
  SAFETY & RESPONSE:
  Pain During Test: ${painPresent === "yes" ? "Present" : "None"}
  ${notes ? `Clinical Notes: ${notes}` : ""}
  
  INTERPRETATION:
  Upper-body endurance performance classified as ${category} based on standardized loading.
  ${repetitions >= 36 ? "Excellent muscular endurance capacity." : ""}
  ${repetitions >= 29 && repetitions < 36 ? "Good muscular endurance capacity." : ""}
  ${repetitions >= 22 && repetitions < 29 ? "Moderate muscular endurance capacity." : ""}
  ${repetitions < 22 ? "Limited upper-body muscular endurance for standardized load." : ""}
  
  IP STATEMENT:
  This assessment is independently structured and does not reproduce YMCA proprietary materials or score sheets.`;

    onSave({
      status: "completed",
      result_value: repetitions,
      additional_data: {
        measurement_type: "allied_bench_press_endurance",
        body_mass_kg: parseInt(bodyMass),
        gender,
        test_weight_kg: parseInt(testWeight),
        repetitions,
        category,
        cadence_breakdown: cadenceBreakdown === "yes",
        rpe: rpe ? parseInt(rpe) : null,
        pain_present: painPresent === "yes",
        soap_text: soapText,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Assessment saved.");
    setTimeout(() => onClose(), 500);
  };

  const category = testComplete ? getEnduranceCategory(repetitions, gender) : null;

  // ─── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[95vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-t-2xl px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-bold">Allied Upper Body Endurance Press Test</h2>
            <p className="text-purple-100 text-sm mt-1">Standardized repetition endurance assessment for upper body muscular endurance</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-5">

          {/* IP Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>This assessment is independently structured and does not reproduce YMCA proprietary materials or score sheets.</p>
          </div>

          {/* Result Display */}
          {testComplete && category && (
            <Card className={`border-2 ${colorForCategory(category)}`}>
              <CardHeader>
                <CardTitle>Test Results — Muscular Endurance Classification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <p className="text-sm text-slate-600 mb-2">Repetitions Completed</p>
                  <p className="text-5xl font-bold text-slate-900">{repetitions}</p>
                </div>
                <div className="bg-white p-3 rounded border border-slate-200 text-center">
                  <Badge className={`text-sm px-3 py-1 ${
                    category === "Excellent" ? "bg-green-600" :
                    category === "Good" ? "bg-blue-600" :
                    category === "Average" ? "bg-amber-600" :
                    category === "Poor" ? "bg-orange-600" :
                    "bg-red-600"
                  }`}>
                    {category} Endurance
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <p className="text-xs text-slate-600">Body Mass</p>
                    <p className="font-semibold">{bodyMass} kg</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <p className="text-xs text-slate-600">Test Load</p>
                    <p className="font-semibold">{testWeight} kg</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <p className="text-xs text-slate-600">Cadence Breakdown</p>
                    <p className="font-semibold">{cadenceBreakdown === "yes" ? "Yes" : "No"}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <p className="text-xs text-slate-600">Pain Reported</p>
                    <p className="font-semibold">{painPresent === "yes" ? "Yes" : "No"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Protocol Instructions */}
          {!testComplete && (
            <div className="border border-violet-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowProtocol(v => !v)}
                className="w-full flex justify-between items-center bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-900 hover:bg-violet-100 transition-colors"
              >
                <span>📋 Clinician Instructions & Protocol</span>
                {showProtocol ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showProtocol && (
                <div className="p-4 text-sm text-violet-800 space-y-3 bg-violet-50 border-t border-violet-200">
                  <div>
                    <p className="font-semibold">Equipment</p>
                    <ul className="text-xs list-disc list-inside space-y-0.5 text-violet-700 mt-1">
                      <li>Flat bench (45° incline optional)</li>
                      <li>Barbell with collars</li>
                      <li>Safety spotters (required)</li>
                      <li>Metronome (60 bpm)</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold">Standard Loads</p>
                    <ul className="text-xs list-disc list-inside space-y-0.5 text-violet-700 mt-1">
                      <li><strong>Male:</strong> 36 kg barbell</li>
                      <li><strong>Female:</strong> 16 kg barbell</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold">Procedure</p>
                    <ul className="text-xs list-disc list-inside space-y-0.5 text-violet-700 mt-1">
                      <li>Client assumes supine position on bench, feet flat on floor or bench</li>
                      <li>Bar positioned at chest level (mid-nipple line)</li>
                      <li>Cadence: 60 bpm metronome (press up on beat 1, lower on beat 2) = 30 reps/min</li>
                      <li>Count complete repetitions only (full ROM: bar touches chest, elbows lock out)</li>
                      <li>Continue until cadence breakdown, loss of ROM, or client request to stop</li>
                    </ul>
                  </div>
                  <div className="bg-violet-100 rounded p-2 text-xs italic">
                    "Press the bar upward on the beat, lower it on the next beat. Keep a steady rhythm with the metronome. Complete as many repetitions as you can while maintaining the pace."
                  </div>
                  <div>
                    <p className="font-semibold">Stopping Criteria</p>
                    <ul className="text-xs list-disc list-inside space-y-0.5 text-violet-700 mt-1">
                      <li>Client cannot maintain cadence (lags behind metronome)</li>
                      <li>Loss of full range of motion (bar doesn't touch chest or elbows don't lock)</li>
                      <li>Client requests to stop or shows signs of distress</li>
                      <li>Spotter safety concern</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Safety Alert */}
          {!testComplete && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-red-900">
                  <AlertCircle className="w-5 h-5" />
                  Safety — STOP Test Immediately
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-red-800 space-y-1">
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>Chest pain, pressure, or unusual discomfort</li>
                  <li>Dizziness, severe dyspnea, or lightheadedness</li>
                  <li>Pallor, confusion, or loss of consciousness risk</li>
                  <li>Sharp or acute joint pain (shoulder, wrist, elbow)</li>
                  <li>Spotter safety concern at any point</li>
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Data Entry & Test Control */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Test Data & Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Body Mass (kg) *</Label>
                  <Input type="number" value={bodyMass} onChange={e => setBodyMass(e.target.value)} placeholder="e.g., 75" disabled={isTesting} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Gender *</Label>
                  <select value={gender} onChange={e => setGender(e.target.value)} disabled={isTesting} className="mt-1 w-full p-2 border border-input rounded-md text-sm bg-background">
                    <option value="">Select</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Test Load (kg)</Label>
                  <Input type="number" value={testWeight} onChange={e => setTestWeight(e.target.value)} disabled={isTesting} className="mt-1" />
                </div>
              </div>

              {isTesting && (
                <div className="p-4 bg-violet-50 rounded-lg border border-violet-200 space-y-3">
                  <div className="text-center">
                    <p className="text-sm text-violet-700 font-semibold mb-1">Repetitions Completed</p>
                    <p className="text-4xl font-bold text-violet-900">{repetitions}</p>
                  </div>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={() => setRepetitions(Math.max(0, repetitions - 1))} variant="outline" className="px-6">
                      −
                    </Button>
                    <Button onClick={() => setRepetitions(repetitions + 1)} className="bg-violet-600 hover:bg-violet-700 px-6">
                      +
                    </Button>
                  </div>
                </div>
              )}

              {!isTesting && !testComplete && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Cadence Breakdown</Label>
                    <select value={cadenceBreakdown} onChange={e => setCadenceBreakdown(e.target.value)} className="mt-1 w-full p-2 border border-input rounded-md text-sm bg-background">
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Pain Present</Label>
                    <select value={painPresent} onChange={e => setPainPresent(e.target.value)} className="mt-1 w-full p-2 border border-input rounded-md text-sm bg-background">
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">RPE (Borg 0–10)</Label>
                    <Input type="number" min="0" max="10" value={rpe} onChange={e => setRpe(e.target.value)} placeholder="0–10" className="mt-1" />
                  </div>
                </div>
              )}

              {testComplete && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Repetitions Completed</Label>
                    <Input type="number" value={repetitions} onChange={e => setRepetitions(parseInt(e.target.value) || 0)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">RPE (Borg 0–10)</Label>
                    <Input type="number" min="0" max="10" value={rpe} onChange={e => setRpe(e.target.value)} placeholder="0–10" className="mt-1" />
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs">Clinical Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Movement quality, form breakdown, fatigue observations, pain characteristics..." rows={2} disabled={isTesting} className="mt-1" />
              </div>

              <div className="flex gap-2">
                {!isTesting && !testComplete ? (
                  <Button onClick={handleStartTest} className="flex-1 bg-green-600 hover:bg-green-700 h-10">
                    <Play className="w-4 h-4 mr-2" />
                    Start Test
                  </Button>
                ) : isTesting ? (
                  <Button onClick={handleStopTest} variant="destructive" className="flex-1 h-10">
                    <Square className="w-4 h-4 mr-2" />
                    Stop Test
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Norms Reference */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Endurance Classification — Repetitions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto text-xs">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-200 border-b-2 border-slate-400">
                      <th className="p-2 text-left font-semibold">Category</th>
                      <th className="p-2 text-center font-semibold">Men (36 kg)</th>
                      <th className="p-2 text-center font-semibold">Women (16 kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { cat: "Excellent", men: "≥36", women: "≥35", bg: "bg-green-50" },
                      { cat: "Good", men: "29–35", women: "27–34", bg: "bg-blue-50" },
                      { cat: "Average", men: "22–28", women: "21–26", bg: "bg-amber-50" },
                      { cat: "Poor", men: "10–21", women: "10–20", bg: "bg-orange-50" },
                      { cat: "Very Poor", men: "<10", women: "<10", bg: "bg-red-50" },
                    ].map(row => (
                      <tr key={row.cat} className={`border-b ${row.bg}`}>
                        <td className="p-2 font-semibold">{row.cat}</td>
                        <td className="p-2 text-center">{row.men}</td>
                        <td className="p-2 text-center">{row.women}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 mt-2">Values based on standardized barbell loads and 30-rep/min cadence.</p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t bg-slate-50 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          {testComplete && (
            <Button onClick={handleSave} className="bg-violet-600 hover:bg-violet-700 text-white">
              <Save className="w-4 h-4 mr-2" />
              Save Assessment
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}