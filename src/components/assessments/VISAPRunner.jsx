import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// ─── VISA-P QUESTIONS ──────────────────────────────────────────────────────
const VISA_P_QUESTIONS = [
  {
    id: 1,
    text: "How much pain do you have at the moment at the site of your patellar tendon?",
    subscale: "Symptoms"
  },
  {
    id: 2,
    text: "Do you have pain, ache or other symptoms from your patellar tendon when walking on flat ground?",
    subscale: "Symptoms"
  },
  {
    id: 3,
    text: "Do you have pain, ache or other symptoms from your patellar tendon when going up stairs?",
    subscale: "Symptoms"
  },
  {
    id: 4,
    text: "Do you have pain, ache or other symptoms from your patellar tendon when going down stairs?",
    subscale: "Symptoms"
  },
  {
    id: 5,
    text: "Do you have pain, ache or other symptoms from your patellar tendon at the end of the day?",
    subscale: "Symptoms"
  },
  {
    id: 6,
    text: "How long is your morning stiffness from your patellar tendon?",
    subscale: "Function (ADL)"
  },
  {
    id: 7,
    text: "During the past 4 weeks, how many days have you been unable to train due to your patellar tendon?",
    subscale: "Function (Sport)"
  },
  {
    id: 8,
    text: "Have you undergone any treatment for your patellar tendon in the past 4 weeks?",
    subscale: "Function (Sport)"
  }
];

// ─── INTERPRETATION LOGIC ──────────────────────────────────────────────────
const getVISAPInterpretation = (score) => {
  if (score >= 60) return { label: "Minimal Symptoms", color: "bg-green-100 text-green-900" };
  if (score >= 40) return { label: "Mild Symptoms", color: "bg-blue-100 text-blue-900" };
  if (score >= 20) return { label: "Moderate Symptoms", color: "bg-amber-100 text-amber-900" };
  return { label: "Severe Symptoms", color: "bg-red-100 text-red-900" };
};

