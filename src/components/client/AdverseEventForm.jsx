import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Upload, X, Loader2, Save, Printer, Pencil } from "lucide-react";
import { toast } from "sonner";
import { createRoot } from "react-dom/client";
import AdverseEventPrintView from "./AdverseEventPrintView";

export default function AdverseEventForm({ client, isOpen, onClose, onSubmitted, readOnly = false, existingEvent = null, onEdit }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    person_completing_form: "",
    date_became_aware: "",
    how_learned: "",
    date_of_onset: "",
    event_description: "",
    is_sae: "",
    is_aesi: "",
    
    // SAE fields
    sae_types: [],
    sae_category: "",
    sae_category_other: "",
    sae_relationship_to_activity: "",
    sae_action_taken: "",
    sae_action_reason: "",
    sae_hospitalized: "",
    sae_admission_date: "",
    sae_discharge_date: "",
    sae_primary_diagnosis: "",
    sae_other_diagnoses: "",
    sae_outcome: "",
    sae_resolution_date: "",
    sae_outcome_notes: "",
    
    // AESI fields
    aesi_type: "",
    aesi_when_occurred: "",
    aesi_relationship_to_activity: "",
    aesi_action_taken: "",
    aesi_action_reason: "",
    aesi_hospitalized: "",
    aesi_admission_date: "",
    aesi_discharge_date: "",
    aesi_primary_diagnosis: "",
    aesi_other_diagnoses: "",
    aesi_outcome: "",
    aesi_resolution_date: "",
    aesi_outcome_notes: "",
    
    clinician_acknowledgment: false,
    digital_signature: ""
  });
  
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const signatureRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (existingEvent) {
        // Populate form with existing event data (both readOnly and edit mode)
        setFormData({
          person_completing_form: existingEvent.person_completing_form || "",
          date_became_aware: existingEvent.date_became_aware || "",
          how_learned: existingEvent.how_learned || "",
          date_of_onset: existingEvent.date_of_onset || "",
          event_description: existingEvent.event_description || "",
          is_sae: existingEvent.is_sae || "",
          is_aesi: existingEvent.is_aesi || "",
          sae_types: existingEvent.sae_types || [],
          sae_category: existingEvent.sae_category || "",
          sae_category_other: existingEvent.sae_category_other || "",
          sae_relationship_to_activity: existingEvent.sae_relationship_to_activity || "",
          sae_action_taken: existingEvent.sae_action_taken || "",
          sae_action_reason: existingEvent.sae_action_reason || "",
          sae_hospitalized: existingEvent.sae_hospitalized || "",
          sae_admission_date: existingEvent.sae_admission_date || "",
          sae_discharge_date: existingEvent.sae_discharge_date || "",
          sae_primary_diagnosis: existingEvent.sae_primary_diagnosis || "",
          sae_other_diagnoses: existingEvent.sae_other_diagnoses || "",
          sae_outcome: existingEvent.sae_outcome || "",
          sae_resolution_date: existingEvent.sae_resolution_date || "",
          sae_outcome_notes: existingEvent.sae_outcome_notes || "",
          aesi_type: existingEvent.aesi_type || "",
          aesi_when_occurred: existingEvent.aesi_when_occurred || "",
          aesi_relationship_to_activity: existingEvent.aesi_relationship_to_activity || "",
          aesi_action_taken: existingEvent.aesi_action_taken || "",
          aesi_action_reason: existingEvent.aesi_action_reason || "",
          aesi_hospitalized: existingEvent.aesi_hospitalized || "",
          aesi_admission_date: existingEvent.aesi_admission_date || "",
          aesi_discharge_date: existingEvent.aesi_discharge_date || "",
          aesi_primary_diagnosis: existingEvent.aesi_primary_diagnosis || "",
          aesi_other_diagnoses: existingEvent.aesi_other_diagnoses || "",
          aesi_outcome: existingEvent.aesi_outcome || "",
          aesi_resolution_date: existingEvent.aesi_resolution_date || "",
          aesi_outcome_notes: existingEvent.aesi_outcome_notes || "",
          clinician_acknowledgment: existingEvent.clinician_acknowledgment || false,
          digital_signature: existingEvent.digital_signature || ""
        });
        setAttachments(existingEvent.attachments || []);
        // Rehydrate the saved signature onto the canvas: the canvas is
        // uncontrolled (pixels only ever come from pointer events), so an
        // existing record's stored data URL must be drawn back explicitly —
        // otherwise a completed form reopens with a blank signature even
        // though the record (and the print view) retain it.
        if (signatureRef.current) {
          const canvas = signatureRef.current;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (existingEvent.digital_signature) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0);
            img.src = existingEvent.digital_signature;
          }
        }
        if (readOnly) {
          setCurrentUser({ full_name: existingEvent.clinician_name, email: existingEvent.clinician_email, provider_number: existingEvent.clinician_provider_number });
        } else {
          base44.auth.me().then(user => setCurrentUser(user));
        }
      } else if (!existingEvent) {
        base44.auth.me().then(user => {
          setCurrentUser(user);
          setFormData(prev => ({
            ...prev,
            person_completing_form: user.full_name || user.email
          }));
        });
      }
    }
  }, [isOpen, readOnly, existingEvent]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleSAEType = (type) => {
    setFormData(prev => ({
      ...prev,
      sae_types: prev.sae_types.includes(type)
        ? prev.sae_types.filter(t => t !== type)
        : [...prev.sae_types, type]
    }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAttachments(prev => [...prev, {
        attachment_type: file.type,
        attachment_name: file.name,
        attachment_url: file_url,
        attached_date: new Date().toISOString().split('T')[0]
      }]);
      toast.success("Attachment uploaded");
    } catch (error) {
      toast.error("Failed to upload attachment");
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const getCanvasCoords = (e) => {
    const canvas = signatureRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const canvas = signatureRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoords(e);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = signatureRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (signatureRef.current) {
      const signatureData = signatureRef.current.toDataURL();
      handleChange("digital_signature", signatureData);
    }
  };

  const clearSignature = () => {
    const canvas = signatureRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    handleChange("digital_signature", "");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.event_description) {
      toast.error("Please provide an event description");
      return;
    }
    
    if (!formData.clinician_acknowledgment) {
      toast.error("Please acknowledge and verify the report");
      return;
    }
    
    setIsSaving(true);
    try {
      const eventData = {
        org_id: client.org_id,
        client_id: client.id,
        clinician_email: currentUser.email,
        clinician_name: currentUser.full_name || currentUser.email,
        clinician_provider_number: currentUser.provider_number || "",
        ...formData,
        attachments,
        supervisor_notified: false,
        supervisor_notified_date: null
      };

      if (existingEvent) {
        await base44.entities.AdverseEvent.update(existingEvent.id, eventData);
      } else {
        eventData.report_date = new Date().toISOString();
        eventData.status = "submitted";
        await base44.entities.AdverseEvent.create(eventData);
      }
      
      toast.success(existingEvent ? "Adverse event report updated" : "Adverse event report submitted");
      onSubmitted?.();
      onClose();
      resetForm();
    } catch (error) {
      console.error("Error submitting adverse event:", error);
      toast.error("Failed to submit report");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      person_completing_form: currentUser?.full_name || currentUser?.email || "",
      date_became_aware: "",
      how_learned: "",
      date_of_onset: "",
      event_description: "",
      is_sae: "",
      is_aesi: "",
      sae_types: [],
      sae_category: "",
      sae_category_other: "",
      sae_relationship_to_activity: "",
      sae_action_taken: "",
      sae_action_reason: "",
      sae_hospitalized: "",
      sae_admission_date: "",
      sae_discharge_date: "",
      sae_primary_diagnosis: "",
      sae_other_diagnoses: "",
      sae_outcome: "",
      sae_resolution_date: "",
      sae_outcome_notes: "",
      aesi_type: "",
      aesi_when_occurred: "",
      aesi_relationship_to_activity: "",
      aesi_action_taken: "",
      aesi_action_reason: "",
      aesi_hospitalized: "",
      aesi_admission_date: "",
      aesi_discharge_date: "",
      aesi_primary_diagnosis: "",
      aesi_other_diagnoses: "",
      aesi_outcome: "",
      aesi_resolution_date: "",
      aesi_outcome_notes: "",
      clinician_acknowledgment: false,
      digital_signature: ""
    });
    setAttachments([]);
    if (signatureRef.current) {
      const ctx = signatureRef.current.getContext('2d');
      ctx.clearRect(0, 0, signatureRef.current.width, signatureRef.current.height);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-6 h-6" />
            {readOnly ? "Adverse Event Report (Read Only)" : existingEvent ? "Edit Adverse Event Report" : "Adverse Event Report"}
          </DialogTitle>
          {!readOnly && (
            <p className="text-sm text-slate-600">
              Complete for protocol-defined safety events. Do NOT complete for planned hospitalizations.
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className={`space-y-6 py-4 ${readOnly ? "pointer-events-none select-none opacity-90" : ""}`}>
          {/* Clinician Details - Auto-filled */}
          <Card className="bg-blue-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Clinician Details</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <Label className="text-xs text-slate-600">Name</Label>
                <p className="font-medium">{currentUser?.full_name || currentUser?.email}</p>
              </div>
              <div>
                <Label className="text-xs text-slate-600">Provider Number</Label>
                <p className="font-medium">{currentUser?.provider_number || "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-slate-600">Contact</Label>
                <p className="font-medium">{currentUser?.email}</p>
              </div>
            </CardContent>
          </Card>

          {/* Participant Details - Auto-filled */}
          <Card className="bg-slate-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Participant Details</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <Label className="text-xs text-slate-600">Name</Label>
                <p className="font-medium">{client.full_name}</p>
              </div>
              <div>
                <Label className="text-xs text-slate-600">DOB</Label>
                <p className="font-medium">{client.date_of_birth || "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-slate-600">Client ID</Label>
                <p className="font-medium text-xs">{client.id}</p>
              </div>
            </CardContent>
          </Card>

          {/* Section 1: Potential Adverse Event */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Section 1: Potential Adverse Event</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="person_completing">1.1 Name of person completing this form</Label>
                <Input
                  id="person_completing"
                  value={formData.person_completing_form}
                  onChange={(e) => handleChange("person_completing_form", e.target.value)}
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date_aware">1.2 Date you became aware of event</Label>
                  <Input
                    id="date_aware"
                    type="date"
                    value={formData.date_became_aware}
                    onChange={(e) => handleChange("date_became_aware", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="date_onset">1.4 Date of onset of the event</Label>
                  <Input
                    id="date_onset"
                    type="date"
                    value={formData.date_of_onset}
                    onChange={(e) => handleChange("date_of_onset", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>1.3 How did you learn of this event?</Label>
                <RadioGroup value={formData.how_learned} onValueChange={(v) => handleChange("how_learned", v)}>
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="occurred_with_person" id="occurred_with" />
                      <Label htmlFor="occurred_with" className="font-normal">Event occurred while with the person</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="reported_in_person" id="reported_in_person" />
                      <Label htmlFor="reported_in_person" className="font-normal">Event was reported by the participant in-person</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="reported_phone_email" id="reported_phone" />
                      <Label htmlFor="reported_phone" className="font-normal">Event was reported over the telephone or via email</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="description">1.5 Description of the event *</Label>
                <Textarea
                  id="description"
                  value={formData.event_description}
                  onChange={(e) => handleChange("event_description", e.target.value)}
                  rows={4}
                  required
                  className="mt-1"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <Label className="font-semibold text-red-900">1.6 Is this a Serious Adverse Event (SAE)?</Label>
                  <ul className="text-xs text-red-800 mt-2 space-y-1 mb-3">
                    <li>• Death</li>
                    <li>• Life threatening illness or injury</li>
                    <li>• Required hospitalization or prolongation</li>
                    <li>• Significant disability/incapacity</li>
                  </ul>
                  <RadioGroup value={formData.is_sae} onValueChange={(v) => handleChange("is_sae", v)}>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="sae_yes" />
                        <Label htmlFor="sae_yes" className="font-normal">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="sae_no" />
                        <Label htmlFor="sae_no" className="font-normal">No</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="unsure" id="sae_unsure" />
                        <Label htmlFor="sae_unsure" className="font-normal">Unsure</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <Label className="font-semibold text-yellow-900">1.7 Is this an Adverse Event of Special Interest (AESI)?</Label>
                  <ul className="text-xs text-yellow-800 mt-2 space-y-1 mb-3">
                    <li>• Falls with/without injury</li>
                    <li>• Musculoskeletal pain/injury (≥2 days)</li>
                    <li>• Unintentional weight loss</li>
                    <li>• Adverse drug withdrawal events</li>
                    <li>• Mood alteration requiring health professional</li>
                  </ul>
                  <RadioGroup value={formData.is_aesi} onValueChange={(v) => handleChange("is_aesi", v)}>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="aesi_yes" />
                        <Label htmlFor="aesi_yes" className="font-normal">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="aesi_no" />
                        <Label htmlFor="aesi_no" className="font-normal">No</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="unsure" id="aesi_unsure" />
                        <Label htmlFor="aesi_unsure" className="font-normal">Unsure</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: SAE Details */}
          {(formData.is_sae === "yes" || formData.is_sae === "unsure") && (
            <Card className="border-red-300">
              <CardHeader className="bg-red-50">
                <CardTitle className="text-base text-red-900">Section 2: Serious Adverse Event (SAE) Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div>
                  <Label>2.1 Type of SAE (select all that apply)</Label>
                  <div className="space-y-2 mt-2">
                    {[
                      { value: "death", label: "Death" },
                      { value: "life_threatening", label: "Life threatening illness or injury" },
                      { value: "hospitalization", label: "In-patient or prolonged hospitalization" },
                      { value: "disability", label: "Significant disability or incapacity" }
                    ].map(option => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`sae_${option.value}`}
                          checked={formData.sae_types.includes(option.value)}
                          onCheckedChange={() => toggleSAEType(option.value)}
                        />
                        <Label htmlFor={`sae_${option.value}`} className="font-normal">{option.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="sae_category">2.2 Which category best defines the SAE?</Label>
                  <Select value={formData.sae_category} onValueChange={(v) => handleChange("sae_category", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accident_trauma_fracture">Accident/Trauma/Fracture</SelectItem>
                      <SelectItem value="cancer_neoplasm">Cancer/Neoplasm</SelectItem>
                      <SelectItem value="cardiovascular">Cardiovascular</SelectItem>
                      <SelectItem value="dialysis_access">Dialysis Access</SelectItem>
                      <SelectItem value="endocrine">Endocrine Disorder</SelectItem>
                      <SelectItem value="gastrointestinal">Gastrointestinal</SelectItem>
                      <SelectItem value="haematology">Haematology</SelectItem>
                      <SelectItem value="infection">Infection</SelectItem>
                      <SelectItem value="neurological">Neurological</SelectItem>
                      <SelectItem value="renal">Other Renal</SelectItem>
                      <SelectItem value="psychological_social">Psychological/Social</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.sae_category === "other" && (
                  <div>
                    <Label htmlFor="sae_other">2.3 Please specify other category</Label>
                    <Input
                      id="sae_other"
                      value={formData.sae_category_other}
                      onChange={(e) => handleChange("sae_category_other", e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <Label>2.4 Relationship of event to exercise/activity undertaken</Label>
                  <RadioGroup value={formData.sae_relationship_to_activity} onValueChange={(v) => handleChange("sae_relationship_to_activity", v)}>
                    <div className="space-y-2 mt-2">
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="unrelated" id="sae_rel_unrelated" />
                        <Label htmlFor="sae_rel_unrelated" className="font-normal text-sm">UNRELATED - No evidence of causal relationship</Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="unlikely" id="sae_rel_unlikely" />
                        <Label htmlFor="sae_rel_unlikely" className="font-normal text-sm">UNLIKELY - Little evidence of causal relationship</Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="possible" id="sae_rel_possible" />
                        <Label htmlFor="sae_rel_possible" className="font-normal text-sm">POSSIBLE - Some evidence of causal relationship</Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="probably" id="sae_rel_probably" />
                        <Label htmlFor="sae_rel_probably" className="font-normal text-sm">PROBABLY - Evidence suggests causal relationship</Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="definitely" id="sae_rel_definitely" />
                        <Label htmlFor="sae_rel_definitely" className="font-normal text-sm">DEFINITELY - Clear evidence of causal relationship</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="sae_action">2.5 What action was taken during the task and adverse event?</Label>
                  <Textarea
                    id="sae_action"
                    value={formData.sae_action_taken}
                    onChange={(e) => handleChange("sae_action_taken", e.target.value)}
                    rows={3}
                    placeholder="Details of task/event and timelines..."
                  />
                </div>

                <div>
                  <Label htmlFor="sae_reason">2.6 Reason for action taken</Label>
                  <Textarea
                    id="sae_reason"
                    value={formData.sae_action_reason}
                    onChange={(e) => handleChange("sae_action_reason", e.target.value)}
                    rows={2}
                  />
                </div>

                <div>
                  <Label>2.7 Was the participant hospitalized?</Label>
                  <RadioGroup value={formData.sae_hospitalized} onValueChange={(v) => handleChange("sae_hospitalized", v)}>
                    <div className="flex gap-6 mt-2">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="sae_hosp_yes" />
                        <Label htmlFor="sae_hosp_yes" className="font-normal">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="sae_hosp_no" />
                        <Label htmlFor="sae_hosp_no" className="font-normal">No</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="unsure" id="sae_hosp_unsure" />
                        <Label htmlFor="sae_hosp_unsure" className="font-normal">Unsure</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {formData.sae_hospitalized === "yes" && (
                  <div className="grid md:grid-cols-2 gap-4 pl-4 border-l-2 border-red-200">
                    <div>
                      <Label htmlFor="sae_admission">2.8 Hospital admission date</Label>
                      <Input
                        id="sae_admission"
                        type="date"
                        value={formData.sae_admission_date}
                        onChange={(e) => handleChange("sae_admission_date", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sae_discharge">2.9 Date of discharge/death</Label>
                      <Input
                        id="sae_discharge"
                        type="date"
                        value={formData.sae_discharge_date}
                        onChange={(e) => handleChange("sae_discharge_date", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sae_primary_dx">2.10 Primary discharge diagnosis</Label>
                      <Input
                        id="sae_primary_dx"
                        value={formData.sae_primary_diagnosis}
                        onChange={(e) => handleChange("sae_primary_diagnosis", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sae_other_dx">2.11 All other diagnoses (optional)</Label>
                      <Input
                        id="sae_other_dx"
                        value={formData.sae_other_diagnoses}
                        onChange={(e) => handleChange("sae_other_diagnoses", e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="sae_outcome">2.12 Outcome of SAE</Label>
                  <Textarea
                    id="sae_outcome"
                    value={formData.sae_outcome}
                    onChange={(e) => handleChange("sae_outcome", e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sae_resolution">2.13 If resolved, date of resolution</Label>
                    <Input
                      id="sae_resolution"
                      type="date"
                      value={formData.sae_resolution_date}
                      onChange={(e) => handleChange("sae_resolution_date", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="sae_notes">2.14 Other notes regarding outcomes</Label>
                  <Textarea
                    id="sae_notes"
                    value={formData.sae_outcome_notes}
                    onChange={(e) => handleChange("sae_outcome_notes", e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section 3: AESI Details */}
          {(formData.is_aesi === "yes" || formData.is_aesi === "unsure") && (
            <Card className="border-yellow-300">
              <CardHeader className="bg-yellow-50">
                <CardTitle className="text-base text-yellow-900">Section 3: Adverse Event of Special Interest (AESI) Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div>
                  <Label>3.2 Type of AESI</Label>
                  <RadioGroup value={formData.aesi_type} onValueChange={(v) => handleChange("aesi_type", v)}>
                    <div className="space-y-2 mt-2">
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="fall" id="aesi_fall" />
                        <Label htmlFor="aesi_fall" className="font-normal text-sm">Fall (unintentional event causing person to come to rest on ground/floor) with/without injury</Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="musculoskeletal_pain" id="aesi_msk" />
                        <Label htmlFor="aesi_msk" className="font-normal text-sm">Musculoskeletal pain/injury causing participant to seek health professional or limit ADLs for ≥2 days</Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="weight_loss" id="aesi_weight" />
                        <Label htmlFor="aesi_weight" className="font-normal text-sm">Unintentional weight loss</Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="drug_withdrawal" id="aesi_drug" />
                        <Label htmlFor="aesi_drug" className="font-normal text-sm">Adverse drug withdrawal events</Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="mood_alteration" id="aesi_mood" />
                        <Label htmlFor="aesi_mood" className="font-normal text-sm">Mood alteration (depression, anxiety, distress) requiring health professional</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="aesi_when">When has the event occurred?</Label>
                  <Textarea
                    id="aesi_when"
                    value={formData.aesi_when_occurred}
                    onChange={(e) => handleChange("aesi_when_occurred", e.target.value)}
                    rows={2}
                  />
                </div>

                <div>
                  <Label>3.3 Relationship of event to exercise/activity undertaken</Label>
                  <RadioGroup value={formData.aesi_relationship_to_activity} onValueChange={(v) => handleChange("aesi_relationship_to_activity", v)}>
                    <div className="space-y-2 mt-2">
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="unrelated" id="aesi_rel_unrelated" />
                        <Label htmlFor="aesi_rel_unrelated" className="font-normal text-sm">UNRELATED</Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="unlikely" id="aesi_rel_unlikely" />
                        <Label htmlFor="aesi_rel_unlikely" className="font-normal text-sm">UNLIKELY</Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="possible" id="aesi_rel_possible" />
                        <Label htmlFor="aesi_rel_possible" className="font-normal text-sm">POSSIBLE</Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="probably" id="aesi_rel_probably" />
                        <Label htmlFor="aesi_rel_probably" className="font-normal text-sm">PROBABLY</Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="definitely" id="aesi_rel_definitely" />
                        <Label htmlFor="aesi_rel_definitely" className="font-normal text-sm">DEFINITELY</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="aesi_action">3.4 What action was taken within the task?</Label>
                  <Textarea
                    id="aesi_action"
                    value={formData.aesi_action_taken}
                    onChange={(e) => handleChange("aesi_action_taken", e.target.value)}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="aesi_reason">3.5 Reason for action taken</Label>
                  <Textarea
                    id="aesi_reason"
                    value={formData.aesi_action_reason}
                    onChange={(e) => handleChange("aesi_action_reason", e.target.value)}
                    rows={2}
                  />
                </div>

                <div>
                  <Label>3.6 Was the participant hospitalized?</Label>
                  <RadioGroup value={formData.aesi_hospitalized} onValueChange={(v) => handleChange("aesi_hospitalized", v)}>
                    <div className="flex gap-6 mt-2">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="aesi_hosp_yes" />
                        <Label htmlFor="aesi_hosp_yes" className="font-normal">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="aesi_hosp_no" />
                        <Label htmlFor="aesi_hosp_no" className="font-normal">No</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {formData.aesi_hospitalized === "yes" && (
                  <div className="grid md:grid-cols-2 gap-4 pl-4 border-l-2 border-yellow-200">
                    <div>
                      <Label htmlFor="aesi_admission">3.7 Hospital admission date</Label>
                      <Input
                        id="aesi_admission"
                        type="date"
                        value={formData.aesi_admission_date}
                        onChange={(e) => handleChange("aesi_admission_date", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="aesi_discharge">3.8 Date of discharge/death</Label>
                      <Input
                        id="aesi_discharge"
                        type="date"
                        value={formData.aesi_discharge_date}
                        onChange={(e) => handleChange("aesi_discharge_date", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="aesi_primary_dx">3.9 Primary discharge diagnosis</Label>
                      <Input
                        id="aesi_primary_dx"
                        value={formData.aesi_primary_diagnosis}
                        onChange={(e) => handleChange("aesi_primary_diagnosis", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="aesi_other_dx">3.10 All other diagnoses (optional)</Label>
                      <Input
                        id="aesi_other_dx"
                        value={formData.aesi_other_diagnoses}
                        onChange={(e) => handleChange("aesi_other_diagnoses", e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="aesi_outcome">3.11 Outcome of AESI</Label>
                  <Textarea
                    id="aesi_outcome"
                    value={formData.aesi_outcome}
                    onChange={(e) => handleChange("aesi_outcome", e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="aesi_resolution">3.12 If resolved, date of resolution</Label>
                    <Input
                      id="aesi_resolution"
                      type="date"
                      value={formData.aesi_resolution_date}
                      onChange={(e) => handleChange("aesi_resolution_date", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="aesi_notes">3.13 Other notes regarding outcomes</Label>
                  <Textarea
                    id="aesi_notes"
                    value={formData.aesi_outcome_notes}
                    onChange={(e) => handleChange("aesi_outcome_notes", e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attachments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Attachments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <input
                  type="file"
                  id="attachment-upload"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                />
                <label htmlFor="attachment-upload">
                  <Button type="button" variant="outline" asChild disabled={isUploading}>
                    <span className="cursor-pointer">
                      {isUploading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-2" /> Add Attachment</>
                      )}
                    </span>
                  </Button>
                </label>
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                      <div>
                        <p className="text-sm font-medium">{att.attachment_name}</p>
                        <p className="text-xs text-slate-500">{att.attached_date}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(idx)}
                        className="text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Signature */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Clinician Acknowledgment & Signature</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="acknowledgment"
                  checked={formData.clinician_acknowledgment}
                  onCheckedChange={(checked) => handleChange("clinician_acknowledgment", checked)}
                />
                <Label htmlFor="acknowledgment" className="font-normal text-sm cursor-pointer">
                  As the clinician, I confirm that I have reviewed and verified this adverse event report.
                </Label>
              </div>

              <div>
                <Label>Digital Signature</Label>
                <div className="border-2 border-slate-300 rounded-lg bg-white">
                  <canvas
                    ref={signatureRef}
                    width={600}
                    height={150}
                    className="w-full cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={clearSignature} className="mt-2">
                  Clear Signature
                </Button>
              </div>
            </CardContent>
          </Card>



          {/* Submit / Read-only actions */}
          <div className="flex justify-end gap-3 pt-4 pointer-events-auto">
            {readOnly ? (
              <>
                <Button type="button" variant="outline" onClick={onClose}>
                  Close
                </Button>
                {onEdit && (
                  <Button type="button" variant="outline" onClick={onEdit}>
                    <Pencil className="w-4 h-4 mr-2" /> Edit
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => {
                  const printWindow = window.open("", "_blank");
                  if (!printWindow) { toast.error("Please allow popups to print"); return; }
                  printWindow.document.write(`<!DOCTYPE html><html><head><title>Adverse Event Report</title><style>
                    body { font-family: Arial, Helvetica, sans-serif; margin: 20mm 18mm; color: #111; }
                    @page { size: A4 portrait; margin: 20mm 18mm; }
                    @media print { body { margin: 0; } }
                  </style></head><body><div id="print-root"></div></body></html>`);
                  printWindow.document.close();
                  const root = createRoot(printWindow.document.getElementById("print-root"));
                  root.render(<AdverseEventPrintView event={existingEvent} client={client} />);
                  setTimeout(() => { printWindow.print(); }, 300);
                }}>
                  <Printer className="w-4 h-4 mr-2" /> Print
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-red-600 hover:bg-red-700"
                  disabled={isSaving || !formData.clinician_acknowledgment}
                >
                  {isSaving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {existingEvent ? "Saving..." : "Submitting..."}</>
                  ) : (
                    <><Save className="w-4 h-4 mr-2" /> {existingEvent ? "Save Changes" : "Submit Report"}</>
                  )}
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}