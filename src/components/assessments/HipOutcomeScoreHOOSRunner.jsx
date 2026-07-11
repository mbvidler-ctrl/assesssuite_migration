import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, Info, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const HOOS_SUBSCALES = [
  { name: "Symptoms", label: "Symptoms", items: ["S1", "S2", "S3", "S4", "S5"] },
  { name: "Pain", label: "Pain", items: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"] },
  { name: "ActivitiesOfDailyLiving", label: "Activities of Daily Living", items: ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12", "A13", "A14", "A15", "A16", "A17"] },
  { name: "SportAndRecreation", label: "Sport & Recreation", items: ["SP1", "SP2", "SP3", "SP4"] },
  { name: "QualityOfLife", label: "Quality of Life", items: ["Q1", "Q2", "Q3", "Q4"] },
];

const questions = {
  S1: "Do you feel grinding, hear clicking or any other type of noise when your hip moves?",
  S2: "Difficulties spreading legs wide apart",
  S3: "Difficulties striding out when walking",
  S4: "In the morning: How severe is your hip stiffness?",
  S5: "After sitting, lying: How severe is your hip stiffness?",
  P1: "How often do you experience hip pain?",
  P2: "Straightening hip fully",
  P3: "Bending hip fully",
  P4: "Walking on flat surface",
  P5: "Going up or down stairs",
  P6: "At night while in bed",
  P7: "Sitting or lying",
  P8: "Standing upright",
  P9: "Walking on hard surface",
  P10: "Getting in/out of car or getting in/out of bath",
  A1: "Descending stairs", A2: "Ascending stairs", A3: "Rising from sitting",
  A4: "Standing", A5: "Bending to floor/pick up an object", A6: "Walking on flat surface",
  A7: "Getting in/out of car", A8: "Going shopping", A9: "Putting on socks/stockings",
  A10: "Rising from bed", A11: "Taking off socks/stockings", A12: "Lying in bed",
  A13: "Getting in/out of bath", A14: "Sitting", A15: "Getting on/off toilet",
  A16: "Heavy domestic duties", A17: "Light domestic duties",
  SP1: "Squatting", SP2: "Running", SP3: "Twisting/pivoting on your injured hip", SP4: "Walking on uneven surface",
  Q1: "How often are you aware of your hip problem?",
  Q2: "Have you modified your life style to avoid activities potentially damaging to your hip?",
  Q3: "How much are you troubled with lack of confidence in your hip?",
  Q4: "In general, how much difficulty do you have with your hip?"
};

const scoreLabels = ["None", "Mild", "Moderate", "Severe", "Extreme"];

export default function HipOutcomeScoreHOOSRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");
  const [showInfo, setShowInfo] = useState(false);

  const totalAnswered = Object.keys(responses).length;
  const totalQuestions = Object.keys(questions).length;

  const handleResponseChange = (questionId, value) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSave = () => {
    if (totalAnswered === 0) {
      toast.error("Please answer at least one question before saving.");
      return;
    }

    const subscaleScores = HOOS_SUBSCALES.map((subscale) => {
      const rawScore = subscale.items.reduce((sum, id) => sum + (responses[id] || 0), 0);
      const maxScore = subscale.items.length * 4;
      const normalizedScore = 100 - ((rawScore / maxScore) * 100);
      return { name: subscale.name, label: subscale.label, score: normalizedScore.toFixed(1) };
    });

    const totalScore = (subscaleScores.reduce((sum, s) => sum + parseFloat(s.score), 0) / subscaleScores.length).toFixed(1);

    let soapText = `• Hip Outcome Score (HOOS)\n  Total Average Score: ${totalScore}/100 (higher = better function)\n\n  Subscale Scores:\n`;
    subscaleScores.forEach(s => { soapText += `    ${s.label}: ${s.score}/100\n`; });
    soapText += `\n  Individual Responses:\n`;
    HOOS_SUBSCALES.forEach(subscale => {
      soapText += `\n  ${subscale.label}:\n`;
      subscale.items.forEach(id => {
        if (responses[id] !== undefined) {
          soapText += `    ${questions[id]}: ${scoreLabels[responses[id]]}\n`;
        }
      });
    });
    if (notes?.trim()) soapText += `\n  Clinical Notes: ${notes}\n`;

    onSave({
      status: "completed",
      result_value: parseFloat(totalScore),
      additional_data: { soap_text: soapText, measurement_type: "questionnaire", subscaleScores, responses },
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("HOOS saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Hip Outcome Score (HOOS)</h2>
            <p className="text-slate-500 text-sm mt-0.5">Patient-reported hip function — 40 items across 5 subscales</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Clinician Info Panel */}
          <div className="border border-blue-200 rounded-lg overflow-hidden">
            <button
              className="w-full flex justify-between items-center px-4 py-3 bg-blue-50 text-blue-800 font-semibold text-sm hover:bg-blue-100 transition-colors"
              onClick={() => setShowInfo(v => !v)}
            >
              <span className="flex items-center gap-2"><Info className="w-4 h-4" />Clinician Info & References</span>
              {showInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showInfo && (
              <div className="p-4 text-sm text-slate-700 space-y-3">
                <div>
                  <p className="font-semibold mb-1">About the HOOS</p>
                  <p className="text-slate-600">The Hip disability and Osteoarthritis Outcome Score (HOOS) is a patient-administered questionnaire assessing the patient's opinion about their hip and associated problems. It was developed as an extension of the WOMAC Osteoarthritis Index.</p>
                </div>
                <div>
                  <p className="font-semibold mb-1">Administration</p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                    <li>Self-administered by the patient (approximately 10–15 minutes)</li>
                    <li>Covers symptoms over the <strong>past week</strong></li>
                    <li>40 items across 5 subscales: Symptoms, Pain, ADL, Sport/Recreation, QoL</li>
                    <li>Each item rated 0 (None) to 4 (Extreme)</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold mb-1">Scoring</p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                    <li>Each subscale scored 0–100; <strong>higher score = better function / fewer symptoms</strong></li>
                    <li>Formula: Score = 100 − [(raw sum / max possible) × 100]</li>
                    <li>No composite total is recommended; subscales reported individually</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold mb-1">Psychometric Properties</p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                    <li>Excellent test-retest reliability (ICC 0.75–0.98 across subscales)</li>
                    <li>Good content validity and responsiveness to change post-THA and after rehabilitation</li>
                    <li>MCID: approximately 8–10 points per subscale</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold mb-1">Indicated For</p>
                  <p className="text-slate-600">Hip osteoarthritis, total hip arthroplasty (pre/post), hip labral pathology, hip fracture rehabilitation, FAI (femoroacetabular impingement).</p>
                </div>
                <div className="space-y-1">
                   <p className="font-semibold mb-1">References & Links</p>
                   <a href="https://www.koos.nu/" target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                     <ExternalLink className="w-3 h-3" /> HOOS Official Website — koos.nu (free questionnaire PDF)
                   </a>
                 </div>
              </div>
            )}
          </div>

          {/* Scoring key */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
            <p className="font-semibold text-slate-700 mb-1">Scoring Key</p>
            <div className="flex gap-4 flex-wrap text-xs text-slate-600">
              {scoreLabels.map((label, i) => (
                <span key={i}><strong>{i}</strong> = {label}</span>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1.5">Rate symptoms over the <strong>past week</strong>. Higher subscale score = better outcome.</p>
          </div>

          {/* Progress */}
          <div className="text-xs text-slate-500 text-right">{totalAnswered} / {totalQuestions} questions answered</div>

          {/* Questions by subscale */}
          {HOOS_SUBSCALES.map((subscale) => (
            <div key={subscale.name} className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-100 px-4 py-2.5">
                <h3 className="font-semibold text-sm text-slate-800">{subscale.label}</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {subscale.items.map((id) => (
                  <div key={id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <Label className="flex-1 text-sm text-slate-700 leading-snug">{questions[id]}</Label>
                    <div className="flex gap-1 shrink-0">
                      {[0, 1, 2, 3, 4].map((value) => (
                        <Button
                          key={value}
                          variant={responses[id] === value ? "default" : "outline"}
                          onClick={() => handleResponseChange(id, value)}
                          className="w-9 h-9 text-xs p-0"
                        >
                          {value}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Notes */}
          <div>
            <Label>Clinical Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Relevant clinical context, barriers, functional goals..." rows={3} className="mt-1" />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-slate-50 flex justify-between shrink-0">
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Cancel</Button>
          <Button onClick={handleSave} disabled={totalAnswered === 0} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />Save HOOS
          </Button>
        </div>
      </div>
    </div>
  );
}