import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function Rockport1MileWalkTestRunner({ client, onSave, onClose }) {
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState(null);
  const [time, setTime] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [notes, setNotes] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const handleStart = () => {
    if (!weight || !age || gender === null) {
      toast.error("Please fill in all fields before starting the test.");
      return;
    }
    setIsRunning(true);
    toast.success("Test started. Walk 1 mile as fast as possible.");
  };

  const handleStop = () => {
    if (!time || !heartRate) {
      toast.error("Please record time and heart rate after completing the walk.");
      return;
    }
    setIsRunning(false);
    toast.success("Test stopped. Calculating results.");
    calculateVO2Max();
  };

  const calculateVO2Max = () => {
    const weightInPounds = parseFloat(weight);
    const ageInYears = parseInt(age, 10);
    const genderValue = gender === "male" ? 1 : 0;
    const timeInMinutes = parseFloat(time);
    const heartRateInBPM = parseInt(heartRate, 10);

    const vo2Max =
      132.853 -
      0.0769 * weightInPounds -
      0.3877 * ageInYears +
      6.315 * genderValue -
      3.2649 * timeInMinutes -
      0.1565 * heartRateInBPM;

    const resultValue = vo2Max.toFixed(2);

    const additionalData = {
      weight: weightInPounds,
      age: ageInYears,
      gender: genderValue,
      time: timeInMinutes,
      heartRate: heartRateInBPM,
    };

    onSave({
      status: "completed",
      result_value: resultValue,
      additional_data: additionalData,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
        <CardHeader>
          <CardTitle>Rockport 1-Mile Walk Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <Label htmlFor="weight">Weight (lbs)</Label>
              <Input
                id="weight"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                disabled={isRunning}
                className="w-24"
              />
            </div>
            <div className="flex items-center space-x-4">
              <Label htmlFor="age">Age (years)</Label>
              <Input
                id="age"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                disabled={isRunning}
                className="w-24"
              />
            </div>
            <div className="flex items-center space-x-4">
              <Label>Gender</Label>
              <Button
                variant={gender === "male" ? "default" : "outline"}
                onClick={() => setGender("male")}
                disabled={isRunning}
              >
                Male
              </Button>
              <Button
                variant={gender === "female" ? "default" : "outline"}
                onClick={() => setGender("female")}
                disabled={isRunning}
              >
                Female
              </Button>
            </div>
            <div className="flex items-center space-x-4">
              <Label htmlFor="time">Time (min:sec)</Label>
              <Input
                id="time"
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={isRunning}
                className="w-24"
              />
            </div>
            <div className="flex items-center space-x-4">
              <Label htmlFor="heartRate">Heart Rate (bpm)</Label>
              <Input
                id="heartRate"
                type="number"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                disabled={isRunning}
                className="w-24"
              />
            </div>
            <div className="flex items-center space-x-4">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isRunning}
                rows={3}
              />
            </div>
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isRunning}
                className="flex items-center space-x-2"
              >
                <X size={16} />
                <span>Close</span>
              </Button>
              <div className="space-x-4">
                <Button
                  variant="outline"
                  onClick={handleStart}
                  disabled={isRunning}
                  className="flex items-center space-x-2"
                >
                  <Play size={16} />
                  <span>Start Test</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleStop}
                  disabled={!isRunning}
                  className="flex items-center space-x-2"
                >
                  <AlertTriangle size={16} />
                  <span>Stop Test</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}