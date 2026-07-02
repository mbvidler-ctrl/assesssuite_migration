import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import APSSForm from '@/components/onboarding/APSSForm';
import APSSStage2 from '@/components/onboarding/APSSStage2';

export default function EditClientInfoModal({ client, section, conditions = [], onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    full_name: client.full_name || '',
    date_of_birth: client.date_of_birth || '',
    gender: client.gender || '',
    gender_other: client.gender_other || '',
    pronouns: client.pronouns || '',
    phone: client.phone || '',
    email: client.email || '',
    address: client.address || '',
    emergency_contact_name: client.emergency_contact_name || '',
    emergency_contact_phone: client.emergency_contact_phone || '',
    cultural_considerations: client.cultural_considerations || '',
    referral_source: client.referral_source || '',
    referral_source_name: client.referral_source_name || '',
    referral_source_address: client.referral_source_address || '',
    referral_source_email: client.referral_source_email || '',
    referral_provider_number: client.referral_provider_number || '',
    referral_date: client.referral_date || '',
    referral_reason: client.referral_reason || '',
    client_goals: client.client_goals || ''
  });
  
  // For medications section - track conditions with their medications
  const [medicationData, setMedicationData] = useState(
    conditions.map(c => ({
      id: c.id,
      condition_name: c.condition_name,
      medication: c.medication || '',
      originalMedication: c.medication || '',
      isExisting: true // Mark as existing condition
    }))
  );
  
  // For new medications being added
  const [newMedications, setNewMedications] = useState([]);
  
  // For additional referrals
  const [additionalReferrals, setAdditionalReferrals] = useState(
    client.additional_referrals || []
  );
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [showAPSSForm, setShowAPSSForm] = useState(false);
  const [showAPSSStage2, setShowAPSSStage2] = useState(false);
  const [apssData, setApssData] = useState({
    apss_completed: client.apss_completed || false,
    apss_stage2_completed: client.apss_stage2_completed || false,
    ...client
  });

  const validate = () => {
    const newErrors = {};
    if (section === 'personal' || section === 'all') {
      if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required';
      if (!formData.date_of_birth) newErrors.date_of_birth = 'Date of birth is required';
      if (!formData.gender) newErrors.gender = 'Gender is required';
    }
    if (section === 'contact' || section === 'all') {
      if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
      if (!formData.email.trim()) newErrors.email = 'Email is required';
      if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // For medications section, we update conditions and create new ones
    if (section === 'medications') {
      setIsSubmitting(true);
      try {
        if (!client.org_id) {
          toast.error('Client organization ID is missing. Please refresh the page.');
          return;
        }
        
        console.log('[EditClientInfoModal] Updating medications, client.org_id:', client.org_id);
        
        // Update existing conditions that have changed
        for (const med of medicationData.filter(med => med.isExisting && med.medication !== med.originalMedication)) {
          console.log('[EditClientInfoModal] Updating medication for condition:', med.id);
          // Find the original condition to get all required fields
          const originalCondition = conditions.find(c => c.id === med.id);
          if (!originalCondition) {
            console.error('Original condition not found for id:', med.id);
            continue;
          }
          await base44.entities.ClientCondition.update(med.id, { 
            org_id: originalCondition.org_id || client.org_id,
            client_id: originalCondition.client_id,
            condition_name: originalCondition.condition_name,
            condition_type: originalCondition.condition_type,
            medication: med.medication,
            is_active: originalCondition.is_active
          });
        }
        
        // Create new conditions for new medications
        for (const med of newMedications.filter(med => med.condition_name.trim() && med.medication.trim())) {
          console.log('[EditClientInfoModal] Creating new condition with org_id:', client.org_id);
          await base44.entities.ClientCondition.create({
            org_id: client.org_id,
            client_id: client.id,
            condition_name: med.condition_name,
            condition_type: 'comorbidity',
            medication: med.medication,
            is_active: true
          });
        }
        
        const newMedsCount = newMedications.filter(med => med.condition_name.trim() && med.medication.trim()).length;
        if (newMedsCount > 0) {
          toast.success(`Medications updated and ${newMedsCount} new medication(s) added`);
        } else {
          toast.success('Medications updated successfully');
        }
        onSuccess();
      } catch (error) {
        console.error('Failed to update medications:', error);
        console.error('Error details:', error?.message || error);
        toast.error(`Failed to update medications: ${error?.message || 'Unknown error'}`);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    
    // For referral section - include additional referrals
    if (section === 'referral') {
      const updateData = {
        ...formData,
        additional_referrals: additionalReferrals
      };
      
      setIsSubmitting(true);
      try {
        await base44.entities.Client.update(client.id, updateData);
        toast.success('Referral information updated successfully');
        onSuccess();
      } catch (error) {
        console.error('Failed to update referral information:', error);
        toast.error('Failed to update referral information');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    
    // For other sections, update client as usual
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await base44.entities.Client.update(client.id, formData);
      toast.success('Client information updated successfully');
      onSuccess();
    } catch (error) {
      console.error('Failed to update client:', error);
      toast.error('Failed to update client information');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleMedicationChange = (conditionId, value) => {
    setMedicationData(prev => prev.map(med => 
      med.id === conditionId ? { ...med, medication: value } : med
    ));
  };

  const handleAddNewMedication = () => {
    setNewMedications(prev => [...prev, {
      id: `new_${Date.now()}`, // Unique temporary ID for new items
      condition_name: '',
      medication: ''
    }]);
  };

  const handleNewMedicationChange = (id, field, value) => {
    setNewMedications(prev => prev.map(med =>
      med.id === id ? { ...med, [field]: value } : med
    ));
  };

  const handleRemoveNewMedication = (id) => {
    setNewMedications(prev => prev.filter(med => med.id !== id));
  };

  const handleAddReferral = () => {
    setAdditionalReferrals(prev => [...prev, {
      referral_source: '',
      referral_source_name: '',
      referral_source_address: '',
      referral_source_email: '',
      referral_provider_number: '',
      referral_reason: '',
      referral_date: ''
    }]);
  };

  const handleRemoveReferral = (index) => {
    setAdditionalReferrals(prev => prev.filter((_, i) => i !== index));
  };

  const handleReferralChange = (index, field, value) => {
    setAdditionalReferrals(prev => prev.map((ref, i) => 
      i === index ? { ...ref, [field]: value } : ref
    ));
  };

  const getSectionTitle = () => {
    switch(section) {
      case 'personal': return 'Edit Personal Information';
      case 'contact': return 'Edit Contact Details';
      case 'referral': return 'Edit Referral Information';
      case 'goals': return 'Edit Client Goals';
      case 'cultural': return 'Edit Cultural Considerations';
      case 'medications': return 'Edit Current Medications';
      case 'apss': return 'APSS Pre-Exercise Screening';
      default: return 'Edit Client Information';
    }
  };

  const handleAPSSComplete = async (apssFormData) => {
    setIsSubmitting(true);
    try {
      await base44.entities.Client.update(client.id, {
        ...apssFormData,
        apss_completed: true,
        apss_completion_date: new Date().toISOString()
      });
      setApssData(prev => ({ ...prev, ...apssFormData, apss_completed: true }));
      setShowAPSSForm(false);
      toast.success('APSS Stage 1 completed successfully');
    } catch (error) {
      console.error('Failed to save APSS:', error);
      toast.error('Failed to save APSS data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAPSSStage2Complete = async (stage2Data) => {
    setIsSubmitting(true);
    try {
      await base44.entities.Client.update(client.id, {
        ...stage2Data,
        apss_stage2_completed: true,
        apss_stage2_completion_date: new Date().toISOString()
      });
      setApssData(prev => ({ ...prev, ...stage2Data, apss_stage2_completed: true }));
      setShowAPSSStage2(false);
      toast.success('APSS Stage 2 completed successfully');
    } catch (error) {
      console.error('Failed to save APSS Stage 2:', error);
      toast.error('Failed to save APSS Stage 2 data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getSectionTitle()}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Personal Information */}
          {(section === 'personal' || section === 'all') && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 border-b pb-2">Personal Details</h3>
              
              <div>
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  className={errors.full_name ? 'border-red-500' : ''}
                />
                {errors.full_name && <p className="text-red-500 text-sm mt-1">{errors.full_name}</p>}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date_of_birth">Date of Birth *</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleChange('date_of_birth', e.target.value)}
                    className={errors.date_of_birth ? 'border-red-500' : ''}
                  />
                  {errors.date_of_birth && <p className="text-red-500 text-sm mt-1">{errors.date_of_birth}</p>}
                </div>

                <div>
                  <Label>Gender *</Label>
                  <Select value={formData.gender} onValueChange={(value) => handleChange('gender', value)}>
                    <SelectTrigger className={errors.gender ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.gender && <p className="text-red-500 text-sm mt-1">{errors.gender}</p>}
                </div>
              </div>

              {formData.gender === 'other' && (
                <div>
                  <Label htmlFor="gender_other">Please specify</Label>
                  <Input
                    id="gender_other"
                    value={formData.gender_other}
                    onChange={(e) => handleChange('gender_other', e.target.value)}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="pronouns">Preferred Pronouns</Label>
                <Input
                  id="pronouns"
                  value={formData.pronouns}
                  onChange={(e) => handleChange('pronouns', e.target.value)}
                  placeholder="e.g., they/them, she/her, he/him"
                />
              </div>
            </div>
          )}

          {/* Contact Information */}
          {(section === 'contact' || section === 'all') && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 border-b pb-2">Contact Details</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className={errors.phone ? 'border-red-500' : ''}
                  />
                  {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="address">Home Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                  <Input
                    id="emergency_contact_name"
                    value={formData.emergency_contact_name}
                    onChange={(e) => handleChange('emergency_contact_name', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
                  <Input
                    id="emergency_contact_phone"
                    type="tel"
                    value={formData.emergency_contact_phone}
                    onChange={(e) => handleChange('emergency_contact_phone', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Referral Information - UPDATED */}
          {(section === 'referral' || section === 'all') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold text-slate-900">Primary Referral Information</h3>
              </div>
              
              <div>
                <Label>Referral Source</Label>
                <Select value={formData.referral_source} onValueChange={(value) => handleChange('referral_source', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select referral source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gp">General Practitioner</SelectItem>
                    <SelectItem value="wc_case_manager">WorkCover Case Manager</SelectItem>
                    <SelectItem value="aged_care_case_manager">Aged Care Case Manager</SelectItem>
                    <SelectItem value="ndis_support_coordinator">NDIS Support Coordinator</SelectItem>
                    <SelectItem value="dva">DVA</SelectItem>
                    <SelectItem value="self_referral">Self Referral</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="referral_source_name">Referrer Name</Label>
                  <Input
                    id="referral_source_name"
                    value={formData.referral_source_name}
                    onChange={(e) => handleChange('referral_source_name', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="referral_date">Referral Date</Label>
                  <Input
                    id="referral_date"
                    type="date"
                    value={formData.referral_date}
                    onChange={(e) => handleChange('referral_date', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="referral_source_address">Referrer Address</Label>
                <Textarea
                  id="referral_source_address"
                  value={formData.referral_source_address}
                  onChange={(e) => handleChange('referral_source_address', e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="referral_source_email">Referrer Email</Label>
                  <Input
                    id="referral_source_email"
                    type="email"
                    value={formData.referral_source_email}
                    onChange={(e) => handleChange('referral_source_email', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="referral_provider_number">Provider Number</Label>
                  <Input
                    id="referral_provider_number"
                    value={formData.referral_provider_number}
                    onChange={(e) => handleChange('referral_provider_number', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="referral_reason">Referral Reason</Label>
                <Textarea
                  id="referral_reason"
                  value={formData.referral_reason}
                  onChange={(e) => handleChange('referral_reason', e.target.value)}
                  rows={3}
                />
              </div>

              {/* Additional Referrals Section */}
              <div className="space-y-4 mt-6 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Additional Referrals</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddReferral}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Referral
                  </Button>
                </div>
                <p className="text-sm text-slate-600">
                  For clients with multiple funding sources (e.g., DVA + NDIS)
                </p>

                {additionalReferrals.length > 0 && (
                  <div className="space-y-4">
                    {additionalReferrals.map((referral, index) => (
                      <div key={index} className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm font-semibold text-slate-700">
                            Additional Referral #{index + 1}
                          </Label>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleRemoveReferral(index)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>

                        <div>
                          <Label className="text-xs">Referral Source</Label>
                          <Select 
                            value={referral.referral_source} 
                            onValueChange={(value) => handleReferralChange(index, 'referral_source', value)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select source" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gp">General Practitioner</SelectItem>
                              <SelectItem value="wc_case_manager">WorkCover Case Manager</SelectItem>
                              <SelectItem value="aged_care_case_manager">Aged Care Case Manager</SelectItem>
                              <SelectItem value="ndis_support_coordinator">NDIS Support Coordinator</SelectItem>
                              <SelectItem value="dva">DVA</SelectItem>
                              <SelectItem value="self_referral">Self Referral</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Referrer Name</Label>
                            <Input
                              value={referral.referral_source_name}
                              onChange={(e) => handleReferralChange(index, 'referral_source_name', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Referral Date</Label>
                            <Input
                              type="date"
                              value={referral.referral_date}
                              onChange={(e) => handleReferralChange(index, 'referral_date', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Referrer Address</Label>
                          <Textarea
                            value={referral.referral_source_address}
                            onChange={(e) => handleReferralChange(index, 'referral_source_address', e.target.value)}
                            rows={2}
                            className="mt-1"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Referrer Email</Label>
                            <Input
                              type="email"
                              value={referral.referral_source_email}
                              onChange={(e) => handleReferralChange(index, 'referral_source_email', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Provider Number</Label>
                            <Input
                              value={referral.referral_provider_number}
                              onChange={(e) => handleReferralChange(index, 'referral_provider_number', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Referral Reason</Label>
                          <Textarea
                            value={referral.referral_reason}
                            onChange={(e) => handleReferralChange(index, 'referral_reason', e.target.value)}
                            rows={2}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {additionalReferrals.length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-4">
                    No additional referrals. Click "Add Referral" to add another funding source.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Client Goals */}
          {(section === 'goals' || section === 'all') && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 border-b pb-2">Client Goals</h3>
              
              <div>
                <Label htmlFor="client_goals">Client's Goals</Label>
                <Textarea
                  id="client_goals"
                  value={formData.client_goals}
                  onChange={(e) => handleChange('client_goals', e.target.value)}
                  placeholder="What would the client like to achieve?"
                  rows={6}
                />
              </div>
            </div>
          )}

          {/* APSS Section - Standalone */}
          {section === 'apss' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                  APSS Pre-Exercise Screening
                </h3>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {/* APSS Stage 1 */}
                <div className={`p-3 rounded-lg border-2 ${apssData.apss_completed ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">Stage 1</span>
                    {apssData.apss_completed ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Completed</span>
                    ) : (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Pending</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={apssData.apss_completed ? "outline" : "default"}
                    className="w-full"
                    onClick={() => setShowAPSSForm(true)}
                  >
                    {apssData.apss_completed ? 'Redo Stage 1' : 'Complete Stage 1'}
                  </Button>
                </div>

                {/* APSS Stage 2 */}
                <div className={`p-3 rounded-lg border-2 ${apssData.apss_stage2_completed ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">Stage 2</span>
                    {apssData.apss_stage2_completed ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Completed</span>
                    ) : (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Pending</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={apssData.apss_stage2_completed ? "outline" : "default"}
                    className="w-full"
                    onClick={() => setShowAPSSStage2(true)}
                  >
                    {apssData.apss_stage2_completed ? 'Redo Stage 2' : 'Complete Stage 2'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* APSS Stage 1 Modal */}
          {showAPSSForm && (
            <Dialog open={showAPSSForm} onOpenChange={setShowAPSSForm}>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>APSS Stage 1 - Pre-Exercise Screening</DialogTitle>
                </DialogHeader>
                <APSSForm
                  data={apssData}
                  onNext={handleAPSSComplete}
                  onBack={() => setShowAPSSForm(false)}
                  canGoBack={true}
                  isSubmitting={isSubmitting}
                />
              </DialogContent>
            </Dialog>
          )}

          {/* APSS Stage 2 Modal */}
          {showAPSSStage2 && (
            <Dialog open={showAPSSStage2} onOpenChange={setShowAPSSStage2}>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>APSS Stage 2 - Detailed Screening</DialogTitle>
                </DialogHeader>
                <APSSStage2
                  data={apssData}
                  onNext={handleAPSSStage2Complete}
                  onBack={() => setShowAPSSStage2(false)}
                  canGoBack={true}
                  isSubmitting={isSubmitting}
                />
              </DialogContent>
            </Dialog>
          )}

          {/* Cultural Considerations */}
          {(section === 'cultural' || section === 'all') && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 border-b pb-2">Cultural Considerations</h3>
              
              <div>
                <Label htmlFor="cultural_considerations">Cultural or Language Considerations</Label>
                <Textarea
                  id="cultural_considerations"
                  value={formData.cultural_considerations}
                  onChange={(e) => handleChange('cultural_considerations', e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Medications */}
          {section === 'medications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold text-slate-900">Current Medications</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddNewMedication}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Medication
                </Button>
              </div>
              <p className="text-sm text-slate-600">Edit medications for each condition below:</p>
              
              {/* Existing Medications */}
              {medicationData.length > 0 && (
                <div className="space-y-3">
                  {medicationData.map((med) => (
                    <div key={med.id} className="p-3 bg-slate-50 rounded border border-slate-200">
                      <Label className="text-sm font-semibold text-slate-700 mb-2 block">
                        {med.condition_name}
                      </Label>
                      <Textarea
                        value={med.medication}
                        onChange={(e) => handleMedicationChange(med.id, e.target.value)}
                        placeholder="Enter medication details (e.g., Paracetamol 500mg twice daily)"
                        rows={2}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* New Medications */}
              {newMedications.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700 mt-4">New Medications:</h4>
                  {newMedications.map((med) => (
                    <div key={med.id} className="p-3 bg-blue-50 rounded border-2 border-blue-200">
                      <div className="flex items-start justify-between mb-2">
                        <Label className="text-sm font-semibold text-slate-700">New Medication</Label>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => handleRemoveNewMedication(med.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs text-slate-600">Condition/Purpose</Label>
                          <Input
                            value={med.condition_name}
                            onChange={(e) => handleNewMedicationChange(med.id, 'condition_name', e.target.value)}
                            placeholder="e.g., Anxiety, Pain Relief"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-600">Medication Details</Label>
                          <Textarea
                            value={med.medication}
                            onChange={(e) => handleNewMedicationChange(med.id, 'medication', e.target.value)}
                            placeholder="Enter medication details (e.g., Paracetamol 500mg twice daily)"
                            rows={2}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {medicationData.length === 0 && newMedications.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">
                  No medications recorded. Click "Add Medication" to add one.
                </p>
              )}
            </div>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}