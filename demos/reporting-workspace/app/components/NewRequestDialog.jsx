import React, { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RECIPIENT_ROLES } from '@domain/reportTypes.mjs';

import { api, newCommandId } from '../lib/api';
import { describeError, recipientRoleLabel } from '../lib/format';
import { CompletenessChips } from './StatusBadge';

const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm';

/**
 * New report request flow, opened from the episode context. Captures the
 * administrative request (purpose, recipient, questions, owner, due date and
 * required evidence) separately from any clinical content.
 */
export default function NewRequestDialog({ open, onOpenChange, workspace, reportTypes, defaultOwnerId, onCreated }) {
  const [form, setForm] = useState({
    report_type: reportTypes[0]?.id || '',
    purpose: '',
    recipient_name: '',
    recipient_role: 'referring_gp',
    recipient_organisation: '',
    recipient_channel: 'secure_message',
    clinical_questions: '',
    owner_user_id: defaultOwnerId || workspace.clinicians[0]?.id || '',
    due_date: '',
    required_evidence: null,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const commandId = useMemo(() => newCommandId(), []);
  const reportType = reportTypes.find((entry) => entry.id === form.report_type) || null;
  const completenessPreview = reportType ? workspace.completeness_by_type[reportType.id] : null;
  const requirementKeys = reportType ? reportType.requirements : [];
  const selectedRequirements = form.required_evidence || requirementKeys;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const toggleRequirement = (key) => {
    setForm((current) => {
      const base = current.required_evidence || requirementKeys;
      const next = base.includes(key) ? base.filter((entry) => entry !== key) : [...base, key];
      return { ...current, required_evidence: next };
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const created = await api.createRequest({
        command_id: commandId,
        physio_care_episode_id: workspace.episode.id,
        client_id: workspace.client.id,
        report_type: form.report_type,
        purpose: form.purpose,
        recipient: {
          name: form.recipient_name,
          role: form.recipient_role,
          organisation: form.recipient_organisation,
          channel: form.recipient_channel,
        },
        clinical_questions: form.clinical_questions.split('\n').map((line) => line.trim()).filter(Boolean),
        owner_user_id: form.owner_user_id,
        due_date: form.due_date,
        required_evidence: selectedRequirements,
      });
      onCreated(created.request_id);
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="space-y-4" data-testid="new-request-form">
          <DialogHeader>
            <DialogTitle>New report request</DialogTitle>
            <DialogDescription>
              For {workspace.client.display_name} — {workspace.episode.title}. The request records who needs what by when; the clinical content is drafted afterwards from pinned evidence.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="report_type">Report type</Label>
              <select id="report_type" className={selectClass} value={form.report_type} onChange={(event) => setForm((current) => ({ ...current, report_type: event.target.value, required_evidence: null }))}>
                {reportTypes.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
              </select>
              {reportType ? <p className="mt-1 text-xs text-slate-500">{reportType.description} Template {reportType.template_version}.</p> : null}
              {completenessPreview ? (
                <p className="mt-1 text-xs">Evidence available now: <CompletenessChips summary={completenessPreview.summary} blockingGaps={completenessPreview.blocking_gaps} /></p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="purpose">Purpose</Label>
              <Input id="purpose" value={form.purpose} onChange={update('purpose')} required maxLength={600} placeholder="Why this report is being produced" />
            </div>
            <div>
              <Label htmlFor="recipient_name">Recipient name</Label>
              <Input id="recipient_name" value={form.recipient_name} onChange={update('recipient_name')} required maxLength={200} />
            </div>
            <div>
              <Label htmlFor="recipient_role">Recipient role</Label>
              <select id="recipient_role" className={selectClass} value={form.recipient_role} onChange={update('recipient_role')}>
                {RECIPIENT_ROLES.map((role) => <option key={role} value={role}>{recipientRoleLabel(role)}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="recipient_organisation">Recipient organisation</Label>
              <Input id="recipient_organisation" value={form.recipient_organisation} onChange={update('recipient_organisation')} maxLength={200} />
            </div>
            <div>
              <Label htmlFor="recipient_channel">Intended channel</Label>
              <select id="recipient_channel" className={selectClass} value={form.recipient_channel} onChange={update('recipient_channel')}>
                <option value="secure_message">Secure message</option>
                <option value="email">Email</option>
                <option value="post">Post</option>
                <option value="portal">Portal upload</option>
                <option value="in_person">Handed to patient</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="clinical_questions">Clinical questions to answer (one per line)</Label>
              <Textarea id="clinical_questions" rows={3} value={form.clinical_questions} onChange={update('clinical_questions')} placeholder="What the recipient has asked, or what this report must answer" />
            </div>
            <div>
              <Label htmlFor="owner_user_id">Accountable owner</Label>
              <select id="owner_user_id" className={selectClass} value={form.owner_user_id} onChange={update('owner_user_id')}>
                {workspace.clinicians.map((clinician) => <option key={clinician.id} value={clinician.id}>{clinician.display_name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="due_date">Due date</Label>
              <Input id="due_date" type="date" value={form.due_date} onChange={update('due_date')} required />
            </div>
            {reportType ? (
              <div className="sm:col-span-2">
                <Label>Minimum evidence required</Label>
                <div className="mt-1 grid gap-1 sm:grid-cols-2">
                  {requirementKeys.map((key) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selectedRequirements.includes(key)} onChange={() => toggleRequirement(key)} />
                      <span>{key.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy} data-testid="create-request-submit">Create request</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
