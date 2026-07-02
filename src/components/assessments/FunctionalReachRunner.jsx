import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Plus, Trash2 } from 'lucide-react';

export default function FunctionalReachRunner({ onSave, onClose }) {
  const [trials, setTrials] = useState([]);
  const [currentTrial, setCurrentTrial] = useState('');
  const [notes, setNotes] = useState('');

  const handleAddTrial = () => {
    if (!currentTrial) return;
    setTrials([...trials, parseFloat(currentTrial)]);
    setCurrentTrial('');
  };

  const handleRemoveTrial = (index) => {
    setTrials(trials.filter((_, i) => i !== index));
  };

  const calculateAverage = () => {
    if (trials.length === 0) return 0;
    const sum = trials.reduce((acc, val) => acc + val, 0);
    return (sum / trials.length).toFixed(1);
  };

  const getInterpretation = (reach) => {
    const r = parseFloat(reach);
    if (r >= 25) return { text: 'Normal - Low Fall Risk', color: 'text-green-600' };
    if (r >= 15) return { text: 'Moderate Risk', color: 'text-yellow-600' };
    if (r >= 6) return { text: 'High Fall Risk - 2x risk', color: 'text-orange-600' };
    return { text: 'Very High Fall Risk - 4x risk', color: 'text-red-600' };
  };

  const handleSave = () => {
    const avgReach = calculateAverage();
    const interpretation = getInterpretation(avgReach);
    const maxReach = Math.max(...trials);
    
    // Build comprehensive SOAP text
    let soapText = `â€¢ Functional Reach Test: ${avgReach} cm (average) â†’ ${interpretation.text}\n`;
    soapText += `  Trials: ${trials.join(' cm, ')} cm\n`;
    soapText += `  Best Reach: ${maxReach} cm\n`;
    if (notes) soapText += `  Notes: ${notes}\n`;
    
    onSave({
      result_value: parseFloat(avgReach),
      additional_data: {
        soap_text: soapText,
        trials,
        averageReach: parseFloat(avgReach),
        maxReach,
        interpretation: interpretation.text,
        measurement_type: 'functional_reach'
      },
      notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl bg-white my-auto">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-xl font-bold">Functional Reach Test</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 mb-2">
              <strong>Instructions:</strong> Stand with feet shoulder-width apart, raise arm to 90Â°. Reach forward as far as possible without taking a step.
            </p>
            <p className="text-xs text-blue-700">
              Measure the distance between starting position and maximum forward reach along the yardstick/ruler.
            </p>
          </div>

          {/* Trial Entry */}
          <div className="space-y-4 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900">Record Trial</h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="reach">Reach Distance (cm)</Label>
                <Input
                  id="reach"
                  type="number"
                  step="0.1"
                  value={currentTrial}
                  onChange={(e) => setCurrentTrial(e.target.value)}
                  className="mt-1"
                  placeholder="e.g., 28.5"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTrial();
                    }
                  }}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={handleAddTrial}
                  disabled={!currentTrial}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Trial
                </Button>
              </div>
            </div>
          </div>

          {/* Recorded Trials */}
          {trials.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Recorded Trials ({trials.length})</h3>
              <div className="space-y-2">
                {trials.map((trial, index) => (
                  <div key={index} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div>
                      <span className="font-semibold text-slate-900">Trial {index + 1}: </span>
                      <span className="text-lg font-bold text-blue-600">{trial} cm</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveTrial(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1"
              placeholder="Balance issues, compensatory movements, pain..."
            />
          </div>

          {/* Results Summary */}
          {trials.length > 0 && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-300 rounded-lg p-5">
              <h3 className="font-bold text-slate-900 mb-3">Results Summary</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-600">Average Reach</p>
                  <p className="text-3xl font-bold text-indigo-600">{calculateAverage()} cm</p>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-600">Best Reach</p>
                  <p className="text-3xl font-bold text-purple-600">{Math.max(...trials)} cm</p>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-600">Risk Level</p>
                  <p className={`text-sm font-bold ${getInterpretation(calculateAverage()).color}`}>
                    {getInterpretation(calculateAverage()).text}
                  </p>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-600 bg-white/70 rounded p-2">
                <strong>Fall Risk Guidelines:</strong> â‰¥25cm = Low risk â€¢ 15-24cm = Moderate â€¢ 6-14cm = High (2x) â€¢ &lt;6cm = Very High (4x)
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700"
            >
              Save Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}