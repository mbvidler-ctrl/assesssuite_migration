import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Save, X, Play, Square, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const MAX_SECONDS = 30;

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <Label className="text-sm text-slate-600">{label}</Label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
      >
        <option value="">â€” Select â€”</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function RadioGroup({ label, value, onChange, options }) {
  return (
    <div>
      <Label className="text-sm text-slate-600">{label}</Label>
      <div className="flex flex-wrap gap-2 mt-1">
        {options.map(o => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
              value === o
                ? "bg-blue-600 text-white border-blue-600"
                : "border-slate-300 text-slate-600 hover:border-blue-400"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors font-semibold text-slate-800 text-sm">
          {title}
          {open ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border border-t-0 border-slate-200 rounded-b-lg px-4 py-4 space-y-4 bg-white">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function TimerBlock({ label, timeHeld, setTimeHeld, swayObserved, setSwayObserved, swaySeverity, setSwaySeverity, swayDirection, setSwayDirection }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed(prev => {
          if (prev >= MAX_SECONDS) {
            clearInterval(intervalRef.current);
            setRunning(false);
            setTimeHeld(MAX_SECONDS);
            toast.success(`${label}: 30 seconds reached.`);
            return MAX_SECONDS;
          }
          return prev + 0.1;
        });
      }, 100);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const handleStart = () => {
    setElapsed(0);
    setTimeHeld(null);
    setRunning(true);
  };

  const handleStop = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    const held = parseFloat(elapsed.toFixed(1));
    setTimeHeld(held);
    toast.success(`${label}: ${held}s recorded.`);
  };

  const displayTime = running ? elapsed.toFixed(1) : (timeHeld !== null ? timeHeld : 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="text-4xl font-mono font-bold text-slate-800 w-24">
          {parseFloat(displayTime).toFixed(1)}s
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleStart} disabled={running} className="bg-green-600 hover:bg-green-700">
            <Play className="w-3.5 h-3.5 mr-1" /> Start
          </Button>
          <Button size="sm" onClick={handleStop} disabled={!running} variant="destructive">
            <Square className="w-3.5 h-3.5 mr-1" /> Stop
          </Button>
        </div>
        {timeHeld !== null && !running && (
          <div>
            <span className="text-sm font-medium text-slate-600">Or enter manually: </span>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="30"
              value={timeHeld}
              onChange={e => setTimeHeld(parseFloat(e.target.value) || 0)}
              className="inline-block w-20 h-8 text-sm"
            />
            <span className="text-sm text-slate-500 ml-1">s</span>
          </div>
        )}
        {timeHeld === null && !running && (
          <div className="flex items-center gap-1">
            <span className="text-sm text-slate-500">Manual entry:</span>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="30"
              placeholder="0.0"
              onChange={e => setTimeHeld(parseFloat(e.target.value) || 0)}
              className="w-20 h-8 text-sm"
            />
            <span className="text-sm text-slate-500">s</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
        <RadioGroup
          label="Sway Observed"
          value={swayObserved}
          onChange={setSwayObserved}
          options={["Yes", "No"]}
        />
        <RadioGroup
          label="Sway Severity"
          value={swaySeverity}
          onChange={setSwaySeverity}
          options={["None", "Mild", "Moderate", "Severe"]}
        />
        <RadioGroup
          label="Direction of Sway"
          value={swayDirection}
          onChange={setSwayDirection}
          options={["Anterior/posterior", "Medial/lateral", "Multi-directional", "Not observed"]}
        />
      </div>
    </div>
  );
}

function generateInterpretation(data) {
  const {
    eyesOpenTime, eyesClosedTime,
    ecSwaySeverity, ecSwayObserved,
    lossOfBalance, stepTaken, requiresAssistance, completedFull,
    ecSwayDirection
  } = data;

  if (eyesOpenTime === null && eyesClosedTime === null) return null;

  const eoStr = eyesOpenTime !== null ? `${eyesOpenTime}s` : "not recorded";
  const ecStr = eyesClosedTime !== null ? `${eyesClosedTime}s` : "not recorded";

  const severeEC = ecSwaySeverity === "Moderate" || ecSwaySeverity === "Severe";
  const positiveRomberg = ecSwayObserved === "Yes" && (
    severeEC || lossOfBalance === "Yes" || stepTaken === "Yes" || requiresAssistance === "Yes"
  );
  const fallsRisk = (
    (eyesClosedTime !== null && eyesClosedTime < 30) ||
    lossOfBalance === "Yes" ||
    stepTaken === "Yes" ||
    requiresAssistance === "Yes" ||
    severeEC
  );

  let summary = `Client maintained Romberg stance for ${eoStr} eyes open`;
  if (eyesClosedTime !== null) {
    summary += ` and ${ecStr} eyes closed`;
    if (ecSwayObserved === "Yes" && ecSwaySeverity) {
      summary += `, with ${ecSwaySeverity.toLowerCase()} ${ecSwayDirection ? ecSwayDirection.toLowerCase() + ' ' : ''}sway`;
    }
    if (stepTaken === "Yes") summary += ` and step response`;
    if (lossOfBalance === "Yes") summary += ` and loss of balance`;
    if (requiresAssistance === "Yes") summary += `, requiring clinician assistance`;
  }
  summary += ".";

  if (positiveRomberg) {
    summary += " Findings are consistent with reduced sensory-dependent balance control";
    if (fallsRisk) summary += " and increased falls risk";
    summary += ". Supervision is recommended for balance-based exercise progression.";
  } else if (eyesClosedTime !== null) {
    summary += " Balance was maintained with minimal sway under both visual and non-visual conditions.";
  }

  return {
    summary,
    rombergResult: positiveRomberg ? "Positive Romberg" : "Negative Romberg",
    fallsRisk,
  };
}

