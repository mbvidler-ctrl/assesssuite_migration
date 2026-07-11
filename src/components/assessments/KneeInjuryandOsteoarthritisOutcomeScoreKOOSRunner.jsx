import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Save, X, Info, ChevronDown, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const SECTIONS = {
  symptoms: {
    name: "Symptoms",
    instruction: "What symptoms have you had in your knee the last week?",
    questions: [
      { id: "Sy1", text: "Do you have swelling in your knee?", options: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "Sy2", text: "Do you feel grinding, hear clicking or any other type of noise when your knee moves?", options: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "Sy3", text: "Does your knee catch or hang up when moving?", options: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "Sy4", text: "Can you straighten your knee fully?", options: ["Always", "Often", "Sometimes", "Rarely", "Never"] },
      { id: "Sy5", text: "Can you bend your knee fully?", options: ["Always", "Often", "Sometimes", "Rarely", "Never"] },
      { id: "Sy6", text: "How severe is your knee stiffness after first wakening in the morning?", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "Sy7", text: "How severe is your knee stiffness after sitting, lying or resting later in the day?", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
    ]
  },
  pain: {
    name: "Pain",
    instruction: "What degree of pain have you experienced the last week when performing the following activities?",
    questions: [
      { id: "P1", text: "How often do you experience knee pain?", options: ["Never", "Monthly", "Weekly", "Daily", "Always"] },
      { id: "P2", text: "Twisting/pivoting on your knee", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P3", text: "Straightening knee fully", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P4", text: "Bending knee fully", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P5", text: "Walking on flat surface", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P6", text: "Going up or down stairs", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P7", text: "At night while in bed", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P8", text: "Sitting or lying", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P9", text: "Standing upright", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
    ]
  },
  adl: {
    name: "Daily Living",
    instruction: "What difficulty have you experienced the last week doing the following activities of daily living?",
    questions: [
      { id: "A1", text: "Descending stairs", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A2", text: "Ascending stairs", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A3", text: "Rising from sitting", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A4", text: "Standing", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A5", text: "Bending to floor/picking up an object", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A6", text: "Walking on flat surface", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A7", text: "Getting in/out of car", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A8", text: "Going shopping", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A9", text: "Putting on socks/stockings", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A10", text: "Rising from bed", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A11", text: "Taking off socks/stockings", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A12", text: "Lying in bed (turning over, maintaining knee position)", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A13", text: "Getting in/out of bath", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A14", text: "Sitting", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A15", text: "Getting on/off toilet", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A16", text: "Heavy domestic duties (shovelling, scrubbing floors, etc.)", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A17", text: "Light domestic duties (cooking, dusting, etc.)", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
    ]
  },
  sport: {
    name: "Sport & Recreation",
    instruction: "What difficulty have you experienced the last week during the following activities?",
    questions: [
      { id: "Sp1", text: "Squatting", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "Sp2", text: "Running", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "Sp3", text: "Jumping", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "Sp4", text: "Turning/twisting on your injured knee", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "Sp5", text: "Kneeling", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
    ]
  },
  qol: {
    name: "Quality of Life",
    instruction: "The following questions are related to your quality of life.",
    questions: [
      { id: "Q1", text: "How often are you aware of your knee problem?", options: ["Never", "Monthly", "Weekly", "Daily", "Always"] },
      { id: "Q2", text: "Have you modified your lifestyle to avoid potentially damaging activities to your knee?", options: ["Not at all", "Mildly", "Moderately", "Severely", "Totally"] },
      { id: "Q3", text: "How much are you troubled with lack of confidence in your knee?", options: ["Not at all", "Mildly", "Moderately", "Severely", "Extremely"] },
      { id: "Q4", text: "In general, how much difficulty do you have with your knee?", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
    ]
  },
};

const SECTION_KEYS = Object.keys(SECTIONS);
const TOTAL_QUESTIONS = SECTION_KEYS.reduce((sum, k) => sum + SECTIONS[k].questions.length, 0);

function calcSectionScore(sectionKey, responses) {
  const qs = SECTIONS[sectionKey].questions;
  const answered = qs.map(q => responses[q.id]).filter(v => v !== undefined);
  if (answered.length === 0) return null;
  const sum = answered.reduce((a, b) => a + b, 0);
  return ((1 - sum / (qs.length * 4)) * 100).toFixed(1);
}

function ScoreInterpretation({ score }) {
  const s = parseFloat(score);
  if (isNaN(s)) return null;
  let label, color;
  if (s >= 85) { label = "Normal/Healthy"; color = "bg-green-100 text-green-800"; }
  else if (s >= 60) { label = "Mild limitation"; color = "bg-yellow-100 text-yellow-800"; }
  else if (s >= 40) { label = "Moderate limitation"; color = "bg-orange-100 text-orange-800"; }
  else { label = "Severe limitation"; color = "bg-red-100 text-red-800"; }
  return <Badge className={`text-xs ${color}`}>{label}</Badge>;
}

export default function KneeInjuryandOsteoarthritisOutcomeScoreKOOSRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [activeTab, setActiveTab] = useState("symptoms");
  const [notes, setNotes] = useState("");
  const [showClinician, setShowClinician] = useState(true);
  const [showNormatives, setShowNormatives] = useState(false);
  const [showReferences, setShowReferences] = useState(false);

  const answered = Object.keys(responses).length;
  const allAnswered = answered === TOTAL_QUESTIONS;

  const handleSave = () => {
    if (!allAnswered) {
      toast.error(`Please answer all ${TOTAL_QUESTIONS} questions (${answered}/${TOTAL_QUESTIONS} completed)`);
      return;
    }
    const sectionScores = {};
    SECTION_KEYS.forEach(k => { sectionScores[k] = parseFloat(calcSectionScore(k, responses)); });
    const avg = (Object.values(sectionScores).reduce((a, b) => a + b, 0) / SECTION_KEYS.length).toFixed(1);
    
    // Build detailed response section
    let detailedResponses = "";
    SECTION_KEYS.forEach(k => {
      const section = SECTIONS[k];
      detailedResponses += `\n  ${section.name}:\n`;
      section.questions.forEach(q => {
        const answer = responses[q.id];
        const selectedOption = answer !== undefined ? q.options[answer] : "Not answered";
        detailedResponses += `    ${q.id}. ${q.text}\n      Response: ${selectedOption}\n`;
      });
    });
    
    const scoreLines = SECTION_KEYS.map(k => `    ${SECTIONS[k].name}: ${sectionScores[k]}/100`).join("\n");
    const soapText = `• KOOS (Knee Injury and Osteoarthritis Outcome Score)\n  Average Score: ${avg}/100\n\n  Subscale Scores:\n${scoreLines}\n  MCID: 8–10 points per subscale\n\n  Detailed Responses:${detailedResponses}\n\n  Reference: Roos EM & Lohmander LS (2003). Health Qual Life Outcomes.`;

    onSave({
      status: "completed",
      result_value: parseFloat(avg),
      additional_data: { soap_text: soapText, measurement_type: "questionnaire", section_scores: sectionScores, responses },
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("KOOS results saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-cyan-50 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">KOOS</h2>
            <p className="text-slate-600 mt-0.5">Knee Injury and Osteoarthritis Outcome Score</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Client info */}
          {client && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-700">
              <span className="font-medium">Client:</span> {client.full_name}
              {client.date_of_birth && (
                <span className="ml-3 text-slate-500">DOB: {new Date(client.date_of_birth).toLocaleDateString("en-AU")}</span>
              )}
            </div>
          )}

          {/* Patient instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" /> Instructions for Patient</p>
            <p>This questionnaire asks about your views about your knee. Answer every question based on your experience <strong>during the last week</strong>. There are no right or wrong answers.</p>
          </div>

          {/* Clinician Instructions */}
          <Collapsible open={showClinician} onOpenChange={setShowClinician}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg font-semibold text-amber-900 text-sm hover:bg-amber-100 transition-colors">
              <ChevronDown className={`w-4 h-4 transition-transform ${showClinician ? "rotate-180" : ""}`} />
              📋 Clinician Instructions & Clinical Context
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-5 space-y-4 text-sm text-amber-800">
              <div>
                <p className="font-semibold text-amber-900 mb-1">Purpose</p>
                <p>KOOS is a validated patient-reported outcome measure (PROM) for knee injury and osteoarthritis, covering 5 subscales: Symptoms, Pain, ADL, Sport/Recreation, and Quality of Life. Used for post-injury rehab, post-surgical monitoring, OA progression, and return-to-sport decisions.</p>
              </div>
              <div>
                <p className="font-semibold text-amber-900 mb-1">Administration</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><strong>Timeframe:</strong> Refers to the <strong>past 7 days</strong> only.</li>
                  <li><strong>Scoring:</strong> Each item 0–4. Subscale score = (1 − sum/max) × 100. Higher = better function.</li>
                  <li><strong>Missing data:</strong> If ≤2 items missing per subscale, impute using subscale mean. If &gt;2 missing, subscale is invalid.</li>
                  <li><strong>Completion time:</strong> 5–8 minutes.</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-amber-900 mb-1">Scope of Practice</p>
                <p className="text-xs">KOOS scores inform but do <em>not</em> solely determine return-to-sport clearance or diagnosis. Always interpret in context of physical examination, strength testing, and imaging where indicated. Return-to-sport decisions require objective testing (strength symmetry index &gt;90%, hop tests) alongside KOOS.</p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Normative Data */}
          <Collapsible open={showNormatives} onOpenChange={setShowNormatives}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 text-sm hover:bg-slate-100 transition-colors">
              <ChevronDown className={`w-4 h-4 transition-transform ${showNormatives ? "rotate-180" : ""}`} />
              📊 Normative Data & Interpretation
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs space-y-3">
                <p className="font-semibold text-slate-800">Population Benchmarks (score out of 100)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-200">
                      <tr>
                        <th className="p-1.5 text-left">Population</th>
                        <th className="p-1.5 text-center">Pain</th>
                        <th className="p-1.5 text-center">ADL</th>
                        <th className="p-1.5 text-center">Sport</th>
                        <th className="p-1.5 text-center">QoL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {[
                        ["Healthy controls", "90–96", "93–97", "85–92", "88–94"],
                        ["Mild knee OA", "60–75", "65–80", "35–55", "45–65"],
                        ["Moderate–severe OA", "35–55", "40–65", "15–35", "25–45"],
                        ["Post-ACL (<6 wks)", "30–55", "25–45", "5–20", "20–40"],
                        ["Post-ACL (12 months)", "70–88", "75–90", "55–75", "55–75"],
                      ].map(([pop, pain, adl, sport, qol]) => (
                        <tr key={pop} className="hover:bg-slate-100">
                          <td className="p-1.5 font-medium">{pop}</td>
                          <td className="p-1.5 text-center">{pain}</td>
                          <td className="p-1.5 text-center">{adl}</td>
                          <td className="p-1.5 text-center">{sport}</td>
                          <td className="p-1.5 text-center">{qol}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bg-green-50 border border-green-200 rounded p-3 space-y-1">
                  <p className="font-semibold text-green-800">MCID (Minimum Clinically Important Difference)</p>
                  <p className="text-green-700">≈ <strong>8–10 points</strong> per subscale = meaningful change from patient perspective (Roos et al., 2003).</p>
                  <p className="text-green-700">Return-to-sport threshold: Sport subscale <strong>&gt;56</strong> (expert consensus; some guidelines recommend &gt;90% limb symmetry alongside KOOS).</p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Progress */}
          <div className="text-center text-sm text-slate-600">
            {answered} / {TOTAL_QUESTIONS} questions answered
            {allAnswered && <span className="ml-2 text-green-600 font-semibold">✓ All complete</span>}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              {SECTION_KEYS.map(k => {
                const qs = SECTIONS[k].questions;
                const ans = qs.filter(q => responses[q.id] !== undefined).length;
                const done = ans === qs.length;
                return (
                  <TabsTrigger key={k} value={k} className="text-xs relative">
                    {SECTIONS[k].name}
                    {done && <span className="ml-1 text-green-500">✓</span>}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {SECTION_KEYS.map(key => {
              const section = SECTIONS[key];
              const score = calcSectionScore(key, responses);
              return (
                <TabsContent key={key} value={key} className="mt-4 space-y-3">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{section.name}</h3>
                    <p className="text-sm text-slate-500 italic">{section.instruction}</p>
                  </div>

                  {section.questions.map(question => (
                    <Card key={question.id} className={responses[question.id] !== undefined ? "border-green-200 bg-green-50/20" : ""}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <p className="text-sm font-medium text-slate-800 flex-1">{question.text}</p>
                          <div className="flex gap-1.5 flex-shrink-0">
                            {question.options.map((option, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setResponses(prev => ({ ...prev, [question.id]: idx }))}
                                className={`w-10 h-10 rounded-lg text-xs font-bold border-2 transition-all flex flex-col items-center justify-center leading-tight
                                  ${responses[question.id] === idx
                                    ? "bg-blue-600 border-blue-600 text-white shadow"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                                  }`}
                                title={option}
                              >
                                <span>{idx}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        {responses[question.id] !== undefined && (
                          <p className="text-xs text-blue-600 mt-1 text-right font-medium">{question.options[responses[question.id]]}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {score !== null && (
                    <div className="bg-slate-100 p-4 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600">Section Score</p>
                        <p className="text-2xl font-bold text-blue-600">{score} <span className="text-sm font-normal text-slate-500">/ 100</span></p>
                        <p className="text-xs text-slate-500">Higher = Better function</p>
                      </div>
                      <ScoreInterpretation score={score} />
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>

          {/* Overall summary */}
          {allAnswered && (
            <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 border-2">
              <CardContent className="py-5">
                <h3 className="font-bold text-slate-900 mb-4 text-center text-lg">KOOS Subscale Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  {SECTION_KEYS.map(k => {
                    const score = calcSectionScore(k, responses);
                    return (
                      <div key={k} className="bg-white rounded-lg p-3 text-center">
                        <p className="text-xs text-slate-500 mb-1">{SECTIONS[k].name}</p>
                        <p className="text-2xl font-bold text-blue-600">{score}</p>
                        <ScoreInterpretation score={score} />
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-center text-slate-500 mt-3">0 = extreme problems · 100 = no problems · MCID ≈ 8–10 pts</p>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">Clinician Notes</p>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional clinical observations..." rows={3} />
          </div>

          {/* References */}
          <Collapsible open={showReferences} onOpenChange={setShowReferences}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 text-sm hover:bg-slate-100 transition-colors">
              <ChevronDown className={`w-4 h-4 transition-transform ${showReferences ? "rotate-180" : ""}`} />
              📚 References
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs text-slate-600">
              <p>1. Roos EM, Klassbo M, Lohmander LS. (1998). KOOS — Knee Injury and Osteoarthritis Outcome Score. Reliability and validity of a knee joint questionnaire. <em>Scandinavian Journal of Medicine & Science in Sports, 8</em>(6), 439–448.</p>
              <p>2. Roos EM, Lohmander LS. (2003). The Knee injury and Osteoarthritis Outcome Score (KOOS): from joint injury to osteoarthritis. <em>Health and Quality of Life Outcomes, 1</em>, 64.</p>
              <p>3. Roos EM, Toksvig-Larsen S. (2003). Knee injury and Osteoarthritis Outcome Score (KOOS) — validation and comparison to the WOMAC in total knee replacement. <em>Health and Quality of Life Outcomes, 1</em>, 17.</p>
              <p>4. Collins NJ, Misra D, Felson DT, et al. (2011). Measures of knee function: KOOS, KOOS-PS, KOOS-QCL. <em>Arthritis Care & Research, 63</em>(S11), S208–S228.</p>
              <p>5. Frobell RB, Roos EM, Roos HP, et al. (2010). A randomized trial of treatment for acute anterior cruciate ligament tears. <em>New England Journal of Medicine, 363</em>, 331–342.</p>
              <p>6. van Meer BL, Meuffels DE, Vissers MM, et al. (2013). Knee injury and Osteoarthritis Outcome Score or International Knee Documentation Committee Subjective Knee Form: which questionnaire is most useful to monitor patients with an intraarticular knee disorder in the short-term? <em>Arthroscopy, 29</em>(4), 701–715.</p>
              <div className="mt-2">
                <Button variant="outline" size="sm" className="text-xs h-8 w-full justify-start" onClick={() => window.open("https://www.koos.nu", "_blank")}>
                  <ExternalLink className="w-3 h-3 mr-2" /> Official KOOS Website — koos.nu (scoring, translations, normatives)
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <p className="text-sm text-slate-600">{answered} / {TOTAL_QUESTIONS} completed</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" /> Cancel</Button>
            <Button onClick={handleSave} disabled={!allAnswered} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" /> Save KOOS Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}