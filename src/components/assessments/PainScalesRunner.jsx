import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

export default function PainScalesRunner({ onSave, onClose }) {
  const [scale, setScale] = useState("vas");
  const [currentPain, setCurrentPain] = useState(null);
  const [bestPain, setBestPain] = useState(null);
  const [worstPain, setWorstPain] = useState(null);
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const getInterpretation = (score) => {
    if (score === null || score === undefined) return null;
    const s = parseInt(score);
    
    if (s === 0) return { level: 'No Pain', color: 'text-green-600', bg: 'bg-green-50' };
    if (s <= 3) return { level: 'Mild Pain', color: 'text-yellow-600', bg: 'bg-yellow-50', description: 'Does not interfere with activities' };
    if (s <= 6) return { level: 'Moderate Pain', color: 'text-orange-600', bg: 'bg-orange-50', description: 'Interferes with some activities' };
    return { level: 'Severe Pain', color: 'text-red-600', bg: 'bg-red-50', description: 'Significantly interferes with daily function' };
  };

  const currentInterp = getInterpretation(currentPain);

  const handleSave = () => {
    if (currentPain === null) {
      toast.error("Please rate current pain level");
      return;
    }

    const averagePain = bestPain !== null && worstPain !== null 
      ? ((parseInt(currentPain) + parseInt(bestPain) + parseInt(worstPain)) / 3).toFixed(1)
      : currentPain;

    // Format location safely (handle both string and object types)
    const formatLocation = (loc) => {
      if (!loc) return null;
      if (typeof loc === 'string') return loc;
      if (typeof loc === 'object') {
        // If it's an array or has string representation
        if (Array.isArray(loc)) return loc.join(', ');
        return JSON.stringify(loc);
      }
      return loc;
    };

    const soapText = [
      `• Pain Rating Scales`,
      `  Current Pain: ${currentPain}/10 — ${currentInterp?.level || ''}`,
      bestPain !== null ? `  Best Pain (24h): ${bestPain}/10` : null,
      worstPain !== null ? `  Worst Pain (24h): ${worstPain}/10` : null,
      location ? `  Location: ${formatLocation(location)}` : null,
      notes ? `  Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: parseFloat(averagePain),
      additional_data: {
        soap_text: soapText,
        scale_type: scale,
        current_pain: parseInt(currentPain),
        best_pain: bestPain !== null ? parseInt(bestPain) : null,
        worst_pain: worstPain !== null ? parseInt(worstPain) : null,
        average_pain: parseFloat(averagePain),
        pain_location: typeof location === 'string' ? location : formatLocation(location),
        interpretation: currentInterp?.level
      },
      notes: notes,
      unit_of_measure: "/10",
      assessment_date: new Date().toISOString()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Pain Rating Scales</h2>
              <p className="text-slate-600 mt-1">Visual Analog Scale (VAS) / Numeric Pain Rating Scale (NPRS)</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>Hawker GA et al. (2011). Measures of adult pain: Visual Analog Scale for Pain (VAS Pain), Numeric Rating Scale for Pain (NRS Pain). <em>Arthritis Care & Research, 63</em>(S11), S240–S252.</p>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  📋 Pain Scale Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>0 = No Pain:</strong> No discomfort whatsoever</p>
                <p><strong>1-3 = Mild:</strong> Noticeable but doesn't interfere with activities</p>
                <p><strong>4-6 = Moderate:</strong> Interferes with some activities, manageable</p>
                <p><strong>7-9 = Severe:</strong> Significantly interferes with daily function</p>
                <p><strong>10 = Worst Possible:</strong> Unbearable, emergency-level pain</p>
                <p className="mt-3"><strong>Clinical Use:</strong> Track current, best (last 24h), and worst (last 24h) pain for comprehensive assessment.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pain Location</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Lower back, right lateral aspect; Right knee, anterior medial joint line..."
                  rows={2}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current Pain Level</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-11 gap-1">
                    {[0,1,2,3,4,5,6,7,8,9,10].map((num) => (
                      <Button
                        key={num}
                        type="button"
                        variant={currentPain === num ? "default" : "outline"}
                        onClick={() => setCurrentPain(num)}
                        className={`h-16 ${
                          currentPain === num 
                            ? num <= 3 ? 'bg-green-600' : num <= 6 ? 'bg-orange-500' : 'bg-red-600'
                            : ''
                        }`}
                      >
                        {num}
                      </Button>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>No Pain</span>
                    <span>Worst Possible</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Best Pain (Last 24 hours) - Optional</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-11 gap-1">
                  {[0,1,2,3,4,5,6,7,8,9,10].map((num) => (
                    <Button
                      key={num}
                      type="button"
                      variant={bestPain === num ? "default" : "outline"}
                      onClick={() => setBestPain(num)}
                      className="h-12"
                    >
                      {num}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Worst Pain (Last 24 hours) - Optional</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-11 gap-1">
                  {[0,1,2,3,4,5,6,7,8,9,10].map((num) => (
                    <Button
                      key={num}
                      type="button"
                      variant={worstPain === num ? "default" : "outline"}
                      onClick={() => setWorstPain(num)}
                      className="h-12"
                    >
                      {num}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {currentInterp && (
              <Card className={`${currentInterp.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-xl ${currentInterp.color}`}>
                    {currentInterp.level}
                  </CardTitle>
                </CardHeader>
                <CardContent className={currentInterp.color}>
                  <p className="font-semibold">Current Pain: {currentPain}/10</p>
                  {currentInterp.description && <p className="mt-2">{currentInterp.description}</p>}
                  {bestPain !== null && worstPain !== null && (
                    <div className="mt-3 p-3 bg-white/50 rounded">
                      <p><strong>Best:</strong> {bestPain}/10</p>
                      <p><strong>Worst:</strong> {worstPain}/10</p>
                      <p><strong>Average:</strong> {((parseInt(currentPain) + parseInt(bestPain) + parseInt(worstPain)) / 3).toFixed(1)}/10</p>
                    </div>
                  )}
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
                  placeholder="Pain quality (sharp, dull, burning), aggravating/easing factors, radiation, duration..."
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
            disabled={currentPain === null}
            className="bg-red-600 hover:bg-red-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Pain Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}