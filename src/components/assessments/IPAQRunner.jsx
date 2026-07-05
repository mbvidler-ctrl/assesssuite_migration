import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info } from "lucide-react";
import { toast } from "sonner";

export default function IPAQRunner({ onSave, onClose }) {
  const [vigorousDays, setVigorousDays] = useState("");
  const [vigorousMinutes, setVigorousMinutes] = useState("");
  const [moderateDays, setModerateDays] = useState("");
  const [moderateMinutes, setModerateMinutes] = useState("");
  const [walkingDays, setWalkingDays] = useState("");
  const [walkingMinutes, setWalkingMinutes] = useState("");
  const [sittingMinutes, setSittingMinutes] = useState("");
  const [notes, setNotes] = useState("");

  const calculateMETMinutes = () => {
    const vigorous = (parseInt(vigorousDays) || 0) * (parseInt(vigorousMinutes) || 0) * 8.0;
    const moderate = (parseInt(moderateDays) || 0) * (parseInt(moderateMinutes) || 0) * 4.0;
    const walking = (parseInt(walkingDays) || 0) * (parseInt(walkingMinutes) || 0) * 3.3;
    return { vigorous, moderate, walking, total: vigorous + moderate + walking };
  };

  const { vigorous, moderate, walking, total } = calculateMETMinutes();

  const getCategory = () => {
    const vDays = parseInt(vigorousDays) || 0;
    const vMins = parseInt(vigorousMinutes) || 0;
    const mDays = parseInt(moderateDays) || 0;
    const mMins = parseInt(moderateMinutes) || 0;
    const wDays = parseInt(walkingDays) || 0;
    const wMins = parseInt(walkingMinutes) || 0;

    // High
    if ((vDays >= 3 && vDays * vMins >= 1500) || (total >= 3000)) {
      return { level: 'High Physical Activity', color: 'text-green-600', bg: 'bg-green-50' };
    }
    // Moderate
    if ((vDays >= 3 && vMins >= 20) || (mDays >= 5 && mMins >= 30) || 
        (wDays >= 5 && wMins >= 30) || (total >= 600)) {
      return { level: 'Moderate Physical Activity', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    }
    // Low
    return { level: 'Low Physical Activity', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const category = getCategory();

  const handleSave = () => {
    onSave({
      result_value: total,
      additional_data: {
        soap_text: `• IPAQ (International Physical Activity Questionnaire)\n  Total: ${total.toFixed(0)} MET-min/week — ${category.level}\n  Vigorous: ${vigorous.toFixed(0)} | Moderate: ${moderate.toFixed(0)} | Walking: ${walking.toFixed(0)} MET-min/week`,
        vigorous_days: parseInt(vigorousDays) || 0,
        vigorous_minutes: parseInt(vigorousMinutes) || 0,
        moderate_days: parseInt(moderateDays) || 0,
        moderate_minutes: parseInt(moderateMinutes) || 0,
        walking_days: parseInt(walkingDays) || 0,
        walking_minutes: parseInt(walkingMinutes) || 0,
        sitting_minutes: parseInt(sittingMinutes) || 0,
        vigorous_met_mins: vigorous,
        moderate_met_mins: moderate,
        walking_met_mins: walking,
        total_met_mins: total,
        activity_category: category.level
      },
      notes: notes,
      assessment_date: new Date().toISOString()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">International Physical Activity Questionnaire (IPAQ)</h2>
              <p className="text-slate-600 mt-1">Short form - Last 7 days recall</p>
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
                  Clinician Script
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p>"I'm going to ask you about the physical activity you did in the last 7 days. Think about activities that made you breathe harder or increased your heart rate."</p>
                <p className="mt-2"><strong>Vigorous activities:</strong> Activities that make you breathe much harder (e.g., heavy lifting, aerobics, fast cycling)</p>
                <p><strong>Moderate activities:</strong> Activities that make you breathe somewhat harder (e.g., carrying light loads, cycling at regular pace)</p>
                <p><strong>Walking:</strong> Include walking at work, home, travel, and recreation</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vigorous Physical Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Days per week</Label>
                    <Input
                      type="number"
                      min="0"
                      max="7"
                      value={vigorousDays}
                      onChange={(e) => setVigorousDays(e.target.value)}
                      placeholder="0-7"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Minutes per day</Label>
                    <Input
                      type="number"
                      min="0"
                      value={vigorousMinutes}
                      onChange={(e) => setVigorousMinutes(e.target.value)}
                      placeholder="Minutes"
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Moderate Physical Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Days per week</Label>
                    <Input
                      type="number"
                      min="0"
                      max="7"
                      value={moderateDays}
                      onChange={(e) => setModerateDays(e.target.value)}
                      placeholder="0-7"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Minutes per day</Label>
                    <Input
                      type="number"
                      min="0"
                      value={moderateMinutes}
                      onChange={(e) => setModerateMinutes(e.target.value)}
                      placeholder="Minutes"
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Walking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Days per week</Label>
                    <Input
                      type="number"
                      min="0"
                      max="7"
                      value={walkingDays}
                      onChange={(e) => setWalkingDays(e.target.value)}
                      placeholder="0-7"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Minutes per day</Label>
                    <Input
                      type="number"
                      min="0"
                      value={walkingMinutes}
                      onChange={(e) => setWalkingMinutes(e.target.value)}
                      placeholder="Minutes"
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sitting Time</CardTitle>
              </CardHeader>
              <CardContent>
                <Label>Average minutes per day sitting</Label>
                <Input
                  type="number"
                  min="0"
                  value={sittingMinutes}
                  onChange={(e) => setSittingMinutes(e.target.value)}
                  placeholder="Minutes per day"
                  className="mt-1"
                />
              </CardContent>
            </Card>

            <Card className={`${category.bg} border-2`}>
              <CardHeader>
                <CardTitle className={`text-xl ${category.color}`}>
                  {category.level}
                </CardTitle>
              </CardHeader>
              <CardContent className={category.color}>
                <div className="space-y-2">
                  <p className="font-semibold text-2xl">Total: {total.toFixed(0)} MET-minutes/week</p>
                  <div className="text-sm space-y-1">
                    <p>Vigorous: {vigorous.toFixed(0)} MET-min/week</p>
                    <p>Moderate: {moderate.toFixed(0)} MET-min/week</p>
                    <p>Walking: {walking.toFixed(0)} MET-min/week</p>
                  </div>
                  {parseInt(sittingMinutes) > 480 && (
                    <p className="text-sm mt-3 p-3 bg-white/50 rounded">
                      <strong>Note:</strong> High sitting time (&gt;8 hours/day) associated with health risks regardless of physical activity level.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Barriers to activity, preferences, goals, exercise prescription considerations..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            Save IPAQ
          </Button>
        </div>
      </div>
    </div>
  );
}