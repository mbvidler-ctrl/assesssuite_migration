import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function JTARunner({ onSave, onClose, initialData }) {
  const [data, setData] = useState({
    job_title: initialData?.job_title || "",
    employer: initialData?.employer || "",
    tasks: initialData?.tasks || [],
    physical_demands: initialData?.physical_demands || {
      lifting: "",
      carrying: "",
      pushing_pulling: "",
      reaching: "",
      bending: "",
      standing: "",
      sitting: "",
      walking: "",
      climbing: ""
    },
    work_environment: initialData?.work_environment || "",
    barriers_to_rtw: initialData?.barriers_to_rtw || "",
    recommendations: initialData?.recommendations || ""
  });

  const addTask = () => {
    setData({
      ...data,
      tasks: [...data.tasks, {
        task_name: "",
        frequency: "",
        duration: "",
        force_required: "",
        postures: "",
        notes: ""
      }]
    });
  };

  const removeTask = (index) => {
    const newTasks = data.tasks.filter((_, i) => i !== index);
    setData({ ...data, tasks: newTasks });
  };

  const updateTask = (index, field, value) => {
    const newTasks = [...data.tasks];
    newTasks[index][field] = value;
    setData({ ...data, tasks: newTasks });
  };

  const updatePhysicalDemand = (field, value) => {
    setData({
      ...data,
      physical_demands: { ...data.physical_demands, [field]: value }
    });
  };

  const handleSave = () => {
    // Generate task demands summary
    const taskSummary = data.tasks.map((t, i) => 
      `${i + 1}. ${t.task_name}: ${t.frequency}, ${t.duration}${t.force_required ? ', Force: ' + t.force_required : ''}`
    ).join('\n');

    const physicalSummary = Object.entries(data.physical_demands)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
      .join(', ');

    const fullSummary = `Job: ${data.job_title}${data.employer ? ' at ' + data.employer : ''}

Tasks:
${taskSummary}

Physical Demands: ${physicalSummary}

${data.work_environment ? 'Environment: ' + data.work_environment : ''}
${data.barriers_to_rtw ? '\nBarriers: ' + data.barriers_to_rtw : ''}
${data.recommendations ? '\nRecommendations: ' + data.recommendations : ''}`;

    onSave({
      job_title: data.job_title,
      employer: data.employer,
      tasks: data.tasks,
      physical_demands: data.physical_demands,
      work_environment: data.work_environment,
      barriers_to_rtw: data.barriers_to_rtw,
      recommendations: data.recommendations,
      task_demands_summary: fullSummary
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl bg-white max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 sticky top-0 bg-white z-10 border-b">
          <div>
            <CardTitle className="text-xl font-bold">Job Task Analysis (iCare)</CardTitle>
            <p className="text-sm text-slate-600 mt-1">WorkCover return-to-work assessment</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6 p-6">
          {/* Job Information */}
          <div className="bg-blue-50 p-4 rounded-lg space-y-4">
            <h3 className="font-semibold text-blue-900 text-lg">Job Information</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="job_title">Job Title *</Label>
                <Input
                  id="job_title"
                  value={data.job_title}
                  onChange={(e) => setData({...data, job_title: e.target.value})}
                  className="mt-1"
                  placeholder="e.g., Warehouse Supervisor"
                />
              </div>
              <div>
                <Label htmlFor="employer">Employer</Label>
                <Input
                  id="employer"
                  value={data.employer}
                  onChange={(e) => setData({...data, employer: e.target.value})}
                  className="mt-1"
                  placeholder="Company name"
                />
              </div>
            </div>
          </div>

          {/* Task List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-lg">Job Tasks</h3>
              <Button type="button" onClick={addTask} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1" />
                Add Task
              </Button>
            </div>

            {data.tasks.map((task, index) => (
              <div key={index} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-semibold text-slate-900">Task {index + 1}</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTask(index)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <Label>Task Name</Label>
                    <Input
                      value={task.task_name}
                      onChange={(e) => updateTask(index, 'task_name', e.target.value)}
                      className="mt-1"
                      placeholder="e.g., Lifting boxes"
                    />
                  </div>
                  <div>
                    <Label>Frequency</Label>
                    <Input
                      value={task.frequency}
                      onChange={(e) => updateTask(index, 'frequency', e.target.value)}
                      className="mt-1"
                      placeholder="e.g., 20 times/hour"
                    />
                  </div>
                  <div>
                    <Label>Duration</Label>
                    <Input
                      value={task.duration}
                      onChange={(e) => updateTask(index, 'duration', e.target.value)}
                      className="mt-1"
                      placeholder="e.g., 4 hours/day"
                    />
                  </div>
                  <div>
                    <Label>Force Required</Label>
                    <Input
                      value={task.force_required}
                      onChange={(e) => updateTask(index, 'force_required', e.target.value)}
                      className="mt-1"
                      placeholder="e.g., 10-15kg"
                    />
                  </div>
                  <div>
                    <Label>Postures</Label>
                    <Input
                      value={task.postures}
                      onChange={(e) => updateTask(index, 'postures', e.target.value)}
                      className="mt-1"
                      placeholder="e.g., Bending, twisting"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={task.notes}
                      onChange={(e) => updateTask(index, 'notes', e.target.value)}
                      className="mt-1"
                      rows={2}
                      placeholder="Additional details..."
                    />
                  </div>
                </div>
              </div>
            ))}

            {data.tasks.length === 0 && (
              <div className="bg-slate-50 p-8 rounded-lg text-center border-2 border-dashed border-slate-300">
                <p className="text-slate-500 mb-3">No tasks added yet</p>
                <Button type="button" onClick={addTask} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Task
                </Button>
              </div>
            )}
          </div>

          {/* Physical Demands */}
          <div className="bg-green-50 p-4 rounded-lg space-y-4">
            <h3 className="font-semibold text-green-900 text-lg">Physical Demands Summary</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Lifting</Label>
                <Input
                  value={data.physical_demands.lifting}
                  onChange={(e) => updatePhysicalDemand('lifting', e.target.value)}
                  className="mt-1"
                  placeholder="e.g., Frequent up to 20kg"
                />
              </div>
              <div>
                <Label>Carrying</Label>
                <Input
                  value={data.physical_demands.carrying}
                  onChange={(e) => updatePhysicalDemand('carrying', e.target.value)}
                  className="mt-1"
                  placeholder="e.g., Occasional 15kg"
                />
              </div>
              <div>
                <Label>Pushing/Pulling</Label>
                <Input
                  value={data.physical_demands.pushing_pulling}
                  onChange={(e) => updatePhysicalDemand('pushing_pulling', e.target.value)}
                  className="mt-1"
                  placeholder="e.g., Pallet jack 100kg"
                />
              </div>
              <div>
                <Label>Reaching</Label>
                <Input
                  value={data.physical_demands.reaching}
                  onChange={(e) => updatePhysicalDemand('reaching', e.target.value)}
                  className="mt-1"
                  placeholder="e.g., Overhead frequent"
                />
              </div>
              <div>
                <Label>Bending</Label>
                <Input
                  value={data.physical_demands.bending}
                  onChange={(e) => updatePhysicalDemand('bending', e.target.value)}
                  className="mt-1"
                  placeholder="e.g., Frequent floor level"
                />
              </div>
              <div>
                <Label>Standing</Label>
                <Input
                  value={data.physical_demands.standing}
                  onChange={(e) => updatePhysicalDemand('standing', e.target.value)}
                  className="mt-1"
                  placeholder="e.g., 6 hours/day"
                />
              </div>
              <div>
                <Label>Sitting</Label>
                <Input
                  value={data.physical_demands.sitting}
                  onChange={(e) => updatePhysicalDemand('sitting', e.target.value)}
                  className="mt-1"
                  placeholder="e.g., 2 hours/day"
                />
              </div>
              <div>
                <Label>Walking</Label>
                <Input
                  value={data.physical_demands.walking}
                  onChange={(e) => updatePhysicalDemand('walking', e.target.value)}
                  className="mt-1"
                  placeholder="e.g., Frequent, uneven"
                />
              </div>
              <div>
                <Label>Climbing</Label>
                <Input
                  value={data.physical_demands.climbing}
                  onChange={(e) => updatePhysicalDemand('climbing', e.target.value)}
                  className="mt-1"
                  placeholder="e.g., Stairs occasional"
                />
              </div>
            </div>
          </div>

          {/* Work Environment */}
          <div>
            <Label htmlFor="work_environment">Work Environment</Label>
            <Textarea
              id="work_environment"
              value={data.work_environment}
              onChange={(e) => setData({...data, work_environment: e.target.value})}
              className="mt-1"
              rows={3}
              placeholder="Temperature, noise, lighting, floor surfaces, safety hazards, etc."
            />
          </div>

          {/* Barriers to RTW */}
          <div className="bg-yellow-50 p-4 rounded-lg">
            <Label htmlFor="barriers_to_rtw" className="text-yellow-900 font-semibold">Barriers to Return to Work</Label>
            <Textarea
              id="barriers_to_rtw"
              value={data.barriers_to_rtw}
              onChange={(e) => setData({...data, barriers_to_rtw: e.target.value})}
              className="mt-1"
              rows={3}
              placeholder="Physical limitations, workplace modifications needed, medical restrictions..."
            />
          </div>

          {/* Recommendations */}
          <div className="bg-purple-50 p-4 rounded-lg">
            <Label htmlFor="recommendations" className="text-purple-900 font-semibold">Recommendations</Label>
            <Textarea
              id="recommendations"
              value={data.recommendations}
              onChange={(e) => setData({...data, recommendations: e.target.value})}
              className="mt-1"
              rows={4}
              placeholder="Graduated RTW plan, workplace modifications, suitable duties, restrictions, equipment needed..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleSave} 
              disabled={!data.job_title}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Job Analysis
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}