import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Info, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const ITEMS = [
  {
    key: "supineToSideLying",
    label: "1. Supine to Side Lying",
    grades: [
      { score: 0, desc: "Starting position: Supine, legs extended. Pulls self to side lying (not using bed rail). Rolls to side." },
      { score: 1, desc: "Rolls to side using unaffected arm but legs do not follow as a unit." },
      { score: 2, desc: "Rolls to side, legs follow body. Overall movement not coordinated." },
      { score: 3, desc: "Rolls to side in a coordinated movement. Leg lifts from bed." },
      { score: 4, desc: "Rolls to side in coordinated movement in 3 seconds." },
      { score: 5, desc: "Rolls to side in 2 seconds." },
      { score: 6, desc: "Rolls to side in 1 second." },
    ],
  },
  {
    key: "supineToSitting",
    label: "2. Supine to Sitting over Edge of Bed",
    grades: [
      { score: 0, desc: "Starting position: Side lying. Comes to sitting over side of bed with therapist's assistance." },
      { score: 1, desc: "Side lying to sitting over side of bed — therapist assists patient with movement throughout." },
      { score: 2, desc: "Side lying to sitting over side of bed — therapist provides assistance with legs over side of bed." },
      { score: 3, desc: "Side lying to sitting over side of bed independently." },
      { score: 4, desc: "Side lying to sitting over side of bed independently in 10 seconds." },
      { score: 5, desc: "Side lying to sitting over side of bed independently in 5 seconds." },
      { score: 6, desc: "Side lying to sitting over side of bed independently in 3 seconds." },
    ],
  },
  {
    key: "balancedSitting",
    label: "3. Balanced Sitting",
    grades: [
      { score: 0, desc: "Starting position: Sitting over edge of bed, feet on floor. Must be supervised." },
      { score: 1, desc: "Sits with some weight through affected side. Therapist assists balance." },
      { score: 2, desc: "Sits unsupported for 10 seconds without holding on." },
      { score: 3, desc: "Sits unsupported, picks up small object from floor and returns to start position." },
      { score: 4, desc: "Sits unsupported, turns to look behind over unaffected shoulder, then affected shoulder. Returns to start." },
      { score: 5, desc: "Sitting, lifts both arms above head 10 times." },
      { score: 6, desc: "Sitting, reaches forward, picks up object from floor and returns to start." },
    ],
  },
  {
    key: "sittingToStanding",
    label: "4. Sitting to Standing",
    grades: [
      { score: 0, desc: "Starting position: Sitting over edge of bed. Gets to standing with therapist's assistance." },
      { score: 1, desc: "Gets to standing with therapist providing assistance." },
      { score: 2, desc: "Gets to standing. Uses hands to support self. Weight distributed unevenly." },
      { score: 3, desc: "Gets to standing. Does not use hands. Weight distributed evenly." },
      { score: 4, desc: "Gets to standing and maintains standing position for 5 seconds with knees and hips extended." },
      { score: 5, desc: "Sitting to standing and return to sitting in 10 seconds, 3 times." },
      { score: 6, desc: "Sitting to standing and return to sitting in 5 seconds, 3 times." },
    ],
  },
  {
    key: "walking",
    label: "5. Walking",
    grades: [
      { score: 0, desc: "Stands on affected side, therapist assists with weight bearing and balance." },
      { score: 1, desc: "Walks with therapist support." },
      { score: 2, desc: "Walks with continuous physical support of one person who assists with weight bearing and balance." },
      { score: 3, desc: "Walks independently but uses an aid. No physical support required." },
      { score: 4, desc: "Walks independently without aid for 10 meters (33 feet) in 4 seconds." },
      { score: 5, desc: "Walks 10 meters, picks up a small sandbag from floor, turns and carries it back in 25 seconds." },
      { score: 6, desc: "Walks up and down 4 steps without rail 3 times in 35 seconds." },
    ],
  },
  {
    key: "upperArmFunction",
    label: "6. Upper Arm Function",
    grades: [
      { score: 0, desc: "Starting position: Sitting, arm resting on table. Raises affected arm to opposite shoulder." },
      { score: 1, desc: "Therapist places arm in position. Patient maintains position for 2 seconds." },
      { score: 2, desc: "Therapist places arm. Patient maintains for 10 seconds. Does not support with other hand." },
      { score: 3, desc: "Patient holds arm above head for 2 seconds (shoulder at 90°)." },
      { score: 4, desc: "Patient raises arm to above head, elbows straight, for 10 seconds." },
      { score: 5, desc: "Patient raises arm above head then lowers to touch top of head 10 times." },
      { score: 6, desc: "Patient raises arm above head using both arms — raises affected arm independently." },
    ],
  },
  {
    key: "handMovements",
    label: "7. Hand Movements",
    grades: [
      { score: 0, desc: "Starting position: Forearm resting on table. Wrist extension: patient moves wrist to neutral." },
      { score: 1, desc: "Clinician places wrist in extension. Patient holds position for 2 seconds." },
      { score: 2, desc: "Patient extends wrist at least 15°." },
      { score: 3, desc: "Patient extends wrist with elbow at 90° in 3 directions (flexion, extension, mid-position)." },
      { score: 4, desc: "Patient pronates/supinates forearm and extends wrist in all 3 positions." },
      { score: 5, desc: "Patient uses fingers to press buttons (3 buttons, 14 seconds)." },
      { score: 6, desc: "Patient picks up small objects one at a time with pincer grip." },
    ],
  },
  {
    key: "handActivities",
    label: "8. Advanced Hand Activities",
    grades: [
      { score: 0, desc: "Starting position: Arm at side. Picks up large ball with both hands and places on table." },
      { score: 1, desc: "Uses affected hand as assist, picks up large ball and places to side." },
      { score: 2, desc: "Picks up tennis ball from table with thumb and fingers. No pronation." },
      { score: 3, desc: "Picks up ball — brings to mouth." },
      { score: 4, desc: "Picks up ball, places at specific location (15 cm in front)." },
      { score: 5, desc: "Draws horizontal lines to stop a vertical line 10 times in 20 seconds." },
      { score: 6, desc: "Holds pencil, draws continuous circles around dots on paper." },
    ],
  },
];

