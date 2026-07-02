import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

const BESTEST_SECTIONS = [
  {
    name: "Biomechanical Constraints",
    items: [
      "Base of support",
      "COM alignment",
      "Ankle strength & ROM",
      "Hip/trunk lateral strength",
      "Sit on floor & stand up"
    ]
  },
  {
    name: "Stability Limits/Verticality",
    items: [
      "Functional reach forward",
      "Functional reach lateral",
      "Lean to limits"
    ]
  },
  {
    name: "Anticipatory Postural Adjustments",
    items: [
      "Sit to stand",
      "Rise to toes",
      "Stand on one leg",
      "Alternate stair touching",
      "Standing arm raise"
    ]
  },
  {
    name: "Postural Responses",
    items: [
      "In-place response forward",
      "In-place response backward",
      "Compensatory step correction forward",
      "Compensatory step correction backward",
      "Compensatory step correction lateral"
    ]
  },
  {
    name: "Sensory Orientation",
    items: [
      "Stance eyes open firm surface",
      "Stance eyes closed foam surface",
      "Incline eyes closed",
      "Stance eyes open turning head horizontal",
      "Stance eyes open turning head vertical"
    ]
  },
  {
    name: "Stability in Gait",
    items: [
      "Gait level surface",
      "Change in gait speed",
      "Walk with head turns horizontal",
      "Walk with pivot turns",
      "Step over obstacles",
      "TUG with dual task"
    ]
  }
];

