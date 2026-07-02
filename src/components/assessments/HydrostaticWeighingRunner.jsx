import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

export default function HydrostaticWeighingRunner({ client, onSave, onClose }) {
  const [landWeight, setLandWeight] = useState("");
  const [underwaterWeights, setUnderwaterWeights] = useState([""]);
  const [notes, setNotes] = useState("");

  const handleAddUnderwaterWeight = () => {
    if (underwaterWeights.length < 5) {
      setUnderwaterWeights([...underwaterWeights, ""]);
    } else {
      toast.error("Maximum of 5 underwater weights allowed.");
    }
  };

  const handleUnderwaterWeightChange = (index, value) => {
    const newWeights = [...underwaterWeights];
    newWeights[index] = value;
    setUnderwaterWeights(newWeights);
  };

  const handleRemoveWeight = (index) => {
    const newWeights = underwaterWeights.filter((_, i) => i !== index);
    setUnderwaterWeights(newWeights);
  };

  const handleSave = () => {
    if (!landWeight || underwaterWeights.some((w) => !w)) {
      toast.error("Please enter all required fields.");
      return;
    }

    const validWeights = underwaterWeights.filter((w) => w);
    if (validWeights.length < 3) {
      toast.error("At least 3 underwater weights are required.");
      return;
    }

    const averageUnderwaterWeight = validWeights.reduce((sum, w) => sum + parseFloat(w), 0) / validWeights.length;
    const bodyDensity = calculateBodyDensity(parseFloat(landWeight), averageUnderwaterWeight);
    const bodyFatPercentage = calculateBodyFatPercentage(bodyDensity);

    const resultValue = bodyFatPercentage.toFixed(2);

    // Generate comprehensive SOAP text with all measurements
    let soapText = `Hydrostatic Weighing Assessment:\n\n`;
    soapText += `Measurements:\n`;
    soapText += `  â€¢ Land Weight: ${parseFloat(landWeight).toFixed(2)} kg\n`;
    soapText += `\nUnderwater Weights (${validWeights.length} trials):\n`;
    validWeights.forEach((weight, idx) => {
      soapText += `  â€¢ Trial ${idx + 1}: ${parseFloat(weight).toFixed(2)} kg\n`;
    });
    soapText += `  â€¢ Average Underwater Weight: ${averageUnderwaterWeight.toFixed(2)} kg\n`;
    soapText += `\nCalculated Results:\n`;
    soapText += `  â€¢ Body Density: ${bodyDensity.toFixed(4)} g/cmÂ³\n`;
    soapText += `  â€¢ Body Fat Percentage: ${bodyFatPercentage.toFixed(2)}%\n`;
    if (notes && notes.trim()) {
      soapText += `\nClinical Notes: ${notes}\n`;
    }

    const additionalData = {
      measurement_type: "hydrostatic_weighing",
      landWeight: parseFloat(landWeight),
      underwaterWeights: validWeights.map((w) => parseFloat(w)),
      bodyDensity,
      bodyFatPercentage,
      soap_text: soapText
    };

    onSave({ status: "completed", result_value: resultValue, additional_data: additionalData, notes, assessment_date: new Date().toISOString().split("T")[0] });
    toast.success("Assessment saved successfully.");
  };

  const calculateBodyDensity = (landWeight, averageUnderwaterWeight) => {
    const waterDensity = 0.9982;
    const residualVolume = 0.1;
    const bodyVolume = (landWeight - averageUnderwaterWeight) / waterDensity;
    const bodyDensity = landWeight / (bodyVolume - residualVolume);
    return bodyDensity;
  };

  const calculateBodyFatPercentage = (bodyDensity) => {
    return (495 / bodyDensity) - 450;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Hydrostatic Weighing</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="landWeight">Land Weight (kg)</Label>
              <Input
                id="landWeight"
                type="number"
                value={landWeight}
                onChange={(e) => setLandWeight(e.target.value)}
                placeholder="Enter land weight in kg"
              />
            </div>
            <div>
              <Label>Underwater Weights (kg)</Label>
              {underwaterWeights.map((weight, index) => (
                <div key={index} className="flex items-center space-x-2 mb-2">
                  <Input
                    type="number"
                    value={weight}
                    onChange={(e) => handleUnderwaterWeightChange(index, e.target.value)}
                    placeholder={`Underwater weight ${index + 1}`}
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleRemoveWeight(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={handleAddUnderwaterWeight}
              >
                Add Underwater Weight
              </Button>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any additional notes"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onClose}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
      </div>
    </div>
  );
}