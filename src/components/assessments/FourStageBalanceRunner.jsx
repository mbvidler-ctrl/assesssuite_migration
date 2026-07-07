import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { X, Save, Play, Pause, RotateCcw, AlertTriangle, CheckCircle2, ChevronRight, Printer } from "lucide-react";
import { toast } from "sonner";

const STAGES = [
  {
    id: "feet_together",
    number: 1,
    title: "Side-by-Side Stance",
    instruction: "Ask the client to stand with their feet together, side by side, so that the inner edges of both feet are touching.",
    clientCue: "\"Please stand with your feet together, touching side by side, and hold this position for 10 seconds.\"",
    icon: "👣",
    clinicianNote: "Assist the client into position if needed. Ensure they are not gripping a support. Begin timing once they are steady and you have released any assistance."
  },
  {
    id: "semi_tandem",
    number: 2,
    title: "Semi-Tandem Stance",
    instruction: "Ask the client to place the instep of one foot alongside the big toe of the other foot. Either foot may be in front.",
    clientCue: "\"Now place the side of your heel touching the big toe of your other foot, and hold this position for 10 seconds.\"",
    icon: "🦶",
    clinicianNote: "Ensure foot contact is at instep-to-big-toe. Either foot forward is acceptable. Begin timing once steady."
  },
  {
    id: "tandem",
    number: 3,
    title: "Tandem Stance",
    instruction: "Ask the client to place one foot directly in front of the other so the heel of the front foot touches the toes of the back foot (heel-to-toe).",
    clientCue: "\"Now place one foot directly in front of the other so your heel is touching your toes. Hold this position for 10 seconds.\"",
    icon: "🚶",
    clinicianNote: "⚠ This is the critical stage for fall risk assessment. If this stage is not held for 10 seconds, the client is considered at increased risk of falling. Ensure the heel-to-toe contact is maintained."
  },
  {
    id: "single_leg",
    number: 4,
    title: "Single Leg Stance",
    instruction: "Ask the client to lift one foot off the ground and balance on the other leg alone.",
    clientCue: "\"Finally, lift one foot off the ground and stand on one leg. Hold this for 10 seconds.\"",
    icon: "🦵",
    clinicianNote: "The client may choose which leg to use. They should not rest the raised foot against the standing leg. Only score if Stage 3 was passed."
  }
];

