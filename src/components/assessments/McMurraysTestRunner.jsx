import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function McMurraysTestRunner({ client, onSave, onClose }) {
  const [preTestVitals, setPreTestVitals] = useState({ systolic: "", diastolic: "", heartRate: "" });
  const [postTestVitals, setPostTestVitals] = useState({ systolic: "", diastolic: "", heartRate: "" });
  const [expandedSection, setExpandedSection] = useState("instructions");
  const [testingStage, setTestingStage] = useState("vitals"); // "vitals" | "medial" | "lateral" | "complete"
  const [medialResults, setMedialResults] = useState([]);
  const [lateralResults, setLateralResults] = useState([]);
  const [notes, setNotes] = useState("");

  const handleStartVitals = () => {
    if (!preTestVitals.systolic || !preTestVitals.diastolic || !preTestVitals.heartRate) {
      toast.error("Please enter pre-test vital signs.");
      return;
    }
    setTestingStage("medial");
    toast.success("Begin Medial Meniscus Test (External Rotation)");
  };

  const handleAddMedialTrial = (result) => {
    setMedialResults([...medialResults, result]);
  };

  const handleAddLateralTrial = (result) => {
    setLateralResults([...lateralResults, result]);
  };

  const handleMedialComplete = () => {
    if (medialResults.length === 0) {
      toast.error("Please record at least one trial for the medial meniscus test.");
      return;
    }
    setTestingStage("lateral");
    toast.success("Begin Lateral Meniscus Test (Internal Rotation)");
  };

  const handleLateralComplete = () => {
    if (lateralResults.length === 0) {
      toast.error("Please record at least one trial for the lateral meniscus test.");
      return;
    }
    setTestingStage("complete");
    toast.success("Testing complete. Please enter post-test vitals.");
  };

  const handleFinalSave = () => {
    if (!postTestVitals.systolic || !postTestVitals.diastolic || !postTestVitals.heartRate) {
      toast.error("Please enter post-test vital signs.");
      return;
    }

    const medialPositive = medialResults.filter(r => r === "positive").length;
    const lateralPositive = lateralResults.filter(r => r === "positive").length;
    const totalPositive = medialPositive + lateralPositive;

    const soapText = `• McMurray's Test\n  Medial Meniscus: ${medialPositive}/${medialResults.length} positive\n  Lateral Meniscus: ${lateralPositive}/${lateralResults.length} positive\n  Total Positive: ${totalPositive}/${medialResults.length + lateralResults.length}`;

    const additionalData = {
      soap_text: soapText,
      measurement_type: "McMurray's Test",
      medial_results: medialResults,
      lateral_results: lateralResults,
      medial_positive: medialPositive,
      lateral_positive: lateralPositive,
      total_positive: totalPositive,
    };

    onSave({
      status: "completed",
      result_value: totalPositive,
      additional_data: additionalData,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("McMurray's Test completed and saved.");
  };

  const handleVitalsChange = (e, type, isPreTest) => {
    const { value } = e.target;
    const vitals = isPreTest ? preTestVitals : postTestVitals;
    vitals[type] = value;
    isPreTest ? setPreTestVitals({ ...vitals }) : setPostTestVitals({ ...vitals });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <Card>
        <CardHeader>
        <CardTitle>McMurray's Test Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
        {/* Collapsible Clinician Guide */}
        <button
          className="w-full flex justify-between items-center px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg font-semibold text-blue-900 hover:bg-blue-100 transition-colors"
          onClick={() => setExpandedSection(expandedSection === "instructions" ? null : "instructions")}
        >
          <span>📋 Clinical Instructions & Evidence</span>
          {expandedSection === "instructions" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expandedSection === "instructions" && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6 space-y-5 text-sm">
              <div>
                <p className="font-semibold text-blue-900 mb-2">Clinical Context: Meniscal Tear Detection</p>
                <p className="text-blue-800">
                  The McMurray's Test (McMurray's click test, modified McMurray's test) is a provocative maneuver used to detect meniscal tears in the knee joint. It is one of the most commonly used clinical special tests in orthopaedic physical examination, particularly for patients presenting with knee pain, instability, or mechanical symptoms (locking, catching, clicking). However, modern evidence indicates that McMurray's Test alone has limited diagnostic accuracy (~57% sensitivity, ~77% specificity) and is best used as part of a clinical examination cluster with Thessaly test, joint-line tenderness, and magnetic resonance imaging (MRI) findings.
                </p>
              </div>

              <div>
                <p className="font-semibold text-blue-900 mb-2">Anatomical Basis: The Menisci</p>
                <div className="bg-white p-3 rounded border border-blue-200 space-y-2 text-xs">
                  <p className="text-blue-800"><strong>Medial Meniscus (C-shaped):</strong> More fixed posteriorly; more prone to degenerative tears and peripheral tears. Meniscal tears here often produce pain at medial joint line and may cause mechanical catching.</p>
                  <p className="text-blue-800"><strong>Lateral Meniscus (O-shaped):</strong> More mobile; prone to traumatic tears and bucket-handle tears (can cause acute locking with inability to extend knee fully). Positive McMurray's at lateral joint line suggests lateral meniscal tear.</p>
                  <p className="text-blue-800"><strong>⚠ Why McMurray's has low sensitivity:</strong> Not all meniscal tears produce a click. Tears posterior, on the central capsular surface, or degenerative tears may not be mechanically detected by McMurray's. False negatives are common, especially in chronic knee pain.</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-blue-900 mb-2">Detailed Administration: Step-by-Step</p>
                <div className="bg-white p-3 rounded border border-blue-200 space-y-3">
                  <div className="border-l-4 border-red-400 pl-3">
                    <p className="font-semibold text-red-900">🔴 <strong>Patient Position & Setup</strong></p>
                    <ul className="text-blue-800 text-xs list-disc list-inside mt-1 space-y-1">
                      <li><strong>Supine:</strong> Patient lies on back, knees fully extended initially.</li>
                      <li><strong>Fully flex tested knee:</strong> Flex to ~90° (or more if tolerated).</li>
                      <li><strong>Hand placement:</strong> One hand grasps heel, other hand placed over knee joint (lateral aspect for medial meniscus test, medial for lateral meniscus test).</li>
                      <li><strong>Note:</strong> Some clinicians keep the test knee below the contralateral knee (resting on the contralateral extended leg) for stability.</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-amber-400 pl-3">
                    <p className="font-semibold text-amber-900">🟠 <strong>Medial Meniscus McMurray's Test (Modified)</strong></p>
                    <ol className="text-blue-800 text-xs list-decimal list-inside mt-1 space-y-1">
                      <li><strong>Starting position:</strong> Knee flexed 90°, foot flat on table.</li>
                      <li><strong>Tibia rotation:</strong> With heel in hand, <strong>externally rotate</strong> (turn outward) the tibia/foot ~90° (patient's toes point outward).</li>
                      <li><strong>Extend knee:</strong> While maintaining external rotation, slowly <strong>extend</strong> the knee from full flexion toward full extension.</li>
                      <li><strong>Palpate joint line:</strong> With other hand, palpate <strong>medial joint line</strong> during extension.</li>
                      <li><strong>Positive sign:</strong> <strong>Audible or palpable click/pop</strong> felt at medial joint line DURING extension, OR patient reports sharp pain at medial joint line that is reproducible.</li>
                    </ol>
                    <p className="text-blue-800 text-xs mt-2"><strong>Why this direction?</strong> External tibial rotation + knee extension tightens the medial meniscus; if torn, the loose fragment "catches" and produces a click as the knee extends.</p>
                  </div>

                  <div className="border-l-4 border-emerald-400 pl-3">
                    <p className="font-semibold text-emerald-900">🟢 <strong>Lateral Meniscus McMurray's Test (Modified)</strong></p>
                    <ol className="text-blue-800 text-xs list-decimal list-inside mt-1 space-y-1">
                      <li><strong>Starting position:</strong> Knee flexed 90°, foot flat on table.</li>
                      <li><strong>Tibia rotation:</strong> With heel in hand, <strong>internally rotate</strong> (turn inward) the tibia/foot ~90° (patient's toes point inward).</li>
                      <li><strong>Extend knee:</strong> While maintaining internal rotation, slowly <strong>extend</strong> the knee toward full extension.</li>
                      <li><strong>Palpate joint line:</strong> With other hand, palpate <strong>lateral joint line</strong> during extension.</li>
                      <li><strong>Positive sign:</strong> <strong>Audible or palpable click/pop</strong> at lateral joint line DURING extension, OR sharp pain at lateral joint line.</li>
                    </ol>
                    <p className="text-blue-800 text-xs mt-2"><strong>Why this direction?</strong> Internal tibial rotation + knee extension puts the lateral meniscus under tension; torn fragments click as knee extends.</p>
                  </div>

                  <div className="border-l-4 border-purple-400 pl-3">
                    <p className="font-semibold text-purple-900">🟣 <strong>Key Clinical Cues to Give Patient</strong></p>
                    <p className="text-blue-800 text-xs italic mt-1">"I'm going to gently move your knee. Tell me if you feel any clicking, catching, snapping, or sharp pain as I move it. A click or catch is what I'm listening for."</p>
                    <p className="text-blue-800 text-xs mt-2"><strong>Reassurance:</strong> "This is a gentle test and should not cause significant pain. If it becomes painful, let me know and I'll stop."</p>
                  </div>

                  <div className="border-l-4 border-blue-400 pl-3">
                    <p className="font-semibold text-blue-900">🔵 <strong>Clinical Nuance: Click vs. Pain</strong></p>
                    <p className="text-blue-800 text-xs mt-1"><strong>Mechanical click/pop:</strong> More specific for meniscal tear (displaced fragment). Stronger diagnostic indicator.</p>
                    <p className="text-blue-800 text-xs mt-2"><strong>Pain alone (no click):</strong> Less specific; may indicate meniscal tear, capsular irritation, OA, or other pathology. Sensitivity only ~57%.</p>
                    <p className="text-blue-800 text-xs mt-2"><strong>⚠ False positives:</strong> Crepitus (cartilage roughness) or ligament snapping can mimic a meniscal click. Distinguish by location and reproducibility.</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="font-semibold text-blue-900 mb-2">Diagnostic Accuracy & Interpretation</p>
                <div className="bg-white p-3 rounded border border-blue-200 space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-blue-300 bg-white">
                      <thead className="bg-blue-200"><tr><th className="p-2 text-left">Test Characteristic</th><th className="p-2 text-left">Value</th><th className="p-2 text-left">Clinical Meaning</th></tr></thead>
                      <tbody>
                        <tr className="border-t"><td className="p-2 font-medium">Sensitivity</td><td className="p-2">~50–70%*</td><td className="p-2">Misses ~30–50% of meniscal tears (many false negatives); cannot rule out tear</td></tr>
                        <tr className="border-t"><td className="p-2 font-medium">Specificity</td><td className="p-2">~70–85%*</td><td className="p-2">If positive with click, somewhat likely a tear; but pain alone is non-specific</td></tr>
                        <tr className="border-t"><td className="p-2 font-medium">Positive LR</td><td className="p-2">~2.0–3.0</td><td className="p-2">Moderately increases likelihood of tear; not diagnostic alone</td></tr>
                        <tr className="border-t"><td className="p-2 font-medium">Negative LR</td><td className="p-2">~0.4–0.6</td><td className="p-2">Negative test still does NOT rule out tear</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-blue-800 text-xs"><strong>*Values vary by study.</strong> Modern meta-analyses show McMurray's alone is insufficient for diagnosis. Should be used with other tests (Thessaly, joint-line tenderness, Lachman/pivot shift for ACL, history of locking/catching).</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-blue-900 mb-2">Clinical Decision-Making: Interpretation Scenarios</p>
                <div className="bg-white p-3 rounded border border-blue-200 space-y-2">
                  <p className="text-blue-800 text-xs"><strong>✅ McMurray's POSITIVE (click/pop at joint line) + Joint-line tenderness + Thessaly positive:</strong> High likelihood of meniscal tear. Consider MRI referral for confirmation and surgical planning.</p>
                  <p className="text-blue-800 text-xs"><strong>⚠ McMurray's POSITIVE (pain only, no click) + Other tests negative:</strong> Non-specific; may indicate OA, capsular irritation, or referred pain. Does not strongly suggest tear. Continue conservative management.</p>
                  <p className="text-blue-800 text-xs"><strong>❌ McMurray's NEGATIVE but history of acute locking, catching, knee instability:</strong> Do NOT rule out meniscal tear; sensitivity is only ~50–60%. Perform Thessaly test, check for joint-line tenderness, and consider MRI if high clinical suspicion.</p>
                  <p className="text-blue-800 text-xs"><strong>📊 No mechanical symptoms but McMurray's positive:</strong> Low likelihood of acute tear; may indicate degenerative meniscal changes or OA. Monitor and reassess.</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-blue-900 mb-2">Meniscal Tear Patterns & Prognosis</p>
                <div className="bg-white p-3 rounded border border-blue-200 space-y-2 text-xs">
                  <p className="text-blue-800"><strong>Peripheral tears (red-red zone):</strong> Better blood supply; may heal with conservative management or repair surgery.</p>
                  <p className="text-blue-800"><strong>Radial tears:</strong> Central location; limited healing potential; may require meniscectomy or root repair.</p>
                  <p className="text-blue-800"><strong>Horizontal/degenerative tears:</strong> Often asymptomatic; common in older adults with OA. May not require surgery.</p>
                  <p className="text-blue-800"><strong>Bucket-handle tears:</strong> Acute, severe displacement; classic "locking" presentation; often requires surgical repair.</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-blue-900 mb-2">Contraindications & Precautions</p>
                <ul className="text-blue-800 list-disc list-inside space-y-1 text-xs">
                  <li><strong>Acute ACL injury / severe instability:</strong> Avoid McM if knee is acutely unstable; perform Lachman/pivot shift first.</li>
                  <li><strong>Severe knee pain / recent trauma:</strong> Defer test until acute pain settles; risk of false positives from pain guarding.</li>
                  <li><strong>Full knee flexion contraindicated:</strong> If patient has limited ROM or pain at end-range, do not force.</li>
                  <li><strong>Post-operative knee (recent meniscectomy/repair):</strong> Follow physician clearance; typically avoid &lt;6 weeks post-op.</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-blue-900 mb-2">Clustering McMurray's with Other Tests (Best Practice)</p>
                <div className="bg-white p-3 rounded border border-blue-200 space-y-2 text-xs">
                  <p className="text-blue-800"><strong>Meniscal tests cluster:</strong> McMurray's + Thessaly Test + Joint-line Tenderness. If 2/3 positive, likelihood of meniscal tear increases significantly.</p>
                  <p className="text-blue-800"><strong>ACL stability tests:</strong> Lachman, Pivot Shift, Anterior Drawer. Rule out ACL tear (often coexists with meniscal injury).</p>
                  <p className="text-blue-800"><strong>General knee exam:</strong> ROM, effusion, Patellar mobility, muscle strength, proprioception.</p>
                  <p className="text-blue-800"><strong>Imaging:</strong> MRI gold standard for meniscal imaging (sensitivity/specificity &gt;90%); ultrasound increasingly used by trained clinicians.</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-blue-900 mb-2">Evidence Base & References</p>
                <div className="bg-white p-3 rounded border border-blue-200 space-y-2 text-xs">
                  <p><strong>Classic Description:</strong> McMurray TP. (1942). The semilunar cartilages. <em>British Journal of Surgery, 29</em>(116):407–414. <a href="https://doi.org/10.1002/bjs.18002911625" target="_blank" className="text-blue-600 hover:underline inline-flex items-center gap-1">DOI <ExternalLink className="w-3 h-3" /></a></p>
                  <p><strong>Modern Meta-Analysis:</strong> Hegedus EJ, Wang DX, Carino J, et al. (2015). Physical examination tests of the knee: a systematic review with meta-analysis. <em>British Journal of Sports Medicine, 49</em>(5):298–305. DOI: <a href="https://doi.org/10.1136/bjsports-2014-094119" target="_blank" className="text-blue-600 hover:underline inline-flex items-center gap-1">10.1136/bjsports-2014-094119 <ExternalLink className="w-3 h-3" /></a></p>
                  <p><strong>Clinical Utility Review:</strong> Logerstedt DS, Snyder-Mackler L, Ritter RC, et al. (2010). Knee stability and movement coordination impairments: Knee ligament sprain revision of the APTA Clinical Practice Guideline. <em>Journal of Orthopaedic & Sports Physical Therapy, 40</em>(4):A1–A37.</p>
                  <p><strong>ESSA / APA Guidelines:</strong> Australian Physiotherapy Association and Exercise & Sports Science Australia recommend clinical examination clusters (not single tests) for meniscal tear detection; MRI when clinically indicated.</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-blue-900 mb-2">Position Demonstration & Visual Learning</p>
                <p className="text-blue-800 text-xs">For detailed video demonstrations of McMurray's Test, refer to reliable clinical resources:</p>
                <ul className="text-blue-800 text-xs list-disc list-inside mt-1 space-y-1">
                  <li><strong>JOSPT (Journal of Orthopaedic & Sports Physical Therapy):</strong> Video library with position demonstrations.</li>
                  <li><strong>OrthopaedicsOne / OrthopedicsOne.com:</strong> Peer-reviewed orthopaedic knowledge resource.</li>
                  <li><strong>Clinician should practice positioning:</strong> Perform on several volunteers to develop palpation skill; a gentle, smooth motion improves accuracy.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
          <div className="space-y-4">
             <div>
               <Label>Client: {client?.full_name || "Unknown"}</Label>
             </div>

             {/* Stage 1: Pre-Test Vitals */}
             {testingStage === "vitals" && (
               <Card className="border-blue-200 bg-blue-50">
                 <CardHeader>
                   <CardTitle className="text-base">Step 1: Pre-Test Assessment</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                   <div>
                     <Label className="font-semibold text-blue-900">Pre-Test Vital Signs</Label>
                     <div className="grid grid-cols-3 gap-4 mt-2">
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
                   <Button onClick={handleStartVitals} className="w-full bg-blue-600 hover:bg-blue-700">
                     <Play size={16} className="mr-2" />
                     Proceed to Medial Meniscus Test
                   </Button>
                 </CardContent>
               </Card>
             )}

             {/* Stage 2: Medial Meniscus Test */}
             {(testingStage === "medial" || testingStage === "lateral" || testingStage === "complete") && (
               <Card className={testingStage === "medial" ? "border-amber-200 bg-amber-50" : "border-slate-200"}>
                 <CardHeader>
                   <CardTitle className="text-base">Step 2: Medial Meniscus Test (External Rotation)</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-3">
                   <p className="text-sm text-slate-700 italic">Externally rotate tibia ~90°, then slowly extend knee. Palpate medial joint line. Listen/feel for click or sharp pain.</p>
                   <div className="space-y-2">
                     {medialResults.map((result, idx) => (
                       <div key={idx} className="flex items-center gap-2">
                         <Badge variant={result === "positive" ? "destructive" : "outline"}>{result}</Badge>
                         <Button variant="link" size="sm" onClick={() => setMedialResults(medialResults.filter((_, i) => i !== idx))}>
                           <X size={14} />
                         </Button>
                       </div>
                     ))}
                     {testingStage === "medial" && (
                       <div className="flex gap-2 mt-3">
                         <Button onClick={() => handleAddMedialTrial("positive")} variant="destructive" className="flex-1">
                           Positive (Click/Pain)
                         </Button>
                         <Button onClick={() => handleAddMedialTrial("negative")} variant="outline" className="flex-1">
                           Negative
                         </Button>
                       </div>
                     )}
                   </div>
                   {testingStage === "medial" && (
                     <Button onClick={handleMedialComplete} disabled={medialResults.length === 0} className="w-full">
                       Complete Medial Test → Lateral Test
                     </Button>
                   )}
                 </CardContent>
               </Card>
             )}

             {/* Stage 3: Lateral Meniscus Test */}
             {(testingStage === "lateral" || testingStage === "complete") && (
               <Card className={testingStage === "lateral" ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}>
                 <CardHeader>
                   <CardTitle className="text-base">Step 3: Lateral Meniscus Test (Internal Rotation)</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-3">
                   <p className="text-sm text-slate-700 italic">Internally rotate tibia ~90°, then slowly extend knee. Palpate lateral joint line. Listen/feel for click or sharp pain.</p>
                   <div className="space-y-2">
                     {lateralResults.map((result, idx) => (
                       <div key={idx} className="flex items-center gap-2">
                         <Badge variant={result === "positive" ? "destructive" : "outline"}>{result}</Badge>
                         <Button variant="link" size="sm" onClick={() => setLateralResults(lateralResults.filter((_, i) => i !== idx))}>
                           <X size={14} />
                         </Button>
                       </div>
                     ))}
                     {testingStage === "lateral" && (
                       <div className="flex gap-2 mt-3">
                         <Button onClick={() => handleAddLateralTrial("positive")} variant="destructive" className="flex-1">
                           Positive (Click/Pain)
                         </Button>
                         <Button onClick={() => handleAddLateralTrial("negative")} variant="outline" className="flex-1">
                           Negative
                         </Button>
                       </div>
                     )}
                   </div>
                   {testingStage === "lateral" && (
                     <Button onClick={handleLateralComplete} disabled={lateralResults.length === 0} className="w-full">
                       Complete Lateral Test → Post-Test Vitals
                     </Button>
                   )}
                 </CardContent>
               </Card>
             )}

             {/* Stage 4: Post-Test */}
             {testingStage === "complete" && (
               <Card className="border-green-200 bg-green-50">
                 <CardHeader>
                   <CardTitle className="text-base">Step 4: Post-Test Assessment</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                   <div>
                     <Label className="font-semibold text-green-900">Post-Test Vital Signs</Label>
                     <div className="grid grid-cols-3 gap-4 mt-2">
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
                     <Label>Clinical Notes</Label>
                     <Textarea 
                       value={notes} 
                       onChange={(e) => setNotes(e.target.value)} 
                       placeholder="Patient response, reproduction of symptoms, clinical impression, recommendations..." 
                       rows={4}
                     />
                   </div>
                   <Button onClick={handleFinalSave} className="w-full bg-green-600 hover:bg-green-700">
                     <Save size={16} className="mr-2" />
                     Save McMurray's Test Results
                   </Button>
                 </CardContent>
               </Card>
             )}

             {/* Progress Indicator */}
             {testingStage !== "vitals" && (
               <div className="bg-slate-100 rounded p-3 text-sm">
                 <p className="font-semibold text-slate-700 mb-2">Test Progress</p>
                 <div className="space-y-1 text-xs text-slate-600">
                   <p>✅ Pre-Test Vitals</p>
                   <p className={medialResults.length > 0 ? "✅" : "⏳"}> Medial Meniscus: {medialResults.length} trials</p>
                   <p className={lateralResults.length > 0 ? "✅" : "⏳"}> Lateral Meniscus: {lateralResults.length} trials</p>
                   <p className={testingStage === "complete" ? "⏳" : ""}> Post-Test Vitals</p>
                 </div>
               </div>
             )}
           </div>
        </CardContent>
      </Card>
      <div className="flex justify-between">
         <Button variant="outline" onClick={onClose}>
           <X size={16} />
           Close
         </Button>
       </div>
      </div>
    </div>
  );
}