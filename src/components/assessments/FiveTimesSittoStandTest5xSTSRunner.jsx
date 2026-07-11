import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, Play, Square, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function FiveTimesSittoStandTest5xSTSRunner({ client, onSave, onClose }) {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [trials, setTrials] = useState([]); // array of times in seconds
  const [notes, setNotes] = useState("");
  const startRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      startRef.current = Date.now() - elapsed * 1000;
      intervalRef.current = setInterval(() => {
        setElapsed((Date.now() - startRef.current) / 1000);
      }, 50);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const handleStart = () => {
    setElapsed(0);
    setIsRunning(true);
  };

  const handleLap = () => {
    if (!isRunning) return;
    const lapTime = (Date.now() - startRef.current) / 1000;
    const newTrials = [...trials, lapTime];
    setTrials(newTrials);
    // Auto-stop at 5 trials
    if (newTrials.length >= 5) {
      setIsRunning(false);
      toast.success("5 sit-to-stands recorded!");
    } else {
      toast.success(`Stand ${newTrials.length} recorded: ${lapTime.toFixed(2)}s`);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setElapsed(0);
    setTrials([]);
  };

  const totalTime = trials.length > 0 ? trials[trials.length - 1] : null;
  const isComplete = trials.length === 5;
  const fallRisk = totalTime !== null ? (totalTime >= 15 ? "Elevated fall risk (≥15s)" : "Lower fall risk (<15s)") : null;

  const handleSave = () => {
    const trialLines = trials.map((t, i) => `  Stand ${i + 1}: ${t.toFixed(2)}s`).join('\n');
    const soap_text = `Five Times Sit-to-Stand Test (5xSTS)\n\nTotal Time: ${totalTime.toFixed(2)}s — ${fallRisk}\n\nIndividual Stands:\n${trialLines}${notes ? `\n\nClinical Notes: ${notes}` : ''}`;

    onSave({
      status: "completed",
      result_value: parseFloat(totalTime.toFixed(2)),
      notes,
      assessment_date: todayLocal(),
      additional_data: {
        soap_text,
        measurement_type: '5sts',
        trials: trials.map((t, i) => ({ stand: i + 1, time: parseFloat(t.toFixed(2)) })),
        total_time: parseFloat(totalTime.toFixed(2)),
        fall_risk: fallRisk,
      },
    });
    toast.success("Assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Five Times Sit-to-Stand Test (5xSTS)</h2>
            <p className="text-sm text-blue-600 mt-0.5">Record the time of each stand-up</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Instructions */}
          <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600 space-y-1">
            <p><strong>Instructions:</strong> Sit with arms crossed over chest. On 'go', stand fully and sit down 5 times as quickly and safely as possible.</p>
            <p><strong>Scoring:</strong> ≥15s is associated with increased fall risk in older adults.</p>
          </div>

          {/* Timer */}
          <div className="text-center">
            <div className={`text-5xl font-mono font-bold tabular-nums ${isRunning ? 'text-blue-600' : 'text-slate-700'}`}>
              {elapsed.toFixed(2)}s
            </div>
            <div className="text-sm text-slate-500 mt-1">{trials.length}/5 stands recorded</div>
          </div>

          {/* Controls */}
          <div className="flex gap-3 justify-center">
            {!isRunning && trials.length === 0 && (
              <Button onClick={handleStart} className="gap-2">
                <Play className="w-4 h-4" /> Start
              </Button>
            )}
            {isRunning && (
              <Button onClick={handleLap} className="gap-2 bg-green-600 hover:bg-green-700">
                <Square className="w-4 h-4" /> Record Stand {trials.length + 1}
              </Button>
            )}
            {(trials.length > 0 || isRunning) && (
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="w-4 h-4" /> Reset
              </Button>
            )}
          </div>

          {/* Trial list */}
          {trials.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Recorded Stands</div>
              {trials.map((t, i) => (
                <div key={i} className="flex justify-between items-center px-4 py-2 border-t text-sm">
                  <span className="text-slate-600">Stand {i + 1}</span>
                  <span className="font-mono font-semibold text-slate-800">{t.toFixed(2)}s</span>
                </div>
              ))}
              {isComplete && (
                <div className={`flex justify-between items-center px-4 py-3 border-t font-semibold ${totalTime >= 15 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  <span>Total Time</span>
                  <span className="font-mono">{totalTime.toFixed(2)}s — {fallRisk}</span>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="block mb-1">Clinical Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional observations..." rows={3} />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-between">
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Cancel</Button>
          <Button onClick={handleSave}><Save className="w-4 h-4 mr-2" />Save Assessment</Button>
        </div>
      </div>
    </div>
  );
}