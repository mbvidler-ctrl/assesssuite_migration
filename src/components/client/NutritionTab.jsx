import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Utensils, Save, Printer, Calculator, AlertTriangle, ExternalLink, UserPlus } from 'lucide-react';
import { format } from 'date-fns';

export default function NutritionTab({ client, onUpdate }) {
  const [nutritionPlan, setNutritionPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadNutritionPlan();
  }, [client.id]);

  const loadNutritionPlan = async () => {
    setIsLoading(true);
    try {
      const plans = await base44.entities.ClientNutritionPlan.filter({ client_id: client.id });
      
      if (plans.length > 0) {
        setNutritionPlan(plans[0]);
      } else {
        // Initialize with client data
        const age = client.date_of_birth ? new Date().getFullYear() - new Date(client.date_of_birth).getFullYear() : 30;
        const initialBMR = calculateBMR(
          client.apss_s2_weight_kg || 70,
          client.apss_s2_height_cm || 170,
          age,
          client.gender === 'male'
        );

        setNutritionPlan({
          client_id: client.id,
          current_weight_kg: client.apss_s2_weight_kg || null,
          height_cm: client.apss_s2_height_cm || null,
          activity_level: 'lightly_active',
          bmr: initialBMR,
          tdee: initialBMR * 1.375,
          recommended_calories: initialBMR * 1.375,
          energy_unit_preference: 'kJ',
          current_eating_patterns: '',
          nutrition_goals: '',
          general_advice_given: '',
          sample_meal_plan: '',
          behavioral_strategies: ''
        });
      }
    } catch (error) {
      console.error('Error loading nutrition plan:', error);
      toast.error('Failed to load nutrition plan');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateBMR = (weight, height, age, isMale) => {
    if (!weight || !height || !age) return 0;
    // Mifflin-St Jeor Equation
    if (isMale) {
      return (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else {
      return (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }
  };

  const activityMultipliers = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extremely_active: 1.9
  };

  const handleRecalculate = () => {
    if (!nutritionPlan.current_weight_kg || !nutritionPlan.height_cm) {
      toast.error('Please enter weight and height');
      return;
    }

    const age = client.date_of_birth 
      ? new Date().getFullYear() - new Date(client.date_of_birth).getFullYear() 
      : 30;

    const bmr = calculateBMR(
      nutritionPlan.current_weight_kg,
      nutritionPlan.height_cm,
      age,
      client.gender === 'male'
    );

    const activityMultiplier = activityMultipliers[nutritionPlan.activity_level] || 1.375;
    const tdee = bmr * activityMultiplier;

    let recommendedCalories = tdee;
    if (nutritionPlan.weight_goal === 'lose') {
      recommendedCalories = tdee - 500; // 500 cal deficit
    } else if (nutritionPlan.weight_goal === 'gain') {
      recommendedCalories = tdee + 300; // 300 cal surplus
    }

    setNutritionPlan(prev => ({
      ...prev,
      bmr,
      tdee,
      recommended_calories: recommendedCalories
    }));

    toast.success('Calculations updated');
  };

  const convertToKj = (cal) => {
    return Math.round(cal * 4.184);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const dataToSave = {
        ...nutritionPlan,
        last_updated: new Date().toISOString()
      };

      if (nutritionPlan.id) {
        await base44.entities.ClientNutritionPlan.update(nutritionPlan.id, dataToSave);
      } else {
        const created = await base44.entities.ClientNutritionPlan.create(dataToSave);
        setNutritionPlan(created);
      }

      toast.success('Nutrition plan saved');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving nutrition plan:', error);
      toast.error('Failed to save nutrition plan');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintReport = () => {
    const unit = nutritionPlan.energy_unit_preference;
    const bmrDisplay = unit === 'kJ' ? convertToKj(nutritionPlan.bmr) : Math.round(nutritionPlan.bmr);
    const tdeeDisplay = unit === 'kJ' ? convertToKj(nutritionPlan.tdee) : Math.round(nutritionPlan.tdee);
    const recCalDisplay = unit === 'kJ' ? convertToKj(nutritionPlan.recommended_calories) : Math.round(nutritionPlan.recommended_calories);

    const printContent = `
      <html>
        <head>
          <title>Nutrition Plan - ${client.full_name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 2rem; line-height: 1.6; }
            h1 { color: #1e293b; border-bottom: 3px solid #3b82f6; padding-bottom: 0.5rem; }
            h2 { color: #3b82f6; margin-top: 1.5rem; }
            .warning-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 1rem; margin: 1.5rem 0; border-radius: 0.5rem; }
            .scope-box { background: #dbeafe; border: 2px solid #3b82f6; padding: 1rem; margin: 1.5rem 0; border-radius: 0.5rem; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; }
            .info-item { padding: 0.75rem; background: #f8fafc; border-radius: 0.375rem; }
            .info-label { font-weight: bold; color: #475569; font-size: 0.875rem; }
            .info-value { color: #1e293b; margin-top: 0.25rem; }
            ul { margin-left: 1.5rem; }
            li { margin-bottom: 0.5rem; }
            .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #cbd5e0; font-size: 0.875rem; color: #64748b; }
          </style>
        </head>
        <body>
          <h1>Nutrition Plan</h1>
          
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Client Name</div>
              <div class="info-value">${client.full_name}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Date Generated</div>
              <div class="info-value">${format(new Date(), 'PPP')}</div>
            </div>
          </div>

          <div class="warning-box">
            <h3 style="margin-top: 0; color: #92400e;">⚠ï¸ Exercise Physiology Scope of Practice</h3>
            <p style="margin-bottom: 0.5rem;"><strong>This nutrition advice is provided within the scope of an Accredited Exercise Physiologist (AEP) as defined by ESSA guidelines.</strong></p>
            
            <p style="margin-top: 1rem; margin-bottom: 0.5rem;"><strong>Within EP Scope:</strong></p>
            <ul style="margin-top: 0.5rem;">
              <li>General healthy eating education aligned with Australian Dietary Guidelines</li>
              <li>Portion sizes and daily serves from Australian Guide to Healthy Eating</li>
              <li>Energy balance principles for weight management</li>
              <li>General lifestyle recommendations for chronic disease management</li>
              <li>Food diary review and education</li>
              <li>Behavior change strategies related to eating</li>
            </ul>

            <p style="margin-top: 1rem; margin-bottom: 0.5rem;"><strong>Outside EP Scope (Requires Referral to APD/Dietitian):</strong></p>
            <ul style="margin-top: 0.5rem;">
              <li>Medical Nutrition Therapy (MNT) - prescribing therapeutic diets</li>
              <li>Specific macronutrient ratios to treat disease</li>
              <li>Interpreting pathology for dietary prescription</li>
              <li>Prescribing supplements at therapeutic doses</li>
              <li>Meal plans for eating disorders, IBS, renal disease, etc.</li>
            </ul>

            <p style="margin-top: 1rem;"><strong>For individualized or therapeutic dietary advice, a referral to an Accredited Practising Dietitian (APD) is recommended.</strong></p>
          </div>

          <h2>Energy Requirements</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Current Weight</div>
              <div class="info-value">${nutritionPlan.current_weight_kg || 'N/A'} kg</div>
            </div>
            <div class="info-item">
              <div class="info-label">Height</div>
              <div class="info-value">${nutritionPlan.height_cm || 'N/A'} cm</div>
            </div>
            <div class="info-item">
              <div class="info-label">BMI</div>
              <div class="info-value">${nutritionPlan.current_weight_kg && nutritionPlan.height_cm ? (nutritionPlan.current_weight_kg / Math.pow(nutritionPlan.height_cm / 100, 2)).toFixed(1) : 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Weight Goal</div>
              <div class="info-value">${nutritionPlan.weight_goal ? nutritionPlan.weight_goal.charAt(0).toUpperCase() + nutritionPlan.weight_goal.slice(1) : 'N/A'}</div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Basal Metabolic Rate (BMR)</div>
              <div class="info-value">${bmrDisplay} ${unit}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Total Daily Energy Expenditure (TDEE)</div>
              <div class="info-value">${tdeeDisplay} ${unit}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Recommended Daily Intake</div>
              <div class="info-value">${recCalDisplay} ${unit}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Activity Level</div>
              <div class="info-value">${nutritionPlan.activity_level ? nutritionPlan.activity_level.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A'}</div>
            </div>
          </div>

          <p style="font-size: 0.875rem; color: #64748b; margin-top: 0.5rem;">
            <em>Calculations based on Mifflin-St Jeor equation. These are estimates and should be individualized based on client response and goals.</em>
          </p>

          ${nutritionPlan.nutrition_goals ? `
          <h2>Nutrition Goals</h2>
          <p>${nutritionPlan.nutrition_goals}</p>
          ` : ''}

          ${nutritionPlan.current_eating_patterns ? `
          <h2>Current Eating Patterns</h2>
          <p>${nutritionPlan.current_eating_patterns}</p>
          ` : ''}

          ${nutritionPlan.general_advice_given ? `
          <h2>General Healthy Eating Advice</h2>
          <div class="scope-box">
            <p style="margin: 0;"><strong>Evidence-based guidance aligned with Australian Dietary Guidelines:</strong></p>
          </div>
          <p style="white-space: pre-line;">${nutritionPlan.general_advice_given}</p>
          ` : ''}

          ${nutritionPlan.sample_meal_plan ? `
          <h2>Sample Daily Eating Pattern</h2>
          <div class="scope-box">
            <p style="margin: 0;"><strong>Educational example showing how to meet recommended daily serves:</strong></p>
            <p style="margin-top: 0.5rem; font-size: 0.875rem; font-style: italic;">This is not a prescription - it's an example to illustrate portion sizes and food group distribution.</p>
          </div>
          <p style="white-space: pre-line;">${nutritionPlan.sample_meal_plan}</p>
          ` : ''}

          ${nutritionPlan.behavioral_strategies ? `
          <h2>Behavioral Strategies</h2>
          <p>${nutritionPlan.behavioral_strategies}</p>
          ` : ''}

          ${(nutritionPlan.referred_to_dietitian || nutritionPlan.referred_to_diabetes_educator) ? `
          <h2>Professional Referrals</h2>
          ${nutritionPlan.referred_to_dietitian ? `
            <div class="info-item" style="margin-bottom: 1rem;">
              <div class="info-label">Referred to Accredited Practising Dietitian (APD)</div>
              <div class="info-value">
                Date: ${nutritionPlan.dietitian_referral_date ? format(new Date(nutritionPlan.dietitian_referral_date), 'PPP') : 'N/A'}<br/>
                Reason: ${nutritionPlan.dietitian_referral_reason || 'N/A'}
              </div>
            </div>
          ` : ''}
          ${nutritionPlan.referred_to_diabetes_educator ? `
            <div class="info-item">
              <div class="info-label">Referred to Diabetes Educator</div>
              <div class="info-value">
                Date: ${nutritionPlan.diabetes_educator_referral_date ? format(new Date(nutritionPlan.diabetes_educator_referral_date), 'PPP') : 'N/A'}
              </div>
            </div>
          ` : ''}
          ` : ''}

          <h2>Resources</h2>
          <div class="scope-box">
            <p><strong>Australian Dietary Guidelines</strong></p>
            <p>For detailed information on healthy eating recommendations, visit:</p>
            <p><a href="https://www.health.gov.au/sites/default/files/australian-dietary-guidelines.pdf" target="_blank" style="color: #3b82f6;">https://www.health.gov.au/sites/default/files/australian-dietary-guidelines.pdf</a></p>
            
            <p style="margin-top: 1rem;"><strong>Australian Guide to Healthy Eating</strong></p>
            <p><a href="https://www.eatforhealth.gov.au/" target="_blank" style="color: #3b82f6;">https://www.eatforhealth.gov.au/</a></p>
          </div>

          <div class="footer">
            <p><strong>Prepared by:</strong> ${client.created_by || 'Exercise Physiologist'}</p>
            <p><strong>Date:</strong> ${format(new Date(), 'PPP')}</p>
            <p style="margin-top: 1rem; font-style: italic;">
              This nutrition plan contains general advice only. For therapeutic dietary interventions or personalized meal planning, please consult an Accredited Practising Dietitian.
            </p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handleUpdate = (field, value) => {
    setNutritionPlan(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const unit = nutritionPlan.energy_unit_preference;
  const bmrDisplay = unit === 'kJ' ? convertToKj(nutritionPlan.bmr) : Math.round(nutritionPlan.bmr);
  const tdeeDisplay = unit === 'kJ' ? convertToKj(nutritionPlan.tdee) : Math.round(nutritionPlan.tdee);
  const recCalDisplay = unit === 'kJ' ? convertToKj(nutritionPlan.recommended_calories) : Math.round(nutritionPlan.recommended_calories);

  return (
    <div className="space-y-6">
      {/* EP Scope Warning */}
      <Card className="bg-amber-50 border-amber-300">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-amber-900 mb-2">Exercise Physiology Scope of Practice</h4>
              <p className="text-sm text-amber-800 mb-2">
                As an Exercise Physiologist, you may provide <strong>general healthy eating advice</strong> aligned with the Australian Dietary Guidelines. You cannot provide Medical Nutrition Therapy or prescribe therapeutic diets.
              </p>
              <p className="text-sm text-amber-800">
                For individualized meal plans or therapeutic dietary interventions, refer to an <strong>Accredited Practising Dietitian (APD)</strong>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Energy Calculations */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-600" />
              Energy Requirements
            </CardTitle>
            <Select 
              value={nutritionPlan.energy_unit_preference} 
              onValueChange={(value) => handleUpdate('energy_unit_preference', value)}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kJ">kJ</SelectItem>
                <SelectItem value="Cal">Cal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Current Weight (kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={nutritionPlan.current_weight_kg || ''}
                onChange={(e) => handleUpdate('current_weight_kg', parseFloat(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Height (cm)</Label>
              <Input
                type="number"
                step="0.1"
                value={nutritionPlan.height_cm || ''}
                onChange={(e) => handleUpdate('height_cm', parseFloat(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>BMI</Label>
              <Input
                type="text"
                value={nutritionPlan.current_weight_kg && nutritionPlan.height_cm 
                  ? (nutritionPlan.current_weight_kg / Math.pow(nutritionPlan.height_cm / 100, 2)).toFixed(1) 
                  : 'N/A'}
                disabled
                className="mt-1 bg-slate-100"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Weight Goal</Label>
              <Select 
                value={nutritionPlan.weight_goal || ''} 
                onValueChange={(value) => handleUpdate('weight_goal', value)}
              >
                <SelectTrigger className="mt-1">
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
              <Label>Activity Level</Label>
              <Select 
                value={nutritionPlan.activity_level || ''} 
                onValueChange={(value) => handleUpdate('activity_level', value)}
              >
                <SelectTrigger className="mt-1">
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
          </div>

          <Button onClick={handleRecalculate} className="w-full">
            <Calculator className="w-4 h-4 mr-2" />
            Calculate Energy Requirements
          </Button>

          {nutritionPlan.bmr > 0 && (
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600 font-semibold mb-1">BMR (Basal Metabolic Rate)</p>
                <p className="text-2xl font-bold text-blue-900">{bmrDisplay}</p>
                <p className="text-xs text-slate-600">{unit}/day</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-600 font-semibold mb-1">TDEE (Total Daily Energy)</p>
                <p className="text-2xl font-bold text-green-900">{tdeeDisplay}</p>
                <p className="text-xs text-slate-600">{unit}/day</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-xs text-purple-600 font-semibold mb-1">Recommended Intake</p>
                <p className="text-2xl font-bold text-purple-900">{recCalDisplay}</p>
                <p className="text-xs text-slate-600">{unit}/day</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nutrition Assessment */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-green-600" />
            Nutrition Assessment & Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Current Eating Patterns</Label>
            <Textarea
              value={nutritionPlan.current_eating_patterns || ''}
              onChange={(e) => handleUpdate('current_eating_patterns', e.target.value)}
              rows={3}
              className="mt-1"
              placeholder="Describe client's current eating habits, meal timing, portion sizes..."
            />
          </div>

          <div>
            <Label>Nutrition Goals</Label>
            <Textarea
              value={nutritionPlan.nutrition_goals || ''}
              onChange={(e) => handleUpdate('nutrition_goals', e.target.value)}
              rows={3}
              className="mt-1"
              placeholder="Client's nutrition-related goals..."
            />
          </div>

          <div>
            <Label>Dietary Preferences/Restrictions</Label>
            <Textarea
              value={nutritionPlan.dietary_preferences || ''}
              onChange={(e) => handleUpdate('dietary_preferences', e.target.value)}
              rows={2}
              className="mt-1"
              placeholder="Vegetarian, allergies, cultural considerations..."
            />
          </div>
        </CardContent>
      </Card>

      {/* General Advice */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-blue-600" />
            General Healthy Eating Advice
            <Badge variant="outline" className="ml-2">Within EP Scope</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              Provide general, evidence-based advice aligned with the <strong>Australian Dietary Guidelines</strong> and <strong>Australian Guide to Healthy Eating</strong>. Focus on food groups, portion sizes, and healthy eating patterns.
            </p>
          </div>

          <div>
            <Label>Advice Given (ADG/AGHE aligned)</Label>
            <Textarea
              value={nutritionPlan.general_advice_given || ''}
              onChange={(e) => handleUpdate('general_advice_given', e.target.value)}
              rows={6}
              className="mt-1"
              placeholder="Example: Aim for 5 serves of vegetables per day, 2 serves of fruit, include whole grains, lean proteins, and dairy/alternatives. Stay hydrated with water..."
            />
          </div>

          <div>
            <Label>Sample Daily Eating Pattern (Educational Example)</Label>
            <Textarea
              value={nutritionPlan.sample_meal_plan || ''}
              onChange={(e) => handleUpdate('sample_meal_plan', e.target.value)}
              rows={8}
              className="mt-1"
              placeholder="Example daily meal pattern showing how to meet recommended serves..."
            />
          </div>

          <div>
            <Label>Behavioral Strategies</Label>
            <Textarea
              value={nutritionPlan.behavioral_strategies || ''}
              onChange={(e) => handleUpdate('behavioral_strategies', e.target.value)}
              rows={4}
              className="mt-1"
              placeholder="Meal planning, grocery shopping strategies, mindful eating, tracking habits..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Referrals */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-purple-600" />
            Professional Referrals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="dietitian-referral"
                checked={nutritionPlan.referred_to_dietitian || false}
                onChange={(e) => handleUpdate('referred_to_dietitian', e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="dietitian-referral" className="cursor-pointer">
                Referred to Accredited Practising Dietitian (APD)
              </Label>
            </div>

            {nutritionPlan.referred_to_dietitian && (
              <div className="ml-7 space-y-3 p-3 bg-slate-50 rounded-lg">
                <div>
                  <Label className="text-sm">Referral Date</Label>
                  <Input
                    type="date"
                    value={nutritionPlan.dietitian_referral_date || ''}
                    onChange={(e) => handleUpdate('dietitian_referral_date', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Reason for Referral</Label>
                  <Textarea
                    value={nutritionPlan.dietitian_referral_reason || ''}
                    onChange={(e) => handleUpdate('dietitian_referral_reason', e.target.value)}
                    rows={2}
                    className="mt-1"
                    placeholder="E.g., requires MNT for diabetes, low-FODMAP diet for IBS..."
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="educator-referral"
                checked={nutritionPlan.referred_to_diabetes_educator || false}
                onChange={(e) => handleUpdate('referred_to_diabetes_educator', e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="educator-referral" className="cursor-pointer">
                Referred to Diabetes Educator
              </Label>
            </div>

            {nutritionPlan.referred_to_diabetes_educator && (
              <div className="ml-7 p-3 bg-slate-50 rounded-lg">
                <Label className="text-sm">Referral Date</Label>
                <Input
                  type="date"
                  value={nutritionPlan.diabetes_educator_referral_date || ''}
                  onChange={(e) => handleUpdate('diabetes_educator_referral_date', e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={isSaving} className="flex-1">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Nutrition Plan'}
        </Button>
        <Button onClick={handlePrintReport} variant="outline">
          <Printer className="w-4 h-4 mr-2" />
          Print Report
        </Button>
      </div>
    </div>
  );
}