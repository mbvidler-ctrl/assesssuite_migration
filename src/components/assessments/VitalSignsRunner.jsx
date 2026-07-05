import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function VitalSignsRunner({ client, assessment, onSave, onClose, assessmentName }) {
  const [measurements, setMeasurements] = useState({
    systolic: "",
    diastolic: "",
    heartRate: "",
    heartRatePre: "",
    heartRatePost: "",
    spo2: "",
    spo2Pre: "",
    spo2Post: "",
    respiratoryRate: "",
    temperature: ""
  });
  const [additionalPostMeasures, setAdditionalPostMeasures] = useState([]);
  const [notes, setNotes] = useState("");

  // HRR-specific state
  const [hrrPeakHR, setHrrPeakHR] = useState('');
  const [hrrMeasures, setHrrMeasures] = useState([
    { label: '1 min', hr: '' },
    { label: '2 min', hr: '' },
  ]);

  const addHrrMeasure = () => setHrrMeasures(prev => [...prev, { label: '', hr: '' }]);
  const updateHrrMeasure = (i, field, val) => {
    const updated = [...hrrMeasures];
    updated[i][field] = val;
    setHrrMeasures(updated);
  };
  const removeHrrMeasure = (i) => setHrrMeasures(prev => prev.filter((_, idx) => idx !== i));

  const getHRRInterpretation = (hrr1) => {
    if (!hrr1) return null;
    const v = parseInt(hrr1);
    if (v <= 12) return { text: 'Attenuated (≤12 bpm) — Associated with increased mortality risk', color: 'text-red-600', bg: 'bg-red-50' };
    if (v <= 15) return { text: 'Below optimal (13–15 bpm) — Consider further evaluation', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { text: 'Normal (>15 bpm) — Favourable autonomic function', color: 'text-green-600', bg: 'bg-green-50' };
  };

  const isBloodPressure = assessmentName?.toLowerCase().includes('blood pressure');
  const isHRR = assessmentName?.toLowerCase().includes('heart rate recovery') || assessmentName?.toLowerCase().includes('hrr');
  const isHeartRate = !isHRR && assessmentName?.toLowerCase().includes('heart rate');
  const isPrePost = isHeartRate && (assessmentName?.toLowerCase().includes('pre') || assessmentName?.toLowerCase().includes('post'));
  const isSpO2 = assessmentName?.toLowerCase().includes('oxygen') || assessmentName?.toLowerCase().includes('spo2');
  const isSpO2PrePost = isSpO2 && (assessmentName?.toLowerCase().includes('pre') || assessmentName?.toLowerCase().includes('post'));

  const getBPInterpretation = (sys, dia) => {
    const s = parseInt(sys);
    const d = parseInt(dia);
    if (!s || !d) return null;

    if (s < 90 || d < 60) return { level: 'Low (Hypotension)', color: 'text-blue-600', bg: 'bg-blue-50', alert: 'Monitor for dizziness, consider medical review' };
    if (s < 120 && d < 80) return { level: 'Normal', color: 'text-green-600', bg: 'bg-green-50', alert: null };
    if (s < 130 && d < 80) return { level: 'Elevated', color: 'text-yellow-600', bg: 'bg-yellow-50', alert: 'Lifestyle modifications recommended' };
    if (s < 140 || d < 90) return { level: 'Stage 1 Hypertension', color: 'text-orange-600', bg: 'bg-orange-50', alert: 'GP review recommended' };
    if (s < 180 || d < 120) return { level: 'Stage 2 Hypertension', color: 'text-red-600', bg: 'bg-red-50', alert: 'Medical review required' };
    return { level: 'Hypertensive Crisis', color: 'text-red-700', bg: 'bg-red-100', alert: 'URGENT medical attention required' };
  };

  const getHRInterpretation = (hr) => {
    const h = parseInt(hr);
    if (!h) return null;

    if (h < 40) return { level: 'Severe Bradycardia', color: 'text-red-600', bg: 'bg-red-50', alert: 'Medical review required' };
    if (h < 60) return { level: 'Bradycardia', color: 'text-blue-600', bg: 'bg-blue-50', alert: 'May be normal for athletes, monitor symptoms' };
    if (h <= 100) return { level: 'Normal', color: 'text-green-600', bg: 'bg-green-50', alert: null };
    if (h <= 120) return { level: 'Mild Tachycardia', color: 'text-yellow-600', bg: 'bg-yellow-50', alert: 'Monitor during exercise' };
    return { level: 'Tachycardia', color: 'text-red-600', bg: 'bg-red-50', alert: 'Medical review recommended' };
  };

  const getSpO2Interpretation = (spo2) => {
    const s = parseInt(spo2);
    if (!s) return null;

    if (s < 90) return { level: 'Low (Hypoxemia)', color: 'text-red-600', bg: 'bg-red-50', alert: 'Medical attention required' };
    if (s < 95) return { level: 'Below Normal', color: 'text-orange-600', bg: 'bg-orange-50', alert: 'Monitor closely, may need medical review' };
    return { level: 'Normal', color: 'text-green-600', bg: 'bg-green-50', alert: null };
  };

  const bpInterp = getBPInterpretation(measurements.systolic, measurements.diastolic);
  const hrInterp = getHRInterpretation(measurements.heartRate);
  const hrPreInterp = getHRInterpretation(measurements.heartRatePre);
  const hrPostInterp = getHRInterpretation(measurements.heartRatePost);
  const spo2Interp = getSpO2Interpretation(measurements.spo2);
  const spo2PreInterp = getSpO2Interpretation(measurements.spo2Pre);
  const spo2PostInterp = getSpO2Interpretation(measurements.spo2Post);

  const handleSave = async () => {
    let resultValue = "";
    let additionalData = {};
    let soapText = "";

    if (isHRR) {
      const peak = parseInt(hrrPeakHR) || null;
      const measureLines = hrrMeasures
        .filter(m => m.hr)
        .map(m => {
          const hrr = peak ? peak - parseInt(m.hr) : null;
          return `  HR at ${m.label || '?'}: ${m.hr} bpm${hrr !== null ? ` (HRR: ${hrr} bpm)` : ''}`;
        });
      const hrr1Measure = hrrMeasures.find(m => m.label?.includes('1'));
      const hrr1Val = peak && hrr1Measure?.hr ? peak - parseInt(hrr1Measure.hr) : null;
      const interp = getHRRInterpretation(hrr1Val);
      soapText = `• ${assessmentName || 'Heart Rate Recovery (HRR)'}:\n  Peak HR: ${hrrPeakHR || '—'} bpm\n${measureLines.join('\n')}\n`;
      if (interp) soapText += `  Interpretation (1-min HRR): ${interp.text}\n`;
      if (notes?.trim()) soapText += `  Clinical Notes: ${notes}\n`;
      resultValue = hrr1Val;
      additionalData = {
        peak_hr: peak,
        measures: hrrMeasures.filter(m => m.hr),
        hrr_1_min: hrr1Val,
        interpretation: interp?.text,
        soap_text: soapText,
      };
    } else if (isBloodPressure) {
      resultValue = `${measurements.systolic}/${measurements.diastolic}`;
      const interp = getBPInterpretation(measurements.systolic, measurements.diastolic);
      soapText = `• ${assessmentName || 'Blood Pressure'}:\n  Blood Pressure: ${resultValue} mmHg → ${interp?.level || 'Unknown'}\n`;
      if (notes && notes.trim()) soapText += `  Clinical Notes: ${notes}\n`;
      additionalData = {
        systolic: parseInt(measurements.systolic),
        diastolic: parseInt(measurements.diastolic),
        interpretation: interp?.level,
        soap_text: soapText,
      };
    } else if (isHeartRate) {
    if (isPrePost) {
      const preVal = measurements.heartRatePre ? parseInt(measurements.heartRatePre) : null;
      const postVal = measurements.heartRatePost ? parseInt(measurements.heartRatePost) : null;
      const preInterp = preVal ? getHRInterpretation(preVal) : null;
      const postInterp = postVal ? getHRInterpretation(postVal) : null;
      resultValue = preVal || postVal;
      let hrLines = '';
      if (preVal) hrLines += `  Pre-Exercise: ${preVal} bpm → ${preInterp?.level || 'Unknown'}\n`;
      if (postVal) hrLines += `  Post-Exercise: ${postVal} bpm → ${postInterp?.level || 'Unknown'}\n`;

      additionalPostMeasures.forEach((measure) => {
        if (measure.hr) {
          const interp = getHRInterpretation(measure.hr);
          hrLines += `  ${measure.label || 'Additional'}: ${measure.hr} bpm → ${interp?.level || 'Unknown'}\n`;
        }
      });

      if (notes && notes.trim()) hrLines += `  Clinical Notes: ${notes}\n`;
      soapText = `• ${assessmentName || 'Heart Rate (Pre/Post Exercise)'}:\n${hrLines}`;
      additionalData = {
        heart_rate_pre: preVal,
        heart_rate_post: postVal,
        pre_interpretation: preInterp?.level,
        post_interpretation: postInterp?.level,
        additional_post_measures: additionalPostMeasures.filter(m => m.hr),
        soap_text: soapText,
      };
      } else {
        resultValue = measurements.heartRate;
        const interp = getHRInterpretation(measurements.heartRate);
        soapText = `• ${assessmentName || 'Heart Rate'}:\n  Heart Rate: ${resultValue} bpm → ${interp?.level || 'Unknown'}\n`;
        if (notes && notes.trim()) soapText += `  Clinical Notes: ${notes}\n`;
        additionalData = {
          heart_rate: parseInt(measurements.heartRate),
          interpretation: interp?.level,
          soap_text: soapText,
        };
      }
    } else if (isSpO2) {
      if (isSpO2PrePost) {
        const preVal = measurements.spo2Pre ? parseInt(measurements.spo2Pre) : null;
        const postVal = measurements.spo2Post ? parseInt(measurements.spo2Post) : null;
        const preInterp = preVal ? getSpO2Interpretation(preVal) : null;
        const postInterp = postVal ? getSpO2Interpretation(postVal) : null;
        resultValue = preVal || postVal;
        let lines = '';
        if (preVal) lines += `  Pre-Exercise: ${preVal}% → ${preInterp?.level || 'Unknown'}\n`;
        if (postVal) lines += `  Post-Exercise: ${postVal}% → ${postInterp?.level || 'Unknown'}\n`;
        if (notes && notes.trim()) lines += `  Clinical Notes: ${notes}\n`;
        soapText = `• ${assessmentName || 'SpO2 (Pre/Post Exercise)'}:\n${lines}`;
        additionalData = {
          spo2_pre: preVal,
          spo2_post: postVal,
          pre_interpretation: preInterp?.level,
          post_interpretation: postInterp?.level,
          soap_text: soapText,
        };
      } else {
        resultValue = measurements.spo2;
        const interp = getSpO2Interpretation(measurements.spo2);
        soapText = `• ${assessmentName || 'SpO2'}:\n  SpO2: ${resultValue}% → ${interp?.level || 'Unknown'}\n`;
        if (notes && notes.trim()) soapText += `  Clinical Notes: ${notes}\n`;
        additionalData = {
          spo2: parseInt(measurements.spo2),
          interpretation: interp?.level,
          soap_text: soapText,
        };
      }
    } else {
      const vitals = [];
      if (measurements.systolic && measurements.diastolic) vitals.push(`BP: ${measurements.systolic}/${measurements.diastolic}`);
      if (measurements.heartRate) vitals.push(`HR: ${measurements.heartRate}`);
      if (measurements.spo2) vitals.push(`SpO2: ${measurements.spo2}%`);
      if (measurements.respiratoryRate) vitals.push(`RR: ${measurements.respiratoryRate}`);
      if (measurements.temperature) vitals.push(`Temp: ${measurements.temperature}°C`);
      resultValue = vitals.join(', ');
      soapText = `• ${assessmentName || 'Vital Signs'}:\n  ${resultValue}\n`;
      if (notes && notes.trim()) soapText += `  Clinical Notes: ${notes}\n`;
      additionalData = {
        systolic: measurements.systolic ? parseInt(measurements.systolic) : null,
        diastolic: measurements.diastolic ? parseInt(measurements.diastolic) : null,
        heart_rate: measurements.heartRate ? parseInt(measurements.heartRate) : null,
        spo2: measurements.spo2 ? parseInt(measurements.spo2) : null,
        respiratory_rate: measurements.respiratoryRate ? parseInt(measurements.respiratoryRate) : null,
        temperature: measurements.temperature ? parseFloat(measurements.temperature) : null,
        soap_text: soapText,
      };
    }

    const assessmentData = {
      result_value: resultValue,
      additional_data: {
        ...additionalData,
        measurement_type: 'vital_signs'
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    };

    onSave(assessmentData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-red-50 to-pink-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{assessmentName || 'Vital Signs'}</h2>
              <p className="text-slate-600 mt-1">Record baseline physiological measurements</p>
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
                  Measurement Guidelines
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>Blood Pressure:</strong> Client seated, arm at heart level, after 5 minutes rest</p>
                <p><strong>Heart Rate:</strong> Palpate radial or carotid pulse for 60 seconds, or use monitor</p>
                <p><strong>SpO2:</strong> Use pulse oximeter on finger, ensure good circulation</p>
                <p><strong>Respiratory Rate:</strong> Count breaths for 60 seconds at rest</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vital Signs Measurements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(!isHeartRate && !isSpO2) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Systolic BP (mmHg)</Label>
                      <Input
                        type="number"
                        value={measurements.systolic}
                        onChange={(e) => setMeasurements({...measurements, systolic: e.target.value})}
                        placeholder="120"
                      />
                    </div>
                    <div>
                      <Label>Diastolic BP (mmHg)</Label>
                      <Input
                        type="number"
                        value={measurements.diastolic}
                        onChange={(e) => setMeasurements({...measurements, diastolic: e.target.value})}
                        placeholder="80"
                      />
                    </div>
                  </div>
                )}

                {(!isBloodPressure && !isSpO2 && !isPrePost) && (
                  <div>
                    <Label>Heart Rate (bpm)</Label>
                    <Input
                      type="number"
                      value={measurements.heartRate}
                      onChange={(e) => setMeasurements({...measurements, heartRate: e.target.value})}
                      placeholder="72"
                    />
                  </div>
                )}

                {isPrePost && (
                   <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <Label>Pre-Exercise Heart Rate (bpm)</Label>
                         <Input
                           type="number"
                           value={measurements.heartRatePre}
                           onChange={(e) => setMeasurements({...measurements, heartRatePre: e.target.value})}
                           placeholder="e.g., 72"
                           className="mt-1"
                         />
                       </div>
                       <div>
                         <Label>Post-Exercise Heart Rate (bpm)</Label>
                         <Input
                           type="number"
                           value={measurements.heartRatePost}
                           onChange={(e) => setMeasurements({...measurements, heartRatePost: e.target.value})}
                           placeholder="e.g., 145"
                           className="mt-1"
                         />
                       </div>
                     </div>

                     {additionalPostMeasures.length > 0 && (
                       <div className="border-t pt-4 space-y-3">
                         <Label className="font-semibold">Additional Measurements</Label>
                         {additionalPostMeasures.map((measure, index) => (
                           <div key={index} className="flex gap-3 items-end bg-gray-50 p-3 rounded">
                             <div className="flex-1">
                               <Label className="text-xs">Time/Label</Label>
                               <Input
                                 type="text"
                                 value={measure.label}
                                 onChange={(e) => {
                                   const updated = [...additionalPostMeasures];
                                   updated[index].label = e.target.value;
                                   setAdditionalPostMeasures(updated);
                                 }}
                                 placeholder="e.g., 2 min post, 3 min post"
                                 className="mt-1 text-sm"
                               />
                             </div>
                             <div className="flex-1">
                               <Label className="text-xs">Heart Rate (bpm)</Label>
                               <Input
                                 type="number"
                                 value={measure.hr}
                                 onChange={(e) => {
                                   const updated = [...additionalPostMeasures];
                                   updated[index].hr = e.target.value;
                                   setAdditionalPostMeasures(updated);
                                 }}
                                 placeholder="e.g., 120"
                                 className="mt-1 text-sm"
                               />
                             </div>
                             <Button
                               type="button"
                               variant="ghost"
                               size="icon"
                               onClick={() => setAdditionalPostMeasures(additionalPostMeasures.filter((_, i) => i !== index))}
                               className="text-red-600 hover:bg-red-50"
                             >
                               <Trash2 className="w-4 h-4" />
                             </Button>
                           </div>
                         ))}
                       </div>
                     )}

                     <Button
                       type="button"
                       variant="outline"
                       onClick={() => setAdditionalPostMeasures([...additionalPostMeasures, { label: '', hr: '' }])}
                       className="w-full"
                     >
                       <Plus className="w-4 h-4 mr-2" />
                       Add More Post-Exercise Measurements
                     </Button>
                   </div>
                 )}

                {isHRR && (
                  <div className="space-y-4">
                    <div>
                      <Label>Peak Exercise Heart Rate (bpm)</Label>
                      <Input
                        type="number"
                        value={hrrPeakHR}
                        onChange={e => setHrrPeakHR(e.target.value)}
                        placeholder="e.g., 168"
                        className="mt-1"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="font-semibold">Recovery Heart Rate Measurements</Label>
                      {hrrMeasures.map((m, i) => {
                        const hrrVal = hrrPeakHR && m.hr ? parseInt(hrrPeakHR) - parseInt(m.hr) : null;
                        return (
                          <div key={i} className="flex gap-3 items-end bg-slate-50 p-3 rounded-lg border">
                            <div className="flex-1">
                              <Label className="text-xs text-slate-600">Time Point</Label>
                              <Input
                                value={m.label}
                                onChange={e => updateHrrMeasure(i, 'label', e.target.value)}
                                placeholder="e.g., 1 min, 2 min"
                                className="mt-1 text-sm"
                              />
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs text-slate-600">Heart Rate (bpm)</Label>
                              <Input
                                type="number"
                                value={m.hr}
                                onChange={e => updateHrrMeasure(i, 'hr', e.target.value)}
                                placeholder="e.g., 145"
                                className="mt-1 text-sm"
                              />
                            </div>
                            {hrrVal !== null && (
                              <div className="text-center min-w-[64px]">
                                <p className="text-xs text-slate-500">HRR</p>
                                <p className="text-lg font-bold text-purple-600">{hrrVal}</p>
                              </div>
                            )}
                            {hrrMeasures.length > 1 && (
                              <Button type="button" variant="ghost" size="icon"
                                onClick={() => removeHrrMeasure(i)}
                                className="text-red-500 hover:bg-red-50">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                      <Button type="button" variant="outline" onClick={addHrrMeasure} className="w-full">
                        <Plus className="w-4 h-4 mr-2" />Add Measurement Time Point
                      </Button>
                    </div>

                    {(() => {
                      const hrr1Measure = hrrMeasures.find(m => m.label?.includes('1'));
                      const hrr1Val = hrrPeakHR && hrr1Measure?.hr ? parseInt(hrrPeakHR) - parseInt(hrr1Measure.hr) : null;
                      const interp = getHRRInterpretation(hrr1Val);
                      if (!interp) return null;
                      return (
                        <div className={`p-3 rounded-lg border-2 ${interp.bg} flex items-start gap-2`}>
                          {interp.color === 'text-red-600' && <AlertTriangle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />}
                          <p className={`text-sm font-medium ${interp.color}`}>{interp.text}</p>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {(!isBloodPressure && !isHeartRate && !isSpO2PrePost && !isHRR) && (
                  <div>
                    <Label>SpO2 (%)</Label>
                    <Input
                      type="number"
                      value={measurements.spo2}
                      onChange={(e) => setMeasurements({...measurements, spo2: e.target.value})}
                      placeholder="98"
                      max="100"
                    />
                  </div>
                )}

                {isSpO2PrePost && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Pre-Exercise SpO2 (%)</Label>
                      <Input
                        type="number"
                        value={measurements.spo2Pre}
                        onChange={(e) => setMeasurements({...measurements, spo2Pre: e.target.value})}
                        placeholder="e.g., 98"
                        max="100"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Post-Exercise SpO2 (%)</Label>
                      <Input
                        type="number"
                        value={measurements.spo2Post}
                        onChange={(e) => setMeasurements({...measurements, spo2Post: e.target.value})}
                        placeholder="e.g., 94"
                        max="100"
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}

                {!isBloodPressure && !isHeartRate && !isSpO2 && !isHRR && (
                  <>
                    <div>
                      <Label>Respiratory Rate (breaths/min)</Label>
                      <Input
                        type="number"
                        value={measurements.respiratoryRate}
                        onChange={(e) => setMeasurements({...measurements, respiratoryRate: e.target.value})}
                        placeholder="16"
                      />
                    </div>
                    <div>
                      <Label>Temperature (°C)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={measurements.temperature}
                        onChange={(e) => setMeasurements({...measurements, temperature: e.target.value})}
                        placeholder="36.8"
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {bpInterp && isBloodPressure && (
              <Card className={`${bpInterp.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-xl ${bpInterp.color}`}>
                    {bpInterp.level}
                  </CardTitle>
                </CardHeader>
                <CardContent className={bpInterp.color}>
                  <p className="font-semibold">{measurements.systolic}/{measurements.diastolic} mmHg</p>
                  {bpInterp.alert && (
                    <div className="mt-3 p-3 bg-white/50 rounded flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <p>{bpInterp.alert}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {hrInterp && isHeartRate && !isPrePost && (
              <Card className={`${hrInterp.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-xl ${hrInterp.color}`}>{hrInterp.level}</CardTitle>
                </CardHeader>
                <CardContent className={hrInterp.color}>
                  <p className="font-semibold">{measurements.heartRate} bpm</p>
                  {hrInterp.alert && (
                    <div className="mt-3 p-3 bg-white/50 rounded flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <p>{hrInterp.alert}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {isPrePost && (hrPreInterp || hrPostInterp) && (
              <div className="grid grid-cols-2 gap-4">
                {hrPreInterp && measurements.heartRatePre && (
                  <Card className={`${hrPreInterp.bg} border-2`}>
                    <CardContent className={`pt-4 ${hrPreInterp.color}`}>
                      <p className="text-sm font-medium mb-1">Pre-Exercise</p>
                      <p className="text-2xl font-bold">{measurements.heartRatePre} bpm</p>
                      <p className="text-sm mt-1">{hrPreInterp.level}</p>
                    </CardContent>
                  </Card>
                )}
                {hrPostInterp && measurements.heartRatePost && (
                  <Card className={`${hrPostInterp.bg} border-2`}>
                    <CardContent className={`pt-4 ${hrPostInterp.color}`}>
                      <p className="text-sm font-medium mb-1">Post-Exercise</p>
                      <p className="text-2xl font-bold">{measurements.heartRatePost} bpm</p>
                      <p className="text-sm mt-1">{hrPostInterp.level}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {isSpO2PrePost && (spo2PreInterp || spo2PostInterp) && (
              <div className="grid grid-cols-2 gap-4">
                {spo2PreInterp && measurements.spo2Pre && (
                  <Card className={`${spo2PreInterp.bg} border-2`}>
                    <CardContent className={`pt-4 ${spo2PreInterp.color}`}>
                      <p className="text-sm font-medium mb-1">Pre-Exercise</p>
                      <p className="text-2xl font-bold">{measurements.spo2Pre}%</p>
                      <p className="text-sm mt-1">{spo2PreInterp.level}</p>
                    </CardContent>
                  </Card>
                )}
                {spo2PostInterp && measurements.spo2Post && (
                  <Card className={`${spo2PostInterp.bg} border-2`}>
                    <CardContent className={`pt-4 ${spo2PostInterp.color}`}>
                      <p className="text-sm font-medium mb-1">Post-Exercise</p>
                      <p className="text-2xl font-bold">{measurements.spo2Post}%</p>
                      <p className="text-sm mt-1">{spo2PostInterp.level}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {spo2Interp && isSpO2 && !isSpO2PrePost && (
              <Card className={`${spo2Interp.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-xl ${spo2Interp.color}`}>
                    {spo2Interp.level}
                  </CardTitle>
                </CardHeader>
                <CardContent className={spo2Interp.color}>
                  <p className="font-semibold">{measurements.spo2}%</p>
                  {spo2Interp.alert && (
                    <div className="mt-3 p-3 bg-white/50 rounded flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <p>{spo2Interp.alert}</p>
                    </div>
                  )}
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
                  placeholder="Position, time of day, recent activity, medications affecting vitals..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700">
            <Save className="w-4 h-4 mr-2" />
            Save Vital Signs
          </Button>
        </div>
      </div>
    </div>
  );
}