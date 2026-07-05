import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function PSFSRunner({ onSave, onClose }) {
  const [activities, setActivities] = useState([{ activity: "", score: "" }]);
  const [notes, setNotes] = useState("");

  const handleAddActivity = () => {
    if (activities.length >= 5) {
      toast.error("Maximum 5 activities");
      return;
    }
    setActivities([...activities, { activity: "", score: "" }]);
  };

  const handleRemoveActivity = (index) => {
    if (activities.length <= 1) {
      toast.error("At least one activity required");
      return;
    }
    setActivities(activities.filter((_, i) => i !== index));
  };

  const handleActivityChange = (index, field, value) => {
    const newActivities = [...activities];
    newActivities[index][field] = value;
    setActivities(newActivities);
  };

  const validActivities = () => activities.filter(a => a.activity && a.score);

  const calculateAverage = () => {
    const valid = validActivities();
    if (valid.length === 0) return 0;
    return (valid.reduce((sum, a) => sum + parseInt(a.score), 0) / valid.length).toFixed(1);
  };

  const average = calculateAverage();
  const isValid = () => validActivities().length > 0;

  const handleSave = () => {
    if (!isValid()) {
      toast.error("Please enter at least one activity with a score");
      return;
    }

    const valid = validActivities();
    const avg = parseFloat(average);
    const activityLines = valid.map((a, i) => `    ${i + 1}. "${a.activity}": ${a.score}/10`).join('\n');
    const soapText = [
      `• Patient-Specific Functional Scale (PSFS)`,
      `  Average Score: ${avg}/10 (${valid.length} activit${valid.length > 1 ? 'ies' : 'y'})`,
      `  Activity Scores:`,
      activityLines,
      `  MCID: A change of ≥2 points on average score (or 30% improvement per activity) is considered clinically meaningful.`,
      notes ? `  Clinical Notes: ${notes}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      status: "completed",
      result_value: avg,
      additional_data: {
        activities: valid,
        average_score: avg,
        num_activities: valid.length,
        soap_text: soapText,
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0],
    });

    toast.success("PSFS saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Patient-Specific Functional Scale (PSFS)</h2>
              <p className="text-slate-600 mt-1">Client-identified activities they have difficulty performing</p>
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
                  Clinician Guidance
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p><strong>About the PSFS:</strong> A client-specific outcome measure where the patient identifies 1–5 activities they are having difficulty performing due to their condition. Each activity is rated on an 11-point numeric scale. It is highly responsive to change and appropriate across musculoskeletal, neurological, and chronic pain presentations.</p>
                <p className="mt-2 font-semibold">Clinician Script:</p>
                <p className="italic">"I'd like you to identify up to 5 important activities that you are currently having difficulty with or are unable to perform because of your problem. For each activity, please rate your current ability on a scale from 0 to 10."</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div className="bg-white rounded p-2 border border-blue-200"><strong>0</strong> = Unable to perform the activity at all</div>
                  <div className="bg-white rounded p-2 border border-blue-200"><strong>10</strong> = Able to perform at the same level as before injury/problem</div>
                </div>
                <p className="mt-2"><strong>MCID:</strong> A change of ≥2 points on the average score represents a clinically meaningful improvement (Westaway et al., 1998; Stratford et al., 1995).</p>
                <p><strong>MDC (90%):</strong> ~2 points for the average score across most populations.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Activities</CardTitle>
                  <Button
                    type="button"
                    onClick={handleAddActivity}
                    size="sm"
                    disabled={activities.length >= 5}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Activity
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {activities.map((activity, index) => (
                  <div key={index} className="p-4 border rounded bg-slate-50 space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="font-semibold">Activity {index + 1}</Label>
                      {activities.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveActivity(index)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm">Activity Description</Label>
                      <Input
                        value={activity.activity}
                        onChange={(e) => handleActivityChange(index, 'activity', e.target.value)}
                        placeholder="e.g., Putting on socks, Climbing stairs, Lifting groceries"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Current Ability (0-10)</Label>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                          <Button
                            key={score}
                            type="button"
                            variant={activity.score === score.toString() ? "default" : "outline"}
                            onClick={() => handleActivityChange(index, 'score', score.toString())}
                            className="w-12"
                          >
                            {score}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {isValid() && (
              <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-2">
                <CardHeader>
                  <CardTitle className="text-xl text-green-800">Average Score</CardTitle>
                </CardHeader>
                <CardContent className="text-green-800">
                  <p className="text-3xl font-bold">{average} / 10</p>
                  <p className="text-sm mt-2">Based on {validActivities().length} activity/activities</p>
                  <p className="text-sm mt-3"><strong>MCID:</strong> Change of 2 points or 30% improvement indicates clinically meaningful change.</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle>Clinical Notes</CardTitle></CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Client goals, barriers to activities, treatment focus areas..."
                  rows={4}
                />
              </CardContent>
            </Card>

            <Card className="bg-slate-50 border-slate-200">
              <CardHeader><CardTitle className="text-sm text-slate-600">References</CardTitle></CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-1">
                <p>• Stratford P, et al. Assessing disability and change on individual patients: A report of a patient specific measure. <em>Physiotherapy Canada.</em> 1995;47(4):258–263.</p>
                <p>• Westaway MD, et al. Responsiveness of the PSFS in patients with low neck pain. <em>J Orthop Sports Phys Ther.</em> 1998;27(3):176–182.</p>
                <p>• Hefford C, et al. The patient-specific functional scale: Validity, reliability, and responsiveness in patients with upper extremity musculoskeletal problems. <em>J Orthop Sports Phys Ther.</em> 2012;42(2):56–65.</p>
                <p>• Horn KK, et al. The patient-specific functional scale: Psychometrics, clinimetrics, and application as a clinical outcome measure. <em>J Orthop Sports Phys Ther.</em> 2012;42(1):30–42.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isValid()} className="bg-purple-600 hover:bg-purple-700">
            <Save className="w-4 h-4 mr-2" />
            Save PSFS
          </Button>
        </div>
      </div>
    </div>
  );
}