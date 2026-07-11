import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const SECTIONS = {
  symptoms: {
    name: "Symptoms",
    questions: [
      { id: "S1", text: "Do you feel grinding, hear clicking or any other type of noise from your hip?", 
        options: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "S2", text: "Difficulties spreading legs wide apart", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "S3", text: "Difficulties to stride out when walking", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] }
    ]
  },
  stiffness: {
    name: "Stiffness",
    questions: [
      { id: "S4", text: "How severe is your hip joint stiffness after first wakening in the morning?", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "S5", text: "How severe is your hip stiffness after sitting, lying or resting later in the day?", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] }
    ]
  },
  pain: {
    name: "Pain",
    questions: [
      { id: "P1", text: "How often is your hip painful?", 
        options: ["Never", "Monthly", "Weekly", "Daily", "Always"] },
      { id: "P2", text: "Straightening your hip fully", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P3", text: "Bending your hip fully", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P4", text: "Walking on flat surface", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P5", text: "Going up or down stairs", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P6", text: "At night while in bed", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P7", text: "Sitting or lying", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P8", text: "Standing upright", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P9", text: "Walking on a hard surface (asphalt, concrete, etc.)", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P10", text: "Walking on an uneven surface", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] }
    ]
  },
  adl: {
    name: "Function, Daily Living",
    questions: [
      { id: "A1", text: "Descending stairs", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A2", text: "Ascending stairs", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A3", text: "Rising from sitting", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A4", text: "Standing", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A5", text: "Bending to the floor/pick up an object", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A6", text: "Walking on flat surface", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A7", text: "Getting in/out of car", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A8", text: "Going shopping", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A9", text: "Putting on socks/stockings", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A10", text: "Rising from bed", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A11", text: "Taking off socks/stockings", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A12", text: "Lying in bed (turning over, maintaining hip position)", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A13", text: "Getting in/out of bath", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A14", text: "Sitting", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A15", text: "Getting on/off toilet", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A16", text: "Heavy domestic duties (moving heavy boxes, scrubbing floors, etc)", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A17", text: "Light domestic duties (cooking, dusting, etc)", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] }
    ]
  },
  sport: {
    name: "Sport & Recreation",
    questions: [
      { id: "SP1", text: "Squatting", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "SP2", text: "Running", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "SP3", text: "Twisting/pivoting on loaded leg", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "SP4", text: "Walking on uneven surface", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] }
    ]
  },
  qol: {
    name: "Quality of Life",
    questions: [
      { id: "Q1", text: "How often are you aware of your hip problem?", 
        options: ["Never", "Monthly", "Weekly", "Daily", "Constantly"] },
      { id: "Q2", text: "Have you modified your lifestyle to avoid activities potentially damaging to your hip?", 
        options: ["Not at all", "Mildly", "Moderately", "Severely", "Totally"] },
      { id: "Q3", text: "How much are you troubled with lack of confidence in your hip?", 
        options: ["Not at all", "Mildly", "Moderately", "Severely", "Extremely"] },
      { id: "Q4", text: "In general, how much difficulty do you have with your hip?", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] }
    ]
  }
};

