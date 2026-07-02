import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, X, Play } from "lucide-react";
import { toast } from "sonner";

export default function OneMinuteSitToStandTestRunner({ client, onSave, onClose }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [repetitions, setRepetitions] = useState(0);
  const [chairHeightCm, setChairHeightCm] = useState("");
  const [armPosition, setArmPosition] = useState("Crossed on chest");
  const [assistiveDevice, setAssistiveDevice] = useState(false);
  const [preTestVitals, setPreTestVitals] = useState({ heartRate: "", oxygenSaturation: "" });
  const [postTestVitals, setPostTestVitals] = useState({ heartRate: "", oxygenSaturation: "", rpe: "", breathlessness: "", pain: "" });
  const [notes, setNotes] = useState("");
  const [isTestCompleted, setIsTestCompleted] = useState(false);

  useEffect(() => {
    let timer;
    if (isTestRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsTestRunning(false);
      setIsTestCompleted(true);
      toast.success("Test completed.");
    }
    return () => clearInterval(timer);
  }, [isTestRunning, timeLeft]);

  const handleStartTest = () => {
    setIsTestRunning(true);
    setTimeLeft(60);
    setRepetitions(0);
    setIsTestCompleted(false);
    toast.success("Test started. Perform as many sit-to-stand repetitions as possible.");
  };

  const handleStopTest = () => {
    setIsTestRunning(false);
    setTimeLeft(0);
    setIsTestCompleted(true);
  };

  const handleRepetition = () => {
    if (isTestRunning) {
      setRepetitions((prevReps) => prevReps + 1);
    }
  };

  const handlePreTestVitalsChange = (e) => {
    const { name, value } = e.target;
    setPreTestVitals((prevVitals) => ({ ...prevVitals, [name]: value }));
  };

  const handlePostTestVitalsChange = (e) => {
    const { name, value } = e.target;
    setPostTestVitals((prevVitals) => ({ ...prevVitals, [name]: value }));
  };

  const handleSave = () => {
    const resultValue = repetitions;
    const additionalData = {
      measurement_type: "1_minute_sit_to_stand",
      repetitions,
      chair_height_cm: chairHeightCm ? parseFloat(chairHeightCm) : null,
      arm_position_used: armPosition,
      assistive_device_used: assistiveDevice,
      pre_test_heart_rate: preTestVitals.heartRate ? parseFloat(preTestVitals.heartRate) : null,
      pre_test_spo2: preTestVitals.oxygenSaturation ? parseFloat(preTestVitals.oxygenSaturation) : null,
      post_test_heart_rate: postTestVitals.heartRate ? parseFloat(postTestVitals.heartRate) : null,
      post_test_spo2: postTestVitals.oxygenSaturation ? parseFloat(postTestVitals.oxygenSaturation) : null,
      post_test_rpe: postTestVitals.rpe ? parseFloat(postTestVitals.rpe) : null,
      post_test_breathlessness: postTestVitals.breathlessness ? parseFloat(postTestVitals.breathlessness) : null,
      post_test_pain: postTestVitals.pain ? parseFloat(postTestVitals.pain) : null,
    };

    let soapNotes = `**1-Minute Sit-to-Stand Test**\n\n`;
    soapNotes += `**Result:** ${repetitions} repetitions\n\n`;
    soapNotes += `**Test Setup:**\n`;
    if (chairHeightCm) soapNotes += `- Chair Height: ${chairHeightCm} cm\n`;
    soapNotes += `- Arm Position: ${armPosition}\n`;
    if (assistiveDevice) soapNotes += `- Assistive Device: Used\n`;
    soapNotes += `\n`;

    if (preTestVitals.heartRate || preTestVitals.oxygenSaturation) {
      soapNotes += `**Pre-Test Vitals:**\n`;
      if (preTestVitals.heartRate) soapNotes += `- HR: ${preTestVitals.heartRate} bpm\n`;
      if (preTestVitals.oxygenSaturation) soapNotes += `- SpO2: ${preTestVitals.oxygenSaturation}%\n`;
      soapNotes += `\n`;
    }

    if (postTestVitals.heartRate || postTestVitals.oxygenSaturation || postTestVitals.rpe || postTestVitals.breathlessness || postTestVitals.pain) {
      soapNotes += `**Post-Test:**\n`;
      if (postTestVitals.heartRate) soapNotes += `- HR: ${postTestVitals.heartRate} bpm\n`;
      if (postTestVitals.oxygenSaturation) soapNotes += `- SpO2: ${postTestVitals.oxygenSaturation}%\n`;
      if (postTestVitals.rpe) soapNotes += `- RPE: ${postTestVitals.rpe}/10\n`;
      if (postTestVitals.breathlessness) soapNotes += `- Breathlessness: ${postTestVitals.breathlessness}/10\n`;
      if (postTestVitals.pain) soapNotes += `- Pain: ${postTestVitals.pain}/10\n`;
      soapNotes += `\n`;
    }

    if (notes.trim()) {
      soapNotes += `**Notes:** ${notes}\n`;
    }

    let interpretation = '';
    if (repetitions >= 25) interpretation = 'Above average';
    else if (repetitions >= 17) interpretation = 'Average';
    else interpretation = 'Below average';

    const soapText = `â€¢ 1-Minute Sit-to-Stand Test (1MSTS)\n\n  Repetitions: ${repetitions} in 60 seconds â€” ${interpretation}\n\n  Normative Values (healthy adults 60-69): ~35-45 reps\n  Healthy adults 70-79: ~28-38 reps | 80+: ~20-30 reps\n  Strongly correlated with VO2max and 6MWT in COPD/cardiac populations\n  MCID: 3-4 repetitions\n\n  Reference: Crook et al. (2017). Validity of the 1 minute sit-to-stand test in patients with COPD. Journal of Cardiopulmonary Rehabilitation, 37(4), 278-282.`;

    onSave({
      repetitions,
      interpretation,
      result_value: resultValue,
      additional_data: {
        ...additionalData,
        measurement_type: '1_minute_sit_to_stand',
        soap_text: soapText,
      },
      notes: soapNotes
    });
    handleClose();
  };

  const handleClose = () => {
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle>1-Minute Sit-to-Stand Test</CardTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="chairHeight">Chair Height (cm)</Label>
                <Input
                  id="chairHeight"
                  type="number"
                  placeholder="~45 cm"
                  value={chairHeightCm}
                  onChange={(e) => setChairHeightCm(e.target.value)}
                  disabled={isTestRunning}
                />
              </div>
              <div>
                <Label htmlFor="armPosition">Arm Position</Label>
                <Select value={armPosition} onValueChange={setArmPosition} disabled={isTestRunning}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Crossed on chest">Crossed on chest</SelectItem>
                    <SelectItem value="Hands on hips">Hands on hips</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="assistiveDevice"
                checked={assistiveDevice}
                onCheckedChange={setAssistiveDevice}
                disabled={isTestRunning}
              />
              <Label htmlFor="assistiveDevice" className="cursor-pointer">Assistive device used</Label>
            </div>

            <div>
              <Label>Pre-Test Vital Signs</Label>
              <div className="flex space-x-4">
                <Input
                  name="heartRate"
                  type="number"
                  placeholder="Heart Rate (bpm)"
                  value={preTestVitals.heartRate}
                  onChange={handlePreTestVitalsChange}
                  disabled={isTestRunning}
                />
                <Input
                  name="oxygenSaturation"
                  type="number"
                  placeholder="Oxygen Saturation (%)"
                  value={preTestVitals.oxygenSaturation}
                  onChange={handlePreTestVitalsChange}
                  disabled={isTestRunning}
                />
              </div>
            </div>

            <div>
              <Label>Post-Test Measures</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  name="heartRate"
                  type="number"
                  placeholder="Heart Rate (bpm)"
                  value={postTestVitals.heartRate}
                  onChange={handlePostTestVitalsChange}
                  disabled={!isTestCompleted}
                />
                <Input
                  name="oxygenSaturation"
                  type="number"
                  placeholder="SpO2 (%)"
                  value={postTestVitals.oxygenSaturation}
                  onChange={handlePostTestVitalsChange}
                  disabled={!isTestCompleted}
                />
                <Input
                  name="rpe"
                  type="number"
                  placeholder="RPE (0-10)"
                  value={postTestVitals.rpe}
                  onChange={handlePostTestVitalsChange}
                  disabled={!isTestCompleted}
                />
                <Input
                  name="breathlessness"
                  type="number"
                  placeholder="Breathlessness (0-10)"
                  value={postTestVitals.breathlessness}
                  onChange={handlePostTestVitalsChange}
                  disabled={!isTestCompleted}
                />
                <Input
                  name="pain"
                  type="number"
                  placeholder="Pain (0-10)"
                  value={postTestVitals.pain}
                  onChange={handlePostTestVitalsChange}
                  disabled={!isTestCompleted}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any additional notes here..."
              />
            </div>

            <div className="bg-slate-100 rounded-lg p-6 text-center space-y-4">
              <div className="flex justify-around items-center">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Time Remaining</p>
                  <p className="text-5xl font-bold text-blue-600">{timeLeft}s</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Repetitions</p>
                  <p className="text-5xl font-bold text-green-600">{repetitions}</p>
                </div>
              </div>

              {isTestRunning && (
                <Button
                  onClick={handleRepetition}
                  size="lg"
                  className="w-full text-xl py-8 bg-green-600 hover:bg-green-700"
                >
                  Count Repetition (+1)
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-base px-3 py-1">
                {isTestRunning ? `Test Running` : isTestCompleted ? `Test Completed` : `Ready to Start`}
              </Badge>
              <div className="flex items-center space-x-2">
                {isTestRunning && (
                  <Button variant="destructive" onClick={handleStopTest}>
                    Stop Test
                  </Button>
                )}
                {!isTestRunning && !isTestCompleted && (
                  <Button onClick={handleStartTest} size="lg">
                    <Play className="mr-2" />
                    Start Test
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4">
              <Button onClick={handleSave} className="w-full">
                <Save className="mr-2" />
                Save Assessment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}