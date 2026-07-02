import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function EditConditionModal({ clientId, condition, onClose, onSuccess }) {
  const [orgId, setOrgId] = useState(null);
  const [formData, setFormData] = useState({
    condition_name: condition?.condition_name || '',
    condition_type: condition?.condition_type || 'primary',
    medication: condition?.medication || '',
    diagnosis_date: condition?.diagnosis_date || '',
    pain_level: condition?.pain_level?.toString() || '',
    notes: condition?.notes || ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchOrgId = async () => {
      try {
        const clientData = await base44.entities.Client.filter({ id: clientId });
        if (clientData && clientData.length > 0) {
          setOrgId(clientData[0].org_id);
        }
      } catch (error) {
        console.error('Error fetching client org_id:', error);
      }
    };
    fetchOrgId();
  }, [clientId]);

  const validate = () => {
    const newErrors = {};
    if (!formData.condition_name.trim()) {
      newErrors.condition_name = 'Condition name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (!orgId) {
      toast.error('Organization ID not found. Please try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const dataToSave = {
        ...formData,
        org_id: orgId,
        client_id: clientId,
        pain_level: formData.pain_level ? Number(formData.pain_level) : undefined
      };

      if (condition) {
        // Update existing condition
        await base44.entities.ClientCondition.update(condition.id, dataToSave);
      } else {
        // Create new condition
        await base44.entities.ClientCondition.create(dataToSave);
      }
      onSuccess();
    } catch (error) {
      console.error('Failed to save condition:', error);
      toast.error('Failed to save condition');
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

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{condition ? 'Edit Condition' : 'Add New Condition'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <Label htmlFor="condition_name">Condition Name *</Label>
            <Input
              id="condition_name"
              value={formData.condition_name}
              onChange={(e) => handleChange('condition_name', e.target.value)}
              placeholder="e.g., Left Shoulder Bursitis"
              className={errors.condition_name ? 'border-red-500' : ''}
            />
            {errors.condition_name && <p className="text-red-500 text-sm mt-1">{errors.condition_name}</p>}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="condition_type">Condition Type</Label>
              <Select value={formData.condition_type} onValueChange={(value) => handleChange('condition_type', value)}>
                <SelectTrigger id="condition_type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="comorbidity">Comorbidity</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="diagnosis_date">Diagnosis Date</Label>
              <Input
                id="diagnosis_date"
                type="date"
                value={formData.diagnosis_date}
                onChange={(e) => handleChange('diagnosis_date', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="medication">Medication</Label>
            <Input
              id="medication"
              value={formData.medication}
              onChange={(e) => handleChange('medication', e.target.value)}
              placeholder="e.g., Panadol, Diazepam"
            />
          </div>

          <div>
            <Label htmlFor="pain_level">Current Pain Level (0-10)</Label>
            <Select value={formData.pain_level?.toString() || ""} onValueChange={(value) => handleChange('pain_level', value)}>
              <SelectTrigger id="pain_level">
                <SelectValue placeholder="Select pain level" />
              </SelectTrigger>
              <SelectContent>
                {[0,1,2,3,4,5,6,7,8,9,10].map(num => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} - {num === 0 ? "No pain" : num <= 3 ? "Mild" : num <= 6 ? "Moderate" : "Severe"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="e.g., Aggravating factors, previous treatments, etc."
              rows={3}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !orgId}>
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
            ) : !orgId ? (
              'Loading...'
            ) : (
              condition ? 'Update Condition' : 'Add Condition'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}