import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Play, Pause, RotateCcw, Info, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function TUDSRunner({ onSave, onClose }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [trials, setTrials] = useState([]);
  const [currentTrialTime, setCurrentTrialTime] = useState("");
  const [numStairs, setNumStairs] = useState("12");
  const [stairHeight, setStairHeight] = useState("18");
  const [handrail, setHandrail] = useState("none");
  const [assistiveDevice, setAssistiveDevice] = useState("none");
  const [safetyObservations, setSafetyObservations] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  };

  const handleAddTrial = () => {
    const time = currentTrialTime || (elapsedSeconds / 10).toFixed(2);
    if (!time || parseFloat(time) <= 0) {
      toast.error("Please enter a valid trial time");
      return;
    }
    
    setTrials([...trials, {
      trial: trials.length + 1,
      time: parseFloat(time),
      timestamp: new Date().toISOString()
    }]);
    
    setCurrentTrialTime("");
    setElapsedSeconds(0);
    setIsRunning(false);
    toast.success(`Trial ${trials.length + 1} recorded`);
  };

  const handleRemoveTrial = (index) => {
    const newTrials = trials.filter((_, i) => i !== index);
    const renumberedTrials = newTrials.map((trial, idx) => ({ ...trial, trial: idx + 1 }));
    setTrials(renumberedTrials);
  };

  const calculateAverage = () => {
    if (trials.length === 0) return null;
    const sum = trials.reduce((acc, trial) => acc + trial.time, 0);
    return (sum / trials.length).toFixed(2);
  };

  const getBestTime = () => {
    if (trials.length === 0) return null;
    return Math.min(...trials.map(t => t.time)).toFixed(2);
  };

  const getInterpretation = () => {
    const avgTime = parseFloat(calculateAverage());
    if (!avgTime) return null;

    if (avgTime < 8) {
      return { level: 'Excellent functional mobility', color: 'text-green-600', bg: 'bg-green-50' };
    } else if (avgTime < 12) {
      return { level: 'Good functional mobility', color: 'text-blue-600', bg: 'bg-blue-50' };
    } else if (avgTime < 15) {
      return { level: 'Moderate functional mobility', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    } else {
      return { level: 'Limited functional mobility - consider fall risk', color: 'text-red-600', bg: 'bg-red-50' };
    }
  };

  const interpretation = getInterpretation();

  const handleSave = () => {
    if (trials.length === 0) {
      toast.error("Please record at least one trial");
      return;
    }

    const soapText = [
      `• Timed Up and Down Stairs (TUDS)`,
      `  Average Time: ${calculateAverage()}s | Best Time: ${getBestTime()}s — ${interpretation?.level}`,
      `  Stairs: ${numStairs} (${stairHeight}cm high) | Handrail: ${handrail} | Device: ${assistiveDevice}`,
      safetyObservations ? `  Safety: ${safetyObservations}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: parseFloat(calculateAverage()),
      additional_data: {
        soap_text: soapText,
        trials: trials,
        average_time: parseFloat(calculateAverage()),
        best_time: parseFloat(getBestTime()),
        num_stairs: parseInt(numStairs),
        stair_height_cm: parseFloat(stairHeight),
        handrail_use: handrail,
        assistive_device: assistiveDevice,
        safety_observations: safetyObservations,
        interpretation: interpretation?.level
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Timed Up and Down Stairs (TUDS)</h2>
              <p className="text-slate-600 mt-1">Functional mobility assessment measuring stair-climbing ability</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Clinician Script & Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>Setup:</strong> "I'd like you to walk up and down this flight of stairs as quickly as you can do so safely. You can use the handrail if needed, and we'll time how long it takes."</p>
                <p><strong>Instructions:</strong> "When I say 'go', walk up the stairs, turn around at the top, and walk back down. Move as quickly as you safely can. Ready? Go!"</p>
                <p><strong>Timing:</strong> Start timing when the participant's foot leaves the ground at the start and stop when both feet are back on the floor at the bottom.</p>
                <p className="font-semibold mt-3">Typically 2-3 trials are recorded, with the average time used for interpretation.</p>
              </CardContent>
            </Card>

            <Card className="bg-amber-50 border-amber-200">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                  ⚠ï¸ Contraindications
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-amber-800">
                <p><strong>Absolute:</strong> Acute lower limb injury, severe pain with stairs, marked balance impairment without support, recent surgery affecting mobility.</p>
                <p><strong>Relative:</strong> Moderate balance issues (provide handrail and close supervision), cardiovascular instability, severe arthritis with pain.</p>
                <p><strong>Safety:</strong> Always provide handrail access and close supervision. Stop if client shows significant difficulty, pain, or distress.</p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Test Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Number of Stairs</Label>
                    <Input
                      type="number"
                      value={numStairs}
                      onChange={(e) => setNumStairs(e.target.value)}
                      placeholder="e.g., 12"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Stair Height (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={stairHeight}
                      onChange={(e) => setStairHeight(e.target.value)}
                      placeholder="e.g., 18"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Handrail Use</Label>
                    <Select value={handrail} onValueChange={setHandrail}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No handrail use</SelectItem>
                        <SelectItem value="occasional">Occasional use for balance</SelectItem>
                        <SelectItem value="continuous">Continuous use</SelectItem>
                        <SelectItem value="required">Required for safety</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Assistive Device</Label>
                    <Select value={assistiveDevice} onValueChange={setAssistiveDevice}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="cane">Cane/Walking stick</SelectItem>
                        <SelectItem value="walker">Walker</SelectItem>
                        <SelectItem value="crutches">Crutches</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Timer</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-5xl font-bold text-blue-600 font-mono text-center">
                      {formatTime(elapsedSeconds)}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => setIsRunning(!isRunning)}
                        variant={isRunning ? "destructive" : "default"}
                        className="flex-1"
                      >
                        {isRunning ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        {isRunning ? 'Stop' : 'Start'}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setIsRunning(false);
                          setElapsedSeconds(0);
                        }}
                        variant="outline"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                    <div>
                      <Label>Trial Time (seconds)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={currentTrialTime}
                        onChange={(e) => setCurrentTrialTime(e.target.value)}
                        placeholder="Or use timer"
                        className="mt-1"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddTrial}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Record Trial
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {trials.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recorded Trials</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {trials.map((trial, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                        <span className="font-semibold">Trial {trial.trial}:</span>
                        <span className="text-lg">{trial.time.toFixed(2)} seconds</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTrial(index)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    ))}
                    <div className="mt-4 p-4 bg-blue-50 rounded">
                      <p className="font-semibold">Average Time: {calculateAverage()} seconds</p>
                      <p className="font-semibold">Best Time: {getBestTime()} seconds</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {interpretation && (
              <Card className={`${interpretation.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-xl ${interpretation.color}`}>
                    {interpretation.level}
                  </CardTitle>
                </CardHeader>
                <CardContent className={interpretation.color}>
                  <p>Average time: {calculateAverage()} seconds over {trials.length} trial(s)</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Safety Observations</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={safetyObservations}
                  onChange={(e) => setSafetyObservations(e.target.value)}
                  placeholder="Gait pattern, balance, step-over-step vs step-to pattern, safety concerns..."
                  rows={3}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Overall observations, functional implications, recommendations..."
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
            Save TUDS Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}