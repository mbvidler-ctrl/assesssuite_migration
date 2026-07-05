import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Play, Pause, RotateCcw, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function SixMinuteStepRunner({ onSave, onClose }) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [stepHeight, setStepHeight] = useState('20');
  const [totalSteps, setTotalSteps] = useState('');
  
  const [baselineHR, setBaselineHR] = useState('');
  const [baselineBPSys, setBaselineBPSys] = useState('');
  const [baselineBPDia, setBaselineBPDia] = useState('');
  const [baselineSpO2, setBaselineSpO2] = useState('');
  
  const [postHR, setPostHR] = useState('');
  const [postSpO2, setPostSpO2] = useState('');
  const [postRPE, setPostRPE] = useState('');
  const [postDyspnea, setPostDyspnea] = useState('');
  
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev >= 360) {
            setTimerRunning(false);
            toast.success("6 minutes complete!");
            return 360;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSave = () => {
    if (!totalSteps) {
      toast.error("Please enter total steps completed");
      return;
    }

    const soapText = [
      `• 6-Minute Step Test`,
      `  Total Steps: ${totalSteps} | Step Height: ${stepHeight}cm`,
      baselineHR ? `  Pre-Test: HR ${baselineHR} bpm, SpO2 ${baselineSpO2}%, BP ${baselineBPSys}/${baselineBPDia}` : null,
      postHR ? `  Post-Test: HR ${postHR} bpm, SpO2 ${postSpO2}%, RPE ${postRPE}, Dyspnea ${postDyspnea}/10` : null,
      symptoms ? `  Symptoms: ${symptoms}` : null,
      notes ? `  Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: parseInt(totalSteps),
      total_steps: parseInt(totalSteps),
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0],
      additional_data: {
        soap_text: soapText,
        measurement_type: 'six_minute_step',
        total_steps: parseInt(totalSteps),
        step_height_cm: parseFloat(stepHeight),
        baseline_hr: baselineHR ? parseInt(baselineHR) : null,
        baseline_bp_sys: baselineBPSys ? parseInt(baselineBPSys) : null,
        baseline_bp_dia: baselineBPDia ? parseInt(baselineBPDia) : null,
        baseline_spo2: baselineSpO2 ? parseInt(baselineSpO2) : null,
        post_hr: postHR ? parseInt(postHR) : null,
        post_spo2: postSpO2 ? parseInt(postSpO2) : null,
        post_rpe: postRPE ? parseInt(postRPE) : null,
        post_dyspnea: postDyspnea ? parseInt(postDyspnea) : null,
        symptoms: symptoms,
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">6-Minute Step Test</h2>
              <p className="text-slate-600 mt-1">Functional aerobic capacity assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <Card className="bg-amber-50 border-amber-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Safety Precautions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-amber-800">
                <p>Do NOT test if: unstable angina, uncontrolled arrhythmias, resting SpO2 &lt;90%, acute cardiac or pulmonary conditions, or unsafe balance.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Test Setup</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label>Step Height (cm)</Label>
                  <Input
                    type="number"
                    value={stepHeight}
                    onChange={(e) => setStepHeight(e.target.value)}
                    placeholder="20-25"
                    className="mt-1 w-32"
                  />
                  <p className="text-xs text-slate-500 mt-1">Standard: 20-25 cm</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Baseline Measurements</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Heart Rate (bpm)</Label>
                  <Input
                    type="number"
                    value={baselineHR}
                    onChange={(e) => setBaselineHR(e.target.value)}
                    placeholder="e.g., 72"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>SpO2 (%)</Label>
                  <Input
                    type="number"
                    value={baselineSpO2}
                    onChange={(e) => setBaselineSpO2(e.target.value)}
                    placeholder="e.g., 98"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>BP Systolic (mmHg)</Label>
                  <Input
                    type="number"
                    value={baselineBPSys}
                    onChange={(e) => setBaselineBPSys(e.target.value)}
                    placeholder="e.g., 120"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>BP Diastolic (mmHg)</Label>
                  <Input
                    type="number"
                    value={baselineBPDia}
                    onChange={(e) => setBaselineBPDia(e.target.value)}
                    placeholder="e.g., 80"
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg text-center">6-Minute Timer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <div className="text-6xl font-bold text-emerald-600 font-mono">
                    {formatTime(timerSeconds)}
                  </div>
                  <p className="text-sm text-slate-600 mt-2">
                    {timerSeconds >= 360 ? 'Test Complete!' : `${360 - timerSeconds} seconds remaining`}
                  </p>
                </div>
                <div className="flex justify-center gap-3">
                  <Button
                    onClick={() => setTimerRunning(!timerRunning)}
                    variant={timerRunning ? 'destructive' : 'default'}
                    size="lg"
                    disabled={timerSeconds >= 360}
                  >
                    {timerRunning ? (
                      <>
                        <Pause className="w-5 h-5 mr-2" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 mr-2" />
                        {timerSeconds > 0 ? 'Resume' : 'Start'}
                      </>
                    )}
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Total Steps Completed *</Label>
                  <Input
                    type="number"
                    value={totalSteps}
                    onChange={(e) => setTotalSteps(e.target.value)}
                    placeholder="Count total up steps"
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Post-Test Measurements</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Heart Rate (bpm)</Label>
                  <Input
                    type="number"
                    value={postHR}
                    onChange={(e) => setPostHR(e.target.value)}
                    placeholder="Immediate post-test"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>SpO2 (%)</Label>
                  <Input
                    type="number"
                    value={postSpO2}
                    onChange={(e) => setPostSpO2(e.target.value)}
                    placeholder="Immediate post-test"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>RPE (6-20)</Label>
                  <Input
                    type="number"
                    value={postRPE}
                    onChange={(e) => setPostRPE(e.target.value)}
                    placeholder="Borg scale"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Dyspnea (0-10)</Label>
                  <Input
                    type="number"
                    value={postDyspnea}
                    onChange={(e) => setPostDyspnea(e.target.value)}
                    placeholder="Breathlessness"
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Symptoms & Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Symptoms During Test</Label>
                  <Textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="Chest discomfort, dizziness, excessive dyspnoea, none..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Clinical Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Test quality, stepping pattern, balance issues, recommendations..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave}
            disabled={!totalSteps}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save 6-Min Step Test
          </Button>
        </div>
      </div>
    </div>
  );
}