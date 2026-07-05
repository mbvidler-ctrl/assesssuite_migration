import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, ChevronDown, ChevronUp, Info, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { saveAssessmentToSOAP } from "./TestRunnerSOAPHelper";

const SCORE_LEVELS = [
  { value: 7, label: "7 – Complete Independence", description: "Activity performed safely, without modification, equipment, or assistance, within reasonable time." },
  { value: 6, label: "6 – Modified Independence", description: "Requires an assistive device, takes more than reasonable time, or there are safety considerations." },
  { value: 5, label: "5 – Supervision/Setup", description: "Requires only standby supervision, cueing, or coaxing. No hands-on assistance. Helper sets up objects." },
  { value: 4, label: "4 – Minimal Assistance", description: "Helper provides hands-on assistance only (touching); person performs ≥75% of task effort." },
  { value: 3, label: "3 – Moderate Assistance", description: "Person performs 50–74% of task effort." },
  { value: 2, label: "2 – Maximal Assistance", description: "Person performs 25–49% of task effort." },
  { value: 1, label: "1 – Total Assistance", description: "Person performs <25% of task effort or activity cannot be done." },
];

const FIM_SECTIONS = [
  {
    category: "Self-Care",
    subscale: "motor",
    items: [
      { id: 0, label: "Eating", description: "Use of suitable utensils to bring food to mouth, chewing and swallowing." },
      { id: 1, label: "Grooming", description: "Oral care, hair combing, washing hands/face, shaving or makeup." },
      { id: 2, label: "Bathing", description: "Washing, rinsing, and drying the body from the neck down (excluding back)." },
      { id: 3, label: "Dressing – Upper Body", description: "Dressing and undressing above the waist, including prostheses or orthoses." },
      { id: 4, label: "Dressing – Lower Body", description: "Dressing and undressing below the waist, including prostheses or orthoses." },
      { id: 5, label: "Toileting", description: "Maintaining perineal hygiene and adjusting clothing before/after using toilet." },
    ],
  },
  {
    category: "Sphincter Control",
    subscale: "motor",
    items: [
      { id: 6, label: "Bladder Management", description: "Level of assistance needed to manage bladder safely; frequency of accidents." },
      { id: 7, label: "Bowel Management", description: "Level of assistance needed to manage bowel safely; frequency of accidents." },
    ],
  },
  {
    category: "Transfers",
    subscale: "motor",
    items: [
      { id: 8, label: "Transfer: Bed/Chair/Wheelchair", description: "Transferring to/from bed, chair, and wheelchair." },
      { id: 9, label: "Transfer: Toilet", description: "Getting on and off a toilet or commode." },
      { id: 10, label: "Transfer: Tub/Shower", description: "Getting into and out of a bathtub or shower." },
    ],
  },
  {
    category: "Locomotion",
    subscale: "motor",
    items: [
      { id: 11, label: "Walk / Wheelchair", description: "Walking on level surfaces, or propelling a wheelchair indoors for at least 50m." },
      { id: 12, label: "Stairs", description: "Going up and down 12–14 stairs." },
    ],
  },
  {
    category: "Communication",
    subscale: "cognitive",
    items: [
      { id: 13, label: "Comprehension", description: "Understanding verbal or non-verbal communication." },
      { id: 14, label: "Expression", description: "Expressing verbal or non-verbal language; clear meaningful communication." },
    ],
  },
  {
    category: "Social Cognition",
    subscale: "cognitive",
    items: [
      { id: 15, label: "Social Interaction", description: "Skills related to getting along and participating with others in therapeutic and social situations." },
      { id: 16, label: "Problem Solving", description: "Skills related to solving problems of daily living including safety and financial decisions." },
      { id: 17, label: "Memory", description: "Skills related to recognising people frequently encountered, remembering daily routines, and executing requests without reminders." },
    ],
  },
];

const ALL_ITEMS = FIM_SECTIONS.flatMap(s => s.items);

