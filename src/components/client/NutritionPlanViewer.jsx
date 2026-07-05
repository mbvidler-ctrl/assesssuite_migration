import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Calendar, TrendingUp, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function NutritionPlanViewer({ isOpen, onClose, client, onCreateNew }) {
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    if (isOpen && client) {
      loadPlans();
    }
  }, [isOpen, client]);

  const loadPlans = async () => {
    setIsLoading(true);
    try {
      const allPlans = await base44.entities.ClientNutritionPlan.filter(
        { client_id: client.id },
        "-created_date"
      );
      setPlans(allPlans);
      if (allPlans.length > 0) {
        setSelectedPlan(allPlans[0]); // Select most recent
      }
    } catch (error) {
      console.error("Error loading nutrition plans:", error);
      toast.error("Failed to load nutrition plans");
    } finally {
      setIsLoading(false);
    }
  };

  const convertToKj = (cal) => Math.round(cal * 4.184);

  const goalLabels = {
    maintain: "Maintain Weight",
    lose: "Lose Weight",
    gain: "Gain Weight"
  };

  const activityLabels = {
    sedentary: "Sedentary",
    lightly_active: "Lightly Active",
    moderately_active: "Moderately Active",
    very_active: "Very Active",
    extremely_active: "Extremely Active"
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">
              Nutrition Plans - {client.full_name}
            </DialogTitle>
            <Button onClick={onCreateNew} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Create New Plan
            </Button>
          </div>
        </DialogHeader>

        {plans.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Nutrition Plans</h3>
            <p className="text-slate-600 mb-4">
              This client doesn't have any nutrition plans yet.
            </p>
            <Button onClick={onCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Plan
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Plan History Timeline */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Calendar className="w-5 h-5" />
                  Plan History ({plans.length} {plans.length === 1 ? 'plan' : 'plans'})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {plans.map((plan, index) => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        selectedPlan?.id === plan.id
                          ? 'border-blue-500 bg-white shadow-md'
                          : 'border-transparent bg-white/50 hover:bg-white/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {format(new Date(plan.created_date), 'MMM d, yyyy')}
                            </span>
                            {index === 0 && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-slate-600 mt-1">
                            Goal: {goalLabels[plan.weight_goal]} • {plan.current_weight_kg}kg
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-600">
                            {plan.recommended_calories} Cal
                          </div>
                          <div className="text-xs text-slate-500">
                            {convertToKj(plan.recommended_calories)} kJ
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Selected Plan Details */}
            {selectedPlan && (
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="calculations">Calculations</TabsTrigger>
                  <TabsTrigger value="advice">Advice</TabsTrigger>
                  <TabsTrigger value="strategies">Strategies</TabsTrigger>
                </TabsList>

                {/* Summary Tab */}
                <TabsContent value="summary" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Plan Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-slate-600">Created</p>
                          <p className="font-semibold">
                            {format(new Date(selectedPlan.created_date), 'MMMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Weight Goal</p>
                          <p className="font-semibold">{goalLabels[selectedPlan.weight_goal]}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Current Weight</p>
                          <p className="font-semibold">{selectedPlan.current_weight_kg} kg</p>
                        </div>
                        {selectedPlan.target_weight_kg && (
                          <div>
                            <p className="text-sm text-slate-600">Target Weight</p>
                            <p className="font-semibold">{selectedPlan.target_weight_kg} kg</p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm text-slate-600">Activity Level</p>
                          <p className="font-semibold">{activityLabels[selectedPlan.activity_level]}</p>
                        </div>
                      </div>

                      {selectedPlan.dietary_preferences && (
                        <div>
                          <p className="text-sm text-slate-600 mb-1">Dietary Preferences</p>
                          <p className="text-slate-900">{selectedPlan.dietary_preferences}</p>
                        </div>
                      )}

                      {selectedPlan.nutrition_goals && (
                        <div>
                          <p className="text-sm text-slate-600 mb-1">Nutrition Goals</p>
                          <p className="text-slate-900">{selectedPlan.nutrition_goals}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Calculations Tab */}
                <TabsContent value="calculations" className="space-y-4">
                  <Card className="bg-blue-50 border-blue-200">
                    <CardHeader>
                      <CardTitle className="text-blue-900">Energy Requirements</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-6 text-center">
                        <div>
                          <p className="text-sm text-blue-600 mb-2">Basal Metabolic Rate</p>
                          <p className="text-3xl font-bold text-blue-900">{selectedPlan.bmr}</p>
                          <p className="text-sm text-blue-600">Cal/day</p>
                          <p className="text-xs text-slate-500 mt-1">{convertToKj(selectedPlan.bmr)} kJ</p>
                        </div>
                        <div>
                          <p className="text-sm text-blue-600 mb-2">Total Daily Energy Expenditure</p>
                          <p className="text-3xl font-bold text-blue-900">{selectedPlan.tdee}</p>
                          <p className="text-sm text-blue-600">Cal/day</p>
                          <p className="text-xs text-slate-500 mt-1">{convertToKj(selectedPlan.tdee)} kJ</p>
                        </div>
                        <div>
                          <p className="text-sm text-green-600 mb-2">Recommended Intake</p>
                          <p className="text-3xl font-bold text-green-900">{selectedPlan.recommended_calories}</p>
                          <p className="text-sm text-green-600">Cal/day</p>
                          <p className="text-xs text-slate-500 mt-1">{convertToKj(selectedPlan.recommended_calories)} kJ</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {selectedPlan.current_eating_patterns && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Current Eating Patterns</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-wrap text-slate-700">{selectedPlan.current_eating_patterns}</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Advice Tab */}
                <TabsContent value="advice" className="space-y-4">
                  {selectedPlan.general_advice_given && (
                    <Card>
                      <CardHeader>
                        <CardTitle>General Healthy Eating Advice</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-wrap text-slate-700">{selectedPlan.general_advice_given}</p>
                      </CardContent>
                    </Card>
                  )}

                  {selectedPlan.sample_meal_plan && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Sample Daily Eating Pattern</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-wrap text-slate-700">{selectedPlan.sample_meal_plan}</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Strategies Tab */}
                <TabsContent value="strategies" className="space-y-4">
                  {selectedPlan.behavioral_strategies && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Behavioral Change Strategies</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-wrap text-slate-700">{selectedPlan.behavioral_strategies}</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}