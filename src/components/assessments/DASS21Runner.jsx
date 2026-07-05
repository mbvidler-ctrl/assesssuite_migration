import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

const DASS21_QUESTIONS = [
  { category: "S", text: "I found it hard to wind down" },
  { category: "A", text: "I was aware of dryness of my mouth" },
  { category: "D", text: "I couldn't seem to experience any positive feeling at all" },
  { category: "A", text: "I experienced breathing difficulty (e.g., excessively rapid breathing, breathlessness in the absence of physical exertion)" },
  { category: "D", text: "I found it difficult to work up the initiative to do things" },
  { category: "S", text: "I tended to over-react to situations" },
  { category: "A", text: "I experienced trembling (e.g., in the hands)" },
  { category: "S", text: "I felt that I was using a lot of nervous energy" },
  { category: "A", text: "I was worried about situations in which I might panic and make a fool of myself" },
  { category: "D", text: "I felt that I had nothing to look forward to" },
  { category: "S", text: "I found myself getting agitated" },
  { category: "S", text: "I found it difficult to relax" },
  { category: "D", text: "I felt down-hearted and blue" },
  { category: "S", text: "I was intolerant of anything that kept me from getting on with what I was doing" },
  { category: "A", text: "I felt I was close to panic" },
  { category: "D", text: "I was unable to become enthusiastic about anything" },
  { category: "D", text: "I felt I wasn't worth much as a person" },
  { category: "S", text: "I felt that I was rather touchy" },
  { category: "A", text: "I was aware of the action of my heart in the absence of physical exertion (e.g., sense of heart rate increase, heart missing a beat)" },
  { category: "A", text: "I felt scared without any good reason" },
  { category: "D", text: "I felt that life was meaningless" }
];

const DASS21_OPTIONS = [
  "Did not apply to me at all",
  "Applied to me to some degree, or some of the time",
  "Applied to me to a considerable degree, or a good part of time",
  "Applied to me very much, or most of the time"
];

