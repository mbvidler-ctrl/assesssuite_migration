import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, ChevronDown, ChevronUp, Volume2, ExternalLink, Music } from "lucide-react";
import { toast } from "sonner";

// ISWT pace table with shuttle intervals
const ISWT_PACE = [
  { level: 1, speed_m_per_s: 0.50, shuttles: 3, time_per_shuttle_seconds: 12.00 },
  { level: 2, speed_m_per_s: 0.67, shuttles: 4, time_per_shuttle_seconds: 9.00 },
  { level: 3, speed_m_per_s: 0.84, shuttles: 5, time_per_shuttle_seconds: 7.20 },
  { level: 4, speed_m_per_s: 1.01, shuttles: 6, time_per_shuttle_seconds: 6.00 },
  { level: 5, speed_m_per_s: 1.18, shuttles: 7, time_per_shuttle_seconds: 5.14 },
  { level: 6, speed_m_per_s: 1.35, shuttles: 8, time_per_shuttle_seconds: 4.50 },
  { level: 7, speed_m_per_s: 1.52, shuttles: 9, time_per_shuttle_seconds: 4.00 },
  { level: 8, speed_m_per_s: 1.69, shuttles: 10, time_per_shuttle_seconds: 3.60 },
  { level: 9, speed_m_per_s: 1.86, shuttles: 11, time_per_shuttle_seconds: 3.27 },
  { level: 10, speed_m_per_s: 2.03, shuttles: 12, time_per_shuttle_seconds: 3.00 },
  { level: 11, speed_m_per_s: 2.20, shuttles: 13, time_per_shuttle_seconds: 2.77 },
  { level: 12, speed_m_per_s: 2.37, shuttles: 14, time_per_shuttle_seconds: 2.57 }
];

// Utility to create beep sound
const createBeep = (audioCtx, frequency = 1000, duration = 200) => {
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.frequency.value = frequency;
  oscillator.type = "sine";
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration / 1000);
  oscillator.start(audioCtx.currentTime);
  oscillator.stop(audioCtx.currentTime + duration / 1000);
};

