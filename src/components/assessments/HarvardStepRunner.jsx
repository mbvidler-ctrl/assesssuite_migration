import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, Play, Pause, RotateCcw, Info, ChevronDown, ChevronUp, ExternalLink, AlertTriangle } from 'lucide-react';
import { todayLocal } from "@/lib/localDate";

export default function HarvardStepRunner({ onSave, onClose, initialData }) {
  const [showInfo, setShowInfo] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [data, setData] = useState({
    duration_completed: initialData?.duration_completed || "",
    hr_1min: initialData?.hr_1min || "",
    hr_2min: initialData?.hr_2min || "",
    hr_3min: initialData?.hr_3min || "",
    reason_stopped: initialData?.reason_stopped || "",
    observations: initialData?.observations || ""
  });

  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          const newTime = prev + 1;
          if (newTime >= 300) { // 5 minutes
            setTimerRunning(false);
            return 300;
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const calculateFitnessIndex = () => {
    const duration = parseFloat(data.duration_completed) || 0;
    const hr1 = parseFloat(data.hr_1min) || 0;
    const hr2 = parseFloat(data.hr_2min) || 0;
    const hr3 = parseFloat(data.hr_3min) || 0;
    
    if (duration === 0 || (hr1 + hr2 + hr3) === 0) return null;
    
    const index = (duration * 100) / ((hr1 + hr2 + hr3) * 2);
    return index.toFixed(1);
  };

  const handleSave = () => {
    const fitnessIndex = calculateFitnessIndex();
    let interpretation = '';
    if (fitnessIndex) {
      const fi = parseFloat(fitnessIndex);
      if (fi >= 90) interpretation = 'Excellent';
      else if (fi >= 80) interpretation = 'Good';
      else if (fi >= 65) interpretation = 'Average';
      else if (fi >= 55) interpretation = 'Below Average';
      else interpretation = 'Poor';
    }

    const soapText = [
      `• Harvard Step Test`,
      `  Duration: ${data.duration_completed}s`,
      data.hr_1min ? `  HR 1-2 min: ${data.hr_1min} bpm` : null,
      data.hr_2min ? `  HR 2-3 min: ${data.hr_2min} bpm` : null,
      data.hr_3min ? `  HR 3-4 min: ${data.hr_3min} bpm` : null,
      fitnessIndex ? `  Fitness Index: ${fitnessIndex} — ${interpretation}` : null,
      data.reason_stopped ? `  Stopped: ${data.reason_stopped}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: fitnessIndex ? parseFloat(fitnessIndex) : null,
      additional_data: {
        soap_text: soapText,
        duration_completed: parseFloat(data.duration_completed) || null,
        hr_1min: parseFloat(data.hr_1min) || null,
        hr_2min: parseFloat(data.hr_2min) || null,
        hr_3min: parseFloat(data.hr_3min) || null,
        fitness_index: fitnessIndex ? parseFloat(fitnessIndex) : null,
        interpretation,
        reason_stopped: data.reason_stopped,
      },
      notes: data.observations,
      assessment_date: todayLocal()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-xl font-bold">Harvard Step Test</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Step test for cardiovascular fitness</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">

          {/* Collapsible Clinician Info Panel */}
          <div className="border border-blue-200 rounded-lg overflow-hidden">
            <button
              className="w-full flex justify-between items-center px-4 py-3 bg-blue-50 text-blue-800 font-semibold text-sm hover:bg-blue-100 transition-colors"
              onClick={() => setShowInfo(v => !v)}
            >
              <span className="flex items-center gap-2"><Info className="w-4 h-4" />Clinician Info, Protocol & References</span>
              {showInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showInfo && (
              <div className="p-4 text-sm text-slate-700 space-y-4">

                <div>
                  <p className="font-semibold text-slate-800 mb-1">About the Test</p>
                  <p className="text-slate-600">The Harvard Step Test is a submaximal cardiovascular fitness test developed at Harvard University (Brouha, 1943). It measures the ability to recover from a standardised bout of stepping exercise, using post-exercise heart rates to calculate a Physical Fitness Index (PFI). It is widely used in occupational, military, and general fitness screening.</p>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-1">Equipment Required</p>
                  <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                    <li>Step or bench: <strong>50.8 cm (20 inches)</strong> for adults; 40 cm for adolescents</li>
                    <li>Metronome or audio cadence set to <strong>120 beats/min</strong> (= 30 steps/min, 4 beats per cycle)</li>
                    <li>Stopwatch or timer</li>
                    <li>Heart rate monitor or pulse palpation capability</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-1">Administration Protocol</p>
                  <ol className="list-decimal list-inside text-slate-600 space-y-1">
                    <li>Explain and demonstrate the 4-count stepping cycle: <em>up-up-down-down</em> at the metronome pace</li>
                    <li>Client steps continuously for <strong>5 minutes</strong> or until they cannot maintain the cadence</li>
                    <li>Immediately on stopping, client <strong>sits down</strong></li>
                    <li>Measure pulse (30-second count × 2) at: <strong>1–2 min, 2–3 min, and 3–4 min</strong> post-exercise</li>
                    <li>Record the number of seconds the exercise was maintained (max 300 s)</li>
                  </ol>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-1">Scoring — Physical Fitness Index (PFI)</p>
                  <div className="bg-slate-50 border border-slate-200 rounded p-3 font-mono text-xs mb-2">
                    PFI = (Duration in seconds × 100) ÷ (2 × [HRâ‚ + HR₂ + HR₃])
                  </div>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full border border-slate-200 rounded">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="text-left px-2 py-1 border-b">PFI Score</th>
                          <th className="text-left px-2 py-1 border-b">Classification</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[['≥ 90','Excellent'],['80–89','Good'],['65–79','Average'],['55–64','Below Average'],['< 55','Poor']].map(([score, label]) => (
                          <tr key={score} className="border-b last:border-0">
                            <td className="px-2 py-1 font-semibold">{score}</td>
                            <td className="px-2 py-1">{label}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-1">Contraindications & Stopping Criteria</p>
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-3 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-red-700 space-y-1">
                      <p className="font-semibold">Absolute contraindications — do NOT perform if:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Acute cardiovascular event or unstable angina</li>
                        <li>Uncontrolled hypertension (resting SBP &gt; 180 or DBP &gt; 110 mmHg)</li>
                        <li>Acute musculoskeletal injury affecting lower limb function</li>
                        <li>Severe orthopaedic limitation preventing stepping</li>
                        <li>Resting SpO₂ &lt; 90%</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-slate-600 text-xs font-semibold mb-1">Stop the test immediately if the client experiences:</p>
                  <ul className="list-disc list-inside text-slate-600 text-xs space-y-0.5">
                    <li>Chest pain, tightness or pressure</li>
                    <li>Severe dyspnoea or inability to breathe adequately</li>
                    <li>Dizziness, pre-syncope, or pallor</li>
                    <li>Leg cramping or severe pain</li>
                    <li>Unable to maintain stepping cadence for ≥ 20 seconds</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-1">Clinician Tips</p>
                  <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                    <li>Ensure the client leads with the same leg throughout (alternating is acceptable if fatigued)</li>
                    <li>Full knee extension is required at the top of each step</li>
                    <li>Pulse counts should begin within 5 seconds of stopping exercise</li>
                    <li>Test-retest reliability is improved with consistent pacing and pulse measurement method</li>
                    <li>Consider using a 30-second pulse count (multiply × 2) to minimise measurement error</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-1">Psychometric Properties</p>
                  <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                    <li>Moderate correlation with VO₂max (r ≈ 0.60–0.75)</li>
                    <li>Test-retest reliability: ICC 0.79–0.89 in healthy adults</li>
                    <li>Validity limited in populations with abnormal HR response (e.g., beta-blockers, cardiac conditions)</li>
                  </ul>
                </div>

                <div className="space-y-1">
                   <p className="font-semibold text-slate-800 mb-1">References & Links</p>
                   <a href="https://www.physio-pedia.com/Harvard_Step_Test" target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                     <ExternalLink className="w-3 h-3" /> Physio-pedia — Harvard Step Test Overview
                   </a>
                   <a href="https://www.topendsports.com/testing/tests/step-harvard.htm" target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                     <ExternalLink className="w-3 h-3" /> Topend Sports — Protocol & Norms
                   </a>
                 </div>

              </div>
            )}
          </div>

          {/* Timer */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Test Timer (max 5 minutes)</h3>
            <div className="flex items-center gap-4">
              <div className="text-5xl font-bold text-blue-600 font-mono">
                {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toFixed(0).padStart(2, '0')}
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
                    setData({...data, duration_completed: timerSeconds.toString()});
                  }}
                  variant="secondary"
                  size="sm"
                  disabled={timerSeconds === 0}
                >
                  Use Duration
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
            {timerSeconds >= 300 && (
              <p className="mt-2 text-green-600 font-semibold">✓ 5 minutes complete!</p>
            )}
          </div>

          <div>
            <Label htmlFor="duration_completed">Duration Completed (seconds)</Label>
            <Input
              id="duration_completed"
              type="number"
              value={data.duration_completed}
              onChange={(e) => setData({...data, duration_completed: e.target.value})}
              className="mt-1 text-xl font-bold"
              placeholder="Total time exercised (max 300s)"
            />
          </div>

          {/* Recovery Heart Rates */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-3">Recovery Heart Rates (sit immediately after stopping)</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="hr_1min">1-2 min (bpm)</Label>
                <Input
                  id="hr_1min"
                  type="number"
                  value={data.hr_1min}
                  onChange={(e) => setData({...data, hr_1min: e.target.value})}
                  className="mt-1"
                  placeholder="Pulse count"
                />
              </div>
              <div>
                <Label htmlFor="hr_2min">2-3 min (bpm)</Label>
                <Input
                  id="hr_2min"
                  type="number"
                  value={data.hr_2min}
                  onChange={(e) => setData({...data, hr_2min: e.target.value})}
                  className="mt-1"
                  placeholder="Pulse count"
                />
              </div>
              <div>
                <Label htmlFor="hr_3min">3-4 min (bpm)</Label>
                <Input
                  id="hr_3min"
                  type="number"
                  value={data.hr_3min}
                  onChange={(e) => setData({...data, hr_3min: e.target.value})}
                  className="mt-1"
                  placeholder="Pulse count"
                />
              </div>
            </div>
          </div>

          {/* Calculated Fitness Index */}
          {calculateFitnessIndex() && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-300 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 mb-2">Harvard Fitness Index</h4>
              <p className="text-4xl font-bold text-purple-600">{calculateFitnessIndex()}</p>
              <p className="text-sm text-slate-600 mt-1">
                {(() => {
                  const fi = parseFloat(calculateFitnessIndex());
                  if (fi >= 90) return 'Excellent';
                  if (fi >= 80) return 'Good';
                  if (fi >= 65) return 'Average';
                  if (fi >= 55) return 'Below Average';
                  return 'Poor';
                })()}
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="reason_stopped">Reason Test Stopped</Label>
            <Input
              id="reason_stopped"
              value={data.reason_stopped}
              onChange={(e) => setData({...data, reason_stopped: e.target.value})}
              className="mt-1"
              placeholder="e.g., Completed 5 min, fatigue, dyspnea..."
            />
          </div>

          <div>
            <Label htmlFor="observations">Observations</Label>
            <Textarea
              id="observations"
              value={data.observations}
              onChange={(e) => setData({...data, observations: e.target.value})}
              className="mt-1"
              rows={2}
              placeholder="Stepping rhythm, fatigue, symptoms..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={!data.duration_completed}>
              <Save className="w-4 h-4 mr-2" />
              Save Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}