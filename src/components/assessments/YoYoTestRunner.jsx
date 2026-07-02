import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

export default function YoYoTestRunner({ onSave, onClose }) {
  const [testType, setTestType] = useState('');
  const [level, setLevel] = useState('');
  const [shuttle, setShuttle] = useState('');
  const [distance, setDistance] = useState('');
  const [rpe, setRPE] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    if (!testType || !distance) {
      toast.error("Please select test type and enter distance");
      return;
    }

    onSave({
      result_value: parseFloat(distance),
      test_type: testType,
      final_level: level ? parseFloat(level) : null,
      final_shuttle: shuttle ? parseInt(shuttle) : null,
      total_distance_metres: parseFloat(distance),
      rpe: rpe ? parseInt(rpe) : null,
      notes: notes,
      assessment_date: new Date().toISOString()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-red-50 to-pink-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Yo-Yo Intermittent Recovery Test</h2>
              <p className="text-slate-600 mt-1">Intermittent high-intensity fitness</p>
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
                  Test Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800">
                <p>Perform 2Ã—20m shuttles with 10s recovery between each bout. Speed increases progressively. Record final distance completed.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <Label>Test Version</Label>
                <Select value={testType} onValueChange={setTestType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IR1">Yo-Yo IR1 (Lower intensity)</SelectItem>
                    <SelectItem value="IR2">Yo-Yo IR2 (Higher intensity)</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Total Distance (metres)</Label>
                  <Input
                    type="number"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    placeholder="e.g., 1200"
                    className="mt-1 text-xl font-bold"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Final Level</Label>
                    <Input
                      type="number"
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      placeholder="e.g., 17"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Final Shuttle</Label>
                    <Input
                      type="number"
                      value={shuttle}
                      onChange={(e) => setShuttle(e.target.value)}
                      placeholder="e.g., 6"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label>RPE (6-20)</Label>
                  <Input
                    type="number"
                    value={rpe}
                    onChange={(e) => setRPE(e.target.value)}
                    placeholder="e.g., 19"
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Performance observations, recovery quality, comparison to sport norms..."
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
            disabled={!testType || !distance}
            className="bg-red-600 hover:bg-red-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}