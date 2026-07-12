import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, BookOpen, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const LYSHOLM_ITEMS = [
  { 
    id: 'limp', 
    label: 'Limp', 
    options: [
      { label: 'None (5 pts)', value: 5 },
      { label: 'Slight or Periodic (3 pts)', value: 3 },
      { label: 'Severe and Constant (0 pts)', value: 0 }
    ]
  },
  { 
    id: 'support', 
    label: 'Support', 
    options: [
      { label: 'None (5 pts)', value: 5 },
      { label: 'Stick or Crutch (2 pts)', value: 2 },
      { label: 'Weight Bearing Impossible (0 pts)', value: 0 }
    ]
  },
  { 
    id: 'locking', 
    label: 'Locking', 
    options: [
      { label: 'No locking (15 pts)', value: 15 },
      { label: 'Catching sensation but no locking (10 pts)', value: 10 },
      { label: 'Locking occasionally (6 pts)', value: 6 },
      { label: 'Locking frequently (2 pts)', value: 2 },
      { label: 'Locked joint on examination (0 pts)', value: 0 }
    ]
  },
  { 
    id: 'instability', 
    label: 'Giving Way', 
    options: [
      { label: 'Never (25 pts)', value: 25 },
      { label: 'Rarely during athletics or severe exertion (20 pts)', value: 20 },
      { label: 'Frequently during athletics (15 pts)', value: 15 },
      { label: 'Occasionally in daily activities (10 pts)', value: 10 },
      { label: 'Often in daily activities (5 pts)', value: 5 },
      { label: 'With every step (0 pts)', value: 0 }
    ]
  },
  { 
    id: 'pain', 
    label: 'Pain', 
    options: [
      { label: 'None (25 pts)', value: 25 },
      { label: 'Inconstant and slight during severe exertion (20 pts)', value: 20 },
      { label: 'Marked during severe exertion (15 pts)', value: 15 },
      { label: 'Marked on or after walking more than 1 mile (10 pts)', value: 10 },
      { label: 'Marked on or after walking less than 1 mile (5 pts)', value: 5 },
      { label: 'Constant (0 pts)', value: 0 }
    ]
  },
  { 
    id: 'swelling', 
    label: 'Swelling', 
    options: [
      { label: 'None (10 pts)', value: 10 },
      { label: 'On giving way (6 pts)', value: 6 },
      { label: 'On ordinary exertion (2 pts)', value: 2 },
      { label: 'Constant (0 pts)', value: 0 }
    ]
  },
  { 
    id: 'stairs', 
    label: 'Climbing Stairs', 
    options: [
      { label: 'No problems (10 pts)', value: 10 },
      { label: 'Slightly impaired (6 pts)', value: 6 },
      { label: 'One step at a time (2 pts)', value: 2 },
      { label: 'Unable (0 pts)', value: 0 }
    ]
  },
  { 
    id: 'squatting', 
    label: 'Squatting', 
    options: [
      { label: 'No problems (5 pts)', value: 5 },
      { label: 'Slightly impaired (4 pts)', value: 4 },
      { label: 'Not past 90 degrees (2 pts)', value: 2 },
      { label: 'Unable (0 pts)', value: 0 }
    ]
  },
  { 
    id: 'range_of_motion', 
    label: 'Range of Motion', 
    options: [
      { label: 'Fully normal (5 pts)', value: 5 },
      { label: 'Slightly limited (4 pts)', value: 4 },
      { label: 'Flexion < 90 degrees or extension lag (2 pts)', value: 2 },
      { label: 'Flexion < 60 degrees (0 pts)', value: 0 }
    ]
  },
];

