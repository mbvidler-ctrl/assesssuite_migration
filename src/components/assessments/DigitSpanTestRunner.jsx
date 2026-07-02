import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function DigitSpanTestRunner({ client, onSave, onClose }) {
  const [phase, setPhase] = useState("instructions"); // instructions | forward | backward | done
  const [currentSequence, setCurrentSequence] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [trialLength, setTrialLength] = useState(3);
  const [errorCount, setErrorCount] = useState(0);
  const [forwardTrials, setForwardTrials] = useState([]); // [{sequence, response, correct, length}]
  const [backwardTrials, setBackwardTrials] = useState([]);
  const [notes, setNotes] = useState("");
  const inputRef = useRef(null);

  const generateSequence = (length) => {
    const seq = [];
    for (let i = 0; i < length; i++) seq.push(Math.floor(Math.random() * 10));
    return seq;
  };

  const startPhase = (phaseType) => {
    setPhase(phaseType);
    setTrialLength(3);
    setErrorCount(0);
    setUserInput("");
    const seq = generateSequence(3);
    setCurrentSequence(seq);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSubmit = () => {
    const trimmed = userInput.trim();
    if (trimmed.length === 0) return;

    const isForward = phase === "forward";
    let isCorrect;

    if (isForward) {
      isCorrect = trimmed === currentSequence.join("");
    } else {
      // Backward: client repeats the sequence in reverse
      isCorrect = trimmed === [...currentSequence].reverse().join("");
    }

    const trialRecord = {
      sequence: currentSequence,
      response: trimmed,
      correct: isCorrect,
      length: trialLength,
    };

    const setTrials = isForward ? setForwardTrials : setBackwardTrials;
    setTrials(prev => [...prev, trialRecord]);

    setUserInput("");

    if (isCorrect) {
      const nextLength = trialLength + 1;
      setTrialLength(nextLength);
      setErrorCount(0);
      setCurrentSequence(generateSequence(nextLength));
    } else {
      const newErrors = errorCount + 1;
      if (newErrors >= 2) {
        // Two consecutive failures â€” move to next phase or end
        setErrorCount(0);
        if (isForward) {
          // Move to backward phase
          const bwLength = 3;
          setPhase("backward");
          setTrialLength(bwLength);
          setCurrentSequence(generateSequence(bwLength));
          toast.info("Forward span complete. Now starting Backward span.");
        } else {
          setPhase("done");
        }
      } else {
        setErrorCount(newErrors);
        setCurrentSequence(generateSequence(trialLength));
      }
    }

    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSave = () => {
    const fwMax = forwardTrials.filter(t => t.correct).reduce((max, t) => Math.max(max, t.length), 0);
    const bwMax = backwardTrials.filter(t => t.correct).reduce((max, t) => Math.max(max, t.length), 0);

    const fwLines = forwardTrials.map((t, i) =>
      `    Trial ${i + 1} (${t.length} digits): Sequence [${t.sequence.join("-")}] â†’ Client said "${t.response}" â€” ${t.correct ? "âœ“ Correct" : "âœ— Incorrect"}`
    ).join("\n");

    const bwLines = backwardTrials.map((t, i) =>
      `    Trial ${i + 1} (${t.length} digits): Sequence [${t.sequence.join("-")}] (reversed: ${[...t.sequence].reverse().join("-")}) â†’ Client said "${t.response}" â€” ${t.correct ? "âœ“ Correct" : "âœ— Incorrect"}`
    ).join("\n");

    const soapText =
      `â€¢ Digit Span Test:\n` +
      `  Forward Digit Span: Longest correct = ${fwMax} digits\n` +
      (fwLines ? `${fwLines}\n` : "") +
      `  Backward Digit Span: Longest correct = ${bwMax} digits\n` +
      (bwLines ? `${bwLines}\n` : "") +
      `  Interpretation: Forward ${fwMax >= 5 && fwMax <= 7 ? "within" : fwMax < 5 ? "below" : "above"} normal range (5-7), ` +
      `Backward ${bwMax >= 4 && bwMax <= 6 ? "within" : bwMax < 4 ? "below" : "above"} normal range (4-6).`;

    onSave({
      status: "completed",
      result_value: fwMax,
      additional_data: {
        measurement_type: "digit_span_test",
        forward_max: fwMax,
        backward_max: bwMax,
        forward_trials: forwardTrials,
        backward_trials: backwardTrials,
        soap_text: soapText,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Digit Span Test saved.");
  };

  const currentTrials = phase === "forward" ? forwardTrials : backwardTrials;
  const isForwardPhase = phase === "forward";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-xl font-bold text-slate-900">Digit Span Test</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="p-5 space-y-5">

          {/* Instructions */}
          {phase === "instructions" && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm space-y-2">
                <p className="font-semibold text-blue-800">Clinician Instructions</p>
                <p className="text-slate-700">Read each digit sequence aloud to the client at a rate of one digit per second.</p>
                <p className="text-slate-700"><strong>Forward:</strong> Client repeats the digits in the <strong>same order</strong> you read them.</p>
                <p className="text-slate-700"><strong>Backward:</strong> Client repeats the digits in <strong>reverse order</strong>.</p>
                <p className="text-slate-700">Start with 3 digits. Increase by 1 after each correct trial. Two failures at the same length ends that phase.</p>
                <p className="text-slate-700 font-medium">Normal range: Forward 5â€“7 digits, Backward 4â€“6 digits.</p>
              </div>
              <Button onClick={() => startPhase("forward")} className="w-full">
                <Play className="mr-2 w-4 h-4" /> Start Forward Digit Span
              </Button>
            </div>
          )}

          {/* Active Test Phase */}
          {(phase === "forward" || phase === "backward") && (
            <div className="space-y-4">
              {/* Phase indicator */}
              <div className="flex items-center gap-3">
                <Badge className={isForwardPhase ? "bg-blue-600 text-white" : "bg-purple-600 text-white"}>
                  {isForwardPhase ? "Forward Span" : "Backward Span"}
                </Badge>
                <span className="text-sm text-slate-500">
                  {isForwardPhase
                    ? "Client repeats digits in the SAME order"
                    : "Client repeats digits in REVERSE order"}
                </span>
              </div>

              {/* Sequence to read aloud */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Read this sequence aloud to the client:
                </p>
                <div className="flex gap-3 flex-wrap">
                  {currentSequence.map((digit, i) => (
                    <span key={i} className="text-3xl font-bold text-slate-800 w-10 text-center">{digit}</span>
                  ))}
                </div>
                {!isForwardPhase && (
                  <p className="text-xs text-purple-600 mt-2 font-medium">
                    Client should respond: {[...currentSequence].reverse().join(" ")}
                  </p>
                )}
              </div>

              {/* Error indicator */}
              {errorCount > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm text-orange-700">
                  âš ï¸ {errorCount} failure{errorCount > 1 ? "s" : ""} at {trialLength} digits â€” one more failure ends this phase.
                </div>
              )}

              {/* Input */}
              <div>
                <Label className="text-sm font-semibold mb-1 block">
                  Enter client's response (digits only, press Enter to submit):
                </Label>
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    value={userInput}
                    onChange={e => setUserInput(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. 4 7 2 â†’ type 472"
                    className="flex-1"
                    autoFocus
                  />
                  <Button onClick={handleSubmit} disabled={userInput.trim().length === 0}>
                    Submit
                  </Button>
                </div>
              </div>

              {/* Completed trials this phase */}
              {currentTrials.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    {isForwardPhase ? "Forward" : "Backward"} Trials Completed
                  </p>
                  <div className="space-y-1">
                    {currentTrials.map((t, i) => (
                      <div key={i} className={`flex items-center gap-3 text-sm px-3 py-2 rounded-lg ${t.correct ? "bg-green-50" : "bg-red-50"}`}>
                        {t.correct
                          ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                          : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                        <span className="font-mono text-slate-700">
                          [{t.sequence.join("-")}] â†’ "{t.response}"
                        </span>
                        <span className={`ml-auto font-medium ${t.correct ? "text-green-700" : "text-red-600"}`}>
                          {t.length} digits â€” {t.correct ? "Correct" : "Incorrect"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* End phase button */}
              <Button variant="outline" onClick={() => {
                if (isForwardPhase) {
                  startPhase("backward");
                  toast.info("Moving to Backward Digit Span.");
                } else {
                  setPhase("done");
                }
              }}>
                {isForwardPhase ? "Skip to Backward Span â†’" : "End Test"}
              </Button>
            </div>
          )}

          {/* Done / Results */}
          {phase === "done" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <p className="text-xs font-semibold text-blue-600 uppercase mb-1">Forward Span</p>
                  <p className="text-4xl font-bold text-blue-800">
                    {forwardTrials.filter(t => t.correct).reduce((max, t) => Math.max(max, t.length), 0)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">digits (normal: 5â€“7)</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                  <p className="text-xs font-semibold text-purple-600 uppercase mb-1">Backward Span</p>
                  <p className="text-4xl font-bold text-purple-800">
                    {backwardTrials.filter(t => t.correct).reduce((max, t) => Math.max(max, t.length), 0)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">digits (normal: 4â€“6)</p>
                </div>
              </div>

              {/* All forward trials */}
              {forwardTrials.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Forward Trials</p>
                  <div className="space-y-1">
                    {forwardTrials.map((t, i) => (
                      <div key={i} className={`flex items-center gap-3 text-sm px-3 py-2 rounded-lg ${t.correct ? "bg-green-50" : "bg-red-50"}`}>
                        {t.correct ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                        <span className="font-mono text-slate-700">[{t.sequence.join("-")}] â†’ "{t.response}"</span>
                        <span className={`ml-auto font-medium ${t.correct ? "text-green-700" : "text-red-600"}`}>{t.length} digits</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All backward trials */}
              {backwardTrials.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Backward Trials</p>
                  <div className="space-y-1">
                    {backwardTrials.map((t, i) => (
                      <div key={i} className={`flex items-center gap-3 text-sm px-3 py-2 rounded-lg ${t.correct ? "bg-green-50" : "bg-red-50"}`}>
                        {t.correct ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                        <span className="font-mono text-slate-700">[{t.sequence.join("-")}] (rev: {[...t.sequence].reverse().join("-")}) â†’ "{t.response}"</span>
                        <span className={`ml-auto font-medium ${t.correct ? "text-green-700" : "text-red-600"}`}>{t.length} digits</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm font-semibold mb-1 block">Clinical Notes</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Enter any additional observations..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={onClose}><X className="mr-2 w-4 h-4" /> Cancel</Button>
                <Button onClick={handleSave}><Save className="mr-2 w-4 h-4" /> Save to SOAP</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}