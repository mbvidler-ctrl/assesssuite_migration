import React, { useState } from "react";
import { Assessment } from "@/entities/Assessment";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Trash2 } from "lucide-react";

export default function CreateAssessmentModal({ onClose, onAssessmentCreated }) {
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    instructions: "",
    scoring_system: "",
    unit_of_measure: "",
    equipment_needed: "",
    contraindications: "",
    conditions_indicated: [],
    search_tags: [],
    normative_data: [],
    references: "",
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCondition, setNewCondition] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newNorm, setNewNorm] = useState({
    age_min: "",
    age_max: "",
    gender: "",
    mean: "",
    std_dev: "",
    percentile_25: "",
    percentile_75: ""
  });

  const categories = [
    { value: "musculoskeletal", label: "Musculoskeletal" },
    { value: "neurological", label: "Neurological" },
    { value: "cardio_pulmonary", label: "Cardio & Pulmonary" },
    { value: "metabolic", label: "Metabolic" },
    { value: "mental_health", label: "Mental Health" },
    { value: "pediatric", label: "Pediatric" },
    { value: "geriatric", label: "Geriatric" },
    { value: "general", label: "General" }
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const addCondition = () => {
    if (newCondition.trim() && !formData.conditions_indicated.includes(newCondition.trim())) {
      setFormData(prev => ({
        ...prev,
        conditions_indicated: [...prev.conditions_indicated, newCondition.trim()]
      }));
      setNewCondition("");
    }
  };

  const removeCondition = (condition) => {
    setFormData(prev => ({
      ...prev,
      conditions_indicated: prev.conditions_indicated.filter(c => c !== condition)
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.search_tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        search_tags: [...prev.search_tags, newTag.trim()]
      }));
      setNewTag("");
    }
  };

  const removeTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      search_tags: prev.search_tags.filter(t => t !== tag)
    }));
  };

  const addNormativeData = () => {
    if (newNorm.age_min && newNorm.age_max && newNorm.gender) {
      const normData = {
        age_min: parseInt(newNorm.age_min),
        age_max: parseInt(newNorm.age_max),
        gender: newNorm.gender,
        mean: newNorm.mean ? parseFloat(newNorm.mean) : null,
        std_dev: newNorm.std_dev ? parseFloat(newNorm.std_dev) : null,
        percentile_25: newNorm.percentile_25 ? parseFloat(newNorm.percentile_25) : null,
        percentile_75: newNorm.percentile_75 ? parseFloat(newNorm.percentile_75) : null
      };
      
      setFormData(prev => ({
        ...prev,
        normative_data: [...prev.normative_data, normData]
      }));
      
      setNewNorm({
        age_min: "",
        age_max: "",
        gender: "",
        mean: "",
        std_dev: "",
        percentile_25: "",
        percentile_75: ""
      });
    }
  };

  const removeNormativeData = (index) => {
    setFormData(prev => ({
      ...prev,
      normative_data: prev.normative_data.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Assessment name is required";
    if (!formData.category) newErrors.category = "Category is required";
    if (!formData.description.trim()) newErrors.description = "Description is required";
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length === 0) {
      setIsSubmitting(true);
      try {
        const cleanedData = {
          ...formData,
          conditions_indicated: formData.conditions_indicated.length > 0 ? formData.conditions_indicated : null,
          search_tags: formData.search_tags.length > 0 ? formData.search_tags : null,
          normative_data: formData.normative_data.length > 0 ? formData.normative_data : null,
          instructions: formData.instructions.trim() || null,
          scoring_system: formData.scoring_system.trim() || null,
          unit_of_measure: formData.unit_of_measure.trim() || null,
          equipment_needed: formData.equipment_needed.trim() || null,
          contraindications: formData.contraindications.trim() || null,
          references: formData.references.trim() || null,
        };
        
        await Assessment.create(cleanedData);
        onAssessmentCreated();
      } catch (error) {
        console.error("Failed to create assessment:", error);
        setErrors({ submit: "Failed to create assessment. Please try again." });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Create New Assessment</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Assessment Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="e.g., 30-Second Bicep Curl Test"
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                </div>
                
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                    <SelectTrigger className={errors.category ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category && <p className="text-red-500 text-sm mt-1">{errors.category}</p>}
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Brief description of what this assessment measures..."
                  className={errors.description ? "border-red-500" : ""}
                  rows={3}
                />
                {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Instructions & Scoring</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="instructions">Detailed Instructions</Label>
                <Textarea
                  id="instructions"
                  value={formData.instructions}
                  onChange={(e) => handleInputChange("instructions", e.target.value)}
                  placeholder="Step-by-step instructions for conducting this assessment..."
                  rows={4}
                />
              </div>
              
              <div>
                <Label htmlFor="scoring_system">Scoring System</Label>
                <Textarea
                  id="scoring_system"
                  value={formData.scoring_system}
                  onChange={(e) => handleInputChange("scoring_system", e.target.value)}
                  placeholder="How to score this assessment..."
                  rows={3}
                />
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="unit_of_measure">Unit of Measure</Label>
                  <Input
                    id="unit_of_measure"
                    value={formData.unit_of_measure}
                    onChange={(e) => handleInputChange("unit_of_measure", e.target.value)}
                    placeholder="e.g., repetitions, seconds, score"
                  />
                </div>
                
                <div>
                  <Label htmlFor="equipment_needed">Equipment Needed</Label>
                  <Input
                    id="equipment_needed"
                    value={formData.equipment_needed}
                    onChange={(e) => handleInputChange("equipment_needed", e.target.value)}
                    placeholder="e.g., 5lb dumbbells, chair, stopwatch"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Conditions & Search Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Indicated Conditions</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newCondition}
                    onChange={(e) => setNewCondition(e.target.value)}
                    placeholder="Add condition..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCondition())}
                  />
                  <Button type="button" onClick={addCondition} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.conditions_indicated.map((condition, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {condition}
                      <button
                        type="button"
                        onClick={() => removeCondition(condition)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <Label>Search Tags</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add search tag..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" onClick={addTag} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.search_tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="flex items-center gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
                <CardTitle className="text-lg">Safety & References</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label htmlFor="contraindications">Contraindications</Label>
                    <Textarea
                    id="contraindications"
                    value={formData.contraindications}
                    onChange={(e) => handleInputChange("contraindications", e.target.value)}
                    placeholder="When NOT to use this assessment..."
                    rows={3}
                    />
                </div>
                <div>
                    <Label htmlFor="references">References</Label>
                    <Textarea
                        id="references"
                        value={formData.references}
                        onChange={(e) => handleInputChange("references", e.target.value)}
                        placeholder="e.g., Berg, K. O., et al. (1992)...."
                        rows={3}
                    />
                </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Normative Data (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                <Input
                  placeholder="Min age"
                  value={newNorm.age_min}
                  onChange={(e) => setNewNorm(prev => ({ ...prev, age_min: e.target.value }))}
                  type="number"
                />
                <Input
                  placeholder="Max age"
                  value={newNorm.age_max}
                  onChange={(e) => setNewNorm(prev => ({ ...prev, age_max: e.target.value }))}
                  type="number"
                />
                <Select value={newNorm.gender} onValueChange={(value) => setNewNorm(prev => ({ ...prev, gender: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Mean"
                  value={newNorm.mean}
                  onChange={(e) => setNewNorm(prev => ({ ...prev, mean: e.target.value }))}
                  type="number"
                  step="0.1"
                />
                <Input
                  placeholder="Std Dev"
                  value={newNorm.std_dev}
                  onChange={(e) => setNewNorm(prev => ({ ...prev, std_dev: e.target.value }))}
                  type="number"
                  step="0.1"
                />
                <Input
                  placeholder="25th %"
                  value={newNorm.percentile_25}
                  onChange={(e) => setNewNorm(prev => ({ ...prev, percentile_25: e.target.value }))}
                  type="number"
                  step="0.1"
                />
                <Button type="button" onClick={addNormativeData} size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              {formData.normative_data.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Added Normative Data:</h4>
                  <div className="space-y-2">
                    {formData.normative_data.map((norm, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                        <span className="text-sm">
                          Age {norm.age_min}-{norm.age_max}, {norm.gender}, Mean: {norm.mean}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeNormativeData(index)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {errors.submit && (
            <p className="text-red-500 text-sm">{errors.submit}</p>
          )}

          <div className="flex justify-end gap-3 pt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
              {isSubmitting ? "Creating..." : "Create Assessment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}