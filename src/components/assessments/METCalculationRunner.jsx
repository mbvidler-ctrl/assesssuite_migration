import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { X, Save, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function METCalculationRunner({ client, onSave, onClose }) {
  const [formData, setFormData] = useState({
    calculation_method: "",
    activity_name: "",
    weight_kg: "",
    duration_min: "",
    manual_met_value: "",
    manual_met_source: "",
    activity_met_reference: "",
    treadmill_speed_kmh: "",
    treadmill_grade_percent: "",
    cycle_workload_watts: "",
    cycle_cadence_rpm: "",
    rpe: "",
    hr_bpm: "",
    spo2: "",
    symptoms: [],
    clinical_notes: ""
  });

  // Calculations
  const calculations = useMemo(() => {
    const speed_m_min = formData.calculation_method && ["treadmill_walking", "treadmill_running"].includes(formData.calculation_method) 
      ? parseFloat(formData.treadmill_speed_kmh) * 16.6667 
      : null;

    const grade_decimal = formData.calculation_method && ["treadmill_walking", "treadmill_running"].includes(formData.calculation_method)
      ? parseFloat(formData.treadmill_grade_percent) / 100
      : null;

    let vo2_ml_kg_min = null;
    if (formData.calculation_method === "manual_met") {
      vo2_ml_kg_min = parseFloat(formData.manual_met_value) * 3.5;
    } else if (formData.calculation_method === "activity_based") {
      vo2_ml_kg_min = parseFloat(formData.activity_met_reference) * 3.5;
    } else if (formData.calculation_method === "treadmill_walking" && speed_m_min && grade_decimal !== null) {
      vo2_ml_kg_min = (0.1 * speed_m_min) + (1.8 * speed_m_min * grade_decimal) + 3.5;
    } else if (formData.calculation_method === "treadmill_running" && speed_m_min && grade_decimal !== null) {
      vo2_ml_kg_min = (0.2 * speed_m_min) + (0.9 * speed_m_min * grade_decimal) + 3.5;
    } else if (formData.calculation_method === "cycle_ergometer" && formData.cycle_workload_watts && formData.weight_kg) {
      vo2_ml_kg_min = ((1.8 * (parseFloat(formData.cycle_workload_watts) * 6.12) / parseFloat(formData.weight_kg)) + 7);
    }

    const mets = vo2_ml_kg_min ? (vo2_ml_kg_min / 3.5).toFixed(2) : null;
    const kcal_per_min = mets && formData.weight_kg ? ((parseFloat(mets) * 3.5 * parseFloat(formData.weight_kg)) / 200).toFixed(2) : null;
    const total_kcal = kcal_per_min && formData.duration_min ? (parseFloat(kcal_per_min) * parseInt(formData.duration_min)).toFixed(0) : null;

    let intensity_band = "";
    if (mets) {
      const m = parseFloat(mets);
      if (m < 1.5) intensity_band = "Resting / Very Light";
      else if (m < 3) intensity_band = "Light";
      else if (m < 6) intensity_band = "Moderate";
      else if (m < 9) intensity_band = "Vigorous";
      else intensity_band = "Very Vigorous";
    }

    let method_label = "";
    if (formData.calculation_method === "manual_met") method_label = "Manual MET entry";
    else if (formData.calculation_method === "activity_based") method_label = "Activity-based estimate";
    else if (formData.calculation_method === "treadmill_walking") method_label = "ACSM treadmill walking equation";
    else if (formData.calculation_method === "treadmill_running") method_label = "ACSM treadmill running equation";
    else if (formData.calculation_method === "cycle_ergometer") method_label = "Cycle ergometer estimate";

    let met_quality_flag = "";
    if (formData.calculation_method === "manual_met") {
      if (formData.manual_met_source === "measured") met_quality_flag = "High confidence";
      else if (formData.manual_met_source === "compendium") met_quality_flag = "Moderate confidence";
      else met_quality_flag = "Lower confidence estimate";
    } else if (["treadmill_walking", "treadmill_running", "cycle_ergometer"].includes(formData.calculation_method)) {
      met_quality_flag = "Moderate confidence";
    } else if (formData.calculation_method === "activity_based") {
      met_quality_flag = "Lower confidence estimate";
    }

    let clinical_interpretation = "";
    if (mets) {
      const m = parseFloat(mets);
      if (m < 3) clinical_interpretation = "This activity falls within the light intensity range. Appropriate for deconditioned clients, early-stage rehabilitation, or active recovery.";
      else if (m < 6) clinical_interpretation = "This activity falls within the moderate intensity range. Commonly used for cardiovascular conditioning and chronic disease management.";
      else if (m < 9) clinical_interpretation = "This activity falls within the vigorous intensity range. Suitability depends on fitness, symptom response, and comorbidities.";
      else clinical_interpretation = "This activity falls within the very vigorous range. Use caution and ensure appropriateness for the individual.";
    }

    return {
      speed_m_min,
      grade_decimal,
      vo2_ml_kg_min: vo2_ml_kg_min ? vo2_ml_kg_min.toFixed(2) : null,
      mets,
      kcal_per_min,
      total_kcal,
      intensity_band,
      method_label,
      met_quality_flag,
      clinical_interpretation
    };
  }, [formData]);

  // Quality checks
  const qualityWarnings = useMemo(() => {
    const warnings = [];
    if (formData.calculation_method === "manual_met" && !formData.manual_met_source) {
      warnings.push("Please document the source of the MET value.");
    }
    if (formData.calculation_method === "manual_met" && formData.manual_met_source === "clinician_estimate") {
      warnings.push("Clinician-estimated METs are lower-confidence.");
    }
    if (formData.calculation_method === "treadmill_walking" && parseFloat(formData.treadmill_speed_kmh) > 8) {
      warnings.push("Walking equation may be less appropriate at this speed. Consider running equation.");
    }
    if (formData.calculation_method === "treadmill_running" && parseFloat(formData.treadmill_speed_kmh) < 8) {
      warnings.push("Running equation may be less appropriate at low speeds. Consider walking equation.");
    }
    if (formData.spo2 && parseFloat(formData.spo2) < 90) {
      warnings.push("SpO2 is low. Clinical review advised.");
    }
    if (formData.rpe && parseInt(formData.rpe) >= 9) {
      warnings.push("Very high perceived exertion recorded.");
    }
    if (formData.symptoms.includes("chest_discomfort")) {
      warnings.push("Chest discomfort reported. Clinical review advised.");
    }
    if (formData.symptoms.includes("dizziness")) {
      warnings.push("Dizziness reported. Clinical review advised.");
    }
    return warnings;
  }, [formData]);

  const handleInputChange = (key, value) => {
    setFormData({ ...formData, [key]: value });
  };

  const handleSymptomToggle = (symptom) => {
    const updated = formData.symptoms.includes(symptom)
      ? formData.symptoms.filter(s => s !== symptom)
      : [...formData.symptoms, symptom];
    handleInputChange("symptoms", updated);
  };

  const handleSave = () => {
    if (!formData.calculation_method || !formData.weight_kg || !formData.duration_min) {
      toast.error("Please fill in required fields");
      return;
    }

    const { mets, intensity_band, kcal_per_min, total_kcal, method_label, vo2_ml_kg_min } = calculations;

    if (!mets) {
      toast.error("Please complete all required fields for the selected method");
      return;
    }

    const soapText = `MET Calculation completed using ${method_label}. Activity: ${formData.activity_name}. Duration: ${formData.duration_min} min. Estimated VO2: ${vo2_ml_kg_min} mL/kg/min. METs: ${mets}. Intensity: ${intensity_band}. Estimated kcal/min: ${kcal_per_min}. Total kcal: ${total_kcal}.${formData.rpe ? ` RPE: ${formData.rpe}.` : ""}${formData.hr_bpm ? ` HR: ${formData.hr_bpm} bpm.` : ""}${formData.spo2 ? ` SpO2: ${formData.spo2}%.` : ""}${formData.symptoms.length > 0 ? ` Symptoms: ${formData.symptoms.join(", ")}.` : ""}${formData.clinical_notes ? ` Notes: ${formData.clinical_notes}` : ""}`;

    onSave({
      result_value: parseFloat(mets),
      additional_data: {
        soap_text: soapText,
        method: formData.calculation_method,
        mets: parseFloat(mets),
        vo2: parseFloat(vo2_ml_kg_min),
        intensity: intensity_band,
        kcal_per_min: parseFloat(kcal_per_min),
        total_kcal: parseInt(total_kcal),
        quality: calculations.met_quality_flag
      },
      notes: formData.clinical_notes,
      assessment_date: new Date().toISOString().split("T")[0]
    });
  };

  const showManualMET = formData.calculation_method === "manual_met";
  const showActivityBased = formData.calculation_method === "activity_based";
  const showTreadmill = ["treadmill_walking", "treadmill_running"].includes(formData.calculation_method);
  const showCycle = formData.calculation_method === "cycle_ergometer";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Metabolic Equivalent (MET) Calculation</h2>
              <p className="text-slate-600 text-sm mt-1">Estimate exercise intensity and energy expenditure</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Instructions */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Clinician Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800">
                Estimate METs from known activity MET, treadmill workload, cycle workload, or valid external source. Interpret with symptoms, vitals, RPE, diagnosis, and clinical presentation.
              </CardContent>
            </Card>

            {/* Method Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Method Selection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Calculation Method *</Label>
                  <select
                    value={formData.calculation_method}
                    onChange={(e) => handleInputChange("calculation_method", e.target.value)}
                    className="w-full mt-2 p-2 border rounded-md"
                  >
                    <option value="">Select method...</option>
                    <option value="manual_met">Manual MET Entry</option>
                    <option value="activity_based">Activity-Based Estimate</option>
                    <option value="treadmill_walking">Treadmill Walking Equation (ACSM)</option>
                    <option value="treadmill_running">Treadmill Running Equation (ACSM)</option>
                    <option value="cycle_ergometer">Cycle Ergometer Estimate</option>
                  </select>
                </div>
                <div>
                  <Label>Activity Name</Label>
                  <Input
                    value={formData.activity_name}
                    onChange={(e) => handleInputChange("activity_name", e.target.value)}
                    placeholder="e.g., Walking, treadmill walking"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Core Session Data */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Core Session Data</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Body Weight (kg) *</Label>
                  <Input
                    type="number"
                    value={formData.weight_kg}
                    onChange={(e) => handleInputChange("weight_kg", e.target.value)}
                    min="20"
                    max="300"
                    step="0.1"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Duration (minutes) *</Label>
                  <Input
                    type="number"
                    value={formData.duration_min}
                    onChange={(e) => handleInputChange("duration_min", e.target.value)}
                    min="1"
                    max="600"
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Method-Specific Inputs */}
            {showManualMET && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Manual MET Entry</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>MET Value *</Label>
                    <Input
                      type="number"
                      value={formData.manual_met_value}
                      onChange={(e) => handleInputChange("manual_met_value", e.target.value)}
                      min="0.5"
                      max="25"
                      step="0.1"
                      placeholder="e.g., 3.5"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Source of MET Value *</Label>
                    <select
                      value={formData.manual_met_source}
                      onChange={(e) => handleInputChange("manual_met_source", e.target.value)}
                      className="w-full mt-2 p-2 border rounded-md"
                    >
                      <option value="">Select source...</option>
                      <option value="compendium">Compendium of Physical Activities</option>
                      <option value="published_protocol">Published Protocol / Guideline</option>
                      <option value="measured">Laboratory / CPET / Measured Value</option>
                      <option value="clinician_estimate">Clinician Estimate</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            )}

            {showActivityBased && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Activity-Based Estimate</CardTitle>
                </CardHeader>
                <CardContent>
                  <Label>Activity Reference MET *</Label>
                  <select
                    value={formData.activity_met_reference}
                    onChange={(e) => handleInputChange("activity_met_reference", e.target.value)}
                    className="w-full mt-2 p-2 border rounded-md"
                  >
                    <option value="">Select activity...</option>
                    <option value="2.5">Slow walking / light ambulation (2.0-2.9 METs)</option>
                    <option value="3.8">Brisk walking (3.0-4.5 METs)</option>
                    <option value="5.5">Very brisk walking / uphill (4.6-6.0 METs)</option>
                    <option value="4.0">Light cycling (3.0-5.0 METs)</option>
                    <option value="6.0">Moderate cycling (5.1-7.0 METs)</option>
                    <option value="7.5">Jogging (6.0-8.9 METs)</option>
                    <option value="10.0">Running / vigorous sport (9.0+ METs)</option>
                  </select>
                </CardContent>
              </Card>
            )}

            {showTreadmill && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Treadmill Parameters</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Speed (km/h) *</Label>
                    <Input
                      type="number"
                      value={formData.treadmill_speed_kmh}
                      onChange={(e) => handleInputChange("treadmill_speed_kmh", e.target.value)}
                      min="0.5"
                      max="20"
                      step="0.1"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Grade (%) *</Label>
                    <Input
                      type="number"
                      value={formData.treadmill_grade_percent}
                      onChange={(e) => handleInputChange("treadmill_grade_percent", e.target.value)}
                      min="0"
                      max="30"
                      step="0.5"
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {showCycle && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cycle Ergometer Parameters</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Workload (watts) *</Label>
                    <Input
                      type="number"
                      value={formData.cycle_workload_watts}
                      onChange={(e) => handleInputChange("cycle_workload_watts", e.target.value)}
                      min="0"
                      max="500"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Cadence (rpm)</Label>
                    <Input
                      type="number"
                      value={formData.cycle_cadence_rpm}
                      onChange={(e) => handleInputChange("cycle_cadence_rpm", e.target.value)}
                      min="20"
                      max="150"
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Clinical Response */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Response</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>RPE (0-10)</Label>
                    <Input
                      type="number"
                      value={formData.rpe}
                      onChange={(e) => handleInputChange("rpe", e.target.value)}
                      min="0"
                      max="10"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Heart Rate (bpm)</Label>
                    <Input
                      type="number"
                      value={formData.hr_bpm}
                      onChange={(e) => handleInputChange("hr_bpm", e.target.value)}
                      min="30"
                      max="250"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>SpO2 (%)</Label>
                    <Input
                      type="number"
                      value={formData.spo2}
                      onChange={(e) => handleInputChange("spo2", e.target.value)}
                      min="50"
                      max="100"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label className="block mb-3">Symptoms During Activity</Label>
                  <div className="space-y-2">
                    {[
                      { label: "None", value: "none" },
                      { label: "Breathlessness", value: "breathlessness" },
                      { label: "Chest discomfort", value: "chest_discomfort" },
                      { label: "Dizziness", value: "dizziness" },
                      { label: "Leg fatigue", value: "leg_fatigue" },
                      { label: "Pain", value: "pain" }
                    ].map((symptom) => (
                      <label key={symptom.value} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.symptoms.includes(symptom.value)}
                          onChange={() => handleSymptomToggle(symptom.value)}
                          className="rounded"
                        />
                        <span className="text-sm">{symptom.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Clinical Notes</Label>
                  <Textarea
                    value={formData.clinical_notes}
                    onChange={(e) => handleInputChange("clinical_notes", e.target.value)}
                    placeholder="Workload context, symptoms, assistive device use, environmental factors..."
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Results Preview */}
            {calculations.mets && (
              <>
                <Card className="bg-green-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Calculated Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-green-700 font-semibold">METs</p>
                        <p className="text-2xl font-bold text-green-600">{calculations.mets}</p>
                      </div>
                      <div>
                        <p className="text-sm text-green-700 font-semibold">VO2 (mL/kg/min)</p>
                        <p className="text-2xl font-bold text-green-600">{calculations.vo2_ml_kg_min}</p>
                      </div>
                      <div>
                        <p className="text-sm text-green-700 font-semibold">Intensity</p>
                        <p className="text-lg font-bold text-green-600">{calculations.intensity_band}</p>
                      </div>
                      <div>
                        <p className="text-sm text-green-700 font-semibold">Total kcal</p>
                        <p className="text-2xl font-bold text-green-600">{calculations.total_kcal}</p>
                      </div>
                    </div>
                    <p className="text-sm text-green-700 mt-4 italic">{calculations.clinical_interpretation}</p>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Quality Warnings */}
            {qualityWarnings.length > 0 && (
              <Card className="bg-yellow-50 border-yellow-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    Clinical Flags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {qualityWarnings.map((warning, idx) => (
                      <li key={idx} className="text-sm text-yellow-800 flex gap-2">
                        <span className="text-yellow-600">â€¢</span>
                        {warning}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!calculations.mets} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}