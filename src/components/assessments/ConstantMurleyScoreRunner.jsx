import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Info, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function ConstantMurleyScoreRunner({ client, onSave, onClose }) {
  const [pain, setPain] = useState(15); // 0-15, where 15 is no pain
  const [adlScores, setAdlScores] = useState({
    work: 4,
    leisure: 4,
    sleep: 2,
    positioning: 10, // Ability to position hand
  });
  const [rangeOfMotion, setRangeOfMotion] = useState({
    flexion: "",
    abduction: "",
    externalRotation: "",
    internalRotation: "",
  });
  const [strength, setStrength] = useState("");
  const [notes, setNotes] = useState("");

  const handleAdlChange = (field, value) => {
    setAdlScores((prev) => ({ ...prev, [field]: parseInt(value) || 0 }));
  };

  const handleROMChange = (field, value) => {
    setRangeOfMotion((prev) => ({ ...prev, [field]: value }));
  };

  const calculateROMScore = () => {
    const flexion = parseInt(rangeOfMotion.flexion) || 0;
    const abduction = parseInt(rangeOfMotion.abduction) || 0;
    const er = parseInt(rangeOfMotion.externalRotation) || 0;
    const ir = parseInt(rangeOfMotion.internalRotation) || 0;

    let score = 0;
    
    // Flexion scoring (0-10)
    if (flexion >= 150) score += 10;
    else if (flexion >= 120) score += 8;
    else if (flexion >= 90) score += 6;
    else if (flexion >= 60) score += 4;
    else if (flexion >= 30) score += 2;

    // Abduction scoring (0-10)
    if (abduction >= 150) score += 10;
    else if (abduction >= 120) score += 8;
    else if (abduction >= 90) score += 6;
    else if (abduction >= 60) score += 4;
    else if (abduction >= 30) score += 2;

    // External rotation (0-10)
    if (er >= 90) score += 10;
    else if (er >= 60) score += 8;
    else if (er >= 45) score += 6;
    else if (er >= 30) score += 4;
    else if (er >= 15) score += 2;

    // Internal rotation (0-10)
    if (ir >= 10) score += 10; // Hand to neck
    else if (ir >= 9) score += 8; // Hand to head
    else if (ir >= 7) score += 6; // Hand to top of head
    else if (ir >= 5) score += 4; // Hand to mouth
    else if (ir >= 3) score += 2; // Hand to xiphoid

    return Math.min(40, score);
  };

  const getTotalScore = () => {
    const painValue = parseInt(pain) || 0;
    const adlTotal = Object.values(adlScores).reduce((sum, val) => sum + val, 0);
    const romScore = calculateROMScore();
    const strengthValue = parseInt(strength) || 0;

    return painValue + adlTotal + romScore + strengthValue;
  };

  const handleSave = () => {
    const totalScore = getTotalScore();
    const adlTotal = Object.values(adlScores).reduce((sum, val) => sum + val, 0);
    const romScore = calculateROMScore();
    const soapText = `• Constant-Murley Score: ${totalScore}/100\n\n  Subscores:\n  - Pain: ${pain}/15\n  - Activities of Daily Living: ${adlTotal}/20\n    • Work: ${adlScores.work}/4\n    • Recreation/Sport: ${adlScores.leisure}/4\n    • Sleep: ${adlScores.sleep}/2\n    • Positioning: ${adlScores.positioning}/10\n  - Range of Motion: ${romScore}/40\n    • Forward Flexion: ${rangeOfMotion.flexion || 'N/A'}°\n    • Abduction: ${rangeOfMotion.abduction || 'N/A'}°\n    • External Rotation: ${rangeOfMotion.externalRotation || 'N/A'}°\n    • Internal Rotation level: ${rangeOfMotion.internalRotation || 'N/A'}\n  - Strength: ${strength || 0}/25 lbs`;

    onSave({
      status: "completed",
      result_value: totalScore,
      additional_data: {
        measurement_type: "constant_murley",
        soap_text: soapText,
        constant_murley_data: {
          result_value: totalScore,
          pain,
          adlScores,
          rangeOfMotion,
          rom_score: romScore,
          strength,
        }
      },
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("Assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-slate-50 border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Constant-Murley Score</h2>
            <p className="text-sm text-slate-600 mt-1">Shoulder Function Assessment - Self-Administered</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Score Summary */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <p className="text-lg text-blue-900">
                <strong>Total Score: {getTotalScore()}/100</strong>
              </p>
              <p className="text-sm text-blue-800 mt-1">Higher scores indicate better shoulder function</p>
            </CardContent>
          </Card>

          {/* Instructions & Overview */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="w-5 h-5" />
                Administration & Scoring Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-700 space-y-3">
              <div>
                <p className="font-semibold">Purpose:</p>
                <p className="ml-4">Objective assessment of shoulder pain, function, and range of motion for patients with rotator cuff disorders.</p>
              </div>
              <div>
                <p className="font-semibold">Subscales (100 points total):</p>
                <ul className="list-disc list-inside ml-4 space-y-1 text-xs mt-1">
                  <li><strong>Pain (15 pts):</strong> Most important component; assesses frequency and severity</li>
                  <li><strong>ADL (20 pts):</strong> Work, recreation/sport, sleep, and positioning ability</li>
                  <li><strong>ROM (40 pts):</strong> Forward flexion, abduction, external/internal rotation</li>
                  <li><strong>Strength (25 pts):</strong> Abduction strength at 90° (1 lb = 1 point)</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold">Interpretation:</p>
                <ul className="list-disc list-inside ml-4 space-y-1 text-xs mt-1">
                  <li><strong>91–100:</strong> Excellent function</li>
                  <li><strong>71–90:</strong> Good function</li>
                  <li><strong>51–70:</strong> Moderate function</li>
                  <li><strong>&lt;50:</strong> Poor function</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* ROM Position Guide */}
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-amber-900">
                <AlertCircle className="w-5 h-5" />
                ROM Position Landmarks (Internal Rotation)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-amber-900 space-y-2">
              <p className="font-semibold">Patient position: Supine or seated</p>
              <div className="bg-white p-3 rounded space-y-1">
                <p><strong>10 pts (Neck level):</strong> Hand reaches behind neck at level of C4-C5</p>
                <p><strong>9 pts (Head level):</strong> Hand reaches back of head at ear level</p>
                <p><strong>7 pts (Top of head):</strong> Hand reaches top of head/above ear</p>
                <p><strong>5 pts (Mouth):</strong> Hand reaches mouth level</p>
                <p><strong>3 pts (Xiphoid):</strong> Hand reaches xiphoid process (lower sternum)</p>
              </div>
            </CardContent>
          </Card>

          {/* References */}
          <Card className="border-slate-200 bg-slate-50">
            <CardHeader>
              <CardTitle className="text-base">References & Resources</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-700 space-y-3">
              <div>
                <p><strong>Constant CR, Murley AH.</strong> (1987). A clinical method of functional assessment of the shoulder. <em>Clinical Orthopaedics and Related Research</em>, 214:160–164.</p>
              </div>
              <div>
                <p><strong>Roy JS, MacDermid JC, Woodhouse LJ.</strong> (2009). A systematic review of the psychometric properties of the Constant-Murley Score. <em>Journal of Shoulder and Elbow Surgery</em>, 18(3):370–380.</p>
              </div>
              <Button
                onClick={() => window.open('https://www.jses-online.org/', '_blank')}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                <ExternalLink className="w-3 h-3 mr-2" />
                JSES Journal
              </Button>
            </CardContent>
          </Card>

          {/* Data Entry Form */}
          <Card className="border-blue-200">
            <CardHeader>
              <CardTitle className="text-base">Score Data Entry</CardTitle>
            </CardHeader>
            <CardContent>
            <div className="space-y-6">

              <div>
                <Label className="text-base font-semibold mb-2 block">1. Pain (0-15 points)</Label>
                <p className="text-sm text-gray-600 mb-2">15 = No pain, 10 = Mild, 5 = Moderate, 0 = Severe/Constant</p>
                <div className="flex flex-wrap gap-2">
                  {[15, 10, 5, 0].map((value) => (
                    <Button
                      key={value}
                      variant={pain === value ? "default" : "outline"}
                      onClick={() => setPain(value)}
                      size="sm"
                    >
                      {value} pts
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">2. Activities of Daily Living (0-20 points)</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Work (0-4 pts)</Label>
                    <Input
                      type="number"
                      value={adlScores.work}
                      onChange={(e) => handleAdlChange('work', e.target.value)}
                      min="0"
                      max="4"
                    />
                  </div>
                  <div>
                    <Label>Recreation/Sport (0-4 pts)</Label>
                    <Input
                      type="number"
                      value={adlScores.leisure}
                      onChange={(e) => handleAdlChange('leisure', e.target.value)}
                      min="0"
                      max="4"
                    />
                  </div>
                  <div>
                    <Label>Sleep (0-2 pts)</Label>
                    <Input
                      type="number"
                      value={adlScores.sleep}
                      onChange={(e) => handleAdlChange('sleep', e.target.value)}
                      min="0"
                      max="2"
                    />
                  </div>
                  <div>
                    <Label>Positioning (0-10 pts)</Label>
                    <p className="text-xs text-gray-500 mb-1">10=Neck level, 8=Head, 6=Top of head, 4=Mouth, 2=Xiphoid</p>
                    <Input
                      type="number"
                      value={adlScores.positioning}
                      onChange={(e) => handleAdlChange('positioning', e.target.value)}
                      min="0"
                      max="10"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">3. Range of Motion (0-40 points)</Label>
                <p className="text-sm text-gray-600 mb-3">Enter degrees for each movement</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Forward Flexion (°)</Label>
                    <Input
                      type="number"
                      value={rangeOfMotion.flexion}
                      onChange={(e) => handleROMChange('flexion', e.target.value)}
                      placeholder="e.g., 150"
                    />
                  </div>
                  <div>
                    <Label>Abduction (°)</Label>
                    <Input
                      type="number"
                      value={rangeOfMotion.abduction}
                      onChange={(e) => handleROMChange('abduction', e.target.value)}
                      placeholder="e.g., 140"
                    />
                  </div>
                  <div>
                    <Label>External Rotation (°)</Label>
                    <Input
                      type="number"
                      value={rangeOfMotion.externalRotation}
                      onChange={(e) => handleROMChange('externalRotation', e.target.value)}
                      placeholder="e.g., 60"
                    />
                  </div>
                  <div>
                    <Label>Internal Rotation (level)</Label>
                    <p className="text-xs text-gray-500 mb-1">10=Neck, 9=Head, 7=Top of head, 5=Mouth, 3=Xiphoid</p>
                    <Input
                      type="number"
                      value={rangeOfMotion.internalRotation}
                      onChange={(e) => handleROMChange('internalRotation', e.target.value)}
                      placeholder="e.g., 8"
                      min="0"
                      max="10"
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2">ROM Score: {calculateROMScore()}/40 points</p>
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">4. Strength (0-25 points)</Label>
                <p className="text-sm text-gray-600 mb-2">Measured in abduction at 90°, in pounds (1 lb = 1 point, max 25)</p>
                <Input
                  type="number"
                  value={strength}
                  onChange={(e) => setStrength(e.target.value)}
                  min="0"
                  max="25"
                  placeholder="Enter strength in lbs"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
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

          <div className="flex justify-end space-x-2 sticky bottom-0 bg-slate-50 border-t px-6 py-4">
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