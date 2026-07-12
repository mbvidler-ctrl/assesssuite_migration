import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { X, Save, Info, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const ABC_ACTIVITIES = [
  "Walk around the house",
  "Walk up or down stairs",
  "Bend over and pick up a slipper from the front of a closet floor",
  "Reach for a small can off a shelf at eye level",
  "Stand on your tiptoes and reach for something above your head",
  "Stand on a chair and reach for something",
  "Sweep the floor",
  "Walk outside the house to a car parked in the driveway",
  "Get into or out of a car",
  "Walk across a parking lot to the mall",
  "Walk up or down a ramp",
  "Walk in a crowded mall where people rapidly walk past you",
  "Are bumped into by people as you walk through the mall",
  "Step onto or off an escalator while you are holding onto packages",
  "Step onto or off an escalator while holding onto the handrail",
  "Walk outside on icy sidewalks"
];

export default function ABCScaleRunner({ onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");
  const [expandedSection, setExpandedSection] = useState(null);

  const handleResponseChange = (index, value) => {
    setResponses(prev => ({ ...prev, [index]: value[0] }));
  };

  const calculateTotal = () => {
    const values = Object.values(responses);
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return (sum / 16).toFixed(1);
  };

  const getInterpretation = (avg) => {
    if (avg >= 80) return { text: "High Balance Confidence", color: "text-green-600", bg: "bg-green-50", message: "Fully confident with activities of daily living" };
    if (avg >= 50) return { text: "Moderate Balance Confidence", color: "text-yellow-600", bg: "bg-yellow-50", message: "Some concerns with balance, falls risk may be present" };
    return { text: "Low Balance Confidence", color: "text-red-600", bg: "bg-red-50", message: "Significant fear of falling, high falls risk, recommend intervention" };
  };

  const handleSave = () => {
    if (Object.keys(responses).length < 16) {
      toast.error("Please rate all 16 activities");
      return;
    }

    const avgScore = parseFloat(calculateTotal());
    const interpretation = getInterpretation(avgScore);

    onSave({
      result_value: avgScore,
      additional_data: {
        soap_text: `• Activities-Specific Balance Confidence (ABC) Scale\n  Average Score: ${avgScore}% — ${interpretation.text}`,
        responses,
        average_score: avgScore,
        interpretation: interpretation.text,
      },
      notes: notes,
      assessment_date: todayLocal()
    });
  };

  const avgScore = calculateTotal();
  const interpretation = Object.keys(responses).length === 16 ? getInterpretation(parseFloat(avgScore)) : null;
  const answeredCount = Object.keys(responses).length;

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Activities-Specific Balance Confidence (ABC) Scale</h2>
              <p className="text-slate-600 mt-1">Balance confidence for daily activities</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
           <div className="space-y-6">
             {/* Purpose & Overview */}
             <Card className="border-slate-200 bg-slate-50">
               <button
                 onClick={() => toggleSection("purpose")}
                 className="w-full p-4 flex items-center justify-between hover:bg-slate-100 transition-colors"
               >
                 <CardTitle className="text-lg flex items-center gap-2">
                   <Info className="w-5 h-5 text-slate-600" />
                   Purpose &amp; Clinical Overview
                 </CardTitle>
                 {expandedSection === "purpose" ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
               </button>
               {expandedSection === "purpose" && (
                 <CardContent className="text-sm text-slate-700 space-y-3 border-t">
                   <div>
                     <p className="font-semibold mb-1">Purpose</p>
                     <p>The Activities-Specific Balance Confidence (ABC) Scale measures self-efficacy and fear of falling during specific activities. It is used to assess balance confidence in community-dwelling older adults and identify individuals at high risk of falls.</p>
                   </div>
                   <div>
                     <p className="font-semibold mb-1">Clinical Use</p>
                     <p>The ABC Scale evaluates psychological factors contributing to fall risk and can guide intervention planning. Scores correlate with actual fall risk and functional capacity.</p>
                   </div>
                   <div>
                     <p className="font-semibold mb-1">Score Interpretation</p>
                     <ul className="text-xs space-y-1 list-disc list-inside">
                       <li><strong>≥80%:</strong> High balance confidence — minimal fall risk</li>
                       <li><strong>50–80%:</strong> Moderate balance confidence — some fall risk present</li>
                       <li><strong>&lt;50%:</strong> Low balance confidence — high fall risk, recommend intervention</li>
                     </ul>
                   </div>
                 </CardContent>
               )}
             </Card>

             {/* Instructions */}
             <Card className="bg-blue-50 border-blue-200">
               <CardHeader>
                 <CardTitle className="text-lg flex items-center gap-2">
                   <Info className="w-5 h-5 text-blue-600" />
                   Assessment Instructions
                 </CardTitle>
               </CardHeader>
               <CardContent className="text-sm text-blue-800 space-y-2">
                 <p>For each of the following activities, please indicate your level of confidence in doing the activity without losing your balance or becoming unsteady by choosing a corresponding number from 0% to 100%.</p>
                 <p><strong>0% = No confidence</strong> | <strong>50% = Moderately confident</strong> | <strong>100% = Completely confident</strong></p>
                 <p className="text-xs italic">If you do not currently do the activity, try to imagine how confident you would be if you had to do the activity.</p>
               </CardContent>
             </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Rate Your Confidence (0-100%)</span>
                  <Badge variant="outline">{answeredCount}/16 completed</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {ABC_ACTIVITIES.map((activity, index) => (
                  <div key={index} className="border border-slate-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-slate-900 mb-4">
                      {index + 1}. How confident are you that you will not lose your balance or become unsteady when you <strong>{activity}</strong>?
                    </p>
                    <div className="space-y-2">
                      <Slider
                        value={[responses[index] || 50]}
                        onValueChange={(value) => handleResponseChange(index, value)}
                        max={100}
                        step={5}
                        className="w-full"
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">No confidence (0%)</span>
                        <Badge variant={responses[index] !== undefined ? "default" : "outline"} className="text-lg px-4">
                          {responses[index] !== undefined ? `${responses[index]}%` : "Not rated"}
                        </Badge>
                        <span className="text-xs text-slate-500">Complete confidence (100%)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {interpretation && (
              <Card className={`${interpretation.bg} border-2`}>
                <CardContent className="py-4">
                  <div className="text-center space-y-2">
                    <p className="text-sm text-slate-600">Average Confidence Score</p>
                    <p className="text-5xl font-bold text-slate-900">{avgScore}%</p>
                    <p className={`text-2xl font-bold ${interpretation.color}`}>{interpretation.text}</p>
                    <p className="text-sm text-slate-600 mt-2">{interpretation.message}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Psychometric Properties & References */}
            <Card className="border-slate-200 bg-slate-50">
              <button
                onClick={() => toggleSection("references")}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-100 transition-colors"
              >
                <CardTitle className="text-lg">Psychometric Properties &amp; References</CardTitle>
                {expandedSection === "references" ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              {expandedSection === "references" && (
                <CardContent className="text-sm text-slate-700 space-y-3 border-t">
                  <div>
                    <p className="font-semibold mb-1">Reliability &amp; Validity</p>
                    <ul className="text-xs space-y-1 list-disc list-inside text-slate-600">
                      <li>Test-retest reliability: ICC = 0.92–0.99 (excellent)</li>
                      <li>Internal consistency: Cronbach α = 0.86–0.96 (excellent)</li>
                      <li>Strong correlation with fall history (r = −0.36 to −0.76)</li>
                      <li>Sensitive to change with intervention</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Key References</p>
                    <ul className="text-xs space-y-2 text-slate-600">
                      <li><strong>Powell LE, Myers AM.</strong> (1995). The Activities-Specific Balance Confidence (ABC) Scale. <em>The Journals of Gerontology</em>, 50A(1), M28–M34.</li>
                      <li><strong>Talley KMC, Waltrous P, Grierson LEM.</strong> (2013). Validity and sensitivity of the Activities-Specific Balance Confidence Scale in community-dwelling older adults. <em>Journal of Geriatric Physical Therapy</em>, 36(1), 12–18.</li>
                      <li><strong>Delbaere K, Close JCT, Algra A, et al.</strong> (2010). A multifactorial approach to understanding fall risk in older people. <em>Journal of the American Geriatrics Society</em>, 58(9), 1679–1685.</li>
                    </ul>
                  </div>
                </CardContent>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Activities of particular concern, fall history, intervention recommendations..."
                  rows={3}
                />
              </CardContent>
            </Card>
            </div>
            </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave}
            disabled={Object.keys(responses).length < 16}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save ABC Scale Results
          </Button>
        </div>
      </div>
    </div>
  );
}