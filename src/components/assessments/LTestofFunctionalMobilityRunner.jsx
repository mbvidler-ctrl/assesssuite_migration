import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, Info, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function LTestofFunctionalMobilityRunner({ client, onSave, onClose }) {
  const [preVitals, setPreVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [postVitals, setPostVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [trialTimes, setTrialTimes] = useState([]);
  const [currentTrial, setCurrentTrial] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [timer, setTimer] = useState(0);
  const [notes, setNotes] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => setTimer((prev) => parseFloat((prev + 0.1).toFixed(1))), 100);
      return () => clearInterval(interval);
    }
  }, [isRunning]);

  const handleStartTest = () => {
    if (!preVitals.heartRate || !preVitals.bloodPressure) {
      toast.error("Please enter pre-test vitals.");
      return;
    }
    setIsRunning(true);
    setTimer(0);
  };

  const handleStopTest = () => {
    if (!isRunning) return;
    setIsRunning(false);
    setTrialTimes((prev) => [...prev, timer]);
    toast.success(`Trial ${currentTrial} completed: ${(timer / 10).toFixed(1)}s`);
    setCurrentTrial((prev) => prev + 1);
    setTimer(0);
    if (currentTrial >= 3) {
      toast.success("All trials completed!");
    }
  };

  const handleSave = () => {
    if (trialTimes.length < 1) {
      toast.error("Please complete at least one trial.");
      return;
    }
    const trialsInSeconds = trialTimes.map(t => t / 10);
    const resultValue = trialsInSeconds.reduce((acc, time) => acc + time, 0) / trialsInSeconds.length;
    const bestTime = Math.min(...trialsInSeconds);
    
    let soapText = `• L Test of Functional Mobility:\n`;
    soapText += `  Best Time: ${bestTime.toFixed(2)}s\n`;
    soapText += `  Average Time: ${resultValue.toFixed(2)}s over ${trialsInSeconds.length} trial(s)\n`;
    soapText += `  Individual Trials: ${trialsInSeconds.map((t, i) => `Trial ${i+1}: ${t.toFixed(2)}s`).join(', ')}\n`;
    if (preVitals.heartRate) soapText += `  Pre-Test HR: ${preVitals.heartRate} bpm, BP: ${preVitals.bloodPressure}\n`;
    if (postVitals.heartRate) soapText += `  Post-Test HR: ${postVitals.heartRate} bpm, BP: ${postVitals.bloodPressure}\n`;
    if (notes.trim()) soapText += `  Clinical Notes: ${notes}`;
    onSave({ status: "completed", result_value: parseFloat(bestTime.toFixed(2)), additional_data: { measurement_type: "LTestofFunctionalMobility", trials: trialsInSeconds, pre_vitals: preVitals, post_vitals: postVitals, soap_text: soapText }, notes: soapText, assessment_date: todayLocal() });
    toast.success("Assessment recorded — please confirm and save.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-cyan-50 z-10 p-5 border-b flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">L Test of Functional Mobility</h2>
            <p className="text-slate-500 text-sm mt-0.5">Assessment of gait and balance in a 20-meter L-shaped path</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Norms */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
          <p className="font-semibold text-slate-700">📊 Norms & Interpretation</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-300 rounded">
              <thead className="bg-slate-200"><tr><th className="p-2 text-left">Time (s)</th><th className="p-2 text-left">Interpretation</th><th className="p-2 text-left">Population</th></tr></thead>
              <tbody>
                <tr className="border-t"><td className="p-2">&lt;15 s</td><td className="p-2 text-green-700">Good functional mobility</td><td className="p-2">Community ambulators</td></tr>
                <tr className="border-t bg-white"><td className="p-2">15–20 s</td><td className="p-2 text-yellow-700">Moderate limitation</td><td className="p-2">Some functional restriction</td></tr>
                <tr className="border-t"><td className="p-2">&gt;20 s</td><td className="p-2 text-red-700">Significant limitation</td><td className="p-2">Increased fall risk / dependent mobility</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">MCID: ~5 s. L Test = modified TUG using 20m L-shaped course. Used in prosthetics, neurological conditions. Source: Deathe & Miller (2005).</p>
        </div>

        {/* L-Test Setup Diagram */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="font-semibold text-slate-700 mb-3">📐 Test Setup</p>
          <div className="flex justify-center bg-white p-4 rounded border border-slate-300">
            <svg viewBox="0 0 300 300" className="w-64 h-64" xmlns="http://www.w3.org/2000/svg">
              {/* Grid background */}
              <rect width="300" height="300" fill="#fafafa" />
              {/* L-shaped path */}
              <g stroke="#1e40af" strokeWidth="8" fill="none" strokeLinecap="round">
                <line x1="50" y1="250" x2="50" y2="50" />
                <line x1="50" y1="50" x2="250" y2="50" />
              </g>
              {/* Start point */}
              <circle cx="50" cy="250" r="8" fill="#10b981" />
              <text x="50" y="270" fontSize="12" textAnchor="middle" fill="#374151">Start</text>
              {/* Corner point */}
              <circle cx="50" cy="50" r="8" fill="#f59e0b" />
              <text x="50" y="35" fontSize="12" textAnchor="middle" fill="#374151">Turn</text>
              {/* End point */}
              <circle cx="250" cy="50" r="8" fill="#ef4444" />
              <text x="250" y="35" fontSize="12" textAnchor="middle" fill="#374151">End</text>
              {/* Distance labels */}
              <text x="25" y="150" fontSize="10" fill="#6b7280">10m</text>
              <text x="150" y="30" fontSize="10" fill="#6b7280">10m</text>
            </svg>
          </div>
          <p className="text-xs text-slate-600 mt-2">Two 10-meter lines at right angles (90°). Total path distance: 20 meters.</p>
        </div>

        {/* Detailed Instructions */}
        <button
          className="w-full flex justify-between items-center px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg font-semibold text-blue-900 text-sm hover:bg-blue-100 transition-colors"
          onClick={() => setShowDetails(!showDetails)}
        >
          <span className="flex items-center gap-2"><Info className="w-4 h-4" />Full Clinician Instructions & Evidence</span>
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showDetails && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6 space-y-4 text-sm">
              <div>
                <p className="font-semibold text-blue-900 mb-2">Purpose & Application</p>
                <p className="text-blue-800">The L Test is a modification of the Timed Up & Go (TUG) test designed to evaluate functional mobility, balance, and gait control in individuals with lower-limb amputations and other conditions affecting mobility. It assesses dynamic balance during negotiation of a 90° turn, which is more functionally relevant than a straight-line walk.</p>
              </div>
              <div>
                <p className="font-semibold text-blue-900 mb-2">Setup & Equipment</p>
                <ul className="text-blue-800 list-disc list-inside space-y-1">
                  <li>Mark an L-shaped path on a flat, firm surface (e.g., gym floor, corridor).</li>
                  <li>Use 2 parallel lines (tape or rope) forming a 90° angle, each 10 meters long.</li>
                  <li>Ensure adequate clearance (at least 2 meters) on all sides for safety.</li>
                  <li>Stopwatch (or automated timing device).</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-blue-900 mb-2">Detailed Procedure</p>
                <ol className="text-blue-800 list-decimal list-inside space-y-1">
                  <li>Obtain baseline vitals (HR, BP, SpO₂ if indicated).</li>
                  <li>Client stands at the starting point, waiting for the "Go" command.</li>
                  <li>On "Go", the client walks along the L-shaped path (10m down, 90° turn, 10m across) as <strong>quickly and safely as possible</strong>.</li>
                  <li>Start timing when client starts moving; stop when they reach the end point.</li>
                  <li>Allow 1-2 minutes rest between trials.</li>
                  <li>Repeat for 3 trials (some protocols use best of 3).</li>
                  <li>Obtain post-test vitals (HR, BP, SpO₂).</li>
                </ol>
              </div>
              <div>
                <p className="font-semibold text-blue-900 mb-2">Scoring & Interpretation</p>
                <ul className="text-blue-800 list-disc list-inside space-y-1">
                  <li><strong>&lt;15s:</strong> Good functional mobility (minimal fall risk)</li>
                  <li><strong>15–20s:</strong> Moderate functional limitation (some fall risk)</li>
                  <li><strong>&gt;20s:</strong> Significant functional limitation (high fall risk, increased dependence)</li>
                  <li><strong>MCID:</strong> ~5 seconds represents a clinically meaningful change.</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-blue-900 mb-2">Safety Precautions</p>
                <ul className="text-blue-800 list-disc list-inside space-y-1">
                  <li>Always supervise closely. Have a gait aid (walker, crutches) available if needed.</li>
                  <li>Stop the test if client reports chest pain, severe dizziness, or excessive fatigue.</li>
                  <li>Ensure clear, obstacle-free path.</li>
                  <li>Advise client to wear comfortable, supportive footwear.</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-blue-900 mb-2">Evidence & References</p>
                <div className="bg-white p-3 rounded border border-blue-100 space-y-2 text-xs">
                  <p><strong>Primary Reference:</strong> Deathe AB & Miller WC. (2005). The L test of functional mobility: measurement properties of a modified version of the timed "up & go" test designed for people with lower-limb amputations. <em>Physical Therapy, 85</em>(7), 626–635.</p>
                  <p><strong>Key Findings:</strong> Excellent intra-rater reliability (ICC 0.96), good validity for predicting fall risk, responsive to rehabilitation changes in amputee populations.</p>
                  <p><strong>Clinical Use:</strong> Amputee rehabilitation, prosthetic fitting outcomes, neurological conditions, geriatric assessment, return-to-work evaluation.</p>
                  <p><strong>Related:</strong> Modified version of TUG; correlates with single-leg stance time and walking velocity in lower-limb amputees.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
         <CardHeader>
           <CardTitle>L Test of Functional Mobility</CardTitle>
         </CardHeader>
         <CardContent>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Pre-Test Vitals</Label>
              <Input
                type="number"
                placeholder="Heart Rate (bpm)"
                value={preVitals.heartRate}
                onChange={(e) => setPreVitals({ ...preVitals, heartRate: e.target.value })}
                disabled={isRunning}
                className="mb-2"
              />
              <Input
                type="text"
                placeholder="Blood Pressure (mmHg)"
                value={preVitals.bloodPressure}
                onChange={(e) => setPreVitals({ ...preVitals, bloodPressure: e.target.value })}
                disabled={isRunning}
              />
            </div>
            <div>
              <Label>Post-Test Vitals</Label>
              <Input
                type="number"
                placeholder="Heart Rate (bpm)"
                value={postVitals.heartRate}
                onChange={(e) => setPostVitals({ ...postVitals, heartRate: e.target.value })}
                className="mb-2"
              />
              <Input
                type="text"
                placeholder="Blood Pressure (mmHg)"
                value={postVitals.bloodPressure}
                onChange={(e) => setPostVitals({ ...postVitals, bloodPressure: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center space-x-4 mt-4">
            <Button onClick={handleStartTest} disabled={isRunning}>
              <Play className="mr-2" />
              Start Trial {currentTrial}
            </Button>
            <Button onClick={handleStopTest} disabled={!isRunning}>
              <X className="mr-2" />
              Stop Trial
            </Button>
            <Badge variant="outline" className="text-xl">
              {isRunning ? `Time: ${(timer / 10).toFixed(1)}s` : `Trials: ${trialTimes.length}`}
            </Badge>
          </div>
          <div className="mt-4">
            <Label>Trial Log</Label>
            <div className="bg-slate-50 rounded-md p-3 min-h-[60px] border border-slate-200">
              {trialTimes.length === 0 ? (
                <p className="text-slate-500 text-sm">No trials completed yet</p>
              ) : (
                <div className="space-y-2">
                  {trialTimes.map((time, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border-l-4 border-blue-500">
                      <span className="font-medium text-slate-700">Trial {idx + 1}</span>
                      <Badge className="bg-blue-100 text-blue-800">{(time / 10).toFixed(1)}s</Badge>
                    </div>
                  ))}
                  {trialTimes.length > 0 && (
                    <div className="flex justify-between items-center bg-blue-50 p-2 rounded border-l-4 border-blue-600 mt-2">
                      <span className="font-medium text-slate-700">Best Time</span>
                      <Badge className="bg-green-100 text-green-800">{(Math.min(...trialTimes) / 10).toFixed(1)}s</Badge>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any additional notes"
            />
          </div>
          </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-slate-50 flex justify-between items-center gap-2">
          <span className="text-sm text-slate-500">{trialTimes.length} / 3 trials completed</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={trialTimes.length === 0} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />Save Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}