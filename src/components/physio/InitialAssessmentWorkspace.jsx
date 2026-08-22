import React, { useMemo, useState } from 'react';
import { CheckCircle2, CircleDashed, ClipboardCheck, Stethoscope } from 'lucide-react';

import PhysioObjectiveExam from '@/components/onboarding/PhysioObjectiveExam';
import PhysioRedFlagScreen from '@/components/onboarding/PhysioRedFlagScreen';
import PhysioSubjectiveExam from '@/components/onboarding/PhysioSubjectiveExam';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const STEPS = [
  { id: 'screen', label: 'Red-flag screen', icon: ClipboardCheck },
  { id: 'subjective', label: 'Subjective', icon: CircleDashed },
  { id: 'objective', label: 'Objective', icon: Stethoscope },
];

function joinSummary(values) {
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : value))
    .filter((value) => value !== '' && value != null)
    .join(' · ');
}

function redFlagStatus(payload) {
  const outcome = payload?.physio_screen_summary?.outcome || payload?.physio_screen_outcome;
  if (outcome === 'no_red_flags') return 'clear';
  if (outcome === 'red_flags_present_referred') return 'referred';
  if (outcome === 'red_flags_present_managed') return 'managed';
  return 'not_recorded';
}

function examinationStatus(record) {
  return record?.completion_status === 'complete' ? 'Complete' : record ? 'Draft' : 'Not started';
}

function withRedFlagScreen(episode, payload) {
  return {
    ...episode,
    red_flag_screen: payload,
    last_reviewed_at: new Date().toISOString(),
    initial_findings: {
      ...(episode.initial_findings || {}),
      red_flag_status: redFlagStatus(payload),
      precautions:
        payload?.physio_screen_summary?.escalation?.activity_restriction
        || payload?.physio_screen_activity_restriction
        || payload?.physio_screen_summary?.clinical_reasoning
        || payload?.physio_screen_clinical_reasoning
        || '',
    },
  };
}

function withSubjective(episode, payload, completionStatus) {
  const recorded = {
    ...payload,
    completion_status: completionStatus,
    recorded_at: new Date().toISOString(),
  };
  const proposedGoal = payload.physio_subj_patient_goals?.trim();
  const goals = [...(episode.goals || [])];
  if (proposedGoal && !goals.some((goal) => goal.description?.trim() === proposedGoal)) {
    goals.push({
      id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      description: proposedGoal,
      target_date: '',
      status: 'planned',
    });
  }
  return {
    ...episode,
    subjective_examination: recorded,
    presenting_problem: payload.physio_subj_presenting_complaint || episode.presenting_problem || '',
    body_region: payload.physio_subj_body_chart_area || episode.body_region || '',
    goals,
    last_reviewed_at: recorded.recorded_at,
    initial_findings: {
      ...(episode.initial_findings || {}),
      subjective_summary: joinSummary([
        payload.physio_subj_presenting_complaint,
        payload.physio_subj_mechanism_of_onset,
        payload.physio_subj_duration,
        payload.physio_subj_aggravating_factors,
        payload.physio_subj_easing_factors,
      ]),
    },
  };
}

function withObjective(episode, payload, completionStatus) {
  const recorded = {
    ...payload,
    completion_status: completionStatus,
    recorded_at: new Date().toISOString(),
  };
  return {
    ...episode,
    objective_examination: recorded,
    last_reviewed_at: recorded.recorded_at,
    initial_findings: {
      ...(episode.initial_findings || {}),
      objective_summary: joinSummary([
        payload.physio_obj_observation_posture,
        payload.physio_obj_passive_rom_findings,
        payload.physio_obj_functional_tests,
        payload.physio_obj_palpation_findings,
      ]),
      physiotherapy_diagnosis:
        payload.physio_obj_diagnosis_clinical_impression
        || episode.initial_findings?.physiotherapy_diagnosis
        || '',
    },
  };
}

export default function InitialAssessmentWorkspace({
  episode,
  onChange,
  onPersist,
  isSaving = false,
}) {
  const [activeStep, setActiveStep] = useState('screen');

  const statuses = useMemo(() => ({
    screen: episode.red_flag_screen?.physio_screen_summary?.completion_status
      || (episode.red_flag_screen ? 'draft' : null),
    subjective: episode.subjective_examination?.completion_status || null,
    objective: episode.objective_examination?.completion_status || null,
  }), [episode]);

  const update = async (nextEpisode, nextStep) => {
    onChange(nextEpisode);
    if (nextStep) setActiveStep(nextStep);
    await onPersist?.(nextEpisode);
  };

  const renderStep = () => {
    if (activeStep === 'screen') {
      return (
        <PhysioRedFlagScreen
          key={`screen-${episode.id || 'new'}-${episode.red_flag_screen?.physio_screen_summary?.recorded_at || 'empty'}`}
          data={episode.red_flag_screen || {}}
          onBack={() => {}}
          canGoBack={false}
          onNext={(payload) => update(withRedFlagScreen(episode, payload), 'subjective')}
          onSaveAndFinishLater={(payload) => update(withRedFlagScreen(episode, payload))}
          isSubmitting={isSaving}
        />
      );
    }

    if (activeStep === 'subjective') {
      return (
        <PhysioSubjectiveExam
          key={`subjective-${episode.id || 'new'}-${episode.subjective_examination?.recorded_at || 'empty'}`}
          data={episode.subjective_examination || {}}
          onBack={() => setActiveStep('screen')}
          canGoBack
          onNext={(payload) => update(withSubjective(episode, payload, 'complete'), 'objective')}
          onSaveAndFinishLater={(payload) => update(withSubjective(episode, payload, 'draft'))}
          isSubmitting={isSaving}
        />
      );
    }

    return (
      <PhysioObjectiveExam
        key={`objective-${episode.id || 'new'}-${episode.objective_examination?.recorded_at || 'empty'}`}
        data={episode.objective_examination || {}}
        onBack={() => setActiveStep('subjective')}
        canGoBack
        onNext={(payload) => update(withObjective(episode, payload, 'complete'))}
        onSaveAndFinishLater={(payload) => update(withObjective(episode, payload, 'draft'))}
        isSubmitting={isSaving}
      />
    );
  };

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
          <ClipboardCheck className="h-5 w-5 text-teal-700" />
          Initial physiotherapy assessment
        </CardTitle>
        <p className="text-sm text-slate-500">
          Complete the structured safety screen, subjective history and objective examination.
          Each completed or draft step is saved into this episode.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid border-b border-slate-200 bg-slate-50 sm:grid-cols-3">
          {STEPS.map(({ id, label, icon: Icon }) => {
            const selected = activeStep === id;
            const complete = statuses[id] === 'complete';
            return (
              <Button
                key={id}
                type="button"
                variant="ghost"
                onClick={() => setActiveStep(id)}
                className={`h-auto justify-start rounded-none border-b-2 px-5 py-4 sm:justify-center ${
                  selected ? 'border-teal-700 bg-white text-teal-800' : 'border-transparent text-slate-600'
                }`}
              >
                {complete ? <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> : <Icon className="mr-2 h-4 w-4" />}
                <span>{label}</span>
                <Badge variant="outline" className="ml-2 bg-white text-[10px] font-medium">
                  {examinationStatus(
                    id === 'screen'
                      ? episode.red_flag_screen?.physio_screen_summary || episode.red_flag_screen
                      : id === 'subjective'
                        ? episode.subjective_examination
                        : episode.objective_examination,
                  )}
                </Badge>
              </Button>
            );
          })}
        </div>
        <div className="p-4 sm:p-6">{renderStep()}</div>
      </CardContent>
    </Card>
  );
}
