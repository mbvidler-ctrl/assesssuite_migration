import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Play, Pause, RotateCcw, Info } from "lucide-react";
import { toast } from "sonner";

export default function YMCA3MinStepRunner({ client, onSave, onClose }) {
  const [timeRemaining, setTimeRemaining] = useState(180); // 3 minutes
  const [isRunning, setIsRunning] = useState(false);
  const [postExerciseHR, setPostExerciseHR] = useState("");
  const [rpe, setRPE] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let interval;
    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            toast.success("3 minutes complete! Record heart rate immediately.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeRemaining]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getFitnessCategory = () => {
    const hr = parseFloat(postExerciseHR);
    if (!hr || !client?.date_of_birth || !client?.gender) return null;

    const age = new Date().getFullYear() - new Date(client.date_of_birth).getFullYear();
    const isMale = client.gender === 'male';

    // YMCA normative data approximations
    if (age < 30) {
      if (isMale) {
        if (hr < 80) return { category: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
        if (hr < 90) return { category: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
        if (hr < 100) return { category: 'Average', color: 'text-yellow-600', bg: 'bg-yellow-50' };
        if (hr < 110) return { category: 'Below Average', color: 'text-orange-600', bg: 'bg-orange-50' };
        return { category: 'Poor', color: 'text-red-600', bg: 'bg-red-50' };
      } else {
        if (hr < 85) return { category: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
        if (hr < 95) return { category: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
        if (hr < 105) return { category: 'Average', color: 'text-yellow-600', bg: 'bg-yellow-50' };
        if (hr < 115) return { category: 'Below Average', color: 'text-orange-600', bg: 'bg-orange-50' };
        return { category: 'Poor', color: 'text-red-600', bg: 'bg-red-50' };
      }
    } else if (age < 50) {
      if (isMale) {
        if (hr < 85) return { category: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
        if (hr < 95) return { category: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
        if (hr < 105) return { category: 'Average', color: 'text-yellow-600', bg: 'bg-yellow-50' };
        if (hr < 115) return { category: 'Below Average', color: 'text-orange-600', bg: 'bg-orange-50' };
        return { category: 'Poor', color: 'text-red-600', bg: 'bg-red-50' };
      } else {
        if (hr < 90) return { category: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
        if (hr < 100) return { category: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
        if (hr < 110) return { category: 'Average', color: 'text-yellow-600', bg: 'bg-yellow-50' };
        if (hr < 120) return { category: 'Below Average', color: 'text-orange-600', bg: 'bg-orange-50' };
        return { category: 'Poor', color: 'text-red-600', bg: 'bg-red-50' };
      }
    } else {
      if (isMale) {
        if (hr < 90) return { category: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
        if (hr < 100) return { category: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
        if (hr < 110) return { category: 'Average', color: 'text-yellow-600', bg: 'bg-yellow-50' };
        if (hr < 120) return { category: 'Below Average', color: 'text-orange-600', bg: 'bg-orange-50' };
        return { category: 'Poor', color: 'text-red-600', bg: 'bg-red-50' };
      } else {
        if (hr < 95) return { category: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
        if (hr < 105) return { category: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
        if (hr < 115) return { category: 'Average', color: 'text-yellow-600', bg: 'bg-yellow-50' };
        if (hr < 125) return { category: 'Below Average', color: 'text-orange-600', bg: 'bg-orange-50' };
        return { category: 'Poor', color: 'text-red-600', bg: 'bg-red-50' };
      }
    }
  };

  const fitnessCategory = getFitnessCategory();

  const handleSave = () => {
    if (!postExerciseHR) {
      toast.error("Please enter post-exercise heart rate");
      return;
    }

    onSave({
      result_value: parseFloat(postExerciseHR),
      additional_data: {
        post_exercise_hr: parseFloat(postExerciseHR),
        rpe: rpe ? parseFloat(rpe) : null,
        symptoms: symptoms,
        fitness_category: fitnessCategory?.category,
        step_height_inches: 12,
        cadence_bpm: 96,
        duration_seconds: 180
      },
      notes: notes,
      assessment_date: new Date().toISOString()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">YMCA 3-Minute Step Test</h2>
              <p className="text-slate-600 mt-1">Submaximal cardiovascular fitness test</p>
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
                  📋 Test Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>Setup:</strong> 12-inch (30.5 cm) step. Cadence: <strong>96 beats per minute (24 steps/min)</strong>. Duration: 3 minutes continuous stepping. Use metronome.</p>
                <p><strong>Step pattern:</strong> Up-up-down-down to 4-count beat. Client must maintain tempo throughout.</p>
                <p className="italic">"Step up and down on the step, keeping time with the metronome. Right foot up, left foot up, right foot down, left foot down. Continue for 3 minutes."</p>
                <p><strong>Immediately after:</strong> Client sits. Count pulse for <strong>60 seconds</strong> starting within 5 seconds of stopping. Lower HR = better cardiovascular fitness.</p>
                <p><strong>Stop criteria:</strong> Excessive dyspnoea, chest pain, dizziness, client request.</p>
              </CardContent>
            </Card>

            {/* Norms */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Norms — YMCA Step Test (1-min recovery HR, bpm)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Category</th><th className="p-2 text-center">Men 18–29</th><th className="p-2 text-center">Men 40–49</th><th className="p-2 text-center">Women 18–29</th><th className="p-2 text-center">Women 40–49</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">Excellent</td><td className="p-2 text-center">&lt;79</td><td className="p-2 text-center">&lt;85</td><td className="p-2 text-center">&lt;85</td><td className="p-2 text-center">&lt;91</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">Good</td><td className="p-2 text-center">80–89</td><td className="p-2 text-center">86–94</td><td className="p-2 text-center">86–97</td><td className="p-2 text-center">92–102</td></tr>
                    <tr className="border-t"><td className="p-2">Average</td><td className="p-2 text-center">90–99</td><td className="p-2 text-center">95–104</td><td className="p-2 text-center">98–108</td><td className="p-2 text-center">103–112</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">Poor</td><td className="p-2 text-center">≥100</td><td className="p-2 text-center">≥105</td><td className="p-2 text-center">≥109</td><td className="p-2 text-center">≥113</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">Lower recovery HR = better cardiovascular fitness. Source: Golding et al. (2000) YMCA Fitness Testing Manual.</p>
            </div>

            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>Golding LA, Myers CR, & Sinning WE. (2000). <em>YMCA Fitness Testing and Assessment Manual</em> (4th ed.). Human Kinetics.</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">3-Minute Timer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-6">
                  <div className="text-6xl font-bold text-blue-600 font-mono">
                    {formatTime(timeRemaining)}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      onClick={() => setIsRunning(!isRunning)}
                      variant={isRunning ? "destructive" : "default"}
                      disabled={timeRemaining === 0}
                    >
                      {isRunning ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                      {isRunning ? 'Pause' : 'Start'}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setIsRunning(false);
                        setTimeRemaining(180);
                      }}
                      variant="outline"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset
                    </Button>
                  </div>
                </div>
                {timeRemaining === 0 && (
                  <p className="mt-4 text-center text-green-600 font-semibold text-lg">
                    ✓ Test Complete! Record heart rate NOW (first 5 seconds)
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Post-Exercise Measurements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Post-Exercise Heart Rate (bpm) *</Label>
                  <Input
                    type="number"
                    value={postExerciseHR}
                    onChange={(e) => setPostExerciseHR(e.target.value)}
                    placeholder="Record within first 5 seconds"
                    className="mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Count pulse for 5 seconds, multiply by 12</p>
                </div>

                <div>
                  <Label>RPE (6-20)</Label>
                  <Input
                    type="number"
                    min="6"
                    max="20"
                    value={rpe}
                    onChange={(e) => setRPE(e.target.value)}
                    placeholder="Rate of Perceived Exertion"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Symptoms During Test</Label>
                  <Textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="Dizziness, chest pain, excessive dyspnoea..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {fitnessCategory && (
              <Card className={`${fitnessCategory.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-lg ${fitnessCategory.color}`}>
                    Fitness Category: {fitnessCategory.category}
                  </CardTitle>
                </CardHeader>
                <CardContent className={fitnessCategory.color}>
                  <p className="text-sm">Post-exercise HR: {postExerciseHR} bpm</p>
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
                  placeholder="Gait quality, breathing pattern, any modifications..."
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
            disabled={!postExerciseHR}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save YMCA Step Test
          </Button>
        </div>
      </div>
    </div>
  );
}