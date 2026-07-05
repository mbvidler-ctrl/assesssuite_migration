import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function MedicalHistory({ data, onNext, onBack, canGoBack, onSaveAndFinishLater }) {
  const [conditions, setConditions] = useState(data.medical_conditions || [{
    condition_name: "",
    medication: "",
    diagnosis_date: "",
    pain_level: "",
    notes: ""
  }]);

  useEffect(() => {
    // This ensures that if we navigate back and forth, we don't lose the pre-fetched data.
    if (data.medical_conditions && data.medical_conditions.length > 0) {
      setConditions(data.medical_conditions.map(c => ({
        condition_name: "",
        medication: "",
        diagnosis_date: "",
        pain_level: "",
        notes: "",
        ...c
      })));
    } else {
        setConditions([{
            condition_name: "",
            medication: "",
            diagnosis_date: "",
            pain_level: "",
            notes: ""
        }])
    }
  }, [data.medical_conditions]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const filledConditions = conditions.filter(c => c.condition_name && c.condition_name.trim() !== '');
    onNext({ medical_conditions: filledConditions });
  };

  const handleConditionChange = (index, field, value) => {
    const newConditions = [...conditions];
    newConditions[index][field] = value;
    setConditions(newConditions);
  };

  const addCondition = () => {
    setConditions([...conditions, { condition_name: "", medication: "", diagnosis_date: "", pain_level: "", notes: "" }]);
  };

  const removeCondition = (index) => {
    const newConditions = conditions.filter((_, i) => i !== index);
    setConditions(newConditions);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-blue-800">
          <strong>Additional Medical History (Optional):</strong> Use this section to document any conditions that haven't already been covered in the pre-exercise screening above — such as past surgeries, musculoskeletal injuries, neurological conditions, mental health diagnoses, or any other health concerns relevant to your care. If all conditions have already been captured, you may proceed without adding anything here.
        </p>
      </div>
      <div className="space-y-4">
        {conditions.map((condition, index) => (
          <Card key={index} className="p-4 bg-slate-50 border-slate-200/80 relative">
            <CardContent className="pt-2 space-y-4">
              {conditions.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 text-slate-500 hover:bg-red-100 hover:text-red-600"
                  onClick={() => removeCondition(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`condition_name_${index}`} className="text-sm font-medium text-slate-700">
                    Condition Name *
                  </Label>
                  <Input
                    id={`condition_name_${index}`}
                    value={condition.condition_name}
                    onChange={(e) => handleConditionChange(index, "condition_name", e.target.value)}
                    placeholder="e.g., Left Shoulder Bursitis"
                    className="mt-1"
                  />
                </div>
                <div>
                    <Label htmlFor={`medication_${index}`} className="text-sm font-medium text-slate-700">
                        Medication
                    </Label>
                    <Input
                        id={`medication_${index}`}
                        value={condition.medication}
                        onChange={(e) => handleConditionChange(index, "medication", e.target.value)}
                        placeholder="e.g., Panadol, Diazepam"
                        className="mt-1"
                    />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`diagnosis_date_${index}`} className="text-sm font-medium text-slate-700">
                    Approx. Diagnosis Date
                  </Label>
                  <Input
                    id={`diagnosis_date_${index}`}
                    type="date"
                    value={condition.diagnosis_date}
                    onChange={(e) => handleConditionChange(index, "diagnosis_date", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`pain_level_${index}`} className="text-sm font-medium text-slate-700">
                    Current Pain Level (0-10)
                  </Label>
                   <Select value={condition.pain_level?.toString() || ""} onValueChange={(value) => handleConditionChange(index, "pain_level", value ? parseInt(value) : "")}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select pain level" />
                    </SelectTrigger>
                    <SelectContent>
                      {[0,1,2,3,4,5,6,7,8,9,10].map(num => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} - {num === 0 ? "No pain" : num <= 3 ? "Mild" : num <= 6 ? "Moderate" : "Severe"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor={`notes_${index}`} className="text-sm font-medium text-slate-700">
                  Notes
                </Label>
                <Textarea
                  id={`notes_${index}`}
                  value={condition.notes}
                  onChange={(e) => handleConditionChange(index, "notes", e.target.value)}
                  placeholder="e.g., Aggravating factors, previous treatments, etc."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={addCondition}
        className="w-full flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Another Condition
      </Button>

      <div className="flex justify-between pt-6">
        <div className="flex gap-2">
          {canGoBack && (
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          {onSaveAndFinishLater && (
            <Button type="button" variant="outline" onClick={() => onSaveAndFinishLater({ medical_conditions: conditions })} className="text-slate-600">
              Save & Finish Later
            </Button>
          )}
        </div>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </form>
  );
}