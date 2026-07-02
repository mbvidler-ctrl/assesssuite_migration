import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, ChevronDown, ChevronUp } from "lucide-react";

// WPI body regions
const WPI_REGIONS = [
  "Left jaw", "Right jaw",
  "Left shoulder", "Right shoulder",
  "Left upper arm", "Right upper arm",
  "Left lower arm", "Right lower arm",
  "Left hip (buttock/trochanter)", "Right hip (buttock/trochanter)",
  "Left upper leg", "Right upper leg",
  "Left lower leg", "Right lower leg",
  "Left chest", "Right chest",
  "Upper back", "Lower back",
  "Abdomen", "Neck",
];

const SSS_ITEMS = [
  { key: "fatigue", label: "Fatigue" },
  { key: "waking_unrefreshed", label: "Waking unrefreshed" },
  { key: "cognitive_symptoms", label: "Cognitive symptoms" },
];

const SOMATIC_OPTIONS = [
  { value: 0, label: "0 â€” No symptoms" },
  { value: 1, label: "1 â€” Few symptoms, generally mild" },
  { value: 2, label: "2 â€” Moderate number of symptoms" },
  { value: 3, label: "3 â€” Many symptoms, severe" },
];

function getInterpretation(wpi, sss) {
  const total = wpi + sss;
  // ACR 2010/2011 fibromyalgia diagnostic criteria
  const meetsACR =
    (wpi >= 7 && sss >= 5) || (wpi >= 3 && wpi <= 6 && sss >= 9);
  return { total, meetsACR };
}

