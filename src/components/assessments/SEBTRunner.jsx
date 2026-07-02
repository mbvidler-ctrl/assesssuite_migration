import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

const SEBT_DIRECTIONS = [
  "Anterior", "Anterolateral", "Lateral", "Posterolateral",
  "Posterior", "Posteromedial", "Medial", "Anteromedial"
];

export default function SEBTRunner({ onSave, onClose }) {
  const [legTested, setLegTested] = useState("right");
  const [legLength, setLegLength] = useState("");
  const [reaches, setReaches] = useState({});
  const [notes, setNotes] = useState("");

  const handleReachChange = (direction, value) => {
    setReaches({ ...reaches, [direction]: parseFloat(value) || 0 });
  };

  const calculateNormalizedReaches = () => {
    if (!legLength) return {};
    const length = parseFloat(legLength);
    const normalized = {};
    Object.keys(reaches).forEach(dir => {
      normalized[dir] = ((reaches[dir] / length) * 100).toFixed(1);
    });
    return normalized;
  };

  const normalizedReaches = calculateNormalizedReaches();

  const getCompositeScore = () => {
    if (!reaches.Anterior || !reaches.Posteromedial || !reaches.Posterolateral) return null;
    return (
      (parseFloat(normalizedReaches.Anterior) +
       parseFloat(normalizedReaches.Posteromedial) +
       parseFloat(normalizedReaches.Posterolateral)) / 3
    ).toFixed(1);
  };

  const compositeScore = getCompositeScore();

  const handleSave = () => {
    const reachLines = SEBT_DIRECTIONS.map(d => reaches[d] ? `  ${d}: ${reaches[d]}cm (${normalizedReaches[d]}%)` : null).filter(Boolean).join('\n');
    const soapText = `â€¢ Star Excursion Balance Test (SEBT)\n  Leg: ${legTested} | Leg Length: ${legLength}cm\n  Composite Score: ${compositeScore}%\n${reachLines}${notes ? `\n  Notes: ${notes}` : ''}`;

    onSave({
      result_value: parseFloat(compositeScore) || 0,
      additional_data: {
        soap_text: soapText,
        leg_tested: legTested,
        leg_length_cm: parseFloat(legLength),
        reach_distances: reaches,
        normalized_reaches: normalizedReaches,
        composite_score: parseFloat(compositeScore),
        y_balance_composite: compositeScore
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Star Excursion Balance Test (SEBT)</h2>
              <p className="text-slate-600 mt-1">Dynamic balance and reach assessment in 8 directions</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-4">
                <p><strong>Setup:</strong> Client stands on one leg at center of star pattern. Reach with opposite leg in 8 directions, touching toe as far as possible while maintaining balance.</p>

                {/* Star Pattern Diagram */}
                <div className="flex justify-center py-4">
                  <svg width="220" height="220" viewBox="0 0 220 220" className="bg-white rounded-lg p-2 border border-blue-300">
                    {/* Star lines */}
                    <line x1="110" y1="20" x2="110" y2="200" stroke="#3b82f6" strokeWidth="2" opacity="0.6" />
                    <line x1="20" y1="110" x2="200" y2="110" stroke="#3b82f6" strokeWidth="2" opacity="0.6" />
                    <line x1="45" y1="45" x2="175" y2="175" stroke="#3b82f6" strokeWidth="2" opacity="0.6" />
                    <line x1="175" y1="45" x2="45" y2="175" stroke="#3b82f6" strokeWidth="2" opacity="0.6" />

                    {/* Center circle */}
                    <circle cx="110" cy="110" r="12" fill="#ef4444" />

                    {/* Direction markers */}
                    <text x="110" y="35" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#1e40af">Anterior</text>
                    <text x="185" y="115" fontSize="11" fontWeight="bold" fill="#1e40af">Lateral</text>
                    <text x="110" y="205" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#1e40af">Posterior</text>
                    <text x="25" y="115" fontSize="11" fontWeight="bold" fill="#1e40af">Medial</text>
                  </svg>
                </div>

                <p><strong>Instructions:</strong> "Stand on your {legTested} leg and reach as far as you can with your {legTested === 'right' ? 'left' : 'right'} leg in the direction I indicate. Lightly touch the ground with your toe, then return to center."</p>
                <p><strong>Trials:</strong> 4 practice, then 3 recorded trials per direction. Use best of 3 for analysis.</p>
                <p><strong>Leg Length:</strong> Measure from ASIS to medial malleolus for normalization.</p>
              </CardContent>
            </Card>

            <Card className="bg-amber-50 border-amber-200">
              <CardHeader>
                <CardTitle className="text-sm text-amber-800">âš ï¸ Contraindications</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-amber-800">
                <p>Acute lower limb injury, severe ankle instability, recent surgery. Provide close supervision and spotting.</p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Leg Tested</Label>
                <Select value={legTested} onValueChange={setLegTested}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="right">Right</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Leg Length (cm) *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={legLength}
                  onChange={(e) => setLegLength(e.target.value)}
                  placeholder="ASIS to medial malleolus"
                  className="mt-1"
                />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Reach Distances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {SEBT_DIRECTIONS.map((direction) => (
                  <div key={direction} className="grid grid-cols-3 gap-4 items-center p-3 border rounded">
                    <Label className="font-semibold">{direction}</Label>
                    <div>
                      <Input
                        type="number"
                        step="0.1"
                        value={reaches[direction] || ""}
                        onChange={(e) => handleReachChange(direction, e.target.value)}
                        placeholder="cm"
                      />
                    </div>
                    <div className="text-sm">
                      {normalizedReaches[direction] ? (
                        <span className="font-semibold text-blue-600">
                          {normalizedReaches[direction]}% leg length
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {compositeScore && (
              <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-2">
                <CardHeader>
                  <CardTitle className="text-xl text-green-800">Composite Score</CardTitle>
                </CardHeader>
                <CardContent className="text-green-800">
                  <p className="text-2xl font-bold">{compositeScore}%</p>
                  <p className="text-sm mt-2">Average of Anterior, Posteromedial, and Posterolateral reaches</p>
                  <p className="text-sm mt-2">Higher scores indicate better dynamic balance and neuromuscular control.</p>
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
                  placeholder="Balance strategies, compensations, directional asymmetries, hip/knee control..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Save SEBT
          </Button>
        </div>
      </div>
    </div>
  );
}