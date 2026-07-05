import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, AlertTriangle, Info, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function PeakExpiratoryFlowRatePEFRRunner({ client, onSave, onClose }) {
  const [preTestVitals, setPreTestVitals] = useState({ systolic: "", diastolic: "", heartRate: "" });
  const [postTestVitals, setPostTestVitals] = useState({ systolic: "", diastolic: "", heartRate: "" });
  const [trialResults, setTrialResults] = useState([null, null, null]);
  const [notes, setNotes] = useState("");
  // Removed isTesting state — form is always accessible
  const [showClinicianInfo, setShowClinicianInfo] = useState(false);

  const handleEndTest = () => {
    const validResults = trialResults.filter(r => r !== null && r !== "" && !isNaN(r));
    const bestResult = validResults.length > 0 ? Math.max(...validResults) : 0;
    const additionalData = {
      soap_text: `• Peak Expiratory Flow Rate (PEFR)\n  Best Result: ${bestResult} L/min\n  Trials: ${validResults.join(', ')} L/min`,
      measurement_type: "PEFR",
      pre_test_vitals: preTestVitals,
      post_test_vitals: postTestVitals,
      trial_results: trialResults,
    };
    onSave({
      status: "completed",
      result_value: bestResult,
      additional_data: additionalData,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
  };

  const handleTrialChange = (index, value) => {
    const newTrialResults = [...trialResults];
    newTrialResults[index] = value;
    setTrialResults(newTrialResults);
  };

  const handleVitalsChange = (e, type) => {
    const { name, value } = e.target;
    if (type === "pre") {
      setPreTestVitals((prev) => ({ ...prev, [name]: value }));
    } else {
      setPostTestVitals((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleNotesChange = (e) => {
    setNotes(e.target.value);
  };

  const handleSave = () => {
    const validResults = trialResults.filter(r => r !== null && r !== "" && !isNaN(r));
    if (validResults.length === 0) {
      toast.error("Please enter at least one trial result before saving.");
      return;
    }
    handleEndTest();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-cyan-50 sticky top-0">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Peak Expiratory Flow Rate (PEFR)</h2>
              <p className="text-slate-600 mt-1">Respiratory Function Assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Clinician Instructions */}
        <button
          onClick={() => setShowClinicianInfo(!showClinicianInfo)}
          className="w-full flex justify-between items-center px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg font-semibold text-blue-900 hover:bg-blue-100 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Clinician Instructions & Equipment Reference
          </span>
          {showClinicianInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showClinicianInfo && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6 space-y-4 text-sm">
              <div>
                <p className="font-semibold text-blue-900 mb-2">Purpose & Clinical Use</p>
                <p className="text-blue-800 mb-2">
                  <strong>PEFR (Peak Expiratory Flow Rate)</strong> measures the maximum amount of air a person can exhale forcefully in one second, expressed in liters per minute (L/min). It is a simple, portable indicator of airway obstruction and respiratory function.
                </p>
                <ul className="text-blue-800 list-disc list-inside space-y-1">
                  <li>Screening for asthma, COPD, and other obstructive airway disease</li>
                  <li>Monitoring baseline lung function in respiratory populations</li>
                  <li>Assessing response to bronchodilators in acute respiratory exacerbation</li>
                  <li>Home monitoring for asthma control (self-management tool)</li>
                  <li>Pre/post-exercise testing in exercise rehabilitation programs</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-blue-900 mb-2">Equipment Required</p>
                <div className="bg-white p-3 rounded border border-blue-300 space-y-2">
                  <p className="text-blue-800"><strong>Peak Flow Meter (PFM)</strong></p>
                  <ul className="text-blue-800 list-disc list-inside space-y-1 text-xs">
                    <li><strong>Type:</strong> Mechanical or electronic peak flow meter; most common are mechanical "mini" peak flow meters</li>
                    <li><strong>Accuracy:</strong> Most medical-grade meters are accurate to ±10 L/min</li>
                    <li><strong>Portability:</strong> Lightweight, pocket-sized device (~100g); ideal for clinical and home use</li>
                    <li><strong>Sterilization:</strong> Mouthpiece is disposable or easily disinfected between patients</li>
                  </ul>
                </div>
              </div>

              <div>
                <p className="font-semibold text-blue-900 mb-2">Recommended Equipment Models & Purchasing</p>
                <div className="bg-white p-3 rounded border border-blue-300 space-y-3">
                  <div>
                    <p className="text-blue-800 font-semibold text-xs">Standard Clinical Peak Flow Meters:</p>
                    <ul className="text-blue-800 list-disc list-inside space-y-1 text-xs mt-1">
                      <li><strong>Vitalograph ASMA-1</strong> — Gold standard mechanical peak flow meter, 50–800 L/min range. <a href="https://www.vitalograph.co.uk/products/peak-flow-meters" target="_blank" className="text-blue-600 underline inline-flex items-center gap-1">vitalograph.co.uk <ExternalLink className="w-3 h-3" /></a></li>
                      <li><strong>Clement Clarke Mini-Wright</strong> — Widely used clinical mechanical meter, ATS-compliant. <a href="https://www.clement-clarke.com/peak-flow-meters" target="_blank" className="text-blue-600 underline inline-flex items-center gap-1">clement-clarke.com <ExternalLink className="w-3 h-3" /></a></li>
                      <li><strong>Microlife PF 100</strong> — Electronic digital peak flow meter for accurate home and clinical use. <a href="https://www.microlife.com" target="_blank" className="text-blue-600 underline inline-flex items-center gap-1">microlife.com <ExternalLink className="w-3 h-3" /></a></li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-blue-800 font-semibold text-xs">Australian Suppliers:</p>
                    <ul className="text-blue-800 list-disc list-inside space-y-1 text-xs mt-1">
                      <li><strong>Medline Australia</strong> — Medical equipment supplier including respiratory devices. <a href="https://www.medline.com.au" target="_blank" className="text-blue-600 underline inline-flex items-center gap-1">medline.com.au <ExternalLink className="w-3 h-3" /></a></li>
                      <li><strong>Instrumentation Industries (3i)</strong> — Spirometry and respiratory assessment equipment. <a href="https://www.3i.com.au" target="_blank" className="text-blue-600 underline inline-flex items-center gap-1">3i.com.au <ExternalLink className="w-3 h-3" /></a></li>
                      <li><strong>Carers Direct</strong> — Home healthcare and respiratory monitoring equipment. <a href="https://www.carersdirect.com.au" target="_blank" className="text-blue-600 underline inline-flex items-center gap-1">carersdirect.com.au <ExternalLink className="w-3 h-3" /></a></li>
                      <li><strong>National Asthma Council Australia</strong> — Information on certified peak flow devices. <a href="https://www.nationalasthma.org.au" target="_blank" className="text-blue-600 underline inline-flex items-center gap-1">nationalasthma.org.au <ExternalLink className="w-3 h-3" /></a></li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <p className="font-semibold text-blue-900 mb-2">Administration Protocol</p>
                <ul className="text-blue-800 list-disc list-inside space-y-1 text-xs">
                  <li><strong>Patient Position:</strong> Seated or standing (consistent between trials). Relaxed posture, not slumped.</li>
                  <li><strong>Baseline:</strong> Patient must be seated for 5 minutes before testing to allow stabilization of airflow.</li>
                  <li><strong>Mouthpiece & Seal:</strong> Patient should grip peak flow meter with fingers clear of scale/indicator. Form tight seal around mouthpiece with lips (not teeth).</li>
                  <li><strong>Instructions:</strong> "Take the deepest breath in you can, seal lips around the mouthpiece, and blow out as hard and fast as you can." Exhale should be brief and maximal (≤1 second).</li>
                  <li><strong>Trial Procedure:</strong> Perform <strong>minimum of 3 trials</strong>, with 1–2 minutes rest between attempts. <strong>Record the highest value</strong> achieved (best of 3).</li>
                  <li><strong>Failed Trial:</strong> Cough, incomplete seal, slow start, or hesitation = invalid trial. Repeat after 1-minute rest.</li>
                  <li><strong>Variability:</strong> Good technique yields results within 20 L/min of each other; if &gt;40 L/min difference, retest.</li>
                  <li><strong>Timing:</strong> At same time each day (typically morning) if monitoring asthma; note time of last bronchodilator use.</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-blue-900 mb-2">Score Interpretation & Zones</p>
                <div className="bg-white p-3 rounded border border-blue-300 space-y-2 text-xs">
                  <p className="text-blue-800"><strong>Green Zone (≥80% personal best or predicted):</strong> Good asthma control; proceed with normal activity.</p>
                  <p className="text-blue-800"><strong>Yellow Zone (50–79% personal best):</strong> Caution; take reliever medication, monitor closely, escalate to regular treatment if persistent.</p>
                  <p className="text-blue-800"><strong>Red Zone (&lt;50% personal best):</strong> Medical emergency; use reliever, seek urgent medical review or ED assessment.</p>
                  <p className="text-blue-800"><strong>Predicted PEFR (Theoretical):</strong> Determined by age, gender, height using standardized nomograms (e.g., Nunn &amp; Gregg, 1989). Typical adult range: 380–760 L/min (males higher than females).</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-blue-900 mb-2">Scope of Practice & Professional Responsibility</p>
                <div className="bg-white p-3 rounded border border-blue-300 space-y-2 text-xs">
                  <p className="text-blue-800"><strong>Who Can Administer:</strong> Allied health (physiotherapists, respiratory therapists), nurses, general practitioners, and appropriately trained staff. <strong>No specific credential required</strong>, but clinician must understand airway pathophysiology and normal technique.</p>
                  <p className="text-blue-800"><strong>Interpretation:</strong> Physiotherapists and respiratory therapists should interpret results in context of clinical presentation, lung function history, and medication use. Abnormal PEFR should trigger referral to respiratory physician or GP if not already under care.</p>
                  <p className="text-blue-800"><strong>Limitations:</strong> PEFR is effort-dependent and technique-sensitive; a low value does NOT confirm airway obstruction without clinical correlation. Falsely low results are common with poor technique or effort.</p>
                  <p className="text-blue-800"><strong>Quality Assurance:</strong> Peak flow meters should be calibrated annually per manufacturer guidelines. Check scale indicator is clear, mouthpiece is intact and sealed, and device is not damaged.</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-blue-900 mb-2">Evidence Base & References</p>
                <div className="bg-white p-3 rounded border border-blue-300 space-y-2 text-xs">
                  <p className="text-blue-800"><strong>Standard Setting & Nomograms:</strong> Nunn AJ, Gregg I. (1989). New regression equations for predicting peak expiratory flow in adults. <em>BMJ, 298</em>(6680), 1068–1070. Widely used reference for predicted PEFR values.</p>
                  <p className="text-blue-800"><strong>Technique & Reproducibility:</strong> Miller MR, et al. (2005). General considerations for lung function testing. <em>Eur Respir J, 26</em>(1), 153–161. (ERS/ATS standards).</p>
                  <p className="text-blue-800"><strong>Clinical Utility — Asthma:</strong> National Asthma Council Australia. (2023). <em>Australian Asthma Handbook</em>. Peak flow monitoring recommended for asthma action plans. <a href="https://www.asthmahandbook.org.au" target="_blank" className="text-blue-600 underline inline-flex items-center gap-1">asthmahandbook.org.au <ExternalLink className="w-3 h-3" /></a></p>
                  <p className="text-blue-800"><strong>COPD Assessment:</strong> Global Initiative for Chronic Obstructive Lung Disease (GOLD, 2024). PEFR not recommended for COPD diagnosis (use FEV1/FVC ratio); useful for monitoring bronchodilator response.</p>
                  <p className="text-blue-800"><strong>Australian Standards:</strong> ESSA (Exercise &amp; Sports Science Australia) Clinical Exercise Physiology guidelines recommend PEFR as part of pre-exercise respiratory screening and baseline lung function in ERP participants.</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-300 p-3 rounded">
                <p className="text-blue-800 text-xs"><strong>⚠ï¸ IMPORTANT:</strong> PEFR is NOT a diagnostic test. A low or abnormal result requires further spirometry (FEV1/FVC) or physician assessment for diagnosis. Always refer patients with unexplained dyspnea, chest pain, or significant baseline changes to respiratory physician or GP.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
        <CardHeader>
          <CardTitle>Peak Expiratory Flow Rate (PEFR) Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>
              <strong>Client:</strong> {client.name}
            </p>
            <p>
              <strong>Age:</strong> {client.age} years
            </p>
            <p>
              <strong>Height:</strong> {client.height} cm
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Pre-Test Vitals</Label>
              <div className="grid grid-cols-3 gap-4">
                <Input
                  type="number"
                  name="systolic"
                  value={preTestVitals.systolic}
                  onChange={(e) => handleVitalsChange(e, "pre")}
                  placeholder="Systolic (mmHg)"
                />
                <Input
                  type="number"
                  name="diastolic"
                  value={preTestVitals.diastolic}
                  onChange={(e) => handleVitalsChange(e, "pre")}
                  placeholder="Diastolic (mmHg)"
                />
                <Input
                  type="number"
                  name="heartRate"
                  value={preTestVitals.heartRate}
                  onChange={(e) => handleVitalsChange(e, "pre")}
                  placeholder="Heart Rate (bpm)"
                />
              </div>
            </div>

            <div>
              <Label>Trial Results (L/min)</Label>
              <div className="space-y-2">
                {trialResults.map((result, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      type="number"
                      value={result === null ? "" : result}
                      onChange={(e) => handleTrialChange(index, parseFloat(e.target.value))}
                      placeholder={`Trial ${index + 1}`}
                      
                    />
                    {result !== null && (
                      <Badge variant="outline" className="text-xs">
                        {result >= 80 ? "Green Zone" : result >= 50 ? "Yellow Zone" : "Red Zone"}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Post-Test Vitals</Label>
              <div className="grid grid-cols-3 gap-4">
                <Input
                  type="number"
                  name="systolic"
                  value={postTestVitals.systolic}
                  onChange={(e) => handleVitalsChange(e, "post")}
                  placeholder="Systolic (mmHg)"
                />
                <Input
                  type="number"
                  name="diastolic"
                  value={postTestVitals.diastolic}
                  onChange={(e) => handleVitalsChange(e, "post")}
                  placeholder="Diastolic (mmHg)"
                />
                <Input
                  type="number"
                  name="heartRate"
                  value={postTestVitals.heartRate}
                  onChange={(e) => handleVitalsChange(e, "post")}
                  placeholder="Heart Rate (bpm)"
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={handleNotesChange} placeholder="Additional notes..." />
            </div>
          </div>
        </CardContent>
      </Card>
       </div>

       {/* Footer */}
       <div className="p-4 border-t bg-slate-50 flex justify-between items-center sticky bottom-0">
         <Button variant="outline" onClick={onClose} className="flex items-center space-x-2">
           <X size={16} />
           <span>Close</span>
         </Button>
         <div className="flex space-x-2">
           <Button onClick={handleSave} className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700">
             <Save size={16} />
             <span>Save Results</span>
           </Button>
         </div>
       </div>
      </div>
      </div>
      );
}