import React, { useState } from "react";
import { todayLocal } from "@/lib/localDate";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

const IES_R_ITEMS = [
  { id: 1, text: "Any reminder brought back feelings about it", subscale: "intrusion" },
  { id: 2, text: "I had trouble staying asleep", subscale: "hyperarousal" },
  { id: 3, text: "Other things kept making me think about it", subscale: "intrusion" },
  { id: 4, text: "I felt irritable and angry", subscale: "hyperarousal" },
  { id: 5, text: "I avoided letting myself get upset when I thought about it or was reminded of it", subscale: "avoidance" },
  { id: 6, text: "I thought about it when I didn't mean to", subscale: "intrusion" },
  { id: 7, text: "I felt as if it hadn't happened or wasn't real", subscale: "avoidance" },
  { id: 8, text: "I stayed away from reminders about it", subscale: "avoidance" },
  { id: 9, text: "Pictures about it popped into my mind", subscale: "intrusion" },
  { id: 10, text: "I was jumpy and easily startled", subscale: "hyperarousal" },
  { id: 11, text: "I tried not to think about it", subscale: "avoidance" },
  { id: 12, text: "I was aware that I still had a lot of feelings about it, but I didn't deal with them", subscale: "avoidance" },
  { id: 13, text: "My feelings about it were kind of numb", subscale: "avoidance" },
  { id: 14, text: "I found myself acting or feeling as though I was back at that time", subscale: "intrusion" },
  { id: 15, text: "I had trouble falling asleep", subscale: "hyperarousal" },
  { id: 16, text: "I had waves of strong feelings about it", subscale: "intrusion" },
  { id: 17, text: "I tried to remove it from my memory", subscale: "avoidance" },
  { id: 18, text: "I had trouble concentrating", subscale: "hyperarousal" },
  { id: 19, text: "Reminders of it caused me to have physical reactions, such as sweating, trouble breathing, nausea, or a pounding heart", subscale: "hyperarousal" },
  { id: 20, text: "I had dreams about it", subscale: "intrusion" },
  { id: 21, text: "I felt watchful or on-guard", subscale: "hyperarousal" },
  { id: 22, text: "I tried not to talk about it", subscale: "avoidance" }
];

