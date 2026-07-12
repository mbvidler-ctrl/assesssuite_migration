import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const RSA_PROTOCOLS = {
  "6 × 30 m (straight)": { sprints: 6, distance: 30, recovery: "20-30", isShuttle: false, key: "6x30" },
  "7 × 35 m (straight)": { sprints: 7, distance: 35, recovery: "25-30", isShuttle: false, key: "7x35" },
  "10 × 20 m (straight)": { sprints: 10, distance: 20, recovery: "20-30", isShuttle: false, key: "10x20" },
  "Shuttle 6 × (15 + 15 m)": { sprints: 6, distance: 30, shuttleDistance: 15, recovery: "20-30", isShuttle: true, key: "shuttle" },
};

// Map from assessment name → default protocol key
const NAME_TO_PROTOCOL = {
  "rsa_6x30": "6 × 30 m (straight)",
  "rsa_7x35": "7 × 35 m (straight)",
  "rsa_10x20": "10 × 20 m (straight)",
  "rsa_shuttle": "Shuttle 6 × (15 + 15 m)",
};

function detectProtocolFromName(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes("shuttle")) return "Shuttle 6 × (15 + 15 m)";
  if (n.includes("7") && n.includes("35")) return "7 × 35 m (straight)";
  if (n.includes("10") && n.includes("20")) return "10 × 20 m (straight)";
  if (n.includes("6") && n.includes("30")) return "6 × 30 m (straight)";
  return null;
}

