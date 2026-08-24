import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Save, X, ChevronDown, ChevronUp, Info, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";
import { PROM_NEURO_FMA_SECTIONS as SECTIONS } from '@/lib/clinical/scorers/extrasPromNeuro';


export default function FuglMeyerAssessmentFMARunner({ client, onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");
  const [openSections, setOpenSections] = useState({ upper_extremity: true });
  const [showInfo, setShowInfo] = useState(true);

  const handleScore = (sectionKey, itemIndex, value) => {
    setScores(prev => ({
      ...prev,
      [`${sectionKey}_${itemIndex}`]: value,
    }));
  };

  const getSectionScore = (section) => {
    return section.items.reduce((sum, _, i) => {
      const v = scores[`${section.key}_${i}`];
      return sum + (v !== undefined ? v : 0);
    }, 0);
  };

  const getTotalScore = () => SECTIONS.reduce((sum, s) => sum + getSectionScore(s), 0);
  const getMaxTotal = () => SECTIONS.reduce((sum, s) => sum + s.maxScore, 0);

  const handleSave = () => {
    const totalScore = getTotalScore();
    const sectionScores = {};
    SECTIONS.forEach(s => { sectionScores[s.key] = getSectionScore(s); });

    const soapLines = SECTIONS.map(s => {
      const itemLines = s.items.map((item, i) => {
        const v = scores[`${s.key}_${i}`];
        return `    • ${item}: ${v !== undefined ? v : 'N/A'}/2`;
      }).join("\n");
      return `  ${s.label}: ${sectionScores[s.key]}/${s.maxScore}\n${itemLines}`;
    }).join("\n\n");

    const soap_text = `Fugl-Meyer Assessment (FMA) Results:\n\nTotal Score: ${totalScore}/${getMaxTotal()}\n\nSection Breakdown:\n${soapLines}`;

    onSave({
      status: "completed",
      result_value: totalScore,
      notes,
      assessment_date: todayLocal(),
      additional_data: {
        measurement_type: "performance",
        soap_text,
        item_scores: scores,
        ...sectionScores,
        max_total: getMaxTotal(),
      },
    });
    toast.success("Assessment saved successfully.");
  };

  const toggleSection = (key) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const totalScore = getTotalScore();
  const maxTotal = getMaxTotal();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Fugl-Meyer Assessment (FMA)</h2>
            <p className="text-sm text-slate-500">Score each item: 0 = cannot perform, 1 = partially performs, 2 = performs fully</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="px-6 py-4 bg-blue-50 border-b flex items-center justify-between">
          <span className="font-semibold text-blue-800">Total Score</span>
          <span className="text-2xl font-bold text-blue-700">{totalScore} / {maxTotal}</span>
        </div>

        {/* Clinician Info Panel */}
        <div className="px-6 pt-4">
          <button
            onClick={() => setShowInfo(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors mb-2"
          >
            <div className="flex items-center gap-2 text-indigo-800 font-semibold text-sm">
              <Info className="w-4 h-4" /> Clinician Information &amp; References
            </div>
            {showInfo ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4 text-indigo-600" />}
          </button>

          {showInfo && (
            <Card className="border-indigo-200 mb-4">
              <CardContent className="pt-4 space-y-4 text-sm">
                {/* Purpose */}
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Purpose</p>
                  <p className="text-slate-600 text-xs">The Fugl-Meyer Assessment (FMA) is a stroke-specific performance-based impairment index designed to assess motor function, sensation, balance, joint range of motion, and joint pain in patients with post-stroke hemiplegia. It is widely used in clinical settings and research as a gold standard outcome measure for stroke recovery.</p>
                </div>

                {/* Scoring */}
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Scoring Guide</p>
                  <div className="grid grid-cols-3 gap-2 text-xs text-center">
                    <div className="bg-red-50 border border-red-200 rounded p-2">
                      <p className="font-bold text-red-700 text-base">0</p>
                      <p className="text-red-800">Cannot perform</p>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                      <p className="font-bold text-yellow-700 text-base">1</p>
                      <p className="text-yellow-800">Partially performs</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded p-2">
                      <p className="font-bold text-green-700 text-base">2</p>
                      <p className="text-green-800">Performs fully</p>
                    </div>
                  </div>
                </div>

                {/* Interpretation */}
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Motor Score Interpretation (UE + LE, max 100)</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between bg-red-50 px-3 py-1.5 rounded"><span className="font-medium text-red-800">&lt; 50</span><span className="text-red-700">Severe impairment</span></div>
                    <div className="flex justify-between bg-orange-50 px-3 py-1.5 rounded"><span className="font-medium text-orange-800">50–84</span><span className="text-orange-700">Marked impairment</span></div>
                    <div className="flex justify-between bg-yellow-50 px-3 py-1.5 rounded"><span className="font-medium text-yellow-800">85–95</span><span className="text-yellow-700">Moderate impairment</span></div>
                    <div className="flex justify-between bg-green-50 px-3 py-1.5 rounded"><span className="font-medium text-green-800">96–99</span><span className="text-green-700">Slight impairment</span></div>
                    <div className="flex justify-between bg-emerald-50 px-3 py-1.5 rounded"><span className="font-medium text-emerald-800">100</span><span className="text-emerald-700">Normal motor function</span></div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">MCID: 5.25–9.25 points (upper extremity). Sullivan et al., 2011.</p>
                </div>

                {/* Reliability */}
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Psychometric Properties</p>
                  <ul className="text-xs text-slate-600 list-disc list-inside space-y-0.5">
                    <li>Excellent inter-rater reliability (ICC 0.97–0.99)</li>
                    <li>Excellent test-retest reliability (ICC 0.95–0.99)</li>
                    <li>Strong concurrent validity with Barthel Index and motor scales</li>
                    <li>Sensitive to change across the full spectrum of stroke severity</li>
                  </ul>
                </div>

                {/* References */}
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Key References</p>
                  <div className="text-xs text-slate-600 space-y-1.5">
                    <p><strong>Fugl-Meyer AR, Jääskö L, Leyman I, Olsson S, Steglind S.</strong> (1975). The post-stroke hemiplegic patient: a method for evaluation of physical performance. <em>Scandinavian Journal of Rehabilitation Medicine</em>, 7(1), 13–31.</p>
                    <p><strong>Gladstone DJ, Danells CJ, Black SE.</strong> (2002). The Fugl-Meyer Assessment of Motor Recovery after Stroke: A Critical Review of Its Measurement Properties. <em>Neurorehabilitation and Neural Repair</em>, 16(3), 232–240.</p>
                    <p><strong>Sullivan KJ et al.</strong> (2011). Fugl-Meyer Assessment of Sensorimotor Function After Stroke. <em>Physical Therapy</em>, 91(8), 1113–1125.</p>
                  </div>
                  <button
                    onClick={() => window.open('https://strokengine.ca/en/assessments/fugl-meyer-assessment-of-sensorimotor-recovery-after-stroke-fma/', '_blank')}
                    className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    <ExternalLink className="w-3 h-3" /> StrokEngine — FMA Resource
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="px-6 pb-4 space-y-4">
          {SECTIONS.map(section => {

            const sectionScore = getSectionScore(section);
            const isOpen = openSections[section.key];
            return (
              <div key={section.key} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSection(section.key)}
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    <span className="font-semibold text-slate-800">{section.label}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-600 bg-white border rounded-full px-3 py-0.5">
                    {sectionScore} / {section.maxScore}
                  </span>
                </button>
                {isOpen && (
                  <div className="divide-y">
                    {section.items.map((item, i) => {
                      const val = scores[`${section.key}_${i}`];
                      return (
                        <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
                          <span className="text-sm text-slate-700 flex-1">{item}</span>
                          <div className="flex gap-2">
                            {[0, 1, 2].map(v => (
                              <button
                                key={v}
                                onClick={() => handleScore(section.key, i, v)}
                                className={`w-9 h-9 rounded-full text-sm font-semibold border-2 transition-colors ${
                                  val === v
                                    ? v === 0
                                      ? "bg-red-500 border-red-500 text-white"
                                      : v === 1
                                      ? "bg-yellow-400 border-yellow-400 text-white"
                                      : "bg-green-500 border-green-500 text-white"
                                    : "border-slate-200 text-slate-500 hover:border-slate-400"
                                }`}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div>
            <Label className="mb-1 block">Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional observations..."
              rows={3}
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Cancel</Button>
          <Button onClick={handleSave}><Save className="w-4 h-4 mr-2" />Save Assessment</Button>
        </div>
      </div>
    </div>
  );
}
