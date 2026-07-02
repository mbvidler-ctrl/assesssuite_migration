import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

const SPECIAL_TESTS = {
  "Ely's Test": {
    description: "Assesses rectus femoris tightness",
    protocol: "Client prone, passively flex knee while stabilizing pelvis. Positive if hip flexes or pelvis tilts before ~90Â° knee flexion.",
    sides: true,
    options: ["Negative (normal)", "Positive - tightness present", "Positive - pain reproduced"]
  },
  "Thomas Test": {
    description: "Assesses hip flexor tightness",
    protocol: "Client sits at edge of table, rolls back holding one knee to chest, other leg hangs. Positive if thigh doesn't rest flat (hip flexor tight) or knee extends (rectus femoris tight).",
    sides: true,
    options: ["Negative (normal)", "Positive - hip flexor tightness", "Positive - rectus femoris tightness", "Positive - both"]
  },
  "Ober's Test": {
    description: "Assesses iliotibial band tightness",
    protocol: "Client side-lying, lower leg flexed. Flex upper knee to 90Â°, abduct and extend hip, then allow passive adduction. Positive if leg remains abducted above neutral.",
    sides: true,
    options: ["Negative (leg drops to/below neutral)", "Positive - mild tightness", "Positive - moderate tightness", "Positive - severe tightness"]
  }
};

export default function SpecialTestsRunner({ testName, onSave, onClose }) {
  // Normalize test name to match keys
  const normalizedName = testName.includes("Ely") ? "Ely's Test" :
                         testName.includes("Thomas") ? "Thomas Test" :
                         testName.includes("Ober") ? "Ober's Test" : testName;
  
  const testConfig = SPECIAL_TESTS[normalizedName];
  const [leftResult, setLeftResult] = useState('');
  const [rightResult, setRightResult] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    if (!leftResult && !rightResult) {
      toast.error("Please select a result for at least one side");
      return;
    }

    const leftPositive = leftResult && !leftResult.includes("Negative");
    const rightPositive = rightResult && !rightResult.includes("Negative");

    const overallInterp = leftPositive && rightPositive ? "Bilateral positive" : 
                      leftPositive ? "Left positive" : 
                      rightPositive ? "Right positive" : "Bilateral negative";
    const soapText = [
      `â€¢ ${normalizedName}`,
      leftResult ? `  Left: ${leftResult}` : null,
      rightResult ? `  Right: ${rightResult}` : null,
      `  Overall: ${overallInterp}`,
      notes ? `  Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: (leftPositive || rightPositive) ? 1 : 0,
      additional_data: {
        soap_text: soapText,
        test_name: normalizedName,
        left_result: leftResult,
        right_result: rightResult,
        interpretation: overallInterp,
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  if (!testConfig) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-teal-50 to-cyan-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{normalizedName}</h2>
              <p className="text-slate-600 mt-1">{testConfig?.description || ''}</p>
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
                  <CardTitle className="text-lg">Left Side</CardTitle>
                </CardHeader>
                <CardContent>
                  <Label>Test Result</Label>
                  <Select
                    value={leftResult}
                    onValueChange={setLeftResult}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select result" />
                    </SelectTrigger>
                    <SelectContent>
                      {testConfig.options.map(option => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="bg-green-50">
                <CardHeader>
                  <CardTitle className="text-lg">Right Side</CardTitle>
                </CardHeader>
                <CardContent>
                  <Label>Test Result</Label>
                  <Select
                    value={rightResult}
                    onValueChange={setRightResult}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select result" />
                    </SelectTrigger>
                    <SelectContent>
                      {testConfig.options.map(option => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>

            {(leftResult || rightResult) && (
              <Card className={`border-2 ${
                (leftResult && !leftResult.includes("Negative")) || (rightResult && !rightResult.includes("Negative"))
                  ? 'bg-yellow-50 border-yellow-300'
                  : 'bg-green-50 border-green-300'
              }`}>
                <CardContent className="py-4 text-center">
                  <p className="text-sm text-slate-600">Overall Result</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {(leftResult && !leftResult.includes("Negative")) && (rightResult && !rightResult.includes("Negative"))
                      ? "Bilateral Positive"
                      : (leftResult && !leftResult.includes("Negative"))
                      ? "Left Positive"
                      : (rightResult && !rightResult.includes("Negative"))
                      ? "Right Positive"
                      : "Bilateral Negative"}
                  </p>
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
                  placeholder="Pain location, ROM limitations, compensations, clinical reasoning..."
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
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Test Results
          </Button>
        </div>
      </div>
    </div>
  );
}