import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function MetabolicEquivalentMETCalculationRunner({ client, onSave, onClose }) {
  const [preTestVitals, setPreTestVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [postTestVitals, setPostTestVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [exerciseData, setExerciseData] = useState({ speed: "", grade: "", workload: "" });
  const [resultValue, setResultValue] = useState(null);
  const [additionalData, setAdditionalData] = useState({});
  const [notes, setNotes] = useState("");

  const handlePreTestVitalsChange = (e) => {
    const { name, value } = e.target;
    setPreTestVitals((prev) => ({ ...prev, [name]: value }));
  };

  const handlePostTestVitalsChange = (e) => {
    const { name, value } = e.target;
    setPostTestVitals((prev) => ({ ...prev, [name]: value }));
  };

  const handleExerciseDataChange = (e) => {
    const { name, value } = e.target;
    setExerciseData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNotesChange = (e) => {
    setNotes(e.target.value);
  };

  const calculateMETs = () => {
    const { speed, grade, workload } = exerciseData;
    let vo2;

    if (speed && grade) {
      const speedInMps = parseFloat(speed) * 0.44704;
      const gradeDecimal = parseFloat(grade) / 100;
      vo2 = (0.2 * speedInMps) + (0.9 * speedInMps * gradeDecimal) + 3.5;
    } else if (workload) {
      const workloadInWatts = parseFloat(workload);
      vo2 = (workloadInWatts * 6.12) + 3.5;
    } else {
      toast.error("Please enter either treadmill data (speed and grade) or cycle ergometer data (workload).");
      return;
    }

    const mets = vo2 / 3.5;
    setResultValue(mets);
    setAdditionalData({ vo2, mets });
    toast.success("METs calculated successfully.");
  };

  const handleSave = () => {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Metabolic Equivalent (MET) Calculation</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Pre-Test Vitals</Label>
              <div className="space-y-2">
                <Input
                  type="text"
                  name="heartRate"
                  placeholder="Heart Rate (bpm)"
                  value={preTestVitals.heartRate}
                  onChange={handlePreTestVitalsChange}
                />
                <Input
                  type="text"
                  name="bloodPressure"
                  placeholder="Blood Pressure (mmHg)"
                  value={preTestVitals.bloodPressure}
                  onChange={handlePreTestVitalsChange}
                />
              </div>
            </div>
            <div>
              <Label>Post-Test Vitals</Label>
              <div className="space-y-2">
                <Input
                  type="text"
                  name="heartRate"
                  placeholder="Heart Rate (bpm)"
                  value={postTestVitals.heartRate}
                  onChange={handlePostTestVitalsChange}
                />
                <Input
                  type="text"
                  name="bloodPressure"
                  placeholder="Blood Pressure (mmHg)"
                  value={postTestVitals.bloodPressure}
                  onChange={handlePostTestVitalsChange}
                />
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Label>Exercise Data</Label>
              <div className="space-y-2">
                <Input
                  type="number"
                  name="speed"
                  placeholder="Treadmill Speed (mph)"
                  value={exerciseData.speed}
                  onChange={handleExerciseDataChange}
                />
                <Input
                  type="number"
                  name="grade"
                  placeholder="Treadmill Grade (%)"
                  value={exerciseData.grade}
                  onChange={handleExerciseDataChange}
                />
                <Input
                  type="number"
                  name="workload"
                  placeholder="Cycle Ergometer Workload (Watts)"
                  value={exerciseData.workload}
                  onChange={handleExerciseDataChange}
                />
              </div>
            </div>
            <Button onClick={calculateMETs} className="w-full">
              Calculate METs
            </Button>
            {resultValue && (
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">Result: {resultValue.toFixed(2)} METs</span>
                <Badge variant="outline" className="text-sm">
                  {resultValue < 5 ? "Low" : resultValue <= 10 ? "Moderate" : "High"} Capacity
                </Badge>
              </div>
            )}
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={handleNotesChange} placeholder="Enter any additional notes here." />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onClose} className="flex items-center space-x-2">
          <X size={16} />
          <span>Close</span>
        </Button>
        <Button onClick={handleSave} className="flex items-center space-x-2">
          <Save size={16} />
          <span>Save Assessment</span>
        </Button>
      </div>
      </div>
    </div>
  );
}