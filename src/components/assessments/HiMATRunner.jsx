import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { X, Save } from 'lucide-react';

const HIMAT_ITEMS = [
  { id: 1, name: 'Walking', max: 5 },
  { id: 2, name: 'Walking Backwards', max: 5 },
  { id: 3, name: 'Walking on Toes', max: 5 },
  { id: 4, name: 'Walking Over Obstacle', max: 5 },
  { id: 5, name: 'Running', max: 4 },
  { id: 6, name: 'Skipping', max: 4 },
  { id: 7, name: 'Hopping Forward (Affected Leg)', max: 4 },
  { id: 8, name: 'Bounding (Affected Leg Leading)', max: 4 },
  { id: 9, name: 'Hopping Forward (Unaffected Leg)', max: 4 },
  { id: 10, name: 'Bounding (Unaffected Leg Leading)', max: 4 },
  { id: 11, name: 'Stair Ascent', max: 5 },
  { id: 12, name: 'Stair Descent', max: 5 },
  { id: 13, name: 'Up from Chair', max: 4 }
];

export default function HiMATRunner({ onSave, onClose, initialData }) {
  const [scores, setScores] = useState(initialData?.scores || {});
  const [observations, setObservations] = useState(initialData?.observations || "");
  const [expandedItem, setExpandedItem] = useState(null);

  const handleScoreChange = (itemId, score, max) => {
    setScores({...scores, [itemId]: Math.min(Math.max(0, score), max)});
  };

  const calculateTotal = () => {
    return Object.values(scores).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  };

  const handleSave = () => {
    const total = calculateTotal();
    const interp = total >= 54 ? 'High-level mobility' : total >= 42 ? 'Good mobility' : 'Impaired mobility';
    const soapText = `• High-Level Mobility Assessment Tool (HiMAT)\n  Total Score: ${total}/54 — ${interp}${observations ? `\n  Observations: ${observations}` : ''}`;
    onSave({
      result_value: total,
      additional_data: {
        soap_text: soapText,
        scores,
        total,
        interpretation: interp,
      },
      notes: observations,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 sticky top-0 bg-white z-10 border-b">
          <div>
            <CardTitle className="text-xl font-bold">High-Level Mobility Assessment Tool (HiMAT)</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Score: {calculateTotal()}/54</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4 pt-6">
          {HIMAT_ITEMS.map((item) => (
            <Card key={item.id} className="border-slate-200">
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-900">{item.id}. {item.name}</h4>
                  {scores[item.id] !== undefined ? (
                    <div className="font-bold text-lg text-blue-600">{scores[item.id]}/{item.max}</div>
                  ) : (
                    <div className="text-sm text-slate-400">Not scored</div>
                  )}
                </div>
              </CardHeader>
              
              {expandedItem === item.id && (
                <CardContent className="pt-0">
                  <div className="flex gap-2">
                    {[...Array(item.max + 1)].map((_, i) => (
                      <Button
                        key={i}
                        type="button"
                        variant={scores[item.id] === i ? "default" : "outline"}
                        onClick={() => handleScoreChange(item.id, i, item.max)}
                        className="flex-1 text-lg font-bold h-12"
                      >
                        {i}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}

          {/* Total Score */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-lg p-5 sticky bottom-0">
            <h3 className="font-bold text-slate-900 mb-2">Total Score</h3>
            <p className="text-4xl font-bold text-blue-600">{calculateTotal()}/54</p>
            <p className="text-sm text-slate-600 mt-1">
              {calculateTotal() >= 54 ? 'High-level mobility' : 
               calculateTotal() >= 42 ? 'Good mobility' : 'Impaired mobility'}
            </p>
          </div>

          <div>
            <Label htmlFor="observations">Observations</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="mt-1"
              rows={2}
              placeholder="Specific deficits, compensations, safety concerns..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={Object.keys(scores).length < 13}>
              <Save className="w-4 h-4 mr-2" />
              Save HiMAT Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}