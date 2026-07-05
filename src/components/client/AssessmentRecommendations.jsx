import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Plus, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { ClientAssessment } from '@/entities/all';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

// Derive a list of clinical conditions from APSS Stage 2 fields on the client object
function extractApssConditions(client) {
  if (!client) return [];
  const apss = [];
  if (client.apss_s2_high_blood_pressure) apss.push({ name: "Hypertension / High Blood Pressure", notes: client.apss_s2_bp_medication_details || null });
  if (client.apss_s2_high_cholesterol) apss.push({ name: "High Cholesterol / Dyslipidaemia", notes: client.apss_s2_cholesterol_medication_details || null });
  if (client.apss_s2_high_blood_sugar) apss.push({ name: "High Blood Sugar / Glucose Intolerance", notes: client.apss_s2_glucose_medication_details || null });
  if (client.apss_s2_smoking) apss.push({ name: "Smoking / Nicotine Use", notes: client.apss_s2_smoking_details || null });
  if (client.apss_s2_vaping) apss.push({ name: "Vaping", notes: client.apss_s2_vaping_details || null });
  if (client.apss_s2_family_history) apss.push({ name: "Family History of Cardiovascular Disease", notes: null });
  if (client.apss_s2_musculoskeletal_issues) apss.push({ name: "Musculoskeletal Issues", notes: client.apss_s2_musculoskeletal_details || null });
  if (client.apss_s2_hospital_admissions) apss.push({ name: "Recent Hospital Admission", notes: client.apss_s2_hospital_admissions_details || null });
  if (client.apss_s2_pregnancy) apss.push({ name: "Pregnancy / Recent Childbirth", notes: client.apss_s2_pregnancy_details || null });
  // BMI flags
  if (client.apss_s2_bmi && client.apss_s2_bmi >= 30) apss.push({ name: "Obesity (BMI ≥ 30)", notes: `BMI: ${client.apss_s2_bmi}` });
  else if (client.apss_s2_bmi && client.apss_s2_bmi >= 25) apss.push({ name: "Overweight (BMI 25–29.9)", notes: `BMI: ${client.apss_s2_bmi}` });
  return apss;
}