export default function WidespreadPainIndexWPIandSymptomSeverityScaleSSSRunner({ client, onSave, onClose }) {
  const [wpiRegions, setWpiRegions] = useState({});
  const [sssScores, setSssScores] = useState({ fatigue: null, waking_unrefreshed: null, cognitive_symptoms: null });
  const [somaticSymptoms, setSomaticSymptoms] = useState(null);
  const [notes, setNotes] = useState("");
  const [showInstructions, setShowInstructions] = useState(true);

  const wpiScore = Object.values(wpiRegions).filter(Boolean).length;
  const sssScore = [sssScores.fatigue, sssScores.waking_unrefreshed, sssScores.cognitive_symptoms, somaticSymptoms]
    .filter(v => v !== null).reduce((a, b) => a + b, 0);
  const { total, meetsACR } = getInterpretation(wpiScore, sssScore);

  const toggleRegion = (region) => {
    setWpiRegions(prev => ({ ...prev, [region]: !prev[region] }));
  };

  const handleSave = () => {
    const soapText = [
      `â€¢ WPI / SSS â€” Widespread Pain Index & Symptom Severity Scale`,
      `  WPI Score: ${wpiScore}/19`,
      `  SSS Score: ${sssScore}/12`,
      `  Total: ${total}/31`,
      `  ACR 2010 Fibromyalgia Criteria: ${meetsACR ? "MET â€” fibromyalgia criteria satisfied" : "Not met"}`,
      `  Pain regions: ${Object.keys(wpiRegions).filter(k => wpiRegions[k]).join(", ") || "None"}`,
      notes ? `  Notes: ${notes}` : "",
    ].filter(Boolean).join("\n");

    onSave({
      result_value: total,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
      additional_data: {
        soap_text: soapText,
        wpi_score: wpiScore,
        sss_score: sssScore,
        total_score: total,
        meets_acr_criteria: meetsACR,
        pain_regions: Object.keys(wpiRegions).filter(k => wpiRegions[k]),
        sss_fatigue: sssScores.fatigue,
        sss_waking: sssScores.waking_unrefreshed,
        sss_cognitive: sssScores.cognitive_symptoms,
        sss_somatic: somaticSymptoms,
      }
    });
  };

  return (
    <div className="space-y-5 p-1">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">WPI / SSS</h2>
          <p className="text-sm text-slate-500">Widespread Pain Index &amp; Symptom Severity Scale â€” ACR 2010 Fibromyalgia Criteria</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {/* Instructions */}
      <div className="border border-blue-200 rounded-lg overflow-hidden">
        <button onClick={() => setShowInstructions(v => !v)}
          className="w-full flex justify-between items-center bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          ðŸ“‹ Clinician Instructions &amp; Diagnostic Criteria
          {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showInstructions && (
          <div className="bg-white p-4 text-sm space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
                <p className="font-bold text-blue-800 mb-1">WPI (0â€“19)</p>
                <p className="text-blue-700">Ask client to indicate body regions where they have experienced pain in the last week. One point per region. Max = 19.</p>
                <p className="italic text-blue-600 mt-1">"In how many of these areas have you had pain or tenderness over the last week?"</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs">
                <p className="font-bold text-orange-800 mb-1">SSS (0â€“12)</p>
                <p className="text-orange-700">Rate severity of fatigue, waking unrefreshed, and cognitive symptoms (0â€“3 each). Add somatic symptom burden (0â€“3). Max = 12.</p>
                <p className="text-orange-700 mt-1"><strong>0</strong> = No problem | <strong>1</strong> = Mild | <strong>2</strong> = Moderate | <strong>3</strong> = Severe</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
              <p className="font-semibold text-amber-800">ACR 2010 Fibromyalgia Diagnostic Criteria</p>
              <p className="text-amber-700 mt-1">Fibromyalgia is diagnosed when:</p>
              <p className="text-amber-700">â€¢ WPI â‰¥ 7 AND SSS â‰¥ 5, OR</p>
              <p className="text-amber-700">â€¢ WPI 3â€“6 AND SSS â‰¥ 9</p>
              <p className="text-amber-700 mt-1">Symptoms must be present for â‰¥ 3 months and not better explained by another diagnosis.</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs">
              <p className="font-semibold text-purple-800">âš ï¸ Scope of Practice Note</p>
              <p className="text-purple-700 mt-1">In many jurisdictions, Exercise Physiologists and allied health professionals are <strong>not authorised to diagnose</strong> fibromyalgia. This tool should be used to <strong>validate and support</strong> an existing medical diagnosis, monitor symptom severity over time, and inform exercise prescription â€” not as a standalone diagnostic instrument.</p>
              <p className="text-purple-700 mt-1">If criteria are met and no diagnosis exists, refer to the client's GP or rheumatologist for formal assessment.</p>
            </div>
          </div>
        )}
      </div>

      {/* WPI Body Map */}
      <div className="border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-slate-700 text-sm">Part 1: Widespread Pain Index (WPI)</p>
          <span className="text-2xl font-bold text-blue-600">{wpiScore}/19</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">Tick all areas where the client has experienced pain or tenderness in the last week:</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {WPI_REGIONS.map(region => (
            <button key={region} onClick={() => toggleRegion(region)}
              className={`text-left text-xs px-3 py-2 rounded-lg border transition-colors ${wpiRegions[region] ? "bg-blue-600 text-white border-blue-600 font-semibold" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}>
              {wpiRegions[region] ? "âœ“ " : ""}{region}
            </button>
          ))}
        </div>
      </div>

      {/* SSS */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-700 text-sm">Part 2: Symptom Severity Scale (SSS)</p>
          <span className="text-2xl font-bold text-orange-600">{sssScore}/12</span>
        </div>
        <p className="text-xs text-slate-500">Rate severity over the past week (0 = no problem, 3 = severe):</p>

        {SSS_ITEMS.map(item => (
          <div key={item.key}>
            <p className="text-sm font-medium text-slate-700 mb-2">{item.label}</p>
            <div className="flex gap-2 flex-wrap">
              {[0, 1, 2, 3].map(v => (
                <button key={v} onClick={() => setSssScores(s => ({ ...s, [item.key]: v }))}
                  className={`px-4 py-1.5 text-xs rounded-lg border font-medium ${sssScores[item.key] === v ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div>
          <p className="text-sm font-medium text-slate-700 mb-1">Somatic symptoms (headache, pain/cramps, weakness, IBS, etc.)</p>
          <div className="space-y-1">
            {SOMATIC_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setSomaticSymptoms(opt.value)}
                className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors ${somaticSymptoms === opt.value ? "bg-orange-600 text-white border-orange-600 font-semibold" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result */}
      {wpiScore > 0 || sssScore > 0 ? (
        <div className={`rounded-lg border px-4 py-4 ${meetsACR ? "bg-red-50 border-red-300" : "bg-slate-50 border-slate-300"}`}>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold text-slate-900">WPI: {wpiScore}/19 &nbsp;|&nbsp; SSS: {sssScore}/12 &nbsp;|&nbsp; Total: {total}/31</p>
              <p className={`text-sm font-semibold mt-1 ${meetsACR ? "text-red-700" : "text-slate-600"}`}>
                ACR 2010 Criteria: {meetsACR ? "âœ… MET â€” Fibromyalgia criteria satisfied" : "âŒ Not met"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div>
        <Label className="text-sm font-semibold text-slate-700">Clinical Notes</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="Pain distribution pattern, functional impact, mood, sleep quality, previous diagnoses..."
          className="mt-1 text-sm" />
      </div>

      {/* References */}
      <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">ðŸ“– References</p>
        <p>1. Wolfe F, Clauw DJ, Fitzcharles MA, et al. (2010). The American College of Rheumatology preliminary diagnostic criteria for fibromyalgia. <em>Arthritis Care &amp; Research</em>, 62(5), 600â€“610.</p>
        <p>2. Wolfe F, Clauw DJ, Fitzcharles MA, et al. (2011). Fibromyalgia criteria and severity scales for clinical and epidemiological studies. <em>Journal of Rheumatology</em>, 38(6), 1113â€“1122.</p>
        <p>3. Arnold LM, Bennett RM, Crofford LJ, et al. (2019). AAPT Diagnostic Criteria for Fibromyalgia. <em>Journal of Pain</em>, 20(6), 611â€“628.</p>
      </div>

      <div className="flex justify-between pt-2 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={wpiScore === 0 && sssScore === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white">Save Results</Button>
      </div>
    </div>
  );
}