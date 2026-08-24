import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";
import { validateAndScoreAstrandStep } from "@/lib/clinical/scorers/residualAssessments";

export default function AstrandRhymingStepTestRunner({ client, onSave, onClose }) {
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);
  const [heartRate, setHeartRate] = useState("");
  const [postTestHeartRate, setPostTestHeartRate] = useState("");
  const [notes, setNotes] = useState("");
  const [gender, setGender] = useState(client?.gender || "male");
  const [age, setAge] = useState(client?.age || "");
  const [weight, setWeight] = useState(client?.weight || "");
  const [height, setHeight] = useState(client?.height || "");
  const [isTestCompleted, setIsTestCompleted] = useState(false);

  useEffect(() => {
    if (isRunning) {
      const timer = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timer);
            setIsRunning(false);
            setIsTestCompleted(true);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isRunning]);

  const handleStart = () => {
    if (!age || !weight || !height) {
      toast.error("Please enter all client details before starting the test.");
      return;
    }
    setIsRunning(true);
    setIsTestCompleted(false);
    setTimeLeft(300);
    setHeartRate("");
    setPostTestHeartRate("");
    setNotes("");
  };

  const handleStop = () => {
    setIsRunning(false);
    setIsTestCompleted(true);
  };

  const handleSave = () => {
    try {
      const payload = validateAndScoreAstrandStep({
        sex: gender,
        age,
        weight_kg: weight,
        height_cm: height,
        elapsed_seconds: 300 - timeLeft,
        heart_rate_during: heartRate,
        post_test_heart_rate: postTestHeartRate,
        notes,
      }, {
        assessmentName: "Åstrand-Rhyming Step Test",
        assessmentDate: todayLocal(),
        notes,
        client,
      });
      onSave(payload);
      toast.success("Test results saved successfully.");
    } catch (error) {
      toast.error(error?.message || "Unable to score the step test.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="space-y-4">
          {/* Clinician Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
            <p className="font-semibold">📋 Administration Instructions</p>
            <p><strong>Step height:</strong> Men = 40 cm, Women = 33 cm. <strong>Cadence:</strong> 22.5 steps/min (metronome at 90 bpm for 4-count stepping). Duration: 5 minutes continuous stepping.</p>
            <p className="italic">"Step up and down to the beat — up-up-down-down. Keep the rhythm throughout. Tell me immediately if you feel chest pain or dizziness."</p>
            <p><strong>Heart rate:</strong> Measure HR in the final 30 seconds of minute 5 (or immediately post-exercise within 5–10 seconds). Enter this as post-test HR for VO2max estimation.</p>
            <p><strong>Note:</strong> Age-correction factor should be applied to the Åstrand nomogram result. The formula in this runner uses a simplified estimation.</p>
          </div>

          {/* Result contract */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold text-slate-700">Recorded result</p>
            <p>The canonical result is the immediate post-test heart rate together with the exact step height, cadence and elapsed duration. This runner does not calculate a VO₂max from an unvalidated shortcut equation.</p>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Åstrand PO & Rhyming I. (1954). A nomogram for calculation of aerobic capacity from pulse rate during submaximal work. <em>Journal of Applied Physiology, 7</em>(2), 218–221.</p>
            <p>Marley WP & Linnerud AC. (1976). The Åstrand-Rhyming step test revisited. <em>British Journal of Sports Medicine, 10</em>(4), 163–165.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Åstrand-Rhyming Step Test</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="age">Age</Label>
                  <Input id="age" type="number" value={age} onChange={(e) => setAge(e.target.value)} disabled={isRunning || isTestCompleted} />
                </div>
                <div>
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input id="weight" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} disabled={isRunning || isTestCompleted} />
                </div>
                <div>
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input id="height" type="number" value={height} onChange={(e) => setHeight(e.target.value)} disabled={isRunning || isTestCompleted} />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)} disabled={isRunning || isTestCompleted} className="w-full p-2 border border-gray-300 rounded">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <Label>Test Status</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge>
                    {isRunning ? "In Progress" : isTestCompleted ? "Completed" : "Not Started"}
                  </Badge>
                  {isRunning && (
                    <div className="text-lg font-semibold">
                      Time Remaining: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <Label>Heart Rate During Test (bpm)</Label>
                <Input type="number" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} placeholder="Enter heart rate during test" disabled={isRunning} />
              </div>
              <div className="mt-4">
                <Label>Post-Test Heart Rate (bpm)</Label>
                <Input type="number" value={postTestHeartRate} onChange={(e) => setPostTestHeartRate(e.target.value)} placeholder="Enter heart rate immediately after test" disabled={isRunning} />
              </div>
              <div className="mt-4">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Enter any additional notes" disabled={isRunning} />
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="outline" onClick={onClose} disabled={isRunning}>
              <X className="mr-2" />Close
            </Button>
            <div className="space-x-2">
              {!isRunning && !isTestCompleted && (
                <Button onClick={handleStart}>
                  <Play className="mr-2" />Start Test
                </Button>
              )}
              {isRunning && (
                <Button variant="destructive" onClick={handleStop}>
                  <AlertTriangle className="mr-2" />Stop Test
                </Button>
              )}
              {isTestCompleted && (
                <Button onClick={handleSave}>
                  <Save className="mr-2" />Save Results
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
