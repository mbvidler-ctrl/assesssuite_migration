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

const stages = [
  { stage: 1, speed: 1.7, grade: 10 },
  { stage: 2, speed: 2.5, grade: 12 },
  { stage: 3, speed: 3.4, grade: 14 },
  { stage: 4, speed: 4.2, grade: 16 },
  { stage: 5, speed: 5.0, grade: 18 },
  { stage: 6, speed: 5.5, grade: 20 },
  { stage: 7, speed: 6.0, grade: 22 },
];

export default function BruceTreadmillProtocolRunner({ client, onSave, onClose }) {
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("male");
  const [heartRate, setHeartRate] = useState("");
  const [bloodPressure, setBloodPressure] = useState("");
  const [testTime, setTestTime] = useState(0);
  const [stage, setStage] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [timer, setTimer] = useState(null);

  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        setTestTime((prevTime) => prevTime + 1);
      }, 60000);
      setTimer(interval);
    } else {
      clearInterval(timer);
      setTimer(null);
    }
    return () => clearInterval(timer);
  }, [isRunning]);

  const handleStart = () => {
    if (!age || !sex) {
      toast.error("Please enter age and select sex.");
      return;
    }
    setIsRunning(true);
    setStage(1);
    setTestTime(0);
    toast.success("Test started.");
  };

  const handleStop = () => {
    setIsRunning(false);
    toast.success("Test stopped.");
  };

  const handleSave = () => {
    if (!testTime) {
      toast.error("Please complete the test before saving.");
      return;
    }
    const vo2Max = calculateVO2Max(testTime, age, sex);
    const additionalData = {
      measurement_type: "BruceTreadmillProtocol",
      age,
      sex,
      heartRate,
      bloodPressure,
      testTime,
      vo2Max,
    };
    onSave({
      status: "completed",
      result_value: vo2Max,
      additional_data: additionalData,
      notes: "",
      assessment_date: todayLocal(),
    });
    toast.success("Test data saved.");
  };

  const calculateVO2Max = (time, age, sex) => {
    const base = sex === "female" ? 6.47 : 0;
    return 2.94 + 0.65 * time - 0.026 * age + base;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <Card>
        <CardHeader>
          <CardTitle>Bruce Treadmill Protocol</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Enter age"
              />
            </div>
            <div>
              <Label htmlFor="sex">Sex</Label>
              <select
                id="sex"
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <Label>Current Stage</Label>
            <div className="flex items-center space-x-2">
              <Badge>{stages[stage - 1]?.stage}</Badge>
              <span>
                {stages[stage - 1]?.speed} mph / {stages[stage - 1]?.grade}%
              </span>
            </div>
          </div>
          <div className="mt-4">
            <Label>Test Time</Label>
            <div className="flex items-center space-x-2">
              <span>{Math.floor(testTime / 60)}:</span>
              <span>{String(testTime % 60).padStart(2, "0")}</span>
            </div>
          </div>
          <div className="mt-4">
            <Label>Heart Rate</Label>
            <Input
              type="number"
              value={heartRate}
              onChange={(e) => setHeartRate(e.target.value)}
              placeholder="Enter heart rate"
            />
          </div>
          <div className="mt-4">
            <Label>Blood Pressure</Label>
            <Input
              type="text"
              value={bloodPressure}
              onChange={(e) => setBloodPressure(e.target.value)}
              placeholder="Enter blood pressure"
            />
          </div>
        </CardContent>
      </Card>
      <div className="flex space-x-4">
        <Button onClick={handleStart} disabled={isRunning}>
          <Play className="mr-2" />
          Start Test
        </Button>
        <Button onClick={handleStop} disabled={!isRunning}>
          <X className="mr-2" />
          Stop Test
        </Button>
        <Button onClick={handleSave} disabled={!testTime}>
          <Save className="mr-2" />
          Save Data
        </Button>
        <Button onClick={onClose}>
          <AlertTriangle className="mr-2" />
          Close
        </Button>
      </div>
      </div>
    </div>
  );
}