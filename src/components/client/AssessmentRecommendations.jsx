import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Lightbulb, Loader2, Plus, Sparkles } from 'lucide-react';
import { ClientAssessment } from '@/entities/all';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { todayLocal } from '@/lib/localDate';
import AIDisclosureNote from '@/components/legal/AIDisclosureNote';
import { useAiCapability } from '@/hooks/useAiCapability';
import { AI_COPY } from '@/lib/aiCapabilities';
import {
  discoverAssessments,
  MAX_ASSESSMENT_RECOMMENDATIONS,
} from '@/lib/clinical/assessmentDiscovery';
import { buildTimeProfession as activeProfession } from '@/lib/profession';

const legacyRecommendationAiAllowed = activeProfession.features.legacyGeneralClinicalLlm === true;

// Derive a list of clinical conditions from APSS Stage 2 fields on the client object.
function extractApssConditions(client) {
  if (!client) return [];
  const apss = [];
  if (client.apss_s2_high_blood_pressure) apss.push({ name: 'Hypertension / High Blood Pressure', notes: client.apss_s2_bp_medication_details || null });
  if (client.apss_s2_high_cholesterol) apss.push({ name: 'High Cholesterol / Dyslipidaemia', notes: client.apss_s2_cholesterol_medication_details || null });
  if (client.apss_s2_high_blood_sugar) apss.push({ name: 'High Blood Sugar / Glucose Intolerance', notes: client.apss_s2_glucose_medication_details || null });
  if (client.apss_s2_smoking) apss.push({ name: 'Smoking / Nicotine Use', notes: client.apss_s2_smoking_details || null });
  if (client.apss_s2_vaping) apss.push({ name: 'Vaping', notes: client.apss_s2_vaping_details || null });
  if (client.apss_s2_family_history) apss.push({ name: 'Family History of Cardiovascular Disease', notes: null });
  if (client.apss_s2_musculoskeletal_issues) apss.push({ name: 'Musculoskeletal Issues', notes: client.apss_s2_musculoskeletal_details || null });
  if (client.apss_s2_hospital_admissions) apss.push({ name: 'Recent Hospital Admission', notes: client.apss_s2_hospital_admissions_details || null });
  if (client.apss_s2_pregnancy) apss.push({ name: 'Pregnancy / Recent Childbirth', notes: client.apss_s2_pregnancy_details || null });
  if (client.apss_s2_bmi && client.apss_s2_bmi >= 30) apss.push({ name: 'Obesity (BMI ≥ 30)', notes: `BMI: ${client.apss_s2_bmi}` });
  else if (client.apss_s2_bmi && client.apss_s2_bmi >= 25) apss.push({ name: 'Overweight (BMI 25–29.9)', notes: `BMI: ${client.apss_s2_bmi}` });
  return apss;
}

