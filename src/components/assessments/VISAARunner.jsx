import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

// â”€â”€â”€ VISA-A QUESTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const VISA_A_QUESTIONS = [
  {
    id: 1,
    text: "How much pain do you have at the moment at the front of your knee?",
    subscale: "Symptoms"
  },
  {
    id: 2,
    text: "Do you have pain, ache or other symptoms from the front of your knee when walking on flat ground?",
    subscale: "Symptoms"
  },
  {
    id: 3,
    text: "Do you have pain, ache or other symptoms from the front of your knee when going up stairs?",
    subscale: "Symptoms"
  },
  {
    id: 4,
    text: "Do you have pain, ache or other symptoms from the front of your knee when going down stairs?",
    subscale: "Symptoms"
  },
  {
    id: 5,
    text: "Do you have pain, ache or other symptoms from the front of your knee at the end of the day?",
    subscale: "Symptoms"
  },
  {
    id: 6,
    text: "How long is your morning stiffness from the front of your knee?",
    subscale: "Function (ADL)"
  },
  {
    id: 7,
    text: "During the past 4 weeks, how many days have you been unable to train due to pain from the front of your knee?",
    subscale: "Function (Sport)"
  },
  {
    id: 8,
    text: "Have you undergone any treatment for the front of your knee in the past 4 weeks?",
    subscale: "Function (Sport)"
  }
];

// â”€â”€â”€ INTERPRETATION LOGIC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const getVISAAInterpretation = (score) => {
  if (score >= 60) return { label: "Minimal Symptoms", color: "bg-green-100 text-green-900" };
  if (score >= 40) return { label: "Mild Symptoms", color: "bg-blue-100 text-blue-900" };
  if (score >= 20) return { label: "Moderate Symptoms", color: "bg-amber-100 text-amber-900" };
  return { label: "Severe Symptoms", color: "bg-red-100 text-red-900" };
};