export default function IESRRunner({ onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [traumaticEvent, setTraumaticEvent] = useState("");
  const [timeSinceEvent, setTimeSinceEvent] = useState("");
  const [notes, setNotes] = useState("");

  const handleScoreChange = (itemId, value) => {
    setScores({ ...scores, [itemId]: value });
  };

  const calculateScores = () => {
    const intrusion = IES_R_ITEMS.filter(i => i.subscale === "intrusion")
      .reduce((sum, item) => sum + (parseInt(scores[item.id]) || 0), 0);
    const avoidance = IES_R_ITEMS.filter(i => i.subscale === "avoidance")
      .reduce((sum, item) => sum + (parseInt(scores[item.id]) || 0), 0);
    const hyperarousal = IES_R_ITEMS.filter(i => i.subscale === "hyperarousal")
      .reduce((sum, item) => sum + (parseInt(scores[item.id]) || 0), 0);
    const total = intrusion + avoidance + hyperarousal;
    
    return { intrusion, avoidance, hyperarousal, total };
  };

  const { intrusion, avoidance, hyperarousal, total } = calculateScores();

  const getInterpretation = () => {
    if (total >= 33) {
      return {
        level: 'High concern for PTSD - Probable diagnosis',
        color: 'text-red-600',
        bg: 'bg-red-50',
        recommendation: 'Strong recommendation for psychological referral and further assessment'
      };
    } else if (total >= 24) {
      return {
        level: 'Moderate concern for PTSD symptoms',
        color: 'text-orange-600',
        bg: 'bg-orange-50',
        recommendation: 'Consider psychological referral and trauma-informed care approach'
      };
    } else {
      return {
        level: 'Low concern for PTSD',
        color: 'text-green-600',
        bg: 'bg-green-50',
        recommendation: 'Monitor symptoms; trauma-sensitive approach to exercise prescription'
      };
    }
  };

  const interpretation = Object.keys(scores).length === 22 ? getInterpretation() : null;

  const handleSave = () => {
    if (Object.keys(scores).length < 22) {
      toast.error("Please complete all 22 items");
      return;
    }

    if (!traumaticEvent || !timeSinceEvent) {
      toast.error("Please specify the traumatic event and time since occurrence");
      return;
    }

    // Generate comprehensive SOAP text with all Q&A
    let soapText = `Impact of Events Scale - Revised (IES-R) Assessment:\n\n`;
    soapText += `Traumatic Event: ${traumaticEvent}\n`;
    soapText += `Time Since Event: ${timeSinceEvent}\n\n`;
    soapText += `Individual Question Responses (Past 7 Days):\n`;
    
    IES_R_ITEMS.forEach((item) => {
      const score = parseInt(scores[item.id]);
      const scoreLabels = { 0: "Not at all", 1: "A little bit", 2: "Moderately", 3: "Quite a bit", 4: "Extremely" };
      soapText += `\nQ${item.id}. ${item.text} [${item.subscale}]\n`;
      soapText += `    Answer: ${scoreLabels[score]} (Score: ${score})\n`;
    });

    soapText += `\nSubscale Scores:\n`;
    soapText += `  • Intrusion: ${intrusion}\n`;
    soapText += `  • Avoidance: ${avoidance}\n`;
    soapText += `  • Hyperarousal: ${hyperarousal}\n`;
    soapText += `  • Total IES-R Score: ${total}/88 - ${interpretation?.level}\n`;

    if (notes && notes.trim()) {
      soapText += `\nClinical Notes: ${notes}\n`;
    }

    onSave({
      result_value: total,
      additional_data: {
        total_score: total,
        intrusion_subscale: intrusion,
        avoidance_subscale: avoidance,
        hyperarousal_subscale: hyperarousal,
        item_scores: scores,
        traumatic_event: traumaticEvent,
        time_since_event: timeSinceEvent,
        interpretation: interpretation?.level,
        soap_text: soapText
      },
      notes: notes,
      assessment_date: todayLocal()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Impact of Events Scale - Revised (IES-R)</h2>
              <p className="text-slate-600 mt-1">Assessment of post-traumatic stress symptoms</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Norms */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Score Interpretation (/88)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Total Score</th><th className="p-2 text-left">Interpretation</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">&lt;24</td><td className="p-2 text-green-700">Low PTSD concern</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">24–32</td><td className="p-2 text-yellow-700">Moderate concern — consider referral</td></tr>
                    <tr className="border-t"><td className="p-2">≥33</td><td className="p-2 text-red-700">High concern — probable PTSD; psychological referral indicated</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">Subscales: Intrusion (7 items), Avoidance (8 items), Hyperarousal (7 items). MCID: ~6 points. Source: Weiss & Marmar (1997).</p>
            </div>

            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>Weiss DS & Marmar CR. (1997). The Impact of Event Scale—Revised. In J.P. Wilson & T.M. Keane (Eds.), <em>Assessing Psychological Trauma and PTSD</em> (pp. 399–411). Guilford Press.</p>
              <p>Creamer M, Bell R, & Failla S. (2003). Psychometric properties of the Impact of Event Scale—Revised. <em>Behaviour Research and Therapy, 41</em>(12), 1489–1496.</p>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Clinician Script
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p>"I'm going to ask you about symptoms you may have experienced related to [specific traumatic event]. For each statement, please tell me how much you were distressed or bothered by that problem in the past 7 days."</p>
                <div className="mt-3 space-y-1">
                  <p><strong>0 = Not at all</strong></p>
                  <p><strong>1 = A little bit</strong></p>
                  <p><strong>2 = Moderately</strong></p>
                  <p><strong>3 = Quite a bit</strong></p>
                  <p><strong>4 = Extremely</strong></p>
                </div>
                <p className="mt-3">"Please answer honestly - this helps us understand how the event has affected you and how we can best support your recovery."</p>
              </CardContent>
            </Card>

            <Card className="bg-red-50 border-red-200">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-red-800">
                  ⚠ Clinical Considerations
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-red-800">
                <p><strong>Important:</strong> This assessment screens for PTSD symptoms but does not diagnose PTSD. High scores warrant immediate referral to appropriate mental health services.</p>
                <p className="mt-2"><strong>Trauma-Informed Care:</strong> Be sensitive when administering. Client may become distressed. Have crisis support contacts available.</p>
                <p className="mt-2"><strong>Exercise Implications:</strong> PTSD symptoms can affect exercise tolerance, motivation, and safety. Trauma-sensitive approaches include avoiding triggering environments, ensuring client autonomy, and creating predictable routines.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Event Context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Traumatic Event (Brief description) *</Label>
                  <Input
                    value={traumaticEvent}
                    onChange={(e) => setTraumaticEvent(e.target.value)}
                    placeholder="e.g., Motor vehicle accident, workplace injury, assault"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Time Since Event *</Label>
                  <Input
                    value={timeSinceEvent}
                    onChange={(e) => setTimeSinceEvent(e.target.value)}
                    placeholder="e.g., 3 months ago, 2 years ago"
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">IES-R Items (Past 7 Days)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {IES_R_ITEMS.map((item) => (
                  <div key={item.id} className="border-b pb-4 last:border-b-0">
                    <Label className="text-base mb-2 block">
                      {item.id}. {item.text}
                      <span className="text-xs text-slate-500 ml-2">({item.subscale})</span>
                    </Label>
                    <div className="flex gap-2 flex-wrap">
                      {[0, 1, 2, 3, 4].map((score) => (
                        <Button
                          key={score}
                          type="button"
                          variant={scores[item.id] === score.toString() ? "default" : "outline"}
                          onClick={() => handleScoreChange(item.id, score.toString())}
                          className="w-16"
                        >
                          {score}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {interpretation && (
              <Card className={`${interpretation.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-xl ${interpretation.color}`}>
                    {interpretation.level}
                  </CardTitle>
                </CardHeader>
                <CardContent className={interpretation.color}>
                  <div className="space-y-2">
                    <p className="font-semibold">Total Score: {total} / 88</p>
                    <p>Intrusion: {intrusion} | Avoidance: {avoidance} | Hyperarousal: {hyperarousal}</p>
                    <p className="mt-3 font-semibold">{interpretation.recommendation}</p>
                  </div>
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
                  placeholder="Client response to assessment, additional concerns, referral actions taken, trauma-sensitive exercise modifications..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave}
            disabled={Object.keys(scores).length < 22 || !traumaticEvent || !timeSinceEvent}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save IES-R Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}