export default function FunctionalIndependenceMeasureFIMRunner({ client, assessment, clientAssessment, onSave, onClose }) {
  const [scores, setScores] = useState(Array(18).fill(null));
  const [expandedItem, setExpandedItem] = useState(0);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showInfo, setShowInfo] = useState(true);

  const motorScore = ALL_ITEMS.filter(i => {
    const section = FIM_SECTIONS.find(s => s.items.some(it => it.id === i.id));
    return section?.subscale === "motor";
  }).reduce((sum, i) => sum + (scores[i.id] ?? 0), 0);

  const cogScore = ALL_ITEMS.filter(i => {
    const section = FIM_SECTIONS.find(s => s.items.some(it => it.id === i.id));
    return section?.subscale === "cognitive";
  }).reduce((sum, i) => sum + (scores[i.id] ?? 0), 0);

  const totalScore = scores.reduce((sum, s) => sum + (s ?? 0), 0);
  const allScored = !scores.includes(null);

  const handleScore = (itemId, value) => {
    const ns = [...scores];
    ns[itemId] = value;
    setScores(ns);
    // Auto-advance
    if (itemId < 17) setExpandedItem(itemId + 1);
  };

  const handleSave = async () => {
    if (!allScored) {
      toast.error("Please score all 18 items before saving.");
      return;
    }
    setIsSaving(true);
    try {
      // Build detailed SOAP text with full item labels and score descriptions
      const sectionLines = FIM_SECTIONS.map(section => {
        const lines = section.items.map(item => {
          const score = scores[item.id];
          const levelLabel = SCORE_LEVELS.find(l => l.value === score)?.label || `${score}/7`;
          return `    ${item.label}: ${levelLabel}`;
        }).join('\n');
        return `  ${section.category} (${section.subscale}):\n${lines}`;
      }).join('\n\n');

      const soap_text = `Functional Independence Measure (FIM)\n\nTotal Score: ${totalScore}/126\nMotor Subscale: ${motorScore}/91\nCognitive Subscale: ${cogScore}/35\n\nIndividual Item Scores:\n${sectionLines}${notes ? `\n\nClinical Notes: ${notes}` : ''}`;

      const assessmentDate = new Date().toISOString().split("T")[0];
      const updateData = {
        status: "completed",
        result_value: totalScore,
        notes,
        assessment_date: assessmentDate,
        additional_data: {
          measurement_type: "fim",
          soap_text,
          motor_score: motorScore,
          cognitive_score: cogScore,
          total_score: totalScore,
          sections: FIM_SECTIONS.map(s => ({
            category: s.category,
            subscale: s.subscale,
            items: s.items.map(item => ({ name: item.label, score: scores[item.id] })),
          })),
        },
      };

      // Save to ClientAssessment if we have one, or create new
      let savedAssessmentId = clientAssessment?.id;
      if (savedAssessmentId) {
        await base44.entities.ClientAssessment.update(savedAssessmentId, updateData);
      } else if (client && assessment) {
        const newCA = await base44.entities.ClientAssessment.create({
          org_id: client.org_id,
          client_id: client.id,
          assessment_id: assessment.id,
          ...updateData,
        });
        savedAssessmentId = newCA.id;
      }

      // Save to SOAP note
      if (client) {
        const objectiveText = `Assessment completed on ${new Date().toLocaleDateString('en-AU')}:\n\n${soap_text}`;
        await saveAssessmentToSOAP({
          clientToUse: client,
          appointmentId: clientAssessment?.appointment_id || null,
          objectiveText,
          assessmentToUpdateId: savedAssessmentId,
          updateData,
        });
      }

      toast.success("Assessment saved successfully.");
      if (onSave) onSave(updateData);
      onClose();
    } catch (err) {
      console.error("FIM save error:", err);
      toast.error("Failed to save assessment.");
    } finally {
      setIsSaving(false);
    }
  };

  // Flat list index for expand tracking
  let flatIndex = 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Functional Independence Measure (FIM)</h2>
            <p className="text-sm text-blue-600 mt-0.5">Rate each item 1–7: 1 = total assistance → 7 = complete independence</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        {/* Score summary */}
        <div className="px-6 py-3 border-b bg-slate-50 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Motor</p>
            <p className="text-xl font-bold text-slate-800">{motorScore}<span className="text-sm font-normal text-slate-400">/91</span></p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Cognitive</p>
            <p className="text-xl font-bold text-slate-800">{cogScore}<span className="text-sm font-normal text-slate-400">/35</span></p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Total</p>
            <p className="text-xl font-bold text-blue-700">{totalScore}<span className="text-sm font-normal text-slate-400">/126</span></p>
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">

          {/* Clinician Info Panel */}
          <div className="border border-indigo-200 rounded-lg overflow-hidden">
            <button onClick={() => setShowInfo(v => !v)} className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 transition-colors">
              <span className="flex items-center gap-2 text-indigo-800 font-semibold text-sm"><Info className="w-4 h-4" />Clinician Information &amp; References</span>
              {showInfo ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4 text-indigo-600" />}
            </button>
            {showInfo && (
              <div className="px-4 py-4 space-y-4 text-sm bg-white">

                <div>
                  <p className="font-semibold text-slate-800 mb-1">Purpose</p>
                  <p className="text-xs text-slate-600">The Functional Independence Measure (FIM) is an 18-item clinician-rated scale that measures the level of assistance required by a person to perform activities of daily living (ADLs). It assesses both motor (13 items, max 91) and cognitive (5 items, max 35) domains. It is widely used in inpatient rehabilitation settings to track functional progress and determine care burden.</p>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-1">Administration Instructions</p>
                  <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
                    <li>Rate each item based on observed performance, not ability or potential</li>
                    <li>Score what the patient <em>actually does</em>, not what they could do with more effort</li>
                    <li>Consider a typical 3-day period (not just one observation) when possible</li>
                    <li>Use 1 = Total Assistance when the person performs &lt;25% of the task effort</li>
                    <li>Score sphincter items based on frequency of accidents and level of assistance needed</li>
                    <li>For locomotion, score whichever mode (walk or wheelchair) the patient primarily uses</li>
                    <li>All 18 items must be scored; no item may be left blank</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-1">Scoring Guide (1–7)</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex gap-2 bg-red-50 px-3 py-1.5 rounded"><span className="font-bold text-red-700 w-4">1</span><span className="text-red-800">Total Assistance — &lt;25% task effort by patient</span></div>
                    <div className="flex gap-2 bg-orange-50 px-3 py-1.5 rounded"><span className="font-bold text-orange-700 w-4">2</span><span className="text-orange-800">Maximal Assistance — 25–49% task effort</span></div>
                    <div className="flex gap-2 bg-amber-50 px-3 py-1.5 rounded"><span className="font-bold text-amber-700 w-4">3</span><span className="text-amber-800">Moderate Assistance — 50–74% task effort</span></div>
                    <div className="flex gap-2 bg-yellow-50 px-3 py-1.5 rounded"><span className="font-bold text-yellow-700 w-4">4</span><span className="text-yellow-800">Minimal Assistance — ≥75% task effort; helper touches only</span></div>
                    <div className="flex gap-2 bg-lime-50 px-3 py-1.5 rounded"><span className="font-bold text-lime-700 w-4">5</span><span className="text-lime-800">Supervision/Setup — standby assist, cueing, or setup only</span></div>
                    <div className="flex gap-2 bg-teal-50 px-3 py-1.5 rounded"><span className="font-bold text-teal-700 w-4">6</span><span className="text-teal-800">Modified Independence — assistive device, extra time, or safety concern</span></div>
                    <div className="flex gap-2 bg-green-50 px-3 py-1.5 rounded"><span className="font-bold text-green-700 w-4">7</span><span className="text-green-800">Complete Independence — safe, timely, no device or assistance</span></div>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-1">Total Score Interpretation (max 126)</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between bg-green-50 px-3 py-1.5 rounded"><span className="font-medium text-green-800">96–126</span><span className="text-green-700">Mild disability — minimal or no assistance needed</span></div>
                    <div className="flex justify-between bg-yellow-50 px-3 py-1.5 rounded"><span className="font-medium text-yellow-800">73–95</span><span className="text-yellow-700">Moderate disability — some assistance required</span></div>
                    <div className="flex justify-between bg-orange-50 px-3 py-1.5 rounded"><span className="font-medium text-orange-800">36–72</span><span className="text-orange-700">Severe disability — substantial assistance required</span></div>
                    <div className="flex justify-between bg-red-50 px-3 py-1.5 rounded"><span className="font-medium text-red-800">18–35</span><span className="text-red-700">Total dependence — complete assistance required</span></div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">MCID: 17–22 points (total); 13–17 points (motor subscale).</p>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-1">Psychometric Properties</p>
                  <ul className="text-xs text-slate-600 list-disc list-inside space-y-0.5">
                    <li>Excellent inter-rater reliability (ICC = 0.95–0.99)</li>
                    <li>Excellent internal consistency (Cronbach α = 0.93–0.95)</li>
                    <li>Strong predictive validity for discharge destination and length of stay</li>
                    <li>Rasch-validated; motor and cognitive subscales function as distinct constructs</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 mb-1">Key References</p>
                  <div className="text-xs text-slate-600 space-y-1.5">
                    <p><strong>Granger CV, Hamilton BB, Keith RA, Zielezny M, Sherwin FS.</strong> (1986). Advances in functional assessment for medical rehabilitation. <em>Topics in Geriatric Rehabilitation</em>, 1(3), 59–74.</p>
                    <p><strong>Linacre JM, Heinemann AW, Wright BD, Granger CV, Hamilton BB.</strong> (1994). The structure and stability of the Functional Independence Measure. <em>Archives of Physical Medicine and Rehabilitation</em>, 75(2), 127–132.</p>
                    <p><strong>Stineman MG et al.</strong> (1996). The Functional Independence Measure: tests of scaling assumptions, structure, and reliability across 20 diverse impairment categories. <em>Archives of Physical Medicine and Rehabilitation</em>, 77(11), 1101–1108.</p>
                  </div>
                  <button onClick={() => window.open('https://www.sralab.org/rehabilitation-measures/functional-independence-measure', '_blank')} className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    <ExternalLink className="w-3 h-3" /> Rehab Measures Database — FIM
                  </button>
                </div>
              </div>
            )}
          </div>

          {FIM_SECTIONS.map((section) => (
            <div key={section.category}>
              <div className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded mb-2 inline-block ${section.subscale === 'motor' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                {section.category} <span className="opacity-60">({section.subscale})</span>
              </div>
              <div className="space-y-2">
                {section.items.map((item) => {
                  const isOpen = expandedItem === item.id;
                  const score = scores[item.id];
                  return (
                    <div key={item.id} className="border rounded-lg overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                        onClick={() => setExpandedItem(isOpen ? null : item.id)}
                      >
                        <div className="flex items-center gap-3">
                          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                          <span className="font-medium text-slate-800 text-sm">{item.label}</span>
                        </div>
                        <span className={`text-sm font-semibold px-2 py-0.5 rounded-full border ${score !== null ? 'bg-white border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                          {score !== null ? `${score}/7` : '–'}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 pt-3 space-y-3">
                          <div className="bg-slate-50 rounded p-3 text-sm text-slate-600 italic">{item.description}</div>
                          <div className="space-y-2">
                            {SCORE_LEVELS.map(level => (
                              <button
                                key={level.value}
                                onClick={() => handleScore(item.id, level.value)}
                                className={`w-full text-left flex gap-3 items-start px-3 py-2.5 rounded-lg border-2 transition-colors ${
                                  score === level.value
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold border-2 mt-0.5 ${
                                  score === level.value ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 text-slate-600'
                                }`}>{level.value}</span>
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">{level.label}</p>
                                  <p className="text-xs text-slate-500 leading-snug">{level.description}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <Label className="block mb-1">Clinical Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional observations..." rows={3} />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-between">
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Cancel</Button>
          <Button onClick={handleSave} disabled={!allScored || isSaving}><Save className="w-4 h-4 mr-2" />{isSaving ? "Saving..." : "Save Assessment"}</Button>
        </div>
      </div>
    </div>
  );
}