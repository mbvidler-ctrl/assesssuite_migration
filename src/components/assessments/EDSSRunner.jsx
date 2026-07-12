import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const EDSS_SCORES = [
  { score: 0, label: "Normal neurological exam" },
  { score: 1.0, label: "No disability, minimal signs in one FS" },
  { score: 1.5, label: "No disability, minimal signs in more than one FS" },
  { score: 2.0, label: "Minimal disability in one FS" },
  { score: 2.5, label: "Mild disability in one FS or minimal disability in two FS" },
  { score: 3.0, label: "Moderate disability in one FS, or mild disability in three or four FS. Fully ambulatory" },
  { score: 3.5, label: "Fully ambulatory but with moderate disability in one FS and more than minimal disability in several others" },
  { score: 4.0, label: "Fully ambulatory without aid, self-sufficient, able to walk ~500m" },
  { score: 4.5, label: "Fully ambulatory without aid, able to walk ~300m" },
  { score: 5.0, label: "Ambulatory without aid ~200m; disability impairs full daily activities" },
  { score: 5.5, label: "Ambulatory without aid ~100m; disability precludes full daily activities" },
  { score: 6.0, label: "Intermittent or unilateral constant assistance (cane, crutch, brace) required to walk ~100m" },
  { score: 6.5, label: "Constant bilateral assistance (canes, crutches, braces) required to walk ~20m" },
  { score: 7.0, label: "Unable to walk beyond ~5m even with aid; essentially restricted to wheelchair" },
  { score: 7.5, label: "Unable to take more than a few steps; restricted to wheelchair" },
  { score: 8.0, label: "Essentially restricted to bed or chair; retains effective use of arms" },
  { score: 8.5, label: "Essentially restricted to bed much of day; some effective use of arms" },
  { score: 9.0, label: "Confined to bed; can still communicate and eat" },
  { score: 9.5, label: "Totally helpless bed patient; unable to communicate effectively or eat/swallow" },
  { score: 10, label: "Death due to MS" }
];

const FUNCTIONAL_SYSTEMS = [
  "Pyramidal (motor)",
  "Cerebellar",
  "Brainstem",
  "Sensory",
  "Bowel & Bladder",
  "Visual",
  "Cerebral (mental)",
  "Ambulation"
];

export default function EDSSRunner({ onSave, onClose }) {
  const [edssScore, setEdssScore] = useState("");
  const [functionalSystems, setFunctionalSystems] = useState({});
  const [notes, setNotes] = useState("");

  const handleFSChange = (system, value) => {
    setFunctionalSystems({ ...functionalSystems, [system]: value });
  };

  const getInterpretation = () => {
    const score = parseFloat(edssScore);
    if (score === 0) return { level: 'Normal', color: 'text-green-600', bg: 'bg-green-50' };
    if (score <= 3.5) return { level: 'Minimal to moderate disability, fully ambulatory', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (score <= 5.5) return { level: 'Moderate disability, ambulatory without aid', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (score <= 6.5) return { level: 'Significant disability, requires walking aids', color: 'text-orange-600', bg: 'bg-orange-50' };
    if (score <= 7.5) return { level: 'Severe disability, wheelchair dependent', color: 'text-red-600', bg: 'bg-red-50' };
    return { level: 'Very severe disability, bed bound', color: 'text-red-800', bg: 'bg-red-100' };
  };

  const interpretation = edssScore ? getInterpretation() : null;

  const handleSave = () => {
    if (!edssScore) {
      toast.error("Please select an EDSS score");
      return;
    }

    const soapText = `• Expanded Disability Status Scale (EDSS)\n  Score: ${edssScore} — ${interpretation?.level}\n  ${EDSS_SCORES.find(s => s.score === parseFloat(edssScore))?.label || ''}${notes ? `\n  Notes: ${notes}` : ''}`;
    onSave({
      result_value: parseFloat(edssScore),
      additional_data: {
        soap_text: soapText,
        edss_score: parseFloat(edssScore),
        functional_systems: functionalSystems,
        interpretation: interpretation?.level
      },
      notes: notes,
      assessment_date: todayLocal()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Expanded Disability Status Scale (EDSS)</h2>
              <p className="text-slate-600 mt-1">Multiple Sclerosis disability assessment</p>
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
                  About EDSS
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800">
                <p>The EDSS quantifies disability in MS across eight functional systems. It ranges from 0 (normal) to 10 (death due to MS). Scores 0-3.5 are based on neurological examination. Scores 4.0-9.5 are defined by walking ability.</p>
                <p className="mt-2"><strong>Note:</strong> EDSS assessment requires specialized neurological training. This tool is for recording clinician-determined scores.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Functional Systems (Optional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {FUNCTIONAL_SYSTEMS.map((system) => (
                  <div key={system}>
                    <Label className="text-sm mb-1 block">{system}</Label>
                    <Select
                      value={functionalSystems[system] || ""}
                      onValueChange={(value) => handleFSChange(system, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select grade (0-6)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 - Normal</SelectItem>
                        <SelectItem value="1">1 - Minimal</SelectItem>
                        <SelectItem value="2">2 - Mild</SelectItem>
                        <SelectItem value="3">3 - Moderate</SelectItem>
                        <SelectItem value="4">4 - Marked</SelectItem>
                        <SelectItem value="5">5 - Severe</SelectItem>
                        <SelectItem value="6">6 - Very Severe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>EDSS Score *</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={edssScore} onValueChange={setEdssScore}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select EDSS score" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {EDSS_SCORES.map((item) => (
                      <SelectItem key={item.score} value={item.score.toString()}>
                        <div className="flex flex-col">
                          <span className="font-semibold">{item.score}</span>
                          <span className="text-xs text-slate-600">{item.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {interpretation && (
              <Card className={`${interpretation.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-xl ${interpretation.color}`}>
                    {interpretation.level}
                  </CardTitle>
                </CardHeader>
                <CardContent className={interpretation.color}>
                  <p className="font-semibold text-2xl">EDSS: {edssScore}</p>
                  <p className="text-sm mt-2">
                    {EDSS_SCORES.find(s => s.score === parseFloat(edssScore))?.label}
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Disease progression, functional limitations, exercise considerations, assistive devices..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!edssScore} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Save EDSS
          </Button>
        </div>
      </div>
    </div>
  );
}