import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Play, Square, ChevronRight, ChevronLeft, Trash2, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// Two pages: 0 = instructions, 1 = test execution
export default function FigureofEightWalkTestRunner({ client, onSave, onClose }) {
  const [page, setPage] = useState(0); // 0=instructions, 1=test
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [trialData, setTrialData] = useState([]);
  const [notes, setNotes] = useState("");
  const [preVitals, setPreVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [postVitals, setPostVitals] = useState({ heartRate: "", bloodPressure: "" });
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTime(t => parseFloat((t + 0.1).toFixed(1)));
      }, 100);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const handleStartStop = () => {
    if (isRunning) {
      // Stop — record trial
      setIsRunning(false);
      const recorded = parseFloat(time.toFixed(1));
      setTrialData(prev => [...prev, { time: recorded }]);
      toast.success(`Trial ${trialData.length + 1} recorded: ${recorded}s`);
      setTime(0);
    } else {
      // Start
      setTime(0);
      setIsRunning(true);
      toast.success("Timer started. Begin when client is ready.");
    }
  };

  const handleRemoveTrial = (idx) => {
    setTrialData(prev => prev.filter((_, i) => i !== idx));
  };

  const avgTime = trialData.length > 0
    ? trialData.reduce((a, t) => a + t.time, 0) / trialData.length
    : null;

  const getInterpretation = (avg) => {
    if (avg == null) return null;
    if (avg < 12) return { label: "Normal dynamic balance", color: "text-green-700", bg: "bg-green-50 border-green-200" };
    if (avg < 16) return { label: "Mild balance / turning deficit", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" };
    return { label: "Significant deficit — elevated fall risk", color: "text-red-700", bg: "bg-red-50 border-red-200" };
  };

  const interp = getInterpretation(avgTime);

  const handleSave = () => {
    if (trialData.length === 0) {
      toast.error("Please complete at least one trial before saving.");
      return;
    }
    const avg = parseFloat(avgTime.toFixed(2));
    const interpretation = interp?.label || "";

    let soapText = `• Figure of Eight Walk Test\n`;
    soapText += `  Average Time: ${avg}s over ${trialData.length} trial(s)\n`;
    soapText += `  Interpretation: ${interpretation}\n`;
    trialData.forEach((t, i) => { soapText += `  Trial ${i + 1}: ${t.time}s\n`; });
    if (preVitals.heartRate || preVitals.bloodPressure)
      soapText += `  Pre-Test Vitals: HR ${preVitals.heartRate || "—"} bpm, BP ${preVitals.bloodPressure || "—"}\n`;
    if (postVitals.heartRate || postVitals.bloodPressure)
      soapText += `  Post-Test Vitals: HR ${postVitals.heartRate || "—"} bpm, BP ${postVitals.bloodPressure || "—"}\n`;
    if (notes.trim()) soapText += `  Notes: ${notes}`;

    onSave({
      status: "completed",
      result_value: avg,
      additional_data: {
        measurement_type: "Figure-of-Eight Walk Test",
        trials: trialData,
        average_time: avg,
        interpretation,
        soap_text: soapText,
      },
      notes: soapText,
      assessment_date: todayLocal(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-slate-50 border-b px-6 py-4 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Figure of Eight Walk Test</h2>
            <p className="text-sm text-slate-500">Client: {client?.full_name || "Unknown"}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Page indicator */}
        <div className="flex border-b bg-slate-50 flex-shrink-0">
          {["Instructions", "Test"].map((label, i) => (
            <button
              key={i}
              onClick={() => !isRunning && setPage(i)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                page === i
                  ? "border-b-2 border-blue-600 text-blue-700 bg-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── PAGE 0: INSTRUCTIONS ── */}
          {page === 0 && (
            <>
              {/* Instructional diagram */}
              <Card className="border-slate-200 overflow-hidden">
                <CardContent className="p-0">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Figure_of_eight.svg/400px-Figure_of_eight.svg.png"
                    alt="Figure of Eight Walk Test diagram"
                    className="w-full object-contain bg-white p-4"
                    style={{ maxHeight: 200 }}
                    onError={e => {
                      // fallback: draw the pattern as SVG
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "block";
                    }}
                  />
                  {/* SVG fallback diagram */}
                  <div style={{ display: "none" }} className="flex items-center justify-center py-6 bg-slate-50">
                    <svg width="320" height="160" viewBox="0 0 320 160">
                      {/* Left loop */}
                      <ellipse cx="100" cy="80" rx="70" ry="55" fill="none" stroke="#3b82f6" strokeWidth="3" strokeDasharray="8 4"/>
                      {/* Right loop */}
                      <ellipse cx="220" cy="80" rx="70" ry="55" fill="none" stroke="#3b82f6" strokeWidth="3" strokeDasharray="8 4"/>
                      {/* Cone A */}
                      <polygon points="100,30 107,50 93,50" fill="#f59e0b"/>
                      <text x="100" y="62" textAnchor="middle" fontSize="11" fill="#92400e" fontWeight="bold">A</text>
                      {/* Cone B */}
                      <polygon points="220,110 227,130 213,130" fill="#f59e0b"/>
                      <text x="220" y="142" textAnchor="middle" fontSize="11" fill="#92400e" fontWeight="bold">B</text>
                      {/* Start marker */}
                      <circle cx="160" cy="80" r="8" fill="#10b981"/>
                      <text x="160" y="100" textAnchor="middle" fontSize="10" fill="#065f46">START</text>
                      {/* Arrow hint */}
                      <text x="160" y="20" textAnchor="middle" fontSize="10" fill="#6b7280">5 feet between cones</text>
                      <line x1="110" y1="17" x2="210" y2="17" stroke="#9ca3af" strokeWidth="1" markerEnd="url(#arr)"/>
                    </svg>
                  </div>
                  <div className="bg-slate-50 px-4 py-2 text-xs text-slate-500 text-center border-t">
                    Place two cones 5 feet (1.5 m) apart. Client starts midway between them and walks a figure-eight around both cones.
                  </div>
                </CardContent>
              </Card>

              {/* Equipment */}
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-blue-900">
                    <Info className="w-4 h-4" /> Equipment & Setup
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-blue-900 space-y-1">
                  <ul className="list-disc list-inside space-y-1 ml-1">
                    <li>Two cones placed <strong>5 feet (1.5 m)</strong> apart</li>
                    <li>Clear space at least 15 × 15 ft with no obstacles</li>
                    <li>Appropriate footwear; assistive devices allowed if normally used</li>
                    <li>Perform <strong>2–3 trials</strong>; record each time</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Instructions */}
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-900">Administration</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-700 space-y-2">
                  <ol className="list-decimal list-inside space-y-1 ml-1">
                    <li>Client stands upright at the midpoint between the two cones.</li>
                    <li>On "Go", client walks around cone A, crosses to cone B, walks around cone B and returns to start — <strong>completing two full figure-eights</strong>.</li>
                    <li>Use the client's normal walking pace. Do not instruct them to hurry.</li>
                    <li>Timer starts on "Go" and stops when they return to start position.</li>
                    <li>Provide safety guarding as needed.</li>
                  </ol>
                  <div className="bg-blue-50 border border-blue-200 rounded p-2 italic mt-2">
                    "Walk around these two cones in a figure-eight pattern — around one, then the other, and back to start. Walk at your normal pace. Ready? Go!"
                  </div>
                </CardContent>
              </Card>

              {/* Normative values */}
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-900">
                    <AlertTriangle className="w-4 h-4" /> Normative Values
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-amber-900 space-y-1">
                  <div className="grid grid-cols-3 gap-2 font-semibold mb-1">
                    <span>Age</span><span>Normal</span><span>Elevated risk</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>65–74</span><span className="text-green-700">&lt;12s</span><span className="text-red-700">&gt;16s</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>75+</span><span className="text-green-700">&lt;14s</span><span className="text-red-700">&gt;18s</span>
                  </div>
                  <p className="mt-2">MCID: approximately 2–3 seconds for detecting meaningful change.</p>
                </CardContent>
              </Card>
            </>
          )}

          {/* ── PAGE 1: TEST ── */}
          {page === 1 && (
            <>
              {/* Pre-test vitals */}
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pre-Test Vitals</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      placeholder="Heart Rate (bpm)"
                      value={preVitals.heartRate}
                      onChange={e => setPreVitals(v => ({ ...v, heartRate: e.target.value }))}
                    />
                    <Input
                      type="text"
                      placeholder="BP (e.g., 140/90)"
                      value={preVitals.bloodPressure}
                      onChange={e => setPreVitals(v => ({ ...v, bloodPressure: e.target.value }))}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Timer */}
              <Card className={`border-2 ${isRunning ? "border-green-400 bg-green-50" : "border-slate-200"}`}>
                <CardContent className="pt-6 pb-5 flex flex-col items-center gap-4">
                  <p className="text-6xl font-mono font-bold tracking-tight text-slate-800">
                    {time.toFixed(1)}<span className="text-2xl text-slate-500 ml-1">s</span>
                  </p>
                  {isRunning && (
                    <p className="text-sm text-green-700 font-medium animate-pulse">â— Recording…</p>
                  )}
                  <Button
                    onClick={handleStartStop}
                    size="lg"
                    className={`w-48 text-base font-semibold ${
                      isRunning
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    {isRunning
                      ? <><Square className="w-4 h-4 mr-2 fill-white" /> Stop</>
                      : <><Play className="w-4 h-4 mr-2 fill-white" /> {trialData.length > 0 ? "Next Trial" : "Start"}</>
                    }
                  </Button>
                </CardContent>
              </Card>

              {/* Recorded trials */}
              {trialData.length > 0 && (
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Recorded Trials</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {trialData.map((t, i) => (
                      <div key={i} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded">
                        <span className="text-sm font-medium">Trial {i + 1}: <strong>{t.time}s</strong></span>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveTrial(i)} className="text-red-500 hover:bg-red-50 h-7 w-7 p-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    {avgTime !== null && interp && (
                      <div className={`rounded border px-3 py-2 mt-2 ${interp.bg}`}>
                        <p className="text-sm font-semibold">Avg: {avgTime.toFixed(2)}s</p>
                        <p className={`text-xs ${interp.color}`}>{interp.label}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Post-test vitals */}
              {trialData.length > 0 && (
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Post-Test Vitals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="number"
                        placeholder="Heart Rate (bpm)"
                        value={postVitals.heartRate}
                        onChange={e => setPostVitals(v => ({ ...v, heartRate: e.target.value }))}
                      />
                      <Input
                        type="text"
                        placeholder="BP (e.g., 140/90)"
                        value={postVitals.bloodPressure}
                        onChange={e => setPostVitals(v => ({ ...v, bloodPressure: e.target.value }))}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Clinical notes */}
              {trialData.length > 0 && (
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Clinical Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Observations: gait pattern, balance, turning quality, hesitation, stumbles..."
                      rows={3}
                    />
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-slate-50 px-6 py-4 flex justify-between items-center flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" /> Close
          </Button>

          <div className="flex gap-2">
            {page === 0 && (
              <Button onClick={() => setPage(1)} className="bg-blue-600 hover:bg-blue-700">
                Start Test <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {page === 1 && (
              <>
                <Button variant="outline" onClick={() => !isRunning && setPage(0)} disabled={isRunning}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                {trialData.length > 0 && !isRunning && (
                  <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                    <Save className="w-4 h-4 mr-2" /> Save Assessment
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}