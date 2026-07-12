import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function PatientSpecificFunctionalScalePSFSRunner({ client, onSave, onClose }) {
  const [activities, setActivities] = useState([{ name: "", score: "" }]);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleActivityChange = (index, field, value) => {
    const updatedActivities = [...activities];
    updatedActivities[index][field] = value;
    setActivities(updatedActivities);
  };

  const handleAddActivity = () => {
    setActivities([...activities, { name: "", score: "" }]);
  };

  const handleRemoveActivity = (index) => {
    const updatedActivities = activities.filter((_, i) => i !== index);
    setActivities(updatedActivities);
  };

  const handleSave = () => {
    const invalidActivity = activities.find(
      (activity) => !activity.name || activity.score === "" || isNaN(activity.score) || activity.score < 0 || activity.score > 10
    );

    if (invalidActivity) {
      toast.error("Please ensure all activities have a valid name and score between 0 and 10.");
      return;
    }

    const totalScore = activities.reduce((sum, activity) => sum + parseFloat(activity.score), 0);
    const meanScore = totalScore / activities.length;

    const additionalData = {
      activities,
      notes,
      measurement_type: "PSFS",
    };

    setIsSaving(true);
    onSave({
      status: "completed",
      result_value: meanScore,
      additional_data: additionalData,
      notes,
      assessment_date: todayLocal(),
    });
    setIsSaving(false);
    toast.success("Assessment saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Patient-Specific Functional Scale (PSFS)</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="clientName">Client Name</Label>
              <Input id="clientName" value={client.name} disabled />
            </div>
            <div>
              <Label>Activities</Label>
              {activities.map((activity, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <Input
                    className="flex-1"
                    placeholder={`Activity ${index + 1}`}
                    value={activity.name}
                    onChange={(e) => handleActivityChange(index, "name", e.target.value)}
                  />
                  <Input
                    type="number"
                    className="w-20"
                    placeholder="Score (0-10)"
                    value={activity.score}
                    onChange={(e) => handleActivityChange(index, "score", e.target.value)}
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleRemoveActivity(index)}
                    disabled={activities.length <= 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={handleAddActivity}>
                Add Activity
              </Button>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Enter any additional notes here..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-between items-center">
        <Button variant="outline" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
          Close
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Play className="animate-spin h-4 w-4 mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Assessment
            </>
          )}
        </Button>
      </div>
      </div>
    </div>
  );
}