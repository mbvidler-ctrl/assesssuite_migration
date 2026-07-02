import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

const QUESTIONS = [
  {
    id: "aqol1",
    domain: "Independent Living",
    text: "Do you need any help looking after yourself? (For example: dressing, bathing, eating)",
    options: [
      { label: "I need no help at all.", value: 0 },
      { label: "Occasionally I need some help with personal care tasks.", value: 1 },
      { label: "I need help with the more difficult personal care tasks.", value: 2 },
      { label: "I need daily help with most or all personal care tasks.", value: 3 },
    ],
  },
  {
    id: "aqol2",
    domain: "Independent Living",
    text: "When doing household tasks: (For example: cooking, cleaning the house, washing)",
    options: [
      { label: "I need no help at all.", value: 0 },
      { label: "Occasionally I need some help with household tasks.", value: 1 },
      { label: "I need help with the more difficult household tasks.", value: 2 },
      { label: "I need daily help with most or all household tasks.", value: 3 },
    ],
  },
  {
    id: "aqol3",
    domain: "Independent Living",
    text: "Thinking about how easily you can get around your home and community:",
    options: [
      { label: "I get around my home and community by myself without any difficulty.", value: 0 },
      { label: "I find it difficult to get around my home and community by myself.", value: 1 },
      { label: "I cannot get around the community by myself, but I can get around my home with some difficulty.", value: 2 },
      { label: "I cannot get around either the community or my home by myself.", value: 3 },
    ],
  },
  {
    id: "aqol4",
    domain: "Relationships",
    text: "Because of your health, your relationships (for example: with your friends, partner or parents) generally:",
    options: [
      { label: "Are very close and warm.", value: 0 },
      { label: "Are sometimes close and warm.", value: 1 },
      { label: "Are seldom close and warm.", value: 2 },
      { label: "I have no close and warm relationships.", value: 3 },
    ],
  },
  {
    id: "aqol5",
    domain: "Relationships",
    text: "Thinking about your relationship with other people:",
    options: [
      { label: "I have plenty of friends, and am never lonely.", value: 0 },
      { label: "Although I have friends, I am occasionally lonely.", value: 1 },
      { label: "I have some friends, but am often lonely for company.", value: 2 },
      { label: "I am socially isolated and feel lonely.", value: 3 },
    ],
  },
  {
    id: "aqol6",
    domain: "Relationships",
    text: "Thinking about your health and your relationship with your family:",
    options: [
      { label: "My role in the family is unaffected by my health.", value: 0 },
      { label: "There are some parts of my family role I cannot carry out.", value: 1 },
      { label: "There are many parts of my family role I cannot carry out.", value: 2 },
      { label: "I cannot carry out any part of my family role.", value: 3 },
    ],
  },
  {
    id: "aqol7",
    domain: "Senses",
    text: "Thinking about your vision, including when using your glasses or contact lenses if needed:",
    options: [
      { label: "I see normally.", value: 0 },
      { label: "I have some difficulty focusing on things, or I do not see them sharply (e.g. small print, newspaper or seeing objects in the distance).", value: 1 },
      { label: "I have a lot of difficulty seeing things. My vision is blurred (e.g. I can see just enough to get by with).", value: 2 },
      { label: "I only see general shapes, or am blind (e.g. I need a guide to move around).", value: 3 },
    ],
  },
  {
    id: "aqol8",
    domain: "Senses",
    text: "Thinking about your hearing, including using your hearing aid if needed:",
    options: [
      { label: "I hear normally.", value: 0 },
      { label: "I have some difficulty hearing or I do not hear clearly (e.g. I ask people to speak up, or turn up the TV/radio volume).", value: 1 },
      { label: "I have difficulty hearing things clearly. Often I do not understand what is said. I usually do not take part in conversations because I cannot hear.", value: 2 },
      { label: "I hear very little indeed. I cannot fully understand loud voices speaking directly to me.", value: 3 },
    ],
  },
  {
    id: "aqol9",
    domain: "Senses",
    text: "When you communicate with others: (For example: by talking, listening, writing or signing.)",
    options: [
      { label: "I have no trouble speaking to them or understanding what they are saying.", value: 0 },
      { label: "I have some difficulty being understood by people who do not know me. I have no trouble understanding what others say.", value: 1 },
      { label: "I am only understood by people who know me well. I have great trouble understanding what others are saying to me.", value: 2 },
      { label: "I cannot adequately communicate with others.", value: 3 },
    ],
  },
  {
    id: "aqol10",
    domain: "Mental Health",
    text: "Thinking about how you sleep:",
    options: [
      { label: "I am able to sleep without difficulty most of the time.", value: 0 },
      { label: "My sleep is interrupted some of the time, but I am usually able to go back to sleep without difficulty.", value: 1 },
      { label: "My sleep is interrupted most nights, but I am usually able to go back to sleep without difficulty.", value: 2 },
      { label: "I sleep in short bursts only. I am awake most of the night.", value: 3 },
    ],
  },
  {
    id: "aqol11",
    domain: "Mental Health",
    text: "Thinking about how you generally feel:",
    options: [
      { label: "I do not feel anxious, worried or depressed.", value: 0 },
      { label: "I am slightly anxious, worried or depressed.", value: 1 },
      { label: "I feel moderately anxious, worried or depressed.", value: 2 },
      { label: "I am extremely anxious, worried or depressed.", value: 3 },
    ],
  },
  {
    id: "aqol12",
    domain: "Mental Health",
    text: "How much pain or discomfort do you experience:",
    options: [
      { label: "None at all.", value: 0 },
      { label: "I have moderate pain.", value: 1 },
      { label: "I suffer from severe pain.", value: 2 },
      { label: "I suffer unbearable pain.", value: 3 },
    ],
  },
];

