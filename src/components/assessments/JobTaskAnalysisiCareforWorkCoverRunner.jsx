import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Plus, Info, ChevronDown, ChevronUp, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

// Frequency options
const FREQUENCY_OPTIONS = [
  { key: "I", label: "I - Infrequent", description: "Less than 20% of the time" },
  { key: "F", label: "F - Frequent", description: "20-60% of the time" },
  { key: "C", label: "C - Constant", description: "More than 60% of the time" }
];

// Physical demands checklist
const PHYSICAL_DEMANDS = [
  { id: "sitting", label: "Sitting – seated position to perform tasks" },
  { id: "standing", label: "Standing – posture throughout activity" },
  { id: "walking", label: "Walking/Running – regularity and surface" },
  { id: "sustained_posture", label: "Sustained Posture – working in same posture for periods of time" },
  { id: "bending", label: "Bending – forward bending to perform tasks" },
  { id: "trunk_twisting", label: "Trunk Twisting – while sitting/standing to complete tasks" },
  { id: "kneeling", label: "Kneeling – posture to complete tasks" },
  { id: "squatting", label: "Squatting/Crouching – posture to complete tasks" },
  { id: "climbing", label: "Climbing (stairs/ladders/structures)" },
  { id: "lifting", label: "Lifting – overhead/forward extension" },
  { id: "carrying", label: "Carrying – overhead/forward extension" },
  { id: "reaching", label: "Reaching – forward reaching/overhead reaching" },
  { id: "pushing", label: "Pushing – move objects away from the body" },
  { id: "pulling", label: "Pulling – move objects toward the body" },
  { id: "grasping", label: "Grasping – fine motor skills, regular use of hands – tools, machinery" },
  { id: "work_at_heights", label: "Work at Heights – using ladders, footstools, scaffolding" },
  { id: "driving", label: "Driving – controlling the operation of a vehicle/Foot and Hand Controls" }
];

// Environmental hazards
const ENVIRONMENTAL_HAZARDS = [
  { id: "dust", label: "Dust – exposure" },
  { id: "gases", label: "Gases – exposure" },
  { id: "fumes", label: "Fumes – exposure" },
  { id: "liquids", label: "Liquids – working with/exposure" },
  { id: "lighting", label: "Lighting – darkness/eye strain" },
  { id: "extreme_temps", label: "Extreme Temperatures – temperatures are less than 15°C or more than 35°C" },
  { id: "confined_spaces", label: "Confined Spaces – areas where work is conducted that are not designed to be entered by a person" },
  { id: "slippery_surfaces", label: "Slippery or Uneven Surfaces" },
  { id: "biological_hazards", label: "Biological Hazards – contact with body fluids, bacteria, infectious diseases" },
  { id: "ppe", label: "Wearing of Personal Protective Equipment – Administrative control for any of the above demands" }
];

