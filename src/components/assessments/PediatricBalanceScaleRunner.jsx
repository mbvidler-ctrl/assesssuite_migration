import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle, Info, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function PediatricBalanceScaleRunner({ client, onSave, onClose }) {
  const [preVitals, setPreVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [postVitals, setPostVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [scores, setScores] = useState(Array(14).fill(0));
  const [notes, setNotes] = useState("");
  const [assessmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [showClinicianInfo, setShowClinicianInfo] = useState(false);

  const handleScoreChange = (index, value) => {
    const newScores = [...scores];
    newScores[index] = value;
    setScores(newScores);
  };

  const handleSave = () => {
    const totalScore = scores.reduce((acc, score) => acc + score, 0);
    const additionalData = {
      soap_text: `• Pediatric Balance Scale\n  Total Score: ${totalScore}/56`,
      measurement_type: "PediatricBalanceScale",
      pre_vitals: preVitals,
      post_vitals: postVitals,
      scores,
    };
    onSave({ status: "completed", result_value: totalScore, additional_data: additionalData, notes, assessment_date: assessmentDate });
    toast.success("Assessment saved successfully.");
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-indigo-50 sticky top-0">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Pediatric Balance Scale (PBS)</h2>
              <p className="text-slate-600 mt-1">Dynamic Balance & Fall Risk Assessment (Age 3–14 years)</p>
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
          className="w-full flex justify-between items-center px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg font-semibold text-purple-900 hover:bg-purple-100 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Clinician Instructions & Scoring Guide
          </span>
          {showClinicianInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showClinicianInfo && (
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="pt-6 space-y-4 text-sm">
              <div>
                <p className="font-semibold text-purple-900 mb-2">Purpose & Clinical Use</p>
                <p className="text-purple-800 mb-2">
                  The <strong>Pediatric Balance Scale (PBS)</strong> is a 14-item performance-based assessment that measures <strong>dynamic balance, postural control, and fall risk</strong> in children aged 3–14 years. It is the pediatric adaptation of the Berg Balance Scale (BBS) and is particularly useful in rehabilitation, developmental delay assessment, and neuromotor dysfunction screening.
                </p>
                <ul className="text-purple-800 list-disc list-inside space-y-1">
                  <li>Assess balance and postural stability in children with developmental delays, cerebral palsy, and neuromuscular disorders</li>
                  <li>Predict fall risk in pediatric populations (higher sensitivity in children with moderate–severe balance impairment)</li>
                  <li>Baseline and outcome measurement in pediatric rehabilitation programs</li>
                  <li>Monitor response to therapy in physical therapy and occupational therapy</li>
                  <li>Screening tool in pediatric rehabilitation clinics and developmental services</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-purple-900 mb-2">Environmental Setup</p>
                <div className="bg-white p-3 rounded border border-purple-300 space-y-2">
                  <ul className="text-purple-800 list-disc list-inside space-y-1 text-xs">
                    <li><strong>Testing Location:</strong> Large, clear space with minimal distractions; non-slip floor (carpet or mat preferred)</li>
                    <li><strong>Equipment Required:</strong>
                      <ul className="list-circle list-inside ml-4 mt-1 space-y-0.5">
                        <li>Standard chair (18 inches high, armrests if available)</li>
                        <li>Stool or 8-inch step (for stool transfers)</li>
                        <li>Arm's length reach space (minimal obstructions)</li>
                        <li>Cone or tape mark on floor (for 360° turn, ~3–4 feet diameter)</li>
                        <li>Tape or line on floor (2 yards for standing with one foot in front)</li>
                        <li>Small object (e.g., shoe, pencil) for floor retrieval</li>
                        <li>Stopwatch (if measuring time for any items)</li>
                      </ul>
                    </li>
                    <li><strong>Safety Precautions:</strong> Clear furniture, remove tripping hazards, supervise closely, stand nearby to catch child if balance lost. Have furniture or wall for support if needed.</li>
                  </ul>
                </div>
              </div>

              <div>
                <p className="font-semibold text-purple-900 mb-2">Scoring Guidelines (0–4 per item, max 56 points)</p>
                <div className="bg-white p-3 rounded border border-purple-300 space-y-2 text-xs">
                  <div className="space-y-2">
                    <p className="text-purple-800 font-semibold">General Scoring Framework:</p>
                    <ul className="text-purple-800 list-disc list-inside space-y-1">
                      <li><strong>4 = Normal:</strong> Completes task independently, safely, with good balance; no support needed</li>
                      <li><strong>3 = Mild Difficulty:</strong> Completes task safely but with reduced speed, confidence, or slight loss of balance (self-corrects)</li>
                      <li><strong>2 = Moderate Difficulty:</strong> Requires external support (hand, wall) OR significant balance loss but self-corrects with support</li>
                      <li><strong>1 = Severe Difficulty:</strong> Requires maximal assistance or supervision; high fall risk during task; unable to complete safely without spotter</li>
                      <li><strong>0 = Unable:</strong> Refuses, unable to attempt, or poses imminent fall risk; task not performed</li>
                    </ul>
                  </div>

                  <div className="mt-3 border-t border-purple-200 pt-2">
                    <p className="text-purple-800 font-semibold mb-1">Item-Specific Scoring Tips:</p>
                    <ul className="text-purple-800 list-disc list-inside space-y-1 text-xs">
                      <li><strong>Items 1–3 (Sit-to-stand, Stand-to-sit, Transfers):</strong> Score based on balance during movement, hand use (minimal vs. maximal support), speed, and smoothness.</li>
                      <li><strong>Items 4–7 (Standing unsupported, sitting unsupported, eyes closed, feet together):</strong> Score based on ability to maintain position without support for 1 minute (or 30 seconds if age &lt;5 years), balance loss, or need for external support.</li>
                      <li><strong>Items 8–14 (Reaching, turning, stepping):</strong> Score based on ability to maintain balance during dynamic movement, loss of balance, hand use for support, or need for spotter.</li>
                      <li><strong>Age Adjustments:</strong> Younger children (&lt;5 years) may have shorter hold times (30 sec) for standing items; adjust expectations based on developmental norms.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <p className="font-semibold text-purple-900 mb-2">Administration Instructions</p>
                <ol className="text-purple-800 list-decimal list-inside space-y-1 text-xs">
                  <li><strong>Baseline Vitals:</strong> Record heart rate and blood pressure pre-assessment. Allow 5-minute rest if needed.</li>
                  <li><strong>Demonstration:</strong> Demonstrate each task first (or show video), then ask child to perform. Provide simple, clear instructions.</li>
                  <li><strong>Order:</strong> Proceed sequentially through items as presented. Allow 30 seconds rest between tasks if child becomes fatigued.</li>
                  <li><strong>Safety:</strong> Stand within arm's reach; be ready to catch child if balance lost. Do NOT let child fall.</li>
                  <li><strong>Encouragement:</strong> Use neutral, supportive language. Do NOT coach technique—assess what child does naturally.</li>
                  <li><strong>Post-Test Vitals:</strong> Immediately after final item, record heart rate. Re-measure blood pressure if elevated.</li>
                  <li><strong>Total Score Calculation:</strong> Sum all 14 item scores (range 0–56).</li>
                </ol>
              </div>

              <div>
                <p className="font-semibold text-purple-900 mb-2">Score Interpretation & Fall Risk</p>
                <div className="bg-white p-3 rounded border border-purple-300 space-y-2 text-xs">
                  <p className="text-purple-800"><strong>Score 46–56 (Low Fall Risk):</strong> Good balance; minimal intervention needed. Safe for most activities; monitor periodically.</p>
                  <p className="text-purple-800"><strong>Score 31–45 (Moderate Fall Risk):</strong> Mild-to-moderate balance impairment. Recommend balance training, environmental modifications, and supervision during high-risk activities.</p>
                  <p className="text-purple-800"><strong>Score &lt;31 (High Fall Risk):</strong> Significant balance impairment; child at HIGH RISK of falls during mobility. Recommend intensive therapy, supervision, assistive device (walker, crutches), environmental safety (falls prevention strategies).</p>
                  <p className="text-purple-800 mt-2"><strong>Clinical Correlation:</strong> Always consider developmental level, age, and comorbidities. A score &lt;20 warrants urgent referral to neuromotor specialist or physical therapist.</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-purple-900 mb-2">Scope of Practice & Professional Responsibility</p>
                <div className="bg-white p-3 rounded border border-purple-300 space-y-2 text-xs">
                  <p className="text-purple-800"><strong>Who Can Administer:</strong> Physical therapists, occupational therapists, pediatric rehabilitation specialists, and appropriately trained clinicians. <strong>NO specific credential required</strong>, but administrator should understand pediatric motor development and fall mechanics.</p>
                  <p className="text-purple-800"><strong>Interpretation:</strong> Results should be interpreted by licensed PT or OT in context of child's developmental history, diagnosis, and functional limitations. An abnormal PBS score should trigger referral to rehabilitation specialist if not already under care.</p>
                  <p className="text-purple-800"><strong>Safety is Paramount:</strong> PBS assesses real fall risk; clinician MUST prioritize safety at all times. Stop assessment if child is fatigued, distressed, or at imminent risk.</p>
                  <p className="text-purple-800"><strong>Parental Communication:</strong> Explain findings to caregivers; provide specific balance-training recommendations and home safety strategies.</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-purple-900 mb-2">Evidence Base & References</p>
                <div className="bg-white p-3 rounded border border-purple-300 space-y-2 text-xs">
                  <p className="text-purple-800"><strong>Original Development & Pediatric Adaptation:</strong> Franjoine MR, Gunnes M, Taylor MJ. (2003). Pediatric Balance Scale: A modified version of the Berg Balance Scale for the school-age child with mild to moderate motor impairment. <em>Journal of Pediatric Physical Therapy, 15</em>(2), 114–128. <a href="https://journals.lww.com/jpptonline/pages/default.aspx" target="_blank" className="text-purple-600 underline inline-flex items-center gap-1">lww.com <ExternalLink className="w-3 h-3" /></a></p>
                  <p className="text-purple-800"><strong>Validation & Psychometric Properties:</strong> Franjoine MR, Darr N, Held SL. (2010). The performance of children with cerebral palsy on the Pediatric Balance Scale. <em>Physical &amp; Occupational Therapy in Pediatrics, 30</em>(3), 226–236.</p>
                  <p className="text-purple-800"><strong>Fall Risk in Children:</strong> Schroeder AS, et al. (2002). Pediatric Balance Scale predicts fall risk in children with neuromuscular disease. <em>Neuromuscular Disorders, 17</em>(11–12), 913–920.</p>
                  <p className="text-purple-800"><strong>Australian Resources:</strong> ESSA (Exercise &amp; Sports Science Australia) guidelines for pediatric rehabilitation; NHMRC recommendations for developmental assessment and falls prevention in children. <a href="https://www.essa.org.au" target="_blank" className="text-purple-600 underline inline-flex items-center gap-1">essa.org.au <ExternalLink className="w-3 h-3" /></a></p>
                  <p className="text-purple-800"><strong>Berg Balance Scale (Original):</strong> Berg KO, Wood-Dauphinee SL, Williams JI, Maki B. (1992). Measuring balance in the elderly: validation of an instrument. <em>Canadian Journal of Public Health, 83</em>(2), S7–11.</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-300 p-3 rounded">
                <p className="text-purple-800 text-xs"><strong>⚠ï¸ IMPORTANT:</strong> PBS is a screening and outcome measure, NOT a diagnostic tool. Abnormal findings require comprehensive pediatric neuromotor assessment, including neurological examination and developmental history. Always refer children with severe balance impairment or suspected neurological disorder to pediatric neurologist or rehabilitation specialist.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Assessment Details</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="heartRate">Heart Rate (bpm)</Label>
              <Input
                id="heartRate"
                type="number"
                value={preVitals.heartRate}
                onChange={(e) => setPreVitals({ ...preVitals, heartRate: e.target.value })}
                placeholder="Enter heart rate"
              />
            </div>
            <div>
              <Label htmlFor="bloodPressure">Blood Pressure (mmHg)</Label>
              <Input
                id="bloodPressure"
                type="text"
                value={preVitals.bloodPressure}
                onChange={(e) => setPreVitals({ ...preVitals, bloodPressure: e.target.value })}
                placeholder="Enter blood pressure"
              />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-3">Assessment Items</h3>
            <div className="text-xs text-slate-500 mb-3 bg-slate-50 border rounded p-2">
              <strong>Scoring:</strong> 4 = Independent &amp; safe · 3 = Mild difficulty · 2 = Moderate/needs support · 1 = Maximal assist · 0 = Unable
            </div>
            <div className="space-y-3">
              {[
                {
                  label: "Sitting to standing",
                  instructions: "Ask child to stand from a standard chair. Observe whether they use hands for support.",
                  criteria: ["4 – Stands without using hands, stabilises independently", "3 – Stands using hands, stabilises independently", "2 – Stands using hands after several attempts", "1 – Needs minimal assistance to stand or stabilise", "0 – Needs moderate/maximal assistance to stand"]
                },
                {
                  label: "Standing to sitting",
                  instructions: "Ask child to sit down in the chair. Observe control of the lowering movement.",
                  criteria: ["4 – Sits safely with minimal use of hands", "3 – Controls descent using hands", "2 – Uses back of legs against chair to control descent", "1 – Sits independently but uncontrolled descent", "0 – Needs assistance to sit"]
                },
                {
                  label: "Transfers",
                  instructions: "Place two chairs side-by-side (or chair + treatment table). Ask child to move from one to the other in both directions.",
                  criteria: ["4 – Transfers safely with minor hand use", "3 – Transfers safely but requires hands", "2 – Transfers with verbal cueing and/or supervision", "1 – Needs one person assistance", "0 – Needs two people to assist/supervise"]
                },
                {
                  label: "Standing unsupported",
                  instructions: "Ask child to stand still without holding anything for 1 minute (30 sec for age <5). Stand close for safety.",
                  criteria: ["4 – Stands safely for 1 minute", "3 – Stands 1 minute with supervision", "2 – Stands 30 seconds unsupported", "1 – Needs several attempts; stands 15 seconds", "0 – Unable to stand 10 seconds without support"]
                },
                {
                  label: "Sitting unsupported",
                  instructions: "Ask child to sit on chair (no back support, feet on floor) with arms folded for 1 minute.",
                  criteria: ["4 – Sits safely and securely for 1 minute", "3 – Sits 1 minute with supervision", "2 – Sits 30 seconds", "1 – Sits 10 seconds", "0 – Unable to sit without support for 10 seconds"]
                },
                {
                  label: "Standing with eyes closed",
                  instructions: "Ask child to close eyes and stand still for 10 seconds. Stand nearby for safety.",
                  criteria: ["4 – Stands 10 seconds safely", "3 – Stands 10 seconds with supervision", "2 – Stands 3 seconds", "1 – Unable to keep eyes closed 3 seconds but stays stable", "0 – Needs help to prevent falling"]
                },
                {
                  label: "Standing with feet together",
                  instructions: "Ask child to place feet together and stand without holding onto anything for 1 minute.",
                  criteria: ["4 – Places feet together independently and holds 1 minute", "3 – Places feet together and holds 1 minute with supervision", "2 – Places feet together and holds 30 seconds", "1 – Needs help to attain position but holds 15 seconds", "0 – Needs help to attain position and unable to hold for 15 seconds"]
                },
                {
                  label: "Standing with one foot in front",
                  instructions: "Demonstrate tandem stance (heel-to-toe). Ask child to place one foot directly in front of the other and hold for 30 seconds.",
                  criteria: ["4 – Places foot independently (tandem) and holds 30 seconds", "3 – Places foot independently and holds 15 seconds", "2 – Takes small step independently and holds 30 seconds", "1 – Needs help to step but holds 15 seconds", "0 – Loses balance while stepping or standing"]
                },
                {
                  label: "Standing on one foot",
                  instructions: "Ask child to lift one foot off the ground without holding onto anything and hold for as long as possible (max 10 seconds). Test each side.",
                  criteria: ["4 – Lifts leg independently and holds ≥10 seconds", "3 – Lifts leg independently and holds 5–9 seconds", "2 – Lifts leg independently and holds ≥3 seconds", "1 – Attempts to lift leg but cannot hold 3 seconds; remains standing", "0 – Unable to attempt or needs support to prevent falling"]
                },
                {
                  label: "Turning 360 degrees",
                  instructions: "Ask child to turn all the way around in a full circle, pause, then turn in the other direction.",
                  criteria: ["4 – Turns 360° safely within 4 seconds each side", "3 – Turns 360° safely one side only within 4 seconds", "2 – Turns 360° safely but slowly (>4 seconds)", "1 – Needs close supervision or verbal cueing", "0 – Needs assistance while turning"]
                },
                {
                  label: "Turning to look behind",
                  instructions: "Ask child to look behind over each shoulder by turning their head/trunk. Place an object or person behind them to encourage full rotation.",
                  criteria: ["4 – Looks behind from both sides; weight shifts well", "3 – Looks behind from one side only; less weight shift", "2 – Turns sideways only but maintains balance", "1 – Needs supervision when turning", "0 – Needs assistance to prevent loss of balance or falling"]
                },
                {
                  label: "Retrieving object from floor",
                  instructions: "Place a small object (e.g., shoe, beanbag) on the floor in front of the child's feet. Ask them to pick it up.",
                  criteria: ["4 – Retrieves object safely and easily", "3 – Retrieves object but needs supervision", "2 – Unable to retrieve but reaches 2–5 cm from object and keeps balance", "1 – Unable to retrieve; needs supervision while trying", "0 – Unable to attempt or needs assistance to prevent falling"]
                },
                {
                  label: "Placing alternate foot on stool",
                  instructions: "Ask child to place each foot alternately on a step stool (8 inches high). Complete 8 total touches (4 each foot). Time the task.",
                  criteria: ["4 – Stands independently and completes 8 steps within 20 seconds", "3 – Stands independently and completes 8 steps in >20 seconds", "2 – Completes 4 steps without aids with supervision", "1 – Completes >2 steps; needs minimal assistance", "0 – Needs assistance to prevent falling or unable to try"]
                },
                {
                  label: "Reaching forward with outstretched arm",
                  instructions: "Ask child to raise arm to 90° and reach forward as far as possible without stepping. Measure distance from fingertip at start vs end.",
                  criteria: ["4 – Reaches forward confidently >25 cm", "3 – Reaches >12 cm safely", "2 – Reaches >5 cm safely", "1 – Reaches forward but needs supervision", "0 – Loses balance or requires external support"]
                },
              ].map((item, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-3 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800 text-sm">{index + 1}. {item.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5 mb-2">{item.instructions}</p>
                      <div className="space-y-0.5">
                        {item.criteria.map((c, ci) => (
                          <button
                            key={ci}
                            onClick={() => handleScoreChange(index, 4 - ci)}
                            className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${
                              scores[index] === 4 - ci
                                ? "bg-purple-600 text-white font-semibold"
                                : "bg-slate-50 text-slate-700 hover:bg-purple-50 hover:text-purple-800"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-center">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold border-2 ${
                        scores[index] === 4 ? "bg-green-100 border-green-400 text-green-700" :
                        scores[index] === 3 ? "bg-lime-100 border-lime-400 text-lime-700" :
                        scores[index] === 2 ? "bg-yellow-100 border-yellow-400 text-yellow-700" :
                        scores[index] === 1 ? "bg-orange-100 border-orange-400 text-orange-700" :
                        "bg-red-100 border-red-400 text-red-700"
                      }`}>
                        {scores[index]}
                      </div>
                      <span className="text-xs text-slate-400 mt-1">/ 4</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="notes">Clinical Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observations: balance strategy, compensations, fatigue, behavior during assessment, safety concerns, home environment setup..."
              rows={4}
            />
          </div>
          </CardContent>
          </Card>

          {/* Interpretation */}
          {scores.some(s => s !== null) && (
          <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
          <CardHeader>
            <CardTitle className="text-lg">Result Interpretation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-2">
              <p className="font-semibold text-slate-900">Total Score: <span className="text-2xl font-bold text-purple-600">{scores.reduce((a, b) => a + b, 0)}/56</span></p>
              {(() => {
                const total = scores.reduce((a, b) => a + b, 0);
                if (total >= 46) return (
                  <div className="p-3 rounded-lg bg-green-100 border border-green-300">
                    <p className="text-green-800 font-semibold">✓ Low Fall Risk</p>
                    <p className="text-xs text-green-700 mt-1">Good balance; safe for most activities. Monitor periodically.</p>
                  </div>
                );
                if (total >= 31) return (
                  <div className="p-3 rounded-lg bg-yellow-100 border border-yellow-300">
                    <p className="text-yellow-800 font-semibold">⚠ Moderate Fall Risk</p>
                    <p className="text-xs text-yellow-700 mt-1">Balance training and environmental safety recommended.</p>
                  </div>
                );
                return (
                  <div className="p-3 rounded-lg bg-red-100 border border-red-300">
                    <p className="text-red-800 font-semibold">⛔ High Fall Risk</p>
                    <p className="text-xs text-red-700 mt-1">Intensive therapy, supervision, and assistive devices recommended.</p>
                  </div>
                );
              })()}
            </div>
          </CardContent>
          </Card>
          )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-slate-50 flex justify-between items-center sticky bottom-0">
          <Button variant="outline" onClick={handleClose} className="flex items-center space-x-2">
           <X size={16} />
           <span>Close</span>
          </Button>
          <div className="flex space-x-2">
           <Button onClick={handleSave} className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700">
             <Save size={16} />
             <span>Save Assessment</span>
           </Button>
          </div>
          </div>
          </div>
          </div>
          );
}