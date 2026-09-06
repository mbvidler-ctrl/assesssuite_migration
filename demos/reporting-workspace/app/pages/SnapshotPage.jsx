import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { api } from '../lib/api';
import { describeError, formatDateTime } from '../lib/format';
import DocumentFrame from '../components/DocumentFrame';

export default function SnapshotPage() {
  const { snapshotId } = useParams();
  const [snapshot, setSnapshot] = useState(null);
  const [html, setHtml] = useState('');
  const [chain, setChain] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await api.snapshot(snapshotId);
        const document = await api.snapshotDocument(snapshotId);
        const requestDetail = await api.request(meta.request_id);
        if (cancelled) return;
        setSnapshot(meta);
        setHtml(document);
        setChain(requestDetail.request.snapshot_chain.find((entry) => entry.snapshot_id === snapshotId) || null);
      } catch (failure) {
        if (!cancelled) setError(describeError(failure));
      }
    })();
    return () => { cancelled = true; };
  }, [snapshotId]);

  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!snapshot) return <p className="text-sm text-slate-500">Loading snapshot…</p>;

  return (
    <div className="space-y-4" data-testid="snapshot-page">
      <p className="text-xs text-slate-500"><Link to="/" className="underline">Reports and outputs</Link> / <Link to={`/requests/${encodeURIComponent(snapshot.request_id)}`} className="underline">Request</Link> / Snapshot {snapshot.sequence}</p>
      <h1 className="text-2xl font-semibold text-slate-900">Approved snapshot {snapshot.sequence}</h1>
      {chain?.superseded_by_snapshot_id ? (
        <Alert className="border-violet-300 bg-violet-50 text-violet-900" data-testid="superseded-alert">
          <AlertTitle>Superseded</AlertTitle>
          <AlertDescription>
            This snapshot was superseded on {formatDateTime(chain.superseded_at)} by <Link className="underline" to={`/snapshots/${encodeURIComponent(chain.superseded_by_snapshot_id)}`}>{chain.superseded_by_snapshot_id}</Link>{chain.supersession_reason ? `: ${chain.supersession_reason}` : ''}. It remains on record unchanged.
          </AlertDescription>
        </Alert>
      ) : null}
      {snapshot.supersedes_snapshot_id ? (
        <Alert className="border-violet-300 bg-violet-50 text-violet-900">
          <AlertTitle>Amended output</AlertTitle>
          <AlertDescription>This snapshot supersedes <Link className="underline" to={`/snapshots/${encodeURIComponent(snapshot.supersedes_snapshot_id)}`}>{snapshot.supersedes_snapshot_id}</Link>{snapshot.amendment?.reason ? `: ${snapshot.amendment.reason}` : ''}.</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle className="text-base">Provenance</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-y-1 text-xs">
              <dt className="text-slate-500">Snapshot id</dt><dd className="font-mono break-all">{snapshot.id}</dd>
              <dt className="text-slate-500">Approved by</dt><dd>{snapshot.approved_by_name} at {formatDateTime(snapshot.approved_at)}</dd>
              {snapshot.approval_note ? <><dt className="text-slate-500">Approval note</dt><dd>{snapshot.approval_note}</dd></> : null}
              <dt className="text-slate-500">Content hash</dt><dd className="font-mono break-all">{snapshot.content_sha256}</dd>
              <dt className="text-slate-500">Document hash</dt><dd className="font-mono break-all">{snapshot.document_sha256}</dd>
              <dt className="text-slate-500">Source manifest hash</dt><dd className="font-mono break-all">{snapshot.manifest_sha256}</dd>
              <dt className="text-slate-500">Source set</dt><dd className="font-mono">{snapshot.source_set_id} (v{snapshot.source_set_version}), {snapshot.source_set.items.length} sources</dd>
              <dt className="text-slate-500">Revision</dt><dd className="font-mono">{snapshot.revision_id} (#{snapshot.revision_number})</dd>
              <dt className="text-slate-500">Template / generator</dt><dd className="font-mono">{snapshot.template_version} / {snapshot.generator_version}</dd>
              <dt className="text-slate-500">Stale sources acknowledged</dt><dd>{snapshot.stale_sources_acknowledged ? 'Yes — approved as at pinned sources' : 'No'}</dd>
              <dt className="text-slate-500">AI-assisted sections</dt><dd>{snapshot.sections.filter((section) => section.origin === 'ai_assisted').map((section) => section.title).join('; ') || 'None'}</dd>
            </dl>
          </CardContent>
        </Card>
        <div>
          <DocumentFrame html={html} title={`Snapshot ${snapshot.id}`} onPrint={() => api.command(snapshot.request_id, 'recordExport', { snapshot_id: snapshot.id, format: 'print' }).catch(() => {})} />
        </div>
      </div>
    </div>
  );
}
