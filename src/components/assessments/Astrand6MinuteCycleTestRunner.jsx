import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function Astrand6MinuteCycleTestRunner({ client, onSave, onClose }) {
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [workload, setWorkload] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [notes, setNotes] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [timer, setTimer] = useState(0);
  const [intervalId, setIntervalId] = useState(null);

  useEffect(() => {
    if (isTesting) {
      const id = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
      setIntervalId(id);
    } else {
      clearInterval(intervalId);
      setTimer(0);
    }
    return () => clearInterval(intervalId);
  }, [isTesting]);

  const handleStartTest = () => {
    if (!age || !gender || !workload) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setIsTesting(true);
    toast.success("Test started. Maintain a steady pace.");
  };

  const handleStopTest = () => {
    setIsTesting(false);
    toast.success("Test stopped.");
  };

  const handleSaveTest = () => {
    if (!heartRate) {
      toast.error("Please record the heart rate during the test.");
      return;
    }
    const resultValue = calculateVO2Max();
    const additionalData = {
      measurement_type: "astrand_cycle_test",
      heart_rate: heartRate,
      workload: workload,
    };
    onSave({
      status: "completed",
      result_value: resultValue,
      additional_data: additionalData,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Test saved successfully.");
  };

  const calculateVO2Max = () => {
    const avgHeartRate = heartRate.reduce((a, b) => a + b, 0) / heartRate.length;
    const vo2Max = (workload * 1.8) / (avgHeartRate - 60) + 7;
    const ageCorrectionFactor = getAgeCorrectionFactor();
    return vo2Max * ageCorrectionFactor;
  };

  const getAgeCorrectionFactor = () => {
    const ageCorrectionFactors = {
      male: {
        20: 1.00,
        25: 0.98,
        30: 0.96,
        35: 0.94,
        40: 0.92,
        45: 0.90,
        50: 0.88,
        55: 0.86,
        60: 0.84,
        65: 0.82,
        70: 0.80,
        75: 0.78,
        80: 0.76,
      },
      female: {
        20: 1.00,
        25: 0.98,
        30: 0.96,
        35: 0.94,
        40: 0.92,
        45: 0.90,
        50: 0.88,
        55: 0.86,
        60: 0.84,
        65: 0.82,
        70: 0.80,
        75: 0.78,
        80: 0.76,
      },
    };
    return ageCorrectionFactors[gender][age] || 1.00;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        {/* Reference */}
        <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1 mb-4">
          <p className="font-semibold">ðŸ“– Reference</p>
          <p>Ã…strand PO & Rhyming I. (1954). A nomogram for calculation of aerobic capacity from pulse rate during submaximal work. <em>Journal of Applied Physiology, 7</em>(2), 218â€“221.</p>
        </div>

        {/* Clinician Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 space-y-1 mb-4">
          <p className="font-semibold">ðŸ“‹ Administration Instructions</p>
          <p><strong>Setup:</strong> Calibrated cycle ergometer. Cadence: <strong>50 rpm</strong>. Select workload to target HR 125â€“170 bpm by min 2â€“3 (typically 50â€“100W women; 100â€“150W men).</p>
          <p><strong>Protocol:</strong> Warm-up 2 min, then 6 min at constant workload. Record HR each minute. Steady state = HR difference min 5â€“6 â‰¤5 bpm. Extend to min 7â€“8 if not achieved.</p>
          <p className="italic">"Pedal steadily at a comfortable pace matching the metronome. Tell me immediately if you feel chest pain or dizziness."</p>
        </div>

        {/* Norms */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2 mb-4">
          <p className="font-semibold text-slate-700">ðŸ“Š VO2max Norms (ml/kg/min) â€” ACSM Classification</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-300 rounded">
              <thead className="bg-slate-200"><tr><th className="p-2 text-left">Category</th><th className="p-2 text-center">Men 20â€“39</th><th className="p-2 text-center">Men 40â€“59</th><th className="p-2 text-center">Women 20â€“39</th><th className="p-2 text-center">Women 40â€“59</th></tr></thead>
              <tbody>
                <tr className="border-t"><td className="p-2">Excellent</td><td className="p-2 text-center">â‰¥52</td><td className="p-2 text-center">â‰¥45</td><td className="p-2 text-center">â‰¥41</td><td className="p-2 text-center">â‰¥35</td></tr>
                <tr className="border-t bg-white"><td className="p-2">Good</td><td className="p-2 text-center">43â€“51</td><td className="p-2 text-center">38â€“44</td><td className="p-2 text-center">35â€“40</td><td className="p-2 text-center">29â€“34</td></tr>
                <tr className="border-t"><td className="p-2">Fair</td><td className="p-2 text-center">34â€“42</td><td className="p-2 text-center">30â€“37</td><td className="p-2 text-center">27â€“34</td><td className="p-2 text-center">23â€“28</td></tr>
                <tr className="border-t bg-white"><td className="p-2">Poor</td><td className="p-2 text-center">â‰¤33</td><td className="p-2 text-center">â‰¤29</td><td className="p-2 text-center">â‰¤26</td><td className="p-2 text-center">â‰¤22</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <Card>
        <CardHeader>
          <CardTitle>Astrand 6-Minute Cycle Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <Label htmlFor="workload">Workload (W)</Label>
              <Input
                id="workload"
                type="number"
                value={workload}
                onChange={(e) => setWorkload(e.target.value)}
                placeholder="Enter workload in watts"
              />
            </div>
            <div>
              <Label htmlFor="heartRate">Heart Rate (bpm)</Label>
              <Input
                id="heartRate"
                type="number"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                placeholder="Enter heart rate during test"
              />
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any additional notes"
            />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Button
          variant="outline"
          color="gray"
          onClick={onClose}
          icon={<X />}
        >
          Close
        </Button>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            color="green"
            onClick={handleStartTest}
            icon={<Play />}
            disabled={isTesting}
          >
            Start Test
          </Button>
          <Button
            variant="outline"
            color="red"
            onClick={handleStopTest}
            icon={<AlertTriangle />}
            disabled={!isTesting}
          >
            Stop Test
          </Button>
          <Button
            variant="outline"
            color="blue"
            onClick={handleSaveTest}
            icon={<Save />}
          >
            Save Test
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}