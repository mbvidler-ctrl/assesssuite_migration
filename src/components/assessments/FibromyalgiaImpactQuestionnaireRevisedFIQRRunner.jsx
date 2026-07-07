import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

const FUNCTION_ITEMS = [
  "Brush or comb your hair",
  "Walk continuously for 20 minutes",
  "Prepare a homemade meal",
  "Vacuum, scrub or sweep floors",
  "Lift and carry a bag full of groceries",
  "Climb one flight of stairs",
  "Change bed sheets",
  "Sit in a chair for 45 minutes",
  "Go shopping for groceries",
];

const OVERALL_ITEMS = [
  "Fibromyalgia prevented me from accomplishing goals for the week",
  "I was completely overwhelmed by my fibromyalgia symptoms",
];

const SYMPTOM_ITEMS = [
  "Pain",
  "Energy",
  "Stiffness",
  "Sleep quality",
  "Depression",
  "Anxiety",
  "Memory problems",
  "Tenderness",
  "Balance problems",
  "Environmental sensitivity (light, noise, cold, heat)",
];

function RatingRow({ label, value, onChange, minLabel, maxLabel }) {
  return (
    <div className="space-y-1 py-2 border-b border-slate-100 last:border-0">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-slate-400 w-16">{minLabel || "No difficulty"}</span>
        {[0,1,2,3,4,5,6,7,8,9,10].map(v => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`w-8 h-8 rounded text-xs font-semibold border transition-colors ${value === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-blue-50'}`}
          >
            {v}
          </button>
        ))}
        <span className="text-xs text-slate-400 w-16 text-right">{maxLabel || "Extreme difficulty"}</span>
      </div>
    </div>
  );
}

