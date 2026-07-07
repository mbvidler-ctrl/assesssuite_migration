import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Play, Pause, Square, ChevronDown, ChevronUp, Save, X, Info } from "lucide-react";
import { toast } from "sonner";

const STOP_REASONS = [
  "Unable to maintain pace",
  "Severe dyspnoea",
  "Chest pain",
  "Dizziness / pallor / concerning symptoms",
  "SpO2 drop beyond safety threshold",
  "Client requested to stop",
  "Clinician stopped for safety",
  "Completed maximum allowed time"
];

export default function EnduranceShuttleWalkTestESWTRunner({ client, onSave, onClose }) {
  const [step, setStep] = useState("overview"); // overview, pre-test, speed-selection, during-test, post-test
  const [expandedSection, setExpandedSection] = useState(null);
  const [quickMode, setQuickMode] = useState(false);

  // Pre-test
  const [restingHR, setRestingHR] = useState("");
  const [restingBP, setRestingBP] = useState("");
  const [restingSpO2, setRestingSpO2] = useState("");
  const [baselineDyspnoea, setBaselineDyspnoea] = useState("");
  const [baselineLegFatigue, setBaselineLegFatigue] = useState("");
  const [chestPain, setChestPain] = useState("no");
  const [dizziness, setDizziness] = useState("no");
  const [recentIllness, setRecentIllness] = useState("no");
  const [walkingAid, setWalkingAid] = useState("no");
  const [oxygenTherapy, setOxygenTherapy] = useState("no");
  const [preTestNotes, setPreTestNotes] = useState("");

  // Speed selection
  const [iswtCompleted, setIswtCompleted] = useState("no");
  const [iswtResult, setIswtResult] = useState("");
  const [selectedSpeed, setSelectedSpeed] = useState("");
  const [speedReason, setSpeedReason] = useState("");

  // During test
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [shuttleCount, setShuttleCount] = useState(0);
  const timerRef = useRef(null);

  // Post-test
  const [stopReason, setStopReason] = useState("");
  const [postHR, setPostHR] = useState("");
  const [postSpO2, setPostSpO2] = useState("");
  const [postBP, setPostBP] = useState("");
  const [postDyspnoea, setPostDyspnoea] = useState("");
  const [postLegFatigue, setPostLegFatigue] = useState("");
  const [adverseEvents, setAdverseEvents] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");

  // Timer
  useEffect(() => {
    if (isTestRunning) {
      timerRef.current = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTestRunning]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const calculateEstimatedDistance = () => {
    if (!selectedSpeed || !timeElapsed) return 0;
    const speedKmh = parseFloat(selectedSpeed);
    const timeHours = timeElapsed / 3600;
    return (speedKmh * timeHours * 1000).toFixed(0); // metres
  };

  const handleStartTest = () => {
    if (!selectedSpeed) {
      toast.error("Please complete speed selection first.");
      return;
    }
    setIsTestRunning(true);
    setTimeElapsed(0);
    setShuttleCount(0);
  };

  const handleStopTest = () => {
    setIsTestRunning(false);
    setStep("post-test");
  };

  const handleSave = () => {
    if (!stopReason) {
      toast.error("Please select a stop reason.");
      return;
    }

    const estimatedDistance = calculateEstimatedDistance();

    const soapText = `• Endurance Shuttle Walk Test (ESWT)

Pre-Test Assessment:
  HR: ${restingHR || "not recorded"} bpm | BP: ${restingBP || "not recorded"} | SpO2: ${restingSpO2 || "not recorded"}%
  Dyspnoea: ${baselineDyspnoea || "0"}/10 | Leg Fatigue: ${baselineLegFatigue || "0"}/10
  Safety: Chest pain: ${chestPain} | Dizziness: ${dizziness} | Recent illness: ${recentIllness}
  Walking aid: ${walkingAid} | Oxygen therapy: ${oxygenTherapy}
  ${preTestNotes ? `Notes: ${preTestNotes}` : ""}

Test Parameters:
  ISWT Completed: ${iswtCompleted}
  ${iswtCompleted === "yes" ? `ISWT Result: ${iswtResult}` : "No prior ISWT"}
  Selected Speed: ${selectedSpeed} km/h (${speedReason || "standard"})\

Test Execution:
  Duration: ${formatTime(timeElapsed)} (${timeElapsed} seconds)
  Estimated Distance: ${estimatedDistance}m
  Shuttles Completed: ${shuttleCount}
  Stop Reason: ${stopReason}

Post-Test Assessment:
  HR: ${postHR || "not recorded"} bpm | BP: ${postBP || "not recorded"} | SpO2: ${postSpO2 || "not recorded"}%
  Dyspnoea: ${postDyspnoea || "not recorded"}/10 | Leg Fatigue: ${postLegFatigue || "not recorded"}/10
  ${adverseEvents ? `Adverse Events: ${adverseEvents}` : "No adverse events"}

Interpretation:
  Endurance capacity: ${
    timeElapsed < 120 ? "Very low (<120s) — significant limitation" :
    timeElapsed < 300 ? "Reduced (120–300s) — mild-moderate limitation" :
    timeElapsed < 600 ? "Moderate (300–600s) — reasonable tolerance" :
    "Better endurance (>600s) — improved functional tolerance"
  }
  Responsiveness: Suitable for reassessment post-rehabilitation or intervention monitoring.
  Note: Interpret relative to client baseline and clinical context, not population norms.
  ${clinicalNotes ? `\nClinical Notes: ${clinicalNotes}` : ""}`;

    onSave({
      result_value: timeElapsed || 0,
      notes: clinicalNotes,
      additional_data: {
        soap_text: soapText,
        endurance_time_seconds: timeElapsed,
        endurance_time_display: formatTime(timeElapsed),
        estimated_distance_metres: estimatedDistance,
        shuttles_completed: shuttleCount,
        iswt_completed: iswtCompleted,
        iswt_result: iswtResult,
        selected_speed: selectedSpeed,
        stop_reason: stopReason,
        post_hr: postHR,
        post_spo2: postSpO2,
        post_bp: postBP,
        post_dyspnoea: postDyspnoea,
        post_leg_fatigue: postLegFatigue,
        adverse_events: adverseEvents,
      },
    });

    toast.success("ESWT assessment saved successfully.");
    onClose();
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const CollapsibleSection = ({ title, section, children, compact = false }) => (
    <div className={`border border-slate-200 rounded-lg overflow-hidden ${compact ? "bg-slate-50" : ""}`}>
      <button
        onClick={() => toggleSection(section)}
        className="w-full bg-slate-50 hover:bg-slate-100 p-3 flex justify-between items-center transition-colors"
      >
        <h3 className={`${compact ? "text-sm" : "text-base"} font-semibold text-slate-900`}>{title}</h3>
        {expandedSection === section ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expandedSection === section && <div className="p-4 border-t border-slate-200 space-y-4">{children}</div>}
    </div>
  );

  // OVERVIEW STEP
  if (step === "overview") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-white flex justify-between items-start sticky top-0 z-10">
            <div>
              <h1 className="text-2xl font-bold">Endurance Shuttle Walk Test</h1>
              <p className="text-blue-100 text-sm mt-1">ESWT — Respiratory / Functional Capacity Assessment</p>
            </div>
            <button onClick={onClose} className="text-white text-2xl leading-none hover:opacity-80">×</button>
          </div>

          <div className="p-6 space-y-6">
            {/* Purpose */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h2 className="font-semibold text-slate-900 mb-2">Assessment Purpose</h2>
              <p className="text-sm text-slate-700 mb-3">
                The ESWT measures constant-paced endurance capacity in individuals with chronic respiratory disease, cardiopulmonary conditions, and those undergoing pulmonary rehabilitation. Unlike the ISWT which incrementally increases pace, the ESWT maintains a fixed speed to assess sustained functional capacity.
              </p>
              <p className="text-xs text-slate-600 italic">Clinical Uses: Baseline assessment, post-rehabilitation responsiveness, longitudinal monitoring, intervention effectiveness evaluation.</p>
            </div>

            {/* ISWT vs ESWT */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 text-sm mb-2">Incremental Shuttle Walk Test (ISWT)</h3>
                <ul className="text-xs text-slate-700 space-y-1">
                  <li>• Increasing pace each minute</li>
                  <li>• Pace increases by 0.5 km/h/min</li>
                  <li>• Identifies peak walking speed</li>
                  <li>• Test until exhaustion</li>
                  <li>• Provides baseline speed for ESWT</li>
                </ul>
              </div>
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 text-sm mb-2">Endurance Shuttle Walk Test (ESWT)</h3>
                <ul className="text-xs text-slate-700 space-y-1">
                  <li>• Constant fixed pace</li>
                  <li>• Usually 85% of peak ISWT speed</li>
                  <li>• Can be based on clinical judgment</li>
                  <li>• Test to symptom limitation</li>
                  <li>• Assesses sustained endurance</li>
                </ul>
              </div>
            </div>

            {/* Quick Start */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quickMode}
                  onChange={(e) => setQuickMode(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span className="text-sm font-medium text-slate-900">Quick Mode — Minimize instructions for experienced clinicians</span>
              </label>
            </div>

            {/* Equipment & Setup */}
            <CollapsibleSection title="🛠 Equipment & Setup" section="setup">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="font-semibold text-slate-900 text-sm mb-3">Equipment Required</p>
                  <ul className="space-y-2 text-sm text-slate-700">
                    <li className="flex gap-2"><span>•</span> <span>10m flat indoor course</span></li>
                    <li className="flex gap-2"><span>•</span> <span>Two cones/markers</span></li>
                    <li className="flex gap-2"><span>•</span> <span>Standardised ESWT audio track</span></li>
                    <li className="flex gap-2"><span>•</span> <span>Pulse oximeter</span></li>
                    <li className="flex gap-2"><span>•</span> <span>Borg Dyspnoea Scale</span></li>
                    <li className="flex gap-2"><span>•</span> <span>Blood pressure monitor</span></li>
                    <li className="flex gap-2"><span>•</span> <span>Chair nearby (recovery)</span></li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm mb-3">Course Setup</p>
                  <div className="bg-white border border-slate-200 rounded p-3 mb-3">
                    <p className="text-xs text-slate-600 font-mono text-center">
                      Cone A ————— 10m ————— Cone B<br/>
                      (Start)                                    (Turn)
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-700">
                    <li>• Flat, safe walking surface</li>
                    <li>• Clear turns at cones</li>
                    <li>• Audio within earshot</li>
                    <li>• Clinician positioned for safety</li>
                  </ul>
                </div>
              </div>
            </CollapsibleSection>

            {/* Audio & Licensing */}
            <CollapsibleSection title="🔊 Audio & Licensing" section="audio">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-amber-900 mb-2">Official ESWT Audio Required</p>
                <p className="text-sm text-amber-800 mb-3">
                  The ESWT requires standardised shuttle-walk audio. Do not use generic metronomes or recreated audio files.
                </p>
                <p className="text-sm text-slate-700 mb-2">
                  <strong>Audio Source:</strong> Obtain official ESWT audio through your organisation's licensed provider or approved respiratory testing resource.
                </p>
                <p className="text-xs text-slate-600 italic">
                  For NHS England clinicians, contact your respiratory physiology department for current approved audio sources and licensing information.
                </p>
              </div>
            </CollapsibleSection>

            {/* References */}
            <CollapsibleSection title="📚 References & Evidence" section="references">
              <ul className="space-y-3 text-xs text-slate-700">
                <li>
                  <strong>Revill SM, Morgan MDL, Singh SJ, Hardman AE, Steele IC, Walters DJ.</strong> The endurance shuttle walk: a new field test for the assessment of endurance capacity in COPD. <em>Thorax</em> 1999;54(3):213–222.{" "}
                  <a href="https://thorax.bmj.com/content/54/3/213" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Thorax Journal
                  </a>
                </li>
                <li>
                  <strong>Holland AE, Spruit MA, Troosters T, et al.</strong> An official ERS/ATS technical standard: field walking tests in chronic respiratory disease. <em>European Respiratory Journal</em> 2014;44(6):1428–1446.{" "}
                  <a href="https://erj.ersjournals.com/content/44/6/1428" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    ERJ
                  </a>
                </li>
                <li>
                  <strong>Singh SJ, Sodergren SC, Hyland ME, Williams JAG, Morgan MDL.</strong> A comparison of three disability measures in patients with chronic airway obstruction. <em>European Respiratory Journal</em> 1997;10:2779–2784.{" "}
                  <a href="https://erj.ersjournals.com/content/10/12/2779" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    ERJ
                  </a>
                </li>
                <li>
                  <strong>Spruit MA, Singh SJ, Garvey C, et al.</strong> An official ATS/ERS statement on pulmonary rehabilitation. <em>American Journal of Respiratory and Critical Care Medicine</em> 2013;188(8):e13–e64.{" "}
                  <a href="https://www.atsjournals.org/doi/full/10.1164/rccm.201309-1634ST" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    AJRCCM
                  </a>
                </li>
              </ul>
            </CollapsibleSection>

            {/* Proceed */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                <X className="w-4 h-4 mr-2" />Cancel
              </Button>
              <Button onClick={() => setStep("pre-test")} className="flex-1 bg-blue-600 hover:bg-blue-700">
                Begin Assessment →
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MAIN TEST MODAL
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[95vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-white flex justify-between items-start sticky top-0 z-10">
          <div>
            <h1 className="text-2xl font-bold">ESWT Test Runner</h1>
            <p className="text-blue-100 text-sm mt-1">Step {step === "pre-test" ? "1" : step === "speed-selection" ? "2" : step === "during-test" ? "3" : "4"}</p>
          </div>
          <button onClick={onClose} className="text-white text-2xl leading-none hover:opacity-80">×</button>
        </div>

        <div className="p-6 space-y-6">
          {/* PRE-TEST SCREENING */}
          {step === "pre-test" && (
            <>
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4">Pre-Test Safety Screening</h2>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm text-blue-900">
                  <p>Do not proceed if the client has unstable vitals, ongoing chest pain, or falls outside local safety parameters.</p>
                </div>
              </div>

              {!quickMode && (
                <CollapsibleSection title="📋 Baseline Vitals & Symptoms" section="vitals" compact>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-slate-700">Resting HR (bpm)</Label>
                      <Input value={restingHR} onChange={(e) => setRestingHR(e.target.value)} placeholder="e.g., 78" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-700">Resting BP (mmHg)</Label>
                      <Input value={restingBP} onChange={(e) => setRestingBP(e.target.value)} placeholder="e.g., 120/80" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-700">Resting SpO₂ (%)</Label>
                      <Input value={restingSpO2} onChange={(e) => setRestingSpO2(e.target.value)} placeholder="e.g., 96" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-700">Baseline Dyspnoea (0–10)</Label>
                      <Input type="number" min="0" max="10" value={baselineDyspnoea} onChange={(e) => setBaselineDyspnoea(e.target.value)} className="mt-1" />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs font-medium text-slate-700">Baseline Leg Fatigue (0–10)</Label>
                      <Input type="number" min="0" max="10" value={baselineLegFatigue} onChange={(e) => setBaselineLegFatigue(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                </CollapsibleSection>
              )}

              {!quickMode && (
                <CollapsibleSection title="⚠ Safety Screening" section="safety" compact>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Chest pain or angina present?", value: chestPain, setter: setChestPain },
                      { label: "Dizziness or light-headedness?", value: dizziness, setter: setDizziness },
                      { label: "Recent acute illness or exacerbation?", value: recentIllness, setter: setRecentIllness },
                      { label: "Uses walking aid?", value: walkingAid, setter: setWalkingAid },
                      { label: "On supplemental oxygen?", value: oxygenTherapy, setter: setOxygenTherapy },
                    ].map((item, idx) => (
                      <div key={idx}>
                        <Label className="text-xs font-medium text-slate-700">{item.label}</Label>
                        <div className="flex gap-2 mt-1">
                          {["no", "yes"].map((opt) => (
                            <button
                              key={opt}
                              onClick={() => item.setter(opt)}
                              className={`flex-1 py-2 px-2 rounded text-xs font-medium transition ${
                                item.value === opt
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                              }`}
                            >
                              {opt.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700 mt-3 block">Additional Notes (if needed)</Label>
                    <Textarea value={preTestNotes} onChange={(e) => setPreTestNotes(e.target.value)} rows={2} className="mt-1" placeholder="e.g., Client on nebuliser, recent exacerbation, etc." />
                  </div>
                </CollapsibleSection>
              )}

              {/* Check for critical concerns */}
              {(chestPain === "yes" || (restingSpO2 && parseFloat(restingSpO2) < 85)) && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-900">
                    <p className="font-semibold">⚠ Safety Concern Detected</p>
                    <p className="mt-1">
                      {chestPain === "yes" && "Chest pain reported. Do not proceed. Review with clinician."}
                      {restingSpO2 && parseFloat(restingSpO2) < 85 && " SpO₂ critically low. Assess safety before proceeding."}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("overview")}>
                  Back
                </Button>
                <Button onClick={() => setStep("speed-selection")} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  Proceed to Speed Selection →
                </Button>
              </div>
            </>
          )}

          {/* SPEED SELECTION */}
          {step === "speed-selection" && (
            <>
              <h2 className="text-xl font-bold text-slate-900">Step 2: ISWT & Speed Selection</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-slate-900">Prior ISWT Completed?</Label>
                  <div className="flex gap-2 mt-2">
                    {["no", "yes"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setIswtCompleted(opt)}
                        className={`flex-1 py-2 px-3 rounded text-sm font-medium transition ${
                          iswtCompleted === opt
                            ? "bg-blue-600 text-white"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        }`}
                      >
                        {opt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {iswtCompleted === "yes" && (
                  <div>
                    <Label className="text-sm font-semibold text-slate-900">ISWT Result</Label>
                    <Input value={iswtResult} onChange={(e) => setIswtResult(e.target.value)} placeholder="e.g., 450m level 4 / 4.5 km/h" className="mt-2" />
                  </div>
                )}
              </div>

              {iswtCompleted === "no" && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-amber-900">⚠ No ISWT Completed</p>
                  <p className="text-sm text-amber-800 mt-2">
                    ESWT speed selection will be based on clinical judgment. Consider completing ISWT first for standardised speed derivation.
                  </p>
                </div>
              )}

              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <h3 className="font-semibold text-slate-900 mb-3 text-sm">Select ESWT Walking Speed</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">ESWT Speed (km/h)</Label>
                    <Input value={selectedSpeed} onChange={(e) => setSelectedSpeed(e.target.value)} placeholder="e.g., 3.8" className="mt-2" />
                    <p className="text-xs text-slate-600 mt-1">Typically 85% of peak ISWT speed, or clinically determined</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">How Speed Was Selected</Label>
                    <Input value={speedReason} onChange={(e) => setSpeedReason(e.target.value)} placeholder="e.g., 85% of ISWT peak speed 4.5 km/h" className="mt-2" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("pre-test")}>
                  Back
                </Button>
                <Button onClick={() => setStep("during-test")} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  Begin Test →
                </Button>
              </div>
            </>
          )}

          {/* DURING TEST */}
          {step === "during-test" && (
            <>
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">Step 3: Test Execution</h2>
                <p className="text-sm text-slate-600">Walking speed: <strong>{selectedSpeed} km/h</strong></p>
              </div>

              {/* Large Timer */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 text-white text-center space-y-6">
                <div className="text-sm text-slate-300 font-medium">ELAPSED TIME</div>
                <div className="text-7xl font-mono font-bold tracking-wider">{formatTime(timeElapsed)}</div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-400 mb-1">Shuttles</div>
                    <div className="text-3xl font-bold">{shuttleCount}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 mb-1">Est. Distance</div>
                    <div className="text-3xl font-bold">{calculateEstimatedDistance()}m</div>
                  </div>
                </div>
              </div>

              {/* Controls */}
              {!isTestRunning ? (
                <Button onClick={handleStartTest} className="w-full bg-green-600 hover:bg-green-700 h-12 text-base">
                  <Play className="w-5 h-5 mr-2" />Start Test
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900 bg-blue-50 border border-blue-200 rounded p-3">
                    Monitor: pace accuracy, symptoms, SpO₂ saturation, distress, gait quality
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button onClick={() => setIsTestRunning(false)} className="bg-yellow-600 hover:bg-yellow-700 h-10">
                      <Pause className="w-4 h-4 mr-2" />Pause
                    </Button>
                    <Button onClick={() => setShuttleCount((prev) => prev + 1)} className="bg-blue-600 hover:bg-blue-700 h-10">
                      <Square className="w-4 h-4 mr-2" />+1 Shuttle
                    </Button>
                  </div>
                  <Button onClick={handleStopTest} className="w-full bg-red-600 hover:bg-red-700 h-10">
                    <AlertTriangle className="w-4 h-4 mr-2" />Stop Test
                  </Button>
                </div>
              )}

              {/* Runtime Notes (Optional) */}
              {isTestRunning && (
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <p className="text-xs text-slate-600 font-medium mb-2">Quick Note (optional)</p>
                  <Input placeholder="e.g., Coughing episode, good pace maintenance, desaturation noted..." className="text-sm" />
                </div>
              )}
            </>
          )}

          {/* POST-TEST */}
          {step === "post-test" && (
            <>
              <h2 className="text-xl font-bold text-slate-900 mb-4">Step 4: Post-Test Results & Interpretation</h2>

              {/* Results Summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-900 mb-2">✓ Test Completed</p>
                <p className="text-sm text-green-800">
                  Duration: <strong>{formatTime(timeElapsed)}</strong> | Distance: <strong>{calculateEstimatedDistance()}m</strong> | Shuttles: <strong>{shuttleCount}</strong>
                </p>
              </div>

              {/* Stop Reason */}
              <div>
                <Label className="text-sm font-semibold text-slate-900">Reason Test Stopped *</Label>
                <select
                  value={stopReason}
                  onChange={(e) => setStopReason(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg mt-2 text-sm"
                >
                  <option value="">Select a reason...</option>
                  {STOP_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              {/* Post-Test Vitals */}
              <CollapsibleSection title="📊 Post-Test Vitals" section="post-vitals" compact>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Post HR (bpm) *</Label>
                    <Input value={postHR} onChange={(e) => setPostHR(e.target.value)} placeholder="e.g., 124" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Post SpO₂ (%) *</Label>
                    <Input value={postSpO2} onChange={(e) => setPostSpO2(e.target.value)} placeholder="e.g., 91" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Post BP (mmHg)</Label>
                    <Input value={postBP} onChange={(e) => setPostBP(e.target.value)} placeholder="e.g., 140/88" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Post Dyspnoea (0–10)</Label>
                    <Input type="number" min="0" max="10" value={postDyspnoea} onChange={(e) => setPostDyspnoea(e.target.value)} className="mt-1" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs font-medium text-slate-700">Post Leg Fatigue (0–10)</Label>
                    <Input type="number" min="0" max="10" value={postLegFatigue} onChange={(e) => setPostLegFatigue(e.target.value)} className="mt-1" />
                  </div>
                </div>
              </CollapsibleSection>

              {/* Additional Notes */}
              <CollapsibleSection title="📝 Clinical Observations" section="notes" compact>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Adverse Events (if any)</Label>
                    <Textarea value={adverseEvents} onChange={(e) => setAdverseEvents(e.target.value)} rows={2} className="mt-1" placeholder="e.g., No adverse events / Client reported sharp chest pain at 4:20 / Severe desaturation..." />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Clinical Notes & Interpretation</Label>
                    <Textarea value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} rows={3} className="mt-1" placeholder="Key observations: pace adherence, symptom progression, functional response, compar­ison to prior ESWT, recommendations..." />
                  </div>
                </div>
              </CollapsibleSection>

              {/* Interpretation Guidance */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">Clinical Interpretation Guide</p>
                <div className="space-y-2 text-sm text-blue-800">
                  <p>
                    <strong>Endurance Capacity:</strong> {
                      timeElapsed < 120 ? "Very low (<2 min) — significant functional limitation" :
                      timeElapsed < 300 ? "Reduced (2–5 min) — mild-moderate limitation" :
                      timeElapsed < 600 ? "Moderate (5–10 min) — reasonable functional tolerance" :
                      "Better endurance (>10 min) — improved functional capacity"
                    }
                  </p>
                  <p className="text-xs italic">
                    ℹ Interpret relative to client baseline and prior ESWT results. ESWT is most useful for monitoring responsiveness to rehabilitation or intervention, not for comparing against population norms.
                  </p>
                </div>
              </div>

              {/* Save */}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep("during-test")}>
                  Back
                </Button>
                <Button onClick={handleSave} className="flex-1 bg-green-600 hover:bg-green-700">
                  <Save className="w-4 h-4 mr-2" />Save Assessment
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}