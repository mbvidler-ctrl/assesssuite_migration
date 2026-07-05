import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function EightFootUpandGoTestRunner({ client, onSave, onClose }) {
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [trial1Time, setTrial1Time] = useState(null);
  const [trial2Time, setTrial2Time] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [timer, setTimer] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        setTimer(Math.floor((Date.now() - startTime) / 1000));
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isRunning, startTime]);

  const handleStart = () => {
    if (!age || !gender) {
      toast.error("Please enter age and gender.");
      return;
    }
    setIsRunning(true);
    setStartTime(Date.now());
    setTimer(0);
  };

  const handleStop = () => {
    if (!isRunning) return;
    setIsRunning(false);
    const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    if (!trial1Time) {
      setTrial1Time(elapsedTime);
    } else if (!trial2Time) {
      setTrial2Time(elapsedTime);
    } else {
      setTrial1Time(elapsedTime);
      setTrial2Time(null);
    }
    setStartTime(null);
    setTimer(0);
  };

  const handleSave = () => {
    if (!trial1Time || !trial2Time) {
      toast.error("Please complete both trials.");
      return;
    }
    const bestTime = Math.min(trial1Time, trial2Time);
    const resultValue = bestTime;
    const additionalData = {
      soap_text: `• 8-Foot Up-and-Go Test\n  Time: ${bestTime} s\n`,
      measurement_type: "8-foot-up-and-go",
      age,
      gender,
      trial1Time,
      trial2Time,
      bestTime,
    };
    onSave({
      status: "completed",
      result_value: resultValue,
      additional_data: additionalData,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Clinician Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
          <p className="font-semibold">📋 Administration Instructions (Rikli & Jones Protocol)</p>
          <p><strong>Setup:</strong> Place a chair against a wall and a cone 8 feet (2.44m) in front. Client starts seated, feet flat, hands on thighs. No assistive devices unless documented.</p>
          <p className="italic">"When I say 'Go', stand up, walk around the cone as quickly as possible, and return to sit down. Walk as fast as you safely can."</p>
          <p><strong>Timing:</strong> Start on "Go" and stop when the client is fully seated. Allow one practice trial then 2 timed trials — record best time.</p>
        </div>

        {/* Norms & Interpretation */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
          <p className="font-semibold text-slate-700">📊 Norms & Interpretation</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-300 rounded">
              <thead className="bg-slate-200"><tr><th className="p-2 text-left">Time</th><th className="p-2 text-left">Classification</th><th className="p-2 text-left">Risk</th></tr></thead>
              <tbody>
                <tr className="border-t border-slate-200"><td className="p-2">≤ 8.1 s</td><td className="p-2">Normal</td><td className="p-2 text-green-600">Low fall risk</td></tr>
                <tr className="border-t border-slate-200 bg-white"><td className="p-2">8.2–9.2 s</td><td className="p-2">Borderline</td><td className="p-2 text-yellow-600">Moderate risk</td></tr>
                <tr className="border-t border-slate-200"><td className="p-2">≥ 9.3 s</td><td className="p-2">Below normal</td><td className="p-2 text-red-600">High fall risk</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">For community-dwelling adults 60–94 yrs. MCID: ~0.67 s. Source: Rikli & Jones Senior Fitness Test (2013).</p>
        </div>

        {/* Reference */}
        <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
          <p className="font-semibold">📖 Reference</p>
          <p>Rikli RE & Jones CJ. (1999). Development and validation of a functional fitness test for community-residing older adults. <em>Journal of Aging and Physical Activity, 7</em>(2), 129–161.</p>
          <p>Rikli RE & Jones CJ. (2013). <em>Senior Fitness Test Manual</em> (2nd ed.). Human Kinetics.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>8-Foot Up-and-Go Test</CardTitle>
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
              {isRunning && (
                <div className="text-2xl font-bold text-center text-blue-600">
                  {timer}s
                </div>
              )}
              <div>
                <Label>Trial 1 Time</Label>
                <div className="mt-1">
                  <Badge>{trial1Time ? `${trial1Time}s` : "Not completed"}</Badge>
                </div>
              </div>
              <div>
                <Label>Trial 2 Time</Label>
                <div className="mt-1">
                  <Badge>{trial2Time ? `${trial2Time}s` : "Not completed"}</Badge>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter any additional notes"
                />
              </div>
              <div className="flex space-x-4">
                <Button variant="outline" onClick={onClose} className="flex items-center space-x-2">
                  <X /><span>Close</span>
                </Button>
                <Button variant="outline" onClick={handleSave} className="flex items-center space-x-2">
                  <Save /><span>Save</span>
                </Button>
                <Button variant="outline" onClick={handleStart} disabled={isRunning} className="flex items-center space-x-2">
                  <Play /><span>Start</span>
                </Button>
                <Button variant="outline" onClick={handleStop} disabled={!isRunning} className="flex items-center space-x-2">
                  <AlertTriangle /><span>Stop</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}