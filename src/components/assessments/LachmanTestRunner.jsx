import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function LachmanTestRunner({ client, onSave, onClose }) {
  const [kneeFlexion, setKneeFlexion] = useState("25");
  const [laxityGrade, setLaxityGrade] = useState("");
  const [endFeel, setEndFeel] = useState("");
  const [notes, setNotes] = useState("");
  const [completedSteps, setCompletedSteps] = useState([]);
  const [expandedSection, setExpandedSection] = useState("procedure");

  const toggleStep = (step) => {
    setCompletedSteps(prev => 
      prev.includes(step) ? prev.filter(s => s !== step) : [...prev, step]
    );
  };

  const isTestComplete = laxityGrade && endFeel;

  const handleSave = () => {
    if (!isTestComplete) {
      toast.error("Please complete the assessment before saving.");
      return;
    }

    const gradeValues = { 1: 0, 2: 5, 3: 10 };
    const resultValue = (gradeValues[parseInt(laxityGrade)] || 0) + (endFeel === "soft" ? 1 : 0);

    const additionalData = {
      soap_text: `â€¢ Lachman Test:\n  Laxity Grade: ${laxityGrade} (${["0-5mm", "5-10mm", ">10mm"][parseInt(laxityGrade)-1]}) | End-Feel: ${endFeel === "firm" ? "Firm (ACL intact)" : "Soft (ACL likely ruptured)"} | Knee Flexion: ${kneeFlexion}Â°${notes ? `\n  Notes: ${notes}` : ""}`,
      measurement_type: "LachmanTest",
      kneeFlexion,
      endFeel,
    };

    onSave({
      status: "completed",
      result_value: resultValue,
      additional_data: additionalData,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });

    toast.success("Lachman Test results saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-cyan-50 z-10 p-5 border-b flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Lachman Test</h2>
            <p className="text-slate-500 text-sm mt-0.5">Anterior Cruciate Ligament (ACL) Integrity Assessment</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Anatomical Diagram */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-slate-800 mb-3">ðŸ” Test Setup & Anatomy</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SVG Diagram */}
              <div className="flex justify-center items-center bg-white rounded border border-slate-200 p-4">
                <svg viewBox="0 0 300 400" className="w-full max-w-sm" xmlns="http://www.w3.org/2000/svg">
                  {/* Femur */}
                  <rect x="110" y="20" width="80" height="140" rx="10" fill="#e8d5c4" stroke="#8b7355" strokeWidth="2"/>
                  <text x="150" y="100" fontSize="12" fontWeight="bold" textAnchor="middle" fill="#333">Femur</text>
                  
                  {/* Knee Joint (gap) */}
                  <line x1="110" y1="160" x2="190" y2="160" stroke="#999" strokeWidth="2" strokeDasharray="4,4"/>
                  
                  {/* Tibia */}
                  <rect x="110" y="170" width="80" height="150" rx="10" fill="#d4a5a5" stroke="#8b5a5a" strokeWidth="2"/>
                  <text x="150" y="260" fontSize="12" fontWeight="bold" textAnchor="middle" fill="#fff">Tibia</text>
                  
                  {/* ACL */}
                  <line x1="145" y1="160" x2="165" y2="200" stroke="#ef4444" strokeWidth="4"/>
                  <text x="155" y="175" fontSize="11" fontWeight="bold" fill="#ef4444" textAnchor="middle">ACL</text>
                  
                  {/* Laxity Arrow */}
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                      <polygon points="0 0, 10 3, 0 6" fill="#2563eb"/>
                    </marker>
                  </defs>
                  <path d="M 210 190 L 250 190" stroke="#2563eb" strokeWidth="3" markerEnd="url(#arrowhead)" fill="none"/>
                  <text x="240" y="185" fontSize="11" fontWeight="bold" fill="#2563eb">Anterior</text>
                  <text x="240" y="200" fontSize="11" fontWeight="bold" fill="#2563eb">Force</text>
                  
                  {/* Stabilizing Hand */}
                  <g>
                    <ellipse cx="80" cy="90" rx="20" ry="30" fill="#f5deb3" stroke="#8b7355" strokeWidth="1.5"/>
                    <text x="80" y="95" fontSize="10" textAnchor="middle" fill="#333">Stabilize</text>
                    <text x="80" y="107" fontSize="10" textAnchor="middle" fill="#333">Femur</text>
                  </g>
                </svg>
              </div>
              
              {/* Key Points */}
              <div className="space-y-2">
                <div className="bg-white p-3 rounded border-l-4 border-blue-500">
                  <p className="text-sm font-semibold text-slate-800">Client Position</p>
                  <p className="text-sm text-slate-600 mt-1">Supine with knee in 20â€“30Â° flexion</p>
                </div>
                <div className="bg-white p-3 rounded border-l-4 border-orange-500">
                  <p className="text-sm font-semibold text-slate-800">Examiner Hands</p>
                  <p className="text-sm text-slate-600 mt-1">One hand stabilizes femur; other hand applies anterior force to proximal tibia</p>
                </div>
                <div className="bg-white p-3 rounded border-l-4 border-red-500">
                  <p className="text-sm font-semibold text-slate-800">What You're Assessing</p>
                  <p className="text-sm text-slate-600 mt-1">Tibial displacement (laxity) and end-feel quality (firm vs. soft/absent)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Step-by-Step Procedure */}
          <button
            className="w-full flex justify-between items-center px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg font-semibold text-blue-900 hover:bg-blue-100 transition-colors"
            onClick={() => setExpandedSection(expandedSection === "procedure" ? null : "procedure")}
          >
            <span>ðŸ“‹ Step-by-Step Procedure</span>
            {expandedSection === "procedure" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expandedSection === "procedure" && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6 space-y-3">
                {[
                  { id: 1, title: "Position Client", desc: "Place client supine on examination table." },
                  { id: 2, title: "Set Knee Angle", desc: "Flex knee to 20â€“30Â° (typically 25Â°). Use goniometer if precise measurement needed." },
                  { id: 3, title: "Stabilize Femur", desc: "Place one hand above the knee to stabilize the femur. Apply gentle counterforce." },
                  { id: 4, title: "Grasp Proximal Tibia", desc: "Place other hand around proximal tibia, just below knee joint." },
                  { id: 5, title: "Apply Force", desc: "Smoothly apply anterior translatory force to tibia. Assess displacement and resistance." },
                  { id: 6, title: "Assess End-Feel", desc: "Note quality: Firm (intact ACL) or Soft/Absent (ACL likely ruptured)." },
                  { id: 7, title: "Grade Laxity", desc: "Grade tibial displacement: 1 (0-5mm), 2 (5-10mm), or 3 (>10mm)." },
                  { id: 8, title: "Record Findings", desc: "Document all observations, pain response, and any asymmetry vs. other leg." },
                ].map(step => (
                  <div 
                    key={step.id}
                    className={`p-3 rounded-lg border-l-4 transition-all cursor-pointer ${
                      completedSteps.includes(step.id)
                        ? "bg-green-100 border-green-500"
                        : "bg-white border-slate-300"
                    }`}
                    onClick={() => toggleStep(step.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        {completedSteps.includes(step.id) ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center text-xs font-bold text-slate-500">{step.id}</div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-slate-800">{step.title}</p>
                        <p className="text-sm text-slate-600 mt-0.5">{step.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Diagnostic Accuracy */}
          <button
            className="w-full flex justify-between items-center px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900 hover:bg-slate-100 transition-colors"
            onClick={() => setExpandedSection(expandedSection === "accuracy" ? null : "accuracy")}
          >
            <span>ðŸ“Š Diagnostic Accuracy & Evidence</span>
            {expandedSection === "accuracy" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expandedSection === "accuracy" && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-slate-300 rounded-lg">
                    <thead className="bg-slate-200"><tr><th className="p-3 text-left">Metric</th><th className="p-3 text-center">Acute ACL Injury</th><th className="p-3 text-center">Chronic ACL Injury</th></tr></thead>
                    <tbody>
                      <tr className="border-t"><td className="p-3">Sensitivity</td><td className="p-3 text-center font-semibold text-green-700">~84%</td><td className="p-3 text-center font-semibold text-green-700">~87%</td></tr>
                      <tr className="border-t bg-slate-50"><td className="p-3">Specificity</td><td className="p-3 text-center font-semibold text-blue-700">~91%</td><td className="p-3 text-center font-semibold text-blue-700">~93%</td></tr>
                      <tr className="border-t"><td className="p-3">Positive Likelihood Ratio</td><td className="p-3 text-center font-semibold">~9.6</td><td className="p-3 text-center font-semibold">~12.4</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-yellow-900 text-sm">Key Insight</p>
                    <p className="text-sm text-yellow-800 mt-1"><strong>Most sensitive clinical test</strong> for ACL injury. Positive LR of 9.6-12.4 is strong evidence of ACL rupture. However, MRI remains the gold standard for confirmation.</p>
                  </div>
                </div>
                <div className="bg-slate-100 p-3 rounded text-xs text-slate-600 space-y-1">
                  <p><strong>Primary Source:</strong> Makhmalbaf H et al. (2013). Accuracy of the Lachman and anterior drawer tests for anterior cruciate ligament injuries. <em>Electronic Physician, 5</em>(2), 627â€“631.</p>
                  <p><strong>Original Technique:</strong> Lachman JH. (1976). Anterior cruciate ligament injuries in skiers. <em>Orthopedic Clinics of North America, 7</em>(1), 245â€“252.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Assessment Input */}
          <Card className="border-2 border-blue-300 bg-blue-50">
            <CardHeader className="bg-blue-100">
              <CardTitle className="text-lg">Assessment Findings</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-semibold text-slate-800">Knee Flexion Angle (Â°)</Label>
                  <Input
                    type="number"
                    value={kneeFlexion}
                    onChange={(e) => setKneeFlexion(e.target.value)}
                    className="mt-1"
                    min="15"
                    max="45"
                  />
                  <p className="text-xs text-slate-500 mt-1">Typical: 20â€“30Â°</p>
                </div>
              </div>

              <div>
                <Label className="font-semibold text-slate-800">Laxity Grade</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[1, 2, 3].map(grade => (
                    <button
                      key={grade}
                      onClick={() => setLaxityGrade(grade.toString())}
                      className={`p-3 rounded-lg border-2 font-semibold transition-all ${
                        laxityGrade === grade.toString()
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-800 border-slate-300 hover:border-blue-300"
                      }`}
                    >
                      <div className="text-lg font-bold">Grade {grade}</div>
                      <div className="text-xs mt-1">
                        {grade === 1 ? "0-5mm" : grade === 2 ? "5-10mm" : ">10mm"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="font-semibold text-slate-800">End-Feel Quality</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {["firm", "soft"].map(feel => (
                    <button
                      key={feel}
                      onClick={() => setEndFeel(feel)}
                      className={`p-3 rounded-lg border-2 font-semibold transition-all ${
                        endFeel === feel
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-800 border-slate-300 hover:border-blue-300"
                      }`}
                    >
                      <div className="capitalize font-bold">{feel}</div>
                      <div className="text-xs mt-1">
                        {feel === "firm" ? "ACL intact âœ“" : "ACL likely ruptured âš "}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="notes" className="font-semibold text-slate-800">Clinical Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Pain response, asymmetry, swelling, guarding..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              {/* Summary */}
              {isTestComplete && (
                <div className="bg-green-50 border border-green-300 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-900">Assessment Complete</span>
                  </div>
                  <p className="text-sm text-green-800">
                    Grade {laxityGrade} laxity with {endFeel === "firm" ? "firm" : "soft/absent"} end-feel
                    {endFeel === "soft" && " â€” indicates possible ACL rupture"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-slate-50 flex justify-between items-center gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            disabled={!isTestComplete}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}