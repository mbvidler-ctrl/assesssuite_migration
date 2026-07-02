import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function ObersTestITBTightnessRunner({ client, onSave, onClose }) {
  const [testingStage, setTestingStage] = useState("vitals"); // "vitals" | "test" | "complete"
  const [preTestVitals, setPreTestVitals] = useState({ systolic: "", diastolic: "", heartRate: "" });
  const [postTestVitals, setPostTestVitals] = useState({ systolic: "", diastolic: "", heartRate: "" });
  const [bilateralResults, setBilateralResults] = useState({ left: null, right: null });
  const [notes, setNotes] = useState("");
  const [showClinicianInfo, setShowClinicianInfo] = useState(false);

  const handleStartTest = () => {
    if (!preTestVitals.systolic || !preTestVitals.diastolic || !preTestVitals.heartRate) {
      toast.error("Please enter pre-test vital signs.");
      return;
    }
    setTestingStage("test");
    toast.success("Begin Ober's Test assessment on both sides.");
  };

  const handleBilateralResult = (side, result) => {
    setBilateralResults(prev => ({ ...prev, [side]: result }));
  };

  const handleCompleteTest = () => {
    if (bilateralResults.left === null || bilateralResults.right === null) {
      toast.error("Please assess both left and right sides.");
      return;
    }
    setTestingStage("complete");
    toast.success("Testing complete. Please enter post-test vitals and notes.");
  };

  const handleFinalSave = () => {
    if (!postTestVitals.systolic || !postTestVitals.diastolic || !postTestVitals.heartRate) {
      toast.error("Please enter post-test vital signs.");
      return;
    }

    const positiveCount = (bilateralResults.left === "positive" ? 1 : 0) + (bilateralResults.right === "positive" ? 1 : 0);
    const soapText = `â€¢ Ober's Test (ITB Tightness)\n  Left: ${bilateralResults.left}\n  Right: ${bilateralResults.right}\n  Interpretation: ${
      positiveCount === 2 ? "Bilateral ITB tightness" :
      positiveCount === 1 ? "Unilateral ITB tightness" :
      "No ITB tightness detected"
    }`;

    const additionalData = {
      soap_text: soapText,
      measurement_type: "obers_test",
      left_result: bilateralResults.left,
      right_result: bilateralResults.right,
      positive_count: positiveCount,
    };

    onSave({
      status: "completed",
      result_value: positiveCount,
      additional_data: additionalData,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Ober's Test results saved successfully.");
  };

  const handleVitalsChange = (e, type, isPreTest) => {
    const { value } = e.target;
    const vitals = isPreTest ? preTestVitals : postTestVitals;
    vitals[type] = value;
    isPreTest ? setPreTestVitals({ ...vitals }) : setPostTestVitals({ ...vitals });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Ober's Test (ITB Tightness)</h2>
              <p className="text-slate-600 mt-1">Iliotibial Band Flexibility Assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            
            {/* Clinician Info */}
            <button
              className="w-full flex justify-between items-center px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg font-semibold text-purple-900 text-sm hover:bg-purple-100 transition-colors"
              onClick={() => setShowClinicianInfo(!showClinicianInfo)}
            >
              <span className="flex items-center gap-2">ðŸ“‹ Clinician Information & Evidence</span>
              {showClinicianInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showClinicianInfo && (
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="pt-6 space-y-4 text-sm">
                  <div>
                    <p className="font-semibold text-purple-900 mb-2">Purpose & Clinical Context</p>
                    <p className="text-purple-800">
                      Ober's Test (modified Ober's test, Ober's abduction test) is a clinical special test used to assess iliotibial band (ITB) tightness and hip abductor flexibility. It is commonly used to identify ITB syndrome (ITBS), which presents with lateral knee pain, particularly in runners and cyclists. The test evaluates whether tight hip abductors (gluteus medius, tensor fasciae latae) and a tight ITB may be contributing to lateral knee or hip pain.
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-purple-900 mb-2">Anatomical Basis: The ITB System</p>
                    <div className="bg-white p-3 rounded border border-purple-100 space-y-2">
                      <p className="text-purple-800 text-xs"><strong>Iliotibial Band (ITB):</strong> Fascial structure extending from tensor fasciae latae (TFL) and gluteus maximus at hip, distally attaching to lateral tibia (Gerdy's tubercle). Acts as hip abductor, external rotator, and knee stabilizer.</p>
                      <p className="text-purple-800 text-xs"><strong>Tightness mechanism:</strong> Tight ITB increases compressive forces on lateral knee structures, causing friction over lateral femoral condyle during knee flexion/extension. Results in lateral knee pain, especially running or repetitive hip/knee movements.</p>
                      <p className="text-purple-800 text-xs"><strong>Risk factors:</strong> Weak gluteus medius, hip muscle imbalance, increased hip adduction during running, tight hip flexors, muscle fatigue.</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-purple-900 mb-2">Administration: Step-by-Step Guide</p>
                    <div className="bg-white p-3 rounded border border-purple-100 space-y-3">
                      <div>
                        <p className="font-semibold text-purple-900 text-xs">ðŸ”´ <strong>Patient Position & Setup</strong></p>
                        <ul className="text-purple-800 text-xs list-disc list-inside mt-1 space-y-1">
                          <li><strong>Side-lying position:</strong> Patient lies on side being tested (tested knee on top).</li>
                          <li><strong>Hip neutral:</strong> Bottom hip flexed to 45Â° to stabilize pelvis and prevent lumbar extension compensation.</li>
                          <li><strong>Bottom knee flexed:</strong> Support lower knee flexion to anchor pelvis and prevent pelvic rolling.</li>
                          <li><strong>Head neutral:</strong> Chin tuck, neck neutral to avoid cervical strain.</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-semibold text-purple-900 text-xs">ðŸŸ  <strong>Testing Procedure (Classical Modified Ober's)</strong></p>
                        <ol className="text-purple-800 text-xs list-decimal list-inside mt-1 space-y-1">
                          <li><strong>Tested hip position:</strong> Hip abducted 45Â° (or to neutral if tighter), knee extended fully.</li>
                          <li><strong>Clinician hand placement:</strong> One hand on knee, other stabilizing pelvis at iliac crest.</li>
                          <li><strong>Action:</strong> Clinician slowly lowers abducted leg toward table (adduction).</li>
                          <li><strong>Positive sign:</strong> Tested knee CANNOT reach table/neutral adduction position; stays abducted due to ITB/TFL tightness.</li>
                          <li><strong>End-feel:</strong> Firm stretch/tension at hip; no pain (or mild stretch sensation).</li>
                        </ol>
                        <p className="text-purple-800 text-xs mt-2"><strong>Key technique point:</strong> Ensure pelvis does NOT rotate. Pelvic anterior/posterior tilt or rolling invalidates test. Use bottom hand to monitor pelvic stability.</p>
                      </div>

                      <div>
                        <p className="font-semibold text-purple-900 text-xs">ðŸŸ¢ <strong>Clinical Cues & Instructions</strong></p>
                        <p className="text-purple-800 text-xs italic mt-1">"I'm going to lower your upper leg down toward the table. Let gravity do the work; I want to see how far your hip can relax. Tell me if you feel tightness at the outside of the hip."</p>
                      </div>

                      <div>
                        <p className="font-semibold text-purple-900 text-xs">ðŸ”µ <strong>Interpretation of Results</strong></p>
                        <p className="text-purple-800 text-xs mt-1"><strong>Negative (Normal):</strong> Knee reaches table or goes past neutral adduction. ITB is flexible; no apparent tightness.</p>
                        <p className="text-purple-800 text-xs mt-2"><strong>Positive (ITB Tightness):</strong> Knee stays abducted, cannot reach neutral or table. Suggests ITB/hip abductor tightness contributing to hip/knee dysfunction.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-purple-900 mb-2">Diagnostic Accuracy & Limitations</p>
                    <div className="bg-white p-3 rounded border border-purple-100 space-y-2 text-xs">
                      <p className="text-purple-800"><strong>Sensitivity:</strong> ~45â€“80% (varies by study). Many patients with ITBS may have negative Ober's.</p>
                      <p className="text-purple-800"><strong>Specificity:</strong> ~40â€“80% (non-specific). ITB tightness alone doesn't diagnose ITBS; often requires symptom reproduction + imaging.</p>
                      <p className="text-purple-800"><strong>âš ï¸ Clinical note:</strong> A tight ITB is not synonymous with ITB syndrome. Approximately 10â€“15% of asymptomatic runners have ITB tightness. Test must be combined with pain history, lateral knee pain reproduction (Noble's test, ITB palpation), and functional assessment.</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-purple-900 mb-2">Clinical Interpretation Scenarios</p>
                    <div className="bg-white p-3 rounded border border-purple-100 space-y-2 text-xs">
                      <p className="text-purple-800"><strong>âœ… Ober's POSITIVE + Lateral knee pain + Pain with running:</strong> Strong likelihood of ITB syndrome. Recommend hip abductor strengthening, hip mobility work, running load management, consider foam rolling/massage.</p>
                      <p className="text-purple-800"><strong>âš ï¸ Ober's POSITIVE but NO lateral knee pain:</strong> May indicate tightness without current dysfunction. Monitor; recommend preventive hip/glute strengthening.</p>
                      <p className="text-purple-800"><strong>âŒ Ober's NEGATIVE + Lateral knee pain:</strong> Pain may be from other sources (patellofemoral, knee OA, other ligament/capsule). Do NOT rule out ITBS; sensitivity is only ~50â€“60%.</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-purple-900 mb-2">Evidence Base & References</p>
                    <div className="bg-white p-3 rounded border border-purple-100 space-y-2 text-xs">
                      <p><strong>Classic Ober Description:</strong> Ober FR. (1936). Back strain and sciatic pain. <em>Journal of the American Medical Association, 104</em>(17), 1595â€“1602.</p>
                      <p><strong>Modern Diagnostic Review:</strong> Fredericson M, Weir A. (2016). Practical management of iliotibial band syndrome in runners. <em>Clinical Journal of Sport Medicine, 26</em>(5), 407â€“417.</p>
                      <p><strong>Sensitivity/Specificity Meta-Analysis:</strong> Hegedus EJ, et al. (2015). Physical examination tests of the knee: a systematic review with meta-analysis. <em>British Journal of Sports Medicine, 49</em>(5), 298â€“305.</p>
                      <p><strong>ESSA / APA Guidelines:</strong> Exercise & Sports Science Australia recommend clinical examination clusters (not single tests) for ITBS; imaging (MRI/ultrasound) confirmatory when indicated.</p>
                      <Button
                        onClick={() => window.open('https://journals.sagepub.com/doi/10.1177/0363546516634477', '_blank')}
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 w-full justify-start mt-2"
                      >
                        <ExternalLink className="w-3 h-3 mr-2" />
                        ITBS Management Review (Fredericson & Weir, 2016)
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-purple-900 mb-2">Key Clinical Tips & Precautions</p>
                    <ul className="text-purple-800 list-disc list-inside space-y-1 text-xs">
                      <li><strong>Pelvic stability is critical:</strong> Monitor for anterior/posterior pelvic tilt or hip hiking. Invalid test if pelvis rolls.</li>
                      <li><strong>Distinguish pain from stretch:</strong> Test should produce mild stretch, NOT pain. Pain may indicate other pathology.</li>
                      <li><strong>Unilateral vs. bilateral:</strong> Always test both sides; compare for asymmetry.</li>
                      <li><strong>Complement with other tests:</strong> Use Noble's test (knee flexion compression), Thomas test (hip flexor), single-leg squat for functional assessment.</li>
                      <li><strong>Treatment focus:</strong> If positive, address weak gluteus medius, tight hip flexors, and running mechanics (excessive hip adduction).</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stage 1: Pre-Test Vitals */}
            {testingStage === "vitals" && (
              <Card className="border-purple-200 bg-purple-50">
                <CardHeader>
                  <CardTitle className="text-base">Step 1: Pre-Test Assessment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="font-semibold text-purple-900">Client: {client?.full_name || "Unknown"}</Label>
                  </div>
                  <div>
                    <Label className="font-semibold text-purple-900 block mb-3">Pre-Test Vital Signs</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <Input
                        type="number"
                        placeholder="Systolic"
                        value={preTestVitals.systolic}
                        onChange={(e) => handleVitalsChange(e, "systolic", true)}
                      />
                      <Input
                        type="number"
                        placeholder="Diastolic"
                        value={preTestVitals.diastolic}
                        onChange={(e) => handleVitalsChange(e, "diastolic", true)}
                      />
                      <Input
                        type="number"
                        placeholder="Heart Rate"
                        value={preTestVitals.heartRate}
                        onChange={(e) => handleVitalsChange(e, "heartRate", true)}
                      />
                    </div>
                  </div>
                  <Button onClick={handleStartTest} className="w-full bg-purple-600 hover:bg-purple-700">
                    <Play className="w-4 h-4 mr-2" />
                    Proceed to Bilateral Assessment
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Stage 2: Bilateral Testing */}
            {(testingStage === "test" || testingStage === "complete") && (
              <>
                <Card className={testingStage === "test" ? "border-pink-200 bg-pink-50" : "border-slate-200"}>
                  <CardHeader>
                    <CardTitle className="text-base">Step 2: Ober's Test â€” Left Side</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-slate-700 italic">Patient side-lying on right side. Left hip abducted 45Â°, knee extended. Lower leg with gravity; assess if knee reaches neutral/table.</p>
                    <div className="space-y-2">
                      {bilateralResults.left && (
                        <Badge variant={bilateralResults.left === "positive" ? "destructive" : "outline"}>
                          {bilateralResults.left === "positive" ? "ITB Tightness" : "Normal"}
                        </Badge>
                      )}
                      {testingStage === "test" && (
                        <div className="flex gap-2">
                          <Button onClick={() => handleBilateralResult("left", "positive")} variant={bilateralResults.left === "positive" ? "default" : "outline"} className="flex-1">
                            Positive (Tight ITB)
                          </Button>
                          <Button onClick={() => handleBilateralResult("left", "negative")} variant={bilateralResults.left === "negative" ? "default" : "outline"} className="flex-1">
                            Negative (Normal)
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className={testingStage === "test" ? "border-pink-200 bg-pink-50" : "border-slate-200"}>
                  <CardHeader>
                    <CardTitle className="text-base">Step 2: Ober's Test â€” Right Side</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-slate-700 italic">Patient side-lying on left side. Right hip abducted 45Â°, knee extended. Lower leg with gravity; assess if knee reaches neutral/table.</p>
                    <div className="space-y-2">
                      {bilateralResults.right && (
                        <Badge variant={bilateralResults.right === "positive" ? "destructive" : "outline"}>
                          {bilateralResults.right === "positive" ? "ITB Tightness" : "Normal"}
                        </Badge>
                      )}
                      {testingStage === "test" && (
                        <div className="flex gap-2">
                          <Button onClick={() => handleBilateralResult("right", "positive")} variant={bilateralResults.right === "positive" ? "default" : "outline"} className="flex-1">
                            Positive (Tight ITB)
                          </Button>
                          <Button onClick={() => handleBilateralResult("right", "negative")} variant={bilateralResults.right === "negative" ? "default" : "outline"} className="flex-1">
                            Negative (Normal)
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {testingStage === "test" && (
                  <Button onClick={handleCompleteTest} disabled={bilateralResults.left === null || bilateralResults.right === null} className="w-full">
                    Complete Assessment â†’ Post-Test Vitals
                  </Button>
                )}
              </>
            )}

            {/* Stage 3: Post-Test */}
            {testingStage === "complete" && (
              <>
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-base">Step 3: Post-Test Assessment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="font-semibold text-green-900 block mb-3">Post-Test Vital Signs</Label>
                      <div className="grid grid-cols-3 gap-4">
                        <Input
                          type="number"
                          placeholder="Systolic"
                          value={postTestVitals.systolic}
                          onChange={(e) => handleVitalsChange(e, "systolic", false)}
                        />
                        <Input
                          type="number"
                          placeholder="Diastolic"
                          value={postTestVitals.diastolic}
                          onChange={(e) => handleVitalsChange(e, "diastolic", false)}
                        />
                        <Input
                          type="number"
                          placeholder="Heart Rate"
                          value={postTestVitals.heartRate}
                          onChange={(e) => handleVitalsChange(e, "heartRate", false)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="font-semibold">Clinical Notes</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Patient's hip flexibility, compensation patterns, pain response, pelvic stability, recommendations for management..."
                        rows={4}
                      />
                    </div>
                    <Button onClick={handleFinalSave} className="w-full bg-green-600 hover:bg-green-700">
                      <Save className="w-4 h-4 mr-2" />
                      Save Ober's Test Results
                    </Button>
                  </CardContent>
                </Card>

                {/* Summary */}
                <Card className="bg-slate-100">
                  <CardContent className="pt-6">
                    <p className="font-semibold text-slate-700 mb-2">Test Summary</p>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p>Left Side: <Badge variant={bilateralResults.left === "positive" ? "destructive" : "outline"}>{bilateralResults.left === "positive" ? "Tight ITB" : "Normal"}</Badge></p>
                      <p>Right Side: <Badge variant={bilateralResults.right === "positive" ? "destructive" : "outline"}>{bilateralResults.right === "positive" ? "Tight ITB" : "Normal"}</Badge></p>
                      <p className="mt-2 font-semibold">
                        {bilateralResults.left === "positive" && bilateralResults.right === "positive" ? "âš ï¸ Bilateral ITB tightness detected" :
                         bilateralResults.left === "positive" || bilateralResults.right === "positive" ? "âš ï¸ Unilateral ITB tightness detected" :
                         "âœ… No ITB tightness detected"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}