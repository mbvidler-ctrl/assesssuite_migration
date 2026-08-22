import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";
import {
  EDSS_FUNCTIONAL_SYSTEMS,
  EDSS_SCORE_OPTIONS,
  getEdssInterpretation,
  validateAndScoreEdss,
} from "@/lib/clinical/scorers/maintainedPhysioAdditions";

export default function EDSSRunner({ onSave, onClose }) {
  const [edssScore, setEdssScore] = useState("");
  const [functionalSystems, setFunctionalSystems] = useState({});
  const [notes, setNotes] = useState("");

  const handleFSChange = (system, value) => {
    setFunctionalSystems({ ...functionalSystems, [system]: value });
  };

  const hasScore = edssScore !== "";
  const numericScore = hasScore ? Number(edssScore) : null;
  const interpretation = hasScore ? getEdssInterpretation(numericScore) : null;
  const descriptor = hasScore
    ? EDSS_SCORE_OPTIONS.find(({ score }) => score === numericScore)?.label
    : null;

  const handleSave = () => {
    try {
      const payload = validateAndScoreEdss(
        { edss_score: edssScore, functional_systems: functionalSystems, notes },
        { assessmentName: "Expanded Disability Status Scale (EDSS)", assessmentDate: todayLocal() },
      );
      onSave(payload);
      toast.success("EDSS saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record EDSS score");
    }
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
                {EDSS_FUNCTIONAL_SYSTEMS.map((system) => (
                  <div key={system.key}>
                    <Label className="text-sm mb-1 block">{system.label}</Label>
                    <Select
                      value={functionalSystems[system.key] ?? ""}
                      onValueChange={(value) => handleFSChange(system.key, value)}
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
                    {EDSS_SCORE_OPTIONS.map((item) => (
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
              <Card className="bg-blue-50 border-2 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-xl text-blue-800">
                    {interpretation}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-blue-800">
                  <p className="font-semibold text-2xl">EDSS: {edssScore}</p>
                  <p className="text-sm mt-2">
                    {descriptor}
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
          <Button onClick={handleSave} disabled={!hasScore} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Save EDSS
          </Button>
        </div>
      </div>
    </div>
  );
}
