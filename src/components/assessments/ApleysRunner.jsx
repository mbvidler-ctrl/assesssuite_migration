import React, { useState } from "react";
import { todayLocal } from "@/lib/localDate";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

export default function ApleysRunner({ onSave, onClose }) {
  const [leftData, setLeftData] = useState({
    compression_pain: '',
    clicking: '',
    distraction_comparison: '',
    pain_intensity: ''
  });
  const [rightData, setRightData] = useState({
    compression_pain: '',
    clicking: '',
    distraction_comparison: '',
    pain_intensity: ''
  });
  const [notes, setNotes] = useState('');

  const getInterpretation = (data) => {
    if (!data.compression_pain) return null;
    
    if (data.compression_pain !== 'none' && data.distraction_comparison === 'compression_greater') {
      return { text: 'Meniscal pathology suspected', color: 'text-red-600', bg: 'bg-red-50' };
    } else if (data.compression_pain !== 'none') {
      return { text: 'Possible meniscal involvement', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    } else if (data.distraction_comparison === 'distraction_greater') {
      return { text: 'Ligamentous/capsular involvement more likely', color: 'text-blue-600', bg: 'bg-blue-50' };
    }
    return { text: 'Meniscal tear unlikely', color: 'text-green-600', bg: 'bg-green-50' };
  };

  const handleSave = () => {
    if (!leftData.compression_pain && !rightData.compression_pain) {
      toast.error("Please test at least one side");
      return;
    }

    const leftInterp = getInterpretation(leftData);
    const rightInterp = getInterpretation(rightData);

    const isPositive = (leftData.compression_pain && leftData.compression_pain !== 'none') ||
                       (rightData.compression_pain && rightData.compression_pain !== 'none');

    const soapText = [
      `• Apley's Compression Test`,
      leftData.compression_pain ? `  Left: ${leftData.compression_pain} pain — ${leftInterp?.text || ''}` : null,
      rightData.compression_pain ? `  Right: ${rightData.compression_pain} pain — ${rightInterp?.text || ''}` : null,
      notes ? `  Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: isPositive ? 1 : 0,
      additional_data: { soap_text: soapText },
      left_data: leftData.compression_pain ? {
        ...leftData,
        interpretation: leftInterp?.text
      } : null,
      right_data: rightData.compression_pain ? {
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
        <div className="p-6 border-b bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Apley's Compression Test</h2>
              <p className="text-slate-600 mt-1">Meniscal assessment via compression</p>
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
                <p><strong>Position:</strong> Prone, knee flexed to 90°</p>
                <p><strong>Procedure:</strong> Apply axial compression through tibia, rotate medially and laterally</p>
                <p><strong>Positive:</strong> Joint-line pain with compression greater than distraction suggests meniscal tear</p>
              </CardContent>
            </Card>

            {/* Norms & Interpretation */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Diagnostic Accuracy & Interpretation</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Result Pattern</th><th className="p-2 text-left">Likely Pathology</th></tr></thead>
                  <tbody>
                    <tr className="border-t border-slate-200"><td className="p-2">Pain greater with compression</td><td className="p-2 text-red-700">Meniscal tear suspected</td></tr>
                    <tr className="border-t border-slate-200 bg-white"><td className="p-2">Pain greater with distraction</td><td className="p-2 text-blue-700">Ligamentous/capsular more likely</td></tr>
                    <tr className="border-t border-slate-200"><td className="p-2">No pain either manoeuvre</td><td className="p-2 text-green-700">Meniscal tear unlikely</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">Sensitivity ~61%, Specificity ~70%. Best used in combination with McMurray's test and joint-line tenderness palpation. MRI is gold standard.</p>
            </div>

            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>Apley AG. (1947). The diagnosis of meniscus injuries. <em>Journal of Bone and Joint Surgery, 29</em>(1), 78–84.</p>
              <p>Scholten RJPM et al. (2001). The accuracy of physical diagnostic tests for assessing meniscal lesions of the knee. <em>Journal of Family Practice, 50</em>(11), 938–944.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-lg">Left Knee</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Joint-Line Pain with Compression</Label>
                    <Select
                      value={leftData.compression_pain}
                      onValueChange={(value) => setLeftData({...leftData, compression_pain: value})}
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
                    <Label>Clicking/Catching</Label>
                    <Select
                      value={leftData.clicking}
                      onValueChange={(value) => setLeftData({...leftData, clicking: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="yes">Yes - present</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Compression vs Distraction</Label>
                    <Select
                      value={leftData.distraction_comparison}
                      onValueChange={(value) => setLeftData({...leftData, distraction_comparison: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Compare pain" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compression_greater">Pain greater with compression</SelectItem>
                        <SelectItem value="distraction_greater">Pain greater with distraction</SelectItem>
                        <SelectItem value="similar">Similar</SelectItem>
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
                    <Label>Joint-Line Pain with Compression</Label>
                    <Select
                      value={rightData.compression_pain}
                      onValueChange={(value) => setRightData({...rightData, compression_pain: value})}
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
                    <Label>Clicking/Catching</Label>
                    <Select
                      value={rightData.clicking}
                      onValueChange={(value) => setRightData({...rightData, clicking: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="yes">Yes - present</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Compression vs Distraction</Label>
                    <Select
                      value={rightData.distraction_comparison}
                      onValueChange={(value) => setRightData({...rightData, distraction_comparison: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Compare pain" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compression_greater">Pain greater with compression</SelectItem>
                        <SelectItem value="distraction_greater">Pain greater with distraction</SelectItem>
                        <SelectItem value="similar">Similar</SelectItem>
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
                  placeholder="Location specificity, click quality, comparison observations..."
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
            disabled={!leftData.compression_pain && !rightData.compression_pain}
            className="bg-amber-600 hover:bg-amber-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Apley's Results
          </Button>
        </div>
      </div>
    </div>
  );
}