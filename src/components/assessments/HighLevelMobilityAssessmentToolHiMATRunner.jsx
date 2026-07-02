import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Info, ChevronDown, ChevronUp, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const ITEMS = [
  { 
    key: "walk", 
    label: "Walk (8m)", 
    max: 6, 
    description: "Normal walking at natural pace",
    scoringCriteria: {
      6: "Completes 8m walk smoothly; normal speed; coordinated arm swing; even cadence",
      5: "Completes walk with minor deviations; slightly reduced speed; minimal balance adjustment",
      4: "Walks 8m with noticeable gait deviation; slow but safe; may use rail or reduce stride length",
      3: "Walks 8m but requires supervision; marked gait asymmetry; multiple balance corrections",
      2: "Walks <8m or requires verbal/tactile cuing; unsafe without close supervision",
      1: "Attempts to walk but unable to complete 8m safely; severe gait dysfunction",
      0: "Unable to attempt or unsafe to continue; declines task"
    }
  },
  { 
    key: "walk_backwards", 
    label: "Walk backwards (8m)", 
    max: 6, 
    description: "Backward walking at controlled pace",
    scoringCriteria: {
      6: "Walks backward 8m smoothly; good speed control; minimal trunk rotation",
      5: "Walks backward 8m with occasional balance checks; slightly cautious",
      4: "Walks backward 8m with frequent balance corrections; slow and deliberate",
      3: "Walks backward <8m safely; requires verbal cues or close supervision; poor coordination",
      2: "Walks backward <4m or requires manual assistance; unable to maintain direction",
      1: "Attempts backward walk but unable to maintain direction; unsafe",
      0: "Unable to attempt or declines task"
    }
  },
  { 
    key: "walk_on_toes", 
    label: "Walk on toes (8m)", 
    max: 6, 
    description: "Walking on ball of feet, heels off ground",
    scoringCriteria: {
      6: "Completes 8m on toes with good balance; consistent heel clearance; smooth cadence",
      5: "Completes 8m on toes with minor balance checks; maintains height",
      4: "Walks 8m on toes with frequent balance corrections; reduced height; slow speed",
      3: "Walks <8m on toes; requires supervision; marked balance loss; feet touch down",
      2: "Walks <4m on toes; unable to maintain position; heels repeatedly touch ground",
      1: "Attempts but unable to maintain toe-walking; immediate balance loss",
      0: "Unable to attempt or declines task"
    }
  },
  { 
    key: "run", 
    label: "Run (8m)", 
    max: 6, 
    description: "Running at self-paced speed",
    scoringCriteria: {
      6: "Runs 8m smoothly; even pace; coordinated arm/leg movement; controlled landing",
      5: "Runs 8m with minor asymmetry; good speed; safe stopping",
      4: "Jogs 8m at reduced speed; noticeable gait deviation; safe but cautious",
      3: "Jogs <8m with supervision; irregular rhythm; balance concerns noted",
      2: "Jogs <4m or requires verbal cuing; unsafe gait pattern",
      1: "Attempts running but transitions to walk immediately; unable to run",
      0: "Unable to attempt or declines task"
    }
  },
  { 
    key: "skip", 
    label: "Skip (8m)", 
    max: 6, 
    description: "Continuous skipping without stopping",
    scoringCriteria: {
      6: "Skips 8m continuously; even rhythm; good height and distance per skip; coordinated",
      5: "Skips 8m with minor rhythm breaks; maintains height; slight asymmetry",
      4: "Skips 8m with frequent rhythm breaks; reduced height; slow but continuous",
      3: "Skips <8m with poor rhythm; requires supervision; limited hop height",
      2: "Skips <4m; unable to maintain continuous rhythm; transitions to walk",
      1: "Attempts skipping but unable to coordinate; immediately breaks into walk",
      0: "Unable to attempt or declines task"
    }
  },
  { 
    key: "hop_on_spot", 
    label: "Hop on spot (single leg)", 
    max: 6, 
    description: "Continuous hopping on one leg in place",
    scoringCriteria: {
      6: "Completes 10+ hops on each leg; good balance; consistent height; controlled landing",
      5: "Completes 8â€“10 hops per leg; minor balance loss; stable",
      4: "Completes 5â€“7 hops per leg; noticeable balance corrections; lower height",
      3: "Completes 3â€“4 hops per leg; requires supervision; poor balance; low height",
      2: "Completes 1â€“2 hops per leg; unable to continue; marked instability",
      1: "Attempts single-leg hop but unable to perform; immediate balance loss",
      0: "Unable to attempt or declines task"
    }
  },
  { 
    key: "forward_bound", 
    label: "Forward bound", 
    max: 6, 
    description: "Continuous bounding forward",
    scoringCriteria: {
      6: "Bounds 8m continuously; good distance per bound; strong propulsion; controlled landing",
      5: "Bounds 8m with minor asymmetry; good distance; stable transitions",
      4: "Bounds 8m with reduced distance per bound; noticeable asymmetry; cautious",
      3: "Bounds <8m; poor coordination; requires supervision; balance concerns",
      2: "Bounds <4m; unable to maintain pattern; high fall risk",
      1: "Attempts bounding but unable to coordinate; immediate transition to walk",
      0: "Unable to attempt or declines task"
    }
  },
  { 
    key: "stair_walk_up", 
    label: "Stair walk â€” up", 
    max: 4, 
    description: "Walking up stairs at natural pace (â‰¥12 stairs)",
    scoringCriteria: {
      4: "Ascends stairs smoothly; normal speed; no rail use; normal stepping pattern",
      3: "Ascends stairs safely; uses rail; slightly slow; one foot per step",
      2: "Ascends with supervision; uses rail; slow; limited step height; marked fatigue",
      1: "Ascends with close assistance; limited steps; high effort; poor safety",
      0: "Unable to attempt or unsafe"
    }
  },
  { 
    key: "stair_walk_down", 
    label: "Stair walk â€” down", 
    max: 4, 
    description: "Walking down stairs at natural pace",
    scoringCriteria: {
      4: "Descends stairs smoothly; normal speed; no rail use; balanced",
      3: "Descends safely; uses rail; slightly cautious; one foot per step",
      2: "Descends with supervision; uses rail; slow; frequent balance checks; high caution",
      1: "Descends with close assistance; minimal steps; requires verbal cuing; poor safety",
      0: "Unable to attempt or unsafe"
    }
  },
  { 
    key: "stair_run_up", 
    label: "Stair run â€” up", 
    max: 4, 
    description: "Running up stairs at maximum safe speed",
    scoringCriteria: {
      4: "Runs up stairs at brisk pace; some steps skipped; good propulsion; controlled",
      3: "Runs up stairs at moderate pace; one step per stride; safe; slightly slow",
      2: "Jogs up stairs with supervision; slow pace; one step per stride; high caution",
      1: "Walks up stairs quickly or jogs with close assistance; unsafe without help",
      0: "Unable to attempt or unsafe"
    }
  },
];

