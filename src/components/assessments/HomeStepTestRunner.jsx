import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, Square, AlertTriangle, Info, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function HomeStepTestRunner({ client, onSave, onClose }) {
  const [age, setAge] = useState("");
  const [preTestHR, setPreTestHR] = useState("");
  const [preTestRPE, setPreTestRPE] = useState("");
  const [postTestHR, setPostTestHR] = useState("");
  const [postTestRPE, setPostTestRPE] = useState("");
  const [notes, setNotes] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [timer, setTimer] = useState(0);
  const [intervalId, setIntervalId] = useState(null);

  useEffect(() => {
    if (isTesting) {
      const id = setInterval(() => {
        setTimer((prev) => {
          const next = prev + 1;
          if (next >= 180) {
            // Auto-stop at 3 minutes (180 seconds)
            setIsTesting(false);
            toast.info("3-minute test completed. Record post-test vital signs.");
            return next;
          }
          return next;
        });
      }, 1000);
      setIntervalId(id);
    } else {
      clearInterval(intervalId);
    }
    return () => clearInterval(intervalId);
  }, [isTesting]);

  const handleStartTest = () => {
    if (!age || !preTestHR || !preTestRPE) {
      toast.error("Please enter all pre-test information.");
      return;
    }
    setIsTesting(true);
    toast.info("Test started. Follow the stepping pace as directed.");
  };

  const handleStopTest = () => {
    setIsTesting(false);
    toast.info("Test stopped.");
  };

  const handleSave = () => {
    if (!postTestHR || !postTestRPE) {
      toast.error("Please enter all post-test information.");
      return;
    }
    const resultValue = calculateResultValue();
    
    const soapText = buildSOAPText();
    
    const additionalData = {
      measurement_type: "HomeStepTest",
      pre_test: { HR: parseInt(preTestHR), RPE: parseInt(preTestRPE) },
      post_test: { HR: parseInt(postTestHR), RPE: parseInt(postTestRPE) },
      recovery_rate: parseInt(preTestHR) - parseInt(postTestHR),
      result_percentage: resultValue.toFixed(2),
      soap_text: soapText,
    };
    onSave({
      status: "completed",
      result_value: resultValue,
      additional_data: additionalData,
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("Test data saved successfully.");
  };

  const buildSOAPText = () => {
    const recoveryRate = parseInt(preTestHR) - parseInt(postTestHR);
    const resultPercentage = calculateResultValue().toFixed(2);
    
    let text = `Home Step Test:\n`;
    text += `Age: ${age} years\n\n`;
    text += `Pre-Test:\n`;
    text += `• Heart Rate: ${preTestHR} bpm\n`;
    text += `• RPE: ${preTestRPE}/10\n\n`;
    text += `Post-Test:\n`;
    text += `• Heart Rate: ${postTestHR} bpm\n`;
    text += `• RPE: ${postTestRPE}/10\n\n`;
    text += `Results:\n`;
    text += `• Heart Rate Recovery: ${recoveryRate} bpm\n`;
    text += `• Result (%): ${resultPercentage}%\n`;
    if (notes && notes.trim()) text += `\nNotes: ${notes}\n`;
    
    return text;
  };

  const calculateResultValue = () => {
    const ageBasedHR = 220 - age;
    const recoveryRate = preTestHR - postTestHR;
    return (recoveryRate / ageBasedHR) * 100;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Home Step Test</h2>
              <p className="text-slate-600 mt-1">3-minute stepping test to assess cardiovascular fitness</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Timer Display */}
            {isTesting && (
              <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-400 rounded-xl p-6 text-center shadow-lg">
                <p className="text-sm font-semibold text-cyan-700 mb-2">TEST IN PROGRESS</p>
                <p className="text-6xl font-mono font-bold text-cyan-600">
                  {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
                </p>
                <p className="text-sm text-cyan-600 mt-2">{180 - timer} seconds remaining</p>
                <div className="w-full bg-cyan-200 rounded-full h-2 mt-4">
                  <div
                    className="bg-cyan-600 h-2 rounded-full transition-all"
                    style={{ width: `${(timer / 180) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {/* Norms */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Norms & Interpretation</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Post-Test HR</th><th className="p-2 text-left">Fitness Level (age-adjusted)</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">&lt;100 bpm</td><td className="p-2 text-green-700">Excellent cardiovascular fitness</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">100–115 bpm</td><td className="p-2 text-teal-700">Good fitness</td></tr>
                    <tr className="border-t"><td className="p-2">116–130 bpm</td><td className="p-2 text-yellow-700">Average fitness</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">&gt;130 bpm</td><td className="p-2 text-red-700">Below average — further assessment recommended</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">Home Step Test: 3 min step at 24 steps/min on ~20 cm step. HR measured immediately post. HR recovery reflects aerobic capacity. Source: Baker & Staab (2003).</p>
            </div>

            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>Baker SE & Staab JS. (2003). The Home Step Test. <em>Journal of Cardiopulmonary Rehabilitation, 23</em>(2), 141–143.</p>
              <p>McArdle WD, Katch FI, & Katch VL. (2001). <em>Exercise Physiology: Energy, Nutrition, and Human Performance</em> (5th ed.). Lippincott Williams & Wilkins.</p>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Clinician Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-3">
                <p><strong>Setup:</strong> Client should stand facing a step, stair, or 4-inch platform. Ensure safe space and stability.</p>
                <p><strong>Procedure:</strong> Client steps up and down at a rate of 24 steps per minute (one complete cycle = 4 beats) for 3 minutes continuously.</p>
                <p><strong>Audio Pacing:</strong> Use the audio guide below to help maintain the correct stepping pace (24 steps/min).
                  <a 
                    href="https://www.youtube.com/watch?v=WmJVP9B96jc" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 ml-2 text-blue-600 hover:text-blue-800 underline"
                  >
                    3-Minute Step Test Metronome (24 steps/min)
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
                <p><strong>Monitoring:</strong> Record baseline HR and RPE before starting. Stop test after exactly 3 minutes, immediately record post-test HR (within 15 seconds) and RPE.</p>
                <p><strong>Safety:</strong> Monitor for signs of excessive fatigue, chest discomfort, or dizziness. Stop immediately if client reports concerning symptoms.</p>
                <p><strong>Interpretation:</strong> Better cardiovascular fitness is reflected in lower post-test HR and faster recovery.</p>
              </CardContent>
            </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Test Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Enter your age"
              />
            </div>
            <div>
              <Label htmlFor="preTestHR">Pre-Test Heart Rate (bpm)</Label>
              <Input
                id="preTestHR"
                type="number"
                value={preTestHR}
                onChange={(e) => setPreTestHR(e.target.value)}
                placeholder="Enter pre-test heart rate"
              />
            </div>
            <div>
              <Label htmlFor="preTestRPE">Pre-Test Rating of Perceived Exertion (RPE)</Label>
              <Input
                id="preTestRPE"
                type="number"
                value={preTestRPE}
                onChange={(e) => setPreTestRPE(e.target.value)}
                placeholder="Enter pre-test RPE"
              />
            </div>
            <div>
              <Label htmlFor="postTestHR">Post-Test Heart Rate (bpm)</Label>
              <Input
                id="postTestHR"
                type="number"
                value={postTestHR}
                onChange={(e) => setPostTestHR(e.target.value)}
                placeholder="Enter post-test heart rate"
              />
            </div>
            <div>
              <Label htmlFor="postTestRPE">Post-Test Rating of Perceived Exertion (RPE)</Label>
              <Input
                id="postTestRPE"
                type="number"
                value={postTestRPE}
                onChange={(e) => setPostTestRPE(e.target.value)}
                placeholder="Enter post-test RPE"
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any additional notes"
              />
            </div>

          </CardContent>
        </Card>
        </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={handleStartTest}
          disabled={isTesting}
        >
          <Play className="w-4 h-4 mr-2" />
          Start Test
        </Button>
        <Button
          variant="outline"
          onClick={handleStopTest}
          disabled={!isTesting}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Square className="w-4 h-4 mr-2" />
          Stop Test
        </Button>
        <Button
          onClick={handleSave}
          disabled={isTesting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Results
        </Button>
        </div>
        </div>
        </div>
        </div>
        );
        }