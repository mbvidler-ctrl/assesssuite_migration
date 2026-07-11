import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, Play, Pause, RotateCcw } from 'lucide-react';
import { todayLocal } from "@/lib/localDate";

export default function StorkTestRunner({ onSave, onClose, initialData }) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [data, setData] = useState({
    left_time: initialData?.left_time || "",
    right_time: initialData?.right_time || "",
    observations: initialData?.observations || ""
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
    const leftTime = parseFloat(data.left_time) || 0;
    const rightTime = parseFloat(data.right_time) || 0;
    const best = Math.max(leftTime, rightTime);
    const asymmetry = Math.abs(leftTime - rightTime);

    // Build comprehensive SOAP text
    let soapText = `• Stork Balance Stand Test:\n`;
    soapText += `  Left Leg: ${leftTime}s\n`;
    soapText += `  Right Leg: ${rightTime}s\n`;
    soapText += `  Best Time: ${best}s\n`;
    soapText += `  Asymmetry: ${asymmetry.toFixed(1)}s\n`;
    if (data.result) soapText += `  Test Result: ${data.result === 'positive' ? 'Positive (balance loss)' : 'Negative (normal)'}\n`;
    if (data.observations) soapText += `  Observations: ${data.observations}\n`;

    onSave({
      result_value: best,
      additional_data: {
        soap_text: soapText,
        left_time: leftTime || null,
        right_time: rightTime || null,
        best_time: best,
        asymmetry,
        result: data.result,
        observations: data.observations,
        measurement_type: 'stork_test'
      },
      assessment_date: todayLocal()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-xl font-bold">Stork Balance Stand Test</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Balance on one leg with hands on hips</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Client stands on one leg, hands on hips, other foot against knee. Time how long they can maintain balance (max 60s).
            </p>
          </div>

          {/* Timer */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Balance Timer (max 60 seconds)</h3>
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
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    setTimerSeconds(0);
                  }}
                  variant="outline"
                  size="sm"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {timerSeconds >= 60 && (
              <p className="mt-2 text-green-600 font-semibold">✓ 60 seconds - Maximum time achieved!</p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <Label htmlFor="left_time">Left Leg (seconds)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="left_time"
                  type="number"
                  step="0.1"
                  max="60"
                  value={data.left_time}
                  onChange={(e) => setData({...data, left_time: e.target.value})}
                  placeholder="Time balanced"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTimerRunning(false);
                    setData({...data, left_time: Math.min(timerSeconds, 60).toFixed(1)});
                  }}
                  disabled={timerSeconds === 0}
                >
                  Use
                </Button>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <Label htmlFor="right_time">Right Leg (seconds)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="right_time"
                  type="number"
                  step="0.1"
                  max="60"
                  value={data.right_time}
                  onChange={(e) => setData({...data, right_time: e.target.value})}
                  placeholder="Time balanced"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTimerRunning(false);
                    setData({...data, right_time: Math.min(timerSeconds, 60).toFixed(1)});
                  }}
                  disabled={timerSeconds === 0}
                >
                  Use
                </Button>
              </div>
            </div>
          </div>

          {(data.left_time || data.right_time) && (
            <div className="bg-slate-100 p-4 rounded-lg">
              <h4 className="font-semibold text-slate-900 mb-2">Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-sm text-slate-600">Best Time</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {Math.max(parseFloat(data.left_time) || 0, parseFloat(data.right_time) || 0).toFixed(1)}s
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Asymmetry</p>
                  <p className="text-2xl font-bold">
                    {Math.abs((parseFloat(data.left_time) || 0) - (parseFloat(data.right_time) || 0)).toFixed(1)}s
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label>Test Result</Label>
            <div className="flex gap-3 mt-2">
              <Button
                type="button"
                variant={data.result === 'negative' ? "default" : "outline"}
                onClick={() => setData({...data, result: 'negative'})}
                className="flex-1"
              >
                Negative (Normal)
              </Button>
              <Button
                type="button"
                variant={data.result === 'positive' ? "default" : "outline"}
                onClick={() => setData({...data, result: 'positive'})}
                className="flex-1"
              >
                Positive (Balance loss)
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="observations">Observations</Label>
            <Textarea
              id="observations"
              value={data.observations}
              onChange={(e) => setData({...data, observations: e.target.value})}
              className="mt-1"
              rows={3}
              placeholder="Sway patterns, near falls, compensations..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={!data.result}>
              <Save className="w-4 h-4 mr-2" />
              Save Results
            </Button>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  );
}