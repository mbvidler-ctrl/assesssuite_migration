import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";
import { scoreHba1c } from "@/lib/clinical/scorers/extrasPhysiological";
import { buildTimeProfession as activeProfession } from "@/lib/profession";

export default function HbA1cRunner({ client, onSave, onClose }) {
  const [hba1c, setHba1c] = useState("");
  const [notes, setNotes] = useState("");

  const getCategory = (value) => {
    if (value < 5.7) return { label: "Normal", color: "bg-green-100 text-green-800" };
    if (value < 6.5) return { label: "Pre-diabetes", color: "bg-yellow-100 text-yellow-800" };
    return { label: "Diabetes", color: "bg-red-100 text-red-800" };
  };

  const handleSave = () => {
    try {
      onSave(scoreHba1c(
        { hba1c_percent: hba1c, notes },
        { assessmentDate: todayLocal(), assessmentName: 'HbA1c (Glycated Hemoglobin)', client },
      ));
    } catch (error) {
      toast.error(error?.message || "HbA1c could not be scored.");
    }
  };

  const category = hba1c && !isNaN(parseFloat(hba1c)) ? getCategory(parseFloat(hba1c)) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>HbA1c (Glycated Hemoglobin)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="hba1c">HbA1c Value (%)</Label>
                <Input
                  id="hba1c"
                  type="number"
                  step="0.1"
                  value={hba1c}
                  onChange={(e) => setHba1c(e.target.value)}
                  placeholder="e.g., 6.2"
                />
              </div>

              {category && (
                <div className="p-4 border rounded-md bg-gray-50 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Interpretation:</span>
                    <Badge className={category.color}>{category.label}</Badge>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>• Normal: &lt;5.7%</p>
                    <p>• Pre-diabetes: 5.7–6.4%</p>
                    <p>• Diabetes: ≥6.5%</p>
                  </div>
                  {category.label !== "Normal" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                      <p className="font-semibold mb-1">⚠ Scope of Practice Reminder</p>
                      {category.label === "Pre-diabetes" && (
                        <p>This result is in the pre-diabetes range. A {activeProfession.practitionerNoun} may incorporate relevant activity, function and lifestyle factors into the management plan; however, <strong>this result must not be used as a standalone diagnosis</strong>. Refer to the {activeProfession.lexicon.client}'s GP or a Credentialled Diabetes Educator (CDE) for medical review and management planning.</p>
                      )}
                      {category.label === "Diabetes" && (
                        <p>This result is in the diabetes range. <strong>Do not diagnose.</strong> If this is a new or unexpected finding, promptly refer to the client's GP or a Credentialled Diabetes Educator (CDE). Continue to support the client within your scope through evidence-based exercise prescription and lifestyle coaching.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="notes">Clinical Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter any additional clinical notes..."
                  rows={3}
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
