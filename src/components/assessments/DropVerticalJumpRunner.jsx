import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

export default function DropVerticalJumpRunner({ client, onSave, onClose }) {
  const [jumpHeight, setJumpHeight] = useState("");
  const [kneeAngle, setKneeAngle] = useState("");
  const [kneeValgus, setKneeValgus] = useState("");
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    if (!jumpHeight || !kneeAngle || !kneeValgus) {
      toast.error("Please complete all measurements.");
      return;
    }

    const resultValue = parseFloat(jumpHeight);
    const additionalData = {
      soap_text: `• Drop Vertical Jump\n  Jump Height: ${jumpHeight} cm\n  Knee Angle at Landing: ${kneeAngle}°\n  Knee Valgus: ${kneeValgus}°${notes ? `\n  Notes: ${notes}` : ''}`,
      measurement_type: "drop_vertical_jump",
      knee_angle: parseFloat(kneeAngle),
      knee_valgus: parseFloat(kneeValgus),
    };

    onSave({
      status: "completed",
      result_value: resultValue,
      additional_data: additionalData,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Assessment saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Drop Vertical Jump</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Clinician Instructions */}
            <div className="bg-blue-600 text-white rounded-lg p-4 space-y-2">
              <p className="font-semibold text-base">📋 Clinician Instructions</p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Client stands on a 30 cm box with feet hip-width apart.</li>
                <li>Client steps off (not jumps) and lands on both feet simultaneously.</li>
                <li>Immediately upon landing, client performs a maximal vertical jump.</li>
                <li>Observe and measure: jump height, knee flexion angle at landing, and degree of knee valgus.</li>
                <li>Perform 3 trials; record the best or average depending on protocol.</li>
                <li>Knee valgus at initial contact is the primary injury-risk indicator.</li>
              </ul>
            </div>

            {/* Video Analysis Software */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-amber-800 text-sm">🎥 Recommended Video Analysis Software</p>
              <p className="text-xs text-amber-700 mb-2">Record from the front (coronal plane) at 60–240fps for accurate analysis:</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                <div className="bg-white rounded p-2 border border-amber-100">
                  <p className="font-semibold">Kinovea</p>
                  <p className="text-slate-500">Free. Angle measurement, slow-motion playback. Windows/Mac.</p>
                </div>
                <div className="bg-white rounded p-2 border border-amber-100">
                  <p className="font-semibold">Coach's Eye</p>
                  <p className="text-slate-500">Mobile app. Side-by-side comparison, drawing tools. iOS/Android.</p>
                </div>
                <div className="bg-white rounded p-2 border border-amber-100">
                  <p className="font-semibold">Dartfish</p>
                  <p className="text-slate-500">Clinical-grade. Joint angle tracking, gait analysis tools.</p>
                </div>
                <div className="bg-white rounded p-2 border border-amber-100">
                  <p className="font-semibold">Hudl Technique</p>
                  <p className="text-slate-500">Free mobile app. Frame-by-frame review, angle overlays.</p>
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="jumpHeight">Jump Height (cm)</Label>
              <Input
                id="jumpHeight"
                type="number"
                value={jumpHeight}
                onChange={(e) => setJumpHeight(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="kneeAngle">Knee Angle (°)</Label>
              <Input
                id="kneeAngle"
                type="number"
                value={kneeAngle}
                onChange={(e) => setKneeAngle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="kneeValgus">Knee Valgus (°)</Label>
              <Input
                id="kneeValgus"
                type="number"
                value={kneeValgus}
                onChange={(e) => setKneeValgus(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
          Save Assessment
        </Button>
      </div>
      </div>
    </div>
  );
}