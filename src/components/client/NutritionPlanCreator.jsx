import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, BookOpen, AlertTriangle, Sparkles, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import FoodDiaryTemplate from "../nutrition/FoodDiaryTemplate";
import AIDisclosureNote from "@/components/legal/AIDisclosureNote";

export default function NutritionPlanCreator({ isOpen, onClose, client, onSuccess }) {
  const [step, setStep] = useState(1);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);
  const [showFoodDiary, setShowFoodDiary] = useState(false);

  const [formData, setFormData] = useState({
    current_weight_kg: client.apss_s2_weight_kg || "",
    height_cm: client.apss_s2_height_cm || "",
    weight_goal: "",
    target_weight_kg: "",
    activity_level: "",
    bmr: 0,
    tdee: 0,
    recommended_calories: 0,
    current_eating_patterns: "",
    dietary_preferences: "",
    nutrition_goals: "",
    general_advice_given: "",
    sample_meal_plan: "",
    behavioral_strategies: "",
    energy_unit_preference: "kJ"
  });

  const calculateBMR = (weight, height, age, gender) => {
    if (!weight || !height || !age) return 0;
    
    if (gender === 'male') {
      return (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else if (gender === 'female') {
      return (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }
    return 0;
  };

  const activityMultipliers = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extremely_active: 1.9
  };

  const handleCalculate = () => {
    if (!formData.current_weight_kg || !formData.height_cm || !formData.activity_level || !formData.weight_goal) {
      toast.error("Please fill in all required fields");
      return;
    }

    const weight = parseFloat(formData.current_weight_kg);
    const height = parseFloat(formData.height_cm);
    const dob = new Date(client.date_of_birth);
    const age = new Date().getFullYear() - dob.getFullYear();
    
    console.log('Calculation inputs:', { weight, height, age, gender: client.gender, activity: formData.activity_level, goal: formData.weight_goal });
    
    if (!weight || !height || age <= 0) {
      toast.error("Invalid weight, height, or date of birth");
      return;
    }
    
    const bmr = calculateBMR(weight, height, age, client.gender);
    
    if (!bmr || bmr === 0) {
      toast.error(`Unable to calculate BMR. Gender: ${client.gender}`);
      return;
    }
    
    const multiplier = activityMultipliers[formData.activity_level] || 1.2;
    const tdee = bmr * multiplier;
    
    let recommendedCal = tdee;
    if (formData.weight_goal === 'lose') {
      recommendedCal = tdee - 500;
    } else if (formData.weight_goal === 'gain') {
      recommendedCal = tdee + 300;
    }
    
    const newBmr = Math.round(bmr);
    const newTdee = Math.round(tdee);
    const newRecCal = Math.round(recommendedCal);
    
    console.log('Results:', { bmr: newBmr, tdee: newTdee, recommended: newRecCal });
    
    setFormData({
      ...formData,
      bmr: newBmr,
      tdee: newTdee,
      recommended_calories: newRecCal
    });
    
    toast.success("Energy requirements calculated!");
  };

  const handleGenerateAdvice = async () => {
    setIsGeneratingAdvice(true);
    try {
      const age = new Date().getFullYear() - new Date(client.date_of_birth).getFullYear();
      const gender = client.gender;
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an Exercise Physiologist in Australia providing general nutrition education within scope of practice.

Client Information:
- Age: ${age} years
- Gender: ${gender}
- Weight Goal: ${formData.weight_goal}
- Current Eating Patterns: ${formData.current_eating_patterns || 'Not specified'}
- Dietary Preferences: ${formData.dietary_preferences || 'Not specified'}
- Nutrition Goals: ${formData.nutrition_goals || 'Not specified'}
- Recommended Daily Intake: ${formData.recommended_calories} Cal (${Math.round(formData.recommended_calories * 4.184)} kJ)

Generate a structured nutrition education report with these SPECIFIC sections:

**GENERAL_ADVICE Section:**
1. KEY PRINCIPLES (for ${formData.weight_goal} goal)
   - 3-4 key principles aligned with their weight goal and Australian Dietary Guidelines

2. RECOMMENDED DAILY SERVES FOR ${gender === 'male' ? 'MEN' : 'WOMEN'} AGED ${age}
   - Look up the EXACT serves for this age/gender from Australian Guide to Healthy Eating
   - Include ALL food groups with specific numbers:
     * Vegetables & Legumes: X serves
     * Fruit: X serves
     * Grains (mostly wholegrain): X serves
     * Lean meat/alternatives: X serves
     * Milk/yoghurt/cheese/alternatives: X serves
     * Healthy fats: X serves
     * Discretionary: limit
   - Include standard serve examples for each

3. KEY NUTRIENTS
   - 4-5 key nutrients relevant to their age/gender/goal
   - Explain importance and dietary sources

**SAMPLE_MEAL_PLAN Section (AS EDUCATION, NOT PRESCRIPTION):**
Create a complete sample day showing how to meet the recommended serves:
- BREAKFAST (7:00 AM): List foods and serves provided
- MORNING SNACK (10:00 AM): List foods and serves provided
- LUNCH (12:30 PM): List foods and serves provided
- AFTERNOON SNACK (3:00 PM): List foods and serves provided
- DINNER (6:30 PM): List foods and serves provided
- EVENING (if needed): List foods and serves provided

For each meal, clearly show:
- Example foods/beverages
- Portion sizes
- Which food group serves are provided
- Align with their ${formData.recommended_calories} Cal (${Math.round(formData.recommended_calories * 4.184)} kJ) target

**BEHAVIORAL_STRATEGIES Section:**
- 4-5 specific, actionable strategies tailored to ${formData.weight_goal}
- Focus on habit formation, meal timing, portion awareness, food environment

CRITICAL: This is EDUCATION not prescription. Frame as "example of how to meet daily serves" not "your meal plan". Stay within EP scope.`,
        response_json_schema: {
          type: "object",
          properties: {
            general_advice: { type: "string" },
            sample_meal_plan: { type: "string" },
            behavioral_strategies: { type: "string" }
          }
        }
      });

      setFormData(prev => ({
        ...prev,
        general_advice_given: result.general_advice,
        sample_meal_plan: result.sample_meal_plan,
        behavioral_strategies: result.behavioral_strategies
      }));
      
      toast.success("AI advice generated!");
    } catch (error) {
      console.error("Failed to generate advice:", error);
      toast.error("Failed to generate AI advice");
    } finally {
      setIsGeneratingAdvice(false);
    }
  };

  const handleSave = async () => {
    if (!formData.current_weight_kg || !formData.height_cm || !formData.weight_goal || !formData.activity_level || !formData.target_weight_kg) {
      toast.error("Please complete all required fields including target weight");
      return;
    }

    setIsSaving(true);
    try {
      const orgId = client.org_id;
      if (!orgId) {
        toast.error("Client is missing organization ID. Please contact support.");
        setIsSaving(false);
        return;
      }

      await base44.entities.ClientNutritionPlan.create({
        org_id: orgId,
        client_id: client.id,
        current_weight_kg: parseFloat(formData.current_weight_kg),
        height_cm: parseFloat(formData.height_cm),
        target_weight_kg: parseFloat(formData.target_weight_kg),
        weight_goal: formData.weight_goal,
        activity_level: formData.activity_level,
        bmr: formData.bmr,
        tdee: formData.tdee,
        recommended_calories: formData.recommended_calories,
        current_eating_patterns: formData.current_eating_patterns,
        dietary_preferences: formData.dietary_preferences,
        nutrition_goals: formData.nutrition_goals,
        general_advice_given: formData.general_advice_given,
        sample_meal_plan: formData.sample_meal_plan,
        behavioral_strategies: formData.behavioral_strategies,
        energy_unit_preference: formData.energy_unit_preference
      });
      
      toast.success("Nutrition plan created!");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error creating nutrition plan:", error);
      toast.error(`Failed to create nutrition plan: ${error.message || "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const convertToKj = (cal) => Math.round(cal * 4.184);

  const handleFoodDiaryCopy = (text) => {
    setFormData(prev => ({
      ...prev,
      current_eating_patterns: prev.current_eating_patterns 
        ? prev.current_eating_patterns + '\n\n' + text 
        : text
    }));
    setShowFoodDiary(false);
    toast.success('Food diary added to eating patterns!');
  };

  return (
    <>
      <FoodDiaryTemplate
        isOpen={showFoodDiary}
        onClose={() => setShowFoodDiary(false)}
        onCopy={handleFoodDiaryCopy}
      />

      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Create Nutrition Plan - {client.full_name}</DialogTitle>
        </DialogHeader>

        <Tabs value={`step${step}`} onValueChange={(val) => setStep(parseInt(val.replace('step', '')))}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="step1">1. Calculations</TabsTrigger>
            <TabsTrigger value="step2">2. Assessment</TabsTrigger>
            <TabsTrigger value="step3">3. Advice</TabsTrigger>
          </TabsList>

          {/* Step 1: Energy Calculations */}
          <TabsContent value="step1" className="space-y-4">
            <Card className="bg-amber-50 border-amber-300">
              <CardContent className="py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    <strong>Scope Reminder:</strong> Provide general energy balance education only. For individualized meal plans or therapeutic diets, refer to an APD.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Current Weight (kg) *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.current_weight_kg}
                  onChange={(e) => handleInputChange('current_weight_kg', e.target.value)}
                  placeholder="e.g., 75.5"
                />
              </div>
              <div>
                <Label>Height (cm) *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.height_cm}
                  onChange={(e) => handleInputChange('height_cm', e.target.value)}
                  placeholder="e.g., 175"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Weight Management Goal *</Label>
                <Select value={formData.weight_goal} onValueChange={(val) => handleInputChange('weight_goal', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select goal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintain">Maintain Weight</SelectItem>
                    <SelectItem value="lose">Lose Weight</SelectItem>
                    <SelectItem value="gain">Gain Weight</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target Weight (kg) *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.target_weight_kg}
                  onChange={(e) => handleInputChange('target_weight_kg', e.target.value)}
                  placeholder="e.g., 70"
                />
              </div>
            </div>

            <div>
              <Label>Physical Activity Level *</Label>
              <Select value={formData.activity_level} onValueChange={(val) => handleInputChange('activity_level', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select activity level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentary (little/no exercise)</SelectItem>
                  <SelectItem value="lightly_active">Lightly Active (1-3 days/week)</SelectItem>
                  <SelectItem value="moderately_active">Moderately Active (3-5 days/week)</SelectItem>
                  <SelectItem value="very_active">Very Active (6-7 days/week)</SelectItem>
                  <SelectItem value="extremely_active">Extremely Active (2x/day)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleCalculate}
              disabled={!formData.current_weight_kg || !formData.height_cm || !formData.activity_level || !formData.weight_goal || isCalculating}
              className="w-full"
            >
              <Calculator className="w-4 h-4 mr-2" />
              {isCalculating ? "Calculating..." : "Calculate Energy Requirements"}
            </Button>

            {formData.bmr > 0 && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="py-4">
                  <h4 className="font-semibold text-blue-900 mb-3">Calculated Energy Requirements:</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-blue-600 mb-1">BMR</p>
                      <p className="text-lg font-bold text-blue-900">{formData.bmr} Cal</p>
                      <p className="text-xs text-blue-600">{convertToKj(formData.bmr)} kJ</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 mb-1">TDEE</p>
                      <p className="text-lg font-bold text-blue-900">{formData.tdee} Cal</p>
                      <p className="text-xs text-blue-600">{convertToKj(formData.tdee)} kJ</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 mb-1">Recommended</p>
                      <p className="text-lg font-bold text-green-900">{formData.recommended_calories} Cal</p>
                      <p className="text-xs text-green-600">{convertToKj(formData.recommended_calories)} kJ</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button onClick={() => setStep(2)} className="w-full" disabled={formData.bmr === 0}>
              Continue to Assessment →
            </Button>
          </TabsContent>

          {/* Step 2: Nutrition Assessment */}
          <TabsContent value="step2" className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Current Eating Patterns</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFoodDiary(true)}
                >
                  <FileText className="w-3 h-3 mr-1" />
                  24-Hour Food Diary
                </Button>
              </div>
              <Textarea
                value={formData.current_eating_patterns}
                onChange={(e) => handleInputChange('current_eating_patterns', e.target.value)}
                placeholder="Describe the client's typical daily eating habits..."
                rows={3}
              />
            </div>

            <div>
              <Label>Dietary Preferences/Restrictions</Label>
              <Textarea
                value={formData.dietary_preferences}
                onChange={(e) => handleInputChange('dietary_preferences', e.target.value)}
                placeholder="Any dietary preferences, allergies, or cultural considerations..."
                rows={3}
              />
            </div>

            <div>
              <Label>Nutrition-Related Goals</Label>
              <Textarea
                value={formData.nutrition_goals}
                onChange={(e) => handleInputChange('nutrition_goals', e.target.value)}
                placeholder="What does the client want to achieve with nutrition changes?"
                rows={3}
              />
            </div>

            <Card className="bg-green-50 border-green-200">
              <CardContent className="py-3">
                <div className="flex items-start gap-2">
                  <BookOpen className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <strong>Australian Guide to Healthy Eating - Daily Serves:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Vegetables and legumes: 5-6 serves</li>
                      <li>Fruit: 2 serves</li>
                      <li>Grains (mostly wholegrain): 4-6 serves</li>
                      <li>Lean meat/alternatives: 2-3 serves</li>
                      <li>Dairy/alternatives: 2.5-4 serves</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                â† Back
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                Continue to Advice →
              </Button>
            </div>
          </TabsContent>

          {/* Step 3: Advice & Recommendations */}
          <TabsContent value="step3" className="space-y-4">
            <Button 
              onClick={handleGenerateAdvice}
              disabled={isGeneratingAdvice}
              variant="outline"
              className="w-full"
            >
              {isGeneratingAdvice ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating AI Advice...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate AI Advice (Optional)
                </>
              )}
            </Button>
            <AIDisclosureNote />

            <div>
              <Label>General Healthy Eating Advice</Label>
              <Textarea
                value={formData.general_advice_given}
                onChange={(e) => handleInputChange('general_advice_given', e.target.value)}
                placeholder="Provide general advice aligned with Australian Dietary Guidelines..."
                rows={6}
              />
            </div>

            <div>
              <Label>Sample Daily Eating Pattern (Educational Example)</Label>
              <Textarea
                value={formData.sample_meal_plan}
                onChange={(e) => handleInputChange('sample_meal_plan', e.target.value)}
                placeholder="Example daily meal pattern showing how to meet recommended serves..."
                rows={8}
              />
            </div>

            <div>
              <Label>Behavioral Strategies</Label>
              <Textarea
                value={formData.behavioral_strategies}
                onChange={(e) => handleInputChange('behavioral_strategies', e.target.value)}
                placeholder="Behavior change strategies for eating habits..."
                rows={4}
              />
            </div>

            <div>
              <Label>Preferred Energy Unit for Client</Label>
              <Select value={formData.energy_unit_preference} onValueChange={(val) => handleInputChange('energy_unit_preference', val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kJ">Kilojoules (kJ) - Australian Standard</SelectItem>
                  <SelectItem value="Cal">Calories (Cal)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                â† Back
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? "Saving..." : "Create Nutrition Plan"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    </>
  );
}