import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Save, Play, Pause, RotateCcw, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { differenceInYears } from "date-fns";

export default function EbbelingTestRunner({ client, onSave, onClose }) {
  // Client demographics
  const clientAge = client?.date_of_birth 
    ? differenceInYears(new Date(), new Date(client.date_of_birth)) 
    : 40;
  const clientGender = client?.gender === 'male' ? 1 : 0;

  // Test phases
  const [currentPhase, setCurrentPhase] = useState('setup'); // setup, warmup, test, complete
  
  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  
  // Setup data
  const [age, setAge] = useState(clientAge.toString());
  const [gender, setGender] = useState(client?.gender === 'male' ? 'male' : 'female');
  const [restingHR, setRestingHR] = useState('');
  
  // Calculated HR zones
  const [hrMax, setHrMax] = useState(0);
  const [hrTarget50, setHrTarget50] = useState(0);
  const [hrTarget70, setHrTarget70] = useState(0);
  
  // Warmup data
  const [warmupSpeed, setWarmupSpeed] = useState('');
  const [warmupSpeedUnit, setWarmupSpeedUnit] = useState('mph');
  
  // Test phase data - HR readings every minute
  const [testHRReadings, setTestHRReadings] = useState({
    min1: { hr: '', rpe: '' },
    min2: { hr: '', rpe: '' },
    min3: { hr: '', rpe: '' },
    min4: { hr: '', rpe: '' }
  });
  
  // Final results
  const [steadyStateHR, setSteadyStateHR] = useState('');
  const [calculatedVO2max, setCalculatedVO2max] = useState(null);
  const [notes, setNotes] = useState('');

  // Timer effect
  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  // Calculate HR zones when age changes
  useEffect(() => {
    const ageNum = parseInt(age) || 40;
    const max = 220 - ageNum;
    setHrMax(max);
    setHrTarget50(Math.round(max * 0.5));
    setHrTarget70(Math.round(max * 0.7));
  }, [age]);

  // Calculate VO2max using Ebbeling equation
  const calculateVO2max = () => {
    const speedMph = warmupSpeedUnit === 'kph' 
      ? parseFloat(warmupSpeed) * 0.621371 
      : parseFloat(warmupSpeed);
    const hr = parseFloat(steadyStateHR);
    const ageNum = parseInt(age);
    const genderVal = gender === 'male' ? 1 : 0;

    if (!speedMph || !hr || !ageNum) return null;

    // Ebbeling equation
    const vo2max = 15.1 + (21.8 * speedMph) - (0.327 * hr) - (0.263 * speedMph * ageNum) + (0.00504 * hr * ageNum) + (5.98 * genderVal);
    
    return Math.round(vo2max * 10) / 10;
  };

  // Calculate steady state HR from minute 3 and 4 readings
  useEffect(() => {
    const hr3 = parseFloat(testHRReadings.min3.hr);
    const hr4 = parseFloat(testHRReadings.min4.hr);
    if (hr3 && hr4) {
      const avg = Math.round((hr3 + hr4) / 2);
      setSteadyStateHR(avg.toString());
    }
  }, [testHRReadings.min3.hr, testHRReadings.min4.hr]);

  // Calculate VO2max when steady state HR is available
  useEffect(() => {
    if (steadyStateHR && warmupSpeed) {
      const result = calculateVO2max();
      setCalculatedVO2max(result);
    }
  }, [steadyStateHR, warmupSpeed, age, gender]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSave = () => {
    const interpretation = getVO2maxInterpretation(calculatedVO2max, age, gender);

    let soapText = `â€¢ Ebbeling Single-Stage Treadmill Test:\n`;
    soapText += `  Result: ${calculatedVO2max} ml/kg/min (estimated VO2max)`;
    if (interpretation) soapText += ` â€” ${interpretation.label}`;
    soapText += `\n`;
    soapText += `  Age: ${age} | Gender: ${gender}\n`;
    if (restingHR) soapText += `  Resting HR: ${restingHR} bpm\n`;
    soapText += `  HR Max: ${hrMax} bpm | Target Zone: ${hrTarget50}â€“${hrTarget70} bpm\n`;
    soapText += `  Walking Speed: ${warmupSpeed} ${warmupSpeedUnit} @ 5% grade\n`;
    soapText += `  Minute-by-Minute HR & RPE:\n`;
    ['min1', 'min2', 'min3', 'min4'].forEach((key, i) => {
      const reading = testHRReadings[key];
      const hrStr = reading.hr ? `HR: ${reading.hr} bpm` : 'HR: â€”';
      const rpeStr = reading.rpe ? `RPE: ${reading.rpe}` : 'RPE: â€”';
      soapText += `    Min ${i + 1}: ${hrStr}, ${rpeStr}\n`;
    });
    soapText += `  Steady-State HR (avg Min 3 & 4): ${steadyStateHR} bpm\n`;
    soapText += `  Calculated VO2max: ${calculatedVO2max} ml/kg/min\n`;
    if (notes) soapText += `  Notes: ${notes}\n`;

    const data = {
      result_value: calculatedVO2max,
      additional_data: {
        soap_text: soapText,
        measurement_type: 'ebbeling_sst',
        age: parseInt(age),
        gender,
        resting_hr: parseFloat(restingHR) || null,
        hr_max: hrMax,
        hr_target_50: hrTarget50,
        hr_target_70: hrTarget70,
        warmup_speed: parseFloat(warmupSpeed),
        warmup_speed_unit: warmupSpeedUnit,
        speed_mph: warmupSpeedUnit === 'kph' 
          ? parseFloat(warmupSpeed) * 0.621371 
          : parseFloat(warmupSpeed),
        test_hr_readings: {
          min1: { hr: testHRReadings.min1.hr, rpe: testHRReadings.min1.rpe },
          min2: { hr: testHRReadings.min2.hr, rpe: testHRReadings.min2.rpe },
          min3: { hr: testHRReadings.min3.hr, rpe: testHRReadings.min3.rpe },
          min4: { hr: testHRReadings.min4.hr, rpe: testHRReadings.min4.rpe },
        },
        steady_state_hr: parseFloat(steadyStateHR),
        calculated_vo2max: calculatedVO2max
      },
      notes
    };
    onSave(data);
  };

  const updateHRReading = (minute, field, value) => {
    setTestHRReadings(prev => ({
      ...prev,
      [minute]: { ...prev[minute], [field]: value }
    }));
  };

  const getVO2maxInterpretation = (vo2max, age, gender) => {
    if (!vo2max) return null;
    
    // Simplified interpretation based on ACSM guidelines
    const maleNorms = {
      20: { poor: 38, fair: 42, good: 51, excellent: 55 },
      30: { poor: 35, fair: 39, good: 48, excellent: 52 },
      40: { poor: 32, fair: 36, good: 45, excellent: 49 },
      50: { poor: 28, fair: 32, good: 41, excellent: 45 },
      60: { poor: 24, fair: 28, good: 37, excellent: 41 }
    };
    const femaleNorms = {
      20: { poor: 30, fair: 34, good: 42, excellent: 46 },
      30: { poor: 27, fair: 31, good: 39, excellent: 43 },
      40: { poor: 24, fair: 28, good: 36, excellent: 40 },
      50: { poor: 21, fair: 25, good: 33, excellent: 37 },
      60: { poor: 18, fair: 22, good: 30, excellent: 34 }
    };

    const ageGroup = Math.min(60, Math.max(20, Math.floor(parseInt(age) / 10) * 10));
    const norms = gender === 'male' ? maleNorms[ageGroup] : femaleNorms[ageGroup];

    if (vo2max >= norms.excellent) return { label: 'Excellent', color: 'bg-green-100 text-green-800' };
    if (vo2max >= norms.good) return { label: 'Good', color: 'bg-blue-100 text-blue-800' };
    if (vo2max >= norms.fair) return { label: 'Fair', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Below Average', color: 'bg-red-100 text-red-800' };
  };

  const renderSetupPhase = () => (
    <div className="space-y-6">
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">Pre-Test Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Age (years)</Label>
              <Input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Resting Heart Rate (bpm) - Optional</Label>
            <Input
              type="number"
              value={restingHR}
              onChange={(e) => setRestingHR(e.target.value)}
              className="mt-1"
              placeholder="e.g., 72"
            />
          </div>
        </CardContent>
      </Card>

      {/* Calculated HR Zones */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-900">Target Heart Rate Zones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-white rounded-lg">
              <p className="text-sm text-slate-600">HR Max</p>
              <p className="text-2xl font-bold text-slate-900">{hrMax} bpm</p>
            </div>
            <div className="p-3 bg-white rounded-lg border-2 border-green-300">
              <p className="text-sm text-green-700">50% HR Max</p>
              <p className="text-2xl font-bold text-green-600">{hrTarget50} bpm</p>
            </div>
            <div className="p-3 bg-white rounded-lg border-2 border-orange-300">
              <p className="text-sm text-orange-700">70% HR Max</p>
              <p className="text-2xl font-bold text-orange-600">{hrTarget70} bpm</p>
            </div>
          </div>
          <p className="text-sm text-green-800 mt-3 text-center">
            Client should reach steady-state HR between {hrTarget50}-{hrTarget70} bpm during the test
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => setCurrentPhase('warmup')} className="bg-blue-600 hover:bg-blue-700">
          Begin 4-Minute Warm-Up
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderWarmupPhase = () => (
    <div className="space-y-6">
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="text-yellow-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Warm-Up Phase (4 minutes @ 0% grade)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Timer */}
          <div className="flex items-center justify-center gap-6 p-4 bg-white rounded-lg">
            <div className="text-5xl font-bold font-mono text-blue-600">
              {formatTime(timerSeconds)}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => setTimerRunning(!timerRunning)}
                variant={timerRunning ? "destructive" : "default"}
              >
                {timerRunning ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                {timerRunning ? 'Pause' : 'Start'}
              </Button>
              <Button
                onClick={() => {
                  setTimerRunning(false);
                  setTimerSeconds(0);
                }}
                variant="outline"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
            </div>
          </div>

          {timerSeconds >= 240 && (
            <div className="p-3 bg-green-100 border border-green-300 rounded-lg text-center">
              <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <p className="text-green-800 font-semibold">4 minutes complete! Record the walking speed.</p>
            </div>
          )}

          <div className="p-4 bg-white rounded-lg">
            <p className="text-sm text-slate-600 mb-3">
              Determine client's comfortable walking speed (2.0-4.5 mph / 3.2-7.2 kph). 
              This speed will be maintained throughout the test.
            </p>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label>Walking Speed</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={warmupSpeed}
                  onChange={(e) => setWarmupSpeed(e.target.value)}
                  className="mt-1"
                  placeholder="Enter speed"
                />
              </div>
              <div className="w-24">
                <Label>Unit</Label>
                <Select value={warmupSpeedUnit} onValueChange={setWarmupSpeedUnit}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mph">mph</SelectItem>
                    <SelectItem value="kph">kph</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target HR reminder */}
      <div className="p-3 bg-slate-100 rounded-lg text-center">
        <p className="text-sm text-slate-700">
          Target HR Zone: <span className="font-bold text-green-600">{hrTarget50}</span> - <span className="font-bold text-orange-600">{hrTarget70}</span> bpm
        </p>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentPhase('setup')}>
          Back to Setup
        </Button>
        <Button 
          onClick={() => {
            setTimerRunning(false);
            setTimerSeconds(0);
            setCurrentPhase('test');
          }}
          disabled={!warmupSpeed}
          className="bg-green-600 hover:bg-green-700"
        >
          Begin Test Phase (5% Grade)
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderTestPhase = () => (
    <div className="space-y-6">
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-900 flex items-center gap-2">
            Test Phase (4 minutes @ 5% grade, speed: {warmupSpeed} {warmupSpeedUnit})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Timer */}
          <div className="flex items-center justify-center gap-6 p-4 bg-white rounded-lg">
            <div className="text-5xl font-bold font-mono text-red-600">
              {formatTime(timerSeconds)}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => setTimerRunning(!timerRunning)}
                variant={timerRunning ? "destructive" : "default"}
              >
                {timerRunning ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                {timerRunning ? 'Pause' : 'Start'}
              </Button>
              <Button
                onClick={() => {
                  setTimerRunning(false);
                  setTimerSeconds(0);
                }}
                variant="outline"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
            </div>
          </div>

          {/* Current minute indicator */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4].map(min => (
              <Badge
                key={min}
                className={`${
                  timerSeconds >= (min - 1) * 60 && timerSeconds < min * 60
                    ? 'bg-red-600 text-white'
                    : timerSeconds >= min * 60
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                Min {min}
              </Badge>
            ))}
          </div>

          {/* HR and RPE readings for each minute */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: 'min1', label: 'Minute 1', bg: 'bg-slate-50' },
              { key: 'min2', label: 'Minute 2', bg: 'bg-slate-50' },
              { key: 'min3', label: 'Minute 3 *', bg: 'bg-green-50 border-green-300' },
              { key: 'min4', label: 'Minute 4 *', bg: 'bg-green-50 border-green-300' }
            ].map((minute) => (
              <div key={minute.key} className={`p-3 rounded-lg border ${minute.bg}`}>
                <p className="font-semibold text-sm mb-2">{minute.label}</p>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">HR (bpm)</Label>
                    <Input
                      type="number"
                      value={testHRReadings[minute.key].hr}
                      onChange={(e) => updateHRReading(minute.key, 'hr', e.target.value)}
                      className="h-8 text-sm"
                      placeholder="HR"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">RPE (6-20)</Label>
                    <Input
                      type="number"
                      min="6"
                      max="20"
                      value={testHRReadings[minute.key].rpe}
                      onChange={(e) => updateHRReading(minute.key, 'rpe', e.target.value)}
                      className="h-8 text-sm"
                      placeholder="RPE"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 text-center">
            * Steady-state HR is calculated from the average of minutes 3 and 4
          </p>
        </CardContent>
      </Card>

      {/* Target HR reminder */}
      <div className="p-3 bg-slate-100 rounded-lg text-center">
        <p className="text-sm text-slate-700">
          Target HR Zone: <span className="font-bold text-green-600">{hrTarget50}</span> - <span className="font-bold text-orange-600">{hrTarget70}</span> bpm
        </p>
      </div>

      {/* Steady State HR Display */}
      {steadyStateHR && (
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="py-4">
            <div className="text-center">
              <p className="text-sm text-purple-700">Steady-State Heart Rate (Avg of Min 3 & 4)</p>
              <p className="text-4xl font-bold text-purple-600">{steadyStateHR} bpm</p>
              {parseFloat(steadyStateHR) < hrTarget50 && (
                <p className="text-xs text-yellow-600 mt-1">âš ï¸ Below target range - consider increasing speed</p>
              )}
              {parseFloat(steadyStateHR) > hrTarget70 && (
                <p className="text-xs text-yellow-600 mt-1">âš ï¸ Above target range - consider decreasing speed</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentPhase('warmup')}>
          Back to Warm-Up
        </Button>
        <Button 
          onClick={() => setCurrentPhase('complete')}
          disabled={!steadyStateHR}
          className="bg-green-600 hover:bg-green-700"
        >
          Calculate Results
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderCompletePhase = () => {
    const interpretation = getVO2maxInterpretation(calculatedVO2max, age, gender);
    
    return (
      <div className="space-y-6">
        <Card className="border-green-300 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-900 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6" />
              Test Complete - Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Main Result */}
            <div className="text-center p-6 bg-white rounded-lg">
              <p className="text-sm text-slate-600 mb-1">Estimated VO2max</p>
              <p className="text-5xl font-bold text-blue-600">{calculatedVO2max}</p>
              <p className="text-lg text-slate-700">ml/kg/min</p>
              {interpretation && (
                <Badge className={`mt-3 ${interpretation.color}`}>
                  {interpretation.label} for {gender}, age {age}
                </Badge>
              )}
            </div>

            {/* Test Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-white rounded-lg">
                <p className="text-xs text-slate-500">Walking Speed</p>
                <p className="font-semibold">{warmupSpeed} {warmupSpeedUnit}</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-xs text-slate-500">Steady-State HR</p>
                <p className="font-semibold">{steadyStateHR} bpm</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-xs text-slate-500">HR Max</p>
                <p className="font-semibold">{hrMax} bpm</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-xs text-slate-500">% HR Max Achieved</p>
                <p className="font-semibold">{Math.round((parseFloat(steadyStateHR) / hrMax) * 100)}%</p>
              </div>
            </div>

            {/* HR Readings Summary */}
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-slate-500 mb-2">Heart Rate Readings During Test</p>
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                {Object.entries(testHRReadings).map(([key, data]) => (
                  <div key={key}>
                    <p className="text-slate-500 capitalize">{key.replace('min', 'Min ')}</p>
                    <p className="font-semibold">{data.hr || '-'} bpm</p>
                    {data.rpe && <p className="text-xs text-slate-400">RPE: {data.rpe}</p>}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <div>
          <Label>Notes / Observations</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1"
            placeholder="Any observations during the test..."
            rows={3}
          />
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setCurrentPhase('test')}>
            Back to Test
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Save Results
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Ebbeling Single-Stage Treadmill Test</h2>
              <p className="text-slate-600 mt-1">Client: {client?.full_name}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Phase Indicator */}
          <div className="flex justify-between mt-4">
            {['setup', 'warmup', 'test', 'complete'].map((phase, index) => (
              <div key={phase} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  currentPhase === phase 
                    ? 'bg-blue-600 text-white' 
                    : ['setup', 'warmup', 'test', 'complete'].indexOf(currentPhase) > index
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {index + 1}
                </div>
                <span className={`ml-2 text-xs hidden md:block ${currentPhase === phase ? 'font-semibold' : ''}`}>
                  {phase === 'setup' ? 'Setup' : phase === 'warmup' ? 'Warm-Up' : phase === 'test' ? 'Test' : 'Results'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {currentPhase === 'setup' && renderSetupPhase()}
          {currentPhase === 'warmup' && renderWarmupPhase()}
          {currentPhase === 'test' && renderTestPhase()}
          {currentPhase === 'complete' && renderCompletePhase()}
        </div>
      </div>
    </div>
  );
}