import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, Square, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const VO2_CATEGORIES = {
  male: [
    { age: "13–19", poor: [0, 35.4], fair: [35.5, 38.3], good: [38.4, 45.1], excellent: [45.2, 50.9], superior: [51, 999] },
    { age: "20–29", poor: [0, 33.0], fair: [33.1, 36.4], good: [36.5, 42.4], excellent: [42.5, 46.4], superior: [46.5, 999] },
    { age: "30–39", poor: [0, 31.5], fair: [31.6, 35.4], good: [35.5, 40.9], excellent: [41.0, 44.9], superior: [45, 999] },
    { age: "40–49", poor: [0, 30.2], fair: [30.3, 33.5], good: [33.6, 38.9], excellent: [39.0, 43.7], superior: [43.8, 999] },
    { age: "50–59", poor: [0, 26.1], fair: [26.2, 30.9], good: [31.0, 35.7], excellent: [35.8, 40.9], superior: [41, 999] },
    { age: "60+",   poor: [0, 20.5], fair: [20.6, 26.0], good: [26.1, 32.2], excellent: [32.3, 36.4], superior: [36.5, 999] },
  ],
  female: [
    { age: "13–19", poor: [0, 25.0], fair: [25.1, 30.9], good: [31.0, 34.9], excellent: [35.0, 38.9], superior: [39, 999] },
    { age: "20–29", poor: [0, 23.6], fair: [23.7, 28.9], good: [29.0, 32.9], excellent: [33.0, 36.9], superior: [37, 999] },
    { age: "30–39", poor: [0, 22.8], fair: [22.9, 26.9], good: [27.0, 31.4], excellent: [31.5, 35.6], superior: [35.7, 999] },
    { age: "40–49", poor: [0, 21.0], fair: [21.1, 24.4], good: [24.5, 28.9], excellent: [29.0, 32.8], superior: [32.9, 999] },
    { age: "50–59", poor: [0, 20.2], fair: [20.3, 22.7], good: [22.8, 26.9], excellent: [27.0, 31.4], superior: [31.5, 999] },
    { age: "60+",   poor: [0, 17.5], fair: [17.6, 20.1], good: [20.2, 24.4], excellent: [24.5, 30.2], superior: [30.3, 999] },
  ],
};

function getVO2Category(vo2, gender, age) {
  const table = VO2_CATEGORIES[gender] || VO2_CATEGORIES.male;
  let row = table[table.length - 1]; // default to 60+
  if (age < 20) row = table[0];
  else if (age < 30) row = table[1];
  else if (age < 40) row = table[2];
  else if (age < 50) row = table[3];
  else if (age < 60) row = table[4];
  if (vo2 >= row.superior[0]) return { label: "Superior", color: "text-purple-700", bg: "bg-purple-100" };
  if (vo2 >= row.excellent[0]) return { label: "Excellent", color: "text-green-700", bg: "bg-green-100" };
  if (vo2 >= row.good[0]) return { label: "Good", color: "text-blue-700", bg: "bg-blue-100" };
  if (vo2 >= row.fair[0]) return { label: "Fair", color: "text-yellow-700", bg: "bg-yellow-100" };
  return { label: "Poor", color: "text-red-700", bg: "bg-red-100" };
}