// â”€â”€â”€ COMPONENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function VISAARunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");
  const [showProtocol, setShowProtocol] = useState(true);

  const handleResponseChange = (questionId, value) => {
    setResponses({
      ...responses,
      [questionId]: Math.max(0, Math.min(10, parseInt(value) || 0))
    });
  };

  const calculateScore = () => {
    const values = Object.values(responses);
    return values.length === VISA_A_QUESTIONS.length
      ? values.reduce((sum, val) => sum + val, 0)
      : null;
  };

  const handleSave = () => {
    if (Object.keys(responses).length !== VISA_A_QUESTIONS.length) {
      toast.error("Please answer all 8 questions.");
      return;
    }

    const totalScore = calculateScore();
    const interpretation = getVISAAInterpretation(totalScore);

    const soapText = `â€¢ VISA-A (Victorian Institute of Sport Assessment â€” Anterior Knee Pain)
  
  ASSESSMENT OVERVIEW:
  Client self-reports pain and function related to anterior knee pain (AKP).
  Scored 0â€“10 per item (0 = worst, 10 = best).
  
  INDIVIDUAL ITEM SCORES:
  ${VISA_A_QUESTIONS.map(q => `  Q${q.id} (${q.subscale}): ${responses[q.id] || 0}/10`).join("\n")}
  
  TOTAL SCORE:
  ${totalScore}/80
  
  INTERPRETATION:
  ${interpretation.label}
  
  CLINICAL SIGNIFICANCE:
  ${totalScore >= 60 ? "Client demonstrates minimal symptoms related to anterior knee pain. Good functional capacity for ADLs and sport." : ""}
  ${totalScore >= 40 && totalScore < 60 ? "Client reports mild to moderate anterior knee pain. Some functional limitations in ADLs or sport participation noted." : ""}
  ${totalScore >= 20 && totalScore < 40 ? "Client reports moderate to severe anterior knee pain with significant functional limitations in ADLs and/or sport." : ""}
  ${totalScore < 20 ? "Client reports severe anterior knee pain with substantial functional impairment. Urgent rehabilitation intervention recommended." : ""}
  
  SCORE TRENDS:
  Monitor longitudinal score changes to track response to intervention.
  Score improvement of 10â€“15 points typically indicates clinically meaningful change.
  
  ${notes ? `CLINICIAN NOTES:\n  ${notes}` : ""}`;

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        measurement_type: "visa_a",
        individual_scores: responses,
        total_score: totalScore,
        interpretation: interpretation.label,
        soap_text: soapText,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("VISA-A assessment saved.");
    setTimeout(() => onClose(), 500);
  };

  const totalScore = calculateScore();
  const interpretation = totalScore !== null ? getVISAAInterpretation(totalScore) : null;
  const allAnswered = Object.keys(responses).length === VISA_A_QUESTIONS.length;

  // â”€â”€â”€ RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[95vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-t-2xl px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-bold">VISA-A Assessment</h2>
            <p className="text-cyan-100 text-sm mt-1">Victorian Institute of Sport Assessment â€” Anterior Knee Pain</p>
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
                <p className="text-sm font-semibold text-slate-900">{client?.full_name || "â€”"}</p>
              </div>
              <div>
                <Label className="text-xs text-slate-600">Assessment Date</Label>
                <p className="text-sm font-semibold text-slate-900">{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Protocol Instructions */}
            <div className="border border-cyan-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowProtocol(v => !v)}
                className="w-full flex justify-between items-center bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900 hover:bg-cyan-100 transition-colors"
              >
                <span>ðŸ“‹ Clinician Instructions</span>
                {showProtocol ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showProtocol && (
                <div className="p-4 text-sm text-cyan-800 space-y-2 bg-cyan-50 border-t border-cyan-200">
                  <p><strong>Purpose:</strong> Assess pain and function related to anterior knee pain (AKP).</p>
                  <p><strong>Format:</strong> Client self-rates 8 items on 0â€“10 scale (0 = worst, 10 = best).</p>
                  <p><strong>Scoring:</strong> Sum all 8 responses for total score (0â€“80). Higher scores = better function/fewer symptoms.</p>
                  <p><strong>Administration:</strong> Clarify any unclear questions. Ensure client understands the rating scale before starting.</p>
                </div>
              )}
            </div>
          </div>

          {/* Score Display */}
          {allAnswered && totalScore !== null && (
            <Card className="border-2 border-cyan-300 bg-cyan-50">
              <CardHeader>
                <CardTitle>Current Score & Interpretation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <p className="text-sm text-slate-600 mb-2">Total VISA-A Score</p>
                  <p className="text-5xl font-bold text-slate-900">{totalScore}</p>
                  <p className="text-base text-slate-600 mt-1">/ 80</p>
                </div>
                <div className="bg-white p-3 rounded border border-cyan-200 text-center">
                  <Badge className={`text-sm px-3 py-1 ${interpretation.color}`}>
                    {interpretation.label}
                  </Badge>
                </div>
                <div className="bg-white p-3 rounded border border-slate-200 text-xs text-slate-700 space-y-1">
                  <p className="font-semibold">Score Guide:</p>
                  <p>â€¢ <strong>60â€“80:</strong> Minimal symptoms, good function</p>
                  <p>â€¢ <strong>40â€“59:</strong> Mild to moderate symptoms</p>
                  <p>â€¢ <strong>20â€“39:</strong> Moderate to severe symptoms</p>
                  <p>â€¢ <strong>0â€“19:</strong> Severe symptoms, substantial impairment</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Questions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Questions (Rate 0â€“10)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {VISA_A_QUESTIONS.map((question) => (
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
                        placeholder="0â€“10"
                        className="w-20"
                      />
                      <span className="text-sm text-slate-600">
                        {responses[question.id] !== undefined ? `${responses[question.id]}/10` : "â€”"}
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
                placeholder="Clinician observations, pain location characteristics, exacerbating factors, intervention recommendations..."
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
              <p><strong>Watson CJ, Propps M, Ratner J, et al.</strong> Reliability and responsiveness of the Lower Extremity Functional Scale and the anterior knee pain scale in patients with anterior knee pain. <em>J Orthop Sports Phys Ther</em>. 2005;35(3):136â€“146.</p>
              <p><strong>Crossley KM, Bennell KL, Cowan SM, Green S.</strong> Analysis of outcome measures for persons with patellofemoral pain: which are reliable and responsive? <em>Arch Phys Med Rehabil</em>. 2004;85(5):815â€“822.</p>
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
            className={`${allAnswered ? "bg-cyan-600 hover:bg-cyan-700 text-white" : "bg-slate-300 text-slate-500 cursor-not-allowed"}`}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}