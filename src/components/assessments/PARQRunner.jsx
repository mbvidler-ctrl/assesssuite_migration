import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const PARQ_QUESTIONS = [
  "Has your doctor ever said that you have a heart condition and that you should only do physical activity recommended by a doctor?",
  "Do you feel pain in your chest when you do physical activity?",
  "In the past month, have you had chest pain when you were not doing physical activity?",
  "Do you lose your balance because of dizziness or do you ever lose consciousness?",
  "Do you have a bone or joint problem (for example, back, knee or hip) that could be made worse by a change in your physical activity?",
  "Is your doctor currently prescribing drugs (for example, water pills) for your blood pressure or heart condition?",
  "Do you know of any other reason why you should not do physical activity?"
];

export default function PARQRunner({ onSave, onClose }) {
  const [answers, setAnswers] = useState({});
  const [otherReasons, setOtherReasons] = useState("");
  const [notes, setNotes] = useState("");

  const handleAnswerChange = (index, answer) => {
    setAnswers({ ...answers, [index]: answer });
  };

  const yesCount = Object.values(answers).filter(a => a === "yes").length;

  const handleSave = () => {
    if (Object.keys(answers).length < 7) {
      toast.error("Please answer all 7 questions");
      return;
    }

    onSave({
      result_value: yesCount,
      additional_data: {
        answers: answers,
        yes_count: yesCount,
        requires_medical_clearance: yesCount > 0,
        other_reasons: otherReasons
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Physical Activity Readiness Questionnaire (PAR-Q)</h2>
              <p className="text-slate-600 mt-1">Pre-exercise screening questionnaire</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800">
                <p>"I'm going to ask you 7 questions about your health. Please answer YES or NO to each question. If you answer YES to any question, you may need to talk to your doctor before increasing your physical activity."</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>PAR-Q Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {PARQ_QUESTIONS.map((question, index) => (
                  <div key={index} className="border-b pb-4 last:border-b-0">
                    <Label className="text-base mb-3 block font-semibold">
                      {index + 1}. {question}
                    </Label>
                    <div className="flex gap-4">
                      <Button
                        type="button"
                        variant={answers[index] === "no" ? "default" : "outline"}
                        onClick={() => handleAnswerChange(index, "no")}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        NO
                      </Button>
                      <Button
                        type="button"
                        variant={answers[index] === "yes" ? "default" : "outline"}
                        onClick={() => handleAnswerChange(index, "yes")}
                        className="flex-1 bg-red-600 hover:bg-red-700"
                      >
                        YES
                      </Button>
                    </div>
                  </div>
                ))}

                {answers[6] === "yes" && (
                  <div className="mt-4">
                    <Label>Please specify other reasons:</Label>
                    <Textarea
                      value={otherReasons}
                      onChange={(e) => setOtherReasons(e.target.value)}
                      placeholder="Describe other reasons..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {Object.keys(answers).length === 7 && (
              <Card className={yesCount > 0 ? "bg-red-50 border-red-300 border-2" : "bg-green-50 border-green-300 border-2"}>
                <CardHeader>
                  <CardTitle className={`text-xl ${yesCount > 0 ? 'text-red-700' : 'text-green-700'} flex items-center gap-2`}>
                    {yesCount > 0 && <AlertTriangle className="w-6 h-6" />}
                    {yesCount > 0 ? "Medical Clearance Required" : "Cleared for Physical Activity"}
                  </CardTitle>
                </CardHeader>
                <CardContent className={yesCount > 0 ? 'text-red-700' : 'text-green-700'}>
                  <p className="font-semibold text-lg">
                    {yesCount} YES answer{yesCount !== 1 ? 's' : ''}
                  </p>
                  {yesCount > 0 ? (
                    <div className="mt-3 space-y-2">
                      <p className="font-semibold">Action Required:</p>
                      <p>Client should consult with their doctor before starting or significantly increasing physical activity. Provide client with PAR-Q results to take to their doctor.</p>
                      <p className="mt-2">Light activity may be acceptable with medical supervision, but moderate-vigorous activity should wait for medical clearance.</p>
                    </div>
                  ) : (
                    <p className="mt-2">Client has no apparent contraindications to physical activity. May proceed with gradual progressive exercise program.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {Object.keys(answers).length === 7 && (
              <Card>
                <CardHeader>
                  <CardTitle>Full Assessment Responses</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {PARQ_QUESTIONS.map((question, index) => (
                    <div key={index} className="border-l-4 border-slate-200 pl-3 py-2">
                      <p className="text-sm font-semibold text-slate-800 mb-1">
                        Q{index + 1}. {question}
                      </p>
                      <p className={`text-sm font-bold ${answers[index] === 'yes' ? 'text-red-600' : 'text-green-600'}`}>
                        Answer: {answers[index]?.toUpperCase()}
                      </p>
                      {answers[6] === "yes" && index === 6 && otherReasons && (
                        <p className="text-xs text-slate-600 mt-1 italic">
                          Other reasons specified: {otherReasons}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Follow-up actions, medical clearance obtained, exercise restrictions..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={Object.keys(answers).length < 7} className="bg-red-600 hover:bg-red-700">
            <Save className="w-4 h-4 mr-2" />
            Save PAR-Q
          </Button>
        </div>
      </div>
    </div>
  );
}