export default function DASS21Runner({ client, onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");

  const handleScoreChange = (questionIndex, score) => {
    setScores({ ...scores, [questionIndex]: score });
  };

  const calculateScores = () => {
    let depressionScore = 0;
    let anxietyScore = 0;
    let stressScore = 0;

    DASS21_QUESTIONS.forEach((q, i) => {
      const score = scores[i] || 0;
      if (q.category === "D") depressionScore += score;
      else if (q.category === "A") anxietyScore += score;
      else if (q.category === "S") stressScore += score;
    });

    // DASS-21 scores are multiplied by 2
    return {
      depression: depressionScore * 2,
      anxiety: anxietyScore * 2,
      stress: stressScore * 2
    };
  };

  const { depression, anxiety, stress } = calculateScores();

  const getInterpretation = (score, category) => {
    let level, color, bg;

    if (category === "depression") {
      if (score <= 9) { level = "Normal"; color = "text-green-600"; bg = "bg-green-50"; }
      else if (score <= 13) { level = "Mild"; color = "text-yellow-600"; bg = "bg-yellow-50"; }
      else if (score <= 20) { level = "Moderate"; color = "text-orange-600"; bg = "bg-orange-50"; }
      else if (score <= 27) { level = "Severe"; color = "text-red-600"; bg = "bg-red-50"; }
      else { level = "Extremely Severe"; color = "text-red-800"; bg = "bg-red-100"; }
    } else if (category === "anxiety") {
      if (score <= 7) { level = "Normal"; color = "text-green-600"; bg = "bg-green-50"; }
      else if (score <= 9) { level = "Mild"; color = "text-yellow-600"; bg = "bg-yellow-50"; }
      else if (score <= 14) { level = "Moderate"; color = "text-orange-600"; bg = "bg-orange-50"; }
      else if (score <= 19) { level = "Severe"; color = "text-red-600"; bg = "bg-red-50"; }
      else { level = "Extremely Severe"; color = "text-red-800"; bg = "bg-red-100"; }
    } else {
      if (score <= 14) { level = "Normal"; color = "text-green-600"; bg = "bg-green-50"; }
      else if (score <= 18) { level = "Mild"; color = "text-yellow-600"; bg = "bg-yellow-50"; }
      else if (score <= 25) { level = "Moderate"; color = "text-orange-600"; bg = "bg-orange-50"; }
      else if (score <= 33) { level = "Severe"; color = "text-red-600"; bg = "bg-red-50"; }
      else { level = "Extremely Severe"; color = "text-red-800"; bg = "bg-red-100"; }
    }
    return { level, color, bg };
  };

  const depressionInterpretation = getInterpretation(depression, "depression");
  const anxietyInterpretation = getInterpretation(anxiety, "anxiety");
  const stressInterpretation = getInterpretation(stress, "stress");

  const isAllAnswered = Object.keys(scores).length === 21;

  const handleSave = () => {
    if (!isAllAnswered) {
      toast.error("Please answer all 21 questions");
      return;
    }

    onSave({
      status: 'completed',
      result_value: (depression || 0) + (anxiety || 0) + (stress || 0),
      additional_data: {
        soap_text: `• DASS-21\n  Depression: ${depression}/42 — ${depressionInterpretation.level}\n  Anxiety: ${anxiety}/42 — ${anxietyInterpretation.level}\n  Stress: ${stress}/42 — ${stressInterpretation.level}`,
        depression_score: depression,
        anxiety_score: anxiety,
        stress_score: stress,
        depression_interpretation: depressionInterpretation.level,
        anxiety_interpretation: anxietyInterpretation.level,
        stress_interpretation: stressInterpretation.level,
        raw_scores: scores,
        measurement_type: 'dass21'
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">DASS-21</h2>
              <p className="text-slate-600 mt-1">Depression, Anxiety, and Stress Scale</p>
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
                <p>"Please read each statement and select the option that indicates how much the statement applied to you over the past week. There are no right or wrong answers."</p>
              </CardContent>
            </Card>

            {DASS21_QUESTIONS.map((q, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="text-base font-medium">
                    {i + 1}. {q.text}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {DASS21_OPTIONS.map((option, optionIndex) => (
                    <Button
                      key={optionIndex}
                      type="button"
                      variant={scores[i] === optionIndex ? "default" : "outline"}
                      onClick={() => handleScoreChange(i, optionIndex)}
                      className="w-full justify-start text-left h-auto py-3 px-4"
                    >
                      <span className="font-semibold mr-2">{optionIndex}.</span>
                      {option}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            ))}

            {isAllAnswered && (
              <div className="space-y-4">
                <Card className={`${depressionInterpretation.bg} border-2`}>
                  <CardHeader>
                    <CardTitle className={`text-lg ${depressionInterpretation.color}`}>
                      Depression: {depressionInterpretation.level}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className={depressionInterpretation.color}>
                    <p className="font-semibold text-xl">Score: {depression}/42</p>
                  </CardContent>
                </Card>

                <Card className={`${anxietyInterpretation.bg} border-2`}>
                  <CardHeader>
                    <CardTitle className={`text-lg ${anxietyInterpretation.color}`}>
                      Anxiety: {anxietyInterpretation.level}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className={anxietyInterpretation.color}>
                    <p className="font-semibold text-xl">Score: {anxiety}/42</p>
                  </CardContent>
                </Card>

                <Card className={`${stressInterpretation.bg} border-2`}>
                  <CardHeader>
                    <CardTitle className={`text-lg ${stressInterpretation.color}`}>
                      Stress: {stressInterpretation.level}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className={stressInterpretation.color}>
                    <p className="font-semibold text-xl">Score: {stress}/42</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Client presentation, specific concerns, clinical observations..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isAllAnswered} className="bg-purple-600 hover:bg-purple-700">
            <Save className="w-4 h-4 mr-2" />
            Save DASS-21
          </Button>
        </div>
      </div>
    </div>
  );
}