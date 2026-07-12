import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, Info, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const GRADES = [
  { grade: 0, label: "No Breathlessness", desc: "No breathlessness except on strenuous exercise.", icon: "🟢" },
  { grade: 1, label: "Slight Breathlessness", desc: "Breathlessness only when hurrying on the level or walking up a slight hill.", icon: "🟡" },
  { grade: 2, label: "Moderate Breathlessness", desc: "Walks slower than most people on the level, or has to stop for breath when walking at their own pace on the level.", icon: "🟠" },
  { grade: 3, label: "Severe Breathlessness", desc: "Stops for breath after walking about 100 m or after a few minutes on the level.", icon: "🔴" },
  { grade: 4, label: "Very Severe Breathlessness", desc: "Too breathless to leave the house, or breathless when dressing or undressing.", icon: "🔴" },
];

export default function MedicalResearchCouncilMRCDyspneaScaleRunner({ client, onSave, onClose }) {
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");
  const [expandedSection, setExpandedSection] = useState("info");

  const grade = GRADES.find(g => g.grade === selected);

  const getInterp = (g) => {
    if (g === 0) return "No significant breathlessness";
    if (g === 1) return "Mild dyspnoea — minimal impact on daily function";
    if (g === 2) return "Moderate dyspnoea — some functional limitation";
    if (g === 3) return "Severe dyspnoea — significant functional limitation";
    return "Very severe dyspnoea — major ADL limitation, housebound";
  };

  const handleSave = () => {
    if (selected === null) { toast.error("Select a grade"); return; }
    const clinicalSignificance = selected <= 1 ? "Minimal functional limitation" : selected === 2 ? "Moderate functional limitation — activity modification recommended" : "Severe dyspnoea — consider pulmonary referral and rehabilitation";
    const soap = `• MRC Dyspnoea Scale
  Grade: ${selected}/4 — ${grade.label}
  Description: ${grade.desc}
  Interpretation: ${getInterp(selected)}
  Clinical Significance: ${clinicalSignificance}${notes ? `
  Clinician Notes: ${notes}` : ""}
  Assessment: Grade ${selected} indicates ${selected >= 2 ? "significant breathlessness affecting functional capacity." : "minimal dyspnoea with preserved exercise tolerance."}
  Plan: ${selected >= 2 ? "Monitor dyspnoea trends, consider pulmonary physiology testing and specialist referral if worsening." : "Continue current activity level; reassess at next review."}
  Evidence: mMRC (Modified MRC) ≥2 is GOLD COPD criterion for significant dyspnoea; correlates with 6MWT, quality of life, and mortality risk.
  Reference: Bestall JC et al. (1999). Thorax, 54(7):581–586. GOLD Guidelines (2024).`;
    onSave({ status: "completed", result_value: selected, notes, assessment_date: todayLocal(), additional_data: { soap_text: soap, measurement_type: "questionnaire", mrc_grade: selected, grade_label: grade.label } });
    toast.success("Assessment saved to SOAP notes.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-sky-50 to-blue-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">MRC Dyspnoea Scale</h2><p className="text-slate-500 text-sm mt-0.5">Medical Research Council breathlessness grading</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <button
            className="w-full flex justify-between items-center px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg font-semibold text-blue-900 hover:bg-blue-100 transition-colors"
            onClick={() => setExpandedSection(expandedSection === "info" ? null : "info")}
          >
            <span>📋 Clinical Instructions & Evidence</span>
            {expandedSection === "info" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expandedSection === "info" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-3">
              <div>
                <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Administration Instructions</p>
                <p className="mt-1">Patient self-reports or clinician reads each description. Select the <strong>highest grade that applies</strong>. Takes &lt;1 minute. Based on functional impact of breathlessness, not lung function tests.</p>
                <p className="italic mt-1">"Please select the description that best describes how your breathing problem affects your activities."</p>
              </div>

              <div>
                <p className="font-semibold">Clinical Context: Dyspnoea in COPD & Respiratory Disease</p>
                <p>The MRC Dyspnoea Scale (and its modified version, mMRC) is a simple 5-grade assessment of dyspnoea-related functional limitation. Unlike lung function tests (FEV1, DLCO), it captures the patient's subjective experience of breathlessness during daily activities. The <strong>mMRC ≥2</strong> is a key criterion in GOLD COPD staging and predicts quality of life, exercise tolerance, and mortality risk.</p>
              </div>

              <div>
                <p className="font-semibold">Clinical Interpretation Rules</p>
                <ul className="text-xs list-disc list-inside space-y-1 mt-1">
                  <li><strong>Grade 0–1:</strong> Minimal dyspnoea; preserved activity tolerance; reassess periodically.</li>
                  <li><strong>Grade 2:</strong> Threshold for "significant dyspnoea" in clinical guidelines; consider pulmonary function testing, exercise rehabilitation, and oxygen assessment.</li>
                  <li><strong>Grade 3–4:</strong> Severe dyspnoea with major ADL limitation; urgent pulmonary assessment, specialist referral, and management optimization (inhalers, oxygen, palliative care) indicated.</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold">Relationship to Other Measures</p>
                <p className="text-xs">mMRC correlates with 6-minute walk distance (6MWD), St. George's Respiratory Questionnaire (SGRQ) quality-of-life score, FEV1, and mortality in COPD. Use alongside spirometry, exercise testing, and dyspnoea-related quality of life scales (CAT, SGRQ) for comprehensive assessment.</p>
              </div>

              <div>
                <p className="font-semibold">Evidence Base & External Resources</p>
                <div className="space-y-2 text-xs mt-2">
                  <p>
                    <strong>Original MRC Scale (1960):</strong> Medical Research Council. <em>Standardised questionnaires on respiratory symptoms.</em> British Medical Journal, 2, 1665.
                  </p>
                  <p>
                    <strong>Validation Study (mMRC):</strong> Bestall JC et al. (1999). <em>Usefulness of the MRC dyspnoea scale as a measure of disability in patients with chronic obstructive pulmonary disease.</em> <em>Thorax, 54</em>(7):581–586.{" "}
                    <a href="https://thorax.bmj.com/content/54/7/581" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                      DOI <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                  <p>
                    <strong>GOLD COPD Guidelines (2024):</strong> Global Strategy for the Diagnosis, Management, and Prevention of Chronic Obstructive Pulmonary Disease.{" "}
                    <a href="https://goldcopd.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                      goldcopd.org <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                  <p>
                    <strong>COPD Assessment Test (CAT):</strong> Complementary quality-of-life tool. See{" "}
                    <a href="https://www.catstest.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                      www.catstest.com <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                  <p>
                    <strong>Thorax Journal (BMJ):</strong> Peer-reviewed respiratory research.{" "}
                    <a href="https://thorax.bmj.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                      thorax.bmj.com <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                  <p>
                    <strong>Australian Asthma Handbook:</strong> Evidence-based asthma and COPD management in Australia.{" "}
                    <a href="https://www.asthmahandbook.org.au" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                      www.asthmahandbook.org.au <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>
              </div>

              <div>
                <p className="font-semibold">Contraindications & Precautions</p>
                <ul className="text-xs list-disc list-inside space-y-1 mt-1">
                  <li>Not suitable as sole diagnostic tool; always combine with clinical history, spirometry, and imaging.</li>
                  <li>Acute exacerbations, pneumonia, or unstable cardiac/respiratory status: defer assessment until stabilized.</li>
                  <li>Cognitive impairment: may affect self-reporting accuracy; consider caregiver input.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 Grade Interpretation</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Grade</th><th className="p-2 text-left">Clinical Significance</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">0</td><td className="p-2 text-green-700">Minimal impact on function</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">1</td><td className="p-2 text-teal-700">Mild dyspnoea — activity tolerated</td></tr>
                  <tr className="border-t"><td className="p-2">2</td><td className="p-2 text-yellow-700">Moderate dyspnoea — functional limitation begins</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">3</td><td className="p-2 text-orange-700">Severe — significant ADL limitation</td></tr>
                  <tr className="border-t"><td className="p-2">4</td><td className="p-2 text-red-700">Very severe — housebound, breathless at rest</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">mMRC ≥2 = significant dyspnoea in GOLD COPD guidelines. Correlates with 6MWT performance and quality of life. Source: Bestall et al. (1999).</p>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Medical Research Council. (1960). Standardised questionnaires on respiratory symptoms. <em>British Medical Journal, 2</em>, 1665.</p>
            <p>Bestall JC et al. (1999). Usefulness of the MRC dyspnoea scale as a measure of disability in patients with chronic obstructive pulmonary disease. <em>Thorax, 54</em>(7), 581–586.</p>
          </div>

          {GRADES.map(g => (
            <button key={g.grade} type="button" onClick={() => setSelected(g.grade)}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all ${selected === g.grade ? "border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200" : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300"}`}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center font-bold text-slate-700 shrink-0">{g.grade}</div>
                <div>
                  <p className="font-semibold">{g.icon} {g.label}</p>
                  <p className="text-sm text-slate-600 mt-0.5">{g.desc}</p>
                </div>
              </div>
            </button>
          ))}

          {selected !== null && (
            <div className={`border-2 rounded-xl p-4 ${selected <= 1 ? "bg-green-50 border-green-300 text-green-800" : selected === 2 ? "bg-yellow-50 border-yellow-300 text-yellow-800" : "bg-red-50 border-red-300 text-red-800"}`}>
              <p className="font-semibold text-lg">Grade {selected} — {getInterp(selected)}</p>
            </div>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Onset, triggers, impact on work/ADL, associated symptoms..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={selected === null} className="bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}