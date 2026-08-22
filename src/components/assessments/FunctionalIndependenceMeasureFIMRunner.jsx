import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, ChevronDown, ChevronUp, Info, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { saveAssessmentToSOAP } from "./TestRunnerSOAPHelper";
import { todayLocal } from "@/lib/localDate";
import {
  FIM_ITEMS,
  FIM_SCORE_LEVELS,
  FIM_SECTIONS,
  validateAndScoreFim,
} from "@/lib/clinical/scorers/standaloneAndFim";

const ALL_ITEMS = FIM_ITEMS;

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
      const assessmentDate = todayLocal();
      const updateData = validateAndScoreFim({ scores, notes }, {
        assessmentName: assessment?.name || 'Functional Independence Measure (FIM)',
        assessmentDate,
      });

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
        const objectiveText = `Assessment completed on ${new Date().toLocaleDateString('en-AU')}:\n\n${updateData.additional_data.soap_text}`;
        await saveAssessmentToSOAP({
          clientToUse: client,
          appointmentId: clientAssessment?.appointment_id || null,
          objectiveText,
          assessmentToUpdateId: savedAssessmentId,
          updateData,
          assessment,
        });
      }

      toast.success("Assessment saved successfully.");
      if (onSave) onSave(updateData);
      onClose();
    } catch (err) {
      console.error("FIM save error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save assessment.");
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
                            {FIM_SCORE_LEVELS.map(level => (
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
