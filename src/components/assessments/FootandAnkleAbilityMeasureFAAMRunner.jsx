import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, X, Info, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const ADL_ITEMS = [
  "Standing",
  "Walking on even ground",
  "Walking on even ground without shoes",
  "Walking up hills",
  "Walking down hills",
  "Going up stairs",
  "Going down stairs",
  "Walking on uneven ground",
  "Stepping up and down curbs",
  "Squatting",
  "Coming up on your toes",
  "Walking initially",
  "Walking 5 minutes or less",
  "Walking 10 minutes",
  "Walking 15 minutes or greater",
  "Home responsibilities",
  "Activities of daily living",
  "Personal care",
  "Light to moderate work (standing, walking)",
  "Heavy work (push/pulling, climbing, carrying)",
  "Recreational activities",
];

const SPORTS_ITEMS = [
  "Running",
  "Jumping",
  "Landing",
  "Starting and stopping quickly",
  "Cutting/lateral movements",
  "Low impact activities",
  "Ability to perform activity with normal technique",
  "Ability to participate in desired sport as long as you would like",
];

const SCORE_OPTIONS = [
  { value: 4, label: "4 â€“ No difficulty" },
  { value: 3, label: "3 â€“ Slight difficulty" },
  { value: 2, label: "2 â€“ Moderate difficulty" },
  { value: 1, label: "1 â€“ Extreme difficulty" },
  { value: 0, label: "0 â€“ Unable to do" },
];

function ItemRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
      <span className="text-sm text-slate-700 flex-1">{label}</span>
      <select
        value={value !== null ? value : ""}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="p-1.5 border border-slate-300 rounded text-sm min-w-[180px] bg-white"
      >
        <option value="">Select...</option>
        {SCORE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function FootandAnkleAbilityMeasureFAAMRunner({ client, onSave, onClose }) {
  const [adls, setAdls] = useState(Array(21).fill(null));
  const [sports, setSports] = useState(Array(8).fill(null));
  const [notes, setNotes] = useState("");
  const [expandedSection, setExpandedSection] = useState(null);

  const calcScore = (responses) => {
    const valid = responses.filter((r) => r !== null);
    if (valid.length === 0) return null;
    return ((valid.reduce((s, r) => s + r, 0) / (valid.length * 4)) * 100).toFixed(1);
  };

  const handleSave = () => {
    const adlScore = calcScore(adls);
    const sportsScore = calcScore(sports);
    if (adlScore === null && sportsScore === null) {
      toast.error("Please answer at least one question before saving.");
      return;
    }

    const adlLines = ADL_ITEMS.map(
      (item, i) => `  ${i + 1}. ${item}: ${adls[i] !== null ? adls[i] + "/4" : "N/A"}`
    ).join("\n");
    const sportsLines = SPORTS_ITEMS.map(
      (item, i) => `  ${i + 1}. ${item}: ${sports[i] !== null ? sports[i] + "/4" : "N/A"}`
    ).join("\n");
    const soap_text = `â€¢ Foot and Ankle Ability Measure (FAAM)\n\n  ADL Subscale Score: ${adlScore || "â€”"}%\n  Sports Subscale Score: ${sportsScore || "â€”"}%\n\n  ADL Items:\n${adlLines}\n\n  Sports Items:\n${sportsLines}${
      notes ? `\n\n  Clinical Notes: ${notes}` : ""
    }`;

    onSave({
      status: "completed",
      result_value: parseFloat(adlScore || 0),
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
      additional_data: {
        measurement_type: "questionnaire",
        soap_text,
        adl_score: adlScore,
        sports_score: sportsScore,
      },
    });
  };

  const adlComplete = adls.filter((v) => v !== null).length;
  const sportsComplete = sports.filter((v) => v !== null).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-slate-50 border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Foot and Ankle Ability Measure (FAAM)</h2>
            <p className="text-sm text-slate-600 mt-1">Client: {client?.full_name || "Unknown"}</p>
            <p className="text-xs text-blue-600 mt-1">Rate ability: 0 = unable to do, 4 = no difficulty</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Overview */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Assessment Overview</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div>
                <p className="font-semibold text-slate-900">Purpose:</p>
                <p className="text-slate-700">
                  Self-report measure of perceived functional ability related to the ankle and foot. Comprises two subscales: ADL (21 items) for daily living tasks and Sports (8 items) for athletic and recreational activities.
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Scoring:</p>
                <p className="text-slate-700">
                  <strong>0â€“4 per item</strong>; each subscale converted to 0â€“100% scale. Higher scores = better functional ability.
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Population:</p>
                <p className="text-slate-700">
                  Patients with ankle sprains, foot/ankle pain, post-surgical rehabilitation (ankle fracture, ACL repair), and chronic ankle instability.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Clinician Instructions */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                <Info className="w-5 h-5" />
                Administration Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-blue-900 space-y-3">
              <div>
                <p className="font-semibold">How to Administer:</p>
                <ul className="list-disc list-inside ml-2 space-y-1 text-xs mt-1">
                  <li>Ask client to rate their ability on each activity over the past 1â€“2 weeks</li>
                  <li>Clarify that "ability" refers to physical capability, not limitation due to other factors</li>
                  <li>Administer both ADL and Sports subscales, or either one based on client goals</li>
                  <li>Allow 5â€“10 minutes for completion; provide written instructions if client prefers self-completion</li>
                  <li>Ensure client understands the 0â€“4 scale: 0 = unable, 4 = no difficulty</li>
                </ul>
              </div>
              <div className="bg-white p-2 rounded border border-blue-200 italic text-xs">
                <p>"I'd like you to rate your ability to perform each activity over the past 1â€“2 weeks on a scale of 0 to 4. Zero means you're unable to do the activity, and 4 means you have no difficulty at all. If an activity is not applicable to you, you can skip it."</p>
              </div>
            </CardContent>
          </Card>

          {/* Scoring Guide */}
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-amber-900">
                <Info className="w-5 h-5" />
                Score Interpretation &amp; Normative Data
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-amber-900 space-y-2">
              <div className="bg-white p-2 rounded border border-amber-200">
                <p className="font-semibold mb-1">ADL Score Interpretation:</p>
                <p><strong>80â€“100%:</strong> Minimal or no functional limitation; able to perform most daily activities independently.</p>
                <p><strong>60â€“79%:</strong> Mild to moderate functional limitation; some difficulty with certain ADL tasks.</p>
                <p><strong>&lt;60%:</strong> Significant functional limitation; substantial difficulty with ADL independence.</p>
              </div>
              <div className="bg-white p-2 rounded border border-amber-200">
                <p className="font-semibold mb-1">Sports Score Interpretation:</p>
                <p><strong>80â€“100%:</strong> Able to return to sport; minimal impact from ankle dysfunction.</p>
                <p><strong>60â€“79%:</strong> Moderate difficulty with sport-specific activities; caution with high-demand movements.</p>
                <p><strong>&lt;60%:</strong> Unable to participate in sport at full capacity; requires continued rehabilitation.</p>
              </div>
              <div className="bg-white p-2 rounded border border-amber-200">
                <p className="font-semibold mb-1">Normative Data:</p>
                <p><strong>Healthy controls:</strong> ADL mean 96â€“98%; Sports mean 95â€“98%</p>
                <p><strong>Chronic ankle instability:</strong> ADL mean 77â€“83%; Sports mean 60â€“75%</p>
                <p><strong>Post-ankle sprain (acute):</strong> ADL mean 60â€“75%; Sports mean 20â€“40%</p>
              </div>
            </CardContent>
          </Card>

          {/* Clinical Significance */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Clinical Significance</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-700 space-y-2">
              <p>
                <strong>Minimal Detectable Change (MDC):</strong> 8â€“11% for ADL; 12â€“19% for Sports. Changes exceeding these thresholds indicate meaningful improvement or decline.
              </p>
              <p>
                <strong>Reliability &amp; Validity:</strong> FAAM is a reliable, valid, and responsive measure of ankle/foot functional ability. Good correlation with objective functional tests (single-leg balance, hop tests).
              </p>
              <p>
                <strong>Use in Rehabilitation:</strong> Baseline at initial evaluation, re-assess every 2â€“4 weeks to track progress. RTS (return-to-sport) readiness often requires both ADL â‰¥90% and Sports â‰¥90%.
              </p>
            </CardContent>
          </Card>

          {/* References */}
          <Card className="border-slate-200 bg-slate-50">
            <CardHeader>
              <CardTitle className="text-base">References &amp; Evidence</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-700 space-y-2">
              <p>
                <strong>Martin, R. L., Irrgang, J. J., Burdett, R. G., Conti, S. F., &amp; Van Swearingen, J. M.</strong> (2005). Evidence of validity for the Foot and Ankle Ability Measure (FAAM). <em>Foot &amp; Ankle International</em>, 26(11), 968â€“983.
              </p>
              <p>
                <strong>Hale, S. A., &amp; Hertel, J.</strong> (2005). Reliability and sensitivity of the Foot and Ankle Disability Index in subjects with chronic ankle instability. <em>Journal of Athletic Training</em>, 40(1), 35â€“40.
              </p>
              <p>
                <strong>Carcia, C. R., Martin, R. L., Drouin, J. M.</strong> (2005). Validity of the Foot and Ankle Ability Measure in athletes with ankle sprains. <em>Journal of Sport Rehabilitation</em>, 14(3), 189â€“206.
              </p>
              <Button
                onClick={() => window.open("https://www.apta.org/", "_blank")}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                <ExternalLink className="w-3 h-3 mr-2" />
                APTA Resources
              </Button>
            </CardContent>
          </Card>

          {/* ADL Section */}
          <Card>
            <CardHeader>
              <button
                onClick={() =>
                  setExpandedSection(expandedSection === "adl" ? null : "adl")
                }
                className="w-full flex items-center justify-between font-semibold text-slate-900 hover:text-blue-700"
              >
                <div className="flex items-center gap-2 text-base">
                  <span>ADL Subscale (21 items)</span>
                  <span className="text-xs font-normal text-slate-500">
                    {adlComplete}/21 answered
                  </span>
                </div>
                {expandedSection === "adl" ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </CardHeader>
            {expandedSection === "adl" && (
              <CardContent>
                <div className="space-y-0">
                  {ADL_ITEMS.map((item, i) => (
                    <ItemRow
                      key={i}
                      label={`${i + 1}. ${item}`}
                      value={adls[i]}
                      onChange={(val) => {
                        const n = [...adls];
                        n[i] = val;
                        setAdls(n);
                      }}
                    />
                  ))}
                </div>
                {adlComplete > 0 && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900">
                    <p className="font-semibold">
                      ADL Score: <span className="text-lg text-blue-700">{calcScore(adls)}%</span>
                    </p>
                    <p className="text-xs mt-1">
                      {calcScore(adls) >= 80
                        ? "Minimal functional limitation"
                        : calcScore(adls) >= 60
                        ? "Mild to moderate functional limitation"
                        : "Significant functional limitation"}
                    </p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Sports Section */}
          <Card>
            <CardHeader>
              <button
                onClick={() =>
                  setExpandedSection(expandedSection === "sports" ? null : "sports")
                }
                className="w-full flex items-center justify-between font-semibold text-slate-900 hover:text-blue-700"
              >
                <div className="flex items-center gap-2 text-base">
                  <span>Sports Subscale (8 items)</span>
                  <span className="text-xs font-normal text-slate-500">
                    {sportsComplete}/8 answered
                  </span>
                </div>
                {expandedSection === "sports" ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </CardHeader>
            {expandedSection === "sports" && (
              <CardContent>
                <div className="space-y-0">
                  {SPORTS_ITEMS.map((item, i) => (
                    <ItemRow
                      key={i}
                      label={`${i + 1}. ${item}`}
                      value={sports[i]}
                      onChange={(val) => {
                        const n = [...sports];
                        n[i] = val;
                        setSports(n);
                      }}
                    />
                  ))}
                </div>
                {sportsComplete > 0 && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded p-3 text-sm text-green-900">
                    <p className="font-semibold">
                      Sports Score: <span className="text-lg text-green-700">{calcScore(sports)}%</span>
                    </p>
                    <p className="text-xs mt-1">
                      {calcScore(sports) >= 80
                        ? "Ready for sport return"
                        : calcScore(sports) >= 60
                        ? "Moderate difficulty with sport activities"
                        : "Unable to participate in sport at full capacity"}
                    </p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Clinical Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clinical Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observations: limitation patterns, pain patterns, functional barriers, rehabilitation progress, RTS readiness..."
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t bg-slate-50 px-6 py-4 flex justify-between items-center gap-3">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          <Button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700"
            disabled={adlComplete === 0 && sportsComplete === 0}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}