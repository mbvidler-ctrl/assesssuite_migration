import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, ChevronLeft, ChevronRight, Info, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const DASH_QUESTIONS = [
  // Section A: Physical Function (items 1-21)
  { text: "Open a tight or new jar", section: "A" },
  { text: "Write", section: "A" },
  { text: "Turn a key", section: "A" },
  { text: "Prepare a meal", section: "A" },
  { text: "Push open a heavy door", section: "A" },
  { text: "Place an object on a shelf above your head", section: "A" },
  { text: "Do heavy household chores (e.g., wash walls, wash floors)", section: "A" },
  { text: "Garden or do yard work", section: "A" },
  { text: "Make a bed", section: "A" },
  { text: "Carry a shopping bag or briefcase", section: "A" },
  { text: "Carry a heavy object (over 5 lbs)", section: "A" },
  { text: "Change a lightbulb overhead", section: "A" },
  { text: "Wash or blow dry your hair", section: "A" },
  { text: "Wash your back", section: "A" },
  { text: "Put on a pullover sweater", section: "A" },
  { text: "Use a knife to cut food", section: "A" },
  { text: "Recreational activities which require little effort (e.g., cardplaying, knitting)", section: "A" },
  { text: "Recreational activities in which you take some force or impact through your arm, shoulder or hand (e.g., golf, hammering, tennis)", section: "A" },
  { text: "Recreational activities in which you move your arm freely (e.g., playing frisbee, badminton)", section: "A" },
  { text: "Manage transportation needs (getting from one place to another)", section: "A" },
  { text: "Sexual activities", section: "A" },
  // Section B: Symptoms (items 22-30)
  { text: "During the past week, to what extent has your arm, shoulder or hand problem interfered with your normal social activities with family, friends, neighbours or groups?", section: "B" },
  { text: "During the past week, were you limited in your work or other regular daily activities as a result of your arm, shoulder or hand problem?", section: "B" },
  { text: "Arm, shoulder or hand pain", section: "B_symptom" },
  { text: "Arm, shoulder or hand pain when you performed any specific activity", section: "B_symptom" },
  { text: "Tingling (pins and needles) in your arm, shoulder or hand", section: "B_symptom" },
  { text: "Weakness in your arm, shoulder or hand", section: "B_symptom" },
  { text: "Stiffness in your arm, shoulder or hand", section: "B_symptom" },
  { text: "During the past week, how much difficulty have you had sleeping due to the pain in your arm, shoulder or hand?", section: "B_sleep" },
  { text: "I feel less capable, less confident or less useful because of my arm, shoulder or hand problem", section: "B_psych" },
];

const OPTION_SETS = {
  A: [
    { label: "No difficulty", value: 1 },
    { label: "Mild difficulty", value: 2 },
    { label: "Moderate difficulty", value: 3 },
    { label: "Severe difficulty", value: 4 },
    { label: "Unable", value: 5 },
  ],
  B: [
    { label: "Not at all", value: 1 },
    { label: "Slightly", value: 2 },
    { label: "Moderately", value: 3 },
    { label: "Quite a bit", value: 4 },
    { label: "Extremely", value: 5 },
  ],
  B_symptom: [
    { label: "None", value: 1 },
    { label: "Mild", value: 2 },
    { label: "Moderate", value: 3 },
    { label: "Severe", value: 4 },
    { label: "Extreme", value: 5 },
  ],
  B_sleep: [
    { label: "No difficulty", value: 1 },
    { label: "Mild difficulty", value: 2 },
    { label: "Moderate difficulty", value: 3 },
    { label: "Severe difficulty", value: 4 },
    { label: "So much difficulty it prevented sleep", value: 5 },
  ],
  B_psych: [
    { label: "Strongly disagree", value: 1 },
    { label: "Disagree", value: 2 },
    { label: "Neither agree nor disagree", value: 3 },
    { label: "Agree", value: 4 },
    { label: "Strongly agree", value: 5 },
  ],
};

const ITEMS_PER_PAGE = 10;
const INSTRUCTION_PAGE = 0; // page 0 = instructions, pages 1-3 = questions

