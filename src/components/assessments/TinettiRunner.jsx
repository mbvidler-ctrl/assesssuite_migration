import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronRight, Save, ChevronDown, ChevronUp, BookOpen } from "lucide-react";

// â”€â”€ Balance Items â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const balanceItems = [
  {
    name: "1. Sitting Balance",
    tip: "Observe the patient seated in a hard, armless chair. Watch for trunk lean, sliding, or any loss of upright position without external support.",
    options: [
      { label: "Leans or slides in chair", value: 0 },
      { label: "Steady, safe", value: 1 }
    ]
  },
  {
    name: "2. Rising from Chair",
    tip: "Ask patient to stand up. Watch whether they need arm support, multiple attempts, or forward momentum to complete the movement.",
    options: [
      { label: "Unable without help", value: 0 },
      { label: "Able, uses arms to help", value: 1 },
      { label: "Able without using arms", value: 2 }
    ]
  },
  {
    name: "3. Immediate Standing Balance (first 3â€“5 seconds)",
    tip: "Observe immediately after rising. Note any staggering, stepping to regain balance, or need to grab a surface within the first few seconds.",
    options: [
      { label: "Unsteady (staggers, moves feet, trunk sway)", value: 0 },
      { label: "Steady but uses walker/cane or grabs objects", value: 1 },
      { label: "Steady without walker/cane or other support", value: 2 }
    ]
  },
  {
    name: "4. Standing Balance",
    tip: "With feet as close together as possible (patient's choice of stance). Observe for 5 seconds. Note use of support or wide base. Medial heel separation >10 cm = wide stance.",
    options: [
      { label: "Unsteady", value: 0 },
      { label: "Steady but wide stance (heels >10 cm apart) or uses cane/support", value: 1 },
      { label: "Narrow stance without support", value: 2 }
    ]
  },
  {
    name: "5. Balance with Eyes Closed (at position from item 4)",
    tip: "Without changing stance from item 4, ask patient to close their eyes for 3 seconds. Assess whether they can maintain balance without vision.",
    options: [
      { label: "Unsteady", value: 0 },
      { label: "Steady", value: 1 }
    ]
  },
  {
    name: "6a. Turning 360Â° â€” Steps",
    tip: "Ask patient to turn a full circle. Count whether steps are discontinuous (pauses between) or continuous (smooth rotation). Discontinuous = 0.",
    options: [
      { label: "Discontinuous steps (stops between)", value: 0 },
      { label: "Continuous steps", value: 1 }
    ]
  },
  {
    name: "6b. Turning 360Â° â€” Steadiness",
    tip: "During the same 360Â° turn, observe stability. Grabs for support or staggers during the turn = 0.",
    options: [
      { label: "Unsteady (grabs, staggers)", value: 0 },
      { label: "Steady", value: 1 }
    ]
  },
  {
    name: "7. Nudge Test â€” Sternal Push (Ã—3)",
    tip: "Stand close. Apply a gentle firm push to the sternum 3 times. Assess postural response. Do NOT push hard enough to cause a fall â€” this tests reactive balance.",
    options: [
      { label: "Begins to fall", value: 0 },
      { label: "Staggers, grabs, catches self", value: 1 },
      { label: "Steady", value: 2 }
    ]
  },
  {
    name: "8. Sitting Down",
    tip: "Observe patient returning to seated. Watch for loss of control, falling into chair, misjudging distance, or requiring arm support for controlled descent.",
    options: [
      { label: "Unsafe (misjudges distance, falls into chair)", value: 0 },
      { label: "Uses arms or not a smooth motion", value: 1 },
      { label: "Safe, smooth motion", value: 2 }
    ]
  },
  {
    name: "9. Single Leg Stance (5 seconds)",
    tip: "Ask patient to stand on one leg for 5 seconds without support. Clinician may demonstrate. Score based on best leg attempted.",
    options: [
      { label: "Unable or holds <5 seconds", value: 0 },
      { label: "Able to hold â‰¥5 seconds", value: 1 }
    ]
  }
];

