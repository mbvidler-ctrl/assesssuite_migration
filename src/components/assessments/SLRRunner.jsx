import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

export default function SLRRunner({ onSave, onClose }) {
  const [leftData, setLeftData] = useState({
    symptom_onset_angle: '',
    max_flexion_angle: '',
    symptom_location: '',
    symptom_quality: '',
    dorsiflexion_effect: '',
    cervical_flexion_effect: ''
  });
  const [rightData, setRightData] = useState({
    symptom_onset_angle: '',
    max_flexion_angle: '',
    symptom_location: '',
    symptom_quality: '',
    dorsiflexion_effect: '',
    cervical_flexion_effect: ''
  });
  const [crossedSLR, setCrossedSLR] = useState('');
  const [notes, setNotes] = useState('');

  const getInterpretation = (data) => {
    if (!data.symptom_onset_angle) return null;
    const angle = parseFloat(data.symptom_onset_angle);
    const hasRadicular = data.symptom_location && (
      data.symptom_location.includes('below_knee') || 
      data.symptom_location.includes('foot') ||
      data.symptom_location.includes('dermatomal')
    );
    const increasedBySensitizing = data.dorsiflexion_effect === 'worse' || data.cervical_flexion_effect === 'worse';

    if (angle >= 30 && angle <= 70 && hasRadicular && increasedBySensitizing) {
      return { text: 'Positive - Likely neural tension', color: 'text-red-600', bg: 'bg-red-50' };
    } else if (hasRadicular) {
      return { text: 'Possible neural involvement', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    } else {
      return { text: 'Likely muscular/non-neural', color: 'text-blue-600', bg: 'bg-blue-50' };
    }
  };

  const handleSave = () => {
    if (!leftData.symptom_onset_angle && !rightData.symptom_onset_angle) {
      toast.error("Please test at least one side");
      return;
    }

    const leftInterp = getInterpretation(leftData);
    const rightInterp = getInterpretation(rightData);

    const leftSide = leftData.symptom_onset_angle ? {
      symptom_onset_angle_deg: parseFloat(leftData.symptom_onset_angle),
      max_flexion_angle_deg: leftData.max_flexion_angle ? parseFloat(leftData.max_flexion_angle) : null,
      symptom_location: leftData.symptom_location?.replace(/_/g, ' ') || '',
      symptom_quality: leftData.symptom_quality?.replace(/_/g, ' ') || '',
      ankle_dorsiflexion_effect: leftData.dorsiflexion_effect?.replace(/_/g, ' ') || '',
      cervical_flexion_effect: leftData.cervical_flexion_effect?.replace(/_/g, ' ') || '',
      interpretation: leftInterp?.text || ''
    } : null;

    const rightSide = rightData.symptom_onset_angle ? {
      symptom_onset_angle_deg: parseFloat(rightData.symptom_onset_angle),
      max_flexion_angle_deg: rightData.max_flexion_angle ? parseFloat(rightData.max_flexion_angle) : null,
      symptom_location: rightData.symptom_location?.replace(/_/g, ' ') || '',
      symptom_quality: rightData.symptom_quality?.replace(/_/g, ' ') || '',
      ankle_dorsiflexion_effect: rightData.dorsiflexion_effect?.replace(/_/g, ' ') || '',
      cervical_flexion_effect: rightData.cervical_flexion_effect?.replace(/_/g, ' ') || '',
      interpretation: rightInterp?.text || ''
    } : null;

    // Build a readable SOAP objective text covering all measures
    const formatSide = (label, side) => {
      if (!side) return '';
      let s = `  ${label}:\n`;
      s += `    Symptom onset angle: ${side.symptom_onset_angle_deg}°\n`;
      if (side.max_flexion_angle_deg) s += `    Max flexion reached: ${side.max_flexion_angle_deg}°\n`;
      if (side.symptom_location) s += `    Symptom location: ${side.symptom_location}\n`;
      if (side.symptom_quality) s += `    Symptom quality: ${side.symptom_quality}\n`;
      if (side.ankle_dorsiflexion_effect) s += `    Effect of ankle dorsiflexion: ${side.ankle_dorsiflexion_effect}\n`;
      if (side.cervical_flexion_effect) s += `    Effect of cervical flexion: ${side.cervical_flexion_effect}\n`;
      if (side.interpretation) s += `    Interpretation: ${side.interpretation}\n`;
      return s;
    };

    let soapText = `• Straight Leg Raise Test (SLR):\n`;
    soapText += formatSide('Left', leftSide);
    soapText += formatSide('Right', rightSide);
    if (crossedSLR && crossedSLR !== 'not_tested') soapText += `  Crossed SLR: ${crossedSLR}\n`;
    if (notes) soapText += `  Clinical Notes: ${notes}\n`;

    onSave({
      result_value: Math.min(
        leftData.symptom_onset_angle ? parseFloat(leftData.symptom_onset_angle) : 180,
        rightData.symptom_onset_angle ? parseFloat(rightData.symptom_onset_angle) : 180
      ),
      additional_data: {
        measurement_type: 'slr',
        soap_text: soapText,
        left_side: leftSide,
        right_side: rightSide,
        crossed_slr: crossedSLR,
        slr_data: {
          left_side: leftSide,
          right_side: rightSide,
          crossed_slr: crossedSLR,
          soap_text: soapText
        }
      },
      notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  const leftInterp = getInterpretation(leftData);
  const rightInterp = getInterpretation(rightData);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Straight Leg Raise Test (SLR)</h2>
              <p className="text-slate-600 mt-1">Neural tension assessment</p>
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
                  📋 Test Protocol & Administration
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>Position:</strong> Client supine, tested leg relaxed, knee extended, ankle neutral.</p>
                <p><strong>Procedure:</strong> Slowly flex hip with knee straight. Stop when symptoms are produced. Ask about location and quality. Apply sensitising manoeuvres (ankle dorsiflexion, cervical flexion).</p>
                <p className="italic">"Tell me if you feel any pain, tingling, or numbness and exactly where you feel it."</p>
                <p><strong>Positive:</strong> Radicular symptoms <strong>below the knee</strong>, onset between <strong>30–70°</strong>, increased by ankle dorsiflexion or cervical flexion, and relieved by opposite manoeuvres.</p>
                <p><strong>Interpretation:</strong> Pain only in hamstrings or low back without distal radiation = not positive for neural tension. Crossed SLR positive = high specificity for disc herniation.</p>
              </CardContent>
            </Card>

            {/* Norms */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Diagnostic Accuracy</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Metric</th><th className="p-2 text-center">SLR</th><th className="p-2 text-center">Crossed SLR</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">Sensitivity</td><td className="p-2 text-center">~80–91%</td><td className="p-2 text-center">~28%</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">Specificity</td><td className="p-2 text-center">~26–38%</td><td className="p-2 text-center">~90%</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">SLR: high sensitivity, low specificity. Crossed SLR: high specificity. Best used alongside neurological exam. Source: Devillé et al. (2000).</p>
            </div>

            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>Devillé WLJM et al. (2000). The test of Lasègue: systematic review of the accuracy in diagnosing herniated discs. <em>Spine, 25</em>(9), 1140–1147.</p>
              <p>Urban LM. (1981). The straight-leg-raising test: a review. <em>Journal of Orthopaedic and Sports Physical Therapy, 2</em>(3), 117–133.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-lg">Left Side</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Symptom Onset Angle (°)</Label>
                    <Input
                      type="number"
                      value={leftData.symptom_onset_angle}
                      onChange={(e) => setLeftData({...leftData, symptom_onset_angle: e.target.value})}
                      placeholder="e.g., 45"
                      className="mt-1 text-xl font-bold"
                    />
                  </div>
                  <div>
                    <Label>Max Flexion Reached (°)</Label>
                    <Input
                      type="number"
                      value={leftData.max_flexion_angle}
                      onChange={(e) => setLeftData({...leftData, max_flexion_angle: e.target.value})}
                      placeholder="e.g., 60"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Symptom Location</Label>
                    <Select
                      value={leftData.symptom_location}
                      onValueChange={(value) => setLeftData({...leftData, symptom_location: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="back_only">Low back only</SelectItem>
                        <SelectItem value="buttock">Buttock</SelectItem>
                        <SelectItem value="posterior_thigh">Posterior thigh</SelectItem>
                        <SelectItem value="below_knee">Below knee</SelectItem>
                        <SelectItem value="foot">Foot</SelectItem>
                        <SelectItem value="dermatomal">Dermatomal pattern</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Symptom Quality</Label>
                    <Select
                      value={leftData.symptom_quality}
                      onValueChange={(value) => setLeftData({...leftData, symptom_quality: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select quality" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sharp">Sharp</SelectItem>
                        <SelectItem value="burning">Burning</SelectItem>
                        <SelectItem value="pins_needles">Pins and needles</SelectItem>
                        <SelectItem value="dull_ache">Dull ache</SelectItem>
                        <SelectItem value="stretch">Stretch only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Effect of Ankle Dorsiflexion</Label>
                    <Select
                      value={leftData.dorsiflexion_effect}
                      onValueChange={(value) => setLeftData({...leftData, dorsiflexion_effect: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select effect" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="worse">Symptoms worse</SelectItem>
                        <SelectItem value="no_change">No change</SelectItem>
                        <SelectItem value="better">Symptoms better</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Effect of Cervical Flexion</Label>
                    <Select
                      value={leftData.cervical_flexion_effect}
                      onValueChange={(value) => setLeftData({...leftData, cervical_flexion_effect: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select effect" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="worse">Symptoms worse</SelectItem>
                        <SelectItem value="no_change">No change</SelectItem>
                        <SelectItem value="better">Symptoms better</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {leftInterp && (
                    <div className={`p-3 rounded-lg border-2 ${leftInterp.bg} border-current`}>
                      <p className={`font-semibold ${leftInterp.color}`}>{leftInterp.text}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-green-50">
                <CardHeader>
                  <CardTitle className="text-lg">Right Side</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Symptom Onset Angle (°)</Label>
                    <Input
                      type="number"
                      value={rightData.symptom_onset_angle}
                      onChange={(e) => setRightData({...rightData, symptom_onset_angle: e.target.value})}
                      placeholder="e.g., 45"
                      className="mt-1 text-xl font-bold"
                    />
                  </div>
                  <div>
                    <Label>Max Flexion Reached (°)</Label>
                    <Input
                      type="number"
                      value={rightData.max_flexion_angle}
                      onChange={(e) => setRightData({...rightData, max_flexion_angle: e.target.value})}
                      placeholder="e.g., 60"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Symptom Location</Label>
                    <Select
                      value={rightData.symptom_location}
                      onValueChange={(value) => setRightData({...rightData, symptom_location: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="back_only">Low back only</SelectItem>
                        <SelectItem value="buttock">Buttock</SelectItem>
                        <SelectItem value="posterior_thigh">Posterior thigh</SelectItem>
                        <SelectItem value="below_knee">Below knee</SelectItem>
                        <SelectItem value="foot">Foot</SelectItem>
                        <SelectItem value="dermatomal">Dermatomal pattern</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Symptom Quality</Label>
                    <Select
                      value={rightData.symptom_quality}
                      onValueChange={(value) => setRightData({...rightData, symptom_quality: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select quality" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sharp">Sharp</SelectItem>
                        <SelectItem value="burning">Burning</SelectItem>
                        <SelectItem value="pins_needles">Pins and needles</SelectItem>
                        <SelectItem value="dull_ache">Dull ache</SelectItem>
                        <SelectItem value="stretch">Stretch only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Effect of Ankle Dorsiflexion</Label>
                    <Select
                      value={rightData.dorsiflexion_effect}
                      onValueChange={(value) => setRightData({...rightData, dorsiflexion_effect: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select effect" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="worse">Symptoms worse</SelectItem>
                        <SelectItem value="no_change">No change</SelectItem>
                        <SelectItem value="better">Symptoms better</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Effect of Cervical Flexion</Label>
                    <Select
                      value={rightData.cervical_flexion_effect}
                      onValueChange={(value) => setRightData({...rightData, cervical_flexion_effect: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select effect" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="worse">Symptoms worse</SelectItem>
                        <SelectItem value="no_change">No change</SelectItem>
                        <SelectItem value="better">Symptoms better</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {rightInterp && (
                    <div className={`p-3 rounded-lg border-2 ${rightInterp.bg} border-current`}>
                      <p className={`font-semibold ${rightInterp.color}`}>{rightInterp.text}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Crossed SLR</CardTitle>
              </CardHeader>
              <CardContent>
                <Label>Symptoms reproduced when raising opposite leg?</Label>
                <Select
                  value={crossedSLR}
                  onValueChange={setCrossedSLR}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select result" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">Positive (increases specificity)</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                    <SelectItem value="not_tested">Not tested</SelectItem>
                  </SelectContent>
                </Select>
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
                  placeholder="Observations, comparison to contralateral side, clinical reasoning..."
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
            disabled={!leftData.symptom_onset_angle && !rightData.symptom_onset_angle}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save SLR Results
          </Button>
        </div>
      </div>
    </div>
  );
}