export default function MotorAssessmentScaleMASStrokeRunner({ client, onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");
  const [showInstructions, setShowInstructions] = useState(true);

  const handleSave = () => {
    if (completedItems === 0) {
      toast.error("Please score at least one item before saving.");
      return;
    }
    const totalScore = ITEMS.reduce((acc, item) => acc + parseFloat(scores[item.key] || 0), 0);

    const soapLines = ITEMS.map(item => {
      const grade = ITEMS.find(i => i.key === item.key);
      const gradeInfo = grade?.grades.find(g => g.score === parseInt(scores[item.key]));
      return `  ${item.label}: ${scores[item.key]}/6${gradeInfo ? ` — ${gradeInfo.desc.split('.')[0]}` : ''}`;
    }).join('\n');

    const soapText = `• Motor Assessment Scale (MAS-Stroke): Total ${totalScore}/48\n${soapLines}${notes ? `\n\n  Clinical Notes: ${notes}` : ''}`;

    onSave({
      result_value: totalScore,
      additional_data: {
        ...scores,
        total_score: totalScore,
        measurement_type: 'mas_stroke',
        soap_text: soapText,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
  };

  const totalScore = ITEMS.reduce((acc, item) => acc + parseFloat(scores[item.key] || 0), 0);
  const completedItems = ITEMS.filter(item => scores[item.key] !== undefined && scores[item.key] !== "").length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Motor Assessment Scale (MAS-Stroke)</h2>
            <p className="text-slate-600 text-sm mt-1">Rate each item 0–6 based on the patient's best performance</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Carr JH, Shepherd RB, Nordholm L, & Lynne D. (1985). Investigation of a new motor assessment scale for stroke patients. <em>Physical Therapy, 65</em>(2), 175–180.</p>
            <p>Poole JL & Whitney SL. (1988). Motor Assessment Scale for stroke patients: concurrent validity and interrater reliability. <em>Archives of Physical Medicine and Rehabilitation, 69</em>(3), 195–197.</p>
          </div>

          {/* Instructions toggle */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowInstructions(v => !v)}>
              <CardTitle className="text-base flex items-center justify-between text-blue-900">
                <span className="flex items-center gap-2"><Info className="w-4 h-4" />Clinician Instructions</span>
                {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </CardTitle>
            </CardHeader>
            {showInstructions && (
              <CardContent className="text-sm text-blue-800 space-y-2 pt-0">
                <p><strong>Purpose:</strong> The MAS assesses motor function and mobility in patients following stroke. It measures functional tasks in 8 areas.</p>
                <p><strong>Scoring:</strong> Each item is scored from <strong>0 (cannot perform)</strong> to <strong>6 (performs optimally)</strong>. Total score = 0–48. Higher scores indicate better motor function.</p>
                <p><strong>Instructions:</strong> Test the patient in each area using the criteria for each grade level. Assign the highest grade the patient can <em>consistently</em> achieve. Use the dropdown descriptions to guide grading.</p>
                <p><strong>Interpretation:</strong></p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>0–12: Severe impairment</li>
                  <li>13–24: Moderately severe impairment</li>
                  <li>25–36: Moderate impairment</li>
                  <li>37–47: Mild impairment</li>
                  <li>48: No impairment (optimal)</li>
                </ul>
              </CardContent>
            )}
          </Card>

          {/* Score items */}
          {ITEMS.map((item) => (
            <Card key={item.key} className={scores[item.key] !== undefined && scores[item.key] !== "" ? "border-green-200 bg-green-50" : ""}>
              <CardContent className="pt-4 space-y-2">
                <Label className="font-semibold text-slate-900">{item.label}</Label>
                <Select
                  value={scores[item.key] !== undefined ? String(scores[item.key]) : ""}
                  onValueChange={(val) => setScores(prev => ({ ...prev, [item.key]: val }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select grade (0–6)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {item.grades.map(g => (
                      <SelectItem key={g.score} value={String(g.score)}>
                        <span className="font-bold mr-2">{g.score}:</span> {g.desc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {scores[item.key] !== undefined && scores[item.key] !== "" && (
                  <p className="text-xs text-slate-600 italic">
                    {item.grades.find(g => g.score === parseInt(scores[item.key]))?.desc}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Notes */}
          <Card>
            <CardContent className="pt-4">
              <Label>Clinical Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observations, compensatory strategies, contraindications..."
                rows={3}
                className="mt-1"
              />
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <div className="text-sm text-slate-600">
            {completedItems}/8 items scored
            {completedItems > 0 && <span className="ml-3 font-semibold text-slate-900">Running total: {totalScore}/48</span>}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-2" />
              Save Assessment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}