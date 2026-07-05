import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

export default function BeepTestRunner({ onSave, onClose, client }) {
  const [finalLevel, setFinalLevel] = useState('');
  const [finalShuttle, setFinalShuttle] = useState('');
  const [totalShuttles, setTotalShuttles] = useState('');
  const [rpe, setRPE] = useState('');
  const [terminationReason, setTerminationReason] = useState('');
  const [symptomsReported, setSymptomsReported] = useState('');
  const [peakHr, setPeakHr] = useState('');
  const [protocolNotes, setProtocolNotes] = useState('');

  const calculateVO2Max = () => {
    if (!finalLevel) return null;
    const lvl = parseFloat(finalLevel);
    // Ramsbottom equation
    return (31.025 + (3.238 * lvl) - (3.248 * 1) + (0.1536 * lvl * 1)).toFixed(1);
  };

  const getNormativeComparison = () => {
    if (!client || !client.date_of_birth || !finalLevel) return null;
    
    const age = new Date().getFullYear() - new Date(client.date_of_birth).getFullYear();
    const gender = client.gender === "male" ? "male" : "female";
    const level = parseFloat(finalLevel);
    
    const normatives = {
      "14-16-male": { mean: 12.7, std_dev: 1.5 },
      "14-16-female": { mean: 10.9, std_dev: 1.2 },
      "17-20-male": { mean: 12.12, std_dev: 1.3 },
      "17-20-female": { mean: 10.8, std_dev: 1.1 },
      "21-30-male": { mean: 12.5, std_dev: 1.4 },
      "21-30-female": { mean: 10.5, std_dev: 1.2 },
      "31-40-male": { mean: 11.8, std_dev: 1.5 },
      "31-40-female": { mean: 9.8, std_dev: 1.3 },
      "41-50-male": { mean: 11.2, std_dev: 1.6 },
      "41-50-female": { mean: 9.2, std_dev: 1.4 },
      "51-60-male": { mean: 10.4, std_dev: 1.7 },
      "51-60-female": { mean: 8.5, std_dev: 1.5 },
      "61-70-male": { mean: 9.5, std_dev: 1.8 },
      "61-70-female": { mean: 7.8, std_dev: 1.6 },
      "71-85-male": { mean: 8.6, std_dev: 1.9 },
      "71-85-female": { mean: 6.9, std_dev: 1.7 },
    };

    let ageGroup = "21-30";
    if (age >= 14 && age <= 16) ageGroup = "14-16";
    else if (age >= 17 && age <= 20) ageGroup = "17-20";
    else if (age >= 31 && age <= 40) ageGroup = "31-40";
    else if (age >= 41 && age <= 50) ageGroup = "41-50";
    else if (age >= 51 && age <= 60) ageGroup = "51-60";
    else if (age >= 61 && age <= 70) ageGroup = "61-70";
    else if (age >= 71) ageGroup = "71-85";

    const key = `${ageGroup}-${gender}`;
    const norm = normatives[key];

    if (!norm) return "average";

    const zscore = (level - norm.mean) / norm.std_dev;
    if (zscore >= 1.5) return "well_above_average";
    if (zscore >= 0.5) return "above_average";
    if (zscore >= -0.5) return "average";
    if (zscore >= -1.5) return "below_average";
    return "well_below_average";
  };

  const handleSave = () => {
    if (!finalLevel || !finalShuttle || !terminationReason || !rpe) {
      toast.error("Please complete: Final Level, Final Shuttle, Termination Reason, and RPE");
      return;
    }

    const msftResultString = `Level ${finalLevel} Shuttle ${finalShuttle}`;

    const soapText = [
      `• 20m Shuttle Run (Beep Test)`,
      `  Result: Level ${finalLevel} Shuttle ${finalShuttle}${totalShuttles ? ` (${totalShuttles} total shuttles)` : ''}`,
      calculateVO2Max() ? `  Estimated VO2max: ${calculateVO2Max()} ml/kg/min` : null,
      peakHr ? `  Peak HR: ${peakHr} bpm` : null,
      `  RPE: ${rpe}/20 | Termination: ${terminationReason}`,
      symptomsReported ? `  Symptoms: ${symptomsReported}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: parseFloat(finalLevel),
      additional_data: { soap_text: soapText },
      final_level: parseInt(finalLevel),
      final_shuttle: parseInt(finalShuttle),
      total_shuttles_completed: totalShuttles ? parseInt(totalShuttles) : null,
      rpe_6_20: parseInt(rpe),
      termination_reason: terminationReason,
      symptoms_reported: symptomsReported || null,
      peak_hr_bpm: peakHr ? parseInt(peakHr) : null,
      notes_deviation: protocolNotes || null,
      msft_result_string: msftResultString,
      estimated_vo2max: calculateVO2Max(),
      normative_comparison: getNormativeComparison(),
      assessment_date: new Date().toISOString().split('T')[0],
      notes: [
        symptomsReported && `Symptoms: ${symptomsReported}`,
        protocolNotes && `Protocol Notes: ${protocolNotes}`
      ].filter(Boolean).join('\n')
    });

    toast.success("Beep Test results saved");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-yellow-50 to-orange-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">20m Shuttle Run (Beep Test)</h2>
              <p className="text-slate-600 mt-1">Maximal multistage fitness assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">

            {/* Clinician Instructions */}
            <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0">
              <CardContent className="pt-4 space-y-2 text-sm">
                <p className="font-bold text-base">📋 Clinician Instructions</p>
                <p><strong>Setup:</strong> Mark a flat 20m course with cones. Ensure the official beep test audio is ready (see app links below). Brief participant on the protocol.</p>
                <p><strong>Protocol:</strong> Participant runs 20m shuttles in time with audio beeps. Speed increases each level (~0.5 km/h). Test ends when participant fails to reach the line before the beep on 2 consecutive shuttles.</p>
                <p><strong>Termination criteria:</strong> Participant requests stop, clinician stops for safety, or 2 consecutive missed beeps.</p>
                <p className="italic text-blue-100">"Run to the line before the beep. Turn and run back. If you miss the line twice in a row, the test is complete."</p>
                <p><strong>Recording:</strong> Record the last fully completed level and shuttle number.</p>
              </CardContent>
            </Card>

            {/* Beep Audio Apps */}
            <Card className="bg-amber-50 border-amber-300">
              <CardContent className="pt-4">
                <p className="font-semibold text-amber-900 mb-2">🔊 Beep Test Audio — Where to Get It</p>
                <p className="text-sm text-amber-800 mb-3">You need the official 20m beep test audio to run this assessment. Download a verified app:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <a href="https://apps.apple.com/au/app/beep-test/id377146560" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-black text-white rounded-lg px-3 py-2 text-sm hover:bg-gray-800 transition-colors">
                    <span className="text-lg">ðŸŽ</span>
                    <div><p className="font-semibold">App Store (iOS)</p><p className="text-xs text-gray-300">Search "Beep Test" or "Multistage Fitness"</p></div>
                  </a>
                  <a href="https://play.google.com/store/search?q=beep+test&c=apps" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-green-700 text-white rounded-lg px-3 py-2 text-sm hover:bg-green-800 transition-colors">
                    <span className="text-lg">🤖</span>
                    <div><p className="font-semibold">Google Play (Android)</p><p className="text-xs text-green-200">Search "Beep Test" or "MSFT"</p></div>
                  </a>
                </div>
                <p className="text-xs text-amber-700 mt-2">Recommended: "Beep Test" by Fusion Sport, or "Sports Beep Test" — ensure it uses the 20m standard (Léger protocol).</p>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Test Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p>Run 20m shuttles in time with the beeps. Speed increases each level. Test ends when participant can't keep pace for 2 consecutive shuttles.</p>
                <p><strong>Setup:</strong> Flat surface, 20m course marked with cones at each end. Use the official Beep Test audio track. Participants must reach the line on or before each beep.</p>
                <p className="italic">"Run to the other line before the beep sounds, turn, and run back. If you miss the line twice in a row, your test is complete."</p>
                <p><strong>Starting speed:</strong> Level 1 = 8.5 km/h. Increases ~0.5 km/h per level. Record last fully completed level and shuttle number.</p>
              </CardContent>
            </Card>

            {/* Norms */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Normative Levels (Beep Test) by Age & Sex</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Age</th><th className="p-2 text-center">Men Avg Level</th><th className="p-2 text-center">Women Avg Level</th><th className="p-2 text-center">Elite (Men)</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">17–20</td><td className="p-2 text-center">11–12</td><td className="p-2 text-center">9–10</td><td className="p-2 text-center">≥14</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">21–30</td><td className="p-2 text-center">10–12</td><td className="p-2 text-center">8–10</td><td className="p-2 text-center">≥13</td></tr>
                    <tr className="border-t"><td className="p-2">31–40</td><td className="p-2 text-center">9–11</td><td className="p-2 text-center">7–9</td><td className="p-2 text-center">≥12</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">41–50</td><td className="p-2 text-center">8–10</td><td className="p-2 text-center">6–8</td><td className="p-2 text-center">≥11</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">VO2max: Ramsbottom equation = 31.025 + 3.238×Level − 3.248×Age + 0.1536×(Level×Age). Source: Ramsbottom et al. (1988).</p>
            </div>

            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 References</p>
              <p>• Léger LA, Mercier D, Gadoury C, Lambert J. (1988). The multistage 20 metre shuttle run test for aerobic fitness. <em>Journal of Sports Sciences, 6</em>(2), 93–101. doi:10.1080/02640418808729800</p>
              <p>• Ramsbottom R, Brewer J, Williams C. (1988). A progressive shuttle run test to estimate maximal oxygen uptake. <em>British Journal of Sports Medicine, 22</em>(4), 141–144.</p>
              <p>• Tomkinson GR, Léger LA, Olds TS, Cazorla G. (2003). Secular trends in the performance of children and adolescents (1980–2000). <em>Sports Medicine, 33</em>(4), 285–300.</p>
              <p className="pt-1 border-t border-slate-300 text-slate-500"><strong>VO₂max estimation:</strong> Ramsbottom equation — 31.025 + (3.238 × Level) − (3.248 × Age) + (0.1536 × Level × Age). Note: shuttle speed starts at 8.5 km/h (Level 1) and increases by ~0.5 km/h each level.</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Final Level *</Label>
                    <Input
                      type="number"
                      value={finalLevel}
                      onChange={(e) => setFinalLevel(e.target.value)}
                      placeholder="e.g., 9"
                      min="1"
                      max="21"
                      className="mt-1 text-xl font-bold"
                    />
                  </div>
                  <div>
                    <Label>Final Shuttle *</Label>
                    <Input
                      type="number"
                      value={finalShuttle}
                      onChange={(e) => setFinalShuttle(e.target.value)}
                      placeholder="e.g., 5"
                      min="1"
                      max="20"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label>Total Shuttles Completed</Label>
                  <Input
                    type="number"
                    value={totalShuttles}
                    onChange={(e) => setTotalShuttles(e.target.value)}
                    placeholder="e.g., 78"
                    className="mt-1"
                  />
                </div>

                {finalLevel && (
                  <div className="p-4 bg-yellow-50 rounded-lg border-2 border-yellow-200">
                    <p className="text-sm text-yellow-700">Estimated VO₂max</p>
                    <p className="text-3xl font-bold text-yellow-900">{calculateVO2Max()} ml/kg/min</p>
                  </div>
                )}

                <div>
                  <Label>Peak Heart Rate (bpm)</Label>
                  <Input
                    type="number"
                    value={peakHr}
                    onChange={(e) => setPeakHr(e.target.value)}
                    placeholder="e.g., 182"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>RPE (6–20) *</Label>
                  <Input
                    type="number"
                    value={rpe}
                    onChange={(e) => setRPE(e.target.value)}
                    placeholder="e.g., 19"
                    min="6"
                    max="20"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Reason for Termination *</Label>
                  <Select value={terminationReason} onValueChange={setTerminationReason}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Exhaustion (participant reached max)">Exhaustion (participant reached max)</SelectItem>
                      <SelectItem value="Participant request to stop">Participant request to stop</SelectItem>
                      <SelectItem value="Clinician stop (safety)">Clinician stop (safety)</SelectItem>
                      <SelectItem value="Pain limitation">Pain limitation</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Symptoms Reported</Label>
                  <Textarea
                    value={symptomsReported}
                    onChange={(e) => setSymptomsReported(e.target.value)}
                    placeholder="e.g., dizziness, chest tightness, knee pain"
                    rows={2}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Protocol Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={protocolNotes}
                  onChange={(e) => setProtocolNotes(e.target.value)}
                  placeholder="e.g., outdoor surface, minor hamstring tightness, audio interruption"
                  rows={2}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave}
            disabled={!finalLevel || !finalShuttle || !terminationReason || !rpe}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}