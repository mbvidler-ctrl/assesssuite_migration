import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Info, ClipboardList, BarChart2 } from "lucide-react";
import { toast } from "sonner";

const NORMS = [
  { gender: "Male", age: "17–19", excellent: "≥ 251", good: "221–250", average: "191–220", belowAvg: "161–190", poor: "< 161" },
  { gender: "Male", age: "20–29", excellent: "≥ 261", good: "231–260", average: "201–230", belowAvg: "171–200", poor: "< 171" },
  { gender: "Male", age: "30–39", excellent: "≥ 241", good: "211–240", average: "181–210", belowAvg: "151–180", poor: "< 151" },
  { gender: "Male", age: "40–49", excellent: "≥ 221", good: "191–220", average: "161–190", belowAvg: "131–160", poor: "< 131" },
  { gender: "Male", age: "50+",   excellent: "≥ 191", good: "161–190", average: "131–160", belowAvg: "101–130", poor: "< 101" },
  { gender: "Female", age: "17–19", excellent: "≥ 196", good: "166–195", average: "136–165", belowAvg: "106–135", poor: "< 106" },
  { gender: "Female", age: "20–29", excellent: "≥ 196", good: "166–195", average: "136–165", belowAvg: "106–135", poor: "< 106" },
  { gender: "Female", age: "30–39", excellent: "≥ 181", good: "151–180", average: "121–150", belowAvg: "91–120",  poor: "< 91"  },
  { gender: "Female", age: "40–49", excellent: "≥ 161", good: "131–160", average: "101–130", belowAvg: "71–100",  poor: "< 71"  },
  { gender: "Female", age: "50+",   excellent: "≥ 141", good: "111–140", average: "81–110",  belowAvg: "51–80",   poor: "< 51"  },
];

function getClassification(bestJump, gender, age) {
  if (!bestJump || !gender || !age) return null;
  const ageNum = parseInt(age);
  let ageGroup = "50+";
  if (ageNum <= 19) ageGroup = "17–19";
  else if (ageNum <= 29) ageGroup = "20–29";
  else if (ageNum <= 39) ageGroup = "30–39";
  else if (ageNum <= 49) ageGroup = "40–49";

  const norm = NORMS.find(n => n.gender === gender && n.age === ageGroup);
  if (!norm) return null;

  const excellent = parseInt(norm.excellent.replace("≥ ", ""));
  const goodLow = parseInt(norm.good.split("–")[0]);
  const avgLow = parseInt(norm.average.split("–")[0]);
  const belowAvgLow = parseInt(norm.belowAvg.split("–")[0]);

  if (bestJump >= excellent) return { label: "Excellent", color: "bg-green-100 text-green-800" };
  if (bestJump >= goodLow) return { label: "Good", color: "bg-blue-100 text-blue-800" };
  if (bestJump >= avgLow) return { label: "Average", color: "bg-yellow-100 text-yellow-800" };
  if (bestJump >= belowAvgLow) return { label: "Below Average", color: "bg-orange-100 text-orange-800" };
  return { label: "Poor", color: "bg-red-100 text-red-800" };
}

