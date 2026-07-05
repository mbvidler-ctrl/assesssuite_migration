import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, FileText, CheckCircle, AlertTriangle, Info } from "lucide-react";

export default function APSSForm({ data, onNext, onBack, canGoBack, onSaveAndFinishLater }) {
  const [currentStage, setCurrentStage] = useState(1); // Added state to manage current stage
  const autoSaveTimeoutRef = useRef(null);

  const [formData, setFormData] = useState({
    apss_q1_heart_stroke: data.apss_q1_heart_stroke !== undefined ? (data.apss_q1_heart_stroke ? "yes" : "no") : "",
    apss_q1_details: data.apss_q1_details || "",
    apss_q2_chest_pain: data.apss_q2_chest_pain !== undefined ? (data.apss_q2_chest_pain ? "yes" : "no") : "",
    apss_q2_details: data.apss_q2_details || "",
    apss_q3_faint_dizzy: data.apss_q3_faint_dizzy !== undefined ? (data.apss_q3_faint_dizzy ? "yes" : "no") : "",
    apss_q3_details: data.apss_q3_details || "",
    apss_q4_asthma: data.apss_q4_asthma !== undefined ? (data.apss_q4_asthma ? "yes" : "no") : "",
    apss_q4_details: data.apss_q4_details || "",
    apss_q5_diabetes_control: data.apss_q5_diabetes_control !== undefined ? (data.apss_q5_diabetes_control ? "yes" : "no") : "",
    apss_q5_details: data.apss_q5_details || "",
    apss_q6_other_conditions: data.apss_q6_other_conditions !== undefined ? (data.apss_q6_other_conditions ? "yes" : "no") : "",
    apss_q6_details: data.apss_q6_details || "",
    apss_q7_activity_light_freq: data.apss_q7_activity_light_freq || "",
    apss_q7_activity_light_duration: data.apss_q7_activity_light_duration || "",
    apss_q7_activity_moderate_freq: data.apss_q7_activity_moderate_freq || "",
    apss_q7_activity_moderate_duration: data.apss_q7_activity_moderate_duration || "",
    apss_q7_activity_vigorous_freq: data.apss_q7_activity_vigorous_freq || "",
    apss_q7_activity_vigorous_duration: data.apss_q7_activity_vigorous_duration || "",
    apss_additional_info: data.apss_additional_info || "",
    apss_completed: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (currentStage === 1) {
      setCurrentStage(2); // Move to Stage 2
    } else { // currentStage === 2, final submission
      // Calculate total weighted minutes: (freq × duration) per row, then add up
      const lightWeeklyMinutes = (Number(formData.apss_q7_activity_light_freq) || 0) * (Number(formData.apss_q7_activity_light_duration) || 0);
      const moderateWeeklyMinutes = (Number(formData.apss_q7_activity_moderate_freq) || 0) * (Number(formData.apss_q7_activity_moderate_duration) || 0);
      const vigorousWeeklyMinutes = (Number(formData.apss_q7_activity_vigorous_freq) || 0) * (Number(formData.apss_q7_activity_vigorous_duration) || 0);
      const totalMinutes = lightWeeklyMinutes + moderateWeeklyMinutes + (vigorousWeeklyMinutes * 2);

      // Build combined additional info including any per-question details
      const detailLines = [];
      if (formData.apss_q1_details) detailLines.push(`Q1 (Heart/Stroke): ${formData.apss_q1_details}`);
      if (formData.apss_q2_details) detailLines.push(`Q2 (Chest Pain): ${formData.apss_q2_details}`);
      if (formData.apss_q3_details) detailLines.push(`Q3 (Faint/Dizzy): ${formData.apss_q3_details}`);
      if (formData.apss_q4_details) detailLines.push(`Q4 (Asthma): ${formData.apss_q4_details}`);
      if (formData.apss_q5_details) detailLines.push(`Q5 (Diabetes): ${formData.apss_q5_details}`);
      if (formData.apss_q6_details) detailLines.push(`Q6 (Other Conditions): ${formData.apss_q6_details}`);
      if (formData.apss_additional_info) detailLines.push(formData.apss_additional_info);
      const combinedAdditionalInfo = detailLines.join('\n\n');

      // Convert "yes"/"no" strings back to booleans for storage
      const submissionData = {
        apss_q1_heart_stroke: formData.apss_q1_heart_stroke === "yes",
        apss_q2_chest_pain: formData.apss_q2_chest_pain === "yes",
        apss_q3_faint_dizzy: formData.apss_q3_faint_dizzy === "yes",
        apss_q4_asthma: formData.apss_q4_asthma === "yes",
        apss_q5_diabetes_control: formData.apss_q5_diabetes_control === "yes",
        apss_q6_other_conditions: formData.apss_q6_other_conditions === "yes",
        apss_q7_activity_light_freq: Number(formData.apss_q7_activity_light_freq) || 0,
        apss_q7_activity_light_duration: Number(formData.apss_q7_activity_light_duration) || 0,
        apss_q7_activity_moderate_freq: Number(formData.apss_q7_activity_moderate_freq) || 0,
        apss_q7_activity_moderate_duration: Number(formData.apss_q7_activity_moderate_duration) || 0,
        apss_q7_activity_vigorous_freq: Number(formData.apss_q7_activity_vigorous_freq) || 0,
        apss_q7_activity_vigorous_duration: Number(formData.apss_q7_activity_vigorous_duration) || 0,
        apss_q7_total_minutes: totalMinutes,
        apss_additional_info: combinedAdditionalInfo,
        apss_completed: true,
        apss_completion_date: new Date().toISOString()
      };
      onNext(submissionData);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updatedData = { ...prev, [field]: value };
      
      // Auto-save after user stops typing for 2 seconds
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        if (onSaveAndFinishLater) {
          const autoDetailLines = [];
          if (updatedData.apss_q1_details) autoDetailLines.push(`Q1 (Heart/Stroke): ${updatedData.apss_q1_details}`);
          if (updatedData.apss_q2_details) autoDetailLines.push(`Q2 (Chest Pain): ${updatedData.apss_q2_details}`);
          if (updatedData.apss_q3_details) autoDetailLines.push(`Q3 (Faint/Dizzy): ${updatedData.apss_q3_details}`);
          if (updatedData.apss_q4_details) autoDetailLines.push(`Q4 (Asthma): ${updatedData.apss_q4_details}`);
          if (updatedData.apss_q5_details) autoDetailLines.push(`Q5 (Diabetes): ${updatedData.apss_q5_details}`);
          if (updatedData.apss_q6_details) autoDetailLines.push(`Q6 (Other Conditions): ${updatedData.apss_q6_details}`);
          if (updatedData.apss_additional_info) autoDetailLines.push(updatedData.apss_additional_info);
          const saveData = {
            apss_q1_heart_stroke: updatedData.apss_q1_heart_stroke === "yes" || undefined,
            apss_q2_chest_pain: updatedData.apss_q2_chest_pain === "yes" || undefined,
            apss_q3_faint_dizzy: updatedData.apss_q3_faint_dizzy === "yes" || undefined,
            apss_q4_asthma: updatedData.apss_q4_asthma === "yes" || undefined,
            apss_q5_diabetes_control: updatedData.apss_q5_diabetes_control === "yes" || undefined,
            apss_q6_other_conditions: updatedData.apss_q6_other_conditions === "yes" || undefined,
            apss_q7_activity_light_freq: updatedData.apss_q7_activity_light_freq ? Number(updatedData.apss_q7_activity_light_freq) : undefined,
            apss_q7_activity_light_duration: updatedData.apss_q7_activity_light_duration ? Number(updatedData.apss_q7_activity_light_duration) : undefined,
            apss_q7_activity_moderate_freq: updatedData.apss_q7_activity_moderate_freq ? Number(updatedData.apss_q7_activity_moderate_freq) : undefined,
            apss_q7_activity_moderate_duration: updatedData.apss_q7_activity_moderate_duration ? Number(updatedData.apss_q7_activity_moderate_duration) : undefined,
            apss_q7_activity_vigorous_freq: updatedData.apss_q7_activity_vigorous_freq ? Number(updatedData.apss_q7_activity_vigorous_freq) : undefined,
            apss_q7_activity_vigorous_duration: updatedData.apss_q7_activity_vigorous_duration ? Number(updatedData.apss_q7_activity_vigorous_duration) : undefined,
            apss_additional_info: autoDetailLines.join('\n\n') || undefined
          };
          onSaveAndFinishLater(saveData, true);
        }
      }, 2000);
      
      return updatedData;
    });
  };
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Calculate risk level for Stage 1
  const hasAnyYes = [
    formData.apss_q1_heart_stroke,
    formData.apss_q2_chest_pain,
    formData.apss_q3_faint_dizzy,
    formData.apss_q4_asthma,
    formData.apss_q5_diabetes_control,
    formData.apss_q6_other_conditions
  ].some(val => val === "yes");

  const getRiskLevel = () => {
    if (hasAnyYes) {
      return {
        level: "High",
        color: "red",
        message: "You answered YES to one or more questions. Please seek guidance from an appropriate allied health professional or medical practitioner prior to undertaking exercise."
      };
    }
    return {
      level: "Low",
      color: "green",
      message: "You answered NO to all questions. Please proceed to question 7 and calculate your typical weighted physical activity/exercise per week."
    };
  };

  const riskAssessment = getRiskLevel();

  // Calculate total weighted minutes for Q7 (used in Stage 2)
  const calculateTotalMinutes = () => {
    const lightWeeklyMinutes = (Number(formData.apss_q7_activity_light_freq) || 0) * (Number(formData.apss_q7_activity_light_duration) || 0);
    const moderateWeeklyMinutes = (Number(formData.apss_q7_activity_moderate_freq) || 0) * (Number(formData.apss_q7_activity_moderate_duration) || 0);
    const vigorousWeeklyMinutes = (Number(formData.apss_q7_activity_vigorous_freq) || 0) * (Number(formData.apss_q7_activity_vigorous_duration) || 0);
    return lightWeeklyMinutes + moderateWeeklyMinutes + (vigorousWeeklyMinutes * 2);
  };

  const totalMinutes = calculateTotalMinutes();

  // Get recommendation based on total minutes and risk (used in Stage 2)
  const getRecommendation = () => {
    // This recommendation is a combination of Stage 1 and Stage 2 assessment
    if (hasAnyYes) {
      return {
        color: "red",
        title: "Medical Clearance Required",
        message: "Please seek guidance from an appropriate allied health professional or medical practitioner prior to undertaking exercise."
      };
    } else if (totalMinutes < 150) {
      return {
        color: "pink",
        title: "Light to Moderate Intensity Recommended",
        message: "If the amount that you declare any progression (volume, intensity or both) with an exercise professional to optimise your results. Your current activity level is below 150 minutes per week - increase your volume and intensity slowly."
      };
    } else {
      return {
        color: "green",
        title: "Continue with Caution",
        message: "You are meeting physical activity guidelines (≥150 minutes per week). Continue your current program and progress carefully under professional guidance."
      };
    }
  };

  const recommendation = getRecommendation();

  // Handle back button clicks
  const handleBack = () => {
    if (currentStage === 2) {
      setCurrentStage(1); // Go back to Stage 1
    } else {
      onBack(); // Go back to parent component's previous step
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {currentStage === 1 && (
        <>
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <FileText className="w-5 h-5" />
                Adult Pre-exercise Screening System (APSS) - Stage 1
              </CardTitle>
              <p className="text-sm text-blue-600">
                Please tick your response to each question.
              </p>
            </CardHeader>
          </Card>

          {/* Stage 1: Questions 1-6 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-slate-900">Stage 1 (Compulsory) - Pre-Exercise Health Questions</CardTitle>
              <p className="text-sm text-slate-600">Answer YES or NO to each question</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-4">
                  <Label className="text-sm leading-relaxed block mb-3 font-medium">
                    1. Has your medical practitioner ever told you that you have a heart condition or have you ever suffered a stroke?
                  </Label>
                  <RadioGroup value={formData.apss_q1_heart_stroke} onValueChange={(value) => handleChange("apss_q1_heart_stroke", value)}>
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="q1_yes" />
                        <Label htmlFor="q1_yes" className="cursor-pointer font-normal">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="q1_no" />
                        <Label htmlFor="q1_no" className="cursor-pointer font-normal">No</Label>
                      </div>
                    </div>
                  </RadioGroup>
                  {formData.apss_q1_heart_stroke === "yes" && (
                    <div className="mt-3 pl-4 border-l-2 border-orange-200">
                      <Label htmlFor="q1_details" className="text-sm text-slate-600">Please provide details</Label>
                      <Textarea
                        id="q1_details"
                        value={formData.apss_q1_details}
                        onChange={(e) => handleChange("apss_q1_details", e.target.value)}
                        placeholder="Describe the condition, when diagnosed, current status..."
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                <div className="border-b border-slate-200 pb-4">
                  <Label className="text-sm leading-relaxed block mb-3 font-medium">
                    2. Do you ever experience unexplained pains or discomfort in your chest at rest or during physical activity/exercise?
                  </Label>
                  <RadioGroup value={formData.apss_q2_chest_pain} onValueChange={(value) => handleChange("apss_q2_chest_pain", value)}>
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="q2_yes" />
                        <Label htmlFor="q2_yes" className="cursor-pointer font-normal">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="q2_no" />
                        <Label htmlFor="q2_no" className="cursor-pointer font-normal">No</Label>
                      </div>
                    </div>
                  </RadioGroup>
                  {formData.apss_q2_chest_pain === "yes" && (
                    <div className="mt-3 pl-4 border-l-2 border-orange-200">
                      <Label htmlFor="q2_details" className="text-sm text-slate-600">Please provide details</Label>
                      <Textarea
                        id="q2_details"
                        value={formData.apss_q2_details}
                        onChange={(e) => handleChange("apss_q2_details", e.target.value)}
                        placeholder="Describe the pain, frequency, what triggers it..."
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                <div className="border-b border-slate-200 pb-4">
                  <Label className="text-sm leading-relaxed block mb-3 font-medium">
                    3. Do you ever feel faint, dizzy or lose balance during physical activity/exercise?
                  </Label>
                  <RadioGroup value={formData.apss_q3_faint_dizzy} onValueChange={(value) => handleChange("apss_q3_faint_dizzy", value)}>
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="q3_yes" />
                        <Label htmlFor="q3_yes" className="cursor-pointer font-normal">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="q3_no" />
                        <Label htmlFor="q3_no" className="cursor-pointer font-normal">No</Label>
                      </div>
                    </div>
                  </RadioGroup>
                  {formData.apss_q3_faint_dizzy === "yes" && (
                    <div className="mt-3 pl-4 border-l-2 border-orange-200">
                      <Label htmlFor="q3_details" className="text-sm text-slate-600">Please provide details</Label>
                      <Textarea
                        id="q3_details"
                        value={formData.apss_q3_details}
                        onChange={(e) => handleChange("apss_q3_details", e.target.value)}
                        placeholder="Describe the symptoms, frequency, what triggers them..."
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                <div className="border-b border-slate-200 pb-4">
                  <Label className="text-sm leading-relaxed block mb-3 font-medium">
                    4. Have you had an asthma attack requiring immediate medical attention at any time over the last 12 months?
                  </Label>
                  <RadioGroup value={formData.apss_q4_asthma} onValueChange={(value) => handleChange("apss_q4_asthma", value)}>
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="q4_yes" />
                        <Label htmlFor="q4_yes" className="cursor-pointer font-normal">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="q4_no" />
                        <Label htmlFor="q4_no" className="cursor-pointer font-normal">No</Label>
                      </div>
                    </div>
                  </RadioGroup>
                  {formData.apss_q4_asthma === "yes" && (
                    <div className="mt-3 pl-4 border-l-2 border-orange-200">
                      <Label htmlFor="q4_details" className="text-sm text-slate-600">Please provide details</Label>
                      <Textarea
                        id="q4_details"
                        value={formData.apss_q4_details}
                        onChange={(e) => handleChange("apss_q4_details", e.target.value)}
                        placeholder="Describe when attacks occur, current medications..."
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                <div className="border-b border-slate-200 pb-4">
                  <Label className="text-sm leading-relaxed block mb-3 font-medium">
                    5. If you have diabetes (type 1 or 2) have you had trouble controlling your blood sugar (glucose) in the last 3 months?
                  </Label>
                  <RadioGroup value={formData.apss_q5_diabetes_control} onValueChange={(value) => handleChange("apss_q5_diabetes_control", value)}>
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="q5_yes" />
                        <Label htmlFor="q5_yes" className="cursor-pointer font-normal">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="q5_no" />
                        <Label htmlFor="q5_no" className="cursor-pointer font-normal">No</Label>
                      </div>
                    </div>
                  </RadioGroup>
                  {formData.apss_q5_diabetes_control === "yes" && (
                    <div className="mt-3 pl-4 border-l-2 border-orange-200">
                      <Label htmlFor="q5_details" className="text-sm text-slate-600">Please provide details</Label>
                      <Textarea
                        id="q5_details"
                        value={formData.apss_q5_details}
                        onChange={(e) => handleChange("apss_q5_details", e.target.value)}
                        placeholder="Describe blood sugar control issues, current management..."
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                <div className="border-b border-slate-200 pb-4">
                  <Label className="text-sm leading-relaxed block mb-3 font-medium">
                    6. Do you have any other conditions that may require special consideration for you to exercise?
                  </Label>
                  <RadioGroup value={formData.apss_q6_other_conditions} onValueChange={(value) => handleChange("apss_q6_other_conditions", value)}>
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="q6_yes" />
                        <Label htmlFor="q6_yes" className="cursor-pointer font-normal">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="q6_no" />
                        <Label htmlFor="q6_no" className="cursor-pointer font-normal">No</Label>
                      </div>
                    </div>
                  </RadioGroup>
                  {formData.apss_q6_other_conditions === "yes" && (
                    <div className="mt-3 pl-4 border-l-2 border-orange-200">
                      <Label htmlFor="q6_details" className="text-sm text-slate-600">Please provide details</Label>
                      <Textarea
                        id="q6_details"
                        value={formData.apss_q6_details}
                        onChange={(e) => handleChange("apss_q6_details", e.target.value)}
                        placeholder="Describe any other conditions or considerations..."
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stage 1 Result */}
          <Card className={`border-2 ${
            riskAssessment.color === 'red' ? 'border-red-200 bg-red-50' :
            riskAssessment.color === 'green' ? 'border-green-200 bg-green-50' : ''
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                {riskAssessment.color === 'red' && <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />}
                {riskAssessment.color === 'green' && <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />}
                <div className="flex-1">
                  <h4 className={`font-semibold text-lg mb-2 ${
                    riskAssessment.color === 'red' ? 'text-red-800' :
                    riskAssessment.color === 'green' ? 'text-green-800' : ''
                  }`}>
                    {riskAssessment.level} Risk Level
                  </h4>
                  <p className={`text-sm ${
                    riskAssessment.color === 'red' ? 'text-red-700' :
                    riskAssessment.color === 'green' ? 'text-green-700' : ''
                  }`}>
                    {riskAssessment.message}
                  </p>
                  {hasAnyYes && (
                    <p className="text-sm text-red-700 mt-3 font-medium">
                      Note: You may continue to complete this form, but medical clearance must be obtained before commencing exercise.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {currentStage === 2 && (
        <>
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-800">
                <FileText className="w-5 h-5" />
                Adult Pre-exercise Screening System (APSS) - Stage 2
              </CardTitle>
              <p className="text-sm text-purple-600">
                Recommended Risk Assessment.
              </p>
            </CardHeader>
          </Card>

          {/* Question 7: Physical Activity Levels */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-slate-900">Question 7: Current Physical Activity Levels</CardTitle>
              <p className="text-sm text-slate-600">
                Describe your current physical activity/exercise levels in a typical week by stating the frequency and duration at the different intensities. For intensity guidelines consult Figure 2 below.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Exercise Intensity Guidelines (Figure 2) */}
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-blue-900">Figure 2: Exercise Intensity Guidelines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="font-semibold text-slate-700">Intensity Category</div>
                    <div className="font-semibold text-slate-700">Heart Rate</div>
                    <div className="font-semibold text-slate-700">Perceived Exertion (RPE)</div>
                    <div className="font-semibold text-slate-700">Descriptive Measures</div>

                    {/* LIGHT */}
                    <div className="bg-orange-400 text-white p-2 rounded font-semibold">LIGHT</div>
                    <div className="bg-slate-100 p-2 rounded">40 to &lt;55% HRmax*</div>
                    <div className="bg-blue-200 p-2 rounded">VERY LIGHT TO LIGHT RPE 1-2</div>
                    <div className="bg-slate-100 p-2 rounded text-xs">
                      • An aerobic activity that does not cause a noticeable change in breathing rate<br/>
                      • An intensity that can be conducted whilst talking comfortably or remain for 60 minutes
                    </div>

                    {/* MODERATE */}
                    <div className="bg-orange-500 text-white p-2 rounded font-semibold">MODERATE</div>
                    <div className="bg-slate-100 p-2 rounded">55 to &lt;70% HRmax*</div>
                    <div className="bg-blue-300 p-2 rounded">MODERATE TO SOMEWHAT HARD RPE 3-4</div>
                    <div className="bg-slate-100 p-2 rounded text-xs">
                      • An aerobic activity that is able to be conducted whilst still being able to talk, yet uninterrupted<br/>
                      • An intensity that may last between 30 and 60 minutes
                    </div>

                    {/* VIGOROUS */}
                    <div className="bg-orange-600 text-white p-2 rounded font-semibold">VIGOROUS</div>
                    <div className="bg-slate-100 p-2 rounded">70 to &lt;90% HRmax*</div>
                    <div className="bg-blue-400 p-2 rounded">HARD RPE 5-6</div>
                    <div className="bg-slate-100 p-2 rounded text-xs">
                      • An aerobic activity where a conversation generally cannot be maintained<br/>
                      • An intensity that may last up to 30 minutes
                    </div>

                    {/* HIGH */}
                    <div className="bg-orange-700 text-white p-2 rounded font-semibold">HIGH</div>
                    <div className="bg-slate-100 p-2 rounded">≥ 90% HRmax*</div>
                    <div className="bg-blue-500 text-white p-2 rounded">VERY HARD RPE 7</div>
                    <div className="bg-slate-100 p-2 rounded text-xs">
                      • An aerobic activity in which it is difficult to talk at all<br/>
                      • An intensity that generally cannot be sustained for longer than several minutes
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-2">
                    * HRmax = estimated heart rate maximum. Calculated by subtracting age in years from 220 (e.g., for a 40 year old person = 220 - 40 = 180 beats per minute).<br/>
                    Note: Rating of Perceived Exertion (RPE) is a 7-point score. For further details, please reference the general principles of physical activity and exercise for adults.<br/>
                    ‡ Ref: Med Sport 11, 66-662.
                  </p>
                </CardContent>
              </Card>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border p-2 text-left">Intensity</th>
                      <th className="border p-2 text-center">Frequency<br/>(sessions per week)</th>
                      <th className="border p-2 text-center">Duration<br/>(minutes per session)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border p-2 font-medium">Light</td>
                      <td className="border p-2">
                        <Input
                          type="number"
                          min="0"
                          value={formData.apss_q7_activity_light_freq}
                          onChange={(e) => handleChange("apss_q7_activity_light_freq", e.target.value)}
                          className="text-center"
                          placeholder="0"
                        />
                      </td>
                      <td className="border p-2">
                        <Input
                          type="number"
                          min="0"
                          value={formData.apss_q7_activity_light_duration}
                          onChange={(e) => handleChange("apss_q7_activity_light_duration", e.target.value)}
                          className="text-center"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="border p-2 font-medium">Moderate</td>
                      <td className="border p-2">
                        <Input
                          type="number"
                          min="0"
                          value={formData.apss_q7_activity_moderate_freq}
                          onChange={(e) => handleChange("apss_q7_activity_moderate_freq", e.target.value)}
                          className="text-center"
                          placeholder="0"
                        />
                      </td>
                      <td className="border p-2">
                        <Input
                          type="number"
                          min="0"
                          value={formData.apss_q7_activity_moderate_duration}
                          onChange={(e) => handleChange("apss_q7_activity_moderate_duration", e.target.value)}
                          className="text-center"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="border p-2 font-medium">Vigorous/High</td>
                      <td className="border p-2">
                        <Input
                          type="number"
                          min="0"
                          value={formData.apss_q7_activity_vigorous_freq}
                          onChange={(e) => handleChange("apss_q7_activity_vigorous_freq", e.target.value)}
                          className="text-center"
                          placeholder="0"
                        />
                      </td>
                      <td className="border p-2">
                        <Input
                          type="number"
                          min="0"
                          value={formData.apss_q7_activity_vigorous_duration}
                          onChange={(e) => handleChange("apss_q7_activity_vigorous_duration", e.target.value)}
                          className="text-center"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <Card className="bg-indigo-50 border-indigo-200">
                <CardContent className="pt-4">
                  <h5 className="font-semibold text-indigo-900 mb-2">Weighted Physical Activity/Exercise per Week</h5>
                  <p className="text-sm text-indigo-700 mb-2">
                    Total minutes = (Light: freq × duration) + (Moderate: freq × duration) + (2 × Vigorous: freq × duration)
                  </p>
                  <div className="text-sm text-slate-600 mb-2">
                    <div>Light: {(Number(formData.apss_q7_activity_light_freq) || 0) * (Number(formData.apss_q7_activity_light_duration) || 0)} minutes/week</div>
                    <div>Moderate: {(Number(formData.apss_q7_activity_moderate_freq) || 0) * (Number(formData.apss_q7_activity_moderate_duration) || 0)} minutes/week</div>
                    <div>Vigorous: {(Number(formData.apss_q7_activity_vigorous_freq) || 0) * (Number(formData.apss_q7_activity_vigorous_duration) || 0)} × 2 = {((Number(formData.apss_q7_activity_vigorous_freq) || 0) * (Number(formData.apss_q7_activity_vigorous_duration) || 0) * 2)} minutes/week</div>
                  </div>
                  <div className="text-3xl font-bold text-indigo-600">
                    TOTAL = {totalMinutes} minutes per week
                  </div>
                  <div className="mt-3 text-sm text-indigo-700">
                    {totalMinutes < 150 ? (
                      <p>• If your total is less than 150 minutes per week then light to moderate intensity exercise is recommended. Increase your volume and intensity slowly.</p>
                    ) : (
                      <p>✓ You are meeting the recommended 150+ minutes of weighted physical activity per week.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>



          {/* Additional Information */}
          <div>
            <Label htmlFor="apss_additional_info" className="text-sm font-medium text-slate-700">
              Additional Health Information
            </Label>
            <p className="text-xs text-slate-500 mt-1 mb-2">
              Please provide any additional health information, medications, or concerns not covered above.
            </p>
            <Textarea
              id="apss_additional_info"
              value={formData.apss_additional_info}
              onChange={(e) => handleChange("apss_additional_info", e.target.value)}
              placeholder="e.g., Current medications, recent surgeries, specific injuries, health goals..."
              className="mt-1"
              rows={4}
            />
          </div>
        </>
      )}

      <div className="flex justify-between pt-6">
        <div className="flex gap-2">
          {(canGoBack || currentStage === 2) && (
            <Button type="button" variant="outline" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {currentStage === 2 ? "Back to Stage 1" : "Back"}
            </Button>
          )}
          {onSaveAndFinishLater && currentStage === 1 && (
            <Button type="button" variant="outline" onClick={() => {
              const btnDetailLines = [];
              if (formData.apss_q1_details) btnDetailLines.push(`Q1 (Heart/Stroke): ${formData.apss_q1_details}`);
              if (formData.apss_q2_details) btnDetailLines.push(`Q2 (Chest Pain): ${formData.apss_q2_details}`);
              if (formData.apss_q3_details) btnDetailLines.push(`Q3 (Faint/Dizzy): ${formData.apss_q3_details}`);
              if (formData.apss_q4_details) btnDetailLines.push(`Q4 (Asthma): ${formData.apss_q4_details}`);
              if (formData.apss_q5_details) btnDetailLines.push(`Q5 (Diabetes): ${formData.apss_q5_details}`);
              if (formData.apss_q6_details) btnDetailLines.push(`Q6 (Other Conditions): ${formData.apss_q6_details}`);
              if (formData.apss_additional_info) btnDetailLines.push(formData.apss_additional_info);
              const saveData = {
                apss_q1_heart_stroke: formData.apss_q1_heart_stroke === "yes" || undefined,
                apss_q2_chest_pain: formData.apss_q2_chest_pain === "yes" || undefined,
                apss_q3_faint_dizzy: formData.apss_q3_faint_dizzy === "yes" || undefined,
                apss_q4_asthma: formData.apss_q4_asthma === "yes" || undefined,
                apss_q5_diabetes_control: formData.apss_q5_diabetes_control === "yes" || undefined,
                apss_q6_other_conditions: formData.apss_q6_other_conditions === "yes" || undefined,
                apss_q7_activity_light_freq: formData.apss_q7_activity_light_freq ? Number(formData.apss_q7_activity_light_freq) : undefined,
                apss_q7_activity_light_duration: formData.apss_q7_activity_light_duration ? Number(formData.apss_q7_activity_light_duration) : undefined,
                apss_q7_activity_moderate_freq: formData.apss_q7_activity_moderate_freq ? Number(formData.apss_q7_activity_moderate_freq) : undefined,
                apss_q7_activity_moderate_duration: formData.apss_q7_activity_moderate_duration ? Number(formData.apss_q7_activity_moderate_duration) : undefined,
                apss_q7_activity_vigorous_freq: formData.apss_q7_activity_vigorous_freq ? Number(formData.apss_q7_activity_vigorous_freq) : undefined,
                apss_q7_activity_vigorous_duration: formData.apss_q7_activity_vigorous_duration ? Number(formData.apss_q7_activity_vigorous_duration) : undefined,
                apss_additional_info: btnDetailLines.join('\n\n') || undefined
              };
              onSaveAndFinishLater(saveData);
            }} className="text-slate-600">
              Save & Finish Later
            </Button>
          )}
        </div>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
          {currentStage === 1 ? "Next: Stage 2" : "Complete APSS Form"}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </form>
  );
}