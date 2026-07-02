import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

const EMS_ITEMS = [
  { 
    id: 1, 
    name: "Lying to Sitting", 
    max: 2,
    criteria: [
      "0: Unable without help",
      "1: Needs help of 1 person",
      "2: Independent"
    ]
  },
  { 
    id: 2, 
    name: "Sitting to Lying", 
    max: 2,
    criteria: [
      "0: Unable without help",
      "1: Needs help of 1 person",
      "2: Independent"
    ]
  },
  { 
    id: 3, 
    name: "Sitting to Standing", 
    max: 3,
    criteria: [
      "0: Unable without help",
      "1: Needs help of 1 person",
      "2: Needs help of 2 people",
      "3: Independent in <3 seconds"
    ]
  },
  { 
    id: 4, 
    name: "Standing", 
    max: 3,
    criteria: [
      "0: Unable",
      "1: Stands, needs support",
      "2: Stands for <10 sec unsupported",
      "3: Stands for >10 sec unsupported"
    ]
  },
  { 
    id: 5, 
    name: "Gait", 
    max: 3,
    criteria: [
      "0: Unable",
      "1: With help of 1 person",
      "2: Independent with aid",
      "3: Independent without aid"
    ]
  },
  { 
    id: 6, 
    name: "Timed Walk (6m)", 
    max: 3,
    criteria: [
      "0: Unable",
      "1: >30 seconds",
      "2: 15-30 seconds",
      "3: <15 seconds"
    ]
  },
  { 
    id: 7, 
    name: "Functional Reach", 
    max: 2,
    criteria: [
      "0: <10 cm",
      "1: 10-20 cm",
      "2: >20 cm"
    ]
  }
];

export default function EMSRunner({ onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [assistiveDevice, setAssistiveDevice] = useState("none");
  const [gaitSpeed, setGaitSpeed] = useState("");
  const [safetyNotes, setSafetyNotes] = useState("");
  const [notes, setNotes] = useState("");

  const calculateTotal = () => {
    return Object.values(scores).reduce((sum, score) => sum + (parseFloat(score) || 0), 0);
  };

  const getInterpretation = (total) => {
    if (total >= 14) return { level: 'Independent Mobility', color: 'text-green-600', bg: 'bg-green-50' };
    if (total >= 10) return { level: 'Borderline/At Risk', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { level: 'Dependent Mobility/High Fall Risk', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const handleScoreChange = (itemId, value) => {
    setScores({ ...scores, [itemId]: value });
  };

  const total = calculateTotal();
  const interpretation = getInterpretation(total);

  const handleSave = () => {
    if (Object.keys(scores).length === 0) {
      toast.error("Please score at least one item");
      return;
    }

    // Build soap_text for SOAP notes
    let soapText = `â€¢ Elderly Mobility Scale (EMS):\n  Total Score: ${total}/20 â€” ${interpretation.level}\n\n  Individual Item Scores:\n`;
    EMS_ITEMS.forEach(item => {
      const score = scores[item.id];
      if (score !== undefined) {
        soapText += `    ${item.id}. ${item.name}: ${score}/${item.max}\n`;
      }
    });
    if (safetyNotes) soapText += `\n  Safety Observations: ${safetyNotes}\n`;

    onSave({
      result_value: total,
      additional_data: {
        measurement_type: 'ems',
        ems_data: {
          item_scores: scores,
          total_score: total,
          assistive_device: assistiveDevice,
          gait_speed_seconds: gaitSpeed ? parseFloat(gaitSpeed) : null,
          safety_notes: safetyNotes,
          interpretation: interpretation.level
        },
        soap_text: soapText
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-teal-50 to-emerald-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Elderly Mobility Scale</h2>
              <p className="text-slate-600 mt-1">Functional mobility assessment for older adults</p>
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
                  Test Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800">
                <p>Administer all EMS items in sequence. Observe transfers, standing, walking, and reach. Use gait belt and close supervision for clients at fall risk. Stop if client reports pain, dizziness, or appears unsafe.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">EMS Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {EMS_ITEMS.map(item => (
                  <div key={item.id} className="border-b pb-4 last:border-b-0">
                    <div className="mb-2">
                      <Label className="text-base font-semibold">{item.id}. {item.name}</Label>
                    </div>
                    <div className="space-y-1 mb-3">
                      {item.criteria.map((criterion, idx) => (
                        <p key={idx} className="text-xs text-slate-600 pl-2">{criterion}</p>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      {[...Array(item.max + 1)].map((_, score) => (
                        <Button
                          key={score}
                          type="button"
                          variant={scores[item.id] === score.toString() ? "default" : "outline"}
                          onClick={() => handleScoreChange(item.id, score.toString())}
                          className="flex-1"
                        >
                          {score}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {total > 0 && (
              <Card className={`${interpretation.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-xl ${interpretation.color}`}>
                    Total Score: {total} / 20
                  </CardTitle>
                </CardHeader>
                <CardContent className={interpretation.color}>
                  <p className="font-semibold text-lg">{interpretation.level}</p>
                  {total < 14 && (
                    <p className="text-sm mt-2">âš ï¸ Score suggests significant mobility limitation and increased risk of falls/dependence</p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Assistive Device Used</Label>
                  <Select value={assistiveDevice} onValueChange={setAssistiveDevice}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="cane">Cane</SelectItem>
                      <SelectItem value="walker">Walker/Rollator</SelectItem>
                      <SelectItem value="gait_belt">Gait Belt for Safety</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>6m Walk Time (seconds) - If Measured</Label>
                  <input
                    type="number"
                    step="0.1"
                    value={gaitSpeed}
                    onChange={(e) => setGaitSpeed(e.target.value)}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    placeholder="Optional - for Item 6"
                  />
                </div>

                <div>
                  <Label>Safety Observations & Gait Quality</Label>
                  <Textarea
                    value={safetyNotes}
                    onChange={(e) => setSafetyNotes(e.target.value)}
                    placeholder="Balance during transfers, gait deviations, need for assistance..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Clinical Notes & Recommendations</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Fall risk, mobility goals, recommendations for support or referral..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave}
            disabled={Object.keys(scores).length === 0}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save EMS Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}