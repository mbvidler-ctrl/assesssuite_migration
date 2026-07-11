import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save } from 'lucide-react';
import { todayLocal } from "@/lib/localDate";

export default function SitAndReachRunner({ onSave, onClose, initialData }) {
  const [data, setData] = useState({
    trial1: initialData?.trial1 || "",
    trial2: initialData?.trial2 || "",
    trial3: initialData?.trial3 || "",
    observations: initialData?.observations || ""
  });

  const calculateBest = () => {
    const trials = [
      parseFloat(data.trial1) || 0,
      parseFloat(data.trial2) || 0,
      parseFloat(data.trial3) || 0
    ].filter(v => v !== 0);
    return trials.length > 0 ? Math.max(...trials) : null;
  };

  const handleSave = () => {
    const best = calculateBest();
    const soapText = `• Sit and Reach Test\n  Result: ${best?.toFixed(1) ?? 'N/A'} cm (best of trials)${data.observations ? `\n  Observations: ${data.observations}` : ''}`;
    onSave({
      result_value: best,
      additional_data: {
        soap_text: soapText,
        trial1: parseFloat(data.trial1) || null,
        trial2: parseFloat(data.trial2) || null,
        trial3: parseFloat(data.trial3) || null,
        best_score: best,
      },
      notes: data.observations,
      assessment_date: todayLocal()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-2xl max-h-[95vh] overflow-y-auto bg-white" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-xl font-bold">Sit and Reach Test</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Record 3 trials, measure furthest reach (cm)</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Client sits with legs extended, feet against box. Reach forward as far as possible. Record distance in cm.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="trial1">Trial 1 (cm)</Label>
              <Input
                id="trial1"
                type="number"
                step="0.1"
                value={data.trial1}
                onChange={(e) => setData({...data, trial1: e.target.value})}
                className="mt-1 text-xl"
                placeholder="e.g., 28.5"
              />
            </div>
            <div>
              <Label htmlFor="trial2">Trial 2 (cm)</Label>
              <Input
                id="trial2"
                type="number"
                step="0.1"
                value={data.trial2}
                onChange={(e) => setData({...data, trial2: e.target.value})}
                className="mt-1 text-xl"
                placeholder="e.g., 29.0"
              />
            </div>
            <div>
              <Label htmlFor="trial3">Trial 3 (cm)</Label>
              <Input
                id="trial3"
                type="number"
                step="0.1"
                value={data.trial3}
                onChange={(e) => setData({...data, trial3: e.target.value})}
                className="mt-1 text-xl"
                placeholder="e.g., 30.2"
              />
            </div>
          </div>

          {calculateBest() !== null && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 mb-2">Best Score</h4>
              <p className="text-4xl font-bold text-blue-600">{calculateBest().toFixed(1)} cm</p>
            </div>
          )}

          <div>
            <Label htmlFor="observations">Observations</Label>
            <Textarea
              id="observations"
              value={data.observations}
              onChange={(e) => setData({...data, observations: e.target.value})}
              className="mt-1"
              rows={2}
              placeholder="Hamstring tightness, pain, knee flexion..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}