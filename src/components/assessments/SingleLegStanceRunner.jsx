import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info, Play, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function SingleLegStanceRunner({ onSave, onClose }) {
  const [side, setSide] = useState("right");
  const [eyesOpen, setEyesOpen] = useState(true);
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

  const formatTime = (seconds) => {
    return `${seconds.toFixed(2)}s`;
  };

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
      setTrials([...trials, { 
        side, 
        eyesOpen, 
        time: currentTime,
        timestamp: new Date().toISOString()
      }]);
      setCurrentTime(0);
    }
  };

  const removeTrial = (index) => {
    setTrials(trials.filter((_, i) => i !== index));
  };

  const getBestTime = () => {
    if (trials.length === 0) return 0;
    return Math.max(...trials.map(t => t.time));
  };

  const getInterpretation = () => {
    const bestTime = getBestTime();
    if (!bestTime) return null;

    // General normative data (eyes open, adults)
    if (eyesOpen) {
      if (bestTime >= 30) return { level: 'Excellent', color: 'text-green-600', bg: 'bg-green-50', description: 'Balance is well above average' };
      if (bestTime >= 20) return { level: 'Good', color: 'text-blue-600', bg: 'bg-blue-50', description: 'Balance is above average' };
      if (bestTime >= 10) return { level: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-50', description: 'Balance is adequate but could be improved' };
      return { level: 'Poor', color: 'text-red-600', bg: 'bg-red-50', description: 'Balance requires significant improvement, fall risk elevated' };
    } else {
      // Eyes closed is more challenging
      if (bestTime >= 10) return { level: 'Excellent', color: 'text-green-600', bg: 'bg-green-50', description: 'Proprioceptive balance is excellent' };
      if (bestTime >= 5) return { level: 'Good', color: 'text-blue-600', bg: 'bg-blue-50', description: 'Proprioceptive balance is good' };
      return { level: 'Fair to Poor', color: 'text-yellow-600', bg: 'bg-yellow-50', description: 'Proprioceptive balance needs work' };
    }
  };

  const interpretation = trials.length > 0 ? getInterpretation() : null;

  const handleSave = () => {
    const soapText = [
      `• Single Leg Stance Test`,
      `  Best Time: ${getBestTime().toFixed(2)}s (${eyesOpen ? 'Eyes Open' : 'Eyes Closed'})`,
      interpretation ? `  Interpretation: ${interpretation.level}` : null,
      notes ? `  Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: getBestTime(),
      additional_data: {
        soap_text: soapText,
        best_time: getBestTime(),
        trials: trials,
        interpretation: interpretation?.level
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Single Leg Stance Test</h2>
              <p className="text-slate-600 mt-1">Static balance assessment</p>
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
                <p><strong>Instructions:</strong> Stand on one leg with hands on hips. Raise the opposite knee to approximately 45°. Hold as long as possible up to 60 seconds.</p>
                <p><strong>Termination:</strong> Stop when the raised foot touches the ground, hands leave hips, or stance foot moves.</p>
                <p><strong>Trials:</strong> Typically 3 trials per leg, record best time.</p>
                <p><strong>Eyes Open vs Closed:</strong> Eyes closed tests proprioceptive balance (much more challenging).</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Stance Leg</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant={side === "right" ? "default" : "outline"}
                      onClick={() => setSide("right")}
                      disabled={isRunning}
                    >
                      Right
                    </Button>
                    <Button
                      type="button"
                      variant={side === "left" ? "default" : "outline"}
                      onClick={() => setSide("left")}
                      disabled={isRunning}
                    >
                      Left
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Vision</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant={eyesOpen ? "default" : "outline"}
                      onClick={() => setEyesOpen(true)}
                      disabled={isRunning}
                    >
                      Eyes Open
                    </Button>
                    <Button
                      type="button"
                      variant={!eyesOpen ? "default" : "outline"}
                      onClick={() => setEyesOpen(false)}
                      disabled={isRunning}
                    >
                      Eyes Closed
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-blue-50">
              <CardHeader>
                <CardTitle className="text-lg">Timer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-6xl font-bold text-purple-600 mb-4">
                    {formatTime(currentTime)}
                  </div>
                  <div className="flex gap-2 justify-center">
                    {!isRunning ? (
                      <Button onClick={startTimer} size="lg" className="bg-purple-600 hover:bg-purple-700">
                        <Play className="w-5 h-5 mr-2" />
                        Start
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
                          <span className="text-slate-600 ml-3">
                            ({trial.side} leg, {trial.eyesOpen ? 'eyes open' : 'eyes closed'})
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
                  <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                    <p className="font-semibold text-purple-900">Best Time: {formatTime(getBestTime())}</p>
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
                  <p className="font-semibold">Best Time: {formatTime(getBestTime())}</p>
                  <p className="mt-2">{interpretation.description}</p>
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
                  placeholder="Balance strategies used, hip/ankle strategy, arm compensation, surface type..."
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
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}