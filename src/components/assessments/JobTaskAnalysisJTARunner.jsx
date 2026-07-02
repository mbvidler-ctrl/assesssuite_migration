import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

export default function JobTaskAnalysisJTARunner({ client, onSave, onClose }) {
  const [tasks, setTasks] = useState([]);
  const [currentTask, setCurrentTask] = useState("");
  const [observations, setObservations] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [notes, setNotes] = useState("");

  const handleAddTask = () => {
    if (!currentTask.trim()) {
      toast.error("Please enter a task description.");
      return;
    }
    setTasks((prev) => [...prev, currentTask]);
    setCurrentTask("");
    toast.success("Task added.");
  };

  const handleSave = () => {
    if (tasks.length === 0) {
      toast.error("Please add at least one task.");
      return;
    }

    const soapText = `â€¢ Job Task Analysis (JTA)\n  Tasks Analysed: ${tasks.length}\n  Tasks:\n${tasks.map(t => `  - ${t}`).join('\n')}${observations ? `\n  Observations: ${observations}` : ''}${recommendations ? `\n  Recommendations: ${recommendations}` : ''}`;
    onSave({
      status: "completed",
      result_value: tasks.length,
      additional_data: {
        soap_text: soapText,
        measurement_type: "Job Task Analysis",
        tasks,
        observations,
        recommendations,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Assessment saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Job Task Analysis (JTA)</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Add Job Task</Label>
              <div className="flex space-x-2">
                <Textarea
                  value={currentTask}
                  onChange={(e) => setCurrentTask(e.target.value)}
                  placeholder="Describe job task"
                  rows={2}
                />
                <Button onClick={handleAddTask}>Add</Button>
              </div>
            </div>
            {tasks.length > 0 && (
              <div>
                <Label>Tasks Analyzed</Label>
                <ul className="list-disc pl-5">
                  {tasks.map((task, idx) => (
                    <li key={idx}>{task}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <Label>Observations</Label>
              <Textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Enter observations"
                rows={4}
              />
            </div>
            <div>
              <Label>Recommendations</Label>
              <Textarea
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                placeholder="Enter recommendations"
                rows={4}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter notes"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onClose}>
          <X className="mr-2" />
          Close
        </Button>
        <Button onClick={handleSave}>
          <Save className="mr-2" />
          Save
        </Button>
      </div>
      </div>
    </div>
  );
}