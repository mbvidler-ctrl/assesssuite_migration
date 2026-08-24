import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";
import { validateAndScore as validateMobilityOrtho } from "@/lib/clinical/scorers/extrasMobilityBalanceOrtho";

export default function SingleLegStanceTestRunner({ client, onSave, onClose }) {
  const [isTiming, setIsTiming] = useState(false);
  const [currentLeg, setCurrentLeg] = useState("left");
  const [trials, setTrials] = useState({ left: [], right: [] });
  const [notes, setNotes] = useState("");
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (isTiming) {
      const interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isTiming]);

  const handleStartStop = () => {
    if (isTiming) {
      setTrials((prev) => ({
        ...prev,
        [currentLeg]: [...prev[currentLeg], timer],
      }));
      toast.success(`${currentLeg} leg trial: ${timer}s`);
      setTimer(0);
    }
    setIsTiming(!isTiming);
  };

  const handleSwitchLeg = () => {
    setCurrentLeg((prev) => (prev === "left" ? "right" : "left"));
    setTimer(0);
    setIsTiming(false);
  };

  const handleSave = () => {
    try {
      onSave(validateMobilityOrtho({ leftTrials: trials.left, rightTrials: trials.right, notes }, { runnerKey: 'single_leg_stance_test', assessmentDate: todayLocal() }));
      toast.success("Assessment saved.");
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Single-Leg Stance Test</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Current Leg</Label>
                <Badge>{currentLeg === "left" ? "Left" : "Right"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <Label>Timer</Label>
                <div className="text-2xl font-bold">{timer}s</div>
              </div>
              <div>
                <Label>Trials</Label>
                <div className="space-y-1 text-sm text-slate-700 mt-1">
                  <div>Left: {trials.left.join(", ") || "None"}</div>
                  <div>Right: {trials.right.join(", ") || "None"}</div>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter notes"
                  className="mt-1"
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleStartStop} className="flex-1">
                  {isTiming ? "Stop" : "Start"}
                </Button>
                <Button onClick={handleSwitchLeg} variant="outline">
                  Switch Leg
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2 w-4 h-4" />
            Close
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-2 w-4 h-4" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
