import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, Timer, Trash2, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function TenSecondRepeatedJumpTestRunner({ client, onSave, onClose }) {
  const [testRunning, setTestRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [clickPhase, setClickPhase] = useState("ready");
  const [currentFlightStart, setCurrentFlightStart] = useState(null);
  const [currentContactStart, setCurrentContactStart] = useState(null);
  const [jumps, setJumps] = useState([]);
  const [notes, setNotes] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(todayLocal());
  const testTimerRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (testRunning) {
      startTimeRef.current = Date.now() - elapsedTime;
      testTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedTime(elapsed);
        if (elapsed >= 10000) {
          handleStopTest();
        }
      }, 10);
    } else {
      clearInterval(testTimerRef.current);
    }
    return () => clearInterval(testTimerRef.current);
  }, [testRunning]);

  const handleStartTest = () => {
    setTestRunning(true);
    setElapsedTime(0);
    setJumps([]);
    setClickPhase("flight");
    setCurrentFlightStart(Date.now());
    toast.info("Test started! Click the button each time the client leaves the ground, then again when they land.");
  };

  const handleStopTest = () => {
    setTestRunning(false);
    setClickPhase("ready");
    setCurrentFlightStart(null);
    setCurrentContactStart(null);
    toast.success("Test completed!");
  };

  const handleTimerClick = () => {
    if (!testRunning) return;
    const now = Date.now();
    if (clickPhase === "flight") {
      const flightTime = now - currentFlightStart;
      setCurrentContactStart(now);
      setClickPhase("contact");
      setJumps(prev => [...prev, { flight_time_ms: Math.round(flightTime), contact_time_ms: null, jump_height_cm: null }]);
    } else if (clickPhase === "contact") {
      const contactTime = now - currentContactStart;
      setJumps(prev => {
        const updated = [...prev];
        updated[updated.length - 1].contact_time_ms = Math.round(contactTime);
        return updated;
      });
      setCurrentFlightStart(now);
      setClickPhase("flight");
    }
  };

  const handleDeleteJump = (index) => {
    setJumps(prev => prev.filter((_, i) => i !== index));
  };

  const handleJumpHeightChange = (index, value) => {
    setJumps(prev => {
      const updated = [...prev];
      updated[index].jump_height_cm = value ? parseFloat(value) : null;
      return updated;
    });
  };

  const validJumps = jumps.filter(j => j.flight_time_ms && j.contact_time_ms);

  const calculateBestRSI = () => {
    if (validJumps.length === 0) return 0;
    return Math.max(...validJumps.map(j => j.flight_time_ms / j.contact_time_ms));
  };

  const calculateAverageRSI = () => {
    if (validJumps.length === 0) return 0;
    const rsiValues = validJumps.map(j => j.flight_time_ms / j.contact_time_ms);
    return (rsiValues.reduce((acc, r) => acc + r, 0) / rsiValues.length).toFixed(3);
  };

  const handleSave = () => {
    if (validJumps.length === 0) {
      toast.error("Please complete at least one full jump (flight + contact time).");
      return;
    }
    const jumpHeights = validJumps.map(j => j.jump_height_cm).filter(h => h !== null && h !== undefined);
    const avgFlightTime = validJumps.reduce((sum, j) => sum + j.flight_time_ms, 0) / validJumps.length;
    const avgContactTime = validJumps.reduce((sum, j) => sum + j.contact_time_ms, 0) / validJumps.length;
    const rsiValues = validJumps.map(j => j.flight_time_ms / j.contact_time_ms);
    const bestRSI = Math.max(...rsiValues);
    const avgRSI = rsiValues.reduce((sum, r) => sum + r, 0) / rsiValues.length;
    let fatigueIndex = null;
    if (jumpHeights.length > 1) {
      const highestJump = Math.max(...jumpHeights);
      const lowestJump = Math.min(...jumpHeights);
      fatigueIndex = ((highestJump - lowestJump) / highestJump) * 100;
    }

    const jumpLines = validJumps.map((j, i) => {
      const rsi = (j.flight_time_ms / j.contact_time_ms).toFixed(3);
      return `    Jump ${i + 1}: Flight=${j.flight_time_ms}ms, Contact=${j.contact_time_ms}ms, RSI=${rsi}${j.jump_height_cm ? `, Height=${j.jump_height_cm}cm` : ''}`;
    }).join('\n');

    const soapText = `• 10-Second Repeated Jump Test\n  Total Valid Jumps: ${validJumps.length} | Best RSI: ${bestRSI.toFixed(3)} | Average RSI: ${avgRSI.toFixed(3)}\n  Avg Flight Time: ${Math.round(avgFlightTime)} ms | Avg Contact Time: ${Math.round(avgContactTime)} ms${fatigueIndex !== null ? ` | Fatigue Index: ${fatigueIndex.toFixed(1)}%` : ''}\n\n  Individual Jump Data:\n${jumpLines}${notes ? `\n\n  Clinical Notes: ${notes}` : ''}`;

    onSave({
      status: "completed",
      result_value: parseFloat(bestRSI.toFixed(3)),
      additional_data: {
        soap_text: soapText,
        measurement_type: "10_second_repeated_jump",
        total_jumps: validJumps.length,
        jumps: validJumps,
        average_flight_time_ms: Math.round(avgFlightTime),
        average_contact_time_ms: Math.round(avgContactTime),
        best_rsi: parseFloat(bestRSI.toFixed(3)),
        average_rsi: parseFloat(avgRSI.toFixed(3)),
        jump_heights_cm: jumpHeights.length > 0 ? jumpHeights : null,
        fatigue_index: fatigueIndex !== null ? parseFloat(fatigueIndex.toFixed(1)) : null,
      },
      notes,
      assessment_date: assessmentDate,
    });
    toast.success("Test data saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-4xl w-full my-4 space-y-4">

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-blue-600" />10-Second Repeated Jump Test — Clinician Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-blue-900">Purpose</p>
              <p>Measures reactive strength, neuromuscular power, and leg stiffness via the Reactive Strength Index (RSI = Flight Time ÷ Contact Time). Used for athletic performance, return-to-sport, and neuromuscular assessment.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-slate-50 border rounded-lg p-3">
                <p className="font-semibold mb-1">Equipment</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>Flat non-slip surface</li>
                  <li>This digital timer (or jump mat / Optojump for higher precision)</li>
                  <li>Optional: measuring tape for jump height</li>
                </ul>
              </div>
              <div className="bg-slate-50 border rounded-lg p-3">
                <p className="font-semibold mb-1">Client Positioning</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>Hands on hips throughout</li>
                  <li>Feet shoulder-width apart</li>
                  <li>Minimal knee flexion on landing (stiff leg jump)</li>
                  <li>Maximal height with minimal ground contact</li>
                </ul>
              </div>
            </div>
            <div className="bg-slate-50 border rounded-lg p-3">
              <p className="font-semibold mb-2">Procedure</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-600">
                <li>Client stands on surface ready to jump</li>
                <li>Clinician presses <strong>Start Test</strong> — client immediately begins jumping continuously</li>
                <li>Click the large button each time the client <strong>leaves the ground (takeoff)</strong> then again on <strong>landing (contact)</strong></li>
                <li>Test auto-stops at 10 seconds. Instruct client to jump as many times as possible within 10 seconds</li>
                <li>Record at least 5 valid jumps for a reliable RSI score</li>
              </ol>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="font-semibold text-amber-800 mb-1">RSI Interpretation (Reactive Strength Index)</p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-red-100 rounded p-2"><p className="font-bold text-red-800">&lt; 1.0</p><p className="text-red-700">Poor</p></div>
                <div className="bg-yellow-100 rounded p-2"><p className="font-bold text-yellow-800">1.0 – 1.5</p><p className="text-yellow-700">Average</p></div>
                <div className="bg-green-100 rounded p-2"><p className="font-bold text-green-800">&gt; 1.5</p><p className="text-green-700">Good–Elite</p></div>
              </div>
              <p className="text-xs text-amber-700 mt-2">Higher RSI = better reactive strength. Elite athletes typically score 2.0–3.0+.</p>
            </div>
          </CardContent>
        </Card>

        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Test Recording</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Assessment Date</Label>
                <Input type="date" value={assessmentDate} onChange={e => setAssessmentDate(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-4">
              {!testRunning ? (
                <Button onClick={handleStartTest} className="bg-green-600 hover:bg-green-700">
                  <Play className="h-5 w-5 mr-2" />Start 10s Test
                </Button>
              ) : (
                <Button onClick={handleStopTest} variant="destructive">
                  <X className="h-5 w-5 mr-2" />Stop Test Early
                </Button>
              )}
              <div className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-blue-600" />
                <span className="text-2xl font-bold">{(elapsedTime / 1000).toFixed(2)}s</span>
                <span className="text-slate-500">/ 10.00s</span>
              </div>
              <Badge variant={testRunning ? "default" : "secondary"}>
                {testRunning ? (clickPhase === "flight" ? "⬆ Recording Flight" : "⬇ Recording Contact") : "Ready"}
              </Badge>
            </div>

            {testRunning && (
              <div className="flex flex-col items-center gap-3 p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
                <Button onClick={handleTimerClick} size="lg" className="w-full h-24 text-xl font-bold bg-blue-600 hover:bg-blue-700">
                  {clickPhase === "flight" ? "🦵 TAKEOFF — Click Now" : "📍 LANDED — Click Now"}
                </Button>
                <p className="text-sm text-slate-600 text-center">Rhythm: <strong>Takeoff → Land → Takeoff → Land…</strong></p>
              </div>
            )}

            {/* Jump Table */}
            {jumps.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3">Recorded Jumps ({jumps.length})</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {jumps.map((jump, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1 grid grid-cols-4 gap-3 items-center">
                        <div>
                          <p className="text-xs text-slate-500">Jump #{index + 1}</p>
                          {jump.flight_time_ms && jump.contact_time_ms && (
                            <Badge className="bg-purple-600 text-white text-xs">RSI: {(jump.flight_time_ms / jump.contact_time_ms).toFixed(3)}</Badge>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Flight (ms)</p>
                          <p className="font-semibold">{jump.flight_time_ms || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Contact (ms)</p>
                          <p className="font-semibold">{jump.contact_time_ms || <span className="text-amber-500 text-xs">Pending…</span>}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Height cm (opt.)</p>
                          <Input type="number" placeholder="e.g. 25" value={jump.jump_height_cm || ""} onChange={e => handleJumpHeightChange(index, e.target.value)} className="h-8" />
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteJump(index)} className="text-red-600 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {validJumps.length > 0 && (
                  <div className="mt-4 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-sm text-slate-600">Valid Jumps</p>
                        <p className="text-3xl font-bold text-blue-600">{validJumps.length}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Best RSI</p>
                        <p className="text-3xl font-bold text-purple-600">{calculateBestRSI().toFixed(3)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Avg RSI</p>
                        <p className="text-3xl font-bold text-indigo-600">{calculateAverageRSI()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Avg Flight</p>
                        <p className="text-3xl font-bold text-teal-600">{Math.round(validJumps.reduce((s, j) => s + j.flight_time_ms, 0) / validJumps.length)} ms</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800"><strong>Note:</strong> Jump height is optional and requires external equipment (jump mat, Optojump, MyJump2 app). Manual entry is available if you have this data.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes & Save */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label htmlFor="notes">Clinical Notes</Label>
              <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Enter any additional observations..." rows={3} />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={onClose}><X className="h-5 w-5 mr-2" />Close</Button>
              <Button onClick={handleSave} disabled={validJumps.length < 1} className="bg-blue-600 hover:bg-blue-700">
                <Save className="h-5 w-5 mr-2" />Save Test Data ({validJumps.length} valid jumps)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}