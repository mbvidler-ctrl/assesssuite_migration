import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info, Play, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function GaitSpeedRunner({ onSave, onClose, assessmentName }) {
  const [speed, setSpeed] = useState("");
  const isFastGait = assessmentName?.toLowerCase().includes('fast');
  const is4Meter = assessmentName?.toLowerCase().includes('4-meter') || assessmentName?.toLowerCase().includes('4 meter') || assessmentName?.toLowerCase().includes('4-metre') || assessmentName?.toLowerCase().includes('4 metre') || assessmentName?.toLowerCase().includes('4meter');
  const testType = isFastGait ? "Fast" : is4Meter ? "4-Meter" : "Habitual";

  const [distance, setDistance] = useState(is4Meter ? "4" : "10");
  const [trials, setTrials] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [notes, setNotes] = useState("");
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (seconds) => `${seconds.toFixed(2)}s`;

  const startTimer = () => {
    setIsRunning(true);
    setCurrentTime(0);
    const startTime = Date.now();
    
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setCurrentTime(elapsed);
    }, 10);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
    
    if (currentTime > 0) {
      const dist = parseFloat(distance);
      const speed = dist / currentTime;
      setTrials([...trials, { 
        time: currentTime,
        distance: dist,
        speed: speed,
        timestamp: new Date().toISOString()
      }]);
      setCurrentTime(0);
    }
  };

  const removeTrial = (index) => {
    setTrials(trials.filter((_, i) => i !== index));
  };

  const getAverageSpeed = () => {
    if (trials.length === 0) return 0;
    const sum = trials.reduce((acc, t) => acc + t.speed, 0);
    return (sum / trials.length).toFixed(2);
  };

  const getInterpretation = () => {
    const avg = parseFloat(getAverageSpeed());
    if (!avg) return null;

    if (isFastGait) {
      // Fast gait speed norms (community-dwelling older adults)
      if (avg >= 1.3) return { level: 'Normal', color: 'text-green-600', bg: 'bg-green-50', description: 'Fast gait speed is normal for older adults' };
      if (avg >= 1.0) return { level: 'Mildly Impaired', color: 'text-yellow-600', bg: 'bg-yellow-50', description: 'Slightly below normal, monitor for decline' };
      return { level: 'Impaired', color: 'text-red-600', bg: 'bg-red-50', description: 'Below normal, increased fall risk and functional limitations' };
    } else {
      // Habitual/comfortable gait speed norms
      if (avg >= 1.0) return { level: 'Normal', color: 'text-green-600', bg: 'bg-green-50', description: 'Community ambulation speed, low fall risk' };
      if (avg >= 0.8) return { level: 'Limited Community', color: 'text-yellow-600', bg: 'bg-yellow-50', description: 'May have difficulty with community ambulation' };
      if (avg >= 0.4) return { level: 'Household Ambulation', color: 'text-orange-600', bg: 'bg-orange-50', description: 'Primarily household ambulator, elevated fall risk' };
      return { level: 'Severely Impaired', color: 'text-red-600', bg: 'bg-red-50', description: 'Severe mobility limitation, high fall risk' };
    }
  };

  const interpretation = trials.length > 0 ? getInterpretation() : null;

  const handleSave = () => {
    const avgSpeed = parseFloat(getAverageSpeed());
    const avgTime = trials.length > 0 ? (trials.reduce((acc, t) => acc + t.time, 0) / trials.length).toFixed(2) : null;
    
    // Build comprehensive SOAP text
    let soapText = `• ${testType} Gait Speed Test: ${avgSpeed} m/s\n`;
    soapText += `  Distance: ${distance}m\n`;
    soapText += `  Number of Trials: ${trials.length}\n`;
    soapText += `  Average Time: ${avgTime}s\n\n  Individual Trials:\n`;
    trials.forEach((trial, idx) => {
      soapText += `    Trial ${idx + 1}: ${trial.speed.toFixed(2)} m/s (${trial.time.toFixed(2)}s)\n`;
    });
    if (interpretation) soapText += `\n  Interpretation: ${interpretation.level}\n`;
    if (notes) soapText += `  Notes: ${notes}\n`;

    onSave({
      result_value: avgSpeed,
      notes: notes,
      additional_data: {
        soap_text: soapText,
        measurement_type: 'gait_speed',
        gait_type: testType.toLowerCase(),
        distance_meters: parseFloat(distance),
        trials: trials,
        average_speed_ms: avgSpeed,
        speed_mps: avgSpeed,
        interpretation: interpretation?.level,
        gait_distance: parseFloat(distance),
        average_time: avgTime,
      },
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-teal-50 to-green-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{is4Meter ? "4-Meter Gait Speed Test" : `${testType} Gait Speed Test`}</h2>
              <p className="text-slate-600 mt-1">Walking speed assessment</p>
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
                  Test Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                {is4Meter ? (
                  <>
                    <p><strong>Setup:</strong> Mark a 4-metre timed walkway. Allow a 2m acceleration zone before the start line and 2m deceleration zone after the finish line (total ~8m walking corridor).</p>
                    <p><strong>Instruction to client:</strong> "Walk at your normal, comfortable pace from one end to the other."</p>
                    <p><strong>Timing:</strong> Start timer when first foot crosses the 4m start line, stop when first foot crosses the 4m finish line.</p>
                    <p><strong>Trials:</strong> Perform 2–3 trials. Use the average. Allow 1 minute rest between trials.</p>
                    <p><strong>Interpretation:</strong> &lt;0.8 m/s = increased fall and hospitalisation risk; ≥1.0 m/s = community ambulation; &lt;0.6 m/s = high-risk, household ambulator.</p>
                  </>
                ) : (
                  <>
                    <p><strong>Setup:</strong> Mark a walking course (typically 4-10 meters). Add 2m acceleration and 2m deceleration zones.</p>
                    <p><strong>Habitual Speed:</strong> "Walk at your normal, comfortable pace"</p>
                    <p><strong>Fast Speed:</strong> "Walk as fast as you safely can" (not running)</p>
                    <p><strong>Timing:</strong> Start timer when first foot crosses start line, stop when first foot crosses finish line.</p>
                    <p><strong>Trials:</strong> Usually 2-3 trials, use average. Allow rest between trials.</p>
                    <p><strong>Clinical Significance:</strong> Gait speed is a powerful predictor of falls, hospitalization, and mortality in older adults.</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Distance (meters)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    placeholder="10"
                    disabled={isRunning || trials.length > 0}
                  />
                  <p className="text-xs text-slate-500 mt-1">Common distances: 4m, 6m, 10m</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-teal-50 to-green-50">
              <CardHeader>
                <CardTitle className="text-lg">Timer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-6xl font-bold text-teal-600 mb-4">
                    {formatTime(currentTime)}
                  </div>
                  <div className="flex gap-2 justify-center">
                    {!isRunning ? (
                      <Button onClick={startTimer} size="lg" className="bg-teal-600 hover:bg-teal-700">
                        <Play className="w-5 h-5 mr-2" />
                        Start Trial
                      </Button>
                    ) : (
                      <Button onClick={stopTimer} size="lg" variant="destructive">
                        <Square className="w-5 h-5 mr-2" />
                        Stop & Record
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {trials.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recorded Trials</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {trials.map((trial, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <span className="font-semibold">Trial {index + 1}:</span> {formatTime(trial.time)} 
                          <span className="text-teal-600 ml-3 font-semibold">
                            {trial.speed.toFixed(2)} m/s
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTrial(index)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-teal-50 rounded-lg">
                    <p className="font-semibold text-teal-900">Average Speed: {getAverageSpeed()} m/s</p>
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
                  <p className="font-semibold">Average Speed: {getAverageSpeed()} m/s</p>
                  <p className="mt-2">{interpretation.description}</p>
                  <div className="mt-3 p-3 bg-white/50 rounded">
                    <p className="text-xs"><strong>Clinical Note:</strong> Gait speed &lt;0.8 m/s indicates functional limitations and fall risk. Gait speed &gt;1.0 m/s generally indicates good mobility.</p>
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
                  placeholder="Gait pattern, assistive device used, balance confidence, pain during test..."
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
            disabled={false}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Gait Speed Test
          </Button>
        </div>
      </div>
    </div>
  );
}