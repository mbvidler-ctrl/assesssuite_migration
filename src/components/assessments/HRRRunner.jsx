import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function HRRRunner({ onSave, onClose }) {
  const [peakHR, setPeakHR] = useState('');
  const [hr1Min, setHr1Min] = useState('');
  const [hr2Min, setHr2Min] = useState('');
  const [additionalMeasures, setAdditionalMeasures] = useState([]);
  const [recoveryMode, setRecoveryMode] = useState('passive_standing');
  const [precedingTest, setPrecedingTest] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');

  const calculateHRR1 = () => {
    if (!peakHR || !hr1Min) return null;
    return parseInt(peakHR) - parseInt(hr1Min);
  };

  const calculateHRR2 = () => {
    if (!peakHR || !hr2Min) return null;
    return parseInt(peakHR) - parseInt(hr2Min);
  };

  const getInterpretation = (hrr1) => {
    if (hrr1 === null) return null;
    if (hrr1 <= 12) return { text: 'Attenuated (â‰¤12 bpm) - Associated with increased mortality risk', color: 'text-red-600', bg: 'bg-red-50' };
    if (hrr1 <= 15) return { text: 'Below optimal (13-15 bpm) - Consider further evaluation', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { text: 'Normal (>15 bpm) - Favourable autonomic function', color: 'text-green-600', bg: 'bg-green-50' };
  };

  const hrr1 = calculateHRR1();
  const hrr2 = calculateHRR2();
  const interpretation = getInterpretation(hrr1);

  const handleAddMeasure = () => {
    setAdditionalMeasures([...additionalMeasures, { timepoint: '', hr: '', label: '' }]);
  };

  const handleUpdateMeasure = (index, field, value) => {
    const updated = [...additionalMeasures];
    updated[index][field] = value;
    setAdditionalMeasures(updated);
  };

  const handleRemoveMeasure = (index) => {
    setAdditionalMeasures(additionalMeasures.filter((_, i) => i !== index));
  };

  const buildSOAPText = () => {
    let text = `Heart Rate Recovery Assessment:\n\n`;
    text += `Preceding Test: ${precedingTest || 'Not specified'}\n`;
    text += `Recovery Mode: ${recoveryMode.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n\n`;
    
    text += `Heart Rate Measurements:\n`;
    text += `â€¢ Peak Exercise HR: ${peakHR} bpm\n`;
    text += `â€¢ HR at 1 Minute: ${hr1Min} bpm (HRR1: ${hrr1} bpm)\n`;
    if (hr2Min) text += `â€¢ HR at 2 Minutes: ${hr2Min} bpm (HRR2: ${hrr2} bpm)\n`;
    
    if (additionalMeasures.length > 0) {
      text += `\nAdditional Measurements:\n`;
      additionalMeasures.forEach((measure) => {
        if (measure.hr) {
          const timeLabel = measure.label || `${measure.timepoint} min`;
          const hrr = peakHR && measure.hr ? parseInt(peakHR) - parseInt(measure.hr) : null;
          text += `â€¢ HR at ${timeLabel}: ${measure.hr} bpm${hrr ? ` (HRR: ${hrr} bpm)` : ''}\n`;
        }
      });
    }

    if (interpretation) {
      text += `\nInterpretation: ${interpretation.text}\n`;
    }

    if (symptoms) {
      text += `\nSymptoms During Recovery: ${symptoms}\n`;
    }

    if (notes) {
      text += `\nClinical Notes: ${notes}\n`;
    }

    return text;
  };

  const handleSave = () => {
    onSave({
      result_value: hrr1,
      additional_data: {
        soap_text: buildSOAPText(),
        peak_heart_rate: parseInt(peakHR),
        hr_1_minute: parseInt(hr1Min),
        hr_2_minute: hr2Min ? parseInt(hr2Min) : null,
        hrr_1_minute: hrr1,
        hrr_2_minute: hrr2,
        additional_measurements: additionalMeasures.filter(m => m.hr),
        recovery_mode: recoveryMode,
        preceding_test: precedingTest,
        symptoms: symptoms,
        interpretation: interpretation?.text,
      },
      notes: notes,
      assessment_date: new Date().toISOString()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-rose-50 to-pink-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Heart Rate Recovery (HRR)</h2>
              <p className="text-slate-600 mt-1">Post-exercise autonomic function assessment</p>
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
                  Assessment Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>Procedure:</strong> Immediately after completing exercise, transition client to recovery mode (standing, sitting, or light walking) and record heart rate at exactly 1 and 2 minutes.</p>
                <p><strong>HRR Calculation:</strong> Peak HR minus HR at recovery time point.</p>
                <p><strong>Clinical Significance:</strong> HRR1 â‰¤12 bpm is associated with increased mortality risk. Higher HRR indicates better autonomic function.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Preceding Exercise Test</Label>
                  <Input
                    value={precedingTest}
                    onChange={(e) => setPrecedingTest(e.target.value)}
                    placeholder="e.g., Treadmill GXT, Bruce Protocol, 6MWT"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Recovery Mode</Label>
                  <Select value={recoveryMode} onValueChange={setRecoveryMode}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="passive_standing">Passive Standing</SelectItem>
                      <SelectItem value="passive_sitting">Passive Sitting</SelectItem>
                      <SelectItem value="active_walking">Active Walking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Heart Rate Measurements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Peak Exercise Heart Rate (bpm)</Label>
                  <Input
                    type="number"
                    value={peakHR}
                    onChange={(e) => setPeakHR(e.target.value)}
                    placeholder="e.g., 165"
                    className="mt-1"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                   <div>
                     <Label>Heart Rate at 1 Minute (bpm) *</Label>
                     <Input
                       type="number"
                       value={hr1Min}
                       onChange={(e) => setHr1Min(e.target.value)}
                       placeholder="e.g., 145"
                       className="mt-1"
                     />
                   </div>

                   <div>
                     <Label>Heart Rate at 2 Minutes (bpm)</Label>
                     <Input
                       type="number"
                       value={hr2Min}
                       onChange={(e) => setHr2Min(e.target.value)}
                       placeholder="e.g., 130"
                       className="mt-1"
                     />
                   </div>
                 </div>

                 {/* Additional Measurements */}
                 {additionalMeasures.length > 0 && (
                   <div className="space-y-3 border-t pt-4">
                     <Label className="font-semibold">Additional Measurements</Label>
                     {additionalMeasures.map((measure, index) => (
                       <div key={index} className="flex gap-3 items-end bg-gray-50 p-3 rounded">
                         <div className="flex-1">
                           <Label className="text-xs">Time/Label</Label>
                           <Input
                             type="text"
                             value={measure.label}
                             onChange={(e) => handleUpdateMeasure(index, 'label', e.target.value)}
                             placeholder="e.g., 2 min post, 3 min post"
                             className="mt-1 text-sm"
                           />
                         </div>
                         <div className="flex-1">
                           <Label className="text-xs">Heart Rate (bpm)</Label>
                           <Input
                             type="number"
                             value={measure.hr}
                             onChange={(e) => handleUpdateMeasure(index, 'hr', e.target.value)}
                             placeholder="e.g., 120"
                             className="mt-1 text-sm"
                           />
                         </div>
                         <Button
                           type="button"
                           variant="ghost"
                           size="icon"
                           onClick={() => handleRemoveMeasure(index)}
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
                   onClick={handleAddMeasure}
                   className="w-full mt-3"
                 >
                   <Plus className="w-4 h-4 mr-2" />
                   Add More Measurements
                 </Button>
                </CardContent>
                </Card>

            {(hrr1 !== null || hrr2 !== null) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">HRR Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {hrr1 !== null && (
                      <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4 text-center">
                        <p className="text-sm text-purple-700 mb-1">HRR at 1 Minute</p>
                        <p className="text-4xl font-bold text-purple-600">{hrr1} bpm</p>
                        <p className="text-xs text-purple-600 mt-1">({peakHR} - {hr1Min})</p>
                      </div>
                    )}
                    
                    {hrr2 !== null && (
                      <div className="bg-indigo-50 border-2 border-indigo-300 rounded-lg p-4 text-center">
                        <p className="text-sm text-indigo-700 mb-1">HRR at 2 Minutes</p>
                        <p className="text-4xl font-bold text-indigo-600">{hrr2} bpm</p>
                        <p className="text-xs text-indigo-600 mt-1">({peakHR} - {hr2Min})</p>
                      </div>
                    )}
                  </div>

                  {interpretation && (
                    <div className={`p-4 rounded-lg border-2 ${interpretation.bg} border-current flex items-start gap-3`}>
                      {interpretation.color === 'text-red-600' && <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />}
                      <div>
                        <p className={`font-semibold ${interpretation.color}`}>Interpretation</p>
                        <p className={`text-sm ${interpretation.color} mt-1`}>{interpretation.text}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Symptoms During Recovery</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="Chest discomfort, dizziness, breathlessness, palpitations, none..."
                  rows={2}
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
                  placeholder="Beta-blocker use, clinical context, follow-up recommendations..."
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
            className="bg-rose-600 hover:bg-rose-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save HRR Results
          </Button>
        </div>
      </div>
    </div>
  );
}