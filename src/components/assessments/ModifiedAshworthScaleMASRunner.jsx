import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Save, Info, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const MUSCLES = [
  "Elbow Flexors",
  "Elbow Extensors",
  "Wrist Flexors",
  "Wrist Extensors",
  "Finger Flexors",
  "Hip Flexors",
  "Hip Extensors",
  "Hip Abductors",
  "Hip Adductors",
  "Knee Flexors",
  "Knee Extensors",
  "Ankle Plantarflexors",
  "Ankle Dorsiflexors"
];

const MAS_GRADES = [
  { score: 0, label: "0 - No increase in muscle tone" },
  { score: 1, label: "1 - Slight increase in muscle tone" },
  { score: "1+", label: "1+ - Slight increase with brief catch" },
  { score: 2, label: "2 - Marked increase in muscle tone" },
  { score: 3, label: "3 - Considerable increase in muscle tone" },
  { score: 4, label: "4 - Rigid (passive movement difficult)" }
];

export default function ModifiedAshworthScaleMASRunner({ client, onSave, onClose }) {
  const [muscle, setMuscle] = useState("");
  const [score, setScore] = useState("");
  const [muscles, setMuscles] = useState([]);
  const [notes, setNotes] = useState("");
  const [expandedSection, setExpandedSection] = useState("instructions");

  const addMuscle = () => {
    if (!muscle || !score) {
      toast.error("Please select both muscle and grade");
      return;
    }

    const gradeLabel = MAS_GRADES.find(g => String(g.score) === String(score))?.label;
    setMuscles([...muscles, { muscle, score, label: gradeLabel }]);
    setMuscle("");
    setScore("");
  };

  const removeMuscle = (index) => {
    setMuscles(muscles.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (muscles.length === 0) {
      toast.error("Please assess at least one muscle");
      return;
    }

    const soapText = `â€¢ Modified Ashworth Scale (MAS):\n${muscles.map(m => `  ${m.muscle}: ${m.label}`).join("\n")}${notes ? `\n\n  Clinical Notes: ${notes}` : ''}`;

    onSave({
      result_value: muscles.length,
      additional_data: {
        soap_text: soapText,
        muscles: muscles.map(m => ({ muscle: m.muscle, score: m.score })),
        assessment_date: new Date().toISOString().split("T")[0]
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Modified Ashworth Scale (MAS)</h2>
              <p className="text-slate-600 text-sm mt-1">Assess muscle tone across joints</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Expandable Instructions */}
            <button
              onClick={() => setExpandedSection(expandedSection === "instructions" ? null : "instructions")}
              className="w-full flex justify-between items-center px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg font-semibold text-blue-900 hover:bg-blue-100 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                Clinician Instructions & Assessment Overview
              </span>
              {expandedSection === "instructions" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expandedSection === "instructions" && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6 space-y-4 text-sm">
                  <div>
                    <p className="font-semibold text-blue-900 mb-2">Purpose</p>
                    <p className="text-blue-800">The Modified Ashworth Scale (MAS) is a quick, reliable, and valid ordinal scale used to measure muscle spasticity in patients with upper motor neuron lesions (e.g., stroke, spinal cord injury, cerebral palsy). It assesses resistance to passive stretch across joints.</p>
                  </div>

                  <div>
                    <p className="font-semibold text-blue-900 mb-2">Administration Protocol</p>
                    <ul className="text-blue-800 space-y-2 list-disc list-inside">
                      <li><strong>Patient Position:</strong> Ensure patient is relaxed and comfortable (supine, prone, or seated depending on muscle group).</li>
                      <li><strong>Speed of Movement:</strong> Passively move the joint through full range of motion at a slow, consistent speed (â‰ˆ1 second per direction).</li>
                      <li><strong>Grading:</strong> Assess the resistance felt throughout the passive movement. Do not grade based on pain or contracture alone.</li>
                      <li><strong>Repetition:</strong> It is recommended to perform the assessment 3 times on each muscle group and use the average score.</li>
                      <li><strong>Testing Muscles:</strong> Common muscle groups include elbow flexors/extensors, wrist flexors/extensors, hip flexors/adductors, and ankle plantarflexors.</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-blue-900 mb-2">Clinical Considerations</p>
                    <ul className="text-blue-800 space-y-1 list-disc list-inside text-xs">
                      <li>Ensure patient is as relaxed as possible (anxiety may increase muscle tone).</li>
                      <li>Move at consistent, moderate speedâ€”rapid movement may elicit a velocity-dependent response.</li>
                      <li>Screen for pain, contracture, and other causes of reduced passive ROM.</li>
                      <li>Bilateral comparisons are more clinically useful than absolute scores.</li>
                      <li>Serial assessments track changes in spasticity over time (baseline, follow-up).</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-blue-900 mb-2">Interpretation & Clinical Significance</p>
                    <ul className="text-blue-800 space-y-1 list-disc list-inside text-xs">
                      <li><strong>Score 0â€“1:</strong> Normal or minimal tone; may not require antispasticity intervention.</li>
                      <li><strong>Score 1+â€“2:</strong> Mild-to-moderate spasticity; monitor for functional impact and consider conservative management (stretching, positioning).</li>
                      <li><strong>Score 3+:</strong> Significant spasticity; likely affecting function and mobility; consider pharmacological or physical interventions.</li>
                      <li><strong>Higher scores:</strong> Associated with limited ROM, contracture risk, and functional disability.</li>
                    </ul>
                  </div>

                  <div className="bg-white p-3 rounded border border-blue-200">
                    <p className="text-xs text-slate-700"><strong>Reliability Note:</strong> The MAS has fair-to-good inter-rater reliability (ICC 0.55â€“0.85) and fair intra-rater reliability. Use consistent technique and avoid confounding variables (pain, patient effort, environmental factors).</p>
                  </div>

                  <div className="bg-white p-3 rounded border border-blue-200">
                    <p className="text-xs text-slate-700 mb-2"><strong>References:</strong></p>
                    <ul className="text-xs space-y-1">
                      <li>Bohannon RW, Smith MB. (1987). Interrater reliability of a modified Ashworth scale of muscle spasticity. <em>Physical Therapy, 67</em>(2), 206-207. <a href="https://pubmed.ncbi.nlm.nih.gov/3809245/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">[PubMed]</a></li>
                      <li>Ansari NN, Naghdi S, Hasson S, et al. (2008). The Modified Ashworth Scale for the assessment of spasticity: A systematic review of its effectiveness. <em>NeuroRehabilitation, 23</em>(4), 355-363.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Grading Scale Reference */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Grading Scale</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {MAS_GRADES.map((grade) => (
                  <div key={grade.score} className="flex items-center gap-3 text-sm">
                    <Badge variant="outline" className="w-12 text-center">{grade.score}</Badge>
                    <p className="text-slate-700">{grade.label.split(" - ")[1]}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Muscle Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Record Muscle Assessment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Select Muscle Group</Label>
                    <select
                      value={muscle}
                      onChange={(e) => setMuscle(e.target.value)}
                      className="w-full mt-2 p-2 border rounded-md text-sm"
                    >
                      <option value="">Choose muscle...</option>
                      {MUSCLES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-sm">Select Grade</Label>
                    <select
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                      className="w-full mt-2 p-2 border rounded-md text-sm"
                    >
                      <option value="">Choose grade...</option>
                      {MAS_GRADES.map((grade) => (
                        <option key={grade.score} value={grade.score}>
                          {grade.score}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button onClick={addMuscle} className="w-full bg-blue-600 hover:bg-blue-700">
                  Add Muscle Assessment
                </Button>
              </CardContent>
            </Card>

            {/* Recorded Assessments */}
            {muscles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recorded Assessments ({muscles.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {muscles.map((m, index) => (
                    <div key={index} className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{m.muscle}</p>
                        <p className="text-sm text-slate-600">{m.label}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMuscle(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observations, laterality differences, pain responses..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={muscles.length === 0} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}