import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

export default function NobleRunner({ onSave, onClose }) {
  const [leftData, setLeftData] = useState({
    pain_reproduced: '',
    pain_angle: '',
    pain_quality: '',
    pain_intensity: '',
    typical_symptoms: ''
  });
  const [rightData, setRightData] = useState({
    pain_reproduced: '',
    pain_angle: '',
    pain_quality: '',
    pain_intensity: '',
    typical_symptoms: ''
  });
  const [notes, setNotes] = useState('');

  const getInterpretation = (data) => {
    if (data.pain_reproduced === 'yes' && data.typical_symptoms === 'typical') {
      return { text: 'Consistent with ITB friction syndrome', color: 'text-red-600', bg: 'bg-red-50' };
    } else if (data.pain_reproduced === 'yes') {
      return { text: 'Possible ITB involvement', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    }
    return { text: 'ITB friction syndrome unlikely', color: 'text-green-600', bg: 'bg-green-50' };
  };

  const handleSave = () => {
    if (!leftData.pain_reproduced && !rightData.pain_reproduced) {
      toast.error("Please test at least one side");
      return;
    }

    const leftInterp = getInterpretation(leftData);
    const rightInterp = getInterpretation(rightData);

    const formatSide = (label, data, interp) => {
      if (!data.pain_reproduced) return null;
      const lines = [`  ${label} Knee:`];
      lines.push(`    Pain Reproduced: ${data.pain_reproduced === 'yes' ? 'Yes' : 'No'}`);
      if (data.pain_reproduced === 'yes') {
        if (data.pain_angle) lines.push(`    Angle at Pain Onset: ${data.pain_angle}Â°`);
        if (data.pain_quality) lines.push(`    Pain Quality: ${data.pain_quality.charAt(0).toUpperCase() + data.pain_quality.slice(1)}`);
        if (data.pain_intensity) lines.push(`    Pain Intensity: ${data.pain_intensity.charAt(0).toUpperCase() + data.pain_intensity.slice(1)}`);
        if (data.typical_symptoms) {
          const sympLabel = data.typical_symptoms === 'typical' ? 'Typical symptoms' : data.typical_symptoms === 'somewhat' ? 'Somewhat similar' : 'Not typical';
          lines.push(`    Symptom Relationship: ${sympLabel}`);
        }
        lines.push(`    Interpretation: ${interp.text}`);
      }
      return lines.join('\n');
    };

    const overall = (leftData.pain_reproduced === 'yes' || rightData.pain_reproduced === 'yes') ? 'Positive' : 'Negative';
    const soapParts = [
      `â€¢ Noble Compression Test: ${overall}`,
      formatSide('Left', leftData, leftInterp),
      formatSide('Right', rightData, rightInterp),
    ].filter(Boolean);
    if (notes) soapParts.push(`  Clinical Notes: ${notes}`);
    const soapText = soapParts.join('\n');

    onSave({
      result_value: overall === 'Positive' ? 1 : 0,
      additional_data: {
        measurement_type: 'Noble Compression Test',
        result: overall,
        left_pain_reproduced: leftData.pain_reproduced || null,
        left_angle: leftData.pain_angle || null,
        left_pain_quality: leftData.pain_quality || null,
        left_pain_intensity: leftData.pain_intensity || null,
        left_interpretation: leftData.pain_reproduced ? leftInterp.text : null,
        right_pain_reproduced: rightData.pain_reproduced || null,
        right_angle: rightData.pain_angle || null,
        right_pain_quality: rightData.pain_quality || null,
        right_pain_intensity: rightData.pain_intensity || null,
        right_interpretation: rightData.pain_reproduced ? rightInterp.text : null,
        soap_text: soapText,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
  };

  const leftInterp = getInterpretation(leftData);
  const rightInterp = getInterpretation(rightData);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Noble Compression Test</h2>
              <p className="text-slate-600 mt-1">ITB friction syndrome assessment</p>
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
                  Test Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>Position:</strong> Supine, knee flexed to 90Â°</p>
                <p><strong>Procedure:</strong> Apply pressure over lateral femoral epicondyle, extend knee slowly</p>
                <p><strong>Positive:</strong> Sharp lateral knee pain around 30Â° flexion that reproduces typical symptoms</p>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-lg">Left Knee</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Pain Over Lateral Epicondyle</Label>
                    <Select
                      value={leftData.pain_reproduced}
                      onValueChange={(value) => setLeftData({...leftData, pain_reproduced: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes - reproduced</SelectItem>
                        <SelectItem value="no">No pain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {leftData.pain_reproduced === 'yes' && (
                    <>
                      <div>
                        <Label>Angle at Pain Onset (degrees)</Label>
                        <Input
                          type="number"
                          value={leftData.pain_angle}
                          onChange={(e) => setLeftData({...leftData, pain_angle: e.target.value})}
                          placeholder="e.g., 30"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label>Pain Quality</Label>
                        <Select
                          value={leftData.pain_quality}
                          onValueChange={(value) => setLeftData({...leftData, pain_quality: value})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select quality" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sharp">Sharp</SelectItem>
                            <SelectItem value="burning">Burning</SelectItem>
                            <SelectItem value="ache">Ache</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Pain Intensity</Label>
                        <Select
                          value={leftData.pain_intensity}
                          onValueChange={(value) => setLeftData({...leftData, pain_intensity: value})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select intensity" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mild">Mild</SelectItem>
                            <SelectItem value="moderate">Moderate</SelectItem>
                            <SelectItem value="severe">Severe</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Relationship to Usual Symptoms</Label>
                        <Select
                          value={leftData.typical_symptoms}
                          onValueChange={(value) => setLeftData({...leftData, typical_symptoms: value})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="typical">Typical symptoms</SelectItem>
                            <SelectItem value="somewhat">Somewhat similar</SelectItem>
                            <SelectItem value="not_typical">Not typical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {leftInterp && (
                    <div className={`p-3 rounded-lg border-2 ${leftInterp.bg} border-current`}>
                      <p className={`font-semibold ${leftInterp.color}`}>{leftInterp.text}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-green-50">
                <CardHeader>
                  <CardTitle className="text-lg">Right Knee</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Pain Over Lateral Epicondyle</Label>
                    <Select
                      value={rightData.pain_reproduced}
                      onValueChange={(value) => setRightData({...rightData, pain_reproduced: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes - reproduced</SelectItem>
                        <SelectItem value="no">No pain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {rightData.pain_reproduced === 'yes' && (
                    <>
                      <div>
                        <Label>Angle at Pain Onset (degrees)</Label>
                        <Input
                          type="number"
                          value={rightData.pain_angle}
                          onChange={(e) => setRightData({...rightData, pain_angle: e.target.value})}
                          placeholder="e.g., 30"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label>Pain Quality</Label>
                        <Select
                          value={rightData.pain_quality}
                          onValueChange={(value) => setRightData({...rightData, pain_quality: value})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select quality" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sharp">Sharp</SelectItem>
                            <SelectItem value="burning">Burning</SelectItem>
                            <SelectItem value="ache">Ache</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Pain Intensity</Label>
                        <Select
                          value={rightData.pain_intensity}
                          onValueChange={(value) => setRightData({...rightData, pain_intensity: value})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select intensity" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mild">Mild</SelectItem>
                            <SelectItem value="moderate">Moderate</SelectItem>
                            <SelectItem value="severe">Severe</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Relationship to Usual Symptoms</Label>
                        <Select
                          value={rightData.typical_symptoms}
                          onValueChange={(value) => setRightData({...rightData, typical_symptoms: value})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="typical">Typical symptoms</SelectItem>
                            <SelectItem value="somewhat">Somewhat similar</SelectItem>
                            <SelectItem value="not_typical">Not typical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

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
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Pain localization, running history, training load..."
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
            disabled={!leftData.pain_reproduced && !rightData.pain_reproduced}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Noble Test Results
          </Button>
        </div>
      </div>
    </div>
  );
}