import React, { useState } from "react";
import { todayLocal } from "@/lib/localDate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

export default function ThirtyFifteenIFTRunner({ onSave, onClose }) {
  const [vift, setVIFT] = useState('');
  const [totalStages, setTotalStages] = useState('');
  const [rpe, setRPE] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [savedData, setSavedData] = useState(null);

  const handleSave = () => {
    if (!vift) {
      toast.error("Please enter final VIFT speed");
      return;
    }

    const data = {
      result_value: parseFloat(vift),
      vift_kmh: parseFloat(vift),
      total_stages: totalStages ? parseInt(totalStages) : null,
      rpe: rpe ? parseInt(rpe) : null,
      notes: notes,
      assessment_date: todayLocal(),
      additional_data: {
        measurement_type: 'thirty_fifteen_ift',
        vift_kmh: parseFloat(vift),
        total_stages: totalStages ? parseInt(totalStages) : null,
        rpe: rpe ? parseInt(rpe) : null,
        hiit_100pct: parseFloat(vift).toFixed(1),
        hiit_110pct: (parseFloat(vift) * 1.1).toFixed(1),
        hiit_120pct: (parseFloat(vift) * 1.2).toFixed(1),
      }
    };
    onSave(data);
    setSavedData(data);
    setSaved(true);
    toast.success("30-15 IFT results saved successfully!");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">30-15 Intermittent Fitness Test</h2>
              <p className="text-slate-600 mt-1">Maximal intermittent running speed</p>
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
                <p>Run 40m shuttles for 30s at set speeds with 15s recovery. Speed increases by 0.5 km/h each stage. Record final speed (VIFT) reached at exhaustion.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Final VIFT Speed (km/h)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={vift}
                    onChange={(e) => setVIFT(e.target.value)}
                    placeholder="e.g., 18.5"
                    className="mt-1 text-2xl font-bold"
                  />
                </div>

                <div>
                  <Label>Total Stages Completed</Label>
                  <Input
                    type="number"
                    value={totalStages}
                    onChange={(e) => setTotalStages(e.target.value)}
                    placeholder="e.g., 21"
                    className="mt-1"
                  />
                </div>

                {vift && (
                  <div className="p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
                    <p className="text-sm text-indigo-700 mb-2">Suggested HIIT Speeds</p>
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold text-indigo-900">100% VIFT: {parseFloat(vift).toFixed(1)} km/h</p>
                      <p className="text-indigo-800">110% VIFT: {(parseFloat(vift) * 1.1).toFixed(1)} km/h</p>
                      <p className="text-indigo-800">120% VIFT: {(parseFloat(vift) * 1.2).toFixed(1)} km/h</p>
                    </div>
                  </div>
                )}

                <div>
                  <Label>RPE (6-20)</Label>
                  <Input
                    type="number"
                    value={rpe}
                    onChange={(e) => setRPE(e.target.value)}
                    placeholder="e.g., 20"
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
                  placeholder="Performance quality, comparison to sport norms, training recommendations..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {saved && savedData && (
          <div className="px-6 pb-2">
            <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
              <p className="font-bold text-green-800 text-lg mb-2">✓ Results Saved Successfully</p>
              <div className="text-sm text-green-700 space-y-1">
                <p><strong>Final VIFT Speed:</strong> {savedData.vift_kmh} km/h</p>
                {savedData.total_stages && <p><strong>Total Stages:</strong> {savedData.total_stages}</p>}
                {savedData.rpe && <p><strong>RPE:</strong> {savedData.rpe}/20</p>}
                <p className="text-xs mt-2 text-green-600">Results have been saved to the client's file and SOAP notes.</p>
              </div>
            </div>
          </div>
        )}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>{saved ? 'Close' : 'Cancel'}</Button>
          {!saved && (
            <Button 
              onClick={handleSave}
              disabled={!vift}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Results
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}