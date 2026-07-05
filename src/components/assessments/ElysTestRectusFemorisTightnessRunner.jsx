import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle, Info, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function ElysTestRectusFemorisTightnessRunner({ client, onSave, onClose }) {
  const [kneeFlexionAngle, setKneeFlexionAngle] = useState("");
  const [hipFlexionObserved, setHipFlexionObserved] = useState(null);
  const [notes, setNotes] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const handleStartTest = () => {
    setIsRunning(true);
    setKneeFlexionAngle("");
    setHipFlexionObserved(null);
    toast.success("Test started. Place client in prone position.");
  };

  const handleStopTest = () => {
    setIsRunning(false);
    setKneeFlexionAngle("");
    setHipFlexionObserved(null);
    toast.success("Test stopped.");
  };

  const handleSave = () => {
    if (!kneeFlexionAngle || hipFlexionObserved === null) {
      toast.error("Please record the knee flexion angle and hip flexion observation.");
      return;
    }

    const angle = parseFloat(kneeFlexionAngle);
    const isPositive = hipFlexionObserved;
    const interpretation = angle < 120 || isPositive ? "Positive (Rectus femoris tightness)" : "Negative (Normal flexibility)";

    const soapText = `• Ely's Test (Rectus Femoris Tightness)\n  Knee Flexion Angle: ${angle}°\n  Hip Flexion Observed: ${isPositive ? "Yes (Positive)" : "No (Negative)"}\n  Interpretation: ${interpretation}\n  Normal: >120° knee flexion without hip flexion (buttock lifts from table)\n  Clinical Significance: Positive test suggests rectus femoris shortness/tightness`;

    const additional_data = {
      soap_text: soapText,
      measurement_type: "angle",
      knee_flexion_angle: angle,
      hip_flexion_observed: isPositive,
      interpretation,
    };

    onSave({
      status: "completed",
      result_value: angle,
      additional_data,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });

    toast.success("Ely's Test assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-slate-50 border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Ely's Test (Rectus Femoris Tightness)</h2>
            <p className="text-sm text-slate-600 mt-1">Client: {client?.full_name || "Unknown"}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="p-6 space-y-6">
          {!isRunning && (
            <>
              {/* Overview Card */}
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">Assessment Overview</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                  <div>
                    <p className="font-semibold text-slate-900">Purpose:</p>
                    <p className="text-slate-700">Assesses rectus femoris flexibility and detects hip flexor tightness. A positive test indicates the rectus femoris is too short to allow full knee flexion without hip flexion.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Category:</p>
                    <Badge className="bg-slate-700 text-white">Musculoskeletal</Badge>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Unit of Measure:</p>
                    <p className="text-slate-700">Degrees (knee flexion angle)</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Equipment Required:</p>
                    <p className="text-slate-700">Treatment/examination table, inclinometer or goniometer (optional)</p>
                  </div>
                </CardContent>
              </Card>

              {/* Clinician Instructions */}
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                    <Info className="w-5 h-5" />
                    Clinician Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-blue-900 space-y-3">
                  <div>
                    <p className="font-semibold">Setup:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1 text-xs mt-1">
                      <li>Client positioned prone (lying face down) on treatment table</li>
                      <li>Both legs relaxed, hips extended</li>
                      <li>Ensure stable, comfortable position</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold">Performance:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1 text-xs mt-1">
                      <li>Passively flex the client's knee (bring heel toward buttock)</li>
                      <li>Continue flexing until resistance is felt or hip begins to lift</li>
                      <li>Observe for hip flexion: does the buttock/hip lift off the table?</li>
                      <li>Measure the knee flexion angle achieved using inclinometer or visual estimation</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold">Interpretation:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1 text-xs mt-1">
                      <li><strong>Negative (Normal):</strong> Knee flexion &gt;120° WITHOUT hip flexion (buttock stays on table)</li>
                      <li><strong>Positive (Tight):</strong> Hip flexion occurs (buttock lifts) OR knee flexion &lt;120° before hip rises</li>
                      <li>Positive test suggests rectus femoris shortness and possible hip flexor tightness</li>
                    </ul>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-200 italic text-xs">
                    <p>"I'm going to gently bend your knee while you stay relaxed and lying flat. I'll stop when I feel resistance. Tell me if anything is uncomfortable."</p>
                  </div>
                </CardContent>
              </Card>

              {/* Test Position Image Guidance */}
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-amber-900">
                    <AlertTriangle className="w-5 h-5" />
                    Test Position Reference
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-amber-900 space-y-3">
                  <div>
                    <p className="font-semibold">Critical Observation Points:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1 text-xs mt-1">
                      <li><strong>Buttock Lift:</strong> Most important sign—does the hip flex/buttock rise from the table as you flex the knee?</li>
                      <li><strong>Angle Achieved:</strong> Measure knee flexion angle at which hip flexion begins or maximum flexion achieved</li>
                      <li><strong>Normal Range:</strong> Typically 120–135° knee flexion before hip flexion occurs in normal individuals</li>
                      <li><strong>Pain/Discomfort:</strong> Note any reported pain; may indicate other pathology</li>
                    </ul>
                  </div>
                  <div className="p-2 bg-white rounded border border-amber-200 text-xs">
                    <p className="font-semibold mb-1">Anatomical Basis:</p>
                    <p>The rectus femoris (part of quadriceps) crosses both the hip and knee. If tight, it cannot allow full knee flexion without causing hip flexion due to its dual action.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Clinical Significance */}
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">Clinical Significance & Norms</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                  <div>
                    <p className="font-semibold text-slate-900">Normative Values:</p>
                    <div className="mt-2 bg-slate-50 p-3 rounded text-xs space-y-1">
                      <p><strong>Negative (Normal):</strong> Knee flexion &gt;120° without hip flexion (buttock remains on table)</p>
                      <p><strong>Positive (Tight):</strong> Hip flexion observed OR knee flexion &lt;120° when hip begins to rise</p>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Clinical Implications:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1 text-xs mt-1">
                      <li>Positive test suggests rectus femoris shortness/tightness</li>
                      <li>Associated with reduced knee flexion ROM and potential gait deviations</li>
                      <li>May contribute to anterior knee pain, lumbar hyperlordosis, or hip extension limitations</li>
                      <li>Common in athletes, sedentary individuals, and those with prior quadriceps injury</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* References */}
              <Card className="border-slate-200 bg-slate-50">
                <CardHeader>
                  <CardTitle className="text-base">References & Evidence</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-700 space-y-2">
                  <p><strong>Juhl, C. B., Lund, H., Lentz, T. A., & Jørgensen, A.</strong> (2016). The validity of the Ely test in detecting rectus femoris tightness: a systematic review. <em>Physiotherapy Theory and Practice</em>, 32(6), 382–389.</p>
                  <p><a href="https://doi.org/10.1080/09593985.2016.1149025" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://doi.org/10.1080/09593985.2016.1149025</a></p>
                  <p className="mt-2"><strong>Medina McKeon, J. M., & Hertel, J.</strong> (2008). Sex differences and representative values for six lower extremity flexibility tests. <em>Journal of Athletic Training</em>, 43(4), 383–389.</p>
                  <Button
                    onClick={() => window.open('https://www.apta.org/', '_blank')}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    <ExternalLink className="w-3 h-3 mr-2" />
                    APTA Resources
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {isRunning && (
            <div className="space-y-6">
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="text-base text-green-900">Test in Progress</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-green-800">
                  <p>Client is prone. Passively flex the knee and observe for hip flexion. Record findings below.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Test Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="kneeFlexionAngle" className="text-sm font-medium">
                      Knee Flexion Angle Achieved (degrees) *
                    </Label>
                    <Input
                      id="kneeFlexionAngle"
                      type="number"
                      value={kneeFlexionAngle}
                      onChange={(e) => setKneeFlexionAngle(e.target.value)}
                      placeholder="e.g., 130"
                      min="0"
                      max="180"
                      className="mt-1"
                    />
                    <p className="text-xs text-slate-500 mt-1">Normal: &gt;120° without hip flexion</p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Hip Flexion Observed? *</Label>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => setHipFlexionObserved(true)}
                        variant={hipFlexionObserved === true ? "default" : "outline"}
                        className={hipFlexionObserved === true ? "bg-red-600 hover:bg-red-700" : ""}
                      >
                        Yes (Buttock Lifted)
                      </Button>
                      <Button
                        onClick={() => setHipFlexionObserved(false)}
                        variant={hipFlexionObserved === false ? "default" : "outline"}
                        className={hipFlexionObserved === false ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        No (Buttock Flat)
                      </Button>
                    </div>
                  </div>

                  {kneeFlexionAngle && hipFlexionObserved !== null && (
                    <div className={`p-3 rounded border-2 ${
                      parseFloat(kneeFlexionAngle) < 120 || hipFlexionObserved
                        ? "border-red-300 bg-red-50"
                        : "border-green-300 bg-green-50"
                    }`}>
                      <p className="font-semibold text-slate-900">
                        {parseFloat(kneeFlexionAngle) < 120 || hipFlexionObserved ? "POSITIVE" : "NEGATIVE"}
                      </p>
                      <p className="text-sm text-slate-700 mt-1">
                        {parseFloat(kneeFlexionAngle) < 120 || hipFlexionObserved
                          ? "Suggests rectus femoris tightness"
                          : "Normal rectus femoris flexibility"}
                      </p>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="notes" className="text-sm font-medium">
                      Clinical Notes & Observations
                    </Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Client comfort, pain reproduction, ease of movement, other observations..."
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t bg-slate-50 px-6 py-4 flex justify-between items-center gap-3">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>

          <div className="flex gap-3">
            {!isRunning ? (
              <Button onClick={handleStartTest} className="bg-green-600 hover:bg-green-700">
                <Play className="w-4 h-4 mr-2" />
                Start Test
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleStopTest}
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel Test
                </Button>
                <Button
                  onClick={handleSave}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={!kneeFlexionAngle || hipFlexionObserved === null}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Assessment
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}