function getInterpretation(score, maxScore) {
  const pct = (score / maxScore) * 100;
  if (score >= 54) return { label: "Full high-level community mobility", color: "bg-green-100 text-green-800 border-green-300" };
  if (score >= 42) return { label: "Good mobility with minor limitations", color: "bg-blue-100 text-blue-800 border-blue-300" };
  return { label: "Impaired high-level mobility", color: "bg-orange-100 text-orange-800 border-orange-300" };
}

export default function HighLevelMobilityAssessmentToolHiMATRunner({ client, onSave, onClose }) {
  const [showInfo, setShowInfo] = useState(false);
  const [scores, setScores] = useState({});
  const [preVitals, setPreVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [postVitals, setPostVitals] = useState({ heartRate: "", bloodPressure: "" });
  const [notes, setNotes] = useState("");

  const maxScore = ITEMS.reduce((acc, item) => acc + item.max, 0); // 54
  const totalScore = ITEMS.reduce((acc, item) => acc + (scores[item.key] || 0), 0);
  const answered = Object.keys(scores).length;
  const interp = answered === ITEMS.length ? getInterpretation(totalScore, maxScore) : null;

  const handleScoreChange = (key, value) => {
    const numValue = Math.max(0, Math.min(ITEMS.find(i => i.key === key)?.max || 0, parseInt(value) || 0));
    setScores((prev) => ({ ...prev, [key]: numValue }));
  };

  const handleSave = () => {
    if (answered !== ITEMS.length) {
      toast.error(`Please score all ${ITEMS.length} items`);
      return;
    }

    const scoreLines = ITEMS.map(item => `  ${item.label}: ${scores[item.key]}/${item.max}`).join("\n");
    const soap = `â€¢ High-Level Mobility Assessment Tool (HiMAT)\n  Total Score: ${totalScore}/${maxScore} â€” ${interp.label}\n\n  Item Scores:\n${scoreLines}${preVitals.heartRate ? `\n\n  Pre-Test HR: ${preVitals.heartRate} bpm` : ""}${preVitals.bloodPressure ? ` | BP: ${preVitals.bloodPressure} mmHg` : ""}${postVitals.heartRate ? `\n  Post-Test HR: ${postVitals.heartRate} bpm` : ""}${postVitals.bloodPressure ? ` | BP: ${postVitals.bloodPressure} mmHg` : ""}${notes ? `\n\n  Clinician Notes: ${notes}` : ""}`;

    onSave({
      result_value: totalScore,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
      additional_data: {
        soap_text: soap,
        measurement_type: "questionnaire",
        scores,
        total_score: totalScore,
        max_score: maxScore,
        mobility_level: interp.label,
        pre_vitals: preVitals,
        post_vitals: postVitals,
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 p-5 border-b flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">High-Level Mobility Assessment Tool (HiMAT)</h2>
            <p className="text-slate-500 text-sm mt-0.5">10-item performance-based assessment â€” max 54 points</p>
          </div>
          {answered === ITEMS.length && <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${interp.color}`}>{totalScore}/{maxScore}</div>}
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Collapsible Clinician Info */}
          <div className="border border-blue-200 rounded-lg overflow-hidden">
            <button
              className="w-full flex justify-between items-center px-4 py-3 bg-blue-50 text-blue-800 font-semibold text-sm hover:bg-blue-100 transition-colors"
              onClick={() => setShowInfo(!showInfo)}
            >
              <span className="flex items-center gap-2"><Info className="w-4 h-4" />Clinician Info & Protocol</span>
              {showInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showInfo && (
              <div className="p-4 text-sm text-slate-700 space-y-3 bg-white">
                <div>
                  <p className="font-semibold text-slate-800 mb-1">About the HiMAT</p>
                  <p className="text-slate-600">The High-Level Mobility Assessment Tool (HiMAT) measures the ability to perform high-level mobility tasks in community-dwelling adults. It is used for assessing functional mobility post-injury, stroke, TBI, and lower limb orthopaedic conditions.</p>
                </div>
                <div>
                   <p className="font-semibold text-slate-800 mb-1">Administration Instructions</p>
                   <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                     <li>Client wears usual footwear without assistive devices (unless typically used)</li>
                     <li>8-metre corridor for walking/running tasks; stairs (â‰¥12) for climbing tasks</li>
                     <li>Client performs each task at natural pace; score ability to complete</li>
                     <li>Stop test immediately if client experiences chest pain, dyspnoea, dizziness, or severe pain</li>
                     <li>Record vitals pre- and post-test to monitor cardiovascular response</li>
                   </ul>
                </div>
                <div>
                   <p className="font-semibold text-slate-800 mb-1">Key Scoring Principles</p>
                   <ul className="list-disc list-inside text-slate-600 space-y-0.5 text-xs">
                     <li><strong>Completion:</strong> Score is based on whether the task is completed, not speed alone</li>
                     <li><strong>Quality of Movement:</strong> Assess smoothness, coordination, balance control, and symmetry</li>
                     <li><strong>Safety:</strong> Consider use of rails, supervision requirements, and fall risk</li>
                     <li><strong>Consistency:</strong> Observe repetitive patterns (hopping, skipping) â€” does client maintain rhythm/height?</li>
                     <li><strong>Effort & Fatigue:</strong> Note if client shows marked exertion, shortness of breath, or inability to continue</li>
                     <li><strong>Modifications:</strong> Use of rail, verbal cuing, or tactile assistance lowers score â€” document in notes</li>
                   </ul>
                </div>
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Scoring</p>
                  <div className="bg-slate-50 p-2 rounded text-xs space-y-1">
                    <p><strong>Walking tasks (0â€“6):</strong> Walk, walk backwards, walk on toes, run, skip</p>
                    <p><strong>Hopping/bounding (0â€“6):</strong> Hop on spot, forward bound</p>
                    <p><strong>Stair tasks (0â€“4):</strong> Walk up, walk down, run up</p>
                    <p className="mt-2"><strong>Total Max Score: 54 points</strong></p>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Score Interpretation</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex gap-2"><span className="w-12 font-semibold">54:</span><span className="text-green-700">Full high-level community mobility</span></div>
                    <div className="flex gap-2"><span className="w-12 font-semibold">42â€“53:</span><span className="text-blue-700">Good mobility with minor limitations</span></div>
                    <div className="flex gap-2"><span className="w-12 font-semibold">&lt;42:</span><span className="text-orange-700">Impaired high-level mobility</span></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">MCID: ~2â€“3 points. Validated for TBI, stroke, lower limb orthopaedic conditions.</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Psychometric Properties</p>
                  <ul className="list-disc list-inside text-slate-600 text-xs space-y-0.5">
                    <li>Excellent intra-rater reliability (ICC 0.95â€“0.99)</li>
                    <li>Good inter-rater reliability (ICC 0.94â€“0.98)</li>
                    <li>High internal consistency (Cronbach's Î± = 0.90)</li>
                    <li>Sensitive to change post-TBI and stroke rehabilitation</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-slate-800 mb-1">Key Reference</p>
                  <p className="text-xs text-slate-600">Williams GP et al. (2006). High-Level Mobility Assessment Tool (HiMAT): interrater reliability, retest reliability, and internal consistency. <em>Physical Therapy</em>, 86(3), 395â€“400.</p>
                </div>
              </div>
            )}
          </div>

          {/* Vital Signs */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="font-semibold text-slate-800 mb-3">Pre-Test Vital Signs</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Heart Rate (bpm)</Label>
                <Input type="number" value={preVitals.heartRate} onChange={e => setPreVitals(p => ({ ...p, heartRate: e.target.value }))} placeholder="e.g., 72" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Blood Pressure (mmHg)</Label>
                <Input type="text" value={preVitals.bloodPressure} onChange={e => setPreVitals(p => ({ ...p, bloodPressure: e.target.value }))} placeholder="e.g., 120/80" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Scoring Items */}
          <div className="space-y-3">
            <p className="font-semibold text-slate-800">Score Each Item (0â€“max)</p>
            {ITEMS.map((item) => (
              <div key={item.key} className={`border rounded-lg overflow-hidden ${scores[item.key] !== undefined ? "border-blue-200 bg-blue-50" : "border-slate-200"}`}>
                <div className="p-3 bg-slate-50">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-slate-800">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Input
                        type="number"
                        min="0"
                        max={item.max}
                        value={scores[item.key] ?? ""}
                        onChange={e => handleScoreChange(item.key, e.target.value)}
                        className="w-16 text-center font-semibold"
                        placeholder="â€”"
                      />
                      <span className="text-sm font-semibold text-slate-600">/ {item.max}</span>
                    </div>
                  </div>
                </div>

                {/* Scoring Criteria */}
                <div className="border-t border-slate-200 p-3 bg-white">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Scoring Guide:</p>
                  <div className="space-y-1 text-xs text-slate-600">
                    {Object.entries(item.scoringCriteria).reverse().map(([score, criteria]) => (
                      <div key={score} className={`px-2 py-1 rounded ${scores[item.key] === parseInt(score) ? "bg-blue-100 border-l-2 border-blue-600 font-semibold text-slate-800" : ""}`}>
                        <span className="font-semibold text-slate-700">{score}:</span> {criteria}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Score Summary */}
          {answered === ITEMS.length && (
            <div className={`border-2 rounded-xl p-4 text-center ${interp.color}`}>
              <p className="text-3xl font-bold">{totalScore} / {maxScore}</p>
              <p className="font-semibold text-lg mt-1">{interp.label}</p>
            </div>
          )}

          {/* Post-Test Vitals */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="font-semibold text-slate-800 mb-3">Post-Test Vital Signs</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Heart Rate (bpm)</Label>
                <Input type="number" value={postVitals.heartRate} onChange={e => setPostVitals(p => ({ ...p, heartRate: e.target.value }))} placeholder="e.g., 95" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Blood Pressure (mmHg)</Label>
                <Input type="text" value={postVitals.bloodPressure} onChange={e => setPostVitals(p => ({ ...p, bloodPressure: e.target.value }))} placeholder="e.g., 130/85" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Clinical Notes */}
          <div>
            <Label>Clinical Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Gait quality, balance, fatigue, pain, stopping criteria..." rows={3} className="mt-1" />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-slate-50 flex justify-between items-center">
          <span className="text-sm text-slate-500">{answered}/{ITEMS.length} items scored</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={answered !== ITEMS.length} className="bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" />Save HiMAT</Button>
          </div>
        </div>
      </div>
    </div>
  );
}