export default function JobTaskAnalysisiCareforWorkCoverRunner({ client, onSave, onClose }) {
  const [expandedSection, setExpandedSection] = useState("instructions");
  
  // Job task basic info
  const [jobDate, setJobDate] = useState(todayLocal());
  const [role, setRole] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [hoursInShift, setHoursInShift] = useState("");
  const [nightshift, setNightshift] = useState("No");
  const [rosterType, setRosterType] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState("");
  const [environment, setEnvironment] = useState("");
  const [movementsRequired, setMovementsRequired] = useState("");
  const [hazards, setHazards] = useState("");
  const [equipmentNeeded, setEquipmentNeeded] = useState("");
  const [basicNotes, setBasicNotes] = useState("");

  // Three most demanding tasks
  const [topTasks, setTopTasks] = useState([
    { task: "", requirement: "", weight: "", duration: "", supportAvailable: "No" },
    { task: "", requirement: "", weight: "", duration: "", supportAvailable: "No" },
    { task: "", requirement: "", weight: "", duration: "", supportAvailable: "No" }
  ]);

  // Physical demands frequencies
  const [physicalFrequencies, setPhysicalFrequencies] = useState({});

  // Environmental hazards frequencies
  const [hazardFrequencies, setHazardFrequencies] = useState({});

  // Additional fields
  const [otherComments, setOtherComments] = useState("");
  const [clinicalObservations, setClinicalObservations] = useState("");

  const handleUpdateTopTask = (idx, field, value) => {
    setTopTasks((prev) => {
      const updated = [...prev];
      updated[idx][field] = value;
      return updated;
    });
  };

  const handlePhysicalFrequency = (demandId, frequency) => {
    setPhysicalFrequencies((prev) => ({
      ...prev,
      [demandId]: frequency
    }));
  };

  const handleHazardFrequency = (hazardId, frequency) => {
    setHazardFrequencies((prev) => ({
      ...prev,
      [hazardId]: frequency
    }));
  };

  const handleSave = () => {
    if (!role.trim()) {
      toast.error("Please enter the role.");
      return;
    }

    const completedTopTasks = topTasks.filter(t => t.task.trim()).length;
    const physicalDemandsSummary = Object.entries(physicalFrequencies)
      .filter(([_, freq]) => freq)
      .map(([demandId, freq]) => {
        const demand = PHYSICAL_DEMANDS.find(d => d.id === demandId);
        return `${demand.label}: ${freq}`;
      })
      .join("\n");

    const hazardsSummary = Object.entries(hazardFrequencies)
      .filter(([_, freq]) => freq)
      .map(([hazardId, freq]) => {
        const hazard = ENVIRONMENTAL_HAZARDS.find(h => h.id === hazardId);
        return `${hazard.label}: ${freq}`;
      })
      .join("\n");

    const soap = `• Job Task Analysis (JTA)\n  Role: ${role}\n  Date: ${jobDate}\n  Hours/Week: ${hoursInShift} hours × ${daysPerWeek} days\n\n  Role Description:\n    ${roleDescription || "Not specified"}\n\n  Environment & Movements:\n    Environment: ${environment || "Not specified"}\n    Movements: ${movementsRequired || "Not specified"}\n    Hazards: ${hazards || "Not specified"}\n    Equipment: ${equipmentNeeded || "Not specified"}\n\n  Top 3 Physically Demanding Tasks:\n${topTasks.filter(t => t.task.trim()).map((t, i) => `    ${i + 1}. ${t.task} (${t.duration || "duration not specified"})\n       Requirement: ${t.requirement}\n       Suitable duties support: ${t.supportAvailable}`).join("\n")}\n\n  Physical Demands (Frequency):\n${physicalDemandsSummary || "None recorded"}\n\n  Environmental Hazards (Frequency):\n${hazardsSummary || "None recorded"}\n\n  Clinical Observations:\n    ${clinicalObservations || "None recorded"}\n\n  Additional Comments:\n    ${otherComments || "None recorded"}\n\n  Assessment Reference: Based on Job Task Analysis standardized protocol. See https://www.icare.nsw.gov.au/employers/forms-and-resources/working-with-a-treating-doctor`;

    onSave({
      result_value: completedTopTasks,
      assessment_date: jobDate,
      additional_data: {
        soap_text: soap,
        measurement_type: "job_task_analysis",
        job_info: {
          role,
          date: jobDate,
          roleDescription,
          hoursInShift,
          nightshift,
          rosterType,
          daysPerWeek,
          environment,
          movementsRequired,
          hazards,
          equipmentNeeded
        },
        topTasks: topTasks.filter(t => t.task.trim()),
        physicalFrequencies,
        hazardFrequencies,
        clinicalObservations,
        otherComments
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-teal-50 to-cyan-50 z-10 p-5 border-b flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Job Task Analysis (JTA)</h2>
            <p className="text-slate-500 text-sm mt-0.5">Examination and breakdown of skills and demands specific to a particular task, role or duties within the workplace</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Expandable Instructions Section */}
          <button
            onClick={() => setExpandedSection(expandedSection === "instructions" ? null : "instructions")}
            className="w-full flex justify-between items-center px-4 py-3 bg-teal-50 border border-teal-200 rounded-lg font-semibold text-teal-900 hover:bg-teal-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              📋 Protocol & Resources
            </span>
            {expandedSection === "instructions" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expandedSection === "instructions" && (
            <Card className="bg-teal-50 border-teal-200">
              <CardContent className="pt-6 space-y-3 text-sm">
                <div>
                  <p className="font-semibold text-teal-900 mb-2">What is Job Task Analysis?</p>
                  <p className="text-teal-800 text-sm">Job task analysis (JTA) involves an examination and breakdown of the skills and demands specific to a particular task, role or duties within the workplace. It consists of detailed description of the physical requirements of the role including task frequency and duration, environmental factors and the equipment required to complete a role.</p>
                </div>

                <div>
                  <p className="font-semibold text-teal-900 mb-2">Who Should Complete This?</p>
                  <p className="text-teal-800 text-sm">The assessment and form should be completed by an experienced staff member or consult with a trained Allied Health professional or your broker.</p>
                </div>

                <div>
                  <p className="font-semibold text-teal-900 mb-2">Frequency Key</p>
                  <div className="space-y-1 text-teal-800 text-xs bg-white p-2 rounded border border-teal-200">
                    <p><strong>I = Infrequent:</strong> Intermittent activity exists for a short time or less than 20% of the time when performing the job</p>
                    <p><strong>F = Frequent:</strong> Activity exists between 20% and 60% of the time when performing the job</p>
                    <p><strong>C = Constant:</strong> Activity exists for more than 60% of the time when performing the job</p>
                  </div>
                </div>

                <div className="bg-white p-3 rounded border border-teal-200">
                  <p className="text-xs text-slate-700 flex gap-2">
                    <span>📚</span>
                    <span><strong>More Information:</strong> Visit <a href="https://www.icare.nsw.gov.au/employers/forms-and-resources/working-with-a-treating-doctor" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline inline-flex items-center gap-1">the resources page <ExternalLink className="w-3 h-3" /></a> for additional guidance and templates.</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Basic Job Info Section */}
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Job Task Analysis Form</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Date *</Label>
                  <Input type="date" value={jobDate} onChange={(e) => setJobDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Role *</Label>
                  <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Warehouse Manager" className="mt-1" />
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Role Description (General day to day activities)</Label>
                <Textarea value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} placeholder="Describe the general day-to-day activities..." rows={2} className="mt-1" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Hours in Shift</Label>
                  <Input type="number" value={hoursInShift} onChange={(e) => setHoursInShift(e.target.value)} placeholder="e.g. 8" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Nightshift</Label>
                  <select value={nightshift} onChange={(e) => setNightshift(e.target.value)} className="w-full mt-1 p-2 border border-slate-300 rounded text-sm">
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Roster Type</Label>
                  <Input value={rosterType} onChange={(e) => setRosterType(e.target.value)} placeholder="e.g. Rotating, Fixed, On-call" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Days Per Week</Label>
                  <Input type="number" value={daysPerWeek} onChange={(e) => setDaysPerWeek(e.target.value)} placeholder="e.g. 5" className="mt-1" />
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Environment (e.g. weather, outside work, inside lighting)</Label>
                <Textarea value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="Describe the work environment..." rows={2} className="mt-1" />
              </div>

              <div>
                <Label className="text-sm font-semibold">Basic overview of Movements required for the role</Label>
                <Textarea value={movementsRequired} onChange={(e) => setMovementsRequired(e.target.value)} placeholder="e.g. walking, heights, sustained posture, sitting" rows={2} className="mt-1" />
              </div>

              <div>
                <Label className="text-sm font-semibold">Hazards (physical or psychosocial organisational dimensions that increase risk)</Label>
                <Textarea value={hazards} onChange={(e) => setHazards(e.target.value)} placeholder="e.g. machine use, heights, chemical exposure" rows={2} className="mt-1" />
              </div>

              <div>
                <Label className="text-sm font-semibold">Equipment needed to complete task/role</Label>
                <Textarea value={equipmentNeeded} onChange={(e) => setEquipmentNeeded(e.target.value)} placeholder="List equipment required..." rows={2} className="mt-1" />
              </div>

              <div>
                <Label className="text-sm font-semibold">Notes</Label>
                <Textarea value={basicNotes} onChange={(e) => setBasicNotes(e.target.value)} placeholder="Additional notes..." rows={2} className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Three Most Physically Demanding Tasks */}
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Brief description of the three most physically demanding tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {topTasks.map((task, idx) => (
                <div key={idx} className="space-y-3 p-4 bg-white rounded border border-slate-200">
                  <p className="font-semibold text-slate-800">Task {idx + 1}</p>
                  <div>
                    <Label className="text-sm">Task</Label>
                    <Input value={task.task} onChange={(e) => handleUpdateTopTask(idx, "task", e.target.value)} placeholder="Describe the task..." className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-sm">Requirement</Label>
                    <Input value={task.requirement} onChange={(e) => handleUpdateTopTask(idx, "requirement", e.target.value)} placeholder="Physical requirements..." className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Average weight involved (kg's)</Label>
                      <Input type="number" value={task.weight} onChange={(e) => handleUpdateTopTask(idx, "weight", e.target.value)} placeholder="0" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">Weekly Average duration (hours)</Label>
                      <Input type="number" value={task.duration} onChange={(e) => handleUpdateTopTask(idx, "duration", e.target.value)} placeholder="0" className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">Suitable duties support available</Label>
                    <select value={task.supportAvailable} onChange={(e) => handleUpdateTopTask(idx, "supportAvailable", e.target.value)} className="w-full mt-1 p-2 border border-slate-300 rounded text-sm">
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Physical Demands Section */}
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Physical Demands</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {PHYSICAL_DEMANDS.map((demand) => (
                  <div key={demand.id} className="flex items-center justify-between gap-3 p-2 bg-white rounded border border-slate-200">
                    <Label className="text-sm font-medium text-slate-700 flex-1">{demand.label}</Label>
                    <div className="flex gap-2">
                      {FREQUENCY_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          onClick={() => handlePhysicalFrequency(demand.id, option.key)}
                          className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                            physicalFrequencies[demand.id] === option.key
                              ? "bg-teal-600 text-white"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                          }`}
                        >
                          {option.key}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Environmental Hazards Section */}
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Environmental Hazards</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ENVIRONMENTAL_HAZARDS.map((hazard) => (
                  <div key={hazard.id} className="flex items-center justify-between gap-3 p-2 bg-white rounded border border-slate-200">
                    <Label className="text-sm font-medium text-slate-700 flex-1">{hazard.label}</Label>
                    <div className="flex gap-2">
                      {FREQUENCY_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          onClick={() => handleHazardFrequency(hazard.id, option.key)}
                          className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                            hazardFrequencies[hazard.id] === option.key
                              ? "bg-teal-600 text-white"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                          }`}
                        >
                          {option.key}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Clinical Observations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Clinical Observations</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea value={clinicalObservations} onChange={(e) => setClinicalObservations(e.target.value)} placeholder="Document: Movement quality, pain/fatigue response, compensatory patterns, safety concerns, consistency of performance..." rows={4} className="mt-1" />
            </CardContent>
          </Card>

          {/* Other Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Other Comments or Considerations in the role</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea value={otherComments} onChange={(e) => setOtherComments(e.target.value)} placeholder="Any additional observations, workplace accommodations, safety concerns..." rows={4} className="mt-1" />
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-slate-50 flex justify-between items-center gap-2">
          <span className="text-sm text-slate-500">{role ? `${role} - ${jobDate}` : "Ready to save"}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!role} className="bg-teal-600 hover:bg-teal-700">
              <Save className="w-4 h-4 mr-2" />Save Assessment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}