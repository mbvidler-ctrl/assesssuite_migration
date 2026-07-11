import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle, Info, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function ElderlyMobilityScaleEMSRunner({ client, onSave, onClose }) {
  const [preVitals, setPreVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [postVitals, setPostVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [scores, setScores] = useState({
    lyingToSitting: null,
    sittingToLying: null,
    sitToStand: null,
    standing: null,
    gait: null,
    timedWalk: null,
    functionalReach: null,
  });
  const [notes, setNotes] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [expandedTask, setExpandedTask] = useState(null);

  const EMS_LABELS = {
    lyingToSitting: "Lying to Sitting",
    sittingToLying: "Sitting to Lying",
    sitToStand: "Sit to Stand",
    standing: "Standing",
    gait: "Gait",
    timedWalk: "Timed Walk (6 meters)",
    functionalReach: "Functional Reach",
  };

  const EMS_SCORING = {
    lyingToSitting: "0=Unable without assistance, 1=Able with assistance, 2=Able with difficulty, 3=Able normally",
    sittingToLying: "0=Unable without assistance, 1=Able with assistance, 2=Able with difficulty, 3=Able normally",
    sitToStand: "0=Unable without assistance, 1=Able with assistance, 2=Able with difficulty, 3=Able normally",
    standing: "0=Unable, 1=Able with assistance, 2=Able with aid, 3=Able without aid",
    gait: "0=Unable/unsafe, 1=Assisted, 2=With difficulty, 3=Normal",
    timedWalk: "0=Unable, 1=>14 seconds, 2=10-14 seconds, 3=&lt;10 seconds",
    functionalReach: "0=Unable, 1=&lt;6 inches, 2=6-10 inches, 3=&gt;10 inches",
  };

  const handleScoreChange = (task, value) => {
    setScores((prevScores) => ({ ...prevScores, [task]: value }));
  };

  const handleVitalsChange = (type, field, value) => {
    if (type === "pre") {
      setPreVitals((prev) => ({ ...prev, [field]: value }));
    } else {
      setPostVitals((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleStartTest = () => {
    setIsRunning(true);
    toast.success("Test started. Begin assessment when ready.");
  };

  const handleStopTest = () => {
    setIsRunning(false);
    setScores({
      lyingToSitting: null,
      sittingToLying: null,
      sitToStand: null,
      standing: null,
      gait: null,
      timedWalk: null,
      functionalReach: null,
    });
    setPreVitals({ heartRate: "", bloodPressure: "" });
    setPostVitals({ heartRate: "", bloodPressure: "" });
    toast.info("Test canceled. Form reset.");
  };

  const handleSave = () => {
    const allScoresComplete = Object.values(scores).every(score => score !== null);
    if (!allScoresComplete) {
      toast.error("Please score all 7 EMS items before saving.");
      return;
    }

    const totalScore = Object.values(scores).reduce((acc, score) => acc + (score ?? 0), 0);
    let interpretation = "";
    if (totalScore <= 10) interpretation = "High dependency (≤10)";
    else if (totalScore <= 14) interpretation = "Borderline (11–14)";
    else interpretation = "Independent (15–20)";

    let soapText = `• Elderly Mobility Scale (EMS) Assessment\n`;
    soapText += `  Total Score: ${totalScore}/20\n`;
    soapText += `  Interpretation: ${interpretation}\n`;
    soapText += `\n  Item Scores:\n`;
    Object.entries(scores).forEach(([key, val]) => {
      soapText += `    - ${EMS_LABELS[key]}: ${val}/3\n`;
    });
    if (preVitals.heartRate || preVitals.bloodPressure) {
      soapText += `\n  Pre-Test Vitals: HR ${preVitals.heartRate || "—"} bpm, BP ${preVitals.bloodPressure || "—"} mmHg\n`;
    }
    if (postVitals.heartRate || postVitals.bloodPressure) {
      soapText += `  Post-Test Vitals: HR ${postVitals.heartRate || "—"} bpm, BP ${postVitals.bloodPressure || "—"} mmHg\n`;
    }
    if (notes) soapText += `  Clinical Notes: ${notes}\n`;

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        soap_text: soapText,
        measurement_type: "EMS",
        pre_vitals: preVitals,
        post_vitals: postVitals,
        item_scores: { ...scores },
        total_score: totalScore,
        interpretation,
      },
      notes,
      assessment_date: todayLocal(),
    });

    toast.success("EMS assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-slate-50 border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Elderly Mobility Scale (EMS)</h2>
            <p className="text-sm text-slate-600 mt-1">Client: {client?.full_name || "Unknown"}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="p-6 space-y-6">
          {!isRunning && (
            <>
              {/* Overview */}
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">Assessment Overview</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                  <div>
                    <p className="font-semibold text-slate-900">Purpose:</p>
                    <p className="text-slate-700">Evaluates functional mobility and balance in elderly adults across seven key movement tasks. Used to assess fall risk, predict length of hospitalization, and identify independence levels.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Score Range:</p>
                    <p className="text-slate-700"><strong>0–20 points</strong> (7 items × 3 points max per item)</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Population:</p>
                    <p className="text-slate-700">Older adults (65+), patients in acute care, rehabilitation settings, and geriatric populations.</p>
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
                    <p className="font-semibold">Assessment Setup:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1 text-xs mt-1">
                      <li>Conduct in safe, controlled environment with clear space for movement</li>
                      <li>Ensure appropriate footwear and adequate lighting</li>
                      <li>Have assistance available for safety; stop if client becomes fatigued or unsafe</li>
                      <li>Record pre- and post-test vitals (heart rate, blood pressure)</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold">General Scoring Guidance:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1 text-xs mt-1">
                      <li><strong>0:</strong> Unable to perform task OR requires maximum assistance</li>
                      <li><strong>1:</strong> Requires significant assistance or uses aids/equipment</li>
                      <li><strong>2:</strong> Able to perform but with difficulty, uncertainty, or slowness</li>
                      <li><strong>3:</strong> Able to perform task safely and independently</li>
                    </ul>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-200 italic text-xs">
                    <p>"I'll ask you to perform several simple movement tasks. Please do your best, and let me know if anything feels unsafe or uncomfortable. I'll be right here to help if needed."</p>
                  </div>
                </CardContent>
              </Card>

              {/* Task-Specific Guidance */}
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-amber-900">
                    <AlertTriangle className="w-5 h-5" />
                    Task Guidance & Scoring Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-amber-900 space-y-2">
                  {Object.entries(EMS_LABELS).map(([task, label]) => (
                    <div key={task} className="border border-amber-300 rounded p-2 bg-white">
                      <button
                        onClick={() => setExpandedTask(expandedTask === task ? null : task)}
                        className="flex justify-between items-center w-full font-semibold text-amber-900"
                      >
                        <span>{label}</span>
                        {expandedTask === task ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {expandedTask === task && (
                        <p className="text-xs text-amber-800 mt-2 p-2 bg-amber-50 rounded">{EMS_SCORING[task]}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Clinical Significance */}
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">Clinical Significance &amp; Interpretation</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                  <div className="space-y-2 text-xs bg-slate-50 p-3 rounded">
                    <p><strong>Score 0–10 (High Dependency):</strong> Severe functional limitation; requires substantial assistance; high fall risk; likely requires residential care.</p>
                    <p><strong>Score 11–14 (Borderline):</strong> Moderate to significant functional limitation; mixed independence; elevated fall risk; may benefit from therapy/support.</p>
                    <p><strong>Score 15–20 (Independent):</strong> Functional independence in mobility tasks; low fall risk; minimal need for assistance.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Reliability &amp; Validity:</p>
                    <p className="text-slate-700 text-xs">The EMS is a validated, reliable tool for assessing functional mobility in older adults. Good inter-rater reliability (ICC &gt; 0.85) and strong predictive validity for fall risk and hospitalization outcomes.</p>
                  </div>
                </CardContent>
              </Card>

              {/* References */}
              <Card className="border-slate-200 bg-slate-50">
                <CardHeader>
                  <CardTitle className="text-base">References &amp; Evidence</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-700 space-y-2">
                  <p><strong>Tinetti, M. E.</strong> (1986). Performance-oriented assessment of mobility problems in elderly patients. <em>Journal of the American Geriatrics Society</em>, 34(2), 119–126.</p>
                  <p><strong>Hubbard, I. J., Parsons, M. W., Neilson, C., &amp; Carey, L. M.</strong> (2007). Task-specific training: evidence for and translation to clinical practice. <em>Occupational Therapy International</em>, 14(4), 237–246.</p>
                  <p><strong>Shumway-Cook, A., &amp; Woollacott, M. H.</strong> (2017). <em>Motor Control: Translating Research into Clinical Practice</em> (5th ed.). Wolters Kluwer.</p>
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
                  <CardTitle className="text-base text-green-900">Assessment in Progress</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-green-800">
                  <p>Follow the scoring guidance for each task. Score each item 0–3 based on client performance.</p>
                </CardContent>
              </Card>

              {/* Vitals */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pre-Test &amp; Post-Test Vitals</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Pre-Test Vitals</Label>
                      <div className="space-y-2">
                        <Input
                          type="number"
                          placeholder="Heart Rate (bpm)"
                          value={preVitals.heartRate}
                          onChange={(e) => handleVitalsChange("pre", "heartRate", e.target.value)}
                          className="text-sm"
                        />
                        <Input
                          type="text"
                          placeholder="BP (e.g., 140/90)"
                          value={preVitals.bloodPressure}
                          onChange={(e) => handleVitalsChange("pre", "bloodPressure", e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Post-Test Vitals</Label>
                      <div className="space-y-2">
                        <Input
                          type="number"
                          placeholder="Heart Rate (bpm)"
                          value={postVitals.heartRate}
                          onChange={(e) => handleVitalsChange("post", "heartRate", e.target.value)}
                          className="text-sm"
                        />
                        <Input
                          type="text"
                          placeholder="BP (e.g., 140/90)"
                          value={postVitals.bloodPressure}
                          onChange={(e) => handleVitalsChange("post", "bloodPressure", e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Scoring */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">EMS Item Scores (0–3 each)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(EMS_LABELS).map(([task, label]) => {
                    const scoreDesc = {
                      lyingToSitting: ["Unable without assistance","Able with assistance","Able with difficulty","Able normally"],
                      sittingToLying: ["Unable without assistance","Able with assistance","Able with difficulty","Able normally"],
                      sitToStand: ["Unable without assistance","Able with assistance","Able with difficulty","Able normally"],
                      standing: ["Unable","Able with assistance","Able with aid","Able without aid"],
                      gait: ["Unable/unsafe","Assisted","With difficulty","Normal"],
                      timedWalk: ["Unable",">14 seconds","10–14 seconds","<10 seconds"],
                      functionalReach: ["Unable","<6 inches","6–10 inches",">10 inches"],
                    };
                    return (
                      <div key={task} className="border border-slate-100 rounded-lg p-3 bg-slate-50">
                        <Label className="text-sm font-semibold mb-3 block text-slate-800">{label}</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {[0, 1, 2, 3].map((i) => (
                            <button
                              key={i}
                              onClick={() => handleScoreChange(task, i)}
                              className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all text-left ${
                                scores[task] === i
                                  ? "border-blue-500 bg-blue-600 text-white shadow-md"
                                  : "border-slate-200 bg-white hover:border-blue-300 text-slate-700"
                              }`}
                            >
                              <span className="text-lg font-bold">{i}</span>
                              <span className="text-xs mt-1 leading-tight text-center">{scoreDesc[task][i]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Running Total */}
              {Object.values(scores).some(s => s !== null) && (
                <Card className="border-2 border-blue-300 bg-blue-50">
                  <CardContent className="pt-6">
                    <p className="text-center font-bold text-blue-900">
                      Running Total: {Object.values(scores).reduce((acc, s) => acc + (s ?? 0), 0)}/20
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Clinical Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observations, client fatigue, pain, fear of falling, balance concerns, environmental factors..."
                    rows={3}
                  />
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
                Start Assessment
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleStopTest}
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={Object.values(scores).some(s => s === null)}
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