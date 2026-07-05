import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle, ChevronDown, ExternalLink, Info, CheckCircle2, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";

export default function SquatTestDynamicRunner({ client, onSave, onClose }) {
  const [isRunning, setIsRunning] = useState(false);
  const [squatCount, setSquatCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [notes, setNotes] = useState("");
  const [preTestNotes, setPreTestNotes] = useState("");
  const [postTestNotes, setPostTestNotes] = useState("");
  const [testDuration, setTestDuration] = useState(60);
  const [bodyWeight, setBodyWeight] = useState("");
  const [age, setAge] = useState("");
  const [observations, setObservations] = useState({
    chestUp: false,
    kneeTracking: false,
    fullDepth: false,
    noCompensation: false,
    consistentPace: false,
  });
  const timerRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timerRef.current);
            setIsRunning(false);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  const getInterpretation = () => {
    if (age && testDuration === 60) {
      const ageNum = parseInt(age);
      // General normative values for 60-second squat test (all ages)
      if (squatCount >= 40) return { level: "Excellent", color: "text-green-700", bg: "bg-green-50" };
      if (squatCount >= 30) return { level: "Good", color: "text-blue-700", bg: "bg-blue-50" };
      if (squatCount >= 20) return { level: "Fair", color: "text-amber-700", bg: "bg-amber-50" };
      if (squatCount >= 10) return { level: "Poor", color: "text-orange-700", bg: "bg-orange-50" };
      return { level: "Very Poor", color: "text-red-700", bg: "bg-red-50" };
    }
    return { level: "Not evaluated", color: "text-slate-700", bg: "bg-slate-50" };
  };

  const handleStart = () => {
    setIsRunning(true);
    setSquatCount(0);
    setTimeRemaining(testDuration);
    setPostTestNotes("");
  };

  const handleStop = () => {
    setIsRunning(false);
    clearInterval(timerRef.current);
    toast.success("Test stopped. Review results and save.");
  };

  const handleSquatIncrement = () => {
    if (isRunning) {
      setSquatCount((prevCount) => prevCount + 1);
    }
  };

  const handleSquatDecrement = () => {
    if (isRunning && squatCount > 0) {
      setSquatCount((prevCount) => prevCount - 1);
    }
  };

  const handleSave = () => {
    if (squatCount === 0) {
      toast.error("Please record at least one squat or cancel the test.");
      return;
    }

    const interpretation = getInterpretation();
    const qualityCheck = Object.values(observations).filter(v => v).length;

    const soapText = [
      `• Dynamic Squat Test - Lower Limb Strength & Muscular Endurance`,
      ``,
      `  Test Parameters:`,
      `    Duration: ${testDuration} seconds`,
      `    Squats Completed: ${squatCount}`,
      `${age ? `    Age: ${age} years` : ""}`,
      `${bodyWeight ? `    Body Weight: ${bodyWeight} kg` : ""}`,
      ``,
      `  Clinical Interpretation: ${interpretation.level}`,
      `    Score: ${squatCount} squats in ${testDuration} seconds`,
      `    Normative Comparison: ${interpretation.level}`,
      ``,
      `  Test Quality Observations (${qualityCheck}/5):`,
      observations.chestUp ? `    ✓ Maintained upright chest position` : `    • Chest collapsed (poor form)`,
      observations.kneeTracking ? `    ✓ Knees tracked over toes` : `    • Knees valgus/varus (alignment issue)`,
      observations.fullDepth ? `    ✓ Achieved full depth (thighs parallel or below)` : `    • Shallow squats (reduced range)`,
      observations.noCompensation ? `    ✓ No compensatory patterns observed` : `    • Asymmetrical movement/compensations noted`,
      observations.consistentPace ? `    ✓ Maintained consistent pace throughout` : `    • Pace declined (fatigue evident)`,
      ``,
      `  Interpretation Criteria (60-second test):`,
      `    • Excellent: ≥40 squats (strong lower limb power & endurance)`,
      `    • Good: 30-39 squats (above-average function)`,
      `    • Fair: 20-29 squats (average function)`,
      `    • Poor: 10-19 squats (below-average function; consider targeted training)`,
      `    • Very Poor: <10 squats (significant weakness; screen for pathology)`,
      ``,
      preTestNotes ? `  Pre-Test Notes: ${preTestNotes}` : null,
      notes ? `  Additional Notes: ${notes}` : null,
      postTestNotes ? `  Post-Test Notes: ${postTestNotes}` : null,
      ``,
      `  Clinical Relevance:`,
      `    • Measures quadriceps, gluteal, and calf endurance`,
      `    • Correlates with functional mobility and fall risk (elderly)`,
      `    • Useful for baseline assessment and rehabilitation progress`,
      `    • Sensitive to training response in rehabilitation`,
      ``,
      `  References:`,
      `    • Lower Limb Strength & Endurance Testing - ESSA guidelines`,
      `    • Correlated with 30-Second Sit-to-Stand Test and SPPB`,
      `    • Age-adjusted normative data available (NHANES, ESSA databases)`,
    ].filter(Boolean).join('\n');

    onSave({
      status: "completed",
      result_value: squatCount,
      additional_data: {
        soap_text: soapText,
        testDuration,
        squatCount,
        age: age || null,
        bodyWeight: bodyWeight || null,
        qualityScore: qualityCheck,
        observations,
        interpretation: interpretation.level,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0]
    });
    toast.success("Squat Test saved successfully.");
  };

  const interpretation = getInterpretation();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[95vh] overflow-y-auto p-6 space-y-4">
        
        {/* Header */}
        <div className="border-b pb-4 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dynamic Squat Test</h1>
            <p className="text-slate-600 mt-2">Lower limb strength and muscular endurance assessment</p>
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
                    <p><strong>Purpose:</strong> Assess lower limb strength, muscular endurance, and functional power in the quadriceps, gluteals, and calf muscles.</p>
                    <p><strong>Principle:</strong> Measure maximum number of controlled squats performed in a fixed time (typically 60 seconds). Higher repetitions indicate better muscular endurance and functional capacity.</p>
                    <p><strong>Indication:</strong> Baseline fitness assessment, rehabilitation progress monitoring, fall risk screening (elderly), return-to-sport readiness, general fitness evaluation</p>
                    <p><strong>Population:</strong> Adults of all ages; particularly useful for older adults, post-injury rehabilitation, and athletic populations</p>
                    <p><strong>Test Duration:</strong> Typically 60 seconds (adjustable for protocol requirements)</p>
                    
                    <div className="bg-white border border-blue-300 rounded p-2 mt-2">
                      <p className="font-semibold text-blue-900 text-xs mb-1">Key Components:</p>
                      <ul className="text-xs space-y-1 text-blue-800 list-disc list-inside">
                        <li>Rapid assessment requiring minimal equipment</li>
                        <li>Measures dynamic lower limb strength & endurance</li>
                        <li>Sensitive to training changes and rehabilitation progress</li>
                        <li>Correlates with functional mobility and balance</li>
                        <li>Low cost, repeatable, safe (with proper form)</li>
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
                      <li>Open space with clear floor (minimum 2m x 2m)</li>
                      <li>Stopwatch or metronome for timing</li>
                      <li>Optional: depth marker (chair seat height ~43-45cm) to standardize depth</li>
                      <li>Optional: handrail or wall for balance support (if needed for safety)</li>
                      <li>Flat, non-slip surface</li>
                    </ul>
                  </div>

                  <div className="bg-white border border-green-300 rounded p-3 space-y-2">
                    <p className="font-semibold text-green-900 text-sm">Starting Position:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-green-800">
                      <li>Stand upright with feet shoulder-width apart (hip-width to slightly wider)</li>
                      <li>Toes pointing slightly outward (10-15 degrees)</li>
                      <li>Arms can be crossed over chest OR extended forward for balance</li>
                      <li>Eyes forward, neutral head position</li>
                      <li>Engage core slightly; maintain natural spine curve</li>
                      <li>No shoe/footwear restrictions (wear comfortable, supportive shoes)</li>
                    </ol>
                  </div>

                  <div className="bg-white border border-green-300 rounded p-3 space-y-2">
                    <p className="font-semibold text-green-900 text-sm">Squat Execution (Each Repetition):</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-green-800">
                      <li><strong>Descent Phase:</strong> Lower hips by bending knees and hips simultaneously</li>
                      <li>Keep chest upright (do NOT lean forward excessively)</li>
                      <li>Knees track over toes (no valgus/varus collapse)</li>
                      <li>Descend to comfortable depth: thighs parallel to floor OR slightly below</li>
                      <li><strong>Ascent Phase:</strong> Push through mid-foot and heels to stand</li>
                      <li>Drive knees and hips forward to return to standing</li>
                      <li>Full hip and knee extension = ONE REPETITION</li>
                      <li>Maintain controlled movement (avoid bouncing at bottom)</li>
                    </ol>
                  </div>

                  <div className="bg-white border border-green-300 rounded p-3 space-y-2">
                    <p className="font-semibold text-green-900 text-sm">Test Execution:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-green-800">
                      <li>Clinician/observer starts stopwatch and says "Go"</li>
                      <li>Patient performs squats as continuously as possible for 60 seconds</li>
                      <li>Clinician counts repetitions aloud (for patient awareness) or counts silently</li>
                      <li>Encourage patient: "Keep going, maintain quality"</li>
                      <li>Monitor for form breakdown; cue if needed ("Chest up", "Knees out")</li>
                      <li>When timer reaches 0 seconds, say "Stop" — patient finishes current rep</li>
                      <li>Record final count and observe form quality during test</li>
                    </ol>
                  </div>

                  <div className="bg-amber-50 border border-amber-300 rounded p-3 mt-3">
                    <p className="font-semibold text-amber-900 text-sm mb-2">Form Quality Cues:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-amber-800">
                      <li><strong>Chest Up:</strong> Maintain upright posture; avoid forward lean</li>
                      <li><strong>Knee Tracking:</strong> Knees should track directly over toes (not inward/outward)</li>
                      <li><strong>Full Depth:</strong> Achieve thighs parallel or below parallel to floor</li>
                      <li><strong>No Bouncing:</strong> Controlled descent/ascent; brief pause at bottom acceptable</li>
                      <li><strong>Consistent Pace:</strong> Maintain steady, sustainable rhythm throughout test</li>
                      <li><strong>Heel Contact:</strong> Heels stay on ground throughout (no weight shift to toes)</li>
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
                      <li>Acute knee, hip, or ankle injury or severe pain</li>
                      <li>Recent lower limb surgery (post-operative day 0-14 without clearance)</li>
                      <li>Unstable or non-weight-bearing status</li>
                      <li>Severe osteoarthritis, meniscal pathology, or ACL insufficiency</li>
                      <li>Uncontrolled hypertension or acute cardiac symptoms</li>
                      <li>Inability to weight-bear or maintain balance safely</li>
                      <li>Pregnancy (unless previously trained and approved by OB)</li>
                      <li>Patellar dislocation history without clearance</li>
                    </ul>
                  </div>

                  <div className="bg-white border border-red-300 rounded p-3 space-y-2">
                    <p className="font-semibold text-red-900 text-sm">Red Flags - Stop Test Immediately:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-red-800">
                      <li>Sharp, severe knee or hip pain (not muscle fatigue)</li>
                      <li>Inability to weight-bear or near-syncope</li>
                      <li>Chest pain, severe shortness of breath, or cardiac symptoms</li>
                      <li>Visible joint instability or swelling</li>
                      <li>Patient request or significant form breakdown</li>
                      <li>Dizziness, vertigo, or loss of balance</li>
                    </ul>
                  </div>

                  <div className="bg-white border border-red-300 rounded p-3 space-y-2">
                    <p className="font-semibold text-red-900 text-sm">Patient Safety During Testing:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-red-800">
                      <li>Clear environment of obstacles and trip hazards</li>
                      <li>Verbal consent and explanation: "Perform as many squats as you can"</li>
                      <li>Obtain baseline BP/HR if high-risk patient (elderly, cardiac history)</li>
                      <li>Clinician positioned nearby for safety (not touching unless needed)</li>
                      <li>Clear communication of pain/fatigue scale expectations</li>
                      <li>Allow brief rest if patient becomes severely fatigued (resume if willing)</li>
                      <li>Post-test observation: monitor for dizziness, near-syncope</li>
                      <li>Advise light stretching post-test (calf, quads, hip)</li>
                    </ul>
                  </div>

                  <div className="bg-white border border-red-300 rounded p-3 space-y-2">
                    <p className="font-semibold text-red-900 text-sm">Relative Contraindications (Proceed with Caution):</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-red-800">
                      <li>Mild-to-moderate knee OA (use shallower depth if needed)</li>
                      <li>Patellofemoral pain (may need modified depth/speed)</li>
                      <li>Previous meniscal surgery (ensure clearance; avoid excessive speed)</li>
                      <li>Hypertension (use shortened duration; monitor BP)</li>
                      <li>Older adults (use chair/support if balance concerns)</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="scoring" className="mt-4 space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-purple-900">Test Interpretation (60-Second Duration)</h4>
                  
                  <div className="space-y-2">
                    <div className="bg-green-50 border border-green-300 rounded p-3">
                      <p className="font-semibold text-green-700 text-sm">Excellent: ≥40 Squats</p>
                      <p className="text-xs text-green-800">Exceptional lower limb strength and endurance; excellent functional capacity</p>
                      <p className="text-xs text-green-600 mt-1">• Athlete-level performance; excellent for age/sex</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-300 rounded p-3">
                      <p className="font-semibold text-blue-700 text-sm">Good: 30-39 Squats</p>
                      <p className="text-xs text-blue-800">Above-average lower limb strength; good functional mobility</p>
                      <p className="text-xs text-blue-600 mt-1">• Suitable for independent ADLs and most recreational activities</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-300 rounded p-3">
                      <p className="font-semibold text-amber-700 text-sm">Fair: 20-29 Squats</p>
                      <p className="text-xs text-amber-800">Average lower limb strength; adequate for basic functional activities</p>
                      <p className="text-xs text-amber-600 mt-1">• May benefit from targeted lower limb strengthening program</p>
                    </div>
                    <div className="bg-orange-50 border border-orange-300 rounded p-3">
                      <p className="font-semibold text-orange-700 text-sm">Poor: 10-19 Squats</p>
                      <p className="text-xs text-orange-800">Below-average lower limb strength; difficulty with stairs, rising from chairs</p>
                      <p className="text-xs text-orange-600 mt-1">• Significant risk for functional decline; recommend strengthening intervention</p>
                    </div>
                    <div className="bg-red-50 border border-red-300 rounded p-3">
                      <p className="font-semibold text-red-700 text-sm">Very Poor: &lt;10 Squats</p>
                      <p className="text-xs text-red-800">Severely limited lower limb strength; high fall risk (elderly)</p>
                      <p className="text-xs text-red-600 mt-1">• Screen for underlying pathology; recommend medical evaluation</p>
                    </div>
                  </div>

                  <div className="bg-white border border-purple-300 rounded p-3 mt-3 space-y-1">
                    <p className="font-semibold text-purple-900 text-sm">Test Quality Assessment:</p>
                    <p className="text-xs text-purple-800 mt-2">Record form quality during test (checked in data entry below):</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-purple-800 mt-2">
                      <li>Chest remained upright (no excessive forward lean)</li>
                      <li>Knees tracked over toes (no valgus/varus)</li>
                      <li>Achieved full depth (thighs at/below parallel)</li>
                      <li>No compensatory patterns (asymmetry, hip drop)</li>
                      <li>Maintained consistent pace (no significant fatigue-related breakdown)</li>
                    </ul>
                    <p className="text-xs text-purple-600 mt-2"><strong>Quality Score:</strong> Number of observed criteria met (0-5). Higher score indicates better form.</p>
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
                        <li><strong>Test-Retest Reliability:</strong> Excellent (ICC 0.85-0.95); highly reproducible</li>
                        <li><strong>Validity:</strong> Strong correlation with isokinetic leg strength (r=0.72-0.88)</li>
                        <li><strong>Correlates With:</strong> SPPB, 30-Second Sit-to-Stand, jump power tests</li>
                        <li><strong>Sensitivity:</strong> High sensitivity to training adaptations and detraining</li>
                      </ul>
                    </div>
                    <div className="bg-white border border-indigo-200 rounded p-3">
                      <p className="font-semibold text-indigo-900 text-sm mb-2">Age-Adjusted Normative Data (60-Second Test):</p>
                      <div className="text-xs text-indigo-800 space-y-1">
                        <p><strong>Adults 18-40 years:</strong> Good = 30-40+ squats | Average = 20-29 | Poor = &lt;20</p>
                        <p><strong>Adults 41-60 years:</strong> Good = 25-35+ squats | Average = 15-24 | Poor = &lt;15</p>
                        <p><strong>Older Adults 60+ years:</strong> Good = 15-25+ squats | Average = 10-14 | Poor = &lt;10</p>
                        <p className="mt-2 italic">Note: Normative data varies by population and fitness level. Values may differ based on sex (males typically higher) and training status.</p>
                      </div>
                    </div>
                    <div className="bg-white border border-indigo-200 rounded p-3">
                      <p className="font-semibold text-indigo-900 text-sm mb-2">Clinical Utility:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs text-indigo-800">
                        <li>Simple, low-cost, non-invasive assessment of lower limb strength</li>
                        <li>Sensitive to rehabilitation progress and training adaptations</li>
                        <li>Useful for pre-surgery baseline and post-operative rehabilitation screening</li>
                        <li>Fall risk assessment tool (especially older adults)</li>
                        <li>Baseline fitness assessment for athletes and general population</li>
                        <li>Correlates with functional independence in ADLs (stairs, transfers)</li>
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
                      href="https://pubmed.ncbi.nlm.nih.gov/10770693/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-amber-700 hover:underline text-xs"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span><strong>Jones CJ, Rikli RE, Beam WC. (1999).</strong> A 30-s chair-stand test as a measure of lower body strength in community-residing older adults. Res Q Exerc Sport 70(2):113-119</span>
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/11919660/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-amber-700 hover:underline text-xs"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span><strong>Rikli RE, Jones CJ. (2013).</strong> Senior Fitness Test Manual. Human Kinetics; validated assessment of lower limb strength</span>
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/15116629/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-amber-700 hover:underline text-xs"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span><strong>Guralnik JM, et al. (1994).</strong> Lower extremity function and subsequent disability: consistency across studies, predictive models, and value of gait speed alone. J Gerontol A Biol Sci Med Sci 55(4):M221-231</span>
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/23314289/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-amber-700 hover:underline text-xs"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span><strong>Sherrington C, et al. (2017).</strong> Exercise to prevent falls in older adults. Can J Aging 36(2):210-222; evidence for squat-based strengthening</span>
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/24477325/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-amber-700 hover:underline text-xs"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span><strong>ESSA (Exercise & Sports Science Australia). (2018).</strong> Outcome Measures: Lower Limb Strength & Power Assessment protocols</span>
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

            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="bodyWeight" className="font-semibold block mb-2">Body Weight (kg)</Label>
                <Input
                  id="bodyWeight"
                  type="number"
                  placeholder="e.g., 75"
                  value={bodyWeight}
                  onChange={(e) => setBodyWeight(e.target.value)}
                  disabled={isRunning}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="preTestNotes" className="font-semibold block mb-2">Pre-Test Notes</Label>
              <Textarea
                id="preTestNotes"
                value={preTestNotes}
                onChange={(e) => setPreTestNotes(e.target.value)}
                placeholder="Document: baseline mood, energy level, any pain or limitations, shoe type, warm-up performed..."
                rows={2}
                disabled={isRunning}
              />
            </div>

            <div className="border-2 border-slate-300 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-slate-50 space-y-4">
              <h3 className="font-bold text-lg text-slate-900">TEST EXECUTION</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 text-center border border-slate-300">
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Time Remaining</Label>
                  <div className={`text-4xl font-bold ${isRunning ? 'text-blue-600 animate-pulse' : 'text-slate-900'}`}>
                    {timeRemaining}s
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 text-center border border-slate-300">
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Squats Completed</Label>
                  <div className="text-4xl font-bold text-green-600">{squatCount}</div>
                  <div className="flex gap-2 justify-center mt-3">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleSquatDecrement}
                      disabled={!isRunning || squatCount === 0}
                      className="h-7 w-7 p-0"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleSquatIncrement}
                      disabled={!isRunning}
                      className="bg-green-600 hover:bg-green-700 h-7 px-3"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 text-center border border-slate-300">
                  <Label className="text-xs font-semibold text-slate-600 block mb-1">Interpretation</Label>
                  <div className={`text-sm font-bold ${interpretation.color}`}>
                    {interpretation.level}
                  </div>
                  <p className="text-xs text-slate-600 mt-2">Based on {squatCount} squats</p>
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
                  { key: "chestUp", label: "Chest maintained upright", desc: "No excessive forward lean" },
                  { key: "kneeTracking", label: "Knees tracked over toes", desc: "No valgus/varus collapse" },
                  { key: "fullDepth", label: "Full depth achieved", desc: "Thighs parallel or below parallel" },
                  { key: "noCompensation", label: "No compensatory patterns", desc: "Symmetrical, controlled movement" },
                  { key: "consistentPace", label: "Consistent pace maintained", desc: "No significant fatigue-related breakdown" },
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
              <p className="text-xs text-slate-600 mt-3"><strong>Quality Score:</strong> {Object.values(observations).filter(v => v).length}/5 criteria met</p>
            </div>

            <div>
              <Label htmlFor="postTestNotes" className="font-semibold block mb-2">Post-Test Notes</Label>
              <Textarea
                id="postTestNotes"
                value={postTestNotes}
                onChange={(e) => setPostTestNotes(e.target.value)}
                placeholder="Document: fatigue level (0-10), pain or discomfort, form breakdown observed, any adverse reactions, patient feedback..."
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
                placeholder="Overall assessment impression, comparison to previous results, recommendations for follow-up..."
                rows={3}
                disabled={!isRunning}
              />
            </div>
          </CardContent>
        </Card>

        {/* Control Buttons */}
        <div className="flex justify-between items-center gap-3 pt-4 border-t flex-wrap">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
          <Button onClick={handleSave} disabled={isRunning} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}