export default function StandingLongJumpRunner({ client, onSave, onClose }) {
  const [trials, setTrials] = useState(["", "", ""]);
  const [gender, setGender] = useState(client?.gender === "female" ? "Female" : client?.gender === "male" ? "Male" : "");
  const [age, setAge] = useState(client?.date_of_birth ? String(Math.floor((new Date() - new Date(client.date_of_birth)) / 31557600000)) : "");
  const [notes, setNotes] = useState("");

  const handleTrialChange = (index, value) => {
    const newTrials = [...trials];
    newTrials[index] = value;
    setTrials(newTrials);
  };

  const validTrials = trials.filter(t => t !== "" && !isNaN(parseFloat(t))).map(parseFloat);
  const bestJump = validTrials.length > 0 ? Math.max(...validTrials) : null;
  const classification = bestJump !== null ? getClassification(bestJump, gender, age) : null;

  const handleSave = () => {
    if (validTrials.length === 0) {
      toast.error("Please enter at least one jump distance.");
      return;
    }

    const soapText = `Standing Long Jump Assessment
Client: ${client?.full_name || ""}
Date: ${new Date().toLocaleDateString("en-AU")}

Trials:
${trials.map((t, i) => t !== "" ? `  Trial ${i + 1}: ${t} cm` : null).filter(Boolean).join("\n")}

Best Result: ${bestJump} cm
Classification: ${classification?.label || "N/A"} (${gender || "gender not recorded"}, age ${age || "not recorded"})

Notes: ${notes || "None"}`;

    onSave({
      status: "completed",
      result_value: bestJump,
      additional_data: {
        soap_text: soapText,
        measurement_type: "standing_long_jump",
        trials: validTrials,
        best_jump_cm: bestJump,
        classification: classification?.label || null,
        gender,
        age,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Standing Long Jump saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-5">

          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Standing Long Jump</h2>
              <p className="text-sm text-slate-500">Lower limb explosive power assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>

          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm text-blue-800 flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> Clinician Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 text-sm text-blue-900 space-y-1">
              <p><strong>Setup:</strong> Mark a clear starting line on a non-slip surface. Place a measuring tape along the ground perpendicular to the line.</p>
              <p><strong>Starting position:</strong> Client stands with feet shoulder-width apart, toes behind the starting line.</p>
              <p><strong>Script:</strong> <em>"Stand with your toes behind the line. Bend your knees, swing your arms back, then jump as far forward as you can, landing on both feet. I'll measure from the line to where your heels land."</em></p>
              <p><strong>Measurement:</strong> Measure from the starting line to the nearest heel contact point. Record in centimetres to one decimal place.</p>
              <p><strong>Trials:</strong> Allow 3 attempts with 60 seconds rest between each. Record all distances and use the best.</p>
              <p><strong>Disqualify if:</strong> Client steps over the line before jumping, loses balance on landing, or uses a step approach.</p>
              <p><strong>Safety:</strong> Non-slip surface required. Ensure adequate warm-up. Do not administer if client has acute lower limb injury.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm text-slate-700">Client Details (for norm classification)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-slate-600">Gender</Label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm mt-1"
                  value={gender}
                  onChange={e => setGender(e.target.value)}
                >
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-slate-600">Age (years)</Label>
                <Input
                  type="number"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  className="mt-1"
                  placeholder="e.g. 35"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm text-slate-700">Jump Distances (cm)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-3">
              {trials.map((trial, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Label className="w-16 text-sm text-slate-600">Trial {index + 1}</Label>
                  <Input
                    type="number"
                    value={trial}
                    onChange={(e) => handleTrialChange(index, e.target.value)}
                    placeholder="cm"
                    className="w-32"
                  />
                  {trial !== "" && <Badge variant="outline">{trial} cm</Badge>}
                </div>
              ))}
              {bestJump !== null && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border">
                  <p className="text-sm font-semibold text-slate-700">Best Jump: <span className="text-blue-700">{bestJump} cm</span></p>
                  {classification && (
                    <span className={`inline-block mt-1 text-xs font-semibold px-2 py-1 rounded ${classification.color}`}>
                      {classification.label}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                <BarChart2 className="w-4 h-4" /> Normative Data (cm) — Johnson & Nelson, 1979
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-700 border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border px-2 py-1 text-left">Gender</th>
                      <th className="border px-2 py-1">Age</th>
                      <th className="border px-2 py-1 text-green-700">Excellent</th>
                      <th className="border px-2 py-1 text-blue-700">Good</th>
                      <th className="border px-2 py-1 text-yellow-700">Average</th>
                      <th className="border px-2 py-1 text-orange-700">Below Avg</th>
                      <th className="border px-2 py-1 text-red-700">Poor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {NORMS.map((n, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="border px-2 py-1">{n.gender}</td>
                        <td className="border px-2 py-1 text-center">{n.age}</td>
                        <td className="border px-2 py-1 text-center">{n.excellent}</td>
                        <td className="border px-2 py-1 text-center">{n.good}</td>
                        <td className="border px-2 py-1 text-center">{n.average}</td>
                        <td className="border px-2 py-1 text-center">{n.belowAvg}</td>
                        <td className="border px-2 py-1 text-center">{n.poor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-slate-50">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm text-slate-600 flex items-center gap-2">
                <Info className="w-4 h-4" /> References
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 text-xs text-slate-600 space-y-1">
              <p>Johnson, B.L. & Nelson, J.K. (1979). <em>Practical Measurements for Evaluation in Physical Education.</em> 4th ed. Burgess Publishing.</p>
              <p>Maulder, P. & Cronin, J. (2005). Horizontal and vertical jump assessment: reliability, symmetry, discriminative and predictive ability. <em>Physical Therapy in Sport, 6</em>(2), 74–82. https://doi.org/10.1016/j.ptsp.2005.01.001</p>
              <p>Castro-Piñero, J. et al. (2010). Percentile values for standing broad jump in children and adolescents aged 6–17 years. <em>Journal of Sports Medicine and Physical Fitness, 50</em>(3), 194–202.</p>
              <p>Lohman, E.B. et al. (2011). The relationship between lumbar lordosis, sit and reach test, and standing long jump distance in healthy young adults. <em>Physiotherapy Theory and Practice, 27</em>(5), 340–347.</p>
            </CardContent>
          </Card>

          <div>
            <Label className="text-sm text-slate-700">Clinical Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observations, technique notes, pain reports, relevant history..."
              className="mt-1"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" /> Cancel
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="w-4 h-4 mr-2" /> Save Assessment
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}