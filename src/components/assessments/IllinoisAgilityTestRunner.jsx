import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, Info, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function IllinoisAgilityTestRunner({ client, onSave, onClose }) {
  const [trialTimes, setTrialTimes] = useState([]);
  const [notes, setNotes] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => setTimer((prev) => prev + 0.1), 100);
      return () => clearInterval(interval);
    }
  }, [isRunning]);

  const handleStartStop = () => {
    if (isRunning) {
      setTrialTimes((prev) => [...prev, parseFloat(timer.toFixed(1))]);
      toast.success(`Trial recorded: ${timer.toFixed(1)}s`);
    }
    setIsRunning((prev) => !prev);
    setTimer(0);
  };

  const handleSave = () => {
    if (trialTimes.length === 0) {
      toast.error("Please complete at least one trial.");
      return;
    }

    const bestTime = Math.min(...trialTimes);
    const soapText = `â€¢ Illinois Agility Test:\n  Best Time: ${bestTime}s\n  All Trials: ${trialTimes.join('s, ')}s${notes.trim() ? `\n  Clinical Notes: ${notes}` : ''}`;

    onSave({
      status: "completed",
      result_value: bestTime,
      additional_data: {
        measurement_type: "illinois_agility_test",
        trials: trialTimes,
        best_time: bestTime,
        soap_text: soapText
      },
      notes: soapText,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Assessment recorded â€” please confirm and save.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="text-2xl">Illinois Agility Test</CardTitle>
            <p className="text-sm text-gray-600 mt-2">Measure change-of-direction speed and agility</p>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Instructions */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Setup & Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <div>
                  <p className="font-semibold text-blue-900">Test Setup:</p>
                  <ul className="list-disc list-inside text-blue-800 mt-1 space-y-1">
                    <li>Mark an area 10m long Ã— 5m wide</li>
                    <li>Place 4 cones: start line, 10m mark, 5m left, 5m right</li>
                    <li>Mark the 5m line perpendicular to the start/end line</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-blue-900">Procedure:</p>
                  <ol className="list-decimal list-inside text-blue-800 mt-1 space-y-1">
                    <li>Client starts at the start line, straddling the timing gate</li>
                    <li>Sprint forward 10 meters to the far baseline</li>
                    <li>Plant and backpedal to the 5-meter line</li>
                    <li>Plant and side-shuffle left to the cone</li>
                    <li>Plant and side-shuffle right, crossing the center line</li>
                    <li>Plant and sprint forward, crossing the start line</li>
                    <li>Stop timer at the start line</li>
                  </ol>
                </div>
                <div>
                  <p className="font-semibold text-blue-900">Scoring:</p>
                  <p className="text-blue-800 mt-1">Record the best time of at least 2 trials. Rest 1â€“2 minutes between trials.</p>
                </div>
              </CardContent>
            </Card>

            {/* Equipment */}
            <Card className="bg-amber-50 border-amber-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  Equipment Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside text-sm text-amber-800 space-y-1">
                  <li>Stopwatch or electronic timing system</li>
                  <li>4 cones or markers</li>
                  <li>Measuring tape (10m Ã— 5m area)</li>
                  <li>Smooth, flat surface (gym floor recommended)</li>
                  <li>Appropriate non-slip footwear</li>
                </ul>
              </CardContent>
            </Card>

            {/* Timer */}
            <div>
              <Label className="text-lg font-semibold">Timer</Label>
              <div className="text-5xl font-bold text-blue-600 my-4">{timer.toFixed(1)}s</div>
            </div>

            {/* Trial Times */}
            <div>
              <Label className="text-lg font-semibold mb-2 block">Trial Times</Label>
              {trialTimes.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {trialTimes.map((time, index) => (
                    <Badge key={index} variant="outline" className="py-2 text-center">
                      Trial {index + 1}: <span className="font-bold ml-1">{time}s</span>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No trials recorded yet</p>
              )}
            </div>

            <Button
              variant={isRunning ? "destructive" : "default"}
              onClick={handleStartStop}
              className="w-full h-12 text-lg"
            >
              {isRunning ? <><X className="mr-2" />Stop Trial</> : <><Play className="mr-2" />Start Trial</>}
            </Button>

            {/* Notes */}
            <div>
              <Label htmlFor="notes" className="text-lg font-semibold">Clinical Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observations: client effort, technique, balance issues, fatigue, etc."
                className="mt-2"
              />
            </div>

            {/* References */}
            <Card className="bg-gray-50 border-gray-200">
              <CardHeader>
                <CardTitle className="text-sm">Normative Data & References</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-gray-700 space-y-2">
                <p><strong>Normative Values (elite athletes):</strong> &lt;15.1 seconds</p>
                <p><strong>References:</strong></p>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>Semenick D. (1990). The T-test. NSCA Journal, 12(1), 36-37.</li>
                  <li>Kinetic SELECT. Illinois Agility Test. Retrieved from standardized testing database.</li>
                </ul>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2" />Close
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-2" />Save
          </Button>
        </div>
      </div>
    </div>
  );
}