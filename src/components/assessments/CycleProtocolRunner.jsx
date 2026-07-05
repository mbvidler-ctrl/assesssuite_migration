import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info, Play, Pause, StopCircle } from "lucide-react";
import { toast } from "sonner";

export default function CycleProtocolRunner({ protocol, onSave, onClose }) {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState('');
  const [workload, setWorkload] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [minuteData, setMinuteData] = useState([]);
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const recordMinute = () => {
    if (!heartRate) {
      toast.error("Please enter heart rate");
      return;
    }

    setMinuteData([...minuteData, {
      minute: Math.floor(time / 60) + 1,
      heartRate: parseInt(heartRate),
      workload: workload ? parseFloat(workload) : null
    }]);
    toast.success("Minute recorded");
  };

  const calculateVO2Max = () => {
    if (protocol === 'YMCA') {
      // YMCA estimation using HR-workload relationship
      if (minuteData.length < 2) return null;
      const lastTwo = minuteData.slice(-2);
      const hr1 = lastTwo[0].heartRate;
      const hr2 = lastTwo[1].heartRate;
      const w1 = lastTwo[0].workload || 50;
      const w2 = lastTwo[1].workload || 75;
      const agePredMax = 220 - parseInt(age || 30);
      const slope = (hr2 - hr1) / (w2 - w1);
      const predictedMaxWatts = w2 + ((agePredMax - hr2) / slope);
      const vo2max = ((predictedMaxWatts * 12) + 300) / parseFloat(weight || 70);
      return vo2max.toFixed(1);
    } else if (protocol === 'Astrand') {
      // Astrand-Ryhming equation
      const avgHR = minuteData.slice(-1)[0]?.heartRate || parseInt(heartRate);
      const watts = parseFloat(workload);
      const genderFactor = gender === 'male' ? 0.93 : 0.86;
      const vo2 = ((watts * 12) / (avgHR - 60)) * genderFactor;
      const ageCorrection = 1 - ((parseInt(age) - 25) * 0.01);
      return (vo2 * ageCorrection).toFixed(1);
    } else if (protocol === 'Wingate') {
      // Wingate calculates peak power, not VO2
      return null;
    }
  };

  const handleSave = () => {
    if (!age || !weight) {
      toast.error("Please enter age and weight");
      return;
    }

    const vo2max = calculateVO2Max();

    const soapText = [
      `• ${info.title}`,
      `  Protocol: ${protocol} | Age: ${age} | Weight: ${weight}kg`,
      vo2max ? `  Estimated VO2max: ${vo2max} ml/kg/min` : null,
      `  Duration: ${Math.floor(time / 60)}:${(time % 60).toString().padStart(2, '0')}`,
      notes ? `  Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: vo2max ? parseFloat(vo2max) : time,
      additional_data: {
        soap_text: soapText,
        protocol,
        age: parseInt(age),
        weight: parseFloat(weight),
        gender,
        total_time_seconds: time,
        minute_data: minuteData,
        final_workload: workload ? parseFloat(workload) : null,
        final_heart_rate: parseInt(heartRate),
        estimated_vo2max: vo2max,
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  const getProtocolInfo = () => {
    if (protocol === 'YMCA') {
      return {
        title: 'YMCA Cycle Ergometer Test',
        description: 'Submaximal test using HR-workload relationship',
        instructions: 'Maintain 50 rpm, record HR at end of each minute, progress workload based on HR response'
      };
    } else if (protocol === 'Astrand') {
      return {
        title: 'Astrand 6-Minute Cycle Test',
        description: '6-minute submaximal test',
        instructions: 'Maintain 50-60 rpm, aim for steady-state HR between 125-170 bpm by 2 minutes'
      };
    } else if (protocol === 'Wingate') {
      return {
        title: 'Wingate Anaerobic Test',
        description: '30-second all-out sprint',
        instructions: 'After warm-up, sprint maximally for 30 seconds against set resistance (0.075 kg/kg body mass)'
      };
    }
  };

  const info = getProtocolInfo();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{info.title}</h2>
              <p className="text-slate-600 mt-1">{info.description}</p>
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
                  Protocol Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800">
                <p>{info.instructions}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Participant Information</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>Age (years)</Label>
                  <Input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g., 35"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Weight (kg)</Label>
                  <Input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g., 70"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-6">
                <div className="text-center space-y-4">
                  <div>
                    <p className="text-sm text-slate-600">Time</p>
                    <p className="text-5xl font-bold text-slate-900">
                      {Math.floor(time / 60)}:{(time % 60).toString().padStart(2, '0')}
                    </p>
                  </div>
                  <div className="flex justify-center gap-2">
                    {!isRunning ? (
                      <Button onClick={() => setIsRunning(true)} size="lg">
                        <Play className="w-5 h-5 mr-2" />
                        {time === 0 ? 'Start Test' : 'Resume'}
                      </Button>
                    ) : (
                      <Button onClick={() => setIsRunning(false)} variant="outline" size="lg">
                        <Pause className="w-5 h-5 mr-2" />
                        Pause
                      </Button>
                    )}
                    <Button onClick={() => setIsRunning(false)} variant="destructive" size="lg">
                      <StopCircle className="w-5 h-5 mr-2" />
                      Stop
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Record Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label>Workload (watts)</Label>
                    <Input
                      type="number"
                      value={workload}
                      onChange={(e) => setWorkload(e.target.value)}
                      placeholder="e.g., 75"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Heart Rate (bpm)</Label>
                    <Input
                      type="number"
                      value={heartRate}
                      onChange={(e) => setHeartRate(e.target.value)}
                      placeholder="e.g., 140"
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={recordMinute} className="w-full">Record Minute</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {minuteData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recorded Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {minuteData.map((data, idx) => (
                      <div key={idx} className="flex justify-between text-sm p-2 bg-slate-50 rounded">
                        <span>Minute {data.minute}</span>
                        <span>HR: {data.heartRate} bpm | Workload: {data.workload}W</span>
                      </div>
                    ))}
                  </div>
                  {calculateVO2Max() && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg border-2 border-green-200">
                      <p className="text-sm text-green-700">Estimated VO₂max</p>
                      <p className="text-3xl font-bold text-green-900">{calculateVO2Max()} ml/kg/min</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observations, test quality, client response..."
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
            disabled={!age || !weight}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Test Results
          </Button>
        </div>
      </div>
    </div>
  );
}