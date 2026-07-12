import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Save, X, Info, ChevronDown, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// Official LCQ — 19 items, 7-point Likert (1=Always/Severely, 7=Never/Not at all)
// Higher score = better cough-related QoL
const LCQ_DOMAINS = [
  {
    key: "physical",
    label: "Physical Domain",
    color: "red",
    items: [
      { id: "P1", text: "I have been coughing a lot." },
      { id: "P2", text: "I have been bothered by coughing when I exercise." },
      { id: "P3", text: "I have had chest or stomach pains due to coughing." },
      { id: "P4", text: "I have been tired because of my cough." },
      { id: "P5", text: "My cough has made me hoarse." },
      { id: "P6", text: "My cough has made me feel short of breath." },
      { id: "P7", text: "I have been incontinent due to coughing." },
    ],
  },
  {
    key: "psychological",
    label: "Psychological Domain",
    color: "purple",
    items: [
      { id: "Ps1", text: "I have been embarrassed by my coughing." },
      { id: "Ps2", text: "My cough has made me feel anxious." },
      { id: "Ps3", text: "My cough has made me feel frustrated." },
      { id: "Ps4", text: "I have felt fed up with my cough." },
      { id: "Ps5", text: "I have been bothered by coughing when talking to people." },
      { id: "Ps6", text: "I have felt in control of my cough." },
    ],
  },
  {
    key: "social",
    label: "Social Domain",
    color: "blue",
    items: [
      { id: "S1", text: "My cough has interfered with my job or other daily tasks." },
      { id: "S2", text: "My cough has disturbed my sleep." },
      { id: "S3", text: "My cough has caused problems with family, friends or other people." },
      { id: "S4", text: "My cough has affected my social life." },
      { id: "S5", text: "My cough has affected my enjoyment of social activities." },
      { id: "S6", text: "My cough has made me feel I am a burden to others." },
    ],
  },
];

const ALL_ITEMS = LCQ_DOMAINS.flatMap(d => d.items);
const TOTAL_ITEMS = ALL_ITEMS.length; // 19

const SCALE = [
  { value: 7, label: "Always" },
  { value: 6, label: "Most of the time" },
  { value: 5, label: "A good bit of the time" },
  { value: 4, label: "Some of the time" },
  { value: 3, label: "A little of the time" },
  { value: 2, label: "Hardly any of the time" },
  { value: 1, label: "None of the time" },
];

// Domain score = mean of items (range 1–7). Total = mean of all 19 items (1–7). Higher = better.
function calcDomainScore(domainItems, responses) {
  const vals = domainItems.map(i => responses[i.id]).filter(v => v !== undefined);
  if (vals.length === 0) return null;
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
}

function calcTotalScore(responses) {
  const vals = ALL_ITEMS.map(i => responses[i.id]).filter(v => v !== undefined);
  if (vals.length === 0) return null;
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
}

function ScoreInterpretation({ score }) {
  const s = parseFloat(score);
  if (isNaN(s)) return null;
  let label, color;
  if (s >= 5.5) { label = "Minimal impact"; color = "bg-green-100 text-green-800"; }
  else if (s >= 4.0) { label = "Moderate impact"; color = "bg-yellow-100 text-yellow-800"; }
  else { label = "Severe impact — consider referral"; color = "bg-red-100 text-red-800"; }
  return <Badge className={`text-xs ${color}`}>{label}</Badge>;
}

const domainColorMap = {
  red: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", badge: "bg-red-100 text-red-700" },
  purple: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-800", badge: "bg-purple-100 text-purple-700" },
  blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", badge: "bg-blue-100 text-blue-700" },
};

