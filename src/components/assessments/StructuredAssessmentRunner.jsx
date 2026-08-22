import React, { useEffect, useState } from 'react';
import { X, Users } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  scoreStructuredAssessment,
  STRUCTURED_ASSESSMENT_FIELDS,
} from '@/lib/clinical/assessmentScoring';
import { resolveRegisteredAssessmentScorer } from '@/lib/clinical/assessmentScorerRegistry';
import { todayLocal } from '@/lib/localDate';
import { saveAssessmentToSOAP } from './TestRunnerSOAPHelper';

// Explicit scorer-module declarations are consumed by the catalogue binding
// audit. The runner resolves these scorers through the production registry.
export const STRUCTURED_REGISTERED_SCORER_MODULES = Object.freeze([
  '@/lib/clinical/scorers/residualAssessments',
]);

export default function StructuredAssessmentRunner({
  assessment,
  client = null,
  clientAssessment = null,
  onSave,
  onClose,
  isStandaloneMode = false,
  scoringKey,
  clinicianNotes = '',
}) {
  const [values, setValues] = useState({});
  const [selectedClient, setSelectedClient] = useState(client);
  const [clients, setClients] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const registeredScorer = resolveRegisteredAssessmentScorer(scoringKey);
  const fields = registeredScorer?.runnerSpec?.kind !== 'questionnaire'
    ? registeredScorer?.runnerSpec?.fields
    : STRUCTURED_ASSESSMENT_FIELDS[scoringKey];

  useEffect(() => {
    if (!isStandaloneMode || client) return;
    let cancelled = false;
    (async () => {
      try {
        const user = await base44.auth.me();
        const memberships = await base44.entities.OrganizationMember.filter({ user_email: user.email });
        if (memberships.length === 0) return;
        const records = await base44.entities.Client.filter({ org_id: memberships[0].org_id });
        if (!cancelled) setClients(records || []);
      } catch (error) {
        console.error('Error loading clients for structured assessment:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [client, isStandaloneMode]);

  if (!fields) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-lg">
          <CardHeader><CardTitle>Unsupported assessment contract</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p>No structured scoring contract is registered for {assessment?.name || scoringKey}.</p>
            <Button onClick={onClose}>Close</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSave = async () => {
    if (isStandaloneMode && !selectedClient) {
      toast.error('Please select a client to assign this assessment to.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = registeredScorer
        ? registeredScorer.validateAndScore(values, {
          assessmentName: assessment.name,
          assessmentDate: todayLocal(),
          notes: clinicianNotes,
          client: selectedClient || client,
        })
        : scoreStructuredAssessment(scoringKey, values, {
          assessmentName: assessment.name,
          notes: clinicianNotes,
        });
      const clientToUse = selectedClient || client;
      if (clientToUse) {
        const recordPayload = {
          org_id: clientToUse.org_id,
          client_id: clientToUse.id,
          assessment_id: assessment.id,
          ...(clientAssessment?.physio_care_episode_id
            ? { physio_care_episode_id: clientAssessment.physio_care_episode_id }
            : {}),
          ...payload,
        };
        const persisted = clientAssessment?.id
          ? await base44.entities.ClientAssessment.update(clientAssessment.id, recordPayload)
          : await base44.entities.ClientAssessment.create(recordPayload);
        await saveAssessmentToSOAP({
          clientToUse,
          appointmentId: clientAssessment?.appointment_id || null,
          objectiveText: payload.additional_data.soap_text,
          assessmentToUpdateId: persisted.id,
          updateData: payload,
          assessment,
          careEpisodeId: persisted.physio_care_episode_id || null,
        });
        toast.success('Assessment completed and saved to client!');
      }
      onSave(payload);
    } catch (error) {
      toast.error(error?.message || 'Unable to score this assessment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b sticky top-0 bg-white z-10">
          <div>
            <CardTitle>{assessment.name}</CardTitle>
            {assessment.description && <p className="text-sm text-slate-600 mt-1">{assessment.description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          {assessment.instructions && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 whitespace-pre-wrap">
              {assessment.instructions}
            </div>
          )}

          {isStandaloneMode && !client && (
            <div>
              <Label>Assign to client</Label>
              <Select value={selectedClient?.id || ''} onValueChange={(id) => setSelectedClient(clients.find((candidate) => candidate.id === id))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select a client"><Users className="w-4 h-4 mr-2" />{selectedClient?.full_name}</SelectValue></SelectTrigger>
                <SelectContent>{clients.map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          {fields.map((field) => (
            <div key={field.key}>
              <Label htmlFor={`structured-${field.key}`}>{field.label}{field.unit ? ` (${field.unit})` : ''}</Label>
              {field.type === 'select' ? (
                <Select value={values[field.key] || ''} onValueChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}>
                  <SelectTrigger id={`structured-${field.key}`} className="mt-1"><SelectValue placeholder={`Select ${field.label.toLowerCase()}`} /></SelectTrigger>
                  <SelectContent>{field.options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                </Select>
              ) : field.type === 'textarea' ? (
                <Textarea
                  id={`structured-${field.key}`}
                  className="mt-1"
                  rows={5}
                  value={values[field.key] || ''}
                  onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                />
              ) : (
                <Input
                  id={`structured-${field.key}`}
                  className="mt-1"
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={values[field.key] ?? ''}
                  onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                />
              )}
            </div>
          ))}

          <div className="flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting}>{submitting ? 'Saving…' : 'Save assessment'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