export default function LysholmKneeScoreRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");

  const handleResponseChange = (field, value) => {
    setResponses((prev) => ({ ...prev, [field]: value }));
  };

  const getTotalScore = () => {
    return Object.values(responses).reduce((sum, value) => sum + value, 0);
  };

  const handleSave = () => {
    if (Object.keys(responses).length < LYSHOLM_ITEMS.length) {
      toast.error("Please answer all questions.");
      return;
    }

    const totalScore = getTotalScore();
    const grade = totalScore >= 95 ? 'Excellent' : totalScore >= 84 ? 'Good' : totalScore >= 65 ? 'Fair' : 'Poor';

    let soapText = `• Lysholm Knee Score: ${totalScore}/100 (${grade})\n\n  Item Scores:\n`;
    LYSHOLM_ITEMS.forEach(item => {
      const selectedOption = item.options.find(o => o.value === responses[item.id]);
      soapText += `  - ${item.label}: ${responses[item.id]} pts${selectedOption ? ` (${selectedOption.label.split(' (')[0]})` : ''}\n`;
    });

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        measurement_type: "lysholm",
        soap_text: soapText,
        lysholm_data: {
          result_value: totalScore,
          responses,
        }
      },
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("Assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Lysholm Knee Score</CardTitle>
                <p className="text-xs text-slate-500 mt-1">Knee ligament injury and osteoarthritis outcome measure</p>
              </div>
              <a 
                href="https://pubmed.ncbi.nlm.nih.gov/4028566/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                title="Tegner & Lysholm (1985) - Original Lysholm Knee Score publication"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Clinician Script */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-amber-900">Clinician Script</p>
                </div>
                <div className="text-sm text-amber-800 space-y-2 ml-6">
                  <p><strong>Administration:</strong> I'm going to ask you about your knee function. Please answer each question based on your current symptoms and limitations.</p>
                  <p><strong>Scoring:</strong> Each item has specific responses worth different points. Higher scores indicate better knee function (95-100 = excellent, 84-94 = good, 65-83 = fair, below 65 = poor).</p>
                  <p><strong>Time:</strong> This assessment takes about 5-10 minutes to complete.</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Total Score:</strong> {getTotalScore()}/100 points
                </p>
              </div>

              {LYSHOLM_ITEMS.map((item) => (
                <div key={item.id} className="border p-4 rounded-md">
                  <Label className="font-semibold mb-3 block">{item.label}</Label>
                  <div className="flex flex-wrap gap-2">
                    {item.options.map((option, idx) => (
                      <Button
                        key={idx}
                        variant={responses[item.id] === option.value ? "default" : "outline"}
                        onClick={() => handleResponseChange(item.id, option.value)}
                        size="sm"
                        className="text-sm"
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter any additional clinical notes..."
                  rows={3}
                />
              </div>

              {/* References Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-4">
                <p className="text-sm font-semibold text-slate-900 mb-3">References</p>
                <ul className="text-sm text-slate-700 space-y-2 ml-4">
                  <li>
                    <strong>Lysholm J, Gillquist J.</strong> "Evaluation of knee ligament injuries with special emphasis on the anterior drawer test." Acta Orthopaedica Scandinavica, 1976. 
                    <a href="https://pubmed.ncbi.nlm.nih.gov/6715422/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs ml-1">[PubMed]</a>
                  </li>
                  <li>
                    <strong>Tegner Y, Lysholm J.</strong> "Rating systems in the evaluation of knee ligament injuries." Clinical Orthopaedics and Related Research, 1985;198:43-49.
                    <a href="https://pubmed.ncbi.nlm.nih.gov/4028566/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs ml-1">[PubMed]</a>
                  </li>
                  <li>
                    <strong>Lobaugh A, et al.</strong> "The Lysholm Knee Score: Clinimetric and Psychometric Properties." Journal of Orthopaedic & Sports Physical Therapy, 2013;43(6):432-440.
                    <a href="https://pubmed.ncbi.nlm.nih.gov/23628888/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs ml-1">[PubMed]</a>
                  </li>
                  <li>
                    <strong>Interpretation Guide:</strong> Scores ≥95 = Excellent function; 84-94 = Good; 65-83 = Fair; &lt;65 = Poor knee function
                  </li>
                </ul>
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
            Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}