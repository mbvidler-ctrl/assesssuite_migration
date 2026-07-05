import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

const MOCA_QUESTIONS = [
  { id: 'visuospatial', label: 'Visuospatial/Executive (Trail Making, Cube, Clock)', max: 5 },
  { id: 'naming', label: 'Naming (Lion, Rhino, Camel)', max: 3 },
  { id: 'attention_digits', label: 'Attention - Digits Forward', max: 1 },
  { id: 'attention_backward', label: 'Attention - Digits Backward', max: 1 },
  { id: 'attention_vigilance', label: 'Attention - Vigilance (Tap A)', max: 1 },
  { id: 'attention_serial7', label: 'Attention - Serial 7s', max: 3 },
  { id: 'language_repeat', label: 'Language - Sentence Repetition', max: 2 },
  { id: 'language_fluency', label: 'Language - Verbal Fluency (F words)', max: 1 },
  { id: 'abstraction', label: 'Abstraction (Similarities)', max: 2 },
  { id: 'delayed_recall', label: 'Delayed Recall (5 words)', max: 5 },
  { id: 'orientation', label: 'Orientation (Date, Month, Year, Day, Place, City)', max: 6 }
];

export default function MoCARunner({ onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [education, setEducation] = useState('12+');

  const handleScoreChange = (id, value) => {
    const numValue = Math.max(0, Math.min(value, MOCA_QUESTIONS.find(q => q.id === id).max));
    setScores({ ...scores, [id]: numValue });
  };

  const calculateTotal = () => {
    const rawTotal = Object.values(scores).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    const adjustment = education === '<12' ? 1 : 0;
    return Math.min(rawTotal + adjustment, 30);
  };

  const handleSave = () => {
    const total = calculateTotal();
    const interp = total >= 26 ? 'Normal Cognition' : total >= 18 ? 'Mild Cognitive Impairment' : 'Cognitive Impairment';
    const soapText = `• Montreal Cognitive Assessment (MoCA)\n  Total Score: ${total}/30 — ${interp}\n  Education: ${education} years`;
    onSave({
      result_value: total,
      additional_data: {
        soap_text: soapText,
        scores,
        education,
        total,
        interpretation: interp,
      },
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-xl font-bold">Montreal Cognitive Assessment (MoCA)</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Score each domain as you administer the MoCA. Each item has a maximum score indicated in parentheses.
            </p>
          </div>

          {/* Education Level */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <Label className="font-semibold text-amber-900 mb-2 block">Years of Education</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={education === '<12' ? 'default' : 'outline'}
                onClick={() => setEducation('<12')}
              >
                &lt; 12 years (+1 point adjustment)
              </Button>
              <Button
                type="button"
                variant={education === '12+' ? 'default' : 'outline'}
                onClick={() => setEducation('12+')}
              >
                ≥ 12 years
              </Button>
            </div>
          </div>

          {/* MoCA Domains */}
          <div className="space-y-4">
            {MOCA_QUESTIONS.map((question) => (
              <div key={question.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <Label className="font-medium text-slate-900 mb-3 block">
                  {question.label} <span className="text-slate-500">(Max: {question.max})</span>
                </Label>
                <div className="flex gap-2">
                  {[...Array(question.max + 1)].map((_, i) => (
                    <Button
                      key={i}
                      type="button"
                      variant={scores[question.id] === i ? 'default' : 'outline'}
                      onClick={() => handleScoreChange(question.id, i)}
                      className="w-12 h-12 text-lg font-bold"
                    >
                      {i}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Results Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-lg p-5">
            <h3 className="font-bold text-slate-900 mb-3 text-lg">Results Summary</h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-sm text-slate-600">Raw Score</p>
                <p className="text-3xl font-bold text-blue-600">
                  {Object.values(scores).reduce((sum, val) => sum + (parseInt(val) || 0), 0)}/30
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Adjusted Total</p>
                <p className="text-3xl font-bold text-indigo-600">{calculateTotal()}/30</p>
              </div>
            </div>
            {calculateTotal() > 0 && (
              <div className={`p-3 rounded-lg ${
                calculateTotal() >= 26 ? 'bg-green-100' :
                calculateTotal() >= 18 ? 'bg-yellow-100' : 'bg-red-100'
              }`}>
                <p className="font-semibold">
                  Interpretation: {calculateTotal() >= 26 ? 'Normal Cognition' :
                    calculateTotal() >= 18 ? 'Mild Cognitive Impairment' : 'Cognitive Impairment'}
                </p>
                <p className="text-xs mt-1 text-slate-600">
                  Cut-offs: ≥26 Normal, 18-25 MCI, &lt;18 Impaired
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              Save MoCA Results
            </Button>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  );
}