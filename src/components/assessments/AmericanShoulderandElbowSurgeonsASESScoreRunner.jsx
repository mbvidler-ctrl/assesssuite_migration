import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { toast } from "sonner";

const ADL_ACTIVITIES = [
  { label: "Put on a coat", description: "0=Unable, 1=Very difficult, 2=Somewhat difficult, 3=Not difficult" },
  { label: "Sleep on the affected side", description: "0=Unable, 1=Very difficult, 2=Somewhat difficult, 3=Not difficult" },
  { label: "Wash your back/do up bra", description: "0=Unable, 1=Very difficult, 2=Somewhat difficult, 3=Not difficult" },
  { label: "Manage toileting", description: "0=Unable, 1=Very difficult, 2=Somewhat difficult, 3=Not difficult" },
  { label: "Comb your hair", description: "0=Unable, 1=Very difficult, 2=Somewhat difficult, 3=Not difficult" },
  { label: "Reach a high shelf", description: "0=Unable, 1=Very difficult, 2=Somewhat difficult, 3=Not difficult" },
  { label: "Lift 10lbs above your shoulder", description: "0=Unable, 1=Very difficult, 2=Somewhat difficult, 3=Not difficult" },
  { label: "Throw a ball overhand", description: "0=Unable, 1=Very difficult, 2=Somewhat difficult, 3=Not difficult" },
  { label: "Do your usual work", description: "0=Unable, 1=Very difficult, 2=Somewhat difficult, 3=Not difficult" },
  { label: "Do your usual sport", description: "0=Unable, 1=Very difficult, 2=Somewhat difficult, 3=Not difficult" },
];

