import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Play, Pause, RotateCcw, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const NORMATIVE_DATA = [
  { sex: "male", age_min: 60, age_max: 64, low: 16, mid_low: 16, mid_high: 22, high: 22 },
  { sex: "male", age_min: 65, age_max: 69, low: 15, mid_low: 15, mid_high: 21, high: 21 },
  { sex: "male", age_min: 70, age_max: 74, low: 14, mid_low: 14, mid_high: 21, high: 21 },
  { sex: "male", age_min: 75, age_max: 79, low: 13, mid_low: 13, mid_high: 19, high: 19 },
  { sex: "male", age_min: 80, age_max: 84, low: 13, mid_low: 13, mid_high: 19, high: 19 },
  { sex: "male", age_min: 85, age_max: 89, low: 11, mid_low: 11, mid_high: 17, high: 17 },
  { sex: "male", age_min: 90, age_max: 94, low: 10, mid_low: 10, mid_high: 14, high: 14 },
  { sex: "female", age_min: 60, age_max: 64, low: 13, mid_low: 13, mid_high: 19, high: 19 },
  { sex: "female", age_min: 65, age_max: 69, low: 12, mid_low: 12, mid_high: 18, high: 18 },
  { sex: "female", age_min: 70, age_max: 74, low: 12, mid_low: 12, mid_high: 17, high: 17 },
  { sex: "female", age_min: 75, age_max: 79, low: 11, mid_low: 11, mid_high: 17, high: 17 },
  { sex: "female", age_min: 80, age_max: 84, low: 10, mid_low: 10, mid_high: 16, high: 16 },
  { sex: "female", age_min: 85, age_max: 89, low: 10, mid_low: 10, mid_high: 16, high: 16 },
  { sex: "female", age_min: 90, age_max: 94, low: 8, mid_low: 8, mid_high: 13, high: 13 }
];

