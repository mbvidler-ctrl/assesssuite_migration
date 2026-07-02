import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Assessment } from '@/entities/Assessment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Toaster, toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function NewAssessmentCreator() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    instructions: '',
    scoring_system: '',
    unit_of_measure: '',
    contraindications: '',
    equipment_needed: '',
    conditions_indicated: '', // Stored as comma-separated string
    search_tags: '', // Stored as comma-separated string
  });
  const [normativeData, setNormativeData] = useState([]);

  const handleFormChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleCategoryChange = (value) => {
    setFormData(prev => ({ ...prev, category: value }));
  };

  const handleNormativeChange = (index, field, value) => {
    const updatedNorms = [...normativeData];
    updatedNorms[index][field] = value;
    setNormativeData(updatedNorms);
  };

  const addNormativeRow = () => {
    setNormativeData([
      ...normativeData,
      { age_min: '', age_max: '', gender: 'both', mean: '', std_dev: '', percentile_25: '', percentile_75: '' }
    ]);
  };

  const removeNormativeRow = (index) => {
    const updatedNorms = normativeData.filter((_, i) => i !== index);
    setNormativeData(updatedNorms);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.category || !formData.description) {
      toast.error('Name, Category, and Description are required.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        conditions_indicated: formData.conditions_indicated.split(',').map(s => s.trim()).filter(Boolean),
        search_tags: formData.search_tags.split(',').map(s => s.trim()).filter(Boolean),
        normative_data: normativeData.map(row => ({
          ...row,
          age_min: Number(row.age_min) || 0,
          age_max: Number(row.age_max) || 0,
          mean: Number(row.mean) || 0,
          std_dev: Number(row.std_dev) || 0,
          percentile_25: Number(row.percentile_25) || 0,
          percentile_75: Number(row.percentile_75) || 0,
        })),
      };

      await Assessment.create(payload);
      toast.success(`Assessment "${formData.name}" created successfully!`);
      navigate(createPageUrl('AssessmentLibrary'));
    } catch (error) {
      console.error('Failed to create assessment:', error);
      toast.error('An error occurred while saving the assessment.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(createPageUrl('AssessmentLibrary'))}
              className="bg-white/60 backdrop-blur-sm"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Create New Assessment</h1>
              <p className="text-slate-600">Add a custom assessment tool to your library.</p>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader><CardTitle>Core Details</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Assessment Name *</Label>
                  <Input id="name" value={formData.name} onChange={handleFormChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select onValueChange={handleCategoryChange} value={formData.category} required>
                    <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="musculoskeletal">Musculoskeletal</SelectItem>
                      <SelectItem value="neurological">Neurological</SelectItem>
                      <SelectItem value="cardio_pulmonary">Cardio & Pulmonary</SelectItem>
                      <SelectItem value="metabolic">Metabolic</SelectItem>
                      <SelectItem value="mental_health">Mental Health</SelectItem>
                      <SelectItem value="pediatric">Pediatric</SelectItem>
                      <SelectItem value="geriatric">Geriatric</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea id="description" value={formData.description} onChange={handleFormChange} required />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader><CardTitle>Implementation Details</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="instructions">Administration Instructions</Label>
                  <Textarea id="instructions" value={formData.instructions} onChange={handleFormChange} rows={5} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scoring_system">Scoring System</Label>
                  <Textarea id="scoring_system" value={formData.scoring_system} onChange={handleFormChange} />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="unit_of_measure">Unit of Measure</Label>
                        <Input id="unit_of_measure" value={formData.unit_of_measure} onChange={handleFormChange} placeholder="e.g., seconds, reps, kg" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="equipment_needed">Equipment Needed</Label>
                        <Input id="equipment_needed" value={formData.equipment_needed} onChange={handleFormChange} placeholder="e.g., Stopwatch, chair" />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="contraindications">Contraindications</Label>
                    <Textarea id="contraindications" value={formData.contraindications} onChange={handleFormChange} placeholder="Reasons not to perform this test..." />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardHeader><CardTitle>Categorization & Search</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="conditions_indicated">Indicated Conditions</Label>
                        <Input id="conditions_indicated" value={formData.conditions_indicated} onChange={handleFormChange} placeholder="Comma-separated, e.g., Fall Risk, Parkinson's" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="search_tags">Search Tags</Label>
                        <Input id="search_tags" value={formData.search_tags} onChange={handleFormChange} placeholder="Comma-separated, e.g., balance, lower limb" />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Normative Data</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addNormativeRow}><Plus className="w-4 h-4 mr-2" />Add Row</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {normativeData.map((row, index) => (
                  <div key={index} className="flex flex-wrap items-end gap-2 p-3 border rounded-lg">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
                        <div><Label>Age Min</Label><Input type="number" value={row.age_min} onChange={(e) => handleNormativeChange(index, 'age_min', e.target.value)} /></div>
                        <div><Label>Age Max</Label><Input type="number" value={row.age_max} onChange={(e) => handleNormativeChange(index, 'age_max', e.target.value)} /></div>
                        <div><Label>Gender</Label>
                            <Select value={row.gender} onValueChange={(val) => handleNormativeChange(index, 'gender', val)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="both">Both</SelectItem>
                                    <SelectItem value="male">Male</SelectItem>
                                    <SelectItem value="female">Female</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div><Label>Mean</Label><Input type="number" value={row.mean} onChange={(e) => handleNormativeChange(index, 'mean', e.target.value)} /></div>
                        <div><Label>Std Dev</Label><Input type="number" value={row.std_dev} onChange={(e) => handleNormativeChange(index, 'std_dev', e.target.value)} /></div>
                        <div><Label>25th %ile</Label><Input type="number" value={row.percentile_25} onChange={(e) => handleNormativeChange(index, 'percentile_25', e.target.value)} /></div>
                        <div><Label>75th %ile</Label><Input type="number" value={row.percentile_75} onChange={(e) => handleNormativeChange(index, 'percentile_75', e.target.value)} /></div>
                    </div>
                    <Button type="button" variant="destructive" size="icon" onClick={() => removeNormativeRow(index)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
                {normativeData.length === 0 && <p className="text-sm text-center text-slate-500 py-4">No normative data rows added.</p>}
              </CardContent>
            </Card>

            <div className="flex justify-end pt-4">
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSaving}>
                {isSaving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : (
                    <><Save className="w-4 h-4 mr-2" />Save Assessment</>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}