export default function LeicesterCoughQuestionnaireLCQRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");
  const [showClinician, setShowClinician] = useState(true);
  const [showNormatives, setShowNormatives] = useState(false);
  const [showReferences, setShowReferences] = useState(false);

  const answered = Object.keys(responses).length;
  const allAnswered = answered === TOTAL_ITEMS;

  const handleSave = () => {
    if (!allAnswered) {
      toast.error(`Please answer all ${TOTAL_ITEMS} questions (${answered}/${TOTAL_ITEMS} completed)`);
      return;
    }

    const totalScore = parseFloat(calcTotalScore(responses));
    const physicalScore = parseFloat(calcDomainScore(LCQ_DOMAINS[0].items, responses));
    const psychScore = parseFloat(calcDomainScore(LCQ_DOMAINS[1].items, responses));
    const socialScore = parseFloat(calcDomainScore(LCQ_DOMAINS[2].items, responses));

    const interpretation = totalScore >= 5.5 ? "Minimal cough impact" : totalScore >= 4.0 ? "Moderate cough impact" : "Severe cough impact — consider specialist referral";

    // Build detailed response section
    let detailedResponses = "";
    LCQ_DOMAINS.forEach(domain => {
      detailedResponses += `\n  ${domain.label}:\n`;
      domain.items.forEach(item => {
        const answer = responses[item.id];
        const selectedOption = answer !== undefined ? SCALE.find(s => s.value === answer)?.label : "Not answered";
        detailedResponses += `    ${item.id}. ${item.text}\n      Response: ${selectedOption} (${answer}/7)\n`;
      });
    });

    const soapText = `• Leicester Cough Questionnaire (LCQ)
  Total Score: ${totalScore}/7 — ${interpretation}
  Physical Domain: ${physicalScore}/7
  Psychological Domain: ${psychScore}/7
  Social Domain: ${socialScore}/7
  MCID: 1.3 points

  Detailed Responses:${detailedResponses}

  Reference: Birring SS et al. (2003). Thorax, 58(4), 339–343.`;

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        soap_text: soapText,
        measurement_type: "lcq",
        total_score: totalScore,
        physical_score: physicalScore,
        psychological_score: psychScore,
        social_score: socialScore,
        interpretation,
        responses,
      },
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("LCQ results saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-teal-50 to-cyan-50 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Leicester Cough Questionnaire (LCQ)</h2>
            <p className="text-slate-600 mt-0.5">Cough-Related Quality of Life — 19 items across 3 domains</p>
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
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-sm text-teal-900 space-y-1">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" /> Instructions for Patient</p>
            <p>The following questions ask about how your cough has affected you <strong>over the last 2 weeks</strong>. Please rate each item on a scale from <strong>1 (Always)</strong> to <strong>7 (None of the time / Not at all)</strong>. There are no right or wrong answers.</p>
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
                <p>The LCQ is a validated, cough-specific PROM assessing the impact of chronic cough on quality of life across 3 domains: Physical (7 items), Psychological (6 items), and Social (6 items). Used for chronic cough, COPD, bronchiectasis, post-viral cough, IPF, and pulmonary rehabilitation monitoring.</p>
              </div>
              <div>
                <p className="font-semibold text-amber-900 mb-1">Administration & Scoring</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><strong>Timeframe:</strong> Last 2 weeks.</li>
                  <li><strong>Scale:</strong> 1 (Always/Severely affected) to 7 (None of the time / Not at all). <strong>Higher = better QoL.</strong></li>
                  <li><strong>Domain scores:</strong> Mean of items in that domain (1–7 scale).</li>
                  <li><strong>Total score:</strong> Mean of all 19 items (1–7 scale).</li>
                  <li><strong>Missing data:</strong> If ≤2 items missing, impute with domain mean. If &gt;2 missing, domain/total is invalid.</li>
                  <li><strong>Completion time:</strong> 3–5 minutes.</li>
                  <li><strong>MCID:</strong> 1.3 points — a change of ≥1.3 on the total score is clinically meaningful.</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-amber-900 mb-1">Action on Low Scores</p>
                <p className="text-xs">Total score &lt;4.0 warrants clinical review and potential specialist referral (ENT for laryngeal/upper airway, respiratory for lower airway, gastroenterology for GERD-related cough). Scores below MCID from baseline indicate treatment non-response.</p>
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
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
                <p className="font-semibold text-slate-800">Population Reference Scores (Total LCQ, scale 1–7)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-200">
                      <tr>
                        <th className="p-1.5 text-left">Population</th>
                        <th className="p-1.5 text-center">Mean Total Score</th>
                        <th className="p-1.5 text-center">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {[
                        ["Healthy controls (no chronic cough)", "~6.5–7.0", "Near-ceiling as expected"],
                        ["Chronic cough (idiopathic)", "~3.5–4.5", "Birring et al., 2003"],
                        ["COPD (stable)", "~4.5–5.5", "Moderate impact"],
                        ["Bronchiectasis", "~3.5–4.5", "Often lower due to daily cough burden"],
                        ["Post-pulmonary rehab improvement", "+1.3–2.0", "MCID = 1.3 pts"],
                      ].map(([pop, score, note]) => (
                        <tr key={pop} className="hover:bg-slate-100">
                          <td className="p-1.5 font-medium">{pop}</td>
                          <td className="p-1.5 text-center">{score}</td>
                          <td className="p-1.5 text-center text-slate-500">{note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bg-green-50 border border-green-200 rounded p-3 space-y-1">
                  <p className="font-semibold text-green-800">Clinical Thresholds</p>
                  <ul className="list-disc list-inside space-y-0.5 text-green-700">
                    <li><strong>≥5.5:</strong> Minimal cough impact — continue current management</li>
                    <li><strong>4.0–5.4:</strong> Moderate impact — optimise treatment</li>
                    <li><strong>&lt;4.0:</strong> Severe impact — consider specialist referral, investigate etiology</li>
                    <li><strong>MCID = 1.3 points</strong> — minimum meaningful change (Birring et al., 2006)</li>
                  </ul>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Progress */}
          <div className="text-center text-sm text-slate-600">
            {answered} / {TOTAL_ITEMS} questions answered
            {allAnswered && <span className="ml-2 text-green-600 font-semibold">✓ All complete</span>}
          </div>

          {/* Questions by Domain */}
          {LCQ_DOMAINS.map(domain => {
            const c = domainColorMap[domain.color];
            const dScore = calcDomainScore(domain.items, responses);
            const dAnswered = domain.items.filter(i => responses[i.id] !== undefined).length;
            return (
              <div key={domain.key} className="space-y-3">
                <div className={`flex items-center justify-between px-4 py-2 rounded-lg ${c.bg} ${c.border} border`}>
                  <h3 className={`font-bold text-base ${c.text}`}>{domain.label}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{dAnswered}/{domain.items.length}</span>
                    {dScore !== null && (
                      <Badge className={`text-xs ${c.badge}`}>{dScore} / 7</Badge>
                    )}
                  </div>
                </div>

                {domain.items.map(item => (
                  <Card key={item.id} className={responses[item.id] !== undefined ? "border-green-200 bg-green-50/20" : ""}>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-sm font-medium text-slate-800 mb-3">{item.text}</p>
                      <div className="grid grid-cols-7 gap-1">
                        {SCALE.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setResponses(prev => ({ ...prev, [item.id]: opt.value }))}
                            title={opt.label}
                            className={`rounded-lg border-2 py-1.5 text-xs font-bold transition-all flex flex-col items-center gap-0.5
                              ${responses[item.id] === opt.value
                                ? "bg-teal-600 border-teal-600 text-white shadow"
                                : "bg-white border-slate-200 text-slate-600 hover:border-teal-300 hover:bg-teal-50"
                              }`}
                          >
                            <span className="font-bold text-sm">{opt.value}</span>
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-0.5">
                        <span>1 = Always / Severely</span>
                        <span>7 = Never / Not at all</span>
                      </div>
                      {responses[item.id] !== undefined && (
                        <p className="text-xs text-teal-600 mt-1 font-medium text-right">
                          {SCALE.find(s => s.value === responses[item.id])?.label}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })}

          {/* Summary */}
          {allAnswered && (
            <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200 border-2">
              <CardContent className="py-5">
                <h3 className="font-bold text-slate-900 mb-4 text-center text-lg">LCQ Score Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Total", score: calcTotalScore(responses), color: "text-teal-600" },
                    { label: "Physical", score: calcDomainScore(LCQ_DOMAINS[0].items, responses), color: "text-red-600" },
                    { label: "Psychological", score: calcDomainScore(LCQ_DOMAINS[1].items, responses), color: "text-purple-600" },
                    { label: "Social", score: calcDomainScore(LCQ_DOMAINS[2].items, responses), color: "text-blue-600" },
                  ].map(({ label, score, color }) => (
                    <div key={label} className="bg-white rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500 mb-1">{label}</p>
                      <p className={`text-2xl font-bold ${color}`}>{score}</p>
                      <p className="text-xs text-slate-400">/ 7</p>
                      {label === "Total" && <ScoreInterpretation score={score} />}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-center text-slate-500 mt-3">1 = Worst · 7 = Best · MCID = 1.3 points</p>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">Clinician Notes</p>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Cough characteristics, duration, triggers, etiology, current treatments..." rows={3} />
          </div>

          {/* References */}
          <Collapsible open={showReferences} onOpenChange={setShowReferences}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 text-sm hover:bg-slate-100 transition-colors">
              <ChevronDown className={`w-4 h-4 transition-transform ${showReferences ? "rotate-180" : ""}`} />
              📚 References
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs text-slate-600">
              <p>1. Birring SS, Prudon B, Carr AJ, Singh SJ, Morgan MD, Pavord ID. (2003). Development of a symptom specific health status measure for patients with chronic cough: The Leicester Cough Questionnaire (LCQ). <em>Thorax, 58</em>(4), 339–343. doi:10.1136/thorax.58.4.339</p>
              <p>2. Birring SS, Wijsenbeek MS, Agrawal S, et al. (2017). A novel formulation of inhaled sodium cromoglicate (PA101) in idiopathic pulmonary fibrosis and chronic cough: a randomised, double-blind, proof-of-concept, phase 2 trial. <em>The Lancet Respiratory Medicine, 5</em>(10), 806–815.</p>
              <p>3. Kelsall A, Decalmer S, McGuiness K, Woodcock A, Smith JA. (2008). Sex differences and predictors of objective cough frequency in chronic cough. <em>Thorax, 64</em>(5), 393–398.</p>
              <p>4. Raj AA, Pavord ID, Birring SS. (2009). Clinical utility of cough-specific quality of life measures. <em>Current Opinion in Allergy & Clinical Immunology, 9</em>(1), 28–33.</p>
              <p>5. Thoracic Society of Australia and New Zealand (TSANZ). Chronic Cough Guidelines — Recommends LCQ for baseline assessment and monitoring treatment response.</p>
              <p>6. European Respiratory Society (ERS). (2020). ERS guidelines on the assessment of cough. <em>European Respiratory Journal, 55</em>(1), 1901136.</p>
              <div className="mt-2">
                <Button variant="outline" size="sm" className="text-xs h-8 w-full justify-start" onClick={() => window.open("https://doi.org/10.1136/thorax.58.4.339", "_blank")}>
                  <ExternalLink className="w-3 h-3 mr-2" /> Original LCQ Paper — Thorax (2003)
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <p className="text-sm text-slate-600">{answered} / {TOTAL_ITEMS} completed</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" /> Cancel</Button>
            <Button onClick={handleSave} disabled={!allAnswered} className="bg-teal-600 hover:bg-teal-700">
              <Save className="w-4 h-4 mr-2" /> Save LCQ Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}