export default function AssessmentRecommendations({ clientConditions, allAssessments, clientAssessments, clientId, onAssessmentAdded, client }) {
  const ai = useAiCapability();
  const [recommendations, setRecommendations] = useState([]);
  const [addingId, setAddingId] = useState(null);
  const [recommendationState, setRecommendationState] = useState('loading');
  const [stateMessage, setStateMessage] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [source, setSource] = useState('rule_based');

  const allConditions = useMemo(() => {
    const apssConditions = extractApssConditions(client);
    return [
      ...(clientConditions || []).map(condition => ({
        name: condition.condition_name,
        type: condition.condition_type,
        notes: condition.notes,
      })),
      ...apssConditions.map(condition => ({
        name: condition.name,
        type: 'comorbidity',
        notes: condition.notes,
      })),
    ];
  }, [clientConditions, client]);

  useEffect(() => {
    let cancelled = false;

    const enhanceRecommendationReasons = async (discovered) => {
      if (!legacyRecommendationAiAllowed) {
        setSource('rule_based');
        return;
      }
      if (!ai.canTrigger) {
        setSource('rule_based');
        return;
      }

      setIsEnhancing(true);
      try {
        const candidates = discovered
          .slice(0, MAX_ASSESSMENT_RECOMMENDATIONS)
          .map(assessment => ({
            id: String(assessment.id),
            name: assessment.name,
            catalogue_match_reason: assessment.reason,
          }));
        const conditionNames = allConditions
          .map(condition => condition.name)
          .filter(Boolean)
          .slice(0, 20)
          .map(name => String(name).slice(0, 160));

        const prompt = `Write one concise clinical-context explanation for each already-selected assessment below.
The assessment selection and order are fixed by the local catalogue matcher. Do not add, remove, replace or reorder candidates, and do not introduce facts not present in the condition names or catalogue match reasons.

${JSON.stringify({ condition_names: conditionNames, selected_candidates: candidates })}`;

        const response = await base44.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: 'object',
            properties: {
              recommendations: {
                type: 'array',
                maxItems: MAX_ASSESSMENT_RECOMMENDATIONS,
                items: {
                  type: 'object',
                  properties: {
                    assessment_id: { type: 'string' },
                    reason: { type: 'string', maxLength: 400 },
                  },
                  required: ['assessment_id', 'reason'],
                },
              },
            },
            required: ['recommendations'],
          },
        });

        if (cancelled) return;
        const candidateIds = new Set(candidates.map(candidate => candidate.id));
        const responseRecommendations = response
          && typeof response === 'object'
          && 'recommendations' in response
          && Array.isArray(response.recommendations)
          ? response.recommendations
          : [];
        const enhancedReasons = new Map();
        for (const item of responseRecommendations) {
          const id = String(item?.assessment_id);
          const reason = String(item?.reason || '').replace(/\s+/g, ' ').trim().slice(0, 400);
          if (candidateIds.has(id) && reason) enhancedReasons.set(id, reason);
        }

        if (enhancedReasons.size > 0) {
          setRecommendations(discovered.map(assessment => ({
            ...assessment,
            reason: enhancedReasons.get(String(assessment.id)) || assessment.reason,
          })));
          setSource('ai');
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Error enhancing assessment recommendation reasons:', error);
        ai.reportError(error);
        setSource('rule_based');
        setRecommendationState('degraded');
        setStateMessage('Catalogue matches are shown. AI explanations are temporarily unavailable.');
      } finally {
        if (!cancelled) setIsEnhancing(false);
      }
    };

    const generateRecommendations = async () => {
      setRecommendations([]);
      setSource('rule_based');
      setStateMessage('');
      setIsEnhancing(false);

      if (allConditions.length === 0) {
        setRecommendationState('no_conditions');
        return;
      }
      if (!Array.isArray(allAssessments)) {
        setRecommendationState('loading');
        setStateMessage('Loading the assessment catalogue…');
        return;
      }
      if (allAssessments.length === 0) {
        setRecommendationState('degraded');
        setStateMessage('The assessment catalogue is unavailable, so suggestions cannot be generated right now.');
        return;
      }

      try {
        const discovered = discoverAssessments({
          conditions: allConditions,
          assessments: allAssessments,
          existingAssessmentIds: (clientAssessments || []).map(assessment => assessment.assessment_id),
        });
        if (cancelled) return;

        setRecommendations(discovered);
        if (discovered.length === 0) {
          setRecommendationState('no_match');
          setStateMessage('No unused assessments in the catalogue matched the recorded conditions.');
          return;
        }

        setRecommendationState('ready');
        await enhanceRecommendationReasons(discovered);
      } catch (error) {
        if (cancelled) return;
        console.error('Error matching assessment recommendations:', error);
        setRecommendations([]);
        setSource('rule_based');
        setRecommendationState('degraded');
        setStateMessage('Suggested assessments are temporarily unavailable. Browse the assessment library to add one manually.');
      }
    };

    generateRecommendations();
    return () => {
      cancelled = true;
    };
  }, [allAssessments, allConditions, clientAssessments, ai.canTrigger, ai.reportError]);

  const handleAddAssessment = async (assessment) => {
    setAddingId(assessment.id);
    try {
      const clients = await base44.entities.Client.filter({ id: clientId });
      const org_id = clients[0]?.org_id;

      await ClientAssessment.create({
        org_id,
        client_id: clientId,
        assessment_id: assessment.id,
        assessment_date: todayLocal(),
        status: 'pending',
      });
      toast.success(`"${assessment.name}" has been added.`);
      onAssessmentAdded();
    } catch (error) {
      console.error('Failed to add recommended assessment:', error);
      toast.error('Failed to add assessment.');
    } finally {
      setAddingId(null);
    }
  };

  if (allConditions.length === 0) return null;

  const collapsedMessage = recommendationState === 'degraded' || recommendationState === 'no_match'
    ? stateMessage
    : isEnhancing
      ? 'Catalogue matches are ready while AI explanations are being refined.'
      : source === 'rule_based'
        ? AI_COPY.ruleBasedExplanation
        : 'Based on the client\'s recorded conditions and assessment catalogue';

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-yellow-200/80">
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              {source === 'ai' ? <Sparkles className="w-5 h-5" /> : <Lightbulb className="w-5 h-5" />}
              Suggested Assessments
            </CardTitle>
            <Badge variant="outline" className="border-yellow-300 text-yellow-800">
              {source === 'ai' ? AI_COPY.aiAssistedBadge : AI_COPY.ruleBasedBadge}
            </Badge>
            <Badge variant="secondary">{recommendations.length}</Badge>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5 text-yellow-700" /> : <ChevronDown className="w-5 h-5 text-yellow-700" />}
        </div>
        {!isExpanded && <p className="text-sm text-yellow-700">{collapsedMessage}</p>}
      </CardHeader>

      {isExpanded && (
        <CardContent>
          {source === 'rule_based' && recommendations.length > 0 && (
            <p className="text-sm text-yellow-800 mb-3">{AI_COPY.ruleBasedExplanation}</p>
          )}
          {legacyRecommendationAiAllowed && !ai.canTrigger && recommendations.length > 0 && (
            <p className="text-xs text-slate-500 mb-3">
              Catalogue matches remain available. {ai.unavailableMessage}
            </p>
          )}
          {isEnhancing && (
            <div className="flex items-center text-xs text-yellow-700 mb-3" role="status">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              {AI_COPY.analysingConditions}
            </div>
          )}
          {recommendationState === 'degraded' && recommendations.length > 0 && (
            <p className="text-sm text-amber-800 bg-amber-100/70 rounded-md p-2 mb-3" role="status">
              {stateMessage}
            </p>
          )}

          {recommendationState === 'loading' ? (
            <div className="flex items-center justify-center py-6" role="status">
              <Loader2 className="w-6 h-6 animate-spin text-yellow-600 mr-2" />
              <span className="text-sm text-yellow-700">{stateMessage || 'Loading suggested assessments…'}</span>
            </div>
          ) : recommendations.length === 0 ? (
            <p className="text-sm text-yellow-700 text-center py-4" role="status">
              {stateMessage || 'No unused catalogue assessments matched the recorded conditions.'}
            </p>
          ) : (
            <div className="space-y-3">
              {recommendations.map(assessment => (
                <div key={assessment.id} className="flex items-start justify-between p-3 bg-white/80 rounded-lg border border-yellow-200">
                  <div className="flex-1 mr-3">
                    <h4 className="font-semibold text-slate-800">{assessment.name}</h4>
                    <p className="text-sm text-slate-700 mt-1">{assessment.reason}</p>
                    {assessment.description && (
                      <p className="text-xs text-slate-500 mt-1">{assessment.description}</p>
                    )}
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

          {source === 'ai' && recommendations.length > 0 && <AIDisclosureNote className="mt-3" />}
        </CardContent>
      )}
    </Card>
  );
}