const DOMAINS = ["Independent Living", "Relationships", "Senses", "Mental Health"];

const DOMAIN_COLORS = {
  "Independent Living": "bg-blue-100 text-blue-800 border-blue-200",
  "Relationships": "bg-purple-100 text-purple-800 border-purple-200",
  "Senses": "bg-amber-100 text-amber-800 border-amber-200",
  "Mental Health": "bg-green-100 text-green-800 border-green-200",
};

function getInterpretation(score) {
  // Psychometric score: 0 = best, 36 = worst
  if (score <= 4) return { label: "Excellent QoL", color: "text-green-700" };
  if (score <= 10) return { label: "Good QoL", color: "text-blue-700" };
  if (score <= 18) return { label: "Moderate QoL impairment", color: "text-amber-700" };
  if (score <= 26) return { label: "Significant QoL impairment", color: "text-orange-700" };
  return { label: "Severe QoL impairment", color: "text-red-700" };
}

export default function AQoLRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [currentQ, setCurrentQ] = useState(0);

  const totalQuestions = QUESTIONS.length;
  const answeredCount = Object.keys(responses).length;
  const allAnswered = answeredCount === totalQuestions;

  const totalScore = Object.values(responses).reduce((sum, v) => sum + v, 0);

  const domainScores = {};
  DOMAINS.forEach(domain => {
    const domainQs = QUESTIONS.filter(q => q.domain === domain);
    domainScores[domain] = domainQs.reduce((sum, q) => sum + (responses[q.id] ?? 0), 0);
  });

  const handleSelect = (questionId, value) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
    // Auto-advance
    if (currentQ < totalQuestions - 1) {
      setTimeout(() => setCurrentQ(q => q + 1), 300);
    }
  };

  const handleSave = () => {
    const interp = getInterpretation(totalScore);

    // Domain score summary
    const domainSummary = DOMAINS.map(domain => {
      const qs = QUESTIONS.filter(q => q.domain === domain);
      const score = qs.reduce((sum, q) => sum + (responses[q.id] ?? 0), 0);
      return `    - ${domain}: ${score}/9`;
    }).join("\n");

    // Per-question responses for SOAP
    const responseLines = QUESTIONS.map((q, i) => {
      const val = responses[q.id];
      const option = q.options.find(o => o.value === val);
      return `    Q${i + 1} (${q.domain}): ${option?.label ?? "Not answered"}`;
    }).join("\n");

    const soapText = `Assessment of Quality of Life (AQoL-4D)\n\n  Total Psychometric Score: ${totalScore}/36 â€” ${interp.label}\n\n  Domain Scores:\n${domainSummary}\n\n  Individual Responses:\n${responseLines}`;

    onSave({
      result_value: totalScore,
      additional_data: {
        soap_text: soapText,
        total_score: totalScore,
        interpretation: interp.label,
        domain_scores: domainScores,
        responses,
      },
    });
  };

  const q = QUESTIONS[currentQ];
  const progress = (answeredCount / totalQuestions) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Assessment of Quality of Life (AQoL-4D)</h2>
            <p className="text-sm text-slate-500">Tick the box that best describes your situation over the past week</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{answeredCount} of {totalQuestions} answered</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Domain tabs */}
        <div className="flex gap-2 px-6 pt-3 overflow-x-auto pb-1">
          {DOMAINS.map((domain, i) => {
            const domainQs = QUESTIONS.filter(q => q.domain === domain);
            const domainAnswered = domainQs.filter(q => responses[q.id] !== undefined).length;
            const isActive = q.domain === domain;
            return (
              <button
                key={domain}
                onClick={() => setCurrentQ(QUESTIONS.findIndex(q => q.domain === domain))}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium whitespace-nowrap transition-all ${
                  isActive ? DOMAIN_COLORS[domain] : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {domain} ({domainAnswered}/3)
              </button>
            );
          })}
        </div>

        {/* Current question */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border mb-3 ${DOMAIN_COLORS[q.domain]}`}>
            {q.domain}
          </div>
          <p className="text-base font-semibold text-slate-800 mb-5">
            Q{currentQ + 1}. {q.text}
          </p>
          <div className="space-y-3">
            {q.options.map(option => {
              const selected = responses[q.id] === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleSelect(q.id, option.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                    selected
                      ? "border-blue-500 bg-blue-50 text-blue-900 font-medium"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className={`inline-block w-5 h-5 rounded-full border-2 mr-3 align-middle flex-shrink-0 ${
                    selected ? "border-blue-500 bg-blue-500" : "border-slate-300"
                  }`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selected && <span className="block w-2 h-2 rounded-full bg-white" />}
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live score summary (shown when all answered) */}
        {allAnswered && (
          <div className="mx-6 mb-3 bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">Total Score: {totalScore}/36</span>
              <span className={`text-sm font-bold ${getInterpretation(totalScore).color}`}>
                {getInterpretation(totalScore).label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-slate-600">
              {DOMAINS.map(domain => (
                <div key={domain} className="flex justify-between">
                  <span>{domain}:</span>
                  <span className="font-medium">{domainScores[domain]}/9</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50 rounded-b-2xl">
          <Button
            variant="outline"
            onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
            disabled={currentQ === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>

          <span className="text-sm text-slate-500">{currentQ + 1} / {totalQuestions}</span>

          {currentQ < totalQuestions - 1 ? (
            <Button onClick={() => setCurrentQ(q => Math.min(totalQuestions - 1, q + 1))}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={!allAnswered} className="bg-green-600 hover:bg-green-700">
              Save Results
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}