import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function TwoMinuteWalkTest2MWTRunner({ client, onSave, onClose }) {
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(120);
  const [distanceWalked, setDistanceWalked] = useState("");
  const [preTestHR, setPreTestHR] = useState("");
  const [preTestBP, setPreTestBP] = useState("");
  const [postTestHR, setPostTestHR] = useState("");
  const [postTestBP, setPostTestBP] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let timer;
    if (isTestRunning && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else if (timeRemaining === 0 && isTestRunning) {
      setIsTestRunning(false);
      toast.success("Test completed - 2 minutes reached.");
    }
    return () => clearInterval(timer);
  }, [isTestRunning, timeRemaining]);

  const handleStartTest = () => {
    setIsTestRunning(true);
    setTimeRemaining(120);
    setDistanceWalked("");
    toast.success("Test started. Walking at your own pace.");
  };

  const handleStopTest = () => {
    setIsTestRunning(false);
    toast.info("Test stopped manually.");
  };

  const handleSave = () => {
    if (!distanceWalked || !postTestHR || !postTestBP) {
      toast.error("Please complete distance and post-test vital signs.");
      return;
    }

    const distance = parseFloat(distanceWalked);
    if (isNaN(distance)) {
      toast.error("Distance must be a valid number.");
      return;
    }

    const soapText = `• 2-Minute Walk Test (2MWT)\n  Distance: ${distance}m\n  Pre-Test: HR ${preTestHR} bpm, BP ${preTestBP} mmHg\n  Post-Test: HR ${postTestHR} bpm, BP ${postTestBP} mmHg`;

    onSave({
      status: "completed",
      result_value: distance,
      notes: notes || "",
      assessment_date: new Date().toISOString().split("T")[0],
      additional_data: {
        soap_text: soapText,
        distance_metres: distance,
        pre_test_hr: preTestHR,
        pre_test_bp: preTestBP,
        post_test_hr: postTestHR,
        post_test_bp: postTestBP,
      },
    });

    toast.success("Assessment saved successfully.");
    onClose();
  };

  const formatTime = () => {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 text-white flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">2-Minute Walk Test (2MWT)</h2>
            <p className="text-blue-100 text-sm mt-1">Functional walking capacity assessment</p>
          </div>
          <button onClick={onClose} className="text-white text-2xl leading-none">×</button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
            <p className="font-semibold mb-2">📋 Administration</p>
            <p className="text-xs">Client walks as far as possible in 2 minutes along a 30m course. Document pre/post vitals and distance. Assistive devices permitted but documented.</p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700">
            <p className="font-semibold mb-2">Reference Values</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Healthy older: 142–175m</div>
              <div>Stroke: 56–126m</div>
              <div>Parkinson's: 80–120m</div>
              <div>MCID: ~12m</div>
            </div>
          </div>

          {/* Pre-Test Vitals */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="font-semibold text-sm">Pre-Test Vital Signs</Label>
              <Badge variant="outline" className="text-xs">Before Test</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600">Heart Rate (bpm)</Label>
                <Input type="number" value={preTestHR} onChange={(e) => setPreTestHR(e.target.value)} placeholder="e.g., 72" />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Blood Pressure (mmHg)</Label>
                <Input type="text" value={preTestBP} onChange={(e) => setPreTestBP(e.target.value)} placeholder="e.g., 120/80" />
              </div>
            </div>
          </div>

          {/* Test Status */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-lg p-5 text-center text-white space-y-3">
            <div className="text-sm text-slate-300">Test Status</div>
            <div className="text-5xl font-mono font-bold tracking-wider">
              {formatTime()}
            </div>
            <div className="flex justify-center gap-2">
              <Badge variant={isTestRunning ? "default" : "secondary"} className={isTestRunning ? "bg-green-600" : ""}>
                {isTestRunning ? "🟢 Running" : "â¸ Stopped"}
              </Badge>
            </div>
          </div>

          {/* Distance */}
          <div className="space-y-2">
            <Label className="font-semibold text-sm">Distance Walked (meters)</Label>
            <Input type="number" value={distanceWalked} onChange={(e) => setDistanceWalked(e.target.value)} placeholder="e.g., 156" />
          </div>

          {/* Post-Test Vitals */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="font-semibold text-sm">Post-Test Vital Signs</Label>
              <Badge variant="outline" className="text-xs">After Test</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600">Heart Rate (bpm)</Label>
                <Input type="number" value={postTestHR} onChange={(e) => setPostTestHR(e.target.value)} placeholder="e.g., 92" />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Blood Pressure (mmHg)</Label>
                <Input type="text" value={postTestBP} onChange={(e) => setPostTestBP(e.target.value)} placeholder="e.g., 130/85" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="font-semibold text-sm">Clinical Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any observations during test..." rows={3} />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 p-4 flex justify-between gap-3">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />Close
          </Button>
          <div className="flex gap-2">
            {isTestRunning ? (
              <Button onClick={handleStopTest} variant="destructive">
                <AlertTriangle className="w-4 h-4 mr-2" />Stop Test
              </Button>
            ) : (
              <Button onClick={handleStartTest} className="bg-blue-600 hover:bg-blue-700">
                <Play className="w-4 h-4 mr-2" />Start Test
              </Button>
            )}
            <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-2" />Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}