import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const FIM_ITEMS = {
  selfCare: [
    "Eating",
    "Grooming",
    "Bathing",
    "Dressing - Upper Body",
    "Dressing - Lower Body",
    "Toileting"
  ],
  sphincterControl: [
    "Bladder Management",
    "Bowel Management"
  ],
  transfers: [
    "Bed/Chair/Wheelchair",
    "Toilet",
    "Tub/Shower"
  ],
  locomotion: [
    "Walk/Wheelchair",
    "Stairs"
  ],
  communication: [
    "Comprehension",
    "Expression"
  ],
  socialCognition: [
    "Social Interaction",
    "Problem Solving",
    "Memory"
  ]
};

const SCORING_LEVELS = [
  { score: 7, label: "Complete Independence" },
  { score: 6, label: "Modified Independence" },
  { score: 5, label: "Supervision/Setup" },
  { score: 4, label: "Minimal Assistance (≥75%)" },
  { score: 3, label: "Moderate Assistance (50-74%)" },
  { score: 2, label: "Maximal Assistance (25-49%)" },
  { score: 1, label: "Total Assistance (<25%)" }
];

export default function FIMRunner({ onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");
  const [expandedSection, setExpandedSection] = useState(null);

  const handleScoreChange = (item, score) => {
    setScores({ ...scores, [item]: score });
  };

  const calculateScores = () => {
    const motor = [...FIM_ITEMS.selfCare, ...FIM_ITEMS.sphincterControl, ...FIM_ITEMS.transfers, ...FIM_ITEMS.locomotion]
      .reduce((sum, item) => sum + (parseInt(scores[item]) || 0), 0);
    const cognitive = [...FIM_ITEMS.communication, ...FIM_ITEMS.socialCognition]
      .reduce((sum, item) => sum + (parseInt(scores[item]) || 0), 0);
    return { motor, cognitive, total: motor + cognitive };
  };

  const { motor, cognitive, total } = calculateScores();

  const getInterpretation = () => {
    if (total >= 108) return { level: 'Complete Independence', color: 'text-green-600', bg: 'bg-green-50' };
    if (total >= 90) return { level: 'Modified Independence', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (total >= 72) return { level: 'Minimal Assistance Required', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (total >= 54) return { level: 'Moderate Assistance Required', color: 'text-orange-600', bg: 'bg-orange-50' };
    return { level: 'Maximal/Total Assistance Required', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const allItemsCount = Object.values(FIM_ITEMS).flat().length;
  const interpretation = Object.keys(scores).length === allItemsCount ? getInterpretation() : null;

  const handleSave = () => {
    if (Object.keys(scores).length < allItemsCount) {
      toast.error("Please complete all 18 FIM items");
      return;
    }

    // Build comprehensive SOAP text
    let soapText = `• Functional Independence Measure (FIM): ${total}/126 → ${interpretation?.level}\n`;
    soapText += `  Motor Score: ${motor}/91\n`;
    soapText += `  Cognitive Score: ${cognitive}/35\n\n`;
    
    soapText += `  Item Scores:\n`;
    Object.entries(FIM_ITEMS).forEach(([domain, items]) => {
      soapText += `    ${domain.replace(/([A-Z])/g, ' $1').trim()}:\n`;
      items.forEach(item => {
        if (scores[item] !== undefined) {
          const levelLabel = SCORING_LEVELS.find(l => l.score === scores[item])?.label || scores[item];
          soapText += `      ${item}: ${scores[item]} (${levelLabel})\n`;
        }
      });
    });
    if (notes) soapText += `\n  Clinical Notes: ${notes}\n`;

    onSave({
      result_value: total,
      additional_data: {
        soap_text: soapText,
        total_score: total,
        motor_score: motor,
        cognitive_score: cognitive,
        item_scores: scores,
        interpretation: interpretation?.level,
        measurement_type: 'fim'
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  const renderDomain = (domainName, items) => (
    <Card key={domainName}>
      <CardHeader>
        <CardTitle className="text-lg">{domainName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item} className="border-b pb-3 last:border-b-0">
            <Label className="text-base mb-2 block">{item}</Label>
            <div className="grid grid-cols-7 gap-1">
              {SCORING_LEVELS.map((level) => (
                <Button
                  key={level.score}
                  type="button"
                  variant={scores[item] === level.score ? "default" : "outline"}
                  onClick={() => handleScoreChange(item, level.score)}
                  className="text-xs p-2 h-auto"
                  title={level.label}
                >
                  {level.score}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Functional Independence Measure (FIM)</h2>
              <p className="text-slate-600 mt-1">18-item assessment of physical and cognitive disability</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
           <div className="space-y-6">
             {/* Clinician Instructions */}
             <Card className="bg-teal-50 border-teal-200">
               <CardHeader className="pb-2">
                 <button
                   onClick={() => setExpandedSection(expandedSection === "instructions" ? null : "instructions")}
                   className="w-full flex items-center justify-between font-semibold text-teal-900 hover:text-teal-700"
                 >
                   <span className="flex items-center gap-2">
                     <Info className="w-5 h-5" />
                     Clinician Instructions &amp; Administration
                   </span>
                   {expandedSection === "instructions" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                 </button>
               </CardHeader>
               {expandedSection === "instructions" && (
                 <CardContent className="text-sm text-teal-900 space-y-3">
                   <div>
                     <p className="font-semibold text-teal-800 mb-1">Purpose</p>
                     <p>The FIM measures the level of disability and burden of care required for 18 key functional tasks across motor and cognitive domains. Widely used in rehabilitation, stroke, TBI, and spinal cord injury settings.</p>
                   </div>
                   <div>
                     <p className="font-semibold text-teal-800 mb-1">Administration Time</p>
                     <p className="text-teal-700 bg-white/60 p-2 rounded border border-teal-200"><strong>15–30 minutes</strong> depending on client complexity. Allows observation and staff interview.</p>
                   </div>
                   <div>
                     <p className="font-semibold text-teal-800 mb-1">Who Can Administer</p>
                     <p>Trained clinical staff: physiotherapists, occupational therapists, nurses, clinicians with FIM certification. Scoring requires clinical judgement and knowledge of functional independence definitions.</p>
                   </div>
                   <div>
                     <p className="font-semibold text-teal-800 mb-1">Assessment Method</p>
                     <p>Observation of actual function (preferred) or reliable report from caregivers. Rate <strong>what the client actually does</strong>, not what they <em>could</em> do. Consider safety, speed, and independence in typical environments.</p>
                   </div>
                   <div>
                     <p className="font-semibold text-teal-800 mb-1">Scoring Principle</p>
                     <p className="text-teal-700 bg-white/60 p-2 rounded border border-teal-200">
                       <strong>1 = Total Assistance (&lt;25% effort by client)</strong> to <strong>7 = Complete Independence</strong> (safely, without aids or modifications). Rating reflects typical performance, not best or worst case.
                     </p>
                   </div>
                 </CardContent>
               )}
             </Card>

             {/* References &amp; Links */}
             <Card className="bg-slate-50 border-slate-200">
               <CardHeader className="pb-2">
                 <button
                   onClick={() => setExpandedSection(expandedSection === "references" ? null : "references")}
                   className="w-full flex items-center justify-between font-semibold text-slate-900 hover:text-slate-700"
                 >
                   <span>References &amp; External Resources</span>
                   {expandedSection === "references" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                 </button>
               </CardHeader>
               {expandedSection === "references" && (
                 <CardContent className="text-xs text-slate-700 space-y-2">
                   <div>
                     <p className="font-semibold text-slate-800 mb-1">Key Reference</p>
                     <p>
                       <strong>Uniform Data System for Medical Rehabilitation (UDSMR).</strong> Functional Independence Measure (FIM™). Version 5.2. Buffalo, NY: UDSMR, State University of New York at Buffalo. Available at: <a href="https://www.udsmr.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">www.udsmr.org</a>
                     </p>
                   </div>
                   <div>
                     <p className="font-semibold text-slate-800 mb-1">Validation Studies</p>
                     <p>Linacre, J. M., et al. (1994). The structure and stability of the Functional Independence Measure. <em>Archives of Physical Medicine and Rehabilitation</em>, 75(2), 127–132.</p>
                   </div>
                   <div className="space-y-1">
                     <p className="font-semibold text-slate-800">External Links</p>
                     <div className="flex flex-wrap gap-2">
                       <Button
                         onClick={() => window.open("https://www.udsmr.org", "_blank")}
                         variant="outline"
                         size="sm"
                         className="text-xs h-7"
                       >
                         <ExternalLink className="w-3 h-3 mr-1" />
                         UDSMR Official
                       </Button>
                       <Button
                         onClick={() => window.open("https://en.wikipedia.org/wiki/Functional_Independence_Measure", "_blank")}
                         variant="outline"
                         size="sm"
                         className="text-xs h-7"
                       >
                         <ExternalLink className="w-3 h-3 mr-1" />
                         FIM Overview
                       </Button>
                     </div>
                   </div>
                 </CardContent>
               )}
             </Card>

             {/* Scoring Guide */}
             <Card className="bg-blue-50 border-blue-200">
               <CardHeader>
                 <CardTitle className="text-lg flex items-center gap-2">
                   <Info className="w-5 h-5 text-blue-600" />
                   Scoring Guide
                 </CardTitle>
               </CardHeader>
              <CardContent className="text-sm text-blue-800">
                <div className="space-y-1">
                  {SCORING_LEVELS.map((level) => (
                    <p key={level.score}><strong>{level.score}:</strong> {level.label}</p>
                  ))}
                </div>
                <p className="mt-3"><strong>Total Score Range:</strong> 18-126 (higher = more independent)</p>
              </CardContent>
            </Card>

            {renderDomain("Self-Care", FIM_ITEMS.selfCare)}
            {renderDomain("Sphincter Control", FIM_ITEMS.sphincterControl)}
            {renderDomain("Transfers", FIM_ITEMS.transfers)}
            {renderDomain("Locomotion", FIM_ITEMS.locomotion)}
            {renderDomain("Communication", FIM_ITEMS.communication)}
            {renderDomain("Social Cognition", FIM_ITEMS.socialCognition)}

            {interpretation && (
              <Card className={`${interpretation.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-xl ${interpretation.color}`}>
                    {interpretation.level}
                  </CardTitle>
                </CardHeader>
                <CardContent className={interpretation.color}>
                  <div className="space-y-2">
                    <p className="font-semibold text-2xl">Total: {total} / 126</p>
                    <p>Motor: {motor} / 91 | Cognitive: {cognitive} / 35</p>
                    <p className="text-sm mt-3">
                      <strong>MCID:</strong> 22-point change indicates clinically significant improvement.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Specific limitations, caregiver burden, rehabilitation priorities..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={Object.keys(scores).length < allItemsCount} className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="w-4 h-4 mr-2" />
            Save FIM
          </Button>
        </div>
      </div>
    </div>
  );
}