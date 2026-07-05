import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Info, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

function classify(mmol) {
  if (mmol < 3.9) return { label: "Hypoglycaemia", color: "bg-purple-100 text-purple-800 border-purple-300", alert: true };
  if (mmol <= 5.5) return { label: "Normal", color: "bg-green-100 text-green-800 border-green-300", alert: false };
  if (mmol <= 6.9) return { label: "Impaired Fasting Glucose (Pre-diabetes)", color: "bg-yellow-100 text-yellow-800 border-yellow-300", alert: false };
  if (mmol <= 11.0) return { label: "Diabetes Mellitus — Elevated", color: "bg-red-100 text-red-800 border-red-300", alert: true };
  return { label: "Severely Elevated — Urgent Review", color: "bg-red-200 text-red-900 border-red-400", alert: true };
}

export default function FastingBloodGlucoseRunner({ client, onSave, onClose }) {
  const [glucose, setGlucose] = useState("");
  const [fastingHours, setFastingHours] = useState("8");
  const [method, setMethod] = useState("fingerprick");
  const [currentMedications, setCurrentMedications] = useState("");
  const [notes, setNotes] = useState("");
  const [expandedSection, setExpandedSection] = useState(null);

  const value = parseFloat(glucose);
  const result = !isNaN(value) && value > 0 ? classify(value) : null;

  const handleSave = () => {
    if (!glucose || isNaN(value)) { toast.error("Enter a valid glucose value"); return; }
    const soap = `• Fasting Blood Glucose\n  Result: ${value} mmol/L — ${result?.label}\n  Fasting Duration: ${fastingHours} hours\n  Method: ${method === "fingerprick" ? "Finger-prick glucometer" : method === "venous" ? "Venous blood sample" : "Other"}${currentMedications ? `\n  Current Medications: ${currentMedications}` : ""}${notes ? `\n  Notes: ${notes}` : ""}\n  Reference Ranges: <3.9 = hypo | 3.9–5.5 = normal | 5.6–6.9 = IFG | ≥7.0 = diabetes\n  Diagnosis requires 2 separate readings. Single value is screening only.\n  Reference: Diabetes Australia / WHO criteria.`;
    onSave({ status: "completed", result_value: value, notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "fasting_blood_glucose", glucose_mmol: value, fasting_hours: parseInt(fastingHours), method, classification: result?.label } });
    toast.success("Fasting blood glucose saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b bg-gradient-to-r from-red-50 to-pink-50 flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Fasting Blood Glucose</h2><p className="text-slate-500 text-sm mt-0.5">Plasma glucose assessment</p></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
           {/* Clinical Context Section */}
           <Card className="bg-indigo-50 border-indigo-200">
             <CardHeader className="pb-2">
               <button
                 onClick={() => setExpandedSection(expandedSection === "context" ? null : "context")}
                 className="w-full flex items-center justify-between font-semibold text-indigo-900 hover:text-indigo-700"
               >
                 <span className="flex items-center gap-2">
                   <Info className="w-5 h-5" />
                   Clinical Context &amp; Scope
                 </span>
                 {expandedSection === "context" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
               </button>
             </CardHeader>
             {expandedSection === "context" && (
               <CardContent className="text-sm text-indigo-900 space-y-3">
                 <div>
                   <p className="font-semibold text-indigo-800 mb-1">Why This Test Is Measured</p>
                   <p>Fasting blood glucose is a key screening and diagnostic tool for diabetes and metabolic disorders. It measures how well the body regulates blood sugar at rest and is used to:</p>
                   <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                     <li>Screen for type 2 diabetes and pre-diabetes (impaired fasting glucose)</li>
                     <li>Monitor glycaemic control in known diabetic clients</li>
                     <li>Assess cardiovascular and metabolic risk</li>
                     <li>Detect hypoglycaemic episodes in clients on diabetes medication</li>
                   </ul>
                 </div>
                 <div>
                   <p className="font-semibold text-indigo-800 mb-1">Scope of Practice &amp; Who Can Perform This Assessment</p>
                   <p className="text-xs"><strong>EPs &amp; Allied Health Professionals:</strong> Can perform point-of-care capillary (finger-prick) testing using a glucometer in clinical settings. This is a screening tool.</p>
                   <p className="text-xs"><strong>GPs &amp; Pathology Services:</strong> Can order laboratory venous blood tests (more accurate, diagnostic). These results are formal diagnostic criteria.</p>
                   <p className="text-xs"><strong>Important:</strong> Finger-prick glucometer results are useful for screening and monitoring but should be confirmed with venous plasma glucose for formal diagnosis.</p>
                 </div>
                 <div>
                   <p className="font-semibold text-indigo-800 mb-1">Result Interpretation &amp; Clinical Action</p>
                   <div className="bg-white/60 rounded border border-indigo-200 p-2 text-xs space-y-1">
                     <p><strong className="text-green-700">&lt;3.9 mmol/L (Hypoglycaemia):</strong> Low blood sugar. Immediate action: give fast-acting carbs. Refer to GP/endocrinologist.</p>
                     <p><strong className="text-green-700">3.9–5.5 mmol/L (Normal):</strong> Optimal fasting glucose. No intervention needed unless symptoms present.</p>
                     <p><strong className="text-yellow-700">5.6–6.9 mmol/L (Pre-diabetes/IFG):</strong> Impaired fasting glucose. Lifestyle intervention: diet, exercise, weight management. Retest in 6–12 months.</p>
                     <p><strong className="text-red-700">7.0–11.0 mmol/L (Diabetes):</strong> Elevated. Refer to GP for formal testing &amp; diabetes management plan. Lifestyle + pharmacological intervention.</p>
                     <p><strong className="text-red-900">&gt;11.0 mmol/L (Severely Elevated):</strong> Urgent GP review. Risk of diabetic complications. May require immediate medication review.</p>
                   </div>
                 </div>
               </CardContent>
             )}
           </Card>

           {/* Pre-test Requirements */}
           <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
             <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Pre-test Requirements</p>
             <p><strong>Fasting:</strong> No caloric intake for at least 8–12 hours. Water allowed.</p>
             <p><strong>Medication:</strong> Note any diabetes medications — these will affect results.</p>
             <p><strong>Timing:</strong> Test first thing in the morning is ideal.</p>
           </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Test Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fasting Duration (hours) <span className="text-red-500">*</span></Label>
                  <Input type="number" min="4" max="24" value={fastingHours} onChange={e => setFastingHours(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Collection Method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fingerprick">Finger-prick glucometer</SelectItem>
                      <SelectItem value="venous">Venous blood sample</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Blood Glucose Result (mmol/L) <span className="text-red-500">*</span></Label>
                <Input type="number" step="0.1" value={glucose} onChange={e => setGlucose(e.target.value)} placeholder="e.g. 5.4" className="mt-1 text-lg" />
              </div>
              <div>
                <Label>Current Diabetes/Glucose Medications</Label>
                <Input type="text" value={currentMedications} onChange={e => setCurrentMedications(e.target.value)} placeholder="e.g. Metformin 500mg BD" className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {result && (
            <div className={`border-2 rounded-xl p-5 text-center ${result.color}`}>
              <p className="text-5xl font-bold">{value}</p>
              <p className="text-sm font-medium mt-1">mmol/L</p>
              <p className="font-semibold text-lg mt-2">{result.label}</p>
              {result.alert && (
                <div className="flex items-center justify-center gap-2 mt-2 text-sm font-semibold"><AlertTriangle className="w-4 h-4" />Clinical action may be required</div>
              )}
            </div>
          )}

          <div className="bg-slate-50 border rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">Reference Ranges (Fasting):</p>
            <p>Normal: 3.9–5.5 mmol/L | Pre-diabetes (IFG): 5.6–6.9 mmol/L | Diabetes: ≥7.0 mmol/L | Hypo: &lt;3.9 mmol/L</p>
            <p className="text-slate-400">Note: Diagnosis requires 2 separate elevated readings.</p>
          </div>

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Symptoms, medications, recent illness, diabetes management plan..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700"><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
      </div>
    </div>
  );
}