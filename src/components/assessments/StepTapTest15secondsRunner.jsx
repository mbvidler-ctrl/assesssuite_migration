import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function StepTapTest15secondsRunner({ client, onSave, onClose }) {
  const [isRunning, setIsRunning] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [notes, setNotes] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [isValid, setIsValid] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTapCount((prevCount) => prevCount + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  const handleStartStop = () => {
    if (isRunning) {
      clearInterval(timerRef.current);
      setIsRunning(false);
      toast.success("Test stopped.");
    } else {
      if (!age || !gender) {
        setIsValid(false);
        toast.error("Please enter age and gender.");
        return;
      }
      setIsValid(true);
      setTapCount(0);
      setIsRunning(true);
      toast.success("Test started.");
    }
  };

  const handleSave = () => {
    if (!isValid) {
      toast.error("Please enter valid data.");
      return;
    }
    const result_value = tapCount;
    const additional_data = {
      measurement_type: "step_tap_test",
      age,
      gender,
    };
    onSave({ status: "completed", result_value, additional_data, notes, assessment_date: new Date().toISOString().split("T")[0] });
    toast.success("Data saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Step Tap Test (15 seconds)</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Enter age"
              className="w-full"
            />
            <Label htmlFor="gender">Gender</Label>
            <Input
              id="gender"
              type="text"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              placeholder="Enter gender"
              className="w-full"
            />
            {!isValid && (
              <div className="text-sm text-red-500">
                <AlertTriangle className="inline mr-1" />
                Please enter valid age and gender.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button onClick={handleStartStop} className="flex items-center">
          {isRunning ? <X className="mr-2" /> : <Play className="mr-2" />}
          {isRunning ? "Stop Test" : "Start Test"}
        </Button>
        <div className="text-xl font-semibold">{tapCount} taps</div>
      </div>

      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Enter any additional notes here"
        rows={4}
        className="w-full"
      />

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onClose} className="flex items-center">
          <X className="mr-2" />
          Close
        </Button>
        <Button onClick={handleSave} className="flex items-center">
          <Save className="mr-2" />
          Save
        </Button>
      </div>
      </div>
    </div>
  );
}