export default function HOOSRunner({ onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [activeTab, setActiveTab] = useState("symptoms");

  const handleResponseChange = (questionId, value) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const calculateSectionScore = (sectionKey) => {
    const section = SECTIONS[sectionKey];
    const sectionResponses = section.questions.map(q => responses[q.id]).filter(r => r !== undefined);
    if (sectionResponses.length === 0) return null;
    
    const sum = sectionResponses.reduce((acc, val) => acc + val, 0);
    const maxPossible = section.questions.length * 4;
    return ((1 - (sum / maxPossible)) * 100).toFixed(1);
  };

  const getTotalQuestions = () => {
    return Object.values(SECTIONS).reduce((sum, section) => sum + section.questions.length, 0);
  };

  const getAnsweredQuestions = () => {
    return Object.keys(responses).length;
  };

  const handleSave = () => {
    const totalQuestions = getTotalQuestions();
    const answered = getAnsweredQuestions();
    
    if (answered < totalQuestions) {
      toast.error(`Please answer all ${totalQuestions} questions (${answered}/${totalQuestions} completed)`);
      return;
    }

    const sectionScores = {};
    Object.keys(SECTIONS).forEach(key => {
      sectionScores[key] = parseFloat(calculateSectionScore(key));
    });

    const averageScore = Object.values(sectionScores).reduce((a, b) => a + b, 0) / Object.keys(sectionScores).length;

    // Build comprehensive SOAP text
    let soapText = `• Hip Outcome Score (HOOS):\n`;
    soapText += `  Average Score: ${averageScore.toFixed(1)}/100\n`;
    soapText += `  Subscale Scores:\n`;
    
    Object.entries(SECTIONS).forEach(([key, section]) => {
      soapText += `    • ${section.name}: ${sectionScores[key]}/100\n`;
    });

    soapText += `\n  Detailed Responses:\n`;
    Object.entries(SECTIONS).forEach(([sectionKey, section]) => {
      soapText += `\n  ${section.name}:\n`;
      section.questions.forEach(question => {
        const responseIdx = responses[question.id];
        const responseText = question.options[responseIdx] || "Not answered";
        soapText += `    ${question.id}. ${question.text}: ${responseText} (${responseIdx})\n`;
      });
    });

    onSave({
      responses,
      section_scores: sectionScores,
      average_score: averageScore.toFixed(1),
      additional_data: {
        measurement_type: "HOOS",
        section_scores: sectionScores,
        average_score: averageScore.toFixed(1),
        soap_text: soapText
      },
      notes: soapText,
      assessment_date: todayLocal()
    });
  };

  const allAnswered = getAnsweredQuestions() === getTotalQuestions();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">HOOS</h2>
              <p className="text-slate-600 mt-1">Hip Disability and Osteoarthritis Outcome Score</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Instructions */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800">
                <p className="italic mb-2">
                  "This survey asks for your view about your hip. This information will help us keep track of how you feel about your hip and how well you are able to do your usual activities."
                </p>
                <p>Think about your hip symptoms and difficulties <strong>during the last week</strong>.</p>
              </CardContent>
            </Card>

            {/* Progress */}
            <div className="text-center text-sm text-slate-600">
              {getAnsweredQuestions()} / {getTotalQuestions()} questions answered
            </div>

            {/* Tabs for Sections */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="symptoms">Symptoms</TabsTrigger>
                <TabsTrigger value="stiffness">Stiffness</TabsTrigger>
                <TabsTrigger value="pain">Pain</TabsTrigger>
                <TabsTrigger value="adl">Daily Living</TabsTrigger>
                <TabsTrigger value="sport">Sport/Rec</TabsTrigger>
                <TabsTrigger value="qol">QoL</TabsTrigger>
              </TabsList>

              {Object.entries(SECTIONS).map(([key, section]) => (
                <TabsContent key={key} value={key} className="mt-4 space-y-4">
                  <h3 className="font-bold text-lg text-slate-900">{section.name}</h3>
                  {key === "pain" && (
                    <p className="text-sm text-slate-600 italic mb-4">
                      What amount of hip pain have you experienced the last week during the following activities?
                    </p>
                  )}
                  {key === "adl" && (
                    <p className="text-sm text-slate-600 italic mb-4">
                      For each of the following activities, please indicate the degree of difficulty you have experienced in the last week due to your hip.
                    </p>
                  )}
                  {key === "sport" && (
                    <p className="text-sm text-slate-600 italic mb-4">
                      What degree of difficulty have you experienced during the last week due to your hip?
                    </p>
                  )}

                  {section.questions.map((question, idx) => (
                    <Card key={question.id} className={responses[question.id] !== undefined ? "border-green-200 bg-green-50/30" : ""}>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold text-slate-900">
                          {question.id}. {question.text}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-5 gap-2">
                          {question.options.map((option, optIdx) => (
                            <Button
                              key={optIdx}
                              type="button"
                              variant={responses[question.id] === optIdx ? "default" : "outline"}
                              onClick={() => handleResponseChange(question.id, optIdx)}
                              className={`h-auto py-2 px-1 text-xs ${
                                responses[question.id] === optIdx ? 'bg-purple-600 text-white' : 'hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-bold">{optIdx}</span>
                                <span className="text-[9px] leading-tight text-center">{option}</span>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Section Score */}
                  {calculateSectionScore(key) !== null && (
                    <div className="bg-slate-100 p-4 rounded-lg text-center">
                      <p className="text-sm text-slate-600">Section Score</p>
                      <p className="text-2xl font-bold text-purple-600">{calculateSectionScore(key)} / 100</p>
                      <p className="text-xs text-slate-500 mt-1">Higher = Better function</p>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>

            {/* Overall Summary */}
            {allAnswered && (
              <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 border-2">
                <CardContent className="py-6">
                  <h3 className="font-bold text-slate-900 mb-4 text-center text-lg">HOOS Subscale Scores</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    {Object.entries(SECTIONS).map(([key, section]) => (
                      <div key={key} className="bg-white rounded-lg p-3 text-center">
                        <p className="text-xs text-slate-600 mb-1">{section.name}</p>
                        <p className="text-2xl font-bold text-purple-600">{calculateSectionScore(key)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-xs text-center text-slate-600 bg-white/70 rounded p-2">
                    Scores range 0-100. 0 = extreme hip problems, 100 = no hip problems
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <div className="text-sm text-slate-600">
            {getAnsweredQuestions()} / {getTotalQuestions()} completed
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!allAnswered}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Save HOOS Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}