export default function AssessmentRecommendations({ clientConditions, allAssessments, clientAssessments, clientId, onAssessmentAdded, client }) {
  const [recommendations, setRecommendations] = useState([]);
  const [addingId, setAddingId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const apssConditions = extractApssConditions(client);
  const allConditions = [
    ...(clientConditions || []).map(c => ({ name: c.condition_name, type: c.condition_type, notes: c.notes })),
    ...apssConditions.map(c => ({ name: c.name, type: "comorbidity", notes: c.notes }))
  ];

  useEffect(() => {
    if (!allAssessments || allConditions.length === 0) {
      setRecommendations([]);
      return;
    }
    generateAIRecommendations();
  }, [clientConditions, allAssessments, clientAssessments, client]);

  const generateAIRecommendations = async () => {
    setIsLoading(true);
    try {
      const existingAssessmentIds = new Set(clientAssessments.map(ca => ca.assessment_id));
      const availableAssessments = allAssessments.filter(a => !existingAssessmentIds.has(a.id));
      
      if (availableAssessments.length === 0) {
        setRecommendations([]);
        setIsLoading(false);
        return;
      }

      const conditionsList = allConditions;

      const assessmentsList = availableAssessments.map(a => ({
        id: a.id,
        name: a.name,
        category: a.category,
        description: a.description?.substring(0, 150),
        conditions_indicated: a.conditions_indicated || []
      }));

      const prompt = `You are a clinical exercise physiologist. Based on the client's conditions, recommend the most appropriate assessments to perform.

Client Conditions:
${JSON.stringify(conditionsList, null, 2)}

Available Assessments:
${JSON.stringify(assessmentsList, null, 2)}

Select the top 5 most clinically relevant assessments for this client. For each recommendation, provide:
1. The assessment ID (must match exactly from the list)
2. A brief clinical reason why this assessment is appropriate for the client's conditions

Focus on assessments that will:
- Help establish baseline function
- Monitor condition-specific outcomes
- Guide exercise prescription
- Track rehabilitation progress`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  assessment_id: { type: "string" },
                  reason: { type: "string" }
                },
                required: ["assessment_id", "reason"]
              }
            }
          },
          required: ["recommendations"]
        }
      });

      const aiRecs = response.recommendations || [];
      const matchedRecommendations = aiRecs
        .map(rec => {
          const assessment = availableAssessments.find(a => a.id === rec.assessment_id);
          if (assessment) {
            return { ...assessment, reason: rec.reason };
          }
          return null;
        })
        .filter(Boolean)
        .slice(0, 5);

      setRecommendations(matchedRecommendations);
    } catch (error) {
      console.error("Error generating AI recommendations:", error);
      // Fallback to basic matching
      fallbackToBasicMatching();
    } finally {
      setIsLoading(false);
    }
  };

  const fallbackToBasicMatching = () => {
    const existingAssessmentIds = new Set(clientAssessments.map(ca => ca.assessment_id));
    const conditionNames = new Set(allConditions.map(c => c.name.toLowerCase()));
    
    const newRecommendations = new Map();

    allAssessments.forEach(assessment => {
      if (existingAssessmentIds.has(assessment.id)) return;

      const indicatedConditions = assessment.conditions_indicated || [];
      for (const indicated of indicatedConditions) {
        if (conditionNames.has(indicated.toLowerCase())) {
          if (!newRecommendations.has(assessment.id)) {
            newRecommendations.set(assessment.id, { ...assessment, reason: `Indicated for ${indicated}` });
          }
          break;
        }
      }
    });

    setRecommendations(Array.from(newRecommendations.values()).slice(0, 5));
  };

  const handleAddAssessment = async (assessment) => {
    setAddingId(assessment.id);
    try {
      const client = await base44.entities.Client.filter({ id: clientId });
      const org_id = client[0]?.org_id;
      
      await ClientAssessment.create({
        org_id: org_id,
        client_id: clientId,
        assessment_id: assessment.id,
        assessment_date: new Date().toISOString().split('T')[0],
        status: "pending",
      });
      toast.success(`"${assessment.name}" has been added.`);
      onAssessmentAdded();
    } catch (error) {
      console.error("Failed to add recommended assessment:", error);
      toast.error("Failed to add assessment.");
    } finally {
      setAddingId(null);
    }
  };

  if (allConditions.length === 0) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-yellow-200/80">
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <Sparkles className="w-5 h-5" />
              AI-Suggested Assessments
            </CardTitle>
            <Badge variant="secondary">{recommendations.length}</Badge>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5 text-yellow-700" /> : <ChevronDown className="w-5 h-5 text-yellow-700" />}
        </div>
        {!isExpanded && <p className="text-sm text-yellow-700">Based on the client's conditions and APSS screening results</p>}
      </CardHeader>
      {isExpanded && (
        <CardContent>
          {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-yellow-600 mr-2" />
            <span className="text-sm text-yellow-700">Analyzing conditions...</span>
          </div>
        ) : recommendations.length === 0 ? (
          <p className="text-sm text-yellow-700 text-center py-4">No additional assessments recommended at this time.</p>
        ) : (
          <div className="space-y-3">
            {recommendations.map(assessment => (
              <div key={assessment.id} className="flex items-start justify-between p-3 bg-white/80 rounded-lg border border-yellow-200">
                <div className="flex-1 mr-3">
                  <h4 className="font-semibold text-slate-800">{assessment.name}</h4>
                  <p className="text-sm text-slate-600 mt-1">{assessment.description || assessment.reason}</p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="shrink-0"
                  onClick={() => handleAddAssessment(assessment)}
                  disabled={addingId === assessment.id}
                >
                  {addingId === assessment.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Add
                </Button>
              </div>
            ))}
          </div>
        )}
        </CardContent>
      )}
    </Card>
  );
}