export default function TwelveMinuteWalkRunTestCooperRunner({ client, onSave, onClose }) {
  const [distance, setDistance] = useState("");
  const [notes, setNotes] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(720);
  const [assessmentDate, setAssessmentDate] = useState(todayLocal());
  const timerRef = useRef(null);

  const clientAge = client?.date_of_birth
    ? Math.floor((new Date() - new Date(client.date_of_birth)) / (365.25 * 24 * 3600 * 1000))
    : 30;
  const clientGender = (client?.gender === "female" || client?.gender === "other") ? "female" : "male";

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsRunning(false);
            toast.success("12 minutes completed! Record the distance covered.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  const handleStart = () => {
    setTimeLeft(720);
    setIsRunning(true);
    toast.info("Timer started. Client begins walking/running now.");
  };

  const handleStop = () => {
    setIsRunning(false);
    toast.info("Timer stopped early.");
  };

  const handleSave = () => {
    if (!distance) {
      toast.error("Please enter the distance covered.");
      return;
    }
    const distanceInMeters = parseFloat(distance);
    if (isNaN(distanceInMeters) || distanceInMeters <= 0) {
      toast.error("Please enter a valid distance.");
      return;
    }
    const vo2Max = (distanceInMeters - 504.9) / 44.73;
    const category = getVO2Category(vo2Max, clientGender, clientAge);

    const soapText = `• 12-Minute Walk/Run Test (Cooper)\n  Distance: ${distanceInMeters} m\n  Estimated VO2max: ${vo2Max.toFixed(1)} ml/kg/min\n  Fitness Category: ${category.label} (${clientGender}, age ${clientAge})`;

    onSave({
      status: "completed",
      result_value: parseFloat(vo2Max.toFixed(1)),
      additional_data: {
        soap_text: soapText,
        measurement_type: "12_minute_walk_run_test",
        distance_covered_m: distanceInMeters,
        vo2_max: parseFloat(vo2Max.toFixed(1)),
        fitness_category: category.label,
        client_age_at_test: clientAge,
        client_gender: clientGender,
      },
      notes,
      assessment_date: assessmentDate,
    });
    toast.success("Test results saved.");
  };

  const vo2Preview = distance && !isNaN(parseFloat(distance)) && parseFloat(distance) > 0
    ? ((parseFloat(distance) - 504.9) / 44.73)
    : null;
  const categoryPreview = vo2Preview !== null ? getVO2Category(vo2Preview, clientGender, clientAge) : null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = String(timeLeft % 60).padStart(2, "0");
  const progressPct = ((720 - timeLeft) / 720) * 100;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-4xl w-full my-4 space-y-4">

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-blue-600" />12-Minute Walk/Run Test (Cooper) — Clinician Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="font-semibold text-blue-900">Purpose</p>
              <p>Estimates aerobic capacity (VO2max) from the maximal distance covered in 12 minutes. Developed by Dr. Kenneth Cooper (1968). Simple, low-cost field test suitable for ambulatory adults.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-slate-50 border rounded-lg p-3">
                <p className="font-semibold mb-1">Equipment</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>Measured track or course (e.g. 400 m athletics track)</li>
                  <li>Stopwatch or this built-in timer</li>
                  <li>Measuring tape / distance markers</li>
                  <li>Heart rate monitor (optional)</li>
                </ul>
              </div>
              <div className="bg-slate-50 border rounded-lg p-3">
                <p className="font-semibold mb-1">Client Preparation</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>No strenuous exercise 24 h prior</li>
                  <li>Appropriate footwear and clothing</li>
                  <li>5-min warm-up walk/jog</li>
                  <li>Well hydrated; not fasted</li>
                </ul>
              </div>
            </div>
            <div className="bg-slate-50 border rounded-lg p-3">
              <p className="font-semibold mb-2">Procedure</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-600">
                <li>Explain the test: client covers as much distance as possible in exactly 12 minutes by walking, jogging, or running</li>
                <li>Pace client to avoid early burnout — encourage steady effort throughout</li>
                <li>At the end of 12 minutes, mark the exact point reached</li>
                <li>Measure total distance from start to marked point (in metres)</li>
                <li>Enter distance below — VO2max is estimated automatically using the Cooper formula</li>
              </ol>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-amber-800"><strong>Contraindications:</strong> Do not administer to clients with uncontrolled cardiovascular disease, acute illness, injury preventing walking/running, or those identified as high-risk on APSS without medical clearance.</p>
            </div>
            <div className="bg-slate-50 border rounded-lg p-3">
              <p className="font-semibold mb-2">VO2max Formula</p>
              <p className="font-mono text-blue-800 bg-white border rounded px-3 py-2">VO2max (ml/kg/min) = (Distance in metres − 504.9) ÷ 44.73</p>
              <p className="text-xs text-slate-500 mt-1">Cooper, K.H. (1968). A means of assessing maximal oxygen intake. JAMA, 203(3), 201–204.</p>
            </div>
          </CardContent>
        </Card>

        {/* Timer */}
        <Card>
          <CardHeader>
            <CardTitle>Test Timer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Assessment Date</Label>
              <Input type="date" value={assessmentDate} onChange={e => setAssessmentDate(e.target.value)} className="max-w-xs" />
            </div>

            <div className="flex flex-col items-center gap-4 p-6 bg-slate-50 rounded-lg border">
              <div className={`text-6xl font-bold tabular-nums ${timeLeft <= 60 && isRunning ? "text-red-600 animate-pulse" : "text-slate-800"}`}>
                {minutes}:{seconds}
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-1000"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex gap-3">
                {!isRunning ? (
                  <Button onClick={handleStart} className="bg-green-600 hover:bg-green-700 px-8">
                    <Play className="h-5 w-5 mr-2" />Start Timer
                  </Button>
                ) : (
                  <Button onClick={handleStop} variant="destructive" className="px-8">
                    <Square className="h-5 w-5 mr-2" />Stop Timer
                  </Button>
                )}
                {!isRunning && timeLeft < 720 && (
                  <Button variant="outline" onClick={() => setTimeLeft(720)}>Reset</Button>
                )}
              </div>
              {isRunning && timeLeft <= 60 && (
                <Badge className="bg-red-600 text-white text-sm">Final minute — call out to client!</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results Entry */}
        <Card>
          <CardHeader>
            <CardTitle>Results Entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="distance">Total Distance Covered (metres)</Label>
              <Input
                id="distance"
                type="number"
                value={distance}
                onChange={e => setDistance(e.target.value)}
                placeholder="e.g. 1850"
                className="max-w-xs mt-1"
              />
            </div>

            {vo2Preview !== null && categoryPreview && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-600">Distance</p>
                  <p className="text-3xl font-bold text-blue-700">{parseFloat(distance).toLocaleString()} m</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-600">Estimated VO2max</p>
                  <p className="text-3xl font-bold text-purple-700">{vo2Preview.toFixed(1)}</p>
                  <p className="text-xs text-slate-500">ml/kg/min</p>
                </div>
                <div className={`${categoryPreview.bg} border rounded-lg p-4 text-center`}>
                  <p className="text-sm text-slate-600">Fitness Category</p>
                  <p className={`text-2xl font-bold ${categoryPreview.color}`}>{categoryPreview.label}</p>
                  <p className="text-xs text-slate-500">{clientGender}, age {clientAge}</p>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="notes">Clinical Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. client's perceived exertion, pacing notes, stopping points..."
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={onClose}><X className="h-5 w-5 mr-2" />Close</Button>
              <Button onClick={handleSave} disabled={!distance} className="bg-blue-600 hover:bg-blue-700">
                <Save className="h-5 w-5 mr-2" />Save Results
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}