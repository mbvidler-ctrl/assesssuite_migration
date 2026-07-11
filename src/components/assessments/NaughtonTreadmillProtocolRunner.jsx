import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info, Play, Pause, StopCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const PROTOCOLS = {
  classic_naughton: {
    label: "Classic Naughton",
    description: "Constant speed with incremental grade increases every 2 minutes.",
    stages: [
      { stage: 1, speedMph: 2.0, speedKmh: 3.22, gradePercent: 0.0,  estimatedMETs: 2.53 },
      { stage: 2, speedMph: 2.0, speedKmh: 3.22, gradePercent: 3.5,  estimatedMETs: 3.50 },
      { stage: 3, speedMph: 2.0, speedKmh: 3.22, gradePercent: 7.0,  estimatedMETs: 4.46 },
      { stage: 4, speedMph: 2.0, speedKmh: 3.22, gradePercent: 10.5, estimatedMETs: 5.43 },
      { stage: 5, speedMph: 2.0, speedKmh: 3.22, gradePercent: 14.0, estimatedMETs: 6.39 },
      { stage: 6, speedMph: 2.0, speedKmh: 3.22, gradePercent: 17.5, estimatedMETs: 7.36 },
      { stage: 7, speedMph: 2.0, speedKmh: 3.22, gradePercent: 21.0, estimatedMETs: 8.33 },
    ],
  },
  modified_naughton: {
    label: "Modified Naughton",
    description: "Lower-entry version for very deconditioned or fragile populations.",
    stages: [
      { stage: 1, speedMph: 1.0, speedKmh: 1.61, gradePercent: 0.0,  estimatedMETs: 1.52 },
      { stage: 2, speedMph: 1.5, speedKmh: 2.41, gradePercent: 0.0,  estimatedMETs: 2.02 },
      { stage: 3, speedMph: 2.0, speedKmh: 3.22, gradePercent: 0.0,  estimatedMETs: 2.53 },
      { stage: 4, speedMph: 2.0, speedKmh: 3.22, gradePercent: 3.5,  estimatedMETs: 3.50 },
      { stage: 5, speedMph: 2.0, speedKmh: 3.22, gradePercent: 7.0,  estimatedMETs: 4.46 },
      { stage: 6, speedMph: 2.0, speedKmh: 3.22, gradePercent: 10.5, estimatedMETs: 5.43 },
      { stage: 7, speedMph: 2.0, speedKmh: 3.22, gradePercent: 14.0, estimatedMETs: 6.39 },
      { stage: 8, speedMph: 2.0, speedKmh: 3.22, gradePercent: 17.5, estimatedMETs: 7.36 },
    ],
  },
};

const STAGE_DURATION = 120; // seconds

const TERMINATION_OPTIONS = [
  "Patient requests to stop",
  "Moderate to severe angina or concerning chest symptoms",
  "Marked dyspnoea or severe fatigue",
  "Dizziness, near syncope, poor coordination, or signs of intolerance",
  "Abnormal BP response per site/medical protocol",
  "Serious rhythm or ECG concerns where monitored",
  "Equipment or gait safety issue",
  "Clinician concern for patient safety",
  "Completed all stages",
];

function getInterpretation(stagesCompleted) {
  if (stagesCompleted <= 2) return "Very low treadmill exercise tolerance demonstrated on this protocol. Interpret in context of age, diagnosis, symptoms, medications, and reason for termination.";
  if (stagesCompleted <= 5) return "Low to moderate treadmill exercise tolerance demonstrated on this protocol. Clinical interpretation should consider symptoms, haemodynamic response, and purpose of testing.";
  return "Higher exercise tolerance demonstrated within the context of a low-workload treadmill protocol. Consider whether a different protocol would be more appropriate for future maximal assessment if clinically indicated.";
}