// â”€â”€ Gait Items â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const gaitItems = [
  {
    name: "1. Gait Initiation (immediately after told to 'Go')",
    tip: "Ask patient to begin walking at their normal pace. Observe the first step. Any hesitancy, shuffling before lifting foot, or multiple attempts = 0.",
    options: [
      { label: "Any hesitancy or multiple attempts to start", value: 0 },
      { label: "No hesitancy, single fluid initiation", value: 1 }
    ]
  },
  {
    name: "2. Right Swing Foot â€” Step Length",
    tip: "Observe the RIGHT foot during swing phase. The foot should pass the left stance foot. If it does not pass the stance foot = 0.",
    options: [
      { label: "Does not pass left stance foot", value: 0 },
      { label: "Passes left stance foot", value: 1 }
    ]
  },
  {
    name: "3. Right Swing Foot â€” Step Height (foot clearance)",
    tip: "Observe the RIGHT foot lift. Foot should fully clear the floor. Scraping, shuffling or partial clearance = 0.",
    options: [
      { label: "Right foot does not clear floor completely", value: 0 },
      { label: "Right foot clears floor completely", value: 1 }
    ]
  },
  {
    name: "4. Left Swing Foot â€” Step Length",
    tip: "Observe the LEFT foot during swing phase. Should pass the right stance foot. Failure to pass = 0.",
    options: [
      { label: "Does not pass right stance foot", value: 0 },
      { label: "Passes right stance foot", value: 1 }
    ]
  },
  {
    name: "5. Left Swing Foot â€” Step Height (foot clearance)",
    tip: "Observe the LEFT foot lift. Full floor clearance required. Scraping or shuffling = 0.",
    options: [
      { label: "Left foot does not clear floor completely", value: 0 },
      { label: "Left foot clears floor completely", value: 1 }
    ]
  },
  {
    name: "6. Step Symmetry",
    tip: "Compare right and left step lengths throughout the walk. Both sides should appear roughly equal in length. Asymmetry (one side consistently shorter) = 0.",
    options: [
      { label: "Right and left step length not equal (asymmetrical)", value: 0 },
      { label: "Right and left step length appears equal", value: 1 }
    ]
  },
  {
    name: "7. Step Continuity",
    tip: "Observe for stopping or periods of both feet on the ground simultaneously (double stance). Smooth, continuous stepping = 1.",
    options: [
      { label: "Stopping or discontinuity between steps", value: 0 },
      { label: "Steps appear continuous", value: 1 }
    ]
  },
  {
    name: "8. Path Deviation (observe over ~3 metres)",
    tip: "Watch the patient walk along a 3 m straight line (imagined or taped). Note deviation from a straight path. Use of a walking aid automatically limits score to 1.",
    options: [
      { label: "Marked deviation", value: 0 },
      { label: "Mild/moderate deviation or uses assistive device", value: 1 },
      { label: "Straight without assistive device", value: 2 }
    ]
  },
  {
    name: "9. Trunk Stability",
    tip: "Observe the trunk during walking. Any visible sway, use of arms for balance, knee or back flexion while walking limits score to 1 even without an aid.",
    options: [
      { label: "Marked sway or uses assistive device", value: 0 },
      { label: "No sway but flexes knees/back or spreads arms while walking", value: 1 },
      { label: "No sway, no assistive device, no compensatory movements", value: 2 }
    ]
  },
  {
    name: "10. Walking Stance (base width)",
    tip: "Observe heel separation while walking. Heels should nearly touch (narrow base). Wide base of support (heels apart) = 0.",
    options: [
      { label: "Heels apart (wide base)", value: 0 },
      { label: "Heels almost touching while walking", value: 1 }
    ]
  }
];

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function TinettiRunner({ client, onSave, onClose }) {
  const [activeTab, setActiveTab] = useState("balance");
  const [balanceScores, setBalanceScores] = useState({});
  const [gaitScores, setGaitScores] = useState({});
  const [notes, setNotes] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);

  const balanceScore = () => Object.values(balanceScores).reduce((s, v) => s + (parseInt(v) || 0), 0);
  const gaitScore = () => Object.values(gaitScores).reduce((s, v) => s + (parseInt(v) || 0), 0);
  const totalScore = () => balanceScore() + gaitScore();

  const getInterpretation = (total) => {
    if (total >= 25) return { text: "Low Fall Risk", color: "text-green-700", bg: "bg-green-50 border-green-300" };
    if (total >= 19) return { text: "Medium Fall Risk (~2Ã— increased)", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-300" };
    return { text: "High Fall Risk (~5Ã— increased)", color: "text-red-700", bg: "bg-red-50 border-red-300" };
  };

  const handleSave = () => {
    if (Object.keys(balanceScores).length < balanceItems.length) {
      toast.error(`Please complete all balance items (${Object.keys(balanceScores).length}/${balanceItems.length} done).`);
      return;
    }
    if (Object.keys(gaitScores).length < gaitItems.length) {
      toast.error(`Please complete all gait items (${Object.keys(gaitScores).length}/${gaitItems.length} done).`);
      return;
    }

    const bs = balanceScore(), gs = gaitScore(), ts = totalScore();
    const interp = getInterpretation(ts);

    let soapText = `â€¢ Tinetti POMA: ${ts}/28 â€” ${interp.text}\n`;
    soapText += `  Balance Score: ${bs}/16 | Gait Score: ${gs}/12\n\n`;
    soapText += `  Balance Items:\n`;
    balanceItems.forEach((item, idx) => {
      if (balanceScores[idx] !== undefined) {
        const sel = item.options.find(o => o.value === balanceScores[idx]);
        soapText += `    ${item.name}: ${sel?.label || balanceScores[idx]} (${balanceScores[idx]})\n`;
      }
    });
    soapText += `\n  Gait Items:\n`;
    gaitItems.forEach((item, idx) => {
      if (gaitScores[idx] !== undefined) {
        const sel = item.options.find(o => o.value === gaitScores[idx]);
        soapText += `    ${item.name}: ${sel?.label || gaitScores[idx]} (${gaitScores[idx]})\n`;
      }
    });
    if (notes) soapText += `\n  Clinical Notes: ${notes}\n`;
    soapText += `  Reference: Tinetti (1986). JAGS, 34(2), 119â€“126.`;

    onSave({
      result_value: ts,
      additional_data: {
        soap_text: soapText,
        balance_score: bs,
        gait_score: gs,
        balance_responses: balanceScores,
        gait_responses: gaitScores,
        interpretation: interp.text,
        measurement_type: 'tinetti'
      },
      notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });

    toast.success("Tinetti POMA saved!");
  };

  const interp = getInterpretation(totalScore());

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">

          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Tinetti Performance Oriented Mobility Assessment</h2>
              <p className="text-sm text-slate-500 mt-0.5">Balance (0â€“16) + Gait (0â€“12) = Total (0â€“28)</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>Ã—</Button>
          </div>

          {/* Instructions Toggle */}
          <button
            onClick={() => setShowInstructions(v => !v)}
            className="w-full flex justify-between items-center bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm font-semibold text-blue-900"
          >
            <div className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Protocol & Clinician Instructions</div>
            {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showInstructions && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div className="bg-white rounded-lg border border-blue-100 p-3 space-y-1 text-xs">
                  <p className="font-bold text-slate-800">Equipment & Setup</p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600">
                    <li>Hard, armless chair (seat height ~43 cm)</li>
                    <li>Clear 3-metre walkway</li>
                    <li>Patient's usual footwear and walking aid</li>
                    <li>Stopwatch (for single-leg stance)</li>
                  </ul>
                </div>
                <div className="bg-white rounded-lg border border-blue-100 p-3 space-y-1 text-xs">
                  <p className="font-bold text-slate-800">Administration</p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600">
                    <li>Complete Balance section first, then Gait</li>
                    <li>Demonstrate each task before patient attempts</li>
                    <li>Use patient's usual assistive device if needed</li>
                    <li>Score the BEST observed performance</li>
                    <li>Stay close for safety throughout</li>
                  </ul>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                <p className="font-semibold text-amber-800">Scoring Note</p>
                <p className="text-amber-700 mt-1">Higher scores = better performance. Balance max = 16 pts (10 items). Gait max = 12 pts (10 items). Total max = 28 pts. MCID = 3 points. Do not alter patient's usual assistive device usage during test.</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
                <p className="font-semibold text-red-800">Contraindications / Stop Criteria</p>
                <ul className="list-disc pl-4 space-y-1 text-red-700">
                  <li>Acute lower limb injury or recent surgery</li>
                  <li>Severe cardiovascular instability</li>
                  <li>Stop if patient shows significant loss of balance or distress</li>
                </ul>
              </div>
            </div>
          )}

          {/* Live Score Banner */}
          <div className={`border rounded-lg px-4 py-3 flex items-center justify-between ${interp.bg}`}>
            <div className="flex gap-6 text-sm">
              <span><span className="text-slate-500">Balance:</span> <strong className="text-blue-700">{balanceScore()}/16</strong></span>
              <span><span className="text-slate-500">Gait:</span> <strong className="text-purple-700">{gaitScore()}/12</strong></span>
              <span><span className="text-slate-500">Total:</span> <strong className="text-slate-900 text-base">{totalScore()}/28</strong></span>
            </div>
            {totalScore() > 0 && <span className={`text-sm font-semibold ${interp.color}`}>{interp.text}</span>}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="balance">
                Balance ({balanceScore()}/16) â€” {Object.keys(balanceScores).length}/{balanceItems.length} done
              </TabsTrigger>
              <TabsTrigger value="gait">
                Gait ({gaitScore()}/12) â€” {Object.keys(gaitScores).length}/{gaitItems.length} done
              </TabsTrigger>
            </TabsList>

            {/* â”€â”€ Balance Tab â”€â”€ */}
            <TabsContent value="balance" className="space-y-3 mt-4">
              {balanceItems.map((item, idx) => (
                <Card key={idx} className={balanceScores[idx] !== undefined ? "border-blue-200" : "border-slate-200"}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-slate-800">{item.name}</CardTitle>
                    <p className="text-xs text-slate-500 italic">{item.tip}</p>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={balanceScores[idx]?.toString() ?? ""}
                      onValueChange={(val) => setBalanceScores({ ...balanceScores, [idx]: parseInt(val) })}
                    >
                      {item.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center space-x-2 mb-1.5">
                          <RadioGroupItem value={opt.value.toString()} id={`b-${idx}-${optIdx}`} />
                          <Label htmlFor={`b-${idx}-${optIdx}`} className="cursor-pointer text-sm">
                            {opt.label} <span className="text-slate-400 text-xs">({opt.value} pt{opt.value !== 1 ? "s" : ""})</span>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </CardContent>
                </Card>
              ))}
              <div className="flex justify-end pt-2">
                <Button onClick={() => setActiveTab("gait")} className="gap-2">
                  Continue to Gait <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </TabsContent>

            {/* â”€â”€ Gait Tab â”€â”€ */}
            <TabsContent value="gait" className="space-y-3 mt-4">
              {gaitItems.map((item, idx) => (
                <Card key={idx} className={gaitScores[idx] !== undefined ? "border-purple-200" : "border-slate-200"}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-slate-800">{item.name}</CardTitle>
                    <p className="text-xs text-slate-500 italic">{item.tip}</p>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={gaitScores[idx]?.toString() ?? ""}
                      onValueChange={(val) => setGaitScores({ ...gaitScores, [idx]: parseInt(val) })}
                    >
                      {item.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center space-x-2 mb-1.5">
                          <RadioGroupItem value={opt.value.toString()} id={`g-${idx}-${optIdx}`} />
                          <Label htmlFor={`g-${idx}-${optIdx}`} className="cursor-pointer text-sm">
                            {opt.label} <span className="text-slate-400 text-xs">({opt.value} pt{opt.value !== 1 ? "s" : ""})</span>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>

          {/* Normative Table */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-semibold text-slate-700">ðŸ“Š Score Interpretation</p>
            <table className="w-full text-xs border border-slate-200 rounded overflow-hidden">
              <thead className="bg-slate-200">
                <tr>
                  <th className="p-2 text-left">Total Score (/28)</th>
                  <th className="p-2 text-left">Fall Risk Category</th>
                  <th className="p-2 text-left">Clinical Action</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t bg-green-50">
                  <td className="p-2 font-medium">25â€“28</td>
                  <td className="p-2 text-green-700">Low fall risk</td>
                  <td className="p-2 text-slate-600">Preventive exercise / education</td>
                </tr>
                <tr className="border-t bg-yellow-50">
                  <td className="p-2 font-medium">19â€“24</td>
                  <td className="p-2 text-yellow-700">Medium fall risk (~2Ã— increased)</td>
                  <td className="p-2 text-slate-600">Balance/strengthening program</td>
                </tr>
                <tr className="border-t bg-red-50">
                  <td className="p-2 font-medium">&lt;19</td>
                  <td className="p-2 text-red-700">High fall risk (~5Ã— increased)</td>
                  <td className="p-2 text-slate-600">Multidisciplinary fall prevention</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-slate-500">MCID = 3 points. Balance max = 16 pts; Gait max = 12 pts.</p>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">ðŸ“– References</p>
            <p>1. Tinetti ME. (1986). Performance-oriented assessment of mobility problems in elderly patients. <em>JAGS, 34</em>(2), 119â€“126.</p>
            <p>2. Faber MJ et al. (2006). Effects of exercise programs on falls and mobility in frail and pre-frail older adults. <em>Arch Phys Med Rehab, 87</em>(7), 885â€“896.</p>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-semibold text-slate-700">Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Compensatory strategies observed, assistive device used, safety concerns, environmental factors..."
              rows={3}
              className="mt-1 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="w-4 h-4" />
              Save Results
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}