export default function IncrementalShuttleWalkTestISWTRunner({ client, onSave, onClose }) {
  const audioContextRef = useRef(null);
  const timerRef = useRef(null);
  const [showInfo, setShowInfo] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [shuttlesCompleted, setShuttlesCompleted] = useState(0);
  const [shuttlesInCurrentLevel, setShuttlesInCurrentLevel] = useState(0);
  const [preHeartRate, setPreHeartRate] = useState("");
  const [preOxygen, setPreOxygen] = useState("");
  const [preDyspnea, setPreDyspnea] = useState("");
  const [postHeartRate, setPostHeartRate] = useState("");
  const [postOxygen, setPostOxygen] = useState("");
  const [postDyspnea, setPostDyspnea] = useState("");
  const [notes, setNotes] = useState("");
  const [testDuration, setTestDuration] = useState(0);
  const [countdownSeconds, setCountdownSeconds] = useState(null);
  const [nextBeepTime, setNextBeepTime] = useState(null);

  // Countdown timer
  useEffect(() => {
    if (isTestRunning && countdownSeconds !== null && countdownSeconds > 0) {
      const timer = setTimeout(() => setCountdownSeconds(countdownSeconds - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdownSeconds, isTestRunning]);

  // Start test after countdown
  useEffect(() => {
    if (isTestRunning && countdownSeconds === 0) {
      playBeep(1000, 300);
      setCountdownSeconds(null);
      setCurrentLevel(1);
      setShuttlesCompleted(0);
      setShuttlesInCurrentLevel(0);
      setTestDuration(0);
      const levelData = ISWT_PACE[0];
      setNextBeepTime(Date.now() + levelData.time_per_shuttle_seconds * 1000);
      startTimer();
    }
  }, [countdownSeconds, isTestRunning]);

  // Main test timer - checks every 100ms if it's time for next beep
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      const now = Date.now();
      if (nextBeepTime && now >= nextBeepTime) {
        handleBeep();
      }
      setTestDuration((prev) => prev + 0.1);
    }, 100);
  };

  const handleBeep = () => {
    playBeep(1000, 100);
    setShuttlesCompleted((prev) => prev + 1);
    setShuttlesInCurrentLevel((prev) => {
      const next = prev + 1;
      const levelData = ISWT_PACE[currentLevel - 1];
      
      // Check if we need to advance to next level
      if (next >= levelData.shuttles) {
        // Advance level
        if (currentLevel < 12) {
          playBeep(800, 150);
          setTimeout(() => playBeep(800, 150), 200);
          setTimeout(() => playBeep(800, 150), 400);
          setCurrentLevel((prev) => prev + 1);
          setShuttlesInCurrentLevel(0);
          // Schedule first shuttle of new level
          const nextLevelData = ISWT_PACE[currentLevel];
          setNextBeepTime(Date.now() + nextLevelData.time_per_shuttle_seconds * 1000);
        } else {
          // Max level reached
          setIsTestRunning(false);
          clearInterval(timerRef.current);
          toast.success("Test completed - maximum level reached!");
        }
      } else {
        // Continue current level
        setNextBeepTime(Date.now() + levelData.time_per_shuttle_seconds * 1000);
      }
      return next;
    });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const playBeep = (frequency = 1000, duration = 200) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    createBeep(audioContextRef.current, frequency, duration);
  };

  const handleStartTest = () => {
    if (!preHeartRate || !preOxygen || !preDyspnea) {
      toast.error("Please enter all pre-test baseline measures.");
      return;
    }
    setIsTestRunning(true);
    setCountdownSeconds(5);
    toast.success("Test starting in 5 seconds. Follow the audio cues.");
  };

  const handleStopTest = () => {
    setIsTestRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const distanceMeters = shuttlesCompleted * 10;
    const assessmentDate = new Date().toISOString().split("T")[0];
    
    const soap = `• Incremental Shuttle Walk Test (ISWT)\n  Distance: ${distanceMeters}m (${shuttlesCompleted} shuttles)\n  Final Level: ${currentLevel}\n  Duration: ${testDuration}s\n\n  Pre-Test Measures:\n    HR: ${preHeartRate} bpm | O₂: ${preOxygen}% | Dyspnea: ${preDyspnea}/10\n\n  Post-Test Measures:\n    HR: ${postHeartRate || "—"} bpm | O₂: ${postOxygen || "—"}% | Dyspnea: ${postDyspnea || "—"}/10${notes ? `\n\n  Stopping Reason: ${notes}` : ""}`;

    onSave({
      result_value: distanceMeters,
      notes,
      assessment_date: assessmentDate,
      additional_data: {
        soap_text: soap,
        measurement_type: "performance",
        distance_m: distanceMeters,
        final_level: currentLevel,
        total_shuttles: shuttlesCompleted,
        duration_seconds: testDuration,
        pre_vitals: { hr: preHeartRate, o2: preOxygen, dyspnea: preDyspnea },
        post_vitals: { hr: postHeartRate, o2: postOxygen, dyspnea: postDyspnea },
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-cyan-50 z-10 p-5 border-b flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Incremental Shuttle Walk Test (ISWT)</h2>
            <p className="text-slate-500 text-sm mt-0.5">10-metre shuttle test with increasing speed</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Collapsible Info */}
          <div className="border border-blue-200 rounded-lg overflow-hidden">
            <button
              className="w-full flex justify-between items-center px-4 py-3 bg-blue-50 text-blue-800 font-semibold text-sm hover:bg-blue-100 transition-colors"
              onClick={() => setShowInfo(!showInfo)}
            >
              <span>📋 Protocol & Resources</span>
              {showInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showInfo && (
              <div className="p-4 text-sm text-slate-700 space-y-3 bg-white">
                <div>
                  <p className="font-semibold text-slate-800 mb-1">How It Works</p>
                  <p className="text-slate-600">Client walks 10m shuttles at progressively increasing speeds guided by audio beeps. Test continues until the client can no longer maintain pace or reaches a stopping criterion (chest pain, dyspnoea, dizziness).</p>
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-slate-800">Resources</p>
                  <div className="grid grid-cols-2 gap-2">
                    <a href="https://www.youtube.com/watch?v=69g77DVHb7w" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Official ISWT Audio
                    </a>
                    <a href="https://www.youtube.com/watch?v=DGQF-_Mlv48" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Demo Video
                    </a>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-slate-800 mb-1">References</p>
                  <p className="text-xs text-slate-600">Singh SJ et al. (1992) Thorax. Probst VS et al. (2012) Respir Med.</p>
                </div>
              </div>
            )}
          </div>

          {/* Pre-Test Measures */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="font-semibold text-slate-800 mb-3">Pre-Test Baseline Measures</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-sm">Heart Rate (bpm)</Label>
                <Input type="number" value={preHeartRate} onChange={e => setPreHeartRate(e.target.value)} disabled={isTestRunning} placeholder="e.g., 72" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">O₂ Saturation (%)</Label>
                <Input type="number" value={preOxygen} onChange={e => setPreOxygen(e.target.value)} disabled={isTestRunning} placeholder="e.g., 97" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Dyspnea (0–10)</Label>
                <Input type="number" value={preDyspnea} onChange={e => setPreDyspnea(e.target.value)} disabled={isTestRunning} placeholder="e.g., 0" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Test Progress */}
          {isTestRunning && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg p-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-3 bg-white rounded-lg border border-indigo-100">
                  <p className="text-xs text-slate-600 mb-1">Level</p>
                  <p className="text-2xl font-bold text-indigo-600">{currentLevel}</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border border-indigo-100">
                  <p className="text-xs text-slate-600 mb-1">Shuttles (Level)</p>
                  <p className="text-2xl font-bold text-blue-600">{shuttlesInCurrentLevel}/{ISWT_PACE[currentLevel - 1].shuttles}</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border border-indigo-100">
                  <p className="text-xs text-slate-600 mb-1">Total Shuttles</p>
                  <p className="text-2xl font-bold text-green-600">{shuttlesCompleted}</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border border-indigo-100">
                  <p className="text-xs text-slate-600 mb-1">Duration</p>
                  <p className="text-2xl font-bold text-purple-600">{testDuration}s</p>
                </div>
              </div>
              {countdownSeconds !== null && (
                <div className="text-center mt-3">
                  <p className="text-lg font-bold text-indigo-700 animate-pulse">Starting in {countdownSeconds}s...</p>
                  <p className="text-sm text-indigo-600 mt-1">Get ready to follow the audio beeps</p>
                </div>
              )}
              {isTestRunning && countdownSeconds === null && (
                <div className="text-center mt-3">
                  <p className="text-sm font-semibold text-indigo-600">Follow the beeps! 🎵</p>
                  <p className="text-xs text-indigo-500 mt-1">Next beep in {nextBeepTime ? Math.round((nextBeepTime - Date.now()) / 1000) : 0}s</p>
                </div>
              )}
            </div>
          )}

          {/* Post-Test Measures (shown after test) */}
          {!isTestRunning && shuttlesCompleted > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="font-semibold text-slate-800 mb-3">Post-Test Measures</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm">Heart Rate (bpm)</Label>
                  <Input type="number" value={postHeartRate} onChange={e => setPostHeartRate(e.target.value)} placeholder="e.g., 95" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">O₂ Saturation (%)</Label>
                  <Input type="number" value={postOxygen} onChange={e => setPostOxygen(e.target.value)} placeholder="e.g., 95" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">Dyspnea (0–10)</Label>
                  <Input type="number" value={postDyspnea} onChange={e => setPostDyspnea(e.target.value)} placeholder="e.g., 5" className="mt-1" />
                </div>
              </div>
            </div>
          )}

          {/* Clinical Notes */}
          <div>
            <Label className="text-sm font-semibold">Clinical Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Gait quality, balance, stopping reason..." rows={2} className="mt-1" />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-slate-50 flex justify-between items-center gap-2">
          <span className="text-sm text-slate-500">{shuttlesCompleted > 0 ? `${shuttlesCompleted * 10}m completed` : "Ready to start"}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {!isTestRunning && shuttlesCompleted === 0 ? (
              <Button onClick={handleStartTest} disabled={!preHeartRate || !preOxygen || !preDyspnea} className="bg-blue-600 hover:bg-blue-700">
                <Play className="w-4 h-4 mr-2" />Start Test
              </Button>
            ) : isTestRunning ? (
              <Button onClick={handleStopTest} variant="destructive">
                <X className="w-4 h-4 mr-2" />Stop Test
              </Button>
            ) : (
              <Button onClick={handleStopTest} className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" />Save Results
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}