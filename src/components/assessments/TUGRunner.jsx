import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, Play, Pause, RotateCcw } from 'lucide-react';
import { todayLocal } from "@/lib/localDate";

export default function TUGRunner({ onSave, onClose, initialData }) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  
  const [data, setData] = useState({
    time_seconds: initialData?.time_seconds || "",
    assistive_device: initialData?.assistive_device || "",
    steps_taken: initialData?.steps_taken || "",
    observations: initialData?.observations || "",
    required_assistance: initialData?.required_assistance || "none",
    obstacles_encountered: initialData?.obstacles_encountered || ""
  });

  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 0.1);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const handleSave = () => {
    const timeValue = data.time_seconds || timerSeconds.toFixed(1);
    let interpretation = '';
    const time = parseFloat(timeValue);
    if (time < 10) interpretation = 'Independent mobility';
    else if (time < 20) interpretation = 'Mostly independent';
    else if (time < 30) interpretation = 'Variable mobility, some assistance needed';
    else interpretation = 'Impaired mobility, assistance required';

    // Build comprehensive SOAP text
    let soapText = `• Timed Up and Go (TUG): ${timeValue}s → ${interpretation}\n`;
    if (data.assistive_device && data.assistive_device !== 'none') {
      soapText += `  Assistive Device: ${data.assistive_device.replace(/_/g, ' ')}\n`;
    }
    if (data.steps_taken) soapText += `  Steps Taken: ${data.steps_taken}\n`;
    if (data.required_assistance && data.required_assistance !== 'none') {
      soapText += `  Assistance Required: ${data.required_assistance.replace(/_/g, ' ')}\n`;
    }
    if (data.obstacles_encountered) soapText += `  Obstacles: ${data.obstacles_encountered}\n`;
    if (data.observations) soapText += `  Observations: ${data.observations}\n`;

    onSave({
      result_value: parseFloat(timeValue),
      additional_data: {
        soap_text: soapText,
        averageTime: parseFloat(timeValue),
        trials: [parseFloat(timeValue)],
        time_seconds: parseFloat(timeValue),
        assistive_device: data.assistive_device,
        steps_taken: data.steps_taken ? parseInt(data.steps_taken) : null,
        observations: data.observations,
        required_assistance: data.required_assistance,
        obstacles_encountered: data.obstacles_encountered,
        interpretation,
        measurement_type: 'tug'
      },
      assessment_date: todayLocal()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-xl font-bold">Timed Up and Go (TUG) Test</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Time client to stand, walk 3m, turn, walk back, and sit</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Clinician Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">📋 Administration Instructions (Podsiadlo & Richardson Protocol)</p>
            <p><strong>Setup:</strong> Standard armchair (~46 cm seat height), 3m measured from chair front.</p>
            <p className="italic">"When I say 'Go', stand up from the chair, walk to the line on the floor, turn around, walk back, and sit down. Walk at a safe and comfortable pace."</p>
            <p><strong>Timing:</strong> Start on "Go" (or when client begins to rise). Stop when client's back touches the chair back. Allow 1 practice trial.</p>
            <p><strong>Assistive devices:</strong> Permitted — document device used. Same device must be used on follow-up assessments.</p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 Norms & Interpretation</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Time</th><th className="p-2 text-left">Interpretation</th><th className="p-2 text-left">Population</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">&lt;10 s</td><td className="p-2 text-green-700">Normal</td><td className="p-2">Community-dwelling adults</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">10–20 s</td><td className="p-2 text-yellow-700">Mostly independent</td><td className="p-2">Good balance/gait</td></tr>
                  <tr className="border-t"><td className="p-2">20–30 s</td><td className="p-2 text-orange-700">Variable mobility</td><td className="p-2">Needs further assessment</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">&gt;30 s</td><td className="p-2 text-red-700">High fall risk</td><td className="p-2">Dependent mobility</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">MCID: 1.4 s (frail older adults). Cut-off ≥13.5 s for predicting falls in community dwellers. Source: Podsiadlo & Richardson (1991).</p>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Podsiadlo D & Richardson S. (1991). The timed "Up & Go": a test of basic functional mobility for frail elderly persons. <em>Journal of the American Geriatrics Society, 39</em>(2), 142–148.</p>
          </div>

          {/* Timer */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Test Timer</h3>
            <div className="flex items-center gap-4">
              <div className="text-5xl font-bold text-blue-600 font-mono">
                {timerSeconds.toFixed(1)}s
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => setTimerRunning(!timerRunning)}
                  variant={timerRunning ? "destructive" : "default"}
                  size="sm"
                >
                  {timerRunning ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                  {timerRunning ? 'Stop' : 'Start'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    setTimerSeconds(0);
                    setData({...data, time_seconds: ""});
                  }}
                  variant="outline"
                  size="sm"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Reset
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    setData({...data, time_seconds: timerSeconds.toFixed(1)});
                  }}
                  variant="secondary"
                  size="sm"
                  disabled={timerSeconds === 0}
                >
                  Use Time
                </Button>
              </div>
            </div>
          </div>

          {/* Time Input */}
          <div>
            <Label htmlFor="time_seconds">Total Time (seconds)</Label>
            <Input
              id="time_seconds"
              type="number"
              step="0.1"
              value={data.time_seconds}
              onChange={(e) => setData({...data, time_seconds: e.target.value})}
              className="mt-1 text-2xl font-bold"
              placeholder="e.g., 12.5"
            />
          </div>

          {/* Assistive Device */}
          <div>
            <Label>Assistive Device Used</Label>
            <Select value={data.assistive_device} onValueChange={(value) => setData({...data, assistive_device: value})}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select device (if any)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="single_point_cane">Single Point Cane</SelectItem>
                <SelectItem value="quad_cane">Quad Cane</SelectItem>
                <SelectItem value="walker">Walker</SelectItem>
                <SelectItem value="rollator">Rollator (wheeled walker)</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Steps Taken */}
          <div>
            <Label htmlFor="steps_taken">Number of Steps (Optional)</Label>
            <Input
              id="steps_taken"
              type="number"
              value={data.steps_taken}
              onChange={(e) => setData({...data, steps_taken: e.target.value})}
              className="mt-1"
              placeholder="Count total steps if relevant"
            />
          </div>

          {/* Required Assistance */}
          <div>
            <Label>Level of Assistance Required</Label>
            <Select value={data.required_assistance} onValueChange={(value) => setData({...data, required_assistance: value})}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None - Independent</SelectItem>
                <SelectItem value="supervision">Supervision only</SelectItem>
                <SelectItem value="contact_guard">Contact guard assistance</SelectItem>
                <SelectItem value="minimal_assist">Minimal physical assistance</SelectItem>
                <SelectItem value="moderate_assist">Moderate physical assistance</SelectItem>
                <SelectItem value="maximal_assist">Maximal physical assistance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Obstacles/Issues */}
          <div>
            <Label htmlFor="obstacles_encountered">Obstacles or Issues Encountered</Label>
            <Input
              id="obstacles_encountered"
              value={data.obstacles_encountered}
              onChange={(e) => setData({...data, obstacles_encountered: e.target.value})}
              className="mt-1"
              placeholder="e.g., Loss of balance on turn, unsteady gait"
            />
          </div>

          {/* Observations */}
          <div>
            <Label htmlFor="observations">Additional Observations</Label>
            <Textarea
              id="observations"
              value={data.observations}
              onChange={(e) => setData({...data, observations: e.target.value})}
              className="mt-1"
              rows={3}
              placeholder="Quality of movement, safety concerns, compensatory strategies..."
            />
          </div>

          {/* Interpretation */}
          {data.time_seconds && (
            <div className={`p-4 rounded-lg ${
              parseFloat(data.time_seconds) < 10 ? 'bg-green-50 border-green-200' :
              parseFloat(data.time_seconds) < 20 ? 'bg-blue-50 border-blue-200' :
              parseFloat(data.time_seconds) < 30 ? 'bg-yellow-50 border-yellow-200' :
              'bg-red-50 border-red-200'
            } border`}>
              <p className="font-semibold text-slate-900">
                {parseFloat(data.time_seconds) < 10 ? '✓ Independent mobility' :
                 parseFloat(data.time_seconds) < 20 ? 'Mostly independent' :
                 parseFloat(data.time_seconds) < 30 ? '⚠ Variable mobility, assistance may be needed' :
                 '⚠ Impaired mobility, assistance required'}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                &lt;10s = Normal, 10-20s = Mostly independent, 20-30s = Variable, &gt;30s = Impaired
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save TUG Test
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}