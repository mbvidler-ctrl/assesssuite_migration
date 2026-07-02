import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { X, Play, Pause, RotateCcw } from 'lucide-react';

export default function TimedUpAndGoRunner({ onSave, onClose }) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [trials, setTrials] = useState([]);
  const [currentTrial, setCurrentTrial] = useState({
    time: '',
    assistiveDevice: 'none',
    steps: '',
    observations: ''
  });

  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 0.01);
      }, 10);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const handleStartStop = () => {
    if (timerRunning) {
      setTimerRunning(false);
      setCurrentTrial({ ...currentTrial, time: timerSeconds.toFixed(2) });
    } else {
      setTimerRunning(true);
    }
  };

  const handleReset = () => {
    setTimerRunning(false);
    setTimerSeconds(0);
    setCurrentTrial({ ...currentTrial, time: '' });
  };

  const handleAddTrial = () => {
    if (!currentTrial.time) return;
    setTrials([...trials, { ...currentTrial }]);
    setCurrentTrial({
      time: '',
      assistiveDevice: currentTrial.assistiveDevice,
      steps: '',
      observations: ''
    });
    setTimerSeconds(0);
  };

  const handleRemoveTrial = (index) => {
    setTrials(trials.filter((_, i) => i !== index));
  };

  const calculateAverage = () => {
    if (trials.length === 0) return 0;
    const sum = trials.reduce((acc, trial) => acc + parseFloat(trial.time), 0);
    return (sum / trials.length).toFixed(2);
  };

  const getInterpretation = (time) => {
    const t = parseFloat(time);
    if (t <= 10) return { text: 'Normal mobility', color: 'text-green-600' };
    if (t <= 20) return { text: 'Good mobility, mostly independent', color: 'text-blue-600' };
    if (t <= 30) return { text: 'Variable mobility, may require assistance', color: 'text-yellow-600' };
    return { text: 'Impaired mobility, high fall risk', color: 'text-red-600' };
  };

  const handleSave = () => {
    const avgTime = calculateAverage();
    const interpretation = getInterpretation(avgTime);
    const trialSummary = trials.map((t, i) =>
      `Trial ${i + 1}: ${t.time}s${t.assistiveDevice !== 'none' ? ` (${t.assistiveDevice.replace('_', ' ')})` : ''}${t.observations ? ` â€” ${t.observations}` : ''}`
    ).join('\n');
    onSave({
      result_value: parseFloat(avgTime),
      notes: `Interpretation: ${interpretation.text}\n\nTrials:\n${trialSummary}`,
      additional_data: {
        soap_text: `â€¢ Timed Up and Go (TUG): ${avgTime}s (average of ${trials.length} trial${trials.length > 1 ? 's' : ''})\n  Interpretation: ${interpretation.text}\n  Assistive Device: ${trials[0]?.assistiveDevice?.replace('_', ' ') || 'None'}\n\n  Trial Details:\n${trials.map((t, i) => `    Trial ${i + 1}: ${t.time}s${t.assistiveDevice !== 'none' ? ` | Device: ${t.assistiveDevice.replace('_', ' ')}` : ''}${t.steps ? ` | Steps: ${t.steps}` : ''}${t.observations ? `\n      Observations: ${t.observations}` : ''}`).join('\n')}`,
        trials,
        averageTime: parseFloat(avgTime),
        interpretation: interpretation.text,
        primaryAssistiveDevice: trials[0]?.assistiveDevice || 'none'
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-xl font-bold">Timed Up and Go (TUG) Test</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">ðŸ“‹ Administration Instructions</p>
            <p><strong>Setup:</strong> Standard armchair (~46 cm). Measure 3m from chair front. Client wears usual footwear. Assistive devices permitted â€” document.</p>
            <p className="italic">"When I say 'Go', stand up from the chair, walk to the line, turn around, walk back, and sit down. Walk at a safe, comfortable pace."</p>
            <p><strong>Timing:</strong> Start on "Go." Stop when back touches chair. Record time to 0.01 s. Multiple trials â€” use best or average.</p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-semibold text-slate-700">ðŸ“Š Norms & Interpretation</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Time</th><th className="p-2 text-left">Mobility</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">â‰¤10 s</td><td className="p-2 text-green-700">Normal</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">11â€“20 s</td><td className="p-2 text-teal-700">Good, mostly independent</td></tr>
                  <tr className="border-t"><td className="p-2">21â€“30 s</td><td className="p-2 text-yellow-700">Variable mobility</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">&gt;30 s</td><td className="p-2 text-red-700">Impaired, high fall risk</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">MCID: 1.4 s. Cut-off â‰¥13.5 s for fall prediction in community-dwelling older adults. Source: Podsiadlo & Richardson (1991).</p>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">ðŸ“– Reference</p>
            <p>Podsiadlo D & Richardson S. (1991). The timed "Up & Go": a test of basic functional mobility for frail elderly persons. <em>Journal of the American Geriatrics Society, 39</em>(2), 142â€“148.</p>
          </div>

          {/* Timer */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-6">
            <h3 className="font-semibold text-slate-900 mb-3 text-center">Test Timer</h3>
            <div className="text-center mb-4">
              <div className="text-6xl font-bold text-blue-600 font-mono">
                {timerSeconds.toFixed(2)}s
              </div>
            </div>
            <div className="flex justify-center gap-3">
              <Button
                type="button"
                onClick={handleStartStop}
                variant={timerRunning ? 'destructive' : 'default'}
                size="lg"
              >
                {timerRunning ? (
                  <><Pause className="w-5 h-5 mr-2" /> Stop</>
                ) : (
                  <><Play className="w-5 h-5 mr-2" /> Start</>
                )}
              </Button>
              <Button
                type="button"
                onClick={handleReset}
                variant="outline"
                size="lg"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Reset
              </Button>
            </div>
          </div>

          {/* Trial Data Entry */}
          <div className="space-y-4 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900">Record Trial</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="time">Time (seconds)</Label>
                <Input
                  id="time"
                  type="number"
                  step="0.01"
                  value={currentTrial.time}
                  onChange={(e) => setCurrentTrial({ ...currentTrial, time: e.target.value })}
                  className="mt-1"
                  placeholder="Enter time"
                />
              </div>
              <div>
                <Label htmlFor="steps">Number of Steps (Optional)</Label>
                <Input
                  id="steps"
                  type="number"
                  value={currentTrial.steps}
                  onChange={(e) => setCurrentTrial({ ...currentTrial, steps: e.target.value })}
                  className="mt-1"
                  placeholder="Count steps"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="assistive-device">Assistive Device</Label>
              <Select
                value={currentTrial.assistiveDevice}
                onValueChange={(value) => setCurrentTrial({ ...currentTrial, assistiveDevice: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="single_cane">Single Point Cane</SelectItem>
                  <SelectItem value="quad_cane">Quad Cane</SelectItem>
                  <SelectItem value="walker">Walker</SelectItem>
                  <SelectItem value="rollator">Rollator</SelectItem>
                  <SelectItem value="crutches">Crutches</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="observations">Observations</Label>
              <Textarea
                id="observations"
                value={currentTrial.observations}
                onChange={(e) => setCurrentTrial({ ...currentTrial, observations: e.target.value })}
                rows={2}
                className="mt-1"
                placeholder="Gait deviations, balance issues, hesitation..."
              />
            </div>

            <Button
              type="button"
              onClick={handleAddTrial}
              disabled={!currentTrial.time}
              className="w-full"
            >
              Add Trial
            </Button>
          </div>

          {/* Recorded Trials */}
          {trials.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Recorded Trials ({trials.length})</h3>
              <div className="space-y-2">
                {trials.map((trial, index) => (
                  <div key={index} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">
                        Trial {index + 1}: {trial.time}s
                        {trial.steps && ` â€¢ ${trial.steps} steps`}
                        {trial.assistiveDevice !== 'none' && ` â€¢ ${trial.assistiveDevice.replace('_', ' ')}`}
                      </p>
                      {trial.observations && (
                        <p className="text-sm text-slate-600 mt-1">{trial.observations}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveTrial(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results Summary */}
          {trials.length > 0 && (
            <>
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-300 rounded-lg p-5">
                <h3 className="font-bold text-slate-900 mb-3">Results Summary</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-4 text-center">
                    <p className="text-sm text-slate-600">Average Time</p>
                    <p className="text-4xl font-bold text-indigo-600">{calculateAverage()}s</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 text-center">
                    <p className="text-sm text-slate-600">Interpretation</p>
                    <p className={`text-lg font-bold ${getInterpretation(calculateAverage()).color}`}>
                      {getInterpretation(calculateAverage()).text}
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-600 bg-white/70 rounded p-2">
                  <strong>Guidelines:</strong> â‰¤10s = Normal â€¢ 11-20s = Good, mostly independent â€¢ 21-30s = Variable mobility â€¢ &gt;30s = Impaired, high fall risk
                </div>
              </div>

              {/* Final Score Display */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6 text-center">
                <p className="text-sm mb-2 opacity-90">TUG Test Score</p>
                <p className="text-6xl font-bold mb-1">{calculateAverage()}s</p>
                <p className="text-sm opacity-90">Average of {trials.length} trial{trials.length > 1 ? 's' : ''}</p>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={trials.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              Save TUG Results
            </Button>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  );
}