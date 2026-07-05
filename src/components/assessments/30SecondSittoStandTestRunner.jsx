import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, Pause, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function ThirtySecondSittoStandTestRunner({ client, onSave, onClose }) {
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [standCount, setStandCount] = useState(0);
  const [handsUsed, setHandsUsed] = useState(false);
  const [notes, setNotes] = useState("");
  const [preHR, setPreHR] = useState("");
  const [postHR, setPostHR] = useState("");
  const [symptoms, setSymptoms] = useState("");

  useEffect(() => {
    let timer;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      toast.success("Test completed.");
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  const handleStart = () => {
    if (!preHR || isNaN(preHR) || preHR <= 0) {
      toast.error("Please enter a valid pre-test heart rate.");
      return;
    }
    setIsRunning(true);
    setTimeLeft(30);
    setStandCount(0);
    setHandsUsed(false);
    setNotes("");
    setPostHR("");
    setSymptoms("");
    toast.info("Test started. Please follow the instructions.");
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleResume = () => {
    setIsRunning(true);
  };

  const handleStand = () => {
    if (isRunning) {
      setStandCount((prevCount) => prevCount + 1);
    }
  };

  const handleHandsUse = () => {
    setHandsUsed(true);
  };

  const handleSave = () => {
    onSave({
      status: "completed",
      result_value: standCount,
      additional_data: {
        soap_text: `• 30-Second Sit-to-Stand Test\n  Repetitions: ${standCount}\n  Hands Used: ${handsUsed ? 'Yes' : 'No'}\n  Pre HR: ${preHR || 'N/A'} bpm | Post HR: ${postHR || 'N/A'} bpm${symptoms ? `\n  Symptoms: ${symptoms}` : ''}`,
        measurement_type: "30-second sit-to-stand test",
        hands_used: handsUsed,
        pre_heart_rate: preHR,
        post_heart_rate: postHR,
        symptoms: symptoms,
      },
      notes: notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Assessment saved successfully.");
  };

  const isTestComplete = timeLeft === 0 && !isRunning;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">30-Second Sit-to-Stand Test</h2>
            <p className="text-sm text-blue-100">Client: {client.name}</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            className="text-white hover:bg-blue-800"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Test Status */}
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-5xl font-bold text-blue-600 mb-2">{timeLeft}s</div>
                  <p className="text-sm text-slate-600">Time Remaining</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-emerald-600 mb-2">{standCount}</div>
                  <p className="text-sm text-slate-600">Completed Stands</p>
                  {handsUsed && (
                    <Badge variant="outline" className="mt-2 bg-orange-50 text-orange-700 border-orange-300">
                      Hands Used
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {!isRunning && !isTestComplete && (
                    <Button 
                      onClick={handleStart} 
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      disabled={!preHR || isNaN(preHR) || preHR <= 0}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Test
                    </Button>
                  )}
                  {isRunning && (
                    <Button 
                      onClick={handlePause} 
                      variant="outline"
                      className="flex-1"
                    >
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </Button>
                  )}
                  {isRunning && (
                    <Button 
                      onClick={handleStand}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      +1 Stand
                    </Button>
                  )}
                  {isRunning && (
                    <Button 
                      onClick={handleHandsUse}
                      variant="outline"
                      className="flex-1"
                    >
                      Hands Used
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vitals & Symptoms */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900">Vital Signs & Observations</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Pre-Test HR (bpm)</Label>
                <Input
                  type="number"
                  min="0"
                  value={preHR}
                  onChange={(e) => setPreHR(e.target.value)}
                  disabled={isRunning}
                  placeholder="e.g., 72"
                />
              </div>
              <div>
                <Label className="text-sm">Post-Test HR (bpm)</Label>
                <Input
                  type="number"
                  min="0"
                  value={postHR}
                  onChange={(e) => setPostHR(e.target.value)}
                  disabled={isRunning}
                  placeholder="e.g., 85"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm">Symptoms During Test</Label>
              <Input
                type="text"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                disabled={isRunning}
                placeholder="e.g., Shortness of breath, none"
              />
            </div>
            <div>
              <Label className="text-sm">Additional Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isRunning}
                rows={2}
                placeholder="Optional clinical observations..."
              />
            </div>
          </div>

          {/* Clinician Instructions & Script */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 font-semibold text-sm text-slate-700 hover:text-slate-900 w-full">
              <ChevronDown className="w-4 h-4" />
              Clinician Instructions & Script
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3 text-sm">
              <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
                <p className="font-semibold text-amber-900">Equipment & Setup</p>
                <ul className="text-xs space-y-1 text-amber-800 list-disc list-inside">
                  <li>Standard chair with straight back, no armrests — seat height ~43 cm (17 inches)</li>
                  <li>Place chair against wall for stability</li>
                  <li>Stopwatch or timer (30 seconds)</li>
                  <li>Measure pre-test heart rate (resting) before positioning client</li>
                </ul>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-2">
                <p className="font-semibold text-blue-900">Participant Positioning</p>
                <ul className="text-xs space-y-1 text-blue-800 list-disc list-inside">
                  <li>Sit in the middle of the chair seat</li>
                  <li>Feet flat on the floor, shoulder-width apart</li>
                  <li>Arms crossed over the chest</li>
                  <li>Back straight, not leaning against backrest</li>
                  <li>Ensure footwear is appropriate (no heeled shoes)</li>
                </ul>
              </div>
              <div className="bg-green-50 border border-green-200 rounded p-3 space-y-2">
                <p className="font-semibold text-green-900">Clinician Script</p>
                <div className="text-xs space-y-2 text-green-800">
                  <p><span className="font-medium">Explanation:</span> <em>"This test measures your lower body strength and endurance. When I say 'Go', I want you to stand up fully and then sit back down as many times as you can in 30 seconds. Keep your arms crossed over your chest the whole time. If you need to use your hands for balance or to help push up, that's okay — just let me know."</em></p>
                  <p><span className="font-medium">Practice rep (optional):</span> <em>"Let's do one practice stand so you understand the movement."</em></p>
                  <p><span className="font-medium">Start cue:</span> <em>"Ready? Go!"</em> (start timer)</p>
                  <p><span className="font-medium">Encouragement:</span> <em>"Keep going, you're doing great!"</em> — count each full stand aloud</p>
                  <p><span className="font-medium">End cue:</span> <em>"Stop!"</em> at 30 seconds — count any partial stand if hips are more than halfway up</p>
                  <p><span className="font-medium">Post-test:</span> Measure HR within 60 seconds of test completion. Ask about symptoms.</p>
                </div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded p-3 space-y-2">
                <p className="font-semibold text-red-900">Safety & Contraindications</p>
                <ul className="text-xs space-y-1 text-red-800 list-disc list-inside">
                  <li>Stop if participant reports chest pain, dizziness, or severe shortness of breath</li>
                  <li>Caution with recent lower limb surgery or acute joint pain</li>
                  <li>Ensure chair is stable — hold or brace the chair if needed</li>
                  <li>Clinician should stand close by to assist if balance is compromised</li>
                </ul>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2">
                <p className="font-semibold text-slate-900">Scoring Notes</p>
                <ul className="text-xs space-y-1 text-slate-700 list-disc list-inside">
                  <li>Count each complete sit-to-stand cycle (one full stand = 1 rep)</li>
                  <li>If hips are more than halfway up at the 30-second mark, count as a full rep</li>
                  <li>Note if hands were used — record separately (impacts interpretation)</li>
                  <li>One trial only (no warm-up trial in standard protocol)</li>
                </ul>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Normative Data */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 font-semibold text-sm text-slate-700 hover:text-slate-900 w-full">
              <ChevronDown className="w-4 h-4" />
              Normative Data & Interpretation
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3 text-sm">
              <div className="bg-slate-50 border border-slate-200 rounded p-3">
                <p className="font-semibold text-slate-900 mb-2">Rikli & Jones (2013) — Community-Dwelling Older Adults</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-200">
                      <tr>
                        <th className="p-1.5 text-left">Age Group</th>
                        <th className="p-1.5 text-center">Men (reps)</th>
                        <th className="p-1.5 text-center">Women (reps)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {[
                        ["60–64", "14–19", "12–17"],
                        ["65–69", "12–18", "11–16"],
                        ["70–74", "12–17", "10–15"],
                        ["75–79", "11–17", "10–15"],
                        ["80–84", "10–15", "9–14"],
                        ["85–89", "8–14", "8–13"],
                        ["90–94", "7–12", "4–11"],
                      ].map(([age, men, women]) => (
                        <tr key={age} className="hover:bg-slate-100">
                          <td className="p-1.5 font-medium">{age}</td>
                          <td className="p-1.5 text-center">{men}</td>
                          <td className="p-1.5 text-center">{women}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500 mt-1">Values represent the average range (25th–75th percentile). Below 25th percentile indicates elevated fall risk.</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-3">
                <p className="font-semibold text-slate-900 mb-2">Younger Adults — Reference Values (Bohannon, 2006)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-200">
                      <tr>
                        <th className="p-1.5 text-left">Age Group</th>
                        <th className="p-1.5 text-center">Men (reps)</th>
                        <th className="p-1.5 text-center">Women (reps)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {[
                        ["20–29", "21–29", "19–26"],
                        ["30–39", "19–27", "18–24"],
                        ["40–49", "17–25", "16–22"],
                        ["50–59", "15–23", "14–21"],
                      ].map(([age, men, women]) => (
                        <tr key={age} className="hover:bg-slate-100">
                          <td className="p-1.5 font-medium">{age}</td>
                          <td className="p-1.5 text-center">{men}</td>
                          <td className="p-1.5 text-center">{women}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded p-3 space-y-1">
                <p className="font-semibold text-purple-900">Clinical Thresholds</p>
                <ul className="text-xs space-y-1 text-purple-800 list-disc list-inside">
                  <li><span className="font-medium">MCID:</span> 2.0 repetitions (minimal clinically important difference)</li>
                  <li><span className="font-medium">Fall risk threshold:</span> &lt;12 reps in adults 60+ (Bischoff et al., 2003)</li>
                  <li><span className="font-medium">Frailty indicator:</span> &lt;8 reps in adults 70+ suggests frailty phenotype</li>
                  <li><span className="font-medium">Hands used:</span> Note and consider as a qualitative indicator of reduced strength</li>
                </ul>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* References */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 font-semibold text-sm text-slate-700 hover:text-slate-900 w-full">
              <ChevronDown className="w-4 h-4" />
              References
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 text-xs text-slate-600 space-y-2">
              <p>1. Rikli RE, Jones CJ. <em>Senior Fitness Test Manual</em> (2nd ed.). Human Kinetics; 2013.</p>
              <p>2. Jones CJ, Rikli RE, Beam WC. A 30-s chair-stand test as a measure of lower body strength in community-residing older adults. <em>Res Q Exerc Sport</em>. 1999;70(2):113–119.</p>
              <p>3. Bischoff HA, Stähelin HB, Monsch AU, et al. Identifying a cut-off point for normal mobility: a comparison of the timed 'up and go' test in community-dwelling and institutionalised elderly women. <em>Age Ageing</em>. 2003;32(3):315–320.</p>
              <p>4. Bohannon RW. Reference values for the five-repetition sit-to-stand test: a descriptive meta-analysis of data from elders. <em>Percept Mot Skills</em>. 2006;103(1):215–222.</p>
              <p>5. Bohannon RW, Bubela DJ, Magasi SR, Wang YC, Gershon RC. Sit-to-stand test: performance and determinants across the age-span. <em>Isokinet Exerc Sci</em>. 2010;18(4):235–240.</p>
              <p>6. Paterson DH, Warburton DE. Physical activity and functional limitations in older adults: a systematic review related to Canada's Physical Activity Guidelines. <em>Int J Behav Nutr Phys Act</em>. 2010;7:38.</p>
            </CollapsibleContent>
          </Collapsible>

          {/* Save Button */}
          <Button 
            onClick={handleSave} 
            className="w-full bg-emerald-600 hover:bg-emerald-700 h-10 font-semibold"
            disabled={standCount === 0}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}