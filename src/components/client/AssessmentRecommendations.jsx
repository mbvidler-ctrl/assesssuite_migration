import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Plus, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { ClientAssessment } from '@/entities/all';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { todayLocal } from '@/lib/localDate';
import {
  ASSESSMENT_DISCOVERY_STATUS,
  assessmentDiscoveryStatusMessage,
  discoverAssessments,
} from '@/lib/clinical/assessmentDiscovery';

const DISPLAY_LIMIT = 5;

// Derive condition labels from APSS Stage 2 fields without transmitting client
// information or using free-text notes as ranking inputs.
function extractApssConditions(client) {
  if (!client) return [];
  const apss = [];
  if (client.apss_s2_high_blood_pressure) apss.push({ name: 'Hypertension / High Blood Pressure' });
  if (client.apss_s2_high_cholesterol) apss.push({ name: 'High Cholesterol / Dyslipidaemia' });
  if (client.apss_s2_high_blood_sugar) apss.push({ name: 'High Blood Sugar / Glucose Intolerance' });
  if (client.apss_s2_smoking) apss.push({ name: 'Smoking / Nicotine Use' });
  if (client.apss_s2_vaping) apss.push({ name: 'Vaping' });
  if (client.apss_s2_family_history) apss.push({ name: 'Family History of Cardiovascular Disease' });
  if (client.apss_s2_musculoskeletal_issues) apss.push({ name: 'Musculoskeletal Issues' });
  if (client.apss_s2_hospital_admissions) apss.push({ name: 'Recent Hospital Admission' });
  if (client.apss_s2_pregnancy) apss.push({ name: 'Pregnancy / Recent Childbirth' });
  if (client.apss_s2_bmi && client.apss_s2_bmi >= 30) apss.push({ name: 'Obesity (BMI >= 30)' });
  else if (client.apss_s2_bmi && client.apss_s2_bmi >= 25) apss.push({ name: 'Overweight (BMI 25-29.9)' });
  return apss;
}

export default function AssessmentRecommendations({
  clientConditions,
  allAssessments,
  clientAssessments,
  clientId,
  onAssessmentAdded,
  client,
}) {
  const [addingId, setAddingId] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const allConditions = useMemo(() => {
    const apssConditions = extractApssConditions(client);
    return [
      ...(clientConditions || []).map((condition) => ({
        name: condition.condition_name,
        type: condition.condition_type,
      })),
      ...apssConditions.map((condition) => ({ name: condition.name, type: 'comorbidity' })),
    ];
  }, [clientConditions, client]);

  // There is one discovery path in every runtime posture. No model call and
  // no weaker outage fallback can silently change the result set.
  const discovery = useMemo(() => discoverAssessments({
    conditions: allConditions,
    assessments: allAssessments,
    existingAssessmentIds: (clientAssessments || []).map((assessment) => assessment.assessment_id),
    limit: DISPLAY_LIMIT,
  }), [allConditions, allAssessments, clientAssessments]);
  const recommendations = discovery.recommendations;

  const handleAddAssessment = async (assessment) => {
    setAddingId(assessment.id);
    try {
      const clientRows = await base44.entities.Client.filter({ id: clientId });
      const org_id = clientRows[0]?.org_id;

      await ClientAssessment.create({
        org_id,
        client_id: clientId,
        assessment_id: assessment.id,
        assessment_date: todayLocal(),
        status: 'pending',
      });
      toast.success(`"${assessment.name}" has been added.`);
      onAssessmentAdded?.();
    } catch (error) {
      console.error('Failed to add recommended assessment:', error);
      toast.error('Failed to add assessment.');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-yellow-200/80">
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded((expanded) => !expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <Lightbulb className="w-5 h-5" />
              Suggested Assessments
            </CardTitle>
            <Badge variant="outline" className="border-yellow-300 text-yellow-800">
              Catalogue-ranked
            </Badge>
            <Badge variant="secondary">{recommendations.length}</Badge>
          </div>
          {isExpanded
            ? <ChevronUp className="w-5 h-5 text-yellow-700" />
            : <ChevronDown className="w-5 h-5 text-yellow-700" />}
        </div>
        {!isExpanded && (
          <p className="text-sm text-yellow-700">
            Deterministic matches from recorded conditions and assessment catalogue metadata
          </p>
        )}
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <p className="text-sm text-yellow-800 mb-3">
            These suggestions use one local, rule-based ranking path. They are not AI-generated and require clinician review before use.
          </p>
          {recommendations.length === 0 ? (
            <p className="text-sm text-yellow-700 text-center py-4">
              {assessmentDiscoveryStatusMessage(discovery.status)}
            </p>
          ) : (
            <div className="space-y-3">
              {discovery.matchCount > recommendations.length && (
                <p className="text-xs text-slate-600">
                  Showing the top {recommendations.length} of {discovery.matchCount} catalogue matches.
                </p>
              )}
              {recommendations.map((assessment) => (
                <div key={assessment.id} className="flex items-start justify-between p-3 bg-white/80 rounded-lg border border-yellow-200">
                  <div className="flex-1 mr-3">
                    <h4 className="font-semibold text-slate-800">{assessment.name}</h4>
                    {assessment.description && (
                      <p className="text-sm text-slate-600 mt-1">{assessment.description}</p>
                    )}
                    <p className="text-xs text-yellow-800 mt-2">Match basis: {assessment.reason}</p>
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
          {discovery.status === ASSESSMENT_DISCOVERY_STATUS.READY && (
            <p className="text-xs text-slate-500 mt-3">
              Review indications, contraindications, scope and client circumstances before adding an assessment.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
