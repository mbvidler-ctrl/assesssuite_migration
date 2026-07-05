import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Utensils, TrendingUp, TrendingDown, Minus, Plus, Edit } from 'lucide-react';
import NutritionPlanCreator from './NutritionPlanCreator';

export default function NutritionSummaryCard({ clientId, onCreatePlan, client }) {
  const [nutritionPlan, setNutritionPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);

  useEffect(() => {
    loadNutritionPlan();
  }, [clientId]);

  const loadNutritionPlan = async () => {
    setIsLoading(true);
    try {
      const plans = await base44.entities.ClientNutritionPlan.filter({ client_id: clientId });
      if (plans.length > 0) {
        setNutritionPlan(plans[0]);
      }
    } catch (error) {
      console.error('Error loading nutrition summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlanCreated = () => {
    loadNutritionPlan();
    if (onCreatePlan) onCreatePlan();
  };

  if (isLoading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 animate-pulse">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-green-600" />
            Nutrition Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-slate-200 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  if (!nutritionPlan) {
    return (
      <>
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Utensils className="w-5 h-5 text-green-600" />
              Nutrition Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-3">No nutrition plan created yet</p>
            <Button 
              onClick={() => setShowCreator(true)}
              size="sm"
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Nutrition Plan
            </Button>
          </CardContent>
        </Card>

        {showCreator && (
          <NutritionPlanCreator
            isOpen={showCreator}
            onClose={() => setShowCreator(false)}
            client={client}
            onSuccess={handlePlanCreated}
          />
        )}
      </>
    );
  }

  const convertToKj = (cal) => Math.round(cal * 4.184);
  const unit = nutritionPlan.energy_unit_preference || 'kJ';
  const recCalDisplay = unit === 'kJ' 
    ? convertToKj(nutritionPlan.recommended_calories) 
    : Math.round(nutritionPlan.recommended_calories);

  const getWeightGoalIcon = () => {
    if (nutritionPlan.weight_goal === 'lose') return <TrendingDown className="w-4 h-4 text-blue-600" />;
    if (nutritionPlan.weight_goal === 'gain') return <TrendingUp className="w-4 h-4 text-green-600" />;
    return <Minus className="w-4 h-4 text-slate-600" />;
  };

  const getWeightGoalColor = () => {
    if (nutritionPlan.weight_goal === 'lose') return 'bg-blue-100 text-blue-800';
    if (nutritionPlan.weight_goal === 'gain') return 'bg-green-100 text-green-800';
    return 'bg-slate-100 text-slate-800';
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Utensils className="w-5 h-5 text-green-600" />
          Nutrition Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-600 mb-1">Weight Goal</p>
            <Badge className={getWeightGoalColor()}>
              {getWeightGoalIcon()}
              <span className="ml-1 capitalize">{nutritionPlan.weight_goal || 'Not Set'}</span>
            </Badge>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-600 mb-1">Daily Target</p>
            <p className="text-lg font-bold text-slate-900">{recCalDisplay} {unit}</p>
          </div>
        </div>

        {(nutritionPlan.referred_to_dietitian || nutritionPlan.referred_to_diabetes_educator) && (
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs text-slate-600 mb-2">Active Referrals:</p>
            <div className="flex flex-wrap gap-2">
              {nutritionPlan.referred_to_dietitian && (
                <Badge variant="outline" className="text-xs">APD Referral</Badge>
              )}
              {nutritionPlan.referred_to_diabetes_educator && (
                <Badge variant="outline" className="text-xs">Diabetes Educator</Badge>
              )}
            </div>
          </div>
        )}
        
        <div className="flex gap-2 mt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1" 
            onClick={() => onCreatePlan()}
          >
            <Edit className="w-3 h-3 mr-1" />
            Edit Plan
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1" 
            onClick={() => onCreatePlan()}
          >
            View Full Plan →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}