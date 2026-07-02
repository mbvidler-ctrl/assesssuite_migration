import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Save, AlertCircle } from "lucide-react";

const scoreOptions = [
  { score: 0, label: "No symptoms", description: "No symptoms at all." },
  { score: 1, label: "No significant disability", description: "Symptoms present, but able to carry out all usual duties and activities." },
  { score: 2, label: "Slight disability", description: "Able to look after own affairs without assistance, but unable to carry out all previous activities." },
  { score: 3, label: "Moderate disability", description: "Requires some help, but able to walk without assistance." },
  { score: 4, label: "Moderately severe disability", description: "Unable to walk without assistance and unable to attend to own bodily needs without assistance." },
  { score: 5, label: "Severe disability", description: "Requires constant nursing care and attention; bedridden and/or incontinent." },
  { score: 6, label: "Death", description: "Client is deceased." }
];

const getInterpretation = (score) => {
  if (score <= 2) return "Broadly functionally independent.";
  if (score === 3) return "Moderate disability with some support needs.";
  if (score >= 4 && score <= 5) return "Dependent level disability with substantial care needs.";
  if (score === 6) return "Deceased.";
  return "";
};

const getScoreLabel = (score) => {
  const option = scoreOptions.find(o => o.score === score);
  return option ? option.label : "";
};

export default function ModifiedRankinScaleMRSRunner({ clientId, appointmentId, onClose, onComplete }) {
  const [selectedScore, setSelectedScore] = useState(null);
  const [collateralUsed, setCollateralUsed] = useState(false);
  const [collateralSource, setCollateralSource] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [showGuide, setShowGuide] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (selectedScore === null) {
      alert("Please select a score.");
      return;
    }

    setIsSubmitting(true);
    try {
      const scoreLabel = getScoreLabel(selectedScore);
      const interpretation = getInterpretation(selectedScore);

      const soapText = `Outcome Measure: Modified Rankin Scale (mRS) completed. Client scored ${selectedScore}/6 (${scoreLabel}), indicating ${interpretation}${collateralUsed ? ` Collateral source: ${collateralSource}.` : ""}${clinicalNotes ? ` Clinical reasoning: ${clinicalNotes}` : ""}`;

      const assessmentData = {
        org_id: (await base44.auth.me()).org_id || "",
        client_id: clientId,
        assessment_id: "modified_rankin_scale_mrs",
        appointment_id: appointmentId,
        status: "completed",
        result_value: selectedScore,
        assessment_date: new Date().toISOString().split("T")[0],
        notes: clinicalNotes,
        additional_data: {
          collateral_used: collateralUsed,
          collateral_source: collateralSource,
        },
      };

      await base44.entities.ClientAssessment.create(assessmentData);

      // Add to SOAP note
      const soapNotes = await base44.entities.SOAPNote.filter({
        client_id: clientId,
        appointment_id: appointmentId,
      }, '-note_date', 1);

      if (soapNotes.length > 0) {
        const soapNote = soapNotes[0];
        const updatedObjective = (soapNote.objective || "") + "\n\n" + soapText;
        await base44.entities.SOAPNote.update(soapNote.id, { objective: updatedObjective });
      }

      onComplete?.({
        measure: "Modified Rankin Scale (mRS)",
        score: `${selectedScore}/6`,
        label: scoreLabel,
        interpretation,
        soapText,
      });

      onClose?.();
    } catch (error) {
      console.error("Error saving assessment:", error);
      alert("Error saving assessment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modified Rankin Scale (mRS)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client Script */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <p className="text-sm text-blue-900">
                "I'm going to rate your current overall level of function and how much help you need with day-to-day life. This helps classify your level of independence."
              </p>
            </CardContent>
          </Card>

          {/* Clinician Guide */}
          <Card>
            <CardHeader>
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="flex items-center gap-2 w-full text-left hover:text-blue-600"
              >
                <ChevronDown className={`w-4 h-4 transition ${showGuide ? "" : "-rotate-90"}`} />
                <span className="font-semibold">Clinician Administration Guide</span>
              </button>
            </CardHeader>
            {showGuide && (
              <CardContent className="space-y-2 text-xs text-slate-600">
                <p><strong>Score based on:</strong> Current overall level of disability and dependence in daily life.</p>
                <p><strong>Rate the lowest score that best reflects real-world function.</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Consider usual activities, personal care, mobility, and need for assistance.</li>
                  <li>If cognition or communication impairment limits direct history, use collateral information from carer/family.</li>
                  <li>If the client is deceased, score 6.</li>
                </ul>
              </CardContent>
            )}
          </Card>

          {/* Score Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">mRS Score Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="mb-2 block">Select mRS Score</Label>
                <Select value={selectedScore !== null ? selectedScore.toString() : ""} onValueChange={(val) => setSelectedScore(parseInt(val))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select score..." />
                  </SelectTrigger>
                  <SelectContent>
                    {scoreOptions.map(option => (
                      <SelectItem key={option.score} value={option.score.toString()}>
                        {option.score} - {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedScore !== null && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm"><strong>Description:</strong> {scoreOptions.find(o => o.score === selectedScore)?.description}</p>
                  <p className="text-sm mt-2"><strong>Clinical Interpretation:</strong> {getInterpretation(selectedScore)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Collateral Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Collateral Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="collateral_used"
                  checked={collateralUsed}
                  onCheckedChange={setCollateralUsed}
                />
                <Label htmlFor="collateral_used" className="text-sm cursor-pointer">Collateral information used</Label>
              </div>

              {collateralUsed && (
                <div>
                  <Label htmlFor="collateral_source" className="text-sm mb-2 block">Collateral source</Label>
                  <Input
                    id="collateral_source"
                    placeholder="e.g., Family member, carer, nursing home staff"
                    value={collateralSource}
                    onChange={(e) => setCollateralSource(e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Clinical Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clinical Notes / Rationale</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter any clinical reasoning or relevant context..."
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="border-t pt-4 flex justify-between">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={selectedScore === null || isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? "Saving..." : "Save Assessment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}