import React, { useState } from "react";
import { todayLocal } from "@/lib/localDate";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

export default function ThessalyRunner({ onSave, onClose }) {
  const [leftData, setLeftData] = useState({
    joint_line_pain: '',
    mechanical_symptoms: '',
    pain_intensity: ''
  });
  const [rightData, setRightData] = useState({
    joint_line_pain: '',
    mechanical_symptoms: '',
    pain_intensity: ''
  });
  const [notes, setNotes] = useState('');

  const getInterpretation = (data) => {
    if (!data.joint_line_pain) return null;
    
    if (data.joint_line_pain === 'medial' || data.joint_line_pain === 'both') {
      return { text: 'Medial meniscal involvement suspected', color: 'text-red-600', bg: 'bg-red-50' };
    } else if (data.joint_line_pain === 'lateral') {
      return { text: 'Lateral meniscal involvement suspected', color: 'text-red-600', bg: 'bg-red-50' };
    }
    return { text: 'Meniscal tear unlikely', color: 'text-green-600', bg: 'bg-green-50' };
  };

  const handleSave = () => {
    if (!leftData.joint_line_pain && !rightData.joint_line_pain) {
      toast.error("Please test at least one side");
      return;
    }

    const leftInterp = getInterpretation(leftData);
    const rightInterp = getInterpretation(rightData);

    const isPositive = (leftData.joint_line_pain && leftData.joint_line_pain !== 'none') ||
                       (rightData.joint_line_pain && rightData.joint_line_pain !== 'none');

    const soapText = [
      `• Thessaly Test`,
      leftData.joint_line_pain ? `  Left: ${leftData.joint_line_pain} pain — ${leftInterp?.text || ''}` : null,
      rightData.joint_line_pain ? `  Right: ${rightData.joint_line_pain} pain — ${rightInterp?.text || ''}` : null,
      notes ? `  Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: isPositive ? 1 : 0,
      additional_data: { soap_text: soapText },
      left_data: leftData.joint_line_pain ? {
        ...leftData,
        interpretation: leftInterp?.text
      } : null,
      right_data: rightData.joint_line_pain ? {
        ...rightData,
        interpretation: rightInterp?.text
      } : null,
      notes: notes,
      assessment_date: todayLocal()
    });
  };

  const leftInterp = getInterpretation(leftData);
  const rightInterp = getInterpretation(rightData);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-teal-50 to-cyan-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Thessaly Test</h2>
              <p className="text-slate-600 mt-1">Dynamic meniscal assessment</p>
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
                <p><strong>Standard version:</strong> Single-leg stance, knee flexed to <strong>20°</strong>. Clinician holds client's outstretched hands for balance only. Client rotates body and knee medially and laterally 3 times. Then repeat at <strong>5°</strong> flexion.</p>
                <p className="italic">"Stand on one leg with your knee slightly bent. Rotate your body left and right 3 times while keeping your foot flat."</p>
                <p><strong>Positive:</strong> Joint-line pain (medial or lateral), locking, catching, or giving way during rotation. Pain location indicates which meniscus.</p>
                <p><strong>Note:</strong> Requires good balance — not suitable if client cannot safely stand single-leg. Modified version with 5° shows higher sensitivity.</p>
              </CardContent>
            </Card>

            {/* Norms */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Diagnostic Accuracy</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Version</th><th className="p-2 text-center">Sensitivity</th><th className="p-2 text-center">Specificity</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">20° knee flexion</td><td className="p-2 text-center">~66%</td><td className="p-2 text-center">~97%</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">5° knee flexion</td><td className="p-2 text-center">~89%</td><td className="p-2 text-center">~97%</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">High specificity makes it useful to rule in meniscal tear. 5° version more sensitive. Source: Karachalios et al. (2005).</p>
            </div>

            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>Karachalios T et al. (2005). Diagnostic accuracy of a new clinical test (the Thessaly test) for early detection of meniscal tears. <em>Journal of Bone and Joint Surgery (Am), 87</em>(5), 955–962.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-lg">Left Knee</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Joint-Line Pain</Label>
                    <Select
                      value={leftData.joint_line_pain}
                      onValueChange={(value) => setLeftData({...leftData, joint_line_pain: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="medial">Medial</SelectItem>
                        <SelectItem value="lateral">Lateral</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Mechanical Symptoms</Label>
                    <Select
                      value={leftData.mechanical_symptoms}
                      onValueChange={(value) => setLeftData({...leftData, mechanical_symptoms: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select symptoms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="catching">Catching</SelectItem>
                        <SelectItem value="locking">Locking</SelectItem>
                        <SelectItem value="giving_way">Giving way</SelectItem>
                        <SelectItem value="multiple">Multiple symptoms</SelectItem>
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
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="mild">Mild</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="severe">Severe</SelectItem>
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
                  <CardTitle className="text-lg">Right Knee</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Joint-Line Pain</Label>
                    <Select
                      value={rightData.joint_line_pain}
                      onValueChange={(value) => setRightData({...rightData, joint_line_pain: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="medial">Medial</SelectItem>
                        <SelectItem value="lateral">Lateral</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Mechanical Symptoms</Label>
                    <Select
                      value={rightData.mechanical_symptoms}
                      onValueChange={(value) => setRightData({...rightData, mechanical_symptoms: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select symptoms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="catching">Catching</SelectItem>
                        <SelectItem value="locking">Locking</SelectItem>
                        <SelectItem value="giving_way">Giving way</SelectItem>
                        <SelectItem value="multiple">Multiple symptoms</SelectItem>
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
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="mild">Mild</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="severe">Severe</SelectItem>
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
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Balance, tolerance, symptom description..."
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
            disabled={!leftData.joint_line_pain && !rightData.joint_line_pain}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Thessaly Results
          </Button>
        </div>
      </div>
    </div>
  );
}