export default function DASHRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState(Array(30).fill(null));
  const [notes, setNotes] = useState("");
  const [page, setPage] = useState(0);

  const questionPages = Math.ceil(DASH_QUESTIONS.length / ITEMS_PER_PAGE);
  const totalPages = questionPages + 1; // +1 for instructions
  const isInstructionPage = page === INSTRUCTION_PAGE;
  const questionPage = page - 1; // 0-indexed question page
  const startIdx = questionPage * ITEMS_PER_PAGE;
  const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, DASH_QUESTIONS.length);
  const currentQuestions = isInstructionPage ? [] : DASH_QUESTIONS.slice(startIdx, endIdx);

  const answeredCount = responses.filter(r => r !== null).length;
  const progress = Math.round((answeredCount / 30) * 100);

  const handleSelect = (qIndex, value) => {
    const updated = [...responses];
    updated[startIdx + qIndex] = value;
    setResponses(updated);
  };

  const handleSave = () => {
    const unanswered = responses.filter(r => r === null).length;
    if (unanswered > 0) {
      toast.error(`Please answer all questions. ${unanswered} remaining.`);
      return;
    }

    const sum = responses.reduce((acc, v) => acc + v, 0);
    const dashScore = ((sum / 30 - 1) / 4) * 100;
    const rounded = Math.round(dashScore * 10) / 10;

    const interpretation = rounded <= 20 ? "Minimal disability" :
      rounded <= 40 ? "Mild disability" :
      rounded <= 60 ? "Moderate disability" :
      rounded <= 80 ? "Severe disability" : "Complete disability";

    const soapLines = DASH_QUESTIONS.map((q, i) => {
      const opts = OPTION_SETS[q.section] || OPTION_SETS.A;
      const opt = opts.find(o => o.value === responses[i]);
      return `  Q${i + 1}. ${q.text}: ${opt?.label || responses[i]} (${responses[i]})`;
    }).join("\n");

    const soap_text = `DASH (Full Version)\n• Score: ${rounded}/100\n• Interpretation: ${interpretation}\n\nItem Responses:\n${soapLines}`;

    onSave({
      status: "completed",
      result_value: rounded,
      additional_data: {
        measurement_type: "questionnaire_external",
        score: rounded,
        interpretation,
        responses,
        soap_text,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    
    toast.success("DASH assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">DASH – Full Version</h2>
            <p className="text-sm text-slate-500">Disabilities of the Arm, Shoulder and Hand (30 items)</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 bg-slate-50 border-b">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{answeredCount} / 30 answered</span>
            <span>{isInstructionPage ? "Instructions" : `Page ${page} of ${questionPages}`}</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Instructions page */}
          {isInstructionPage && (
            <>
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-blue-900 space-y-2">
                  <p>Rate each activity based on difficulty during the <strong>past week</strong>.</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Physical function: Rate difficulty performing tasks</li>
                    <li>Social/work impact: Rate degree of interference</li>
                    <li>Symptoms: Rate severity or frequency</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">Score Interpretation</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <div className="bg-slate-50 p-3 rounded space-y-1">
                    <p><strong>0–20:</strong> Minimal disability</p>
                    <p><strong>21–40:</strong> Mild disability</p>
                    <p><strong>41–60:</strong> Moderate disability</p>
                    <p><strong>61–80:</strong> Severe disability</p>
                    <p><strong>81–100:</strong> Complete disability</p>
                  </div>
                  <p className="text-slate-600 mt-3"><strong>MCID:</strong> 10.83 points (clinically meaningful change)</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">Reference & Resources</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                  <p className="text-slate-700">
                    Hudak PL, Amadio PC, Bombardier C. (1996). The Upper Extremity Collaborative Group. <em>The DASH outcome measure user's manual.</em> 2nd ed.
                  </p>
                  <Button
                    onClick={() => window.open('https://www.dash.iwh.on.ca/', '_blank')}
                    variant="outline"
                    className="w-full text-left"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Official DASH Website
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {/* Questions */}
          {!isInstructionPage && currentQuestions.map((q, localIdx) => {
            const globalIdx = startIdx + localIdx;
            const options = OPTION_SETS[q.section] || OPTION_SETS.A;
            const selected = responses[globalIdx];
            return (
              <div key={globalIdx} className="space-y-2 pb-3 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-800">
                  <span className="text-blue-600 font-semibold mr-2">{globalIdx + 1}.</span>
                  {q.text}
                </p>
                <div className="flex flex-wrap gap-2">
                  {options.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleSelect(localIdx, opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        selected === opt.value
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50"
                      }`}
                    >
                      {opt.value}. {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {page === totalPages - 1 && !isInstructionPage && (
            <div className="mt-4">
              <label className="text-sm font-medium text-slate-700 block mb-1">Clinical Notes</label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Additional observations..."
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex justify-between items-center px-6 py-4 border-t bg-slate-50">
          <Button variant="outline" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>

          {page < totalPages - 1 ? (
            <Button onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-2" /> Save DASH
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}