export default function NaughtonTreadmillProtocolRunner({ client, onSave, onClose }) {
  const [protocolKey, setProtocolKey] = useState("classic_naughton");
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [stageTime, setStageTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [heartRate, setHeartRate] = useState('');
  const [bp, setBp] = useState('');
  const [rpe, setRPE] = useState('');
  const [stageSymptoms, setStageSymptoms] = useState('');
  const [terminationReason, setTerminationReason] = useState('');
  const [notes, setNotes] = useState('');
  const [stageData, setStageData] = useState([]);

  const protocol = PROTOCOLS[protocolKey];
  const stages = protocol.stages;
  const currentStage = stages[Math.min(currentStageIdx, stages.length - 1)];

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setStageTime(prev => {
          if (prev + 1 >= STAGE_DURATION) {
            setCurrentStageIdx(idx => Math.min(idx + 1, stages.length - 1));
            return 0;
          }
          return prev + 1;
        });
        setTotalTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, stages.length]);

  const handleProtocolChange = (val) => {
    if (totalTime > 0) {
      toast.error("Cannot change protocol after test has started.");
      return;
    }
    setProtocolKey(val);
    setCurrentStageIdx(0);
  };

  const recordStageData = () => {
    setStageData(prev => [...prev, {
      stage: currentStage.stage,
      timeSec: totalTime,
      heartRate: heartRate || null,
      bp: bp || null,
      rpe: rpe || null,
      symptoms: stageSymptoms || null,
      speedMph: currentStage.speedMph,
      speedKmh: currentStage.speedKmh,
      grade: currentStage.gradePercent,
      mets: currentStage.estimatedMETs,
    }]);
    setHeartRate(''); setBp(''); setRPE(''); setStageSymptoms('');
    toast.success(`Stage ${currentStage.stage} data recorded`);
  };

  const formatTime = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

  const handleSave = () => {
    if (!terminationReason) { toast.error("Please select a termination reason"); return; }

    const stagesCompleted = currentStageIdx + 1;
    const interpretation = getInterpretation(stagesCompleted);

    const stageLines = stageData.map(s =>
      `  Stage ${s.stage} (${formatTime(s.timeSec)}) — ${s.speedMph} mph / ${s.speedKmh} km/h / ${s.grade}% grade / ~${s.mets} METs` +
      (s.heartRate ? ` | HR: ${s.heartRate} bpm` : '') +
      (s.bp ? ` | BP: ${s.bp}` : '') +
      (s.rpe ? ` | RPE: ${s.rpe}/10` : '') +
      (s.symptoms ? ` | Symptoms: ${s.symptoms}` : '')
    ).join('\n');

    const soapText = [
      `• Naughton Treadmill Protocol (${protocol.label}):`,
      `  Total Time: ${formatTime(totalTime)}`,
      `  Stages Completed: ${stagesCompleted}`,
      `  Final Stage: Stage ${currentStage.stage} — ${currentStage.speedMph} mph (${currentStage.speedKmh} km/h) / ${currentStage.gradePercent}% grade / ~${currentStage.estimatedMETs} METs`,
      `  Termination Reason: ${terminationReason}`,
      `  Clinical Interpretation: ${interpretation}`,
      stageLines ? `  Stage Data:\n${stageLines}` : null,
      notes ? `  Clinical Notes: ${notes}` : null,
      `  Note: Estimated METs are approximations. Interpret alongside symptoms, haemodynamic response, medications, and diagnosis.`,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: totalTime,
      additional_data: {
        soap_text: soapText,
        protocol: protocol.label,
        total_time_seconds: totalTime,
        stages_completed: stagesCompleted,
        final_stage: currentStage.stage,
        peak_speed_mph: currentStage.speedMph,
        peak_speed_kmh: currentStage.speedKmh,
        peak_grade_percent: currentStage.gradePercent,
        peak_estimated_mets: currentStage.estimatedMETs,
        termination_reason: terminationReason,
        stage_data: stageData,
        measurement_type: 'treadmill_protocol',
      },
      notes,
      assessment_date: todayLocal(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-teal-50 to-cyan-50 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Naughton Treadmill Protocol</h2>
            <p className="text-slate-600 mt-1">Low-workload graded exercise test — 2-minute stages</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Protocol selector */}
          <div>
            <Label className="font-semibold text-slate-800 mb-2 block">Protocol Version</Label>
            <div className="flex gap-3">
              {Object.entries(PROTOCOLS).map(([key, p]) => (
                <button key={key} onClick={() => handleProtocolChange(key)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${protocolKey === key ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">{protocol.description}</p>
          </div>

          {/* Clinician guidance */}
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-900 space-y-2">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4 flex-shrink-0" />Clinician Guidance</p>
            <ul className="list-disc list-inside space-y-1 text-amber-800">
              <li>Confirm indication, contraindications, and clinical suitability before commencing.</li>
              <li>Explain treadmill safety including emergency stop and handrail use only if needed for safety.</li>
              <li>Record resting HR, BP, symptoms, and baseline observations before starting.</li>
              <li>Each stage is <strong>2 minutes</strong>. Record vitals in the last 30 seconds of each stage.</li>
              <li>Clarify whether test is symptom-limited or submaximal per clinic protocol.</li>
            </ul>
          </div>

          {/* Stage table */}
          <Card>
            <CardHeader><CardTitle className="text-base">Protocol Stages — {protocol.label}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-center">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="py-2 px-2">Stage</th>
                      <th className="py-2 px-2">Speed (mph)</th>
                      <th className="py-2 px-2">Speed (km/h)</th>
                      <th className="py-2 px-2">Grade (%)</th>
                      <th className="py-2 px-2">Est. METs</th>
                      <th className="py-2 px-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stages.map((s, idx) => (
                      <tr key={s.stage} className={`border-b ${idx === currentStageIdx ? 'bg-teal-100 font-bold' : ''}`}>
                        <td className="py-1.5 px-2">{s.stage}</td>
                        <td className="py-1.5 px-2">{s.speedMph.toFixed(1)}</td>
                        <td className="py-1.5 px-2">{s.speedKmh.toFixed(2)}</td>
                        <td className="py-1.5 px-2">{s.gradePercent.toFixed(1)}</td>
                        <td className="py-1.5 px-2">{s.estimatedMETs.toFixed(2)}</td>
                        <td className="py-1.5 px-2">2 min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-slate-500 mt-2">METs estimated using ACSM walking equation. Values are approximations — do not interpret in isolation.</p>
              </div>
            </CardContent>
          </Card>

          {/* Current stage */}
          <Card className="bg-teal-50 border-teal-200">
            <CardHeader><CardTitle className="text-lg">Current Stage — Stage {currentStage.stage}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-500">Speed (mph)</p>
                  <p className="text-2xl font-bold">{currentStage.speedMph.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Speed (km/h)</p>
                  <p className="text-2xl font-bold">{currentStage.speedKmh.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Grade</p>
                  <p className="text-2xl font-bold">{currentStage.gradePercent.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Est. METs</p>
                  <p className="text-2xl font-bold">{currentStage.estimatedMETs.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timer */}
          <Card>
            <CardContent className="py-6">
              <div className="text-center space-y-4">
                <div>
                  <p className="text-sm text-slate-600">Total Time</p>
                  <p className="text-5xl font-bold text-slate-900">{formatTime(totalTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Stage Time</p>
                  <p className="text-2xl font-semibold text-slate-700">{formatTime(stageTime)} / 2:00</p>
                </div>
                <div className="flex justify-center gap-3 flex-wrap">
                  {!isRunning ? (
                    <Button onClick={() => setIsRunning(true)} size="lg" className="bg-teal-600 hover:bg-teal-700">
                      <Play className="w-5 h-5 mr-2" />{totalTime === 0 ? 'Start Test' : 'Resume'}
                    </Button>
                  ) : (
                    <Button onClick={() => setIsRunning(false)} variant="outline" size="lg">
                      <Pause className="w-5 h-5 mr-2" />Pause
                    </Button>
                  )}
                  <Button onClick={() => { setIsRunning(false); }} variant="destructive" size="lg">
                    <StopCircle className="w-5 h-5 mr-2" />Stop Test
                  </Button>
                  {currentStageIdx < stages.length - 1 && (
                    <Button onClick={() => { setCurrentStageIdx(i => i + 1); setStageTime(0); }} variant="outline" size="lg">
                      Next Stage →
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Record stage vitals */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Record Stage Observations</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Heart Rate (bpm)</Label>
                <Input type="number" value={heartRate} onChange={e => setHeartRate(e.target.value)} placeholder="e.g. 105" className="mt-1" />
              </div>
              <div>
                <Label>Blood Pressure</Label>
                <Input value={bp} onChange={e => setBp(e.target.value)} placeholder="e.g. 138/82" className="mt-1" />
              </div>
              <div>
                <Label>RPE (/10 or Borg 6–20)</Label>
                <Input value={rpe} onChange={e => setRPE(e.target.value)} placeholder="e.g. 13" className="mt-1" />
              </div>
              <div>
                <Label>Stage Symptoms</Label>
                <Input value={stageSymptoms} onChange={e => setStageSymptoms(e.target.value)} placeholder="e.g. mild dyspnoea" className="mt-1" />
              </div>
              <div className="md:col-span-2">
                <Button onClick={recordStageData} className="w-full bg-teal-600 hover:bg-teal-700">Record Stage {currentStage.stage} Data</Button>
              </div>
            </CardContent>
          </Card>

          {/* Recorded data */}
          {stageData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Recorded Stage Data</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stageData.map((d, idx) => (
                    <div key={idx} className="text-sm p-2 bg-slate-50 rounded border border-slate-200">
                      <span className="font-medium">Stage {d.stage}</span> ({formatTime(d.timeSec)}) — {d.speedMph} mph / {d.speedKmh} km/h / {d.grade}% / ~{d.mets} METs
                      {d.heartRate ? <span className="ml-2 text-slate-600">| HR: {d.heartRate} bpm</span> : null}
                      {d.bp ? <span className="ml-2 text-slate-600">| BP: {d.bp}</span> : null}
                      {d.rpe ? <span className="ml-2 text-slate-600">| RPE: {d.rpe}</span> : null}
                      {d.symptoms ? <span className="ml-2 text-orange-700">| {d.symptoms}</span> : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Termination criteria reference */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-900">
            <p className="font-semibold flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4" />Termination Criteria</p>
            <ul className="list-disc list-inside space-y-0.5 text-red-800 text-xs">
              {["Patient requests to stop","Moderate to severe angina or concerning chest symptoms","Marked dyspnoea or severe fatigue","Dizziness, near syncope, poor coordination, or signs of intolerance","Abnormal BP response per site/medical protocol","Serious rhythm or ECG concerns where monitored","Equipment or gait safety issue","Clinician concern for patient safety"].map(c => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>

          {/* Test completion */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Test Completion</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Reason for Termination</Label>
                <Select value={terminationReason} onValueChange={setTerminationReason}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    {TERMINATION_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Clinical Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Overall observations, gait safety, handrail use, haemodynamic response, recommendations..." rows={3} className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Scope statement */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600">
            <p className="font-semibold text-slate-700 mb-1">Scope / App Use Statement</p>
            <p>This app entry provides protocol guidance, stage display, estimated workload, and structured recording fields. It does not diagnose disease and does not replace medical supervision, emergency procedures, or jurisdiction-specific scope requirements. Any treadmill exercise test involving elevated clinical risk should be performed only where the clinician has appropriate training, screening processes, escalation pathways, and medical governance as required by local regulations and workplace policy.</p>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!terminationReason} className="bg-teal-600 hover:bg-teal-700">
            <Save className="w-4 h-4 mr-2" />Save Test Results
          </Button>
        </div>
      </div>
    </div>
  );
}