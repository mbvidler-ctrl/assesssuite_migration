import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { formatDateTime, titleCase } from '../lib/format';

/**
 * Review, approval, amendment and delivery controls plus the request's
 * append-only history and snapshot chain.
 */
export default function ReviewPanel({ detail, busy, onApprove, onOpenAmendment, onRecordDelivery, onCancel }) {
  const { request, permissions, staleness, snapshots, current_revision: revision } = detail;
  const [acknowledge, setAcknowledge] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');
  const [amendmentReason, setAmendmentReason] = useState('');
  const [deliveryChannel, setDeliveryChannel] = useState(request.recipient?.channel && request.recipient.channel !== 'not_specified' ? request.recipient.channel : 'secure_message');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const unreviewedAi = (revision?.sections || []).filter((section) => section.origin === 'ai_assisted' && section.review_state !== 'reviewed' && section.review_state !== 'not_applicable');
  const status = request.status;

  return (
    <div className="space-y-4" data-testid="review-panel">
      {status === 'needs_review' ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
          <h4 className="text-sm font-semibold text-amber-900">Approval</h4>
          {!permissions.can_approve ? (
            <p className="mt-1 text-xs text-amber-900">Your identity cannot approve reports. A clinician with the approval capability must approve this draft.</p>
          ) : null}
          {unreviewedAi.length > 0 ? (
            <p className="mt-1 text-xs text-amber-900">AI-assisted sections still need review: {unreviewedAi.map((section) => section.title).join('; ')}.</p>
          ) : null}
          {staleness?.is_stale ? (
            <label className="mt-2 flex items-start gap-2 text-xs text-amber-900">
              <input type="checkbox" checked={acknowledge} onChange={(event) => setAcknowledge(event.target.checked)} data-testid="acknowledge-stale" />
              <span>Newer source material exists. Approve this document as at its pinned sources (the acknowledgement is recorded in the snapshot).</span>
            </label>
          ) : null}
          <Label htmlFor="approval_note" className="mt-2 block text-xs">Approval note</Label>
          <Textarea id="approval_note" rows={2} value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} disabled={!permissions.can_approve} />
          <Button
            className="mt-2"
            size="sm"
            disabled={busy || !permissions.can_approve || unreviewedAi.length > 0 || (staleness?.is_stale && !acknowledge)}
            onClick={() => onApprove({ approval_note: approvalNote, acknowledge_stale_sources: acknowledge })}
            data-testid="approve-button"
          >
            Approve and freeze snapshot
          </Button>
          <p className="mt-1 text-[11px] text-amber-900">Approval renders the document deterministically and stores an immutable snapshot with its source manifest. Later corrections create a successor.</p>
        </div>
      ) : null}

      {['approved', 'sent'].includes(status) ? (
        <div className="space-y-3">
          <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900">
            <AlertTitle>Approved output is immutable</AlertTitle>
            <AlertDescription>
              Editing, refreshing and cancelling are disabled. Open an amendment to produce a linked successor snapshot; the original stays on record.
            </AlertDescription>
          </Alert>
          {permissions.can_author ? (
            <div className="rounded-md border border-violet-200 bg-violet-50 p-3">
              <Label htmlFor="amendment_reason" className="text-xs">Reason for amendment</Label>
              <Input id="amendment_reason" value={amendmentReason} onChange={(event) => setAmendmentReason(event.target.value)} placeholder="What is being corrected and why" />
              <Button size="sm" variant="secondary" className="mt-2" disabled={busy || !amendmentReason.trim()} onClick={() => onOpenAmendment(amendmentReason)} data-testid="open-amendment">Open amendment</Button>
            </div>
          ) : null}
          <div className="rounded-md border border-slate-200 p-3">
            <h4 className="text-sm font-semibold">Record delivery</h4>
            <p className="text-[11px] text-slate-500">No delivery integration exists in this workspace. Recording a delivery documents what a person did; it does not send anything.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="delivery_channel" className="text-xs">Channel</Label>
                <select id="delivery_channel" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={deliveryChannel} onChange={(event) => setDeliveryChannel(event.target.value)}>
                  <option value="secure_message">Secure message</option>
                  <option value="email">Email</option>
                  <option value="post">Post</option>
                  <option value="portal">Portal upload</option>
                  <option value="in_person">Handed to patient</option>
                </select>
              </div>
              <div>
                <Label htmlFor="delivery_note" className="text-xs">Note</Label>
                <Input id="delivery_note" value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} />
              </div>
            </div>
            <Button size="sm" variant="outline" className="mt-2" disabled={busy} onClick={() => onRecordDelivery({ channel: deliveryChannel, recipient_note: deliveryNote })} data-testid="record-delivery">Record as sent (manual)</Button>
          </div>
        </div>
      ) : null}

      {!['approved', 'sent', 'cancelled'].includes(status) ? (
        <div className="rounded-md border border-slate-200 p-3">
          <Label htmlFor="cancel_reason" className="text-xs">Cancel this request</Label>
          <Input id="cancel_reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Reason (retained in the history)" />
          <Button size="sm" variant="ghost" className="mt-2 text-red-700" disabled={busy || !cancelReason.trim()} onClick={() => onCancel(cancelReason)} data-testid="cancel-request">Cancel request</Button>
        </div>
      ) : null}

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Snapshots</h4>
        {snapshots.length === 0 ? <p className="text-xs text-slate-500">No approved snapshot yet.</p> : (
          <ul className="mt-1 space-y-1 text-xs" data-testid="snapshot-list">
            {snapshots.map((snapshot) => (
              <li key={snapshot.id} className="rounded border border-slate-200 p-2">
                <div className="flex items-center justify-between gap-2">
                  <Link className="font-medium text-blue-700 underline" to={`/snapshots/${encodeURIComponent(snapshot.id)}`}>Snapshot {snapshot.sequence}</Link>
                  <span className="text-slate-500">{formatDateTime(snapshot.approved_at)}</span>
                </div>
                <p className="text-slate-600">Approved by {snapshot.approved_by_name}; revision {snapshot.revision_number}; source set v{snapshot.source_set_version}.</p>
                <p className="break-all font-mono text-[10px] text-slate-500">content {snapshot.content_sha256.slice(0, 20)}… · document {snapshot.document_sha256.slice(0, 20)}…</p>
                {snapshot.supersedes_snapshot_id ? <p className="text-violet-800">Supersedes {snapshot.supersedes_snapshot_id}{snapshot.amendment?.reason ? `: ${snapshot.amendment.reason}` : ''}</p> : null}
                {snapshot.superseded_by_snapshot_id ? <p className="text-slate-500">Superseded by {snapshot.superseded_by_snapshot_id}</p> : null}
                {snapshot.stale_sources_acknowledged ? <p className="text-amber-800">Approved as at pinned sources while newer material existed.</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {request.delivery_events.length > 0 ? (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery record</h4>
          <ul className="mt-1 text-xs text-slate-600">
            {request.delivery_events.map((event) => <li key={event.id}>{formatDateTime(event.recorded_at)}: {titleCase(event.channel)} to {event.recipient_name}, {event.status.replace(/_/g, ' ')}{event.recipient_note ? ` — ${event.recipient_note}` : ''}</li>)}
          </ul>
        </div>
      ) : null}

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">History</h4>
        <ol className="mt-1 space-y-1 text-xs" data-testid="history-list">
          {[...request.history].reverse().map((entry) => (
            <li key={entry.sequence} className="flex gap-2">
              <span className="w-28 shrink-0 text-slate-400">{formatDateTime(entry.occurred_at)}</span>
              <span><span className="font-medium">{titleCase(entry.event)}</span> by {entry.actor_name}{entry.to_status ? ` → ${titleCase(entry.to_status)}` : ''}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
