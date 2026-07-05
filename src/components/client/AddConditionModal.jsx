import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ClientCondition } from '@/entities/ClientCondition';
import { base44 } from '@/api/base44Client';

export default function AddConditionModal({ clientId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    condition_name: '',
    condition_type: 'primary',
    diagnosis_date: '',
    severity: 'mild',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  // Onboarding enrichment: debounced ICD-10-CM code suggestions for the typed
  // condition (decision-support; the clinician chooses). Degrades silently.
  const [icdSuggestions, setIcdSuggestions] = useState([]);
  const [selectedIcd, setSelectedIcd] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const term = (formData.condition_name || '').trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (term.length < 3) { setIcdSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const resp = await base44.functions.invoke('medicalLookup', { conditions: [term] });
        const payload = resp?.data ?? resp;
        const matches = payload?.conditions?.[0]?.matches || [];
        setIcdSuggestions(matches.slice(0, 5));
      } catch (e) {
        setIcdSuggestions([]);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [formData.condition_name]);

  const validate = () => {
    const newErrors = {};
    if (!formData.condition_name.trim()) {
      newErrors.condition_name = 'Condition name is required.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await ClientCondition.create({
        ...formData,
        ...(selectedIcd ? { icd10_code: selectedIcd.code, icd10_name: selectedIcd.name } : {}),
        client_id: clientId,
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to add condition:', error);
      // You could add a toast notification for error here
    }
    setIsSubmitting(false);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Condition</DialogTitle>
          <DialogDescription>Record a new medical condition for this client.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <Label htmlFor="condition_name">Condition Name *</Label>
            <Input
              id="condition_name"
              value={formData.condition_name}
              onChange={(e) => handleChange('condition_name', e.target.value)}
              placeholder="e.g., Type 2 Diabetes"
              className={errors.condition_name ? 'border-red-500' : ''}
            />
            {errors.condition_name && <p className="text-red-500 text-sm mt-1">{errors.condition_name}</p>}
            {icdSuggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="text-xs text-slate-500 w-full">Suggested ICD-10-CM codes (NIH Clinical Tables) — optional:</span>
                {icdSuggestions.map((m) => (
                  <button
                    type="button"
                    key={m.code}
                    onClick={() => { setSelectedIcd(m); handleChange('condition_name', m.name); setIcdSuggestions([]); }}
                    className="text-xs px-2 py-0.5 rounded border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  >
                    {m.code} — {m.name}
                  </button>
                ))}
              </div>
            )}
            {selectedIcd && <p className="text-xs text-green-700 mt-1">Coded as {selectedIcd.code} ({selectedIcd.name})</p>}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
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
            <Label htmlFor="severity">Severity</Label>
            <Select value={formData.severity} onValueChange={(value) => handleChange('severity', value)}>
              <SelectTrigger id="severity">
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mild">Mild</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="severe">Severe</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Add any relevant notes..."
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Condition'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}