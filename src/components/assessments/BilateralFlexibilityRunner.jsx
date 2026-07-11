import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save } from 'lucide-react';
import { todayLocal } from "@/lib/localDate";

export default function BilateralFlexibilityRunner({ testName, onSave, onClose, initialData }) {
  const [data, setData] = useState({
    left_trial1: initialData?.left_trial1 || "",
    left_trial2: initialData?.left_trial2 || "",
    left_trial3: initialData?.left_trial3 || "",
    right_trial1: initialData?.right_trial1 || "",
    right_trial2: initialData?.right_trial2 || "",
    right_trial3: initialData?.right_trial3 || "",
    observations: initialData?.observations || ""
  });

  const calculateBest = (side) => {
    const trials = [
      parseFloat(data[`${side}_trial1`]) || 0,
      parseFloat(data[`${side}_trial2`]) || 0,
      parseFloat(data[`${side}_trial3`]) || 0
    ].filter(v => v !== 0);
    return trials.length > 0 ? Math.max(...trials) : 0;
  };

  const handleSave = () => {
    const leftBest = calculateBest('left');
    const rightBest = calculateBest('right');
    const average = (leftBest + rightBest) / 2;
    const soapText = `• ${testName}\n  Left Best: ${leftBest.toFixed(1)} | Right Best: ${rightBest.toFixed(1)}\n  Asymmetry: ${Math.abs(leftBest - rightBest).toFixed(1)}${data.observations ? `\n  Observations: ${data.observations}` : ''}`;

    onSave({
      result_value: average,
      additional_data: {
        soap_text: soapText,
        left_best: leftBest,
        right_best: rightBest,
        average_score: average,
        asymmetry: Math.abs(leftBest - rightBest),
      },
      notes: data.observations,
      assessment_date: todayLocal(),
      left_trial1: parseFloat(data.left_trial1) || null,
      left_trial2: parseFloat(data.left_trial2) || null,
      left_trial3: parseFloat(data.left_trial3) || null,
      right_trial1: parseFloat(data.right_trial1) || null,
      right_trial2: parseFloat(data.right_trial2) || null,
      right_trial3: parseFloat(data.right_trial3) || null,
      left_best: leftBest,
      right_best: rightBest,
      average_score: average,
      asymmetry: Math.abs(leftBest - rightBest),
      observations: data.observations
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-xl font-bold">{testName}</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Record 3 trials for each side (cm or inches)</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Side */}
            <div className="bg-blue-50 p-4 rounded-lg space-y-4">
              <h4 className="font-semibold text-blue-900 text-lg">Left Side</h4>
              <div>
                <Label htmlFor="left_trial1">Trial 1</Label>
                <Input
                  id="left_trial1"
                  type="number"
                  step="0.1"
                  value={data.left_trial1}
                  onChange={(e) => setData({...data, left_trial1: e.target.value})}
                  className="mt-1"
                  placeholder="Measurement"
                />
              </div>
              <div>
                <Label htmlFor="left_trial2">Trial 2</Label>
                <Input
                  id="left_trial2"
                  type="number"
                  step="0.1"
                  value={data.left_trial2}
                  onChange={(e) => setData({...data, left_trial2: e.target.value})}
                  className="mt-1"
                  placeholder="Measurement"
                />
              </div>
              <div>
                <Label htmlFor="left_trial3">Trial 3</Label>
                <Input
                  id="left_trial3"
                  type="number"
                  step="0.1"
                  value={data.left_trial3}
                  onChange={(e) => setData({...data, left_trial3: e.target.value})}
                  className="mt-1"
                  placeholder="Measurement"
                />
              </div>
              {calculateBest('left') > 0 && (
                <div className="bg-white p-3 rounded">
                  <span className="text-sm text-slate-600">Best: </span>
                  <span className="font-bold text-lg text-blue-600">{calculateBest('left').toFixed(1)}</span>
                </div>
              )}
            </div>

            {/* Right Side */}
            <div className="bg-green-50 p-4 rounded-lg space-y-4">
              <h4 className="font-semibold text-green-900 text-lg">Right Side</h4>
              <div>
                <Label htmlFor="right_trial1">Trial 1</Label>
                <Input
                  id="right_trial1"
                  type="number"
                  step="0.1"
                  value={data.right_trial1}
                  onChange={(e) => setData({...data, right_trial1: e.target.value})}
                  className="mt-1"
                  placeholder="Measurement"
                />
              </div>
              <div>
                <Label htmlFor="right_trial2">Trial 2</Label>
                <Input
                  id="right_trial2"
                  type="number"
                  step="0.1"
                  value={data.right_trial2}
                  onChange={(e) => setData({...data, right_trial2: e.target.value})}
                  className="mt-1"
                  placeholder="Measurement"
                />
              </div>
              <div>
                <Label htmlFor="right_trial3">Trial 3</Label>
                <Input
                  id="right_trial3"
                  type="number"
                  step="0.1"
                  value={data.right_trial3}
                  onChange={(e) => setData({...data, right_trial3: e.target.value})}
                  className="mt-1"
                  placeholder="Measurement"
                />
              </div>
              {calculateBest('right') > 0 && (
                <div className="bg-white p-3 rounded">
                  <span className="text-sm text-slate-600">Best: </span>
                  <span className="font-bold text-lg text-green-600">{calculateBest('right').toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Results Summary */}
          {(calculateBest('left') > 0 || calculateBest('right') > 0) && (
            <div className="bg-slate-100 p-4 rounded-lg">
              <h4 className="font-semibold text-slate-900 mb-3">Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-slate-600">Left Best</p>
                  <p className="font-bold text-lg text-blue-600">{calculateBest('left').toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Right Best</p>
                  <p className="font-bold text-lg text-green-600">{calculateBest('right').toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Asymmetry</p>
                  <p className={`font-bold text-lg ${Math.abs(calculateBest('left') - calculateBest('right')) > 2 ? 'text-red-600' : 'text-slate-600'}`}>
                    {Math.abs(calculateBest('left') - calculateBest('right')).toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Observations */}
          <div>
            <Label htmlFor="observations">Observations</Label>
            <Textarea
              id="observations"
              value={data.observations}
              onChange={(e) => setData({...data, observations: e.target.value})}
              className="mt-1"
              rows={3}
              placeholder="Quality of movement, compensations, pain location..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleSave} 
              disabled={!data.left_trial1 && !data.right_trial1}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}