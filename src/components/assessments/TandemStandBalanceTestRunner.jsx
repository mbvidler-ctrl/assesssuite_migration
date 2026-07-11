import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Play, Square, RotateCcw } from "lucide-react";
import { todayLocal } from "@/lib/localDate";

function getSPPBScore(seconds) {
  if (seconds >= 10) return 4;
  if (seconds >= 3) return 2;
  if (seconds > 0) return 1;
  return 0;
}

function getInterpretation(score) {
  if (score === 4) return { text: "Low fall risk", color: "text-green-700" };
  if (score === 2) return { text: "Moderate — monitor closely", color: "text-yellow-700" };
  if (score === 1) return { text: "Increased fall risk", color: "text-orange-700" };
  return { text: "High fall risk — unable to hold position", color: "text-red-700" };
}

export default function TandemStandBalanceTestRunner({ client, onSave, onClose }) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [trials, setTrials] = useState([]);
  const [notes, setNotes] = useState("");
  const intervalRef = useRef(null);

  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        setElapsed(prev => {
          if (prev >= 10) {
            clearInterval(intervalRef.current);
            setTimerRunning(false);
            return 10;
          }
          return +(prev + 0.01).toFixed(2);
        });
      }, 10);
    }
    return () => clearInterval(intervalRef.current);
  }, [timerRunning]);

  const handleStart = () => {
    setElapsed(0);
    setTimerRunning(true);
  };

  const handleStop = () => {
    clearInterval(intervalRef.current);
    setTimerRunning(false);
  };

  const handleReset = () => {
    clearInterval(intervalRef.current);
    setTimerRunning(false);
    setElapsed(0);
  };

  const handleAddTrial = () => {
    if (elapsed === 0 && trials.length === 0) return;
    setTrials(prev => [...prev, elapsed]);
    setElapsed(0);
    setTimerRunning(false);
  };

  const handleMarkUnable = () => {
    setTrials(prev => [...prev, 0]);
    setElapsed(0);
  };

  const bestTime = trials.length > 0 ? Math.max(...trials) : null;
  const score = bestTime !== null ? getSPPBScore(bestTime) : null;
  const interp = score !== null ? getInterpretation(score) : null;

  const timerColor = elapsed >= 10 ? "text-green-600" : timerRunning ? "text-blue-600" : "text-slate-800";

  const handleSave = () => {
    if (trials.length === 0) return;
    const soapText = `• Tandem Stand Balance Test\n  Best Hold Time: ${bestTime?.toFixed(2)}s | SPPB Score: ${score}/4\n  Interpretation: ${interp?.text}\n  All Trials: ${trials.map((t, i) => `Trial ${i + 1}: ${t === 0 ? 'Unable' : t.toFixed(2) + 's'}`).join(', ')}${notes ? `\n  Notes: ${notes}` : ''}`;
    onSave({
      result_value: score,
      notes,
      assessment_date: todayLocal(),
      additional_data: {
        soap_text: soapText,
        best_time: bestTime,
        trials,
        interpretation: interp?.text,
      }
    });
  };

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Tandem Stand Balance Test</h2>
          <p className="text-sm text-slate-500">SPPB balance component — fall risk assessment</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {/* Clinician Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
        <p className="font-semibold text-blue-900">📋 Clinician Instructions</p>
        <p><strong>Setup:</strong> Clear non-slip floor space. Stand close to client, ready to assist. No assistive device during test.</p>
        <p><strong>Position:</strong> Client places dominant foot behind, heel of front foot touching toe of back foot, forming a straight line. Arms may be used for balance but must not touch anything.</p>
        <p className="italic border-l-4 border-blue-300 pl-3 text-blue-700">"Place one foot directly in front of the other so the heel of the front foot is touching the toe of the back foot. Try to hold this position for 10 seconds without holding on to anything."</p>
        <p><strong>Demonstration:</strong> Demonstrate the position yourself first. Allow client to choose which foot goes in front.</p>
        <p><strong>Timing:</strong> Start stopwatch when client is in position and hands are released. Stop on loss of position, stepping out, or 10 seconds reached.</p>
        <p><strong>Trials:</strong> 1 attempt. If unable to hold initial position, score = 0.</p>
        <p><strong>Safety:</strong> Stay within arm's reach throughout. Use non-slip surface. Spotter required.</p>
      </div>

      {/* Scoring Table */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
        <p className="font-semibold text-slate-700 mb-2">📊 SPPB Scoring Criteria</p>
        <table className="w-full text-xs border border-slate-300 rounded overflow-hidden">
          <thead className="bg-slate-200">
            <tr><th className="p-2 text-left">Hold Time</th><th className="p-2 text-left">Score</th><th className="p-2 text-left">Interpretation</th></tr>
          </thead>
          <tbody>
            <tr className="border-t"><td className="p-2">≥ 10 s</td><td className="p-2 font-bold">4 pts</td><td className="p-2 text-green-700">Low fall risk</td></tr>
            <tr className="border-t bg-white"><td className="p-2">3 – 9.9 s</td><td className="p-2 font-bold">2 pts</td><td className="p-2 text-yellow-700">Moderate — monitor</td></tr>
            <tr className="border-t"><td className="p-2">&lt; 3 s</td><td className="p-2 font-bold">1 pt</td><td className="p-2 text-orange-700">Increased fall risk</td></tr>
            <tr className="border-t bg-white"><td className="p-2">Unable</td><td className="p-2 font-bold">0 pts</td><td className="p-2 text-red-700">High fall risk</td></tr>
          </tbody>
        </table>
        <p className="text-xs text-slate-500 mt-2">MCID: Change of ≥1 point. A tandem stand score of &lt;4 is associated with 2–3× increased fall risk in community-dwelling older adults (Guralnik et al., 1994; Rossiter-Fornoff et al., 1995).</p>
      </div>

      {/* Timer */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-5 text-center space-y-4">
        <p className="text-sm font-medium text-slate-600">Live Timer</p>
        <div className={`text-6xl font-bold font-mono tabular-nums ${timerColor}`}>
          {elapsed.toFixed(2)}s
        </div>
        {elapsed >= 10 && !timerRunning && (
          <p className="text-green-700 font-semibold text-sm">✅ 10 seconds reached — Score: 4 pts</p>
        )}
        <div className="flex justify-center gap-3 flex-wrap">
          {!timerRunning ? (
            <Button onClick={handleStart} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Play className="w-4 h-4 mr-2" /> Start Timer
            </Button>
          ) : (
            <Button onClick={handleStop} variant="destructive">
              <Square className="w-4 h-4 mr-2" /> Stop Timer
            </Button>
          )}
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" /> Reset
          </Button>
          <Button onClick={handleAddTrial} variant="outline" className="border-green-500 text-green-700 hover:bg-green-50" disabled={timerRunning}>
            + Record Trial
          </Button>
          <Button onClick={handleMarkUnable} variant="outline" className="border-red-400 text-red-600 hover:bg-red-50" disabled={timerRunning}>
            Mark Unable
          </Button>
        </div>
      </div>

      {/* Recorded Trials */}
      {trials.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">Recorded Trials</p>
          {trials.map((t, i) => {
            const s = getSPPBScore(t);
            const interp = getInterpretation(s);
            return (
              <div key={i} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-slate-800">
                  Trial {i + 1}: {t === 0 ? "Unable to hold" : `${t.toFixed(2)}s`}
                </span>
                <span className={`text-sm font-semibold ${interp.color}`}>
                  {s}/4 — {interp.text}
                </span>
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 text-xs h-7"
                  onClick={() => setTrials(prev => prev.filter((_, idx) => idx !== i))}>
                  Remove
                </Button>
              </div>
            );
          })}
          {/* Best result */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-3 mt-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-indigo-800">Best Hold: {bestTime?.toFixed(2)}s</span>
              <span className={`text-base font-bold ${interp?.color}`}>SPPB Score: {score}/4 — {interp?.text}</span>
            </div>
          </div>
        </div>
      )}

      {/* Clinical Notes */}
      <div>
        <Label className="text-sm font-medium text-slate-700">Clinical Notes</Label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Foot dominance used, sway observed, footwear, fear of falling noted..."
          className="mt-1"
        />
      </div>

      {/* References */}
      <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">📖 References</p>
        <p>1. Guralnik JM, Simonsick EM, Ferrucci L, et al. (1994). A short physical performance battery assessing lower extremity function: association with self-reported disability and prediction of mortality and nursing home admission. <em>Journal of Gerontology</em>, 49(2), M85–M94.</p>
        <p>2. Rossiter-Fornoff JE, Wolf SL, Wolfson LI, Buchner DM. (1995). A cross-sectional validation study of the FICSIT common data base static balance measures. <em>Journal of Gerontology: Medical Sciences</em>, 50A(6), M291–M297.</p>
        <p>3. Bohannon RW. (2006). Reference values for the timed up and go test: a descriptive meta-analysis. <em>Journal of Geriatric Physical Therapy</em>, 29(2), 64–68.</p>
        <p>4. Podsiadlo D & Richardson S. (1991). The timed "Up & Go": a test of basic functional mobility for frail elderly persons. <em>JAGS</em>, 39(2), 142–148.</p>
      </div>

      {/* Footer Buttons */}
      <div className="flex justify-between pt-2 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          disabled={trials.length === 0}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          Save Results
        </Button>
      </div>
    </div>
  );
}