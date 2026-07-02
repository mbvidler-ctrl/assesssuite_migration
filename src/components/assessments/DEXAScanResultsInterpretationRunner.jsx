import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

const DEXA_SITES = [
  { key: "lumbarSpine", label: "Lumbar Spine (L1-L4)", unit: "g/cmÂ²" },
  { key: "femoralNeck", label: "Femoral Neck", unit: "g/cmÂ²" },
  { key: "totalHip", label: "Total Hip", unit: "g/cmÂ²" },
  { key: "distalRadius", label: "Distal Radius (1/3)", unit: "g/cmÂ²" },
];

export default function DEXAScanResultsInterpretationRunner({ client, onSave, onClose }) {
  const [tScores, setTScores] = useState({
    lumbarSpine: "",
    femoralNeck: "",
    totalHip: "",
    distalRadius: "",
  });
  const [bmd, setBmd] = useState({
    lumbarSpine: "",
    femoralNeck: "",
    totalHip: "",
    distalRadius: "",
  });
  const [bodyFatPercentage, setBodyFatPercentage] = useState("");
  const [visceralAdiposeTissue, setVisceralAdiposeTissue] = useState("");
  const [leanMass, setLeanMass] = useState("");
  const [notes, setNotes] = useState("");

  const getTScoreInterpretation = (tScore) => {
    const score = parseFloat(tScore);
    if (isNaN(score)) return { label: "-", color: "text-gray-500", bg: "bg-gray-50" };
    if (score >= -1.0) return { label: "Normal", color: "text-green-600", bg: "bg-green-50" };
    if (score >= -2.5) return { label: "Osteopenia", color: "text-yellow-600", bg: "bg-yellow-50" };
    return { label: "Osteoporosis", color: "text-red-600", bg: "bg-red-50" };
  };

  const handleTScoreChange = (site, value) => {
    setTScores((prev) => ({ ...prev, [site]: value }));
  };

  const handleBMDChange = (site, value) => {
    setBmd((prev) => ({ ...prev, [site]: value }));
  };

  const handleSave = () => {
    const anyTScoreEntered = Object.values(tScores).some(val => val !== "");

    if (!anyTScoreEntered) {
      toast.error("Please enter at least one T-Score.");
      return;
    }

    // Find the worst T-score for the result value
    const validTScores = Object.values(tScores).filter(val => val !== "").map(val => parseFloat(val));
    const worstTScore = Math.min(...validTScores);

    let soapText = `â€¢ DEXA Scan Results: Worst T-Score ${worstTScore}\n\n  Bone Mineral Density (T-Scores):\n`;
    DEXA_SITES.forEach(site => {
      if (tScores[site.key]) {
        const interp = getTScoreInterpretation(tScores[site.key]);
        soapText += `  - ${site.label}: T-Score ${tScores[site.key]}${bmd[site.key] ? `, BMD ${bmd[site.key]} g/cmÂ²` : ''} (${interp.label})\n`;
      }
    });
    if (bodyFatPercentage) soapText += `\n  Body Fat: ${bodyFatPercentage}%`;
    if (visceralAdiposeTissue) soapText += `\n  Visceral Adipose Tissue: ${visceralAdiposeTissue} cmÂ²`;
    if (leanMass) soapText += `\n  Lean Mass: ${leanMass} kg`;

    const additionalData = {
      measurement_type: "dexa",
      soap_text: soapText,
      t_scores: tScores,
      bmd_values: bmd,
      body_fat_percentage: bodyFatPercentage,
      visceral_adipose_tissue: visceralAdiposeTissue,
      lean_mass: leanMass,
    };

    onSave({
      status: "completed",
      result_value: worstTScore,
      additional_data: additionalData,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("DEXA scan results saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>DEXA Scan Results Interpretation</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-3">Bone Mineral Density (BMD) Assessment</h3>
                <div className="space-y-4">
                  {DEXA_SITES.map((site) => {
                    const interp = getTScoreInterpretation(tScores[site.key]);
                    return (
                      <div key={site.key} className={`border rounded-lg p-4 ${interp.bg}`}>
                        <Label className="font-semibold">{site.label}</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div>
                            <Label className="text-sm">T-Score</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={tScores[site.key]}
                              onChange={(e) => handleTScoreChange(site.key, e.target.value)}
                              placeholder="e.g., -1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">BMD ({site.unit})</Label>
                            <Input
                              type="number"
                              step="0.001"
                              value={bmd[site.key]}
                              onChange={(e) => handleBMDChange(site.key, e.target.value)}
                              placeholder="e.g., 0.950"
                            />
                          </div>
                        </div>
                        {tScores[site.key] && (
                          <div className={`mt-2 p-2 rounded ${interp.color} font-medium`}>
                            Classification: {interp.label}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-lg mb-3">Body Composition (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Body Fat (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={bodyFatPercentage}
                      onChange={(e) => setBodyFatPercentage(e.target.value)}
                      placeholder="e.g., 25.5"
                    />
                  </div>
                  <div>
                    <Label>Visceral Adipose Tissue (cmÂ²)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={visceralAdiposeTissue}
                      onChange={(e) => setVisceralAdiposeTissue(e.target.value)}
                      placeholder="e.g., 150"
                    />
                  </div>
                  <div>
                    <Label>Lean Mass (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={leanMass}
                      onChange={(e) => setLeanMass(e.target.value)}
                      placeholder="e.g., 55.2"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <p className="font-semibold mb-2">WHO Classification (T-Score):</p>
                <ul className="space-y-1 text-gray-700">
                  <li>â€¢ <span className="font-medium">Normal:</span> T-score â‰¥ -1.0</li>
                  <li>â€¢ <span className="font-medium">Osteopenia:</span> T-score between -1.0 and -2.5</li>
                  <li>â€¢ <span className="font-medium">Osteoporosis:</span> T-score â‰¤ -2.5</li>
                </ul>
              </div>

              <div>
                <Label htmlFor="notes">Clinical Notes & Interpretation</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter interpretation, recommendations, and clinical notes..."
                  rows={4}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2" />
            Close
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-2" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}