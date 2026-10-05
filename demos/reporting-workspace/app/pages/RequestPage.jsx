import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { api, newCommandId } from '../lib/api';
import { describeError, formatDate, recipientRoleLabel } from '../lib/format';
import CompletenessPanel from '../components/CompletenessPanel';
import DocumentFrame from '../components/DocumentFrame';
import ReviewPanel from '../components/ReviewPanel';
import SectionEditor from '../components/SectionEditor';
import SourcesPanel from '../components/SourcesPanel';
import { CompletenessChips, OriginBadge, ReviewStateBadge, StatusBadge } from '../components/StatusBadge';

const EDITABLE = new Set(['draft', 'needs_review', 'amendment_in_progress']);

export default function RequestPage() {
  const { requestId } = useParams();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [edits, setEdits] = useState({});
  const [panel, setPanel] = useState('evidence');
  const [highlightedSource, setHighlightedSource] = useState('');
  const [preview, setPreview] = useState(null);
  const [notApplicable, setNotApplicable] = useState(null);

  const load = useCallback(async () => {
    const next = await api.request(requestId);
    setDetail(next);
    setEdits({});
    return next;
  }, [requestId]);

  useEffect(() => {
    let cancelled = false;
    load().catch((failure) => { if (!cancelled) setError(describeError(failure)); });
    return () => { cancelled = true; };
  }, [load]);

  const revision = detail?.current_revision || null;
  const sections = revision?.sections || [];
  const definitions = useMemo(() => new Map((detail?.report_type?.sections || []).map((entry) => [entry.key, entry])), [detail]);
  const status = detail?.request.status;
  const editable = Boolean(detail && EDITABLE.has(status) && detail.permissions.can_author);
  const aiDraftSources = useMemo(() => (detail?.current_source_set?.items || []).filter((entry) => entry.category === 'prior_report' && entry.ai_assisted), [detail]);
  const dirty = Object.keys(edits).length > 0;

  const run = async (label, action) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await action();
      await load();
      setNotice(typeof result === 'string' ? result : label);
    } catch (failure) {
      setError(describeError(failure));
      if (failure.status === 409 && failure.code === 'request_changed') {
        await load().catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  };

  const command = (name, payload = {}) => api.command(requestId, name, { expected_version: detail.request.version, command_id: newCommandId(), ...payload });

  const saveDraft = () => run('Draft saved as a new revision.', async () => {
    const updates = Object.entries(edits).map(([key, text]) => ({ key, text }));
    await command('saveDraft', { sections: updates });
  });

  const markReviewed = (section) => run(`${section.title} marked as reviewed.`, async () => {
    const updates = Object.entries(edits).map(([key, text]) => ({ key, text }));
    const existing = updates.find((entry) => entry.key === section.key);
    if (existing) existing.review_state = 'reviewed';
    else updates.push({ key: section.key, review_state: 'reviewed' });
    await command('saveDraft', { sections: updates });
  });

  const submitNotApplicable = () => {
    const { section, reason } = notApplicable;
    setNotApplicable(null);
    return run(`${section.title} marked not applicable.`, async () => {
      await command('saveDraft', { sections: [{ key: section.key, not_applicable_reason: reason, review_state: 'not_applicable' }] });
    });
  };

  const importAiDraft = (section, source) => {
    const fields = Object.keys(source.content?.section_content || {});
    const contentById = new Map(detail.pinned_sources.map((entry) => [entry.source_id, entry.content]));
    const content = contentById.get(source.source_id) || {};
    const available = Object.keys(content.section_content || {});
    const field = available[0] || fields[0];
    if (!field) {
      setError('The pinned AI-assisted draft has no importable text.');
      return;
    }
    run(`Imported the AI-assisted draft into ${section.title}; review it before approval.`, async () => {
      await command('importAiDraftSection', { section_key: section.key, source_id: source.source_id, field });
    });
  };

  const requestAiDraft = (section) => run('', async () => {
    await api.aiDraftSection(requestId, { expected_version: detail.request.version, command_id: newCommandId(), section_key: section.key });
    return `AI-assisted draft applied to ${section.title}; it requires clinician review.`;
  });

  const openPreview = async () => {
    setBusy(true);
    setError('');
    try {
      const html = await api.preview(requestId);
      setPreview({ title: 'Draft preview — not approved', html });
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  };

  const openSnapshotDocument = async (snapshotId) => {
    setBusy(true);
    setError('');
    try {
      const html = await api.snapshotDocument(snapshotId);
      setPreview({ title: `Approved snapshot ${snapshotId}`, html, snapshotId });
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  };

  const selectSource = (sourceId) => {
    setHighlightedSource(sourceId);
    setPanel('sources');
  };

  if (error && !detail) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!detail) return <p className="text-sm text-slate-500">Loading request…</p>;

  const { request, summary } = detail;

  return (
    <div className="space-y-4" data-testid="request-page" data-status={status}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            <Link to="/" className="underline">Reports and outputs</Link> / <Link to={`/episodes/${encodeURIComponent(request.physio_care_episode_id)}`} className="underline">{summary.client_display_name}</Link> / {summary.report_label}
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">{summary.report_label}</h1>
          <p className="text-sm text-slate-600">{request.purpose}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <StatusBadge status={status} />
            <span>Owner {summary.owner?.display_name}</span>
            <span>· Recipient {request.recipient.name} ({recipientRoleLabel(request.recipient.role)}{request.recipient.organisation ? `, ${request.recipient.organisation}` : ''})</span>
            <span className={summary.is_overdue ? 'font-semibold text-red-700' : ''}>· Due {formatDate(request.due_date)}{summary.is_overdue ? ' (overdue)' : ''}</span>
            <span>· Version {request.version}</span>
            <CompletenessChips summary={request.completeness?.summary} blockingGaps={request.completeness?.blocking_gaps} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="request-actions">
          {status === 'requested' && detail.permissions.can_author ? (
            <Button disabled={busy} onClick={() => run('Evidence assembled and sources pinned.', () => command('assembleEvidence'))} data-testid="assemble-evidence">Assemble evidence</Button>
          ) : null}
          {status === 'assembling_evidence' && detail.permissions.can_author ? (
            <>
              <Button variant="outline" disabled={busy} onClick={() => run('Evidence re-assembled.', () => command('assembleEvidence'))}>Re-assemble</Button>
              <Button disabled={busy} onClick={() => run('Draft started from the pinned sources.', () => command('startDraft'))} data-testid="start-draft">Start draft</Button>
            </>
          ) : null}
          {editable ? (
            <>
              <Button variant="outline" disabled={busy || !dirty} onClick={saveDraft} data-testid="save-draft">Save draft{dirty ? ' *' : ''}</Button>
              {status !== 'needs_review' ? (
                <Button disabled={busy || dirty} onClick={() => run('Submitted for review.', () => command('submitForReview'))} data-testid="submit-review" title={dirty ? 'Save the draft first' : ''}>Submit for review</Button>
              ) : null}
            </>
          ) : null}
          {revision ? <Button variant="secondary" disabled={busy} onClick={openPreview} data-testid="preview-draft">Preview{['approved', 'sent'].includes(status) ? ' current revision' : ' draft'}</Button> : null}
          {request.current_snapshot_id ? <Button variant="secondary" disabled={busy} onClick={() => openSnapshotDocument(request.current_snapshot_id)} data-testid="open-snapshot">Open approved document</Button> : null}
        </div>
      </div>

      {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800" data-testid="error-message">{error}</p> : null}
      {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-800" data-testid="notice-message">{notice}</p> : null}
      {detail.staleness?.is_stale && !['approved', 'sent', 'cancelled'].includes(status) ? (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900" data-testid="stale-banner">
          <AlertTitle>New evidence available</AlertTitle>
          <AlertDescription>Source records changed after the current sources were pinned. The draft has not been altered. Review the changes in the Sources panel and refresh explicitly if the report should use them.</AlertDescription>
        </Alert>
      ) : null}
      {request.cancellation ? (
        <Alert><AlertTitle>Cancelled</AlertTitle><AlertDescription>{request.cancellation.reason}</AlertDescription></Alert>
      ) : null}

      {!revision ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Alert>
              <AlertTitle>No draft yet</AlertTitle>
              <AlertDescription>
                {status === 'requested' ? 'Assemble evidence to pin a source set and see completeness before drafting.' : 'A source set is pinned. Start the draft to generate the facts sections from it.'}
              </AlertDescription>
            </Alert>
            <div className="mt-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">Questions this report must answer</h2>
              {request.clinical_questions.length === 0 ? <p className="text-sm text-slate-500">None recorded.</p> : <ul className="list-disc pl-5 text-sm">{request.clinical_questions.map((question) => <li key={question}>{question}</li>)}</ul>}
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Evidence and completeness</h2>
            <CompletenessPanel completeness={request.completeness} />
            {detail.current_source_set ? <div className="mt-4"><SourcesPanel sourceSet={detail.current_source_set} pinnedSources={detail.pinned_sources} staleness={detail.staleness} canRefresh={false} /></div> : null}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)_360px]">
          <nav aria-label="Report outline" className="space-y-1 lg:sticky lg:top-4 lg:self-start" data-testid="outline">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Outline</h2>
            {sections.map((section) => (
              <a key={section.key} href={`#section-${section.key}`} className="block rounded px-2 py-1 text-xs hover:bg-slate-100">
                <span className="font-medium text-slate-800">{section.title}</span>
                <span className="mt-0.5 flex flex-wrap gap-1"><OriginBadge section={section} />{section.kind === 'narrative' ? <ReviewStateBadge state={section.review_state} /> : null}</span>
              </a>
            ))}
            <p className="pt-2 text-[11px] text-slate-500">Revision {revision.revision_number} of {detail.revision_count} · source set v{revision.source_set_version}</p>
            {revision.amendment ? <p className="text-[11px] text-violet-800">Amendment of {revision.amendment.supersedes_snapshot_id}: {revision.amendment.reason}</p> : null}
            {revision.refresh_diff ? <p className="text-[11px] text-amber-800">Refreshed from v{revision.refresh_diff.from_version} to v{revision.refresh_diff.to_version}: {revision.refresh_diff.changed.length} changed, {revision.refresh_diff.added.length} added, {revision.refresh_diff.removed.length} removed.</p> : null}
          </nav>

          <div className="space-y-3" data-testid="sections">
            {sections.map((section) => (
              <SectionEditor
                key={`${revision.id}-${section.key}`}
                section={section}
                definition={definitions.get(section.key)}
                editable={editable}
                value={edits[section.key] ?? section.text ?? ''}
                onChange={(value) => setEdits((current) => ({ ...current, [section.key]: value }))}
                onMarkReviewed={() => markReviewed(section)}
                onMarkNotApplicable={() => setNotApplicable({ section, reason: '' })}
                onImportAiDraft={(source) => importAiDraft(section, source)}
                onRequestAiDraft={() => requestAiDraft(section)}
                aiDrafting={detail.ai_drafting}
                aiDraftSources={aiDraftSources}
                onSelectSource={selectSource}
              />
            ))}
          </div>

          <aside className="lg:sticky lg:top-4 lg:self-start" data-testid="side-panel">
            <Tabs value={panel} onValueChange={setPanel}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="evidence">Evidence</TabsTrigger>
                <TabsTrigger value="sources">Sources{detail.staleness?.is_stale ? <Badge variant="destructive" className="ml-1 px-1 text-[10px]">!</Badge> : null}</TabsTrigger>
                <TabsTrigger value="review">Review</TabsTrigger>
              </TabsList>
              <TabsContent value="evidence" className="max-h-[75vh] overflow-y-auto">
                <CompletenessPanel completeness={request.completeness} onSelectSource={selectSource} />
              </TabsContent>
              <TabsContent value="sources" className="max-h-[75vh] overflow-y-auto">
                <SourcesPanel
                  sourceSet={detail.current_source_set}
                  pinnedSources={detail.pinned_sources}
                  staleness={detail.staleness}
                  canRefresh={editable}
                  busy={busy}
                  highlightedSource={highlightedSource}
                  onRefresh={() => run('Sources refreshed into a new revision; review the carried-forward narrative.', () => command('refreshSources'))}
                />
              </TabsContent>
              <TabsContent value="review" className="max-h-[75vh] overflow-y-auto">
                <ReviewPanel
                  detail={detail}
                  busy={busy}
                  onApprove={(payload) => run('Approved. An immutable snapshot was created.', () => command('approve', payload))}
                  onOpenAmendment={(reason) => run('Amendment opened from the approved snapshot.', () => command('openAmendment', { reason }))}
                  onRecordDelivery={(payload) => run('Delivery recorded manually.', () => command('recordDelivery', payload))}
                  onCancel={(reason) => run('Request cancelled.', () => command('cancel', { reason }))}
                />
              </TabsContent>
            </Tabs>
          </aside>
        </div>
      )}

      {preview ? (
        <Dialog open onOpenChange={(open) => { if (!open) setPreview(null); }}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl" data-testid="preview-dialog">
            <DialogHeader>
              <DialogTitle>{preview.title}</DialogTitle>
              <DialogDescription>Rendered deterministically from structured data. {preview.snapshotId ? 'This is the frozen approved document.' : 'A draft preview carries a visible not-approved state.'}</DialogDescription>
            </DialogHeader>
            <DocumentFrame
              html={preview.html}
              title={preview.title}
              onPrint={preview.snapshotId ? () => api.command(requestId, 'recordExport', { snapshot_id: preview.snapshotId, format: 'print' }).then(load).catch(() => {}) : null}
            />
          </DialogContent>
        </Dialog>
      ) : null}

      {notApplicable ? (
        <Dialog open onOpenChange={(open) => { if (!open) setNotApplicable(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Mark “{notApplicable.section.title}” as not applicable</DialogTitle>
              <DialogDescription>A reason is recorded and rendered in the document; missingness is information, not blank prose.</DialogDescription>
            </DialogHeader>
            <textarea className="w-full rounded-md border border-input p-2 text-sm" rows={3} value={notApplicable.reason} onChange={(event) => setNotApplicable((current) => ({ ...current, reason: event.target.value }))} data-testid="not-applicable-reason" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNotApplicable(null)}>Back</Button>
              <Button disabled={!notApplicable.reason.trim()} onClick={submitNotApplicable} data-testid="not-applicable-confirm">Record</Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
