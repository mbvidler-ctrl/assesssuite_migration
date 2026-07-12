import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function HeightRunner({ client, onSave, onClose }) {
  const [height, setHeight] = useState("");
  const [notes, setNotes] = useState("");
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurementDate, setMeasurementDate] = useState("");

  const handleStartMeasurement = () => {
    setIsMeasuring(true);
    setMeasurementDate(todayLocal());
    toast.success("Measurement started. Please follow the protocol.");
  };

  const handleStopMeasurement = () => {
    setIsMeasuring(false);
    toast.success("Measurement stopped.");
  };

  const handleSave = () => {
    if (!height) {
      toast.error("Height is required.");
      return;
    }

    const resultValue = parseFloat(height);
    const additionalData = {
      soap_text: `• Height Measurement\n  Result: ${resultValue} cm`,
      measurement_type: "Height",
      protocol: [
        "Client removes shoes and bulky hair accessories.",
        "Stand with heels together, back straight, eyes forward (Frankfort plane).",
        "Ensure heels, buttocks, and upper back are lightly touching wall/stadiometer.",
        "Lower headpiece to crown of head.",
        "Record height to nearest 0.1 cm."
      ],
      equipment: "Stadiometer OR wall-mounted measuring tape with right-angle headpiece",
      references: [
        "ESSA Outcome Measures Book – Anthropometrics Section.",
        "WHO (2008). Training Course on Child Growth Assessment. Height measurement protocol."
      ]
    };

    onSave({
      status: "completed",
      result_value: resultValue,
      additional_data: additionalData,
      notes,
      assessment_date: measurementDate
    });

    toast.success("Measurement saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Height Measurement</CardTitle>
          </CardHeader>
          <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="height">Height (cm)</Label>
            <Input
              id="height"
              type="number"
              step="0.1"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              disabled={isMeasuring}
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isMeasuring}
            />
          </div>
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isMeasuring}
              className="flex items-center space-x-2"
            >
              <X size={16} />
              <span>Close</span>
            </Button>
            <div className="flex space-x-2">
              {!isMeasuring ? (
                <Button
                  variant="outline"
                  onClick={handleStartMeasurement}
                  className="flex items-center space-x-2"
                >
                  <Play size={16} />
                  <span>Start Measurement</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleStopMeasurement}
                  className="flex items-center space-x-2"
                >
                  <AlertTriangle size={16} />
                  <span>Stop Measurement</span>
                </Button>
              )}
              <Button
                onClick={handleSave}
                className="flex items-center space-x-2"
              >
                <Save size={16} />
                <span>Save</span>
              </Button>
            </div>
          </div>
        </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}