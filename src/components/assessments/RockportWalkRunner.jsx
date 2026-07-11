import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Play, Pause, RotateCcw, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function RockportWalkRunner({ client, onSave, onClose }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [walkTime, setWalkTime] = useState("");
  const [endHR, setEndHR] = useState("");
  const [weight, setWeight] = useState("");
  const [rpe, setRPE] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => setElapsedSeconds(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateVO2max = () => {
    const time = parseFloat(walkTime);
    const hr = parseFloat(endHR);
    const weightKg = parseFloat(weight);
    if (!time || !hr || !weightKg || !client?.gender || !client?.date_of_birth) return null;

    const age = new Date().getFullYear() - new Date(client.date_of_birth).getFullYear();
    const weightLbs = weightKg * 2.20462;
    const gender = client.gender === 'male' ? 1 : 0;
    const vo2max = 132.853 - (0.0769 * weightLbs) - (0.3877 * age) + (6.315 * gender) - (3.2649 * time) - (0.1565 * hr);
    return vo2max.toFixed(1);
  };

  const getFitnessCategory = (vo2max) => {
    if (!vo2max || !client?.date_of_birth || !client?.gender) return null;
    const age = new Date().getFullYear() - new Date(client.date_of_birth).getFullYear();
    const isMale = client.gender === 'male';
    const vo2 = parseFloat(vo2max);

    if (isMale) {
      if (age < 40) {
        if (vo2 >= 52) return { category: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
        if (vo2 >= 45) return { category: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
        if (vo2 >= 38) return { category: 'Average', color: 'text-yellow-600', bg: 'bg-yellow-50' };
        if (vo2 >= 33) return { category: 'Fair', color: 'text-orange-600', bg: 'bg-orange-50' };
        return { category: 'Poor', color: 'text-red-600', bg: 'bg-red-50' };
      } else if (age < 60) {
        if (vo2 >= 46) return { category: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
        if (vo2 >= 39) return { category: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
        if (vo2 >= 32) return { category: 'Average', color: 'text-yellow-600', bg: 'bg-yellow-50' };
        if (vo2 >= 27) return { category: 'Fair', color: 'text-orange-600', bg: 'bg-orange-50' };
        return { category: 'Poor', color: 'text-red-600', bg: 'bg-red-50' };
      } else {
        if (vo2 >= 37) return { category: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
        if (vo2 >= 31) return { category: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
        if (vo2 >= 25) return { category: 'Average', color: 'text-yellow-600', bg: 'bg-yellow-50' };
        if (vo2 >= 20) return { category: 'Fair', color: 'text-orange-600', bg: 'bg-orange-50' };
        return { category: 'Poor', color: 'text-red-600', bg: 'bg-red-50' };
      }
    } else {
      if (age < 40) {
        if (vo2 >= 45) return { category: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
        if (vo2 >= 38) return { category: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
        if (vo2 >= 31) return { category: 'Average', color: 'text-yellow-600', bg: 'bg-yellow-50' };
        if (vo2 >= 27) return { category: 'Fair', color: 'text-orange-600', bg: 'bg-orange-50' };
        return { category: 'Poor', color: 'text-red-600', bg: 'bg-red-50' };
      } else if (age < 60) {
        if (vo2 >= 38) return { category: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
        if (vo2 >= 31) return { category: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
        if (vo2 >= 25) return { category: 'Average', color: 'text-yellow-600', bg: 'bg-yellow-50' };
        if (vo2 >= 21) return { category: 'Fair', color: 'text-orange-600', bg: 'bg-orange-50' };
        return { category: 'Poor', color: 'text-red-600', bg: 'bg-red-50' };
      } else {
        if (vo2 >= 32) return { category: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
        if (vo2 >= 26) return { category: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
        if (vo2 >= 21) return { category: 'Average', color: 'text-yellow-600', bg: 'bg-yellow-50' };
        if (vo2 >= 17) return { category: 'Fair', color: 'text-orange-600', bg: 'bg-orange-50' };
        return { category: 'Poor', color: 'text-red-600', bg: 'bg-red-50' };
      }
    }
  };

  const estimatedVO2max = calculateVO2max();
  const fitnessCategory = estimatedVO2max ? getFitnessCategory(estimatedVO2max) : null;

  const handleSave = () => {
    if (!walkTime || !endHR || !weight) {
      toast.error("Please enter walk time, end HR, and weight");
      return;
    }
    if (!estimatedVO2max) {
      toast.error("Unable to calculate VO2max - please check all values");
      return;
    }

    const soapText = [
      `• Rockport 1-Mile Walk Test`,
      `  Walk Time: ${walkTime} min | Final HR: ${endHR} bpm | Weight: ${weight} kg`,
      `  Estimated VO2max: ${estimatedVO2max} mL/kg/min`,
      fitnessCategory ? `  Fitness Category: ${fitnessCategory.category}` : null,
      rpe ? `  RPE: ${rpe}/20` : null,
      symptoms ? `  Symptoms: ${symptoms}` : null,
      notes ? `  Clinical Notes: ${notes}` : null,
      `  MCID: ~3.5 mL/kg/min VO2max`,
      `  Reference: Kline et al. (1987). Estimation of VO2max from a one-mile track walk. Med Sci Sports Exerc, 19(3), 253-259.`,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: parseFloat(estimatedVO2max),
      additional_data: {
        soap_text: soapText,
        walk_time_minutes: parseFloat(walkTime),
        end_heart_rate: parseFloat(endHR),
        weight_kg: parseFloat(weight),
        estimated_vo2max: parseFloat(estimatedVO2max),
        fitness_category: fitnessCategory?.category,
        rpe: rpe ? parseFloat(rpe) : null,
        symptoms: symptoms
      },
      notes: notes,
      assessment_date: todayLocal(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Rockport 1-Mile Walk Test</h2>
              <p className="text-slate-600 mt-1">Submaximal walking test for VO2max estimation</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
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
              <CardContent className="text-sm text-blue-800">
                <p>Have client walk 1 mile (1.6 km) as fast as possible without running. Record total time and heart rate immediately upon completion. Use Rockport equation to estimate VO2max.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Test Timer</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-6">
                  <div className="text-5xl font-bold text-green-600 font-mono">
                    {formatTime(elapsedSeconds)}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button type="button" onClick={() => setIsRunning(!isRunning)} variant={isRunning ? "destructive" : "default"}>
                      {isRunning ? <><Pause className="w-4 h-4 mr-2" />Stop</> : <><Play className="w-4 h-4 mr-2" />Start</>}
                    </Button>
                    <Button type="button" onClick={() => { setIsRunning(false); setElapsedSeconds(0); }} variant="outline">
                      <RotateCcw className="w-4 h-4 mr-2" />Reset
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Test Results</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Walk Time (minutes) *</Label>
                  <div className="flex gap-2">
                    <Input type="number" step="0.1" value={walkTime} onChange={(e) => setWalkTime(e.target.value)} placeholder="e.g., 14.5" className="mt-1" />
                    <Button type="button" variant="secondary" onClick={() => setWalkTime((elapsedSeconds / 60).toFixed(2))} disabled={elapsedSeconds === 0}>
                      Use Timer
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>End Heart Rate (bpm) *</Label>
                  <Input type="number" value={endHR} onChange={(e) => setEndHR(e.target.value)} placeholder="Record immediately after completion" className="mt-1" />
                </div>
                <div>
                  <Label>Body Weight (kg) *</Label>
                  <Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Required for VO2max calculation" className="mt-1" />
                </div>
                <div>
                  <Label>RPE (6-20)</Label>
                  <Input type="number" min="6" max="20" value={rpe} onChange={(e) => setRPE(e.target.value)} placeholder="Rate of Perceived Exertion" className="mt-1" />
                </div>
                <div>
                  <Label>Symptoms</Label>
                  <Textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="Chest pain, dizziness, excessive dyspnoea..." rows={2} />
                </div>
              </CardContent>
            </Card>

            {estimatedVO2max && fitnessCategory && (
              <Card className={`${fitnessCategory.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-xl ${fitnessCategory.color}`}>
                    Estimated VO2max: {estimatedVO2max} ml/kg/min
                  </CardTitle>
                </CardHeader>
                <CardContent className={fitnessCategory.color}>
                  <p className="font-semibold text-lg">Fitness Category: {fitnessCategory.category}</p>
                  <p className="text-sm mt-2">Time: {walkTime} min | End HR: {endHR} bpm</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="text-lg">Clinical Notes</CardTitle></CardHeader>
              <CardContent>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Gait quality, pacing strategy, cardiovascular response..." rows={3} />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!walkTime || !endHR || !weight} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            Save Rockport Test
          </Button>
        </div>
      </div>
    </div>
  );
}