// ─── COMPONENT ──────────────────────────────────────────────────────────────
export default function VISAPRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");
  const [showProtocol, setShowProtocol] = useState(true);
  const [completed, setCompleted] = useState(false);

  const handleResponseChange = (questionId, value) => {
    setResponses({
      ...responses,
      [questionId]: Math.max(0, Math.min(10, parseInt(value) || 0))
    });
  };

  const calculateScore = () => {
    const values = Object.values(responses);
    return values.length === VISA_P_QUESTIONS.length
      ? values.reduce((sum, val) => sum + val, 0)
      : null;
  };

  const handleSave = () => {
    if (Object.keys(responses).length !== VISA_P_QUESTIONS.length) {
      toast.error("Please answer all 8 questions.");
      return;
    }

    const totalScore = calculateScore();
    const interpretation = getVISAPInterpretation(totalScore);

    const soapText = `• VISA-P (Victorian Institute of Sport Assessment — Patellar Tendinopathy)
  
  ASSESSMENT OVERVIEW:
  Client self-reports pain, function in activities of daily living (ADLs), and sports participation.
  Scored 0–10 per item (0 = worst, 10 = best).
  
  INDIVIDUAL ITEM SCORES:
  ${VISA_P_QUESTIONS.map(q => `  Q${q.id} (${q.subscale}): ${responses[q.id] || 0}/10`).join("\n")}
  
  TOTAL SCORE:
  ${totalScore}/80
  
  INTERPRETATION:
  ${interpretation.label}
  
  CLINICAL SIGNIFICANCE:
  ${totalScore >= 60 ? "Client demonstrates minimal symptoms related to patellar tendon pathology. Good functional capacity for ADLs and sport." : ""}
  ${totalScore >= 40 && totalScore < 60 ? "Client reports mild to moderate symptoms. Some functional limitations in ADLs or sport participation noted." : ""}
  ${totalScore >= 20 && totalScore < 40 ? "Client reports moderate to severe symptoms with significant functional limitations in ADLs and/or sport." : ""}
  ${totalScore < 20 ? "Client reports severe symptoms with substantial functional impairment. Urgent rehabilitation intervention recommended." : ""}
  
  SCORE TRENDS:
  Monitor longitudinal score changes to track response to intervention.
  Score improvement of 10–15 points typically indicates clinically meaningful change.
  
  ${notes ? `CLINICIAN NOTES:\n  ${notes}` : ""}`;

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        measurement_type: "visa_p",
        individual_scores: responses,
        total_score: totalScore,
        interpretation: interpretation.label,
        soap_text: soapText,
      },
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("VISA-P assessment saved.");
    setTimeout(() => onClose(), 500);
  };

  const totalScore = calculateScore();
  const interpretation = totalScore !== null ? getVISAPInterpretation(totalScore) : null;
  const allAnswered = Object.keys(responses).length === VISA_P_QUESTIONS.length;

  // ─── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[95vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-blue-700 text-white rounded-t-2xl px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-bold">VISA-P Assessment</h2>
            <p className="text-indigo-100 text-sm mt-1">Victorian Institute of Sport Assessment — Patellar Tendinopathy</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">

          {/* Client Info & Instructions */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-slate-600">Client Name</Label>
                <p className="text-sm font-semibold text-slate-900">{client?.full_name || "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-slate-600">Assessment Date</Label>
                <p className="text-sm font-semibold text-slate-900">{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Protocol Instructions */}
            <div className="border border-indigo-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowProtocol(v => !v)}
                className="w-full flex justify-between items-center bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-900 hover:bg-indigo-100 transition-colors"
              >
                <span>📋 Clinician Instructions</span>
                {showProtocol ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showProtocol && (
                <div className="p-4 text-sm text-indigo-800 space-y-2 bg-indigo-50 border-t border-indigo-200">
                  <p><strong>Purpose:</strong> Assess pain and function related to patellar tendinopathy.</p>
                  <p><strong>Format:</strong> Client self-rates 8 items on 0–10 scale (0 = worst, 10 = best).</p>
                  <p><strong>Scoring:</strong> Sum all 8 responses for total score (0–80). Higher scores = better function/fewer symptoms.</p>
                  <p><strong>Administration:</strong> Clarify any unclear questions. Ensure client understands the rating scale before starting.</p>
                </div>
              )}
            </div>
          </div>

          {/* Score Display */}
          {allAnswered && totalScore !== null && (
            <Card className="border-2 border-indigo-300 bg-indigo-50">
              <CardHeader>
                <CardTitle>Current Score & Interpretation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <p className="text-sm text-slate-600 mb-2">Total VISA-P Score</p>
                  <p className="text-5xl font-bold text-slate-900">{totalScore}</p>
                  <p className="text-base text-slate-600 mt-1">/ 80</p>
                </div>
                <div className="bg-white p-3 rounded border border-indigo-200 text-center">
                  <Badge className={`text-sm px-3 py-1 ${interpretation.color}`}>
                    {interpretation.label}
                  </Badge>
                </div>
                <div className="bg-white p-3 rounded border border-slate-200 text-xs text-slate-700 space-y-1">
                  <p className="font-semibold">Score Guide:</p>
                  <p>• <strong>60–80:</strong> Minimal symptoms, good function</p>
                  <p>• <strong>40–59:</strong> Mild to moderate symptoms</p>
                  <p>• <strong>20–39:</strong> Moderate to severe symptoms</p>
                  <p>• <strong>0–19:</strong> Severe symptoms, substantial impairment</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Questions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Questions (Rate 0–10)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {VISA_P_QUESTIONS.map((question) => (
                  <div key={question.id} className="pb-4 border-b border-slate-200 last:border-b-0 last:pb-0">
                    <div className="flex justify-between items-start mb-2">
                      <Label className="text-sm font-semibold text-slate-900">
                        Q{question.id}: {question.text}
                      </Label>
                      <span className="text-xs text-slate-500 ml-2">{question.subscale}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        value={responses[question.id] ?? ""}
                        onChange={(e) => handleResponseChange(question.id, e.target.value)}
                        placeholder="0–10"
                        className="w-20"
                      />
                      <span className="text-sm text-slate-600">
                        {responses[question.id] !== undefined ? `${responses[question.id]}/10` : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Clinical Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clinical Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Clinician observations, context, contraindications, exercise recommendations..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Reference */}
          <Card className="border-slate-200 bg-slate-50">
            <CardHeader>
              <CardTitle className="text-base">Reference</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 space-y-2">
              <p><strong>Bisset A, Coombes B, Vicenzino B.</strong> Efficacy and prognostic factors for common tendinopathy management: a review of the literature. <em>Aust J Physiother</em>. 2011;57(2):86–99.</p>
              <p><strong>Visentini PJ, Khan KM, Cook JL, et al.</strong> The VISA score: an index of severity of symptoms in patients with jumper's knee (patellar tendinosis). <em>J Sci Med Sport</em>. 1998;1(1):22–28.</p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t bg-slate-50 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          <Button
            onClick={handleSave}
            disabled={!allAnswered}
            className={`${allAnswered ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-slate-300 text-slate-500 cursor-not-allowed"}`}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}