export default function BESTestRunner({ onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [testVersion, setTestVersion] = useState("full");
  const [assistiveDevice, setAssistiveDevice] = useState("none");
  const [tasksModified, setTasksModified] = useState("");
  const [domainComments, setDomainComments] = useState("");
  const [notes, setNotes] = useState("");

  const calculateSectionTotal = (sectionIndex) => {
    const section = BESTEST_SECTIONS[sectionIndex];
    return section.items.reduce((sum, _, itemIndex) => {
      const key = `${sectionIndex}-${itemIndex}`;
      return sum + (parseFloat(scores[key]) || 0);
    }, 0);
  };

  const calculateGrandTotal = () => {
    return BESTEST_SECTIONS.reduce((total, _, sectionIndex) => {
      return total + calculateSectionTotal(sectionIndex);
    }, 0);
  };

  const calculatePercentage = () => {
    const total = calculateGrandTotal();
    return ((total / 108) * 100).toFixed(1);
  };

  const getInterpretation = (percentage) => {
    if (percentage >= 80) return { level: 'Low Balance Impairment/Falls Risk', color: 'text-green-600', bg: 'bg-green-50' };
    if (percentage >= 60) return { level: 'Moderate Balance Impairment', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { level: 'High Balance Impairment/Falls Risk', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const handleScoreChange = (sectionIndex, itemIndex, value) => {
    const key = `${sectionIndex}-${itemIndex}`;
    setScores({ ...scores, [key]: value });
  };

  const total = calculateGrandTotal();
  const percentage = parseFloat(calculatePercentage());
  const interpretation = getInterpretation(percentage);

  const handleSave = () => {
    if (Object.keys(scores).length === 0) {
      toast.error("Please score at least one item");
      return;
    }

    const sectionScores = BESTEST_SECTIONS.map((section, idx) => ({
      section_name: section.name,
      section_total: calculateSectionTotal(idx),
      section_max: section.items.length * 3
    }));

    // Build comprehensive SOAP text
    let soapText = `â€¢ Balance Evaluation Systems Test (BESTest): ${total}/108 (${percentage}%) â†’ ${interpretation.level}\n\n  Section Scores:\n`;
    sectionScores.forEach((section, idx) => {
      soapText += `  ${idx + 1}. ${section.section_name}: ${section.section_total}/${section.section_max}\n`;
    });
    if (assistiveDevice !== 'none') soapText += `\n  Assistive Device: ${assistiveDevice}\n`;
    if (tasksModified) soapText += `  Tasks Modified/Omitted: ${tasksModified}\n`;
    if (domainComments) soapText += `  Domain Comments: ${domainComments}\n`;
    if (notes) soapText += `  Clinical Notes: ${notes}\n`;

    onSave({
      result_value: total,
      additional_data: {
        soap_text: soapText,
        version: testVersion,
        item_scores: scores,
        section_scores: sectionScores,
        total_score: total,
        percentage_score: percentage,
        assistive_device: assistiveDevice,
        tasks_modified: tasksModified,
        domain_comments: domainComments,
        interpretation: interpretation.level,
        measurement_type: 'bestest'
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-violet-50 to-purple-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Balance Evaluation Systems Test</h2>
              <p className="text-slate-600 mt-1">Comprehensive balance system assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <Card className="bg-amber-50 border-amber-300">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-amber-900">
                    <p className="font-semibold mb-1">Official Test Manual Required</p>
                    <p>The BESTest scoring forms and administration instructions are copyrighted by Fay Horak PhD (Â© 2008). Please obtain the official test manual and scoring forms directly from the BESTest website before administering this assessment.</p>
                    <a
                      href="https://www.bestest.us"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 font-semibold text-amber-700 underline hover:text-amber-900"
                    >
                      Download official BESTest materials at bestest.us â†’
                    </a>
                    <p className="mt-2 text-xs text-amber-700">Use this tool to record scores only. Scores 0â€“3 per item (0 = severe impairment, 3 = normal).</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Test Version</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={testVersion} onValueChange={setTestVersion}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full BESTest (36 items)</SelectItem>
                    <SelectItem value="mini">Mini-BESTest (14 items)</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {BESTEST_SECTIONS.map((section, sectionIndex) => (
              <Card key={sectionIndex}>
                <CardHeader>
                  <CardTitle className="text-base">
                    Section {sectionIndex + 1}: {section.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {section.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                        <span className="text-sm">{item}</span>
                        <div className="flex gap-1">
                          {[0, 1, 2, 3].map(score => (
                            <Button
                              key={score}
                              type="button"
                              size="sm"
                              variant={scores[`${sectionIndex}-${itemIndex}`] === score.toString() ? "default" : "outline"}
                              onClick={() => handleScoreChange(sectionIndex, itemIndex, score.toString())}
                              className="w-10"
                            >
                              {score}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="text-right pt-2 border-t">
                      <span className="font-semibold">Section Total: {calculateSectionTotal(sectionIndex)} / {section.items.length * 3}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {total > 0 && (
              <Card className={`${interpretation.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-xl ${interpretation.color}`}>
                    Total Score: {total} / 108 ({percentage}%)
                  </CardTitle>
                </CardHeader>
                <CardContent className={interpretation.color}>
                  <p className="font-semibold text-lg">{interpretation.level}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Assistive Device</Label>
                  <Select value={assistiveDevice} onValueChange={setAssistiveDevice}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="cane">Cane</SelectItem>
                      <SelectItem value="walker">Walker</SelectItem>
                      <SelectItem value="gait_belt">Gait Belt for Safety</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tasks Modified or Omitted</Label>
                  <Textarea
                    value={tasksModified}
                    onChange={(e) => setTasksModified(e.target.value)}
                    placeholder="Note any tasks that were modified or omitted and reasons..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Domain-Specific Comments</Label>
                  <Textarea
                    value={domainComments}
                    onChange={(e) => setDomainComments(e.target.value)}
                    placeholder="Which systems are most impaired? Sensory integration, biomechanical, anticipatory adjustments, reactive responses, gait stability..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Clinical Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Overall observations, fall-prevention recommendations, targeted intervention suggestions..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-50 border-slate-200">
              <CardHeader>
                <CardTitle className="text-sm text-slate-700">References & Usage</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-2">
                <p>â€¢ Horak FB, Wrisley DM, Frank J. <em>The Balance Evaluation Systems Test (BESTest) to differentiate balance deficits.</em> Phys Ther. 2009;89(5):484â€“498. doi:10.2522/ptj.20080071</p>
                <p>â€¢ Franchignoni F, et al. <em>Using psychometric techniques to improve the Balance Evaluation Systems Test: the mini-BESTest.</em> J Rehabil Med. 2010;42(4):323â€“331.</p>
                <p className="pt-1 border-t border-slate-200 text-slate-500"><strong>Usage:</strong> The BESTest is freely available for clinical and research use. The tool is copyrighted by Fay Horak PhD (Â© 2008) but is provided at no cost for clinical practice and non-commercial research. The full manual and scoring forms are available at <strong>bestest.us</strong>. No licensing fee is required for clinical use.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave}
            disabled={Object.keys(scores).length === 0}
            className="bg-violet-600 hover:bg-violet-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save BESTest Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}