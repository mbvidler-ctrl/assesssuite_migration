import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, Info, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function FunctionalReachTestRunner({ client, onSave, onClose }) {
  const [trials, setTrials] = useState([]);
  const [startPosition, setStartPosition] = useState("");
  const [endPosition, setEndPosition] = useState("");
  const [notes, setNotes] = useState("");
  const [showInfo, setShowInfo] = useState(true);

  const handleRecordTrial = () => {
    if (!startPosition || !endPosition) {
      toast.error("Please enter both start and end positions.");
      return;
    }
    const reachDistance = parseFloat(endPosition) - parseFloat(startPosition);
    setTrials((prev) => [...prev, reachDistance]);
    setStartPosition("");
    setEndPosition("");
    toast.success(`Trial ${trials.length + 1} recorded: ${reachDistance.toFixed(1)} cm`);
  };

  const handleSave = () => {
    if (trials.length < 3) {
      toast.error("Please complete at least 3 trials.");
      return;
    }
    const avgReach = trials.reduce((sum, val) => sum + val, 0) / trials.length;
    let fallRisk = "";
    if (avgReach < 15) fallRisk = "High";
    else if (avgReach <= 25) fallRisk = "Moderate";
    else fallRisk = "Low";

    onSave({
      status: "completed",
      result_value: avgReach,
      additional_data: {
        soap_text: `• Functional Reach Test\n  Average Reach: ${avgReach.toFixed(1)} cm — ${fallRisk} Fall Risk\n  Trials: ${trials.map(t => t.toFixed(1) + ' cm').join(', ')}`,
        measurement_type: "Functional Reach",
        trials,
        fall_risk: fallRisk,
      },
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("Assessment saved.");
  };

  const avgReach = trials.length > 0 ? trials.reduce((s, v) => s + v, 0) / trials.length : null;

  return (
    <div className="p-4 space-y-4">

      {/* Clinician Info Panel */}
      <div className="border border-indigo-200 rounded-lg overflow-hidden">
        <button onClick={() => setShowInfo(v => !v)} className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 transition-colors">
          <span className="flex items-center gap-2 text-indigo-800 font-semibold text-sm">
            <Info className="w-4 h-4" />Clinician Information &amp; References
          </span>
          {showInfo ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4 text-indigo-600" />}
        </button>
        {showInfo && (
          <div className="px-4 py-4 space-y-4 text-sm bg-white">

            <div>
              <p className="font-semibold text-slate-800 mb-1">Purpose</p>
              <p className="text-xs text-slate-600">The Functional Reach Test (FRT) measures the maximum distance a person can reach forward beyond arm's length while maintaining a fixed base of support in standing. It is used as a quick clinical measure of dynamic balance and fall risk.</p>
            </div>

            {/* Setup diagram image */}
            <div>
              <p className="font-semibold text-slate-800 mb-2">Setup &amp; Position</p>
              <img
                src="https://www.physio-pedia.com/images/thumb/e/e4/Functional_reach_test.jpg/400px-Functional_reach_test.jpg"
                alt="Functional Reach Test setup diagram"
                className="rounded-lg border border-slate-200 w-full max-w-xs mx-auto block"
                onError={e => e.target.style.display = 'none'}
              />
              <p className="text-xs text-slate-500 text-center mt-1 italic">Patient stands beside wall-mounted yardstick/tape measure</p>
            </div>

            <div>
              <p className="font-semibold text-slate-800 mb-1">Equipment</p>
              <ul className="text-xs text-slate-600 list-disc list-inside space-y-0.5">
                <li>Wall-mounted yardstick or measuring tape (positioned at shoulder height)</li>
                <li>Firm, flat surface</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-slate-800 mb-1">Administration Instructions</p>
              <ol className="text-xs text-slate-600 list-decimal list-inside space-y-1">
                <li>Have the patient stand parallel to the wall-mounted measuring tape, feet shoulder-width apart, dominant arm raised to 90° shoulder flexion with hand closed in a fist</li>
                <li>Record the starting position at the tip of the third metacarpal (start position)</li>
                <li>Ask the patient to reach forward as far as possible without taking a step or losing balance</li>
                <li>Record the end position at the tip of the third metacarpal</li>
                <li>Reach distance = end position − start position</li>
                <li>Perform 1 practice trial, then record <strong>3 valid trials</strong></li>
                <li>Average the 3 trial scores for the final result</li>
                <li>Discard any trial where a step is taken or balance is lost</li>
              </ol>
            </div>

            <div>
              <p className="font-semibold text-slate-800 mb-1">Fall Risk Interpretation</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between bg-red-50 px-3 py-1.5 rounded">
                  <span className="font-semibold text-red-800">&lt; 15 cm</span>
                  <span className="text-red-700">High fall risk</span>
                </div>
                <div className="flex justify-between bg-orange-50 px-3 py-1.5 rounded">
                  <span className="font-semibold text-orange-800">15–25 cm</span>
                  <span className="text-orange-700">Moderate fall risk</span>
                </div>
                <div className="flex justify-between bg-green-50 px-3 py-1.5 rounded">
                  <span className="font-semibold text-green-800">&gt; 25 cm</span>
                  <span className="text-green-700">Low fall risk</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">Normative values vary by age/sex. Healthy adults typically reach 25–40 cm. Values below 15 cm are associated with 4× increased fall risk (Duncan et al., 1992).</p>
            </div>

            <div>
              <p className="font-semibold text-slate-800 mb-1">Psychometric Properties</p>
              <ul className="text-xs text-slate-600 list-disc list-inside space-y-0.5">
                <li>Good test-retest reliability (ICC = 0.89–0.92)</li>
                <li>Good intra-rater reliability (ICC = 0.87–0.98)</li>
                <li>Sensitivity 70%, specificity 58% for predicting falls in community-dwelling older adults</li>
                <li>MCID: approximately 3–4 cm in older adults</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-slate-800 mb-1">Key References</p>
              <div className="text-xs text-slate-600 space-y-1.5">
                <p><strong>Duncan PW, Weiner DK, Chandler J, Studenski S.</strong> (1990). Functional reach: a new clinical measure of balance. <em>Journal of Gerontology</em>, 45(6), M192–M197.</p>
                <p><strong>Duncan PW, Studenski S, Chandler J, Prescott B.</strong> (1992). Functional reach: predictive validity in a sample of elderly male veterans. <em>Journal of Gerontology</em>, 47(3), M93–M98.</p>
                <p><strong>Weiner DK, Bongiorni DR, Studenski SA, Duncan PW, Kochersberger GG.</strong> (1993). Does functional reach improve with rehabilitation? <em>Archives of Physical Medicine and Rehabilitation</em>, 74(8), 796–800.</p>
              </div>
              <button
                onClick={() => window.open('https://www.sralab.org/sites/default/files/2021-08/Functional%20Reach%20Test%20(FRT)_0.pdf', '_blank')}
                className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <ExternalLink className="w-3 h-3" /> Rehab Measures Database — FRT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Test inputs */}
      <div className="bg-white border rounded-lg p-4 space-y-4">
        <h3 className="font-semibold text-slate-800">Functional Reach Test</h3>
        <div>
          <Label>Start Position (cm)</Label>
          <Input
            type="number"
            value={startPosition}
            onChange={(e) => setStartPosition(e.target.value)}
            placeholder="Enter start position"
          />
        </div>
        <div>
          <Label>End Position (cm)</Label>
          <Input
            type="number"
            value={endPosition}
            onChange={(e) => setEndPosition(e.target.value)}
            placeholder="Enter end position"
          />
        </div>
        <Button onClick={handleRecordTrial} className="w-full">Record Trial</Button>

        {trials.length > 0 && (
          <div>
            <Label>Recorded Trials</Label>
            <div className="mt-1 space-y-1">
              {trials.map((trial, idx) => (
                <div key={idx} className="flex justify-between text-sm bg-slate-50 px-3 py-1.5 rounded border">
                  <span className="text-slate-600">Trial {idx + 1}</span>
                  <span className="font-semibold text-slate-800">{trial.toFixed(1)} cm</span>
                </div>
              ))}
              {avgReach !== null && (
                <div className="flex justify-between text-sm bg-blue-50 px-3 py-1.5 rounded border border-blue-200 font-semibold">
                  <span className="text-blue-700">Average</span>
                  <span className="text-blue-800">{avgReach.toFixed(1)} cm — {avgReach < 15 ? "High" : avgReach <= 25 ? "Moderate" : "Low"} Fall Risk</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter notes"
          />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onClose}><X className="mr-2 w-4 h-4" />Close</Button>
        <Button onClick={handleSave}><Save className="mr-2 w-4 h-4" />Save</Button>
      </div>
    </div>
  );
}