export default function FibromyalgiaImpactQuestionnaireRevisedFIQRRunner({ client, onSave, onClose }) {
  const [functionScores, setFunctionScores] = useState(Array(9).fill(null));
  const [overallScores, setOverallScores] = useState(Array(2).fill(null));
  const [symptomScores, setSymptomScores] = useState(Array(10).fill(null));
  const [notes, setNotes] = useState("");

  const update = (setter, index, value) => {
    setter(prev => { const next = [...prev]; next[index] = value; return next; });
  };

  const handleSave = () => {
    if (functionScores.includes(null) || overallScores.includes(null) || symptomScores.includes(null)) {
      toast.error("Please answer all questions before saving.");
      return;
    }

    // FIQR scoring:
    // Function: sum / 3 (max 30)
    // Overall Impact: sum (max 20)
    // Symptoms: sum / 2 (max 50)
    // Total: max 100
    const functionDomainScore = functionScores.reduce((s, v) => s + v, 0) / 3;
    const overallDomainScore = overallScores.reduce((s, v) => s + v, 0);
    const symptomDomainScore = symptomScores.reduce((s, v) => s + v, 0) / 2;
    const totalScore = functionDomainScore + overallDomainScore + symptomDomainScore;

    let severity;
    if (totalScore < 39) severity = "Mild";
    else if (totalScore < 59) severity = "Moderate";
    else severity = "Severe";

    let soapText = `• Fibromyalgia Impact Questionnaire - Revised (FIQR):\n`;
    soapText += `  Total Score: ${totalScore.toFixed(1)}/100 — ${severity} impact\n`;
    soapText += `  Function Domain: ${(functionScores.reduce((s,v)=>s+v,0)).toFixed(0)}/90 (scaled: ${functionDomainScore.toFixed(1)}/30)\n`;
    soapText += `  Overall Impact Domain: ${overallDomainScore.toFixed(0)}/20\n`;
    soapText += `  Symptoms Domain: ${(symptomScores.reduce((s,v)=>s+v,0)).toFixed(0)}/100 (scaled: ${symptomDomainScore.toFixed(1)}/50)\n\n`;
    soapText += `  Function Items (0=No difficulty, 10=Extreme difficulty):\n`;
    FUNCTION_ITEMS.forEach((q, i) => { soapText += `    - ${q}: ${functionScores[i]}/10\n`; });
    soapText += `\n  Overall Impact Items (0=Never, 10=Always):\n`;
    OVERALL_ITEMS.forEach((q, i) => { soapText += `    - ${q}: ${overallScores[i]}/10\n`; });
    soapText += `\n  Symptom Items (0=No problem, 10=Severe problem):\n`;
    SYMPTOM_ITEMS.forEach((q, i) => { soapText += `    - ${q}: ${symptomScores[i]}/10\n`; });
    if (notes.trim()) soapText += `\n  Clinical Notes: ${notes}`;

    onSave({
      status: "completed",
      result_value: parseFloat(totalScore.toFixed(1)),
      additional_data: {
        measurement_type: "fiqr",
        function_scores: functionScores,
        overall_scores: overallScores,
        symptom_scores: symptomScores,
        function_domain_score: parseFloat(functionDomainScore.toFixed(1)),
        overall_domain_score: overallDomainScore,
        symptom_domain_score: parseFloat(symptomDomainScore.toFixed(1)),
        total_score: parseFloat(totalScore.toFixed(1)),
        severity,
        soap_text: soapText,
      },
      notes: soapText,
      assessment_date: new Date().toISOString().split("T")[0],
    });

    toast.success("Assessment saved successfully.");
  };

  const allAnswered = !functionScores.includes(null) && !overallScores.includes(null) && !symptomScores.includes(null);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Fibromyalgia Impact Questionnaire – Revised (FIQR)</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        {/* Clinician Instructions */}
        <div className="bg-blue-600 text-white rounded-lg p-4 space-y-2 text-sm">
          <p className="font-semibold text-base">📋 Clinician Instructions</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Self-report questionnaire validated for fibromyalgia severity and treatment response.</li>
            <li><strong>Domain 1 – Function (9 items):</strong> Ask the client to rate difficulty over the <em>past 7 days</em>. Scale: 0 = No difficulty → 10 = Extreme difficulty. Raw sum ÷ 3 = Domain score (max 30).</li>
            <li><strong>Domain 2 – Overall Impact (2 items):</strong> Rate how often fibromyalgia interfered (0 = Never → 10 = Always). Sum = Domain score (max 20).</li>
            <li><strong>Domain 3 – Symptoms (10 items):</strong> Rate severity over the past 7 days (0 = No problem → 10 = Severe problem). Raw sum ÷ 2 = Domain score (max 50).</li>
            <li><strong>Total FIQR = Function + Overall + Symptoms (max 100).</strong> Mild &lt;39, Moderate 39–58, Severe ≥59.</li>
          </ul>
        </div>

        {/* Script */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-slate-700">
          <p className="font-semibold text-green-800 mb-1">🗣 What to Say to the Client</p>
          <p className="italic">"I'm going to ask you about how fibromyalgia has affected you over the <strong>past 7 days</strong>. For each item, please choose a number from 0 to 10 that best reflects your experience. There are no right or wrong answers."</p>
        </div>

        {/* Section 1: Function */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Section 1: Function</CardTitle>
            <p className="text-xs text-slate-500">Rate difficulty performing each activity over the past 7 days. 0 = No difficulty · 10 = Extreme difficulty / Unable</p>
          </CardHeader>
          <CardContent>
            {FUNCTION_ITEMS.map((q, i) => (
              <RatingRow key={i} label={q} value={functionScores[i]} onChange={v => update(setFunctionScores, i, v)} minLabel="No difficulty" maxLabel="Extreme difficulty" />
            ))}
          </CardContent>
        </Card>

        {/* Section 2: Overall Impact */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Section 2: Overall Impact</CardTitle>
            <p className="text-xs text-slate-500">Rate how often fibromyalgia affected you over the past 7 days. 0 = Never · 10 = Always</p>
          </CardHeader>
          <CardContent>
            {OVERALL_ITEMS.map((q, i) => (
              <RatingRow key={i} label={q} value={overallScores[i]} onChange={v => update(setOverallScores, i, v)} minLabel="Never" maxLabel="Always" />
            ))}
          </CardContent>
        </Card>

        {/* Section 3: Symptoms */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Section 3: Symptoms</CardTitle>
            <p className="text-xs text-slate-500">Rate the severity of each symptom over the past 7 days. 0 = No problem · 10 = Very severe problem</p>
          </CardHeader>
          <CardContent>
            {SYMPTOM_ITEMS.map((q, i) => (
              <RatingRow key={i} label={q} value={symptomScores[i]} onChange={v => update(setSymptomScores, i, v)} minLabel="No problem" maxLabel="Very severe" />
            ))}
          </CardContent>
        </Card>

        {/* Live score preview */}
        {allAnswered && (() => {
          const fd = functionScores.reduce((s,v)=>s+v,0)/3;
          const od = overallScores.reduce((s,v)=>s+v,0);
          const sd = symptomScores.reduce((s,v)=>s+v,0)/2;
          const total = fd+od+sd;
          const sev = total < 39 ? "Mild" : total < 59 ? "Moderate" : "Severe";
          const color = sev === "Mild" ? "bg-green-50 border-green-200 text-green-800" : sev === "Moderate" ? "bg-yellow-50 border-yellow-200 text-yellow-800" : "bg-red-50 border-red-200 text-red-800";
          return (
            <div className={`p-3 rounded-lg border ${color}`}>
              <p className="font-semibold text-sm">Total FIQR Score: {total.toFixed(1)}/100 — {sev} Impact</p>
              <p className="text-xs mt-1">Function: {fd.toFixed(1)}/30 · Overall: {od}/20 · Symptoms: {sd.toFixed(1)}/50</p>
            </div>
          );
        })()}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Additional Clinical Notes</label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Any additional clinical observations..." />
        </div>

        {/* Buttons */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Close</Button>
          <Button onClick={handleSave}><Save className="w-4 h-4 mr-2" />Save Assessment</Button>
        </div>
      </div>
    </div>
  );
}