import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Info, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const IKDC_QUESTIONS = [
  // SYMPTOMS SUBSCALE (5 items)
  { id: 'q1_pain', label: 'What is the highest level of activity you can perform without significant knee pain?', max: 10, subscale: 'Symptoms', anchors: { 0: 'Unable', 5: 'Moderate', 10: 'Very high activity' } },
  { id: 'q2_stiffness', label: 'During the past 4 weeks, how stiff or swollen was your knee?', max: 4, subscale: 'Symptoms', anchors: { 0: 'Not stiff/swollen', 2: 'Moderately stiff/swollen', 4: 'Very stiff/swollen' } },
  { id: 'q3_swelling', label: 'What is the highest level of activity you can perform without significant swelling?', max: 10, subscale: 'Symptoms', anchors: { 0: 'Unable', 5: 'Moderate', 10: 'Very high activity' } },
  { id: 'q4_lock_catch', label: 'Does your knee lock or catch?', max: 2, subscale: 'Symptoms', anchors: { 0: 'Yes, frequently', 1: 'Occasionally', 2: 'No, never' } },
  { id: 'q5_giving_way', label: 'What is the highest level of activity you can perform without significant giving way?', max: 10, subscale: 'Symptoms', anchors: { 0: 'Unable', 5: 'Moderate', 10: 'Very high activity' } },
  // FUNCTION SUBSCALE (9 items)
  { id: 'q6_stairs_up', label: 'How difficult is it to go up stairs?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
  { id: 'q7_stairs_down', label: 'How difficult is it to go down stairs?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
  { id: 'q8_kneel', label: 'How difficult is it to kneel on the front of your knee?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
  { id: 'q9_squat', label: 'How difficult is it to squat?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
  { id: 'q10_sit_bent', label: 'How difficult is it to sit with your knee bent?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
  { id: 'q11_rise_chair', label: 'How difficult is it to rise from a chair?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
  { id: 'q12_run_straight', label: 'How difficult is it to run straight ahead?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
  { id: 'q13_jump_land', label: 'How difficult is it to jump and land on your involved leg?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
  { id: 'q14_stop_quickly', label: 'How difficult is it to stop and start quickly?', max: 4, subscale: 'Function', anchors: { 0: 'Extremely difficult', 2: 'Moderately difficult', 4: 'Not difficult' } },
];

export default function InternationalKneeDocumentationCommitteeIKDCRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");

  const handleResponseChange = (id, value) => {
    setResponses((prev) => ({ ...prev, [id]: parseInt(value) || 0 }));
  };

  const calculateIKDCScore = () => {
    const sum = Object.values(responses).reduce((acc, val) => acc + val, 0);
    const maxPossible = IKDC_QUESTIONS.reduce((sum, q) => sum + q.max, 0);
    if (maxPossible === 0) return 0;
    return ((sum / maxPossible) * 100).toFixed(1);
  };

  const handleSave = () => {
    const missing = IKDC_QUESTIONS.filter(q => responses[q.id] === undefined);
    if (missing.length > 0) {
      toast.error(`Please answer all ${missing.length} remaining question(s).`);
      return;
    }

    const totalScore = calculateIKDCScore();
    const assessmentDate = new Date().toISOString().split("T")[0];

    // Generate SOAP objective text
    const symptomsScore = Object.keys(responses)
      .filter(k => k.startsWith('q') && parseInt(k.substring(1)) <= 5)
      .reduce((sum, k) => sum + responses[k], 0);
    
    const functionScore = Object.keys(responses)
      .filter(k => k.startsWith('q') && parseInt(k.substring(1)) > 5)
      .reduce((sum, k) => sum + responses[k], 0);

    // Build detailed SOAP text with all question responses
    let soapText = `International Knee Documentation Committee (IKDC) Subjective Knee Evaluation completed on ${assessmentDate}.\n\nTotal Score: ${totalScore}% (${scoreCategory})\nSymptoms subscale: ${symptomsScore}/24\nFunction subscale: ${functionScore}/36\n\n`;
    
    soapText += `Individual Question Responses:\n`;
    IKDC_QUESTIONS.forEach((question, idx) => {
      const response = responses[question.id];
      soapText += `Q${idx + 1}. ${question.label}\n  Response: ${response}/${question.max}\n`;
    });

    const additionalData = { 
      measurement_type: "questionnaire", 
      ikdc_responses: responses,
      ikdc_score_percent: parseFloat(totalScore),
      symptoms_subscale: symptomsScore,
      function_subscale: functionScore,
      scoring_formula: "Sum of all item responses / Maximum possible score × 100",
      soap_text: soapText
    };

    onSave({ 
      result_value: parseFloat(totalScore), 
      additional_data: additionalData, 
      notes, 
      assessment_date: assessmentDate 
    });
  };

  const isComplete = Object.keys(responses).length === IKDC_QUESTIONS.length;
  const ikdcScore = calculateIKDCScore();

  let scoreCategory = "";
  let scoreColor = "";
  if (isComplete) {
    if (ikdcScore > 90) {
      scoreCategory = "Excellent";
      scoreColor = "bg-green-100 border-green-300 text-green-800";
    } else if (ikdcScore >= 80) {
      scoreCategory = "Good";
      scoreColor = "bg-blue-100 border-blue-300 text-blue-800";
    } else if (ikdcScore >= 70) {
      scoreCategory = "Fair";
      scoreColor = "bg-yellow-100 border-yellow-300 text-yellow-800";
    } else {
      scoreCategory = "Poor";
      scoreColor = "bg-red-100 border-red-300 text-red-800";
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="text-2xl">International Knee Documentation Committee (IKDC)</CardTitle>
            <p className="text-sm text-gray-600 mt-2">Assessment of knee function, symptoms, and sports/activity level</p>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Clinician Instructions */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Administration & Scoring Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-blue-800">
                <div>
                  <p className="font-semibold">Timeframe:</p>
                  <p>Client rates symptoms and function over the past 4 weeks.</p>
                </div>
                <div>
                  <p className="font-semibold">Scoring Formula:</p>
                  <p className="font-mono bg-white p-2 rounded">Sum of all item responses ÷ Maximum possible score (80) × 100 = Score %</p>
                </div>
                <div>
                  <p className="font-semibold">Scale Direction:</p>
                  <p><strong>Higher values = Better function</strong> (lower left = worse, higher right = better)</p>
                </div>
                <div>
                  <p className="font-semibold">Content:</p>
                  <p>5 symptom items + 9 function items = 14 items total. Covers pain, stiffness, swelling, instability, and functional limitations in ADLs and sports activities.</p>
                </div>
              </CardContent>
            </Card>

            {/* Progress & Score Summary */}
            <Card className="border-slate-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Completion Status</p>
                    <p className="text-lg font-bold mt-1">{Object.keys(responses).length}/{IKDC_QUESTIONS.length} items answered</p>
                  </div>
                  {isComplete && <CheckCircle2 className="w-8 h-8 text-green-600" />}
                  {!isComplete && Object.keys(responses).length > 0 && <AlertTriangle className="w-8 h-8 text-amber-600" />}
                </div>

                {!isComplete && Object.keys(responses).length > 0 && (
                  <div className="text-sm text-amber-700 bg-amber-50 p-2 rounded">
                    <strong>Missing:</strong> {IKDC_QUESTIONS.filter(q => !responses[q.id]).length} question(s). All items must be answered before saving.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Current Score Display */}
            {isComplete && (
              <Card className={`border-2 ${scoreColor}`}>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Total Score</p>
                      <p className="text-3xl font-bold mt-1">{ikdcScore}%</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Interpretation</p>
                      <p className="text-lg font-bold mt-1">{scoreCategory}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Items</p>
                      <p className="text-lg font-bold mt-1">14/14</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Response Scale Legend */}
            <Card className="bg-gray-50 border-gray-200">
              <CardHeader>
                <CardTitle className="text-base">Response Scale Orientation</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-700">
                <p><strong>Lower numbers (left)</strong> = Greater difficulty/worse symptoms</p>
                <p><strong>Higher numbers (right)</strong> = Better function/fewer symptoms</p>
                <p className="text-xs text-gray-600 mt-2">Each question has variable response options (0–2, 0–4, or 0–10). All responses are scored as stated; higher value always = better outcome.</p>
              </CardContent>
            </Card>

            {/* Questions organized by subscale */}
            <div className="space-y-6">
              {['Symptoms', 'Function'].map((subscale) => {
                const subscaleQuestions = IKDC_QUESTIONS.filter(q => q.subscale === subscale);
                const subscaleAnswered = subscaleQuestions.filter(q => responses[q.id] !== undefined).length;
                return (
                  <div key={subscale}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-800">{subscale} ({subscaleAnswered}/{subscaleQuestions.length})</h3>
                      <Badge variant={subscaleAnswered === subscaleQuestions.length ? "default" : "outline"}>
                        {subscaleAnswered === subscaleQuestions.length ? "Complete" : "In progress"}
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {subscaleQuestions.map((question, idx) => (
                        <Card 
                          key={question.id} 
                          className={`border-l-4 ${responses[question.id] !== undefined ? 'border-l-green-500 bg-green-50/30' : 'border-l-indigo-400'}`}
                        >
                          <CardContent className="pt-4">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <Label className="text-sm font-semibold flex-1">{question.label}</Label>
                                {responses[question.id] !== undefined && <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />}
                              </div>

                              {/* Anchor labels */}
                              <div className="flex justify-between text-xs text-gray-500 px-1 mb-2">
                                {Object.entries(question.anchors).map(([val, label]) => (
                                  <span key={val} className="text-center" style={{ width: `${(parseInt(val) / question.max) * 100}%` }}>
                                    {label}
                                  </span>
                                ))}
                              </div>

                              {/* Response buttons with value labels */}
                              <div className="flex gap-1 flex-wrap">
                                {Array.from({ length: question.max + 1 }, (_, i) => i).map((value) => (
                                  <Button
                                    key={value}
                                    variant={responses[question.id] === value ? "default" : "outline"}
                                    onClick={() => handleResponseChange(question.id, value)}
                                    size="sm"
                                    className={`min-w-10 h-10 p-0 text-xs font-semibold ${
                                      responses[question.id] === value 
                                        ? 'bg-blue-600 text-white' 
                                        : 'hover:bg-blue-50'
                                    }`}
                                    title={`Response value: ${value}`}
                                  >
                                    {value}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Clinician Interpretation */}
            {isComplete && (
              <Card className="bg-amber-50 border-amber-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    Clinician Interpretation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-amber-900">
                  <div className="font-semibold">Final Score: {ikdcScore}% ({scoreCategory})</div>
                  <div className="space-y-2">
                    <div>
                      <strong>&gt;90:</strong> Excellent function. Minimal symptoms; near-normal activity tolerance. May return to high-level sports.
                    </div>
                    <div>
                      <strong>80-89:</strong> Good function. Mild symptoms; good activity tolerance. Return to most activities with occasional limitations.
                    </div>
                    <div>
                      <strong>70-79:</strong> Fair function. Moderate symptoms; moderate activity limitations. May benefit from targeted rehabilitation.
                    </div>
                    <div>
                      <strong>&lt;70:</strong> Poor function. Significant symptoms; notable functional deficits. Recommend continued treatment/monitoring.
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded text-xs mt-3 italic">
                    Note: IKDC is responsive to change and useful for tracking recovery over time. Baseline and repeat assessments inform treatment efficacy.
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Clinical Notes */}
            <div>
              <Label className="text-lg font-semibold mb-2 block">Clinical Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Document knee injury, mechanism, special tests, functional limitations..."
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose} className="flex-1">
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!isComplete}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Assessment
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}