export default function FourStageBalanceRunner({ onSave, onClose }) {
  const [wizardStep, setWizardStep] = useState('intro'); // intro | stage | results
  const [currentStage, setCurrentStage] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState({ feet_together: null, semi_tandem: null, tandem: null, single_leg: null });
  const [times, setTimes] = useState({ feet_together: 0, semi_tandem: 0, tandem: 0, single_leg: 0 });
  const [stageNotes, setStageNotes] = useState({ feet_together: '', semi_tandem: '', tandem: '', single_leg: '' });
  const [clinicianNotes, setClinicianNotes] = useState('');
  const [manualSeconds, setManualSeconds] = useState({ feet_together: '', semi_tandem: '', tandem: '', single_leg: '' });
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          const next = parseFloat((prev + 0.1).toFixed(1));
          if (next >= 10) {
            setIsRunning(false);
            toast.success("10 seconds reached!");
            return 10;
          }
          return next;
        });
      }, 100);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const stageId = STAGES[currentStage]?.id;

  const handlePass = () => {
    const held = timerSeconds >= 10 ? timerSeconds : (manualSeconds[stageId] ? parseFloat(manualSeconds[stageId]) : timerSeconds);
    setResults(prev => ({ ...prev, [stageId]: 'pass' }));
    setTimes(prev => ({ ...prev, [stageId]: held }));
    setIsRunning(false);
    setTimerSeconds(0);
    toast.success(`Stage ${currentStage + 1} passed!`);
    setTimeout(() => {
      if (currentStage < STAGES.length - 1) {
        setCurrentStage(currentStage + 1);
      } else {
        setWizardStep('results');
      }
    }, 600);
  };

  const handleFail = () => {
    const held = timerSeconds > 0 ? timerSeconds : (manualSeconds[stageId] ? parseFloat(manualSeconds[stageId]) : 0);
    setResults(prev => ({ ...prev, [stageId]: 'fail' }));
    setTimes(prev => ({ ...prev, [stageId]: held }));
    setIsRunning(false);
    setTimerSeconds(0);
    toast.error("Stage failed — test stops here.");
    setTimeout(() => setWizardStep('results'), 600);
  };

  const calculateStageAchieved = () => {
    if (results.single_leg === 'pass') return 4;
    if (results.tandem === 'pass') return 3;
    if (results.semi_tandem === 'pass') return 2;
    if (results.feet_together === 'pass') return 1;
    return 0;
  };

  const fallRisk = results.tandem !== 'pass';
  const stageAchieved = calculateStageAchieved();

  const handleSave = () => {
    const soapText = [
      `• 4-Stage Balance Test`,
      `  Highest Stage Achieved: ${stageAchieved}/4`,
      `  Fall Risk: ${fallRisk ? 'Increased (tandem stance not held for 10s)' : 'Normal'}`,
      ...STAGES.map(s => results[s.id] ? `  Stage ${s.number} (${s.title}): ${results[s.id] === 'pass' ? `Pass (${times[s.id].toFixed(1)}s)` : `Fail (${times[s.id] > 0 ? times[s.id].toFixed(1) + 's' : '—'})`}` : null).filter(Boolean),
      clinicianNotes ? `  Notes: ${clinicianNotes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      status: 'completed',
      result_value: stageAchieved,
      notes: soapText,
      assessment_date: new Date().toISOString().split('T')[0],
      additional_data: {
        measurement_type: 'four_stage_balance_test',
        soap_text: soapText,
        fall_risk: fallRisk ? 'high' : 'low',
        stages: {
          side_by_side: { passed: results.feet_together === 'pass', time_seconds: times.feet_together || null },
          semi_tandem:  { passed: results.semi_tandem === 'pass',  time_seconds: times.semi_tandem || null },
          tandem:       { passed: results.tandem === 'pass',       time_seconds: times.tandem || null },
          single_leg:   { passed: results.single_leg === 'pass',   time_seconds: times.single_leg || null },
        },
        stage_notes: stageNotes,
        clinician_notes: clinicianNotes,
      }
    });
  };

  const handlePrint = () => window.print();

  // ── INTRO SCREEN ──────────────────────────────────────────────────────────
  if (wizardStep === 'intro') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">4-Stage Balance Test</h2>
              <p className="text-slate-500 text-sm mt-1">Step-by-step clinician-led assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>

          <div className="p-6 space-y-5">
            <Card className="bg-amber-50 border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="w-4 h-4" /> Safety — Read Before Starting
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-amber-800 space-y-1">
                <p>• Ensure the client is near a stable support (wall or sturdy chair) throughout.</p>
                <p>• Stand close to the client and be prepared to provide support at any time.</p>
                <p>• Do not proceed to the next stage if the client appears unsafe in the current position.</p>
                <p>• Stop the test immediately if the client feels dizzy, unsafe, or at risk of falling.</p>
                <p>• The client should not use an assistive device and should keep eyes open during each stage.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">How This Test Works</CardTitle></CardHeader>
              <CardContent className="text-sm text-slate-700 space-y-2">
                <p>This is a progressive standing balance assessment conducted in four stages of increasing difficulty. Each stage requires the client to hold a position for <strong>10 seconds</strong>.</p>
                <p>The test proceeds stage by stage. If the client cannot hold a stage for 10 seconds, the test stops and the highest stage achieved is recorded.</p>
                <p className="text-slate-500 italic text-xs">Clinical interpretation: Inability to hold Stage 3 (tandem stance) for 10 seconds indicates increased fall risk and warrants clinical follow-up.</p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {STAGES.map(s => (
                <div key={s.id} className="bg-slate-50 border rounded-lg p-3">
                  <div className="text-xl mb-1">{s.icon}</div>
                  <p className="font-semibold text-slate-700">Stage {s.number}</p>
                  <p className="text-slate-500">{s.title}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 border-t bg-slate-50 flex justify-between">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => setWizardStep('stage')} className="bg-blue-600 hover:bg-blue-700">
              Begin Assessment <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── STAGE SCREEN ──────────────────────────────────────────────────────────
  if (wizardStep === 'stage') {
    const stage = STAGES[currentStage];
    const alreadyDone = results[stageId] !== null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="p-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {STAGES.map((s, i) => (
                  <div key={s.id} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    i < currentStage ? 'bg-green-500 text-white' :
                    i === currentStage ? 'bg-blue-600 text-white' :
                    'bg-slate-200 text-slate-500'
                  }`}>{i + 1}</div>
                ))}
              </div>
              <h2 className="text-xl font-bold text-slate-900">Stage {stage.number}: {stage.title}</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Instructions */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Clinician Action</p>
                  <p className="text-sm text-blue-900">{stage.instruction}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Say to Client</p>
                  <p className="text-sm text-blue-900 italic">{stage.clientCue}</p>
                </div>
                {stage.clinicianNote && (
                  <div className={`text-xs rounded p-2 ${stage.number === 3 ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                    {stage.clinicianNote}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timer */}
            <Card className="border-2 border-slate-200">
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-7xl font-bold font-mono mb-2" style={{ color: timerSeconds >= 10 ? '#10b981' : '#3b82f6' }}>
                    {timerSeconds.toFixed(1)}<span className="text-3xl">s</span>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">
                    {timerSeconds >= 10 ? '✓ 10 seconds reached — record Pass or Fail below' : `${(10 - timerSeconds).toFixed(1)}s remaining`}
                  </p>
                  <div className="flex justify-center gap-3">
                    <Button
                      onClick={() => setIsRunning(!isRunning)}
                      variant={isRunning ? "destructive" : "default"}
                      size="lg"
                      disabled={alreadyDone}
                    >
                      {isRunning ? <><Pause className="w-5 h-5 mr-2" />Stop Timer</> : <><Play className="w-5 h-5 mr-2" />{timerSeconds > 0 ? 'Resume' : 'Start Timer'}</>}
                    </Button>
                    <Button onClick={() => { setIsRunning(false); setTimerSeconds(0); }} variant="outline" size="lg" disabled={isRunning || alreadyDone}>
                      <RotateCcw className="w-4 h-4 mr-2" />Reset
                    </Button>
                    {alreadyDone && (
                      <Button onClick={() => { setResults(prev => ({ ...prev, [stageId]: null })); setTimes(prev => ({ ...prev, [stageId]: 0 })); setTimerSeconds(0); setManualSeconds(prev => ({ ...prev, [stageId]: '' })); }} variant="secondary" size="lg">
                        <RotateCcw className="w-4 h-4 mr-2" />Redo
                      </Button>
                    )}
                  </div>
                </div>

                {/* Manual override */}
                <div className="mt-4 pt-4 border-t">
                  <Label className="text-xs text-slate-500">Or enter seconds held manually (if timer not used)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={manualSeconds[stageId]}
                    onChange={e => setManualSeconds(prev => ({ ...prev, [stageId]: e.target.value }))}
                    placeholder="e.g. 7.5"
                    className="mt-1 w-32"
                    disabled={alreadyDone}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pass / Fail */}
            {!alreadyDone && (
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={handlePass} className="bg-green-600 hover:bg-green-700 h-14 text-base" disabled={timerSeconds === 0 && !manualSeconds[stageId]}>
                  <CheckCircle2 className="w-5 h-5 mr-2" />Pass — Held 10s
                </Button>
                <Button onClick={handleFail} variant="destructive" className="h-14 text-base" disabled={timerSeconds === 0 && !manualSeconds[stageId]}>
                  <X className="w-5 h-5 mr-2" />Could Not Hold 10s
                </Button>
              </div>
            )}

            {alreadyDone && (
              <div className={`rounded-lg p-4 text-center font-semibold ${results[stageId] === 'pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {results[stageId] === 'pass' ? `✓ Stage ${stage.number} Passed (${times[stageId].toFixed(1)}s)` : `✗ Stage ${stage.number} Failed — Test Stopped`}
              </div>
            )}

            {/* Stage notes */}
            <div>
              <Label className="text-sm">Stage Notes (optional)</Label>
              <Textarea
                value={stageNotes[stageId]}
                onChange={e => setStageNotes(prev => ({ ...prev, [stageId]: e.target.value }))}
                placeholder="Observations for this stage..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>

          <div className="p-4 border-t bg-slate-50 flex justify-between">
            <Button variant="outline" onClick={() => currentStage > 0 ? setCurrentStage(currentStage - 1) : setWizardStep('intro')}>Back</Button>
            <div className="flex gap-2">
              {alreadyDone && results[stageId] === 'pass' && currentStage < STAGES.length - 1 && (
                <Button onClick={() => setCurrentStage(currentStage + 1)} className="bg-blue-600 hover:bg-blue-700">
                  Next Stage <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
              {alreadyDone && (
                <Button onClick={() => setWizardStep('results')} className="bg-blue-600 hover:bg-blue-700">
                  {results[stageId] === 'fail' ? 'View Results' : 'Continue'} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS SCREEN ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-slate-900">4-Stage Balance Test — Results</h2>
            <p className="text-sm text-slate-500">{new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 mr-1" />Print</Button>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Highest stage achieved */}
          <div className="text-center py-4 border rounded-xl bg-slate-50">
            <p className="text-sm text-slate-500 mb-1">Highest Stage Achieved</p>
            <p className="text-6xl font-bold text-slate-900">{stageAchieved}<span className="text-2xl text-slate-400">/4</span></p>
          </div>

          {/* Fall Risk */}
          <Card className={`border-2 ${fallRisk ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
            <CardContent className="pt-4">
              {fallRisk ? (
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-900 text-lg">Increased Fall Risk Identified</p>
                    <p className="text-sm text-red-800 mt-1">
                      The client was unable to hold the tandem stance (Stage 3) for 10 seconds. This is a clinically significant finding associated with increased fall risk. Consider referral to balance or fall prevention program, gait retraining, or further physiotherapy assessment.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-green-900 text-lg">No Increased Fall Risk Detected</p>
                    <p className="text-sm text-green-800 mt-1">Client held the tandem stance for 10 seconds. Balance is within functional limits for this assessment.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Per-stage results */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Stage-by-Stage Results</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {STAGES.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{s.icon}</span>
                      <div>
                        <p className="text-sm font-medium">Stage {s.number}: {s.title}</p>
                        {stageNotes[s.id] && <p className="text-xs text-slate-500">{stageNotes[s.id]}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {results[s.id] === 'pass' && <span className="text-slate-600">{times[s.id].toFixed(1)}s</span>}
                      {results[s.id] === 'pass' && <Badge className="bg-green-600">Pass</Badge>}
                      {results[s.id] === 'fail' && <span className="text-slate-600">{times[s.id] > 0 ? `${times[s.id].toFixed(1)}s` : '—'}</span>}
                      {results[s.id] === 'fail' && <Badge variant="destructive">Fail</Badge>}
                      {results[s.id] === null && <Badge variant="outline" className="text-slate-400">Not tested</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Clinician notes */}
          <div>
            <Label>Overall Clinician Notes</Label>
            <Textarea
              value={clinicianNotes}
              onChange={e => setClinicianNotes(e.target.value)}
              placeholder="Overall observations, client behaviour, clinical recommendations..."
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Source citation */}
          <div className="text-xs text-slate-400 border rounded p-3 bg-slate-50">
            <p><strong>Source citation:</strong> CDC STEADI – 4-Stage Balance Test (Centers for Disease Control and Prevention, Stopping Elderly Accidents, Deaths &amp; Injuries initiative). This clinical interface uses original wording and does not reproduce CDC/STEADI materials or imply endorsement. Test adapted for independent clinical use.</p>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
           <Button variant="outline" onClick={() => setWizardStep('stage')}>Back to Test</Button>
           <div className="flex gap-2">
             <Button variant="outline" onClick={() => { setCurrentStage(0); setResults({ feet_together: null, semi_tandem: null, tandem: null, single_leg: null }); setTimes({ feet_together: 0, semi_tandem: 0, tandem: 0, single_leg: 0 }); setStageNotes({ feet_together: '', semi_tandem: '', tandem: '', single_leg: '' }); setWizardStep('stage'); }}>
               <RotateCcw className="w-4 h-4 mr-2" />Restart Test
             </Button>
             <Button onClick={handleSave} disabled={stageAchieved === 0} className="bg-blue-600 hover:bg-blue-700">
               <Save className="w-4 h-4 mr-2" />Save Results
             </Button>
           </div>
         </div>
      </div>
    </div>
  );
}