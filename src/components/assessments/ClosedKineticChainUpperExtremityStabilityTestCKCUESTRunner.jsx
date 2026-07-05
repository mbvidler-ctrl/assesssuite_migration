import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const NORMATIVE_DATA = [
  { group: "Male Athletes (collegiate)", mean: 21.9, sd: 4.7 },
  { group: "Female Athletes (collegiate)", mean: 23.1, sd: 4.3 },
  { group: "Male Non-Athletes", mean: 18.5, sd: 4.2 },
  { group: "Female Non-Athletes", mean: 19.8, sd: 3.9 },
  { group: "Shoulder Pathology (post-op)", mean: 13.2, sd: 4.1 },
];

export default function ClosedKineticChainUpperExtremityStabilityTestCKCUESTRunner({ client, onSave, onClose }) {
  const [trial1, setTrial1] = useState("");
  const [trial2, setTrial2] = useState("");
  const [trial3, setTrial3] = useState("");
  const [notes, setNotes] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [showInstructions, setShowInstructions] = useState(false);

  const t1 = parseFloat(trial1) || 0;
  const t2 = parseFloat(trial2) || 0;
  const t3 = parseFloat(trial3) || 0;
  const values = [t1, t2, t3].filter(v => v > 0);
  const average = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : null;
  const best = values.length ? Math.max(...values) : null;

  const handleSave = () => {
    if (!t1 && !t2 && !t3) {
      toast.error("Please enter at least one trial result.");
      return;
    }

    const additionalData = {
      soap_text: `• Closed Kinetic Chain Upper Extremity Stability Test (CKCUEST)\n  Trial 1: ${t1} touches | Trial 2: ${t2} touches | Trial 3: ${t3} touches\n  Average: ${average} touches | Best: ${best} touches`,
      measurement_type: "ckcuest",
      trial1: t1, trial2: t2, trial3: t3,
      average, best,
    };

    onSave({
      status: "completed",
      result_value: Number(average),
      additional_data: additionalData,
      notes,
      assessment_date: assessmentDate,
    });
    toast.success("Test data saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <Card className="w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 sticky top-0 bg-white z-10 border-b pb-4">
          <div>
            <CardTitle className="text-lg font-bold">Closed Kinetic Chain Upper Extremity Stability Test (CKCUEST)</CardTitle>
            {client && <p className="text-sm text-slate-600 mt-1">Client: <strong>{client.full_name}</strong></p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">

          {/* Collapsible Instructions */}
          <div className="border border-blue-200 rounded-lg overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between bg-blue-50 px-4 py-3 text-left"
              onClick={() => setShowInstructions(!showInstructions)}
            >
              <span className="font-semibold text-blue-900 text-sm">📋 Equipment, Instructions & References</span>
              {showInstructions ? <ChevronUp className="w-4 h-4 text-blue-700" /> : <ChevronDown className="w-4 h-4 text-blue-700" />}
            </button>

            {showInstructions && (
              <div className="bg-white px-4 py-4 space-y-4 text-sm">

                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Purpose</h4>
                  <p className="text-slate-700">The CKCUEST measures upper extremity stability, strength, and neuromuscular control in a closed kinetic chain position. It is commonly used for athletic screening and return-to-sport decision-making following shoulder injury or surgery.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Equipment Required</h4>
                  <ul className="list-disc list-inside text-slate-700 space-y-1">
                    <li>Tape measure</li>
                    <li>Two pieces of tape marked <strong>90 cm (36 inches) apart</strong> on the floor</li>
                    <li>Stopwatch (15-second count)</li>
                    <li>Smooth, non-slip floor surface</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Starting Position</h4>
                  <ul className="list-disc list-inside text-slate-700 space-y-1">
                    <li>Client assumes a <strong>standard push-up position</strong> (hands on floor, body straight)</li>
                    <li>Both hands placed on the <strong>same tape mark</strong> to start</li>
                    <li>For females, a modified position (knees down) may be used — document accordingly</li>
                    <li>Feet shoulder-width apart for stability</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Test Protocol</h4>
                  <ol className="list-decimal list-inside text-slate-700 space-y-1">
                    <li>Client starts with both hands on one tape mark</li>
                    <li>On "Go", client <strong>alternately touches the opposite tape mark</strong> with each hand as fast as possible</li>
                    <li>Each hand touch to the opposite mark = <strong>1 touch</strong></li>
                    <li>Timer runs for <strong>15 seconds</strong></li>
                    <li>Count total number of touches (each single-hand touch = 1)</li>
                    <li>Rest <strong>45 seconds</strong> between trials</li>
                    <li>Complete <strong>3 trials</strong> and record all scores</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Scoring</h4>
                  <ul className="list-disc list-inside text-slate-700 space-y-1">
                    <li>Score = total touches in 15 seconds per trial</li>
                    <li>Report <strong>average</strong> of all 3 trials as the primary outcome</li>
                    <li>Also note the <strong>best</strong> trial score</li>
                    <li>A <strong>Symmetry Index</strong> can be calculated if testing dominant vs non-dominant sides separately: (non-dom / dom) × 100</li>
                  </ul>
                </div>

                {/* Illustration */}
                <div>
                  <h4 className="font-semibold text-slate-800 mb-2">Test Setup Diagram</h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">L</div>
                      <div className="flex-1 border-t-2 border-dashed border-slate-400 relative">
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-slate-500 whitespace-nowrap">â† 90 cm →</span>
                      </div>
                      <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold">R</div>
                    </div>
                    <p className="text-xs text-slate-500 mt-3">Client in push-up position alternately touches each mark with opposite hand</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-800 mb-2">Normative Data</h4>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 px-2 py-1 text-left">Population</th>
                        <th className="border border-slate-300 px-2 py-1 text-center">Mean (touches)</th>
                        <th className="border border-slate-300 px-2 py-1 text-center">SD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {NORMATIVE_DATA.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="border border-slate-300 px-2 py-1">{row.group}</td>
                          <td className="border border-slate-300 px-2 py-1 text-center">{row.mean}</td>
                          <td className="border border-slate-300 px-2 py-1 text-center">±{row.sd}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-slate-500 mt-1">Goldbeck & Davies (2000); Uhl et al. (2003). Values per 15-second trial.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-800 mb-2">References & Resources</h4>
                  <div className="space-y-1.5">
                    <a href="https://www.sralab.org/rehabilitation-measures/closed-kinetic-chain-upper-extremity-stability-test" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 underline">
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      Shirley Ryan AbilityLab – CKCUEST
                    </a>
                    <a href="https://pubmed.ncbi.nlm.nih.gov/10675076/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 underline">
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      Goldbeck & Davies (2000) – Original CKCUEST validity study (PubMed)
                    </a>
                    <a href="https://pubmed.ncbi.nlm.nih.gov/12710816/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 underline">
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      Uhl et al. (2003) – Normative data &amp; reliability (PubMed)
                    </a>
                    <a href="https://www.physio-pedia.com/Closed_Kinetic_Chain_Upper_Extremity_Stability_Test_(CKCUEST)" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 underline">
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      Physiopedia – CKCUEST
                    </a>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Trial Inputs */}
          <div className="grid grid-cols-3 gap-4">
            {[["Trial 1", trial1, setTrial1], ["Trial 2", trial2, setTrial2], ["Trial 3", trial3, setTrial3]].map(([label, val, setter]) => (
              <div key={label}>
                <Label>{label} (touches)</Label>
                <Input type="number" value={val} onChange={e => setter(e.target.value)} placeholder="e.g. 20" className="mt-1" />
              </div>
            ))}
          </div>

          {/* Live Results Summary */}
          {values.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-800 mb-3 text-sm">Results Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-500">Average (primary)</p>
                  <p className="text-3xl font-bold text-blue-600">{average}</p>
                  <p className="text-xs text-slate-500">touches</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Best Trial</p>
                  <p className="text-3xl font-bold text-green-600">{best}</p>
                  <p className="text-xs text-slate-500">touches</p>
                </div>
              </div>
            </div>
          )}

          {/* Date */}
          <div>
            <Label>Assessment Date</Label>
            <Input type="date" value={assessmentDate} onChange={e => setAssessmentDate(e.target.value)} className="mt-1" />
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Arm position used (full/modified), pain reported, technique observations..." rows={3} className="mt-1" />
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2 border-t">
            <Button variant="outline" onClick={onClose}><X className="h-4 w-4 mr-2" />Close</Button>
            <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" />Save Test Data</Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}