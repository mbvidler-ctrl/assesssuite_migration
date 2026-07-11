import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle, ChevronDown, ExternalLink, Info, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { todayLocal } from "@/lib/localDate";

export default function StaticSquatTestRunner({ client, onSave, onClose }) {
  const [isRunning, setIsRunning] = useState(false);
  const [holdTime, setHoldTime] = useState(0);
  const [preTestVitals, setPreTestVitals] = useState({ bloodPressure: "", heartRate: "" });
  const [postTestVitals, setPostTestVitals] = useState({ bloodPressure: "", heartRate: "" });
  const [notes, setNotes] = useState("");
  const [preTestNotes, setPreTestNotes] = useState("");
  const [postTestNotes, setPostTestNotes] = useState("");
  const [age, setAge] = useState("");
  const [observations, setObservations] = useState({
    wallContactOk: false,
    kneeAlign: false,
    backFlat: false,
    noPain: false,
  });
  const timerRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setHoldTime((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  const getInterpretation = () => {
    if (holdTime < 10) return { level: "Poor", color: "text-red-700", bg: "bg-red-50" };
    if (holdTime < 30) return { level: "Fair", color: "text-orange-700", bg: "bg-orange-50" };
    if (holdTime < 60) return { level: "Good", color: "text-amber-700", bg: "bg-amber-50" };
    if (holdTime < 120) return { level: "Very Good", color: "text-blue-700", bg: "bg-blue-50" };
    return { level: "Excellent", color: "text-green-700", bg: "bg-green-50" };
  };

  const handleStart = () => {
    setIsRunning(true);
    setHoldTime(0);
    setPostTestVitals({ bloodPressure: "", heartRate: "" });
  };

  const handleStop = () => {
    setIsRunning(false);
    clearInterval(timerRef.current);
    toast.success("Test stopped. Record post-test vitals and observations.");
  };

  const handleSave = () => {
    if (holdTime === 0) {
      toast.error("Please record hold time or cancel the test.");
      return;
    }

    const interpretation = getInterpretation();
    const qualityCheck = Object.values(observations).filter(v => v).length;

    const soapText = [
      `• Static Squat Test (Wall Squat) - Isometric Lower Limb Endurance`,
      ``,
      `  Test Parameters:`,
      `    Hold Time: ${holdTime} seconds`,
      `${age ? `    Age: ${age} years` : ""}`,
      ``,
      `  Clinical Interpretation: ${interpretation.level}`,
      `    Interpretation: ${holdTime} seconds hold indicates ${interpretation.level} isometric endurance`,
      ``,
      `  Test Quality Observations (${qualityCheck}/4):`,
      observations.wallContactOk ? `    ✓ Back and head maintained full wall contact` : `    • Back/head lost wall contact (reduced range)`,
      observations.kneeAlign ? `    ✓ Knees tracked over toes; proper alignment` : `    • Knee alignment issues (valgus/varus)`,
      observations.backFlat ? `    ✓ Back remained flat against wall` : `    • Back arched or rounded away from wall`,
      observations.noPain ? `    ✓ No pain; fatigue only` : `    • Pain reported (discontinue if severe)`,
      ``,
      `  Interpretation Criteria (Wall Squat Hold Time):`,
      `    • Excellent: ≥120 seconds (exceptional isometric endurance)`,
      `    • Very Good: 60-119 seconds (strong endurance capacity)`,
      `    • Good: 30-59 seconds (above-average endurance)`,
      `    • Fair: 10-29 seconds (moderate endurance; strength training recommended)`,
      `    • Poor: <10 seconds (limited endurance; high priority for intervention)`,
      ``,
      `  Pre-Test Vitals:`,
      `    Blood Pressure: ${preTestVitals.bloodPressure || 'N/A'}`,
      `    Heart Rate: ${preTestVitals.heartRate || 'N/A'} bpm`,
      ``,
      postTestVitals.bloodPressure || postTestVitals.heartRate ? `  Post-Test Vitals:` : null,
      postTestVitals.bloodPressure ? `    Blood Pressure: ${postTestVitals.bloodPressure}` : null,
      postTestVitals.heartRate ? `    Heart Rate: ${postTestVitals.heartRate} bpm` : null,
      ``,
      preTestNotes ? `  Pre-Test Notes: ${preTestNotes}` : null,
      notes ? `  Additional Notes: ${notes}` : null,
      postTestNotes ? `  Post-Test Notes: ${postTestNotes}` : null,
      ``,
      `  Clinical Relevance:`,
      `    • Measures isometric lower limb strength and quadriceps endurance`,
      `    • Simulates static postures (stair climbing, squatting down to pick up objects)`,
      `    • Useful for rehabilitation and functional strength assessment`,
      `    • Less joint stress than dynamic movements; suitable for some pathologies`,
      `    • Correlates with ADL independence and fall risk`,
      ``,
      `  References:`,
      `    • Isometric squat hold test - assessment of quadriceps endurance`,
      `    • Sensitive to training response; good reliability (ICC 0.80-0.90)`,
      `    • Age-adjusted normative data available (varies by population)`,
    ].filter(Boolean).join('\n');

    onSave({
      status: "completed",
      result_value: holdTime,
      additional_data: {
        soap_text: soapText,
        holdTime,
        age: age || null,
        qualityScore: qualityCheck,
        observations,
        interpretation: interpretation.level,
      },
      notes,
      assessment_date: todayLocal()
    });
    toast.success("Static Squat Test saved successfully.");
  };

  const interpretation = getInterpretation();
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[95vh] overflow-y-auto p-6 space-y-4">
        
        {/* Header */}
        <div className="border-b pb-4 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Static Squat Test (Wall Squat)</h1>
            <p className="text-slate-600 mt-2">Isometric lower limb strength and endurance assessment</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Clinical Guidance */}
        <Collapsible defaultOpen={true}>
          <CollapsibleTrigger className="flex items-center gap-2 font-semibold text-slate-900 hover:bg-slate-50 p-2 rounded">
            <ChevronDown className="w-4 h-4" /> Clinical Protocol & Guidance
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-4">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="technique">Technique</TabsTrigger>
                <TabsTrigger value="safety">Safety</TabsTrigger>
                <TabsTrigger value="scoring">Interpretation</TabsTrigger>
                <TabsTrigger value="norms">Evidence</TabsTrigger>
                <TabsTrigger value="references">References</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                    <Info className="w-5 h-5" /> Assessment Overview
                  </h4>
                  <div className="space-y-2 text-sm text-blue-800">
                    <p><strong>Purpose:</strong> Assess isometric lower limb strength and quadriceps endurance capacity. Measure the duration that a patient can maintain a static squat position against the wall.</p>
                    <p><strong>Principle:</strong> Patient stands with back against wall, slides into a squat position (knees ~90 degrees), and holds position as long as possible. Test measures hold duration in seconds.</p>
                    <p><strong>Indication:</strong> Baseline strength assessment, post-injury/surgery screening, rehabilitation progress monitoring, fall risk assessment (elderly), functional strength evaluation</p>
                    <p><strong>Population:</strong> Adults of all ages; particularly useful for patients with joint pain during dynamic movement, post-injury rehabilitation, and older adults</p>
                    <p><strong>Advantage:</strong> Minimal equipment, low impact, safe for many populations, less stress on joints than dynamic squats</p>
                    
                    <div className="bg-white border border-blue-300 rounded p-2 mt-2">
                      <p className="font-semibold text-blue-900 text-xs mb-1">Key Features:</p>
                      <ul className="text-xs space-y-1 text-blue-800 list-disc list-inside">
                        <li>Isometric assessment (static hold, no movement)</li>
                        <li>Measures quadriceps endurance under sustained contraction</li>
                        <li>Rapid, single-measure assessment</li>
                        <li>Excellent for rehabilitation tracking</li>
                        <li>Safe alternative for patients with pain during dynamic movements</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="technique" className="mt-4 space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-green-900">Testing Technique & Positioning</h4>
                  
                  <div className="bg-white border border-green-300 rounded p-3 space-y-2">
                    <p className="font-semibold text-green-900 text-sm">Equipment & Setup:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-green-800">
                      <li>Clear wall or flat, firm surface (minimum 1m height)</li>
                      <li>Non-slip floor surface in front of wall</li>
                      <li>Stopwatch or electronic timer</li>
                      <li>Optional: tape to mark knee position on wall (for standardization)</li>
                      <li>Tape measure (optional, to verify knee angle ~90 degrees)</li>
                    </ul>
                  </div>

                  <div className="bg-white border border-green-300 rounded p-3 space-y-2">
                    <p className="font-semibold text-green-900 text-sm">Starting Position:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-green-800">
                      <li>Stand with back flat against wall</li>
                      <li>Feet shoulder-width apart, approximately 30-45cm away from wall (distance depends on leg length)</li>
                      <li>Head against wall or in neutral position (cervical spine neutral)</li>
                      <li>Arms can be crossed over chest or extended forward for balance</li>
                      <li>Core engaged; neutral spine</li>
                      <li>Establish baseline position before sliding down</li>
                    </ol>
                  </div>

                  <div className="bg-white border border-green-300 rounded p-3 space-y-2">
                    <p className="font-semibold text-green-900 text-sm">Squat Position (Hold Position):</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-green-800">
                      <li>Slowly slide down wall by bending knees and hips</li>
                      <li>Maintain full contact between back and wall throughout</li>
                      <li>Lower until knees are approximately 90 degrees (thighs parallel to floor)</li>
                      <li>Do NOT go deeper than 90 degrees (reduces test reliability; increases joint stress)</li>
                      <li>Ensure knees track over toes (do not cave inward)</li>
                      <li>Keep weight distributed evenly through both feet</li>
                      <li><strong>Hold this position until fatigue prevents further holding</strong></li>
                    </ol>
                  </div>

                  <div className="bg-white border border-green-300 rounded p-3 space-y-2">
                    <p className="font-semibold text-green-900 text-sm">Test Administration:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-green-800">
                      <li>Once patient is in correct position, start stopwatch immediately</li>
                      <li>Encourage patient verbally: "Maintain this position as long as you can"</li>
                      <li>Monitor for form breakdown; provide cues if needed ("Keep back against wall", "Chest up")</li>
                      <li>Watch for loss of position: back leaving wall, knees collapsing inward, hips dropping</li>
                      <li>Patient signals when they can no longer maintain position (or clinician stops test if form is lost)</li>
                      <li>Record hold time in seconds</li>
                      <li>Allow patient time to recover (walk around, stretch)</li>
                    </ol>
                  </div>

                  <div className="bg-amber-50 border border-amber-300 rounded p-3 mt-3">
                    <p className="font-semibold text-amber-900 text-sm mb-2">Form Quality Cues:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-amber-800">
                      <li><strong>Back Contact:</strong> Full back must maintain wall contact throughout hold</li>
                      <li><strong>Knee Angle:</strong> Maintain 90 degrees; knees should NOT collapse inward or outward</li>
                      <li><strong>Hip Position:</strong> Hips stay level; no dropping to one side</li>
                      <li><strong>Spine:</strong> Spine neutral; no hyperextension or rounding</li>
                      <li><strong>Weight Distribution:</strong> Evenly distributed through both feet; no shift to toes or heels</li>
                      <li><strong>No Pain:</strong> Test measures fatigue, not pain; stop if pain occurs</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="safety" className="mt-4 space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-red-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" /> Safety Considerations
                  </h4>
                  
                  <div className="bg-white border border-red-300 rounded p-3 space-y-2">
                    <p className="font-semibold text-red-900 text-sm">When NOT to Perform Test:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-red-800">
                      <li>Acute knee, hip, or ankle injury with pain</li>
                      <li>Recent lower limb surgery without medical clearance</li>
                      <li>Unstable or non-weight-bearing status</li>
                      <li>Severe knee osteoarthritis with limited range</li>
                      <li>ACL insufficiency without protective bracing</li>
                      <li>Uncontrolled hypertension or acute cardiac symptoms</li>
                      <li>Severe balance deficits (high fall risk)</li>
                      <li>Patellofemoral pain with sharp onset</li>
                    </ul>
                  </div>

                  <div className="bg-white border border-red-300 rounded p-3 space-y-2">
                    <p className="font-semibold text-red-900 text-sm">Red Flags - Stop Test Immediately:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-red-800">
                      <li>Sharp, severe pain in knee, hip, or ankle (NOT muscle fatigue)</li>
                      <li>Inability to maintain position or near-syncope</li>
                      <li>Chest pain, severe dyspnea, or cardiac symptoms</li>
                      <li>Visible joint instability or swelling</li>
                      <li>Patient request for cessation</li>
                      <li>Loss of balance or need for wall support adjustment</li>
                      <li>Numbness/tingling in legs</li>
                    </ul>
                  </div>

                  <div className="bg-white border border-red-300 rounded p-3 space-y-2">
                    <p className="font-semibold text-red-900 text-sm">Patient Safety During Testing:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-red-800">
                      <li>Clear environment of obstacles in front of wall</li>
                      <li>Verbal consent and clear instructions before test</li>
                      <li>Clinician present and within arm's reach during test</li>
                      <li>Establish pain/fatigue scale expectations</li>
                      <li>Clear instruction: "Tell me if you experience pain (not fatigue) — stop immediately"</li>
                      <li>Monitor for postural breakdown; provide support if needed</li>
                      <li>Allow gradual slide down wall at start (no abrupt descent)</li>
                      <li>Assist rising from position if patient struggles (prevent falls)</li>
                      <li>Observe for dizziness or near-syncope post-test</li>
                    </ul>
                  </div>

                  <div className="bg-white border border-red-300 rounded p-3 space-y-2">
                    <p className="font-semibold text-red-900 text-sm">Relative Contraindications (Proceed with Caution):</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-red-800">
                      <li>Mild-to-moderate knee OA (use shorter hold time; monitor for pain)</li>
                      <li>Patellofemoral pain (shallow squat depth; shorter holds)</li>
                      <li>Hypertension (monitor pre/post BP; use shorter duration)</li>
                      <li>Older adults (provide chair nearby for safe exit; monitor balance)</li>
                      <li>Pregnancy (avoid if not previously trained; shallower squat acceptable)</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="scoring" className="mt-4 space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-purple-900">Test Interpretation</h4>
                  
                  <div className="space-y-2">
                    <div className="bg-green-50 border border-green-300 rounded p-3">
                      <p className="font-semibold text-green-700 text-sm">Excellent: ≥120 seconds</p>
                      <p className="text-xs text-green-800">Exceptional isometric endurance; excellent lower limb strength capacity</p>
                      <p className="text-xs text-green-600 mt-1">• Athlete-level performance; minimal fall risk; excellent functional reserve</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-300 rounded p-3">
                      <p className="font-semibold text-blue-700 text-sm">Very Good: 60-119 seconds</p>
                      <p className="text-xs text-blue-800">Strong isometric endurance; adequate strength for ADLs and activities</p>
                      <p className="text-xs text-blue-600 mt-1">• Good functional capacity; low fall risk; suitable for independent living</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-300 rounded p-3">
                      <p className="font-semibold text-amber-700 text-sm">Good: 30-59 seconds</p>
                      <p className="text-xs text-amber-800">Above-average isometric endurance; adequate for most daily activities</p>
                      <p className="text-xs text-amber-600 mt-1">• Some difficulty with prolonged standing or stairs; moderate training benefit</p>
                    </div>
                    <div className="bg-orange-50 border border-orange-300 rounded p-3">
                      <p className="font-semibold text-orange-700 text-sm">Fair: 10-29 seconds</p>
                      <p className="text-xs text-orange-800">Moderate isometric endurance; limited ability to sustain lower limb activity</p>
                      <p className="text-xs text-orange-600 mt-1">• Difficulty with stairs, squatting, standing; <strong>recommend targeted strengthening</strong></p>
                    </div>
                    <div className="bg-red-50 border border-red-300 rounded p-3">
                      <p className="font-semibold text-red-700 text-sm">Poor: {`<`}10 seconds</p>
                      <p className="text-xs text-red-800">Severely limited isometric endurance; significant lower limb weakness</p>
                      <p className="text-xs text-red-600 mt-1">• High fall risk; ADL dependence likely; <strong>requires intervention/evaluation</strong></p>
                    </div>
                  </div>

                  <div className="bg-white border border-purple-300 rounded p-3 mt-3 space-y-1">
                    <p className="font-semibold text-purple-900 text-sm">Test Quality Observations:</p>
                    <p className="text-xs text-purple-800 mt-2">Record form quality during test (checked in data entry below):</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-purple-800 mt-2">
                      <li>Back and head maintained full contact with wall</li>
                      <li>Knees tracked over toes; proper 90-degree angle</li>
                      <li>Back remained flat against wall (no rounding)</li>
                      <li>No pain; fatigue only (discomfort acceptable)</li>
                    </ul>
                    <p className="text-xs text-purple-600 mt-2"><strong>Quality Score:</strong> Number of criteria met (0-4). Higher = better form/test quality.</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="norms" className="mt-4 space-y-3">
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h4 className="font-semibold text-indigo-900 mb-3">Evidence Base & Test Characteristics</h4>
                  <div className="space-y-3">
                    <div className="bg-white border border-indigo-200 rounded p-3">
                      <p className="font-semibold text-indigo-900 text-sm mb-2">Test Reliability & Validity:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs text-indigo-800">
                        <li><strong>Test-Retest Reliability:</strong> Good to Excellent (ICC 0.80-0.95)</li>
                        <li><strong>Validity:</strong> Correlates with isokinetic quadriceps strength (r=0.65-0.82)</li>
                        <li><strong>Correlates With:</strong> Sit-to-stand tests, SPPB, functional mobility</li>
                        <li><strong>Sensitivity:</strong> Responsive to strength training and rehabilitation progress</li>
                      </ul>
                    </div>
                    <div className="bg-white border border-indigo-200 rounded p-3">
                      <p className="font-semibold text-indigo-900 text-sm mb-2">Age-Adjusted Normative Data:</p>
                      <div className="text-xs text-indigo-800 space-y-1">
                        <p><strong>Adults 18-40 years:</strong> Good = 45-90+ seconds | Average = 30-44 seconds | Poor = &lt;30 seconds</p>
                        <p><strong>Adults 41-60 years:</strong> Good = 30-60+ seconds | Average = 15-29 seconds | Poor = &lt;15 seconds</p>
                        <p><strong>Older Adults 60+ years:</strong> Good = 15-45+ seconds | Average = 8-14 seconds | Poor = &lt;8 seconds</p>
                        <p className="mt-2 italic">Note: Normative data varies by population and fitness level; sex differences may exist.</p>
                      </div>
                    </div>
                    <div className="bg-white border border-indigo-200 rounded p-3">
                      <p className="font-semibold text-indigo-900 text-sm mb-2">Clinical Utility:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs text-indigo-800">
                        <li>Simple, no-cost assessment of isometric strength endurance</li>
                        <li>Low impact; safe for many populations (post-injury, elderly)</li>
                        <li>Excellent for rehabilitation progress tracking</li>
                        <li>Useful for fall risk screening in older adults</li>
                        <li>Sensitive to training response over weeks/months</li>
                        <li>Correlates with independence in ADLs (stairs, transitions)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="references" className="mt-4 space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-900 mb-3">Evidence-Based References</h4>
                  <div className="space-y-2">
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/18239612/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-amber-700 hover:underline text-xs"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span><strong>Muehlbauer T, et al. (2012).</strong> Isometric leg strength as a function of age and sex. J Strength Cond Res 26(4):1016-1024</span>
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/15122033/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-amber-700 hover:underline text-xs"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span><strong>Rikli RE, Jones CJ. (2013).</strong> Senior Fitness Test Manual. Human Kinetics; includes isometric assessment guidelines</span>
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/17766743/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-amber-700 hover:underline text-xs"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span><strong>Bohannon RW. (2007).</strong> Grip strength: A summary of published values. J Hand Ther 20(2):125-132; isometric assessment principles</span>
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/24477325/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-amber-700 hover:underline text-xs"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span><strong>Sherrington C, et al. (2017).</strong> Exercise to prevent falls in older adults. Can J Aging 36(2):210-222; strength endurance for fall prevention</span>
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/26575632/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-amber-700 hover:underline text-xs"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span><strong>ESSA. (2018).</strong> Outcome Measures: Assessment protocols for lower limb strength and endurance</span>
                    </a>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CollapsibleContent>
        </Collapsible>

        {/* Data Entry */}
        <Card className="border-2 border-slate-300">
          <CardHeader className="bg-slate-50">
            <CardTitle className="text-base">Assessment Data Entry</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            
            <div>
              <Label className="font-semibold block mb-2">Client Information</Label>
              <div className="bg-slate-50 p-3 rounded text-sm text-slate-700 space-y-1">
                <p><strong>Name:</strong> {client?.full_name || "Not provided"}</p>
                <p><strong>Age:</strong> {age ? `${age} years` : "Enter below"}</p>
              </div>
            </div>

            <div>
              <Label htmlFor="age" className="font-semibold block mb-2">Age (years)</Label>
              <Input
                id="age"
                type="number"
                placeholder="e.g., 65"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                disabled={isRunning}
              />
            </div>

            <div>
              <Label className="font-semibold block mb-3">Pre-Test Vitals</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="preBP" className="text-sm block mb-1">Blood Pressure (mmHg)</Label>
                  <Input
                    id="preBP"
                    type="text"
                    placeholder="e.g., 120/80"
                    value={preTestVitals.bloodPressure}
                    onChange={(e) => setPreTestVitals({ ...preTestVitals, bloodPressure: e.target.value })}
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <Label htmlFor="preHR" className="text-sm block mb-1">Heart Rate (bpm)</Label>
                  <Input
                    id="preHR"
                    type="number"
                    placeholder="e.g., 72"
                    value={preTestVitals.heartRate}
                    onChange={(e) => setPreTestVitals({ ...preTestVitals, heartRate: e.target.value })}
                    disabled={isRunning}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="preTestNotes" className="font-semibold block mb-2">Pre-Test Notes</Label>
              <Textarea
                id="preTestNotes"
                value={preTestNotes}
                onChange={(e) => setPreTestNotes(e.target.value)}
                placeholder="Document: baseline mood, energy level, any pain or limitations, warm-up performed..."
                rows={2}
                disabled={isRunning}
              />
            </div>

            {/* Test Execution */}
            <div className="border-2 border-slate-300 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-slate-50 space-y-4">
              <h3 className="font-bold text-lg text-slate-900">TEST EXECUTION</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 text-center border border-slate-300">
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Hold Time</Label>
                  <div className={`text-4xl font-bold font-mono ${isRunning ? 'text-blue-600 animate-pulse' : 'text-slate-900'}`}>
                    {formatTime(holdTime)}
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 text-center border border-slate-300">
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Interpretation</Label>
                  <div className={`text-lg font-bold ${interpretation.color}`}>
                    {interpretation.level}
                  </div>
                  <p className="text-xs text-slate-600 mt-2">{holdTime} seconds</p>
                </div>
              </div>

              <div className="flex gap-2 justify-center pt-4">
                {!isRunning ? (
                  <Button onClick={handleStart} className="bg-blue-600 hover:bg-blue-700 px-8">
                    <Play className="w-4 h-4 mr-2" />
                    Start Test
                  </Button>
                ) : (
                  <Button onClick={handleStop} variant="destructive" className="px-8">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Stop Test
                  </Button>
                )}
              </div>
            </div>

            <div>
              <Label className="font-semibold block mb-3">Test Quality Observations</Label>
              <div className="space-y-3">
                {[
                  { key: "wallContactOk", label: "Back/head maintained wall contact", desc: "Full contact throughout hold" },
                  { key: "kneeAlign", label: "Knees tracked over toes", desc: "Proper 90-degree alignment; no valgus/varus" },
                  { key: "backFlat", label: "Back remained flat against wall", desc: "No arching or rounding away from wall" },
                  { key: "noPain", label: "No pain reported", desc: "Fatigue only; no sharp pain" },
                ].map((item) => (
                  <div key={item.key} className="flex items-start gap-3 border-l-4 border-slate-300 pl-3">
                    <Checkbox
                      id={item.key}
                      checked={observations[item.key] || false}
                      onCheckedChange={(checked) =>
                        setObservations({ ...observations, [item.key]: checked })
                      }
                      disabled={!isRunning}
                      className="mt-1"
                    />
                    <div>
                      <Label htmlFor={item.key} className="text-sm font-semibold cursor-pointer">{item.label}</Label>
                      <p className="text-xs text-slate-600">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-600 mt-3"><strong>Quality Score:</strong> {Object.values(observations).filter(v => v).length}/4 criteria met</p>
            </div>

            <div>
              <Label className="font-semibold block mb-3">Post-Test Vitals</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="postBP" className="text-sm block mb-1">Blood Pressure (mmHg)</Label>
                  <Input
                    id="postBP"
                    type="text"
                    placeholder="e.g., 125/82"
                    value={postTestVitals.bloodPressure}
                    onChange={(e) => setPostTestVitals({ ...postTestVitals, bloodPressure: e.target.value })}
                    disabled={!isRunning}
                  />
                </div>
                <div>
                  <Label htmlFor="postHR" className="text-sm block mb-1">Heart Rate (bpm)</Label>
                  <Input
                    id="postHR"
                    type="number"
                    placeholder="e.g., 85"
                    value={postTestVitals.heartRate}
                    onChange={(e) => setPostTestVitals({ ...postTestVitals, heartRate: e.target.value })}
                    disabled={!isRunning}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="postTestNotes" className="font-semibold block mb-2">Post-Test Notes</Label>
              <Textarea
                id="postTestNotes"
                value={postTestNotes}
                onChange={(e) => setPostTestNotes(e.target.value)}
                placeholder="Document: fatigue level, pain or discomfort (if any), reason for stopping, patient feedback, any adverse reactions..."
                rows={2}
                disabled={!isRunning}
              />
            </div>

            <div>
              <Label htmlFor="notes" className="font-semibold block mb-2">Additional Clinical Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Overall assessment impression, comparison to previous results, recommendations for follow-up or intervention..."
                rows={3}
                disabled={!isRunning}
              />
            </div>
          </CardContent>
        </Card>

        {/* Control Buttons */}
        <div className="flex justify-between items-center gap-3 pt-4 border-t flex-wrap">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isRunning || holdTime === 0} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}