export default function RSARunner({ testName, assessment, onSave, onClose, client, initialProtocolKey }) {
  const detectedProtocol = detectProtocolFromName(testName || assessment?.name);
  const [selectedProtocolName, setSelectedProtocolName] = useState(
    initialProtocolKey ? NAME_TO_PROTOCOL[initialProtocolKey] : detectedProtocol
  );
  const [sprintTimes, setSprintTimes] = useState(null);
  const [notes, setNotes] = useState('');
  const [surfaceType, setSurfaceType] = useState('');

  const protocol = selectedProtocolName ? RSA_PROTOCOLS[selectedProtocolName] : null;

  // When a protocol is confirmed, initialise sprint inputs
  const handleSelectProtocol = (name) => {
    setSelectedProtocolName(name);
    setSprintTimes(Array(RSA_PROTOCOLS[name].sprints).fill(''));
  };

  // If no protocol chosen yet, show selector
  if (!protocol || sprintTimes === null) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="p-6 border-b bg-gradient-to-r from-orange-50 to-red-50 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Repeated Sprint Ability (RSA) Test</h2>
              <p className="text-slate-600 mt-1">Select your test protocol</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
          <div className="p-6 space-y-3">
            {Object.keys(RSA_PROTOCOLS).map(name => {
              const p = RSA_PROTOCOLS[name];
              return (
                <button
                  key={name}
                  onClick={() => handleSelectProtocol(name)}
                  className={`w-full text-left border-2 rounded-xl p-4 transition-all hover:border-orange-400 hover:bg-orange-50 ${selectedProtocolName === name ? 'border-orange-500 bg-orange-50' : 'border-slate-200'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{name}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        {p.sprints} sprints × {p.distance}m{p.isShuttle ? ` shuttle (${p.shuttleDistance}+${p.shuttleDistance}m)` : ' straight'} · {p.recovery}s rest
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const parsedTimes = sprintTimes.map(v => parseFloat(v)).filter(v => !isNaN(v) && v > 0);

  const calculateBestTime = () => parsedTimes.length === 0 ? null : Math.min(...parsedTimes).toFixed(2);
  const calculateMeanTime = () => parsedTimes.length === 0 ? null : (parsedTimes.reduce((a, t) => a + t, 0) / parsedTimes.length).toFixed(2);
  const calculateTotalTime = () => parsedTimes.length === 0 ? null : parsedTimes.reduce((a, t) => a + t, 0).toFixed(2);
  const calculateDecrement = () => {
    if (parsedTimes.length === 0) return null;
    const best = parseFloat(calculateBestTime());
    const total = parseFloat(calculateTotalTime());
    return ((100 * (total / (best * parsedTimes.length))) - 100).toFixed(2);
  };

  const handleSave = () => {
    if (parsedTimes.length === 0) {
      toast.error("Please enter at least one sprint time.");
      return;
    }

    const bestTime = parseFloat(calculateBestTime());
    const meanTime = parseFloat(calculateMeanTime());
    const totalTime = parseFloat(calculateTotalTime());
    const decrement = parseFloat(calculateDecrement());

    const soapText = [
      `• Repeated Sprint Ability Test (${selectedProtocolName})`,
      `  Best Time: ${bestTime.toFixed(2)}s | Mean Time: ${meanTime.toFixed(2)}s | Total Time: ${totalTime.toFixed(2)}s`,
      `  Fatigue Index (%Decrement): ${decrement.toFixed(2)}% (lower = better sprint maintenance)`,
      `  Sprint Times: ${parsedTimes.map(t => t.toFixed(2)).join(', ')}s`,
      surfaceType ? `  Surface: ${surfaceType}` : null,
      notes ? `  Clinical Notes: ${notes}` : null,
      `  Interpretation: FI <5% Excellent | 5-10% Good | >10% Significant fatigue`,
      `  Reference: Spencer et al. (2005). Reliability of a repeated-sprint test. J Sci Med Sport, 8(2), 197-202.`,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: bestTime,
      additional_data: {
        soap_text: soapText,
        sprint_times: parsedTimes,
        best_time: bestTime,
        mean_time: meanTime,
        total_time: totalTime,
        percentage_decrement: decrement,
        number_of_sprints: sprintTimes.length,
        distance: protocol.distance,
        is_shuttle: protocol.isShuttle,
        surface_type: surfaceType,
        protocol: selectedProtocolName,
      },
      notes: notes,
      assessment_date: todayLocal(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-orange-50 to-red-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Repeated Sprint Ability Test</h2>
              <button
                onClick={() => setSprintTimes(null)}
                className="text-sm text-orange-600 hover:underline mt-1 font-medium"
              >
                Protocol: {selectedProtocolName} · Change
              </button>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Test Setup & Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="font-semibold text-blue-900">Test Configuration</p>
                  <p className="text-sm text-blue-800"><strong>Distance:</strong> {protocol.distance}m {protocol.isShuttle ? `(${protocol.shuttleDistance} + ${protocol.shuttleDistance}m shuttle)` : "(straight)"}</p>
                  <p className="text-sm text-blue-800"><strong>Number of sprints:</strong> {protocol.sprints}</p>
                  <p className="text-sm text-blue-800"><strong>Recovery interval:</strong> {protocol.recovery} seconds between sprints</p>
                </div>
                <div className="space-y-2 pt-3 border-t border-blue-300">
                  <p className="font-semibold text-blue-900">Instructions</p>
                  <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                    {protocol.isShuttle ? (
                      <>
                        <li>Mark two cones {protocol.shuttleDistance}m apart; athlete sprints to the far cone and back</li>
                        <li>Time is recorded for each complete shuttle (there and back = {protocol.distance}m total)</li>
                      </>
                    ) : (
                      <li>Mark the testing distance with cones at start and {protocol.distance}m finish</li>
                    )}
                    <li>Perform maximal-effort sprints with passive recovery between efforts</li>
                    <li>Allow {protocol.recovery}s passive rest between each sprint</li>
                    <li>Record to nearest 0.01 second for accuracy</li>
                    <li>If experiencing chest pain, severe dizziness, or unusual symptoms — stop immediately</li>
                  </ul>
                </div>
                <div className="space-y-2 pt-3 border-t border-blue-300">
                  <p className="font-semibold text-blue-900">Interpretation</p>
                  <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                    <li><strong>Peak (Best) Time:</strong> Fastest sprint — indicates maximum speed</li>
                    <li><strong>Mean Time:</strong> Average across all sprints — overall sprint capacity</li>
                    <li><strong>% Decrement:</strong> Fatigue index showing performance maintenance</li>
                    <li>&lt;5%: Excellent fatigue resistance | 5–10%: Good | &gt;10%: Significant fatigue</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Test Details</CardTitle></CardHeader>
              <CardContent>
                <Label>Surface Type</Label>
                <Input value={surfaceType} onChange={(e) => setSurfaceType(e.target.value)} placeholder="e.g., grass, synthetic turf, indoor court" className="mt-1" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Sprint Times</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {sprintTimes.map((val, index) => (
                    <div key={index}>
                      <Label className="text-sm">Sprint {index + 1} (s)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={val}
                        onChange={e => {
                          const updated = [...sprintTimes];
                          updated[index] = e.target.value;
                          setSprintTimes(updated);
                        }}
                        placeholder="e.g. 4.50"
                        className="mt-1"
                      />
                    </div>
                  ))}
                </div>

                {parsedTimes.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-green-50 border border-green-300 rounded-lg p-3 text-center">
                      <p className="text-xs text-green-700 mb-1">Best Time</p>
                      <p className="text-2xl font-bold text-green-600">{calculateBestTime()}s</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 text-center">
                      <p className="text-xs text-blue-700 mb-1">Mean Time</p>
                      <p className="text-2xl font-bold text-blue-600">{calculateMeanTime()}s</p>
                    </div>
                    <div className="bg-purple-50 border border-purple-300 rounded-lg p-3 text-center">
                      <p className="text-xs text-purple-700 mb-1">Total Time</p>
                      <p className="text-2xl font-bold text-purple-600">{calculateTotalTime()}s</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-center">
                      <p className="text-xs text-amber-700 mb-1">% Decrement</p>
                      <p className="text-2xl font-bold text-amber-600">{calculateDecrement()}%</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Clinical Notes</CardTitle></CardHeader>
              <CardContent>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sprint technique, fatigue patterns, environmental conditions..." rows={3} />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={parsedTimes.length === 0} className="bg-orange-600 hover:bg-orange-700">
            <Save className="w-4 h-4 mr-2" />
            Save RSA Results
          </Button>
        </div>
      </div>
    </div>
  );
}