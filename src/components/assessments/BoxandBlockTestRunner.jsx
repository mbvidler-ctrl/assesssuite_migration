import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, Square, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";


export default function BoxandBlockTestRunner({ client, assessment, onSave, onClose }) {
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [blocksMoved, setBlocksMoved] = useState(0);
  const [dominantHand, setDominantHand] = useState("right");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [notes, setNotes] = useState("");
  const [testCompleted, setTestCompleted] = useState(false);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0) {
      handleStop();
    }
  }, [isRunning, timeLeft]);

  const handleStart = () => {
    if (!age || !sex) {
      toast.error("Please enter age and sex.");
      return;
    }
    setIsRunning(true);
    setTimeLeft(60);
    setBlocksMoved(0);
    setTestCompleted(false);
    toast.success("Test started. Move as many blocks as possible in one minute.");
  };

  const handleStop = () => {
    setIsRunning(false);
    setTestCompleted(true);
    toast.success("Test stopped.");
  };

  const handleBlockMoved = () => {
    if (isRunning) {
      setBlocksMoved((prevCount) => prevCount + 1);
    }
  };

  const handleSave = () => {
    if (!testCompleted) {
      toast.error("Please complete the test before saving.");
      return;
    }

    const resultValue = blocksMoved;
    const normativeData = getNormativeData(age, sex, dominantHand);
    const comparison = compareToNormativeData(resultValue, normativeData);
    const assessmentDate = todayLocal();
    
    const soapText = `• Box and Block Test:\n  Blocks Moved: ${resultValue}\n  Dominant Hand: ${dominantHand}\n  Age: ${age}\n  Sex: ${sex}\n  Result: ${comparison}`;

    const assessmentData = {
      status: "completed",
      result_value: resultValue,
      additional_data: { 
        measurement_type: "box_and_block",
        blocks_moved: resultValue,
        dominant_hand: dominantHand,
        age: parseInt(age),
        sex: sex,
        comparison: comparison,
        soap_text: soapText
      },
      notes,
      assessment_date: assessmentDate,
    };

    onSave(assessmentData);
  };

  const getNormativeData = (age, sex, hand) => {
    // Replace with actual normative data retrieval logic
    return { mean: 80, sd: 10 }; // Placeholder values
  };

  const compareToNormativeData = (score, { mean, sd }) => {
    if (score >= mean + sd) return "Above average";
    if (score >= mean - sd) return "Average";
    return "Below average";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Box and Block Test</h2>
            <p className="text-sm text-slate-500 mt-0.5">Measure unilateral gross manual dexterity</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Instructions */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600" />
                Test Protocol
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-blue-800 space-y-2">
              <p><strong>Objective:</strong> Transfer as many blocks as possible from one side of a box to the other in 60 seconds using the dominant hand.</p>
              <p><strong>Setup:</strong> Client seated, box placed on table at waist height. 150 blocks on one side of partition.</p>
              <p><strong>Scoring:</strong> Count total blocks successfully transferred to opposite side within 60 seconds.</p>
            </CardContent>
          </Card>

          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Client Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Age (years)</Label>
                  <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} disabled={isRunning} placeholder="Enter age" />
                </div>
                <div>
                  <Label>Sex</Label>
                  <select 
                    value={sex} 
                    onChange={(e) => setSex(e.target.value)} 
                    disabled={isRunning}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="">Select sex</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>Dominant Hand</Label>
                <select 
                  value={dominantHand} 
                  onChange={(e) => setDominantHand(e.target.value)} 
                  disabled={isRunning}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="right">Right</option>
                  <option value="left">Left</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Test Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Test Execution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm text-slate-600">Time Remaining</p>
                  <p className={`text-3xl font-bold ${timeLeft <= 10 ? 'text-red-600' : 'text-slate-900'}`}>{timeLeft}s</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Blocks Moved</p>
                  <p className="text-3xl font-bold text-indigo-600">{blocksMoved}</p>
                </div>
              </div>

              <div className="space-y-2">
                {!isRunning && !testCompleted && (
                  <Button onClick={handleStart} disabled={!age || !sex} className="w-full bg-indigo-600 hover:bg-indigo-700">
                    <Play className="w-4 h-4 mr-2" /> Start Test
                  </Button>
                )}
                
                {isRunning && (
                  <>
                    <Button onClick={() => setBlocksMoved(b => b + 1)} className="w-full bg-green-600 hover:bg-green-700">
                      Block Moved (+1)
                    </Button>
                    <Button onClick={handleStop} variant="outline" className="w-full">
                      <Square className="w-4 h-4 mr-2" /> Stop Test
                    </Button>
                  </>
                )}

                {testCompleted && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="font-semibold text-green-900">Test Complete</p>
                    <p className="text-sm text-green-800">Total blocks moved: {blocksMoved}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Clinical Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isRunning}
                placeholder="Observations, client fatigue, hand dominance confirmation, grip strength observations..."
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!testCompleted} className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="w-4 h-4 mr-2" />
            Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}