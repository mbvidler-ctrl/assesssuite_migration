import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Play, AlertTriangle, ChevronDown, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { todayLocal } from "@/lib/localDate";

export default function ShoulderTugTestPastorsTestRunner({ client, onSave, onClose }) {
  const [steps, setSteps] = useState("");
  const [assistanceNeeded, setAssistanceNeeded] = useState(null);
  const [notes, setNotes] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const handleStartTest = () => {
    setIsRunning(true);
    setSteps("");
    setAssistanceNeeded(null);
    toast.success("Test started. Position client and prepare for perturbation.");
  };

  const handleStopTest = () => {
    setIsRunning(false);
    toast.success("Test stopped. Please record the results.");
  };

  const getInterpretation = (numSteps, needsAssistance) => {
    if (numSteps === 0 || numSteps === 1) {
      return {
        level: "Excellent Balance",
        color: "text-green-700",
        bg: "bg-green-50",
        risk: "Low fall risk",
        desc: "Normal postural reaction; able to recover balance with minimal stepping"
      };
    }
    if (numSteps === 2) {
      return {
        level: "Good Balance",
        color: "text-blue-700",
        bg: "bg-blue-50",
        risk: "Low-moderate fall risk",
        desc: "Normal stepping response; appropriate recovery from perturbation"
      };
    }
    if (numSteps >= 3 && !needsAssistance) {
      return {
        level: "Impaired Balance",
        color: "text-amber-700",
        bg: "bg-amber-50",
        risk: "Moderate-high fall risk",
        desc: "Excessive stepping (>2 steps); impaired postural reaction"
      };
    }
    return {
      level: "Severely Impaired Balance",
      color: "text-red-700",
      bg: "bg-red-50",
      risk: "High fall risk",
      desc: "Unable to recover without assistance; significant postural instability"
    };
  };

  const handleSave = () => {
    if (steps === "" || isNaN(steps)) {
      toast.error("Please enter a valid number of steps.");
      return;
    }

    if (assistanceNeeded === null) {
      toast.error("Please indicate whether assistance was needed.");
      return;
    }

    const resultValue = parseInt(steps, 10);
    const interpretation = getInterpretation(resultValue, assistanceNeeded);

    const soapText = [
      `• Shoulder Tug Test (Pastor's Test) - Reactive Balance Assessment`,
      ``,
      `  Measurement:`,
      `    Steps Taken to Recover: ${resultValue}`,
      `    Assistance Required: ${assistanceNeeded ? "Yes" : "No"}`,
      ``,
      `  Interpretation: ${interpretation.level}`,
      `    ${interpretation.desc}`,
      `    Fall Risk: ${interpretation.risk}`,
      ``,
      `  Clinical Significance:`,
      `    • ≤1 step: Normal postural reaction (low risk)`,
      `    • 2 steps: Normal response (appropriate recovery)`,
      `    • ≥3 steps: Impaired postural reaction (increased fall risk)`,
      `    • Assistance needed: Severely impaired balance (high fall risk)`,
      `    • Multiple large steps or loss of balance = poor reactive balance`,
      ``,
      notes ? `  Clinical Notes: ${notes}` : null,
      ``,
      `  References:`,
      `    • Pastor's Test developed as simple screening for reactive balance`,
      `    • Part of comprehensive fall risk assessment battery`,
      `    • Assesses ability to recover from unexpected backward perturbation`,
      `    • Quick indicator of postural stability and fall risk`,
    ].filter(Boolean).join('\n');

    onSave({
      status: "completed",
      result_value: resultValue,
      additional_data: {
        soap_text: soapText,
        measurement_type: "shoulder_tug_test",
        steps_taken: resultValue,
        assistance_needed: assistanceNeeded,
        interpretation: interpretation.level,
        fall_risk: interpretation.risk,
      },
      notes,
      assessment_date: todayLocal(),
    });

    toast.success("Shoulder Tug Test saved successfully.");
  };

  const interpretation = steps ? getInterpretation(parseInt(steps, 10), assistanceNeeded) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[95vh] overflow-y-auto p-6 space-y-4">
        
        {/* Header */}
        <div className="border-b pb-4 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Shoulder Tug Test (Pastor's Test)</h1>
            <p className="text-slate-600 mt-2">Reactive balance assessment - sudden posterior perturbation</p>
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
            <Tabs defaultValue="protocol" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="protocol">Protocol</TabsTrigger>
                <TabsTrigger value="technique">Technique</TabsTrigger>
                <TabsTrigger value="scoring">Scoring</TabsTrigger>
                <TabsTrigger value="norms">Normatives</TabsTrigger>
                <TabsTrigger value="references">References</TabsTrigger>
              </TabsList>

              <TabsContent value="protocol" className="mt-4 space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                    <Info className="w-5 h-5" /> Assessment Overview
                  </h4>
                  <div className="space-y-2 text-sm text-blue-800">
                    <p><strong>Purpose:</strong> Screen for reactive (dynamic) balance and postural stability. Assesses ability to recover from sudden backward perturbation.</p>
                    <p><strong>Population:</strong> Older adults, fall risk screening, balance assessment, neurological conditions</p>
                    <p><strong>Equipment:</strong> Clear space (at least 2m), treatment table or countertop for support</p>
                    <p><strong>Safety:</strong> Clinician positioned to provide support; ensure safe environment with no hazards behind client</p>
                    <p><strong>Duration:</strong> 1–2 minutes</p>
                  </div>

                  <div className="bg-white border border-blue-200 rounded p-3 mt-3">
                    <p className="font-semibold text-blue-900 mb-2 text-sm">Client Positioning:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-blue-800">
                      <li>Stand with feet shoulder-width apart</li>
                      <li>Arms at sides or in front (neutral position)</li>
                      <li>Face forward, eyes open</li>
                      <li>Maintain upright posture</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="technique" className="mt-4 space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-green-900">Testing Technique & Safety</h4>
                  
                  <div className="bg-white border border-green-300 rounded p-3">
                    <p className="font-semibold text-green-900 text-sm mb-2">Step-by-Step Procedure:</p>
                    <ol className="list-decimal list-inside space-y-2 text-xs text-green-800">
                      <li>Explain test to client: "I will stand behind you and give a quick, unexpected pull backward on your shoulders. Try to keep your balance. I'll be here to support you if needed."</li>
                      <li>Position client standing with feet shoulder-width apart, facing away from you</li>
                      <li>Stand directly behind client, within reach (approximately 30–40 cm away)</li>
                      <li>Deliver one sudden, firm backward tug on client's shoulders or safety belt</li>
                      <li>Pull should be quick and unexpected (not telegraphed)</li>
                      <li>Magnitude: Moderate force (sufficient to create balance challenge without excessive force)</li>
                      <li>Observe and count steps taken to recover balance</li>
                      <li>Note whether client requires hand support or stabilization from clinician</li>
                      <li>Document any loss of balance or near-fall</li>
                    </ol>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded p-3 mt-3">
                    <p className="font-semibold text-amber-900 text-sm mb-2">Safety Precautions:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-amber-800">
                      <li><strong>Never test if:</strong> Severe balance impairment, severe osteoporosis, acute back/spine injury, recent falls</li>
                      <li><strong>Clinician safety:</strong> Maintain firm footing and positioned to catch client if needed</li>
                      <li><strong>Environmental safety:</strong> Clear surroundings of obstacles; ensure adequate space behind client</li>
                      <li><strong>Progressive difficulty:</strong> Start with gentle tug; increase if client demonstrates good balance</li>
                      <li><strong>Limit attempts:</strong> Usually only one trial unless client is unsure/unprepared</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="scoring" className="mt-4 space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-purple-900">Scoring & Interpretation</h4>
                  
                  <div className="grid gap-2">
                    <div className="bg-green-50 border border-green-300 rounded p-3">
                      <p className="font-semibold text-green-700 text-sm">0–1 Steps: Excellent Balance (Low Risk)</p>
                      <p className="text-xs text-green-800">No steps or 1 step to recover; normal postural reaction</p>
                      <p className="text-xs text-green-600 mt-1">• No external assistance needed • Able to quickly regain balance • Normal reactive balance</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-300 rounded p-3">
                      <p className="font-semibold text-blue-700 text-sm">2 Steps: Good Balance (Low-Moderate Risk)</p>
                      <p className="text-xs text-blue-800">Two steps to recover; appropriate stepping response</p>
                      <p className="text-xs text-blue-600 mt-1">• No external assistance required • Normal recovery pattern • Acceptable postural stability</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-300 rounded p-3">
                      <p className="font-semibold text-amber-700 text-sm">3+ Steps (No Assistance): Impaired Balance (Moderate-High Risk)</p>
                      <p className="text-xs text-amber-800">Excessive stepping (≥3 large steps) to recover</p>
                      <p className="text-xs text-amber-600 mt-1">• Impaired postural reaction • Increased fall risk • Consider balance interventions</p>
                    </div>
                    <div className="bg-red-50 border border-red-300 rounded p-3">
                      <p className="font-semibold text-red-700 text-sm">Loss of Balance / Assistance Needed: Severely Impaired (High Risk)</p>
                      <p className="text-xs text-red-800">Falls backward, requires clinician support to prevent fall</p>
                      <p className="text-xs text-red-600 mt-1">• Severe postural instability • Very high fall risk • Urgent intervention needed • Consider mobility aids or supervision</p>
                    </div>
                  </div>

                  <div className="bg-white border border-purple-200 rounded p-3 mt-3">
                    <p className="font-semibold text-purple-900 text-sm mb-2">Key Scoring Notes:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-purple-800">
                      <li>Count only forward steps taken to recover balance</li>
                      <li>Small shuffle steps count as steps</li>
                      <li>If client requires ANY hand support from clinician = impaired balance</li>
                      <li>Loss of balance = score as severely impaired (highest risk)</li>
                      <li>Quick, coordinated response to tug = better balance</li>
                      <li>Delayed or staggering response = impaired balance</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="norms" className="mt-4 space-y-3">
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h4 className="font-semibold text-indigo-900 mb-3">Normative Data & Expected Performance</h4>
                  <div className="space-y-3">
                    <div className="bg-white border border-indigo-200 rounded p-3">
                      <p className="font-semibold text-indigo-900 text-sm mb-2">Healthy Community-Dwelling Older Adults (≥65 years)</p>
                      <ul className="list-disc list-inside space-y-1 text-xs text-indigo-800">
                        <li><strong>Mean steps to recovery: 0–2 steps</strong></li>
                        <li>Majority (75–85%) require ≤2 steps</li>
                        <li>No external assistance required</li>
                        <li>Quick, coordinated response</li>
                      </ul>
                    </div>
                    <div className="bg-white border border-indigo-200 rounded p-3">
                      <p className="font-semibold text-indigo-900 text-sm mb-2">Older Adults with Recent Falls (History of ≥2 falls/year)</p>
                      <ul className="list-disc list-inside space-y-1 text-xs text-indigo-800">
                        <li><strong>Mean steps to recovery: 3–5+ steps</strong></li>
                        <li>More likely to require external support</li>
                        <li>Delayed or uncoordinated response</li>
                        <li>Higher risk of loss of balance</li>
                      </ul>
                    </div>
                    <div className="bg-white border border-indigo-200 rounded p-3">
                      <p className="font-semibold text-indigo-900 text-sm mb-2">Key Findings:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs text-indigo-800">
                        <li>≥3 steps associated with history of falls</li>
                        <li>Need for external support strongly associated with fall risk</li>
                        <li>Quick adaptation (0–1 steps) = protective factor against falls</li>
                        <li>Correlates with other balance tests (TUG, Berg Balance Scale)</li>
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
                      href="https://pubmed.ncbi.nlm.nih.gov/3343889/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-amber-700 hover:underline text-xs"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span><strong>Pastor PA et al. (1988).</strong> Reactive balance adjustment in older women. J Am Geriatr Soc 36(7):615-622</span>
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/11844859/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-amber-700 hover:underline text-xs"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span><strong>Maki BE, McIlroy WE. (2006).</strong> Control of rapid limb movements for balance recovery: Age-related changes and implications for fall prevention. Age Ageing 35(suppl 2):ii12-ii18</span>
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/24270735/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-amber-700 hover:underline text-xs"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span><strong>Arai T, Obuchi S, Inomata K, et al. (2007).</strong> Shoulder tug test for identifying older people at high risk of falls. J Am Geriatr Soc 55(12):1960-1965</span>
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/23529259/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-amber-700 hover:underline text-xs"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span><strong>Tinetti ME. (2003).</strong> Clinical practice: Preventing falls in elderly persons. N Engl J Med 348(1):42-49</span>
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/17032992/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-amber-700 hover:underline text-xs"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span><strong>Delbaere K, Crombez G, Vanderstraeten G, et al. (2004).</strong> Fear-related avoidance of activities in older community-dwelling. J Am Geriatr Soc 52(6):944-949</span>
                    </a>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CollapsibleContent>
        </Collapsible>

        {/* Test Controls */}
        <Card className="bg-slate-50 border-2 border-slate-300">
          <CardHeader>
            <CardTitle className="text-base">Test Administration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Button 
                onClick={handleStartTest} 
                disabled={isRunning}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Test
              </Button>
              <Button 
                onClick={handleStopTest} 
                disabled={!isRunning}
                variant="destructive"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Stop Test
              </Button>
              <p className="text-xs text-slate-600 ml-auto">
                {isRunning ? "Test in progress..." : "Test not started"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Data Entry */}
        <Card>
          <CardHeader className="bg-slate-50">
            <CardTitle className="text-base">Assessment Data</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            
            <div>
              <Label htmlFor="steps" className="font-semibold block mb-2">Number of Steps Taken to Recover</Label>
              <Input
                id="steps"
                type="number"
                min="0"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                disabled={isRunning}
                placeholder="Enter number of steps (0+)"
                className="w-32"
              />
              <p className="text-xs text-slate-600 mt-1">Count forward steps taken to regain balance</p>
            </div>

            <div>
              <Label className="font-semibold block mb-2">Assistance Required to Prevent Fall?</Label>
              <RadioGroup 
                value={assistanceNeeded === null ? "" : (assistanceNeeded ? "yes" : "no")}
                onValueChange={(val) => setAssistanceNeeded(val === "yes")}
                disabled={isRunning}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="assist-no" disabled={isRunning} />
                  <Label htmlFor="assist-no" className="cursor-pointer text-sm font-normal">No assistance needed</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="assist-yes" disabled={isRunning} />
                  <Label htmlFor="assist-yes" className="cursor-pointer text-sm font-normal">Yes, clinician support required</Label>
                </div>
              </RadioGroup>
            </div>

            {interpretation && steps && (
              <Card className={`${interpretation.bg} border`}>
                <CardContent className="pt-4">
                  <p className={`font-semibold ${interpretation.color} text-sm`}>{interpretation.level}</p>
                  <p className="text-xs text-slate-700 mt-1">{interpretation.desc}</p>
                  <p className={`text-xs font-semibold mt-1 ${interpretation.color}`}>Fall Risk: {interpretation.risk}</p>
                </CardContent>
              </Card>
            )}

            <div>
              <Label htmlFor="notes" className="font-semibold block mb-2">Clinical Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isRunning}
                placeholder="Document perturbation force, client response quality, any concerns, ability to anticipate perturbation, muscle guarding..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-between items-center gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!steps || assistanceNeeded === null}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}