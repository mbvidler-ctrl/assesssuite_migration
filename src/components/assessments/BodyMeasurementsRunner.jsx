import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

export default function BodyMeasurementsRunner({ onSave, onClose, assessmentName }) {
  const [measurements, setMeasurements] = useState({
    height: "",
    weight: "",
    waist: ""
  });
  const [notes, setNotes] = useState("");

  const isHeight = assessmentName?.toLowerCase().includes('height');
  const isWeight = assessmentName?.toLowerCase().includes('weight');
  const isWaist = assessmentName?.toLowerCase().includes('waist') && !assessmentName?.toLowerCase().includes('hip');
  const isBMI = assessmentName?.toLowerCase().includes('bmi') || assessmentName?.toLowerCase().includes('body mass');

  const calculateBMI = () => {
    const h = parseFloat(measurements.height);
    const w = parseFloat(measurements.weight);
    if (!h || !w) return null;
    const heightM = h / 100;
    return (w / (heightM * heightM)).toFixed(1);
  };

  const bmi = calculateBMI();

  const getBMIInterpretation = () => {
    if (!bmi) return null;
    const b = parseFloat(bmi);

    if (b < 18.5) return { category: 'Underweight', color: 'text-blue-600', bg: 'bg-blue-50', risk: 'Increased risk of nutritional deficiencies' };
    if (b < 25) return { category: 'Normal Weight', color: 'text-green-600', bg: 'bg-green-50', risk: 'Lowest health risk' };
    if (b < 30) return { category: 'Overweight', color: 'text-yellow-600', bg: 'bg-yellow-50', risk: 'Increased risk of chronic diseases' };
    if (b < 35) return { category: 'Obesity Class I', color: 'text-orange-600', bg: 'bg-orange-50', risk: 'Moderate to high health risk' };
    if (b < 40) return { category: 'Obesity Class II', color: 'text-red-600', bg: 'bg-red-50', risk: 'High health risk' };
    return { category: 'Obesity Class III', color: 'text-red-700', bg: 'bg-red-100', risk: 'Very high health risk' };
  };

  const getWaistInterpretation = (waist, gender = "male") => {
    const w = parseFloat(waist);
    if (!w) return null;

    // Australian standards
    if (gender === "male") {
      if (w < 94) return { level: 'Normal', color: 'text-green-600', bg: 'bg-green-50', risk: 'Low risk' };
      if (w < 102) return { level: 'Increased Risk', color: 'text-yellow-600', bg: 'bg-yellow-50', risk: 'Increased risk of metabolic complications' };
      return { level: 'High Risk', color: 'text-red-600', bg: 'bg-red-50', risk: 'Substantially increased risk' };
    } else {
      if (w < 80) return { level: 'Normal', color: 'text-green-600', bg: 'bg-green-50', risk: 'Low risk' };
      if (w < 88) return { level: 'Increased Risk', color: 'text-yellow-600', bg: 'bg-yellow-50', risk: 'Increased risk of metabolic complications' };
      return { level: 'High Risk', color: 'text-red-600', bg: 'bg-red-50', risk: 'Substantially increased risk' };
    }
  };

  const bmiInterp = getBMIInterpretation();
  const waistInterp = measurements.waist ? getWaistInterpretation(measurements.waist) : null;

  const handleSave = () => {
    let resultValue = "";
    let additionalData = {};

    if (isHeight) {
      if (!measurements.height) {
        toast.error("Please enter height");
        return;
      }
      resultValue = measurements.height;
      additionalData = { height_cm: parseFloat(measurements.height) };
    } else if (isWeight) {
      if (!measurements.weight) {
        toast.error("Please enter weight");
        return;
      }
      resultValue = measurements.weight;
      additionalData = { weight_kg: parseFloat(measurements.weight) };
    } else if (isWaist) {
      if (!measurements.waist) {
        toast.error("Please enter waist circumference");
        return;
      }
      resultValue = measurements.waist;
      additionalData = { 
        waist_cm: parseFloat(measurements.waist),
        interpretation: waistInterp?.level
      };
    } else if (isBMI) {
      if (!measurements.height || !measurements.weight) {
        toast.error("Please enter both height and weight");
        return;
      }
      resultValue = bmi;
      additionalData = {
        height_cm: parseFloat(measurements.height),
        weight_kg: parseFloat(measurements.weight),
        bmi: parseFloat(bmi),
        category: bmiInterp?.category
      };
    } else {
      // General body measurements
      if (!measurements.height && !measurements.weight && !measurements.waist) {
        toast.error("Please enter at least one measurement");
        return;
      }
      const parts = [];
      if (measurements.height) parts.push(`H: ${measurements.height}cm`);
      if (measurements.weight) parts.push(`W: ${measurements.weight}kg`);
      if (measurements.waist) parts.push(`Waist: ${measurements.waist}cm`);
      if (bmi) parts.push(`BMI: ${bmi}`);
      
      resultValue = parts.join(', ');
      additionalData = {
        height_cm: measurements.height ? parseFloat(measurements.height) : null,
        weight_kg: measurements.weight ? parseFloat(measurements.weight) : null,
        waist_cm: measurements.waist ? parseFloat(measurements.waist) : null,
        bmi: bmi ? parseFloat(bmi) : null,
        bmi_category: bmiInterp?.category
      };
    }

    const soapText = `â€¢ ${assessmentName || 'Body Measurements'}\n  Result: ${resultValue}`;
    onSave({
      result_value: resultValue,
      additional_data: { ...additionalData, soap_text: soapText },
      notes: notes,
      unit_of_measure: isHeight ? "cm" : isWeight ? "kg" : isWaist ? "cm" : isBMI ? "kg/mÂ²" : "",
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{assessmentName || 'Body Measurements'}</h2>
              <p className="text-slate-600 mt-1">Anthropometric assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Measurement Guidelines
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>Height:</strong> Measured barefoot, standing upright against stadiometer. Record in cm.</p>
                <p><strong>Weight:</strong> Measured in light clothing, after voiding. Record in kg.</p>
                <p><strong>Waist:</strong> Measured at midpoint between lowest rib and iliac crest, at end of normal expiration. Record in cm.</p>
                <p><strong>BMI:</strong> Weight (kg) / HeightÂ² (mÂ²). Screening tool, doesn't measure body composition directly.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Measurements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(!isWeight && !isWaist) && (
                  <div>
                    <Label>Height (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={measurements.height}
                      onChange={(e) => setMeasurements({...measurements, height: e.target.value})}
                      placeholder="e.g., 175"
                    />
                  </div>
                )}

                {(!isHeight && !isWaist) && (
                  <div>
                    <Label>Weight (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={measurements.weight}
                      onChange={(e) => setMeasurements({...measurements, weight: e.target.value})}
                      placeholder="e.g., 75"
                    />
                  </div>
                )}

                {(!isHeight && !isWeight && !isBMI) && (
                  <div>
                    <Label>Waist Circumference (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={measurements.waist}
                      onChange={(e) => setMeasurements({...measurements, waist: e.target.value})}
                      placeholder="e.g., 85"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {bmi && (isBMI || (!isHeight && !isWeight && !isWaist)) && (
              <Card className={`${bmiInterp.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-xl ${bmiInterp.color}`}>
                    BMI: {bmi} kg/mÂ²
                  </CardTitle>
                </CardHeader>
                <CardContent className={bmiInterp.color}>
                  <p className="font-semibold">{bmiInterp.category}</p>
                  <p className="mt-2">{bmiInterp.risk}</p>
                  <p className="text-xs mt-3 opacity-80">Note: BMI is a screening tool. Consider body composition, muscle mass, and ethnicity.</p>
                </CardContent>
              </Card>
            )}

            {waistInterp && (isWaist || (!isHeight && !isWeight && !isBMI)) && (
              <Card className={`${waistInterp.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-xl ${waistInterp.color}`}>
                    Waist: {measurements.waist} cm - {waistInterp.level}
                  </CardTitle>
                </CardHeader>
                <CardContent className={waistInterp.color}>
                  <p>{waistInterp.risk}</p>
                  <p className="text-xs mt-3 opacity-80">Australian standards: Men &lt;94cm normal, &gt;102cm high risk. Women &lt;80cm normal, &gt;88cm high risk.</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Measurement conditions, ethnicity considerations, body composition notes..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Save Measurements
          </Button>
        </div>
      </div>
    </div>
  );
}