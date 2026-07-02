import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, Play, Pause, RotateCcw } from 'lucide-react';

const CONDITIONS = [
  { id: 'firm_eyes_open', name: 'Firm Surface, Eyes Open', surface: 'firm', vision: 'open' },
  { id: 'firm_eyes_closed', name: 'Firm Surface, Eyes Closed', surface: 'firm', vision: 'closed' },
  { id: 'foam_eyes_open', name: 'Foam Surface, Eyes Open', surface: 'foam', vision: 'open' },
  { id: 'foam_eyes_closed', name: 'Foam Surface, Eyes Closed', surface: 'foam', vision: 'closed' }
];

export default function CTSIBRunner({ onSave, onClose, initialData }) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [currentCondition, setCurrentCondition] = useState(0);
  const [scores, setScores] = useState(initialData?.scores || {});
  const [observations, setObservations] = useState(initialData?.observations || "");

  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 0.1);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const handleRecordTime = (conditionId) => {
    setScores({...scores, [conditionId]: Math.min(timerSeconds, 30).toFixed(1)});
    setTimerRunning(false);
  };

  const handleSave = () => {
    const completed = Object.keys(scores).length;

    const scoresText = CONDITIONS.map(condition => {
      const score = scores[condition.id];
      return score ? `  - ${condition.name}: ${score}s` : `  - ${condition.name}: Not tested`;
    }).join('\n');

    const soapText = `â€¢ Clinical Test of Sensory Interaction in Balance (CTSIB):\n${scoresText}${observations ? `\n\n  Observations: ${observations}` : ''}`;

    // Use the shortest recorded time as result_value for display
    const times = Object.values(scores).map(Number);
    const resultValue = times.length > 0 ? Math.min(...times) : 0;

    onSave({
      result_value: resultValue,
      additional_data: {
        soap_text: soapText,
        scores,
        conditions_completed: completed,
        interpretation: completed === 4 ? 'All 4 conditions completed' : `${completed}/4 conditions completed`,
      },
      notes: observations,
      assessment_date: new Date().toISOString().split('T')[0],
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-xl font-bold">Clinical Test of Sensory Interaction in Balance (CTSIB)</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Test 4 conditions: firm/foam surface Ã— eyes open/closed</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">ðŸ“– Reference</p>
            <p>Shumway-Cook A & Horak FB. (1986). Assessing the influence of sensory interaction on balance. <em>Physical Therapy, 66</em>(10), 1548â€“1550.</p>
            <p>Broglio SP et al. (2009). The sensitivity of concussion assessment measures. <em>Journal of Athletic Training, 44</em>(1), 3â€“9.</p>
          </div>

          {/* Clinician Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">ðŸ“‹ Administration Instructions</p>
            <p><strong>Position:</strong> Feet together, arms at sides (or on hips). Time each condition for up to 30 seconds. Record actual time if loss of balance before 30 s.</p>
            <p className="italic">"Stand as still as possible with feet together and arms at your sides. Close your eyes when I say so."</p>
            <p><strong>Progression:</strong> Conditions 1â†’2â†’3â†’4 (firm EO â†’ firm EC â†’ foam EO â†’ foam EC). Rest between conditions as needed.</p>
            <p><strong>Stop criteria:</strong> Both feet move, arms used for balance, eyes open (EC conditions), or near-fall.</p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-semibold text-slate-700">ðŸ“Š Expected Performance</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Condition</th><th className="p-2 text-center">Healthy Adults</th><th className="p-2 text-center">Significance if Impaired</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">Firm, Eyes Open</td><td className="p-2 text-center">30 s</td><td className="p-2">Gross sensorimotor deficit</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">Firm, Eyes Closed</td><td className="p-2 text-center">30 s</td><td className="p-2">Vestibular/proprioceptive deficit</td></tr>
                  <tr className="border-t"><td className="p-2">Foam, Eyes Open</td><td className="p-2 text-center">30 s</td><td className="p-2">Proprioceptive impairment</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">Foam, Eyes Closed</td><td className="p-2 text-center">20â€“30 s</td><td className="p-2">Vestibular dysfunction</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">Inability to complete conditions 3 or 4 indicates sensory reweighting impairment. Commonly used in concussion assessment. Source: Shumway-Cook & Horak (1986).</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Each condition: Stand with feet together for 30 seconds (or until loss of balance). Record time held.
            </p>
          </div>

          {/* Timer */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-3">30-Second Timer</h3>
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
            {timerSeconds >= 30 && (
              <p className="mt-2 text-green-600 font-semibold">âœ“ 30 seconds reached!</p>
            )}
          </div>

          {/* Conditions */}
          <div className="grid md:grid-cols-2 gap-4">
            {CONDITIONS.map((condition, index) => (
              <div 
                key={condition.id}
                className={`p-4 rounded-lg border-2 ${
                  scores[condition.id] ? 'bg-green-50 border-green-300' : 
                  index === currentCondition ? 'bg-blue-50 border-blue-300' : 
                  'bg-slate-50 border-slate-200'
                }`}
              >
                <h4 className="font-semibold text-slate-900 mb-2">{condition.name}</h4>
                {scores[condition.id] ? (
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">{scores[condition.id]}s</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newScores = {...scores};
                        delete newScores[condition.id];
                        setScores(newScores);
                      }}
                      className="mt-2 text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setCurrentCondition(index);
                        setTimerRunning(false);
                        setTimerSeconds(0);
                      }}
                      className="w-full"
                    >
                      Select
                    </Button>
                    {index === currentCondition && (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => handleRecordTime(condition.id)}
                        disabled={timerSeconds === 0}
                        className="w-full"
                      >
                        Record Time
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div>
            <Label htmlFor="observations">Observations</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="mt-1"
              rows={3}
              placeholder="Condition-specific observations, sway patterns, fall direction..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={Object.keys(scores).length === 0}>
              <Save className="w-4 h-4 mr-2" />
              Save Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}