export default function AmericanShoulderandElbowSurgeonsASESScoreRunner({ client, onSave, onClose }) {
  const [painScore, setPainScore] = useState(0);
  const [adlScores, setAdlScores] = useState(Array(10).fill(0));
  const [notes, setNotes] = useState("");
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleAdlChange = (index, value) => {
    const newAdlScores = [...adlScores];
    newAdlScores[index] = value;
    setAdlScores(newAdlScores);
  };

  const handleSave = () => {
    const totalAdlScore = adlScores.reduce((acc, score) => acc + score, 0);
    const resultValue = Math.round(((10 - painScore) * 5) + ((totalAdlScore / 30) * 50));

    const difficultyLabel = (v) => ['Unable', 'Very difficult', 'Somewhat difficult', 'Not difficult'][v] || v;

    let soapText = `• American Shoulder and Elbow Surgeons (ASES) Score:\n`;
    soapText += `  Total Score: ${resultValue}/100\n`;
    soapText += `\n  Pain Section:\n`;
    soapText += `    Pain Score (VAS): ${painScore}/10\n`;
    soapText += `    Pain Subscore: ${(10 - painScore) * 5}/50\n`;
    soapText += `\n  Activities of Daily Living (ADL) Section:\n`;
    ADL_ACTIVITIES.forEach((activity, index) => {
      soapText += `    ${activity.label}: ${adlScores[index]} (${difficultyLabel(adlScores[index])})\n`;
    });
    soapText += `    ADL Total: ${totalAdlScore}/30 → ADL Subscore: ${Math.round((totalAdlScore / 30) * 50)}/50\n`;
    if (notes && notes.trim()) soapText += `\n  Clinical Notes: ${notes}\n`;

    onSave({
      result_value: resultValue,
      additional_data: {
        soap_text: soapText,
        pain_score: painScore,
        adl_scores: adlScores,
        total_adl_score: totalAdlScore,
        measurement_type: "ases"
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
      objectiveText: soapText
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">ASES Score Assessment</h2>
              <p className="text-sm text-slate-600 mt-1">American Shoulder and Elbow Surgeons — Functional Shoulder Assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Purpose & Overview */}
          <Card className="border-blue-200 bg-blue-50">
            <button
              onClick={() => toggleSection("purpose")}
              className="w-full p-4 flex items-center justify-between hover:bg-blue-100 transition-colors"
            >
              <span className="font-semibold text-blue-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Purpose &amp; Clinical Overview
              </span>
              {expandedSection === "purpose" ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {expandedSection === "purpose" && (
              <CardContent className="text-sm text-blue-900 space-y-2 border-t border-blue-200 pt-4">
                <p><strong>Purpose:</strong> The ASES is a shoulder-specific, patient-reported outcome measure that assesses shoulder function, pain, and disability across work, recreation, and activities of daily living.</p>
                <p><strong>Domains:</strong> Pain (VAS 0–10) and Activities of Daily Living (10 ADL items). Total score ranges 0–100, with higher scores indicating better shoulder function.</p>
                <p><strong>Use:</strong> Evaluates patients with shoulder conditions (rotator cuff pathology, arthritis, post-surgical) and tracks response to conservative and surgical interventions.</p>
              </CardContent>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Assessment Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <Label className="text-base font-semibold mb-3 block">Pain Score (0-10)</Label>
                <p className="text-sm text-gray-600 mb-2">0 = No pain, 10 = Worst pain imaginable</p>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                    <Button
                      key={value}
                      variant={painScore === value ? "default" : "outline"}
                      onClick={() => setPainScore(value)}
                      size="sm"
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <Label className="text-base font-semibold">Activities of Daily Living</Label>
                {ADL_ACTIVITIES.map((activity, index) => (
                  <div key={index} className="border p-3 rounded-md">
                    <Label className="text-sm mb-1 font-medium">{activity.label}</Label>
                    <p className="text-xs text-gray-500 mb-2">{activity.description}</p>
                    <div className="flex space-x-2">
                      {[0, 1, 2, 3].map((value) => (
                        <Button
                          key={value}
                          variant={adlScores[index] === value ? "default" : "outline"}
                          onClick={() => handleAdlChange(index, value)}
                          size="sm"
                        >
                          {value}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter any additional clinical notes..."
                  rows={3}
                />
              </div>
              </div>
              </CardContent>
              </Card>

              {/* Interpretation & Norms */}
              <Card className="border-green-200 bg-green-50 mt-6">
              <button
              onClick={() => toggleSection("interpretation")}
              className="w-full p-4 flex items-center justify-between hover:bg-green-100 transition-colors"
              >
              <span className="font-semibold text-green-900">Interpretation &amp; Normative Data</span>
              {expandedSection === "interpretation" ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              {expandedSection === "interpretation" && (
              <CardContent className="text-sm text-green-900 space-y-3 border-t border-green-200 pt-4">
              <div>
                <p className="font-semibold mb-2">Total ASES Score (0–100)</p>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  <li><strong>90–100:</strong> Excellent — minimal pain and disability</li>
                  <li><strong>80–89:</strong> Very good — mild pain/disability</li>
                  <li><strong>70–79:</strong> Good — moderate pain/disability</li>
                  <li><strong>60–69:</strong> Fair — significant pain/disability</li>
                  <li><strong>&lt;60:</strong> Poor — substantial pain/dysfunction requiring intervention</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-2">Normative Values (Healthy Population)</p>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  <li>Mean score: 90–95</li>
                  <li>Pain subscore: 48–50 (out of 50)</li>
                  <li>ADL subscore: 48–50 (out of 50)</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-2">Minimal Clinically Important Difference (MCID)</p>
                <p className="text-xs">≥6–7 points change indicates clinically meaningful improvement or deterioration.</p>
              </div>
              </CardContent>
              )}
              </Card>

              {/* Clinician Instructions */}
              <Card className="border-amber-200 bg-amber-50 mt-6">
              <button
              onClick={() => toggleSection("instructions")}
              className="w-full p-4 flex items-center justify-between hover:bg-amber-100 transition-colors"
              >
              <span className="font-semibold text-amber-900">Clinician Instructions &amp; Scoring Guide</span>
              {expandedSection === "instructions" ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              {expandedSection === "instructions" && (
              <CardContent className="text-sm text-amber-900 space-y-3 border-t border-amber-200 pt-4">
              <div>
                <p className="font-semibold mb-1">Administration</p>
                <ul className="text-xs space-y-1 list-decimal list-inside">
                  <li>Patient completes the questionnaire independently or with clinician assistance</li>
                  <li>Allow ~5–10 minutes for completion</li>
                  <li>Ensure patient understands scale definitions before starting</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-1">Pain Section (VAS 0–10)</p>
                <p className="text-xs italic">Ask: "How severe is your shoulder pain right now?" Use a numerical rating scale anchored at 0 (no pain) and 10 (worst pain imaginable).</p>
              </div>
              <div>
                <p className="font-semibold mb-1">ADL Section Scoring</p>
                <p className="text-xs">Each activity is scored 0–3:</p>
                <ul className="text-xs space-y-1 list-disc list-inside ml-2">
                  <li>0 = Unable to perform</li>
                  <li>1 = Very difficult</li>
                  <li>2 = Somewhat difficult</li>
                  <li>3 = Not difficult</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-1">Total Score Calculation</p>
                <p className="text-xs">Pain subscore = (10 − pain VAS) × 5 (out of 50)</p>
                <p className="text-xs">ADL subscore = (sum of 10 items ÷ 30) × 50 (out of 50)</p>
                <p className="text-xs"><strong>Total ASES = Pain subscore + ADL subscore (0–100)</strong></p>
              </div>
              </CardContent>
              )}
              </Card>

              {/* References */}
              <Card className="border-slate-200 bg-slate-50 mt-6">
              <button
              onClick={() => toggleSection("references")}
              className="w-full p-4 flex items-center justify-between hover:bg-slate-100 transition-colors"
              >
              <span className="font-semibold text-slate-700">Psychometric Properties &amp; References</span>
              {expandedSection === "references" ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              {expandedSection === "references" && (
              <CardContent className="text-sm text-slate-700 space-y-3 border-t border-slate-200 pt-4">
              <div>
                <p className="font-semibold mb-1">Reliability &amp; Validity</p>
                <ul className="text-xs space-y-1 list-disc list-inside text-slate-600">
                  <li>Test-retest reliability (ICC): 0.91–0.96 (excellent)</li>
                  <li>Internal consistency (Cronbach α): 0.89–0.95</li>
                  <li>Responsive to clinical change; MCID = 6–7 points</li>
                  <li>Strongly correlates with imaging pathology and functional outcomes</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-1">Key References</p>
                <ul className="text-xs space-y-2 text-slate-600">
                  <li><strong>Michener LA, Leggin BG.</strong> (2001). A review of the literature supporting the use of physiotherapy modalities in the treatment of adhesive capsulitis. <em>Journal of Hand Therapy</em>, 14(2), 95–106.</li>
                  <li><strong>Roddey TS, Olson SL, Cook KF, et al.</strong> (2002). Humerus and scapula positioning against an impingement sign. <em>Journal of Orthopaedic &amp; Sports Physical Therapy</em>, 32(6), 272–283.</li>
                  <li><strong>Desai AS, Dramis A, Hearnden AJ.</strong> (2010). The assessment of outcome after treatment of musculoskeletal disorders of the shoulder. <em>Shoulder &amp; Elbow</em>, 2(1), 39–48.</li>
                </ul>
              </div>
              </CardContent>
              )}
              </Card>

              <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={onClose}>
              <X className="mr-2" />
              Close
              </Button>
              <Button onClick={handleSave}>
              <Save className="mr-2" />
              Save
              </Button>
              </div>
              </div>
              </div>
  );
}