import React, { useState } from "react";
import { todayLocal } from "@/lib/localDate";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

export default function SlumpRunner({ onSave, onClose }) {
  const [leftData, setLeftData] = useState({
    slump_spine: { symptoms: '', location: '', quality: '' },
    flex_neck: { symptoms: '', location: '', quality: '' },
    extend_knee: { symptoms: '', location: '', quality: '' },
    dorsiflex_ankle: { symptoms: '', location: '', quality: '' },
    neck_extension_effect: '',
    ankle_plantarflexion_effect: ''
  });
  const [rightData, setRightData] = useState({
    slump_spine: { symptoms: '', location: '', quality: '' },
    flex_neck: { symptoms: '', location: '', quality: '' },
    extend_knee: { symptoms: '', location: '', quality: '' },
    dorsiflex_ankle: { symptoms: '', location: '', quality: '' },
    neck_extension_effect: '',
    ankle_plantarflexion_effect: ''
  });
  const [notes, setNotes] = useState('');

  const hasSymptoms = (data) => {
    return data.slump_spine.symptoms === 'yes' || data.flex_neck.symptoms === 'yes' || 
           data.extend_knee.symptoms === 'yes' || data.dorsiflex_ankle.symptoms === 'yes';
  };

  const getInterpretation = (data) => {
    if (hasSymptoms(data)) {
      const allLocations = [
        data.slump_spine.location,
        data.flex_neck.location,
        data.extend_knee.location,
        data.dorsiflex_ankle.location
      ].filter(Boolean);
      
      const hasDistalSymptoms = allLocations.some(loc => 
        loc.includes('below_knee') || loc.includes('foot')
      );
      const decreasedByEasing = data.neck_extension_effect === 'better' || data.ankle_plantarflexion_effect === 'better';
      
      if (hasDistalSymptoms && decreasedByEasing) {
        return { text: 'Positive - Neurodynamic involvement', color: 'text-red-600', bg: 'bg-red-50' };
      } else if (hasDistalSymptoms) {
        return { text: 'Possible neural involvement', color: 'text-yellow-600', bg: 'bg-yellow-50' };
      }
    }
    return { text: 'Unlikely neurodynamic', color: 'text-green-600', bg: 'bg-green-50' };
  };

  const formatSideSlump = (label, data, interp) => {
    if (!data.slump_spine.symptoms) return '';
    const fmt = (step, d) => {
      if (!d.symptoms) return '';
      let s = `    ${step}: Symptoms ${d.symptoms === 'yes' ? 'produced' : 'absent'}`;
      if (d.symptoms === 'yes') {
        if (d.location) s += `, Location: ${d.location.replace(/_/g, ' ')}`;
        if (d.quality) s += `, Quality: ${d.quality.replace(/_/g, ' ')}`;
      }
      return s + '\n';
    };
    let s = `  ${label}:\n`;
    s += fmt('1. Slump spine', data.slump_spine);
    s += fmt('2. Flex neck/chin tuck', data.flex_neck);
    s += fmt('3. Extend knee', data.extend_knee);
    s += fmt('4. Dorsiflex ankle', data.dorsiflex_ankle);
    if (data.neck_extension_effect) s += `    Effect of neck extension: ${data.neck_extension_effect}\n`;
    if (data.ankle_plantarflexion_effect) s += `    Effect of ankle plantarflexion: ${data.ankle_plantarflexion_effect}\n`;
    s += `    Interpretation: ${interp.text}\n`;
    return s;
  };

  const handleSave = () => {
    if (!leftData.slump_spine.symptoms && !rightData.slump_spine.symptoms) {
      toast.error("Please test at least one side");
      return;
    }

    const leftInterp = getInterpretation(leftData);
    const rightInterp = getInterpretation(rightData);

    let soapText = `• Slump Test:\n`;
    soapText += formatSideSlump('Left', leftData, leftInterp);
    soapText += formatSideSlump('Right', rightData, rightInterp);
    if (notes) soapText += `  Clinical Notes: ${notes}\n`;

    onSave({
      result_value: (hasSymptoms(leftData) || hasSymptoms(rightData)) ? 1 : 0,
      additional_data: {
        measurement_type: 'slump',
        soap_text: soapText,
        left_side: leftData.slump_spine.symptoms ? { ...leftData, interpretation: leftInterp.text } : null,
        right_side: rightData.slump_spine.symptoms ? { ...rightData, interpretation: rightInterp.text } : null,
        slump_data: {
          left_data: leftData.slump_spine.symptoms ? { ...leftData, interpretation: leftInterp.text } : null,
          right_data: rightData.slump_spine.symptoms ? { ...rightData, interpretation: rightInterp.text } : null,
          soap_text: soapText
        }
      },
      notes: notes,
      assessment_date: todayLocal()
    });
  };

  const leftInterp = getInterpretation(leftData);
  const rightInterp = getInterpretation(rightData);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Slump Test</h2>
              <p className="text-slate-600 mt-1">Neurodynamic assessment</p>
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
                <p><strong>Sequence:</strong> 1) Slump spine (thoracic/lumbar flexion) → 2) Flex neck/chin tuck → 3) Extend knee → 4) Dorsiflex ankle (passive).</p>
                <p><strong>Sensitisation:</strong> If symptoms produced, apply structural differentiation. Extend neck (releases meninges) — if symptoms decrease, neural involvement confirmed. Or plantarflex ankle — if symptoms decrease, confirms neurodynamic test.</p>
                <p className="italic">"Let your back slump forward… now tuck your chin to your chest… now straighten your leg… now point your toes up."</p>
                <p><strong>Positive:</strong> Familiar distal symptoms (below knee ideally) that <strong>decrease with neck extension or ankle plantarflexion</strong>.</p>
              </CardContent>
            </Card>

            {/* Norms */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Diagnostic Accuracy</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Metric</th><th className="p-2 text-center">Value</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">Sensitivity (lumbar radiculopathy)</td><td className="p-2 text-center">~84%</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">Specificity</td><td className="p-2 text-center">~83%</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">Useful for neurodynamic assessment of lumbar nerve roots, especially L3–S2. Structural differentiation is essential for valid interpretation. Source: Philip et al. (1989).</p>
            </div>

            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>Maitland GD. (1979). Negative disc exploration: positive canal signs. <em>Australian Journal of Physiotherapy, 25</em>(3), 129–134.</p>
              <p>Philip K, Lew P, & Matyas TA. (1989). The inter-therapist reliability of the slump test. <em>Australian Journal of Physiotherapy, 35</em>(2), 89–94.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-lg">Left Side</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4 border-b pb-4">
                    <Label className="font-bold text-base">1. Slump Spine</Label>
                    <Select
                      value={leftData.slump_spine.symptoms}
                      onValueChange={(value) => setLeftData({...leftData, slump_spine: {...leftData.slump_spine, symptoms: value}})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Symptoms?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Symptoms produced</SelectItem>
                        <SelectItem value="no">No symptoms</SelectItem>
                      </SelectContent>
                    </Select>
                    {leftData.slump_spine.symptoms === 'yes' && (
                      <>
                        <Select
                          value={leftData.slump_spine.location}
                          onValueChange={(value) => setLeftData({...leftData, slump_spine: {...leftData.slump_spine, location: value}})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Where?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low_back">Low back</SelectItem>
                            <SelectItem value="buttock">Buttock</SelectItem>
                            <SelectItem value="posterior_thigh">Posterior thigh</SelectItem>
                            <SelectItem value="below_knee">Below knee</SelectItem>
                            <SelectItem value="foot">Foot</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={leftData.slump_spine.quality}
                          onValueChange={(value) => setLeftData({...leftData, slump_spine: {...leftData.slump_spine, quality: value}})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Quality?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sharp">Sharp</SelectItem>
                            <SelectItem value="burning">Burning</SelectItem>
                            <SelectItem value="pins_needles">Pins/needles</SelectItem>
                            <SelectItem value="dull_ache">Dull ache</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>

                  <div className="space-y-4 border-b pb-4">
                    <Label className="font-bold text-base">2. Flex Neck/Chin Tuck</Label>
                    <Select
                      value={leftData.flex_neck.symptoms}
                      onValueChange={(value) => setLeftData({...leftData, flex_neck: {...leftData.flex_neck, symptoms: value}})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Symptoms?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Symptoms produced</SelectItem>
                        <SelectItem value="no">No symptoms</SelectItem>
                      </SelectContent>
                    </Select>
                    {leftData.flex_neck.symptoms === 'yes' && (
                      <>
                        <Select
                          value={leftData.flex_neck.location}
                          onValueChange={(value) => setLeftData({...leftData, flex_neck: {...leftData.flex_neck, location: value}})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Where?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low_back">Low back</SelectItem>
                            <SelectItem value="buttock">Buttock</SelectItem>
                            <SelectItem value="posterior_thigh">Posterior thigh</SelectItem>
                            <SelectItem value="below_knee">Below knee</SelectItem>
                            <SelectItem value="foot">Foot</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={leftData.flex_neck.quality}
                          onValueChange={(value) => setLeftData({...leftData, flex_neck: {...leftData.flex_neck, quality: value}})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Quality?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sharp">Sharp</SelectItem>
                            <SelectItem value="burning">Burning</SelectItem>
                            <SelectItem value="pins_needles">Pins/needles</SelectItem>
                            <SelectItem value="dull_ache">Dull ache</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>

                  <div className="space-y-4 border-b pb-4">
                    <Label className="font-bold text-base">3. Extend Knee</Label>
                    <Select
                      value={leftData.extend_knee.symptoms}
                      onValueChange={(value) => setLeftData({...leftData, extend_knee: {...leftData.extend_knee, symptoms: value}})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Symptoms?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Symptoms produced</SelectItem>
                        <SelectItem value="no">No symptoms</SelectItem>
                      </SelectContent>
                    </Select>
                    {leftData.extend_knee.symptoms === 'yes' && (
                      <>
                        <Select
                          value={leftData.extend_knee.location}
                          onValueChange={(value) => setLeftData({...leftData, extend_knee: {...leftData.extend_knee, location: value}})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Where?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low_back">Low back</SelectItem>
                            <SelectItem value="buttock">Buttock</SelectItem>
                            <SelectItem value="posterior_thigh">Posterior thigh</SelectItem>
                            <SelectItem value="below_knee">Below knee</SelectItem>
                            <SelectItem value="foot">Foot</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={leftData.extend_knee.quality}
                          onValueChange={(value) => setLeftData({...leftData, extend_knee: {...leftData.extend_knee, quality: value}})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Quality?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sharp">Sharp</SelectItem>
                            <SelectItem value="burning">Burning</SelectItem>
                            <SelectItem value="pins_needles">Pins/needles</SelectItem>
                            <SelectItem value="dull_ache">Dull ache</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>

                  <div className="space-y-4 border-b pb-4">
                    <Label className="font-bold text-base">4. Dorsiflex Ankle</Label>
                    <Select
                      value={leftData.dorsiflex_ankle.symptoms}
                      onValueChange={(value) => setLeftData({...leftData, dorsiflex_ankle: {...leftData.dorsiflex_ankle, symptoms: value}})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Symptoms?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Symptoms produced</SelectItem>
                        <SelectItem value="no">No symptoms</SelectItem>
                      </SelectContent>
                    </Select>
                    {leftData.dorsiflex_ankle.symptoms === 'yes' && (
                      <>
                        <Select
                          value={leftData.dorsiflex_ankle.location}
                          onValueChange={(value) => setLeftData({...leftData, dorsiflex_ankle: {...leftData.dorsiflex_ankle, location: value}})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Where?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low_back">Low back</SelectItem>
                            <SelectItem value="buttock">Buttock</SelectItem>
                            <SelectItem value="posterior_thigh">Posterior thigh</SelectItem>
                            <SelectItem value="below_knee">Below knee</SelectItem>
                            <SelectItem value="foot">Foot</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={leftData.dorsiflex_ankle.quality}
                          onValueChange={(value) => setLeftData({...leftData, dorsiflex_ankle: {...leftData.dorsiflex_ankle, quality: value}})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Quality?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sharp">Sharp</SelectItem>
                            <SelectItem value="burning">Burning</SelectItem>
                            <SelectItem value="pins_needles">Pins/needles</SelectItem>
                            <SelectItem value="dull_ache">Dull ache</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>

                  {hasSymptoms(leftData) && (
                    <>

                      <div>
                        <Label>Effect of Neck Extension</Label>
                        <Select
                          value={leftData.neck_extension_effect}
                          onValueChange={(value) => setLeftData({...leftData, neck_extension_effect: value})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select effect" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="better">Symptoms better</SelectItem>
                            <SelectItem value="no_change">No change</SelectItem>
                            <SelectItem value="worse">Symptoms worse</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Effect of Ankle Plantarflexion</Label>
                        <Select
                          value={leftData.ankle_plantarflexion_effect}
                          onValueChange={(value) => setLeftData({...leftData, ankle_plantarflexion_effect: value})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select effect" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="better">Symptoms better</SelectItem>
                            <SelectItem value="no_change">No change</SelectItem>
                            <SelectItem value="worse">Symptoms worse</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {leftInterp && hasSymptoms(leftData) && (
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
                  <div className="space-y-4 border-b pb-4">
                    <Label className="font-bold text-base">1. Slump Spine</Label>
                    <Select
                      value={rightData.slump_spine.symptoms}
                      onValueChange={(value) => setRightData({...rightData, slump_spine: {...rightData.slump_spine, symptoms: value}})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Symptoms?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Symptoms produced</SelectItem>
                        <SelectItem value="no">No symptoms</SelectItem>
                      </SelectContent>
                    </Select>
                    {rightData.slump_spine.symptoms === 'yes' && (
                      <>
                        <Select
                          value={rightData.slump_spine.location}
                          onValueChange={(value) => setRightData({...rightData, slump_spine: {...rightData.slump_spine, location: value}})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Where?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low_back">Low back</SelectItem>
                            <SelectItem value="buttock">Buttock</SelectItem>
                            <SelectItem value="posterior_thigh">Posterior thigh</SelectItem>
                            <SelectItem value="below_knee">Below knee</SelectItem>
                            <SelectItem value="foot">Foot</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={rightData.slump_spine.quality}
                          onValueChange={(value) => setRightData({...rightData, slump_spine: {...rightData.slump_spine, quality: value}})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Quality?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sharp">Sharp</SelectItem>
                            <SelectItem value="burning">Burning</SelectItem>
                            <SelectItem value="pins_needles">Pins/needles</SelectItem>
                            <SelectItem value="dull_ache">Dull ache</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>

                  <div className="space-y-4 border-b pb-4">
                    <Label className="font-bold text-base">2. Flex Neck/Chin Tuck</Label>
                    <Select
                      value={rightData.flex_neck.symptoms}
                      onValueChange={(value) => setRightData({...rightData, flex_neck: {...rightData.flex_neck, symptoms: value}})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Symptoms?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Symptoms produced</SelectItem>
                        <SelectItem value="no">No symptoms</SelectItem>
                      </SelectContent>
                    </Select>
                    {rightData.flex_neck.symptoms === 'yes' && (
                      <>
                        <Select
                          value={rightData.flex_neck.location}
                          onValueChange={(value) => setRightData({...rightData, flex_neck: {...rightData.flex_neck, location: value}})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Where?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low_back">Low back</SelectItem>
                            <SelectItem value="buttock">Buttock</SelectItem>
                            <SelectItem value="posterior_thigh">Posterior thigh</SelectItem>
                            <SelectItem value="below_knee">Below knee</SelectItem>
                            <SelectItem value="foot">Foot</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={rightData.flex_neck.quality}
                          onValueChange={(value) => setRightData({...rightData, flex_neck: {...rightData.flex_neck, quality: value}})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Quality?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sharp">Sharp</SelectItem>
                            <SelectItem value="burning">Burning</SelectItem>
                            <SelectItem value="pins_needles">Pins/needles</SelectItem>
                            <SelectItem value="dull_ache">Dull ache</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>

                  <div className="space-y-4 border-b pb-4">
                    <Label className="font-bold text-base">3. Extend Knee</Label>
                    <Select
                      value={rightData.extend_knee.symptoms}
                      onValueChange={(value) => setRightData({...rightData, extend_knee: {...rightData.extend_knee, symptoms: value}})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Symptoms?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Symptoms produced</SelectItem>
                        <SelectItem value="no">No symptoms</SelectItem>
                      </SelectContent>
                    </Select>
                    {rightData.extend_knee.symptoms === 'yes' && (
                      <>
                        <Select
                          value={rightData.extend_knee.location}
                          onValueChange={(value) => setRightData({...rightData, extend_knee: {...rightData.extend_knee, location: value}})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Where?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low_back">Low back</SelectItem>
                            <SelectItem value="buttock">Buttock</SelectItem>
                            <SelectItem value="posterior_thigh">Posterior thigh</SelectItem>
                            <SelectItem value="below_knee">Below knee</SelectItem>
                            <SelectItem value="foot">Foot</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={rightData.extend_knee.quality}
                          onValueChange={(value) => setRightData({...rightData, extend_knee: {...rightData.extend_knee, quality: value}})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Quality?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sharp">Sharp</SelectItem>
                            <SelectItem value="burning">Burning</SelectItem>
                            <SelectItem value="pins_needles">Pins/needles</SelectItem>
                            <SelectItem value="dull_ache">Dull ache</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>

                  <div className="space-y-4 border-b pb-4">
                    <Label className="font-bold text-base">4. Dorsiflex Ankle</Label>
                    <Select
                      value={rightData.dorsiflex_ankle.symptoms}
                      onValueChange={(value) => setRightData({...rightData, dorsiflex_ankle: {...rightData.dorsiflex_ankle, symptoms: value}})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Symptoms?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Symptoms produced</SelectItem>
                        <SelectItem value="no">No symptoms</SelectItem>
                      </SelectContent>
                    </Select>
                    {rightData.dorsiflex_ankle.symptoms === 'yes' && (
                      <>
                        <Select
                          value={rightData.dorsiflex_ankle.location}
                          onValueChange={(value) => setRightData({...rightData, dorsiflex_ankle: {...rightData.dorsiflex_ankle, location: value}})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Where?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low_back">Low back</SelectItem>
                            <SelectItem value="buttock">Buttock</SelectItem>
                            <SelectItem value="posterior_thigh">Posterior thigh</SelectItem>
                            <SelectItem value="below_knee">Below knee</SelectItem>
                            <SelectItem value="foot">Foot</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={rightData.dorsiflex_ankle.quality}
                          onValueChange={(value) => setRightData({...rightData, dorsiflex_ankle: {...rightData.dorsiflex_ankle, quality: value}})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Quality?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sharp">Sharp</SelectItem>
                            <SelectItem value="burning">Burning</SelectItem>
                            <SelectItem value="pins_needles">Pins/needles</SelectItem>
                            <SelectItem value="dull_ache">Dull ache</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>

                  {hasSymptoms(rightData) && (
                    <>

                      <div>
                        <Label>Effect of Neck Extension</Label>
                        <Select
                          value={rightData.neck_extension_effect}
                          onValueChange={(value) => setRightData({...rightData, neck_extension_effect: value})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select effect" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="better">Symptoms better</SelectItem>
                            <SelectItem value="no_change">No change</SelectItem>
                            <SelectItem value="worse">Symptoms worse</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Effect of Ankle Plantarflexion</Label>
                        <Select
                          value={rightData.ankle_plantarflexion_effect}
                          onValueChange={(value) => setRightData({...rightData, ankle_plantarflexion_effect: value})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select effect" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="better">Symptoms better</SelectItem>
                            <SelectItem value="no_change">No change</SelectItem>
                            <SelectItem value="worse">Symptoms worse</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {rightInterp && hasSymptoms(rightData) && (
                    <div className={`p-3 rounded-lg border-2 ${rightInterp.bg} border-current`}>
                      <p className={`font-semibold ${rightInterp.color}`}>{rightInterp.text}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Patient response, bilateral comparison, clinical reasoning..."
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
            disabled={!leftData.slump_spine.symptoms && !rightData.slump_spine.symptoms}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Slump Results
          </Button>
        </div>
      </div>
    </div>
  );
}