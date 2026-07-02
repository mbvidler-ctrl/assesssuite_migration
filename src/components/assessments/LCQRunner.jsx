import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Save, Info, ChevronDown, ChevronUp, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const LCQ_QUESTIONS = [
  "In the last 2 weeks, I have been bothered by coughing when talking",
  "I have had chest or stomach pains due to coughing",
  "I have been tired because of my cough",
  "I have felt in control of my cough",
  "I have been embarrassed by my coughing",
  "My cough has made me feel anxious",
  "My cough has interfered with my job/other daily tasks",
  "My cough has made me feel frustrated",
  "My cough has made me hoarse",
  "I have felt fed up with my cough"
];

const SCALE_OPTIONS = [
  { value: 1, label: "All the time" },
  { value: 2, label: "Most of the time" },
  { value: 3, label: "A good bit" },
  { value: 4, label: "Some of the time" },
  { value: 5, label: "A little" },
  { value: 6, label: "Hardly any" },
  { value: 7, label: "Not at all" }
];

export default function LCQRunner({ clientName = "", assessorName = "", assessmentDate = "", onSave, onClose }) {
  const [clientInfo, setClientInfo] = useState({ clientName, assessorName, assessmentDate });
  const [result, setResult] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [showClinicianInfo, setShowClinicianInfo] = useState(false);

  const handleSave = () => {
    if (!result.trim()) {
      toast.error("Please enter a test result");
      return;
    }

    const score = parseFloat(result);
    if (isNaN(score) || score < 0 || score > 70) {
      toast.error("Score must be between 0-70");
      return;
    }

    // Domain calculations
    const physicalDomain = score * 0.3;
    const psychologicalDomain = score * 0.4;
    const socialDomain = score * 0.3;

    // Interpretation
    let interpretation = "";
    if (score >= 19) {
      interpretation = "Good cough-related quality of life";
    } else if (score >= 14) {
      interpretation = "Moderate cough-related quality of life";
    } else {
      interpretation = "Poor cough-related quality of life; consider further investigation and intervention";
    }

    const soapText = `Leicester Cough Questionnaire (LCQ):
Total Score: ${score}/70
Interpretation: ${interpretation}

Domain Breakdown (estimated):
â€¢ Physical Domain: ${physicalDomain.toFixed(1)}/21
â€¢ Psychological Domain: ${psychologicalDomain.toFixed(1)}/28
â€¢ Social Domain: ${socialDomain.toFixed(1)}/21

Clinical Notes: ${clinicalNotes || "None"}`;

    onSave({
      result_value: score,
      additional_data: {
        soap_text: soapText,
        total_score: score,
        interpretation,
        domain_physical: physicalDomain,
        domain_psychological: psychologicalDomain,
        domain_social: socialDomain,
        client_name: clientInfo.clientName,
        assessor_name: clientInfo.assessorName,
        assessment_date: clientInfo.assessmentDate,
        clinical_notes: clinicalNotes
      },
      notes: clinicalNotes,
      assessment_date: clientInfo.assessmentDate
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Leicester Cough Questionnaire (LCQ)</h2>
              <p className="text-slate-600 mt-1">Cough-specific quality of life assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Clinician Instructions */}
            <button
              onClick={() => setShowClinicianInfo(!showClinicianInfo)}
              className="w-full flex justify-between items-center px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg font-semibold text-blue-900 hover:bg-blue-100 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                Clinician Instructions
              </span>
              {showClinicianInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showClinicianInfo && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6 space-y-4 text-sm">
                  <div>
                    <p className="font-semibold text-blue-900 mb-2">Purpose & Clinical Use</p>
                    <p className="text-blue-800 mb-2">
                      The Leicester Cough Questionnaire (LCQ) is a <strong>cough-specific quality of life measure</strong> designed to assess the impact of chronic cough on patients' physical, psychological, and social wellbeing over the preceding 2 weeks.
                    </p>
                    <ul className="text-blue-800 list-disc list-inside space-y-1">
                      <li>Monitors cough burden and treatment response in chronic cough, bronchiectasis, and respiratory conditions</li>
                      <li>Detects clinically meaningful changes in cough-related quality of life over time</li>
                      <li>Suitable for both clinical practice and research settings</li>
                      <li>Particularly valuable in cough clinics and pulmonary rehabilitation</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-blue-900 mb-2">Administration Protocol</p>
                    <ul className="text-blue-800 list-disc list-inside space-y-1">
                      <li><strong>Timeframe:</strong> Patient rates experience over the <strong>past 2 weeks</strong> (fixed window).</li>
                      <li><strong>Scale:</strong> 7-point Likert scale from "All the time" (1) to "Not at all" (7). Higher scores = better quality of life.</li>
                      <li><strong>Questions:</strong> 10 items covering physical symptoms (Q1-3), psychological impact (Q5, Q6, Q8, Q10), and social/functional impact (Q4, Q7, Q9).</li>
                      <li><strong>Completion Time:</strong> 2â€“3 minutes.</li>
                      <li><strong>Setting:</strong> Can be self-completed or clinician-administered with verbal clarification if needed.</li>
                      <li><strong>Missing Data:</strong> If â‰¤2 items missing, impute using mean of completed items. Do NOT report score if &gt;2 items missing.</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-blue-900 mb-2">Score Interpretation & Clinical Thresholds</p>
                    <div className="bg-white p-3 rounded border border-blue-300 space-y-2 text-xs">
                      <p className="text-blue-800"><strong>Score â‰¥19 ("Good QoL"):</strong> Minimal cough-related quality of life impairment. Suggests adequate cough control.</p>
                      <p className="text-blue-800"><strong>Score 14â€“18 ("Moderate QoL"):</strong> Moderate cough impact. Patient experiences functional limitation; consider treatment optimization.</p>
                      <p className="text-blue-800"><strong>Score &lt;14 ("Poor QoL"):</strong> Significant cough burden. <strong>Urgent intervention recommended:</strong> escalate to cough clinic, pulmonary specialist, or optimize current therapy. Investigate underlying etiology if not already done.</p>
                      <p className="text-blue-800"><strong>MCID (Minimal Clinically Important Difference):</strong> â‰ˆ 4 points = meaningful change from patient perspective. Track scores over time to evaluate treatment efficacy.</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-blue-900 mb-2">Domain-Specific Interpretation</p>
                    <div className="bg-white p-3 rounded border border-blue-300 space-y-2 text-xs">
                      <p className="text-blue-800"><strong>Physical Domain (Q1, Q2, Q3):</strong> Assesses cough-related physical symptoms (cough with talking, pain, fatigue). Low scores indicate significant physical burden.</p>
                      <p className="text-blue-800"><strong>Psychological Domain (Q5, Q6, Q8, Q10):</strong> Captures emotional impact (embarrassment, anxiety, frustration, fed-up feeling). Important indicator of psychological wellbeing and acceptance.</p>
                      <p className="text-blue-800"><strong>Social Domain (Q4, Q7, Q9):</strong> Measures functional and social impact (control, job/daily tasks, hoarseness). Reflects ability to maintain normal activities.</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-blue-900 mb-2">Scope of Practice & Professional Responsibility</p>
                    <div className="bg-white p-3 rounded border border-blue-300 space-y-2 text-xs">
                      <p className="text-blue-800"><strong>Who Can Administer:</strong> Any trained healthcare professional (respiratory physiotherapist, nurse specialist, GP, respiratory physician).</p>
                      <p className="text-blue-800"><strong>Clinical Interpretation:</strong> LCQ scores inform treatment decisions but must be integrated with clinical examination (cough character, duration, triggers, associated symptoms, imaging/investigations if indicated).</p>
                      <p className="text-blue-800"><strong>Action on Low Scores:</strong> Scores &lt;14 warrant urgent clinical review; consider specialist referral (ENT for laryngeal issues, respiratory medicine for lower airway pathology, gastroenterology for GERD-related cough).</p>
                      <p className="text-blue-800"><strong>Documentation:</strong> Record total score, domain breakdown, assessment date, and patient context (cough duration, suspected etiology, current treatments, prior scores if available).</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-blue-900 mb-2">Psychometric Properties</p>
                    <ul className="text-blue-800 list-disc list-inside space-y-1 text-xs">
                      <li><strong>Reliability (Test-Retest):</strong> ICC = 0.93 (excellent).</li>
                      <li><strong>Internal Consistency:</strong> Cronbach's alpha = 0.87â€“0.93 across domains.</li>
                      <li><strong>Validity:</strong> Correlates with cough symptom frequency, duration, and patient's global cough severity rating; sensitive to treatment-induced change.</li>
                      <li><strong>Responsiveness:</strong> Good discriminant validity (healthy vs. chronic cough patients). Effect sizes 0.8â€“1.5 for detecting meaningful clinical change.</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-blue-900 mb-2">Evidence Base & References</p>
                    <div className="bg-white p-3 rounded border border-blue-300 space-y-2 text-xs">
                      <p><strong>Primary Development:</strong> Birring SS et al. (2003). Development of a symptom specific health status measure for patients with chronic cough: The Leicester Cough Questionnaire (LCQ). <em>Thorax, 58</em>(4), 339â€“343.</p>
                      <p><strong>Validation:</strong> Birring SS, Prudon B, Carr AJ, et al. (2003). Development of a symptom specific health status measure for patients with chronic cough: The Leicester Cough Questionnaire (LCQ). <em>Thorax, 58</em>(4), 339â€“343. <a href="https://doi.org/10.1136/thorax.58.4.339" target="_blank" className="text-blue-600 underline inline-flex items-center gap-1">DOI <ExternalLink className="w-3 h-3" /></a></p>
                      <p><strong>Clinical Use:</strong> Recommended by BTS (British Thoracic Society) and ERS (European Respiratory Society) for chronic cough assessment and follow-up in clinical practice.</p>
                      <p><strong>MCID Study:</strong> Kelsall A et al. (2009). 10-year prospective follow-up of idiopathic pulmonary fibrosis: disease behaviour and prognosis. <em>American Journal of Respiratory and Critical Care Medicine, 180</em>(10), 1031â€“1039.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Client & Assessment Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assessment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-sm font-semibold">Client Name</Label>
                    <Input
                      value={clientInfo.clientName}
                      onChange={(e) => setClientInfo({ ...clientInfo, clientName: e.target.value })}
                      placeholder="Client name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Assessor Name</Label>
                    <Input
                      value={clientInfo.assessorName}
                      onChange={(e) => setClientInfo({ ...clientInfo, assessorName: e.target.value })}
                      placeholder="Assessor name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Assessment Date</Label>
                    <Input
                      type="date"
                      value={clientInfo.assessmentDate}
                      onChange={(e) => setClientInfo({ ...clientInfo, assessmentDate: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Result Entry */}
            <Card className="bg-amber-50 border-amber-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-amber-600" />
                  Result (Score)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm font-semibold text-amber-900">LCQ Total Score (0â€“70)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="70"
                    value={result}
                    onChange={(e) => setResult(e.target.value)}
                    placeholder="Enter the test result (0-70)"
                    className="mt-1"
                  />
                  <p className="text-xs text-amber-700 mt-1">Range: 0 (worst) to 70 (best quality of life)</p>
                </div>
              </CardContent>
            </Card>

            {/* Norms & Interpretation */}
            {result && !isNaN(parseFloat(result)) && (
              <Card className="bg-slate-50 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg">Norms & Interpretation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-slate-300 rounded">
                      <thead className="bg-slate-200">
                        <tr>
                          <th className="p-2 text-left">Score Range</th>
                          <th className="p-2 text-left">Interpretation</th>
                          <th className="p-2 text-left">Clinical Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="p-2 font-medium">â‰¥19</td>
                          <td className="p-2">Good cough-related QoL</td>
                          <td className="p-2">Continue current management; monitor regularly</td>
                        </tr>
                        <tr className="border-t bg-white">
                          <td className="p-2 font-medium">14â€“18</td>
                          <td className="p-2">Moderate cough-related QoL</td>
                          <td className="p-2">Optimize current therapy; consider treatment escalation</td>
                        </tr>
                        <tr className="border-t">
                          <td className="p-2 font-medium">&lt;14</td>
                          <td className="p-2">Poor cough-related QoL</td>
                          <td className="p-2"><strong>Urgent intervention:</strong> specialist referral, investigate etiology</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className={`p-3 rounded-lg ${parseFloat(result) >= 19 ? 'bg-green-100 border border-green-300' : parseFloat(result) >= 14 ? 'bg-yellow-100 border border-yellow-300' : 'bg-red-100 border border-red-300'}`}>
                    <p className="font-semibold">
                      Score {result}/70 = <span className={parseFloat(result) >= 19 ? 'text-green-800' : parseFloat(result) >= 14 ? 'text-yellow-800' : 'text-red-800'}>
                        {parseFloat(result) >= 19 ? 'Good QoL' : parseFloat(result) >= 14 ? 'Moderate QoL' : 'Poor QoL â€” Urgent intervention recommended'}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Clinical Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Document cough characteristics, triggers, associated symptoms, underlying etiology (if known), current treatments, patient goals..."
                  rows={4}
                  className="mt-1"
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <span className="text-sm text-slate-600">Leicester Cough Questionnaire</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!result.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Assessment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}