import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const TESTS = {
  "Lachman": {
    description: "ACL integrity test - most sensitive for ACL tears",
    protocol: "Client supine, knee at 20-30°. Stabilize femur, translate tibia anteriorly. Assess endpoint quality.",
    grades: ["Normal - firm endpoint", "Grade I (3-5mm) - slight laxity", "Grade II (5-10mm) - moderate laxity", "Grade III (>10mm) - severe laxity, no endpoint"]
  },
  "Anterior Drawer": {
    description: "ACL integrity test - better in chronic injuries",
    protocol: "Client supine, hip 45°, knee 90°. Sit on foot, pull tibia anteriorly. Assess translation and endpoint.",
    grades: ["Normal - firm endpoint", "Grade I (3-5mm) - slight laxity", "Grade II (5-10mm) - moderate laxity", "Grade III (>10mm) - severe laxity, no endpoint"]
  },
  "Pivot Shift": {
    description: "ACL rotational instability - most specific",
    protocol: "Knee extended, apply internal rotation and valgus. Flex knee, feel for subluxation/reduction clunk.",
    grades: ["Negative - no shift", "Grade I - glide", "Grade II - definite clunk", "Grade III - gross shift"]
  },
  "McMurray's": {
    description: "Meniscal tear detection",
    protocol: "Knee fully flexed. External rotation + valgus for medial meniscus. Internal rotation + varus for lateral. Extend knee and feel/listen for clicks with pain.",
    grades: ["Negative - no click or pain", "Positive medial - click + pain", "Positive lateral - click + pain", "Positive both sides"]
  }
};

export default function KneeStabilityRunner({ testType, onSave, onClose }) {
  const testConfig = TESTS[testType];
  const [leftResult, setLeftResult] = useState('');
  const [rightResult, setRightResult] = useState('');
  const [leftPain, setLeftPain] = useState('');
  const [rightPain, setRightPain] = useState('');
  const [notes, setNotes] = useState('');

  const getInterpretation = (result) => {
    if (!result) return null;
    
    if (testType === "Lachman" || testType === "Anterior Drawer") {
      if (result.includes("Normal")) return { text: "ACL likely intact", color: "text-green-600", bg: "bg-green-50" };
      if (result.includes("Grade I")) return { text: "Partial ACL tear suspected", color: "text-yellow-600", bg: "bg-yellow-50" };
      if (result.includes("Grade II") || result.includes("Grade III")) return { text: "High-grade ACL tear suspected", color: "text-red-600", bg: "bg-red-50" };
    }
    
    if (testType === "Pivot Shift") {
      if (result.includes("Negative")) return { text: "No rotational instability", color: "text-green-600", bg: "bg-green-50" };
      return { text: "Rotational ACL instability present", color: "text-red-600", bg: "bg-red-50" };
    }
    
    if (testType === "McMurray's") {
      if (result.includes("Negative")) return { text: "Unlikely meniscal tear", color: "text-green-600", bg: "bg-green-50" };
      return { text: "Meniscal involvement suspected", color: "text-red-600", bg: "bg-red-50" };
    }
    
    return null;
  };

  const handleSave = () => {
    console.log('[KneeStabilityRunner] handleSave triggered:', {
      leftResult,
      rightResult,
      leftPain,
      rightPain,
      notes,
      timestamp: new Date().toISOString()
    });
    
    if (!leftResult && !rightResult) {
      toast.error("Please test at least one side");
      return;
    }

    const leftInterp = getInterpretation(leftResult);
    const rightInterp = getInterpretation(rightResult);

    const isPositive = (leftResult && !leftResult.includes("Normal") && !leftResult.includes("Negative")) ||
                       (rightResult && !rightResult.includes("Normal") && !rightResult.includes("Negative"));

    let soapText = `• ${testType} Test:\n\n`;
    
    if (leftResult) {
      soapText += `  Left Knee:\n`;
      soapText += `    Test Result: ${leftResult}\n`;
      if (leftPain && leftPain !== 'none') soapText += `    Pain Response: ${leftPain.charAt(0).toUpperCase() + leftPain.slice(1)}\n`;
      if (leftInterp) soapText += `    Clinical Impression: ${leftInterp.text}\n`;
    }
    
    if (rightResult) {
      soapText += `\n  Right Knee:\n`;
      soapText += `    Test Result: ${rightResult}\n`;
      if (rightPain && rightPain !== 'none') soapText += `    Pain Response: ${rightPain.charAt(0).toUpperCase() + rightPain.slice(1)}\n`;
      if (rightInterp) soapText += `    Clinical Impression: ${rightInterp.text}\n`;
    }
    
    if (notes) soapText += `\n  Clinical Notes: ${notes}\n`;

    onSave({
      result_value: isPositive ? 1 : 0,
      additional_data: {
        soap_text: soapText,
        knee_stability_data: {
          test_type: testType,
          left_result: leftResult,
          right_result: rightResult,
          left_pain: leftPain,
          right_pain: rightPain,
          left_interpretation: leftInterp?.text,
          right_interpretation: rightInterp?.text
        },
        measurement_type: 'knee_stability'
      },
      notes: notes,
      assessment_date: todayLocal()
    });
  };

  const leftInterp = getInterpretation(leftResult);
  const rightInterp = getInterpretation(rightResult);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{testType} Test</h2>
              <p className="text-slate-600 mt-1">{testConfig.description}</p>
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
              <CardContent className="text-sm text-blue-800">
                <p>{testConfig.protocol}</p>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-lg">Left Knee</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Test Result</Label>
                    <Select
                      value={leftResult}
                      onValueChange={setLeftResult}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select result" />
                      </SelectTrigger>
                      <SelectContent>
                        {testConfig.grades.map(grade => (
                          <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Pain Response</Label>
                    <Select
                      value={leftPain}
                      onValueChange={setLeftPain}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select pain level" />
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
                    <Label>Test Result</Label>
                    <Select
                      value={rightResult}
                      onValueChange={setRightResult}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select result" />
                      </SelectTrigger>
                      <SelectContent>
                        {testConfig.grades.map(grade => (
                          <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Pain Response</Label>
                    <Select
                      value={rightPain}
                      onValueChange={setRightPain}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select pain level" />
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
                  placeholder="Hamstring guarding, endpoint quality, bilateral comparison..."
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
            disabled={!leftResult && !rightResult}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save {testType} Results
          </Button>
        </div>
      </div>
    </div>
  );
}