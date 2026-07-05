import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Info, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const CONLEY_SECTIONS = [
  {
    section: "History",
    items: [
      { id: "recent_fall", label: "Fall within last 3 months", description: "Has the patient had a fall in the past 3 months?" },
      { id: "history_falls", label: "History of falling", description: "Does the patient have a history of falls?" },
      { id: "impaired_mobility", label: "Impaired mobility", description: "Does the patient have impaired mobility?" },
      { id: "altered_elimination", label: "Altered elimination (urgency/frequency/incontinence)", description: "Does the patient experience altered elimination patterns?" },
    ]
  },
  {
    section: "Observation",
    items: [
      { id: "confusion", label: "Confusion / disorientation / impulsivity", description: "Does the patient show signs of confusion, disorientation, or impulsivity?" },
      { id: "dizziness", label: "Dizziness or vertigo", description: "Does the patient report dizziness or vertigo?" },
      { id: "poor_judgment", label: "Poor judgment / lack of awareness of limitations", description: "Does the patient demonstrate poor judgment or lack awareness of limitations?" },
    ]
  }
];

export default function ConleyScaleRunner({ client, onSave, onClose }) {
  const [scores, setScores] = useState({
    recent_fall: false,
    history_falls: false,
    impaired_mobility: false,
    altered_elimination: false,
    confusion: false,
    dizziness: false,
    poor_judgment: false,
  });
  const [notes, setNotes] = useState("");
  const [showInfo, setShowInfo] = useState(false);

  const handleScoreChange = (field, value) => {
    setScores((prevScores) => ({
      ...prevScores,
      [field]: value,
    }));
  };

  const getTotalScore = () => Object.values(scores).filter(Boolean).length;

  const getClassification = () => {
    const total = getTotalScore();
    if (total === 0 || total === 1) return "Low Falls Risk";
    return "High Falls Risk";
  };

  const getPositiveFindings = () => {
    const fieldMap = {
      recent_fall: "Recent fall (last 3 months)",
      history_falls: "History of falls",
      impaired_mobility: "Impaired mobility",
      altered_elimination: "Altered elimination",
      confusion: "Confusion / impulsivity",
      dizziness: "Dizziness / vertigo",
      poor_judgment: "Poor judgment / reduced insight"
    };
    return Object.entries(scores)
      .filter(([_, value]) => value === true)
      .map(([key, _]) => fieldMap[key])
      .join(", ");
  };

  const handleSave = () => {
    const totalScore = getTotalScore();
    const classification = getClassification();
    const positiveFindings = getPositiveFindings();

    let soapText = `Conley Scale Assessment:\n`;
    soapText += `• Total Score: ${totalScore}/7\n`;
    soapText += `• Falls Risk Classification: ${classification}\n`;
    
    if (positiveFindings) {
      soapText += `• Positive Findings: ${positiveFindings}\n`;
    }
    
    soapText += `\nIndividual Items:\n`;
    CONLEY_SECTIONS.forEach(section => {
      soapText += `\n${section.section}:\n`;
      section.items.forEach(item => {
        soapText += `  - ${item.label}: ${scores[item.id] ? 'Yes' : 'No'}\n`;
      });
    });

    let planText = "";
    if (scores.impaired_mobility) {
      planText += "• Initiate lower limb strengthening, balance, and gait stability program\n";
    }
    if (scores.confusion || scores.poor_judgment) {
      planText += "• Implement supervision strategies and simplified instructions during exercise\n";
    }
    if (scores.dizziness) {
      planText += "• Screen for vestibular dysfunction and monitor orthostatic tolerance\n";
    }
    if (scores.altered_elimination) {
      planText += "• Incorporate toileting schedule and environmental safety modifications\n";
    }

    const assessmentText = `${soapText}\n${planText}`;

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        measurement_type: "conley_scale",
        soap_text: assessmentText,
        conley_data: {
          total_score: totalScore,
          classification: classification,
          positive_findings: positiveFindings,
          ...scores,
        }
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Conley Scale assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-slate-50 border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Conley Scale (Falls Risk)</h2>
            <p className="text-sm text-slate-600 mt-1">7-Item Falls Risk Screening Tool</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Score Summary */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <p className="text-lg text-blue-900">
                <strong>Current Score: {getTotalScore()}/7</strong>
              </p>
              <p className="text-sm text-blue-800 mt-1">
                Classification: <strong>{getClassification()}</strong>
              </p>
            </CardContent>
          </Card>

          {/* Clinical Reference */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between bg-slate-50 px-4 py-3 text-left hover:bg-slate-100 transition-colors"
              onClick={() => setShowInfo(!showInfo)}
            >
              <span className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <Info className="w-4 h-4" />
                Clinician Reference & Scoring Guidelines
              </span>
              {showInfo ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
            </button>
            {showInfo && (
              <div className="px-4 py-4 space-y-4 text-sm bg-white border-t">
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Purpose</h4>
                  <p className="text-slate-700">Rapid, 7-item screening tool for identifying patients at risk of falls. Includes history of falls, mobility status, cognition, and balance-related symptoms.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Administration</h4>
                  <ul className="list-disc list-inside text-slate-700 space-y-1 text-xs">
                    <li>Completed through chart review and/or patient interview/observation</li>
                    <li>Takes approximately 2 minutes</li>
                    <li>Each item is a binary yes/no response (1 point per yes)</li>
                    <li>Total score ranges 0–7</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 mb-2">Interpretation</h4>
                  <div className="bg-slate-50 p-3 rounded space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-green-500 mt-0.5 flex-shrink-0"></span>
                      <div>
                        <strong className="text-green-900">0–1: Low Falls Risk</strong>
                        <p className="text-slate-700">Routine fall prevention precautions</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-red-500 mt-0.5 flex-shrink-0"></span>
                      <div>
                        <strong className="text-red-900">2–7: High Falls Risk</strong>
                        <p className="text-slate-700">Enhanced fall prevention strategies recommended</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Reference</h4>
                  <p className="text-xs text-slate-700">Conley D, Schultz AA, Selvin R. (1999). The challenge of predicting patients at risk for falling: Development of the Conley Scale. <em>Medsurg Nursing, 8</em>(6), 348–354.</p>
                </div>
              </div>
            )}
          </div>

          {/* Assessment Items by Section */}
          {CONLEY_SECTIONS.map((section) => (
            <div key={section.section} className="space-y-3">
              <h3 className="font-bold text-slate-900 text-base border-b border-slate-200 pb-2">
                {section.section}
              </h3>
              {section.items.map((item) => (
                <div key={item.id} className="border border-slate-200 p-4 rounded-lg hover:bg-slate-50 transition-colors">
                  <Label className="font-medium text-slate-900">{item.label}</Label>
                  <p className="text-xs text-slate-600 mb-3">{item.description}</p>
                  <div className="flex space-x-2">
                    {[false, true].map((value) => (
                      <Button
                        key={String(value)}
                        variant={scores[item.id] === value ? "default" : "outline"}
                        onClick={() => handleScoreChange(item.id, value)}
                        className="w-20"
                        size="sm"
                      >
                        {value ? 'Yes' : 'No'}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Positive Findings Summary */}
          {getTotalScore() > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-orange-900">
                  <AlertCircle className="w-5 h-5" />
                  Positive Findings
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-orange-900">
                {getPositiveFindings()}
              </CardContent>
            </Card>
          )}

          {/* Clinical Notes */}
          <div>
            <Label htmlFor="notes" className="font-medium">Clinical Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any additional clinical observations or context..."
              rows={4}
              className="mt-2"
            />
          </div>

          <div className="flex justify-end space-x-2 sticky bottom-0 bg-slate-50 border-t px-6 py-4 -mx-6 -mb-6">
            <Button variant="outline" onClick={onClose}>
              <X className="mr-2 w-4 h-4" />
              Close
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              <Save className="mr-2 w-4 h-4" />
              Save Assessment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}