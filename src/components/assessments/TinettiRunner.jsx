import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronRight, Save, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { todayLocal } from "@/lib/localDate";
import { scoreTinetti, TINETTI_BALANCE_ITEMS, TINETTI_GAIT_ITEMS } from "@/lib/clinical/scorers/coreA";

// The UI renders the same ordered prompts, tips and options the pure scorer
// and serializable RunnerSpec consume.
const balanceItems = TINETTI_BALANCE_ITEMS;
const gaitItems = TINETTI_GAIT_ITEMS;
// ── Component ─────────────────────────────────────────────────────────────────
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
    if (total >= 19) return { text: "Medium Fall Risk (~2× increased)", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-300" };
    return { text: "High Fall Risk (~5× increased)", color: "text-red-700", bg: "bg-red-50 border-red-300" };
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

    let soapText = `• Tinetti POMA: ${ts}/28 — ${interp.text}\n`;
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
    soapText += `  Reference: Tinetti (1986). JAGS, 34(2), 119–126.`;

    onSave(scoreTinetti(
      { balance_scores: balanceScores, gait_scores: gaitScores, notes },
      { assessmentName: 'Tinetti Performance Oriented Mobility Assessment', assessmentDate: todayLocal(), notes, client },
    ));

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
              <p className="text-sm text-slate-500 mt-0.5">Balance (0–16) + Gait (0–12) = Total (0–28)</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>×</Button>
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
                Balance ({balanceScore()}/16) — {Object.keys(balanceScores).length}/{balanceItems.length} done
              </TabsTrigger>
              <TabsTrigger value="gait">
                Gait ({gaitScore()}/12) — {Object.keys(gaitScores).length}/{gaitItems.length} done
              </TabsTrigger>
            </TabsList>

            {/* ── Balance Tab ── */}
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

            {/* ── Gait Tab ── */}
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
            <p className="font-semibold text-slate-700">📊 Score Interpretation</p>
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
                  <td className="p-2 font-medium">25–28</td>
                  <td className="p-2 text-green-700">Low fall risk</td>
                  <td className="p-2 text-slate-600">Preventive exercise / education</td>
                </tr>
                <tr className="border-t bg-yellow-50">
                  <td className="p-2 font-medium">19–24</td>
                  <td className="p-2 text-yellow-700">Medium fall risk (~2× increased)</td>
                  <td className="p-2 text-slate-600">Balance/strengthening program</td>
                </tr>
                <tr className="border-t bg-red-50">
                  <td className="p-2 font-medium">&lt;19</td>
                  <td className="p-2 text-red-700">High fall risk (~5× increased)</td>
                  <td className="p-2 text-slate-600">Multidisciplinary fall prevention</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-slate-500">MCID = 3 points. Balance max = 16 pts; Gait max = 12 pts.</p>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">📖 References</p>
            <p>1. Tinetti ME. (1986). Performance-oriented assessment of mobility problems in elderly patients. <em>JAGS, 34</em>(2), 119–126.</p>
            <p>2. Faber MJ et al. (2006). Effects of exercise programs on falls and mobility in frail and pre-frail older adults. <em>Arch Phys Med Rehab, 87</em>(7), 885–896.</p>
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
