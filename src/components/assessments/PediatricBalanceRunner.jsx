import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const PBS_ITEMS = [
  {
    id: 1,
    name: "Sitting to Standing",
    instructions: "Hold arms up and stand up. The child is allowed to select the position of his/her arms.",
    scoring: [
      { value: 4, label: "Able to stand without using hands and stabilize independently" },
      { value: 3, label: "Able to stand independently using hands" },
      { value: 2, label: "Able to stand using hands after several tries" },
      { value: 1, label: "Needs minimal assist to stand or to stabilize" },
      { value: 0, label: "Needs moderate or maximal assist to stand" }
    ]
  },
  {
    id: 2,
    name: "Standing to Sitting",
    instructions: "Sit down slowly, without use of hands. The child is allowed to select the position of his/her arms.",
    scoring: [
      { value: 4, label: "Sits safely with minimal use of hands" },
      { value: 3, label: "Controls descent by using hands" },
      { value: 2, label: "Uses back of legs against chair to control descent" },
      { value: 1, label: "Sits independently, but has uncontrolled descent" },
      { value: 0, label: "Needs assistance to sit" }
    ]
  },
  {
    id: 3,
    name: "Transfers",
    instructions: "Arrange chairs for a stand pivot transfer, touching at a 45-degree angle. Transfer one way toward a seat with armrests and one way toward a seat without armrests.",
    scoring: [
      { value: 4, label: "Able to transfer safely with minor use of hands" },
      { value: 3, label: "Able to transfer safely; definite need of hands" },
      { value: 2, label: "Able to transfer with verbal cueing and/or supervision (spotting)" },
      { value: 1, label: "Needs one person to assist" },
      { value: 0, label: "Needs two people to assist or supervise (close guard) to be safe" }
    ]
  },
  {
    id: 4,
    name: "Standing Unsupported",
    instructions: "Stand for 30 seconds without holding on or moving your feet. (Weight shifting and equilibrium responses in feet are acceptable)",
    scoring: [
      { value: 4, label: "Able to stand safely 30 seconds" },
      { value: 3, label: "Able to stand 30 seconds with supervision (spotting)" },
      { value: 2, label: "Able to stand 15 seconds unsupported" },
      { value: 1, label: "Needs several tries to stand 10 seconds unsupported" },
      { value: 0, label: "Unable to stand 10 seconds unassisted" }
    ]
  },
  {
    id: 5,
    name: "Sitting with Back Unsupported and Feet Supported on Floor",
    instructions: "Please sit with arms folded on your chest for 30 seconds.",
    scoring: [
      { value: 4, label: "Able to sit safely and securely 30 seconds" },
      { value: 3, label: "Able to sit 30 seconds under supervision (spotting) or may require definite use of upper extremities to maintain sitting position" },
      { value: 2, label: "Able to sit 15 seconds" },
      { value: 1, label: "Able to sit 10 seconds" },
      { value: 0, label: "Unable to sit 10 seconds without support" }
    ]
  },
  {
    id: 6,
    name: "Standing Unsupported with Eyes Closed",
    instructions: "When I say close your eyes, I want you to stand still, close your eyes, and keep them closed until I say open.",
    scoring: [
      { value: 4, label: "Able to stand 10 seconds safely" },
      { value: 3, label: "Able to stand 10 seconds with supervision (spotting)" },
      { value: 2, label: "Able to stand 3 seconds" },
      { value: 1, label: "Unable to keep eyes closed 3 seconds but stays steady" },
      { value: 0, label: "Needs help to keep from falling" }
    ]
  },
  {
    id: 7,
    name: "Standing Unsupported with Feet Together",
    instructions: "Place your feet together and stand still without holding on.",
    scoring: [
      { value: 4, label: "Able to place feet together independently and stand 30 seconds safely" },
      { value: 3, label: "Able to place feet together independently and stand for 30 seconds with supervision (spotting)" },
      { value: 2, label: "Able to place feet together independently but unable to hold for 30 seconds" },
      { value: 1, label: "Needs help to attain position but able to stand 30 seconds with feet together" },
      { value: 0, label: "Needs help to attain position and/or unable to hold for 30 seconds" }
    ]
  },
  {
    id: 8,
    name: "Standing Unsupported One Foot in Front",
    instructions: "Stand with one foot in front of the other, heel to toe. If you cannot place feet in a tandem position, step forward far enough to allow the heel of one foot to be placed ahead of the toes of the stationary foot.",
    scoring: [
      { value: 4, label: "Able to place feet tandem independently and hold 30 seconds" },
      { value: 3, label: "Able to place foot ahead of other independently and hold 30 seconds (step length must exceed the length of the stationary foot)" },
      { value: 2, label: "Able to take small step independently and hold 30 seconds, or required assistance to place foot in front, but can stand for 30 seconds" },
      { value: 1, label: "Needs help to step, but can hold 15 seconds" },
      { value: 0, label: "Loses balance while stepping or standing" }
    ]
  },
  {
    id: 9,
    name: "Standing on One Leg",
    instructions: "Stand on one leg for as long as you are able to without holding on. (If necessary, instruct the child to maintain arms/hands on hips/waist)",
    scoring: [
      { value: 4, label: "Able to lift leg independently and hold >10 seconds" },
      { value: 3, label: "Able to lift leg independently and hold 5-10 seconds" },
      { value: 2, label: "Able to lift leg independently and hold ≥3 seconds" },
      { value: 1, label: "Tries to lift leg, unable to hold 3 seconds but remains standing independently" },
      { value: 0, label: "Unable to try or needs assistance to prevent fall" }
    ]
  },
  {
    id: 10,
    name: "Turning 360 Degrees",
    instructions: "Turn completely around in a full circle. Pause. Then turn a full circle in the other direction.",
    scoring: [
      { value: 4, label: "Able to turn 360 degrees safely in ≤4 seconds, both sides" },
      { value: 3, label: "Able to turn 360 degrees safely one side only in ≤4 seconds" },
      { value: 2, label: "Able to turn 360 degrees safely but slowly (one side ≤4 seconds, one side >4 seconds, or both sides >4 seconds)" },
      { value: 1, label: "Needs close supervision (spotting) or verbal cueing" },
      { value: 0, label: "Needs physical assistance while turning" }
    ]
  },
  {
    id: 11,
    name: "Turning to Look Behind Over Left and Right Shoulders While Standing",
    instructions: "Turn to look directly behind you over your left shoulder without taking a step. Repeat to the right.",
    scoring: [
      { value: 4, label: "Looks behind both sides and transfers weight well" },
      { value: 3, label: "Looks behind one side only; other side shows less weight transfer" },
      { value: 2, label: "Turns sideways only but maintains balance" },
      { value: 1, label: "Needs supervision (spotting) when turning" },
      { value: 0, label: "Needs physical assistance to keep from losing balance or falling" }
    ]
  },
  {
    id: 12,
    name: "Placing Alternate Foot on Stool",
    instructions: "Touch this stool with each foot one at a time. Try to do it as quickly as possible. Each foot needs to touch the stool 4 times (8 steps total).",
    scoring: [
      { value: 4, label: "Able to stand independently and safely and complete 8 steps in <20 seconds" },
      { value: 3, label: "Able to stand independently and complete 8 steps in >20 seconds" },
      { value: 2, label: "Able to complete 4 steps without aid with supervision (spotting)" },
      { value: 1, label: "Able to complete >2 steps, needs minimal assistance" },
      { value: 0, label: "Needs assistance to keep from falling/unable to try" }
    ]
  },
  {
    id: 13,
    name: "Reaching Forward with Outstretched Arm While Standing",
    instructions: "Lift your arm to 90 degrees. Stretch out your fingers and reach forward as far as you can. (Examiner places a ruler at the end of fingertips when arm is at 90 degrees. Fingers should not touch the ruler while reaching forward.)",
    scoring: [
      { value: 4, label: "Can reach forward confidently >25 cm (10 inches)" },
      { value: 3, label: "Can reach forward safely >12 cm (5 inches)" },
      { value: 2, label: "Can reach forward safely >5 cm (2 inches)" },
      { value: 1, label: "Reaches forward but needs supervision (spotting)" },
      { value: 0, label: "Loses balance while trying/requires external support" }
    ]
  },
  {
    id: 14,
    name: "Picking Up Object from Floor from a Standing Position",
    instructions: "Pick up the object (shoe/slipper) which is placed in front of your feet.",
    scoring: [
      { value: 4, label: "Able to pick up object safely and easily" },
      { value: 3, label: "Able to pick up object but needs supervision (spotting)" },
      { value: 2, label: "Unable to pick up but reaches 2-5 cm (1-2 inches) from object and keeps balance independently" },
      { value: 1, label: "Unable to pick up and needs supervision (spotting) while trying" },
      { value: 0, label: "Unable to try/needs assistance to keep from losing balance or falling" }
    ]
  }
];

