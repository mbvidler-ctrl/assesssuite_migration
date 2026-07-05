import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, HelpCircle } from "lucide-react";
import { toast } from "sonner";

export default function LipidProfileRunner({ client, onSave, onClose }) {
  const [totalCholesterol, setTotalCholesterol] = useState("");
  const [ldl, setLdl] = useState("");
  const [hdl, setHdl] = useState("");
  const [triglycerides, setTriglycerides] = useState("");
  const [notes, setNotes] = useState("");
  const [unit, setUnit] = useState("mgdl"); // "mgdl" or "mmol"

  // Conversion factors
  const mgdlToMmol = 0.02586;
  const mmolToMgdl = 38.67;

  const convertValue = (value, fromUnit, toUnit) => {
    if (!value || isNaN(value)) return "";
    if (fromUnit === toUnit) return value;
    if (fromUnit === "mgdl" && toUnit === "mmol") return (value * mgdlToMmol).toFixed(2);
    if (fromUnit === "mmol" && toUnit === "mgdl") return (value * mmolToMgdl).toFixed(0);
    return value;
  };

  const getCholesterolCategory = (value, unit) => {
    const inMgdl = unit === "mgdl" ? value : value * mmolToMgdl;
    if (inMgdl < 200) return { label: "Normal", color: "bg-green-100 text-green-800" };
    if (inMgdl < 240) return { label: "Borderline High", color: "bg-yellow-100 text-yellow-800" };
    return { label: "High", color: "bg-red-100 text-red-800" };
  };

  const getLDLCategory = (value, unit) => {
    const inMgdl = unit === "mgdl" ? value : value * mmolToMgdl;
    if (inMgdl < 100) return { label: "Optimal", color: "bg-green-100 text-green-800" };
    if (inMgdl < 130) return { label: "Near Optimal", color: "bg-blue-100 text-blue-800" };
    if (inMgdl < 160) return { label: "Borderline High", color: "bg-yellow-100 text-yellow-800" };
    if (inMgdl < 190) return { label: "High", color: "bg-orange-100 text-orange-800" };
    return { label: "Very High", color: "bg-red-100 text-red-800" };
  };

  const getHDLCategory = (value, unit) => {
    const inMgdl = unit === "mgdl" ? value : value * mmolToMgdl;
    if (inMgdl < 40) return { label: "Low", color: "bg-red-100 text-red-800" };
    if (inMgdl >= 60) return { label: "Protective", color: "bg-green-100 text-green-800" };
    return { label: "Normal", color: "bg-blue-100 text-blue-800" };
  };

  const getTriglyceridesCategory = (value, unit) => {
    const inMgdl = unit === "mgdl" ? value : value * mmolToMgdl;
    if (inMgdl < 150) return { label: "Normal", color: "bg-green-100 text-green-800" };
    if (inMgdl < 200) return { label: "Borderline High", color: "bg-yellow-100 text-yellow-800" };
    if (inMgdl < 500) return { label: "High", color: "bg-orange-100 text-orange-800" };
    return { label: "Very High", color: "bg-red-100 text-red-800" };
  };

  const handleSave = () => {
    const tcValue = parseFloat(totalCholesterol);
    const ldlValue = parseFloat(ldl);
    const hdlValue = parseFloat(hdl);
    const trigValue = parseFloat(triglycerides);

    if (!totalCholesterol || isNaN(tcValue)) {
      toast.error("Please enter total cholesterol value");
      return;
    }

    // Build SOAP text
    let soapText = `• Lipid Profile (${unit === "mgdl" ? "USA/mg/dL" : "Australian/mmol/L"}):\n`;
    soapText += `  Total Cholesterol: ${tcValue} ${unit === "mgdl" ? "mg/dL" : "mmol/L"} (${convertValue(tcValue, unit, unit === "mgdl" ? "mmol" : "mgdl")} ${unit === "mgdl" ? "mmol/L" : "mg/dL"}) - ${getCholesterolCategory(tcValue, unit).label}\n`;
    if (ldlValue) soapText += `  LDL Cholesterol: ${ldlValue} ${unit === "mgdl" ? "mg/dL" : "mmol/L"} (${convertValue(ldlValue, unit, unit === "mgdl" ? "mmol" : "mgdl")} ${unit === "mgdl" ? "mmol/L" : "mg/dL"}) - ${getLDLCategory(ldlValue, unit).label}\n`;
    if (hdlValue) soapText += `  HDL Cholesterol: ${hdlValue} ${unit === "mgdl" ? "mg/dL" : "mmol/L"} (${convertValue(hdlValue, unit, unit === "mgdl" ? "mmol" : "mgdl")} ${unit === "mgdl" ? "mmol/L" : "mg/dL"}) - ${getHDLCategory(hdlValue, unit).label}\n`;
    if (trigValue) soapText += `  Triglycerides: ${trigValue} ${unit === "mgdl" ? "mg/dL" : "mmol/L"} (${convertValue(trigValue, unit, unit === "mgdl" ? "mmol" : "mgdl")} ${unit === "mgdl" ? "mmol/L" : "mg/dL"}) - ${getTriglyceridesCategory(trigValue, unit).label}\n`;
    if (notes.trim()) soapText += `  Clinical Notes: ${notes}`;

    onSave({
      status: "completed",
      result_value: tcValue,
      additional_data: {
        measurement_type: "lipid_profile",
        total_cholesterol: tcValue,
        ldl: ldlValue || null,
        hdl: hdlValue || null,
        triglycerides: trigValue || null,
        unit: unit,
        total_cholesterol_category: getCholesterolCategory(tcValue, unit).label,
        ldl_category: ldlValue ? getLDLCategory(ldlValue, unit).label : null,
        hdl_category: hdlValue ? getHDLCategory(hdlValue, unit).label : null,
        triglycerides_category: trigValue ? getTriglyceridesCategory(trigValue, unit).label : null,
        soap_text: soapText
      },
      notes: soapText,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Assessment saved successfully.");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Lipid Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Unit Toggle */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <Label className="font-semibold text-slate-900">Unit Standard:</Label>
                  <div className="flex gap-2">
                    <Button 
                      variant={unit === "mgdl" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUnit("mgdl")}
                      className="text-xs"
                    >
                      USA (mg/dL)
                    </Button>
                    <Button 
                      variant={unit === "mmol" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUnit("mmol")}
                      className="text-xs"
                    >
                      Australia (mmol/L)
                    </Button>
                  </div>
                </div>
                <a 
                  href="https://www.heart.org/en/health-topics/consumer-top-10s-and-faq/answers-by-heart-fact-for-kids/answers-by-heart-fact-for-kids-about-cholesterol" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                  title="Learn more about cholesterol standards"
                >
                  <HelpCircle className="w-5 h-5" />
                </a>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="totalCholesterol">Total Cholesterol ({unit === "mgdl" ? "mg/dL" : "mmol/L"}) *</Label>
                  <Input
                    id="totalCholesterol"
                    type="number"
                    value={totalCholesterol}
                    onChange={(e) => setTotalCholesterol(e.target.value)}
                    placeholder="e.g., 200"
                  />
                  {totalCholesterol && !isNaN(parseFloat(totalCholesterol)) && (
                    <>
                      <Badge className={`mt-1 ${getCholesterolCategory(parseFloat(totalCholesterol), unit).color}`}>
                        {getCholesterolCategory(parseFloat(totalCholesterol), unit).label}
                      </Badge>
                      <p className="text-xs text-slate-500 mt-1">
                        {unit === "mgdl" ? "Converted: " : ""}{convertValue(parseFloat(totalCholesterol), unit, unit === "mgdl" ? "mmol" : "mgdl")} {unit === "mgdl" ? "mmol/L" : "mg/dL"}
                      </p>
                    </>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {unit === "mgdl" 
                      ? "<200 normal, 200-239 borderline, ≥240 high" 
                      : "<5.2 normal, 5.2-6.2 borderline, ≥6.2 high"}
                  </p>
                  </div>

                  <div>
                  <Label htmlFor="ldl">LDL Cholesterol ({unit === "mgdl" ? "mg/dL" : "mmol/L"})</Label>
                  <Input
                    id="ldl"
                    type="number"
                    value={ldl}
                    onChange={(e) => setLdl(e.target.value)}
                    placeholder={unit === "mgdl" ? "e.g., 130" : "e.g., 3.4"}
                  />
                  {ldl && !isNaN(parseFloat(ldl)) && (
                    <>
                      <Badge className={`mt-1 ${getLDLCategory(parseFloat(ldl), unit).color}`}>
                        {getLDLCategory(parseFloat(ldl), unit).label}
                      </Badge>
                      <p className="text-xs text-slate-500 mt-1">
                        {unit === "mgdl" ? "Converted: " : ""}{convertValue(parseFloat(ldl), unit, unit === "mgdl" ? "mmol" : "mgdl")} {unit === "mgdl" ? "mmol/L" : "mg/dL"}
                      </p>
                    </>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {unit === "mgdl" 
                      ? "<100 optimal, 100-129 near optimal" 
                      : "<2.6 optimal, 2.6-3.3 near optimal"}
                  </p>
                  </div>

                  <div>
                  <Label htmlFor="hdl">HDL Cholesterol ({unit === "mgdl" ? "mg/dL" : "mmol/L"})</Label>
                  <Input
                    id="hdl"
                    type="number"
                    value={hdl}
                    onChange={(e) => setHdl(e.target.value)}
                    placeholder={unit === "mgdl" ? "e.g., 50" : "e.g., 1.3"}
                  />
                  {hdl && !isNaN(parseFloat(hdl)) && (
                    <>
                      <Badge className={`mt-1 ${getHDLCategory(parseFloat(hdl), unit).color}`}>
                        {getHDLCategory(parseFloat(hdl), unit).label}
                      </Badge>
                      <p className="text-xs text-slate-500 mt-1">
                        {unit === "mgdl" ? "Converted: " : ""}{convertValue(parseFloat(hdl), unit, unit === "mgdl" ? "mmol" : "mgdl")} {unit === "mgdl" ? "mmol/L" : "mg/dL"}
                      </p>
                    </>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {unit === "mgdl" 
                      ? "<40 low, ≥60 protective" 
                      : "<1.0 low, ≥1.5 protective"}
                  </p>
                  </div>

                  <div>
                  <Label htmlFor="triglycerides">Triglycerides ({unit === "mgdl" ? "mg/dL" : "mmol/L"})</Label>
                  <Input
                    id="triglycerides"
                    type="number"
                    value={triglycerides}
                    onChange={(e) => setTriglycerides(e.target.value)}
                    placeholder={unit === "mgdl" ? "e.g., 150" : "e.g., 1.7"}
                  />
                  {triglycerides && !isNaN(parseFloat(triglycerides)) && (
                    <>
                      <Badge className={`mt-1 ${getTriglyceridesCategory(parseFloat(triglycerides), unit).color}`}>
                        {getTriglyceridesCategory(parseFloat(triglycerides), unit).label}
                      </Badge>
                      <p className="text-xs text-slate-500 mt-1">
                        {unit === "mgdl" ? "Converted: " : ""}{convertValue(parseFloat(triglycerides), unit, unit === "mgdl" ? "mmol" : "mgdl")} {unit === "mgdl" ? "mmol/L" : "mg/dL"}
                      </p>
                    </>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {unit === "mgdl" 
                      ? "<150 normal, 150-199 borderline" 
                      : "<1.7 normal, 1.7-2.3 borderline"}
                  </p>
                  </div>
                  </div>

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