export default function ArmCurlRunner({ client, onSave, onClose }) {
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [sex, setSex] = useState(client?.gender || 'male');
  const [age, setAge] = useState(null);
  const [dominantSide, setDominantSide] = useState('right');
  const [testedSide, setTestedSide] = useState('right');
  const [weightKg, setWeightKg] = useState('');
  const [rightReps, setRightReps] = useState('');
  const [leftReps, setLeftReps] = useState('');

  useEffect(() => {
    if (client?.date_of_birth) {
      const dob = new Date(client.date_of_birth);
      const today = new Date();
      const calculatedAge = today.getFullYear() - dob.getFullYear();
      setAge(calculatedAge);
    }
  }, [client]);

  useEffect(() => {
    if (sex === 'male') {
      setWeightKg('4');
    } else {
      setWeightKg('2');
    }
  }, [sex]);

  useEffect(() => {
    let interval;
    if (isRunning && timerSeconds < 30) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          const newTime = prev + 0.1;
          if (newTime >= 30) {
            setIsRunning(false);
            toast.success("30 seconds complete! Stop the test.");
          }
          return Math.min(newTime, 30);
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isRunning, timerSeconds]);

  const getNormativeComparison = () => {
    if (!age || (!rightReps && !leftReps)) return null;
    
    const primaryReps = testedSide === 'right' ? parseFloat(rightReps) : parseFloat(leftReps);
    if (!primaryReps) return null;

    const norm = NORMATIVE_DATA.find(n => 
      n.sex === sex && age >= n.age_min && age <= n.age_max
    );

    if (!norm) return null;

    let category, color, bg;
    if (primaryReps < norm.low) {
      category = "Below Average";
      color = "text-red-600";
      bg = "bg-red-50";
    } else if (primaryReps <= norm.mid_high) {
      category = "Average";
      color = "text-green-600";
      bg = "bg-green-50";
    } else {
      category = "Above Average";
      color = "text-blue-600";
      bg = "bg-blue-50";
    }

    return { category, color, bg, norm };
  };

  const handleSave = () => {
    const primaryReps = testedSide === 'right' ? parseFloat(rightReps) : parseFloat(leftReps);
    if (isNaN(primaryReps)) {
      toast.error("Enter repetitions for the selected primary side before saving.");
      return;
    }
    const asymmetry = (rightReps && leftReps) ? Math.abs(parseFloat(rightReps) - parseFloat(leftReps)) : 0;
    const comparison = getNormativeComparison();

    const soapText = [
      `• 30-Second Seated Arm Curl Test`,
      `  Right Arm: ${rightReps || 'NR'} reps | Left Arm: ${leftReps || 'NR'} reps`,
      `  Weight Used: ${weightKg} kg | Primary Side: ${testedSide} (${primaryReps} reps)`,
      comparison ? `  Normative Category: ${comparison.category}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: primaryReps,
      additional_data: {
        measurement_type: 'arm_curl',
        soap_text: soapText,
        primary_side_reps: primaryReps,
        right_arm_reps: rightReps ? parseFloat(rightReps) : null,
        left_arm_reps: leftReps ? parseFloat(leftReps) : null,
        asymmetry_reps: asymmetry,
        sex,
        age,
        dominant_side: dominantSide,
        tested_side_primary: testedSide,
        weight_used_kg: parseFloat(weightKg),
        normative_category: comparison?.category || null,
        test_duration: 30
      },
      assessment_date: todayLocal()
    });
  };

  const comparison = getNormativeComparison();

  return (
    <div className="bg-white rounded-xl w-full max-h-[85vh] overflow-hidden flex flex-col">
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">30-Second Seated Arm Curl Test</h2>
              <p className="text-slate-600 mt-1">Upper body strength and endurance assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <div className="space-y-6">
            {/* Protocol Instructions */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Test Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-blue-800">
                <div>
                  <strong>Setup:</strong>
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                    <li>Chair against wall (seat ~43-45cm height)</li>
                    <li>Client sits with back straight, feet flat, hip-width apart</li>
                    <li>Test arm down at side, elbow extended, palm facing in</li>
                    <li>Non-test hand rests on thigh or holds chair</li>
                  </ul>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900">
                  <strong>Standard Weights:</strong>
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                    <li><strong>Males:</strong> 8 lbs (3.6 kg) — select the closest available weight (4 kg)</li>
                    <li><strong>Females:</strong> 5 lbs (2.3 kg) — select the closest available weight (2 kg)</li>
                  </ul>
                  <p className="text-xs mt-1 text-amber-700">Record the exact weight used below for documentation accuracy.</p>
                </div>
                <div>
                  <strong>Clinician Script:</strong>
                  <p className="italic mt-1 bg-white/70 p-3 rounded">
                    "I am going to ask you to do as many arm curls as you can in 30 seconds. Start with your arm straight down by your side, holding the weight with your palm facing in. When I say 'Go', curl the weight up by bending your elbow and turning your palm toward your shoulder, then lower it back down. That counts as one repetition. Do as many complete curls as you can in 30 seconds using good control. We will practice one or two repetitions first."
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Client Info */}
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Sex</Label>
                <Select value={sex} onValueChange={setSex}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male (4 kg weight)</SelectItem>
                    <SelectItem value="female">Female (2 kg weight)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Age (years)</Label>
                <Input
                  type="number"
                  value={age || ''}
                  onChange={(e) => setAge(parseFloat(e.target.value))}
                  className="mt-1"
                  placeholder="e.g., 72"
                />
              </div>
              <div>
                <Label>Weight Used</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="mt-1"
                  placeholder="2 or 4"
                />
                {weightKg && (
                  <p className="text-xs text-slate-500 mt-1">
                    {parseFloat(weightKg).toFixed(1)} kg = {(parseFloat(weightKg) * 2.205).toFixed(1)} lbs
                  </p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Dominant Arm</Label>
                <Select value={dominantSide} onValueChange={setDominantSide}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="right">Right</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="ambidextrous">Ambidextrous</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Primary Side for Comparison</Label>
                <Select value={testedSide} onValueChange={setTestedSide}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="right">Right</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Timer */}
            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <CardContent className="py-6">
                <div className="text-center">
                  <div className="text-6xl font-bold font-mono mb-2">
                    {timerSeconds.toFixed(1)}s
                  </div>
                  <div className="text-lg mb-4">
                    {timerSeconds < 30 ? `${(30 - timerSeconds).toFixed(1)}s remaining` : 'Test Complete!'}
                  </div>
                  <div className="flex justify-center gap-3">
                    <Button
                      onClick={() => setIsRunning(!isRunning)}
                      variant={isRunning ? "destructive" : "secondary"}
                      size="lg"
                    >
                      {isRunning ? (
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
                      onClick={() => {
                        setIsRunning(false);
                        setTimerSeconds(0);
                      }}
                      variant="outline"
                      size="lg"
                      className="bg-white/10 hover:bg-white/20 text-white border-white/30"
                    >
                      <RotateCcw className="w-5 h-5 mr-2" />
                      Reset
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results Entry */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <Label htmlFor="right_reps" className="text-lg font-semibold">Right Arm Repetitions</Label>
                <Input
                  id="right_reps"
                  type="number"
                  min="0"
                  max="60"
                  value={rightReps}
                  onChange={(e) => setRightReps(e.target.value)}
                  className="mt-2 text-2xl font-bold text-center"
                  placeholder="0"
                />
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <Label htmlFor="left_reps" className="text-lg font-semibold">Left Arm Repetitions</Label>
                <Input
                  id="left_reps"
                  type="number"
                  min="0"
                  max="60"
                  value={leftReps}
                  onChange={(e) => setLeftReps(e.target.value)}
                  className="mt-2 text-2xl font-bold text-center"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Asymmetry Alert */}
            {rightReps && leftReps && Math.abs(parseFloat(rightReps) - parseFloat(leftReps)) >= 3 && (
              <Card className="bg-amber-50 border-amber-300">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <p className="text-amber-900 font-semibold">
                      Side-to-side difference: {Math.abs(parseFloat(rightReps) - parseFloat(leftReps))} reps
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Normative Comparison */}
            {comparison && (
              <Card className={`${comparison.bg} border-2`}>
                <CardHeader>
                  <CardTitle className="text-lg">Normative Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700">Primary Side Score:</span>
                      <span className="text-2xl font-bold">
                        {testedSide === 'right' ? rightReps : leftReps} reps
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700">Category:</span>
                      <Badge className={`${comparison.color} text-lg px-3 py-1`}>
                        {comparison.category}
                      </Badge>
                    </div>
                    <div className="text-sm text-slate-600 mt-3 pt-3 border-t">
                      <p>
                        <strong>Norms for {sex}, age {age}:</strong> 
                        Low: &lt;{comparison.norm.low} | Average: {comparison.norm.mid_low}-{comparison.norm.mid_high} | High: &gt;{comparison.norm.high}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Safety Notes */}
            <Card className="bg-amber-50 border-amber-200">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Safety & Scoring
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-amber-800 space-y-1">
                <p>• Only count full, controlled curls (extension to flexion to full return)</p>
                <p>• Do not count partial reps or those in progress at 30 seconds</p>
                <p>• Stop if client reports chest pain, severe breathlessness, or joint pain</p>
                <p>• No body swinging or momentum - movement should be smooth and controlled</p>
              </CardContent>
            </Card>

            {/* Reference */}
            <Card className="bg-slate-100 border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">📖 Reference</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-1">
                <p>Rikli RE & Jones CJ. (1999). Development and validation of a functional fitness test for community-residing older adults. <em>Journal of Aging and Physical Activity, 7</em>(2), 129–161.</p>
                <p>Rikli RE & Jones CJ. (2013). <em>Senior Fitness Test Manual</em> (2nd ed.). Human Kinetics. [Normative data source for 30-second arm curl by age and sex]</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center shrink-0">
           <Button variant="outline" onClick={onClose}>
             Cancel
           </Button>
           <Button 
             onClick={handleSave} 
             disabled={false}
             className="bg-blue-600 hover:bg-blue-700"
           >
             <Save className="w-4 h-4 mr-2" />
             Save Results
           </Button>
         </div>
        </div>
        </div>
        );
        }