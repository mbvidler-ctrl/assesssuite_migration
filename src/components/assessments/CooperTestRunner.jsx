import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info, Play, Pause, StopCircle } from "lucide-react";
import { toast } from "sonner";

export default function CooperTestRunner({ onSave, onClose }) {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [distance, setDistance] = useState('');
  const [rpe, setRPE] = useState('');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    let interval;
    if (isRunning && time < 720) {
      interval = setInterval(() => {
        setTime(prev => {
          if (prev >= 719) {
            setIsRunning(false);
            toast.success("12 minutes complete!");
            return 720;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, time]);

  const calculateVO2Max = () => {
    if (!distance) return null;
    const metres = parseFloat(distance);
    return ((metres - 504.9) / 44.73).toFixed(1);
  };

  const handleSave = () => {
    if (!distance) {
      toast.error("Please enter distance covered");
      return;
    }

    const soapText = [
      `â€¢ Cooper 12-Minute Run/Walk Test`,
      `  Distance: ${distance} m`,
      calculateVO2Max() ? `  Estimated VO2max: ${calculateVO2Max()} ml/kg/min` : null,
      rpe ? `  RPE: ${rpe}/20` : null,
      notes ? `  Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: parseFloat(distance),
      additional_data: {
        soap_text: soapText,
        distance_metres: parseFloat(distance),
        estimated_vo2max: calculateVO2Max(),
        rpe: rpe ? parseInt(rpe) : null,
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Cooper 12-Minute Run/Walk Test</h2>
              <p className="text-slate-600 mt-1">Maximal aerobic fitness assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Test Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800">
                <p>Cover as much distance as possible in 12 minutes by running, jogging, or walking. Pace yourself to maintain effort for the full duration.</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-6">
                <div className="text-center space-y-4">
                  <div>
                    <p className="text-sm text-slate-600">Time Remaining</p>
                    <p className="text-6xl font-bold text-slate-900">
                      {Math.floor((720 - time) / 60)}:{((720 - time) % 60).toString().padStart(2, '0')}
                    </p>
                  </div>
                  <div className="flex justify-center gap-2">
                    {!isRunning && time < 720 ? (
                      <Button onClick={() => setIsRunning(true)} size="lg" className="bg-blue-600 hover:bg-blue-700">
                        <Play className="w-5 h-5 mr-2" />
                        {time === 0 ? 'Start Test' : 'Resume'}
                      </Button>
                    ) : time < 720 ? (
                      <Button onClick={() => setIsRunning(false)} variant="outline" size="lg">
                        <Pause className="w-5 h-5 mr-2" />
                        Pause
                      </Button>
                    ) : null}
                    {time > 0 && (
                      <Button onClick={() => { setTime(0); setIsRunning(false); }} variant="destructive" size="lg">
                        <StopCircle className="w-5 h-5 mr-2" />
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Distance Covered (metres)</Label>
                  <Input
                    type="number"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    placeholder="e.g., 2400"
                    className="mt-1 text-xl font-bold"
                  />
                </div>

                {distance && (
                  <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                    <p className="text-sm text-blue-700">Estimated VOâ‚‚max</p>
                    <p className="text-3xl font-bold text-blue-900">{calculateVO2Max()} ml/kg/min</p>
                  </div>
                )}

                <div>
                  <Label>RPE (6-20)</Label>
                  <Input
                    type="number"
                    value={rpe}
                    onChange={(e) => setRPE(e.target.value)}
                    placeholder="e.g., 17"
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Pacing strategy, symptoms, environmental conditions..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave}
            disabled={!distance}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}