export default function PediatricBalanceRunner({ onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");

  const handleScoreChange = (itemId, value) => {
    setScores(prev => ({ ...prev, [itemId]: value }));
  };

  const calculateTotal = () => {
    return Object.values(scores).reduce((sum, score) => sum + (parseInt(score) || 0), 0);
  };

  const getInterpretation = (total) => {
    if (total >= 45) return { text: "Low Fall Risk", color: "text-green-600", bg: "bg-green-50" };
    if (total >= 40) return { text: "Medium Fall Risk", color: "text-yellow-600", bg: "bg-yellow-50" };
    return { text: "High Fall Risk", color: "text-red-600", bg: "bg-red-50" };
  };

  const handleSave = () => {
    if (Object.keys(scores).length < 14) {
      toast.error("Please complete all 14 items");
      return;
    }

    const total = calculateTotal();
    const interpretation = getInterpretation(total);
    const today = todayLocal();

    const itemLines = PBS_ITEMS.map(item => {
      const score = scores[item.id];
      const option = item.scoring.find(o => o.value === score);
      return `    ${item.id}. ${item.name}: ${score}/4 — ${option?.label || ''}`;
    }).join('\n');

    const soapText = [
      `• Pediatric Balance Scale (PBS)`,
      `  Total Score: ${total}/56 → ${interpretation.text}`,
      `  Score Interpretation: ≥45 Low Fall Risk | 40–44 Medium Fall Risk | <40 High Fall Risk`,
      `  Item Scores:`,
      itemLines,
      notes ? `  Clinical Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      status: "completed",
      result_value: total,
      additional_data: {
        scores,
        interpretation: interpretation.text,
        soap_text: soapText,
      },
      notes,
      assessment_date: today,
    });
  };

  const total = calculateTotal();
  const interpretation = Object.keys(scores).length === 14 ? getInterpretation(total) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-pink-50 to-purple-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Pediatric Balance Scale (PBS)</h2>
              <p className="text-slate-600 mt-1">14-item functional balance assessment for children</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Assessment Information
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>Age Range:</strong> 5-15 years (validated for children with mild to moderate motor impairments)</p>
                <p><strong>Scoring:</strong> Each item scored 0-4 (Total: 0-56). Score based on child's best performance across multiple trials.</p>
                <p><strong>Interpretation:</strong> ≥45 = Low fall risk | 40-44 = Medium fall risk | &lt;40 = High fall risk</p>
                <p><strong>Equipment:</strong> Adjustable height bench, chair with armrests, stopwatch, 6-inch step stool, ruler/yardstick, small object (shoe/slipper)</p>
                <div className="pt-2 border-t border-blue-300">
                  <p className="text-xs italic">
                    Source: Franjoine MR, Gunther JS, Taylor MJ. Pediatric Balance Scale: A modified version of the Berg Balance Scale for the school-age child with mild to moderate motor impairment. Pediatric Physical Therapy. 2003;15(2):114-128.
                  </p>
                  <a 
                    href="https://www.carepatron.com/files/pediatric-balance-scale.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-700 hover:text-blue-900 underline flex items-center gap-1 mt-1"
                  >
                    View Full Assessment Form (Free to Use) <Info className="w-3 h-3" />
                  </a>
                </div>
              </CardContent>
            </Card>

            {PBS_ITEMS.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{item.id}. {item.name}</CardTitle>
                  <p className="text-sm text-slate-600 italic mt-2">{item.instructions}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {item.scoring.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleScoreChange(item.id, option.value)}
                      className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                        scores[item.id] === option.value
                          ? 'border-purple-500 bg-purple-50 shadow-md'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Badge className={scores[item.id] === option.value ? "bg-purple-600" : "bg-slate-400"}>
                          {option.value}
                        </Badge>
                        <span className="text-sm text-slate-700">{option.label}</span>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            ))}

            {interpretation && (
              <Card className={`${interpretation.bg} border-2`}>
                <CardContent className="py-4">
                  <div className="text-center space-y-2">
                    <div>
                      <p className="text-sm text-slate-600">Total Score</p>
                      <p className="text-5xl font-bold text-slate-900">{total}/56</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Fall Risk</p>
                      <p className={`text-2xl font-bold ${interpretation.color}`}>{interpretation.text}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observations, compensatory strategies, specific difficulties, recommendations..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave}
            disabled={Object.keys(scores).length < 14}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save PBS Results
          </Button>
        </div>
      </div>
    </div>
  );
}