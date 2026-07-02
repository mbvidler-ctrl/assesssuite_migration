import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, Target, AlertCircle, Plus, Trash2 } from "lucide-react";

export default function APSSStage2({ data, onNext, onBack, canGoBack, onSaveAndFinishLater }) {
  const [formData, setFormData] = useState({
    // Demographics - auto-filled from Stage 1
    apss_s2_age: data.date_of_birth ? Math.floor((new Date() - new Date(data.date_of_birth)) / 31557600000) : "",
    apss_s2_gender: data.gender || "",
    
    // Family history
    apss_s2_family_history: data.apss_s2_family_history !== undefined ? (data.apss_s2_family_history ? "yes" : "no") : "",
    apss_s2_family_history_records: data.apss_s2_family_history_records || [],
    
    // Smoking
    apss_s2_smoking: data.apss_s2_smoking !== undefined ? (data.apss_s2_smoking ? "yes" : "no") : "",
    apss_s2_smoking_details: data.apss_s2_smoking_details || "",
    apss_s2_smoking_years: data.apss_s2_smoking_years || "",
    apss_s2_vaping: data.apss_s2_vaping !== undefined ? (data.apss_s2_vaping ? "yes" : "no") : "",
    apss_s2_vaping_details: data.apss_s2_vaping_details || "",
    apss_s2_vaping_years: data.apss_s2_vaping_years || "",
    
    // Body composition
    apss_s2_weight_kg: data.apss_s2_weight_kg || "",
    apss_s2_height_cm: data.apss_s2_height_cm || "",
    apss_s2_bmi: data.apss_s2_bmi || "",
    apss_s2_waist_circumference: data.apss_s2_waist_circumference || "",
    apss_s2_hip_circumference: data.apss_s2_hip_circumference || "", // New field
    apss_s2_whr: data.apss_s2_whr || "", // New field
    
    // Blood pressure
    apss_s2_high_blood_pressure: data.apss_s2_high_blood_pressure !== undefined ? (data.apss_s2_high_blood_pressure ? "yes" : "no") : "",
    apss_s2_systolic_bp: data.apss_s2_systolic_bp || "",
    apss_s2_diastolic_bp: data.apss_s2_diastolic_bp || "",
    apss_s2_heart_rate: data.apss_s2_heart_rate || "",
    apss_s2_bp_medication: data.apss_s2_bp_medication !== undefined ? (data.apss_s2_bp_medication ? "yes" : "no") : "",
    apss_s2_bp_medication_details: data.apss_s2_bp_medication_details || "",
    
    // Cholesterol
    apss_s2_high_cholesterol: data.apss_s2_high_cholesterol !== undefined ? (data.apss_s2_high_cholesterol ? "yes" : "no") : "",
    apss_s2_total_cholesterol: data.apss_s2_total_cholesterol || "",
    apss_s2_hdl: data.apss_s2_hdl || "",
    apss_s2_ldl: data.apss_s2_ldl || "",
    apss_s2_triglycerides: data.apss_s2_triglycerides || "",
    apss_s2_cholesterol_medication: data.apss_s2_cholesterol_medication !== undefined ? (data.apss_s2_cholesterol_medication ? "yes" : "no") : "",
    apss_s2_cholesterol_medication_details: data.apss_s2_cholesterol_medication_details || "",
    
    // Blood sugar
    apss_s2_high_blood_sugar: data.apss_s2_high_blood_sugar !== undefined ? (data.apss_s2_high_blood_sugar ? "yes" : "no") : "",
    apss_s2_fasting_glucose: data.apss_s2_fasting_glucose || "",
    apss_s2_glucose_medication: data.apss_s2_glucose_medication !== undefined ? (data.apss_s2_glucose_medication ? "yes" : "no") : "",
    apss_s2_glucose_medication_details: data.apss_s2_glucose_medication_details || "",
    
    // Medications
    apss_s2_prescribed_medications: data.apss_s2_prescribed_medications !== undefined ? (data.apss_s2_prescribed_medications ? "yes" : "no") : "",
    apss_s2_medications_list: data.apss_s2_medications_list || "",
    
    // Vitals
    apss_s2_spo2: data.apss_s2_spo2 || "",
    
    // Hospital admissions
    apss_s2_hospital_admissions: data.apss_s2_hospital_admissions !== undefined ? (data.apss_s2_hospital_admissions ? "yes" : "no") : "",
    apss_s2_hospital_admissions_details: data.apss_s2_hospital_admissions_details || "",
    
    // Pregnancy
    apss_s2_pregnancy: data.apss_s2_pregnancy !== undefined ? (data.apss_s2_pregnancy ? "yes" : "no") : "",
    apss_s2_pregnancy_details: data.apss_s2_pregnancy_details || "",
    
    // Musculoskeletal
    apss_s2_musculoskeletal_issues: data.apss_s2_musculoskeletal_issues !== undefined ? (data.apss_s2_musculoskeletal_issues ? "yes" : "no") : "",
    apss_s2_musculoskeletal_details: data.apss_s2_musculoskeletal_details || "",
    
    apss_stage2_completed: true
  });

  const addFamilyMember = () => {
    setFormData(prev => ({
      ...prev,
      apss_s2_family_history_records: [
        ...prev.apss_s2_family_history_records,
        { relationship: "", age_at_event: "" }
      ]
    }));
  };

  const removeFamilyMember = (index) => {
    setFormData(prev => ({
      ...prev,
      apss_s2_family_history_records: prev.apss_s2_family_history_records.filter((_, i) => i !== index)
    }));
  };

  const updateFamilyMember = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      apss_s2_family_history_records: prev.apss_s2_family_history_records.map((record, i) => 
        i === index ? { ...record, [field]: value } : record
      )
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Convert yes/no to booleans and submit
    const submissionData = {
      apss_s2_family_history: formData.apss_s2_family_history === "yes",
      apss_s2_family_history_records: formData.apss_s2_family_history_records.map(r => ({
        relationship: r.relationship,
        age_at_event: r.age_at_event ? Number(r.age_at_event) : null
      })),
      apss_s2_smoking: formData.apss_s2_smoking === "yes",
      apss_s2_smoking_details: formData.apss_s2_smoking_details,
      apss_s2_smoking_years: formData.apss_s2_smoking_years ? Number(formData.apss_s2_smoking_years) : null,
      apss_s2_vaping: formData.apss_s2_vaping === "yes",
      apss_s2_vaping_details: formData.apss_s2_vaping_details,
      apss_s2_vaping_years: formData.apss_s2_vaping_years ? Number(formData.apss_s2_vaping_years) : null,
      apss_s2_weight_kg: formData.apss_s2_weight_kg ? Number(formData.apss_s2_weight_kg) : null,
      apss_s2_height_cm: formData.apss_s2_height_cm ? Number(formData.apss_s2_height_cm) : null,
      apss_s2_bmi: formData.apss_s2_bmi ? Number(formData.apss_s2_bmi) : null,
      apss_s2_waist_circumference: formData.apss_s2_waist_circumference ? Number(formData.apss_s2_waist_circumference) : null,
      apss_s2_hip_circumference: formData.apss_s2_hip_circumference ? Number(formData.apss_s2_hip_circumference) : null, // New field
      apss_s2_whr: formData.apss_s2_whr ? Number(formData.apss_s2_whr) : null, // New field
      apss_s2_high_blood_pressure: formData.apss_s2_high_blood_pressure === "yes",
      apss_s2_systolic_bp: formData.apss_s2_systolic_bp ? Number(formData.apss_s2_systolic_bp) : null,
      apss_s2_diastolic_bp: formData.apss_s2_diastolic_bp ? Number(formData.apss_s2_diastolic_bp) : null,
      apss_s2_heart_rate: formData.apss_s2_heart_rate ? Number(formData.apss_s2_heart_rate) : null,
      apss_s2_spo2: formData.apss_s2_spo2 ? Number(formData.apss_s2_spo2) : null,
      apss_s2_bp_medication: formData.apss_s2_bp_medication === "yes",
      apss_s2_bp_medication_details: formData.apss_s2_bp_medication_details,
      apss_s2_high_cholesterol: formData.apss_s2_high_cholesterol === "yes",
      apss_s2_total_cholesterol: formData.apss_s2_total_cholesterol ? Number(formData.apss_s2_total_cholesterol) : null,
      apss_s2_hdl: formData.apss_s2_hdl ? Number(formData.apss_s2_hdl) : null,
      apss_s2_ldl: formData.apss_s2_ldl ? Number(formData.apss_s2_ldl) : null,
      apss_s2_triglycerides: formData.apss_s2_triglycerides ? Number(formData.apss_s2_triglycerides) : null,
      apss_s2_cholesterol_medication: formData.apss_s2_cholesterol_medication === "yes",
      apss_s2_cholesterol_medication_details: formData.apss_s2_cholesterol_medication_details,
      apss_s2_high_blood_sugar: formData.apss_s2_high_blood_sugar === "yes",
      apss_s2_fasting_glucose: formData.apss_s2_fasting_glucose ? Number(formData.apss_s2_fasting_glucose) : null,
      apss_s2_glucose_medication: formData.apss_s2_glucose_medication === "yes",
      apss_s2_glucose_medication_details: formData.apss_s2_glucose_medication_details,
      apss_s2_prescribed_medications: formData.apss_s2_prescribed_medications === "yes",
      apss_s2_medications_list: formData.apss_s2_medications_list,
      apss_s2_hospital_admissions: formData.apss_s2_hospital_admissions === "yes",
      apss_s2_hospital_admissions_details: formData.apss_s2_hospital_admissions_details,
      apss_s2_pregnancy: formData.apss_s2_pregnancy === "yes",
      apss_s2_pregnancy_details: formData.apss_s2_pregnancy_details,
      apss_s2_musculoskeletal_issues: formData.apss_s2_musculoskeletal_issues === "yes",
      apss_s2_musculoskeletal_details: formData.apss_s2_musculoskeletal_details,
      apss_stage2_completed: true,
      apss_stage2_completion_date: new Date().toISOString()
    };
    
    onNext(submissionData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate BMI when weight or height changes
      if (field === "apss_s2_weight_kg" || field === "apss_s2_height_cm") {
        const weight = field === "apss_s2_weight_kg" ? Number(value) : Number(updated.apss_s2_weight_kg);
        const height = field === "apss_s2_height_cm" ? Number(value) : Number(updated.apss_s2_height_cm);
        if (weight > 0 && height > 0) {
          const bmi = weight / ((height / 100) ** 2);
          updated.apss_s2_bmi = bmi.toFixed(1);
        } else {
          updated.apss_s2_bmi = ""; // Clear BMI if inputs are invalid
        }
      }

      // Auto-calculate WHR when waist or hip changes
      if (field === "apss_s2_waist_circumference" || field === "apss_s2_hip_circumference") {
        const waist = field === "apss_s2_waist_circumference" ? Number(value) : Number(updated.apss_s2_waist_circumference);
        const hip = field === "apss_s2_hip_circumference" ? Number(value) : Number(updated.apss_s2_hip_circumference);
        if (waist > 0 && hip > 0) {
          const whr = waist / hip;
          updated.apss_s2_whr = whr.toFixed(2);
        } else {
          updated.apss_s2_whr = "";
        }
      }
      
      return updated;
    });
  };

  // Calculate age from date of birth
  const age = data.date_of_birth ? Math.floor((new Date() - new Date(data.date_of_birth)) / 31557600000) : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <Target className="w-5 h-5" />
            APSS Stage 2 (Recommended)
          </CardTitle>
          <p className="text-sm text-orange-600">
            <strong>AIM:</strong> This stage is to be completed with an exercise professional to determine appropriate exercise prescription based on established risk factors.
          </p>
        </CardHeader>
      </Card>

      {/* Demographics (Read-only, auto-filled) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">8. Demographics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-slate-600">Age</Label>
              <Input value={age || "N/A"} disabled className="bg-slate-50" />
              <p className="text-xs text-slate-500 mt-1">Risk of adverse event increases with age, particularly males &gt; 45 yr and females &gt; 55 yr.</p>
            </div>
            <div>
              <Label className="text-sm text-slate-600">Gender</Label>
              <Input value={formData.apss_s2_gender || "N/A"} disabled className="bg-slate-50" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Question 9: Family History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">9. Family history of heart disease</CardTitle>
          <p className="text-sm text-slate-600">A family history of heart disease refers to an event that occurs in relatives including parents, grandparents, uncles and/or aunts before the age of 55 years.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <RadioGroup value={formData.apss_s2_family_history} onValueChange={(value) => {
              handleChange("apss_s2_family_history", value);
              if (value === "yes" && formData.apss_s2_family_history_records.length === 0) {
                addFamilyMember();
              }
            }}>
              <div className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="fh_yes" />
                  <Label htmlFor="fh_yes" className="cursor-pointer font-normal">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="fh_no" />
                  <Label htmlFor="fh_no" className="cursor-pointer font-normal">No</Label>
                </div>
              </div>
            </RadioGroup>
          </div>
          
          {formData.apss_s2_family_history === "yes" && (
            <div className="space-y-3 pl-4 border-l-2 border-orange-200">
              {formData.apss_s2_family_history_records.map((record, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-4 p-3 bg-slate-50 rounded-lg">
                  <div>
                    <Label htmlFor={`fh_relationship_${index}`} className="text-sm">Relationship (e.g., father)</Label>
                    <Input
                      id={`fh_relationship_${index}`}
                      value={record.relationship}
                      onChange={(e) => updateFamilyMember(index, "relationship", e.target.value)}
                      placeholder="Father, mother, uncle..."
                    />
                  </div>
                  <div>
                    <Label htmlFor={`fh_age_${index}`} className="text-sm">Age at heart disease event</Label>
                    <Input
                      id={`fh_age_${index}`}
                      type="number"
                      value={record.age_at_event}
                      onChange={(e) => updateFamilyMember(index, "age_at_event", e.target.value)}
                      placeholder="Age"
                    />
                  </div>
                  {formData.apss_s2_family_history_records.length > 1 && (
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFamilyMember(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addFamilyMember}
                className="w-full flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Another Family Member
              </Button>
            </div>
          )}

          <div>
            <Label htmlFor="fh_extra_notes">Additional notes</Label>
            <Textarea
              id="fh_extra_notes"
              value={formData.apss_s2_family_history_extra_notes || ""}
              onChange={(e) => handleChange("apss_s2_family_history_extra_notes", e.target.value)}
              placeholder="Any additional observations or notes..."
              rows={2}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Question 10: Smoking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">10. Do you smoke cigarettes on a daily or weekly basis or have you quit smoking in the last 6 months?</CardTitle>
          <p className="text-sm text-slate-600">Smoking, even on a weekly basis, substantially increases risk for premature death and disability. The harmful effects are still present up to at least 6 months post quitting.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={formData.apss_s2_smoking} onValueChange={(value) => handleChange("apss_s2_smoking", value)}>
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="smoke_yes" />
                <Label htmlFor="smoke_yes" className="cursor-pointer font-normal">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="smoke_no" />
                <Label htmlFor="smoke_no" className="cursor-pointer font-normal">No</Label>
              </div>
            </div>
          </RadioGroup>
          
          {formData.apss_s2_smoking === "yes" && (
            <div className="pl-4 border-l-2 border-orange-200 space-y-3">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smoke_details" className="text-sm">How many per day or week?</Label>
                  <Input
                    id="smoke_details"
                    value={formData.apss_s2_smoking_details}
                    onChange={(e) => handleChange("apss_s2_smoking_details", e.target.value)}
                    placeholder="e.g., 10 per day, 5 per week"
                  />
                </div>
                <div>
                  <Label htmlFor="smoke_years" className="text-sm">How many years have you smoked?</Label>
                  <Input
                    id="smoke_years"
                    type="number"
                    value={formData.apss_s2_smoking_years}
                    onChange={(e) => handleChange("apss_s2_smoking_years", e.target.value)}
                    placeholder="Years"
                  />
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-4">
            <Label className="text-sm font-medium">Are you vaping?</Label>
            <RadioGroup value={formData.apss_s2_vaping} onValueChange={(value) => handleChange("apss_s2_vaping", value)} className="mt-2">
              <div className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="vape_yes" />
                  <Label htmlFor="vape_yes" className="cursor-pointer font-normal">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="vape_no" />
                  <Label htmlFor="vape_no" className="cursor-pointer font-normal">No</Label>
                </div>
              </div>
            </RadioGroup>
          </div>
          
          {formData.apss_s2_vaping === "yes" && (
            <div className="pl-4 border-l-2 border-orange-200 space-y-3">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vape_details" className="text-sm">Frequency of vaping?</Label>
                  <Input
                    id="vape_details"
                    value={formData.apss_s2_vaping_details}
                    onChange={(e) => handleChange("apss_s2_vaping_details", e.target.value)}
                    placeholder="e.g., multiple times per day"
                  />
                </div>
                <div>
                  <Label htmlFor="vape_years" className="text-sm">How many years have you vaped?</Label>
                  <Input
                    id="vape_years"
                    type="number"
                    value={formData.apss_s2_vaping_years}
                    onChange={(e) => handleChange("apss_s2_vaping_years", e.target.value)}
                    placeholder="Years"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="smoke_extra_notes">Additional notes</Label>
            <Textarea
              id="smoke_extra_notes"
              value={formData.apss_s2_smoking_extra_notes || ""}
              onChange={(e) => handleChange("apss_s2_smoking_extra_notes", e.target.value)}
              placeholder="Any additional observations or notes..."
              rows={2}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Question 11: Body Composition */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">11. Body composition</CardTitle>
          <p className="text-sm text-slate-600">Any of the below increases the risk of chronic diseases.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                value={formData.apss_s2_weight_kg}
                onChange={(e) => handleChange("apss_s2_weight_kg", e.target.value)}
                placeholder="kg"
              />
            </div>
            <div>
              <Label htmlFor="height">Height (cm)</Label>
              <Input
                id="height"
                type="number"
                value={formData.apss_s2_height_cm}
                onChange={(e) => handleChange("apss_s2_height_cm", e.target.value)}
                placeholder="cm"
              />
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="bmi">Body Mass Index (kg/mÂ²)</Label>
              <Input
                id="bmi"
                type="number"
                step="0.1"
                value={formData.apss_s2_bmi}
                className="bg-slate-50"
                placeholder="Auto-calculated"
                readOnly // Make BMI read-only as it's auto-calculated
              />
              <p className="text-xs text-slate-500 mt-1">BMI â‰¥ 30 kg/mÂ²</p>
            </div>
            <div>
              <Label htmlFor="waist">Waist circumference (cm)</Label>
              <Input
                id="waist"
                type="number"
                step="0.1"
                value={formData.apss_s2_waist_circumference}
                onChange={(e) => handleChange("apss_s2_waist_circumference", e.target.value)}
                placeholder="cm"
              />
              <p className="text-xs text-slate-500 mt-1">Waist &gt; 94 cm male or &gt; 80 cm female</p>
            </div>
            <div>
              <Label htmlFor="hip">Hip circumference (cm)</Label>
              <Input
                id="hip"
                type="number"
                step="0.1"
                value={formData.apss_s2_hip_circumference}
                onChange={(e) => handleChange("apss_s2_hip_circumference", e.target.value)}
                placeholder="cm"
              />
            </div>
          </div>
          
          <div className="bg-indigo-50 p-4 rounded-lg">
            <Label className="text-sm font-semibold text-indigo-900">Waist-to-Hip Ratio (WHR)</Label>
            <div className="text-2xl font-bold text-indigo-600 mt-1">
              {formData.apss_s2_whr || "â€”"}
            </div>
            <p className="text-xs text-indigo-700 mt-1">
              Risk: Male &gt; 0.90, Female &gt; 0.85
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Question 12: Blood Pressure */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">12. Have you been told that you have high blood pressure?</CardTitle>
          <p className="text-sm text-slate-600">Either of the below increases the risk of heart disease:</p>
          <ul className="text-sm text-slate-600 list-disc ml-5">
            <li>Systolic blood pressure â‰¥ 140 mmHg</li>
            <li>Diastolic blood pressure â‰¥ 90 mmHg</li>
          </ul>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={formData.apss_s2_high_blood_pressure} onValueChange={(value) => handleChange("apss_s2_high_blood_pressure", value)}>
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="bp_yes" />
                <Label htmlFor="bp_yes" className="cursor-pointer font-normal">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="bp_no" />
                <Label htmlFor="bp_no" className="cursor-pointer font-normal">No</Label>
              </div>
            </div>
          </RadioGroup>
          
          {/* Always show BP details fields */}
          <div className="space-y-4 pl-4 border-l-2 border-orange-200">
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="systolic">If known: Systolic BP (mmHg)</Label>
                <Input
                  id="systolic"
                  type="number"
                  value={formData.apss_s2_systolic_bp}
                  onChange={(e) => handleChange("apss_s2_systolic_bp", e.target.value)}
                  placeholder="mmHg"
                />
              </div>
              <div>
                <Label htmlFor="diastolic">Diastolic BP (mmHg)</Label>
                <Input
                  id="diastolic"
                  type="number"
                  value={formData.apss_s2_diastolic_bp}
                  onChange={(e) => handleChange("apss_s2_diastolic_bp", e.target.value)}
                  placeholder="mmHg"
                />
              </div>
              <div>
                <Label htmlFor="heart_rate">Heart Rate (bpm)</Label>
                <Input
                  id="heart_rate"
                  type="number"
                  value={formData.apss_s2_heart_rate}
                  onChange={(e) => handleChange("apss_s2_heart_rate", e.target.value)}
                  placeholder="bpm"
                />
              </div>
              <div>
                <Label htmlFor="spo2">SpO2 (%)</Label>
                <Input
                  id="spo2"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.apss_s2_spo2}
                  onChange={(e) => handleChange("apss_s2_spo2", e.target.value)}
                  placeholder="%"
                />
              </div>
            </div>
            
            <div>
              <Label>Are you taking any medication for this condition?</Label>
              <RadioGroup value={formData.apss_s2_bp_medication} onValueChange={(value) => handleChange("apss_s2_bp_medication", value)}>
                <div className="flex gap-6 mt-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="bp_med_yes" />
                    <Label htmlFor="bp_med_yes" className="cursor-pointer font-normal">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="bp_med_no" />
                    <Label htmlFor="bp_med_no" className="cursor-pointer font-normal">No</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
            
            {formData.apss_s2_bp_medication === "yes" && (
              <div>
                <Label htmlFor="bp_med_details">If yes, provide details</Label>
                <Textarea
                  id="bp_med_details"
                  value={formData.apss_s2_bp_medication_details}
                  onChange={(e) => handleChange("apss_s2_bp_medication_details", e.target.value)}
                  placeholder="Medication names and dosages"
                  rows={2}
                />
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="bp_extra_notes">Additional notes</Label>
            <Textarea
              id="bp_extra_notes"
              value={formData.apss_s2_bp_extra_notes || ""}
              onChange={(e) => handleChange("apss_s2_bp_extra_notes", e.target.value)}
              placeholder="Any additional observations or notes..."
              rows={2}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Question 13: Cholesterol */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">13. Have you been told that you have high cholesterol/blood lipids?</CardTitle>
          <p className="text-sm text-slate-600">Any of the below increases the risk of heart disease:</p>
          <ul className="text-sm text-slate-600 list-disc ml-5">
            <li>Total cholesterol â‰¥ 5.2 mmol/L</li>
            <li>HDL &lt; 1.0 mmol/L</li>
            <li>LDL â‰¥ 3.4 mmol/L</li>
            <li>Triglycerides â‰¥ 1.7 mmol/L</li>
          </ul>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={formData.apss_s2_high_cholesterol} onValueChange={(value) => handleChange("apss_s2_high_cholesterol", value)}>
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="chol_yes" />
                <Label htmlFor="chol_yes" className="cursor-pointer font-normal">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="chol_no" />
                <Label htmlFor="chol_no" className="cursor-pointer font-normal">No</Label>
              </div>
            </div>
          </RadioGroup>
          
          {formData.apss_s2_high_cholesterol === "yes" && (
            <div className="space-y-4 pl-4 border-l-2 border-orange-200">
              <p className="text-sm text-slate-600">If known:</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="total_chol">Total cholesterol (mmol/L)</Label>
                  <Input
                    id="total_chol"
                    type="number"
                    step="0.1"
                    value={formData.apss_s2_total_cholesterol}
                    onChange={(e) => handleChange("apss_s2_total_cholesterol", e.target.value)}
                    placeholder="mmol/L"
                  />
                </div>
                <div>
                  <Label htmlFor="hdl">HDL (mmol/L)</Label>
                  <Input
                    id="hdl"
                    type="number"
                    step="0.1"
                    value={formData.apss_s2_hdl}
                    onChange={(e) => handleChange("apss_s2_hdl", e.target.value)}
                    placeholder="mmol/L"
                  />
                </div>
                <div>
                  <Label htmlFor="ldl">LDL (mmol/L)</Label>
                  <Input
                    id="ldl"
                    type="number"
                    step="0.1"
                    value={formData.apss_s2_ldl}
                    onChange={(e) => handleChange("apss_s2_ldl", e.target.value)}
                    placeholder="mmol/L"
                  />
                </div>
                <div>
                  <Label htmlFor="triglyc">Triglycerides (mmol/L)</Label>
                  <Input
                    id="triglyc"
                    type="number"
                    step="0.1"
                    value={formData.apss_s2_triglycerides}
                    onChange={(e) => handleChange("apss_s2_triglycerides", e.target.value)}
                    placeholder="mmol/L"
                  />
                </div>
              </div>
              
              <div>
                <Label>Are you taking any medication for this condition?</Label>
                <RadioGroup value={formData.apss_s2_cholesterol_medication} onValueChange={(value) => handleChange("apss_s2_cholesterol_medication", value)}>
                  <div className="flex gap-6 mt-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="chol_med_yes" />
                      <Label htmlFor="chol_med_yes" className="cursor-pointer font-normal">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="chol_med_no" />
                      <Label htmlFor="chol_med_no" className="cursor-pointer font-normal">No</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
              
              {formData.apss_s2_cholesterol_medication === "yes" && (
                <div>
                  <Label htmlFor="chol_med_details">If yes, provide details</Label>
                  <Textarea
                    id="chol_med_details"
                    value={formData.apss_s2_cholesterol_medication_details}
                    onChange={(e) => handleChange("apss_s2_cholesterol_medication_details", e.target.value)}
                    placeholder="Medication names and dosages"
                    rows={2}
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="chol_extra_notes">Additional notes</Label>
            <Textarea
              id="chol_extra_notes"
              value={formData.apss_s2_cholesterol_extra_notes || ""}
              onChange={(e) => handleChange("apss_s2_cholesterol_extra_notes", e.target.value)}
              placeholder="Any additional observations or notes..."
              rows={2}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Question 14: Blood Sugar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">14. Have you been told that you have high blood sugar (glucose)?</CardTitle>
          <p className="text-sm text-slate-600">Fasting blood sugar (glucose) â‰¥ 5.5 mmol/L increases the risk of diabetes.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={formData.apss_s2_high_blood_sugar} onValueChange={(value) => handleChange("apss_s2_high_blood_sugar", value)}>
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="bg_yes" />
                <Label htmlFor="bg_yes" className="cursor-pointer font-normal">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="bg_no" />
                <Label htmlFor="bg_no" className="cursor-pointer font-normal">No</Label>
              </div>
            </div>
          </RadioGroup>
          
          {formData.apss_s2_high_blood_sugar === "yes" && (
            <div className="space-y-4 pl-4 border-l-2 border-orange-200">
              <div>
                <Label htmlFor="fasting_glucose">If known: Fasting blood glucose (mmol/L)</Label>
                <Input
                  id="fasting_glucose"
                  type="number"
                  step="0.1"
                  value={formData.apss_s2_fasting_glucose}
                  onChange={(e) => handleChange("apss_s2_fasting_glucose", e.target.value)}
                  placeholder="mmol/L"
                />
              </div>
              
              <div>
                <Label>Are you taking any medication for this condition?</Label>
                <RadioGroup value={formData.apss_s2_glucose_medication} onValueChange={(value) => handleChange("apss_s2_glucose_medication", value)}>
                  <div className="flex gap-6 mt-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="bg_med_yes" />
                      <Label htmlFor="bg_med_yes" className="cursor-pointer font-normal">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="bg_med_no" />
                      <Label htmlFor="bg_med_no" className="cursor-pointer font-normal">No</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
              
              {formData.apss_s2_glucose_medication === "yes" && (
                <div>
                  <Label htmlFor="bg_med_details">If yes, provide details</Label>
                  <Textarea
                    id="bg_med_details"
                    value={formData.apss_s2_glucose_medication_details}
                    onChange={(e) => handleChange("apss_s2_glucose_medication_details", e.target.value)}
                    placeholder="Medication names and dosages"
                    rows={2}
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="bg_extra_notes">Additional notes</Label>
            <Textarea
              id="bg_extra_notes"
              value={formData.apss_s2_glucose_extra_notes || ""}
              onChange={(e) => handleChange("apss_s2_glucose_extra_notes", e.target.value)}
              placeholder="Any additional observations or notes..."
              rows={2}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Question 15: Prescribed Medications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">15. Are you currently taking prescribed medication(s) for any condition(s)? These are additional to those already provided.</CardTitle>
          <p className="text-sm text-slate-600">Taking medication indicates a medically diagnosed problem. Judgment is required when taking medication information into account for determining appropriate exercise prescription because it is common for clients to list 'medications' that include contraceptive pills, vitamin supplements and other non-pharmaceutical tablets. Exercise professionals are not expected to have an exhaustive understanding of medications. Therefore, it may be important to use common language to describe what medical conditions the drugs are prescribed for.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={formData.apss_s2_prescribed_medications} onValueChange={(value) => handleChange("apss_s2_prescribed_medications", value)}>
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="meds_yes" />
                <Label htmlFor="meds_yes" className="cursor-pointer font-normal">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="meds_no" />
                <Label htmlFor="meds_no" className="cursor-pointer font-normal">No</Label>
              </div>
            </div>
          </RadioGroup>
          
          {formData.apss_s2_prescribed_medications === "yes" && (
            <div className="pl-4 border-l-2 border-orange-200">
              <Label htmlFor="meds_list">If yes, what are the medical conditions?</Label>
              <Textarea
                id="meds_list"
                value={formData.apss_s2_medications_list}
                onChange={(e) => handleChange("apss_s2_medications_list", e.target.value)}
                placeholder="List medical conditions requiring prescribed medication..."
                rows={3}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Question 16: Hospital Admissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">16. Have you spent time in hospital (including day admission) for any condition/illness/injury during the last 12 months?</CardTitle>
          <p className="text-sm text-slate-600">There are positive relationships between illness rates and death versus the number and length of hospital admissions in the previous 12 months. This includes admissions for heart attack, stroke, pneumonia, diabetes and Chronic Obstructive Pulmonary Disease, as well as recurrent episodes and inflammatory bowel disease. Admissions are also correlated to poor health status and increased mortality from both cardiovascular disease and poor diet patterns.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={formData.apss_s2_hospital_admissions} onValueChange={(value) => handleChange("apss_s2_hospital_admissions", value)}>
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="hosp_yes" />
                <Label htmlFor="hosp_yes" className="cursor-pointer font-normal">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="hosp_no" />
                <Label htmlFor="hosp_no" className="cursor-pointer font-normal">No</Label>
              </div>
            </div>
          </RadioGroup>
          
          {formData.apss_s2_hospital_admissions === "yes" && (
            <div className="pl-4 border-l-2 border-orange-200">
              <Label htmlFor="hosp_details">If yes, provide details</Label>
              <Textarea
                id="hosp_details"
                value={formData.apss_s2_hospital_admissions_details}
                onChange={(e) => handleChange("apss_s2_hospital_admissions_details", e.target.value)}
                placeholder="Reason for admission, duration, date..."
                rows={3}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Question 17: Pregnancy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">17. Are you pregnant or have you given birth within the last 12 months?</CardTitle>
          <p className="text-sm text-slate-600">During pregnancy and after recent childbirth are times to be more cautious with exercise. Appropriate and safe levels of exercise can be and should result in improved health to mother and baby. However, joints gradually loosen to prepare for birth and may lead to an increased risk of injury especially in the pelvic joints. Activities involving jumping, frequent changes of direction and excessive stretching should be avoided, as should jerky ballistic movements.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={formData.apss_s2_pregnancy} onValueChange={(value) => handleChange("apss_s2_pregnancy", value)}>
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="preg_yes" />
                <Label htmlFor="preg_yes" className="cursor-pointer font-normal">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="preg_no" />
                <Label htmlFor="preg_no" className="cursor-pointer font-normal">No</Label>
              </div>
            </div>
          </RadioGroup>
          
          {formData.apss_s2_pregnancy === "yes" && (
            <div className="pl-4 border-l-2 border-orange-200">
              <Label htmlFor="preg_details">If yes, provide details</Label>
              <Textarea
                id="preg_details"
                value={formData.apss_s2_pregnancy_details}
                onChange={(e) => handleChange("apss_s2_pregnancy_details", e.target.value)}
                placeholder="Due date, weeks pregnant, recent childbirth date..."
                rows={2}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Question 18: Musculoskeletal Issues */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">18. Do you have any diagnosed muscle, bone, tendon, ligament or joint problems that you have been told could be made worse by participating in exercise?</CardTitle>
          <p className="text-sm text-slate-600">Almost everyone has experienced some level of soreness following unaccustomed exercise or activity but this question is designed to identify if soreness due to unaccustomed activity is not the same as pain in the joint, muscle or bone etc., nor is minor inflammatory episodes or nerve pain, such as sciatica. It is assumed that all respondents understand that it is possible that over-extended attention may be required.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={formData.apss_s2_musculoskeletal_issues} onValueChange={(value) => handleChange("apss_s2_musculoskeletal_issues", value)}>
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="msk_yes" />
                <Label htmlFor="msk_yes" className="cursor-pointer font-normal">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="msk_no" />
                <Label htmlFor="msk_no" className="cursor-pointer font-normal">No</Label>
              </div>
            </div>
          </RadioGroup>
          
          {formData.apss_s2_musculoskeletal_issues === "yes" && (
            <div className="pl-4 border-l-2 border-orange-200">
              <Label htmlFor="msk_details">If yes, provide details</Label>
              <Textarea
                id="msk_details"
                value={formData.apss_s2_musculoskeletal_details}
                onChange={(e) => handleChange("apss_s2_musculoskeletal_details", e.target.value)}
                placeholder="Diagnosed conditions, affected areas, limitations..."
                rows={3}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Important Information Footer */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="pt-6">
          <p className="text-sm text-slate-700">
            <strong>Important Information:</strong> This screening tool is part of the Adult Pre-Exercise Screening System (APSS) and should be read with the APSS guidelines (see <a href="https://www.essa.org.au" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">www.essa.org.au</a> and <a href="https://www.sma.org.au" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">www.sma.org.au</a>). We recommend you consult with an appropriate exercise or medical professional for more information.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-6">
        <div className="flex gap-2">
          {canGoBack && (
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Stage 1
            </Button>
          )}
          {onSaveAndFinishLater && (
            <Button type="button" variant="outline" onClick={() => onSaveAndFinishLater(formData)} className="text-slate-600">
              Save & Finish Later
            </Button>
          )}
        </div>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
          Complete Stage 2
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </form>
  );
}