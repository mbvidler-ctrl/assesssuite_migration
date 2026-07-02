import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Client, ClientCondition } from "@/entities/all";
import { InvokeLLM } from "@/integrations/Core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Plus, 
  Edit2, 
  Trash2, 
  Save,
  X,
  Lightbulb,
  Loader2
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

export default function ClientConditions() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clientId = searchParams.get("id");
  
  const [client, setClient] = useState(null);
  const [conditions, setConditions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCondition, setEditingCondition] = useState(null);
  const [suggestedAssessments, setSuggestedAssessments] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [formData, setFormData] = useState({
    condition_name: "",
    condition_type: "primary",
    diagnosis_date: "",
    severity: "",
    notes: ""
  });

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  const loadData = async () => {
    try {
      const [clientData, conditionsData] = await Promise.all([
        Client.list().then(clients => clients.find(c => c.id === clientId)),
        ClientCondition.filter({ client_id: clientId })
      ]);
      
      setClient(clientData);
      setConditions(conditionsData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const generateAssessmentSuggestions = async () => {
    if (conditions.length === 0) return;
    
    setIsLoadingSuggestions(true);
    try {
      const conditionsList = conditions.map(c => c.condition_name).join(", ");
      const prompt = `Based on the following medical conditions: ${conditionsList}, suggest appropriate physical and psychological assessment tests that would be most beneficial for a clinical evaluation. Consider evidence-based practice and focus on assessments that are commonly used in physiotherapy and exercise physiology. Return only the assessment names, one per line.`;
      
      const response = await InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false
      });
      
      const suggestions = response.split('\n').filter(line => line.trim()).map(line => ({
        name: line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim(),
        reason: `Recommended for ${conditionsList}`
      }));
      
      setSuggestedAssessments(suggestions);
    } catch (error) {
      console.error("Error generating suggestions:", error);
    }
    setIsLoadingSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const conditionData = {
        ...formData,
        client_id: clientId
      };

      if (editingCondition) {
        await ClientCondition.update(editingCondition.id, conditionData);
      } else {
        await ClientCondition.create(conditionData);
      }
      
      setShowForm(false);
      setEditingCondition(null);
      setFormData({
        condition_name: "",
        condition_type: "primary",
        diagnosis_date: "",
        severity: "",
        notes: ""
      });
      
      await loadData();
      
      // Auto-generate suggestions after adding a condition
      if (!editingCondition && conditions.length >= 0) {
        setTimeout(generateAssessmentSuggestions, 1000);
      }
    } catch (error) {
      console.error("Error saving condition:", error);
    }
  };

  const handleEdit = (condition) => {
    setEditingCondition(condition);
    setFormData({
      condition_name: condition.condition_name,
      condition_type: condition.condition_type,
      diagnosis_date: condition.diagnosis_date || "",
      severity: condition.severity || "",
      notes: condition.notes || ""
    });
    setShowForm(true);
  };

  const handleDelete = async (conditionId) => {
    if (confirm("Are you sure you want to delete this condition?")) {
      try {
        await ClientCondition.delete(conditionId);
        await loadData();
      } catch (error) {
        console.error("Error deleting condition:", error);
      }
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingCondition(null);
    setFormData({
      condition_name: "",
      condition_type: "primary",
      diagnosis_date: "",
      severity: "",
      notes: ""
    });
  };

  if (!client) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Client Not Found</h1>
          <Button onClick={() => navigate(createPageUrl("Dashboard"))}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(createPageUrl(`ClientProfile?id=${clientId}`))}
              className="bg-white/60 backdrop-blur-sm"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Medical Conditions</h1>
              <p className="text-slate-600">{client.full_name}</p>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Condition
          </Button>
        </div>

        {/* AI Suggestions */}
        {conditions.length > 0 && (
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-800">
                <Lightbulb className="w-5 h-5" />
                AI Assessment Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {suggestedAssessments.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-purple-700 mb-3">
                    Based on the client's conditions, here are recommended assessments:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedAssessments.map((suggestion, index) => (
                      <Badge key={index} variant="outline" className="bg-white/60">
                        {suggestion.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Button 
                    onClick={generateAssessmentSuggestions}
                    disabled={isLoadingSuggestions}
                    variant="outline"
                    className="bg-white/60"
                  >
                    {isLoadingSuggestions ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Lightbulb className="w-4 h-4 mr-2" />
                        Get Assessment Suggestions
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-purple-600">
                    AI will analyze conditions and suggest appropriate tests
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {editingCondition ? "Edit Condition" : "Add New Condition"}
                <Button variant="ghost" size="icon" onClick={resetForm}>
                  <X className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="condition_name">Condition Name *</Label>
                    <Input
                      id="condition_name"
                      value={formData.condition_name}
                      onChange={(e) => setFormData({...formData, condition_name: e.target.value})}
                      placeholder="e.g., Low back pain, Osteoarthritis"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="condition_type">Type *</Label>
                    <Select
                      value={formData.condition_type}
                      onValueChange={(value) => setFormData({...formData, condition_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="primary">Primary Condition</SelectItem>
                        <SelectItem value="comorbidity">Comorbidity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="diagnosis_date">Diagnosis Date</Label>
                    <Input
                      id="diagnosis_date"
                      type="date"
                      value={formData.diagnosis_date}
                      onChange={(e) => setFormData({...formData, diagnosis_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="severity">Severity</Label>
                    <Select
                      value={formData.severity}
                      onValueChange={(value) => setFormData({...formData, severity: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mild">Mild</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="severe">Severe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Additional notes about the condition..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    <Save className="w-4 h-4 mr-2" />
                    {editingCondition ? "Update" : "Add"} Condition
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Conditions List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Current Conditions</h2>
          
          {conditions.length > 0 ? (
            conditions.map((condition) => (
              <Card key={condition.id} className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-900">{condition.condition_name}</h3>
                        <Badge variant={condition.condition_type === 'primary' ? 'default' : 'secondary'}>
                          {condition.condition_type}
                        </Badge>
                        {condition.severity && (
                          <Badge variant="outline" className={
                            condition.severity === 'severe' ? 'border-red-500 text-red-700' :
                            condition.severity === 'moderate' ? 'border-yellow-500 text-yellow-700' :
                            'border-green-500 text-green-700'
                          }>
                            {condition.severity}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-slate-600 space-y-1">
                        {condition.diagnosis_date && (
                          <p>Diagnosed: {format(new Date(condition.diagnosis_date), "PPP")}</p>
                        )}
                        {condition.notes && (
                          <p className="mt-2">{condition.notes}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(condition)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(condition.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardContent className="py-12 text-center">
                <div className="w-12 h-12 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                  <Plus className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Conditions Added</h3>
                <p className="text-slate-600 mb-4">
                  Add the client's medical conditions to get personalized assessment recommendations.
                </p>
                <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Condition
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}