import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save } from 'lucide-react';

const BERG_ITEMS = [
  { id: 1, name: 'Sitting to Standing', description: 'Stand up from sitting without using hands' },
  { id: 2, name: 'Standing Unsupported', description: 'Stand for 2 minutes without support' },
  { id: 3, name: 'Sitting Unsupported', description: 'Sit for 2 minutes without back support' },
  { id: 4, name: 'Standing to Sitting', description: 'Sit down with control' },
  { id: 5, name: 'Transfers', description: 'Transfer from chair to chair and back' },
  { id: 6, name: 'Standing with Eyes Closed', description: 'Stand for 10 seconds with eyes closed' },
  { id: 7, name: 'Standing with Feet Together', description: 'Stand with feet together for 1 minute' },
  { id: 8, name: 'Reaching Forward', description: 'Reach forward with outstretched arm' },
  { id: 9, name: 'Retrieving Object from Floor', description: 'Pick up object from floor' },
  { id: 10, name: 'Turning to Look Behind', description: 'Turn and look over each shoulder' },
  { id: 11, name: 'Turning 360 Degrees', description: 'Turn completely in a circle' },
  { id: 12, name: 'Placing Alternate Foot on Stool', description: 'Touch stool with each foot 4 times' },
  { id: 13, name: 'Standing with One Foot in Front', description: 'Tandem stance for 30 seconds' },
  { id: 14, name: 'Standing on One Foot', description: 'Single leg stance for 10 seconds' }
];

const SCORING_OPTIONS = [
  { value: 4, label: '4 - Independent', color: 'bg-green-100 text-green-800' },
  { value: 3, label: '3 - Minimal assistance', color: 'bg-blue-100 text-blue-800' },
  { value: 2, label: '2 - Moderate assistance', color: 'bg-yellow-100 text-yellow-800' },
  { value: 1, label: '1 - Maximal assistance', color: 'bg-orange-100 text-orange-800' },
  { value: 0, label: '0 - Unable', color: 'bg-red-100 text-red-800' }
];

export default function BergBalanceRunner({ onSave, onClose, initialData }) {
  const [scores, setScores] = useState(initialData?.scores || {});
  const [expandedItem, setExpandedItem] = useState(null);

  const handleScoreChange = (itemId, score) => {
    setScores({ ...scores, [itemId]: score });
  };

  const calculateTotal = () => {
    return Object.values(scores).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  };

  const handleSave = () => {
    const total = calculateTotal();
    const interpretation = total >= 45 ? 'Low fall risk' : total >= 21 ? 'Medium fall risk' : 'High fall risk';
    
    // Build comprehensive SOAP text
    let soapText = `• Berg Balance Scale: ${total}/56 → ${interpretation}\n\n  Individual Item Scores:\n`;
    BERG_ITEMS.forEach(item => {
      const score = scores[item.id];
      if (score !== undefined && score !== null) {
        const scoreLabel = SCORING_OPTIONS.find(opt => opt.value === score)?.label || score;
        soapText += `  ${item.id}. ${item.name}: ${score}/4 (${scoreLabel})\n`;
      }
    });
    
    onSave({
      result_value: total,
      additional_data: {
        soap_text: soapText,
        scores,
        total,
        interpretation,
        measurement_type: 'berg_balance'
      },
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 sticky top-0 bg-white z-10 border-b">
          <div>
            <CardTitle className="text-xl font-bold">Berg Balance Scale (BBS)</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Score each item 0-4 based on performance</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4 pt-6">
          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Berg KO, Wood-Dauphinee SL, Williams JI, & Maki B. (1992). Measuring balance in the elderly: validation of an instrument. <em>Canadian Journal of Public Health, 83</em>(Suppl 2), S7–S11.</p>
          </div>

          {/* Clinician Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">📋 Administration Instructions</p>
            <p><strong>General:</strong> Score each item 0–4 based on the client's ABILITY to complete the task safely. 4 = independent, full ability; 0 = unable/requires maximal assistance.</p>
            <p><strong>Equipment:</strong> Chairs (with/without armrests), stopwatch, ruler (30 cm), step or stool (15–20 cm), tape for floor marks.</p>
            <p><strong>Script:</strong> Demonstrate each task before asking the client to perform it. Only provide necessary verbal cues — do not provide physical assistance unless safety requires it.</p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 Score Interpretation (/56)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Score</th><th className="p-2 text-left">Fall Risk</th><th className="p-2 text-left">Ambulatory Status</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">45–56</td><td className="p-2 text-green-700">Low</td><td className="p-2">Independent community ambulation</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">21–44</td><td className="p-2 text-yellow-700">Medium</td><td className="p-2">Assisted ambulation likely</td></tr>
                  <tr className="border-t"><td className="p-2">0–20</td><td className="p-2 text-red-700">High</td><td className="p-2">Wheelchair dependent</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">MCID: 4–7 points. Cut-off ≤45 predicts falls (sensitivity 64–92%). Source: Berg et al. (1992); Bogle Thorbahn & Newton (1996).</p>
          </div>

          {BERG_ITEMS.map((item) => (
            <Card key={item.id} className="border-slate-200">
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">{item.id}. {item.name}</h4>
                    <p className="text-sm text-slate-600">{item.description}</p>
                  </div>
                  {scores[item.id] !== undefined && (
                    <div className={`ml-4 text-xs font-semibold px-2 py-1 rounded ${SCORING_OPTIONS.find(o => o.value === scores[item.id])?.color || ''}`}>
                      {scores[item.id]}/4
                    </div>
                  )}
                </div>
              </CardHeader>
              
              {expandedItem === item.id && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 gap-2">
                    {SCORING_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        variant={scores[item.id] === opt.value ? "default" : "outline"}
                        onClick={() => handleScoreChange(item.id, opt.value)}
                        className={`justify-start text-left h-auto py-3 ${
                          scores[item.id] === opt.value ? '' : opt.color
                        }`}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}

          {/* Results Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-lg p-5">
            <h3 className="font-bold text-slate-900 mb-3 text-lg">Total Score</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-sm text-slate-600">Score</p>
                <p className="text-4xl font-bold text-blue-600">{calculateTotal()}/56</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-sm text-slate-600">Fall Risk</p>
                <p className={`text-xl font-bold ${
                  calculateTotal() >= 45 ? 'text-green-600' : 
                  calculateTotal() >= 21 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {calculateTotal() >= 45 ? 'Low' : calculateTotal() >= 21 ? 'Medium' : 'High'}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-3">
              Interpretation: 45-56 = Low risk, 21-44 = Medium risk, 0-20 = High risk of falls
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Berg Balance Scale
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}