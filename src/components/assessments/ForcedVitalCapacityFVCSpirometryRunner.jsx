import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Plus, Trash2, Info, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

// GOLD Classification based on FEV1% predicted
function goldClassify(fev1pct) {
  if (fev1pct >= 80) return { stage: "GOLD 1 â€” Mild", color: "bg-green-100 text-green-800 border-green-300" };
  if (fev1pct >= 50) return { stage: "GOLD 2 â€” Moderate", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  if (fev1pct >= 30) return { stage: "GOLD 3 â€” Severe", color: "bg-orange-100 text-orange-800 border-orange-300" };
  return { stage: "GOLD 4 â€” Very Severe", color: "bg-red-100 text-red-800 border-red-300" };
}

function ObstructionLabel({ ratio }) {
  if (ratio === null) return null;
  if (ratio < 0.7) return <span className="text-red-600 font-semibold">Obstruction likely (FEV1/FVC &lt;0.7)</span>;
  return <span className="text-green-600 font-semibold">No obstruction (FEV1/FVC â‰¥0.7)</span>;
}

const EMPTY_TRIAL = { fvc: "", fev1: "", pef: "" };

export default function ForcedVitalCapacityFVCSpirometryRunner({ client, onSave, onClose }) {
  const [trials, setTrials] = useState([{ ...EMPTY_TRIAL }]);
  const [height, setHeight] = useState(client?.apss_s2_height_cm?.toString() || "");
  const [predictedFVC, setPredictedFVC] = useState("");
  const [predictedFEV1, setPredictedFEV1] = useState("");
  const [notes, setNotes] = useState("");
  const [expandedSection, setExpandedSection] = useState(null);

  const updateTrial = (i, field, val) => {
    const updated = trials.map((t, idx) => (idx === i ? { ...t, [field]: val } : t));
    setTrials(updated);
  };

  const addTrial = () => {
    if (trials.length >= 5) {
      toast.error("Maximum 5 trials");
      return;
    }
    setTrials([...trials, { ...EMPTY_TRIAL }]);
  };

  const removeTrial = (i) => setTrials(trials.filter((_, idx) => idx !== i));

  // Best values (highest FVC and FEV1 across trials â€” ATS/ERS criterion)
  const validTrials = trials.filter((t) => t.fvc && !isNaN(parseFloat(t.fvc)));
  const bestFVC = validTrials.length > 0 ? Math.max(...validTrials.map((t) => parseFloat(t.fvc))) : null;
  const bestFEV1 =
    trials.filter((t) => t.fev1 && !isNaN(parseFloat(t.fev1))).length > 0
      ? Math.max(...trials.filter((t) => t.fev1).map((t) => parseFloat(t.fev1)))
      : null;
  const bestPEF =
    trials.filter((t) => t.pef && !isNaN(parseFloat(t.pef))).length > 0
      ? Math.max(...trials.filter((t) => t.pef).map((t) => parseFloat(t.pef)))
      : null;

  const fev1FvcRatio = bestFVC && bestFEV1 ? parseFloat((bestFEV1 / bestFVC).toFixed(3)) : null;
  const fev1pct =
    bestFEV1 && predictedFEV1 ? parseFloat(((bestFEV1 / parseFloat(predictedFEV1)) * 100).toFixed(1)) : null;
  const fvcPct =
    bestFVC && predictedFVC ? parseFloat(((bestFVC / parseFloat(predictedFVC)) * 100).toFixed(1)) : null;
  const gold = fev1pct && fev1FvcRatio < 0.7 ? goldClassify(fev1pct) : null;

  const handleSave = () => {
    const trialLines = trials
      .filter((t) => t.fvc)
      .map(
        (t, i) =>
          `  Trial ${i + 1}: FVC ${t.fvc}L${t.fev1 ? ` | FEV1 ${t.fev1}L` : ""}${t.pef ? ` | PEF ${t.pef} L/min` : ""}`
      )
      .join("\n");
    const soap = `â€¢ FVC Spirometry (ATS/ERS standards)\n  Best FVC: ${bestFVC}L${fvcPct ? ` (${fvcPct}% predicted)` : ""}\n  Best FEV1: ${bestFEV1 ?? "N/A"}L${fev1pct ? ` (${fev1pct}% predicted)` : ""}\n  FEV1/FVC Ratio: ${fev1FvcRatio ?? "N/A"}\n  Best PEF: ${bestPEF ?? "N/A"} L/min${gold ? `\n  GOLD Classification: ${gold.stage}` : ""}${fev1FvcRatio !== null ? `\n  ${fev1FvcRatio < 0.7 ? "Obstructive pattern (FEV1/FVC <0.7)" : "No obstruction detected (FEV1/FVC â‰¥0.7)"}` : ""}\n  Trials:\n${trialLines}${notes ? `\n  Notes: ${notes}` : ""}\n  Reference: GOLD (2023). Global Strategy for COPD; ATS/ERS Task Force (2005). Standardisation of Spirometry. ERJ, 26(2):319-338.`;
    onSave({
      status: "completed",
      result_value: bestFVC,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
      additional_data: {
        soap_text: soap,
        measurement_type: "spirometry",
        best_fvc_L: bestFVC,
        best_fev1_L: bestFEV1,
        best_pef_L_per_min: bestPEF,
        fev1_fvc_ratio: fev1FvcRatio,
        fev1_pct_predicted: fev1pct,
        fvc_pct_predicted: fvcPct,
        gold_stage: gold?.stage || null,
        trials: validTrials.map((t) => ({
          fvc: parseFloat(t.fvc),
          fev1: t.fev1 ? parseFloat(t.fev1) : null,
          pef: t.pef ? parseFloat(t.pef) : null,
        })),
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b bg-gradient-to-r from-sky-50 to-blue-50 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">FVC Spirometry</h2>
            <p className="text-slate-600 text-sm mt-1">Forced Vital Capacity â€” ATS/ERS standards</p>
            <p className="text-xs text-slate-500 mt-1">Client: {client?.full_name || "Unknown"}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overview */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Assessment Overview</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div>
                <p className="font-semibold text-slate-900">Purpose:</p>
                <p className="text-slate-700">
                  Measures the maximum amount of air exhaled after a maximal inhalation (FVC) and the amount exhaled in the first second (FEV1). Used to assess pulmonary function, detect obstructive or restrictive airway disease, monitor COPD progression, and evaluate response to bronchodilators.
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Primary Values:</p>
                <p className="text-slate-700">
                  <strong>FVC (L):</strong> Total vital capacity | <strong>FEV1 (L):</strong> Forced expiratory volume in 1 second | <strong>FEV1/FVC Ratio:</strong> Diagnostic marker for obstruction (&lt;0.7)
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Standards:</p>
                <p className="text-slate-700">ATS/ERS Task Force 2005 standards; GOLD (Global Initiative for COPD) 2023 for disease classification.</p>
              </div>
            </CardContent>
          </Card>

          {/* Equipment & Setup */}
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <button
                onClick={() => setExpandedSection(expandedSection === "equipment" ? null : "equipment")}
                className="w-full flex items-center justify-between font-semibold text-amber-900 hover:text-amber-700"
              >
                <span className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Equipment &amp; Software
                </span>
                {expandedSection === "equipment" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </CardHeader>
            {expandedSection === "equipment" && (
              <CardContent className="text-xs text-amber-900 space-y-3">
                <div className="bg-white p-3 rounded border border-amber-200">
                  <p className="font-semibold mb-1">Common Spirometer Manufacturers:</p>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span><strong>EasyOne Pro:</strong> Leading portable spirometer (NSpire Health)</span>
                      <Button
                        onClick={() => window.open("https://www.nspirehealth.com/", "_blank")}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Visit
                      </Button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span><strong>MGC Diagnostics VMAX:</strong> Clinical-grade system</span>
                      <Button
                        onClick={() => window.open("https://www.mgcdiagnostics.com/", "_blank")}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Visit
                      </Button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span><strong>Vyaire Vyntus ONE:</strong> Portable clinical spirometer</span>
                      <Button
                        onClick={() => window.open("https://www.vyaire.com/", "_blank")}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Visit
                      </Button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span><strong>CareFusion Vitalograph ALPHA:</strong> Budget-friendly option</span>
                      <Button
                        onClick={() => window.open("https://www.vitalograph.co.uk/", "_blank")}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Visit
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-3 rounded border border-amber-200">
                  <p className="font-semibold mb-1">Setup Checklist:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Spirometer calibrated daily with 3L syringe per ATS/ERS</li>
                    <li>Disposable mouthpieces for each client</li>
                    <li>Nose clip to prevent nasal air leak</li>
                    <li>Software updated to latest ATS/ERS standards</li>
                    <li>Temperature/humidity compensation enabled</li>
                    <li>Pre-bronchodilator and post-bronchodilator data collection capability</li>
                  </ul>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Clinician Instructions */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <button
                onClick={() => setExpandedSection(expandedSection === "protocol" ? null : "protocol")}
                className="w-full flex items-center justify-between font-semibold text-blue-900 hover:text-blue-700"
              >
                <span className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Protocol &amp; Instructions
                </span>
                {expandedSection === "protocol" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </CardHeader>
            {expandedSection === "protocol" && (
              <CardContent className="text-xs text-blue-900 space-y-3">
                <div className="bg-white p-3 rounded border border-blue-200">
                  <p className="font-semibold mb-1">Position &amp; Technique:</p>
                  <p><strong>Position:</strong> Seated upright, feet flat on floor, back supported</p>
                  <p><strong>Nose clip:</strong> Applied to prevent nasal airflow</p>
                  <p><strong>Mouthpiece:</strong> Sealed lips around mouthpiece; no air leakage</p>
                  <p><strong>Manoeuvre:</strong> Maximal inhalation â†’ seal lips immediately â†’ blast out as hard and fast as possible until lungs are completely empty â†’ encourage forcefully throughout test</p>
                </div>
                <div className="bg-white p-3 rounded border border-blue-200">
                  <p className="font-semibold mb-1">Acceptability Criteria (ATS/ERS):</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Minimum 3 acceptable efforts</strong></li>
                    <li>FVC reproducibility: Best and second-best within 0.150L or 5%</li>
                    <li>FEV1 reproducibility: Best and second-best within 0.150L or 5%</li>
                    <li>No coughing in first second; no glottis closure</li>
                    <li>Adequate flow termination (plateau in volume-time curve)</li>
                    <li>No variable effort or hesitation at start</li>
                  </ul>
                </div>
                <div className="bg-white p-3 rounded border border-blue-200 italic">
                  <p className="font-semibold mb-1">Clinician Script:</p>
                  <p>"I'd like you to measure your lung function. You'll take a deep breath in, then blow out as hard and as fast as you can until your lungs are empty. We might need to do this 3â€“5 times to get good results. Let me know if you have any questions."</p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Interpretation Guide */}
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <button
                onClick={() => setExpandedSection(expandedSection === "interpretation" ? null : "interpretation")}
                className="w-full flex items-center justify-between font-semibold text-green-900 hover:text-green-700"
              >
                <span>Interpretation &amp; Normative Data</span>
                {expandedSection === "interpretation" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </CardHeader>
            {expandedSection === "interpretation" && (
              <CardContent className="text-xs text-green-900 space-y-2">
                <div className="bg-white p-2 rounded border border-green-200">
                  <p className="font-semibold mb-1">FEV1/FVC Ratio â€” Obstruction Marker:</p>
                  <p><strong>â‰¥0.7 (â‰¥70%):</strong> Normal; no airflow obstruction</p>
                  <p><strong>&lt;0.7 (&lt;70%):</strong> Obstructive airway disease (COPD, asthma)</p>
                </div>
                <div className="bg-white p-2 rounded border border-green-200">
                  <p className="font-semibold mb-1">FEV1 % Predicted â€” Severity (GOLD):</p>
                  <p><strong>â‰¥80%:</strong> Normal or Mild obstruction</p>
                  <p><strong>50â€“79%:</strong> Moderate obstruction</p>
                  <p><strong>30â€“49%:</strong> Severe obstruction</p>
                  <p><strong>&lt;30%:</strong> Very Severe obstruction</p>
                </div>
                <div className="bg-white p-2 rounded border border-green-200">
                  <p className="font-semibold mb-1">Pattern Recognition:</p>
                  <p><strong>Obstructive Pattern:</strong> FEV1/FVC &lt;0.7; FVC normal or reduced; FEV1 reduced</p>
                  <p><strong>Restrictive Pattern:</strong> FEV1/FVC normal or high; both FVC and FEV1 reduced proportionally</p>
                  <p><strong>Mixed Pattern:</strong> Both obstruction (FEV1/FVC &lt;0.7) and restriction (â†“ FVC)</p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* References */}
          <Card className="border-slate-200 bg-slate-50">
            <CardHeader>
              <button
                onClick={() => setExpandedSection(expandedSection === "references" ? null : "references")}
                className="w-full flex items-center justify-between font-semibold text-slate-900 hover:text-slate-700"
              >
                <span>References &amp; Standards</span>
                {expandedSection === "references" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </CardHeader>
            {expandedSection === "references" && (
              <CardContent className="text-xs text-slate-700 space-y-2">
                <p>
                  <strong>Miller, M. R., Hankinson, J., Brusasco, V., Burgos, F., Casaburi, R., Coates, A., et al.</strong> (2005). Standardisation of spirometry. <em>European Respiratory Journal</em>, 26(2), 319â€“338.
                </p>
                <p>
                  <strong>GOLD (Global Initiative for Chronic Obstructive Lung Disease).</strong> (2023). Global Strategy for the Diagnosis, Management, and Prevention of COPD. Retrieved from{" "}
                  <Button
                    onClick={() => window.open("https://goldcopd.org/", "_blank")}
                    variant="outline"
                    size="sm"
                    className="text-xs inline"
                  >
                    goldcopd.org
                    <ExternalLink className="w-2 h-2 ml-1" />
                  </Button>
                </p>
                <p>
                  <strong>American Thoracic Society (ATS).</strong> Spirometry Resources:{" "}
                  <Button
                    onClick={() => window.open("https://www.thoracic.org/", "_blank")}
                    variant="outline"
                    size="sm"
                    className="text-xs inline"
                  >
                    thoracic.org
                    <ExternalLink className="w-2 h-2 ml-1" />
                  </Button>
                </p>
              </CardContent>
            )}
          </Card>

          {/* Protocol Summary Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-2">
              <Info className="w-4 h-4" />
              Protocol Summary
            </p>
            <p>
              <strong>Position:</strong> Seated upright, nose clip on, feet flat.
            </p>
            <p>
              <strong>Manoeuvre:</strong> Maximal inhalation â†’ seal lips â†’ blast out as hard and fast as possible until lungs are empty. Encourage forcefully throughout.
            </p>
            <p>
              <strong>Acceptability:</strong> 3 acceptable efforts minimum. Best FVC and best FEV1 may come from different blows.
            </p>
          </div>

          {/* Data Entry */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-sm font-medium">Height (cm)</Label>
              <Input
                type="number"
                step="0.5"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Predicted FVC (L)</Label>
              <Input
                type="number"
                step="0.01"
                value={predictedFVC}
                onChange={(e) => setPredictedFVC(e.target.value)}
                placeholder="e.g. 3.85"
                className="mt-2"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Predicted FEV1 (L)</Label>
              <Input
                type="number"
                step="0.01"
                value={predictedFEV1}
                onChange={(e) => setPredictedFEV1(e.target.value)}
                placeholder="e.g. 3.10"
                className="mt-2"
              />
            </div>
          </div>

          {/* Trials */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">Trials</CardTitle>
                <Button size="sm" variant="outline" onClick={addTrial} disabled={trials.length >= 5}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Trial
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {trials.map((t, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 items-end bg-slate-50 p-3 rounded-lg">
                  <div>
                    <Label className="text-xs">FVC (L) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={t.fvc}
                      onChange={(e) => updateTrial(i, "fvc", e.target.value)}
                      className="mt-1"
                      placeholder="e.g. 3.72"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">FEV1 (L)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={t.fev1}
                      onChange={(e) => updateTrial(i, "fev1", e.target.value)}
                      className="mt-1"
                      placeholder="e.g. 2.85"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">PEF (L/min)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={t.pef}
                      onChange={(e) => updateTrial(i, "pef", e.target.value)}
                      className="mt-1"
                      placeholder="e.g. 420"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTrial(i)}
                    disabled={trials.length === 1}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Results Summary */}
          {bestFVC && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500">Best FVC</p>
                <p className="text-3xl font-bold text-sky-700">{bestFVC} L</p>
                {fvcPct && <p className="text-sm text-sky-600">{fvcPct}% predicted</p>}
              </div>
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500">Best FEV1</p>
                <p className="text-3xl font-bold text-sky-700">{bestFEV1 ?? "â€”"} L</p>
                {fev1pct && <p className="text-sm text-sky-600">{fev1pct}% predicted</p>}
              </div>
              <div className="bg-slate-50 border rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500">FEV1/FVC Ratio</p>
                <p className="text-2xl font-bold">{fev1FvcRatio ?? "â€”"}</p>
                {fev1FvcRatio && <ObstructionLabel ratio={fev1FvcRatio} />}
              </div>
              <div className="bg-slate-50 border rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500">Best PEF</p>
                <p className="text-2xl font-bold">{bestPEF ?? "â€”"}</p>
                {bestPEF && <p className="text-xs text-slate-500">L/min</p>}
              </div>
            </div>
          )}

          {gold && (
            <div className={`border-2 rounded-xl p-4 text-center ${gold.color}`}>
              <p className="font-bold text-lg">{gold.stage}</p>
              <p className="text-sm mt-0.5">Based on FEV1 {fev1pct}% predicted with obstruction present</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="text-sm font-medium">Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Technique quality, cough, effort, bronchodilator use, spirometer type..."
              rows={3}
              className="mt-2"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-sky-600 hover:bg-sky-700">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}