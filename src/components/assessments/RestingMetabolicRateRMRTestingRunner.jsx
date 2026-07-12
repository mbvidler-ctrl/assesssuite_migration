import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function RestingMetabolicRateRMRTestingRunner({ client, onSave, onClose }) {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("male");
  const [bmr, setBmr] = useState(null);
  const [notes, setNotes] = useState("");

  const handleCalculateBMR = () => {
    if (!weight || !height || !age) {
      toast.error("Please enter all required fields.");
      return;
    }

    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height);
    const ageNum = parseInt(age, 10);

    let calculatedBMR;

    if (sex === "male") {
      calculatedBMR = 10 * weightNum + 6.25 * heightNum - 5 * ageNum + 5;
    } else {
      calculatedBMR = 10 * weightNum + 6.25 * heightNum - 5 * ageNum - 161;
    }

    setBmr(calculatedBMR);
    toast.success("BMR calculated successfully.");
  };

  const handleSave = () => {
    if (!bmr) {
      toast.error("Please calculate BMR before saving.");
      return;
    }

    const additionalData = {
      soap_text: `• Resting Metabolic Rate (RMR) Testing\n  Estimated BMR: ${bmr.toFixed(2)} kcal/day\n  Height: ${height}cm | Weight: ${weight}kg | Age: ${age}yrs | Sex: ${sex}`,
      measurement_type: "RMR",
      weight,
      height,
      age,
      sex,
    };

    onSave({
      status: "completed",
      result_value: bmr,
      additional_data: additionalData,
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("Assessment saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Resting Metabolic Rate (RMR) Testing</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="height">Height (cm)</Label>
              <Input
                id="height"
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="age">Age (years)</Label>
              <Input
                id="age"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div>
              <Label>Sex</Label>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="male"
                    name="sex"
                    value="male"
                    checked={sex === "male"}
                    onChange={() => setSex("male")}
                  />
                  <Label htmlFor="male">Male</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="female"
                    name="sex"
                    value="female"
                    checked={sex === "female"}
                    onChange={() => setSex("female")}
                  />
                  <Label htmlFor="female">Female</Label>
                </div>
              </div>
            </div>
            <Button onClick={handleCalculateBMR}>
              <Play className="mr-2" />
              Calculate BMR
            </Button>
            {bmr && (
              <Badge variant="outline" className="text-green-600">
                BMR: {bmr.toFixed(2)} kcal/day
              </Badge>
            )}
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
      <div className="flex justify-between">
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