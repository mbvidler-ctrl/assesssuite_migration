import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play } from "lucide-react";
import { toast } from "sonner";

const stages = [
  { name: "Feet Together", target: 10 },
  { name: "Semi-Tandem", target: 10 },
  { name: "Tandem", target: 10 },
  { name: "Single Leg", target: 10 },
];

export default function FourStageBalanceTestRunner({ client, onSave, onClose }) {
  const [currentStage, setCurrentStage] = useState(0);
  const [isTiming, setIsTiming] = useState(false);
  const [timeHeld, setTimeHeld] = useState(0);
  const [results, setResults] = useState([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isTiming) {
      const interval = setInterval(() => setTimeHeld((prev) => prev + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [isTiming]);

  const handleStartStop = () => {
    if (isTiming) {
      setResults((prev) => [...prev, { stage: stages[currentStage].name, time: timeHeld }]);
      toast.success(`Stage ${currentStage + 1} completed: ${timeHeld}s`);
      setIsTiming(false);
      setTimeHeld(0);
      if (currentStage < stages.length - 1) {
        setCurrentStage((prev) => prev + 1);
      }
    } else {
      setIsTiming(true);
      setTimeHeld(0);
    }
  };

  const handleSave = () => {
    if (results.length === 0) {
      toast.error("Please complete at least one stage.");
      return;
    }

    const totalTime = results.reduce((sum, r) => sum + r.time, 0);

    // Build comprehensive SOAP text
    let soapText = `• Four-Stage Balance Test: Total Time ${totalTime}s\n`;
    soapText += `  Stage Results:\n`;
    results.forEach((result, idx) => {
      soapText += `    ${idx + 1}. ${result.stage}: ${result.time}s\n`;
    });
    if (notes) soapText += `  Notes: ${notes}\n`;

    onSave({
      status: "completed",
      result_value: totalTime,
      additional_data: {
        soap_text: soapText,
        measurement_type: "Four-Stage Balance",
        stage_results: results,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Assessment saved.");
  };

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Four-Stage Balance Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Current Stage: {stages[currentStage]?.name}</Label>
              <Badge className="ml-2">Stage {currentStage + 1} of {stages.length}</Badge>
            </div>
            <div className="text-3xl font-bold">{timeHeld}s</div>
            <Button onClick={handleStartStop} className="w-full">
              {isTiming ? "Stop" : "Start"}
            </Button>
            {results.length > 0 && (
              <div>
                <Label>Completed Stages</Label>
                {results.map((r, idx) => (
                  <div key={idx}>
                    {r.stage}: {r.time}s
                  </div>
                ))}
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter notes"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onClose}>
          <X className="mr-2" />
          Close
        </Button>
        <Button onClick={handleSave}>
          <Save className="mr-2" />
          Save
        </Button>
      </div>
    </div>
  );
}