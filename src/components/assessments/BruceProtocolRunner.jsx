import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info, Play, Pause, StopCircle, BookOpen, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const BRUCE_STAGES = [
  { stage: 1, speed: 1.7, grade: 10, mets: 4.6 },
  { stage: 2, speed: 2.5, grade: 12, mets: 7.0 },
  { stage: 3, speed: 3.4, grade: 14, mets: 10.1 },
  { stage: 4, speed: 4.2, grade: 16, mets: 13.0 },
  { stage: 5, speed: 5.0, grade: 18, mets: 15.5 },
  { stage: 6, speed: 5.5, grade: 20, mets: 18.0 },
  { stage: 7, speed: 6.0, grade: 22, mets: 20.5 }
];

export default function BruceProtocolRunner({ isModified, onSave, onClose }) {
  const [showInstructions, setShowInstructions] = useState(true);
  const [currentStage, setCurrentStage] = useState(isModified ? -1 : 0);
  const [stageTime, setStageTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [heartRate, setHeartRate] = useState('');
  const [bloodPressureSystolic, setBloodPressureSystolic] = useState('');
  const [bloodPressureDiastolic, setBloodPressureDiastolic] = useState('');
  const [rpe, setRPE] = useState('');
  const [terminationReason, setTerminationReason] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');
  const [stageData, setStageData] = useState([]);

  React.useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setStageTime(prev => prev + 1);
        setTotalTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  React.useEffect(() => {
    if (stageTime >= 180 && isRunning) {
      handleNextStage();
    }
  }, [stageTime, isRunning]);

  const handleNextStage = () => {
    const stages = isModified ? [
      { stage: 0, speed: 1.7, grade: 0, mets: 2.3 },
      { stage: 0.5, speed: 1.7, grade: 5, mets: 3.5 },
      ...BRUCE_STAGES
    ] : BRUCE_STAGES;

    if (currentStage < stages.length - 1) {
      setCurrentStage(prev => prev + 1);
      setStageTime(0);
    }
  };

  const recordStageData = () => {
    if (!heartRate) {
      toast.error("Please enter heart rate");
      return;
    }

    const stages = isModified ? [
      { stage: 0, speed: 1.7, grade: 0, mets: 2.3 },
      { stage: 0.5, speed: 1.7, grade: 5, mets: 3.5 },
      ...BRUCE_STAGES
    ] : BRUCE_STAGES;

    setStageData([...stageData, {
      stage: stages[currentStage].stage,
      time: Math.floor(totalTime / 60),
      heartRate: parseInt(heartRate),
      systolic: bloodPressureSystolic ? parseInt(bloodPressureSystolic) : null,
      diastolic: bloodPressureDiastolic ? parseInt(bloodPressureDiastolic) : null,
      rpe: rpe ? parseInt(rpe) : null
    }]);
    toast.success("Stage data recorded");
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const calculateVO2Max = () => {
    const minutes = totalTime / 60;
    return (14.8 - (1.379 * minutes) + (0.451 * minutes * minutes) - (0.012 * minutes * minutes * minutes)).toFixed(1);
  };

  const handleSave = () => {
    if (!terminationReason) {
      toast.error("Please select termination reason");
      return;
    }

    const peakHR = Math.max(...stageData.map(s => s.heartRate || 0), parseInt(heartRate) || 0);
    const peakBP = Math.max(...stageData.map(s => s.systolic || 0), parseInt(bloodPressureSystolic) || 0);

    const stageLines = stageData.map(s =>
      `  Stage ${s.stage} (${s.time} min): HR ${s.heartRate} bpm${s.systolic ? `, BP ${s.systolic}/${s.diastolic} mmHg` : ''}${s.rpe ? `, RPE ${s.rpe}` : ''}`
    ).join('\n');

    const soapText = `• ${isModified ? 'Modified ' : ''}Bruce Protocol Treadmill Test:\n  Total Time: ${Math.floor(totalTime / 60)}:${(totalTime % 60).toString().padStart(2, '0')} (${totalTime}s)\n  Estimated VO₂max: ${calculateVO2Max()} mL/kg/min\n  Stages Completed: ${currentStage + 1}\n  Peak HR: ${peakHR} bpm | Peak BP: ${peakBP} mmHg\n  Termination: ${terminationReason}${symptoms ? `\n  Symptoms: ${symptoms}` : ''}${stageLines ? `\n  Stage Data:\n${stageLines}` : ''}${notes ? `\n  Notes: ${notes}` : ''}`;

    onSave({
      result_value: totalTime,
      additional_data: {
        soap_text: soapText,
        protocol: isModified ? 'Modified Bruce' : 'Bruce',
        total_time_seconds: totalTime,
        stages_completed: currentStage + 1,
        stage_data: stageData,
        peak_heart_rate: peakHR,
        peak_systolic_bp: peakBP,
        estimated_vo2max: calculateVO2Max(),
        termination_reason: terminationReason,
      },
      notes,
      assessment_date: new Date().toISOString().split('T')[0],
    });
  };

  const stages = isModified ? [
    { stage: 0, speed: 1.7, grade: 0, mets: 2.3 },
    { stage: 0.5, speed: 1.7, grade: 5, mets: 3.5 },
    ...BRUCE_STAGES
  ] : BRUCE_STAGES;

  return (
    <div className="bg-white rounded-xl w-full flex flex-col overflow-hidden" style={{ maxHeight: "85vh" }}>
        <div className="p-6 border-b bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{isModified ? 'Modified ' : ''}Bruce Protocol</h2>
              <p className="text-slate-600 mt-1">Maximal graded treadmill exercise test · VO₂max estimation</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">

            {/* Collapsible Instructions */}
            <div className="border border-blue-200 rounded-lg bg-blue-50 overflow-hidden">
              <button
                className="w-full p-4 flex items-center justify-between text-left"
                onClick={() => setShowInstructions(!showInstructions)}
              >
                <span className="flex items-center gap-2 font-semibold text-blue-800">
                  <BookOpen className="w-4 h-4" />
                  Administration Instructions & Protocol Guide
                </span>
                {showInstructions ? <ChevronUp className="w-4 h-4 text-blue-600" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}
              </button>
              {showInstructions && (
                <div className="px-4 pb-4 space-y-4 text-sm text-blue-900">
                  <div>
                    <p className="font-semibold mb-1">Purpose</p>
                    <p className="text-blue-800">The Bruce Protocol is a maximal graded exercise test (GXT) used to estimate cardiorespiratory fitness (VO₂max) and evaluate cardiovascular response to exercise. It is widely used in clinical and research settings for adults with suspected or known coronary artery disease, and in healthy populations for fitness assessment.</p>
                  </div>

                  <div>
                    <p className="font-semibold mb-1">Equipment Required</p>
                    <ul className="list-disc list-inside text-blue-800 space-y-0.5">
                      <li>Motorised treadmill with adjustable speed (mph) and grade (%)</li>
                      <li>12-lead ECG or pulse oximeter (clinical setting)</li>
                      <li>Sphygmomanometer or automatic BP monitor</li>
                      <li>Stopwatch / timer</li>
                      <li>Borg RPE Scale (6–20) — displayed to client</li>
                      <li>Emergency equipment accessible (AED, oxygen)</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold mb-1">Pre-Test Preparation</p>
                    <ul className="list-disc list-inside text-blue-800 space-y-0.5">
                      <li>Client should fast 3 hours prior and avoid strenuous exercise for 24 hours</li>
                      <li>No smoking or caffeine within 3 hours of the test</li>
                      <li>Record resting HR, BP, SpO₂, and RPE before commencing</li>
                      <li>Resting systolic BP must be &lt;160 mmHg and diastolic &lt;100 mmHg</li>
                      <li>Complete ACSM risk stratification prior to test</li>
                      <li>Obtain written informed consent</li>
                    </ul>
                  </div>

                  <div className="bg-white border border-blue-200 rounded-lg p-3">
                    <p className="font-semibold text-blue-800 mb-2">{isModified ? "Modified Bruce Protocol Stages" : "Standard Bruce Protocol Stages"}</p>
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-blue-100">
                        <tr>
                          <th className="p-1.5 text-left">Stage</th>
                          <th className="p-1.5 text-left">Speed (mph)</th>
                          <th className="p-1.5 text-left">Grade (%)</th>
                          <th className="p-1.5 text-left">METs</th>
                          <th className="p-1.5 text-left">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isModified && (
                          <>
                            <tr className="border-t bg-yellow-50"><td className="p-1.5">0</td><td className="p-1.5">1.7</td><td className="p-1.5">0%</td><td className="p-1.5">~2.3</td><td className="p-1.5">3 min</td></tr>
                            <tr className="border-t"><td className="p-1.5">½</td><td className="p-1.5">1.7</td><td className="p-1.5">5%</td><td className="p-1.5">~3.5</td><td className="p-1.5">3 min</td></tr>
                          </>
                        )}
                        {BRUCE_STAGES.map(s => (
                          <tr key={s.stage} className="border-t even:bg-blue-50">
                            <td className="p-1.5">{s.stage}</td>
                            <td className="p-1.5">{s.speed}</td>
                            <td className="p-1.5">{s.grade}%</td>
                            <td className="p-1.5">{s.mets}</td>
                            <td className="p-1.5">3 min</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="font-semibold text-red-800 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Absolute Indications to Stop (ACSM)</p>
                    <ul className="list-disc list-inside text-red-800 text-xs space-y-0.5">
                      <li>Systolic BP &gt;250 mmHg or diastolic &gt;115 mmHg</li>
                      <li>Drop in systolic BP &gt;10 mmHg from baseline with increasing workload</li>
                      <li>Moderate–severe angina or chest pain</li>
                      <li>Signs of poor perfusion: cyanosis, pallor, cold/clammy skin</li>
                      <li>Sustained ventricular tachycardia (ECG)</li>
                      <li>Subject requests to stop</li>
                      <li>Technical difficulties with monitoring equipment</li>
                    </ul>
                  </div>

                  <div className="bg-white border border-blue-200 rounded p-3">
                    <p className="font-semibold text-blue-800 mb-2">VO₂max Normatives (mL/kg/min) — ACSM</p>
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-blue-100">
                        <tr><th className="p-1.5 text-left">Rating</th><th className="p-1.5 text-left">Men (40–49)</th><th className="p-1.5 text-left">Women (40–49)</th></tr>
                      </thead>
                      <tbody>
                        <tr className="border-t"><td className="p-1.5">Superior</td><td className="p-1.5">&gt;48.0</td><td className="p-1.5">&gt;36.9</td></tr>
                        <tr className="border-t bg-blue-50"><td className="p-1.5">Excellent</td><td className="p-1.5">44.0–48.0</td><td className="p-1.5">33.0–36.9</td></tr>
                        <tr className="border-t"><td className="p-1.5">Good</td><td className="p-1.5">37.1–43.9</td><td className="p-1.5">28.0–32.9</td></tr>
                        <tr className="border-t bg-blue-50"><td className="p-1.5">Fair</td><td className="p-1.5">30.2–37.0</td><td className="p-1.5">22.0–27.9</td></tr>
                        <tr className="border-t"><td className="p-1.5">Poor</td><td className="p-1.5">&lt;30.2</td><td className="p-1.5">&lt;22.0</td></tr>
                      </tbody>
                    </table>
                    <p className="text-xs text-blue-600 mt-1">VO₂max estimated via Bruce equation: 14.8 − (1.379 × T) + (0.451 × T²) − (0.012 × T³) where T = total time in minutes.</p>
                  </div>

                  <p className="text-xs text-blue-600 italic">References: Bruce RA et al. (1973). Exercising testing in adult normal subjects and cardiac patients. <em>Pediatrics, 32</em>, 742–756. ACSM Guidelines for Exercise Testing and Prescription, 11th Ed.</p>
                </div>
              )}
            </div>

            {/* Vitals Timing Guidance */}
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-900 space-y-2">
              <p className="font-semibold flex items-center gap-2">
                <Info className="w-4 h-4 flex-shrink-0" />
                Clinician Guidance — When to Record Vitals
              </p>
              <ul className="list-disc list-inside space-y-1 text-amber-800">
                <li><strong>Pre-test (baseline):</strong> Record resting HR, BP, and RPE before starting. Ensure resting systolic BP &lt;160 mmHg and diastolic &lt;100 mmHg before proceeding.</li>
                <li><strong>During each stage:</strong> Record HR, BP, and RPE in the <strong>last 30–60 seconds</strong> of each 3-minute stage (i.e., at ~2:00–2:30 into the stage), when values are closest to steady state for that workload.</li>
                <li><strong>At test termination:</strong> Record peak HR, BP, RPE, and any symptoms immediately at the moment the client stops.</li>
                <li><strong>Recovery (1, 3, 5 min post-exercise):</strong> Record HR and BP at 1, 3, and 5 minutes post-test to monitor recovery. BP should return toward baseline; a failure to recover may indicate cardiovascular risk.</li>
                <li><strong>Stop immediately</strong> if systolic BP exceeds 250 mmHg, diastolic exceeds 115 mmHg, HR does not increase with increasing workload, or any absolute indication for termination arises (ACSM guidelines).</li>
              </ul>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Current Stage
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentStage >= 0 && currentStage < stages.length ? (
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-slate-600">Speed</p>
                      <p className="text-2xl font-bold">{stages[currentStage].speed} mph</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Grade</p>
                      <p className="text-2xl font-bold">{stages[currentStage].grade}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">METs</p>
                      <p className="text-2xl font-bold">{stages[currentStage].mets}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-slate-600">Press Start to begin</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-6">
                <div className="text-center space-y-4">
                  <div>
                    <p className="text-sm text-slate-600">Total Time</p>
                    <p className="text-5xl font-bold text-slate-900">
                      {Math.floor(totalTime / 60)}:{(totalTime % 60).toString().padStart(2, '0')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Stage Time</p>
                    <p className="text-2xl font-semibold text-slate-700">
                      {Math.floor(stageTime / 60)}:{(stageTime % 60).toString().padStart(2, '0')} / 3:00
                    </p>
                  </div>
                  <div className="flex justify-center gap-2">
                    {!isRunning ? (
                      <Button onClick={() => setIsRunning(true)} size="lg">
                        <Play className="w-5 h-5 mr-2" />
                        {totalTime === 0 ? 'Start Test' : 'Resume'}
                      </Button>
                    ) : (
                      <Button onClick={() => setIsRunning(false)} variant="outline" size="lg">
                        <Pause className="w-5 h-5 mr-2" />
                        Pause
                      </Button>
                    )}
                    <Button onClick={handleStop} variant="destructive" size="lg">
                      <StopCircle className="w-5 h-5 mr-2" />
                      Stop Test
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Record Vitals</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Heart Rate (bpm)</Label>
                  <Input
                    type="number"
                    value={heartRate}
                    onChange={(e) => setHeartRate(e.target.value)}
                    placeholder="e.g., 140"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Blood Pressure</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      value={bloodPressureSystolic}
                      onChange={(e) => setBloodPressureSystolic(e.target.value)}
                      placeholder="Systolic"
                    />
                    <Input
                      type="number"
                      value={bloodPressureDiastolic}
                      onChange={(e) => setBloodPressureDiastolic(e.target.value)}
                      placeholder="Diastolic"
                    />
                  </div>
                </div>
                <div>
                  <Label>RPE (6-20)</Label>
                  <Input
                    type="number"
                    value={rpe}
                    onChange={(e) => setRPE(e.target.value)}
                    placeholder="e.g., 15"
                    className="mt-1"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={recordStageData} className="w-full">Record Stage Data</Button>
                </div>
              </CardContent>
            </Card>

            {stageData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recorded Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stageData.map((data, idx) => (
                      <div key={idx} className="flex justify-between text-sm p-2 bg-slate-50 rounded">
                        <span>Stage {data.stage} - {data.time} min</span>
                        <span>HR: {data.heartRate} | BP: {data.systolic}/{data.diastolic} | RPE: {data.rpe}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Completion</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Termination Reason</Label>
                  <Select value={terminationReason} onValueChange={setTerminationReason}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="volitional_fatigue">Volitional fatigue</SelectItem>
                      <SelectItem value="target_hr">Target heart rate achieved</SelectItem>
                      <SelectItem value="chest_pain">Chest pain</SelectItem>
                      <SelectItem value="severe_dyspnea">Severe dyspnea</SelectItem>
                      <SelectItem value="dizziness">Dizziness</SelectItem>
                      <SelectItem value="leg_pain">Leg pain/claudication</SelectItem>
                      <SelectItem value="ecg_changes">ECG changes</SelectItem>
                      <SelectItem value="bp_abnormal">Abnormal BP response</SelectItem>
                      <SelectItem value="client_request">Client requested stop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Symptoms</Label>
                  <Textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="Any symptoms experienced during test..."
                    rows={2}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Clinical Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Overall observations, test quality, recommendations..."
                    rows={3}
                    className="mt-1"
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
            disabled={!terminationReason}
            className="bg-red-600 hover:bg-red-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Test Results
          </Button>
        </div>
    </div>
  );
}