import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { PROM_NEURO_AQOL_QUESTIONS as QUESTIONS, PROM_NEURO_AQOL_DOMAINS as DOMAINS, PROM_NEURO_AQOL_DOMAIN_COLORS as DOMAIN_COLORS } from '@/lib/clinical/scorers/extrasPromNeuro';




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

    const soapText = `Assessment of Quality of Life (AQoL-4D)\n\n  Total Psychometric Score: ${totalScore}/36 — ${interp.label}\n\n  Domain Scores:\n${domainSummary}\n\n  Individual Responses:\n${responseLines}`;

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
