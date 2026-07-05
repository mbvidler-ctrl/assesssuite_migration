import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Save, Info, Activity } from "lucide-react";
import { toast } from "sonner";

export default function BorgRPERunner({ onSave, onClose }) {
  const [selectedScale, setSelectedScale] = useState("borg_6_20");
  const [selectedRating, setSelectedRating] = useState(null);
  const [activityDescription, setActivityDescription] = useState("");
  const [notes, setNotes] = useState("");

  // Borg RPE Scale (6-20)
  const borgScale = [
    { value: 6, label: "No exertion" },
    { value: 7, label: "" },
    { value: 7.5, label: "Extremely light" },
    { value: 8, label: "" },
    { value: 9, label: "Very light" },
    { value: 10, label: "" },
    { value: 11, label: "Light" },
    { value: 12, label: "" },
    { value: 13, label: "Somewhat hard" },
    { value: 14, label: "" },
    { value: 15, label: "Hard (heavy)" },
    { value: 16, label: "" },
    { value: 17, label: "Very hard" },
    { value: 18, label: "" },
    { value: 19, label: "Extremely hard" },
    { value: 20, label: "Maximum exertion" }
  ];

  // Modified Borg CR10 Scale
  const cr10Scale = [
    { value: 0, label: "No exertion (at rest)", range: "0" },
    { value: 1, label: "Very light", range: "1" },
    { value: 2, label: "Light", range: "2-3" },
    { value: 3, label: "Light", range: "2-3" },
    { value: 4, label: "Moderate (somewhat hard)", range: "4-5" },
    { value: 5, label: "Moderate (somewhat hard)", range: "4-5" },
    { value: 6, label: "High (vigorous)", range: "6-7" },
    { value: 7, label: "High (vigorous)", range: "6-7" },
    { value: 8, label: "Very hard", range: "8-9" },
    { value: 9, label: "Very hard", range: "8-9" },
    { value: 10, label: "Maximum effort (highest possible)", range: "10" }
  ];

  const getInterpretation = (value, scale) => {
    if (scale === "borg_6_20") {
      if (value <= 11) return { text: "Light intensity", color: "text-green-600", bg: "bg-green-50" };
      if (value <= 14) return { text: "Moderate intensity", color: "text-yellow-600", bg: "bg-yellow-50" };
      if (value <= 17) return { text: "Hard intensity", color: "text-orange-600", bg: "bg-orange-50" };
      return { text: "Very hard to maximum", color: "text-red-600", bg: "bg-red-50" };
    } else {
      if (value <= 1) return { text: "Very light", color: "text-green-600", bg: "bg-green-50" };
      if (value <= 3) return { text: "Light", color: "text-green-600", bg: "bg-green-50" };
      if (value <= 5) return { text: "Moderate", color: "text-yellow-600", bg: "bg-yellow-50" };
      if (value <= 7) return { text: "Vigorous", color: "text-orange-600", bg: "bg-orange-50" };
      if (value <= 9) return { text: "Very hard", color: "text-red-600", bg: "bg-red-50" };
      return { text: "Maximum effort", color: "text-red-600", bg: "bg-red-50" };
    }
  };

  const handleSave = () => {
    if (selectedRating === null) {
      toast.error("Please select an RPE rating");
      return;
    }

    const interpretation = getInterpretation(selectedRating, selectedScale);
    
    const soapText = [
      `• Borg RPE Scale Assessment`,
      `  Scale: ${selectedScale === 'borg_6_20' ? 'Borg RPE (6-20)' : 'Modified CR10 (0-10)'}`,
      `  Rating: ${selectedRating} — ${interpretation.text}`,
      activityDescription ? `  Activity: ${activityDescription}` : null,
      notes ? `  Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: selectedRating,
      additional_data: {
        soap_text: soapText,
        scale_type: selectedScale,
        rpe_value: selectedRating,
        interpretation: interpretation.text,
        activity_description: activityDescription,
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  const scaleData = selectedScale === "borg_6_20" ? borgScale : cr10Scale;
  const interpretation = selectedRating !== null ? getInterpretation(selectedRating, selectedScale) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Borg RPE Scale Assessment</h2>
              <p className="text-slate-600 mt-1">Rate of Perceived Exertion</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Scale Selection */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Select RPE Scale
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={selectedScale} onValueChange={setSelectedScale}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="borg_6_20">Borg RPE (6-20)</TabsTrigger>
                    <TabsTrigger value="cr10">Modified CR10 (0-10)</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="borg_6_20" className="mt-4">
                    <div className="text-sm text-blue-800 space-y-2">
                      <p><strong>Best for:</strong> Cardiovascular exercise and general fitness</p>
                      <p><strong>Instructions:</strong> Ask the client: "On a scale of 6 to 20, where 6 is no exertion and 20 is maximum exertion, how hard do you feel you are working right now?"</p>
                      <p className="text-xs italic">Note: The scale roughly corresponds to heart rate when multiplied by 10 (e.g., RPE 15 ≈ 150 bpm)</p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="cr10" className="mt-4">
                    <div className="text-sm text-blue-800 space-y-2">
                      <p><strong>Best for:</strong> Resistance training and muscle-specific exertion</p>
                      <p><strong>Instructions:</strong> Ask the client: "On a scale of 0 to 10, where 0 is rest and 10 is the hardest you can possibly work, how hard does this feel?"</p>
                      <p className="text-xs italic">Note: This scale emphasizes breathing rate and breathlessness</p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Activity Description */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-600" />
                  Activity Being Assessed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <input
                  type="text"
                  placeholder="e.g., Treadmill walking at 5 km/h, Leg press exercise, etc."
                  value={activityDescription}
                  onChange={(e) => setActivityDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </CardContent>
            </Card>

            {/* RPE Scale Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select Perceived Exertion Rating</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {scaleData.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setSelectedRating(item.value)}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        selectedRating === item.value
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`text-2xl font-bold ${
                            selectedRating === item.value ? 'text-blue-600' : 'text-slate-900'
                          }`}>
                            {item.value}
                          </div>
                          <div>
                            <div className={`font-semibold ${
                              selectedRating === item.value ? 'text-blue-900' : 'text-slate-900'
                            }`}>
                              {item.label || "—"}
                            </div>
                            {item.range && (
                              <div className="text-xs text-slate-500">Range: {item.range}</div>
                            )}
                          </div>
                        </div>
                        {selectedRating === item.value && (
                          <Badge className="bg-blue-600">Selected</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Interpretation */}
            {interpretation && (
              <Card className={interpretation.bg + " border-2"}>
                <CardContent className="py-4">
                  <div className="text-center">
                    <p className="text-sm text-slate-600 mb-1">Interpretation</p>
                    <p className={`text-2xl font-bold ${interpretation.color}`}>
                      {interpretation.text}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Additional Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Additional Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  placeholder="Optional observations about breathing rate, sweating, muscle fatigue, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </CardContent>
            </Card>

            {/* Clinical Context */}
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="py-4">
                <div className="text-sm text-amber-800 space-y-2">
                  <p><strong>Clinical Use:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Monitor exercise intensity during cardiovascular training</li>
                    <li>Guide progression in rehabilitation programs</li>
                    <li>Useful for clients on heart rate-altering medications</li>
                    <li>Assess exertion in real-time during exercise testing</li>
                    <li>Target zones: Light (6-11 / 0-3), Moderate (12-14 / 4-5), Vigorous (15-17 / 6-7), Maximum (18-20 / 8-10)</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={selectedRating === null}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save RPE Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}