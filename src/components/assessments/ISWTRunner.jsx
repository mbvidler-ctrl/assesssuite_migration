import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, Play, Pause, Volume2, ExternalLink, Music } from 'lucide-react';

export default function ISWTRunner({ onSave, onClose, initialData }) {
  const audioContextRef = useRef(null);
  const timerRef = useRef(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [shuttlesCompleted, setShuttlesCompleted] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [reasonStopped, setReasonStopped] = useState(initialData?.reason_stopped || "");
  const [postHR, setPostHR] = useState(initialData?.post_hr || "");
  const [postSpO2, setPostSpO2] = useState(initialData?.post_spo2 || "");
  const [postRPE, setPostRPE] = useState(initialData?.post_rpe || "");
  const [postDyspnea, setPostDyspnea] = useState(initialData?.post_dyspnea || "");
  const [observations, setObservations] = useState(initialData?.observations || "");
  const [shuttleCount, setShuttleCount] = useState(0);
  const [levelStartTime, setLevelStartTime] = useState(null);

  const createBeep = (frequency = 1000, duration = 200) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);
  };

  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const levelData = LEVEL_SPEEDS[currentLevel - 1];
    if (!levelData) {
      setIsRunning(false);
      return;
    }

    // Time per shuttle in seconds (based on speed and 10m distance)
    const timePerShuttle = (10 / levelData.speed) * 3.6; // Convert km/h to m/s

    if (!levelStartTime) {
      setLevelStartTime(Date.now());
      createBeep(600, 100); // Start beep
      return;
    }

    timerRef.current = setInterval(() => {
      setShuttleCount(prev => {
        const nextCount = prev + 1;
        createBeep(1000, 150); // Shuttle turn beep
        
        // Check if level is complete
        if (nextCount >= levelData.shuttles) {
          // Triple beep for level complete
          setTimeout(() => createBeep(800, 150), 100);
          setTimeout(() => createBeep(800, 150), 250);
          setTimeout(() => createBeep(800, 150), 400);

          // Auto-advance to next level
          setTotalDistance(prev => prev + levelData.shuttles * 10);
          setShuttlesCompleted(prev => prev + levelData.shuttles);
          setShuttleCount(0);
          
          if (currentLevel < 12) {
            setCurrentLevel(prev => prev + 1);
            setLevelStartTime(null);
          } else {
            setIsRunning(false);
            clearInterval(timerRef.current);
          }
        }
        return nextCount;
      });
    }, timePerShuttle * 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, currentLevel, levelStartTime]);

  const LEVEL_SPEEDS = [
    { level: 1, speed: 1.8, shuttles: 3 },
    { level: 2, speed: 2.2, shuttles: 4 },
    { level: 3, speed: 2.5, shuttles: 5 },
    { level: 4, speed: 2.8, shuttles: 6 },
    { level: 5, speed: 3.1, shuttles: 7 },
    { level: 6, speed: 3.4, shuttles: 8 },
    { level: 7, speed: 3.7, shuttles: 9 },
    { level: 8, speed: 4.0, shuttles: 10 },
    { level: 9, speed: 4.3, shuttles: 11 },
    { level: 10, speed: 4.6, shuttles: 12 },
    { level: 11, speed: 4.9, shuttles: 13 },
    { level: 12, speed: 5.2, shuttles: 14 }
  ];

  const handleStop = () => {
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleSave = () => {
    onSave({
      levels_completed: currentLevel - 1,
      total_shuttles: shuttlesCompleted,
      total_distance: totalDistance,
      reason_stopped: reasonStopped,
      post_hr: postHR ? parseFloat(postHR) : null,
      post_spo2: postSpO2 ? parseFloat(postSpO2) : null,
      post_rpe: postRPE ? parseFloat(postRPE) : null,
      post_dyspnea: postDyspnea ? parseFloat(postDyspnea) : null,
      observations
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-xl font-bold">Incremental Shuttle Walk Test (ISWT)</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Multi-stage 10m shuttle test with increasing speed</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
           {/* Clinician Instructions */}
           <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
             <p className="font-semibold">📋 Administration Instructions (Singh et al. 1992)</p>
             <p><strong>Setup:</strong> 10m flat corridor marked with cones. Client walks (not runs) 10m shuttles at pace determined by audio beep. Speed increases each level. Test stops when client fails to reach the end-cone by the beep for 2 consecutive shuttles.</p>
             <p className="italic">"Walk up and down this 10m course, turning at each cone when you hear the beep. Try to keep pace with the beeps. If you need to, you may slow down, but continue as long as possible."</p>
             <p><strong>Record:</strong> Total distance covered (m). Measure SpO2, HR, RPE, and dyspnea immediately post-test.</p>
             <p><strong>Primary use:</strong> Chronic respiratory conditions (COPD, heart failure, ILD). Two ISWTs performed on same day (first = practice); best of two recorded.</p>
           </div>

           {/* Norms */}
           <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
             <p className="font-semibold text-slate-700">📊 Norms & MCID (ISWT distance in metres)</p>
             <div className="overflow-x-auto">
               <table className="w-full text-xs border border-slate-300 rounded">
                 <thead className="bg-slate-200"><tr><th className="p-2 text-left">Population</th><th className="p-2 text-left">Typical Range</th><th className="p-2 text-left">MCID</th></tr></thead>
                 <tbody>
                   <tr className="border-t"><td className="p-2">Healthy adults (30–60 yrs)</td><td className="p-2">400–600 m</td><td className="p-2">—</td></tr>
                   <tr className="border-t bg-white"><td className="p-2">Mild COPD (FEVâ‚ &gt;60%)</td><td className="p-2">300–450 m</td><td className="p-2">48 m</td></tr>
                   <tr className="border-t"><td className="p-2">Moderate COPD (FEVâ‚ 40–60%)</td><td className="p-2">150–300 m</td><td className="p-2">48 m</td></tr>
                   <tr className="border-t bg-white"><td className="p-2">Severe COPD (FEVâ‚ &lt;40%)</td><td className="p-2">&lt;150 m</td><td className="p-2">48 m</td></tr>
                 </tbody>
               </table>
             </div>
             <p className="text-xs text-slate-500">MCID: 48 m (Revill et al. 1999). VO2max estimate: VO2peak (mL/kg/min) = 4.19 + 0.025 × ISWT distance.</p>
           </div>

           {/* Reference */}
           <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
             <p className="font-semibold">📖 Reference</p>
             <p>Singh SJ et al. (1992). Development of a shuttle walking test of disability in patients with chronic airways obstruction. <em>Thorax, 47</em>(12), 1019–1024.</p>
             <p>Revill SM et al. (1999). The endurance shuttle walk: a new field test for the assessment of endurance capacity in chronic obstructive pulmonary disease. <em>Thorax, 54</em>(3), 213–222.</p>
           </div>

           <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
             <p className="text-sm text-blue-800">
               <strong>Protocol:</strong> Press "Start Test" and walk 10m shuttles at increasing speeds guided by audio beeps. Continue until unable to keep pace with the beeps or reaches symptom threshold, then press "Stop Test".
             </p>
           </div>

           {/* Audio & Video Resources */}
           <div className="space-y-3">
             <div className="grid grid-cols-2 gap-4">
               <a 
                 href="https://www.youtube.com/watch?v=69g77DVHb7w" 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg"
               >
                 <div className="flex items-center gap-3">
                   <Volume2 className="w-6 h-6" />
                   <div>
                     <p className="font-semibold">Official ISWT Audio</p>
                     <p className="text-xs opacity-90">Complete audio protocol</p>
                   </div>
                 </div>
                 <ExternalLink className="w-5 h-5" />
               </a>

               <a 
                 href="https://www.youtube.com/watch?v=DGQF-_Mlv48" 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg"
               >
                 <div className="flex items-center gap-3">
                   <ExternalLink className="w-6 h-6" />
                   <div>
                     <p className="font-semibold">How to Perform ISWT</p>
                     <p className="text-xs opacity-90">Demonstration video</p>
                   </div>
                 </div>
                 <ExternalLink className="w-5 h-5" />
               </a>
             </div>

             <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg">
               <div className="flex items-start gap-3">
                 <Music className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                 <div>
                   <p className="font-semibold text-green-900 mb-1">🔊 Built-in Audio Beeps</p>
                   <p className="text-sm text-green-800">This runner generates real-time audio beeps automatically during the test:</p>
                   <ul className="text-xs text-green-800 mt-2 space-y-1 ml-4 list-disc">
                     <li><strong>Triple beep (800 Hz):</strong> Signals level completion</li>
                   </ul>
                   <p className="text-xs text-green-700 mt-2 font-semibold">✓ Ensure browser volume is enabled and device volume is set appropriately.</p>
                 </div>
               </div>
             </div>
           </div>

          {/* Current Status */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-lg p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-slate-600">Current Level</p>
                <p className="text-4xl font-bold text-blue-600">{currentLevel}</p>
                <p className="text-xs text-slate-500">Speed: {LEVEL_SPEEDS[currentLevel - 1]?.speed} km/h</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Shuttles</p>
                <p className="text-4xl font-bold text-indigo-600">{shuttlesCompleted}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Distance</p>
                <p className="text-4xl font-bold text-purple-600">{totalDistance}m</p>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
               <Button
                 type="button"
                 onClick={() => {
                   setIsRunning(true);
                   setLevelStartTime(null);
                   setShuttleCount(0);
                 }}
                 disabled={isRunning || currentLevel > 12}
                 className="flex-1"
               >
                 <Play className="w-4 h-4 mr-2" />
                 {currentLevel === 1 ? 'Start Test' : 'Resume'}
               </Button>
               <Button
                 type="button"
                 onClick={handleStop}
                 disabled={!isRunning}
                 variant="destructive"
                 className="flex-1"
               >
                 <Pause className="w-4 h-4 mr-2" />
                 Stop Test
               </Button>
             </div>
          </div>

          {/* Reason for Stopping */}
          <div>
            <Label htmlFor="reason_stopped">Reason Test Stopped</Label>
            <Textarea
              id="reason_stopped"
              value={reasonStopped}
              onChange={(e) => setReasonStopped(e.target.value)}
              className="mt-1"
              rows={2}
              placeholder="e.g., Unable to keep pace, dyspnea, leg fatigue..."
            />
          </div>

          {/* Post-Test Vitals */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-3">Immediate Post-Test Measures</h3>
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="post_hr" className="text-xs">HR (bpm)</Label>
                <Input
                  id="post_hr"
                  type="number"
                  value={postHR}
                  onChange={(e) => setPostHR(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="post_spo2" className="text-xs">SpO2 (%)</Label>
                <Input
                  id="post_spo2"
                  type="number"
                  value={postSpO2}
                  onChange={(e) => setPostSpO2(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="post_rpe" className="text-xs">RPE (6-20)</Label>
                <Input
                  id="post_rpe"
                  type="number"
                  min="6"
                  max="20"
                  value={postRPE}
                  onChange={(e) => setPostRPE(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="post_dyspnea" className="text-xs">Dyspnea (0-10)</Label>
                <Input
                  id="post_dyspnea"
                  type="number"
                  min="0"
                  max="10"
                  value={postDyspnea}
                  onChange={(e) => setPostDyspnea(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="observations">Observations</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="mt-1"
              rows={2}
              placeholder="Gait pattern, breathing, symptoms during test..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={shuttlesCompleted === 0}>
              <Save className="w-4 h-4 mr-2" />
              Save ISWT Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}