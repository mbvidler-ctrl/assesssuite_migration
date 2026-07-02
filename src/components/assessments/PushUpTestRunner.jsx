import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function PushUpTestRunner({ client, onSave, onClose }) {
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [pushUps, setPushUps] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const [isModified, setIsModified] = useState(false);
  const [notes, setNotes] = useState("");
  const [timer, setTimer] = useState(null);

  useEffect(() => {
    if (isTesting) {
      setTimer(setInterval(() => setPushUps((prev) => prev + 1), 1000));
    } else {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [isTesting]);

  const handleStartTest = () => {
    setIsTesting(true);
    toast.success("Test started. Perform as many push-ups as you can.");
  };

  const handleStopTest = () => {
    setIsTesting(false);
    toast.success("Test stopped.");
  };

  const handleSave = () => {
    const resultValue = pushUps;
    const soapText = `â€¢ Push-Up Test\n  Result: ${pushUps} push-ups${isModified ? ' (modified)' : ''}\n  Age: ${age} | Gender: ${gender}${notes ? `\n  Notes: ${notes}` : ''}`;
    onSave({
      status: "completed",
      result_value: resultValue,
      additional_data: {
        soap_text: soapText,
        measurement_type: "push_up_test",
        age,
        gender,
        isModified,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Test results saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Push-Up Test</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
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
            <Label htmlFor="gender">Gender</Label>
            <Input
              id="gender"
              type="text"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              placeholder="Enter gender"
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
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setIsModified((prev) => !prev)}
              className="flex items-center space-x-2"
            >
              <Badge variant={isModified ? "default" : "outline"}>Modified</Badge>
            </Button>
            <Button
              variant="default"
              onClick={isTesting ? handleStopTest : handleStartTest}
              className="flex items-center space-x-2"
            >
              {isTesting ? (
                <>
                  <X className="h-4 w-4" />
                  <span>Stop Test</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span>Start Test</span>
                </>
              )}
            </Button>
          </div>
          <div className="flex justify-between items-center">
            <span>Push-Ups: {pushUps}</span>
            <Button
              variant="default"
              onClick={handleSave}
              className="flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>Save Results</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
      </div>
    </div>
  );
}