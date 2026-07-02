import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Save, Play, Pause, RotateCcw, Info } from "lucide-react";
import { toast } from "sonner";

export default function TenMeterWalkRunner({ onSave, onClose }) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [trials, setTrials] = useState([]);
  const [walkingSpeed, setWalkingSpeed] = useState('comfortable'); // comfortable or fast
  const [assistiveDevice, setAssistiveDevice] = useState('none');
  const [currentTrial, setCurrentTrial] = useState({
    time: '',
    steps: '',
    observations: ''
  });
  const [notes, setNotes] = useState('');

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
    if (!currentTrial.time) {
      toast.error("Please record a time for this trial");
      return;
    }
    setTrials([...trials, { ...currentTrial }]);
    setCurrentTrial({
      time: '',
      steps: '',
      observations: ''
    });
    setTimerSeconds(0);
  };

  const handleRemoveTrial = (index) => {
    setTrials(trials.filter((_, i) => i !== index));
  };

  const calculateAverageSpeed = () => {
    if (trials.length === 0) return 0;
    const speeds = trials.map(trial => 10 / parseFloat(trial.time));
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    return avgSpeed.toFixed(2);
  };

  const calculateAverageTime = () => {
    if (trials.length === 0) return 0;
    const sum = trials.reduce((acc, trial) => acc + parseFloat(trial.time), 0);
    return (sum / trials.length).toFixed(2);
  };

  const getSpeedInterpretation = (speed) => {
    const s = parseFloat(speed);
    // Based on community ambulation speed thresholds
    if (s >= 1.2) return { text: 'Community Ambulator', color: 'text-green-600' };
    if (s >= 0.8) return { text: 'Limited Community Ambulator', color: 'text-blue-600' };
    if (s >= 0.4) return { text: 'Household Ambulator', color: 'text-yellow-600' };
    return { text: 'Non-Functional Ambulator', color: 'text-red-600' };
  };

  const handleSave = () => {
    if (trials.length === 0) {
      toast.error("Please complete at least one trial");
      return;
    }

    const avgSpeed = calculateAverageSpeed();
    const avgTime = calculateAverageTime();
    const interpretation = getSpeedInterpretation(avgSpeed);

    const soapText = [
      `â€¢ 10 Metre Walk Test (${walkingSpeed === 'fast' ? 'Fast' : 'Comfortable'} pace)`,
      `  Avg Speed: ${avgSpeed} m/s | Avg Time: ${avgTime}s | ${interpretation.text}`,
      assistiveDevice !== 'none' ? `  Assistive Device: ${assistiveDevice.replace(/_/g, ' ')}` : null,
      notes ? `  Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: parseFloat(avgSpeed),
      additional_data: {
        soap_text: soapText,
        trials,
        average_time: parseFloat(avgTime),
        average_speed: parseFloat(avgSpeed),
        walking_speed_type: walkingSpeed,
        assistive_device: assistiveDevice,
        interpretation: interpretation.text,
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  const avgSpeed = calculateAverageSpeed();
  const avgTime = calculateAverageTime();
  const interpretation = avgSpeed > 0 ? getSpeedInterpretation(avgSpeed) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-cyan-50 to-blue-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">10 Meter Walk Test</h2>
              <p className="text-slate-600 mt-1">Gait Speed Assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Instructions */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Test Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-blue-800">
                <p><strong>Setup:</strong> Mark a 14-meter walkway (10m test distance + 2m acceleration + 2m deceleration)</p>
                <p><strong>Instructions to Patient:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>"Walk at your comfortable pace" (or "Walk as fast as you safely can" for fast speed)</li>
                  <li>"Start walking before the first line and keep walking past the end line"</li>
                  <li>Time only the middle 10 meters (between the 2m and 12m marks)</li>
                  <li>Conduct 2-3 trials and calculate average speed</li>
                </ul>
                <p className="text-xs mt-2 border-t border-blue-300 pt-2">
                  <strong>Note:</strong> The 2m buffer zones allow for acceleration and deceleration, ensuring steady-state gait speed measurement.
                </p>
              </CardContent>
            </Card>

            {/* Test Configuration */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Walking Speed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant={walkingSpeed === 'comfortable' ? 'default' : 'outline'}
                      onClick={() => setWalkingSpeed('comfortable')}
                      className="flex-1"
                    >
                      Comfortable Pace
                    </Button>
                    <Button
                      variant={walkingSpeed === 'fast' ? 'default' : 'outline'}
                      onClick={() => setWalkingSpeed('fast')}
                      className="flex-1"
                    >
                      Fast Pace
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assistive Device</CardTitle>
                </CardHeader>
                <CardContent>
                  <select
                    value={assistiveDevice}
                    onChange={(e) => setAssistiveDevice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  >
                    <option value="none">None</option>
                    <option value="single_cane">Single Point Cane</option>
                    <option value="quad_cane">Quad Cane</option>
                    <option value="walker">Walker</option>
                    <option value="rollator">Rollator</option>
                    <option value="crutches">Crutches</option>
                  </select>
                </CardContent>
              </Card>
            </div>

            {/* Timer */}
            <Card className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg text-center">Timer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <div className="text-6xl font-bold text-blue-600 font-mono">
                    {timerSeconds.toFixed(2)}s
                  </div>
                </div>
                <div className="flex justify-center gap-3">
                  <Button
                    onClick={handleStartStop}
                    variant={timerRunning ? 'destructive' : 'default'}
                    size="lg"
                  >
                    {timerRunning ? (
                      <>
                        <Pause className="w-5 h-5 mr-2" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 mr-2" />
                        Start
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="lg"
                  >
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Current Trial Entry */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Record Trial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Time (seconds)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={currentTrial.time}
                      onChange={(e) => setCurrentTrial({ ...currentTrial, time: e.target.value })}
                      placeholder="Enter time"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Number of Steps (Optional)</Label>
                    <Input
                      type="number"
                      value={currentTrial.steps}
                      onChange={(e) => setCurrentTrial({ ...currentTrial, steps: e.target.value })}
                      placeholder="Count steps"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label>Observations</Label>
                  <Textarea
                    value={currentTrial.observations}
                    onChange={(e) => setCurrentTrial({ ...currentTrial, observations: e.target.value })}
                    rows={2}
                    className="mt-1"
                    placeholder="Gait deviations, balance issues, assistive device use..."
                  />
                </div>

                <Button
                  onClick={handleAddTrial}
                  disabled={!currentTrial.time}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Add Trial
                </Button>
              </CardContent>
            </Card>

            {/* Recorded Trials */}
            {trials.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recorded Trials ({trials.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {trials.map((trial, index) => {
                    const speed = (10 / parseFloat(trial.time)).toFixed(2);
                    return (
                      <div key={index} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">
                            Trial {index + 1}: {trial.time}s
                            <span className="text-blue-600 ml-2">({speed} m/s)</span>
                            {trial.steps && ` â€¢ ${trial.steps} steps`}
                          </p>
                          {trial.observations && (
                            <p className="text-sm text-slate-600 mt-1">{trial.observations}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTrial(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Results Summary */}
            {trials.length > 0 && (
              <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200 border-2">
                <CardHeader>
                  <CardTitle className="text-lg">Results Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-4 text-center">
                      <p className="text-sm text-slate-600 mb-1">Average Time</p>
                      <p className="text-3xl font-bold text-slate-900">{avgTime}s</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 text-center">
                      <p className="text-sm text-slate-600 mb-1">Average Speed</p>
                      <p className="text-3xl font-bold text-blue-600">{avgSpeed} m/s</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 text-center">
                      <p className="text-sm text-slate-600 mb-1">Classification</p>
                      <p className={`text-lg font-bold ${interpretation?.color}`}>
                        {interpretation?.text}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 bg-white/70 rounded p-3">
                    <p><strong>Speed Classifications:</strong></p>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      <li>â‰¥1.2 m/s: Community Ambulator</li>
                      <li>0.8-1.19 m/s: Limited Community Ambulator</li>
                      <li>0.4-0.79 m/s: Household Ambulator</li>
                      <li>&lt;0.4 m/s: Non-Functional Ambulator</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Overall gait quality, endurance, safety concerns, intervention needs..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={trials.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save 10MWT Results
          </Button>
        </div>
      </div>
    </div>
  );
}