import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save } from 'lucide-react';

export default function BackScratchRunner({ onSave, onClose, initialData }) {
  const [data, setData] = useState({
    left_trial1: initialData?.left_trial1 || "",
    left_trial2: initialData?.left_trial2 || "",
    right_trial1: initialData?.right_trial1 || "",
    right_trial2: initialData?.right_trial2 || "",
    observations: initialData?.observations || ""
  });

  const calculateBest = (side) => {
    const trials = [
      parseFloat(data[`${side}_trial1`]) || 0,
      parseFloat(data[`${side}_trial2`]) || 0
    ].filter(v => v !== 0);
    return trials.length > 0 ? Math.max(...trials) : null;
  };

  const handleSave = () => {
    const leftBest = calculateBest('left');
    const rightBest = calculateBest('right');
    const average = (leftBest !== null && rightBest !== null) ? (leftBest + rightBest) / 2 : null;

    // Build comprehensive SOAP text
    let soapText = `• Back Scratch Test (Shoulder Flexibility):\n`;
    soapText += `  Left Hand Over Shoulder:\n`;
    if (data.left_trial1) soapText += `    Trial 1: ${data.left_trial1}cm\n`;
    if (data.left_trial2) soapText += `    Trial 2: ${data.left_trial2}cm\n`;
    if (leftBest !== null) soapText += `    Best: ${leftBest.toFixed(1)}cm\n`;
    soapText += `  Right Hand Over Shoulder:\n`;
    if (data.right_trial1) soapText += `    Trial 1: ${data.right_trial1}cm\n`;
    if (data.right_trial2) soapText += `    Trial 2: ${data.right_trial2}cm\n`;
    if (rightBest !== null) soapText += `    Best: ${rightBest.toFixed(1)}cm\n`;
    if (average !== null) soapText += `  Average: ${average.toFixed(1)}cm\n`;
    if (leftBest !== null && rightBest !== null) soapText += `  Asymmetry: ${Math.abs(leftBest - rightBest).toFixed(1)}cm\n`;
    if (data.observations) soapText += `  Observations: ${data.observations}\n`;

    onSave({
      result_value: average,
      additional_data: {
        soap_text: soapText,
        left_trial1: parseFloat(data.left_trial1) || null,
        left_trial2: parseFloat(data.left_trial2) || null,
        right_trial1: parseFloat(data.right_trial1) || null,
        right_trial2: parseFloat(data.right_trial2) || null,
        left_best: leftBest,
        right_best: rightBest,
        average_distance: average,
        asymmetry: Math.abs(leftBest - rightBest),
        measurement_type: 'back_scratch'
      },
      notes: data.observations,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl bg-white max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-xl font-bold">Back Scratch Test</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Measure overlap/distance between middle fingers (cm)</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Rikli RE & Jones CJ. (1999). Development and validation of a functional fitness test for community-residing older adults. <em>Journal of Aging and Physical Activity, 7</em>(2), 129–161.</p>
          </div>

          {/* Clinician Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">📋 Administration Instructions</p>
            <p><strong>Position:</strong> Standing. Dominant hand reaches over same shoulder, palm on back; non-dominant hand behind lower back, palm out. Both hands reach toward each other along spine.</p>
            <p className="italic">"Reach one hand over your shoulder and one behind your back, and try to get your fingertips as close together as possible."</p>
            <p><strong>Scoring:</strong> Positive (+) = fingers overlap; Negative (−) = gap between fingertips. Measure middle fingertips. 2 trials each side — record the best.</p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 Norms — Back Scratch (cm) — Rikli & Jones Senior Fitness Test</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Age</th><th className="p-2 text-center">Men (avg)</th><th className="p-2 text-center">Women (avg)</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">60–64</td><td className="p-2 text-center">−8.9 to +1.3</td><td className="p-2 text-center">−2.5 to +7.6</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">65–69</td><td className="p-2 text-center">−10.2 to 0</td><td className="p-2 text-center">−2.5 to +7.6</td></tr>
                  <tr className="border-t"><td className="p-2">70–74</td><td className="p-2 text-center">−11.4 to −1.3</td><td className="p-2 text-center">−3.8 to +6.3</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">75+</td><td className="p-2 text-center">−12.7 to −2.5</td><td className="p-2 text-center">−5.1 to +5.1</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Scoring:</strong> Positive (+) = fingers overlap, Negative (-) = fingers don't touch (gap distance)
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Hand Over */}
            <div className="bg-blue-50 p-4 rounded-lg space-y-4">
              <h4 className="font-semibold text-blue-900 text-lg">Left Hand Over Shoulder</h4>
              <div>
                <Label htmlFor="left_trial1">Trial 1 (cm)</Label>
                <Input
                  id="left_trial1"
                  type="number"
                  step="0.1"
                  value={data.left_trial1}
                  onChange={(e) => setData({...data, left_trial1: e.target.value})}
                  className="mt-1"
                  placeholder="+ overlap or - gap"
                />
              </div>
              <div>
                <Label htmlFor="left_trial2">Trial 2 (cm)</Label>
                <Input
                  id="left_trial2"
                  type="number"
                  step="0.1"
                  value={data.left_trial2}
                  onChange={(e) => setData({...data, left_trial2: e.target.value})}
                  className="mt-1"
                  placeholder="+ overlap or - gap"
                />
              </div>
              {calculateBest('left') !== null && (
                <div className="bg-white p-3 rounded">
                  <span className="text-sm text-slate-600">Best: </span>
                  <span className="font-bold text-lg text-blue-600">{calculateBest('left').toFixed(1)} cm</span>
                </div>
              )}
            </div>

            {/* Right Hand Over */}
            <div className="bg-green-50 p-4 rounded-lg space-y-4">
              <h4 className="font-semibold text-green-900 text-lg">Right Hand Over Shoulder</h4>
              <div>
                <Label htmlFor="right_trial1">Trial 1 (cm)</Label>
                <Input
                  id="right_trial1"
                  type="number"
                  step="0.1"
                  value={data.right_trial1}
                  onChange={(e) => setData({...data, right_trial1: e.target.value})}
                  className="mt-1"
                  placeholder="+ overlap or - gap"
                />
              </div>
              <div>
                <Label htmlFor="right_trial2">Trial 2 (cm)</Label>
                <Input
                  id="right_trial2"
                  type="number"
                  step="0.1"
                  value={data.right_trial2}
                  onChange={(e) => setData({...data, right_trial2: e.target.value})}
                  className="mt-1"
                  placeholder="+ overlap or - gap"
                />
              </div>
              {calculateBest('right') !== null && (
                <div className="bg-white p-3 rounded">
                  <span className="text-sm text-slate-600">Best: </span>
                  <span className="font-bold text-lg text-green-600">{calculateBest('right').toFixed(1)} cm</span>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          {(calculateBest('left') !== null || calculateBest('right') !== null) && (
            <div className="bg-slate-100 p-4 rounded-lg">
              <h4 className="font-semibold text-slate-900 mb-3">Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-sm text-slate-600">Average</p>
                  <p className="font-bold text-lg">{((calculateBest('left') + calculateBest('right')) / 2).toFixed(1)} cm</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Asymmetry</p>
                  <p className="font-bold text-lg">{Math.abs(calculateBest('left') - calculateBest('right')).toFixed(1)} cm</p>
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
              rows={2}
              placeholder="Pain, limitations, compensations..."
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