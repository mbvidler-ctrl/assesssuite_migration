import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Save, Play, Pause, RotateCcw, Info, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function CKCUESTRunner({ onSave, onClose }) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [position, setPosition] = useState('standard');
  const [trials, setTrials] = useState([]);
  const [currentTouches, setCurrentTouches] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev >= 15) {
            setTimerRunning(false);
            return 15;
          }
          return prev + 0.1;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const recordTrial = () => {
    if (!currentTouches) {
      toast.error("Please enter number of touches");
      return;
    }

    setTrials([...trials, {
      trial_number: trials.length + 1,
      touches: parseInt(currentTouches),
      position: position
    }]);
    setCurrentTouches('');
    setTimerSeconds(0);
    toast.success(`Trial ${trials.length + 1} recorded`);
  };

  const getBestTouches = () => {
    if (trials.length === 0) return 0;
    return Math.max(...trials.map(t => t.touches));
  };

  const handleSave = () => {
    if (trials.length === 0) {
      toast.error("Please complete at least one trial");
      return;
    }

    const bestTouches = getBestTouches();

    const trialsText = trials.map(t =>
      `  Trial ${t.trial_number}: ${t.touches} touches (${t.position})`
    ).join('\n');

    const soapText = `• Closed Kinetic Chain Upper Extremity Stability Test (CKCUEST):\n  Position: ${position}\n${trialsText}\n  Best Score: ${bestTouches} touches in 15 seconds${notes ? `\n  Notes: ${notes}` : ''}`;

    onSave({
      result_value: bestTouches,
      trials,
      best_touches: bestTouches,
      additional_data: {
        soap_text: soapText,
        trials,
        best_touches: bestTouches,
        position_used: position,
      },
      notes,
      assessment_date: todayLocal(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">CKCUEST</h2>
              <p className="text-slate-600 mt-1">Closed Kinetic Chain Upper Extremity Stability Test</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>Goldbeck TG & Davies GJ. (2000). Test-retest reliability of the closed kinetic chain upper extremity stability test: a clinical field test. <em>Journal of Sport Rehabilitation, 9</em>(1), 35–45.</p>
              <p>Tucci HT et al. (2014). Closed kinetic chain upper extremity stability test (CKCUEST) for overhead athletes. <em>International Journal of Sports Physical Therapy, 9</em>(1), 35–44.</p>
            </div>

            {/* Norms */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Norms (Touches in 15 seconds)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Population</th><th className="p-2 text-center">Males</th><th className="p-2 text-center">Females</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">Healthy young adults</td><td className="p-2 text-center">21–22</td><td className="p-2 text-center">18–20</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">Overhead athletes</td><td className="p-2 text-center">23–26</td><td className="p-2 text-center">20–23</td></tr>
                    <tr className="border-t"><td className="p-2">Return-to-sport threshold</td><td className="p-2 text-center" colSpan={2}>≥21 touches (standard position)</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">Tape strips 91 cm (36 in) apart. 3 trials — use best. Normalised score: touches ÷ (height in cm) × 100. MCID: ~3 touches. Source: Goldbeck & Davies (2000).</p>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  📋 Test Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>Setup:</strong> Place two tape strips <strong>36 inches (91 cm)</strong> apart on floor</p>
                <p><strong>Position:</strong> Standard push-up or modified (on knees) position, one hand on each tape</p>
                <p><strong>Task:</strong> Alternately reach one hand across body to tap opposite tape, return to start. Each touch of opposite tape = 1.</p>
                <p className="italic">"As fast as you safely can, touch one hand to the opposite tape mark, return, then touch the other hand. Count every time your hand touches a line."</p>
                <p><strong>Duration:</strong> 15 seconds | <strong>Scoring:</strong> Total touches, best of 3 trials</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label>Position Used</Label>
                  <div className="flex gap-3 mt-2">
                    <Button
                      type="button"
                      variant={position === 'standard' ? 'default' : 'outline'}
                      onClick={() => setPosition('standard')}
                    >
                      Standard (on toes)
                    </Button>
                    <Button
                      type="button"
                      variant={position === 'modified' ? 'default' : 'outline'}
                      onClick={() => setPosition('modified')}
                    >
                      Modified (on knees)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg text-center">15-Second Timer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <div className="text-6xl font-bold text-blue-600 font-mono">
                    {timerSeconds.toFixed(1)}s
                  </div>
                </div>
                <div className="flex justify-center gap-3">
                  <Button
                    onClick={() => setTimerRunning(!timerRunning)}
                    variant={timerRunning ? 'destructive' : 'default'}
                    size="lg"
                  >
                    {timerRunning ? <Pause className="w-5 h-5 mr-2" /> : <Play className="w-5 h-5 mr-2" />}
                    {timerRunning ? 'Stop' : 'Start'}
                  </Button>
                  <Button
                    onClick={() => {
                      setTimerRunning(false);
                      setTimerSeconds(0);
                    }}
                    variant="outline"
                    size="lg"
                  >
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Reset
                  </Button>
                </div>
                {timerSeconds >= 15 && (
                  <p className="mt-4 text-green-600 font-semibold text-center">✓ 15 seconds complete!</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Record Trial</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label>Total Touches in 15 seconds</Label>
                    <Input
                      type="number"
                      value={currentTouches}
                      onChange={(e) => setCurrentTouches(e.target.value)}
                      placeholder="Count total touches"
                      className="mt-1 text-xl font-bold"
                    />
                  </div>
                  <Button onClick={recordTrial} className="mt-6">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Trial
                  </Button>
                </div>
              </CardContent>
            </Card>

            {trials.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recorded Trials</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {trials.map((trial, index) => (
                    <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <span className="font-semibold">Trial {trial.trial_number}: </span>
                        <span className="text-blue-600 font-bold text-lg">{trial.touches} touches</span>
                        <span className="text-slate-500 text-sm ml-2">({trial.position})</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTrials(trials.filter((_, i) => i !== index))}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 text-center">
                    <p className="text-sm text-blue-700 mb-1">Best Score</p>
                    <p className="text-5xl font-bold text-blue-600">{getBestTouches()}</p>
                    <p className="text-sm text-blue-700">touches in 15 seconds</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Form quality, compensations, fatigue, pain..."
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
            disabled={trials.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save CKCUEST Results
          </Button>
        </div>
      </div>
    </div>
  );
}