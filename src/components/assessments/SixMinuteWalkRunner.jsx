import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, RotateCcw, X, Save, AlertTriangle, CheckCircle2, Activity } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function SixMinuteWalkRunner({ onSave, onClose }) {
  const [phase, setPhase] = useState('pre'); // pre, running, post, recovery
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [shownEncouragements, setShownEncouragements] = useState([]);
  
  const [preTest, setPreTest] = useState({
    hr: '',
    bp_sys: '',
    bp_dia: '',
    spo2: '',
    rpe: ''
  });

  const [duringTest, setDuringTest] = useState({
    laps: '',
    currentDistance: 0,
    rests: []
  });

  const [postTest, setPostTest] = useState({
    total_distance: '',
    hr: '',
    spo2: '',
    rpe: '',
    dyspnea: ''
  });

  const [notes, setNotes] = useState('');
  const [terminationReason, setTerminationReason] = useState('');

  const encouragements = {
    60: "You are doing well. You have 5 minutes to go.",
    120: "Keep up the good work. You have 4 minutes to go.",
    180: "You are doing well. You are halfway.",
    240: "Keep up the good work. You have only 2 minutes left.",
    300: "You are doing well. You have only 1 minute to go.",
    360: "Please stop where you are."
  };

  // Timer effect
  useEffect(() => {
    let interval;
    if (isRunning && timerSeconds < 360) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          const newTime = prev + 1;
          
          // Show encouragement at each minute mark
          if (encouragements[newTime] && !shownEncouragements.includes(newTime)) {
            toast.info(encouragements[newTime], { duration: 5000 });
            setShownEncouragements(prev => [...prev, newTime]);
          }
          
          // Auto-stop at 6 minutes
          if (newTime >= 360) {
            setIsRunning(false);
            setPhase('post');
            toast.success("6 minutes complete! Please stop where you are.");
          }
          
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timerSeconds, shownEncouragements]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartTest = () => {
    setPhase('running');
    setIsRunning(true);
    toast.info("Test started! Timer is running.");
  };

  const handleAddRest = () => {
    const restTime = timerSeconds;
    const restData = {
      time: restTime,
      reason: '',
      hr: '',
      spo2: ''
    };
    setDuringTest(prev => ({
      ...prev,
      rests: [...prev.rests, restData]
    }));
    toast.info("Rest period recorded. Encourage client: 'Please resume walking whenever you feel able.'");
  };

  const handleUpdateRest = (index, field, value) => {
    setDuringTest(prev => ({
      ...prev,
      rests: prev.rests.map((rest, i) => 
        i === index ? { ...rest, [field]: value } : rest
      )
    }));
  };

  const handleTerminate = () => {
    setIsRunning(false);
    setPhase('post');
    toast.warning("Test terminated. Please record reason and post-test measurements.");
  };

  const handleCompleteTest = () => {
    // Build comprehensive SOAP text
    let soapText = `• Six-Minute Walk Test: ${postTest.total_distance}m (${formatTime(timerSeconds)})\n`;
    soapText += `  Pre-Test: HR ${preTest.hr} bpm, BP ${preTest.bp_sys}/${preTest.bp_dia}, SpO2 ${preTest.spo2}%, RPE ${preTest.rpe}\n`;
    soapText += `  Post-Test: HR ${postTest.hr} bpm, SpO2 ${postTest.spo2}%, RPE ${postTest.rpe}, Dyspnea ${postTest.dyspnea}/10\n`;
    if (duringTest.rests.length > 0) soapText += `  Rest Periods: ${duringTest.rests.length}\n`;
    if (terminationReason) soapText += `  Terminated: ${terminationReason}\n`;
    if (notes) soapText += `  Notes: ${notes}\n`;

    onSave({
      result_value: parseFloat(postTest.total_distance),
      additional_data: {
        soap_text: soapText,
        sixmwt_pre_hr: parseFloat(preTest.hr) || null,
        sixmwt_pre_bp_sys: parseFloat(preTest.bp_sys) || null,
        sixmwt_pre_bp_dia: parseFloat(preTest.bp_dia) || null,
        sixmwt_pre_spo2: parseFloat(preTest.spo2) || null,
        sixmwt_pre_rpe: parseFloat(preTest.rpe) || null,
        sixmwt_post_hr: parseFloat(postTest.hr) || null,
        sixmwt_post_spo2: parseFloat(postTest.spo2) || null,
        sixmwt_post_rpe: parseFloat(postTest.rpe) || null,
        sixmwt_post_dyspnea: parseFloat(postTest.dyspnea) || null,
        sixmwt_laps: parseFloat(duringTest.laps) || null,
        sixmwt_rest_periods: duringTest.rests.length,
        sixmwt_test_duration: timerSeconds,
        sixmwt_terminated: terminationReason ? true : false,
        sixmwt_termination_reason: terminationReason || null,
        sixmwt_rests_detail: duringTest.rests,
        measurement_type: '6mwt'
      },
      notes: notes,
      assessment_date: todayLocal()
    });
  };

  const standardizedInstructions = `"You are now going to do a 6 minute walk test. The object of this test is to walk as far as you can for six minutes so that you cover as much ground as possible.

You may slow down if necessary. If you stop, I want you to continue to walk again as soon as possible.

You will be regularly informed of the time and you will be encouraged to do your best. Your goal is to walk as far as possible in six minutes, but don't run or jog.

Please do not talk during the test unless you have a problem or I ask you a question. You must let me know if you have any chest pain or dizziness.

When the six minutes is up I will ask you to stop where you are. Do you have any questions?"`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">6 Minute Walk Test</h2>
              <p className="text-slate-600">Standardized Protocol</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Phase Indicator */}
          <div className="flex items-center gap-2 mb-6">
            <Badge variant={phase === 'pre' ? 'default' : 'outline'}>Pre-Test</Badge>
            <Badge variant={phase === 'running' ? 'default' : 'outline'}>During Test</Badge>
            <Badge variant={phase === 'post' ? 'default' : 'outline'}>Post-Test</Badge>
          </div>

          {/* PRE-TEST PHASE */}
          {phase === 'pre' && (
            <div className="space-y-6">
              {/* Standardized Instructions */}
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-lg">📋 Standardized Instructions (Read to Client)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-white p-4 rounded-lg border border-blue-300 whitespace-pre-wrap text-sm">
                    {standardizedInstructions}
                  </div>
                  <p className="text-sm text-blue-800 mt-3 font-semibold">
                    To begin: "Start walking now."
                  </p>
                </CardContent>
              </Card>

              {/* Pre-Test Measurements */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pre-Test Measurements (At Rest)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <Label>Heart Rate (bpm)</Label>
                      <Input
                        type="number"
                        value={preTest.hr}
                        onChange={(e) => setPreTest({...preTest, hr: e.target.value})}
                        placeholder="e.g., 72"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>BP Systolic</Label>
                      <Input
                        type="number"
                        value={preTest.bp_sys}
                        onChange={(e) => setPreTest({...preTest, bp_sys: e.target.value})}
                        placeholder="e.g., 120"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>BP Diastolic</Label>
                      <Input
                        type="number"
                        value={preTest.bp_dia}
                        onChange={(e) => setPreTest({...preTest, bp_dia: e.target.value})}
                        placeholder="e.g., 80"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>SpO2 (%)</Label>
                      <Input
                        type="number"
                        value={preTest.spo2}
                        onChange={(e) => setPreTest({...preTest, spo2: e.target.value})}
                        placeholder="e.g., 98"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>RPE (6-20)</Label>
                      <Input
                        type="number"
                        min="6"
                        max="20"
                        value={preTest.rpe}
                        onChange={(e) => setPreTest({...preTest, rpe: e.target.value})}
                        placeholder="6"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={handleStartTest}
                    className="w-full mt-6 bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start 6-Minute Walk Test
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* DURING TEST PHASE */}
          {phase === 'running' && (
            <div className="space-y-6">
              {/* Timer Display */}
              <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <CardContent className="py-8">
                  <div className="text-center">
                    <div className="text-7xl font-bold font-mono mb-2">
                      {formatTime(timerSeconds)}
                    </div>
                    <div className="text-xl">
                      {timerSeconds < 360 ? `${360 - timerSeconds} seconds remaining` : 'Test Complete!'}
                    </div>
                    <div className="flex justify-center gap-4 mt-6">
                      <Button
                        onClick={() => setIsRunning(!isRunning)}
                        variant={isRunning ? "destructive" : "secondary"}
                        size="lg"
                      >
                        {isRunning ? (
                          <>
                            <Pause className="w-5 h-5 mr-2" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-5 h-5 mr-2" />
                            Resume
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleTerminate}
                        variant="outline"
                        size="lg"
                        className="bg-white/10 hover:bg-white/20 text-white border-white/30"
                      >
                        <AlertTriangle className="w-5 h-5 mr-2" />
                        Terminate Test
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current Encouragement */}
              <Card className="bg-green-50 border-green-300">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <Activity className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-green-900 mb-2">Current Minute Encouragement:</h4>
                      <p className="text-green-800 italic">
                        {timerSeconds < 60 && "You are doing well. You have 5 minutes to go."}
                        {timerSeconds >= 60 && timerSeconds < 120 && "Keep up the good work. You have 4 minutes to go."}
                        {timerSeconds >= 120 && timerSeconds < 180 && "You are doing well. You are halfway."}
                        {timerSeconds >= 180 && timerSeconds < 240 && "Keep up the good work. You have only 2 minutes left."}
                        {timerSeconds >= 240 && timerSeconds < 300 && "You are doing well. You have only 1 minute to go."}
                        {timerSeconds >= 300 && timerSeconds < 360 && "Almost there! Less than 1 minute!"}
                        {timerSeconds >= 360 && "Please stop where you are."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Distance & Laps Tracking */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Laps Completed (30m track)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Input
                      type="number"
                      value={duringTest.laps}
                      onChange={(e) => {
                        const laps = parseFloat(e.target.value) || 0;
                        setDuringTest({
                          ...duringTest, 
                          laps: e.target.value,
                          currentDistance: laps * 30
                        });
                      }}
                      placeholder="Count laps..."
                      className="text-2xl font-bold text-center"
                    />
                    <p className="text-center text-sm text-slate-600 mt-2">
                      Current Distance: <span className="font-bold">{duringTest.currentDistance}m</span>
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Rest Periods</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={handleAddRest}
                      variant="outline"
                      className="w-full"
                    >
                      Record Rest Period
                    </Button>
                    <p className="text-center text-sm text-slate-600 mt-2">
                      Total Rests: <span className="font-bold">{duringTest.rests.length}</span>
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Rest Details */}
              {duringTest.rests.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Rest Period Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {duringTest.rests.map((rest, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-sm font-semibold mb-2">Rest #{idx + 1} at {formatTime(rest.time)}</p>
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            placeholder="Reason"
                            value={rest.reason}
                            onChange={(e) => handleUpdateRest(idx, 'reason', e.target.value)}
                            className="text-sm"
                          />
                          <Input
                            type="number"
                            placeholder="HR (bpm)"
                            value={rest.hr}
                            onChange={(e) => handleUpdateRest(idx, 'hr', e.target.value)}
                            className="text-sm"
                          />
                          <Input
                            type="number"
                            placeholder="SpO2 (%)"
                            value={rest.spo2}
                            onChange={(e) => handleUpdateRest(idx, 'spo2', e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* POST-TEST PHASE */}
          {phase === 'post' && (
            <div className="space-y-6">
              <Card className="bg-green-50 border-green-300">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    <div>
                      <h4 className="font-semibold text-green-900">Test Duration: {formatTime(timerSeconds)}</h4>
                      <p className="text-sm text-green-700">Record final measurements and total distance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Test Termination (if applicable) */}
              {timerSeconds < 360 && (
                <Card className="bg-amber-50 border-amber-300">
                  <CardHeader>
                    <CardTitle className="text-lg text-amber-900">Test Terminated Early</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Label>Reason for Termination</Label>
                    <Textarea
                      value={terminationReason}
                      onChange={(e) => setTerminationReason(e.target.value)}
                      placeholder="e.g., Chest pain, SpO2 <80%, severe dyspnea..."
                      rows={2}
                      className="mt-1"
                    />
                  </CardContent>
                </Card>
              )}

              {/* Final Distance */}
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-lg">Total Distance Walked</CardTitle>
                </CardHeader>
                <CardContent>
                  <Label>Distance (meters)</Label>
                  <Input
                    type="number"
                    value={postTest.total_distance}
                    onChange={(e) => setPostTest({...postTest, total_distance: e.target.value})}
                    placeholder="e.g., 450"
                    className="mt-1 text-3xl font-bold text-center"
                  />
                  {duringTest.currentDistance > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPostTest({...postTest, total_distance: duringTest.currentDistance.toString()})}
                      className="w-full mt-2"
                    >
                      Use Calculated Distance ({duringTest.currentDistance}m)
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Post-Test Measurements */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Post-Test Measurements (Immediately After)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label>Heart Rate (bpm)</Label>
                      <Input
                        type="number"
                        value={postTest.hr}
                        onChange={(e) => setPostTest({...postTest, hr: e.target.value})}
                        placeholder="e.g., 110"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>SpO2 (%)</Label>
                      <Input
                        type="number"
                        value={postTest.spo2}
                        onChange={(e) => setPostTest({...postTest, spo2: e.target.value})}
                        placeholder="e.g., 96"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>RPE (6-20)</Label>
                      <Input
                        type="number"
                        min="6"
                        max="20"
                        value={postTest.rpe}
                        onChange={(e) => setPostTest({...postTest, rpe: e.target.value})}
                        placeholder="e.g., 15"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Dyspnea (0-10)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        value={postTest.dyspnea}
                        onChange={(e) => setPostTest({...postTest, dyspnea: e.target.value})}
                        placeholder="e.g., 3"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Clinical Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observations, gait patterns, symptoms, recovery time, etc..."
                    rows={4}
                  />
                </CardContent>
              </Card>

              {/* Test Summary */}
              <Card className="bg-slate-100">
                <CardHeader>
                  <CardTitle className="text-lg">Test Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-slate-600">Test Duration:</p>
                      <p className="font-bold text-lg">{formatTime(timerSeconds)}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Total Distance:</p>
                      <p className="font-bold text-lg text-blue-600">{postTest.total_distance || '-'} meters</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Rest Periods:</p>
                      <p className="font-bold text-lg">{duringTest.rests.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Norms & Interpretation */}
              <Card className="bg-slate-50 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg">📊 Norms & Interpretation</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                  <p className="font-semibold text-slate-700">Healthy Adults (Enright & Sherrill, 1998 — predicted 6MWT distance):</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-slate-300 rounded">
                      <thead className="bg-slate-200">
                        <tr>
                          <th className="p-2 text-left">Population</th>
                          <th className="p-2 text-left">Predicted Distance</th>
                          <th className="p-2 text-left">MCID</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-slate-200"><td className="p-2">Healthy adults (general)</td><td className="p-2">400–700 m</td><td className="p-2">54 m</td></tr>
                        <tr className="border-t border-slate-200 bg-white"><td className="p-2">COPD</td><td className="p-2">~332 m (moderate)</td><td className="p-2">25–54 m</td></tr>
                        <tr className="border-t border-slate-200"><td className="p-2">Heart failure</td><td className="p-2">~300–400 m</td><td className="p-2">43 m</td></tr>
                        <tr className="border-t border-slate-200 bg-white"><td className="p-2">Older adults ≥70 yrs</td><td className="p-2">300–500 m</td><td className="p-2">50 m</td></tr>
                        <tr className="border-t border-slate-200"><td className="p-2">Pulmonary hypertension</td><td className="p-2">&lt;380 m = elevated mortality risk</td><td className="p-2">33–41 m</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500">SpO₂ drop ≥4% during test = clinically significant desaturation. Test termination indicated if SpO₂ &lt;80%, severe chest pain, or pallor/cyanosis.</p>
                </CardContent>
              </Card>

              {/* Reference */}
              <Card className="bg-slate-100 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">📖 Reference</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-600 space-y-1">
                  <p>ATS Committee on Proficiency Standards for Clinical Pulmonary Function Laboratories. (2002). ATS statement: Guidelines for the six-minute walk test. <em>American Journal of Respiratory and Critical Care Medicine, 166</em>(1), 111–117.</p>
                  <p>Enright PL & Sherrill DL. (1998). Reference equations for the six-minute walk in healthy adults. <em>American Journal of Respiratory and Critical Care Medicine, 158</em>(5), 1384–1387.</p>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleCompleteTest} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  <Save className="w-4 h-4 mr-2" />
                  Save 6MWT Results
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}