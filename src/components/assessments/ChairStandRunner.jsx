import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Play, Pause, RotateCcw, Plus, Minus } from 'lucide-react';
import { todayLocal } from "@/lib/localDate";

export default function ChairStandRunner({ duration = 30, onSave, onClose }) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [repetitions, setRepetitions] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [notes, setNotes] = useState('');
  const [postHR, setPostHR] = useState('');
  const [rpe, setRPE] = useState('');
  const [dyspnea, setDyspnea] = useState('');

  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          const newTime = prev + 0.1;
          if (newTime >= duration) {
            setTimerRunning(false);
            setCompleted(true);
            return duration;
          }
          return newTime;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [timerRunning, duration]);

  const handleStartStop = () => {
    setTimerRunning(!timerRunning);
    // If stopping the timer manually, mark as completed
    if (timerRunning && timerSeconds > 0) {
      setCompleted(true);
    }
  };

  const handleReset = () => {
    setTimerRunning(false);
    setTimerSeconds(0);
    setRepetitions(0);
    setCompleted(false);
  };

  const handleIncrement = () => {
    setRepetitions(repetitions + 1);
  };

  const handleDecrement = () => {
    if (repetitions > 0) setRepetitions(repetitions - 1);
  };

  const getInterpretation = (reps, duration) => {
    if (duration === 30) {
      // 30-second chair stand norms (rough guidelines for 60-69 age group)
      if (reps >= 14) return { text: 'Above Average', color: 'text-green-600' };
      if (reps >= 12) return { text: 'Average', color: 'text-blue-600' };
      if (reps >= 8) return { text: 'Below Average', color: 'text-yellow-600' };
      return { text: 'Poor - Fall Risk', color: 'text-red-600' };
    } else {
      // 1-minute chair stand
      if (reps >= 25) return { text: 'Above Average', color: 'text-green-600' };
      if (reps >= 20) return { text: 'Average', color: 'text-blue-600' };
      if (reps >= 15) return { text: 'Below Average', color: 'text-yellow-600' };
      return { text: 'Poor', color: 'text-red-600' };
    }
  };

  const handleSave = () => {
    const interpretation = getInterpretation(repetitions, duration);
    
    // Build comprehensive SOAP text
    let soapText = `• ${duration}-Second Chair Stand Test: ${repetitions} repetitions → ${interpretation.text}\n`;
    if (postHR) soapText += `  Post-Test Heart Rate: ${postHR} bpm\n`;
    if (rpe) soapText += `  RPE: ${rpe}/20\n`;
    if (dyspnea) soapText += `  Dyspnea: ${dyspnea}/10\n`;
    if (notes) soapText += `  Notes: ${notes}\n`;
    
    onSave({
      result_value: repetitions,
      additional_data: {
        soap_text: soapText,
        duration,
        repetitions,
        postHR: postHR ? parseFloat(postHR) : null,
        rpe: rpe ? parseFloat(rpe) : null,
        dyspnea: dyspnea ? parseFloat(dyspnea) : null,
        interpretation: interpretation.text,
        measurement_type: 'chair_stand'
      },
      notes,
      assessment_date: todayLocal()
    });
  };

  const timeRemaining = Math.max(0, duration - timerSeconds);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-2xl max-h-[95vh] overflow-y-auto bg-white" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-xl font-bold">
            {duration}-Second Chair Stand Test
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Jones CJ, Rikli RE, & Beam WC. (1999). A 30-s chair-stand test as a measure of lower body strength in community-residing older adults. <em>Research Quarterly for Exercise and Sport, 70</em>(2), 113–119.</p>
            <p>Rikli RE & Jones CJ. (2001). <em>Senior Fitness Test Manual</em>. Human Kinetics.</p>
          </div>

          {/* Clinician Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">📋 Administration Instructions (Rikli & Jones Protocol)</p>
            <p><strong>Setup:</strong> Sturdy chair (~43 cm seat) against wall. Client seated in middle of chair, back straight, feet flat on floor, arms crossed over chest.</p>
            <p className="italic">"When I say 'Go', rise to a full standing position and sit back down again. Keep your arms across your chest. Do as many times as you can in {duration} seconds."</p>
            <p><strong>Count:</strong> Count each time client comes to a FULL standing position. If client is mid-stand when time expires, count it if they are more than halfway up.</p>
            <p><strong>Safety:</strong> Stand close to spot. Stop if client is unable to maintain safe form, reports pain, or dizziness.</p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 Norms — 30-Second Chair Stand (repetitions)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Age</th><th className="p-2 text-center">Men (avg range)</th><th className="p-2 text-center">Women (avg range)</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">60–64</td><td className="p-2 text-center">14–19</td><td className="p-2 text-center">12–17</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">65–69</td><td className="p-2 text-center">12–18</td><td className="p-2 text-center">11–16</td></tr>
                  <tr className="border-t"><td className="p-2">70–74</td><td className="p-2 text-center">12–17</td><td className="p-2 text-center">10–15</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">75–79</td><td className="p-2 text-center">11–17</td><td className="p-2 text-center">10–15</td></tr>
                  <tr className="border-t"><td className="p-2">80–84</td><td className="p-2 text-center">10–15</td><td className="p-2 text-center">9–14</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">MCID: ~2 reps. Below-average score associated with increased fall risk and reduced functional independence. Source: Rikli & Jones (2001).</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Instructions:</strong> Arms crossed over chest. Stand up fully and sit down repeatedly for {duration} seconds. Count each complete stand.
            </p>
          </div>

          {/* Timer & Counter */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Timer */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-slate-900 mb-2 text-center">Time Remaining</h3>
              <div className="text-center mb-4">
                <div className={`text-5xl font-bold font-mono ${timeRemaining <= 5 && timerRunning ? 'text-red-600' : 'text-blue-600'}`}>
                  {timeRemaining.toFixed(1)}s
                </div>
              </div>
              <div className="flex justify-center gap-2">
                <Button
                  type="button"
                  onClick={handleStartStop}
                  variant={timerRunning ? 'destructive' : 'default'}
                  size="lg"
                  className="flex-1"
                >
                  {timerRunning ? <><Pause className="w-4 h-4 mr-2" /> Stop</> : <><Play className="w-4 h-4 mr-2" /> Start</>}
                </Button>
                <Button
                  type="button"
                  onClick={handleReset}
                  variant="outline"
                  size="lg"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Counter */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
              <h3 className="font-semibold text-slate-900 mb-2 text-center">Repetition Counter</h3>
              <div className="text-center mb-4">
                <div className="text-6xl font-bold text-green-600 font-mono">
                  {repetitions}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={handleDecrement}
                  variant="outline"
                  size="lg"
                  disabled={repetitions === 0}
                >
                  <Minus className="w-5 h-5" />
                </Button>
                <Button
                  type="button"
                  onClick={handleIncrement}
                  variant="default"
                  size="lg"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Post-Test Measures */}
          {completed && (
            <div className="space-y-4 border border-slate-200 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900">Post-Test Measures (Optional)</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="post-hr">Heart Rate (bpm)</Label>
                  <Input
                    id="post-hr"
                    type="number"
                    value={postHR}
                    onChange={(e) => setPostHR(e.target.value)}
                    className="mt-1"
                    placeholder="e.g., 110"
                  />
                </div>
                <div>
                  <Label htmlFor="rpe">RPE (6-20)</Label>
                  <Input
                    id="rpe"
                    type="number"
                    min="6"
                    max="20"
                    value={rpe}
                    onChange={(e) => setRPE(e.target.value)}
                    className="mt-1"
                    placeholder="e.g., 13"
                  />
                </div>
                <div>
                  <Label htmlFor="dyspnea">Dyspnea (0-10)</Label>
                  <Input
                    id="dyspnea"
                    type="number"
                    min="0"
                    max="10"
                    value={dyspnea}
                    onChange={(e) => setDyspnea(e.target.value)}
                    className="mt-1"
                    placeholder="e.g., 3"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1"
              placeholder="Observations, form quality, balance..."
            />
          </div>

          {/* Results */}
          {repetitions > 0 && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-300 rounded-lg p-5">
              <h3 className="font-bold text-slate-900 mb-3">Results</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-600">Total Repetitions</p>
                  <p className="text-4xl font-bold text-purple-600">{repetitions} reps</p>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-600">Interpretation</p>
                  <p className={`text-lg font-bold ${getInterpretation(repetitions, duration).color}`}>
                    {getInterpretation(repetitions, duration).text}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700"
            >
              Save Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}