export default function RombergsTestofStandingBalanceRunner({ client, onSave, onClose }) {
  // Setup
  const [surfaceType, setSurfaceType] = useState("");
  const [footPosition, setFootPosition] = useState("");
  const [footwear, setFootwear] = useState("");
  const [assistanceLevel, setAssistanceLevel] = useState("");

  // Eyes Open
  const [eoTime, setEoTime] = useState(null);
  const [eoSwayObserved, setEoSwayObserved] = useState("");
  const [eoSwaySeverity, setEoSwaySeverity] = useState("");
  const [eoSwayDirection, setEoSwayDirection] = useState("");

  // Eyes Closed
  const [ecTime, setEcTime] = useState(null);
  const [ecSwayObserved, setEcSwayObserved] = useState("");
  const [ecSwaySeverity, setEcSwaySeverity] = useState("");
  const [ecSwayDirection, setEcSwayDirection] = useState("");

  // Termination
  const [completedFull, setCompletedFull] = useState("");
  const [lossOfBalance, setLossOfBalance] = useState("");
  const [stepTaken, setStepTaken] = useState("");
  const [requiresAssistance, setRequiresAssistance] = useState("");
  const [stopReason, setStopReason] = useState("");

  // Notes
  const [notes, setNotes] = useState("");

  const interp = generateInterpretation({
    eyesOpenTime: eoTime, eyesClosedTime: ecTime,
    eoSwayObserved, eoSwaySeverity, eoSwayDirection,
    ecSwayObserved, ecSwaySeverity, ecSwayDirection,
    completedFull, lossOfBalance, stepTaken, requiresAssistance,
  });

  const handleSave = () => {
    if (eoTime === null && ecTime === null) {
      toast.error("Please record at least one test result.");
      return;
    }

    const result = interp || {};
    const soapLines = [
      `â€¢ Romberg's Test of Standing Balance`,
      surfaceType ? `  Surface: ${surfaceType}` : null,
      footPosition ? `  Foot Position: ${footPosition}` : null,
      footwear ? `  Footwear: ${footwear}` : null,
      assistanceLevel ? `  Assistance Level: ${assistanceLevel}` : null,
      eoTime !== null ? `  Eyes Open: ${eoTime}s${eoSwaySeverity ? ` â€” sway: ${eoSwaySeverity}` : ''}${eoSwayDirection ? ` (${eoSwayDirection})` : ''}` : null,
      ecTime !== null ? `  Eyes Closed: ${ecTime}s${ecSwaySeverity ? ` â€” sway: ${ecSwaySeverity}` : ''}${ecSwayDirection ? ` (${ecSwayDirection})` : ''}` : null,
      lossOfBalance === "Yes" ? `  Loss of Balance: Yes` : null,
      stepTaken === "Yes" ? `  Step Response: Yes` : null,
      requiresAssistance === "Yes" ? `  Required Assistance: Yes` : null,
      stopReason ? `  Reason Stopped: ${stopReason}` : null,
      result.rombergResult ? `  Result: ${result.rombergResult}` : null,
      result.fallsRisk ? `  âš  Increased Falls Risk Identified` : null,
      result.summary ? `\n  Interpretation: ${result.summary}` : null,
      notes ? `  Clinical Notes: ${notes}` : null,
      `  Reference: Romberg MH (1853). Manual of Nervous Diseases of Man. The Sydenham Society, London.`,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: ecTime !== null ? ecTime : eoTime,
      notes,
      assessment_date: new Date().toISOString().split('T')[0],
      additional_data: {
        soap_text: soapLines,
        measurement_type: "Romberg's Test",
        surface_type: surfaceType,
        foot_position: footPosition,
        footwear,
        assistance_level: assistanceLevel,
        eyes_open_time: eoTime,
        eyes_open_sway_observed: eoSwayObserved,
        eyes_open_sway_severity: eoSwaySeverity,
        eyes_open_sway_direction: eoSwayDirection,
        eyes_closed_time: ecTime,
        eyes_closed_sway_observed: ecSwayObserved,
        eyes_closed_sway_severity: ecSwaySeverity,
        eyes_closed_sway_direction: ecSwayDirection,
        completed_full_duration: completedFull,
        loss_of_balance: lossOfBalance,
        step_taken: stepTaken,
        requires_assistance: requiresAssistance,
        stop_reason: stopReason,
        romberg_result: result.rombergResult,
        falls_risk: result.fallsRisk,
        interpretation: result.summary,
      },
    });
    toast.success("Romberg's test results saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Romberg's Test of Standing Balance</h2>
            {client && <p className="text-blue-600 text-sm mt-0.5">Client: {client.full_name}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Clinician Script */}
        <div className="px-5 pt-4 shrink-0">
          <div className="bg-blue-600 text-white rounded-lg p-4 text-sm">
            <p className="font-semibold mb-1">ðŸ’¬ Clinician Script</p>
            <p>"Stand with your feet together and arms by your sides. First keep your eyes open for up to 30 seconds. Then I'll ask you to close your eyes for another 30 seconds. Tell me immediately if you feel like you're going to fall."</p>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {/* Test Setup */}
          <Section title="Test Setup" defaultOpen={true}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                label="Surface Type"
                value={surfaceType}
                onChange={setSurfaceType}
                options={["Firm floor", "Foam pad", "Balance pad", "Uneven surface", "Other"]}
              />
              <SelectField
                label="Foot Position"
                value={footPosition}
                onChange={setFootPosition}
                options={["Feet together", "Semi-tandem", "Tandem", "Single leg", "Other"]}
              />
              <SelectField
                label="Footwear"
                value={footwear}
                onChange={setFootwear}
                options={["Shoes on", "Barefoot", "Orthotics", "Other"]}
              />
              <SelectField
                label="Assistance Level"
                value={assistanceLevel}
                onChange={setAssistanceLevel}
                options={["Independent", "Supervision only", "Contact guard", "Minimal assist", "Moderate assist", "Max assist"]}
              />
            </div>
          </Section>

          {/* Eyes Open */}
          <Section title="ðŸ‘ Eyes Open Result" defaultOpen={true}>
            <TimerBlock
              label="Eyes Open"
              timeHeld={eoTime}
              setTimeHeld={setEoTime}
              swayObserved={eoSwayObserved}
              setSwayObserved={setEoSwayObserved}
              swaySeverity={eoSwaySeverity}
              setSwaySeverity={setEoSwaySeverity}
              swayDirection={eoSwayDirection}
              setSwayDirection={setEoSwayDirection}
            />
          </Section>

          {/* Eyes Closed */}
          <Section title="ðŸ˜Œ Eyes Closed Result" defaultOpen={true}>
            <TimerBlock
              label="Eyes Closed"
              timeHeld={ecTime}
              setTimeHeld={setEcTime}
              swayObserved={ecSwayObserved}
              setSwayObserved={setEcSwayObserved}
              swaySeverity={ecSwaySeverity}
              setSwaySeverity={setEcSwaySeverity}
              swayDirection={ecSwayDirection}
              setSwayDirection={setEcSwayDirection}
            />
          </Section>

          {/* Test Termination */}
          <Section title="Test Termination">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RadioGroup label="Completed Full Duration (30s)" value={completedFull} onChange={setCompletedFull} options={["Yes", "No"]} />
              <RadioGroup label="Loss of Balance" value={lossOfBalance} onChange={setLossOfBalance} options={["Yes", "No"]} />
              <RadioGroup label="Step Taken" value={stepTaken} onChange={setStepTaken} options={["Yes", "No"]} />
              <RadioGroup label="Required Clinician Assistance" value={requiresAssistance} onChange={setRequiresAssistance} options={["Yes", "No"]} />
            </div>
            <SelectField
              label="Reason Test Stopped"
              value={stopReason}
              onChange={setStopReason}
              options={[
                "Completed full duration",
                "Excessive sway",
                "Stepped out",
                "Required assistance",
                "Client felt unsafe",
                "Clinician stopped for safety",
                "Other",
              ]}
            />
          </Section>

          {/* Interpretation */}
          <Section title="Clinical Interpretation" defaultOpen={true}>
            {interp ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge className={interp.rombergResult === "Positive Romberg" ? "bg-orange-100 text-orange-800 border border-orange-300" : "bg-green-100 text-green-800 border border-green-300"}>
                    {interp.rombergResult}
                  </Badge>
                  {interp.fallsRisk && (
                    <Badge className="bg-red-100 text-red-800 border border-red-300 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Increased Falls Risk
                    </Badge>
                  )}
                  {!interp.fallsRisk && (
                    <Badge className="bg-green-100 text-green-800 border border-green-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> No Falls Risk Flag
                    </Badge>
                  )}
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 leading-relaxed italic">
                  {interp.summary}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Record eyes open and/or eyes closed times to generate interpretation.</p>
            )}
          </Section>

          {/* Notes */}
          <Section title="Clinical Notes">
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Functional observations, environmental factors, client-reported symptoms..."
              rows={3}
            />
          </Section>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-slate-50 flex justify-between items-center shrink-0">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}