import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Save, Trash2, Info, Timer, Play } from "lucide-react";
import { toast } from "sonner";

export default function RepeatedJumpRunner({ onSave, onClose }) {
  const [testRunning, setTestRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [clickPhase, setClickPhase] = useState("ready"); // ready, flight, contact
  const [currentFlightStart, setCurrentFlightStart] = useState(null);
  const [currentContactStart, setCurrentContactStart] = useState(null);
  const [jumps, setJumps] = useState([]);
  const [notes, setNotes] = useState('');
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
    toast.info("Test started! Click to record flight time end.");
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
      
      setJumps(prev => [...prev, { 
        jump_number: prev.length + 1,
        flight_time_ms: Math.round(flightTime),
        contact_time_ms: null,
        jump_height_cm: null,
        rsi: null
      }]);
      
    } else if (clickPhase === "contact") {
      const contactTime = now - currentContactStart;
      
      setJumps(prev => {
        const updated = [...prev];
        const lastJump = updated[updated.length - 1];
        lastJump.contact_time_ms = Math.round(contactTime);
        lastJump.rsi = parseFloat((lastJump.flight_time_ms / lastJump.contact_time_ms).toFixed(3));
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

  const calculateBestRSI = () => {
    if (jumps.length === 0) return 0;
    return Math.max(...jumps.map(j => j.rsi));
  };

  const calculateAverageRSI = () => {
    if (jumps.length === 0) return 0;
    const sum = jumps.reduce((acc, j) => acc + j.rsi, 0);
    return (sum / jumps.length).toFixed(3);
  };

  const handleSave = () => {
    const validJumps = jumps.filter(j => j.flight_time_ms && j.contact_time_ms && j.rsi);
    const bestRSI = Math.max(...validJumps.map(j => j.rsi));
    const avgRSI = parseFloat((validJumps.reduce((sum, j) => sum + j.rsi, 0) / validJumps.length).toFixed(3));
    const avgFlightTime = Math.round(validJumps.reduce((sum, j) => sum + j.flight_time_ms, 0) / validJumps.length);
    const avgContactTime = Math.round(validJumps.reduce((sum, j) => sum + j.contact_time_ms, 0) / validJumps.length);
    
    // Calculate fatigue index if jump heights are provided
    const jumpHeights = validJumps.filter(j => j.jump_height_cm).map(j => j.jump_height_cm);
    let fatigueIndex = null;
    if (jumpHeights.length > 1) {
      const highestJump = Math.max(...jumpHeights);
      const lowestJump = Math.min(...jumpHeights);
      fatigueIndex = parseFloat(((highestJump - lowestJump) / highestJump * 100).toFixed(1));
    }

    const soapText = [
      `• 10-s Repeated Jump Test (RSI)`,
      `  Total Jumps: ${validJumps.length}`,
      `  Best RSI: ${bestRSI.toFixed(3)} | Average RSI: ${avgRSI}`,
      `  Avg Flight Time: ${avgFlightTime}ms | Avg Contact Time: ${avgContactTime}ms`,
      fatigueIndex !== null ? `  Fatigue Index: ${fatigueIndex}%` : null,
      notes ? `  Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: bestRSI,
      additional_data: {
        soap_text: soapText,
        jumps: validJumps,
        best_rsi: bestRSI,
        average_rsi: avgRSI,
        total_jumps: validJumps.length,
        average_flight_time_ms: avgFlightTime,
        average_contact_time_ms: avgContactTime,
        jump_heights_cm: jumpHeights.length > 0 ? jumpHeights : null,
        fatigue_index: fatigueIndex,
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
    toast.success("Test data saved successfully!");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-orange-50 to-red-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">10-s Repeated Jump Test</h2>
              <p className="text-slate-600 mt-1">Reactive Strength Index assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Test Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>Setup:</strong> Force plate or jump mat, hands on hips throughout</p>
                <p><strong>Protocol:</strong> 1 preparatory countermovement jump, then 10 maximal continuous bilateral rebound jumps</p>
                <p><strong>Goal:</strong> Minimize ground contact time, maximize jump height</p>
                <p><strong>RSI Calculation:</strong> Flight Time (ms) ÷ Contact Time (ms)</p>
                <p className="text-xs italic pt-2 border-t border-blue-300">
                  References: Louder et al. (2021), Southey et al. (2020), Doyle et al. (2021)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Interactive Timer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg">
                  <div className="flex items-center gap-4">
                    {!testRunning ? (
                      <Button onClick={handleStartTest} className="bg-green-600 hover:bg-green-700">
                        <Play className="h-5 w-5 mr-2" />
                        Start 10s Test
                      </Button>
                    ) : (
                      <Button onClick={handleStopTest} variant="destructive">
                        <X className="h-5 w-5 mr-2" />
                        Stop Test
                      </Button>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Timer className="h-5 w-5 text-blue-600" />
                      <span className="text-3xl font-bold font-mono">
                        {(elapsedTime / 1000).toFixed(2)}s
                      </span>
                      <span className="text-slate-500">/ 10.00s</span>
                    </div>
                  </div>
                  
                  <Badge variant={testRunning ? "default" : "secondary"} className="text-sm px-3 py-1">
                    {testRunning ? `Recording ${clickPhase === "flight" ? "Flight Time" : "Contact Time"}` : "Ready"}
                  </Badge>
                </div>

                {testRunning && (
                  <div className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border-2 border-blue-300">
                    <Button
                      onClick={handleTimerClick}
                      size="lg"
                      className="w-full h-28 text-2xl font-bold bg-blue-600 hover:bg-blue-700 shadow-lg"
                    >
                      {clickPhase === "flight" ? "⬇ï¸ Click to End Flight Time" : "⬆ï¸ Click to End Contact Time"}
                    </Button>
                    <p className="text-sm text-slate-600 text-center font-medium">
                      Click rhythm: <strong>Flight → Contact → Flight → Contact</strong>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recorded Jumps ({jumps.length}/10)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {jumps.length > 0 ? (
                  <>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {jumps.map((jump, index) => (
                        <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-3">
                          <div className="flex-1 grid grid-cols-4 gap-3">
                            <div>
                              <Label className="text-xs text-slate-500">Jump #{jump.jump_number}</Label>
                              <div className="font-semibold text-sm">
                                {jump.rsi !== null && (
                                  <Badge className="bg-blue-600 text-white">RSI: {jump.rsi}</Badge>
                                )}
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-slate-500">Flight (ms)</Label>
                              <div className="font-semibold">{jump.flight_time_ms || "-"}</div>
                            </div>
                            <div>
                              <Label className="text-xs text-slate-500">Contact (ms)</Label>
                              <div className="font-semibold">{jump.contact_time_ms || "-"}</div>
                            </div>
                            <div>
                              <Label className="text-xs text-slate-500">Height (cm)</Label>
                              <Input
                                type="number"
                                placeholder="Optional"
                                value={jump.jump_height_cm || ""}
                                onChange={(e) => handleJumpHeightChange(index, e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteJump(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-4 mt-4">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <p className="text-sm text-slate-600">Best RSI</p>
                          <p className="text-3xl font-bold text-blue-600">{calculateBestRSI().toFixed(3)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Average RSI</p>
                          <p className="text-3xl font-bold text-purple-600">{calculateAverageRSI()}</p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-slate-500 py-8">No jumps recorded yet. Start the test and click to record.</p>
                )}
                
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> Jump height is optional and typically requires external equipment (e.g., jump mat, Optojump, MyJump2 app, or similar timing systems). Manual entry is available if you have this data from external software.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Jump technique, fatigue, asymmetries, landing mechanics..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave}
            disabled={false}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Jump Test Results
          </Button>
        </div>
      </div>
    </div>
  );
}